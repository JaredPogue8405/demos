/* ============================================================
   SNORK service worker — network-first, cache is an
   offline-only fallback for the app shell.

   Why this is safe to ship unattended:
   - Every same-origin GET hits the network first, so an online
     player always gets the freshest build; `activate` deletes
     stale caches; `skipWaiting` + `clients.claim` hand control
     to the newest worker on the next load. A stale shell can
     never "stick" — it is only served when the network is down.
   - Google Fonts (Baloo 2) are CROSS-ORIGIN — this worker never
     touches them; they pass straight through and are never
     cached. Offline the game falls back to the system font stack.
   - No backend: the whole game runs client-side; the best score
     and difficulty choice live in localStorage. Offline the
     game is fully playable, not degraded.
   - Scope: only controls /games/snork/ on the live site.
   ============================================================ */
const CACHE = 'snork-v1';
const SHELL = [
  './index.html', './manifest.webmanifest',
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
  if (new URL(req.url).origin !== self.location.origin) return; // fonts pass straight through — never cached
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
