#!/usr/bin/env node

import Stripe from "stripe";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const liveConfirmed = args.has("--live");
const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_LIVE_SECRET_KEY;

if (!stripeKey) {
  console.error("STRIPE_SECRET_KEY eller STRIPE_LIVE_SECRET_KEY mangler.");
  process.exit(1);
}
if (stripeKey.startsWith("sk_live_") && !liveConfirmed) {
  console.error("Live-nøkkel oppdaget. Legg til --live for å bekrefte riktig Stripe-modus.");
  process.exit(1);
}
if (liveConfirmed && !stripeKey.startsWith("sk_live_")) {
  console.error("--live krever en sk_live_-nøkkel.");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);
const PRODUCT_FAMILY = "role_room_storage";
const TAX_CODE = "txcd_10103001";
const RETURN_URL = process.env.ROLE_ROOM_PUBLIC_URL?.trim() || "https://theroleroom.com";

const addOns = [
  {
    key: "extra_100_gib",
    name: "The Role Room — Ekstra lagring 100 GiB",
    description: "100 GiB ekstra organisasjonslagring for dokumenter, bilder og lyd. Video leveres via Cloudflare Stream.",
    amount: 12_900,
    lookupKey: "role_room_storage_extra_100_gib_monthly_v1",
    env: "ROLE_ROOM_STORAGE_PRICE_EXTRA_100_GIB_MONTHLY",
  },
  {
    key: "extra_1_tib",
    name: "The Role Room — Ekstra lagring 1 TiB",
    description: "1 TiB ekstra organisasjonslagring for dokumenter, bilder og lyd. Video leveres via Cloudflare Stream.",
    amount: 79_900,
    lookupKey: "role_room_storage_extra_1_tib_monthly_v1",
    env: "ROLE_ROOM_STORAGE_PRICE_EXTRA_1_TIB_MONTHLY",
  },
];

function metadataFor(addOn) {
  return {
    product_family: PRODUCT_FAMILY,
    billing_scope: "storage_addons",
    addon_key: addOn.key,
    pricing_version: "2026-09-10",
    provisioned_by: "provision-role-room-storage-stripe",
  };
}

async function findProduct(addOn) {
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (
      product.metadata?.product_family === PRODUCT_FAMILY
      && product.metadata?.addon_key === addOn.key
    ) return product;
  }
  return null;
}

async function ensureProduct(addOn) {
  const existing = await findProduct(addOn);
  const params = {
    name: addOn.name,
    description: addOn.description,
    tax_code: TAX_CODE,
    metadata: metadataFor(addOn),
  };
  if (existing) {
    if (!apply) return { product: existing, action: "would_update" };
    const product = await stripe.products.update(existing.id, params, {
      idempotencyKey: `rr-storage-product-update-${addOn.key}-v1`,
    });
    return { product, action: "updated" };
  }
  if (!apply) return { product: { id: "dry_run_product" }, action: "would_create" };
  const product = await stripe.products.create(params, {
    idempotencyKey: `rr-storage-product-create-${addOn.key}-v1`,
  });
  return { product, action: "created" };
}

function assertPrice(price, productId, addOn) {
  const correct = price.product === productId
    && price.currency === "nok"
    && price.unit_amount === addOn.amount
    && price.recurring?.interval === "month"
    && price.recurring?.usage_type === "licensed"
    && price.tax_behavior === "exclusive"
    && price.metadata?.product_family === PRODUCT_FAMILY
    && price.metadata?.addon_key === addOn.key;
  if (!correct) {
    throw new Error(`Lookup key ${addOn.lookupKey} finnes med feil pris- eller produktkontrakt.`);
  }
}

async function ensurePrice(productId, addOn) {
  const existing = await stripe.prices.list({
    active: true,
    lookup_keys: [addOn.lookupKey],
    limit: 10,
  });
  if (existing.data.length > 1) {
    throw new Error(`Flere aktive priser bruker lookup key ${addOn.lookupKey}.`);
  }
  if (existing.data[0]) {
    assertPrice(existing.data[0], productId, addOn);
    return { price: existing.data[0], action: "reused" };
  }
  if (!apply) return { price: { id: "dry_run_price" }, action: "would_create" };
  const price = await stripe.prices.create({
    product: productId,
    currency: "nok",
    unit_amount: addOn.amount,
    recurring: { interval: "month", usage_type: "licensed" },
    tax_behavior: "exclusive",
    lookup_key: addOn.lookupKey,
    nickname: `${addOn.name} — månedlig`,
    metadata: metadataFor(addOn),
  }, {
    idempotencyKey: `rr-storage-price-create-${addOn.key}-v1`,
  });
  assertPrice(price, productId, addOn);
  await stripe.products.update(productId, { default_price: price.id }, {
    idempotencyKey: `rr-storage-default-price-${addOn.key}-v1`,
  });
  return { price, action: "created" };
}

async function findPortalConfiguration() {
  for await (const configuration of stripe.billingPortal.configurations.list({ limit: 100 })) {
    if (
      configuration.metadata?.product_family === PRODUCT_FAMILY
      && configuration.metadata?.purpose === "storage_addon_cancel"
    ) return configuration;
  }
  return null;
}

function portalParams() {
  return {
    name: "The Role Room — administrer lagringstillegg",
    default_return_url: `${RETURN_URL.replace(/\/$/, "")}/role-room`,
    metadata: {
      product_family: PRODUCT_FAMILY,
      purpose: "storage_addon_cancel",
      provisioned_by: "provision-role-room-storage-stripe",
    },
    business_profile: {
      headline: "Administrer betalingsmåte eller avslutt lagringstillegget.",
      privacy_policy_url: `${RETURN_URL.replace(/\/$/, "")}/privacy`,
      terms_of_service_url: `${RETURN_URL.replace(/\/$/, "")}/terms`,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ["address", "name", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: {
          enabled: true,
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "too_complex",
            "customer_service",
            "other",
          ],
        },
      },
      subscription_update: { enabled: false },
    },
  };
}

async function ensurePortalConfiguration() {
  const existing = await findPortalConfiguration();
  if (!apply) {
    return { configuration: existing || { id: "dry_run_portal_configuration" }, action: existing ? "would_update" : "would_create" };
  }
  if (existing) {
    const configuration = await stripe.billingPortal.configurations.update(
      existing.id,
      portalParams(),
      { idempotencyKey: "rr-storage-portal-update-v1" },
    );
    return { configuration, action: "updated" };
  }
  const configuration = await stripe.billingPortal.configurations.create(
    portalParams(),
    { idempotencyKey: "rr-storage-portal-create-v1" },
  );
  return { configuration, action: "created" };
}

const mode = stripeKey.startsWith("sk_live_") ? "live" : "test";
const account = await stripe.accounts.retrieve();
const provisioned = [];
for (const addOn of addOns) {
  const productResult = await ensureProduct(addOn);
  const priceResult = await ensurePrice(productResult.product.id, addOn);
  provisioned.push({
    addOn: addOn.key,
    productId: productResult.product.id,
    productAction: productResult.action,
    priceId: priceResult.price.id,
    priceAction: priceResult.action,
    renderEnv: addOn.env,
  });
}
const portalResult = await ensurePortalConfiguration();

const receipt = {
  apply,
  mode,
  stripeAccountId: account.id,
  prices: provisioned,
  portal: {
    id: portalResult.configuration.id,
    action: portalResult.action,
    renderEnv: "ROLE_ROOM_STORAGE_BILLING_PORTAL_CONFIGURATION_ID",
  },
  safety: {
    oneTibCheckoutEnv: "ROLE_ROOM_STORAGE_1_TIB_CHECKOUT_ENABLED=false",
  },
};

const receiptKey = process.env.ROLE_ROOM_STORAGE_PROVISION_RECEIPT_KEY?.trim();
if (receiptKey) {
  if (!/^temporary\/stripe-provisioning-[A-Za-z0-9._-]+\.json$/.test(receiptKey)) {
    throw new Error("ROLE_ROOM_STORAGE_PROVISION_RECEIPT_KEY ma ligge under temporary/stripe-provisioning-*.json");
  }
  const bucket = process.env.AWS_ROLE_ROOM_BUCKET_NAME?.trim();
  const region = process.env.AWS_ROLE_ROOM_REGION?.trim();
  if (!bucket || !region) throw new Error("AWS Role Room bucket/region mangler for kvittering.");
  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  await new S3Client({ region }).send(new PutObjectCommand({
    Bucket: bucket,
    Key: receiptKey,
    Body: JSON.stringify(receipt),
    ContentType: "application/json",
  }));
}

console.log(JSON.stringify(receipt, null, 2));
