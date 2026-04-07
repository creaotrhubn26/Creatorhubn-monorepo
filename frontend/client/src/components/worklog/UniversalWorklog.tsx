import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useClientServicePricing } from '../../services/ClientServicePricingService';
import { useExternalData } from '../../services/ExternalDataService';
import { useProject } from '../../contexts/ProjectContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme as useCustomTheme } from '../../contexts/ThemeContext';
import { useRealTime } from '../../contexts/RealTimeContext';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { useWorklogCollaboration } from '@/hooks/useWorklogCollaboration';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useTutorialPreferences } from '../../hooks/useTutorialPreferences';
import { WorklogTutorial } from './WorklogTutorial';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  IconButton,
  Paper,
  Avatar,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha,
  CircularProgress,
  Tooltip,
  Stack,
  Alert,
  Snackbar,
  Badge,
} from '@mui/material';
import {
  AddCircle as Add,
  Edit,
  Delete,
  AccessTime,
  TrendingUp,
  Mood,
  Group,
  Notes,
  CalendarToday,
  Assessment,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Settings,
  WorkOutline,
  CloudSync,
  Schedule,
  CloudUpload,
  CloudDownload,
  Sync,
  Google,
  ImportExport,
  Share,
  PersonAdd,
  Notifications as NotificationIcon,
  Notifications,
  NotificationsActive,
  HelpOutline,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { startCreatorHubGoogleSso } from '@/lib/creatorhubGoogleAuth';

interface WorklogEntry {
  id: number;
  projectId: string;
  userId: string;
  day: number;
  date: string;
  title: string;
  description?: string;
  timeSpent?: number;
  category: string;
  mood?: string;
  audioNotes?: string;
  collaborators?: any[];
  nextSteps?: string;
  isPrivate: boolean;
  googleKeepNoteId?: string;
  createdAt: string;
  updatedAt: string;
}

interface UniversalWorklogProps {
  projectId: string;
  userId?: string;
  profession: 'photographer' | 'videographer' | 'musicproducer' | 'vendor' | 'enterprise';
  onMeetingCreated?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  onMeetingCreate?: (meeting: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

interface GoogleWorkspaceWorklogSnapshot {
  googleDriveConnected?: boolean;
  driveAccountEmail?: string | null;
  lastDriveSyncAt?: string | null;
  workspaceWarning?: string | null;
}

const getProfessionConfig = (profession: string) => {
  switch (profession) {
    case 'photographer':
      return {
        icon: PhotoCamera,
        color: '#ff8c00',
        title: 'Fotografering Worklog',
        categories: [
          { value: 'shooting', label: 'Fotografering', icon: PhotoCamera },
          { value: 'editing', label: 'Redigering', icon: Edit },
          { value: 'client_meeting', label: 'Kundemøte', icon: Group },
          { value: 'planning', label: 'Planlegging', icon: CalendarToday },
          { value: 'equipment', label: 'Utstyr', icon: PhotoCamera },
          { value: 'delivery', label: 'Levering', icon: Store },
          { value: 'marketing', label: 'Markedsføring', icon: TrendingUp },
          { value: 'learning', label: 'Læring', icon: Assessment },
          { value: 'general', label: 'Generelt', icon: Notes }
        ]
    };
    case 'videographer':
      return {
        icon: Videocam,
        color: '#e74c3c',
        title: 'Video Produksjon Worklog',
        categories: [
          { value: 'filming', label: 'Filming', icon: Videocam },
          { value: 'editing', label: 'Redigering', icon: Edit },
          { value: 'color_grading', label: 'Fargekorrigering', icon: TrendingUp },
          { value: 'sound_design', label: 'Lyddesign', icon: LibraryMusic },
          { value: 'client_meeting', label: 'Kundemøte', icon: Group },
          { value: 'planning', label: 'Planlegging', icon: CalendarToday },
          { value: 'equipment', label: 'Utstyr', icon: Videocam },
          { value: 'delivery', label: 'Levering', icon: Store },
          { value: 'learning', label: 'Læring', icon: Assessment },
          { value: 'general', label: 'Generelt', icon: Notes }
        ]
    };
    case 'musicproducer':
      return {
        icon: LibraryMusic,
        color: '#9b59b6',
        title: 'Musikk Produksjon Worklog',
        categories: [
          { value: 'writing', label: 'Låtskriving', icon: Edit },
          { value: 'recording', label: 'Innspilling', icon: LibraryMusic },
          { value: 'mixing', label: 'Miksing', icon: TrendingUp },
          { value: 'mastering', label: 'Mastering', icon: Assessment },
          { value: 'collaboration', label: 'Samarbeid', icon: Group },
          { value: 'promotion', label: 'Markedsføring', icon: TrendingUp },
          { value: 'business', label: 'Business', icon: Store },
          { value: 'learning', label: 'Læring', icon: Assessment },
          { value: 'general', label: 'Generelt', icon: Notes }
        ]
    };
    case 'vendor':
      return {
        icon: Store,
        color: '#27ae60',
        title: 'Business Worklog',
        categories: [
          { value: 'sales', label: 'Salg', icon: TrendingUp },
          { value: 'inventory', label: 'Lager', icon: Store },
          { value: 'customer_service', label: 'Kundeservice', icon: Group },
          { value: 'marketing', label: 'Markedsføring', icon: TrendingUp },
          { value: 'product_development', label: 'Produktutvikling', icon: Assessment },
          { value: 'administration', label: 'Administrasjon', icon: CalendarToday },
          { value: 'networking', label: 'Nettverksbygging', icon: Group },
          { value: 'learning', label: 'Læring', icon: Assessment },
          { value: 'general', label: 'Generelt', icon: Notes }
        ]
    };
    case 'enterprise':
      return {
        icon: Group,
        color: '#6c3483',
        title: 'Enterprise Team Worklog',
        categories: [
          { value: 'shooting', label: 'Fotografering', icon: PhotoCamera },
          { value: 'filming', label: 'Filming', icon: Videocam },
          { value: 'editing', label: 'Redigering', icon: Edit },
          { value: 'color_grading', label: 'Fargekorrigering', icon: TrendingUp },
          { value: 'sound_design', label: 'Lyddesign', icon: LibraryMusic },
          { value: 'client_meeting', label: 'Kundemøte', icon: Group },
          { value: 'planning', label: 'Planlegging', icon: CalendarToday },
          { value: 'equipment', label: 'Utstyr', icon: PhotoCamera },
          { value: 'delivery', label: 'Levering', icon: Store },
          { value: 'marketing', label: 'Markedsføring', icon: TrendingUp },
          { value: 'administration', label: 'Administrasjon', icon: CalendarToday },
          { value: 'learning', label: 'Læring', icon: Assessment },
          { value: 'general', label: 'Generelt', icon: Notes }
        ]
    };
    default: 
      return {
        icon: Notes,
        color: '#1976d2',
        title: 'Worklog',
        categories: [
          { value: 'general', label: 'Generelt', icon: Notes }
        ]
    };
}
};

const moodOptions = [
  { value: 'productive', label: 'Produktiv', color: '#4caf50', icon: '⚡' },
  { value: 'creative', label: 'Kreativ', color: '#2196f3', icon: '🎨' },
  { value: 'challenging', label: 'Utfordrende', color: '#ff9800', icon: '💪' },
  { value: 'breakthrough', label: 'Gjennombrudd', color: '#9c27b0', icon: '🚀' },
  { value: 'learning', label: 'Lærende', color: '#00bcd4', icon: '📚' },
  { value: 'focused', label: 'Fokusert', color: '#795548', icon: '🎯' },
  { value: 'inspired', label: 'Inspirert', color: '#ffc107', icon: '💡' },
  { value: 'frustrated', label: 'Frustrert', color: '#f44336', icon: '😤' },
  { value: 'satisfied', label: 'Fornøyd', color: '#8bc34a', icon: '😊' },
  { value: 'tired', label: 'Sliten', color: '#9e9e9e', icon: '😴' }
];

const getDailyPrompts = (profession: string) => {
  const basePrompts = [
    "Hva gikk bedre enn forventet i dag?",
    "Hvilken utfordring møtte du på og hvordan løste du den?",
    "Hva lærte du som du kan bruke videre?",
    "Hva motiverte deg mest i dag?",
    "Hvilken del av arbeidet var mest givende?"
  ];

  const professionPrompts = {
    photographer: [
      "Hvordan var lyset i dagens fotografering?","Hvilke kamerainnstillinger fungerte best?","Hvordan opplevde klienten økten?","Hvilke redigeringsteknikker brukte du?","Hva kunne gjort bildeserien enda bedre?"
    ],
    videographer: [
      "Hvordan gikk dagens filming?","Hvilke nye teknikker prøvde du ut?","Hvordan var samarbeidet med teamet?","Hvilke utfordringer hadde du med lyd eller bilde?","Hva ser du frem til å redigere?"
    ],
    musicproducer: [
      "Hvilken lyd jobbet du med i dag?","Hvordan utviklet låten seg?","Hvilke instrumenter eller effekter fungerte godt?","Hva inspirerte den kreative prosessen?","Hvilke samarbeidspartnere jobbet du med?"
    ],
    vendor: [
      "Hvilke kundesamtaler gikk særlig bra?","Hvilke produkter hadde høyest interesse?","Hva lærte du om markedet i dag?","Hvilke forbedringer kan gjøres i salgsrutinene?","Hvilke nye muligheter så du?"
    ],
    enterprise: [
      "Hvordan fungerte teamsamarbeidet i dag?","Hvilke prosjekter ble levert til kunder?","Hvordan fordelte dere oppgavene i teamet?","Hva kan forbedres i arbeidsflyten mellom foto og video?","Hvilke kunder ga god tilbakemelding?"
    ]
};

  return [...basePrompts, ...(professionPrompts[profession as keyof typeof professionPrompts] || [])];
};

export default function UniversalWorklog({ 
  projectId, 
  userId = 'demo-user', 
  profession,
  onMeetingCreated,
  onProjectUpdate,
  selectedProject,
  onProjectSelect,
  onMeetingCreate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: UniversalWorklogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const baseConfig = getProfessionConfig(profession);

  // Context hooks
  const { currentProject, updateProject, getProjectSettings } = useProject();
  const { settings, updateSetting } = useSettings();
  const { getProfessionTheme } = useCustomTheme();
  const { isConnected, emitEvent, onEvent, offEvent } = useRealTime();
  const { addNotification } = useVisualEditor();
  
  // Profession adapter for feature checks and SEO integration
  const { 
    hasFeature, 
    adaptDashboardTitle,
    loadTrendsData,
    trackProfessionActivity 
  } = useProfessionAdapter();

  // Client service pricing service integration
  const { 
    formatCurrency
  } = useClientServicePricing();
  
  // External Data Service integration for worklog insights
  const { 
    getCurrentWeather,
    getWeatherForecast,
    calculateTravelCosts,
    getKartverketAddress,
    searchKartverketPlaceNames
  } = useExternalData();
  
  // Tutorial preferences for worklog guide
  const { isDismissed: tutorialDismissed } = useTutorialPreferences('worklog-guide');
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Apply profession-specific theme from context
  const professionForTheme = profession === 'musicproducer' ? 'music_producer' : profession;
  const customTheme = getProfessionTheme(professionForTheme as 'photographer' | 'videographer' | 'vendor' | 'music_producer');
  const professionTheme = customTheme;
  
  const config = {
    ...baseConfig,
    color: professionTheme?.primaryColor || baseConfig.color,
    title: `${baseConfig.title} Worklog`
  };
  
  const IconComponent = config.icon;
  const dailyPrompts = getDailyPrompts(profession);

  // Master Integration Provider - used for cross-component communication
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Register worklog component in the component registry
  useEffect(() => {
    // Log integration status for debugging
    if (integration && dataFlow && componentRegistry) {
      console.log('📊 Worklog connected to master integration', { 
        hasWorklogFeature: hasFeature('worklog'),
        projectId,
        profession 
      });
    }
  }, [componentRegistry, projectId, profession, hasFeature, integration, dataFlow]);
  
  // Theming system - use dynamic profession
  useTheming(profession);
  
  // Worklog context identification
  const worklogContext = projectId 
    ? `prosjekt ${projectId}`
    : 'generell worklog';
  
  // Get dashboard title from profession adapter
  const dashboardTitle = adaptDashboardTitle();
  
  console.log(`📝 Worklog Admin: Administrerer ${worklogContext} for ${profession} - ${dashboardTitle}`);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorklogEntry | null>(null);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showKeepSync, setShowKeepSync] = useState(false);
  
  // External data insights state
  const [worklogInsights, setWorklogInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [workLocation, setWorkLocation] = useState<string>('');
  
  // Settings sync state
  const [syncSettings, setSyncSettings] = useState(false);
  
  // Collaboration state
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [selectedWorklogId, setSelectedWorklogId] = useState<string | null>(null);
  const [collaboratorEmails, setCollaboratorEmails] = useState<string>('');
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'overview' | 'capture' | 'timeline'>('overview');
  
  // Real-time notifications
  const { notifications: realtimeNotifications } = useRealtimeNotifications(userId);
  const { addCollaborators, adding: addingCollaborators } = useWorklogCollaboration();
  
  // Push notifications
  const { user } = useAuth();
  const currentUserId = React.useMemo(() => {
    const explicitUserId = String(userId || '').trim();
    if (explicitUserId && explicitUserId !== 'demo-user' && explicitUserId !== 'guest') {
      return explicitUserId;
    }

    if (typeof user?.id === 'string') {
      return user.id.trim();
    }

    if (typeof user?.id === 'number') {
      return String(user.id);
    }

    return '';
  }, [userId, user?.id]);
  const { pushEnabled, isSupported } = usePushNotifications(currentUserId);
  const {
    data: googleWorkspaceSnapshot,
    isLoading: googleWorkspaceStatusLoading,
    refetch: refetchGoogleWorkspaceStatus,
  } = useQuery<GoogleWorkspaceWorklogSnapshot>({
    queryKey: ['/api/google-workspace/storage', currentUserId, 'worklog-google-keep'],
    enabled: currentUserId.length > 0 && currentUserId !== 'guest',
    queryFn: async () =>
      apiRequest(`/api/google-workspace/storage/${encodeURIComponent(currentUserId)}`),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const keepSyncStatus = React.useMemo(() => {
    const accountEmail =
      typeof googleWorkspaceSnapshot?.driveAccountEmail === 'string'
        ? googleWorkspaceSnapshot.driveAccountEmail.trim()
        : '';
    const workspaceWarning =
      typeof googleWorkspaceSnapshot?.workspaceWarning === 'string'
        ? googleWorkspaceSnapshot.workspaceWarning.trim()
        : '';
    const lastSync =
      typeof googleWorkspaceSnapshot?.lastDriveSyncAt === 'string'
      && googleWorkspaceSnapshot.lastDriveSyncAt.trim().length > 0
        ? googleWorkspaceSnapshot.lastDriveSyncAt
        : null;

    return {
      connected: Boolean(googleWorkspaceSnapshot?.googleDriveConnected),
      lastSync,
      syncedEntries: 0,
      accountEmail: accountEmail || null,
      workspaceWarning: workspaceWarning || null,
    };
  }, [googleWorkspaceSnapshot]);
  
  const [formData, setFormData] = useState({
    day: 1,
    title: '',
    description: '',
    timeSpent: 0,
    category: config.categories[0]?.value || 'general',
    mood: '',
    nextSteps: '',
    isPrivate: false
});

  const queryClient = useQueryClient();

  // Toast notification helpers
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    addNotification({
      message,
      type,
      title: type.charAt(0).toUpperCase() + type.slice(1) + ' Notification',
      read: false
  });
};

  const showSuccessToast = useCallback((message: string) => showToast(message, 'success'), []);
  const showErrorToast = useCallback((message: string) => showToast(message, 'error'), []);
  const showWarningToast = useCallback((message: string) => showToast(message, 'warning'), []);
  const showInfoToast = useCallback((message: string) => showToast(message, 'info'), []);

  useEffect(() => {
    const handleWorkspaceLinked = () => {
      void refetchGoogleWorkspaceStatus();
    };

    window.addEventListener('creatorhub-google-workspace-linked', handleWorkspaceLinked);
    window.addEventListener('auth-changed', handleWorkspaceLinked);
    return () => {
      window.removeEventListener('creatorhub-google-workspace-linked', handleWorkspaceLinked);
      window.removeEventListener('auth-changed', handleWorkspaceLinked);
    };
  }, [refetchGoogleWorkspaceStatus]);

  const handleKeepGoogleSso = useCallback(async () => {
    try {
      await startCreatorHubGoogleSso({
        targetConnectionUserId: currentUserId || undefined,
      });
    } catch (error) {
      console.error('Could not start shared Google SSO for worklog keep flow:', error);
      showErrorToast('Kunne ikke starte Google-SSO akkurat nå.');
    }
  }, [currentUserId, showErrorToast]);
  
  // Show tutorial on first visit
  useEffect(() => {
    if (!tutorialDismissed) {
      const timer = setTimeout(() => setShowTutorial(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [tutorialDismissed]);
  
  // Track profession activity when worklog is used
  useEffect(() => {
    trackProfessionActivity('worklog_opened', { projectId, profession });
  }, [projectId, profession, trackProfessionActivity]);
  
  // Load trends data for SEO insights
  useEffect(() => {
    if (hasFeature('seo_insights')) {
      loadTrendsData('norway').then((data) => {
        if (data?.trendingKeywords?.length > 0) {
          showInfoToast('SEO-innsikter lastet');
        }
      }).catch(() => {
        // Silently fail - SEO insights are optional
      });
    }
  }, [hasFeature, loadTrendsData, showInfoToast]);
  
  // Sync project settings with context
  useEffect(() => {
    if (currentProject && selectedProject && currentProject.id !== selectedProject.id) {
      updateProject(selectedProject.id, selectedProject);
    }
  }, [currentProject, selectedProject, updateProject]);
  
  // Apply settings from context
  useEffect(() => {
    if (getProjectSettings && projectId) {
      const projectSettings = getProjectSettings(projectId);
      // Check if worklog is disabled in showcase settings
      if (projectSettings?.showcaseSettings?.worklogDisabled) {
        showWarningToast('Worklog er deaktivert for dette prosjektet');
      }
    }
  }, [projectId, getProjectSettings, showWarningToast]);
  
  // Sync user settings - log for debugging
  useEffect(() => {
    if (syncSettings && settings) {
      console.log('Worklog settings sync enabled, current settings:', settings);
    }
  }, [syncSettings, settings]);
  
  // Real-time event listeners for collaboration
  useEffect(() => {
    if (!isConnected || !onEvent || !offEvent) return;
    
    const handleProjectUpdate = (data: any) => {
      if (data.projectId === projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'worklog'] });
        showInfoToast('Worklog oppdatert av samarbeidspartner');
      }
    };
    
    // Use project_updated event type which is supported
    onEvent('project_updated', handleProjectUpdate);
    return () => offEvent('project_updated', handleProjectUpdate);
  }, [isConnected, projectId, onEvent, offEvent, queryClient, showInfoToast]);
  
  // Fetch worklog insights from external data
  const fetchWorklogInsights = async (location?: string) => {
    if (!location && !workLocation) return;
    
    setInsightsLoading(true);
    try {
      const targetLocation = location || workLocation;
      
      // Fetch weather data for work location
      const weatherData = await getCurrentWeather({ location: targetLocation });
      const weatherForecast = await getWeatherForecast({ location: targetLocation, days: 3 });
      
      // Note: SSB economic indicators would be fetched here if available
      const economicData = null;
      
      // Calculate travel costs if location is provided
      let travelCosts = null;
      if (targetLocation && worklogData?.data?.length > 0) {
        // Calculate average travel cost based on recent worklog entries
        const recentEntries = worklogData.data.slice(-5); // Last 5 entries
        const avgTimeSpent = recentEntries.reduce((sum: number, entry: any) => sum + (entry.timeSpent || 0), 0) / recentEntries.length;
        
        if (avgTimeSpent > 0) {
          travelCosts = await calculateTravelCosts({
            kilometers: 50, // Default 50km travel distance
            vehicleType: 'car',
            returnTrip: true
        });
      }
    }
      
      setWorklogInsights({
        weather: weatherData,
        forecast: weatherForecast,
        economic: economicData,
        travelCosts,
        location: targetLocation,
        timestamp: new Date().toISOString()
    });
      
  } catch {
      console.warn('Failed to fetch worklog insights');
  } finally {
      setInsightsLoading(false);
  }
};

  const getRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * dailyPrompts.length);
    setCurrentPromptIndex(randomIndex);
    setShowPrompts(true);
};

  const getTodaysSuggestion = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 1000 / 60 / 60 / 24);
    return dailyPrompts[dayOfYear % dailyPrompts.length];
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}t ${mins}min` : `${mins}min`;
};

  const getCategoryInfo = (category: string) => {
    return config.categories.find(cat => cat.value === category) || config.categories[0];
};

  const getMoodInfo = (mood: string) => {
    return moodOptions.find(m => m.value === mood);
};

  // Fetch worklog entries
  const { data: worklogData, isLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'worklog'],
    queryFn: async () => {
      return apiRequest(`/api/projects/${projectId}/worklog`);
    },
    enabled: !!projectId
  });

  // Fetch worklog statistics
  const { data: statsData } = useQuery({
    queryKey: ['/api/projects', projectId, 'worklog/stats'],
    queryFn: async () => {
      return apiRequest(`/api/projects/${projectId}/worklog/stats`);
    },
    enabled: !!projectId
  });

  const worklogEntries = [...(worklogData?.data || [])].sort((a: WorklogEntry, b: WorklogEntry) => {
    const aTime = new Date(a.date || a.createdAt).getTime();
    const bTime = new Date(b.date || b.createdAt).getTime();
    return bTime - aTime;
  });
  const totalEntries = worklogEntries.length;
  const latestEntry = worklogEntries[0] || null;
  const totalDays = statsData?.data?.totalDays || totalEntries;
  const totalTimeSpent = statsData?.data?.totalTimeSpent || 0;
  const averageTimePerDay = statsData?.data?.averageTimePerDay || 0;
  const categoriesUsed = statsData?.data?.categoriesUsed?.length || 0;
  const categoryBreakdown = config.categories
    .map((category) => ({
      ...category,
      count: worklogEntries.filter((entry: WorklogEntry) => entry.category === category.value).length,
    }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const latestMood = latestEntry?.mood ? getMoodInfo(latestEntry.mood) : null;
  const worklogStatusItems = [
    {
      label: 'Prosjekt',
      value: selectedProject?.name || currentProject?.name || worklogContext,
      icon: <WorkOutline sx={{ fontSize: 16 }} />,
      tone: alpha(config.color, 0.12),
    },
    {
      label: 'Realtime',
      value: isConnected ? 'Tilkoblet' : 'Offline',
      icon: <CloudSync sx={{ fontSize: 16 }} />,
      tone: isConnected ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.warning.main, 0.12),
    },
    {
      label: 'Workspace og Keep',
      value: keepSyncStatus.connected
        ? keepSyncStatus.accountEmail || 'Via Workspace'
        : googleWorkspaceStatusLoading
          ? 'Sjekker økt'
          : 'Ikke koblet',
      icon: <Google sx={{ fontSize: 16 }} />,
      tone: keepSyncStatus.connected ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.info.main, 0.12),
    },
    {
      label: 'Varsler',
      value: pushEnabled ? 'På' : 'Av',
      icon: <NotificationsActive sx={{ fontSize: 16 }} />,
      tone: pushEnabled ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.grey[500], 0.12),
    },
  ];

  // Create worklog entry mutation
  const createEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/projects/${projectId}/worklog`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          ...data, 
          userId
        })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      resetForm();
      setShowCreateDialog(false);
      showSuccessToast('Arbeidslogg-oppføring lagt til!');
      
      // Call callback handlers
      if (onWorklogCreate) {
        onWorklogCreate(data);
      }
      handleProjectUpdateFromWorklog();
      handleNotificationFromWorklog(data);
      
      // Handle category-specific callbacks
      if (data.category === 'client_meeting') {
        handleMeetingFromWorklog(data);
        handleClientInteraction(data);
      }
      if (data.category === 'delivery') {
        handleShowcaseFromWorklog(data);
      }
      
      if (isConnected) {
        emitEvent('item_updated', {
          worklogId: data.id,
          projectId: projectId,
          profession: profession,
          userId: userId,
          workspaceConnected: keepSyncStatus.connected
        });
      }
    }
  });

  // Update worklog entry mutation
  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      return apiRequest(`/api/worklog/${id}`, {
        method: 'PATCH',
        headers: {
          "Content-Type" : "application/json"
      },
        body: JSON.stringify(data)
    });
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      resetForm();
      setShowCreateDialog(false);
      showSuccessToast('Arbeidslogg-oppføring oppdatert!');
      
      if (isConnected) {
        emitEvent('project_updated', {
          worklogId: data.id,
          projectId: projectId,
          profession: profession,
          userId: userId
      });
    }
  }
});

  // Delete worklog entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/worklog/${id}`, {
        method: 'DELETE'
    });
  },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      showSuccessToast('Arbeidslogg-oppføring slettet!');
      
      if (isConnected) {
        emitEvent('item_deleted', {
          worklogId: id,
          projectId: projectId,
          profession: profession,
          userId: userId
      });
    }
  }
});

  const resetForm = () => {
    setFormData({
      day: (worklogData?.data?.length || 0) + 1,
      title: '',
      description: '',
      timeSpent: 0,
      category: config.categories[0]?.value || 'general',
      mood: '',
      nextSteps: ', ',
      isPrivate: false
  });
    setEditingEntry(null);
    setShowPrompts(false);
    setCurrentPromptIndex(0);
};

  // Fetch worklog insights on component mount
  useEffect(() => {
    if (workLocation) {
      fetchWorklogInsights(workLocation);
    }
  }, [workLocation]);
  
  // Address lookup helper for work location
  const handleLocationLookup = async (query: string) => {
    if (!query || query.length < 3) return;
    try {
      const results = await searchKartverketPlaceNames(query);
      if (results?.length > 0 && results[0]) {
        // Use the place name from the search results
        const firstResult = results[0];
        const placeName = firstResult.name || query;
        const fullLocation = firstResult.municipality 
          ? `${placeName}, ${firstResult.municipality}` 
          : placeName;
        
        // Try to get address details
        if (getKartverketAddress) {
          const addressResult = await getKartverketAddress(`${placeName}, Norway`);
          if (addressResult && 'streetName' in addressResult) {
            setWorkLocation(`${addressResult.streetName}, ${fullLocation}`);
            return;
          }
        }
        setWorkLocation(fullLocation);
      }
    } catch {
      console.warn('Address lookup failed');
    }
  };
  
  // Callback handlers for parent component integration
  const handleMeetingFromWorklog = useCallback((entry: WorklogEntry) => {
    if (entry.category === 'client_meeting' && onMeetingCreate) {
      onMeetingCreate({
        title: entry.title,
        description: entry.description,
        projectId: projectId,
        date: entry.date
      });
    }
    if (onMeetingCreated) {
      onMeetingCreated({ worklogId: entry.id, title: entry.title });
    }
  }, [onMeetingCreate, onMeetingCreated, projectId]);
  
  const handleProjectUpdateFromWorklog = useCallback(() => {
    if (onProjectUpdate && selectedProject) {
      onProjectUpdate({
        ...selectedProject,
        lastWorklogUpdate: new Date().toISOString(),
        worklogCount: (worklogData?.data?.length || 0) + 1
      });
    }
    if (onProjectSelect && selectedProject) {
      onProjectSelect(selectedProject);
    }
  }, [onProjectUpdate, onProjectSelect, selectedProject, worklogData?.data?.length]);
  
  const handleClientInteraction = useCallback((entry: WorklogEntry) => {
    if (selectedClient && onClientUpdate) {
      onClientUpdate({
        ...selectedClient,
        lastInteraction: new Date().toISOString(),
        notes: entry.description
      });
    }
    if (onClientSelect && selectedClient) {
      onClientSelect(selectedClient);
    }
  }, [selectedClient, onClientUpdate, onClientSelect]);
  
  const handleShowcaseFromWorklog = useCallback((entry: WorklogEntry) => {
    if (onShowcaseCreate && entry.category === 'delivery') {
      onShowcaseCreate({
        title: entry.title,
        projectId: projectId,
        createdFromWorklog: entry.id
      });
    }
  }, [onShowcaseCreate, projectId]);
  
  const handleFileOperations = useCallback((entry: WorklogEntry, operation: 'upload' | 'download') => {
    if (operation === 'upload' && onFileUpload) {
      onFileUpload({ worklogId: entry.id, projectId });
    }
    if (operation === 'download' && onFileDownload) {
      onFileDownload({ worklogId: entry.id, projectId });
    }
  }, [onFileUpload, onFileDownload, projectId]);
  
  const handleSettingsSync = useCallback(() => {
    if (onSettingsUpdate) {
      const worklogSettings = {
        workspaceSessionActive: keepSyncStatus.connected,
        defaultCategory: config.categories[0]?.value,
        profession: profession
      };
      onSettingsUpdate(worklogSettings);
    }
    // Use updateSetting with proper category and settings
    if (updateSetting && typeof updateSetting === 'function') {
      try {
        // Store worklog sync preference in project creation settings
        updateSetting('projectCreation', { autoCreateWorklog: keepSyncStatus.connected });
      } catch (e) {
        console.warn('Could not update settings:', e);
      }
    }
    setSyncSettings(true);
  }, [onSettingsUpdate, keepSyncStatus.connected, config.categories, profession, updateSetting]);
  
  const handleNotificationFromWorklog = useCallback((entry: WorklogEntry) => {
    if (onNotificationCreate) {
      onNotificationCreate({
        type: 'worklog_created',
        title: `Ny worklog: ${entry.title}`,
        message: entry.description || 'En ny arbeidslogg-oppføring er opprettet',
        projectId: projectId
      });
    }
  }, [onNotificationCreate, projectId]);
  
  // Format currency for travel cost display
  const formatTravelCost = (amount: number) => {
    return formatCurrency(amount, 'NOK');
  };
  
  // Communication channel for cross-component messaging
  useEffect(() => {
    // Log communication context availability for debugging
    if (communication) {
      console.log('📡 Communication context available for worklog');
    }
  }, [communication]);

  const handleSubmit = () => {
    if (!formData.title.trim()) return;

    if (editingEntry) {
      updateEntryMutation.mutate({ id: editingEntry.id, data: formData });
  } else {
      createEntryMutation.mutate(formData);
  }
};

  const handleEdit = (entry: WorklogEntry) => {
    setFormData({
      day: entry.day,
      title: entry.title,
      description: entry.description || ', ',
      timeSpent: entry.timeSpent || 0,
      category: entry.category,
      mood: entry.mood || ', ',
      nextSteps: entry.nextSteps || ', ',
      isPrivate: entry.isPrivate
  });
    setEditingEntry(entry);
    if (isMobile) {
      setMobileView('capture');
      return;
    }
    setShowCreateDialog(true);
};

  if (isMobile) {
    return (
      <Box sx={{ p: 1.5, pb: 11, display: 'grid', gap: 2 }}>
        <MuiCard
          sx={{
            borderRadius: 5,
            overflow: 'hidden',
            color: 'text.primary',
            background: `linear-gradient(180deg, ${alpha(config.color, 0.28)} 0%, ${alpha(config.color, 0.08)} 58%, ${theme.palette.background.paper} 100%)`,
            boxShadow: `0 26px 60px ${alpha(config.color, 0.16)}`,
            border: `1px solid ${alpha(config.color, 0.14)}`,
          }}
        >
          <CardContent sx={{ p: 2.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: alpha(theme.palette.text.primary, 0.62), fontWeight: 700 }}>
                  Hello,
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    mt: 0.25,
                    fontWeight: 800,
                    letterSpacing: '-0.06em',
                    lineHeight: 0.98,
                    fontSize: '2.35rem',
                  }}
                >
                  Worklog
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 220 }}>
                  {selectedProject?.name || currentProject?.name || 'Prosjektlogg'} med fokus på arbeid, refleksjon og neste steg.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <IconButton
                  onClick={() => setPushSettingsOpen(true)}
                  sx={{
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    border: `1px solid ${alpha(config.color, 0.14)}`,
                  }}
                >
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
                <IconButton
                  onClick={() => setShowTutorial(true)}
                  sx={{
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    border: `1px solid ${alpha(config.color, 0.14)}`,
                  }}
                >
                  <HelpOutline />
                </IconButton>
              </Stack>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
              {[
                {
                  title: 'Dager',
                  value: totalDays,
                  bg: 'linear-gradient(135deg, #ff6e4a 0%, #ff8f70 100%)',
                },
                {
                  title: 'Tid',
                  value: formatTime(totalTimeSpent),
                  bg: 'linear-gradient(135deg, #ffd36c 0%, #ffb347 100%)',
                },
                {
                  title: 'Fokus',
                  value: categoryBreakdown[0]?.label || 'Start',
                  bg: 'linear-gradient(135deg, #4fd1c5 0%, #87e4db 100%)',
                },
              ].map((card) => (
                <Paper
                  key={card.title}
                  elevation={0}
                  sx={{
                    minWidth: 138,
                    p: 1.75,
                    borderRadius: 4,
                    color: card.title === 'Tid' ? 'text.primary' : 'common.white',
                    background: card.bg,
                    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.10)',
                  }}
                >
                  <Typography variant="body2" sx={{ opacity: 0.86, fontWeight: 600 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 1.2, fontWeight: 800, letterSpacing: '-0.04em' }}>
                    {card.value}
                  </Typography>
                </Paper>
              ))}
            </Box>

            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 1.75,
                borderRadius: 4,
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                border: `1px solid ${alpha(config.color, 0.12)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
                  {worklogEntries.length > 0 ? `${totalEntries} / ${Math.max(totalDays, totalEntries)} aktive dager` : '0 / 0 aktive dager'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {keepSyncStatus.connected
                    ? 'Google Workspace er aktivt. Worklog kan bruke Keep uten egen innlogging.'
                    : 'Aktiver Google-SSO for mobilnotater og deling.'}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  border: `5px solid ${alpha(config.color, 0.14)}`,
                  borderTopColor: config.color,
                  display: 'grid',
                  placeItems: 'center',
                  color: config.color,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {Math.min(Math.round((totalEntries / Math.max(totalDays || totalEntries || 1, 1)) * 100), 100)}%
              </Box>
            </Paper>
          </CardContent>
        </MuiCard>

        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.25 }}>
          {[
            { id: 'overview', label: 'Oversikt', icon: <Assessment fontSize="small" /> },
            { id: 'capture', label: 'Nytt', icon: <Add fontSize="small" /> },
            { id: 'timeline', label: 'Logg', icon: <Notes fontSize="small" /> },
          ].map((tab) => {
            const active = mobileView === tab.id;
            return (
              <Button
                key={tab.id}
                startIcon={tab.icon}
                onClick={() => setMobileView(tab.id as 'overview' | 'capture' | 'timeline')}
                sx={{
                  flexShrink: 0,
                  borderRadius: 999,
                  px: 2,
                  py: 1,
                  color: active ? 'common.white' : 'text.primary',
                  bgcolor: active ? config.color : alpha(theme.palette.background.paper, 0.9),
                  border: `1px solid ${active ? config.color : alpha(config.color, 0.12)}`,
                  boxShadow: active ? `0 14px 26px ${alpha(config.color, 0.24)}` : 'none',
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </Stack>

        {mobileView === 'overview' && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <MuiCard sx={{ borderRadius: 4, border: `1px solid ${alpha(config.color, 0.12)}` }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="overline" sx={{ color: config.color, fontWeight: 700, letterSpacing: '0.14em' }}>
                  Dagens refleksjon
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.75, fontWeight: 800, letterSpacing: '-0.04em' }}>
                  {getTodaysSuggestion()}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      resetForm();
                      getRandomPrompt();
                      setMobileView('capture');
                    }}
                    sx={{ borderRadius: 999, bgcolor: config.color }}
                  >
                    Svar nå
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowKeepSync(true)}
                    sx={{ borderRadius: 999, borderColor: alpha(config.color, 0.28), color: config.color }}
                  >
                    Workspace og Keep
                  </Button>
                </Stack>
              </CardContent>
            </MuiCard>

            <MuiCard sx={{ borderRadius: 4, border: `1px solid ${alpha(config.color, 0.12)}` }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.04em', mb: 1.5 }}>
                  Synk og samarbeid
                </Typography>
                <Stack spacing={1.25}>
                  {worklogStatusItems.map((item) => (
                    <Paper
                      key={item.label}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 3,
                        bgcolor: item.tone,
                        border: `1px solid ${alpha(config.color, 0.08)}`,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {item.value}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </MuiCard>

            <MuiCard sx={{ borderRadius: 4, border: `1px solid ${alpha(config.color, 0.12)}` }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.04em', mb: 1.5 }}>
                  Arbeidsinnsikter
                </Typography>
                <TextField
                  label="Arbeidslokasjon"
                  fullWidth
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  onBlur={(e) => handleLocationLookup(e.target.value)}
                  placeholder="Oslo, Bergen, Trondheim..."
                />
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => fetchWorklogInsights(workLocation)}
                  disabled={insightsLoading || !workLocation.trim()}
                  startIcon={insightsLoading ? <CircularProgress size={18} color="inherit" /> : <Assessment />}
                  sx={{
                    mt: 1.5,
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.8)} 100%)`,
                  }}
                >
                  {insightsLoading ? 'Henter...' : 'Oppdater innsikt'}
                </Button>

                {worklogInsights?.weather && (
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 1.5,
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.info.main, 0.08),
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {worklogInsights.weather.location}
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 800, color: 'info.dark' }}>
                      {worklogInsights.weather.temperature}°C
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Vind {worklogInsights.weather.windSpeed} m/s • Luftfuktighet {worklogInsights.weather.humidity}%
                    </Typography>
                  </Paper>
                )}

                {categoryBreakdown.length > 0 && (
                  <Stack spacing={1} sx={{ mt: 1.75 }}>
                    {categoryBreakdown.map((category) => (
                      <Box key={category.value}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {category.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {category.count}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.max((category.count / Math.max(totalEntries, 1)) * 100, 8)}
                          sx={{
                            height: 8,
                            borderRadius: 999,
                            bgcolor: alpha(config.color, 0.1),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              bgcolor: config.color,
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </MuiCard>
          </Box>
        )}

        {mobileView === 'capture' && (
          <MuiCard sx={{ borderRadius: 4, border: `1px solid ${alpha(config.color, 0.12)}` }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
                  {editingEntry ? 'Rediger logg' : 'Logg work'}
                </Typography>
                <Chip
                  label={editingEntry ? 'Redigerer' : 'In progress'}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.warning.main, 0.16),
                    color: 'warning.dark',
                    fontWeight: 700,
                  }}
                />
              </Box>

              <Stack spacing={1.5}>
                <TextField
                  label="Dato / dag"
                  type="number"
                  fullWidth
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: parseInt(e.target.value) || 1 })}
                />
                <TextField
                  label="Arbeidet tid (min)"
                  type="number"
                  fullWidth
                  value={formData.timeSpent}
                  onChange={(e) => setFormData({ ...formData, timeSpent: parseInt(e.target.value) || 0 })}
                />
                <TextField
                  label="Hva jobbet du med?"
                  fullWidth
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
                <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                  {config.categories.map((category) => (
                    <Chip
                      key={category.value}
                      label={category.label}
                      onClick={() => setFormData({ ...formData, category: category.value })}
                      sx={{
                        flexShrink: 0,
                        bgcolor: formData.category === category.value ? config.color : alpha(config.color, 0.08),
                        color: formData.category === category.value ? 'common.white' : config.color,
                      }}
                    />
                  ))}
                </Box>
                <FormControl fullWidth>
                  <InputLabel>Stemning</InputLabel>
                  <Select
                    value={formData.mood}
                    label="Stemning"
                    onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Ingen valgt</em>
                    </MenuItem>
                    {moodOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Beskrivelse"
                  fullWidth
                  multiline
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
                <TextField
                  label="Neste steg"
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.nextSteps}
                  onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
                />

                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => {
                      resetForm();
                      setMobileView('overview');
                    }}
                    sx={{ borderRadius: 999, borderColor: alpha(config.color, 0.24), color: config.color }}
                  >
                    Nullstill
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => {
                      handleSubmit();
                      setMobileView('timeline');
                    }}
                    disabled={!formData.title.trim() || createEntryMutation.isPending || updateEntryMutation.isPending}
                    sx={{
                      borderRadius: 999,
                      background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.8)} 100%)`,
                    }}
                  >
                    {editingEntry ? 'Oppdater' : 'Lagre'}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </MuiCard>
        )}

        {mobileView === 'timeline' && (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            {isLoading ? (
              <LinearProgress sx={{ borderRadius: 999, height: 8 }} />
            ) : worklogEntries.length === 0 ? (
              <MuiCard sx={{ borderRadius: 4, border: `1px solid ${alpha(config.color, 0.12)}` }}>
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <IconComponent sx={{ fontSize: 54, color: alpha(config.color, 0.5), mb: 1 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Ingen logg ennå
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    Opprett første innslag for å bygge tidslinjen.
                  </Typography>
                </CardContent>
              </MuiCard>
            ) : (
              worklogEntries.map((entry) => {
                const categoryInfo = getCategoryInfo(entry.category);
                const moodInfo = getMoodInfo(entry.mood || '');

                return (
                  <Paper
                    key={entry.id}
                    elevation={0}
                    sx={{
                      p: 1.75,
                      borderRadius: 4,
                      border: `1px solid ${alpha(config.color, 0.12)}`,
                      boxShadow: '0 10px 26px rgba(15, 23, 42, 0.05)',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <Avatar
                        sx={{
                          width: 42,
                          height: 42,
                          bgcolor: alpha(config.color, 0.14),
                          color: config.color,
                          fontWeight: 800,
                        }}
                      >
                        {entry.day}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
                          {entry.title}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                          <Chip label={categoryInfo.label} size="small" sx={{ bgcolor: alpha(config.color, 0.08), color: config.color }} />
                          {!!entry.timeSpent && (
                            <Chip label={formatTime(entry.timeSpent)} size="small" sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.dark' }} />
                          )}
                          {moodInfo && (
                            <Chip label={`${moodInfo.icon} ${moodInfo.label}`} size="small" sx={{ bgcolor: alpha(moodInfo.color, 0.16), color: moodInfo.color }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          {new Date(entry.date).toLocaleDateString('nb-NO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                        {entry.description && (
                          <Typography variant="body2" sx={{ mt: 1.25, color: 'text.primary', lineHeight: 1.6 }}>
                            {entry.description}
                          </Typography>
                        )}
                        {entry.nextSteps && (
                          <Paper
                            elevation={0}
                            sx={{
                              mt: 1.25,
                              p: 1.25,
                              borderRadius: 2.5,
                              bgcolor: alpha(theme.palette.info.main, 0.08),
                            }}
                          >
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'info.dark', letterSpacing: '0.08em' }}>
                              NESTE STEG
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.4 }}>
                              {entry.nextSteps}
                            </Typography>
                          </Paper>
                        )}
                        <Stack direction="row" spacing={0.25} sx={{ mt: 1, flexWrap: 'wrap' }}>
                          <IconButton onClick={() => handleFileOperations(entry, 'upload')} size="small">
                            <CloudUpload fontSize="small" />
                          </IconButton>
                          <IconButton onClick={() => handleFileOperations(entry, 'download')} size="small">
                            <CloudDownload fontSize="small" />
                          </IconButton>
                          <IconButton onClick={() => handleEdit(entry)} size="small" color="primary">
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton onClick={() => deleteEntryMutation.mutate(entry.id)} size="small" color="error">
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Box>
                    </Box>
                  </Paper>
                );
              })
            )}
          </Box>
        )}

        <Paper
          elevation={0}
          sx={{
            position: 'sticky',
            bottom: 12,
            zIndex: 5,
            p: 0.9,
            borderRadius: 999,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            bgcolor: alpha(theme.palette.background.paper, 0.96),
            border: `1px solid ${alpha(config.color, 0.12)}`,
            boxShadow: '0 18px 46px rgba(15, 23, 42, 0.18)',
          }}
        >
          {[
            { id: 'overview', icon: <Assessment />, label: 'Hjem' },
            { id: 'capture', icon: <Add />, label: 'Ny' },
            { id: 'timeline', icon: <Notes />, label: 'Logg' },
          ].map((item) => {
            const active = mobileView === item.id;
            return (
              <Button
                key={item.id}
                onClick={() => setMobileView(item.id as 'overview' | 'capture' | 'timeline')}
                sx={{
                  minWidth: 0,
                  flex: 1,
                  py: 1,
                  borderRadius: active ? 999 : 3,
                  color: active ? config.color : 'text.secondary',
                  bgcolor: active ? alpha(config.color, 0.12) : 'transparent',
                  display: 'grid',
                  gap: 0.25,
                }}
              >
                <Box sx={{ display: 'grid', placeItems: 'center' }}>{item.icon}</Box>
                <Typography variant="caption" sx={{ fontWeight: active ? 700 : 500 }}>
                  {item.label}
                </Typography>
              </Button>
            );
          })}
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 3 }}>
      <MuiCard
        sx={{
          overflow: 'hidden',
          borderRadius: 4,
          border: `1px solid ${alpha(config.color, 0.18)}`,
          background: `linear-gradient(135deg, ${alpha(config.color, 0.22)} 0%, ${alpha(config.color, 0.08)} 42%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
          boxShadow: `0 24px 64px ${alpha(config.color, 0.14)}`,
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Grid container spacing={3} alignItems="stretch">
            <Grid xs={12} lg={7}>
              <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    flexShrink: 0,
                    width: { xs: 56, md: 68 },
                    height: { xs: 56, md: 68 },
                    borderRadius: 3,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'common.white',
                    background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.7)} 100%)`,
                    boxShadow: `0 18px 40px ${alpha(config.color, 0.28)}`,
                  }}
                >
                  <IconComponent sx={{ fontSize: { xs: 28, md: 34 } }} />
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      letterSpacing: '0.18em',
                      fontWeight: 700,
                      color: alpha(theme.palette.text.primary, 0.62),
                    }}
                  >
                    Worklog Workspace
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{
                      mt: 0.5,
                      fontWeight: 800,
                      lineHeight: 1.05,
                      letterSpacing: '-0.04em',
                      color: theme.palette.text.primary,
                      fontSize: { xs: '2rem', md: '2.7rem' },
                    }}
                  >
                    {config.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      mt: 1.25,
                      maxWidth: 720,
                      color: 'text.secondary',
                      fontSize: { xs: '0.96rem', md: '1.02rem' },
                    }}
                  >
                    Samle dagens arbeid, beslutninger og neste steg i en ryddig arbeidsflyt. Alt her er koblet til prosjekt,
                    samarbeid og videre oppfølging.
                  </Typography>

                  <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {worklogStatusItems.map((item) => (
                      <Chip
                        key={item.label}
                        icon={item.icon}
                        label={`${item.label}: ${item.value}`}
                        sx={{
                          bgcolor: item.tone,
                          color: 'text.primary',
                          borderRadius: 999,
                          height: 34,
                          '& .MuiChip-icon': { color: config.color },
                        }}
                      />
                    ))}
                    {latestMood && (
                      <Chip
                        label={`Siste energi: ${latestMood.icon} ${latestMood.label}`}
                        sx={{
                          bgcolor: alpha(latestMood.color, 0.16),
                          color: latestMood.color,
                          borderRadius: 999,
                          height: 34,
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
            </Grid>

            <Grid xs={12} lg={5}>
              <Box
                sx={{
                  height: '100%',
                  display: 'grid',
                  alignContent: 'space-between',
                  gap: 2,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: `1px solid ${alpha(config.color, 0.14)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Fokus akkurat nå
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {latestEntry
                      ? `Siste oppføring var "${latestEntry.title}" ${new Date(latestEntry.date).toLocaleDateString('nb-NO', {
                          day: 'numeric',
                          month: 'short',
                        })}.`
                      : 'Ingen oppføringer ennå. Start med å dokumentere første arbeidsøkt eller refleksjon.'}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${totalEntries} innslag`}
                      size="small"
                      sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.dark' }}
                    />
                    <Chip
                      label={formatTime(totalTimeSpent)}
                      size="small"
                      sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.dark' }}
                    />
                    <Chip
                      label={`${realtimeNotifications.length} varsler`}
                      size="small"
                      sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.dark' }}
                    />
                  </Stack>
                </Paper>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, justifyContent: { xs: 'flex-start', lg: 'flex-end' } }}>
                  <Tooltip title="Åpne worklog-guide">
                    <IconButton
                      onClick={() => setShowTutorial(true)}
                      sx={{
                        bgcolor: alpha(theme.palette.background.paper, 0.86),
                        border: `1px solid ${alpha(config.color, 0.15)}`,
                      }}
                    >
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Synkroniser innstillinger">
                    <IconButton
                      onClick={handleSettingsSync}
                      sx={{
                        bgcolor: alpha(theme.palette.background.paper, 0.86),
                        border: `1px solid ${alpha(config.color, 0.15)}`,
                        color: syncSettings ? config.color : 'text.primary',
                      }}
                    >
                      <Settings />
                    </IconButton>
                  </Tooltip>

                  {isSupported && (
                    <Tooltip title="Push-varsler">
                      <IconButton
                        onClick={() => setPushSettingsOpen(true)}
                        sx={{
                          bgcolor: alpha(theme.palette.background.paper, 0.86),
                          border: `1px solid ${alpha(config.color, 0.15)}`,
                          color: pushEnabled ? config.color : 'text.primary',
                        }}
                      >
                        {pushEnabled ? <NotificationsActive /> : <Notifications />}
                      </IconButton>
                    </Tooltip>
                  )}

                  <Badge badgeContent={realtimeNotifications.length} color="error">
                    <IconButton
                      sx={{
                        bgcolor: alpha(theme.palette.background.paper, 0.86),
                        border: `1px solid ${alpha(config.color, 0.15)}`,
                      }}
                    >
                      <NotificationIcon />
                    </IconButton>
                  </Badge>

                  <Button
                    variant="outlined"
                    startIcon={<Schedule />}
                    onClick={() => {
                      resetForm();
                      getRandomPrompt();
                      setShowCreateDialog(true);
                    }}
                    sx={{
                      minHeight: 44,
                      borderRadius: 999,
                      borderColor: alpha(config.color, 0.35),
                      color: config.color,
                      bgcolor: alpha(theme.palette.background.paper, 0.72),
                      '&:hover': {
                        borderColor: config.color,
                        bgcolor: alpha(config.color, 0.08),
                      },
                    }}
                  >
                    Daglig refleksjon
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={keepSyncStatus.connected ? <Sync /> : <Google />}
                    onClick={() => setShowKeepSync(true)}
                    sx={{
                      minHeight: 44,
                      borderRadius: 999,
                      borderColor: alpha(theme.palette.success.main, 0.35),
                      color: 'success.dark',
                      bgcolor: alpha(theme.palette.success.main, 0.08),
                    }}
                  >
                    Workspace og Keep
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      resetForm();
                      setShowCreateDialog(true);
                    }}
                    sx={{
                      minHeight: 46,
                      px: 2.25,
                      borderRadius: 999,
                      background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.78)} 100%)`,
                      boxShadow: `0 14px 30px ${alpha(config.color, 0.28)}`,
                    }}
                  >
                    Nytt logginnslag
                  </Button>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </MuiCard>

      <Grid container spacing={3}>
        <Grid xs={12} xl={8.2}>
          <Box sx={{ display: 'grid', gap: 3 }}>
            <Grid container spacing={2.25}>
              {[
                {
                  title: 'Totale dager',
                  value: totalDays,
                  meta: latestEntry ? `Sist aktiv ${new Date(latestEntry.date).toLocaleDateString('nb-NO')}` : 'Ingen aktivitet ennå',
                  icon: <CalendarToday sx={{ fontSize: 24 }} />,
                  gradient: 'linear-gradient(135deg, #1f8f5f 0%, #57c785 100%)',
                },
                {
                  title: 'Tidsbruk',
                  value: formatTime(totalTimeSpent),
                  meta: `${totalEntries} innslag registrert`,
                  icon: <AccessTime sx={{ fontSize: 24 }} />,
                  gradient: 'linear-gradient(135deg, #1976d2 0%, #4dabf5 100%)',
                },
                {
                  title: 'Snitt per dag',
                  value: formatTime(averageTimePerDay),
                  meta: categoryBreakdown[0] ? `${categoryBreakdown[0].label} dominerer` : 'Bygg opp mer historikk',
                  icon: <TrendingUp sx={{ fontSize: 24 }} />,
                  gradient: 'linear-gradient(135deg, #ff8a00 0%, #ffb347 100%)',
                },
                {
                  title: 'Kategorier',
                  value: categoriesUsed,
                  meta: categoryBreakdown.length > 0 ? `${categoryBreakdown.length} aktive typer` : 'Kun én kategori så langt',
                  icon: <Assessment sx={{ fontSize: 24 }} />,
                  gradient: 'linear-gradient(135deg, #7b3ff2 0%, #a972ff 100%)',
                },
              ].map((stat) => (
                <Grid xs={12} sm={6} key={stat.title}>
                  <MuiCard
                    sx={{
                      height: '100%',
                      minHeight: 218,
                      borderRadius: 4,
                      overflow: 'hidden',
                      color: 'common.white',
                      background: stat.gradient,
                      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
                    }}
                  >
                    <CardContent
                      sx={{
                        p: { xs: 2.5, md: 3.25 },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2.5 }}>
                        <Box>
                          <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                            {stat.title}
                          </Typography>
                          <Typography
                            variant="h2"
                            sx={{
                              mt: 2.25,
                              mb: 2.5,
                              fontWeight: 800,
                              letterSpacing: '-0.06em',
                              lineHeight: 0.94,
                              fontSize: { xs: '3rem', md: '3.6rem' },
                            }}
                          >
                            {stat.value}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              opacity: 0.88,
                              display: 'block',
                              maxWidth: 260,
                              lineHeight: 1.5,
                            }}
                          >
                            {stat.meta}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: 62,
                            height: 62,
                            borderRadius: 4,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(theme.palette.common.white, 0.14),
                            flexShrink: 0,
                          }}
                        >
                          <Box sx={{ transform: 'scale(1.15)' }}>{stat.icon}</Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </MuiCard>
                </Grid>
              ))}
            </Grid>

            <MuiCard
              sx={{
                borderRadius: 4,
                border: `1px solid ${alpha(config.color, 0.14)}`,
                boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
              }}
            >
              <CardContent sx={{ p: { xs: 2, md: 2.75 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', md: 'center' },
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 1.5,
                    mb: 2.5,
                  }}
                >
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
                      Arbeidslogg
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      En samlet tidslinje over arbeid, refleksjoner og neste steg for dette prosjektet.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      label={`${totalEntries} oppføringer`}
                      sx={{ bgcolor: alpha(config.color, 0.12), color: config.color }}
                    />
                    {latestEntry && (
                      <Chip
                        label={`Sist oppdatert ${new Date(latestEntry.date).toLocaleDateString('nb-NO', {
                          day: 'numeric',
                          month: 'short',
                        })}`}
                        sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.dark' }}
                      />
                    )}
                  </Stack>
                </Box>

                {isLoading ? (
                  <LinearProgress sx={{ borderRadius: 999, height: 8 }} />
                ) : worklogEntries.length === 0 ? (
                  <Paper
                    sx={{
                      p: { xs: 3, md: 4 },
                      textAlign: 'center',
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.grey[100], 0.72),
                      border: `1px dashed ${alpha(config.color, 0.28)}`,
                    }}
                  >
                    <IconComponent sx={{ fontSize: 56, color: alpha(config.color, 0.54), mb: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Ingen logginnslag ennå
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                      Start med å dokumentere dagens arbeid, refleksjon eller leveranse. Da bygges tidslinje og innsikt automatisk.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => {
                        resetForm();
                        setShowCreateDialog(true);
                      }}
                      sx={{
                        mt: 2.5,
                        borderRadius: 999,
                        background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.78)} 100%)`,
                      }}
                    >
                      Opprett første logginnslag
                    </Button>
                  </Paper>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {worklogEntries.map((entry: WorklogEntry) => {
                      const categoryInfo = getCategoryInfo(entry.category);
                      const moodInfo = getMoodInfo(entry.mood || '');

                      return (
                        <Paper
                          key={entry.id}
                          elevation={0}
                          sx={{
                            p: 2.25,
                            borderRadius: 3,
                            border: `1px solid ${alpha(config.color, 0.12)}`,
                            position: 'relative',
                            overflow: 'hidden',
                            bgcolor: alpha(theme.palette.background.paper, 0.96),
                            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              top: 18,
                              left: 0,
                              width: 4,
                              height: 'calc(100% - 36px)',
                              borderRadius: '0 999px 999px 0',
                              bgcolor: config.color,
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: { xs: 'flex-start', md: 'center' },
                              justifyContent: 'space-between',
                              gap: 2,
                              flexDirection: { xs: 'column', md: 'row' },
                            }}
                          >
                            <Box sx={{ display: 'flex', gap: 2, minWidth: 0, width: '100%' }}>
                              <Avatar
                                sx={{
                                  bgcolor: alpha(config.color, 0.14),
                                  color: config.color,
                                  width: 48,
                                  height: 48,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {entry.day}
                              </Avatar>

                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                  <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
                                    {entry.title}
                                  </Typography>
                                  <Chip
                                    icon={React.createElement(categoryInfo.icon, { style: { fontSize: '16px' } })}
                                    label={categoryInfo.label}
                                    size="small"
                                    sx={{ bgcolor: alpha(config.color, 0.08), color: config.color }}
                                  />
                                  {moodInfo && (
                                    <Chip
                                      label={`${moodInfo.icon} ${moodInfo.label}`}
                                      size="small"
                                      sx={{ bgcolor: alpha(moodInfo.color, 0.16), color: moodInfo.color }}
                                    />
                                  )}
                                  {!!entry.timeSpent && (
                                    <Chip
                                      label={formatTime(entry.timeSpent)}
                                      size="small"
                                      icon={<AccessTime />}
                                      sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: 'info.dark' }}
                                    />
                                  )}
                                </Box>

                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                                  {new Date(entry.date).toLocaleDateString('nb-NO', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </Typography>

                                {entry.description && (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      mt: 1.5,
                                      color: 'text.primary',
                                      lineHeight: 1.65,
                                      maxWidth: 820,
                                    }}
                                  >
                                    {entry.description}
                                  </Typography>
                                )}

                                {entry.nextSteps && (
                                  <Paper
                                    elevation={0}
                                    sx={{
                                      mt: 1.5,
                                      p: 1.5,
                                      borderRadius: 2.5,
                                      bgcolor: alpha(theme.palette.info.main, 0.08),
                                      border: `1px solid ${alpha(theme.palette.info.main, 0.14)}`,
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ color: 'info.dark', fontWeight: 700, letterSpacing: '0.08em' }}>
                                      NESTE STEG
                                    </Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.primary' }}>
                                      {entry.nextSteps}
                                    </Typography>
                                  </Paper>
                                )}
                              </Box>
                            </Box>

                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{
                                flexWrap: 'wrap',
                                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                                width: { xs: '100%', md: 'auto' },
                              }}
                            >
                              <Tooltip title="Last opp filer">
                                <IconButton onClick={() => handleFileOperations(entry, 'upload')} size="small">
                                  <CloudUpload fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Last ned filer">
                                <IconButton onClick={() => handleFileOperations(entry, 'download')} size="small">
                                  <CloudDownload fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eksporter oppføring">
                                <IconButton
                                  onClick={() => {
                                    const exportData = JSON.stringify(entry, null, 2);
                                    navigator.clipboard.writeText(exportData);
                                    showSuccessToast('Oppføring kopiert til utklippstavle');
                                  }}
                                  size="small"
                                >
                                  <ImportExport fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {Boolean(projectId) && (
                                <Tooltip title="Inviter samarbeidspartnere">
                                  <IconButton
                                    onClick={() => {
                                      setSelectedWorklogId(entry.id.toString());
                                      setShowCollaborators(true);
                                    }}
                                    size="small"
                                    color="primary"
                                  >
                                    <PersonAdd />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Rediger">
                                <IconButton onClick={() => handleEdit(entry)} size="small" color="primary">
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Slett">
                                <IconButton onClick={() => deleteEntryMutation.mutate(entry.id)} size="small" color="error">
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </MuiCard>
          </Box>
        </Grid>

        <Grid xs={12} xl={3.8}>
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            <MuiCard
              sx={{
                borderRadius: 4,
                border: `1px solid ${alpha(config.color, 0.14)}`,
                boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Typography variant="overline" sx={{ fontWeight: 700, color: config.color, letterSpacing: '0.14em' }}>
                  Dagens refleksjon
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.75, fontWeight: 700 }}>
                  {getTodaysSuggestion()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Bruk dette som utgangspunkt for et ryddig logginnslag når dagen avsluttes.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      resetForm();
                      getRandomPrompt();
                      setShowCreateDialog(true);
                    }}
                    sx={{
                      borderRadius: 999,
                      bgcolor: config.color,
                      '&:hover': { bgcolor: alpha(config.color, 0.88) },
                    }}
                  >
                    Svar nå
                  </Button>
                  <Button
                    variant="text"
                    onClick={getRandomPrompt}
                    sx={{ borderRadius: 999, color: config.color }}
                  >
                    Nytt spørsmål
                  </Button>
                </Stack>
              </CardContent>
            </MuiCard>

            <MuiCard
              sx={{
                borderRadius: 4,
                border: `1px solid ${alpha(config.color, 0.14)}`,
                boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Synk og samarbeid
                </Typography>

                <Stack spacing={1.25}>
                  {[
                    {
                      title: 'Realtime',
                      description: isConnected ? 'Endringer pushes live mellom samarbeidspartnere.' : 'Kjører lokalt uten live-synk akkurat nå.',
                      status: isConnected ? 'Aktiv' : 'Offline',
                    },
                    {
                      title: 'Workspace og Keep',
                      description: keepSyncStatus.connected
                        ? keepSyncStatus.accountEmail
                          ? `Koblet via ${keepSyncStatus.accountEmail}. Worklog bruker samme Google-økt på tvers av prosjektet.`
                          : 'Koblet via Google Workspace. Worklog bruker samme Google-økt på tvers av prosjektet.'
                        : 'Aktiver Google-SSO for prosjektflyt, mobilnotater og deling i samme workspace.',
                      status: keepSyncStatus.connected ? 'Koblet' : googleWorkspaceStatusLoading ? 'Sjekker' : 'Ikke koblet',
                    },
                    {
                      title: 'Push-varsler',
                      description: pushEnabled ? 'Push er aktivt for relevante worklog-hendelser.' : 'Aktiver varsler for oppdateringer og samarbeid.',
                      status: pushEnabled ? 'På' : 'Av',
                    },
                  ].map((item) => (
                    <Paper
                      key={item.title}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 2.5,
                        bgcolor: alpha(theme.palette.background.default, 0.72),
                        border: `1px solid ${alpha(config.color, 0.1)}`,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: config.color, fontWeight: 700 }}>
                          {item.status}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {item.description}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </MuiCard>

            <MuiCard
              sx={{
                borderRadius: 4,
                border: `1px solid ${alpha(config.color, 0.14)}`,
                boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Arbeidsinnsikter
                </Typography>
                <TextField
                  label="Arbeidslokasjon"
                  fullWidth
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                  onBlur={(e) => handleLocationLookup(e.target.value)}
                  placeholder="Oslo, Bergen, Trondheim..."
                  helperText="Legg til lokasjon for vær og reisekostnader."
                />
                <Button
                  variant="contained"
                  onClick={() => fetchWorklogInsights(workLocation)}
                  disabled={insightsLoading || !workLocation.trim()}
                  fullWidth
                  startIcon={insightsLoading ? <CircularProgress size={18} color="inherit" /> : <Assessment />}
                  sx={{
                    mt: 1.5,
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.8)} 100%)`,
                  }}
                >
                  {insightsLoading ? 'Henter innsikt...' : 'Oppdater innsikt'}
                </Button>

                {worklogInsights ? (
                  <Stack spacing={1.25} sx={{ mt: 2 }}>
                    {worklogInsights.weather && (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          bgcolor: alpha(theme.palette.info.main, 0.08),
                          border: `1px solid ${alpha(theme.palette.info.main, 0.14)}`,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Vær akkurat nå
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {worklogInsights.weather.location}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 0.5, color: 'info.dark', fontWeight: 800 }}>
                          {worklogInsights.weather.temperature}°C
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Luftfuktighet {worklogInsights.weather.humidity}% • Vind {worklogInsights.weather.windSpeed} m/s
                        </Typography>
                      </Paper>
                    )}

                    {worklogInsights.travelCosts && (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          bgcolor: alpha(theme.palette.warning.main, 0.08),
                          border: `1px solid ${alpha(theme.palette.warning.main, 0.14)}`,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Estimert reisekostnad
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 0.5, color: 'warning.dark', fontWeight: 800 }}>
                          {formatTravelCost(worklogInsights.travelCosts.breakdown?.totalCost || 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Basert på {worklogInsights.travelCosts.breakdown?.kilometers || 0} km tur/retur
                        </Typography>
                      </Paper>
                    )}

                    {worklogInsights.forecast?.forecast?.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                          Neste tre dager
                        </Typography>
                        <Grid container spacing={1}>
                          {worklogInsights.forecast.forecast.slice(0, 3).map((day: any, index: number) => (
                            <Grid xs={4} key={index}>
                              <Paper
                                elevation={0}
                                sx={{
                                  p: 1.2,
                                  textAlign: 'center',
                                  borderRadius: 2,
                                  bgcolor: alpha(theme.palette.background.default, 0.82),
                                  border: `1px solid ${alpha(config.color, 0.1)}`,
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'short' })}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.25 }}>
                                  {day.temperature}°C
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {day.precipitation} mm
                                </Typography>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 2,
                      p: 1.75,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.grey[100], 0.76),
                      border: `1px dashed ${alpha(config.color, 0.2)}`,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Legg inn lokasjon for å hente vær, reisegrunnlag og en enklere planlegging av arbeidsdagen.
                    </Typography>
                  </Paper>
                )}
              </CardContent>
            </MuiCard>

            {categoryBreakdown.length > 0 && (
              <MuiCard
                sx={{
                  borderRadius: 4,
                  border: `1px solid ${alpha(config.color, 0.14)}`,
                  boxShadow: '0 18px 48px rgba(15, 23, 42, 0.08)',
                }}
              >
                <CardContent sx={{ p: 2.25 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    Fokusområder
                  </Typography>
                  <Stack spacing={1}>
                    {categoryBreakdown.map((category) => (
                      <Box key={category.value}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {category.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {category.count} innslag
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.max((category.count / Math.max(totalEntries, 1)) * 100, 6)}
                          sx={{
                            height: 8,
                            borderRadius: 999,
                            bgcolor: alpha(config.color, 0.1),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              bgcolor: config.color,
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </MuiCard>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 4,
            backgroundImage: `linear-gradient(180deg, ${alpha(config.color, 0.08)} 0%, ${theme.palette.background.paper} 28%)`,
          },
        }}
      >
        <DialogTitle
          sx={{
            px: { xs: 2, md: 3 },
            pt: { xs: 2.5, md: 3 },
            pb: 2,
          }}
        >
          <Typography variant="overline" sx={{ color: config.color, fontWeight: 700, letterSpacing: '0.14em' }}>
            {editingEntry ? 'Rediger oppføring' : 'Nytt logginnslag'}
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.75, fontWeight: 800, letterSpacing: '-0.04em' }}>
            {editingEntry ? 'Oppdater worklog' : 'Capture work'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Dokumenter arbeid, læring og neste steg i samme flyt. Denne oppføringen kobles direkte til prosjektet ditt.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
          {/* Reflection Prompt */}
          {showPrompts && (
            <MuiCard
              sx={{
                mb: 3,
                borderRadius: 3,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: 'text.primary',
                border: `1px solid ${alpha(theme.palette.info.main, 0.16)}`,
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center' }}>
                  <Mood sx={{ mr: 1 }} />
                  Refleksjonsspørsmål
                </Typography>
                <Typography variant="body1" sx={{ mb: 2, color: 'text.primary' }}>
                  {dailyPrompts[currentPromptIndex]}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    onClick={() => setCurrentPromptIndex((prev) => (prev + 1) % dailyPrompts.length)}
                    sx={{ color: 'info.dark' }}
                  >
                    Neste spørsmål
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => setShowPrompts(false)}
                    sx={{ color: 'text.secondary' }}
                  >
                    Skjul
                  </Button>
                </Box>
              </CardContent>
            </MuiCard>
          )}

          <Grid container spacing={2.25} sx={{ mt: 0.5 }}>
            <Grid xs={12} sm={6}>
              <TextField
                label="Dag nummer"
                type="number"
                fullWidth
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: parseInt(e.target.value) || 1 })}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                label="Tid brukt (minutter)"
                type="number"
                fullWidth
                value={formData.timeSpent}
                onChange={(e) => setFormData({ ...formData, timeSpent: parseInt(e.target.value) || 0 })}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                label="Hva jobbet du med?"
                fullWidth
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Beskriv kort hva du arbeidet med i dag..."
                helperText={showPrompts ? "Tenk på refleksjonsspørsmålet ovenfor når du beskriver dagen" : ""}
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={formData.category}
                  label="Kategori"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {config.categories.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {React.createElement(option.icon, { style: { fontSize: '18px' } })}
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Stemning</InputLabel>
                <Select
                  value={formData.mood}
                  label="Stemning"
                  onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Ingen valgt</em>
                  </MenuItem>
                  {moodOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.icon} {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12}>
              <TextField
                label="Detaljerte notater"
                multiline
                rows={4}
                fullWidth
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Beskriv hva du gjorde, hvordan det gikk, utfordringer, etc..."
                helperText="Del dine erfaringer - hva gikk bra, hva var utfordrende, og hva lærte du?"
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                label="Neste steg"
                multiline
                rows={2}
                fullWidth
                value={formData.nextSteps}
                onChange={(e) => setFormData({ ...formData, nextSteps: e.target.value })}
                placeholder="Hva skal du gjøre i morgen eller neste gang?"
                helperText="Planlegg fremover - hvilke oppgaver, ideer eller forbedringer vil du fokusere på?"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
            borderTop: `1px solid ${alpha(config.color, 0.08)}`,
            justifyContent: 'space-between',
          }}
        >
          <Button onClick={() => setShowCreateDialog(false)} sx={{ borderRadius: 999 }}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.title.trim() || createEntryMutation.isPending || updateEntryMutation.isPending}
            sx={{
              borderRadius: 999,
              px: 2.5,
              background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.8)} 100%)`,
            }}
          >
            {editingEntry ? 'Oppdater' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Collaborators Dialog */}
      <Dialog
        open={showCollaborators}
        onClose={() => setShowCollaborators(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 4,
            backgroundImage: `linear-gradient(180deg, ${alpha(config.color, 0.08)} 0%, ${theme.palette.background.paper} 24%)`,
          },
        }}
      >
        <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2.5, md: 3 }, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Share sx={{ color: config.color }} />
            <Box>
              <Typography variant="overline" sx={{ color: config.color, fontWeight: 700, letterSpacing: '0.14em' }}>
                Samarbeid
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
                Del worklog-oppføring
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
            Inviter samarbeidspartnere til prosjektets worklog-flyt. De bruker samme workspace i stedet for en separat Keep-innlogging.
          </Alert>
          
          <TextField
            label="E-postadresser"
            fullWidth
            multiline
            rows={3}
            value={collaboratorEmails}
            onChange={(e) => setCollaboratorEmails(e.target.value)}
            placeholder={'emma@example.com\njonas@example.com'}
            helperText="Én adresse per linje. Perfekt for team, assistenter eller kunder."
            sx={{ mb: 2 }}
          />

          <Stack spacing={1}>
            {[
              'Invitasjoner går gjennom prosjektets samarbeidsspor',
              'Samme Google-økt brukes videre i workspace',
              'Worklog-konteksten kan følges opp i teamet',
              'Ingen separat Keep-tilkobling er nødvendig',
            ].map((benefit) => (
              <Paper
                key={benefit}
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 2.5,
                  bgcolor: alpha(config.color, 0.06),
                  border: `1px solid ${alpha(config.color, 0.1)}`,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {benefit}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
            borderTop: `1px solid ${alpha(config.color, 0.08)}`,
            justifyContent: 'space-between',
          }}
        >
          <Button onClick={() => setShowCollaborators(false)} sx={{ borderRadius: 999 }}>
            Avbryt
          </Button>
          <Button 
            onClick={async () => {
              if (!selectedWorklogId || !collaboratorEmails.trim()) return;
              
              const emails = collaboratorEmails
                .split('\n')
                .map(e => e.trim())
                .filter(e => e.length > 0 && e.includes('@'));
              
              if (emails.length === 0) {
                showErrorToast('Legg inn gyldige e-postadresser');
                return;
              }

              try {
                await addCollaborators(projectId, selectedWorklogId, emails);
                showSuccessToast(`Inviterte ${emails.length} samarbeidspartner(e) til prosjektet.`);
                setShowCollaborators(false);
                setCollaboratorEmails('');
              } catch {
                showErrorToast('Kunne ikke invitere samarbeidspartnere');
              }
            }}
            variant="contained"
            disabled={addingCollaborators || !collaboratorEmails.trim()}
            startIcon={<PersonAdd />}
            sx={{
              borderRadius: 999,
              px: 2.5,
              background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(config.color, 0.8)} 100%)`,
            }}
          >
            {addingCollaborators ? 'Legger til...' : 'Legg til'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Real-time notification snackbar */}
      {realtimeNotifications.length > 0 && (
        <Snackbar
          open={true}
          message={
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {realtimeNotifications[0].title}
              </Typography>
              <Typography variant="caption">
                {realtimeNotifications[0].message}
              </Typography>
            </Box>
          }
          autoHideDuration={6000}
        />
      )}

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog
          open={pushSettingsOpen}
          onClose={() => setPushSettingsOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={isMobile}
          PaperProps={{
            sx: {
              borderRadius: isMobile ? 0 : 4,
              backgroundImage: `linear-gradient(180deg, ${alpha(config.color, 0.08)} 0%, ${theme.palette.background.paper} 24%)`,
            },
          }}
        >
          <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2.5, md: 3 }, pb: 1.5 }}>
            <Typography variant="overline" sx={{ color: config.color, fontWeight: 700, letterSpacing: '0.14em' }}>
              Notifikasjoner
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 800, letterSpacing: '-0.04em' }}>
              Push-varsler
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={currentUserId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 2, borderTop: `1px solid ${alpha(config.color, 0.08)}` }}>
            <Button onClick={() => setPushSettingsOpen(false)} sx={{ borderRadius: 999 }}>
              Lukk
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Google Keep Sync Dialog */}
      <Dialog
        open={showKeepSync}
        onClose={() => setShowKeepSync(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 4,
            backgroundImage: `linear-gradient(180deg, ${alpha('#4285f4', 0.08)} 0%, ${theme.palette.background.paper} 26%)`,
          },
        }}
      >
        <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2.5, md: 3 }, pb: 1.5 }}>
          <Typography variant="overline" sx={{ color: '#4285f4', fontWeight: 700, letterSpacing: '0.14em' }}>
            Google Workspace
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Google sx={{ color: '#4285f4' }} />
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
              Google Workspace og Keep
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, pb: 2 }}>
          <Alert 
            severity={keepSyncStatus.connected ? 'success' : 'info'} 
            sx={{ mb: 2, borderRadius: 3 }}
            icon={keepSyncStatus.connected ? <CloudSync /> : <Sync />}
          >
            {keepSyncStatus.connected 
              ? keepSyncStatus.accountEmail
                ? `Tilkoblet via ${keepSyncStatus.accountEmail}. Worklog bruker samme Google-økt uten separat Keep-innlogging.`
                : 'Tilkoblet via Google Workspace. Worklog bruker samme Google-økt uten separat Keep-innlogging.'
              : googleWorkspaceStatusLoading
                ? 'Sjekker Google Workspace-økten din.'
                : 'Aktiver Google-SSO for å bruke Worklog med Keep, deling og mobilnotater.'}
          </Alert>

          {keepSyncStatus.workspaceWarning ? (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }}>
              {keepSyncStatus.workspaceWarning}
            </Alert>
          ) : null}
          
          {keepSyncStatus.lastSync && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sist oppdatert i Workspace: {new Date(keepSyncStatus.lastSync).toLocaleString('nb-NO')}
            </Typography>
          )}
          
          <Stack spacing={1}>
            {[
              'Se arbeidslogg-notater på mobilen',
              'Dele notater med samarbeidspartnere',
              'Få påminnelser om oppgaver',
              'Jobbe offline og synkronisere senere',
            ].map((item) => (
              <Paper
                key={item}
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 2.5,
                  bgcolor: alpha('#4285f4', 0.06),
                  border: `1px solid ${alpha('#4285f4', 0.1)}`,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {item}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
            borderTop: `1px solid ${alpha('#4285f4', 0.08)}`,
            justifyContent: 'space-between',
          }}
        >
          <Button onClick={() => setShowKeepSync(false)} sx={{ borderRadius: 999 }}>
            Lukk
          </Button>
          {(!keepSyncStatus.connected || Boolean(keepSyncStatus.workspaceWarning)) && (
            <Button 
              variant="contained"
              startIcon={<Google />}
              onClick={() => {
                void handleKeepGoogleSso();
              }}
              sx={{
                borderRadius: 999,
                px: 2.5,
                bgcolor: '#4285f4',
                '&:hover': { bgcolor: '#3367d6' },
              }}
            >
              {keepSyncStatus.connected ? 'Forny Google-SSO' : 'Aktiver Google-SSO'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Worklog Tutorial Modal */}
      <WorklogTutorial
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        profession={profession}
        professionName={profession === 'photographer' ? 'Fotograf' : 
                       profession === 'videographer' ? 'Videograf' : 
                       profession === 'musicproducer' ? 'Musikkprodusent' : 
                       profession === 'vendor' ? 'Leverandør' : 'Kreativ'}
        onDismiss={() => setShowTutorial(false)}
      />
    </Box>
  );
}
