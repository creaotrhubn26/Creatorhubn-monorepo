export interface PresenceMember {
  userId: string;
  email: string;
  name: string;
  crewRole: string | null;
  online: boolean;
  currentRoute: string | null;
}

export function roomOnlineState(members: PresenceMember[], projectId?: string): Record<string, boolean> {
  const rooms: Record<string, boolean> = {
    'photo-room': false,
    'video-room': false,
    'sound-room': false,
  };
  for (const member of members) {
    if (!member.online || !member.currentRoute) continue;
    const segments = member.currentRoute.split(/[?#]/, 1)[0].split('/').filter(Boolean);
    const workspaceIndex = segments.indexOf('workspace');
    if (workspaceIndex < 0) continue;
    if (projectId && segments[workspaceIndex + 1] !== projectId) continue;
    const routeTab = segments[workspaceIndex + 2];
    if (routeTab && routeTab in rooms) rooms[routeTab] = true;
  }
  return rooms;
}
