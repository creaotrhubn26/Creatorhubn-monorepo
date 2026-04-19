/**
 * Tests for the ergonomics telemetry aggregation logic.
 *
 * All tests exercise the pure functions (computeHoverStats,
 * computeReversalRate, computeFatigueCurve, buildHeadline,
 * summariseEvents). DB persistence is verified indirectly via the
 * event shape — the summary functions accept exactly the same events
 * we'd reconstruct from a query, so if the aggregators are correct
 * the DB wrapper has no freedom to produce different numbers.
 *
 * What we pin down:
 *   - A view→decide pair produces the correct latency.
 *   - Revisited assets (viewed multiple times) are counted.
 *   - Reversal rate divides reversals by decisions correctly.
 *   - Fatigue-curve windows chunk properly and slope/trend point
 *     the right direction.
 *   - Headline text is tuned for signal strength (fatigue obvious,
 *     indecision obvious, clean run) — we don't over-shame users.
 *   - summariseEvents handles unsorted batches (client clocks drift).
 *   - Empty input returns safe zeros without crashing.
 */
import { describe, expect, it } from 'vitest';
import {
  buildHeadline,
  compareSessionToBaseline,
  computeFatigueCurve,
  computeHoverStats,
  computeReversalRate,
  summariseEvents,
  type ErgonomicsEvent,
  type ErgonomicsSummary,
} from './ergonomics-telemetry-service.js';

function emptySummary(
  overrides: Partial<ErgonomicsSummary> = {},
): ErgonomicsSummary {
  return {
    sessionsAnalysed: 1,
    hover: {
      assetsViewed: 0,
      medianDecisionMs: 0,
      p90DecisionMs: 0,
      revisitedAssets: 0,
    },
    reversal: { decisionsMade: 0, reversals: 0, rate: 0 },
    fatigue: { windows: [], upwardTrend: 0, slope: 0 },
    headline: '',
    ...overrides,
  };
}

function ev(
  kind: ErgonomicsEvent['kind'],
  overrides: Partial<ErgonomicsEvent> = {},
): ErgonomicsEvent {
  return {
    sessionId: 'sess-1',
    kind,
    ms: 0,
    sequence: 0,
    assetId: null,
    ...overrides,
  };
}


describe('computeHoverStats', () => {
  it('returns zeros on empty input', () => {
    const stats = computeHoverStats([]);
    expect(stats).toEqual({
      assetsViewed: 0,
      medianDecisionMs: 0,
      p90DecisionMs: 0,
      revisitedAssets: 0,
    });
  });

  it('pairs a view with the next decide on the same asset', () => {
    const stats = computeHoverStats([
      ev('view', { assetId: 'a', ms: 1000, sequence: 1 }),
      ev('decide', { assetId: 'a', ms: 1500, sequence: 2, action: 'keep' }),
    ]);
    expect(stats.assetsViewed).toBe(1);
    expect(stats.medianDecisionMs).toBe(500);
    expect(stats.revisitedAssets).toBe(0);
  });

  it('counts revisits (same asset viewed more than once)', () => {
    const stats = computeHoverStats([
      ev('view', { assetId: 'a', ms: 100, sequence: 1 }),
      ev('decide', { assetId: 'a', ms: 500, sequence: 2, action: 'weak' }),
      ev('view', { assetId: 'a', ms: 3000, sequence: 3 }),
      // No second decision — photographer is still looking.
    ]);
    expect(stats.revisitedAssets).toBe(1);
  });

  it('drops decide events that have no preceding view (defensive)', () => {
    // In practice the hook emits view before decide; if it ever
    // doesn't, the stats just ignore that pair rather than producing
    // a negative latency.
    const stats = computeHoverStats([
      ev('decide', { assetId: 'a', ms: 500, sequence: 1, action: 'keep' }),
    ]);
    expect(stats.medianDecisionMs).toBe(0);
  });

  it('picks the 90th percentile correctly on long sessions', () => {
    // 10 decisions: nine fast, one slow. p90 should pick up the slow one.
    const events: ErgonomicsEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const base = i * 10_000;
      events.push(ev('view', { assetId: `a${i}`, ms: base, sequence: i * 2 }));
      events.push(
        ev('decide', {
          assetId: `a${i}`,
          ms: base + (i === 9 ? 20_000 : 500),
          sequence: i * 2 + 1,
          action: 'keep',
        }),
      );
    }
    const stats = computeHoverStats(events);
    expect(stats.p90DecisionMs).toBeGreaterThanOrEqual(20_000);
    expect(stats.medianDecisionMs).toBe(500);
  });
});


describe('computeReversalRate', () => {
  it('returns 0 on empty input without dividing by zero', () => {
    const r = computeReversalRate([]);
    expect(r).toEqual({ decisionsMade: 0, reversals: 0, rate: 0 });
  });

  it('computes rate = reversals / decisions', () => {
    const events = [
      ev('decide', { action: 'keep', ms: 1, sequence: 1 }),
      ev('decide', { action: 'weak', ms: 2, sequence: 2 }),
      ev('reverse', {
        previousAction: 'weak',
        newAction: 'keep',
        ms: 3,
        sequence: 3,
      }),
      ev('decide', { action: 'hero', ms: 4, sequence: 4 }),
    ];
    const r = computeReversalRate(events);
    expect(r.decisionsMade).toBe(3);
    expect(r.reversals).toBe(1);
    expect(r.rate).toBeCloseTo(1 / 3);
  });
});


describe('computeFatigueCurve', () => {
  it('returns empty windows on no decisions', () => {
    const f = computeFatigueCurve([]);
    expect(f.windows).toEqual([]);
    expect(f.upwardTrend).toBe(0);
    expect(f.slope).toBe(0);
  });

  it('detects a steady slowdown as positive slope + high upward trend', () => {
    // Synthesise 100 decisions where latency grows linearly from 500ms
    // to 5000ms. Across two 50-frame windows, median should go from
    // ~750ms to ~3800ms and trend flips upward.
    const events: ErgonomicsEvent[] = [];
    for (let i = 0; i < 100; i++) {
      const latency = 500 + i * 45;
      const base = i * 10_000;
      events.push(ev('view', { assetId: `a${i}`, ms: base, sequence: i * 2 }));
      events.push(
        ev('decide', {
          assetId: `a${i}`,
          ms: base + latency,
          sequence: i * 2 + 1,
          action: 'keep',
        }),
      );
    }
    const f = computeFatigueCurve(events, 50);
    expect(f.windows.length).toBe(2);
    expect(f.windows[1]!.medianMs).toBeGreaterThan(f.windows[0]!.medianMs);
    expect(f.slope).toBeGreaterThan(0);
    expect(f.upwardTrend).toBe(1);
  });

  it('detects a steady speedup as negative slope + zero upward trend', () => {
    const events: ErgonomicsEvent[] = [];
    for (let i = 0; i < 100; i++) {
      const latency = 5000 - i * 45;      // starts slow, speeds up
      const base = i * 10_000;
      events.push(ev('view', { assetId: `a${i}`, ms: base, sequence: i * 2 }));
      events.push(
        ev('decide', {
          assetId: `a${i}`,
          ms: base + latency,
          sequence: i * 2 + 1,
          action: 'keep',
        }),
      );
    }
    const f = computeFatigueCurve(events, 50);
    expect(f.slope).toBeLessThan(0);
    expect(f.upwardTrend).toBe(0);
  });

  it('treats a single small window as no-trend', () => {
    // Fewer than ``windowSize`` decisions → 1 window → trend is
    // undefined, so we return 0 rather than inventing a signal.
    const events: ErgonomicsEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const base = i * 1000;
      events.push(ev('view', { assetId: `a${i}`, ms: base, sequence: i * 2 }));
      events.push(
        ev('decide', {
          assetId: `a${i}`,
          ms: base + 500,
          sequence: i * 2 + 1,
          action: 'keep',
        }),
      );
    }
    const f = computeFatigueCurve(events, 50);
    expect(f.upwardTrend).toBe(0);
    expect(f.slope).toBe(0);
  });
});


describe('buildHeadline', () => {
  it('tells photographer not enough data on short sessions', () => {
    const h = buildHeadline({
      hover: { assetsViewed: 10, medianDecisionMs: 500, p90DecisionMs: 1000, revisitedAssets: 0 },
      reversal: { decisionsMade: 5, reversals: 0, rate: 0 },
      fatigue: { windows: [], upwardTrend: 0, slope: 0 },
    });
    expect(h).toContain('not enough data');
  });

  it('surfaces fatigue + revisits together when both fire', () => {
    const h = buildHeadline({
      hover: { assetsViewed: 100, medianDecisionMs: 800, p90DecisionMs: 5000, revisitedAssets: 18 },
      reversal: { decisionsMade: 100, reversals: 5, rate: 0.05 },
      fatigue: { windows: [], upwardTrend: 0.8, slope: 900 },
    });
    expect(h).toMatch(/fatigue/i);
    expect(h).toMatch(/revisit/i);
  });

  it('suggests splitting culls when fatigue without revisits', () => {
    const h = buildHeadline({
      hover: { assetsViewed: 100, medianDecisionMs: 800, p90DecisionMs: 3000, revisitedAssets: 2 },
      reversal: { decisionsMade: 100, reversals: 0, rate: 0 },
      fatigue: { windows: [], upwardTrend: 0.8, slope: 700 },
    });
    expect(h).toMatch(/split/i);
  });

  it('names a high reversal rate without shaming', () => {
    const h = buildHeadline({
      hover: { assetsViewed: 80, medianDecisionMs: 700, p90DecisionMs: 3000, revisitedAssets: 5 },
      reversal: { decisionsMade: 80, reversals: 20, rate: 0.25 },
      fatigue: { windows: [], upwardTrend: 0.3, slope: 50 },
    });
    expect(h).toMatch(/changed your mind/i);
    expect(h).toMatch(/near-duplicate/i);
  });

  it('reports a clean run when nothing notable happened', () => {
    const h = buildHeadline({
      hover: { assetsViewed: 80, medianDecisionMs: 500, p90DecisionMs: 1500, revisitedAssets: 2 },
      reversal: { decisionsMade: 80, reversals: 2, rate: 0.025 },
      fatigue: { windows: [], upwardTrend: 0.4, slope: 60 },
    });
    expect(h).toMatch(/clean run/i);
  });
});


describe('compareSessionToBaseline', () => {
  it('emits no deltas when session matches baseline within noise', () => {
    const baseline = emptySummary({
      hover: { assetsViewed: 100, medianDecisionMs: 1000, p90DecisionMs: 3000, revisitedAssets: 5 },
      reversal: { decisionsMade: 100, reversals: 5, rate: 0.05 },
    });
    const session = emptySummary({
      hover: { assetsViewed: 50, medianDecisionMs: 1100, p90DecisionMs: 3100, revisitedAssets: 3 },
      reversal: { decisionsMade: 50, reversals: 3, rate: 0.06 },
    });
    const cmp = compareSessionToBaseline(session, baseline);
    // +10% decision time is inside the 20% noise band — no delta.
    expect(cmp.deltas).toHaveLength(0);
    expect(cmp.signal).toBe('normal');
  });

  it('flags drained signal when session is measurably slower + revisits up', () => {
    const baseline = emptySummary({
      hover: { assetsViewed: 100, medianDecisionMs: 1000, p90DecisionMs: 3000, revisitedAssets: 5 },
      reversal: { decisionsMade: 100, reversals: 5, rate: 0.05 },
    });
    const session = emptySummary({
      hover: { assetsViewed: 50, medianDecisionMs: 1800, p90DecisionMs: 6000, revisitedAssets: 12 },
      reversal: { decisionsMade: 50, reversals: 8, rate: 0.16 },
    });
    const cmp = compareSessionToBaseline(session, baseline);
    expect(cmp.signal).toBe('drained');
    expect(cmp.deltas.length).toBeGreaterThanOrEqual(2);
    expect(cmp.deltas.some((d) => /slower than your average/i.test(d))).toBe(true);
  });

  it('praises a rested signal when session is noticeably faster', () => {
    const baseline = emptySummary({
      hover: { assetsViewed: 100, medianDecisionMs: 2000, p90DecisionMs: 6000, revisitedAssets: 15 },
      reversal: { decisionsMade: 100, reversals: 10, rate: 0.10 },
    });
    const session = emptySummary({
      hover: { assetsViewed: 50, medianDecisionMs: 1200, p90DecisionMs: 3500, revisitedAssets: 2 },
      reversal: { decisionsMade: 50, reversals: 1, rate: 0.02 },
    });
    const cmp = compareSessionToBaseline(session, baseline);
    expect(cmp.praise.some((p) => /faster than your average/i.test(p))).toBe(true);
  });

  it('skips decision-time delta when baseline has no data', () => {
    // Guards against divide-by-zero / NaN when a user's baseline is
    // empty (first session). The card must not read "100% slower
    // than your average" when the average doesn't exist.
    const baseline = emptySummary();
    const session = emptySummary({
      hover: { assetsViewed: 50, medianDecisionMs: 1500, p90DecisionMs: 4000, revisitedAssets: 3 },
    });
    const cmp = compareSessionToBaseline(session, baseline);
    expect(cmp.deltas.some((d) => /slower/i.test(d))).toBe(false);
  });
});

describe('summariseEvents', () => {
  it('handles unsorted input by sorting first', () => {
    // Same events, intentionally shuffled. Sorting by ms must make
    // the aggregated stats identical.
    const ordered: ErgonomicsEvent[] = [];
    for (let i = 0; i < 3; i++) {
      ordered.push(ev('view', { assetId: `a${i}`, ms: i * 1000, sequence: i * 2 }));
      ordered.push(
        ev('decide', {
          assetId: `a${i}`,
          ms: i * 1000 + 500,
          sequence: i * 2 + 1,
          action: 'keep',
        }),
      );
    }
    const shuffled = [...ordered].reverse();
    const orderedSummary = summariseEvents(ordered);
    const shuffledSummary = summariseEvents(shuffled);
    expect(orderedSummary.hover.assetsViewed).toBe(shuffledSummary.hover.assetsViewed);
    expect(orderedSummary.hover.medianDecisionMs).toBe(shuffledSummary.hover.medianDecisionMs);
  });

  it('counts unique sessionIds', () => {
    const events = [
      ev('view', { sessionId: 'a', assetId: 'x', ms: 0, sequence: 0 }),
      ev('view', { sessionId: 'b', assetId: 'y', ms: 1, sequence: 1 }),
      ev('view', { sessionId: 'a', assetId: 'z', ms: 2, sequence: 2 }),
    ];
    expect(summariseEvents(events).sessionsAnalysed).toBe(2);
  });

  it('produces a headline that is always a non-empty string', () => {
    // Even on completely empty input, the headline falls back to
    // "not enough data yet" — the dashboard never shows undefined.
    expect(summariseEvents([]).headline.length).toBeGreaterThan(0);
  });
});
