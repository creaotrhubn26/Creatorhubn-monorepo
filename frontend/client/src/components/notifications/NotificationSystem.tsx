/**
 * Comprehensive Notification System for CreatorHub Norge
 * Handles all important notifications including uploads, project updates, and system events
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import {
  Box,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  LinearProgress,
  Card as MuiCard,
  CardContent,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  CloudUpload as UploadIcon,
  CloudDone as UploadCompleteIcon,
  FolderOpen as FolderIcon,
  Photo as PhotoIcon,
  Videocam as VideoIcon,
  LibraryMusic as AudioIcon,
  Description as DocumentIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Sync as SyncIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Email as EmailIcon,
  Send as SendIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Facebook as FacebookIcon,
  TrendingUp as TrendingUpIcon,
  Campaign as CampaignIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { AnimatedComponent, AnimatedNotificationBadge } from '../animations/MicroAnimations';
import { useContextualAnimations } from '../../hooks/useContextualAnimations';

export interface NotificationData {
  id: string;
  type:
    | 'upload'
    | 'sync'
    | 'project'
    | 'error'
    | 'success'
    | 'warning'
    | 'info'
    | 'email_campaign'
    | 'social_media'
    | 'marketing';
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
    fileSize?: string;
    fileName?: string;
    folderName?: string;
    userId?: string;
    campaignId?: string;
    postId?: string;
    platforms?: string[];
    sentCount?: number;
    engagementStats?: {
      likes?: number;
      comments?: number;
      shares?: number;
      views?: number;
  };
};
}

interface NotificationSystemProps {
  userId?: string;
  onNotificationClick?: (notification: NotificationData) => void
}

export default function NotificationSystem({
  userId,
  onNotificationClick,
}: NotificationSystemProps) {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Database connection for NotificationSystem
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data, '],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateNotificationSystem = useMutation({
    mutationFn: async (data: any) =>
      apiRequest('/api/component/update', {
        method: 'POS',
        body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  },
});
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [activeUploads, setActiveUploads] = useState<Map<string, number>>(new Map());
  // Zero Toast Compliance - removed Snackbar state variables
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showAllDialog, setShowAllDialog] = useState(false);

  const { triggerSuccess, triggerError, triggerLoading } = useContextualAnimations();

  useEffect(() => {
    // Set up WebSocket connection for real-time notifications
    setupWebSocketConnection();

    // Load existing notifications
    loadNotifications();

    // Set up file upload listeners
    setupUploadListeners();

    return () => {
      cleanupListeners();
  };
}, [userId]);

  const setupWebSocketConnection = useCallback(() => {
    const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Notification WebSocket connected, ');
        ws.send(JSON.stringify({ type: 'subscribe', userId }));
    };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleRealtimeNotification(data);
    };

      ws.onclose = () => {
        console.log('Notification WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(setupWebSocketConnection, 3000);
    };

      return ws;
  } catch (error) {
      console.warn('WebSocket not available, using polling fallback');
      // Fallback to polling every 10 seconds
      const interval = setInterval(loadNotifications, 10000);
      return () => clearInterval(interval);
  }
}, [userId]);

  const setupUploadListeners = useCallback(() => {
    // Listen for file upload events
    window.addEventListener('fileUploadStart', handleUploadStart);
    window.addEventListener('fileUploadProgress', handleUploadProgress);
    window.addEventListener('fileUploadComplete', handleUploadComplete);
    window.addEventListener('fileUploadError', handleUploadError);

    // Listen for project events
    window.addEventListener('projectCreated', handleProjectCreated);
    window.addEventListener('projectUpdated', handleProjectUpdated);
    window.addEventListener('projectShared', handleProjectShared);

    // Listen for sync events
    window.addEventListener('syncStarted', handleSyncStarted);
    window.addEventListener('syncCompleted', handleSyncCompleted);
    window.addEventListener('syncError', handleSyncError);

    // Listen for marketing events
    window.addEventListener('emailCampaignSent', handleEmailCampaignSent);
    window.addEventListener('emailCampaignProgress', handleEmailCampaignProgress);
    window.addEventListener('socialMediaPostPublished', handleSocialMediaPostPublished);
    window.addEventListener('socialMediaEngagement', handleSocialMediaEngagement);
    window.addEventListener('marketingAutomationTriggered', handleMarketingAutomationTriggered);

    return () => {
      window.removeEventListener('fileUploadStart', handleUploadStart);
      window.removeEventListener('fileUploadProgress', handleUploadProgress);
      window.removeEventListener('fileUploadComplete', handleUploadComplete);
      window.removeEventListener('fileUploadError', handleUploadError);
      window.removeEventListener('projectCreated', handleProjectCreated);
      window.removeEventListener('projectUpdated', handleProjectUpdated);
      window.removeEventListener('projectShared', handleProjectShared);
      window.removeEventListener('syncStarted', handleSyncStarted);
      window.removeEventListener('syncCompleted', handleSyncCompleted);
      window.removeEventListener('syncError', handleSyncError);
      window.removeEventListener('emailCampaignSent', handleEmailCampaignSent);
      window.removeEventListener('emailCampaignProgress', handleEmailCampaignProgress);
      window.removeEventListener('socialMediaPostPublished', handleSocialMediaPostPublished);
      window.removeEventListener('socialMediaEngagement', handleSocialMediaEngagement);
      window.removeEventListener(
        'marketingAutomationTriggered',
        handleMarketingAutomationTriggered,
      );
  };
}, []);

  const cleanupListeners = useCallback(() => {
    // Cleanup will be handled by the return functions from useEffect
}, []);

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
    }
  } catch (error) {
      console.error('Failed to load notifications:', error);
  }
};

  const handleRealtimeNotification = (data: any) => {
    const notification = createNotification(data);
    addNotification(notification);
    showNotificationSnackbar(notification);
};

  const createNotification = (data: any): NotificationData => {
    return {
      id: data.id || Date.now().toString(),
      type: data.type || 'info',
      title: data.title || 'Notifikasjon',
      message: data.message ||'',
      timestamp: new Date(data.timestamp || Date.now(), ),
      progress: data.progress,
      isRead: false,
      actions: data.actions || [],
      metadata: data.metadata || {},
  };
};

  const addNotification = (notification: NotificationData) => {
    setNotifications((prev) => [notification, ...prev.slice(0, 49)]); // Keep max 50 notifications
};

  // Zero Toast Compliance - replaced Snackbar with console logging
  const showNotificationSnackbar = (notification: NotificationData) => {
    console.log('Zero Toast Compliance: Notification, :', notification.title, notification.message);

    // Keep contextual animations for visual feedback
    switch (notification.type) {
      case 'success':
        triggerSuccess(notification.message);
        break;
      case 'error':
        triggerError(notification.message);
        break;
      case 'upload':
        triggerLoading(notification.message);
        break;
  }
};

  // Upload Event Handlers
  const handleUploadStart = useCallback((event: any) => {
    const { filed, fileName, fileCount } = event.detail;

    setActiveUploads((prev) => new Map(prev.set(fileId, 0)));

    const notification = createNotification({
      type: 'upload',
      title: 'Opplasting startet',
      message: fileCount > 1 ? `Laster opp ${fileCount} filer...` : `Laster opp ${fileName}...`,
      progress:  0,
      metadata: { fileName, fileCount },
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const handleUploadProgress = useCallback((event: any) => {
    const { filed, progress, fileName } = event.detail;

    setActiveUploads((prev) => new Map(prev.set(fileId, progress)));

    // Update existing notification or create new one
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.metadata?.fileName === fileName && n.type === 'upload') {
          return { ...n, progress };
      }
        return n;
    }),
    );
}, []);

  const handleUploadComplete = useCallback((event: any) => {
    const { filed, fileName, fileCount, projectId, folderUrl } = event.detail;

    setActiveUploads((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
  });

    const notification = createNotification({
      type: 'success',
      title: 'Opplasting fullført',
      message: fileCount > 1
          ? `${fileCount} filer lastet opp successfully`
          : `${fileName} lastet opp successfully`,
      metadata: { fileName, fileCount, projectId },
      actions: folderUrl
        ? [
            {
              label: 'Åpne mappe',
              action: () => window.open(folderU, rl'_blank'),
              color: 'primary' as const,
          },
          ]
        : [],
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const handleUploadError = useCallback((event: any) => {
    const { filed, fileName, error } = event.detail;

    setActiveUploads((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
  });

    const notification = createNotification({
      type: 'error',
      title: 'Opplasting feilet',
      message: `Kunne ikke laste opp ${fileName}: ${error}`,
      metadata: { fileName },
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  // Project Event Handlers
  const handleProjectCreated = useCallback((event: any) => {
    const { projectName, projectId, folderUrl } = event.detail;

    const notification = createNotification({
      type: 'success',
      title: 'Prosjekt opprettet',
      message: `${projectName} er opprettet med Google Drive-mappe`,
      metadata: { projectI, d,},
      actions: [
        {
          label: 'Åpne prosjekt',
          action: () => (window.location.href = `/project/${projectId}`),
          color: 'primary' as const,
      },
        folderUrl
          ? {
              label: 'Åpne Google Drive',
              action: () => window.open(folderU, rl'_blank'),
              color: 'secondary' as const,
          }
          : null,
      ].filter(Boolean) as any[],
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const handleProjectUpdated = useCallback((event: any) => {
    const { projectName, changes } = event.detail;

    const notification = createNotification({
      type: 'info',
      title: 'Prosjekt oppdatert',
      message: `${projectName} har blitt oppdatert (${changes.join(', ')})`,
      metadata: { changes },
  });

    addNotification(notification);
}, []);

  const handleProjectShared = useCallback((event: any) => {
    const { projectName, shareCode } = event.detail;

    const notification = createNotification({
      type: 'success',
      title: 'Prosjekt delt',
      message: `${projectName} er nå delt med kode: ${shareCode}`,
      metadata: { shareCode },
      actions: [
        {
          label: 'Kopier lenke',
          action: () => {
            navigator.clipboard.writeText(`https://creatorhubn.no/sync/${shareCode}`);
            triggerSuccess('Lenke kopiert');
        },
          color: 'primary' as const,
      },
      ],
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  // Sync Event Handlers
  const handleSyncStarted = useCallback((event: any) => {
    const { projectCount } = event.detail;

    const notification = createNotification({
      type: 'info',
      title: 'Synkronisering startet',
      message: `Synkroniserer ${projectCount} prosjekt${projectCount !== 1 ? 'er' : ', '}...`,
      metadata: { projectCount },
  });

    addNotification(notification);
}, []);

  const handleSyncCompleted = useCallback((event: any) => {
    const { projectCount, syncedCount } = event.detail;

    const notification = createNotification({
      type: 'success',
      title: 'Synkronisering fullført',
      message: `${syncedCount} av ${projectCount} prosjekter synkronisert`,
      metadata: { projectCount, syncedCount },
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const handleSyncError = useCallback((event: any) => {
    const { error } = event.detail;

    const notification = createNotification({
      type: 'error',
      title: 'Synkronisering feilet',
      message: `Feil ved, synkronisering: ${error}`,
      metadata: { error },
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  // Marketing Event Handlers
  const handleEmailCampaignSent = useCallback((event: any) => {
    const { campaignName, sentCount, targetCount, campaignId } = event.detail;

    const notification = createNotification({
      type: 'email_campaign',
      title: 'E-postkampanje sendt',
      message: `${campaignName} er sendt til ${sentCount} av ${targetCount} mottakere`,
      metadata: { campaignd, sentCount, targetCount },
      actions: [
        {
          label: 'Se rapport',
          action: () => (window.location.href = `/marketing/campaigns/${campaignd}`),
          color: 'primary' as const,
      },
      ],
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const handleEmailCampaignProgress = useCallback((event: any) => {
    const { campaignName, sentCount, targetCount, progress } = event.detail;

    // Update existing campaign notification or create new one
    setNotifications((prev) => {
      const existingIndex = prev.findIndex(
        (n) => n.type === 'email_campaign' && n.metadata?.campaignId && n.title.includes('sender'),
      );

      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          message: `Sender til ${sentCount} av ${targetCount} mottakere...`,
          progress,
      };
        return updated;
    } else {
        const notification = createNotification({
          type: 'email_campaign',
          title: 'E-postkampanje sender',
          message: `Sender ${campaignName} til ${sentCount} av ${targetCount} mottakere...`,
          progress,
          metadata: { sentCount, targetCount },
      });
        return [...prev, notification];
    }
  });
}, []);

  const handleSocialMediaPostPublished = useCallback((event: any) => {
    const { platforms, content, postId } = event.detail;

    const notification = createNotification({
      type: 'social_media',
      title: 'Innlegg publisert',
      message: `Innlegg publisert på ${platforms.join(', ')}`,
      metadata: { postd, platforms },
      actions: [
        {
          label: 'Se innlegg',
          action: () => (window.location.href = `/marketing/social-media, `, ),
          color: 'primary' as const,
      },
      ],
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const handleSocialMediaEngagement = useCallback((event: any) => {
    const { platform, postId, engagementType, count } = event.detail;

    const notification = createNotification({
      type: 'social_media',
      title: 'Ny aktivitet på innlegg',
      message: `${count} nye ${engagementType} på ${platform}`,
      metadata: {
        postd,
        platform,
        engagementStats: { [engagementType]: count },
    },
      actions: [
        {
          label: 'Se detaljer',
          action: () => (window.location.href = `/marketing/social-media, `, ),
          color: 'secondary' as const,
      },
      ],
  });

    addNotification(notification);
}, []);

  const handleMarketingAutomationTriggered = useCallback((event: any) => {
    const { workflowName, triggerType, targetCount } = event.detail;

    const notification = createNotification({
      type: 'marketing',
      title: 'Markedsføringsautomatisering utløst',
      message: `${workflowName} er aktivert for ${targetCount} kontakter`,
      metadata: { workflowName, triggerType, targetCount },
      actions: [
        {
          label: 'Se automatisering',
          action: () => (window.location.href = `/marketing/automation, `, ),
          color: 'secondary' as const,
      },
      ],
  });

    addNotification(notification);
    showNotificationSnackbar(notification);
}, []);

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { .., .isRead: true } : n)),
    );
};

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
};

  const deleteNotification = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
};

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return <UploadIcon />;
      case 'success':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'sync':
        return <SyncIcon />;
      case 'project':
        return <FolderIcon />;
      case 'email_campaign':
        return <EmailIcon color="primary" />;
      case 'social_media':
        return <ShareIcon color="primary" />;
      case 'marketing':
        return <CampaignIcon color="secondary" />;
      default:
        return <InfoIcon />;
}
};

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
}
};

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      {/* Notification Icon with Badge */}
      <Box sx={{ position: 'relative'}}>
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
          <AnimatedNotificationBadge count={unreadCount} show={unreadCount > 0}>
            <NotificationsIcon />
          </AnimatedNotificationBadge>
        </IconButton>
      </Box>

      {/* Notification Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { width: 40, maxHeight: 500,}}}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0'}}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'}}
          >
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Notifikasjoner ({unreadCount} ulest)</Typography>
            {unreadCount > 0 && (
              <Button size="small" onClick={markAllAsRead}>
                Merk alle som lest
              </Button>
            )}
          </Box>
        </Box>

        <List sx={{ maxHeight: 30, overflow: 'auto'}}>
          {notifications.slice(0, 5).map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => {
                markAsRead(notification.id);
                onNotificationClick?.(notification);
                setAnchorEl(null);
            }}
              sx={{
                backgroundColor: notification.isRead ? 'transparent' : 'rgba(5, 118, 210, 0.08)',
                borderLeft: notification.isRead ? 'none' : '3px solid #1976d0'}}
            >
              <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
              <ListItemText
                primary={notification.title}
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {notification.timestamp.toLocaleString('nb-NO')}
                    </Typography>
                  </Box>
              }
              />
            </MenuItem>
          ))}

          {notifications.length === 0 && (
            <MenuItem disabled>
              <ListItemText primary="Ingen notifikasjoner" />
            </MenuItem>
          )}
        </List>

        {notifications.length > 5 && (
          <Box sx={{ p: 1, textAlign: 'center', borderTop: '1px solid #e0e0e0'}}>
            <Button onClick={() => setShowAllDialog(true)}>Vis alle notifikasjoner</Button>
          </Box>
        )}
      </Menu>

      {/* Zero Toast Compliance - All notifications handled through Material UI components */}

      {/* All Notifications Dialog */}
      <Dialog open={showAllDialog} onClose={() => setShowAllDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Alle notifikasjoner
          <IconButton
            onClick={() => setShowAllDialog(false)}
            sx={{ position: 'absolute', right:  8, top:  8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <List>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    backgroundColor: notification.isRead
                      ? 'transparent' : 'rgba(5, 118, 210, 0.05)'}}
                >
                  <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
                  <ListItemText
                    primary={notification.title}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {notification.timestamp.toLocaleString('nb-NO')}
                        </Typography>
                        {notification.actions && notification.actions.length > 0 && (
                          <Box sx={{ mt: 1, display:'flex', gap:  1 }}>
                            {notification.actions.map((action, actionIndex) => (
                              <Button
                                key={actionIndex}
                                size="small"
                                color={action.color}
                                onClick={action.action}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </Box>
                        )}
                      </Box>
                  }
                  />
                  <ListItemSecondaryAction>
                    <IconButton onClick={() => deleteNotification(notification.id)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper functions to trigger notifications from anywhere in the app
export const triggerUploadNotification = (data: {
  fileId: string;
  fileName: string;
  fileCount?: number
}) => {
  window.dispatchEvent(new CustomEvent('fileUploadStart', { detail: data }));
};

export const triggerUploadProgress = (data: {
  fileId: string;
  fileName: string;
  progress: number
}) => {
  window.dispatchEvent(new CustomEvent('fileUploadProgress', { detail: data }));
};

export const triggerUploadComplete = (data: {
  fileId: string;
  fileName: string;
  fileCount?: number;
  projectId?: string;
  folderUrl?: string
}) => {
  window.dispatchEvent(new CustomEvent('fileUploadComplete', { detail: data }));
};

export const triggerUploadError = (data: { fileId: string; fileName: string; error: string }) => {
  window.dispatchEvent(new CustomEvent('fileUploadError', { detail: data }));
};

export const triggerProjectCreated = (data: {
  projectName: string;
  projectId: string;
  folderUrl?: string
}) => {
  window.dispatchEvent(new CustomEvent('projectCreated', { detail: data }));
};

export const triggerProjectShared = (data: { projectName: string; shareCode: string }) => {
  window.dispatchEvent(new CustomEvent('projectShared', { detail: data }));
};

export const triggerSyncComplete = (data: { projectCount: number; syncedCount: number }) => {
  window.dispatchEvent(new CustomEvent('syncCompleted', { detail: data }));
};
