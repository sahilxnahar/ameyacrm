/* Ameya Heights CRM — service worker (offline shell + push). */
const VERSION = 'ameya-crm-v114';
const CORE = [
  '/', '/offline.html', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/brand/mark-gold-dark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/auth — always go to network.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first, fall back to cached offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/offline.html'))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname.startsWith('/brand')) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((res) => { cache.put(request, res.clone()); return res; }).catch(() => cached);
        return cached || network;
      }),
    );
  }
});

// Web Push
self.addEventListener('push', (event) => {
  let data = { title: 'Ameya Heights CRM', body: 'You have a new notification.', url: '/dashboard' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: { url: data.url },
      vibrate: [80, 40, 80],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clis) => {
      for (const c of clis) if ('focus' in c) { c.navigate(target); return c.focus(); }
      return self.clients.openWindow(target);
    }),
  );
});
