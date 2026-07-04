// =============================================================================
// Data-driven "best time to post" — pure, deterministic core.
//
// The content strategist currently emits an `optimalPostTime` that is an LLM
// best-practice GUESS ("post at 19:00"). This module replaces that guess with a
// recommendation derived from the account's OWN historical engagement: it
// buckets past posts into weekday × hour slots (in the brand's local timezone),
// ranks slots by mean engagement, and only reports a recommendation when there
// is enough data to trust it. When data is sparse it returns confident=false so
// the caller falls back to the LLM guess (never recommend "Thursday 19:30" from
// two posts).
//
// This file is intentionally free of DB / network deps so it is fully unit-
// testable. The DB adapter (role-room-best-time.ts) turns social_metrics rows
// into PostObservation[] and hands them here.
// =============================================================================

/** One historical post with its aggregate engagement, in real time. */
export interface PostObservation {
  platform: string;
  /** When the post went live (any timezone — bucketed via `timeZone` option). */
  publishedAt: Date;
  /** Aggregate engagement score for the post (see `scoreEngagement`). >= 0. */
  engagement: number;
}

export interface TimeSlotRecommendation {
  /** 0=Monday .. 6=Sunday (matches CarouselConcept.dayOfWeek). */
  dayOfWeek: number;
  /** 0..23, brand-local hour. */
  hour: number;
  /** "HH:MM" 24h, brand-local — drop-in for optimalPostTime. */
  optimalPostTime: string;
  /** How many historical posts landed in this slot. */
  sampleSize: number;
  meanEngagement: number;
  /** slotMean / overallMean — 1.35 means 35% above the account's average. */
  liftVsAverage: number;
  /** Human-facing Norwegian label, e.g. "torsdager 19:00". */
  label: string;
}

export interface BestTimeResult {
  platform: string;
  totalPosts: number;
  /** True only when there is enough data to trust the top recommendation. */
  confident: boolean;
  /** Ranked best→worst; empty when not confident. */
  recommendations: TimeSlotRecommendation[];
  overallMeanEngagement: number;
  /** Machine-stable reason code for telemetry / UI copy. */
  reason:
    | 'ok'
    | 'not_enough_posts'
    | 'no_slot_meets_min_samples'
    | 'no_observations';
}

export interface BestTimeOptions {
  /** IANA tz the brand posts in. Default Europe/Oslo (Norwegian customers). */
  timeZone?: string;
  /** Min total posts before ANY recommendation is trusted. Default 8. */
  minPostsForConfidence?: number;
  /** A slot needs at least this many posts to be recommendable. Default 2. */
  minSamplesPerSlot?: number;
  /** How many ranked slots to return. Default 3. */
  maxRecommendations?: number;
}

export interface EngagementWeights {
  view: number;
  impression: number;
  reach: number;
  like: number;
  comment: number;
  share: number;
  save: number;
}

/** Comments/shares/saves signal intent far more than a passive view, so they
 *  are weighted up; views/impressions are large but shallow, weighted down. */
export const DEFAULT_ENGAGEMENT_WEIGHTS: EngagementWeights = {
  view: 0.01,
  impression: 0.01,
  reach: 0.02,
  like: 1,
  comment: 2,
  share: 3,
  save: 3,
};

const NB_WEEKDAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const DEFAULT_TZ = 'Europe/Oslo';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

/**
 * Turn a platform metrics bag into a single engagement score. Tolerant of the
 * many aliases different platforms use for the same concept (likes vs
 * like_count vs reactions, etc.). Missing / non-finite values count as 0.
 */
export function scoreEngagement(
  metrics: Record<string, number | null | undefined>,
  weights: EngagementWeights = DEFAULT_ENGAGEMENT_WEIGHTS,
): number {
  const g = (...keys: string[]): number => {
    for (const k of keys) {
      const v = metrics[k];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    }
    return 0;
  };
  const like = g('likes', 'like', 'like_count', 'reactions', 'digg_count');
  const comment = g('comments', 'comment', 'comment_count');
  const share = g('shares', 'share', 'share_count');
  const save = g('saves', 'saved', 'save_count', 'bookmarks');
  const view = g('views', 'video_views', 'play_count', 'plays', 'video_view_count');
  const impression = g('impressions', 'post_impressions', 'impression');
  const reach = g('reach', 'post_reach');
  return (
    like * weights.like +
    comment * weights.comment +
    share * weights.share +
    save * weights.save +
    view * weights.view +
    impression * weights.impression +
    reach * weights.reach
  );
}

/**
 * Extract {dayOfWeek (0=Mon), hour (0-23)} for a Date in a given timezone.
 * Uses Intl so DST and offsets are handled correctly. Deterministic.
 */
export function extractLocalSlot(
  publishedAt: Date,
  timeZone: string = DEFAULT_TZ,
): { dayOfWeek: number; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(publishedAt);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Monday';
  const rawHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  // hour12:false yields '24' for midnight in some ICU builds — normalise.
  const hour = Number.isFinite(rawHour) ? rawHour % 24 : 0;
  return { dayOfWeek: WEEKDAY_TO_INDEX[weekday] ?? 0, hour };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a slot as brand-local "HH:MM" (posting on the hour). */
export function slotToPostTime(hour: number): string {
  return `${pad2(hour)}:00`;
}

/**
 * Compute the best posting slots for a single platform from historical posts.
 * Returns confident=false (with reason) when data is too sparse to trust.
 */
export function computeBestTimeForPlatform(
  platform: string,
  observations: PostObservation[],
  options: BestTimeOptions = {},
): BestTimeResult {
  const timeZone = options.timeZone ?? DEFAULT_TZ;
  const minPosts = options.minPostsForConfidence ?? 8;
  const minSamples = options.minSamplesPerSlot ?? 2;
  const maxRecs = options.maxRecommendations ?? 3;

  const valid = observations.filter(
    (o) =>
      o.publishedAt instanceof Date &&
      !Number.isNaN(o.publishedAt.getTime()) &&
      typeof o.engagement === 'number' &&
      Number.isFinite(o.engagement) &&
      o.engagement >= 0,
  );

  const totalPosts = valid.length;
  if (totalPosts === 0) {
    return {
      platform,
      totalPosts: 0,
      confident: false,
      recommendations: [],
      overallMeanEngagement: 0,
      reason: 'no_observations',
    };
  }

  const overallMean =
    valid.reduce((sum, o) => sum + o.engagement, 0) / totalPosts;

  // Bucket by weekday×hour.
  const buckets = new Map<string, { dayOfWeek: number; hour: number; total: number; count: number }>();
  for (const o of valid) {
    const { dayOfWeek, hour } = extractLocalSlot(o.publishedAt, timeZone);
    const key = `${dayOfWeek}:${hour}`;
    const b = buckets.get(key) ?? { dayOfWeek, hour, total: 0, count: 0 };
    b.total += o.engagement;
    b.count += 1;
    buckets.set(key, b);
  }

  const eligible = [...buckets.values()].filter((b) => b.count >= minSamples);

  const baseResult = {
    platform,
    totalPosts,
    overallMeanEngagement: overallMean,
  };

  if (totalPosts < minPosts) {
    return { ...baseResult, confident: false, recommendations: [], reason: 'not_enough_posts' };
  }
  if (eligible.length === 0) {
    return { ...baseResult, confident: false, recommendations: [], reason: 'no_slot_meets_min_samples' };
  }

  const recommendations: TimeSlotRecommendation[] = eligible
    .map((b) => {
      const meanEngagement = b.total / b.count;
      return {
        dayOfWeek: b.dayOfWeek,
        hour: b.hour,
        optimalPostTime: slotToPostTime(b.hour),
        sampleSize: b.count,
        meanEngagement,
        liftVsAverage: overallMean > 0 ? meanEngagement / overallMean : 1,
        label: `${NB_WEEKDAYS[b.dayOfWeek]}er ${slotToPostTime(b.hour)}`,
      };
    })
    .sort((a, b) =>
      b.meanEngagement - a.meanEngagement ||
      b.sampleSize - a.sampleSize ||
      a.dayOfWeek - b.dayOfWeek ||
      a.hour - b.hour,
    )
    .slice(0, maxRecs);

  return { ...baseResult, confident: true, recommendations, reason: 'ok' };
}

/**
 * Group mixed-platform observations by platform and compute each independently
 * (audiences behave differently per platform).
 */
export function computeBestTimesByPlatform(
  observations: PostObservation[],
  options: BestTimeOptions = {},
): BestTimeResult[] {
  const byPlatform = new Map<string, PostObservation[]>();
  for (const o of observations) {
    const list = byPlatform.get(o.platform) ?? [];
    list.push(o);
    byPlatform.set(o.platform, list);
  }
  return [...byPlatform.entries()]
    .map(([platform, obs]) => computeBestTimeForPlatform(platform, obs, options))
    .sort((a, b) => b.totalPosts - a.totalPosts || a.platform.localeCompare(b.platform));
}

/**
 * The integration hook: return the data-derived "HH:MM" for the top slot, or
 * null when not confident (caller keeps the LLM guess).
 */
export function pickOptimalPostTime(result: BestTimeResult | null | undefined): string | null {
  if (!result || !result.confident || result.recommendations.length === 0) return null;
  return result.recommendations[0].optimalPostTime;
}

export interface PostTimeOverride {
  platform: string;
  optimalPostTime: string;
  sampleSize: number;
  liftVsAverage: number;
  label: string;
}

/** Find the confident top-slot recommendation for a platform, or null. */
export function optimalPostTimeForPlatform(
  results: BestTimeResult[],
  platform: string,
): PostTimeOverride | null {
  const r = results.find((x) => x.platform === platform && x.confident);
  if (!r || r.recommendations.length === 0) return null;
  const top = r.recommendations[0];
  return {
    platform,
    optimalPostTime: top.optimalPostTime,
    sampleSize: top.sampleSize,
    liftVsAverage: top.liftVsAverage,
    label: top.label,
  };
}

/**
 * Replace each concept's LLM-guessed `optimalPostTime` with the data-derived
 * time for its platform, when a confident recommendation exists. Structurally
 * typed so it works on CarouselConcept[] without importing the strategist.
 * Returns new concepts plus the count of concepts backed by real data.
 */
export function applyDataDrivenPostTimes<
  T extends { primaryPlatform: string; optimalPostTime: string },
>(concepts: T[], results: BestTimeResult[]): { concepts: T[]; dataBackedCount: number } {
  let dataBackedCount = 0;
  const out = concepts.map((c) => {
    const override = optimalPostTimeForPlatform(results, c.primaryPlatform);
    if (!override) return c;
    dataBackedCount += 1;
    return override.optimalPostTime === c.optimalPostTime
      ? c
      : { ...c, optimalPostTime: override.optimalPostTime };
  });
  return { concepts: out, dataBackedCount };
}
