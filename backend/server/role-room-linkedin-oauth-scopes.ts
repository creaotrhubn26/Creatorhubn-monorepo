/**
 * OAuth-scopes for organic LinkedIn publishing inside The Role Room Agent.
 *
 * `w_member_social` is granted by the self-serve "Share on LinkedIn" product.
 * Organization publishing is intentionally not requested here: it requires
 * separate LinkedIn Community Management API approval.
 */
export const ROLE_ROOM_LINKEDIN_OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
] as const;
