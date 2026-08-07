const CACHE_VERSION='triple20-shell-20260807-4';
const DATA_CACHE='triple20-data-20260807-4';
const APP_SHELL=[
  './','./index.html','./styles.css','./app.js','./pwa.js','./manifest.webmanifest','./shop-products.json',
  './icons/triple20-icon-192.png','./icons/triple20-icon-512.png','./icons/apple-touch-icon.png','./icons/triple20-icon.svg',
  './product-images/dartboard_aspar.jpg','./product-images/kameraautodarts.jpg','./product-images/led-stripe-autodarts.jpg',
  './product-images/red-dragon-nitrotech-shafts-v2.jpg','./product-images/red-dragon-razor-edge.jpg',
  './product-images/target-diamond-points-silver.jpg','./product-images/target-k-flex-black.jpg'
];
const OPTIONAL_EXTERNAL=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_VERSION).then(async cache=>{
    // Eine einzelne fehlende oder vorübergehend nicht erreichbare Datei darf
    // die komplette PWA- und Push-Installation nicht mehr verhindern.
    await Promise.allSettled(APP_SHELL.map(async url=>{const request=new Request(url,{cache:'reload'}),response=await fetch(request);if(response.ok)await cache.put(request,response)}));
    await Promise.allSettled(OPTIONAL_EXTERNAL.map(async url=>{const request=new Request(url,{mode:'no-cors'}),response=await fetch(request);await cache.put(request,response)}));
  }).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('triple20-')&&![CACHE_VERSION,DATA_CACHE].includes(key)).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

async function networkFirst(request,fallback='./index.html'){
  const cache=await caches.open(DATA_CACHE);
  try{const response=await fetch(request);if(response?.ok)cache.put(request,response.clone());return response}
  catch{ return (await cache.match(request))||(await caches.match(fallback))||Response.error() }
}

async function staleWhileRevalidate(request){
  const cache=await caches.open(DATA_CACHE),cached=await caches.match(request);
  const update=fetch(request).then(response=>{if(response?.ok||response?.type==='opaque')cache.put(request,response.clone());return response}).catch(()=>null);
  return cached||await update||Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(request.mode==='navigate'){event.respondWith(networkFirst(request));return}
  if(url.origin===self.location.origin){
    if(url.pathname.endsWith('/shop-products.json')){event.respondWith(networkFirst(request,'./shop-products.json'));return}
    event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>cached||staleWhileRevalidate(request)));return;
  }
  if(url.hostname==='cdn.jsdelivr.net'){event.respondWith(staleWhileRevalidate(request))}
});

self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});

self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  const title=data.title||'Triple20',options={body:data.body||'Neue Nachricht vom Dartclub.',icon:'./icons/triple20-icon-192.png',badge:'./icons/triple20-icon-192.png',tag:data.tag||'triple20-message',renotify:true,data:{url:data.url||'./'},actions:[{action:'open',title:'In Triple20 öffnen'}]};
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{for(const client of windows){if('focus'in client){client.navigate(target);return client.focus()}}return clients.openWindow?clients.openWindow(target):undefined}));
});
