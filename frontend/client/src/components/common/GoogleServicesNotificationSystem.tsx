/**
 * Smart Notification System for Google Services
 * Context-aware notifications with actions and priority handling.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  CloudDone,
  Close,
  Error,
  ExpandLess,
  ExpandMore,
  Info,
  Settings,
  Warning,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTheming } from '../../utils/theming-helper';

export interface SmartNotification {
  id: string;
  type: 'sync-complete' | 'quota-warning' | 'permission-required' | 'error' | 'success' | 'info';
  service: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  duration?: number;
  actions?: NotificationAction[];
  progress?: {
    current: number;
    total: number;
    label?: string;
  };
  persistent?: boolean;
  autoRetry?: boolean;
  metadata?: Record<string, unknown>;
}

export interface NotificationAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  icon?: React.ReactNode;
}

interface GoogleServicesNotificationSystemProps {
  maxNotifications?: number;
  autoHideDelay?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  enableSound?: boolean;
  enableVibration?: boolean;
}

type AlertSeverity = 'success' | 'info' | 'warning' | 'error';
type NotificationPayload = Omit<SmartNotification, 'id' | 'timestamp'>;

const PRIORITY_SCORE: Record<SmartNotification['priority'], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

declare global {
  interface Window {
    showGoogleServicesNotification?: (notification: NotificationPayload) => void;
  }
}

export const GoogleServicesNotificationSystem: React.FC<GoogleServicesNotificationSystemProps> = ({
  maxNotifications = 5,
  autoHideDelay = 6000,
  position = 'top-right',
  enableSound = false,
  enableVibration = false,
}) => {
  const theme = useTheme();
  const theming = useTheming('photographer');

  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const getNotificationIcon = useCallback((type: SmartNotification['type']) => {
    switch (type) {
      case 'sync-complete':
        return <CloudDone fontSize="small" />;
      case 'quota-warning':
        return <Warning fontSize="small" />;
      case 'permission-required':
        return <Settings fontSize="small" />;
      case 'error':
        return <Error fontSize="small" />;
      case 'success':
        return <CheckCircle fontSize="small" />;
      case 'info':
      default:
        return <Info fontSize="small" />;
    }
  }, []);

  const getColor = useCallback(
    (notification: SmartNotification) => {
      if (notification.priority === 'critical') {
        return theme.palette.error.main;
      }
      if (notification.priority === 'high') {
        return theme.palette.warning.main;
      }

      switch (notification.type) {
        case 'sync-complete':
        case 'success':
          return theme.palette.success.main;
        case 'quota-warning':
          return theme.palette.warning.main;
        case 'error':
          return theme.palette.error.main;
        case 'permission-required':
          return theme.palette.secondary.main;
        default:
          return theme.palette.info.main;
      }
    },
    [theme],
  );

  const getSeverity = useCallback((notification: SmartNotification): AlertSeverity => {
    if (notification.priority === 'critical') {
      return 'error';
    }

    switch (notification.type) {
      case 'error':
        return 'error';
      case 'quota-warning':
      case 'permission-required':
        return 'warning';
      case 'success':
      case 'sync-complete':
        return 'success';
      default:
        return 'info';
    }
  }, []);

  const closeNotification = useCallback((notificationId: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== notificationId),
    );
    setExpandedRows((current) => {
      if (!(notificationId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[notificationId];
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((notificationId: string) => {
    setExpandedRows((current) => ({ ...current, [notificationId]: !current[notificationId] }));
  }, []);

  const showNotification = useCallback(
    (notification: NotificationPayload) => {
      const id = `gs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const nextNotification: SmartNotification = {
        ...notification,
        id,
        timestamp: new Date(),
        duration: notification.duration ?? autoHideDelay,
      };

      setNotifications((currentNotifications) => {
        const queued = [...currentNotifications, nextNotification];
        const sorted = [...queued].sort((left, right) => {
          const priorityDelta = PRIORITY_SCORE[right.priority] - PRIORITY_SCORE[left.priority];
          if (priorityDelta !== 0) {
            return priorityDelta;
          }
          return right.timestamp.getTime() - left.timestamp.getTime();
        });
        return sorted.slice(0, maxNotifications);
      });

      if (enableSound && nextNotification.priority !== 'low') {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.25;
        void audio.play().catch(() => undefined);
      }

      if (enableVibration && nextNotification.priority === 'critical' && 'vibrate' in navigator) {
        navigator.vibrate([180, 80, 180]);
      }

      if (!nextNotification.persistent && typeof nextNotification.duration === 'number') {
        setTimeout(() => {
          closeNotification(id);
        }, nextNotification.duration);
      }
    },
    [autoHideDelay, closeNotification, enableSound, enableVibration, maxNotifications],
  );

  useEffect(() => {
    window.showGoogleServicesNotification = showNotification;
    return () => {
      delete window.showGoogleServicesNotification;
    };
  }, [showNotification]);

  const handleAction = useCallback(
    async (notification: SmartNotification, action: NotificationAction) => {
      await action.action();

      if (!notification.persistent) {
        closeNotification(notification.id);
      }
    },
    [closeNotification],
  );

  const containerPosition = useMemo(() => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: theme.zIndex.snackbar,
      maxWidth: 460,
      width: 'min(460px, calc(100vw - 24px))',
    };

    switch (position) {
      case 'top-left':
        return { ...base, top: 12, left: 12 };
      case 'bottom-right':
        return { ...base, bottom: 12, right: 12 };
      case 'bottom-left':
        return { ...base, bottom: 12, left: 12 };
      case 'top-right':
      default:
        return { ...base, top: 12, right: 12 };
    }
  }, [position, theme.zIndex.snackbar]);

  return (
    <Box sx={containerPosition}>
      <Stack spacing={1.25}>
        {notifications.map((notification) => {
          const color = getColor(notification);
          const severity = getSeverity(notification);
          const expanded = Boolean(expandedRows[notification.id]);

          return (
            <Alert
              key={notification.id}
              severity={severity}
              icon={getNotificationIcon(notification.type)}
              action={
                <Stack direction="row" spacing={0.5}>
                  {notification.actions && notification.actions.length > 0 && (
                    <IconButton
                      size="small"
                      color="inherit"
                      aria-label={expanded ? 'Collapse actions' : 'Expand actions'}
                      onClick={() => toggleExpanded(notification.id)}
                    >
                      {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    color="inherit"
                    aria-label="Close notification"
                    onClick={() => closeNotification(notification.id)}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Stack>
              }
              sx={{
                border: `1px solid ${alpha(color, 0.35)}`,
                boxShadow: 4,
                ...theming.getThemedCardSx(),
              }}
            >
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                <Chip
                  size="small"
                  label={notification.service}
                  sx={{
                    backgroundColor: alpha(color, 0.1),
                    color,
                    border: `1px solid ${alpha(color, 0.35)}`,
                  }}
                />
                {notification.priority !== 'low' && (
                  <Chip
                    size="small"
                    label={notification.priority}
                    variant="outlined"
                    color={notification.priority === 'critical' ? 'error' : 'warning'}
                  />
                )}
              </AlertTitle>

              <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
                {notification.title}
              </Typography>
              <Typography variant="body2">{notification.message}</Typography>

              {notification.progress && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(notification.progress.current / notification.progress.total) * 100}
                    sx={{
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: alpha(color, 0.18),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: color,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                    {notification.progress.label ?? `${notification.progress.current}/${notification.progress.total}`}
                  </Typography>
                </Box>
              )}

              <Collapse in={expanded}>
                {notification.actions && notification.actions.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {notification.actions.map((action, actionIndex) => (
                      <Button
                        key={`${notification.id}-${actionIndex}`}
                        size="small"
                        variant={action.variant ?? 'outlined'}
                        color={action.color ?? 'primary'}
                        startIcon={action.icon}
                        onClick={() => {
                          void handleAction(notification, action);
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Box>
                )}
              </Collapse>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {notification.timestamp.toLocaleTimeString()}
              </Typography>
            </Alert>
          );
        })}
      </Stack>
    </Box>
  );
};

export const useGoogleServicesNotifications = () => {
  const showNotification = useCallback((notification: NotificationPayload) => {
    if (window.showGoogleServicesNotification) {
      window.showGoogleServicesNotification(notification);
      return;
    }

    // Fallback when the mounted system is unavailable.
    // This still provides a visible signal in development.
     
    console.warn('GoogleServicesNotificationSystem is not mounted');
  }, []);

  return {
    showNotification,
    showSuccess: (service: string, title: string, message: string, actions?: NotificationAction[]) =>
      showNotification({ type: 'success', service, title, message, priority: 'low', actions }),
    showError: (service: string, title: string, message: string, actions?: NotificationAction[]) =>
      showNotification({ type: 'error', service, title, message, priority: 'high', actions }),
    showWarning: (service: string, title: string, message: string, actions?: NotificationAction[]) =>
      showNotification({ type: 'quota-warning', service, title, message, priority: 'medium', actions }),
    showSyncComplete: (service: string, message: string) =>
      showNotification({
        type: 'sync-complete',
        service,
        title: 'Sync complete',
        message,
        priority: 'low',
        duration: 4500,
      }),
    showPermissionRequired: (service: string, actions?: NotificationAction[]) =>
      showNotification({
        type: 'permission-required',
        service,
        title: 'Permission required',
        message: `Additional permissions are required for ${service}.`,
        priority: 'high',
        persistent: true,
        actions,
      }),
  };
};
