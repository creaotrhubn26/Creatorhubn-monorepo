import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  Add,
  CalendarToday,
  Event,
  LocationOn,
  Refresh,
  Schedule,
  Today,
  Warning,
} from '@mui/icons-material';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string }>;
  status: 'confirmed' | 'tentative' | 'cancelled' | 'unknown';
  htmlLink?: string;
  created?: string;
  updated?: string;
  splitSheetEvent?: boolean;
  eventType?: string;
  color?: string;
}

interface DashboardData {
  todayEvents: CalendarEvent[];
  upcomingProjects: Array<{ project: { id: string; name: string }; events: CalendarEvent[] }>;
  conflicts: CalendarEvent[];
}

interface CalendarSummary {
  id: string;
  summary: string;
  primary?: boolean;
}

interface UniversalCalendarWidgetProps {
  userId: string;
  userEmail: string;
  profession?: string;
  projectId?: number;
}

interface NewEventDraft {
  summary: string;
  description: string;
  start: string;
  end: string;
  location: string;
  attendees: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const normalizeStatus = (value: unknown): CalendarEvent['status'] => {
  if (value === 'confirmed' || value === 'tentative' || value === 'cancelled') {
    return value;
  }
  return 'unknown';
};

const normalizeCalendarEvent = (value: unknown): CalendarEvent | null => {
  if (!isObject(value)) return null;

  const id = asString(value.id);
  const summary = asString(value.summary);
  if (!id || !summary) return null;

  const startRaw = isObject(value.start) ? value.start : {};
  const endRaw = isObject(value.end) ? value.end : {};

  const attendeesRaw = Array.isArray(value.attendees) ? value.attendees : [];
  const attendees = attendeesRaw
    .filter(isObject)
    .map((entry) => ({ email: asString(entry.email) }))
    .filter((entry) => entry.email.length > 0);

  return {
    id,
    summary,
    description: asString(value.description) || undefined,
    start: {
      dateTime: asString(startRaw.dateTime) || undefined,
      date: asString(startRaw.date) || undefined,
    },
    end: {
      dateTime: asString(endRaw.dateTime) || undefined,
      date: asString(endRaw.date) || undefined,
    },
    location: asString(value.location) || undefined,
    attendees,
    status: normalizeStatus(value.status),
    htmlLink: asString(value.htmlLink) || undefined,
    created: asString(value.created) || undefined,
    updated: asString(value.updated) || undefined,
    splitSheetEvent: Boolean(value.splitSheetEvent),
    eventType: asString(value.eventType) || undefined,
    color: asString(value.color) || undefined,
  };
};

const normalizeCalendarList = (value: unknown): CalendarSummary[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((calendar) => ({
      id: asString(calendar.id),
      summary: asString(calendar.summary, 'Ukjent kalender'),
      primary: Boolean(calendar.primary),
    }))
    .filter((calendar) => calendar.id.length > 0);
};

const normalizeDashboardData = (value: unknown): DashboardData => {
  if (!isObject(value)) {
    return { todayEvents: [], upcomingProjects: [], conflicts: [] };
  }

  const todayEvents = Array.isArray(value.todayEvents)
    ? value.todayEvents
        .map(normalizeCalendarEvent)
        .filter((event): event is CalendarEvent => event !== null)
    : [];

  const conflicts = Array.isArray(value.conflicts)
    ? value.conflicts
        .map(normalizeCalendarEvent)
        .filter((event): event is CalendarEvent => event !== null)
    : [];

  const upcomingProjects = Array.isArray(value.upcomingProjects)
    ? value.upcomingProjects
        .filter(isObject)
        .map((entry) => {
          const projectRaw = isObject(entry.project) ? entry.project : {};
          const eventsRaw = Array.isArray(entry.events) ? entry.events : [];
          return {
            project: {
              id: asString(projectRaw.id, crypto.randomUUID()),
              name: asString(projectRaw.name, 'Ukjent prosjekt'),
            },
            events: eventsRaw
              .map(normalizeCalendarEvent)
              .filter((event): event is CalendarEvent => event !== null),
          };
        })
    : [];

  return { todayEvents, upcomingProjects, conflicts };
};

const normalizeEventCollection = (value: unknown): CalendarEvent[] => {
  if (Array.isArray(value)) {
    return value
      .map(normalizeCalendarEvent)
      .filter((event): event is CalendarEvent => event !== null);
  }

  if (isObject(value) && Array.isArray(value.items)) {
    return value.items
      .map(normalizeCalendarEvent)
      .filter((event): event is CalendarEvent => event !== null);
  }

  if (
    isObject(value) &&
    isObject(value.data) &&
    Array.isArray((value.data as Record<string, unknown>).items)
  ) {
    return ((value.data as Record<string, unknown>).items as unknown[])
      .map(normalizeCalendarEvent)
      .filter((event): event is CalendarEvent => event !== null);
  }

  return [];
};

const formatEventTime = (event: CalendarEvent): string => {
  const startValue = event.start.dateTime || event.start.date;
  const endValue = event.end.dateTime || event.end.date;

  if (!startValue || !endValue) return 'Ukjent tidspunkt';
  if (event.start.date && !event.start.dateTime) return 'Hele dagen';

  const start = new Date(startValue);
  const end = new Date(endValue);

  return `${start.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString(
    'no-NO',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
};

const getStatusColor = (status: CalendarEvent['status']): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'confirmed') return 'success';
  if (status === 'tentative') return 'warning';
  if (status === 'cancelled') return 'error';
  return 'default';
};

export default function UniversalCalendarWidget({
  userId,
  userEmail,
  profession = 'photographer',
}: UniversalCalendarWidgetProps) {
  const theming = useTheming(profession);
  const queryClient = useQueryClient();

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState('primary');
  const [conflicts, setConflicts] = useState<CalendarEvent[]>([]);
  const [newEvent, setNewEvent] = useState<NewEventDraft>({
    summary: '',
    description: '',
    start: '',
    end: '',
    location: '',
    attendees: '',
  });

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: ['/api/calendar/dashboard', userId, userEmail, selectedCalendar],
    queryFn: async () => {
      const result = await apiRequest(
        `/api/calendar/dashboard?userId=${encodeURIComponent(userId)}&userEmail=${encodeURIComponent(
          userEmail,
        )}&calendarId=${encodeURIComponent(selectedCalendar)}`,
      );
      return normalizeDashboardData(result);
    },
  });

  const calendarsQuery = useQuery<CalendarSummary[]>({
    queryKey: ['/api/calendar/calendars', userEmail],
    queryFn: async () => {
      const result = await apiRequest(`/api/calendar/calendars?userEmail=${encodeURIComponent(userEmail)}`);
      return normalizeCalendarList(result);
    },
  });

  const todayEventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar/events', selectedCalendar, userEmail],
    queryFn: async () => {
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const result = await apiRequest(
        `/api/calendar/events?userEmail=${encodeURIComponent(userEmail)}&calendarId=${encodeURIComponent(
          selectedCalendar,
        )}&timeMin=${encodeURIComponent(dayStart.toISOString())}&timeMax=${encodeURIComponent(
          dayEnd.toISOString(),
        )}`,
      );

      return normalizeEventCollection(result);
    },
  });

  const splitSheetEventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ['/api/split-sheets/calendar-events', userId],
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const endDate = new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());

      const result = await apiRequest(
        `/api/split-sheets/calendar-events?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate
          .toISOString()
          .split('T')[0]}`,
      );

      if (!isObject(result) || !Array.isArray(result.data)) {
        return [];
      }

      return result.data
        .filter(isObject)
        .map((entry) => ({
          id: `split-sheet-${asString(entry.id)}-${asString(entry.event_type)}`,
          summary: asString(entry.event_title, 'Split Sheet Event'),
          description: `Split Sheet: ${asString(entry.event_title)}`,
          start: { date: asString(entry.event_date), dateTime: `${asString(entry.event_date)}T09:00:00` },
          end: { date: asString(entry.event_date), dateTime: `${asString(entry.event_date)}T17:00:00` },
          status: 'confirmed' as const,
          splitSheetEvent: true,
          eventType: asString(entry.event_type) || undefined,
          color: asString(entry.color) || undefined,
        }))
        .filter((event) => event.id.length > 0 && event.summary.length > 0);
    },
    enabled: profession === 'music_producer' && userId.length > 0,
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventPayload: Record<string, unknown>) =>
      apiRequest('/api/calendar/events', {
        method: 'POST',
        body: {
          ...eventPayload,
          userEmail,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/calendar/dashboard'] });
      setEventDialogOpen(false);
    },
  });

  const checkConflictsMutation = useMutation({
    mutationFn: async (payload: { startTime: string; endTime: string; calendarId: string }) =>
      apiRequest('/api/calendar/check-conflicts', {
        method: 'POST',
        body: {
          ...payload,
          userEmail,
        },
      }),
  });

  const allEvents = useMemo(() => {
    const regularEvents = todayEventsQuery.data ?? [];
    const splitSheetEvents = splitSheetEventsQuery.data ?? [];
    return [...regularEvents, ...splitSheetEvents];
  }, [todayEventsQuery.data, splitSheetEventsQuery.data]);

  const dashboardData = dashboardQuery.data;
  const loading = dashboardQuery.isLoading || calendarsQuery.isLoading || todayEventsQuery.isLoading;

  const colors = useMemo(() => {
    if (profession === 'videographer') {
      return { primary: '#E91E63', secondary: '#C2185B', accent: '#FF7043' };
    }
    if (profession === 'music_producer') {
      return { primary: '#9C27B0', secondary: '#7B1FA2', accent: '#673AB7' };
    }
    if (profession === 'vendor') {
      return { primary: '#2196F3', secondary: '#1976D2', accent: '#00BCD4' };
    }
    return { primary: '#FF8C00', secondary: '#FF6B00', accent: '#4CAF50' };
  }, [profession]);

  const handleCreateEvent = async () => {
    if (!newEvent.summary || !newEvent.start || !newEvent.end) {
      return;
    }

    try {
      const conflictResponse = await checkConflictsMutation.mutateAsync({
        startTime: newEvent.start,
        endTime: newEvent.end,
        calendarId: selectedCalendar,
      });

      const conflictEvents = normalizeEventCollection(
        isObject(conflictResponse) ? (conflictResponse.conflicts as unknown) : [],
      );

      if (isObject(conflictResponse) && Boolean(conflictResponse.hasConflicts) && conflictEvents.length > 0) {
        setConflicts(conflictEvents);
        setConflictDialogOpen(true);
        return;
      }
    } catch (error) {
      console.error('Conflict check failed, continuing with create event:', error);
    }

    const attendees = newEvent.attendees
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0)
      .map((email) => ({ email }));

    await createEventMutation.mutateAsync({
      summary: newEvent.summary,
      description: newEvent.description,
      start: {
        dateTime: newEvent.start,
        timeZone: 'Europe/Oslo',
      },
      end: {
        dateTime: newEvent.end,
        timeZone: 'Europe/Oslo',
      },
      location: newEvent.location,
      attendees,
      calendarId: selectedCalendar,
    });

    setNewEvent({
      summary: '',
      description: '',
      start: '',
      end: '',
      location: '',
      attendees: '',
    });
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        sx={{
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          borderRadius: '16px 16px 0 0',
          p: 3,
          ...theming.getThemedCardSx(),
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ color: 'white', fontWeight: 'bold', mb: 1 }}>
              Universal Kalender
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.85)' }}>
              Integrert med Google Calendar og prosjektadministrasjon
            </Typography>
          </Box>
          <Box>
            <IconButton
              onClick={() => {
                void dashboardQuery.refetch();
                void todayEventsQuery.refetch();
              }}
              sx={{ color: 'white', mr: 1 }}
            >
              <Refresh />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setEventDialogOpen(true)}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
            >
              Ny avtale
            </Button>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="calendar-select-label">Kalender</InputLabel>
          <Select
            labelId="calendar-select-label"
            value={selectedCalendar}
            label="Kalender"
            onChange={(event) => setSelectedCalendar(event.target.value)}
          >
            {(calendarsQuery.data ?? []).map((calendar) => (
              <MenuItem key={calendar.id} value={calendar.id}>
                {calendar.summary} {calendar.primary ? '(Primær)' : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ p: 2 }}>
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ color: colors.primary, fontWeight: 'bold', mb: 2 }}>
                  <Today sx={{ mr: 1, verticalAlign: 'middle' }} />
                  I dag ({dashboardData?.todayEvents.length ?? 0} avtaler)
                </Typography>

                {allEvents.length === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Ingen avtaler i dag
                  </Typography>
                ) : (
                  <List dense>
                    {allEvents.slice(0, 4).map((event) => (
                      <ListItem key={event.id} divider>
                        <ListItemIcon>
                          <Event sx={{ color: event.color ?? colors.primary }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={event.summary}
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                                <AccessTime sx={{ fontSize: 14, mr: 0.5 }} />
                                {formatEventTime(event)}
                              </Typography>
                              {event.location && (
                                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                  <LocationOn sx={{ fontSize: 14, mr: 0.5 }} />
                                  {event.location}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip label={event.status} color={getStatusColor(event.status)} size="small" />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ color: colors.primary, fontWeight: 'bold', mb: 2 }}>
                  <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Kommende prosjekter
                </Typography>

                {(dashboardData?.upcomingProjects.length ?? 0) === 0 ? (
                  <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    Ingen kommende prosjektavtaler
                  </Typography>
                ) : (
                  <List dense>
                    {dashboardData?.upcomingProjects.slice(0, 4).map((project) => (
                      <ListItem key={project.project.id} divider>
                        <ListItemIcon>
                          <CalendarToday sx={{ color: colors.accent }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={project.project.name}
                          secondary={`${project.events.length} avtaler planlagt`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {(dashboardData?.conflicts.length ?? 0) > 0 && (
            <Grid item xs={12}>
              <Alert
                severity="warning"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setConflicts(dashboardData?.conflicts ?? []);
                      setConflictDialogOpen(true);
                    }}
                  >
                    Vis konflikter
                  </Button>
                }
              >
                Kalenderkonflikt oppdaget: {dashboardData?.conflicts.length} overlappende avtaler.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            color: 'white',
          }}
        >
          Opprett ny kalenderavtale
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tittel *"
                value={newEvent.summary}
                onChange={(event) => setNewEvent((previous) => ({ ...previous, summary: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={newEvent.description}
                onChange={(event) =>
                  setNewEvent((previous) => ({ ...previous, description: event.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Start"
                InputLabelProps={{ shrink: true }}
                value={newEvent.start}
                onChange={(event) => setNewEvent((previous) => ({ ...previous, start: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Slutt"
                InputLabelProps={{ shrink: true }}
                value={newEvent.end}
                onChange={(event) => setNewEvent((previous) => ({ ...previous, end: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Sted"
                value={newEvent.location}
                onChange={(event) => setNewEvent((previous) => ({ ...previous, location: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Deltakere (e-post, kommaseparert)"
                value={newEvent.attendees}
                onChange={(event) => setNewEvent((previous) => ({ ...previous, attendees: event.target.value }))}
                placeholder="test@example.com, annen@example.com"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreateEvent()}
            disabled={createEventMutation.isPending || checkConflictsMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            {createEventMutation.isPending ? <CircularProgress size={20} /> : 'Opprett avtale'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={conflictDialogOpen} onClose={() => setConflictDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)', color: 'white' }}>
          <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
          Kalenderkonflikt oppdaget
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Følgende avtaler overlapper med den valgte tiden:
          </Alert>

          <List>
            {conflicts.map((conflict) => (
              <ListItem key={conflict.id} divider>
                <ListItemIcon>
                  <Warning color="warning" />
                </ListItemIcon>
                <ListItemText
                  primary={conflict.summary}
                  secondary={
                    <Box>
                      <Typography variant="body2">{formatEventTime(conflict)}</Typography>
                      {conflict.location && (
                        <Typography variant="body2" color="text.secondary">
                          {conflict.location}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictDialogOpen(false)}>Lukk</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setConflictDialogOpen(false);
              setEventDialogOpen(true);
            }}
          >
            Opprett likevel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
