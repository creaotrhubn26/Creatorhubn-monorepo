/**
 * role-room-funding-export.ts
 *
 * Eksport av budsjett til finansiørenes oppsett (Del A punkt 114).
 *
 * «Ingen konkurrent gjør dette» — men det betyr også at det ikke finnes noe å
 * kopiere, og at feil format har en reell kostnad: en søknad til NFI med
 * budsjett i feil oppsett blir sendt i retur.
 *
 * Derfor to designvalg som begge handler om ærlighet framfor å se ferdig ut:
 *
 *   1. Kartleggingen ligger i basen, ikke i koden. Malene endres, og den som
 *      oppdager avviket er en produsent midt i en søknadsfrist.
 *   2. Eksporten sier fra når oppsettet ikke er kontrollert mot finansiørens
 *      gjeldende mal, og lister kategorier som ikke ble kartlagt framfor å
 *      utelate dem stille. En budsjettpost som forsvinner i eksporten er
 *      verre enn en som havner feil, fordi ingen oppdager den.
 */

import type { Pool } from "pg";

export interface FundingExportLine {
  targetCode: string | null;
  targetLabel: string;
  targetGroup: string | null;
  sourceCategories: string[];
  estimate: number;
  approved: number;
  actual: number;
}

export interface FundingExport {
  scheme: { key: string; name: string; organisation: string | null; verified: boolean; sourceUrl: string | null };
  projectId: string;
  currency: string;
  lines: FundingExportLine[];
  totals: { estimate: number; approved: number; actual: number };
  /** Kategorier på prosjektet som ikke finnes i kartleggingen. */
  unmapped: Array<{ category: string; estimate: number }>;
  warnings: string[];
}

/**
 * Bygger eksporten. Beløp summeres per målpost, fordi flere av våre kategorier
 * kan havne i samme post hos finansiøren.
 */
export async function buildFundingExport(
  pool: Pool,
  projectId: string,
  schemeKey: string,
): Promise<FundingExport> {
  const schemeRes = await pool.query(
    `SELECT id, scheme_key, name, organisation, verified, source_url
       FROM role_room_funding_schemes WHERE scheme_key = $1 LIMIT 1`,
    [schemeKey],
  );
  if (schemeRes.rowCount === 0) throw new Error(`Ukjent budsjettoppsett: ${schemeKey}`);
  const scheme = schemeRes.rows[0] as Record<string, unknown>;

  const [mappingRes, itemRes] = await Promise.all([
    pool.query(
      `SELECT source_category, target_code, target_label, target_group, sort_order
         FROM role_room_funding_category_mappings
        WHERE scheme_id = $1
        ORDER BY sort_order`,
      [scheme.id],
    ),
    pool.query(
      `SELECT category, currency,
              COALESCE(SUM(estimate), 0) AS estimate,
              COALESCE(SUM(approved), 0) AS approved,
              COALESCE(SUM(actual), 0)   AS actual
         FROM role_room_budget_items
        WHERE project_id = $1
        GROUP BY category, currency`,
      [projectId],
    ),
  ]);

  const mappings = mappingRes.rows as Array<Record<string, unknown>>;
  const byCategory = new Map(mappings.map((m) => [String(m.source_category), m]));

  // Målposter i malens rekkefølge — også de uten beløp, fordi en tom post i
  // søknaden er informasjon: den viser at posten er vurdert.
  const lines = new Map<string, FundingExportLine>();
  for (const m of mappings) {
    const key = String(m.target_code ?? m.target_label);
    if (!lines.has(key)) {
      lines.set(key, {
        targetCode: (m.target_code as string) ?? null,
        targetLabel: String(m.target_label),
        targetGroup: (m.target_group as string) ?? null,
        sourceCategories: [],
        estimate: 0, approved: 0, actual: 0,
      });
    }
  }

  const unmapped: FundingExport["unmapped"] = [];
  const currencies = new Set<string>();

  for (const item of itemRes.rows as Array<Record<string, unknown>>) {
    const category = String(item.category);
    currencies.add(String(item.currency ?? "NOK"));
    const mapping = byCategory.get(category);
    if (!mapping) {
      unmapped.push({ category, estimate: Number(item.estimate ?? 0) });
      continue;
    }
    const key = String(mapping.target_code ?? mapping.target_label);
    const line = lines.get(key)!;
    line.sourceCategories.push(category);
    line.estimate += Number(item.estimate ?? 0);
    line.approved += Number(item.approved ?? 0);
    line.actual += Number(item.actual ?? 0);
  }

  const ordered = [...lines.values()];
  const warnings: string[] = [];

  if (!scheme.verified) {
    warnings.push(
      `Oppsettet «${scheme.name}» er IKKE kontrollert mot finansiørens gjeldende mal. ` +
        `Postkodene kan være feil — kontroller mot malen før innsending.`,
    );
  }
  if (unmapped.length > 0) {
    warnings.push(
      `${unmapped.length} budsjettkategori(er) mangler kartlegging og er IKKE med i postene: ` +
        `${unmapped.map((u) => u.category).join(", ")}. Summen deres er ${unmapped
          .reduce((s, u) => s + u.estimate, 0)
          .toLocaleString("nb-NO")}.`,
    );
  }
  if (currencies.size > 1) {
    warnings.push(
      `Budsjettet inneholder flere valutaer (${[...currencies].join(", ")}). Eksporten summerer ` +
        `uten omregning — kontroller før innsending.`,
    );
  }

  return {
    scheme: {
      key: String(scheme.scheme_key),
      name: String(scheme.name),
      organisation: (scheme.organisation as string) ?? null,
      verified: Boolean(scheme.verified),
      sourceUrl: (scheme.source_url as string) ?? null,
    },
    projectId,
    currency: currencies.size === 1 ? [...currencies][0] : "BLANDET",
    lines: ordered,
    totals: {
      estimate: ordered.reduce((s, l) => s + l.estimate, 0),
      approved: ordered.reduce((s, l) => s + l.approved, 0),
      actual: ordered.reduce((s, l) => s + l.actual, 0),
    },
    unmapped,
    warnings,
  };
}

/** Escaper et felt for CSV etter RFC 4180. */
export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV med semikolon som skilletegn og BOM.
 *
 * Begge deler fordi mottakeren åpner filen i norsk Excel: der er semikolon
 * listeskilletegnet, og uten BOM blir æøå til rot. En eksport som ser ødelagt
 * ut når den åpnes er en eksport ingen bruker.
 *
 * Advarslene legges i toppen av filen, ikke bare i API-svaret — den som sender
 * søknaden ser ofte bare filen.
 */
export function toCsv(exported: FundingExport): string {
  const rows: string[] = [];

  for (const w of exported.warnings) rows.push(`# ADVARSEL: ${w}`);
  if (exported.warnings.length > 0) rows.push("");

  rows.push(["Gruppe", "Post", "Betegnelse", "Estimat", "Godkjent", "Faktisk", "Våre kategorier"]
    .map(csvField).join(";"));

  for (const line of exported.lines) {
    rows.push([
      line.targetGroup, line.targetCode, line.targetLabel,
      line.estimate, line.approved, line.actual,
      line.sourceCategories.join(", "),
    ].map(csvField).join(";"));
  }

  rows.push(["", "", "SUM", exported.totals.estimate, exported.totals.approved, exported.totals.actual, ""]
    .map(csvField).join(";"));

  if (exported.unmapped.length > 0) {
    rows.push("");
    rows.push(csvField("IKKE KARTLAGT — disse er ikke med i postene over"));
    for (const u of exported.unmapped) {
      rows.push([csvField(u.category), csvField(u.estimate)].join(";"));
    }
  }

  // BOM så norsk Excel leser UTF-8 riktig.
  return "﻿" + rows.join("\r\n") + "\r\n";
}
