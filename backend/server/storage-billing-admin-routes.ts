// Admin-routes for å administrere storage-billing per kunde.
//
// Kreves når en kunde abonnerer på en plan med metered storage-overage
// (Professional, Premium, Enterprise). Admin lager subscription-item på
// Stripe-side (usage_type='metered'), så bruker dette endepunktet til
// å koble item-IDen til vår subscription-rad. Etter det vil
// storage-quota-service.pushStorageUsageToStripe() automatisk pushe
// overage-GB hver gang en upload fullføres.

import express from "express";
import type { Pool } from "pg";

export interface StorageBillingAdminRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

export function setupStorageBillingAdminRoutes(
  deps: StorageBillingAdminRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // GET /api/admin/storage-billing/users/:userId — vis aktuell subscription
  // + storage-bruk + Stripe-konfig for en bruker.
  app.get(
    "/api/admin/storage-billing/users/:userId",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const { userId } = req.params;

      try {
        const sub = await pool.query(
          `SELECT id, user_id, plan_type, status, stripe_subscription_id,
                  stripe_storage_meter_item_id, created_at, updated_at
             FROM subscriptions
            WHERE user_id = $1
            ORDER BY created_at DESC`,
          [userId],
        );
        const usage = await pool.query(
          `SELECT total_bytes, filesystem_bytes, r2_bytes, stream_bytes,
                  last_updated, last_stripe_sync_at, last_synced_overage_gb
             FROM user_storage_consumption
            WHERE user_id = $1`,
          [userId],
        );

        res.json({
          success: true,
          userId,
          subscriptions: sub.rows,
          storage: usage.rows[0] || null,
        });
      } catch (err) {
        console.error("[admin-storage-billing] lookup failed:", err);
        res.status(500).json({
          success: false,
          error: "lookup_failed",
        });
      }
    },
  );

  // PUT /api/admin/storage-billing/subscriptions/:subscriptionId/meter-item
  // Body: { stripeStorageMeterItemId: string | null }
  // Setter (eller fjerner) referansen til Stripe metered subscription-item
  // som tar imot storage-overage-usage records.
  app.put(
    "/api/admin/storage-billing/subscriptions/:subscriptionId/meter-item",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const { subscriptionId } = req.params;
      const { stripeStorageMeterItemId } = req.body || {};

      if (
        stripeStorageMeterItemId !== null &&
        typeof stripeStorageMeterItemId !== "string"
      ) {
        return res.status(400).json({
          success: false,
          error: "invalid_payload",
          message:
            "stripeStorageMeterItemId må være string (Stripe-item-id) eller null.",
        });
      }

      // Lett validering — Stripe subscription-items starter med "si_"
      const normalized =
        typeof stripeStorageMeterItemId === "string"
          ? stripeStorageMeterItemId.trim()
          : null;
      if (normalized && !/^si_[A-Za-z0-9]+$/.test(normalized)) {
        return res.status(400).json({
          success: false,
          error: "invalid_stripe_item_id",
          message:
            "stripeStorageMeterItemId skal være på formen 'si_XXX' fra Stripe.",
        });
      }

      try {
        const before = await pool.query(
          `SELECT stripe_storage_meter_item_id
             FROM subscriptions
            WHERE id = $1`,
          [subscriptionId],
        );
        if ((before.rowCount ?? 0) === 0) {
          return res
            .status(404)
            .json({ success: false, error: "subscription_not_found" });
        }
        const previousValue =
          before.rows[0].stripe_storage_meter_item_id ?? null;

        await pool.query(
          `UPDATE subscriptions
              SET stripe_storage_meter_item_id = $2,
                  updated_at = now()
            WHERE id = $1`,
          [subscriptionId, normalized],
        );

        // Audit-logg (lett — vi bruker en eksisterende audit-pattern,
        // eller logger til konsoll hvis vi ikke har en sentral audit-tabell
        // for dette).
        try {
          await pool.query(
            `INSERT INTO storage_consumption_events
               (user_id, delta_bytes, backend, reason, related_resource_id, metadata)
             SELECT user_id, 0, 'admin', 'admin_meter_item_update', $1,
                    $2::jsonb
               FROM subscriptions
              WHERE id = $1`,
            [
              subscriptionId,
              JSON.stringify({
                previousValue,
                newValue: normalized,
                changedBy: adminSession.userId,
                changedByEmail: adminSession.email,
              }),
            ],
          );
        } catch (auditErr) {
          console.warn(
            "[admin-storage-billing] audit insert failed:",
            auditErr,
          );
        }

        res.json({
          success: true,
          subscriptionId,
          previousValue,
          newValue: normalized,
        });
      } catch (err) {
        console.error("[admin-storage-billing] update failed:", err);
        res.status(500).json({
          success: false,
          error: "update_failed",
        });
      }
    },
  );

  // GET /api/admin/storage-billing/stripe-catalog
  // Lister alle aktive products + prices fra Stripe så admin ser hva som
  // finnes uten å åpne Stripe-dashboard. Spesielt viktig for å finne
  // riktig metered-price-ID for STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK.
  app.get("/api/admin/storage-billing/stripe-catalog", async (req, res) => {
    const adminSession = requireAdminSession(req, res);
    if (!adminSession) return;

    const stripeKey =
      process.env.STRIPE_SECRET_KEY ||
      process.env.CREATORHUB_STRIPE_SECRET_KEY ||
      process.env.STRIPE_API_KEY;
    if (!stripeKey) {
      return res.status(412).json({
        success: false,
        error: "stripe_not_configured",
        message: "STRIPE_SECRET_KEY mangler i env.",
      });
    }

    try {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeKey);

      const [products, prices] = await Promise.all([
        stripe.products.list({ active: true, limit: 100 }),
        stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] }),
      ]);

      const productMap = new Map<string, any>();
      for (const p of products.data) {
        productMap.set(p.id, {
          id: p.id,
          name: p.name,
          description: p.description,
          metadata: p.metadata,
          prices: [] as any[],
        });
      }

      for (const price of prices.data) {
        const productId =
          typeof price.product === "string"
            ? price.product
            : (price.product as any)?.id;
        if (!productId || !productMap.has(productId)) continue;
        productMap.get(productId).prices.push({
          id: price.id,
          nickname: price.nickname,
          currency: price.currency,
          unitAmount: price.unit_amount,
          unitAmountDecimal: price.unit_amount_decimal,
          recurring: price.recurring
            ? {
                interval: price.recurring.interval,
                intervalCount: price.recurring.interval_count,
                usageType: price.recurring.usage_type,
                aggregateUsage:
                  (price.recurring as any).aggregate_usage ?? null,
              }
            : null,
          billingScheme: price.billing_scheme,
          metadata: price.metadata,
        });
      }

      const configured = {
        STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK:
          process.env.STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK ?? null,
        CREATORHUB_STRIPE_PRICE_ID_BASIC:
          process.env.CREATORHUB_STRIPE_PRICE_ID_BASIC ?? null,
        CREATORHUB_STRIPE_PRICE_ID_PROFESSIONAL:
          process.env.CREATORHUB_STRIPE_PRICE_ID_PROFESSIONAL ?? null,
        CREATORHUB_STRIPE_PRICE_ID_PREMIUM:
          process.env.CREATORHUB_STRIPE_PRICE_ID_PREMIUM ?? null,
        CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE:
          process.env.CREATORHUB_STRIPE_PRICE_ID_ENTERPRISE ?? null,
        ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER:
          process.env.ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER ?? null,
        ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM:
          process.env.ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM ?? null,
      };

      // Hint: hvilke prices ser ut som de kunne være storage-meter?
      const meteredHints: string[] = [];
      for (const product of productMap.values()) {
        for (const price of product.prices) {
          if (
            price.recurring?.usageType === "metered" &&
            (product.name?.toLowerCase().includes("storage") ||
              product.name?.toLowerCase().includes("lagring") ||
              price.nickname?.toLowerCase().includes("gb"))
          ) {
            meteredHints.push(price.id);
          }
        }
      }

      res.json({
        success: true,
        products: Array.from(productMap.values()),
        configuredEnvVars: configured,
        meteredStorageCandidates: meteredHints,
      });
    } catch (err: any) {
      console.error("[admin-storage-billing] catalog fetch failed:", err);
      res.status(500).json({
        success: false,
        error: "stripe_fetch_failed",
        message: String(err?.message || err).slice(0, 200),
      });
    }
  });

  // POST /api/admin/storage-billing/backfill-meter-items
  // Går gjennom alle aktive Pro/Premium/Enterprise-subscriptions som
  // mangler `stripe_storage_meter_item_id` og attach-er meter-itemet
  // til hver. Trygt å re-kjøre — ensureStorageMeterAttached er idempotent.
  //
  // Returnerer summary med per-sub-status.
  app.post(
    "/api/admin/storage-billing/backfill-meter-items",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;

      const overagePriceId =
        process.env.STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK?.trim();
      if (!overagePriceId) {
        return res.status(412).json({
          success: false,
          error: "overage_price_not_configured",
          message:
            "STRIPE_PRICE_ID_STORAGE_OVERAGE_NOK må være satt i env før backfill.",
        });
      }

      try {
        // Finn kandidater: subscriptions med plan som tillater overage
        // og som ikke allerede har meter-item satt.
        const candidates = await pool.query<{
          user_id: string;
          plan_type: string;
          stripe_subscription_id: string | null;
        }>(
          `SELECT user_id, plan_type, stripe_subscription_id
             FROM subscriptions
            WHERE status IN ('active', 'trialing', 'past_due')
              AND stripe_subscription_id IS NOT NULL
              AND stripe_storage_meter_item_id IS NULL
              AND LOWER(plan_type) ~ 'pro|professional|premium|studio|enterprise'`,
        );

        const { ensureStorageMeterAttached } = await import(
          "./storage-quota-service.js"
        );

        const results: Array<{
          userId: string;
          planType: string;
          attached: boolean;
          itemId?: string;
          reason?: string;
        }> = [];

        for (const row of candidates.rows) {
          const meterRes = await ensureStorageMeterAttached(
            pool,
            row.user_id,
            row.plan_type,
            row.stripe_subscription_id,
          );
          results.push({
            userId: row.user_id,
            planType: row.plan_type,
            attached: meterRes.attached,
            itemId: meterRes.itemId,
            reason: meterRes.reason,
          });
        }

        const summary = results.reduce(
          (acc, r) => {
            if (r.attached) acc.attached++;
            else acc.skipped++;
            return acc;
          },
          { attached: 0, skipped: 0 },
        );

        res.json({
          success: true,
          totalCandidates: candidates.rowCount,
          attached: summary.attached,
          skipped: summary.skipped,
          results,
        });
      } catch (err: any) {
        console.error("[admin-storage-billing] backfill failed:", err);
        res.status(500).json({
          success: false,
          error: "backfill_failed",
          message: String(err?.message || err).slice(0, 200),
        });
      }
    },
  );

  // POST /api/admin/storage-billing/users/:userId/recompute
  // Triggrer en re-aggregering av brukerens storage fra chunked_uploads.
  // Brukes hvis ledgeren er drifted bort fra faktiske R2/Stream-objektene.
  app.post(
    "/api/admin/storage-billing/users/:userId/recompute",
    async (req, res) => {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      const { userId } = req.params;

      try {
        // Aggreger fra chunked_uploads — eneste sanne kilde vi har lokalt
        // for storage-consumption. R2 / Stream må reconciles separat hvis
        // det er fil-lekkasje.
        const agg = await pool.query<{
          fs: string;
          r2: string;
          stream: string;
        }>(
          `SELECT
             COALESCE(SUM(CASE WHEN (metadata->>'storageBackend') = 'filesystem' THEN file_size ELSE 0 END), 0) AS fs,
             COALESCE(SUM(CASE WHEN (metadata->>'storageBackend') = 'r2' THEN file_size ELSE 0 END), 0) AS r2,
             COALESCE(SUM(CASE WHEN (metadata->>'storageBackend') = 'cloudflare_stream' THEN file_size ELSE 0 END), 0) AS stream
           FROM chunked_uploads
          WHERE user_id = $1 AND status = 'completed'`,
          [userId],
        );
        const row = agg.rows[0];
        const fs = Number(row.fs);
        const r2 = Number(row.r2);
        const stream = Number(row.stream);
        const total = fs + r2 + stream;

        await pool.query(
          `INSERT INTO user_storage_consumption
             (user_id, total_bytes, filesystem_bytes, r2_bytes, stream_bytes,
              last_updated, reconciled_at, reconcile_notes)
           VALUES ($1, $2, $3, $4, $5, now(), now(), $6)
           ON CONFLICT (user_id) DO UPDATE SET
             total_bytes      = EXCLUDED.total_bytes,
             filesystem_bytes = EXCLUDED.filesystem_bytes,
             r2_bytes         = EXCLUDED.r2_bytes,
             stream_bytes     = EXCLUDED.stream_bytes,
             last_updated     = now(),
             reconciled_at    = now(),
             reconcile_notes  = EXCLUDED.reconcile_notes`,
          [
            userId,
            total,
            fs,
            r2,
            stream,
            `recomputed_by_${adminSession.email}`,
          ],
        );

        res.json({
          success: true,
          userId,
          recomputed: {
            totalBytes: total,
            filesystemBytes: fs,
            r2Bytes: r2,
            streamBytes: stream,
          },
        });
      } catch (err) {
        console.error("[admin-storage-billing] recompute failed:", err);
        res.status(500).json({
          success: false,
          error: "recompute_failed",
        });
      }
    },
  );
}
