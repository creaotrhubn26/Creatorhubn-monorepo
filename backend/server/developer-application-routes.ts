/**
 * developer-application-routes.ts
 *
 * Selv-betjent utvikler-søknad på /api/leadgrid/developer-application.
 * Ingen TRR-konto kreves. Følges opp manuelt av super-admin i
 * /superadmin > Partnere > Søknader.
 *
 * Flyt:
 *   POST /api/leadgrid/developer-application
 *     Input: { email, fullName, organizationName, website, useCase,
 *              integrationDescription, expectedMonthlyApiCalls, agreedToTerms }
 *     1) Sjekk om e-post allerede har pending søknad → 409
 *     2) Opprett bruker hvis ikke finnes
 *     3) Opprett 'developer'-org (org_type=customer m/ status=active, plan=solo_free)
 *     4) Opprett partner_applications-rad m/ partner_type='integration',
 *        origin='developer_self_application', terms-versjon registrert
 *     5) Send bekreftelses-mail til søker
 *     6) Send notify-mail til super-admins
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { notifyAdmins } from "./admin-notify";

interface Deps {
  app: Express;
  pool: Pool;
}

const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

export function registerDeveloperApplicationRoutes({ app, pool }: Deps): void {

  app.post("/api/leadgrid/developer-application", async (req, res) => {
    const {
      email, fullName, organizationName, website,
      useCase, integrationDescription, expectedMonthlyApiCalls,
      agreedToTerms,
    } = req.body ?? {};

    // Validering
    if (!email || !email.includes("@") || !email.includes(".")) {
      return res.status(400).json({ error: "Ugyldig e-post" });
    }
    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ error: "Navn påkrevd" });
    }
    if (!organizationName || organizationName.trim().length < 2) {
      return res.status(400).json({ error: "Organisasjon påkrevd" });
    }
    if (!useCase || useCase.trim().length < 20) {
      return res.status(400).json({ error: "Use-case må være minst 20 tegn" });
    }
    if (!agreedToTerms) {
      return res.status(400).json({ error: "Du må godta vilkårene" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Sjekk om e-post finnes
      const userR = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [email],
      );
      let userId: string;
      if (userR.rows.length > 0) {
        userId = userR.rows[0].id;
        // Sjekk om bruker har pending developer-app
        const existR = await client.query(
          `SELECT 1 FROM partner_applications pa
             JOIN organization_members om ON om.organization_id = pa.organization_id
            WHERE om.user_id = $1
              AND pa.partner_type = 'integration'
              AND pa.status = 'pending'`,
          [userId],
        );
        if (existR.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Du har allerede en pending utvikler-søknad",
          });
        }
      } else {
        userId = crypto.randomUUID();
        const parts = fullName.trim().split(/\s+/);
        // password er NOT NULL i users. Sett random placeholder — brukeren
        // logger inn via magic-link senere, password-feltet brukes ikke
        // direkte. Hvis de vil sette ekte passord går de via reset-flow.
        const placeholderPassword = crypto.randomBytes(32).toString("hex");
        await client.query(
          `INSERT INTO users (id, email, username, password, role, first_name, last_name, created_at)
           VALUES ($1, $2, $3, $4, 'member', $5, $6, now())`,
          [
            userId, email, email, placeholderPassword,
            parts[0] ?? null,
            parts.slice(1).join(" ") || null,
          ],
        );
      }

      // 2) Opprett developer-org (eller hent eksisterende)
      const slug = String(organizationName).toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        + "-dev-" + crypto.randomBytes(3).toString("hex");
      const orgR = await client.query<{ id: string }>(
        `INSERT INTO organizations
          (name, slug, org_type, plan, owner_user_id,
           website, contact_email, meta)
         VALUES ($1, $2, 'customer', 'solo_free', $3, $4, $5, $6)
         RETURNING id`,
        [
          organizationName, slug, userId,
          website ?? null, email,
          JSON.stringify({
            developer_application: true,
            integration_description: integrationDescription ?? null,
            expected_monthly_api_calls: expectedMonthlyApiCalls ?? null,
          }),
        ],
      );
      const orgId = orgR.rows[0].id;

      // 3) Legg bruker som admin
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [orgId, userId],
      );

      // 4) Hent aktiv vilkår-versjon for å logge consent
      const termsR = await client.query<{ version: string }>(
        `SELECT version FROM partner_terms_versions WHERE is_current = TRUE LIMIT 1`,
      );
      const termsVersion = termsR.rows[0]?.version ?? "v1-2026-06-18";

      // 5) Opprett partner-application
      const appR = await client.query<{ id: string }>(
        `INSERT INTO partner_applications
          (organization_id, applicant_user_id, origin, partner_type,
           reason, terms_version, consent_at, consent_ip, consent_user_agent,
           status)
         VALUES ($1, $2, 'developer_self_application', 'integration',
                 $3, $4, now(), $5, $6, 'pending')
         RETURNING id`,
        [
          orgId, userId,
          `Use-case: ${useCase}${integrationDescription ? `\n\nIntegrasjon: ${integrationDescription}` : ""}${expectedMonthlyApiCalls ? `\n\nForventet API-volum: ${expectedMonthlyApiCalls}/mnd` : ""}`,
          termsVersion,
          req.ip ?? null,
          (req.headers["user-agent"] as string)?.slice(0, 500) ?? null,
        ],
      );
      const applicationId = appR.rows[0].id;

      await client.query("COMMIT");

      // 6) Send bekreftelses-mail til søker
      try {
        await sendTransactionalEmail({
          to: email,
          subject: `Leadgrid Developer-søknad mottatt`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <h1 style="color:#7c3aed;">Søknad mottatt ✓</h1>
              <p>Hei ${fullName},</p>
              <p>Vi har mottatt søknaden din om utvikler-tilgang for
              <strong>${organizationName}</strong>.</p>
              <p>Vi behandler søknaden manuelt — du vil høre fra oss innen
              <strong>3 virkedager</strong>.</p>
              <p style="background:#f3f0ff;padding:14px;border-radius:6px;border-left:3px solid #7c3aed;">
                <strong>Mens du venter:</strong> les <a href="${PUBLIC_BASE}/leadgrid/utviklere">developer-dokumentasjonen</a>
                så er du klar til å integrere så snart vi sender API-keyen.
              </p>
              <p style="color:#888;font-size:13px;">
                Spørsmål? Svar på denne e-posten — vi svarer alltid.
              </p>
            </div>`,
          text: `Hei ${fullName}, vi har mottatt søknaden din om utvikler-tilgang for ${organizationName}. Vi svarer innen 3 virkedager. Dokumentasjon: ${PUBLIC_BASE}/leadgrid/utviklere`,
          kind: "developer_application_received",
          pool,
        });
      } catch (e) { console.error("[dev-app receipt mail]", e); }

      // 7) Notify super-admins (e-post + in-app via delt helper)
      void notifyAdmins(pool, {
        type: "leadgrid_developer_application",
        source: "Leadgrid · utvikler-søknad (selvbetjent)",
        title: `Ny utvikler-søknad: ${organizationName}`,
        summary: `${fullName} <${email}>${website ? ` · ${website}` : ""} · API-volum: ${expectedMonthlyApiCalls ?? "ikke oppgitt"}/mnd · Use-case: ${useCase}`,
        link: "/admin",
        cta: (req.body && req.body.cta) || null,
        page: req.get("referer") || (req.body && req.body.page) || null,
        utm: (req.body && req.body.utm) || null,
        relatedId: applicationId,
      });

      res.status(201).json({
        ok: true,
        application_id: applicationId,
        organization_id: orgId,
        status: "pending",
        message: "Søknad mottatt. Vi svarer innen 3 virkedager.",
      });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[developer-application]", e);
      // Expose detail i 500 så vi kan diagnose i utviklingsfasen
      res.status(500).json({
        error: "Kunne ikke registrere søknaden",
        detail: process.env.NODE_ENV === "production"
          ? (e.message ?? String(e)).slice(0, 200)
          : String(e),
      });
    } finally {
      client.release();
    }
  });
}
