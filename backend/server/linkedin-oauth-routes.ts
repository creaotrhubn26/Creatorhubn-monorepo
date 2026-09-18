/**
 * linkedin-oauth-routes.ts
 *
 * LinkedIn OAuth-flow + Company/Showcase Page discovery for Marketing Cockpit.
 *
 * Daniels brukerflyt:
 *   1. Klikker "Koble LinkedIn" i Admin Room → vi sender ham til LinkedIn-OAuth
 *   2. LinkedIn redirecter tilbake med code → vi exchanger til access-token
 *   3. Vi henter org-listen (ACLs) og finner alle orgs han er admin på
 *      (Creatorhub AS Company + The Role Room Showcase = 2 entries)
 *   4. Daniel velger hvilke som skal lagres (begge) og markerer Showcase
 *      som default for publish
 *   5. Tokenen lagres i linkedin_org_config med expiry, refresh-token,
 *      og auto-rotates når den nærmer seg utløp
 *
 * Krever env-vars:
 *   - LINKEDIN_CLIENT_ID
 *   - LINKEDIN_CLIENT_SECRET
 */

import type express from "express";
import type { Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import {
  decryptLinkedInToken,
  encryptLinkedInToken,
  listLinkedInCompanies,
} from "./social-publisher-linkedin.js";

interface SessionLike { userId: string; email?: string }

export interface LinkedInOAuthRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
  isAdminEmail: (email: string | null | undefined) => boolean;
}

const PUBLIC_URL = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";
// Én consent-flow dekker OIDC-identitet, personlig publisering og publisering
// til sider brukeren faktisk administrerer.
const REQUIRED_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
  "r_organization_admin",
  "w_organization_social",
] as const;
const ORGANIZATION_PUBLISH_SCOPES = [
  "r_organization_admin",
  "w_organization_social",
] as const;

const REDIRECT_URI = `${PUBLIC_URL}/api/admin-room/cockpit/linkedin/oauth-callback`;

function normalizeScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value.filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ));
  }
  if (typeof value !== "string") return [];
  return Array.from(new Set(value.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean)));
}

function readStoredLinkedInToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const stored = value.trim();
  // Midlertidig bakoverkompatibilitet for eksisterende klartekst-rader. Alle
  // nye writes krypteres, og resolveren migrerer gamle rader ved første bruk.
  if (!stored.startsWith("v1.")) return stored;
  return decryptLinkedInToken(stored);
}

function hasScopes(scopes: string[], required: readonly string[]): boolean {
  const granted = new Set(scopes);
  return required.every((scope) => granted.has(scope));
}

function tokenEncryptionConfigured(): boolean {
  return Boolean(
    process.env.ROLE_ROOM_LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim()
    || process.env.ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
    || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim()
    || process.env.SESSION_SECRET?.trim()
    || process.env.JWT_SECRET?.trim()
    || process.env.AUTH_SECRET?.trim(),
  );
}

function linkedInClientId(): string | null {
  return (
    process.env.LINKEDIN_CLIENT_ID?.trim()
    || process.env.ROLE_ROOM_LINKEDIN_CLIENT_ID?.trim()
    || null
  );
}

function linkedInClientSecret(): string | null {
  return (
    process.env.LINKEDIN_CLIENT_SECRET?.trim()
    || process.env.ROLE_ROOM_LINKEDIN_CLIENT_SECRET?.trim()
    || null
  );
}

export function setupLinkedInOAuthRoutes(deps: LinkedInOAuthRoutesDeps): void {
  const { app, pool, getActiveSession, isAdminEmail } = deps;

  const guard = (req: express.Request, res: express.Response): SessionLike | null => {
    const session = getActiveSession(req);
    if (!session?.userId) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
    if (!isAdminEmail(session.email)) { res.status(403).json({ error: "Admin Room kreves" }); return null; }
    return session;
  };

  const isConfigured = () => Boolean(linkedInClientId() && linkedInClientSecret());

  // ── GET /linkedin/status — er det koblet? ────────────────────────
  app.get("/api/admin-room/cockpit/linkedin/status", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const r = await pool.query(
        `SELECT id::text, organization_urn, vanity_name, display_name, org_type,
                parent_display_name, expires_at, is_default,
                last_publish_at, last_error, last_error_at, scopes, access_token
           FROM linkedin_org_config
          ORDER BY org_type, display_name`,
      );
      const connections = r.rows.map(({ access_token, ...row }) => {
        const scopes = normalizeScopes(row.scopes);
        const expiresAt = new Date(row.expires_at).getTime();
        const tokenReadable = Boolean(readStoredLinkedInToken(access_token));
        const missingScopes = ORGANIZATION_PUBLISH_SCOPES.filter(
          (scope) => !scopes.includes(scope),
        );
        const publishReady =
          tokenEncryptionConfigured()
          &&
          tokenReadable
          && Number.isFinite(expiresAt)
          && expiresAt > Date.now()
          && missingScopes.length === 0;
        return {
          ...row,
          scopes,
          publish_ready: publishReady,
          reconnect_required: !publishReady,
          missing_scopes: missingScopes,
        };
      });
      return res.json({
        configured: isConfigured() && tokenEncryptionConfigured(),
        client_id_set: Boolean(linkedInClientId()),
        client_secret_set: Boolean(linkedInClientSecret()),
        token_encryption_set: tokenEncryptionConfigured(),
        redirect_uri: REDIRECT_URI,
        connections,
      });
    } catch (err) {
      console.error("[linkedin/status]", err);
      return res.status(500).json({ error: "Status feilet" });
    }
  });

  // ── POST /linkedin/oauth-start — mynt en engangs state ───────────
  app.post("/api/admin-room/cockpit/linkedin/oauth-start", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    if (!isConfigured() || !tokenEncryptionConfigured()) {
      return res.status(503).json({
        error: "LinkedIn client-konfig og tokenkryptering må settes på Render først",
      });
    }
    try {
      // Generér state (CSRF-beskyttelse), lagre 15 min
      const state = crypto.randomBytes(24).toString("base64url");
      await pool.query(
        `INSERT INTO linkedin_oauth_states (state, user_id) VALUES ($1, $2)`,
        [state, session.userId],
      );
      // Cleanup gamle states
      await pool.query(`DELETE FROM linkedin_oauth_states WHERE expires_at < now()`);

      const params = new URLSearchParams({
        response_type: "code",
        client_id: linkedInClientId()!,
        redirect_uri: REDIRECT_URI,
        state,
        scope: REQUIRED_SCOPES.join(" "),
      });
      const url = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
      return res.json({ redirect_url: url });
    } catch (err) {
      console.error("[linkedin/oauth-start]", err);
      return res.status(500).json({ error: "OAuth-start feilet" });
    }
  });

  // ── GET /linkedin/oauth-callback — LinkedIn redirecter hit ───────
  app.get("/api/admin-room/cockpit/linkedin/oauth-callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    const state = typeof req.query.state === "string" ? req.query.state.trim() : "";
    const oauthError =
      typeof req.query.error === "string" ? req.query.error.trim() : "";
    if (!state) {
      return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=missing_params`);
    }

    try {
      // State konsumeres atomisk ved enhver callback, også når brukeren avviser
      // samtykke. Dermed kan samme nettleser-state aldri gjenbrukes senere.
      const stateRow = await pool.query(
        `DELETE FROM linkedin_oauth_states
          WHERE state = $1 AND expires_at > now()
          RETURNING user_id`,
        [state],
      );
      if (!stateRow.rowCount) {
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=invalid_state`);
      }
      if (oauthError) {
        return res.redirect(
          `${PUBLIC_URL}/admin-room?linkedin=error&reason=${encodeURIComponent(oauthError)}`,
        );
      }
      if (!code) {
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=missing_params`);
      }
      if (!isConfigured() || !tokenEncryptionConfigured()) {
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=not_configured`);
      }
      const userId = stateRow.rows[0].user_id;

      // Exchange code → access_token
      const tokenForm = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: linkedInClientId()!,
        client_secret: linkedInClientSecret()!,
      });
      const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm.toString(),
        signal: AbortSignal.timeout(20_000),
      });
      if (!tokenResp.ok) {
        const errText = await tokenResp.text().catch(() => "");
        console.error("[linkedin/oauth-callback] token-exchange failed", tokenResp.status, errText);
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=token_exchange`);
      }
      const tokenData = await tokenResp.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
        refresh_token_expires_in?: number;
        scope?: string;
      };

      const accessToken = tokenData.access_token?.trim();
      if (!accessToken || !Number.isFinite(tokenData.expires_in) || tokenData.expires_in <= 0) {
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=invalid_token_response`);
      }
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      const refreshToken = tokenData.refresh_token?.trim() || null;
      const refreshExpiresAt = tokenData.refresh_token_expires_in
        ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
        : null;
      const scopes = normalizeScopes(tokenData.scope);
      const missingScopes = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope));
      if (missingScopes.length > 0) {
        console.warn("[linkedin/oauth-callback] missing scopes", missingScopes);
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=missing_scopes`);
      }

      // ACL- og organisasjonsoppslaget bruker samme versjonerte /rest-klient
      // som publiseringsmotoren. Tom liste er ikke en gyldig kobling for
      // Cockpit, siden denne flyten eksplisitt er sidepublisering.
      const orgs = await listLinkedInCompanies(accessToken);
      if (orgs.length === 0) {
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=no_managed_organizations`);
      }

      const encryptedAccessToken = encryptLinkedInToken(accessToken);
      const encryptedRefreshToken = refreshToken
        ? encryptLinkedInToken(refreshToken)
        : null;
      const orgUrns = orgs.map((org) => org.urn);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existingDefault = await client.query<{ organization_urn: string }>(
          `SELECT organization_urn
             FROM linkedin_org_config
            WHERE is_default = TRUE
              AND organization_urn = ANY($1::text[])
            LIMIT 1`,
          [orgUrns],
        );

        for (const org of orgs) {
          await client.query(
            `INSERT INTO linkedin_org_config (
               organization_urn, vanity_name, display_name, org_type,
               access_token, refresh_token, expires_at, refresh_expires_at,
               scopes, connected_by_user_id, metadata
             ) VALUES (
               $1, $2, $3, 'company',
               $4, $5, $6::timestamptz, $7::timestamptz,
               $8::text[], $9, $10::jsonb
             )
             ON CONFLICT (organization_urn) DO UPDATE SET
               vanity_name = EXCLUDED.vanity_name,
               display_name = EXCLUDED.display_name,
               access_token = EXCLUDED.access_token,
               refresh_token = COALESCE(EXCLUDED.refresh_token, linkedin_org_config.refresh_token),
               expires_at = EXCLUDED.expires_at,
               refresh_expires_at = COALESCE(EXCLUDED.refresh_expires_at, linkedin_org_config.refresh_expires_at),
               scopes = EXCLUDED.scopes,
               connected_by_user_id = EXCLUDED.connected_by_user_id,
               metadata = linkedin_org_config.metadata || EXCLUDED.metadata,
               last_error = NULL,
               last_error_at = NULL`,
            [
              org.urn,
              org.vanityName,
              org.name,
              encryptedAccessToken,
              encryptedRefreshToken,
              expiresAt,
              refreshExpiresAt,
              scopes,
              userId,
              JSON.stringify({ linkedinRole: org.role, logoUrl: org.logoUrl }),
            ],
          );
        }

        const preferredDefault =
          existingDefault.rows[0]?.organization_urn
          ?? orgs.find((org) => /the\s*role\s*room/i.test(org.name ?? ""))?.urn
          ?? orgs[0].urn;
        await client.query("UPDATE linkedin_org_config SET is_default = FALSE");
        await client.query(
          "UPDATE linkedin_org_config SET is_default = TRUE WHERE organization_urn = $1",
          [preferredDefault],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=connected&count=${orgs.length}`);
    } catch (err) {
      console.error("[linkedin/oauth-callback]", err);
      return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=server_error`);
    }
  });

  // ── GET /linkedin/orgs — liste alle koblede orgs ────────────────
  // Brukes av iPad SuperAdminLinkedInCockpitView for å vise hvilke
  // LinkedIn-orgs Daniel har koblet på + hvilken som er default.
  app.get("/api/admin-room/cockpit/linkedin/orgs", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const r = await pool.query<{
        id: string;
        display_name: string | null;
        vanity_name: string | null;
        is_default: boolean;
        connected_at: string;
        organization_urn: string;
        org_type: string;
      }>(
        `SELECT id::text, display_name, vanity_name, is_default,
                connected_at::text, organization_urn, org_type
           FROM linkedin_org_config
          ORDER BY is_default DESC, connected_at DESC`,
      );
      // Match iPad-Codable-modellen LinkedInCockpitOrg
      const orgs = r.rows.map((row) => ({
        id: row.id,
        name: row.display_name || row.organization_urn,
        vanityName: row.vanity_name,
        logoUrl: null,
        isDefault: row.is_default,
        connectedAt: row.connected_at,
      }));
      return res.json({ orgs });
    } catch (err) {
      console.error("[linkedin/orgs GET]", err);
      return res.status(500).json({ error: "Henting feilet" });
    }
  });

  // ── PATCH+POST /linkedin/orgs/:id/default — sett som default ─────
  // iPad-clienten bruker POST (alle action-endepunkter); web bruker PATCH.
  const setLinkedInDefaultHandler = async (req: Request, res: Response) => {
    if (!guard(req, res)) return;
    try {
      const found = await pool.query(
        `SELECT id::text FROM linkedin_org_config WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      if (!found.rowCount) return res.status(404).json({ error: "Konfig ikke funnet" });
      await pool.query(`UPDATE linkedin_org_config SET is_default = FALSE`);
      await pool.query(
        `UPDATE linkedin_org_config SET is_default = TRUE WHERE id = $1::uuid`,
        [req.params.id],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[linkedin/orgs default]", err);
      return res.status(500).json({ error: "Endring feilet" });
    }
  };
  app.patch("/api/admin-room/cockpit/linkedin/orgs/:id/default", setLinkedInDefaultHandler);
  app.post("/api/admin-room/cockpit/linkedin/orgs/:id/default", setLinkedInDefaultHandler);

  // ── DELETE /linkedin/orgs/:id — fjern kobling ───────────────────
  app.delete("/api/admin-room/cockpit/linkedin/orgs/:id", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const r = await pool.query(
        `DELETE FROM linkedin_org_config WHERE id = $1::uuid RETURNING organization_urn`,
        [req.params.id],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Konfig ikke funnet" });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[linkedin/orgs DELETE]", err);
      return res.status(500).json({ error: "Sletting feilet" });
    }
  });

  // ── POST /linkedin/orgs/:id/refresh-token ─────────────────────────
  // Bruker refresh_token til å hente fresh access_token (uten OAuth-redirect)
  app.post("/api/admin-room/cockpit/linkedin/orgs/:id/refresh", async (req, res) => {
    if (!guard(req, res)) return;
    if (!isConfigured() || !tokenEncryptionConfigured()) {
      return res.status(503).json({ error: "LinkedIn-konfig eller tokenkryptering mangler" });
    }
    try {
      const r = await pool.query(
        `SELECT refresh_token, refresh_expires_at FROM linkedin_org_config WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      const row = r.rows[0];
      const refreshToken = readStoredLinkedInToken(row?.refresh_token);
      const refreshExpiresAt = row?.refresh_expires_at
        ? new Date(row.refresh_expires_at).getTime()
        : null;
      if (
        !refreshToken
        || (
          row?.refresh_expires_at
          && (!Number.isFinite(refreshExpiresAt) || Number(refreshExpiresAt) <= Date.now())
        )
      ) {
        return res.status(400).json({ error: "Ingen refresh-token tilgjengelig — kjør OAuth-flow på nytt" });
      }

      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: linkedInClientId()!,
        client_secret: linkedInClientSecret()!,
      });
      const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("[linkedin/orgs refresh] provider rejected", resp.status, errText.slice(0, 400));
        return res.status(502).json({ error: "LinkedIn avviste tokenfornyelsen" });
      }
      const data = await resp.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
        refresh_token_expires_in?: number;
        scope?: string;
      };
      if (
        !data.access_token?.trim()
        || !Number.isFinite(data.expires_in)
        || data.expires_in <= 0
      ) {
        console.error("[linkedin/orgs refresh] invalid provider response");
        return res.status(502).json({ error: "LinkedIn returnerte en ugyldig tokenrespons" });
      }
      const nextScopes = normalizeScopes(data.scope);

      await pool.query(
        `UPDATE linkedin_org_config
            SET access_token = $1,
                refresh_token = COALESCE($2, refresh_token),
                expires_at = $3::timestamptz,
                refresh_expires_at = COALESCE($4::timestamptz, refresh_expires_at),
                scopes = CASE
                  WHEN cardinality($5::text[]) > 0 THEN $5::text[]
                  ELSE scopes
                END,
                last_error = NULL, last_error_at = NULL
          WHERE id = $6::uuid`,
        [
          encryptLinkedInToken(data.access_token),
          data.refresh_token ? encryptLinkedInToken(data.refresh_token) : null,
          new Date(Date.now() + data.expires_in * 1000).toISOString(),
          data.refresh_token_expires_in
            ? new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString()
            : null,
          nextScopes,
          req.params.id,
        ],
      );
      return res.json({ ok: true, expires_in: data.expires_in });
    } catch (err) {
      console.error("[linkedin/orgs refresh]", err);
      return res.status(500).json({ error: "Refresh feilet" });
    }
  });
}

export interface ResolvedLinkedInOrg {
  accessToken: string;
  organizationUrn: string;
  configId: string;
  scopes: string[];
}

/**
 * Resolver en lagret organisasjon og dekrypterer tokenet kun i minnet.
 * En eksplisitt URN må finnes i vår egen konfigurasjon; den kan derfor ikke
 * brukes til å låne standardtokenet til en vilkårlig LinkedIn-side.
 */
export async function resolveLinkedInOrg(
  pool: Pool,
  requestedOrganizationUrn: string | null = null,
): Promise<ResolvedLinkedInOrg | null> {
  const organizationUrn = requestedOrganizationUrn?.trim() || null;
  if (
    organizationUrn
    && !/^urn:li:organization:[A-Za-z0-9_-]+$/.test(organizationUrn)
  ) {
    return null;
  }
  const r = await pool.query(
    `SELECT id::text, organization_urn, access_token, refresh_token,
            expires_at, refresh_expires_at, scopes
       FROM linkedin_org_config
      WHERE (
        ($1::text IS NULL AND is_default = TRUE)
        OR organization_urn = $1::text
      )
      ORDER BY is_default DESC
      LIMIT 1`,
    [organizationUrn],
  );
  const row = r.rows[0];
  if (!row) return null;

  let accessToken = readStoredLinkedInToken(row.access_token);
  let refreshToken = readStoredLinkedInToken(row.refresh_token);
  let scopes = normalizeScopes(row.scopes);
  if (!accessToken || !tokenEncryptionConfigured()) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return null;
  const expiresSoon = expiresAt - Date.now() < 5 * 60 * 1000;
  if (
    expiresSoon
    && refreshToken
    && linkedInClientId()
    && linkedInClientSecret()
  ) {
    try {
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: linkedInClientId()!,
        client_secret: linkedInClientSecret()!,
      });
      const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(20_000),
      });
      if (resp.ok) {
        const data = await resp.json() as {
          access_token?: string;
          expires_in?: number;
          refresh_token?: string;
          refresh_token_expires_in?: number;
          scope?: string;
        };
        if (
          !data.access_token?.trim()
          || !Number.isFinite(data.expires_in)
          || Number(data.expires_in) <= 0
        ) {
          throw new Error("LinkedIn returnerte ugyldig refresh-respons");
        }
        accessToken = data.access_token.trim();
        refreshToken = data.refresh_token?.trim() || refreshToken;
        const refreshedScopes = normalizeScopes(data.scope);
        if (refreshedScopes.length > 0) scopes = refreshedScopes;
        await pool.query(
          `UPDATE linkedin_org_config
              SET access_token = $1,
                  refresh_token = $2,
                  expires_at = $3::timestamptz,
                  refresh_expires_at = COALESCE($4::timestamptz, refresh_expires_at),
                  scopes = $5::text[],
                  last_error = NULL,
                  last_error_at = NULL
            WHERE id = $6::uuid`,
          [
            encryptLinkedInToken(accessToken),
            refreshToken ? encryptLinkedInToken(refreshToken) : null,
            new Date(Date.now() + Number(data.expires_in) * 1000).toISOString(),
            data.refresh_token_expires_in
              ? new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString()
              : null,
            scopes,
            row.id,
          ],
        );
        return {
          accessToken,
          organizationUrn: row.organization_urn,
          configId: row.id,
          scopes,
        };
      }
    } catch (err) {
      console.warn("[linkedin resolve auto-refresh]", err);
    }
  }

  // Et utløpt token må aldri brukes etter en mislykket/umulig refresh.
  if (expiresAt <= Date.now()) return null;

  // Migrer eksisterende klartekst-rader til AES-GCM ved første vellykkede les.
  if (
    !String(row.access_token).startsWith("v1.")
    || (row.refresh_token && !String(row.refresh_token).startsWith("v1."))
  ) {
    await pool.query(
      `UPDATE linkedin_org_config
          SET access_token = $1,
              refresh_token = $2
        WHERE id = $3::uuid`,
      [
        encryptLinkedInToken(accessToken),
        refreshToken ? encryptLinkedInToken(refreshToken) : null,
        row.id,
      ],
    );
  }

  return {
    accessToken,
    organizationUrn: row.organization_urn,
    configId: row.id,
    scopes,
  };
}

export async function resolveDefaultLinkedInOrg(
  pool: Pool,
): Promise<ResolvedLinkedInOrg | null> {
  return resolveLinkedInOrg(pool);
}
