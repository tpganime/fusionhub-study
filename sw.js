// Service Worker for FusionHub PWA
const CACHE_NAME = 'fusionhub-v2';
const urlsToCache = [
  './',
  './index.html',
  './logo.svg',
  './manifest.json'
];

// Install Event: Cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Event: Clean up old caches
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

// Fetch Event: Network First for API/Dynamic, Cache First for Static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For Supabase or API calls, use Network only (or handle differently)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to cache it
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Don't cache hot updates or very dynamic things if possible, 
                // but for simple apps, caching everything visited is a simple strategy.
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});