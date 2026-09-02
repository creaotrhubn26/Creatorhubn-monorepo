import { describe, expect, it } from 'vitest';
import { ROLE_ROOM_LINKEDIN_OAUTH_SCOPES } from './role-room-linkedin-oauth-scopes.js';

describe('Role Room LinkedIn organic OAuth scopes', () => {
  it('includes the Share on LinkedIn permission for personal publishing', () => {
    expect(ROLE_ROOM_LINKEDIN_OAUTH_SCOPES).toContain('w_member_social');
  });

  it('keeps identity scopes required by the profile connection flow', () => {
    expect(ROLE_ROOM_LINKEDIN_OAUTH_SCOPES).toEqual(
      expect.arrayContaining(['openid', 'profile', 'email']),
    );
  });

  it('does not request organization publishing without Community Management approval', () => {
    expect(ROLE_ROOM_LINKEDIN_OAUTH_SCOPES).not.toContain('w_organization_social');
  });
});
