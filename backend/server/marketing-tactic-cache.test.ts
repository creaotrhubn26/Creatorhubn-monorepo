import { describe, it, expect, vi } from 'vitest';
import { findCachedTactics } from './marketing-tactic-cache.js';

describe('findCachedTactics', () => {
  it('returns null when nothing is above the similarity threshold', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as any;
    const result = await findCachedTactics(pool, { embedding: [0.1, 0.2] });
    expect(result).toBeNull();
  });

  it('returns the top row when it clears the similarity threshold', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ domain: 'example.com', raw_findings: [{ tactic: 'Knapphet' }], similarity: 0.95 }],
      }),
    } as any;
    const result = await findCachedTactics(pool, { embedding: [0.1, 0.2] });
    expect(result).toEqual({ domain: 'example.com', findings: [{ tactic: 'Knapphet' }], similarity: 0.95 });
  });
});
