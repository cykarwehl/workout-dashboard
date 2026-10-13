const CACHE = 'workout-dashboard-v13';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/Overview.svg',
  './icons/streak.svg',
  './icons/Progress.svg',
  './icons/PRs.svg',
  './icons/Log.svg',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// Install: cache the app shell. cache: 'reload' skips the browser's HTTP cache —
// GitHub Pages sends max-age=600, so without it a new version could cache the old page.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for the page and Sheets API, cache-first for everything else
self.addEventListener('fetch', event => {
  // Log saves are POSTs to Apps Script — never intercept or cache them
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Always go to the network for Google Sheets data
  if (url.includes('sheets.googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        JSON.stringify({ error: 'offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Network-first for the page itself so a new deploy shows on the next open;
  // the cached copy is the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
