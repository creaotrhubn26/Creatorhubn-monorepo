/**
 * role-room-billing-health-routes.ts
 *
 * GET /api/admin-room/role-room-billing-health
 *
 * Admin-gated health-check for Role Room commercial-billing-stacken.
 * Speiler logikken i `backend/scripts/check-role-room-billing.mjs` slik
 * at Daniel kan sjekke konfigurasjon fra Admin Room uten å åpne
 * Render-shell.
 *
 * Sender ALDRI secrets til klienten — kun boolske flags + maskerte
 * key-previews. Pris-objekter fra Stripe inkluderes som de er (amount,
 * currency, interval, active) siden de ikke er hemmelige.
 *
 * Tilgang: requireAdminSession (admin/owner/super_admin).
 */

import type express from "express";
import Stripe from "stripe";
import {
  getRoleRoomStripeSecretKey,
  getRoleRoomStripeWebhookSecret,
  getRoleRoomStripePriceId,
  getDefaultRoleRoomPublicOrigin,
  type RoleRoomCommercialPersona,
} from "./role-room-billing-routes.js";

const EXPECTED_UNIT_AMOUNT: Record<RoleRoomCommercialPersona, number> = {
  production_team: 79500, // 795 kr i øre
  content_producer: 49500, // 495 kr
};

interface PriceCheckResult {
  configured: boolean;
  priceIdPreview: string | null;
  exists: boolean | null;
  unitAmount: number | null;
  currency: string | null;
  interval: string | null;
  active: boolean | null;
  amountMatchesExpected: boolean | null;
  expectedAmountKr: number;
  errorMessage: string | null;
}

function mask(value: string): string {
  if (!value) return "<unset>";
  const trimmed = value.trim();
  if (trimmed.length <= 11) return "***";
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
}

async function checkPrice(
  stripe: Stripe,
  persona: RoleRoomCommercialPersona,
): Promise<PriceCheckResult> {
  const priceId = getRoleRoomStripePriceId(persona);
  const expectedMinor = EXPECTED_UNIT_AMOUNT[persona];
  if (!priceId) {
    return {
      configured: false,
      priceIdPreview: null,
      exists: null,
      unitAmount: null,
      currency: null,
      interval: null,
      active: null,
      amountMatchesExpected: null,
      expectedAmountKr: expectedMinor / 100,
      errorMessage: null,
    };
  }
  try {
    const price = await stripe.prices.retrieve(priceId);
    return {
      configured: true,
      priceIdPreview: mask(priceId),
      exists: true,
      unitAmount: price.unit_amount ?? null,
      currency: price.currency ?? null,
      interval: price.recurring?.interval ?? null,
      active: price.active,
      amountMatchesExpected: price.unit_amount === expectedMinor,
      expectedAmountKr: expectedMinor / 100,
      errorMessage: null,
    };
  } catch (err) {
    return {
      configured: true,
      priceIdPreview: mask(priceId),
      exists: false,
      unitAmount: null,
      currency: null,
      interval: null,
      active: null,
      amountMatchesExpected: null,
      expectedAmountKr: expectedMinor / 100,
      errorMessage: (err as Error).message,
    };
  }
}

export interface RoleRoomBillingHealthRoutesDeps {
  app: express.Application;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => unknown;
}

export function setupRoleRoomBillingHealthRoutes(
  deps: RoleRoomBillingHealthRoutesDeps,
): void {
  const { app, requireAdminSession } = deps;

  app.get("/api/admin-room/role-room-billing-health", async (req, res) => {
    if (!requireAdminSession(req, res)) return;

    const secretKey = getRoleRoomStripeSecretKey();
    const webhookSecret = getRoleRoomStripeWebhookSecret();
    const publicUrl = getDefaultRoleRoomPublicOrigin();

    const result: Record<string, unknown> = {
      checkedAt: new Date().toISOString(),
      stripeSecretKey: {
        configured: !!secretKey,
        preview: secretKey ? mask(secretKey) : null,
        mode: secretKey.startsWith("sk_live_")
          ? "live"
          : secretKey.startsWith("sk_test_")
            ? "test"
            : "unknown",
        validatedAgainstStripe: false as boolean | null,
        errorMessage: null as string | null,
      },
      webhookSecret: {
        configured: !!webhookSecret,
        preview: webhookSecret ? mask(webhookSecret) : null,
        formatOk: webhookSecret.startsWith("whsec_"),
      },
      productionTeamPrice: null as PriceCheckResult | null,
      contentProducerPrice: null as PriceCheckResult | null,
      publicUrl: {
        configured: !!publicUrl,
        value: publicUrl || null,
      },
    };

    if (!secretKey) {
      res.json({
        ...result,
        overall: "failed",
        failureCount: 1,
        warningCount: 0,
        summary:
          "STRIPE_SECRET_KEY mangler — uten den er ingen videre sjekk meningsfull.",
      });
      return;
    }

    const stripe = new Stripe(secretKey);

    // Validate secret key by pinging /v1/balance (gratis, no-op).
    try {
      await stripe.balance.retrieve();
      (result.stripeSecretKey as Record<string, unknown>).validatedAgainstStripe = true;
    } catch (err) {
      (result.stripeSecretKey as Record<string, unknown>).validatedAgainstStripe = false;
      (result.stripeSecretKey as Record<string, unknown>).errorMessage =
        (err as Error).message;
    }

    result.productionTeamPrice = await checkPrice(stripe, "production_team");
    result.contentProducerPrice = await checkPrice(stripe, "content_producer");

    // Aggreger failures + warnings
    let failures = 0;
    let warnings = 0;
    if (!(result.stripeSecretKey as Record<string, unknown>).validatedAgainstStripe) failures++;
    if (!(result.webhookSecret as Record<string, unknown>).configured) failures++;
    if (
      (result.webhookSecret as Record<string, unknown>).configured &&
      !(result.webhookSecret as Record<string, unknown>).formatOk
    )
      failures++;
    if (!(result.publicUrl as Record<string, unknown>).configured) failures++;

    for (const priceKey of ["productionTeamPrice", "contentProducerPrice"]) {
      const p = result[priceKey] as PriceCheckResult;
      if (!p.configured) {
        failures++;
        continue;
      }
      if (p.exists === false) {
        failures++;
        continue;
      }
      if (p.amountMatchesExpected === false) warnings++;
      if (p.currency && p.currency !== "nok") warnings++;
      if (p.interval && p.interval !== "month") warnings++;
      if (p.active === false) warnings++;
    }

    const overall = failures > 0 ? "failed" : warnings > 0 ? "warnings" : "ok";

    res.json({
      ...result,
      overall,
      failureCount: failures,
      warningCount: warnings,
      summary:
        overall === "ok"
          ? "Alle sjekk passert. Stripe-billing-stacken er klar."
          : overall === "warnings"
            ? `${warnings} advarsel(er) — sjekk om dette er bevisst.`
            : `${failures} feil${warnings ? ` + ${warnings} advarsler` : ""}. Fiks før prod-bruk.`,
    });
  });
}
