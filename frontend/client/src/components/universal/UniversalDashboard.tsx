// @ts-nocheck
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  getEvendiBookings,
  getEvendiAnalyticsSummary,
  evendiQueryKeys,
  type EvendiBooking,
  type EvendiAnalyticsSummary,
} from '@/lib/evendi-api';
import { useLocation } from 'wouter';
import { trackButtonClick } from '@/hooks/useActionTracker';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/hooks/useAuth';
import { useUrlTab } from '@/hooks/useUrlState';
import { useCmsContent } from '@/hooks/useCmsContent';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { isProfessionFeatureAvailable } from '@shared/profession-feature-matrix';
import AdminIndicator from '../admin/AdminIndicator';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useExternalData } from '../../services/ExternalDataService';
import {
  clearCreatorHubGoogleIntentFromUrl,
  readCreatorHubGoogleCallbackIntent,
} from '@/lib/creatorhubGoogleAuth';
import { UniversalDashboardProvider, useUniversalDashboard } from './UniversalDashboardContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RealTimeProvider } from '@/contexts/RealTimeContext';
import { AcademyProvider } from '@/contexts/AcademyContext';
import { VisualEditorProvider } from '../admin/visual-editor/VisualEditorContext';
import CreatorHubMarketplace from '../resume/ResumeBuilderMarketplace';
import ContractSummaryWidget from '../contract-designer/ContractSummaryWidget';
import RelatedItemsWidget from './shared/RelatedItemsWidget';
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
  CircularProgress,
  alpha,
  Fade,
  Skeleton,
  Switch,
  FormControlLabel,
  Alert,
  Card as MuiCard,
  CardContent as MuiCardContent,
  CardActions as MuiCardActions,
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
  LocalShipping,
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
import { BusinessIntelligenceHub } from '@/components/business-intelligence/BusinessIntelligenceHub';

// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import ProfessionAdapter from './ProfessionAdapter';
import SmartWorkflowBuilder from './SmartWorkflowBuilder'; // Visual workflow builder with action buttons
import FloatingActionButtons from './misc/FloatingActionButtons';
import CreatorHubPhotoEnhancer from './misc/CreatorHubPhotoEnhancer';

// Import Settings Components
import PriceAdministration from '../PriceAdministration';

// Import Tutorial & FAQ System
import { TutorialFAQIntegration } from '../tutorial/TutorialFAQIntegration';
import UniversalDashboardIntegrationTest from './UniversalDashboardIntegrationTest';
import EvendiTimelineAdmin from '../wedding/WeddingTimelineAdmin';

// Import Academy Dashboard
import AcademyDashboard from '../academy/AcademyDashboardCinematic';
// Import Universal Showcase
import UniversalShowcase from './UniversalShowcase';
// Import CreatorHub Icons
import { AcademyIcon } from '../shared/CreatorHubIcons';

// Import Google Drive components
import GoogleDriveManager from '../google-drive/GoogleDriveManager';
import GoogleDriveProjectSync from '../google-drive/GoogleDriveProjectSync';
import GoogleWorkspaceStorageInfo from './GoogleWorkspaceStorageInfo';
import GoogleWorkspaceSessionBadge from './GoogleWorkspaceSessionBadge';

// Import Equipment Management components
// import ComprehensiveEquipmentDashboard from '@/components/universal/misc/ComprehensiveEquipmentDashboard';

// Import Gear News component
import { EnhancedGearTab } from '../dashboard/EnhancedGearTab';
import { QuickMeetingNotesModal } from '../meetings/QuickMeetingNotesModal';
import GoogleWorkspaceMeetingManager from '../meetings/GoogleWorkspaceMeetingManager';
import CustomerInquiryCenter, { type EmailMessage as CustomerInquiryEmailMessage } from '../email/CustomerInquiryCenter';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import UniversalKeyboardShortcuts from '../keyboard-shortcuts/UniversalKeyboardShortcuts';
import SmartTimingPreferences from '../smart-timing/SmartTimingPreferences';
import HelpdeskSystem from './HelpdeskSystem';
// Slice 9X.17 — fotograf-spesifikke widgets som surface'r data fra
// /api/photographer/* inni de generiske dashboardfanene.
import {
  PhotographerWorklogWidget,
  PhotographerAdminWidgets,
  PhotographerOtherProjectsTimelineWidget,
} from '../photographer/PhotographerTabWidgets';

// Import Timeline & Showcase components for universal access
import ProjectTimeline from '../project/ProjectTimeline';

// Import Universal Components for enhanced integration
import DriveOperationsWorkspacePanel from './DriveOperationsWorkspacePanel';
import UniversalChatWidget from '../chat/UniversalChatWidget';
import { useCommunicationStatus, CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';
import { useFileManagementStatus, FileManagementStatusProvider } from '../../contexts/FileManagementStatusContext';
// ChatDemoData removed - 100% real data only
import UniversalWorklog from '../worklog/UniversalWorklog';
import UniversalPrototypeFeedback from '../prototype-testing/UniversalPrototypeFeedback';
import ShowcaseAdmin from '../showcase/ShowcaseAdmin';
import { YouTubeIntegration } from '../youtube/YouTubeIntegration';
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
import { useInstallApp, useRoleRoomWorkspaceAccess } from '../../hooks/useRoleRoom';

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
import CentralizedSalesHub from '../sales/CentralizedSalesHub';
import TutorialLauncher from '../tutorials/TutorialLauncher';
import VideoEditor from '../video-editor/VideoEditor';
import StoryArcGenerator from '../StoryArcGenerator';
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
      { id: 'file-upload', label: 'Filsystem', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'photo-enhancement', label: 'Fotoforbedring', icon: <Collections /> },
      { id: 'client-management', label: 'Klientadministrasjon', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
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
      { id: 'file-upload', label: 'Filsystem', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Kunder', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
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
      { id: 'file-upload', label: 'Filsystem', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'Video AI', icon: <MovieCreation /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Kunder', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
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
      { id: 'file-upload', label: 'Filsystem', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'Audio AI', icon: <SmartToy /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Artister', icon: <Person /> },
      { id: 'equipment', label: 'Studio', icon: <Build /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
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
      { id: 'file-upload', label: 'Filsystem', icon: <CloudUpload /> },
      { id: 'ai-enhancement', label: 'AI Forbedring', icon: <AutoFixHigh /> },
      { id: 'video-enhancement', label: 'Video AI', icon: <MovieCreation /> },
      { id: 'worklog', label: 'Worklog', icon: <AccessTime /> },
      { id: 'clients', label: 'Kunder', icon: <Group /> },
      { id: 'team-management', label: 'Team', icon: <Group /> },
      { id: 'equipment', label: 'Utstyr', icon: <CameraAlt /> },
      { id: 'files', label: 'Filer', icon: <FolderOpen /> },
      { id: 'support', label: 'Support', icon: <HelpCenter /> },
      { id: 'settings', label: 'Innstillinger', icon: <Settings /> },
      { id: 'administration', label: 'Administrasjon', icon: <AdminPanelSettings /> },
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
/**
 * DashboardHeroBand — profesjon-aware hero øverst i UniversalDashboard.
 * Henter heading + subheading via useCmsContent (CMS leverer profesjon-
 * spesifikk variant, fallback til generic). Stylet med landing-tema +
 * profession-accent for den samme fargesignaturen som resten av
 * dashboardet.
 */
function DashboardHeroBand({
  accent,
  professionDisplayName,
  businessName,
  userDisplayName,
}: {
  accent: string;
  professionDisplayName: string;
  businessName?: string | null;
  userDisplayName?: string | null;
}) {
  const heading = useCmsContent('dashboard.hero.heading', 'Velkommen til CreatorHub');
  const subheading = useCmsContent(
    'dashboard.hero.subheading',
    'Alle dine prosjekter, kunder og leveranser i ett verktøy.',
  );
  // Caption-prioritet: bedriftsnavn vinner (det Daniel ba om — bruker
  // ser sin egen virksomhet øverst). Fallback til profesjon-navnet
  // (Fotograf/Videograf/etc) hvis bedriftsnavn ikke er satt.
  const captionText = businessName?.trim() || professionDisplayName;
  return (
    <Box
      sx={{
        mb: 3,
        p: { xs: 3, md: 4 },
        borderRadius: 4,
        background: `linear-gradient(135deg, rgba(5,6,10,0.96) 0%, rgba(15,16,24,0.94) 100%)`,
        border: `1px solid ${accent}33`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Typography
          variant="caption"
          sx={{
            color: accent,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {captionText}
        </Typography>
        {businessName && (
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(246,242,234,0.42)',
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}
          >
            · {professionDisplayName}
          </Typography>
        )}
      </Stack>
      <Typography
        variant="h3"
        sx={{
          fontWeight: 800,
          color: '#f6f2ea',
          mb: 1,
          lineHeight: 1.1,
          fontSize: { xs: '1.75rem', md: '2.5rem' },
        }}
      >
        {userDisplayName ? `Hei ${userDisplayName.split(' ')[0]} — ${heading}` : heading}
      </Typography>
      <Typography
        variant="body1"
        sx={{ color: 'rgba(246,242,234,0.66)', maxWidth: 720 }}
      >
        {subheading}
      </Typography>
    </Box>
  );
}

const UniversalDashboardContent: React.FC<UniversalDashboardProps> = ({ profession = 'photographer' }) => {
  const ROLE_ROOM_GOOGLE_TRANSFER_PROCESSING_KEY = 'creatorhub:rr-google-processing';
  const ROLE_ROOM_MARKETPLACE_URL = 'https://theroleroom.com/?source=creatorhub-marketplace';
  const [, setLocation] = useLocation();
  const { user: currentUser, isPrototypeTester, isLoading: authLoading, isAuthenticated } = useAuth();
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
  const universalDashboardAccess = features.checkFeatureAccess('universal-dashboard');
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
    state: universalState,
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
    const creatorPublishingProfessions = new Set(['admin', 'photographer', 'videographer', 'music_producer', 'enterprise']);
    const nextTabs = [...(baseConfig.tabs || [])].filter((tab) => tab.id !== 'showcase-publisher');

    if (creatorPublishingProfessions.has(profession) && !nextTabs.some((tab) => tab.id === 'publishing')) {
      const publishingTab = { id: 'publishing', label: 'Publisering', icon: <VideoLibrary /> };
      const showcaseTabIndex = nextTabs.findIndex((tab) => tab.id === 'showcase-admin');
      const insertIndex = showcaseTabIndex >= 0 ? showcaseTabIndex + 1 : Math.min(2, nextTabs.length);
      nextTabs.splice(insertIndex, 0, publishingTab);
    }

    // BI-fanen — augmenteres samme måte som publishing. Synlig for alle
    // creator-professions; leser fra unified analytics_events-laget.
    // Plasseres rett etter "Oversikt" så BI er mest synlig høyre i nav.
    if (creatorPublishingProfessions.has(profession) && !nextTabs.some((tab) => tab.id === 'business-intelligence')) {
      const biTab = { id: 'business-intelligence', label: 'BI', icon: <Assessment /> };
      const overviewIndex = nextTabs.findIndex((tab) => tab.id === 'overview');
      const insertIndex = overviewIndex >= 0 ? overviewIndex + 1 : 1;
      nextTabs.splice(insertIndex, 0, biTab);
    }
    
    return {
      ...baseConfig,
      // Override with dynamic data if available (for auto-scalability)
      name: displayName || baseConfig.name,
      color: professionColor || baseConfig.color,
      icon: professionIcon || baseConfig.icon,
      tabs: nextTabs,
    };
  }, [profession, baseConfig, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon]);

  // Fetch user session (public, minimal info)
  const { data: userSession } = useQuery({
    queryKey: ['/api/auth/public-session'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/auth/public-session');
      } catch {
        return null;
      }
    },
    enabled: !currentUser?.id,
    retry: false,
  });

  // Derive user identifiers from session and unified auth.
  // No 'guest'-fallback: dashboard is innlogget-only og burde ALDRI
  // rendere før auth har resolvet med ekte bruker-id. Tomt felt
  // signaliserer "auth ikke ferdig hydrert"; render-gaten under
  // hindrer queries fra å sende uhåndterte tomme bruker-IDer.
  const userId = userSession?.userId || currentUser?.id || '';
  const userEmail = userSession?.email || currentUser?.email;
  const roleRoomAccess = useRoleRoomWorkspaceAccess(Boolean(userId));
  const installRoleRoomAppMutation = useInstallApp();

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
  const handledGoogleWorkspaceTransferRef = useRef<string | null>(null);

  const clearGoogleWorkspaceIntentFromUrl = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    clearCreatorHubGoogleIntentFromUrl();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const googleIntent = readCreatorHubGoogleCallbackIntent(params);
    const googleStatus = googleIntent.status;
    const googleTransferId = googleIntent.transferId;
    const googleMode = googleIntent.mode;
    const googleMessage = googleIntent.message;

    if (!googleStatus) {
      return;
    }

    if (googleStatus === 'error') {
      console.error('Google Workspace callback error:', googleMessage || 'Unknown Google Workspace callback error');
      clearGoogleWorkspaceIntentFromUrl();
      return;
    }

    if (googleStatus !== 'success' || googleMode !== 'link' || !googleTransferId) {
      return;
    }

    const transferKey = `${googleMode}:${googleTransferId}`;
    if (handledGoogleWorkspaceTransferRef.current === transferKey) {
      return;
    }

    if (window.sessionStorage.getItem(ROLE_ROOM_GOOGLE_TRANSFER_PROCESSING_KEY) === transferKey) {
      return;
    }

    handledGoogleWorkspaceTransferRef.current = transferKey;
    window.sessionStorage.setItem(ROLE_ROOM_GOOGLE_TRANSFER_PROCESSING_KEY, transferKey);

    let cancelled = false;

    void (async () => {
      try {
        await apiRequest(`/api/creatorhub/google/oauth/session-result/${encodeURIComponent(googleTransferId)}`);
        if (cancelled) {
          return;
        }

        await apiRequest('/api/creatorhub/google/link', {
          method: 'POST',
          body: { transferId: googleTransferId },
        });
        if (cancelled) {
          return;
        }

        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ['/api/creatorhub/google/status'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/communication/google-chat/status'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/google/chat/messages'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/communication/email/status'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/communication/email/threads'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/communication/email/messages'] }),
          queryClient.invalidateQueries({ queryKey: ['universal-settings-lightroom-status', userId] }),
          queryClient.invalidateQueries({ queryKey: ['universal-settings-drive-status', userId] }),
          queryClient.invalidateQueries({ queryKey: ['universal-settings-google-photos-status', userId] }),
          queryClient.invalidateQueries({ queryKey: ['universal-settings-google-contacts-status', userId] }),
          queryClient.invalidateQueries({ queryKey: ['universal-settings-workspace-backup-status', userId] }),
          queryClient.invalidateQueries({ queryKey: ['file-management-google-drive-status', userId] }),
          queryClient.invalidateQueries({ queryKey: ['google-drive-context', userId] }),
          queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] }),
          queryClient.invalidateQueries({ queryKey: ['/api/google-workspace/storage', userId] }),
        ]);

        window.dispatchEvent(new CustomEvent('creatorhub-google-workspace-linked', {
          detail: { transferId: googleTransferId },
        }));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to finalize Google Workspace link from dashboard callback:', error);
        }
      } finally {
        if (!cancelled) {
          clearGoogleWorkspaceIntentFromUrl();
        }
        window.sessionStorage.removeItem(ROLE_ROOM_GOOGLE_TRANSFER_PROCESSING_KEY);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearGoogleWorkspaceIntentFromUrl, userId]);

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
      if (tab.id === 'email-center') {
        return false;
      }
      if (tab.id === 'downloads') {
        return false;
      }
      if (tab.id === 'communication') {
        return false;
      }
      if (tab.id === 'showcase-publisher') {
        return false;
      }
      if (tab.id === 'showcase-viewer' && config.tabs.some(configTab => configTab.id === 'showcase-admin')) {
        return false;
      }
      if (tab.id === 'files' && config.tabs.some((configTab) => configTab.id === 'file-upload')) {
        return false;
      }

      // Map tab IDs to feature checks - All enabled by default for better UX
      const featureMap: Record<string, boolean> = {
        'overview': true, // Always available
        'projects': true, // Always available
        'academy': isMentor || profession === 'enterprise', // Academy for mentors/instructors and enterprise teams
        'split-sheets': false, // Split sheets moved to Prisadministrasjon sub-tab for all professions
        'wedding-timeline': true, // Always available
        'showcase-admin': true, // Always available
        'publishing': true,
        'showcase-viewer': true, // Available for professions without Showcase Admin tab
        'file-upload': true,
        'ai-enhancement': true, // Always available
        'photo-enhancement': true, // Always available
        'video-enhancement': true, // Always available
        'audio-enhancement': true, // Always available
        'worklog': true,
        'clients': true, // Always available
        'client-management': true, // Always available
        'team-management': profession === 'enterprise', // Enterprise only
        'equipment': true, // Always available
        'files': !config.tabs.some((configTab) => configTab.id === 'file-upload'),
        'support': true,
        'settings': true, // Always available
        'administration': true, // Pricing administration for all professions
        'role-room': roleRoomAccess.hasWorkspaceAccess, // Only after install + paid/active access
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
    
    if (universalDashboardAccess.hasAccess && filteredTabIds.length > 0) {
      features.trackFeatureUsage('universal-dashboard','tabs-filtered', {
        filteredTabs: filteredTabIds,
        availableCount: tabs.length,
        totalCount: config.tabs.length
      });
    }
    
    return tabs;
  }, [config.tabs, projectsTabAccess.hasAccess, clientsTabAccess.hasAccess, equipmentTabAccess.hasAccess,
      showcaseTabAccess.hasAccess, settingsTabAccess.hasAccess, timelineTabAccess.hasAccess,
      photoEnhancementAccess.hasAccess, videoEnhancementAccess.hasAccess, audioEnhancementAccess.hasAccess,
      profession, isAdmin, isMentor, features, roleRoomAccess.hasWorkspaceAccess, universalDashboardAccess.hasAccess]);

  // Register this component in the integration system
  useEffect(() => {
    communication.registerComponent('universal-dashboard','dashboard', [
      'data:read','data:write','event:emit','event:listen','ui:update','project:manage','client:manage','equipment:manage','notification:manage','settings:manage'
    ]);

    // Track feature usage
    if (universalDashboardAccess.hasAccess) {
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
    }

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
  const [tabState, setTabState] = useState(() => ({
    main: universalState.tabState.main ?? 0,
    settings: universalState.tabState.settings ?? 2,
    timeline: universalState.tabState.timeline ?? 0,
  }));
  
  const [modalState, setModalState] = useState({
    showProjectModal: false,
    showQuickNotesModal: false,
    showProjectCreation: false,
    showVendorProductDialog: false,
    showEmailDesigner: false,
    showChat: false,
    showNotifications: false,
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
  const sessionId = currentUser?.id || null;
  
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

    if (!sessionId) return;

    // Debounce database save
    const timeoutId = setTimeout(() => {
      savePreferencesMutation.mutate(interfacePrefs);
    }, 1000); // Wait 1 second before saving to reduce API calls

    return () => clearTimeout(timeoutId);
  }, [interfacePrefs, sessionId, savePreferencesMutation]);

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

  // URL-driven main tab. ?dashTab=N i URL-en så browser back/forward
  // navigerer mellom hovedfanene, refresh holder valgt fane, og en
  // delbar URL åpner direkte på riktig sted.
  // Vi beholder tabState.main som lokal speiling så eksisterende
  // ref-watching (previousMainTabRef etc.) fungerer uten endringer —
  // setter både URL og lokal state ved hvert klikk.
  const [urlMainTab, setUrlMainTab] = useUrlTab('dashTab', tabState.main ?? 0);
  useEffect(() => {
    if (urlMainTab !== tabState.main) {
      updateTabStateLocal('main', urlMainTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMainTab]);
  const tabValue = urlMainTab;

  // Event Timeline dialog state
  const [showEventTimelineDialog, setShowEventTimelineDialog] = useState(false);
  const [_eventTimelinePrefill, setEventTimelinePrefill] = useState<any | null>(null);

  // Client Activity modal state
  const [showClientActivityModal, setShowClientActivityModal] = useState(false);

  // Split Sheets modal state
  const [showSplitSheetsModal, setShowSplitSheetsModal] = useState(false);

  const setTabValue = (value: number) => {
    setUrlMainTab(value);
    updateTabStateLocal('main', value);
  };
  const settingsTabValue = tabState.settings;
  const setSettingsTabValue = (value: number) => updateTabStateLocal('settings', value);
  const selectedTimelineTab = tabState.timeline;
  const setSelectedTimelineTab = (value: number) => updateTabStateLocal('timeline', value);
  const previousMainTabRef = useRef(tabValue);
  
  // Additional tab states for sub-navigation
  const [equipmentTabValue, setEquipmentTabValue] = useState(0);
  const [projectsTabValue, setProjectsTabValue] = useState(0);

  // Keep selected tab within range of available tabs
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (tabValue < 0 || tabValue >= availableTabs.length) {
      setTabValue(0);
    }
  }, [availableTabs.length, tabValue, setTabValue]);

  // Deep-link from iPad (CreatorHub One) + external links:
  // ``?tab=<id>`` selects the main tab by id (e.g. ``administration``,
  // ``showcase-admin``). ``?subTab=<id>`` is forwarded to hubs via
  // the existing ``custom-navigation`` event so sub-sections can
  // honour it without adding a dozen refs. Runs once per availableTabs
  // change so profession-switch re-resolves the ids.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (availableTabs.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetTab = params.get('tab');
    if (!targetTab) return;
    const idx = availableTabs.findIndex(
      (t) => t.id.toLowerCase() === targetTab.toLowerCase(),
    );
    if (idx >= 0 && idx !== tabValue) {
      setTabValue(idx);
    }
    const targetSubTab = params.get('subTab');
    if (targetSubTab) {
      // Stash in sessionStorage so the target hub can pick it up
      // when it mounts — firing a DOM event here would land before
      // the hub's own listener is attached, since the hub only
      // mounts once its outer tab is selected.
      try {
        sessionStorage.setItem(
          'creatorhub:pending-subtab',
          JSON.stringify({ tab: targetTab, subTab: targetSubTab }),
        );
      } catch { /* storage disabled: we still select the outer tab */ }
    }
    // Eat the query params so internal navigation (e.g. opening a
    // modal) doesn't keep redirecting. Preserves hash + other params.
    params.delete('tab');
    params.delete('subTab');
    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
    // Re-run only when availableTabs identity changes; tabValue is a
    // read dep and re-evaluating it here would override a user click
    // after initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs]);

  useEffect(() => {
    const settingsIndex = availableTabs.findIndex((tab) => tab.id === 'settings');
    const enteredSettings = settingsIndex >= 0 && tabValue === settingsIndex && previousMainTabRef.current !== settingsIndex;

    previousMainTabRef.current = tabValue;
  }, [availableTabs, tabValue]);
  
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
  const showChat = modalState.showChat;
  const setShowChat = (value: boolean) => updateModalStateLocal('showChat', value);
  const [chatRequestedTab, setChatRequestedTab] = useState<{
    tab: 'creatorhub' | 'google-chat' | 'email' | 'feedback' | 'evendi' | 'academy';
    token: string;
  } | null>(null);
  const [chatEmailIntent, setChatEmailIntent] = useState<{
    token: string;
    id: string;
    subject: string;
    body?: string;
    timestamp: string;
    counterpartName: string;
    counterpartEmail?: string | null;
    priority?: 'low' | 'normal' | 'high';
    isRead?: boolean;
    isStarred?: boolean;
  } | null>(null);
  const [chatWorkspaceVisible, setChatWorkspaceVisible] = useState(showChat);
  const [chatWorkspaceTransitionState, setChatWorkspaceTransitionState] = useState<'opening' | 'open' | 'closing'>(
    showChat ? 'open' : 'closing'
  );
  const [meetingNotesProjectId, setMeetingNotesProjectId] = useState<string | undefined>(undefined);
  const chatWorkspaceOpenDuration = 700;
  const chatWorkspaceCloseDuration = 300;
  const chatWorkspaceLayout = useMemo(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const horizontalGutter = 24;
    const verticalGutter = 28;
    const maxAvailableWidth = Math.max(920, window.innerWidth - horizontalGutter * 2);
    const maxAvailableHeight = Math.max(720, window.innerHeight - verticalGutter * 2);
    const width = Math.min(1560, maxAvailableWidth, Math.max(1040, Math.round(window.innerWidth * 0.86)));
    const height = Math.min(1020, maxAvailableHeight, Math.max(800, window.innerHeight - 64));

    return {
      width,
      height,
      x: Math.max(horizontalGutter, window.innerWidth - width - horizontalGutter),
      y: Math.max(verticalGutter, Math.round((window.innerHeight - height) / 2)),
    };
  }, [showChat]);
  const showCrmDialog = modalState.showCrmDialog;
  const setShowCrmDialog = (value: boolean) => updateModalStateLocal('showCrmDialog', value);
  const showProjectDetailsModal = modalState.showProjectDetailsModal;
  const setShowProjectDetailsModal = (value: boolean) => updateModalStateLocal('showProjectDetailsModal', value);
  const showEditProjectModal = modalState.showEditProjectModal;
  const setShowEditProjectModal = (value: boolean) => updateModalStateLocal('showEditProjectModal', value);
  const showDeleteProjectDialog = modalState.showDeleteProjectDialog;
  const setShowDeleteProjectDialog = (value: boolean) => updateModalStateLocal('showDeleteProjectDialog', value);
  const dashboardOverlayZIndex = 1400;
  const dashboardPanelZIndex = 1450;
  const dashboardWorkspaceZIndex = 1500;
  const dashboardFullscreenZIndex = 1600;
  const dashboardFullscreenControlZIndex = 1610;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let timeoutId: number | undefined;
    let rafId: number | undefined;

    if (showChat) {
      setChatWorkspaceVisible(true);
      setChatWorkspaceTransitionState('opening');
      rafId = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => {
          setChatWorkspaceTransitionState('open');
        }, chatWorkspaceOpenDuration);
      });
    } else {
      setChatWorkspaceTransitionState('closing');
      timeoutId = window.setTimeout(() => {
        setChatWorkspaceVisible(false);
      }, chatWorkspaceCloseDuration);
    }

    return () => {
      if (typeof rafId === 'number') {
        window.cancelAnimationFrame(rafId);
      }
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [showChat]);

  const handleChatMeetingCreated = useCallback((meeting: any) => {
    if (meeting?.dashboardBroadcasted || meeting?.source === 'universal-dashboard') {
      return;
    }

    const projectFromMeeting =
      meeting?.projectContext && typeof meeting.projectContext === 'object'
        ? meeting.projectContext as Project
        : null;
    const clientFromMeeting =
      meeting?.clientContext && typeof meeting.clientContext === 'object'
        ? meeting.clientContext as Client
        : null;
    const projectId =
      typeof meeting?.projectId === 'string' && meeting.projectId.trim().length > 0
        ? meeting.projectId.trim()
        : projectFromMeeting?.id || undefined;

    if (projectFromMeeting) {
      setSelectedProject(projectFromMeeting);
    }
    if (clientFromMeeting) {
      setSelectedClient(clientFromMeeting);
    }
    if (projectId) {
      setMeetingNotesProjectId(projectId);
    }

    integration.emit('meeting:created', { meeting, source: 'universal-dashboard' });
    const dashboardMeetingPayload = {
      ...meeting,
      source: 'universal-dashboard',
      originalSource: meeting?.source ?? null,
      dashboardBroadcasted: true,
    };
    communication.sendMessage({
      from: 'universal-dashboard',
      to: 'all',
      type: 'meeting:created',
      data: dashboardMeetingPayload,
      priority: 'medium',
    });

    if (meeting?.suggestOpenNotes) {
      setShowQuickNotesModal(true);
    }
  }, [communication, integration, setSelectedClient, setSelectedProject, setShowQuickNotesModal]);

  const handleOpenInquiryInChat = useCallback((email: CustomerInquiryEmailMessage) => {
    setChatRequestedTab({
      tab: 'email',
      token: `inquiry-email:${email.id}:${Date.now()}`,
    });
    setChatEmailIntent({
      token: `${email.id}:${Date.now()}`,
      id: email.id,
      subject: email.subject,
      body: email.body,
      timestamp: email.timestamp,
      counterpartName: email.from?.name || 'Kunde',
      counterpartEmail: email.from?.email || null,
      priority: email.priority,
      isRead: email.isRead,
      isStarred: email.isStarred,
    });
    setShowNotifications(false);
    setShowChat(true);
  }, [setShowNotifications, setShowChat]);

  const handleOpenEmailWorkspace = useCallback((client?: Client | null) => {
    if (client?.email) {
      setChatEmailIntent({
        token: `client-email:${client.id || client.email}:${Date.now()}`,
        id: `client-email:${client.id || client.email}`,
        subject: `Dialog med ${client.name || client.email}`,
        body: '',
        timestamp: new Date().toISOString(),
        counterpartName: client.name || client.email,
        counterpartEmail: client.email,
        priority: 'normal',
        isRead: true,
        isStarred: false,
      });
    } else {
      setChatEmailIntent(null);
    }

    setChatRequestedTab({
      tab: 'email',
      token: `email-tab:${client?.id || client?.email || 'dashboard'}:${Date.now()}`,
    });
    setShowNotifications(false);
    setShowChat(true);
  }, [setShowNotifications, setShowChat]);

  const sharedGoogleDriveManagerProps = useMemo(() => ({
    userId,
    profession,
    selectedProject,
    onProjectSelect: setSelectedProject,
    onProjectUpdate: (project: Project) => {
      if (project?.id) {
        updateProject(project.id, project);
      }
    },
  }), [profession, selectedProject, setSelectedProject, updateProject, userId]);

  const sharedGoogleDriveProjectSyncProps = useMemo(() => ({
    userId,
    profession,
    projectId: selectedProject?.id,
    selectedProject,
    onProjectSelect: setSelectedProject,
    onProjectUpdate: (project: Project) => {
      if (project?.id) {
        updateProject(project.id, project);
      }
    },
  }), [profession, selectedProject, setSelectedProject, updateProject, userId]);

  const sharedGoogleWorkspaceMeetingProps = useMemo(() => ({
    profession,
    isOpen: false,
    onClose: () => {},
    preselectedProjectId: selectedProject?.id,
    selectedProject,
    onProjectSelect: setSelectedProject,
  }), [profession, selectedProject, setSelectedProject]);

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
          if (subTab === 'pricing') {
            const administrationTabIndex = availableTabs.findIndex((dashboardTab) => dashboardTab.id === 'administration');
            if (administrationTabIndex >= 0) {
              setTabValue(administrationTabIndex);
            }
            return;
          }

          const settingsTabIndex = availableTabs.findIndex((dashboardTab) => dashboardTab.id === 'settings');
          if (settingsTabIndex >= 0) {
            setTabValue(settingsTabIndex);
      }
    }
  }
};

    // Use modern event handling pattern
    document.addEventListener('custom-navigation', handleMessage as EventListener);
    return () => document.removeEventListener('custom-navigation', handleMessage as EventListener);
}, [availableTabs, profession]);

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

  // Story Arc Studio should open as a dedicated page, not inside Universal Dashboard
  const openStoryArcStudioPage = useCallback((projectId?: string | number) => {
    const query = projectId ? `?projectId=${encodeURIComponent(String(projectId))}` : '';
    setLocation(`/story-arc-studio${query}`);
  }, [setLocation]);

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
        openStoryArcStudioPage(project.id);
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
  }, [selectedProjectForOverview, setSelectedProject, openStoryArcStudioPage, setTabValue, availableTabs]);

  // Handler to open in new browser tab
  const handleOpenInNewTab = useCallback(() => {
    if (!selectedProjectForOverview) return;
    
    const { projectType, id } = selectedProjectForOverview;
    
    // Construct URL based on project type
    let url = '';
    switch (projectType) {
      case 'story-arc':
        url = `/story-arc-studio${id ? `?projectId=${encodeURIComponent(String(id))}` : ''}`;
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
      addNotification({
        message: error instanceof Error ? `Kunne ikke slette prosjektet: ${error.message}` : 'Kunne ikke slette prosjektet akkurat nå.',
        type: 'error',
      });
    } finally {
      setShowDeleteProjectDialog(false);
      setSelectedProject(null);
    }
}, [addNotification, queryClient, selectedProject]);

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

  const dashboardSectionCardSx = useMemo(
    () => ({
      borderRadius: 4,
      border: `1px solid ${alpha(customBranding.color, 0.08)}`,
      backgroundColor: alpha('#ffffff', 0.96),
      boxShadow: `0 18px 42px ${alpha('#0f172a', 0.06)}`,
    }),
    [customBranding.color],
  );

  // Fetch vendor profile to get vendorType (for vendors only)
  const { data: vendorProfile } = useQuery({
    queryKey: ['/api/vendor-onboarding/profile', userId],
    queryFn: () => apiRequest(`/api/vendor-onboarding/profile/${userId}`),
    enabled: !!userId && userId !== 'guest' && profession === 'vendor'
  });

  // Get the user's vendor type from their profile, default to 'print'
  const _userVendorType = vendorProfile?.vendorType || 'print';
  const shouldLoadEvendi = !!userId && userId !== 'guest' && profession === 'vendor';

  // Fetch Evendi bookings & analytics (wired via evendi-api.ts)
  const { data: evendiBookings = [] } = useQuery<EvendiBooking[]>({
    queryKey: evendiQueryKeys.bookings(),
    queryFn: () => getEvendiBookings(),
    enabled: shouldLoadEvendi,
    staleTime: 60_000,
  });

  const { data: evendiAnalytics } = useQuery<EvendiAnalyticsSummary>({
    queryKey: evendiQueryKeys.analytics(),
    queryFn: () => getEvendiAnalyticsSummary(),
    enabled: shouldLoadEvendi,
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

  // Slice 9D.5 — aggregate badges for unread messages, gallery submissions
  // og pending print-orders. 30s refetch dekker submissions + print-orders;
  // chat_message-events fra WebSocket invalidate-r for ~instant unread-count.
  const { data: dashboardBadges } = useQuery<{
    unreadMessages: number;
    newGallerySubmissions: number;
    pendingPrintOrders: number;
  }>({
    queryKey: ['/api/photographer/dashboard-badges', userId],
    queryFn: () => apiRequest('/api/photographer/dashboard-badges'),
    enabled: !!userId && userId !== 'guest',
    refetchInterval: 30000,
  });

  // Live-invalidate badges når WebSocket signaliserer relevant event.
  // Slice 9D.5.D wirer 'gallery_submission' + 'print_order_paid' i tillegg
  // til de eksisterende meldingseventene, så alle 3 badges-typer får
  // ~instant oppdatering.
  useRealtimeNotifications(
    userId !== 'guest' ? userId : undefined,
    useCallback((data: { type: string }) => {
      const relevant = new Set([
        'chat_message',
        'message_received',
        'gallery_submission',
        'print_order_paid',
      ]);
      if (relevant.has(data.type)) {
        queryClient.invalidateQueries({
          queryKey: ['/api/photographer/dashboard-badges', userId],
        });
      }
    }, [userId]),
  );

  // Fetch recent notifications for notification center
  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['/api/notifications/recent', userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/notifications/recent/${userId}?limit=10`);
      return Array.isArray(response) ? response : response?.notifications || [];
    },
    enabled: !!userId && userId !== 'guest'
  });

  // Fetch client activity summary for dashboard badges
  const { data: clientActivitySummary } = useQuery({
    queryKey: ['/api/client-activity/summary', userId],
    queryFn: () => apiRequest(`/api/client-activity/summary?userId=${userId}`),
    enabled: !!userId && userId !== 'guest',
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Slice 9D.5 — bruk nye dashboard-badges-endpointet som primærkilde.
  // De gamle /api/emails/unread-count + /api/client-activity/summary
  // returnerer 404 i prod, så fallback (`?? 0`) gir 0 uansett.
  const unreadEmailCount = dashboardBadges?.unreadMessages ?? unreadEmailData?.count ?? 0;
  const urgentDeadlines = clientActivitySummary?.urgentDeadlines || 0;
  const unreadComments = clientActivitySummary?.unreadComments || 0;
  const recentDownloads = clientActivitySummary?.recentDownloads || 0;
  const pendingSubmissions = dashboardBadges?.newGallerySubmissions ?? clientActivitySummary?.pendingSubmissions ?? 0;
  const pendingTimelineChanges = clientActivitySummary?.pendingTimelineChanges || 0;
  const pendingPrintOrders = dashboardBadges?.pendingPrintOrders ?? 0;
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
    enabled: !!userId && userId !== 'guest' && profession === 'videographer',
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
    enabled: !!userId && userId !== 'guest' && (profession === 'photographer' || profession === 'admin'),
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
    enabled: !!userId && userId !== 'guest' && profession !== 'vendor',
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
  const [marketplaceInstallNotice, setMarketplaceInstallNotice] = useState<{
    severity: 'success' | 'info' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const roleRoomMarketplaceState = useMemo(() => {
    const planName = roleRoomAccess.billingAccount?.planName?.trim();

    switch (roleRoomAccess.status) {
      case 'active':
        return {
          statusLabel: planName ? `Aktiv · ${planName}` : 'Aktiv tilgang',
          statusDescription: roleRoomAccess.helperText,
          ctaLabel: 'Åpne The Role Room',
          accentColor: '#7c3aed',
        };
      case 'payment_failed':
        return {
          statusLabel: roleRoomAccess.statusLabel,
          statusDescription: roleRoomAccess.helperText,
          ctaLabel: roleRoomAccess.canManageBilling ? 'Oppdater betaling' : 'Se status',
          accentColor: '#dc2626',
        };
      case 'pending_activation':
        return {
          statusLabel: 'Venter aktivering',
          statusDescription: roleRoomAccess.helperText,
          ctaLabel: 'Åpne aktivering',
          accentColor: '#f59e0b',
        };
      case 'pending_payment':
      case 'subscription_required':
        return {
          statusLabel: roleRoomAccess.statusLabel,
          statusDescription: roleRoomAccess.helperText,
          ctaLabel: 'Fullfør abonnement',
          accentColor: '#f59e0b',
        };
      case 'not_installed':
      default:
        return {
          statusLabel: 'Ikke installert',
          statusDescription: 'Installer appen og fullfør abonnementet for å låse opp The Role Room i CreatorHub.',
          ctaLabel: 'Installer og velg abonnement',
          accentColor: '#6366f1',
        };
    }
  }, [roleRoomAccess]);

  const handleMarketplaceInstall = useCallback(async (appId: string) => {
    if (appId === 'resume-builder') {
      setMarketplaceInstallNotice({
        severity: 'success',
        message: 'ResumeBuilder installeres. Du blir sendt videre...',
      });
      setTimeout(() => {
        setShowMarketplace(false);
        window.location.href = '/resume-builder';
      }, 800);
      return;
    }

    if (appId !== 'role-room') {
      return;
    }

    try {
      setMarketplaceInstallNotice(null);

      if (roleRoomAccess.hasWorkspaceAccess) {
        setShowMarketplace(false);
        const roleRoomTabIndex = availableTabs.findIndex((tab) => tab.id === 'role-room');
        if (roleRoomTabIndex >= 0) {
          setTabValue(roleRoomTabIndex);
        }
        return;
      }

      if (!roleRoomAccess.hasInstallation) {
        await installRoleRoomAppMutation.mutateAsync('role-room');
        setMarketplaceInstallNotice({
          severity: 'success',
          message: 'The Role Room er lagt til i Marketplace for denne brukeren. Fullfør abonnementet for å låse opp fanen i CreatorHub.',
        });
        await roleRoomAccess.refetch();
      }

      if (roleRoomAccess.status === 'payment_failed' && roleRoomAccess.canManageBilling) {
        setMarketplaceInstallNotice({
          severity: 'info',
          message: 'Du sendes nå til betalingsportalen for å reaktivere The Role Room.',
        });
        const result = await apiRequest('/api/role-room/billing/manage', {
          method: 'POST',
          body: {
            browserOrigin: window.location.origin,
            returnPath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          },
        }) as { url?: string };

        if (result.url) {
          window.location.assign(result.url);
          return;
        }
      }

      setMarketplaceInstallNotice({
        severity: roleRoomAccess.status === 'pending_activation' ? 'warning' : 'info',
        message: roleRoomAccess.helperText,
      });
      window.location.assign(ROLE_ROOM_MARKETPLACE_URL);
    } catch (error) {
      setMarketplaceInstallNotice({
        severity: 'error',
        message: error instanceof Error ? error.message : 'Kunne ikke starte The Role Room-oppsettet.',
      });
    }
  }, [
    ROLE_ROOM_MARKETPLACE_URL,
    availableTabs,
    installRoleRoomAppMutation,
    roleRoomAccess,
    setTabValue,
  ]);
  
  // selectedProjectForOverview and projectOverviewOpen moved earlier to avoid TDZ error

  const handleTabChange = useCallback((event: React.SyntheticEvent | null, newValue: number) => {
    const targetTab = availableTabs[newValue];
    if (targetTab?.id === 'story-arc-studio' || targetTab?.id === 'story_arc' || targetTab?.id === 'story-arc') {
      openStoryArcStudioPage();
      return;
    }
    setTabValue(newValue);
}, [availableTabs, openStoryArcStudioPage, setTabValue]);

  // Optimized event handlers
  const handleProEditorModeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setProEditorMode(false);
      openStoryArcStudioPage();
      return;
    }
    setProEditorMode(false);
}, [openStoryArcStudioPage, setProEditorMode]);

  const handleTimelineTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setSelectedTimelineTab(newValue);
}, []);

  const handleSettingsTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    setSettingsTabValue(newValue);
}, []);

  const handleShowFAQDialog = useCallback(() => {
    setShowFAQDialog(true);
}, []);

  const renderUnifiedSettingsPanel = useCallback(() => (
    <Box sx={{ p: { xs: 1.5, md: 0 } }}>
      <SettingsProvider>
        <UniversalSettingsPanel
          userId={userId}
          profession={profession}
          customBranding={customBranding}
          selectedProject={selectedProject}
          onProjectSelect={setSelectedProject}
          activeTabValue={settingsTabValue}
          onTabChange={setSettingsTabValue}
        />
      </SettingsProvider>
    </Box>
  ), [
    customBranding,
    profession,
    selectedProject,
    setSelectedProject,
    settingsTabValue,
    userId,
  ]);
  const showLegacyVendorSettings = false;

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

  // Auth-gate: før vi rendrer noe innhold må vi vite om brukeren er
  // innlogget. Tidligere falt vi tilbake til `userId='guest'` som
  // genererte 404/401 på alle bruker-spesifikke ruter (communication,
  // accounting, gear etc). Render ingenting (eller en spinner) mens
  // useAuth henter — komponenter videre nede slipper å håndtere
  // "guest"-state og queries fyrer ikke før vi har en ekte ID.
  if (authLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!isAuthenticated || !userId) {
    // Slice 9X.60 race-fix: hvis localStorage har token, holdes brukeren
    // på en spinner i stedet for å bounce til /login. useAuth re-validerer
    // og setter isAuthenticated:true når server har resolved session.
    let hasStoredToken = false;
    try {
      hasStoredToken =
        typeof window !== 'undefined' &&
        !!window.localStorage.getItem('creatorhub_auth_token');
    } catch { /* ignore */ }

    if (hasStoredToken) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      );
    }

    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return null;
  }

  // Profession-aware accent: hver profesjon har egen signaturfarge
  // som overlay over landing-base. Photographer beholder warm orange
  // (matcher landing direkte); videograf rød, musikkprodusent blå,
  // vendor grønn, enterprise lilla. Alle på samme dark navy base så
  // CreatorHub-identitet er konsistent men hver fag har egen "lyd".
  const professionAccent = customBranding.color || '#ffba6c';
  return (
    <Box
      sx={{
        minHeight: '100vh',
        // Landing-page-matched bakgrunn: dyp navy med profesjon-spesifikk
        // aksent-glød. Erstatter cream/peach-gradienten så dashboardet
        // snakker samme språk som landing-page, mens hver profesjon
        // beholder sin egen identitet via accent-fargen.
        background: `
          radial-gradient(circle at top right, ${professionAccent}28, transparent 32%),
          radial-gradient(circle at left 20%, ${professionAccent}18, transparent 36%),
          #05060a
        `,
        color: '#f6f2ea',
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
            radial-gradient(ellipse at 20% 20%, ${professionAccent}0d 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, ${professionAccent}08 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        },
        // Cascading dark-tema for child-komponenter. Aggressivt nok til
        // at standard MUI Paper/Card/Tabell/Dialog henger sammen med
        // landing-aksenten, men opt-out via explicit bg-prop fortsatt
        // mulig for komponenter som trenger lys overflate (e.g. white-
        // labeled klient-galleri-viewer som er public-facing).
        '& .MuiPaper-root': {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15,16,24,0.85)',
          color: '#f6f2ea',
          border: `1px solid ${professionAccent}1a`,
        },
        '& .MuiCard-root': {
          backgroundImage: 'none',
          backgroundColor: 'rgba(15,16,24,0.85)',
          color: '#f6f2ea',
          border: `1px solid ${professionAccent}1a`,
        },
        // Typography arver color via theme — sett body/h-variants til
        // ink-cream så tekst er lesbar på dark surface.
        '& .MuiTypography-root': {
          color: '#f6f2ea',
        },
        '& .MuiTypography-colorTextSecondary, & .MuiTypography-body2': {
          color: 'rgba(246,242,234,0.66)',
        },
        // Inputs (TextField, Select) trenger lysere outline + hvit tekst
        '& .MuiOutlinedInput-root': {
          color: '#f6f2ea',
          '& fieldset': { borderColor: `${professionAccent}3d` },
          '&:hover fieldset': { borderColor: `${professionAccent}66` },
          '&.Mui-focused fieldset': { borderColor: professionAccent },
        },
        '& .MuiInputLabel-root': {
          color: 'rgba(246,242,234,0.66)',
          '&.Mui-focused': { color: professionAccent },
        },
        // Divider mer synlig på dark
        '& .MuiDivider-root': {
          borderColor: `${professionAccent}1f`,
        },
        // Chip outlined-variant: ramme + tekst i ink
        '& .MuiChip-outlined': {
          color: '#f6f2ea',
          borderColor: `${professionAccent}4d`,
        },
        // List/menu items
        '& .MuiListItemText-secondary': {
          color: 'rgba(246,242,234,0.55)',
        },
        // Table headers
        '& .MuiTableCell-root': {
          color: '#f6f2ea',
          borderColor: `${professionAccent}1a`,
        },
        '& .MuiTableCell-head': {
          backgroundColor: 'rgba(5,6,10,0.4)',
          color: '#fff5e8',
          fontWeight: 700,
        },
        // WCAG AA Compliance: Motion and contrast preferences
        '@media (prefers-reduced-motion: reduce)': {
          background: '#05060a',
          '&::before': { display: 'none' }
        },
        '@media (prefers-contrast: high)': {
          background: '#000000',
          color: '#ffffff',
          border: '2px solid #ffffff'
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

        {/* Project Creation Dialog (Submission → Project, eller manuelt fra "Nytt prosjekt"-knapp) */}
        {uiSettings.submissionProjectData && (
        <Dialog
          open={showProjectCreation}
          onClose={() => {
            setShowProjectCreation(false);
            setUiSettings((prev) => ({ ...prev, submissionProjectData: null }));
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            {uiSettings.submissionProjectData?.isManual
              ? 'Nytt prosjekt'
              : 'Opprett prosjekt fra innsending'}
          </DialogTitle>
          <DialogContent dividers>
            <RealTimeProvider>
              <VisualEditorProvider>
                <ThemeProvider>
                  <SettingsProvider>
                    <ProjectProvider>
                      <ProjectCreationWithMemoryCards
                        profession={getComponentProfession(profession)}
                        userId={currentUser?.id}
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
                        onProjectCreated={async (newProject?: { id?: string }) => {
                          // Workflow-audit-fix: hvis vi konverterer fra
                          // submission, koble dem sammen i backend så BI
                          // kan måle conversion-rate og drill-back funker.
                          const submissionId = uiSettings.submissionProjectData?.id;
                          const projectId = newProject?.id;
                          if (submissionId && projectId) {
                            try {
                              await apiRequest(`/api/submissions/${submissionId}/mark-converted`, {
                                method: 'POST',
                                body: JSON.stringify({ projectId }),
                              });
                            } catch (err) {
                              console.warn('[submission-convert] mark-converted failed:', err);
                            }
                          }
                          setShowProjectCreation(false);
                          setUiSettings(prev => ({ ...prev, submissionProjectData: null }));
                          await queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                          queryClient.invalidateQueries({ queryKey: [`/api/dashboard/${profession}`] });
                          queryClient.invalidateQueries({ queryKey: ['/api/submissions'] });
                          // Slice 9X.14 — naviger fotograf direkte til
                          // prosjekt-detalj med ProjectTimeline + next-steps,
                          // så hun ser hva som er auto-generert og hva som
                          // gjenstår frem til leveranse.
                          if (profession === 'photographer' && projectId) {
                            queryClient.invalidateQueries({ queryKey: ['/api/photographer/projects'] });
                            setLocation(`/photographer/projects/${projectId}?created=1`);
                          }
                        }}
                      />
                    </ProjectProvider>
                  </SettingsProvider>
                </ThemeProvider>
              </VisualEditorProvider>
            </RealTimeProvider>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setShowProjectCreation(false);
              setUiSettings((prev) => ({ ...prev, submissionProjectData: null }));
            }}>Lukk</Button>
          </DialogActions>
        </Dialog>
        )}

        {/* Header - WCAG Compliant — kun for ekte inquiry-konverteringer,
            ikke for manuell "Nytt prosjekt"-knapp. */}
        {uiSettings.submissionProjectData && !uiSettings.submissionProjectData.isManual && (
          <MuiCard sx={{ mb: 2 }}>
            <MuiCardContent>
              <Typography component="div" variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
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
                        const contacts = await apiRequest(
                          `/api/google/people/search-contacts?q=${encodeURIComponent(payload.email)}&userId=${encodeURIComponent(effectiveUserId)}`,
                        ) as Array<{ id: string; email: string }>;
                        const foundId = contacts.find((contact) => contact.email?.toLowerCase() === payload.email.toLowerCase())?.id ?? null;
                        if (!foundId) {
                          const [firstName, ...rest] = (payload.name || payload.email).split(' ');
                          const lastName = rest.join(' ');
                          await apiRequest('/api/google/people/create-contact', {
                            method: 'POST',
                            body: {
                              firstName,
                              lastName: lastName || '-',
                              email: payload.email,
                              phone: payload.phone,
                              companyName: payload.company,
                              profession,
                              notes: 'Created from Universal Dashboard submission',
                              userId: effectiveUserId,
                            },
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
                  const showcaseTabIndex = availableTabs.findIndex(tab => tab.id === 'showcase-admin');
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
                    })
                  });

                  // 3. Refresh queries
                  await queryClient.invalidateQueries({ queryKey: ['/api/timeline-changes/pending', userId] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/client-activity/summary', userId] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/projects', userId, 'worklog'] });

                  // 4. Show success message
                  addNotification({
                    message: `Godtatt ${changes.length} tidslinjeendring(er) og lagt til i arbeidslogg for videre møteoppfølging i workspace.`,
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
              src="/creatorhub-wordmark-light.png"
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
                  <Box sx={{ mt: 1.2, display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                    <GoogleWorkspaceSessionBadge
                      userId={userId}
                      tone="creatorhub"
                    />
                  </Box>
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
                      handleOpenEmailWorkspace(selectedClient || null);
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

                  {/* Slice 9X.8.D — link til klient-CRM */}
                  <Tooltip title="Klienter (CRM)">
                    <IconButton
                      size={isSmallScreen ? "small" : "medium"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLocation('/photographer/clients');
                      }}
                      sx={{
                        bgcolor: `${customBranding.color}10`,
                        minHeight: { xs: 36, sm: 44 },
                        '&:hover': { bgcolor: customBranding.color + '20' },
                      }}
                      aria-label="Klienter (CRM)"
                      tabIndex={0}
                    >
                      <Person />
                    </IconButton>
                  </Tooltip>

                  {/* Slice 9D.5 — pending print-orders badge */}
                  <Tooltip title={
                    pendingPrintOrders > 0
                      ? `${pendingPrintOrders} print-bestilling${pendingPrintOrders === 1 ? '' : 'er'} venter fulfillment`
                      : 'Ingen print-bestillinger venter'
                  }>
                    <IconButton
                      size={isSmallScreen ? "small" : "medium"}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLocation('/photographer/print-orders');
                      }}
                      sx={{
                        bgcolor: pendingPrintOrders > 0 ? '#ff8c001a' : `${customBranding.color}10`,
                        minHeight: { xs: 36, sm: 44 },
                        '&:hover': {
                          bgcolor: pendingPrintOrders > 0 ? '#ff8c0033' : customBranding.color + '20',
                        },
                      }}
                      aria-label={`Print-bestillinger${pendingPrintOrders > 0 ? ` - ${pendingPrintOrders} venter` : ''}`}
                      tabIndex={0}
                    >
                      <Badge
                        badgeContent={pendingPrintOrders}
                        color={pendingPrintOrders > 0 ? "warning" : "default"}
                        max={99}
                      >
                        <LocalShipping />
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
          <>
            {/* CMS-styrt profesjon-aware hero. Henter
                dashboard.hero.heading + .subheading via useCmsContent.
                Backend leverer profesjon-spesifikk variant automatisk
                (photographer: "Studio i lommen", videograf: "Edit fra
                første klipp", etc). Default-fallback i hooken sikrer
                at vi alltid har tekst selv om CMS-rad ikke finnes. */}
            <DashboardHeroBand
              accent={professionAccent}
              professionDisplayName={config.name}
              businessName={currentUser?.businessName ?? null}
              userDisplayName={
                currentUser?.displayName
                || (currentUser?.firstName
                    ? `${currentUser.firstName}${currentUser?.lastName ? ' ' + currentUser.lastName : ''}`
                    : null)
              }
            />
          <MuiCard sx={{
            // Landing-matched dark surface med profesjon-spesifikk
            // aksent-border. Hver fag har egen "lyd" (orange/rød/blå/
            // grønn/lilla) på samme dark navy base.
            background: 'linear-gradient(135deg, rgba(5,6,10,0.96) 0%, rgba(15,16,24,0.94) 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${professionAccent}2e`,
            borderRadius: 4,
            boxShadow: `0 8px 32px ${professionAccent}26`,
            overflow: 'hidden',
            color: '#f6f2ea',
            // WCAG Compliance: High contrast and focus management
            '&:focus-within': {
              outline: `2px solid ${customBranding.color}`,
              outlineOffset: '2px'
            }
          }}>
            <Box sx={{
              borderBottom: 1,
              borderColor: `${professionAccent}2e`,
              background: 'rgba(5,6,10,0.58)',
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
                  '& .MuiTabs-indicator': {
                    bgcolor: professionAccent,
                  },
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' },
                    minWidth: { xs: 80, sm: 100 },
                    minHeight: 56,
                    px: { xs: 1.5, sm: 2.5 },
                    py: 1.5,
                    borderRadius: '12px 12px 0 0',
                    transition: 'all 0.2s ease',
                    color: 'rgba(246,242,234,0.66)',
                    '&:hover': {
                      bgcolor: `${professionAccent}14`,
                      color: '#fff5e8',
                    },
                    '&.Mui-selected': {
                      color: professionAccent,
                      bgcolor: `${professionAccent}1f`,
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
            {/* Slice 9X.9.A — Fotograf-mission-control: hurtigtilgang til
                prosjekter, klienter og lønnsomhet. Kun synlig for fotograf. */}
            {profession === 'photographer' && (
              <Box sx={{ mb: { xs: 3, md: 4 } }}>
                {/* Slice 9X.13 — primær CTA: nytt prosjekt manuelt
                    (uten å vente på en kunde-forespørsel). Åpner samme
                    ProjectCreationWithMemoryCards-dialog som inquiry-flyt. */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<AddCircle />}
                    size="large"
                    onClick={() => {
                      setUiSettings((prev) => ({
                        ...prev,
                        submissionProjectData: { isManual: true },
                      }));
                      setShowProjectCreation(true);
                    }}
                  >
                    Nytt prosjekt
                  </Button>
                </Box>
                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                      onClick={() => window.location.assign('/photographer/projects')}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Folder color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Prosjekter</Typography>
                          <Typography variant="caption" color="text.secondary">Alle oppdrag & margin</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                      onClick={() => window.location.assign('/photographer/clients')}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Group color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Klienter</Typography>
                          <Typography variant="caption" color="text.secondary">CRM & historikk</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                      onClick={() => window.location.assign('/photographer/profitability')}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <TrendingUp color="success" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Lønnsomhet</Typography>
                          <Typography variant="caption" color="text.secondary">Margin per tjeneste</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                      onClick={() => window.location.assign('/photographer/print-orders')}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <LocalShipping color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Print-ordrer</Typography>
                          <Typography variant="caption" color="text.secondary">Leveranser & shipping</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                      onClick={() => window.location.assign('/photographer/equipment')}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <CameraAlt color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Utstyr</Typography>
                          <Typography variant="caption" color="text.secondary">Garanti & firmware</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                  <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      sx={{ p: 2.5, cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                      onClick={() => window.location.assign('/photographer/settings')}
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Settings color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Innstillinger</Typography>
                          <Typography variant="caption" color="text.secondary">Profil, logo, abonnement</Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid2>
                </Grid2>
              </Box>
            )}

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
                    onOpenInquiryInChat={handleOpenInquiryInChat}
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
                          openStoryArcStudioPage();
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
                          {...sharedGoogleWorkspaceMeetingProps}
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
              workspaceSummary={{
                companyName: roleRoomAccess.billingAccount?.companyName ?? null,
                planName: roleRoomAccess.billingAccount?.planName ?? null,
                statusLabel: roleRoomAccess.billingAccount?.paymentStatusLabel ?? null,
              }}
            />
          </TabPanel>

          {/* Dynamically render tabs based on profession */}
          {profession === 'photographer' ? (
            <>
              {/* Tab 4: Evendi */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'wedding-timeline')}>
                <Box sx={{ width: '100%' }}>
                  {/* Slice 9X.17 — for fotografer: vis også non-wedding-prosjekter med timeline */}
                  {profession === 'photographer' && <PhotographerOtherProjectsTimelineWidget />}
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
                  <ShowcaseAdmin
                    userId={userId}
                    profession={profession}
                    viewerContent={
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
                            console.log('Showcase item selected:', item);
                          }}
                          onItemUpdate={(item) => {
                            console.log('Showcase item updated:', item);
                          }}
                          onItemDelete={(item) => {
                            console.log('Showcase item deleted:', item);
                          }}
                        />
                        </VisualEditorProvider>
                        </RealTimeProvider>
                        </ThemeProvider>
                        </SettingsProvider>
                      </Box>
                    }
                  />
                </Box>

              </TabPanel>

              {/* Tab 4b: Publishing */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'publishing')}>
                <YouTubeIntegration
                  userId={userId}
                  projectId={selectedProject?.id || null}
                  projects={projects}
                  selectedProjectId={selectedProject?.id || null}
                  onProjectChange={(nextProjectId) => {
                    if (!nextProjectId) {
                      setSelectedProject(null);
                      return;
                    }

                    const nextProject = projects.find((project) => project.id === nextProjectId) || null;
                    setSelectedProject(nextProject);
                  }}
                  createShowcaseOnUpload
                />
              </TabPanel>

              {/* BI-fanen — leser fra det unified analytics_events-laget
                  som dekker alle UniversalDashboard-systemer (Galleri,
                  Prosjekt, Betaling). Refresher hver 30s for live-feel. */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'business-intelligence')}>
                <BusinessIntelligenceHub />
              </TabPanel>

              {/* Tab 7: Universal File Upload */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'file-upload')}>
                <DriveOperationsWorkspacePanel
                  userId={userId}
                  profession={profession}
                  selectedProject={selectedProject}
                  selectedClient={selectedClient}
                  projects={projects}
                  onSelectProject={setSelectedProject}
                  onSelectClient={setSelectedClient}
                  onProjectUpdate={(project) => {
                    if (project?.id) {
                      updateProject(project.id, project);
                    }
                  }}
                />
              </TabPanel>

              {/* Tab 8: AI Forbedring - Photo Enhancement Suite */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'ai-enhancement')}>
                <CreatorHubPhotoEnhancer profession={getComponentProfession(profession) as any} />
              </TabPanel>

              {/* Tab 10: Worklog */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'worklog')}>
                {/* Slice 9X.17 — fotograf-spesifikk widget over generisk worklog */}
                {profession === 'photographer' && <PhotographerWorklogWidget />}
                <SettingsProvider>
                  <RealTimeProvider>
                    <VisualEditorProvider>
                      <UniversalWorklog
                        projectId={selectedProject?.id || userId}
                        userId={userId}
                        profession={getComponentProfession(profession) as any}
                      />
                    </VisualEditorProvider>
                  </RealTimeProvider>
                </SettingsProvider>
              </TabPanel>

              {/* Tab 11: Kunder - Universal CRM System with Pricing */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'clients')}>
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 2, md: 2.5 },
                      mb: 3,
                      borderRadius: 4,
                      border: `1px solid ${alpha(customBranding.color, 0.12)}`,
                      background: `linear-gradient(135deg, ${alpha(customBranding.color, 0.08)} 0%, rgba(255,255,255,0.98) 58%, ${alpha('#0f172a', 0.02)} 100%)`,
                      boxShadow: `0 20px 46px ${alpha('#0f172a', 0.06)}`,
                    }}
                  >
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: theming.colors.primary, mb: 0.75 }}>
                          Kundehåndtering
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 860 }}>
                          Hold kundeoversikt, prisadministrasjon og møter samlet i samme arbeidsområde, med tydelig kontekst mot prosjekter og CRM-data.
                        </Typography>
                      </Box>

                      <Box sx={{ borderBottom: 1, borderColor: alpha(customBranding.color, 0.12) }}>
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
                      <Tab label="Kundehåndtering" icon={<Person />} iconPosition="start" />
                      <Tab label="Prisadministrasjon" icon={<AttachMoney />} iconPosition="start" />
                      <Tab label="Google Møter" icon={<Event />} iconPosition="start" />
                    </MuiTabs>
                      </Box>
                    </Stack>
                  </Paper>

                  {selectedTimelineTab === 0 && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 1.25, md: 2 },
                        borderRadius: 4,
                        border: `1px solid ${alpha(customBranding.color, 0.08)}`,
                        backgroundColor: alpha('#ffffff', 0.96),
                        boxShadow: `0 18px 42px ${alpha('#0f172a', 0.06)}`,
                      }}
                    >
                      <UniversalCRMDashboard 
                        profession={profession}
                        onCustomerSelect={(customer) => {
                          setUniversalSelectedClient(customer as any);
                          console.log('Customer selected:', customer?.name || customer?.id);
                        }}
                      />
                    </Paper>
                  )}
                  
                  {selectedTimelineTab === 1 && (
                    <MuiCard
                      elevation={0}
                      sx={{
                        borderRadius: 4,
                        border: `1px solid ${alpha(customBranding.color, 0.08)}`,
                        backgroundColor: alpha('#ffffff', 0.96),
                        boxShadow: `0 18px 42px ${alpha('#0f172a', 0.06)}`,
                      }}
                    >
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
                    <MuiCard
                      elevation={0}
                      sx={{
                        borderRadius: 4,
                        border: `1px solid ${alpha(customBranding.color, 0.08)}`,
                        backgroundColor: alpha('#ffffff', 0.96),
                        boxShadow: `0 18px 42px ${alpha('#0f172a', 0.06)}`,
                        height: 'fit-content',
                      }}
                    >
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
                          preselectedProjectId={selectedProject?.id}
                          selectedProject={selectedProject}
                          onProjectSelect={setSelectedProject}
                        />
                      </MuiCardContent>
                    </MuiCard>
                  )}
                </Box>
              </TabPanel>

              {/* Tab 12: Utstyr (Equipment Management) */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'equipment')}>
                <Box sx={{ p: 3, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
                  <VisualEditorProvider>
                    <EnhancedGearTab
                      profession={getComponentProfession(profession, 'musicproducer') as any}
                      className="enhanced-equipment-tab"
                    />
                  </VisualEditorProvider>
                </Box>
              </TabPanel>

              {availableTabs.some((tab) => tab.id === 'files') && (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'files')}>
                  <GoogleDriveManager {...sharedGoogleDriveManagerProps} />
                </TabPanel>
              )}

              {/* Tab 14: Support */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'support')}>
                <HelpdeskSystem profession={profession} userId={userId} dashboardFeatures={[]} />
              </TabPanel>

              {/* Tab 15: Innstillinger */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings')}>
                {renderUnifiedSettingsPanel()}
              </TabPanel>

              {availableTabs.some((tab) => tab.id === 'files') && (
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
              )}

              {/* Tab: Administrasjon */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'administration')}>
                <Box sx={{ p: 3 }}>
                  {/* Slice 9X.17 — surface lønnsomhet + ufakturerte for fotograf */}
                  {profession === 'photographer' && <PhotographerAdminWidgets />}
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
                <ShowcaseAdmin
                  userId={userId}
                  profession={profession}
                  viewerContent={
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
                          console.log('Showcase item selected:', item);
                        }}
                        onItemUpdate={(item) => {
                          console.log('Showcase item updated:', item);
                        }}
                        onItemDelete={(item) => {
                          console.log('Showcase item deleted:', item);
                        }}
                      />
                      </VisualEditorProvider>
                      </RealTimeProvider>
                      </ThemeProvider>
                      </SettingsProvider>
                    </Box>
                  }
                />
              </TabPanel>

              {/* Tab 7: Universal File Upload - For videographers */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'file-upload')}>
                <DriveOperationsWorkspacePanel
                  userId={userId}
                  profession={profession}
                  selectedProject={selectedProject}
                  selectedClient={selectedClient}
                  projects={projects}
                  onSelectProject={setSelectedProject}
                  onSelectClient={setSelectedClient}
                  onProjectUpdate={(project) => {
                    if (project?.id) {
                      updateProject(project.id, project);
                    }
                  }}
                />
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
                    <CreatorHubPhotoEnhancer profession={getComponentProfession(profession) as any} />
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

              {/* Tab 10: Worklog */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'worklog')}>
                <SettingsProvider>
                  <RealTimeProvider>
                    <VisualEditorProvider>
                      <UniversalWorklog 
                        projectId={userId}
                        userId={userId}
                        profession={getComponentProfession(profession, 'musicproducer') as any}
                      />
                    </VisualEditorProvider>
                  </RealTimeProvider>
                </SettingsProvider>
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
                    <VisualEditorProvider>
                      <EnhancedGearTab
                        profession={getComponentProfession(profession, 'musicproducer') as any}
                        className="enhanced-equipment-tab"
                      />
                    </VisualEditorProvider>
                  )}
                </Box>
              </TabPanel>

              {availableTabs.some((tab) => tab.id === 'files') && (
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
                          <GoogleDriveManager {...sharedGoogleDriveManagerProps} />
                        </Box>
                      </Grid2>
                    </Grid2>
                  </Box>
                </TabPanel>
              )}

              {/* Tab 11: Innstillinger */}
              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'settings')}>
                {renderUnifiedSettingsPanel()}
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
                <SettingsProvider>
                  <RealTimeProvider>
                    <VisualEditorProvider>
                      <UniversalWorklog 
                        projectId={userId}
                        userId={userId}
                        profession={getComponentProfession(profession, 'musicproducer') as any}
                      />
                    </VisualEditorProvider>
                  </RealTimeProvider>
                </SettingsProvider>
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

              {/* Tab 4: Equipment for non-music professions */}
              {(profession as string) !== 'music_producer' ? (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'equipment') >= 0 ? availableTabs.findIndex(tab => tab.id === 'equipment') : 4}>
                  <ProfessionAdapter profession={profession as any} tabIndex={4} projectId={userId} />
                </TabPanel>
              ) : null}

              {/* Tab 5: Universal File Upload for Music Producers, Files for others */}
              {(profession as string) === 'music_producer' ? (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'file-upload') >= 0 ? availableTabs.findIndex(tab => tab.id === 'file-upload') : 5}>
                  <DriveOperationsWorkspacePanel
                    userId={userId}
                    profession={profession}
                    selectedProject={selectedProject}
                    selectedClient={selectedClient}
                    projects={projects}
                    onSelectProject={setSelectedProject}
                    onSelectClient={setSelectedClient}
                    onProjectUpdate={(project) => {
                      if (project?.id) {
                        updateProject(project.id, project);
                      }
                    }}
                  />
                </TabPanel>
              ) : (
                <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'files') >= 0 ? availableTabs.findIndex(tab => tab.id === 'files') : 5}>
                  <GoogleDriveManager {...sharedGoogleDriveManagerProps} />
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
                {renderUnifiedSettingsPanel()}
              </TabPanel>

              <TabPanel value={tabValue} index={availableTabs.findIndex(tab => tab.id === 'integration-test') >= 0 ? availableTabs.findIndex(tab => tab.id === 'integration-test') : 8}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                    Google Drive Integrasjon
                  </Typography>
                  <GoogleDriveManager {...sharedGoogleDriveManagerProps} />
                  
                  <Box sx={{ mt: 3 }}>
                    <GoogleDriveProjectSync {...sharedGoogleDriveProjectSyncProps} />
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

              {showLegacyVendorSettings && (
                <>
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
                      <MuiCard elevation={0} sx={dashboardSectionCardSx}>
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
                      <MuiCard elevation={0} sx={dashboardSectionCardSx}>
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
                            <GoogleDriveManager {...sharedGoogleDriveManagerProps} />
                            
                            <Box sx={{ mt: 3 }}>
                              <GoogleDriveProjectSync {...sharedGoogleDriveProjectSyncProps} />
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

                    <TabPanel value={settingsTabValue} index={2}>
                      <MuiCard elevation={0} sx={dashboardSectionCardSx}>
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
                    <TabPanel value={settingsTabValue} index={3}>
                      <MuiCard elevation={0} sx={dashboardSectionCardSx}>
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
                              profession={profession}
                              userId={userId}
                              onSelect={handleMarketplaceInstall}
                              appStateById={{
                                'role-room': roleRoomMarketplaceState,
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

                    <TabPanel value={settingsTabValue} index={4}>
                      <MuiCard elevation={0} sx={dashboardSectionCardSx}>
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
            </>
          )}

        
            {/* BRREG and Optimization Background Functions */}
            <BRREGIntegration profession={profession as any} mode="background" />
          </MuiCard>
          </>
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
          const fileUploadTabIndex = availableTabs.findIndex((tab) => tab.id === 'file-upload');
          if (fileUploadTabIndex >= 0) {
            setTabValue(fileUploadTabIndex);
            return;
          }

          const filesTabIndex = availableTabs.findIndex((tab) => tab.id === 'files');
          if (filesTabIndex >= 0) {
            setTabValue(filesTabIndex);
          }
        }}
        onNotificationCenterOpen={() => {
          setShowChat(false);
          setShowNotifications(!showNotifications);
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
      />

      {/* Chat Button with Status Indicator */}
      {!chatWorkspaceVisible && (
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
              onClick={() => {
                setShowNotifications(false);
                setShowChat(true);
              }}
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
        onClose={() => {
          setShowQuickNotesModal(false);
          setMeetingNotesProjectId(undefined);
        }}
        profession={profession as any}
        preselectedProjectId={meetingNotesProjectId || selectedProject?.id}
        selectedProject={selectedProject}
        onProjectSelect={setSelectedProject}
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
          <Typography variant="h5" component="div" sx={{ fontWeight: 600, color: theming.colors.primary }}>
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
        maxWidth={false}
        fullScreen
        PaperProps={{
          sx: {
            borderRadius: 0,
            background: '#f5f5f0'
          }
        }}
      >
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <EmailDesigner
            context="general"
            projectId={emailProjectContext?.projectId || selectedProject?.id}
            profession={profession}
            userId={currentUser?.id || userId}
            selectedProject={selectedProject || null}
            onProjectSelect={(projectSelection) => {
              if (projectSelection) {
                setSelectedProject(projectSelection);
              }
            }}
            onSave={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/email/templates'] });
            }}
            onMeetingCreate={handleChatMeetingCreated}
            onProjectUpdate={(projectUpdate) => {
              const nextProjectId =
                projectUpdate && typeof projectUpdate.id === 'string'
                  ? projectUpdate.id
                  : selectedProject?.id;

              if (!nextProjectId) {
                return;
              }

              updateProject(nextProjectId, projectUpdate);
              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
            }}
            onWorklogCreate={async (worklogEntry) => {
              const targetProjectId =
                worklogEntry && typeof worklogEntry.projectId === 'string' && worklogEntry.projectId.trim().length > 0
                  ? worklogEntry.projectId.trim()
                  : selectedProject?.id || '';
              const payload = {
                title:
                  worklogEntry && typeof worklogEntry.title === 'string' && worklogEntry.title.trim().length > 0
                    ? worklogEntry.title
                    : 'E-postarbeid',
                description:
                  worklogEntry && typeof worklogEntry.description === 'string' && worklogEntry.description.trim().length > 0
                    ? worklogEntry.description
                    : 'Arbeid utført i e-postdesigneren.',
                category:
                  worklogEntry && typeof worklogEntry.category === 'string' && worklogEntry.category.trim().length > 0
                    ? worklogEntry.category
                    : 'email',
                timeSpent:
                  worklogEntry && typeof worklogEntry.timeSpent === 'number'
                    ? worklogEntry.timeSpent
                    : 15,
                day:
                  worklogEntry && typeof worklogEntry.day === 'number'
                    ? worklogEntry.day
                    : 1,
                userId: currentUser?.id || userId,
              };

              try {
                if (targetProjectId) {
                  await apiRequest(`/api/projects/${encodeURIComponent(targetProjectId)}/worklog`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  await queryClient.invalidateQueries({ queryKey: ['/api/projects', targetProjectId, 'worklog'] });
                  return;
                }

                await apiRequest('/api/worklog', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                await queryClient.invalidateQueries({ queryKey: ['/api/worklog'] });
              } catch (error) {
                console.warn('Could not create worklog entry from email designer:', error);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {chatWorkspaceVisible && (
        <>
          <Box
            onClick={() => setShowChat(false)}
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: dashboardOverlayZIndex,
              background: showChat
                ? 'radial-gradient(circle at 82% 78%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 28%), linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0.06) 100%)'
                : 'linear-gradient(180deg, rgba(15,23,42,0.015) 0%, rgba(15,23,42,0.02) 100%)',
              willChange: 'opacity, transform',
              animation: showChat
                ? 'workspaceChatBackdropIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both'
                : 'workspaceChatBackdropOut 220ms cubic-bezier(0.4, 0, 0.2, 1) both',
              '@keyframes workspaceChatBackdropIn': {
                '0%': {
                  opacity: 0,
                },
                '100%': {
                  opacity: 1,
                },
              },
              '@keyframes workspaceChatBackdropOut': {
                '0%': {
                  opacity: 1,
                },
                '100%': {
                  opacity: 0,
                },
              },
            }}
          />
          <UniversalChatWidget
            profession={profession as any}
            userId={userId}
            userEmail={userEmail}
            selectedProject={selectedProject}
            onProjectSelect={setSelectedProject}
            selectedClient={selectedClient}
            onClientSelect={setSelectedClient}
            onMeetingCreate={handleChatMeetingCreated}
            isOpen={true}
            workspaceTransitionState={chatWorkspaceTransitionState}
            onClose={() => setShowChat(false)}
            layerZIndex={dashboardWorkspaceZIndex}
            openLayout={chatWorkspaceLayout}
            externalEmailInquiry={chatEmailIntent}
            requestedTab={chatRequestedTab}
          />
        </>
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
            zIndex: dashboardPanelZIndex,
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

      {/* Notification overlay when open */}
      {showNotifications && (
        <Box
          onClick={() => {
            setShowNotifications(false);
          }}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: dashboardOverlayZIndex}}
        />
      )}

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
                    if (!selectedClient?.email) {
                      const clientsTabIndex = availableTabs.findIndex(tab => tab.id === 'clients');
                      if (clientsTabIndex >= 0) setTabValue(clientsTabIndex);
                      setShowCrmDialog(false);
                      return;
                    }
                    handleOpenEmailWorkspace(selectedClient);
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
          <Typography component="div" variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
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
            <Typography component="div" variant="h6" sx={{ fontWeight: 700}}>
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
            <Typography component="div" variant="h6" sx={{ color: theming.colors.primary }}>
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
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: dashboardFullscreenZIndex, bgcolor: 'background.default' }}>
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: dashboardFullscreenControlZIndex }}>
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
          <AcademyProvider>
            <AcademyDashboard />
          </AcademyProvider>
        </Box>
      )}

      {/* Showcase Overlay */}
      {showShowcase && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: dashboardFullscreenZIndex, bgcolor: 'background.default' }}>
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: dashboardFullscreenControlZIndex }}>
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
            <Typography component="div" variant="h6" fontWeight={600}>
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
              <Alert severity={marketplaceInstallNotice.severity} sx={{ mb: 2 }}>
                {marketplaceInstallNotice.message}
              </Alert>
            )}
            <CreatorHubMarketplace 
              profession={profession}
              userId={userId}
              onSelect={handleMarketplaceInstall}
              appStateById={{
                'role-room': roleRoomMarketplaceState,
              }}
            />
          </Box>
        </DialogContent>
      </Dialog>

      {isPrototypeTester && (
        <UniversalPrototypeFeedback
          profession={profession}
          dashboardType="universal"
          component="dashboard"
          currentTab={config.tabs[tabValue]?.id}
          userEmail={userEmail}
          floatingPosition={{ bottom: 96, right: 24, zIndex: 1200 }}
        />
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
