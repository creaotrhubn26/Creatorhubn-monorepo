import { describe, expect, it, beforeEach, vi } from 'vitest';
import { aiRateLimit, __resetRateLimitBucketsForTests } from './ai-rate-limiter.js';
import type { Request, Response, NextFunction } from 'express';

function mkReq(userId?: string, bearer?: string): Request {
  return {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    socket: { remoteAddress: '1.2.3.4' },
    userId,
  } as unknown as Request;
}

function mkRes(): { res: Response; statusCode: number | null; body: unknown; headers: Record<string, string> } {
  const state: { statusCode: number | null; body: unknown; headers: Record<string, string> } = {
    statusCode: null,
    body: null,
    headers: {},
  };
  const res = {
    setHeader: (k: string, v: string) => {
      state.headers[k] = v;
    },
    status: (code: number) => {
      state.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      state.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, ...state, get statusCode() { return state.statusCode; }, get body() { return state.body; }, get headers() { return state.headers; } };
}

describe('aiRateLimit', () => {
  beforeEach(() => {
    __resetRateLimitBucketsForTests();
  });

  it('calls next() for requests under the limit', () => {
    const limiter = aiRateLimit({ windowMs: 60_000, max: 3 });
    const req = mkReq('user-1');
    const { res } = mkRes();
    const next = vi.fn() as unknown as NextFunction;
    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('returns 429 + Retry-After once max is exceeded', () => {
    const limiter = aiRateLimit({ windowMs: 60_000, max: 2, label: 'Test' });
    const req = mkReq('user-1');
    const next = vi.fn() as unknown as NextFunction;
    limiter(req, mkRes().res, next);
    limiter(req, mkRes().res, next);
    const out = mkRes();
    limiter(req, out.res, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(out.statusCode).toBe(429);
    expect(out.headers['Retry-After']).toBeDefined();
    expect((out.body as { error: string }).error).toBe('rate_limited');
  });

  it('tracks different userIds independently', () => {
    const limiter = aiRateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;
    limiter(mkReq('user-a'), mkRes().res, next);
    limiter(mkReq('user-b'), mkRes().res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('falls back to bearer token when userId is absent', () => {
    const limiter = aiRateLimit({ windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;
    limiter(mkReq(undefined, 'token-a'), mkRes().res, next);
    limiter(mkReq(undefined, 'token-b'), mkRes().res, next);
    expect(next).toHaveBeenCalledTimes(2);
    // Third call with token-a should now be blocked
    const out = mkRes();
    limiter(mkReq(undefined, 'token-a'), out.res, next);
    expect(out.statusCode).toBe(429);
  });

  it('resets after window elapses', () => {
    const limiter = aiRateLimit({ windowMs: 50, max: 1 });
    const req = mkReq('user-1');
    const next = vi.fn() as unknown as NextFunction;
    limiter(req, mkRes().res, next);
    const blocked = mkRes();
    limiter(req, blocked.res, next);
    expect(blocked.statusCode).toBe(429);
    // Wait past the window
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const after = mkRes();
        limiter(req, after.res, next);
        expect(after.statusCode).toBeNull();
        expect(next).toHaveBeenCalledTimes(2); // 1 allowed + 1 after reset
        resolve();
      }, 60);
    });
  });
});
