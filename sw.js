const CACHE='easyfin-v7';
const ASSETS=['./','./index.html','./manifest.json','./css/style.css','./js/db.js','./js/categorize.js','./js/utils.js','./js/app.js','./js/inbox.js','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('easyfin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin||new URL(e.request.url).pathname.startsWith('/api/'))return;
  e.respondWith(fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return res;}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())));
});
self.addEventListener('push',e=>{let data={};try{data=e.data.json();}catch{}e.waitUntil(self.registration.showNotification(data.title||'EasyFin',{body:data.body||'Subscription reminder',icon:'icons/icon-192.png',data:{url:'./?view=subs'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('./?view=subs'));});
