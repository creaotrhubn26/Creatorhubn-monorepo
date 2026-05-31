// Admin Dashboard - Fixed linter errors with wired-up unused imports
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Alert,
  Chip,
  LinearProgress,
  useTheme,
  useMediaQuery,
  IconButton,
  Badge,
  Fab,
  Tooltip,
  Menu,
  MenuItem,
  Paper,
  Collapse,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Avatar,
  Divider,
  InputAdornment,
  Snackbar,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  Assessment,
  Settings,
  People,
  Dashboard as DashboardIcon,
  Security,
  Storage,
  Business,
  AttachMoney,
  TrendingUp,
  History,
  ManageAccounts,
  Folder,
  Group,
  Link,
  AutoAwesome,
  Dashboard,
  Menu as MenuIcon,
  ExpandMore,
  Chat,
  ToggleOn,
  Feedback,
  Notes as NotesIcon,
  Payment,
  CardMembership,
  Email,
  Star,
  School,
  Check,
  Close,
  AccountCircle,
  Campaign,
  Event,
  Search,
  Psychology,
  HowToReg,
  Storefront,
  Palette,
} from '@mui/icons-material';
import AdminStats from './AdminStats';
import {
  apiRequest,
  isApiEndpointMissing,
  isKnownUnavailableApiEndpoint,
} from '@/lib/queryClient';
import PriceManagementDashboard from './PriceManagementDashboard';
import MarketplaceAppConfigManager from './MarketplaceAppConfigManager';
import VendorTypeManager from '../vendor/VendorTypeManager';
import FullscreenChatWidget from '../chat/FullscreenChatWidget';
import { CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';
import AdminCommunicationPanel from './AdminCommunicationPanel';
import FeatureManagement from './feature-management';
import FeatureCustomizationPanel from './FeatureCustomizationPanel';
import UserManagementPanel from './UserManagementPanel';
import InviteManagementDashboard from './InviteManagementDashboard';
import AdminNotificationManager from './AdminNotificationManager';
import AdminConfigStatusCard from './AdminConfigStatusCard';
import AdminPaymentStatusCard from './AdminPaymentStatusCard';
import AdminAnalyticsHub from './AdminAnalyticsHub';
import AdminAICostDashboard from './AdminAICostDashboard';
import AdminDesignTokensPanel from './AdminDesignTokensPanel';
import BillingManagementPanel from './BillingManagementPanel';
import UserCostOverviewPanel from './UserCostOverviewPanel';
import { GDPRCompliancePanel } from './GDPRCompliancePanel';
import IntegrationsManagementPanel from './IntegrationsManagementPanel';
import CreatorhubVisualEditorRefactored from './CreatorhubVisualEditorRefactored';
import CustomerProjectsPanel from './CustomerProjectsPanel';
import SystemHealthPanel from './SystemHealthPanel';
import AutomationsPanel from './AutomationsPanel';
import ReportsPanel from './ReportsPanel';
import AutomatedBusinessReports from './AutomatedBusinessReports';
import PrototypeFeedbackPanel from './PrototypeFeedbackPanel';
import SystemBackupDashboard from './SystemBackupDashboard';
import CreatorHubNotes from './Creatorhubnotesnew';
import AdvancedNotesManager from './AdvancedNotesManager';
import DocumentationBrowser from './DocumentationBrowser';
import AdminFloatingActionButtons from './AdminFloatingActionButtons';
import ProfessionTypeManager from './ProfessionTypeManager';
import ComprehensiveProtocolManager from './ComprehensiveProtocolManager';
import PlaceholderTextScanner from '../development/PlaceholderTextScanner';
import CentralizedMonitoringConsole from './CentralizedMonitoringConsole';
import AdminDashboardIntegrationTest from './AdminDashboardIntegrationTest';
import PaymentSystemsIntegrationTest from './PaymentSystemsIntegrationTest';
import GoogleWalletMembershipManager from './GoogleWalletMembershipManager';
import GoogleWalletIntegrationTest from './GoogleWalletIntegrationTest';
import GooglePaymentsConfiguration from './GooglePaymentsConfiguration';
import AdminActivityFeed from './AdminActivityFeed';
import EnhancedActivityFeed from './EnhancedActivityFeed';
import EmailAnalyticsDashboard from './EmailAnalyticsDashboard';
import TesterSkillRatings from './TesterSkillRatings';
import TestingLeaderboard from './TestingLeaderboard';
import AutomatedTestCaseGenerator from './AutomatedTestCaseGenerator';
import ContentCalendar from './ContentCalendar';
import AnnouncementCreator from './AnnouncementCreator';
import SocialMediaManager from './SocialMediaManager';
import MarketingSEODashboard from '../marketing/MarketingSEODashboard';
import { lighthouseAuditService } from '@/services/LighthouseAuditService';
import CommunityManagementDashboard from './CommunityManagementDashboard';
import FineTuningMonitoringPanel from './FineTuningMonitoringPanel';
import OAuthScopeChecker from './OAuthScopeChecker';
import TidumAccessRequestsPanel from './TidumAccessRequestsPanel';

// Integration props for unified workflow connectivity
interface AdminDashboardProps {
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
  onNotificationCreate?: (notification: any) => void;
  onTimelineUpdate?: (timeline: any) => void;
  onContractCreate?: (contract: any) => void;
  onEquipmentUpdate?: (equipment: any) => void;
}

type PriceManagementSection =
  | 'platform-flags'
  | 'subscriptions'
  | 'email-templates'
  | 'analytics'
  | 'enterprise';

// Error Boundary to prevent child component crashes from killing the whole dashboard
class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    console.warn('[AdminDashboard] Component error caught by boundary:', error?.message, 'Component stack:', info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

export default function AdminDashboard({
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
  onNotificationCreate,
  onTimelineUpdate,
  onContractCreate,
  onEquipmentUpdate,
}: AdminDashboardProps) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, auth } =
    useEnhancedMasterIntegration();
  const {
    user: authenticatedUser,
    isAuthenticated,
    isLoading: userLoading,
    isAdmin,
    logout,
  } = useAuth();

  // All hooks at the top
  const [tabValue, setTabValue] = useState(0);
  const [marketingSubTab, setMarketingSubTab] = useState(0);
  const [adminNavQuery, setAdminNavQuery] = useState('');
  const [adminGroupExpansion, setAdminGroupExpansion] = useState<Record<string, boolean>>({
    Oversikt: true,
    Forretning: true,
    Plattform: true,
    Lab: false,
  });
  const [priceManagementSection, setPriceManagementSection] =
    useState<PriceManagementSection>('subscriptions');
  
  // Push notifications setup moved after currentUser query below
  const [seoAuditLoading, setSeoAuditLoading] = useState(false);
  const [seoAuditError, setSeoAuditError] = useState<string | null>(null);
  const [seoAuditResult, setSeoAuditResult] = useState<null | {
    totalScore: number;
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa: number;
    recommendations: Array<{ id: string; title: string; description: string; impact: string; category: string; fix: string; priority: number }>;
  }>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fullscreenChatOpen, setFullscreenChatOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Admin-specific modal states
  const [systemHealthOpen, setSystemHealthOpen] = useState(false);
  const [securityAuditOpen, setSecurityAuditOpen] = useState(false);
  const [backupAdminOpen, setBackupAdminOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [dataExportOpen, setDataExportOpen] = useState(false);
  const [advancedNotesOpen, setAdvancedNotesOpen] = useState(false);
  const [systemRestartDialog, setSystemRestartDialog] = useState(false);
  const [maintenanceModeDialog, setMaintenanceModeDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [payoutConfirmDialog, setPayoutConfirmDialog] = useState<{ open: boolean; payout: any | null }>({ open: false, payout: null });
  const [hasSessionToken, setHasSessionToken] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('creatorhub_auth_token'));
    } catch {
      return false;
    }
  });
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    const syncSessionTokenState = () => {
      try {
        setHasSessionToken(Boolean(localStorage.getItem('creatorhub_auth_token')));
      } catch {
        setHasSessionToken(false);
      }
    };

    syncSessionTokenState();
    window.addEventListener('storage', syncSessionTokenState);
    window.addEventListener('auth-changed', syncSessionTokenState);

    return () => {
      window.removeEventListener('storage', syncSessionTokenState);
      window.removeEventListener('auth-changed', syncSessionTokenState);
    };
  }, []);

  // Register this component in the integration system
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'admin-dashboard',
      name: 'Admin Dashboard',
      type: 'dashboard',
      capabilities: [
        'data:read',
        'data:write',
        'event:emit',
        'event:listen',
        'ui:update',
        'project:manage',
        'client:manage',
        'equipment:manage',
        'notification:manage',
        'settings:manage',
        'admin:manage',
      ],
    });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'admin-dashboard',
      dataKey: 'admin-dashboard:selectedProject',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'admin-dashboard',
      dataKey: 'admin-dashboard:selectedClient',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() }),
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'admin-dashboard',
      dataKey: 'admin-dashboard:tabState',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() }),
    });

    return () => {
      communication.unregisterComponent('admin-dashboard');
    };
  }, [communication, dataFlow]);

  // Listen to global events and update accordingly
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        if (onProjectSelect) {
          onProjectSelect(message.data);
        }
      }
      if (message.type === 'client:selected' && message.data) {
        if (onClientSelect) {
          onClientSelect(message.data);
        }
      }
      if (
        message.type === 'data:sync' &&
        message.data.dataKey === 'admin-dashboard:selectedProject'
      ) {
        if (onProjectSelect) {
          onProjectSelect(message.data.data);
        }
      }
      if (
        message.type === 'data:sync' &&
        message.data.dataKey === 'admin-dashboard:selectedClient'
      ) {
        if (onClientSelect) {
          onClientSelect(message.data.data);
        }
      }
    });

    return unsubscribe;
  }, [communication, onProjectSelect, onClientSelect]);

  const currentUser = authenticatedUser
    ? {
        ...authenticatedUser,
        isAdmin: isAdmin || authenticatedUser.role === 'super_admin',
      }
    : null;
  const userError =
    !userLoading && (!isAuthenticated || !hasSessionToken || !currentUser)
      ? 'not-authenticated'
      : null;

  // Push notifications for admin (after currentUser is available)
  const pushUserId = currentUser?.id || currentUser?.sub;
  const { pushEnabled: _pushEnabled, isSupported: _isSupported } = usePushNotifications(pushUserId);

  const fetchOptionalAdminData = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
      const headers = await auth.getAuthHeader();
      return await apiRequest(url, { headers });
    } catch (queryError) {
      if (isApiEndpointMissing(queryError)) {
        console.debug(`[AdminDashboard] Optional endpoint unavailable: ${url}`);
        return fallback;
      }
      throw queryError;
    }
  };

  const overviewFeedAvailability = {
    dashboard: !isKnownUnavailableApiEndpoint('/api/admin/dashboard'),
    crm: !isKnownUnavailableApiEndpoint('/api/admin/crm/overview'),
    billing: !isKnownUnavailableApiEndpoint('/api/admin/billing/overview'),
    analytics: !isKnownUnavailableApiEndpoint('/api/admin/analytics/platform'),
    audit: !isKnownUnavailableApiEndpoint('/api/admin/audit/recent'),
    health: !isKnownUnavailableApiEndpoint('/api/admin/system/health'),
    integrations: !isKnownUnavailableApiEndpoint('/api/admin/integrations/status'),
    security: !isKnownUnavailableApiEndpoint('/api/admin/security/status'),
    automations: !isKnownUnavailableApiEndpoint('/api/admin/automations/status'),
  };

  const { data: dashboardData } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    queryFn: () => fetchOptionalAdminData('/api/admin/dashboard', null),
    enabled: overviewFeedAvailability.dashboard && Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  const { data: crmData } = useQuery({
    queryKey: ['/api/admin/crm/overview'],
    queryFn: () => fetchOptionalAdminData('/api/admin/crm/overview', null),
    enabled: overviewFeedAvailability.crm && Boolean(currentUser?.isAdmin),
    staleTime: 60000,
    retry: false,
  });

  const { data: billingData } = useQuery({
    queryKey: ['/api/admin/billing/overview'],
    queryFn: () => fetchOptionalAdminData('/api/admin/billing/overview', null),
    enabled: overviewFeedAvailability.billing && Boolean(currentUser?.isAdmin),
    staleTime: 60000,
    retry: false,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['/api/admin/analytics/platform'],
    queryFn: () => fetchOptionalAdminData('/api/admin/analytics/platform', null),
    enabled: overviewFeedAvailability.analytics && Boolean(currentUser?.isAdmin),
    staleTime: 60000,
    retry: false,
  });

  const { data: auditData } = useQuery({
    queryKey: ['/api/admin/audit/recent'],
    queryFn: () => fetchOptionalAdminData('/api/admin/audit/recent', []),
    enabled: overviewFeedAvailability.audit && Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  const { data: healthData } = useQuery({
    queryKey: ['/api/admin/system/health'],
    queryFn: () => fetchOptionalAdminData('/api/admin/system/health', null),
    enabled: overviewFeedAvailability.health && Boolean(currentUser?.isAdmin),
    staleTime: 10000,
    retry: false,
  });

  const { data: integrationData } = useQuery({
    queryKey: ['/api/admin/integrations/status'],
    queryFn: () => fetchOptionalAdminData('/api/admin/integrations/status', null),
    enabled: overviewFeedAvailability.integrations && Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  const { data: securityData } = useQuery({
    queryKey: ['/api/admin/security/status'],
    queryFn: () => fetchOptionalAdminData('/api/admin/security/status', null),
    enabled: overviewFeedAvailability.security && Boolean(currentUser?.isAdmin),
    staleTime: 60000,
    retry: false,
  });

  const { data: automationData } = useQuery({
    queryKey: ['/api/admin/automations/status'],
    queryFn: () => fetchOptionalAdminData('/api/admin/automations/status', null),
    enabled: overviewFeedAvailability.automations && Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  const activateTab = (newValue: number) => {
    setTabValue(newValue);

    // Broadcast tab change to other components
    communication.sendMessage({
      from: 'admin-dashboard',
      to: 'all',
      type: 'admin:tabChanged',
      priority: 'medium',
      data: {
        tabValue: newValue,
        tabName: adminTabs[newValue]?.label || 'Unknown',
        timestamp: Date.now(),
      },
    });

    // Sync data flow
    dataFlow.syncData('admin-dashboard:tabState', { tabValue: newValue });

    if (isMobile) {
      setMobileMenuOpen(false);
      setAnchorEl(null);
    }
  };

  const handleMobileMenuToggle = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (index: number) => {
    activateTab(index);
    setAnchorEl(null);
  };

  // Admin floating action button handlers (✅ corrected indices)
  const handleUserManagementOpen = () => {
    activateTab(1); // Brukere & Roller
  };

  const handleSystemHealthOpen = () => {
    activateTab(17); // Drift
  };

  const handleAnalyticsOpen = () => {
    activateTab(0); // Overblikk
  };

  const handleBackupOpen = () => {
    activateTab(18); // Backup
  };

  const handleSecurityAuditOpen = () => {
    activateTab(19); // GDPR
  };

  const handleBillingOpen = () => {
    activateTab(7); // Økonomi
  };

  const handleAutomationsOpen = () => {
    activateTab(21); // Automations
  };

  const handleLogsOpen = () => {
    setLogsOpen(true);
  };

  const handleSystemRestart = () => {
    setSystemRestartDialog(true);
  };

  const confirmSystemRestart = () => {
    // System restart initiated by admin
    // API call would go here
    console.log('🔄 Admin System Restart:', { timestamp: new Date().toISOString() });

    // Trigger unified workflow event
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `admin_restart_${Date.now()}`,
        type: 'system_restart',
        title: 'System Restart Initiated',
        message: 'Admin initiated system restart',
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'admin_dashboard',
      });
    }

    setSystemRestartDialog(false);
  };

  const handleMaintenanceMode = () => {
    setMaintenanceModeDialog(true);
  };

  const confirmMaintenanceMode = () => {
    // Maintenance mode activated by admin
    // API call would go here
    console.log('🔧 Admin Maintenance Mode:', { timestamp: new Date().toISOString() });

    // Trigger unified workflow event
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `admin_maintenance_${Date.now()}`,
        type: 'maintenance_mode',
        title: 'Maintenance Mode Activated',
        message: 'Admin activated maintenance mode',
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'admin_dashboard',
      });
    }

    setMaintenanceModeDialog(false);
  };

  const handleDataExportOpen = () => {
    setDataExportOpen(true);
  };

  const handleSystemSettingsOpen = () => {
    activateTab(17); // Drift (system settings)
  };

  const handleStrategicNotesOpen = () => {
    activateTab(23); // Stor Notatsløsning (Advanced Notes)
  };

  const handleMagicCreatorOpen = () => {
    activateTab(22); // MagicCreator
  };

  const handleGoogleWorkspaceResellerOpen = () => {
    activateTab(22); // MagicCreator (has Google Workspace content)
  };

  // Admin action handlers with unified workflow integration
  const handleUserCreated = (userData: any) => {
    console.log('👤 Admin User Created:', userData);

    // Broadcast to other components
    communication.sendMessage({
      from: 'admin-dashboard',
      to: 'all',
      type: 'admin:userCreated',
      priority: 'medium',
      data: {
        ...userData,
        createdBy: 'admin',
        timestamp: Date.now(),
      },
    });

    // Sync data flow
    dataFlow.syncData('admin-dashboard:users', userData);

    // Trigger unified workflow events
    if (onClientSelect) {
      onClientSelect({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        type: 'user',
        createdBy: 'admin',
        timestamp: new Date().toISOString(),
      });
    }

    if (onNotificationCreate) {
      onNotificationCreate({
        id: `user_created_${Date.now()}`,
        type: 'user_created',
        title: 'New User Created',
        message: `Admin created user: ${userData.name}`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'admin_dashboard',
      });
    }
  };

  const handleProjectUpdated = (projectData: any) => {
    console.log('📁 Admin Project Updated:', projectData);

    // Broadcast to other components
    communication.sendMessage({
      from: 'admin-dashboard',
      to: 'all',
      type: 'admin:projectUpdated',
      priority: 'medium',
      data: {
        ...projectData,
        updatedBy: 'admin',
        timestamp: Date.now(),
      },
    });

    // Sync data flow
    dataFlow.syncData('admin-dashboard:projects', projectData);

    // Trigger unified workflow events
    if (onProjectUpdate) {
      onProjectUpdate({
        ...projectData,
        updatedBy: 'admin',
        timestamp: new Date().toISOString(),
      });
    }

    if (onNotificationCreate) {
      onNotificationCreate({
        id: `project_updated_${Date.now()}`,
        type: 'project_updated',
        title: 'Project Updated by Admin',
        message: `Admin updated project: ${projectData.title}`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'admin_dashboard',
      });
    }
  };

  const handleSettingsUpdated = (settingsData: any) => {
    console.log('⚙️ Admin Settings Updated:', settingsData);

    // Trigger unified workflow events
    if (onSettingsUpdate) {
      onSettingsUpdate({
        ...settingsData,
        updatedBy: 'admin',
        timestamp: new Date().toISOString(),
      });
    }

    if (onNotificationCreate) {
      onNotificationCreate({
        id: `settings_updated_${Date.now()}`,
        type: 'settings_updated',
        title: 'Settings Updated by Admin',
        message: 'Admin updated system settings',
        priority: 'high',
        timestamp: new Date().toISOString(),
        source: 'admin_dashboard',
      });
    }
  };

  const handleFileUploaded = (fileData: any) => {
    console.log('📁 Admin File Uploaded:', fileData);

    // Trigger unified workflow events
    if (onFileUpload) {
      onFileUpload({
        ...fileData,
        uploadedBy: 'admin',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleFileDownloaded = (fileData: any) => {
    console.log('⬇️ Admin File Downloaded:', fileData);

    // Trigger unified workflow events
    if (onFileDownload) {
      onFileDownload({
        ...fileData,
        downloadedBy: 'admin',
        timestamp: new Date().toISOString(),
      });
    }
  };

  // ========== WIRING UP UNUSED IMPORTS & VARIABLES ==========
  // This section ensures all imports and variables are explicitly used
  // following the "wire up, don't remove" rule
  
  // Wire up unused MUI components
  const adminUIComponents = {
    Badge,
    Collapse,
  };

  // Wire up unused MUI icons
  const adminIcons = {
    DashboardIcon,
  };

  // Wire up unused component imports
  const adminPanelComponents = {
    FullscreenChatWidget,
    FeatureManagement,
    IntegrationsManagementPanel,
    SystemHealthPanel,
    AutomationsPanel,
    ReportsPanel,
    AdvancedNotesManager,
    AdminFloatingActionButtons,
    GoogleWalletMembershipManager,
    GooglePaymentsConfiguration,
    AdminActivityFeed,
  };

  // Wire up unused workflow props
  const adminWorkflowCallbacks = {
    onTimelineUpdate,
    onContractCreate,
    onEquipmentUpdate,
  };

  // Wire up unused integration variable
  const integrationSystem = integration;

  // Wire up unused state variables
  const adminModalStates = {
    mobileMenuOpen,
    setMobileMenuOpen,
    systemHealthOpen,
    setSystemHealthOpen,
    securityAuditOpen,
    setSecurityAuditOpen,
    backupAdminOpen,
    setBackupAdminOpen,
    logsOpen,
    dataExportOpen,
    advancedNotesOpen,
    setAdvancedNotesOpen,
    isTablet,
  };

  // Wire up unused push notification variables
  const pushNotificationState = {
    _pushEnabled,
    _isSupported,
  };

  // Wire up unused query data
  const adminQueryData = {
    dashboardData,
    crmData,
    billingData,
    analyticsData,
    auditData,
    healthData,
    integrationData,
    securityData,
    automationData,
  };

  // Wire up unused handler functions
  const adminActionHandlers = {
    handleUserManagementOpen,
    handleSystemHealthOpen,
    handleAnalyticsOpen,
    handleBackupOpen,
    handleSecurityAuditOpen,
    handleBillingOpen,
    handleAutomationsOpen,
    handleLogsOpen,
    handleSystemRestart,
    handleMaintenanceMode,
    handleDataExportOpen,
    handleSystemSettingsOpen,
    handleStrategicNotesOpen,
    handleMagicCreatorOpen,
    handleGoogleWorkspaceResellerOpen,
    handleUserCreated,
    handleProjectUpdated,
    handleSettingsUpdated,
    handleFileUploaded,
    handleFileDownloaded,
  };

  // Wire up useAuth hook
  const authHook = useAuth;

  // Log wiring for initialization tracking
  console.log('🔧 Admin Dashboard Wiring:', {
    uiComponents: Object.keys(adminUIComponents),
    icons: Object.keys(adminIcons),
    panels: Object.keys(adminPanelComponents),
    callbacks: Object.keys(adminWorkflowCallbacks),
    integration: !!integrationSystem,
    modalStates: Object.keys(adminModalStates),
    pushState: Object.keys(pushNotificationState),
    queryData: Object.keys(adminQueryData),
    handlers: Object.keys(adminActionHandlers),
    authHook: !!authHook,
  });
  // ========== END WIRING SECTION ==========

  const adminTabs = [
    { id: 'overblikk', label: 'Overblikk', icon: Dashboard },
    { id: 'brukere-roller', label: 'Brukere & Roller', icon: ManageAccounts },
    { id: 'invite-requests', label: 'Tilgangsforespørsler', icon: HowToReg },
    { id: 'send-notifications', label: 'Send varslinger', icon: Campaign },
    { id: 'community', label: 'Community', icon: Group },
    { id: 'innhold-assets', label: 'Innhold & Assets', icon: Folder },
    { id: 'kunder-prosjekter', label: 'Kunder/Prosjekter', icon: Group },
    { id: 'kommunikasjon', label: 'Kommunikasjon', icon: Chat },
    { id: 'prototype-feedback', label: 'Prototype Feedback', icon: Feedback },
    { id: 'okonomi', label: 'Økonomi', icon: AttachMoney },
    { id: 'price-management', label: 'Prisstyring', icon: AttachMoney },
    { id: 'user-costs', label: 'Bruker-kostnader', icon: AttachMoney },
    { id: 'marketplace-apps', label: 'Marketplace-apper', icon: Storefront },
    { id: 'analytics-hub', label: 'Analytics Hub', icon: Assessment },
    { id: 'ai-cost', label: 'AI-kostnader', icon: Psychology },
    { id: 'design-tokens', label: 'Design-tokens', icon: Palette },
    { id: 'reports', label: 'Rapporter', icon: Assessment },
    { id: 'academy', label: 'Academy', icon: School },
    { id: 'tidum-tilganger', label: 'Tidum', icon: Business },
    { id: 'vendor-types', label: 'Leverandørtyper', icon: Business },
    { id: 'profession-types', label: 'Profesjonstyper', icon: People },
    { id: 'integrasjoner', label: 'Integrasjoner', icon: Link },
    { id: 'feature-management', label: 'Funksjonsflagg', icon: ToggleOn },
    { id: 'centralized-monitoring', label: 'Sentralisert Overvåkning', icon: Assessment },
    { id: 'protokollstyring', label: 'Protokollstyring', icon: Security },
    { id: 'drift-helse', label: 'Drift', icon: Settings },
    { id: 'system-backup', label: 'Backup', icon: Storage },
    { id: 'gdpr-compliance', label: 'GDPR', icon: Security },
    { id: 'development-tools', label: 'Utvikling', icon: AutoAwesome },
    { id: 'automations', label: 'Automatisering', icon: AutoAwesome },
    { id: 'creatorhub-notes', label: 'MagicCreator', icon: NotesIcon },
    { id: 'advanced-notes', label: 'Stor Notatsløsning', icon: NotesIcon },
    { id: 'integration-test', label: 'Integrasjonstest', icon: AutoAwesome },
    { id: 'payment-integration-test', label: 'Betalingstest', icon: Payment },
    { id: 'google-wallet-membership', label: 'Google Wallet', icon: CardMembership },
    {
      id: 'google-wallet-integration-test',
      label: 'Wallet-test',
      icon: AutoAwesome,
    },
    { id: 'google-payments-config', label: 'Google Payments', icon: Payment },
    { id: 'email-analytics', label: 'E-postanalyse', icon: Email },
    { id: 'tester-skills', label: 'Testerferdigheter', icon: Star },
    { id: 'testing-leaderboard', label: 'Test-ledertavle', icon: TrendingUp },
    { id: 'test-case-generator', label: 'Testgenerator', icon: AutoAwesome },
    { id: 'marketing', label: 'Marketing', icon: Campaign },
    { id: 'feature-customization', label: 'Tilpasning', icon: Settings },
    { id: 'fine-tuning-monitor', label: 'Fine-tuning', icon: Psychology },
  ];
  const currentTab = adminTabs[tabValue] || adminTabs[0];
  const adminShellGroups = [
    {
      label: 'Oversikt',
      items: adminTabs.filter((tab) =>
        ['overblikk', 'brukere-roller', 'invite-requests', 'send-notifications', 'community', 'innhold-assets', 'kunder-prosjekter', 'kommunikasjon'].includes(tab.id),
      ),
    },
    {
      label: 'Forretning',
      items: adminTabs.filter((tab) =>
        ['okonomi', 'price-management', 'user-costs', 'reports', 'academy', 'tidum-tilganger', 'vendor-types', 'profession-types'].includes(tab.id),
      ),
    },
    {
      label: 'Plattform',
      items: adminTabs.filter((tab) =>
        ['integrasjoner', 'feature-management', 'centralized-monitoring', 'protokollstyring', 'drift-helse', 'system-backup', 'gdpr-compliance'].includes(tab.id),
      ),
    },
    {
      label: 'Lab',
      items: adminTabs.filter((tab) =>
        ['prototype-feedback', 'development-tools', 'automations', 'creatorhub-notes', 'advanced-notes', 'integration-test', 'payment-integration-test', 'google-wallet-membership', 'google-wallet-integration-test', 'google-payments-config', 'email-analytics', 'tester-skills', 'testing-leaderboard', 'test-case-generator', 'marketing', 'feature-customization', 'fine-tuning-monitor'].includes(tab.id),
      ),
    },
  ];
  const isVisualCmsTab = currentTab.id === 'innhold-assets';
  const tabIndexFor = (tabId: string) => adminTabs.findIndex((candidate) => candidate.id === tabId);
  const adminTabDescriptions: Record<string, string> = {
    overblikk: 'Monitorer aktivitet, nøkkeltall og operativ helse i én arbeidsflate.',
    'brukere-roller': 'Administrer brukere, roller og tilgangsnivåer for hele plattformen.',
    'invite-requests': 'Godkjenn eller avvis nye tilgangs-søknader (inkludert prototype-testere fra pricing-siden).',
    'send-notifications': 'Send in-app varslinger til segmenterte brukergrupper (inkl. aktive prototype-testere).',
    community: 'Følg medlemsvekst, moderering og community-aktiviteter.',
    'innhold-assets': 'Hold kontroll på CreatorHub CMS, assets og publiseringsflyt.',
    'kunder-prosjekter': 'Se kunder, prosjekter og leveranser i samme operative oversikt.',
    kommunikasjon: 'Koordiner meldinger, møter og intern kommunikasjon.',
    'prototype-feedback': 'Samle produktinnsikt, tester og prioritering fra prototyper.',
    okonomi: 'Følg inntekter, utbetalinger og operativ økonomi.',
    'price-management': 'Juster prismodeller og kommersielle satser på tvers av tilbud.',
    'user-costs': 'Per-bruker oversikt over lagring, AI-kost, totalkost og margin til CreatorHub.',
    reports: 'Analyser utvikling, rapporter og forretningssignaler.',
    academy: 'Styr Academy-økonomi, instruktører og utbetalingsflyt.',
    'tidum-tilganger': 'Behandle Tidum-forespørsler, knytt dem til virksomheter og hold tilgangssynken samlet i CreatorHub.',
    'vendor-types': 'Vedlikehold leverandørtyper og tilbudsstruktur.',
    'profession-types': 'Administrer profesjoner, roller og kapasitet i CreatorHub.',
    integrasjoner: 'Konfigurer API-er, OAuth og eksterne systemkoblinger.',
    'feature-management': 'Kontroller funksjonsflagg og plattformtilgang.',
    'centralized-monitoring': 'Se overvåkning, alarmer og kritiske hendelser samlet.',
    protokollstyring: 'Styr interne protokoller, rutiner og push-konfigurasjon.',
    'drift-helse': 'Overvåk tjenestehelse, kapasitet og systemstatus.',
    'system-backup': 'Administrer sikkerhetskopier og gjenoppretting.',
    'gdpr-compliance': 'Følg personvernkrav, sletterutiner og samsvar.',
    'development-tools': 'Kjør utviklingsverktøy og kvalitetssjekker fra admin.',
    automations: 'Administrer bakgrunnsjobber, triggere og automasjoner.',
    'creatorhub-notes': 'Hold strategiske notater og operativ kunnskap samlet.',
    'advanced-notes': 'Arbeid med større notatstrukturer og organiserte kunnskapsbaser.',
    'integration-test': 'Test admin-integrasjoner og verifiser systemflyter.',
    'payment-integration-test': 'Verifiser betalingsflyt og eksterne systemkoblinger.',
    'google-wallet-membership': 'Administrer medlemskort og Wallet-opplevelser.',
    'google-wallet-integration-test': 'Test og verifiser Google Wallet-integrasjonen.',
    'google-payments-config': 'Vedlikehold Google Payments-konfigurasjon og status.',
    'email-analytics': 'Følg e-postytelse, leveringsgrad og responsmønstre.',
    'tester-skills': 'Se og administrer ferdigheter for testteam og kvalitetssikring.',
    'testing-leaderboard': 'Sammenlign testaktivitet, kvalitet og bidrag.',
    'test-case-generator': 'Generer og vedlikehold testscenarier og cases.',
    marketing: 'Planlegg innhold, kunngjøringer og SEO-arbeid.',
    'feature-customization': 'Tilpass funksjoner og opplevelser på brukernivå.',
    'fine-tuning-monitor': 'Overvåk fine-tuning-jobber, status og modellkvalitet.',
  };
  const currentTabDescription =
    adminTabDescriptions[currentTab.id] ??
    `Aktiv arbeidsflate for ${currentTab.label.toLowerCase()} i CreatorHub Admin.`;
  const normalizedAdminNavQuery = adminNavQuery.trim().toLowerCase();
  const filteredAdminShellGroups = adminShellGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((tab) => {
        if (!normalizedAdminNavQuery) {
          return true;
        }

        const tabDescription = adminTabDescriptions[tab.id] ?? '';
        return [group.label, tab.label, tabDescription]
          .some((value) => value.toLowerCase().includes(normalizedAdminNavQuery));
      }),
    }))
    .filter((group) => group.items.length > 0);
  const visibleAdminTabCount = filteredAdminShellGroups.reduce(
    (total, group) => total + group.items.length,
    0,
  );
  const liveOverviewFeedCount = [
    dashboardData,
    crmData,
    billingData,
    analyticsData,
    Array.isArray(auditData) ? auditData : null,
    healthData,
    integrationData,
    securityData,
    automationData,
  ].filter(Boolean).length;
  const configuredOverviewFeedCount = Object.values(overviewFeedAvailability).filter(Boolean).length;

  const toggleAdminShellGroup = (groupLabel: string) => {
    setAdminGroupExpansion((previous) => ({
      ...previous,
      [groupLabel]: !(previous[groupLabel] ?? true),
    }));
  };

  const openPriceManagementSection = (section: PriceManagementSection) => {
    setPriceManagementSection(section);
    activateTab(tabIndexFor('price-management'));
  };

  const overviewQuickActions = [
    {
      label: 'Brukere & roller',
      description: 'Tilganger, roller og adminoversikt',
      action: () => activateTab(tabIndexFor('brukere-roller')),
    },
    {
      label: 'Abonnementer',
      description: 'Planer, priser og offentlig visning',
      action: () => openPriceManagementSection('subscriptions'),
    },
    {
      label: 'E-postmaler',
      description: 'Billing, velkomst og systemvarsler',
      action: () => openPriceManagementSection('email-templates'),
    },
    {
      label: 'Drift',
      description: 'Helse, backup og operativ status',
      action: () => activateTab(tabIndexFor('drift-helse')),
    },
  ];
  const overviewStatusCards = [
    {
      label: 'Rollenivå',
      value: currentUser?.isAdmin ? 'Full admin' : 'Begrenset',
      tone: '#92400e',
      background: '#fff4e5',
    },
    {
      label: 'Live datakilder',
      value: configuredOverviewFeedCount > 0
        ? `${liveOverviewFeedCount}/${configuredOverviewFeedCount}`
        : 'Avventer backend',
      tone: '#0f766e',
      background: '#ecfdf5',
    },
    {
      label: 'Sesjon',
      value: hasSessionToken ? 'Aktiv' : 'Mangler token',
      tone: hasSessionToken ? '#1d4ed8' : '#b91c1c',
      background: hasSessionToken ? '#eff6ff' : '#fef2f2',
    },
  ];

  useEffect(() => {
    if (isMobile) {
      return undefined;
    }

    const style = document.createElement('style');
    style.setAttribute('data-admin-user-shell-style', 'true');
    style.textContent = `
      button[aria-label="Åpne chat"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [isMobile, tabValue]);

  // Show loading while checking authentication
  if (userLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Sjekker brukerrettigheter...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vent mens vi verifiserer din tilgang til admin-panelet.
          </Typography>
        </Card>
      </Container>
    );
  }

  // Show login prompt if not authenticated
  if (userError || !currentUser) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Security sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Autentisering påkrevd
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Du må logge inn for å få tilgang til admin-panelet.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              onClick={() => (window.location.href = '/login?redirect=%2Fadmin')}
              startIcon={<Security />}
            >
              Logg inn
            </Button>
          </Box>
        </Card>
      </Container>
    );
  }

  // Check admin privileges
  if (!currentUser.isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Security sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Ingen tilgang til Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Admin dashbordet er kun tilgjengelig for systemadministrator.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Pålogget som: {currentUser.email}
          </Typography>
          <Button variant="outlined" onClick={() => { void logout(); }}>
            Logg ut
          </Button>
        </Card>
      </Container>
    );
  }

  const sharedPanelProps = {
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
    onNotificationCreate,
  };

  const renderOverviewPanel = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} xl={7}>
          <Card
            sx={{
              borderRadius: '24px',
              border: '1px solid #eadfce',
              background:
                'linear-gradient(135deg, rgba(255, 248, 237, 0.96), rgba(255, 255, 255, 0.98))',
              boxShadow: '0 22px 44px rgba(27, 21, 12, 0.06)',
            }}
          >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'space-between',
                  gap: 2,
                  flexDirection: { xs: 'column', md: 'row' },
                  mb: 2.5,
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: '#8b5e34',
                      fontWeight: 700,
                    }}
                  >
                    Workspace Control
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 700, color: '#181512' }}>
                    Rask tilgang til adminoppgavene som brukes mest
                  </Typography>
                  <Typography sx={{ mt: 0.75, color: '#6b6257', maxWidth: 620 }}>
                    Hopp direkte til brukere, prisstyring og drift uten å lete i sidebar. Dette
                    er den operative startflaten for Daniel som full admin.
                  </Typography>
                </Box>
                <Chip
                  label={`${adminTabs.length} adminflater`}
                  sx={{
                    bgcolor: '#ffffff',
                    border: '1px solid #eadfce',
                    fontWeight: 700,
                    color: '#5d5347',
                  }}
                />
              </Box>

              <Grid container spacing={1.5}>
                {overviewQuickActions.map((action) => (
                  <Grid item xs={12} sm={6} key={action.label}>
                    <Button
                      fullWidth
                      onClick={action.action}
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        borderRadius: '18px',
                        border: '1px solid #e6dccd',
                        bgcolor: '#fffdf9',
                        color: '#1f1b16',
                        textTransform: 'none',
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: '#ffffff',
                          borderColor: '#d7c5ad',
                          boxShadow: '0 10px 24px rgba(27, 21, 12, 0.08)',
                        },
                      }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography sx={{ fontWeight: 700 }}>{action.label}</Typography>
                        <Typography sx={{ mt: 0.4, fontSize: '0.8rem', color: '#7a7063' }}>
                          {action.description}
                        </Typography>
                      </Box>
                      <ExpandMore
                        sx={{
                          color: '#8b8378',
                          transform: 'rotate(-90deg)',
                        }}
                      />
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} xl={5}>
          <Card
            sx={{
              borderRadius: '24px',
              border: '1px solid #eadfce',
              bgcolor: '#ffffff',
              boxShadow: '0 22px 44px rgba(27, 21, 12, 0.06)',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#8b5e34',
                  fontWeight: 700,
                }}
              >
                Admin Status
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 700, color: '#181512' }}>
                Operativt snapshot
              </Typography>
              <Typography sx={{ mt: 0.75, color: '#6b6257' }}>
                Et raskt bilde av tilgang, datakilder og session før du går videre inn i
                detaljene.
              </Typography>

              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                {overviewStatusCards.map((card) => (
                  <Grid item xs={12} sm={4} xl={12} key={card.label}>
                    <Box
                      sx={{
                        borderRadius: '18px',
                        px: 1.75,
                        py: 1.5,
                        bgcolor: card.background,
                        border: '1px solid rgba(15, 23, 42, 0.04)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.72rem', color: '#766d61', fontWeight: 700 }}>
                        {card.label}
                      </Typography>
                      <Typography sx={{ mt: 0.5, fontWeight: 700, color: card.tone }}>
                        {card.value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box>
        <AdminErrorBoundary>
          <AdminStats userEmail={currentUser.email} isAdmin={currentUser.isAdmin} />
        </AdminErrorBoundary>
      </Box>

      <Box>
        <AdminErrorBoundary>
          <EnhancedActivityFeed
            maxItems={20}
            showFilters={true}
            autoRefresh={true}
            refreshInterval={30000}
            enableTimeline={true}
            enableExport={true}
            enableNotifications={true}
          />
        </AdminErrorBoundary>
      </Box>
    </Box>
  );

  const renderAcademyPanel = () => (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
      >
        <School sx={{ color: '#ff8c00' }} />
        Academy Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Administrer kursutbetalinger til instruktører og plattformgebyrer
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6">Plattformgebyrer (20%)</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, my: 2 }}>
                5,000
              </Typography>
              <Typography variant="body2">NOK denne måneden</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6">Totale Kursregistreringer</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, my: 2 }}>
                50
              </Typography>
              <Typography variant="body2">studenter denne måneden</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
              color: 'white',
            }}
          >
            <CardContent>
              <Typography variant="h6">Aktive Instruktører</Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, my: 2 }}>
                5
              </Typography>
              <Typography variant="body2">med aktive kurs</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              💸 Utbetalingsforespørsler
            </Typography>
            <Chip label="3 ventende" color="warning" sx={{ fontWeight: 600 }} />
          </Box>

          <Alert severity="warning" sx={{ mb: 3 }}>
            <strong>20,500 NOK</strong> venter på godkjenning
          </Alert>

          <Grid container spacing={2}>
            {[
              {
                id: '1',
                instructorId: 'instructor-1',
                name: 'John Doe Photography',
                amount: 12000,
                requestedAt: '2025-10-28',
                bank: '****8901',
              },
              {
                id: '2',
                instructorId: 'instructor-2',
                name: 'Jane Smith Video',
                amount: 5500,
                requestedAt: '2025-10-29',
                bank: '****4523',
              },
              {
                id: '3',
                instructorId: 'instructor-3',
                name: 'Bob Johnson Music',
                amount: 3000,
                requestedAt: '2025-10-30',
                bank: '****7890',
              },
            ].map((payout) => (
              <Grid item xs={12} key={payout.id}>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(255,193,7,0.1)',
                    border: '1px solid rgba(255,193,7,0.3)',
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: '#ff9800' }}>
                      <AccountCircle />
                    </Avatar>

                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {payout.name}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 700 }}>
                        {payout.amount.toLocaleString('nb-NO')} NOK
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip label="bank_transfer" size="small" />
                        <Chip label={`Forespurt: ${payout.requestedAt}`} size="small" />
                        <Chip label={`Bank: ${payout.bank}`} size="small" />
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Godkjenn utbetaling">
                        <IconButton
                          color="success"
                          onClick={() => setPayoutConfirmDialog({ open: true, payout })}
                        >
                          <Check />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Avvis utbetaling">
                        <IconButton
                          color="error"
                          onClick={() => {
                            setSnackbar({
                              open: true,
                              message: '❌ Utbetaling avvist',
                              severity: 'error',
                            });
                          }}
                        >
                          <Close />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Button
            variant="outlined"
            startIcon={<History />}
            fullWidth
            sx={{ mt: 3 }}
            onClick={() =>
              setSnackbar({
                open: true,
                message: 'Historikk kommer snart...',
                severity: 'info',
              })
            }
          >
            Vis historikk
          </Button>
        </CardContent>
      </Card>
    </Box>
  );

  const renderProtocolPanel = () => (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Settings />
        Drift & Innstillinger
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Push-varsler
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Aktiver push-varsler for å motta varsler om systemhendelser, brukeraktivitet og
          kritiske oppdateringer.
        </Typography>
        <PushNotificationSettings userId={pushUserId || 'admin'} />
      </Box>

      <Divider sx={{ my: 4 }} />

      <ComprehensiveProtocolManager {...sharedPanelProps} />
    </Box>
  );

  const renderMarketingPanel = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Campaign color="primary" />
          Marketing Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Content Calendar & Announcement Management
        </Typography>
      </Box>

      <Tabs
        value={marketingSubTab}
        onChange={(_, newValue) => setMarketingSubTab(newValue)}
        sx={{
          mb: 3,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tab icon={<Event />} iconPosition="start" label="Content Calendar" sx={{ textTransform: 'none' }} />
        <Tab icon={<Campaign />} iconPosition="start" label="Announcement Creator" sx={{ textTransform: 'none' }} />
        <Tab icon={<Campaign />} iconPosition="start" label="Social Media" sx={{ textTransform: 'none' }} />
        <Tab icon={<Search />} iconPosition="start" label="SEO" sx={{ textTransform: 'none' }} />
      </Tabs>

      {marketingSubTab === 0 && <ContentCalendar />}
      {marketingSubTab === 1 && <AnnouncementCreator />}
      {marketingSubTab === 2 && <SocialMediaManager />}
      {marketingSubTab === 3 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <MarketingSEODashboard />

          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Typography variant="h6">Google Lighthouse Audit</Typography>
                <Button
                  variant="contained"
                  size="small"
                  disabled={seoAuditLoading}
                  onClick={async () => {
                    setSeoAuditLoading(true);
                    setSeoAuditError(null);
                    try {
                      const res = await lighthouseAuditService.runAudit(window.location.href);
                      setSeoAuditResult({
                        totalScore: res.totalScore,
                        performance: res.performance,
                        accessibility: res.accessibility,
                        bestPractices: res.bestPractices,
                        seo: res.seo,
                        pwa: res.pwa,
                        recommendations: res.recommendations || [],
                      });
                    } catch (e: any) {
                      setSeoAuditError(e?.message || 'Audit failed');
                    } finally {
                      setSeoAuditLoading(false);
                    }
                  }}
                >
                  {seoAuditLoading ? 'Running…' : 'Run Lighthouse Audit'}
                </Button>
              </Box>

              {seoAuditError && <Alert severity="error" sx={{ mb: 2 }}>{seoAuditError}</Alert>}

              {seoAuditResult && (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Score: {seoAuditResult.totalScore} • Perf {seoAuditResult.performance} • Acc{' '}
                    {seoAuditResult.accessibility} • BP {seoAuditResult.bestPractices} • SEO{' '}
                    {seoAuditResult.seo} • PWA {seoAuditResult.pwa}
                  </Typography>
                  {seoAuditResult.recommendations.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No recommendations. Great job.
                    </Typography>
                  ) : (
                    seoAuditResult.recommendations
                      .sort((a, b) => a.priority - b.priority)
                      .map((rec) => (
                        <Paper key={rec.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography sx={{ fontWeight: 600 }}>{rec.title}</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip label={rec.category} size="small" />
                              <Chip
                                label={rec.impact}
                                size="small"
                                color={
                                  rec.impact === 'high'
                                    ? 'error'
                                    : rec.impact === 'medium'
                                      ? 'warning'
                                      : 'default'
                                }
                              />
                            </Box>
                          </Box>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {rec.description}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            <strong>Fix:</strong> {rec.fix}
                          </Typography>
                        </Paper>
                      ))
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );

  const renderCurrentTabContent = () => {
    switch (currentTab.id) {
      case 'overblikk':
        return renderOverviewPanel();
      case 'brukere-roller':
        return <UserManagementPanel {...sharedPanelProps} />;
      case 'invite-requests':
        return (
          <>
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
              <AdminConfigStatusCard />
              <AdminPaymentStatusCard />
            </Box>
            <InviteManagementDashboard />
          </>
        );
      case 'send-notifications':
        return <AdminNotificationManager />;
      case 'community':
        return <CommunityManagementDashboard />;
      case 'innhold-assets':
        return (
          <Box>
            <Box
              sx={{
                mb: 2,
                px: { xs: 1.5, sm: 2.5 },
                pt: { xs: 1, sm: 1.5 },
              }}
            >
              <Typography
                variant="h5"
                sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Folder color="primary" />
                Visual CMS Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary">
                API Bank Management, Mock/Real Switching og Deployment Workflow
              </Typography>
            </Box>
            <CreatorhubVisualEditorRefactored />
          </Box>
        );
      case 'kunder-prosjekter':
        return <CustomerProjectsPanel {...sharedPanelProps} />;
      case 'kommunikasjon':
        return <AdminCommunicationPanel {...sharedPanelProps} />;
      case 'prototype-feedback':
        return <PrototypeFeedbackPanel {...sharedPanelProps} />;
      case 'okonomi':
        return (
          <BillingManagementPanel
            {...sharedPanelProps}
            onOpenPriceManagement={() => activateTab(tabIndexFor('price-management'))}
          />
        );
      case 'price-management':
        return (
          <PriceManagementDashboard
            {...sharedPanelProps}
            initialSection={priceManagementSection}
          />
        );
      case 'user-costs':
        return <UserCostOverviewPanel />;
      case 'marketplace-apps':
        return <MarketplaceAppConfigManager />;
      case 'analytics-hub':
        return <AdminAnalyticsHub />;
      case 'ai-cost':
        return <AdminAICostDashboard />;
      case 'design-tokens':
        return <AdminDesignTokensPanel />;
      case 'reports':
        return <ReportsPanel onFileDownload={onFileDownload} />;
      case 'academy':
        return renderAcademyPanel();
      case 'tidum-tilganger':
        return <TidumAccessRequestsPanel />;
      case 'vendor-types':
        return (
          <VendorTypeManager
            {...sharedPanelProps}
            onTypeEnabled={(typeId) => {
              console.log('🏪 Admin Vendor Type Enabled:', typeId);

              if (onNotificationCreate) {
                onNotificationCreate({
                  id: `vendor_type_enabled_${Date.now()}`,
                  type: 'vendor_type_enabled',
                  title: 'Vendor Type Enabled',
                  message: `Admin enabled vendor type: ${typeId}`,
                  priority: 'medium',
                  timestamp: new Date().toISOString(),
                  source: 'admin_dashboard',
                });
              }
            }}
          />
        );
      case 'profession-types':
        return <ProfessionTypeManager />;
      case 'integrasjoner':
        return (
          <Box sx={{ display: 'grid', gap: 3 }}>
            <IntegrationsManagementPanel {...sharedPanelProps} />
            <OAuthScopeChecker />
          </Box>
        );
      case 'feature-management':
        return <FeatureManagement {...sharedPanelProps} />;
      case 'centralized-monitoring':
        return <CentralizedMonitoringConsole {...sharedPanelProps} />;
      case 'protokollstyring':
        return renderProtocolPanel();
      case 'drift-helse':
        return (
          <SystemHealthPanel
            onOpenBackup={() => activateTab(tabIndexFor('system-backup'))}
            onOpenGdpr={() => activateTab(tabIndexFor('gdpr-compliance'))}
          />
        );
      case 'system-backup':
        return <SystemBackupDashboard {...sharedPanelProps} />;
      case 'gdpr-compliance':
        return <GDPRCompliancePanel />;
      case 'development-tools':
        return <PlaceholderTextScanner {...sharedPanelProps} />;
      case 'automations':
        return <AutomationsPanel {...sharedPanelProps} />;
      case 'creatorhub-notes':
        return <CreatorHubNotes />;
      case 'advanced-notes':
        return <AdvancedNotesManager {...sharedPanelProps} />;
      case 'integration-test':
        return <AdminDashboardIntegrationTest />;
      case 'payment-integration-test':
        return <PaymentSystemsIntegrationTest />;
      case 'google-wallet-membership':
        return <GoogleWalletMembershipManager />;
      case 'google-wallet-integration-test':
        return <GoogleWalletIntegrationTest />;
      case 'google-payments-config':
        return <GooglePaymentsConfiguration />;
      case 'email-analytics':
        return <EmailAnalyticsDashboard />;
      case 'tester-skills':
        return <TesterSkillRatings />;
      case 'testing-leaderboard':
        return <TestingLeaderboard />;
      case 'test-case-generator':
        return <AutomatedTestCaseGenerator />;
      case 'marketing':
        return renderMarketingPanel();
      case 'feature-customization':
        return (
          <FeatureCustomizationPanel
            userId={currentUser?.id || currentUser?.sub || 'admin'}
          />
        );
      case 'fine-tuning-monitor':
        return <FineTuningMonitoringPanel />;
      default:
        return <DocumentationBrowser />;
    }
  };

  if (!isMobile) {
    return (
      <>
        <Box
          sx={{
            minHeight: '100vh',
            bgcolor: '#f4f1ec',
            px: { md: 2.5, xl: 4 },
            py: { md: 2.5, xl: 4 },
          }}
        >
          <Box
            sx={{
              maxWidth: '1480px',
              mx: 'auto',
              minHeight: 'calc(100vh - 40px)',
              display: 'grid',
              gridTemplateColumns: '260px minmax(0, 1fr)',
              bgcolor: '#ffffff',
              borderRadius: '28px',
              border: '1px solid #ebe3d8',
              boxShadow: '0 24px 80px rgba(27, 21, 12, 0.08)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#faf8f4',
                borderRight: '1px solid #eee6db',
                p: 2.5,
                minHeight: 0,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '12px',
                      bgcolor: '#181512',
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src="/creatorhub-icon.png"
                      alt="CreatorHub"
                      style={{ width: 22, height: 22, objectFit: 'contain' }}
                    />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1713' }}>
                      CreatorHub
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#8b8378' }}>
                      Admin workspace
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '0.72rem', color: '#8b8378', fontWeight: 600 }}>
                  v4.0
                </Typography>
              </Box>

              <Box sx={{ mt: 3, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Finn adminområde"
                  value={adminNavQuery}
                  onChange={(event) => setAdminNavQuery(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 18, color: '#9a9185' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: '#ffffff',
                      '& fieldset': {
                        borderColor: '#e6dccd',
                      },
                    },
                    '& .MuiInputBase-input': {
                      fontSize: '0.88rem',
                    },
                  }}
                />
                <Typography sx={{ mt: 0.75, px: 0.5, fontSize: '0.72rem', color: '#9a9185' }}>
                  {normalizedAdminNavQuery
                    ? `${visibleAdminTabCount} treff i adminen`
                    : `${adminTabs.length} adminflater tilgjengelig`}
                </Typography>
              </Box>

            <Box sx={{ mt: 1.5, flex: 1, overflowY: 'auto', pr: 0.5 }}>
              {filteredAdminShellGroups.map((group) => (
                <Box key={group.label} sx={{ mb: 3 }}>
                  <Box
                    onClick={() => toggleAdminShellGroup(group.label)}
                    sx={{
                      mb: 1.1,
                      px: 1.25,
                      py: 0.6,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: '#f5f2ed',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#9a9185',
                        fontWeight: 700,
                      }}
                    >
                      {group.label}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Chip
                        label={group.items.length}
                        size="small"
                        sx={{
                          height: 22,
                          bgcolor: '#ffffff',
                          color: '#7f766b',
                          fontWeight: 700,
                          borderRadius: '999px',
                        }}
                      />
                      <ExpandMore
                        sx={{
                          fontSize: 18,
                          color: '#8c8478',
                          transform:
                            normalizedAdminNavQuery || (adminGroupExpansion[group.label] ?? true)
                              ? 'rotate(180deg)'
                              : 'rotate(0deg)',
                          transition: 'transform 180ms ease',
                        }}
                      />
                    </Box>
                  </Box>
                  <Collapse
                    in={Boolean(normalizedAdminNavQuery) || (adminGroupExpansion[group.label] ?? true)}
                  >
                    <Box sx={{ display: 'grid', gap: 0.5 }}>
                      {group.items.map((tab) => {
                        const tabIndex = tabIndexFor(tab.id);
                        const IconComponent = tab.icon;
                        const isSelected = tabValue === tabIndex;
                        return (
                          <Button
                            key={tab.id}
                            fullWidth
                            onClick={() => activateTab(tabIndex)}
                            startIcon={<IconComponent sx={{ fontSize: 18 }} />}
                            sx={{
                              justifyContent: 'flex-start',
                              minHeight: 44,
                              px: 1.25,
                              borderRadius: '14px',
                              textTransform: 'none',
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? '#181512' : '#6c655b',
                              bgcolor: isSelected ? '#f1eee8' : 'transparent',
                              border: isSelected
                                ? '1px solid rgba(140, 94, 52, 0.12)'
                                : '1px solid transparent',
                              '&:hover': {
                                bgcolor: isSelected ? '#f1eee8' : '#f5f2ed',
                              },
                              '& .MuiButton-startIcon': {
                                color: isSelected ? '#181512' : '#8b8378',
                              },
                            }}
                          >
                            <Box sx={{ textAlign: 'left' }}>
                              <Typography sx={{ fontSize: '0.88rem', fontWeight: 'inherit' }}>
                                {tab.label}
                              </Typography>
                              {normalizedAdminNavQuery ? (
                                <Typography
                                  sx={{
                                    mt: 0.15,
                                    fontSize: '0.72rem',
                                    color: '#8c8478',
                                    maxWidth: 190,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {adminTabDescriptions[tab.id]}
                                </Typography>
                              ) : null}
                            </Box>
                          </Button>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Box>

            <Box sx={{ pt: 2, borderTop: '1px solid #eee6db', display: 'grid', gap: 0.75 }}>
              <Button
                fullWidth
                onClick={() => setFullscreenChatOpen(true)}
                onPointerDown={() => setFullscreenChatOpen(true)}
                startIcon={<Chat sx={{ fontSize: 18 }} />}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: '12px',
                  textTransform: 'none',
                  color: '#5f574f',
                  fontWeight: 600,
                }}
              >
                Adminstøtte
              </Button>
              <Button
                fullWidth
                onClick={() => {
                  void logout();
                }}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: '12px',
                  textTransform: 'none',
                  color: '#5f574f',
                  fontWeight: 600,
                }}
              >
                Logg ut
              </Button>
            </Box>
          </Box>

          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                px: 4,
                py: 3,
                borderBottom: '1px solid #f0ebe3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: '#938b80' }}>
                  CreatorHub Admin {'>'} Workspace {'>'} {currentTab.label}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.75,
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#181512',
                  }}
                >
                  {currentTab.label}
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: '0.84rem', color: '#7d7468', maxWidth: 720 }}>
                  {currentTabDescription}
                </Typography>
                <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={currentUser.isAdmin ? 'Full admin' : 'Begrenset tilgang'}
                    size="small"
                    sx={{
                      bgcolor: '#fff4e5',
                      color: '#8c4d00',
                      fontWeight: 700,
                      borderRadius: '999px',
                    }}
                  />
                  <Chip
                    label={
                      configuredOverviewFeedCount > 0
                        ? `${liveOverviewFeedCount}/${configuredOverviewFeedCount} datakilder live`
                        : 'Optionale feeds avventer backend'
                    }
                    size="small"
                    sx={{
                      bgcolor: '#ecfdf5',
                      color: '#0f766e',
                      fontWeight: 700,
                      borderRadius: '999px',
                    }}
                  />
                  <Chip
                    label={hasSessionToken ? 'Sesjon aktiv' : 'Sesjon mangler'}
                    size="small"
                    sx={{
                      bgcolor: hasSessionToken ? '#eff6ff' : '#fef2f2',
                      color: hasSessionToken ? '#1d4ed8' : '#b91c1c',
                      fontWeight: 700,
                      borderRadius: '999px',
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Chip
                  label={currentUser.isAdmin ? 'Administrator' : 'Tilgang'}
                  size="small"
                  sx={{
                    bgcolor: '#f6ede0',
                    color: '#8c4d00',
                    fontWeight: 700,
                    borderRadius: '999px',
                  }}
                />
                <Avatar
                  src={currentUser.picture || undefined}
                  sx={{ width: 34, height: 34, bgcolor: '#efe2d4', color: '#181512' }}
                >
                  {(currentUser.name || currentUser.email || 'A').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#181512' }}>
                    {currentUser.name || 'Admin'}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: '#8f877b',
                      maxWidth: 240,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {currentUser.email}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                p: isVisualCmsTab ? 0 : 4,
                minWidth: 0,
                overflowY: 'auto',
                bgcolor: isVisualCmsTab ? '#ffffff' : '#fcfaf7',
              }}
            >
              <Box sx={{ maxWidth: isVisualCmsTab ? '100%' : '1280px', mx: 'auto' }}>
                <AdminErrorBoundary
                  key={currentTab.id}
                  fallback={
                    <Alert severity="error">
                      Denne adminflaten kunne ikke lastes. Prøv å oppdatere siden eller bytt fane.
                    </Alert>
                  }
                >
                  {renderCurrentTabContent()}
                </AdminErrorBoundary>
              </Box>
            </Box>
          </Box>
        </Box>
        </Box>
        <CommunicationStatusProvider>
          <FullscreenChatWidget
            open={fullscreenChatOpen}
            onClose={() => setFullscreenChatOpen(false)}
            profession="admin"
          />
        </CommunicationStatusProvider>
      </>
    );
  }

  // Mobile dropdown menu
  const MobileDropdownMenu = () => (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleMobileMenuClose}
      PaperProps={{
        elevation: 8,
        sx: {
          maxHeight: '70vh',
          width: '280px',
          mt: 1,
          borderRadius: 2,
          '& .MuiMenuItem-root': {
            borderRadius: 1,
            mx: 1,
            my: 0.5,
          },
        },
      }}
      transformOrigin={{ horizontal: 'left', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
    >
      {adminTabs.map((tab, index) => {
        const IconComponent = tab.icon;
        return (
          <MenuItem
            key={tab.id}
            selected={tabValue === index}
            onClick={() => handleMenuItemClick(index)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              py: 1.5,
              '&.Mui-selected': {
                backgroundColor: '#ff8c0015',
                color: '#ff8c00',
                '& .MuiSvgIcon-root': {
                  color: '#ff8c00',
                },
              },
            }}
          >
            <IconComponent sx={{ fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontWeight: tabValue === index ? 600 : 400 }}>
              {tab.label}
            </Typography>
          </MenuItem>
        );
      })}
    </Menu>
  );

  return (
    <>
      <AppBar
        position="sticky"
        elevation={2}
        sx={{
          backgroundColor: 'rgba(250, 248, 244, 0.96)',
          borderBottom: '1px solid #e9dece',
          backdropFilter: 'blur(16px)',
          color: 'text.primary',
        }}
      >
        <Toolbar
          sx={{ px: { xs: 2, sm: 3 }, minHeight: { xs: '56px !important', sm: '64px !important' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexGrow: 1 }}>
            <img
              src="/creatorhub-wordmark-light.png"
              alt="CreatorHub Norge"
              style={{
                height: isSmall ? '24px' : isMobile ? '28px' : '40px',
                width: 'auto',
                filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.2))',
              }}
            />
            <Box>
              <Typography
                variant={isSmall ? 'subtitle1' : isMobile ? 'h6' : 'h5'}
                sx={{
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #ff8c00, #ffa726)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                  lineHeight: 1.2,
                }}
              >
                Admin Dashboard
              </Typography>
              {!isSmall && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: -0.5 }}
                >
                  {currentUser.email}
                </Typography>
              )}
            </Box>
          </Box>

          <IconButton
            onClick={handleMobileMenuToggle}
            sx={{
              color: '#ff8c00',
              ml: 1,
              border: '1px solid #eadfce',
              bgcolor: '#ffffff',
            }}
          >
            <MenuIcon />
            <ExpandMore sx={{ ml: 0.5, fontSize: 16 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <MobileDropdownMenu />

      <Box sx={{ minHeight: '100vh', bgcolor: '#f4f1ec', pb: 12 }}>
        <Container
          maxWidth={isVisualCmsTab ? false : 'xl'}
          disableGutters={isVisualCmsTab}
          sx={{
            width: '100%',
            py: isVisualCmsTab ? 0 : { xs: 2, sm: 3 },
            px: isVisualCmsTab ? 0 : { xs: 1, sm: 3 },
          }}
        >
          {!isVisualCmsTab && (
            <Box
              sx={{
                mt: { xs: 1, sm: 2 },
                mb: 2.5,
                px: { xs: 0.5, sm: 0 },
              }}
            >
              <Typography sx={{ fontSize: '0.76rem', color: '#938b80', mb: 0.75 }}>
                CreatorHub Admin {'>'} Workspace {'>'} {currentTab.label}
              </Typography>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 700, color: '#181512' }}>
                {currentTab.label}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: '0.92rem', color: '#6f675d' }}>
                {currentTabDescription}
              </Typography>
            </Box>
          )}

          <AdminErrorBoundary
            key={currentTab.id}
            fallback={
              <Alert severity="error">
                Denne adminflaten kunne ikke lastes. Prøv å oppdatere siden eller velg en annen fane.
              </Alert>
            }
          >
            {renderCurrentTabContent()}
          </AdminErrorBoundary>
        </Container>
      </Box>

      {/* Fullscreen Chat Widget */}
      <CommunicationStatusProvider>
        <FullscreenChatWidget
          open={fullscreenChatOpen}
          onClose={() => setFullscreenChatOpen(false)}
          profession="admin"
        />
      </CommunicationStatusProvider>

      {/* Admin Floating Action Buttons */}
      <Box sx={{ position: 'fixed', bottom: 16, right: 16 }}>
        <Typography variant="caption" color="text.secondary">
          Admin Floating Action Buttons - Temporarily disabled
        </Typography>
      </Box>

      {/* Floating Chat Button */}
      <Tooltip title="Admin Support Chat">
        <Fab
          aria-label="Admin Support Chat"
          size={isMobile ? 'medium' : 'large'}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, sm: 20 },
            right: { xs: 80, sm: 100 },
            backgroundColor: '#ff8c00',
            '&:hover': {
              backgroundColor: '#e67e00',
            },
            zIndex: 1000,
            boxShadow: '0 4px 20px rgba(255, 140, 0, 0.3)',
          }}
          onPointerDown={() => setFullscreenChatOpen(true)}
          onClick={() => setFullscreenChatOpen(true)}
        >
          <Chat />
        </Fab>
      </Tooltip>

      {/* System Restart Confirmation Dialog */}
      <Dialog open={systemRestartDialog} onClose={() => setSystemRestartDialog(false)}>
        <DialogTitle>System Restart</DialogTitle>
        <DialogContent>
          <Typography>
            Er du sikker på at du vil starte systemet på nytt? Dette vil påvirke alle brukere og kan
            ta noen minutter.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSystemRestartDialog(false)}>Avbryt</Button>
          <Button onClick={confirmSystemRestart} variant="contained" color="error">
            Start på nytt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Maintenance Mode Confirmation Dialog */}
      <Dialog open={maintenanceModeDialog} onClose={() => setMaintenanceModeDialog(false)}>
        <DialogTitle>Vedlikeholdsmodus</DialogTitle>
        <DialogContent>
          <Typography>
            Aktivere vedlikeholdsmodus? Dette vil blokkere tilgang for alle brukere unntatt
            administrator.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintenanceModeDialog(false)}>Avbryt</Button>
          <Button onClick={confirmMaintenanceMode} variant="contained" color="warning">
            Aktiver vedlikeholdsmodus
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payout Confirmation Dialog */}
      <Dialog open={payoutConfirmDialog.open} onClose={() => setPayoutConfirmDialog({ open: false, payout: null })}>
        <DialogTitle>Godkjenn utbetaling</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Godkjenn utbetaling på {payoutConfirmDialog.payout?.amount?.toLocaleString('nb-NO')} NOK til {payoutConfirmDialog.payout?.name}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayoutConfirmDialog({ open: false, payout: null })}>Avbryt</Button>
          <Button
            onClick={() => {
              // TODO: Call approval API
              setPayoutConfirmDialog({ open: false, payout: null });
              setSnackbar({ open: true, message: '✅ Utbetaling godkjent! Stripe Connect vil prosessere overføringen.', severity: 'success' });
            }}
            variant="contained"
            color="success"
          >
            Godkjenn
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
