import { useTheming } from '../../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Fab,
  Badge,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  useTheme,
  useMediaQuery,
  Zoom
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  CloudUpload as DriveIcon,
  AddCircle as AddIcon,
  Notes as NotesIcon,
  Notifications as NotificationsIcon,
  Chat as ChatIcon
} from '@mui/icons-material';
import NotificationCenter from '../../notifications/NotificationCenter';
import DemoModeToggle from '@/components/DemoModeToggle';
import FullscreenChatWidget from '../../chat/FullscreenChatWidget';

interface CornerButtonsProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId: string;
  onNewProject?: () => void;
  onMeetingNotes?: () => void;
  onSettings?: () => void;
  onAnalytics?: () => void;
  onDrive?: () => void
}

export default function CornerButtons({ 
  profession, 
  userId, 
  onNewProject,
  onMeetingNotes,
  onSettings,
  onAnalytics,
  onDrive 
}: CornerButtonsProps) {
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [fullscreenChatOpen, setFullscreenChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Get unread notification count
  const { data: notifications = [], error } = useQuery({
    queryKey: ['/api/notifications/active'],
    queryFn: () => apiRequest('/api/notifications/active'),
    refetchInterval: 3000,
    retry: false,
    onError: (error) => {
      console.warn('Notifications query failed:', error);
    }
  });

  React.useEffect(() => {
    try {
      // Ensure notifications is an array before filtering
      if (!notifications || !Array.isArray(notifications)) {
        setUnreadCount(0);
        return;
    }
      
      // Filter out test/mock notifications
      const realNotifications = notifications.filter((n: any) => 
        n && 
        typeof n === 'object' &&
        !n.title?.includes('Test') && 
        !n.message?.includes('System test') &&
        !n.message?.includes('test varsel') &&
        !n.message?.includes('alle tabeller og funksjonalitet fungerer')
      );
      setUnreadCount(realNotifications.length);
} catch (error) {
      console.warn('Error processing notifications: ', error);
      setUnreadCount(0);
  }
}, [notifications]);

  const getProfessionColor = () => {
    switch (profession) {
      case 'photographer': return '#FFC107'; // Amber
      case 'videographer': return '#2196F3'; // Blue
      case 'music_producer': return '#9C27B0'; // Purple
      case 'vendor': return '#4CAF50'; // Green
      default: return theme.palette.primary.main;
}
};

  const actions = [
    {
      icon: (
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      ),
      name: 'Varsler',
      onClick: () => setNotificationCenterOpen(true),
      show: true // Always show notifications button for testing
},
    {
      icon: <SettingsIcon />,
      name: 'Innstillinger',
      onClick: onSettings
},
    {
      icon: <AnalyticsIcon />,
      name: 'Analyse',
      onClick: onAnalytics
},
    {
      icon: <DriveIcon />,
      name: 'Google Drive',
      onClick: onDrive
},
    {
      icon: <AddIcon />,
      name: 'Nytt prosjekt',
      onClick: onNewProject || (() => {
        // Default: trigger new project creation
        const projectTab = document.querySelector('[aria-label*="Prosjekter"]');
        if (projectTab) {
          (projectTab as HTMLElement).click();
          // Wait a bit then look for add project button
          setTimeout(() => {
            const addButton = document.querySelector('[aria-label*="Nytt prosjekt"][title*="Nytt prosjekt"]');
            if (addButton) {
              (addButton as HTMLElement).click();
          }
        }, 500);
      }
    })
  },
    {
      icon: <NotesIcon />,
      name: 'Møtenotater',
      onClick: onMeetingNotes || (() => {
        // Default: look for meeting notes functionality
        const meetingButton = document.querySelector('[aria-label*="Møtenotater"][title*="Møtenotater"]');
        if (meetingButton) {
          (meetingButton as HTMLElement).click();
      } else {
          // Fallback: alert user
          alert('Møtenotater funksjon er ikke tilgjengelig på denne siden');
    }
    })
  },
    {
      icon: <DemoModeToggle compact  />,
      name: 'Demo-modus',
      onClick: () => {}, // Handled by DemoModeToggle component
      show: true
}
  ].filter(action => action.show !== false);

  return (
    <>
      {/* Bottom Right - SpeedDial (positioned per replit.md specs) */}
      <SpeedDial
        ariaLabel="Hurtighandlinger"
        sx={{ 
          position: 'fixed', 
          bottom:  20, 
          right:  20, // Per replit.md: SpeedDial at, right: 20
          '& .MuiFab-primary': {
            width: 70, // Per replit.md: 70x70px dimensions
            height: 70,
            backgroundColor: getProfessionColor(),
            '&:hover': {
              backgroundColor: getProfessionColor(),
              filter: 'brightness(0.9)'
            }
          }
      }}
        icon={<AddIcon sx={{ fontSize: 28}} />}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
            sx={{
              '& .MuiFab-primary': {
                backgroundColor: 'rgba(25, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)','&:hover': {
                  backgroundColor: 'rgba(25, 255, 255, 0.2)'
              }
            }
          }}
          />
        ))}
      </SpeedDial>

      {/* Chat Button positioned per replit.md specs (bottom:  20, right: 10, 70x70px) */}
      {/* Hide chat button when fullscreen chat is open to avoid UI overlap */}
      {!fullscreenChatOpen && (
        <Tooltip title="Chat">
          <Fab
            onClick={() => setFullscreenChatOpen(true)}
            sx={{ 
              position: 'fixed', 
              bottom:  20, 
              right: 10, // Per replit.md: chat button at, right: 100, width: 70, // Per replit.md: 70x70px dimensions
              width: 70,
              height: 70,
              bgcolor: getProfessionColor(),
              color: 'white',
              '&:hover': {
                bgcolor: getProfessionColor(),
                filter: 'brightness(0.9)'
            },
              boxShadow: theme.shadows[6],
              zIndex: theme.zIndex.speedDial
        }}
          >
            <Badge badgeContent={unreadCount > 0 ? unreadCount : 0} color="error">
              <ChatIcon />
            </Badge>
          </Fab>
        </Tooltip>
      )}

      {/* Notification Center */}
      <NotificationCenter
        open={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        profession={profession}
        userId={userId}
      />

      {/* Fullscreen Chat Widget */}
      <FullscreenChatWidget
        open={fullscreenChatOpen}
        onClose={() => setFullscreenChatOpen(false)}
        profession={profession}
        userId={userId}
      />
    </>
  );
}
