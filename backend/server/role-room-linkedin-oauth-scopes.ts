/**
 * OAuth-scopes for organic LinkedIn publishing inside The Role Room Agent
 * and Leadgrid Markedssjef-modus.
 *
 * Base: `w_member_social` (self-serve «Share on LinkedIn») + OpenID for
 * profil/e-post.
 *
 * Organisasjons-scopes (Community Management API, godkjent på appen bak
 * LINKEDIN_CLIENT_ID — samme som cockpit-flyten i linkedin-oauth-routes.ts):
 *   - w_organization_social  publisere som bedriftsside
 *   - r_organization_social  lese statistikk for bedriftsposter
 *                            (organizationalEntityShareStatistics)
 *   - r_organization_admin   liste sidene medlemmet administrerer (organizationAcls)
 * Personposter kan ikke leses: `r_member_social` er stengt for nye søkere,
 * så bedriftssiden er eneste vei til rekkevidde-tall.
 *
 * ROLE_ROOM_LINKEDIN_ORG_SCOPES=off skrur organisasjons-scopene av uten
 * deploy hvis LinkedIn skulle avvise dem (unauthorized_scope_error rammer
 * alle tilkoblinger, ikke bare bedrifts-brukerne).
 */
export const ROLE_ROOM_LINKEDIN_OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
] as const;

export const ROLE_ROOM_LINKEDIN_ORG_SCOPES = [
  'w_organization_social',
  'r_organization_social',
  'r_organization_admin',
] as const;

export function roleRoomLinkedInOrgScopesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.ROLE_ROOM_LINKEDIN_ORG_SCOPES ?? '').trim().toLowerCase() !== 'off';
}

/** Scopes som faktisk bes om i authorize-URL-en (og lagres som fallback). */
export function buildRoleRoomLinkedInOauthScopes(env: NodeJS.ProcessEnv = process.env): string[] {
  return roleRoomLinkedInOrgScopesEnabled(env)
    ? [...ROLE_ROOM_LINKEDIN_OAUTH_SCOPES, ...ROLE_ROOM_LINKEDIN_ORG_SCOPES]
    : [...ROLE_ROOM_LINKEDIN_OAUTH_SCOPES];
}

/** Har en lagret tilkobling scopene som trengs for bedriftsside? */
export function hasLinkedInOrgScopes(scopes: unknown): boolean {
  if (!Array.isArray(scopes)) return false;
  const set = new Set(scopes.map((s) => String(s)));
  return set.has('w_organization_social') && set.has('r_organization_admin');
}
