/**
 * score-model.ts — fase 3: konfigurerbare faktormodeller
 * (docs/integration-audit/11)
 *
 * En score-modell er en GJENNOMSIKTIG formel: navngitte faktorer (0–1) ×
 * vekter → 0–100. Ingen LLM-frihånd — hver poengsum kan dekomponeres til
 * faktorbidrag med evidens.
 *
 * Redelighet (No Fake Scores):
 *  - Manglende faktor = null med begrunnelse — ALDRI stille default til 0
 *    eller 0.5. Vekten omfordeles til faktorene som HAR data, og
 *    `coverage` (vektandel med data) vises alltid sammen med scoren.
 *  - Vektene er Daniels produktbeslutning: modellen leveres med
 *    FORSLAGS-vekter og `approved=false` til han lagrer sine egne.
 *  - Kalibrering (fase 4): Leadgrid won/lost blir fasit som justerer
 *    vektene mot virkeligheten.
 */

import { z } from "zod";

export interface ScoreEvidenceRef {
  ref: string;
  label: string;
  value: string | number;
}

export interface FactorDefinition {
  key: string;
  label: string;
  /** Hva faktoren måler, retning og datakilde — vises i UI. */
  description: string;
  /** Startforslag — gjelder til Daniel lagrer egne vekter. */
  proposedWeight: number;
}

export interface FactorValue {
  key: string;
  /** Normalisert 0–1 (1 = taler for høy prioritet); null = mangler data. */
  value: number | null;
  missingReason?: string;
  evidence: ScoreEvidenceRef[];
}

export interface FactorContribution {
  key: string;
  weight: number;
  /** Vekt etter omfordeling blant faktorer med data (0 hvis mangler). */
  normalizedWeight: number;
  value: number | null;
  /** Poeng av totalscoren (0–100-skala). */
  points: number | null;
}

export interface ComputedScore {
  /** 0–100; null når INGEN faktor har data. */
  score: number | null;
  /** Andel av total vekt som har data (0–1) — scorens dekning. */
  coverage: number;
  contributions: FactorContribution[];
}

/**
 * Vektet sum med eksplisitt omfordeling: kun faktorer med data deltar,
 * og vektene deres skaleres opp så de summerer til 1. Dekning rapporteres
 * separat — en score på 80 med 40 % dekning skal LESES som usikker.
 */
export function computeScore(
  factors: FactorValue[],
  weights: Record<string, number>,
): ComputedScore {
  const entries = factors.map((f) => ({ factor: f, weight: Math.max(0, weights[f.key] ?? 0) }));
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  const availableWeight = entries.reduce(
    (s, e) => s + (e.factor.value !== null ? e.weight : 0),
    0,
  );
  if (totalWeight === 0 || availableWeight === 0) {
    return {
      score: null,
      coverage: 0,
      contributions: entries.map((e) => ({
        key: e.factor.key,
        weight: e.weight,
        normalizedWeight: 0,
        value: e.factor.value,
        points: null,
      })),
    };
  }

  const contributions: FactorContribution[] = entries.map((e) => {
    if (e.factor.value === null) {
      return { key: e.factor.key, weight: e.weight, normalizedWeight: 0, value: null, points: null };
    }
    const normalizedWeight = e.weight / availableWeight;
    const clamped = Math.min(1, Math.max(0, e.factor.value));
    return {
      key: e.factor.key,
      weight: e.weight,
      normalizedWeight: Math.round(normalizedWeight * 1000) / 1000,
      value: clamped,
      points: Math.round(clamped * normalizedWeight * 1000) / 10,
    };
  });

  const score = Math.round(
    contributions.reduce((s, c) => s + (c.points ?? 0), 0),
  );
  return {
    score: Math.min(100, Math.max(0, score)),
    coverage: Math.round((availableWeight / totalWeight) * 100) / 100,
    contributions,
  };
}

// ─────────────────────────────────────────────────────────────────────
// GEO Opportunity Score — modell-definisjonen (faktorer i kode,
// vekter/kommersiell verdi konfigurerbart per org)
// ─────────────────────────────────────────────────────────────────────

export const GEO_OPPORTUNITY_MODEL_KEY = "geo-opportunity";

/**
 * FORSLAGS-vekter (summerer til 100). Begrunnelsen står per faktor —
 * dette er startpunktet Daniel redigerer, ikke en fasit.
 */
export const GEO_OPPORTUNITY_FACTORS: FactorDefinition[] = [
  {
    key: "gap",
    label: "Tomrom",
    description:
      "Andel AI-svar i temaet der målmerket IKKE nevnes (siste måling). 1 = helt usynlig der det spørres — størst rom å ta.",
    proposedWeight: 25,
  },
  {
    key: "openness",
    label: "Åpenhet",
    description:
      "1 minus sterkeste konkurrents andel av svarene i temaet. Lav verdi = én aktør eier kategorien (Spotlight i casting); høy = ingen har satt seg.",
    proposedWeight: 15,
  },
  {
    key: "demand",
    label: "Etterspørsel",
    description:
      "Dokumentert søkevolum (Keyword Planner/Trends-import) koblet til temaet via ord-overlapp. Mangler kobling = null, aldri gjettet.",
    proposedWeight: 20,
  },
  {
    key: "momentum",
    label: "Momentum",
    description:
      "Endring i samtale-volum (omtaler av alle merker i temaet) mellom de to siste målingene. Krever to målinger.",
    proposedWeight: 10,
  },
  {
    key: "traffic_proof",
    label: "Trafikk-bevis",
    description:
      "Ekte GA4/GSC-signaler (AI-referrals, visninger) på temaer som ligner — beviser at innhold i feltet faktisk gir besøk.",
    proposedWeight: 10,
  },
  {
    key: "commercial_value",
    label: "Kommersiell verdi",
    description:
      "Din vurdering (1–10) av hva en kunde fra dette prompt-settet er verdt. Kan ikke beregnes fra data — settes i konfigurasjonen.",
    proposedWeight: 20,
  },
];

export const GEO_OPPORTUNITY_PROPOSED_WEIGHTS: Record<string, number> =
  Object.fromEntries(GEO_OPPORTUNITY_FACTORS.map((f) => [f.key, f.proposedWeight]));

const factorKeys = GEO_OPPORTUNITY_FACTORS.map((f) => f.key) as [string, ...string[]];

/** PATCH-payload: kun kjente faktorer, vekter 0–100, verdier 1–10. */
export const geoOpportunityConfigSchema = z
  .object({
    weights: z
      .record(z.enum(factorKeys), z.number().min(0).max(100))
      .refine(
        (w) => Object.values(w).reduce((s, v) => s + v, 0) > 0,
        "minst én vekt må være > 0",
      ),
    commercialValues: z.record(z.string().uuid(), z.number().min(1).max(10)),
  })
  .strict();

export type GeoOpportunityConfig = z.infer<typeof geoOpportunityConfigSchema>;

export function defaultGeoOpportunityConfig(): GeoOpportunityConfig {
  return { weights: { ...GEO_OPPORTUNITY_PROPOSED_WEIGHTS }, commercialValues: {} };
}

// ─────────────────────────────────────────────────────────────────────
// Tema-kobling: deterministisk ord-overlapp (ingen LLM-gjetting)
// ─────────────────────────────────────────────────────────────────────

const TOPIC_STOPWORDS = new Set([
  "og", "for", "med", "til", "som", "the", "and", "hvordan", "hva", "beste",
]);

export function topicTokens(topic: string): Set<string> {
  return new Set(
    topic
      .toLowerCase()
      .split(/[^a-z0-9æøå]+/)
      .filter((t) => t.length >= 3 && !TOPIC_STOPWORDS.has(t)),
  );
}

/** To temaer «matcher» når de deler minst ett ikke-trivielt ord. */
export function topicsOverlap(a: string, b: string): boolean {
  const ta = topicTokens(a);
  if (ta.size === 0) return false;
  for (const t of topicTokens(b)) if (ta.has(t)) return true;
  return false;
}

/** Log-skala-normalisering for volumtall (100 → ~0.33, 10k → ~0.67, 1M → 1). */
export function normalizeVolume(volume: number): number {
  if (volume <= 0) return 0;
  return Math.min(1, Math.log10(volume + 1) / 6);
}

/** Prosentendring → 0–1 rundt 0.5 (uendret); ±100 % dekker hele skalaen. */
export function normalizeMomentum(pctChange: number): number {
  return Math.min(1, Math.max(0, 0.5 + pctChange / 200));
}
