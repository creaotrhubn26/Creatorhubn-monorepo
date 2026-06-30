/**
 * Global fetch-shim for Post Agent (Tauri).
 *
 * Deployed backend sender ingen Access-Control-Allow-Origin for `tauri://localhost`,
 * så ALLE browser-`fetch()` mot backend (creatorhubn.com / theroleroom.com under
 * `/api/`) CORS-blokkeres i WKWebView. Denne shimen fanger nettopp de kallene og
 * ruter dem gjennom Rust (`authed_request` via reqwest), som ikke er underlagt CORS.
 *
 * Alt annet (lokale assets, vite-HMR, andre hoster) går uendret til ekte fetch.
 * Returnerer en ekte Response så kallernes `.ok` / `.status` / `.json()` / `.text()`
 * fungerer som før — ingen call-sites trenger endring.
 */
import { invoke } from "@tauri-apps/api/core";

const BACKEND_HOSTS = new Set([
  "creatorhubn.com",
  "www.creatorhubn.com",
  "theroleroom.com",
  "www.theroleroom.com",
]);

// Statuskoder som IKKE kan ha body i en Response (ellers kaster konstruktøren).
const NO_BODY_STATUS = new Set([101, 204, 205, 304]);

export function installBackendFetchShim(): void {
  const w = window as unknown as { __paFetchShim?: boolean };
  if (w.__paFetchShim) return;
  w.__paFetchShim = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let rawUrl: string;
    try {
      rawUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    } catch {
      return origFetch(input as RequestInfo, init);
    }

    let u: URL;
    try {
      u = new URL(rawUrl, location.href);
    } catch {
      return origFetch(input as RequestInfo, init);
    }

    const isBackend = BACKEND_HOSTS.has(u.hostname) && u.pathname.startsWith("/api/");
    if (!isBackend) return origFetch(input as RequestInfo, init);

    const reqObj = typeof input !== "string" && !(input instanceof URL) ? (input as Request) : null;
    const method = (init?.method || reqObj?.method || "GET").toUpperCase();

    const headers: Record<string, string> = {};
    try {
      const h = new Headers(init?.headers || reqObj?.headers || undefined);
      h.forEach((v, k) => {
        headers[k] = v;
      });
    } catch {
      /* ignore */
    }

    let body: string | null = null;
    try {
      if (init?.body != null) {
        body = typeof init.body === "string" ? init.body : JSON.stringify(init.body);
      } else if (reqObj && method !== "GET" && method !== "HEAD") {
        const t = await reqObj.clone().text();
        body = t || null;
      }
    } catch {
      /* ignore — best effort */
    }

    try {
      const res = await invoke<{ status: number; body: string }>("authed_request", {
        method,
        url: u.href,
        headers,
        body,
      });
      const status = res.status || 502;
      const payload = NO_BODY_STATUS.has(status) ? null : (res.body ?? "");
      return new Response(payload, {
        status,
        headers: { "content-type": "application/json" },
      });
    } catch (e) {
      console.warn("[backend-shim] authed_request feilet, faller tilbake til fetch:", e);
      return origFetch(input as RequestInfo, init);
    }
  };
}
