/**
 * leadgrid-industry-classify.ts
 *
 * Klassifiserer en lead-rad mot `industries`-katalogen (mig 329).
 *
 * Strategi:
 *   1. Hvis Brreg har en NACE-kode (`naceCode` på industryCode-objektet),
 *      forsøk eksakt match på `industries.code = 'NACE.' + naceCode`.
 *      F.eks. Brreg '47.11' → 'NACE.G.47.11' eller 'NACE.47.11'. Vi
 *      søker først på full sti, deretter på siste 2-siffer-segment
 *      (siden seksjons-bokstaven (A-U) ofte mangler i Brreg-payload).
 *   2. Hvis ingen Brreg-treff, fallback til tekst-match mot
 *      companyProfile.industry/summary via pg_trgm similarity. Vi
 *      henter top-1 over en threshold (0.5) for å unngå støy.
 *   3. Returnerer { industryId, source } — caller bestemmer om det skal
 *      persisteres.
 *
 * Designvalg: Vi bruker IKKE Claude direkte her for å holde dette stille
 * og deterministisk. URL Research-pipelinen kjører Claude-synthesis før
 * dette steget, og synthesis.companyProfile.industry er allerede en
 * Claude-utledet streng. Trigram-match på den er presist nok for
 * top-nivå NACE-divisjoner.
 *
 * Hvis vi senere vil ha LLM-fallback: legg til en `claudeClassifier`-
 * parameter som tar candidates (industries) + tekst og returnerer
 * { industryId | null }.
 */

import type { Pool } from "pg";

export type IndustryClassificationSource =
  | "nace_full"
  | "nace_short"
  | "trigram"
  | null;

export interface IndustryClassification {
  industryId: string | null;
  source: IndustryClassificationSource;
  matchedIndustryCode?: string;
  matchedIndustryName?: string;
}

const TRIGRAM_THRESHOLD = 0.5;

export async function classifyIndustryForLead(
  pool: Pool,
  input: {
    naceCode?: string | null;       // f.eks. "47.11" fra Brreg
    naceDescription?: string | null;
    companyIndustryText?: string | null;  // companyProfile.industry
    companySummary?: string | null;       // companyProfile.summary
  },
): Promise<IndustryClassification> {
  // 1. NACE-direkte match
  if (input.naceCode && typeof input.naceCode === "string") {
    const code = input.naceCode.trim();
    if (code.length > 0) {
      // Full sti: 'NACE.X.YY.ZZ' kan vi ikke vite uten å kjenne seksjonen.
      // Prøv: 'NACE.' + code først, deretter wildcard på siste-segment.
      const directCandidates = [
        `NACE.${code}`,
        // Hvis code allerede har NACE-prefiks
        code.startsWith("NACE.") ? code : `NACE.${code}`,
      ];
      const direct = await pool.query<{ id: string; code: string; name_no: string }>(
        `SELECT id::text, code, name_no
           FROM industries
          WHERE is_active = TRUE
            AND code = ANY($1::text[])
          LIMIT 1`,
        [directCandidates],
      );
      if (direct.rows[0]) {
        return {
          industryId: direct.rows[0].id,
          source: "nace_full",
          matchedIndustryCode: direct.rows[0].code,
          matchedIndustryName: direct.rows[0].name_no,
        };
      }
      // Fallback: wildcard på siste segment. Hvis Brreg gir '47.11' og
      // vi har 'NACE.G.47.11' i DB, finn den med suffix-match.
      const suffix = await pool.query<{ id: string; code: string; name_no: string }>(
        `SELECT id::text, code, name_no
           FROM industries
          WHERE is_active = TRUE
            AND scope = 'global'
            AND (code LIKE $1 OR code LIKE $2)
          ORDER BY LENGTH(code) DESC
          LIMIT 1`,
        [`%.${code}`, `NACE.%.${code}`],
      );
      if (suffix.rows[0]) {
        return {
          industryId: suffix.rows[0].id,
          source: "nace_short",
          matchedIndustryCode: suffix.rows[0].code,
          matchedIndustryName: suffix.rows[0].name_no,
        };
      }
    }
  }

  // 2. Trigram-match på companyProfile.industry / nace-description / summary.
  const candidates = [
    input.companyIndustryText,
    input.naceDescription,
    input.companySummary,
  ]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 2)
    .map((s) => s.trim().slice(0, 200));

  for (const text of candidates) {
    const r = await pool.query<{ id: string; code: string; name_no: string; sim: number }>(
      `SELECT id::text, code, name_no,
              similarity(LOWER(name_no), LOWER($1)) AS sim
         FROM industries
        WHERE is_active = TRUE
          AND LOWER(name_no) % LOWER($1)
        ORDER BY sim DESC
        LIMIT 1`,
      [text],
    );
    if (r.rows[0] && r.rows[0].sim >= TRIGRAM_THRESHOLD) {
      return {
        industryId: r.rows[0].id,
        source: "trigram",
        matchedIndustryCode: r.rows[0].code,
        matchedIndustryName: r.rows[0].name_no,
      };
    }
  }

  return { industryId: null, source: null };
}

/** Re-export for unit-test. */
export const __test = {
  classifyIndustryForLead,
};
