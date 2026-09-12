/**
 * role-room-publish-providers.ts
 *
 * Publiseringsflater utover Meta/LinkedIn for Innholdsprodusent-agenten:
 * TikTok (Content Posting API), YouTube (Data API v3) og Pinterest (v5).
 * Feed-planen har tilstandene draft→approved→scheduled→published — denne
 * modulen er selve publiserings-steget.
 *
 * «Ærlig port»-mønsteret (som Feide/GoCardless): koden er komplett, men
 * hver plattform lyser først opp når app-registreringens env-nøkler er
 * satt. /publish/status forteller ærlig hva som er konfigurert.
 *
 * OAuth er PER PROSJEKT (kundens egne kontoer — aldri delte nøkler):
 * tokens lagres i role_room_publish_connections (lazy tabell), refresh
 * håndteres ved publisering.
 *
 * Env (Render):
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET   (Google Cloud OAuth-app)
 *   PINTEREST_APP_ID / PINTEREST_APP_SECRET
 *   PUBLIC_BACKEND_URL (callback-base, default Render-URL-en)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import {
  decryptInstagramToken,
  encryptInstagramToken,
} from "./role-room-instagram-oauth.js";

const BASE_URL = process.env.PUBLIC_BACKEND_URL
  ?? "https://creatorhub-backend-rtbl.onrender.com";

type Plattform = "tiktok" | "youtube" | "pinterest";

const KONFIG: Record<Plattform, {
  clientId: string | undefined;
  clientSecret: string | undefined;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}> = {
  tiktok: {
    clientId: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scope: "user.info.basic,video.publish",
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/youtube.upload",
  },
  pinterest: {
    clientId: process.env.PINTEREST_APP_ID,
    clientSecret: process.env.PINTEREST_APP_SECRET,
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scope: "boards:read,pins:write",
  },
};

function konfigurert(p: Plattform): boolean {
  return Boolean(KONFIG[p].clientId && KONFIG[p].clientSecret);
}

function callbackUrl(p: Plattform): string {
  return `${BASE_URL}/api/role-room/publish/${p}/callback`;
}

/** Signert state så callbacken ikke kan forfalskes (HMAC av payload). */
function stateSecret(): string | null {
  const value = (
    process.env.ROLE_ROOM_PUBLISH_STATE_SECRET
    ?? process.env.SESSION_SECRET
    ?? process.env.ROLE_ROOM_TOKEN_ENCRYPTION_KEY
    ?? process.env.AUTH_SECRET
    ?? ""
  ).trim();
  return value.length >= 32 ? value : null;
}
function lagState(projectId: string, userId: string): string | null {
  const secret = stateSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ projectId, userId, t: Date.now() }))
    .toString("base64url");
  const sig = crypto.createHmac("sha256", secret)
    .update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function lesState(state: string): { projectId: string; userId: string } | null {
  const secret = stateSecret();
  if (!secret) return null;
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const riktig = crypto.createHmac("sha256", secret)
    .update(payload).digest("base64url");
  const supplied = Buffer.from(sig);
  const expected = Buffer.from(riktig);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return null;
  }
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString());
    // Stale states avvises (30 min vindu).
    if (Date.now() - Number(d.t) > 30 * 60 * 1000) return null;
    return { projectId: String(d.projectId), userId: String(d.userId) };
  } catch { return null; }
}

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_room_publish_connections (
      project_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      access_token_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT,
      expires_at TIMESTAMPTZ,
      remote_name TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, platform)
    )`);
  schemaReady = true;
}

type Tilkobling = {
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  expires_at: Date | null;
};

/** Gyldig token for prosjektet — refresher automatisk når utløpt. */
async function hentToken(
  pool: Pool, projectId: string, p: Plattform,
): Promise<string | null> {
  const r = await pool.query<Tilkobling>(
    `SELECT access_token_encrypted, refresh_token_encrypted, expires_at
       FROM role_room_publish_connections
      WHERE project_id = $1 AND platform = $2`,
    [projectId, p]);
  const rad = r.rows[0];
  if (!rad) return null;
  const accessToken = decryptInstagramToken(rad.access_token_encrypted);
  const refreshToken = decryptInstagramToken(rad.refresh_token_encrypted);
  if (!accessToken) return null;
  const utlopt = rad.expires_at && rad.expires_at.getTime() < Date.now() + 60_000;
  if (!utlopt) return accessToken;
  if (!refreshToken) return null;
  const k = KONFIG[p];
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    ...(p === "tiktok"
      ? { client_key: k.clientId ?? "", client_secret: k.clientSecret ?? "" }
      : { client_id: k.clientId ?? "", client_secret: k.clientSecret ?? "" }),
  });
  const res = await fetch(k.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const d = (await res.json()) as Record<string, unknown>;
  const token = String(d.access_token ?? "");
  if (!token) return null;
  const encryptedToken = encryptInstagramToken(token);
  const encryptedRefresh = d.refresh_token
    ? encryptInstagramToken(String(d.refresh_token))
    : null;
  if (!encryptedToken || (d.refresh_token && !encryptedRefresh)) return null;
  await pool.query(
    `UPDATE role_room_publish_connections
        SET access_token_encrypted = $1,
            refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
            expires_at = $3,
            updated_at = NOW()
      WHERE project_id = $4 AND platform = $5`,
    [encryptedToken, encryptedRefresh,
     d.expires_in ? new Date(Date.now() + Number(d.expires_in) * 1000) : null,
     projectId, p]);
  return token;
}

// ── Provider-publisering ────────────────────────────────────────────────

/** TikTok: PULL_FROM_URL — TikTok henter videoen selv fra media-URL-en. */
async function publiserTikTok(
  token: string, caption: string, mediaUrl: string,
): Promise<{ ok: boolean; remoteId?: string; feil?: string }> {
  const res = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: caption.slice(0, 2200),
          privacy_level: "SELF_ONLY", // kunden publiserer offentlig etter kontroll
        },
        source_info: { source: "PULL_FROM_URL", video_url: mediaUrl },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  const d = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || d?.error?.code !== "ok") {
    return { ok: false, feil: d?.error?.message ?? `tiktok_${res.status}` };
  }
  return { ok: true, remoteId: String(d?.data?.publish_id ?? "") };
}

/** YouTube: resumable upload — henter media-bytene og laster opp. */
async function publiserYouTube(
  token: string, caption: string, mediaUrl: string,
): Promise<{ ok: boolean; remoteId?: string; feil?: string }> {
  const media = await fetch(mediaUrl, { signal: AbortSignal.timeout(60_000) });
  if (!media.ok) return { ok: false, feil: "media_utilgjengelig" };
  const bytes = Buffer.from(await media.arrayBuffer());
  if (bytes.length > 256 * 1024 * 1024) {
    return { ok: false, feil: "video_for_stor_256mb" };
  }
  const linjer = caption.split("\n");
  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify({
        snippet: {
          title: (linjer[0] || "Ny video").slice(0, 100),
          description: caption.slice(0, 5000),
        },
        status: { privacyStatus: "private" }, // kunden setter offentlig selv
      }),
      signal: AbortSignal.timeout(30_000),
    });
  const uploadUrl = init.headers.get("location");
  if (!init.ok || !uploadUrl) return { ok: false, feil: `youtube_init_${init.status}` };
  const opp = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/*" },
    body: bytes,
    signal: AbortSignal.timeout(300_000),
  });
  const d = (await opp.json().catch(() => ({}))) as Record<string, any>;
  if (!opp.ok) return { ok: false, feil: `youtube_upload_${opp.status}` };
  return { ok: true, remoteId: String(d?.id ?? "") };
}

/** Pinterest: pin fra bilde-URL på kundens første board (eller angitt). */
async function publiserPinterest(
  token: string, caption: string, mediaUrl: string, boardId?: string,
): Promise<{ ok: boolean; remoteId?: string; feil?: string }> {
  let board = boardId;
  if (!board) {
    const br = await fetch("https://api.pinterest.com/v5/boards?page_size=1", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const bd = (await br.json().catch(() => ({}))) as Record<string, any>;
    board = bd?.items?.[0]?.id;
    if (!board) return { ok: false, feil: "ingen_boards" };
  }
  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: board,
      title: caption.split("\n")[0]?.slice(0, 100),
      description: caption.slice(0, 800),
      media_source: { source_type: "image_url", url: mediaUrl },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const d = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) return { ok: false, feil: d?.message ?? `pinterest_${res.status}` };
  return { ok: true, remoteId: String(d?.id ?? "") };
}

// ── Ruter ───────────────────────────────────────────────────────────────

export function setupRoleRoomPublishProviderRoutes(deps: {
  app: Express;
  pool: Pool;
  requireAdminSession: (req: Request, res: Response) =>
    { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireAdminSession } = deps;

  /** Ærlig status: hva er konfigurert (env) og hva er koblet (prosjekt). */
  app.get("/api/role-room/publish/status", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      await ensureSchema(pool);
      const projectId = String(req.query.projectId ?? "");
      const tilkoblinger = projectId
        ? await pool.query<{ platform: string; remote_name: string | null }>(
            `SELECT platform, remote_name FROM role_room_publish_connections
              WHERE project_id = $1`, [projectId])
        : { rows: [] as Array<{ platform: string; remote_name: string | null }> };
      res.json({
        platforms: (Object.keys(KONFIG) as Plattform[]).map((p) => ({
          platform: p,
          configured: konfigurert(p),
          connected: tilkoblinger.rows.some((r) => r.platform === p),
          remoteName: tilkoblinger.rows.find((r) => r.platform === p)?.remote_name ?? null,
        })),
      });
    } catch (e) {
      console.error("[publish] status failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** OAuth-start: returnerer URL-en kunden sendes til. */
  app.get("/api/role-room/publish/:platform/connect", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const p = String(req.params.platform) as Plattform;
      if (!KONFIG[p]) { res.status(404).json({ error: "ukjent_plattform" }); return; }
      if (!konfigurert(p)) {
        res.status(503).json({
          error: "ikke_konfigurert",
          message: `${p}-app-registreringen mangler i miljøet (se role-room-publish-providers.ts).`,
        });
        return;
      }
      const projectId = String(req.query.projectId ?? "");
      if (!projectId) { res.status(400).json({ error: "projectId kreves" }); return; }
      const k = KONFIG[p];
      const state = lagState(projectId, session.userId);
      if (!state) {
        res.status(503).json({
          error: "state_secret_mangler",
          message: "ROLE_ROOM_PUBLISH_STATE_SECRET eller en delt auth-secret må konfigureres.",
        });
        return;
      }
      const q = new URLSearchParams({
        response_type: "code",
        redirect_uri: callbackUrl(p),
        scope: k.scope,
        state,
        ...(p === "tiktok"
          ? { client_key: k.clientId ?? "" }
          : { client_id: k.clientId ?? "" }),
        ...(p === "youtube" ? { access_type: "offline", prompt: "consent" } : {}),
      });
      res.json({ authUrl: `${k.authUrl}?${q.toString()}` });
    } catch (e) {
      console.error("[publish] connect failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** OAuth-callback: bytt code → tokens, lagre per prosjekt. */
  app.get("/api/role-room/publish/:platform/callback", async (req, res) => {
    try {
      const p = String(req.params.platform) as Plattform;
      if (!KONFIG[p] || !konfigurert(p)) { res.status(404).send("Ukjent plattform"); return; }
      const code = String(req.query.code ?? "");
      const state = lesState(String(req.query.state ?? ""));
      if (!code || !state) { res.status(400).send("Ugyldig callback"); return; }
      const k = KONFIG[p];
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl(p),
        ...(p === "tiktok"
          ? { client_key: k.clientId ?? "", client_secret: k.clientSecret ?? "" }
          : { client_id: k.clientId ?? "", client_secret: k.clientSecret ?? "" }),
      });
      const tr = await fetch(k.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const d = (await tr.json().catch(() => ({}))) as Record<string, any>;
      const token = String(d.access_token ?? "");
      if (!tr.ok || !token) {
        console.error("[publish] token-bytte feilet:", p, String(d?.error ?? tr.status));
        res.status(502).send("Token-bytte feilet — prøv igjen.");
        return;
      }
      const encryptedToken = encryptInstagramToken(token);
      const encryptedRefresh = d.refresh_token
        ? encryptInstagramToken(String(d.refresh_token))
        : null;
      if (!encryptedToken || (d.refresh_token && !encryptedRefresh)) {
        res.status(503).send("Token-kryptering er ikke konfigurert.");
        return;
      }
      await ensureSchema(pool);
      await pool.query(
        `INSERT INTO role_room_publish_connections
           (project_id, platform, access_token_encrypted, refresh_token_encrypted,
            expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (project_id, platform)
         DO UPDATE SET access_token_encrypted = EXCLUDED.access_token_encrypted,
                       refresh_token_encrypted = COALESCE(
                         EXCLUDED.refresh_token_encrypted,
                         role_room_publish_connections.refresh_token_encrypted
                       ),
                       expires_at = EXCLUDED.expires_at,
                       created_by = EXCLUDED.created_by,
                       updated_at = NOW()`,
        [state.projectId, p, encryptedToken,
         encryptedRefresh,
         d.expires_in ? new Date(Date.now() + Number(d.expires_in) * 1000) : null,
         state.userId]);
      res.send(`<html><body style="font-family:-apple-system;padding:40px">
        <h2>✅ ${p} er koblet til</h2>
        <p>Du kan lukke dette vinduet og gå tilbake til The Role Room.</p>
      </body></html>`);
    } catch (e) {
      console.error("[publish] callback failed:", e);
      res.status(500).send("Intern feil");
    }
  });

  /** Publiser: {projectId, caption, mediaUrl, boardId?} → provider-kall. */
  app.post("/api/role-room/publish/:platform/publish", async (req, res) => {
    try {
      const session = await requireAdminSession(req, res);
      if (!session) return;
      const p = String(req.params.platform) as Plattform;
      if (!KONFIG[p]) { res.status(404).json({ error: "ukjent_plattform" }); return; }
      const b = (req.body ?? {}) as Record<string, unknown>;
      const projectId = String(b.projectId ?? "");
      const caption = String(b.caption ?? "").slice(0, 5000);
      const mediaUrl = String(b.mediaUrl ?? "");
      if (!projectId || !mediaUrl || !/^https:\/\//.test(mediaUrl)) {
        res.status(400).json({ error: "projectId + https mediaUrl kreves" });
        return;
      }
      await ensureSchema(pool);
      const token = await hentToken(pool, projectId, p);
      if (!token) {
        res.status(409).json({
          error: "ikke_tilkoblet",
          message: `Prosjektet har ingen gyldig ${p}-tilkobling — koble til først.`,
        });
        return;
      }
      const resultat = p === "tiktok"
        ? await publiserTikTok(token, caption, mediaUrl)
        : p === "youtube"
          ? await publiserYouTube(token, caption, mediaUrl)
          : await publiserPinterest(token, caption, mediaUrl,
                                    b.boardId ? String(b.boardId) : undefined);
      if (!resultat.ok) {
        res.status(502).json({ error: "publisering_feilet", detalj: resultat.feil });
        return;
      }
      res.json({ ok: true, platform: p, remoteId: resultat.remoteId ?? null });
    } catch (e) {
      console.error("[publish] publish failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
