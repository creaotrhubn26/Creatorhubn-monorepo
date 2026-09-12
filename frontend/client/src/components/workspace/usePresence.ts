// @ts-nocheck
/**
 * usePresence — ekte online-sync for Team Workspace.
 *
 * Sender heartbeat (POST /api/presence/heartbeat) hvert 30s mens workspacet er
 * åpent og fanen er synlig, og poller teamets presence
 * (GET /api/projects/:id/team/presence) for online-antall + hvem som er på.
 * Pauser når document.hidden (sparer kall). Stille fallback.
 */
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { PresenceMember } from './workspacePresence';
export { roomOnlineState } from './workspacePresence';
export type { PresenceMember } from './workspacePresence';


export function usePresence(projectId: string, route?: string) {
  const [online, setOnline] = useState<number | null>(null);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const timers = useRef<any>({});

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const beat = () => {
      if (document.hidden) return;
      const activeRoute = route || `/workspace/${projectId}`;
      const segments = activeRoute.split(/[?#]/, 1)[0].split('/').filter(Boolean);
      const workspaceIndex = segments.indexOf('workspace');
      const tab = workspaceIndex >= 0 ? segments[workspaceIndex + 2] : undefined;
      apiRequest('/api/presence/heartbeat', {
        method: 'POST',
        body: { route: activeRoute, projectId, tab },
      }).catch(() => {});
    };
    const poll = () => {
      if (document.hidden) return;
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/presence`)
        .then((r: any) => { if (!cancelled && r) { setOnline(typeof r.online === 'number' ? r.online : null); setMembers(Array.isArray(r.members) ? r.members : []); } })
        .catch(() => {});
    };

    beat(); poll();
    timers.current.beat = setInterval(beat, 30000);
    timers.current.poll = setInterval(poll, 30000);
    const onVis = () => { if (!document.hidden) { beat(); poll(); } };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(timers.current.beat);
      clearInterval(timers.current.poll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [projectId, route]);

  return { online, members };
}
