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

// ── Kost per backend ────────────────────────────────────────────────
//
// Den blandede faktoren over ble regnet da alt lå i Cloudflare. B2 er nå
// primærlager, og B2 er vesentlig billigere per GB enn R2. Blandingen
// alene overvurderer derfor kostnaden, og en pris satt på den er høyere
// enn den trenger å være — marginen ser mindre ut enn den er.
//
// Tallene her er listepriser i USD per juli 2026 og skal overstyres med
// de faktiske avtaleprisene. En reseller- eller B2 Reserve-avtale ligger
// under listepris; til da er defaulten konservativ i riktig retning.

export type CostBackend = "b2" | "r2" | "cloudflare_stream" | "filesystem";

export interface BackendCostBasis {
  /** USD per GB lagret per måned. */
  storagePerGbMonthUsd: number;
  /** USD per GB egress ut over gratiskvantumet. */
  egressPerGbUsd: number;
  /**
   * Gratis egress som multiplum av lagret mengde per måned. B2 gir 3×.
   * R2 har fri egress — derfor Infinity. 0 betyr at all egress koster.
   */
  freeEgressMultiplier: number;
}

const envNum = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = parseFloat(raw.trim());
  // NaN eller negativ pris er alltid en konfigurasjonsfeil, aldri en
  // gyldig avtale. Defaulten er da et bedre svar enn et tall som gir
  // negativ margin i en faktura.
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export function backendCostBasis(): Record<CostBackend, BackendCostBasis> {
  return {
    b2: {
      storagePerGbMonthUsd: envNum(process.env.STORAGE_COST_B2_PER_GB_MONTH, 0.006),
      egressPerGbUsd: envNum(process.env.STORAGE_COST_B2_EGRESS_PER_GB, 0.01),
      freeEgressMultiplier: envNum(
        process.env.STORAGE_COST_B2_FREE_EGRESS_MULTIPLIER,
        3,
      ),
    },
    r2: {
      storagePerGbMonthUsd: envNum(process.env.STORAGE_COST_R2_PER_GB_MONTH, 0.015),
      egressPerGbUsd: 0,
      freeEgressMultiplier: Infinity,
    },
    cloudflare_stream: {
      // Stream prises per lagret og levert minutt, ikke per GB. Vi fører
      // den i GB her så én modell dekker alt; omregningen er en
      // tilnærming, siden faktisk bitrate varierer med oppløsning.
      storagePerGbMonthUsd: envNum(
        process.env.STORAGE_COST_STREAM_PER_GB_MONTH,
        0.1,
      ),
      egressPerGbUsd: envNum(process.env.STORAGE_COST_STREAM_EGRESS_PER_GB, 0.05),
      freeEgressMultiplier: 0,
    },
    filesystem: {
      // Disk på vår egen server er en fast kostnad som ikke skalerer per
      // fil. Å prise den per GB ville fakturert den to ganger.
      storagePerGbMonthUsd: 0,
      egressPerGbUsd: 0,
      freeEgressMultiplier: Infinity,
    },
  };
}

export interface BackendUsage {
  backend: CostBackend;
  storedBytes: number;
  /** Bytes lastet ned i perioden. Utelatt = 0. */
  egressBytes?: number;
}

export interface BackendCostResult {
  backend: CostBackend;
  storedGb: number;
  egressGb: number;
  /** Egress som lå innenfor gratiskvantumet. */
  freeEgressGb: number;
  billableEgressGb: number;
  storageCostNok: number;
  egressCostNok: number;
  totalCostNok: number;
}

const GIB = 1024 * 1024 * 1024;

/**
 * Hva ett forbruk på én backend koster oss i én måned.
 *
 * Lagring og egress holdes atskilt fordi de oppfører seg ulikt: lagring
 * løper så lenge fila finnes, egress hver gang noen henter den. En
 * produksjon som laster ned dailies daglig kan koste mer i egress enn i
 * lagring, og en modell som bare teller GB lagret ville ikke sett det.
 */
export function costForBackendUsage(usage: BackendUsage): BackendCostResult {
  const basis = backendCostBasis()[usage.backend];
  const rate = nokPerUsd();
  const storedGb = Math.max(0, usage.storedBytes) / GIB;
  const egressGb = Math.max(0, usage.egressBytes ?? 0) / GIB;

  // Gratiskvantumet følger lagret mengde, ikke en fast grense: lagrer du
  // mer, får du hente mer gratis. Slik regner B2 det.
  const freeEgressGb = Number.isFinite(basis.freeEgressMultiplier)
    ? Math.min(egressGb, storedGb * basis.freeEgressMultiplier)
    : egressGb;
  const billableEgressGb = Math.max(0, egressGb - freeEgressGb);

  const storageCostNok = storedGb * basis.storagePerGbMonthUsd * rate;
  const egressCostNok = billableEgressGb * basis.egressPerGbUsd * rate;

  return {
    backend: usage.backend,
    storedGb,
    egressGb,
    freeEgressGb,
    billableEgressGb,
    storageCostNok,
    egressCostNok,
    totalCostNok: storageCostNok + egressCostNok,
  };
}

export interface MarginResult {
  costNok: number;
  revenueNok: number;
  marginNok: number;
  /** Andel av inntekten som er margin. null når inntekten er null. */
  marginFraction: number | null;
}

/**
 * Marginen på et forbruk, gitt hva kunden faktisk faktureres for
 * perioden — ikke listeprisen. Rabatt, inkludert kvote og fastpris er
 * allerede trukket fra når tallet kommer hit.
 */
export function marginForUsage(
  usages: BackendUsage[],
  revenueNok: number,
): MarginResult {
  const costNok = usages.reduce(
    (sum, u) => sum + costForBackendUsage(u).totalCostNok,
    0,
  );
  return {
    costNok,
    revenueNok,
    marginNok: revenueNok - costNok,
    // Margin på null inntekt er udefinert, ikke 0 %. Å returnere 0 ville
    // sett ut som "vi går i null" i en admin-graf.
    marginFraction: revenueNok > 0 ? (revenueNok - costNok) / revenueNok : null,
  };
}

/**
 * Prisen vi må ta per GB for å nå en ønsket margin. Brukes til å sette
 * prisliste, ikke til å fakturere.
 */
export function priceForTargetMargin(
  backend: CostBackend,
  targetMarginFraction: number,
): number | null {
  // 100 % margin krever uendelig pris på en kostnad over null, og
  // Infinity ville forplantet seg rett inn i en prisliste.
  if (targetMarginFraction >= 1 || targetMarginFraction < 0) return null;
  const costNok = backendCostBasis()[backend].storagePerGbMonthUsd * nokPerUsd();
  return costNok / (1 - targetMarginFraction);
}

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
