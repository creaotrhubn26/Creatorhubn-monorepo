/**
 * ProjectActivityPanel — «Nylig aktivitet» i ett prosjekt.
 *
 * Leser de SAMME radene som bjella (`project_notifications`), bare uten
 * mottakerfilter: hele teamets hendelser i tidsrekkefølge. Derfor ingen egen
 * aktivitetstabell og ingen fem-veis UNION — én indeksert spørring.
 */
import React from 'react';
import { Box, List, ListItem, Stack, Typography } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { useUserEventStream } from '@/hooks/useUserEventStream';
import { ws } from './workspaceTheme';
import { relativeTime, type ProjectNotification } from './NotificationBell';

const EVENT_DOT: Record<string, string> = {
  'task.assigned': ws.blue,
  'chat.mention': ws.accent,
  'deliverable.file-added': ws.green,
  'deliverable.due-soon': ws.amber,
};

interface ProjectActivityPanelProps {
  projectId: string;
  limit?: number;
}

const ProjectActivityPanel: React.FC<ProjectActivityPanelProps> = ({ projectId, limit = 15 }) => {
  const [activity, setActivity] = React.useState<ProjectNotification[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!projectId) return;
    try {
      const data = (await apiRequest(
        `/api/projects/${encodeURIComponent(projectId)}/notifications?limit=${limit}`,
      )) as { activity?: ProjectNotification[] };
      setActivity(Array.isArray(data?.activity) ? data.activity : []);
    } catch {
      // Panelet er sekundært innhold — la forrige liste stå ved feil.
    } finally {
      setLoaded(true);
    }
  }, [projectId, limit]);

  React.useEffect(() => { void load(); }, [load]);

  useUserEventStream({
    enabled: Boolean(projectId),
    onEvent: (event) => {
      if (event.kind === 'project.notification' && event.projectId === projectId) void load();
    },
    onReconnect: () => { void load(); },
  });

  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: ws.textDim, letterSpacing: 0.4, mb: 1 }}>
        NYLIG AKTIVITET
      </Typography>
      {activity.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: ws.textFaint }}>
          {loaded ? 'Ingen aktivitet enda.' : 'Henter …'}
        </Typography>
      ) : (
        <List dense disablePadding>
          {activity.map((item) => (
            <ListItem key={item.id} disableGutters sx={{ alignItems: 'flex-start', py: 0.75 }}>
              <Stack direction="row" spacing={1.25} sx={{ width: '100%' }}>
                <Box sx={{ mt: 0.9, width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: EVENT_DOT[item.eventType] ?? ws.textFaint }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13 }}>{item.title}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{relativeTime(item.createdAt)}</Typography>
                </Box>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default ProjectActivityPanel;
