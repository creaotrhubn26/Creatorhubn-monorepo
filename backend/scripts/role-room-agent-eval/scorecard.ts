/**
 * Pure (LLM-free) scorecard helpers for the Role Room Agent answer-quality eval.
 *
 * Kept side-effect-free and dependency-free so they are trivially unit-testable
 * (scorecard.test.ts) and reusable from run-eval.ts. NO network / SDK calls.
 */

/** The four scored dimensions a judge returns, each 0–5. */
export interface JudgeScores {
  groundedness: number;
  noHallucination: number;
  actionability: number;
  overall: number;
  rationale?: string;
}

/** A single fixture's evaluated result. */
export interface EvalResult {
  id: string;
  /** null when judging was skipped (no SDK/key) or failed. */
  scores: JudgeScores | null;
}

const SCORE_KEYS = ['groundedness', 'noHallucination', 'actionability', 'overall'] as const;

/** Default pass threshold on the aggregate `overall` mean. */
export const DEFAULT_PASS_THRESHOLD = 3.5;

function clampScore(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < 0) return 0;
  if (n > 5) return 5;
  return n;
}

/**
 * Tolerant JSON extraction from an LLM judge response. Handles:
 *   - bare JSON
 *   - ```json fenced ``` blocks (or plain ``` fences)
 *   - prose-wrapped JSON (locates the first {...} object)
 * Returns a normalised JudgeScores object, or null if the required numeric
 * dimensions can't be recovered. Never throws.
 */
export function parseJudgeJson(text: string | null | undefined): JudgeScores | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  const candidates: string[] = [];
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) candidates.push(fenceMatch[1].trim());
  candidates.push(trimmed);
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    let obj: unknown;
    try {
      obj = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;
    const rec = obj as Record<string, unknown>;

    const groundedness = clampScore(rec.groundedness);
    const noHallucination = clampScore(rec.noHallucination ?? rec.no_hallucination);
    const actionability = clampScore(rec.actionability);
    if (groundedness == null || noHallucination == null || actionability == null) {
      continue;
    }
    // If overall is missing/garbage, derive it from the mean of the three.
    let overall = clampScore(rec.overall);
    if (overall == null) {
      overall = Number(((groundedness + noHallucination + actionability) / 3).toFixed(2));
    }
    const rationale =
      typeof rec.rationale === 'string'
        ? rec.rationale
        : typeof rec.reason === 'string'
          ? rec.reason
          : undefined;

    return { groundedness, noHallucination, actionability, overall, rationale };
  }
  return null;
}

export interface AggregateScorecard {
  count: number;
  scored: number;
  skipped: number;
  means: {
    groundedness: number;
    noHallucination: number;
    actionability: number;
    overall: number;
  };
  threshold: number;
  pass: boolean;
}

/**
 * Aggregate per-fixture results into mean-per-dimension + pass/fail vs a
 * threshold on the `overall` mean. Results with null scores (skipped/failed)
 * are excluded from the means but counted in `skipped`. If nothing was scored,
 * means are 0 and pass is false (an empty eval is not a passing eval).
 */
export function aggregateScores(
  results: EvalResult[],
  threshold: number = DEFAULT_PASS_THRESHOLD,
): AggregateScorecard {
  const scored = results.filter((r): r is EvalResult & { scores: JudgeScores } => r.scores != null);
  const skipped = results.length - scored.length;

  const means = { groundedness: 0, noHallucination: 0, actionability: 0, overall: 0 };
  if (scored.length > 0) {
    for (const key of SCORE_KEYS) {
      const sum = scored.reduce((acc, r) => acc + r.scores[key], 0);
      means[key] = Number((sum / scored.length).toFixed(2));
    }
  }

  return {
    count: results.length,
    scored: scored.length,
    skipped,
    means,
    threshold,
    pass: scored.length > 0 && means.overall >= threshold,
  };
}

/** Render an aggregate + per-fixture breakdown as a plain-text table. */
export function formatScorecard(results: EvalResult[], aggregate: AggregateScorecard): string {
  const rows: string[] = [];
  rows.push('id                                   ground  noHall  action  overall');
  rows.push('------------------------------------ ------  ------  ------  -------');
  for (const r of results) {
    const id = r.id.padEnd(36).slice(0, 36);
    if (!r.scores) {
      rows.push(`${id}  (skipped — no score)`);
      continue;
    }
    const s = r.scores;
    rows.push(
      `${id} ${fmt(s.groundedness)}  ${fmt(s.noHallucination)}  ${fmt(s.actionability)}  ${fmt(s.overall)}`,
    );
  }
  rows.push('------------------------------------ ------  ------  ------  -------');
  rows.push(
    `MEAN (${aggregate.scored}/${aggregate.count} scored)              ` +
      `${fmt(aggregate.means.groundedness)}  ${fmt(aggregate.means.noHallucination)}  ${fmt(
        aggregate.means.actionability,
      )}  ${fmt(aggregate.means.overall)}`,
  );
  rows.push(
    `THRESHOLD overall >= ${aggregate.threshold.toFixed(2)}  →  ${aggregate.pass ? 'PASS' : 'FAIL'}`,
  );
  return rows.join('\n');
}

function fmt(n: number): string {
  return n.toFixed(2).padStart(6);
}
