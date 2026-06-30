const CACHE_NAME = 'toro-v51'; // Sube la versión cada que hagas cambios grandes

// TODAS LAS RUTAS DEBEN SER ABSOLUTAS CON EL PREFIJO /alumno_app/
const assets = [
  '/alumno_app/',
  '/alumno_app/index.html',
  '/alumno_app/styles/style.css',
  '/alumno_app/assets/logo_toro.png',
  '/alumno_app/manifest.json',
  '/alumno_app/jszip.min.js'
  // Agrega aquí cualquier otro archivo que necesites (ej. imágenes, fuentes, etc.)
];

// Instalación
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Agregamos los assets al caché
      return cache.addAll(assets).catch(err => {
        console.warn('Algún recurso falló al cachearse:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación (Limpia cachés viejos)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// ESTRATEGIA: NETWORK FIRST con fallback a caché
self.addEventListener('fetch', e => {
  // Ignoramos peticiones a otros dominios (como APIs externas)
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    // Si es un recurso externo, lo dejamos pasar sin caché
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(networkResponse => {
        // Si la petición fue exitosa, guardamos una copia en caché
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Si falla la red, intentamos recuperar del caché
        return caches.match(e.request).then(cachedResponse => {
          // Si existe en caché, lo devolvemos
          if (cachedResponse) return cachedResponse;
          
          // Si no existe, devolvemos el index.html como fallback (para SPA)
          // Esto es útil si alguien intenta navegar a una ruta que no está cacheada
          return caches.match('/alumno_app/index.html');
        });
      })
  );
});