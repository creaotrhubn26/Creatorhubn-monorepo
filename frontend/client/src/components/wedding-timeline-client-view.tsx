import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useWeddingTimelineWebSocket } from '@/hooks/useWeddingTimelineWebSocket';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon,
  Chip, 
  Alert,
  Avatar,
  Divider,
  Paper,
  IconButton,
  Button,
  Tooltip,
  Skeleton,
  Switch,
  FormControlLabel,
  Snackbar
} from '@mui/material';
import { 
  Schedule, 
  LocationOn,
  Warning,
  Phone,
  Email,
  Refresh,
  Share,
  Favorite,
  GetApp,
  CloudSync,
  CloudDone,
  NotificationsActive
} from '@mui/icons-material';

// Secure client-facing interfaces
interface ClientTimelineEvent {
  id: string;
  time: string;
  activity: string;
  location?: string;
  hasPhoto: boolean;
  hasVideo: boolean;
  status: 'upcoming' | 'current' | 'completed';
  isImportant: boolean
}

interface ClientWeddingData {
  id: string;
  coupleNames: string[];
  weddingDate: string;
  venue: string;
  culturalType: string;
  photographerName: string;
  photographerContact: {
    email?: string;
    phone?: string;
  };
  timeline: ClientTimelineEvent[];
  lastUpdated: string;
  timelineId?: string;
}

interface WeddingTimelineClientViewProps {
  accessToken: string;
  projectId: string
}

export default function WeddingTimelineClientView({ 
  accessToken, 
  projectId 
}: WeddingTimelineClientViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Theming system
  const theming = useTheming('photographer');
  const [_selectedDate, _setSelectedDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [pushNotificationEnabled, setPushNotificationEnabled] = useState(false);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  
  // Countdown timer state
  const [timeUntilWedding, setTimeUntilWedding] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  // Fetch wedding data with secure access token
  const { data: weddingData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/wedding-timeline/client-view', projectId, accessToken],
    queryFn: async () => {
      const response = await fetch(`/api/wedding-timeline/client-view/${projectId}?token=${accessToken}`);
      if (!response.ok) {
        throw new Error('Ikke autorisert eller bryllupet finnes ikke');
      }
      const data = await response.json();
      return data as ClientWeddingData;
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });

  // WebSocket for real-time updates
  const { isConnected, hasNewUpdates, acknowledgeUpdate } = useWeddingTimelineWebSocket(
    weddingData?.timelineId || weddingData?.id,
    !!weddingData
  );

  // Offline PWA capabilities
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration failed, continue without offline support
      });
    }
  }, []);

  // Cache timeline data for offline access
  useEffect(() => {
    if (weddingData && 'caches' in window) {
      caches.open('wedding-timeline-v1').then((cache) => {
        cache.put(
          new Request(`/api/wedding-timeline/client-view/${projectId}`),
          new Response(JSON.stringify(weddingData), {
            headers: { 'Content-Type' : 'application/json' },
          })
        );
      });
    }
  }, [weddingData, projectId]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Calculate countdown to wedding day
  useEffect(() => {
    if (!weddingData?.weddingDate) return;
    
    const calculateCountdown = () => {
      const weddingDate = new Date(weddingData.weddingDate);
      const now = new Date();
      const diff = weddingDate.getTime() - now.getTime();
      
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeUntilWedding({ days, hours, minutes });
      } else {
        setTimeUntilWedding(null);
      }
    };
    
    calculateCountdown();
    const timer = setInterval(calculateCountdown, 60000);
    return () => clearInterval(timer);
  }, [weddingData?.weddingDate]);

  // Export to calendar (iCal format)
  const handleExportToCalendar = () => {
    if (!weddingData) return;
    
    const events = weddingData.timeline.map(event => {
      const [startTime] = event.time.split('-');
      const [hours, minutes] = startTime.split(':');
      const eventDate = new Date(weddingData.weddingDate);
      eventDate.setHours(parseInt(hours), parseInt(minutes), 0);
      const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour default
      
      return [
        'BEGIN:VEVENT',
        `DTSTART:${eventDate.toISOString().replace(/[-:]/g, ', ').split('.')[0]}Z`,
        `DTEND:${endDate.toISOString().replace(/[-:]/g, ', ').split('.')[0]}Z`,
        `SUMMARY:${event.activity}`,
        event.location ? `LOCATION:${event.location}` : '',
        `DESCRIPTION:${event.activity}${event.location ? ` at ${event.location}` : ''}`,
        'END:VEVENT'
      ].filter(Boolean).join('\r\n');
    });
    
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CreatorHub//Wedding Timeline//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR'
    ].join('\r\n');
    
    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${weddingData.coupleNames.join('_')}_wedding_timeline.ics`;
    link.click();
  };

  // Calculate timeline progress
  const calculateProgress = () => {
    if (!weddingData?.timeline?.length) return 0;
    const now = new Date();
    const totalEvents = weddingData.timeline.length;
    const completedEvents = weddingData.timeline.filter(event => {
      const [startTime] = event.time.split('-');
      const eventTime = new Date(`${weddingData.weddingDate} ${startTime}`);
      return now > eventTime;
    }).length;
    return totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
};

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${weddingData?.coupleNames.join(' & ')} Bryllup`,
        text: 'Se vår bryllupstidslinje',
        url: window.location.href
  });
  } else {
      navigator.clipboard.writeText(window.location.href);
      // Could show a toast here but following zero-toast policy
  }
};

  // Push notification setup
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setPushNotificationEnabled(!!subscription);
        });
      });
    }
  }, []);

  const handlePushNotificationToggle = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSnackbar({ open: true, message: 'Push notifications are not supported in your browser', severity: 'warning' });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe
        await subscription.unsubscribe();
        setPushNotificationEnabled(false);
      } else {
        // Subscribe
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.VITE_VAPID_PUBLIC_KEY || ', '),
        });
        // Send subscription to server
        await apiRequest('/api/push/subscribe', {
          method: 'POST',
          body: JSON.stringify({
            subscription: newSubscription,
            timelineId: weddingData?.timelineId || weddingData?.id,
          }),
        });
        setPushNotificationEnabled(true);
      }
    } catch (error) {
      console.error('Push notification error: ', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (isLoading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)'
      }}>
        <Paper sx={{ ...theming.getThemedCardSx(), p: 4, m: 3, borderRadius: 3 }}>
          <Skeleton variant="rectangular" width="100%" height={60} sx={{ mb: 2, borderRadius: 2 }} />
          <Skeleton variant="text" width="60%" sx={{ mb: 2 }} />
          <Skeleton variant="text" width="40%" />
        </Paper>
        <Paper sx={{ ...theming.getThemedCardSx(), p: 4, m: 3, borderRadius: 3 }}>
          <Skeleton variant="rectangular" width="100%" height={200} sx={{ mb: 2, borderRadius: 2 }} />
          <Skeleton variant="text" width="80%" sx={{ mb: 1 }} />
          <Skeleton variant="text" width="60%" />
        </Paper>
        <Paper sx={{ ...theming.getThemedCardSx(), p: 4, m: 3, borderRadius: 3 }}>
          <Skeleton variant="rectangular" width="100%" height={150} sx={{ borderRadius: 2 }} />
        </Paper>
      </Box>
    );
  }

  if (error || !weddingData) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
        p: 2 }}>
        <Paper sx={{ ...theming.getThemedCardSx(), p: 4, textAlign: 'center', borderRadius: 3, maxWidth: 400 }}>
          <Warning sx={{ fontSize:  48, color: 'warning.main', mb:  2 }} />
          <Typography variant="h6" sx={{  mb:  2  }}>
            Kunne ikke laste bryllupstidslinjen
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
            Kontroller at linken er korrekt eller kontakt fotografen din.
          </Typography>
          <Button variant="contained" onClick={handleRefresh} sx={theming.getThemedButtonSx()}>
            Prøv igjen
          </Button>
        </Paper>
      </Box>
    );
}

  // Determine current event
  const now = currentTime;
  const currentEvent = weddingData.timeline.find(event => {
    const [startTime] = event.time.split('-');
    const eventTime = new Date(`${weddingData.weddingDate} ${startTime}`);
    const eventEndTime = new Date(eventTime.getTime() + 60 * 60 * 1000); // 1 hour duration
    return now >= eventTime && now <= eventEndTime;
});

  const nextEvent = weddingData.timeline.find(event => {
    const [startTime] = event.time.split('-');
    const eventTime = new Date(`${weddingData.weddingDate} ${startTime}`);
    return now < eventTime;
});

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
      pb: 4 }}>
      {/* Header */}
      <Paper sx={{
        ...theming.getThemedCardSx(),
        p: 3,
        mb: 2,
        textAlign: 'center',
        borderRadius: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
        backdropFilter: 'blur(10px)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <Favorite sx={{ color: theming.colors.primary, fontSize: '2rem' }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            {weddingData.coupleNames.join(' & ')}
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
          {weddingData.venue}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Chip 
            label={weddingData.culturalType}
            sx={{ bgcolor: '#e91e60', color: 'white' }}
          />
          <Chip
            icon={<Schedule />}
            label={`${weddingData.timeline.length} aktiviteter`}
            color="primary"
          />
        </Box>
        
        {/* Countdown Timer */}
        {timeUntilWedding && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 255, 255, 0.8)', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: theming.colors.primary }}>
              Tid til bryllupet:
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {timeUntilWedding.days}
                </Typography>
                <Typography variant="caption">dager</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {timeUntilWedding.hours}
                </Typography>
                <Typography variant="caption">timer</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                  {timeUntilWedding.minutes}
                </Typography>
                <Typography variant="caption">minutter</Typography>
              </Box>
            </Box>
          </Box>
        )}
        
        {/* Progress Indicator */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5, color: 'text.secondary' }}>
            Tidslinjefremdrift: {Math.round(calculateProgress())}%
          </Typography>
          <Box sx={{ width: '100%', height: 8, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <Box
              sx={{
                width: `${calculateProgress()}%`,
                height: '100%',
                bgcolor: theming.colors.primary,
                transition: 'width 0.3s ease'
              }}
            />
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {/* New updates banner */}
          {hasNewUpdates && (
            <Alert 
              severity="info" 
              sx={{ cursor: 'pointer' }}
              onClick={() => {
                acknowledgeUpdate();
                handleRefresh();
              }}
              action={
                <Button color="inherit" size="small" onClick={(e) => {
                  e.stopPropagation();
                  acknowledgeUpdate();
                  handleRefresh();
                }}>
                  Oppdater
                </Button>
              }
            >
              Nye oppdateringer tilgjengelig - klikk for å oppdatere
            </Alert>
          )}
          {/* Push Notification Toggle */}
          {('serviceWorker' in navigator && 'PushManager' in window) && (
            <FormControlLabel
              control={
                <Switch
                  checked={pushNotificationEnabled}
                  onChange={handlePushNotificationToggle}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <NotificationsActive sx={{ fontSize: '1rem' }} />
                  <Typography variant="body2">Push-varsler for hendelser</Typography>
                </Box>
              }
            />
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, alignItems: 'center' }}>
            {/* Real-time connection indicator */}
            <Tooltip title={isConnected ? 'Koblet til - oppdateringer mottas automatisk' : 'Ikke koblet - oppdateringer kan være utdaterte'}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
                {isConnected ? (
                  <CloudSync sx={{ color: 'success.main', fontSize: '1.2rem' }} />
                ) : (
                  <CloudDone sx={{ color: 'text.disabled', fontSize: '1.2rem' }} />
                )}
              </Box>
            </Tooltip>

            <Tooltip title="Oppdater manuelt">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Del tidslinje">
              <IconButton onClick={handleShare}>
                <Share />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eksporter til kalender">
              <IconButton onClick={handleExportToCalendar}>
                <GetApp />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ maxWidth: 80, mx: 'auto', px:  2 }}>
        {/* Current/Next Event Alert */}
        {currentEvent && (
          <Alert
            severity="success"
            icon={theming.getThemedIcon('checkCircle')}
            sx={{ mb: 2, bgcolor: 'rgba(6, 175, 80, 0.1)' }}
          >
            <strong>Pågår nå:</strong> {currentEvent.activity} ({currentEvent.time})
            {currentEvent.location && ` - ${currentEvent.location}`}
          </Alert>
        )}

        {!currentEvent && nextEvent && (
          <Alert
            severity="info"
            icon={theming.getThemedIcon('schedule')}
            sx={{ mb: 2, bgcolor: 'rgba(3, 150, 243, 0.1)' }}
          >
            <strong>Neste: </strong> {nextEvent.activity} ({nextEvent.time})
            {nextEvent.location && ` - ${nextEvent.location}`}
          </Alert>
        )}

        {/* Timeline */}
        <Card sx={{ ...theming.getThemedCardSx(), mb: 2, borderRadius: 3 }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              {theming.getThemedIcon('schedule')} Bryllupstidslinje
            </Typography>
            <List>
              {weddingData.timeline.map((event, index) => {
                const [startTime] = event.time.split('-');
                const eventTime = new Date(`${weddingData.weddingDate} ${startTime}`);
                const isPast = now > eventTime;
                const isCurrent = event.id === currentEvent?.id;
                const isNext = event.id === nextEvent?.id;

                return (
                  <React.Fragment key={event.id}>
                    <ListItem 
                      sx={{ 
                        bgcolor: isCurrent ? 'rgba(6, 175, 80, 0.1)' : 
                               isNext ? 'rgba(33, 150, 243, 0.1)' : 
                               'transparent',
                        borderRadius:  2,
                        mb: 1 }}
                    >
                      <ListItemIcon>
                        <Avatar sx={{ 
                          width:  32, 
                          height:  32,
                          bgcolor: isPast ? '#4caf50' : isCurrent ? '#ff9800' : '#2196f0',
                          fontSize: '14px'
                    }}>
                          {isPast ? '✓' : index + 1}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {event.time}
                            </Typography>
                            {event.isImportant && <Favorite sx={{ color: '#e91e60', fontSize: 18}} />}
                            {isCurrent && <Chip label="Pågår nå" size="small" color="success" />}
                            {isNext && <Chip label="Neste" size="small" color="info" />}
                          </Box>
                      }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5}}>
                              {event.activity}
                            </Typography>
                            {event.location && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                                <LocationOn sx={{ fontSize:  16, color: 'text.secondary'}} />
                                <Typography variant="caption" color="text.secondary">
                                  {event.location}
                                </Typography>
                              </Box>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              {event.hasPhoto && (
                                <Chip label="📸 Foto" size="small" variant="outlined" />
                              )}
                              {event.hasVideo && (
                                <Chip label="🎥 Video" size="small" variant="outlined" />
                              )}
                            </Box>
                          </Box>
                      }
                      />
                    </ListItem>
                    {index < weddingData.timeline.length - 1 && <Divider />}
                  </React.Fragment>
                );
            })}
            </List>
          </CardContent>
        </Card>

        {/* Showcase Access Card */}
        <Card sx={{
          ...theming.getThemedCardSx(),
          borderRadius: 3,
          mb: 2,
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white'
        }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              {theming.getThemedIcon('photoLibrary')} Dine bilder & videoer
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, opacity: 0.9 }}>
              Se og last ned alle dine bryllupsbilder når de er klare
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{
                ...theming.getThemedButtonSx(),
                bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                color: 'white',
                fontWeight: 60
              }}
              onClick={() => {
                // Navigate to showcase with same access token
                window.location.href = `/showcase/${projectId}?token=${accessToken}`;
              }}
            >
              Åpne showcase
            </Button>
          </CardContent>
        </Card>

        {/* Photographer Contact */}
        <Card sx={{ ...theming.getThemedCardSx(), borderRadius: 3 }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
              {theming.getThemedIcon('person')} Din fotograf
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb:  1 }}>
              {weddingData.photographerName}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
              {weddingData.photographerContact.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <Email sx={{ fontSize:  18, color: 'text.secondary'}} />
                  <Typography variant="body2">
                    {weddingData.photographerContact.email}
                  </Typography>
                </Box>
              )}
              {weddingData.photographerContact.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <Phone sx={{ fontSize:  18, color: 'text.secondary'}} />
                  <Typography variant="body2">
                    {weddingData.photographerContact.phone}
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display:'block'}}>
              Sist oppdatert: {new Date(weddingData.lastUpdated).toLocaleString('')}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}