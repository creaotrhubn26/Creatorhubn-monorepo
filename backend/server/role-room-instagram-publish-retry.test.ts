import { describe, expect, it } from 'vitest';
import {
  computeRetryAt,
  MAX_PUBLISH_ATTEMPTS,
} from './role-room-instagram-publish.js';

describe('computeRetryAt — exponential backoff schedule', () => {
  it('returns ~1 minute ahead for attempt 1', () => {
    const now = Date.now();
    const next = computeRetryAt(1);
    expect(next).not.toBeNull();
    const diffMs = next!.getTime() - now;
    expect(diffMs).toBeGreaterThan(50_000);
    expect(diffMs).toBeLessThan(70_000);
  });

  it('returns ~5 minutes ahead for attempt 2', () => {
    const now = Date.now();
    const next = computeRetryAt(2);
    expect(next).not.toBeNull();
    const diffMs = next!.getTime() - now;
    expect(diffMs).toBeGreaterThan(280_000); // 4m40s
    expect(diffMs).toBeLessThan(320_000); // 5m20s
  });

  it('returns ~15 minutes ahead for attempt 3', () => {
    const now = Date.now();
    const next = computeRetryAt(3);
    expect(next).not.toBeNull();
    const diffMs = next!.getTime() - now;
    expect(diffMs).toBeGreaterThan(870_000); // 14m30s
    expect(diffMs).toBeLessThan(930_000); // 15m30s
  });

  it('returns null when attempts >= MAX_PUBLISH_ATTEMPTS (give up permanently)', () => {
    expect(computeRetryAt(MAX_PUBLISH_ATTEMPTS)).toBeNull();
    expect(computeRetryAt(MAX_PUBLISH_ATTEMPTS + 1)).toBeNull();
    expect(computeRetryAt(99)).toBeNull();
  });

  it('MAX_PUBLISH_ATTEMPTS is set to a sane production value', () => {
    // Hvis vi senker dette under 3 mister vi mye fault tolerance.
    // Hvis vi setter høyere enn 6 begynner vi å spamme Meta API.
    expect(MAX_PUBLISH_ATTEMPTS).toBeGreaterThanOrEqual(3);
    expect(MAX_PUBLISH_ATTEMPTS).toBeLessThanOrEqual(6);
  });

  it('attempts 1, 2, 3 produce strictly increasing retry-times', () => {
    const t1 = computeRetryAt(1)!.getTime();
    const t2 = computeRetryAt(2)!.getTime();
    const t3 = computeRetryAt(3)!.getTime();
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
    // Backoff er ekte exponential: hver påfølgende interval er minst
    // 2x lengre enn forrige (innen feilbarhet for now()-jitter).
    const interval1 = t1 - Date.now();
    const interval2 = t2 - Date.now();
    const interval3 = t3 - Date.now();
    expect(interval2).toBeGreaterThan(interval1 * 2);
    expect(interval3).toBeGreaterThan(interval2 * 2);
  });
});
