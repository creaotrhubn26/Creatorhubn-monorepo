import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheming } from '../../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  Tabs,
  Tab,
  Paper,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Schedule,
  Lightbulb,
  Send,
  AccessTime,
  LocationOn,
  People,
  Camera,
  Mic,
  Event,
  Movie,
  Business,
  Portrait,
  Celebration,
  MusicNote,
  AutoFixHigh,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useExternalData } from '@/services/ExternalDataService';

interface EventTimelineEditorProps {
  projectId: string;
  timelineId?: string;
  userId: string;
  projectType: | 'wedding'
    | 'commercial'
    | 'portrait'
    | 'event'
    | 'corporate'
    | 'music_video'
    | 'bryllup';
  culturalType?: string; // Only for weddings
  viewMode?: 'full' | 'compact';
  enableSuggestions?: boolean;
  onEventAdded?: (event: unknown) => void;
  onSuggestionSent?: (suggestion: unknown) => void;
}

interface TimelineEvent {
  id?: string;
  title: string;
  time: string;
  duration: number;
  description?: string;
  location?: string;
  eventType: string;
  priority: 'high' | 'medium' | 'low';
  status: 'planned' | 'confirmed' | 'completed';
  metadata?: any;
}

interface TimelineSuggestion {
  id?: string;
  eventTitle: string;
  suggestedTime: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected';
}

export default function EventTimelineEditor({
  projectId,
  timelineId,
  userId,
  projectType,
  culturalType,
  viewMode = 'full',
  enableSuggestions = true,
  onEventAdded,
  onSuggestionSent,
}: EventTimelineEditorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [autoGenerateLoading, setAutoGenerateLoading] = useState(false);

  const { toast } = useToast();
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');
  const queryClient = useQueryClient();

  // External data for planning intelligence (weather, location)
  const externalData = useExternalData?.();
  const [weatherAtEvent, setWeatherAtEvent] = useState<unknown>(null);

  // New event form state
  const [newEvent, setNewEvent] = useState<TimelineEvent>({
    title: '',
    time: '',
    duration: 60,
    description: '',
    location: '',
    eventType: getDefaultEventType(projectType),
    priority: 'medium',
    status: 'planned' });

  // New suggestion form state
  const [newSuggestion, setNewSuggestion] = useState<TimelineSuggestion>({
    eventTitle: '',
    suggestedTime: '',
    reason: '',
    priority: 'medium',
    status: 'pending' });

  // Fetch timeline events
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: [`/api/event-timeline/${projectId}/events`],
    queryFn: () => apiRequest(`/api/event-timeline/${projectId}/events`),
    enabled: !!projectId,
  });

  // Fetch suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: [`/api/event-timeline/${projectId}/suggestions`],
    queryFn: () => apiRequest(`/api/event-timeline/${projectId}/suggestions`),
    enabled: !!projectId && enableSuggestions,
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (eventData: TimelineEvent) => {
      return apiRequest(`/api/event-timeline/${projectId}/events`, {
        method: 'POST',
        body: { ...eventData, projectType },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      setEventDialogOpen(false);
      resetEventForm();
      toast({
        title: 'Event lagt til, ',
        description: 'Tidslinjen er oppdatert' });
      onEventAdded?.(data);
    },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke legge til event',
        variant: 'destructive' });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...eventData }: TimelineEvent & { id: string }) => {
      return apiRequest(`/api/event-timeline/events/${id}`, {
        method: 'PUT',
        body: eventData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      setEventDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: 'Event oppdatert',
        description: 'Endringene er lagret' });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest(`/api/event-timeline/events/${eventId}`, {
        method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      toast({
        title: 'Event slettet',
        description: 'Event er fjernet fra tidslinjen' });
    },
  });

  // Add suggestion mutation
  const addSuggestionMutation = useMutation({
    mutationFn: async (suggestionData: TimelineSuggestion) => {
      return apiRequest(`/api/event-timeline/${projectId}/suggestions`, {
        method: 'POST',
        body: suggestionData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/suggestions`] });
      setSuggestionDialogOpen(false);
      resetSuggestionForm();
      toast({
        title: 'Forslag sendt',
        description: 'Klienten blir varslet om ditt forslag' });
      onSuggestionSent?.(data);
    },
  });

  // Auto-generate default events
  const handleAutoGenerate = async () => {
    setAutoGenerateLoading(true);
    try {
      const defaultEvents = await apiRequest(`/api/event-timeline/${projectId}/auto-generate`, {
        method: 'POST',
        body: { projectType, culturalType },
      });

      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      toast({
        title: 'Events generert',
        description: `${defaultEvents.count} standardevents er lagt til`,
      });
    } catch (error) {
      toast({
        title: 'Feil',
        description: 'Kunne ikke generere events',
        variant: 'destructive' });
    } finally {
      setAutoGenerateLoading(false);
    }
  };

  const resetEventForm = () => {
    setNewEvent({
      title: '',
      time: '',
      duration: 60,
      description: '',
      location: '',
      eventType: getDefaultEventType(projectType),
      priority: 'medium',
      status: 'planned' });
  };

  const resetSuggestionForm = () => {
    setNewSuggestion({
      eventTitle: '',
      suggestedTime: ', ',
      reason: ', ',
      priority: 'medium',
      status: 'pending' });
  };

  const handleAddEvent = () => {
    if (selectedEvent?.id) {
      updateEventMutation.mutate({ ...newEvent, id: selectedEvent.id });
    } else {
      addEventMutation.mutate(newEvent);
    }
  };

  const handleEditEvent = (event: unknown) => {
    setSelectedEvent(event);
    setNewEvent(event);
    setEventDialogOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Er du sikker på at du vil slette dette eventet?')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const handleSendSuggestion = () => {
    addSuggestionMutation.mutate(newSuggestion);
  };

  const getEventIcon = (type: string) => {
    const iconMap: Record<string, JSX.Element> = {
      ceremony: <Event color="error" />,
      reception: <People color="primary" />,
      preparation: <Camera color="info" />,
      photo_session: <Camera color="success" />,
      speech: <Mic color="warning" />,
      meeting: <Business color="primary" />,
      shoot: <Movie color="primary" />,
      setup: <Camera color="info" />,
      performance: <MusicNote color="error" />,
      celebration: <Celebration color="primary" />,
    };
    return iconMap[type] || <Schedule color="action" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getProjectTypeIcon = () => {
    const iconMap: Record<string, JSX.Element> = {
      wedding: <Event />,
      bryllup: <Event />,
      commercial: <Business />,
      portrait: <Portrait />,
      event: <Celebration />,
      music_video: <MusicNote />,
      corporate: <Business />,
    };
    return iconMap[projectType] || <Schedule />;
  };

  const getProjectTypeLabel = () => {
    const labelMap: Record<string, string> = {
      wedding: 'Wedding',
      bryllup: 'Bryllup',
      commercial: 'Commercial',
      portrait: 'Portrait',
      event: 'Event',
      music_video: 'Music Video',
      corporate: 'Corporate' };
    return labelMap[projectType] || 'Event';
  };

  const events = eventsData?.events || [];
  const suggestions = suggestionsData?.suggestions || [];
  const pendingSuggestions = suggestions.filter((s: unknown) => s.status === 'pending');

  return ()
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: theming.colors.primary}}>
          {getProjectTypeIcon()}
          {getProjectTypeLabel()} Timeline
          <Chip label={`${events.length} events`} size="small" color="primary" />
          {pendingSuggestions.length > 0 && ()
            <Badge badgeContent={pendingSuggestions.length} color="warning">
              <Chip label="Forslag" size="small" color="warning" />
            </Badge>
          )}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {events.length === 0 && ()
            <Button
              variant="outlined"
              startIcon={<AutoFixHigh />}
              onClick={handleAutoGenerate}
              disabled={autoGenerateLoading}
              sx={{ borderColor: theming.colors.primary, color: theming.colors.primary }}>
              Auto-generer events
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setSelectedEvent(null);
              resetEventForm();
              setEventDialogOpen(true);
            }}
            sx={{
              bgcolor: theming.colors.primary'&:hover': { opacity: 0.9 }}}
          >
            Legg til Event
          </Button>
          {enableSuggestions && ()
            <Button
              variant="outlined"
              startIcon={<Lightbulb />}
              onClick={() => {
                resetSuggestionForm();
                setSuggestionDialogOpen(true);
              }}
              sx={{ borderColor: theming.colors.primary, color: theming.colors.primary }}>
              Send Forslag
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={`Timeline (${events.length})`} />
          {enableSuggestions && ()
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Forslag
                  {pendingSuggestions.length > 0 && ()
                    <Badge badgeContent={pendingSuggestions.length} color="warning" />
                  )}
                </Box>
              }
            />
          )}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && ()
        <Box>
          {eventsLoading ? ()
            <Typography>Laster events...</Typography>
          ) : events.length === 0 ? ()
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Ingen events enda
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Klikk "Auto-generer events" for standardmal eller "Legg til Event" for å lage egne.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAutoGenerate}
                disabled={autoGenerateLoading}
              >
                {autoGenerateLoading ? 'Genererer...' : 'Auto-generer events'}
              </Button>
            </Alert>
          ) : ()
            <Timeline position="right">
              {events
                .sort((a: any, b: unknown) => a.time.localeCompare(b.time)
                .map((event: any, index: number) => ()
                  <TimelineItem key={event.id}>
                    <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600}}>
                        {event.time}
                      </Typography>
                      <Typography variant="caption">{event.duration} min</Typography>
                    </TimelineOppositeContent>

                    <TimelineSeparator>
                      <TimelineDot
                        color={
                          event.status === 'completed'
                            ? 'success'
                            : event.status === 'confirmed'
                              ? 'primary'
                              : 'grey'
                        }
                      >
                        {getEventIcon(event.eventType)}
                      </TimelineDot>
                      {index < events.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>

                    <TimelineContent>
                      <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 1}}>
                          <Box>
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 600, color: theming.colors.primary }}>
                              {event.title}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={event.eventType.replace('_', ', ')}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              <Chip
                                label={event.status}
                                size="small"
                                color={event.status === 'completed' ? 'success' : 'default'}
                              />
                              <Chip
                                label={event.priority}
                                size="small"
                                color={getPriorityColor(event.priority) as any}
                              />
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Rediger">
                              <IconButton size="small" onClick={() => handleEditEvent(event)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Slett">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteEvent(event.id)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        {event.description && ()
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {event.description}
                          </Typography>
                        )}

                        {event.location && ()
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationOn fontSize="small" color="action" />
                            <Typography variant="caption">{event.location}</Typography>
                          </Box>
                        )}
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
            </Timeline>
          )}
        </Box>
      )}

      {activeTab === 1 && enableSuggestions && ()
        <Box>{/* Suggestions content - same as WeddingTimelineEditor */}</Box>
      )}

      {/* Add/Edit Event Dialog */}
      <Dialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: theming.colors.primary, color: 'white' }}>
          {selectedEvent ? 'Rediger Event' : 'Legg til Event'}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Event tittel *"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="time"
                label="Tidspunkt *"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Event type</InputLabel>
                <Select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}}
                  label="Event type"
                >
                  {getEventTypes(projectType).map((type) => ()
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Varighet (min)"
                value={newEvent.duration}
                onChange={(e) => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) })}}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Prioritet</InputLabel>
                <Select
                  value={newEvent.priority}
                  onChange={(e) => setNewEvent({ ...newEvent, priority: e.target.value as any })}}
                  label="Prioritet"
                >
                  <MenuItem value="high">Høy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Lav</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Lokasjon"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleAddEvent}
            disabled={!newEvent.title || !newEvent.time}
            sx={{ bgcolor: theming.colors.primary }}>
            {selectedEvent ? 'Oppdater' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Suggestion Dialog - similar to WeddingTimelineEditor */}
    </Box>
  );
}

// Helper functions
function getDefaultEventType(projectType: string): string {
  const typeMap: Record<string, string> = {
    wedding: 'ceremony',
    bryllup: 'ceremony',
    commercial: 'shoot',
    portrait: 'photo_session',
    event: 'celebration',
    music_video: 'performance',
    corporate: 'meeting' };
  return typeMap[projectType] || 'other';
}

function getEventTypes(projectType: string) {
  const commonTypes = [
    { value: 'preparation', label: 'Forberedelse' },
    { value: 'setup', label: 'Oppsett' },
    { value: 'meeting', label: 'Møte' },
    { value: 'other', label: 'Annet' },
  ];

  const typeMap: Record<string, any[]> = {
    wedding: [
      { value: 'ceremony', label: 'Seremoni' },
      { value: 'reception', label: 'Mottakelse' },
      { value: 'photo_session', label: 'Fotosesjon' },
      { value: 'speech', label: 'Tale' },
      ...commonTypes,
    ],
    commercial: [
      { value: 'shoot', label: 'Filming' },
      { value: 'photo_session', label: 'Fotosesjon' },
      { value: 'product_shots', label: 'Produktbilder' },
      ...commonTypes,
    ],
    portrait: [
      { value: 'photo_session', label: 'Fotosesjon' },
      { value: 'consultation', label: 'Konsultasjon' },
      { value: 'review', label: 'Gjennomgang' },
      ...commonTypes,
    ],
    music_video: [
      { value: 'performance', label: 'Performance' },
      { value: 'shoot', label: 'Scene' },
      { value: 'b_roll', label: 'B-roll' },
      ...commonTypes,
    ],
  };

  return typeMap[projectType] || commonTypes;
}
