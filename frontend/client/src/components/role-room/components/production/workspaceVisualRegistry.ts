import type { RoleRoomWorkspaceLens } from './productionWorkspaceLens';

export type RoleRoomVisualFamily = 'development' | 'casting' | 'production' | 'post';

export interface RoleRoomWorkspaceVisualDefinition {
  family: RoleRoomVisualFamily;
  src: string;
  label: string;
  objectPosition: string;
}

const VISUAL_FAMILIES: Record<RoleRoomVisualFamily, Omit<RoleRoomWorkspaceVisualDefinition, 'family'>> = {
  development: {
    src: '/assets/role-room/workspace-atmosphere/development-v1.webp',
    label: 'Manus, storyboard og planlegging',
    objectPosition: 'center 52%',
  },
  casting: {
    src: '/assets/role-room/workspace-atmosphere/casting-v1.webp',
    label: 'Castingrom klart for audition',
    objectPosition: 'center 58%',
  },
  production: {
    src: '/assets/role-room/workspace-atmosphere/production-v1.webp',
    label: 'Produksjonssett mellom opptak',
    objectPosition: 'center 55%',
  },
  post: {
    src: '/assets/role-room/workspace-atmosphere/post-v1.webp',
    label: 'Postproduksjon og ferdigstilling',
    objectPosition: 'center 48%',
  },
};

const FAMILY_BY_LENS: Record<RoleRoomWorkspaceLens, RoleRoomVisualFamily> = {
  full: 'development',
  producer: 'production',
  director: 'production',
  casting: 'casting',
  cinematography: 'production',
  'assistant-direction': 'production',
  'production-management': 'production',
  'production-coordination': 'production',
  'location-management': 'production',
  continuity: 'production',
  'art-department': 'production',
  'production-sound': 'production',
  'post-production': 'post',
  admin: 'development',
};

export function getRoleRoomWorkspaceVisual(lens: RoleRoomWorkspaceLens): RoleRoomWorkspaceVisualDefinition {
  const family = FAMILY_BY_LENS[lens];
  return { family, ...VISUAL_FAMILIES[family] };
}
