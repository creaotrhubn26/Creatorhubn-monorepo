/**
 * role-room-ads-shared.ts
 *
 * Shared types + helpers for Role Room Ads 2.0 (Meta + Google + TikTok).
 *
 * - Budget-recommendation engine (industry × revenue × goal × growth-phase)
 * - Per-platform allocation
 * - Management-fee math (15 % of media spend, MVA-aware)
 * - Stripe meter-event helpers (one meter per platform, fires on daily metrics-poll)
 *
 * See memory/ads_2_0_architecture.md for the full design.
 */

export type AdsPlatform = "meta" | "google" | "tiktok" | "linkedin";

export type AdsGoal =
  | "brand_awareness"
  | "engagement"
  | "lead_generation"
  | "ecommerce_conversion"
  | "retargeting";

export type GrowthPhase = "launch" | "growth" | "established" | "maintenance";

export type IndustryCategory =
  | "restaurant"
  | "ecommerce"
  | "local_smb"
  | "b2b_saas"
  | "fashion"
  | "real_estate"
  | "automotive"
  | "beauty"
  | "fitness"
  | "professional_services"
  | "other";

// ─────────────────────────────────────────────────────────
// Industry table — drives the auto-budget recommendation.
// Values represent the spread the engine picks the midpoint of
// unless a goal_modifier shifts it.
// ─────────────────────────────────────────────────────────

interface IndustryFactors {
  marketingShareOfRevenue: [number, number]; // % of revenue spent on marketing
  digitalAdsShareOfMarketing: [number, number]; // % of marketing budget on digital ads
  platformAllocation: Record<AdsPlatform, number>; // sums to 1.0
  description: string;
}

export const INDUSTRY_FACTORS: Record<IndustryCategory, IndustryFactors> = {
  restaurant: {
    marketingShareOfRevenue: [0.05, 0.10],
    digitalAdsShareOfMarketing: [0.60, 0.80],
    platformAllocation: { meta: 0.70, google: 0.25, tiktok: 0.05, linkedin: 0 },
    description: "Restaurant / kafé / bakeri — visuell mat-content + lokal targeting",
  },
  ecommerce: {
    marketingShareOfRevenue: [0.15, 0.25],
    digitalAdsShareOfMarketing: [0.70, 0.90],
    platformAllocation: { meta: 0.50, google: 0.30, tiktok: 0.20, linkedin: 0 },
    description: "Nettbutikk — produktkatalog + retargeting + intent-search",
  },
  local_smb: {
    marketingShareOfRevenue: [0.03, 0.08],
    digitalAdsShareOfMarketing: [0.50, 0.70],
    platformAllocation: { meta: 0.60, google: 0.35, tiktok: 0.05, linkedin: 0 },
    description: "Lokal SMB (frisør, fysio, etc.) — lokal awareness + booking",
  },
  b2b_saas: {
    marketingShareOfRevenue: [0.05, 0.15],
    digitalAdsShareOfMarketing: [0.60, 0.80],
    platformAllocation: { meta: 0.25, google: 0.50, tiktok: 0, linkedin: 0.25 },
    description: "B2B / SaaS — intent-search + LinkedIn-decision-makers",
  },
  fashion: {
    marketingShareOfRevenue: [0.10, 0.20],
    digitalAdsShareOfMarketing: [0.70, 0.85],
    platformAllocation: { meta: 0.45, google: 0.20, tiktok: 0.35, linkedin: 0 },
    description: "Mode / lifestyle — visuell + influencer-mimicking",
  },
  real_estate: {
    marketingShareOfRevenue: [0.03, 0.07],
    digitalAdsShareOfMarketing: [0.60, 0.80],
    platformAllocation: { meta: 0.50, google: 0.45, tiktok: 0.05, linkedin: 0 },
    description: "Eiendom / megler — listings + boligjakt-search",
  },
  automotive: {
    marketingShareOfRevenue: [0.03, 0.07],
    digitalAdsShareOfMarketing: [0.60, 0.80],
    platformAllocation: { meta: 0.50, google: 0.45, tiktok: 0.05, linkedin: 0 },
    description: "Bilforhandler — local awareness + intent-search",
  },
  beauty: {
    marketingShareOfRevenue: [0.08, 0.15],
    digitalAdsShareOfMarketing: [0.70, 0.85],
    platformAllocation: { meta: 0.55, google: 0.20, tiktok: 0.25, linkedin: 0 },
    description: "Skjønnhet / salong / produkter — before/after-content",
  },
  fitness: {
    marketingShareOfRevenue: [0.05, 0.10],
    digitalAdsShareOfMarketing: [0.65, 0.80],
    platformAllocation: { meta: 0.55, google: 0.30, tiktok: 0.15, linkedin: 0 },
    description: "Treningssenter / PT — medlems-akkvisisjon",
  },
  professional_services: {
    marketingShareOfRevenue: [0.04, 0.10],
    digitalAdsShareOfMarketing: [0.50, 0.70],
    platformAllocation: { meta: 0.30, google: 0.50, tiktok: 0, linkedin: 0.20 },
    description: "Advokat / konsulent / regnskap — autoritets-content + search",
  },
  other: {
    marketingShareOfRevenue: [0.05, 0.10],
    digitalAdsShareOfMarketing: [0.60, 0.80],
    platformAllocation: { meta: 0.50, google: 0.40, tiktok: 0.05, linkedin: 0.05 },
    description: "Ukjent bransje — bruker generisk SMB-baseline",
  },
};

const GOAL_MODIFIERS: Record<AdsGoal, number> = {
  brand_awareness: 0.8,
  engagement: 0.9,
  lead_generation: 1.0,
  ecommerce_conversion: 1.2,
  retargeting: 0.6,
};

const GROWTH_PHASE_MODIFIERS: Record<GrowthPhase, number> = {
  launch: 1.3,
  growth: 1.3,
  established: 1.0,
  maintenance: 0.7,
};

// ─────────────────────────────────────────────────────────
// Budget-recommendation engine
// ─────────────────────────────────────────────────────────

export interface BudgetRecommendationInput {
  industryCategory: IndustryCategory;
  monthlyRevenueNok: number;
  goal?: AdsGoal;
  growthPhase?: GrowthPhase;
}

export interface BudgetRecommendationOutput {
  totalRecommendedNok: number;
  rangeLowNok: number;
  rangeHighNok: number;
  perPlatform: Record<AdsPlatform, number>;
  managementFeeNok: number;
  managementFeeInclVatNok: number;
  rationale: {
    industry: string;
    marketingShareUsed: number;
    digitalAdsShareUsed: number;
    goalModifier: number;
    growthModifier: number;
    formula: string;
  };
}

export const MANAGEMENT_FEE_RATE = 0.15;
export const VAT_RATE = 0.25;

function midpoint(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

export function recommendAdsBudget(
  input: BudgetRecommendationInput,
): BudgetRecommendationOutput {
  const factors = INDUSTRY_FACTORS[input.industryCategory] ?? INDUSTRY_FACTORS.other;
  const goal = input.goal ?? "lead_generation";
  const growthPhase = input.growthPhase ?? "established";

  const marketingShare = midpoint(factors.marketingShareOfRevenue);
  const digitalShare = midpoint(factors.digitalAdsShareOfMarketing);
  const goalMod = GOAL_MODIFIERS[goal];
  const growthMod = GROWTH_PHASE_MODIFIERS[growthPhase];

  const total =
    Math.max(0, input.monthlyRevenueNok) *
    marketingShare *
    digitalShare *
    goalMod *
    growthMod;

  const lowTotal =
    Math.max(0, input.monthlyRevenueNok) *
    factors.marketingShareOfRevenue[0] *
    factors.digitalAdsShareOfMarketing[0] *
    goalMod *
    growthMod;

  const highTotal =
    Math.max(0, input.monthlyRevenueNok) *
    factors.marketingShareOfRevenue[1] *
    factors.digitalAdsShareOfMarketing[1] *
    goalMod *
    growthMod;

  const perPlatform: Record<AdsPlatform, number> = {
    meta: total * factors.platformAllocation.meta,
    google: total * factors.platformAllocation.google,
    tiktok: total * factors.platformAllocation.tiktok,
    linkedin: total * factors.platformAllocation.linkedin,
  };

  const managementFee = total * MANAGEMENT_FEE_RATE;
  const managementFeeInclVat = managementFee * (1 + VAT_RATE);

  return {
    totalRecommendedNok: round2(total),
    rangeLowNok: round2(lowTotal),
    rangeHighNok: round2(highTotal),
    perPlatform: {
      meta: round2(perPlatform.meta),
      google: round2(perPlatform.google),
      tiktok: round2(perPlatform.tiktok),
      linkedin: round2(perPlatform.linkedin),
    },
    managementFeeNok: round2(managementFee),
    managementFeeInclVatNok: round2(managementFeeInclVat),
    rationale: {
      industry: factors.description,
      marketingShareUsed: marketingShare,
      digitalAdsShareUsed: digitalShare,
      goalModifier: goalMod,
      growthModifier: growthMod,
      formula:
        "revenue × marketingShare × digitalAdsShare × goalModifier × growthModifier",
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────
// Management-fee math + Stripe meter-event names
// ─────────────────────────────────────────────────────────

export const ADS_METER_EVENT_NAMES: Record<AdsPlatform, string> = {
  meta: "roleroom_ads_meta_spend_nok",
  google: "roleroom_ads_google_spend_nok",
  tiktok: "roleroom_ads_tiktok_spend_nok",
  linkedin: "roleroom_ads_linkedin_spend_nok",
};

export interface ManagementFeeBreakdown {
  spendNok: number;
  managementFeeNok: number;
  vatNok: number;
  totalInclVatNok: number;
}

export function computeManagementFee(spendNok: number): ManagementFeeBreakdown {
  const fee = spendNok * MANAGEMENT_FEE_RATE;
  const vat = fee * VAT_RATE;
  return {
    spendNok: round2(spendNok),
    managementFeeNok: round2(fee),
    vatNok: round2(vat),
    totalInclVatNok: round2(fee + vat),
  };
}

export function billingPeriodForDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
