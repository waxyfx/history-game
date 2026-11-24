// Offline fallback for Tarikh Joly (audit №14: «/sw.js → 404, офлайн жұмыс жоқ»).
// Network first: a new deploy is used at once. When the network is gone, the last copy of a page, script, picture or
// engine file that this browser has already loaded is served instead. Only this site's own GET requests are touched —
// never Supabase (sign-in, answers, results) and never Netlify's own scripts.
const CACHE = 'tarikh-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/') || req.headers.has('range')) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, {ignoreSearch: req.mode === 'navigate'});
      if (hit) return hit;
      throw err;
    }
  })());
});
