export interface SoundRoomVersionLike {
  id: string;
  version_number?: number | string | null;
  status?: string | null;
}

export function sortSoundRoomVersionsNewest<T extends SoundRoomVersionLike>(versions: readonly T[]): T[] {
  return [...versions].sort((left, right) => Number(right.version_number || 0) - Number(left.version_number || 0));
}

export function newestSoundRoomVersion<T extends SoundRoomVersionLike>(versions: readonly T[]): T | null {
  return sortSoundRoomVersionsNewest(versions)[0] || null;
}

export function latestApprovedSoundRoomVersion<T extends SoundRoomVersionLike>(versions: readonly T[]): T | null {
  return sortSoundRoomVersionsNewest(versions).find((version) => version.status === 'approved') || null;
}
