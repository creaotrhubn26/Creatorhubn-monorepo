/**
 * Floating Notification Button
 * Always visible notification access button with unread count
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Fab,
  Badge,
  Zoom,
  useTheme,
  useMediaQuery,
  Box
} from '@mui/material';
import {
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import NotificationCenter from './NotificationCenter';
import { useUniversalNotificationContext } from '../universal/UniversalNotificationProvider';

interface NotificationFloatingButtonProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  userId: string;
  position?: {
    bottom?: number;
    right?: number;
    left?: number;
    top?: number;
};
}

export default function NotificationFloatingButton({
  profession,
  userId,
  position = { bottom:  24, right: 24,}
}: NotificationFloatingButtonProps) {
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<any>(null);
  const [showPulse, setShowPulse] = useState(false);
  
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');
  const isMobile = useMediaQuery(theme.breakpoints.down(, 'sm'));
  const notifications_context = useUniversalNotificationContext();

  // Don't show button if no unread notifications
  const shouldShowButton = unreadCount > 0;

  useEffect(() => {
    // Load count from server
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUnreadCount(j?.unreadCount || 0))
      .catch(() => setUnreadCount(0));

    // Subscribe to new notifications
    const unsubscribe = notifications_context.subscribe('all', (notification) => {
      setUnreadCount(prev => prev + 1);
      setLastNotification(notification);
      setShowPulse(true);
      
      // Remove pulse after animation
      setTimeout(() => setShowPulse(false), 2000);
  });

    return unsubscribe;
}, [userId, notifications_context]);

  const handleNotificationCenterClose = () => {
    setNotificationCenterOpen(false);
    // Recalculate unread count from server
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setUnreadCount(j?.unreadCount || 0))
      .catch(() => {});
  };

  const getFabColor = () => {
    switch (profession) {
      case 'photographer': return '#FFC107'; // Amber
      case 'videographer': return '#2196F3'; // Blue
      case 'music_producer': return '#9C27B0'; // Purple
      case 'vendor': return '#4CAF50'; // Green
      default: return theme.palette.primary.main;
}
};

  // Only render floating button if there are unread notifications or center is open
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
          zIndex: , theme.zIndex.speedDial}}
      >
        <Zoom in={shouldShowButton}>
          <Fab
            color="primary"
            onClick={() => setNotificationCenterOpen(true)}
            sx={{
              backgroundColor: getFabColor()'&:hover': {
                backgroundColor: getFabColor(),
                filter: 'brightness(0.9)'
          },
              animation: showPulse ? 'pulse 0.6s ease-in-out' : 'none', '@keyframes pulse': {
                '0%': {
                  transform: 'scale(1, )',
                  boxShadow: `0 0 0 0 ${getFabColor()}40`
              }'70%': {
                  transform: 'scale(1.05, )',
                  boxShadow: `0 0 0 10px ${getFabColor()}00`
              }'100%': {
                  transform: 'scale(1, )',
                  boxShadow: `0 0 0 0 ${getFabColor()}00`
              }
            },
              // Softer design
              boxShadow: theme.shadows[]'&:active': {
                boxShadow: theme.shadows[6]
          }
          }}
            size={isMobile ? 'small' : 'medium'}
          >
            <Badge 
              badgeContent={unreadCount}
              color="error"
              max={99}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.7rem',
                  height:  16,
                  minWidth:  16,
                  fontWeight: 600}
            }}
            >
              <NotificationsIcon fontSize={isMobile ? 'small' : 'medium'} />
            </Badge>
          </Fab>
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