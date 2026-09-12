export const ROLE_ROOM_WORKSPACE_LENSES = [
  'full',
  'director',
  'cinematography',
  'assistant-direction',
  'production-management',
  'production-coordination',
  'continuity',
] as const;

export type RoleRoomWorkspaceLens = (typeof ROLE_ROOM_WORKSPACE_LENSES)[number];

export function isRoleRoomWorkspaceLens(value: unknown): value is RoleRoomWorkspaceLens {
  return typeof value === 'string'
    && ROLE_ROOM_WORKSPACE_LENSES.includes(value as RoleRoomWorkspaceLens);
}
