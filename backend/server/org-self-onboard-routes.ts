/**
 * org-self-onboard-routes.ts
 *
 * Åpen selv-registrering for Solo-planen. Ingen super-admin involvert.
 *
 *   POST /api/leadgrid/self-onboard
 *
 * Flyt:
 *   1) E-post + org-navn + (valgfritt org_nr) + ønsket mal-key
 *   2) Sjekk at malen tillater self_onboard_allowed=true
 *   3) Opprett bruker (eller hent eksisterende) + organisasjon + medlemskap
 *   4) Send velkomst-e-post m/ magic-link (sett-passord-token)
 *
 * Konsekvent med superadmin-routes' create-flyt, men:
 *   - Gated på mal-`self_onboard_allowed`
 *   - Bruker-rate-limit + hCaptcha (TBD)
 *   - Ingen audit-log (det er åpen registrering)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";

interface Deps {
  app: Express;
  pool: Pool;
}

export function registerOrgSelfOnboardRoutes({ app, pool }: Deps): void {
  app.post("/api/leadgrid/self-onboard", async (req, res) => {
    const {
      email,
      orgName,
      orgNumber,
      templateKey,
      website,
      contactName,
    } = req.body ?? {};

    if (!email || !orgName) {
      return res.status(400).json({ error: "Mangler e-post eller org-navn" });
    }
    if (!email.includes("@") || !email.includes(".")) {
      return res.status(400).json({ error: "Ugyldig e-post" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Hent mal og sjekk self_onboard_allowed
      const tmplR = await client.query(
        `SELECT * FROM organization_setup_templates
         WHERE template_key = $1
           AND is_active = TRUE
           AND self_onboard_allowed = TRUE`,
        [templateKey ?? "solo"],
      );
      if (tmplR.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Denne malen krever invitasjon fra Leadgrid",
        });
      }
      const tmpl = tmplR.rows[0];

      // 2) Sjekk om e-post allerede har en org
      const existingR = await client.query(
        `SELECT u.id AS user_id, om.organization_id, o.name AS org_name
         FROM users u
         LEFT JOIN organization_members om ON om.user_id = u.id
         LEFT JOIN organizations o ON o.id = om.organization_id
         WHERE LOWER(u.email) = LOWER($1)`,
        [email],
      );
      if (existingR.rows.length > 0 && existingR.rows[0].organization_id) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: `Du er allerede registrert i ${existingR.rows[0].org_name}`,
          existing_org: existingR.rows[0].org_name,
        });
      }

      // 3) Opprett (eller bruk eksisterende) bruker
      let userId: string;
      let isNewUser = false;
      if (existingR.rows.length > 0) {
        userId = existingR.rows[0].user_id;
      } else {
        userId = crypto.randomUUID();
        await client.query(
          `INSERT INTO users (id, email, role, created_at)
           VALUES ($1, $2, 'member', now())`,
          [userId, email],
        );
        isNewUser = true;
      }

      // 4) Opprett org (org_type=customer for Solo, agency for Lite byrå)
      const orgType = templateKey === "agency_small" ? "agency" : "customer";
      const slug = String(orgName).toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
      const slugUnique = `${slug}-${crypto.randomBytes(3).toString("hex")}`;

      const orgR = await client.query(
        `INSERT INTO organizations
          (name, slug, org_type, owner_user_id, org_number, website,
           plan, contact_email, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          orgName,
          slugUnique,
          orgType,
          userId,
          orgNumber ?? null,
          website ?? null,
          tmpl.default_plan,
          email,
          JSON.stringify({
            setup_template_key: tmpl.template_key,
            self_onboarded: true,
            contact_name: contactName,
          }),
        ],
      );
      const orgId = orgR.rows[0].id;

      // 5) Legg bruker som admin
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'admin')`,
        [orgId, userId],
      );

      // 6) Magic-link / sett-passord-token (kun ny bruker)
      let magicToken: string | null = null;
      if (isNewUser) {
        magicToken = crypto.randomBytes(32).toString("hex");
        await client.query(
          `UPDATE users
              SET meta = COALESCE(meta, '{}'::jsonb)
                       || jsonb_build_object('magic_token', $1, 'magic_expires', $2::text)
            WHERE id = $3`,
          [
            magicToken,
            new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
            userId,
          ],
        );
      }

      await client.query("COMMIT");

      // 7) Velkomst-e-post (utenfor TX)
      {
        const url = magicToken
          ? `https://theroleroom.com/leadgrid/welcome?token=${magicToken}`
          : `https://theroleroom.com/leadgrid`;
        try {
          await sendTransactionalEmail({
            to: email,
            subject: `Velkommen til Leadgrid${contactName ? `, ${contactName}` : ""}`,
            html: `<p>Velkommen til Leadgrid.</p>
             <p>Vi har satt opp <strong>${orgName}</strong> for deg.
             Trykk lenken under for å logge inn og legge til din første kunde:</p>
             <p><a href="${url}">${url}</a></p>`,
            text: `Velkommen til Leadgrid. Vi har satt opp ${orgName} for deg. Logg inn her: ${url}`,
            kind: "leadgrid_self_onboard",
            pool,
          });
        } catch (e) {
          console.error("[self-onboard] mail failed", e);
        }
      }

      res.status(201).json({
        organization: {
          id: orgId, name: orgName, slug: slugUnique,
          org_type: orgType, plan: tmpl.default_plan,
        },
        user_id: userId,
        magic_link_sent: isNewUser,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[self-onboard] failed", e);
      res.status(500).json({ error: "Kunne ikke opprette org" });
    } finally {
      client.release();
    }
  });

  // Liste maler som er tilgjengelig for self-onboard
  app.get("/api/leadgrid/self-onboard-templates", async (_req, res) => {
    try {
      const r = await pool.query(
        `SELECT template_key, label, description, default_plan
         FROM organization_setup_templates
         WHERE is_active = TRUE AND self_onboard_allowed = TRUE
         ORDER BY display_order ASC`,
      );
      res.json({ templates: r.rows });
    } catch {
      res.status(500).json({ error: "Kunne ikke hente maler" });
    }
  });
}
