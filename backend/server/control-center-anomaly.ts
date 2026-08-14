/**
 * control-center-anomaly.ts
 *
 * Anomali-deteksjon — det STATISTISKE proaktive laget i Control Center. En cron
 * (GitHub Actions, hvert 15. min) ser etter mønstre i `error_log` som en enkelt
 * incident ikke fanger:
 *   1) RATE-SPIKE — event-raten (nye occurrences i vinduet) langt over 24t-
 *      baseline. error_log aggregerer per fingerprint, så vi utleder raten via
 *      snapshot-DIFFERANSER (SUM(occurrence_count) nå − forrige snapshot).
 *   2) NY FEILTYPE — fingerprints som dukket opp første gang nettopp (ny klasse
 *      feil begynner å skje).
 *
 * Varsler super_admin (debounced), men lager IKKE error_log-incidents av
 * anomaliene selv (ville vært en feedback-loop). Alt er lesing.
 */

import type { Pool } from "pg";
import { notifyAdmins, type AdminInboundEvent } from "./admin-notify.js";

const WINDOW_MIN = 20; // «nylig»/aktiv-vindu
const SPIKE_FACTOR = 3; // spike = delta > factor × baseline
const MIN_SPIKE = 10; // ...og minst så mange events (unngå støy på små tall)
const SPIKE_DEBOUNCE_MIN = 60;
const NEW_DEBOUNCE_HOURS = 24;
const NEW_LIMIT = 20;

export interface NewErrorAnomaly {
  fingerprint: string;
  message: string;
  endpoint: string | null;
  level: string;
  occurrenceCount: number;
  firstSeenAt: string;
}

export interface AnomalyScanSummary {
  spike: boolean;
  deltaOccurrences: number;
  baseline: number | null;
  activeFingerprints: number;
  unresolvedTotal: number;
  newErrors: NewErrorAnomaly[];
  alertsSent: number;
}

// ── Rene helpers ────────────────────────────────────────────────────────────

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Spike = nok events OG godt over baseline. Krever en baseline (>=2 samples). */
export function isSpike(delta: number, baseline: number | null, factor = SPIKE_FACTOR, min = MIN_SPIKE): boolean {
  if (baseline == null) return false;
  if (delta < min) return false;
  return delta > Math.max(min, baseline * factor);
}

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "42P01";
}

export interface AnomalyDeps {
  now?: () => number;
  notifyFn?: (pool: Pool, event: AdminInboundEvent) => Promise<void>;
}

/**
 * Skann-en: fang snapshot, beregn spike mot baseline, finn nye feiltyper,
 * varsle (debounced). Returnerer en oppsummering (også når tabeller mangler).
 */
export async function runAnomalyScan(pool: Pool, deps: AnomalyDeps = {}): Promise<AnomalyScanSummary> {
  const now = deps.now ?? (() => Date.now());
  const notifyFn = deps.notifyFn ?? notifyAdmins;

  const empty: AnomalyScanSummary = {
    spike: false,
    deltaOccurrences: 0,
    baseline: null,
    activeFingerprints: 0,
    unresolvedTotal: 0,
    newErrors: [],
    alertsSent: 0,
  };

  // Nåværende aggregater fra error_log.
  let totalOccurrences = 0;
  let activeFingerprints = 0;
  let unresolvedTotal = 0;
  try {
    const agg = await pool.query(
      `SELECT
         COALESCE(SUM(occurrence_count), 0)::bigint AS total,
         COUNT(*) FILTER (WHERE last_seen_at > now() - ($1 || ' minutes')::interval)::int AS active,
         COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS unresolved
       FROM error_log`,
      [String(WINDOW_MIN)],
    );
    totalOccurrences = Number(agg.rows[0]?.total ?? 0);
    activeFingerprints = Number(agg.rows[0]?.active ?? 0);
    unresolvedTotal = Number(agg.rows[0]?.unresolved ?? 0);
  } catch (err) {
    if (isMissingTable(err)) return empty; // error_log finnes ikke → ingenting å gjøre
    throw err;
  }

  // Forrige snapshot → delta + baseline. Tåler manglende snapshot-tabell.
  let deltaOccurrences = 0;
  let baseline: number | null = null;
  try {
    const prev = await pool.query(
      `SELECT total_occurrences FROM control_center_error_snapshots ORDER BY captured_at DESC LIMIT 1`,
    );
    if (prev.rows.length > 0) {
      const prevTotal = Number(prev.rows[0].total_occurrences ?? 0);
      // Negativ (f.eks. etter resolve/rydding) klemmes til 0.
      deltaOccurrences = Math.max(0, totalOccurrences - prevTotal);
    }
    const hist = await pool.query(
      `SELECT delta_occurrences FROM control_center_error_snapshots
        WHERE captured_at > now() - interval '24 hours'`,
    );
    const deltas = hist.rows.map((r) => Number(r.delta_occurrences ?? 0));
    baseline = median(deltas);

    await pool.query(
      `INSERT INTO control_center_error_snapshots
         (total_occurrences, delta_occurrences, unresolved_total, active_fingerprints)
       VALUES ($1,$2,$3,$4)`,
      [totalOccurrences, deltaOccurrences, unresolvedTotal, activeFingerprints],
    );
  } catch (err) {
    if (!isMissingTable(err)) {
      console.warn("[anomaly] snapshot failed:", (err as Error).message);
    }
    // Uten snapshot-tabell kan vi ikke spike-detektere, men fortsett med nye feil.
  }

  const spike = isSpike(deltaOccurrences, baseline);

  // Nye feiltyper i vinduet.
  let newErrors: NewErrorAnomaly[] = [];
  try {
    const rows = await pool.query(
      `SELECT fingerprint, message, endpoint, level, occurrence_count, first_seen_at
         FROM error_log
        WHERE first_seen_at > now() - ($1 || ' minutes')::interval
          AND resolved_at IS NULL
        ORDER BY first_seen_at DESC
        LIMIT ${NEW_LIMIT}`,
      [String(WINDOW_MIN)],
    );
    newErrors = rows.rows.map((r) => ({
      fingerprint: r.fingerprint as string,
      message: (r.message as string) ?? "",
      endpoint: (r.endpoint as string) ?? null,
      level: (r.level as string) ?? "error",
      occurrenceCount: Number(r.occurrence_count ?? 0),
      firstSeenAt: new Date(r.first_seen_at as string).toISOString(),
    }));
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[anomaly] new-errors failed:", (err as Error).message);
  }

  // Varsler (debounced via anomaly_state).
  let alertsSent = 0;

  if (spike) {
    if (await shouldAlert(pool, "rate_spike", SPIKE_DEBOUNCE_MIN * 60_000, now)) {
      try {
        await notifyFn(pool, {
          type: "anomaly_rate_spike",
          source: "Control Center · Anomali",
          title: `📈 Feil-rate spike: ${deltaOccurrences} events siste ${WINDOW_MIN} min`,
          summary: `Baseline ~${baseline != null ? Math.round(baseline) : "?"}/vindu (24t median). ${unresolvedTotal} uløste, ${activeFingerprints} aktive feiltyper.`,
          link: "/admin?panel=control-center&tab=anomaly",
          relatedId: "rate_spike",
        });
        alertsSent++;
      } catch (err) {
        console.warn("[anomaly] spike notify failed:", (err as Error).message);
      }
    }
  }

  for (const e of newErrors) {
    if (await shouldAlert(pool, `new:${e.fingerprint}`, NEW_DEBOUNCE_HOURS * 3_600_000, now)) {
      try {
        await notifyFn(pool, {
          type: "anomaly_new_error",
          source: "Control Center · Anomali",
          title: `🆕 Ny feiltype: ${(e.message || e.fingerprint).slice(0, 80)}`,
          summary: `${e.level.toUpperCase()} på ${e.endpoint ?? "ukjent endepunkt"} — ${e.occurrenceCount}× siden ${e.firstSeenAt}.`,
          link: "/admin?panel=control-center&tab=anomaly",
          relatedId: e.fingerprint,
        });
        alertsSent++;
      } catch (err) {
        console.warn("[anomaly] new-error notify failed:", (err as Error).message);
      }
    }
  }

  return { spike, deltaOccurrences, baseline, activeFingerprints, unresolvedTotal, newErrors, alertsSent };
}

/**
 * Debounce: returnerer true (og oppdaterer tidsstempel) hvis nøkkelen ikke er
 * varslet innenfor `windowMs`. Atomisk via ON CONFLICT med tids-guard.
 */
async function shouldAlert(pool: Pool, key: string, windowMs: number, now: () => number): Promise<boolean> {
  try {
    const cutoff = new Date(now() - windowMs).toISOString();
    const r = await pool.query(
      `INSERT INTO control_center_anomaly_state (anomaly_key, last_alerted_at)
         VALUES ($1, now())
       ON CONFLICT (anomaly_key) DO UPDATE SET last_alerted_at = now()
         WHERE control_center_anomaly_state.last_alerted_at < $2
       RETURNING anomaly_key`,
      [key, cutoff],
    );
    return (r.rowCount ?? 0) > 0;
  } catch (err) {
    if (isMissingTable(err)) return false; // uten state-tabell: ikke varsle (unngå spam)
    console.warn("[anomaly] debounce failed:", (err as Error).message);
    return false;
  }
}

// ── Status-visning ──────────────────────────────────────────────────────────

export interface AnomalyView {
  spike: boolean;
  latestDelta: number | null;
  baseline: number | null;
  activeFingerprints: number | null;
  unresolvedTotal: number | null;
  newErrors: NewErrorAnomaly[];
  lastScanAt: string | null;
  generatedAt: string;
}

export async function getAnomalyView(pool: Pool): Promise<AnomalyView> {
  const generatedAt = new Date().toISOString();
  const view: AnomalyView = {
    spike: false,
    latestDelta: null,
    baseline: null,
    activeFingerprints: null,
    unresolvedTotal: null,
    newErrors: [],
    lastScanAt: null,
    generatedAt,
  };

  try {
    const latest = await pool.query(
      `SELECT captured_at, delta_occurrences, unresolved_total, active_fingerprints
         FROM control_center_error_snapshots ORDER BY captured_at DESC LIMIT 1`,
    );
    if (latest.rows.length > 0) {
      const row = latest.rows[0];
      view.latestDelta = Number(row.delta_occurrences ?? 0);
      view.unresolvedTotal = Number(row.unresolved_total ?? 0);
      view.activeFingerprints = Number(row.active_fingerprints ?? 0);
      view.lastScanAt = new Date(row.captured_at as string).toISOString();
    }
    const hist = await pool.query(
      `SELECT delta_occurrences FROM control_center_error_snapshots WHERE captured_at > now() - interval '24 hours'`,
    );
    view.baseline = median(hist.rows.map((r) => Number(r.delta_occurrences ?? 0)));
    view.spike = isSpike(view.latestDelta ?? 0, view.baseline);
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[anomaly] view snapshot failed:", (err as Error).message);
  }

  try {
    const rows = await pool.query(
      `SELECT fingerprint, message, endpoint, level, occurrence_count, first_seen_at
         FROM error_log
        WHERE first_seen_at > now() - interval '24 hours' AND resolved_at IS NULL
        ORDER BY first_seen_at DESC LIMIT ${NEW_LIMIT}`,
    );
    view.newErrors = rows.rows.map((r) => ({
      fingerprint: r.fingerprint as string,
      message: (r.message as string) ?? "",
      endpoint: (r.endpoint as string) ?? null,
      level: (r.level as string) ?? "error",
      occurrenceCount: Number(r.occurrence_count ?? 0),
      firstSeenAt: new Date(r.first_seen_at as string).toISOString(),
    }));
  } catch (err) {
    if (!isMissingTable(err)) console.warn("[anomaly] view new-errors failed:", (err as Error).message);
  }

  return { ...view, generatedAt };
}
