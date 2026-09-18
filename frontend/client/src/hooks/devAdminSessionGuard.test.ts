import { describe, expect, it } from 'vitest';
import {
  canUseLocalDevAdminSession,
  isDevAdminLoopbackHostname,
} from './devAdminSessionGuard';

describe('local dev admin session guard', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '::1',
    '[::1]',
  ])('allows the documented loopback hostname %s in Vite development mode', (hostname) => {
    expect(canUseLocalDevAdminSession(true, hostname, 'true')).toBe(true);
  });

  it.each([
    'creatorhub-preview.netlify.app',
    'localhost.example.com',
    '127.0.0.1.example.com',
    '127.0.0.2',
    '',
  ])('rejects the non-loopback hostname %s even in Vite development mode', (hostname) => {
    expect(canUseLocalDevAdminSession(true, hostname, 'true')).toBe(false);
  });

  it('rejects the dev admin session outside Vite development mode', () => {
    expect(canUseLocalDevAdminSession(false, 'localhost', 'true')).toBe(false);
    expect(canUseLocalDevAdminSession(false, '127.0.0.1', 'true')).toBe(false);
    expect(canUseLocalDevAdminSession(false, '::1', 'true')).toBe(false);
  });

  it('requires the explicit local-admin feature flag', () => {
    expect(canUseLocalDevAdminSession(true, 'localhost', undefined)).toBe(false);
    expect(canUseLocalDevAdminSession(true, 'localhost', 'false')).toBe(false);
    expect(canUseLocalDevAdminSession(true, 'localhost', 'TRUE')).toBe(false);
  });

  it('normalizes bracketed IPv6 and hostname casing without widening the allowlist', () => {
    expect(isDevAdminLoopbackHostname(' [::1] ')).toBe(true);
    expect(isDevAdminLoopbackHostname('LOCALHOST')).toBe(true);
    expect(isDevAdminLoopbackHostname('preview.localhost')).toBe(false);
  });
});
