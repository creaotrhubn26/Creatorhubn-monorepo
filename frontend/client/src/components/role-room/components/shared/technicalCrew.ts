import type { CrewMember } from '../../models/casting';

export type TechnicalCrewSubgroup = 'all' | 'camera' | 'lighting' | 'sound' | 'post';

export const TECHNICAL_CREW_SUBGROUP_LABELS: Record<TechnicalCrewSubgroup, string> = {
  all: 'Alle tekniske',
  camera: 'Kamera',
  lighting: 'Lys',
  sound: 'Lyd',
  post: 'Post',
};

export const TECHNICAL_DEPARTMENTS = new Set<TechnicalCrewSubgroup>([
  'camera',
  'lighting',
  'sound',
  'post',
]);

export const TECHNICAL_ROLE_TO_SUBGROUP: Record<string, TechnicalCrewSubgroup> = {
  cinematographer: 'camera',
  camera_operator: 'camera',
  camera_assistant: 'camera',
  drone_pilot: 'camera',
  gaffer: 'lighting',
  grip: 'lighting',
  sound_engineer: 'sound',
  audio_mixer: 'sound',
  video_editor: 'post',
  colorist: 'post',
  vfx_artist: 'post',
  motion_graphics: 'post',
};

export const TECHNICAL_CAPACITY_BY_ROLE: Record<string, number> = {
  cinematographer: 9,
  camera_operator: 10,
  camera_assistant: 12,
  drone_pilot: 8,
  gaffer: 9,
  grip: 11,
  sound_engineer: 10,
  audio_mixer: 10,
  video_editor: 14,
  colorist: 13,
  vfx_artist: 11,
  motion_graphics: 12,
};

export const CREW_ROLE_COLOR_PALETTE: Record<string, string> = {
  director: '#ef4444',
  producer: '#f97316',
  production_manager: '#fb7185',
  cinematographer: '#8b5cf6',
  camera_operator: '#6366f1',
  camera_assistant: '#4f46e5',
  drone_pilot: '#3b82f6',
  gaffer: '#f59e0b',
  grip: '#fbbf24',
  sound_engineer: '#06b6d4',
  audio_mixer: '#0891b2',
  video_editor: '#10b981',
  colorist: '#22c55e',
  vfx_artist: '#ec4899',
  motion_graphics: '#a855f7',
  other: '#64748b',
};

export function getRoleColor(role?: string): string {
  if (!role) return CREW_ROLE_COLOR_PALETTE.other;
  return CREW_ROLE_COLOR_PALETTE[role] ?? CREW_ROLE_COLOR_PALETTE.other;
}

export function getTechnicalSubgroupForMember(member: CrewMember): TechnicalCrewSubgroup | 'other' {
  const department = String(member.department ?? '').toLowerCase() as TechnicalCrewSubgroup;
  if (TECHNICAL_DEPARTMENTS.has(department)) {
    return department;
  }
  const role = String(member.role ?? '').toLowerCase();
  return TECHNICAL_ROLE_TO_SUBGROUP[role] ?? 'other';
}

export function isTechnicalCrewMember(member: CrewMember, subgroup: TechnicalCrewSubgroup = 'all'): boolean {
  const memberSubgroup = getTechnicalSubgroupForMember(member);
  if (memberSubgroup === 'other') {
    return false;
  }
  return subgroup === 'all' || memberSubgroup === subgroup;
}

export function getRoleCapacity(role?: string): number {
  if (!role) return 10;
  return TECHNICAL_CAPACITY_BY_ROLE[String(role).toLowerCase()] ?? 10;
}

export function getRoleLabel(role?: string): string {
  if (!role) return 'Ukjent rolle';
  return String(role).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
