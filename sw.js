self.addEventListener('install', e => {
  e.waitUntil(caches.open('cake-defense-v5').then(cache => cache.addAll(['./'])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
});