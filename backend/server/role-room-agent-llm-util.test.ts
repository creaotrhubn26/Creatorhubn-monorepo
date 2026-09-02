import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOOTSTRAP_POSTPROCESS_TIMEOUT_MS,
  BOOTSTRAP_SYNTH_TIMEOUT_MS,
  withTimeout,
} from './role-room-agent-llm-util.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('Role Room response time budgets', () => {
  it('keeps optional model work well below the public proxy ceiling', () => {
    expect(BOOTSTRAP_SYNTH_TIMEOUT_MS).toBe(10_000);
    expect(BOOTSTRAP_POSTPROCESS_TIMEOUT_MS).toBe(2_500);
    expect(BOOTSTRAP_SYNTH_TIMEOUT_MS + BOOTSTRAP_POSTPROCESS_TIMEOUT_MS)
      .toBeLessThan(15_000);
  });

  it('rejects stalled optional work at the configured boundary', async () => {
    vi.useFakeTimers();
    const stalled = new Promise<string>(() => undefined);
    const result = withTimeout(stalled, 100, 'role_room_budget_timeout');
    const rejection = expect(result).rejects.toThrow('role_room_budget_timeout');

    await vi.advanceTimersByTimeAsync(100);

    await rejection;
  });
});
