// Admin Google Pay config routes.
//
// Backes med ekte data fra google_pay_config + google_pay_transactions
// (migrasjon 248_google_pay_config.sql). Driver Admin Room "Google
// Payments"-fanen — UI-fila GooglePaymentsConfiguration.tsx.
//
// Defensiv: hvis migrasjonen ikke er kjørt ennå returneres
// fall-back-respons + console.warn — ikke 500 — slik at UI ikke krasjer.

import express from "express";
import type { Pool } from "pg";

export interface AdminGooglePayConfigRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// `to_regclass` returnerer null hvis tabellen mangler — gir oss en rask ja/nei
// uten å rotere information_schema flere ganger pr. request.
async function configTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.google_pay_config') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

async function transactionsTableExists(pool: Pool): Promise<boolean> {
  try {
    const r = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.google_pay_transactions') AS reg`,
    );
    return r.rows[0]?.reg !== null && r.rows[0]?.reg !== undefined;
  } catch {
    return false;
  }
}

// Tabellen `google_pay_transactions` finnes i to varianter i prod-DB-ene:
// 1) Vår nye (amount_cents, currency, completed_at, payment_method_type,
//    stripe_charge_id, error_message)
// 2) En eldre variant fra subscription-systemet (amount_micros, currency_code,
//    processed_at, transaction_id, external_transaction_id).
// Vi sjekker kolonner og velger spørringsformen deretter — slik unngår vi
// 500 hvis migrasjon 248 ble kjørt på toppen av eldre schema.
interface TransactionsSchema {
  hasAmountCents: boolean;
  hasCurrency: boolean;
  hasCompletedAt: boolean;
  hasPaymentMethodType: boolean;
  hasStripeChargeId: boolean;
  hasErrorMessage: boolean;
  // Eldre felter:
  hasAmountMicros: boolean;
  hasCurrencyCode: boolean;
  hasProcessedAt: boolean;
}

async function describeTransactionsSchema(pool: Pool): Promise<TransactionsSchema> {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'google_pay_transactions'`,
  );
  const cols = new Set(result.rows.map((r) => r.column_name));
  return {
    hasAmountCents: cols.has("amount_cents"),
    hasCurrency: cols.has("currency"),
    hasCompletedAt: cols.has("completed_at"),
    hasPaymentMethodType: cols.has("payment_method_type"),
    hasStripeChargeId: cols.has("stripe_charge_id"),
    hasErrorMessage: cols.has("error_message"),
    hasAmountMicros: cols.has("amount_micros"),
    hasCurrencyCode: cols.has("currency_code"),
    hasProcessedAt: cols.has("processed_at"),
  };
}

function safeLimit(input: unknown, def: number, max: number): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

interface GooglePayConfigRow {
  id: string;
  merchant_id: string | null;
  merchant_name: string | null;
  environment: string;
  gateway: string;
  gateway_merchant_id: string | null;
  allowed_card_networks: string[];
  allowed_card_auth_methods: string[];
  country_code: string;
  currency_code: string;
  is_active: boolean;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToConfig(r: GooglePayConfigRow) {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    merchantName: r.merchant_name,
    environment: r.environment,
    gateway: r.gateway,
    gatewayMerchantId: r.gateway_merchant_id,
    allowedCardNetworks: r.allowed_card_networks ?? [],
    allowedCardAuthMethods: r.allowed_card_auth_methods ?? [],
    countryCode: r.country_code,
    currencyCode: r.currency_code,
    isActive: r.is_active,
    updatedBy: r.updated_by,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  };
}

function isConfigComplete(c: ReturnType<typeof rowToConfig>): boolean {
  return Boolean(
    c.merchantId &&
      c.merchantId.trim().length > 0 &&
      c.gatewayMerchantId &&
      c.gatewayMerchantId.trim().length > 0 &&
      c.merchantName &&
      c.merchantName.trim().length > 0,
  );
}

function defaultFallbackConfig() {
  return {
    id: "singleton",
    merchantId: null,
    merchantName: "CreatorHub Norge AS",
    environment: "TEST",
    gateway: "stripe",
    gatewayMerchantId: null,
    allowedCardNetworks: ["VISA", "MASTERCARD"],
    allowedCardAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
    countryCode: "NO",
    currencyCode: "NOK",
    isActive: false,
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
  };
}

function readString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim().length > 0) {
      out.push(item.trim());
    }
  }
  return out;
}

function readBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const lower = v.trim().toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }
  return null;
}

function readEnvironment(v: unknown): string | null {
  const s = readString(v);
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === "TEST" || upper === "PRODUCTION") return upper;
  return null;
}

function readGateway(v: unknown): string | null {
  const s = readString(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "stripe" || lower === "adyen" || lower === "braintree") return lower;
  return null;
}

export function setupAdminGooglePayConfigRoutes(
  deps: AdminGooglePayConfigRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── GET /api/admin/google-pay/config ────────────────────────
  app.get("/api/admin/google-pay/config", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const exists = await configTableExists(pool);
      if (!exists) {
        console.warn(
          "[admin-google-pay] google_pay_config table missing — returning fallback",
        );
        const cfg = defaultFallbackConfig();
        res.json({ config: cfg, isComplete: false });
        return;
      }
      const result = await pool.query<GooglePayConfigRow>(
        `SELECT id, merchant_id, merchant_name, environment, gateway,
                gateway_merchant_id, allowed_card_networks, allowed_card_auth_methods,
                country_code, currency_code, is_active, updated_by,
                created_at, updated_at
         FROM google_pay_config
         WHERE id = 'singleton'
         LIMIT 1`,
      );
      if (result.rows.length === 0) {
        // Singleton-rad mangler — returner fallback men hold UI i live.
        const cfg = defaultFallbackConfig();
        res.json({ config: cfg, isComplete: false });
        return;
      }
      const cfg = rowToConfig(result.rows[0]);
      res.json({ config: cfg, isComplete: isConfigComplete(cfg) });
    } catch (e) {
      console.warn("[admin-google-pay] GET /config failed:", e);
      const cfg = defaultFallbackConfig();
      res.json({ config: cfg, isComplete: false });
    }
  });

  // ─── PUT /api/admin/google-pay/config ────────────────────────
  app.put("/api/admin/google-pay/config", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    try {
      const exists = await configTableExists(pool);
      if (!exists) {
        res.status(503).json({
          error:
            "google_pay_config table missing — run migration 248_google_pay_config.sql",
        });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;

      const merchantId = readString(body.merchantId);
      const merchantName = readString(body.merchantName);
      const environment = readEnvironment(body.environment);
      const gateway = readGateway(body.gateway);
      const gatewayMerchantId = readString(body.gatewayMerchantId);
      const allowedCardNetworks = readStringArray(body.allowedCardNetworks);
      const allowedCardAuthMethods = readStringArray(body.allowedCardAuthMethods);
      const countryCode = readString(body.countryCode);
      const currencyCode = readString(body.currencyCode);
      const isActive = readBoolean(body.isActive);

      // COALESCE-mønster: bare felt som ble sendt inn oppdateres; resten beholdes.
      const result = await pool.query<GooglePayConfigRow>(
        `UPDATE google_pay_config
         SET merchant_id = COALESCE($1, merchant_id),
             merchant_name = COALESCE($2, merchant_name),
             environment = COALESCE($3, environment),
             gateway = COALESCE($4, gateway),
             gateway_merchant_id = COALESCE($5, gateway_merchant_id),
             allowed_card_networks = COALESCE($6, allowed_card_networks),
             allowed_card_auth_methods = COALESCE($7, allowed_card_auth_methods),
             country_code = COALESCE($8, country_code),
             currency_code = COALESCE($9, currency_code),
             is_active = COALESCE($10, is_active),
             updated_by = $11,
             updated_at = now()
         WHERE id = 'singleton'
         RETURNING id, merchant_id, merchant_name, environment, gateway,
                   gateway_merchant_id, allowed_card_networks, allowed_card_auth_methods,
                   country_code, currency_code, is_active, updated_by,
                   created_at, updated_at`,
        [
          merchantId,
          merchantName,
          environment,
          gateway,
          gatewayMerchantId,
          allowedCardNetworks,
          allowedCardAuthMethods,
          countryCode,
          currencyCode,
          isActive,
          session.email || session.userId,
        ],
      );

      if (result.rows.length === 0) {
        // Singleton-raden eksisterte ikke — insert den med innkommende verdier.
        const inserted = await pool.query<GooglePayConfigRow>(
          `INSERT INTO google_pay_config (
             id, merchant_id, merchant_name, environment, gateway,
             gateway_merchant_id, allowed_card_networks, allowed_card_auth_methods,
             country_code, currency_code, is_active, updated_by
           ) VALUES (
             'singleton',
             $1, $2,
             COALESCE($3, 'TEST'),
             COALESCE($4, 'stripe'),
             $5,
             COALESCE($6, ARRAY['VISA','MASTERCARD']),
             COALESCE($7, ARRAY['PAN_ONLY','CRYPTOGRAM_3DS']),
             COALESCE($8, 'NO'),
             COALESCE($9, 'NOK'),
             COALESCE($10, FALSE),
             $11
           )
           RETURNING id, merchant_id, merchant_name, environment, gateway,
                     gateway_merchant_id, allowed_card_networks, allowed_card_auth_methods,
                     country_code, currency_code, is_active, updated_by,
                     created_at, updated_at`,
          [
            merchantId,
            merchantName,
            environment,
            gateway,
            gatewayMerchantId,
            allowedCardNetworks,
            allowedCardAuthMethods,
            countryCode,
            currencyCode,
            isActive,
            session.email || session.userId,
          ],
        );
        const cfg = rowToConfig(inserted.rows[0]);
        res.json({ config: cfg, isComplete: isConfigComplete(cfg) });
        return;
      }

      const cfg = rowToConfig(result.rows[0]);
      res.json({ config: cfg, isComplete: isConfigComplete(cfg) });
    } catch (e) {
      console.warn("[admin-google-pay] PUT /config failed:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  // ─── GET /api/admin/google-pay/stats ─────────────────────────
  app.get("/api/admin/google-pay/stats", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const exists = await transactionsTableExists(pool);
      if (!exists) {
        console.warn(
          "[admin-google-pay] google_pay_transactions table missing — returning empty stats",
        );
        res.json({
          totalTransactions: 0,
          totalRevenue: 0,
          lastTransactionAt: null,
          byStatus: { completed: 0, failed: 0, pending: 0, refunded: 0 },
        });
        return;
      }

      const schema = await describeTransactionsSchema(pool);
      const amountExpr = schema.hasAmountCents
        ? "amount_cents"
        : schema.hasAmountMicros
          ? "(amount_micros / 10000)" // micros → cents
          : "0";

      const totalsResult = await pool.query<{
        total_transactions: string;
        total_revenue: string | null;
        last_transaction_at: Date | null;
      }>(
        `SELECT COUNT(*)::text AS total_transactions,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN ${amountExpr} ELSE 0 END), 0)::text AS total_revenue,
                MAX(created_at) AS last_transaction_at
         FROM google_pay_transactions`,
      );

      const statusResult = await pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count
         FROM google_pay_transactions
         GROUP BY status`,
      );

      const byStatus: Record<string, number> = {
        completed: 0,
        failed: 0,
        pending: 0,
        refunded: 0,
      };
      for (const row of statusResult.rows) {
        byStatus[row.status] = Number(row.count) || 0;
      }

      const totals = totalsResult.rows[0];
      const lastTx = totals?.last_transaction_at;
      res.json({
        totalTransactions: Number(totals?.total_transactions ?? "0"),
        // amount_cents → kroner (eller hovedenhet). UI er ansvarlig for formatering.
        totalRevenue: Number(totals?.total_revenue ?? "0") / 100,
        totalRevenueCents: Number(totals?.total_revenue ?? "0"),
        lastTransactionAt:
          lastTx instanceof Date ? lastTx.toISOString() : lastTx ?? null,
        byStatus,
      });
    } catch (e) {
      console.warn("[admin-google-pay] GET /stats failed:", e);
      res.json({
        totalTransactions: 0,
        totalRevenue: 0,
        lastTransactionAt: null,
        byStatus: { completed: 0, failed: 0, pending: 0, refunded: 0 },
      });
    }
  });

  // ─── GET /api/admin/google-pay/transactions ─────────────────
  app.get("/api/admin/google-pay/transactions", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const exists = await transactionsTableExists(pool);
      if (!exists) {
        console.warn(
          "[admin-google-pay] google_pay_transactions table missing — returning empty list",
        );
        res.json({ transactions: [], total: 0 });
        return;
      }

      const limit = safeLimit(req.query.limit, 50, 500);
      const statusFilter = readString(req.query.status);

      const params: unknown[] = [];
      let where = "";
      if (statusFilter) {
        params.push(statusFilter);
        where = `WHERE status = $${params.length}`;
      }

      const totalResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM google_pay_transactions ${where}`,
        params,
      );

      const schema = await describeTransactionsSchema(pool);
      const amountCol = schema.hasAmountCents
        ? "amount_cents"
        : schema.hasAmountMicros
          ? "(amount_micros / 10000)::integer AS amount_cents"
          : "0::integer AS amount_cents";
      const amountSelect = schema.hasAmountCents ? "amount_cents" : amountCol;
      const currencyCol = schema.hasCurrency
        ? "currency"
        : schema.hasCurrencyCode
          ? "currency_code AS currency"
          : "'NOK'::text AS currency";
      const completedAtCol = schema.hasCompletedAt
        ? "completed_at"
        : schema.hasProcessedAt
          ? "processed_at AS completed_at"
          : "NULL::timestamptz AS completed_at";
      const paymentMethodCol = schema.hasPaymentMethodType
        ? "payment_method_type"
        : "NULL::text AS payment_method_type";
      const stripeChargeCol = schema.hasStripeChargeId
        ? "stripe_charge_id"
        : "NULL::text AS stripe_charge_id";
      const errorCol = schema.hasErrorMessage
        ? "error_message"
        : "NULL::text AS error_message";

      params.push(limit);
      const listResult = await pool.query<{
        id: string;
        user_id: string | null;
        amount_cents: number;
        currency: string;
        payment_method_type: string | null;
        status: string;
        stripe_charge_id: string | null;
        error_message: string | null;
        created_at: Date;
        completed_at: Date | null;
      }>(
        `SELECT id, user_id, ${amountSelect}, ${currencyCol},
                ${paymentMethodCol}, status, ${stripeChargeCol}, ${errorCol},
                created_at, ${completedAtCol}
         FROM google_pay_transactions
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params,
      );

      const transactions = listResult.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        amount: (r.amount_cents ?? 0) / 100,
        amountCents: r.amount_cents ?? 0,
        currency: r.currency,
        paymentMethodType: r.payment_method_type,
        status: r.status,
        stripeChargeId: r.stripe_charge_id,
        errorMessage: r.error_message,
        createdAt:
          r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
        completedAt:
          r.completed_at instanceof Date
            ? r.completed_at.toISOString()
            : r.completed_at,
      }));

      res.json({
        transactions,
        total: Number(totalResult.rows[0]?.count ?? "0"),
      });
    } catch (e) {
      console.warn("[admin-google-pay] GET /transactions failed:", e);
      res.json({ transactions: [], total: 0 });
    }
  });
}
