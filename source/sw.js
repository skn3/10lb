const CACHE = 'tenlb-cache-v4';
const ASSETS = ['./', './index.html'];
self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(ASSETS)),
    self.skipWaiting()
  ]));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);
  const isSameOrigin = reqUrl.origin === self.location.origin;
  if (!isSameOrigin) return;
  if (reqUrl.pathname.startsWith('/__/')) return;
  if (reqUrl.pathname.startsWith('/api/')) return;

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isStaticAsset = /\.(?:js|css|html|woff2?|png|jpg|jpeg|svg|webp|ico|json)$/i.test(reqUrl.pathname);
  if (!isNavigation && !isStaticAsset) return;

  if (isNavigation) {
    event.respondWith(fetch(req).catch(async () => {
      const fallback = await caches.match('./index.html');
      return fallback || new Response('Offline', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }));
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (!res || !res.ok || res.type === 'opaque') return res;
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
    return res;
  })));
});
