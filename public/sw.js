/**
 * Agrowealth Field Agent — Service Worker
 * Caches the app shell for offline use (data is handled by IndexedDB)
 */

const CACHE_NAME = 'agrowealth-field-v1';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache individually so one 404 doesn't abort the whole install
      return Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Navigation requests: network-first (fall back to cached shell when offline)
// - Static assets: cache-first
// - API calls: network-only (IndexedDB handles offline data)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Navigation requests — network-first for fresh HTML, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets — cache-first
  if (request.destination === 'style' || request.destination === 'script' ||
      request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Everything else — try network, fall back to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
