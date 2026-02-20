/* ══════════════════════════════════════
   sw.js — Service Worker for Smart Life Planner
   Version: 1.0.0
══════════════════════════════════════ */

const CACHE_NAME = 'slp-cache-v1';

// Files to cache (static assets)
const STATIC_ASSETS = [
    '/Planner/',
    '/Planner/index.html',
    '/Planner/manifest.json',
    // Icons
    '/Planner/icons/icon-192x192.png',
    '/Planner/icons/icon-512x512.png',
    // JavaScript files
    '/Planner/js/indexeddb.js',
    '/Planner/js/indexeddb-integration.js',
    '/Planner/js/app.js',
    '/Planner/js/tasks.js',
    '/Planner/js/habits.js',
    '/Planner/js/finance.js',
    '/Planner/js/drag-drop.js',
    '/Planner/js/export-import.js',
    '/Planner/js/notifications.js',
    '/Planner/js/onboarding.js',
    '/Planner/js/reminders.js',
    '/Planner/js/analytics.js',
    // External resources (remain unchanged)
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap'
];

// Install event – cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting(); // activate immediately
});

// Activate event – clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim(); // take control immediately
});

// Fetch event – serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests (like API calls, if any)
    if (!event.request.url.startsWith(self.location.origin) &&
        !event.request.url.startsWith('https://fonts.googleapis.com') &&
        !event.request.url.startsWith('https://cdn.jsdelivr.net')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached response if found
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise fetch from network
            return fetch(event.request).then((networkResponse) => {
                // Optionally cache dynamic requests? For now, only static.
                return networkResponse;
            }).catch(() => {
                // If both cache and network fail, show offline fallback page
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
            });
        })
    );
});