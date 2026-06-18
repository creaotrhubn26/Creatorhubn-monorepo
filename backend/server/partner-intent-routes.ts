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
    const r = await pool.query(
      `SELECT id, template_key, partner_type, title, body_md,
              default_notice_days, default_commission_pct, default_discount_pct
         FROM partner_intent_templates WHERE is_active = TRUE
         ORDER BY partner_type ASC, template_key ASC`,
    );
    res.json({ templates: r.rows });
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

    const r = await pool.query<{ organization_id: string; sent_by: string; title: string }>(
      `UPDATE partner_intent_agreements
          SET status = 'signed', signed_at = now(),
              signed_name_typed = $1, signed_ip = $2, signed_user_agent = $3,
              updated_at = now()
        WHERE sign_token = $4
          AND status IN ('sent', 'viewed')
          AND sign_token_expires_at > now()
        RETURNING organization_id, sent_by, title`,
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
