/**
 * Per-user recipe feedback + preference aggregation.
 *
 * Closes the loop between Claude Vision's suggested portrait recipe
 * and the values the photographer actually enhances with. Every time
 * the user hits Enhance after an AI suggestion, the frontend POSTs the
 * diff — `{ suggested, final }` — to this service. The service:
 *
 *   1. Persists the (user_id, suggested, final, ts) row for audit.
 *   2. Exposes ``aggregateUserRecipePreferences`` which summarises the
 *      last N diffs as a short prompt-injectable string:
 *
 *          "Photographer drifts: teethWhiteness +12 beyond suggested;
 *           prefers blemishProfile=strong (observed 7/10 times);
 *           frequently lowers saturation ~8 points."
 *
 *   3. That string is woven into the Claude Vision system prompt's
 *      user-context block on the next suggest call, so the model sees
 *      the photographer's systematic drift and pre-corrects for it.
 *
 * Why persist ourselves instead of reusing preset_usage_history:
 *   The existing table has an FK on preset_id referencing project_presets.
 *   AI suggestions aren't preset rows — they're ad-hoc per-image
 *   recipes. Creating a dedicated table keeps the schema honest and
 *   avoids polluting the preset table with synthetic rows.
 *
 * Why raw SQL + CREATE TABLE IF NOT EXISTS:
 *   Matches the repo's existing self-bootstrapping pattern (see the
 *   /memory-cards route for the same technique). Avoids coordinating
 *   a drizzle-kit migration just for a single new table.
 */
import type { Pool } from "pg";

export interface PhotoEnhancerRecipe {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
  denoising?: number;
  faceEnhancement?: number;
  skinTextureGuard?: number;
  blemishRemoval?: number;
  teethWhiteness?: number;
  eyeBrightness?: number;
  eyeWhiteness?: number;
  blemishProfile?: string;
  teethProfile?: string;
  eyeBrightnessProfile?: string;
  eyeWhitenessProfile?: string;
  subject?: string;
  subjectLookStrength?: number;
}

// Keys whose diffs we summarise numerically. Profile keys are handled
// separately (mode aggregation on strings, not arithmetic mean).
const NUMERIC_RECIPE_KEYS: readonly (keyof PhotoEnhancerRecipe)[] = [
  "brightness",
  "contrast",
  "saturation",
  "sharpness",
  "denoising",
  "faceEnhancement",
  "skinTextureGuard",
  "blemishRemoval",
  "teethWhiteness",
  "eyeBrightness",
  "eyeWhiteness",
  "subjectLookStrength",
] as const;

const PROFILE_RECIPE_KEYS: readonly (keyof PhotoEnhancerRecipe)[] = [
  "blemishProfile",
  "teethProfile",
  "eyeBrightnessProfile",
  "eyeWhitenessProfile",
] as const;

let tableReady = false;

async function ensureTable(pool: Pool): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS photo_enhancer_recipe_feedback (
      id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       varchar NOT NULL,
      suggested     jsonb   NOT NULL,
      final         jsonb   NOT NULL,
      diff          jsonb   NOT NULL,
      subject       varchar,
      created_at    timestamp DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS photo_enhancer_recipe_feedback_user_idx
       ON photo_enhancer_recipe_feedback (user_id, created_at DESC);`,
  );
  tableReady = true;
}

/**
 * Compute a shallow diff between the AI-suggested recipe and the final
 * settings. Missing keys on either side are skipped (Claude may omit a
 * field it had no opinion on, and the user may not have touched a
 * slider the AI didn't set). Only keys that Claude actually populated
 * *and* the user kept or changed contribute to the drift.
 */
export function diffRecipes(
  suggested: PhotoEnhancerRecipe,
  final: PhotoEnhancerRecipe,
): { numeric: Partial<Record<string, number>>; profile: Partial<Record<string, string>> } {
  const numeric: Record<string, number> = {};
  for (const key of NUMERIC_RECIPE_KEYS) {
    const s = suggested[key];
    const f = final[key];
    if (typeof s !== "number" || typeof f !== "number") continue;
    const delta = f - s;
    // Skip rounding-noise diffs — below 2 slider units isn't a
    // meaningful photographer opinion, it's fine-tuning the AI
    // shouldn't learn from.
    if (Math.abs(delta) < 2) continue;
    numeric[key] = delta;
  }
  const profile: Record<string, string> = {};
  for (const key of PROFILE_RECIPE_KEYS) {
    const s = suggested[key];
    const f = final[key];
    if (typeof s !== "string" || typeof f !== "string" || s === f) continue;
    profile[key] = f;
  }
  return { numeric, profile };
}

export async function logRecipeFeedback(
  pool: Pool,
  userId: string,
  suggested: PhotoEnhancerRecipe,
  final: PhotoEnhancerRecipe,
): Promise<{ id: string }> {
  await ensureTable(pool);
  const diff = diffRecipes(suggested, final);
  const subject = typeof final.subject === "string" ? final.subject : null;
  const result = await pool.query<{ id: string }>(
    `INSERT INTO photo_enhancer_recipe_feedback
       (user_id, suggested, final, diff, subject)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      userId,
      JSON.stringify(suggested),
      JSON.stringify(final),
      JSON.stringify(diff),
      subject,
    ],
  );
  return { id: result.rows[0]!.id };
}

/**
 * Summarise a list of past diffs into bullet points Claude can
 * consume as context. Pure function so we can test without a DB —
 * the DB-backed wrapper is ``aggregateUserRecipePreferences`` below.
 */
export function summariseDiffs(
  diffs: ReadonlyArray<{
    numeric: Record<string, number>;
    profile: Record<string, string>;
  }>,
  opts: { minOccurrences?: number } = {},
): string {
  const minOccurrences = Math.max(3, opts.minOccurrences ?? 3);
  if (diffs.length === 0) return "";

  // Numeric drift: compute mean delta per key, but only emit when the
  // photographer has consistently moved it (at least `minOccurrences`
  // samples). Otherwise the "learned" signal is noise.
  const numericSums: Record<string, { sum: number; n: number }> = {};
  for (const d of diffs) {
    for (const [key, delta] of Object.entries(d.numeric || {})) {
      const bucket = numericSums[key] ?? { sum: 0, n: 0 };
      bucket.sum += delta;
      bucket.n += 1;
      numericSums[key] = bucket;
    }
  }
  const numericLines: string[] = [];
  for (const [key, { sum, n }] of Object.entries(numericSums)) {
    if (n < minOccurrences) continue;
    const mean = sum / n;
    // Don't report drift under ~5 units — inside photographer noise.
    if (Math.abs(mean) < 5) continue;
    const direction = mean > 0 ? "+" : "";
    numericLines.push(
      `typically moves ${key} ${direction}${mean.toFixed(0)} beyond the AI suggestion (${n} samples)`,
    );
  }

  // Profile mode: which profile the photographer picks most often when
  // they override. Only emit when mode is seen ≥ minOccurrences.
  const profileCounts: Record<string, Record<string, number>> = {};
  for (const d of diffs) {
    for (const [key, value] of Object.entries(d.profile || {})) {
      const bucket = profileCounts[key] ?? {};
      bucket[value] = (bucket[value] ?? 0) + 1;
      profileCounts[key] = bucket;
    }
  }
  const profileLines: string[] = [];
  for (const [key, counts] of Object.entries(profileCounts)) {
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    if (!top) continue;
    const [value, count] = top;
    if (count < minOccurrences) continue;
    profileLines.push(`prefers ${key}=${value} (${count}/${diffs.length} times)`);
  }

  if (numericLines.length === 0 && profileLines.length === 0) return "";
  return [...numericLines, ...profileLines].join("; ");
}

export async function aggregateUserRecipePreferences(
  pool: Pool,
  userId: string,
  lookbackJobs: number = 20,
): Promise<string> {
  await ensureTable(pool);
  const rows = await pool
    .query<{ diff: unknown }>(
      `SELECT diff FROM photo_enhancer_recipe_feedback
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, Math.max(1, Math.min(200, lookbackJobs))],
    )
    .catch(() => ({ rows: [] as Array<{ diff: unknown }> }));

  if (rows.rows.length === 0) return "";
  const diffs = rows.rows
    .map((r) => r.diff as { numeric?: Record<string, number>; profile?: Record<string, string> })
    .filter((d): d is { numeric: Record<string, number>; profile: Record<string, string> } =>
      !!d && typeof d === "object",
    )
    .map((d) => ({
      numeric: d.numeric ?? {},
      profile: d.profile ?? {},
    }));
  return summariseDiffs(diffs);
}
