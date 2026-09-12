/**
 * admin-payment-tests-routes.ts
 *
 * Backend for "Betalingstest"-fanen i admin (UI: PaymentSystemsIntegrationTest +
 * "Execute All Phase 13 Integrations"-knappen i IntegrationsManagementPanel).
 *
 * Endepunkter:
 *   POST /api/admin/integrations/phase13/execute-all
 *       Kjør Stripe-relaterte integration-tester (API-tilkobling, webhook-secret,
 *       produkter, kunder, priser, ferske charges). Cacher resultat i minne i
 *       5 min så gjentatte execute-all-trykk ikke spammer Stripe-API.
 *
 *   GET  /api/admin/payment-tests/status
 *       Returner sist kjørte test-resultat (kan være null inntil cache fylles).
 *
 * Sikkerhet:
 *   - Krever requireAdminSession (admin-rolle).
 *   - Logger ALDRI STRIPE_SECRET_KEY eller webhook-secret-verdier.
 *   - Returnerer ALDRI nøkkel-verdier i respons — kun "configured / not configured".
 *   - Hvis STRIPE_SECRET_KEY mangler: 503 stripe_not_configured.
 *   - Hvis STRIPE_SECRET_KEY begynner med "sk_live_" og NODE_ENV !== "production":
 *     Vi advarer i loggen, men kjører listOps (read-only). Vi oppretter aldri
 *     charges/customers fra dette endepunktet — kun list/read.
 *
 * Format som UI forventer (IntegrationsManagementPanel.tsx:2866):
 *   { successCount, totalCount, tests, ... }
 */

import type express from "express";
import type { Pool } from "pg";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AdminPaymentTestsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type TestStatus = "pass" | "fail" | "skip";

interface PaymentTestEntry {
  name: string;
  status: TestStatus;
  duration_ms: number;
  detail?: string;
  error?: string;
}

interface PaymentTestRunResult {
  success: boolean;
  ranAt: string; // ISO
  totalCount: number;
  successCount: number;
  failureCount: number;
  skipCount: number;
  tests: PaymentTestEntry[];
  // Felt som UI bruker direkte (IntegrationsManagementPanel forventer
  // successCount + totalCount). Vi holder også på "passed"/"totalTests"
  // for bakoverkompatible konsumenter.
  passed: number;
  totalTests: number;
  mode: "live" | "test" | "unknown";
}

// ── In-memory cache ─────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

interface CacheEntry {
  result: PaymentTestRunResult;
  cachedAt: number;
}

let lastResultCache: CacheEntry | null = null;

function isCacheFresh(entry: CacheEntry | null): entry is CacheEntry {
  if (!entry) return false;
  return Date.now() - entry.cachedAt < CACHE_TTL_MS;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function detectStripeMode(secretKey: string | undefined): "live" | "test" | "unknown" {
  if (!secretKey) return "unknown";
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("rk_live_")) return "live";
  if (secretKey.startsWith("rk_test_")) return "test";
  return "unknown";
}

function shortErr(e: unknown): string {
  if (!e) return "unknown error";
  const msg = (e as Error)?.message ?? String(e);
  // Aldri lekk hele stripe-objektet (kan inneholde request_log_url etc.)
  return msg.length > 240 ? `${msg.slice(0, 240)}…` : msg;
}

// ── Test-runner ─────────────────────────────────────────────────────────
async function runStripeTests(): Promise<PaymentTestRunResult> {
  const ranAt = new Date().toISOString();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const mode = detectStripeMode(stripeKey);

  if (!stripeKey) {
    return {
      success: false,
      ranAt,
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      skipCount: 0,
      tests: [],
      passed: 0,
      totalTests: 0,
      mode,
    };
  }

  if (mode === "live" && process.env.NODE_ENV !== "production") {
    console.warn(
      "[admin-payment-tests] WARNING: Using sk_live_ key outside production. Read-only ops only.",
    );
  }

  // Dynamisk import for å unngå hard-kobling hvis stripe-pakken senere
  // gjøres optional. Samme mønster som post-agent-stripe-webhook.ts.
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey);

  const tests: PaymentTestEntry[] = [];

  // Test 1: API connection (list products limit 1).
  {
    const t0 = Date.now();
    try {
      const r = await stripe.products.list({ limit: 1 });
      tests.push({
        name: "Stripe API connection",
        status: "pass",
        duration_ms: Date.now() - t0,
        detail: `Reachable, ${r.data.length} product(s) sampled`,
      });
    } catch (e) {
      tests.push({
        name: "Stripe API connection",
        status: "fail",
        duration_ms: Date.now() - t0,
        error: shortErr(e),
      });
      // Hvis vi ikke kommer gjennom her, gir det ikke mening å kjøre resten.
      return finalize(tests, ranAt, mode);
    }
  }

  // Test 2: Webhook secret configured (lokal env-sjekk, ingen API-call).
  {
    const t0 = Date.now();
    const ok = typeof webhookSecret === "string" && webhookSecret.trim().length > 16;
    tests.push({
      name: "Webhook secret configured",
      status: ok ? "pass" : "fail",
      duration_ms: Date.now() - t0,
      detail: ok
        ? "STRIPE_WEBHOOK_SECRET present (length OK)"
        : "Missing or too-short STRIPE_WEBHOOK_SECRET",
    });
  }

  // Test 3: Active products.
  {
    const t0 = Date.now();
    try {
      const products = await stripe.products.list({ active: true, limit: 100 });
      tests.push({
        name: "Active products",
        status: products.data.length > 0 ? "pass" : "fail",
        duration_ms: Date.now() - t0,
        detail: `${products.data.length} active product(s)`,
      });
    } catch (e) {
      tests.push({
        name: "Active products",
        status: "fail",
        duration_ms: Date.now() - t0,
        error: shortErr(e),
      });
    }
  }

  // Test 4: Customer API access (list 1 to verify scope, ikke spam).
  {
    const t0 = Date.now();
    try {
      const customers = await stripe.customers.list({ limit: 1 });
      tests.push({
        name: "Customer API access",
        status: "pass",
        duration_ms: Date.now() - t0,
        detail: `List API responding (sampled ${customers.data.length})`,
      });
    } catch (e) {
      tests.push({
        name: "Customer API access",
        status: "fail",
        duration_ms: Date.now() - t0,
        error: shortErr(e),
      });
    }
  }

  // Test 5: Active prices.
  {
    const t0 = Date.now();
    try {
      const prices = await stripe.prices.list({ active: true, limit: 100 });
      tests.push({
        name: "Active prices",
        status: prices.data.length > 0 ? "pass" : "fail",
        duration_ms: Date.now() - t0,
        detail: `${prices.data.length} active price(s)`,
      });
    } catch (e) {
      tests.push({
        name: "Active prices",
        status: "fail",
        duration_ms: Date.now() - t0,
        error: shortErr(e),
      });
    }
  }

  // Test 6: Recent charges (siste 7 dager).
  {
    const t0 = Date.now();
    try {
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
      const charges = await stripe.charges.list({
        limit: 10,
        created: { gte: sevenDaysAgo },
      });
      tests.push({
        name: "Recent charges (7d)",
        status: "pass", // 0 charges er ikke en feil — bare en observasjon.
        duration_ms: Date.now() - t0,
        detail: `${charges.data.length} charge(s) in last 7 days`,
      });
    } catch (e) {
      tests.push({
        name: "Recent charges (7d)",
        status: "fail",
        duration_ms: Date.now() - t0,
        error: shortErr(e),
      });
    }
  }

  return finalize(tests, ranAt, mode);
}

function finalize(
  tests: PaymentTestEntry[],
  ranAt: string,
  mode: "live" | "test" | "unknown",
): PaymentTestRunResult {
  const successCount = tests.filter((t) => t.status === "pass").length;
  const failureCount = tests.filter((t) => t.status === "fail").length;
  const skipCount = tests.filter((t) => t.status === "skip").length;
  return {
    success: failureCount === 0,
    ranAt,
    totalCount: tests.length,
    successCount,
    failureCount,
    skipCount,
    tests,
    passed: successCount,
    totalTests: tests.length,
    mode,
  };
}

// ── Route registration ──────────────────────────────────────────────────
export function setupAdminPaymentTestsRoutes(
  deps: AdminPaymentTestsRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  // POST /api/admin/integrations/phase13/execute-all
  app.post(
    "/api/admin/integrations/phase13/execute-all",
    async (req, res) => {
      try {
        if (!requireAdminSession(req, res)) return;

        // Hvis Stripe ikke er konfigurert: 503 og en tom liste.
        if (!process.env.STRIPE_SECRET_KEY) {
          res.status(503).json({
            success: false,
            error: "stripe_not_configured",
            successCount: 0,
            totalCount: 0,
            passed: 0,
            totalTests: 0,
            tests: [],
          });
          return;
        }

        // Force-bypass av cache via { force: true } i body.
        const force =
          req.body && typeof req.body === "object" && (req.body as any).force === true;

        if (!force && isCacheFresh(lastResultCache)) {
          res.json({
            ...lastResultCache.result,
            cached: true,
            cachedAt: new Date(lastResultCache.cachedAt).toISOString(),
          });
          return;
        }

        const result = await runStripeTests();
        lastResultCache = { result, cachedAt: Date.now() };

        res.json({ ...result, cached: false });
      } catch (err) {
        console.error("[admin-payment-tests] execute-all failed:", shortErr(err));
        res.status(500).json({
          success: false,
          error: "execute_all_failed",
          detail: shortErr(err),
          successCount: 0,
          totalCount: 0,
          passed: 0,
          totalTests: 0,
          tests: [],
        });
      }
    },
  );

  // GET /api/admin/payment-tests/status
  app.get("/api/admin/payment-tests/status", (req, res) => {
    try {
      if (!requireAdminSession(req, res)) return;

      if (!isCacheFresh(lastResultCache)) {
        res.json({
          cached: false,
          stale: Boolean(lastResultCache),
          result: null,
          ttl_ms: CACHE_TTL_MS,
        });
        return;
      }

      res.json({
        cached: true,
        cachedAt: new Date(lastResultCache.cachedAt).toISOString(),
        ageMs: Date.now() - lastResultCache.cachedAt,
        ttl_ms: CACHE_TTL_MS,
        result: lastResultCache.result,
      });
    } catch (err) {
      console.error("[admin-payment-tests] status failed:", shortErr(err));
      res.status(500).json({ error: "status_failed", detail: shortErr(err) });
    }
  });
}
