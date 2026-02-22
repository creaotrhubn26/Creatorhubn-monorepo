import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getEvendiBookings, getEvendiAnalyticsSummary, evendiQueryKeys } from '@/lib/evendi-api';
import type { EvendiBooking, EvendiAnalyticsSummary } from '@/lib/evendi-api';
import { useLocation } from 'wouter';
import { trackButtonClick } from '@/hooks/useActionTracker';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/hooks/useAuth';
import { isProfessionFeatureAvailable } from '@shared/profession-feature-matrix';
import AdminIndicator from '../admin/AdminIndicator';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useExternalData } from '../../services/ExternalDataService';
import { UniversalDashboardProvider, useUniversalDashboard } from './UniversalDashboardContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RealTimeProvider } from '@/contexts/RealTimeContext';
import { VisualEditorProvider } from '../admin/visual-editor/VisualEditorContext';
import CreatorHubMarketplace from '../resume/ResumeBuilderMarketplace';
import ContractSummaryWidget from '../contract-designer/ContractSummaryWidget';
import RelatedItemsWidget from './shared/RelatedItemsWidget';
import { Card as MuiCard, CardContent as MuiCardContent, CardActions as MuiCardActions } from '@mui/material';
import {
  Box,
  Container,
  Typography,
  Grid2,
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
  Skeleton,
  Switch,
  FormControlLabel,
  Alert,
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
  AccessTime,
  LocationOn,
  Payment,
  Keyboard,
  Schedule,
  Palette,
  HelpCenter,
  Quiz,
  Delete,
  Launch,
  Edit,
  AccountCircle,
  Collections,
  WbSunny,
  Favorite as WeddingIcon,
  WbCloudy,
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
  AccountBalance,
  AutoAwesome,
  AdminPanelSettings,
  Close,
  VideoLibrary,
} from '@mui/icons-material';

// Import profession-specific components
import BRREGIntegration from '../unused/profession-specific/BRREGIntegration';
import AdministrationHub from './AdministrationHub';

// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
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
import EvendiTimelineAdmin from '../wedding/WeddingTimelineAdmin';

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

// Import Gear News component
import { EnhancedGearTab } from '../dashboard/EnhancedGearTab';
import { QuickMeetingNotesModal } from '../meetings/QuickMeetingNotesModal';
import SmartEmailCenter from '../email/SmartEmailCenter';
import CustomerInquiryCenter from '../email/CustomerInquiryCenter';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import { QuickMeetingNotesModal as GoogleWorkspaceMeetingManager } from '../meetings/QuickMeetingNotesModal';
import UniversalKeyboardShortcuts from '../keyboard-shortcuts/UniversalKeyboardShortcuts';
import SmartTimingPreferences from '../smart-timing/SmartTimingPreferences';
import HelpdeskSystem from './HelpdeskSystem';

// Import Timeline & Showcase components for universal access
import ProjectTimeline from '../project/ProjectTimeline';

// Import Universal Components for enhanced integration
import { UniversalDownload } from './UniversalDownload';
import UniversalFileUpload from './UniversalFileUpload';
import UniversalChatWidget from '../chat/UniversalChatWidget';
import { useCommunicationStatus, CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';
import { useFileManagementStatus, FileManagementStatusProvider } from '../../contexts/FileManagementStatusContext';
// ChatDemoData removed - 100% real data only
import UniversalCommunication from '../communication/UniversalCommunication';
import UniversalWorklog from '../worklog/UniversalWorklog';
import ContextualPhotographyTipsOverlay from '../photography/ContextualPhotographyTipsOverlay';
import ShowcaseAdmin from '../showcase/ShowcaseAdmin';
import ShowcasePublisherPanel from '../showcase/ShowcasePublisherPanel';
import WeddingTimelineOverview from '../wedding/WeddingTimelineOverview';
import WeddingTimelineClientView from '../wedding/WeddingTimelineClientView';
import WeddingTimelineChangesOverview from '../wedding/WeddingTimelineChangesOverview';

// Import Client Activity Panel for dashboard integration
import ClientActivityPanel from './showcase/ClientActivityPanel';

// Import Story Arc Studio for Pro Editor Mode
import StoryArcStudio from '../StoryArcStudio';

// Import tested integration components
import UniversalOAuthIntegration from '../oauth/UniversalOAuthIntegration';
import IntegratedToolsOverview from './IntegratedToolsOverview';


// Import Universal CRM System
import UniversalCRMDashboard from '../crm/UniversalCRMDashboard';

// Import Role Room integration
import RoleRoomDashboardPanel from '../role-room/RoleRoomDashboardPanel';

// Import all missing components to properly wire them up
import SignatureStatusOverview from './signatures/SignatureStatusOverview';
import EquipmentManagementDB from '../unused/profession-specific/EquipmentManagementDB';
import { InteractiveTutorialCreator } from '../tutorial/InteractiveTutorialCreator';
import { CreatorHubBadgeSystem as _CreatorHubBadgeSystem } from '../gamification/CreatorHubBadgeSystem';
import UniversalSettingsPanel from './UniversalSettingsPanel';
import CameraEquipmentManager from './misc/CameraEquipmentManager';
import PersonalizedNewsInterface from '../news/PersonalizedNewsInterface';
import VendorProductManager from '../vendor/VendorProductManager';
import FilesTab from '../file-management/FilesTab';
import SubmissionsOverview from '../unused/submissions/SubmissionsOverview';
import ProjectShowcase from '../project/ProjectShowcase';
import ChatWidget from '../chat/ChatWidget';
import UniversalPrototypeFeedback from '../prototype-testing/UniversalPrototypeFeedback';
import CentralizedSalesHub from '../sales/CentralizedSalesHub';
import TutorialLauncher from '../tutorials/TutorialLauncher';
import VideoEditor from '../video-editor/VideoEditor';
import StoryArcGenerator from '../StoryArcGenerator';
import EmailProjectHistory from '../email/EmailProjectHistory';
import WeddingTimelineClientAccess from '../wedding/WeddingTimelineClientAccess';
import EmailDesigner from '../EmailDesigner/EmailDesigner';
import UniversalContractHub from './contracts/UniversalContractHub';
import PricingManagement from '../pricing/PricingManagement';

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
    displayName: 'Admin',
    color: '#ff8c00',
    iconColor: '#ff8c00',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Prosjekter', icon: <Folder /> },
      { id: 'wedding-timeline', label: 'Evendi', icon: <img src="/assets/Evendi_app_icon.png" alt="Evendi" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
      { id: 'showcase-admin', label: 'Showcase Admin', icon: <Collections /> },
      { id: 'showcase-publisher', label: 'Showcase Publisher', icon: <VideoLibrary /> },
      { id: 'showcase-viewer', label: 'Showcase Viewer', icon: <Visibility /> },
      { id: 'downloads', label: 'Downloads', icon: <GetApp /> },
      { id: 'file-upload', label: 'File Upload', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'email-center', label: 'E-post', icon: <Email /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'photo-enhancement', label: 'Fotoforbedring', icon: <Collections /> },
      { id: 'client-management', label: 'Klientadministrasjon', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'role-room', label: 'The Role Room', icon: <img src="/TheRoleRoom_App_Logo.png" alt="Role Room" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
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
    displayName: 'Fotograf',
    color: '#ff8c00',
    iconColor: '#ff8c00',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Prosjekter', icon: <Folder /> },
      { id: 'academy', label: 'Academy', icon: <School /> },
      { id: 'wedding-timeline', label: 'Evendi', icon: <img src="/assets/Evendi_app_icon.png" alt="Evendi" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
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
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'role-room', label: 'The Role Room', icon: <img src="/TheRoleRoom_App_Logo.png" alt="Role Room" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
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
    displayName: 'Videograf',
    color: '#e74c3c',
    iconColor: '#e74c3c',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Videoer', icon: <Videocam /> },
      { id: 'academy', label: 'Academy', icon: <School /> },
      { id: 'wedding-timeline', label: 'Evendi', icon: <img src="/assets/Evendi_app_icon.png" alt="Evendi" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
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
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'role-room', label: 'The Role Room', icon: <img src="/TheRoleRoom_App_Logo.png" alt="Role Room" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
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
    displayName: 'Musikkprodusent',
    color: '#1976d2',
    iconColor: '#1976d2',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Låter', icon: <LibraryMusic /> },
      { id: 'academy', label: 'Academy', icon: <School /> },
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
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'role-room', label: 'The Role Room', icon: <img src="/TheRoleRoom_App_Logo.png" alt="Role Room" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
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
    name: 'Leverandør',
    displayName: 'Leverandør',
    color: '#27ae60',
    iconColor: '#27ae60',
    icon: <Build />,
    tabs: [
      { id: 'overview', label: 'Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Produkter', icon: <Store /> },
      { id: 'clients', label: 'Bestillinger', icon: <Payment /> },
      { id: 'equipment', label: 'Lager', icon: <Storage /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
      { id: 'role-room', label: 'The Role Room', icon: <img src="/TheRoleRoom_App_Logo.png" alt="Role Room" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['utleie','salg','service','konsultasjon'],
    stats: [
      { key: 'orders', label: 'Aktive Ordrer', icon: <Payment /> },
      { key: 'customers', label: 'Nye Kunder', icon: <Group /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'inventory', label: 'Lagerstatus', icon: <Storage /> }
    ]
},
  enterprise: {
    name: 'Enterprise',
    displayName: 'Enterprise Team',
    color: '#6c3483',
    iconColor: '#6c3483',
    icon: <Business />,
    tabs: [
      { id: 'overview', label: 'Team Oversikt', icon: <Assessment /> },
      { id: 'projects', label: 'Prosjekter', icon: <Folder /> },
      { id: 'academy', label: 'Academy', icon: <School /> },
      { id: 'wedding-timeline', label: 'Evendi', icon: <img src="/assets/Evendi_app_icon.png" alt="Evendi" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
      { id: 'showcase-admin', label: 'Showcase Admin', icon: <Collections /> },
      { id: 'showcase-viewer', label: 'Showcase Viewer', icon: <Visibility /> },
      { id: 'downloads', label: 'Downloads', icon: <GetApp /> },
      { id: 'file-upload', label: 'File Upload', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'video-enhancement', label: 'Video AI', icon: <MovieCreation /> },
      { id: 'email-center', label: 'E-post', icon: <Email /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Kunder', icon: <Group /> },
      { id: 'team-management', label: 'Team', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
      { id: 'communication', label: 'Kommunikasjon', icon: <Chat /> },
      { id: 'role-room', label: 'The Role Room', icon: <img src="/TheRoleRoom_App_Logo.png" alt="Role Room" style={{ width: 24, height: 24, objectFit: 'contain' }} /> },
      { id: 'integration-test', label: 'Integration Test', icon: <Build /> }
    ],
    projectTypes: ['bryllup','corporate','event','musikkvideo','portrett','reklame'],
    stats: [
      { key: 'projects', label: 'Aktive Prosjekter', icon: <Folder /> },
      { key: 'team_members', label: 'Teammedlemmer', icon: <Group /> },
      { key: 'revenue', label: 'Månedens Inntekt', icon: <AttachMoney /> },
      { key: 'bookings', label: 'Bookinger', icon: <CalendarToday /> }
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
  description?: string;
  eventType?: string;
  projectType?: string;
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
      {value === index && (
        <Box 
          sx={{ 
            p: { xs: 2, sm: 3, md: 4 },
            animation: 'fadeSlideIn 0.3s ease-out',
            '@keyframes fadeSlideIn': {
              '0%': { 
                opacity: 0, 
                transform: 'translateY(10px)' 
              },
              '100%': { 
                opacity: 1, 
                transform: 'translateY(0)' 
              },
            }
          }}
        >
          {children}
        </Box>
      )}
    </div>
);
}

interface UniversalDashboardProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';
}

// Internal component that uses the context
const UniversalDashboardContent: React.FC<UniversalDashboardProps> = ({ profession = 'photographer' }) => {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const { status: communicationStatus } = useCommunicationStatus();
  const { status: _fileManagementStatus } = useFileManagementStatus();
  
  // Fetch dynamic profession configurations from database
  const { professionConfigs: dynamicProfessionConfigs, hasData: hasDynamicConfigs } = useProfessionConfigs();
  
  // Use dynamic configs if available, otherwise fall back to static configs
  const professionConfigs = hasDynamicConfigs ? dynamicProfessionConfigs : localProfessionConfigs;
  
  console.log('🔍 Profession configs source:', { hasDynamicConfigs, profession });
  console.log('🔍 Profession tabs:', professionConfigs[profession]?.tabs?.map(t => t.id));
  
  // Profession adapter and dynamic professions for auto-scalability
  const { getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle: _adaptDashboardTitle, adaptTabLabels: _adaptTabLabels } = useProfessionAdapter();
  
  // Helper function to convert admin profession to photographer for components that don't support it
  const getComponentProfession = (prof: string, targetType: 'standard' | 'musicproducer' = 'standard') => {
    if (prof === 'admin') return 'photographer';
    if (targetType === 'musicproducer') {
      if (prof === 'music_producer') return 'musicproducer';
      return prof as 'photographer' | 'videographer' | 'vendor' | 'musicproducer' | 'enterprise';
    }
    if (prof === 'music_producer') return 'music_producer';
    return prof as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
};
  
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry: _componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession === 'admin' ? 'photographer' : (profession as any));
  
  // External Data Service integration for location intelligence and weather data
  const { 
    getCurrentWeather,
    getWeatherForecast,
    getSSBEconomicIndicators,
    getSSBPopulationData,
    getKartverketAddress: _getKartverketAddress,
    searchKartverketPlaceNames: _searchKartverketPlaceNames
} = useExternalData();

  // Comprehensive Feature System for Universal Dashboard
  const _universalDashboardAccess = features.checkFeatureAccess('universal-dashboard');
  const projectsTabAccess = features.checkFeatureAccess('dashboard-projects');
  const clientsTabAccess = features.checkFeatureAccess('dashboard-clients');
  const equipmentTabAccess = features.checkFeatureAccess('dashboard-equipment');
  const showcaseTabAccess = features.checkFeatureAccess('dashboard-showcase');
  const _businessIntelligenceAccess = features.checkFeatureAccess('business-intelligence');
  const settingsTabAccess = features.checkFeatureAccess('dashboard-settings');
  const timelineTabAccess = features.checkFeatureAccess('dashboard-timeline');
  
  // Profession-specific features
  const photoEnhancementAccess = features.checkFeatureAccess('photo-enhancement-suite');
  const videoEnhancementAccess = features.checkFeatureAccess('video-enhancement-suite');
  const audioEnhancementAccess = features.checkFeatureAccess('audio-enhancement-suite');
  const _storyArcAccess = features.checkFeatureAccess('story-arc-studio');
  
  // Universal dashboard context
  const {
    state: _universalState,
    setProjects,
    addProject: _addProject,
    updateProject,
    deleteProject: _deleteProject,
    setSelectedProject: setUniversalSelectedProject,
    setClients,
    addClient: _addClient,
    updateClient: _updateClient,
    deleteClient: _deleteClient,
    setSelectedClient: setUniversalSelectedClient,
    setEquipment: _setEquipment,
    addEquipment: _addEquipment,
    updateEquipment: _updateEquipment,
    deleteEquipment: _deleteEquipment,
    setSelectedEquipment: _setSelectedEquipment,
    setNotifications: _setNotifications,
    addNotification,
    updateNotification: _updateNotification,
    deleteNotification: _deleteNotification,
    updateTabState,
    updateModalState,
    updateSettings,
    setLoading: _setLoading,
    setError: _setError,
    broadcastChange: _broadcastChange,
    requestData: _requestData,
    syncWithComponent: _syncWithComponent
  } = useUniversalDashboard();
  
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
  const _stats = config?.stats || [];

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
      // Map tab IDs to feature checks - All enabled by default for better UX
      const featureMap: Record<string, boolean> = {
        'overview': true, // Always available
        'projects': true, // Always available
        'academy': isMentor || profession === 'enterprise', // Academy for mentors/instructors and enterprise teams
        'split-sheets': false, // Split sheets moved to Prisadministrasjon sub-tab for all professions
        'wedding-timeline': true, // Always available
        'showcase-admin': true, // Always available
        'showcase-viewer': true, // Always available
        'downloads': true,
        'file-upload': true,
        'ai-enhancement': true, // Always available
        'photo-enhancement': true, // Always available
        'video-enhancement': true, // Always available
        'audio-enhancement': true, // Always available
        'email-center': true,
        'worklog': true,
        'clients': true, // Always available
        'client-management': true, // Always available
        'team-management': profession === 'enterprise', // Enterprise only
        'equipment': true, // Always available
        'files': true,
        'support': true,
        'settings': true, // Always available
        'administration': true, // Pricing administration for all professions
        'communication': true,
        'role-room': true, // The Role Room - casting & crew management
        'integration-test': isAdmin // Only for admins
      };

      const hasAccess = featureMap[tab.id] !== false;
      if (tab.id === 'administration') {
        console.log('🔍 Administration tab check:', { tabId: tab.id, hasAccess, featureMapValue: featureMap[tab.id] });
      }
      return hasAccess;
    });
    
    console.log('📋 Available tabs:', tabs.map(t => t.id));
    console.log('📋 Config tabs:', config.tabs.map(t => t.id));
    
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
      profession, isAdmin, isMentor, features]);

  // Register this component in the integration system
  useEffect(() => {
    communication.registerComponent('universal-dashboard','dashboard', [
      'data:read','data:write','event:emit','event:listen','ui:update','project:manage','client:manage','equipment:manage','notification:manage','settings:manage'
    ]);

    // Track feature usage
    features.trackFeatureUsage('universal-dashboard','opened', {
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
      if (message.type === 'client:selected' && message.data) {
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
        // Store prefill for EvendiTimelineAdmin consumers
        try {
          updateSettings({ weddingTimelinePrefill: message.data } as any);
          dataFlow.syncData('wedding-timeline:prefill', message.data);
        } catch {
          // Silently handle prefill sync errors
        }
        const idx = availableTabs.findIndex((t) => t.id === 'wedding-timeline');
        if (idx >= 0) setTabValue(idx);
      }
      if (message.type === 'navigate:event-timeline') {
        // Store prefill and open dialog
        setEventTimelinePrefill(message.data);
        setShowEventTimelineDialog(true);
      }
      if (message.type === 'data:sync' && message.data.dataKey === 'universal-dashboard:selectedProject') {
        setSelectedProject(message.data.data);
        setUniversalSelectedProject(message.data.data);
      }
      if (message.type === 'data:sync' && message.data.dataKey === 'universal-dashboard:projects') {
        setProjects(message.data.data);
      }
      if (message.type === 'data:sync' && message.data.dataKey === 'universal-dashboard:clients') {
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
      // Listen for pricing events from PriceAdministration
      if (message.type === 'quote:created' && message.data) {
        console.log('📊 UniversalDashboard: Quote created', message.data);
        // Could show notification or navigate to quotes
      }
      if (message.type === 'pricing:packageCreated' && message.data) {
        console.log('📊 UniversalDashboard: Package created', message.data);
      }
      if (message.type === 'pricing:discountCreated' && message.data) {
        console.log('📊 UniversalDashboard: Discount created', message.data);
      }
      // Listen for showcase events from UniversalShowcase/ShowcaseAdmin
      if (message.type === 'showcase:updated' && message.data) {
        console.log('📊 UniversalDashboard: Showcase updated', message.data);
      }
      if (message.type === 'showcase-synced-to-drive' && message.data) {
        console.log('📊 UniversalDashboard: Showcase synced to Google Drive', message.data);
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

  // Interface preferences state with localStorage + database persistence
  const [interfacePrefs, setInterfacePrefs] = useState(() => {
    const saved = localStorage.getItem('creatorhub-interface-prefs');
    return saved ? JSON.parse(saved) : {
      theme: 'light',
      language: 'nb-NO',
      fontSize: 'medium',
      compactView: true,
      showAnimations: true,
      highContrast: false
    };
  });

  // Get session ID for preferences API
  const sessionId = currentUser?.id || localStorage.getItem('creatorhub-session-id') || 'anonymous';
  
  // Initialize session ID if not present
  useEffect(() => {
    if (!localStorage.getItem('creatorhub-session-id')) {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('creatorhub-session-id', newSessionId);
    }
  }, []);

  // Load preferences from database on mount
  const { data: dbPrefs } = useQuery({
    queryKey: ['interface-preferences', sessionId],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/user/interface-preferences/${sessionId}`);
        return response?.preferences || null;
      } catch (error) {
        console.warn('Failed to load preferences from database:', error);
        return null;
      }
    },
    staleTime: 60000, // 1 minute
    enabled: !!sessionId
  });

  // Merge database preferences with local preferences on load
  useEffect(() => {
    if (dbPrefs && dbPrefs.theme) {
      setInterfacePrefs((prev: any) => ({
        ...prev,
        theme: dbPrefs.theme || prev.theme,
        language: dbPrefs.language || prev.language
      }));
    }
  }, [dbPrefs]);

  // Mutation to save preferences to database
  const savePreferencesMutation = useMutation({
    mutationFn: async (prefs: typeof interfacePrefs) => {
      return apiRequest(`/api/user/interface-preferences/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: prefs.theme,
          language: prefs.language,
          notificationsEnabled: true,
          dashboardLayout: prefs.compactView ? 'compact' : 'cards',
          timezone: 'Europe/Oslo',
          currency: 'NOK'
        })
      });
    }
  });

  // Save interface preferences to localStorage and database
  useEffect(() => {
    localStorage.setItem('creatorhub-interface-prefs', JSON.stringify(interfacePrefs));
    
    // Debounce database save
    const timeoutId = setTimeout(() => {
      savePreferencesMutation.mutate(interfacePrefs);
    }, 1000); // Wait 1 second before saving to reduce API calls
    
    return () => clearTimeout(timeoutId);
  }, [interfacePrefs]);

  const updateInterfacePref = (key: string, value: any) => {
    setInterfacePrefs((prev: any) => ({ ...prev, [key]: value }));
  };
  
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

  // User's detected location (with geolocation support)
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number; city?: string } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  // Get user's geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDetectedLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationPermissionDenied(false);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          setLocationPermissionDenied(true);
          // Fall back to Oslo
          setDetectedLocation({ lat: 59.9139, lng: 10.7522, city: 'Oslo' });
        }
      );
    } else {
      // Browser doesn't support geolocation - use Oslo
      setDetectedLocation({ lat: 59.9139, lng: 10.7522, city: 'Oslo' });
    }
  }, []);

  // Mentor status check moved earlier to avoid TDZ error

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
  const [_eventTimelinePrefill, setEventTimelinePrefill] = useState<any | null>(null);
  
  // Client Activity modal state
  const [showClientActivityModal, setShowClientActivityModal] = useState(false);
  
  // Split Sheets modal state
  const [showSplitSheetsModal, setShowSplitSheetsModal] = useState(false);
  
  const setTabValue = (value: number) => updateTabStateLocal('main', value);
  const settingsTabValue = tabState.settings;
  const setSettingsTabValue = (value: number) => updateTabStateLocal('settings', value);
  const selectedTimelineTab = tabState.timeline;
  const setSelectedTimelineTab = (value: number) => updateTabStateLocal('timeline', value);
  
  // Additional tab states for sub-navigation
  const [emailTabValue, setEmailTabValue] = useState(0);
  const [equipmentTabValue, setEquipmentTabValue] = useState(0);
  const [projectsTabValue, setProjectsTabValue] = useState(0);

  // Keep selected tab within range of available tabs
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (tabValue < 0 || tabValue >= availableTabs.length) {
      setTabValue(0);
    }
  }, [availableTabs.length, tabValue, setTabValue]);
  
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
    }
};
  const emailProjectContext = selectedItems.emailContext;
  const _setEmailProjectContext = (value: EmailContext | null) => updateSelectedItems('emailContext', value);
  const _selectedEquipment = selectedItems.equipment;
  const _setSelectedEquipmentLocal = (value: Equipment | null) => updateSelectedItems('equipment', value);
  
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
  const _showPrototypeFeedback = modalState.showPrototypeFeedback;
  const setShowPrototypeFeedback = (value: boolean) => updateModalStateLocal('showPrototypeFeedback', value);
  const showCrmDialog = modalState.showCrmDialog;
  const setShowCrmDialog = (value: boolean) => updateModalStateLocal('showCrmDialog', value);
  const showProjectDetailsModal = modalState.showProjectDetailsModal;
  const setShowProjectDetailsModal = (value: boolean) => updateModalStateLocal('showProjectDetailsModal', value);
  const showEditProjectModal = modalState.showEditProjectModal;
  const setShowEditProjectModal = (value: boolean) => updateModalStateLocal('showEditProjectModal', value);
  const showDeleteProjectDialog = modalState.showDeleteProjectDialog;
  const setShowDeleteProjectDialog = (value: boolean) => updateModalStateLocal('showDeleteProjectDialog', value);

  // ==============================================================
  // EVENDI COUPLE AUTO-RESOLUTION
  // Auto-maps selectedClient.email → Evendi couple profile UUID
  // Used to pass evendiCoupleId to EvendiTimelineAdmin, ProjectCreation, AdministrationHub
  // ==============================================================
  const [evendiCoupleId, setEvendiCoupleId] = useState<string | null>(null);

  useEffect(() => {
    const clientEmail = selectedClient?.email;
    if (!clientEmail) {
      setEvendiCoupleId(null);
      return;
    }

    // If client already has a coupleId from /api/clients, use it directly
    if ((selectedClient as any)?.coupleId) {
      setEvendiCoupleId((selectedClient as any).coupleId);
      return;
    }

    // Otherwise resolve via email lookup
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest(`/api/evendi/resolve-couple?email=${encodeURIComponent(clientEmail)}`);
        if (!cancelled && data?.coupleId) {
          setEvendiCoupleId(data.coupleId);
        }
      } catch {
        // No couple profile for this client — graceful degradation
        if (!cancelled) setEvendiCoupleId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClient?.email, (selectedClient as any)?.coupleId]);

  // Theme and Responsive
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Universal Demo Mode Integration
  const { isDemoMode: _isDemoMode, isLoading: _demoModeLoading } = useDemoMode();

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
  const locationFetchKeyRef = useRef<string>('');
  const fetchLocationIntelligence = useCallback(async () => {
    if (!detectedLocation) return; // Wait for location detection

    const locationKey = `${detectedLocation.lat},${detectedLocation.lng}`;
    if (locationFetchKeyRef.current === locationKey && locationIntelligence.weatherData && locationIntelligence.populationData) {
      return;
    }
    locationFetchKeyRef.current = locationKey;
    
    setLocationIntelligence(prev => ({ ...prev, loading: true }));
    
    try {
      // Use detected location or fall back to Oslo
      const userLocation = detectedLocation;
      
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
      const populationData = await getSSBPopulationData({ region: userLocation.city || 'Oslo' });
      
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
}, [detectedLocation, locationIntelligence.weatherData, locationIntelligence.populationData, getCurrentWeather, getWeatherForecast, getSSBEconomicIndicators, getSSBPopulationData]);

  // Fetch location intelligence data when location is detected
  useEffect(() => {
    if (detectedLocation) {
      fetchLocationIntelligence();
    }
}, [detectedLocation, fetchLocationIntelligence]);

  // Project overview dialog state (moved before callbacks to avoid TDZ error)
  const [selectedProjectForOverview, setSelectedProjectForOverview] = useState<any | null>(null);
  const [projectOverviewOpen, setProjectOverviewOpen] = useState(false);

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
          const overviewTabIndex = availableTabs.findIndex(tab => tab.id === 'overview');
          setTabValue(overviewTabIndex >= 0 ? overviewTabIndex : 0); // Stay on overview but show fullscreen editor
        }
        break;
      case 'photo':
        {
          const photoTabIndex = availableTabs.findIndex(tab => tab.id === 'photo-enhancement' || tab.id === 'ai-enhancement');
          if (photoTabIndex >= 0) setTabValue(photoTabIndex);
        }
        break;
      case 'audio':
        {
          const audioTabIndex = availableTabs.findIndex(tab => tab.id === 'audio-enhancement' || tab.id === 'ai-enhancement');
          if (audioTabIndex >= 0) setTabValue(audioTabIndex);
        }
        break;
      case 'timeline':
        {
          const timelineTabIndex = availableTabs.findIndex(tab => tab.id === 'projects' || tab.id === 'timeline');
          if (timelineTabIndex >= 0) setTabValue(timelineTabIndex);
        }
        break;
    }
  }, [selectedProjectForOverview, setSelectedProject, profession, setProEditorMode, setTabValue, config.tabs, availableTabs]);

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

  // baseConfig moved earlier (before config useMemo) to avoid TDZ error
  
  // Config, user session, and admin checks moved earlier to avoid TDZ error
  // availableTabs moved earlier to avoid TDZ error

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
        <MuiCard sx={{
          ...sharedStyles.glassCard,
          p: 3,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, ${customBranding.color} 0%, #6366F1 50%, #10B981 100%)`,
          }
        }}>
          <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Build sx={{ color: customBranding.color }} />
            Admin Dashboard Tilgang
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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
                    bgcolor: profession === key ? customBranding.color : 'transparent',
                    color: profession === key ? 'white' : 'text.primary',
                    borderColor: profession === key ? customBranding.color : 'rgba(0,0,0,0.12)',
                    borderRadius: 2.5,
                    px: 2.5,
                    py: 1,
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                    boxShadow: profession === key ? `0 4px 12px ${customBranding.color}30` : 'none',
                    '&:hover': {
                      bgcolor: profession === key ? customBranding.color : 'rgba(0,0,0,0.04)',
                      borderColor: profession === key ? customBranding.color : 'rgba(0,0,0,0.2)',
                      transform: 'translateY(-2px)',
                    }
                  }}
                >
                  {enhancedConfig.name}
                </Button>
              );
            })}
          </Box>
          <Typography variant="body2" sx={{ mt: 2.5, color: 'text.secondary', fontSize: '0.85rem' }}>
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
    
    // Helper to ensure we always get a string (not an object)
    const getStringValue = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim()) return value;
      return null;
    };
    
    const businessNameRaw = getStringValue((brandingInfo as any).businessName) 
      || getStringValue((onboardingInfo as any).businessName) 
      || getStringValue(config?.name)
      || 'CreatorHub';
    
    // DEBUG: Log what we're getting
    console.log('[CustomBranding Debug]', {
      brandingInfo,
      onboardingInfo,
      configName: config?.name,
      configNameType: typeof config?.name,
      businessNameRaw,
      businessNameRawType: typeof businessNameRaw
    });
    
    return {
      color: (brandingInfo as any).brandingColor || (onboardingInfo as any).brandingColor || config?.color || '#ff8c00',
      businessName: businessNameRaw,
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
  const _userVendorType = vendorProfile?.vendorType || 'print';

  // Fetch Evendi bookings & analytics (wired via evendi-api.ts)
  const { data: evendiBookings = [] } = useQuery<EvendiBooking[]>({
    queryKey: evendiQueryKeys.bookings(),
    queryFn: () => getEvendiBookings(),
    enabled: !!userId && userId !== 'guest',
    staleTime: 60_000,
  });

  const { data: evendiAnalytics } = useQuery<EvendiAnalyticsSummary>({
    queryKey: evendiQueryKeys.analytics(),
    queryFn: () => getEvendiAnalyticsSummary(),
    enabled: !!userId && userId !== 'guest',
    staleTime: 60_000,
  });

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
  const { data: _meetingStats } = useQuery({
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
  const { data: storyArcProjectsData, isLoading: _loadingStoryArc } = useQuery({
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
  const { data: allPhotoProjects, isLoading: _loadingPhoto } = useQuery({
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
  const { data: audioProjectsData, isLoading: _loadingAudio } = useQuery({
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

  // Split Sheets data for overview (photographers, videographers, music_producers, vendors)
  const { data: splitSheetsData } = useQuery({
    queryKey: ['split-sheets-overview', userId],
    queryFn: async () => {
      const response = await apiRequest('/api/split-sheets?limit=10');
      return response;
    },
    enabled: !!userId,
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

  const evendiBookingSummary = useMemo(() => {
    const fallbackTotal = evendiBookings.length;
    const fallbackRevenue = evendiBookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    const totalBookings = evendiAnalytics?.totalBookings ?? fallbackTotal;
    const totalRevenue = evendiAnalytics?.totalRevenue ?? fallbackRevenue;
    const upcomingEvents = evendiAnalytics?.upcomingEvents ?? evendiBookings.filter((booking) => {
      const eventDate = new Date(booking.eventDate);
      if (Number.isNaN(eventDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today && booking.status !== 'cancelled';
    }).length;

    const statusCounts = evendiAnalytics?.bookingsByStatus?.length
      ? evendiAnalytics.bookingsByStatus
      : (['pending', 'confirmed', 'completed', 'cancelled'] as EvendiBooking['status'][]).map((status) => ({
          status,
          count: evendiBookings.filter((booking) => booking.status === status).length,
        }));

    return {
      totalBookings,
      totalRevenue,
      upcomingEvents,
      statusCounts,
    };
  }, [evendiAnalytics, evendiBookings]);

  const evendiUpcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...evendiBookings]
      .filter((booking) => {
        const eventDate = new Date(booking.eventDate);
        if (Number.isNaN(eventDate.getTime())) return false;
        return eventDate >= today && booking.status !== 'cancelled';
      })
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .slice(0, 3);
  }, [evendiBookings]);

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
  const _getTabMapping = (tabIndex: number) => {
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
  // Marketplace navigation state
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [marketplaceInstallNotice, setMarketplaceInstallNotice] = useState<string | null>(null);

  const handleMarketplaceInstall = useCallback((appId: string) => {
    if (appId === 'resume-builder') {
      setMarketplaceInstallNotice('ResumeBuilder installeres. Du blir sendt videre...');
      setTimeout(() => {
        setShowMarketplace(false);
        window.location.href = '/resume-builder';
      }, 800);
    }
  }, []);
  
  // selectedProjectForOverview and projectOverviewOpen moved earlier to avoid TDZ error

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
    // Modern glassmorphism card with subtle gradient
    cardGradient: {
      background: `linear-gradient(135deg, ${customBranding.color}15 0%, ${customBranding.color}08 100%)`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${customBranding.color}20`,
      borderRadius: 4,
      p: 3,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: `0 20px 40px ${customBranding.color}15`,
        border: `1px solid ${customBranding.color}30`,
      }
    },
    // Glass effect card
    glassCard: {
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: 4,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.95)',
        transform: 'translateY(-2px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
      }
    },
    // Primary action button with gradient
    primaryButton: {
      background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`,
      color: 'white',
      borderRadius: 3,
      fontWeight: 600,
      px: 3,
      py: 1.5,
      boxShadow: `0 4px 15px ${customBranding.color}40`,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 8px 25px ${customBranding.color}50`,
      },
      '&:active': {
        transform: 'translateY(0)',
      }
    },
    // Secondary/outline button
    secondaryButton: {
      borderColor: customBranding.color,
      color: customBranding.color,
      borderWidth: '1.5px',
      borderRadius: 3,
      fontWeight: 600,
      transition: 'all 0.2s ease',
      '&:hover': {
        borderWidth: '1.5px',
        background: `${customBranding.color}08`,
        transform: 'translateY(-1px)',
      }
    },
    // Modern dialog styling
    dialogPaper: {
      borderRadius: 5,
      bgcolor: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(20px)',
      backgroundImage: 'none',
      border: `1px solid ${customBranding.color}15`,
      boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
      overflow: 'hidden',
    },
    responsivePadding: {
      p: { xs: 2, sm: 3, md: 4 }
    },
    centerFlex: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    brandedText: {
      color: customBranding.color,
      fontWeight: 600
    },
    // Stats card style
    statsCard: {
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(16px)',
      borderRadius: 4,
      border: '1px solid rgba(255, 255, 255, 0.5)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: `linear-gradient(90deg, ${customBranding.color} 0%, ${customBranding.color}80 100%)`,
        opacity: 0,
        transition: 'opacity 0.3s ease',
      },
      '&:hover': {
        transform: 'translateY(-6px)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
        '&::before': {
          opacity: 1,
        }
      }
    },
    // Icon container style
    iconBox: {
      p: 1.5,
      borderRadius: 3,
      bgcolor: `${customBranding.color}12`,
      color: customBranding.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
    },
    // Tab container style
    tabsContainer: {
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(12px)',
      borderRadius: 3,
      p: 0.5,
      border: '1px solid rgba(0,0,0,0.04)',
    },
    // Animated gradient background
    animatedBg: {
      background: `
        linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 25%, #FFEDD5 50%, #FED7AA 75%, ${customBranding.color}15 100%)
      `,
      backgroundSize: '400% 400%',
      animation: 'gradientShift 15s ease infinite',
      '@keyframes gradientShift': {
        '0%': { backgroundPosition: '0% 50%' },
        '50%': { backgroundPosition: '100% 50%' },
        '100%': { backgroundPosition: '0% 50%' },
      }
    }
  }), [customBranding.color, theme.palette.primary.dark]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          linear-gradient(135deg, #FFFBF5 0%, #FFF7ED 25%, #FEF3C7 50%, #FFEDD5 75%, ${customBranding.color}08 100%)
        `,
        backgroundAttachment: 'fixed',
        py: { xs: 2, sm: 3, md: 4 },
        px: { xs: 1, sm: 2 },
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse at 20% 20%, ${customBranding.color}08 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, ${customBranding.color}06 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        },
        // WCAG AA Compliance: Motion and contrast preferences
        '@media (prefers-reduced-motion: reduce)': {
          background: '#FFFBF5',
          '&::before': { display: 'none' }
        },
        '@media (prefers-contrast: high)': {
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
        {uiSettings.submissionProjectData && (
        <Dialog open={showProjectCreation} onClose={() => setShowProjectCreation(false)} maxWidth="lg" fullWidth>
          <DialogTitle>Opprett prosjekt fra innsending</DialogTitle>
          <DialogContent dividers>
            <RealTimeProvider>
              <VisualEditorProvider>
                <ThemeProvider>
                  <SettingsProvider>
                    <ProjectProvider>
                      <ProjectCreationWithMemoryCards
                        profession={getComponentProfession(profession)}
                        evendiCoupleId={evendiCoupleId || undefined}
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
                    </ProjectProvider>
                  </SettingsProvider>
                </ThemeProvider>
              </VisualEditorProvider>
            </RealTimeProvider>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowProjectCreation(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
        )}

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

        {/* Client Activity & Deadlines Modal */}
        <Dialog 
          open={showClientActivityModal} 
          onClose={() => setShowClientActivityModal(false)} 
          maxWidth="lg" 
          fullWidth
          PaperProps={{
            sx: {
              ...sharedStyles.glassCard,
              maxHeight: '90vh'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            fontWeight: 600,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <Notifications sx={{ color: customBranding.color }} />
            Klientaktivitet og frister
            {totalClientActivity > 0 && (
              <Badge 
                badgeContent={totalClientActivity}
                color={pendingTimelineChanges > 0 || pendingSubmissions > 0 || urgentDeadlines > 0 ? "error" : "primary"}
                sx={{
                  ml: 'auto',
                  '& .MuiBadge-badge': {
                    animation: (pendingTimelineChanges > 0 || pendingSubmissions > 0 || urgentDeadlines > 0) ? 'pulse 2s infinite' : 'none'
                  }
                }}
              >
                <Chip 
                  label={
                    pendingTimelineChanges > 0 ? `${pendingTimelineChanges} TIDSLINJEENDRINGER` :
                    pendingSubmissions > 0 ? `${pendingSubmissions} NYE INNSENDINGER` :
                    urgentDeadlines > 0 ? `${urgentDeadlines} HASTER` : 
                    `${totalClientActivity} oppdateringer`
                  }
                  color={pendingTimelineChanges > 0 || pendingSubmissions > 0 || urgentDeadlines > 0 ? "error" : "primary"}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Badge>
            )}
          </DialogTitle>
          <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
            <ClientActivityPanel
              profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
              accentColor={customBranding.color}
              userId={userId}
              onActivityClick={(activity) => {
                // Close modal and navigate to relevant section based on activity type
                setShowClientActivityModal(false);
                if (activity.type === 'deadline') {
                  // Go to Projects tab
                  const projectsTabIndex = availableTabs.findIndex(tab => tab.id === 'projects');
                  if (projectsTabIndex !== -1) setTabValue(projectsTabIndex);
                } else if (activity.type === 'comment') {
                  // Go to Showcase tab
                  const showcaseTabIndex = availableTabs.findIndex(tab => tab.id === 'showcase-viewer');
                  if (showcaseTabIndex !== -1) setTabValue(showcaseTabIndex);
                } else if (activity.type === 'timeline_change') {
                  // Go to Wedding Timeline tab
                  const timelineTabIndex = availableTabs.findIndex(tab => tab.id === 'wedding-timeline');
                  if (timelineTabIndex !== -1) setTabValue(timelineTabIndex);
                }
              }}
              onCreateProjectFromSubmission={(submissionData) => {
                // Pre-fill project creation with submission data
                setUiSettings(prev => ({
                  ...prev,
                  submissionProjectData: submissionData
                }));
                setShowClientActivityModal(false);
                setShowProjectCreation(true);
              }}
              onAcceptTimelineChanges={async (changes, worklogData) => {
                try {
                  // 1. Accept all timeline changes in database
                  const changeIds = changes.map(c => c.id.replace('timeline-change-', ''));
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
                    message: `Godtatt ${changes.length} tidslinjeendring(er) og lagt til i arbeidslogg. Synkronisert til Google Keep for møtediskusjon.`,
                    type: 'success',
                    title: 'Tidslinjeendringer godtatt',
                    read: false
                  });
                } catch (error) {
                  console.error('Error accepting timeline changes:', error);
                  addNotification({
                    message: 'Kunne ikke godta tidslinjeendringer',
                    type: 'error',
                    title: 'Feil',
                    read: false
                  });
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowClientActivityModal(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>

        {/* Split Sheets Oversikt Modal */}
        <Dialog 
          open={showSplitSheetsModal} 
          onClose={() => setShowSplitSheetsModal(false)} 
          maxWidth="lg" 
          fullWidth
          PaperProps={{
            sx: {
              ...sharedStyles.glassCard,
              maxHeight: '90vh'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            fontWeight: 600,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}>
            <AccountBalance sx={{ color: '#9f7aea' }} />
            Split Sheets Oversikt
            {splitSheetStats.total > 0 && (
              <Badge 
                badgeContent={splitSheetStats.pending}
                color={splitSheetStats.pending > 0 ? "error" : "primary"}
                sx={{
                  ml: 'auto',
                  '& .MuiBadge-badge': {
                    animation: splitSheetStats.pending > 0 ? 'pulse 2s infinite' : 'none'
                  }
                }}
              >
                <Chip 
                  label={`${splitSheetStats.total} total`}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Badge>
            )}
          </DialogTitle>
          <DialogContent dividers sx={{ p: { xs: 2, md: 3 } }}>
            {/* Statistics */}
            <Grid2 container spacing={2} sx={{ mb: 3 }}>
              <Grid2 size={{ xs: 6, sm: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#9f7aea' }}>
                    {splitSheetStats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totalt Split Sheets
                  </Typography>
                </Paper>
              </Grid2>
              <Grid2 size={{ xs: 6, sm: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                    {splitSheetStats.pending}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Venter på signaturer
                  </Typography>
                </Paper>
              </Grid2>
              <Grid2 size={{ xs: 6, sm: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                    {splitSheetStats.completed}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fullført
                  </Typography>
                </Paper>
              </Grid2>
              <Grid2 size={{ xs: 6, sm: 3 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>
                    {splitSheetStats.draft}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Utkast
                  </Typography>
                </Paper>
              </Grid2>
            </Grid2>

            {/* Quick Actions */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
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
                  if (splitSheetTabIndex >= 0) {
                    setShowSplitSheetsModal(false);
                    setTabValue(splitSheetTabIndex);
                  }
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
                  if (splitSheetTabIndex >= 0) {
                    setShowSplitSheetsModal(false);
                    setTabValue(splitSheetTabIndex);
                  }
                }}
                sx={{ color: '#9f7aea', borderColor: alpha('#9f7aea', 0.3) }}
              >
                Administrer Split Sheets
              </Button>
            </Box>

            {/* Info message */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Åpne Split Sheets-fanen for fullstendig oversikt over alle split sheets, signaturer og betalinger.
              </Typography>
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSplitSheetsModal(false)}>Lukk</Button>
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
          <Box sx={{ 
            textAlign: 'center', 
            mb: 3, 
            display: 'flex', 
            gap: 2, 
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <Button variant="contained"
              startIcon={<AcademyIcon />}
              onClick={() => setShowAcademy(true)}
              sx={{ 
                background: `linear-gradient(135deg, ${customBranding.color} 0%, #E85A24 100%)`,
                color: 'white',
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 3,
                boxShadow: `0 4px 20px ${customBranding.color}35`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                  background: `linear-gradient(135deg, #E85A24 0%, ${customBranding.color} 100%)`,
                  transform: 'translateY(-3px)',
                  boxShadow: `0 8px 30px ${customBranding.color}45`,
                },
                '&:active': {
                  transform: 'translateY(-1px)',
                }
              }}
            >
              GÅ TIL ACADEMY
            </Button>
            
            <Button variant="contained"
              startIcon={<Collections />}
              onClick={() => setShowShowcase(true)}
              sx={{ 
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: 'white',
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 30px rgba(99, 102, 241, 0.45)',
                },
                '&:active': {
                  transform: 'translateY(-1px)',
                }
              }}
            >
              GÅ TIL SHOWCASE
            </Button>
            
            <Button variant="contained"
              startIcon={<Group />}
              onClick={() => window.location.href = '/community'}
              sx={{ 
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: 'white',
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 30px rgba(16, 185, 129, 0.45)',
                },
                '&:active': {
                  transform: 'translateY(-1px)',
                }
              }}
            >
              GÅ TIL COMMUNITY
            </Button>
          </Box>
          
          {/* Welcome Card with Custom Branding - WCAG Compliant */}
          <MuiCard 
            sx={{ 
              mb: { xs: 2, md: 4 },
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${customBranding.color} 0%, ${customBranding.color}80 50%, #6366F1 100%)`,
              },
              '&:hover': {
                boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12)',
                transform: 'translateY(-2px)',
              },
              // WCAG: Focus management and high contrast
              '&:focus-within': {
                outline: `3px solid ${customBranding.color}`,
                outlineOffset: '2px'
              },
              '@media (prefers-contrast: high)': {
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
                      aria-label={`Velkommen tilbake, ${typeof customBranding.businessName === 'string' ? customBranding.businessName : 'bruker'}`}
                    >
                      Velkommen tilbake, {typeof customBranding.businessName === 'string' ? customBranding.businessName : 'bruker'}!
                    </Typography>
                    {/* Enterprise: Show Norwedfilm logo + combined profession badges */}
                    {profession === 'enterprise' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <img src="/norwed.png" alt="Norwedfilm" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain', background: '#f5f5f5', padding: 2 }} />
                        <Box sx={{ display: 'flex', gap: 0.5, color: 'text.secondary' }}>
                          <PhotoCamera sx={{ fontSize: 16 }} />
                          <VideoLibrary sx={{ fontSize: 16 }} />
                        </Box>
                      </Box>
                    )}
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
                  <Button 
                    variant="outlined"
                    size={isSmallScreen ? "small" : "medium"}
                    startIcon={<Store />}
                    onClick={() => setShowMarketplace(true)}
                    sx={{
                      color: '#F59E0B',
                      borderColor: alpha('#F59E0B', 0.3),
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      minHeight: { xs: 36, sm: 44 },
                      '&:hover': {
                        bgcolor: '#F59E0B' + '10',
                        borderColor: '#F59E0B'
                      },
                      '&:focus': {
                        outline: `2px solid #F59E0B`,
                        outlineOffset: '2px'
                      }
                    }}
                    aria-label={isSmallScreen ? 'Marketplace' : 'Åpne Marketplace'}
                    tabIndex={0}
                  >
                    {isSmallScreen ? 'Marked' : 'Marketplace'}
                  </Button>
                  <Button 
                    variant="outlined"
                    size={isSmallScreen ? "small" : "medium"}
                    startIcon={<AccountBalance />}
                    onClick={() => setShowSplitSheetsModal(true)}
                    sx={{
                      color: '#9f7aea',
                      borderColor: alpha('#9f7aea', 0.3),
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      minHeight: { xs: 36, sm: 44 },
                      '&:hover': {
                        bgcolor: '#9f7aea' + '10',
                        borderColor: '#9f7aea'
                      },
                      '&:focus': {
                        outline: `2px solid #9f7aea`,
                        outlineOffset: '2px'
                      }
                    }}
                    aria-label={isSmallScreen ? 'Split Sheets' : 'Split Sheets Oversikt'}
                    tabIndex={0}
                  >
                    {isSmallScreen ? 'Split Sheets' : 'Split Sheets'}
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
                        // Open client activity modal
                        setShowClientActivityModal(true);
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
                {availableTabs.slice(1, 5).map((tab, _index) => {
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
        <Grid2 
          container 
          spacing={{ xs: 2, sm: 2.5, md: 3 }}
          sx={{ mb: { xs: 3, md: 4 } }}
          component="section"
          role="region"
          aria-label="Statistikk oversikt"
        >
          <Grid2 size={{ xs: 6, sm: 6, md: 3 }}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, ${customBranding.color} 0%, ${customBranding.color}60 100%)`,
                opacity: 0,
                transition: 'opacity 0.3s ease',
              },
              '&:hover': { 
                transform: 'translateY(-6px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
                '&::before': { opacity: 1 }
              }
            }}>
              <MuiCardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1.5, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 1, sm: 1.5 },
                    borderRadius: 3,
                    bgcolor: `${customBranding.color}12`,
                    color: customBranding.color,
                    minWidth: 'fit-content',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}>
                    <Assessment sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.25rem' },
                        cursor: 'pointer',
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                        transition: 'color 0.2s ease',
                        '&:hover': { color: customBranding.color }
                      }}
                      onClick={() => {
                        // Stats navigation - Projects count: {projects?.length || 0}
                        const projectsTabIndex = availableTabs.findIndex(tab => tab.id === 'projects');
                        if (projectsTabIndex !== -1) setTabValue(projectsTabIndex); // Navigate to Projects tab
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
          </Grid2>
          
          <Grid2 size={{ xs: 6, sm: 6, md: 3 }}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, #10B981 0%, #34D399 100%)`,
                opacity: 0,
                transition: 'opacity 0.3s ease',
              },
              '&:hover': { 
                transform: 'translateY(-6px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
                '&::before': { opacity: 1 }
              }
            }}>
              <MuiCardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1.5, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 1, sm: 1.5 },
                    borderRadius: 3,
                    bgcolor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10B981',
                    minWidth: 'fit-content',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Group sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{ 
                        fontWeight: 700,
                        fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.25rem' },
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {dashboardData?.newClients || 0}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' }, fontWeight: 500 }}
                    >
                      Nye Kunder
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid2>
          
          <Grid2 size={{ xs: 6, sm: 6, md: 3 }}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, #6366F1 0%, #818CF8 100%)`,
                opacity: 0,
                transition: 'opacity 0.3s ease',
              },
              '&:hover': { 
                transform: 'translateY(-6px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
                '&::before': { opacity: 1 }
              }
            }}>
              <MuiCardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1.5, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 1, sm: 1.5 },
                    borderRadius: 3,
                    bgcolor: 'rgba(99, 102, 241, 0.12)',
                    color: '#6366F1',
                    minWidth: 'fit-content',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <AttachMoney sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{ 
                        fontWeight: 700,
                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {dashboardData?.monthlyRevenue ? `${dashboardData.monthlyRevenue.toLocaleString('no-NO')} kr` : '0 kr'}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' }, fontWeight: 500 }}
                    >
                      Månedens Inntekt
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid2>
          
          <Grid2 size={{ xs: 6, sm: 6, md: 3 }}>
            <MuiCard sx={{ 
              height: '100%',
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: `linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)`,
                opacity: 0,
                transition: 'opacity 0.3s ease',
              },
              '&:hover': { 
                transform: 'translateY(-6px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
                '&::before': { opacity: 1 }
              }
            }}>
              <MuiCardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'center', sm: 'flex-start' },
                  gap: { xs: 1.5, sm: 2 },
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  <Box sx={{ 
                    p: { xs: 1, sm: 1.5 },
                    borderRadius: 3,
                    bgcolor: 'rgba(245, 158, 11, 0.12)',
                    color: '#F59E0B',
                    minWidth: 'fit-content',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Star sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
                  </Box>
                  <Box>
                    <Typography variant="h5" 
                      sx={{ 
                        fontWeight: 700,
                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                        color: theme.palette.text.primary,
                        lineHeight: 1.2,
                      }}
                    >
                      {dashboardData?.avgRating ? `${dashboardData.avgRating.toFixed(1)}/5.0` : 'N/A'}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' }, fontWeight: 500 }}
                    >
                      Vurdering
                    </Typography>
                  </Box>
                </Box>
              </MuiCardContent>
            </MuiCard>
          </Grid2>
        </Grid2>

        {(evendiBookings.length > 0 || evendiAnalytics) && (
          <MuiCard
            sx={{
              mb: { xs: 3, md: 4 },
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <MuiCardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarToday sx={{ color: customBranding.color }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Evendi Bookinger
                </Typography>
              </Box>

              <Grid2 container spacing={{ xs: 1.5, md: 2 }} sx={{ mb: 2 }}>
                <Grid2 size={{ xs: 12, sm: 4 }}>
                  <Paper sx={{ p: 2, borderRadius: 3, bgcolor: `${customBranding.color}10` }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Totale bookinger
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {evendiBookingSummary.totalBookings}
                    </Typography>
                  </Paper>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 4 }}>
                  <Paper sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(16, 185, 129, 0.12)' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Inntekt (Evendi)
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {evendiBookingSummary.totalRevenue.toLocaleString('no-NO')} kr
                    </Typography>
                  </Paper>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 4 }}>
                  <Paper sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(99, 102, 241, 0.12)' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Kommende eventer
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {evendiBookingSummary.upcomingEvents}
                    </Typography>
                  </Paper>
                </Grid2>
              </Grid2>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                {evendiBookingSummary.statusCounts.map((status) => {
                  const statusColor: 'default' | 'success' | 'warning' | 'error' | 'info' =
                    status.status === 'confirmed'
                      ? 'success'
                      : status.status === 'pending'
                        ? 'warning'
                        : status.status === 'cancelled'
                          ? 'error'
                          : 'info';
                  return (
                    <Chip
                      key={status.status}
                      label={`${status.status}: ${status.count}`}
                      color={statusColor}
                      size="small"
                      variant="outlined"
                    />
                  );
                })}
              </Stack>

              {evendiUpcomingBookings.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Neste bookinger
                  </Typography>
                  <List dense disablePadding>
                    {evendiUpcomingBookings.map((booking, idx) => (
                      <React.Fragment key={booking.id}>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <Event sx={{ color: customBranding.color }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={booking.title || booking.clientName}
                            secondary={`${booking.clientName} • ${new Date(booking.eventDate).toLocaleDateString('no-NO')}`}
                          />
                          <Chip
                            size="small"
                            label={booking.status}
                            color={
                              booking.status === 'confirmed'
                                ? 'success'
                                : booking.status === 'pending'
                                  ? 'warning'
                                  : booking.status === 'completed'
                                    ? 'info'
                                    : 'error'
                            }
                            variant="outlined"
                          />
                        </ListItem>
                        {idx < evendiUpcomingBookings.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Box>
              )}
            </MuiCardContent>
          </MuiCard>
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
                    fontWeight: 500,
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
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRadius: 4,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            // WCAG Compliance: High contrast and focus management
            '&:focus-within': {
              outline: `2px solid ${customBranding.color}`,
              outlineOffset: '2px'
            }
          }}>
            <Box sx={{ 
              borderBottom: 1, 
              borderColor: 'rgba(0,0,0,0.06)',
              background: 'rgba(255, 255, 255, 0.6)',
              px: { xs: 1, sm: 2 },
              pt: 1,
            }}>
              <MuiTabs 
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  minHeight: 56,
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' },
                    minWidth: { xs: 80, sm: 100 },
                    minHeight: 56,
                    px: { xs: 1.5, sm: 2.5 },
                    py: 1.5,
                    borderRadius: '12px 12px 0 0',
                    transition: 'all 0.2s ease',
                    color: 'text.secondary',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.03)',
                      color: 'text.primary',
                    },
                    '&.Mui-selected': {
                      color: customBranding.color,
                      bgcolor: 'rgba(255,255,255,0.8)',
                    }
                  },
                  '& .MuiTabs-indicator': {
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                    backgroundColor: customBranding.color,
                    boxShadow: `0 0 8px ${customBranding.color}60`,
                  },
                  '& .MuiTab-iconWrapper': {
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    marginBottom: '4px !important',
                  },
                  '& .MuiTabs-flexContainer': {
                    gap: 0.5,
                  }
                }}
              >
                {availableTabs.map((tab, index) => {
                  return (
                    <Tab 
                      key={tab.id}
                      value={index}
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
              
              {/* Feature Analytics Display - HIDDEN */}
              {/* <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                gap: 1,
                mt: 1,
                pb: 1,
                px: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Tilgjengelige faner: {availableTabs.length}/{config.tabs.length}
                  </Typography>
                  <Chip 
                    label={`${Math.round((availableTabs.length / config.tabs.length) * 100)}%`}
                    size="small"
                    variant="outlined"
                    color={availableTabs.length === config.tabs.length ? 'success' : 'warning'}
                    sx={{ fontSize: '0.65rem', height: 18, '& .MuiChip-label': { px: 1 } }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
                  </Typography>
                  <Chip 
                    label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '10px', height: 20 }}
                  />
                </Box>
              </Box> */}
            </Box>

          <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'overview')}>
            {/* Unified Customer Inquiry & Email Center - Floating Overlay */}
            <Box sx={{ 
              mb: { xs: 3, md: 4 },
              position: 'relative',
              zIndex: 10,
              backgroundColor: 'background.paper',
              borderRadius: 2,
              p: { xs: 2, md: 3 },
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(10px)',
              border: '1px solid',
              borderColor: 'divider'
            }}>
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
                Kundeforespørsler & Kommunikasjon
              </Typography>
              
              <Grid2 container spacing={{ xs: 2, md: 3 }}>
                <Grid2 size={{ xs: 12 }}>
                  <CustomerInquiryCenter 
                    profession={profession} 
                    userId={userId} 
                    customBranding={customBranding}
                    onCreateProjectFromSubmission={(submissionData) => {
                      setUiSettings(prev => ({
                        ...prev,
                        submissionProjectData: submissionData
                      }));
                      setShowProjectCreation(true);
                    }}
                  />
                </Grid2>
              </Grid2>
            </Box>

            {/* Enhanced Kommende Prosjekter Section */}
            <Grid2 container spacing={{ xs: 2, md: 3 }}>
              <Grid2 size={{ xs: 12 }}>
                <Box sx={{ mb: 4 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                      mb: 3 }}>
                    <Typography variant="h6" 
                      sx={{ 
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: theming.colors.primary
                      }}>
                      {professionSupports('camera_projects') && 'Kommende Prosjekter'}
                      {professionSupports('music_projects') && 'Kommende Musikkprosjekter'}
                      {profession === 'videographer' && 'Kommende Videoer'}
                      {professionSupports('vendor_products') && 'Innkommende Bestillinger'}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const projectsTabIndex = availableTabs.findIndex(tab => tab.id === 'projects');
                        if (projectsTabIndex !== -1) setTabValue(projectsTabIndex);
                      }}
                    >
                      Se alle
                    </Button>
                  </Box>

                  {/* Display upcoming projects - projects list grid */}
                  {upcomingLoading ? (
                    <Grid2 container spacing={2}>
                      {[1, 2, 3, 4].map(index => (
                        <Grid2 size={{ xs: 12, sm: 6 }} key={index}>
                          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
                        </Grid2>
                      ))}
                    </Grid2>
                  ) : (!upcomingProjects || upcomingProjects.length === 0) ? (
                    <MuiCard sx={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
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
                      </Typography>
                      <Button variant="contained"
                        startIcon={<PhotoCamera />}
                        onClick={() => setShowProjectCreation(true)}
                        sx={{
                          backgroundColor: customBranding.color, '&:hover': { backgroundColor: alpha(customBranding.color, 0.8) }
                        }}
                      >
                        Opprett Prosjekt
                      </Button>
                    </MuiCard>
                  ) : (
                    <Grid2 container spacing={2}>
                      {(Array.isArray(upcomingProjects) ? upcomingProjects : []).map((project: any, _index: number) => {
                        const projectDate = new Date(project.eventDate || project.date);
                        const today = new Date();
                        const daysUntil = Math.ceil((projectDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                        const isUrgent = daysUntil <= 3;
                        const urgencyColor = isUrgent ? '#f44336' : '#4caf50';
                        const progressValue = Math.max(0, Math.min(100, ((7 - daysUntil) / 7) * 100));

                        return (
                          <Grid2 size={{ xs: 12, sm: 6 }} key={project.id}>
                            <MuiCard
                              sx={{
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: `1px solid ${alpha(urgencyColor, 0.2)}`,
                                borderRadius: 3,
                                overflow: 'hidden',
                                position: 'relative',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer','&:hover': {
                                  transform: 'translateY(-4px)',
                                  boxShadow: `0 12px 24px ${alpha(urgencyColor, 0.15)}`
                                }
                              }}
                              onClick={() => handleOpenProjectOverview(project, 'timeline')}
                            >
                              <MuiCardContent sx={{ p: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                  {project.title || project.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {project.clientName}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Event sx={{ fontSize: 16 }} />
                                  <Typography variant="body2">
                                    {new Date(project.eventDate || project.date).toLocaleDateString('no-NO')}
                                  </Typography>
                                </Box>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={progressValue}
                                  sx={{ height: 6, borderRadius: 3 }}
                                />
                              </MuiCardContent>
                              <MuiCardActions sx={{ p: 1.5, pt: 0, gap: 1 }}>
                                <Button size="small" startIcon={<Phone />}>Ring</Button>
                                <Button size="small" startIcon={<Email />}>E-post</Button>
                              </MuiCardActions>
                            </MuiCard>
                          </Grid2>
                        );
                      })}
                    </Grid2>
                  )}
                </Box>
              </Grid2>
            </Grid2>

            {/* Location Intelligence Widget */}
            {locationIntelligence.weatherData && (
              <Box sx={{ mb: 3 }}>
                <MuiCard sx={{ 
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                  '&:before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #6366F1 0%, #10B981 50%, #F59E0B 100%)',
                  }
                }}>
                  <MuiCardContent sx={{ pt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                      <Typography variant="h6" sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        color: theme.palette.text.primary,
                        fontWeight: 700,
                      }}>
                        <WbSunny sx={{ color: '#F59E0B' }} />
                        Lokasjonsintelligens
                        {detectedLocation && (
                          <Chip 
                            label={locationPermissionDenied ? '📍 Oslo (standard)' : '📍 Din posisjon'} 
                            size="small" 
                            sx={{ 
                              ml: 1,
                              bgcolor: locationPermissionDenied ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: locationPermissionDenied ? '#F59E0B' : '#10B981',
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          />
                        )}
                      </Typography>
                      
                      {locationPermissionDenied && (
                        <Tooltip title="Tillat plasseringstilgang for å få værdata for din lokasjon">
                          <IconButton 
                            size="small"
                            onClick={() => {
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  (position) => {
                                    setDetectedLocation({
                                      lat: position.coords.latitude,
                                      lng: position.coords.longitude,
                                    });
                                    setLocationPermissionDenied(false);
                                  },
                                  () => setLocationPermissionDenied(true)
                                );
                              }
                            }}
                            sx={{ 
                              bgcolor: 'rgba(99, 102, 241, 0.1)',
                              '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' }
                            }}
                          >
                            <LocationOn sx={{ fontSize: '1.2rem', color: '#6366F1' }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    
                    <Grid2 container spacing={2}>
                      {/* Weather Information */}
                      <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper sx={{ 
                          p: 2.5, 
                          bgcolor: 'rgba(99, 102, 241, 0.06)',
                          borderRadius: 3,
                          border: '1px solid rgba(99, 102, 241, 0.1)',
                          height: '100%'
                        }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#6366F1', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <WbCloudy sx={{ fontSize: '1.1rem' }} />
                            Værmelding
                          </Typography>
                          <Typography variant="h4" sx={{ color: '#6366F1', fontWeight: 700 }}>
                            {locationIntelligence.weatherData.temperature}°C
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Vind: {locationIntelligence.weatherData.windSpeed} m/s
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Sikt: {locationIntelligence.weatherData.visibility} km
                          </Typography>
                        </Paper>
                      </Grid2>
                      
                      {/* Weather Forecast */}
                      {locationIntelligence.weatherForecast && (
                        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                          <Paper sx={{ 
                            p: 2.5, 
                            bgcolor: 'rgba(16, 185, 129, 0.06)',
                            borderRadius: 3,
                            border: '1px solid rgba(16, 185, 129, 0.1)',
                            height: '100%'
                          }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#10B981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CalendarToday sx={{ fontSize: '1.1rem' }} />
                              5-dagers prognose
                            </Typography>
                            {locationIntelligence.weatherForecast.forecast.slice(0, 3).map((day: any, index: number) => (
                              <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">
                                  {new Date(day.date).toLocaleDateString('no-NO', { weekday: 'short' })}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#10B981', fontWeight: 600 }}>
                                  {day.temperature}°C
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        </Grid2>
                      )}
                      
                      {/* Economic Indicators */}
                      {locationIntelligence.economicData && (
                        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                          <Paper sx={{ 
                            p: 2.5, 
                            bgcolor: 'rgba(245, 158, 11, 0.06)',
                            borderRadius: 3,
                            border: '1px solid rgba(245, 158, 11, 0.1)',
                            height: '100%'
                          }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TrendingUp sx={{ fontSize: '1.1rem' }} />
                              Økonomiske indikatorer
                            </Typography>
                            {locationIntelligence.economicData.indicators?.slice(0, 2).map((indicator: any, index: number) => (
                              <Box key={index} sx={{ mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {indicator.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {indicator.value} {indicator.unit}
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        </Grid2>
                      )}
                      
                      {/* Population Data */}
                      {locationIntelligence.populationData && (
                        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                          <Paper sx={{ 
                            p: 2.5, 
                            bgcolor: 'rgba(255, 107, 53, 0.06)',
                            borderRadius: 3,
                            border: '1px solid rgba(255, 107, 53, 0.1)',
                            height: '100%'
                          }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: customBranding.color, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Group sx={{ fontSize: '1.1rem' }} />
                              Befolkningsdata
                            </Typography>
                            <Typography variant="h6" sx={{ color: customBranding.color, fontWeight: 700 }}>
                              {locationIntelligence.populationData.data?.population?.toLocaleString() || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Oslo befolkning
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Vekst: {locationIntelligence.populationData.data?.growth || 0}%
                            </Typography>
                          </Paper>
                        </Grid2>
                      )}
                    </Grid2>
                  </MuiCardContent>
                </MuiCard>
              </Box>
            )}
            
                {/* Story Arc Projects Section - Only for Videographers */}
                {profession === 'videographer' && storyArcProjectsData && storyArcProjectsData.length > 0 && (
                  <Box sx={{ mb: 4, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MovieCreation sx={{ color: customBranding.color }} />
                        Story Arc Projects
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setProEditorMode(true);
                          const overviewTabIndex = availableTabs.findIndex(tab => tab.id === 'overview');
                          setTabValue(overviewTabIndex >= 0 ? overviewTabIndex : 0);
                        }}
                      >
                        View All
                      </Button>
                    </Box>
                    <Grid2 container spacing={2}>
                      {storyArcProjectsData.map((project: any) => (
                        <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
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
                        </Grid2>
                      ))}
                    </Grid2>
                  </Box>
                )}

                {/* Photo Enhancement Projects Section */}
                {allPhotoProjects && allPhotoProjects.length > 0 && (
                  <Box sx={{ mb: 4, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhotoCamera sx={{ color: customBranding.color }} />
                        Photo Projects
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const photoTabIndex = availableTabs.findIndex(tab => tab.id === 'photo-enhancement' || tab.id === 'ai-enhancement');
                          if (photoTabIndex >= 0) setTabValue(photoTabIndex);
                        }}
                      >
                        View All
                      </Button>
                    </Box>
                    <Grid2 container spacing={2}>
                      {allPhotoProjects.map((project: any) => (
                        <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
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
                        </Grid2>
                      ))}
                    </Grid2>
                  </Box>
                )}

                {/* Audio Enhancement Projects Section */}
                {profession === 'music_producer' && audioProjectsData && audioProjectsData.length > 0 && (
                  <Box sx={{ mb: 4, mt: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LibraryMusic sx={{ color: customBranding.color }} />
                        Audio Projects
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const audioTabIndex = availableTabs.findIndex(tab => tab.id === 'audio');
                          if (audioTabIndex >= 0) setTabValue(audioTabIndex);
                        }}
                      >
                        View All
                      </Button>
                    </Box>
                    <Grid2 container spacing={2}>
                      {audioProjectsData.map((project: any) => (
                        <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
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
                        </Grid2>
                      ))}
                    </Grid2>
                  </Box>
                )}


                {/* Professional Orchestration System - Modern Design */}
                <MuiCard
                  component="section"
                  role="region"
                  aria-label="Smart arbeidsflyt system"
                  sx={{ 
                    mt: { xs: 3, md: 4 },
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(16, 185, 129, 0.03) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(99, 102, 241, 0.12)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      borderColor: 'rgba(99, 102, 241, 0.25)',
                      boxShadow: `0 8px 32px ${alpha('#6366F1', 0.12)}`,
                      transform: 'translateY(-2px)'
                    },
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #6366F1 0%, #10B981 50%, #F59E0B 100%)',
                    }
                  }}
                >
                  <MuiCardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 3
                    }}>
                      <Typography variant="h5" 
                        sx={{ 
                          fontWeight: 700, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1.5,
                          fontSize: { xs: '1.25rem', sm: '1.5rem' },
                          background: 'linear-gradient(135deg, #6366F1 0%, #10B981 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text'
                        }}
                        component="h4"
                        aria-level={4}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.2)'
                          }}
                        >
                          <Build 
                            sx={{ 
                              fontSize: '1.25rem',
                              color: '#6366F1'
                            }}
                            aria-hidden="true"
                          />
                        </Box>
                        Smart Arbeidsflyt
                      </Typography>
                      
                      <Chip 
                        icon={<AutoAwesome sx={{ fontSize: '1rem' }} />}
                        label="AI-drevet"
                        size="small"
                        sx={{
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          color: '#6366F1',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          '& .MuiChip-icon': {
                            color: '#10B981'
                          }
                        }}
                      />
                    </Box>
                    
                    {/* Smart arbeidsflyt - keyboard-activated workflow automation */}
                    <Box
                      sx={{
                        position: 'relative',
                        '&:before': {
                          content: '""',
                          position: 'absolute',
                          top: -16,
                          left: -16,
                          right: -16,
                          bottom: -16,
                          background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
                          pointerEvents: 'none',
                          zIndex: 0
                        }
                      }}
                    >
                      <SmartWorkflowBuilder profession={profession} />
                    </Box>
                  </MuiCardContent>
                </MuiCard>

              {/* Personalized News & Insights */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                  <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Personalisert Nyheter & Innsikter
                </Typography>
                <PersonalizedNewsInterface 
                  userId={userId}
                  profession={profession}
                  userEquipment={[]}
                />
              </Box>

              {/* Centralized Sales Hub */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                  <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Senter for Salg & Inntekt
                </Typography>
                <CentralizedSalesHub 
                  userId={userId}
                  profession={profession}
                />
              </Box>

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
                        priority: 'high',
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
            <Grid2 container spacing={{ xs: 2, md: 3 }} sx={{ mt: 3 }}>
                    <Grid2 size={{ xs: 12, md: 6 }}>
                <GoogleWorkspaceStorageInfo 
                  userId={userId}
                  profession={profession}
                  compact={true}
                  showDetailsButton={true}
                />
              </Grid2>
            </Grid2>
          </TabPanel>

          {/* Professional Components Integration via Orchestrator */}
          <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'projects')}>
            {/* Profession-specific project management via orchestrators */}
            {profession === 'photographer' && (
              <FotografOrchestrator />
            )}
            {profession === 'videographer' && (
              <VideografOrchestrator />
            )}
            {profession === 'music_producer' && (
              <MusikkProdusentOrchestrator />
            )}
            {profession === 'vendor' && (
              <VendorOrchestrator />
            )}
            
            {/* Prosjekter - Project Management with Sub-tabs */}
            <Box sx={{ p: 3 }}>
              
              {/* Sub-tabs for Projects */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <MuiTabs 
                  value={projectsTabValue}
                  onChange={(e, val) => setProjectsTabValue(val)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontWeight: 600,
                      '&.Mui-selected': { color: customBranding.color }
                    },
                    '& .MuiTabs-indicator': { backgroundColor: customBranding.color }
                  }}
                >
                  <Tab label="Prosjektoversikt" icon={<Folder />} iconPosition="start" />
                  <Tab label="Prosjektvisning" icon={<Collections />} iconPosition="start" />
                  <Tab label="Innleveringer" icon={<Assessment />} iconPosition="start" />
                  {profession === 'vendor' && (
                    <Tab label="Produkter" icon={<Store />} iconPosition="start" />
                  )}
                </MuiTabs>
              </Box>
              
              {projectsTabValue === 1 && (profession !== 'admin' && profession !== 'vendor') && (
                <ProjectShowcase 
                  userId={userId}
                  profession={profession as 'photographer' | 'videographer' | 'music_producer'}
                  projects={projects}
                  onProjectSelect={setSelectedProject}
                />
              )}
              
              {projectsTabValue === 2 && (
                <SubmissionsOverview 
                  userId={userId}
                  profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
                />
              )}
              
              {profession === 'vendor' && projectsTabValue === 3 && (
                <VendorProductManager 
                  userId={userId}
                />
              )}
              
              {projectsTabValue === 0 && (
              <>
              
              <Grid2 container spacing={{ xs: 2, md: 3 }}>
                <Grid2 size={{ xs: 12 }}>
                  {/* Enhanced Mine Fotografiprosjekter Section with matching design */}
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 3 }}>
                      <Typography variant="h6" 
                        sx={{ 
                          fontWeight: 700,
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
                      <Grid2 container spacing={2}>
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
                            <Grid2 size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                              <Fade in timeout={300 + index * 100}>
                                <MuiCard
                                  sx={{
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
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
                                      content: '""',
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
                            </Grid2>
                        );
                    })}
                      </Grid2>
                    ) : (
                      <MuiCard sx={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
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
                </Grid2>

                {/* Project Timeline Section - Premium Design */}
                <Grid2 size={{ xs: 12 }}>
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      mb: 3 }}>
                      <Typography variant="h6" 
                        sx={{ 
                          fontWeight: 700,
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
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
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
                        <ProjectProvider>
                          <ProjectTimeline
                            selectedProject={selectedProject}
                            projectId={selectedProject?.id || userId}
                            profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
                          />
                        </ProjectProvider>
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
                </Grid2>
              </Grid2>
              
              </>
              )}
            </Box>
          </TabPanel>

          {/* Community Tab - Tab 2 for photographer, videographer, music_producer (NOT vendor) */}
          {profession !== 'vendor' && (
            <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'community')}>
              <CommunityHub userId={userId} profession={profession} />
            </TabPanel>
          )}

          {/* Enterprise Team Management Tab */}
          {profession === 'enterprise' && (
            <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'team-management')}>
              <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box component="img" src="/norwed.png" alt="Norwedfilm" sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'contain', bgcolor: '#f5f5f5', p: 0.5 }} />
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#6c3483' }}>Teamadministrasjon</Typography>
                    <Typography variant="body2" color="text.secondary">Administrer teammedlemmer, roller og tilganger</Typography>
                  </Box>
                </Box>

                <Grid2 container spacing={3}>
                  <Grid2 size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: '#6c3483' }}>3</Typography>
                      <Typography variant="body2" color="text.secondary">Aktive medlemmer</Typography>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                        <PhotoCamera sx={{ color: '#2e7d32' }} />
                        <VideoLibrary sx={{ color: '#1565c0' }} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">Foto + Video Team</Typography>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Typography variant="h3" sx={{ fontWeight: 700, color: 'success.main' }}>Aktiv</Typography>
                      <Typography variant="body2" color="text.secondary">Enterprise abonnement</Typography>
                    </Paper>
                  </Grid2>
                </Grid2>

                <Paper sx={{ p: 3, mt: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Teammedlemmer</Typography>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { p: 1.5, borderBottom: '1px solid', borderColor: 'divider' } }}>
                    <thead>
                      <tr>
                        <Box component="th" sx={{ textAlign: 'left', fontWeight: 600 }}>Medlem</Box>
                        <Box component="th" sx={{ textAlign: 'left', fontWeight: 600 }}>Rolle</Box>
                        <Box component="th" sx={{ textAlign: 'left', fontWeight: 600 }}>Status</Box>
                        <Box component="th" sx={{ textAlign: 'left', fontWeight: 600 }}>Academy</Box>
                        <Box component="th" sx={{ textAlign: 'left', fontWeight: 600 }}>Community</Box>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { email: 'admin@norwedfilm.no', role: 'Admin', status: 'Aktiv' },
                        { email: 'fotograf@norwedfilm.no', role: 'Fotograf', status: 'Aktiv' },
                        { email: 'videograf@norwedfilm.no', role: 'Videograf', status: 'Aktiv' },
                      ].map((m) => (
                        <tr key={m.email}>
                          <td>{m.email}</td>
                          <td><Chip label={m.role} size="small" color={m.role === 'Admin' ? 'primary' : 'default'} variant="outlined" /></td>
                          <td><Chip label={m.status} size="small" color="success" variant="outlined" /></td>
                          <td><Chip label="Aktiv" size="small" color="info" variant="outlined" /></td>
                          <td><Chip label="Aktiv" size="small" color="info" variant="outlined" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                </Paper>
              </Box>
            </TabPanel>
          )}

          {/* The Role Room — Casting & Crew management (shared across all professions) */}
          <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'role-room')}>
            <RoleRoomDashboardPanel
              userId={userId}
              profession={profession}
              creatorhubProjectId={selectedProject?.id}
            />
          </TabPanel>

          {/* Dynamically render tabs based on profession */}
          {profession === 'photographer' ? (
            <>
              {/* Tab 4: Evendi */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'wedding-timeline')}>
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
                      <Tab 
                        label="Klient Tilgang" 
                        icon={<Key />}
                        iconPosition="start"
                      />
                    </MuiTabs>
                  </Box>

                  {selectedTimelineTab === 0 && (
                    <EvendiTimelineAdmin 
                      projectId={selectedProject?.id || projects?.[0]?.id || userId}
                      evendiCoupleId={evendiCoupleId || undefined}
                      eventType={selectedProject?.eventType || selectedProject?.projectType || projects?.[0]?.eventType || projects?.[0]?.projectType}
                      projectIntegration={{
                        projectId: selectedProject?.id || projects?.[0]?.id,
                        weddingTimelineIntegrated: true,
                      }}
                    />
                  )}

                  {selectedTimelineTab === 1 && (
                    <>
                      <WeddingTimelineOverview 
                        photographerId={userId}
                      />
                    </>
                  )}

                  {selectedTimelineTab === 2 && (
                    <>
                      <WeddingTimelineClientView 
                        timelineId={userId} // Real user timeline ID
                        isPhotographer={true}
                        photographerId={userId}
                      />
                    </>
                  )}

                  {selectedTimelineTab === 3 && (
                    <WeddingTimelineChangesOverview userId={userId} />
                  )}
                  
                  {selectedTimelineTab === 4 && (
                    <WeddingTimelineClientAccess 
                      {...({ photographerId: userId, timelineId: userId } as any)}
                    />
                  )}
                </Box>
              </TabPanel>

              {/* Tab 4: Showcase Admin */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'showcase-admin')}>
                <Box sx={{ p: 0 }}>
                  <ShowcaseAdmin userId={userId} profession={profession} />
                </Box>

              </TabPanel>

              {/* Tab 4b: Showcase Publisher */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'showcase-publisher')}>
                <ShowcasePublisherPanel userId={userId} />
              </TabPanel>

              {/* Tab 5: Universal Showcase Viewer */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'showcase-viewer')}>
                <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <SettingsProvider>
                  <ThemeProvider>
                  <RealTimeProvider>
                  <VisualEditorProvider>
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
                  </VisualEditorProvider>
                  </RealTimeProvider>
                  </ThemeProvider>
                  </SettingsProvider>
                </Box>
              </TabPanel>

              {/* Tab 6: Universal Download Manager */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'downloads')}>
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'file-upload')}>
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'ai-enhancement')}>
                <PhotoEnhancementSuite 
                  userId={userId} 
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />
              </TabPanel>

              {/* Tab 9: E-post - Integrated Email Center */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'email-center')}>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: theming.colors.primary }}>
                    <Email sx={{ mr: 1, verticalAlign: 'middle' }} />
                    E-postsenter
                  </Typography>
                  
                  {/* Sub-tabs for Email Center */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <MuiTabs 
                      value={emailTabValue}
                      onChange={(e, val) => setEmailTabValue(val)}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 600,
                          '&.Mui-selected': { color: customBranding.color }
                        },
                        '& .MuiTabs-indicator': { backgroundColor: customBranding.color }
                      }}
                    >
                      <Tab label="Innboks" icon={<Email />} iconPosition="start" />
                      <Tab label="Design E-post" icon={<Edit />} iconPosition="start" />
                      <Tab label="Prosjekthistorikk" icon={<AccessTime />} iconPosition="start" />
                    </MuiTabs>
                  </Box>
                  
                  {emailTabValue === 0 && <SmartEmailCenter profession={profession} userId={userId} />}
                  {emailTabValue === 1 && <EmailDesigner userId={userId} profession={profession} />}
                  {emailTabValue === 2 && <EmailProjectHistory {...({ userId, selectedProject } as any)} />}
                </Box>
              </TabPanel>

              {/* Tab 10: Worklog */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'worklog')}>
                <UniversalWorklog
                  projectId={selectedProject?.id || userId}
                  userId={userId}
                  profession={getComponentProfession(profession) as any}
                />
              </TabPanel>

              {/* Tab 11: Kunder - Universal CRM System with Pricing */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'clients')}>
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
                    <Grid2 container spacing={3}>
                      {/* CRM Dashboard Section */}
                      <Grid2 size={{ xs: 12 }}>
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
                                setUniversalSelectedClient(customer as any);
                                console.log('Customer selected:', customer?.name || customer?.id);
                              }}
                            />
                          </MuiCardContent>
                        </MuiCard>
                      </Grid2>
                    </Grid2>
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
                        <PriceAdministration 
                          profession={profession}
                          userId={userId}
                          selectedProject={selectedProject}
                          onProjectSelect={(project) => {
                            setSelectedProject(project);
                            setUniversalSelectedProject(project);
                          }}
                        />
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'equipment')}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <EnhancedGearTab
                    profession={getComponentProfession(profession, 'musicproducer') as any}
                    className="enhanced-equipment-tab"
                  />
                </Box>
              </TabPanel>

              {/* Tab 13: Filer */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'files')}>
                <GoogleDriveManager 
                  userId={userId} 
                  profession={profession}
                  onProjectUpdate={(project: any) => {
                    if (project && project.id) {
                      updateProject(project.id, project);
                    }
                  }}
                  selectedProject={selectedProject}
                  onProjectSelect={setSelectedProject}
                />
              </TabPanel>

              {/* Tab 14: Support */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'support')}>
                <HelpdeskSystem profession={profession} userId={userId} dashboardFeatures={[]} />
              </TabPanel>

              {/* Tab 15: Innstillinger */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings')}>
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
                            fontWeight: 500,
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
                            label="Evendi" 
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
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Universal Settings Panel */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                              Innstillinger
                            </Typography>
                            <UniversalSettingsPanel 
                              userId={userId}
                              profession={profession}
                            />
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
                          
                          {/* Price Administration */}
                          <Box sx={{ mb: 3 }}>
                            <PriceAdministration 
                              profession={profession}
                              userId={userId}
                              selectedProject={selectedProject}
                              onProjectSelect={(project) => {
                                setSelectedProject(project);
                                setUniversalSelectedProject(project);
                              }}
                            />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Pricing Management */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                              Avansert Prisadministrasjon
                            </Typography>
                            <PricingManagement 
                              profession={profession}
                              userId={userId}
                            />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Split Sheets - Fordeling */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AccountBalance sx={{ fontSize: 20, color: '#9f7aea' }} />
                              Split Sheets
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Administrer inntektsfordeling og avtaler med samarbeidspartnere.
                            </Typography>
                            <SplitSheetManager
                              profession={profession as any}
                              userId={userId}
                            />
                          </Box>
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
                            FAQ Veiledninger & Tutorials
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Tilgang til godkjente tutorials og veiledninger fra CreatorHub Norge community.
                          </Typography>
                          
                          {/* Tutorial Launcher */}
                          <Box sx={{ mb: 3 }}>
                            <TutorialLauncher 
                              userId={userId}
                              profession={profession}
                            />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Interactive Tutorial Creator for Advanced Users */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                              Lag Din Egen Tutorial
                            </Typography>
                            <InteractiveTutorialCreator 
                              userId={userId}
                              profession={profession}
                            />
                          </Box>
                          
                          <Divider sx={{ my: 3 }} />
                          
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

                          {marketplaceInstallNotice && (
                            <Alert severity="success" sx={{ mb: 2 }}>
                              {marketplaceInstallNotice}
                            </Alert>
                          )}
                          
                          {/* Featured App: ResumeBuilder */}
                          <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                              ⭐ Featured App
                            </Typography>
                            <CreatorHubMarketplace 
                              onSelect={handleMarketplaceInstall}
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
                              Evendi Administrasjon
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                              Administrer arrangementer for dine prosjekter med kulturtilpasning og klienttilgang via Evendi.
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'communication')}>
                <Box sx={{ p: 3 }}>
                  <Grid2 container spacing={3}>
                    <Grid2 size={{ xs: 12, lg: 8 }}>
                      <UniversalCommunication 
                        profession={profession as any}
                        userId={userId}
                      />
                    </Grid2>
                    <Grid2 size={{ xs: 12, lg: 4 }}>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                        Direktemelding
                      </Typography>
                      <ChatWidget 
                        {...({ userId, profession } as any)}
                      />
                    </Grid2>
                  </Grid2>
                </Box>
              </TabPanel>

              {/* Tab 10: Filer */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'files')}>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: theming.colors.primary }}>
                    <FolderOpen sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Filbehandling
                  </Typography>
                  
                  {/* File Management with Google Drive Integration */}
                  <Grid2 container spacing={3}>
                    <Grid2 size={{ xs: 12, md: 8 }}>
                      <FilesTab 
                        userId={userId}
                        profession={profession}
                        selectedProject={selectedProject}
                        onProjectSelect={setSelectedProject}
                      />
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <GoogleWorkspaceStorageInfo userId={userId} />
                    </Grid2>
                  </Grid2>
                </Box>
              </TabPanel>

              {/* Tab 11: Innstillinger */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings')}>
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
                            fontWeight: 500,
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
                      <PriceAdministration 
                        profession={profession} 
                        userId={userId}
                        selectedProject={selectedProject}
                        onProjectSelect={(project) => {
                          setSelectedProject(project);
                          setUniversalSelectedProject(project);
                        }}
                        onProjectUpdate={(projectUpdate) => {
                          // Update project in context
                          if (projectUpdate?.id && selectedProject?.id === projectUpdate.id) {
                            setSelectedProject({ ...selectedProject, ...projectUpdate });
                          }
                        }}
                        onContractCreate={(contractData) => {
                          // Navigate to contracts or show contract creation dialog
                          console.log('Contract creation requested:', contractData);
                        }}
                      />
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'communication')}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Tab: Administrasjon */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'administration')}>
                <Box sx={{ p: 3 }}>
                  <Grid2 container spacing={3}>
                    <Grid2 size={{ xs: 12 }}>
                      <AdministrationHub
                        userId={userId}
                        profession={profession}
                        selectedClient={selectedClient}
                        evendiCoupleId={evendiCoupleId || undefined}
                        onPricingUpdate={() => {
                          console.log('Pricing updated');
                        }}
                      />
                    </Grid2>
                    
                    <Grid2 size={{ xs: 12, md: 6 }}>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                        <Article sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Kontraktsenter
                      </Typography>
                      <UniversalContractHub 
                        userId={userId}
                        profession={profession}
                      />
                    </Grid2>
                    
                    <Grid2 size={{ xs: 12, md: 6 }}>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                        <Edit sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Signaturoversikt
                      </Typography>
                      <SignatureStatusOverview />
                    </Grid2>
                  </Grid2>
                </Box>
              </TabPanel>

              {/* Tab 17: Integration Test */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'integration-test')}>
                <UniversalDashboardIntegrationTest
                  profession={profession as any}
                  userId={userId}
                  projectId={selectedProject?.id || userId}
                />
              </TabPanel>
            </>
          ) : profession === 'videographer' ? (
            <>
              {/* Tab 3: Evendi */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'wedding-timeline')}>
                <Box>
                    <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: theming.colors.primary }}>
                    Evendi
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Det fullstendige Evendi tidslinje-systemet er tilgjengelig som en egen modul.
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
                    Åpne Evendi
                  </Button>
                </Box>
              </TabPanel>

              {/* Tab 4: Showcase Admin - For videographers */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'showcase-admin')}>
                <ShowcaseAdmin userId={userId} profession={profession} />
              </TabPanel>

              {/* Tab 5: Universal Showcase Viewer - For videographers */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'showcase-viewer')}>
                <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <SettingsProvider>
                  <ThemeProvider>
                  <RealTimeProvider>
                  <VisualEditorProvider>
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
                  </VisualEditorProvider>
                  </RealTimeProvider>
                  </ThemeProvider>
                  </SettingsProvider>
                </Box>
              </TabPanel>

              {/* Tab 6: Universal Download Manager - For videographers */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'downloads')}>
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'file-upload')}>
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'ai-enhancement')}>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: theming.colors.primary }}>
                    <MovieCreation sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Video AI & Forbedring
                  </Typography>
                  
                  {/* Story Arc Generator */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                      <MovieCreation sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Story Arc Generator
                    </Typography>
                    <StoryArcGenerator 
                      userId={userId}
                      selectedProject={selectedProject}
                    />
                  </Box>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  {/* Video Editor Integration */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      Video Redigering
                    </Typography>
                    <VideoEditor />
                  </Box>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  {/* AI Enhancement Tools */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      AI Forbedringer
                    </Typography>
                    <PhotoEnhancementSuite 
                      userId={userId} 
                      selectedProject={selectedProject}
                      onProjectSelect={setSelectedProject}
                    />
                  </Box>
                  
                  <Divider sx={{ my: 3 }} />
                  
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      Lyd Forbedring
                    </Typography>
                    <AudioEnhancementSuite 
                      userId={userId}
                      selectedProject={selectedProject}
                      onProjectSelect={setSelectedProject}
                    />
                  </Box>
                </Box>
              </TabPanel>

              {/* Tab 9: E-post - Integrated Email Center */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'email-center')}>
                <SmartEmailCenter profession={profession} userId={userId} />
              </TabPanel>

              {/* Tab 10: Worklog */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'worklog')}>
                <UniversalWorklog 
                  projectId={userId}
                  userId={userId}
                  profession={getComponentProfession(profession, 'musicproducer') as any}
                />
              </TabPanel>

              {/* Tab 11: Kunder */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'clients')}>
                <ProfessionAdapter profession={profession as any} tabIndex={7} projectId={userId} />
              </TabPanel>

              {/* Tab 12: Utstyr */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'equipment')}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  {/* Sub-tabs for Equipment */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <MuiTabs 
                      value={equipmentTabValue}
                      onChange={(e, val) => setEquipmentTabValue(val)}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 600,
                          '&.Mui-selected': { color: customBranding.color }
                        },
                        '& .MuiTabs-indicator': { backgroundColor: customBranding.color }
                      }}
                    >
                      <Tab label="Utstyrsoversikt" icon={<CameraAlt />} iconPosition="start" />
                      <Tab label="Kamera Manager" icon={<PhotoCamera />} iconPosition="start" />
                      <Tab label="Utstyrsnyheter" icon={<Article />} iconPosition="start" />
                    </MuiTabs>
                  </Box>
                  
                  {equipmentTabValue === 0 && <EquipmentManagementDB />}
                  {equipmentTabValue === 1 && <CameraEquipmentManager {...({ userId } as any)} />}
                  {equipmentTabValue === 2 && (
                    <EnhancedGearTab
                      profession={getComponentProfession(profession, 'musicproducer') as any}
                      className="enhanced-equipment-tab"
                    />
                  )}
                </Box>
              </TabPanel>

              {/* Tab 10: Filer */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'files')}>
                <Box sx={{ p: 3 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: theming.colors.primary }}>
                    <FolderOpen sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Filbehandling
                  </Typography>
                  
                  {/* File Management with multiple options */}
                  <Grid2 container spacing={3}>
                    <Grid2 size={{ xs: 12, lg: 8 }}>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                          Mine Filer
                        </Typography>
                        <FilesTab 
                          userId={userId}
                          profession={profession}
                        />
                      </Box>
                    </Grid2>
                    <Grid2 size={{ xs: 12, lg: 4 }}>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, mb: 3 }}>
                        <GoogleWorkspaceStorageInfo userId={userId} />
                      </Box>
                      
                      {/* Google Drive Manager alt */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                          Google Drive Synkronisering
                        </Typography>
                        <GoogleDriveManager 
                          userId={userId}
                          profession={profession}
                        />
                      </Box>
                    </Grid2>
                  </Grid2>
                </Box>
              </TabPanel>

              {/* Tab 11: Innstillinger */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings')}>
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
                            fontWeight: 500,
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
                          <PriceAdministration 
                            profession={profession}
                            userId={userId}
                            selectedProject={selectedProject}
                            onProjectSelect={(project) => {
                              setSelectedProject(project);
                              setUniversalSelectedProject(project);
                            }}
                          />
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Split Sheets - Fordeling */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AccountBalance sx={{ fontSize: 20, color: '#9f7aea' }} />
                              Split Sheets
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Administrer inntektsfordeling og avtaler med samarbeidspartnere.
                            </Typography>
                            <SplitSheetManager
                              profession={profession as any}
                              userId={userId}
                            />
                          </Box>
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'communication')}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Tab: Administrasjon */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'administration')}>
                <AdministrationHub
                  userId={userId}
                  profession={profession}
                  selectedClient={selectedClient}
                  evendiCoupleId={evendiCoupleId || undefined}
                  onPricingUpdate={() => {
                    console.log('Pricing updated');
                  }}
                />
              </TabPanel>

              {/* Tab 13: Integration Test */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'integration-test')}>
                <UniversalDashboardIntegrationTest
                  profession={profession as any}
                  userId={userId}
                  projectId={selectedProject?.id || userId}
                />
              </TabPanel>
            </>
          ) : (
            <>
              {/* For other professions without wedding-timeline and showcase */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'worklog') >= 0 ? availableTabs.findIndex(tab => tab.id === 'worklog') : 2}>
                <UniversalWorklog 
                  projectId={userId}
                  userId={userId}
                  profession={getComponentProfession(profession, 'musicproducer') as any}
                />
              </TabPanel>

              {/* Tab 3: Universal Showcase for Music Producers, CRM for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'showcase-viewer') >= 0 ? availableTabs.findIndex(tab => tab.id === 'showcase-viewer') : 3}>
                  <Box sx={{ p: 0, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <SettingsProvider>
                    <ThemeProvider>
                    <RealTimeProvider>
                    <VisualEditorProvider>
                    <UniversalShowcase
                      profession={profession as any}
                      userId={userId}
                      maxItems={50}
                    />
                    </VisualEditorProvider>
                    </RealTimeProvider>
                    </ThemeProvider>
                    </SettingsProvider>
                  </Box>
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'clients') >= 0 ? availableTabs.findIndex(tab => tab.id === 'clients') : 3}>
                  <UniversalCRMDashboard 
                    profession={profession as any}
                    onCustomerSelect={(customer) => {
                      // Real customer selected from CRM system
                      setUniversalSelectedClient(customer as any);
                      console.log('Customer selected from CRM:', customer?.name || customer?.id);
                    }}
                  />
                </TabPanel>
              )}

              {/* Split Sheets moved to Prisadministrasjon sub-tab for all professions */}

              {/* Tab 4: Universal Downloads for Music Producers, Equipment for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'downloads') >= 0 ? availableTabs.findIndex(tab => tab.id === 'downloads') : 4}>
                  <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <UniversalDownload
                      items={[]}
                      profession={profession as any}
                    />
                  </Box>
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'equipment') >= 0 ? availableTabs.findIndex(tab => tab.id === 'equipment') : 4}>
                  <ProfessionAdapter profession={profession as any} tabIndex={4} projectId={userId} />
                </TabPanel>
              )}

              {/* Tab 5: Universal File Upload for Music Producers, Files for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'file-upload') >= 0 ? availableTabs.findIndex(tab => tab.id === 'file-upload') : 5}>
                  <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                    <UniversalFileUpload
                      profession={profession}
                    />
                  </Box>
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'files') >= 0 ? availableTabs.findIndex(tab => tab.id === 'files') : 5}>
                  <GoogleDriveManager 
                    userId={userId} 
                    profession={profession as any}
                    onProjectUpdate={(project: any) => updateProject(project.id, project)}
                    selectedProject={selectedProject}
                    onProjectSelect={setSelectedProject}
                  />
                </TabPanel>
              )}

              {/* Tab 6: Audio AI for Music Producers, Support for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'ai-enhancement') >= 0 ? availableTabs.findIndex(tab => tab.id === 'ai-enhancement') : 6}>
                  <AudioEnhancementSuite 
                    userId={userId}
                    selectedProject={selectedProject}
                    onProjectSelect={setSelectedProject}
                  />
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'support') >= 0 ? availableTabs.findIndex(tab => tab.id === 'support') : 6}>
                  <ProfessionAdapter profession={profession as any} tabIndex={6} projectId={userId} />
                </TabPanel>
              )}

              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings') >= 0 ? availableTabs.findIndex(tab => tab.id === 'settings') : 7}>
                <GoogleDriveManager 
                  userId={userId} 
                  profession={getComponentProfession(profession) as 'photographer' | 'music_producer' | 'videographer' | 'vendor' | 'enterprise'}
                  onProjectUpdate={(project: any) => updateProject(project.id, project)}
                  selectedProject={selectedProject ?? undefined}
                  onProjectSelect={setSelectedProject}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'integration-test') >= 0 ? availableTabs.findIndex(tab => tab.id === 'integration-test') : 8}>
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
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'communication') >= 0 ? availableTabs.findIndex(tab => tab.id === 'communication') : 8}>
                <UniversalCommunication 
                  profession={profession as any}
                  userId={userId}
                />
              </TabPanel>

              {/* Administrasjon Tab */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'administration') >= 0 ? availableTabs.findIndex(tab => tab.id === 'administration') : 9}>
                <AdministrationHub
                  userId={userId}
                  profession={getComponentProfession(profession) as 'photographer' | 'music_producer' | 'videographer' | 'vendor' | 'enterprise'}
                  selectedClient={selectedClient}
                  evendiCoupleId={evendiCoupleId || undefined}
                  onPricingUpdate={() => {
                    console.log('Pricing updated');
                  }}
                />
              </TabPanel>

              {/* Integration Test Tab */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'integration-test') >= 0 ? availableTabs.findIndex(tab => tab.id === 'integration-test') : 13}>
                <UniversalDashboardIntegrationTest
                  profession={profession as any}
                  userId={userId}
                  projectId={selectedProject?.id || userId}
                />
              </TabPanel>

              {/* Tab 11: Innstillinger - Vendor Implementation */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings') >= 0 ? availableTabs.findIndex(tab => tab.id === 'settings') : 11}>
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
                            fontWeight: 500,
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
                          <PriceAdministration 
                            profession={profession}
                            userId={userId}
                            selectedProject={selectedProject}
                            onProjectSelect={(project) => {
                              setSelectedProject(project);
                              setUniversalSelectedProject(project);
                            }}
                          />
                          
                          <Divider sx={{ my: 3 }} />
                          
                          {/* Split Sheets - Fordeling */}
                          <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AccountBalance sx={{ fontSize: 20, color: '#9f7aea' }} />
                              Split Sheets
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Administrer inntektsfordeling og avtaler med samarbeidspartnere.
                            </Typography>
                            <SplitSheetManager
                              profession={profession as any}
                              userId={userId}
                            />
                          </Box>
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
                            <UniversalKeyboardShortcuts profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'} />
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
                            <PushNotificationSettings userId={currentUser?.id || ''} />
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
                            <Grid2 container spacing={2}>
                              <Grid2 size={{ xs: 12 }}>
                                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                                  <Typography variant="subtitle2" gutterBottom>Tema</Typography>
                                  <Stack direction="row" spacing={1}>
                                    <Chip 
                                      label="Lyst" 
                                      variant={interfacePrefs.theme === 'light' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.theme === 'light' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('theme', 'light')} 
                                    />
                                    <Chip 
                                      label="Mørkt" 
                                      variant={interfacePrefs.theme === 'dark' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.theme === 'dark' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('theme', 'dark')} 
                                    />
                                    <Chip 
                                      label="System" 
                                      variant={interfacePrefs.theme === 'system' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.theme === 'system' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('theme', 'system')} 
                                    />
                                  </Stack>
                                </Paper>
                              </Grid2>
                              <Grid2 size={{ xs: 12 }}>
                                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                                  <Typography variant="subtitle2" gutterBottom>Språk</Typography>
                                  <Stack direction="row" spacing={1}>
                                    <Chip 
                                      label="Norsk (bokmål)" 
                                      variant={interfacePrefs.language === 'nb-NO' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.language === 'nb-NO' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('language', 'nb-NO')} 
                                    />
                                    <Chip 
                                      label="Nynorsk" 
                                      variant={interfacePrefs.language === 'nn-NO' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.language === 'nn-NO' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('language', 'nn-NO')} 
                                    />
                                    <Chip 
                                      label="English" 
                                      variant={interfacePrefs.language === 'en-US' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.language === 'en-US' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('language', 'en-US')} 
                                    />
                                  </Stack>
                                </Paper>
                              </Grid2>
                              <Grid2 size={{ xs: 12 }}>
                                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                                  <Typography variant="subtitle2" gutterBottom>Skriftstørrelse</Typography>
                                  <Stack direction="row" spacing={1}>
                                    <Chip 
                                      label="Liten" 
                                      variant={interfacePrefs.fontSize === 'small' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.fontSize === 'small' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('fontSize', 'small')} 
                                    />
                                    <Chip 
                                      label="Medium" 
                                      variant={interfacePrefs.fontSize === 'medium' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.fontSize === 'medium' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('fontSize', 'medium')} 
                                    />
                                    <Chip 
                                      label="Stor" 
                                      variant={interfacePrefs.fontSize === 'large' ? 'filled' : 'outlined'} 
                                      color={interfacePrefs.fontSize === 'large' ? 'primary' : 'default'} 
                                      onClick={() => updateInterfacePref('fontSize', 'large')} 
                                    />
                                  </Stack>
                                </Paper>
                              </Grid2>
                              <Grid2 size={{ xs: 12 }}>
                                <FormControlLabel
                                  control={
                                    <Switch 
                                      checked={interfacePrefs.compactView} 
                                      onChange={(e) => updateInterfacePref('compactView', e.target.checked)} 
                                    />
                                  }
                                  label="Kompakt visning"
                                />
                              </Grid2>
                              <Grid2 size={{ xs: 12 }}>
                                <FormControlLabel
                                  control={
                                    <Switch 
                                      checked={interfacePrefs.showAnimations} 
                                      onChange={(e) => updateInterfacePref('showAnimations', e.target.checked)} 
                                    />
                                  }
                                  label="Vis animasjoner"
                                />
                              </Grid2>
                              <Grid2 size={{ xs: 12 }}>
                                <FormControlLabel
                                  control={
                                    <Switch 
                                      checked={interfacePrefs.highContrast} 
                                      onChange={(e) => updateInterfacePref('highContrast', e.target.checked)} 
                                    />
                                  }
                                  label="Høykontrastmodus (tilgjengelighet)"
                                />
                              </Grid2>
                            </Grid2>
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
          // Switch to overview (analytics display lives in overview)
          const overviewTabIndex = availableTabs.findIndex(tab => tab.id === 'overview');
          if (overviewTabIndex >= 0) setTabValue(overviewTabIndex);
        }}
        onDriveOpen={() => {
          // Switch to Google Drive integration (Settings > Google Drive)
          const settingsTabIndex = availableTabs.findIndex(tab => tab.id === 'settings');
          if (settingsTabIndex >= 0) {
            setTabValue(settingsTabIndex);
            setSettingsTabValue(2);
          } else {
            const filesTabIndex = availableTabs.findIndex(tab => tab.id === 'files' || tab.id === 'file-upload');
            if (filesTabIndex >= 0) setTabValue(filesTabIndex);
          }
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
          {/* Chat System Status Indicator - HIDDEN */}
          {/* <Box
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
          /> */}
          
          {/* File Management Status Indicators - HIDDEN */}
          {/* <Box
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
          </Box> */}

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
                width: 64,
                height: 64,
                bgcolor: customBranding.color,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  bgcolor: (customBranding as any).darkColor || customBranding.color,
                  transform: 'scale(1.1)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.25)'
                },
                '&:active': {
                  transform: 'scale(0.95)'
                }
              }}
            >
              <Chat sx={{ fontSize: 30 }} />
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
        onClose={(_event, _reason) => {
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
            <RealTimeProvider>
              <VisualEditorProvider>
                <ThemeProvider>
                  <SettingsProvider>
                    <ProjectProvider>
                      <ProjectCreationWithMemoryCards
                        profession={profession as any}
                        userId={userId}
                        evendiCoupleId={evendiCoupleId || undefined}
                        initialData={uiSettings.submissionProjectData} // Pass submission data to pre-fill
                        onProjectCreated={async (_projectData) => {
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
                    </ProjectProvider>
                  </SettingsProvider>
                </ThemeProvider>
              </VisualEditorProvider>
            </RealTimeProvider>
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
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
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
          <Grid2 container spacing={3}>
                    <Grid2 size={{ xs: 12, md: 6 }}>
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
            </Grid2>
                    <Grid2 size={{ xs: 12, md: 6 }}>
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
            </Grid2>
          </Grid2>
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
              {/* Chat System Status Indicator - HIDDEN */}
              {/* <Box
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
              /> */}
            </Box>
            <Button onClick={() => setShowChat(false)}>Lukk</Button>
          </Box>
          <UniversalChatWidget 
            profession={profession as any}
            userId={userId}
            isOpen={true}
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
            zIndex: 100}}
        />
      )}

      {/* Prototype Testing Feedback Component - DISABLED: Now using FloatingActionButtons */}
      {/* {showPrototypeFeedback && (
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
      )} */}

      {/* Prototype Feedback Modal - DISABLED: Now using FloatingActionButtons */}
      {/* <Dialog
        open={showPrototypeFeedback}
        onClose={() => setShowPrototypeFeedback(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
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
      </Dialog> */}

      {/* Project Creation With Memory Cards Modal */}
      <Dialog
        open={showVendorProductDialog}
        onClose={() => setShowVendorProductDialog(false)}
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
          <RealTimeProvider>
            <VisualEditorProvider>
              <ThemeProvider>
                <SettingsProvider>
                  <ProjectProvider>
                    <ProjectCreationWithMemoryCards 
                      profession={profession}
                      userId={userId}
                      evendiCoupleId={evendiCoupleId || undefined}
                      onProjectCreated={async (_projectData) => {
                        // Project successfully created with real data
                        setShowProjectCreation(false);
                        setShowVendorProductDialog(false);
                        // Refresh upcoming projects data
                        await queryClient.invalidateQueries({ queryKey: ['/api/projects', ],});
                        queryClient.invalidateQueries({ queryKey: [`/api/dashboard/${profession}`] });
                      }}
                    />
                  </ProjectProvider>
                </SettingsProvider>
              </ThemeProvider>
            </VisualEditorProvider>
          </RealTimeProvider>
        </DialogContent>
      </Dialog>

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
                    setTabValue(availableTabs.findIndex(tab => tab.id === 'clients'));
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
              const clientsTabIndex = availableTabs.findIndex(tab => tab.id === 'clients');
              if (clientsTabIndex >= 0) setTabValue(clientsTabIndex);
              setShowCrmDialog(false);
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
              <Grid2 container spacing={2}>
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Klient</Typography>
                  <Typography variant="body1">{selectedProject!.clientName || 'Ikke angitt'}</Typography>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={selectedProject!.status}
                    color={selectedProject!.status === 'Fullført' ? 'success' : selectedProject!.status === 'Aktiv' ? 'primary' : 'default'}
                    size="small"
                  />
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Dato</Typography>
                  <Typography variant="body1">
                    {selectedProject!.eventDate || selectedProject!.date ? 
                      new Date(selectedProject!.eventDate || selectedProject!.date || ', ').toLocaleDateString('no-NO', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                }) : 'Ikke satt'
                }
                  </Typography>
                </Grid2>
                <Grid2 size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">Lokasjon</Typography>
                  <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                    {selectedProject!.location || 'Ikke angitt'}
                  </Typography>
                </Grid2>
                {selectedProject!.description && (
                  <Grid2 size={{ xs: 12 }}>
                    <Typography variant="subtitle2" color="text.secondary">Beskrivelse</Typography>
                    <Typography variant="body1">{selectedProject!.description}</Typography>
                  </Grid2>
                )}
              </Grid2>
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
              if (selectedProject) handleEditProject(selectedProject);
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
              <strong>Prosjekt: </strong> {selectedProject!.title || selectedProject!.name}
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
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
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
            <Grid2 container spacing={3}>
              {/* Project Information */}
              <Grid2 size={{ xs: 12 }}>
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
              </Grid2>
              
              {/* Related Items - Contracts, Split Sheets, Quotes */}
              {selectedProjectForOverview?.id && (
                <Grid2 size={{ xs: 12 }}>
                  <RelatedItemsWidget
                    projectId={selectedProjectForOverview.id}
                    profession={profession}
                    onViewContract={(contract) => {
                      // Navigate to contracts tab and show contract
                      const contractsTabIndex = availableTabs.findIndex(tab => tab.id === 'contracts');
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
                      const splitSheetsTabIndex = availableTabs.findIndex(tab => tab.id === 'split-sheets');
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
                      const contractsTabIndex = availableTabs.findIndex(tab => tab.id === 'contracts');
                      if (contractsTabIndex >= 0) {
                        setTabValue(contractsTabIndex);
                        setProjectOverviewOpen(false);
                      }
                    }}
                    onCreateSplitSheet={() => {
                      // Navigate to split sheets tab and open creation
                      const splitSheetsTabIndex = availableTabs.findIndex(tab => tab.id === 'split-sheets');
                      if (splitSheetsTabIndex >= 0) {
                        setTabValue(splitSheetsTabIndex);
                        setProjectOverviewOpen(false);
                      }
                    }}
                    onCreateQuote={() => {
                      // Navigate to price administration and open quote generator
                      const priceTabIndex = availableTabs.findIndex(tab => tab.id === 'pricing');
                      if (priceTabIndex >= 0) {
                        setTabValue(priceTabIndex);
                        setProjectOverviewOpen(false);
                      }
                    }}
                  />
                </Grid2>
              )}
              
              {/* Action Buttons */}
              <Grid2 size={{ xs: 12 }}>
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
              </Grid2>
            </Grid2>
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
                📸 {selectedProject!.title || selectedProject!.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Klient: {selectedProject!.clientName || 'Ikke angitt'}
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
          <SettingsProvider>
          <ThemeProvider>
          <RealTimeProvider>
          <VisualEditorProvider>
          <UniversalShowcase 
            profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'}
            userId={userId}
            isOwner={true}
            adminMode={false}
          />
          </VisualEditorProvider>
          </RealTimeProvider>
          </ThemeProvider>
          </SettingsProvider>
        </Box>
      )}

      {/* Marketplace Dialog */}
      <Dialog
        open={showMarketplace}
        onClose={() => setShowMarketplace(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            minHeight: '80vh',
            maxHeight: '90vh',
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          color: 'white',
          py: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Store />
            <Typography variant="h6" fontWeight={600}>
              Marketplace - Oppdag Nye Verktøy
            </Typography>
          </Box>
          <IconButton
            onClick={() => setShowMarketplace(false)}
            sx={{ color: 'white' }}
            aria-label="Lukk marketplace"
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto' }}>
          <Box sx={{ p: 3 }}>
            {marketplaceInstallNotice && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {marketplaceInstallNotice}
              </Alert>
            )}
            <CreatorHubMarketplace 
              profession={profession}
              userId={userId}
              onSelect={handleMarketplaceInstall}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Universal Prototype Feedback Widget */}
      <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 500 }}>
        <UniversalPrototypeFeedback 
          {...({ userId, profession } as any)}
        />
      </Box>
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