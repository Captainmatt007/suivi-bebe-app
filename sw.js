const CACHE_NAME = 'suivi-bebe-cache-v2'; // On change la version pour forcer la mise à jour
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  // On ajoute les images les plus importantes
  'image/couches.png',
  'image/tire-lait.png',
  'image/sheets.png',
  'image/login-illustration.png', // On ajoute l'illustration manquante
  'image/icon-192x192.png',
  'image/icon-512x512.png'
];

// Supprimer les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Étape d'installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
});

// Étape de fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si la ressource est dans le cache, on la retourne
        if (response) {
          return response;
        }
        // Sinon, on fait la requête au réseau
        return fetch(event.request);
      }
    )
  );
});