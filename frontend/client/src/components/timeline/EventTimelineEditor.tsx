import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Add as AddIcon,
  AutoFixHigh as AutoFixHighIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Event as EventIcon,
  LocationOn as LocationOnIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useExternalData } from '@/services/ExternalDataService';

type ProjectType =
  | 'wedding'
  | 'commercial'
  | 'portrait'
  | 'event'
  | 'corporate'
  | 'music_video'
  | 'bryllup';

interface EventTimelineEditorProps {
  projectId: string;
  timelineId?: string;
  userId: string;
  projectType: ProjectType;
  culturalType?: string;
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
  metadata?: Record<string, unknown>;
}

interface TimelineSuggestion {
  id?: string;
  eventTitle: string;
  suggestedTime: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected';
}

const EMPTY_EVENT: TimelineEvent = {
  title: '',
  time: '',
  duration: 60,
  description: '',
  location: '',
  eventType: 'general',
  priority: 'medium',
  status: 'planned',
};

const EMPTY_SUGGESTION: TimelineSuggestion = {
  eventTitle: '',
  suggestedTime: '',
  reason: '',
  priority: 'medium',
  status: 'pending',
};

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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profession } = useProfessionAdapter();
  const theming = useTheming(profession || 'photographer');
  const externalData = useExternalData();

  const [tab, setTab] = useState(0);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent>(EMPTY_EVENT);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [suggestionDraft, setSuggestionDraft] = useState<TimelineSuggestion>(EMPTY_SUGGESTION);
  const [weatherLocation, setWeatherLocation] = useState('');

  const {
    data: eventsRaw,
    isLoading: eventsLoading,
  } = useQuery({
    queryKey: [`/api/event-timeline/${projectId}/events`],
    queryFn: () => apiRequest(`/api/event-timeline/${projectId}/events`),
    enabled: Boolean(projectId),
  });

  const {
    data: suggestionsRaw,
    isLoading: suggestionsLoading,
  } = useQuery({
    queryKey: [`/api/event-timeline/${projectId}/suggestions`],
    queryFn: () => apiRequest(`/api/event-timeline/${projectId}/suggestions`),
    enabled: Boolean(projectId) && enableSuggestions,
  });

  const {
    data: weatherRaw,
    isLoading: weatherLoading,
  } = useQuery({
    queryKey: ['timeline-weather', weatherLocation],
    queryFn: () => externalData.getCurrentWeather(weatherLocation),
    enabled: weatherLocation.trim().length > 0,
    staleTime: 60_000,
  });

  const events = useMemo(() => normalizeEvents(eventsRaw), [eventsRaw]);
  const suggestions = useMemo(() => normalizeSuggestions(suggestionsRaw), [suggestionsRaw]);
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );
  const weather = useMemo(() => normalizeWeather(weatherRaw), [weatherRaw]);

  const addEventMutation = useMutation({
    mutationFn: (payload: TimelineEvent) =>
      apiRequest(`/api/event-timeline/${projectId}/events`, {
        method: 'POST',
        body: {
          ...payload,
          projectType,
          userId,
          timelineId,
          culturalType,
        },
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      setEventDialogOpen(false);
      setEditingEvent({ ...EMPTY_EVENT, eventType: getDefaultEventType(projectType) });
      toast({ title: 'Event lagt til', description: 'Tidslinjen er oppdatert', variant: 'success' });
      onEventAdded?.(response);
    },
    onError: () => {
      toast({ title: 'Kunne ikke lagre event', variant: 'destructive' });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: (payload: TimelineEvent) =>
      apiRequest(`/api/event-timeline/events/${payload.id}`, {
        method: 'PUT',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      setEventDialogOpen(false);
      setEditingEvent({ ...EMPTY_EVENT, eventType: getDefaultEventType(projectType) });
      toast({ title: 'Event oppdatert', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Kunne ikke oppdatere event', variant: 'destructive' });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiRequest(`/api/event-timeline/events/${eventId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      setSelectedEventId(null);
      toast({ title: 'Event slettet', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Kunne ikke slette event', variant: 'destructive' });
    },
  });

  const addSuggestionMutation = useMutation({
    mutationFn: (payload: TimelineSuggestion) =>
      apiRequest(`/api/event-timeline/${projectId}/suggestions`, {
        method: 'POST',
        body: {
          ...payload,
          userId,
          projectType,
        },
      }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/suggestions`] });
      setSuggestionDialogOpen(false);
      setSuggestionDraft(EMPTY_SUGGESTION);
      toast({ title: 'Forslag sendt', variant: 'success' });
      onSuggestionSent?.(response);
    },
    onError: () => {
      toast({ title: 'Kunne ikke sende forslag', variant: 'destructive' });
    },
  });

  const updateSuggestionStatusMutation = useMutation({
    mutationFn: (payload: { id: string; status: TimelineSuggestion['status'] }) =>
      apiRequest(`/api/event-timeline/suggestions/${payload.id}`, {
        method: 'PATCH',
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/suggestions`] });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiRequest(`/api/event-timeline/${projectId}/auto-generate`, {
          method: 'POST',
          body: { projectType, culturalType, userId, timelineId },
        });
      } catch {
        const templates = getDefaultEventTemplates(projectType, culturalType);
        await Promise.all(
          templates.map((template) =>
            apiRequest(`/api/event-timeline/${projectId}/events`, {
              method: 'POST',
              body: {
                ...template,
                userId,
                projectType,
                timelineId,
              },
            }),
          ),
        );
        return { count: templates.length };
      }
    },
    onSuccess: (result: unknown) => {
      const count = getGeneratedCount(result);
      queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${projectId}/events`] });
      toast({
        title: 'Standardevents generert',
        description: `${count} events lagt til`,
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Kunne ikke autogenerere',
        description: 'Prøv igjen eller legg inn event manuelt',
        variant: 'destructive',
      });
    },
  });

  const compactMode = viewMode === 'compact';

  return (
    <Box>
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Stack direction={compactMode ? 'column' : 'row'} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EventIcon />
                Event Timeline Editor
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Prosjekt: {projectType} • {events.length} events • {suggestions.length} forslag
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={() => autoGenerateMutation.mutate()}
                disabled={autoGenerateMutation.isPending}
              >
                Autogenerer
              </Button>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                disabled={!enableSuggestions}
                onClick={() => setSuggestionDialogOpen(true)}
              >
                Nytt forslag
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingEvent({ ...EMPTY_EVENT, eventType: getDefaultEventType(projectType) });
                  setEventDialogOpen(true);
                }}
              >
                Legg til event
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
          <Tab label={`Events (${events.length})`} />
          <Tab label={`Forslag (${suggestions.length})`} disabled={!enableSuggestions} />
        </Tabs>
        <Divider />
        <CardContent>
          {tab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                {eventsLoading ? (
                  <Typography color="text.secondary">Laster events...</Typography>
                ) : (
                  <List>
                    {events.map((event) => (
                      <ListItem
                        key={event.id ?? `${event.title}-${event.time}`}
                        secondaryAction={
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingEvent(event);
                                setEventDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            {event.id && (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteEventMutation.mutate(event.id ?? '')}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        }
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography sx={{ fontWeight: 600 }}>{event.title}</Typography>
                              <Chip size="small" label={event.status} />
                              <Chip
                                size="small"
                                color={event.priority === 'high' ? 'error' : event.priority === 'medium' ? 'warning' : 'default'}
                                label={event.priority}
                              />
                            </Stack>
                          }
                          secondary={
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <AccessTimeIcon fontSize="inherit" />
                                <Typography variant="caption">
                                  {event.time} ({event.duration} min)
                                </Typography>
                              </Stack>
                              {event.location && (
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <LocationOnIcon fontSize="inherit" />
                                  <Typography variant="caption">{event.location}</Typography>
                                </Stack>
                              )}
                            </Stack>
                          }
                          onClick={() => {
                            if (event.id) {
                              setSelectedEventId(event.id);
                              if (event.location) {
                                setWeatherLocation(event.location);
                              }
                            }
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Eventdetaljer
                    </Typography>
                    {selectedEvent ? (
                      <Stack spacing={1}>
                        <Typography variant="body2">{selectedEvent.description || 'Ingen beskrivelse'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Type: {selectedEvent.eventType}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Lokasjon: {selectedEvent.location || 'Ikke satt'}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Velg et event for detaljer.
                      </Typography>
                    )}
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Værprognose
                    </Typography>
                    {weatherLoading ? (
                      <Typography variant="body2" color="text.secondary">
                        Laster værdata...
                      </Typography>
                    ) : weather ? (
                      <Stack spacing={0.5}>
                        <Typography variant="caption">{weather.location}</Typography>
                        <Typography variant="caption">
                          {weather.temperature.toFixed(1)}°C • Vind {weather.windSpeed.toFixed(1)} m/s
                        </Typography>
                        <Typography variant="caption">Skydekke {weather.cloudCover}%</Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Velg event med lokasjon for værdata.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tab === 1 && (
            <Box>
              {suggestionsLoading ? (
                <Typography color="text.secondary">Laster forslag...</Typography>
              ) : (
                <List>
                  {suggestions.map((suggestion) => (
                    <ListItem
                      key={suggestion.id ?? `${suggestion.eventTitle}-${suggestion.suggestedTime}`}
                      secondaryAction={
                        suggestion.id ? (
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              onClick={() =>
                                updateSuggestionStatusMutation.mutate({ id: suggestion.id ?? '', status: 'accepted' })
                              }
                            >
                              Godta
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                updateSuggestionStatusMutation.mutate({ id: suggestion.id ?? '', status: 'rejected' })
                              }
                            >
                              Avslå
                            </Button>
                          </Stack>
                        ) : null
                      }
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography sx={{ fontWeight: 600 }}>{suggestion.eventTitle}</Typography>
                            <Chip size="small" label={suggestion.status} />
                          </Stack>
                        }
                        secondary={`${suggestion.suggestedTime} • ${suggestion.reason}`}
                      />
                    </ListItem>
                  ))}
                  {suggestions.length === 0 && (
                    <ListItem>
                      <ListItemText primary="Ingen forslag registrert." />
                    </ListItem>
                  )}
                </List>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEvent.id ? 'Rediger event' : 'Legg til event'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tittel"
              value={editingEvent.title}
              onChange={(event) => setEditingEvent((previous) => ({ ...previous, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Tidspunkt"
              type="datetime-local"
              value={editingEvent.time}
              onChange={(event) => setEditingEvent((previous) => ({ ...previous, time: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Varighet (minutter)"
              type="number"
              value={editingEvent.duration}
              onChange={(event) => setEditingEvent((previous) => ({ ...previous, duration: Number(event.target.value) }))}
              fullWidth
            />
            <TextField
              label="Lokasjon"
              value={editingEvent.location ?? ''}
              onChange={(event) => setEditingEvent((previous) => ({ ...previous, location: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={editingEvent.description ?? ''}
              onChange={(event) => setEditingEvent((previous) => ({ ...previous, description: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="timeline-event-type">Eventtype</InputLabel>
                  <Select
                    labelId="timeline-event-type"
                    label="Eventtype"
                    value={editingEvent.eventType}
                    onChange={(event) =>
                      setEditingEvent((previous) => ({ ...previous, eventType: String(event.target.value) }))
                    }
                  >
                    {getEventTypeOptions(projectType).map((eventType) => (
                      <MenuItem key={eventType} value={eventType}>
                        {eventType}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel id="timeline-priority">Prioritet</InputLabel>
                  <Select
                    labelId="timeline-priority"
                    label="Prioritet"
                    value={editingEvent.priority}
                    onChange={(event) =>
                      setEditingEvent((previous) => ({
                        ...previous,
                        priority: event.target.value as TimelineEvent['priority'],
                      }))
                    }
                  >
                    <MenuItem value="high">high</MenuItem>
                    <MenuItem value="medium">medium</MenuItem>
                    <MenuItem value="low">low</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel id="timeline-status">Status</InputLabel>
                  <Select
                    labelId="timeline-status"
                    label="Status"
                    value={editingEvent.status}
                    onChange={(event) =>
                      setEditingEvent((previous) => ({
                        ...previous,
                        status: event.target.value as TimelineEvent['status'],
                      }))
                    }
                  >
                    <MenuItem value="planned">planned</MenuItem>
                    <MenuItem value="confirmed">confirmed</MenuItem>
                    <MenuItem value="completed">completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={editingEvent.title.trim().length === 0 || editingEvent.time.trim().length === 0}
            onClick={() => {
              if (editingEvent.id) {
                updateEventMutation.mutate(editingEvent);
              } else {
                addEventMutation.mutate(editingEvent);
              }
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={suggestionDialogOpen} onClose={() => setSuggestionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nytt forslag</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Eventtittel"
              value={suggestionDraft.eventTitle}
              onChange={(event) => setSuggestionDraft((previous) => ({ ...previous, eventTitle: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Foreslått tidspunkt"
              type="datetime-local"
              value={suggestionDraft.suggestedTime}
              onChange={(event) => setSuggestionDraft((previous) => ({ ...previous, suggestedTime: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Begrunnelse"
              value={suggestionDraft.reason}
              onChange={(event) => setSuggestionDraft((previous) => ({ ...previous, reason: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel id="timeline-suggestion-priority">Prioritet</InputLabel>
              <Select
                labelId="timeline-suggestion-priority"
                label="Prioritet"
                value={suggestionDraft.priority}
                onChange={(event) =>
                  setSuggestionDraft((previous) => ({
                    ...previous,
                    priority: event.target.value as TimelineSuggestion['priority'],
                  }))
                }
              >
                <MenuItem value="high">high</MenuItem>
                <MenuItem value="medium">medium</MenuItem>
                <MenuItem value="low">low</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestionDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={
              suggestionDraft.eventTitle.trim().length === 0 ||
              suggestionDraft.suggestedTime.trim().length === 0 ||
              suggestionDraft.reason.trim().length === 0
            }
            onClick={() => addSuggestionMutation.mutate(suggestionDraft)}
          >
            Send forslag
          </Button>
        </DialogActions>
      </Dialog>

      {autoGenerateMutation.isPending && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Genererer standardevents…
        </Alert>
      )}
    </Box>
  );
}

function normalizeEvents(raw: unknown): TimelineEvent[] {
  return extractArray(raw)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const title = toString(record.title);
      const time = toString(record.time);
      if (!title || !time) {
        return null;
      }
      return {
        id: toOptionalString(record.id),
        title,
        time,
        duration: toNumber(record.duration, 60),
        description: toOptionalString(record.description),
        location: toOptionalString(record.location),
        eventType: toString(record.eventType) || 'general',
        priority: toPriority(record.priority),
        status: toStatus(record.status),
        metadata: asRecord(record.metadata) || undefined,
      } satisfies TimelineEvent;
    })
    .filter((event): event is TimelineEvent => event !== null);
}

function normalizeSuggestions(raw: unknown): TimelineSuggestion[] {
  return extractArray(raw)
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const eventTitle = toString(record.eventTitle);
      const suggestedTime = toString(record.suggestedTime);
      if (!eventTitle || !suggestedTime) {
        return null;
      }
      return {
        id: toOptionalString(record.id),
        eventTitle,
        suggestedTime,
        reason: toString(record.reason),
        priority: toPriority(record.priority),
        status: toSuggestionStatus(record.status),
      } satisfies TimelineSuggestion;
    })
    .filter((suggestion): suggestion is TimelineSuggestion => suggestion !== null);
}

function normalizeWeather(raw: unknown): { location: string; temperature: number; windSpeed: number; cloudCover: number } | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const location = toString(record.location);
  if (!location) {
    return null;
  }
  return {
    location,
    temperature: toNumber(record.temperature, 0),
    windSpeed: toNumber(record.windSpeed, 0),
    cloudCover: toNumber(record.cloudCover, 0),
  };
}

function getGeneratedCount(result: unknown): number {
  const record = asRecord(result);
  if (!record) {
    return 0;
  }
  if (typeof record.count === 'number' && Number.isFinite(record.count)) {
    return record.count;
  }
  return 0;
}

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  const record = asRecord(raw);
  if (!record) {
    return [];
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }
  if (Array.isArray(record.events)) {
    return record.events;
  }
  if (Array.isArray(record.suggestions)) {
    return record.suggestions;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function toPriority(value: unknown): TimelineEvent['priority'] {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}

function toStatus(value: unknown): TimelineEvent['status'] {
  if (value === 'planned' || value === 'confirmed' || value === 'completed') {
    return value;
  }
  return 'planned';
}

function toSuggestionStatus(value: unknown): TimelineSuggestion['status'] {
  if (value === 'pending' || value === 'accepted' || value === 'rejected') {
    return value;
  }
  return 'pending';
}

function getDefaultEventType(projectType: ProjectType): string {
  switch (projectType) {
    case 'wedding':
    case 'bryllup':
      return 'ceremony';
    case 'commercial':
      return 'campaign';
    case 'portrait':
      return 'portrait-session';
    case 'music_video':
      return 'performance';
    case 'corporate':
      return 'presentation';
    case 'event':
      return 'session';
    default:
      return 'general';
  }
}

function getEventTypeOptions(projectType: ProjectType): string[] {
  const common = ['setup', 'break', 'delivery', 'general'];
  switch (projectType) {
    case 'wedding':
    case 'bryllup':
      return ['preparation', 'ceremony', 'group-photos', 'dinner', 'party', ...common];
    case 'commercial':
      return ['campaign', 'studio', 'location-shoot', 'client-review', ...common];
    case 'portrait':
      return ['portrait-session', 'makeup', 'outdoor-set', ...common];
    case 'music_video':
      return ['performance', 'b-roll', 'narrative', ...common];
    case 'corporate':
      return ['presentation', 'interview', 'workshop', ...common];
    case 'event':
      return ['session', 'speaker', 'registration', 'networking', ...common];
    default:
      return common;
  }
}

function getDefaultEventTemplates(projectType: ProjectType, culturalType?: string): TimelineEvent[] {
  const baseDate = new Date();
  baseDate.setHours(9, 0, 0, 0);

  const template = (title: string, hoursFromStart: number, duration: number, eventType: string): TimelineEvent => {
    const time = new Date(baseDate.getTime() + hoursFromStart * 60 * 60 * 1000).toISOString().slice(0, 16);
    return {
      ...EMPTY_EVENT,
      title,
      time,
      duration,
      eventType,
    };
  };

  if (projectType === 'wedding' || projectType === 'bryllup') {
    const culturalLabel = culturalType ? ` (${culturalType})` : '';
    return [
      template(`Forberedelser${culturalLabel}`, 0, 90, 'preparation'),
      template(`Vielse${culturalLabel}`, 2, 60, 'ceremony'),
      template('Portretter', 3.5, 60, 'group-photos'),
      template('Middag og taler', 5, 120, 'dinner'),
      template('Fest', 7.5, 180, 'party'),
    ];
  }

  if (projectType === 'event') {
    return [
      template('Rigging', 0, 60, 'setup'),
      template('Registrering', 1, 45, 'registration'),
      template('Hovedsession', 2, 120, 'session'),
      template('Nettverking', 4.5, 90, 'networking'),
    ];
  }

  return [
    template('Oppsett', 0, 60, 'setup'),
    template('Hovedopptak', 1, 180, getDefaultEventType(projectType)),
    template('Pause', 4, 30, 'break'),
    template('Ekstraopptak', 4.5, 120, 'general'),
    template('Levering/backup', 6.5, 60, 'delivery'),
  ];
}
