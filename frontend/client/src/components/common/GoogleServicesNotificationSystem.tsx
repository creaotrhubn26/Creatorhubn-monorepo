/**
 * Smart Notification System for Google Services
 * Context-aware notifications with actions and priority handling
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  Typography,
  IconButton,
  Collapse,
  LinearProgress,
  Chip,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Info,
  CloudSync,
  CloudDone,
  CloudOff,
  Settings,
  Launch,
} from '@mui/icons-material';

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
  metadata?: any;
}

export interface NotificationAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  icon?: React.ReactNode
}

interface GoogleServicesNotificationSystemProps {
  maxNotifications?: number;
  autoHideDelay?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  enableSound?: boolean;
  enableVibration?: boolean;
}

export const GoogleServicesNotificationSystem: React.FC<GoogleServicesNotificationSystemProps> = ({
  maxNotifications = 5,
  autoHideDelay = 6000,
  position = 'top-right',
  enableSound = false,
  enableVibration = false,
}) => {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand high priority notifications
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.priority === 'critical' || notification.priority === 'high') {
        setExpanded(prev => ({ ...prev, [notification.id]: true }));
    }
  });
}, [notifications]);

  const getNotificationIcon = (type: SmartNotification['type']) => {
    switch (type) {
      case 'sync-complete':
        return theming.getThemedIcon(', ');
      case 'quota-warning':
        return theming.getThemedIcon('warning');
      case 'permission-required':
        return theming.getThemedIcon('settings');
      case 'error':
        return theming.getThemedIcon('error');
      case 'success':
        return theming.getThemedIcon('checkCircle');
      case 'info':
      default: return theming.getThemedIcon(', ');
  }
};

  const getNotificationColor = (type: SmartNotification['type']priority: SmartNotification['priority']) => {
    if (priority === 'critical') return theme.palette.error.main;
    if (priority === 'high') return theme.palette.warning.main;
    
    switch (type) {
      case 'error':
        return theme.palette.error.main;
      case 'warning':
      case 'quota-warning':
        return theme.palette.warning.main;
      case 'success':
      case 'sync-complete':
        return theme.palette.success.main;
      case 'info':
      default:
        return theme.palette.info.main;
}
};

  const getSeverity = (type: SmartNotification['type']priority: SmartNotification['priority']) => {
    if (priority === 'critical') return 'error';
    if (priority === 'high') return 'warning';
    
    switch (type) {
      case 'error':
        return 'error';
      case 'quota-warning':
        return 'warning';
      case 'success':
      case 'sync-complete':
        return 'success';
      default:
        return 'info';
}
};

  const handleClose = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setExpanded(prev => {
      const newExpanded = { ...prev };
      delete newExpanded[notificationId];
      return newExpanded;
  });
}, []);

  const handleExpand = useCallback((notificationId: string) => {
    setExpanded(prev => ({ ...prev, [notificationId]: !prev[notificationId] }));
}, []);

  const handleAction = useCallback(async (notification: SmartNotification, action: NotificationAction) => {
    try {
      await action.action();
      
      // Show success feedback
      if (action.label !== 'Dismiss') {
        showNotification({
          type: 'success',
          service: notification.service,
          title: 'Action Completed',
          message: `${action.label} completed successfully`,
          priority: 'low',
          duration: 300,
      });
    }
  } catch (error) {
      console.error('Notification action failed: ', error);
      showNotification({
        type: 'error',
        service: notification.service,
        title: 'Action Failed',
        message: `${action.label} failed: ${error.message}`,
        priority: 'medium',
        duration: 500,
    });
  }
}, []);

  const showNotification = useCallback((notification: Omit<SmartNotification, 'id' | 'timestamp'>) => {
    const newNotification: SmartNotification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      duration: notification.duration || autoHideDelay,
  };

    setNotifications(prev => {
      const updated = [...prev, newNotification];
      
      // Limit number of notifications
      if (updated.length > maxNotifications) {
        // Remove oldest low priority notifications first
        const sorted = updated.sort((a, b) => {
          const priorityOrder = { critical:  4, high:  3, medium: 2, low:  1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.timestamp.getTime() - b.timestamp.getTime();
      });
        
        return sorted.slice(0, maxNotifications);
    }
      
      return updated;
  });

    // Play sound if enabled
    if (enableSound && newNotification.priority !== 'low') {
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors
  }

    // Vibrate if enabled
    if (enableVibration && newNotification.priority === 'critical' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
  }

    // Auto-hide notification
    if (newNotification.duration && !newNotification.persistent) {
      setTimeout(() => {
        handleClose(newNotification.id);
    }, newNotification.duration);
  }
}, [maxNotifications, autoHideDelay, enableSound, enableVibration, handleClose]);

  // Expose showNotification globally for use by other components
  useEffect(() => {
    (window as any).showGoogleServicesNotification = showNotification;
    return () => {
      delete (window as any).showGoogleServicesNotification;
  };
}, [showNotification]);

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: , theme.zIndex.snackbar,
  };

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
};

  return (
    <Box sx={getPositionStyles()}>
      <Stack spacing={2}>
        {notifications.map((notification, index) => {
          const isExpanded = expanded[notification.id];
          const color = getNotificationColor(notification.type, notification.priority);
          const severity = getSeverity(notification.type, notification.priority);

          return (
            <Alert
              key={notification.id}
              severity={severity as any}
              icon={getNotificationIcon(notification.type)}
              action={
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  {notification.actions && notification.actions.length > 0 && (
                    <IconButton
                      size="small"
                      onClick={() => handleExpand(notification.id)}
                      sx={{ color: 'inherit'}}
                    >
                      {isExpanded ? theming.getThemedIcon('close') : theming.getThemedIcon('launch')}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleClose(notification.id)}
                    sx={{ color: 'inherit'}}
                  >
                    {theming.getThemedIcon('close')}
                  </IconButton>
                </Box>
            }
              sx={{
                minWidth: 30,
                maxWidth: 40,
                boxShadow: theme.shadows[],
                border: `1px solid ${alpha(color, 0.3)}`'& .MuiAlert-icon': {
                  color: color,
              },
                animation: `slideIn 0.3s ease-out ${index * 0.1}s both`'@keyframes slideIn': {
                  from: {
                    opacity: 0,
                    transform: 'translateX(100%, )',
                },
                  to: {
                    opacity: 1,
                    transform: 'translateX(0, )',
                },
              }}}
            >
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                <Chip
                  label={notification.service}
                  size="small"
                  sx={{
                    bgcolor: alpha(color, 0.1),
                    color: color,
                    fontWeight: 60
                }}
                />
                {notification.priority !== 'low' && (
                  <Chip
                    label={notification.priority}
                    size="small"
                    color={notification.priority === 'critical' ? 'error' : 'warning'}
                    variant="outlined"
                  />
                )}
              </AlertTitle>
              
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5}}>
                {notification.title}
              </Typography>
              
              <Typography variant="body2" sx={{ mb:  1 }}>
                {notification.message}
              </Typography>

              {notification.progress && (
                <Box sx={{ mb:  1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(notification.progress.current / notification.progress.total) * 100}
                    sx={{
                      height:  4,
                      borderRadius:  2,
                      bgcolor: alpha(color, 0.1)'& .MuiLinearProgress-bar': {
                        bgcolor: color,
                    }}}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {notification.progress.label || `${notification.progress.current} of ${notification.progress.total}`}
                  </Typography>
                </Box>
              )}

              <Collapse in={isExpanded}>
                {notification.actions && notification.actions.length > 0 && (
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                    {notification.actions.map((action, actionIndex) => (
                      <Button
                        key={actionIndex}
                        size="small"
                        variant={action.variant || 'outlined'}
                        color={action.color || 'primary'}
                        startIcon={action.icon}
                        onClick={() => handleAction(notification, action)}
                        sx={{
                          minWidth: 'auto',
                          fontSize: '0.75rem',
                          py: 0.5}}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Box>
                )}
              </Collapse>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt:  1 }}>
                {notification.timestamp.toLocaleTimeString()}
              </Typography>
            </Alert>
          );
      })}
      </Stack>
    </Box>
  );
};

// Hook for using notifications in components
export const useGoogleServicesNotifications = () => {
  const showNotification = useCallback((notification: Omit<SmartNotification, 'id' | 'timestamp'>) => {
    if ((window as any).showGoogleServicesNotification) {
      (window as any).showGoogleServicesNotification(notification);
  } else {
      console.warn('Google Services Notification System not initialized');
  }
}, []);

  return {
    showNotification,
    showSuccess: (service: string, title: string, message: string, actions?: NotificationAction[]) =>
      showNotification({
        type: 'success',
        service,
        title,
        message,
        priority: 'low',
        actions,
    }),
    showError: (service: string, title: string, message: string, actions?: NotificationAction[]) =>
      showNotification({
        type: 'error',
        service,
        title,
        message,
        priority: 'high',
        actions,
    }),
    showWarning: (service: string, title: string, message: string, actions?: NotificationAction[]) =>
      showNotification({
        type: 'quota-warning',
        service,
        title,
        message,
        priority: 'medium',
        actions,
    }),
    showSyncComplete: (service: string, message: string, itemsProcessed?: number) =>
      showNotification({
        type: 'sync-complete',
        service,
        title: 'Sync Complete',
        message,
        priority: 'low',
        duration: 400,
    }),
    showPermissionRequired: (service: string, actions?: NotificationAction[]) =>
      showNotification({
        type: 'permission-required',
        service,
        title: 'Permissions Required',
        message: `Additional permissions needed for ${service}`,
        priority:'high',
        persistent: true,
        actions,
    }),
};
};
