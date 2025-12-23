import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { trackButtonClick, trackTabChange, trackModalOpen } from '@/hooks/useActionTracker';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/hooks/useAuth';
import { isProfessionFeatureAvailable } from '@shared/profession-feature-matrix';
import AdminIndicator from '../admin/AdminIndicator';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useExternalData } from '../../services/ExternalDataService';
import { UniversalDashboardProvider, useUniversalDashboard } from './UniversalDashboardContext';
import CreatorHubMarketplace from '../resume/ResumeBuilderMarketplace';
import SignatureStatusOverview from './signatures/SignatureStatusOverview';
import ContractSummaryWidget from '../contract-designer/ContractSummaryWidget';
import RelatedItemsWidget from './shared/RelatedItemsWidget';
import { Card as MuiCard, CardContent as MuiCardContent, CardActions as MuiCardActions } from '@mui/material';
import {
  Box,
  Container,
  Typography,
  Grid,
  Avatar,
  Button,
  Tabs as MuiTabs,
  Tab,
  Badge,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Tooltip,
  Fab,
  useTheme,
  useMediaQuery,
  Stack,
  LinearProgress,
  alpha,
  Fade,
  Collapse,
  Skeleton,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Store,
  Group,
  Build,
  Add,
  CalendarToday,
  CameraAlt,
  Folder,
  Assessment,
  Settings,
  AttachMoney,
  TrendingUp,
  Event,
  Key,
  Visibility,
  TrendingUp as TimelineIcon,
  Business,
  Email,
  Notifications,
  CloudDone,
  Article,
  FolderOpen,
  AddCircle,
  Storage,
  Star,
  Chat,
  Person,
  Phone,
  MoreVert,
  AccessTime,
  LocationOn,
  Payment,
  Keyboard,
  Schedule,
  Palette,
  CheckCircle,
  HelpCenter,
  Quiz,
  PriorityHigh,
  Delete,
  Launch,
  Edit,
  Circle,
  AccountCircle,
  Collections,
  Brightness1,
  WbSunny,
  Favorite as WeddingIcon,
  WbCloudy,
  Umbrella,
  Remove,
  NotificationsActive,
  NotificationAdd,
  AutoFixHigh,
  SmartToy,
  MovieCreation,
  GetApp,
  CloudUpload,
  School,
  ArrowBack,
  AccountBalance
} from '@mui/icons-material';

// Import profession-specific components
import BRREGIntegration from '../unused/profession-specific/BRREGIntegration';
import AdvancedClientManagement from './misc/AdvancedClientManagement';

// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import EquipmentManagementDB from '../unused/profession-specific/EquipmentManagementDB';
import ProfessionAdapter from './ProfessionAdapter';
import SmartWorkflowBuilder from './SmartWorkflowBuilder'; // Visual workflow builder with action buttons
import FloatingActionButtons from './misc/FloatingActionButtons';

// Import Settings Components
import PriceAdministration from '../PriceAdministration';
import BusinessBrandingSettings from '../BusinessBrandingSettings';
import MemoryCardPricingAdmin from '../admin/MemoryCardPricingAdmin';

// Import Tutorial & FAQ System
import { TutorialFAQIntegration } from '../tutorial/TutorialFAQIntegration';
import UniversalDashboardIntegrationTest from './UniversalDashboardIntegrationTest';
import { InteractiveTutorialCreator } from '../tutorial/InteractiveTutorialCreator';
import { CreatorHubBadgeSystem } from '../gamification/CreatorHubBadgeSystem';
import { CompactBadgeDisplay } from '../gamification/CompactBadgeDisplay';
import WeddingTimelineAdmin from '../wedding/WeddingTimelineAdmin';

// Import Universal Settings Panel - AUTOMATIC FAQ FOR ALL PROFESSIONS
import UniversalSettingsPanel from './UniversalSettingsPanel';

// Import Academy Dashboard
import AcademyDashboard from '../academy/AcademyDashboard';
// Import Universal Showcase
import UniversalShowcase from './UniversalShowcase';
// Import CreatorHub Icons
import { AcademyIcon } from '../shared/CreatorHubIcons';

// Import Google Drive components
import GoogleDriveManager from '../google-drive/GoogleDriveManager';
import GoogleDriveProjectSync from '../google-drive/GoogleDriveProjectSync';
import GoogleWorkspaceStorageInfo from './GoogleWorkspaceStorageInfo';

// Import Equipment Management components
// import ComprehensiveEquipmentDashboard from '@/components/universal/misc/ComprehensiveEquipmentDashboard';
import CameraEquipmentManager from './misc/CameraEquipmentManager';
import MemoryCardManager from '@/components/MemoryCardManager';

// Import Gear News component
import { EnhancedGearTab } from '../dashboard/EnhancedGearTab';
import PersonalizedNewsInterface from '../news/PersonalizedNewsInterface';
import { QuickMeetingNotesModal } from '../meetings/QuickMeetingNotesModal';
import SmartEmailCenter from '../email/SmartEmailCenter';
import CustomerInquiryCenter from '../email/CustomerInquiryCenter';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import VendorProductManager from '../vendor/VendorProductManager';
import { QuickMeetingNotesModal as GoogleWorkspaceMeetingManager } from '../meetings/QuickMeetingNotesModal';
import FilesTab from '../file-management/FilesTab';
import SubmissionsOverview from '../unused/submissions/SubmissionsOverview';
import UniversalKeyboardShortcuts from '../keyboard-shortcuts/UniversalKeyboardShortcuts';
import SmartTimingPreferences from '../smart-timing/SmartTimingPreferences';
import HelpdeskSystem from './HelpdeskSystem';

// Import Timeline & Showcase components for universal access
import ProjectTimeline from '../project/ProjectTimeline';
import ProjectShowcase from '../project/ProjectShowcase';

// Import Universal Components for enhanced integration
import { UniversalDownload } from './UniversalDownload';
import UniversalFileUpload from './UniversalFileUpload';
import { ChatWidget } from '../communication/ChatWidget';
import UniversalChatWidget from '../chat/UniversalChatWidget';
import { useCommunicationStatus, CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';
import { useFileManagementStatus, FileManagementStatusProvider } from '../../contexts/FileManagementStatusContext';
import UniversalPrototypeFeedback from '../prototype-testing/UniversalPrototypeFeedback';
// ChatDemoData removed - 100% real data only
import CentralizedSalesHub from '../sales/CentralizedSalesHub';
import TutorialLauncher from '../tutorials/TutorialLauncher';
import VideoEditor from '../video-editor/VideoEditor';
import StoryArcGenerator from '../StoryArcGenerator';
import UniversalCommunication from '../communication/UniversalCommunication';
import UniversalWorklog from '../worklog/UniversalWorklog';
import EmailProjectHistory from '../email/EmailProjectHistory';
import ContextualPhotographyTipsOverlay from '../photography/ContextualPhotographyTipsOverlay';
import ShowcaseAdmin from '../showcase/ShowcaseAdmin';
import WeddingTimelineOverview from '../wedding/WeddingTimelineOverview';
import WeddingTimelineClientAccess from '../wedding/WeddingTimelineClientAccess';
import WeddingTimelineClientView from '../wedding/WeddingTimelineClientView';
import WeddingTimelineChangesOverview from '../wedding/WeddingTimelineChangesOverview';

// Import Client Activity Panel for dashboard integration
import ClientActivityPanel from './showcase/ClientActivityPanel';

// Import Story Arc Studio for Pro Editor Mode
import StoryArcStudio from '../StoryArcStudio';

// Import tested integration components
import UniversalOAuthIntegration from '../oauth/UniversalOAuthIntegration';
import IntegratedToolsOverview from './IntegratedToolsOverview';
import EmailDesigner from '../EmailDesigner/EmailDesigner';


// Import Universal CRM System
import UniversalCRMDashboard from '../crm/UniversalCRMDashboard';

// Import Universal Contract System
import UniversalContractHub from './contracts/UniversalContractHub';

// Import Pricing Administration


// Import Orchestrators - AKTIVERT FOR 100% REAL DATA
import FotografOrchestrator from './FotografOrchestrator';
import VideografOrchestrator from './VideografOrchestrator';
import MusikkProdusentOrchestrator from './MusikkProdusentOrchestrator';
import VendorOrchestrator from './VendorOrchestrator';

// Import Split Sheet Manager
import SplitSheetManager from './split-sheets/SplitSheetManager';

// Import AI Enhancement Systems
import PhotoEnhancementSuite from '../enhancement/PhotoEnhancementSuite';
import AudioEnhancementSuite from '../enhancement/AudioEnhancementSuite';
import { useProfessionConfigs, type ProfessionConfigs } from '@/hooks/useProfessionConfigs';

// Import Community System
import CommunityHub from '../community/CommunityHub';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

// Local profession configurations (FALLBACK - used if database is not configured)
const localProfessionConfigs: ProfessionConfigs = {
  admin: {
    name: 'Admin',
    color: '#ff8c00',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Prosjekter', icon: <Folder /> },
      { id: 'contracts', label: 'Kontrakter', icon: <Article /> },
      { id: 'wedding-timeline', label: 'Bryllupstidslinje', icon: <Event /> },
      { id: 'showcase-admin', label: 'Showcase Admin', icon: <Collections /> },
      { id: 'showcase-viewer', label: 'Showcase Viewer', icon: <Visibility /> },
      { id: 'downloads', label: 'Downloads', icon: <GetApp /> },
      { id: 'file-upload', label: 'File Upload', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'email-center', label: 'E-post', icon: <Email /> },
      { id: 'photo-enhancement', label: 'Fotoforbedring', icon: <Collections /> },
      { id: 'client-management', label: 'Klientadministrasjon', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['bryllup','portrett','event','kommersiell'],
    stats: [
      { key: 'projects', label: 'Aktive Prosjekter', icon: <Folder /> },
      { key: 'clients', label: 'Nye Kunder', icon: <Group /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'bookings', label: 'Bookinger', icon: <CalendarToday /> }
    ]
},
  photographer: {
    name: 'Fotograf',
    color: '#ff8c00',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Prosjekter', icon: <Folder /> },
      { id: 'community', label: 'Community', icon: <Group /> },
      { id: 'academy', label: 'Academy', icon: <School />, requiresMentor: true },
      { id: 'contracts', label: 'Kontrakter', icon: <Article /> },
      { id: 'wedding-timeline', label: 'Bryllupstidslinje', icon: <Event /> },
      { id: 'showcase-admin', label: 'Showcase Admin', icon: <Collections /> },
      { id: 'showcase-viewer', label: 'Showcase Viewer', icon: <Visibility /> },
      { id: 'downloads', label: 'Downloads', icon: <GetApp /> },
      { id: 'file-upload', label: 'File Upload', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'email-center', label: 'E-post', icon: <Email /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Kunder', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['bryllup','commercial','portrett','produkt'],
    stats: [
      { key: 'projects', label: 'Aktive Prosjekter', icon: <Folder /> },
      { key: 'clients', label: 'Nye Kunder', icon: <Group /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'rating', label: 'Gjennomsnittsvurdering', icon: <Star /> }
    ]
},
  videographer: {
    name: 'Videograf',
    color: '#e74c3c',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Videoer', icon: <Videocam /> },
      { id: 'community', label: 'Community', icon: <Group /> },
      { id: 'academy', label: 'Academy', icon: <School />, requiresMentor: true },
      { id: 'contracts', label: 'Kontrakter', icon: <Article /> },
      { id: 'wedding-timeline', label: 'Bryllupstidslinje', icon: <Event /> },
      { id: 'showcase-admin', label: 'Showcase Admin', icon: <Collections /> },
      { id: 'showcase-viewer', label: 'Showcase Viewer', icon: <Visibility /> },
      { id: 'downloads', label: 'Downloads', icon: <GetApp /> },
      { id: 'file-upload', label: 'File Upload', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'Video AI', icon: <MovieCreation /> },
      { id: 'email-center', label: 'E-post', icon: <Email /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Kunder', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['bryllup','reklame','dokumentar','musikkvideo'],
    stats: [
      { key: 'projects', label: 'Aktive Prosjekter', icon: <Folder /> },
      { key: 'clients', label: 'Nye Kunder', icon: <Group /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'hours', label: 'Timer Redigert', icon: <AccessTime /> }
    ]
},
  music_producer: {
    name: 'Musikkprodusent',
                            color: '#1976d2',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Låter', icon: <LibraryMusic /> },
      { id: 'community', label: 'Community', icon: <Group /> },
      { id: 'academy', label: 'Academy', icon: <School />, requiresMentor: true },
      { id: 'contracts', label: 'Kontrakter', icon: <Article /> },
      { id: 'split-sheets', label: 'Split Sheets', icon: <AccountBalance /> },
      { id: 'showcase-viewer', label: 'Musikk Showcase', icon: <LibraryMusic /> },
      { id: 'downloads', label: 'Musikk Downloads', icon: <GetApp /> },
      { id: 'file-upload', label: 'Musikk Upload', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'Audio AI', icon: <SmartToy /> },
      { id: 'email-center', label: 'E-post', icon: <Email /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Artister', icon: <Person /> },
      { id: 'equipment', label: 'Studio', icon: <Build /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['album','singel','podcast','jingle'],
    stats: [
      { key: 'tracks', label: 'Aktive Spor', icon: <LibraryMusic /> },
      { key: 'artists', label: 'Nye Artister', icon: <Person /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'streams', label: 'Totale Streams', icon: <TrendingUp /> }
    ]
},
  vendor: {
    name: 'Leverandø',
    color: '#27ae60',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Produkter', icon: <Store /> },
      { id: 'clients', label: 'Bestillinger', icon: <Payment /> },
      { id: 'equipment', label: 'Lager', icon: <Storage /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['utleie','salg','service','konsultasjon'],
    stats: [
      { key: 'orders', label: 'Aktive Ordrer', icon: <Payment /> },
      { key: 'customers', label: 'Nye Kunder', icon: <Group /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'inventory', label: 'Lagerstatus', icon: <Storage /> }
    ]
}
};

interface Project {
  id: string;
  title?: string;
  name?: string;
  clientName?: string;
  status?: string;
  eventDate?: string;
  date?: string;
  location?: string;
  description?: string
}

interface Client {
  id: string;
  name?: string;
  email?: string;
  phone?: string
}

interface Equipment {
  id: string;
  name?: string;
  type?: string;
  status?: string
}

interface EmailContext {
  projectId?: string;
  clientId?: string;
  template?: string;
}

interface Notification {
  id: string;
  title?: string;
  message?: string;
  timestamp?: string;
  type?: string
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`universal-tabpanel-${index}`}
      aria-labelledby={`universal-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>{children}</Box>}
    </div>
);
}

interface UniversalDashboardProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin';
}

// Internal component that uses the context
const UniversalDashboardContent: React.FC<UniversalDashboardProps> = ({ profession = 'photographer' }) => {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { status: communicationStatus } = useCommunicationStatus();
  const { status: fileManagementStatus } = useFileManagementStatus();
  
  // Fetch dynamic profession configurations from database
  const { professionConfigs: dynamicProfessionConfigs, hasData: hasDynamicConfigs } = useProfessionConfigs();
  
  // Use dynamic configs if available, otherwise fall back to static configs
  const professionConfigs = hasDynamicConfigs ? dynamicProfessionConfigs : localProfessionConfigs;
  
  // Profession adapter and dynamic professions for auto-scalability
  const { getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle, adaptTabLabels } = useProfessionAdapter();
  
  // Helper function to convert admin profession to photographer for components that don't support admin
  const getComponentProfession = (prof: string, targetType: 'standard' | 'musicproducer' = 'standard') => {
    if (prof === 'admin') return 'photographer';
    if (targetType === 'musicproducer') {
      if (prof === 'music_producer') return 'musicproducer';
      return prof as 'photographer' | 'videographer' | 'vendor' | 'musicproducer';
    }
    if (prof === 'music_producer') return 'music_producer';
    return prof as 'photographer' | 'videographer' | 'music_producer' | 'vendor';
};
  
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession === 'admin,' ? 'photographer,' : profession);
  
  // External Data Service integration for location intelligence and weather data
  const { 
    getCurrentWeather,
    getWeatherForecast,
    getSSBEconomicIndicators,
    getSSBPopulationData,
    getKartverketAddress,
    searchKartverketPlaceNames
} = useExternalData();

  // Comprehensive Feature System for Universal Dashboard
  const universalDashboardAccess = features.checkFeatureAccess('universal-dashboard, ');
  const projectsTabAccess = features.checkFeatureAccess('dashboard-projects');
  const clientsTabAccess = features.checkFeatureAccess('dashboard-clients');
  const equipmentTabAccess = features.checkFeatureAccess('dashboard-equipment');
  const showcaseTabAccess = features.checkFeatureAccess('dashboard-showcase');
  const businessIntelligenceAccess = features.checkFeatureAccess('business-intelligence');
  const settingsTabAccess = features.checkFeatureAccess('dashboard-settings');
  const timelineTabAccess = features.checkFeatureAccess('dashboard-timeline');
  
  // Profession-specific features
  const photoEnhancementAccess = features.checkFeatureAccess('photo-enhancement-suite');
  const videoEnhancementAccess = features.checkFeatureAccess('video-enhancement-suite');
  const audioEnhancementAccess = features.checkFeatureAccess('audio-enhancement-suite');
  const storyArcAccess = features.checkFeatureAccess('story-arc-studio');
  
  // Universal dashboard context
  const {
    state: universalState,
    setProjects,
    addProject,
    updateProject,
    deleteProject,
    setSelectedProject: setUniversalSelectedProject,
    setClients,
    addClient,
    updateClient,
    deleteClient,
    setSelectedClient: setUniversalSelectedClient,
    setEquipment,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    setSelectedEquipment,
    setNotifications,
    addNotification,
    updateNotification,
    deleteNotification,
    updateTabState,
    updateModalState,
    updateSettings,
    setLoading,
    setError,
    broadcastChange,
    requestData,
    syncWithComponent
} = useUniversalDashboard();
  
  // Register this component in the integration system
  useEffect(() => {
    communication.registerComponent('universal-dashboard','dashboard', [
      'data:read','data:write','event:emit','event:listen','ui:update','project:manage','client:manage','equipment:manage','notification:manage','settings:manage'
    ]);

    // Track feature usage
    features.trackFeatureUsage('universal-dashboard, ','opened', {
      timestamp: Date.now(),
      profession: profession,
      component: 'UniversalDashboard',
      tabValue: tabValue,
      availableTabs: availableTabs.length,
      accessibleFeatures: {
        projects: projectsTabAccess.hasAccess,
        clients: clientsTabAccess.hasAccess,
        equipment: equipmentTabAccess.hasAccess,
        showcase: showcaseTabAccess.hasAccess,
        settings: settingsTabAccess.hasAccess,
        timeline: timelineTabAccess.hasAccess
      }
});

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:selectedProject',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:selectedClient',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:projects',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
});

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-dashboard',
      dataKey: 'universal-dashboard:clients',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
});

    return () => {
      communication.unregisterComponent('universal-dashboard');
    };
}, [communication, dataFlow]);

  // Listen to global events and update accordingly
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        setSelectedProject(message.data);
        setUniversalSelectedProject(message.data);
      }
      if (message.type === 'client: selected' && message.data) {
        setSelectedClient(message.data);
        setUniversalSelectedClient(message.data);
      }
      if (message.type === 'navigate:wedding-timeline') {
        // Optionally set a temp project context from message
        if (message.data?.projectName || message.data?.clientEmail) {
          const tempProject = {
            id: `tmp-${Date.now()}`,
            name: message.data.projectName || undefined,
            clientName: message.data.clientEmail ? undefined : undefined,
            status: 'planning',
            description: 'Generated from navigation event'
          } as any;
          setSelectedProject(tempProject);
          setUniversalSelectedProject(tempProject);
        }
        // Store prefill for WeddingTimelineAdmin consumers
        try {
          updateSettings('weddingTimelinePrefill', message.data);
          dataFlow.syncData('wedding-timeline:prefill', message.data);
        } catch {}
        const idx = availableTabs.findIndex((t) => t.id === 'wedding-timeline');
        if (idx >= 0) setTabValue(idx);
      }
      if (message.type === 'navigate:event-timeline') {
        // Store prefill and open dialog
        setEventTimelinePrefill(message.data);
        setShowEventTimelineDialog(true);
      }
      if (message.type === 'data: sync' && message.data.dataKey === 'universal-dashboard:selectedProject') {
        setSelectedProject(message.data.data);
        setUniversalSelectedProject(message.data.data);
      }
      if (message.type === 'data: sync' && message.data.dataKey === 'universal-dashboard:projects') {
        setProjects(message.data.data);
      }
      if (message.type === 'data: sync' && message.data.dataKey === 'universal-dashboard:clients') {
        setClients(message.data.data);
      }
      if (message.type === 'data:sync' && message.data.dataKey === 'universal-dashboard:split-sheets') {
        // Split sheet data synced from SplitSheetManager
        // Data is already in context, just trigger re-render if needed
      }
      if (message.type === 'data:sync' && message.data.dataKey === 'universal-dashboard:selectedSplitSheet') {
        // Navigate to split sheets tab when a split sheet is selected from overview
        const splitSheetTabIndex = availableTabs.findIndex(tab => tab.id === 'split-sheets');
        if (splitSheetTabIndex >= 0) setTabValue(splitSheetTabIndex);
      }
    });

    return unsubscribe;
  }, [communication, setUniversalSelectedProject, setUniversalSelectedClient, setProjects, setClients, availableTabs]);
  
  // Grouped UI State - Reduced hooks from 18+ to 4 for better performance
  const [tabState, setTabState] = useState({
    main: 0,
    settings: 0,
    timeline: 0 });
  
  const [modalState, setModalState] = useState({
    showProjectModal: false,
    showQuickNotesModal: false,
    showProjectCreation: false,
    showVendorProductDialog: false,
    showEmailCenter: false,
    showEmailDesigner: false,
    showChat: false,
    showNotifications: false,
    showPrototypeFeedback: false,
    showCrmDialog: false,
    showFAQDialog: false,
    showProjectDetailsModal: false,
    showEditProjectModal: false,
    showDeleteProjectDialog: false
});
  
  const [selectedItems, setSelectedItems] = useState<{
    project: Project | null;
    client: Client | null;
    equipment: Equipment | null;
    emailContext: EmailContext | null;
}>({
    project: null,
    client: null, 
    equipment: null,
    emailContext: null
});
  
  // Location Intelligence State
  const [locationIntelligence, setLocationIntelligence] = useState({
    weatherData: null as any,
    weatherForecast: null as any,
    economicData: null as any,
    populationData: null as any,
    userLocation: null as any,
    loading: false
});

  // Mentor status check
  const [isMentor, setIsMentor] = useState(false);

  useEffect(() => {
    const checkMentorStatus = async () => {
      if (!userId || userId === 'guest') return;
      try {
        const response = await apiRequest(`/api/community/user/${userId}/roles`);
        const roles = response.roles || [];
        const mentorRole = roles.some((role: any) => role.name === 'Mentor');
        setIsMentor(mentorRole);
      } catch (error) {
        console.error('Error checking mentor status: ', error);
      }
    };
    checkMentorStatus();
  }, [userId]);

  // Listen for navigation events from Community
  useEffect(() => {
    const handleNavigateToAcademy = () => {
      // Find the academy tab index
      const academyTabIndex = availableTabs.findIndex(tab => tab.id === 'academy');
      if (academyTabIndex !== -1) {
        setTabValue(academyTabIndex);
      }
    };

    window.addEventListener('navigate-to-academy', handleNavigateToAcademy);
    return () => {
      window.removeEventListener('navigate-to-academy', handleNavigateToAcademy);
    };
  }, [availableTabs]);

  const [uiSettings, setUiSettings] = useState({
    proEditorMode: false,
    availableDashboards: [] as string[],
    submissionProjectData: null as any // Pre-filled data from submission
  });

  // Helper functions for grouped state management
  const updateTabStateLocal = (key: keyof typeof tabState, value: number) => {
    setTabState(prev => ({ ...prev, [key]: value }));
    updateTabState(key, value); // Also update context
};

  const updateModalStateLocal = (key: keyof typeof modalState, value: boolean) => {
    setModalState(prev => ({ ...prev, [key]: value }));
    updateModalState(key, value); // Also update context
};

  const updateSelectedItems = (key: keyof typeof selectedItems, value: Project | Client | Equipment | EmailContext | null) => {
    setSelectedItems(prev => ({ ...prev, [key]: value }));
};

  const updateUiSettings = (key: keyof typeof uiSettings, value: boolean | string[]) => {
    setUiSettings(prev => ({ ...prev, [key]: value }));
};

  // Aliases for backward compatibility during refactoring
  const tabValue = tabState.main;

  // Event Timeline dialog state
  const [showEventTimelineDialog, setShowEventTimelineDialog] = useState(false);
  const [eventTimelinePrefill, setEventTimelinePrefill] = useState<any | null>(null);
  const setTabValue = (value: number) => updateTabStateLocal('main', value);
  const settingsTabValue = tabState.settings;
  const setSettingsTabValue = (value: number) => updateTabStateLocal('settings', value);
  const selectedTimelineTab = tabState.timeline;
  const setSelectedTimelineTab = (value: number) => updateTabStateLocal('timeline', value);
  
  const selectedProject = selectedItems.project;
  const setSelectedProject = (value: Project | null) => {
    updateSelectedItems('project', value);
    setUniversalSelectedProject(value);
    
    // Broadcast project selection to all components
    if (value) {
      integration.emit('project:selected', { project: value, source: 'universal-dashboard' });
      communication.sendMessage({
        from: 'universal-dashboard',
        to: 'all',
        type: 'project:selected',
        data: value,
        priority: 'medium'
  });
      dataFlow.syncData('universal-dashboard:selectedProject', value);
    }
  
};
  
  const selectedClient = selectedItems.client;
  const setSelectedClient = (value: Client | null) => {
    updateSelectedItems('client', value);
    setUniversalSelectedClient(value);
    
    // Broadcast client selection to all components
    if (value) {
      integration.emit('client:selected', { client: value, source: 'universal-dashboard' });
      communication.sendMessage({
        from: 'universal-dashboard',
        to: 'all',
        type: 'client:selected',
        data: value,
        priority: 'medium'
      });
      dataFlow.syncData('universal-dashboard:selectedClient', value);
    
    // Listen for split sheet data sync
    dataFlow.onDataSync?.('universal-dashboard:split-sheets', (data: any) => {
      // Split sheet data updated - overview will automatically reflect changes
    });
    }
  
};
  const emailProjectContext = selectedItems.emailContext;
  const setEmailProjectContext = (value: EmailContext | null) => updateSelectedItems('emailContext', value);
  const selectedEquipment = selectedItems.equipment;
  const setSelectedEquipmentLocal = (value: Equipment | null) => updateSelectedItems('equipment', value);
  
  const proEditorMode = uiSettings.proEditorMode;
  const setProEditorMode = (value: boolean) => updateUiSettings('proEditorMode', value);
  
  // Modal shortcuts
  const showProjectModal = modalState.showProjectModal;
  const setShowProjectModal = (value: boolean) => updateModalStateLocal('showProjectModal', value);
  const showProjectCreation = modalState.showProjectCreation;
  const setShowProjectCreation = (value: boolean) => updateModalStateLocal('showProjectCreation', value);
  const showEmailDesigner = modalState.showEmailDesigner;
  const setShowEmailDesigner = (value: boolean) => updateModalStateLocal('showEmailDesigner', value);
  const showNotifications = modalState.showNotifications;
  const setShowNotifications = (value: boolean) => updateModalStateLocal('showNotifications', value);
  const showFAQDialog = modalState.showFAQDialog;
  const setShowFAQDialog = (value: boolean) => updateModalStateLocal('showFAQDialog', value);
  const showQuickNotesModal = modalState.showQuickNotesModal;
  const setShowQuickNotesModal = (value: boolean) => updateModalStateLocal('showQuickNotesModal', value);
  const showVendorProductDialog = modalState.showVendorProductDialog;
  const setShowVendorProductDialog = (value: boolean) => updateModalStateLocal('showVendorProductDialog', value);
  const showEmailCenter = modalState.showEmailCenter;
  const setShowEmailCenter = (value: boolean) => updateModalStateLocal('showEmailCenter', value);
  const showChat = modalState.showChat;
  const setShowChat = (value: boolean) => updateModalStateLocal('showChat', value);
  const showPrototypeFeedback = modalState.showPrototypeFeedback;
  const setShowPrototypeFeedback = (value: boolean) => updateModalStateLocal('showPrototypeFeedback', value);
  const showCrmDialog = modalState.showCrmDialog;
  const setShowCrmDialog = (value: boolean) => updateModalStateLocal('showCrmDialog', value);
  const showProjectDetailsModal = modalState.showProjectDetailsModal;
  const setShowProjectDetailsModal = (value: boolean) => updateModalStateLocal('showProjectDetailsModal', value);
  const showEditProjectModal = modalState.showEditProjectModal;
  const setShowEditProjectModal = (value: boolean) => updateModalStateLocal('showEditProjectModal', value);
  const showDeleteProjectDialog = modalState.showDeleteProjectDialog;
  const setShowDeleteProjectDialog = (value: boolean) => updateModalStateLocal('showDeleteProjectDialog', value);

  // Theme and Responsive
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Universal Demo Mode Integration
  const { isDemoMode, isLoading: demoModeLoading } = useDemoMode();

  // Message handler for navigation from child components (like project creation)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'navigate') {
        const { tab, subTab } = event.data;
        
        if (tab === 'settings') {
          // Find the settings tab index
          const settingsTabIndex = 5; // Settings is typically the last tab
          setTabValue(settingsTabIndex);
            
          // If subTab is specified, set the appropriate sub-tab
          if (subTab === 'pricing') {
            // Set pricing as active subtab in settings
            setSettingsTabValue(2); // Assuming pricing is at index 2 in settings
      }
    }
  }
};

    // Use modern event handling pattern
    document.addEventListener('custom-navigation', handleMessage as EventListener);
    return () => document.removeEventListener('custom-navigation', handleMessage as EventListener);
}, [profession]);

  // Location Intelligence Data Fetching
  const fetchLocationIntelligence = useCallback(async () => {
    setLocationIntelligence(prev => ({ ...prev, loading: true }));
    
    try {
      // Get user's location (default to Oslo if not available)
      const userLocation = { lat: 59.9139, lng: 10.7522 }; // Oslo coordinates
      
      // Fetch current weather
      const weatherData = await getCurrentWeather({ 
        lat: userLocation.lat, 
        lon: userLocation.lng 
  });
      
      // Fetch weather forecast
      const weatherForecast = await getWeatherForecast({ 
        lat: userLocation.lat, 
        lon: userLocation.lng,
        days: 5 });
      
      // Fetch economic indicators
      const economicData = await getSSBEconomicIndicators();
      
      // Fetch population data
      const populationData = await getSSBPopulationData({ region: 'Oslo' });
      
      setLocationIntelligence({
        weatherData,
        weatherForecast,
        economicData,
        populationData,
        userLocation,
        loading: false
  });
      
} catch (error) {
      console.warn('Failed to fetch location intelligence data:', error);
      setLocationIntelligence(prev => ({ ...prev, loading: false }));
}
}, [getCurrentWeather, getWeatherForecast, getSSBEconomicIndicators, getSSBPopulationData]);

  // Fetch location intelligence data on component mount
  useEffect(() => {
    fetchLocationIntelligence();
}, [fetchLocationIntelligence]);

  // Project management functions
  const handleEditProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setShowEditProjectModal(true);
}, []);

  const handleDeleteProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setShowDeleteProjectDialog(true);
}, []);

  const handleViewProjectDetails = useCallback((project: Project) => {
    setSelectedProject(project);
    setShowProjectDetailsModal(true);
}, []);

  // Handler to open project overview
  const handleOpenProjectOverview = useCallback((project: any, projectType: 'story-arc' | 'photo' | 'audio' | 'timeline') => {
    setSelectedProjectForOverview({
      ...project,
      projectType,
    });
    setProjectOverviewOpen(true);
  }, []);

  // Handler to open in fullscreen editor
  const handleOpenInEditor = useCallback(() => {
    if (!selectedProjectForOverview) return;
    
    const { projectType, ...project } = selectedProjectForOverview;
    
    // Set selected project
    setSelectedProject({
      id: project.id,
      name: project.storyArcName || project.name || project.title || project.filename,
      type: projectType,
      ...project
    } as Project);
    
    // Close overview dialog
    setProjectOverviewOpen(false);
    
    // Navigate based on project type
    switch (projectType) {
      case 'story-arc':
        // Enable Pro Editor Mode for fullscreen Story Arc Studio
        if (profession === 'videographer') {
          setProEditorMode(true);
          setTabValue(0); // Stay on overview but show fullscreen editor
        }
        break;
      case 'photo':
        setTabValue(8); // Photo Enhancement Suite tab
        break;
      case 'audio':
        const audioTabIndex = config.tabs.findIndex(tab => tab.id === 'audio');
        if (audioTabIndex >= 0) setTabValue(audioTabIndex);
        break;
      case 'timeline':
        const timelineTabIndex = config.tabs.findIndex(tab => tab.id === 'projects' || tab.id === 'timeline');
        if (timelineTabIndex >= 0) setTabValue(timelineTabIndex);
        break;
    }
  }, [selectedProjectForOverview, setSelectedProject, profession, setProEditorMode, setTabValue, config.tabs]);

  // Handler to open in new browser tab
  const handleOpenInNewTab = useCallback(() => {
    if (!selectedProjectForOverview) return;
    
    const { projectType, id } = selectedProjectForOverview;
    
    // Construct URL based on project type
    let url = '';
    switch (projectType) {
      case 'story-arc':
        url = `/story-arc/${id}`;
        break;
      case 'photo':
        url = `/photo-enhancement/${id}`;
        break;
      case 'audio':
        url = `/audio-enhancement/${id}`;
        break;
      case 'timeline':
        url = `/project-timeline/${id}`;
        break;
    }
    
    // Open in new tab
    window.open(url, '_blank','noopener,noreferrer');
    setProjectOverviewOpen(false);
  }, [selectedProjectForOverview]);

  const confirmDeleteProject = useCallback(async () => {
    if (!selectedProject) return;
    
    try {
      await apiRequest(`/api/projects/${selectedProject.id}`, {
        method: 'DELETE'
      });
      
      // Refresh projects data with React Query
      await queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    } catch (error) {
      console.error('Feil ved sletting av prosjekt:', error);
      // TODO: Vis brukervennlig feilmelding
    } finally {
      setShowDeleteProjectDialog(false);
      setSelectedProject(null);
    }
}, [selectedProject]);

  // Get base config from useProfessionConfigs (for tabs, stats, project types)
  const baseConfig = professionConfigs[profession] || professionConfigs.photographer || localProfessionConfigs.photographer;
  
  // Enhance with dynamic profession branding (auto-scalable)
  // This makes UniversalDashboard auto-scalable - new professions added via ProfessionTypeManager will automatically work
  const config = useMemo(() => {
    const displayName = getProfessionDisplayName(profession);
    const professionColor = getUserProfessionColor(profession);
    const professionIcon = getProfessionIcon(profession);
    
    return {
      ...baseConfig,
      // Override with dynamic data if available (for auto-scalability)
      name: displayName || baseConfig.name,
      color: professionColor || baseConfig.color,
      icon: professionIcon || baseConfig.icon,
    };
  }, [profession, baseConfig, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon]);

  // Fetch user session (public, minimal info)
  const { data: userSession } = useQuery({
    queryKey: ['/api/auth/public-session'],
    queryFn: () => apiRequest('/api/auth/public-session'),
    retry: false,
  });

  // Derive user identifiers from session and unified auth
  const userId = userSession?.userId || currentUser?.id || 'guest';
  const userEmail = userSession?.email || currentUser?.email;

  // Check admin permissions for the resolved user email
  const { data: adminPermissions } = useQuery({
    queryKey: ['/api/admin/permissions', userEmail],
    queryFn: () => apiRequest(`/api/admin/permissions?email=${userEmail}`),
    enabled: !!userEmail,
  });

  // Check if user is admin and has access to all dashboards
  const isAdmin = !!(adminPermissions?.fullAccess || currentUser?.role === 'admin');

  // Get stats data from config
  const stats = config?.stats || [];
  
  /**
   * DYNAMIC TAB FILTERING SYSTEM
   * ============================
   * Uses useFeatureAccess to dynamically filter dashboard tabs based on:
   * - Feature availability (from PROFESSION_FEATURE_MATRIX)
   * - User permissions and plan level
   * - Profession-specific capabilities
   * - Admin access levels
   * 
   * This ensures users only see tabs they have access to, improving UX
   * and preventing confusion from locked features.
   * 
   * Tab visibility is tracked and analytics are captured for all tab interactions.
   */
  const availableTabs = useMemo(() => {
    const tabs = config.tabs.filter(tab => {
      // Map tab IDs to feature checks
      const featureMap: Record<string, boolean> = {
        'overview': true, // Always available
        'projects': projectsTabAccess.hasAccess,
        'community': profession !== 'vendor', // Community for all except vendors
        'academy': isMentor, // Academy only for mentors/instructors
        'contracts': true, // Universal contract system
        'split-sheets': profession === 'music_producer', // Split sheets for music producers
        'wedding-timeline': timelineTabAccess.hasAccess,
        'showcase-admin': showcaseTabAccess.hasAccess,
        'showcase-viewer': showcaseTabAccess.hasAccess,
        'downloads': true,
        'file-upload': true,
        'ai-enhancement':
          photoEnhancementAccess.hasAccess ||
          videoEnhancementAccess.hasAccess ||
          audioEnhancementAccess.hasAccess,
        'photo-enhancement': photoEnhancementAccess.hasAccess,
        'email-center': true,
        'worklog': true,
        'clients': clientsTabAccess.hasAccess,
        'client-management': clientsTabAccess.hasAccess,
        'equipment': equipmentTabAccess.hasAccess,
        'files': true,
        'support': true,
        'settings': settingsTabAccess.hasAccess,
        'communication': true,
        'integration-test': isAdmin // Only for admins
      };

      return featureMap[tab.id] !== false;
    });
    
    // Track filtered tabs for analytics
    const filteredTabIds = config.tabs
      .filter(tab => !tabs.find(t => t.id === tab.id))
      .map(tab => tab.id);
    
    if (filteredTabIds.length > 0) {
      features.trackFeatureUsage('dashboard-tabs-filtered','info', {
        filteredTabs: filteredTabIds,
        availableCount: tabs.length,
        totalCount: config.tabs.length
      });
    }
    
    return tabs;
  }, [config.tabs, projectsTabAccess.hasAccess, clientsTabAccess.hasAccess, equipmentTabAccess.hasAccess,
      showcaseTabAccess.hasAccess, settingsTabAccess.hasAccess, timelineTabAccess.hasAccess,
      photoEnhancementAccess.hasAccess, videoEnhancementAccess.hasAccess, audioEnhancementAccess.hasAccess,
      profession, isAdmin, isMentor]);

  // Fetch onboarding profile for branding customization
  const { data: onboardingProfile } = useQuery({
    queryKey: ['/api/onboarding/profile', userId],
    queryFn: () => apiRequest(`/api/onboarding/profile/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch business branding settings for real-time updates
  const { data: brandingData } = useQuery({
    queryKey: ['/api/branding/business-info', userId],
    enabled: !!userId && userId !== 'guest'
});

  // Admin Dashboard Switcher for user?.id || user?.email || "unknown-user"
  const renderAdminDashboardSwitcher = () => {
    if (!isAdmin) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <MuiCard sx={sharedStyles.cardGradient}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
            🔧 Admin Dashboard Tilgang
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {Object.entries(professionConfigs).map(([key, baseConfig]) => {
              // Get dynamic branding for this profession (auto-scalable)
              const displayName = getProfessionDisplayName(key);
              const professionColor = getUserProfessionColor(key);
              const professionIcon = getProfessionIcon(key);
              
              // Merge base config with dynamic branding
              const enhancedConfig = {
                ...baseConfig,
                name: displayName || baseConfig.name,
                color: professionColor || baseConfig.color,
                icon: professionIcon || baseConfig.icon,
              };
              
              return (
                <Button
                  key={key}
                  variant={profession === key ? "contained" : "outlined"}
                  startIcon={enhancedConfig.icon}
                  onClick={() => {
                    trackButtonClick('profession_change', { 
                      from_profession: profession, 
                      to_profession: key,
                      dashboard: 'universal', 
                      component: 'profession_selector'
                    });
                    setLocation(`/?profession=${key}`);
                  }}
                  sx={{
                    bgcolor: profession === key ? 'rgba(25,255,255,0.9)' : 'transparent',
                    color: profession === key ? enhancedConfig.color : 'white',
                    borderColor: 'rgba(25,255,255,0.5)', '&:hover': {
                      bgcolor: 'rgba(25,255,255,0.1)',
                      borderColor: 'rgba(25,255,255,0.8)'
                          }
                      }}
                >
                  {enhancedConfig.name}
                </Button>
              );
            })}
          </Box>
          <Typography variant="body2" sx={{ mt: 2, opacity: 0.9 }}>
            Som administrator har du tilgang til alle dashboards med samme mappestruktur og funksjonalitet.
          </Typography>
        </MuiCard>
      </Box>
    );
};
  
  // Apply custom branding from both onboarding profile and business branding settings
  const customBranding = useMemo(() => {
    // Merge data from branding settings (priority) and onboarding profile (fallback)
    const brandingInfo = brandingData || {};
    const onboardingInfo = onboardingProfile || {};
    
    return {
      color: (brandingInfo as any).brandingColor || (onboardingInfo as any).brandingColor || config?.color || '#ff8c00' || '#f57c00',
      businessName: (brandingInfo as any).businessName || (onboardingInfo as any).businessName || config?.name || 'CreatorHub',
      tagline: (brandingInfo as any).tagline || (onboardingInfo as any).tagline || null,
      profilePhoto: (onboardingInfo as any).profilePhoto || null,
      customLogo: (brandingInfo as any).customLogo || (onboardingInfo as any).customLogo || null
    };
}, [onboardingProfile, brandingData, config]);

  // Fetch vendor profile to get vendorType (for vendors only)
  const { data: vendorProfile } = useQuery({
    queryKey: ['/api/vendor-onboarding/profile', userId],
    queryFn: () => apiRequest(`/api/vendor-onboarding/profile/${userId}`),
    enabled: !!userId && userId !== 'guest' && profession === 'vendor'
  });

  // Get the user's vendor type from their profile, default to 'print'
  const userVendorType = vendorProfile?.vendorType || 'print';

  // Fetch dashboard data based on profession
  const { data: dashboardData = {} } = useQuery({
    queryKey: [`/api/dashboard/${profession}`, userId],
    queryFn: () => apiRequest(`/api/dashboard/${profession}/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch real projects from database
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects', { profession, userId }],
    queryFn: () => apiRequest(`/api/projects?profession=${profession}&userId=${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch real meeting notes stats
  const { data: meetingStats } = useQuery({
    queryKey: ['/api/smart-meeting-notes/stats', profession, userId],
    queryFn: () => apiRequest(`/api/smart-meeting-notes/stats/${profession}/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch recent meeting notes
  const { data: recentMeetingNotes = [] } = useQuery({
    queryKey: ['/api/smart-meeting-notes/recent', userId],
    queryFn: () => apiRequest(`/api/smart-meeting-notes/recent/${userId}?limit=3`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch unread email count for email icon
  const { data: unreadEmailData } = useQuery({
    queryKey: ['/api/emails/unread-count', userId],
    queryFn: () => apiRequest(`/api/emails/unread-count/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch recent notifications for notification center
  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['/api/notifications/recent', userId],
    queryFn: () => apiRequest(`/api/notifications/recent/${userId}?limit=10`),
    enabled: !!userId && userId !== 'guest'
  });

  // Fetch client activity summary for dashboard badges
  const { data: clientActivitySummary } = useQuery({
    queryKey: ['/api/client-activity/summary', userId],
    queryFn: () => apiRequest(`/api/client-activity/summary?userId=${userId}`),
    enabled: !!userId && userId !== 'guest',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const unreadEmailCount = unreadEmailData?.count || 0;
  const urgentDeadlines = clientActivitySummary?.urgentDeadlines || 0;
  const unreadComments = clientActivitySummary?.unreadComments || 0;
  const recentDownloads = clientActivitySummary?.recentDownloads || 0;
  const pendingSubmissions = clientActivitySummary?.pendingSubmissions || 0;
  const pendingTimelineChanges = clientActivitySummary?.pendingTimelineChanges || 0;
  const totalClientActivity = urgentDeadlines + unreadComments + recentDownloads + pendingSubmissions + pendingTimelineChanges;

  // Fetch upcoming projects data - moved to top level to fix hook order
  // Story Arc Projects
  const { data: storyArcProjectsData, isLoading: loadingStoryArc } = useQuery({
    queryKey: ['story-arc-projects', userId],
    queryFn: async () => {
      const res = await fetch('/api/story-arc/projects', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.success ? data.projects.slice(0, 5) : [];
      }
      return [];
    },
    enabled: !!userId && profession === 'videographer',
  });

  // Photo/Wedding Projects
  const { data: allPhotoProjects, isLoading: loadingPhoto } = useQuery({
    queryKey: ['all-wedding-projects', userId],
    queryFn: async () => {
      const res = await fetch('/api/wedding-projects', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.success ? data.projects.slice(0, 5) : [];
      }
      return [];
    },
    enabled: !!userId && (profession === 'photographer' || profession === 'admin'),
  });

  // Audio Projects (use jobs as projects)
  const { data: audioProjectsData, isLoading: loadingAudio } = useQuery({
    queryKey: ['audio-enhancement-jobs', userId],
    queryFn: async () => {
      const res = await fetch('/api/audio-enhancement/jobs', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        return data.jobs?.slice(0, 5) || [];
      }
      return [];
    },
    enabled: !!userId && profession !== 'vendor',
  });

  const { data: upcomingProjects = [], isLoading: upcomingLoading } = useQuery({
    queryKey: ['/api/dashboard/upcoming-projects', userId],
    queryFn: () => apiRequest('/api/dashboard/upcoming-projects'),
    enabled: !!userId && userId !== 'guest',
    staleTime: 3000,
  });

  // Split Sheets data for music_producer overview
  const { data: splitSheetsData } = useQuery({
    queryKey: ['split-sheets-overview', userId],
    queryFn: async () => {
      const response = await apiRequest('/api/split-sheets?limit=10');
      return response;
    },
    enabled: !!userId && profession !== 'vendor',
    staleTime: 5000,
  });

  const splitSheets = splitSheetsData?.data || [];
  const splitSheetStats = useMemo(() => {
    const total = splitSheets.length;
    const draft = splitSheets.filter((ss: any) => ss.status === 'draft').length;
    const pending = splitSheets.filter((ss: any) => ss.status === 'pending_signatures').length;
    const completed = splitSheets.filter((ss: any) => ss.status === 'completed').length;
    return { total, draft, pending, completed };
  }, [splitSheets]);

  // Calculate real stats from database data
  // Mock data removed - using database connection

  /**
   * Check if profession supports specific features
   * Connected to profession-feature-matrix.ts for centralized feature management
   */
  const professionSupports = (feature: string) => {
    // Use enhanced config (includes dynamic branding)
    if (!config) return false;

    // Check centralized feature matrix first
    const matrixResult = isProfessionFeatureAvailable(profession, feature);
    if (matrixResult) {
      return true;
    }

    // Fallback to local feature mapping for features not in matrix
    const featureMap: Record<string, string[]> = {
      wedding_timeline: ['photographer'], // Only photographers have wedding timeline
      camera_projects: ['photographer','videographer'], // Photo/video projects
      vendor_products: ['vendor'], // Vendor-specific products
      music_projects: ['music_producer'] // Music production
    };

    return featureMap[feature]?.includes(profession) || false;
  };

  // Get dynamic project creation text
  const getProjectCreationText = (isShort = false) => {
    // Use enhanced config (includes dynamic branding)
    if (!config) return isShort ? 'Nytt' : 'Nytt Prosjekt';

    if (isShort) return 'Nytt';

    const projectTypes: Record<string, string> = {
      photographer: 'Nytt Fotografiprosjekt',
      videographer: 'Nytt Videoprosjekt',
      music_producer: 'Nytt Musikkprosjekt',
      vendor: 'Nytt Produkt'
    };
    
    return projectTypes[profession] || 'Nytt Prosjekt';
};

  // Calculate tab mapping based on profession
  const getTabMapping = (tabIndex: number) => {
    if (professionSupports('wedding_timeline')) {
      // For photographers, wedding-timeline is at index 2, so adjust later tabs
      return tabIndex;
    } else {
      // For other professions, skip the wedding-timeline tab
      if (tabIndex >= 2) return tabIndex - 1; // Adjust for missing wedding-timeline
      return tabIndex;
    }
};

  // Academy navigation state
  const [showAcademy, setShowAcademy] = useState(false);
  // Showcase navigation state
  const [showShowcase, setShowShowcase] = useState(false);
  
  // Project overview dialog state
  const [selectedProjectForOverview, setSelectedProjectForOverview] = useState<any | null>(null);
  const [projectOverviewOpen, setProjectOverviewOpen] = useState(false);

  const handleTabChange = useCallback((event: React.SyntheticEvent | null, newValue: number) => {
    setTabValue(newValue);
}, []);

  // Optimized event handlers
  const handleProEditorModeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setProEditorMode(e.target.checked);
}, []);

  const handleTimelineTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setSelectedTimelineTab(newValue);
}, []);

  const handleSettingsTabChange = useCallback((e: React.SyntheticEvent, newValue: number) => {
    setSettingsTabValue(newValue);
}, []);

  const handleShowFAQDialog = useCallback(() => {
    setShowFAQDialog(true);
}, []);

  // Optimized shared styles - memoized for performance  
  const sharedStyles = useMemo(() => ({
    cardGradient: {
      background: `linear-gradient(135deg, ${customBranding.color} 0%, ${customBranding.color}CC 100%)`,
      color: 'white',
      borderRadius: 3,
      p: 2
    },
    primaryButton: {
      background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`, '&:hover': {
        transform: 'translateY(-2px)',
        bgcolor: customBranding.color
      },
      borderRadius: 2,
      fontWeight: 60
    },
    dialogPaper: {
      borderRadius: 3,
      bgcolor: 'background.default',
      backgroundImage: 'none',
      border: `2px solid ${customBranding.color}40`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
    },
    responsivePadding: {
      p: { xs: 1, sm: 2, md: 3 }
    },
    centerFlex: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    brandedText: {
      color: customBranding.color,
      fontWeight: 60
    }
  }), [customBranding.color, theme.palette.primary.dark]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, ${customBranding.color} 100%),
          radial-gradient(circle at 20% 80%, ${customBranding.color}30 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, ${customBranding.color}25 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, ${customBranding.color}20 0%, transparent 50%)
        `,
        py: { xs: 2, sm: 3, md: 4 },
        px: { xs: 1, sm: 2 },
        // WCAG AA Compliance: Motion and contrast preferences
        '@media (prefers-reduced-motion: reduce)': {
          background: '#fff5e6'
        }, '@media (prefers-contrast: high)': {
          background: '#ffffff',
          border: '2px solid #000000'
        }
      }}
      // WCAG: Root container semantics
      component="div"
      role="application"
      aria-label="CreatorHub Norge Dashboard"
    >
      <Container 
        maxWidth="xl"
        sx={{
          px: { xs: 1, sm: 2, md: 3 }
        }}
        // WCAG: Main content landmark
        component="main"
        role="main"
        aria-label="Dashboard hovedinnhold"
      >
        {/* Admin Indicator - only shown when admin is logged in */}
        {isAdmin && (
          <AdminIndicator 
            userEmail={userEmail}
            profession={profession}
            variant="full"
          />
        )}

        {/* Admin Dashboard Switcher */}
        {renderAdminDashboardSwitcher()}

        {/* Project Creation Dialog (Submission → Project) */}
        <Dialog open={showProjectCreation} onClose={() => setShowProjectCreation(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Opprett prosjekt fra innsending</DialogTitle>
          <DialogContent dividers>
            <ProjectCreationWithMemoryCards
              profession={getComponentProfession(profession)}
              initialData={{
                projectName: uiSettings.submissionProjectData?.projectName,
                clientName: uiSettings.submissionProjectData?.clientName,
                clientEmail: uiSettings.submissionProjectData?.clientEmail,
                clientPhone: uiSettings.submissionProjectData?.clientPhone,
                description: uiSettings.submissionProjectData?.description,
                projectType: uiSettings.submissionProjectData?.projectType,
                budget: uiSettings.submissionProjectData?.budget,
                eventDate: uiSettings.submissionProjectData?.eventDate,
                eventDates: uiSettings.submissionProjectData?.eventDates,
                location: uiSettings.submissionProjectData?.location,
                guestCount: uiSettings.submissionProjectData?.guestCount}}
              onProjectCreated={() => setShowProjectCreation(false)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowProjectCreation(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>

        {/* Header - WCAG Compliant */}
        {uiSettings.submissionProjectData && (
          <MuiCard sx={{ mb: 2 }}>
            <MuiCardContent>
              <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
                Ny innsending oppdaget
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {uiSettings.submissionProjectData.clientName} — {uiSettings.submissionProjectData.clientEmail}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    try {
                      const payload = {
                        name: uiSettings.submissionProjectData.clientName,
                        email: uiSettings.submissionProjectData.clientEmail,
                        phone: uiSettings.submissionProjectData.clientPhone || '',
                        company: uiSettings.submissionProjectData.company || '',
                        status: 'lead',
                        notes: uiSettings.submissionProjectData.description || ''
                      };
                      const res = await fetch('/api/universal-crm/customers', {
                        method: 'POST',
                        headers: { 'Content-Type' : 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      if (!res.ok) throw new Error('CRM create failed');
                      const created = await res.json();
                      // Broadcast so listeners (CRM) can react/sync
                      communication.sendBroadcast('customer:updated', created);
                      // Ensure Google Contacts has this contact
                      if (payload.email) {
                        const searchRes = await fetch(`/api/google/people/search-contacts?q=${encodeURIComponent(payload.email)}`);
                        let foundId: string | null = null;
                        if (searchRes.ok) {
                          const contacts = await searchRes.json();
                          const found = contacts.find((c: any) => c.email?.toLowerCase() === payload.email.toLowerCase());
                          if (found?.id) foundId = found.id;
                        }
                        if (!foundId) {
                          const [firstName, ...rest] = (payload.name || payload.email).split(' ');
                          const lastName = rest.join('');
                          await fetch('/api/google/people/create-contact', {
                            method: 'POST',
                            headers: { 'Content-Type' : 'application/json' },
                            body: JSON.stringify({ firstName, lastName: lastName || '-', email: payload.email, phone: payload.phone, companyName: payload.company, profession: profession, notes: 'Created from Universal Dashboard submission' })
                          });
                        }
                      }
                    } catch (e) {
                      console.warn('Add to CRM failed:', e);
                    }
                  }}
                >
                  Legg til i CRM
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowProjectCreation(true)}
                >
                  Opprett prosjekt fra innsending
                </Button>
              </Stack>
            </MuiCardContent>
          </MuiCard>
        )}

        {/* Event Timeline Dialog */}
        <Dialog open={showEventTimelineDialog} onClose={() => setShowEventTimelineDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Event Timeline</DialogTitle>
          <DialogContent dividers>
            {selectedProject?.id ? (
              // Render the editor when we have a real project id
              <div>
                {/* EventTimelineEditor would be rendered here */}
                <Typography>Event Timeline Editor for project: {selectedProject.id}</Typography>
              </div>
            ) : (
              <Alert severity="info">
                Lagre/åpne prosjektet først for å redigere timeline. Forhåndsutfylling lagret.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowEventTimelineDialog(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>

        {/* Header - WCAG Compliant */}
        <Box 
          sx={{ mb: { xs: 2, md: 4 } }}
          component="header"
          role="banner"
          aria-label="Dashboard header"
        >
          <Box
            sx={{
              textAlign: 'center',
              mb: 1 }}
          >
            <img 
              src="/creatorhub-logo-amber.svg"
              alt="CreatorHub Norge Logo"
              style={{
                height: isSmallScreen ? '100px' : '150px',
                width: 'auto',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
              // WCAG: Accessible image
              role="img"
              aria-label="CreatorHub Norge hovedlogo"
            />
          </Box>

          {/* Navigation Buttons */}
          <Box sx={{ textAlign: 'center', mb: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained"
              startIcon={<AcademyIcon />}
              onClick={() => setShowAcademy(true)}
              sx={{ 
                bgcolor: '#ff8c00',
                color: 'white',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 3,
                boxShadow: '0 4px 15px rgba(2, 5, 5, 152, 0, 0.3)',
                '&:hover': { 
                  bgcolor: '#f57c00',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(2, 5, 5, 152, 0, 0.4)'
                }
              }}
            >
              GÅ TIL ACADEMY
            </Button>
            
            <Button variant="contained"
              startIcon={<Collections />}
              onClick={() => setShowShowcase(true)}
              sx={{ 
                bgcolor: '#ff8c00',
                color: 'white',
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 3,
                boxShadow: '0 4px 15px rgba(3, 150, 243, 0.3)',
                '&:hover': { 
                  bgcolor: '#ff8c00',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(3, 150, 243, 0.4)'
            }
          }}
            >
              GÅ TIL SHOWCASE
            </Button>
          </Box>
          
          {/* Welcome Card with Custom Branding - WCAG Compliant */}
          <MuiCard 
            sx={{ 
              mb: { xs: 2, md: 4 },
              background: 'rgba(25, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: `2px solid ${customBranding.color}40`,
              // WCAG: Focus management and high contrast
              '&:focus-within': {
                outline: `3px solid ${customBranding.color}`,
                outlineOffset: '2px'
              }, '@media (prefers-contrast: high)': {
                background: '#ffffff',
                border: `3px solid ${customBranding.color}`
              }
            }}
            // WCAG: Accessible card semantics
            component="section"
            role="region"
            aria-label="Velkomstsektor med brukerinformasjon"
          >
            <MuiCardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'center', sm: 'flex-start' },
                gap: 2,
                mb: 2 }}>
                <Avatar 
                  src={customBranding.profilePhoto}
                  sx={{ 
                    bgcolor: customBranding.color, 
                    width: { xs: 48, sm: 56 },
                    height: { xs: 48, sm: 56 },
                    border: `2px solid ${customBranding.color}`
                  }}
                >
                  {!customBranding.profilePhoto && config.icon}
                </Avatar>
                <Box sx={{ flexGrow: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'center', sm: 'flex-start' },
                    gap: { xs: 1, sm: 2 },
                    mb: 1 }}>
                    <Typography variant="h3" 
                      sx={{ 
                        fontWeight: 600, 
                        color: theming.colors.primary,
                        fontSize: { xs: '1.1rem', sm: '1.25rem' }
                      }}
                      // WCAG: Proper heading hierarchy
                      component="h3"
                      aria-label={`Velkommen tilbake, ${customBranding.businessName}`}
                    >
                      Velkommen tilbake, {customBranding.businessName}!
                    </Typography>
                    {customBranding.customLogo && (
                      <img 
                        src={customBranding.customLogo}
                        alt="Logo" 
                        style={{ 
                          maxWidth: 60, 
                          maxHeight: 30, 
                          objectFit: 'contain' 
                        }}
                      />
                    )}
                  </Box>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                  >
                    {customBranding.tagline || `Du har ${projects?.length || 0} aktive prosjekter og ${recentMeetingNotes?.length || 0} nye notater`}
                  </Typography>
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'row', sm: 'row' },
                  flexWrap: 'wrap',
                  gap: 1,
                  alignItems: 'center',
                  justifyContent: { xs: 'center', sm: 'flex-end' }
                }}>
                  {/* Compact Admin Indicator in header */}
                  {isAdmin && (
                    <AdminIndicator 
                      userEmail={userEmail}
                      profession={profession}
                      variant="compact"
                    />
                  )}
                  <Button 
                    variant="outlined" 
                    size={isSmallScreen ? "small" : "medium"}
                    startIcon={<Article />}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowQuickNotesModal(true);
                    }}
                    sx={{ 
                      borderColor: customBranding.color,
                      color: customBranding.color,
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      minHeight: { xs: 36, sm: 44 }, // WCAG: Touch target size
                      '&:hover': {
                        bgcolor: customBranding.color + '10',
                        borderColor: customBranding.color
                      }, '&:focus': {
                        outline: `2px solid ${customBranding.color}`,
                        outlineOffset: '2px'
                      }
                    }}
                    // WCAG: Accessible button
                    aria-label={isSmallScreen ? 'Åpne notater' : 'Åpne møtenotater'}
                    tabIndex={0}
                  >
                    {isSmallScreen ? 'Notater' : 'Møtenotater'}
                  </Button>
                  {professionSupports('camera_projects') ? (
                    <Button variant="contained" 
                      size={isSmallScreen ? "small" : "medium"}
                      startIcon={profession === 'photographer' || profession === 'admin' ? <PhotoCamera /> : <AddCircle />}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        trackButtonClick('ny_prosjekt_hovedkort', { 
                          profession, 
                          dashboard: 'universal', 
                          tab: 'oversikt',
                          component: 'hovedkort'
                        });
                        if (professionSupports('vendor_products')) {
                          setShowVendorProductDialog(true);
                        } else {
                          setShowProjectCreation(true);
                        }
                      }}
                      sx={{ 
                        bgcolor: customBranding.color,
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }, '&:hover': { bgcolor: customBranding.color + 'dd' }
                      }}
                    >
                      {isSmallScreen ? 'Nytt' : 'Opprett prosjekt'}
                    </Button>
                  ) : (
                    <Button variant="contained" 
                      size={isSmallScreen ? "small" : "medium"}
                      startIcon={<Add />}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Project modal opened for profession: {profession}
                        setShowProjectModal(true);
                      }}
                      sx={{ 
                        bgcolor: customBranding.color,
                        fontSize: { xs: '0.75rem', sm: '0.875rem' }, '&:hover': { bgcolor: customBranding.color + 'dd' }
                      }}
                    >
                      {getProjectCreationText(isSmallScreen)}
                    </Button>
                  )}
                  <IconButton 
                    size={isSmallScreen ? "small" : "medium"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Email center opened with real count: {unreadEmailCount}
                      setShowEmailCenter(true);
                    }}
                    sx={{ 
                      bgcolor: `${customBranding.color}10`,
                      minHeight: { xs: 36, sm: 44 }, // WCAG: Touch target size
                      '&:hover': { 
                        bgcolor: customBranding.color + '20' 
                      }, '&:focus': {
                        outline: `2px solid ${customBranding.color}`,
                        outlineOffset: '2px'
                }
                }}
                    aria-label={`E-post senter${unreadEmailCount > 0 ? ` - ${unreadEmailCount} uleste meldinger` : ', '}`}
                    tabIndex={0}
                  >
                    <Badge badgeContent={unreadEmailCount} color="error">
                      <Email />
                    </Badge>
                  </IconButton>
                  
                  {/* Client Activity Notification Icon */}
                  <Tooltip title={
                    totalClientActivity > 0 
                      ? `${pendingTimelineChanges} timeline changes, ${pendingSubmissions} new submissions, ${urgentDeadlines} urgent deadlines, ${unreadComments} new comments, ${recentDownloads} recent downloads`
                      : 'No urgent client activity'
                  }>
                    <IconButton 
                      size={isSmallScreen ? "small" : "medium"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Navigate to Overview tab and show client activity section
                        setTabValue(0);
                        // Scroll to client activity section
                        setTimeout(() => {
                          const element = document.getElementById('client-activity-section');
                          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }}
                      sx={{
                        bgcolor: (pendingTimelineChanges > 0 || urgentDeadlines > 0) ? '#ff00001a' : `${customBranding.color}10`,
                        minHeight: { xs: 36, sm: 44 },
                        animation: (pendingTimelineChanges > 0 || urgentDeadlines > 0) ? 'pulse 2s infinite' : 'none','@keyframes pulse': {
                          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 0, 0, 0.7)' }, '50%': { boxShadow: '0 0 0 8px rgba(255, 0, 0, 0)' }
                        }, '&:hover': {
                          bgcolor: (pendingTimelineChanges > 0 || urgentDeadlines > 0) ? '#ff000033' : customBranding.color + '20'
                        }
                      }}
                      aria-label={`Client activity${totalClientActivity > 0 ? ` - ${totalClientActivity} updates` : ', '}`}
                      tabIndex={0}
                    >
                      <Badge 
                        badgeContent={totalClientActivity} 
                        color={(pendingTimelineChanges > 0 || urgentDeadlines > 0) ? "error" : "primary"}
                        max={99}
                      >
                        <Notifications sx={{ color: (pendingTimelineChanges > 0 || urgentDeadlines > 0) ? '#f44336' : 'inherit' }} />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Quick Actions - Dynamic based on available tabs */}
              <Box sx={{ 
                display: 'flex', 
                gap: { xs: 0.5, sm: 1 },
                flexWrap: 'wrap',
                justifyContent: { xs: 'center', sm: 'flex-start' }
              }}>
                {availableTabs.slice(1, 5).map((tab, index) => {
                  // Find actual index in availableTabs array
                  const actualIndex = availableTabs.findIndex(t => t.id === tab.id);
                  
                  return (
                    <Button 
                      key={tab.id}
                      size="small" 
                      startIcon={tab.icon}
                      variant={tabValue === actualIndex ? "contained" : "outlined"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Track quick action click
                        features.trackFeatureUsage(`quick-action-${tab.id}`, 'clicked', {
                          tabLabel: tab.label,
                          profession: profession
                        });
                        
                        handleTabChange(null, actualIndex);
                      }}
                      sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        minWidth: { xs: 'auto', sm: '120px' },
                        px: { xs: 1, sm: 2 },
                        bgcolor: tabValue === actualIndex ? customBranding.color : 'transparent',
                        '&:hover': {
                          bgcolor: tabValue === actualIndex ? customBranding.color + 'dd' : customBranding.color + '10'
                        }
                      }}
                    >
                      {tab.label}
                    </Button>
                  );
                })}
              </Box>
            </MuiCardContent>
          </MuiCard>
        </Box>

        {/* Real Stats Cards - NO MOCK DATA - WCAG Compliant */}
        <Grid 
          container 
          spacing={{ xs: 1.5, sm: 2, md: 3 }}
          sx={{ mb: { xs: 2, md: 4 } }}
          component="section"
          role="region"
          aria-label="Statistikk oversikt"
        >
          <Grid item xs={6} sm={6} md={3}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(25, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${customBranding.color}10`,
              transition: 'transform 0.2s','&:hover': { transform: 'translateY(-4px)' }
            }}>
              <MuiCardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 0.5, sm: 1 },
                    borderRadius: 2,
                    bgcolor: `${customBranding.color}20`,
                    color: customBranding.color,
                    minWidth: 'fit-content'
                  }}>
                    <Assessment sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{
                        fontWeight: 70,
                        fontSize: { xs: '1.3rem', sm: '1.5rem', md: '2rem' },
                        cursor: 'pointer',
                        color: theming.colors.primary, '&:hover': { color: customBranding.color }
                      }}
                      onClick={() => {
                        // Stats navigation - Projects count: {projects?.length || 0}
                        setTabValue(1); // Navigate to Projects tab
                      }}
                    >
                      {projects?.length || 0}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' } }}
                    >
                      Aktive Prosjekter
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid>
          
          <Grid item xs={6} sm={6} md={3}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(25, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${customBranding.color}10`,
              transition: 'transform 0.2s','&:hover': { transform: 'translateY(-4px)' }
            }}>
              <MuiCardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 0.5, sm: 1 },
                    borderRadius: 2,
                    bgcolor: `${customBranding.color}20`,
                    color: customBranding.color,
                    minWidth: 'fit-content'
                  }}>
                    <Group sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{ 
                        fontWeight: 70,
                        fontSize: { xs: '1.3rem', sm: '1.5rem', md: '2rem' },
                        color: theming.colors.primary
                      }}
                    >
                      {dashboardData?.newClients || 0}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' } }}
                    >
                      Nye Kunder
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid>
          
          <Grid item xs={6} sm={6} md={3}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(25, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${customBranding.color}10`,
              transition: 'transform 0.2s','&:hover': { transform: 'translateY(-4px)' }
            }}>
              <MuiCardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 0.5, sm: 1 },
                    borderRadius: 2,
                    bgcolor: `${customBranding.color}20`,
                    color: customBranding.color,
                    minWidth: 'fit-content'
                  }}>
                    <AttachMoney sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{ 
                        fontWeight: 70,
                        fontSize: { xs: '1rem', sm: '1.2rem', md: '1.5rem' },
                        color: theming.colors.primary
                      }}
                    >
                      {dashboardData?.monthlyRevenue ? `${dashboardData.monthlyRevenue.toLocaleString('no-NO')} kr` : '0 kr'}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' } }}
                    >
                      Månedens Inntekt
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid>
          
          <Grid item xs={6} sm={6} md={3}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(25, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${customBranding.color}10`,
              transition: 'transform 0.2s','&:hover': { transform: 'translateY(-4px)' }
            }}>
              <MuiCardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 0.5, sm: 1 },
                    borderRadius: 2,
                    bgcolor: `${customBranding.color}20`,
                    color: customBranding.color,
                    minWidth: 'fit-content'
                  }}>
                    <Star sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{ 
                        fontWeight: 70,
                        fontSize: { xs: '1rem', sm: '1.2rem', md: '1.5rem' },
                        color: theming.colors.primary
                      }}
                    >
                      {dashboardData?.avgRating ? `${dashboardData.avgRating.toFixed(1)}/5.0` : 'N/A'}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' } }}
                    >
                      Vurdering
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid>
        </Grid>

        {/* Split Sheet Statistics - For all professions except vendor */}
        {profession !== 'vendor' && (
          <Box sx={{ mb: 3 }}>
            <MuiCard sx={{
              background: 'linear-gradient(135deg, rgba(159, 122, 234, 0.1) 0%, rgba(142, 110, 214, 0.1) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(159, 122, 234, 0.2)',
              borderRadius: 3
            }}>
              <MuiCardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 70,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: '#9f7aea'
                  }}>
                    <AccountBalance sx={{ color: '#9f7aea' }} />
                    Split Sheets Oversikt
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const splitSheetTabIndex = availableTabs.findIndex(tab => tab.id === 'split-sheets');
                      if (splitSheetTabIndex >= 0) setTabValue(splitSheetTabIndex);
                    }}
                    sx={{
                      color: '#9f7aea',
                      borderColor: alpha('#9f7aea', 0.3),
                      '&:hover': {
                        borderColor: '#9f7aea',
                        backgroundColor: alpha('#9f7aea', 0.1)
                      }
                    }}
                  >
                    Se alle
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
                      <Typography variant="h4" sx={{ fontWeight: 70, color: '#9f7aea' }}>
                        {splitSheetStats.total}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Totalt Split Sheets
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
                      <Typography variant="h4" sx={{ fontWeight: 70, color: '#ff9800' }}>
                        {splitSheetStats.pending}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Venter på signaturer
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
                      <Typography variant="h4" sx={{ fontWeight: 70, color: '#4caf50' }}>
                        {splitSheetStats.completed}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fullført
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
                      <Typography variant="h4" sx={{ fontWeight: 70, color: '#2196f3' }}>
                        {splitSheetStats.draft}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Utkast
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Signature Status Overview - Shows all pending signatures across all document types */}
                {splitSheetStats.pending > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <SignatureStatusOverview />
                  </Box>
                )}

                {/* Quick Actions */}
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      // Broadcast create action to split sheet manager
                      if (communication) {
                        communication.sendMessage({
                          from: 'universal-dashboard',
                          to: 'split-sheet-manager',
                          type: 'action:create-split-sheet',
                          data: {},
                          priority: 'medium'
                        });
                      }
                      const splitSheetTabIndex = availableTabs.findIndex(tab => tab.id === 'split-sheets');
                      if (splitSheetTabIndex >= 0) setTabValue(splitSheetTabIndex);
                    }}
                    sx={{ bgcolor: '#9f7aea','&:hover': { bgcolor: '#8e6ed6' } }}
                  >
                    Opprett Split Sheet
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const splitSheetTabIndex = availableTabs.findIndex(tab => tab.id === 'split-sheets');
                      if (splitSheetTabIndex >= 0) setTabValue(splitSheetTabIndex);
                    }}
                    sx={{ color: '#9f7aea', borderColor: alpha('#9f7aea', 0.3) }}
                  >
                    Administrer Split Sheets
                  </Button>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Box>
        )}

        {/* Pro Editor Mode Toggle - Only for Videographers */}
        {profession === 'videographer' && (
          <MuiCard sx={{
            mb: 3,
            background: 'linear-gradient(135deg, #0B0E12 0%, #11151B 100%)',
            border: '1px solid #e74c3c40',
            borderRadius: 3,
            overflow: 'hidden'
          }}>
            <Box sx={{
              p: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #e74c3c20 0%, #ff6b3520 100%)',
                  border: '1px solid #e74c3c30'
                }}>
                  <MovieCreation sx={{ color: '#e74c3c', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ 
                    color: theming.colors.primary,
                    fontWeight: 600,
                    mb: 0.5 }}>
                    Story Arc Studio by CreatorHub Norge
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    color: '#999',
                    fontSize: '0.85rem'
                  }}>
                    Profesjonell videoredigering med Story Arc Generator og DaVinci Resolve export
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ 
                    color: proEditorMode ? '#4caf50' : '#',
                    fontWeight: 50,
                    fontSize: '0.9rem'
                  }}>
                    {proEditorMode ? 'Pro Editor Active' : 'Standard Dashboard'}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={proEditorMode}
                        onChange={handleProEditorModeChange}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#e74c3c',
                      }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#e74c3c'
                          }, '& .MuiSwitch-track': {
                            backgroundColor: '#333',
                          }
                        }}
                      />
                    }
                    label=""
                    sx={{ m: 0 }}
                  />
                </Stack>
                
                {proEditorMode && (
                  <Chip 
                    label="PRO MODE" 
                    size="small"
                    sx={{
                      bgcolor: '#e74c3c',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      height: 24 }}
                  />
                )}
              </Box>
            </Box>
          </MuiCard>
        )}

        {/* Main Content */}
        {profession === 'videographer' && proEditorMode ? (
          /* Pro Editor Mode - Full Story Arc Studio */
          <Box sx={{ minHeight: 'calc(100vh - 400px)' }}>
            <StoryArcStudio 
              selectedProject={selectedProject}
              onProjectSelect={setSelectedProject}
            />
          </Box>
        ) : (
          /* Standard Dashboard */
          <MuiCard sx={{ 
            background: 'rgba(25, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${customBranding.color}20`,
            // WCAG Compliance: High contrast and focus management
            '&:focus-within': {
              outline: `2px solid ${customBranding.color}`,
              outlineOffset: '2px'
            }
          }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <MuiTabs 
                value={tabValue}
                onChange={handleTabChange}
                variant={isSmallScreen ? "scrollable" : "fullWidth"}
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
                    minWidth: { xs: 80, sm: 100 },
                    px: { xs: 1, sm: 2 }, '&.Mui-selected': {
                      color: customBranding.color
                    }
                  }, '& .MuiTabs-indicator': {
                    backgroundColor: customBranding.color
                  }, '& .MuiTab-iconWrapper': {
                    fontSize: { xs: '1rem', sm: '1.2rem' }
                  }
                }}
              >
                {availableTabs.map((tab, index) => {
                  return (
                    <Tab 
                      key={tab.id}
                      label={isSmallScreen ? tab.label.split('')[0] : tab.label}
                      icon={tab.icon}
                      onClick={() => {
                        // Track tab access with feature system
                        features.trackFeatureUsage(`dashboard-tab-${tab.id}`, 'clicked', {
                          tabIndex: index,
                          tabLabel: tab.label,
                          profession: profession
                        });
                      }}
                    />
                );
            })}
              </MuiTabs>
              
              {/* Feature Analytics Display */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: 1,
                mt: 1,
                px: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Tilgjengelige faner: {availableTabs.length}/{config.tabs.length}
                  </Typography>
                  <Chip 
                    label={`${Math.round((availableTabs.length / config.tabs.length) * 100)}%`}
                    size="small"
                    variant="outlined"
                    color={availableTabs.length === config.tabs.length ? 'success' : 'warning'}
                    sx={{ fontSize: '10px', height: 20 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
                  </Typography>
                  <Chip 
                    label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '10px', height: 20 }}
                  />
                </Box>
              </Box>
            </Box>

          <TabPanel value={tabValue} index={0}>
            {/* Location Intelligence Widget */}
            {locationIntelligence.weatherData && (
              <Box sx={{ mb: 3 }}>
                <MuiCard sx={{ 
                  background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.9) 0%, rgba(2, 5, 5,255,255,0.95) 100%)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(2, 5, 5,255,255,0.2)',
                  borderRadius: 3 }}>
                  <MuiCardContent>
                    <Typography variant="h6" gutterBottom sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      color: theming.colors.primary 
                }}>
                      🌤️ Lokasjonsintelligens
                    </Typography>
                    
                    <Grid container spacing={2}>
                      {/* Weather Information */}
                      <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            🌡️ Værmelding
                          </Typography>
                          <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                            {locationIntelligence.weatherData.temperature}°C
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Vind: {locationIntelligence.weatherData.windSpeed} m/s
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Sikt: {locationIntelligence.weatherData.visibility} km
                          </Typography>
                        </Paper>
                      </Grid>
                      
                      {/* Weather Forecast */}
                      {locationIntelligence.weatherForecast && (
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              📅 5-dagers prognose
                            </Typography>
                            {locationIntelligence.weatherForecast.forecast.slice(0, 3).map((day: any, index: number) => (
                              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">
                                  {new Date(day.date).toLocaleDateString('no-NO', { weekday: 'short' })}
                                </Typography>
                                <Typography variant="body2" sx={{ color: theming.colors.primary }}>
                                  {day.temperature}°C
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        </Grid>
                      )}
                      
                      {/* Economic Indicators */}
                      {locationIntelligence.economicData && (
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              📊 Økonomiske indikatorer
                            </Typography>
                            {locationIntelligence.economicData.indicators?.slice(0, 2).map((indicator: any, index: number) => (
                              <Box key={index} sx={{ mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600}}>
                                  {indicator.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {indicator.value} {indicator.unit}
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        </Grid>
                      )}
                      
                      {/* Population Data */}
                      {locationIntelligence.populationData && (
                        <Grid item xs={12} sm={6} md={3}>
                          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              👥 Befolkningsdata
                            </Typography>
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                              {locationIntelligence.populationData.data?.population?.toLocaleString() || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Oslo befolkning
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Vekst: {locationIntelligence.populationData.data?.growth || 0}%
                            </Typography>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>
                  </MuiCardContent>
                </MuiCard>
              </Box>
            )}
            
            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid item xs={12}>
                {/* Enhanced Kommende Prosjekter Section */}
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                      mb: 3 }}>
                    <Typography variant="h6" 
                      sx={{ 
                        fontWeight: 70,
                        fontSize: { xs: '1.1rem', sm: '1.25rem' },
                        background: `linear-gradient(135deg, ${customBranding.color}, #FF8C00)`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: theming.colors.primary
                        }}>
                      <CalendarToday sx={sharedStyles.brandedText} />
                      {professionSupports('camera_projects') && 'Kommende Prosjekter'}
                      {profession === 'videographer' && 'Kommende Videoprosjekter'}
                      {professionSupports('music_projects') && 'Kommende Musikkprosjekter'}
                      {professionSupports('vendor_products') && 'Kommende Bestillinger'}
                    </Typography>
                    
                    {projects && projects.length > 0 && (
                      <Badge 
                        badgeContent={projects.length}
                        color="primary"
                        sx={{
                          '& .MuiBadge-badge': {
                            backgroundColor: customBranding.color,
                            color: 'white'
                    }
                        }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            // Navigate to Projects tab to see all projects
                            setTabValue(config.tabs.findIndex(tab => tab.id === 'projects'));
                          }}
                          sx={{
                            color: customBranding.color,
                            borderColor: alpha(customBranding.color, 0.3),
                            '&:hover': {
                              borderColor: customBranding.color,
                              backgroundColor: alpha(customBranding.color, 0.1)
                            }
                          }}
                      >
                          Se alle
                        </Button>
                      </Badge>
                    )}
                  </Box>

                  {/* Display upcoming projects using hooks from top level */}
                  {upcomingLoading ? (
                    <Grid container spacing={2}>
                      {[1, 2, 3, 4].map(index => (
                        <Grid item xs={12} sm={6} key={index}>
                          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
                        </Grid>
                      ))}
                    </Grid>
                  ) : (!upcomingProjects || upcomingProjects.length === 0) ? (
                    <MuiCard sx={{
                      background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.9) 0%, rgba(2, 5, 5,255,255,0.95) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${alpha(customBranding.color, 0.2)}`,
                      borderRadius: 3,
                      p: 6,
                      textAlign: 'center'
                    }}>
                      <CalendarToday sx={{ 
                        fontSize: 48, 
                        color: alpha(customBranding.color, 0.5),
                        mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                        {professionSupports('camera_projects') && 'Ingen kommende prosjekter'}
                        {profession === 'videographer' && 'Ingen kommende videoprosjekter'}
                        {professionSupports('music_projects') && 'Ingen kommende musikkprosjekter'}
                        {professionSupports('vendor_products') && 'Ingen kommende bestillinger'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {professionSupports('camera_projects') && 'Opprett ditt første prosjekt for å komme i gang'}
                        {profession === 'videographer' && 'Opprett ditt første videoprosjekt for å komme i gang'}
                        {professionSupports('music_projects') && 'Opprett ditt første musikkprosjekt for å komme i gang'}
                        {professionSupports('vendor_products') && 'Ingen bestillinger ennå'}
                      </Typography>
                      <Button variant="contained"
                        startIcon={profession === 'photographer' || profession === 'admin' ? <PhotoCamera /> : <AddCircle />}
                        onClick={() => {
                          trackButtonClick('ny_prosjekt_knapp_main', { 
                            profession, 
                            dashboard: 'universal', 
                            tab: 'main',
                          component: 'project_button_main'
                        });
                          if (professionSupports('vendor_products')) {
                          setShowVendorProductDialog(true);
                        } else {
                          setShowProjectCreation(true);
                    }
                    }}
                        sx={{
                          backgroundColor: customBranding.color, '&:hover': { backgroundColor: alpha(customBranding.color, 0.8) }
                        }}
                      >
                        {profession === 'photographer' && 'Opprett Fotografiprosjekt'}
                        {profession === 'videographer' && 'Opprett Videoprosjekt'}
                        {profession === 'music_producer' && 'Opprett Musikkprosjekt'}
                        {profession === 'vendor' && 'Gå til Produkter'}
                      </Button>
                    </MuiCard>
                  ) : (
                    <Grid container spacing={2}>
                      {upcomingProjects.map((project: any, index: number) => {
                        // Calculate days until project
                        const projectDate = new Date(project.eventDate || project.date);
                        const today = new Date();
                        const daysUntil = Math.ceil((projectDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        
                        // Determine urgency level and colors
                        const isUrgent = daysUntil <= 3;
                        const isUpcoming = daysUntil <= 7 && daysUntil > 3;
                        const isPast = daysUntil < 0;
                        
                        const urgencyColor = isPast ? '#9e9e9e' : isUrgent ? '#f44336' : isUpcoming ? '#ff9800' : '#4caf50';
                        const progressValue = Math.max(0, Math.min(100, ((7 - daysUntil) / 7) * 100));

                        return (
                            <Grid item xs={12} sm={6} key={project.id}>
                            <Fade in timeout={300 + index * 100}>
                              <MuiCard
                                sx={{
                                  background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.9) 0%, rgba(2, 5, 5,255,255,0.95) 100%)',
                                  backdropFilter: 'blur(10px)',
                                  border: `1px solid ${alpha(urgencyColor, 0.2)}`,
                                  borderRadius: 3,
                                  overflow: 'hidden',
                                  position: 'relative',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  cursor: 'pointer','&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: `0 12px 24px ${alpha(urgencyColor, 0.15)}, 0 4px 12px ${alpha(urgencyColor, 0.1)}`,
                                    border: `1px solid ${alpha(urgencyColor, 0.4)}`
                                  }, '&:before': {
                                    content: ', ""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: 4,
                                    background: `linear-gradient(90deg, ${urgencyColor}, ${alpha(urgencyColor, 0.7)})`,
                                    borderRadius: '12px 12px 0 0'
                                  }
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Prosjekt: ${project.title || project.name}, ${daysUntil >= 0 ? `${daysUntil} dager igjen` : 'Overdue'}`}
                                onClick={() => handleOpenProjectOverview(project, 'timeline')}
                              >
                                <MuiCardContent sx={{ p: 2, pb: 1 }}>
                                  {/* Header with Avatar and Status */}
                                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                                    <Avatar 
                                      sx={{ 
                                        width: 36, 
                                        height: 36,
                                        backgroundColor: alpha(urgencyColor, 0.1),
                                        color: urgencyColor,
                                        fontSize: '0.9rem',
                                        fontWeight: 600}}
                                    >
                                      {(project.clientName || project.title || project.name || 'P').charAt(0).toUpperCase()}
                                    </Avatar>
                                    
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="h6" 
                                        sx={{ 
                                          fontSize: '1rem',
                                          fontWeight: 600,
                                          color: theming.colors.primary,
                                          lineHeight: 1.2,
                                          mb: 0.5,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {project.title || project.name}
                                      </Typography>
                                      
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <AccountCircle sx={{ fontSize: 14, color: '#666'}} />
                                        <Typography 
                                          variant="body2" 
                                          sx={{ 
                                            color: '#666',
                                            fontSize: '0.8rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {project.clientName || 'Klient ikke angitt'}
                                        </Typography>
                                      </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                      <Chip 
                                        size="small"
                                        label={isPast ? 'Overdue' : isUrgent ? 'Urgent' : isUpcoming ? 'Snart' : 'OK'}
                                        sx={{
                                          backgroundColor: alpha(urgencyColor, 0.1),
                                          color: urgencyColor,
                                          fontWeight: 600,
                                          fontSize: '0.7rem',
                                          height: 20 }}
                                      />
                                      
                                      {!isPast && (
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            color: urgencyColor,
                                            fontWeight: 600,
                                            fontSize: '0.7rem'
                                          }}
                                        >
                                          {daysUntil === 0 ? 'I dag' : daysUntil === 1 ? 'I morgen' : `${daysUntil} dager`}
                                        </Typography>
                                      )}
                                    </Box>
                                  </Box>

                                  {/* Project Details */}
                                  <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Event sx={{ fontSize: 16, color: urgencyColor }} />
                                      <Typography variant="body2" sx={{ color: '#444', fontWeight: 500}}>
                                        {new Date(project.eventDate || project.date).toLocaleDateString('no-NO', {
                                          weekday: 'short',
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </Typography>
                                    </Box>
                                    
                                    {project.location && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LocationOn sx={{ fontSize: 16, color: '#666'}} />
                                        <Typography 
                                          variant="body2" 
                                          sx={{ 
                                            color: '#666',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {project.location}
                                        </Typography>
                                      </Box>
                                    )}
                                    
                                    {project.projectType && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {customBranding.customLogo ? (
                                          <img 
                                            src={customBranding.customLogo}
                                            alt="Logo" 
                                            style={{ width: 16, height: 16, objectFit: 'contain' }}
                                          />
                                        ) : (
                                          <PhotoCamera sx={{ fontSize: 16, color: customBranding.color }} />
                                        )}
                                        <Typography variant="body2" sx={{ color: '#666', textTransform: 'capitalize' }}>
                                          {project.projectType}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Stack>

                                  {/* Progress Indicator */}
                                  {!isPast && (
                                    <Box sx={{ mt: 2 }}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>
                                          Fremdrift til deadline
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: urgencyColor, fontWeight: 600, fontSize: '0.7rem' }}>
                                          {Math.round(progressValue)}%
                                        </Typography>
                                      </Box>
                                      <LinearProgress 
                                        variant="determinate" 
                                        value={progressValue}
                                        sx={{
                                          height: 6,
                                          borderRadius: 3,
                                          backgroundColor: alpha(urgencyColor, 0.1),
                                          '& .MuiLinearProgress-bar': {
                                            backgroundColor: urgencyColor,
                                            borderRadius: 3
                                          }
                                        }}
                                      />
                                    </Box>
                                  )}
                                </MuiCardContent>
                                
                                {/* Quick Actions */}
                                <MuiCardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                                  <Button
                                    size="small"
                                    startIcon={<Phone />}
                                    onClick={() => {
                                      if (project.clientPhone) {
                                        // Use native tel: link instead of window.open
                                        const telLink = document.createElement('a');
                                        telLink.href = `tel:${project.clientPhone}`;
                                        telLink.click();
                                      } else {
                                        // Open CRM dialog to add phone number and contact info
                                        setSelectedClient({
                                          id: project.clientId || project.id || 'unknown-client',
                                          name: project.clientName || 'Ukjent klient',
                                          email: project.clientEmail ||', ',
                                          phone: ', '
                                        });
                                        setShowCrmDialog(true);
                                      }
                                    }}
                                    sx={{
                                      color: '#666',
                                      fontSize: '0.75rem','&:hover': {
                                        backgroundColor: alpha(customBranding.color, 0.1),
                                          color: customBranding.color
                                        }
                                      }}
                                  >
                                    Ring
                                  </Button>
                                  
                                  <Button
                                    size="small"
                                    startIcon={<Email />}
                                    onClick={() => {
                                      if (project.clientEmail) {
                                        // Open smart email designer with project context
                                        setEmailProjectContext({
                                          projectId: project.id
                                        });
                                        setShowEmailDesigner(true);
                                      } else{
                                        // Open email center with client context for adding email
                                        setShowEmailCenter(true);
                                      }
                                    }}
                                    sx={{
                                      color: '#666',
                                      fontSize: '0.75rem','&:hover': {
                                        backgroundColor: alpha(customBranding.color, 0.1),
                                          color: customBranding.color
                                        }
                                      }}
                                  >
                                    E-post
                                  </Button>
                                  
                                  <Box sx={{ flex: 1 }} />
                                  
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenProjectOverview(project, 'timeline');
                                    }}
                                    sx={{
                                      color: '#666','&:hover': {
                                        backgroundColor: alpha(customBranding.color, 0.1),
                                          color: customBranding.color
                                        }
                                      }}
                                  >
                                    <Launch sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </MuiCardActions>
                              </MuiCard>
                            </Fade>
                          </Grid>
                      );
                  })}
                    </Grid>
                  )}
                </Box>

                {/* Story Arc Projects Section - Only for Videographers */}
                {profession === 'videographer' && storyArcProjectsData && storyArcProjectsData.length > 0 && (
                  <Box sx={{ mb: 4, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 70, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MovieCreation sx={{ color: customBranding.color }} />
                        Story Arc Projects
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setProEditorMode(true);
                          setTabValue(0);
                        }}
                      >
                        View All
                      </Button>
                    </Box>
                    <Grid container spacing={2}>
                      {storyArcProjectsData.map((project: any) => (
                        <Grid item xs={12} sm={6} md={4} key={project.id}>
                          <MuiCard
                            sx={{
                              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                            }}
                            onClick={() => handleOpenProjectOverview(project, 'story-arc')}
                          >
                            <MuiCardContent>
                              <Typography variant="h6" noWrap>{project.storyArcName}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {project.templateType} • {new Date(project.createdAt).toLocaleDateString()}
                              </Typography>
                              <Chip label={project.status} size="small" sx={{ mt: 1 }} />
                            </MuiCardContent>
                          </MuiCard>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Photo Enhancement Projects Section */}
                {allPhotoProjects && allPhotoProjects.length > 0 && (
                  <Box sx={{ mb: 4, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 70, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhotoCamera sx={{ color: customBranding.color }} />
                        Photo Projects
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setTabValue(8)}
                      >
                        View All
                      </Button>
                    </Box>
                    <Grid container spacing={2}>
                      {allPhotoProjects.map((project: any) => (
                        <Grid item xs={12} sm={6} md={4} key={project.id}>
                          <MuiCard
                            sx={{
                              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                            }}
                            onClick={() => handleOpenProjectOverview(project, 'photo')}
                          >
                            <MuiCardContent>
                              <Typography variant="h6" noWrap>{project.name || project.title}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {project.eventDate ? new Date(project.eventDate).toLocaleDateString() : 'No date'}
                              </Typography>
                            </MuiCardContent>
                          </MuiCard>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Audio Enhancement Projects Section */}
                {profession === 'music_producer' && audioProjectsData && audioProjectsData.length > 0 && (
                  <Box sx={{ mb: 4, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 70, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LibraryMusic sx={{ color: customBranding.color }} />
                        Audio Projects
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const audioTabIndex = config.tabs.findIndex(tab => tab.id === 'audio');
                          if (audioTabIndex >= 0) setTabValue(audioTabIndex);
                        }}
                      >
                        View All
                      </Button>
                    </Box>
                    <Grid container spacing={2}>
                      {audioProjectsData.map((project: any) => (
                        <Grid item xs={12} sm={6} md={4} key={project.id}>
                          <MuiCard
                            sx={{
                              cursor: 'pointer','&:hover': { transform: 'translateY(-4px)', boxShadow: 3 }
                            }}
                            onClick={() => handleOpenProjectOverview(project, 'audio')}
                          >
                            <MuiCardContent>
                              <Typography variant="h6" noWrap>{project.filename || project.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {project.status} • {project.enhancementType}
                              </Typography>
                            </MuiCardContent>
                          </MuiCard>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {/* Client Activity & Deadline Tracking */}
                <Box sx={{ mt: { xs: 2, md: 3 } }} id="client-activity-section">
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 2 }}>
                    <Typography variant="h6" 
                      sx={{ 
                        fontWeight: 600, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        fontSize: { xs: '1.1rem', sm: '1.25rem' },
                        color: theming.colors.primary
                      }}>
                      <Notifications sx={{ color: customBranding.color }} />
                      Client Activity & Deadlines
                    </Typography>
                    
                    {totalClientActivity > 0 && (
                      <Badge 
                        badgeContent={totalClientActivity}
                        color={pendingTimelineChanges > 0 || pendingSubmissions > 0 || urgentDeadlines > 0 ? "error" : "primary"}
                        sx={{
                          '& .MuiBadge-badge': {
                            animation: (pendingTimelineChanges > 0 || pendingSubmissions > 0 || urgentDeadlines > 0) ? 'pulse 2s infinite' : 'none'
                          }
                        }}
                      >
                        <Chip 
                          label={
                            pendingTimelineChanges > 0 ? `${pendingTimelineChanges} TIMELINE CHANGES` :
                            pendingSubmissions > 0 ? `${pendingSubmissions} NEW SUBMISSIONS` :
                            urgentDeadlines > 0 ? `${urgentDeadlines} URGENT` : 
                            `${totalClientActivity} updates`
                          }
                          color={pendingTimelineChanges > 0 || pendingSubmissions > 0 || urgentDeadlines > 0 ? "error" : "primary"}
                          size="small"
                          sx={{ fontWeight: 600}}
                        />
                      </Badge>
                    )}
                  </Box>
                  
                  <Grid container spacing={{ xs: 2, md: 3 }}>
                    <Grid item xs={12}>
                      <ClientActivityPanel
                        profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor'}
                        accentColor={customBranding.color}
                        userId={userId}
                        onActivityClick={(activity) => {
                          // Navigate to relevant section based on activity type
                          if (activity.type === 'deadline') {
                            // Go to Projects tab
                            setTabValue(1);
                          } else if (activity.type === 'comment') {
                            // Go to Showcase tab
                            const showcaseTabIndex = config.tabs.findIndex(tab => tab.id === 'showcase-viewer');
                            if (showcaseTabIndex !== -1) setTabValue(showcaseTabIndex);
                          } else if (activity.type === 'timeline_change') {
                            // Go to Wedding Timeline tab
                            const timelineTabIndex = config.tabs.findIndex(tab => tab.id === 'wedding-timeline');
                            if (timelineTabIndex !== -1) setTabValue(timelineTabIndex);
                          }
                        }}
                        onCreateProjectFromSubmission={(submissionData) => {
                          // Pre-fill project creation with submission data
                          setUiSettings(prev => ({
                            ...prev,
                            submissionProjectData: submissionData
                          }));
                          setShowProjectCreation(true);
                        }}
                        onAcceptTimelineChanges={async (changes, worklogData) => {
                          try {
                            // 1. Accept all timeline changes in database
                            const changeIds = changes.map(c => c.id.replace('timeline-change-', ', '));
                            await apiRequest('/api/timeline-changes/accept-all', {
                              method: 'POST',
                              body: JSON.stringify({ changeIds })
                            });

                            // 2. Create worklog entry about the changes
                            await apiRequest(`/api/projects/${userId}/worklog`, {
                              method: 'POST',
                              body: JSON.stringify({
                                ...worklogData,
                                userId: userId,
                                day: (worklogData.day || 1),
                                date: new Date().toISOString(),
                                syncToGoogleKeep: true // Flag for Google Keep sync
                              })
                            });

                            // 3. Refresh queries
                            await queryClient.invalidateQueries({ queryKey: ['/api/timeline-changes/pending', userId] });
                            await queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary', userId] });
                            await queryClient.invalidateQueries({ queryKey: ['/api/projects', userId, 'worklog'] });

                            // 4. Show success message
                            addNotification({
                              message: `Accepted ${changes.length} timeline change(s) and added to worklog. Synced to Google Keep for meeting discussion.`,
                              type: 'success',
                              title: 'Timeline Changes Accepted',
                              read: false
                            });
                          } catch (error) {
                            console.error('Error accepting timeline changes:', error);
                            addNotification({
                              message: 'Failed to accept timeline changes',
                              type: 'error',
                              title: 'Error',
                              read: false
                            });
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
                
                {/* Unified Customer Inquiry & Email Center */}
                <Box sx={{ mt: { xs: 2, md: 3 } }}>
                  <Typography variant="h6" 
                    sx={{ 
                      mb: 2,
                      fontWeight: 600, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      fontSize: { xs: '1.1rem', sm: '1.25rem' },
                      color: theming.colors.primary
                      }}>
                    <Email sx={{ color: customBranding.color }} />
                    Kundeforespørsler & E-post Aktivitet
                  </Typography>
                  
                  <Grid container spacing={{ xs: 2, md: 3 }}>
                    <Grid item xs={12}>
                      <CustomerInquiryCenter profession={profession} userId={userId} customBranding={customBranding} />
                    </Grid>
                  </Grid>
                </Box>
                
                {/* Professional Orchestration System - WCAG Compliant */}
                <Box 
                  sx={{ mt: { xs: 3, md: 4 } }}
                  component="section"
                  role="region"
                  aria-label="Smart arbeidsflyt system"
                >
                  <Typography variant="h4" 
                    sx={{ 
                      mb: { xs: 1.5, md: 2 },
                      fontWeight: 600, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      fontSize: { xs: '1.1rem', sm: '1.25rem' },
                      color: theming.colors.primary
                    }}
                    // WCAG: Proper heading hierarchy
                    component="h4"
                    aria-level={4}
                  >
                    <Build 
                      color="primary" 
                      sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}
                      aria-hidden="true"
                    />
                    Smart Arbeidsflyt
                  </Typography>
                  
                  {/* Smart arbeidsflyt - keyboard-activated workflow automation */}
                  <SmartWorkflowBuilder profession={profession} />
                </Box>
              </Grid>
              {/* End of md={8} column for kommende prosjekter */}
            </Grid>

            {/* Contract Summary Widget */}
            <Box sx={{ mt: 3 }}>
              <ContractSummaryWidget
                userId={userId}
                onCreateContract={() => {
                  const contractTabIndex = availableTabs.findIndex(tab => tab.id === 'contracts');
                  if (contractTabIndex >= 0) setTabValue(contractTabIndex);
                }}
                onViewContract={(contractId: string) => {
                  const contractTabIndex = availableTabs.findIndex(tab => tab.id === 'contracts');
                  if (contractTabIndex >= 0) {
                    setTabValue(contractTabIndex);
                    // Could emit event to contract hub to select this contract
                    if (communication) {
                      communication.sendMessage({
                        from: 'universal-dashboard',
                        to: 'contract-hub',
                        type: 'contract:select',
                        data: { contractId },
                        timestamp: Date.now()
                      });
                    }
                  }
                }}
                onViewAllContracts={() => {
                  const contractTabIndex = availableTabs.findIndex(tab => tab.id === 'contracts');
                  if (contractTabIndex >= 0) setTabValue(contractTabIndex);
                }}
                brandColor={customBranding.color}
              />
            </Box>

            {/* Google Workspace Storage - Placed at bottom for less intrusive display */}
            <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mt: 3 }}>
                    <Grid item xs={12} md={6}>
                <GoogleWorkspaceStorageInfo 
                  userId={userId}
                  profession={profession}
                  compact={true}
                  showDetailsButton={true}
                />
              </Grid>
            </Grid>

            {/* Main dashboard content focuses on projects and activity */}
          </TabPanel>

          {/* Professional Components Integration via Orchestrator */}
          <TabPanel value={tabValue} index={1}>
            {/* Profession-specific project management via orchestrators */}
            {profession === 'photographer' && (
              // @ts-ignore - Orchestrator return type issue in source file
              <FotografOrchestrator />
            )}
            {profession === 'videographer' && (
              // @ts-ignore - Orchestrator return type issue in source file
              <VideografOrchestrator />
            )}
            {profession === 'music_producer' && (
              // @ts-ignore - Orchestrator return type issue in source file
              <MusikkProdusentOrchestrator />
            )}
            {profession === 'vendor' && (
              // @ts-ignore - Orchestrator return type issue in source file
              <VendorOrchestrator />
            )}
            
            {/* Prosjekter - Project Management for Photographers */}
            <Box sx={{ p: 3 }}>
              
              <Grid container spacing={{ xs: 2, md: 3 }}>
                <Grid item xs={12}>
                  {/* Enhanced Mine Fotografiprosjekter Section with matching design */}
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 3 }}>
                      <Typography variant="h6" 
                        sx={{ 
                          fontWeight: 70,
                          fontSize: { xs: '1.1rem', sm: '1.25rem' },
                          background: `linear-gradient(135deg, ${customBranding.color}, #FF8C00)`,
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: theming.colors.primary
                        }}>
                        <Collections sx={{ color: customBranding.color }} />
                        {profession === 'photographer' && 'Mine Fotografiprosjekter'}
                        {profession === 'videographer' && 'Mine Videoprosjekter'}
                        {profession === 'music_producer' && 'Mine Musikkprosjekter'}
                        {profession === 'vendor' && 'Mine Produkter'}
                      </Typography>
                      
                      {projects && projects.length > 0 && (
                        <Badge 
                          badgeContent={projects.length}
                          color="primary"
                          sx={{
                            '& .MuiBadge-badge': {
                              backgroundColor: customBranding.color,
                              color: 'white'
                      }
                        }}
                      >
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={profession === 'photographer' || profession === 'admin' ? <PhotoCamera /> : <AddCircle />}
                            onClick={() => {
                              trackButtonClick('ny_prosjekt_knapp_quick', { 
                                profession, 
                                dashboard: 'universal', 
                                tab: 'quick_actions',
                                component: 'project_button_quick'
                              });
                              if (professionSupports('vendor_products')) {
                          setShowVendorProductDialog(true);
                        } else {
                              setShowProjectCreation(true);
                            }
                          }}
                            sx={{
                              color: customBranding.color,
                              borderColor: alpha(customBranding.color, 0.3),
                              '&:hover': {
                                borderColor: customBranding.color,
                                backgroundColor: alpha(customBranding.color, 0.1)
                              }
                            }}
                          >
                            {profession === 'photographer' && 'Nytt Fotografiprosjekt'}
                            {profession === 'videographer' && 'Nytt Videoprosjekt'}
                            {profession === 'music_producer' && 'Nytt Musikkprosjekt'}
                            {profession === 'vendor' && 'Nytt Produkt'}
                          </Button>
                        </Badge>
                      )}
                    </Box>

                    {projects && projects.length > 0 ? (
                      <Grid container spacing={2}>
                        {projects.map((project: any, index: number) => {
                          // Calculate project status colors and urgency
                          const projectDate = new Date(project.eventDate || project.date);
                          const today = new Date();
                          const daysUntil = Math.ceil((projectDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                          
                          const isActive = project.status === 'active' || project.status === 'Bekreftet';
                          const isCompleted = project.status === 'completed' || project.status === 'Fullført';
                          const isPending = project.status === 'pending' || project.status === 'Planlagt';
                          
                          const statusColor = isCompleted ? '#4caf50' : isActive ? customBranding.color : isPending ? '#ff9800' : '#9e9e9e';
                          
                          return (
                            <Grid item xs={12} sm={6} md={4} key={project.id}>
                              <Fade in timeout={300 + index * 100}>
                                <MuiCard
                                  sx={{
                                    background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.9) 0%, rgba(2, 5, 5,255,255,0.95) 100%)',
                                    backdropFilter: 'blur(10px)',
                                    border: `1px solid ${alpha(statusColor, 0.2)}`,
                                    borderRadius: 3,
                                    overflow: 'hidden',
                                    position: 'relative',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer','&:hover': {
                                      transform: 'translateY(-4px)',
                                      boxShadow: `0 12px 24px ${alpha(statusColor, 0.15)}, 0 4px 12px ${alpha(statusColor, 0.1)}`,
                                      border: `1px solid ${alpha(statusColor, 0.4)}`
                                    }, '&:before': {
                                      content: ', ""',
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      height: 4,
                                      background: `linear-gradient(90deg, ${statusColor}, ${alpha(statusColor, 0.7)})`,
                                      borderRadius: '12px 12px 0 0'
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`Prosjekt: ${project.title || project.name}, Status: ${project.status}`}
                                >
                                  <MuiCardContent sx={{ p: 2, pb: 1 }}>
                                    {/* Header with Avatar and Status - EXACT MATCH to Kommende prosjekter */}
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                                      <Avatar 
                                        sx={{ 
                                          width: 36, 
                                          height: 36,
                                          backgroundColor: alpha(statusColor, 0.1),
                                          color: statusColor,
                                          fontSize: '0.9rem',
                                          fontWeight: 600}}
                                      >
                                        {(project.clientName || project.title || project.name || 'P').charAt(0).toUpperCase()}
                                      </Avatar>
                                      
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="h6" 
                                          sx={{ 
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            color: theming.colors.primary,
                                            lineHeight: 1.2,
                                            mb: 0.5,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}>
                                          {project.title || project.name}
                                        </Typography>
                                        
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          <AccountCircle sx={{ fontSize: 14, color: '#666'}} />
                                          <Typography 
                                            variant="body2" 
                                            sx={{ 
                                              color: '#666',
                                              fontSize: '0.8rem',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap'
                                            }}
                                          >
                                            {project.clientName || 'Klient ikke angitt'}
                                          </Typography>
                                        </Box>
                                      </Box>

                                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                                        <Chip 
                                          size="small"
                                          label={isCompleted ? 'Fullført' : isActive ? 'Aktiv' : isPending ? 'Planlagt' : project.status}
                                          sx={{
                                            backgroundColor: alpha(statusColor, 0.1),
                                            color: statusColor,
                                            fontWeight: 600,
                                            fontSize: '0.7rem',
                                            height: 20 }}
                                        />
                                        
                                        {daysUntil >= 0 && daysUntil <= 30 && (
                                          <Typography 
                                            variant="caption" 
                                            sx={{ 
                                              color: statusColor,
                                              fontWeight: 600,
                                              fontSize: '0.7rem'
                                      }}
                                          >
                                            {daysUntil === 0 ? 'I dag' : daysUntil === 1 ? 'I morgen' : `${daysUntil} dager`}
                                          </Typography>
                                        )}
                                      </Box>
                                    </Box>

                                    {/* Project Details - EXACT MATCH to Kommende prosjekter */}
                                    <Stack spacing={1}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Event sx={{ fontSize: 16, color: statusColor }} />
                                          <Typography variant="body2" sx={{ color: '#444', fontWeight: 500}}>
                                          {project.eventDate || project.date ? 
                                            new Date(project.eventDate || project.date).toLocaleDateString('no-NO', {
                                              weekday: 'short',
                                              day: '2-digit',
                                              month: 'short',
                                              year: 'numeric'
                                      }) : 'Dato ikke satt'
                                      }
                                        </Typography>
                                      </Box>
                                      
                                      {project.location && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <LocationOn sx={{ fontSize: 16, color: statusColor }} />
                                          <Typography variant="body2" sx={{ color: '#444', fontWeight: 500}}>
                                            {project.location}
                                          </Typography>
                                        </Box>
                                      )}

                                      {/* Progress Bar - EXACT MATCH */}
                                      {daysUntil >= 0 && daysUntil <= 30 && (
                                        <Box sx={{ mt: 1 }}>
                                          <LinearProgress 
                                            variant="determinate" 
                                            value={Math.max(0, Math.min(100, ((30 - daysUntil) / 30) * 100))}
                                            sx={{
                                              height: 4,
                                              borderRadius: 2,
                                              backgroundColor: alpha(statusColor, 0.15),
                                              '& .MuiLinearProgress-bar': {
                                                backgroundColor: statusColor,
                                                borderRadius: 2
                                              }
                                            }}
                                          />
                                        </Box>
                                      )}
                                    </Stack>
                                  </MuiCardContent>

                                  <MuiCardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
                                    <Button
                                      size="small"
                                      startIcon={<Edit />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditProject(project);
                                      }}
                                      sx={{
                                        color: statusColor,
                                        '&:hover': {
                                          backgroundColor: alpha(statusColor, 0.1)
                                        }
                                      }}
                                    >
                                      Rediger
                                    </Button>
                                    
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewProjectDetails(project);
                                      }}
                                      sx={{
                                        color: '#666','&:hover': {
                                          backgroundColor: alpha(customBranding.color, 0.1),
                                          color: customBranding.color
                                        }
                                      }}
                                      title="Se større"
                                    >
                                      <Launch sx={{ fontSize: 16 }} />
                                    </IconButton>
                                    
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteProject(project);
                                      }}
                                      sx={{
                                        color: '#666','&:hover': {
                                          backgroundColor: alpha('#f44336', 0.1),
                                          color: '#f44336'
                                  }
                                  }}
                                      title="Slett prosjekt"
                                    >
                                      <Delete sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </MuiCardActions>
                                </MuiCard>
                              </Fade>
                            </Grid>
                        );
                    })}
                      </Grid>
                    ) : (
                      <MuiCard sx={{
                        background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.9) 0%, rgba(2, 5, 5,255,255,0.95) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: `1px solid ${alpha(customBranding.color, 0.2)}`,
                        borderRadius: 3,
                        p: 6,
                        textAlign: 'center'
                }}>
                        {customBranding.customLogo ? (
                          <img 
                            src={customBranding.customLogo}
                            alt="Logo" 
                            style={{ 
                              width: 48, 
                              height: 48, 
                              objectFit: 'contain',
                              marginBottom: 16,
                              opacity: 0.5 }}
                          />
                        ) : (
                          <PhotoCamera sx={{ 
                            fontSize: 48, 
                            color: alpha(customBranding.color, 0.5),
                            mb: 2 }} />
                        )}
                        <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                          {profession === 'photographer' && 'Ingen fotografiprosjekter ennå'}
                          {profession === 'videographer' && 'Ingen videoprosjekter ennå'}
                          {profession === 'music_producer' && 'Ingen musikkprosjekter ennå'}
                          {profession === 'vendor' && 'Ingen produkter ennå'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          {professionSupports('camera_projects') && 'Opprett ditt første prosjekt for å komme i gang'}
                          {profession === 'videographer' && 'Opprett ditt første videoprosjekt for å komme i gang'}
                          {profession === 'music_producer' && 'Opprett ditt første musikkprosjekt for å komme i gang'}
                          {profession === 'vendor' && 'Vent på din første bestilling'}
                        </Typography>
                        <Button variant="contained"
                          startIcon={profession === 'photographer' || profession === 'admin' ? <PhotoCamera /> : <AddCircle />}
                          onClick={() => {
                            trackButtonClick('ny_prosjekt_knapp_dashboard', { 
                              profession, 
                              dashboard: 'universal', 
                              tab: 'dashboard_main',
                              component: 'project_button_dashboard'
                            });
                            if (professionSupports('vendor_products')) {
                          setShowVendorProductDialog(true);
                        } else {
                            setShowProjectCreation(true);
                            }
                          }}
                          sx={{
                            backgroundColor: customBranding.color, '&:hover': { backgroundColor: alpha(customBranding.color, 0.8) }
                          }}
                      >
                          {profession === 'photographer' && 'Opprett Fotografiprosjekt'}
                          {profession === 'videographer' && 'Opprett Videoprosjekt'}
                          {profession === 'music_producer' && 'Opprett Musikkprosjekt'}
                          {profession === 'vendor' && 'Opprett Produkt'}
                        </Button>
                      </MuiCard>
                    )}
                  </Box>
                </Grid>

                {/* Project Timeline Section - Premium Design */}
                <Grid item xs={12}>
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 3 }}>
                      <Typography variant="h6" 
                        sx={{ 
                          fontWeight: 70,
                          fontSize: { xs: '1.1rem', sm: '1.25rem' },
                          background: `linear-gradient(135deg, ${customBranding.color}, #FF8C00)`,
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          color: theming.colors.primary
                        }}>
                        <TimelineIcon sx={{ color: customBranding.color }} />
                        Prosjekt Tidslinje
                      </Typography>
                    </Box>

                    <MuiCard sx={{
                      background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.9) 0%, rgba(2, 5, 5,255,255,0.95) 100%)',
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${alpha(customBranding.color, 0.2)}`,
                      borderRadius: 3,
                      overflow: 'hidden',
                      transition: 'all 0.3s ease','&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 20px 40px ${alpha(customBranding.color, 0.15)}`,
                        border: `1px solid ${alpha(customBranding.color, 0.3)}`
                  }
                }}>
                      <MuiCardContent sx={{ p: 3 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500}}>
                          Administrer milepæler, frister, møter og viktige hendelser for dine prosjekter. Alt koblet sammen.
                        </Typography>
                      
                        <MuiTabs 
                          value={selectedTimelineTab}
                          onChange={handleTimelineTabChange}
                          sx={{
                            mb: 3,
                            '& .MuiTab-root': {
                              fontWeight: 600,
                              textTransform: 'none',
                              minHeight: 48, '&.Mui-selected': {
                                color: customBranding.color
                              }
                            }, '& .MuiTabs-indicator': {
                              backgroundColor: customBranding.color,
                              height: 3,
                              borderRadius: 2
                            }
                          }}
                        >
                          <Tab label="Timeline" />
                          <Tab label="Google Møter" />
                        </MuiTabs>

                      {selectedTimelineTab === 0 && (
                        <ProjectTimeline
                          selectedProject={selectedProject}
                          onProjectSelect={setSelectedProject} 
                          projectId={selectedProject?.id || userId}
                          profession={profession}
                        />
                      )}
                      
                      {selectedTimelineTab === 1 && (
                        <GoogleWorkspaceMeetingManager 
                          profession={profession as any}
                          isOpen={false}
                          onClose={() => {}}
                        />
                        )}
                      </MuiCardContent>
                    </MuiCard>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Community Tab - Tab 2 for photographer, videographer, music_producer (NOT vendor) */}
          {profession !== 'vendor' && (
            <TabPanel value={tabValue} index={2}>
              <CommunityHub userId={userId} profession={profession} />
            </TabPanel>
          )}

          {/* Universal Contract System - Tab 3 for ALL professions */}
          <TabPanel value={tabValue} index={3}>
            <UniversalContractHub
              profession={profession as 'photographer' | 'videographer' | 'music_producer'}
              userId={userId}
              selectedClient={selectedClient as any}
            />
          </TabPanel>

          {/* Dynamically render tabs based on profession */}
          {profession === 'photographer' ? (
            <>
              {/* Tab 4: Bryllupstidslinje */}
              <TabPanel value={tabValue} index={4}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <MuiTabs 
                      value={selectedTimelineTab}
                      onChange={handleTimelineTabChange}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 600,
                          color: 'text.secondary','&.Mui-selected': {
                            color: '#999',
                          }
                        }, '& .MuiTabs-indicator': {
                          backgroundColor: '#',
                          }
                      }}
                    >
                      <Tab 
                        label="Administrer Tidslinje" 
                        icon={<Event />}
                        iconPosition="start"
                      />
                      <Tab 
                        label="Klientoversikt" 
                        icon={<Visibility />}
                        iconPosition="start"
                      />
                      <Tab 
                        label="Klientvisning (Live)" 
                        icon={<Key />}
                        iconPosition="start"
                      />
                      <Tab 
                        label="Endringsoversikt" 
                        icon={<TimelineIcon />}
                        iconPosition="start"
                      />
                    </MuiTabs>
                  </Box>

                  {selectedTimelineTab === 0 && (
                    <WeddingTimelineAdmin 
                      projectId={projects?.[0]?.id || userId}
                      projectIntegration={{
                        projectId: projects?.[0]?.id,
                        weddingTimelineIntegrated: true,
                        culturalType: 'norsk'
                      }}
                    />
                  )}

                  {selectedTimelineTab === 1 && (
                    // @ts-ignore - Component return type issue in source file
                    <WeddingTimelineOverview 
                      photographerId={userId}
                    />
                  )}

                  {selectedTimelineTab === 2 && (
                    // @ts-ignore - Component return type issue in source file
                    <WeddingTimelineClientView 
                      timelineId={userId} // Real user timeline ID
                      isPhotographer={true}
                      photographerId={userId}
                    />
                  )}

                  {selectedTimelineTab === 3 && (
                    <WeddingTimelineChangesOverview userId={userId} />
                  )}
                </Box>
              </TabPanel>

              {/* Tab 4: Showcase Admin */}
              <TabPanel value={tabValue} index={4}>
                <Box sx={{ p: 0 }}>
                  {/* @ts-ignore - Component return type issue in source file */}
                  <ShowcaseAdmin userId={userId} profession={profession} />
                </Box>

              </TabPanel>

              {/* Tab 5: Universal Showcase Viewer */}
              <TabPanel value={tabValue} index={5}>
                <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <UniversalShowcase
                    profession={profession}
                    userId={userId}
                    maxItems={50}
                    enableGoogleDriveSync={true}
                    enableAIAnalysis={true}
                    enableAutoTagging={true}
                    enableSmartCollections={true}
                    enableRealTimeSync={true}
                    collaborationSessionId={`${profession}-${userId}-showcase`}
                    onItemSelect={(item) => {
                      // Broadcast item selection to other components
                      console.log('Item selected: ', item);
                    }}
                    onItemUpdate={(item) => {
                      // Handle item updates
                      console.log('Item updated:', item);
                    }}
                    onItemDelete={(item) => {
                      // Handle item deletion
                      console.log('Item deleted:', item);
                    }}
                  />
                </Box>
              </TabPanel>

              {/* Tab 6: Universal Download Manager */}
              <TabPanel value={tabValue} index={6}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <UniversalDownload
                    items={[]}
                    profession={profession}
                    enableGoogleDriveSync={true}
                    enableAIAnalysis={true}
                    enableAutoTagging={true}
                    enableSmartCollections={true}
                    enableRealTimeSync={true}
                    enableBatchDownload={true}
                    enableZipDownload={true}
                    enableProgressTracking={true}
                    collaborationSessionId={`${profession}-${userId}-downloads`}
                    onItemSelect={(item) => {
                      console.log('Download item selected:', item);
                    }}
                    onItemUpdate={(item) => {
                      console.log('Download item updated:', item);
                    }}
                    onItemDelete={(item) => {
                      console.log('Download item deleted:', item);
                    }}
                  />
                </Box>
              </TabPanel>

              {/* Tab 7: Universal File Upload */}
              <TabPanel value={tabValue} index={7}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <UniversalFileUpload
                    profession={profession}
                    enableGoogleDriveSync={true}
                    enableAIAnalysis={true}
                    enableAutoTagging={true}
                    enableSmartCollections={true}
                    enableRealTimeSync={true}
                    enableMultipleFiles={true}
                    enableDragDrop={true}
                    collaborationSessionId={`${profession}-${userId}-upload`}
                    onItemSelect={(item) => {
                      console.log('Upload item selected:', item);
                    }}
                    onItemUpdate={(item) => {
                      console.log('Upload item updated:', item);
                    }}
                    onItemDelete={(item) => {
                      console.log('Upload item deleted:', item);
                    }}
                  />
                </Box>
              </TabPanel>

              {/* Tab 8: AI Forbedring - Photo Enhancement Suite */}
              <TabPanel value={tabValue} index={8}>
                <PhotoEnhancementSuite 
                  userId={userId} 
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />
              </TabPanel>

              {/* Tab 9: E-post - Integrated Email Center */}
              <TabPanel value={tabValue} index={9}>
                <SmartEmailCenter profession={profession} userId={userId} />
              </TabPanel>

              {/* Tab 10: Worklog */}
              <TabPanel value={tabValue} index={10}>
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: theme.palette.primary.main, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                    📝 Google Keep Arbeidslogg
                    <Chip label="AKTIVT" size="small" sx={{ bgcolor: '#4caf50', color: 'white', fontSize: '0.7rem', height: 20 }} />
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem', mt: 1 }}>
                    Alle arbeidslogger synkroniseres automatisk til Google Keep for sikker lagring og enkel tilgang fra alle enheter.
                  </Typography>
                </Box>
              </TabPanel>

              {/* Tab 11: Kunder - Universal CRM System with Pricing */}
              <TabPanel value={tabValue} index={11}>
                <Box sx={{ p: 3 }}>
                  
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <MuiTabs 
                      value={selectedTimelineTab}
                      onChange={handleTimelineTabChange}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 600,
                          color: 'text.secondary','&.Mui-selected': {
                            color: customBranding.color,
                          }
                        }, '& .MuiTabs-indicator': {
                            backgroundColor: customBranding.color
                                }
                      }}
                    >
                      <Tab 
                        label="Kundehåndtering" 
                        icon={<Person />}
                        iconPosition="start"
                      />
                      <Tab 
                        label="Prisadministrasjon" 
                        icon={<AttachMoney />}
                        iconPosition="start"
                      />
                      <Tab 
                        label="Google Møter" 
                        icon={<Event />}
                        iconPosition="start"
                      />
                    </MuiTabs>
                  </Box>

                  {selectedTimelineTab === 0 && (
                    <Grid container spacing={3}>
                      {/* CRM Dashboard Section */}
                      <Grid item xs={12}>
                        <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)', height: 'fit-content' }}>
                          <MuiCardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                              <Person sx={{ mr: 1, fontSize: 28, color: customBranding.color }} />
                              Kundehåndtering
                            </Typography>
                            <UniversalCRMDashboard 
                              profession={profession}
                              onCustomerSelect={(customer) => {
                                // Real customer selected from CRM
                                // Handle customer selection - could open details modal, etc.
                              }}
                            />
                          </MuiCardContent>
                        </MuiCard>
                      </Grid>
                    </Grid>
                  )}
                  
                  {selectedTimelineTab === 1 && (
                    <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                      <MuiCardContent>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                          <AttachMoney sx={{ mr: 1, fontSize: 28, color: customBranding.color }} />
                          Prisadministrasjon
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Administrer alle dine priser, pakker og tilbud på ett sted.
                        </Typography>
                        <PriceAdministration />
                      </MuiCardContent>
                    </MuiCard>
                  )}
                  
                  {selectedTimelineTab === 2 && (
                    <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)', height: 'fit-content' }}>
                      <MuiCardContent>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                          <Event sx={{ mr: 1, fontSize: 28, color: customBranding.color }} />
                          Google Workspace Møter
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Administrer møter og del showcase-linker direkte med kunder.
                        </Typography>
                        <GoogleWorkspaceMeetingManager 
                          profession={profession}
                          isOpen={false}
                          onClose={() => {}}
                        />
                      </MuiCardContent>
                    </MuiCard>
                  )}
                </Box>
              </TabPanel>

              {/* Tab 12: Utstyr (Equipment Management) */}
              <TabPanel value={tabValue} index={12}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <EnhancedGearTab
                    profession={getComponentProfession(profession, 'musicproducer') as any}
                    className="enhanced-equipment-tab"
                  />
                </Box>
              </TabPanel>

              {/* Tab 13: Filer */}
              <TabPanel value={tabValue} index={13}>
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Files Tab - Temporarily Disabled
                  </Typography>
                </Box>
              </TabPanel>

              {/* Tab 14: Support */}
              <TabPanel value={tabValue} index={14}>
                <HelpdeskSystem profession={profession} userId={userId} dashboardFeatures={[]} />
              </TabPanel>

              {/* Tab 15: Innstillinger */}
              <TabPanel value={tabValue} index={15}>
                <Box>
                  
                  {/* Settings Sub-Tabs */}
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                      <MuiTabs 
                        value={settingsTabValue}
                        onChange={handleSettingsTabChange}
                        aria-label="innstillinger tabs"
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                          '& .MuiTab-root': {
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            fontWeight: 50,
                            minWidth: 10, '&.Mui-selected': {
                              color: customBranding.color,
                              fontWeight: 60
                            }
                          }, '& .MuiTabs-indicator': {
                            backgroundColor: customBranding.color,
                            height: 3,
                            borderRadius: '3px 3px 0 0'
                          }
                        }}
                      >
                        <Tab 
                          icon={<Business />}
                          label="Bedriftsprofil" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<AttachMoney />}
                          label="Prisadministrasjon" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<CloudDone />}
                          label="Backup & Sync" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Quiz />}
                          label="FAQ Veiledninger" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Store />}
                          label="Marketplace" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        {/* Wedding Timeline tab kun for fotografer */}
                        {profession === 'photographer' && (
                          <Tab 
                            icon={<WeddingIcon />}
                            label="Bryllupstidslinje" 
                            iconPosition="start"
                            sx={{ gap: 1 }}
                          />
                        )}
                      </MuiTabs>
                    </Box>

                    {/* Settings Tab Content */}
                    <TabPanel value={settingsTabValue} index={0}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent sx={{ p: { xs: 2, md: 3 } }}>
                          <Box sx={{ textAlign: 'center', mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, color: theming.colors.primary }}>
                              <Business sx={{ color: customBranding.color, fontSize: '1.5rem' }} />
                              Bedriftsprofil & Logo
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Din merkevareidentitet og bedriftsinformasjon
                            </Typography>
                          </Box>
                          
                          <Box sx={{ 
                            p: 3,
                            borderRadius: 2,
                            bgcolor: 'rgba(28, 250, 252, 0.8)',
                            border: '1px solid rgba(0,0,0,0.05)'
                          }}>
                            <BusinessBrandingSettings userId={userId} />
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={1}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <AttachMoney sx={{ color: customBranding.color }} />
                            Prisadministrasjon
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Administrer prispakker, kategorier og generer tilbud for kunder.
                          </Typography>
                          <PriceAdministration />
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={2}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <CloudDone sx={{ color: theme.palette.primary.main }} />
                            Google Drive & Backup
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Automatisk backup og synkronisering med din Google Drive - Standardisert 8-mappestruktur.
                          </Typography>
                          
                          {/* Google Drive Manager with 8-folder structure */}
                          <GoogleDriveManager 
                            userId={userId}
                            profession={profession}
                          />
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Google Drive Project Sync */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Storage sx={{ color: theme.palette.primary.main }} />
                              Prosjektsynkronisering
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Automatisk synkronisering av prosjektmapper med standardisert struktur: </Typography>
                            <Box sx={{ ml: 2, mb: 2 }}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#666'}}>
                                • RAW - Originale bilder<br/>
                                • Bearbeidede bilder<br/>
                                • Leveranse til klient<br/>
                                • Kontrakter og dokumenter<br/>
                                • Kommunikasjon<br/>
                                • Timeline og notater<br/>
                                • Backup og sikkerhetskopier<br/>
                                • Referansebilder og inspirasjon
                              </Typography>
                            </Box>
                            <GoogleDriveProjectSync userId={userId} />
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={3}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Quiz sx={{ color: customBranding.color }} />
                            FAQ Veiledninger
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Tilgang til godkjente tutorials og veiledninger fra CreatorHub Norge community.
                          </Typography>
                          <Button variant="contained"
                            onClick={handleShowFAQDialog}
                            sx={{
                              background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`,
                              '&:hover': { transform: 'translateY(-2px)' }
                            }}
                            startIcon={<Quiz />}
                          >
                            Åpne FAQ Bibliotek
                          </Button>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    {/* Marketplace Tab */}
                    <TabPanel value={settingsTabValue} index={4}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Store sx={{ color: customBranding.color }} />
                            Marketplace - Oppdag Nye Verktøy
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Utvid funksjonaliteten din med kraftige verktøy og integrasjoner. Alle verktøyene er testet og klar for produksjon.
                          </Typography>
                          
                          {/* Featured App: ResumeBuilder */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              ⭐ Featured App
                            </Typography>
                            <CreatorHubMarketplace 
                              onSelect={() => {
                                // Navigate to ResumeBuilder
                                window.location.href = '/resume-builder';
                              }}
                              showPricing={true}
                            />
                          </Box>

                          <Divider sx={{ my: 3 }} />

                          {/* Coming Soon Section */}
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Store sx={{ fontSize: 48, color: alpha(customBranding.color, 0.3), mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              Flere verktøy kommer snart
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Vi jobber kontinuerlig med å legge til nye verktøy og integrasjoner.
                            </Typography>
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    {/* Wedding Timeline Tab - kun for fotografer */}
                    {profession === 'photographer' && (
                      <TabPanel value={settingsTabValue} index={5}>
                        <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                          <MuiCardContent>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <WeddingIcon sx={{ color: customBranding.color }} />
                              Bryllupstidslinje Administrasjon
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                              Administrer bryllupstidslinjer for dine prosjekter med kulturtilpasning og klienttilgang.
                            </Typography>
                            <WeddingTimelineOverview 
                              photographerId={userId} // Pass the current user's ID
                            />
                          </MuiCardContent>
                        </MuiCard>
                      </TabPanel>
                    )}
                  </Box>
                </Box>
              </TabPanel>

              {/* Tab 12: Kommunikasjon */}
              <TabPanel value={tabValue} index={12}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Tab 10: Filer */}
              <TabPanel value={tabValue} index={10}>
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Files Tab - Temporarily Disabled
                  </Typography>
                </Box>
              </TabPanel>

              {/* Tab 11: Innstillinger */}
              <TabPanel value={tabValue} index={11}>
                <Box>
                  {/* Settings Sub-Tabs - Same structure as before */}
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                      <MuiTabs 
                        value={settingsTabValue}
                        onChange={handleSettingsTabChange}
                        aria-label="innstillinger tabs"
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                          '& .MuiTab-root': {
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            fontWeight: 50,
                            minWidth: 10, '&.Mui-selected': {
                              color: customBranding.color,
                              fontWeight: 60
                            }
                          }, '& .MuiTabs-indicator': {
                            backgroundColor: customBranding.color,
                            height: 3,
                            borderRadius: '3px 3px 0 0'
                          }
                        }}
                      >
                        <Tab label="Prisadministrasjon" />
                        <Tab label="Forretningsprofil" />
                        <Tab label="Minneskortpriser" />
                        <Tab label="Google Drive" />
                        <Tab label="BRREG Integration" />
                      </MuiTabs>
                    </Box>

                    {settingsTabValue === 0 && (
                      <PriceAdministration profession={profession} userId={userId} />
                    )}
                    {settingsTabValue === 1 && (
                      <BusinessBrandingSettings userId={userId} />
                    )}
                    {settingsTabValue === 2 && (
                      <MemoryCardPricingAdmin />
                    )}
                    {settingsTabValue === 3 && (
                      <GoogleDriveManager userId={userId} profession={profession} />
                    )}
                    {settingsTabValue === 4 && (
                      <BRREGIntegration />
                    )}
                  </Box>
                </Box>
              </TabPanel>

              {/* Tab 16: Kommunikasjon */}
              <TabPanel value={tabValue} index={16}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Tab 17: Integration Test */}
              <TabPanel value={tabValue} index={17}>
                <UniversalDashboardIntegrationTest />
              </TabPanel>
            </>
          ) : profession === 'videographer' ? (
            <>
              {/* Tab 3: Bryllupstidslinje */}
              <TabPanel value={tabValue} index={3}>
                <Box>
                    <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theming.colors.primary }}>
                    Bryllupstidslinje
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Det fullstendige bryllupstidslinje-systemet er tilgjengelig som en egen modul.
                    Tilgang til detaljert scheduling, milepæler, vendor management, og automatiske påminnelser
                    med Google Drive integrasjon.
                  </Typography>
                    <Button variant="contained"
                      startIcon={<Event />}
                    href="/wedding-timeline"
                    sx={{
                      bgcolor: customBranding.color,
                      '&:hover': { bgcolor: customBranding.color + 'dd' }
                    }}
                  >
                    Åpne Bryllupstidslinje
                  </Button>
                </Box>
              </TabPanel>

              {/* Tab 4: Showcase Admin - For videographers */}
              <TabPanel value={tabValue} index={4}>
                <ShowcaseAdmin userId={userId} profession={profession} />
              </TabPanel>

              {/* Tab 5: Universal Showcase Viewer - For videographers */}
              <TabPanel value={tabValue} index={5}>
                <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <UniversalShowcase
                    profession={profession}
                    userId={userId}
                    maxItems={50}
                    enableGoogleDriveSync={true}
                    enableAIAnalysis={true}
                    enableAutoTagging={true}
                    enableSmartCollections={true}
                    enableRealTimeSync={true}
                    collaborationSessionId={`${profession}-${userId}-showcase`}
                    onItemSelect={(item) => {
                      // Broadcast item selection to other components
                      console.log('Item selected:', item);
                    }}
                    onItemUpdate={(item) => {
                      // Handle item updates
                      console.log('Item updated:', item);
                    }}
                    onItemDelete={(item) => {
                      // Handle item deletion
                      console.log('Item deleted:', item);
                    }}
                  />
                </Box>
              </TabPanel>

              {/* Tab 6: Universal Download Manager - For videographers */}
              <TabPanel value={tabValue} index={6}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <UniversalDownload
                    items={[]}
                    profession={profession}
                    enableGoogleDriveSync={true}
                    enableAIAnalysis={true}
                    enableAutoTagging={true}
                    enableSmartCollections={true}
                    enableRealTimeSync={true}
                    enableBatchDownload={true}
                    enableZipDownload={true}
                    enableProgressTracking={true}
                    collaborationSessionId={`${profession}-${userId}-downloads`}
                    onItemSelect={(item) => {
                      console.log('Download item selected:', item);
                    }}
                    onItemUpdate={(item) => {
                      console.log('Download item updated:', item);
                    }}
                    onItemDelete={(item) => {
                      console.log('Download item deleted:', item);
                    }}
                  />
                </Box>
              </TabPanel>

              {/* Tab 7: Universal File Upload - For videographers */}
              <TabPanel value={tabValue} index={7}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <UniversalFileUpload
                    profession={profession}
                    enableGoogleDriveSync={true}
                    enableAIAnalysis={true}
                    enableAutoTagging={true}
                    enableSmartCollections={true}
                    enableRealTimeSync={true}
                    enableMultipleFiles={true}
                    enableDragDrop={true}
                    collaborationSessionId={`${profession}-${userId}-upload`}
                    onItemSelect={(item) => {
                      console.log('Upload item selected:', item);
                    }}
                    onItemUpdate={(item) => {
                      console.log('Upload item updated:', item);
                    }}
                    onItemDelete={(item) => {
                      console.log('Upload item deleted:', item);
                    }}
                  />
                </Box>
              </TabPanel>

              {/* Tab 8: Video AI - Advanced Video Enhancement */}
              <TabPanel value={tabValue} index={8}>
                <PhotoEnhancementSuite 
                  userId={userId} 
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />
                <Box sx={{ mt: 3 }}>
                  <AudioEnhancementSuite 
                    userId={userId}
                    selectedProject={selectedProject}
                    onProjectSelect={setSelectedProject}
                  />
                </Box>
              </TabPanel>

              {/* Tab 9: E-post - Integrated Email Center */}
              <TabPanel value={tabValue} index={9}>
                <SmartEmailCenter profession={profession} userId={userId} />
              </TabPanel>

              {/* Tab 10: Worklog */}
              <TabPanel value={tabValue} index={10}>
                <UniversalWorklog 
                  projectId={userId}
                  userId={userId}
                  profession={getComponentProfession(profession) as any}
                />
              </TabPanel>

              {/* Tab 11: Kunder */}
              <TabPanel value={tabValue} index={11}>
                <ProfessionAdapter profession={profession as any} tabIndex={7} projectId={userId} />
              </TabPanel>

              {/* Tab 12: Utstyr */}
              <TabPanel value={tabValue} index={12}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <EnhancedGearTab
                    profession={getComponentProfession(profession, 'musicproducer') as any}
                    className="enhanced-equipment-tab"
                  />
                </Box>
              </TabPanel>

              {/* Tab 10: Filer */}
              <TabPanel value={tabValue} index={10}>
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Files Tab - Temporarily Disabled
                  </Typography>
                </Box>
              </TabPanel>

              {/* Tab 11: Innstillinger */}
              <TabPanel value={tabValue} index={11}>
                <Box>
                  {/* Settings Sub-Tabs - Same structure as photographer */}
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                      <MuiTabs 
                        value={settingsTabValue}
                        onChange={handleSettingsTabChange}
                        aria-label="innstillinger tabs"
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                          '& .MuiTab-root': {
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            fontWeight: 50,
                            minWidth: 10, '&.Mui-selected': {
                              color: customBranding.color,
                              fontWeight: 60
                            }
                          }, '& .MuiTabs-indicator': {
                            backgroundColor: customBranding.color,
                            height: 3,
                            borderRadius: '3px 3px 0 0'
                          }
                        }}
                      >
                        <Tab 
                          icon={<Business />}
                          label="Bedriftsprofil" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<AttachMoney />}
                          label="Prisadministrasjon" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<CloudDone />}
                          label="Backup & Sync" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Quiz />}
                          label="FAQ Veiledninger" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Store />}
                          label="Marketplace" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                      </MuiTabs>
                    </Box>

                    {/* Settings Tab Content */}
                    <TabPanel value={settingsTabValue} index={0}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Business sx={{ color: customBranding.color }} />
                            Bedriftsprofil & Logo
                          </Typography>
                          <BusinessBrandingSettings userId={userId} />
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={1}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <AttachMoney sx={{ color: customBranding.color }} />
                            Prisadministrasjon
                          </Typography>
                          <PriceAdministration />
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={2}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <CloudDone sx={{ color: theme.palette.primary.main }} />
                            Google Drive & Backup
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Automatisk backup og synkronisering med standardisert 8-mappestruktur.
                          </Typography>
                          <GoogleDriveManager 
                            userId={userId}
                            profession={profession}
                          />
                          
                          <Divider sx={{ my: 3 }} />
                          
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <Build color="primary" />
                              Profesjonelle Verktøy
                            </Typography>
                            
                            <Box sx={{ mb: 2 }}>
                              <UniversalOAuthIntegration compact={false} userProfession={profession as any} />
                            </Box>

                            <IntegratedToolsOverview profession={profession as any} compact />
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={3}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Quiz sx={{ color: customBranding.color }} />
                            FAQ Veiledninger
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Tilgang til godkjente tutorials og veiledninger fra CreatorHub Norge community.
                          </Typography>
                          <Button variant="contained"
                            onClick={handleShowFAQDialog}
                            sx={{
                              background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`,
                              '&:hover': { transform: 'translateY(-2px)' }
                            }}
                            startIcon={<Quiz />}
                          >
                            Åpne FAQ Bibliotek
                          </Button>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    {/* Marketplace Tab */}
                    <TabPanel value={settingsTabValue} index={4}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Store sx={{ color: customBranding.color }} />
                            Marketplace - Oppdag Nye Verktøy
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Utvid funksjonaliteten din med kraftige verktøy og integrasjoner. Alle verktøyene er testet og klar for produksjon.
                          </Typography>
                          
                          {/* Featured App: ResumeBuilder */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              ⭐ Featured App
                            </Typography>
                            <CreatorHubMarketplace 
                              onSelect={() => {
                                // Navigate to ResumeBuilder
                                window.location.href = '/resume-builder';
                              }}
                              showPricing={true}
                            />
                          </Box>

                          <Divider sx={{ my: 3 }} />

                          {/* Coming Soon Section */}
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Store sx={{ fontSize: 48, color: alpha(customBranding.color, 0.3), mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              Flere verktøy kommer snart
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Vi jobber kontinuerlig med å legge til nye verktøy og integrasjoner.
                            </Typography>
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>
                  </Box>
                </Box>
              </TabPanel>

              {/* Tab 12: Kommunikasjon */}
              <TabPanel value={tabValue} index={12}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Tab 13: Integration Test */}
              <TabPanel value={tabValue} index={13}>
                <UniversalDashboardIntegrationTest />
              </TabPanel>
            </>
          ) : (
            <>
              {/* For other professions without wedding-timeline and showcase */}
              <TabPanel value={tabValue} index={2}>
                <UniversalWorklog 
                  projectId={userId}
                  userId={userId}
                  profession={getComponentProfession(profession) as any}
                />
              </TabPanel>

              {/* Tab 3: Universal Showcase for Music Producers, CRM for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={3}>
                  <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <UniversalShowcase
                      profession={profession}
                      userId={userId}
                      maxItems={50}
                    />
                  </Box>
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={3}>
                  <UniversalCRMDashboard 
                    profession={profession}
                    onCustomerSelect={(customer) => {
                      // Real customer selected from CRM system
                      // Handle customer selection - could open details modal, etc.
                }}
                  />
                </TabPanel>
              )}

              {/* Tab 3.5: Split Sheets for Music Producers only */}
              {(profession as string) === 'music_producer' && (() => {
                const splitSheetsTabIndex = config.tabs.findIndex(tab => tab.id === 'split-sheets');
                return splitSheetsTabIndex >= 0 ? (
                  <TabPanel value={tabValue} index={splitSheetsTabIndex}>
                    <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                      <SplitSheetManager
                        profession={profession}
                        userId={userId}
                      />
                    </Box>
                  </TabPanel>
                ) : null;
              })()}

              {/* Tab 4: Universal Downloads for Music Producers, Equipment for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={4}>
                  <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <UniversalDownload
                      items={[]}
                      profession={profession}
                    />
                  </Box>
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={4}>
                  <ProfessionAdapter profession={profession as any} tabIndex={4} projectId={userId} />
                </TabPanel>
              )}

              {/* Tab 5: Universal File Upload for Music Producers, Files for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={5}>
                  <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <UniversalFileUpload
                      profession={profession}
                    />
                  </Box>
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={5}>
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Files Tab - Temporarily Disabled
                  </Typography>
                </Box>
                </TabPanel>
              )}

              {/* Tab 6: Audio AI for Music Producers, CRM for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={6}>
                  <AudioEnhancementSuite 
                    userId={userId}
                    selectedProject={selectedProject}
                    onProjectSelect={setSelectedProject}
                  />
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={6}>
                  <ProfessionAdapter profession={profession as any} tabIndex={6} projectId={userId} />
                </TabPanel>
              )}

              <TabPanel value={tabValue} index={7}>
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Files Tab - Temporarily Disabled
                  </Typography>
                </Box>
              </TabPanel>

              <TabPanel value={tabValue} index={8}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                    Google Drive Integrasjon
                  </Typography>
                  <GoogleDriveManager 
                    userId={userId}
                    profession={profession as any}
                  />
                  
                  <Box sx={{ mt: 3 }}>
                    <GoogleDriveProjectSync 
                      userId={userId}
                    />
                  </Box>
                </Box>
                
                <Divider sx={{ my: 3 }} />
                
                {/* Tilgjengelige Verktøy Section - moved to settings */}
                <Box sx={{ mb: 3 }}>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                    <Build color="primary" />
                    Tilgjengelige Verktøy
                  </Typography>
                  
                  {/* OAuth Integration */}
                  <Box sx={{ mb: 2 }}>
                    <UniversalOAuthIntegration compact={false} userProfession={profession as any} />
                  </Box>

                  <IntegratedToolsOverview profession={profession as any} />
                </Box>
                
                <Divider sx={{ my: 3 }} />
              </TabPanel>

              {/* Communication Tab - NO MOCK DATA */}
              <TabPanel value={tabValue} index={8}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Integration Test Tab */}
              <TabPanel value={tabValue} index={13}>
                <UniversalDashboardIntegrationTest />
              </TabPanel>

              {/* Tab 11: Innstillinger - Vendor Implementation */}
              <TabPanel value={tabValue} index={11}>
                <Box>
                  {/* Settings Sub-Tabs - Same structure as other professions */}
                  <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                      <MuiTabs 
                        value={settingsTabValue}
                        onChange={handleSettingsTabChange}
                        aria-label="innstillinger tabs"
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                          '& .MuiTab-root': {
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            fontWeight: 50,
                            minWidth: 10, '&.Mui-selected': {
                              color: customBranding.color,
                              fontWeight: 60
                            }
                          }, '& .MuiTabs-indicator': {
                            backgroundColor: customBranding.color,
                            height: 3,
                            borderRadius: '3px 3px 0 0'
                          }
                        }}
                      >
                        <Tab 
                          icon={<Business />}
                          label="Bedriftsprofil" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<AttachMoney />}
                          label="Prisadministrasjon" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<CloudDone />}
                          label="Backup & Sync" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Quiz />}
                          label="FAQ Veiledninger" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Store />}
                          label="Marketplace" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                        <Tab 
                          icon={<Settings />}
                          label="Brukerpreferanser" 
                          iconPosition="start"
                          sx={{ gap: 1 }}
                        />
                      </MuiTabs>
                    </Box>

                    {/* Settings Tab Content */}
                    <TabPanel value={settingsTabValue} index={0}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Business sx={{ color: customBranding.color }} />
                            Bedriftsprofil & Logo
                          </Typography>
                          <BusinessBrandingSettings userId={userId} />
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={1}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <AttachMoney sx={{ color: customBranding.color }} />
                            Prisadministrasjon
                          </Typography>
                          <PriceAdministration />
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={2}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <CloudDone sx={{ color: customBranding.color }} />
                            Backup & Sync
                          </Typography>
                          
                          {/* Google Drive Section */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              Google Drive Integrasjon
                            </Typography>
                            <GoogleDriveManager 
                              userId={userId}
                              profession={profession as any}
                            />
                            
                            <Box sx={{ mt: 3 }}>
                              <GoogleDriveProjectSync 
                                userId={userId}
                              />
                            </Box>
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Tilgjengelige Verktøy Section */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <Build color="primary" />
                              Tilgjengelige Verktøy
                            </Typography>
                            
                            {/* OAuth Integration */}
                            <Box sx={{ mb: 2 }}>
                              <UniversalOAuthIntegration compact={false} userProfession={profession as any} />
                            </Box>

                            <IntegratedToolsOverview profession={profession as any} />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={3}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Quiz sx={{ color: customBranding.color }} />
                            FAQ Veiledninger
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Tilgang til godkjente tutorials og veiledninger fra CreatorHub Norge community.
                          </Typography>
                          <Button variant="contained"
                            onClick={handleShowFAQDialog}
                            sx={{
                              background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`,
                              '&:hover': { transform: 'translateY(-2px)' }
                            }}
                            startIcon={<Quiz />}
                          >
                            Åpne FAQ Bibliotek
                          </Button>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    {/* Marketplace Tab */}
                    <TabPanel value={settingsTabValue} index={4}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Store sx={{ color: customBranding.color }} />
                            Marketplace - Oppdag Nye Verktøy
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Utvid funksjonaliteten din med kraftige verktøy og integrasjoner. Alle verktøyene er testet og klar for produksjon.
                          </Typography>
                          
                          {/* Featured App: ResumeBuilder */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              ⭐ Featured App
                            </Typography>
                            <CreatorHubMarketplace 
                              onSelect={() => {
                                // Navigate to ResumeBuilder
                                window.location.href = '/resume-builder';
                              }}
                              showPricing={true}
                            />
                          </Box>

                          <Divider sx={{ my: 3 }} />

                          {/* Coming Soon Section */}
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Store sx={{ fontSize: 48, color: alpha(customBranding.color, 0.3), mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              Flere verktøy kommer snart
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Vi jobber kontinuerlig med å legge til nye verktøy og integrasjoner.
                            </Typography>
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>

                    <TabPanel value={settingsTabValue} index={5}>
                      <MuiCard sx={{ bgcolor: 'rgba(25,255,255,0.9)' }}>
                        <MuiCardContent>
                          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                            <Settings sx={{ color: customBranding.color }} />
                            Brukerpreferanser
                          </Typography>
                          
                          {/* Keyboard Shortcuts Section */}
                          <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <Keyboard sx={{ color: customBranding.color }} />
                              Tastatursnarveier
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Tilpass tastatursnarveier for dine favorittverktøy og programmer.
                            </Typography>
                            <UniversalKeyboardShortcuts profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor'} />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Smart Timing Preferences */}
                          <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <Schedule sx={{ color: customBranding.color }} />
                              Smart Tidsstyring
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Konfigurer automatisk tidsstyring og arbeidsflytoptimalisering.
                            </Typography>
                            <SmartTimingPreferences profession={profession} userId={userId} />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Notification Preferences */}
                          <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <Notifications sx={{ color: customBranding.color }} />
                              Varslingsinnstillinger
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Velg hvilke varsler du ønsker å motta og hvordan.
                            </Typography>
                            <PushNotificationSettings userId={currentUser?.id || currentUser?.sub} />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Interface Preferences */}
                          <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                              <Palette sx={{ color: customBranding.color }} />
                              Grensesnittinnstillinger
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Tilpass utseende og følelse av plattformen.
                            </Typography>
                            <Box sx={{ p: 2, bgcolor: 'rgba(28, 250, 252, 0.8)', borderRadius: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                Grensesnittinnstillinger kommer snart...
                              </Typography>
                            </Box>
                          </Box>
                        </MuiCardContent>
                      </MuiCard>
                    </TabPanel>
                  </Box>
                </Box>
              </TabPanel>
            </>
          )}

        
            {/* BRREG and Optimization Background Functions */}
            <BRREGIntegration profession={profession as any} mode="background" />
          </MuiCard>
        )}
      </Container>

      {/* UNIFIED FLOATING ACTION SYSTEM - ALL COORDINATED */}
      <FloatingActionButtons 
        profession={profession as any}
        onMeetingNotesOpen={() => {
          setShowQuickNotesModal(true);
        }}

        onAnalyticsOpen={() => {
          // Switch to analytics tab
          setTabValue(profession === 'photographer' ? 7 : 3);
        }}
        onDriveOpen={() => {
          // Switch to Google Drive integration tab
          setTabValue(profession === 'photographer' ? 8 : 7);
        }}
        onNotificationCenterOpen={() => {
          // Open notification center
          setShowNotifications(!showNotifications);
        }}
        onFeedbackOpen={() => {
          // Open prototype testing feedback system
          setShowPrototypeFeedback(true);
        }}
        onEmailDesignerOpen={() => {
          setShowEmailDesigner(true);
        }}
        onProjectWizardOpen={() => {
          setShowProjectModal(true);
        }}
        onMemoryCardRecoveryOpen={() => {
          // Redirect to professional data recovery resources - safe external link
          const link = document.createElement('a');
          link.href = 'https://www.stellarinfo.com/photo-recovery.php';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
        }}
        onPhotographyTipsOpen={() => {
          // This will be handled by the ContextualPhotographyTipsOverlay component
          const event = new CustomEvent('openPhotographyTips');
          window.dispatchEvent(event);
        }}
      />

      {/* Chat Button with Status Indicator */}
      {!showChat && (
        <Box sx={{ position: 'fixed', bottom: 20, right: 100, zIndex: 1300}}>
          {/* Chat System Status Indicator */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 16,
              height: 16,
              borderRadius: '50%',
              backgroundColor: communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#f44336', // Green = Google Chat working (200 OK), Red = not working
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              zIndex: 1301}}
            title={
              communicationStatus.googleChatStatus === 'connected' 
                ? `Google Chat system is online (${communicationStatus.googleChatResponse})` 
                : `Google Chat system is offline (${communicationStatus.googleChatResponse || 'Unknown error'})`
            }
          />
          
          {/* File Management Status Indicators */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 90,
              right: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              alignItems: 'flex-end'
            }}
          >
            {/* Google Drive Status */}
            <Tooltip 
              title={
                fileManagementStatus.googleDriveStatus === 'connected' 
                  ? `Google Drive: ${fileManagementStatus.googleDriveResponse}` 
                  : `Google Drive: ${fileManagementStatus.googleDriveResponse || 'Not tested'}`
          }
              placement="left"
              arrow
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: fileManagementStatus.googleDriveStatus === 'connected' ? '#4caf50' : '#f44336',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}
              />
            </Tooltip>
            
            {/* Google Photos Status */}
            <Tooltip 
              title={
                fileManagementStatus.googlePhotosStatus === 'connected' 
                  ? `Google Photos: ${fileManagementStatus.googlePhotosResponse}` 
                  : `Google Photos: ${fileManagementStatus.googlePhotosResponse || 'Not tested'}`
          }
              placement="left"
              arrow
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: fileManagementStatus.googlePhotosStatus === 'connected' ? '#4caf50' : '#f44336',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}
              />
            </Tooltip>
            
            {/* File System Status */}
            <Tooltip 
              title={
                fileManagementStatus.systemStatus === 'connected' 
                  ? `File System: ${fileManagementStatus.systemHealthy ? 'Healthy' : 'Unhealthy'}` 
                  : `File System: ${fileManagementStatus.systemStatus}`
          }
              placement="left"
              arrow
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: fileManagementStatus.systemStatus === 'connected' ? '#4caf50' : '#f44336',
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}
              />
            </Tooltip>
          </Box>

          {/* Status Text Tooltip */}
          <Tooltip 
            title={
              communicationStatus.googleChatStatus === 'connected' 
                ? "Google Chat is online - Click to start chatting" : "Google Chat is offline - Check system status"
        }
            placement="left"
            arrow
          >
            <Fab
              color="primary"
              aria-label="chat"
              onClick={() => setShowChat(true)}
              sx={{
                width: 70,
                height: 70,
                bgcolor: customBranding.color,
                '&:hover': {
                  bgcolor: (customBranding as any).darkColor || customBranding.color
                }
              }}
            >
              <Chat sx={{ fontSize: 28 }} />
            </Fab>
          </Tooltip>
        </Box>
      )}

      {/* Quick Meeting Notes Modal */}
      <QuickMeetingNotesModal
        isOpen={showQuickNotesModal}
        onClose={() => setShowQuickNotesModal(false)}
        profession={profession as any}
      />

      {/* Universal Project Creation Modal - Enhanced */}
      <Dialog 
        open={showProjectCreation || showProjectModal}
        onClose={(event, reason) => {
          setShowProjectCreation(false);
          setShowProjectModal(false);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'background.default',
            backgroundImage: 'none',
            borderRadius: 3,
            border: `2px solid ${customBranding.color}40`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }
    }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          pb: 1,
          background: `linear-gradient(135deg, ${customBranding.color}15 0%, ${customBranding.color}05 100%)`
    }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            Opprett nytt prosjekt
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {(showProjectCreation || showProjectModal) && (
            <ProjectCreationWithMemoryCards
              profession={profession as any}
              userId={userId}
              initialData={uiSettings.submissionProjectData} // Pass submission data to pre-fill
              onProjectCreated={async (projectData) => {
                // Real project created in database
                setShowProjectCreation(false);
                setShowProjectModal(false);
                // Clear submission data
                setUiSettings(prev => ({ ...prev, submissionProjectData: null }));
                // Refresh dashboard data properly
                await queryClient.invalidateQueries({ queryKey: ['/api/projects', ],});
                queryClient.invalidateQueries({ queryKey: [`/api/dashboard/${profession}`] });
                queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary', userId] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* E-post Designer Modal */}
      <Dialog
        open={showEmailDesigner}
        onClose={() => setShowEmailDesigner(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(2, 5, 5, 255, 255, 0.95) 0%, rgba(2, 5, 5, 255, 255, 0.85) 100%)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(25, 255, 255, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            📧 E-post Designer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Opprett profesjonelle e-poster til kunder
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 2 }}>
          <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600}}>
                📝 E-post mal
              </Typography>
              <Box sx={{ 
                p: 2,
                border: '2px dashed #ddd', 
                borderRadius: 2,
                minHeight: 300,
                bgcolor: 'rgba(25, 255, 255, 0.7)'
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Velg en mal for din e-post:
                </Typography>
                <List>
                  <ListItem sx={{ bgcolor: 'rgba(25, 193, 255, 0.1)', borderRadius: 1, mb: 1 }}>
                    <ListItemIcon>
                      {customBranding.customLogo ? (
                        <img 
                          src={customBranding.customLogo}
                          alt="Logo" 
                          style={{ width: 24, height: 24, objectFit: 'contain' }}
                        />
                      ) : (
                        <PhotoCamera sx={{ color: customBranding.color }} />
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary="Fotografering fullført" 
                      secondary="Send bilder og tidsplan til kunde"
                    />
                  </ListItem>
                  <ListItem sx={{ bgcolor: 'rgba(25, 193, 255, 0.1)', borderRadius: 1, mb: 1 }}>
                    <ListItemIcon>
                      <CalendarToday sx={sharedStyles.brandedText} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Tidsplan oppdatering" 
                      secondary="Informer om endringer i tidsplan"
                    />
                  </ListItem>
                  <ListItem sx={{ bgcolor: 'rgba(25, 193, 255, 0.1)', borderRadius: 1 }}>
                    <ListItemIcon>
                      <AttachMoney sx={{ color: customBranding.color }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Faktura og betaling" 
                      secondary="Send faktura og betalingsinformasjon"
                    />
                  </ListItem>
                </List>
              </Box>
            </Grid>
                    <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 600}}>
                👁️ Forhåndsvisning
              </Typography>
              <Paper sx={{ 
                p: 2,
                minHeight: 300, 
                bgcolor: 'white',
                border: '1px solid #eee'}}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  E-post forhåndsvisning vises her...
                </Typography>
                <Box sx={{ 
                  p: 2,
                  bgcolor: 'rgba(25, 193, 255, 0.05)', 
                  borderRadius: 1,
                  border: '1px dashed rgba(25, 193, 255, 0.3)'
                }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
                    Hei {emailProjectContext?.projectId ? '[Kundenavn]' : '[Kundenavn]'}!
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Takk for at du valgte oss for prosjektet "{emailProjectContext?.projectId ? '[Prosjektnavn]' : '[Prosjektnavn]'}, ".
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {emailProjectContext ? 
                      `Vi har gjort fremskritt på prosjektet og ønsker å holde deg oppdatert.` : 
                      '[E-post innhold kommer her basert på valgt mal]'
                }
                  </Typography>
                  <Typography variant="body2">
                    Med vennlig hilsen,<br />
                    [Ditt navn]<br />
                    CreatorHub Norge
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button variant="contained" 
              sx={{ 
                background: `linear-gradient(135deg, ${customBranding.color} 0%, ${(customBranding as any).secondary || customBranding.color} 100%)`,
                color: 'white',
                px: 4,
                py: 1,
                borderRadius: 2,
                boxShadow: '0 6px 20px rgba(25, 193, 255, 0.3)','&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(25, 193, 255, 0.4)'
                }
              }}
                          onClick={() => {
                // Send e-post logic here
                setShowEmailDesigner(false);
              }}
            >
              📤 Send E-post
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Email Center Modal - Full Screen Photographer Email Features */}
      {showEmailCenter && (
        <Dialog
          open={showEmailCenter}
          onClose={() => setShowEmailCenter(false)}
          maxWidth={false}
          fullWidth
          fullScreen
          PaperProps={{
            sx: {
              m: 0,
              borderRadius: 0,
              maxHeight: '100vh',
              height: '100vh'
            }
          }}
        >
          <SmartEmailCenter 
            profession={profession}
            userId={userId}
          />
        </Dialog>
      )}

      {/* Contextual Photography Tips Overlay - Only for photographers */}
      {profession === 'photographer' && <ContextualPhotographyTipsOverlay />}



      {/* Chat Sidebar */}
      {showChat && (
        <Box
          sx={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: 300,
            zIndex: 120,
            bgcolor: 'background.paper',
            boxShadow: 3,
            transform: showChat ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>💬 Chat</Typography>
              {/* Chat System Status Indicator */}
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#f44336', // Green = Google Chat working (200 OK), Red = not working
                  border: '1px solid white',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                }}
                title={
                  communicationStatus.isConnected && communicationStatus.systemHealthy 
                    ? "Chat system is online and working" : "Chat system is offline or not working"
                }
              />
            </Box>
            <Button onClick={() => setShowChat(false)}>Lukk</Button>
          </Box>
          <UniversalChatWidget 
            profession={profession as any}
            userId={userId}
          />
        </Box>
      )}

      {/* Notification Center Drawer */}
      {showNotifications && (
        <Box
          sx={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: 400,
            zIndex: 120,
            bgcolor: 'background.paper',
            boxShadow: 3,
            transform: showNotifications ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Notifications sx={{ color: theming.colors.primary }} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Varslinger</Typography>
            </Box>
            <Button onClick={() => setShowNotifications(false)}>Lukk</Button>
          </Box>
          <Box sx={{ p: 2 }}>
            {recentNotifications?.length > 0 ? (
              <List>
                {recentNotifications.slice(0, 10).map((notification: Notification, index: number) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {notification.type === 'project' && <NotificationAdd color="primary" />}
                      {notification.type === 'email' && <Email color="info" />}
                      {notification.type === 'backup' && <CloudDone color="success" />}
                      {notification.type === 'meeting' && <Event color="warning" />}
                      {notification.type === 'payment' && <AttachMoney color="success" />}
                      {notification.type === 'download' && <GetApp color="info" />}
                      {!['project','email','backup','meeting','payment','download'].includes(notification.type || ', ') &&
                        <NotificationsActive color="primary" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary={notification.title || 'Ny varsling'}
                      secondary={notification.message || (notification as any).description || 'Ingen detaljer tilgjengelig'}
                    />
                    {notification.timestamp && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {new Date(notification.timestamp).toLocaleDateString('no-NO')}
                      </Typography>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <NotificationsActive sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Ingen nye varslinger
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Du får beskjed her når noe skjer
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Chat/Notification overlay when open */}
      {(showChat || showNotifications) && (
        <Box
          onClick={() => {
            setShowChat(false);
            setShowNotifications(false);
          }}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1100}}
        />
      )}

      {/* Prototype Testing Feedback Component */}
      {showPrototypeFeedback && (
        <UniversalPrototypeFeedback
          profession={profession}
          dashboardType="universal"
          component="dashboard"
          isFloating={false}
          currentTab={config.tabs[tabValue]?.id}
          userEmail={currentUser?.email}
          projectContext={selectedProject}
          equipmentContext={selectedEquipment}
        />
      )}

      {/* Prototype Feedback Modal */}
      <Dialog
        open={showPrototypeFeedback}
        onClose={() => setShowPrototypeFeedback(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(2, 5, 5, 255, 255, 0.95) 0%, rgba(2, 5, 5, 255, 255, 0.85) 100%)',
            backdropFilter: 'blur(15px)',
            border: '1px solid rgba(25, 255, 255, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: theming.colors.primary }}>
            🔬 Prototype Testing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gi tilbakemelding om plattformen
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <UniversalPrototypeFeedback
            profession={profession}
            dashboardType="universal"
            component="dashboard"
            isFloating={false}
            currentTab={config.tabs[tabValue]?.id}
            userEmail={userEmail}
            projectContext={selectedProject}
            equipmentContext={selectedEquipment}
            onClose={() => setShowPrototypeFeedback(false)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPrototypeFeedback(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Creation With Memory Cards Modal */}
      <Dialog
        open={showProjectCreation}
        onClose={() => setShowProjectCreation(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ 
                background: `linear-gradient(135deg, ${customBranding.color} 0%, ${(customBranding as any).secondary || customBranding.color} 100%)`,
          color: 'white',
                        fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 2 }}>
          {profession === 'photographer' || profession === 'admin' ? <PhotoCamera /> : <AddCircle />}
          {profession === 'photographer' && 'Opprett Nytt Fotografiprosjekt'}
          {profession === 'videographer' && 'Opprett Nytt Videoprosjekt'}
          {profession === 'music_producer' && 'Opprett Nytt Musikkprosjekt'}
          {profession === 'vendor' && 'Opprett Nytt Produkt'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <ProjectCreationWithMemoryCards 
            profession={profession}
            userId={userId}
            onProjectCreated={async (projectData) => {
              // Project successfully created with real data
              setShowProjectCreation(false);
              setShowVendorProductDialog(false);
              // Refresh upcoming projects data
              await queryClient.invalidateQueries({ queryKey: ['/api/projects', ],});
              queryClient.invalidateQueries({ queryKey: [`/api/dashboard/${profession}`] }                        );
                      }}
          />
        </DialogContent>
      </Dialog>

      {/* Vendor Product Creation Dialog */}
      {profession === 'vendor' && (
        <Dialog
          open={showVendorProductDialog}
          onClose={() => setShowVendorProductDialog(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: '90vh'
            }
          }}
        >
          <DialogTitle sx={{ 
                background: `linear-gradient(135deg, ${customBranding.color} 0%, ${(customBranding as any).secondary || customBranding.color} 100%)`,
            color: 'white',
                        fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 2 }}>
            <Add />
            Opprett Nytt Produkt
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <VendorProductManager
              userId={userId}
              initialMode="add"
              vendorType={profession === 'vendor' ? userVendorType : profession}
              onProductCreated={() => {
                setShowVendorProductDialog(false);
                // Refresh data
                window.location.reload();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* CRM Client Dialog for Quick Actions */}
      <Dialog
        open={showCrmDialog}
        onClose={() => setShowCrmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
                background: `linear-gradient(135deg, ${customBranding.color} 0%, ${(customBranding as any).secondary || customBranding.color} 100%)`,
          color: 'white',
                        fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 2 }}>
          <Person />
          Klient Informasjon - {selectedClient?.name}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Prosjekt: <strong>{(selectedClient as any)?.projectName || 'Ikke angitt'}</strong>
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Telefon</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666'}}>
                  {selectedClient?.phone || 'Ikke registrert'}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    // Open CRM system to add/edit phone number
                    setTabValue(config.tabs.findIndex(tab => tab.id === 'clients'));
                    setShowCrmDialog(false);
                  }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {selectedClient?.phone ? 'Rediger' : 'Legg til'}
                </Button>
              </Box>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>E-post</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#666'}}>
                  {selectedClient?.email || 'Ikke registrert'}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    // Open email center to add/edit email
                    setShowEmailCenter(true);
                    setShowCrmDialog(false);
                  }}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {selectedClient?.email ? 'Send E-post' : 'Legg til'}
                </Button>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCrmDialog(false)}>
            Lukk
          </Button>
          <Button variant="contained"
                          onClick={() => {
              // Navigate to full CRM/client management
              setTabValue(config.tabs.findIndex(tab => tab.id === 'clients'));
              setShowCrmDialog(false                        );
                      }}
            sx={{ bgcolor: customBranding.color }}
          >
            Åpne Klient Management
          </Button>
        </DialogActions>
      </Dialog>


      {/* Project Management Dialogs */}
      
      {/* Project Details Modal - "Se større" */}
      <Dialog 
        open={showProjectDetailsModal}
        onClose={() => setShowProjectDetailsModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
            <PhotoCamera sx={{ color: customBranding.color }} />
            {selectedProject?.title || selectedProject?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedProject && (
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Klient</Typography>
                  <Typography variant="body1">{selectedProject.clientName || 'Ikke angitt'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={selectedProject.status}
                    color={selectedProject.status === 'Fullført' ? 'success' : selectedProject.status === 'Aktiv' ? 'primary' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Dato</Typography>
                  <Typography variant="body1">
                    {selectedProject.eventDate || selectedProject.date ? 
                      new Date(selectedProject.eventDate || selectedProject.date || ', ').toLocaleDateString('no-NO', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                }) : 'Ikke satt'
                }
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Lokasjon</Typography>
                  <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                    {selectedProject.location || 'Ikke angitt'}
                  </Typography>
                </Grid>
                {selectedProject.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Beskrivelse</Typography>
                    <Typography variant="body1">{selectedProject.description}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectDetailsModal(false)}>
            Lukk
          </Button>
          <Button variant="contained"
            startIcon={<Edit />}
            onClick={() => {
              setShowProjectDetailsModal(false);
              selectedProject && handleEditProject(selectedProject);
            }}
            sx={{ backgroundColor: customBranding.color }}
          >
            Rediger Prosjekt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Project Modal */}
      <Dialog 
        open={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <Edit sx={{ color: customBranding.color }} />
          Rediger Prosjekt
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Prosjektredigering vil bli implementert i neste versjon.
          </Typography>
          {selectedProject && (
            <Typography variant="body1">
              <strong>Prosjekt: </strong> {selectedProject.title || selectedProject.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditProjectModal(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Overview Dialog */}
      <Dialog
        open={projectOverviewOpen}
        onClose={() => setProjectOverviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.95) 0%, rgba(2, 5, 5,255,255,0.98) 100%)',
            backdropFilter: 'blur(10px)',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {selectedProjectForOverview?.projectType === 'story-arc' && <MovieCreation sx={{ color: customBranding.color }} />}
            {selectedProjectForOverview?.projectType === 'photo' && <PhotoCamera sx={{ color: customBranding.color }} />}
            {selectedProjectForOverview?.projectType === 'audio' && <LibraryMusic sx={{ color: customBranding.color }} />}
            {selectedProjectForOverview?.projectType === 'timeline' && <TimelineIcon sx={{ color: customBranding.color }} />}
            <Typography variant="h6" sx={{ fontWeight: 700}}>
              {selectedProjectForOverview?.storyArcName || 
               selectedProjectForOverview?.name || 
               selectedProjectForOverview?.title || 
               selectedProjectForOverview?.filename || 
               'Project Details'}
            </Typography>
          </Box>
          <IconButton onClick={() => setProjectOverviewOpen(false)}>
            <Remove />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ mt: 2 }}>
          {selectedProjectForOverview && (
            <Grid container spacing={3}>
              {/* Project Information */}
              <Grid item xs={12}>
                <MuiCard variant="outlined">
                  <MuiCardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Project Information
                    </Typography>
                    
                    {/* Story Arc Specific */}
                    {selectedProjectForOverview.projectType === 'story-arc' && (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Template Type</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.templateType}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Emotional Curve</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.emotionalCurve}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Target Duration</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.targetDuration}s</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip label={selectedProjectForOverview.status} size="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Created</Typography>
                          <Typography variant="body1">
                            {new Date(selectedProjectForOverview.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        {selectedProjectForOverview.driveFolder && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Drive Folder</Typography>
                            <Button
                              size="small"
                              href={selectedProjectForOverview.driveFolder.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open Folder
                            </Button>
                          </Box>
                        )}
                      </Stack>
                    )}
                    
                    {/* Photo Project Specific */}
                    {selectedProjectForOverview.projectType === 'photo' && (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Client</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.clientName || 'N/A'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Event Date</Typography>
                          <Typography variant="body1">
                            {selectedProjectForOverview.eventDate 
                              ? new Date(selectedProjectForOverview.eventDate).toLocaleDateString()
                              : 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Location</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.location || 'N/A'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Project Type</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.projectType || 'N/A'}</Typography>
                        </Box>
                      </Stack>
                    )}
                    
                    {/* Audio Project Specific */}
                    {selectedProjectForOverview.projectType === 'audio' && (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Filename</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.filename}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Enhancement Type</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.enhancementType}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip label={selectedProjectForOverview.status} size="small" />
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Progress</Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={selectedProjectForOverview.progress || 0} 
                            sx={{ mt: 1 }}
                          />
                        </Box>
                      </Stack>
                    )}
                    
                    {/* Timeline Project Specific */}
                    {selectedProjectForOverview.projectType === 'timeline' && (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Client</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.clientName || 'N/A'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Event Date</Typography>
                          <Typography variant="body1">
                            {selectedProjectForOverview.eventDate 
                              ? new Date(selectedProjectForOverview.eventDate).toLocaleDateString()
                              : 'N/A'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Location</Typography>
                          <Typography variant="body1">{selectedProjectForOverview.location || 'N/A'}</Typography>
                        </Box>
                      </Stack>
                    )}
                  </MuiCardContent>
                </MuiCard>
              </Grid>
              
              {/* Related Items - Contracts, Split Sheets, Quotes */}
              {selectedProjectForOverview?.id && (
                <Grid item xs={12}>
                  <RelatedItemsWidget
                    projectId={selectedProjectForOverview.id}
                    profession={profession}
                    onViewContract={(contract) => {
                      // Navigate to contracts tab and show contract
                      const contractsTabIndex = config.tabs.findIndex(tab => tab.id === 'contracts');
                      if (contractsTabIndex >= 0) {
                        setTabValue(contractsTabIndex);
                        setProjectOverviewOpen(false);
                        // Emit event to show contract
                        if (integration) {
                          integration.emit('contract:view', { contractId: contract.id });
                        }
                      }
                    }}
                    onViewSplitSheet={(splitSheet) => {
                      // Navigate to split sheets tab and show split sheet
                      const splitSheetsTabIndex = config.tabs.findIndex(tab => tab.id === 'split-sheets');
                      if (splitSheetsTabIndex >= 0) {
                        setTabValue(splitSheetsTabIndex);
                        setProjectOverviewOpen(false);
                        // Emit event to show split sheet
                        if (integration) {
                          integration.emit('split-sheet:view', { splitSheetId: splitSheet.id });
                        }
                      }
                    }}
                    onCreateContract={() => {
                      // Navigate to contracts tab and open creation
                      const contractsTabIndex = config.tabs.findIndex(tab => tab.id === 'contracts');
                      if (contractsTabIndex >= 0) {
                        setTabValue(contractsTabIndex);
                        setProjectOverviewOpen(false);
                      }
                    }}
                    onCreateSplitSheet={() => {
                      // Navigate to split sheets tab and open creation
                      const splitSheetsTabIndex = config.tabs.findIndex(tab => tab.id === 'split-sheets');
                      if (splitSheetsTabIndex >= 0) {
                        setTabValue(splitSheetsTabIndex);
                        setProjectOverviewOpen(false);
                      }
                    }}
                    onCreateQuote={() => {
                      // Navigate to price administration and open quote generator
                      const priceTabIndex = config.tabs.findIndex(tab => tab.id === 'pricing');
                      if (priceTabIndex >= 0) {
                        setTabValue(priceTabIndex);
                        setProjectOverviewOpen(false);
                      }
                    }}
                  />
                </Grid>
              )}
              
              {/* Action Buttons */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={() => setProjectOverviewOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Launch />}
                    onClick={handleOpenInNewTab}
                    sx={{
                      backgroundColor: customBranding.color,
                      '&:hover': { backgroundColor: alpha(customBranding.color, 0.8) }
                    }}
                  >
                    Open in New Tab
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={selectedProjectForOverview?.projectType === 'story-arc' ? <MovieCreation /> : <Edit />}
                    onClick={handleOpenInEditor}
                    sx={{
                      backgroundColor: customBranding.color,
                      '&:hover': { backgroundColor: alpha(customBranding.color, 0.8) }
                    }}
                  >
                    {selectedProjectForOverview?.projectType === 'story-arc' 
                      ? 'Open in Fullscreen Editor' : 'Open in Editor'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog - "Er du sikker?" */}
      <Dialog 
        open={showDeleteProjectDialog}
        onClose={() => setShowDeleteProjectDialog(false)}
        maxWidth="sm"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Delete sx={{ color: '#f44336' }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Slett Prosjekt
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Er du sikker på at du vil slette prosjektet?
          </Typography>
          {selectedProject && (
            <Box sx={{ 
              p: 2,
              bgcolor: 'rgba(2, 4, 4, 67, 54, 0.1)', 
              borderRadius: 2,
              border: '1px solid rgba(2, 4, 4, 67, 54, 0.3)'
            }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                📸 {selectedProject.title || selectedProject.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Klient: {selectedProject.clientName || 'Ikke angitt'}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 600}}>
            ⚠️ Dette kan ikke angres!
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowDeleteProjectDialog(false)}
            variant="outlined"
          >
            Avbryt
          </Button>
          <Button variant="contained"
            color="error"
            startIcon={<Delete />}
            onClick={confirmDeleteProject}
          >
            Ja, Slett Prosjekt
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAQ Dialog */}
      <TutorialFAQIntegration 
        open={showFAQDialog}
        onClose={() => setShowFAQDialog(false)}
        profession={profession}
      />

      {/* Academy Overlay */}
      {showAcademy && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, bgcolor: 'background.default' }}>
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10000}}>
            <Button variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => setShowAcademy(false)}
              sx={{ 
                bgcolor: '#ff8c00', '&:hover': { 
                  bgcolor: '#f57c00'
                }
              }}
            >
              TILBAKE TIL DASHBOARD
            </Button>
          </Box>
          <AcademyDashboard />
        </Box>
      )}

      {/* Showcase Overlay */}
      {showShowcase && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, bgcolor: 'background.default' }}>
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10000}}>
            <Button variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => setShowShowcase(false)}
              sx={{ 
                bgcolor: '#ff8c00',
                '&:hover': { 
                  bgcolor: '#1976d2'
                }
              }}
            >
              TILBAKE TIL DASHBOARD
            </Button>
          </Box>
          <UniversalShowcase 
            profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor'}
            userId={userId}
            isOwner={true}
            adminMode={false}
          />
        </Box>
      )}
    </Box>
);
};

// Performance: Add React.memo for component optimization
export default React.memo(function UniversalDashboard({ profession ='photographer' }: UniversalDashboardProps) {
  return (
    <UniversalDashboardProvider>
      <CommunicationStatusProvider>
        <FileManagementStatusProvider>
          <UniversalDashboardContent profession={profession} />
        </FileManagementStatusProvider>
      </CommunicationStatusProvider>
    </UniversalDashboardProvider>
  );
});