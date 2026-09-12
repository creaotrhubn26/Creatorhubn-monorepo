#!/usr/bin/env node
/**
 * attach-ai-overage-meter-price.mjs
 *
 * Fester den metered AI-overage-prisen (Fase C) som subscription-item på
 * EKSISTERENDE CreatorHub PLATTFORM-abonnement. Nye abonnement får linjen
 * automatisk via checkout-wiringen (index.ts), men dette skriptet dekker
 * abonnement som ble opprettet før wiringen, eller utenfor consumer-checkout.
 *
 * SIKKERHET:
 *  - DRY-RUN som default. Skriver KUN med `--apply`.
 *  - Idempotent: hopper over abonnement som allerede har meter-prisen.
 *  - Treffer KUN plattform-abonnement (subscription.metadata.ch_plan_id satt) —
 *    aldri Leadgrid/Role Room/andre vertikaler.
 *  - Å legge til en metered-linje koster 0 kr til bruk rapporteres, og bruk
 *    rapporteres kun når AI_OVERAGE_BILLING_ENABLED="true". Dette skriptet
 *    rapporterer ALDRI bruk og fakturerer ALDRI.
 *
 * Bruk:
 *   STRIPE_SECRET_KEY=sk_live_... CREATORHUB_AI_OVERAGE_PRICE_ID=price_... \
 *     node backend/scripts/attach-ai-overage-meter-price.mjs           # dry-run
 *   ... node backend/scripts/attach-ai-overage-meter-price.mjs --apply  # skriv
 *
 * Flagg/args:
 *   --apply            faktisk legg til linjen (ellers dry-run)
 *   --key=sk_...       overstyr Stripe-nøkkel
 *   --price=price_...  overstyr meter-price-id
 */

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const argVal = (name) => {
  const p = args.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : null;
};

const STRIPE_KEY =
  argVal("key") ||
  process.env.CREATORHUB_STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY ||
  "";
const PRICE_ID = argVal("price") || process.env.CREATORHUB_AI_OVERAGE_PRICE_ID || "";

if (!STRIPE_KEY) {
  console.error("Mangler Stripe-nøkkel (STRIPE_SECRET_KEY / --key).");
  process.exit(1);
}
if (!PRICE_ID) {
  console.error("Mangler meter-price-id (CREATORHUB_AI_OVERAGE_PRICE_ID / --price).");
  process.exit(1);
}

async function stripe(path, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}: ${JSON.stringify(json.error || json)}`);
  return json;
}

async function* allSubscriptions() {
  // status=all fanger alle levende abonnement (active/trialing/past_due/…).
  let startingAfter = null;
  for (;;) {
    const qs = new URLSearchParams({ status: "all", limit: "100" });
    if (startingAfter) qs.set("starting_after", startingAfter);
    const page = await stripe(`subscriptions?${qs.toString()}`);
    for (const s of page.data) yield s;
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

const run = async () => {
  console.log(`Modus: ${APPLY ? "APPLY (skriver)" : "DRY-RUN (leser kun)"}`);
  console.log(`Meter-price: ${PRICE_ID}\n`);

  let scanned = 0;
  let platform = 0;
  const toAttach = [];
  const alreadyHas = [];

  for await (const sub of allSubscriptions()) {
    scanned += 1;
    const planId = sub.metadata?.ch_plan_id;
    if (!planId) continue; // ikke et CreatorHub-plattform-abonnement
    platform += 1;
    const hasMeter = (sub.items?.data || []).some((it) => it.price?.id === PRICE_ID);
    if (hasMeter) {
      alreadyHas.push({ sub: sub.id, customer: sub.customer, plan: planId });
    } else {
      toAttach.push({ sub: sub.id, customer: sub.customer, plan: planId, status: sub.status });
    }
  }

  console.log(`Skannet ${scanned} abonnement · ${platform} plattform-abonnement (ch_plan_id satt).`);
  console.log(`  Har allerede meter-linjen: ${alreadyHas.length}`);
  console.log(`  Mangler meter-linjen:      ${toAttach.length}\n`);

  for (const t of toAttach) {
    console.log(`  [${t.status}] ${t.sub} (kunde ${t.customer}, plan ${t.plan})`);
  }

  if (!APPLY) {
    console.log(`\nDry-run ferdig. Kjør med --apply for å legge til meter-linjen på de ${toAttach.length} over.`);
    return;
  }

  let attached = 0;
  let errors = 0;
  for (const t of toAttach) {
    try {
      // proration_behavior=none: metered-linje = 0 kr nå, ingen proratering.
      await stripe("subscription_items", {
        method: "POST",
        body: { subscription: t.sub, price: PRICE_ID, proration_behavior: "none" },
      });
      attached += 1;
      console.log(`  ✓ festet på ${t.sub}`);
    } catch (e) {
      errors += 1;
      console.error(`  ✗ ${t.sub}: ${e.message}`);
    }
  }
  console.log(`\nFerdig. Festet: ${attached} · Feil: ${errors} · Hadde allerede: ${alreadyHas.length}`);
};

run().catch((e) => {
  console.error("Skript feilet:", e.message);
  process.exit(1);
});
