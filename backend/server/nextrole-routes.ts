/**
 * nextrole-routes.ts
 *
 * Endepunkter spesifikke for NextRole-livssyklusen:
 *
 *   GET  /api/marketplace/next-role/entitlement
 *     → Returnerer brukerens nåværende tier (guest|trial|standard|pro)
 *       + trialEndsAt + currentPeriodEnd. Brukes av frontend
 *       useNextRoleEntitlements-hook for å sjekke om Pro-features er låst opp.
 *
 *   POST /api/marketplace/next-role/start-trial
 *     → Aktiverer 14-dagers trial for innlogget bruker.
 *       Oppretter marketplace_installations-rad.
 *       Sender velkomst- og trial-startet-e-poster.
 *
 *   POST /api/internal/next-role/webhook-stripe-handler
 *     → Internt endepunkt (kalles fra Stripe-webhook). Håndterer
 *       checkout.session.completed for NextRole-kjøp:
 *       - Oppretter/oppdaterer marketplace_installations
 *       - Sender kvittering-e-post
 *       - Setter tier basert på subscription metadata
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupNextRoleRoutes } from "./nextrole-routes";
 *   setupNextRoleRoutes({ app, pool, getActiveSessionFromRequest });
 *
 * Webhook-håndtering: importer handleNextRoleCheckoutCompleted og kall
 * den fra eksisterende checkout.session.completed-case i index.ts.
 */

import type express from "express";
import type { Pool } from "pg";
import type Stripe from "stripe";
import {
  sendNextRoleWelcomeEmail,
  sendNextRoleTrialStartedEmail,
  sendNextRolePaymentReceiptEmail,
  sendNextRoleTrialExpiringEmail,
} from "./nextrole-email-service";

export interface NextRoleRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string; email?: string; firstName?: string } | null;
}

// ── Helper: les bruker fra DB ───────────────────────────────────────

async function fetchUserContact(
  pool: Pool,
  userId: string,
): Promise<{ email: string | null; firstName: string }> {
  const r = await pool.query(
    `SELECT email, first_name, name FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  if (!r.rowCount) return { email: null, firstName: "" };
  const row = r.rows[0];
  const first =
    (row.first_name as string) ??
    ((row.name as string) ?? "").split(" ")[0] ??
    "";
  return { email: row.email as string | null, firstName: first };
}

// ── Helper: hent installation row ───────────────────────────────────

interface InstallationRow {
  id: string;
  user_id: string;
  app_id: string;
  installed_at: Date;
  is_active: boolean;
  tier: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  settings: Record<string, unknown> | null;
}

async function getInstallation(
  pool: Pool,
  userId: string,
): Promise<InstallationRow | null> {
  const r = await pool.query<InstallationRow>(
    `SELECT * FROM marketplace_installations
      WHERE user_id = $1 AND app_id = 'next-role'
      LIMIT 1`,
    [userId],
  );
  return r.rowCount ? r.rows[0] : null;
}

// ════════════════════════════════════════════════════════════════════
// WEBHOOK-HANDLER (importeres av index.ts)
// ════════════════════════════════════════════════════════════════════

interface WebhookResult {
  matched: boolean;
  message?: string;
}

/**
 * Håndterer checkout.session.completed for NextRole-kjøp.
 * Returnerer { matched: true } hvis session var NextRole-relatert,
 * { matched: false } hvis den var for andre apper (slik at andre
 * handlers kan håndtere den).
 */
export async function handleNextRoleCheckoutCompleted(
  pool: Pool,
  session: Stripe.Checkout.Session,
): Promise<WebhookResult> {
  const meta = session.metadata ?? {};
  if (meta.app_id !== "next-role") {
    return { matched: false };
  }
  const userId = meta.user_id || null;
  const tierId = (meta.tier_id as "standard" | "pro") || "standard";
  if (!userId) {
    console.warn("[nextrole-webhook] No user_id in session metadata", {
      sessionId: session.id,
    });
    return { matched: true, message: "no_user_id" };
  }
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  // Upsert installation
  await pool.query(
    `INSERT INTO marketplace_installations (
       user_id, app_id, is_active, tier,
       stripe_customer_id, stripe_subscription_id,
       trial_ends_at, status_updated_at, settings
     ) VALUES (
       $1, 'next-role', TRUE, $2, $3, $4, $5, NOW(), $6::jsonb
     )
     ON CONFLICT (user_id, app_id) DO UPDATE SET
       is_active = TRUE,
       tier = EXCLUDED.tier,
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       trial_ends_at = EXCLUDED.trial_ends_at,
       status_updated_at = NOW(),
       settings = marketplace_installations.settings || EXCLUDED.settings`,
    [
      userId,
      tierId,
      customerId,
      subscriptionId,
      trialEndsAt,
      JSON.stringify({
        sessionId: session.id,
        purchasedAt: new Date().toISOString(),
      }),
    ],
  );

  // Send kvittering-e-post
  const contact = await fetchUserContact(pool, userId);
  if (contact.email) {
    const amountOre = (session.amount_total ?? 0);
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    await sendNextRolePaymentReceiptEmail(contact.email, contact.firstName, {
      tierId,
      amountOre,
      currency: session.currency?.toUpperCase() ?? "NOK",
      invoiceId: typeof session.invoice === "string"
        ? session.invoice
        : session.invoice?.id,
      nextBillingDate,
    });
  }

  return { matched: true, message: `nextrole_${tierId}_purchased` };
}

/**
 * Håndterer subscription-cancellations.
 */
export async function handleNextRoleSubscriptionDeleted(
  pool: Pool,
  subscription: Stripe.Subscription,
): Promise<WebhookResult> {
  const meta = subscription.metadata ?? {};
  if (meta.app_id !== "next-role") {
    return { matched: false };
  }
  const userId = meta.user_id;
  if (!userId) return { matched: true, message: "no_user_id" };

  await pool.query(
    `UPDATE marketplace_installations
        SET tier = 'cancelled',
            is_active = FALSE,
            status_updated_at = NOW()
      WHERE user_id = $1 AND app_id = 'next-role'`,
    [userId],
  );
  return { matched: true, message: "nextrole_cancelled" };
}

// ════════════════════════════════════════════════════════════════════
// SETUP ROUTES
// ════════════════════════════════════════════════════════════════════

export function setupNextRoleRoutes(deps: NextRoleRoutesDeps): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  const requireSession = (
    req: express.Request,
    res: express.Response,
  ): { userId: string; email?: string; firstName?: string } | null => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  };

  // ── GET entitlement ─────────────────────────────────────────────
  app.get("/api/marketplace/next-role/entitlement", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.json({ tier: "guest", hasActiveSubscription: false });
      return;
    }
    const installation = await getInstallation(pool, session.userId);
    if (!installation) {
      res.json({
        tier: "guest",
        hasActiveSubscription: false,
        isAuthenticated: true,
      });
      return;
    }
    // Sjekk om trial er utløpt
    const now = new Date();
    let tier = installation.tier ?? "guest";
    if (
      installation.tier === "trial" &&
      installation.trial_ends_at &&
      installation.trial_ends_at < now
    ) {
      tier = "guest"; // utløpt — må kjøpe
    }
    const trialDaysLeft = installation.trial_ends_at
      ? Math.max(
          0,
          Math.ceil(
            (installation.trial_ends_at.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    res.json({
      tier,
      hasActiveSubscription: installation.is_active && tier !== "cancelled" && tier !== "guest",
      isAuthenticated: true,
      isTrial: installation.tier === "trial",
      trialDaysLeft,
      trialEndsAt: installation.trial_ends_at?.toISOString() ?? null,
      currentPeriodEnd: installation.current_period_end?.toISOString() ?? null,
    });
  });

  // ── POST start-trial ────────────────────────────────────────────
  app.post("/api/marketplace/next-role/start-trial", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;

    const existing = await getInstallation(pool, session.userId);
    if (existing?.tier && existing.tier !== "guest" && existing.tier !== "cancelled") {
      // Allerede aktiv — ikke restart
      res.json({
        already_active: true,
        tier: existing.tier,
        trialEndsAt: existing.trial_ends_at?.toISOString() ?? null,
      });
      return;
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    await pool.query(
      `INSERT INTO marketplace_installations (
         user_id, app_id, is_active, tier, trial_ends_at,
         status_updated_at, settings
       ) VALUES (
         $1, 'next-role', TRUE, 'trial', $2, NOW(), $3::jsonb
       )
       ON CONFLICT (user_id, app_id) DO UPDATE SET
         is_active = TRUE,
         tier = 'trial',
         trial_ends_at = EXCLUDED.trial_ends_at,
         status_updated_at = NOW()`,
      [session.userId, trialEndsAt, JSON.stringify({ trialStartedAt: new Date().toISOString() })],
    );

    // Send velkomst + trial-startet (best effort, ikke blokker respons)
    const contact = await fetchUserContact(pool, session.userId);
    if (contact.email) {
      void sendNextRoleWelcomeEmail(contact.email, contact.firstName);
      void sendNextRoleTrialStartedEmail(
        contact.email,
        contact.firstName,
        trialEndsAt,
      );
    }

    res.json({
      tier: "trial",
      trialEndsAt: trialEndsAt.toISOString(),
      trialDaysLeft: 14,
    });
  });

  // ── POST trial-expiry-cron (kalles internt fra cron-job) ────────
  // Finner brukere med ~3 dager igjen av trial og sender varsel.
  app.post("/api/internal/next-role/check-trial-expiry", async (req, res) => {
    // Enkel intern-auth: krev en delt secret via header. Settes som
    // env-var NEXTROLE_CRON_SECRET. Cron-job må passere headeren.
    const provided = req.headers["x-cron-secret"];
    if (provided !== process.env.NEXTROLE_CRON_SECRET) {
      res.status(401).json({ error: "invalid_cron_secret" });
      return;
    }
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

    // Finn brukere med 3-4 dager igjen som ikke har fått varsel ennå
    // (settings.trialExpiringEmailSent IS NULL or false)
    const r = await pool.query(
      `SELECT mi.user_id, mi.trial_ends_at,
              u.email, u.first_name, u.name
         FROM marketplace_installations mi
         LEFT JOIN users u ON u.id = mi.user_id
        WHERE mi.app_id = 'next-role'
          AND mi.tier = 'trial'
          AND mi.is_active = TRUE
          AND mi.trial_ends_at BETWEEN $1 AND $2
          AND (mi.settings ->> 'trialExpiringEmailSent') IS DISTINCT FROM 'true'`,
      [threeDaysFromNow, fourDaysFromNow],
    );
    let sent = 0;
    for (const row of r.rows) {
      const email = row.email as string | null;
      const firstName =
        (row.first_name as string | null) ??
        ((row.name as string | null) ?? "").split(" ")[0] ??
        "";
      if (!email) continue;
      const trialEndsAt = row.trial_ends_at as Date;
      const daysLeft = Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const result = await sendNextRoleTrialExpiringEmail(
        email,
        firstName,
        daysLeft,
        trialEndsAt,
        "standard",
      );
      if (result.sent) {
        await pool.query(
          `UPDATE marketplace_installations
              SET settings = settings || '{"trialExpiringEmailSent": true}'::jsonb
            WHERE user_id = $1 AND app_id = 'next-role'`,
          [row.user_id],
        );
        sent += 1;
      }
    }
    res.json({ checked: r.rowCount, sent });
  });
}
