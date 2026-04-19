/**
 * Ergonomics telemetry for CreatorHub — track the cognitive cost of
 * the photographer's work so the product can remove the parts that
 * drain them.
 *
 * Philosophy:
 *   CreatorHub exists to keep the creative in focus. That means
 *   actively measuring where they lose focus — decision fatigue on
 *   long culling sessions, indecision loops on near-duplicate frames,
 *   context-switching cost between editing / admin / communication —
 *   and using the data to streamline the workflow. The telemetry
 *   itself is deliberately small-surface:
 *     * Opt-in only. Off by default; photographer flips a single
 *       switch in their preferences after reading the privacy note.
 *     * Buffered locally, batch-posted. Any 5-minute offline window
 *       is fine; the client re-sends when connectivity returns.
 *     * Aggregated anonymously. The raw event stream is per-user, but
 *       every insight fn here produces bucketed stats where a single
 *       event never leaves the system identifiable.
 *
 * Event shape (client sends in batches):
 *   kind: "view" | "decide" | "reverse" | "pause" | "session_start" | "session_end"
 *   sessionId: client-generated session identifier
 *   assetId: optional asset under review when event fired
 *   previousAction / newAction: for "reverse" events
 *   ms: wall-clock timestamp
 *   sequence: monotonic counter within the session
 *
 * This module owns:
 *   1. Pure aggregators that convert an event stream into per-user
 *      fatigue/indecision/hover metrics. CI-safe (no DB).
 *   2. DB persistence helpers (raw SQL + ensureTable pattern, matching
 *      the photo-enhancer feedback service for consistency).
 *   3. A thin summary-builder that turns persisted events into the
 *      shape the frontend / insight dashboard consumes.
 */
import type { Pool } from "pg";

export type ErgonomicsEventKind =
  | "session_start"
  | "view"
  | "decide"
  | "reverse"
  | "pause"
  | "session_end";

export interface ErgonomicsEvent {
  /// Unique per session so one long culling run doesn't interleave
  /// with another — sessions are the analysis unit.
  sessionId: string;
  kind: ErgonomicsEventKind;
  /// Wall-clock epoch ms. Client-timed; we don't trust accuracy to
  /// better than ~100ms, which is fine for decision-fatigue work.
  ms: number;
  /// Monotonic counter within the session. Lets us detect dropped
  /// events during batch flush.
  sequence: number;
  /// Asset under review when the event fired, if any.
  assetId?: string | null;
  /// Action taken on a "decide" event. Free-form so we can extend
  /// without schema changes; existing analyzers check the canonical
  /// set (``hero`` | ``keep`` | ``weak`` | ``reject`` | ``flag`` | ``rate``).
  action?: string | null;
  /// For "reverse" events: what the asset was tagged as before this
  /// reversal and what it's tagged as after.
  previousAction?: string | null;
  newAction?: string | null;
  /// For "view" events: was this the first time the photographer has
  /// looked at this asset in this session? Lets us distinguish
  /// initial-triage hovering from re-visits (a strong indecision
  /// signal).
  firstView?: boolean;
}


export interface HoverStats {
  /// Total assets the photographer looked at during the session.
  assetsViewed: number;
  /// Median ms between entering an asset and the first decision about
  /// it. Short median = efficient first-pass; long median = struggling.
  medianDecisionMs: number;
  /// 90th percentile — captures the "these 3 frames broke me" tail.
  p90DecisionMs: number;
  /// Count of assets the photographer revisited more than once —
  /// classic indecision signal.
  revisitedAssets: number;
}

export interface FatigueCurve {
  /// Per 50-frame window: median decision time in that window.
  /// When later windows trend upward vs early ones, that's fatigue
  /// building up.
  windows: { windowStart: number; medianMs: number; count: number }[];
  /// Monotonic upward trend across windows. 0 = no fatigue signal,
  /// 1 = consistent slowdown. Computed as fraction of consecutive
  /// window pairs where later > earlier.
  upwardTrend: number;
  /// Slope of a simple linear fit (ms per 50-frame window). Positive
  /// = slowing down over time. Useful for "your decisions took 40%
  /// longer in the last 200 frames" style headlines.
  slope: number;
}

export interface ReversalRate {
  decisionsMade: number;
  reversals: number;
  /// reversals / decisionsMade. 0–1. Anything above ~0.15 in a
  /// single session is strong "this cohort confused me" signal.
  rate: number;
}

export interface ErgonomicsSummary {
  sessionsAnalysed: number;
  hover: HoverStats;
  reversal: ReversalRate;
  fatigue: FatigueCurve;
  /// Human-readable headline the frontend shows — produced by a
  /// template function so the dashboard doesn't need its own
  /// interpretation logic. Never empty; falls back to "not enough
  /// data yet" when sample size is too small.
  headline: string;
}


// ─────────────── Pure aggregators (CI-safe, no DB) ────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx]!;
}

/**
 * Compute hover + decision stats for one session's event stream.
 *
 * Pairs each ``decide`` event with the most recent ``view`` event for
 * the same asset — the difference is the "staring time". We ignore
 * decide-without-view pairs (shouldn't happen, but defensive) and
 * view-without-decide (still thinking).
 */
export function computeHoverStats(events: ReadonlyArray<ErgonomicsEvent>): HoverStats {
  const viewedAssets = new Map<string, { firstMs: number; count: number }>();
  const decisionLatencies: number[] = [];
  // Track the most recent view per asset so we can pair it with the
  // next decide.
  const lastViewMs = new Map<string, number>();

  for (const ev of events) {
    if (ev.kind === "view" && ev.assetId) {
      lastViewMs.set(ev.assetId, ev.ms);
      const prior = viewedAssets.get(ev.assetId);
      if (prior) {
        prior.count += 1;
      } else {
        viewedAssets.set(ev.assetId, { firstMs: ev.ms, count: 1 });
      }
    }
    if (ev.kind === "decide" && ev.assetId) {
      const viewed = lastViewMs.get(ev.assetId);
      if (typeof viewed === "number") {
        decisionLatencies.push(Math.max(0, ev.ms - viewed));
        lastViewMs.delete(ev.assetId);
      }
    }
  }

  const revisitedAssets = Array.from(viewedAssets.values()).filter(
    (v) => v.count > 1,
  ).length;

  return {
    assetsViewed: viewedAssets.size,
    medianDecisionMs: Math.round(median(decisionLatencies)),
    p90DecisionMs: Math.round(percentile(decisionLatencies, 0.9)),
    revisitedAssets,
  };
}

/**
 * Reversal rate: how often did the photographer change their mind on
 * a frame mid-session? We only count explicit ``reverse`` events
 * (the client-side hook emits these when the photographer flips a
 * rating / flag / reject state).
 */
export function computeReversalRate(
  events: ReadonlyArray<ErgonomicsEvent>,
): ReversalRate {
  let decisions = 0;
  let reversals = 0;
  for (const ev of events) {
    if (ev.kind === "decide") decisions += 1;
    if (ev.kind === "reverse") reversals += 1;
  }
  // Guard against divide-by-zero: no decisions = rate 0, not NaN.
  const rate = decisions > 0 ? reversals / decisions : 0;
  return { decisionsMade: decisions, reversals, rate };
}

/**
 * Fatigue curve: chunk decisions into fixed-size windows (50 frames
 * each by default) and compare median decision time across windows.
 *
 * We measure this way rather than as a continuous regression because
 * bands give a more intuitive visualization ("your first 50: 2s
 * median, your last 50: 6s median") and are robust to individual
 * outlier frames.
 */
export function computeFatigueCurve(
  events: ReadonlyArray<ErgonomicsEvent>,
  windowSize: number = 50,
): FatigueCurve {
  // Replay-pair views and decides to get a sequence of decision
  // latencies in the order they happened.
  const lastViewMs = new Map<string, number>();
  const orderedLatencies: number[] = [];
  for (const ev of events) {
    if (ev.kind === "view" && ev.assetId) {
      lastViewMs.set(ev.assetId, ev.ms);
    } else if (ev.kind === "decide" && ev.assetId) {
      const viewed = lastViewMs.get(ev.assetId);
      if (typeof viewed === "number") {
        orderedLatencies.push(Math.max(0, ev.ms - viewed));
        lastViewMs.delete(ev.assetId);
      }
    }
  }

  const windows: FatigueCurve["windows"] = [];
  for (let i = 0; i < orderedLatencies.length; i += windowSize) {
    const slice = orderedLatencies.slice(i, i + windowSize);
    if (slice.length === 0) continue;
    windows.push({
      windowStart: i,
      medianMs: Math.round(median(slice)),
      count: slice.length,
    });
  }

  // Upward-trend fraction: of all consecutive window pairs, how many
  // got slower? 0.5 is "random noise", above that is a real slowdown.
  let slowdownPairs = 0;
  for (let i = 1; i < windows.length; i++) {
    if (windows[i]!.medianMs > windows[i - 1]!.medianMs) slowdownPairs += 1;
  }
  const upwardTrend = windows.length > 1
    ? slowdownPairs / (windows.length - 1)
    : 0;

  // Simple slope: (last - first) / (#windows - 1). Good enough for a
  // headline metric; we don't need proper OLS for this use case.
  const slope = windows.length > 1
    ? (windows[windows.length - 1]!.medianMs - windows[0]!.medianMs) /
      (windows.length - 1)
    : 0;

  return { windows, upwardTrend, slope };
}


/**
 * Render a one-line, photographer-friendly headline from a summary.
 * Deliberately careful not to shame — we surface patterns, not
 * blame. Returns "not enough data yet" when the session was too
 * short to draw conclusions (under 50 decisions).
 */
export function buildHeadline(args: {
  hover: HoverStats;
  reversal: ReversalRate;
  fatigue: FatigueCurve;
}): string {
  const { hover, reversal, fatigue } = args;
  if (reversal.decisionsMade < 50) {
    return "not enough data yet — we surface patterns after ~50 decisions";
  }
  // Strong fatigue + revisits = cognitive overload.
  const fatigueObvious = fatigue.upwardTrend > 0.65 || fatigue.slope > 500;
  if (fatigueObvious && hover.revisitedAssets / Math.max(1, hover.assetsViewed) > 0.12) {
    return `decision time drifted up ${Math.round(fatigue.slope)}ms per 50 frames and ${hover.revisitedAssets} frames got revisited — classic fatigue signal, a break between batches would help`;
  }
  if (fatigueObvious) {
    return `decisions slowed ${Math.round(fatigue.slope)}ms per 50 frames during this session — consider splitting long culls in two`;
  }
  if (reversal.rate > 0.15) {
    return `you changed your mind ${reversal.reversals} times on ${reversal.decisionsMade} decisions — unusually high, this cohort may have too many near-duplicates`;
  }
  if (hover.p90DecisionMs > 10_000) {
    return `90% of decisions landed in under ${Math.round(hover.p90DecisionMs / 1000)}s — a few hard ones in the tail; AI burst-pick could cut these`;
  }
  return `${reversal.decisionsMade} decisions in this session, no fatigue or indecision patterns detected — clean run`;
}


/**
 * Combine all aggregators into the shape the API / dashboard expects.
 * Events should already be sorted by ``ms``; ``summarise`` guards
 * against unsorted input with a light sort pass.
 */
export function summariseEvents(
  events: ReadonlyArray<ErgonomicsEvent>,
): ErgonomicsSummary {
  const sortedAsc = [...events].sort((a, b) => a.ms - b.ms);
  const sessions = new Set<string>();
  for (const ev of sortedAsc) sessions.add(ev.sessionId);

  const hover = computeHoverStats(sortedAsc);
  const reversal = computeReversalRate(sortedAsc);
  const fatigue = computeFatigueCurve(sortedAsc);
  const headline = buildHeadline({ hover, reversal, fatigue });

  return {
    sessionsAnalysed: sessions.size,
    hover,
    reversal,
    fatigue,
    headline,
  };
}


// ─────────────── DB persistence ────────────────
// Self-bootstrapping table — matches the photo-enhancer feedback
// service pattern so deployments don't need a new migration cycle
// just to flip ergonomics telemetry on.

let tableReady = false;

async function ensureTables(pool: Pool): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ergonomics_events (
      id          bigserial PRIMARY KEY,
      user_id     varchar NOT NULL,
      session_id  varchar NOT NULL,
      kind        varchar NOT NULL,
      asset_id    varchar,
      action      varchar,
      previous_action varchar,
      new_action  varchar,
      first_view  boolean,
      ms          bigint  NOT NULL,
      sequence    integer NOT NULL,
      created_at  timestamp DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ergonomics_events_user_session_idx
       ON ergonomics_events (user_id, session_id, ms);`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ergonomics_reflect (
      id         bigserial PRIMARY KEY,
      user_id    varchar NOT NULL,
      session_id varchar NOT NULL,
      hardest    text,
      regretted  text,
      would_save text,
      submitted_at timestamp DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ergonomics_reflect_user_idx
       ON ergonomics_reflect (user_id, submitted_at DESC);`,
  );
  tableReady = true;
}

export async function ingestEventBatch(
  pool: Pool,
  userId: string,
  batch: ReadonlyArray<ErgonomicsEvent>,
): Promise<{ ingested: number }> {
  await ensureTables(pool);
  if (batch.length === 0) return { ingested: 0 };
  // We write all events in a single multi-row INSERT for latency —
  // large batches should fit comfortably under Postgres's parameter
  // cap (65k). Callers never send more than a few hundred at once.
  const values: unknown[] = [];
  const placeholders: string[] = [];
  for (const ev of batch) {
    const base = values.length;
    values.push(
      userId,
      ev.sessionId,
      ev.kind,
      ev.assetId ?? null,
      ev.action ?? null,
      ev.previousAction ?? null,
      ev.newAction ?? null,
      typeof ev.firstView === "boolean" ? ev.firstView : null,
      Math.floor(Number(ev.ms) || 0),
      Math.floor(Number(ev.sequence) || 0),
    );
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`,
    );
  }
  await pool.query(
    `INSERT INTO ergonomics_events
       (user_id, session_id, kind, asset_id, action, previous_action,
        new_action, first_view, ms, sequence)
     VALUES ${placeholders.join(", ")}`,
    values,
  );
  return { ingested: batch.length };
}

export async function ingestReflect(
  pool: Pool,
  userId: string,
  sessionId: string,
  answers: { hardest?: string; regretted?: string; wouldSave?: string },
): Promise<{ id: number }> {
  await ensureTables(pool);
  // Clip each answer at 2000 chars — telemetry entries shouldn't be
  // essays and an unbounded text field is a footgun.
  const clip = (v: string | undefined) =>
    typeof v === "string" ? v.slice(0, 2000) : null;
  const result = await pool.query<{ id: number }>(
    `INSERT INTO ergonomics_reflect (user_id, session_id, hardest, regretted, would_save)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, sessionId, clip(answers.hardest), clip(answers.regretted), clip(answers.wouldSave)],
  );
  return { id: result.rows[0]!.id };
}

/**
 * Compare a single session's stats against the photographer's own
 * baseline (everything else in the recent window). Produces short
 * human-readable headlines the UI can render as a post-session card.
 * Keeps comparisons conservative — we only mention a delta when it's
 * above a noise threshold so the card never says "2ms slower than
 * usual" (garbage signal).
 */
export function compareSessionToBaseline(
  session: ErgonomicsSummary,
  baseline: ErgonomicsSummary,
): { deltas: string[]; praise: string[]; signal: "rested" | "normal" | "drained" } {
  const deltas: string[] = [];
  const praise: string[] = [];

  // Median decision time — real photographer signal. 20% change is
  // the smallest move worth surfacing.
  if (
    baseline.hover.medianDecisionMs > 0 &&
    session.hover.medianDecisionMs > 0
  ) {
    const deltaMs = session.hover.medianDecisionMs - baseline.hover.medianDecisionMs;
    const deltaPct = deltaMs / baseline.hover.medianDecisionMs;
    if (deltaPct > 0.2) {
      const deltaSec = Math.round(deltaMs / 100) / 10;
      deltas.push(
        `median decision time ${deltaSec >= 1 ? `${deltaSec}s` : `${Math.round(deltaMs)}ms`} slower than your average`,
      );
    } else if (deltaPct < -0.2) {
      const deltaSec = Math.round(-deltaMs / 100) / 10;
      praise.push(
        `decisions ${deltaSec >= 1 ? `${deltaSec}s` : `${Math.round(-deltaMs)}ms`} faster than your average`,
      );
    }
  }

  // Revisit rate (fraction of viewed assets that got a second look).
  const revisitRate = (s: ErgonomicsSummary) =>
    s.hover.assetsViewed > 0 ? s.hover.revisitedAssets / s.hover.assetsViewed : 0;
  const sessionRevisit = revisitRate(session);
  const baselineRevisit = revisitRate(baseline);
  if (sessionRevisit - baselineRevisit > 0.05) {
    deltas.push(
      `revisited ${Math.round(sessionRevisit * 100)}% of frames vs your usual ${Math.round(baselineRevisit * 100)}%`,
    );
  }

  // Reversal rate — indecision spike.
  if (session.reversal.rate - baseline.reversal.rate > 0.05) {
    deltas.push(
      `changed your mind more than usual (${Math.round(session.reversal.rate * 100)}% vs ${Math.round(baseline.reversal.rate * 100)}%)`,
    );
  }

  // Overall signal: drained (multiple slower-than-usual indicators),
  // rested (multiple faster-than-usual), normal (mixed / small deltas).
  const signal: "rested" | "normal" | "drained" =
    deltas.length >= 2
      ? "drained"
      : praise.length >= 2
        ? "rested"
        : "normal";

  return { deltas, praise, signal };
}


export async function summariseSession(
  pool: Pool,
  userId: string,
  sessionId: string,
): Promise<ErgonomicsSummary> {
  await ensureTables(pool);
  const result = await pool
    .query<{
      session_id: string;
      kind: string;
      asset_id: string | null;
      action: string | null;
      previous_action: string | null;
      new_action: string | null;
      first_view: boolean | null;
      ms: string;
      sequence: number;
    }>(
      `SELECT session_id, kind, asset_id, action, previous_action,
              new_action, first_view, ms, sequence
         FROM ergonomics_events
        WHERE user_id = $1 AND session_id = $2
        ORDER BY ms ASC`,
      [userId, sessionId],
    )
    .catch(() => ({ rows: [] as any[] }));
  const events: ErgonomicsEvent[] = result.rows.map((r) => ({
    sessionId: r.session_id,
    kind: r.kind as ErgonomicsEventKind,
    assetId: r.asset_id,
    action: r.action,
    previousAction: r.previous_action,
    newAction: r.new_action,
    firstView: r.first_view ?? undefined,
    ms: Number(r.ms),
    sequence: r.sequence,
  }));
  return summariseEvents(events);
}


export async function summariseUserRecent(
  pool: Pool,
  userId: string,
  lookbackDays: number = 30,
  excludeSessionId?: string,
): Promise<ErgonomicsSummary> {
  await ensureTables(pool);
  const clampedDays = Math.max(1, Math.min(365, lookbackDays));
  const params: unknown[] = [userId, clampedDays];
  let where =
    `user_id = $1
      AND created_at > now() - ($2::integer || ' days')::interval`;
  if (excludeSessionId) {
    params.push(excludeSessionId);
    where += ` AND session_id <> $${params.length}`;
  }
  const result = await pool
    .query<{
      session_id: string;
      kind: string;
      asset_id: string | null;
      action: string | null;
      previous_action: string | null;
      new_action: string | null;
      first_view: boolean | null;
      ms: string;
      sequence: number;
    }>(
      `SELECT session_id, kind, asset_id, action, previous_action,
              new_action, first_view, ms, sequence
         FROM ergonomics_events
        WHERE ${where}
        ORDER BY ms ASC`,
      params,
    )
    .catch(() => ({ rows: [] as any[] }));
  const events: ErgonomicsEvent[] = result.rows.map((r) => ({
    sessionId: r.session_id,
    kind: r.kind as ErgonomicsEventKind,
    assetId: r.asset_id,
    action: r.action,
    previousAction: r.previous_action,
    newAction: r.new_action,
    firstView: r.first_view ?? undefined,
    ms: Number(r.ms),
    sequence: r.sequence,
  }));
  return summariseEvents(events);
}
