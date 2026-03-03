/**
 * Floating Notification Button
 * Always-available entrypoint to notification center with unread indicator.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Fab, Tooltip, Zoom, useMediaQuery, useTheme } from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import NotificationCenter from './NotificationCenter';
import { useUniversalNotificationContext } from '../universal/UniversalNotificationProvider';
import { useTheming } from '../../utils/theming-helper';

type SupportedProfession =
  | 'photographer'
  | 'videographer'
  | 'music_producer'
  | 'vendor'
  | 'enterprise';

interface NotificationFloatingButtonProps {
  profession: SupportedProfession;
  userId: string;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
  };
}

interface NotificationRecord {
  read?: boolean;
}

interface NotificationResponse {
  unreadCount?: number;
  notifications?: NotificationRecord[];
}

function isNotificationResponse(value: unknown): value is NotificationResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as NotificationResponse;
  const unreadOk =
    candidate.unreadCount === undefined || typeof candidate.unreadCount === 'number';
  const notificationsOk =
    candidate.notifications === undefined || Array.isArray(candidate.notifications);
  return unreadOk && notificationsOk;
}

export default function NotificationFloatingButton({
  profession,
  userId,
  position = { bottom: 24, right: 24 },
}: NotificationFloatingButtonProps) {
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPulse, setShowPulse] = useState(false);
  const [lastNotificationTitle, setLastNotificationTitle] = useState<string | null>(null);

  const theme = useTheme();
  const theming = useTheming(profession);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const notificationsContext = useUniversalNotificationContext();

  const readServerUnreadCount = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/notifications', { credentials: 'include' });
      if (!response.ok) {
        return 0;
      }

      const payload: unknown = await response.json();
      if (!isNotificationResponse(payload)) {
        return 0;
      }

      if (typeof payload.unreadCount === 'number') {
        return Math.max(0, payload.unreadCount);
      }

      if (Array.isArray(payload.notifications)) {
        return payload.notifications.reduce((count, item) => {
          return item.read ? count : count + 1;
        }, 0);
      }

      return 0;
    } catch {
      return 0;
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const count = await readServerUnreadCount();
    setUnreadCount(count);
  }, [readServerUnreadCount]);

  useEffect(() => {
    void refreshUnreadCount();

    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, 30000);

    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshUnreadCount();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    const unsubscribe = notificationsContext.subscribe('all', (notification: unknown) => {
      const notificationLike =
        typeof notification === 'object' && notification !== null
          ? (notification as { title?: string })
          : {};

      setLastNotificationTitle(notificationLike.title ?? null);
      setUnreadCount((prev) => prev + 1);
      setShowPulse(true);

      window.setTimeout(() => setShowPulse(false), 1800);
    });

    return unsubscribe;
  }, [notificationsContext, userId]);

  const handleNotificationCenterClose = useCallback(() => {
    setNotificationCenterOpen(false);
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  const fabColor = useMemo(() => {
    switch (profession) {
      case 'photographer':
        return '#FFC107';
      case 'videographer':
        return '#2196F3';
      case 'music_producer':
        return '#9C27B0';
      case 'vendor':
        return '#4CAF50';
      case 'enterprise':
        return theming.colors.primary;
      default:
        return theme.palette.primary.main;
    }
  }, [profession, theme.palette.primary.main, theming.colors.primary]);

  const shouldShowButton = unreadCount > 0;
  const tooltipTitle =
    unreadCount > 0
      ? `${unreadCount} uleste varsler${lastNotificationTitle ? `: ${lastNotificationTitle}` : ''}`
      : 'Varsler';

  if (!shouldShowButton && !notificationCenterOpen) {
    return (
      <NotificationCenter
        open={notificationCenterOpen}
        onClose={handleNotificationCenterClose}
        profession={profession}
        userId={userId}
      />
    );
  }

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          ...position,
          zIndex: theme.zIndex.speedDial,
        }}
      >
        <Zoom in={shouldShowButton || notificationCenterOpen}>
          <Tooltip title={tooltipTitle}>
            <Fab
              color="primary"
              aria-label="Apne varsler"
              onClick={() => setNotificationCenterOpen(true)}
              size={isMobile ? 'small' : 'medium'}
              sx={{
                backgroundColor: fabColor,
                '&:hover': {
                  backgroundColor: fabColor,
                  filter: 'brightness(0.9)',
                },
                animation: showPulse ? 'notification-pulse 0.6s ease-in-out' : 'none',
                '@keyframes notification-pulse': {
                  '0%': {
                    transform: 'scale(1)',
                    boxShadow: `0 0 0 0 ${fabColor}4a`,
                  },
                  '70%': {
                    transform: 'scale(1.06)',
                    boxShadow: `0 0 0 12px ${fabColor}00`,
                  },
                  '100%': {
                    transform: 'scale(1)',
                    boxShadow: `0 0 0 0 ${fabColor}00`,
                  },
                },
                boxShadow: theme.shadows[4],
                '&:active': {
                  boxShadow: theme.shadows[8],
                },
              }}
            >
              <Badge
                badgeContent={unreadCount}
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.72rem',
                    height: 18,
                    minWidth: 18,
                    fontWeight: 700,
                  },
                }}
              >
                <NotificationsIcon fontSize={isMobile ? 'small' : 'medium'} />
              </Badge>
            </Fab>
          </Tooltip>
        </Zoom>
      </Box>

      <NotificationCenter
        open={notificationCenterOpen}
        onClose={handleNotificationCenterClose}
        profession={profession}
        userId={userId}
      />
    </>
  );
}

