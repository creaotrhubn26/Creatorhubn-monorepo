/**
 * Activity Feed Component
 * Real-time activity stream in right sidebar
 * Shows client actions, system events, and collaboration updates
 */

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Divider,
  Badge,
  Tooltip,
  Stack,
  Button,
} from '@mui/material';
import {
  Close,
  Notifications,
  CheckCircle,
  Comment,
  CloudDone,
  Sync,
  FileDownload,
  Share,
  Favorite,
  Visibility,
  AutoFixHigh,
  Upload,
  Group,
  Schedule,
  Info,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

interface ActivityEvent {
  id: string;
  type: 'client_action' | 'backup' | 'sync' | 'comment' | 'collaboration' | 'ai_processing' | 'export' | 'upload';
  title: string;
  description: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: {
    itemCount?: number;
    itemName?: string;
    status?: 'success' | 'error' | 'in_progress';
  };
}

interface ActivityFeedProps {
  open: boolean;
  onClose: () => void;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  open,
  onClose,
  profession,
  accentColor
}) => {
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || accentColor || '#FF6B35';
  
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Simulate real-time activity feed
  useEffect(() => {
    if (!open) return;

    // Mock initial activities
    const mockActivities: ActivityEvent[] = [
      {
        id: '1',
        type: 'client_action',
        title: 'Client selected 3 images',
        description: 'Wedding-001.jpg, Wedding-002.jpg, Wedding-003.jpg',
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
        user: {
          name: 'Sarah Johnson',
          avatar: 'SJ'
        },
        metadata: {
          itemCount: 3,
          status: 'success'
        }
      },
      {
        id: '2',
        type: 'backup',
        title: 'Backup completed',
        description: 'All showcase items backed up to Google Drive',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
        metadata: {
          itemCount: 42,
          status: 'success'
        }
      },
      {
        id: '3',
        type: 'comment',
        title: 'New comment on Wedding-001',
        description: ', "Love this shot! Can we get a higher resolution?"',
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        user: {
          name: 'Sarah Johnson',
          avatar: 'SJ'
        }
      },
      {
        id: '4',
        type: 'sync',
        title: 'Google Drive sync completed',
        description: 'Synchronized 12 new items from Google Drive',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        metadata: {
          itemCount: 12,
          status: 'success'
        }
      },
      {
        id: '5',
        type: 'collaboration',
        title: 'John Smith is viewing your showcase',
        description: 'Viewing: Portrait Gallery',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        user: {
          name: 'John Smith',
          avatar: 'JS'
        }
      },
      {
        id: '6',
        type: 'ai_processing',
        title: 'AI enhancement completed',
        description: 'Enhanced 8 images with AI auto-enhance',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        metadata: {
          itemCount: 8,
          status: 'success'
        }
      }
    ];

    setActivities(mockActivities);

    // Simulate new activity every 30 seconds (for demo)
    const interval = setInterval(() => {
      const newActivity: ActivityEvent = {
        id: Date.now().toString(),
        type: 'client_action',
        title: 'New client activity',
        description: 'Client favorited an item',
        timestamp: new Date(),
        user: {
          name: 'Client User',
          avatar: 'CU'
        }
      };
      
      setActivities(prev => [newActivity, ...prev].slice(0, 20)); // Keep last 20
      setUnreadCount(prev => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, [open]);

  // Mark as read when opened
  useEffect(() => {
    if (open && unreadCount > 0) {
      setTimeout(() => setUnreadCount(0), 1000);
    }
  }, [open, unreadCount]);

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'client_action':
        return <CheckCircle sx={{ color: '#4CAF50' }} />;
      case 'backup':
        return <CloudDone sx={{ color: '#2196F3' }} />;
      case 'sync':
        return <Sync sx={{ color: '#FF9800' }} />;
      case 'comment':
        return <Comment sx={{ color: '#9C27B0' }} />;
      case 'collaboration':
        return <Group sx={{ color: '#00BCD4' }} />;
      case 'ai_processing':
        return <AutoFixHigh sx={{ color: accentColor }} />;
      case 'export':
        return <FileDownload sx={{ color: '#607D8B' }} />;
      case 'upload':
        return <Upload sx={{ color: '#795548' }} />;
      default:
        return <Info sx={{ color: '#9E9E9E' }} />;
    }
  };

  const groupActivitiesByDate = (activities: ActivityEvent[]) => {
    const groups: { [key: string]: ActivityEvent[] } = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Earlier': []
    };

    activities.forEach(activity => {
      const hoursAgo = (Date.now() - activity.timestamp.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 24) {
        groups['Today'].push(activity);
      } else if (hoursAgo < 48) {
        groups['Yesterday'].push(activity);
      } else if (hoursAgo < 168) { // 7 days
        groups['This Week'].push(activity);
      } else {
        groups['Earlier'].push(activity);
      }
    });

    return groups;
  };

  const groupedActivities = groupActivitiesByDate(activities);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 380,
          bgcolor: '#0f1419',
          backgroundImage: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)',
          color: 'white'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: `2px solid ${accentColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Badge badgeContent={unreadCount} color="error">
            <Notifications sx={{ color: accentColor, fontSize: 28 }} />
          </Badge>
          <Typography variant="h6" fontWeight="600">
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Activity Feed`
              : 'Activity Feed'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Filter Chips */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
          <Chip label="All" size="small" sx={{ bgcolor: `${accentColor}30`, color: 'white' }} />
          <Chip label="Client" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }} />
          <Chip label="System" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }} />
          <Chip label="Comments" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }} />
        </Stack>
      </Box>

      {/* Activities List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {activities.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Notifications sx={{ fontSize: 64, color: 'rgba(255,255,255,0.3)', mb: 2 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              No recent activity
            </Typography>
          </Box>
        ) : (
          Object.entries(groupedActivities).map(([period, events]) => 
            events.length > 0 && (
              <Box key={period}>
                <Box sx={{ px: 2, py: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.1em'
                  }}>
                    {period}
                  </Typography>
                </Box>
                <List sx={{ py: 0 }}>
                  {events.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      <ListItem 
                        alignItems="flex-start"
                        sx={{
                          py: 2, '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.05)'
                          }
                        }}
                      >
                        <ListItemAvatar>
                          {activity.user ? (
                            <Avatar sx={{ 
                              bgcolor: `${accentColor}40`,
                              color: accentColor,
                              border: `2px solid ${accentColor}`
                            }}>
                              {activity.user.avatar || activity.user.name.charAt(0)}
                            </Avatar>
                          ) : (
                            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                              {getActivityIcon(activity.type)}
                            </Avatar>
                          )}
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                                {activity.title}
                              </Typography>
                              {activity.metadata?.itemCount && (
                                <Chip 
                                  label={activity.metadata.itemCount} 
                                  size="small" 
                                  sx={{ 
                                    height: 18, 
                                    fontSize: '0.65rem',
                                    bgcolor: `${accentColor}20`,
                                    color: accentColor
                                  }} 
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block', mb: 0.5 }}>
                                {activity.description}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Schedule sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                                </Typography>
                                {activity.metadata?.status === 'success' && (
                                  <CheckCircle sx={{ fontSize: 12, color: '#4CAF50', ml: 'auto' }} />
                                )}
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < events.length - 1 && (
                        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            )
          )
        )}
      </Box>

      {/* Footer Actions */}
      <Box sx={{ 
        p: 2, 
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <Button 
          size="small" 
          sx={{ color: 'rgba(255,255,255,0.7)' }}
          onClick={() => setActivities([])}
        >
          Clear All
        </Button>
        <Button 
          size="small" 
          sx={{ color: accentColor }}
          onClick={onClose}
        >
          Close
        </Button>
      </Box>
    </Drawer>
  );
};

export default ActivityFeed;

