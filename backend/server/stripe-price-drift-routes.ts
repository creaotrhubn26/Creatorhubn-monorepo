/**
 * stripe-price-drift-routes — Slice 9X.76
 *
 * Sammenligner admin-konfigurerte priser i marketplace_app_config vs
 * faktisk pris i Stripe. Detekterer drift som kan oppstå hvis noen har
 * endret priser direkte i Stripe Dashboard, eller hvis admin-konfigen
 * ble lagret uten å publisere til Stripe.
 *
 * Triggers:
 *   - Cron-job (Render Cron Service): POST /api/cron/stripe-price-drift
 *     Header: x-cron-secret = process.env.STRIPE_DRIFT_CRON_SECRET
 *   - Admin manuell: POST /api/admin/marketplace/stripe-price-drift/check
 *
 * Ved drift:
 *   - Logger til console
 *   - Setter inn rad i admin_notifications med severity='warning'
 *   - Returnerer rapport som JSON
 */

import type { Express, Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";

type RequireAdminSession = (req: Request, res: Response, next: NextFunction) => void;

let stripeClient: Stripe | null = null;
const getStripe = (): Stripe | null => {
  if (stripeClient) return stripeClient;
  const key = process.env.CREATORHUB_STRIPE_SECRET_KEY
    || process.env.STRIPE_SECRET_KEY
    || process.env.STRIPE_API_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key.trim());
  return stripeClient;
};

interface DriftIssue {
  appId: string;
  appName: string;
  tierId: string;
  tierName: string;
  stripePriceId: string;
  expectedAmount: number;
  expectedInterval: string;
  stripeAmount: number;
  stripeInterval: string;
  stripeActive: boolean;
  driftType: 'amount-mismatch' | 'interval-mismatch' | 'price-deactivated' | 'price-not-found' | 'stripe-error';
  message: string;
}

interface DriftReport {
  ok: boolean;
  checkedAt: string;
  totalApps: number;
  totalTiers: number;
  driftsFound: number;
  drifts: DriftIssue[];
  errors: string[];
}

/**
 * Kjør drift-sjekken. Returnerer rapport.
 */
async function runPriceDriftCheck(pool: Pool): Promise<DriftReport> {
  const report: DriftReport = {
    ok: true,
    checkedAt: new Date().toISOString(),
    totalApps: 0,
    totalTiers: 0,
    driftsFound: 0,
    drifts: [],
    errors: [],
  };

  const stripe = getStripe();
  if (!stripe) {
    report.ok = false;
    report.errors.push('STRIPE_SECRET_KEY mangler');
    return report;
  }

  let apps: any[] = [];
  try {
    const result = await pool.query(
      `SELECT id, name, subscription_tiers FROM marketplace_app_config WHERE is_active = TRUE`,
    );
    apps = result.rows;
  } catch (err: any) {
    if (err?.code === '42P01') {
      report.errors.push('marketplace_app_config-tabellen finnes ikke (kjør migration 0127)');
      return report;
    }
    throw err;
  }

  report.totalApps = apps.length;

  for (const app of apps) {
    const tiers: any[] = Array.isArray(app.subscription_tiers) ? app.subscription_tiers : [];
    for (const tier of tiers) {
      if (!tier.stripePriceId) continue; // tier som ikke er synket — ignore
      report.totalTiers++;

      try {
        const stripePrice = await stripe.prices.retrieve(tier.stripePriceId);
        const expectedAmount = (tier.stripeAmount || 0) * 100;
        const stripeAmount = stripePrice.unit_amount || 0;
        const expectedInterval = tier.stripeInterval || 'month';
        const stripeInterval = stripePrice.recurring?.interval || '';

        // Check 1: Amount-drift
        if (stripeAmount !== expectedAmount) {
          report.drifts.push({
            appId: app.id,
            appName: app.name,
            tierId: tier.id,
            tierName: tier.name,
            stripePriceId: tier.stripePriceId,
            expectedAmount: expectedAmount / 100,
            expectedInterval,
            stripeAmount: stripeAmount / 100,
            stripeInterval,
            stripeActive: !!stripePrice.active,
            driftType: 'amount-mismatch',
            message: `Forventet ${(expectedAmount / 100).toFixed(2)} kr, fant ${(stripeAmount / 100).toFixed(2)} kr i Stripe`,
          });
        }

        // Check 2: Interval-drift
        if (stripeInterval && stripeInterval !== expectedInterval) {
          report.drifts.push({
            appId: app.id,
            appName: app.name,
            tierId: tier.id,
            tierName: tier.name,
            stripePriceId: tier.stripePriceId,
            expectedAmount: expectedAmount / 100,
            expectedInterval,
            stripeAmount: stripeAmount / 100,
            stripeInterval,
            stripeActive: !!stripePrice.active,
            driftType: 'interval-mismatch',
            message: `Forventet ${expectedInterval}, fant ${stripeInterval} i Stripe`,
          });
        }

        // Check 3: Pris deaktivert i Stripe
        if (!stripePrice.active) {
          report.drifts.push({
            appId: app.id,
            appName: app.name,
            tierId: tier.id,
            tierName: tier.name,
            stripePriceId: tier.stripePriceId,
            expectedAmount: expectedAmount / 100,
            expectedInterval,
            stripeAmount: stripeAmount / 100,
            stripeInterval,
            stripeActive: false,
            driftType: 'price-deactivated',
            message: 'Stripe-prisen er deaktivert — admin må publisere på nytt',
          });
        }
      } catch (err: any) {
        const driftType: DriftIssue['driftType'] = err?.statusCode === 404 ? 'price-not-found' : 'stripe-error';
        report.drifts.push({
          appId: app.id,
          appName: app.name,
          tierId: tier.id,
          tierName: tier.name,
          stripePriceId: tier.stripePriceId,
          expectedAmount: (tier.stripeAmount || 0),
          expectedInterval: tier.stripeInterval || '',
          stripeAmount: 0,
          stripeInterval: '',
          stripeActive: false,
          driftType,
          message: driftType === 'price-not-found'
            ? 'Stripe-prisen finnes ikke lenger (slettet?)'
            : `Stripe-feil: ${err.message}`,
        });
      }
    }
  }

  report.driftsFound = report.drifts.length;
  report.ok = report.driftsFound === 0 && report.errors.length === 0;

  // Skriv admin-notifikasjon hvis drift
  if (report.driftsFound > 0) {
    try {
      await pool.query(`
        INSERT INTO admin_notifications (type, title, message, severity, category, status, action_url, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        'stripe_price_drift',
        `Stripe-pris-drift oppdaget (${report.driftsFound})`,
        `${report.driftsFound} tier(s) har drift mellom marketplace-config og Stripe.\n\n`
          + report.drifts.slice(0, 5).map((d) => `• ${d.appName} / ${d.tierName}: ${d.message}`).join('\n')
          + (report.drifts.length > 5 ? `\n... og ${report.drifts.length - 5} til` : ''),
        'warning',
        'marketplace',
        'unread',
        '/admin?tab=marketplace-apps',
      ]);
    } catch (err: any) {
      // Tabell mangler eller andre feil — ikke fail-stopper
      if (err?.code !== '42P01') {
        console.error('[stripe-drift] kunne ikke skrive admin-notification:', err.message);
      }
    }
  }

  return report;
}

export function registerStripePriceDriftRoutes(
  app: Express,
  pool: Pool,
  requireAdminSession: RequireAdminSession,
) {
  // ─── Cron: scheduled drift-sjekk ───────────────────────────────
  // Krever x-cron-secret-header (Render Cron Service setter denne).
  const cronHandler = async (req: Request, res: Response) => {
    const cronSecret = process.env.STRIPE_DRIFT_CRON_SECRET || '';
    const providedSecret = String(req.headers['x-cron-secret'] || '').trim();
    if (!cronSecret || providedSecret !== cronSecret) {
      return res.status(401).json({ success: false, error: 'invalid_cron_secret' });
    }
    const report = await runPriceDriftCheck(pool);
    res.json({ success: true, report });
  };
  app.get('/api/cron/stripe-price-drift', cronHandler);
  app.post('/api/cron/stripe-price-drift', cronHandler);

  // ─── Admin: manuell trigger fra marketplace-UI ─────────────────
  app.post(
    '/api/admin/marketplace/stripe-price-drift/check',
    requireAdminSession,
    async (_req, res) => {
      try {
        const report = await runPriceDriftCheck(pool);
        res.json({ success: true, report });
      } catch (err: any) {
        console.error('[stripe-drift admin] failed:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  // ─── Admin: hent siste lagrede drift-rapport (fra notifications) ─
  app.get(
    '/api/admin/marketplace/stripe-price-drift/history',
    requireAdminSession,
    async (_req, res) => {
      try {
        const result = await pool.query(`
          SELECT id, title, message, severity, created_at, status
            FROM admin_notifications
            WHERE type = 'stripe_price_drift'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        res.json({ success: true, data: result.rows });
      } catch (err: any) {
        if (err?.code === '42P01') return res.json({ success: true, data: [] });
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );
}
