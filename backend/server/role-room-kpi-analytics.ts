/**
 * KPI-analytics — aggregering (#184-#187), outliers (#189), auto-
 * korrigeringsforslag (#183). Pure functions, ingen DB-tilgang her —
 * routes laster snapshots og passer dem hit.
 */

import type { PersistedKpiSnapshot } from "./role-room-kpi-tracking.js";

// ─────────────────────────────────────────────────────────────────────
// Aggregering — items #184 + #185 + #186 + #187
// ─────────────────────────────────────────────────────────────────────

export interface KpiAggregateBucket {
  /** Grupperingsverdi: pillarId, platform-streng, format-streng, eller time-window-label. */
  key: string;
  /** Friendly label til UI. */
  label: string;
  /** Antall posts i bøtten. */
  postCount: number;
  /** Antall snapshots i bøtten. */
  snapshotCount: number;
  /** Summen av value for hver metric. */
  sumByMetric: Record<string, number>;
  /** Snitt per metric (sum / snapshotCount). */
  avgByMetric: Record<string, number>;
}

interface PostMeta {
  id: string;
  pillarId: string | null;
  pillarName: string | null;
  primaryPlatform: string | null;
  format: string;
  scheduledFor: string | null;
}

/** Hovedaggregeringsfunksjon. Tar snapshots + post-metadata og en
 *  grouping-funksjon som returnerer { key, label } per post. */
function aggregate(
  snapshots: PersistedKpiSnapshot[],
  posts: PostMeta[],
  grouper: (post: PostMeta) => { key: string; label: string } | null,
): KpiAggregateBucket[] {
  const postById = new Map(posts.map((p) => [p.id, p]));
  const buckets = new Map<string, {
    label: string;
    postIds: Set<string>;
    snapshotCount: number;
    sumByMetric: Map<string, number>;
  }>();

  for (const snap of snapshots) {
    const post = postById.get(snap.postId);
    if (!post) continue;
    const group = grouper(post);
    if (!group) continue;

    let bucket = buckets.get(group.key);
    if (!bucket) {
      bucket = {
        label: group.label,
        postIds: new Set(),
        snapshotCount: 0,
        sumByMetric: new Map(),
      };
      buckets.set(group.key, bucket);
    }
    bucket.postIds.add(snap.postId);
    bucket.snapshotCount++;
    bucket.sumByMetric.set(snap.metric, (bucket.sumByMetric.get(snap.metric) ?? 0) + snap.value);
  }

  return Array.from(buckets.entries()).map(([key, b]) => {
    const sumByMetric: Record<string, number> = {};
    const avgByMetric: Record<string, number> = {};
    for (const [metric, sum] of b.sumByMetric) {
      sumByMetric[metric] = Math.round(sum * 100) / 100;
      avgByMetric[metric] = Math.round((sum / b.snapshotCount) * 100) / 100;
    }
    return {
      key,
      label: b.label,
      postCount: b.postIds.size,
      snapshotCount: b.snapshotCount,
      sumByMetric,
      avgByMetric,
    };
  }).sort((a, b) => b.postCount - a.postCount);
}

export const aggregateByPillar = (s: PersistedKpiSnapshot[], p: PostMeta[]): KpiAggregateBucket[] =>
  aggregate(s, p, (post) => post.pillarId
    ? { key: post.pillarId, label: post.pillarName ?? post.pillarId }
    : null);

export const aggregateByPlatform = (s: PersistedKpiSnapshot[], p: PostMeta[]): KpiAggregateBucket[] =>
  aggregate(s, p, (post) => post.primaryPlatform
    ? { key: post.primaryPlatform, label: post.primaryPlatform }
    : null);

export const aggregateByFormat = (s: PersistedKpiSnapshot[], p: PostMeta[]): KpiAggregateBucket[] =>
  aggregate(s, p, (post) => post.format
    ? { key: post.format, label: post.format.replace(/_/g, ' ') }
    : null);

/** Time-window: grupper på hverdag-vs-helg + tid-på-dagen (morning/midday/evening). */
export const aggregateByTimeWindow = (s: PersistedKpiSnapshot[], p: PostMeta[]): KpiAggregateBucket[] =>
  aggregate(s, p, (post) => {
    if (!post.scheduledFor) return null;
    const d = new Date(post.scheduledFor);
    const dayKind = (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? "helg" : "hverdag";
    const hour = d.getUTCHours();
    const slot = hour < 11 ? "morgen" : hour < 16 ? "midt-på-dagen" : "kveld";
    const key = `${dayKind}_${slot}`;
    return { key, label: `${dayKind} ${slot}` };
  });

// ─────────────────────────────────────────────────────────────────────
// Outlier-deteksjon — item #189
// Bruker z-score mot pillar-mean. Score >2σ = winner, <-2σ = concern.
// ─────────────────────────────────────────────────────────────────────

export interface OutlierFlag {
  postId: string;
  pillarId: string | null;
  metric: string;
  postValue: number;
  pillarMean: number;
  pillarStdDev: number;
  zScore: number;
  kind: "winner" | "concern";
  recommendation: string;
}

export function detectOutliers(
  snapshots: PersistedKpiSnapshot[],
  posts: PostMeta[],
  primaryMetric = "impressions",
): OutlierFlag[] {
  const postById = new Map(posts.map((p) => [p.id, p]));

  // Bygg per-post-aggregert metric-verdi (siste snapshot per post for valgt metric)
  const postValues = new Map<string, number>();
  for (const snap of snapshots) {
    if (snap.metric !== primaryMetric) continue;
    const existing = postValues.get(snap.postId);
    if (!existing || new Date(snap.capturedAt) > new Date(existing.toString())) {
      postValues.set(snap.postId, snap.value);
    }
  }

  // Grupper per pillar og beregn mean/stddev
  const pillarStats = new Map<string, { mean: number; stdDev: number; values: number[] }>();
  for (const [postId, value] of postValues) {
    const post = postById.get(postId);
    const pillarKey = post?.pillarId ?? "no_pillar";
    let stat = pillarStats.get(pillarKey);
    if (!stat) {
      stat = { mean: 0, stdDev: 0, values: [] };
      pillarStats.set(pillarKey, stat);
    }
    stat.values.push(value);
  }
  for (const stat of pillarStats.values()) {
    if (stat.values.length === 0) continue;
    const sum = stat.values.reduce((a, b) => a + b, 0);
    stat.mean = sum / stat.values.length;
    if (stat.values.length < 2) {
      stat.stdDev = 0;
    } else {
      const variance = stat.values.reduce((acc, v) => acc + (v - stat.mean) ** 2, 0) / stat.values.length;
      stat.stdDev = Math.sqrt(variance);
    }
  }

  // Flag posts med |z-score| > 2
  const flags: OutlierFlag[] = [];
  for (const [postId, value] of postValues) {
    const post = postById.get(postId);
    const pillarKey = post?.pillarId ?? "no_pillar";
    const stat = pillarStats.get(pillarKey);
    if (!stat || stat.stdDev === 0) continue;
    const zScore = (value - stat.mean) / stat.stdDev;
    if (Math.abs(zScore) < 2) continue;
    const kind: OutlierFlag["kind"] = zScore > 0 ? "winner" : "concern";
    const recommendation = kind === "winner"
      ? `Denne posten leverer ${(value / stat.mean).toFixed(1)}× over pillar-snitt på ${primaryMetric}. Lag flere lignende — samme hook-vinkel, samme format.`
      : `Posten leverer ${((stat.mean - value) / stat.mean * 100).toFixed(0)}% under pillar-snitt på ${primaryMetric}. Vurder å re-formatere eller archive den.`;
    flags.push({
      postId,
      pillarId: post?.pillarId ?? null,
      metric: primaryMetric,
      postValue: Math.round(value * 100) / 100,
      pillarMean: Math.round(stat.mean * 100) / 100,
      pillarStdDev: Math.round(stat.stdDev * 100) / 100,
      zScore: Math.round(zScore * 100) / 100,
      kind,
      recommendation,
    });
  }
  return flags.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

// ─────────────────────────────────────────────────────────────────────
// Auto-korrigeringsforslag — item #183
// Rules-engine basert på KPI vs targets.
// ─────────────────────────────────────────────────────────────────────

export interface CorrectionSuggestion {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  actionHint: string;
}

interface KpiTarget {
  metric: string;
  target: number;
  per: "post" | "week" | "month" | "quarter";
}

export function suggestCorrections(input: {
  pillarAggregates: KpiAggregateBucket[];
  platformAggregates: KpiAggregateBucket[];
  formatAggregates: KpiAggregateBucket[];
  targets: KpiTarget[];
  totalSnapshotCount: number;
}): CorrectionSuggestion[] {
  const out: CorrectionSuggestion[] = [];

  // 1. Per-target underperformance
  for (const target of input.targets) {
    // Beregn aktuelt snitt på metric — vi tar platform-aggregat-snittet
    const relevant = input.platformAggregates
      .map((b) => b.avgByMetric[target.metric])
      .filter((v): v is number => typeof v === "number");
    if (relevant.length === 0) continue;
    const overallAvg = relevant.reduce((a, b) => a + b, 0) / relevant.length;
    if (overallAvg === 0) continue;
    const ratioToTarget = overallAvg / target.target;
    if (ratioToTarget < 0.5) {
      out.push({
        id: `target_severe_under_${target.metric}`,
        severity: "critical",
        title: `${target.metric}-mål er ${Math.round(ratioToTarget * 100)}% av target`,
        detail: `Snitt ${Math.round(overallAvg)} vs target ${target.target} per ${target.per}. Konsekvent under halvparten — fundamental endring i strategi vurderes.`,
        actionHint: "Re-vurder pillars + frekvens i en regenerering",
      });
    } else if (ratioToTarget < 0.8) {
      out.push({
        id: `target_under_${target.metric}`,
        severity: "warning",
        title: `${target.metric} ligger under target`,
        detail: `Snitt ${Math.round(overallAvg)} vs target ${target.target} per ${target.per}.`,
        actionHint: "Øk frekvens 25% eller endre primary platform",
      });
    } else if (ratioToTarget > 1.5) {
      out.push({
        id: `target_over_${target.metric}`,
        severity: "info",
        title: `${target.metric} ligger over target`,
        detail: `Snitt ${Math.round(overallAvg)} vs target ${target.target}. Sett mer ambisiøst neste plan.`,
        actionHint: "Juster target-tall opp i neste plan-regenerering",
      });
    }
  }

  // 2. Pillar-ubalanse — én pillar med 3× over andre
  if (input.pillarAggregates.length >= 2) {
    const primaryMetric = input.targets[0]?.metric ?? "impressions";
    const pillarPerf = input.pillarAggregates
      .map((b) => ({ name: b.label, avg: b.avgByMetric[primaryMetric] ?? 0 }))
      .filter((p) => p.avg > 0)
      .sort((a, b) => b.avg - a.avg);
    if (pillarPerf.length >= 2 && pillarPerf[0].avg > pillarPerf[pillarPerf.length - 1].avg * 3) {
      out.push({
        id: "pillar_imbalance",
        severity: "info",
        title: `Pillar-ubalanse: "${pillarPerf[0].name}" leverer 3× over "${pillarPerf[pillarPerf.length - 1].name}"`,
        detail: `Top-pillar: ${Math.round(pillarPerf[0].avg)} snitt — bunn-pillar: ${Math.round(pillarPerf[pillarPerf.length - 1].avg)} snitt på ${primaryMetric}.`,
        actionHint: `Vurder å skru ned eller redesign'e "${pillarPerf[pillarPerf.length - 1].name}"`,
      });
    }
  }

  // 3. Format-vinner
  if (input.formatAggregates.length >= 2) {
    const primaryMetric = input.targets[0]?.metric ?? "impressions";
    const formatPerf = input.formatAggregates
      .map((b) => ({ name: b.label, avg: b.avgByMetric[primaryMetric] ?? 0 }))
      .filter((p) => p.avg > 0)
      .sort((a, b) => b.avg - a.avg);
    if (formatPerf.length >= 2 && formatPerf[0].avg > formatPerf[1].avg * 2) {
      out.push({
        id: "format_winner",
        severity: "info",
        title: `Format-vinner: ${formatPerf[0].name} dominerer`,
        detail: `${formatPerf[0].name} har 2× høyere snitt enn ${formatPerf[1].name} på ${primaryMetric}.`,
        actionHint: `Vri planen mot flere ${formatPerf[0].name}`,
      });
    }
  }

  // 4. Datatetthet — for få snapshots
  if (input.totalSnapshotCount < 10) {
    out.push({
      id: "insufficient_data",
      severity: "info",
      title: "For lite data for sterke konklusjoner",
      detail: `${input.totalSnapshotCount} snapshots totalt. Vent til 14+ dager med data før du gjør store strategijusteringer.`,
      actionHint: "Sett oppmerksomhet på trender, ikke individuelle posts",
    });
  }

  return out;
}
