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

// ── Innsending og avstemming ────────────────────────────────────────────────
//
// NFIs veileder for prosjektregnskap: «Regnskap skal føres i henhold til
// kontoplan i godkjent kalkyleskjema. Med dette menes at regnskapet skal
// settes opp i samsvar med kalkyle/budsjett og kontoplan som ble brukt da
// søknad ble sendt inn.»
//
// Kravet er intern konsistens over tid, ikke samsvar med én fasit. Den
// farligste feilen er derfor ikke en gal postkode, men en kartlegging som
// endrer seg stille etter innsending — det oppdages først ved revisjon, når
// regnskapet ikke lar seg avstemme mot søknaden.

export interface FundingSnapshot {
  id: string;
  label: string;
  schemeKey: string;
  submittedAt: string;
  totalEstimate: number;
}

/**
 * Fryser eksporten slik den ble sendt inn. Snapshotet er fasiten senere
 * regnskap måles mot, og skal ikke kunne redigeres i ettertid.
 */
export async function snapshotFundingExport(
  pool: Pool,
  input: { projectId: string; schemeKey: string; label: string; userId: string | null },
): Promise<FundingSnapshot> {
  const exported = await buildFundingExport(pool, input.projectId, input.schemeKey);
  const r = await pool.query<{ id: string; submitted_at: string }>(
    `INSERT INTO role_room_funding_snapshots
       (project_id, scheme_key, label, submitted_by_user_id, export_payload, total_estimate, currency)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
     RETURNING id, submitted_at`,
    [
      input.projectId, input.schemeKey, input.label, input.userId,
      JSON.stringify(exported), exported.totals.estimate, exported.currency,
    ],
  );
  return {
    id: r.rows[0].id,
    label: input.label,
    schemeKey: input.schemeKey,
    submittedAt: r.rows[0].submitted_at,
    totalEstimate: exported.totals.estimate,
  };
}

export interface SnapshotDrift {
  targetCode: string | null;
  targetLabel: string;
  submitted: number;
  current: number;
  difference: number;
}

export interface SnapshotComparison {
  snapshotId: string;
  label: string;
  submittedAt: string;
  submittedTotal: number;
  currentTotal: number;
  difference: number;
  /** Poster der beløpet har endret seg siden innsending. */
  changedLines: SnapshotDrift[];
  /** Poster som er kommet til eller falt bort — alvorligst, fordi de bryter
   *  selve kontoplanen regnskapet skal føres etter. */
  structureChanged: string[];
  warnings: string[];
}

/**
 * Sammenligner dagens budsjett med det som ble sendt inn.
 *
 * Endrede beløp er normalt og forventet — et budsjett beveger seg. Endret
 * STRUKTUR er noe annet: da føres ikke lenger regnskapet etter kontoplanen i
 * det godkjente kalkyleskjemaet, og avviket må forklares overfor finansiøren.
 */
export async function compareToSnapshot(
  pool: Pool,
  snapshotId: string,
): Promise<SnapshotComparison> {
  const snapRes = await pool.query(
    `SELECT id, project_id, scheme_key, label, submitted_at, export_payload
       FROM role_room_funding_snapshots WHERE id = $1 LIMIT 1`,
    [snapshotId],
  );
  if (snapRes.rowCount === 0) throw new Error(`Ukjent innsending: ${snapshotId}`);
  const snap = snapRes.rows[0] as Record<string, unknown>;
  const submitted = snap.export_payload as FundingExport;

  const current = await buildFundingExport(
    pool,
    String(snap.project_id),
    String(snap.scheme_key),
  );

  const keyOf = (l: FundingExportLine) => l.targetCode ?? l.targetLabel;
  const submittedByKey = new Map(submitted.lines.map((l) => [keyOf(l), l]));
  const currentByKey = new Map(current.lines.map((l) => [keyOf(l), l]));

  const changedLines: SnapshotDrift[] = [];
  for (const [key, cur] of currentByKey) {
    const before = submittedByKey.get(key);
    if (!before) continue;
    if (before.estimate !== cur.estimate) {
      changedLines.push({
        targetCode: cur.targetCode,
        targetLabel: cur.targetLabel,
        submitted: before.estimate,
        current: cur.estimate,
        difference: cur.estimate - before.estimate,
      });
    }
  }

  const structureChanged = [
    ...[...currentByKey.keys()].filter((k) => !submittedByKey.has(k)).map((k) => `ny post: ${k}`),
    ...[...submittedByKey.keys()].filter((k) => !currentByKey.has(k)).map((k) => `borte: ${k}`),
  ];

  const warnings: string[] = [];
  if (structureChanged.length > 0) {
    warnings.push(
      `Kontoplanen er endret siden innsending (${structureChanged.join(", ")}). ` +
        `NFI krever at regnskapet føres etter kontoplanen i godkjent kalkyleskjema — ` +
        `avviket må forklares overfor finansiøren.`,
    );
  }
  const submittedTotal = submitted.totals.estimate;
  const currentTotal = current.totals.estimate;
  if (submittedTotal > 0 && Math.abs(currentTotal - submittedTotal) / submittedTotal > 0.1) {
    warnings.push(
      `Totalbudsjettet har endret seg mer enn 10 % siden innsending ` +
        `(${submittedTotal.toLocaleString("nb-NO")} → ${currentTotal.toLocaleString("nb-NO")}).`,
    );
  }

  return {
    snapshotId: String(snap.id),
    label: String(snap.label),
    submittedAt: String(snap.submitted_at),
    submittedTotal,
    currentTotal,
    difference: currentTotal - submittedTotal,
    changedLines,
    structureChanged,
    warnings,
  };
}
