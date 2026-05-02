/**
 * Agent feedback-loop: leser nylige social_events + social_metrics og
 * destillerer dem til strategiske insights som agent bruker når den
 * re-genererer markedsplan og feed-posts.
 *
 * Dette lukker Brandwatch-loopen:
 *   Listen + Measure → Insights → Plan (next iteration)
 *
 * Output-formatet er bevisst kompakt (max ~30 linjer prose) for at det
 * skal være billig å feed-e inn i Claude-prompts uten å sprenge context.
 */

import type { Pool } from 'pg';

export interface AgentFeedbackInsights {
  /** Antall events siste 30d på tvers av plattformer. */
  totalEvents30d: number;
  /** Net sentiment: positive minus negative som andel av total. -1..1. */
  netSentiment30d: number;
  /** Andel events i hver sentiment-kategori (0-1). */
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  /** Top 3 plattformer ranket etter inbound-volum. */
  topPlatforms: Array<{ platform: string; events: number }>;
  /** Top 5 posts ranket etter reach/impressions siste 30d. */
  topPosts: Array<{
    platform: string;
    externalPostId: string;
    metric: string;
    value: number;
  }>;
  /** Engagement-trender: average reach per post siste 30d, og delta vs forrige 30d. */
  reachTrend: {
    last30dAvg: number | null;
    prev30dAvg: number | null;
    deltaPct: number | null;
  };
  /** Sentiment-flagg: er det signifikant negativ trend som krever handling? */
  flags: string[];
  /**
   * Agent-promptable summary i prose-form. Bruker mønsteret
   * "Last 30 days: X events, Y% positive. Top concerns: …"
   */
  promptSummary: string;
  generatedAt: string;
}

/** Bruker-scoped insights — kun events/metrics for kontoer brukeren eier. */
export async function buildAgentFeedbackInsights(
  pool: Pool,
  userId: string,
): Promise<AgentFeedbackInsights | null> {
  const scopeSql = `(
    SELECT ig_business_account_id AS account_id FROM role_room_instagram_connections WHERE user_id = $1
    UNION
    SELECT facebook_page_id FROM role_room_instagram_connections
     WHERE user_id = $1 AND facebook_page_id IS NOT NULL
  )`;

  try {
    const [
      totalRow,
      sentimentRows,
      platformRows,
      topPostsRows,
      reachLast30,
      reachPrev30,
    ] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM social_events
          WHERE account_id IN ${scopeSql}
            AND received_at >= now() - interval '30 days'`,
        [userId],
      ),
      pool.query<{ sentiment_label: string; count: string }>(
        `SELECT sentiment_label, count(*)::text AS count
           FROM social_events
          WHERE account_id IN ${scopeSql}
            AND received_at >= now() - interval '30 days'
            AND sentiment_label IS NOT NULL
          GROUP BY sentiment_label`,
        [userId],
      ),
      pool.query<{ platform: string; count: string }>(
        `SELECT platform, count(*)::text AS count
           FROM social_events
          WHERE account_id IN ${scopeSql}
            AND received_at >= now() - interval '30 days'
          GROUP BY platform
          ORDER BY count(*) DESC
          LIMIT 5`,
        [userId],
      ),
      pool.query<{
        platform: string;
        external_post_id: string;
        metric_name: string;
        metric_value: string;
      }>(
        `SELECT DISTINCT ON (platform, external_post_id)
                platform, external_post_id, metric_name, metric_value
           FROM social_metrics
          WHERE account_id IN ${scopeSql}
            AND scope IN ('post', 'reel', 'video')
            AND external_post_id IS NOT NULL
            AND recorded_at >= now() - interval '30 days'
            AND metric_name IN ('reach', 'impressions', 'post_impressions', 'post_impressions_unique')
          ORDER BY platform, external_post_id, recorded_at DESC, metric_value::numeric DESC
          LIMIT 5`,
        [userId],
      ),
      pool.query<{ avg_reach: string | null; n: string }>(
        `SELECT avg(metric_value)::text AS avg_reach, count(*)::text AS n
           FROM social_metrics
          WHERE account_id IN ${scopeSql}
            AND scope IN ('post', 'reel', 'video')
            AND metric_name IN ('reach', 'impressions', 'post_impressions_unique')
            AND recorded_at >= now() - interval '30 days'`,
        [userId],
      ),
      pool.query<{ avg_reach: string | null; n: string }>(
        `SELECT avg(metric_value)::text AS avg_reach, count(*)::text AS n
           FROM social_metrics
          WHERE account_id IN ${scopeSql}
            AND scope IN ('post', 'reel', 'video')
            AND metric_name IN ('reach', 'impressions', 'post_impressions_unique')
            AND recorded_at >= now() - interval '60 days'
            AND recorded_at <  now() - interval '30 days'`,
        [userId],
      ),
    ]);

    const totalEvents30d = Number(totalRow.rows[0]?.count ?? 0);

    // Sentiment-distribusjon
    const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    let totalScored = 0;
    for (const row of sentimentRows.rows) {
      const n = Number(row.count);
      totalScored += n;
      if (row.sentiment_label === 'positive') counts.positive = n;
      else if (row.sentiment_label === 'negative') counts.negative = n;
      else if (row.sentiment_label === 'neutral') counts.neutral = n;
      else if (row.sentiment_label === 'mixed') counts.mixed = n;
    }
    const sentimentDistribution =
      totalScored > 0
        ? {
            positive: counts.positive / totalScored,
            neutral: counts.neutral / totalScored,
            negative: counts.negative / totalScored,
            mixed: counts.mixed / totalScored,
          }
        : { positive: 0, neutral: 0, negative: 0, mixed: 0 };

    const netSentiment30d =
      totalScored > 0 ? (counts.positive - counts.negative) / totalScored : 0;

    // Top platforms
    const topPlatforms = platformRows.rows.slice(0, 3).map((r) => ({
      platform: r.platform,
      events: Number(r.count),
    }));

    // Top posts
    const topPosts = topPostsRows.rows.map((r) => ({
      platform: r.platform,
      externalPostId: r.external_post_id,
      metric: r.metric_name,
      value: Number(r.metric_value),
    }));

    // Reach-trend
    const last30Avg =
      reachLast30.rows[0]?.avg_reach != null
        ? Number(reachLast30.rows[0].avg_reach)
        : null;
    const prev30Avg =
      reachPrev30.rows[0]?.avg_reach != null
        ? Number(reachPrev30.rows[0].avg_reach)
        : null;
    const deltaPct =
      last30Avg != null && prev30Avg != null && prev30Avg > 0
        ? ((last30Avg - prev30Avg) / prev30Avg) * 100
        : null;

    // Flags — sentiment-baserte og volume-baserte signaler
    const flags: string[] = [];
    if (netSentiment30d <= -0.3 && totalScored >= 5) {
      flags.push(
        `Net sentiment er ${(netSentiment30d * 100).toFixed(0)}% — overveiende negativ tilbakemelding. Vurder å revidere tone eller content pillars.`,
      );
    }
    if (sentimentDistribution.negative >= 0.4 && totalScored >= 5) {
      flags.push(
        `${(sentimentDistribution.negative * 100).toFixed(0)}% av kommentarer er negative. Sjekk Inbox for tilbakevendende klager.`,
      );
    }
    if (deltaPct != null && deltaPct <= -25) {
      flags.push(
        `Reach er ned ${Math.abs(Math.round(deltaPct))}% sammenlignet med forrige 30d. Algoritme-endring eller timing-issue?`,
      );
    }
    if (deltaPct != null && deltaPct >= 50) {
      flags.push(
        `Reach er opp ${Math.round(deltaPct)}% sammenlignet med forrige 30d. Doble ned på det som virker — analyser top-posts og rebuild pillars rundt det.`,
      );
    }
    if (totalEvents30d === 0) {
      flags.push(
        'Ingen inbound events siste 30d. Enten er ingen kommentarer kommet, eller webhooks er ikke aktive — sjekk Health-endepunktet.',
      );
    }

    // Prose-summary for agent-prompts
    const summaryParts: string[] = [];
    summaryParts.push(`Last 30 days: ${totalEvents30d} inbound events.`);
    if (totalScored > 0) {
      summaryParts.push(
        `Sentiment: ${(sentimentDistribution.positive * 100).toFixed(0)}% positive, ` +
          `${(sentimentDistribution.neutral * 100).toFixed(0)}% neutral, ` +
          `${(sentimentDistribution.negative * 100).toFixed(0)}% negative.`,
      );
    }
    if (topPlatforms.length > 0) {
      summaryParts.push(
        `Top platforms by volume: ` +
          topPlatforms.map((p) => `${p.platform} (${p.events})`).join(', ') +
          '.',
      );
    }
    if (last30Avg != null) {
      summaryParts.push(
        `Avg reach per post: ${Math.round(last30Avg).toLocaleString('en-US')}` +
          (deltaPct != null ? ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}% vs prior 30d).` : '.'),
      );
    }
    if (topPosts.length > 0) {
      summaryParts.push(
        `Top posts: ` +
          topPosts
            .slice(0, 3)
            .map((p) => `${p.platform}/${p.externalPostId.slice(0, 12)} (${p.metric}=${Math.round(p.value)})`)
            .join('; ') +
          '.',
      );
    }
    if (flags.length > 0) {
      summaryParts.push(`FLAGS: ${flags.join(' ')}`);
    }
    const promptSummary = summaryParts.join(' ');

    return {
      totalEvents30d,
      netSentiment30d,
      sentimentDistribution,
      topPlatforms,
      topPosts,
      reachTrend: {
        last30dAvg: last30Avg,
        prev30dAvg: prev30Avg,
        deltaPct,
      },
      flags,
      promptSummary,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[agent-feedback] buildAgentFeedbackInsights failed', error);
    return null;
  }
}
