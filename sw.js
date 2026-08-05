const CACHE_VERSION='triple20-shell-20260805-3';
const DATA_CACHE='triple20-data-20260805-3';
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
    await cache.addAll(APP_SHELL);
    await Promise.allSettled(OPTIONAL_EXTERNAL.map(async url=>{const request=new Request(url,{mode:'no-cors'}),response=await fetch(request);await cache.put(request,response)}));
  }));
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
