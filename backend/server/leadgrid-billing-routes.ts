/**
 * leadgrid-billing-routes.ts
 *
 * Organisasjonseid betaling for Leadgrid:
 *
 *  1) Customer Portal — POST /api/leadgrid/billing/portal-session
 *     gir en engangs-link til Stripe Customer Portal hvor kunden ser
 *     fakturaer, endrer kort, kansellerer.
 *
 *  2) Superadmin payments-overview — aggregert MRR + plan-fordeling
 *     + siste 20 fakturaer.
 *
 * Webhookjournal, Stripe-projisering og provisioning ligger samlet i
 * leadgrid-billing-service.ts. Rutene her har ingen alternativ skrivesti.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";
import {
  LeadgridBillingError,
  LEADGRID_AI_STRUCTURE_PRICE,
  provisionLeadgridInvoiceSubscription,
  setLeadgridStorageAddonQuantity,
} from "./leadgrid-billing-service.js";
import { getLeadgridOrganizationStorageStatus } from "./leadgrid-org-storage-service.js";

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEADGRID_PUBLIC_BASE = (process.env.LEADGRID_PUBLIC_URL ?? "https://leadgrid.no")
  .replace(/\/+$/, "");

type BillingOrganizationResolution = {
  organizationId: string | null;
  error?: "orgId_påkrevd" | "ugyldig_orgId";
};

/** Eksplisitt tenant-scope for både native klient og web. */
export function resolveBillingOrganizationId(req: Request): BillingOrganizationResolution {
  const body = req.body as { orgId?: unknown; organization_id?: unknown } | undefined;
  const candidates: unknown[] = [
    body?.orgId,
    body?.organization_id,
    req.query.orgId,
    req.query.organization_id,
    req.get("X-Leadgrid-Organization-Id"),
  ];
  const raw = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  if (typeof raw !== "string") return { organizationId: null, error: "orgId_påkrevd" };
  const organizationId = raw.trim();
  if (!UUID_PATTERN.test(organizationId)) {
    return { organizationId: null, error: "ugyldig_orgId" };
  }
  return { organizationId };
}

/** Checkout, betalingsdata og Stripe-portal er kun for faktisk org-admin. */
export async function canManageLeadgridBilling(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM organization_members
        WHERE organization_id = $1::uuid
          AND user_id = $2
          AND role = 'admin'
     ) AS allowed`,
    [organizationId, userId],
  );
  return result.rows[0]?.allowed === true;
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
// Routes
// ---------------------------------------------------------------------------

export function registerLeadgridBillingRoutes({
  app, pool, activeSessions, stripe,
}: Deps): void {

  // ---------- Provisjonér org → Stripe-kunde + faktura-abonnement ----------
  // (2026-07-17, Daniel: «dette skal fungere som faktura til bedrifter og
  // være koblet til organisasjonen».) Superadmin kobler en org til Stripe:
  // customer m/ org-metadata + subscription med collection_method=
  // send_invoice (ekte B2B-faktura på e-post m/ forfall, ikke kortbelastning).
  // Plan-prisene bærer product_family=leadgrid + plan_key i metadata —
  // den durable webhook-workerens autoritative Stripe-oppslag bruker dette.
  // AI-tillegget (5 kr/kall-meteret) legges på når include_ai=true.
  // Priser kan overstyres via env (default = live-prisene per 2026-07-17).
  const PLAN_PRICES: Record<string, Record<string, string>> = {
    solo_pro: {
      month: process.env.LEADGRID_PRICE_SOLO_MONTH ?? "price_1TjcdoApjenweKvPYAngQd59",
      year: process.env.LEADGRID_PRICE_SOLO_YEAR ?? "price_1TjcdpApjenweKvPQa3SL4lq",
    },
    agency: {
      month: process.env.LEADGRID_PRICE_AGENCY_MONTH ?? "price_1TjcdqApjenweKvPvLZZ220h",
      year: process.env.LEADGRID_PRICE_AGENCY_YEAR ?? "price_1TjcdqApjenweKvPJeskBX00",
    },
  };
  const AI_PRICE = LEADGRID_AI_STRUCTURE_PRICE;

  app.post("/api/leadgrid/billing/provision", async (req, res) => {
    const session = await requireSuperAdmin(req, res, pool, activeSessions);
    if (!session) return;
    if (!stripe) return res.status(500).json({ error: "Stripe ikke konfigurert" });

    const b = (req.body ?? {}) as Record<string, unknown>;
    const orgId = typeof b.organization_id === "string" ? b.organization_id : "";
    const plan = typeof b.plan === "string" ? b.plan : "";
    const interval = b.interval === "year" ? "year" : "month";
    const includeAI = b.include_ai === true;
    const daysUntilDue = Number.isFinite(Number(b.days_until_due))
      ? Math.max(1, Math.min(90, Math.trunc(Number(b.days_until_due)))) : 14;
    const billingEmail = typeof b.billing_email === "string" ? b.billing_email.trim() : "";
    if (!orgId) return res.status(400).json({ error: "organization_id påkrevd" });
    const planPrice = PLAN_PRICES[plan]?.[interval];
    if (!planPrice) return res.status(400).json({ error: "ugyldig_plan", valid: Object.keys(PLAN_PRICES) });

    try {
      const provisioned = await provisionLeadgridInvoiceSubscription({
        pool,
        stripe,
        organizationId: orgId,
        planKey: plan,
        interval,
        planPriceId: planPrice,
        aiPriceId: AI_PRICE,
        includeAI,
        daysUntilDue,
        billingEmail,
      });
      await pool.query(
        `INSERT INTO superadmin_audit_log (
           super_admin_id, action, target_org_id, details, ip_address, user_agent
         ) VALUES ($1, 'provision_leadgrid_billing', $2::uuid, $3::jsonb, $4, $5)`,
        [
          session.userId,
          orgId,
          JSON.stringify({ plan, interval, includeAI, daysUntilDue }),
          req.ip ?? null,
          req.get("user-agent") ?? null,
        ],
      );

      return res.status(201).json({
        ok: true,
        stripe_customer_id: provisioned.customerId,
        stripe_subscription_id: provisioned.subscriptionId,
        plan, interval,
        collection_method: "send_invoice",
        days_until_due: daysUntilDue,
        ai_addon: includeAI,
      });
    } catch (e) {
      if (e instanceof LeadgridBillingError) {
        return res.status(e.status).json({ error: e.code, ...e.details });
      }
      console.error("[leadgrid-billing] provision failed", e);
      return res.status(500).json({ error: "provision_failed" });
    }
  });

  // ---------- Customer Portal session (én engangs-link, kun org-admin) ----------
  app.post("/api/leadgrid/billing/portal-session", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const target = resolveBillingOrganizationId(req);
    if (!target.organizationId) {
      return res.status(400).json({ error: target.error });
    }
    const orgId = target.organizationId;
    if (!(await canManageLeadgridBilling(pool, session.userId, orgId))) {
      return res.status(403).json({ error: "Krever organisasjonsadministrator" });
    }
    if (!stripe) return res.status(500).json({ error: "Stripe ikke konfigurert" });

    const orgR = await pool.query<{ stripe_customer_id: string | null; name: string }>(
      `SELECT stripe_customer_id, name FROM organizations WHERE id = $1`, [orgId],
    );
    if (orgR.rows.length === 0 || !orgR.rows[0].stripe_customer_id) {
      return res.status(404).json({ error: "Org har ingen Stripe-kunde ennå" });
    }

    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: orgR.rows[0].stripe_customer_id!,
        return_url: `${LEADGRID_PUBLIC_BASE}/?billing=return`,
      });
      res.json({ url: portalSession.url });
    } catch (e: any) {
      console.error("[billing] portal session failed", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------- Org-admins fakturaer ----------
  app.get("/api/leadgrid/billing/invoices", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const target = resolveBillingOrganizationId(req);
    if (!target.organizationId) {
      return res.status(400).json({ error: target.error });
    }
    const orgId = target.organizationId;
    if (!(await canManageLeadgridBilling(pool, session.userId, orgId))) {
      return res.status(403).json({ error: "Krever organisasjonsadministrator" });
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

  // ---------- Organisasjonens lagring (alle medlemmer kan lese) ----------
  app.get("/api/leadgrid/billing/storage", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const target = resolveBillingOrganizationId(req);
    if (!target.organizationId) return res.status(400).json({ error: target.error });
    const member = await pool.query(
      `SELECT 1 FROM organization_members
        WHERE organization_id = $1::uuid AND user_id = $2
        LIMIT 1`,
      [target.organizationId, session.userId],
    );
    if (!member.rows.length) return res.status(403).json({ error: "Ikke medlem av organisasjonen" });
    const storage = await getLeadgridOrganizationStorageStatus(pool, target.organizationId);
    if (!storage) return res.status(404).json({ error: "org_ikke_funnet" });
    return res.json({ storage });
  });

  // Fast +100 GiB-linje på samme org-abonnement. Webhooken projiserer den
  // autoritative Stripe-tilstanden på nytt etterpå.
  app.put("/api/leadgrid/billing/storage-addon", async (req, res) => {
    const session = getSession(req, activeSessions);
    if (!session) return res.status(401).json({ error: "Ikke innlogget" });
    const target = resolveBillingOrganizationId(req);
    if (!target.organizationId) return res.status(400).json({ error: target.error });
    if (!(await canManageLeadgridBilling(pool, session.userId, target.organizationId))) {
      return res.status(403).json({ error: "Krever organisasjonsadministrator" });
    }
    if (!stripe) return res.status(500).json({ error: "Stripe ikke konfigurert" });
    const priceId = process.env.LEADGRID_PRICE_STORAGE_100_GIB?.trim();
    if (!priceId) return res.status(503).json({ error: "lagringstillegg_ikke_konfigurert" });
    const quantity = Number((req.body as { quantity?: unknown } | undefined)?.quantity);
    try {
      const addon = await setLeadgridStorageAddonQuantity({
        pool,
        stripe,
        organizationId: target.organizationId,
        quantity,
        priceId,
      });
      const storage = await getLeadgridOrganizationStorageStatus(pool, target.organizationId);
      return res.json({ ok: true, addon, storage });
    } catch (error) {
      if (error instanceof LeadgridBillingError) {
        return res.status(error.status).json({ error: error.code, ...error.details });
      }
      console.error("[leadgrid-billing] storage add-on failed", error);
      return res.status(500).json({ error: "storage_addon_failed" });
    }
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
