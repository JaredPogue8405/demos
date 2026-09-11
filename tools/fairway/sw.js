/* ============================================================
   FAIRWAY service worker — network-first, cache is an
   offline-only fallback for the app shell.

   Why this is safe to ship unattended:
   - Every same-origin GET hits the network first, so an online
     visitor always gets the freshest shell; `install` re-fetches
     the shell each new version; `skipWaiting` + `clients.claim`
     hand control to the newest worker on the next load;
     `activate` deletes stale caches. A stale shell can never
     "stick" — it is only served when the network is unreachable.
   - Live course data (Overpass API, Nominatim) and Google Fonts
     are CROSS-ORIGIN and are never touched by this worker —
     those requests pass straight through and are never cached,
     so the finder can never show stale course results. Offline,
     a live search fails to the app's existing error/empty state
     and saved courses + bookings (localStorage) still work.
   - Scope: this worker only controls /tools/fairway/ on the live
     site — sibling builds under /demos/ are separate surfaces.
   ============================================================ */
const CACHE = 'fairway-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // Overpass, Nominatim, fonts pass straight through — never cached
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
