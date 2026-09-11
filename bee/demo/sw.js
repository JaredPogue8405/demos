/* ============================================================
   BEE demo service worker — network-first, cache is an
   offline-only fallback for the app shell.

   Why this is safe to ship unattended:
   - Every same-origin GET hits the network first, so an online
     visitor always gets the freshest shell; `activate` deletes
     stale caches; `skipWaiting` + `clients.claim` hand control
     to the newest worker on the next load. A stale shell can
     never "stick" — it is only served when the network is down.
   - Google Fonts (Chakra Petch / JetBrains Mono) are CROSS-ORIGIN
     — this worker never touches them; they pass straight through
     and are never cached. Offline the surfaces fall back to the
     Segoe / system font stack (the CSS already declares it).
   - The Ollama backend is a DIFFERENT ORIGIN (localhost:11434),
     so it is never touched either. Offline: the chat demo (index)
     runs its simulated responses; super/squad's live runs and
     ops' surface pings degrade to their existing error states.
   - Scope: only controls /bee/demo/ on the live site — all four
     surfaces (index, super, squad, ops) + the shared shell.js.
   ============================================================ */
const CACHE = 'bee-demo-v1';
const SHELL = [
  './index.html', './super.html', './squad.html', './ops.html', './shell.js',
  './manifest.webmanifest',
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
  if (new URL(req.url).origin !== self.location.origin) return; // fonts + Ollama pass straight through — never cached
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
