/**
 * app-store-connect-client.ts
 *
 * Tynn klient mot Apple App Store Connect API.
 *
 * Auth: ES256-signert JWT som genereres lokalt fra Issuer + Key ID
 *       + .p8 private key (ASC_API_PRIVATE_KEY env eller fil-path).
 * JWT levetid: maks 20 minutter. Vi cacher i 18 minutter og re-genererer.
 *
 * Bruks-eksempel:
 *   const tester = await ascCreateBetaTester({
 *     email: 'ola@bedrift.no', firstName: 'Ola', lastName: 'Nordmann',
 *     appBundleId: 'com.creatorhubn.LeadMapApp',
 *   });
 *
 * Docs: https://developer.apple.com/documentation/appstoreconnectapi
 */

import crypto from "crypto";

const ASC_API_BASE = "https://api.appstoreconnect.apple.com/v1";
const ASC_ISSUER_ID = process.env.ASC_ISSUER_ID
  ?? process.env.APP_STORE_CONNECT_ISSUER_ID
  ?? "";
const ASC_KEY_ID = process.env.ASC_KEY_ID
  ?? process.env.APP_STORE_CONNECT_KEY_ID
  ?? "";
const ASC_PRIVATE_KEY_PATH = process.env.ASC_PRIVATE_KEY_PATH
  ?? "/etc/secrets/AuthKey_9YKHP6L25P.p8"; // Render secret-file path
const ASC_PRIVATE_KEY_INLINE = process.env.ASC_PRIVATE_KEY_PEM;

let cachedJwt: { token: string; expiresAt: number } | null = null;

async function readPrivateKey(): Promise<string> {
  if (ASC_PRIVATE_KEY_INLINE) return ASC_PRIVATE_KEY_INLINE;
  try {
    const fs = await import("fs");
    return fs.readFileSync(ASC_PRIVATE_KEY_PATH, "utf8");
  } catch (e) {
    throw new Error(`ASC private key ikke funnet: ${ASC_PRIVATE_KEY_PATH}`);
  }
}

async function getJwt(): Promise<string> {
  if (cachedJwt && cachedJwt.expiresAt > Date.now()) return cachedJwt.token;
  if (!ASC_ISSUER_ID || !ASC_KEY_ID) {
    throw new Error("ASC_ISSUER_ID og ASC_KEY_ID må settes i env");
  }
  const privateKey = await readPrivateKey();

  const header = {
    alg: "ES256",
    kid: ASC_KEY_ID,
    typ: "JWT",
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ASC_ISSUER_ID,
    iat: now,
    exp: now + 18 * 60,       // 18 min (max 20)
    aud: "appstoreconnect-v1",
  };

  const b64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerEnc = b64url(header);
  const payloadEnc = b64url(payload);
  const dataToSign = `${headerEnc}.${payloadEnc}`;

  const sign = crypto.createSign("SHA256");
  sign.update(dataToSign);
  sign.end();
  const signatureDer = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  const signatureEnc = signatureDer.toString("base64url");

  const token = `${dataToSign}.${signatureEnc}`;
  cachedJwt = { token, expiresAt: Date.now() + 17 * 60 * 1000 };
  return token;
}

async function ascFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getJwt();
  return fetch(`${ASC_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

// ---------------------------------------------------------------------------
// Types (delvis — vi henter kun det vi trenger)
// ---------------------------------------------------------------------------

export interface AscBetaTester {
  id: string;
  attributes: {
    email: string;
    firstName?: string;
    lastName?: string;
    inviteType?: "EMAIL" | "PUBLIC_LINK";
    state?: "INVITED" | "ACCEPTED" | "INSTALLED" | "REVOKED" | "EXPIRED";
    inviteDate?: string;
    lastModifiedDate?: string;
  };
}

export interface AscApp {
  id: string;
  attributes: {
    bundleId: string;
    name: string;
    sku: string;
  };
}

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------

/** Slå opp ASC app-ID basert på bundleId. */
export async function ascFindAppByBundleId(bundleId: string): Promise<AscApp | null> {
  const r = await ascFetch(`/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`);
  if (!r.ok) {
    console.error("[ASC find-app]", r.status, await r.text());
    return null;
  }
  const d = (await r.json()) as { data: AscApp[] };
  return d.data?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Beta testers
// ---------------------------------------------------------------------------

/**
 * Opprett en beta-tester i ASC. Krever appIds (eller betaGroupIds).
 * Sender automatisk invite-mail fra Apple.
 */
export async function ascCreateBetaTester(opts: {
  email: string;
  firstName?: string;
  lastName?: string;
  appBundleId?: string;
  appId?: string;
  betaGroupId?: string;
}): Promise<AscBetaTester | null> {
  let appId = opts.appId;
  if (!appId && opts.appBundleId) {
    const app = await ascFindAppByBundleId(opts.appBundleId);
    if (!app) throw new Error(`App ikke funnet i ASC: ${opts.appBundleId}`);
    appId = app.id;
  }
  if (!appId && !opts.betaGroupId) {
    throw new Error("appBundleId, appId eller betaGroupId må gis");
  }

  const relationships: any = {};
  if (appId) {
    relationships.apps = { data: [{ type: "apps", id: appId }] };
  }
  if (opts.betaGroupId) {
    relationships.betaGroups = { data: [{ type: "betaGroups", id: opts.betaGroupId }] };
  }

  const body = {
    data: {
      type: "betaTesters",
      attributes: {
        email: opts.email,
        firstName: opts.firstName ?? "",
        lastName: opts.lastName ?? "",
      },
      relationships,
    },
  };

  const r = await ascFetch("/betaTesters", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error("[ASC create-tester]", r.status, errText);
    // 409 hvis allerede finnes — vi henter ID
    if (r.status === 409 || r.status === 403) {
      const existing = await ascFindBetaTesterByEmail(opts.email, appId);
      if (existing) return existing;
    }
    throw new Error(`ASC create-tester feilet: ${r.status} ${errText.slice(0, 200)}`);
  }
  const d = (await r.json()) as { data: AscBetaTester };
  return d.data;
}

/** Hent en beta-tester via e-post + app-ID. */
export async function ascFindBetaTesterByEmail(
  email: string, appId?: string,
): Promise<AscBetaTester | null> {
  let path = `/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=1`;
  if (appId) path += `&filter[apps]=${appId}`;
  const r = await ascFetch(path);
  if (!r.ok) return null;
  const d = (await r.json()) as { data: AscBetaTester[] };
  return d.data?.[0] ?? null;
}

/** Slett beta-tester (fjerner invitasjon helt). */
export async function ascDeleteBetaTester(betaTesterId: string): Promise<boolean> {
  const r = await ascFetch(`/betaTesters/${betaTesterId}`, { method: "DELETE" });
  return r.ok || r.status === 204;
}

/** Liste alle beta-testere for en app (paginert). */
export async function ascListBetaTestersForApp(
  appId: string, limit = 200,
): Promise<AscBetaTester[]> {
  const out: AscBetaTester[] = [];
  let path = `/betaTesters?filter[apps]=${appId}&limit=${Math.min(limit, 200)}&include=apps`;
  while (path) {
    const r = await ascFetch(path);
    if (!r.ok) {
      console.error("[ASC list-testers]", r.status, await r.text());
      break;
    }
    const d = (await r.json()) as { data: AscBetaTester[]; links?: { next?: string } };
    out.push(...d.data);
    if (out.length >= limit) break;
    const next = d.links?.next;
    if (!next) break;
    // 'next' er full URL — strip base
    path = next.replace(ASC_API_BASE, "");
  }
  return out;
}

/** Helsesjekk — kan vi nå Apple's API? */
export async function ascHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await ascFetch("/apps?limit=1");
    return { ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}
