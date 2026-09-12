import { describe, expect, it } from 'vitest';
import {
  applyDataDrivenPostTimes,
  computeBestTimeForPlatform,
  computeBestTimesByPlatform,
  extractLocalSlot,
  optimalPostTimeForPlatform,
  pickOptimalPostTime,
  scoreEngagement,
  slotToPostTime,
  type PostObservation,
} from './role-room-best-time-to-post.js';

// A Thursday 19:00 Europe/Oslo instant (summer, UTC+2 → 17:00Z).
const THU_1900_OSLO = new Date('2026-07-02T17:00:00Z');
// A Monday 08:00 Europe/Oslo instant (summer → 06:00Z).
const MON_0800_OSLO = new Date('2026-06-29T06:00:00Z');

function post(publishedAt: Date, engagement: number, platform = 'instagram'): PostObservation {
  return { platform, publishedAt, engagement };
}

describe('extractLocalSlot', () => {
  it('maps a UTC instant to brand-local weekday (0=Mon) + hour', () => {
    expect(extractLocalSlot(THU_1900_OSLO, 'Europe/Oslo')).toEqual({ dayOfWeek: 3, hour: 19 });
    expect(extractLocalSlot(MON_0800_OSLO, 'Europe/Oslo')).toEqual({ dayOfWeek: 0, hour: 8 });
  });

  it('respects the timezone (same instant, different local hour)', () => {
    // 17:00Z is 19:00 in Oslo but 10:00 in Los Angeles (Thursday there too).
    const la = extractLocalSlot(THU_1900_OSLO, 'America/Los_Angeles');
    expect(la.hour).toBe(10);
  });
});

describe('scoreEngagement', () => {
  it('weights comments/shares/saves above passive views', () => {
    const shallow = scoreEngagement({ views: 10000 });
    const deep = scoreEngagement({ likes: 50, comments: 20, shares: 10 });
    expect(deep).toBeGreaterThan(shallow);
    // 50*1 + 20*2 + 10*3 = 120
    expect(deep).toBe(120);
  });

  it('tolerates metric-name aliases and ignores junk', () => {
    expect(scoreEngagement({ like_count: 3, comment_count: 1 })).toBe(3 + 2);
    expect(scoreEngagement({ nonsense: 999, likes: null as unknown as number })).toBe(0);
  });
});

describe('slotToPostTime', () => {
  it('formats on-the-hour HH:MM', () => {
    expect(slotToPostTime(9)).toBe('09:00');
    expect(slotToPostTime(19)).toBe('19:00');
    expect(slotToPostTime(0)).toBe('00:00');
  });
});

describe('computeBestTimeForPlatform — confidence gating', () => {
  it('is not confident with too few posts', () => {
    const obs = [post(THU_1900_OSLO, 100), post(THU_1900_OSLO, 90)];
    const r = computeBestTimeForPlatform('instagram', obs);
    expect(r.confident).toBe(false);
    expect(r.reason).toBe('not_enough_posts');
    expect(r.recommendations).toEqual([]);
    expect(pickOptimalPostTime(r)).toBeNull();
  });

  it('is not confident when no slot meets min samples, even with enough posts', () => {
    // 8 posts but each in a unique hour → no slot has 2+ samples.
    const obs = Array.from({ length: 8 }, (_, i) =>
      post(new Date(`2026-07-0${(i % 7) + 1}T${String(i).padStart(2, '0')}:00:00Z`), 50),
    );
    const r = computeBestTimeForPlatform('instagram', obs, { minSamplesPerSlot: 3 });
    expect(r.confident).toBe(false);
    expect(r.reason).toBe('no_slot_meets_min_samples');
  });

  it('returns no_observations for an empty list', () => {
    const r = computeBestTimeForPlatform('tiktok', []);
    expect(r.reason).toBe('no_observations');
    expect(r.totalPosts).toBe(0);
  });
});

describe('computeBestTimeForPlatform — ranking', () => {
  it('ranks the highest-engagement slot first and computes lift', () => {
    // 6 posts Thu 19:00 (high), 6 posts Mon 08:00 (low) → 12 total, confident.
    const obs = [
      ...Array.from({ length: 6 }, () => post(THU_1900_OSLO, 200)),
      ...Array.from({ length: 6 }, () => post(MON_0800_OSLO, 40)),
    ];
    const r = computeBestTimeForPlatform('instagram', obs);
    expect(r.confident).toBe(true);
    expect(r.reason).toBe('ok');
    expect(r.totalPosts).toBe(12);

    const top = r.recommendations[0];
    expect(top.dayOfWeek).toBe(3); // Thursday
    expect(top.hour).toBe(19);
    expect(top.optimalPostTime).toBe('19:00');
    expect(top.sampleSize).toBe(6);
    expect(top.label).toBe('torsdager 19:00');
    // overall mean = (6*200 + 6*40)/12 = 120; Thu slot mean = 200 → lift ~1.667
    expect(top.liftVsAverage).toBeCloseTo(200 / 120, 5);

    // Monday slot ranked below.
    expect(r.recommendations[1].dayOfWeek).toBe(0);
    expect(r.recommendations[1].hour).toBe(8);

    expect(pickOptimalPostTime(r)).toBe('19:00');
  });

  it('caps the number of recommendations', () => {
    const obs = [
      ...Array.from({ length: 3 }, () => post(new Date('2026-07-02T17:00:00Z'), 300)), // Thu 19
      ...Array.from({ length: 3 }, () => post(new Date('2026-06-29T06:00:00Z'), 200)), // Mon 08
      ...Array.from({ length: 3 }, () => post(new Date('2026-06-30T10:00:00Z'), 100)), // Tue 12
      ...Array.from({ length: 3 }, () => post(new Date('2026-07-01T13:00:00Z'), 50)), // Wed 15
    ];
    const r = computeBestTimeForPlatform('instagram', obs, { maxRecommendations: 2 });
    expect(r.confident).toBe(true);
    expect(r.recommendations).toHaveLength(2);
    expect(r.recommendations[0].meanEngagement).toBeGreaterThan(r.recommendations[1].meanEngagement);
  });

  it('drops invalid observations (bad date / negative engagement)', () => {
    const obs = [
      ...Array.from({ length: 8 }, () => post(THU_1900_OSLO, 100)),
      post(new Date('not-a-date'), 999),
      post(THU_1900_OSLO, -5),
      post(THU_1900_OSLO, Number.NaN),
    ];
    const r = computeBestTimeForPlatform('instagram', obs);
    expect(r.totalPosts).toBe(8);
    expect(r.confident).toBe(true);
  });
});

describe('applyDataDrivenPostTimes (the optimalPostTime override)', () => {
  const igConfident = [
    ...Array.from({ length: 6 }, () => post(THU_1900_OSLO, 200, 'instagram')),
    ...Array.from({ length: 6 }, () => post(MON_0800_OSLO, 40, 'instagram')),
  ];
  const tiktokSparse = [post(THU_1900_OSLO, 100, 'tiktok'), post(THU_1900_OSLO, 90, 'tiktok')];

  it('overrides the LLM guess only for platforms with confident data', () => {
    const results = computeBestTimesByPlatform([...igConfident, ...tiktokSparse]);
    const concepts = [
      { primaryPlatform: 'instagram', optimalPostTime: '12:00', hook: 'a' },
      { primaryPlatform: 'tiktok', optimalPostTime: '15:00', hook: 'b' },
      { primaryPlatform: 'linkedin', optimalPostTime: '09:00', hook: 'c' },
    ];
    const { concepts: out, dataBackedCount } = applyDataDrivenPostTimes(concepts, results);
    expect(out[0].optimalPostTime).toBe('19:00'); // instagram → data-driven
    expect(out[1].optimalPostTime).toBe('15:00'); // tiktok sparse → LLM kept
    expect(out[2].optimalPostTime).toBe('09:00'); // linkedin no data → LLM kept
    expect(dataBackedCount).toBe(1);
    // preserves other fields
    expect(out[0].hook).toBe('a');
  });

  it('optimalPostTimeForPlatform returns null when not confident', () => {
    const results = computeBestTimesByPlatform(tiktokSparse);
    expect(optimalPostTimeForPlatform(results, 'tiktok')).toBeNull();
  });
});

describe('computeBestTimesByPlatform', () => {
  it('computes each platform independently and orders by volume', () => {
    const obs = [
      ...Array.from({ length: 10 }, () => post(THU_1900_OSLO, 100, 'instagram')),
      ...Array.from({ length: 3 }, () => post(MON_0800_OSLO, 100, 'tiktok')),
    ];
    const results = computeBestTimesByPlatform(obs);
    expect(results).toHaveLength(2);
    expect(results[0].platform).toBe('instagram'); // more posts first
    expect(results[0].confident).toBe(true);
    expect(results[1].platform).toBe('tiktok');
    expect(results[1].confident).toBe(false); // only 3 posts
  });
});
