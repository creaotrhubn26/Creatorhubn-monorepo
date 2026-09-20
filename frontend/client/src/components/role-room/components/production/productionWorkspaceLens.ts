export const ROLE_ROOM_WORKSPACE_LENSES = [
  'full',
  'producer',
  'director',
  'casting',
  'cinematography',
  'assistant-direction',
  'production-management',
  'production-coordination',
  'location-management',
  'continuity',
  'art-department',
  // Plattformflate, ikke en produksjonsrolle: kun super admin, og den eneste
  // linsen som ikke velges av prosjektrollen din.
  'admin',
] as const;

export type RoleRoomWorkspaceLens = (typeof ROLE_ROOM_WORKSPACE_LENSES)[number];

export function isRoleRoomWorkspaceLens(value: unknown): value is RoleRoomWorkspaceLens {
  return typeof value === 'string'
    && ROLE_ROOM_WORKSPACE_LENSES.includes(value as RoleRoomWorkspaceLens);
}
