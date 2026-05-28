#!/usr/bin/env node
/**
 * check-role-room-billing.mjs
 *
 * Verifiserer at Stripe-stack-en for Role Room commercial-access er
 * korrekt konfigurert. Sjekker:
 *
 *   1. STRIPE_SECRET_KEY (eller STRIPE_API_KEY fallback) er satt og gyldig
 *      mot Stripe (kall GET /v1/balance — billig, gratis, no-op).
 *   2. ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM eksisterer i Stripe og
 *      har forventet beløp (795 kr/mnd).
 *   3. ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER eksisterer i Stripe og
 *      har forventet beløp (495 kr/mnd).
 *   4. STRIPE_WEBHOOK_SECRET er satt og har whsec_-prefiks.
 *   5. ROLE_ROOM_PUBLIC_URL eller PUBLIC_APP_URL er satt.
 *
 * Sender ALDRI hele secrets til konsoll. Maskerer alle.
 *
 * Bruk lokalt:
 *   STRIPE_SECRET_KEY=sk_test_… \
 *   ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM=price_… \
 *   ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER=price_… \
 *   STRIPE_WEBHOOK_SECRET=whsec_… \
 *   ROLE_ROOM_PUBLIC_URL=https://theroleroom.com \
 *   node backend/scripts/check-role-room-billing.mjs
 *
 * På Render: kjør i shell-tab med samme env-vars eksponert.
 */

import process from "node:process";

const EXPECTED_PRICE_NOK = {
  production_team: 79500, // 795 kr i øre (Stripe-format)
  content_producer: 49500, // 495 kr
};

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function mask(value) {
  if (!value) return "<unset>";
  const trimmed = value.trim();
  if (trimmed.length <= 11) return "***";
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
}

function fmt(ok, label, detail) {
  const icon = ok ? "✓" : "✗";
  const color = ok ? "\x1b[32m" : "\x1b[31m";
  const reset = "\x1b[0m";
  const detailStr = detail ? `  ${detail}` : "";
  return `${color}${icon}${reset} ${label}${detailStr}`;
}

function warn(label, detail) {
  const detailStr = detail ? `  ${detail}` : "";
  return `\x1b[33m⚠\x1b[0m ${label}${detailStr}`;
}

async function stripeGet(path, apiKey) {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const stripeKey =
    (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || "").trim();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const productionPriceId =
    (process.env.ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM || "").trim();
  const contentPriceId =
    (process.env.ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER || "").trim();
  const publicUrl =
    (process.env.ROLE_ROOM_PUBLIC_URL || process.env.PUBLIC_APP_URL || "").trim();

  console.log("\n=== Role Room billing — Stripe health check ===\n");

  let failures = 0;
  let warnings = 0;

  // 1. STRIPE_SECRET_KEY
  if (!stripeKey) {
    console.log(fmt(false, "STRIPE_SECRET_KEY", "ikke satt"));
    console.log(
      "\n  ✗ Stopper her — uten secret key er ingen videre sjekk meningsfull.\n",
    );
    process.exit(1);
  }
  console.log(`  Key: ${mask(stripeKey)}  (${stripeKey.startsWith("sk_live_") ? "LIVE" : stripeKey.startsWith("sk_test_") ? "TEST" : "ukjent prefix"})`);

  // 2. Verifiser at key er gyldig
  const balance = await stripeGet("/balance", stripeKey);
  if (balance.ok) {
    console.log(fmt(true, "STRIPE_SECRET_KEY gyldig", "/v1/balance svarte 200"));
  } else {
    console.log(
      fmt(
        false,
        "STRIPE_SECRET_KEY ugyldig",
        `${balance.status} ${balance.body?.error?.message || ""}`,
      ),
    );
    failures++;
  }

  // 3. STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.log(fmt(false, "STRIPE_WEBHOOK_SECRET", "ikke satt"));
    failures++;
  } else if (!webhookSecret.startsWith("whsec_")) {
    console.log(
      fmt(false, "STRIPE_WEBHOOK_SECRET", "har ikke whsec_-prefiks (sannsynligvis feil verdi)"),
    );
    failures++;
  } else {
    console.log(
      fmt(true, "STRIPE_WEBHOOK_SECRET", `${mask(webhookSecret)} — format OK`),
    );
  }

  // 4. ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM
  if (!productionPriceId) {
    console.log(
      fmt(false, "ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM", "ikke satt — 795 kr-tier vil ikke fungere"),
    );
    failures++;
  } else {
    const price = await stripeGet(`/prices/${productionPriceId}`, stripeKey);
    if (!price.ok) {
      console.log(
        fmt(
          false,
          "ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM",
          `${productionPriceId} finnes ikke i Stripe — ${price.body?.error?.message || price.status}`,
        ),
      );
      failures++;
    } else {
      const p = price.body;
      const amountOk = p.unit_amount === EXPECTED_PRICE_NOK.production_team;
      const currencyOk = p.currency === "nok";
      const intervalOk = p.recurring?.interval === "month";
      const allOk = amountOk && currencyOk && intervalOk && p.active;
      const detail = `${productionPriceId} → ${(p.unit_amount ?? 0) / 100} ${p.currency?.toUpperCase()} / ${p.recurring?.interval} · active=${p.active}`;
      console.log(fmt(allOk, "Produksjonsteam-pris (795 kr)", detail));
      if (!amountOk) {
        console.log(
          warn(
            "  beløp avviker",
            `forventet ${EXPECTED_PRICE_NOK.production_team / 100} NOK, fant ${(p.unit_amount ?? 0) / 100}`,
          ),
        );
        warnings++;
      }
      if (!currencyOk) {
        console.log(warn("  valuta avviker", `forventet NOK, fant ${p.currency?.toUpperCase()}`));
        warnings++;
      }
      if (!intervalOk) {
        console.log(warn("  interval avviker", `forventet month, fant ${p.recurring?.interval}`));
        warnings++;
      }
      if (!p.active) {
        console.log(warn("  pris er ikke aktiv i Stripe", "checkout vil feile"));
        warnings++;
      }
    }
  }

  // 5. ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER
  if (!contentPriceId) {
    console.log(
      fmt(false, "ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER", "ikke satt — 495 kr-tier vil ikke fungere"),
    );
    failures++;
  } else {
    const price = await stripeGet(`/prices/${contentPriceId}`, stripeKey);
    if (!price.ok) {
      console.log(
        fmt(
          false,
          "ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER",
          `${contentPriceId} finnes ikke i Stripe — ${price.body?.error?.message || price.status}`,
        ),
      );
      failures++;
    } else {
      const p = price.body;
      const amountOk = p.unit_amount === EXPECTED_PRICE_NOK.content_producer;
      const currencyOk = p.currency === "nok";
      const intervalOk = p.recurring?.interval === "month";
      const allOk = amountOk && currencyOk && intervalOk && p.active;
      const detail = `${contentPriceId} → ${(p.unit_amount ?? 0) / 100} ${p.currency?.toUpperCase()} / ${p.recurring?.interval} · active=${p.active}`;
      console.log(fmt(allOk, "Innholdsprodusent-pris (495 kr)", detail));
      if (!amountOk) {
        console.log(
          warn(
            "  beløp avviker",
            `forventet ${EXPECTED_PRICE_NOK.content_producer / 100} NOK, fant ${(p.unit_amount ?? 0) / 100}`,
          ),
        );
        warnings++;
      }
      if (!currencyOk) {
        console.log(warn("  valuta avviker", `forventet NOK, fant ${p.currency?.toUpperCase()}`));
        warnings++;
      }
      if (!intervalOk) {
        console.log(warn("  interval avviker", `forventet month, fant ${p.recurring?.interval}`));
        warnings++;
      }
      if (!p.active) {
        console.log(warn("  pris er ikke aktiv i Stripe", "checkout vil feile"));
        warnings++;
      }
    }
  }

  // 6. PUBLIC_URL
  if (!publicUrl) {
    console.log(
      fmt(false, "ROLE_ROOM_PUBLIC_URL / PUBLIC_APP_URL", "ikke satt — checkout-return-URL vil feile"),
    );
    failures++;
  } else {
    console.log(fmt(true, "Public URL", publicUrl));
  }

  console.log("");
  if (failures === 0 && warnings === 0) {
    console.log("\x1b[32m✓ Alle sjekk passert. Stripe-billing-stacken er klar.\x1b[0m\n");
    process.exit(0);
  } else if (failures === 0) {
    console.log(
      `\x1b[33m⚠ ${warnings} advarsel(er) — sjekk om dette er bevisst.\x1b[0m\n`,
    );
    process.exit(0);
  } else {
    console.log(
      `\x1b[31m✗ ${failures} feil${warnings ? ` + ${warnings} advarsler` : ""}. Fiks før prod-bruk.\x1b[0m\n`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n\x1b[31m✗ Uventet feil:\x1b[0m", err);
  process.exit(2);
});
