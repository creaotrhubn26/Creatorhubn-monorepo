/**
 * Community Notification Feed
 * Displays notifications for mentions, replies, moderation actions, and badge awards
 * Based on EnhancedActivityFeed but tailored for community events
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Badge,
  Tooltip,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Notifications,
  Reply,
  AlternateEmail,
  Gavel,
  EmojiEvents,
  CheckCircle,
  Warning,
  Block,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';

interface CommunityNotification {
  id: string;
  user_id: string;
  type: 'mention' | 'reply' | 'moderation' | 'badge_award' | 'pattern_promotion';
  title: string;
  message: string;
  metadata?: {
    message_id?: string;
    channel_id?: string;
    badge_name?: string;
    action_type?: string;
    severity?: string;
  };
  is_read: boolean;
  created_at: string;
}

interface CommunityNotificationFeedProps {
  userId: string;
  maxHeight?: number;
}

export default function CommunityNotificationFeed({ userId, maxHeight = 400 }: CommunityNotificationFeedProps) {
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = React.useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchNotifications();

    // Connect to WebSocket for real-time notifications
    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/events`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🔔 Notification WebSocket connected');
      // Authenticate and subscribe to notification events
      ws.send(JSON.stringify({
        type: 'auth',
        userId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'community_notification') {
          // Add new notification to the list
          setNotifications(prev => [data.notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Notification WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('🔔 Notification WebSocket disconnected');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const response = await apiRequest(`/api/community/notifications/${userId}`, {
        method: 'GET',
      }) as { success: boolean; notifications: CommunityNotification[] };

      if (response.success) {
        setNotifications(response.notifications);
        setUnreadCount(response.notifications.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await apiRequest(`/api/community/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiRequest(`/api/community/notifications/${userId}/read-all`, {
        method: 'PUT',
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AlternateEmail color="primary" />;
      case 'reply': return <Reply color="info" />;
      case 'moderation': return <Gavel color="error" />;
      case 'badge_award': return <EmojiEvents color="warning" />;
      case 'pattern_promotion': return <CheckCircle color="success" />;
      default: return <Notifications />;
    }
  };

  const getModerationIcon = (actionType?: string) => {
    switch (actionType) {
      case 'warning': return <Warning color="warning" />;
      case 'temp_ban': return <Block color="error" />;
      case 'permanent_ban': return <Block color="error" />;
      default: return <Gavel color="error" />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Badge badgeContent={unreadCount} color="error">
              <Notifications />
            </Badge>
            <Typography variant="h6">Varsler</Typography>
          </Box>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllAsRead}>
              Merk alle som lest
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {notifications.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Notifications sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              Ingen varsler ennå
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Du vil motta varsler for mentions, svar, og viktige oppdateringer
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight, overflow: 'auto' }}>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  sx={{
                    bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                    borderRadius: 1,
                    mb: 1}}
                  secondaryAction={
                    !notification.is_read && (
                      <Tooltip title="Merk som lest">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <CheckCircle fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: notification.is_read ? 'action.disabled' : 'primary.main' }}>
                      {notification.type === 'moderation'
                        ? getModerationIcon(notification.metadata?.action_type)
                        : getNotificationIcon(notification.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" fontWeight={notification.is_read ? 400 : 600}>
                          {notification.title}
                        </Typography>
                        {notification.type === 'badge_award' && (
                          <Chip
                            label="Nytt Merke!"
                            size="small"
                            color="warning"
                            sx={{ height: 20 }}
                          />
                        )}
                        {notification.type === 'moderation' && (
                          <Chip
                            label={notification.metadata?.severity ||'Viktig'}
                            size="small"
                            color="error"
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: nb,
                          })}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                {index < notifications.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}


