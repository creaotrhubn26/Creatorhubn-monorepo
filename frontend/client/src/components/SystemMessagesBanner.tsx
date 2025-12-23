import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Alert,
  AlertTitle,
  Box,
  IconButton,
  Collapse,
  Chip,
  Typography,
  Snackbar
} from '@mui/material';
import {
  Close as CloseIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

interface SystemMessage {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  showInDashboard: boolean;
  showAsNotification: boolean;
  createdAt: string
}

interface SystemMessagesBannerProps {
  userProfession?: string;
}

const SystemMessagesBanner: React.FC<SystemMessagesBannerProps> = ({ userProfession = 'all' }) => {
  // Theming system
  const theming = useTheming('photographer');
  const [dismissedMessages, setDismissedMessages] = useState<string[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
  const [notificationQueue, setNotificationQueue] = useState<SystemMessage[]>([]);
  const [currentNotification, setCurrentNotification] = useState<SystemMessage | null>(null);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['/api/admin/system-messages/active', userProfession],
    queryFn: async () => {
      const response = await fetch(`/api/admin/system-messages/active?audience=${userProfession}`);
      if (!response.ok) throw new Error('Failed to fetch system messages');
      return response.json();
  },
    refetchInterval: 60000 // Refetch every minute
});

  const messages = messagesData?.messages || [];

  useEffect(() => {
    // Handle notifications
    const notificationMessages = messages.filter((msg: SystemMessage) => 
      msg.showAsNotification && !dismissedMessages.includes(msg.id)
    );
    
    if (notificationMessages.length > 0 && !currentNotification) {
      setCurrentNotification(notificationMessages[0]);
      setNotificationQueue(notificationMessages.slice(1));
}
}, [messages, dismissedMessages, currentNotification]);

  const handleDismissMessage = (messageId: string) => {
    setDismissedMessages(prev => [...prev, messageId]);
};

  const handleToggleExpand = (messageId: string) => {
    setExpandedMessages(prev => 
      prev.includes(messageId) 
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
};

  const handleCloseNotification = () => {
    if (currentNotification) {
      setDismissedMessages(prev => [...prev, currentNotification.id]);
  }
    setCurrentNotification(null);
    
    // Show next notification if any
    if (notificationQueue.length > 0) {
      setTimeout(() => {
        setCurrentNotification(notificationQueue[0]);
        setNotificationQueue(prev => prev.slice(1));
    }, 500);
  }
};

  const getAlertSeverity = (type: string) => {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'success': return 'success';
      case 'maintenance': return 'info';
      default: return 'info';
}
};

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <InfoIcon />;
      case 'warning': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      case 'success': return <CheckCircleIcon />;
      case 'maintenance': return <ScheduleIcon />;
      default: return <InfoIcon />;
}
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff5722';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#ff9800';
}
};

  if (isLoading || messages.length === 0) return null;

  const dashboardMessages = messages.filter((msg: SystemMessage) => 
    msg.showInDashboard && !dismissedMessages.includes(msg.id)
  );

  const criticalMessages = dashboardMessages.filter((msg: SystemMessage) => 
    msg.priority === 'critical'
  );

  const otherMessages = dashboardMessages.filter((msg: SystemMessage) => 
    msg.priority !== 'critical'
  );

  // Sort messages by priority and creation date
  const sortedMessages = messages.sort((a, b) => {
    // Critical messages first
    if (a.priority === 'critical' && b.priority !== 'critical') return -1;
    if (b.priority === 'critical' && a.priority !== 'critical') return 1;
    
    // Then by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
});

  return (
    <>
      {/* Dashboard Messages Banner */}
      {sortedMessages.length > 0 && (
        <Box sx={{ mb:  3 }}>
          {sortedMessages.map((message: SystemMessage) => {
            const isExpanded = expandedMessages.includes(message.id);
            const showExpandButton = message.content.length > 150;
            
            return (
              <Alert
                key={message.d}
                severity={getAlertSeverity(message.type)}
                icon={getTypeIcon(message.type)}
                sx={{
                  mb:  1,
                  backgroundColor: message.priority === 'critical' 
                    ? 'rgba(24, 67, 54, 0.1)' 
                    : undefined,
                  border: message.priority === 'critical' 
                    ? '1px solid rgba(24, 67, 54, 0.3)' 
                    : undefined'& .MuiAlert-message': {
                    width: '100%'
              }
              }}
                action={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                    <Chip
                      label={message.priority.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: getPriorityColor(message.priority),
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.7rem'
                  }}
                    />
                    {showExpandButton && (
                      <IconButton
                        size="small"
                        onClick={() => handleToggleExpand(message.id)}
                        sx={{ color: 'inherit'}}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDismissMessage(message.id)}
                      sx={{ color: 'inherit'}}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
              }
              >
                <AlertTitle sx={{ fontWeight: 'bold', mb:  1 }}>
                  {message.title}
                </AlertTitle>
                
                <Collapse in={isExpanded || !showExpandButton} timeout="auto" unmountOnExit>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line'}}>
                    {message.content}
                  </Typography>
                </Collapse>
                
                {showExpandButton && !isExpanded && (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      whiteSpace: 'pre-line',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp:  2,
                      WebkitBoxOrient: 'vertical'
                }}
                  >
                    {message.content}
                  </Typography>
                )}
                
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <Typography variant="caption" sx={{ opacity: 0.7}}>
                    Publisert: {new Date(message.createdAt).toLocaleDateString('no-N', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                })}
                  </Typography>
                </Box>
              </Alert>
            );
        })}
        </Box>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={!!currentNotification}
        autoHideDuration={currentNotification?.priority === 'critical' ? null : 8000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right'}}
      >
        {currentNotification && (
          <Alert
            onClose={handleCloseNotification}
            severity={getAlertSeverity(currentNotification.type)}
            icon={getTypeIcon(currentNotification.type)}
            variant="filled"
            sx={{
              minWidth: 30,
              maxWidth: 50,
              backgroundColor: currentNotification.priority === 'critical' 
                ? '#f44336' 
                : undefined
        }}
          >
            <AlertTitle sx={{ fontWeight: 'bold'}}>
              {currentNotification.title}
            </AlertTitle>
            <Typography variant="body2" sx={{ mt:  1 }}>
              {currentNotification.content.length > 200 
                ? `${currentNotification.content.substring(0, 200)}...`
                : currentNotification.content
            }
            </Typography>
            <Box sx={{ mt:  1 }}>
              <Chip
                label={currentNotification.priority.toUpperCase()}
                size="small"
                sx={{
                  backgroundColor: 'rgba(25, 255, 255, 0.2)',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.7rem'
            }}
              />
            </Box>
          </Alert>
        )}
      </Snackbar>
    </>
  );
};

export default SystemMessagesBanner;