const CACHE_VERSION = 'archive-yemany-shell-v4';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.ico',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API calls, auth endpoints, or sensitive document payloads.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // App shell HTML navigations: network-first with cached shell fallback so the
  // installed PWA launches cleanly offline or when the backend server is down.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(request)) || (await caches.match('/'));
          if (cached) return cached;
          return new Response(
            '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archive YemanY</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F1F5F9;color:#0F2137;font-family:"Tajawal","Segoe UI",Tahoma,sans-serif;padding:24px;text-align:center}.box{max-width:460px;background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:32px;box-shadow:0 16px 40px rgba(15,23,42,.08)}h1{margin:0 0 12px;font-size:20px}p{margin:0 0 20px;color:#475569;line-height:1.8;font-size:14px}button{border:0;border-radius:12px;padding:12px 24px;background:#0E7490;color:#fff;font-weight:700;cursor:pointer;font-family:inherit}</style></head><body><div class="box"><h1>لا يوجد اتصال بالإنترنت</h1><p>يبدو أن الإنترنت منقطع لديك حالياً أو تعذّر الوصول إلى سيرفر الأرشفة. يرجى التحقق من اتصالك ثم المحاولة مجدداً.</p><button onclick="location.reload()">إعادة المحاولة</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Static Next.js chunks, CSS, JS, fonts, icons: stale-while-revalidate / cache-first.
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
