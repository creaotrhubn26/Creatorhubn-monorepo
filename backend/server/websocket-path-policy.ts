/**
 * Canonical ownership policy for HTTP WebSocket upgrades.
 *
 * Node emits an `upgrade` event to every registered listener. Therefore a
 * catch-all listener must not infer ownership solely from `/ws/*`: doing so
 * lets it consume a socket before a dedicated listener (Leadgrid, Canvas or
 * Dance) sees the same request. Keeping the precedence in this dependency-free
 * module makes ownership deterministic regardless of listener registration
 * order.
 */

export const WEBSOCKET_PATHS = Object.freeze({
  chat: "/ws",
  danceRealtime: "/ws/dance/realtime",
  leadgridCanvas: "/ws/leadgrid-canvas",
  leadgridRealtime: "/ws/leadgrid",
  userEvents: "/api/ipad/ws/events",
});

export type WebSocketPathOwner =
  | "capture"
  | "chat"
  | "dance"
  | "leadgrid-canvas"
  | "leadgrid-realtime"
  | "user-events";

const CAPTURE_SESSION_PATH = /^\/api\/capture\/ws\/sessions\/([0-9a-f-]{36})$/;
const WEBSOCKET_REQUEST_BASE = "http://websocket.invalid";

/**
 * Parse only the HTTP request-target. The Host header is deliberately not
 * interpolated into the URL base: it is untrusted input and malformed values
 * such as `[` must never throw from one of Node's upgrade listeners.
 */
export function parseWebSocketRequestUrl(
  requestTarget: string | null | undefined,
): URL | null {
  try {
    return new URL(requestTarget || "/", WEBSOCKET_REQUEST_BASE);
  } catch {
    return null;
  }
}
export function matchCaptureWebSocketSessionPath(
  pathname: string,
): RegExpMatchArray | null {
  return pathname.match(CAPTURE_SESSION_PATH);
}

export function resolveWebSocketPathOwner(
  pathname: string,
): WebSocketPathOwner | null {
  // Dedicated `/ws/*` handlers must win before the generic chat namespace.
  if (pathname === WEBSOCKET_PATHS.danceRealtime) return "dance";
  if (pathname === WEBSOCKET_PATHS.leadgridCanvas) return "leadgrid-canvas";
  if (pathname === WEBSOCKET_PATHS.leadgridRealtime) {
    return "leadgrid-realtime";
  }

  if (pathname === WEBSOCKET_PATHS.userEvents) return "user-events";
  if (matchCaptureWebSocketSessionPath(pathname)) return "capture";

  // Existing chat protocols intentionally share the `/ws` namespace
  // (`/ws/communication`, `/ws/events`, `/ws/protools/*`, etc.).
  if (
    pathname === WEBSOCKET_PATHS.chat ||
    pathname.startsWith(`${WEBSOCKET_PATHS.chat}/`)
  ) {
    return "chat";
  }

  return null;
}
