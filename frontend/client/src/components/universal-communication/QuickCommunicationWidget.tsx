/**
 * CreatorHub Norge - Quick Communication Widget
 * Compact floating widget for instant access to communication features
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Box,
  Fab,
  Menu,
  MenuItem,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Tooltip,
  Typography,
  Zoom,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Group as GroupIcon,
  Message as MessageIcon,
  Notifications as NotificationIcon,
  VideoCall as MeetingIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface QuickCommunicationWidgetProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onOpenFull?: () => void;
  onChannelSelect?: (channelId: string, type: string) => void;
}

type ChannelType = 'chat' | 'email' | 'notification' | 'meeting' | 'project';

interface CommunicationChannel {
  id: string;
  type: ChannelType;
  name?: string;
  description?: string;
  unreadCount?: number;
}

interface CommunicationSummaryItem {
  count: number;
  unread: number;
}

interface CommunicationSummary {
  chat: CommunicationSummaryItem;
  email: CommunicationSummaryItem;
  notification: CommunicationSummaryItem;
  meeting: CommunicationSummaryItem;
  project: CommunicationSummaryItem;
  total: CommunicationSummaryItem;
}

const createEmptySummary = (): CommunicationSummary => ({
  chat: { count: 0, unread: 0 },
  email: { count: 0, unread: 0 },
  notification: { count: 0, unread: 0 },
  meeting: { count: 0, unread: 0 },
  project: { count: 0, unread: 0 },
  total: { count: 0, unread: 0 },
});

const CHANNEL_COLORS: Record<ChannelType, string> = {
  chat: '#4caf50',
  email: '#2196f3',
  notification: '#ff9800',
  meeting: '#9c27b0',
  project: '#607d8b',
};

const getPositionStyles = (
  position: QuickCommunicationWidgetProps['position'],
): React.CSSProperties => {
  const base: React.CSSProperties = { position: 'fixed', zIndex: 1300 };
  switch (position) {
    case 'bottom-left':
      return { ...base, bottom: 24, left: 24 };
    case 'top-right':
      return { ...base, top: 88, right: 24 };
    case 'top-left':
      return { ...base, top: 88, left: 24 };
    case 'bottom-right':
    default:
      return { ...base, bottom: 24, right: 24 };
  }
};

export default function QuickCommunicationWidget({
  userId,
  position = 'bottom-right',
  onOpenFull,
  onChannelSelect,
}: QuickCommunicationWidgetProps): React.ReactElement {
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);

  const { data: channels = [] } = useQuery<CommunicationChannel[]>({
    queryKey: ['/api/communication/channels', userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/communication/channels?userId=${encodeURIComponent(userId)}`);
      const payload = response as { channels?: CommunicationChannel[] } | CommunicationChannel[];
      if (Array.isArray(payload)) {
        return payload;
      }
      return payload.channels ?? [];
    },
    refetchInterval: 10000,
    enabled: Boolean(userId),
  });

  const summary = useMemo<CommunicationSummary>(() => {
    const result = createEmptySummary();
    channels.forEach((channel) => {
      const unread = channel.unreadCount ?? 0;
      result[channel.type].count += 1;
      result[channel.type].unread += unread;
      result.total.count += 1;
      result.total.unread += unread;
    });
    return result;
  }, [channels]);

  const recentNotifications = useMemo(
    () => channels.filter((channel) => channel.type === 'notification').slice(0, 5),
    [channels],
  );

  const actions: Array<{ type: ChannelType; label: string; icon: React.ReactNode }> = [
    { type: 'chat', label: 'Chat', icon: <ChatIcon fontSize="small" /> },
    { type: 'email', label: 'Email', icon: <EmailIcon fontSize="small" /> },
    { type: 'notification', label: 'Notifications', icon: <NotificationIcon fontSize="small" /> },
    { type: 'meeting', label: 'Meetings', icon: <MeetingIcon fontSize="small" /> },
    { type: 'project', label: 'Projects', icon: <ProjectIcon fontSize="small" /> },
  ];

  const handleOpenType = (type: ChannelType): void => {
    setSpeedDialOpen(false);
    onChannelSelect?.('', type);
    onOpenFull?.();
  };

  return (
    <Box sx={getPositionStyles(position)}>
      <SpeedDial
        ariaLabel="quick communication"
        icon={
          <SpeedDialIcon
            icon={
              <Badge badgeContent={summary.total.unread} color="error" max={99}>
                <MessageIcon />
              </Badge>
            }
            openIcon={<CloseIcon />}
          />
        }
        open={speedDialOpen}
        onOpen={() => setSpeedDialOpen(true)}
        onClose={() => setSpeedDialOpen(false)}
        direction="up"
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.type}
            icon={
              <Badge badgeContent={summary[action.type].unread} color="error" max={9}>
                <Box sx={{ color: CHANNEL_COLORS[action.type], display: 'flex' }}>{action.icon}</Box>
              </Badge>
            }
            tooltipTitle={`${action.label} (${summary[action.type].count})`}
            tooltipPlacement="left"
            onClick={() => handleOpenType(action.type)}
          />
        ))}
        <SpeedDialAction
          icon={<GroupIcon fontSize="small" />}
          tooltipTitle="Open Full Hub"
          tooltipPlacement="left"
          onClick={() => {
            setSpeedDialOpen(false);
            onOpenFull?.();
          }}
        />
      </SpeedDial>

      {summary.total.unread > 0 ? (
        <Zoom in={!speedDialOpen}>
          <Tooltip title={`${summary.total.unread} unread - click to preview`} placement="left">
            <Fab
              size="small"
              onClick={(event) => setNotificationAnchor(event.currentTarget)}
              sx={{
                position: 'absolute',
                top: -4,
                right: 8,
                width: 40,
                height: 40,
                bgcolor: '#ff6f00',
                color: 'white',
                '&:hover': { bgcolor: '#f57c00' },
              }}
            >
              <Badge badgeContent={summary.total.unread} color="error" max={99}>
                <NotificationIcon fontSize="small" />
              </Badge>
            </Fab>
          </Tooltip>
        </Zoom>
      ) : null}

      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={() => setNotificationAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        PaperProps={{ sx: { width: 320, maxWidth: '95vw' } }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography variant="subtitle2">Recent Notifications</Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.total.unread} unread messages
          </Typography>
        </Box>

        {recentNotifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No recent notifications
            </Typography>
          </MenuItem>
        ) : (
          recentNotifications.map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => {
                setNotificationAnchor(null);
                onChannelSelect?.(notification.id, 'notification');
                onOpenFull?.();
              }}
            >
              <Avatar sx={{ width: 28, height: 28, mr: 1, bgcolor: CHANNEL_COLORS.notification }}>
                <NotificationIcon fontSize="small" />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {notification.name ?? 'Notification'}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {notification.description ?? 'Communication update'}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}

        <MenuItem
          onClick={() => {
            setNotificationAnchor(null);
            onOpenFull?.();
          }}
          sx={{ justifyContent: 'center' }}
        >
          <Typography variant="button" color="primary.main">
            Open Communication Hub
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}
