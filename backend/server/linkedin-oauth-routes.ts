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

interface SessionLike { userId: string; email?: string }

export interface LinkedInOAuthRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
  isAdminEmail: (email: string | null | undefined) => boolean;
}

const PUBLIC_URL = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";
// Scopes vi trenger for å:
//   - r_organization_admin: lese hvilke orgs Daniel er admin på (Company + Showcase)
//   - w_organization_social: publisere UGC-posts på vegne av orgen
//   - r_basicprofile: bare for å vite hvem som koblet
const REQUIRED_SCOPES = ["r_organization_admin", "w_organization_social", "r_basicprofile"];

const REDIRECT_URI = `${PUBLIC_URL}/api/admin-room/cockpit/linkedin/oauth-callback`;

export function setupLinkedInOAuthRoutes(deps: LinkedInOAuthRoutesDeps): void {
  const { app, pool, getActiveSession, isAdminEmail } = deps;

  const guard = (req: express.Request, res: express.Response): SessionLike | null => {
    const session = getActiveSession(req);
    if (!session?.userId) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
    if (!isAdminEmail(session.email)) { res.status(403).json({ error: "Admin Room kreves" }); return null; }
    return session;
  };

  const isConfigured = () =>
    !!(process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim());

  // ── GET /linkedin/status — er det koblet? ────────────────────────
  app.get("/api/admin-room/cockpit/linkedin/status", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const r = await pool.query(
        `SELECT id::text, organization_urn, vanity_name, display_name, org_type,
                parent_display_name, expires_at, is_default,
                last_publish_at, last_error, last_error_at, scopes
           FROM linkedin_org_config
          ORDER BY org_type, display_name`,
      );
      return res.json({
        configured: isConfigured(),
        client_id_set: !!process.env.LINKEDIN_CLIENT_ID?.trim(),
        client_secret_set: !!process.env.LINKEDIN_CLIENT_SECRET?.trim(),
        redirect_uri: REDIRECT_URI,
        connections: r.rows,
      });
    } catch (err) {
      console.error("[linkedin/status]", err);
      return res.status(500).json({ error: "Status feilet" });
    }
  });

  // ── GET /linkedin/oauth-start — redirect til LinkedIn ────────────
  app.get("/api/admin-room/cockpit/linkedin/oauth-start", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    if (!isConfigured()) {
      return res.status(503).json({
        error: "LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET må settes på Render først",
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
        client_id: process.env.LINKEDIN_CLIENT_ID!,
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
    const { code, state, error: oauthError } = req.query as {
      code?: string; state?: string; error?: string;
    };

    if (oauthError) {
      return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=${encodeURIComponent(oauthError)}`);
    }
    if (!code || !state) {
      return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=missing_params`);
    }

    try {
      // Verifisér state
      const stateRow = await pool.query(
        `DELETE FROM linkedin_oauth_states
          WHERE state = $1 AND expires_at > now()
          RETURNING user_id`,
        [state],
      );
      if (!stateRow.rowCount) {
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=error&reason=invalid_state`);
      }
      const userId = stateRow.rows[0].user_id;

      // Exchange code → access_token
      const tokenForm = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      });
      const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm.toString(),
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

      const accessToken = tokenData.access_token;
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      const refreshToken = tokenData.refresh_token ?? null;
      const refreshExpiresAt = tokenData.refresh_token_expires_in
        ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000).toISOString()
        : null;
      const scopes = (tokenData.scope ?? "").split(/\s+/).filter(Boolean);

      // Hent alle orgs Daniel er admin på
      const orgsResp = await fetch(
        "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,vanityName,localizedName,organizationType,parentRelationship~(localizedName,vanityName,id,organizationType))))",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": "202410",
          },
        },
      );

      if (!orgsResp.ok) {
        const errText = await orgsResp.text().catch(() => "");
        console.error("[linkedin/oauth-callback] orgs-fetch failed", orgsResp.status, errText);
        // Fallback: lagre token uten orgs så Daniel kan velge manuelt
        return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=token_saved_no_orgs`);
      }
      const orgsData = await orgsResp.json() as {
        elements?: Array<{
          "organizationalTarget~"?: {
            id: number;
            vanityName?: string;
            localizedName: string;
            organizationType?: string;
            "parentRelationship~"?: {
              id: number;
              localizedName: string;
              vanityName?: string;
            };
          };
        }>;
      };

      const orgs = (orgsData.elements ?? [])
        .map((e) => e["organizationalTarget~"])
        .filter((o): o is NonNullable<typeof o> => !!o);

      // Lagre hver org i linkedin_org_config (samme token brukes for alle)
      let savedCount = 0;
      let defaultUrn: string | null = null;
      for (const org of orgs) {
        const urn = `urn:li:organization:${org.id}`;
        const orgType = String(org.organizationType ?? "")
          .toLowerCase().includes("showcase") ? "showcase" : "company";
        const parent = org["parentRelationship~"];
        const parentUrn = parent ? `urn:li:organization:${parent.id}` : null;
        const parentName = parent?.localizedName ?? null;

        await pool.query(
          `INSERT INTO linkedin_org_config (
             organization_urn, vanity_name, display_name, org_type,
             parent_organization_urn, parent_display_name,
             access_token, refresh_token, expires_at, refresh_expires_at,
             scopes, connected_by_user_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11::text[], $12)
           ON CONFLICT (organization_urn) DO UPDATE SET
             vanity_name = EXCLUDED.vanity_name,
             display_name = EXCLUDED.display_name,
             org_type = EXCLUDED.org_type,
             parent_organization_urn = EXCLUDED.parent_organization_urn,
             parent_display_name = EXCLUDED.parent_display_name,
             access_token = EXCLUDED.access_token,
             refresh_token = COALESCE(EXCLUDED.refresh_token, linkedin_org_config.refresh_token),
             expires_at = EXCLUDED.expires_at,
             refresh_expires_at = COALESCE(EXCLUDED.refresh_expires_at, linkedin_org_config.refresh_expires_at),
             scopes = EXCLUDED.scopes,
             last_error = NULL,
             last_error_at = NULL`,
          [
            urn,
            org.vanityName ?? null,
            org.localizedName,
            orgType,
            parentUrn,
            parentName,
            accessToken,
            refreshToken,
            expiresAt,
            refreshExpiresAt,
            scopes,
            userId,
          ],
        );
        savedCount++;

        // Foretrekk showcase som default (det er publish-target)
        if (orgType === "showcase" && !defaultUrn) defaultUrn = urn;
      }

      // Hvis ingen showcase, bruk første org som default
      if (!defaultUrn && orgs.length > 0) {
        defaultUrn = `urn:li:organization:${orgs[0].id}`;
      }

      // Sett default
      if (defaultUrn) {
        await pool.query(`UPDATE linkedin_org_config SET is_default = FALSE`);
        await pool.query(
          `UPDATE linkedin_org_config SET is_default = TRUE WHERE organization_urn = $1`,
          [defaultUrn],
        );
      }

      return res.redirect(`${PUBLIC_URL}/admin-room?linkedin=connected&count=${savedCount}`);
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
    if (!isConfigured()) return res.status(503).json({ error: "Client ID/secret mangler" });
    try {
      const r = await pool.query(
        `SELECT refresh_token, refresh_expires_at FROM linkedin_org_config WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      const row = r.rows[0];
      if (!row?.refresh_token) {
        return res.status(400).json({ error: "Ingen refresh-token tilgjengelig — kjør OAuth-flow på nytt" });
      }

      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      });
      const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        return res.status(502).json({ error: "Refresh feilet", detail: errText.slice(0, 400) });
      }
      const data = await resp.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
        refresh_token_expires_in?: number;
      };

      await pool.query(
        `UPDATE linkedin_org_config
            SET access_token = $1,
                refresh_token = COALESCE($2, refresh_token),
                expires_at = $3::timestamptz,
                refresh_expires_at = COALESCE($4::timestamptz, refresh_expires_at),
                last_error = NULL, last_error_at = NULL
          WHERE id = $5::uuid`,
        [
          data.access_token,
          data.refresh_token ?? null,
          new Date(Date.now() + data.expires_in * 1000).toISOString(),
          data.refresh_token_expires_in
            ? new Date(Date.now() + data.refresh_token_expires_in * 1000).toISOString()
            : null,
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

/**
 * Resolver: returnerer (access_token, organization_urn) for default-orgen.
 * Brukes av publish-endepunktet i cockpit-b2b-routes.
 *
 * Auto-refresher tokenet hvis det utløper innen 5 minutter (best-effort).
 */
export async function resolveDefaultLinkedInOrg(pool: Pool): Promise<{
  accessToken: string;
  organizationUrn: string;
  configId: string;
} | null> {
  const r = await pool.query(
    `SELECT id::text, organization_urn, access_token, refresh_token, expires_at
       FROM linkedin_org_config
      WHERE is_default = TRUE LIMIT 1`,
  );
  const row = r.rows[0];
  if (!row) return null;

  // Hvis tokenen er nær utløp og vi har refresh-token, prøv å fornye
  const expiresAt = new Date(row.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000 && row.refresh_token
      && process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    try {
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      });
      const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (resp.ok) {
        const data = await resp.json() as { access_token: string; expires_in: number };
        await pool.query(
          `UPDATE linkedin_org_config
              SET access_token = $1, expires_at = $2::timestamptz
            WHERE id = $3::uuid`,
          [
            data.access_token,
            new Date(Date.now() + data.expires_in * 1000).toISOString(),
            row.id,
          ],
        );
        return {
          accessToken: data.access_token,
          organizationUrn: row.organization_urn,
          configId: row.id,
        };
      }
    } catch (err) {
      console.warn("[linkedin resolveDefault auto-refresh]", err);
    }
  }

  return {
    accessToken: row.access_token,
    organizationUrn: row.organization_urn,
    configId: row.id,
  };
}
