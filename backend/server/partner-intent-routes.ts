/**
 * partner-intent-routes.ts
 *
 * Intensjonsavtale-flyt:
 *
 *   1. Superadmin velger template (customer/reseller/integration/strategic)
 *   2. Template merges m/ partner-data ({{ORG_NAME}}, {{COMMISSION_PCT}})
 *   3. Superadmin kan redigere body før sending
 *   4. POST /api/superadmin/partner-intents → sender Resend-mail m/ sign-token
 *   5. Partner åpner /leadgrid/intent/:token → ser markdown-rendret avtale
 *   6. Partner skriver navnet sitt og klikker "Signer"
 *      → POST /api/leadgrid/intent/:token/sign m/ IP+UA-logging
 *   7. Status oppdateres til 'signed', superadmin får varsel,
 *      kopi av PDF lagres (TBD: faktisk PDF-generering)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { sendTransactionalEmail } from "./transactional-email-service.js";

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

export function registerPartnerIntentRoutes({ app, pool, activeSessions }: Deps): void {

  // ---------- Superadmin: list templates ----------
  app.get("/api/superadmin/partner-intent-templates", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const includeInactive = req.query.includeInactive === "true";
    const r = await pool.query(
      `SELECT t.id, t.template_key, t.partner_type, t.title, t.body_md,
              t.default_notice_days, t.default_commission_pct, t.default_discount_pct,
              t.is_active, t.prior_version_key, t.signed_uses_count,
              t.created_at, t.updated_at,
              cu.email AS created_by_email, uu.email AS updated_by_email,
              (SELECT COUNT(*) FROM partner_intent_agreements pia
                 WHERE pia.template_version = t.template_key) AS used_in_agreements
         FROM partner_intent_templates t
         LEFT JOIN users cu ON cu.id = t.created_by
         LEFT JOIN users uu ON uu.id = t.updated_by
        WHERE ($1 = TRUE OR t.is_active = TRUE)
        ORDER BY t.partner_type ASC, t.template_key ASC`,
      [includeInactive],
    );
    res.json({ templates: r.rows });
  });

  // ---------- Superadmin: opprett ny template ----------
  // POST { templateKey, partnerType, title, body_md,
  //        defaultNoticeDays?, defaultCommissionPct?, defaultDiscountPct? }
  app.post("/api/superadmin/partner-intent-templates", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const {
      templateKey, partnerType, title, body_md,
      defaultNoticeDays, defaultCommissionPct, defaultDiscountPct,
    } = req.body ?? {};
    if (!templateKey || !partnerType || !title || !body_md) {
      return res.status(400).json({ error: "templateKey, partnerType, title, body_md påkrevd" });
    }
    if (!["customer", "integration", "reseller", "strategic"].includes(partnerType)) {
      return res.status(400).json({ error: "Ugyldig partnerType" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query<{ id: string }>(
        `INSERT INTO partner_intent_templates
          (template_key, partner_type, title, body_md,
           default_notice_days, default_commission_pct, default_discount_pct,
           is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $8)
         RETURNING id`,
        [
          templateKey, partnerType, title, body_md,
          defaultNoticeDays ?? null, defaultCommissionPct ?? null, defaultDiscountPct ?? null,
          s.userId,
        ],
      );
      await client.query(
        `INSERT INTO partner_intent_template_history
          (template_id, template_key, title, body_md,
           default_notice_days, default_commission_pct, default_discount_pct,
           edited_by, change_type, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'created', 'Opprettet ny template')`,
        [
          r.rows[0].id, templateKey, title, body_md,
          defaultNoticeDays ?? null, defaultCommissionPct ?? null, defaultDiscountPct ?? null,
          s.userId,
        ],
      );
      await client.query("COMMIT");
      res.status(201).json({ template_id: r.rows[0].id });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[template create]", e);
      const isUniqueErr = String(e).includes("unique");
      res.status(isUniqueErr ? 409 : 500).json({
        error: isUniqueErr ? `templateKey '${templateKey}' finnes allerede` : "Kunne ikke opprette",
      });
    } finally {
      client.release();
    }
  });

  // ---------- Superadmin: oppdater (in-place, minor edit) ----------
  // PATCH body: { title?, body_md?, defaultNoticeDays?, ..., changeSummary }
  // Gjelder kun hvis template ikke er brukt i SIGNERTE avtaler — da må
  // den bli en ny versjon via POST .../new-version i stedet.
  app.patch("/api/superadmin/partner-intent-templates/:id", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const {
      title, body_md, defaultNoticeDays, defaultCommissionPct,
      defaultDiscountPct, partnerType, changeSummary,
    } = req.body ?? {};

    // Sjekk om template er brukt i signerte avtaler
    const usageR = await pool.query<{ signed_count: string }>(
      `SELECT COUNT(*)::text AS signed_count FROM partner_intent_agreements pia
        WHERE pia.template_version = (SELECT template_key FROM partner_intent_templates WHERE id = $1)
          AND pia.status = 'signed'`,
      [req.params.id],
    );
    const signedCount = parseInt(usageR.rows[0]?.signed_count ?? "0", 10);
    if (signedCount > 0) {
      return res.status(409).json({
        error: "template_already_used",
        signed_count: signedCount,
        message: "Denne malen er brukt i signerte avtaler. Lag en ny versjon i stedet (POST .../new-version).",
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
    if (body_md !== undefined) { updates.push(`body_md = $${i++}`); values.push(body_md); }
    if (partnerType !== undefined) { updates.push(`partner_type = $${i++}`); values.push(partnerType); }
    if (defaultNoticeDays !== undefined) { updates.push(`default_notice_days = $${i++}`); values.push(defaultNoticeDays); }
    if (defaultCommissionPct !== undefined) { updates.push(`default_commission_pct = $${i++}`); values.push(defaultCommissionPct); }
    if (defaultDiscountPct !== undefined) { updates.push(`default_discount_pct = $${i++}`); values.push(defaultDiscountPct); }
    if (updates.length === 0) return res.status(400).json({ error: "Ingen endringer" });
    updates.push(`updated_at = now()`, `updated_by = $${i++}`);
    values.push(s.userId);
    values.push(req.params.id);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query<{
        template_key: string; title: string; body_md: string;
        default_notice_days: number | null; default_commission_pct: number | null;
        default_discount_pct: number | null;
      }>(
        `UPDATE partner_intent_templates SET ${updates.join(", ")}
          WHERE id = $${i}
         RETURNING template_key, title, body_md,
                   default_notice_days, default_commission_pct, default_discount_pct`,
        values,
      );
      if (r.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Ikke funnet" });
      }
      const t = r.rows[0];
      await client.query(
        `INSERT INTO partner_intent_template_history
          (template_id, template_key, title, body_md,
           default_notice_days, default_commission_pct, default_discount_pct,
           edited_by, change_type, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'minor_edit', $9)`,
        [
          req.params.id, t.template_key, t.title, t.body_md,
          t.default_notice_days, t.default_commission_pct, t.default_discount_pct,
          s.userId, changeSummary ?? null,
        ],
      );
      await client.query("COMMIT");
      res.json({ ok: true, template_key: t.template_key });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[template patch]", e);
      res.status(500).json({ error: "Kunne ikke oppdatere" });
    } finally {
      client.release();
    }
  });

  // ---------- Superadmin: ny versjon (bumper key v1 → v2) ----------
  // POST body: { newTemplateKey?, title, body_md, defaultsetc, changeSummary }
  // Lager NY rad m/ prior_version_key satt + deaktiverer gammel
  app.post("/api/superadmin/partner-intent-templates/:id/new-version", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const oldR = await pool.query<{
      template_key: string; partner_type: string; title: string; body_md: string;
      default_notice_days: number | null;
      default_commission_pct: number | null; default_discount_pct: number | null;
    }>(
      `SELECT template_key, partner_type, title, body_md, default_notice_days,
              default_commission_pct, default_discount_pct
         FROM partner_intent_templates WHERE id = $1`,
      [req.params.id],
    );
    if (oldR.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    const old = oldR.rows[0];

    // Bumpe key: 'nda_v1' → 'nda_v2'. Hvis ikke v\d, append _v2.
    const newKey = req.body?.newTemplateKey ?? (() => {
      const m = old.template_key.match(/^(.*?_v)(\d+)$/);
      return m ? `${m[1]}${parseInt(m[2], 10) + 1}` : `${old.template_key}_v2`;
    })();

    const payload = {
      title: req.body?.title ?? old.title,
      body_md: req.body?.body_md ?? old.body_md,
      default_notice_days: req.body?.defaultNoticeDays ?? old.default_notice_days,
      default_commission_pct: req.body?.defaultCommissionPct ?? old.default_commission_pct,
      default_discount_pct: req.body?.defaultDiscountPct ?? old.default_discount_pct,
      change_summary: req.body?.changeSummary ?? "Ny versjon",
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Opprett ny
      const newR = await client.query<{ id: string }>(
        `INSERT INTO partner_intent_templates
          (template_key, partner_type, title, body_md,
           default_notice_days, default_commission_pct, default_discount_pct,
           is_active, prior_version_key, supersedes_template_id,
           created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $10)
         RETURNING id`,
        [
          newKey, old.partner_type, payload.title, payload.body_md,
          payload.default_notice_days, payload.default_commission_pct, payload.default_discount_pct,
          old.template_key, req.params.id, s.userId,
        ],
      );
      // Deaktiver gammel
      await client.query(
        `UPDATE partner_intent_templates SET is_active = FALSE, updated_at = now(), updated_by = $1
          WHERE id = $2`,
        [s.userId, req.params.id],
      );
      // History på begge
      await client.query(
        `INSERT INTO partner_intent_template_history
          (template_id, template_key, title, body_md,
           default_notice_days, default_commission_pct, default_discount_pct,
           edited_by, change_type, change_summary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new_version', $9)`,
        [
          newR.rows[0].id, newKey, payload.title, payload.body_md,
          payload.default_notice_days, payload.default_commission_pct, payload.default_discount_pct,
          s.userId, payload.change_summary,
        ],
      );
      await client.query(
        `INSERT INTO partner_intent_template_history
          (template_id, template_key, title, body_md, edited_by, change_type, change_summary)
         VALUES ($1, $2, $3, $4, $5, 'deactivated', $6)`,
        [req.params.id, old.template_key, old.title, old.body_md, s.userId,
         `Erstattet av ${newKey}`],
      );
      await client.query("COMMIT");
      res.status(201).json({ template_id: newR.rows[0].id, template_key: newKey });
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("[template new-version]", e);
      res.status(String(e).includes("unique") ? 409 : 500).json({
        error: String(e).includes("unique") ? `templateKey '${newKey}' finnes allerede` : "Kunne ikke opprette ny versjon",
      });
    } finally {
      client.release();
    }
  });

  // ---------- Superadmin: deaktiver/aktiver ----------
  app.post("/api/superadmin/partner-intent-templates/:id/set-active", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { isActive, reason } = req.body ?? {};
    if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive må være boolean" });
    const r = await pool.query<{ template_key: string; title: string; body_md: string }>(
      `UPDATE partner_intent_templates
          SET is_active = $1, updated_at = now(), updated_by = $2
        WHERE id = $3
        RETURNING template_key, title, body_md`,
      [isActive, s.userId, req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    await pool.query(
      `INSERT INTO partner_intent_template_history
        (template_id, template_key, title, body_md, edited_by, change_type, change_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.params.id, r.rows[0].template_key, r.rows[0].title, r.rows[0].body_md,
        s.userId, isActive ? "activated" : "deactivated", reason ?? null,
      ],
    );
    res.json({ ok: true });
  });

  // ---------- Superadmin: history for én template ----------
  app.get("/api/superadmin/partner-intent-templates/:id/history", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT h.id, h.template_key, h.title, h.body_md,
              h.default_notice_days, h.default_commission_pct, h.default_discount_pct,
              h.edited_at, h.change_type, h.change_summary,
              u.email AS edited_by_email
         FROM partner_intent_template_history h
         LEFT JOIN users u ON u.id = h.edited_by
        WHERE h.template_id = $1
        ORDER BY h.edited_at DESC`,
      [req.params.id],
    );
    res.json({ history: r.rows });
  });

  // ---------- Superadmin: hent én template (inkl deaktivert) ----------
  app.get("/api/superadmin/partner-intent-templates/:id", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT t.*, cu.email AS created_by_email, uu.email AS updated_by_email,
              (SELECT COUNT(*) FROM partner_intent_agreements pia
                 WHERE pia.template_version = t.template_key
                   AND pia.status = 'signed') AS signed_count,
              (SELECT COUNT(*) FROM partner_intent_agreements pia
                 WHERE pia.template_version = t.template_key) AS total_uses
         FROM partner_intent_templates t
         LEFT JOIN users cu ON cu.id = t.created_by
         LEFT JOIN users uu ON uu.id = t.updated_by
        WHERE t.id = $1`,
      [req.params.id],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ikke funnet" });
    res.json({ template: r.rows[0] });
  });

  // ---------- Superadmin: preview merge ----------
  // POST { templateKey, organizationId, overrides: { ... } }
  app.post("/api/superadmin/partner-intent-templates/preview", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { templateKey, organizationId, overrides } = req.body ?? {};
    const tmplR = await pool.query<{
      title: string; body_md: string; partner_type: string;
      default_notice_days: number | null;
      default_commission_pct: number | null;
      default_discount_pct: number | null;
    }>(
      `SELECT title, body_md, partner_type, default_notice_days,
              default_commission_pct, default_discount_pct
         FROM partner_intent_templates WHERE template_key = $1`,
      [templateKey],
    );
    if (tmplR.rows.length === 0) return res.status(404).json({ error: "Template ikke funnet" });
    const t = tmplR.rows[0];

    const orgR = await pool.query<{ name: string; org_number: string | null; contact_email: string | null }>(
      `SELECT name, org_number, contact_email FROM organizations WHERE id = $1`,
      [organizationId],
    );
    if (orgR.rows.length === 0) return res.status(404).json({ error: "Org ikke funnet" });
    const org = orgR.rows[0];

    const merged = mergeTemplate(t.body_md, {
      ORG_NAME: org.name,
      ORG_NUMBER: org.org_number,
      COMMISSION_PCT: overrides?.commission_pct ?? t.default_commission_pct,
      DISCOUNT_PCT: overrides?.discount_pct ?? t.default_discount_pct,
      NOTICE_DAYS: overrides?.notice_days ?? t.default_notice_days,
    });
    res.json({
      title: t.title,
      body_md: merged,
      partner_type: t.partner_type,
      defaults: {
        notice_days: t.default_notice_days,
        commission_pct: t.default_commission_pct,
        discount_pct: t.default_discount_pct,
      },
      org: { name: org.name, contact_email: org.contact_email },
    });
  });

  // ---------- Superadmin: send intensjonsavtale ----------
  app.post("/api/superadmin/partner-intents", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const {
      organizationId, partnerId, partnerApplicationId,
      title, body_md, partnerType, signerEmail, signerName,
      effectiveFrom, effectiveTo,
      noticeDays, commissionPct, discountPct, templateVersion,
    } = req.body ?? {};
    if (!organizationId || !title || !body_md || !signerEmail) {
      return res.status(400).json({ error: "Mangler felter" });
    }

    const signToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30 dager

    try {
      const r = await pool.query<{ id: string }>(
        `INSERT INTO partner_intent_agreements
          (organization_id, partner_id, partner_application_id, sent_by,
           title, body_md, template_version, partner_type,
           effective_from, effective_to, notice_period_days,
           commission_pct, discount_pct,
           signer_email, signer_name,
           sign_token, sign_token_expires_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17, 'sent')
         RETURNING id`,
        [
          organizationId, partnerId ?? null, partnerApplicationId ?? null, s.userId,
          title, body_md, templateVersion ?? null, partnerType ?? null,
          effectiveFrom ?? null, effectiveTo ?? null,
          noticeDays ?? 30, commissionPct ?? null, discountPct ?? null,
          signerEmail, signerName ?? null,
          signToken, expiresAt,
        ],
      );
      const intentId = r.rows[0].id;

      // Send Resend-mail
      const signUrl = `${PUBLIC_BASE}/leadgrid/intent/${signToken}`;
      try {
        await sendTransactionalEmail({
          to: signerEmail,
          subject: title,
          html: `
            <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0e1a;color:#fff;">
              <h1 style="color:#9be15d;font-size:24px;margin:0 0 8px;">Leadgrid</h1>
              <p>Hei${signerName ? ` ${signerName}` : ""},</p>
              <p>Du har mottatt en intensjonsavtale fra Leadgrid (Creatorhub AS).</p>
              <p>Klikk lenken under for å lese og signere den:</p>
              <p>
                <a href="${signUrl}"
                   style="background:#9be15d;color:#0a0e1a;padding:12px 24px;border-radius:8px;
                          text-decoration:none;font-weight:600;display:inline-block;">
                  Åpne avtalen
                </a>
              </p>
              <p style="color:rgba(255,255,255,0.6);font-size:13px;">
                Lenken er gyldig i 30 dager. Hvis du har spørsmål, svar på denne e-posten.
              </p>
            </div>`,
          text: `Hei${signerName ? ` ${signerName}` : ""},

Du har mottatt en intensjonsavtale fra Leadgrid (Creatorhub AS).

Åpne og signer her: ${signUrl}

Lenken er gyldig i 30 dager.`,
          kind: "partner_intent_agreement",
          sentByUserId: s.userId,
          pool,
        });
      } catch (e) {
        console.error("[partner-intent mail]", e);
      }

      res.status(201).json({ intent_id: intentId, status: "sent" });
    } catch (e) {
      console.error("[partner-intent create]", e);
      res.status(500).json({ error: "Kunne ikke sende intensjonsavtale" });
    }
  });

  // ---------- Superadmin: list sendte intent-avtaler ----------
  app.get("/api/superadmin/partner-intents", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const r = await pool.query(
      `SELECT pi.id, pi.title, pi.status, pi.sent_at, pi.viewed_at,
              pi.signed_at, pi.partner_type, pi.signer_email,
              pi.signer_name, pi.commission_pct, pi.discount_pct,
              o.name AS org_name, o.org_type
         FROM partner_intent_agreements pi
         JOIN organizations o ON o.id = pi.organization_id
        ORDER BY pi.sent_at DESC
        LIMIT 100`,
    );
    res.json({ intents: r.rows });
  });

  // ---------- Public: hent intent-avtale via sign-token ----------
  app.get("/api/leadgrid/intent/:token", async (req, res) => {
    const r = await pool.query<{
      id: string; title: string; body_md: string;
      partner_type: string | null;
      signer_email: string; signer_name: string | null;
      status: string; sign_token_expires_at: string;
      signed_at: string | null;
      view_count: number;
    }>(
      `SELECT id, title, body_md, partner_type, signer_email, signer_name,
              status, sign_token_expires_at, signed_at, view_count
         FROM partner_intent_agreements
        WHERE sign_token = $1`,
      [req.params.token],
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Ugyldig lenke" });
    const intent = r.rows[0];
    if (new Date(intent.sign_token_expires_at) < new Date()) {
      return res.status(410).json({ error: "Lenken er utløpt" });
    }

    // Logg visning (idempotent — første visning oppdaterer viewed_at)
    await pool.query(
      `UPDATE partner_intent_agreements
          SET viewed_at = COALESCE(viewed_at, now()),
              view_count = view_count + 1,
              status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END,
              updated_at = now()
        WHERE sign_token = $1`,
      [req.params.token],
    );

    res.json({
      title: intent.title,
      body_md: intent.body_md,
      partner_type: intent.partner_type,
      signer_name: intent.signer_name,
      status: intent.status === "sent" ? "viewed" : intent.status,
      already_signed: intent.signed_at != null,
    });
  });

  // ---------- Public: signer ----------
  // POST body: { signedNameTyped: string, confirmAuthority: true }
  app.post("/api/leadgrid/intent/:token/sign", async (req, res) => {
    const { signedNameTyped, confirmAuthority } = req.body ?? {};
    if (!signedNameTyped || signedNameTyped.trim().length < 2) {
      return res.status(400).json({ error: "Du må skrive ditt fulle navn for å signere" });
    }
    if (!confirmAuthority) {
      return res.status(400).json({ error: "Du må bekrefte at du har myndighet" });
    }

    const r = await pool.query<{
      id: string; organization_id: string; sent_by: string; title: string;
      agreement_class: string;
    }>(
      `UPDATE partner_intent_agreements
          SET status = 'signed', signed_at = now(),
              signed_name_typed = $1, signed_ip = $2, signed_user_agent = $3,
              updated_at = now()
        WHERE sign_token = $4
          AND status IN ('sent', 'viewed')
          AND sign_token_expires_at > now()
        RETURNING id, organization_id, sent_by, title, agreement_class`,
      [
        signedNameTyped.trim(),
        req.ip ?? null,
        (req.headers["user-agent"] as string) ?? null,
        req.params.token,
      ],
    );
    if (r.rows.length === 0) {
      return res.status(409).json({ error: "Allerede signert, avslått eller utløpt" });
    }
    const result = r.rows[0];

    // Auto-synk testflight_testers hvis denne avtalen er knyttet til en tester
    try {
      if (result.agreement_class === "nda") {
        await pool.query(
          `UPDATE testflight_testers
              SET nda_signed_at = now(),
                  status = CASE WHEN intent_signed_at IS NOT NULL THEN 'active' ELSE status END,
                  updated_at = now()
            WHERE nda_agreement_id = $1`,
          [result.id],
        );
      } else if (result.agreement_class === "beta_tester_terms") {
        await pool.query(
          `UPDATE testflight_testers
              SET intent_signed_at = now(),
                  status = CASE WHEN nda_signed_at IS NOT NULL THEN 'active' ELSE status END,
                  updated_at = now()
            WHERE intent_agreement_id = $1`,
          [result.id],
        );
      }
    } catch (e) { console.error("[intent-sign sync tester]", e); }

    // Varsel til superadmin som sendte den
    const sentByR = await pool.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [result.sent_by]);
    if (sentByR.rows[0]?.email) {
      try {
        await sendTransactionalEmail({
          to: sentByR.rows[0].email,
          subject: `Signert: ${result.title}`,
          html: `<p>Intensjonsavtalen <strong>${result.title}</strong> er nettopp signert av ${signedNameTyped.trim()}.</p>
                 <p><a href="${PUBLIC_BASE}/superadmin">Se i Superadmin</a></p>`,
          text: `Intensjonsavtalen "${result.title}" er signert av ${signedNameTyped.trim()}.`,
          kind: "partner_intent_signed_notification",
          pool,
        });
      } catch (e) { console.error("[intent-signed mail]", e); }
    }

    res.json({ ok: true, status: "signed", signed_at: new Date().toISOString() });
  });

  // ---------- Public: avslå ----------
  app.post("/api/leadgrid/intent/:token/reject", async (req, res) => {
    const { reason } = req.body ?? {};
    const r = await pool.query<{ sent_by: string; title: string }>(
      `UPDATE partner_intent_agreements
          SET status = 'rejected', review_notes = $1,
              signed_ip = $2, signed_user_agent = $3, updated_at = now()
        WHERE sign_token = $4 AND status IN ('sent','viewed')
        RETURNING sent_by, title`,
      [
        reason ?? null, req.ip ?? null,
        (req.headers["user-agent"] as string) ?? null,
        req.params.token,
      ],
    );
    if (r.rows.length === 0) return res.status(409).json({ error: "Kan ikke avslå" });

    const sentByR = await pool.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [r.rows[0].sent_by]);
    if (sentByR.rows[0]?.email) {
      try {
        await sendTransactionalEmail({
          to: sentByR.rows[0].email,
          subject: `Avslått: ${r.rows[0].title}`,
          html: `<p>Intensjonsavtalen <strong>${r.rows[0].title}</strong> ble avslått.</p>
                 ${reason ? `<p><strong>Begrunnelse:</strong> ${reason}</p>` : ""}`,
          text: `Avtalen "${r.rows[0].title}" ble avslått. ${reason ? `Begrunnelse: ${reason}` : ""}`,
          kind: "partner_intent_rejected_notification",
          pool,
        });
      } catch (e) { console.error("[intent-rejected mail]", e); }
    }
    res.json({ ok: true });
  });

  // ---------- Superadmin: tilbakekall ----------
  app.post("/api/superadmin/partner-intents/:id/revoke", async (req, res) => {
    const s = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!s) return;
    const { reason } = req.body ?? {};
    await pool.query(
      `UPDATE partner_intent_agreements
          SET status = 'revoked', revoked_at = now(),
              revoked_by = $1, revoked_reason = $2, updated_at = now()
        WHERE id = $3 AND status IN ('sent','viewed','signed')`,
      [s.userId, reason ?? null, req.params.id],
    );
    res.json({ ok: true });
  });
}
