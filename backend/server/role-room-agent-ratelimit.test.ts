import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkAgentRateLimit,
  RateLimitExceededError,
} from './role-room-agent-ratelimit.js';

// Note: the limiter uses module-level in-memory maps, so each test gets a
// unique userId/projectId to guarantee independence.
function uid(suffix = ''): string {
  return `user-${Math.random().toString(36).slice(2, 10)}${suffix}`;
}
function pid(suffix = ''): string {
  return `proj-${Math.random().toString(36).slice(2, 10)}${suffix}`;
}

describe('checkAgentRateLimit', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.ROLE_ROOM_AGENT_RATE_LIMIT;
    delete process.env.ROLE_ROOM_AGENT_RL_USER_MIN;
    delete process.env.ROLE_ROOM_AGENT_RL_USER_HOUR;
    delete process.env.ROLE_ROOM_AGENT_RL_PROJECT_MIN;
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows calls under the per-user-minute cap', () => {
    process.env.ROLE_ROOM_AGENT_RL_USER_MIN = '5';
    process.env.ROLE_ROOM_AGENT_RL_USER_HOUR = '1000';
    process.env.ROLE_ROOM_AGENT_RL_PROJECT_MIN = '1000';
    const u = uid();
    const p = pid();
    for (let i = 0; i < 5; i++) {
      expect(() => checkAgentRateLimit(u, p)).not.toThrow();
    }
  });

  it('throws RateLimitExceededError once the per-user-minute cap is hit', () => {
    process.env.ROLE_ROOM_AGENT_RL_USER_MIN = '3';
    process.env.ROLE_ROOM_AGENT_RL_USER_HOUR = '1000';
    process.env.ROLE_ROOM_AGENT_RL_PROJECT_MIN = '1000';
    const u = uid();
    const p = pid();
    checkAgentRateLimit(u, p);
    checkAgentRateLimit(u, p);
    checkAgentRateLimit(u, p);
    try {
      checkAgentRateLimit(u, p);
      expect.unreachable('expected rate limit error');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitExceededError);
      const rl = err as RateLimitExceededError;
      expect(rl.scope).toBe('user_minute');
      expect(rl.retryAfterSeconds).toBeGreaterThan(0);
      expect(rl.retryAfterSeconds).toBeLessThanOrEqual(60);
    }
  });

  it('applies the per-project cap independently of the per-user cap', () => {
    process.env.ROLE_ROOM_AGENT_RL_USER_MIN = '1000';
    process.env.ROLE_ROOM_AGENT_RL_USER_HOUR = '1000';
    process.env.ROLE_ROOM_AGENT_RL_PROJECT_MIN = '2';
    const p = pid();
    // Two different users hit the same project — project cap should kick in.
    checkAgentRateLimit(uid('a'), p);
    checkAgentRateLimit(uid('b'), p);
    expect(() => checkAgentRateLimit(uid('c'), p)).toThrowError(RateLimitExceededError);
  });

  it('keeps buckets independent per user', () => {
    process.env.ROLE_ROOM_AGENT_RL_USER_MIN = '1';
    process.env.ROLE_ROOM_AGENT_RL_USER_HOUR = '1000';
    process.env.ROLE_ROOM_AGENT_RL_PROJECT_MIN = '1000';
    const p = pid();
    const userA = uid('a');
    const userB = uid('b');
    checkAgentRateLimit(userA, p);
    expect(() => checkAgentRateLimit(userA, p)).toThrowError(RateLimitExceededError);
    // Different user — fresh bucket.
    expect(() => checkAgentRateLimit(userB, p)).not.toThrow();
  });

  it('is a no-op when ROLE_ROOM_AGENT_RATE_LIMIT=off', () => {
    process.env.ROLE_ROOM_AGENT_RATE_LIMIT = 'off';
    process.env.ROLE_ROOM_AGENT_RL_USER_MIN = '1';
    const u = uid();
    const p = pid();
    for (let i = 0; i < 50; i++) {
      expect(() => checkAgentRateLimit(u, p)).not.toThrow();
    }
  });
});
