import { describe, expect, it } from 'vitest';
import {
  buildClientUpdateDigest,
  platformLabel,
  type DigestPost,
} from './role-room-client-update-digest.js';
import { computeBestTimesByPlatform, type PostObservation } from './role-room-best-time-to-post.js';

const THU_1900_OSLO = new Date('2026-07-02T17:00:00Z');
const MON_0800_OSLO = new Date('2026-06-29T06:00:00Z');

function post(platform: string, hook: string, engagement: number): DigestPost {
  return { platform, hook, publishedAt: THU_1900_OSLO, engagement };
}

function obs(publishedAt: Date, engagement: number, platform = 'instagram'): PostObservation {
  return { platform, publishedAt, engagement };
}

describe('platformLabel', () => {
  it('maps known platforms and title-cases unknowns', () => {
    expect(platformLabel('instagram')).toBe('Instagram');
    expect(platformLabel('tiktok')).toBe('TikTok');
    expect(platformLabel('mastodon')).toBe('Mastodon');
  });
});

describe('buildClientUpdateDigest', () => {
  it('summarises published + scheduled and picks the top post', () => {
    const d = buildClientUpdateDigest({
      periodLabel: 'uke 27',
      brandName: 'Bella Pizza',
      publishedPosts: [post('instagram', 'Ny meny', 120), post('facebook', 'Helgetilbud', 300)],
      scheduledCount: 3,
      daysRemaining: 10,
    });
    expect(d.headline).toBe('Markedsoppdatering for Bella Pizza — uke 27');
    expect(d.publishedCount).toBe(2);
    expect(d.scheduledCount).toBe(3);
    expect(d.topPost).toEqual({ platform: 'facebook', hook: 'Helgetilbud', engagement: 300 });
    expect(d.highlights.find((h) => h.key === 'published')?.value).toBe('2 innlegg');
    expect(d.highlights.find((h) => h.key === 'top_post')?.value).toContain('Facebook');
    expect(d.isEmpty).toBe(false);
  });

  it('embeds a data-driven best-time tip with lift when confident', () => {
    const bestTimes = computeBestTimesByPlatform([
      ...Array.from({ length: 6 }, () => obs(THU_1900_OSLO, 200)),
      ...Array.from({ length: 6 }, () => obs(MON_0800_OSLO, 40)),
    ]);
    const d = buildClientUpdateDigest({
      periodLabel: 'uke 27',
      publishedPosts: [],
      scheduledCount: 0,
      bestTimes,
    });
    expect(d.bestTimeTip).toBeTruthy();
    expect(d.bestTimeTip).toContain('Instagram');
    expect(d.bestTimeTip).toContain('torsdager 19:00');
    expect(d.bestTimeTip).toMatch(/\d+% over snittet/);
    // best-time alone is enough content → not empty
    expect(d.isEmpty).toBe(false);
  });

  it('omits the best-time tip when data is not confident', () => {
    const bestTimes = computeBestTimesByPlatform([obs(THU_1900_OSLO, 100), obs(THU_1900_OSLO, 90)]);
    const d = buildClientUpdateDigest({ periodLabel: 'uke 27', publishedPosts: [], scheduledCount: 0, bestTimes });
    expect(d.bestTimeTip).toBeNull();
  });

  it('flags an empty update (nothing to report)', () => {
    const d = buildClientUpdateDigest({ periodLabel: 'uke 27', publishedPosts: [], scheduledCount: 0 });
    expect(d.isEmpty).toBe(true);
    expect(d.topPost).toBeNull();
  });

  it('trims the producer note and keeps it as content', () => {
    const d = buildClientUpdateDigest({
      periodLabel: 'uke 27',
      publishedPosts: [],
      scheduledCount: 0,
      producerNote: '  Vi tester ny stil denne uken  ',
    });
    expect(d.producerNote).toBe('Vi tester ny stil denne uken');
    expect(d.isEmpty).toBe(false);
  });

  it('ignores posts with invalid dates and zero engagement for topPost', () => {
    const d = buildClientUpdateDigest({
      periodLabel: 'uke 27',
      publishedPosts: [
        { platform: 'instagram', hook: 'bad', publishedAt: new Date('nope'), engagement: 999 },
        { platform: 'instagram', hook: 'zero', publishedAt: THU_1900_OSLO, engagement: 0 },
      ],
      scheduledCount: 0,
    });
    expect(d.publishedCount).toBe(1); // only the valid-date one counts
    expect(d.topPost).toBeNull(); // zero engagement → no top post
  });
});
