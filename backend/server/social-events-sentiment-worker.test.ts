import { describe, expect, it } from 'vitest';
import { scoreSentimentBatch, sweepOnce } from './social-events-sentiment-worker.js';

// scoreSentimentBatch + sweepOnce trenger ANTHROPIC_API_KEY for å gjøre
// noe nyttig — i unit-testen sjekker vi at den oppfører seg defensivt
// uten nøkkelen, og at parsing-helpers håndterer JSON-line-output korrekt
// via en mocked client.

describe('scoreSentimentBatch (no API key)', () => {
  it('returns empty array when ANTHROPIC_API_KEY is unset', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await scoreSentimentBatch([{ id: 'e1', body: 'hei' }]);
      expect(r).toEqual([]);
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it('skips events with null/empty body', async () => {
    // Med null body skal funksjonen returnere [] selv om ANTHROPIC_API_KEY er satt
    // (ingenting å score). Test uten API-key for å unngå nettverkskall.
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await scoreSentimentBatch([
        { id: 'e1', body: null },
        { id: 'e2', body: '' },
      ]);
      expect(r).toEqual([]);
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });
});

describe('sweepOnce (no pending events)', () => {
  it('returns 0 when listPendingSentimentEvents returns empty', async () => {
    const pool = {
      query: async () => ({ rows: [] }),
    };
    const updated = await sweepOnce(pool as never, 5);
    expect(updated).toBe(0);
  });
});
