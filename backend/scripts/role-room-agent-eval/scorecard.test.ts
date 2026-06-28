import { describe, expect, it } from 'vitest';
import {
  parseJudgeJson,
  aggregateScores,
  formatScorecard,
  DEFAULT_PASS_THRESHOLD,
  type EvalResult,
} from './scorecard.js';

describe('parseJudgeJson', () => {
  it('parses bare JSON', () => {
    const out = parseJudgeJson(
      '{"groundedness":5,"noHallucination":4,"actionability":3,"overall":4,"rationale":"god"}',
    );
    expect(out).toEqual({
      groundedness: 5,
      noHallucination: 4,
      actionability: 3,
      overall: 4,
      rationale: 'god',
    });
  });

  it('parses ```json fenced blocks', () => {
    const out = parseJudgeJson(
      '```json\n{"groundedness":4,"noHallucination":5,"actionability":4,"overall":4}\n```',
    );
    expect(out?.groundedness).toBe(4);
    expect(out?.noHallucination).toBe(5);
    expect(out?.overall).toBe(4);
  });

  it('parses plain ``` fences', () => {
    const out = parseJudgeJson(
      '```\n{"groundedness":3,"noHallucination":3,"actionability":3,"overall":3}\n```',
    );
    expect(out?.overall).toBe(3);
  });

  it('extracts JSON wrapped in prose', () => {
    const out = parseJudgeJson(
      'Her er min vurdering: {"groundedness":2,"noHallucination":5,"actionability":1,"overall":2} — håper det hjelper.',
    );
    expect(out?.groundedness).toBe(2);
    expect(out?.actionability).toBe(1);
  });

  it('accepts snake_case no_hallucination alias', () => {
    const out = parseJudgeJson('{"groundedness":4,"no_hallucination":5,"actionability":4,"overall":4}');
    expect(out?.noHallucination).toBe(5);
  });

  it('derives overall from the mean when missing', () => {
    const out = parseJudgeJson('{"groundedness":3,"noHallucination":3,"actionability":3}');
    expect(out?.overall).toBe(3);
  });

  it('clamps out-of-range scores into 0..5', () => {
    const out = parseJudgeJson('{"groundedness":9,"noHallucination":-2,"actionability":3,"overall":7}');
    expect(out?.groundedness).toBe(5);
    expect(out?.noHallucination).toBe(0);
    expect(out?.overall).toBe(5);
  });

  it('returns null on garbage', () => {
    expect(parseJudgeJson('this is not json at all')).toBeNull();
    expect(parseJudgeJson('')).toBeNull();
    expect(parseJudgeJson(null)).toBeNull();
    expect(parseJudgeJson(undefined)).toBeNull();
  });

  it('returns null when required dimensions are missing', () => {
    expect(parseJudgeJson('{"overall":4,"rationale":"mangler dimensjoner"}')).toBeNull();
  });
});

describe('aggregateScores', () => {
  const r = (id: string, g: number, n: number, a: number, o: number): EvalResult => ({
    id,
    scores: { groundedness: g, noHallucination: n, actionability: a, overall: o },
  });

  it('computes per-dimension means', () => {
    const agg = aggregateScores([r('a', 4, 4, 4, 4), r('b', 2, 2, 2, 2)]);
    expect(agg.means).toEqual({
      groundedness: 3,
      noHallucination: 3,
      actionability: 3,
      overall: 3,
    });
    expect(agg.scored).toBe(2);
    expect(agg.skipped).toBe(0);
  });

  it('passes when overall mean >= threshold', () => {
    const agg = aggregateScores([r('a', 4, 4, 4, 4), r('b', 4, 4, 4, 4)]);
    expect(agg.pass).toBe(true);
    expect(agg.threshold).toBe(DEFAULT_PASS_THRESHOLD);
  });

  it('fails when overall mean < threshold', () => {
    const agg = aggregateScores([r('a', 3, 3, 3, 3), r('b', 3, 3, 3, 3)]);
    expect(agg.pass).toBe(false);
  });

  it('honours a custom threshold', () => {
    const agg = aggregateScores([r('a', 3, 3, 3, 3)], 2.5);
    expect(agg.pass).toBe(true);
  });

  it('excludes skipped (null) results from means but counts them', () => {
    const agg = aggregateScores([r('a', 4, 4, 4, 4), { id: 'b', scores: null }]);
    expect(agg.scored).toBe(1);
    expect(agg.skipped).toBe(1);
    expect(agg.means.overall).toBe(4);
    expect(agg.pass).toBe(true);
  });

  it('treats an all-skipped / empty eval as a failure', () => {
    expect(aggregateScores([]).pass).toBe(false);
    expect(aggregateScores([{ id: 'x', scores: null }]).pass).toBe(false);
    expect(aggregateScores([]).means.overall).toBe(0);
  });
});

describe('formatScorecard', () => {
  it('renders a table with PASS/FAIL and per-fixture rows', () => {
    const results: EvalResult[] = [
      { id: 'fix-1', scores: { groundedness: 4, noHallucination: 5, actionability: 4, overall: 4 } },
      { id: 'fix-2', scores: null },
    ];
    const agg = aggregateScores(results);
    const out = formatScorecard(results, agg);
    expect(out).toContain('fix-1');
    expect(out).toContain('skipped');
    expect(out).toContain('PASS');
  });
});
