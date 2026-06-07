/**
 * user-drive-credentials-routes.ts
 *
 * Per-bruker Google Drive-integrasjon for CreatorHub-skapere
 * (fotograf/videograf/eventplanner/musiker/...). Parallelt med
 * user-b2-credentials-routes.ts — bruker kan ha Drive, B2, eller begge.
 *
 * UX-prinsipp ("bestemor enkel"):
 *   En ENESTE bruker-handling: "Logg inn med Google". Etter de godtar
 *   gjør backend AUTOMATISK alt:
 *     1. Bytter authorization-code → refresh_token + access_token
 *     2. Henter Google-konto-email
 *     3. Krypterer tokens med per-bruker HKDF + AES-256-GCM
 *     4. UPSERT i user_drive_credentials
 *     5. Oppretter "CreatorHub Workspace"-rot-mappe (med søk først)
 *     6. Oppretter alle profesjon-baserte subfolders (gjenbruker
 *        FOLDER_TEMPLATES fra user-drive-folder-templates.ts)
 *     7. Lagrer alle folder-IDer i user_drive_folders
 *     8. Setter is_verified=TRUE + redirect til onboarding?drive=success
 *
 * Sikkerhetsmodell (speiler user-b2-credentials-routes.ts):
 *   - Master KEK = STORAGE_MASTER_KEK_HEX (64 hex-tegn / 32 bytes)
 *   - Per-bruker KEK = HKDF(master, salt=sha256(userId), info=…)
 *   - AES-256-GCM med 12-byte random IV
 *   - Refresh/access tokens lagres som base64(iv || tag || ciphertext)
 *   - Klartekst-tokens logges ALDRI; kun userId + email + metadata
 *   - State-param i OAuth-start verifiseres mot in-memory cache (5 min TTL)
 *     for XSRF-vern
 *   - Scope default = 'drive.file' (KUN mapper VÅR app lager)
 *
 * Endepunkter (alle bak requireUserSession unntatt OAuth-callback):
 *   POST   /api/user/drive-credentials/oauth/start       — bygg auth-URL
 *   GET    /api/oauth/google-drive/callback              — Google ringer
 *   GET    /api/user/drive-credentials                   — metadata
 *   GET    /api/user/drive-credentials/files             — list filer
 *   GET    /api/user/drive-credentials/folders           — list mapper
 *   GET    /api/user/drive-credentials/stats             — aggregat
 *   POST   /api/user/drive-credentials/upload-url        — resumable upload
 *   DELETE /api/user/drive-credentials/files             — slett fil
 *   POST   /api/user/drive-credentials/sync              — trigger sync
 *   DELETE /api/user/drive-credentials                   — revoke + slett
 *
 * Defensive:
 *   - Hvis STORAGE_MASTER_KEK_HEX mangler → 503
 *   - Hvis GOOGLE_CREATORHUB_CLIENT_ID/SECRET mangler → 503
 *   - Hvis migrasjon 258 ikke kjørt → 503 med klar melding
 */

import type express from "express";
import type { Pool } from "pg";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  createHash,
} from "crypto";
import {
  getTemplateForProfession,
  getTemplateByKey,
  type FolderTemplate,
} from "./user-drive-folder-templates";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface UserDriveCredentialsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ───────────────────────────────────────────────────────────────────
// Crypto-helpers (speiler user-b2-credentials-routes.ts envelope)
// ───────────────────────────────────────────────────────────────────

const KEK_LENGTH = 32;
const IV_LENGTH_GCM = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_DIGEST = "sha256";
const HKDF_INFO = Buffer.from("creatorhub-user-drive-credentials-v1", "utf8");

const isHex64 = (s: string): boolean => /^[0-9a-fA-F]{64}$/.test(s);

let masterKekCache: Buffer | null = null;

function getMasterKek(): Buffer | null {
  if (masterKekCache) return masterKekCache;
  const raw = process.env.STORAGE_MASTER_KEK_HEX;
  if (!raw || raw.trim().length === 0) return null;
  if (!isHex64(raw.trim())) {
    console.error(
      "[user-drive-credentials] STORAGE_MASTER_KEK_HEX må være eksakt 64 hex-tegn (32 bytes)",
    );
    return null;
  }
  masterKekCache = Buffer.from(raw.trim(), "hex");
  return masterKekCache;
}

function deriveUserKek(userId: string): Buffer {
  const master = getMasterKek();
  if (!master) throw new Error("encryption_not_configured");
  const salt = createHash("sha256").update(userId).digest();
  return Buffer.from(hkdfSync(HKDF_DIGEST, master, salt, HKDF_INFO, KEK_LENGTH));
}

function encryptForUser(
  plaintext: string,
  userKek: Buffer,
): { ciphertext: string; iv: string } {
  const iv = randomBytes(IV_LENGTH_GCM);
  const cipher = createCipheriv("aes-256-gcm", userKek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, ct]).toString("base64");
  return { ciphertext: packed, iv: iv.toString("base64") };
}

function decryptForUser(packedBase64: string, userKek: Buffer): string {
  const buf = Buffer.from(packedBase64, "base64");
  if (buf.length < IV_LENGTH_GCM + AUTH_TAG_LENGTH) {
    throw new Error("ciphertext_invalid_length");
  }
  const iv = buf.subarray(0, IV_LENGTH_GCM);
  const tag = buf.subarray(IV_LENGTH_GCM, IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const dec = createDecipheriv("aes-256-gcm", userKek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
}

// ───────────────────────────────────────────────────────────────────
// Generiske helpers
// ───────────────────────────────────────────────────────────────────

function resolveUserId(req: any, session: any): string | null {
  const candidates = [
    session?.userId,
    session?.id,
    session?.user?.id,
    session?.user?.userId,
    req?.user?.id,
    req?.user?.userId,
    req?.session?.userId,
  ].filter((x: any): x is string => typeof x === "string" && x.length > 0);
  return candidates[0] || null;
}

function isUndefinedTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "42P01" ||
    /relation "user_drive_credentials" does not exist/i.test(e?.message || "")
  );
}

function isUndefinedFilesTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "42P01" ||
    /relation "user_drive_files" does not exist/i.test(e?.message || "") ||
    /relation "user_drive_folders" does not exist/i.test(e?.message || "") ||
    /relation "user_drive_sync_runs" does not exist/i.test(e?.message || "")
  );
}

const ALLOWED_SOURCES = new Set([
  "gallery",
  "post-agent",
  "role-room",
  "direct-upload",
  "drive-sync",
]);

function sanitizeSource(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const s = src.trim().toLowerCase();
  return ALLOWED_SOURCES.has(s) ? s : null;
}

function safeRedirectBase(): string {
  // PUBLIC_APP_URL er authoritative; falbacks sikrer at vi aldri
  // bygger en redirect-URI som ikke matcher det vi har registrert
  // i Google Cloud Console.
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://app.creatorhubn.com"
  ).replace(/\/+$/, "");
}

function googleOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CREATORHUB_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CREATORHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: `${safeRedirectBase()}/api/oauth/google-drive/callback`,
  };
}

// ───────────────────────────────────────────────────────────────────
// State-cache for OAuth XSRF-vern
// ───────────────────────────────────────────────────────────────────

interface PendingState {
  userId: string;
  templateKey?: string;
  scope: "drive.file" | "drive";
  createdAt: number;
}

const STATE_TTL_MS = 5 * 60 * 1000;
const pendingStates = new Map<string, PendingState>();

function pruneExpiredStates(): void {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (now - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
  }
}

function createState(entry: Omit<PendingState, "createdAt">): string {
  pruneExpiredStates();
  const random = randomBytes(24).toString("base64url");
  const key = `${entry.userId.slice(0, 8)}:${random}`;
  pendingStates.set(key, { ...entry, createdAt: Date.now() });
  return key;
}

function consumeState(state: string): PendingState | null {
  pruneExpiredStates();
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return null;
  return entry;
}

// ───────────────────────────────────────────────────────────────────
// Google API-helpers
// ───────────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

async function exchangeCodeForTokens(
  code: string,
  cfg: { clientId: string; clientSecret: string; redirectUri: string },
): Promise<{ access_token: string; refresh_token: string; expires_in: number; scope?: string }> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`token_exchange_failed:${resp.status}:${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!data.access_token || !data.refresh_token) {
    // refresh_token kommer KUN på første consent. Hvis det mangler, må
    // vi tvinge prompt=consent på neste auth-runde — det gjør vi alltid.
    throw new Error("missing_refresh_token");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
    scope: data.scope,
  };
}

async function refreshAccessToken(
  refreshToken: string,
  cfg: { clientId: string; clientSecret: string },
): Promise<{ access_token: string; expires_in: number }> {
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`refresh_failed:${resp.status}:${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("refresh_no_access_token");
  return { access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

async function fetchUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
  const resp = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error(`userinfo_failed:${resp.status}`);
  const data = (await resp.json()) as { email?: string; name?: string };
  if (!data.email) throw new Error("userinfo_no_email");
  return { email: data.email, name: data.name };
}

async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: "POST",
    });
  } catch (err) {
    console.warn("[user-drive-credentials] revoke best-effort failed:", err);
  }
}

async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) body.parents = [parentId];
  const resp = await fetch(`${GOOGLE_DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`folder_create_failed:${resp.status}:${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { id?: string };
  if (!data.id) throw new Error("folder_create_no_id");
  return data.id;
}

async function findFolderByName(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<string | null> {
  // Drive v3 search: name + mimeType + parent + not trashed.
  // Vi escaper apostrofer i navnet (Google Q-language: '\'')
  const safeName = name.replace(/'/g, "\\'");
  const qParts = [
    `name='${safeName}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);
  const q = qParts.join(" and ");
  const url = `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    // Med scope=drive.file vil søk bare returnere filer VÅR app har
    // tilgang til — det er hva vi vil. 403/404 her er ikke kritisk.
    return null;
  }
  const data = (await resp.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function fetchDriveQuota(
  accessToken: string,
): Promise<{ totalBytes: number | null; usedBytes: number | null }> {
  try {
    const resp = await fetch(
      `${GOOGLE_DRIVE_API}/about?fields=storageQuota(limit,usage)`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!resp.ok) return { totalBytes: null, usedBytes: null };
    const data = (await resp.json()) as {
      storageQuota?: { limit?: string; usage?: string };
    };
    const total = data.storageQuota?.limit ? Number(data.storageQuota.limit) : null;
    const used = data.storageQuota?.usage ? Number(data.storageQuota.usage) : null;
    return {
      totalBytes: Number.isFinite(total as number) ? (total as number) : null,
      usedBytes: Number.isFinite(used as number) ? (used as number) : null,
    };
  } catch {
    return { totalBytes: null, usedBytes: null };
  }
}

// ───────────────────────────────────────────────────────────────────
// Auto-setup: opprett alle profession-baserte mapper
// ───────────────────────────────────────────────────────────────────

async function setupFolderStructure(
  pool: Pool,
  userId: string,
  accessToken: string,
  template: FolderTemplate,
): Promise<{ rootId: string; foldersCreated: number }> {
  // 1. Finn eller opprett rotmappen
  let rootId = await findFolderByName(accessToken, template.rootFolderName);
  if (!rootId) {
    rootId = await createDriveFolder(accessToken, template.rootFolderName);
  }

  // Lagre rotmappen i DB (idempotent)
  await pool.query(
    `INSERT INTO user_drive_folders
       (user_id, drive_folder_id, parent_drive_folder_id, folder_path, folder_name, template_key)
     VALUES ($1::uuid, $2, NULL, '', $3, $4)
     ON CONFLICT (user_id, folder_path) DO UPDATE SET
       drive_folder_id = EXCLUDED.drive_folder_id,
       folder_name = EXCLUDED.folder_name`,
    [userId, rootId, template.rootFolderName, template.key],
  );

  // 2. Bygg subfolders (path-segmenter rekursivt)
  const folderIdMap = new Map<string, string>();
  folderIdMap.set("", rootId);
  let created = 0;

  for (const folderSpec of template.folders) {
    const parts = folderSpec.path.split("/").filter(Boolean);
    let currentPath = "";
    let parentId = rootId;

    for (const part of parts) {
      const nextPath = currentPath ? `${currentPath}/${part}` : part;
      if (folderIdMap.has(nextPath)) {
        parentId = folderIdMap.get(nextPath)!;
        currentPath = nextPath;
        continue;
      }

      // Sjekk DB-cache først så vi unngår duplikat Drive-call etter
      // partial-failure retry
      const cached = await pool.query<{ drive_folder_id: string }>(
        `SELECT drive_folder_id FROM user_drive_folders
          WHERE user_id = $1::uuid AND folder_path = $2
          LIMIT 1`,
        [userId, nextPath],
      );

      let folderId: string;
      if (cached.rows[0]?.drive_folder_id) {
        folderId = cached.rows[0].drive_folder_id;
      } else {
        // Sjekk Drive (kan eksistere fra forrige run)
        const existing = await findFolderByName(accessToken, part, parentId);
        if (existing) {
          folderId = existing;
        } else {
          folderId = await createDriveFolder(accessToken, part, parentId);
          created++;
        }

        await pool.query(
          `INSERT INTO user_drive_folders
             (user_id, drive_folder_id, parent_drive_folder_id, folder_path, folder_name, template_key)
           VALUES ($1::uuid, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id, folder_path) DO UPDATE SET
             drive_folder_id = EXCLUDED.drive_folder_id,
             parent_drive_folder_id = EXCLUDED.parent_drive_folder_id,
             folder_name = EXCLUDED.folder_name`,
          [userId, folderId, parentId, nextPath, part, template.key],
        );
      }

      folderIdMap.set(nextPath, folderId);
      parentId = folderId;
      currentPath = nextPath;
    }
  }

  return { rootId, foldersCreated: created };
}

// ───────────────────────────────────────────────────────────────────
// Intern: hent gyldig access_token (refresh hvis nær expiry)
// ───────────────────────────────────────────────────────────────────

async function getValidAccessToken(pool: Pool, userId: string): Promise<string> {
  const cfg = googleOAuthConfig();
  if (!cfg) throw new Error("oauth_not_configured");

  const r = await pool.query(
    `SELECT refresh_token_encrypted, access_token_encrypted, access_token_expires_at
       FROM user_drive_credentials
      WHERE user_id = $1::uuid AND is_active = TRUE
      LIMIT 1`,
    [userId],
  );
  if (r.rowCount === 0) throw new Error("no_credentials");
  const row = r.rows[0];

  // 60-sek skew: refresh hvis expiry er < 60 sek frem
  if (
    row.access_token_encrypted &&
    row.access_token_expires_at &&
    new Date(row.access_token_expires_at).getTime() > Date.now() + 60_000
  ) {
    const userKek = deriveUserKek(userId);
    return decryptForUser(row.access_token_encrypted, userKek);
  }

  const userKek = deriveUserKek(userId);
  const refreshToken = decryptForUser(row.refresh_token_encrypted, userKek);

  const refreshed = await refreshAccessToken(refreshToken, {
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
  });

  const { ciphertext, iv } = encryptForUser(refreshed.access_token, userKek);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await pool.query(
    `UPDATE user_drive_credentials
        SET access_token_encrypted = $2,
            access_token_iv = $3,
            access_token_expires_at = $4,
            updated_at = now()
      WHERE user_id = $1::uuid`,
    [userId, ciphertext, iv, expiresAt],
  );
  return refreshed.access_token;
}

// ───────────────────────────────────────────────────────────────────
// Route-setup
// ───────────────────────────────────────────────────────────────────

export function setupUserDriveCredentialsRoutes(
  deps: UserDriveCredentialsRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // ─── POST /api/user/drive-credentials/oauth/start ──────────────────
  // Bygg Google authorization URL; bruker klikker → popup eller redirect.
  app.post("/api/user/drive-credentials/oauth/start", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      const cfg = googleOAuthConfig();
      if (!cfg) {
        return res.status(503).json({
          error: "oauth_not_configured",
          message:
            "GOOGLE_CREATORHUB_CLIENT_ID/SECRET må være satt på serveren",
        });
      }
      if (!getMasterKek()) {
        return res.status(503).json({
          error: "encryption_not_configured",
          message:
            "STORAGE_MASTER_KEK_HEX mangler — kan ikke lagre Google-tokens trygt",
        });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const scope: "drive.file" | "drive" =
        body.scope === "drive" ? "drive" : "drive.file";
      const templateKey =
        typeof body.templateKey === "string" && body.templateKey.length > 0
          ? body.templateKey
          : undefined;

      const state = createState({ userId, templateKey, scope });

      const scopeUrl =
        scope === "drive"
          ? "https://www.googleapis.com/auth/drive"
          : "https://www.googleapis.com/auth/drive.file";
      const fullScope = `${scopeUrl} https://www.googleapis.com/auth/userinfo.email`;

      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_type: "code",
        scope: fullScope,
        access_type: "offline",
        prompt: "consent", // tvinger refresh_token hver gang
        include_granted_scopes: "true",
        state,
      });

      const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return res.json({ oauthUrl, state });
    } catch (err) {
      console.error("[user-drive-credentials] oauth/start failed:", err);
      res.status(500).json({ error: "oauth_start_failed" });
    }
  });

  // ─── GET /api/oauth/google-drive/callback ──────────────────────────
  // Google ringer hit etter brukeren godtok. IKKE bak auth — vi
  // verifiserer via state-param.
  app.get("/api/oauth/google-drive/callback", async (req, res) => {
    const redirectBase = safeRedirectBase();
    const errorRedirect = (reason: string): void => {
      const url = `${redirectBase}/onboarding?drive=error&reason=${encodeURIComponent(reason)}`;
      res.redirect(302, url);
    };

    try {
      const code =
        typeof req.query.code === "string" ? req.query.code : "";
      const stateParam =
        typeof req.query.state === "string" ? req.query.state : "";
      const oauthError =
        typeof req.query.error === "string" ? req.query.error : "";

      if (oauthError) {
        console.warn("[user-drive-credentials] Google returned error:", oauthError);
        return errorRedirect(`google_${oauthError}`);
      }
      if (!code || !stateParam) {
        return errorRedirect("missing_code_or_state");
      }

      const entry = consumeState(stateParam);
      if (!entry) {
        return errorRedirect("invalid_or_expired_state");
      }
      const { userId, templateKey, scope } = entry;

      const cfg = googleOAuthConfig();
      if (!cfg) return errorRedirect("oauth_not_configured");
      if (!getMasterKek()) return errorRedirect("encryption_not_configured");

      // 1. Bytt code → tokens
      let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
      try {
        tokens = await exchangeCodeForTokens(code, cfg);
      } catch (err) {
        console.error("[user-drive-credentials] token exchange failed:", err);
        return errorRedirect("token_exchange_failed");
      }

      // 2. Hent bruker-email
      let userInfo: { email: string; name?: string };
      try {
        userInfo = await fetchUserInfo(tokens.access_token);
      } catch (err) {
        console.error("[user-drive-credentials] userinfo failed:", err);
        return errorRedirect("userinfo_failed");
      }

      // 3. Krypter tokens
      const userKek = deriveUserKek(userId);
      const refreshPacked = encryptForUser(tokens.refresh_token, userKek);
      const accessPacked = encryptForUser(tokens.access_token, userKek);
      const accessExpiresAt = new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString();

      // 4. UPSERT (gjenbruker UNIQUE (user_id))
      try {
        await pool.query(
          `INSERT INTO user_drive_credentials (
             user_id, google_account_email,
             refresh_token_encrypted, refresh_token_iv,
             access_token_encrypted, access_token_iv, access_token_expires_at,
             root_folder_name, scope_granted,
             is_active, is_verified, last_error,
             created_at, updated_at
           ) VALUES (
             $1::uuid, $2,
             $3, $4,
             $5, $6, $7,
             'CreatorHub Workspace', $8,
             TRUE, FALSE, NULL,
             now(), now()
           )
           ON CONFLICT (user_id) DO UPDATE SET
             google_account_email = EXCLUDED.google_account_email,
             refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
             refresh_token_iv = EXCLUDED.refresh_token_iv,
             access_token_encrypted = EXCLUDED.access_token_encrypted,
             access_token_iv = EXCLUDED.access_token_iv,
             access_token_expires_at = EXCLUDED.access_token_expires_at,
             scope_granted = EXCLUDED.scope_granted,
             is_active = TRUE,
             is_verified = FALSE,
             last_error = NULL,
             updated_at = now()`,
          [
            userId,
            userInfo.email,
            refreshPacked.ciphertext,
            refreshPacked.iv,
            accessPacked.ciphertext,
            accessPacked.iv,
            accessExpiresAt,
            scope,
          ],
        );
      } catch (err) {
        if (isUndefinedTableError(err)) {
          console.error(
            "[user-drive-credentials] table missing — migrasjon 258 ikke kjørt",
          );
          return errorRedirect("table_missing");
        }
        console.error("[user-drive-credentials] upsert failed:", err);
        return errorRedirect("db_save_failed");
      }

      // 5. Auto-setup mapper. Hent profesjon fra users.
      let profession: string | null = null;
      try {
        const profRes = await pool.query<{ profession: string | null }>(
          `SELECT profession FROM users WHERE id::text = $1 LIMIT 1`,
          [userId],
        );
        profession = profRes.rows[0]?.profession ?? null;
      } catch (err) {
        console.warn(
          "[user-drive-credentials] could not load profession (continuing):",
          err,
        );
      }

      const template =
        (templateKey ? getTemplateByKey(templateKey) : null) ??
        getTemplateForProfession(profession);

      let rootId: string | null = null;
      let foldersCreated = 0;
      try {
        const result = await setupFolderStructure(
          pool,
          userId,
          tokens.access_token,
          template,
        );
        rootId = result.rootId;
        foldersCreated = result.foldersCreated;
      } catch (err) {
        const msg = (err as Error)?.message?.slice(0, 500) || "setup_failed";
        console.error(
          "[user-drive-credentials] folder setup failed:",
          msg,
        );
        await pool
          .query(
            `UPDATE user_drive_credentials
                SET is_verified = FALSE, last_error = $2, updated_at = now()
              WHERE user_id = $1::uuid`,
            [userId, `setup_folders: ${msg}`],
          )
          .catch(() => undefined);
        // Vi har fortsatt gyldige tokens — la bruker fortsette og
        // re-trigge setup via separat call senere. Redirect med
        // "partial"-status så frontend kan be om retry.
        const partialUrl = `${redirectBase}/onboarding?drive=partial&email=${encodeURIComponent(userInfo.email)}&reason=${encodeURIComponent("folder_setup_failed")}`;
        return res.redirect(302, partialUrl);
      }

      // 6. Hent quota (best-effort) + flip is_verified
      const quota = await fetchDriveQuota(tokens.access_token);
      try {
        await pool.query(
          `UPDATE user_drive_credentials
              SET root_folder_id = $2,
                  is_verified = TRUE,
                  last_verified_at = now(),
                  last_error = NULL,
                  storage_quota_total_bytes = $3,
                  storage_quota_used_bytes = $4,
                  storage_quota_synced_at = CASE WHEN $3 IS NOT NULL OR $4 IS NOT NULL THEN now() ELSE storage_quota_synced_at END,
                  updated_at = now()
            WHERE user_id = $1::uuid`,
          [userId, rootId, quota.totalBytes, quota.usedBytes],
        );
      } catch (err) {
        console.warn(
          "[user-drive-credentials] verify-flip failed (non-fatal):",
          err,
        );
      }

      // Speil status på users.googleDriveConnected (legacy)
      try {
        await pool.query(
          `UPDATE users SET google_drive_connected = TRUE WHERE id::text = $1`,
          [userId],
        );
      } catch {
        // Ikke kritisk
      }

      console.info("[user-drive-credentials] connected", {
        userId,
        email: userInfo.email,
        templateKey: template.key,
        foldersCreated,
        rootId,
      });

      const successUrl =
        `${redirectBase}/onboarding?drive=success` +
        `&email=${encodeURIComponent(userInfo.email)}` +
        `&foldersCreated=${foldersCreated}` +
        `&template=${encodeURIComponent(template.key)}`;
      return res.redirect(302, successUrl);
    } catch (err) {
      console.error("[user-drive-credentials] callback fatal:", err);
      return errorRedirect("unexpected_error");
    }
  });

  // ─── GET /api/user/drive-credentials — metadata ────────────────────
  app.get("/api/user/drive-credentials", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      let row;
      try {
        const result = await pool.query(
          `SELECT google_account_email, root_folder_id, root_folder_name,
                  scope_granted, is_verified, last_verified_at, last_error,
                  storage_quota_total_bytes, storage_quota_used_bytes,
                  storage_quota_synced_at, created_at, updated_at
             FROM user_drive_credentials
            WHERE user_id = $1::uuid AND is_active = TRUE
            LIMIT 1`,
          [userId],
        );
        row = result.rows[0];
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({
            error: "table_missing",
            message: "Migrasjon 258_user_drive_credentials.sql er ikke kjørt enda",
            exists: false,
          });
        }
        throw err;
      }

      if (!row) return res.json({ exists: false });

      let foldersCreated = 0;
      try {
        const c = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM user_drive_folders WHERE user_id = $1::uuid`,
          [userId],
        );
        foldersCreated = Number.parseInt(c.rows[0]?.count || "0", 10);
      } catch {
        // Ikke kritisk — folders-tabellen kan mangle på gamle deploys
      }

      return res.json({
        exists: true,
        accountEmail: row.google_account_email,
        rootFolderId: row.root_folder_id,
        rootFolderName: row.root_folder_name,
        scopeGranted: row.scope_granted,
        isVerified: !!row.is_verified,
        lastVerifiedAt: row.last_verified_at,
        lastError: row.last_error,
        foldersCreated,
        storageQuotaTotalBytes: row.storage_quota_total_bytes
          ? Number(row.storage_quota_total_bytes)
          : null,
        storageQuotaUsedBytes: row.storage_quota_used_bytes
          ? Number(row.storage_quota_used_bytes)
          : null,
        storageQuotaSyncedAt: row.storage_quota_synced_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    } catch (err) {
      console.error("[user-drive-credentials] GET failed:", err);
      res.status(500).json({ error: "fetch_failed" });
    }
  });

  // ─── GET /api/user/drive-credentials/files ─────────────────────────
  app.get("/api/user/drive-credentials/files", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
      const offsetRaw = Number.parseInt(String(req.query.offset ?? "0"), 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 500)
        : 50;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const sourceParam = sanitizeSource(req.query.source);
      const searchRaw =
        typeof req.query.search === "string" ? req.query.search.trim() : "";
      const search = searchRaw.slice(0, 200);

      const where: string[] = ["user_id = $1::uuid", "is_deleted = FALSE"];
      const params: unknown[] = [userId];
      if (sourceParam) {
        params.push(sourceParam);
        where.push(`source = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        where.push(`file_name ILIKE $${params.length}`);
      }
      const whereSql = where.join(" AND ");

      try {
        const totalRes = await pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM user_drive_files WHERE ${whereSql}`,
          params,
        );
        const total = Number.parseInt(totalRes.rows[0]?.count || "0", 10);

        const listParams = [...params, limit, offset];
        const listRes = await pool.query(
          `SELECT id, drive_file_id, drive_folder_id, file_name, mime_type,
                  size_bytes, source, source_id, web_view_link, uploaded_at
             FROM user_drive_files
            WHERE ${whereSql}
            ORDER BY uploaded_at DESC
            LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
          listParams,
        );

        const files = listRes.rows.map((r) => ({
          id: r.id,
          driveFileId: r.drive_file_id,
          driveFolderId: r.drive_folder_id,
          fileName: r.file_name,
          mimeType: r.mime_type,
          sizeBytes: Number(r.size_bytes || 0),
          source: r.source,
          sourceId: r.source_id,
          webViewLink: r.web_view_link,
          uploadedAt: r.uploaded_at,
        }));
        return res.json({ files, total, limit, offset });
      } catch (err) {
        if (isUndefinedFilesTableError(err)) {
          return res.status(503).json({
            error: "table_missing",
            message: "Migrasjon 258_user_drive_credentials.sql er ikke kjørt enda",
            files: [],
            total: 0,
          });
        }
        throw err;
      }
    } catch (err) {
      console.error("[user-drive-credentials] list files failed:", err);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // ─── GET /api/user/drive-credentials/folders ───────────────────────
  app.get("/api/user/drive-credentials/folders", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      try {
        const result = await pool.query(
          `SELECT id, drive_folder_id, parent_drive_folder_id, folder_path,
                  folder_name, template_key, created_at
             FROM user_drive_folders
            WHERE user_id = $1::uuid
            ORDER BY folder_path ASC`,
          [userId],
        );
        const folders = result.rows.map((r) => ({
          id: r.id,
          driveFolderId: r.drive_folder_id,
          parentDriveFolderId: r.parent_drive_folder_id,
          folderPath: r.folder_path,
          folderName: r.folder_name,
          templateKey: r.template_key,
          createdAt: r.created_at,
        }));
        return res.json({ folders, total: folders.length });
      } catch (err) {
        if (isUndefinedFilesTableError(err)) {
          return res.status(503).json({
            error: "table_missing",
            folders: [],
            total: 0,
          });
        }
        throw err;
      }
    } catch (err) {
      console.error("[user-drive-credentials] list folders failed:", err);
      res.status(500).json({ error: "list_failed" });
    }
  });

  // ─── GET /api/user/drive-credentials/stats ─────────────────────────
  app.get("/api/user/drive-credentials/stats", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      try {
        const totalRes = await pool.query<{
          total_files: string;
          total_size_bytes: string;
        }>(
          `SELECT COUNT(*)::text AS total_files,
                  COALESCE(SUM(size_bytes), 0)::text AS total_size_bytes
             FROM user_drive_files
            WHERE user_id = $1::uuid AND is_deleted = FALSE`,
          [userId],
        );
        const totalFiles = Number.parseInt(
          totalRes.rows[0]?.total_files || "0",
          10,
        );
        const totalSizeBytes = Number.parseInt(
          totalRes.rows[0]?.total_size_bytes || "0",
          10,
        );

        const bySourceRes = await pool.query<{
          source: string | null;
          file_count: string;
          size_bytes: string;
        }>(
          `SELECT source,
                  COUNT(*)::text AS file_count,
                  COALESCE(SUM(size_bytes), 0)::text AS size_bytes
             FROM user_drive_files
            WHERE user_id = $1::uuid AND is_deleted = FALSE
            GROUP BY source
            ORDER BY SUM(size_bytes) DESC`,
          [userId],
        );
        const bySource = bySourceRes.rows.map((r) => ({
          source: r.source || "unknown",
          fileCount: Number.parseInt(r.file_count || "0", 10),
          sizeBytes: Number.parseInt(r.size_bytes || "0", 10),
        }));

        // Quota fra credentials-raden (oppdatert ved connect + sync)
        let quotaTotal: number | null = null;
        let quotaUsed: number | null = null;
        try {
          const qr = await pool.query<{
            storage_quota_total_bytes: string | null;
            storage_quota_used_bytes: string | null;
          }>(
            `SELECT storage_quota_total_bytes, storage_quota_used_bytes
               FROM user_drive_credentials
              WHERE user_id = $1::uuid AND is_active = TRUE
              LIMIT 1`,
            [userId],
          );
          if (qr.rows[0]) {
            quotaTotal = qr.rows[0].storage_quota_total_bytes
              ? Number(qr.rows[0].storage_quota_total_bytes)
              : null;
            quotaUsed = qr.rows[0].storage_quota_used_bytes
              ? Number(qr.rows[0].storage_quota_used_bytes)
              : null;
          }
        } catch {
          // Ikke kritisk
        }

        let lastSyncAt: string | null = null;
        let syncStatus: "success" | "failed" | "running" | "never" = "never";
        try {
          const syncRes = await pool.query<{
            finished_at: string | null;
            started_at: string;
            status: string;
          }>(
            `SELECT finished_at, started_at, status
               FROM user_drive_sync_runs
              WHERE user_id = $1::uuid
              ORDER BY started_at DESC
              LIMIT 1`,
            [userId],
          );
          if (syncRes.rows[0]) {
            const r = syncRes.rows[0];
            lastSyncAt = r.finished_at || r.started_at;
            if (r.status === "success") syncStatus = "success";
            else if (r.status === "running") syncStatus = "running";
            else syncStatus = "failed";
          }
        } catch (e) {
          if (!isUndefinedFilesTableError(e)) throw e;
        }

        return res.json({
          totalFiles,
          totalSizeBytes,
          bySource,
          storageQuotaTotalBytes: quotaTotal,
          storageQuotaUsedBytes: quotaUsed,
          lastSyncAt,
          syncStatus,
        });
      } catch (err) {
        if (isUndefinedFilesTableError(err)) {
          return res.status(503).json({
            error: "table_missing",
            totalFiles: 0,
            totalSizeBytes: 0,
            bySource: [],
            storageQuotaTotalBytes: null,
            storageQuotaUsedBytes: null,
            lastSyncAt: null,
            syncStatus: "never",
          });
        }
        throw err;
      }
    } catch (err) {
      console.error("[user-drive-credentials] stats failed:", err);
      res.status(500).json({ error: "stats_failed" });
    }
  });

  // ─── POST /api/user/drive-credentials/upload-url ───────────────────
  // Lag en Drive resumable upload-session. Klient PUT-er bytes
  // direkte til returnert URI (chunked).
  app.post("/api/user/drive-credentials/upload-url", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      const body = (req.body || {}) as Record<string, unknown>;
      const fileName =
        typeof body.fileName === "string"
          ? body.fileName.trim().slice(0, 512)
          : "";
      const mimeType =
        typeof body.mimeType === "string" && body.mimeType.trim().length > 0
          ? body.mimeType.trim().slice(0, 256)
          : "application/octet-stream";
      const folderPath =
        typeof body.folderPath === "string" ? body.folderPath.trim() : "";

      if (!fileName) return res.status(400).json({ error: "invalid_file_name" });

      // Få access_token
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(pool, userId);
      } catch (err) {
        const msg = (err as Error)?.message || "no_credentials";
        if (msg === "no_credentials") {
          return res.status(400).json({ error: "no_credentials" });
        }
        if (msg === "oauth_not_configured") {
          return res.status(503).json({ error: "oauth_not_configured" });
        }
        console.error("[user-drive-credentials] access token failed:", err);
        return res.status(502).json({ error: "token_refresh_failed" });
      }

      // Finn parent folder
      let parentId: string | null = null;
      if (folderPath) {
        try {
          const fr = await pool.query<{ drive_folder_id: string }>(
            `SELECT drive_folder_id FROM user_drive_folders
              WHERE user_id = $1::uuid AND folder_path = $2 LIMIT 1`,
            [userId, folderPath],
          );
          parentId = fr.rows[0]?.drive_folder_id ?? null;
        } catch {
          parentId = null;
        }
      }
      if (!parentId) {
        // Fallback: root folder
        try {
          const rr = await pool.query<{ root_folder_id: string | null }>(
            `SELECT root_folder_id FROM user_drive_credentials
              WHERE user_id = $1::uuid AND is_active = TRUE LIMIT 1`,
            [userId],
          );
          parentId = rr.rows[0]?.root_folder_id ?? null;
        } catch {
          parentId = null;
        }
      }

      // Initier resumable session
      const metaBody: Record<string, unknown> = {
        name: fileName,
        mimeType,
      };
      if (parentId) metaBody.parents = [parentId];

      const initResp = await fetch(
        `${GOOGLE_DRIVE_UPLOAD}/files?uploadType=resumable`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
          },
          body: JSON.stringify(metaBody),
        },
      );

      if (!initResp.ok) {
        const text = await initResp.text().catch(() => "");
        console.error(
          "[user-drive-credentials] resumable init failed:",
          initResp.status,
          text.slice(0, 200),
        );
        return res
          .status(502)
          .json({ error: "drive_init_failed", status: initResp.status });
      }

      const sessionUri = initResp.headers.get("location");
      if (!sessionUri) {
        return res
          .status(502)
          .json({ error: "drive_init_no_location" });
      }

      // 1 time TTL (Drive lar session leve i 7 dager men vi cycler ofte)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return res.json({
        uploadUri: sessionUri,
        parentFolderId: parentId,
        fileName,
        mimeType,
        expiresAt,
      });
    } catch (err) {
      console.error("[user-drive-credentials] upload-url failed:", err);
      res.status(500).json({ error: "upload_url_failed" });
    }
  });

  // ─── DELETE /api/user/drive-credentials/files ──────────────────────
  app.delete("/api/user/drive-credentials/files", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      const driveFileId =
        typeof req.query.driveFileId === "string"
          ? req.query.driveFileId.trim()
          : "";
      if (!driveFileId) {
        return res.status(400).json({ error: "missing_drive_file_id" });
      }

      // Verifiser eierskap
      try {
        const own = await pool.query(
          `SELECT 1 FROM user_drive_files
            WHERE user_id = $1::uuid AND drive_file_id = $2
              AND is_deleted = FALSE
            LIMIT 1`,
          [userId, driveFileId],
        );
        if (own.rowCount === 0) {
          return res.status(404).json({ error: "file_not_found" });
        }
      } catch (err) {
        if (isUndefinedFilesTableError(err)) {
          return res.status(503).json({ error: "table_missing" });
        }
        throw err;
      }

      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(pool, userId);
      } catch {
        return res.status(400).json({ error: "no_credentials" });
      }

      // Slett i Drive
      const delResp = await fetch(
        `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(driveFileId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!delResp.ok && delResp.status !== 404) {
        const text = await delResp.text().catch(() => "");
        console.error(
          "[user-drive-credentials] Drive delete failed:",
          delResp.status,
          text.slice(0, 200),
        );
        return res
          .status(502)
          .json({ error: "drive_delete_failed", status: delResp.status });
      }

      // Marker som slettet i DB
      await pool.query(
        `UPDATE user_drive_files
            SET is_deleted = TRUE, deleted_at = now()
          WHERE user_id = $1::uuid AND drive_file_id = $2`,
        [userId, driveFileId],
      );

      return res.json({ success: true });
    } catch (err) {
      console.error("[user-drive-credentials] delete file failed:", err);
      res.status(500).json({ error: "delete_failed" });
    }
  });

  // ─── POST /api/user/drive-credentials/sync ─────────────────────────
  // Re-fetcher quota + lar fremtidig sync-worker hekte seg på. Pre-INSERTer
  // sync-run så vi kan returnere runId umiddelbart.
  app.post("/api/user/drive-credentials/sync", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      try {
        const credCheck = await pool.query(
          `SELECT 1 FROM user_drive_credentials
            WHERE user_id = $1::uuid AND is_active = TRUE LIMIT 1`,
          [userId],
        );
        if (credCheck.rowCount === 0) {
          return res.status(400).json({ error: "no_credentials" });
        }
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.status(503).json({ error: "table_missing" });
        }
        throw err;
      }

      let runId: string;
      try {
        const runRes = await pool.query<{ id: string }>(
          `INSERT INTO user_drive_sync_runs (user_id, status)
           VALUES ($1::uuid, 'running')
           RETURNING id`,
          [userId],
        );
        runId = runRes.rows[0].id;
      } catch (err) {
        if (isUndefinedFilesTableError(err)) {
          return res.status(503).json({ error: "table_missing" });
        }
        throw err;
      }

      // Best-effort: oppdater quota i bakgrunnen
      setImmediate(async () => {
        try {
          const token = await getValidAccessToken(pool, userId);
          const quota = await fetchDriveQuota(token);
          await pool.query(
            `UPDATE user_drive_credentials
                SET storage_quota_total_bytes = COALESCE($2, storage_quota_total_bytes),
                    storage_quota_used_bytes = COALESCE($3, storage_quota_used_bytes),
                    storage_quota_synced_at = now(),
                    updated_at = now()
              WHERE user_id = $1::uuid`,
            [userId, quota.totalBytes, quota.usedBytes],
          );
          await pool.query(
            `UPDATE user_drive_sync_runs
                SET status = 'success', finished_at = now()
              WHERE id = $1::uuid`,
            [runId],
          );
        } catch (err) {
          const msg = (err as Error)?.message?.slice(0, 500) || "sync_failed";
          await pool
            .query(
              `UPDATE user_drive_sync_runs
                  SET status = 'failed', finished_at = now(), error_message = $2
                WHERE id = $1::uuid`,
              [runId, msg],
            )
            .catch(() => undefined);
        }
      });

      return res.json({ runId, started: true });
    } catch (err) {
      console.error("[user-drive-credentials] sync trigger failed:", err);
      res.status(500).json({ error: "sync_failed" });
    }
  });

  // ─── DELETE /api/user/drive-credentials ────────────────────────────
  // Revoker refresh_token mot Google + sletter rad.
  app.delete("/api/user/drive-credentials", async (req, res) => {
    try {
      const session = requireUserSession(req, res);
      if (!session) return;
      const userId = resolveUserId(req, session);
      if (!userId) return res.status(401).json({ error: "no_session" });

      // Hent refresh_token før vi sletter raden
      let refreshTokenClear: string | null = null;
      try {
        const r = await pool.query(
          `SELECT refresh_token_encrypted FROM user_drive_credentials
            WHERE user_id = $1::uuid LIMIT 1`,
          [userId],
        );
        const enc = r.rows[0]?.refresh_token_encrypted;
        if (enc && getMasterKek()) {
          try {
            refreshTokenClear = decryptForUser(enc, deriveUserKek(userId));
          } catch {
            // Ignorer dekrypterings-feil — vi sletter uansett
          }
        }
      } catch (err) {
        if (isUndefinedTableError(err)) {
          return res.json({ success: true });
        }
        throw err;
      }

      // Revoker på Google (best-effort, ikke blokker)
      if (refreshTokenClear) {
        await revokeToken(refreshTokenClear);
      }

      // Slett rad
      await pool.query(
        `DELETE FROM user_drive_credentials WHERE user_id = $1::uuid`,
        [userId],
      );

      // Speil status på users.googleDriveConnected
      try {
        await pool.query(
          `UPDATE users SET google_drive_connected = FALSE WHERE id::text = $1`,
          [userId],
        );
      } catch {
        // Ikke kritisk
      }

      console.info("[user-drive-credentials] deleted creds for user", userId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[user-drive-credentials] DELETE failed:", err);
      res.status(500).json({ error: "delete_failed" });
    }
  });
}
