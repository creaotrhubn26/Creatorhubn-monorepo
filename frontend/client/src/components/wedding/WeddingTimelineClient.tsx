import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Divider,
  Skeleton
} from '@mui/material';
import {
  Event,
  Schedule,
  People,
  LocationOn,
  Camera,
  Edit,
  Save,
  Cancel,
  Mic,
  RecordVoiceOver,
  CalendarToday,
  Pending,
  CheckCircle,
  Cancel as CancelIcon,
  HelpOutline,
  Notifications,
  NotificationsActive
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import WeddingTimelineHelp from './WeddingTimelineHelp';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface WeddingTimelineClientProps {
  timelineId: string;
  clientAccessCode?: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  time: string;
  duration: number;
  description?: string;
  location?: string;
  participants?: string[];
  equipment?: string[];
  notes?: string;
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled';
  hasSpeech: boolean;
  speechDetails?: string;
  canClientEdit: boolean; // Ny egenskap for å kontrollere klient-redigering
  clientNotes?: string; // Klientens egne notater
  createdAt: string;
  updatedAt: string;
}

interface WeddingTimeline {
  id: string;
  weddingDate: string;
  venue: string;
  coupleName: string;
  events: TimelineEvent[];
  clientAccessEnabled: boolean;
  photographerName: string;
  photographerMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export default function WeddingTimelineClient({ timelineId, clientAccessCode }: WeddingTimelineClientProps) {
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState<Partial<TimelineEvent>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer,');
  
  // Push notifications - use timelineId as context
  const { pushEnabled, isSupported, subscribe } = usePushNotifications(undefined, timelineId);

  // Fetch timeline data
  const { data: timeline, isLoading } = useQuery<WeddingTimeline>({
    queryKey: ['/api/wedding/timeline/client', timelineId, clientAccessCode],
    queryFn: () =>
      apiRequest(`/api/wedding/timeline/client/${timelineId}/${clientAccessCode}`),
    enabled: Boolean(timelineId && clientAccessCode),
    retry: 1
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (eventData: { eventId: string; updates: Partial<TimelineEvent> }) => {
      return apiRequest(`/api/wedding/timeline/client/${timelineId}/events/${eventData.eventId}`, {
        headers: {
          'Content-Type' : 'application/json'
        },
        method: 'PUT',
        body: JSON.stringify({
          ...eventData.updates,
          clientAccessCode
      })
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding/timeline/client,', timelineId, clientAccessCode] });
      setEditingEvent(null);
      setEventForm({});
  }
});

  const handleEditEvent = (event: TimelineEvent) => {
    setEditingEvent(event.id);
    setEventForm({
      description: event.description,
      location: event.location,
      participants: event.participants,
      hasSpeech: event.hasSpeech,
      speechDetails: event.speechDetails,
      clientNotes: event.clientNotes
});
};

  const handleSaveEvent = () => {
    if (editingEvent) {
      updateEventMutation.mutate({
        eventId: editingEvent,
        updates: eventForm
  });
  }
};

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEventForm({});
};

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="rectangular" width="100%" height={100} sx={{ mb: 2, borderRadius: 2 }} />
          <Skeleton variant="text" width="60%" sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" />
        </Box>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <Skeleton variant="rectangular" width="100%" height={150} sx={{ borderRadius: 2 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (!timeline) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error">
          Kunne ikke finne bryllupstidslinjen. Kontroller tilgangskoden.
        </Alert>
      </Box>
    );
}

  if (!timeline.clientAccessEnabled) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning">
          Tilgang til tidslinjen er ikke aktivert av fotografen enda.
        </Alert>
      </Box>
    );
}

  return (
    <Box sx={{ p: 3, maxWidth: '1000px', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
          <Event sx={{ fontSize: '2.5rem', color: theming.colors.primary }} />
          <Typography
            variant="h3"
            sx={{
              color: theming.colors.primary,
              fontWeight: 70
            }}>
            Bryllupstidslinje
          </Typography>
          <Tooltip title="Hjelp og veiledning">
            <IconButton onClick={() => setHelpOpen(true)} sx={{ color: theming.colors.primary }}>
              <HelpOutline />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 600, mb: 1 }}>
          {timeline.coupleName}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarToday sx={{ color: theming.colors.primary }} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {timeline.weddingDate}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LocationOn sx={{ color: 'text.secondary' }} />
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {timeline.venue}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Fotograf: {timeline.photographerName}
        </Typography>

        {timeline.photographerMessage && (
          <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
            <Typography variant="body2">
              <strong>Melding fra fotografen: </strong> {timeline.photographerMessage}
            </Typography>
          </Alert>
        )}
      </Box>

      {/* Instructions */}
      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isSupported && (
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => setPushSettingsOpen(true)} 
                startIcon={pushEnabled ? <NotificationsActive /> : <Notifications />}
              >
                Push-varsler
              </Button>
            )}
            <Button color="inherit" size="small" onClick={() => setHelpOpen(true)} startIcon={<HelpOutline />}>
              Hjelp
            </Button>
          </Box>
        }
      >
        <Typography variant="body2">
          <strong>Instruksjoner: </strong> Du kan fylle ut detaljer for hver hendelse i tidslinjen. 
          Klikk på "Rediger" for å legge til informasjon som lokasjon, deltakere, og spesielle ønsker.
        </Typography>
      </Alert>

      {/* Help Modal */}
      <WeddingTimelineHelp open={helpOpen} onClose={() => setHelpOpen(false)} mode="client" />

      {/* Push Notification Settings Dialog */}
      <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Push-varsler innstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <PushNotificationSettings userId={undefined} contextId={timelineId} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Timeline Stats */}
      <Box sx={{ mb: 3, p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ color: '#f57c00', fontWeight: 600 }}>
            {timeline.events?.length || 0} hendelser totalt
          </Typography>
          <Typography variant="body2" sx={{
            color: '#9c27b0',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5 }}>
            <Mic sx={{ fontSize: '16px' }} />
            {timeline.events?.filter(event => event.hasSpeech).length || 0} taler/presentasjoner
          </Typography>
          <Typography variant="body2" sx={{ color: '#2e7d30', fontWeight: 600 }}>
            {timeline.events?.filter(event => event.status === 'confirmed').length || 0} bekreftet
          </Typography>
        </Box>
      </Box>

      {/* Timeline */}
      <Box sx={{ position: 'relative', pl:  4 }}>
        {/* Vertical Timeline Line */}
        <Box sx={{
          position: 'absolute',
          left: '15px',
          top: '20px',
          bottom: '20px',
          width: '4px',
          background: 'linear-gradient(to bottom, #f57c00, #ff9800, #ffc107)',
          borderRadius: '2px',
          boxShadow: '0 2px 8px rgba(245, 124, 0, 0.3)'
      }} />

        <style>
          {`
            @keyframes pulse {
              0% {
                transform: scale(1);
                box-shadow: 0 2px 8px rgba(16, 39, 176, 0.4);
            }
              50% {
                transform: scale(1.1);
                box-shadow: 0 4px 16px rgba(16, 39, 176, 0.6);
            }
              100% {
                transform: scale(1);
                box-shadow: 0 2px 8px rgba(16, 39, 176, 0.4);
            }
          }
          `}
        </style>

        {timeline.events
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((event, index) => (
          <Box key={event.id} sx={{ position: 'relative', mb:  3 }}>
            {/* Timeline Node */}
            <Box sx={{
              position: 'absolute',
              left: '-25px',
              top: '20px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              bgcolor: event.status === 'completed' ? '#4caf50' : 
                       event.status === 'confirmed' ? '#f57c00' : 
                       event.status === 'cancelled' ? '#f44336' : '#2196f0',
              border: '4px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
        }}>
              {event.status === 'completed' && (
                <Box sx={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✓</Box>
              )}
              {event.status === 'cancelled' && (
                <Box sx={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✕</Box>
              )}
            </Box>

            {/* Speech Indicator */}
            {event.hasSpeech && (
              <Box sx={{
                position: 'absolute',
                left: '-55px',
                top: '15px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                bgcolor: '#9c27b0',
                border: '3px solid white',
                boxShadow: '0 2px 8px rgba(16, 39, 176, 0.4)',
                zIndex: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 2s infinite'
          }}>
                <RecordVoiceOver sx={{ fontSize: '16px', color: 'white' }} />
              </Box>
            )}

            {/* Timeline Card */}
            <Card
              sx={{
                ...theming.getThemedCardSx(),
                ml: 2,
                border: editingEvent === event.id ? '2px solid #2196f3' : '2px solid #ffcc80',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: editingEvent === event.id ? '0 4px 20px rgba(3, 150, 243, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                position: 'relative', '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: '24px',
                  left: '-10px',
                  width: 0,
                  height: 0,
                  borderStyle: 'solid',
                  borderWidth: '8px 10px 8px 0',
                  borderColor: editingEvent === event.id ? 'transparent #2196f3 transparent transparent' : 'transparent #ffcc80 transparent transparent'
                }
              }}
            >
              {/* Time Badge */}
              <Box sx={{
                position: 'absolute',
                top:  0,
                right:  0,
                bgcolor: '#f57c00',
                color: 'white',
                px:  2,
                py: 0.5,
                borderBottomLeftRadius: '8px',
                fontWeight: 600,
                fontSize: '0.875rem'
          }}>
                {event.time}
              </Box>

              <CardContent sx={{ pt: 3, ...theming.getThemedCardSx() }}>
                {/* Status Badges */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  {/* Event Status Badge */}
                  <Chip
                    icon={event.status === 'completed' ? <CheckCircle /> : 
                          event.status === 'cancelled' ? <CancelIcon /> : 
                          <Schedule />}
                    label={event.status === 'planned' ? 'PLANLAGT' :
                           event.status === 'confirmed' ? 'BEKREFTET' :
                           event.status === 'completed' ? 'FULLFØRT' : 'AVLYST'}
                    size="small"
                    sx={{
                      bgcolor: event.status === 'completed' ? '#c8e6c9' : 
                               event.status === 'confirmed' ? '#fff3e0' : 
                               event.status === 'cancelled' ? '#ffcdd2' : '#e1f5fe',
                      color: event.status === 'completed' ? '#2e7d32' : 
                             event.status === 'confirmed' ? '#f57c00' : 
                             event.status === 'cancelled' ? '#d32f2f' : '#0277bd',
                      fontSize: '0.75rem',
                      fontWeight: 60
                    }}
                  />
                  
                  {/* Change Request Status Badge */}
                  {event.clientNotes && (
                    <Chip
                      icon={<Pending />}
                      label="VENTER PÅ GODKJENNING"
                      size="small"
                      sx={{
                        bgcolor: '#e3f2fd',
                        color: '#1976d2',
                        fontSize: '0.75rem',
                        fontWeight: 60
                      }}
                    />
                  )}
                </Box>

                {editingEvent === event.id && event.canClientEdit ? (
                  // Edit Mode
                  <Box>
                    <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 70, mb: 2 }}>
                      {event.title} - REDIGER
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                      <TextField
                        fullWidth
                        label="Beskrivelse / Ønsker"
                        multiline
                        rows={2}
                        value={eventForm.description || ''}
                        onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                        variant="outlined"
                        size="small"
                      />
                      
                      <TextField
                        fullWidth
                        label="Lokasjon / Sted"
                        value={eventForm.location || ''}
                        onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                        variant="outlined"
                        size="small"
                      />
                      
                      <TextField
                        fullWidth
                        label="Deltakere (kommaseparert)"
                        value={eventForm.participants?.join('') || ', '}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            participants: e.target.value.split(', ').map((p) => p.trim()).filter(Boolean)
                          })
                        }
                        variant="outlined"
                        size="small"
                        helperText="F.eks: Brudgom, Brud, Forlover, Familie"
                      />

                      {/* Speech Configuration */}
                      <Box sx={{ p: 2, border: '1px solid #9c27b0', borderRadius: 1, bgcolor: '#f3e5f5' }}>
                        <Typography variant="subtitle2" sx={{ color: '#9c27b0', mb: 1, fontWeight: 600 }}>
                          Tale / Presentasjon
                        </Typography>
                        
                        <FormControl fullWidth size="small" sx={{ mb:  1 }}>
                          <InputLabel>Inneholder tale?</InputLabel>
                          <Select
                            value={eventForm.hasSpeech ? 'yes' : 'no'}
                            label="Inneholder tale?"
                            onChange={(e) => setEventForm({...eventForm, hasSpeech: e.target.value === 'yes'})}
                          >
                            <MenuItem value="no">Nei - ingen tale</MenuItem>
                            <MenuItem value="yes">Ja - inneholder tale</MenuItem>
                          </Select>
                        </FormControl>
                        
                        {eventForm.hasSpeech && (
                          <TextField
                            fullWidth
                            label="Tale detaljer"
                            value={eventForm.speechDetails || ', '}
                            onChange={(e) => setEventForm({...eventForm, speechDetails: e.target.value})}
                            variant="outlined"
                            size="small"
                            placeholder="Hvem holder tale og hva skal sies?"
                          />
                        )}
                      </Box>
                      
                      <TextField
                        fullWidth
                        label="Dine notater til fotografen"
                        multiline
                        rows={2}
                        value={eventForm.clientNotes || ', '}
                        onChange={(e) => setEventForm({...eventForm, clientNotes: e.target.value})}
                        variant="outlined"
                        size="small"
                        placeholder="Spesielle ønsker eller viktig informasjon..."
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                      <Button variant="contained"
                        startIcon={theming.getThemedIcon('save')}
                        onClick={handleSaveEvent}
                        disabled={updateEventMutation.isPending}
                        sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
                      >
                        Lagre
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={theming.getThemedIcon('cancel')}
                        onClick={handleCancelEdit}
                      >
                        Avbryt
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  // View Mode
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary, fontWeight: 700}}>
                        {event.title}
                      </Typography>
                      {event.canClientEdit && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={theming.getThemedIcon('edit')}
                          onClick={() => handleEditEvent(event)}
                          sx={{ ml:  2 }}
                        >
                          Rediger
                        </Button>
                      )}
                    </Box>
                    
                    <Typography variant="body1" sx={{ 
                      fontWeight: 600,
                      color: '#f57c00', 
                      mb:  2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1 }}>
                      <Schedule sx={{ fontSize: '18px' }} />
                      {event.duration} minutter
                    </Typography>

                    {event.location && (
                      <Typography variant="body2" sx={{
                        color: 'text.secondary',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1 }}>
                        <LocationOn sx={{ fontSize: '16px', color: '#f57c00' }} />
                        {event.location}
                      </Typography>
                    )}
                    
                    {event.description && (
                      <Typography variant="body2" sx={{ 
                        color: 'text.primary', 
                        mb:  2,
                        fontStyle: 'italic',
                        pl:  2,
                        borderLeft: '3px solid #ffcc80'
                  }}>
                        {event.description}
                      </Typography>
                    )}
                    
                    {event.participants && event.participants.length > 0 && (
                      <Typography variant="body2" sx={{
                        color: 'text.secondary',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1 }}>
                        <People sx={{ fontSize: '16px', color: '#f57c00' }} />
                        {event.participants.join(', ')}
                      </Typography>
                    )}

                    {/* Speech Details */}
                    {event.hasSpeech && (
                      <Box sx={{ 
                        mt:  2,
                        p:  2,
                        bgcolor: '#f3e5f0',
                        borderRadius: '8px',
                        border: '2px solid #9c27b0'
                  }}>
                        <Typography variant="subtitle2" sx={{ 
                          color: '#9c27b0',
                          fontWeight: 7,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 1 }}>
                          <Mic sx={{ fontSize: '18px' }} />
                          TALE / PRESENTASJON
                        </Typography>
                        {event.speechDetails && (
                          <Typography variant="body2" sx={{ color: '#7b1fa2' }}>
                            {event.speechDetails}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Client Notes */}
                    {event.clientNotes && (
                      <Box sx={{ 
                        mt:  2,
                        p:  2,
                        bgcolor: '#e3f2fd',
                        borderRadius: '8px',
                        border: '1px solid #2196f3'
                  }}>
                        <Typography variant="subtitle2" sx={{ 
                          color: '#1976d0',
                          fontWeight: 60
                         , mb: 1 }}>
                          Dine notater: </Typography>
                        <Typography variant="body2" sx={{ color: '#1565c0' }}>
                          {event.clientNotes}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {timeline.events.length === 0 && (
        <Box sx={{ textAlign: 'center', py:  4 }}>
          <Event sx={{ fontSize:  64, color: '#ffcc80', mb:  2 }} />
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
            Ingen hendelser lagt til enda
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Fotografen jobber med å fylle ut tidslinjen
          </Typography>
        </Box>
      )}
    </Box>
  );
}
