/**
 * LeadMapNotificationBell.tsx
 *
 * Notification-bell-knapp + dropdown med uleste varsler. Poller hver
 * 30 s for nye events. Tap → markér som lest + deep-link.
 *
 * Speilet fra web — iPad har sin egen LeaderboardRow-style feed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar, Badge, Box, Button, Chip, CircularProgress, Divider,
  IconButton, Menu, MenuItem, Stack, Tooltip, Typography,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import NavigationOutlinedIcon from '@mui/icons-material/NavigationOutlined';

interface NotificationEvent {
  id: string;
  event_type: string;
  title: string;
  body: string;
  lead_id: string | null;
  visit_id: string | null;
  triggered_by_user_id: string | null;
  deep_link: string | null;
  meta: Record<string, unknown>;
  email_sent: boolean;
  apns_sent: boolean;
  read_at: string | null;
  created_at: string;
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

const ICON_BY_TYPE: Record<string, typeof PersonAddAlt1OutlinedIcon> = {
  lead_assigned: PersonAddAlt1OutlinedIcon,
  lead_status_changed: EditNoteOutlinedIcon,
  lead_won_on_team: EmojiEventsOutlinedIcon,
  follow_up_due: EventBusyOutlinedIcon,
  approaching_lead: NavigationOutlinedIcon,
};

const COLOR_BY_TYPE: Record<string, string> = {
  lead_assigned: '#c084fc',
  lead_status_changed: '#60a5fa',
  lead_won_on_team: '#34d399',
  follow_up_due: '#f87171',
  approaching_lead: '#fbbf24',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'akkurat nå';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  return `${Math.floor(hrs / 24)} d siden`;
}

export default function LeadMapNotificationBell() {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);

  const headers = useMemo<HeadersInit>(
    () => ({ Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' }),
    [],
  );

  const open = Boolean(anchorEl);

  // ─── Poll hvert 30s ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin-room/lead-map/me/notifications?limit=20`,
        { headers },
      );
      if (r.ok) {
        const j = await r.json();
        setNotifications(Array.isArray(j.notifications) ? j.notifications : []);
        setUnreadCount(j.unreadCount ?? 0);
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/admin-room/lead-map/me/notifications/${id}/read`, {
        method: 'POST', headers,
      });
      setNotifications((n) =>
        n.map((x) => x.id === id ? { ...x, read_at: new Date().toISOString() } : x)
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* noop */ }
  }, [headers]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch(`/api/admin-room/lead-map/me/notifications/read-all`, {
        method: 'POST', headers,
      });
      setNotifications((n) => n.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch { /* noop */ }
  }, [headers]);

  const handleClick = (notif: NotificationEvent) => {
    if (!notif.read_at) void markRead(notif.id);
    if (notif.deep_link) {
      try {
        const url = new URL(notif.deep_link);
        // Hvis intern URL — naviger inni samme tab. Eksterne åpner nytt.
        if (url.origin === window.location.origin) {
          window.location.href = notif.deep_link;
        } else {
          window.open(notif.deep_link, '_blank', 'noopener,noreferrer');
        }
      } catch {
        window.location.href = notif.deep_link;
      }
    }
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="Varsler">
        <IconButton
          color="inherit"
          aria-label={`Varsler (${unreadCount} uleste)`}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? <NotificationsActiveOutlinedIcon /> : <NotificationsOutlinedIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: { sx: { minWidth: 360, maxWidth: 420, maxHeight: 540 } },
        }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">Varsler</Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllOutlinedIcon />}
              onClick={markAllRead}
            >
              Markér alle lest
            </Button>
          )}
        </Box>
        <Divider />

        {loading && notifications.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Ingen varsler enda</Typography>
            <Typography variant="caption" color="text.secondary">
              Du får varsler når du blir tildelt leads eller en lead-status endres.
            </Typography>
          </Box>
        ) : (
          notifications.map((notif) => {
            const Icon = ICON_BY_TYPE[notif.event_type] ?? NotificationsOutlinedIcon;
            const color = COLOR_BY_TYPE[notif.event_type] ?? '#9ca3af';
            const isUnread = !notif.read_at;
            return (
              <MenuItem
                key={notif.id}
                onClick={() => handleClick(notif)}
                sx={{
                  alignItems: 'flex-start',
                  py: 1.5,
                  bgcolor: isUnread ? 'rgba(192,132,252,0.06)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(192,132,252,0.10)' },
                  whiteSpace: 'normal',
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: `${color}22`,
                    color,
                    width: 36, height: 36,
                    mr: 1.5,
                  }}
                >
                  <Icon />
                </Avatar>
                <Box flexGrow={1}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" sx={{ fontWeight: isUnread ? 700 : 400 }}>
                      {notif.title}
                    </Typography>
                    {isUnread && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {notif.body}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                    {formatRelative(notif.created_at)}
                  </Typography>
                </Box>
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
}
