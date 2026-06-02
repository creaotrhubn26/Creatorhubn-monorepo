// Desktop-auth routes — Google OAuth-paring for Creatorhub One Desk
// Mac-app. Erstatter manuell helper-token-innliming: bruker logger
// inn med Google → app mottar device-token via custom URL-scheme
// `creatorhub-one-desk://oauth-callback?token=...` → kaller
// /api/desktop/me/projects og får automatisk listen over alle
// prosjekter brukeren har tilgang til + per-prosjekt helper-tokens.

import express, { Router, Request, Response } from 'express';
import type { Pool } from 'pg';
import { google } from 'googleapis';
import * as crypto from 'crypto';
import {
  getGoogleWorkspaceOauthConfig,
  type GoogleWorkspaceOauthApp,
} from './google-workspace-oauth.js';

const CREATORHUB_GOOGLE_OAUTH_APP: GoogleWorkspaceOauthApp = 'creatorhub';
const DESKTOP_URL_SCHEME = 'creatorhub-one-desk';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 min
const DEVICE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 år
const HELPER_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dager (samme som CLI-issued)

type DesktopOauthState = {
  createdAt: number;
  browserOrigin: string;
};

const desktopOauthStateStore = new Map<string, DesktopOauthState>();

function pruneExpiredState(): void {
  const now = Date.now();
  for (const [k, v] of desktopOauthStateStore) {
    if (now - v.createdAt > OAUTH_STATE_TTL_MS) {
      desktopOauthStateStore.delete(k);
    }
  }
}

function hashToken(t: string): string {
  return crypto.createHash('sha256').update(t).digest('hex');
}

function resolveBrowserOrigin(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) return origin;
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createDesktopAuthRouter(pool: Pool): Router {
  const router = Router();

  // POST /api/desktop/auth/google/start — initialiser Google OAuth-flow
  router.post('/auth/google/start', async (req: Request, res: Response) => {
    const config = getGoogleWorkspaceOauthConfig(CREATORHUB_GOOGLE_OAUTH_APP, req);
    if (!config.configured) {
      return res.status(503).json({
        success: false,
        error: 'Google OAuth ikke konfigurert på backend',
        missing: config.missing,
      });
    }

    pruneExpiredState();
    const browserOrigin = resolveBrowserOrigin(req);
    const stateId = `dsk_${crypto.randomUUID()}`;
    desktopOauthStateStore.set(stateId, {
      createdAt: Date.now(),
      browserOrigin,
    });

    const redirectUri = `${browserOrigin}/api/desktop/auth/google/callback`;
    const oauthClient = new google.auth.OAuth2(
      config.clientId!,
      config.clientSecret!,
      redirectUri,
    );
    const authorizationUrl = oauthClient.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      include_granted_scopes: true,
      prompt: 'select_account',
      state: stateId,
    });

    return res.json({ success: true, authorizationUrl });
  });

  // GET /api/desktop/auth/google/callback — Google redirecter hit etter login
  router.get('/auth/google/callback', async (req: Request, res: Response) => {
    pruneExpiredState();
    const stateId = String(req.query.state || '');
    const code = String(req.query.code || '');
    const state = stateId ? desktopOauthStateStore.get(stateId) : null;

    if (!state || !code) {
      return res
        .status(400)
        .send(renderErrorPage('Ugyldig forespørsel', 'Lukk denne siden og prøv på nytt fra Creatorhub One Desk.'));
    }
    desktopOauthStateStore.delete(stateId);

    const config = getGoogleWorkspaceOauthConfig(CREATORHUB_GOOGLE_OAUTH_APP, req);
    if (!config.configured) {
      return res.status(503).send(renderErrorPage('Google OAuth ikke konfigurert', ''));
    }

    try {
      const redirectUri = `${state.browserOrigin}/api/desktop/auth/google/callback`;
      const oauthClient = new google.auth.OAuth2(
        config.clientId!,
        config.clientSecret!,
        redirectUri,
      );
      const { tokens } = await oauthClient.getToken(code);
      oauthClient.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
      const profile = await oauth2.userinfo.get();
      const googleEmail = String(profile.data.email || '').toLowerCase().trim();
      if (!googleEmail) {
        return res.status(400).send(renderErrorPage('Google-kontoen mangler e-post', ''));
      }

      // Slå opp brukeren i CreatorHub via e-post. Samme defensive
      // pattern som creatorhub-google-routes:resolveCreatorHubGoogleLoginUser
      let userRow: { id: string; email: string; first_name: string | null; last_name: string | null } | null = null;
      try {
        const r = await pool.query<{ id: string; email: string; first_name: string | null; last_name: string | null }>(
          `SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [googleEmail],
        );
        userRow = r.rows[0] ?? null;
      } catch (err: any) {
        if (err?.code === '42703') {
          const r = await pool.query<{ id: string; email: string }>(
            `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [googleEmail],
          );
          if (r.rows[0]) {
            userRow = { ...r.rows[0], first_name: null, last_name: null };
          }
        } else {
          throw err;
        }
      }

      if (!userRow) {
        return res.status(403).send(
          renderErrorPage(
            'Ingen Creatorhub-konto',
            `Google-kontoen <strong>${escapeHtml(googleEmail)}</strong> er ikke knyttet til en aktiv Creatorhub-konto. Be administrator om å opprette en bruker først.`,
          ),
        );
      }

      // Utsted device-token. Format: `trr_desk_<32-byte-hex>`. Token
      // vises kun nå (via deep-link); kun hashen lagres.
      const deviceTokenId = `ddt_${crypto.randomUUID()}`;
      const rawToken = `trr_desk_${crypto.randomBytes(32).toString('hex')}`;
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + DEVICE_TOKEN_TTL_MS);

      await pool.query(
        `INSERT INTO desktop_device_tokens
         (id, user_id, user_email, token_hash, label, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [deviceTokenId, userRow.id, userRow.email, tokenHash, 'Creatorhub One Desk', expiresAt],
      );

      const userName = [userRow.first_name, userRow.last_name].filter(Boolean).join(' ') || googleEmail;
      const deepLink = `${DESKTOP_URL_SCHEME}://oauth-callback?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(googleEmail)}&name=${encodeURIComponent(userName)}`;

      return res.send(renderSuccessPage(userName, deepLink));
    } catch (error) {
      console.error('[desktop-auth] callback error:', {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
      });
      return res
        .status(500)
        .send(renderErrorPage('Innlogging feilet', 'Noe gikk galt. Lukk denne siden og prøv på nytt.'));
    }
  });

  // GET /api/desktop/me/projects — Bearer device-token kreves
  // Returnerer alle prosjekter brukeren har tilgang til + en
  // per-prosjekt helper-token (auto-issued mot dit_helper_tokens).
  router.get('/me/projects', async (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Bearer-token påkrevd' });
    }
    const token = auth.slice(7).trim();
    if (!token || token.length > 200) {
      return res.status(401).json({ success: false, error: 'Ugyldig token' });
    }
    const tokenHash = hashToken(token);

    const tokenResult = await pool.query<{ user_id: string; user_email: string }>(
      `SELECT user_id, user_email FROM desktop_device_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Token utløpt eller revokert' });
    }
    const { user_id, user_email } = tokenResult.rows[0];

    // Fire-and-forget last_used_at
    pool
      .query(`UPDATE desktop_device_tokens SET last_used_at = now() WHERE token_hash = $1`, [tokenHash])
      .catch(() => {});

    // Finn alle prosjekter brukeren har tilgang til (eier ELLER
    // medlem via casting_user_roles). Defensiv mot manglende
    // kolonner.
    let projectRows: Array<{ id: string; name: string }> = [];
    try {
      const r = await pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM (
           SELECT cp.id, cp.name FROM casting_projects cp WHERE cp.created_by = $1 OR cp.created_by = $2
           UNION
           SELECT cp.id, cp.name FROM casting_projects cp
             INNER JOIN casting_user_roles cur ON cp.id = cur.project_id
             WHERE (cur.user_id = $1 OR LOWER(cur.email) = LOWER($2)) AND cur.deactivated_at IS NULL
         ) AS p
         ORDER BY name ASC`,
        [user_id, user_email],
      );
      projectRows = r.rows;
    } catch (err: any) {
      console.error('[desktop-auth] projects query failed:', err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: 'Kunne ikke hente prosjekter' });
    }

    // For hvert prosjekt: utsted en fresh helper-token. dit_helper_tokens-
    // raden flagges med label='One Desk' så vi senere kan rydde gamle
    // tokens fra forrige login (bonus-cleanup).
    const projects: Array<{
      id: string;
      name: string;
      helper_token: string;
      helper_token_expires_at: string;
    }> = [];

    for (const proj of projectRows) {
      // Revoke eldre One Desk-tokens for SAMME (user, project)-par så
      // vi ikke akkumulerer hundrer av rader over tid. Bruker created_by
      // = user_email som proxy for "denne brukeren".
      await pool
        .query(
          `UPDATE dit_helper_tokens
             SET revoked_at = now()
           WHERE project_id = $1 AND created_by = $2 AND label = 'One Desk' AND revoked_at IS NULL`,
          [proj.id, user_email],
        )
        .catch(() => {});

      const tokId = `dht_${crypto.randomUUID()}`;
      const rawTok = `trr_dit_${crypto.randomBytes(32).toString('hex')}`;
      const tokHash = hashToken(rawTok);
      const expiresAt = new Date(Date.now() + HELPER_TOKEN_TTL_MS);

      await pool.query(
        `INSERT INTO dit_helper_tokens (id, project_id, token_hash, label, expires_at, created_by)
         VALUES ($1, $2, $3, 'One Desk', $4, $5)`,
        [tokId, proj.id, tokHash, expiresAt, user_email],
      );

      projects.push({
        id: proj.id,
        name: proj.name,
        helper_token: rawTok,
        helper_token_expires_at: expiresAt.toISOString(),
      });
    }

    return res.json({
      success: true,
      user: { id: user_id, email: user_email },
      projects,
    });
  });

  // POST /api/desktop/me/logout — revoker device-token
  router.post('/me/logout', async (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Bearer-token påkrevd' });
    }
    const token = auth.slice(7).trim();
    const tokenHash = hashToken(token);
    await pool
      .query(`UPDATE desktop_device_tokens SET revoked_at = now() WHERE token_hash = $1`, [tokenHash])
      .catch(() => {});
    return res.json({ success: true });
  });

  return router;
}

function renderSuccessPage(userName: string, deepLink: string): string {
  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8">
  <title>Innlogget — Creatorhub One Desk</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; text-align: center; color: #1a1a1a; }
    h1 { font-size: 32px; margin: 24px 0 8px; font-weight: 700; }
    p { color: #555; line-height: 1.5; font-size: 16px; }
    .badge { display: inline-block; width: 80px; height: 80px; border-radius: 20px; background: linear-gradient(135deg, #f5b94a 0%, #f08a3d 100%); margin: 0 auto; }
    a.btn { display: inline-block; margin-top: 32px; padding: 14px 28px; background: #1f1f1f; color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; }
    a.btn:hover { background: #000; }
    .hint { margin-top: 24px; color: #999; font-size: 13px; }
  </style>
</head>
<body>
  <div class="badge"></div>
  <h1>Innlogget</h1>
  <p>Velkommen ${escapeHtml(userName)}!</p>
  <p>Du blir sendt tilbake til Creatorhub One Desk om et øyeblikk…</p>
  <a class="btn" href="${escapeHtml(deepLink)}">Åpne Creatorhub One Desk</a>
  <p class="hint">Du kan lukke denne fanen når appen åpner seg.</p>
  <script>
    setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 400);
  </script>
</body>
</html>`;
}

function renderErrorPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} — Creatorhub One Desk</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; text-align: center; color: #1a1a1a; }
    h1 { font-size: 28px; margin: 24px 0 8px; font-weight: 700; color: #c1351e; }
    p { color: #555; line-height: 1.5; font-size: 15px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${body}</p>
</body>
</html>`;
}
