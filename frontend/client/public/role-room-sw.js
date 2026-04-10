const ROLE_ROOM_CACHE = 'role-room-shell-v1';
const ROLE_ROOM_SHELL_URLS = ['/', '/theroleroom.webmanifest', '/TheRoleRoom_App_Logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ROLE_ROOM_CACHE).then((cache) => cache.addAll(ROLE_ROOM_SHELL_URLS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== ROLE_ROOM_CACHE)
        .map((key) => caches.delete(key)),
    )).finally(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(ROLE_ROOM_CACHE);
        return cache.match('/') || Response.error();
      }),
    );
    return;
  }

  const isStaticAsset = (
    requestUrl.pathname.startsWith('/assets/')
    || requestUrl.pathname.startsWith('/js/')
    || requestUrl.pathname.startsWith('/role-room-assets/')
    || /\.(?:css|js|png|svg|webp|woff2?)$/i.test(requestUrl.pathname)
  );

  if (!isStaticAsset) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(ROLE_ROOM_CACHE);
    const cachedResponse = await cache.match(request);

    const networkResponsePromise = fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone()).catch(() => undefined);
        }
        return networkResponse;
      })
      .catch(() => cachedResponse || Response.error());

    return cachedResponse || networkResponsePromise;
  })());
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = {};
  }

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'The Role Room';
  const message = typeof payload.message === 'string' ? payload.message : '';
  const url = typeof payload.url === 'string' && payload.url.trim() ? payload.url.trim() : '/';
  const tag = typeof payload.tag === 'string' && payload.tag.trim() ? payload.tag.trim() : undefined;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: message,
      icon: '/TheRoleRoom_App_Logo.png',
      badge: '/TheRoleRoom_App_Logo.png',
      tag,
      data: {
        url,
        projectId: typeof payload.projectId === 'string' ? payload.projectId : null,
      },
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destination = (() => {
    const candidate = typeof event.notification?.data?.url === 'string'
      ? event.notification.data.url
      : '/';
    try {
      return new URL(candidate, self.location.origin).toString();
    } catch (_error) {
      return self.location.origin;
    }
  })();

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try {
            await client.navigate(destination);
          } catch (_error) {
            // Ignore navigation failures and keep the focused client.
          }
        }
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(destination);
    }
  })());
});
