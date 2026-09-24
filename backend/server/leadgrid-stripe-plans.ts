/**
 * Leadgrid-planene og deres Stripe-priser — ett sted.
 *
 * Pris-IDene lå spredt som innebygde standardverdier i rutefilene, med
 * env-overstyring som ingen kunne se om var i bruk. Konsekvensen var at
 * ingen visste om Render faktisk hadde satt dem, eller om vi stille brukte
 * fjorårets pris fordi variabelen manglet. Her står katalogen, og
 * `resolvePlanPrice` sier ALLTID hvor verdien kom fra.
 *
 * Nøkkelen `solo_pro` er den samme som ligger i `plan_key` på Stripe-objektene
 * og i `organizations.plan`. Prissiden kaller den «pro» — kartleggingen ligger
 * i PLAN_ALIASES, ikke i hodet til den som leser koden.
 *
 * Beløpene står IKKE her. Stripe eier dem. `verifyStripePrices` leser dem
 * tilbake og sier hva som faktisk vil bli fakturert.
 */
import type Stripe from "stripe";

export type BillingInterval = "month" | "year";
export type PlanKey = "solo_pro" | "agency";

export interface PlanDefinition {
  key: PlanKey;
  label: string;
  /** Navnet kunden ser på prissiden. */
  publicKey: string;
  env: Record<BillingInterval, string>;
  /** Live-prisene per 2026-07-17. Brukes bare når env mangler. */
  fallback: Record<BillingInterval, string>;
}

export const LEADGRID_PLANS: Record<PlanKey, PlanDefinition> = {
  solo_pro: {
    key: "solo_pro",
    label: "Solo Pro",
    publicKey: "pro",
    env: { month: "LEADGRID_PRICE_SOLO_MONTH", year: "LEADGRID_PRICE_SOLO_YEAR" },
    fallback: {
      month: "price_1TjcdoApjenweKvPYAngQd59",
      year: "price_1TjcdpApjenweKvPQa3SL4lq",
    },
  },
  agency: {
    key: "agency",
    label: "Agency",
    publicKey: "agency",
    env: { month: "LEADGRID_PRICE_AGENCY_MONTH", year: "LEADGRID_PRICE_AGENCY_YEAR" },
    fallback: {
      month: "price_1TjcdqApjenweKvPvLZZ220h",
      year: "price_1TjcdqApjenweKvPJeskBX00",
    },
  },
};

/** Prissidens nøkler → billing-nøkler. «pro» og «solo_pro» er samme plan. */
export const PLAN_ALIASES: Record<string, PlanKey> = {
  pro: "solo_pro",
  solo_pro: "solo_pro",
  solo: "solo_pro",
  agency: "agency",
};

export function normalizePlanKey(value: unknown): PlanKey | null {
  const nøkkel = String(value ?? "").trim().toLowerCase();
  return PLAN_ALIASES[nøkkel] ?? null;
}

export function normalizeInterval(value: unknown): BillingInterval {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "year" || v === "yearly" || v === "år" ? "year" : "month";
}

export interface ResolvedPrice {
  planKey: PlanKey;
  interval: BillingInterval;
  priceId: string;
  /** «env» = satt i Render. «fallback» = innebygd verdi, og verdt å vite om. */
  source: "env" | "fallback";
  envName: string;
}

export function resolvePlanPrice(
  planKey: PlanKey,
  interval: BillingInterval,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedPrice {
  const plan = LEADGRID_PLANS[planKey];
  const envName = plan.env[interval];
  const fraEnv = (env[envName] ?? "").trim();
  return {
    planKey,
    interval,
    priceId: fraEnv || plan.fallback[interval],
    source: fraEnv ? "env" : "fallback",
    envName,
  };
}

/** Tilleggene som ikke er planer, men som også faktureres. */
export const LEADGRID_ADDONS = {
  ai_structure: {
    label: "AI-strukturering (per kall)",
    env: "LEADGRID_PRICE_AI_STRUCTURE",
    fallback: "",
  },
  storage_100gib: {
    label: "Lagring, 100 GiB",
    env: "LEADGRID_PRICE_STORAGE_100_GIB",
    fallback: "",
  },
} as const;

export interface PriceCheck {
  label: string;
  planKey: PlanKey | null;
  interval: BillingInterval | null;
  envName: string;
  price_id: string | null;
  source: "env" | "fallback" | "mangler";
  /** Hva Stripe faktisk sier om denne prisen. Null når den ikke ble slått opp. */
  stripe: {
    active: boolean;
    currency: string;
    unit_amount: number | null;
    recurring_interval: string | null;
    product_name: string | null;
  } | null;
  /** Tom liste betyr at denne linjen er riktig. */
  problems: string[];
}

/**
 * Leser prisene tilbake fra Stripe og sier hva som faktisk vil bli fakturert.
 *
 * Dette er forskjellen på «variabelen er satt» og «variabelen er riktig». En
 * pris-ID kan peke på en deaktivert pris, feil valuta, eller et månedsbeløp
 * der vi tror vi selger et år — alt sammen ting du bare ser ved å spørre
 * Stripe.
 */
export async function verifyStripePrices(
  stripe: Stripe | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; checks: PriceCheck[]; stripe_available: boolean }> {
  const linjer: Array<Omit<PriceCheck, "stripe" | "problems">> = [];

  for (const plan of Object.values(LEADGRID_PLANS)) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      const løst = resolvePlanPrice(plan.key, interval, env);
      linjer.push({
        label: `${plan.label} · ${interval === "year" ? "årlig" : "månedlig"}`,
        planKey: plan.key,
        interval,
        envName: løst.envName,
        price_id: løst.priceId || null,
        source: løst.priceId ? løst.source : "mangler",
      });
    }
  }
  for (const tillegg of Object.values(LEADGRID_ADDONS)) {
    const fraEnv = (env[tillegg.env] ?? "").trim();
    linjer.push({
      label: tillegg.label,
      planKey: null,
      interval: null,
      envName: tillegg.env,
      price_id: fraEnv || tillegg.fallback || null,
      source: fraEnv ? "env" : tillegg.fallback ? "fallback" : "mangler",
    });
  }

  const checks: PriceCheck[] = [];
  for (const linje of linjer) {
    const problems: string[] = [];
    if (!linje.price_id) {
      problems.push(`${linje.envName} er ikke satt i Render.`);
      checks.push({ ...linje, stripe: null, problems });
      continue;
    }
    if (linje.source === "fallback") {
      problems.push(
        `${linje.envName} er ikke satt i Render — bruker innebygd verdi. ` +
        "Endres prisen i Stripe uten at variabelen settes, fakturerer vi feil.",
      );
    }
    if (!stripe) {
      checks.push({ ...linje, stripe: null, problems });
      continue;
    }
    try {
      const pris = await stripe.prices.retrieve(linje.price_id, { expand: ["product"] });
      const produkt = pris.product;
      const produktNavn =
        produkt && typeof produkt === "object" && "name" in produkt
          ? String(produkt.name)
          : null;
      if (!pris.active) problems.push("Prisen er deaktivert i Stripe.");
      if (pris.currency?.toLowerCase() !== "nok") {
        problems.push(`Valutaen er ${pris.currency?.toUpperCase()}, ikke NOK.`);
      }
      if (linje.interval && pris.recurring?.interval !== linje.interval) {
        problems.push(
          `Stripe sier ${pris.recurring?.interval ?? "engangsbeløp"}, ` +
          `vi selger den som ${linje.interval === "year" ? "årlig" : "månedlig"}.`,
        );
      }
      checks.push({
        ...linje,
        stripe: {
          active: pris.active,
          currency: pris.currency,
          unit_amount: pris.unit_amount,
          recurring_interval: pris.recurring?.interval ?? null,
          product_name: produktNavn,
        },
        problems,
      });
    } catch (error) {
      problems.push(`Stripe fant ikke prisen: ${(error as Error).message}`);
      checks.push({ ...linje, stripe: null, problems });
    }
  }

  return {
    ok: checks.every((c) => c.problems.length === 0),
    checks,
    stripe_available: Boolean(stripe),
  };
}
