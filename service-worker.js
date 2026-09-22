const CACHE_NAME = 'diario-rincones-v2';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Nunca cachear las llamadas a Supabase ni peticiones que no sean GET:
  // esas siempre deben ir a la red para no servir datos obsoletos.
  if (event.request.method !== 'GET' || url.hostname.includes('supabase.co')) {
    return;
  }
  // El HTML principal (la propia app) se sirve "red primero": siempre intenta traer
  // la versión más reciente publicada, y solo cae a la copia guardada si no hay
  // conexión. Así, al subir una actualización, se ve enseguida sin tener que
  // borrar caché a mano. El resto de recursos (fuentes, iconos, etc.) sigue
  // sirviéndose desde caché primero para que la app cargue rápido y funcione offline.
  const isAppShell = url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
