/**
 * Wedding Day Mobile Timeline
 * Mobile-optimized vertical timeline for wedding day execution
 * 
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  Fab,
  Collapse,
  Avatar,
  Divider,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import {
  Schedule,
  LocationOn,
  People,
  CheckCircle,
  RadioButtonUnchecked,
  AccessTime,
  Warning,
  Camera,
  ExpandMore,
  ExpandLess,
  Restaurant,
  Favorite,
  MusicNote,
  CalendarToday,
  Phone,
  Directions,
  Share,
  Notifications,
  NotificationsActive,
  Settings
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface WeddingDayMobileTimelineProps {
  timelineId: string;
  userId: string;
  onEventComplete?: (eventId: string) => void;
  onMarkDelayed?: (eventId: string) => void;
}

interface TimelineEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  participants?: string[];
  status: 'upcoming' | 'current' | 'completed' | 'delayed';
  isDelayed?: boolean;
  currentDelay?: number;
  originalStartTime?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

interface WeddingTimeline {
  id: string;
  coupleName: string;
  venue: string;
  weddingDate: string;
  events: TimelineEvent[];
  photographerContact?: {
    phone?: string;
    email?: string;
  };
}

export default function WeddingDayMobileTimeline({
  timelineId,
  userId,
  onEventComplete,
  onMarkDelayed
}: WeddingDayMobileTimelineProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [currentTime] = useState(new Date());
  const [currentEventIndexState, setCurrentEventIndexState] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { pushEnabled, isSupported, subscribe } = usePushNotifications(userId, timelineId);

  // Fetch timeline with real-time updates
  const { data: timeline, isLoading } = useQuery<WeddingTimeline>({
    queryKey: ['/api/wedding/timeline', timelineId],
    queryFn: () => apiRequest(`/api/wedding/timeline/${timelineId}`),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const events: TimelineEvent[] = timeline?.events || [];

  // Determine current event based on time
  const getCurrentEventIndex = () => {
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    return events.findIndex(event => {
      const [startHour, startMin] = event.startTime.split(': ').map(Number);
      const [endHour, endMin] = event.endTime.split(':').map(Number);
      const eventStart = startHour * 60 + startMin;
      const eventEnd = endHour * 60 + endMin;
      return now >= eventStart && now <= eventEnd;
    });
  };

  const currentEventIndex = getCurrentEventIndex();

  // Calculate time until next event
  const getTimeUntilNext = (startTime: string): string => {
    const [hours, mins] = startTime.split(':').map(Number);
    const eventMinutes = hours * 60 + mins;
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const diff = eventMinutes - nowMinutes;

    if (diff < 0) return 'Passert';
    if (diff === 0) return 'NÅ!';
    if (diff < 60) return `${diff} min`;
    const hours_left = Math.floor(diff / 60);
    const mins_left = diff % 60;
    return `${hours_left}t ${mins_left}m`;
  };

  // Get event icon
  const getEventIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('ceremony') || lower.includes('seremoni')) return <Favorite sx={{ color: '#E91E63' }} />;
    if (lower.includes('photo') || lower.includes('foto')) return <Camera sx={{ color: '#2196F3' }} />;
    if (lower.includes('reception') || lower.includes('middag')) return <Restaurant sx={{ color: '#FF9800' }} />;
    if (lower.includes('dance') || lower.includes('dans')) return <MusicNote sx={{ color: '#9C27B0' }} />;
    return <Schedule sx={{ color: '#757575' }} />;
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Laster tidslinje...</Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        bgcolor: '#F5F5F5',
        pb: 10 // Space for FAB
      }}
    >
      {/* Mobile Header */}
      <Paper 
        elevation={3}
        sx={{ 
          p: 2,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderRadius: 0 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarToday sx={{ color: 'inherit' }} />
            <Typography variant="h5" sx={{ fontWeight: 700}}>
              {timeline?.coupleName || 'Bryllup'}
            </Typography>
          </Box>
          {isSupported && (
            <IconButton
              size="small"
              onClick={() => setPushSettingsOpen(true)}
              color={pushEnabled ? 'primary' : 'default'}
            >
              {pushEnabled ? <NotificationsActive /> : <Notifications />}
            </IconButton>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {timeline?.venue} • {timeline?.weddingDate}
        </Typography>
        
        {/* Current Event Banner */}
        {currentEventIndex >= 0 && (
          <Alert 
            severity="info" 
            icon={<Schedule />}
            sx={{ mt: 2, fontSize: '0.9rem' }}
          >
            <strong>Pågår nå:</strong> {events[currentEventIndex].title}
          </Alert>
        )}
        
        {/* Next Event Preview */}
        {currentEventIndex >= 0 && currentEventIndex < events.length - 1 && (
          <Alert 
            severity="warning" 
            icon={<AccessTime />}
            sx={{ mt: 1, fontSize: '0.85rem' }}
          >
            <strong>Neste:</strong> {events[currentEventIndex + 1].title} om {getTimeUntilNext(events[currentEventIndex + 1].startTime)}
          </Alert>
        )}
      </Paper>

      {/* Vertical Timeline (Mobile-Optimized) */}
      <Box 
        sx={{ p: 2 }}
        onTouchStart={(e) => {
          setTouchStart(e.targetTouches[0].clientX);
        }}
        onTouchMove={(e) => {
          setTouchEnd(e.targetTouches[0].clientX);
        }}
        onTouchEnd={() => {
          if (!touchStart || !touchEnd) return;
          const distance = touchStart - touchEnd;
          const isLeftSwipe = distance > 50;
          const isRightSwipe = distance < -50;
          
          if (isLeftSwipe && currentEventIndexState < events.length - 1) {
            setCurrentEventIndexState(currentEventIndexState + 1);
            // Scroll to next event
            const nextEventElement = document.getElementById(`event-${events[currentEventIndexState + 1].id}`);
            nextEventElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (isRightSwipe && currentEventIndexState > 0) {
            setCurrentEventIndexState(currentEventIndexState - 1);
            // Scroll to previous event
            const prevEventElement = document.getElementById(`event-${events[currentEventIndexState - 1].id}`);
            prevEventElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          setTouchStart(null);
          setTouchEnd(null);
        }}
      >
        {events.map((event, index) => {
          const isExpanded = expandedEvent === event.id;
          const isCurrent = index === currentEventIndex;
          const isPast = index < currentEventIndex;
          const isNext = index === currentEventIndex + 1;
          const timeUntil = getTimeUntilNext(event.startTime);

          return (
            <Box key={event.id} sx={{ position: 'relative', mb: 2 }}>
              {/* Timeline Connector Line */}
              {index < events.length - 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 23,
                    top: 56,
                    width: 2,
                    height: 'calc(100% + 16px)',
                    bgcolor: isPast ? '#4CAF50' : '#E0E0E0',
                    zIndex: 0}}
                />
              )}

              {/* Event Card */}
              <Paper
                id={`event-${event.id}`}
                elevation={isCurrent ? 8 : 2}
                sx={{
                  p: 2,
                  position: 'relative',
                  bgcolor: isCurrent ? '#FFF3E0' : isPast ? '#F1F8E9' : 'white',
                  border: isCurrent ? '3px solid #FF9800' : 'none',
                  animation: isCurrent ? 'pulse 2s infinite' : 'none',
                  touchAction: 'pan-y'
                }}
                onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
              >
                {/* Status Icon */}
                <Avatar
                  sx={{
                    position: 'absolute',
                    left: -8,
                    top: 16,
                    width: 48,
                    height: 48,
                    bgcolor: isPast ? '#4CAF50' : isCurrent ? '#FF9800' : '#E0E0E0',
                    zIndex: 1,
                    border: '4px solid #F5F5F5'
                  }}
                >
                  {isPast ? (
                    <CheckCircle sx={{ color: 'white' }} />
                  ) : isCurrent ? (
                    <Schedule sx={{ color: 'white' }} />
                  ) : (
                    <RadioButtonUnchecked sx={{ color: 'white' }} />
                  )}
                </Avatar>

                {/* Event Header */}
                <Box sx={{ ml: 5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 700,
                          fontSize: isCurrent ? '1.1rem' : '1rem',
                          color: isPast ? 'text.secondary' : 'text.primary',
                          textDecoration: isPast ? 'line-through' : 'none'
                        }}
                      >
                        {event.title}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                        {/* Time */}
                        <Chip 
                          icon={<Schedule />}
                          label={event.isDelayed ? `${event.originalStartTime} → ${event.startTime} (+${event.currentDelay}m)` : event.startTime}
                          size="small"
                          color={event.isDelayed ? 'warning' : 'default'}
                        />
                        
                        {/* Time Until/Since */}
                        {!isPast && (
                          <Chip 
                            label={timeUntil}
                            size="small"
                            color={isCurrent ? 'success' : isNext ? 'warning' : 'default'}
                            sx={{ 
                              fontWeight: sCurrent || isNext ? 700 : 400,
                              animation: isNext && timeUntil.includes('min') && !timeUntil.includes('t') ? 'pulse 2s infinite' : 'none'
                            }}
                          />
                        )}
                        
                        {/* Priority */}
                        {event.priority === 'critical' && (
                          <Chip 
                            label="VIKTIG"
                            size="small"
                            color="error"
                            sx={{ fontWeight: 700}}
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Expand/Collapse Icon */}
                    <IconButton size="small">
                      {isExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>

                  {/* Event Details (Collapsible) */}
                  <Collapse in={isExpanded}>
                    <Divider sx={{ my: 1 }} />
                    
                    {event.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {event.description}
                      </Typography>
                    )}
                    
                    {event.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="caption">{event.location}</Typography>
                      </Box>
                    )}
                    
                    {event.participants && event.participants.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <People fontSize="small" color="action" />
                        <Typography variant="caption">{event.participants.join(', ')}</Typography>
                      </Box>
                    )}

                    {/* Quick Actions */}
                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                      {event.location && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location || '')}`;
                            window.open(mapsUrl, '_blank');
                          }}
                          title="Åpne i Google Maps"
                        >
                          <Directions />
                        </IconButton>
                      )}
                      {timeline?.photographerContact?.phone && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${timeline.photographerContact.phone}`;
                          }}
                          title="Ring fotograf"
                        >
                          <Phone />
                        </IconButton>
                      )}
                      {!isPast && (
                        <>
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkDelayed?.(event.id);
                            }}
                            title="Merk som forsinket"
                          >
                            <AccessTime />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventComplete?.(event.id);
                            }}
                            title="Merk som fullført"
                          >
                            <CheckCircle />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              </Paper>
            </Box>
          );
        })}
      </Box>

      {/* Pulse Animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}
      </style>

      {/* Push Notification Settings Dialog */}
      <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Push-varsler innstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <PushNotificationSettings userId={userId} contextId={timelineId} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

