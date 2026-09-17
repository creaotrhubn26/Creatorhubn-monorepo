import { describe, expect, it } from 'vitest';
import {
  ROLE_ROOM_LINKEDIN_OAUTH_SCOPES,
  buildRoleRoomLinkedInOauthScopes,
  hasLinkedInOrgScopes,
} from './role-room-linkedin-oauth-scopes.js';

describe('Role Room LinkedIn organic OAuth scopes', () => {
  it('includes the Share on LinkedIn permission for personal publishing', () => {
    expect(ROLE_ROOM_LINKEDIN_OAUTH_SCOPES).toContain('w_member_social');
  });

  it('keeps identity scopes required by the profile connection flow', () => {
    expect(ROLE_ROOM_LINKEDIN_OAUTH_SCOPES).toEqual(
      expect.arrayContaining(['openid', 'profile', 'email']),
    );
  });

  it('requests organization publishing + statistics scopes by default (Community Management approved)', () => {
    expect(buildRoleRoomLinkedInOauthScopes({})).toEqual([
      'openid',
      'profile',
      'email',
      'w_member_social',
      'w_organization_social',
      'r_organization_social',
      'r_organization_admin',
    ]);
  });

  it('drops the organization scopes without a deploy when ROLE_ROOM_LINKEDIN_ORG_SCOPES=off', () => {
    expect(buildRoleRoomLinkedInOauthScopes({ ROLE_ROOM_LINKEDIN_ORG_SCOPES: 'off' })).toEqual([
      ...ROLE_ROOM_LINKEDIN_OAUTH_SCOPES,
    ]);
    expect(buildRoleRoomLinkedInOauthScopes({ ROLE_ROOM_LINKEDIN_ORG_SCOPES: ' OFF ' })).not.toContain(
      'w_organization_social',
    );
  });

  it('recognises a stored connection that can publish as a company page', () => {
    expect(hasLinkedInOrgScopes(['w_member_social'])).toBe(false);
    expect(hasLinkedInOrgScopes(['w_organization_social'])).toBe(false);
    expect(hasLinkedInOrgScopes(['w_organization_social', 'r_organization_admin'])).toBe(true);
    expect(hasLinkedInOrgScopes(null)).toBe(false);
  });
});
