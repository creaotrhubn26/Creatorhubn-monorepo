/**
 * Bygger en WebSocket-URL for backend-event-strømmer (/ws/events m.fl.).
 *
 * Hvorfor dette ikke kan være `window.location.host`:
 * Frontend hostes på Vercel (creatorhubn.com) som IKKE proxy-er WebSocket
 * videre til Render-backenden. Bruker vi `window.location.host` i produksjon
 * kobler vi mot Vercel — som ikke har noen WS-server — og får uendelig
 * «WebSocket connection to 'wss://creatorhubn.com/ws/events' failed»-spam
 * i konsollen via reconnect-loopene.
 *
 * Logikken speiler useGalleryEventStream.buildWsUrl:
 *   - VITE_WS_URL hvis satt (forventes å allerede være ws(s)://…)
 *   - ellers VITE_API_PROXY_TARGET (http(s) → ws(s))
 *   - ellers window.location.host i dev/localhost
 *   - prod uten eksplisitt WS-URL → null (ikke koble, ikke spam)
 *
 * Returnerer null når vi ikke har en trygg host å koble mot. Callere SKAL
 * da la være å opprette socketen (og dermed ikke planlegge reconnect).
 */
export function buildEventsWsUrl(path = '/ws/events'): string | null {
  if (typeof window === 'undefined') return null;

  const configured =
    typeof import.meta.env.VITE_WS_URL === 'string'
      ? (import.meta.env.VITE_WS_URL as string).trim()
      : '';
  const apiTarget =
    typeof import.meta.env.VITE_API_PROXY_TARGET === 'string'
      ? (import.meta.env.VITE_API_PROXY_TARGET as string).trim()
      : '';
  const isProd =
    !import.meta.env.DEV &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname);

  // Prod uten eksplisitt WS-URL: ikke koble mot Vercel (som ikke proxy-er WS).
  if (isProd && !configured) return null;

  const base = (
    configured ||
    apiTarget ||
    `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.host}`
  ).replace(/^http/i, 'ws');

  try {
    const url = new URL(base);
    url.pathname = path;
    return url.toString();
  } catch {
    return null;
  }
}
