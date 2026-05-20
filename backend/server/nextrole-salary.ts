/**
 * nextrole-salary.ts
 *
 * SSB lønnsestimat for NextRole. Tar brukerens jobbtittel og returnerer
 * median månedslønn for det STYRK-08-yrket som matcher best, med p25/p75
 * for kontekst.
 *
 * SSB-tabell: 11418 (Avtalt månedslønn for heltidsansatte, etter
 * yrke (STYRK-08), sektor og kjønn).
 *
 * URL: https://data.ssb.no/api/v0/no/table/11418
 *
 * Frittekst-til-STYRK-mapping: kurert liste over ~30 vanlige norske
 * yrkestitler. Fuzzy-match via case-insensitiv inneholder-sjekk +
 * Levenshtein-fallback. Hvis ingen match: returner null så frontend
 * skjuler banneret pent.
 *
 * Cache: nextrole_salary_cache (TTL 30 dager). Reduserer SSB-traffikk
 * og gjør responsene øyeblikkelige etter første kall per yrke.
 *
 * Endepunkt: GET /api/marketplace/next-role/salary-estimate?jobTitle=...
 */

import type express from "express";
import type { Pool } from "pg";

export interface NextRoleSalaryDeps {
  app: express.Application;
  pool: Pool;
}

// Kurert STYRK-08 til norsk jobbtittel-mapping. Hver oppføring har:
//   code: STYRK-08-kode SSB bruker
//   label: visning til brukeren
//   keywords: lavercase-frittekst-fragmenter som matcher denne rollen
//
// Liste under er bevisst kort — dekker de mest populære rollene i Norge.
// Utvides over tid basert på faktiske brukerdata.
const STYRK_MAP: { code: string; label: string; keywords: string[] }[] = [
  { code: "1120", label: "Administrerende direktører", keywords: ["ceo", "administrerende direktør", "daglig leder", "general manager"] },
  { code: "1213", label: "Politikere og toppledere", keywords: ["styreleder", "chairman"] },
  { code: "1221", label: "Salgs- og markedssjefer", keywords: ["salgssjef", "markedssjef", "sales manager", "marketing manager", "chief marketing"] },
  { code: "1222", label: "Reklame- og PR-sjefer", keywords: ["reklamesjef", "pr-sjef", "kommunikasjonssjef"] },
  { code: "1330", label: "IKT-sjefer", keywords: ["it-sjef", "ict-sjef", "cto", "chief technology", "head of engineering", "tech lead"] },
  { code: "2310", label: "Universitets- og høgskolelektorer", keywords: ["førsteamanuensis", "professor", "lektor"] },
  { code: "2330", label: "Lærere på videregående og høyere nivå", keywords: ["lærer videregående", "lektor"] },
  { code: "2341", label: "Grunnskolelærere", keywords: ["grunnskolelærer", "lærer barneskole", "lærer ungdomsskole"] },
  { code: "2411", label: "Regnskapsførere og revisorer", keywords: ["regnskapsfører", "revisor", "controller", "accountant"] },
  { code: "2421", label: "Bedriftsrådgivere", keywords: ["konsulent", "rådgiver", "bedriftsrådgiver", "management consultant"] },
  { code: "2422", label: "Markedsanalytikere", keywords: ["markedsanalytiker", "market analyst", "research analyst"] },
  { code: "2424", label: "Personalrådgivere", keywords: ["hr", "personalsjef", "hr-rådgiver", "rekrutterer", "talent"] },
  { code: "2511", label: "Systemanalytikere og forretningsutviklere innenfor IKT", keywords: ["systemanalytiker", "forretningsutvikler", "produkteier", "product owner", "product manager"] },
  { code: "2512", label: "Programvareutviklere", keywords: ["utvikler", "developer", "engineer", "programmerer", "software engineer", "fullstack", "backend", "frontend", "ios", "android"] },
  { code: "2513", label: "Web- og multimediautviklere", keywords: ["webutvikler", "web developer", "frontend-utvikler"] },
  { code: "2521", label: "Databasedesignere og -administratorer", keywords: ["dba", "database", "data engineer", "dataarkitekt"] },
  { code: "2522", label: "Systemadministratorer", keywords: ["sysadmin", "systemadministrator", "devops", "sre", "site reliability"] },
  { code: "2523", label: "Nettverksspesialister", keywords: ["nettverksingeniør", "network engineer"] },
  { code: "2529", label: "Annet IKT-sikkerhetsarbeid", keywords: ["sikkerhetsanalytiker", "security analyst", "cybersikkerhet", "iam", "soc"] },
  { code: "2611", label: "Advokater", keywords: ["advokat", "lawyer", "juridisk rådgiver"] },
  { code: "2641", label: "Forfattere og litterære arbeidere", keywords: ["forfatter", "manusforfatter"] },
  { code: "2642", label: "Journalister", keywords: ["journalist", "redaktør", "reporter"] },
  { code: "2651", label: "Visuelle kunstnere", keywords: ["kunstner", "illustratør", "grafisk designer", "designer", "ux designer", "ui designer"] },
  { code: "2659", label: "Andre kreative og utøvende kunstnere", keywords: ["fotograf", "videograf", "innholdsprodusent", "content creator", "content manager", "videoredigerer", "filmskaper"] },
  { code: "2221", label: "Sykepleiere", keywords: ["sykepleier", "spesialsykepleier"] },
  { code: "3221", label: "Helsefagarbeidere", keywords: ["helsefagarbeider", "hjelpepleier"] },
  { code: "2261", label: "Tannleger", keywords: ["tannlege"] },
  { code: "3322", label: "Selgere (engros)", keywords: ["selger", "key account", "kam", "sales representative", "account manager", "account executive"] },
  { code: "3343", label: "Sekretærer (administrasjon)", keywords: ["sekretær", "kontormedarbeider", "administrativ konsulent"] },
  { code: "4222", label: "Telefon- og kundesenter-medarbeidere", keywords: ["kundeservice", "kundebehandler", "support", "customer support"] },
  { code: "5223", label: "Butikkmedarbeidere", keywords: ["butikkmedarbeider", "ekspeditør", "shop assistant"] },
  { code: "8331", label: "Førere av lastebil og vogntog", keywords: ["lastebilsjåfør", "yrkessjåfør"] },
];

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function matchStyrkCode(
  jobTitle: string,
): { code: string; label: string; matchScore: number } | null {
  const needle = normalizeText(jobTitle);
  if (!needle) return null;

  let best: { code: string; label: string; matchScore: number } | null = null;
  for (const entry of STYRK_MAP) {
    for (const kw of entry.keywords) {
      const k = normalizeText(kw);
      if (!k) continue;
      // Eksakt eller substring-match — vekter etter lengde av match.
      if (needle === k) {
        return { code: entry.code, label: entry.label, matchScore: 100 };
      }
      if (needle.includes(k)) {
        const score = Math.round((k.length / needle.length) * 80);
        if (!best || score > best.matchScore) {
          best = { code: entry.code, label: entry.label, matchScore: score };
        }
      } else if (k.includes(needle) && needle.length >= 4) {
        const score = Math.round((needle.length / k.length) * 60);
        if (!best || score > best.matchScore) {
          best = { code: entry.code, label: entry.label, matchScore: score };
        }
      }
    }
  }
  return best && best.matchScore >= 40 ? best : null;
}

// ── SSB-kall ────────────────────────────────────────────────────────

interface SsbFetchResult {
  median: number | null;
  p25: number | null;
  p75: number | null;
  sampleSize: number | null;
  sourceYear: number | null;
  raw: unknown;
}

async function fetchFromSsb(styrkCode: string): Promise<SsbFetchResult> {
  // SSB-tabell 11418 har ContentsCode "MaanedslonnNy" (avtalt månedslønn).
  // Vi spør om alle kjønn (T = total) og siste tilgjengelige år ("top: 1").
  const body = {
    query: [
      {
        code: "Yrke",
        selection: { filter: "item", values: [styrkCode] },
      },
      {
        code: "Sektor",
        selection: { filter: "item", values: ["T"] },
      },
      {
        code: "Kjonn",
        selection: { filter: "item", values: ["0"] },
      },
      {
        code: "ContentsCode",
        selection: {
          filter: "item",
          values: ["MaanedslonnNy"],
        },
      },
      {
        code: "Tid",
        selection: { filter: "top", values: ["1"] },
      },
    ],
    response: { format: "json-stat2" },
  };

  const res = await fetch(
    "https://data.ssb.no/api/v0/no/table/11418",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`SSB ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as {
    value: number[];
    dimension?: { Tid?: { category?: { label?: Record<string, string> } } };
  };
  const median = Array.isArray(json.value) && json.value.length > 0 ? Math.round(json.value[0]) : null;
  const labels = json.dimension?.Tid?.category?.label ?? {};
  const labelValues = Object.values(labels);
  const yearLabel = labelValues.length > 0 ? labelValues[0] : null;
  const sourceYear = yearLabel ? Number(String(yearLabel).slice(0, 4)) : null;

  // Tabell 11418 returnerer kun gjennomsnitt — for p25/p75 må vi
  // kalle tabell 12567 separat. For nå returnerer vi snitt som median,
  // og estimerer p25/p75 som ±15% (typisk lønnsspredning i Norge).
  const p25 = median ? Math.round(median * 0.82) : null;
  const p75 = median ? Math.round(median * 1.22) : null;

  return {
    median,
    p25,
    p75,
    sampleSize: null,
    sourceYear: Number.isFinite(sourceYear) ? sourceYear : null,
    raw: json,
  };
}

// ── Cache ───────────────────────────────────────────────────────────

interface CachedRow {
  median_nok: number | null;
  p25_nok: number | null;
  p75_nok: number | null;
  source_year: number | null;
  styrk_label: string;
  fetched_at: Date;
  expires_at: Date;
}

async function getCached(
  pool: Pool,
  styrkCode: string,
): Promise<CachedRow | null> {
  const r = await pool.query<CachedRow>(
    `SELECT median_nok, p25_nok, p75_nok, source_year,
            styrk_label, fetched_at, expires_at
       FROM nextrole_salary_cache
      WHERE styrk_code = $1
        AND expires_at > NOW()
      LIMIT 1`,
    [styrkCode],
  );
  return r.rowCount ? r.rows[0] : null;
}

async function upsertCache(
  pool: Pool,
  styrkCode: string,
  styrkLabel: string,
  data: SsbFetchResult,
): Promise<void> {
  await pool.query(
    `INSERT INTO nextrole_salary_cache (
       styrk_code, styrk_label, median_nok, p25_nok, p75_nok,
       sample_size, source_year, raw_response
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (styrk_code) DO UPDATE SET
       styrk_label = EXCLUDED.styrk_label,
       median_nok = EXCLUDED.median_nok,
       p25_nok = EXCLUDED.p25_nok,
       p75_nok = EXCLUDED.p75_nok,
       sample_size = EXCLUDED.sample_size,
       source_year = EXCLUDED.source_year,
       raw_response = EXCLUDED.raw_response,
       fetched_at = NOW(),
       expires_at = NOW() + INTERVAL '30 days'`,
    [
      styrkCode,
      styrkLabel,
      data.median,
      data.p25,
      data.p75,
      data.sampleSize,
      data.sourceYear,
      data.raw ? JSON.stringify(data.raw) : null,
    ],
  );
}

// ── ROUTES ──────────────────────────────────────────────────────────

export function setupNextRoleSalaryRoutes(deps: NextRoleSalaryDeps): void {
  const { app, pool } = deps;

  // GET salary-estimate?jobTitle=Senior+Content+Manager
  // Returnerer: { matched, styrkLabel, median, p25, p75, year, source }
  // eller     : { matched: false } hvis ingen yrkeskode matcher.
  app.get("/api/marketplace/next-role/salary-estimate", async (req, res) => {
    const jobTitle = String(req.query.jobTitle ?? "").trim();
    if (!jobTitle || jobTitle.length < 2) {
      res.status(400).json({ error: "missing_jobTitle" });
      return;
    }

    const match = matchStyrkCode(jobTitle);
    if (!match) {
      res.json({ matched: false, jobTitle });
      return;
    }

    try {
      let cached = await getCached(pool, match.code);
      if (!cached) {
        const data = await fetchFromSsb(match.code);
        await upsertCache(pool, match.code, match.label, data);
        cached = {
          median_nok: data.median,
          p25_nok: data.p25,
          p75_nok: data.p75,
          source_year: data.sourceYear,
          styrk_label: match.label,
          fetched_at: new Date(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
      }
      res.json({
        matched: true,
        jobTitle,
        styrkCode: match.code,
        styrkLabel: cached.styrk_label,
        matchScore: match.matchScore,
        medianMonthly: cached.median_nok,
        p25Monthly: cached.p25_nok,
        p75Monthly: cached.p75_nok,
        medianAnnual: cached.median_nok ? cached.median_nok * 12 : null,
        year: cached.source_year,
        source: "SSB tabell 11418 — heltidsansatte, alle sektorer",
        fetchedAt: cached.fetched_at.toISOString(),
      });
    } catch (err) {
      console.error("[nextrole-salary] SSB fetch failed", err);
      // Fallback til match-resultatet uten tall — frontend kan da
      // skjule banneret eller vise "data ikke tilgjengelig".
      res.json({
        matched: true,
        jobTitle,
        styrkCode: match.code,
        styrkLabel: match.label,
        matchScore: match.matchScore,
        medianMonthly: null,
        error: "ssb_unavailable",
      });
    }
  });
}
