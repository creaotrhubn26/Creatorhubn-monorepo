/**
 * microsoft-graph.ts — Outlook/Microsoft 365 OAuth + Graph mail-lesing.
 *
 * Motstykket til Google-OAuth, for kvittering-skann fra Outlook. Gjenbruker
 * samme AES-GCM token-krypto som Google (encrypt/decryptGoogleToken). Alt er
 * GATED bak MICROSOFT_CLIENT_ID/SECRET — uten dem er isMicrosoftConfigured()
 * false og «Koble til Outlook» viser bare «ikke konfigurert ennå» (trygt å
 * deploye før Azure-appen finnes).
 *
 * Azure-oppsett (engangs, gjøres i portal.azure.com → Entra ID → App registrations):
 *   - Redirect URI (Web): <BACKEND>/api/creatorhub/microsoft/oauth/callback
 *   - Delegated Graph-permissions: Mail.Read, User.Read, offline_access
 *   - Client secret → MICROSOFT_CLIENT_SECRET ; Application (client) ID → MICROSOFT_CLIENT_ID
 */
import crypto from "crypto";
import type { Pool } from "pg";
import { encryptGoogleToken, decryptGoogleToken } from "./google-oauth-shared.js";

const TENANT = process.env.MICROSOFT_TENANT || "common";
const SCOPES = ["offline_access", "User.Read", "Mail.Read"];
const GRAPH = "https://graph.microsoft.com/v1.0";

export function isMicrosoftConfigured(): boolean {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

function redirectUri(): string {
  return process.env.MICROSOFT_REDIRECT_URI
    || `${process.env.PUBLIC_BACKEND_URL || "https://creatorhub-backend-rtbl.onrender.com"}/api/creatorhub/microsoft/oauth/callback`;
}

// ── State-signering (bærer userId trygt gjennom redirect uten å stole på cookie) ──
function stateSecret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.AUTH_SECRET || "ms-oauth-fallback";
}
export function signState(userId: string): string {
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}.${nonce}`;
  const sig = crypto.createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, nonce, sig] = parts;
    const expect = crypto.createHmac("sha256", stateSecret()).update(`${userId}.${nonce}`).digest("hex").slice(0, 32);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    return userId;
  } catch { return null; }
}

export function getMicrosoftAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: redirectUri(),
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${p.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<any> {
  const resp = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      redirect_uri: redirectUri(),
      ...body,
    }).toString(),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`ms_token_${resp.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

export async function exchangeCodeForTokens(code: string): Promise<any> {
  return tokenRequest({ grant_type: "authorization_code", code, scope: SCOPES.join(" ") });
}

async function ensureTable(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS microsoft_connections (
    id uuid PRIMARY KEY, user_id varchar NOT NULL, ms_email varchar, ms_user_id varchar,
    access_token_encrypted text, refresh_token_encrypted text, expiry_date timestamptz,
    scopes jsonb, connection_state varchar(32) DEFAULT 'connected',
    created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`).catch(() => {});
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS microsoft_connections_user_uidx ON microsoft_connections (user_id)`).catch(() => {});
}

export async function saveMicrosoftConnection(pool: Pool, userId: string, tokens: any, profile: any): Promise<void> {
  await ensureTable(pool);
  const expiry = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null;
  await pool.query(
    `INSERT INTO microsoft_connections
       (id, user_id, ms_email, ms_user_id, access_token_encrypted, refresh_token_encrypted, expiry_date, scopes, connection_state, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'connected',now())
     ON CONFLICT (user_id) DO UPDATE SET
       ms_email = EXCLUDED.ms_email, ms_user_id = EXCLUDED.ms_user_id,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, microsoft_connections.refresh_token_encrypted),
       expiry_date = EXCLUDED.expiry_date, scopes = EXCLUDED.scopes,
       connection_state = 'connected', updated_at = now()`,
    [crypto.randomUUID(), userId,
     profile?.mail || profile?.userPrincipalName || null, profile?.id || null,
     encryptGoogleToken(tokens.access_token || null),
     tokens.refresh_token ? encryptGoogleToken(tokens.refresh_token) : null,
     expiry, JSON.stringify(SCOPES)],
  );
}

export async function getMicrosoftStatus(pool: Pool, userId: string): Promise<{ connected: boolean; email: string | null }> {
  await ensureTable(pool);
  const r = await pool.query(
    `SELECT ms_email, connection_state FROM microsoft_connections WHERE user_id=$1 LIMIT 1`, [userId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = r.rows[0];
  return { connected: !!row && row.connection_state === "connected", email: row?.ms_email || null };
}

export async function disconnectMicrosoft(pool: Pool, userId: string): Promise<void> {
  await ensureTable(pool);
  await pool.query(`DELETE FROM microsoft_connections WHERE user_id=$1`, [userId]).catch(() => {});
}

/**
 * Gyldig access-token for brukeren, refreshet ved behov. null hvis ikke koblet
 * eller ikke konfigurert. Markerer needs_reauth ved invalid_grant.
 */
export async function getFreshMicrosoftAccessToken(pool: Pool, userId: string): Promise<string | null> {
  if (!isMicrosoftConfigured()) return null;
  await ensureTable(pool);
  const r = await pool.query(
    `SELECT access_token_encrypted, refresh_token_encrypted, expiry_date FROM microsoft_connections
      WHERE user_id=$1 AND connection_state='connected' LIMIT 1`, [userId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = r.rows[0];
  if (!row) return null;

  const accessToken = decryptGoogleToken(row.access_token_encrypted);
  const refreshToken = decryptGoogleToken(row.refresh_token_encrypted);
  const expiryMs = row.expiry_date ? Date.parse(row.expiry_date) : 0;
  const expiringSoon = !Number.isFinite(expiryMs) || expiryMs <= Date.now() + 5 * 60_000;

  if (accessToken && !expiringSoon) return accessToken;
  if (!refreshToken) return accessToken || null;

  try {
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken, scope: SCOPES.join(" ") });
    const expiry = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null;
    await pool.query(
      `UPDATE microsoft_connections SET access_token_encrypted=$1,
         refresh_token_encrypted=COALESCE($2, refresh_token_encrypted), expiry_date=$3, updated_at=now()
       WHERE user_id=$4`,
      [encryptGoogleToken(tokens.access_token || null),
       tokens.refresh_token ? encryptGoogleToken(tokens.refresh_token) : null, expiry, userId],
    ).catch(() => {});
    return tokens.access_token || accessToken || null;
  } catch (err: any) {
    if (String(err?.message || "").includes("invalid_grant")) {
      await pool.query(`UPDATE microsoft_connections SET connection_state='needs_reauth', updated_at=now() WHERE user_id=$1`, [userId]).catch(() => {});
    }
    console.warn("[microsoft-graph] refresh feilet for", userId, err?.message);
    return accessToken || null;
  }
}

export async function fetchMicrosoftProfile(accessToken: string): Promise<any> {
  const resp = await fetch(`${GRAPH}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.ok ? resp.json() : {};
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Kvittering-kandidater fra Outlook via Graph $search. Returnerer normaliserte
 * {id, subject, from, body} — id prefikses 'ms:' så den aldri kolliderer med
 * Gmail-IDer i software_expenses.source_email_id.
 */
export async function listMicrosoftReceiptCandidates(
  accessToken: string, keywords: string, top = 40,
): Promise<Array<{ id: string; subject: string; from: string; body: string }>> {
  // $search bruker KQL og krever ConsistencyLevel: eventual.
  const url = `${GRAPH}/me/messages?$search=${encodeURIComponent(`"${keywords}"`)}`
    + `&$select=id,subject,from,receivedDateTime,body,bodyPreview&$top=${top}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: "eventual" },
  });
  if (!resp.ok) {
    const status = resp.status;
    const err: any = new Error(`ms_graph_${status}`);
    err.status = status;
    throw err;
  }
  const json: any = await resp.json().catch(() => ({}));
  const items = Array.isArray(json?.value) ? json.value : [];
  return items.map((m: any) => {
    const bodyRaw = m?.body?.content || m?.bodyPreview || "";
    const body = (m?.body?.contentType === "html" ? stripHtml(bodyRaw) : String(bodyRaw)).slice(0, 4000);
    const fromAddr = m?.from?.emailAddress ? `${m.from.emailAddress.name || ""} <${m.from.emailAddress.address || ""}>` : "";
    return { id: `ms:${m.id}`, subject: String(m?.subject || ""), from: fromAddr, body };
  });
}
