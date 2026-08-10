const CACHE = 'tenlb-cache-v1';
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
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(event.request, copy));
    return res;
  }).catch(() => caches.match('./index.html'))));
});
