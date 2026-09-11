/* ============================================================
   SHOWROOM service worker — network-first, cache as fallback only.

   Why this is safe to ship unattended (no per-deploy version bump
   needed): every online request hits the network first, so fresh
   content always wins; `install` re-fetches the shell each new
   version; `skipWaiting` + `clients.claim` hand control to the
   newest worker on the next load; `activate` deletes stale caches.
   A stale cache therefore can never "stick" — it only ever serves
   when the network is unreachable. Offline: the shell renders from
   cache. Cross-origin requests (Google Fonts) are left untouched
   and simply fail to the page's fallback font stack when offline.
   z-scope: this worker only controls /showroom/ — sibling builds
   under /demos/ are separate surfaces and stay uncontrolled.
   ============================================================ */
const CACHE = 'showroom-v1';
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
  if (new URL(req.url).origin !== self.location.origin) return; // fonts etc. pass straight through
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
