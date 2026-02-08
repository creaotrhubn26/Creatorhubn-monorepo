import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
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
  Alert,
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
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Event,
  Settings,
  AddCircle as Add,
  Edit,
  Delete,
  Schedule,
  People,
  LocationOn,
  Camera,
  Notifications,
  CloudDone,
  RecordVoiceOver,
  Mic,
  AccessTime,
  RestorePage,
  Warning,
  Check,
  CalendarToday,
  Lightbulb,
  Pending,
  CheckCircle,
  Cancel as CancelIcon,
  Key,
  ContentCopy,
  QrCode,
  HelpOutline
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import ClientAccessSettings from '@/components/shared/ClientAccessSettings';
import WeddingTimeline from '../wedding-timeline';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import WeddingTimelineHelp from './WeddingTimelineHelp';
import WedflowImportantPeople from '../wedflow/WedflowImportantPeople';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface WeddingTimelineAdminProps {
  projectId?: string; // Optional - hvis null/undefined = generell bryllupstidslinje-administrasjon
  weddingId?: string; // Spesifikk bryllup-ID hvis det finnes
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

interface WeddingTimeline {
  id: string;
  weddingDate: string;
  venue: string;
  coupleName: string;
  events: TimelineEvent[];
  createdAt: string;
  updatedAt: string
}

// Demo data for when API is unavailable or in demo mode
const DEMO_TIMELINE: WeddingTimeline = {
  id: 'demo-timeline-001',
  weddingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
  venue: 'Grand Hotel Oslo',
  coupleName: 'Emma & Lars',
  events: [
    {
      id: 'evt-1',
      title: 'Forberedelser brud',
      time: '10:00',
      duration: 120,
      description: 'Hår, makeup og påkledning',
      location: 'Brudesuite, Grand Hotel',
      participants: ['Brud', 'Forlovere', 'Makeup artist'],
      equipment: ['Kamera', 'Blits', 'Reflektorer'],
      status: 'planned',
      hasSpeech: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt-2',
      title: 'Forberedelser brudgom',
      time: '11:00',
      duration: 60,
      description: 'Påkledning og forberedelser',
      location: 'Rom 305, Grand Hotel',
      participants: ['Brudgom', 'Forlovere'],
      equipment: ['Kamera'],
      status: 'planned',
      hasSpeech: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt-3',
      title: 'Vielse',
      time: '14:00',
      duration: 45,
      description: 'Kirkelig vielse i Oslo Domkirke',
      location: 'Oslo Domkirke',
      participants: ['Brud', 'Brudgom', 'Prest', 'Gjester'],
      equipment: ['Kamera', 'Videokamera', 'Mikrofon'],
      status: 'confirmed',
      hasSpeech: true,
      speechDetails: 'Løfter og ringeveksling',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt-4',
      title: 'Gruppefoto',
      time: '15:00',
      duration: 30,
      description: 'Formelle gruppebilder utenfor kirken',
      location: 'Utenfor Oslo Domkirke',
      participants: ['Alle gjester'],
      equipment: ['Kamera', 'Stativ', 'Blits'],
      status: 'planned',
      hasSpeech: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt-5',
      title: 'Bryllupsmiddag',
      time: '17:00',
      duration: 180,
      description: 'Festmiddag med taler og underholdning',
      location: 'Festsalen, Grand Hotel',
      participants: ['Alle gjester'],
      equipment: ['Kamera', 'Videokamera'],
      status: 'planned',
      hasSpeech: true,
      speechDetails: 'Taler fra forlovere, foreldre og brudeparet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt-6',
      title: 'Første dans',
      time: '20:00',
      duration: 15,
      description: 'Brudevalsen',
      location: 'Festsalen, Grand Hotel',
      participants: ['Brud', 'Brudgom'],
      equipment: ['Kamera', 'Videokamera'],
      status: 'planned',
      hasSpeech: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export default function WeddingTimelineAdmin({ 
  projectId, 
  weddingId, 
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
}: WeddingTimelineAdminProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState<any | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [timelineViewOpen, setTimelineViewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const queryClient = useQueryClient();
  
  // Create Timeline Dialog State (prefilled)
  const [createTimelineOpen, setCreateTimelineOpen] = useState(false);
  const [newTimelineData, setNewTimelineData] = useState<{ weddingDate: string; venue: string; coupleName: string }>({
    weddingDate: '',
    venue: '',
    coupleName: ''
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
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');

  // Integration system
  const { communication, dataFlow } = useEnhancedMasterIntegration();
  
  // Push notifications - timelineId will be set after timeline is fetched
  const { user: currentUser } = useAuth();
  const userId = currentUser?.id || currentUser?.sub;

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

  // Prefill defaults when dialog opens or prefill changes
  React.useEffect(() => {
    if (!prefill) return;
    setNewTimelineData((prev) => ({
      weddingDate: prefill.eventDate || prev.weddingDate || (prefill.eventDates ? Object.values(prefill.eventDates)[0] : ''),
      venue: prefill.location || prev.venue,
      coupleName: prefill.projectName || prev.coupleName,
    }));
  }, [prefill]);

  // Hent alle bryllupsprosjekter for dropdown
  const { data: weddingProjects = [] } = useQuery({
    queryKey: ['/api/projects', { type: 'wedding',}],
    queryFn: () => apiRequest('/api/projects?type=wedding')
});

  const weddingProjectsList = Array.isArray(weddingProjects)
    ? weddingProjects
    : (weddingProjects as any)?.projects || (weddingProjects as any)?.data || [];

  // Hent valgt prosjekt med kulturdata
  const { data: currentProject } = useQuery({
    queryKey: ['/api/projects', selectedProjectId],
    queryFn: () => selectedProjectId ? apiRequest(`/api/projects/${selectedProjectId}`) : null,
    enabled: !!selectedProjectId
});

  // Automatisk kulturtilpasning basert på valgt prosjekt
  const culturalType = currentProject?.culturalType || projectIntegration?.culturalType || 'norsk';
  
  // Client access settings state
  const [clientSettings, setClientSettings] = useState({
    clientAccessEnabled: false,
    allowDownload: false,
    allowRightClick: false,
    allowSave: false,
    requireApproval: true
});

  // Handler for client settings changes
  const handleClientSettingChange = (key: string, value: any) => {
    console.log('Wedding timeline client setting changed, :', key, value);
    setClientSettings(prev => ({
      ...prev,
      [key]: value
  }));
    // TODO: Implementer lagring av wedding timeline klientinnstillinger til API
};

  // Handler for viewing timeline
  const handleViewTimeline = () => {
    setTimelineViewOpen(true);
};

  // State for code generation
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState('');
  const [accessCode, setAccessCode] = useState('');

  // Bryllupstidslinje-administrasjon logikk: // - Hvis weddingId er oppgitt: spesifikk bryllupstidslinje
  // - Hvis projectId er oppgitt: prosjekt-spesifikk tidslinje
  // - Hvis begge er null/undefined: generell tidslinje-mal administrasjon
  const timelineContext = weddingId 
    ? `bryllup ${weddingId}`
    : projectId 
      ? `prosjekt ${projectId}`
      : 'generelle tidslinje-maler';

  // Generate wedding timeline access code
  const generateClientAccess = useMutation({
    mutationFn: async (regenerate = false) => {
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
      setShareDialogOpen(true);
},
    onError: (error) => {
      console.error('Feil ved generering av klientlenke, :', error);
  }
});
  
  console.log(`💒 Wedding Timeline Admin: Administrerer ${timelineContext}`);

  // Create timeline mutation (project-specific)
  const createTimelineMutation = useMutation({
    mutationFn: async () => {
      const targetProjectId = selectedProjectId || projectId || 'wedding-demo-project';
      return apiRequest(`/api/wedding/timeline/project/${targetProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          weddingDate: newTimelineData.weddingDate,
          venue: newTimelineData.venue,
          coupleName: newTimelineData.coupleName,
          events: [],
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
    }
  });

  // Check if we're in demo mode (projectId or weddingId starts with "demo-")
  const isDemoMode = projectId?.startsWith('demo-') || weddingId?.startsWith('demo-');

  // Fetch wedding timeline data
  const { data: fetchedTimeline, isLoading: timelineLoading, isError: timelineError } = useQuery<WeddingTimeline>({
    queryKey: weddingId
      ? ['/api/wedding/timeline', weddingId]
      : projectId
        ? ['/api/wedding/timeline/project', projectId]
        : ['/api/wedding/timeline/templates'],
    retry: 1,
    enabled: !isDemoMode // Don't fetch if in demo mode
  });

  // Use demo data if in demo mode or if the API failed
  const timeline = isDemoMode || timelineError ? DEMO_TIMELINE : fetchedTimeline;

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
          method: 'POS',
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
      setEventDialogOpen(false);
      setSelectedEvent(null);
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
    }
  });

  // Handlers
  const handleMarkDelayed = (eventId: string) => {
    setDelayEventId(eventId);
    setShowDelayDialog(true);
  };

  const handleConfirmDelay = () => {
    if (!delayEventId || delayMinutes <= 0) return;
    
    setAdjusting(true);
    markDelayedMutation.mutate(
      { eventId: delayEventId, delayMinutes, reason: delayReason },
      {
        onSettled: () => setAdjusting(false)
      }
    );
  };

  const handleRevertTimeline = () => {
    if (!confirm('Revert all events back to original schedule?')) return;
    
    setAdjusting(true);
    revertTimelineMutation.mutate(undefined, {
      onSettled: () => setAdjusting(false)
    });
  };

  // Skip loading state in demo mode since we use static data
  if (timelineLoading && !isDemoMode) {
    return <Box sx={{ p:  3 }}>Laster bryllupstidslinje-administrasjon...</Box>;
  }

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Event sx={{ color: theming.colors.primary }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: theming.colors.primary }}>
            Bryllupstidslinje Administrasjon
          </Typography>
        </Box>
        <Tooltip title="Hjelp og veiledning">
          <IconButton onClick={() => setHelpOpen(true)} sx={{ color: theming.colors.primary }}>
            <HelpOutline />
          </IconButton>
        </Tooltip>
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
            ? `Administrerer tidslinje for bryllup ${weddingId}`
            : projectId 
              ? `Administrerer tidslinje for fotograferingsprosjekt ${projectId}`
              : 'Administrerer generelle bryllupstidslinje-maler'
        }
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {weddingId 
            ? 'Endringer gjelder kun dette spesifikke bryllupet'
            : projectId 
              ? 'Endringer gjelder kun dette fotograferingsprosjektet'
              : 'Endringer lager maler som kan brukes for nye bryllup'
        }
        </Typography>
      </Alert>

      {/* Prefill notice */}
      {prefill && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600}}>Forhåndsutfylling mottatt fra prosjektopprettelse</Typography>
          <Typography variant="caption" display="block">Prosjektnavn: {prefill.projectName || '—'}</Typography>
          <Typography variant="caption" display="block">Kunde: {prefill.clientEmail || '—'}</Typography>
          <Typography variant="caption" display="block">Dato: {prefill.eventDate || '—'}</Typography>
          {prefill.eventDates && (
            <Typography variant="caption" display="block">Datoer: {Object.values(prefill.eventDates).join('')}</Typography>
          )}
          <Typography variant="caption" display="block">Lokasjon: {prefill.location || '—'}</Typography>
          <Typography variant="caption" display="block">Gjester: {prefill.guestCount || '—'}</Typography>
        </Alert>
      )}

      {/* Prosjektvelger og kulturtilpasning */}
      <Card sx={{ mb:  3, bgcolor: 'rgba(25,255,255,0.95)', border: '1px solid #e0e0e0',  ...theming.getThemedCardSx() }}>
        <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" sx={{  mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap:  1  }}>
            <Event sx={{ color: '#f57c00'}} />
            Prosjektintegrasjon & Kulturtilpasning
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Velg bryllupsprosjekt</InputLabel>
                <Select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value || undefined)}
                  label="Velg bryllupsprosjekt"
                >
                  <MenuItem value="">
                    <em>Generell tidslinje (ingen prosjekt)</em>
                  </MenuItem>
                  {weddingProjectsList.map((project: any) => (
                    <MenuItem key={project.d} value={project.id}>
                      {project.projectName} - {project.clientName} ({project.culturalType || 'norsk'})
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

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Timeline Oversikt" />
        <Tab label="Hendelser" />
        <Tab label="Deltakere & Leverandører" />
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
                      {timeline.coupleName || 'Nytt Bryllup'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CalendarToday sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {timeline.weddingDate || 'Dato ikke satt'}
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
                        : 'Administrer generelle tidslinje-maler som kan brukes for nye bryllup.'
                    }
                    </Typography>
                    <Button variant="contained" 
                      startIcon={theming.getThemedIcon('add')}
                      onClick={() => {
                        setNewTimelineData({
                          weddingDate: prefill?.eventDate || (prefill?.eventDates ? Object.values(prefill.eventDates)[0] : '' ) || ',',
                          venue: prefill?.location || '',
                          coupleName: prefill?.projectName || ''
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
                  Alle tidslinje-endringer lagres automatisk til din Google Drive.
                </Typography>
                <Button 
                  variant="outlined" 
                  size="small"
                  startIcon={theming.getThemedIcon('cloudDone')}
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
              borderColor: timeline?.clientAccessEnabled ? theming.colors.success : theming.colors.primary,
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
                        navigator.clipboard.writeText(clientUrl);
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
                        onClick={() => setShareDialogOpen(true)}
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
                      Generer tilgangskode for bryllupsparet slik at de kan følge tidslinjen på bryllupsdagen.
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

          <Card sx={theming.getThemedCardSx()}>
            <List>
              {timeline?.events?.map((event) => (
                <ListItem key={event.id} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1">{event.title}</Typography>
                        {event.clientNotes && (
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
                        {event.clientNotes && (
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

      {/* Deltakere & Leverandører Tab — Wedflow Important People Bridge */}
      {activeTab === 2 && (
        <Box>
          <WedflowImportantPeople />
        </Box>
      )}

      {/* Client Access Tab */}
      {activeTab === 3 && (
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
                    Live Bryllupstidslinje
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    Klienten kan følge tidslinjen live på bryllupsdagen med kulturtilpassede aktiviteter
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
            description="Kontroller hva klienter kan gjøre med bryllupstidslinjen"
            projectId={selectedProjectId || projectId || weddingId}
            onViewTimeline={handleViewTimeline}
          />
        </Box>
      )}

      {/* Settings Tab */}
      {activeTab === 4 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
            Innstillinger
          </Typography>

          <Grid container spacing={3}>
            {/* PIN/Password Reset */}
            <Grid size={{ xs: 12 }} md={6}>
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
                        // Show success message
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
            <Grid size={{ xs: 12 }} md={6}>
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
            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Notifications sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Push-varsler
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Aktiver push-varsler for å motta varsler om klientendringer og tidslinjeoppdateringer.
                  </Typography>
                  <PushNotificationSettings userId={userId} contextId={timelineId} />
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
        <DialogTitle>Opprett bryllupstidslinje</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Dato"
                type="date"
                value={newTimelineData.weddingDate || ', '}
                onChange={(e) => setNewTimelineData((p) => ({ ...p, weddingDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Lokasjon / Venue"
                value={newTimelineData.venue || ', '}
                onChange={(e) => setNewTimelineData((p) => ({ ...p, venue: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Par / Prosjektnavn"
                value={newTimelineData.coupleName || ', '}
                onChange={(e) => setNewTimelineData((p) => ({ ...p, coupleName: e.target.value }))}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTimelineOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            disabled={createTimelineMutation.isPending || !newTimelineData.weddingDate}
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
          Bryllupstidslinje - {timeline?.coupleName || projectId}
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
            `}
          </style>
          <Box sx={{ p:  3 }}>
            {timeline ? (
              <Box>
                <Box sx={{ mb:  3, p: 2, bgcolor: '#fff3e0', borderRadius:  1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CalendarToday sx={{ color: theming.colors.primary }} />
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {timeline.weddingDate || 'Dato ikke satt'}
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
                    <Typography variant="body2" sx={{ 
                      color: '#9c27b0', 
                      fontWeight: 60
                     , display: 'flex',
                      alignItems: 'center',
                      gap: 0.5 }}>
                      <Mic sx={{ fontSize: '16px'}} />
                      {timeline.events?.filter(event => event.hasSpeech).length || 0} taler/presentasjoner
                    </Typography>
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
                      <Box key={event.id} sx={{ position: 'relative', mb:  3 }}>
                        {/* Timeline Node */}
                        <Box sx={{
                          position: 'absolute',
                          left: '-25px',
                          top: '20px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50, %',
                          bgcolor: event.status === 'completed' ? '#4caf50' : 
                                   event.status === 'confirmed' ? '#f57c00' : 
                                   event.status === 'cancelled' ? '#f44336' : '#2196f0',
                          border: '4px solid white',
                          boxShadow: '0 2px 8px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.2)',
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
                            borderRadius: '50, %',
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
          Bryllupstidslinje - Klienttilgang
        </DialogTitle>
        <DialogContent sx={{ p:  3 }}>
          <Typography variant="body1" sx={{ mb:  3 }}>
            Tilgangskode er generert! Del denne informasjonen med bryllupsparet: </Typography>

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
                    {clientUrl}
                  </Typography>
                  <Tooltip title="Kopier lenke">
                    <IconButton
                      size="small"
                      onClick={() => {
                        navigator.clipboard.writeText(clientUrl);
                      }}
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }} md={6}>
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
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(clientUrl)}`}
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
              Tips: Bryllupsparet kan følge tidslinjen live på bryllupsdagen med denne koden!
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

    </Box>
  );
}