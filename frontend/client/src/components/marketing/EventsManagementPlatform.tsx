import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemIcon,
  IconButton,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Rating,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  FormGroup,
  Checkbox,
  Radio,
  RadioGroup,
  FormLabel,
  TextareaAutosize,
} from '@mui/material';
import {
  Event,
  Analytics,
  Campaign,
  PeopleAlt,
  TrendingUp,
  AttachMoney,
  Schedule,
  LocationOn,
  Visibility,
  ThumbUp,
  Share,
  Comment,
  GetApp,
  Upload,
  Assessment,
  BarChart,
  ShowChart,
  Timeline as TimelineIcon,
  AccountCircle,
  DirectionsBusiness,
  Language,
  Search,
  FilterList,
  Add,
  Edit,
  Delete,
  Launch,
  CheckCircle,
  Warning,
  Info,
  Assignment,
  Star,
  Speed,
  Psychology,
  Rocket,
  AutoGraph,
  LeaderboardOutlined,
  AssignmentTurnedIn,
  BusinessCenter,
  MonetizationOn,
  TrendingUpOutlined,
  AccountTree,
  Insights,
  AutoAwesome,
  MemoryOutlined,
  TuneOutlined,
  DashboardCustomizeOutlined,
  ConnectWithoutContactOutlined,
  HubOutlined,
  SchemaOutlined,
  ApiOutlined,
  DataObjectOutlined,
  FunctionsOutlined,
  RuleOutlined,
  FlowSheetOutlined,
  CalendarToday,
  Group,
  Public,
  PersonAdd,
  Person,
  Email,
  Phone,
  WhatsApp,
  LinkedIn,
  Facebook,
  Instagram,
  YouTube,
  Twitter,
  Map,
  QrCode,
  CameraAlt,
  Videocam,
  Mic,
  Speaker,
  Wifi,
  Security,
  LocalParking,
  Restaurant,
  Hotel,
  Flight,
  Train,
  DirectionsCar,
  EmojiEvents,
  Celebration,
  ExpandMore,
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  CloudDownload,
  CloudUpload,
  Print,
  Save,
  Settings,
  NotificationsActive,
  Timer,
  EventNote,
  CallMade,
  CallReceived,
  History,
  TrendingFlat,
  Autorenew,
  SmartToy,
  DeviceHub,
  FlowChart,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import UniversalCRMDashboard from '../crm/UniversalCRMDashboard';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import EventTimelineEditor from '../timeline/EventTimelineEditor';
import useGoogleSSO from '../../hooks/useGoogleSSO';

interface EventGoal {
  id: string;
  title: string;
  description: string;
  type: 'awareness' | 'conversion' | 'engagement' | 'revenue' | 'registration';
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  status: 'on-track' | 'at-risk' | 'behind' | 'completed'
}

interface EventMetrics {
  reach: {
    totalReach: number;
    organicReach: number;
    paidReach: number;
    socialReach: number;
    emailReach: number;
};
  engagement: {
    totalEngagements: number;
    likes: number;
    shares: number;
    comments: number;
    clickThroughs: number;
    engagementRate: number;
};
  acquisition: {
    social: number;
    direct: number;
    organicSearch: number;
    referral: number;
    email: number;
    paid: number;
};
  conversion: {
    registrations: number;
    attendees: number;
    noShows: number;
    conversions: number;
    conversionRate: number;
};
  financial: {
    revenue: number;
    costs: number;
    profit: number;
    roi: number;
    ticketsSold: number;
    averageTicketPrice: number;
};
  seo: {
    totalImpressions: number;
    totalClicks: number;
    averageCTR: number;
    averagePosition: number;
    topKeywords: Array<{
      keyword: string;
      position: number;
      clicks: number;
      impressions: number;
}>;
};
}

interface EventPlan {
  id: string;
  name: string;
  description: string;
  type: 'conference' | 'workshop' | 'networking' | 'exhibition' | 'launch' | 'webinar' | 'hybrid';
  status: 'planning' | 'promotion' | 'live' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  venue: {
    name: string;
    address: string;
    city: string;
    country: string;
    capacity: number;
    type: 'physical' | 'virtual' | 'hybrid';
};
  target: {
    audience: 'B2C' | 'B2B' | 'Mixed';
    segments: string[];
    expectedAttendees: number;
    geography: string[];
};
  goals: EventGoal[];
  budget: {
    total: number;
    marketing: number;
    venue: number;
    catering: number;
    technology: number;
    speakers: number;
    misc: number;
};
  timeline: Array<{
    id: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    status: 'pending' | 'in-progress' | 'completed' | 'delayed';
    assignee: string;
    dependencies: string[];
}>;
  risks: Array<{
    id: string;
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
    contingency: string;
    owner: string;
}>;
  emergencyPlan: {
    contacts: Array<{
      name: string;
      role: string;
      phone: string;
      email: string;
}>;
    procedures: Array<{
      scenario: string;
      actions: string[];
      responsible: string;
}>;
};
  metrics: EventMetrics;
  customerJourney: Array<{
    stage: string;
    touchpoints: string[];
    emotions: string[];
    opportunities: string[];
    pain_points: string[];
}>;
  createdAt: string;
  updatedAt: string
}

interface NorwegianMediaInsight {
  source: string;
  reach: number;
  demographic: string;
  relevance: number;
  cost: number;
  recommendations: string[]
}

interface Sponsor {
  id: string;
  name: string;
  email: string;
  company?: string;
  logoUrl?: string;
  companyWebsite?: string;
  amount?: number;
  currency?: 'NOK' | 'USD' | 'EUR';
  level?: 'Gold' | 'Silver' | 'Bronze' | 'Partner';
  benefits?: string[];
  status?: 'prospect' | 'negotiating' | 'confirmed' | 'paid';
  notes?: string;
  googleContactId?: string;
  crmCustomerId?: string;
}

const EventsManagementPlatform: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Toast notifications
  const { addToast } = useVisualEditor();
  const [events, setEvents] = useState<EventPlan[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventPlan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'event' | 'goal' | 'risk' | 'timeline'>('event');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all,');
  const [filterType, setFilterType] = useState('all');
  const [mediaInsights, setMediaInsights] = useState<NorwegianMediaInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  // CRM integration links
  const [eventProjectLinks, setEventProjectLinks] = useState<Record<string, any>>({});
  const [eventMeetingLinks, setEventMeetingLinks] = useState<Record<string, any[]>>({});
  const [eventCustomerLinks, setEventCustomerLinks] = useState<Record<string, any[]>>({});
  // Google Calendar links per event
  const [eventCalendarLinks, setEventCalendarLinks] = useState<Record<string, { eventId: string; htmlLink?: string }>>({});
  // Load persisted links on event select
  useEffect(() => {
    const loadPersisted = async () => {
      if (!selectedEvent?.id) return;
      const eid = String(selectedEvent.id);
      try {
        // Sponsors
        const sp = await fetch(`/api/events-management/events/${encodeURIComponent(eid)}/sponsors`);
        if (sp.ok) {
          const j = await sp.json();
          setEventSponsorships((prev) => ({ ...prev, [eid]: j.data || [] }));
        }
      } catch {}
      try {
        // Relations
        const rl = await fetch(`/api/events-management/events/${encodeURIComponent(eid)}/relations`);
        if (rl.ok) {
          const j = await rl.json();
          const links = (j.data || []).map((r: any) => ({ name: r.contact_name, email: r.contact_email, role: r.role, notes: r.notes }));
          setEventCustomerLinks((prev) => ({ ...prev, [eid]: links }));
        }
      } catch {}
      try {
        // Meetings
        const mt = await fetch(`/api/events-management/events/${encodeURIComponent(eid)}/meetings`);
        if (mt.ok) {
          const j = await mt.json();
          setEventMeetingLinks((prev) => ({ ...prev, [eid]: j.data || [] }));
        }
      } catch {}
      try {
        // Calendar link
        const cl = await fetch(`/api/events-management/events/${encodeURIComponent(eid)}/calendar-link`);
        if (cl.ok) {
          const j = await cl.json();
          if (j.data?.calendar_event_id) {
            setEventCalendarLinks((prev) => ({ ...prev, [eid]: { eventId: j.data.calendar_event_id, htmlLink: j.data.html_link } }));
          }
        }
      } catch {}
      try {
        // Project links
        const pl = await fetch(`/api/events-management/events/${encodeURIComponent(eid)}/project-link`);
        if (pl.ok) {
          const j = await pl.json();
          const latest = (j.data || [])[0];
          if (latest) setEventProjectLinks((prev) => ({ ...prev, [eid]: { id: latest.project_id, projectName: latest.project_name } }));
        }
      } catch {}
    };
    loadPersisted();
  }, [selectedEvent?.id]);
  // Timeline dialog state
  const [eventCalendarLinks, setEventCalendarLinks] = useState<Record<string, { eventId: string; htmlLink?: string }>>({});
  // Timeline dialog state
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [timelineEvent, setTimelineEvent] = useState<EventPlan | null>(null);

  // Project creation bridge
  const [showProjectCreator, setShowProjectCreator] = useState(false);
  const [selectedProjectType, setSelectedProjectType] = useState<string>('event');
  const [selectedClientEmail, setSelectedClientEmail] = useState<string>('');

  const mapEventToProfession = (ev: EventPlan | null | undefined): string | undefined => {
    if (!ev) return undefined;
    const audience = ev.target?.audience;
    const type = ev.type;
    if (audience === 'B2B') return 'vendor';
    if (type === 'webinar' || type === 'workshop') return 'videographer';
    if (type === 'launch' || type === 'exhibition') return audience === 'Mixed' ? 'vendor' : 'photographer';
    return 'photographer';
  };

  const mappedProfession = useMemo(() => mapEventToProfession(selectedEvent), [selectedEvent]);

  const mapEventToProjectType = (ev: EventPlan | null | undefined, profession?: string): string => {
    if (!ev) return 'event';
    const t = ev.type;
    if (profession === 'vendor' || ev.target?.audience === 'B2B') return 'commercial';
    if (t === 'webinar' || t === 'workshop') return 'video';
    if (t === 'launch' || t === 'exhibition') return 'commercial';
    return 'event';
  };

  // Fetch demo mode status to determine whether to show simulated data or empty system
  const { data: demoModeData, isLoading: demoModeLoading } = useQuery({
    queryKey: ['/api/settings/demo-mode'],
    queryFn: async () => {
      const response = await fetch('/api/settings/demo-mode');
      if (!response.ok) throw new Error('Failed to fetch demo mode status');
      return response.json();
    },
  });

  const isDemoMode = demoModeData?.demoMode || false;

  // Google SSO (for calendar routes requiring userEmail)
  const googleSSO = useGoogleSSO();
  const queryClient = useQueryClient();

  const getDomainFromWebsite = (web?: string) => {
    const w = (web || '').trim();
    if (!w) return '';
    try { return new URL(w).hostname; } catch {}
    try { return new URL(`https://${w}`).hostname; } catch {}
    return '';
  };


  // Load data on component mount and when demo mode changes
  useEffect(() => {
    if (!demoModeLoading) {
      loadEventsData();
    }
  }, [isDemoMode, demoModeLoading]);

  const loadEventsData = async () => {
    setLoading(true);
    try {
      // Fetch data from backend API (works for both demo and production modes)
      const [eventsRes, mediaRes] = await Promise.all([
        fetch('/api/events-management/events'),
        fetch('/api/events-management/media-insights'),
      ]);

      const [eventsData, mediaData] = await Promise.all([eventsRes.json(), mediaRes.json()]);

      // Set data from API response
      setEvents(eventsData.data || []);
      setMediaInsights(mediaData.data || []);
      
    } catch (error) {
      console.error('Error loading events data: ', error);
      
      // On error, fall back to empty state (no localStorage usage)
      setEvents([]);
      setMediaInsights([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (eventData: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/events-management/events', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        await loadEventsData();
        setDialogOpen(false);
        addToast({
          message: 'Event opprettet vellykket!',
          type: 'success',
          duration: 3000
        });
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Kunne ikke opprette event');
      addToast({
        message: 'Feil ved opprettelse av event',
        type: 'error',
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvent = async (eventId: string, eventData: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events-management/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        await loadEventsData();
        setDialogOpen(false);
        addToast({
          message: 'Event oppdatert!',
          type: 'success',
          duration: 3000
        });
      } else {
        throw new Error('Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      setError('Kunne ikke oppdatere event');
      addToast({
        message: 'Feil ved oppdatering av event',
        type: 'error',
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette eventet?')) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events-management/events/${eventId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadEventsData();
        addToast({
          message: 'Event slettet',
          type: 'info',
          duration: 3000
        });
      } else {
        throw new Error('Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Kunne ikke slette event');
      addToast({
        message: 'Feil ved sletting av event',
        type: 'error',
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportEvents = () => {
    const csv = [
      ['Name','Type','Status','Start Date','End Date','Expected Attendees','Registrations'],
      ...filteredEvents.map(e => [
        e.name,
        e.type,
        e.status,
        new Date(e.startDate).toLocaleDateString('no-NO'),
        new Date(e.endDate).toLocaleDateString('no-NO'),
        e.target.expectedAttendees,
        e.metrics.conversion.registrations
      ])
    ].map(row => row.join('')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    addToast({
      message: `${filteredEvents.length} events eksportert til CSV!`,
      type: 'success',
      duration: 3000
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'live':
        return 'primary';
      case 'promotion':
        return 'info';
      case 'planning':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Add selected event to Google Calendar
  const handleAddToGoogleCalendar = async (ev: EventPlan) => {
    try {
      const userEmail = googleSSO.user?.email;
      if (!userEmail) {
        await googleSSO.signIn?.();
      }
      const attendees = (eventCustomerLinks[ev.id] || [])
        .filter((c: any) => !!c.email)
        .map((c: any) => ({ email: c.email }));

      const hasTime = (s: string) => s && s.includes('T');
      const toISO = (dateStr: string, defaultTime: string) => {
        if (!dateStr) return new Date().toISOString();
        if (hasTime(dateStr)) return new Date(dateStr).toISOString();
        return new Date(`${dateStr}T${defaultTime}:00`).toISOString();
      };

      const startISO = toISO(ev.startDate'09:00');
      const endISO = toISO(ev.endDate || ev.startDate'10:00');

      const locationParts = [ev.venue?.name, ev.venue?.address, ev.venue?.city].filter(Boolean);
      const body = {
        userEmail: googleSSO.user?.email,
        summary: ev.name,
        description: ev.description,
        start: { dateTime: startISO, timeZone: 'Europe/Oslo' },
        end: { dateTime: endISO, timeZone: 'Europe/Oslo' },
        location: locationParts.join(''),
        attendees,
        calendarId: 'primary',
      };

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create calendar event');
      const data = await res.json();
      const created = data.data || {};
      setEventCalendarLinks((prev) => ({ ...prev, [ev.id]: { eventId: created.id, htmlLink: created.htmlLink } }));
      try {
        await fetch(`/api/events-management/events/${encodeURIComponent(String(ev.id))}/calendar-link`, {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({ calendarEventId: created.id, htmlLink: created.htmlLink, calendarId: 'primary' })
        });
      } catch {}
      addToast({ message: 'Lagt til i Google Kalender', type: 'success', duration: 3000 });
    } catch (e) {
      addToast({ message: 'Kunne ikke legge til i Google Kalender', type: 'error', duration: 4000 });
    }
  };

  const getGoalStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'on-track':
        return 'success';
      case 'at-risk':
        return 'warning';
      case 'behind':
        return 'error';
      default:
        return 'default';
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus;
    const matchesType = filterType === 'all' || event.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const renderEventsOverview = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ color: theming.colors.primary }}>Event Oversikt</Typography>
        <Button
          variant="contained"
          startIcon={<Event />}
          onClick={() => {
            setDialogType('event');
            setDialogOpen(true);
          }}
          sx={theming.getThemedButtonSx()}
        >
          Nytt Event
        </Button>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {events.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Totale Events
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {events.filter((e) => e.status === 'live').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Live Events
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {Math.round(
                  events.reduce((sum, e) => sum + e.target.expectedAttendees, 0) / events.length,
                ) || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Snitt Deltakere
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {Math.round(
                  events.reduce((sum, e) => sum + (e.metrics.conversion.conversionRate || 0), 0) /
                    events.length,
                ) || 0}
                %
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Snitt Konvertering
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                kr{' '}
                {Math.round(
                  events.reduce((sum, e) => sum + (e.metrics.financial.roi || 0), 0) /
                    events.length,
                ) || 0}
                %
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Snitt ROI
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Section */}
      <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Søk events"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Navn eller beskrivelse"
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />}}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="planning">Planlegging</MenuItem>
                <MenuItem value="promotion">Promotering</MenuItem>
                <MenuItem value="live">Live</MenuItem>
                <MenuItem value="completed">Fullført</MenuItem>
                <MenuItem value="cancelled">Avlyst</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">Alle</MenuItem>
                <MenuItem value="conference">Konferanse</MenuItem>
                <MenuItem value="workshop">Workshop</MenuItem>
                <MenuItem value="networking">Networking</MenuItem>
                <MenuItem value="exhibition">Utstilling</MenuItem>
                <MenuItem value="launch">Lansering</MenuItem>
                <MenuItem value="webinar">Webinar</MenuItem>
                <MenuItem value="hybrid">Hybrid</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<CloudDownload />}
              onClick={handleExportEvents}
            >
              Eksporter
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Events Grid */}
      <Grid container spacing={3}>
        {filteredEvents.map((event) => (
          <Grid item xs={12} md={6} lg={4} key={event.id}>
            <Card sx={{ height: '100%', ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {event.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2, minHeight: 40 }}
                    >
                      {event.description}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Chip label={event.status} color={getStatusColor(event.status)} size="small" />
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <Event />
                  <Typography variant="body2" color="text.secondary">
                    {new Date(event.startDate).toLocaleDateString('no-NO')} -{', '}
                    {new Date(event.endDate).toLocaleDateString('no-NO')}
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {theming.getThemedIcon('location')}
                  <Typography variant="body2" color="text.secondary">
                    {event.venue.name}, {event.venue.city}
                  </Typography>
                </Box>

                <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
                  <Chip label={event.type} size="small" variant="outlined" />
                  <Chip
                    label={event.target.audience}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                  <Chip label={event.venue.type} size="small" color="primary" variant="outlined" />
                </Box>

                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Mål Status
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {event.goals.slice(0, 3).map((goal) => (
                      <Chip
                        key={goal.id}
                        label={`${goal.title}: ${((goal.currentValue / goal.targetValue) * 100).toFixed(0)}%`}
                        size="small"
                        color={getGoalStatusColor(goal.status)}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>

                <Box display="flex" justifyContent="space-between" mb={2}>
                  <Box textAlign="center">
                    <Typography variant="h6" fontSize="1rem" sx={{ color: theming.colors.primary }}>
                      {event.target.expectedAttendees}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Forventet
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" fontSize="1rem" sx={{ color: theming.colors.primary }}>
                      {event.metrics.conversion.registrations}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Registrert
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" fontSize="1rem" color="success.main" sx={{ color: theming.colors.primary }}>
                      {event.metrics.conversion.conversionRate.toFixed(1)}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Konvertering
                    </Typography>
                  </Box>
                  <Box textAlign="center">
                    <Typography variant="h6" fontSize="1rem" color="primary.main" sx={{ color: theming.colors.primary }}>
                      kr {(event.metrics.financial.revenue / 1000).toFixed(0)}k
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Inntekt
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Sist oppdatert: {new Date(event.updatedAt).toLocaleDateString('')}
                </Typography>
              </CardContent>

              <CardActions sx={theming.getThemedCardSx()}>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => setSelectedEvent(event)}
                >
                  Se Detaljer
                </Button>
                <Button
                  size="small"
                  startIcon={<Edit />}
                  onClick={() => {
                    setSelectedEvent(event);
                    setDialogType('event');
                    setDialogOpen(true);
                  }}
                >
                  Rediger
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setTimelineEvent(event);
                    setTimelineDialogOpen(true);
                  }}
                >
                  Timeline
                </Button>
                {eventCalendarLinks[event.id]?.eventId ? (
                  <Button
                    size="small"
                    startIcon={<Launch />}
                    onClick={() => {
                      const link = eventCalendarLinks[event.id]?.htmlLink;
                      if (link) window.open(link, '_blank');
                    }}
                  >
                    Åpne i Kalender
                  </Button>
                ) : (
                  <Button
                    size="small"
                    startIcon={<CalendarToday />}
                    onClick={() => handleAddToGoogleCalendar(event)}
                  >
                    Legg til i Google Kalender
                  </Button>
                )}
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => handleDeleteEvent(event.id)}
                >
                  Slett
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
);

  const fetchSSBInsights = async () => {
    try {
      const response = await fetch('/api/events-management/media-insights-ssb?includeSSB=true');
      const data = await response.json();
      if (data.success) {
        setMediaInsights(data.data);
      }
    } catch (error) {
      console.error('Error fetching SSB insights:', error);
    }
  };

  const renderMarketingScreen = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
            Marketing & Promovering - SSB Integrert
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Statistisk sentralbyrå (SSB) offisielle norske statistikker integrert med alle
            markedsføringskomponenter
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={fetchSSBInsights} size="small">
          Oppdater SSB Data
        </Button>
      </Box>

      {/* SSB Enhanced Campaign Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {events.reduce((sum, e) => sum + e.metrics.reach.totalReach, 0).toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total SSB Reach
              </Typography>
              <Typography variant="caption" color="success.main">
                +15% med SSB targeting
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {events
                  .reduce((sum, e) => sum + e.metrics.engagement.totalEngagements, 0)
                  .toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Engagements
              </Typography>
              <Typography variant="caption" color="info.main">
                83% avg effectiveness
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {Math.round(
                  events.reduce((sum, e) => sum + e.metrics.engagement.engagementRate, 0) /
                    events.length,
                ) || 0}
                %
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Engagement Rate
              </Typography>
              <Typography variant="caption" color="warning.main">
                Mobil: 68%+ dominans
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {events
                  .reduce((sum, e) => sum + e.metrics.conversion.registrations, 0)
                  .toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registreringer
              </Typography>
              <Typography variant="caption" color="error.main">
                Oslo: 48% B2B marked
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2.4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                8/8
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Komponenter Aktive
              </Typography>
              <Typography variant="caption" color="success.main">
                SSB validert
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Marketing Components Integration Dashboard */}
      <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Integrerte Marketing Komponenter (SSB-drevet)
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            {/* Component Status Grid */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Instagram color="secondary" />
                    <Box>
                      <Typography variant="subtitle2">Social Media Management</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Instagram Norge: 94.2% mobil, 52.7 min/dag (SSB)
                      </Typography>
                    </Box>
                    <Chip label="Aktiv" color="success" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={87} color="success" sx={{ mb: 1 }} />
                  <Typography variant="caption">87% SSB effectiveness</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Assignment color="primary" />
                    <Box>
                      <Typography variant="subtitle2">Content Marketing Hub</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Høst optimal: 115-125% aktivitet (SSB sesongmønster)
                      </Typography>
                    </Box>
                    <Chip label="SSB Synkronisert" color="info" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={94} color="info" sx={{ mb: 1 }} />
                  <Typography variant="caption">94% timing optimization</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <CallMade color="warning" />
                    <Box>
                      <Typography variant="subtitle2">Lead Generation System</Typography>
                      <Typography variant="caption" color="text.secondary">
                        LinkedIn Norge: 60% høy inntekt, 69.2% høyere utdanning
                      </Typography>
                    </Box>
                    <Chip label="Optimalisert" color="warning" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={91} color="warning" sx={{ mb: 1 }} />
                  <Typography variant="caption">91% demographic targeting</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <PeopleAlt color="error" />
                    <Box>
                      <Typography variant="subtitle2">Influencer Partnership</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kreative: 45.8% Instagram 16-24 år (SSB demografikk)
                      </Typography>
                    </Box>
                    <Chip label="Demografikk Integrert" color="error" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={79} color="error" sx={{ mb: 1 }} />
                  <Typography variant="caption">79% audience match</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Email color="secondary" />
                    <Box>
                      <Typography variant="subtitle2">Email Marketing</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Aftenposten: 24.8 min/dag, 38.7% desktop (SSB)
                      </Typography>
                    </Box>
                    <Chip label="Segmentert" color="secondary" size="small" />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={81}
                    color="secondary"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption">81% email effectiveness</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Search color="success" />
                    <Box>
                      <Typography variant="subtitle2">SEO Analytics</Typography>
                      <Typography variant="caption" color="text.secondary">
                        154,500 impressions, 4.35% CTR (Google + SSB)
                      </Typography>
                    </Box>
                    <Chip label="Søkeord Optimalisert" color="success" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={88} color="success" sx={{ mb: 1 }} />
                  <Typography variant="caption">88% search optimization</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Campaign color="info" />
                    <Box>
                      <Typography variant="subtitle2">Digital Advertising</Typography>
                      <Typography variant="caption" color="text.secondary">
                        NRK: 60.2% distrikt-reach, 18.5% tablet (SSB)
                      </Typography>
                    </Box>
                    <Chip label="Targeting Forbedret" color="info" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={73} color="info" sx={{ mb: 1 }} />
                  <Typography variant="caption">73% geo-targeting accuracy</Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Autorenew color="primary" />
                    <Box>
                      <Typography variant="subtitle2">Marketing Automation</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Workflow: Sesongbasert triggere fra SSB data
                      </Typography>
                    </Box>
                    <Chip label="Workflow Aktiv" color="primary" size="small" />
                  </Box>
                  <LinearProgress variant="determinate" value={92} color="primary" sx={{ mb: 1 }} />
                  <Typography variant="caption">92% automation efficiency</Typography>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} lg={4}>
            {/* SSB Key Insights */}
            <Card
              sx={{
                p: 3,
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                ...theming.getThemedCardSx()
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                SSB Hovedinnsikter for Marketing
              </Typography>
              <Box sx={{ '& > *': { mb: 2 } }}>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {theming.getThemedIcon('trendingUp')}
                  <Typography variant="body2">
                    Høsten optimal for alle kanaler (115-125% aktivitet)
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  <PeopleAlt />
                  <Typography variant="body2">Mobil-first kritisk (68%+ bruker mobil)</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {theming.getThemedIcon('location')}
                  <Typography variant="body2">Oslo/Bergen dominerer B2B (60% kombinert)</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {theming.getThemedIcon('business')}
                  <Typography variant="body2">
                    LinkedIn effektivt for høy utdanning (69.2%)
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {theming.getThemedIcon('speed')}
                  <Typography variant="body2">Instagram når unge voksne best (84%)</Typography>
                </Box>

                <Divider sx={{ my: 2, bgcolor: 'rgba(25,255,255,0.3)' }} />

                <Box textAlign="center">
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'white' }}>
                    8.2M
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    Total SSB-validert reach
                  </Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* SSB-Enhanced Norwegian Media Insights */}
      <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          SSB-Forbedret Norsk Mediebarometer
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Offisielle norske statistikker fra Statistisk sentralbyrå integrert med alle
          markedsføringskomponenter
        </Typography>
        <Grid container spacing={3}>
          {mediaInsights.map((insight, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card variant="outlined" sx={{ height: '100%', position: 'relative', ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                    <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                      {insight.source}
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      {(insight as any).ssbEnhanced && (
                        <Chip label="SSB" color="info" size="small" />
                      )}
                      <Chip
                        label={`${(insight as any).effectiveness || 85}%`}
                        color="success"
                        size="small"
                      />
                    </Box>
                  </Box>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Reach
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {insight.reach.toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Kostnad
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        kr {insight.cost.toLocaleString()}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Demografikk: </strong> {insight.demographic}
                  </Typography>

                  {/* SSB Data Display */}
                  {(insight as any).ssbData && (
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="caption" color="primary" fontWeight="bold">
                        SSB Innsikter:
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {Object.entries((insight as any).ssbData.deviceUsage || {})
                          .slice(0, 2)
                          .map(([device, percentage]) => (
                            <Box key={device} display="flex" justifyContent="space-between">
                              <Typography variant="caption">{device}:</Typography>
                              <Typography variant="caption" fontWeight="bold">
                                {percentage}%
                              </Typography>
                            </Box>
                          ))}
                      </Box>
                    </Box>
                  )}

                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Anbefalinger:
                    </Typography>
                    {insight.recommendations.slice(0, 3).map((rec, i) => (
                      <Chip
                        key={i}
                        label={rec}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>

                  {/* Component Integration Indicators */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Integrerte komponenter:
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap">
                      <Tooltip title="Social Media Management">
                        <Chip icon={<Instagram />} label="SM" size="small" color="secondary" />
                      </Tooltip>
                      <Tooltip title="Content Marketing Hub">
                        <Chip icon={<Assignment />} label="CM" size="small" color="primary" />
                      </Tooltip>
                      <Tooltip title="Lead Generation">
                        <Chip icon={<CallMade />} label="LG" size="small" color="warning" />
                      </Tooltip>
                      <Tooltip title="Email Marketing">
                        <Chip icon={<Email />} label="EM" size="small" color="info" />
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Cross-Component Marketing Actions */}
      <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Tverrgående Marketing Handlinger
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Instagram />}
              color="secondary"
              onClick={() => window.open('/marketing/social-media','_blank')}
            >
              Social Media Management
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Assignment />}
              color="primary"
              onClick={() => window.open('/marketing/content-hub','_blank')}
            >
              Content Marketing Hub
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<CallMade />}
              color="warning"
              onClick={() => window.open('/marketing/lead-generation','_blank')}
            >
              Lead Generation System
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<PeopleAlt />}
              color="error"
              onClick={() => window.open('/marketing/influencer-partnership','_blank')}
            >
              Influencer Partnership
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Email />}
              onClick={() => window.open('/marketing/email-marketing','_blank')}
            >
              Email Marketing
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Search />}
              onClick={() => window.open('/marketing/seo-analytics','_blank')}
            >
              SEO Analytics
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Campaign />}
              onClick={() => window.open('/marketing/digital-advertising','_blank')}
            >
              Digital Advertising
            </Button>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Autorenew />}
              onClick={() => window.open('/marketing/automation','_blank')}
            >
              Marketing Automation
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* SSB Demographic Analysis */}
      <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          SSB Demografisk Analyse for Event Planning
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                p: 2,
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                ...theming.getThemedCardSx()
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Aldersgruppe Anbefalinger
              </Typography>
              <Typography variant="body2">
                • 16-44 år: Instagram + LinkedIn Norge (84% reach)
              </Typography>
              <Typography variant="body2">• 45+ år: Aftenposten + NRK (59.5% reach)</Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                p: 2,
                bgcolor: 'success.light',
                color: 'success.contrastText',
                ...theming.getThemedCardSx()
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Geografisk Optimalisering
              </Typography>
              <Typography variant="body2">• Oslo/Urban: LinkedIn Norge + Aftenposten</Typography>
              <Typography variant="body2">• Distrikter: NRK + VG (60.2% utenfor byer)</Typography>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                p: 2,
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                ...theming.getThemedCardSx()
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Enhets- & Sesongmønster
              </Typography>
              <Typography variant="body2">• Mobil-first: 68%+ på alle plattformer</Typography>
              <Typography variant="body2">• Høst optimal: 115-125% aktivitet</Typography>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
);

  const renderOperationsScreen = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Operasjoner & Gjennomføring
      </Typography>

      {/* Event Selector for Operations */}
      {events.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
          <FormControl fullWidth>
            <InputLabel>Velg Event for Operasjonell Visning</InputLabel>
            <Select
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const event = events.find(ev => ev.id === e.target.value);
                setSelectedEvent(event || null);
              }}
              label="Velg Event for Operasjonell Visning"
            >
              {events.map(event => (
                <MenuItem key={event.id} value={event.id}>
                  {event.name} - {event.status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      )}

      {!selectedEvent && events.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Velg et event ovenfor for å se detaljert operasjonell informasjon
        </Alert>
      )}

      {selectedEvent && (
        <Grid container spacing={3}>
          {/* Timeline & GANTT View */}
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📅 Tidslinje & Aktivitetsplan
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedEvent.name} - {new Date(selectedEvent.startDate).toLocaleDateString('no-NO')} til {new Date(selectedEvent.endDate).toLocaleDateString('no-NO')}
              </Typography>
              
              {/* Timeline Items */}
              {selectedEvent.timeline && selectedEvent.timeline.length > 0 ? (
                <Box>
                  {selectedEvent.timeline.map((item, index) => {
                    const statusColors = {
                      completed: 'success','in-progress' : 'primary',
                      pending: 'warning',
                      delayed: 'error'
                    };
                    return (
                      <Box key={item.id} sx={{ mb: 3, position: 'relative', pl: 3 }}>
                        {/* Timeline line */}
                        {index < selectedEvent.timeline.length - 1 && (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 8,
                              top: 24,
                              bottom: -24,
                              width: 2,
                              bgcolor: 'grey.300'
                            }}
                          />
                        )}
                        {/* Timeline dot */}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 0,
                            top: 8,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: `${statusColors[item.status] || 'grey'}.main`,
                            border: 2,
                            borderColor: 'background.paper'
                          }}
                        />
                        <Card sx={{ ...theming.getThemedCardSx() }}>
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="start">
                              <Box flex={1}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {item.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {item.description}
                                </Typography>
                                <Box display="flex" gap={1} flexWrap="wrap">
                                  <Chip
                                    label={item.status}
                                    color={statusColors[item.status] as any}
                                    size="small"
                                  />
                                  <Chip
                                    icon={<Person />}
                                    label={item.assignee}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Chip
                                    icon={<CalendarToday />}
                                    label={`${new Date(item.startDate).toLocaleDateString('no-NO')} - ${new Date(item.endDate).toLocaleDateString('no-NO')}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                </Box>
                              </Box>
                            </Box>
                            {item.dependencies && item.dependencies.length > 0 && (
                              <Box mt={1}>
                                <Typography variant="caption" color="text.secondary">
                                  Avhenger av: {item.dependencies.join('')}
                                </Typography>
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Alert severity="info">Ingen tidslinjedata tilgjengelig for dette eventet</Alert>
              )}
            </Paper>
          </Grid>

          {/* Risk Analysis & Emergency Plans */}
          <Grid item xs={12} lg={4}>
            {/* Risk Analysis */}
            <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                ⚠️ ROS-Analyse
              </Typography>
              {selectedEvent.risks && selectedEvent.risks.length > 0 ? (
                <Box>
                  {selectedEvent.risks.map((risk) => {
                    const riskLevel = risk.probability === 'high' && risk.impact === 'high' ? 'error' :
                                    risk.probability === 'high' || risk.impact === 'high' ? 'warning' : 'info';
                    return (
                      <Card key={risk.id} sx={{ mb: 2, ...theming.getThemedCardSx() }}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {risk.description}
                            </Typography>
                            <Chip
                              label={`${risk.probability}/${risk.impact}`}
                              color={riskLevel as any}
                              size="small"
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            <strong>Sannsynlighet:</strong> {risk.probability}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            <strong>Konsekvens:</strong> {risk.impact}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            <strong>Tiltak:</strong> {risk.mitigation}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                            <strong>Beredskap:</strong> {risk.contingency}
                          </Typography>
                          <Box mt={1}>
                            <Chip
                              icon={<Person />}
                              label={risk.owner}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              ) : (
                <Alert severity="info">Ingen risikoanalyse tilgjengelig</Alert>
              )}
            </Paper>

            {/* Emergency Plan */}
            <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🚨 Beredskapsplan
              </Typography>
              {selectedEvent.emergencyPlan ? (
                <Box>
                  {/* Emergency Contacts */}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Nødkontakter
                  </Typography>
                  {selectedEvent.emergencyPlan.contacts?.map((contact, index) => (
                    <Card key={index} sx={{ mb: 1, p: 1,...theming.getThemedCardSx() }}>
                      <Typography variant="body2" fontWeight="bold">
                        {contact.name} - {contact.role}
                      </Typography>
                      <Typography variant="caption" display="block">
                        📞 {contact.phone}
                      </Typography>
                      <Typography variant="caption" display="block">
                        ✉️ {contact.email}
                      </Typography>
                    </Card>
                  ))}

                  {/* Emergency Procedures */}
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Beredkapsprosedyrer
                  </Typography>
                  {selectedEvent.emergencyPlan.procedures?.map((proc, index) => (
                    <Card key={index} sx={{ mb: 2, p: 2,...theming.getThemedCardSx() }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        {proc.scenario}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Ansvarlig: {proc.responsible}
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, my: 1 }}>
                        {proc.actions?.map((action, i) => (
                          <Typography key={i} component="li" variant="caption" display="list-item">
                            {action}
                          </Typography>
                        ))}
                      </Box>
                    </Card>
                  ))}
                </Box>
              ) : (
                <Alert severity="warning">Ingen beredskapsplan definert</Alert>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {events.length === 0 && (
        <Alert severity="info">
          Ingen events tilgjengelig. Opprett et event for å se operasjonell informasjon.
        </Alert>
      )}
    </Box>
  );

  const renderFinancialScreen = () => {
    // Calculate aggregated financial metrics
    const totalBudget = events.reduce((sum, e) => sum + e.budget.total, 0);
    const totalRevenue = events.reduce((sum, e) => sum + (e.metrics?.financial?.revenue || 0), 0);
    const totalExpenses = events.reduce((sum, e) => sum + (e.metrics?.financial?.expenses || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;
    const avgROI = events.length > 0 ? events.reduce((sum, e) => sum + (e.metrics?.financial?.roi || 0), 0) / events.length : 0;

    return (
      <Box>
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          Finansiell Oversikt
        </Typography>

        {/* Financial Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ ...theming.getThemedCardSx() }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <AttachMoney sx={{ fontSize: 40, color: theming.colors.primary, mb: 1 }} />
                <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                  kr {(totalBudget / 1000).toFixed(0)}k
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Budsjett
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ ...theming.getThemedCardSx() }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUp sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h5" color="success.main">
                  kr {(totalRevenue / 1000).toFixed(0)}k
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Inntekt
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ ...theming.getThemedCardSx() }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingDown sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h5" color="error.main">
                  kr {(totalExpenses / 1000).toFixed(0)}k
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Totale Utgifter
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ ...theming.getThemedCardSx() }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <AccountBalance sx={{ fontSize: 40, color: totalProfit >= 0 ? 'success.main' : 'error.main', mb: 1 }} />
                <Typography variant="h5" color={totalProfit >= 0 ? 'success.main' : 'error.main'}>
                  kr {(totalProfit / 1000).toFixed(0)}k
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Netto Resultat
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* Budget Breakdown by Event */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📊 Budsjett per Event
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Event</TableCell>
                      <TableCell align="right">Budsjett</TableCell>
                      <TableCell align="right">Utgifter</TableCell>
                      <TableCell align="right">Inntekt</TableCell>
                      <TableCell align="right">Resultat</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {events.map((event) => {
                      const expenses = event.metrics?.financial?.expenses || 0;
                      const revenue = event.metrics?.financial?.revenue || 0;
                      const result = revenue - expenses;
                      return (
                        <TableRow key={event.id}>
                          <TableCell>{event.name}</TableCell>
                          <TableCell align="right">kr {(event.budget.total / 1000).toFixed(0)}k</TableCell>
                          <TableCell align="right">kr {(expenses / 1000).toFixed(0)}k</TableCell>
                          <TableCell align="right">kr {(revenue / 1000).toFixed(0)}k</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={result >= 0 ? 'success.main' : 'error.main'}
                              fontWeight="bold"
                            >
                              kr {(result / 1000).toFixed(0)}k
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* ROI Analysis */}
          <Grid item xs={12} lg={6}>
            <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                💰 ROI-Analyse
              </Typography>
              <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h3" sx={{ color: avgROI >= 0 ? 'success.main' : 'error.main' }}>
                  {avgROI.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gjennomsnittlig ROI på tvers av alle events
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box>
                {events.map((event) => {
                  const roi = event.metrics?.financial?.roi || 0;
                  return (
                    <Box key={event.id} sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="body2">{event.name}</Typography>
                        <Chip
                          label={`${roi.toFixed(0)}%`}
                          color={roi >= 100 ? 'success' : roi >= 50 ? 'warning' : 'error'}
                          size="small"
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(roi, 100)}
                        color={roi >= 100 ? 'success' : roi >= 50 ? 'warning' : 'error'}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Paper>

            {/* Profitability Status */}
            <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                🎯 Lønnsomhetsstatus
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center" p={2}>
                    <Typography variant="h4" color="success.main">
                      {events.filter(e => (e.metrics?.financial?.roi || 0) > 0).length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Lønnsomme Events
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={2}>
                    <Typography variant="h4" color="error.main">
                      {events.filter(e => (e.metrics?.financial?.roi || 0) <= 0).length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tap/Break-even
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Budget Category Breakdown */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📋 Budsjettfordeling per Kategori
              </Typography>
              <Grid container spacing={3}>
                {events.length > 0 && (() => {
                  // Aggregate budget categories across all events
                  const totalMarketing = events.reduce((sum, e) => sum + (e.budget?.marketing || 0), 0);
                  const totalVenue = events.reduce((sum, e) => sum + (e.budget?.venue || 0), 0);
                  const totalCatering = events.reduce((sum, e) => sum + (e.budget?.catering || 0), 0);
                  const totalTechnology = events.reduce((sum, e) => sum + (e.budget?.technology || 0), 0);
                  const totalSpeakers = events.reduce((sum, e) => sum + (e.budget?.speakers || 0), 0);
                  const totalMisc = events.reduce((sum, e) => sum + (e.budget?.misc || 0), 0);

                  const categories = [
                    { name: 'Marketing', amount: totalMarketing, icon: <Campaign />, color: 'primary' },
                    { name: 'Venue', amount: totalVenue, icon: <LocationCity />, color: 'secondary' },
                    { name: 'Catering', amount: totalCatering, icon: <Restaurant />, color: 'success' },
                    { name: 'Technology', amount: totalTechnology, icon: <Computer />, color: 'info' },
                    { name: 'Speakers', amount: totalSpeakers, icon: <Person />, color: 'warning' },
                    { name: 'Diverse', amount: totalMisc, icon: <MoreHoriz />, color: 'default' },
                  ];

                  const totalCategorized = categories.reduce((sum, cat) => sum + cat.amount, 0);

                  return categories.map((category) => {
                    const percentage = totalCategorized > 0 ? (category.amount / totalCategorized) * 100 : 0;
                    return (
                      <Grid item xs={12} sm={6} md={4} key={category.name}>
                        <Card sx={{ ...theming.getThemedCardSx() }}>
                          <CardContent>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                              {category.icon}
                              <Typography variant="subtitle2">{category.name}</Typography>
                            </Box>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              kr {(category.amount / 1000).toFixed(0)}k
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={percentage}
                              color={category.color as any}
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {percentage.toFixed(1)}% av total
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  });
                })()}
              </Grid>
            </Paper>
          </Grid>
        </Grid>

        {events.length === 0 && (
          <Alert severity="info">
            Ingen events tilgjengelig. Opprett et event for å se finansiell informasjon.
          </Alert>
        )}
      </Box>
    );
  };

  // Sponsorship handlers
  const addSponsor = async (eventId: string, sponsor: Sponsor) => {
    setEventSponsorships((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] || []), sponsor],
    }));
    try {
      await fetch(`/api/events-management/events/${encodeURIComponent(eventId)}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          name: sponsor.name,
          email: sponsor.email,
          company: sponsor.company,
          logoUrl: sponsor.logoUrl,
          companyWebsite: sponsor.companyWebsite,
          amount: sponsor.amount,
          currency: sponsor.currency,
          level: sponsor.level,
          benefits: sponsor.benefits,
          status: sponsor.status,
          notes: sponsor.notes,
        })
      });
    } catch {}
    addToast({ message: 'Sponsor lagt til', type: 'success', duration: 2500 });
  };
  const updateSponsor = (eventId: string, sponsorId: string, patch: Partial<Sponsor>) => {
    setEventSponsorships((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] || []).map((s) => (s.id === sponsorId ? { ...s, ...patch } : s)),
    }));
    addToast({ message: 'Sponsor oppdatert', type: 'info', duration: 2000 });
  };
  const removeSponsor = (eventId: string, sponsorId: string) => {
    setEventSponsorships((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] || []).filter((s) => s.id !== sponsorId),
    }));
    addToast({ message: 'Sponsor fjernet', type: 'warning', duration: 2000 });
  };

  const syncSponsorToCRM = async (eventId: string, sponsor: Sponsor) => {
    try {
      if (!sponsor.email) {
        addToast({ message: 'E-post kreves for å legge til i CRM', type: 'error', duration: 3000 });
        return;
      }
      // Ensure Google Contact exists
      let contactId: string | null = null;
      const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(sponsor.email)}`);
      if (searchRes.ok) {
        const contacts = await searchRes.json();
        const found = contacts.find((c: any) => c.email?.toLowerCase() === sponsor.email.toLowerCase());
        if (found?.id) contactId = found.id;
      }
      if (!contactId) {
        const [firstName, ...rest] = sponsor.name.split(' ');
        const lastName = rest.join(' ');
        const createRes = await fetch('/api/google/people/create-contact', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({
            firstName: firstName || '-',
            lastName: lastName || '-',
            email: sponsor.email,
            phone: '',
            profession: mappedProfession || 'vendor',
            companyName: sponsor.company || '',
            notes: `Sponsor for event ${selectedEvent?.name || ''}`
          })
        });
        if (createRes.ok) {
          const created = await createRes.json();
          contactId = created.contactId || null;
        }
      }
      // Create CRM customer
      const crmRes = await fetch('/api/universal-crm/customers', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          name: sponsor.name,
          email: sponsor.email,
          phone: '',
          company: sponsor.company || '',
          profession: mappedProfession || 'vendor',
          status: 'lead',
          notes: `Sponsor (${sponsor.level || 'Partner'}) for event ${selectedEvent?.name || ','}`,
          source: 'events_sponsorship',
          tags: ['sponsor','events'],
          customFields: { level: sponsor.level, amount: sponsor.amount, currency: sponsor.currency, googleContactId: contactId || undefined }
        })
      });
      if (!crmRes.ok) throw new Error('CRM create failed');
      const created = await crmRes.json();

      // Try to set Google Contact photo from sponsor logo or domain
      let logoUrl = '';
      if (sponsor.companyWebsite) {
        const d = getDomainFromWebsite(sponsor.companyWebsite);
        if (d) { logoUrl = sponsor.logoUrl || `https://logo.clearbit.com/${d}`; }
      }
      if (contactId && logoUrl) {
        try {
          await fetch(`/api/google/people/set-contact-photo/${encodeURIComponent(contactId)}`, {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({ photoUrl: logoUrl })
          });
        } catch {}
      }

      setEventSponsorships((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] || []).map((s) => (s.id === sponsor.id ? { ...s, crmCustomerId: created?.id, googleContactId: sponsor.googleContactId || contactId || undefined } : s))
      }));
      try {
        await fetch(`/api/events-management/events/${encodeURIComponent(eventId)}/sponsors`, {
          method: 'PATCH',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({ email: sponsor.email, googleContactId: contactId || undefined, crmCustomerId: created?.id, logoUrl })
        });
      } catch {}
      addToast({ message: 'Sponsor lagt til i kontakter', type: 'success', duration: 3000 });
    } catch (e) {
      addToast({ message: 'Kunne ikke legge sponsor til kontakter', type: 'error', duration: 3500 });
    }
  };

  const renderSEOAnalytics = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        SEO & SERP Analyse
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Google Search Console Data
            </Typography>
            {/* SEO metrics table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Keyword</TableCell>
                    <TableCell>Posisjoner</TableCell>
                    <TableCell>Klikk</TableCell>
                    <TableCell>Visninger</TableCell>
                    <TableCell>CTR</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.slice(0, 5).map((event) =>
                    event.metrics.seo.topKeywords.map((keyword, index) => (
                      <TableRow key={`${event.id}-${index}`}>
                        <TableCell>{keyword.keyword}</TableCell>
                        <TableCell>{keyword.position}</TableCell>
                        <TableCell>{keyword.clicks}</TableCell>
                        <TableCell>{keyword.impressions}</TableCell>
                        <TableCell>
                          {((keyword.clicks / keyword.impressions) * 100).toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              SEO Sammendrag
            </Typography>
            <Box mb={2}>
              <Typography variant="body2">Totalt antall visninger: </Typography>
              <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                {events
                  .reduce((sum, e) => sum + e.metrics.seo.totalImpressions, 0)
                  .toLocaleString()}
              </Typography>
            </Box>
            <Box mb={2}>
              <Typography variant="body2">Totalt antall klikk: </Typography>
              <Typography variant="h5" color="success.main" sx={{ color: theming.colors.primary }}>
                {events.reduce((sum, e) => sum + e.metrics.seo.totalClicks, 0).toLocaleString()}
              </Typography>
            </Box>
            <Box mb={2}>
              <Typography variant="body2">Gjennomsnittlig klikkfrekvens: </Typography>
              <Typography variant="h5" color="info.main" sx={{ color: theming.colors.primary }}>
                {(
                  events.reduce((sum, e) => sum + e.metrics.seo.averageCTR, 0) / events.length
                ).toFixed(2)}
                %
              </Typography>
            </Box>
            <Box mb={2}>
              <Typography variant="body2">Gjennomsnittlig plassering: </Typography>
              <Typography variant="h5" color="warning.main" sx={{ color: theming.colors.primary }}>
                {(
                  events.reduce((sum, e) => sum + e.metrics.seo.averagePosition, 0) / events.length
                ).toFixed(1)}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  // Sponsorship Management UI
  const renderSponsorships = () => (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
        Sponsorer
      </Typography>

      {!selectedEvent && (
        <Alert severity="info">Velg et event i Operasjoner-fanen for å administrere sponsorer.</Alert>
      )}

      {selectedEvent && (
        <Box>
          <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Legg til sponsor for «{selectedEvent.name}»
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Navn" id="sponsor-name" />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="E-post" id="sponsor-email" />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth label="Selskap" id="sponsor-company" />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth type="number" label="Beløp" id="sponsor-amount" />
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Nivå</InputLabel>
                  <Select defaultValue="Partner" label="Nivå" id="sponsor-level">
                    <MenuItem value="Gold">Gold</MenuItem>
                    <MenuItem value="Silver">Silver</MenuItem>
                    <MenuItem value="Bronze">Bronze</MenuItem>
                    <MenuItem value="Partner">Partner</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Logo URL (valgfritt)" id="sponsor-logo" placeholder="https://.../logo.png" />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Nettside (valgfritt)" id="sponsor-website" placeholder="https://firma.no" />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    const sponsor: Sponsor = {
                      id: `sp_${Date.now()}`,
                      name: (document.getElementById('sponsor-name') as HTMLInputElement)?.value || ',',
                      email: (document.getElementById('sponsor-email') as HTMLInputElement)?.value || ',',
                      company: (document.getElementById('sponsor-company') as HTMLInputElement)?.value || ',',
                      logoUrl: (document.getElementById('sponsor-logo') as HTMLInputElement)?.value || ',',
                      companyWebsite: (document.getElementById('sponsor-website') as HTMLInputElement)?.value || ',',
                      amount: Number((document.getElementById('sponsor-amount') as HTMLInputElement)?.value || '0'),
                      currency: 'NOK',
                      level: ((document.getElementById('sponsor-level') as HTMLInputElement)?.value || 'Partner') as any,
                      benefits: ((document.getElementById('sponsor-benefits') as HTMLInputElement)?.value || ',')
                        .split('')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      status: 'prospect',
                    };
                    addSponsor(selectedEvent.id, sponsor);
                  }}
                >
                  Legg til
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Sponsorer ({(eventSponsorships[selectedEvent.id] || []).length})
            </Typography>
            {(eventSponsorships[selectedEvent.id] || []).length === 0 ? (
              <Alert severity="info">Ingen sponsorer registrert ennå.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Navn</TableCell>
                      <TableCell>E-post</TableCell>
                      <TableCell>Selskap</TableCell>
                      <TableCell align="right">Beløp</TableCell>
                      <TableCell>Nivå</TableCell>
                      <TableCell>Fordeler</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(eventSponsorships[selectedEvent.id] || []).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar
                                sx={{ width: 24, height: 24 }}
                                src={(() => { const d = getDomainFromWebsite(s.companyWebsite); return s.logoUrl || (d ? `https://logo.clearbit.com/${d}` : undefined); })()}
                              >
                                {(s.name || '').slice(0,1)}
                              </Avatar>
                              {s.name}
                            </Box>
                          </TableCell>
                          <TableCell>{s.email}</TableCell>
                          <TableCell>{s.company}</TableCell>
                        <TableCell align="right">{s.amount ? `kr ${(s.amount / 1000).toFixed(0)}k` : '-'}</TableCell>
                        <TableCell>{s.level || '-'}</TableCell>
                        <TableCell>
                          {(s.benefits || []).slice(0, 3).map((b, i) => (
                            <Chip key={i} label={b} size="small" sx={{ mr: 0.5 }} />
                          ))}
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={s.status || 'prospect'}
                            onChange={(e) =>
                              updateSponsor(selectedEvent.id, s.id, { status: e.target.value as Sponsor['status'] })
                            }
                          >
                            <MenuItem value="prospect">Prospekt</MenuItem>
                            <MenuItem value="negotiating">Forhandling</MenuItem>
                            <MenuItem value="confirmed">Bekreftet</MenuItem>
                            <MenuItem value="paid">Betalt</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell align="right">
                          {s.googleContactId ? (
                            <Chip label="I kontakter" color="success" size="small" sx={{ mr: 1 }} />
                          ) : (
                            <Button size="small" onClick={() => syncSponsorToCRM(selectedEvent.id, s)} sx={{ mr: 1 }}>
                              Legg til i kontakter
                            </Button>
                          )}
                          <Button size="small" color="error" onClick={() => removeSponsor(selectedEvent.id, s.id)}>
                            Fjern
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Events Management & Analytics Platform
      </Typography>

      {/* Demo Mode Indicator */}
      {!demoModeLoading && (
        <Alert
          severity={isDemoMode ? 'info' : 'success'}
          sx={{ mb: 2 }}
        >
          {isDemoMode
            ? '🎭 Demo-modus aktiv - Du ser simulerte data for å forstå funksjonaliteten'
            : '🏭 Produksjonsmodus aktiv - Systemet er tomt og klar for ekte data'}
        </Alert>
      )}

      {/* Show empty state message when in production mode */}
      {!isDemoMode && !loading && events.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          📝 Opprett ditt første arrangement for å komme i gang med Events Management-plattformen.
          Alle funksjoner er tilgjengelige og klare for ekte data.
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab icon={<Event />} label="Event Oversikt" />
        <Tab icon={<Campaign />} label="Marketing" />
        <Tab icon={<Assignment />} label="Operasjoner" />
        <Tab icon={<AttachMoney />} label="Finansiell" />
        <Tab icon={<Search />} label="SEO & SERP" />
        <Tab icon={<BusinessCenter />} label="CRM" />
        <Tab icon={<MonetizationOn />} label="Sponsorer" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {tabValue === 0 && renderEventsOverview()}
      {tabValue === 1 && renderMarketingScreen()}
      {tabValue === 2 && renderOperationsScreen()}
      {tabValue === 3 && renderFinancialScreen()}
      {tabValue === 4 && renderSEOAnalytics()}
      {tabValue === 5 && (
        <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
          <Box sx={{ mb: 2 }}>
            {selectedEvent ? (
              <Alert severity="info">
                CRM-handlinger vil bli knyttet til valgt event: <strong>{selectedEvent.name}</strong>
              </Alert>
            ) : (
              <Alert severity="warning">Velg et event i Operasjoner-fanen for å knytte CRM-handlinger.</Alert>
            )}
          </Box>

          {selectedEvent && (
            <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Prosjekttype</InputLabel>
                    <Select
                      value={selectedProjectType}
                      label="Prosjekttype"
                      onChange={(e) => setSelectedProjectType(e.target.value)}
                    >
                      <MenuItem value="event">Event</MenuItem>
                      <MenuItem value="commercial">Kommersiell</MenuItem>
                      <MenuItem value="video">Video</MenuItem>
                      <MenuItem value="wedding">Bryllup</MenuItem>
                      <MenuItem value="portrait">Portrett</MenuItem>
                      <MenuItem value="music">Musikk</MenuItem>
                      <MenuItem value="product">Produkt</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={5}>
                  <FormControl fullWidth>
                    <InputLabel>Kunde (valgfritt)</InputLabel>
                    <Select
                      value={selectedClientEmail}
                      label="Kunde (valgfritt)"
                      onChange={(e) => setSelectedClientEmail(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Ingen valgt</em>
                      </MenuItem>
                      {(eventCustomerLinks[selectedEvent.id] || []).map((c: any) => (
                        <MenuItem key={c.email} value={c.email}>
                          {c.name || c.email} — {c.email}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => {
                      // default project type from event if not changed yet
                      if (!selectedProjectType) {
                        setSelectedProjectType(mapEventToProjectType(selectedEvent, mappedProfession));
                      }
                      setShowProjectCreator(true);
                    }}
                  >
                    Start prosjektopprettelse
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}

          {showProjectCreator && selectedEvent && (
            <Paper sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{ mb: 1, color: theming.colors.primary }}>
                Project Creation With Memory Cards
              </Typography>
              <ProjectCreationWithMemoryCards
                profession={mappedProfession || 'photographer'}
                initialData={{
                  projectName: `${selectedEvent.name} - ${selectedProjectType || mapEventToProjectType(selectedEvent, mappedProfession)}`,
                  description: selectedEvent.description,
                  projectType: selectedProjectType || mapEventToProjectType(selectedEvent, mappedProfession),
                  clientName: (() => {
                    const clients = eventCustomerLinks[selectedEvent.id] || [];
                    const chosen = clients.find((c: any) => c.email === selectedClientEmail) || clients[0];
                    return chosen?.name || '';
                  })(),
                  clientEmail: (() => {
                    const clients = eventCustomerLinks[selectedEvent.id] || [];
                    const chosen = clients.find((c: any) => c.email === selectedClientEmail) || clients[0];
                    return chosen?.email || '';
                  })(),
                  eventDate: selectedEvent.startDate?.split('T')[0],
                  location: `${selectedEvent.venue?.name || ''}${selectedEvent.venue?.city ? ',' + selectedEvent.venue.city : ''}`,
                  budget: selectedEvent.budget?.total}}
                onProjectCreated={async (project: any) => {
                  setEventProjectLinks((prev) => ({ ...prev, [selectedEvent.id]: project }));
                  try {
                    await fetch(`/api/events-management/events/${encodeURIComponent(String(selectedEvent.id))}/project-link`, {
                      method: 'POST',
                      headers: { 'Content-Type' : 'application/json' },
                      body: JSON.stringify({ projectId: project?.id || project?.projectId || '', projectName: project?.projectName || project?.name, profession: mappedProfession, metadata: { source: 'project-creation' } })
                    });
                  } catch {}
                  addToast({ message: 'Prosjekt opprettet og knyttet til eventet', type: 'success', duration: 3500 });
                  setShowProjectCreator(false);
                }}
                onOpenEventManagement={async (eventData: any) => {
                  try {
                    // Ensure client is linked to Google Contacts
                    let contactId: string | null = null;
                    const email = eventData?.client?.email;
                    const name = eventData?.client?.name || '';
                    const phone = eventData?.client?.phone || '';

                    if (email) {
                      const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(email)}`);
                      if (searchRes.ok) {
                        const contacts = await searchRes.json();
                        const found = contacts.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
                        if (found?.id) contactId = found.id;
                      }

                      if (!contactId) {
                        // Create contact
                        const [firstName, ...rest] = (name || email).split('');
                        const lastName = rest.join('');
                        const createRes = await fetch('/api/google/people/create-contact', {
                          method: 'POST',
                          headers: { 'Content-Type' : 'application/json' },
                          body: JSON.stringify({ firstName, lastName: lastName || '-', email, phone, profession: mappedProfession, companyName: ',', notes: 'Created from Project Creation' })
                        });
                        if (createRes.ok) {
                          const created = await createRes.json();
                          contactId = created.contactId || null;
                        }
                      }
                    }

                    const payload = {
                      ...eventData,
                      client: {
                        ...eventData.client,
                        googleContactId: contactId || undefined,
                      },
                    };

                    const res = await fetch('/api/events-management/events', {
                      method: 'POST',
                      headers: { 'Content-Type' : 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('Failed to create event');
                    await loadEventsData();
                    setTabValue(0); // Go to Event Oversikt
                    addToast({ message: 'Event opprettet fra prosjektdata og koblet til Google Kontakter', type: 'success', duration: 4000 });
                  } catch (e) {
                    addToast({ message: 'Kunne ikke opprette event fra prosjekt', type: 'error', duration: 4000 });
                  }
                }}
              />
            </Paper>
          )}

          <UniversalCRMDashboard
            profession={mappedProfession}
            selectedProject={selectedEvent ? eventProjectLinks[selectedEvent.id] : undefined}
            eventContext={selectedEvent ? { id: String(selectedEvent.id), name: selectedEvent.name } : undefined}
            linkedCustomersForEvent={selectedEvent ? (eventCustomerLinks[selectedEvent.id] || []).map((c: any) => c.email).filter(Boolean) : []}
            onLinkToEvent={async (customer, opts) => {
              if (!selectedEvent) return;
              const link = { name: customer.name, email: customer.email, role: opts.role, notes: opts.notes };
              setEventCustomerLinks((prev) => ({
                ...prev,
                [selectedEvent.id]: [...(prev[selectedEvent.id] || []).filter((c: any) => c.email !== customer.email), link],
              }));
              try {
                await fetch(`/api/events-management/events/${encodeURIComponent(String(selectedEvent.id))}/relations`, {
                  method: 'POST',
                  headers: { 'Content-Type' : 'application/json' },
                  body: JSON.stringify({ email: customer.email, name: customer.name, role: opts.role, notes: opts.notes })
                });
              } catch {}
              addToast({ message: `Kontakt linket til «${selectedEvent.name}» som ${opts.role}`, type: 'success', duration: 3000 });
            }}
            onProjectSelect={(project: any) => {
              if (selectedEvent) {
                setEventProjectLinks((prev) => ({ ...prev, [selectedEvent.id]: project }));
                addToast({ message: 'Prosjekt valgt i CRM', type: 'info', duration: 2000 });
              }
            }}
            onProjectCreate={(_, project: any) => {
              if (selectedEvent) {
                setEventProjectLinks((prev) => ({ ...prev, [selectedEvent.id]: project }));
                addToast({ message: `Prosjekt koblet til «${selectedEvent.name}»`, type: 'success', duration: 3500 });
              } else {
                addToast({ message: 'Prosjekt opprettet fra CRM', type: 'success', duration: 3000 });
              }
            }}
            onMeetingSchedule={(_, meeting: any) => {
              if (selectedEvent) {
                setEventMeetingLinks((prev) => ({
                  ...prev,
                  [selectedEvent.id]: [...(prev[selectedEvent.id] || []), meeting],
                }));
                addToast({ message: `Møte planlagt og knyttet til «${selectedEvent.name}»`, type: 'success', duration: 3500 });
              } else {
                addToast({ message: 'Møte planlagt fra CRM', type: 'success', duration: 3000 });
              }
            }}
            onCustomerSelect={(customer: any) => {
              if (selectedEvent) {
                setEventCustomerLinks((prev) => ({
                  ...prev,
                  [selectedEvent.id]: [...(prev[selectedEvent.id] || []), customer],
                }));
                addToast({ message: `Kunde knyttet til «${selectedEvent.name}»`, type: 'success', duration: 3000 });
              } else {
                addToast({ message: 'Kunde valgt i CRM', type: 'info', duration: 2000 });
              }
            }}
          />
        </Paper>
      )}

      {tabValue === 6 && renderSponsorships()}

      {/* Event Creation/Edit Dialog */}
      <Dialog
        open={dialogOpen && dialogType === 'event'}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedEvent ? 'Rediger Event' : 'Opprett Nytt Event'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: theming.colors.primary }}>
                  Grunnleggende Informasjon
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Event Navn *"
                  placeholder="F.eks. Tech Summit 2024"
                  defaultValue={selectedEvent?.name || ''}
                  id="event-name"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Beskrivelse *"
                  placeholder="Kort beskrivelse av eventet"
                  defaultValue={selectedEvent?.description || ''}
                  id="event-description"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Event Type *</InputLabel>
                  <Select
                    defaultValue={selectedEvent?.type || 'conference'}
                    label="Event Type *"
                    id="event-type"
                  >
                    <MenuItem value="conference">Konferanse</MenuItem>
                    <MenuItem value="workshop">Workshop</MenuItem>
                    <MenuItem value="networking">Networking</MenuItem>
                    <MenuItem value="exhibition">Utstilling</MenuItem>
                    <MenuItem value="launch">Lansering</MenuItem>
                    <MenuItem value="webinar">Webinar</MenuItem>
                    <MenuItem value="hybrid">Hybrid</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status *</InputLabel>
                  <Select
                    defaultValue={selectedEvent?.status || 'planning'}
                    label="Status *"
                    id="event-status"
                  >
                    <MenuItem value="planning">Planlegging</MenuItem>
                    <MenuItem value="promotion">Promotering</MenuItem>
                    <MenuItem value="live">Live</MenuItem>
                    <MenuItem value="completed">Fullført</MenuItem>
                    <MenuItem value="cancelled">Avlyst</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Dates */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: theming.colors.primary, mt: 2 }}>
                  Datoer
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Startdato *"
                  InputLabelProps={{ shrink: true }}
                  defaultValue={selectedEvent?.startDate?.split('T')[0] || ','}
                  id="event-start-date"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Sluttdato *"
                  InputLabelProps={{ shrink: true }}
                  defaultValue={selectedEvent?.endDate?.split('T')[0] || ','}
                  id="event-end-date"
                />
              </Grid>

              {/* Venue Information */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: theming.colors.primary, mt: 2 }}>
                  Venue
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Venue Navn *"
                  placeholder="Oslo Kongressenter"
                  defaultValue={selectedEvent?.venue.name || ''}
                  id="venue-name"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Kapasitet *"
                  type="number"
                  placeholder="500"
                  defaultValue={selectedEvent?.venue.capacity || ''}
                  id="venue-capacity"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Adresse"
                  placeholder="Youngsgate 21"
                  defaultValue={selectedEvent?.venue.address || ''}
                  id="venue-address"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="By *"
                  placeholder="Oslo"
                  defaultValue={selectedEvent?.venue.city || ''}
                  id="venue-city"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Land"
                  placeholder="Norge"
                  defaultValue={selectedEvent?.venue.country || 'Norge'}
                  id="venue-country"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Venue Type *</InputLabel>
                  <Select
                    defaultValue={selectedEvent?.venue.type || 'physical'}
                    label="Venue Type *"
                    id="venue-type"
                  >
                    <MenuItem value="physical">Fysisk</MenuItem>
                    <MenuItem value="virtual">Virtuell</MenuItem>
                    <MenuItem value="hybrid">Hybrid</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Target Audience */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: theming.colors.primary, mt: 2 }}>
                  Målgruppe
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Audience Type *</InputLabel>
                  <Select
                    defaultValue={selectedEvent?.target.audience || 'B2C'}
                    label="Audience Type *"
                    id="target-audience"
                  >
                    <MenuItem value="B2C">B2C</MenuItem>
                    <MenuItem value="B2B">B2B</MenuItem>
                    <MenuItem value="Mixed">Mixed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Forventet Antall Deltakere *"
                  type="number"
                  placeholder="300"
                  defaultValue={selectedEvent?.target.expectedAttendees || ''}
                  id="target-attendees"
                />
              </Grid>

              {/* Budget */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ color: theming.colors.primary, mt: 2 }}>
                  Budsjett (NOK)
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Total Budsjett *"
                  type="number"
                  placeholder="500000"
                  defaultValue={selectedEvent?.budget.total || ''}
                  id="budget-total"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Marketing Budsjett"
                  type="number"
                  placeholder="150000"
                  defaultValue={selectedEvent?.budget.marketing || ''}
                  id="budget-marketing"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Venue Budsjett"
                  type="number"
                  placeholder="200000"
                  defaultValue={selectedEvent?.budget.venue || ', '}
                  id="budget-venue"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDialogOpen(false);
            setSelectedEvent(null);
          }}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              // Collect form data
              const formData = {
                name: (document.getElementById('event-name') as HTMLInputElement)?.value,
                description: (document.getElementById('event-description') as HTMLInputElement)?.value,
                type: (document.getElementById('event-type') as HTMLInputElement)?.value,
                status: (document.getElementById('event-status') as HTMLInputElement)?.value,
                startDate: (document.getElementById('event-start-date') as HTMLInputElement)?.value,
                endDate: (document.getElementById('event-end-date') as HTMLInputElement)?.value,
                venue: {
                  name: (document.getElementById('venue-name') as HTMLInputElement)?.value,
                  capacity: parseInt((document.getElementById('venue-capacity') as HTMLInputElement)?.value || '0'),
                  address: (document.getElementById('venue-address') as HTMLInputElement)?.value || ', ',
                  city: (document.getElementById('venue-city') as HTMLInputElement)?.value,
                  country: (document.getElementById('venue-country') as HTMLInputElement)?.value || 'Norge',
                  type: (document.getElementById('venue-type') as HTMLInputElement)?.value,
                },
                target: {
                  audience: (document.getElementById('target-audience') as HTMLInputElement)?.value,
                  expectedAttendees: parseInt((document.getElementById('target-attendees') as HTMLInputElement)?.value || '0'),
                  segments: [],
                  geography: ['Norge'],
                },
                budget: {
                  total: parseInt((document.getElementById('budget-total') as HTMLInputElement)?.value || '0'),
                  marketing: parseInt((document.getElementById('budget-marketing') as HTMLInputElement)?.value || '0'),
                  venue: parseInt((document.getElementById('budget-venue') as HTMLInputElement)?.value || '0'),
                  catering: 0,
                  technology: 0,
                  speakers: 0,
                  misc: 0,
                },
              };

              // Validate required fields
              if (!formData.name || !formData.description || !formData.startDate || !formData.endDate) {
                addToast({
                  message: 'Vennligst fyll ut alle påkrevde felt',
                  type: 'error',
                  duration: 3000
                });
                return;
              }

              // Call create or update handler
              if (selectedEvent) {
                handleUpdateEvent(selectedEvent.id, formData);
              } else {
                handleCreateEvent(formData);
              }
              setSelectedEvent(null);
            }}
            sx={theming.getThemedButtonSx()}
          >
            {selectedEvent ? 'Oppdater' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event Detail Modal */}
      {selectedEvent && !dialogOpen && (
        <Dialog
          open={Boolean(selectedEvent)}
          onClose={() => setSelectedEvent(null)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            {selectedEvent.name}
            <IconButton
              aria-label="close"
              onClick={() => setSelectedEvent(null)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <Delete />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Event Informasjon</Typography>
                <Typography variant="body2">Type: {selectedEvent.type}</Typography>
                <Typography variant="body2">Status: {selectedEvent.status}</Typography>
                <Typography variant="body2">
                  Periode: {new Date(selectedEvent.startDate).toLocaleDateString('no-NO')} - {new Date(selectedEvent.endDate).toLocaleDateString('no-NO')}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Venue</Typography>
                <Typography variant="body2">{selectedEvent.venue.name}</Typography>
                <Typography variant="body2">{selectedEvent.venue.address}, {selectedEvent.venue.city}</Typography>
                <Typography variant="body2">Kapasitet: {selectedEvent.venue.capacity}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Metrics</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">{selectedEvent.metrics.reach.totalReach.toLocaleString()}</Typography>
                      <Typography variant="caption">Total Reach</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">{selectedEvent.metrics.conversion.registrations}</Typography>
                      <Typography variant="caption">Registrations</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">{selectedEvent.metrics.conversion.conversionRate.toFixed(1)}%</Typography>
                      <Typography variant="caption">Conversion Rate</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">kr {(selectedEvent.metrics.financial.revenue / 1000).toFixed(0)}k</Typography>
                      <Typography variant="caption">Revenue</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Grid>

              {/* CRM-koblinger */}
              <Grid item xs={12} sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>CRM-koblinger</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Tilknyttet prosjekt
                      </Typography>
                      {eventProjectLinks[selectedEvent.id] ? (
                        <Box>
                          <Typography variant="body2">
                            {eventProjectLinks[selectedEvent.id].projectName || 'Prosjekt'}
                          </Typography>
                          {eventProjectLinks[selectedEvent.id].clientName && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Klient: {eventProjectLinks[selectedEvent.id].clientName}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Ingen prosjekt tilknyttet ennå
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        Planlagte møter
                      </Typography>
                      {(eventMeetingLinks[selectedEvent.id] || []).length > 0 ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            {eventMeetingLinks[selectedEvent.id].length} møte(r) knyttet til dette eventet
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {eventMeetingLinks[selectedEvent.id].slice(0, 4).map((m, idx) => (
                              <Chip key={idx} label={m?.title || 'Møte'} size="small" />
                            ))}
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Ingen møter tilknyttet ennå
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              </Grid>

              {/* Linkede kunder */}
              <Grid item xs={12}>
                <Paper sx={{ p: 2, mt: 2, ...theming.getThemedCardSx() }}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Linkede kunder
                  </Typography>
                  {(eventCustomerLinks[selectedEvent.id] || []).length > 0 ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        {eventCustomerLinks[selectedEvent.id].length} kunde(r) knyttet til dette eventet
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {eventCustomerLinks[selectedEvent.id].slice(0, 6).map((c: any, idx: number) => (
                          <Chip key={idx} label={c?.name || c?.email || 'Kunde'} size="small" />
                        ))}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Ingen kunder knyttet ennå
                    </Typography>
                  )}
                </Paper>
              </Grid>

            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedEvent(null)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Timeline Editor Dialog */}
      <Dialog open={timelineDialogOpen} onClose={() => setTimelineDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Event Timeline Editor</DialogTitle>
        <DialogContent dividers>
          {timelineEvent ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(eventSponsorships[timelineEvent.id] || []).length > 0 && (
                <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Sponsorer for dette eventet
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(eventSponsorships[timelineEvent.id] || []).map((s: any) => (
                      <Chip
                        key={s.id}
                        label={`${s.name}${s.level ? ' — ' + s.level : ','}`}
                        size="small"
                        avatar={<Avatar src={(() => { const d = getDomainFromWebsite(s.companyWebsite); return s.logoUrl || (d ? `https://logo.clearbit.com/${d}` : undefined); })()}>{(s.name || ', ').slice(0,1)}</Avatar>}
                      />
                    ))}
                  </Box>
                </Paper>
              )}
              {/* Speaker candidates from sponsors and linked contacts */}
              {(() => {
                const fromLinks = (eventCustomerLinks[timelineEvent.id] || [])
                  .filter((c: any) => (c.role || ', ').toLowerCase() === 'speaker')
                  .map((c: any) => ({ name: c.name || c.email, email: c.email, source: 'relation' }));
                const fromSponsors = (eventSponsorships[timelineEvent.id] || [])
                  .filter((s: any) => (s.benefits || []).some((b: string) => /speaker|foredrag|talk|keynote/i.test(b)))
                  .map((s: any) => ({ name: s.name, email: s.email, source: 'sponsor' }));
                const dedup: Record<string, any> = {};
                [...fromLinks, ...fromSponsors].forEach((p) => { if (!dedup[p.email || p.name]) dedup[p.email || p.name] = p; });
                const speakers = Object.values(dedup) as Array<{ name: string; email?: string; source: string }>;
                if (speakers.length === 0) return null;
                const addSpeakerTalk = async (sp: any) => {
                  try {
                    const payload = {
                      title: `Foredrag: ${sp.name}`,
                      time: '10:00',
                      duration: 20,
                      description: sp.email ? `E-post: ${sp.email}` : ', ',
                      eventType: 'speech',
                      priority: 'medium',
                      status: 'planned',
                      metadata: { speaker: sp }
                    };
                    const res = await fetch(`/api/event-timeline/${timelineEvent.id}/events`, {
                      method: 'POST',
                      headers: { 'Content-Type' : 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('create failed');
                    let timelineEventId: string | undefined;
                    try { const j = await res.json(); timelineEventId = j?.id || j?.data?.id; } catch {}
                    try {
                      await fetch(`/api/events-management/events/${encodeURIComponent(String(timelineEvent.id))}/speaker-suggestions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: sp.name, email: sp.email, source: sp.source || 'manual', addedAsEvent: true, timelineEventId })
                      });
                    } catch {}
                    queryClient.invalidateQueries({ queryKey: [`/api/event-timeline/${timelineEvent.id}/events`] });
                    addToast({ message: 'Foredrag lagt til i tidslinjen', type: 'success', duration: 3000 });
                  } catch (e) {
                    addToast({ message: 'Kunne ikke legge til foredrag', type: 'error', duration: 3500 });
                  }
                };
                return (
                  <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Foreslåtte foredragsholdere
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {speakers.map((sp) => (
                        <Box key={sp.email || sp.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor:'divider', p: 0.5, borderRadius: 1 }}>
                          <Chip label={sp.name} size="small" />
                          <Button size="small" onClick={() => addSpeakerTalk(sp)}>Legg til foredrag</Button>
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                );
              })()}
              <EventTimelineEditor
                projectId={timelineEvent.id}
                userId={'events-management'}
                projectType={'event' as any}
                viewMode="full"
              />
            </Box>
          ) : (
            <Alert severity="info">Velg et event for å åpne timeline editor</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimelineDialogOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventsManagementPlatform;
