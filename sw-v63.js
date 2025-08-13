// SW v6.3 DEBUG (new filename & cache key to break old control)
const CACHE='ants-v6.3-DEBUG';
const ASSETS=['./','./index.html','./manifest.json','./assets/ant.png','./assets/cake.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
