/**
 * NotificationBell — hendelsesinnboksen i workspace-headeren.
 *
 * Leser `/api/project-notifications` (rader fra `project_notifications`) og
 * lytter på `project.notification` i den delte brukerstrømmen, så nye varsler
 * dukker opp uten polling. Bevisst NY komponent: `NotificationCenter.tsx` er
 * død kode som kaller fire endepunkter som ikke finnes og faller tilbake på
 * mockdata når fetch feiler.
 */
import React from 'react';
import {
  Badge, Box, Button, Divider, IconButton, List, ListItemButton, Popover, Stack, Tooltip, Typography,
} from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { apiRequest } from '@/lib/queryClient';
import { useUserEventStream } from '@/hooks/useUserEventStream';
import { ws } from './workspaceTheme';

export interface ProjectNotification {
  id: string;
  projectId: string;
  eventType: string;
  title: string;
  message: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  dueAt: string | null;
  createdAt: string;
  readAt?: string | null;
}

interface InboxResponse {
  notifications: ProjectNotification[];
  unreadCount: number;
}

const EVENT_LABEL: Record<string, string> = {
  'task.assigned': 'Oppgave',
  'chat.mention': 'Nevnt',
  'deliverable.file-added': 'Fil',
  'deliverable.due-soon': 'Frist',
};

export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((now - then) / 60000);
  if (minutes < 1) return 'nå';
  if (minutes < 60) return `${minutes} min siden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} t siden`;
  return `${Math.round(hours / 24)} d siden`;
}

interface NotificationBellProps {
  /** Åpner varselets prosjekt/entitet. Utelatt = raden er bare lesbar. */
  onOpen?: (notification: ProjectNotification) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onOpen }) => {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [items, setItems] = React.useState<ProjectNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiRequest('/api/project-notifications?limit=20')) as InboxResponse;
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnread(Number(data?.unreadCount ?? 0));
    } catch {
      // Bjella er ikke kritisk vei: en feilet henting lar forrige liste stå
      // i stedet for å blinke tom. Ingen mockdata.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  useUserEventStream({
    onEvent: (event) => {
      if (event.kind === 'project.notification') void load();
    },
    onReconnect: () => { void load(); },
  });

  const markRead = React.useCallback(async (notification: ProjectNotification) => {
    if (notification.readAt) return;
    // Optimistisk: telleren skal svare med én gang du klikker.
    setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    try {
      await apiRequest(`/api/project-notifications/${notification.id}/read`, { method: 'POST' });
    } catch {
      void load();
    }
  }, [load]);

  const markAllRead = React.useCallback(async () => {
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    setUnread(0);
    try {
      await apiRequest('/api/project-notifications/read-all', { method: 'POST' });
    } catch {
      void load();
    }
  }, [load]);

  return (
    <>
      <Tooltip title="Varsler">
        <IconButton
          size="small"
          aria-label={unread > 0 ? `Varsler, ${unread} uleste` : 'Varsler'}
          onClick={(e) => { setAnchor(e.currentTarget); void load(); }}
          sx={{ color: ws.textDim }}
        >
          <Badge badgeContent={unread} max={99} sx={{ '& .MuiBadge-badge': { bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 700 } }}>
            <NotificationsNoneIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxWidth: '92vw', bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Varsler</Typography>
          {unread > 0 && (
            <Button size="small" onClick={() => void markAllRead()} sx={{ textTransform: 'none', color: ws.accent, fontSize: 12.5 }}>
              Merk alle som lest
            </Button>
          )}
        </Stack>
        <Divider sx={{ borderColor: ws.borderSoft }} />

        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: ws.textDim }}>
              {loading ? 'Henter …' : 'Ingenting nytt.'}
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {items.map((n) => (
              <ListItemButton
                key={n.id}
                onClick={() => { void markRead(n); onOpen?.(n); }}
                sx={{
                  alignItems: 'flex-start', gap: 1.25, py: 1.25,
                  borderBottom: `1px solid ${ws.borderSoft}`,
                  bgcolor: n.readAt ? 'transparent' : ws.accentSoft,
                }}
              >
                <Box sx={{ mt: 0.75, width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: n.readAt ? 'transparent' : ws.accent }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: n.readAt ? 500 : 700 }}>{n.title}</Typography>
                  {n.message && (
                    <Typography sx={{ fontSize: 12.5, color: ws.textDim, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {n.message}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mt: 0.5 }}>
                    {EVENT_LABEL[n.eventType] ?? n.eventType} · {relativeTime(n.createdAt)}
                  </Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;
