/**
 * leadgrid-billing-routes.ts
 *
 * Tre lag betaling for Leadgrid:
 *
 *  1) Webhook-håndtering: invoice.paid + invoice.payment_failed for
 *     Leadgrid-subscriptions. Oppdaterer organizations.plan/renews_at,
 *     lagrer i org_invoices, sender Leadgrid-branded Resend-mail (i
 *     tillegg til Stripes egen kvittering).
 *
 *  2) Customer Portal — POST /api/leadgrid/billing/portal-session
 *     gir en engangs-link til Stripe Customer Portal hvor kunden ser
 *     fakturaer, endrer kort, kansellerer.
 *
 *  3) Superadmin payments-overview — aggregert MRR + plan-fordeling
 *     + siste 20 fakturaer.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";
import { sendTransactionalEmail } from "./transactional-email-service.js";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  stripe: Stripe | null;
}

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
  const session = getSession(req, activeSessions);
  if (!session) { res.status(401).json({ error: "Ikke innlogget" }); return null; }
  const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id=$1`, [session.userId]);
  if (r.rows.length === 0 || r.rows[0].role !== "super_admin") {
    res.status(403).json({ error: "Krever super-admin" });
    return null;
  }
  return session;
}

// ---------------------------------------------------------------------------
// Webhook-håndtering for Leadgrid-invoices (kalles fra Stripe-webhook-
// dispatcher i index.ts — ikke en egen webhook-route)
// ---------------------------------------------------------------------------

/**
 * Sjekk om en Stripe-subscription er Leadgrid (vs. CreatorHub/Role Room).
 * Bruker price-metadata.product_family = "leadgrid".
 */
export async function isLeadgridInvoice(
  stripe: Stripe, invoice: Stripe.Invoice,
): Promise<{ isLeadgrid: boolean; planKey: string | null }> {
  try {
    const items = invoice.lines?.data ?? [];
    for (const line of items) {
      const priceId = (line as any).price?.id ?? (line as any).pricing?.price_details?.price;
      if (!priceId) continue;
      const price = await stripe.prices.retrieve(priceId);
      const family = (price.metadata as any)?.product_family;
      const planKey = (price.metadata as any)?.plan_key;
      if (family === "leadgrid") {
        return { isLeadgrid: true, planKey: planKey ?? null };
      }
    }
  } catch (e) {
    console.error("[leadgrid-billing] isLeadgridInvoice failed", e);
  }
  return { isLeadgrid: false, planKey: null };
}

/**
 * Behandle invoice.paid for Leadgrid:
 *  - Oppdater organizations.plan + plan_renews_at
 *  - Lagre i org_invoices
 *  - Send branded Resend-mail (i tillegg til Stripes kvittering)
 */
export async function handleLeadgridInvoicePaid(
  pool: Pool, stripe: Stripe, invoice: Stripe.Invoice, planKey: string | null,
): Promise<void> {
  if (!invoice.customer) return;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer.id;

  // Finn org via stripe_customer_id
  const orgR = await pool.query<{ id: string; name: string; contact_email: string | null }>(
    `SELECT id, name, contact_email FROM organizations WHERE stripe_customer_id = $1`,
    [customerId],
  );
  if (orgR.rows.length === 0) {
    console.error(`[leadgrid-billing] Ingen org for stripe_customer_id=${customerId}`);
    return;
  }
  const org = orgR.rows[0];

  // Oppdater plan + neste-fornyelse
  const subId = (invoice as any).parent?.subscription_details?.subscription
              ?? (invoice as any).subscription
              ?? null;
  if (planKey) {
    const renewsAtUnix = ((invoice as any).period_end as number | null)
                     ?? ((invoice.lines?.data?.[0] as any)?.period?.end as number | null)
                     ?? null;
    await pool.query(
      `UPDATE organizations
          SET plan = $1,
              plan_started_at = COALESCE(plan_started_at, now()),
              plan_renews_at = CASE WHEN $2::bigint IS NULL THEN plan_renews_at
                                    ELSE to_timestamp($2::bigint) END,
              stripe_subscription_id = COALESCE($3, stripe_subscription_id)
        WHERE id = $4`,
      [planKey, renewsAtUnix, subId, org.id],
    );
    // Drop grace hvis det fantes
    await pool.query(`DELETE FROM plan_grace WHERE organization_id = $1`, [org.id]);
  }

  // Lagre i org_invoices (UPSERT på stripe_invoice_id)
  const periodStart = (invoice as any).period_start
                  ?? (invoice.lines?.data?.[0] as any)?.period?.start;
  const periodEnd   = (invoice as any).period_end
                  ?? (invoice.lines?.data?.[0] as any)?.period?.end;
  await pool.query(
    `INSERT INTO org_invoices
      (organization_id, stripe_invoice_id, stripe_subscription_id, stripe_customer_id,
       amount_due_oere, amount_paid_oere, vat_oere, currency, status,
       period_start, period_end, invoice_number,
       hosted_invoice_url, invoice_pdf_url, plan_key, description, raw_event)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10), to_timestamp($11),
             $12, $13, $14, $15, $16, $17)
     ON CONFLICT (stripe_invoice_id) DO UPDATE
       SET status         = EXCLUDED.status,
           amount_paid_oere = EXCLUDED.amount_paid_oere,
           hosted_invoice_url = EXCLUDED.hosted_invoice_url,
           invoice_pdf_url    = EXCLUDED.invoice_pdf_url,
           updated_at = now()`,
    [
      org.id, invoice.id, subId, customerId,
      invoice.amount_due, invoice.amount_paid, (invoice as any).tax ?? 0,
      invoice.currency ?? "nok", invoice.status ?? "paid",
      periodStart, periodEnd, invoice.number,
      invoice.hosted_invoice_url, invoice.invoice_pdf,
      planKey, invoice.description ?? null,
      JSON.stringify(invoice),
    ],
  );

  // Send Leadgrid-branded Resend-mail (i tillegg til Stripes egen kvittering)
  if (org.contact_email) {
    const amountNok = ((invoice.amount_paid ?? 0) / 100).toFixed(2).replace(".", ",");
    try {
      await sendTransactionalEmail({
        to: org.contact_email,
        subject: `Tusen takk — ${org.name} er på gridden`,
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0e1a;color:#fff;">
            <h1 style="color:#9be15d;font-size:24px;margin:0 0 8px;">Leadgrid</h1>
            <p style="color:#fff;font-size:16px;">Hei,</p>
            <p style="color:rgba(255,255,255,0.85);">
              Vi har mottatt <strong>${amountNok} NOK</strong> for ${org.name}'s
              ${planKey === "solo_pro" ? "Solo Pro" : planKey === "agency" ? "Agency" : "Leadgrid"}-abonnement.
              Gridden er aktiv ut perioden.
            </p>
            <div style="margin:24px 0;padding:16px;background:rgba(255,255,255,0.06);border-radius:8px;">
              <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px;">Faktura</p>
              <p style="color:#fff;font-weight:600;margin:4px 0 0;font-size:18px;">${invoice.number ?? invoice.id}</p>
            </div>
            ${invoice.hosted_invoice_url ? `
              <p>
                <a href="${invoice.hosted_invoice_url}"
                   style="background:#9be15d;color:#0a0e1a;padding:12px 20px;border-radius:8px;
                          text-decoration:none;font-weight:600;display:inline-block;">
                  Se faktura
                </a>
              </p>` : ""}
            ${invoice.invoice_pdf ? `
              <p style="color:rgba(255,255,255,0.6);font-size:13px;">
                Last ned PDF: <a href="${invoice.invoice_pdf}" style="color:#9be15d;">${invoice.number ?? "faktura"}.pdf</a>
              </p>` : ""}
            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;" />
            <p style="color:rgba(255,255,255,0.5);font-size:12px;">
              Trenger du noe? Svar på denne e-posten. Leadgrid · Creatorhub AS
            </p>
          </div>
        `,
        text: `Hei,\n\nVi har mottatt ${amountNok} NOK for ${org.name}'s Leadgrid-abonnement. Faktura ${invoice.number ?? invoice.id}.\n\nSe faktura: ${invoice.hosted_invoice_url ?? ""}\nLast ned PDF: ${invoice.invoice_pdf ?? ""}\n\nTrenger du noe? Svar på denne e-posten.\nLeadgrid · Creatorhub AS`,
        kind: "leadgrid_invoice_paid",
        pool,
      });
      await pool.query(
        `UPDATE org_invoices SET leadgrid_mail_sent_at = now()
         WHERE stripe_invoice_id = $1`, [invoice.id],
      );
    } catch (e) {
      console.error("[leadgrid-billing] branded-mail failed", e);
    }
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerLeadgridBillingRoutes({
  app, pool, activeSessions, stripe,
}: Deps): void {

  // ---------- Customer Portal session (én engangs-link) ----------
  app.post("/api/leadgrid/billing/portal-session", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    if (!stripe) return res.status(500).json({ error: "Stripe ikke konfigurert" });
    const { orgId, returnUrl } = req.body ?? {};
    if (!orgId) return res.status(400).json({ error: "orgId påkrevd" });

    // Bekreft medlemskap
    const memberR = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
       UNION SELECT 1 FROM users WHERE id = $2 AND role = 'super_admin'`,
      [orgId, session.userId],
    );
    if (memberR.rows.length === 0) {
      return res.status(403).json({ error: "Ikke medlem av org'en" });
    }

    const orgR = await pool.query<{ stripe_customer_id: string | null; name: string }>(
      `SELECT stripe_customer_id, name FROM organizations WHERE id = $1`, [orgId],
    );
    if (orgR.rows.length === 0 || !orgR.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: "Org har ingen Stripe-kunde ennå" });
    }

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: orgR.rows[0].stripe_customer_id!,
        return_url: returnUrl || `https://theroleroom.com/leadgrid?orgId=${orgId}`,
      });
      res.json({ url: portalSession.url });
    } catch (e: any) {
      console.error("[billing] portal session failed", e);
      res.status(500).json({ error: e.message ?? "Stripe-feil" });
    }
  });

  // ---------- Org's egne fakturaer ----------
  app.get("/api/leadgrid/billing/invoices", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const orgId = (req.query.orgId as string) ?? null;
    if (!orgId) return res.status(400).json({ error: "orgId påkrevd" });
    const memberR = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
       UNION SELECT 1 FROM users WHERE id = $2 AND role = 'super_admin'`,
      [orgId, session.userId],
    );
    if (memberR.rows.length === 0) {
      return res.status(403).json({ error: "Ikke medlem av org'en" });
    }
    const r = await pool.query(
      `SELECT id, stripe_invoice_id, amount_paid_oere, currency, status,
              period_start, period_end, invoice_number, hosted_invoice_url,
              invoice_pdf_url, plan_key, created_at
         FROM org_invoices
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [orgId],
    );
    res.json({ invoices: r.rows });
  });

  // ---------- Superadmin: payments-overview ----------
  app.get("/api/superadmin/payments-overview", async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;

    try {
      // MRR per plan-key (sum av aktive månedlige abonnementer)
      const mrrR = await pool.query(
        `SELECT o.plan,
                COUNT(*) AS active_orgs,
                COALESCE(SUM(p.price_monthly_nok), 0) AS mrr_nok
           FROM organizations o
           LEFT JOIN plan_limits p ON p.plan_key = o.plan
          WHERE o.stripe_subscription_id IS NOT NULL
            AND o.plan_renews_at > now()
          GROUP BY o.plan
          ORDER BY mrr_nok DESC NULLS LAST`,
      );

      // Total ARR + lifetime revenue
      const lifetimeR = await pool.query(
        `SELECT COALESCE(SUM(amount_paid_oere), 0) / 100 AS lifetime_nok,
                COUNT(*) AS total_invoices
           FROM org_invoices
          WHERE status = 'paid'`,
      );

      // Siste 30 fakturaer på tvers av alle orgs
      const recentR = await pool.query(
        `SELECT i.id, i.invoice_number, i.amount_paid_oere, i.currency,
                i.status, i.created_at, i.hosted_invoice_url, i.plan_key,
                o.name AS org_name, o.org_type
           FROM org_invoices i
           JOIN organizations o ON o.id = i.organization_id
          ORDER BY i.created_at DESC
          LIMIT 30`,
      );

      // Churn-rate (orgs som downgrade'et eller payment_failed siste 30d)
      const churnR = await pool.query(
        `SELECT COUNT(*) AS count
           FROM plan_grace
          WHERE starts_at > now() - interval '30 days'`,
      );

      const mrrTotal = mrrR.rows.reduce((s, r) => s + Number(r.mrr_nok), 0);
      res.json({
        mrr_nok_total: mrrTotal,
        arr_nok_estimate: mrrTotal * 12,
        lifetime_nok: Number(lifetimeR.rows[0]?.lifetime_nok ?? 0),
        total_paid_invoices: Number(lifetimeR.rows[0]?.total_invoices ?? 0),
        churn_orgs_30d: Number(churnR.rows[0]?.count ?? 0),
        by_plan: mrrR.rows,
        recent_invoices: recentR.rows,
      });
    } catch (e) {
      console.error("[superadmin payments] failed", e);
      res.status(500).json({ error: "Kunne ikke hente payments-overview" });
    }
  });

  // ---------- Superadmin: per-org invoices ----------
  app.get("/api/superadmin/organizations/:id/invoices", async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    const r = await pool.query(
      `SELECT id, stripe_invoice_id, amount_paid_oere, currency, status,
              period_start, period_end, invoice_number, hosted_invoice_url,
              invoice_pdf_url, plan_key, leadgrid_mail_sent_at, created_at
         FROM org_invoices
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [req.params.id],
    );
    res.json({ invoices: r.rows });
  });
}
