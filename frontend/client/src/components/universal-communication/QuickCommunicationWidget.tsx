/**
 * CreatorHub Norge - Quick Communication Widget
 * Compact floating widget for instant access to communication features
 * Material UI only, zero toast notifications
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Fab,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
  Avatar,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Zoom,
  Fade
} from '@mui/material';
import {
  Chat as ChatIcon,
  Email as EmailIcon,
  Notifications as NotificationIcon,
  VideoCall as MeetingIcon,
  Folder as ProjectIcon,
  Add as AddIcon,
  Close as CloseIcon,
  Message as MessageIcon,
  Person as PersonIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface QuickCommunicationWidgetProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onOpenFull?: () => void;
  onChannelSelect?: (channelId: string, type: string) => void
}

export default function QuickCommunicationWidget({
  userId,
  profession,
  position = 'bottom-right',
  onOpenFull,
  onChannelSelect
}: QuickCommunicationWidgetProps) {
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  // Fetch unread counts across all communication types
  const { data: communicationSummary = {} } = useQuery({
    queryKey: ['/api/communication/summary,', userId],
    queryFn: () => apiRequest(`/api/communication/channels?userId=${userId}`),
    refetchInterval: 1000, // Check for updates every 10 seconds
    select: (data) => {
      const summary = {
        chat: { count: 0, unread:  0 },
        email: { count: 0, unread:  0 },
        notification: { count: 0, unread:  0 },
        meeting: { count: 0, unread:  0 },
        project: { count: 0, unread:  0 },
        total: { count: 0, unread:  0 }
    };

      if (data.channels) {
        data.channels.forEach((channel: any) => {
          summary[channel.type] = summary[channel.type] || { count: 0, unread:  0 };
          summary[channel.type].count++;
          summary[channel.type].unread += channel.unreadCount || 0;
          summary.total.count++;
          summary.total.unread += channel.unreadCount || 0;
      });
    }

      return summary;
  }
});

  // Update total unread count
  useEffect(() => {
    setTotalUnread(communicationSummary.total?.unread || 0);
}, [communicationSummary]);

  const getPositionStyles = () => {
    const baseStyles = { position: 'fixed', zIndex: 130,};
    
    switch (position) {
      case 'bottom-right':
        return { ...baseStyles, bottom:  24, right: 24,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  24, left: 24,};
      case 'top-right':
        return { ...baseStyles, top:  88, right: 24,}; // Account for header
      case 'top-left':
        return { ...baseStyles, top:  88, left: 24,};
      default: return { ...baseStyles, bottom:  24, right: 24,};
  }
};

  const communicationActions = [
    {
      icon: <ChatIcon />,
      name: 'Chat',
      color: '#4caf50',
      count: communicationSummary.chat?.count || 0,
      unread: communicationSummary.chat?.unread || 0,
      action: () => handleOpenCommunicationType('chat')
},
    {
      icon: <EmailIcon />,
      name: 'E-post',
      color: '#2196f0',
      count: communicationSummary.email?.count || 0,
      unread: communicationSummary.email?.unread || 0,
      action: () => handleOpenCommunicationType('email')
},
    {
      icon: <NotificationIcon />,
      name: 'Varslinger',
      color: '#ff9800',
      count: communicationSummary.notification?.count || 0,
      unread: communicationSummary.notification?.unread || 0,
      action: () => handleOpenCommunicationType('notification')
},
    {
      icon: <MeetingIcon />,
      name: 'Møter',
      color: '#9c27b0',
      count: communicationSummary.meeting?.count || 0,
      unread: communicationSummary.meeting?.unread || 0,
      action: () => handleOpenCommunicationType('meeting')
},
    {
      icon: <ProjectIcon />,
      name: 'Prosjekter',
      color: '#607d80',
      count: communicationSummary.project?.count || 0,
      unread: communicationSummary.project?.unread || 0,
      action: () => handleOpenCommunicationType('project')
}
  ];

  const handleOpenCommunicationType = (type: string) => {
    setSpeedDialOpen(false);
    if (onChannelSelect) {
      onChannelSelect(', ', type);
  }
    if (onOpenFull) {
      onOpenFull();
  }
};

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
};

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
};

  // Recent notifications for quick preview
  const { data: recentNotifications = [, ],} = useQuery({
    queryKey: ['/api/communication/recent-notifications', userId],
    queryFn: () => apiRequest(`/api/communication/channels?userId=${userId}&type=notification&limit=5`),
    refetchInterval: 3000,
    select: (data) => data.channels || []
});

  return (
    <Box sx={getPositionStyles()}>
      {/* Speed Dial for Communication Actions */}
      <SpeedDial
        ariaLabel="Communication SpeedDial"
        icon={
          <SpeedDialIcon 
            icon={
              <Badge badgeContent={totalUnread} color="error" max={99}>
                <MessageIcon />
              </Badge>
          }
            openIcon={<CloseIcon />}
          />
      }
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
        direction="up"
        sx={{
          '& .MuiSpeedDial-fab': {
            bgcolor: 'primary.main', '&:hover': {
              bgcolor: 'primary.dark' },
        }}}
      >
        {communicationActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={
              <Badge badgeContent={action.unread} color="error" max={9}>
                <Box sx={{ color: action.color }}>
                  {action.icon}
                </Box>
              </Badge>
          }
            tooltipTitle={
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 50}}>
                  {action.name}
                </Typography>
                {action.count > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {action.count} kanaler
                    {action.unread > 0 && ` • ${action.unread} uleste`}
                  </Typography>
                )}
              </Box>
          }
            tooltipPlacement="left"
            onClick={action.action}
            sx={{
              '& .MuiSpeedDialAction-fab': {
                bgcolor: 'background.paper',
                border:  2,
                borderColor: action.color, '&:hover': { bgcolor: action.color,
                  color: 'white' },
            }}}
          />
        ))}
        
        {/* Open Full Communication Hub */}
        <SpeedDialAction
          icon={<GroupIcon />}
          tooltipTitle="Åpne kommunikasjonshub"
          tooltipPlacement="left"
          onClick={() => {
            setSpeedDialOpen(false);
            if (onOpenFull) onOpenFull();
        }}
          sx={{
            '& .MuiSpeedDialAction-fab': {
              bgcolor: '#ff6f00',
              color: 'white','&:hover': {
                bgcolor: '#f57c00' },
          }}}
        />
      </SpeedDial>

      {/* Floating Notification Preview */}
      {totalUnread > 0 && (
        <Zoom in={!speedDialOpen}>
          <Tooltip 
            title={`${totalUnread} uleste meldinger - Klikk for å se`}
            placement="left"
          >
            <Fab
              size="small"
              onClick={handleNotificationClick}
              sx={{
                position: 'absolute',
                top: -0,
                right:  8,
                bgcolor: '#ff6f00',
                color: 'white',
                width:  40,
                height: 40, '&:hover': { bgcolor: '#f57c00' },
                animation: totalUnread > 5 ? 'pulse 2s infinite' : 'none', '@keyframes pulse': {
                  '0%': {
                    transform: 'scale(1, )' }'50%': {
                    transform: 'scale(1.05, )' }'100%': {
                    transform: 'scale(1, )' },
              }}}
            >
              <Badge badgeContent={totalUnread} color="error" max={99}>
                <NotificationIcon fontSize="small" />
              </Badge>
            </Fab>
          </Tooltip>
        </Zoom>
      )}

      {/* Quick Notification Preview Menu */}
      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left' }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right' }}
        PaperProps={{
          sx: { width: 30, maxWidth: '90vw' }
      }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600}>
            Nylige varslinger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalUnread} uleste meldinger
          </Typography>
        </Box>
        
        {recentNotifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              Ingen nye varslinger
            </Typography>
          </MenuItem>
        ) : (
          recentNotifications.slice(0, 5).map((notification: any, index: number) => (
            <MenuItem 
              key={notification.id || index}
              onClick={() => {
                handleNotificationClose();
                if (onChannelSelect) {
                  onChannelSelect(notification.id'notification');
              }
                if (onOpenFull) onOpenFull();
            }}
            >
              <ListItemIcon>
                <Avatar sx={{ width:  32, height:  32, bgcolor: '#ff9800' }}>
                  <NotificationIcon fontSize="small" />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap>
                    {notification.name || 'Ny varsling'}
                  </Typography>
              }
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {notification.description || 'Kommunikasjonsvarsel'}
                    </Typography>
                    {notification.unreadCount > 0 && (
                      <Chip 
                        label={`${notification.unreadCount} nye`}
                        size="small" 
                        color="error" 
                        variant="outlined"
                        sx={{ ml: 1, height:  16, fontSize: '0.65rem' }}
                      />
                    )}
                  </Box>
              }
              />
            </MenuItem>
          ))
        )}
        
        <Divider />
        <MenuItem 
          onClick={() => {
            handleNotificationClose();
            if (onOpenFull) onOpenFull();
        }}
          sx={{ justifyContent: 'center' }}
        >
          <Typography variant="button" color="primary">
            Se alle kommunikasjoner
          </Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}