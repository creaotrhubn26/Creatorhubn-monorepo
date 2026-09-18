import { describe, expect, it } from 'vitest';

import { DEV_ADMIN_SESSION_TOKEN } from './hooks/devAdminSessionGuard';
import { resolveCastingHarnessAuth } from './testHarnessCastingAuth';

const resolve = (
  url: string,
  overrides: Partial<{
    viteDevelopmentMode: boolean;
    hostname: string;
    featureEnabled: string | undefined;
  }> = {},
) =>
  resolveCastingHarnessAuth({
    url,
    viteDevelopmentMode: true,
    hostname: 'localhost',
    featureEnabled: 'true',
    ...overrides,
  });

describe('casting E2E harness auth', () => {
  it('seeds the known token only in explicitly enabled loopback development', () => {
    expect(resolve('http://localhost/e2e-casting-test.html').token).toBe(
      DEV_ADMIN_SESSION_TOKEN,
    );
    expect(
      resolve('http://localhost/e2e-casting-test.html', {
        featureEnabled: undefined,
      }).token,
    ).toBeNull();
    expect(
      resolve('http://192.168.1.20/e2e-casting-test.html', {
        hostname: '192.168.1.20',
      }).token,
    ).toBeNull();
  });

  it('accepts a real session only from the fragment and scrubs it immediately', () => {
    expect(
      resolve(
        'http://192.168.1.20/e2e-casting-test.html?project=p1#token=real-session&tab=board',
        { hostname: '192.168.1.20', featureEnabled: undefined },
      ),
    ).toEqual({
      token: 'real-session',
      sanitizedPath: '/e2e-casting-test.html?project=p1#tab=board',
    });
  });

  it('never accepts tokens from query strings and preserves unrelated state', () => {
    expect(
      resolve(
        'http://localhost/e2e-casting-test.html?project=p1&token=legacy-secret#tab=board',
        { featureEnabled: undefined },
      ),
    ).toEqual({
      token: null,
      sanitizedPath: '/e2e-casting-test.html?project=p1#tab=board',
    });
  });

  it('rejects the known token from a fragment on a non-loopback host', () => {
    expect(
      resolve(
        `http://192.168.1.20/e2e-casting-test.html#token=${DEV_ADMIN_SESSION_TOKEN}`,
        { hostname: '192.168.1.20' },
      ).token,
    ).toBeNull();
  });
});
