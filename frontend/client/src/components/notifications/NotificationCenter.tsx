/**
 * Notification Center
 * Organized interface for viewing and managing all notifications
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useCallback } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondary,
  Chip,
  Badge,
  Drawer,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Button,
  Tooltip,
  Avatar,
  Divider,
  Alert,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  PhotoCameraAlt as PhotoIcon,
  Videocamcam as VideoIcon,
  LibraryMusicNote as MusicIcon,
  Build as VendorIcon,
  CloudUpload as UploadIcon,
  Google as GoogleIcon,
  TrendingUp as TimelineIcon,
  LocalDirectionsBoatping as DeliveryIcon,
  Clear as ClearIcon,
  FilterListList as FilterIcon,
  MoreVert as MoreIcon,
  NotificationsActive,
  AccountBalance as SplitSheetIcon,
} from '@mui/icons-material';
// Note: Using local state instead of UniversalNotificationProvider context

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  profession: string;
  component?: string;
  metadata?: any;
  read: boolean;
  priority: 'low' | 'medium' | 'high'
}

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string
}

export default function NotificationCenter({
  open,
  onClose,
  profession,
  userId,
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { professionConfigs, getProfessionDisplayName, professionSupports } = useDynamicProfessions();
  
  // Check if profession supports split sheets (currently music_producer, but can be extended via profession config)
  const supportsSplitSheets = React.useMemo(() => {
    const config = professionConfigs[profession];
    if (!config) return profession === 'music_producer';
    return profession === 'music_producer' || professionSupports(profession 'split_sheets,');
  }, [profession, professionConfigs, professionSupports]);
  
  const [showSettings, setShowSettings] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [filter, setFilter] = useState<string>('all');
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    googleDrive: true,
    googleDocs: true,
    photoUpload: true,
    videoProduction: true,
    musicProduction: true,
    splitSheets: true,
    splitSheetSignatures: true,
    splitSheetPayments: true,
    splitSheetRevenue: true,
    equipmentRental: true,
    weddingTimeline: true,
    clientDelivery: true,
    projectManagement: true,
    systemUpdates: true,
    soundEnabled: true,
    desktopNotifications: true,
    emailNotifications: false,
  });
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Load notifications from server
  useEffect(() => {
    fetch(`/api/notifications`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.notifications) setNotifications(j.notifications);
      })
      .catch(() => {});
  }, []);

  const generateMockNotifications = () => {
    const mockNotifications: NotificationItem[] = [
      {
        id: 'mock_',
        type: 'upload',
        title: 'Foto Opplasting Fullført',
        message: 'Bryllupsfoto fra Lemy & Ole Gunnar er lastet opp til Google Drive',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        profession: profession,
        read: false,
        priority: 'medium',
    },
      {
        id: 'mock_',
        type: 'project',
        title: 'Nytt Prosjekt Opprettet',
        message: 'Business portrett-sesjon med CreatorHub Norge er klar',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        profession: profession,
        read: false,
        priority: 'high',
    },
      // Split Sheet Notifications (for all professions that support split sheets)
      ...(supportsSplitSheets ? [
        {
          id: 'mock_split_sheet_1',
          type: 'split_sheet_signed',
          title: 'Split Sheet Signert',
          message: 'En bidragsyter har signert split sheet "New Track 2024"',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          profession: profession,
          read: false,
          priority: 'high' as const,
        },
        {
          id: 'mock_split_sheet_2',
          type: 'split_sheet_payment',
          title: 'Betaling Prosessert',
          message: 'Betaling på 5,000 kr er prosessert for split sheet "Summer Hit"',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          profession: profession,
          read: false,
          priority: 'medium' as const,
        },
      ] : []),
    ];

    // Only add if no notifications exist
    if (notifications.length === 0) {
      setNotifications(mockNotifications);
  }
};

  const loadStoredNotifications = () => {
    // Server-first
    fetch(`/api/notifications`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.notifications) {
          setNotifications(j.notifications);
        } else {
          const stored = localStorage.getItem(`notifications_${userId}`);
          if (stored) {
            try { setNotifications(JSON.parse(stored)); } catch { setNotifications([]); }
          }
        }
      })
      .catch(() => {
        const stored = localStorage.getItem(`notifications_${userId}`);
        if (stored) {
          try { setNotifications(JSON.parse(stored)); } catch { setNotifications([]); }
        }
      });
  };

  const saveNotifications = (updatedNotifications: NotificationItem[]) => {
    // Best-effort server sync for new notifications not yet persisted
    // Fallback to localStorage
    try {
      const toPersist = updatedNotifications.slice(0, 100);
      // Attempt to create the newest notification on the server (others handled by specific routes)
      const newest = toPersist[0];
      if (newest) {
        fetch('/api/notifications', {
          method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
          body: JSON.stringify(newest)
        }).catch(() => {});
      }
    } catch {}
    localStorage.setItem(`notifications_${userId}`, JSON.stringify(updatedNotifications.slice(0, 100)));
  };

  const addNotification = useCallback(
    (notification: any) => {
      const newNotification: NotificationItem = {
        id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        timestamp: notification.timestamp || new Date().toISOString(),
        profession: notification.profession || profession,
        component: notification.component,
        metadata: notification.metadata,
        read: false,
        priority: getPriority(notification.type),
      };

      // Check if this notification type is enabled
      if (!isNotificationEnabled(newNotification.type)) {
        return;
      }

      // Persist server-first
      fetch('/api/notifications', {
        method: 'POST', headers: { 'Content-Type' : 'application/json' }, credentials: 'include',
        body: JSON.stringify(newNotification)
      }).catch(() => {});

      setNotifications((prev) => {
        const updated = [newNotification, ...prev];
        // Local fallback
        try { localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated.slice(0, 100))); } catch {}
        return updated;
      });

      // Play sound if enabled
      if (settings.soundEnabled) {
        playNotificationSound(newNotification.priority);
      }

      // Show desktop notification if enabled
      if (settings.desktopNotifications && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(newNotification.title, {
            body: newNotification.message,
            icon: getProfessionIcon(newNotification.profession),
          });
        }
      }
    },
    [profession, settings, userId],
  );

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    fetch(`/api/notifications/${notificationId}/read`, { method: 'PUT', credentials: 'include' }).catch(() => {});
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      // Persist each to server (best-effort)
      updated.forEach(n => {
        fetch(`/api/notifications/${n.id}/read`, { method: 'PUT', credentials: 'include' }).catch(() => {});
      });
      try { localStorage.setItem(`notifications_${userId}`, JSON.stringify(updated.slice(0, 100))); } catch {}
      return updated;
    });
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    fetch(`/api/notifications/${notificationId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    fetch(`/api/notifications`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
    localStorage.removeItem(`notifications_${userId}`);
  };

  const isNotificationEnabled = (type: string): boolean => {
    if (type.includes('google_drive')) return settings.googleDrive;
    if (type.includes('google_docs')) return settings.googleDocs;
    if (type.includes('photo_upload')) return settings.photoUpload;
    if (type.includes('video_production')) return settings.videoProduction;
    if (type.includes('music_production')) return settings.musicProduction;
    if (type.includes('split_sheet')) {
      if (type.includes('signature') || type.includes('signed')) return settings.splitSheetSignatures;
      if (type.includes('payment')) return settings.splitSheetPayments;
      if (type.includes('revenue')) return settings.splitSheetRevenue;
      return settings.splitSheets;
    }
    if (type.includes('equipment_rental')) return settings.equipmentRental;
    if (type.includes('wedding_timeline')) return settings.weddingTimeline;
    if (type.includes('client_delivery')) return settings.clientDelivery;
    if (type.includes('project')) return settings.projectManagement;
    if (type.includes('system')) return settings.systemUpdates;
    return true;
};

  const getPriority = (type: string): 'low' | 'medium' | 'high' => {
    if (type.includes('error') || type.includes('failed')) return 'high';
    if (type.includes('split_sheet_signed') || type.includes('split_sheet_completed')) return 'high';
    if (type.includes('split_sheet_payment')) return 'medium';
    if (type.includes('completed') || type.includes('delivered')) return 'medium';
    return 'low';
};

  // Local fallback function for profession icons (used when dynamic hooks are not available)
  const getLocalProfessionIcon = (profession: string) => {
    switch (profession) {
      case 'photographer':
        return <PhotoIcon />;
      case 'videographer':
        return <VideoIcon />;
      case 'music_producer':
        return <MusicIcon />;
      case 'vendor':
        return <VendorIcon />;
      default:
        return <NotificationsIcon />;
}
};

  const getNotificationIcon = (type: string) => {
    if (type.includes('split_sheet')) return <SplitSheetIcon sx={{ color: '#9f7aea' }} />;
    if (type.includes('google')) return <GoogleIcon />;
    if (type.includes('upload')) return <UploadIcon />;
    if (type.includes('timeline')) return <TimelineIcon />;
    if (type.includes('delivery')) return <DeliveryIcon />;
    return <NotificationsIcon />;
};

  const playNotificationSound = (priority: string) => {
    const audio = new Audio();
    switch (priority) {
      case 'high':
        audio.src =
          'data:audio/wav;base4,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D0r2AhAEKpuuGwTQYYdqngqFsaDDePw+yGLgUxhsuOoVgVGWqfyNQHBj2LdoZoRgO5+M7o2dUsBDiKyNwbFrYS7tHExqiOJw';
        break;
      case 'medium':
        audio.src =
          'data: audio/wav;base4,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D0r2AhAEKK59jPgiMFKLb5zA==';
        break;
      default: audio.src =
          'data:audio/wav;base4,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+D0r2A=';
  }
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore autoplay restrictions
};

  const getFilteredNotifications = () => {
    let filtered = notifications;

    if (filter !== 'all') {
      filtered = filtered.filter((n) => {
        switch (filter) {
          case 'google':
            return n.type.includes('google');
          case 'upload':
            return n.type.includes('upload');
          case 'project':
            return n.type.includes('project');
          case 'client':
            return n.type.includes('client') || n.type.includes('delivery');
          case 'timeline':
            return n.type.includes('timeline');
          case 'unread':
            return !n.read;
          case 'high':
            return n.priority === 'high';
          default: return true;
    }
    });
  }

    switch (activeTab) {
      case 1: // Google Services
        return filtered.filter((n) => n.type.includes('google'));
      case 2: // Projects
        return filtered.filter((n) => n.type.includes('project') || n.type.includes('timeline'));
      case 3: // Client Delivery
        return filtered.filter((n) => n.type.includes('client') || n.type.includes('delivery'));
      case 4: // Split Sheets (for all professions that support split sheets)
        return supportsSplitSheets ? filtered.filter((n) => n.type.includes('split_sheet')) : [];
      default: // All
        return filtered;
}
};

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = getFilteredNotifications();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 480,},
          maxWidth: '100vw',
      }}}
    >
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
        {/* Header */}
        <Paper elevation={2} sx={{ p: 2, position: 'sticky', top: 0, zIndex: 1, ...theming.getThemedCardSx() }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb:  1}}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Varsler</Typography>
              <Chip
                label={getProfessionDisplayName(profession)}
                size="small"
                variant="outlined"
                icon={getProfessionIcon(profession)}
              />
            </Box>
            <Box>
              <Tooltip title="Filter">
                <IconButton onClick={(e) => setFilterAnchor(e.currentTarget)} size="small">
                  <FilterIcon />
                </IconButton>
              </Tooltip>
              {isSupported && (
                <Tooltip title="Push-varsler innstillinger">
                  <IconButton onClick={() => setPushSettingsOpen(true)} size="small" color={pushEnabled ? 'primary' : 'default'}>
                    {pushEnabled ? <NotificationsActive /> : <NotificationsIcon />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Innstillinger">
                <IconButton onClick={() => setShowSettings(!showSettings)} size="small">
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button size="small" onClick={markAllAsRead} disabled={unreadCount === 0}>
              Merk alle som lest
            </Button>
            <Button
              size="small"
              onClick={clearAllNotifications}
              color="error"
              disabled={notifications.length === 0}
            >
              Slett alle
            </Button>
          </Box>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={`Alle (${notifications.length})`} />
            <Tab label="Google Tjenester" />
            <Tab label="Prosjekter" />
            <Tab label="Klientleveringer" />
            {supportsSplitSheets && (
              <Tab label={`Split Sheets (${notifications.filter(n => n.type.includes('split_sheet')).length})`} />
            )}
          </Tabs>
        </Paper>

        {/* Settings Panel */}
        {showSettings && (
          <Paper sx={{ p: 2, m: 1, backgroundColor: 'grey.50',  ...theming.getThemedCardSx() }}>
            <Typography variant="subtitle2" gutterBottom>
              Varslingsinnstillinger
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.googleDrive}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        googleDrive: e.target.checked,
                    }))
                  }
                  />
              }
                label="Google Drive opplastinger"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.photoUpload}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        photoUpload: e.target.checked,
                    }))
                  }
                  />
              }
                label="Bildeopplastinger"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.weddingTimeline}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        weddingTimeline: e.target.checked,
                    }))
                  }
                  />
              }
                label="Bryllupstidslinjer"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.clientDelivery}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        clientDelivery: e.target.checked,
                    }))
                  }
                  />
              }
                label="Klientleveringer"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.soundEnabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        soundEnabled: e.target.checked,
                    }))
                  }
                  />
              }
                label="Varselslyder"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.desktopNotifications}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        desktopNotifications: e.target.checked,
                    }))
                  }
                  />
              }
                label="Skrivebordsvarslinger"
              />
            </Box>
          </Paper>
        )}

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflow: 'auto'}}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p:  4, textAlign: 'center'}}>
              <NotificationsIcon sx={{ fontSize:  48, color: 'grey.40', mb:  2 }} />
              <Typography color="text.secondary">
                {activeTab === 0 ? 'Ingen varsler ennå' : 'Ingen varsler i denne kategorien'}
              </Typography>
            </Box>
          ) : (
            <List>
              {filteredNotifications.map((notification, index) => (
                <div key={notification.id}>
                  <ListItem
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      cursor: 'pointer', '&:hover': { backgroundColor: 'action.selected',}}}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <ListItemIcon>
                      <Badge
                        color={notification.priority === 'high' ? 'error' : 'primary'}
                        variant={notification.read ? 'standard' : 'dot'}
                      >
                        {getNotificationIcon(notification.type)}
                      </Badge>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              fontWeight: otification.read ? 'normal' : 'bold',
                              flex:  1}}
                          >
                            {notification.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(notification.timestamp)}
                          </Typography>
                        </Box>
                    }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {notification.message}
                          </Typography>
                          {notification.component && (
                            <Chip
                              label={notification.component}
                              size="small"
                              variant="outlined"
                              sx={{ mt:  1 }}
                            />
                          )}
                        </Box>
                    }
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                    }}
                    >
                      <ClearIcon />
                    </IconButton>
                  </ListItem>
                  {index < filteredNotifications.length - 1 && <Divider />}
                </div>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setFilter('all');
            setFilterAnchor(null);
        }}
        >
          Alle varsler
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFilter('unread');
            setFilterAnchor(null);
        }}
        >
          Uleste
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFilter('high');
            setFilterAnchor(null);
        }}
        >
          Høy prioritet
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFilter('google');
            setFilterAnchor(null);
        }}
        >
          Google-tjenester
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFilter('upload');
            setFilterAnchor(null);
        }}
        >
          Opplastinger
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFilter('project');
            setFilterAnchor(null);
        }}
        >
          Prosjekter
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFilter('client');
            setFilterAnchor(null);
        }}
        >
          Klientleveringer
        </MenuItem>
      </Menu>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Drawer>
  );
}

// Local fallback function for profession display names (deprecated - use useDynamicProfessions hook instead)
// This is kept for backwards compatibility only
function getLocalProfessionDisplayName(profession: string): string {
  switch (profession) {
    case 'photographer':
      return 'Fotograf'; // Fallback - use getProfessionDisplayName from hook instead
    case 'videographer':
      return 'Videograf'; // Fallback - use getProfessionDisplayName from hook instead
    case 'music_producer':
      return 'Musikkprodusent'; // Fallback - use getProfessionDisplayName from hook instead
    case 'vendor':
      return 'Utstyrsleverandør';
    default:
      return profession;
}
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Nå';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}t`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    year: diffDays > 365 ?'2-digit' : undefined,
});
}
