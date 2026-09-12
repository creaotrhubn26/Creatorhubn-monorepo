// =============================================================================
// Proactive client update — pure digest builder.
//
// Role Room today is strong on client *approval* but weak on proactively
// telling the client "here's what we published and how it's doing". This turns
// the raw signals a producer already has (published posts, engagement, the
// data-driven best-time insight, what's scheduled next) into a clean, human
// summary that renders identically in the client-update email and the client
// portal timeline.
//
// Pure + dependency-free so it is fully unit-testable. The route adapter feeds
// it real data; this file just shapes it.
// =============================================================================

import type { BestTimeResult } from './role-room-best-time-to-post.js';

export interface DigestPost {
  platform: string;
  hook: string;
  publishedAt: Date;
  /** Aggregate engagement (from scoreEngagement); optional. */
  engagement?: number;
}

export interface ClientUpdateDigestInput {
  /** e.g. "uke 27" or "1.–7. juli". Shown in the headline. */
  periodLabel: string;
  brandName?: string;
  publishedPosts: DigestPost[];
  scheduledCount: number;
  daysRemaining?: number | null;
  /** Per-platform best-time results (data-driven). */
  bestTimes?: BestTimeResult[];
  /** Free-form note the producer typed. Trimmed; empty → null. */
  producerNote?: string | null;
}

export interface DigestHighlight {
  key: string;
  label: string;
  value: string;
}

export interface ClientUpdateDigest {
  headline: string;
  publishedCount: number;
  scheduledCount: number;
  daysRemaining: number | null;
  topPost: { platform: string; hook: string; engagement: number } | null;
  /** e.g. "Innleggene dine presterer best torsdager 19:00 (34% over snittet)." */
  bestTimeTip: string | null;
  highlights: DigestHighlight[];
  producerNote: string | null;
  /** True when there's nothing meaningful to report (no publishes, nothing
   *  scheduled, no note) — the UI should discourage sending an empty update. */
  isEmpty: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
  x: 'X',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** Pick the most convincing best-time tip across platforms (highest lift, and
 *  only from confident results). Returns null when no platform is confident. */
function buildBestTimeTip(bestTimes: BestTimeResult[] | undefined): string | null {
  if (!bestTimes || bestTimes.length === 0) return null;
  let best: { platform: string; label: string; lift: number } | null = null;
  for (const r of bestTimes) {
    if (!r.confident || r.recommendations.length === 0) continue;
    const top = r.recommendations[0];
    if (!best || top.liftVsAverage > best.lift) {
      best = { platform: r.platform, label: top.label, lift: top.liftVsAverage };
    }
  }
  if (!best) return null;
  const pct = Math.round((best.lift - 1) * 100);
  const liftClause = pct > 0 ? ` (${pct}% over snittet)` : '';
  return `På ${platformLabel(best.platform)} presterer innleggene best ${best.label}${liftClause}.`;
}

export function buildClientUpdateDigest(input: ClientUpdateDigestInput): ClientUpdateDigest {
  const published = input.publishedPosts.filter(
    (p) => p.publishedAt instanceof Date && !Number.isNaN(p.publishedAt.getTime()),
  );
  const publishedCount = published.length;

  const topPost = published.reduce<ClientUpdateDigest['topPost']>((best, p) => {
    const eng = typeof p.engagement === 'number' && Number.isFinite(p.engagement) ? p.engagement : 0;
    if (eng <= 0) return best;
    if (!best || eng > best.engagement) return { platform: p.platform, hook: p.hook, engagement: eng };
    return best;
  }, null);

  const bestTimeTip = buildBestTimeTip(input.bestTimes);
  const daysRemaining =
    typeof input.daysRemaining === 'number' && input.daysRemaining >= 0 ? input.daysRemaining : null;
  const note = input.producerNote?.trim() ? input.producerNote.trim() : null;

  const highlights: DigestHighlight[] = [];
  highlights.push({
    key: 'published',
    label: 'Publisert denne perioden',
    value: publishedCount === 1 ? '1 innlegg' : `${publishedCount} innlegg`,
  });
  if (input.scheduledCount > 0) {
    highlights.push({
      key: 'scheduled',
      label: 'Planlagt fremover',
      value: input.scheduledCount === 1 ? '1 innlegg' : `${input.scheduledCount} innlegg`,
    });
  }
  if (topPost) {
    highlights.push({
      key: 'top_post',
      label: 'Beste innlegg',
      value: `${platformLabel(topPost.platform)} — «${topPost.hook}»`,
    });
  }
  if (bestTimeTip) {
    highlights.push({ key: 'best_time', label: 'Beste tidspunkt', value: bestTimeTip });
  }

  const brand = input.brandName?.trim();
  const headline = brand
    ? `Markedsoppdatering for ${brand} — ${input.periodLabel}`
    : `Markedsoppdatering — ${input.periodLabel}`;

  const isEmpty = publishedCount === 0 && input.scheduledCount === 0 && !note && !bestTimeTip;

  return {
    headline,
    publishedCount,
    scheduledCount: input.scheduledCount,
    daysRemaining,
    topPost,
    bestTimeTip,
    highlights,
    producerNote: note,
    isEmpty,
  };
}
