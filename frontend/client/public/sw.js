/**
 * Service worker for Creatorhubn PWA (Slice 9X.29).
 *
 * Cache-strategier:
 *   - HTML shell (/): network-first med cache fallback
 *   - Vite-bygde assets (/assets/*.js, /assets/*.css): cache-first (immutable hashes)
 *   - Bilder fra /public: cache-first
 *   - GET /api/wedding/:id/live-status: network-first med 3s timeout → cache
 *   - GET /api/wedding/:id/timeline-events: network-first med 3s timeout → cache
 *   - Andre API-er: passes gjennom (network-only)
 *
 * Mutation-queue håndteres i frontend via IndexedDB (lib/offlineQueue.ts),
 * ikke i SW — gir bedre kontroll over retry-logikk.
 */

const SW_VERSION = 'v1';
const STATIC_CACHE = `creatorhubn-static-${SW_VERSION}`;
const API_CACHE = `creatorhubn-api-${SW_VERSION}`;
const APP_SHELL_URLS = [
  '/',
  '/dashboard',
  '/manifest.webmanifest',
  '/creatorhub-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Best-effort pre-cache — fail individual misses
    await Promise.all(APP_SHELL_URLS.map((url) =>
      cache.add(url).catch((err) => console.warn('[sw] precache miss:', url, err.message)),
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Slett gamle cache-versjoner
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('creatorhubn-') && k !== STATIC_CACHE && k !== API_CACHE)
      .map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

function isApiLiveStatusOrEvents(url) {
  return /\/api\/wedding\/[^/]+\/(live-status|timeline-events|vip-contacts)(\?.*)?$/.test(url);
}

function isStaticAsset(url) {
  return /\/assets\/[^/]+\.(js|css|woff2?|ttf|svg|png|jpg|jpeg|webp)$/.test(url)
    || /\.(png|jpg|jpeg|svg|webp|ico)$/.test(url);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bare same-origin håndteres aktivt
  if (url.origin !== self.location.origin) return;

  // Mutations (POST/PATCH/DELETE): pass gjennom uten cache
  if (request.method !== 'GET') return;

  // Static Vite-assets → cache-first (immutable)
  if (isStaticAsset(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // API live-data → network-first med 3s timeout, fallback cache
  if (isApiLiveStatusOrEvents(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      try {
        const networkPromise = fetch(request);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000),
        );
        const fresh = await Promise.race([networkPromise, timeoutPromise]);
        if (fresh.ok) {
          cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) {
          // Markér respons som offline-cached så frontend kan vise badge
          const headers = new Headers(cached.headers);
          headers.set('x-served-from', 'sw-cache');
          headers.set('x-cache-age-seconds', String(Math.floor(
            (Date.now() - new Date(cached.headers.get('date') || Date.now()).getTime()) / 1000,
          )));
          return new Response(await cached.blob(), {
            status: cached.status,
            statusText: cached.statusText,
            headers,
          });
        }
        return new Response(
          JSON.stringify({ error: 'offline', message: 'Ingen cache tilgjengelig' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }
    })());
    return;
  }

  // HTML-navigasjon → network-first, fallback til /index.html
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (err) {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Default: passes gjennom (network)
});

// Lytt etter "replay-queue"-melding fra frontend når den vil sync'e
// pending mutations etter at signal kom tilbake.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'replay-queue') {
    // Frontend håndterer selve replay-en — vi bekrefter bare mottak
    event.ports[0]?.postMessage({ ack: true });
  }
});

// Slice 9X.43 — Web Push (VAPID) handler. Server sender JSON-payload
// med { title, body, url?, tag? }. Tag gjør at samme event (f.eks. plan-B
// for ett bryllup) replacer eventuelle tidligere notifications istedenfor
// å stable opp.
self.addEventListener('push', (event) => {
  let data = { title: 'Creatorhubn', body: 'Ny aktivitet' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Plain-text fallback
    try { data.body = event.data?.text() || data.body; } catch { /* ignore */ }
  }
  const { title, body, url, tag } = data;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: tag || undefined,
      icon: '/creatorhub-icon.png',
      badge: '/creatorhub-icon.png',
      data: { url: url || '/' },
      requireInteraction: tag?.startsWith('plan-b-') || false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Hvis en åpen tab matcher origin, fokuser + naviger
    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(url);
          } else {
            client.postMessage({ type: 'navigate', url });
          }
          return;
        }
      } catch { /* ignore */ }
    }
    // Ingen åpen tab — åpne ny
    await self.clients.openWindow(url);
  })());
});
