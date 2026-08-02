/**
 * ssrf-guard.ts
 *
 * Shared SSRF protection for endpoints that fetch a user-supplied URL
 * (website analyzer, lead scout, webhook destinations, …).
 *
 * The previous per-file `assertNotSsrf` only string-matched the URL
 * hostname against a few literal private ranges. That misses:
 *   - hostnames that RESOLVE to a private IP (attacker-controlled DNS /
 *     DNS-rebinding) — the string check sees "evil.example.com" and passes,
 *     but the socket connects to 169.254.169.254;
 *   - HTTP redirects to an internal target (guard ran only on the first URL);
 *   - decimal / hex / octal IP encodings (http://2130706433/ = 127.0.0.1),
 *     which the OS resolver expands but a regex does not;
 *   - IPv6 ULA (fc00::/7), link-local (fe80::/10), IPv4-mapped (::ffff:…).
 *
 * The robust fix is to check the *resolved* address at DNS-lookup time.
 * `ssrfSafeLookup` plugs into an http/https Agent's `lookup` option, so it
 * runs for every connection INCLUDING redirect hops, and the address it
 * validates is the exact one the socket will connect to (no TOCTOU window).
 */

import dns from "node:dns";
import net from "node:net";
import http from "node:http";
import https from "node:https";

/** True if `ip` (a numeric IPv4 or IPv6 literal) is private/loopback/link-local/etc. */
export function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  // Not a recognised literal — treat as unsafe (caller should have resolved first).
  return true;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved + 255.255.255.255
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-compatible — validate the embedded v4.
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const firstHextet = addr.split(":")[0];
  const hv = parseInt(firstHextet || "0", 16);
  if (!Number.isNaN(hv)) {
    if ((hv & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((hv & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((hv & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  }
  return false;
}

/**
 * Drop-in `lookup` for http/https Agents. Resolves the hostname and refuses to
 * hand back a private address, so the socket can never connect to an internal
 * host — even across redirects or via attacker-controlled DNS.
 */
export const ssrfSafeLookup: typeof dns.lookup = ((
  hostname: string,
  options: any,
  callback: any,
) => {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? {} : options || {};
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses: any) => {
    if (err) return cb(err);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    for (const a of list) {
      if (isPrivateAddress(a.address)) {
        return cb(new Error("SSRF: resolved to a private address"));
      }
    }
    const first = list[0];
    // Honour the caller's `all` expectation.
    if (opts && opts.all) return cb(null, list);
    return cb(null, first.address, first.family);
  });
}) as unknown as typeof dns.lookup;

/** Agents that enforce `ssrfSafeLookup` on every connection (incl. redirect hops). */
export const ssrfSafeHttpAgent = new http.Agent({ lookup: ssrfSafeLookup });
export const ssrfSafeHttpsAgent = new https.Agent({ lookup: ssrfSafeLookup });

/**
 * Cheap synchronous pre-check: reject non-http(s) schemes and literal private
 * IPs before we even open a socket. NOT sufficient on its own for hostnames —
 * pair with the guarded agents (or `assertPublicUrlResolved`) for DNS coverage.
 */
export function assertPublicUrl(rawUrl: string): URL {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Ugyldig URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("SSRF: kun http/https er tillatt");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".internal") || host.endsWith(".local") ||
      host === "metadata.google.internal") {
    throw new Error("SSRF: intern adresse ikke tillatt");
  }
  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new Error("SSRF: intern adresse ikke tillatt");
  }
  return u;
}

/**
 * Full async guard for fetch()-based callers that can't inject an agent lookup:
 * do the literal pre-check, then resolve DNS and reject any private address.
 * (A determined attacker could still rebind between this check and the socket
 * connect; where possible prefer the guarded agents above.)
 */
export async function assertPublicUrlResolved(rawUrl: string): Promise<URL> {
  const u = assertPublicUrl(rawUrl);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return u; // already validated as a public literal
  const addresses = await dns.promises.lookup(host, { all: true });
  for (const a of addresses) {
    if (isPrivateAddress(a.address)) {
      throw new Error("SSRF: intern adresse ikke tillatt");
    }
  }
  return u;
}

/**
 * SSRF-safe replacement for `fetch()` for callers that follow redirects.
 * Validates the resolved address of every hop (initial URL + each redirect
 * target) before connecting, so a public host cannot bounce the request to an
 * internal one. Use instead of `fetch(url, { redirect: "follow" })`.
 */
export async function ssrfSafeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrlResolved(current);
    const resp = await fetch(current, { ...init, redirect: "manual" });
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (loc) {
        current = new URL(loc, current).toString();
        continue;
      }
    }
    return resp;
  }
  throw new Error("SSRF: for mange redirects");
}
