// =============================================================================
// Marketing "channel scorecard" (#3) — recommended setup vs measured reality.
//
// Merges the deterministic marketing-setup (F9: recommended channels, in
// priority order) with the ACTUAL per-platform KPI performance
// (aggregateByPlatform) so the cockpit can show, per channel:
//   - is this recommended channel actually being used + measured? (active/no_data)
//   - and which platforms have measured performance but were NOT recommended
//     (surprise winners worth adding to the setup).
//
// Pure, dependency-free — the route loads setup + KPI aggregates and passes them
// here. Same fuzzy channel↔platform matching as buildMarketingSetup's reorder.
// =============================================================================

export interface ScorecardChannel {
  name: string;
  priority?: string | null;
}

/** Structural subset of KpiAggregateBucket (role-room-kpi-analytics.ts). */
export interface ScorecardPlatformAggregate {
  key: string; // platform key, e.g. 'instagram'
  label: string;
  postCount: number;
  snapshotCount: number;
  avgByMetric: Record<string, number>;
}

export interface ChannelScorecardEntry {
  channel: string;
  recommendedPriority: string | null;
  status: "active" | "no_data";
  postCount: number;
  snapshotCount: number;
  /** Average per metric from the matched platform bucket (empty when no data). */
  metrics: Record<string, number>;
}

export interface UnexpectedChannelEntry {
  /** Platform that HAS measured performance but wasn't in the recommended setup. */
  platform: string;
  label: string;
  postCount: number;
  snapshotCount: number;
  metrics: Record<string, number>;
}

export interface ChannelScorecard {
  channels: ChannelScorecardEntry[];
  unexpected: UnexpectedChannelEntry[];
  recommendedWithData: number;
  recommendedWithoutData: number;
  /** True when there is no measured KPI data at all yet (fresh project). */
  hasAnyData: boolean;
}

function norm(value: string): string {
  return value.toLowerCase().trim();
}

/** Fuzzy match a platform key against a channel display name — same rule as
 *  buildMarketingSetup's reorder ("google" ↔ "Google Business Profile / Maps"). */
function matchesChannel(platformKey: string, channelName: string): boolean {
  const p = norm(platformKey);
  const name = norm(channelName);
  if (!p || !name) return false;
  if (name.includes(p)) return true;
  const firstWord = name.split(/[\s/]+/)[0] ?? "";
  return firstWord.length >= 3 && p.includes(firstWord);
}

/**
 * Build the channel scorecard. Recommended channels keep their setup order;
 * each is matched to a platform aggregate (fuzzy). Unmatched aggregates become
 * "unexpected" winners. A platform bucket is used for at most one channel.
 */
export function buildChannelScorecard(
  recommendedChannels: readonly ScorecardChannel[],
  platformAggregates: readonly ScorecardPlatformAggregate[],
): ChannelScorecard {
  const usedAggregate = new Set<number>();
  const channels: ChannelScorecardEntry[] = [];

  for (const channel of recommendedChannels) {
    if (!channel || typeof channel.name !== "string" || channel.name.trim() === "") continue;
    let matchIndex = -1;
    for (let i = 0; i < platformAggregates.length; i++) {
      if (usedAggregate.has(i)) continue;
      if (matchesChannel(platformAggregates[i].key, channel.name)) {
        matchIndex = i;
        break;
      }
    }
    if (matchIndex >= 0) {
      usedAggregate.add(matchIndex);
      const agg = platformAggregates[matchIndex];
      channels.push({
        channel: channel.name,
        recommendedPriority: channel.priority ?? null,
        status: "active",
        postCount: agg.postCount,
        snapshotCount: agg.snapshotCount,
        metrics: agg.avgByMetric ?? {},
      });
    } else {
      channels.push({
        channel: channel.name,
        recommendedPriority: channel.priority ?? null,
        status: "no_data",
        postCount: 0,
        snapshotCount: 0,
        metrics: {},
      });
    }
  }

  const unexpected: UnexpectedChannelEntry[] = [];
  for (let i = 0; i < platformAggregates.length; i++) {
    if (usedAggregate.has(i)) continue;
    const agg = platformAggregates[i];
    unexpected.push({
      platform: agg.key,
      label: agg.label,
      postCount: agg.postCount,
      snapshotCount: agg.snapshotCount,
      metrics: agg.avgByMetric ?? {},
    });
  }

  const recommendedWithData = channels.filter((c) => c.status === "active").length;
  return {
    channels,
    unexpected,
    recommendedWithData,
    recommendedWithoutData: channels.length - recommendedWithData,
    hasAnyData: platformAggregates.some((a) => a.snapshotCount > 0),
  };
}
