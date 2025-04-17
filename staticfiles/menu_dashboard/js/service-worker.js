const CACHE_NAME = 'menu-image-cache-v1';
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Install event - precache essential resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/static/images/placeholder.webp',
        // Add other critical assets here
      ]);
    })
  );
});

// Fetch event - cache images with a network-first strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Only cache image requests
  if (event.request.method === 'GET' && 
      (url.pathname.endsWith('.jpg') || url.pathname.endsWith('.jpeg') || 
       url.pathname.endsWith('.png') || url.pathname.endsWith('.webp') || 
       url.pathname.includes('media') || url.pathname.includes('thumbnail'))) {
    
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request)
          .then(networkResponse => {
            // Clone the response before using it
            const clonedResponse = networkResponse.clone();
            
            // Put the clone in the cache
            cache.put(event.request, clonedResponse);
            
            // Return the original response
            return networkResponse;
          })
          .catch(() => {
            // If network fails, try to return from cache
            return cache.match(event.request);
          });
      })
    );
  }
});

// Activate event - clean up old caches and expired images
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
    }).then(() => {
      // Clean up old images
      return caches.open(CACHE_NAME).then(cache => {
        return cache.keys().then(requests => {
          return Promise.all(
            requests.map(request => {
              return cache.match(request).then(response => {
                // Check if cached response is older than our cache duration
                if (response) {
                  const cachedTime = new Date(response.headers.get('date')).getTime();
                  const now = new Date().getTime();
                  
                  if ((now - cachedTime) > IMAGE_CACHE_DURATION) {
                    return cache.delete(request);
                  }
                }
              });
            })
          );
        });
      });
    }).then(() => {
      // Tell the browser to activate this service worker immediately
      return self.clients.claim();
    })
  );
});

// Register the service worker from your template
// Add this script to your base template:
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/js/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}