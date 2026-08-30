// Shared allowlist for building user-facing links (invite / verification /
// checkout-return URLs) from a request.
//
// SECURITY: never build an emailed or redirected URL directly from
// `req.headers.origin` / `req.headers.host`. Both are attacker-controlled
// (Origin is a plain request header; Host can be spoofed unless the proxy
// pins it). An attacker who can trigger an invite/verification email to a
// victim could otherwise poison the link's host — the victim receives a
// legit-looking email from us whose link points at the attacker's domain
// and carries the real (valid) token → token theft / phishing.
//
// This mirrors the CORS allowlist in index.ts (KNOWN_ORIGINS). We echo the
// request Origin ONLY when it is a recognized first-party origin (so the
// multi-brand creatorhubn.com / theroleroom.com split is preserved), and
// otherwise fall back to the configured PUBLIC_APP_URL.

const KNOWN_WEB_ORIGINS = new Set<string>([
  "https://creatorhubn.com",
  "https://www.creatorhubn.com",
  "https://theroleroom.com",
  "https://www.theroleroom.com",
  "http://localhost:5001",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5001",
  "http://127.0.0.1:5173",
]);

// Bare production aliases only. Branch-, PR- and immutable deploy previews can
// contain unreviewed code and must never become trusted credentialed origins.
const NETLIFY_PRODUCTION_ORIGINS = new Set([
  "https://creatorhub-frontend-mig.netlify.app",
  "https://leadgrid-no.netlify.app",
  "https://theroleroom.netlify.app",
]);

export function isTrustedNetlifyProductionOrigin(origin: string): boolean {
  return NETLIFY_PRODUCTION_ORIGINS.has(origin);
}

function configuredAppBaseUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.APP_BASE_URL ||
    "https://creatorhubn.com"
  ).replace(/\/+$/, "");
}

function isTrustedOrigin(origin: string): boolean {
  return KNOWN_WEB_ORIGINS.has(origin) || isTrustedNetlifyProductionOrigin(origin);
}

/**
 * Safe base URL for building user-facing links from a request.
 * Echoes the request Origin only if it is a recognized first-party origin;
 * otherwise returns the configured PUBLIC_APP_URL. Never trusts the Host header.
 */
export function safeAppBaseUrl(req: {
  headers?: Record<string, unknown>;
}): string {
  const rawOrigin = req?.headers?.origin;
  const origin = typeof rawOrigin === "string" ? rawOrigin.trim() : "";
  if (origin && isTrustedOrigin(origin)) {
    return origin.replace(/\/+$/, "");
  }
  return configuredAppBaseUrl();
}

/**
 * Validate a caller-supplied relative return path before splicing it into a
 * redirect/return URL. Accepts only a single-slash-rooted path and rejects
 * scheme-relative (`//host`) and backslash (`/\host`, which browsers normalize
 * to `//host`) external-redirect bypasses. Returns `fallback` if invalid.
 */
export function safeReturnPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  // Must be root-relative, and the char after the leading slash must not be
  // another slash or a backslash (both can redirect to an external host).
  if (!/^\/(?![/\\])/.test(value)) return fallback;
  // Reject any control chars / CRLF that could break out of the URL context.
  if (/[\x00-\x1f\x7f]/.test(value)) return fallback;
  return value;
}
