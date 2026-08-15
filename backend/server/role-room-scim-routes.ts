/**
 * role-room-scim-routes.ts
 *
 * Fase 2 (Compliance-veikartet): SCIM 2.0-provisjonering for Role Room
 * enterprise-organisasjoner. Lar en kundes IdP (Okta, Azure AD, …) opprette/
 * deaktivere brukere og synke rolletilhørighet automatisk, i stedet for at
 * en admin gjør det manuelt hver gang noen starter/slutter hos kunden.
 *
 * Gjenbruker organizations (mig 285 + 0451 SAML + 0452 SCIM-kolonner), den
 * delte `users`-tabellen, og den eksisterende userRoles/organizationRoles-
 * RBAC-en (frontend/shared/enterprise-schema.ts) — SCIM oppretter/deaktiverer
 * userRoles-rader, det er ingen egen SCIM-tilgangsmodell. `users` er delt
 * plattform-bredt, så SCIM-spesifikk bokføring (externalId-mapping) lever i
 * en egen role_room_scim_users-tabell, ikke som kolonner på users.
 *
 * Scope for denne biten (bevisst avgrenset, samme disiplin som SAML-filen):
 *   - Users-ressursen er komplett (List/Create/Read/Replace/Patch/Delete).
 *   - Groups-ressursen er KUN lesing (mapper 1:1 til organizationRoles) — IdP
 *     kan liste hvilke roller som finnes, men push av gruppemedlemskap fra
 *     IdP-siden (SCIM group PATCH) støttes ikke ennå. Rolletildeling ved
 *     provisjonering skjer via organizations.scimDefaultRoleId.
 *   - Ingen "guess a role": har organisasjonen ikke satt en default-rolle,
 *     opprettes bruker + mapping, men uten rolletildeling — eksplisitt i
 *     responsen (`roleAssigned: false`), ikke en stille no-op.
 *
 * 9 endpoints:
 *   Admin (requireAdminSession):
 *     - GET  /admin/organizations/:orgId/scim         (les config, aldri klartekst-token)
 *     - PUT  /admin/organizations/:orgId/scim         (aktiver/deaktiver, sett default-rolle)
 *     - POST /admin/organizations/:orgId/scim/rotate-token (generer nytt bearer-token, vises ÉN gang)
 *   SCIM (Authorization: Bearer <org-scim-token>):
 *     - GET    /scim/v2/organizations/:slug/Users
 *     - POST   /scim/v2/organizations/:slug/Users
 *     - GET    /scim/v2/organizations/:slug/Users/:id
 *     - PUT    /scim/v2/organizations/:slug/Users/:id
 *     - PATCH  /scim/v2/organizations/:slug/Users/:id
 *     - DELETE /scim/v2/organizations/:slug/Users/:id
 *     - GET    /scim/v2/organizations/:slug/Groups
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupRoleRoomScimRoutes } from "./role-room-scim-routes.js";
 *
 *   setupRoleRoomScimRoutes({ app, pool, requireAdminSession });
 */

import crypto from "crypto";
import express from "express";
import type { Pool } from "pg";

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
const SCIM_CONTENT_TYPE = "application/scim+json";

interface OrganizationScimRow {
  id: string;
  name: string;
  slug: string | null;
  scim_enabled: boolean;
  scim_bearer_token_hash: string | null;
  scim_bearer_token_hint: string | null;
  scim_default_role_id: string | null;
}

interface ScimUserMappingRow {
  id: string;
  organization_id: string;
  user_id: string;
  external_id: string | null;
  scim_user_name: string;
  active: boolean;
  provisioned_at: string;
  updated_at: string;
}

interface LocalUserRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

function hashScimToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateScimToken(): string {
  return `rr_scim_${crypto.randomBytes(32).toString("hex")}`;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function scimError(res: express.Response, status: number, detail: string): express.Response {
  return res
    .status(status)
    .type(SCIM_CONTENT_TYPE)
    .json({ schemas: [SCIM_ERROR_SCHEMA], status: String(status), detail });
}

interface SetupRoleRoomScimRoutesOptions {
  app: express.Express;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string; loginAt: string } | null;
}

export function setupRoleRoomScimRoutes({
  app,
  pool,
  requireAdminSession,
}: SetupRoleRoomScimRoutesOptions): void {
  async function getOrganizationById(orgId: string): Promise<OrganizationScimRow | null> {
    const result = await pool.query<OrganizationScimRow>(
      `SELECT id, name, slug, scim_enabled, scim_bearer_token_hash, scim_bearer_token_hint, scim_default_role_id
       FROM organizations WHERE id = $1 LIMIT 1`,
      [orgId],
    );
    return result.rows[0] ?? null;
  }

  async function getOrganizationBySlug(slug: string): Promise<OrganizationScimRow | null> {
    const result = await pool.query<OrganizationScimRow>(
      `SELECT id, name, slug, scim_enabled, scim_bearer_token_hash, scim_bearer_token_hint, scim_default_role_id
       FROM organizations WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    return result.rows[0] ?? null;
  }

  function scimUserResource(
    mapping: ScimUserMappingRow,
    user: LocalUserRow,
    req: express.Request,
    orgSlug: string,
  ): Record<string, unknown> {
    const location = `${req.protocol}://${req.get("host")}/api/role-room/scim/v2/organizations/${orgSlug}/Users/${mapping.id}`;
    return {
      schemas: [SCIM_USER_SCHEMA],
      id: mapping.id,
      externalId: mapping.external_id ?? undefined,
      userName: mapping.scim_user_name,
      name: {
        givenName: user.first_name ?? undefined,
        familyName: user.last_name ?? undefined,
      },
      emails: [{ value: user.email, primary: true }],
      active: mapping.active,
      meta: {
        resourceType: "User",
        created: mapping.provisioned_at,
        lastModified: mapping.updated_at,
        location,
      },
    };
  }

  // ── SCIM bearer-token-auth: én token per organisasjon (hashet, sha256) ──
  async function requireScimOrg(
    req: express.Request,
    res: express.Response,
  ): Promise<OrganizationScimRow | null> {
    const orgSlug = req.params.slug;
    const org = await getOrganizationBySlug(orgSlug);
    if (!org || !org.scim_enabled || !org.scim_bearer_token_hash) {
      scimError(res, 404, "SCIM er ikke aktivert for denne organisasjonen.");
      return null;
    }
    const authHeader = readStringValue(req.headers.authorization);
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
    if (!bearerToken) {
      scimError(res, 401, "Mangler Authorization: Bearer <token>.");
      return null;
    }
    const providedHash = hashScimToken(bearerToken);
    const expected = Buffer.from(org.scim_bearer_token_hash, "hex");
    const provided = Buffer.from(providedHash, "hex");
    const valid = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
    if (!valid) {
      scimError(res, 401, "Ugyldig SCIM-token.");
      return null;
    }
    return org;
  }

  // ── Admin: SCIM config + token-rotasjon ─────────────────────────────────

  app.get("/api/role-room/admin/organizations/:orgId/scim", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const org = await getOrganizationById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, error: "Organisasjon ikke funnet." });
    return res.json({
      success: true,
      scim: {
        enabled: org.scim_enabled,
        tokenHint: org.scim_bearer_token_hint ? `…${org.scim_bearer_token_hint}` : null,
        defaultRoleId: org.scim_default_role_id,
        scimBaseUrl: org.slug ? `/api/role-room/scim/v2/organizations/${org.slug}` : null,
      },
    });
  });

  app.put("/api/role-room/admin/organizations/:orgId/scim", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const org = await getOrganizationById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, error: "Organisasjon ikke funnet." });
    if (!org.slug) {
      return res.status(400).json({
        success: false,
        error: "Organisasjonen mangler en slug — kan ikke konfigurere SCIM uten en stabil base-URL.",
      });
    }

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const enabled = typeof body.enabled === "boolean" ? body.enabled : org.scim_enabled;
    const defaultRoleId =
      typeof body.defaultRoleId === "string" && body.defaultRoleId.trim()
        ? body.defaultRoleId.trim()
        : body.defaultRoleId === null
          ? null
          : org.scim_default_role_id;

    if (enabled && !org.scim_bearer_token_hash) {
      return res.status(400).json({
        success: false,
        error: "Generer et SCIM-token (POST .../scim/rotate-token) før SCIM kan aktiveres.",
      });
    }

    try {
      await pool.query(
        `UPDATE organizations
         SET scim_enabled = $2, scim_default_role_id = $3, updated_at = NOW()
         WHERE id = $1`,
        [org.id, enabled, defaultRoleId],
      );
      return res.json({ success: true });
    } catch (err) {
      console.error(`[scim-admin] update config threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke oppdatere SCIM-konfigurasjon." });
    }
  });

  app.post("/api/role-room/admin/organizations/:orgId/scim/rotate-token", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const org = await getOrganizationById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, error: "Organisasjon ikke funnet." });

    const plaintextToken = generateScimToken();
    const tokenHash = hashScimToken(plaintextToken);
    const tokenHint = plaintextToken.slice(-8);
    try {
      await pool.query(
        `UPDATE organizations
         SET scim_bearer_token_hash = $2, scim_bearer_token_hint = $3, scim_token_rotated_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [org.id, tokenHash, tokenHint],
      );
      // Vises ÉN gang — vi lagrer kun hashen, ikke klartekst-tokenet.
      return res.json({ success: true, token: plaintextToken, tokenHint });
    } catch (err) {
      console.error(`[scim-admin] rotate token threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke generere nytt SCIM-token." });
    }
  });

  // ── SCIM: Users ──────────────────────────────────────────────────────────

  const scimJson = express.json({ type: [SCIM_CONTENT_TYPE, "application/json"] });

  app.get("/api/role-room/scim/v2/organizations/:slug/Users", async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;

    const startIndex = Math.max(1, parseInt(String(req.query.startIndex ?? "1"), 10) || 1);
    const count = Math.min(200, Math.max(1, parseInt(String(req.query.count ?? "100"), 10) || 100));

    // Minimal filter-støtte: `userName eq "x@y.com"` — det eneste IdP-er
    // faktisk sender i praksis for duplikat-sjekk før provisjonering.
    const filter = readStringValue(req.query.filter);
    const filterMatch = filter?.match(/^userName eq "([^"]+)"$/i);

    try {
      const params: unknown[] = [org.id];
      let where = "m.organization_id = $1";
      if (filterMatch) {
        params.push(filterMatch[1].toLowerCase());
        where += ` AND LOWER(m.scim_user_name) = $${params.length}`;
      }
      const totalResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM role_room_scim_users m WHERE ${where}`,
        params,
      );
      const total = parseInt(totalResult.rows[0]?.count ?? "0", 10);

      params.push(count, startIndex - 1);
      const result = await pool.query<ScimUserMappingRow & LocalUserRow>(
        `SELECT m.id, m.organization_id, m.user_id, m.external_id, m.scim_user_name, m.active,
                m.provisioned_at, m.updated_at, u.id AS user_id, u.email, u.first_name, u.last_name
         FROM role_room_scim_users m
         JOIN users u ON u.id::text = m.user_id
         WHERE ${where}
         ORDER BY m.provisioned_at ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );

      const resources = result.rows.map((row) =>
        scimUserResource(row, row, req, org.slug ?? req.params.slug),
      );
      return res.type(SCIM_CONTENT_TYPE).json({
        schemas: [SCIM_LIST_SCHEMA],
        totalResults: total,
        startIndex,
        itemsPerPage: resources.length,
        Resources: resources,
      });
    } catch (err) {
      console.error(`[scim] list users threw: ${err instanceof Error ? err.message : String(err)}`);
      return scimError(res, 500, "Kunne ikke hente brukere.");
    }
  });

  app.post("/api/role-room/scim/v2/organizations/:slug/Users", scimJson, async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const userName = readStringValue(body.userName);
    const emails = Array.isArray(body.emails) ? (body.emails as Array<Record<string, unknown>>) : [];
    const primaryEmail =
      readStringValue(emails.find((e) => e.primary)?.value) ??
      readStringValue(emails[0]?.value) ??
      userName;
    const name = (body.name && typeof body.name === "object" ? body.name : {}) as Record<string, unknown>;
    const active = typeof body.active === "boolean" ? body.active : true;
    const externalId = readStringValue(body.externalId);

    if (!userName || !primaryEmail) {
      return scimError(res, 400, "userName (eller emails[0].value) er påkrevd.");
    }
    const normalizedEmail = primaryEmail.trim().toLowerCase();

    try {
      // Finn eller opprett den underliggende, plattform-delte brukeren.
      const existing = await pool.query<LocalUserRow>(
        `SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [normalizedEmail],
      );
      let localUser = existing.rows[0] as LocalUserRow | undefined;
      if (!localUser) {
        const usernameBase =
          normalizedEmail.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 48) ||
          "role-room-user";
        // Samme mønster som ensureRoleRoomUserByEmail (Google-login) i
        // role-room-routes.ts: id/created_at/updated_at får DB-default, og
        // passordfeltet er en bcrypt-hash av en tilfeldig verdi — SCIM-
        // provisjonerte brukere logger inn via SAML, aldri passord.
        const bcrypt = await import("bcrypt");
        const placeholderPassword = await bcrypt.default.hash(
          crypto.randomBytes(64).toString("base64"),
          10,
        );
        const created = await pool.query<LocalUserRow>(
          `INSERT INTO users (email, username, first_name, last_name, role, password, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'user', $5, NOW(), NOW())
           RETURNING id, email, first_name, last_name`,
          [
            normalizedEmail,
            `${usernameBase}-${crypto.randomBytes(4).toString("hex")}`,
            readStringValue(name.givenName) ?? null,
            readStringValue(name.familyName) ?? null,
            placeholderPassword,
          ],
        );
        localUser = created.rows[0];
      }

      const mappingResult = await pool.query<ScimUserMappingRow>(
        `INSERT INTO role_room_scim_users (organization_id, user_id, external_id, scim_user_name, active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, scim_user_name)
         DO UPDATE SET external_id = EXCLUDED.external_id, active = EXCLUDED.active, updated_at = NOW()
         RETURNING id, organization_id, user_id, external_id, scim_user_name, active, provisioned_at, updated_at`,
        [org.id, localUser.id, externalId ?? null, userName, active],
      );
      const mapping = mappingResult.rows[0];

      let roleAssigned = false;
      if (org.scim_default_role_id) {
        await pool.query(
          `INSERT INTO user_roles (user_id, role_id, organization_id, assigned_by, is_active)
           VALUES ($1, $2, $3, 'scim', $4)
           ON CONFLICT DO NOTHING`,
          [localUser.id, org.scim_default_role_id, org.id, active],
        );
        roleAssigned = true;
      }

      const resource = scimUserResource(mapping, localUser, req, org.slug ?? req.params.slug);
      return res.status(201).type(SCIM_CONTENT_TYPE).json({ ...resource, roleAssigned });
    } catch (err) {
      console.error(`[scim] create user threw: ${err instanceof Error ? err.message : String(err)}`);
      return scimError(res, 500, "Kunne ikke provisjonere bruker.");
    }
  });

  async function loadMapping(orgId: string, mappingId: string) {
    const result = await pool.query<ScimUserMappingRow & LocalUserRow>(
      `SELECT m.id, m.organization_id, m.user_id, m.external_id, m.scim_user_name, m.active,
              m.provisioned_at, m.updated_at, u.id AS user_id, u.email, u.first_name, u.last_name
       FROM role_room_scim_users m
       JOIN users u ON u.id::text = m.user_id
       WHERE m.organization_id = $1 AND m.id = $2
       LIMIT 1`,
      [orgId, mappingId],
    );
    return result.rows[0] ?? null;
  }

  app.get("/api/role-room/scim/v2/organizations/:slug/Users/:id", async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;
    const row = await loadMapping(org.id, req.params.id);
    if (!row) return scimError(res, 404, "Bruker ikke funnet.");
    return res.type(SCIM_CONTENT_TYPE).json(scimUserResource(row, row, req, org.slug ?? req.params.slug));
  });

  async function setMappingActive(orgId: string, mappingId: string, active: boolean): Promise<boolean> {
    const result = await pool.query(
      `UPDATE role_room_scim_users SET active = $3, updated_at = NOW()
       WHERE organization_id = $1 AND id = $2`,
      [orgId, mappingId, active],
    );
    // Deprovisjonering: deaktiver org-rolletildelingen(e), ikke slett dem —
    // gjør re-aktivering (bruker kommer tilbake) reversibel uten å miste historikk.
    await pool.query(
      `UPDATE user_roles ur SET is_active = $3, updated_at = NOW()
       FROM role_room_scim_users m
       WHERE m.organization_id = $1 AND m.id = $2
         AND ur.user_id = m.user_id AND ur.organization_id::text = $1::text`,
      [orgId, mappingId, active],
    );
    return (result.rowCount ?? 0) > 0;
  }

  app.put("/api/role-room/scim/v2/organizations/:slug/Users/:id", scimJson, async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;
    const row = await loadMapping(org.id, req.params.id);
    if (!row) return scimError(res, 404, "Bruker ikke funnet.");

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const active = typeof body.active === "boolean" ? body.active : row.active;
    const name = (body.name && typeof body.name === "object" ? body.name : {}) as Record<string, unknown>;

    try {
      await pool.query(
        `UPDATE users SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name)
         WHERE id::text = $1`,
        [row.user_id, readStringValue(name.givenName) ?? null, readStringValue(name.familyName) ?? null],
      );
      await setMappingActive(org.id, row.id, active);
      const updated = await loadMapping(org.id, row.id);
      if (!updated) return scimError(res, 404, "Bruker ikke funnet.");
      return res.type(SCIM_CONTENT_TYPE).json(scimUserResource(updated, updated, req, org.slug ?? req.params.slug));
    } catch (err) {
      console.error(`[scim] replace user threw: ${err instanceof Error ? err.message : String(err)}`);
      return scimError(res, 500, "Kunne ikke oppdatere bruker.");
    }
  });

  app.patch("/api/role-room/scim/v2/organizations/:slug/Users/:id", scimJson, async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;
    const row = await loadMapping(org.id, req.params.id);
    if (!row) return scimError(res, 404, "Bruker ikke funnet.");

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const operations = Array.isArray(body.Operations) ? (body.Operations as Array<Record<string, unknown>>) : [];

    try {
      for (const operation of operations) {
        const op = readStringValue(operation.op)?.toLowerCase();
        const path = readStringValue(operation.path)?.toLowerCase();
        if (op === "replace" && (path === "active" || (!path && typeof (operation.value as any)?.active === "boolean"))) {
          const value =
            typeof operation.value === "boolean"
              ? operation.value
              : Boolean((operation.value as Record<string, unknown> | undefined)?.active);
          await setMappingActive(org.id, row.id, value);
        }
      }
      const updated = await loadMapping(org.id, row.id);
      if (!updated) return scimError(res, 404, "Bruker ikke funnet.");
      return res.type(SCIM_CONTENT_TYPE).json(scimUserResource(updated, updated, req, org.slug ?? req.params.slug));
    } catch (err) {
      console.error(`[scim] patch user threw: ${err instanceof Error ? err.message : String(err)}`);
      return scimError(res, 500, "Kunne ikke oppdatere bruker.");
    }
  });

  app.delete("/api/role-room/scim/v2/organizations/:slug/Users/:id", async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;
    const row = await loadMapping(org.id, req.params.id);
    if (!row) return scimError(res, 404, "Bruker ikke funnet.");
    try {
      // Deprovisjoner (deaktiver rolletildeling), IKKE slett den underliggende
      // brukeren — users er delt plattform-bredt, personen kan ha tilgang
      // utenfor denne organisasjonen.
      await setMappingActive(org.id, row.id, false);
      return res.status(204).send();
    } catch (err) {
      console.error(`[scim] delete user threw: ${err instanceof Error ? err.message : String(err)}`);
      return scimError(res, 500, "Kunne ikke deprovisjonere bruker.");
    }
  });

  // ── SCIM: Groups (kun lesing — se filhode for scope-avgrensning) ────────

  app.get("/api/role-room/scim/v2/organizations/:slug/Groups", async (req, res) => {
    const org = await requireScimOrg(req, res);
    if (!org) return;
    try {
      const result = await pool.query<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM organization_roles WHERE is_active = TRUE ORDER BY display_name ASC`,
      );
      const resources = result.rows.map((role) => ({
        schemas: [SCIM_GROUP_SCHEMA],
        id: role.id,
        displayName: role.display_name,
      }));
      return res.type(SCIM_CONTENT_TYPE).json({
        schemas: [SCIM_LIST_SCHEMA],
        totalResults: resources.length,
        startIndex: 1,
        itemsPerPage: resources.length,
        Resources: resources,
      });
    } catch (err) {
      console.error(`[scim] list groups threw: ${err instanceof Error ? err.message : String(err)}`);
      return scimError(res, 500, "Kunne ikke hente grupper.");
    }
  });
}
