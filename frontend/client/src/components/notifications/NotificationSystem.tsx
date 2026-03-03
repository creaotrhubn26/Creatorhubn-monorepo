/**
 * Comprehensive Notification System for CreatorHub Norge
 * Handles upload/project/sync/system notifications with zero-toast policy
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Close as CloseIcon,
  CloudUpload,
  Error as ErrorIcon,
  FolderOpen,
  Info,
  Notifications as NotificationsIcon,
  Share,
  Sync,
  Warning,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';

export interface NotificationData {
  id: string;
  type: 'upload' | 'sync' | 'project' | 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  progress?: number;
  isRead: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  }>;
  metadata?: {
    projectId?: string;
    fileCount?: number;
    fileName?: string;
    folderUrl?: string;
    shareCode?: string;
    syncedCount?: number;
    projectCount?: number;
    error?: string;
  };
}

interface NotificationSystemProps {
  userId?: string;
  onNotificationClick?: (notification: NotificationData) => void;
}

type UploadStartDetail = { fileId: string; fileName: string; fileCount?: number };
type UploadProgressDetail = { fileId: string; fileName: string; progress: number };
type UploadCompleteDetail = {
  fileId: string;
  fileName: string;
  fileCount?: number;
  projectId?: string;
  folderUrl?: string;
};
type UploadErrorDetail = { fileId: string; fileName: string; error: string };
type ProjectCreatedDetail = { projectName: string; projectId: string; folderUrl?: string };
type ProjectSharedDetail = { projectName: string; shareCode: string };
type SyncCompleteDetail = { projectCount: number; syncedCount: number };

const parseIncomingNotification = (input: unknown): NotificationData | null => {
  const value = input as Partial<NotificationData> | null;
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (!value.id || !value.type || !value.title || !value.message) {
    return null;
  }

  return {
    id: String(value.id),
    type: value.type,
    title: String(value.title),
    message: String(value.message),
    timestamp:
      value.timestamp instanceof Date
        ? value.timestamp
        : new Date(value.timestamp ?? Date.now()),
    progress: value.progress,
    isRead: Boolean(value.isRead),
    metadata: value.metadata,
    actions: value.actions,
  };
};

const createNotification = (
  patch: Omit<NotificationData, 'id' | 'timestamp' | 'isRead'> & { id?: string },
): NotificationData => ({
  id: patch.id ?? `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: new Date(),
  isRead: false,
  ...patch,
});

const getNotificationIcon = (type: NotificationData['type']): React.ReactElement => {
  switch (type) {
    case 'upload':
      return <CloudUpload color="info" fontSize="small" />;
    case 'sync':
      return <Sync color="warning" fontSize="small" />;
    case 'project':
      return <FolderOpen color="primary" fontSize="small" />;
    case 'success':
      return <CheckCircle color="success" fontSize="small" />;
    case 'warning':
      return <Warning color="warning" fontSize="small" />;
    case 'error':
      return <ErrorIcon color="error" fontSize="small" />;
    case 'info':
    default:
      return <Info color="info" fontSize="small" />;
  }
};

const toLocaleTimestamp = (value: Date): string => value.toLocaleString('nb-NO');

export default function NotificationSystem({
  userId,
  onNotificationClick,
}: NotificationSystemProps): React.ReactElement {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showAllDialog, setShowAllDialog] = useState(false);

  const { data: initialNotifications = [] } = useQuery<NotificationData[]>({
    queryKey: ['/api/notifications', userId],
    queryFn: async () => {
      const response = await apiRequest('/api/notifications');
      const payload = response as { notifications?: unknown[] } | unknown[];
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.notifications)
          ? payload.notifications
          : [];
      return list
        .map(parseIncomingNotification)
        .filter((item): item is NotificationData => item !== null)
        .map((item) => ({ ...item, timestamp: new Date(item.timestamp) }));
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const addNotification = (notification: NotificationData): void => {
      setNotifications((prev) => [notification, ...prev].slice(0, 80));
    };

    const onUploadStart = (event: Event): void => {
      const detail = (event as CustomEvent<UploadStartDetail>).detail;
      addNotification(
        createNotification({
          id: `upload-start-${detail.fileId}`,
          type: 'upload',
          title: 'Opplasting startet',
          message:
            (detail.fileCount ?? 1) > 1
              ? `Laster opp ${detail.fileCount} filer`
              : `Laster opp ${detail.fileName}`,
          progress: 0,
          metadata: { fileName: detail.fileName, fileCount: detail.fileCount },
        }),
      );
    };

    const onUploadProgress = (event: Event): void => {
      const detail = (event as CustomEvent<UploadProgressDetail>).detail;
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === `upload-start-${detail.fileId}`
            ? {
                ...item,
                message: `Laster opp ${detail.fileName} (${detail.progress}%)`,
                progress: detail.progress,
              }
            : item,
        ),
      );
    };

    const onUploadComplete = (event: Event): void => {
      const detail = (event as CustomEvent<UploadCompleteDetail>).detail;
      addNotification(
        createNotification({
          id: `upload-done-${detail.fileId}`,
          type: 'success',
          title: 'Opplasting fullført',
          message: `${detail.fileName} er ferdig opplastet`,
          metadata: {
            fileName: detail.fileName,
            fileCount: detail.fileCount,
            projectId: detail.projectId,
            folderUrl: detail.folderUrl,
          },
          actions: detail.folderUrl
            ? [
                {
                  label: 'Åpne mappe',
                  color: 'primary',
                  action: () => window.open(detail.folderUrl, '_blank', 'noopener,noreferrer'),
                },
              ]
            : undefined,
        }),
      );
    };

    const onUploadError = (event: Event): void => {
      const detail = (event as CustomEvent<UploadErrorDetail>).detail;
      addNotification(
        createNotification({
          id: `upload-error-${detail.fileId}`,
          type: 'error',
          title: 'Opplastingsfeil',
          message: `${detail.fileName}: ${detail.error}`,
          metadata: { fileName: detail.fileName, error: detail.error },
        }),
      );
    };

    const onProjectCreated = (event: Event): void => {
      const detail = (event as CustomEvent<ProjectCreatedDetail>).detail;
      addNotification(
        createNotification({
          type: 'project',
          title: 'Prosjekt opprettet',
          message: `${detail.projectName} er klart`,
          metadata: { projectId: detail.projectId, folderUrl: detail.folderUrl },
          actions: detail.folderUrl
            ? [
                {
                  label: 'Åpne',
                  color: 'primary',
                  action: () => window.open(detail.folderUrl, '_blank', 'noopener,noreferrer'),
                },
              ]
            : undefined,
        }),
      );
    };

    const onProjectShared = (event: Event): void => {
      const detail = (event as CustomEvent<ProjectSharedDetail>).detail;
      addNotification(
        createNotification({
          type: 'info',
          title: 'Prosjekt delt',
          message: `${detail.projectName} delt med kode ${detail.shareCode}`,
          metadata: { shareCode: detail.shareCode },
          actions: [
            {
              label: 'Kopier kode',
              color: 'secondary',
              action: () => {
                void navigator.clipboard.writeText(detail.shareCode);
              },
            },
          ],
        }),
      );
    };

    const onSyncCompleted = (event: Event): void => {
      const detail = (event as CustomEvent<SyncCompleteDetail>).detail;
      addNotification(
        createNotification({
          type: 'sync',
          title: 'Synk fullført',
          message: `${detail.syncedCount}/${detail.projectCount} prosjekter synket`,
          metadata: { syncedCount: detail.syncedCount, projectCount: detail.projectCount },
        }),
      );
    };

    window.addEventListener('fileUploadStart', onUploadStart);
    window.addEventListener('fileUploadProgress', onUploadProgress);
    window.addEventListener('fileUploadComplete', onUploadComplete);
    window.addEventListener('fileUploadError', onUploadError);
    window.addEventListener('projectCreated', onProjectCreated);
    window.addEventListener('projectShared', onProjectShared);
    window.addEventListener('syncCompleted', onSyncCompleted);

    return () => {
      window.removeEventListener('fileUploadStart', onUploadStart);
      window.removeEventListener('fileUploadProgress', onUploadProgress);
      window.removeEventListener('fileUploadComplete', onUploadComplete);
      window.removeEventListener('fileUploadError', onUploadError);
      window.removeEventListener('projectCreated', onProjectCreated);
      window.removeEventListener('projectShared', onProjectShared);
      window.removeEventListener('syncCompleted', onSyncCompleted);
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const markAsRead = (id: string): void => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
  };

  const markAllRead = (): void => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const removeNotification = (id: string): void => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      <IconButton color="inherit" onClick={(event) => setAnchorEl(event.currentTarget)}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: 380, maxWidth: '95vw' } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">Notifications</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={markAllRead}>
              Mark all read
            </Button>
            <Button size="small" onClick={() => setShowAllDialog(true)}>
              View all
            </Button>
          </Stack>
        </Box>
        <Divider />

        <List dense sx={{ py: 0 }}>
          {notifications.slice(0, 6).map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => {
                markAsRead(notification.id);
                onNotificationClick?.(notification);
              }}
              sx={{
                alignItems: 'flex-start',
                py: 1,
                backgroundColor: notification.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>{getNotificationIcon(notification.type)}</ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {notification.title}
                    </Typography>
                    {!notification.isRead ? <Chip label="new" size="small" color="primary" /> : null}
                  </Stack>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {notification.message}
                    </Typography>
                    {typeof notification.progress === 'number' ? (
                      <Typography variant="caption" color="text.secondary">
                        Progress: {notification.progress}%
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="text.disabled" display="block">
                      {toLocaleTimestamp(notification.timestamp)}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <IconButton size="small" onClick={() => removeNotification(notification.id)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </MenuItem>
          ))}
          {notifications.length === 0 ? (
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                Ingen notifikasjoner.
              </Typography>
            </MenuItem>
          ) : null}
        </List>
      </Menu>

      <Dialog open={showAllDialog} onClose={() => setShowAllDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Alle notifikasjoner</Typography>
          <IconButton onClick={() => setShowAllDialog(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <List>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  alignItems="flex-start"
                  sx={{
                    backgroundColor: notification.isRead ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                    borderRadius: 1,
                  }}
                >
                  <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
                  <ListItemText
                    primary={notification.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" display="block">
                          {toLocaleTimestamp(notification.timestamp)}
                        </Typography>
                        {notification.actions?.length ? (
                          <Stack direction="row" spacing={1} mt={1}>
                            {notification.actions.map((action) => (
                              <Button
                                key={`${notification.id}-${action.label}`}
                                size="small"
                                color={action.color}
                                onClick={action.action}
                                startIcon={action.label.includes('Kopier') ? <Share fontSize="small" /> : undefined}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </Stack>
                        ) : null}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton size="small" onClick={() => removeNotification(notification.id)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < notifications.length - 1 ? <Divider component="li" sx={{ my: 1 }} /> : null}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Notification trigger helpers
export const triggerUploadNotification = (data: UploadStartDetail): void => {
  window.dispatchEvent(new CustomEvent<UploadStartDetail>('fileUploadStart', { detail: data }));
};

export const triggerUploadProgress = (data: UploadProgressDetail): void => {
  window.dispatchEvent(new CustomEvent<UploadProgressDetail>('fileUploadProgress', { detail: data }));
};

export const triggerUploadComplete = (data: UploadCompleteDetail): void => {
  window.dispatchEvent(new CustomEvent<UploadCompleteDetail>('fileUploadComplete', { detail: data }));
};

export const triggerUploadError = (data: UploadErrorDetail): void => {
  window.dispatchEvent(new CustomEvent<UploadErrorDetail>('fileUploadError', { detail: data }));
};

export const triggerProjectCreated = (data: ProjectCreatedDetail): void => {
  window.dispatchEvent(new CustomEvent<ProjectCreatedDetail>('projectCreated', { detail: data }));
};

export const triggerProjectShared = (data: ProjectSharedDetail): void => {
  window.dispatchEvent(new CustomEvent<ProjectSharedDetail>('projectShared', { detail: data }));
};

export const triggerSyncComplete = (data: SyncCompleteDetail): void => {
  window.dispatchEvent(new CustomEvent<SyncCompleteDetail>('syncCompleted', { detail: data }));
};

// Optional convenience helpers used in timeline integrations
export const triggerSyncStarted = (message: string): void => {
  window.dispatchEvent(
    new CustomEvent('syncStarted', { detail: { message, timestamp: new Date().toISOString() } }),
  );
};

export const triggerSyncError = (message: string): void => {
  window.dispatchEvent(
    new CustomEvent('syncError', { detail: { message, timestamp: new Date().toISOString() } }),
  );
};

export const triggerInfoNotification = (title: string, message: string): void => {
  window.dispatchEvent(
    new CustomEvent('notificationInfo', {
      detail: { title, message, timestamp: new Date().toISOString() },
    }),
  );
};

export const triggerSuccessNotification = (title: string, message: string): void => {
  window.dispatchEvent(
    new CustomEvent('notificationSuccess', {
      detail: { title, message, timestamp: new Date().toISOString() },
    }),
  );
};

export const triggerErrorNotification = (title: string, message: string): void => {
  window.dispatchEvent(
    new CustomEvent('notificationError', {
      detail: { title, message, timestamp: new Date().toISOString() },
    }),
  );
};

export const triggerUploadCompleteNotification = triggerUploadComplete;
