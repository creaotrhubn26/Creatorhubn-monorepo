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

// =====================================================================
// Fix 4 — Industry auto-assignment fra discovery_query
// =====================================================================
//
// Når discovery-flyten kaller "fotograf i Oslo", vet vi bransje FØR
// Brreg-oppslaget. Vi setter industry_id på leadet med en gang så UI/
// filter / cross-prosjekt-rapporter har riktig data uten å vente på
// orchestrator-pipelinen.
//
// Mapping bygges via:
//   1. Eksakt match på vanlige norske bransje-keywords (statisk map under)
//   2. Trigram-match mot industries.name_no hvis keyword ikke matcher
//
// Returnerer industryId | null. Caller setter den på crm_customers.

/** Statisk keyword → industries.code-match for vanlige bransjer.
 *  Bruk eksakt SUBSTRING-match på discovery_query (case-insensitive).
 *  NB: kodene er "best guess" — vi gjør lookup mot DB.code i SQL-en. */
const QUERY_TO_INDUSTRY_KEYWORDS: Array<{
  keywords: string[];
  candidateCodes: string[];
  candidateNameNo: string[]; // fallback for trigram-lookup
}> = [
  {
    keywords: ["fotograf", "bryllupsfotograf"],
    candidateCodes: ["CUSTOM.WEDDING_PHOTOGRAPHER", "NACE.M.74.20"],
    candidateNameNo: ["Fotograftjenester", "Fotografering"],
  },
  {
    keywords: ["videograf", "videoproduksjon", "bryllupsvideo"],
    candidateCodes: ["CUSTOM.WEDDING_VIDEO", "NACE.J.59.11"],
    candidateNameNo: ["Filmproduksjon", "Videoproduksjon"],
  },
  {
    keywords: ["restaurant", "spisested"],
    candidateCodes: ["NACE.I.56.10", "NACE.56.10"],
    candidateNameNo: ["Restaurantvirksomhet"],
  },
  {
    keywords: ["kafé", "kafe", "cafe", "kaffebar"],
    candidateCodes: ["NACE.I.56.30", "NACE.56.30"],
    candidateNameNo: ["Drift av barer", "Kafé"],
  },
  {
    keywords: ["tannlege"],
    candidateCodes: ["NACE.Q.86.23", "NACE.86.23"],
    candidateNameNo: ["Tannhelsetjenester"],
  },
  {
    keywords: ["frisør", "frisor"],
    candidateCodes: ["NACE.S.96.02", "NACE.96.02"],
    candidateNameNo: ["Frisering"],
  },
  {
    keywords: ["regnskap", "regnskapsbyrå", "regnskapsforer"],
    candidateCodes: ["NACE.M.69.20", "NACE.69.20"],
    candidateNameNo: ["Regnskap", "Bokføring"],
  },
  {
    keywords: ["advokat", "jurist", "juridisk"],
    candidateCodes: ["NACE.M.69.10", "NACE.69.10"],
    candidateNameNo: ["Juridisk tjenesteyting"],
  },
  {
    keywords: ["bilverksted", "verksted"],
    candidateCodes: ["NACE.G.45.20", "NACE.45.20"],
    candidateNameNo: ["Vedlikehold og reparasjon"],
  },
  {
    keywords: ["bryllupslokale", "wedding venue", "festsal"],
    candidateCodes: ["CUSTOM.WEDDING_VENUE", "NACE.N.82.30"],
    candidateNameNo: ["Bryllup", "Selskapslokale"],
  },
  {
    keywords: ["blomsterbutikk", "florist"],
    candidateCodes: ["NACE.G.47.76", "NACE.47.76"],
    candidateNameNo: ["Blomster"],
  },
  {
    keywords: ["bakeri"],
    candidateCodes: ["NACE.C.10.71", "NACE.10.71"],
    candidateNameNo: ["Bakeri"],
  },
  {
    keywords: ["catering"],
    candidateCodes: ["NACE.I.56.21", "NACE.56.21"],
    candidateNameNo: ["Catering"],
  },
  {
    keywords: ["DJ", "musiker", "band"],
    candidateCodes: ["CUSTOM.WEDDING_DJ", "NACE.R.90.01"],
    candidateNameNo: ["Utøvende kunst"],
  },
];

export interface IndustryAutoAssignment {
  industryId: string;
  source: "keyword" | "nace_direct" | "trigram";
  matchedCode: string;
  matchedName: string;
}

/**
 * autoAssignIndustryFromDiscoveryQuery — finn industry_id basert på
 * brukerens discovery-query (f.eks. "fotograf i Oslo") + valgfri
 * Brreg NACE-kode.
 *
 * Strategi:
 *   1. Hvis brregNaceCode er satt: bruk classifyIndustryForLead direkte
 *      (eksisterende sti via NACE-direkte match).
 *   2. Hvis ikke: keyword-match mot QUERY_TO_INDUSTRY_KEYWORDS,
 *      slå opp candidateCodes i industries-tabellen, returner første treff.
 *   3. Hvis ingen kandidat-kode finnes: trigram-match mot candidateNameNo.
 *   4. Hvis fortsatt ingen: return null.
 *
 * Brukes av discovery-flyten FØR research-pipelinen så leads får
 * industry_id med en gang og UI-filter virker uten å vente.
 */
export async function autoAssignIndustryFromDiscoveryQuery(
  pool: Pool,
  opts: {
    discoveryQuery: string;
    brregNaceCode?: string | null;
  },
): Promise<IndustryAutoAssignment | null> {
  // 1. NACE-direkte hvis vi har den (sjelden ved discovery — Brreg
  //    kommer først etter research-pipelinen kjører — men støttet)
  if (opts.brregNaceCode) {
    const cls = await classifyIndustryForLead(pool, {
      naceCode: opts.brregNaceCode,
    });
    if (cls.industryId) {
      return {
        industryId: cls.industryId,
        source: "nace_direct",
        matchedCode: cls.matchedIndustryCode ?? "",
        matchedName: cls.matchedIndustryName ?? "",
      };
    }
  }

  // 2. Keyword-match
  const lowerQuery = opts.discoveryQuery.toLowerCase();
  for (const entry of QUERY_TO_INDUSTRY_KEYWORDS) {
    const matched = entry.keywords.some((kw) =>
      lowerQuery.includes(kw.toLowerCase()),
    );
    if (!matched) continue;

    // Slå opp candidateCodes mot industries-tabellen
    try {
      const r = await pool.query<{ id: string; code: string; name_no: string }>(
        `SELECT id::text, code, name_no
           FROM industries
          WHERE is_active = TRUE
            AND code = ANY($1::text[])
          ORDER BY array_position($1::text[], code)
          LIMIT 1`,
        [entry.candidateCodes],
      );
      if (r.rows[0]) {
        return {
          industryId: r.rows[0].id,
          source: "keyword",
          matchedCode: r.rows[0].code,
          matchedName: r.rows[0].name_no,
        };
      }
    } catch {
      // industries-tabellen kan mangle i veldig gamle miljøer
    }

    // 3. Trigram-fallback på candidateNameNo
    for (const name of entry.candidateNameNo) {
      try {
        const r = await pool.query<{ id: string; code: string; name_no: string; sim: number }>(
          `SELECT id::text, code, name_no,
                  similarity(LOWER(name_no), LOWER($1)) AS sim
             FROM industries
            WHERE is_active = TRUE
              AND LOWER(name_no) % LOWER($1)
            ORDER BY sim DESC
            LIMIT 1`,
          [name],
        );
        if (r.rows[0] && r.rows[0].sim >= TRIGRAM_THRESHOLD) {
          return {
            industryId: r.rows[0].id,
            source: "trigram",
            matchedCode: r.rows[0].code,
            matchedName: r.rows[0].name_no,
          };
        }
      } catch {
        // pg_trgm kanskje ikke installert — degrader stille
      }
    }
  }

  return null;
}

/** Re-export for unit-test. */
export const __test = {
  classifyIndustryForLead,
  autoAssignIndustryFromDiscoveryQuery,
  QUERY_TO_INDUSTRY_KEYWORDS,
};
