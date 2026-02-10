import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import CameraAlt from '@mui/icons-material/CameraAlt';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Paper,
  Avatar,
  LinearProgress,
  useTheme,
  alpha,
  CircularProgress,
  Tooltip,
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
import { Alert, Snackbar, Badge } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

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
  const professionIcon = <CameraAlt />;
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
  const theming = useTheming(profession);
  
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
  const [keepSyncStatus, setKeepSyncStatus] = useState<{
    connected: boolean;
    lastSync: string | null;
    syncedEntries: number;
  }>({ connected: false, lastSync: null, syncedEntries: 0 });
  
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
  
  // Real-time notifications
  const { connected: wsConnected, notifications: realtimeNotifications } = useRealtimeNotifications(userId);
  const { addCollaborators, adding: addingCollaborators } = useWorklogCollaboration();
  
  // Push notifications
  const { user } = useAuth();
  const currentUserId = userId || user?.id?.toString() || '';
  const { pushEnabled, isSupported } = usePushNotifications(currentUserId);
  
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

  const showSuccessToast = (message: string) => showToast(message, 'success');
  const showErrorToast = (message: string) => showToast(message, 'error');
  const showWarningToast = useCallback((message: string) => showToast(message, 'warning'), []);
  const showInfoToast = useCallback((message: string) => showToast(message, 'info'), []);
  
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
  
  // Fetch Google Keep sync status
  useEffect(() => {
    const fetchKeepStatus = async () => {
      try {
        const response = await fetch('/api/google-keep/status', { credentials: 'include' });
        if (response.ok) {
          const status = await response.json();
          setKeepSyncStatus({
            connected: status.connected || false,
            lastSync: status.lastSync || null,
            syncedEntries: status.syncedEntries || 0
          });
        }
      } catch {
        console.warn('Could not fetch Google Keep status');
      }
    };
    fetchKeepStatus();
  }, []);

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
          userId,
          syncToGoogleKeep: keepSyncStatus.connected
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
          syncedToGoogleKeep: keepSyncStatus.connected
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
        syncToGoogleKeep: keepSyncStatus.connected,
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
    setShowCreateDialog(true);
};

  return (
    <Box sx={{ p: 3 }}>
      {/* Worklog Context Alert */}
      <Alert 
        severity="info" 
        icon={<WorkOutline />}
        sx={{ 
          mb: 3,
          bgcolor: `${config.color}10`,
          borderLeft: `4px solid ${config.color}`,
          '& .MuiAlert-icon': { color: config.color }
      }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">
            <strong>Worklog-administrasjon: </strong> Du administrerer worklog for {worklogContext}. 
            Alle arbeidslogg-oppføringer lagres automatisk med {profession}-spesifikke kategorier og timetracking.
          </Typography>
          {isConnected && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
              <Box sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: '50%', 
                bgcolor: 'success.main',
                animation: 'pulse 2s infinite'
            }} />
              <Typography variant="caption" color="success.main">
                Live
              </Typography>
            </Box>
          )}
        </Box>
      </Alert>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, color: config.color, display: 'flex', alignItems: 'center' }}>
          {professionIcon}
          <IconComponent sx={{ mr: 2, ml: 1, fontSize: 40 }} />
          {config.title}
          {wsConnected && (
            <Box sx={{ 
              ml: 2, 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              bgcolor: 'success.main',
              animation: 'pulse 2s infinite'
            }} 
            title="Real-time sync active"
            />
          )}
          {keepSyncStatus.connected && (
            <Tooltip title={`Synkronisert til Google Keep (${keepSyncStatus.syncedEntries} oppføringer)`}>
              <CloudSync sx={{ ml: 1, fontSize: 20, color: 'success.main' }} />
            </Tooltip>
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Tutorial/Help button */}
          <Tooltip title="Åpne worklog-guide">
            <IconButton 
              onClick={() => setShowTutorial(true)}
              color="primary"
            >
              <HelpOutline />
            </IconButton>
          </Tooltip>
          
          {/* Settings button */}
          <Tooltip title="Synkroniser innstillinger">
            <IconButton 
              onClick={handleSettingsSync}
              color={syncSettings ? 'primary' : 'default'}
            >
              <Settings />
            </IconButton>
          </Tooltip>
          
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
          {/* Real-time notification badge */}
          <Badge badgeContent={realtimeNotifications.length} color="error">
            <IconButton 
              size="small"
              sx={{ 
                bgcolor: realtimeNotifications.length > 0 ? 'error.light' : 'transparent', 
                '&:hover': { bgcolor: 'error.light' }
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
              borderColor: config.color,
              color: config.color, 
              '&:hover': {
                borderColor: config.color,
                bgcolor: `${config.color}10`
              }
            }}
          >
            Daglig Refleksjon
          </Button>
          <Button
            variant="outlined"
            startIcon={keepSyncStatus.connected ? <Sync /> : <Google />}
            onClick={() => setShowKeepSync(true)}
            sx={{
              borderColor: theme.palette.success.main,
              color: theme.palette.success.main,
              '&:hover': {
                borderColor: theme.palette.success.main,
                bgcolor: alpha(theme.palette.success.main, 0.1)
              }
            }}
          >
            Google Keep
          </Button>
          <Button 
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            sx={{
              background: `linear-gradient(135deg, ${config.color} 0%, ${config.color}80 100%)`,
              borderRadius: 2,
              px: 3
            }}
          >
            Nytt Logg-innslag
          </Button>
        </Box>
      </Box>

      {/* Today's Inspiration */}
      <MuiCard sx={{ mb: 3, background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}05 100%)`, border: `1px solid ${config.color}30` }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              p: 1.5, 
              borderRadius: 2, 
              bgcolor: config.color,
              color: 'white'
          }}>
              <IconComponent />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Dagens refleksjon
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                {getTodaysSuggestion()}
              </Typography>
            </Box>
            <Button 
              variant="contained"
              size="small"
              onClick={() => {
                resetForm();
                getRandomPrompt();
                setShowCreateDialog(true);
            }}
              sx={{
                bgcolor: config.color,
                '&:hover': { bgcolor: `${config.color}dd` }
            }}
            >
              Svar
            </Button>
          </Box>
        </CardContent>
      </MuiCard>

      {/* Worklog Insights Section */}
      <MuiCard sx={{ mb: 3, background: `linear-gradient(135deg, ${config.color}10 0%, ${config.color}05 100%)`, border: `1px solid ${config.color}30` }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: theming.colors.primary 
        }}>
            🌍 Arbeidsinsikter
          </Typography>
          
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid xs={12} sm={8}>
              <TextField
                label="Arbeidslokasjon (valgfritt)"
                fullWidth
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                onBlur={(e) => handleLocationLookup(e.target.value)}
                placeholder="F.eks. Oslo, Bergen, Trondheim..."
                helperText="Legg til lokasjon for å få værmelding og reisekostnader. Trykk Tab for adresseoppslag."
              />
            </Grid>
            <Grid xs={12} sm={4}>
              <Button
                variant="contained"
                onClick={() => fetchWorklogInsights(workLocation)}
                disabled={insightsLoading || !workLocation.trim()}
                fullWidth
                startIcon={insightsLoading ? <CircularProgress size={20} /> : <Assessment />}
                sx={{ 
                  background: 'linear-gradient(45deg, #ff8c00, #ff6b35)','&:hover': {
                    background: 'linear-gradient(45deg, #ff6b35, #ff8c00)',
                }
              }}
              >
                {insightsLoading ? 'Henter...' : 'Hent Insikter'}
              </Button>
            </Grid>
          </Grid>
          
          {/* Display Insights */}
          {worklogInsights && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                {/* Weather Information */}
                {worklogInsights.weather && (
                  <Grid xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 2, bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        🌤️ Vær
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {worklogInsights.weather.location}
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'info.dark' }}>
                        {worklogInsights.weather.temperature}°C
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Luftfuktighet: {worklogInsights.weather.humidity}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Vind: {worklogInsights.weather.windSpeed} m/s
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                
                {/* Economic Indicators */}
                {worklogInsights.economic && (
                  <Grid xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 2, bgcolor: 'success.light', border: '1px solid', borderColor: 'success.main' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        📊 Økonomi
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Norske økonomiske indikatorer
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {worklogInsights.economic.indicators?.length || 0} indikatorer tilgjengelig
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Oppdatert: {new Date(worklogInsights.economic.lastUpdated).toLocaleDateString('nb-NO')}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
                
                {/* Travel Costs */}
                {worklogInsights.travelCosts && (
                  <Grid xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 2, bgcolor: 'warning.light', border: '1px solid', borderColor: 'warning.main' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        🚗 Reisekostnader
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Estimert reisekostnad
                      </Typography>
                      <Typography variant="h6" sx={{ color: 'warning.dark' }}>
                        {formatTravelCost(worklogInsights.travelCosts.breakdown?.totalCost || 0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Avstand: {worklogInsights.travelCosts.breakdown?.kilometers || 0} km
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
              
              {/* Weather Forecast */}
              {worklogInsights.forecast && worklogInsights.forecast.forecast && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📅 3-dagers værmelding
                  </Typography>
                  <Grid container spacing={1}>
                    {worklogInsights.forecast.forecast.slice(0, 3).map((day: any, index: number) => (
                      <Grid xs={4} key={index}>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'background.default' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'short' })}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600}}>
                            {day.temperature}°C
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {day.precipitation}mm
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </MuiCard>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} md={3}>
          <MuiCard sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Totalt Dager</Typography>
                  <Typography variant="h3">{statsData?.data?.totalDays || 0}</Typography>
                </Box>
                <CalendarToday sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
        
        <Grid xs={12} md={3}>
          <MuiCard sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Total Tid</Typography>
                  <Typography variant="h3">{formatTime(statsData?.data?.totalTimeSpent || 0)}</Typography>
                </Box>
                <AccessTime sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid xs={12} md={3}>
          <MuiCard sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Snitt per Dag</Typography>
                  <Typography variant="h3">{formatTime(statsData?.data?.averageTimePerDay || 0)}</Typography>
                </Box>
                <TrendingUp sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid xs={12} md={3}>
          <MuiCard sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">Kategorier</Typography>
                  <Typography variant="h3">{statsData?.data?.categoriesUsed?.length || 0}</Typography>
                </Box>
                <Assessment sx={{ fontSize: 40, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Worklog Entries */}
      <MuiCard>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <Notes sx={{ mr: 1 }} />
            Arbeids-logg
          </Typography>
          
          {isLoading ? (
            <LinearProgress />
          ) : worklogData?.data?.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
              <IconComponent sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
              <Typography color="text.secondary" variant="h6">
                Ingen logg-innslag ennå
              </Typography>
              <Typography color="text.secondary">
                Start med å legge til ditt første arbeids-innslag
              </Typography>
            </Paper>
          ) : (
            <List>
              {worklogData?.data?.map((entry: WorklogEntry, index: number) => {
                const categoryInfo = getCategoryInfo(entry.category);
                const moodInfo = getMoodInfo(entry.mood || ', ');
                
                return (
                  <React.Fragment key={entry.id}>
                    <ListItem sx={{ alignItems: 'flex-start', py: 2 }}>
                      <Avatar sx={{ 
                        mr: 2, 
                        mt: 0.5,
                        bgcolor: config.color,
                        width: 48,
                        height: 48,
                        fontSize: '1.2rem'
                    }}>
                        {entry.day}
                      </Avatar>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600}}>
                              {entry.title}
                            </Typography>
                            <Chip 
                              icon={React.createElement(categoryInfo.icon, { style: { fontSize: '16px' } })}
                              label={categoryInfo.label}
                              size="small"
                              variant="outlined"
                            />
                            {moodInfo && (
                              <Chip 
                                label={`${moodInfo.icon} ${moodInfo.label}`}
                                size="small"
                                sx={{ bgcolor: moodInfo.color, color: 'white' }}
                              />
                            )}
                            {entry.timeSpent && entry.timeSpent > 0 && (
                              <Chip 
                                label={formatTime(entry.timeSpent)}
                                size="small"
                                icon={<AccessTime />}
                                color="info"
                              />
                            )}
                          </Box>
                      }
                        secondary={
                          <Box>
                            {entry.description && (
                              <Typography variant="body2" sx={{ mb: 1, color: 'text.primary' }}>
                                {entry.description}
                              </Typography>
                            )}
                            {entry.nextSteps && (
                              <Typography variant="body2" sx={{ 
                                mb: 1, 
                                p: 1.5, 
                                bgcolor: 'info.light', 
                                borderRadius: 1,
                                color: 'info.contrastText'
                            }}>
                                <strong>Neste steg: </strong> {entry.nextSteps}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {new Date(entry.date).toLocaleDateString('nb-NO', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                            </Typography>
                          </Box>
                      }
                      />
                      
                      <ListItemSecondaryAction>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {/* Import/Export buttons */}
                          <Tooltip title="Last opp filer">
                            <IconButton 
                              onClick={() => handleFileOperations(entry, 'upload')}
                              color="default"
                              size="small"
                            >
                              <CloudUpload fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Last ned filer">
                            <IconButton 
                              onClick={() => handleFileOperations(entry, 'download')}
                              color="default"
                              size="small"
                            >
                              <CloudDownload fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Import/Export action */}
                          <Tooltip title="Eksporter oppføring">
                            <IconButton
                              onClick={() => {
                                const exportData = JSON.stringify(entry, null, 2);
                                navigator.clipboard.writeText(exportData);
                                showSuccessToast('Oppføring kopiert til utklippstavle');
                              }}
                              color="default"
                              size="small"
                            >
                              <ImportExport fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Share/Collaborate button if synced to Google Keep */}
                          {(entry as any).googleKeepNoteId && (
                            <IconButton 
                              onClick={() => {
                                setSelectedWorklogId(entry.id.toString());
                                setShowCollaborators(true);
                              }}
                              color="primary"
                              title="Add collaborators (Google Keep)"
                            >
                              <PersonAdd />
                            </IconButton>
                          )}
                          <IconButton onClick={() => handleEdit(entry)} color="primary">
                            <Edit />
                          </IconButton>
                          <IconButton 
                            onClick={() => deleteEntryMutation.mutate(entry.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {index < worklogData.data.length - 1 && <Divider />}
                  </React.Fragment>
                );
            })}
            </List>
          )}
        </CardContent>
      </MuiCard>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingEntry ? 'Rediger Logg-innslag' : 'Nytt Logg-innslag'}
        </DialogTitle>
        <DialogContent>
          {/* Reflection Prompt */}
          {showPrompts && (
            <MuiCard sx={{ mb: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center' }}>
                  <Mood sx={{ mr: 1 }} />
                  Refleksjonsspørsmål
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {dailyPrompts[currentPromptIndex]}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    onClick={() => setCurrentPromptIndex((prev) => (prev + 1) % dailyPrompts.length)}
                    sx={{ color: 'info.contrastText' }}
                  >
                    Neste spørsmål
                  </Button>
                  <Button 
                    size="small" 
                    onClick={() => setShowPrompts(false)}
                    sx={{ color: 'info.contrastText' }}
                  >
                    Skjul
                  </Button>
                </Box>
              </CardContent>
            </MuiCard>
          )}

          <Grid container spacing={3} sx={{ mt: 1 }}>
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
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Avbryt
          </Button>
          <Button 
            onClick={handleSubmit}
            variant="contained"
            disabled={!formData.title.trim() || createEntryMutation.isPending || updateEntryMutation.isPending}
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
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Share />
            <Typography variant="h6">Share Worklog Entry</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Add collaborators via Google Keep. They'll be able to view and edit this entry in their Google Keep app.
          </Alert>
          
          <TextField
            label="Collaborator Emails"
            fullWidth
            multiline
            rows={3}
            value={collaboratorEmails}
            onChange={(e) => setCollaboratorEmails(e.target.value)}
            placeholder="Enter email addresses (one per line)&#10;emma@example.com&#10;jonas@example.com"
            helperText="Add team members, assistants, or clients who should see this worklog entry in Google Keep"
            sx={{ mb: 2 }}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            <strong>Benefits of Google Keep collaboration:</strong>
            <br />• Collaborators can view the worklog on their phones
            <br />• They can check off action items in real-time
            <br />• Changes sync automatically
            <br />• Perfect for team coordination
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCollaborators(false)}>
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              if (!selectedWorklogId || !collaboratorEmails.trim()) return;
              
              const emails = collaboratorEmails
                .split('\n')
                .map(e => e.trim())
                .filter(e => e.length > 0 && e.includes('@'));
              
              if (emails.length === 0) {
                showErrorToast('Please enter valid email addresses');
                return;
              }

              try {
                await addCollaborators(selectedWorklogId, emails);
                showSuccessToast(`Added ${emails.length} collaborator(s) to Google Keep!`);
                setShowCollaborators(false);
                setCollaboratorEmails(', ');
              } catch {
                showErrorToast('Failed to add collaborators');
              }
            }}
            variant="contained"
            disabled={addingCollaborators || !collaboratorEmails.trim()}
            startIcon={<PersonAdd />}
            sx={{ bgcolor: config.color }}
          >
            {addingCollaborators ? 'Adding...' : 'Add Collaborators'}
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
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={currentUserId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Google Keep Sync Dialog */}
      <Dialog open={showKeepSync} onClose={() => setShowKeepSync(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Google sx={{ color: '#4285f4' }} />
          Google Keep Synkronisering
        </DialogTitle>
        <DialogContent>
          <Alert 
            severity={keepSyncStatus.connected ? 'success' : 'info'} 
            sx={{ mb: 2 }}
            icon={keepSyncStatus.connected ? <CloudSync /> : <Sync />}
          >
            {keepSyncStatus.connected 
              ? `Tilkoblet! ${keepSyncStatus.syncedEntries} oppføringer synkronisert.`
              : 'Koble til Google Keep for å synkronisere dine arbeidslogg-notater.'}
          </Alert>
          
          {keepSyncStatus.lastSync && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sist synkronisert: {new Date(keepSyncStatus.lastSync).toLocaleString('nb-NO')}
            </Typography>
          )}
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            Med Google Keep-synkronisering kan du:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <li>Se arbeidslogg-notater på mobilen</li>
            <li>Dele notater med samarbeidspartnere</li>
            <li>Få påminnelser om oppgaver</li>
            <li>Jobbe offline og synkronisere senere</li>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKeepSync(false)}>Lukk</Button>
          {!keepSyncStatus.connected && (
            <Button 
              variant="contained"
              startIcon={<Google />}
              onClick={() => {
                window.open('/api/auth/google/keep', '_blank');
              }}
              sx={{ bgcolor: '#4285f4', '&:hover': { bgcolor: '#3367d6' } }}
            >
              Koble til Google Keep
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
