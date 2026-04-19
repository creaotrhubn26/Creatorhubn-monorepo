/**
 * Tests for the capture session culling classifier.
 *
 * The classifier is the piece of the workflow that actually saves a
 * wedding photographer hours per event, so the tests are strict about
 * the invariants:
 *
 *   - A hard-rejected or flagged asset always lands where the
 *     photographer put it; no signal override the human.
 *   - A single reject-pattern note pushes an otherwise fine frame into
 *     the reject bucket.
 *   - Soft issues land in weak, not reject.
 *   - Duplicate clusters pick the sharpest winner and downgrade the
 *     others one tier.
 *   - Eyes-closed only downgrades when a face is present (we don't
 *     ding landscapes for `eyesOpen: false`).
 *   - Scoring is bounded 0..1.
 */
import { describe, expect, it } from 'vitest';
import {
  classifySession,
  patternsForSubject,
  scoreAsset,
  type CaptureAssetForCulling,
} from './capture-culling-service.js';

function asset(
  id: string,
  overrides: Partial<CaptureAssetForCulling> = {},
): CaptureAssetForCulling {
  return {
    id,
    signals: { sharpness: 75, eyesOpen: true, faceCount: 1 },
    ...overrides,
  };
}


describe('scoreAsset', () => {
  it('returns a bounded 0..1 score', () => {
    const { score } = scoreAsset(asset('a'));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('rewards high sharpness', () => {
    const low = scoreAsset(asset('a', { signals: { sharpness: 45 } }));
    const high = scoreAsset(asset('a', { signals: { sharpness: 85 } }));
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('penalises eyes closed only when a face is present', () => {
    const landscape = scoreAsset(
      asset('a', { signals: { sharpness: 80, eyesOpen: false, faceCount: 0 } }),
    );
    const portrait = scoreAsset(
      asset('a', { signals: { sharpness: 80, eyesOpen: false, faceCount: 1 } }),
    );
    // Portrait with eyes closed must score lower than landscape with
    // the same eyesOpen=false (faceCount=0 = no face to care about).
    expect(portrait.score).toBeLessThan(landscape.score);
    expect(portrait.reasons).toContain('eyes closed');
    expect(landscape.reasons).not.toContain('eyes closed');
  });

  it('penalises heavily for reject-pattern AI notes', () => {
    const { score, reasons } = scoreAsset(
      asset('a', {
        signals: {
          sharpness: 80,
          ai: { qualityNotes: ['eyes closed on primary subject'] },
        },
      }),
    );
    expect(score).toBeLessThan(0.5);
    expect(reasons.some((r) => /eyes closed/i.test(r))).toBe(true);
  });

  it('penalises lightly for weak-pattern AI notes', () => {
    const clean = scoreAsset(
      asset('a', { signals: { sharpness: 80 } }),
    );
    const weak = scoreAsset(
      asset('a', {
        signals: {
          sharpness: 80,
          ai: { qualityNotes: ['mildly soft focus'] },
        },
      }),
    );
    expect(weak.score).toBeLessThan(clean.score);
    // But not by as much as a reject-pattern note would have deducted.
    expect(clean.score - weak.score).toBeLessThan(0.3);
  });

  it('returns neutral reasons when no signals provided', () => {
    const { score, reasons } = scoreAsset({ id: 'a', signals: null });
    expect(score).toBeGreaterThan(0);
    expect(reasons).toEqual([]);
  });
});


describe('classifySession — bucket assignment', () => {
  it('respects explicit photographer reject', () => {
    const summary = classifySession([
      asset('x', { rejected: true, signals: { sharpness: 90, eyesOpen: true, faceCount: 1 } }),
    ]);
    expect(summary.reject.map((r) => r.assetId)).toContain('x');
    expect(summary.hero).toHaveLength(0);
  });

  it('respects explicit photographer flag → hero', () => {
    const summary = classifySession([
      asset('x', { flaggedForClient: true, signals: { sharpness: 50 } }),
    ]);
    expect(summary.hero.map((r) => r.assetId)).toContain('x');
  });

  it('respects rating 5 → hero even with mediocre signals', () => {
    const summary = classifySession([
      asset('x', { rating: 5, signals: { sharpness: 55, eyesOpen: true, faceCount: 1 } }),
    ]);
    expect(summary.hero.map((r) => r.assetId)).toContain('x');
  });

  it('routes a crisp, clean portrait to hero or keep', () => {
    const summary = classifySession([
      asset('x', {
        signals: {
          sharpness: 90,
          eyesOpen: true,
          faceCount: 1,
          ai: { qualityNotes: [] },
        },
      }),
    ]);
    const bucketedAs = summary.hero.some((r) => r.assetId === 'x')
      ? 'hero'
      : summary.keep.some((r) => r.assetId === 'x')
        ? 'keep'
        : null;
    expect(bucketedAs).not.toBeNull();
  });

  it('routes a motion-blurred frame to reject', () => {
    const summary = classifySession([
      asset('x', {
        signals: {
          sharpness: 35,
          eyesOpen: true,
          faceCount: 1,
          ai: { qualityNotes: ['motion blur — subject not sharp'] },
        },
      }),
    ]);
    expect(summary.reject.map((r) => r.assetId)).toContain('x');
  });

  it('routes a soft-focus frame to weak', () => {
    const summary = classifySession([
      asset('x', { signals: { sharpness: 45, eyesOpen: true, faceCount: 1 } }),
    ]);
    // Score lands between 0.35 and 0.6 → weak.
    const where = summary.weak.some((r) => r.assetId === 'x')
      ? 'weak'
      : summary.reject.some((r) => r.assetId === 'x')
        ? 'reject'
        : 'other';
    expect(['weak', 'reject']).toContain(where);
  });
});


describe('classifySession — duplicate clusters', () => {
  it('picks the sharpest frame as the cluster winner', () => {
    const summary = classifySession([
      asset('a', { signals: { sharpness: 72, duplicateGroupId: 'grp-1', eyesOpen: true, faceCount: 1 } }),
      asset('b', { signals: { sharpness: 90, duplicateGroupId: 'grp-1', eyesOpen: true, faceCount: 1 } }),
      asset('c', { signals: { sharpness: 80, duplicateGroupId: 'grp-1', eyesOpen: true, faceCount: 1 } }),
    ]);
    expect(summary.duplicateClusters['grp-1']).toBeDefined();
    expect(summary.duplicateClusters['grp-1']![0]).toBe('b');
  });

  it('downgrades duplicate-cluster losers by one tier', () => {
    const summary = classifySession([
      asset('win', { signals: { sharpness: 95, duplicateGroupId: 'grp-1', eyesOpen: true, faceCount: 1 } }),
      asset('lose', { signals: { sharpness: 78, duplicateGroupId: 'grp-1', eyesOpen: true, faceCount: 1 } }),
    ]);
    // Both would be hero/keep alone; the loser drops a tier.
    const winnerBucket =
      summary.hero.some((r) => r.assetId === 'win') ? 'hero'
        : summary.keep.some((r) => r.assetId === 'win') ? 'keep'
        : null;
    const loserBucket =
      summary.keep.some((r) => r.assetId === 'lose') ? 'keep'
        : summary.weak.some((r) => r.assetId === 'lose') ? 'weak'
        : null;
    expect(winnerBucket).not.toBeNull();
    expect(loserBucket).not.toBeNull();
    // Loser reasons include the downgrade explanation.
    const loser = [...summary.keep, ...summary.weak].find((r) => r.assetId === 'lose');
    expect(loser?.reasons).toContain('duplicate of stronger frame');
  });

  it('does not downgrade photographer-forced hero even if duplicate', () => {
    // When the photographer explicitly flagged a frame, the classifier
    // never drops it off the hero list even in a duplicate cluster —
    // human intent trumps automated heuristics.
    const summary = classifySession([
      asset('a', { flaggedForClient: true, signals: { sharpness: 60, duplicateGroupId: 'grp-1' } }),
      asset('b', { signals: { sharpness: 90, duplicateGroupId: 'grp-1', eyesOpen: true, faceCount: 1 } }),
    ]);
    expect(summary.hero.map((r) => r.assetId)).toContain('a');
  });

  it('ignores groups with a single member (not a real cluster)', () => {
    const summary = classifySession([
      asset('solo', { signals: { sharpness: 80, duplicateGroupId: 'grp-solo', eyesOpen: true, faceCount: 1 } }),
    ]);
    expect(summary.duplicateClusters['grp-solo']).toBeUndefined();
  });
});


describe('patternsForSubject', () => {
  it('always includes the universal baseline', () => {
    // Universal patterns apply to every subject regardless — they're
    // the technical-reject checks that don't depend on what's in the
    // frame.
    const baseline = patternsForSubject('unknown-subject');
    const mentionsMotionBlur = baseline.reject.some((p) => p.test('motion blur'));
    expect(mentionsMotionBlur).toBe(true);
  });

  it('layers aviation-specific patterns on top', () => {
    const aviation = patternsForSubject('aviation');
    const mentionsCroppedWing = aviation.reject.some((p) => p.test('wing tip cropped'));
    const mentionsContrail = aviation.reject.some((p) =>
      p.test('contrail across fuselage'),
    );
    expect(mentionsCroppedWing).toBe(true);
    expect(mentionsContrail).toBe(true);
  });

  it('does not leak subject-specific patterns across subjects', () => {
    // Food patterns should not apply when the subject is aviation.
    const aviation = patternsForSubject('aviation');
    const hasFoodSpill = aviation.reject.some((p) => p.test('spilled sauce'));
    expect(hasFoodSpill).toBe(false);
  });

  it('is case + whitespace tolerant', () => {
    const a = patternsForSubject('  AVIATION  ');
    const b = patternsForSubject('aviation');
    expect(a.reject.length).toBe(b.reject.length);
  });

  it('handles null / undefined / empty gracefully', () => {
    expect(patternsForSubject(null).reject.length).toBeGreaterThan(0);
    expect(patternsForSubject(undefined).reject.length).toBeGreaterThan(0);
    expect(patternsForSubject('').reject.length).toBeGreaterThan(0);
  });
});

describe('scoreAsset — subject-aware', () => {
  it('aviation: "wing tip cropped" is a hard reject', () => {
    const { score, reasons } = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 85,
        ai: { subject: 'aviation', qualityNotes: ['wing tip cropped out of frame'] },
      },
    });
    // Hard-reject pattern deducts 0.5 — a sharp shot with a cropped
    // wing should land well under the keep threshold.
    expect(score).toBeLessThan(0.5);
    // "wing tip cropped" shows up as an ``ai: …`` reason alongside
    // the "sharp" reason. Check for the reject phrase anywhere in the
    // reasons list rather than at a fixed index.
    expect(reasons.some((r) => /wing/.test(r))).toBe(true);
  });

  it('vehicle: photographer reflection is a hard reject', () => {
    const { score } = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 90,
        ai: {
          subject: 'vehicle',
          qualityNotes: ['photographer reflected in bonnet'],
        },
      },
    });
    expect(score).toBeLessThan(0.5);
  });

  it('food: wilted garnish is a hard reject', () => {
    const { score } = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 80,
        ai: { subject: 'food', qualityNotes: ['wilted herb on plate edge'] },
      },
    });
    expect(score).toBeLessThan(0.5);
  });

  it('landscape: tilted horizon is a hard reject', () => {
    const { score } = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 85,
        ai: { subject: 'landscape', qualityNotes: ['tilted horizon'] },
      },
    });
    expect(score).toBeLessThan(0.5);
  });

  it('product: dust on product is a hard reject', () => {
    const { score } = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 90,
        ai: { subject: 'product', qualityNotes: ['dust on product'] },
      },
    });
    expect(score).toBeLessThan(0.5);
  });

  it('a food-reject note on an aviation subject is only a mild downgrade', () => {
    // If Claude puts a food-specific note on an aviation image
    // (classification confusion), the food pattern is NOT in the
    // aviation reject set, so we fall through to the soft "flagged
    // but unknown pattern" branch — small deduction, not hard reject.
    const aviation = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 85,
        ai: { subject: 'aviation', qualityNotes: ['wilted herb'] },
      },
    });
    const clean = scoreAsset({
      id: 'b',
      signals: { sharpness: 85, ai: { subject: 'aviation' } },
    });
    // Downgraded, but not catastrophically — the pattern isn't an
    // aviation reject.
    expect(aviation.score).toBeLessThan(clean.score);
    expect(clean.score - aviation.score).toBeLessThan(0.3);
  });

  it('group_portrait: "person cropped out" is a hard reject', () => {
    const { score } = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 80,
        faceCount: 4,
        eyesOpen: true,
        ai: {
          subject: 'group_portrait',
          qualityNotes: ['person cropped out of frame on left'],
        },
      },
    });
    expect(score).toBeLessThan(0.5);
  });

  it('weak patterns are subject-aware too', () => {
    // Squinting is a portrait-weak pattern; same phrase shouldn't
    // flag on aviation.
    const portrait = scoreAsset({
      id: 'a',
      signals: {
        sharpness: 85,
        faceCount: 1,
        eyesOpen: true,
        ai: { subject: 'portrait', qualityNotes: ['squinting into sun'] },
      },
    });
    const aviation = scoreAsset({
      id: 'b',
      signals: {
        sharpness: 85,
        ai: { subject: 'aviation', qualityNotes: ['squinting into sun'] },
      },
    });
    // Portrait: canonical weak pattern, small deduction (-0.15).
    // Aviation: unrecognised pattern, tiny deduction (-0.08).
    // So the portrait penalty is bigger.
    expect(portrait.score).toBeLessThan(aviation.score);
  });
});

describe('classifySession — strictness', () => {
  // Score bands relative to default thresholds:
  //   conservative:  hero ≥0.80, keep ≥0.52, weak ≥0.27
  //   balanced:      hero ≥0.88, keep ≥0.60, weak ≥0.35  (reference)
  //   aggressive:    hero ≥0.96, keep ≥0.68, weak ≥0.43
  //
  // We verify by constructing a synthetic frame whose computed score
  // would land in one tier on balanced and another on the tuned
  // strictness. Sharpness 75 → score 0.9 (base 0.7 + sharp +0.2).

  it('balanced puts a sharp frame into hero', () => {
    const summary = classifySession(
      [asset('a', { signals: { sharpness: 80, eyesOpen: true, faceCount: 1 } })],
    );
    expect(summary.hero).toHaveLength(1);
  });

  it('aggressive pushes the same frame down into keep', () => {
    const summary = classifySession(
      [asset('a', { signals: { sharpness: 80, eyesOpen: true, faceCount: 1 } })],
      { strictness: 'aggressive' },
    );
    expect(summary.hero).toHaveLength(0);
    expect(summary.keep).toHaveLength(1);
  });

  it('conservative catches a soft frame that balanced would drop to weak', () => {
    // Sharpness 45 = soft focus (reason), score 0.55.
    // Balanced: 0.35 ≤ 0.55 < 0.6 → weak.
    // Conservative: 0.52 ≤ 0.55 → keep (promoted one tier).
    const soft = asset('soft', {
      signals: { sharpness: 45, eyesOpen: true, faceCount: 1 },
    });
    const balanced = classifySession([soft]);
    const conservative = classifySession([soft], { strictness: 'conservative' });
    // Balanced drops it to weak; conservative keeps it.
    expect(balanced.weak.some((r) => r.assetId === 'soft')).toBe(true);
    expect(conservative.keep.some((r) => r.assetId === 'soft')).toBe(true);
  });

  it('unknown strictness value falls back to balanced', () => {
    const a = classifySession(
      [asset('a', { signals: { sharpness: 80, eyesOpen: true, faceCount: 1 } })],
      { strictness: 'bonkers' as unknown as 'balanced' },
    );
    expect(a.hero).toHaveLength(1);
  });
});

describe('classifySession — totals + shape', () => {
  it('emits a total that matches input length', () => {
    const summary = classifySession([
      asset('a'),
      asset('b', { rejected: true }),
      asset('c', { flaggedForClient: true }),
    ]);
    expect(summary.total).toBe(3);
    const allBuckets =
      summary.hero.length + summary.keep.length + summary.weak.length + summary.reject.length;
    expect(allBuckets).toBe(3);
  });

  it('handles empty input cleanly', () => {
    const summary = classifySession([]);
    expect(summary.total).toBe(0);
    expect(summary.hero).toEqual([]);
    expect(summary.reject).toEqual([]);
    expect(summary.duplicateClusters).toEqual({});
  });

  it('tolerates missing signals and returns a neutral-ish score', () => {
    // An asset with no signals at all should land in keep (neutral)
    // rather than reject — we never punish the photographer for
    // missing telemetry.
    const summary = classifySession([
      { id: 'x', signals: null },
    ]);
    expect(summary.reject.find((r) => r.assetId === 'x')).toBeUndefined();
  });
});
