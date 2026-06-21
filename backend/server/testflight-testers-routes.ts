/**
 * testflight-testers-routes.ts
 *
 * TestFlight-tester-flyt:
 *
 *   1. Superadmin legger til tester m/ e-post + app + valgfri org-navn
 *      → oppretter midlertidig 'beta_tester' org-rad
 *      → returnerer tester_id
 *
 *   2. Superadmin sender NDA:
 *      POST /api/superadmin/testflight-testers/:id/send-nda
 *      → genererer partner_intent_agreement m/ agreement_class='nda'
 *      → Resend-mail m/ sign-link til testeren
 *
 *   3. Superadmin sender beta-tester-intent:
 *      POST /api/superadmin/testflight-testers/:id/send-intent
 *      → genererer agreement m/ class='beta_tester_terms'
 *
 *   4. Tester signerer via /api/leadgrid/intent/:token/sign
 *      (allerede bygget — vi henter referansen via agreement_id og
 *       oppdaterer nda_signed_at/intent_signed_at på testflight_testers)
 *
 *   5. Når begge er signert:
 *      Superadmin kan POST .../:id/graduate → flytter test-org til
 *      'customer' eller 'agency', triggrer 6 mnd gratis Solo Pro.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import {
  ascCreateBetaTester, ascDeleteBetaTester, ascListBetaTestersForApp,
  ascFindAppByBundleId, ascHealthCheck,
} from "./app-store-connect-client.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

const PUBLIC_BASE = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const token = (req as any).cookies?.sessionToken;
  return token ? sessions.get(token) ?? null : null;
}

async function requireSuperAdmin(
  req: Request, res: Response, pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<SessionData | null> {
  const s = getSession(req, activeSessions);
  if (!s) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id=$1`, [s.userId]);
  if (r.rows[0]?.role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" }); return null;
  }
  return s;
}

function mergeTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = vars[key];
    return v == null ? `[${key}]` : String(v);
  });
}

async function createAgreementFromTemplate(
  pool: Pool, opts: {
    templateKey: string;
    agreementClass: 'nda' | 'beta_tester_terms';
    organizationId: string;
    signerEmail: string;
    signerName: string | null;
    sentBy: string;
    expiryDays?: number;
  },
): Promise<{ agreement_id: string; sign_token: string }> {
  const tmplR = await pool.query<{ title: string; body_md: string; partner_type: string }>(
    `SELECT title, body_md, partner_type
       FROM partner_intent_templates WHERE template_key = $1`,
    [opts.templateKey],
  );
  if (tmplR.rows.length === 0) throw new Error(`Template ikke funnet: ${opts.templateKey}`);
  const orgR = await pool.query<{ name: string; org_number: string | null }>(
    `SELECT name, org_number FROM organizations WHERE id = $1`,
    [opts.organizationId],
  );
  if (orgR.rows.length === 0) throw new Error("Org ikke funnet");

  const merged = mergeTemplate(tmplR.rows[0].body_md, {
    ORG_NAME: orgR.rows[0].name,
    ORG_NUMBER: orgR.rows[0].org_number,
    SIGNER_NAME: opts.signerName ?? opts.signerEmail,
  });
  const signToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + (opts.expiryDays ?? 30) * 24 * 3600 * 1000);
  const r = await pool.query<{ id: string }>(
    `INSERT INTO partner_intent_agreements
      (organization_id, sent_by, title, body_md, agreement_class,
       partner_type, signer_email, signer_name,
       sign_token, sign_token_expires_at, status, template_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'sent', $11)
     RETURNING id`,
    [
      opts.organizationId, opts.sentBy, tmplR.rows[0].title, merged,
      opts.agreementClass, tmplR.rows[0].partner_type,
      opts.signerEmail, opts.signerName ?? null,
      signToken, expires, opts.templateKey,
    ],
  );
  return { agreement_id: r.rows[0].id, sign_token: signToken };
}

export function registerTestflightTestersRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Liste testere ----------
  app.get("/api/superadmin/testflight-testers", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    try {
      const r = await pool.query(
        `SELECT t.*,
                o.name AS org_name, o.org_type, o.plan,
                o2.name AS graduated_to_org_name,
                nda.status AS nda_status, nda.sign_token AS nda_sign_token,
                nda.signed_at AS nda_signed_at_v,
                intent.status AS intent_status, intent.sign_token AS intent_sign_token,
                intent.signed_at AS intent_signed_at_v
           FROM testflight_testers t
           LEFT JOIN organizations o ON o.id = t.organization_id
           LEFT JOIN organizations o2 ON o2.id = t.graduated_to_org_id
           LEFT JOIN partner_intent_agreements nda ON nda.id = t.nda_agreement_id
           LEFT JOIN partner_intent_agreements intent ON intent.id = t.intent_agreement_id
          ORDER BY t.invited_at DESC LIMIT 200`,
      );
      res.json({ testers: r.rows });
    } catch (err) {
      // Graceful fallback hvis testflight_testers eller relaterte tabeller
      // mangler i live DB → tom liste (iPad viser "Ingen testere").
      console.warn("[testflight-testers] list failed:", (err as Error).message);
      res.json({ testers: [] });
    }
  });

  // ---------- Legg til tester ----------
  // POST { email, fullName, appleId?, appBundleId?, appVersion?,
  //        orgName?, notes? }
  app.post("/api/superadmin/testflight-testers", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const {
      email, fullName, appleId, appBundleId, appVersion,
      orgName, notes,
    } = req.body ?? {};
    if (!email) return res.status(400).json({ error: "email påkrevd" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Sjekk om allerede finnes
      const existR = await client.query<{ id: string }>(
        `SELECT id FROM testflight_testers
          WHERE LOWER(email) = LOWER($1) AND COALESCE(app_bundle_id, '') = COALESCE($2, '')`,
        [email, appBundleId ?? null],
      );
      if (existR.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Tester finnes allerede", tester_id: existR.rows[0].id });
      }

      // 2) Opprett midlertidig 'beta_tester' org
      const effectiveOrgName = orgName ?? `${fullName ?? email} (beta)`;
      const slug = String(effectiveOrgName).toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        + "-" + crypto.randomBytes(3).toString("hex");
      const orgR = await client.query<{ id: string }>(
        `INSERT INTO organizations
          (name, slug, org_type, plan, contact_email, meta)
         VALUES ($1, $2, 'beta_tester', 'solo_pro', $3, $4)
         RETURNING id`,
        [
          effectiveOrgName, slug, email,
          JSON.stringify({ beta_tester: true, added_by: s.userId }),
        ],
      );
      const orgId = orgR.rows[0].id;

      // 3) Opprett tester
      const testerR = await client.query<{ id: string }>(
        `INSERT INTO testflight_testers
          (email, full_name, apple_id, organization_id, app_bundle_id,
           app_version, status, added_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'invited', $7, $8)
         RETURNING id`,
        [
          email, fullName ?? null, appleId ?? null, orgId,
          appBundleId ?? null, appVersion ?? null, s.userId, notes ?? null,
        ],
      );

      await client.query("COMMIT");

      // Push til Apple App Store Connect (fire-and-forget)
      const testerId = testerR.rows[0].id;
      let ascResult: { id?: string; error?: string } = {};
      try {
        const parts = (fullName ?? "").trim().split(" ");
        const firstName = parts[0] ?? "";
        const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
        const tester = await ascCreateBetaTester({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          appBundleId: appBundleId ?? undefined,
        });
        if (tester) {
          ascResult.id = tester.id;
          await pool.query(
            `UPDATE testflight_testers
                SET asc_beta_tester_id = $1,
                    asc_first_name = $2, asc_last_name = $3,
                    asc_state = $4, asc_invite_type = $5,
                    asc_invited_at = COALESCE($6::timestamptz, asc_invited_at),
                    asc_last_modified_at = COALESCE($7::timestamptz, asc_last_modified_at),
                    asc_synced_at = now(),
                    asc_sync_error = NULL
              WHERE id = $8`,
            [
              tester.id, tester.attributes.firstName ?? null,
              tester.attributes.lastName ?? null,
              tester.attributes.state ?? "INVITED",
              tester.attributes.inviteType ?? "EMAIL",
              tester.attributes.inviteDate ?? null,
              tester.attributes.lastModifiedDate ?? null,
              testerId,
            ],
          );
        }
      } catch (e: any) {
        console.error("[ASC push-tester]", e);
        const errMsg = e?.message ?? String(e);
        ascResult.error = errMsg;
        await pool.query(
          `UPDATE testflight_testers SET asc_sync_error = $1, asc_synced_at = now() WHERE id = $2`,
          [errMsg.slice(0, 500), testerId],
        );
      }

      res.status(201).json({
        tester_id: testerId,
        organization_id: orgId,
        organization_name: effectiveOrgName,
        asc_pushed: !!ascResult.id,
        asc_beta_tester_id: ascResult.id,
        asc_error: ascResult.error,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[testflight create]", e);
      res.status(500).json({ error: "Kunne ikke legge til tester" });
    } finally {
      client.release();
    }
  });

  // ---------- Send NDA ----------
  app.post("/api/superadmin/testflight-testers/:id/send-nda", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const testerR = await pool.query<{
      email: string; full_name: string | null; organization_id: string;
      nda_agreement_id: string | null;
    }>(
      `SELECT email, full_name, organization_id, nda_agreement_id
         FROM testflight_testers WHERE id = $1`,
      [req.params.id],
    );
    if (testerR.rows.length === 0) return res.status(404).json({ error: "Tester ikke funnet" });
    const t = testerR.rows[0];
    if (t.nda_agreement_id) {
      return res.status(409).json({ error: "NDA er allerede sendt" });
    }

    try {
      const created = await createAgreementFromTemplate(pool, {
        templateKey: "nda_v1",
        agreementClass: "nda",
        organizationId: t.organization_id,
        signerEmail: t.email,
        signerName: t.full_name,
        sentBy: s.userId,
      });
      await pool.query(
        `UPDATE testflight_testers SET nda_agreement_id = $1, updated_at = now()
         WHERE id = $2`,
        [created.agreement_id, req.params.id],
      );
      // Send Resend-mail
      const signUrl = `${PUBLIC_BASE}/leadgrid/intent/${created.sign_token}`;
      try {
        await sendTransactionalEmail({
          to: t.email,
          subject: "Taushetserklæring — Leadgrid beta-test",
          html: `<p>Hei${t.full_name ? ` ${t.full_name}` : ""},</p>
                 <p>Velkommen som beta-tester for Leadgrid. Før du kan begynne
                 må vi få deg til å signere en taushetserklæring (NDA).</p>
                 <p><a href="${signUrl}">Åpne og signer NDA-en her</a></p>`,
          text: `Velkommen som beta-tester. Signer NDA her: ${signUrl}`,
          kind: "testflight_nda",
          sentByUserId: s.userId,
          pool,
        });
      } catch (e) { console.error("[NDA mail]", e); }
      res.json({ ok: true, agreement_id: created.agreement_id });
    } catch (e: any) {
      console.error("[testflight nda]", e);
      res.status(500).json({ error: e.message ?? "Kunne ikke sende NDA" });
    }
  });

  // ---------- Send beta-tester intent ----------
  app.post("/api/superadmin/testflight-testers/:id/send-intent", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const testerR = await pool.query<{
      email: string; full_name: string | null; organization_id: string;
      intent_agreement_id: string | null;
    }>(
      `SELECT email, full_name, organization_id, intent_agreement_id
         FROM testflight_testers WHERE id = $1`,
      [req.params.id],
    );
    if (testerR.rows.length === 0) return res.status(404).json({ error: "Tester ikke funnet" });
    const t = testerR.rows[0];
    if (t.intent_agreement_id) {
      return res.status(409).json({ error: "Intent-avtale er allerede sendt" });
    }

    try {
      const created = await createAgreementFromTemplate(pool, {
        templateKey: "beta_tester_intent_v1",
        agreementClass: "beta_tester_terms",
        organizationId: t.organization_id,
        signerEmail: t.email,
        signerName: t.full_name,
        sentBy: s.userId,
      });
      await pool.query(
        `UPDATE testflight_testers SET intent_agreement_id = $1, updated_at = now()
         WHERE id = $2`,
        [created.agreement_id, req.params.id],
      );
      const signUrl = `${PUBLIC_BASE}/leadgrid/intent/${created.sign_token}`;
      try {
        await sendTransactionalEmail({
          to: t.email,
          subject: "Intensjonsavtale — Leadgrid beta-test",
          html: `<p>Hei${t.full_name ? ` ${t.full_name}` : ""},</p>
                 <p>Du har NDA-en på plass. Siste steg før du kan begynne å teste
                 er intensjonsavtalen som setter rammer for tester-rollen din.</p>
                 <p><a href="${signUrl}">Åpne og signer intensjonsavtalen</a></p>
                 <p>Som beta-tester får du gratis Solo Pro i 6 måneder etter
                 offisiell lansering.</p>`,
          text: `Signer intensjonsavtalen: ${signUrl}`,
          kind: "testflight_intent",
          sentByUserId: s.userId,
          pool,
        });
      } catch (e) { console.error("[intent mail]", e); }
      res.json({ ok: true, agreement_id: created.agreement_id });
    } catch (e: any) {
      console.error("[testflight intent]", e);
      res.status(500).json({ error: e.message ?? "Kunne ikke sende intent" });
    }
  });

  // ---------- Webhook fra partner_intent når signert: synk tester ----------
  // Kalles fra partner-intent-routes' sign-handler via en intern helper.
  // For nå: en GET-route som kan brukes som "refresh" — sjekker agreements
  // og oppdaterer tester-radene.
  app.post("/api/superadmin/testflight-testers/:id/sync-agreements", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query<{ nda_signed: string | null; intent_signed: string | null }>(
      `UPDATE testflight_testers t
          SET nda_signed_at = (SELECT signed_at FROM partner_intent_agreements WHERE id = t.nda_agreement_id),
              intent_signed_at = (SELECT signed_at FROM partner_intent_agreements WHERE id = t.intent_agreement_id),
              status = CASE
                WHEN (SELECT signed_at FROM partner_intent_agreements WHERE id = t.nda_agreement_id) IS NOT NULL
                 AND (SELECT signed_at FROM partner_intent_agreements WHERE id = t.intent_agreement_id) IS NOT NULL
                THEN 'active'
                ELSE t.status
              END,
              updated_at = now()
        WHERE t.id = $1
        RETURNING nda_signed_at AS nda_signed, intent_signed_at AS intent_signed`,
      [req.params.id],
    );
    res.json({ ok: true, ...r.rows[0] });
  });

  // ---------- Graduate ----------
  // POST { graduateToOrgType: 'customer'|'agency', graduateToPlan: 'solo_pro'|'agency' }
  app.post("/api/superadmin/testflight-testers/:id/graduate", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { graduateToOrgType, graduateToPlan } = req.body ?? {};
    if (!["customer", "agency"].includes(graduateToOrgType)) {
      return res.status(400).json({ error: "graduateToOrgType må være customer eller agency" });
    }

    const testerR = await pool.query<{
      organization_id: string; email: string; full_name: string | null;
      nda_signed_at: string | null; intent_signed_at: string | null;
    }>(
      `SELECT organization_id, email, full_name, nda_signed_at, intent_signed_at
         FROM testflight_testers WHERE id = $1`,
      [req.params.id],
    );
    if (testerR.rows.length === 0) return res.status(404).json({ error: "Tester ikke funnet" });
    const t = testerR.rows[0];

    // Krev at både NDA og intent er signert
    if (!t.nda_signed_at || !t.intent_signed_at) {
      return res.status(409).json({
        error: "Begge avtaler må være signert før graduate",
        nda_signed: !!t.nda_signed_at,
        intent_signed: !!t.intent_signed_at,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) Konverter org fra beta_tester til kunde/byrå
      const renewsAt = new Date(Date.now() + 180 * 24 * 3600 * 1000); // 6 mnd gratis Solo Pro
      await client.query(
        `UPDATE organizations
            SET org_type = $1,
                plan = $2,
                plan_started_at = now(),
                plan_renews_at = $3,
                meta = COALESCE(meta, '{}'::jsonb)
                       || jsonb_build_object('graduated_from_beta', true,
                                             'graduated_at', now()::text,
                                             'free_pro_until', $3::text)
          WHERE id = $4`,
        [graduateToOrgType, graduateToPlan ?? "solo_pro", renewsAt, t.organization_id],
      );

      // 2) Marker tester som graduated
      await client.query(
        `UPDATE testflight_testers
            SET status = 'graduated', graduated_at = now(),
                graduated_to_org_id = $1, updated_at = now()
          WHERE id = $2`,
        [t.organization_id, req.params.id],
      );

      await client.query("COMMIT");

      // 3) Bekreftelses-mail
      try {
        await sendTransactionalEmail({
          to: t.email,
          subject: `Gratulerer — du er nå en ekte Leadgrid-bruker`,
          html: `<p>Hei${t.full_name ? ` ${t.full_name}` : ""},</p>
                 <p>Du har gradert fra TestFlight-tester til ordinær Leadgrid-bruker.</p>
                 <p>Som takk for innsatsen får du <strong>Solo Pro gratis i 6 måneder</strong>
                 (frem til ${renewsAt.toLocaleDateString("no-NO")}).</p>
                 <p>Velkommen ombord!</p>`,
          text: `Du er gradert til ordinær Leadgrid-bruker. Solo Pro gratis frem til ${renewsAt.toLocaleDateString("no-NO")}.`,
          kind: "testflight_graduated",
          sentByUserId: s.userId,
          pool,
        });
      } catch (e) { console.error("[graduate mail]", e); }

      res.json({
        ok: true,
        organization_id: t.organization_id,
        new_org_type: graduateToOrgType,
        free_pro_until: renewsAt.toISOString(),
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[testflight graduate]", e);
      res.status(500).json({ error: "Kunne ikke graduere" });
    } finally {
      client.release();
    }
  });

  // ---------- Fjern tester (uten å slette agreements/audit) ----------
  app.post("/api/superadmin/testflight-testers/:id/remove", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { reason } = req.body ?? {};
    // Slett også fra Apple ASC hvis koblet
    const ascR = await pool.query<{ asc_beta_tester_id: string | null }>(
      `SELECT asc_beta_tester_id FROM testflight_testers WHERE id = $1`,
      [req.params.id],
    );
    if (ascR.rows[0]?.asc_beta_tester_id) {
      try { await ascDeleteBetaTester(ascR.rows[0].asc_beta_tester_id); }
      catch (e) { console.error("[ASC delete-tester]", e); }
    }
    await pool.query(
      `UPDATE testflight_testers
          SET status = 'removed', removed_at = now(), removal_reason = $1, updated_at = now()
        WHERE id = $2`,
      [reason ?? null, req.params.id],
    );
    res.json({ ok: true });
  });

  // ---------- Manuell ASC-sync (pull fra Apple) ----------
  app.post("/api/superadmin/testflight-testers/sync-asc", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { appBundleId } = req.body ?? {};
    if (!appBundleId) return res.status(400).json({ error: "appBundleId påkrevd" });

    const start = Date.now();
    try {
      const app = await ascFindAppByBundleId(appBundleId);
      if (!app) return res.status(404).json({ error: `App ikke funnet i ASC: ${appBundleId}` });

      // Lagre app-mapping for fremtidig bruk
      await pool.query(
        `INSERT INTO asc_app_mapping (app_bundle_id, asc_app_id, app_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (app_bundle_id) DO UPDATE
           SET asc_app_id = EXCLUDED.asc_app_id, app_name = EXCLUDED.app_name`,
        [appBundleId, app.id, app.attributes.name],
      );

      const ascTesters = await ascListBetaTestersForApp(app.id);
      let updated = 0;
      let addedLocally = 0;

      for (const t of ascTesters) {
        const r = await pool.query<{ id: string }>(
          `UPDATE testflight_testers
              SET asc_beta_tester_id = $1,
                  asc_app_id = $2,
                  asc_first_name = $3, asc_last_name = $4,
                  asc_state = $5, asc_invite_type = $6,
                  asc_invited_at = COALESCE($7::timestamptz, asc_invited_at),
                  asc_last_modified_at = COALESCE($8::timestamptz, asc_last_modified_at),
                  asc_synced_at = now(), asc_sync_error = NULL,
                  -- Map Apple-state til vår status
                  accepted_invite_at = CASE
                    WHEN $5 IN ('ACCEPTED', 'INSTALLED') AND accepted_invite_at IS NULL
                      THEN COALESCE($8::timestamptz, now())
                    ELSE accepted_invite_at
                  END,
                  status = CASE
                    WHEN $5 = 'INSTALLED' AND status NOT IN ('graduated','removed') THEN 'active'
                    WHEN $5 = 'REVOKED' THEN 'removed'
                    WHEN $5 = 'EXPIRED' THEN 'expired'
                    ELSE status
                  END,
                  updated_at = now()
            WHERE LOWER(email) = LOWER($9)
              AND COALESCE(app_bundle_id, '') IN ($10, '')
            RETURNING id`,
          [
            t.id, app.id,
            t.attributes.firstName ?? null, t.attributes.lastName ?? null,
            t.attributes.state ?? null, t.attributes.inviteType ?? null,
            t.attributes.inviteDate ?? null, t.attributes.lastModifiedDate ?? null,
            t.attributes.email, appBundleId,
          ],
        );
        if (r.rowCount && r.rowCount > 0) {
          updated++;
        } else {
          // Tester finnes i Apple men ikke lokalt — opprett lokal stub
          const orgName = `${t.attributes.email} (Apple-synket)`;
          const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
                     + "-" + crypto.randomBytes(3).toString("hex");
          const orgR = await pool.query<{ id: string }>(
            `INSERT INTO organizations (name, slug, org_type, plan, contact_email, meta)
             VALUES ($1, $2, 'beta_tester', 'solo_pro', $3, $4)
             RETURNING id`,
            [
              orgName, slug, t.attributes.email,
              JSON.stringify({ beta_tester: true, from_asc_sync: true }),
            ],
          );
          await pool.query(
            `INSERT INTO testflight_testers
              (email, full_name, organization_id, app_bundle_id, status,
               asc_beta_tester_id, asc_app_id, asc_first_name, asc_last_name,
               asc_state, asc_invite_type, asc_invited_at, asc_last_modified_at,
               asc_synced_at, accepted_invite_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), $14)`,
            [
              t.attributes.email,
              [t.attributes.firstName, t.attributes.lastName].filter(Boolean).join(" ") || null,
              orgR.rows[0].id, appBundleId,
              t.attributes.state === "INSTALLED" ? "active" : "invited",
              t.id, app.id,
              t.attributes.firstName ?? null, t.attributes.lastName ?? null,
              t.attributes.state ?? "INVITED", t.attributes.inviteType ?? "EMAIL",
              t.attributes.inviteDate ?? null, t.attributes.lastModifiedDate ?? null,
              t.attributes.state === "ACCEPTED" || t.attributes.state === "INSTALLED"
                ? (t.attributes.lastModifiedDate ?? new Date().toISOString())
                : null,
            ],
          );
          addedLocally++;
        }
      }

      const durationMs = Date.now() - start;
      await pool.query(
        `INSERT INTO asc_sync_log (app_id, testers_pulled, testers_updated, testers_added_locally, duration_ms)
         VALUES ($1, $2, $3, $4, $5)`,
        [app.id, ascTesters.length, updated, addedLocally, durationMs],
      );

      res.json({
        ok: true, app_id: app.id, app_name: app.attributes.name,
        pulled: ascTesters.length, updated, added_locally: addedLocally,
        duration_ms: durationMs,
      });
    } catch (e: any) {
      const durationMs = Date.now() - start;
      await pool.query(
        `INSERT INTO asc_sync_log (testers_pulled, duration_ms, error) VALUES (0, $1, $2)`,
        [durationMs, (e.message ?? String(e)).slice(0, 500)],
      );
      console.error("[ASC sync]", e);
      res.status(500).json({ error: e.message ?? "Sync feilet" });
    }
  });

  // ---------- ASC helsesjekk ----------
  app.get("/api/superadmin/testflight-testers/asc-health", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const h = await ascHealthCheck();
    res.json(h);
  });

  // ---------- Sync-log ----------
  app.get("/api/superadmin/testflight-testers/asc-sync-log", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT id, ran_at, app_id, testers_pulled, testers_updated,
              testers_added_locally, duration_ms, error
         FROM asc_sync_log ORDER BY ran_at DESC LIMIT 20`,
    );
    res.json({ entries: r.rows });
  });
}
