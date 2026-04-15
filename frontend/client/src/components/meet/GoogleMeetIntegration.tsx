// @ts-nocheck
/**
 * Google Meet Integration
 * Universal Google Meet component for all dashboards with notification integration
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
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
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
  type ChipProps,
} from '@mui/material';
import {
  Add as AddIcon,
  Launch as LaunchIcon,
  Notifications as NotificationIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  VideoCall as MeetIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  CalendarToday as CalendarIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionSpecificNotifications } from '../../hooks/useProfessionSpecificNotifications';
import SmartMeetingPreparation from './SmartMeetingPreparation';

export interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetLink: string;
  attendees: string[];
  status: 'upcoming' | 'starting' | 'active' | 'ended';
  clientName?: string;
  projectId?: string;
  type: 'consultation' | 'planning' | 'review' | 'delivery' | 'collaboration';
}

interface GoogleMeetIntegrationProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  userId: string;
  currentProject?: string;
  compact?: boolean;
}

interface NewMeetingForm {
  title: string;
  date: string;
  time: string;
  duration: number;
  clientEmail: string;
  type: Meeting['type'];
}

const initialMeetingForm: NewMeetingForm = {
  title: '',
  date: '',
  time: '',
  duration: 60,
  clientEmail: '',
  type: 'consultation',
};

function statusColor(status: Meeting['status']): ChipProps['color'] {
  switch (status) {
    case 'active':
      return 'success';
    case 'starting':
      return 'warning';
    case 'upcoming':
      return 'primary';
    case 'ended':
    default:
      return 'default';
  }
}

function generateMockMeetings(profession: GoogleMeetIntegrationProps['profession']): Meeting[] {
  const now = new Date();

  const makeDate = (minutesOffset: number): string => {
    const date = new Date(now.getTime() + minutesOffset * 60000);
    return date.toISOString();
  };

  return [
    {
      id: `${profession}-meet-1`,
      title: 'Kickoff med klient',
      startTime: makeDate(25),
      endTime: makeDate(85),
      meetLink: 'https://meet.google.com/creatorhub-kickoff',
      attendees: ['client@example.com', 'producer@example.com'],
      status: 'upcoming',
      clientName: 'Nordic Client',
      type: 'consultation',
    },
    {
      id: `${profession}-meet-2`,
      title: 'Gjennomgang av leveranse',
      startTime: makeDate(-5),
      endTime: makeDate(45),
      meetLink: 'https://meet.google.com/creatorhub-review',
      attendees: ['client@example.com', 'editor@example.com'],
      status: 'starting',
      clientName: 'Film Agency',
      type: 'review',
    },
  ];
}

export default function GoogleMeetIntegration({
  profession,
  userId,
  currentProject,
  compact = false,
}: GoogleMeetIntegrationProps): JSX.Element {
  const theming = useTheming(profession);
  const { getProfessionDisplayName } = useDynamicProfessions();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<NewMeetingForm>(initialMeetingForm);
  const [waitingClients, setWaitingClients] = useState<string[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifications = useProfessionSpecificNotifications(profession, userId);

  const notify = useMemo(() => {
    return (
      payload: {
        type: string;
        title: string;
        message: string;
        metadata?: Record<string, unknown>;
      },
    ): void => {
      if (typeof notifications?.notify === 'function') {
        notifications.notify(payload);
      }
    };
  }, [notifications]);

  useEffect(() => {
    setLoading(true);
    const initial = generateMockMeetings(profession);
    setMeetings(initial);
    setLoading(false);

    intervalRef.current = setInterval(() => {
      const now = new Date();

      setMeetings((prev) =>
        prev.map((meeting) => {
          const start = new Date(meeting.startTime);
          const end = new Date(meeting.endTime);

          if (meeting.status === 'upcoming' && start.getTime() - now.getTime() <= 5 * 60000 && start > now) {
            notify({
              type: 'google_meet_starting_soon',
              title: 'Møte starter snart',
              message: `${meeting.title} starter innen 5 minutter`,
              metadata: { meetingId: meeting.id, meetLink: meeting.meetLink },
            });
            return { ...meeting, status: 'starting' };
          }

          if ((meeting.status === 'upcoming' || meeting.status === 'starting') && now >= start && now <= end) {
            return { ...meeting, status: 'active' };
          }

          if (meeting.status !== 'ended' && now > end) {
            return { ...meeting, status: 'ended' };
          }

          return meeting;
        }),
      );

      setWaitingClients((prev) => {
        const activeNames = meetings
          .filter((meeting) => meeting.status === 'starting' || meeting.status === 'active')
          .map((meeting) => meeting.clientName)
          .filter((name): name is string => Boolean(name));

        const union = new Set([...prev, ...activeNames]);
        return Array.from(union).slice(0, 5);
      });
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [profession, notify, meetings]);

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    const filtered = meetings
      .filter((meeting) => new Date(meeting.endTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return compact ? filtered.slice(0, 3) : filtered;
  }, [compact, meetings]);

  const activeMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.status === 'starting' || meeting.status === 'active'),
    [meetings],
  );

  const createMeeting = (): void => {
    if (!form.title || !form.date || !form.time || !form.clientEmail) {
      return;
    }

    const start = new Date(`${form.date}T${form.time}:00`);
    const end = new Date(start.getTime() + form.duration * 60000);
    const meeting: Meeting = {
      id: `meet-${Date.now()}`,
      title: form.title,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      meetLink: `https://meet.google.com/${Math.random().toString(36).slice(2, 12)}`,
      attendees: [form.clientEmail],
      status: start > new Date() ? 'upcoming' : 'starting',
      clientName: form.clientEmail,
      projectId: currentProject,
      type: form.type,
    };

    setMeetings((prev) => [meeting, ...prev]);
    setForm(initialMeetingForm);
    setCreateDialogOpen(false);

    notify({
      type: 'google_meet_created',
      title: 'Møte opprettet',
      message: `${meeting.title} er opprettet`,
      metadata: { meetingId: meeting.id, meetLink: meeting.meetLink },
    });
  };

  const joinMeeting = (meeting: Meeting): void => {
    setWaitingClients((prev) => prev.filter((name) => name !== meeting.clientName));

    setMeetings((prev) =>
      prev.map((item) => (item.id === meeting.id ? { ...item, status: 'active' } : item)),
    );

    window.open(meeting.meetLink, '_blank', 'noopener,noreferrer');

    notify({
      type: 'google_meet_joined',
      title: 'Møte åpnet',
      message: `Du deltok i ${meeting.title}`,
      metadata: { meetingId: meeting.id, meetLink: meeting.meetLink },
    });
  };

  return (
    <Box sx={{ width: '100%', p: compact ? 1 : 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant={compact ? 'h6' : 'h5'} sx={{ color: theming.colors.primary }}>
            Google Meet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getProfessionDisplayName(profession)} workspace
          </Typography>
        </Box>

        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
          Nytt møte
        </Button>
      </Box>

      {loading && <CircularProgress size={24} />}

      {waitingClients.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
          Klienter som venter: {waitingClients.join(', ')}
        </Alert>
      )}

      {activeMeetings.length > 0 && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckIcon />}>
          {activeMeetings.length} aktiv(e) møte(r)
        </Alert>
      )}

      <GridList meetings={upcomingMeetings} onJoin={joinMeeting} onSelect={setSelectedMeeting} />

      {!compact && (
        <Box mt={2}>
          <SmartMeetingPreparation
            profession={profession}
            upcomingMeetings={upcomingMeetings}
            activeMeeting={selectedMeeting}
          />
        </Box>
      )}

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett Google Meet</DialogTitle>
        <DialogContent>
          <TextField
            margin="normal"
            fullWidth
            label="Møtetittel"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <GridContainer>
            <TextField
              margin="normal"
              label="Dato"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
            <TextField
              margin="normal"
              label="Tid"
              type="time"
              InputLabelProps={{ shrink: true }}
              value={form.time}
              onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
            />
          </GridContainer>
          <GridContainer>
            <TextField
              margin="normal"
              label="Varighet (min)"
              type="number"
              value={form.duration}
              onChange={(event) => setForm((prev) => ({ ...prev, duration: Number(event.target.value) || 60 }))}
            />
            <FormControl margin="normal" fullWidth>
              <InputLabel id="meeting-type-label">Type</InputLabel>
              <Select
                labelId="meeting-type-label"
                label="Type"
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, type: event.target.value as Meeting['type'] }))
                }
              >
                <MenuItem value="consultation">Consultation</MenuItem>
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="review">Review</MenuItem>
                <MenuItem value="delivery">Delivery</MenuItem>
                <MenuItem value="collaboration">Collaboration</MenuItem>
              </Select>
            </FormControl>
          </GridContainer>
          <TextField
            margin="normal"
            fullWidth
            label="Klient e-post"
            type="email"
            value={form.clientEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, clientEmail: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={createMeeting}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface GridListProps {
  meetings: Meeting[];
  onJoin: (meeting: Meeting) => void;
  onSelect: (meeting: Meeting) => void;
}

function GridList({ meetings, onJoin, onSelect }: GridListProps): JSX.Element {
  if (meetings.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Ingen møter planlagt.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <List>
      {meetings.map((meeting) => (
        <Card key={meeting.id} sx={{ mb: 1 }}>
          <CardContent>
            <ListItem
              secondaryAction={
                <Button variant="contained" startIcon={<LaunchIcon />} onClick={() => onJoin(meeting)}>
                  Bli med
                </Button>
              }
              onClick={() => onSelect(meeting)}
              sx={{ cursor: 'pointer' }}
            >
              <ListItemIcon>
                <Badge color={meeting.status === 'active' ? 'success' : 'warning'} variant="dot">
                  <Avatar>
                    <MeetIcon />
                  </Avatar>
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={meeting.title}
                secondary={
                  <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                    <Chip size="small" color={statusColor(meeting.status)} label={meeting.status} />
                    <Chip size="small" icon={<CalendarIcon />} label={new Date(meeting.startTime).toLocaleDateString('no-NO')} />
                    <Chip size="small" icon={<ScheduleIcon />} label={new Date(meeting.startTime).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })} />
                    <Chip size="small" icon={<GroupIcon />} label={`${meeting.attendees.length} deltaker(e)`} />
                    {meeting.clientName && <Chip size="small" icon={<PersonIcon />} label={meeting.clientName} />}
                    <IconButton size="small" aria-label="notifications">
                      <NotificationIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              />
            </ListItem>
          </CardContent>
        </Card>
      ))}
    </List>
  );
}

function GridContainer({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      {children}
    </Box>
  );
}
