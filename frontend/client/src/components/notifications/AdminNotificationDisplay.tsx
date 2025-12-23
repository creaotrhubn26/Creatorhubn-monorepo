import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
  IconButton,
  Snackbar,
  Paper,
  Chip,
  Stack
} from '@mui/material';
import {
  Close,
  Info,
  Warning,
  CheckCircle,
  Error,
  Campaign,
  OpenInNew,
  NotificationsActive
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface AdminNotification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'announcement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetAudience: string;
  actionButton?: string;
  actionUrl?: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean
}

const typeIcons = {
  info: <Info color="info"  />,
  warning: <Warning color="warning"  />,
  success: <CheckCircle color="success"  />,
  error: <Error color="error"  />,
  announcement: <Campaign color="primary" />, 
};

const typeColors = {
  info: 'info',
  warning: 'warning',
  success: 'success', 
  error: 'error',
  announcement: ''
} as const;

const priorityColors = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  urgent: ''
} as const;

export default function AdminNotificationDisplay() {
  // Theming system
  const theming = useTheming('photographer');
  const [openDialogs, setOpenDialogs] = useState<Set<number>>(new Set());
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<number>>(new Set());
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [realtimeNotifications, setRealtimeNotifications] = useState<AdminNotification[]>([]);

  // Fetch active notifications
  const { data: notifications, refetch } = useQuery({
    queryKey: ['/api/notifications/active', ],
    queryFn: () => apiRequest('/api/notifications/active', ),
    refetchInterval: 60000 // Refresh every minute
});

  // Initialize WebSocket connection for real-time notifications
  useEffect(() => {
    // For Replit environment, use specific WebSocket URL
    const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:5000';
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('🔗 Attempting WebSocket connection to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('🔔 Connected to notification server');
      setWsConnection(ws);
  };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'ADMIN_NOTIFICATION') {
          const newNotification = data.data;
          setRealtimeNotifications(prev => [newNotification, ...prev]);
          
          // Automatically show high priority notifications
          if (newNotification.priority === 'high' || newNotification.priority === 'urgent') {
            setOpenDialogs(prev => new Set([...prev, newNotification.id]));
        }
          
          // Refetch all notifications to update the list
          refetch();
      }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
  };

    ws.onclose = () => {
      console.log('🔔 Disconnected from notification server');
      setWsConnection(null);
  };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
  };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
  };
}, [refetch]);

  const allNotifications = [
    ...realtimeNotifications,
    ...(notifications?.data || [])
  ].filter((notification, index, self) => 
    index === self.findIndex(n => n.id === notification.id) && 
    !dismissedNotifications.has(notification.id)
  );

  const activeNotifications = allNotifications.filter(notification => {
    if (!notification.isActive) return false;
    if (notification.expiresAt && new Date(notification.expiresAt) <= new Date()) return false;
    
    // Filter out test notifications and mock data
    if (notification.title?.includes('Test') || 
        notification.message?.includes('System test') ||
        notification.message?.includes('test varsel') ||
        notification.message?.includes('alle tabeller og funksjonalitet fungerer') ||
        notification.type?.includes('test')) {
      return false;
  }
    
    return true;
});

  const handleOpenDialog = (notificationId: number) => {
    setOpenDialogs(prev => new Set([...prev, notificationId]));
};

  const handleCloseDialog = (notificationId: number) => {
    setOpenDialogs(prev => {
      const newSet = new Set(prev);
      newSet.delete(notificationId);
      return newSet;
});
};

  const handleDismissNotification = (notificationId: number) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]));
    handleCloseDialog(notificationId);
};

  const handleActionClick = (url: string) => {
    window.open(url, '_blank');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('nb-NO');
};

  // Auto-show important notifications that haven't been dismissed
  useEffect(() => {
    activeNotifications.forEach(notification => {
      if (
        (notification.priority === 'urgent' || notification.type === 'error') &&
        !openDialogs.has(notification.id) &&
        !dismissedNotifications.has(notification.id)
      ) {
        setTimeout(() => {
          setOpenDialogs(prev => new Set([...prev, notification.id]));
      }, 1000);
    }
  });
}, [activeNotifications, openDialogs, dismissedNotifications]);

  return (
    <>
      {/* Notification Dialogs */}
      {activeNotifications.map(notification => (
        <Dialog
          key={notification.id}
          open={openDialogs.has(notification.id)}
          onClose={() => handleCloseDialog(notification.id)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
              {typeIcons[notification.type]}
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{notification.title}</Typography>
              <Chip 
                label={notification.priority}
                size="small" 
                color={priorityColors[notification.priority as keyof typeof priorityColors]}
              />
            </Box>
            <IconButton onClick={() => handleCloseDialog(notification.id)}>
              <Close />
            </IconButton>
          </DialogTitle>
          
          <DialogContent>
            <Alert 
              severity={typeColors[notification.type]}
              sx={{ mb:  2 }}
              variant="outlined"
            >
              {notification.message}
            </Alert>
            
            <Typography variant="caption" color="text.secondary">
              Sendt: {formatDate(notification.createdAt)}
            </Typography>
          </DialogContent>
          
          <DialogActions sx={{ p:  3, pt:  1 }}>
            <Button 
              onClick={() => handleDismissNotification(notification.id)}
              variant="outlined"
            >
              Lukk
            </Button>
            
            {notification.actionButton && notification.actionUrl && (
              <Button
                variant="contained"
                onClick={() => handleActionClick(notification.actionUrl!)}
                startIcon={<OpenInNew />}
                sx={{
                  background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                  boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                  ...theming.getThemedButtonSx()}}
              >
                {notification.actionButton}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      ))}

      {/* Floating Notification Indicator */}
      {activeNotifications.length > 0 && (
        <Paper
          sx={{
            position: 'fixed',
            top:  20,
            right:  20,
            zIndex: 14,
            p:  2,
            borderRadius:  3,
            background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(255, 152, 0, 0.3)', '&:hover': {
              transform: 'scale(1.05)',
              transition:'transform 0.2s ease',
            }}}
          onClick={() => {
            activeNotifications.forEach(notification => {
              if (!openDialogs.has(notification.id)) {
                handleOpenDialog(notification.id);
              }
            });
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <NotificationsActive />
            <Typography variant="body2" fontWeight="bold">
              {activeNotifications.length} nye meldinger
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Connection Status - Hidden for background operation */}
    </>
  );
}