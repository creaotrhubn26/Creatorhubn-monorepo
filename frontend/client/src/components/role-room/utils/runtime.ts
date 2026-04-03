export const ROLE_ROOM_CANONICAL_PATH = '/theroleroom';
export const ROLE_ROOM_LEGACY_PATH = '/casting.html';
export const ROLE_ROOM_TALENT_PORTAL_PATH = '/talentportal';
export const ROLE_ROOM_EDUCATION_PATH = '/utdanningsinstitusjon';
const ROLE_ROOM_DEDICATED_HOSTS = new Set([
  'theroleroom.com',
  'www.theroleroom.com',
  'localhost',
  '127.0.0.1',
]);

export function isRoleRoomDedicatedHost(hostname: string | null | undefined): boolean {
  if (typeof hostname !== 'string') {
    return false;
  }
  return ROLE_ROOM_DEDICATED_HOSTS.has(hostname.trim().toLowerCase());
}

export function getRoleRoomCanonicalPath(locationLike?: Pick<Location, 'hostname'> | null): string {
  return isRoleRoomDedicatedHost(locationLike?.hostname) ? '/' : ROLE_ROOM_CANONICAL_PATH;
}

export function normalizeRoleRoomStandalonePath(
  pathname: string,
  locationLike?: Pick<Location, 'hostname'> | null,
): string {
  const fallbackPath = getRoleRoomCanonicalPath(locationLike);
  const trimmedPath = pathname.trim();
  if (!trimmedPath) {
    return fallbackPath;
  }

  const lowerPath = trimmedPath.toLowerCase();
  if (
    lowerPath === ROLE_ROOM_LEGACY_PATH
    || lowerPath === ROLE_ROOM_CANONICAL_PATH
    || lowerPath === `${ROLE_ROOM_CANONICAL_PATH}/`
  ) {
    return fallbackPath;
  }
  if (
    isRoleRoomDedicatedHost(locationLike?.hostname)
    && (lowerPath === ROLE_ROOM_TALENT_PORTAL_PATH || lowerPath === `${ROLE_ROOM_TALENT_PORTAL_PATH}/`)
  ) {
    return ROLE_ROOM_TALENT_PORTAL_PATH;
  }
  if (
    isRoleRoomDedicatedHost(locationLike?.hostname)
    && (lowerPath === ROLE_ROOM_EDUCATION_PATH || lowerPath === `${ROLE_ROOM_EDUCATION_PATH}/`)
  ) {
    return ROLE_ROOM_EDUCATION_PATH;
  }
  if (isRoleRoomDedicatedHost(locationLike?.hostname) && lowerPath === '/') {
    return '/';
  }

  return trimmedPath;
}

export function isRoleRoomStandalonePathname(
  pathname: string,
  locationLike?: Pick<Location, 'hostname'> | null,
): boolean {
  const normalizedPath = pathname.trim().toLowerCase();
  if (isRoleRoomDedicatedHost(locationLike?.hostname) && (normalizedPath === '' || normalizedPath === '/')) {
    return true;
  }
  if (
    isRoleRoomDedicatedHost(locationLike?.hostname)
    && (normalizedPath === ROLE_ROOM_TALENT_PORTAL_PATH || normalizedPath === `${ROLE_ROOM_TALENT_PORTAL_PATH}/`)
  ) {
    return true;
  }
  if (
    isRoleRoomDedicatedHost(locationLike?.hostname)
    && (normalizedPath === ROLE_ROOM_EDUCATION_PATH || normalizedPath === `${ROLE_ROOM_EDUCATION_PATH}/`)
  ) {
    return true;
  }
  return normalizedPath === ROLE_ROOM_CANONICAL_PATH
    || normalizedPath === `${ROLE_ROOM_CANONICAL_PATH}/`
    || normalizedPath === ROLE_ROOM_LEGACY_PATH
    || normalizedPath.endsWith(ROLE_ROOM_LEGACY_PATH);
}

export function isRoleRoomEducationPathname(
  pathname: string,
  locationLike?: Pick<Location, 'hostname'> | null,
): boolean {
  const normalizedPath = pathname.trim().toLowerCase();
  return isRoleRoomDedicatedHost(locationLike?.hostname)
    && (normalizedPath === ROLE_ROOM_EDUCATION_PATH || normalizedPath === `${ROLE_ROOM_EDUCATION_PATH}/`);
}

export function getRoleRoomReturnPath(
  locationLike?: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'> | null,
): string {
  const pathname = locationLike?.pathname ?? '';
  const search = locationLike?.search ?? '';
  const hash = locationLike?.hash ?? '';
  const fallbackPath = getRoleRoomCanonicalPath(locationLike);
  const roleRoomPath = isRoleRoomStandalonePathname(pathname, locationLike)
    ? normalizeRoleRoomStandalonePath(pathname, locationLike)
    : fallbackPath;
  return `${roleRoomPath}${search}${hash}`;
}

export function isRoleRoomStandaloneRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isRoleRoomStandalonePathname(window.location.pathname, window.location);
}

export function shouldUseRoleRoomLocalFallback(): boolean {
  return isRoleRoomStandaloneRuntime();
}
