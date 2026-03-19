export function isRoleRoomStandaloneRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = window.location.pathname.toLowerCase();
  return pathname === '/casting.html' || pathname.endsWith('/casting.html');
}

export function shouldUseRoleRoomLocalFallback(): boolean {
  return isRoleRoomStandaloneRuntime();
}
