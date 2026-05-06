/**
 * Felles Stripe billing-utility for hele Role Room + Pressroom-stacken.
 *
 * Eksisterer for å sikre at alle Role Room/Stripe-touchpoints (Pressroom,
 * Dance, Casting SMS/WhatsApp, Role Room Agent subscription) bruker SAMME:
 *   1. Stripe API-versjon
 *   2. Tax-handling (tax_behavior + tax_code på priser, automatic_tax på subs)
 *   3. Customer-address-validering
 *   4. Norsk MVA-policy (25% standard for digital service)
 *
 * Bakgrunn (audit 2026-05-06): Pressroom og Role Room Agent hadde tax-handling
 * korrekt, men Dance + Casting SMS + Casting WhatsApp manglet tax_behavior
 * og automatic_tax helt — Stripe visste ikke om norsk MVA. Denne fila
 * konsoliderer mønsteret så alle billing-services applies på samme måte.
 *
 * Stripe Tax-prerequisite (gjøres én gang i Stripe dashboard):
 *   Settings → Tax → Add tax registration → Country: Norway, Type: Standard
 *   Aktiverer automatic 25% MVA-beregning for norske kunder.
 */

// ─────────────────────────────────────────────────────────────────────────
// Konstanter
// ─────────────────────────────────────────────────────────────────────────

/** Stripe API-versjon vi standardiserer på. Gjelder ALLE klienter i monorepo'en. */
export const ROLE_ROOM_STRIPE_API_VERSION = "2025-08-27.basil";

/** Norsk standard-MVA. Brukes som sanity-check + i metadata på usage-rader. */
export const NORWAY_VAT_RATE = 0.25;

/** Stripe Tax codes — disse er offisielle Stripe-kategorier.
 *  Slå opp ved tvil: https://stripe.com/docs/tax/tax-codes */
export const RR_TAX_CODE = {
  /** Generic digital service (Pressroom, AI-generation, render). */
  DIGITAL_SERVICE: "txcd_10000000",
  /** Software-as-a-service med data lagret. */
  SAAS: "txcd_10103001",
  /** Communication service (SMS, voice). */
  TELECOM_SMS: "txcd_30060000",
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Pris-konfigurasjon
// ─────────────────────────────────────────────────────────────────────────

interface PriceParamsCore {
  product: string;
  unit_amount: number;
  currency: string;
  lookup_key?: string;
  metadata?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recurring?: any;
}

/**
 * Apply Norway-compliant tax-config til en Stripe.Price-create-params.
 * Setter tax_behavior='exclusive' (alle våre priser er eks. mva.; Stripe Tax
 * legger på 25% basert på customer-location).
 *
 * @param tax_code Velg fra RR_TAX_CODE basert på produkt-type.
 */
export function applyTaxConfig<T extends PriceParamsCore>(
  params: T,
  tax_code: string,
): T & { tax_behavior: "exclusive" } {
  return {
    ...params,
    tax_behavior: "exclusive",
    metadata: {
      ...(params.metadata ?? {}),
      // Stamper tax_code i metadata også, så vi kan grep-e + verifisere.
      // (Stripe lagrer det på Price-objektet, ikke metadata, men dette
      // gjør audit-spørringer enklere.)
      tax_code,
    },
  } as T & { tax_behavior: "exclusive" };
}

/**
 * Apply Norway-compliant tax-config til Product-create-params.
 * Setter tax_code så Stripe Tax kan klassifisere produktet riktig.
 */
export function applyProductTaxConfig<T extends Record<string, unknown>>(
  params: T,
  tax_code: string,
): T & { tax_code: string } {
  return { ...params, tax_code };
}

// ─────────────────────────────────────────────────────────────────────────
// Subscription / Checkout / Invoice tax-config
// ─────────────────────────────────────────────────────────────────────────

interface AutomaticTaxCapableParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  automatic_tax?: any;
  metadata?: Record<string, string>;
}

/**
 * Apply automatic_tax til subscription/checkout/invoice-create-params.
 * Forutsetter at customer.address er satt — ellers vil Stripe Tax feile på
 * faktura-tidspunkt. Bruk validateCustomerAddress() før du oppretter.
 */
export function applyAutomaticTax<T extends AutomaticTaxCapableParams>(params: T): T {
  return {
    ...params,
    automatic_tax: { enabled: true },
  };
}

/**
 * Valider at en Stripe-customer har postal/country-adresse satt.
 * Stripe Tax krever dette for å beregne riktig sats.
 *
 * Returnerer { ok: true } hvis adresse er gyldig, ellers { ok: false, missing: [...] }.
 */
export async function validateCustomerAddress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripe: any,
  customerId: string,
): Promise<{ ok: true } | { ok: false; missing: string[] }> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    return { ok: false, missing: ["customer is deleted"] };
  }
  const addr = customer.address;
  const missing: string[] = [];
  if (!addr) {
    missing.push("address (object)");
  } else {
    if (!addr.country) missing.push("address.country");
    if (!addr.postal_code) missing.push("address.postal_code");
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

// ─────────────────────────────────────────────────────────────────────────
// Branded naming-helpers
// ─────────────────────────────────────────────────────────────────────────

/** Standard branding-prefix for Role Room-produkter i Stripe. */
export const RR_BRAND_PREFIXES = {
  ROLE_ROOM: "Role Room",
  PRESSROOM: "Pressroom",
  DANCE: "Role Room Dance",
  CASTING: "Role Room Casting",
} as const;

/**
 * Bygg et konsistent brand-prefix-produktnavn:
 *   brandedProductName('Pressroom', 'Pilot')  →  "Pressroom — Pilot"
 *   brandedProductName('Role Room Casting', 'SMS')  →  "Role Room Casting — SMS"
 */
export function brandedProductName(brand: string, product: string): string {
  return `${brand} — ${product}`;
}
