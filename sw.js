// Service Worker for FusionHub PWA
const CACHE_NAME = 'fusionhub-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json'
];

// Install: Cache core app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Hybrid Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Navigation Requests (HTML): Network First -> Fallback to Cache -> Fallback to /index.html
  // This fixes the 404 on PWA start if the specific path isn't cached
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then((cachedRes) => {
              if (cachedRes) return cachedRes;
              // If not in cache and network failed, serve index.html (SPA support)
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // 2. Ignore API/Firebase calls (Network Only)
  if (url.hostname.includes('firestore.googleapis.com') || url.hostname.includes('firebasestorage.googleapis.com') || url.hostname.includes('googleapis.com')) {
    return;
  }

  // 3. Static Assets (Images, JS, CSS): Stale-While-Revalidate
  // Serve from cache immediately, then update cache in background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Update cache with new version
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
      // Return cached response if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});