/* ============================================================
   Allergy Scanner (demo) service worker — network-first,
   cache is an offline-only fallback for the app shell.

   Why this is safe for a safety-critical app:
   - Every same-origin request hits the network first, so a fresh
     shell always wins; `install` re-fetches the shell each new
     version; `skipWaiting` + `clients.claim` hand control to the
     newest worker on the next load; `activate` deletes stale
     caches. A stale shell can never "stick" — it is only served
     when the network is unreachable.
   - Live food/recall data (Open Food Facts, api.fda.gov) is
     CROSS-ORIGIN and is never touched by this worker — those
     requests pass straight through and are never cached, so the
     verdict engine can never score against stale product data.
     Offline, live lookups fail to the app's existing error message
     and the bundled sample products + "paste ingredients" path
     still work.
   - Google Fonts (cross-origin) also passes through and simply
     falls back to the system font stack when offline.
   - Scope: this worker only controls /allergy-app/demo/ on the
     live site — sibling builds under /demos/ are separate surfaces.
   ============================================================ */
const CACHE = 'allergy-demo-v1';
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
  if (new URL(req.url).origin !== self.location.origin) return; // APIs, fonts pass straight through — never cached
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
