/**
 * system-precision.ts — systemet måler sin egen treffsikkerhet
 * (forbedringsidé 1 + 6: selv-måling og kilde-økonomi)
 *
 * Hver avvist innsikt er treningsdata: presisjon per detektor
 * (andel actioned/seen vs dismissed) og verdi per kilde. Når en
 * detektor beviselig støyer (nok utvalg, høy avvisning), FORESLÅR
 * systemet stramming — som innsikt, aldri som automatisk endring.
 * Mennesket godkjenner terskler; systemet leverer beviset.
 */

import type { Pool } from "pg";

export interface DetectorPrecision {
  detector: string;
  total: number;
  dismissed: number;
  actioned: number;
  stillNew: number;
  /** Andel IKKE-avvist av de behandlede; null når for få behandlet. */
  precision: number | null;
}

/** Min. behandlede innsikter før presisjon beregnes — ellers null. */
export const MIN_JUDGED_FOR_PRECISION = 5;
/** Avvisningsrate som utløser tuning-forslag (m/ min-utvalg). */
export const TUNING_DISMISSAL_THRESHOLD = 0.7;
export const TUNING_MIN_JUDGED = 10;

export function computePrecision(rows: Array<{ detector: string; status: string; n: number }>): DetectorPrecision[] {
  const byDetector = new Map<string, DetectorPrecision>();
  for (const row of rows) {
    const d = byDetector.get(row.detector) ?? {
      detector: row.detector, total: 0, dismissed: 0, actioned: 0, stillNew: 0, precision: null,
    };
    d.total += row.n;
    if (row.status === "dismissed") d.dismissed += row.n;
    else if (row.status === "actioned") d.actioned += row.n;
    else if (row.status === "new") d.stillNew += row.n;
    byDetector.set(row.detector, d);
  }
  for (const d of byDetector.values()) {
    const judged = d.total - d.stillNew;
    d.precision = judged >= MIN_JUDGED_FOR_PRECISION
      ? Math.round(((judged - d.dismissed) / judged) * 100) / 100
      : null;
  }
  return [...byDetector.values()].sort((a, b) => b.total - a.total);
}

export async function getDetectorPrecision(pool: Pool, organizationId: string): Promise<DetectorPrecision[]> {
  const r = await pool.query<{ detector: string; status: string; n: number }>(
    `SELECT detector, status, count(*)::int AS n
       FROM insights WHERE organization_id = $1::uuid
      GROUP BY detector, status`,
    [organizationId],
  );
  return computePrecision(r.rows);
}

/**
 * Tuning-forslag som innsikter: detektorer med bevist støy får ett
 * forslag per måned (dedupe) — «terskelen bør opp, her er tallene».
 */
export async function runSelfTuningDetector(pool: Pool, organizationId: string): Promise<number> {
  const precision = await getDetectorPrecision(pool, organizationId);
  const month = new Date().toISOString().slice(0, 7);
  let inserted = 0;
  for (const d of precision) {
    const judged = d.total - d.stillNew;
    if (judged < TUNING_MIN_JUDGED) continue;
    const dismissalRate = d.dismissed / judged;
    if (dismissalRate < TUNING_DISMISSAL_THRESHOLD) continue;
    const r = await pool.query(
      `INSERT INTO insights (organization_id, detector, dedupe_key, severity, confidence,
                             title, explanation, evidence, topic, status)
       VALUES ($1::uuid, 'system-tuning', $2, 'notable', 1, $3, $4, $5::jsonb, 'system', 'new')
       ON CONFLICT (organization_id, dedupe_key) DO NOTHING`,
      [
        organizationId,
        `tuning|${d.detector}|${month}`,
        `Detektoren «${d.detector}» støyer: ${Math.round(dismissalRate * 100)} % avvist`,
        `${d.dismissed} av ${judged} behandlede innsikter fra denne detektoren er avvist. Tallene tilsier strammere terskler eller nøkkelord — si «stram ${d.detector}» så foreslås konkret endring. Ingenting endres automatisk.`,
        JSON.stringify([
          { ref: `precision|${d.detector}`, label: "avvist/behandlet", value: `${d.dismissed}/${judged}` },
        ]),
      ],
    );
    inserted += r.rowCount ?? 0;
  }
  return inserted;
}
