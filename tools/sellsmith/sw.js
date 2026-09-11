// SellSmith service worker — network-first, cache is an offline-only fallback for the shell.
// Why network-first (not cache-first): online users always get the freshest shell, a new
// deploy's worker takes over on the very next load, and a stale cache can never "stick".
// Cross-origin requests (Google Fonts, and the local Ollama API at :11434) are never cached —
// AI status/output must always reflect a real live check, never a stale cached response.
const CACHE = 'sellsmith-shell-v1';
const SHELL = ['./', './index.html', './copy-generator.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts, Ollama — pass straight through, never cached

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
