/**
 * lead-map-apns-client.ts
 *
 * Ekte APNs-levering med ES256-signert JWT + HTTP/2 POST til
 * api.push.apple.com (eller sandbox).
 *
 * Env-vars som trengs:
 *   APNS_KEY        — innholdet av .p8-filen (PEM ECDSA P-256)
 *   APNS_KEY_ID     — 10-tegns Key ID fra Apple Developer
 *   APNS_TEAM_ID    — 10-tegns Apple Team ID
 *   APNS_BUNDLE_ID  — bundle-id (apns-topic), f.eks. com.creatorhubn.LeadMapApp
 *   APNS_MODE       — 'live' for å aktivere; 'stub' returnerer ikke_konfigurert
 *   APNS_USE_SANDBOX — '1' for sandbox-endpoint (dev-builds), default prod
 *
 * APNs spec krever HTTP/2, ikke HTTP/1.1.
 */

import { createSign, randomBytes } from "node:crypto";
import {
  connect as http2Connect,
  constants as http2Constants,
  type ClientHttp2Session,
} from "node:http2";

interface CachedJwt {
  token: string;
  expiresAtMs: number;
}

let cachedJwt: CachedJwt | null = null;
let cachedSession: ClientHttp2Session | null = null;
let cachedSessionEndpoint: string | null = null;

/** ES256-signert JWT for APNs. Cache 50 min (APNs tillater opptil 60). */
function getJwt(): string | null {
  const key = process.env.APNS_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) return null;
  const now = Date.now();
  if (cachedJwt && cachedJwt.expiresAtMs > now + 30_000) {
    return cachedJwt.token;
  }
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  // Apple krever IEEE P1363 (64-byte raw r||s), ikke DER. createSign gir
  // DER som default — konverter.
  const der = signer.sign(key);
  const signature = derToJose(der);
  const jwt = `${signingInput}.${signature.toString("base64url")}`;
  cachedJwt = { token: jwt, expiresAtMs: now + 50 * 60 * 1000 };
  return jwt;
}

/** Konverter DER-encoded ECDSA-signatur til IEEE P1363 (r||s, 64 bytes). */
function derToJose(der: Buffer): Buffer {
  // DER struktur: 30 LEN 02 RLEN R 02 SLEN S
  let offset = 2;
  if (der[1] & 0x80) {
    offset = 2 + (der[1] & 0x7f);
  }
  if (der[offset] !== 0x02) {
    throw new Error("Invalid DER signature");
  }
  const rLen = der[offset + 1];
  let rStart = offset + 2;
  let rBytes = der.subarray(rStart, rStart + rLen);
  // Stripp leading 0x00 hvis present (DER-padding for positive integers)
  if (rBytes[0] === 0x00 && rBytes.length > 32) rBytes = rBytes.subarray(1);

  offset = rStart + rLen;
  if (der[offset] !== 0x02) {
    throw new Error("Invalid DER signature (s)");
  }
  const sLen = der[offset + 1];
  let sStart = offset + 2;
  let sBytes = der.subarray(sStart, sStart + sLen);
  if (sBytes[0] === 0x00 && sBytes.length > 32) sBytes = sBytes.subarray(1);

  // Pad til 32 bytes hver
  const r = Buffer.concat([Buffer.alloc(32 - rBytes.length), rBytes]);
  const s = Buffer.concat([Buffer.alloc(32 - sBytes.length), sBytes]);
  return Buffer.concat([r, s]);
}

function getEndpoint(): string {
  return process.env.APNS_USE_SANDBOX === "1"
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
}

/** Hent (eller gjenbruk) HTTP/2-session. */
function getSession(): ClientHttp2Session {
  const endpoint = getEndpoint();
  if (cachedSession && !cachedSession.closed && cachedSessionEndpoint === endpoint) {
    return cachedSession;
  }
  if (cachedSession) {
    try { cachedSession.close(); } catch { /* noop */ }
  }
  const session = http2Connect(endpoint);
  session.on("error", (err) => {
    console.error("[APNs] HTTP/2 session error:", err.message);
  });
  session.on("close", () => {
    if (cachedSession === session) cachedSession = null;
  });
  cachedSession = session;
  cachedSessionEndpoint = endpoint;
  return session;
}

export interface APNsResult {
  sent: boolean;
  reason?: string;
  apnsStatus?: number;
  apnsReason?: string;
  shouldDisableToken?: boolean;
}

/**
 * Send push-varsel til en device-token. Returnerer detaljert resultat.
 * Hvis Apple svarer 410 Gone eller "BadDeviceToken" → kalleren bør
 * disable token i db.
 */
export async function sendAPNs(
  deviceToken: string,
  title: string,
  body: string,
  options: { badge?: number; sound?: string; customData?: Record<string, unknown> } = {},
): Promise<APNsResult> {
  if (process.env.APNS_MODE !== "live") {
    return { sent: false, reason: "apns_mode_not_live" };
  }
  const jwt = getJwt();
  if (!jwt) {
    return { sent: false, reason: "apns_not_configured" };
  }
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) {
    return { sent: false, reason: "apns_bundle_id_missing" };
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: options.sound ?? "default",
      ...(typeof options.badge === "number" ? { badge: options.badge } : {}),
    },
    ...(options.customData ?? {}),
  });

  return new Promise<APNsResult>((resolve) => {
    // Settle-guard: APNs HTTP/2 stream har ingen default-timeout. Hvis
    // serveren henger uten å sende :status/end/error, ble løftet aldri
    // resolvet → fire-and-forget setImmediate-trigger fra
    // dispatchNotification kunne kjøre til server-lukking. Gjør én
    // resolve gjennom done() + 10s stream-cutoff.
    let settled = false;
    const done = (r: APNsResult): void => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    let session: ClientHttp2Session;
    try {
      session = getSession();
    } catch (err) {
      return done({ sent: false, reason: `session_failed: ${String(err)}` });
    }

    const req = session.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      "authorization": `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload).toString(),
    });

    let status = 0;
    const chunks: Buffer[] = [];

    // 10s stream-timeout. NGHTTP2_CANCEL sender RST_STREAM så Apple
    // ikke holder server-side state for en død klient.
    req.setTimeout(10_000, () => {
      try { req.close(http2Constants.NGHTTP2_CANCEL); } catch { /* noop */ }
      done({ sent: false, reason: "apns_timeout" });
    });

    req.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try { req.close(); } catch { /* allerede lukket av timeout */ }
      if (status === 200) {
        return done({ sent: true, apnsStatus: status });
      }
      const bodyText = Buffer.concat(chunks).toString("utf8");
      let apnsReason: string | undefined;
      try {
        const parsed = JSON.parse(bodyText) as { reason?: string };
        apnsReason = parsed.reason;
      } catch { /* ignore */ }
      const shouldDisable =
        status === 410 ||
        apnsReason === "BadDeviceToken" ||
        apnsReason === "Unregistered";
      done({
        sent: false,
        reason: `apns_${status}`,
        apnsStatus: status,
        apnsReason,
        shouldDisableToken: shouldDisable,
      });
    });
    req.on("error", (err) => {
      done({ sent: false, reason: `http2_error: ${err.message}` });
    });

    req.setEncoding("utf8");
    req.write(payload);
    req.end();
  });
}

/** Helper for ID-generering (unused — APNs genererer apns-id) */
export function newApnsId(): string {
  return randomBytes(16).toString("hex");
}
