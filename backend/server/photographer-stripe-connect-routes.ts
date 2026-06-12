/**
 * photographer-stripe-connect-routes.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Stripe Connect-onboarding for fotografer/skapere. Bildekjøp skal betales til
 * FOTOGRAFENS egen Stripe-konto (destination charge i client-gallery-checkout),
 * ikke CreatorHubs plattform-konto. Dette modulet eier *koblingen*: opprette en
 * Express connected-account, generere onboarding-link, og rapportere status til
 * settings-panelet + onboarding-flyten i Universal Dashboard.
 *
 * Følger samme Stripe Connect-mønster som academy_instructors
 * (admin-academy-routes.ts): stripe.accounts.create({ type: 'express' }) +
 * stripe.accountLinks.create(...) + status fra payouts_enabled/details_submitted.
 *
 * Selve destination-charge-endringen i checkouten er en separat fase som leser
 * stripe_account_id herfra.
 */

import type express from "express";
import type Stripe from "stripe";

type AnyPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export interface PhotographerStripeConnectDeps {
  app: express.Application;
  pool: AnyPool;
  /** Returns the authenticated user session ({ userId, email }) or null (and writes a 401). */
  requireUserSession: (req: any, res: any) => { userId: string; email?: string | null } | null;
  /** Lazily resolves the platform Stripe client (null when not configured). */
  getStripe: () => Stripe | null;
  /** Base URL for Stripe onboarding return/refresh redirects. */
  getReturnBaseUrl: () => string;
}

interface AccountRow {
  photographer_id: string;
  stripe_account_id: string;
  onboarding_status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
}

const isMissingTable = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: string }).code === "42P01";

export function setupPhotographerStripeConnectRoutes(
  deps: PhotographerStripeConnectDeps,
): void {
  const { app, pool, requireUserSession, getStripe, getReturnBaseUrl } = deps;

  async function fetchRow(photographerId: string): Promise<AccountRow | null> {
    try {
      const result = await pool.query(
        `SELECT photographer_id, stripe_account_id, onboarding_status,
                charges_enabled, payouts_enabled, details_submitted, country
           FROM photographer_stripe_accounts
          WHERE photographer_id = $1`,
        [photographerId],
      );
      return (result.rows[0] as AccountRow) || null;
    } catch (err) {
      if (isMissingTable(err)) return null; // migrasjon 261 ikke kjørt ennå
      throw err;
    }
  }

  /**
   * GET /api/photographer/stripe/status
   * Status for koblingen — driver settings-panelet og onboarding-steget.
   * Når en konto finnes spør vi Stripe live etter ferske KYC-flagg.
   */
  app.get("/api/photographer/stripe/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    let row: AccountRow | null = null;
    try {
      row = await fetchRow(session.userId);
    } catch (err) {
      console.error("[photographer-stripe] status query failed:", err);
      return res.status(500).json({ error: "status_query_failed" });
    }

    if (!row) {
      return res.json({ connected: false, payoutsEnabled: false, onboardingStatus: "not_started" });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.json({
        connected: true,
        accountId: row.stripe_account_id,
        payoutsEnabled: row.payouts_enabled,
        chargesEnabled: row.charges_enabled,
        detailsSubmitted: row.details_submitted,
        onboardingStatus: row.onboarding_status,
        stripeConfigured: false,
      });
    }

    try {
      const acct = await stripe.accounts.retrieve(row.stripe_account_id);
      const payoutsEnabled = Boolean(acct.payouts_enabled);
      const chargesEnabled = Boolean(acct.charges_enabled);
      const detailsSubmitted = Boolean(acct.details_submitted);
      const onboardingStatus = detailsSubmitted && payoutsEnabled ? "complete" : "pending";
      await pool.query(
        `UPDATE photographer_stripe_accounts
            SET payouts_enabled = $2, charges_enabled = $3,
                details_submitted = $4, onboarding_status = $5, updated_at = NOW()
          WHERE photographer_id = $1`,
        [session.userId, payoutsEnabled, chargesEnabled, detailsSubmitted, onboardingStatus],
      );
      return res.json({
        connected: true,
        accountId: row.stripe_account_id,
        payoutsEnabled,
        chargesEnabled,
        detailsSubmitted,
        onboardingStatus,
      });
    } catch (err) {
      // Stripe utilgjengelig — returner siste kjente DB-status heller enn å feile.
      console.error("[photographer-stripe] account retrieve failed:", err);
      return res.json({
        connected: true,
        accountId: row.stripe_account_id,
        payoutsEnabled: row.payouts_enabled,
        chargesEnabled: row.charges_enabled,
        detailsSubmitted: row.details_submitted,
        onboardingStatus: row.onboarding_status,
        stale: true,
      });
    }
  });

  /**
   * POST /api/photographer/stripe/connect
   * Oppretter en Express connected-account (om ingen finnes) og returnerer en
   * onboarding-link som settings-panelet/onboarding redirecter brukeren til.
   */
  app.post("/api/photographer/stripe/connect", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;

    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: "stripe_not_configured" });

    const country =
      (typeof req.body?.country === "string" && req.body.country.trim()) || "NO";

    try {
      let row: AccountRow | null = null;
      try {
        row = await fetchRow(session.userId);
      } catch (err) {
        console.error("[photographer-stripe] connect lookup failed:", err);
        return res.status(500).json({ error: "lookup_failed" });
      }

      let accountId = row?.stripe_account_id ?? null;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country,
          email: session.email || undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: { photographer_id: session.userId },
        });
        accountId = account.id;
        try {
          await pool.query(
            `INSERT INTO photographer_stripe_accounts
               (photographer_id, stripe_account_id, onboarding_status, country)
             VALUES ($1, $2, 'pending', $3)
             ON CONFLICT (photographer_id)
               DO UPDATE SET stripe_account_id = EXCLUDED.stripe_account_id,
                             country = EXCLUDED.country,
                             updated_at = NOW()`,
            [session.userId, accountId, country],
          );
        } catch (err) {
          if (isMissingTable(err)) {
            return res.status(503).json({
              error: "migration_pending",
              message: "Kjør migrasjon 261_photographer_stripe_accounts før Stripe-kobling.",
            });
          }
          throw err;
        }
      }

      const base = getReturnBaseUrl().replace(/\/$/, "");
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${base}/dashboard?stripe_onboarding=refresh`,
        return_url: `${base}/dashboard?stripe_onboarding=complete`,
        type: "account_onboarding",
      });

      return res.json({
        onboardingUrl: accountLink.url,
        accountId,
        expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[photographer-stripe] connect failed:", err);
      return res.status(502).json({ error: "stripe_connect_failed", message });
    }
  });
}
