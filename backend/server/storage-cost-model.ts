// Storage-cost-model — eksponerer Cloudflare-kostnader og en formel for
// "hva burde plan-prisen være" basert på storage-cap admin setter.
//
// Brukes av:
//   - price-administration-routes PATCH-handler (auto-justering når admin
//     setter ny maxStorageGB)
//   - Admin-UI (vise kost + foreslått minimumspris i sanntid)
//
// Tallene er hentet fra Cloudflare's offentlige prismatrise per 2026:
//   - R2 storage: $0.015 per GB-måned
//   - R2 Class A operations (PUT, LIST): $4.50 per million
//   - R2 Class B operations (GET): $0.36 per million
//   - R2 egress: $0 (gratis)
//   - Stream storage: $5 per 1000 minutter video = $0.005 per minutt
//   - Stream delivery: $1 per 1000 minutter levert = $0.001 per minutt
//
// NOK-konverteringen bruker en konservativ vekslingskurs (10.5 NOK/USD)
// så vi ikke underestimerer. Justérbar via env STORAGE_COST_NOK_PER_USD.

const NOK_PER_USD_DEFAULT = 10.5;

const nokPerUsd = (): number => {
  const env = process.env.STORAGE_COST_NOK_PER_USD;
  if (env) {
    const parsed = parseFloat(env);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return NOK_PER_USD_DEFAULT;
};

// Anta blandet bruksprofil: 70% R2-trafikk, 30% Stream (videoer).
// For 1 GB per måned ute hos kunde:
//   - R2 share: 0.7 GB · $0.015 + ~moderate ops ≈ $0.012
//   - Stream share: ~3 min per GB-equivalent · ($0.005 + $0.001) ≈ $0.018
// Total per GB per måned: ~$0.030 → ~0.32 NOK med 10.5 NOK/USD.
//
// Default-faktor: vi runder opp til 0.5 NOK/GB/mnd for å dekke variasjon.
// Bruker env-override hvis admin vil justere.
const DEFAULT_COST_NOK_PER_GB_MONTH = 0.5;

export const costNokPerGbMonth = (): number => {
  const env = process.env.STORAGE_COST_NOK_PER_GB_MONTH;
  if (env) {
    const parsed = parseFloat(env);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_COST_NOK_PER_GB_MONTH;
};

// Mark-up multiplier for selvbetjente planer (admin kan overstyre via env).
// 3× kostpris = 33% kost-andel, 67% margin. Konservativt og fortsatt
// konkurransedyktig vs Dropbox/Google Drive.
const DEFAULT_PRICE_MARKUP = 3;

export const storageMarkup = (): number => {
  const env = process.env.STORAGE_MARGIN_MARKUP;
  if (env) {
    const parsed = parseFloat(env);
    if (Number.isFinite(parsed) && parsed >= 1) return parsed;
  }
  return DEFAULT_PRICE_MARKUP;
};

export interface StorageCostBreakdown {
  storageGB: number;
  // Råkost-tall
  costNokPerGbMonth: number;
  monthlyCostNok: number;
  yearlyCostNok: number;
  // Foreslått pris med margin
  markupMultiplier: number;
  suggestedMonthlyPriceNok: number;
  suggestedYearlyPriceNok: number;
  // Hva trengs minst for å break-even med valgt markup
  minMonthlyPriceNok: number;
  // Foreslått overage-pris per GB (samme markup på kostpris)
  suggestedOveragePricePerGbNok: number;
  // Eksponer parameterne så frontend kan vise dem
  nokPerUsd: number;
  notes: string[];
}

/**
 * Beregn kost- og prisanbefaling for en gitt storage-cap.
 *
 * Eksempel: 50 GB plan:
 *   cost = 50 · 0.5 = 25 kr/mnd kost
 *   suggested = 25 · 3 = 75 kr/mnd (kun for storage-laget)
 *   I praksis ligger storage-laget oppå feature-prisen, så admin
 *   ser dette som "minimumstillegg".
 */
export function calculateStorageCostBreakdown(
  storageGB: number,
): StorageCostBreakdown {
  const costPerGb = costNokPerGbMonth();
  const markup = storageMarkup();
  const monthly = storageGB * costPerGb;
  const yearly = monthly * 12;
  const suggested = Math.ceil(monthly * markup);
  const suggestedYearly = Math.ceil(suggested * 10); // 2 mnd gratis ved årlig
  return {
    storageGB,
    costNokPerGbMonth: costPerGb,
    monthlyCostNok: Math.round(monthly * 100) / 100,
    yearlyCostNok: Math.round(yearly * 100) / 100,
    markupMultiplier: markup,
    suggestedMonthlyPriceNok: suggested,
    suggestedYearlyPriceNok: suggestedYearly,
    minMonthlyPriceNok: Math.ceil(monthly),
    suggestedOveragePricePerGbNok: Math.ceil(costPerGb * markup * 10) / 10,
    nokPerUsd: nokPerUsd(),
    notes: [
      `Kost-basis: ${costPerGb} NOK per GB per måned (Cloudflare R2+Stream blandet).`,
      `Markup-multiplikator: ${markup}× (env STORAGE_MARGIN_MARKUP).`,
      `Vekslingskurs: ${nokPerUsd()} NOK/USD (env STORAGE_COST_NOK_PER_USD).`,
    ],
  };
}

/**
 * Auto-justering: beregn ny månedlig pris når storage-cap endres.
 * Brukes når admin har valgt "Juster pris automatisk" i edit-dialogen.
 *
 * Strategi: behold differansen mellom nåværende pris og kostpris
 * (admin's "feature-margin") og legg den oppå ny kostpris.
 *
 *   prevMargin = prevMonthlyPrice - prevStorageCost·markup
 *   newPrice   = prevMargin + newStorageCost·markup
 *
 * Returnerer null hvis ingen meningsfull justering kan beregnes.
 */
export function suggestAutoAdjustedMonthlyPrice(
  prevStorageGB: number,
  prevMonthlyPriceNok: number,
  newStorageGB: number,
): {
  newMonthlyPriceNok: number;
  delta: number;
  basis: string;
} | null {
  if (
    !Number.isFinite(prevStorageGB) ||
    !Number.isFinite(prevMonthlyPriceNok) ||
    !Number.isFinite(newStorageGB) ||
    prevStorageGB < 0 ||
    newStorageGB < 0
  ) {
    return null;
  }
  const costPerGb = costNokPerGbMonth();
  const markup = storageMarkup();
  const prevStorageBaseline = prevStorageGB * costPerGb * markup;
  const newStorageBaseline = newStorageGB * costPerGb * markup;
  const previousFeatureMargin = prevMonthlyPriceNok - prevStorageBaseline;
  const proposed = Math.max(
    0,
    Math.ceil(previousFeatureMargin + newStorageBaseline),
  );
  return {
    newMonthlyPriceNok: proposed,
    delta: proposed - prevMonthlyPriceNok,
    basis: `${Math.round(previousFeatureMargin)} kr feature-margin + ${Math.round(newStorageBaseline)} kr storage-baseline (cost-${costPerGb}NOK/GB · markup-${markup}×)`,
  };
}
