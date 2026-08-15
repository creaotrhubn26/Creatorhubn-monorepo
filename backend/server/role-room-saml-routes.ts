/**
 * role-room-saml-routes.ts
 *
 * Fase 1 (Compliance-veikartet): SAML 2.0 SP-integrasjon for Role Room
 * enterprise-organisasjoner. Lar en kundes IdP (Okta, Azure AD, Google
 * Workspace, …) logge brukere rett inn i Role Room i stedet for
 * Google/Microsoft-OAuth.
 *
 * Gjenbruker den eksisterende `organizations`-tabellen (migrasjon 285,
 * Lead Map/Leadgrid) — utvidet i migrasjon 0451 med per-org SAML IdP-
 * konfigurasjon — og det eksisterende bearer-token-sesjonssystemet
 * (activeSessions-Map + creatorhub_auth_sessions, se auth-session-store.ts).
 * Ingen cookies, ingen Passport — samme mønster som Google-login i
 * role-room-routes.ts.
 *
 * Scope for denne første biten (bevisst avgrenset):
 *   - SP-initiert login (bruker starter fra Role Room, ikke fra IdP-portalen).
 *     IdP-initiert POST rett til ACS uten forutgående /login støttes IKKE ennå.
 *   - Krever at brukeren allerede finnes i `users` (matchet på e-post fra
 *     SAML-assertion). Auto-provisjonering av nye brukere er SCIM sin jobb
 *     (Fase 2) — logges som en tydelig feil her, ikke en stille auto-create.
 *   - Én IdP per organisasjon (ikke IdP-discovery/multi-IdP-routing).
 *
 * 6 endpoints:
 *   Admin (requireAdminSession):
 *     - GET    /admin/organizations              (list orgs + SAML-status)
 *     - POST   /admin/organizations               (opprett org)
 *     - GET    /admin/organizations/:orgId/saml    (les IdP-config)
 *     - PUT    /admin/organizations/:orgId/saml    (sett/oppdater IdP-config)
 *   Public (IdP-vendt):
 *     - GET    /organizations/:slug/saml/metadata  (SP-metadata XML)
 *     - GET    /organizations/:slug/saml/login     (bygg AuthnRequest, redirect til IdP)
 *     - POST   /organizations/:slug/saml/acs       (Assertion Consumer Service)
 *     - GET    /organizations/:slug/saml/transfer/:transferId (engangsbytte transferId → sessionToken)
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupRoleRoomSamlRoutes } from "./role-room-saml-routes.js";
 *
 *   setupRoleRoomSamlRoutes({ app, pool, requireAdminSession, activeSessions });
 */

import crypto from "crypto";
import express from "express";
import type { Pool } from "pg";
import { SAML } from "@node-saml/node-saml";

import { persistAuthSession } from "./auth-session-store.js";

const ROLE_ROOM_CANONICAL_PATH = "/theroleroom";
const SAML_LOGIN_FLOW_TTL_MS = 10 * 60 * 1000; // 10 min — tid nok til å fullføre IdP-innlogging
const SAML_TRANSFER_TTL_MS = 5 * 60 * 1000; // 5 min — kort levetid, engangsbruk

interface OrganizationSamlRow {
  id: string;
  name: string;
  slug: string | null;
  saml_enabled: boolean;
  saml_idp_entity_id: string | null;
  saml_idp_sso_url: string | null;
  saml_idp_certificate: string | null;
  saml_sp_entity_id: string | null;
  saml_want_assertions_signed: boolean;
}

interface SamlLoginFlowState {
  orgSlug: string;
  returnPath: string;
  browserOrigin: string | null;
  expiresAt: number;
}

interface SamlSessionTransfer {
  sessionToken: string;
  user: { id: string; email: string; name: string; role: string; organizationId: string };
  expiresAt: number;
}

// Minimal shape of the bearer-token session we mint — matches
// ActiveSessionData in index.ts structurally (that type isn't exported,
// so we duplicate the fields we set, same as the Google-login flow does
// via its own narrower `SessionData` type in role-room-routes.ts).
interface RoleRoomSamlSessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  displayName?: string;
  loginAt: string;
  organizationId?: string;
  [key: string]: unknown;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function appendQueryParamsToPath(
  pathname: string,
  params: Record<string, string | null | undefined>,
): string {
  const safePath = pathname.trim().length > 0 ? pathname : ROLE_ROOM_CANONICAL_PATH;
  const [pathOnly, hashPart = ""] = safePath.split("#", 2);
  const [basePath, queryString = ""] = pathOnly.split("?", 2);
  const searchParams = new URLSearchParams(queryString);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      searchParams.delete(key);
      return;
    }
    searchParams.set(key, value);
  });
  const nextQuery = searchParams.toString();
  return `${basePath}${nextQuery ? `?${nextQuery}` : ""}${hashPart ? `#${hashPart}` : ""}`;
}

function buildReturnUrl(
  returnPath: string,
  params: Record<string, string | null | undefined>,
  browserOrigin: string | null,
): string {
  const nextPath = appendQueryParamsToPath(returnPath, params);
  if (browserOrigin && nextPath.startsWith("/")) {
    return `${browserOrigin}${nextPath}`;
  }
  return nextPath;
}

interface SetupRoleRoomSamlRoutesOptions {
  app: express.Express;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string; loginAt: string } | null;
  // Loosely typed on purpose: the caller's activeSessions Map is keyed to a
  // broader ActiveSessionData shape (index.ts) that this file doesn't import
  // to stay self-contained (same convention as role-room-social-meta-routes.ts).
  activeSessions: Map<string, Record<string, unknown>>;
}

export function setupRoleRoomSamlRoutes({
  app,
  pool,
  requireAdminSession,
  activeSessions,
}: SetupRoleRoomSamlRoutesOptions): void {
  // In-memory, short-lived state for the SP-initiated flow. Both maps are
  // best-effort (not DB-persisted) — a pod restart mid-login just means the
  // user retries /saml/login, same failure mode as a network hiccup.
  const loginFlows = new Map<string, SamlLoginFlowState>();
  const sessionTransfers = new Map<string, SamlSessionTransfer>();

  function purgeExpired<T extends { expiresAt: number }>(map: Map<string, T>): void {
    const now = Date.now();
    for (const [key, value] of map.entries()) {
      if (value.expiresAt < now) map.delete(key);
    }
  }

  async function getOrganizationBySlug(slug: string): Promise<OrganizationSamlRow | null> {
    const result = await pool.query<OrganizationSamlRow>(
      `SELECT id, name, slug, saml_enabled, saml_idp_entity_id, saml_idp_sso_url,
              saml_idp_certificate, saml_sp_entity_id, saml_want_assertions_signed
       FROM organizations
       WHERE slug = $1
       LIMIT 1`,
      [slug],
    );
    return result.rows[0] ?? null;
  }

  async function getOrganizationById(orgId: string): Promise<OrganizationSamlRow | null> {
    const result = await pool.query<OrganizationSamlRow>(
      `SELECT id, name, slug, saml_enabled, saml_idp_entity_id, saml_idp_sso_url,
              saml_idp_certificate, saml_sp_entity_id, saml_want_assertions_signed
       FROM organizations
       WHERE id = $1
       LIMIT 1`,
      [orgId],
    );
    return result.rows[0] ?? null;
  }

  async function findUserByEmail(
    email: string,
  ): Promise<{ userId: string; email: string; name: string; role: string } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      `SELECT id, email, username, first_name, last_name, role
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      userId: String(row.id),
      email: readStringValue(row.email) ?? normalizedEmail,
      name:
        [readStringValue(row.first_name), readStringValue(row.last_name)]
          .filter((value): value is string => Boolean(value))
          .join(" ") ||
        readStringValue(row.username) ||
        normalizedEmail.split("@")[0] ||
        "Role Room",
      role: readStringValue(row.role)?.toLowerCase() ?? "user",
    };
  }

  function buildSamlClient(org: OrganizationSamlRow, req: express.Request): SAML {
    if (!org.saml_idp_certificate || !org.saml_idp_sso_url) {
      throw new Error("SAML er ikke konfigurert for denne organisasjonen.");
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const spEntityId =
      org.saml_sp_entity_id || `${baseUrl}/api/role-room/organizations/${org.slug}/saml/metadata`;
    return new SAML({
      idpCert: org.saml_idp_certificate,
      entryPoint: org.saml_idp_sso_url,
      issuer: spEntityId,
      callbackUrl: `${baseUrl}/api/role-room/organizations/${org.slug}/saml/acs`,
      identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      wantAssertionsSigned: org.saml_want_assertions_signed,
      audience: spEntityId,
    });
  }

  // ── Admin: organizations + SAML config ─────────────────────────────────

  app.get("/api/role-room/admin/organizations", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const result = await pool.query(
        `SELECT id, name, slug, org_type, status, saml_enabled
         FROM organizations
         ORDER BY name ASC`,
      );
      return res.json({ success: true, organizations: result.rows });
    } catch (err) {
      console.error(`[saml-admin] list orgs threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke hente organisasjoner." });
    }
  });

  app.post("/api/role-room/admin/organizations", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!name || !slug || !/^[a-z0-9-]{2,80}$/.test(slug)) {
      return res.status(400).json({
        success: false,
        error: "name og slug (kun a-z, 0-9, bindestrek) er påkrevd.",
      });
    }
    try {
      const result = await pool.query(
        `INSERT INTO organizations (name, slug, org_type)
         VALUES ($1, $2, 'customer')
         RETURNING id, name, slug, org_type, status, saml_enabled`,
        [name, slug],
      );
      return res.status(201).json({ success: true, organization: result.rows[0] });
    } catch (err) {
      if (err instanceof Error && /duplicate key/i.test(err.message)) {
        return res.status(409).json({ success: false, error: "Slug er allerede i bruk." });
      }
      console.error(`[saml-admin] create org threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke opprette organisasjon." });
    }
  });

  app.get("/api/role-room/admin/organizations/:orgId/saml", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const org = await getOrganizationById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, error: "Organisasjon ikke funnet." });
    return res.json({
      success: true,
      saml: {
        enabled: org.saml_enabled,
        idpEntityId: org.saml_idp_entity_id,
        idpSsoUrl: org.saml_idp_sso_url,
        idpCertificate: org.saml_idp_certificate,
        spEntityId: org.saml_sp_entity_id,
        wantAssertionsSigned: org.saml_want_assertions_signed,
        spMetadataUrl: org.slug
          ? `/api/role-room/organizations/${org.slug}/saml/metadata`
          : null,
        acsUrl: org.slug ? `/api/role-room/organizations/${org.slug}/saml/acs` : null,
      },
    });
  });

  app.put("/api/role-room/admin/organizations/:orgId/saml", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const org = await getOrganizationById(req.params.orgId);
    if (!org) return res.status(404).json({ success: false, error: "Organisasjon ikke funnet." });

    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const idpEntityId = typeof body.idpEntityId === "string" ? body.idpEntityId.trim() : org.saml_idp_entity_id;
    const idpSsoUrl = typeof body.idpSsoUrl === "string" ? body.idpSsoUrl.trim() : org.saml_idp_sso_url;
    const idpCertificate =
      typeof body.idpCertificate === "string" ? body.idpCertificate.trim() : org.saml_idp_certificate;
    const spEntityId = typeof body.spEntityId === "string" ? body.spEntityId.trim() : org.saml_sp_entity_id;
    const wantAssertionsSigned =
      typeof body.wantAssertionsSigned === "boolean"
        ? body.wantAssertionsSigned
        : org.saml_want_assertions_signed;
    const enabled = typeof body.enabled === "boolean" ? body.enabled : org.saml_enabled;

    if (enabled && (!idpEntityId || !idpSsoUrl || !idpCertificate)) {
      return res.status(400).json({
        success: false,
        error: "idpEntityId, idpSsoUrl og idpCertificate må være satt før SAML kan aktiveres.",
      });
    }
    if (!org.slug) {
      return res.status(400).json({
        success: false,
        error: "Organisasjonen mangler en slug — kan ikke konfigurere SAML uten en stabil ACS-URL.",
      });
    }

    try {
      const result = await pool.query<OrganizationSamlRow>(
        `UPDATE organizations
         SET saml_enabled = $2,
             saml_idp_entity_id = $3,
             saml_idp_sso_url = $4,
             saml_idp_certificate = $5,
             saml_sp_entity_id = $6,
             saml_want_assertions_signed = $7,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, slug, saml_enabled, saml_idp_entity_id, saml_idp_sso_url,
                   saml_idp_certificate, saml_sp_entity_id, saml_want_assertions_signed`,
        [org.id, enabled, idpEntityId, idpSsoUrl, idpCertificate, spEntityId, wantAssertionsSigned],
      );
      return res.json({ success: true, saml: result.rows[0] });
    } catch (err) {
      if (err instanceof Error && /duplicate key/i.test(err.message)) {
        return res.status(409).json({
          success: false,
          error: "spEntityId er allerede i bruk av en annen organisasjon.",
        });
      }
      console.error(`[saml-admin] update saml config threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke oppdatere SAML-konfigurasjon." });
    }
  });

  // ── Public: SP metadata, login redirect, ACS ────────────────────────────

  app.get("/api/role-room/organizations/:slug/saml/metadata", async (req, res) => {
    const org = await getOrganizationBySlug(req.params.slug);
    if (!org || !org.saml_enabled) {
      return res.status(404).send("SAML er ikke aktivert for denne organisasjonen.");
    }
    try {
      const saml = buildSamlClient(org, req);
      const metadata = saml.generateServiceProviderMetadata(null, null);
      res.type("application/xml").send(metadata);
    } catch (err) {
      console.error(`[saml] metadata generation threw: ${err instanceof Error ? err.message : String(err)}`);
      res.status(500).send("Kunne ikke generere SP-metadata.");
    }
  });

  app.get("/api/role-room/organizations/:slug/saml/login", async (req, res) => {
    const org = await getOrganizationBySlug(req.params.slug);
    if (!org || !org.saml_enabled) {
      return res.status(404).json({ success: false, error: "SAML er ikke aktivert for denne organisasjonen." });
    }

    purgeExpired(loginFlows);
    const flowId = crypto.randomUUID();
    const returnPath =
      typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/")
        ? req.query.returnTo
        : ROLE_ROOM_CANONICAL_PATH;
    const browserOrigin =
      typeof req.query.origin === "string" && /^https?:\/\//.test(req.query.origin)
        ? req.query.origin
        : null;
    loginFlows.set(flowId, {
      orgSlug: org.slug ?? req.params.slug,
      returnPath,
      browserOrigin,
      expiresAt: Date.now() + SAML_LOGIN_FLOW_TTL_MS,
    });

    try {
      const saml = buildSamlClient(org, req);
      const authorizeUrl = await saml.getAuthorizeUrlAsync(flowId, req.get("host"), {});
      return res.redirect(authorizeUrl);
    } catch (err) {
      loginFlows.delete(flowId);
      console.error(`[saml] login redirect build threw: ${err instanceof Error ? err.message : String(err)}`);
      return res.status(500).json({ success: false, error: "Kunne ikke starte SAML-innlogging." });
    }
  });

  app.post(
    "/api/role-room/organizations/:slug/saml/acs",
    express.urlencoded({ extended: false }),
    async (req, res) => {
      const org = await getOrganizationBySlug(req.params.slug);
      if (!org || !org.saml_enabled) {
        return res.status(404).send("SAML er ikke aktivert for denne organisasjonen.");
      }

      purgeExpired(loginFlows);
      const relayState = typeof req.body.RelayState === "string" ? req.body.RelayState : "";
      const flow = relayState ? loginFlows.get(relayState) : undefined;
      // RelayState-lookup mangler kun for IdP-initierte flows (utenfor scope
      // her, se filhode) — fall tilbake til org-default-redirect istedenfor
      // å avvise responsen, slik at en feilkonfigurert IdP-initiert test ikke
      // ender som en stille 404 uten forklaring.
      const returnPath = flow?.returnPath ?? ROLE_ROOM_CANONICAL_PATH;
      const browserOrigin = flow?.browserOrigin ?? null;
      if (relayState) loginFlows.delete(relayState);

      const samlResponse = typeof req.body.SAMLResponse === "string" ? req.body.SAMLResponse : "";
      if (!samlResponse) {
        return res.redirect(
          buildReturnUrl(returnPath, { rrSamlStatus: "error", rrSamlError: "missing_response" }, browserOrigin),
        );
      }

      try {
        const saml = buildSamlClient(org, req);
        const { profile } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
        const assertionEmail = readStringValue(profile?.email ?? profile?.mail ?? profile?.nameID);
        if (!assertionEmail) {
          return res.redirect(
            buildReturnUrl(returnPath, { rrSamlStatus: "error", rrSamlError: "no_email_in_assertion" }, browserOrigin),
          );
        }

        const localUser = await findUserByEmail(assertionEmail);
        if (!localUser) {
          // Bevisst: IKKE auto-provisjoner. En SAML-innlogget bruker uten en
          // eksisterende Role Room-konto skal provisjoneres via SCIM (Fase 2),
          // ikke stille opprettes her med en gjettet rolle.
          return res.redirect(
            buildReturnUrl(
              returnPath,
              { rrSamlStatus: "error", rrSamlError: "user_not_provisioned" },
              browserOrigin,
            ),
          );
        }

        const sessionToken = crypto.randomUUID();
        const sessionData: RoleRoomSamlSessionData = {
          userId: localUser.userId,
          email: localUser.email,
          name: localUser.name,
          role: localUser.role,
          displayName: localUser.name,
          organizationId: org.id,
          loginAt: new Date().toISOString(),
        };
        activeSessions.set(sessionToken, sessionData);
        await persistAuthSession(pool, sessionToken, sessionData);

        purgeExpired(sessionTransfers);
        const transferId = crypto.randomUUID();
        sessionTransfers.set(transferId, {
          sessionToken,
          user: {
            id: localUser.userId,
            email: localUser.email,
            name: localUser.name,
            role: localUser.role,
            organizationId: org.id,
          },
          expiresAt: Date.now() + SAML_TRANSFER_TTL_MS,
        });

        return res.redirect(
          buildReturnUrl(
            returnPath,
            { rrSamlStatus: "success", rrSamlTransfer: transferId },
            browserOrigin,
          ),
        );
      } catch (err) {
        console.error(`[saml] ACS validation threw: ${err instanceof Error ? err.message : String(err)}`);
        return res.redirect(
          buildReturnUrl(returnPath, { rrSamlStatus: "error", rrSamlError: "validation_failed" }, browserOrigin),
        );
      }
    },
  );

  // Engangsbytte: frontend leser transferId fra redirect-URL-en (ikke selve
  // token-et — samme prinsipp som Fase 0-fiksen: aldri sensitive tokens i
  // URL-en som lander i nettleserhistorikk/access-logger) og bytter den inn
  // her mot det faktiske sesjonstokenet. Slettes ved lesing (engangsbruk).
  app.get("/api/role-room/organizations/:slug/saml/transfer/:transferId", (req, res) => {
    purgeExpired(sessionTransfers);
    const transfer = sessionTransfers.get(req.params.transferId);
    if (!transfer) {
      return res.status(404).json({ success: false, error: "Ukjent eller utløpt transfer." });
    }
    sessionTransfers.delete(req.params.transferId);
    return res.json({ success: true, token: transfer.sessionToken, user: transfer.user });
  });
}
