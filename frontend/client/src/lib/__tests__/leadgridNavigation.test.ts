import { describe, expect, it } from 'vitest';
import {
  describeLeadgridPaidIntent,
  isLeadgridStandalonePath,
  parseLeadgridSignupIntent,
  resolveLeadgridSupplementalRoute,
} from '../leadgridNavigation';

describe('Leadgrid web navigation contract', () => {
  it('selects the standalone router for every /leadgrid path, but not lookalikes', () => {
    expect(isLeadgridStandalonePath('/leadgrid')).toBe(true);
    expect(isLeadgridStandalonePath('/leadgrid/map?from=import')).toBe(true);
    expect(isLeadgridStandalonePath('/leadgridish')).toBe(false);
    expect(isLeadgridStandalonePath('/admin-workspace')).toBe(false);
  });

  it.each([
    ['/leadgrid/developers', { kind: 'developers' }],
    ['/leadgrid/developers/', { kind: 'developers' }],
    ['/leadgrid/partners', { kind: 'partners' }],
    ['/leadgrid/map', { kind: 'status', status: 'map' }],
    ['/leadgrid/api-keys', { kind: 'status', status: 'api_keys' }],
    [
      '/leadgrid/docs/slack',
      { kind: 'status', status: 'connector_docs', requestedConnector: 'slack' },
    ],
  ])('resolves the documented legacy target %s', (path, expected) => {
    expect(resolveLeadgridSupplementalRoute(path)).toEqual(expected);
  });

  it('leaves canonical routes with the existing router and makes unknown routes explicit', () => {
    expect(resolveLeadgridSupplementalRoute('/leadgrid/import')).toBeNull();
    expect(resolveLeadgridSupplementalRoute('/leadgrid/welcome')).toBeNull();
    expect(resolveLeadgridSupplementalRoute('/leadgrid/utviklere')).toBeNull();
    expect(resolveLeadgridSupplementalRoute('/leadgrid/no-such-page')).toEqual({
      kind: 'status',
      status: 'not_found',
    });
  });

  it('parses the free signup handoff', () => {
    expect(parseLeadgridSignupIntent('?signup=solo_free')).toEqual({
      kind: 'free',
      plan: 'solo_free',
    });
  });

  it('preserves paid plan and billing context', () => {
    const intent = parseLeadgridSignupIntent('?signup=solo_pro&billing=yearly');
    expect(intent).toEqual({ kind: 'paid', plan: 'solo_pro', billing: 'yearly' });
    if (intent?.kind === 'paid') {
      expect(describeLeadgridPaidIntent(intent)).toBe('Solo Pro · årlig betaling');
    }
  });

  it('defaults invalid paid billing to monthly and rejects unknown plans', () => {
    expect(parseLeadgridSignupIntent('signup=agency&billing=weekly')).toEqual({
      kind: 'paid',
      plan: 'agency',
      billing: 'monthly',
    });
    expect(parseLeadgridSignupIntent('?signup=enterprise')).toBeNull();
    expect(parseLeadgridSignupIntent('')).toBeNull();
  });
});
