import { describe, expect, it } from 'vitest';
import {
  buildChannelScorecard,
  type ScorecardPlatformAggregate,
} from './role-room-marketing-scorecard.js';

const recommended = [
  { name: 'Instagram', priority: 'primary' },
  { name: 'TikTok', priority: 'primary' },
  { name: 'Google Business Profile / Maps', priority: 'primary' },
];

function agg(over: Partial<ScorecardPlatformAggregate>): ScorecardPlatformAggregate {
  return { key: 'instagram', label: 'instagram', postCount: 5, snapshotCount: 10, avgByMetric: { reach: 1200 }, ...over };
}

describe('buildChannelScorecard', () => {
  it('marks recommended channels active when a platform bucket matches (fuzzy)', () => {
    const scorecard = buildChannelScorecard(recommended, [
      agg({ key: 'instagram', avgByMetric: { reach: 1200 } }),
      agg({ key: 'tiktok', avgByMetric: { reach: 3000 } }),
    ]);
    const ig = scorecard.channels.find((c) => c.channel === 'Instagram');
    const tt = scorecard.channels.find((c) => c.channel === 'TikTok');
    const gbp = scorecard.channels.find((c) => c.channel.startsWith('Google'));
    expect(ig?.status).toBe('active');
    expect(ig?.metrics.reach).toBe(1200);
    expect(tt?.status).toBe('active');
    expect(gbp?.status).toBe('no_data'); // no google bucket
    expect(scorecard.recommendedWithData).toBe(2);
    expect(scorecard.recommendedWithoutData).toBe(1);
  });

  it('surfaces platforms with data that were NOT recommended as unexpected winners', () => {
    const scorecard = buildChannelScorecard(recommended, [
      agg({ key: 'instagram' }),
      agg({ key: 'linkedin', label: 'linkedin', avgByMetric: { reach: 900 } }),
    ]);
    expect(scorecard.unexpected).toHaveLength(1);
    expect(scorecard.unexpected[0].platform).toBe('linkedin');
    expect(scorecard.unexpected[0].metrics.reach).toBe(900);
  });

  it('never uses one platform bucket for two channels', () => {
    // Two channels that could both fuzzily match "instagram" — only one wins.
    const scorecard = buildChannelScorecard(
      [{ name: 'Instagram', priority: 'primary' }, { name: 'Instagram Reels', priority: 'secondary' }],
      [agg({ key: 'instagram' })],
    );
    const active = scorecard.channels.filter((c) => c.status === 'active');
    expect(active).toHaveLength(1);
    expect(scorecard.unexpected).toHaveLength(0);
  });

  it('reports hasAnyData=false and all no_data on a fresh project', () => {
    const scorecard = buildChannelScorecard(recommended, []);
    expect(scorecard.hasAnyData).toBe(false);
    expect(scorecard.channels.every((c) => c.status === 'no_data')).toBe(true);
    expect(scorecard.recommendedWithData).toBe(0);
  });

  it('keeps recommended channels in setup order', () => {
    const scorecard = buildChannelScorecard(recommended, [agg({ key: 'tiktok' })]);
    expect(scorecard.channels.map((c) => c.channel)).toEqual([
      'Instagram', 'TikTok', 'Google Business Profile / Maps',
    ]);
  });
});
