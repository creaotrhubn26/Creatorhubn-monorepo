// ai-plan-budgets.ts
// Sentral konfigurasjon for "soft-cap + overage"-modellen på CreatorHub-plattformen.
// Definerer inkludert AI-budsjett per plan (målt som underliggende leverandørkost i NOK)
// og markup på overskridelse. Alle verdier kan overstyres via miljøvariabler slik at
// tallene kan justeres uten ny deploy.
//
// Merk: "budsjett" her = hvor mye AI-LEVERANDØRKOST (Claude o.l.) som er inkludert i
// planprisen. Kunden ser aldri dette som et tak — over budsjettet faktureres overskridelse
// metered (Fase C), kunden blir ALDRI blokkert.

/** Kanoniske plattform-plan-id-er (jf. buildCompatPlatformSubscriptionPlans i index.ts). */
export type PlatformPlanId = "basic" | "professional" | "premium" | "enterprise";

/** Standard inkludert AI-budsjett per plan, i NOK leverandørkost per måned. */
const DEFAULT_INCLUDED_BUDGET_NOK: Record<PlatformPlanId, number> = {
  basic: 30,
  professional: 75,
  premium: 210,
  enterprise: 840,
};

const DEFAULT_OVERAGE_MARKUP = 1.4;

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Inkludert AI-budsjett (NOK leverandørkost/mnd) for en plan.
 * Env-overstyring: AI_INCLUDED_BUDGET_NOK_<PLAN> (f.eks. AI_INCLUDED_BUDGET_NOK_ENTERPRISE=1000).
 * Ukjent/uoppløst plan → 0 inkludert (all bruk regnes som overskridelse, men flagges i tjenesten).
 */
export function includedAiBudgetNok(planId: string | null | undefined): number {
  const key = normalizePlanId(planId);
  if (!key) return envNumber("AI_INCLUDED_BUDGET_NOK_DEFAULT", 0);
  return envNumber(
    `AI_INCLUDED_BUDGET_NOK_${key.toUpperCase()}`,
    DEFAULT_INCLUDED_BUDGET_NOK[key],
  );
}

/** Markup som ganges på rå overskridelse (leverandørkost) for å få fakturabeløp. */
export function overageMarkup(): number {
  return envNumber("AI_OVERAGE_MARKUP", DEFAULT_OVERAGE_MARKUP);
}

/** Normaliser en fri plan-streng til en kanonisk PlatformPlanId, eller null. */
export function normalizePlanId(planId: string | null | undefined): PlatformPlanId | null {
  if (!planId) return null;
  const p = planId.toLowerCase();
  if (p.includes("enterprise")) return "enterprise";
  if (p.includes("premium")) return "premium";
  if (p.includes("professional") || p.includes("pro")) return "professional";
  if (p.includes("basic") || p.includes("starter")) return "basic";
  return null;
}

/** Snapshot av gjeldende konfig — nyttig for admin-innsyn / debugging. */
export function aiBudgetConfigSnapshot() {
  const plans: PlatformPlanId[] = ["basic", "professional", "premium", "enterprise"];
  return {
    includedBudgetNok: Object.fromEntries(
      plans.map((p) => [p, includedAiBudgetNok(p)]),
    ) as Record<PlatformPlanId, number>,
    overageMarkup: overageMarkup(),
  };
}
