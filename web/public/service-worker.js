const CACHE_NAME = 'social-square-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.jpg',
  '/offline.html'
];

// Install a service worker and pre-cache main shell files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Pre-caching shell assets...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Network-First strategy for dynamic caching of HTML/JS/CSS assets
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API requests (should be handled by network first, failing to offline.html if completely unavailable)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the updated static resource if successful
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is offline
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          // Fallback to index.html for SPA client-side routing on navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

// Update a service worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// ─── Web Push: show notification when received ────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Social Square', body: event.data.text() };
  }

  const { title = 'Social Square', body = '', icon = '/logo.jpg', badge = '/logo.jpg', tag, data = {} } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag || 'social-square',
      renotify: true,        // Always vibrate/sound even for same tag
      requireInteraction: false,
      data,
    })
  );
});

// ─── Web Push: handle notification click ─────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data || {};
  const { type, postId, url } = data;

  let targetUrl = '/';
  if (url && url !== '/') {
    targetUrl = url;
  } else if (type === 'message') {
    targetUrl = '/chat';
  } else if ((type === 'like' || type === 'comment' || type === 'mention') && postId) {
    targetUrl = `/post/${postId}`;
  } else if (type === 'follow' || type === 'follow_request') {
    targetUrl = '/notifications';
  } else {
    targetUrl = '/notifications';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If app is already open, focus it and navigate
      const appClient = windowClients.find(c => c.url.includes(self.location.origin));
      if (appClient) {
        appClient.focus();
        appClient.navigate(targetUrl);
        return;
      }
      // Otherwise open a new tab
      return clients.openWindow(targetUrl);
    })
  );
});

