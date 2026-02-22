import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { isProfessionFeatureAvailable } from '../../../shared/profession-feature-matrix';
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { trackButtonClick } from '@/hooks/useActionTracker';
import { useDemoMode } from '@/contexts/DemoModeContext';
import AdminIndicator from '../admin/AdminIndicator';
import { Card as MuiCard, CardContent as MuiCardContent, CardActions as MuiCardActions } from '@mui/material';
import {
  Box,
  Container,
  Typography,
  Grid,
  Avatar,
  Button,
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
  Stack,
  LinearProgress,
  alpha,
  Fade,
  Collapse,
  Skeleton,
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  SwipeableDrawer,
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
  PhotoLibrary,
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
  AutoFixHigh,
  SmartToy,
  ToggleOn as SwitchIcon,
  MovieCreation,
  Menu,
  Home,
  Close,
} from '@mui/icons-material';

// Import profession-specific components
import BRREGIntegration from './profession-specific/BRREGIntegration';
import AdvancedClientManagement from './profession-specific/AdvancedClientManagement';

// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import EquipmentManagementDB from './profession-specific/EquipmentManagementDB';
import ProfessionAdapter from './ProfessionAdapter';
import SmartWorkflowBuilder from './SmartWorkflowBuilder';
import FloatingActionButtons from './misc/FloatingActionButtons';

// Import Settings Components
import PriceAdministration from '../PriceAdministration';
import BusinessBrandingSettings from '../BusinessBrandingSettings';

// Import Tutorial & FAQ System
import { TutorialFAQIntegration } from '../tutorial/TutorialFAQIntegration';
import { InteractiveTutorialCreator } from '../tutorial/InteractiveTutorialCreator';
import { CreatorHubBadgeSystem } from '../gamification/CreatorHubBadgeSystem';
import { CompactBadgeDisplay } from '../gamification/CompactBadgeDisplay';
import WeddingTimelineAdmin from '../wedding/WeddingTimelineAdmin';

// Import Universal Settings Panel
import UniversalSettingsPanel from './UniversalSettingsPanel';

// Import Google Drive components
import GoogleDriveManager from '../google-drive/GoogleDriveManager';
import GoogleDriveProjectSync from '../google-drive/GoogleDriveProjectSync';
import GoogleWorkspaceStorageInfo from './GoogleWorkspaceStorageInfo';

// Import Equipment Management components
import ComprehensiveEquipmentDashboard from '@/components/universal/misc/ComprehensiveEquipmentDashboard';
import CameraEquipmentManager from '@/components/universal/misc/CameraEquipmentManager';
import MemoryCardManager from '@/components/universal/misc/MemoryCardManager';

// Import Gear News component
import { EnhancedGearTab } from '../dashboard/EnhancedGearTab';
import PersonalizedNewsInterface from '../news/PersonalizedNewsInterface';
import { QuickMeetingNotesModal } from '../meetings/QuickMeetingNotesModal';
import SmartEmailCenter from '../email/SmartEmailCenter';
import IntegratedEmailCenter from '../email/IntegratedEmailCenter';
import CustomerInquiryCenter from '../email/CustomerInquiryCenter';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import VendorProductManager from '../vendor/VendorProductManager';
import GoogleWorkspaceMeetingManager from '../meetings/GoogleWorkspaceMeetingManager';
import FilesTab from './tabs/FilesTab';
import SubmissionsOverview from './submissions/SubmissionsOverview';
import UniversalKeyboardShortcuts from '../keyboard-shortcuts/UniversalKeyboardShortcuts';
import SmartTimingPreferences from '../smart-timing/SmartTimingPreferences';
import HelpdeskSystem from './HelpdeskSystem';

// Import Timeline & Showcase components for universal access
import ProjectTimeline from '../project/ProjectTimeline';
import ProjectShowcase from '../project/ProjectShowcase';
import { ChatWidget } from '../communication/ChatWidget';
import UniversalChatWidget from '../chat/UniversalChatWidget';
import UniversalPrototypeFeedback from '../prototype-testing/UniversalPrototypeFeedback';
import CentralizedSalesHub from '../sales/CentralizedSalesHub';
import TutorialLauncher from '../tutorials/TutorialLauncher';
import VideoEditor from '../video-editing/VideoEditor';
import StoryArcGenerator from '../StoryArcGenerator';
import UniversalCommunication from '../communication/UniversalCommunication';
import UniversalWorklog from '../worklog/UniversalWorklog';
import PhotographerEmailCenter from '../email/PhotographerEmailCenter';
import EmailProjectHistory from '../email/EmailProjectHistory';
import ContextualPhotographyTipsOverlay from '../photography/ContextualPhotographyTipsOverlay';
import ShowcaseAdmin from '../showcase/ShowcaseAdmin';
import WeddingTimelineOverview from '../wedding/WeddingTimelineOverview';
import WeddingTimelineClientAccess from '../wedding/WeddingTimelineClientAccess';
import WeddingTimelineClientView from '../wedding/WeddingTimelineClientView';
import WeddingTimelineChangesOverview from '../wedding/WeddingTimelineChangesOverview';

// Import Story Arc Studio for Pro Editor Mode
import StoryArcStudio from '../StoryArcStudio';

// Import tested integration components
import UniversalOAuthIntegration from '../oauth/UniversalOAuthIntegration';
import IntegratedToolsOverview from './IntegratedToolsOverview';
import EmailDesigner from '../EmailDesigner/EmailDesigner';

// Import Universal CRM System
import UniversalCRMDashboard from '../crm/UniversalCRMDashboard';

// Import Universal Contract System
import { UniversalContractHub } from './contracts';

// Import Orchestrators
import FotografOrchestrator from './FotografOrchestrator';
import VideografOrchestrator from './VideografOrchestrator';
import MusikkProdusentOrchestrator from './MusikkProdusentOrchestrator';
import VendorOrchestrator from './VendorOrchestrator';

// Import AI Enhancement Systems
import PhotoEnhancementSuite from '../enhancement/PhotoEnhancementSuite';
import AudioEnhancementSuite from '../enhancement/AudioEnhancementSuite';

// Local profession configurations (names will be overridden by dynamic profession data)
const localProfessionConfigs = {
  photographer: {
    name: 'Fotograf', // Fallback - will be overridden by dynamic profession data
    color: '#ff8c00',
    icon: theming.getThemedIcon(''),
    tabs: [
      { id: 'overview', label: 'Hjem', icon: theming.getThemedIcon(','), mobileLabel: 'Hjem',},
      { id: 'projects', label: 'Prosjekter', icon: theming.getThemedIcon(','), mobileLabel: 'Prosjekter',},
      { id: 'contracts', label: 'Kontrakter', icon: theming.getThemedIcon(','), mobileLabel: 'Kontrakter',},
      { id: 'wedding-timeline', label: 'Bryllup', icon: <Event />, mobileLabel: 'Bryllup',},
      { id: 'showcase-admin', label: 'Showcase', icon: theming.getThemedIcon(','), mobileLabel: 'Showcase',},
      { id: 'ai-enhancement', label: 'A', icon: theming.getThemedIcon(','), mobileLabel: 'AI',},
      { id: 'email-center', label: 'E-post', icon: theming.getThemedIcon(','), mobileLabel: 'E-post',},
      { id: 'clients', label: 'Kunder', icon: theming.getThemedIcon(','), mobileLabel: 'Kunder',},
      { id: 'equipment', label: 'Utstyr', icon: theming.getThemedIcon(','), mobileLabel: 'Utstyr',},
      { id: 'files', label: 'Filer', icon: theming.getThemedIcon(','), mobileLabel: 'Filer',},
      { id: 'settings', label: 'Mer', icon: theming.getThemedIcon(','), mobileLabel: 'Mer',}
    ],
    projectTypes: ['bryllup','bedrift','portrett','produkt'],
    stats: [
      { key: 'projects', label: 'Aktive Prosjekter', icon: theming.getThemedIcon(',') },
      { key: 'clients', label: 'Nye Kunder', icon: theming.getThemedIcon(',') },
      { key: 'revenue', label: 'Månedens Inntekt', icon: theming.getThemedIcon(',') },
      { key: 'rating', label: 'Vurdering', icon: theming.getThemedIcon(',') }
    ]
},
  videographer: {
    name: 'Videograf', // Fallback - will be overridden by dynamic profession data
    color: '#e91e63',
    icon: theming.getThemedIcon('videocam'),
    tabs: [
      { id: 'overview', label: 'Hjem', icon: theming.getThemedIcon(','), mobileLabel: 'Hjem',},
      { id: 'projects', label: 'Videoer', icon: theming.getThemedIcon(','), mobileLabel: 'Videoer',},
      { id: 'contracts', label: 'Kontrakter', icon: theming.getThemedIcon(','), mobileLabel: 'Kontrakter',},
      { id: 'wedding-timeline', label: 'Bryllup', icon: <Event />, mobileLabel: 'Bryllup',},
      { id: 'showcase-admin', label: 'Showcase', icon: theming.getThemedIcon(','), mobileLabel: 'Showcase',},
      { id: 'ai-enhancement', label: 'Video A', icon: theming.getThemedIcon(','), mobileLabel: 'AI',},
      { id: 'email-center', label: 'E-post', icon: theming.getThemedIcon(','), mobileLabel: 'E-post',},
      { id: 'clients', label: 'Kunder', icon: theming.getThemedIcon(','), mobileLabel: 'Kunder',},
      { id: 'equipment', label: 'Utstyr', icon: theming.getThemedIcon(','), mobileLabel: 'Utstyr',},
      { id: 'files', label: 'Filer', icon: theming.getThemedIcon(','), mobileLabel: 'Filer',},
      { id: 'settings', label: 'Mer', icon: theming.getThemedIcon(','), mobileLabel: 'Mer',}
    ],
    projectTypes: ['bryllup','reklame','dokumentar','musikkvideo'],
    stats: [
      { key: 'projects', label: 'Aktive Prosjekter', icon: theming.getThemedIcon(',') },
      { key: 'clients', label: 'Nye Kunder', icon: theming.getThemedIcon(',') },
      { key: 'revenue', label: 'Månedens Inntekt', icon: theming.getThemedIcon(',') },
      { key: 'hours', label: 'Timer Redigert', icon: theming.getThemedIcon(',') }
    ]
},
  music_producer: {
    name: 'Musikkprodusent',
    color: '#9c27b0',
    icon: theming.getThemedIcon('music'),
    tabs: [
      { id: 'overview', label: 'Hjem', icon: theming.getThemedIcon(','), mobileLabel: 'Hjem',},
      { id: 'projects', label: 'Låter', icon: theming.getThemedIcon(','), mobileLabel: 'Låter',},
      { id: 'contracts', label: 'Kontrakter', icon: theming.getThemedIcon(','), mobileLabel: 'Kontrakter',},
      { id: 'ai-enhancement', label: 'Audio A', icon: theming.getThemedIcon(','), mobileLabel: 'AI',},
      { id: 'email-center', label: 'E-post', icon: theming.getThemedIcon(','), mobileLabel: 'E-post',},
      { id: 'clients', label: 'Artister', icon: theming.getThemedIcon(','), mobileLabel: 'Artister',},
      { id: 'equipment', label: 'Studio', icon: theming.getThemedIcon(','), mobileLabel: 'Studio',},
      { id: 'files', label: 'Filer', icon: theming.getThemedIcon(','), mobileLabel: 'Filer',},
      { id: 'settings', label: 'Mer', icon: theming.getThemedIcon(','), mobileLabel: 'Mer',}
    ],
    projectTypes: ['album','singel','podcast','jingle'],
    stats: [
      { key: 'tracks', label: 'Aktive Spor', icon: theming.getThemedIcon(',') },
      { key: 'artists', label: 'Nye Artister', icon: theming.getThemedIcon(',') },
      { key: 'revenue', label: 'Månedens Inntekt', icon: theming.getThemedIcon(',') },
      { key: 'streams', label: 'Totale Streams', icon: theming.getThemedIcon(',') }
    ]
},
  vendor: {
    name: 'Leverandø',
    color: '#27ae60',
    icon: theming.getThemedIcon(''),
    tabs: [
      { id: 'overview', label: 'Hjem', icon: theming.getThemedIcon(','), mobileLabel: 'Hjem',},
      { id: 'projects', label: 'Produkter', icon: theming.getThemedIcon(','), mobileLabel: 'Produkter',},
      { id: 'clients', label: 'Bestillinger', icon: theming.getThemedIcon(','), mobileLabel: 'Bestillinger',},
      { id: 'equipment', label: 'Lager', icon: theming.getThemedIcon(','), mobileLabel: 'Lager',},
      { id: 'files', label: 'Filer', icon: theming.getThemedIcon(','), mobileLabel: 'Filer',},
      { id: 'settings', label: 'Mer', icon: theming.getThemedIcon(','), mobileLabel: 'Mer',}
    ],
    projectTypes: ['utleie', 'salg', 'service','konsultasjon'],
    stats: [
      { key: 'orders', label: 'Aktive Ordrer', icon: theming.getThemedIcon(',') },
      { key: 'customers', label: 'Nye Kunder', icon: theming.getThemedIcon(',') },
      { key: 'revenue', label: 'Månedens Inntekt', icon: theming.getThemedIcon(', ') },
      { key: 'inventory', label: 'Lagerstatus', icon: theming.getThemedIcon(', ') }
    ]
}
};

interface UniversalDashboardMobileProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'admin' | 'enterprise';
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
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void
}

export default function UniversalDashboardMobile({ 
  profession = 'photographer',
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
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: UniversalDashboardMobileProps) {
  // Mobile-specific state
  const [activeTab, setActiveTab] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showQuickNotesModal, setShowQuickNotesModal] = useState(false);
  const [showProjectCreation, setShowProjectCreation] = useState(false);
  const [showVendorProductDialog, setShowVendorProductDialog] = useState(false);
  const [showEmailCenter, setShowEmailCenter] = useState(false);
  const [showEmailDesigner, setShowEmailDesigner] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPrototypeFeedback, setShowPrototypeFeedback] = useState(false);
  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [emailProjectContext, setEmailProjectContext] = useState<any>(null);
  const [proEditorMode, setProEditorMode] = useState(false);
  const [showFAQDialog, setShowFAQDialog] = useState(false);
  const [settingsTabValue, setSettingsTabValue] = useState(0);
  const [selectedTimelineTab, setSelectedTimelineTab] = useState(0);
  
  // Project management states
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);

  // Universal Demo Mode Integration
  const { isDemoMode, isLoading: demoModeLoading } = useDemoMode();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession === 'admin' ? 'photographer' : profession);

  // Get profession configuration with branding override
  // Get base config from local configs (for tabs, stats, project types)
  const baseConfig = localProfessionConfigs[profession] || localProfessionConfigs.photographer;
  
  // Enhance with dynamic profession branding (auto-scalable)
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

  // Fetch user session
  const { data: userSession } = useQuery({
    queryKey: [', '],
    queryFn: () => apiRequest('/api/auth/public-session', ),
    retry: false
});

  const userId = userSession?.userId || 'guest';
  const userEmail = userSession?.email;

  // Check admin permissions
  const { data: adminPermissions } = useQuery({
    queryKey: ['/api/admin/permissions', userEmail],
    queryFn: () => apiRequest(`/api/admin/permissions?email=${userEmail}`),
    enabled: !!userEmail && userEmail === 'current user'
});

  // Check if user is admin
  const isAdmin = userEmail === 'current user' || adminPermissions?.fullAccess;

  // Fetch onboarding profile for branding customization
  const { data: onboardingProfile } = useQuery({
    queryKey: ['/api/onboarding/profile', userId],
    queryFn: () => apiRequest(`/api/onboarding/profile/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch business branding settings for real-time updates
  const { data: brandingData } = useQuery({
    queryKey: ['/api/branding/business-info', userId],
    queryFn: () => apiRequest(['/api/branding/business-info', userId], {
      headers: {
}
}),
    enabled: !!userId && userId !== 'guest'
});

  // Apply custom branding from both onboarding profile and business branding settings
  const customBranding = useMemo(() => {
    // Merge data from branding settings (priority) and onboarding profile (fallback)
    const brandingInfo = brandingData?.businessInfo || {};
    const onboardingInfo = onboardingProfile || {};
    
    // Helper to ensure we always get a string (not an object)
    const getStringValue = (value: unknown): string | null => {
      if (typeof value === 'string' && value.trim()) return value;
      return null;
    };
    
    const businessNameRaw = getStringValue(brandingInfo.businessName) 
      || getStringValue(onboardingInfo.businessName) 
      || getStringValue(config?.name)
      || 'CreatorHub';
    
    return {
      color: brandingInfo.brandingColor || onboardingInfo.brandingColor || config?.color || '#ff8c00',
      businessName: businessNameRaw,
      tagline: brandingInfo.tagline || onboardingInfo.tagline || null,
      profilePhoto: onboardingInfo.profilePhoto || null,
      customLogo: brandingInfo.customLogo || onboardingInfo.customLogo || null
};
}, [onboardingProfile, brandingData, config]);

  // Fetch dashboard data based on profession
  const { data: dashboardData = {} } = useQuery({
    queryKey: [`/api/dashboard/${profession}`, userId],
    queryFn: () => apiRequest(`/api/dashboard/${profession}/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch real projects from database
  const { data: projects = [, ],} = useQuery({
    queryKey: ['/api/projects', { profession, userId }],
    queryFn: () => apiRequest(`/api/projects?profession=${profession}&userId=${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch unread email count for email icon
  const { data: unreadEmailData } = useQuery({
    queryKey: ['/api/emails/unread-count', userId],
    queryFn: () => apiRequest(`/api/emails/unread-count/${userId}`),
    enabled: !!userId && userId !== 'guest'
});

  // Fetch recent notifications
  const { data: recentNotifications = [, ],} = useQuery({
    queryKey: ['/api/notifications/recent', userId],
    queryFn: () => apiRequest(`/api/notifications/recent/${userId}?limit=5`),
    enabled: !!userId && userId !== 'guest'
});

  const unreadEmailCount = unreadEmailData?.count || 0;

  // Dynamic profession system
  const { professionConfigs, isLoading: professionsLoading, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle, adaptTabLabels } = useProfessionAdapter();

  /**
   * Check if profession supports specific features
   * Connected to profession-feature-matrix.ts for centralized feature management
   */
  const professionSupports = (feature: string) => {
    const config = professionConfigs[profession];
    if (!config) return false;
    
    // Check centralized feature matrix first
    const matrixResult = isProfessionFeatureAvailable(profession, feature);
    if (matrixResult) {
      return true;
    }
    
    // Fallback to local feature mapping for features not in matrix
    const featureMap: Record<string, string[]> = {
      wedding_timeline: ['photographer'],
      camera_projects: ['photographer','videographer'], 
      vendor_products: ['vendor'],
      music_projects: ['music_producer']
    };
    
    return featureMap[feature]?.includes(profession) || false;
  };

  // Get dynamic project creation text
  const getProjectCreationText = () => {
    const projectTypes: Record<string, string> = {
      photographer: 'Nytt Prosjekt',
      videographer: 'Ny Video', 
      music_producer: 'Ny Lå',
      vendor: 'Nytt Produkt'
};
    
    return projectTypes[profession] || 'Nytt';
};

  // Project management functions
  const handleEditProject = (project: any) => {
    setSelectedProject(project);
    setShowEditProjectModal(true);
};

  const handleDeleteProject = (project: any) => {
    setSelectedProject(project);
    setShowDeleteProjectDialog(true);
};

  const handleViewProjectDetails = (project: any) => {
    setSelectedProject(project);
    setShowProjectDetailsModal(true);
};

  const confirmDeleteProject = async () => {
    if (!selectedProject) return;
    
    try {
 return apiRequest(`/api/projects/${selectedProject.id}`, {
   headers: {
          "Content-Type" : "application/json"
  },
        headers: {
  },
        
        method: 'DELET',
  });
      
      window.location.reload();
} catch (error) {
      // Error logged to backend
} finally {
      setShowDeleteProjectDialog(false);
      setSelectedProject(null);
}
};

  // Mobile Tab Content Renderer
  const renderMobileTabContent = () => {
    const tabId = config.tabs[activeTab]?.id;

    switch (tabId) {
      case 'overview':
        return renderOverviewContent();
      case 'projects':
        return renderProjectsContent();
      case 'contracts':
        return <UniversalContractHub profession={profession as any} userId={userId} />;
      case 'wedding-timeline':
        return renderWeddingTimelineContent();
      case 'showcase-admin':
        return <ShowcaseAdmin profession={profession} userId={userId} />;
      case 'ai-enhancement':
        return renderAIContent();
      case 'email-center':
        return renderEmailContent();
      case 'clients':
        return renderClientsContent();
      case 'equipment':
        return renderEquipmentContent();
      case 'files':
        return <FilesTab profession={profession} userId={userId} />;
      case 'settings':
        return renderSettingsContent();
      default: return renderOverviewContent();
}
};

  // Mobile Overview Content
  const renderOverviewContent = () => (
    <Box sx={{ pb: 10}}>
      {/* Mobile Header Card */}
      <MuiCard 
        sx={{ 
          mb:  3,
          background: `linear-gradient(135deg, ${customBranding.color}15 0%, ${customBranding.color}05 100%)`,
          border: `1px solid ${alpha(customBranding.color, 0.2)}`,
          borderRadius: 3 }}
      >
        <MuiCardContent sx={{ p:  3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar 
              src={customBranding.profilePhoto}
              sx={{ 
                bgcolor: customBranding.color, 
                width:  56, 
                height:  56,
                border: `2px solid ${customBranding.color}`
          }}
            >
              {!customBranding.profilePhoto && config.icon}
            </Avatar>
            <Box sx={{ flex:  1 }}>
              <Typography variant="h6" 
                sx={{  
                  fontWeight: 600,
                  color: customBranding.color,
                  mb: 0.5  }}>
                Hei, {typeof customBranding.businessName === 'string' ? customBranding.businessName : 'bruker'}!
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
              >
                {customBranding.tagline || `${projects?.length || 0} aktive prosjekter`}
              </Typography>
            </Box>
          </Box>

          {/* Quick Action Buttons - Mobile Optimized */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
            <Button variant="contained"
              size="small"
              startIcon={theming.getThemedIcon('addCircle')}
              onClick={() => {
                trackButtonClick('ny_prosjekt_mobil', { profession });
                if (professionSupports('vendor_products')) {
                  setShowVendorProductDialog(true);
            } else {
                  setShowProjectCreation(true);
            }
          }}
              sx={{
                bgcolor: customBranding.color,
                fontSize: '0.8rem',
                flex:  1,
                minWidth: 120 }}
            >
              {getProjectCreationText()}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={theming.getThemedIcon('article')}
              onClick={() => setShowQuickNotesModal(true)}
              sx={{
                borderColor: customBranding.color,
                color: customBranding.color,
                fontSize: '0.8rem',
                flex:  1,
                minWidth: 100 }}
            >
              Notater
            </Button>
          </Box>
        </MuiCardContent>
      </MuiCard>

      {/* Mobile Stats Grid */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        {config.stats.map((stat, index) => (
          <Grid size={{ xs: 6 }} key={stat.key}>
            <MuiCard
              sx={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.95) 100%)',
                border: `1px solid ${alpha(customBranding.color, 0.1)}`,
                borderRadius: 2,
                transition: 'transform 0.2s ease',
                '&:active': {
                  transform: 'scale(0.98)'
                }
              }}
            >
              <MuiCardContent sx={{ p: 2, textAlign: 'center'}}>
                <Box sx={{ color: customBranding.color, mb:  1 }}>
                  {stat.icon}
                </Box>
                <Typography variant="h6" sx={{  fontWeight: 600,fontSize: '1.1rem' }}>
                  {dashboardData[stat.key] || '0'}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: '0.75rem'}}
                >
                  {stat.label}
                </Typography>
              </MuiCardContent>
            </MuiCard>
          </Grid>
        ))}
      </Grid>

      {/* Recent Projects - Mobile List View */}
      <Box>
        <Typography variant="h6" 
          sx={{  
            mb: 2, fontWeight: 60
           , color: customBranding.color 
     }}>
          Nylige Prosjekter
        </Typography>
        
        {projects && projects.length > 0 ? (
          <Stack spacing={2}>
            {projects.slice(0, 5).map((project: any, index: number) => (
              <MuiCard
                key={project.id || index}
                sx={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: `1px solid ${alpha(customBranding.color, 0.1)}`,
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  '&:active': {
                    transform: 'scale(0.98)'
                  }
                }}
                onClick={() => handleViewProjectDetails(project)}
              >
                <MuiCardContent sx={{ p:  2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                    <Avatar 
                      sx={{ 
                        width:  40, 
                        height:  40,
                        bgcolor: alpha(customBranding.color, 0.1),
                        color: customBranding.color
                }}
                    >
                      {(project.clientName || project.title || 'P').charAt(0).toUpperCase()}
                    </Avatar>
                    
                    <Box sx={{ flex: 1, minWidth:  0 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 60
                          fontSize: '0.95rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                  }}
                      >
                        {project.title || project.name}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ fontSize: '0.8rem'}}
                      >
                        {project.clientName || 'Klient ikke angitt'}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: 'right'}}>
                      <Chip 
                        size="small"
                        label={project.status}
                        sx={{
                          backgroundColor: alpha(customBranding.color, 0.1),
                          color: customBranding.color,
                          fontSize: '0.7rem',
                          height: 20 }}
                      />
                    </Box>
                  </Box>
                </MuiCardContent>
              </MuiCard>
            ))}
          </Stack>
        ) : (
          <MuiCard sx={{ 
            p: 4, 
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.7)' 
          }}>
            <Box sx={{ color: alpha(customBranding.color, 0.5), mb: 2 }}>
              {config.icon}
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
              Ingen prosjekter ennå
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
              Opprett ditt første prosjekt for å komme i gang
            </Typography>
            <Button variant="contained"
              startIcon={theming.getThemedIcon('addCircle')}
              onClick={() => {
                if (professionSupports('vendor_products')) {
                  setShowVendorProductDialog(true);
            } else {
                  setShowProjectCreation(true);
            }
          }}
              sx={{ bgcolor: customBranding.color }}
            >
              Opprett Prosjekt
            </Button>
          </MuiCard>
        )}
      </Box>
    </Box>
);

  // Mobile Projects Content
  const renderProjectsContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        Prosjekter
      </Typography>
      
      {projects && projects.length > 0 ? (
        <Stack spacing={2}>
          {projects.map((project: any, index: number) => (
            <MuiCard
              key={project.id || index}
              sx={{
                background: 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${alpha(customBranding.color, 0.1)}`,
                borderRadius: 2
              }}
            >
              <MuiCardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      width:  40, 
                      height:  40,
                      bgcolor: alpha(customBranding.color, 0.1),
                      color: customBranding.color
              }}
                  >
                    {(project.clientName || project.title || 'P').charAt(0).toUpperCase()}
                  </Avatar>
                  
                  <Box sx={{ flex: 1, minWidth:  0 }}>
                    <Typography 
                      variant="subtitle1" 
                      sx={{ fontWeight: 600,fontSize: '0.95rem'}}
                    >
                      {project.title || project.name}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                    >
                      {project.clientName || 'Klient ikke angitt'}
                    </Typography>
                  </Box>

                  <Chip 
                    size="small"
                    label={project.status}
                    sx={{
                      backgroundColor: alpha(customBranding.color, 0.1),
                      color: customBranding.color,
                      fontSize: '0.7rem'
              }}
                  />
                </Box>

                {project.eventDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Event sx={{ fontSize:  16, color: 'text.secondary'}} />
                    <Typography variant="body2" color="text.secondary">
                      {new Date(project.eventDate).toLocaleDateString('no-NO')}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap:  1 }}>
                  <Button
                    size="small"
                    startIcon={theming.getThemedIcon('launch')}
                    onClick={() => handleViewProjectDetails(project)}
                    sx={{ color: customBranding.color, flex:  1 }}
                  >
                    Se detaljer
                  </Button>
                  <Button
                    size="small"
                    startIcon={theming.getThemedIcon('edit')}
                    onClick={() => handleEditProject(project)}
                    sx={{ color: 'text.secondary', flex:  1 }}
                  >
                    Rediger
                  </Button>
                </Box>
              </MuiCardContent>
            </MuiCard>
          ))}
        </Stack>
      ) : (
        <MuiCard sx={{ p:  4, textAlign: 'center'}}>
          <Box sx={{ color: alpha(customBranding.color, 0.5), mb:  2 }}>
            {config.icon}
          </Box>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
            Ingen prosjekter ennå
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
            Opprett ditt første prosjekt for å komme i gang
          </Typography>
          <Button variant="contained"
            startIcon={theming.getThemedIcon('addCircle')}
            onClick={() => {
              if (professionSupports('vendor_products')) {
                setShowVendorProductDialog(true);
          } else {
                setShowProjectCreation(true);
          }
        }}
            sx={{ bgcolor: customBranding.color }}
          >
            Opprett Prosjekt
          </Button>
        </MuiCard>
      )}
    </Box>
);

  // Wedding Timeline Content (mobile optimized)
  const renderWeddingTimelineContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        Bryllupstidslinje
      </Typography>
      <WeddingTimelineAdmin profession={profession} userId={userId} />
    </Box>
);

  // AI Enhancement Content (mobile optimized)
  const renderAIContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        AI Forbedring
      </Typography>
      {profession === 'photographer' || profession === 'videographer' ? (
        <PhotoEnhancementSuite profession={profession} userId={userId} selectedProject={selectedProject} />
      ) : (
        <AudioEnhancementSuite profession={profession} userId={userId} />
      )}
    </Box>
);

  // Email Content (mobile optimized)
  const renderEmailContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        E-post Senter
      </Typography>
      <IntegratedEmailCenter profession={profession} userId={userId} />
    </Box>
);

  // Clients Content (mobile optimized)
  const renderClientsContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        {profession === 'music_producer' ? 'Artister' : `${getProfessionDisplayName(profession)} Kunder`}
      </Typography>
      <AdvancedClientManagement profession={profession} userId={userId} />
    </Box>
);

  // Equipment Content (mobile optimized)
  const renderEquipmentContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        {profession === 'vendor' ? 'Lager' : profession === 'music_producer' ? 'Studio' : 'Utstyr'}
      </Typography>
      <ComprehensiveEquipmentDashboard profession={profession} userId={userId} />
    </Box>
);

  // Settings Content (mobile optimized)
  const renderSettingsContent = () => (
    <Box sx={{ pb: 10}}>
      <Typography variant="h5" sx={{  mb:  3, fontWeight: 600, color: customBranding.color  }}>
        Innstillinger
      </Typography>
      <UniversalSettingsPanel profession={profession} userId={userId} />
    </Box>
);

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        background: `
          linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, ${customBranding.color} 100%),
          radial-gradient(circle at 20% 80%, ${customBranding.color}30 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, ${customBranding.color}25 0%, transparent 50%)
        `,
        pb: 8 }}
    >
      {/* Mobile App Bar */}
      <AppBar 
        position="sticky" 
        sx={{ 
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px:  2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <img 
              src="/creatorhub-logo-amber.svg"
              alt="CreatorHub Norge Logo"
              style={{ height: '32px', width: 'auto'}}
            />
            <Typography variant="h6" 
              sx={{  
                color: customBranding.color, 
                fontWeight: 60
                fontSize: '1rem'
         }}>
              {config.tabs[activeTab]?.mobileLabel || config.tabs[activeTab]?.label}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap:  1 }}>
            {isAdmin && (
              <AdminIndicator 
                userEmail={userEmail}
                profession={profession}
                variant="mobile"
              />
            )}
            <IconButton
              size="small"
              onClick={() => setShowEmailCenter(true)}
              sx={{ color: customBranding.color }}
            >
              <Badge badgeContent={unreadEmailCount} color="error">
                {theming.getThemedIcon('email')}
              </Badge>
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setShowMobileMenu(true)}
              sx={{ color: customBranding.color }}
            >
              {theming.getThemedIcon('menu')}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Content */}
      <Container maxWidth="sm" sx={{ px: 2, py: 3 }}>
        {renderMobileTabContent()}
      </Container>

      {/* Mobile Bottom Navigation */}
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: `1px solid ${alpha(customBranding.color, 0.2)}`
        }}
        elevation={3}
      >
        <BottomNavigation
          value={activeTab}
          onChange={(event, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiBottomNavigationAction-root': {
              color: 'text.secondary',
              '&.Mui-selected': {
                color: customBranding.color
              }
            }
      }}
        >
          {config.tabs.slice(0, 5).map((tab, index) => (
            <BottomNavigationAction
              key={tab.id}
              label={tab.mobileLabel || tab.label}
              icon={tab.icon}
              sx={{
                fontSize: '0.7rem', '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.7rem'
          }
          }}
            />
          ))}
        </BottomNavigation>
      </Paper>

      {/* Mobile Menu Drawer */}
      <SwipeableDrawer
        anchor="right"
        open={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        onOpen={() => setShowMobileMenu(true)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '80%',
            maxWidth: 300,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <Box sx={{ p:  2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
            <Typography variant="h6" sx={{  color: customBranding.color, fontWeight: 600}}>
              Meny
            </Typography>
            <IconButton onClick={() => setShowMobileMenu(false)}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </Box>

          <List>
            {config.tabs.map((tab, index) => (
              <ListItem
                key={tab.id}
                button
                onClick={() => {
                  setActiveTab(index);
                  setShowMobileMenu(false);
            }}
                selected={activeTab === index}
                sx={{
                  borderRadius:  2,
                  mb: 1'&.Mui-selected': { bgcolor: alpha(customBranding.color, 0.1)'& .MuiListItemIcon-root, & .MuiListItemText-primary': {
                      color: customBranding.color
              }
              }
            }}
              >
                <ListItemIcon sx={{ minWidth: 36}}>
                  {tab.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={tab.label}
                  primaryTypographyProps={{ fontSize: '0.9rem'}}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </SwipeableDrawer>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom:  80,
          right:  16,
          bgcolor: customBranding.color'&:hover': { bgcolor: alpha(customBranding.color, 0.8) },
          zIndex: 999}}
        onClick={() => {
          if (professionSupports('vendor_products')) {
            setShowVendorProductDialog(true);
      } else {
            setShowProjectCreation(true);
      }
    }}
      >
        {theming.getThemedIcon('add')}
      </Fab>

      {/* All Modals and Dialogs */}
      
      {/* Quick Meeting Notes Modal */}
      <QuickMeetingNotesModal 
        open={showQuickNotesModal}
        onClose={() => setShowQuickNotesModal(false)}
        profession={profession}
        userId={userId}
      />

      {/* Project Creation Modal */}
      {showProjectCreation && (
        <Dialog 
          open={showProjectCreation}
          onClose={() => setShowProjectCreation(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Opprett Nytt Prosjekt</DialogTitle>
          <DialogContent>
            <ProjectCreationWithMemoryCards 
              profession={profession}
              userId={userId}
              onProjectCreated={() => setShowProjectCreation(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Vendor Product Dialog */}
      {showVendorProductDialog && (
        <Dialog 
          open={showVendorProductDialog}
          onClose={() => setShowVendorProductDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Legg til Produkt</DialogTitle>
          <DialogContent>
            <VendorProductManager 
              userId={userId}
              onProductCreated={() => setShowVendorProductDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Email Center Modal */}
      {showEmailCenter && (
        <Dialog 
          open={showEmailCenter}
          onClose={() => setShowEmailCenter(false)}
          maxWidth="md"
          fullWidth
          sx={{ '& .MuiDialog-paper': { height: '80vh',} }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>E-post Senter</Typography>
            <IconButton onClick={() => setShowEmailCenter(false)}>
              {theming.getThemedIcon('close')}
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p:  0 }}>
            <IntegratedEmailCenter profession={profession} userId={userId} />
          </DialogContent>
        </Dialog>
      )}

      {/* Project Details Modal */}
      <Dialog 
        open={showProjectDetailsModal}
        onClose={() => setShowProjectDetailsModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <PhotoCamera sx={{ color: customBranding.color }} />
            {selectedProject?.title || selectedProject?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedProject && (
            <Stack spacing={2} sx={{ mt:  1 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Klient</Typography>
                <Typography variant="body1">{selectedProject.clientName || 'Ikke angitt'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip 
                  label={selectedProject.status}
                  color={selectedProject.status === 'Fullført' ? 'success' : selectedProject.status === 'Aktiv' ? 'primary' : 'default'}
                  size="small"
                />
              </Box>
              {selectedProject.eventDate && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Dato</Typography>
                  <Typography variant="body1">
                    {new Date(selectedProject.eventDate).toLocaleDateString('no-NO')}
                  </Typography>
                </Box>
              )}
              {selectedProject.location && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Lokasjon</Typography>
                  <Typography variant="body1">{selectedProject.location}</Typography>
                </Box>
              )}
              {selectedProject.description && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Beskrivelse</Typography>
                  <Typography variant="body1">{selectedProject.description}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProjectDetailsModal(false)}>
            Lukk
          </Button>
          <Button variant="contained"
            startIcon={theming.getThemedIcon('edit')}
            onClick={() => {
              setShowProjectDetailsModal(false);
              handleEditProject(selectedProject);
        }}
            sx={{ backgroundColor: customBranding.color }}
          >
            Rediger
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
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
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

      {/* Delete Project Confirmation */}
      <Dialog 
        open={showDeleteProjectDialog}
        onClose={() => setShowDeleteProjectDialog(false)}
        maxWidth="sm"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Delete sx={{ color: '#f44336'}} />
            <Typography variant="h6" sx={{  color: theming.colors.primary }}>
              Slett Prosjekt
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb:  2 }}>
            Er du sikker på at du vil slette prosjektet?
          </Typography>
          {selectedProject && (
            <Box sx={{ 
              p: 2, bgcolor: 'rgba(24, 67, 54, 0.1)', 
              borderRadius:  2,
              border: '1px solid rgba(24, 67, 54, 0.3)'
        }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600}>
                📸 {selectedProject.title || selectedProject.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Klient: {selectedProject.clientName ||'Ikke angitt'}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 600}>
            ⚠️ Dette kan ikke angres!
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteProjectDialog(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            color="error"
            startIcon={theming.getThemedIcon('delete')}
            onClick={confirmDeleteProject}
           sx={theming.getThemedButtonSx()}>
            Slett Prosjekt
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAQ Dialog */}
      <TutorialFAQIntegration 
        open={showFAQDialog}
        onClose={() => setShowFAQDialog(false)}
        profession={profession}
      />
    </Box>
);
}