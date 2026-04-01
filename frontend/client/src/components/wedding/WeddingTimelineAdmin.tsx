import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Divider,
  FormControlLabel,
  FormGroup,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Event,
  Settings,
  Edit,
  Schedule,
  People,
  LocationOn,
  Camera,
  Notifications,
  RecordVoiceOver,
  Mic,
  AccessTime,
  CalendarToday,
  Lightbulb,
  Pending,
  Key,
  ContentCopy,
  HelpOutline,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useSettings, type UserSettings } from '@/contexts/SettingsContext';
import ClientAccessSettings from '@/components/shared/ClientAccessSettings';
import WeddingTimeline from '../wedding-timeline';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import WeddingTimelineHelp from './WeddingTimelineHelp';
import EvendiImportantPeople from '../evendi/EvendiImportantPeople';
import EvendiSpeeches from '../evendi/EvendiSpeeches';
import EvendiSeating from '../evendi/EvendiSeating';
import EvendiMusic from '../evendi/EvendiMusic';
import EvendiCoordinators from '../evendi/EvendiCoordinators';
import EvendiReviews from '../evendi/EvendiReviews';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import type { EventType} from '@/lib/evendi-api';
import { getEventTypeLabel, getEventCategory } from '@/lib/evendi-api';

interface EvendiTimelineAdminProps {
  projectId?: string; // Optional - hvis null/undefined = generell tidslinje-administrasjon
  weddingId?: string; // Spesifikk bryllup-ID hvis det finnes
  evendiCoupleId?: string; // Optional: auto-fetch cultural type from Evendi couple traditions bridge
  eventType?: string; // Event type from Evendi (wedding, birthday, corporate, etc.)
  projectIntegration?: {
    projectId?: string;
    weddingTimelineIntegrated?: boolean;
    culturalType?: string;
};
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any
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
  clientNotes?: string; // Client-submitted notes/changes
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled';
  hasSpeech: boolean; // Ny egenskap for å indikere tale
  speechDetails?: string; // Detaljer om talen
  
  // Auto-Adjust functionality
  originalTime?: string; // Original scheduled time
  currentDelay?: number; // Minutes delayed
  isDelayed?: boolean;
  delayReason?: string;
  autoAdjusted?: boolean; // Was this auto-adjusted from another event's delay?
  
  createdAt: string;
  updatedAt: string
}

interface EvendiTimeline {
  id: string;
  projectId?: string;
  title?: string;
  eventDate: string;
  venue: string;
  clientName: string;
  coupleName?: string;
  eventType?: EventType;
  events: TimelineEvent[];
  clientAccessEnabled?: boolean;
  lastClientActivity?: string;
  timelineData?: {
    planningBrief?: {
      title?: string | null;
      clientName?: string | null;
      summary?: string | null;
      requests?: string | null;
      location?: string | null;
      eventDate?: string | null;
      timeframe?: string | null;
    };
    latestMeetingSync?: {
      meetingId?: string | null;
      meetingTitle?: string | null;
      syncedAt?: string | null;
      baseMode?: string | null;
      projectTitle?: string | null;
      clientName?: string | null;
      briefSummary?: string | null;
      specialRequests?: string | null;
      location?: string | null;
      selectedSections?: string[];
    };
  };
  createdAt: string;
  updatedAt: string
}

interface WeddingProject {
  id: string;
  projectName?: string;
  clientName?: string;
  clientId?: string;
  culturalType?: string;
  [key: string]: unknown;
}

// Contextual labels that adapt based on event type
function getContextualLabels(eventType: EventType, category: 'personal' | 'corporate') {
  const isWeddingType = eventType === 'wedding' || eventType === 'engagement';
  const isCorporate = category === 'corporate';

  return {
    clientNameLabel: isWeddingType ? 'Par / Brudeparet' : isCorporate ? 'Firma / Organisasjon' : 'Klient / Arrangør',
    eventDateLabel: isWeddingType ? 'Bryllupsdato' : isCorporate ? 'Arrangementsdato' : 'Dato',
    venueLabel: isWeddingType ? 'Vielsessted / Festlokale' : 'Lokasjon / Venue',
    noTimelinePlaceholder: isWeddingType
      ? 'Administrer tidslinje-maler for bryllup.'
      : isCorporate
        ? 'Administrer tidslinje-maler for bedriftsarrangementer.'
        : 'Administrer generelle tidslinje-maler.',
    newPlaceholder: isWeddingType ? 'Nytt Bryllup' : isCorporate ? 'Nytt Arrangement' : `Ny ${getEventTypeLabel(eventType)}`,
    projectLabel: isWeddingType ? 'Velg bryllupsprosjekt' : 'Velg prosjekt',
    specificInfoText: isWeddingType
      ? 'Endringer gjelder kun dette spesifikke bryllupet'
      : 'Endringer gjelder kun dette spesifikke arrangementet',
    templateInfoText: isWeddingType
      ? 'Endringer lager maler som kan brukes for nye bryllup'
      : 'Endringer lager maler som kan brukes for nye arrangementer',
    contextPrefix: isWeddingType ? 'bryllups' : isCorporate ? 'bedrifts' : '',
  };
}

function formatNorwegianDateTime(value?: string | null) {
  if (!value) return 'Ikke registrert ennå';
  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return value;
  return parsedValue.toLocaleString('no-NO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatNorwegianDate(value?: string | null) {
  if (!value) return 'Ikke satt';
  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return value;
  return parsedValue.toLocaleDateString('no-NO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// Contextual demo data generator — returns event-type-appropriate demo timeline
function getDemoTimeline(eventType: EventType): EvendiTimeline {
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const now = new Date().toISOString();

  if (eventType === 'wedding' || eventType === 'engagement') {
    return {
      id: 'demo-timeline-001',
      eventDate: futureDate,
      venue: 'Grand Hotel Oslo',
      clientName: 'Emma & Lars',
      eventType,
      events: [
        { id: 'evt-1', title: 'Forberedelser brud', time: '10:00', duration: 120, description: 'Hår, makeup og påkledning', location: 'Brudesuite, Grand Hotel', participants: ['Brud', 'Forlovere', 'Makeup artist'], equipment: ['Kamera', 'Blits', 'Reflektorer'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
        { id: 'evt-2', title: 'Forberedelser brudgom', time: '11:00', duration: 60, description: 'Påkledning og forberedelser', location: 'Rom 305, Grand Hotel', participants: ['Brudgom', 'Forlovere'], equipment: ['Kamera'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
        { id: 'evt-3', title: 'Vielse', time: '14:00', duration: 45, description: 'Kirkelig vielse i Oslo Domkirke', location: 'Oslo Domkirke', participants: ['Brud', 'Brudgom', 'Prest', 'Gjester'], equipment: ['Kamera', 'Videokamera', 'Mikrofon'], status: 'confirmed', hasSpeech: true, speechDetails: 'Løfter og ringeveksling', createdAt: now, updatedAt: now },
        { id: 'evt-4', title: 'Gruppefoto', time: '15:00', duration: 30, description: 'Formelle gruppebilder utenfor kirken', location: 'Utenfor Oslo Domkirke', participants: ['Alle gjester'], equipment: ['Kamera', 'Stativ', 'Blits'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
        { id: 'evt-5', title: 'Bryllupsmiddag', time: '17:00', duration: 180, description: 'Festmiddag med taler og underholdning', location: 'Festsalen, Grand Hotel', participants: ['Alle gjester'], equipment: ['Kamera', 'Videokamera'], status: 'planned', hasSpeech: true, speechDetails: 'Taler fra forlovere, foreldre og brudeparet', createdAt: now, updatedAt: now },
        { id: 'evt-6', title: 'Første dans', time: '20:00', duration: 15, description: 'Brudevalsen', location: 'Festsalen, Grand Hotel', participants: ['Brud', 'Brudgom'], equipment: ['Kamera', 'Videokamera'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
      ],
      createdAt: now, updatedAt: now
    };
  }

  if (getEventCategory(eventType) === 'corporate') {
    return {
      id: 'demo-timeline-001',
      eventDate: futureDate,
      venue: 'Oslo Kongressenter',
      clientName: 'Nordisk Tech AS',
      eventType,
      events: [
        { id: 'evt-1', title: 'Registrering & velkost', time: '08:30', duration: 30, description: 'Registrering, kaffe og mingling', location: 'Foajeen', participants: ['Alle deltakere'], equipment: ['Kamera', 'Navneskilt-system'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
        { id: 'evt-2', title: 'Åpningstale', time: '09:00', duration: 30, description: 'Velkommen og agenda', location: 'Hovedsalen', participants: ['CEO', 'Alle deltakere'], equipment: ['Mikrofon', 'Projektor', 'Kamera'], status: 'confirmed', hasSpeech: true, speechDetails: 'CEO holder velkomsttale', createdAt: now, updatedAt: now },
        { id: 'evt-3', title: 'Hovedpresentasjon', time: '09:30', duration: 60, description: 'Hovedtema og faglig innhold', location: 'Hovedsalen', participants: ['Foredragsholder', 'Alle deltakere'], equipment: ['Mikrofon', 'Projektor', 'Kamera', 'Videokamera'], status: 'planned', hasSpeech: true, speechDetails: 'Gjesteforedragsholder presenterer', createdAt: now, updatedAt: now },
        { id: 'evt-4', title: 'Lunsj & nettverking', time: '12:00', duration: 60, description: 'Lunsj med nettverkingsmuligheter', location: 'Restauranten', participants: ['Alle deltakere'], equipment: ['Kamera'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
        { id: 'evt-5', title: 'Workshop-sesjon', time: '13:00', duration: 90, description: 'Gruppeworkshop i parallelle sesjoner', location: 'Møterom A-D', participants: ['Alle deltakere'], equipment: ['Kamera', 'Whiteboard'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
        { id: 'evt-6', title: 'Avslutning & sosial samling', time: '16:00', duration: 120, description: 'Oppsummering og sosial sammenkomst', location: 'Terrassen', participants: ['Alle deltakere'], equipment: ['Kamera', 'Videokamera'], status: 'planned', hasSpeech: true, speechDetails: 'Oppsummering og takk-tale', createdAt: now, updatedAt: now },
      ],
      createdAt: now, updatedAt: now
    };
  }

  // Personal events (birthday, confirmation, anniversary, baby_shower)
  const personalLabels: Record<string, { name: string; venue: string }> = {
    birthday: { name: 'Sofie Hansen', venue: 'Ekebergrestauranten' },
    confirmation: { name: 'Mathias Olsen', venue: 'Holmenkollen Kapell' },
    anniversary: { name: 'Kari & Jon', venue: 'Theatercaféen' },
    baby_shower: { name: 'Maria & Erik', venue: 'Hjemme hos vertinnen' },
  };
  const labels = personalLabels[eventType] || { name: 'Klient', venue: 'Lokasjon' };

  return {
    id: 'demo-timeline-001',
    eventDate: futureDate,
    venue: labels.venue,
    clientName: labels.name,
    eventType,
    events: [
      { id: 'evt-1', title: 'Forberedelser', time: '10:00', duration: 60, description: 'Dekorasjon og oppsett av lokalet', location: labels.venue, participants: ['Arrangør', 'Hjelpere'], equipment: ['Kamera', 'Dekorasjon'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
      { id: 'evt-2', title: 'Gjestene ankommer', time: '12:00', duration: 30, description: 'Velkomst og mingling', location: labels.venue, participants: ['Alle gjester'], equipment: ['Kamera'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
      { id: 'evt-3', title: 'Seremoni / Program', time: '12:30', duration: 45, description: 'Hovedprogram og seremoni', location: labels.venue, participants: ['Alle gjester'], equipment: ['Kamera', 'Mikrofon'], status: 'confirmed', hasSpeech: true, speechDetails: 'Tale og program', createdAt: now, updatedAt: now },
      { id: 'evt-4', title: 'Middag / Servering', time: '14:00', duration: 120, description: 'Festmåltid med taler', location: labels.venue, participants: ['Alle gjester'], equipment: ['Kamera', 'Videokamera'], status: 'planned', hasSpeech: true, speechDetails: 'Taler fra familie og venner', createdAt: now, updatedAt: now },
      { id: 'evt-5', title: 'Kake & feiring', time: '16:00', duration: 30, description: 'Kakeskjæring og feiring', location: labels.venue, participants: ['Alle gjester'], equipment: ['Kamera'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
      { id: 'evt-6', title: 'Avslutning', time: '18:00', duration: 60, description: 'Takk og farvel', location: labels.venue, participants: ['Alle gjester'], equipment: ['Kamera'], status: 'planned', hasSpeech: false, createdAt: now, updatedAt: now },
    ],
    createdAt: now, updatedAt: now
  };
}

// Type guard for validating EventType
const VALID_EVENT_TYPES: ReadonlySet<string> = new Set<string>([
  'wedding', 'confirmation', 'birthday', 'anniversary', 'engagement', 'baby_shower',
  'conference', 'seminar', 'kickoff', 'summer_party', 'christmas_party', 'team_building',
  'product_launch', 'trade_fair', 'corporate_anniversary', 'awards_night', 'employee_day',
  'onboarding_day', 'corporate_event'
]);

function isValidEventType(value: string): value is EventType {
  return VALID_EVENT_TYPES.has(value);
}

export default function EvendiTimelineAdmin({ 
  projectId, 
  weddingId, 
  evendiCoupleId,
  eventType: eventTypeProp,
  projectIntegration,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient
}: EvendiTimelineAdminProps) {
  // Event type resolution — supports wedding, birthday, corporate, etc.
  const rawEventType = eventTypeProp || 'wedding';
  const resolvedEventType: EventType = isValidEventType(rawEventType) ? rawEventType : 'wedding';
  const eventTypeLabel = getEventTypeLabel(resolvedEventType) || 'Arrangement';
  const eventCategory = getEventCategory(resolvedEventType);
  const contextLabels = getContextualLabels(resolvedEventType, eventCategory);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [timelineViewOpen, setTimelineViewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const queryClient = useQueryClient();
  
  // Create Timeline Dialog State (prefilled)
  const [createTimelineOpen, setCreateTimelineOpen] = useState(false);
  const [newTimelineData, setNewTimelineData] = useState<{ eventDate: string; venue: string; clientName: string }>({
    eventDate: '',
    venue: '',
    clientName: ''
  });
  
  // Auto-Adjust Timeline States
  const [showDelayDialog, setShowDelayDialog] = useState(false);
  const [delayEventId, setDelayEventId] = useState<string | null>(null);
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [delayReason, setDelayReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);
  
  // PIN/Password reset state
  const [pinPasswordDialogOpen, setPinPasswordDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetType, setResetType] = useState<'pin' | 'password' | 'both'>('both');
  const { profession } = useProfessionAdapter();
  const { settings, updateSetting } = useSettings();
  const timelinePrefillSettings = settings?.projectCreation?.timelinePrefill || {
    projectName: true,
    clientName: true,
    clientEmail: true,
    clientPhone: true,
    eventDate: true,
    venue: true,
    eventType: true,
    guestCount: true,
    location: true,
    culturalType: true,
    evendiCoupleId: true,
  };
  const timelinePrefillFields: Array<{
    key: keyof UserSettings['projectCreation']['timelinePrefill'];
    label: string;
  }> = [
    { key: 'projectName', label: 'Prosjektnavn' },
    { key: 'clientName', label: 'Kundenavn' },
    { key: 'clientEmail', label: 'Kunde e-post' },
    { key: 'clientPhone', label: 'Kunde telefon' },
    { key: 'eventDate', label: 'Dato' },
    { key: 'venue', label: 'Lokasjon / Venue' },
    { key: 'eventType', label: 'Event type' },
    { key: 'guestCount', label: 'Antall gjester' },
    { key: 'location', label: 'Prosjektlokasjon' },
    { key: 'culturalType', label: 'Kulturtype' },
    { key: 'evendiCoupleId', label: 'Evendi couple ID' },
  ];
  const timelinePrefillCount = Object.values(timelinePrefillSettings).filter(Boolean).length;
  const timelinePrefillTotal = timelinePrefillFields.length;
  const timelineSettings = settings?.weddingTimeline || {
    autoCreateOnProject: false,
    template: {
      defaultTemplate: 'standard',
      autoApplyTemplate: true,
      allowTemplateSave: true,
      templateScope: 'profession'
    },
    notifications: {
      clientChanges: true,
      timelineUpdates: true,
      autoAdjustments: true,
      accessGenerated: true
    },
    autoAdjust: {
      enabled: true,
      minDelayMinutes: 10,
      requireReason: true,
      excludeCompleted: true
    },
    privacy: {
      clientAccessDefault: 'read',
      allowDownload: false,
      allowSave: false,
      allowRightClick: false,
      requireApproval: true
    },
    sync: {
      enableGoogleDriveBackup: true,
      enableCalendarSync: false,
      calendarProvider: 'none',
      twoWaySync: false
    },
    viewDefaults: {
      defaultTab: 'overview',
      showClientNotes: true,
      showSpeechMarkers: true
    }
  };
  const defaultTabIndex = {
    overview: 0,
    events: 1,
    people: 2,
    speeches: 3,
    seating: 4,
    music: 5,
    coordinators: 6,
    reviews: 7,
    client: 8,
    settings: 9
  } as const;
  const initialTabIndex = defaultTabIndex[timelineSettings.viewDefaults.defaultTab] ?? 0;
  const [activeTab, setActiveTab] = useState<number>(initialTabIndex);
  const hasUserSetTabRef = React.useRef(false);
  const pendingCalendarEventRef = React.useRef<Partial<TimelineEvent> | null>(null);
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');

  // Integration system
  const { communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Push notifications - timelineId will be set after timeline is fetched
  const { user: currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.sub;
  const targetProjectId = selectedProjectId || projectId;

  const ensureDriveBackup = async (context: string) => {
    if (!timelineSettings.sync.enableGoogleDriveBackup || !targetProjectId) return;
    try {
      const response = await apiRequest(`/api/projects/${targetProjectId}/google-drive/initialize`, {
        method: 'POST'
      });
      dataFlow.syncData('wedding-timeline:drive-backup', {
        projectId: targetProjectId,
        context,
        folderPath: response?.folderPath
      });
    } catch (error) {
      console.warn('Drive backup initialization failed:', error);
    }
  };

  const syncTimelineToCalendar = async (payload: {
    title: string;
    date?: string;
    location?: string;
    type?: string;
  }) => {
    if (!timelineSettings.sync.enableCalendarSync) return;
    if (timelineSettings.sync.calendarProvider === 'none') return;
    if (!targetProjectId) return;

    try {
      await apiRequest('/api/events-management/events', {
        method: 'POST',
        body: {
          ...payload,
          projectId: targetProjectId,
          provider: timelineSettings.sync.calendarProvider,
          twoWaySync: timelineSettings.sync.twoWaySync,
        }
      });
    } catch (error) {
      console.warn('Calendar sync failed:', error);
    }
  };

  // Listen for prefill over bus
  React.useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'navigate:wedding-timeline' && message.data) {
        setPrefill(message.data);
      }
      if (message.type === 'data: sync' && message.data?.dataKey === 'wedding-timeline:prefill') {
        setPrefill(message.data.data);
      }
    });
    return unsubscribe;
  }, [communication]);

  React.useEffect(() => {
    if (!hasUserSetTabRef.current) {
      setActiveTab(defaultTabIndex[timelineSettings.viewDefaults.defaultTab] ?? 0);
    }
  }, [timelineSettings.viewDefaults.defaultTab]);

  // Prefill defaults when dialog opens or prefill changes
  React.useEffect(() => {
    if (!prefill) return;
    setNewTimelineData((prev) => ({
      eventDate: timelinePrefillSettings.eventDate
        ? prefill.eventDate || prev.eventDate || (prefill.eventDates ? Object.values(prefill.eventDates)[0] : '')
        : prev.eventDate,
      venue: timelinePrefillSettings.venue ? prefill.location || prev.venue : prev.venue,
      clientName: timelinePrefillSettings.clientName
        ? prefill.clientName || (timelinePrefillSettings.projectName ? prefill.projectName : undefined) || prev.clientName
        : prev.clientName,
    }));
  }, [prefill, timelinePrefillSettings]);

  // ======= EVENDI TRADITIONS BRIDGE =======
  const [evendiCulturalType, setEvendiCulturalType] = React.useState<string | null>(null);

  // Seed prefill from props/selection when coming from project creation
  React.useEffect(() => {
    if (prefill) return;
    const derivedPrefill = {
      projectName: timelinePrefillSettings.projectName
        ? selectedProject?.projectName || selectedProject?.name || selectedProject?.title
        : undefined,
      clientName: timelinePrefillSettings.clientName
        ? selectedProject?.clientName || selectedClient?.name
        : undefined,
      clientEmail: timelinePrefillSettings.clientEmail
        ? selectedProject?.clientEmail || selectedClient?.email
        : undefined,
      clientPhone: timelinePrefillSettings.clientPhone
        ? selectedProject?.clientPhone || selectedClient?.phone
        : undefined,
      eventDate: timelinePrefillSettings.eventDate
        ? selectedProject?.eventDate || selectedProject?.weddingDate
        : undefined,
      location: timelinePrefillSettings.location
        ? selectedProject?.location || selectedProject?.venue
        : undefined,
      venue: timelinePrefillSettings.venue
        ? selectedProject?.venue || selectedProject?.location
        : undefined,
      guestCount: timelinePrefillSettings.guestCount
        ? selectedProject?.guestCount
        : undefined,
      culturalType: timelinePrefillSettings.culturalType
        ? selectedProject?.culturalType || evendiCulturalType
        : undefined,
      eventType: timelinePrefillSettings.eventType
        ? eventTypeProp || selectedProject?.eventType || selectedProject?.projectType
        : undefined,
      evendiCoupleId: timelinePrefillSettings.evendiCoupleId ? evendiCoupleId : undefined
    };

    if (Object.values(derivedPrefill).some((value) => value)) {
      setPrefill(derivedPrefill);
    }
  }, [prefill, selectedProject, selectedClient, eventTypeProp, evendiCoupleId, evendiCulturalType, timelinePrefillSettings]);

  // Hent alle prosjekter for dropdown
  const { data: weddingProjects = [] } = useQuery({
    queryKey: ['/api/projects', { type: 'wedding',}],
    queryFn: () => apiRequest('/api/projects?type=wedding')
});

  const projectsResponse = weddingProjects as WeddingProject[] | { projects?: WeddingProject[]; data?: WeddingProject[] };
  const weddingProjectsList: WeddingProject[] = Array.isArray(projectsResponse)
    ? projectsResponse
    : (projectsResponse?.projects ?? projectsResponse?.data ?? []);

  // Hent valgt prosjekt med kulturdata
  const { data: currentProject } = useQuery({
    queryKey: ['/api/projects', selectedProjectId],
    queryFn: () => selectedProjectId ? apiRequest(`/api/projects/${selectedProjectId}`) : null,
    enabled: !!selectedProjectId
});

  React.useEffect(() => {
    if (!evendiCoupleId) return;
    const fetchTraditions = async () => {
      try {
        const data = await apiRequest(`/api/evendi/traditions-bridge?coupleId=${encodeURIComponent(evendiCoupleId)}`);
        if (data?.primaryCulturalType) {
          setEvendiCulturalType(data.primaryCulturalType);
          console.log(`🌍 Evendi traditions bridge: ${evendiCoupleId} → ${data.primaryCulturalType}`);
        }
      } catch (error) {
        console.warn('Evendi traditions bridge fetch failed (non-critical):', error);
      }
    };
    fetchTraditions();
  }, [evendiCoupleId]);
  // ======= END TRADITIONS BRIDGE =======

  // Automatisk kulturtilpasning basert på valgt prosjekt (evendi bridge → project → integration → default)
  const culturalType = evendiCulturalType || currentProject?.culturalType || projectIntegration?.culturalType || 'norsk';
  
  // Client access settings state
  const [clientSettings, setClientSettings] = useState({
    clientAccessEnabled: timelineSettings.privacy.clientAccessDefault !== 'off',
    allowDownload: timelineSettings.privacy.allowDownload,
    allowRightClick: timelineSettings.privacy.allowRightClick,
    allowSave: timelineSettings.privacy.allowSave,
    requireApproval: timelineSettings.privacy.requireApproval
  });
  const clientSettingsDirtyRef = React.useRef(false);

  React.useEffect(() => {
    if (clientSettingsDirtyRef.current) return;
    setClientSettings({
      clientAccessEnabled: timelineSettings.privacy.clientAccessDefault !== 'off',
      allowDownload: timelineSettings.privacy.allowDownload,
      allowRightClick: timelineSettings.privacy.allowRightClick,
      allowSave: timelineSettings.privacy.allowSave,
      requireApproval: timelineSettings.privacy.requireApproval
    });
  }, [timelineSettings.privacy]);

  // Handler for client settings changes
  const handleClientSettingChange = (key: string, value: unknown) => {
    console.log('Wedding timeline client setting changed:', key, value);
    const updatedSettings = { ...clientSettings, [key]: value };
    setClientSettings(updatedSettings);
    clientSettingsDirtyRef.current = true;
    onClientUpdate?.({ settings: updatedSettings, projectId: selectedProjectId || projectId, timestamp: new Date().toISOString() });
    // Sync client settings via data flow
    dataFlow.syncData('wedding-timeline:client-settings', updatedSettings);
    if (timelineSettings.notifications.clientChanges) {
      communication.sendMessage({
        from: 'wedding-timeline-admin',
        to: 'all',
        type: 'wedding-timeline:client-settings-changed',
        data: { projectId: selectedProjectId || projectId, settings: updatedSettings },
        priority: 'low'
      });
    }
};

  // Handler for viewing timeline
  const handleViewTimeline = () => {
    setTimelineViewOpen(true);
};

  // State for code generation
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Tidslinje-administrasjon logikk:
  // - Hvis weddingId er oppgitt: spesifikk arrangementstidslinje
  // - Hvis projectId er oppgitt: prosjekt-spesifikk tidslinje
  // - Hvis begge er null/undefined: generell tidslinje-mal administrasjon
  const timelineContext = weddingId 
    ? `${eventTypeLabel.toLowerCase()} ${weddingId}`
    : projectId 
      ? `prosjekt ${projectId}`
      : 'generelle tidslinje-maler';

  // Generate wedding timeline access code
  const generateClientAccess = useMutation({
    mutationFn: async (regenerate: boolean = false) => {
      const targetProjectId = projectIntegration?.projectId || projectId || 'wedding-demo-project';
      console.log('🔑 Genererer klienttilgang for prosjekt-ID, :', targetProjectId);
      const response = await apiRequest(`/api/projects/${targetProjectId}/wedding-timeline/client-access${regenerate ? '?regenerate=true' : ','}`, {
        method: 'GET'
  });
      return response;
  },
    onSuccess: (data) => {
      setClientUrl(data.clientUrl);
      setAccessCode(data.accessCode);
      setAccessToken(data.accessToken || '');
      setShareDialogOpen(true);
      // Notify parent about showcase/share creation
      onShowcaseCreate?.({ clientUrl: data.clientUrl, accessCode: data.accessCode, projectId: projectIntegration?.projectId || projectId });
      onWorklogCreate?.({ action: 'client-access-generated', projectId: projectIntegration?.projectId || projectId, timestamp: new Date().toISOString() });
      if (timelineSettings.notifications.accessGenerated) {
        communication.sendMessage({
          from: 'wedding-timeline-admin',
          to: 'all',
          type: 'wedding-timeline:client-access-generated',
          data: { projectId: projectIntegration?.projectId || projectId, clientUrl: data.clientUrl },
          priority: 'medium'
        });
      }
},
    onError: (error) => {
      console.error('Feil ved generering av klientlenke, :', error);
  }
});
  
  console.log(`� Evendi Timeline Admin: Administrerer ${timelineContext}`);

  // Create timeline mutation (project-specific)
  const createTimelineMutation = useMutation({
    mutationFn: async () => {
      const targetProjectId = selectedProjectId || projectId || 'wedding-demo-project';
      return apiRequest(`/api/wedding/timeline/project/${targetProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          eventDate: newTimelineData.eventDate,
          venue: newTimelineData.venue,
          clientName: newTimelineData.clientName,
          events: [],
          template: timelineSettings.template.autoApplyTemplate ? timelineSettings.template.defaultTemplate : undefined,
          templateScope: timelineSettings.template.templateScope
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: selectedProjectId || projectId
          ? ['/api/wedding/timeline/project', selectedProjectId || projectId]
          : ['/api/wedding/timeline/templates']
      });
      setCreateTimelineOpen(false);
      // Notify parent about project update and log worklog
      onProjectUpdate?.({ projectId: selectedProjectId || projectId, action: 'timeline-created', timelineData: newTimelineData });
      onWorklogCreate?.({ action: 'timeline-created', projectId: selectedProjectId || projectId, timestamp: new Date().toISOString() });
      // Sync timeline creation via data flow
      dataFlow.syncData('wedding-timeline:created', { projectId: selectedProjectId || projectId, ...newTimelineData });
      if (timelineSettings.notifications.timelineUpdates) {
        communication.sendMessage({
          from: 'wedding-timeline-admin',
          to: 'all',
          type: 'wedding-timeline:created',
          data: { projectId: selectedProjectId || projectId, timeline: newTimelineData },
          priority: 'medium'
        });
      }
      void syncTimelineToCalendar({
        title: newTimelineData.clientName ? `Tidslinje: ${newTimelineData.clientName}` : 'Ny tidslinje',
        date: newTimelineData.eventDate,
        location: newTimelineData.venue,
        type: 'wedding-timeline'
      });
      void ensureDriveBackup('timeline-created');
    }
  });

  // Check if we're in demo mode (projectId or weddingId starts with "demo-")
  const isDemoMode = projectId?.startsWith('demo-') || weddingId?.startsWith('demo-');

  // Fetch timeline data
  const { data: fetchedTimeline, isLoading: timelineLoading, isError: timelineError } = useQuery<EvendiTimeline>({
    queryKey: weddingId
      ? ['/api/wedding/timeline', weddingId]
      : projectId
        ? ['/api/wedding/timeline/project', projectId]
        : ['/api/wedding/timeline/templates'],
    retry: 1,
    enabled: !isDemoMode // Don't fetch if in demo mode
  });

  // Use demo data if in demo mode or if the API failed
  const timeline = isDemoMode || timelineError ? getDemoTimeline(resolvedEventType) : fetchedTimeline;
  const planningBrief = timeline?.timelineData?.planningBrief;
  const latestMeetingSync = timeline?.timelineData?.latestMeetingSync;
  const evendiMeetingContextAvailable = Boolean(
    planningBrief?.summary ||
      planningBrief?.requests ||
      planningBrief?.location ||
      planningBrief?.eventDate ||
      latestMeetingSync?.meetingTitle ||
      latestMeetingSync?.syncedAt,
  );
  const syncedSectionLabels = (latestMeetingSync?.selectedSections ?? [])
    .map((section) => {
      switch (section) {
        case 'summary':
          return 'Hovedpunkter';
        case 'actionItems':
          return 'Oppgaver';
        case 'decisions':
          return 'Beslutninger';
        case 'nextSteps':
          return 'Neste steg';
        case 'clientPoints':
          return 'Kundeønsker';
        case 'timelinePoints':
          return 'Tidslinjepunkter';
        default:
          return section;
      }
    })
    .filter(Boolean);
  const syncedMeetingEvent = latestMeetingSync?.meetingTitle
    ? timeline?.events.find((event) => event.title === `Møtenotat: ${latestMeetingSync.meetingTitle}`)
    : undefined;

  const icalBaseUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);
  const icalHttpUrl = accessToken ? `${icalBaseUrl}/api/wedding/timeline/ical/${accessToken}` : '';
  const icalWebcalUrl = icalHttpUrl ? icalHttpUrl.replace(/^https?/, 'webcal') : '';
  const fullClientUrl = clientUrl
    ? clientUrl.startsWith('http')
      ? clientUrl
      : `${icalBaseUrl}${clientUrl}`
    : '';

  // Push notifications - now that timeline is defined
  const timelineId = timeline?.id || selectedProjectId || projectId || weddingId;
  const { pushEnabled, isSupported } = usePushNotifications(userId, timelineId);

  // Fetch user profile for context
  const { data: userProfile } = useQuery({
    queryKey: ['/api/auth/user', ],
    retry: false,
    queryFn: () => apiRequest('/api/auth/user', ),
});

  // Add/update timeline event mutation
  const saveEventMutation = useMutation({
    onMutate: (eventData: Partial<TimelineEvent>) => {
      pendingCalendarEventRef.current = eventData;
    },
    mutationFn: async (eventData: Partial<TimelineEvent>) => {
      const endpoint = weddingId
        ? `/api/wedding/timeline/${weddingId}/events`
        : projectId
          ? `/api/wedding/timeline/project/${projectId}/events`
          : '/api/wedding/timeline/template/events';
      
      if (selectedEvent?.id) {
        return apiRequest(`${endpoint}/${selectedEvent.id}`, {
          headers: {
            "Content-Type" : "application/json"
      },
          method: 'PU',
          body: eventData
    });
    } else {
        return apiRequest(endpoint, {
          headers: {
            "Content-Type" : "application/json"
      },
          method: 'POST',
          body: eventData
    });
    }
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: weddingId 
          ? ['/api/wedding/timeline', weddingId]
          : projectId
            ? ['/api/wedding/timeline/project', projectId]
            : ['/api/wedding/timeline/templates']
    });
      // Notify parent about event and project changes
      const eventAction = selectedEvent ? 'event-updated' : 'event-created';
      onProjectUpdate?.({ projectId: projectId || selectedProjectId, action: eventAction, weddingId });
      onWorklogCreate?.({ action: eventAction, projectId: projectId || selectedProjectId, timestamp: new Date().toISOString() });
      if (!selectedEvent) {
        // New event created — notify as a meeting/scheduled item
        onMeetingCreate?.({ title: 'Timeline Event', projectId: projectId || selectedProjectId, createdAt: new Date().toISOString() });
      }
      // Sync event change via data flow
      dataFlow.syncData('wedding-timeline:event-change', { projectId: projectId || selectedProjectId, action: eventAction });
      if (timelineSettings.notifications.timelineUpdates) {
        communication.sendMessage({
          from: 'wedding-timeline-admin',
          to: 'all',
          type: 'wedding-timeline:event-change',
          data: { projectId: projectId || selectedProjectId, action: eventAction },
          priority: 'low'
        });
      }
      if (pendingCalendarEventRef.current?.title) {
        const calendarPayload = pendingCalendarEventRef.current;
        void syncTimelineToCalendar({
          title: calendarPayload.title || 'Tidslinjehendelse',
          date: calendarPayload.time || calendarPayload.originalTime || timeline?.eventDate,
          location: calendarPayload.location || timeline?.venue,
          type: 'wedding-timeline'
        });
      }
      void ensureDriveBackup('event-change');
      setEventDialogOpen(false);
      setSelectedEvent(null);
      pendingCalendarEventRef.current = null;
  }
});

  // Delete timeline event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const endpoint = weddingId
        ? `/api/wedding/timeline/${weddingId}/events/${eventId}`
        : projectId
          ? `/api/wedding/timeline/project/${projectId}/events/${eventId}`
          : `/api/wedding/timeline/template/events/${eventId}`;
      
      return apiRequest(endpoint, {
        method: 'DELETE'
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: weddingId 
          ? ['/api/wedding/timeline', weddingId]
          : projectId
            ? ['/api/wedding/timeline/project', projectId]
            : ['/api/wedding/timeline/templates']
    });
      onProjectUpdate?.({ projectId: projectId || selectedProjectId, action: 'event-deleted', weddingId });
      onWorklogCreate?.({ action: 'event-deleted', projectId: projectId || selectedProjectId, timestamp: new Date().toISOString() });
      dataFlow.syncData('wedding-timeline:event-change', { projectId: projectId || selectedProjectId, action: 'event-deleted' });
      if (timelineSettings.notifications.timelineUpdates) {
        communication.sendMessage({
          from: 'wedding-timeline-admin',
          to: 'all',
          type: 'wedding-timeline:event-deleted',
          data: { projectId: projectId || selectedProjectId, weddingId },
          priority: 'low'
        });
      }
      void ensureDriveBackup('event-deleted');
  }
});

  // Auto-Adjust Timeline: Mark event as delayed
  const markDelayedMutation = useMutation({
    mutationFn: async ({ eventId, delayMinutes, reason }: { eventId: string; delayMinutes: number; reason: string }) => {
      return apiRequest(`/api/timeline/${projectId}/mark-delayed?userId=${userProfile?.id}`, {
        method: 'POST',
        body: JSON.stringify({ eventId, delayMinutes, reason })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding/timeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/timeline', projectId, 'adjustment-status'] });
      setShowDelayDialog(false);
      setDelayMinutes(0);
      setDelayReason('');
      
      // Show success notification
      alert(`✅ Timeline auto-adjusted! ${data.adjustedEventsCount} events updated (+${data.delayMinutes} minutes)`);
      onWorklogCreate?.({ action: 'timeline-auto-adjusted', delayMinutes: data.delayMinutes, adjustedEvents: data.adjustedEventsCount, projectId, timestamp: new Date().toISOString() });
      onProjectUpdate?.({ projectId, action: 'timeline-delayed', delayMinutes: data.delayMinutes });
      dataFlow.syncData('wedding-timeline:delay', { projectId, delayMinutes: data.delayMinutes, adjustedCount: data.adjustedEventsCount });
      if (timelineSettings.notifications.autoAdjustments) {
        communication.sendMessage({
          from: 'wedding-timeline-admin',
          to: 'all',
          type: 'wedding-timeline:auto-adjusted',
          data: { projectId, delayMinutes: data.delayMinutes, adjustedCount: data.adjustedEventsCount },
          priority: 'medium'
        });
      }
      void ensureDriveBackup('auto-adjusted');
    }
  });

  // Auto-Adjust Timeline: Revert to original schedule
  const revertTimelineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/timeline/${projectId}/revert-to-original?userId=${userProfile?.id}`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/wedding/timeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/timeline', projectId, 'adjustment-status'] });
      
      // Show success notification
      alert(`🔄 Timeline reverted! ${data.revertedCount} events restored to original schedule`);
      onWorklogCreate?.({ action: 'timeline-reverted', revertedCount: data.revertedCount, projectId, timestamp: new Date().toISOString() });
      onProjectUpdate?.({ projectId, action: 'timeline-reverted' });
      dataFlow.syncData('wedding-timeline:reverted', { projectId, revertedCount: data.revertedCount });
      if (timelineSettings.notifications.autoAdjustments) {
        communication.sendMessage({
          from: 'wedding-timeline-admin',
          to: 'all',
          type: 'wedding-timeline:reverted',
          data: { projectId, revertedCount: data.revertedCount },
          priority: 'medium'
        });
      }
      void ensureDriveBackup('auto-adjust-reverted');
    }
  });

  // Handlers
  const handleMarkDelayed = (eventId: string) => {
    if (!timelineSettings.autoAdjust.enabled) {
      alert('Auto-justering er deaktivert i innstillingene.');
      return;
    }
    setDelayEventId(eventId);
    setShowDelayDialog(true);
  };

  const handleConfirmDelay = () => {
    if (!delayEventId || delayMinutes <= 0) return;
    if (delayMinutes < timelineSettings.autoAdjust.minDelayMinutes) {
      alert(`Minimum forsinkelse er ${timelineSettings.autoAdjust.minDelayMinutes} minutter.`);
      return;
    }
    if (timelineSettings.autoAdjust.requireReason && !delayReason.trim()) {
      alert('Du må oppgi årsak til forsinkelsen.');
      return;
    }
    
    setAdjusting(true);
    markDelayedMutation.mutate(
      { eventId: delayEventId, delayMinutes, reason: delayReason },
      {
        onSettled: () => setAdjusting(false)
      }
    );
  };

  const handleRevertTimeline = () => {
    if (!timelineSettings.autoAdjust.enabled) {
      alert('Auto-justering er deaktivert i innstillingene.');
      return;
    }
    if (!confirm('Revert all events back to original schedule?')) return;
    
    setAdjusting(true);
    revertTimelineMutation.mutate(undefined, {
      onSettled: () => setAdjusting(false)
    });
  };

  // File export handler — exports timeline data as JSON and notifies parent
  const handleExportTimeline = () => {
    if (!timeline) return;
    const exportData = JSON.stringify(timeline, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${timeline.clientName || projectId || 'export'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onFileDownload?.({ fileName: link.download, type: 'timeline-export', projectId: projectId || selectedProjectId });
    onWorklogCreate?.({ action: 'timeline-exported', projectId: projectId || selectedProjectId, timestamp: new Date().toISOString() });
  };

  const handleExportToIcal = () => {
    if (!timeline) return;
    const baseDate = timeline.eventDate || newTimelineData.eventDate || '';
    const sanitize = (value: string) => value.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
    const formatDateTime = (dateString: string, timeString?: string) => {
      if (!dateString) return '';
      const time = timeString && timeString.includes(':') ? `${timeString}:00` : '00:00:00';
      const iso = new Date(`${dateString}T${time}`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      return iso;
    };

    const events = (timeline.events || []).map((event) => {
      const start = formatDateTime(baseDate, event.time);
      const endDate = event.duration ? new Date(`${baseDate}T${event.time || '00:00'}:00`) : null;
      const end = endDate
        ? new Date(endDate.getTime() + event.duration * 60000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        : '';
      return [
        'BEGIN:VEVENT',
        `UID:${event.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`}@creatorhubn`,
        `DTSTAMP:${formatDateTime(new Date().toISOString().split('T')[0])}`,
        start ? `DTSTART:${start}` : '',
        end ? `DTEND:${end}` : '',
        `SUMMARY:${sanitize(event.title || 'Timeline Event')}`,
        event.location ? `LOCATION:${sanitize(event.location)}` : '',
        event.description ? `DESCRIPTION:${sanitize(event.description)}` : '',
        'END:VEVENT'
      ].filter(Boolean).join('\n');
    });

    const calendarName = sanitize(timeline.clientName || timeline.venue || 'Timeline');
    const icalContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CreatorHubN//Wedding Timeline//EN',
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${calendarName}`,
      ...events,
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${timeline.clientName || projectId || 'export'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onFileDownload?.({ fileName: link.download, type: 'timeline-ical-export', projectId: projectId || selectedProjectId });
    onWorklogCreate?.({ action: 'timeline-ical-exported', projectId: projectId || selectedProjectId, timestamp: new Date().toISOString() });
  };

  // File import handler — imports timeline data from JSON file
  const handleImportTimeline = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        // Prefill from imported data
        if (importedData.eventDate || importedData.weddingDate || importedData.venue || importedData.clientName || importedData.coupleName) {
          setNewTimelineData({
            eventDate: importedData.eventDate || importedData.weddingDate || '',
            venue: importedData.venue || '',
            clientName: importedData.clientName || importedData.coupleName || '',
          });
          setCreateTimelineOpen(true);
        }
        onFileUpload?.({ fileName: file.name, type: 'timeline-import', data: importedData, projectId: projectId || selectedProjectId });
        onWorklogCreate?.({ action: 'timeline-imported', projectId: projectId || selectedProjectId, fileName: file.name, timestamp: new Date().toISOString() });
      } catch (err) {
        console.error('Failed to parse imported timeline file:', err);
      }
    };
    reader.readAsText(file);
    // Reset the input
    event.target.value = '';
  };

  // Skip loading state in demo mode since we use static data
  if (timelineLoading && !isDemoMode) {
    return <Box sx={{ p:  3 }}>Laster tidslinje-administrasjon...</Box>;
  }

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Event sx={{ color: theming.colors.primary }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            Evendi Tidslinje — {eventTypeLabel}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {timeline?.clientAccessEnabled && icalWebcalUrl && (
            <Tooltip title="Kopier iCal-abonnement">
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopy />}
                onClick={() => {
                  navigator.clipboard.writeText(icalWebcalUrl);
                }}
              >
                iCal
              </Button>
            </Tooltip>
          )}
          {/* Push notification status indicator */}
          {isSupported && (
            <Chip
              icon={<Notifications />}
              label={pushEnabled ? 'Varsler aktive' : 'Varsler av'}
              size="small"
              color={pushEnabled ? 'success' : 'default'}
              variant={pushEnabled ? 'filled' : 'outlined'}
            />
          )}
          {/* Selected client indicator */}
          {selectedClient && (
            <Chip
              icon={<People />}
              label={selectedClient.name || selectedClient.email || 'Klient'}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          <Tooltip title="Hjelp og veiledning">
            <IconButton onClick={() => setHelpOpen(true)} sx={{ color: theming.colors.primary }}>
              <HelpOutline />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Help Modal */}
      <WeddingTimelineHelp open={helpOpen} onClose={() => setHelpOpen(false)} mode="admin" />

      {/* Timeline Context Info - følger zero toast-policy */}
      <Alert 
        severity="info" 
        sx={{ mb:  3, backgroundColor: '#FFF3E0', border: '1px solid #FF9800'}}
        icon={<Settings sx={{ color: '#FF9800'}} />}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {weddingId 
            ? `Administrerer ${contextLabels.contextPrefix}tidslinje for ${weddingId}`
            : projectId 
              ? `Administrerer tidslinje for prosjekt ${projectId}`
              : `Administrerer generelle tidslinje-maler for ${eventTypeLabel.toLowerCase()}`
        }
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {weddingId 
            ? contextLabels.specificInfoText
            : projectId 
              ? 'Endringer gjelder kun dette fotograferingsprosjektet'
              : contextLabels.templateInfoText
        }
        </Typography>
      </Alert>

      <Card
        sx={{
          mb: 3,
          bgcolor: 'rgba(255,252,245,0.98)',
          border: '1px solid rgba(161,98,7,0.14)',
          boxShadow: '0 18px 48px rgba(148, 116, 43, 0.08)',
          ...theming.getThemedCardSx(),
        }}
      >
        <CardContent sx={{ p: 3.25 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 2.25,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(245,124,0,0.12)',
                  color: '#b45309',
                }}
              >
                <Lightbulb />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#8a4b08' }}>
                  Evendi møtekontekst
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prosjektbrief, forespørsel og siste møtesynk brukes som planleggingskontekst i tidslinjen.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                size="small"
                color={evendiMeetingContextAvailable ? 'success' : 'default'}
                variant={evendiMeetingContextAvailable ? 'filled' : 'outlined'}
                label={evendiMeetingContextAvailable ? 'Kontekst synket til Evendi' : 'Venter på første møtesynk'}
              />
              {(latestMeetingSync?.projectTitle || planningBrief?.title || currentProject?.projectName) && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Prosjekt: ${latestMeetingSync?.projectTitle || planningBrief?.title || currentProject?.projectName}`}
                />
              )}
            </Box>
          </Box>

          {evendiMeetingContextAvailable ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', border: '1px solid rgba(15,23,42,0.08)', boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.86)' }}>
                  <CardContent sx={{ p: 2.25 }}>
                    <Typography variant="overline" sx={{ color: '#8a4b08', fontWeight: 700 }}>
                      Siste synk
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
                      {latestMeetingSync?.meetingTitle || 'Møtenotat ikke synket ennå'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {latestMeetingSync?.syncedAt
                        ? `Oppdatert ${formatNorwegianDateTime(latestMeetingSync.syncedAt)}`
                        : 'Bruk Smart Meeting Notes og Synk til Evendi for å fylle tidslinjen med møteinnsikt.'}
                    </Typography>
                    {syncedMeetingEvent && (
                      <Alert severity="success" sx={{ mt: 1.5 }}>
                        Opprettet som tidslinjehendelse{syncedMeetingEvent.time ? ` kl. ${syncedMeetingEvent.time}` : ''}.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', border: '1px solid rgba(15,23,42,0.08)', boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.86)' }}>
                  <CardContent sx={{ p: 2.25 }}>
                    <Typography variant="overline" sx={{ color: '#8a4b08', fontWeight: 700 }}>
                      Kunde og lokasjon
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.75 }}>
                      {latestMeetingSync?.clientName || planningBrief?.clientName || currentProject?.clientName || timeline?.clientName || timeline?.coupleName || 'Kunde ikke valgt'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, color: 'text.secondary' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationOn sx={{ fontSize: 18 }} />
                        <Typography variant="body2">
                          {planningBrief?.location || latestMeetingSync?.location || timeline?.venue || 'Lokasjon ikke satt'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarToday sx={{ fontSize: 18 }} />
                        <Typography variant="body2">
                          {formatNorwegianDate(planningBrief?.eventDate || timeline?.eventDate)}
                        </Typography>
                      </Box>
                      {planningBrief?.timeframe && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Schedule sx={{ fontSize: 18 }} />
                          <Typography variant="body2">{planningBrief.timeframe}</Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', border: '1px solid rgba(15,23,42,0.08)', boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.86)' }}>
                  <CardContent sx={{ p: 2.25 }}>
                    <Typography variant="overline" sx={{ color: '#8a4b08', fontWeight: 700 }}>
                      Hva Evendi bruker
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      {latestMeetingSync?.baseMode === 'project' ? 'Prosjektnotat med NotebookLM- og Evendi-kontekst' : 'Notat koblet til prosjektkontekst'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {syncedSectionLabels.length > 0 ? (
                        syncedSectionLabels.map((label) => (
                          <Chip key={label} label={label} size="small" variant="outlined" />
                        ))
                      ) : (
                        <Chip label="Ingen seksjoner synket ennå" size="small" variant="outlined" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {(planningBrief?.summary || latestMeetingSync?.briefSummary) && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', border: '1px solid rgba(245,124,0,0.14)', boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.86)' }}>
                    <CardContent sx={{ p: 2.25 }}>
                      <Typography variant="overline" sx={{ color: '#8a4b08', fontWeight: 700 }}>
                        Prosjektbrief fra forespørsel
                      </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                        {planningBrief?.summary || latestMeetingSync?.briefSummary}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {(planningBrief?.requests || latestMeetingSync?.specialRequests) && (
                <Grid item xs={12} md={6}>
                  <Card sx={{ height: '100%', border: '1px solid rgba(34,197,94,0.14)', boxShadow: 'none', bgcolor: 'rgba(255,255,255,0.86)' }}>
                    <CardContent sx={{ p: 2.25 }}>
                      <Typography variant="overline" sx={{ color: '#166534', fontWeight: 700 }}>
                        Kundeønsker og spesielle hensyn
                      </Typography>
                      <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                        {planningBrief?.requests || latestMeetingSync?.specialRequests}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          ) : (
            <Alert severity="info" sx={{ backgroundColor: 'rgba(255,255,255,0.88)' }}>
              Når du bruker <strong>Smart Meeting Notes</strong> med prosjektnotater og velger <strong>Synk til Evendi</strong>,
              vises prosjektbrief, kundeønsker, møtetittel og synkede seksjoner her automatisk.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Prefill notice */}
      {prefill && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>Forhåndsutfylling mottatt fra prosjektopprettelse</Typography>
          {timelinePrefillSettings.projectName && (
            <Typography variant="caption" display="block">Prosjektnavn: {prefill.projectName || '—'}</Typography>
          )}
          {timelinePrefillSettings.clientName && (
            <Typography variant="caption" display="block">Kunde: {prefill.clientName || '—'}</Typography>
          )}
          {timelinePrefillSettings.clientEmail && (
            <Typography variant="caption" display="block">Kunde: {prefill.clientEmail || '—'}</Typography>
          )}
          {timelinePrefillSettings.clientPhone && (
            <Typography variant="caption" display="block">Telefon: {prefill.clientPhone || '—'}</Typography>
          )}
          {timelinePrefillSettings.eventDate && (
            <Typography variant="caption" display="block">Dato: {prefill.eventDate || '—'}</Typography>
          )}
          {prefill.eventDates && (
            <Typography variant="caption" display="block">Datoer: {Object.values(prefill.eventDates).join('')}</Typography>
          )}
          {timelinePrefillSettings.location && (
            <Typography variant="caption" display="block">Lokasjon: {prefill.location || '—'}</Typography>
          )}
          {timelinePrefillSettings.guestCount && (
            <Typography variant="caption" display="block">Gjester: {prefill.guestCount || '—'}</Typography>
          )}
          {timelinePrefillSettings.culturalType && (
            <Typography variant="caption" display="block">Kulturtype: {prefill.culturalType || evendiCulturalType || '—'}</Typography>
          )}
          {timelinePrefillSettings.eventType && (
            <Typography variant="caption" display="block">Event type: {prefill.eventType || resolvedEventType}</Typography>
          )}
          {timelinePrefillSettings.evendiCoupleId && prefill.evendiCoupleId && (
            <Typography variant="caption" display="block">Evendi couple ID: {prefill.evendiCoupleId}</Typography>
          )}
        </Alert>
      )}

      {/* Prosjektvelger og kulturtilpasning */}
      <Card sx={{ mb:  3, bgcolor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(15,23,42,0.08)',  ...theming.getThemedCardSx() }}>
        <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" sx={{  mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
            <Event sx={{ color: '#f57c00'}} />
            Prosjektintegrasjon & Kulturtilpasning
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{contextLabels.projectLabel}</InputLabel>
                <Select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setSelectedProjectId(val);
                    if (val) {
                      const project = weddingProjectsList.find((p) => p.id === val);
                      if (project) {
                        onProjectSelect?.(project);
                        if (project.clientName) {
                          onClientSelect?.({ name: project.clientName, id: project.clientId, projectId: val });
                        }
                      }
                    }
                  }}
                  label={contextLabels.projectLabel}
                >
                  <MenuItem value="">
                    <em>Generell tidslinje (ingen prosjekt)</em>
                  </MenuItem>
                  {weddingProjectsList.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.projectName || ''} - {project.clientName || ''} ({project.culturalType || 'norsk'})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Kulturtilpasning"
                value={culturalType}
                disabled
                helperText={currentProject ? `Automatisk satt fra prosjekt: ${currentProject.projectName}` : 'Velg et prosjekt for automatisk kulturtilpasning'}
                InputProps={{
                  startAdornment: <LocationOn sx={{ mr: 1, color: 'text.secondary'}} />
              }}
              />
            </Grid>

            {currentProject && (
              <Grid item xs={12}>
                <Alert severity="success" sx={{ mt:  1 }}>
                  <strong>Prosjekt tilkoblet: </strong> {currentProject.projectName} <br />
                  <strong>Kultur: </strong> {culturalType} | <strong>Klient: </strong> {currentProject.clientName}
                  {currentProject.showcaseGallerySecurity?.passwordRequired && (
                    <><br /><strong>Showcase passord: </strong> Vil brukes for klienttilgang</>
                 )}
                </Alert>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => {
          hasUserSetTabRef.current = true;
          setActiveTab(newValue);
        }}
        sx={{ mb: 3 }}
      >
        <Tab label="Timeline Oversikt" />
        <Tab label="Hendelser" />
        <Tab label="Deltakere & Leverandører" />
        <Tab label="Taler / Program" />
        <Tab label="Bordplassering" />
        <Tab label="Musikk" />
        <Tab label="Koordinatorer" />
        <Tab label="Anmeldelser" />
        <Tab label="Klienttilgang" />
        <Tab label="Innstillinger" />
        <Tab label="Google Drive Backup" />
      </Tabs>

      {/* Timeline Overview Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('schedule')} Tidslinje Oversikt
                </Typography>
                
                {timeline ? (
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {timeline.clientName || contextLabels.newPlaceholder}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CalendarToday sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {timeline.eventDate || 'Dato ikke satt'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <LocationOn sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {timeline.venue || 'Lokasjon ikke satt'}
                      </Typography>
                    </Box>
                    <Typography variant="body2">
                      Antall hendelser: {timeline.events?.length || 0}
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {weddingId || projectId 
                        ? 'Ingen tidslinje funnet. Opprett ny tidslinje for dette prosjektet.'
                        : contextLabels.noTimelinePlaceholder
                    }
                    </Typography>
                    <Button variant="contained" 
                      startIcon={theming.getThemedIcon('add')}
                      onClick={() => {
                        setNewTimelineData({
                          eventDate: prefill?.eventDate || (prefill?.eventDates ? Object.values(prefill.eventDates)[0] : '' ) || ',',
                          venue: prefill?.location || '',
                          clientName: prefill?.projectName || ''
                        });
                        setCreateTimelineOpen(true);
                      }}
                      sx={{ bgcolor: '#E91E60', '&:hover': { bgcolor: '#C2185B'}}}
                    >
                      {weddingId || projectId ? 'Opprett Tidslinje' : 'Ny Mal'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('cloudDone')} Automatisk Backup
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  {timelineSettings.sync.enableGoogleDriveBackup
                    ? 'Alle tidslinje-endringer lagres automatisk til din Google Drive.'
                    : 'Automatisk Google Drive-backup er deaktivert i innstillingene.'}
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  startIcon={theming.getThemedIcon('cloudDone')}
                  disabled={!timelineSettings.sync.enableGoogleDriveBackup}
                >
                  Se Backup Status
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{
              ...theming.getThemedCardSx(),
              border: '3px solid',
              borderColor: timeline?.clientAccessEnabled ? ((theming.colors as Record<string, string>).success || '#4caf50') : theming.colors.primary,
              bgcolor: timeline?.clientAccessEnabled ? 'rgba(76, 175, 80, 0.05)' : 'rgba(233, 30, 99, 0.05)'
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Key sx={{ fontSize: '2rem', color: theming.colors.primary }} />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                        Klienttilgang
                      </Typography>
                      <Chip
                        label={timeline?.clientAccessEnabled ? 'Aktivert' : 'Ikke aktivert'}
                        color={timeline?.clientAccessEnabled ? 'success' : 'default'}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                  {timeline?.clientAccessEnabled && clientUrl && (
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopy />}
                      onClick={() => {
                        navigator.clipboard.writeText(fullClientUrl);
                      }}
                    >
                      Kopier lenke
                    </Button>
                  )}
                </Box>
                
                {timeline?.clientAccessEnabled && accessCode ? (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        Tilgangskode: <strong>{accessCode}</strong>
                      </Typography>
                      <Typography variant="caption">
                        Klienter kan bruke denne koden for å få tilgang til tidslinjen
                      </Typography>
                    </Alert>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        startIcon={<Key />}
                        onClick={() => {
                          if (!clientUrl || !accessToken) {
                            generateClientAccess.mutate(false);
                          } else {
                            setShareDialogOpen(true);
                          }
                        }}
                        sx={theming.getThemedButtonSx()}
                      >
                        Vis detaljer & QR-kode
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Settings />}
                        onClick={() => {
                          // Open PIN/password reset dialog
                          setActiveTab(2); // Switch to Settings tab
                        }}
                      >
                        Endre PIN/Passord
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Generer tilgangskode for klienten slik at de kan følge tidslinjen på arrangementsdagen.
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<Key />}
                      onClick={() => generateClientAccess.mutate(false)}
                      disabled={generateClientAccess.isPending}
                      sx={theming.getThemedButtonSx()}
                    >
                      {generateClientAccess.isPending ? 'Genererer...' : 'Generer tilgangskode'}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Events Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Tidslinje Hendelser</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {/* Revert Timeline Button */}
              <Tooltip title="Tilbakestill tidslinje til opprinnelig tidsplan">
                <span>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<Schedule />}
                    onClick={handleRevertTimeline}
                    disabled={adjusting || !timeline?.events?.some(e => e.isDelayed)}
                  >
                    Tilbakestill
                  </Button>
                </span>
              </Tooltip>
              {/* Export Timeline */}
              <Tooltip title="Eksporter tidslinje som JSON">
                <Button
                  variant="outlined"
                  startIcon={<CalendarToday />}
                  onClick={handleExportTimeline}
                  disabled={!timeline}
                >
                  Eksporter
                </Button>
              </Tooltip>
              {/* Export iCal */}
              <Tooltip title="Eksporter tidslinje som iCal">
                <Button
                  variant="outlined"
                  startIcon={<CalendarToday />}
                  onClick={handleExportToIcal}
                  disabled={!timeline}
                >
                  Eksporter iCal
                </Button>
              </Tooltip>
              {/* Import Timeline */}
              <Tooltip title="Importer tidslinje fra fil">
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<Settings />}
                >
                  Importer
                  <input type="file" accept=".json" hidden onChange={handleImportTimeline} />
                </Button>
              </Tooltip>
              {/* Add Event */}
              <Button variant="contained"
                startIcon={theming.getThemedIcon('add')}
                onClick={() => {
                  setSelectedEvent(null);
                  setEventDialogOpen(true);
                }}
                sx={{ bgcolor: '#E91E60','&:hover': { bgcolor: '#C2185B' }, ...theming.getThemedButtonSx() }}
              >
                Ny Hendelse
              </Button>
            </Box>
          </Box>

          <Card sx={theming.getThemedCardSx()}>
            <List>
              {timeline?.events?.map((event) => (
                <ListItem key={event.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1">{event.title}</Typography>
                        {timelineSettings.viewDefaults.showClientNotes && event.clientNotes && (
                          <Chip
                            icon={<Pending />}
                            label="Klientendring"
                            size="small"
                            sx={{
                              bgcolor: '#e3f2fd',
                              color: '#1976d2',
                              fontSize: '0.7rem',
                              height: '20px'
                            }}
                          />
                        )}
                        <Chip
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
                            fontSize: '0.7rem',
                            height: '20px'
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <AccessTime sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                          <Typography variant="caption" display="block">
                            {event.time} ({event.duration} min)
                          </Typography>
                        </Box>
                        {event.location && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <LocationOn sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                            <Typography variant="caption" display="block">
                              {event.location}
                            </Typography>
                          </Box>
                        )}
                        {event.description && (
                          <Typography variant="caption" display="block">
                            {event.description}
                          </Typography>
                        )}
                        {timelineSettings.viewDefaults.showClientNotes && event.clientNotes && (
                          <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
                            <Typography variant="caption">
                              <strong>Klientnotat:</strong> {event.clientNotes}
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                  }
                  />
                  <ListItemSecondaryAction>
                    {/* Auto-Adjust: Mark Delayed Button */}
                    <Tooltip title="Merk som forsinket (auto-juster tidslinje)">
                      <IconButton 
                        onClick={() => handleMarkDelayed(event.id)}
                        disabled={!timelineSettings.autoAdjust.enabled}
                        sx={{ mr: 1 }}
                      >
                        <AccessTime sx={{ color: event.isDelayed ? '#FF9800' : '#757575' }} />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="Rediger hendelse">
                      <IconButton 
                        edge="end" 
                        onClick={() => {
                          setSelectedEvent(event);
                          setEventDialogOpen(true);
                        }}
                        sx={{ mr: 1 }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Slett hendelse">
                      <IconButton 
                        edge="end"
                      onClick={() => deleteEventMutation.mutate(event.id)}
                      color="error"
                    >
                      {theming.getThemedIcon('delete')}
                    </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              )) || (
                <ListItem>
                  <ListItemText 
                    primary="Ingen hendelser enda"
                    secondary="Legg til hendelser for å bygge tidslinja"
                  />
                </ListItem>
              )}
            </List>
          </Card>
        </Box>
      )}

      {/* Deltakere & Leverandører Tab — Evendi Important People Bridge */}
      {activeTab === 2 && (
        <Box>
          <EvendiImportantPeople />
        </Box>
      )}

      {/* Speeches / Program Tab — Evendi Speeches Bridge */}
      {activeTab === 3 && (
        <Box>
          {evendiCoupleId ? (
            <EvendiSpeeches
              coupleId={evendiCoupleId}
              eventType={resolvedEventType as any}
            />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Koble til en arrangør via Evendi for å se taler og programpunkter.
            </Alert>
          )}
        </Box>
      )}

      {/* Seating / Tables Tab — Evendi Seating Bridge */}
      {activeTab === 4 && (
        <Box>
          {evendiCoupleId ? (
            <EvendiSeating
              coupleId={evendiCoupleId}
              eventType={resolvedEventType as any}
            />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Koble til en arrangør via Evendi for å se bordplassering.
            </Alert>
          )}
        </Box>
      )}

      {/* Music Tab — Evendi Music Bridge */}
      {activeTab === 5 && (
        <Box>
          {evendiCoupleId ? (
            <EvendiMusic
              coupleId={evendiCoupleId}
              eventType={resolvedEventType as any}
            />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Koble til en arrangør via Evendi for å se musikkdata.
            </Alert>
          )}
        </Box>
      )}

      {/* Coordinators Tab — Evendi Coordinators Bridge */}
      {activeTab === 6 && (
        <Box>
          {evendiCoupleId ? (
            <EvendiCoordinators
              coupleId={evendiCoupleId}
              eventType={resolvedEventType as any}
            />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Koble til en arrangør via Evendi for å se koordinatorer.
            </Alert>
          )}
        </Box>
      )}

      {/* Reviews Tab — Evendi Reviews Bridge */}
      {activeTab === 7 && (
        <Box>
          {userId ? (
            <EvendiReviews
              vendorId={userId}
            />
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Logg inn for å se dine anmeldelser.
            </Alert>
          )}
        </Box>
      )}

      {/* Client Access Tab */}
      {activeTab === 8 && (
        <Box>
          <Typography variant="h6" sx={{  mb:  3  }}>Klienttilgang til Tidslinje</Typography>
          
          {/* Showcase Password Integration */}
          {currentProject?.showcaseGallerySecurity?.passwordRequired && (
            <Card sx={{ mb:  3, bgcolor: 'rgba(25, 1240.1)', border: '1px solid #f57c00',  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Key sx={{ color: theming.colors.primary }} />
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Showcase Gallery Integration
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ mb:  2 }}>
                  Dette prosjektet har showcase gallery med passord aktivert. Du kan velge: </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Button 
                      variant="outlined"
                      fullWidth
                      startIcon={<Event />}
                      sx={{ borderColor: '#f57c00', color: '#f57c00'}}
                    >
                      Bruk samme passord som showcase
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={theming.getThemedIcon('settings')}
                      sx={{ borderColor: '#666', color: '#666' }}
                    >
                      Lag eget tilgangskode-system
                    </Button>
                  </Grid>
                </Grid>
                <Alert severity="info" sx={{ mt:  2 }}>
                  <strong>Showcase passord: </strong> ••••••••
                  <br />
                  <strong>Anbefaling:</strong> Bruk samme passord for enkel tilgang for klienten
                </Alert>
              </CardContent>
            </Card>
         )}

          {/* Live Wedding Timeline Component */}
          <Card 
            sx={{ 
              mb: 3,
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)'
            }}
          >
            {/* Modern Gradient Header */}
            <Box
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                p: 3,
                color: 'white'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <CalendarToday sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Live Tidslinje
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    Klienten kan følge tidslinjen live på arrangementsdagen med kulturtilpassede aktiviteter
                  </Typography>
                </Box>
              </Box>
            </Box>

            <CardContent sx={{ p: 3 }}>
              {currentProject && (
                <WeddingTimeline 
                  mode="embedded"
                  culturalType={culturalType}
                  projectIntegration={{
                    projectId: selectedProject,
                    weddingTimelineIntegrated: true,
                    culturalType: culturalType
              }}
                />
              )}
            </CardContent>
          </Card>

          <ClientAccessSettings
            settings={clientSettings}
            onSettingChange={handleClientSettingChange}
            title="Avanserte Klienttilgang Innstillinger"
            description="Kontroller hva klienter kan gjøre med tidslinjen"
            projectId={selectedProjectId || projectId || weddingId}
            onViewTimeline={handleViewTimeline}
          />
        </Box>
      )}

      {/* Settings Tab */}
      {activeTab === 9 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
            Innstillinger
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Settings sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Forhåndsutfylling ved ny tidslinje
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Velg hvilke prosjekt- og kundefelt Evendi skal bruke når nye tidslinjer opprettes fra prosjektkontekst.
                  </Typography>

                  <Alert severity="info" sx={{ mb: 2.5 }}>
                    Disse valgene styrer hva som fylles inn automatisk når du oppretter eller åpner en ny Evendi-tidslinje.
                  </Alert>

                  <FormGroup>
                    {timelinePrefillFields.map((item) => (
                      <FormControlLabel
                        key={item.key}
                        control={
                          <Switch
                            checked={timelinePrefillSettings[item.key]}
                            onChange={(event) =>
                              updateSetting('projectCreation', {
                                timelinePrefill: {
                                  ...timelinePrefillSettings,
                                  [item.key]: event.target.checked,
                                },
                              })
                            }
                          />
                        }
                        label={item.label}
                      />
                    ))}
                  </FormGroup>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Valgt: {timelinePrefillCount}/{timelinePrefillTotal}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() =>
                          updateSetting('projectCreation', {
                            timelinePrefill: Object.fromEntries(
                              timelinePrefillFields.map((field) => [field.key, true]),
                            ) as UserSettings['projectCreation']['timelinePrefill'],
                          })
                        }
                      >
                        Velg alle
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() =>
                          updateSetting('projectCreation', {
                            timelinePrefill: Object.fromEntries(
                              timelinePrefillFields.map((field) => [field.key, false]),
                            ) as UserSettings['projectCreation']['timelinePrefill'],
                          })
                        }
                      >
                        Fjern alle
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Schedule sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Auto-justering
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Styr hvordan Evendi skal håndtere forsinkelser og automatisk flytte resten av tidslinjen.
                  </Typography>

                  <FormGroup sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.autoAdjust.enabled}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              autoAdjust: { ...timelineSettings.autoAdjust, enabled: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Aktiver auto-justering"
                    />
                  </FormGroup>

                  <TextField
                    fullWidth
                    label="Minimum forsinkelse (min)"
                    type="number"
                    value={timelineSettings.autoAdjust.minDelayMinutes}
                    onChange={(event) =>
                      updateSetting('weddingTimeline', {
                        ...timelineSettings,
                        autoAdjust: {
                          ...timelineSettings.autoAdjust,
                          minDelayMinutes: Number(event.target.value),
                        },
                      })
                    }
                    inputProps={{ min: 0 }}
                    sx={{ mb: 2 }}
                  />

                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.autoAdjust.requireReason}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              autoAdjust: { ...timelineSettings.autoAdjust, requireReason: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Krev årsak for forsinkelse"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.autoAdjust.excludeCompleted}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              autoAdjust: { ...timelineSettings.autoAdjust, excludeCompleted: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Hopp over fullførte hendelser"
                    />
                  </FormGroup>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Settings sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Personvern & Klienttilgang
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Sett standard tilgangsnivå og hva klienter kan gjøre når Evendi-tidslinjen deles.
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Standard klienttilgang</InputLabel>
                    <Select
                      value={timelineSettings.privacy.clientAccessDefault}
                      label="Standard klienttilgang"
                      onChange={(event) =>
                        updateSetting('weddingTimeline', {
                          ...timelineSettings,
                          privacy: {
                            ...timelineSettings.privacy,
                            clientAccessDefault: event.target.value as UserSettings['weddingTimeline']['privacy']['clientAccessDefault'],
                          },
                        })
                      }
                    >
                      <MenuItem value="off">Av</MenuItem>
                      <MenuItem value="read">Les</MenuItem>
                      <MenuItem value="comment">Kommentar</MenuItem>
                    </Select>
                  </FormControl>

                  <FormGroup>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.privacy.allowDownload}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              privacy: { ...timelineSettings.privacy, allowDownload: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Tillat nedlasting"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.privacy.allowSave}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              privacy: { ...timelineSettings.privacy, allowSave: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Tillat lagring/kopiering"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.privacy.allowRightClick}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              privacy: { ...timelineSettings.privacy, allowRightClick: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Tillat hoyreklikk"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={timelineSettings.privacy.requireApproval}
                          onChange={(event) =>
                            updateSetting('weddingTimeline', {
                              ...timelineSettings,
                              privacy: { ...timelineSettings.privacy, requireApproval: event.target.checked },
                            })
                          }
                        />
                      }
                      label="Krev godkjenning"
                    />
                  </FormGroup>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    Mer avansert klientdeling ligger fortsatt under egen <strong>Klienttilgang</strong>-fane i Evendi.
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            {/* PIN/Password Reset */}
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Key sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      PIN / Passord
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Endre PIN eller passord for klienttilgang
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Endre</InputLabel>
                    <Select
                      value={resetType}
                      label="Endre"
                      onChange={(e) => setResetType(e.target.value as 'pin' | 'password' | 'both')}
                    >
                      <MenuItem value="pin">Kun PIN</MenuItem>
                      <MenuItem value="password">Kun Passord</MenuItem>
                      <MenuItem value="both">Begge</MenuItem>
                    </Select>
                  </FormControl>

                  {(resetType === 'pin' || resetType === 'both') && (
                    <TextField
                      fullWidth
                      label="Ny PIN (4 siffer)"
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').substring(0, 4))}
                      sx={{ mb: 2 }}
                      inputProps={{ maxLength: 4, inputMode: 'numeric' }}
                      helperText="4 siffer"
                    />
                  )}

                  {(resetType === 'password' || resetType === 'both') && (
                    <>
                      <TextField
                        fullWidth
                        label="Nytt Passord"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        sx={{ mb: 2 }}
                      />
                      <TextField
                        fullWidth
                        label="Bekreft Passord"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        error={newPassword !== confirmPassword && confirmPassword !== ''}
                        helperText={newPassword !== confirmPassword && confirmPassword !== '' ? 'Passordene matcher ikke' : ','}
                      />
                    </>
                  )}

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={async () => {
                      if (resetType === 'password' && newPassword !== confirmPassword) {
                        return;
                      }
                      try {
                        await apiRequest(`/api/wedding-timeline/${timeline?.id || selectedProjectId}/security`, {
                          method: 'PUT',
                          body: JSON.stringify({
                            pin: resetType === 'pin' || resetType === 'both' ? newPin : undefined,
                            password: resetType === 'password' || resetType === 'both' ? newPassword : undefined,
                          }),
                        });
                        setNewPin('');
                        setNewPassword('');
                        setConfirmPassword('');
                        // Show success confirmation dialog
                        setPinPasswordDialogOpen(true);
                        onWorklogCreate?.({ action: 'security-updated', resetType, projectId: projectId || selectedProjectId, timestamp: new Date().toISOString() });
                      } catch (error) {
                        console.error('Failed to update security settings: ', error);
                      }
                    }}
                    disabled={
                      (resetType === 'pin' || resetType === 'both') && newPin.length !== 4 ||
                      (resetType === 'password' || resetType === 'both') && (!newPassword || newPassword !== confirmPassword)
                    }
                    sx={theming.getThemedButtonSx()}
                  >
                    Oppdater
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Last Client Activity */}
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AccessTime sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Klientaktivitet
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Siste gang klienten var aktiv på tidslinjen
                  </Typography>
                  
                  {timeline?.clientAccessEnabled ? (
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                        Siste aktivitet:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {timeline.lastClientActivity 
                          ? new Date(timeline.lastClientActivity).toLocaleString('no-NO')
                          : 'Ingen aktivitet registrert ennå'}
                      </Typography>
                    </Box>
                  ) : (
                    <Alert severity="info">
                      Klienttilgang er ikke aktivert. Aktiver tilgang for å se aktivitet.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Push Notifications */}
            <Grid item xs={12}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Notifications sx={{ color: theming.colors.primary }} />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        Push-varsler
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isSupported ? (
                        <Chip
                          label={pushEnabled ? 'Aktive' : 'Inaktive'}
                          color={pushEnabled ? 'success' : 'default'}
                          size="small"
                          icon={<Notifications />}
                        />
                      ) : (
                        <Chip label="Ikke støttet" color="warning" size="small" variant="outlined" />
                      )}
                    </Box>
                  </Box>
                  {isSupported ? (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {pushEnabled
                          ? 'Push-varsler er aktivert. Du mottar varsler om klientendringer og tidslinjeoppdateringer.'
                          : 'Aktiver push-varsler for å motta varsler om klientendringer og tidslinjeoppdateringer.'}
                      </Typography>
                      <PushNotificationSettings userId={userId} contextId={timelineId} />
                    </>
                  ) : (
                    <Alert severity="warning">
                      Push-varsler støttes ikke i denne nettleseren. Bruk en moderne nettleser som Chrome, Firefox eller Edge for å aktivere push-varsler.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Event Dialog */}
      <Dialog 
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedEvent ? 'Rediger Hendelse' : 'Ny Hendelse'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt:  2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Hendelse Tittel"
                  defaultValue={selectedEvent?.title || ''}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Tidspunkt"
                  type="time"
                  defaultValue={selectedEvent?.time || ''}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                  <TextField
                    label="Timer"
                    type="number"
                    defaultValue={Math.floor((selectedEvent?.duration || 30) / 60)}
                    variant="outlined"
                    inputProps={{ min: 0, max: 12}}
                    sx={{ flex:  1 }}
                  />
                  <Typography variant="body2" color="text.secondary">t</Typography>
                  <TextField
                    label="Minutter"
                    type="number"
                    defaultValue={(selectedEvent?.duration || 30) % 60}
                    variant="outlined"
                    inputProps={{ min: 0, max:  59, step: 15}}
                    sx={{ flex:  1 }}
                  />
                  <Typography variant="body2" color="text.secondary">min</Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Beskrivelse"
                  multiline
                  rows={3}
                  defaultValue={selectedEvent?.description || ''}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Lokasjon"
                  defaultValue={selectedEvent?.location || ', '}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    defaultValue={selectedEvent?.status || 'planned'}
                    label="Status"
                  >
                    <MenuItem value="planned">Planlagt</MenuItem>
                    <MenuItem value="confirmed">Bekreftet</MenuItem>
                    <MenuItem value="completed">Fullført</MenuItem>
                    <MenuItem value="cancelled">Avlyst</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Speech Section */}
              <Grid item xs={12}>
                <Box sx={{
                  p: 2,
                  border: '2px solid #9c27b0',
                  borderRadius: 2,
                  bgcolor: '#f3e5f5'
                }}>
                  <Typography variant="h6" sx={{
                    color: theming.colors.primary,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    {theming.getThemedIcon('mic')}
                    Tale / Presentasjon
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb:  2 }}>
                    <InputLabel>Inneholder tale/presentasjon?</InputLabel>
                    <Select
                      defaultValue={selectedEvent?.hasSpeech ? 'yes' : 'no'}
                      label="Inneholder tale/presentasjon?"
                    >
                      <MenuItem value="no">Nei - ingen tale</MenuItem>
                      <MenuItem value="yes">Ja - inneholder tale/presentasjon</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <TextField
                    fullWidth
                    label="Tale detaljer (valgfritt)"
                    placeholder="F.eks: Brudens far holder tale, bestemann presenterer paret, etc."
                    multiline
                    rows={2}
                    defaultValue={selectedEvent?.speechDetails || ', '}
                    variant="outlined"
                    helperText="Beskriv hvem som snakker og hva som skal sies"
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained" 
            onClick={() => saveEventMutation.mutate({})}
            sx={{ bgcolor: '#E91E60','&:hover': { bgcolor: '#C2185B'}}}
          >
            {selectedEvent ? 'Oppdater' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Timeline Dialog */}
      <Dialog
        open={createTimelineOpen}
        onClose={() => setCreateTimelineOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Opprett tidslinje — {eventTypeLabel}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label={contextLabels.eventDateLabel}
                type="date"
                value={newTimelineData.eventDate || ', '}
                onChange={(e) => setNewTimelineData((p) => ({ ...p, eventDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={contextLabels.venueLabel}
                value={newTimelineData.venue || ', '}
                onChange={(e) => setNewTimelineData((p) => ({ ...p, venue: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={contextLabels.clientNameLabel}
                value={newTimelineData.clientName || ', '}
                onChange={(e) => setNewTimelineData((p) => ({ ...p, clientName: e.target.value }))}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTimelineOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={createTimelineMutation.isPending || !newTimelineData.eventDate}
            onClick={() => createTimelineMutation.mutate()}
          >
            {createTimelineMutation.isPending ? 'Oppretter...' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Timeline Viewer Dialog */}
      <Dialog 
        open={timelineViewOpen}
        onClose={() => setTimelineViewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#f57c00', color: 'white', display: 'flex', alignItems: 'center', gap:  1 }}>
          <Event />
          Tidslinje - {timeline?.clientName || projectId}
        </DialogTitle>
        <DialogContent sx={{ p:  0 }}>
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
              @keyframes fadeSlideIn {
                from {
                  opacity: 0;
                  transform: translateY(12px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}
          </style>
          <Box sx={{ p:  3 }}>
            {timeline ? (
              <Box>
                <Box sx={{ mb:  3, p: 2, bgcolor: '#fff3e0', borderRadius:  1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CalendarToday sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {timeline.eventDate || 'Dato ikke satt'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <LocationOn sx={{ color: theming.colors.accent }} />
                    <Typography variant="body1" sx={{ color: theming.colors.accent }}>
                      {timeline.venue || 'Lokasjon ikke satt'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap:  3, flexWrap: 'wrap'}}>
                    <Typography variant="body2" sx={{ color: '#f57c00'}}>
                      {timeline.events?.length || 0} hendelser planlagt
                    </Typography>
                    {timelineSettings.viewDefaults.showSpeechMarkers && (
                      <Typography variant="body2" sx={{ 
                        color: '#9c27b0', 
                        fontWeight: 60
                       , display: 'flex',
                        alignItems: 'center',
                        gap: 0.5 }}>
                        <Mic sx={{ fontSize: '16px'}} />
                        {timeline.events?.filter(event => event.hasSpeech).length || 0} taler/presentasjoner
                      </Typography>
                    )}
                  </Box>
                </Box>

                {timeline.events && timeline.events.length > 0 ? (
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
                      boxShadow: '0 2px 8px rgba(25, 1240.3)'
                  }} />

                    {timeline.events
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((event, index) => (
                      <Box key={event.id} sx={{ position: 'relative', mb: 3, opacity: 0, animation: `fadeSlideIn 0.4s ease-out ${index * 0.08}s forwards` }}>
                        {/* Event number indicator */}
                        <Typography
                          variant="caption"
                          sx={{
                            position: 'absolute',
                            left: '-60px',
                            top: '22px',
                            color: 'text.disabled',
                            fontWeight: 600,
                            fontSize: '0.7rem'
                          }}
                        >
                          #{index + 1}
                        </Typography>
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
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                          zIndex: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                    }}>
                          {event.status === 'completed' && (
                            <Box sx={{ color: 'white', fontSize: '12px', fontWeight: 'bold'}}>✓</Box>
                          )}
                          {event.status === 'cancelled' && (
                            <Box sx={{ color: 'white', fontSize: '12px', fontWeight: 'bold'}}>✕</Box>
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
                            <RecordVoiceOver sx={{ fontSize: '16px', color: 'white'}} />
                          </Box>
                        )}

                        {/* Timeline Card */}
                        <Card sx={{ 
                          ml: 2, border: '2px solid #ffcc80',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: '0 4px 12px rgba(25, 1240.15)',
                          position: 'relative','&::before': {
                            content: '","',
                            position: 'absolute',
                            top: '24px',
                            left: '-10px',
                            width:  0,
                            height:  0,
                            borderStyle: 'solid',
                            borderWidth: '8px 10px 8px 0',
                            borderColor: 'transparent #ffcc80 transparent transparent'
                      }
                      ,  ...theming.getThemedCardSx() }}>
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
                            {/* Status Badge */}
                            <Box sx={{
                              display: 'inline-block',
                              px: 1,
                              py: 0.5,
                              borderRadius: '20px',
                              bgcolor: event.status === 'completed' ? '#c8e6c9' :
                                       event.status === 'confirmed' ? '#fff3e0' :
                                       event.status === 'cancelled' ? '#ffcdd2' : '#e1f5fe',
                              color: event.status === 'completed' ? '#2e7d32' :
                                     event.status === 'confirmed' ? '#f57c00' :
                                     event.status === 'cancelled' ? '#d32f2f' : '#0277bd',
                              mb: 2,
                              fontSize: '0.75rem',
                              fontWeight: 60
                            }}>
                              {event.status === 'planned' ? 'PLANLAGT' :
                               event.status === 'confirmed' ? 'BEKREFTET' :
                               event.status === 'completed' ? 'FULLFØRT' : 'AVLYST'}
                            </Box>

                            <Typography variant="h6" sx={{
                              color: theming.colors.primary,
                              fontWeight: 700,
                              mb: 1,
                              fontSize: '1.25rem'
                            }}>
                              {event.title}
                            </Typography>
                            
                            <Typography variant="body1" sx={{ 
                              fontWeight: 600,
                              color: '#f57c00', 
                              mb:  2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1 }}>
                              <Schedule sx={{ fontSize: '18px'}} />
                              {event.duration} minutter
                            </Typography>
                            
                            {event.location && (
                              <Typography variant="body2" sx={{ 
                                color: 'text.secondary', 
                                mb:  1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1 }}>
                                <LocationOn sx={{ fontSize: '16px', color: '#f57c00'}} />
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
                                mb:  1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1 }}>
                                <People sx={{ fontSize: '16px', color: '#f57c00'}} />
                                {event.participants.join(', ')}
                              </Typography>
                            )}
                            
                            {event.equipment && event.equipment.length > 0 && (
                              <Typography variant="body2" sx={{ 
                                color: 'text.secondary',
                                display: 'flex',
                                alignItems: 'center',
                                gap:  1,
                                mb: 1 }}>
                                <Camera sx={{ fontSize: '16px', color: '#f57c00'}} />
                                {event.equipment.join('')}
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
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  mb: 1 }}>
                                  <Mic sx={{ fontSize: '18px'}} />
                                  TALE / PRESENTASJON
                                </Typography>
                                {event.speechDetails && (
                                  <Typography variant="body2" sx={{ color: '#7b1fa2'}}>
                                    {event.speechDetails}
                                  </Typography>
                                )}
                              </Box>
                            )}
                          </CardContent>
                        </Card>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py:  4 }}>
                    <Event sx={{ fontSize:  64, color: '#ffcc80', mb:  2 }} />
                    <Typography variant="h6" sx={{  color: 'text.secondary', mb:  1  }}>
                      Ingen hendelser lagt til enda
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                      Legg til hendelser i "Hendelser" fanen for å bygge tidslinjen
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py:  4 }}>
                <Event sx={{ fontSize:  64, color: '#ffcc80', mb:  2 }} />
                <Typography variant="h6" sx={{  color: 'text.secondary', mb:  1  }}>
                  Ingen tidslinje opprettet
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                  Opprett en tidslinje først for å se innholdet
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p:  2 }}>
          <Button onClick={() => setTimelineViewOpen(false)}>
            Lukk
          </Button>
          <Button variant="contained" 
            onClick={() => {
              setTimelineViewOpen(false);
              setActiveTab(1); // Switch to Events tab
          }}
            sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' } }}
          >
            Rediger Hendelser
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Access Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#E91E60', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Key sx={{ fontSize: '1.5rem' }} />
          Evendi Tidslinje - Klienttilgang
        </DialogTitle>
        <DialogContent sx={{ p:  3 }}>
          <Typography variant="body1" sx={{ mb:  3 }}>
            Tilgangskode er generert! Del denne informasjonen med klienten: </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{
                bgcolor: '#f5f5f0',
                p: 2,
                borderRadius: 2,
                border: '2px solid #E91E63',
                textAlign: 'center'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary, mb: 2 }}>
                  Tilgangskode: {accessCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Eller direkte link:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: 'break-all',
                      color: '#1976d2',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      flex: 1
                    }}
                  >
                    {fullClientUrl}
                  </Typography>
                  <Tooltip title="Kopier lenke">
                    <IconButton
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(fullClientUrl);
                      }}
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </Box>
                {timeline?.clientAccessEnabled && icalWebcalUrl && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      iCal abonnement (webcal)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-all',
                        color: '#1976d2',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        flex: 1
                      }}
                    >
                      {icalWebcalUrl}
                    </Typography>
                    <Tooltip title="Kopier iCal-abonnement">
                      <IconButton
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText(icalWebcalUrl);
                        }}
                      >
                        <ContentCopy />
                      </IconButton>
                    </Tooltip>
                    </Box>
                  </Box>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{
                bgcolor: '#f5f5f0',
                p: 2,
                borderRadius: 2,
                border: '2px solid #E91E63',
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  QR-kode for enkel tilgang:
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 200,
                      height: 200,
                      bgcolor: 'white',
                      p: 2,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullClientUrl)}`}
                      alt="QR Code"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Skann med kamera for å åpne tidslinjen
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Lightbulb sx={{ color: theming.colors.primary, fontSize: '1.2rem' }} />
            <Typography variant="body2" color="text.secondary">
              Tips: Klienten kan følge tidslinjen live på arrangementsdagen med denne koden!
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => generateClientAccess.mutate(true)}
            disabled={generateClientAccess.isPending}
            color="warning"
          >
            Regenerer kode
          </Button>
          <Button 
            onClick={() => setShareDialogOpen(false)}
            variant="contained"
            sx={{ bgcolor: '#E91E60', '&:hover': { bgcolor: '#C2185B'}}}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
      {/* Auto-Adjust Timeline: Mark Delayed Dialog */}
      <Dialog 
        open={showDelayDialog}
        onClose={() => setShowDelayDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#FF9800', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime />
          Mark Event as Delayed
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Auto-Adjust Timeline
            </Typography>
            <Typography variant="caption">
              When you mark an event as delayed, ALL downstream events will automatically 
              adjust by the same amount. You can revert to the original schedule anytime.
            </Typography>
          </Alert>

          <TextField
            fullWidth
            type="number"
            label="Delay (minutes)"
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value))}
            sx={{ mb: 2 }}
            helperText="How many minutes is this event delayed?"
            InputProps={{
              inputProps: { min: 0, max: 180 }
            }}
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason (optional)"
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            placeholder="E.g., Makeup running late, traffic delay, etc."
            helperText="This helps explain why the timeline was adjusted"
          />

          {delayMinutes > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="caption">
                <strong>Impact:</strong> All events after this will be delayed by {delayMinutes} minutes
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDelayDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleConfirmDelay}
            disabled={delayMinutes <= 0 || adjusting}
            sx={{ bgcolor: '#FF9800', '&:hover': { bgcolor: '#F57C00' } }}
          >
            {adjusting ? 'Adjusting...' : 'Apply Auto-Adjust'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PIN/Password Update Success Dialog */}
      <Dialog
        open={pinPasswordDialogOpen}
        onClose={() => setPinPasswordDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#4caf50', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Key />
          Sikkerhet oppdatert
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {resetType === 'pin' ? 'PIN-kode' : resetType === 'password' ? 'Passord' : 'PIN-kode og passord'} er oppdatert!
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Klienter med eksisterende tilgang må bruke den nye {resetType === 'pin' ? 'PIN-koden' : resetType === 'password' ? 'passordet' : 'PIN-koden/passordet'} ved neste innlogging.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setPinPasswordDialogOpen(false)}
            sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
