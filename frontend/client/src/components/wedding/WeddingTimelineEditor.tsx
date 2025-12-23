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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
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
  CheckCircle,
  Warning,
  Info,
  Comment,
  Save,
  Cancel,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useExternalData } from '@/services/ExternalDataService';

interface WeddingTimelineEditorProps {
  projectId?: string;
  timelineId?: string;
  photographerId: string;
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
  eventType: 'ceremony' | 'reception' | 'preparation' | 'photo_session' | 'speech' | 'other';
  priority: 'high' | 'medium' | 'low';
  status: 'planned' | 'confirmed' | 'completed';
  hasSpeech?: boolean;
  speechDetails?: string;
}

interface TimelineSuggestion {
  id?: string;
  eventTitle: string;
  suggestedTime: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected';
}

export default function WeddingTimelineEditor({
  projectId,
  timelineId,
  photographerId,
  viewMode = 'full',
  enableSuggestions = true,
  onEventAdded,
  onSuggestionSent,
}: WeddingTimelineEditorProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const { toast } = useToast();
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');
  const queryClient = useQueryClient();

  // External data for planning intelligence (weather, location)
  const externalData = useExternalData?.();
  const [weatherAtWedding, setWeatherAtWedding] = useState<unknown>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Auto-fetch weather when location/time is set in dialog
  const fetchWeatherIfPossible = async (loc?: string, time?: string) => {
    try {
      if (!externalData || !externalData.getWeatherForecast) return;
      if (!loc || !time) return;
      setWeatherLoading(true);
      const location = (loc || '').trim();
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}T${time}:00`;
      const forecast = await externalData.getWeatherForecast({ location, dateTime: dateStr });
      setWeatherAtWedding(forecast);
    } catch (e) {
      // Silent fail — optional enrichment
      setWeatherAtWedding(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  // New event form state
  const [newEvent, setNewEvent] = useState<TimelineEvent>({
    title: '',
    time: '',
    duration: 60,
    description: '',
    location: '',
    eventType: 'other',
    priority: 'medium',
    status: 'planned',
    hasSpeech: false,
    speechDetails: '',
  });

  // New suggestion form state
  const [newSuggestion, setNewSuggestion] = useState<TimelineSuggestion>({
    eventTitle: '',
    suggestedTime: '',
    reason: '',
    priority: 'medium',
    status: 'pending',
  });

  // Fetch timeline events
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: [`/api/wedding-timeline/${timelineId}/events`],
    queryFn: () => apiRequest(`/api/wedding-timeline/${timelineId}/events`),
    enabled: !!timelineId,
  });

  // Fetch suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery({
    queryKey: [`/api/wedding-timeline/${timelineId}/suggestions`],
    queryFn: () => apiRequest(`/api/wedding-timeline/${timelineId}/suggestions`),
    enabled: !!timelineId && enableSuggestions,
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async (eventData: TimelineEvent) => {
      return apiRequest(`/api/wedding-timeline/${timelineId}/events`, {
        method: 'POST',
        body: eventData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/wedding-timeline/${timelineId}/events`] });
      setEventDialogOpen(false);
      resetEventForm();
      toast({
        title: 'Event lagt til',
        description: 'Tidslinjen er oppdatert',
      });
      onEventAdded?.(data);
    },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke legge til event',
        variant: 'destructive',
      });
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...eventData }: TimelineEvent & { id: string }) => {
      return apiRequest(`/api/wedding-timeline/events/${id}`, {
        method: 'PUT',
        body: eventData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wedding-timeline/${timelineId}/events`] });
      setEventDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: 'Event oppdatert',
        description: 'Endringene er lagret',
      });
    },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke oppdatere event',
        variant: 'destructive',
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest(`/api/wedding-timeline/events/${eventId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wedding-timeline/${timelineId}/events`] });
      toast({
        title: 'Event slettet',
        description: 'Event er fjernet fra tidslinjen',
      });
    },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke slette event',
        variant: 'destructive',
      });
    },
  });

  // Add suggestion mutation
  const addSuggestionMutation = useMutation({
    mutationFn: async (suggestionData: TimelineSuggestion) => {
      return apiRequest(`/api/wedding-timeline/${timelineId}/suggestions`, {
        method: 'POST',
        body: suggestionData,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/wedding-timeline/${timelineId}/suggestions`],
      });
      setSuggestionDialogOpen(false);
      resetSuggestionForm();
      toast({
        title: 'Forslag sendt',
        description: 'Klienten blir varslet om ditt forslag',
      });
      onSuggestionSent?.(data);
    },
    onError: () => {
      toast({
        title: 'Feil',
        description: 'Kunne ikke sende forslag',
        variant: 'destructive',
      });
    },
  });

  const resetEventForm = () => {
    setNewEvent({
      title: '',
      time: '',
      duration: 60,
      description: '',
      location: '',
      eventType: 'other',
      priority: 'medium',
      status: 'planned',
      hasSpeech: false,
      speechDetails: '',
    });
  };

  const resetSuggestionForm = () => {
    setNewSuggestion({
      eventTitle: '',
      suggestedTime: '',
      reason: '',
      priority: 'medium',
      status: 'pending',
    });
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
    switch (type) {
      case 'ceremony': return <Event color="error" />;
      case 'reception': return <People color="primary" />;
      case 'preparation': return <Camera color="info" />;
      case 'photo_session': return <Camera color="success" />;
      case 'speech': return <Mic color="warning" />;
      default: return <Schedule color="action" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const events = eventsData?.events || [];
  const suggestions = suggestionsData?.suggestions || [];
  const pendingSuggestions = suggestions.filter((s: unknown) => s.status === 'pending');

  if (!timelineId) {
    return (
      <Alert severity="info">
        <Typography variant="h6" gutterBottom>
          Ingen tidslinje valgt
        </Typography>
        <Typography variant="body2">
          Velg et bryllupsprosjekt for å administrere tidslinjen.
        </Typography>
      </Alert>
    );
  }

  return (
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
          <Event sx={{ color: '#E91E63' }} />
          Rediger Tidslinje
          <Chip label={`${events.length} events`} size="small" color="primary" />
          {pendingSuggestions.length > 0 && (
            <Badge badgeContent={pendingSuggestions.length} color="warning">
              <Chip label="Forslag" size="small" color="warning" />
            </Badge>
          )}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setSelectedEvent(null);
              resetEventForm();
              setEventDialogOpen(true);
            }}
            sx={{
              bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' }}}
          >
            Legg til Event
          </Button>
          {enableSuggestions && (
            <Button
              variant="outlined"
              startIcon={<Lightbulb />}
              onClick={() => {
                resetSuggestionForm();
                setSuggestionDialogOpen(true);
              }}
              sx={{ borderColor: '#E91E63', color: '#E91E63' }}>
              Send Forslag
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label={`Timeline (${events.length})`} />
          {enableSuggestions && (
            <Tab
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Forslag
                  {pendingSuggestions.length > 0 && (
                    <Badge badgeContent={pendingSuggestions.length} color="warning" />
                  )}
                </Box>
              }
            />
          )}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {eventsLoading ? (
            <Typography>Laster events...</Typography>
          ) : events.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Ingen events enda
              </Typography>
              <Typography variant="body2">
                Klikk "Legg til Event" for å begynne å bygge tidslinjen for bryllupet.
              </Typography>
            </Alert>
          ) : (
            <Timeline position="right">
              {events
                .sort((a: any, b: unknown) => a.time.localeCompare(b.time)
                .map((event: any, index: number) => (
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

                        {event.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {event.description}
                          </Typography>
                        )}

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {event.location && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LocationOn fontSize="small" color="action" />
                              <Typography variant="caption">{event.location}</Typography>
                            </Box>
                          )}
                          {event.hasSpeech && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Mic fontSize="small" color="warning" />
                              <Typography variant="caption">Tale inkludert</Typography>
                            </Box>
                          )}
                        </Box>

                        {event.hasSpeech && event.speechDetails && (
                          <Alert severity="info" sx={{ mt: 1 }}>
                            <Typography variant="caption">{event.speechDetails}</Typography>
                          </Alert>
                        )}
                      </Paper>
                    </TimelineContent>
                  </TimelineItem>
                ))}
            </Timeline>
          )}
        </Box>
      )}

      {activeTab === 1 && enableSuggestions && (
        <Box>
          {suggestionsLoading ? (
            <Typography>Laster forslag...</Typography>
          ) : suggestions.length === 0 ? (
            <Alert severity="info">
              <Typography variant="h6" gutterBottom>
                Ingen forslag enda
              </Typography>
              <Typography variant="body2">
                Klikk "Send Forslag" for å foreslå endringer til klienten.
              </Typography>
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {suggestions.map((suggestion: unknown) => (
                <Grid item xs={12} key={suggestion.id}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start'}}>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
                            {suggestion.eventTitle}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <Chip
                              label={suggestion.status}
                              size="small"
                              color={
                                suggestion.status === 'accepted'
                                  ? 'success'
                                  : suggestion.status === 'rejected'
                                    ? 'error'
                                    : 'warning'
                              }
                            />
                            <Chip
                              label={suggestion.priority}
                              size="small"
                              color={getPriorityColor(suggestion.priority) as any}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AccessTime fontSize="small" color="action" />
                            <Typography variant="body2">
                              Foreslått tid: <strong>{suggestion.suggestedTime}</strong>
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Begrunnelse:</strong> {suggestion.reason}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Add/Edit Event Dialog */}
      <Dialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#E91E63', color: 'white' }}>
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
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value as any })}}
                  label="Event type"
                >
                  <MenuItem value="ceremony">Seremoni</MenuItem>
                  <MenuItem value="reception">Mottakelse</MenuItem>
                  <MenuItem value="preparation">Forberedelse</MenuItem>
                  <MenuItem value="photo_session">Fotosesjon</MenuItem>
                  <MenuItem value="speech">Tale</MenuItem>
                  <MenuItem value="other">Annet</MenuItem>
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
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newEvent.hasSpeech}
                    onChange={(e) => setNewEvent({ ...newEvent, hasSpeech: e.target.checked })}}
                  />
                }}
                label="Inkluderer tale/innslag"
              />
            </Grid>
            {newEvent.hasSpeech && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Tale detaljer"
                  value={newEvent.speechDetails}
                  onChange={(e) => setNewEvent({ ...newEvent, speechDetails: e.target.value })}}
                  placeholder="Hvem holder talen, tema, etc."
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleAddEvent}
            disabled={!newEvent.title || !newEvent.time}
            sx={{ bgcolor: '#E91E63', '&:hover': { bgcolor: '#C2185B' } }}

          >
            {selectedEvent ? 'Oppdater' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Suggestion Dialog */}
      <Dialog
        open={suggestionDialogOpen}
        onClose={() => setSuggestionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{ bgcolor: '#FF9800', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Lightbulb />
          Send Forslag til Klient
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Forslaget sendes til klienten for godkjenning. De kan akseptere eller avslå
                endringen.
              </Alert>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Event tittel *"
                value={newSuggestion.eventTitle}
                onChange={(e) => setNewSuggestion({ ...newSuggestion, eventTitle: e.target.value })}}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                type="time"
                label="Foreslått tidspunkt *"
                value={newSuggestion.suggestedTime}
                onChange={(e) =>
                  setNewSuggestion({ ...newSuggestion, suggestedTime: e.target.value })
                }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Prioritet</InputLabel>
                <Select
                  value={newSuggestion.priority}
                  onChange={(e) =>
                    setNewSuggestion({ ...newSuggestion, priority: e.target.value as any })
                  }}
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
                multiline
                rows={4}
                label="Begrunnelse *"
                value={newSuggestion.reason}
                onChange={(e) => setNewSuggestion({ ...newSuggestion, reason: e.target.value })}}
                placeholder="Forklar hvorfor du foreslår denne endringen..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestionDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={handleSendSuggestion}
            disabled={
              !newSuggestion.eventTitle || !newSuggestion.suggestedTime || !newSuggestion.reason
            }}
            sx={{ bgcolor: '#FF9800','&:hover': { bgcolor: '#F57C00' } }}

          >
            Send Forslag
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
