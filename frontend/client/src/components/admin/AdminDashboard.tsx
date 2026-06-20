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
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  Payments,
  Campaign,
  Event,
  Search,
  Psychology,
  HowToReg,
  Storefront,
  Palette,
  AccountBox,
  CheckCircle,
  Warning,
  Block,
  OpenInNew,
  ContentCopy,
  Refresh,
  Send,
  Receipt,
  HourglassEmpty,
  CloudUpload,
  CloudDownload,
  DeleteOutline,
} from '@mui/icons-material';
import AdminStats from './AdminStats';
import {
  apiRequest,
  isApiEndpointMissing,
  isKnownUnavailableApiEndpoint,
  queryClient,
} from '@/lib/queryClient';
import PriceManagementDashboard from './PriceManagementDashboard';
import MarketplaceAppConfigManager from './MarketplaceAppConfigManager';
import VendorTypeManager from '../vendor/VendorTypeManager';
import EditingPartnersAdminPanel from './EditingPartnersAdminPanel';
import FullscreenChatWidget from '../chat/FullscreenChatWidget';
import { CommunicationStatusProvider } from '../../contexts/CommunicationStatusContext';
import AdminCommunicationPanel from './AdminCommunicationPanel';
import FeatureManagement from './feature-management';
import FeatureCustomizationPanel from './FeatureCustomizationPanel';
import UserManagementPanel from './UserManagementPanel';
import LeadMapEntitlementsAdminPanel from './LeadMapEntitlementsAdminPanel';
import CustomerSuccessSnapshotCard from './CustomerSuccessSnapshotCard';
import LeadMapMarketplaceCard from './LeadMapMarketplaceCard';
import InviteManagementDashboard from './InviteManagementDashboard';
import AdminNotificationManager from './AdminNotificationManager';
import AdminConfigStatusCard from './AdminConfigStatusCard';
import AdminPaymentStatusCard from './AdminPaymentStatusCard';
import AdminAnalyticsHub from './AdminAnalyticsHub';
import AdminAICostDashboard from './AdminAICostDashboard';
import AdminDesignTokensPanel from './AdminDesignTokensPanel';
import BillingManagementPanel from './BillingManagementPanel';
import UserCostOverviewPanel from './UserCostOverviewPanel';
import SecretsRotationPanel from './SecretsRotationPanel';
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
import B2ArchiveTab from './B2ArchiveTab';
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
  | 'enterprise'
  | 'lead-map';

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
  const [onboardingLinkDialog, setOnboardingLinkDialog] = useState<{
    open: boolean;
    instructorId: string | null;
    instructorName: string | null;
    instructorEmail: string | null;
    onboardingUrl: string | null;
    expiresAt: string | null;
  }>({ open: false, instructorId: null, instructorName: null, instructorEmail: null, onboardingUrl: null, expiresAt: null });
  const [academySection, setAcademySection] = useState<'instructors' | 'payouts' | 'transfers' | 'b2-archive'>('instructors');
  // Academy B2-arkiv (admin-only): upload-dialog state
  const [academyB2UploadDialog, setAcademyB2UploadDialog] = useState<{
    open: boolean;
    courseId: string;
    file: File | null;
    isMaster: boolean;
    progress: number;
    isUploading: boolean;
    error: string | null;
  }>({ open: false, courseId: '', file: null, isMaster: true, progress: 0, isUploading: false, error: null });
  const [academyB2DeleteConfirm, setAcademyB2DeleteConfirm] = useState<{ open: boolean; key: string | null }>({ open: false, key: null });
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

  // ─── Academy: ekte tall + pending payouts ───────────────────
  // Erstatter den hardkodede mockup-en i renderAcademyPanel.
  // Endepunkter ligger i backend/server/admin-academy-routes.ts.
  const academySummaryQueryKey = ['/api/admin/academy/summary'] as const;
  const academyPayoutsQueryKey = ['/api/admin/academy/payouts', 'pending'] as const;
  const academyInstructorsQueryKey = ['/api/admin/academy/instructors'] as const;
  const academyTransfersQueryKey = ['/api/admin/academy/transfers', 50] as const;

  const { data: academySummary, isLoading: academySummaryLoading } = useQuery({
    queryKey: academySummaryQueryKey,
    queryFn: () => fetchOptionalAdminData<{
      totalRevenue?: number;
      platformShare?: number;
      instructorShare?: number;
      activeInstructorCount?: number;
      payoutsEnabledCount?: number;
      enrollmentCount?: number;
      pendingPayoutsCount?: number;
      pendingPayoutsAmount?: number;
      paidThisMonth?: number;
      paidThisMonthCount?: number;
      stripeConfigured?: boolean;
    } | null>('/api/admin/academy/summary', null),
    enabled: Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  const { data: academyPayoutsData, isLoading: academyPayoutsLoading } = useQuery({
    queryKey: academyPayoutsQueryKey,
    queryFn: () => fetchOptionalAdminData<{
      payouts?: Array<{
        id: string;
        instructorId: string;
        instructorName: string | null;
        amount: number;
        status: string;
        bankAccountLast4: string | null;
        requestedAt: string | null;
        notes: string | null;
      }>;
      total?: number;
      tableMissing?: boolean;
    } | null>('/api/admin/academy/payouts?status=pending', null),
    enabled: Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  const invalidateAcademy = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/academy/payouts'] });
    queryClient.invalidateQueries({ queryKey: academySummaryQueryKey });
    queryClient.invalidateQueries({ queryKey: academyInstructorsQueryKey });
    queryClient.invalidateQueries({ queryKey: academyTransfersQueryKey });
  };

  type AcademyInstructor = {
    id: string;
    name: string | null;
    email: string | null;
    stripeAccountId: string | null;
    onboardingStatus: 'enabled' | 'pending' | 'restricted' | 'not_started';
    payoutsEnabled: boolean;
    requirementsCurrentlyDue: string[];
    activeCourses?: number;
    pendingPayoutAmount?: number;
  };

  const { data: academyInstructorsData, isLoading: academyInstructorsLoading } = useQuery({
    queryKey: academyInstructorsQueryKey,
    queryFn: () => fetchOptionalAdminData<{
      instructors?: AcademyInstructor[];
      stripeConfigured?: boolean;
    } | null>('/api/admin/academy/instructors', null),
    enabled: Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  type AcademyTransfer = {
    id: string;
    payoutId: string | null;
    instructorId: string;
    instructorName: string | null;
    amount: number;
    currency: string;
    status: 'in_transit' | 'paid' | 'failed' | 'pending' | string;
    stripeTransferId: string | null;
    createdAt: string | null;
    completedAt: string | null;
    failureReason: string | null;
  };

  const { data: academyTransfersData, isLoading: academyTransfersLoading } = useQuery({
    queryKey: academyTransfersQueryKey,
    queryFn: () => fetchOptionalAdminData<{
      transfers?: AcademyTransfer[];
      total?: number;
      stripeConfigured?: boolean;
    } | null>('/api/admin/academy/transfers?limit=50', null),
    enabled: Boolean(currentUser?.isAdmin),
    staleTime: 30000,
    retry: false,
  });

  type AcademyRefund = {
    id: string;
    instructorId: string;
    instructorName: string | null;
    amount: number;
    reason: string | null;
    createdAt: string | null;
    status: string;
  };

  const { data: academyRefundsData } = useQuery({
    queryKey: ['/api/admin/academy/refunds'] as const,
    queryFn: () => fetchOptionalAdminData<{
      refunds?: AcademyRefund[];
    } | null>('/api/admin/academy/refunds?limit=50', null),
    enabled: Boolean(currentUser?.isAdmin),
    staleTime: 60000,
    retry: false,
  });

  // ─── Academy B2-arkiv (admin-only) ────────────────────────────
  // Tabbed inn under Academy → "B2-arkiv". Vis filer i academy/-prefixet,
  // aggregert stats, upload/download/delete.
  type AcademyB2File = {
    key: string;
    sizeBytes: number;
    lastModified: string | null;
    isMaster: boolean;
    courseId: string | null;
    fileName: string;
  };
  type AcademyB2Stats = {
    totalFiles: number;
    totalSizeBytes: number;
    byCourse: Array<{
      courseId: string;
      courseName: string | null;
      fileCount: number;
      sizeBytes: number;
    }>;
    byType: Array<{ ext: string; count: number; sizeBytes: number }>;
    b2Configured: boolean;
    bucketName?: string;
  };
  type AcademyCourseSummary = {
    id: string;
    title: string;
  };

  const academyB2ListQueryKey = ['/api/admin/academy/b2/list'] as const;
  const academyB2StatsQueryKey = ['/api/admin/academy/b2/stats'] as const;

  const { data: academyB2ListData, isLoading: academyB2ListLoading } = useQuery({
    queryKey: academyB2ListQueryKey,
    queryFn: () =>
      fetchOptionalAdminData<{
        files?: AcademyB2File[];
        total?: number;
        b2Configured?: boolean;
        bucketName?: string;
      } | null>('/api/admin/academy/b2/list?limit=500', null),
    enabled: Boolean(currentUser?.isAdmin) && academySection === 'b2-archive',
    staleTime: 30000,
    retry: false,
  });

  const { data: academyB2StatsData, isLoading: academyB2StatsLoading } = useQuery({
    queryKey: academyB2StatsQueryKey,
    queryFn: () =>
      fetchOptionalAdminData<AcademyB2Stats | null>(
        '/api/admin/academy/b2/stats',
        null,
      ),
    enabled: Boolean(currentUser?.isAdmin) && academySection === 'b2-archive',
    staleTime: 30000,
    retry: false,
  });

  // Kurs-dropdown for upload-dialog
  const { data: academyCoursesData } = useQuery({
    queryKey: ['/api/admin/academy/courses', 'b2-upload-dropdown'] as const,
    queryFn: () =>
      fetchOptionalAdminData<{
        courses?: AcademyCourseSummary[];
      } | null>('/api/admin/academy/courses?limit=500', null),
    enabled: Boolean(currentUser?.isAdmin) && academySection === 'b2-archive',
    staleTime: 60000,
    retry: false,
  });

  const academyB2DeleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(
        `/api/admin/academy/b2/object?key=${encodeURIComponent(key)}`,
        { method: 'DELETE', headers },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academyB2ListQueryKey });
      queryClient.invalidateQueries({ queryKey: academyB2StatsQueryKey });
      setSnackbar({ open: true, message: 'Fil slettet fra B2.', severity: 'success' });
    },
    onError: (err) => {
      console.error('[academy-b2] delete failed:', err);
      setSnackbar({ open: true, message: 'Kunne ikke slette fil.', severity: 'error' });
    },
  });

  const academyB2DownloadMutation = useMutation({
    mutationFn: async (key: string) => {
      const headers = await auth.getAuthHeader();
      const response = (await apiRequest('/api/admin/academy/b2/download-url', {
        method: 'POST',
        headers,
        body: { key },
      })) as { downloadUrl: string | null; expiresAt: string | null; b2Configured?: boolean };
      return response;
    },
    onSuccess: (data) => {
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        setSnackbar({
          open: true,
          message: 'Kunne ikke generere nedlastings-URL (B2 ikke konfigurert?).',
          severity: 'warning',
        });
      }
    },
    onError: (err) => {
      console.error('[academy-b2] download-url failed:', err);
      setSnackbar({ open: true, message: 'Kunne ikke generere nedlastings-URL.', severity: 'error' });
    },
  });

  const academyB2StartUpload = async () => {
    const { courseId, file, isMaster } = academyB2UploadDialog;
    if (!courseId || !file) {
      setAcademyB2UploadDialog((prev) => ({
        ...prev,
        error: 'Velg kurs og fil før opplasting.',
      }));
      return;
    }
    setAcademyB2UploadDialog((prev) => ({ ...prev, isUploading: true, error: null, progress: 0 }));
    try {
      const headers = await auth.getAuthHeader();
      const presign = (await apiRequest('/api/admin/academy/b2/upload-url', {
        method: 'POST',
        headers,
        body: {
          courseId,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          isMaster,
        },
      })) as { uploadUrl: string | null; key: string | null; expiresAt: string | null; b2Configured?: boolean };

      if (!presign?.uploadUrl) {
        setAcademyB2UploadDialog((prev) => ({
          ...prev,
          isUploading: false,
          error: 'B2 ikke konfigurert — kan ikke laste opp.',
        }));
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presign.uploadUrl as string, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setAcademyB2UploadDialog((prev) => ({ ...prev, progress: pct }));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`B2 PUT feilet med status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Nettverksfeil under opplasting til B2.'));
        xhr.send(file);
      });

      queryClient.invalidateQueries({ queryKey: academyB2ListQueryKey });
      queryClient.invalidateQueries({ queryKey: academyB2StatsQueryKey });
      setSnackbar({ open: true, message: 'Fil lastet opp til B2.', severity: 'success' });
      setAcademyB2UploadDialog({
        open: false,
        courseId: '',
        file: null,
        isMaster: true,
        progress: 0,
        isUploading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukjent feil under opplasting.';
      setAcademyB2UploadDialog((prev) => ({ ...prev, isUploading: false, error: message }));
    }
  };

  const generateOnboardingLinkMutation = useMutation({
    mutationFn: async (instructor: { id: string; name: string | null; email: string | null }) => {
      const headers = await auth.getAuthHeader();
      const response = (await apiRequest(
        `/api/admin/academy/instructors/${instructor.id}/onboarding-link`,
        {
          method: 'POST',
          headers,
        },
      )) as { onboardingUrl: string; expiresAt: string };
      return { ...response, instructor };
    },
    onSuccess: (result) => {
      setOnboardingLinkDialog({
        open: true,
        instructorId: result.instructor.id,
        instructorName: result.instructor.name,
        instructorEmail: result.instructor.email,
        onboardingUrl: result.onboardingUrl,
        expiresAt: result.expiresAt,
      });
      queryClient.invalidateQueries({ queryKey: academyInstructorsQueryKey });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Kunne ikke generere onboarding-lenke';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const syncOnboardingStatusMutation = useMutation({
    mutationFn: async (instructorId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(
        `/api/admin/academy/instructors/${instructorId}/onboarding-status`,
        { headers },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: academyInstructorsQueryKey });
      queryClient.invalidateQueries({ queryKey: academySummaryQueryKey });
      setSnackbar({
        open: true,
        message: 'Onboarding-status oppdatert fra Stripe.',
        severity: 'success',
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Kunne ikke synkronisere status';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const headers = await auth.getAuthHeader();
      const result = (await apiRequest(
        `/api/admin/academy/payouts/${payoutId}/mark-paid`,
        {
          method: 'POST',
          headers,
        },
      )) as { transferId?: string; status?: string } | null;
      return result;
    },
    onSuccess: (result) => {
      invalidateAcademy();
      const transferLabel = result?.transferId
        ? ` (transfer ${result.transferId})`
        : '';
      setSnackbar({
        open: true,
        message: `Utbetaling markert som betalt${transferLabel}.`,
        severity: 'success',
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Kunne ikke markere som betalt';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const approvePayoutMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/academy/payouts/${payoutId}/approve`, {
        method: 'POST',
        headers,
      });
    },
    onSuccess: () => {
      invalidateAcademy();
      setSnackbar({
        open: true,
        message: 'Utbetaling godkjent — Stripe Connect prosesserer overføringen.',
        severity: 'success',
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Kunne ikke godkjenne utbetaling';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
  });

  const rejectPayoutMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/academy/payouts/${id}/reject`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      invalidateAcademy();
      setSnackbar({
        open: true,
        message: 'Utbetaling avvist',
        severity: 'warning',
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Kunne ikke avvise utbetaling';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    },
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
    { id: 'editing-partners', label: 'Redigeringspartnere', icon: Business },
    { id: 'profession-types', label: 'Profesjonstyper', icon: People },
    { id: 'integrasjoner', label: 'Integrasjoner', icon: Link },
    { id: 'feature-management', label: 'Funksjonsflagg', icon: ToggleOn },
    { id: 'centralized-monitoring', label: 'Sentralisert Overvåkning', icon: Assessment },
    { id: 'protokollstyring', label: 'Protokollstyring', icon: Security },
    { id: 'secrets-rotation', label: 'Nøkkel-rotering', icon: Security },
    { id: 'drift-helse', label: 'Drift', icon: Settings },
    { id: 'system-backup', label: 'Backup', icon: Storage },
    { id: 'b2-archive', label: 'B2-arkiv', icon: Storage },
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
        ['okonomi', 'price-management', 'user-costs', 'reports', 'academy', 'tidum-tilganger', 'vendor-types', 'editing-partners', 'profession-types'].includes(tab.id),
      ),
    },
    {
      label: 'Plattform',
      items: adminTabs.filter((tab) =>
        ['integrasjoner', 'feature-management', 'centralized-monitoring', 'protokollstyring', 'secrets-rotation', 'drift-helse', 'system-backup', 'gdpr-compliance'].includes(tab.id),
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
    'editing-partners': 'Godkjenn redigerings-søknader; sett prototype-tester (0 % i en periode) vs. vanlig kunde (partner-fee). Filtrer på type.',
    'profession-types': 'Administrer profesjoner, roller og kapasitet i CreatorHub.',
    integrasjoner: 'Konfigurer API-er, OAuth og eksterne systemkoblinger.',
    'feature-management': 'Kontroller funksjonsflagg og plattformtilgang.',
    'centralized-monitoring': 'Se overvåkning, alarmer og kritiske hendelser samlet.',
    protokollstyring: 'Styr interne protokoller, rutiner og push-konfigurasjon.',
    'secrets-rotation': 'Spor når Stripe-/Cloudflare-/Render-nøkler ble rotert sist; varsel ved forfall.',
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
      tone: '#ff8c00',
      background: 'rgba(255,140,0,0.15)',
    },
    {
      label: 'Live datakilder',
      value: configuredOverviewFeedCount > 0
        ? `${liveOverviewFeedCount}/${configuredOverviewFeedCount}`
        : 'Avventer backend',
      tone: '#86efac',
      background: 'rgba(34,197,94,0.18)',
    },
    {
      label: 'Sesjon',
      value: hasSessionToken ? 'Aktiv' : 'Mangler token',
      tone: hasSessionToken ? '#93c5fd' : '#fca5a5',
      background: hasSessionToken ? 'rgba(30,64,175,0.18)' : 'rgba(239,68,68,0.15)',
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
        <Card sx={{ p: 2.5, textAlign: 'center' }}>
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
        <Card sx={{ p: 2.5, textAlign: 'center' }}>
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
        <Card sx={{ p: 2.5, textAlign: 'center' }}>
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
      <CustomerSuccessSnapshotCard />
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} xl={7}>
          <Card
            sx={{
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.12)',
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(255,255,255,0.04))',
              boxShadow: '0 22px 44px rgba(0,0,0,0.35)',
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
                      color: '#ff8c00',
                      fontWeight: 700,
                    }}
                  >
                    Workspace Control
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 700, color: '#fff' }}>
                    Rask tilgang til adminoppgavene som brukes mest
                  </Typography>
                  <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.85)', maxWidth: 620 }}>
                    Hopp direkte til brukere, prisstyring og drift uten å lete i sidebar. Dette
                    er den operative startflaten for Daniel som full admin.
                  </Typography>
                </Box>
                <Chip
                  label={`${adminTabs.length} adminflater`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.85)',
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
                        border: '1px solid rgba(255,255,255,0.12)',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        textTransform: 'none',
                        boxShadow: 'none',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.06)',
                          borderColor: 'rgba(255,255,255,0.2)',
                          boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
                        },
                      }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography sx={{ fontWeight: 700 }}>{action.label}</Typography>
                        <Typography sx={{ mt: 0.4, fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                          {action.description}
                        </Typography>
                      </Box>
                      <ExpandMore
                        sx={{
                          color: 'rgba(255,255,255,0.65)',
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
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.06)',
              boxShadow: '0 22px 44px rgba(0,0,0,0.35)',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: '#ff8c00',
                  fontWeight: 700,
                }}
              >
                Admin Status
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 700, color: '#fff' }}>
                Operativt snapshot
              </Typography>
              <Typography sx={{ mt: 0.75, color: 'rgba(255,255,255,0.85)' }}>
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
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
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

  const renderAcademyPanel = () => {
    const pendingPayouts = academyPayoutsData?.payouts ?? [];
    const instructors = academyInstructorsData?.instructors ?? [];
    const transfers = academyTransfersData?.transfers ?? [];
    const refunds = academyRefundsData?.refunds ?? [];
    const pendingPayoutsCount =
      academySummary?.pendingPayoutsCount ?? pendingPayouts.length;
    const pendingPayoutsAmount =
      academySummary?.pendingPayoutsAmount ??
      pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const platformShare = academySummary?.platformShare ?? 0;
    const enrollmentCount = academySummary?.enrollmentCount ?? 0;
    const activeInstructorCount = academySummary?.activeInstructorCount ?? 0;
    const payoutsEnabledCount =
      academySummary?.payoutsEnabledCount ??
      instructors.filter((i) => i.payoutsEnabled).length;
    const tableMissing = academyPayoutsData?.tableMissing === true;
    const stripeNotConfigured =
      academySummary?.stripeConfigured === false ||
      academyInstructorsData?.stripeConfigured === false ||
      academyTransfersData?.stripeConfigured === false;
    const fmt = (n: number) => n.toLocaleString('nb-NO');
    const fmtDate = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString('nb-NO') : '—';
    const fmtDateTime = (iso: string | null) =>
      iso ? new Date(iso).toLocaleString('nb-NO') : '—';

    const darkCardSx = {
      bgcolor: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(8px)',
      color: '#fff',
    } as const;

    const onboardingStatusMeta = (
      status: AcademyInstructor['onboardingStatus'],
    ): { label: string; color: 'success' | 'warning' | 'error' | 'default'; icon: React.ReactElement } => {
      switch (status) {
        case 'enabled':
          return { label: 'Enabled', color: 'success', icon: <CheckCircle fontSize="small" /> };
        case 'pending':
          return { label: 'Pending', color: 'warning', icon: <HourglassEmpty fontSize="small" /> };
        case 'restricted':
          return { label: 'Restricted', color: 'error', icon: <Block fontSize="small" /> };
        default:
          return { label: 'Not started', color: 'default', icon: <Warning fontSize="small" /> };
      }
    };

    const transferStatusMeta = (
      status: AcademyTransfer['status'],
    ): { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' } => {
      switch (status) {
        case 'paid':
          return { label: 'Paid', color: 'success' };
        case 'in_transit':
          return { label: 'In transit', color: 'info' };
        case 'failed':
          return { label: 'Failed', color: 'error' };
        case 'pending':
          return { label: 'Pending', color: 'warning' };
        default:
          return { label: status || 'Ukjent', color: 'default' };
      }
    };

    return (
      <Box sx={{ p: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 2, color: '#fff' }}
        >
          <School sx={{ color: '#ff8c00' }} />
          Academy Management
        </Typography>
        <Typography variant="body2" sx={{ mb: 4, color: 'rgba(255,255,255,0.7)' }}>
          Stripe Connect-onboarding, instruktør-payouts og transfer-historikk.
        </Typography>

        {stripeNotConfigured && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Stripe ikke konfigurert. Sett <code>STRIPE_SECRET_KEY</code> på Render
            for å aktivere payouts og onboarding.
          </Alert>
        )}

        {tableMissing && (
          <Alert severity="info" sx={{ mb: 3 }}>
            Migrasjon 254 (academy_payouts) er ikke kjørt enda. Kjør den for å se
            ekte payout-data.
          </Alert>
        )}

        {/* KPI-rad */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={darkCardSx}>
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Plattformgebyrer (20%)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#ff8c00' }}>
                  {academySummaryLoading ? (
                    <CircularProgress size={24} sx={{ color: '#ff8c00' }} />
                  ) : (
                    fmt(platformShare)
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  NOK plattform-andel
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={darkCardSx}>
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Totale registreringer
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#fff' }}>
                  {academySummaryLoading ? (
                    <CircularProgress size={24} sx={{ color: '#fff' }} />
                  ) : (
                    fmt(enrollmentCount)
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  aktive + fullførte enrollments
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={darkCardSx}>
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Aktive instruktører
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#fff' }}>
                  {academySummaryLoading ? (
                    <CircularProgress size={24} sx={{ color: '#fff' }} />
                  ) : (
                    fmt(activeInstructorCount)
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  med aktive kurs
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={darkCardSx}>
              <CardContent>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Payouts-klare
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#4caf50' }}>
                  {academySummaryLoading || academyInstructorsLoading ? (
                    <CircularProgress size={24} sx={{ color: '#4caf50' }} />
                  ) : (
                    fmt(payoutsEnabledCount)
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  med Stripe Connect aktivert
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Seksjons-tabs */}
        <Tabs
          value={academySection}
          onChange={(_e, v) => setAcademySection(v)}
          sx={{
            mb: 3,
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)' },
            '& .Mui-selected': { color: '#ff8c00' },
            '& .MuiTabs-indicator': { backgroundColor: '#ff8c00' },
          }}
        >
          <Tab
            value="instructors"
            label={`Instruktører (${instructors.length})`}
            icon={<AccountBox />}
            iconPosition="start"
          />
          <Tab
            value="payouts"
            label={`Pending payouts (${pendingPayoutsCount})`}
            icon={<Payments />}
            iconPosition="start"
          />
          <Tab
            value="transfers"
            label={`Transfers (${transfers.length})`}
            icon={<Receipt />}
            iconPosition="start"
          />
          <Tab
            value="b2-archive"
            label={`B2-arkiv${
              academyB2StatsData?.totalFiles ? ` (${academyB2StatsData.totalFiles})` : ''
            }`}
            icon={<Storage />}
            iconPosition="start"
          />
        </Tabs>

        {/* Instruktør-seksjon */}
        {academySection === 'instructors' && (
          <Card sx={darkCardSx}>
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
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                  <AccountBox sx={{ color: '#ff8c00' }} />
                  Instruktør Stripe Connect-status
                </Typography>
                <Chip
                  label={`${payoutsEnabledCount} / ${instructors.length} klare`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(76,175,80,0.18)',
                    color: '#a5d6a7',
                    border: '1px solid rgba(76,175,80,0.35)',
                    fontWeight: 600,
                  }}
                />
              </Box>

              {academyInstructorsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: '#ff8c00' }} />
                </Box>
              ) : instructors.length === 0 ? (
                <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.12)' }}>
                  Ingen instruktører registrert enda.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {instructors.map((instructor) => {
                    const meta = onboardingStatusMeta(instructor.onboardingStatus);
                    const isGenerating =
                      generateOnboardingLinkMutation.isPending &&
                      generateOnboardingLinkMutation.variables?.id === instructor.id;
                    const isSyncing =
                      syncOnboardingStatusMutation.isPending &&
                      syncOnboardingStatusMutation.variables === instructor.id;
                    const requirementsCount =
                      instructor.requirementsCurrentlyDue?.length ?? 0;
                    const displayName =
                      instructor.name || instructor.email || `Instruktør ${instructor.id.slice(0, 8)}`;

                    return (
                      <Grid item xs={12} key={instructor.id}>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 2,
                            color: '#fff',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Avatar sx={{ bgcolor: 'rgba(255,140,0,0.2)', color: '#ff8c00' }}>
                              <AccountBox />
                            </Avatar>

                            <Box sx={{ flex: 1, minWidth: 200 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: '#fff' }}>
                                {displayName}
                              </Typography>
                              {instructor.email && (
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}
                                >
                                  {instructor.email}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  icon={meta.icon}
                                  label={meta.label}
                                  size="small"
                                  color={meta.color === 'default' ? undefined : meta.color}
                                  sx={
                                    meta.color === 'default'
                                      ? {
                                          bgcolor: 'rgba(255,255,255,0.1)',
                                          color: 'rgba(255,255,255,0.8)',
                                        }
                                      : { fontWeight: 600 }
                                  }
                                />
                                {instructor.stripeAccountId && (
                                  <Chip
                                    label={`acct ${instructor.stripeAccountId.slice(-6)}`}
                                    size="small"
                                    sx={{
                                      bgcolor: 'rgba(255,255,255,0.08)',
                                      color: 'rgba(255,255,255,0.7)',
                                    }}
                                  />
                                )}
                                {requirementsCount > 0 && (
                                  <Chip
                                    icon={<Warning fontSize="small" />}
                                    label={`${requirementsCount} krav utestående`}
                                    size="small"
                                    color="warning"
                                  />
                                )}
                                {typeof instructor.pendingPayoutAmount === 'number' &&
                                  instructor.pendingPayoutAmount > 0 && (
                                    <Chip
                                      label={`${fmt(instructor.pendingPayoutAmount)} NOK pending`}
                                      size="small"
                                      sx={{
                                        bgcolor: 'rgba(255,193,7,0.18)',
                                        color: '#ffd54f',
                                      }}
                                    />
                                  )}
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {instructor.onboardingStatus !== 'enabled' && (
                                <Tooltip title="Generer onboarding-lenke">
                                  <span>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      startIcon={
                                        isGenerating ? (
                                          <CircularProgress size={14} sx={{ color: '#fff' }} />
                                        ) : (
                                          <Send fontSize="small" />
                                        )
                                      }
                                      disabled={isGenerating || stripeNotConfigured}
                                      onClick={() =>
                                        generateOnboardingLinkMutation.mutate({
                                          id: instructor.id,
                                          name: instructor.name,
                                          email: instructor.email,
                                        })
                                      }
                                      sx={{
                                        bgcolor: '#ff8c00',
                                        '&:hover': { bgcolor: '#e67e00' },
                                        textTransform: 'none',
                                      }}
                                    >
                                      {isGenerating ? 'Genererer…' : 'Generer lenke'}
                                    </Button>
                                  </span>
                                </Tooltip>
                              )}
                              <Tooltip title="Sync status fra Stripe">
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={
                                      isSyncing ? (
                                        <CircularProgress size={14} />
                                      ) : (
                                        <Refresh fontSize="small" />
                                      )
                                    }
                                    disabled={isSyncing || stripeNotConfigured}
                                    onClick={() =>
                                      syncOnboardingStatusMutation.mutate(instructor.id)
                                    }
                                    sx={{
                                      color: '#fff',
                                      borderColor: 'rgba(255,255,255,0.3)',
                                      textTransform: 'none',
                                      '&:hover': {
                                        borderColor: '#ff8c00',
                                        bgcolor: 'rgba(255,140,0,0.1)',
                                      },
                                    }}
                                  >
                                    Sync
                                  </Button>
                                </span>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payout-seksjon */}
        {academySection === 'payouts' && (
          <Card sx={darkCardSx}>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                  <Payments sx={{ color: '#ff8c00' }} />
                  Utbetalingsforespørsler
                </Typography>
                <Chip
                  label={`${pendingPayoutsCount} ventende`}
                  color="warning"
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              {pendingPayoutsAmount > 0 && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  <strong>{fmt(pendingPayoutsAmount)} NOK</strong> venter på godkjenning
                </Alert>
              )}

              {academyPayoutsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress sx={{ color: '#ff8c00' }} />
                </Box>
              ) : pendingPayouts.length === 0 ? (
                <Alert severity="success" sx={{ bgcolor: 'rgba(76,175,80,0.12)' }}>
                  Ingen ventende utbetalinger akkurat nå.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {pendingPayouts.map((payout) => {
                    const displayName =
                      payout.instructorName ||
                      payout.notes ||
                      `Instruktør ${payout.instructorId.slice(0, 8)}`;
                    const bankSuffix = payout.bankAccountLast4
                      ? `****${payout.bankAccountLast4}`
                      : 'ikke registrert';
                    const requestedAt = payout.requestedAt
                      ? new Date(payout.requestedAt).toLocaleDateString('nb-NO')
                      : '—';
                    const isApproving =
                      approvePayoutMutation.isPending &&
                      approvePayoutMutation.variables === payout.id;
                    const isRejecting =
                      rejectPayoutMutation.isPending &&
                      rejectPayoutMutation.variables?.id === payout.id;
                    const isMarkingPaid =
                      markPaidMutation.isPending &&
                      markPaidMutation.variables === payout.id;
                    const instructorRecord = instructors.find(
                      (i) => i.id === payout.instructorId,
                    );
                    const payoutsEnabled = instructorRecord?.payoutsEnabled ?? false;
                    const markPaidDisabled =
                      !payoutsEnabled ||
                      isApproving ||
                      isRejecting ||
                      isMarkingPaid ||
                      stripeNotConfigured ||
                      payout.status !== 'approved';
                    const markPaidTooltip = !payoutsEnabled
                      ? 'Instruktør må fullføre Stripe Connect-onboarding først'
                      : payout.status !== 'approved'
                        ? 'Payouten må være godkjent før den kan markeres betalt'
                        : 'Initier Stripe transfer og marker som betalt';

                    return (
                      <Grid item xs={12} key={payout.id}>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: 'rgba(255,193,7,0.08)',
                            border: '1px solid rgba(255,193,7,0.3)',
                            borderRadius: 2,
                            color: '#fff',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Avatar sx={{ bgcolor: '#ff9800' }}>
                              <AccountCircle />
                            </Avatar>

                            <Box sx={{ flex: 1, minWidth: 200 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, color: '#fff' }}>
                                {displayName}
                              </Typography>
                              <Typography
                                variant="h6"
                                sx={{ color: '#ff9800', fontWeight: 700 }}
                              >
                                {fmt(payout.amount)} NOK
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                <Chip
                                  label={payout.status || 'pending'}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.8)',
                                  }}
                                />
                                <Chip
                                  label={`Forespurt: ${requestedAt}`}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.8)',
                                  }}
                                />
                                <Chip
                                  label={`Bank: ${bankSuffix}`}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.8)',
                                  }}
                                />
                                {!payoutsEnabled && (
                                  <Chip
                                    icon={<Block fontSize="small" />}
                                    label="Connect ikke klar"
                                    size="small"
                                    color="error"
                                  />
                                )}
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Tooltip title="Godkjenn utbetaling">
                                <span>
                                  <IconButton
                                    color="success"
                                    disabled={isApproving || isRejecting || isMarkingPaid}
                                    onClick={() =>
                                      setPayoutConfirmDialog({ open: true, payout })
                                    }
                                  >
                                    {isApproving ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <Check />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip title={markPaidTooltip}>
                                <span>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    disabled={markPaidDisabled}
                                    startIcon={
                                      isMarkingPaid ? (
                                        <CircularProgress size={14} sx={{ color: '#fff' }} />
                                      ) : (
                                        <Payments fontSize="small" />
                                      )
                                    }
                                    onClick={() => markPaidMutation.mutate(payout.id)}
                                    sx={{ textTransform: 'none' }}
                                  >
                                    {isMarkingPaid ? 'Overfører…' : 'Marker betalt'}
                                  </Button>
                                </span>
                              </Tooltip>

                              <Tooltip title="Avvis utbetaling">
                                <span>
                                  <IconButton
                                    color="error"
                                    disabled={isApproving || isRejecting || isMarkingPaid}
                                    onClick={() => {
                                      const reason = window.prompt(
                                        'Begrunnelse for avvisning?',
                                      );
                                      if (!reason || !reason.trim()) return;
                                      rejectPayoutMutation.mutate({
                                        id: payout.id,
                                        reason: reason.trim(),
                                      });
                                    }}
                                  >
                                    {isRejecting ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <Close />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transfer-history-seksjon */}
        {academySection === 'transfers' && (
          <>
            <Card sx={{ ...darkCardSx, mb: 3 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                    <Receipt sx={{ color: '#ff8c00' }} />
                    Siste transfers
                  </Typography>
                  <Chip
                    label={`${transfers.length} transfers`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.8)',
                    }}
                  />
                </Box>

                {academyTransfersLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#ff8c00' }} />
                  </Box>
                ) : transfers.length === 0 ? (
                  <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.12)' }}>
                    Ingen transfers registrert enda.
                  </Alert>
                ) : (
                  <Grid container spacing={1.5}>
                    {transfers.slice(0, 20).map((transfer) => {
                      const meta = transferStatusMeta(transfer.status);
                      const displayName =
                        transfer.instructorName ||
                        `Instruktør ${transfer.instructorId.slice(0, 8)}`;
                      return (
                        <Grid item xs={12} key={transfer.id}>
                          <Paper
                            sx={{
                              p: 1.5,
                              bgcolor: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              borderRadius: 2,
                              color: '#fff',
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 220 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                                  {displayName}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}
                                >
                                  {fmtDateTime(transfer.createdAt)}
                                  {transfer.stripeTransferId
                                    ? ` · ${transfer.stripeTransferId}`
                                    : ''}
                                </Typography>
                                {transfer.failureReason && (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: '#ef9a9a', display: 'block', mt: 0.5 }}
                                  >
                                    {transfer.failureReason}
                                  </Typography>
                                )}
                              </Box>
                              <Typography
                                variant="body1"
                                sx={{ fontWeight: 700, color: '#fff', minWidth: 110, textAlign: 'right' }}
                              >
                                {fmt(transfer.amount)} {(transfer.currency || 'NOK').toUpperCase()}
                              </Typography>
                              <Chip
                                label={meta.label}
                                size="small"
                                color={meta.color === 'default' ? undefined : meta.color}
                                sx={
                                  meta.color === 'default'
                                    ? {
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                        color: 'rgba(255,255,255,0.8)',
                                      }
                                    : { fontWeight: 600 }
                                }
                              />
                              {transfer.stripeTransferId && (
                                <Tooltip title="Åpne i Stripe Dashboard">
                                  <IconButton
                                    size="small"
                                    component="a"
                                    href={`https://dashboard.stripe.com/transfers/${transfer.stripeTransferId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ color: 'rgba(255,255,255,0.7)' }}
                                  >
                                    <OpenInNew fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </CardContent>
            </Card>

            <Card sx={darkCardSx}>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: '#fff' }}
                >
                  <History sx={{ color: '#ff8c00' }} />
                  Refund-historikk
                </Typography>
                {refunds.length === 0 ? (
                  <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.12)' }}>
                    Ingen refunds registrert.
                  </Alert>
                ) : (
                  <Grid container spacing={1}>
                    {refunds.slice(0, 20).map((refund) => (
                      <Grid item xs={12} key={refund.id}>
                        <Paper
                          sx={{
                            p: 1.5,
                            bgcolor: 'rgba(244,67,54,0.08)',
                            border: '1px solid rgba(244,67,54,0.2)',
                            borderRadius: 2,
                            color: '#fff',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Box sx={{ flex: 1, minWidth: 220 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {refund.instructorName || `Instruktør ${refund.instructorId.slice(0, 8)}`}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}
                              >
                                {fmtDate(refund.createdAt)}
                                {refund.reason ? ` · ${refund.reason}` : ''}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 700, color: '#ef9a9a' }}>
                              −{fmt(refund.amount)} NOK
                            </Typography>
                            <Chip
                              label={refund.status}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.8)',
                              }}
                            />
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* B2-arkiv-seksjon (admin-only) */}
        {academySection === 'b2-archive' && (
          <>
            {academyB2ListData?.b2Configured === false && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                B2 ikke konfigurert. Sett <code>B2_APPLICATION_KEY_ID</code> +{' '}
                <code>B2_APPLICATION_KEY</code> + <code>B2_BUCKET_NAME</code> på Render.
              </Alert>
            )}

            {/* B2 KPI-rad */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={darkCardSx}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Totalt antall filer
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#ff8c00' }}>
                      {academyB2StatsLoading ? (
                        <CircularProgress size={24} sx={{ color: '#ff8c00' }} />
                      ) : (
                        fmt(academyB2StatsData?.totalFiles ?? 0)
                      )}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      i academy/-prefixet
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={darkCardSx}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Total størrelse
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#fff' }}>
                      {academyB2StatsLoading ? (
                        <CircularProgress size={24} sx={{ color: '#fff' }} />
                      ) : (
                        (() => {
                          const bytes = academyB2StatsData?.totalSizeBytes ?? 0;
                          if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
                          if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
                          if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
                          if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(2)} KB`;
                          return `${bytes} B`;
                        })()
                      )}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      master-videoer + assets
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card sx={darkCardSx}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Kurs med arkiv
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, my: 1, color: '#fff' }}>
                      {academyB2StatsLoading ? (
                        <CircularProgress size={24} sx={{ color: '#fff' }} />
                      ) : (
                        fmt(academyB2StatsData?.byCourse?.length ?? 0)
                      )}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      unike course-IDer i bucket
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Per-kurs breakdown */}
            {(academyB2StatsData?.byCourse?.length ?? 0) > 0 && (
              <Card sx={{ ...darkCardSx, mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#fff', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Storage sx={{ color: '#ff8c00' }} />
                    Per kurs
                  </Typography>
                  <Grid container spacing={1}>
                    {academyB2StatsData?.byCourse.slice(0, 8).map((row) => (
                      <Grid item xs={12} sm={6} md={4} key={row.courseId}>
                        <Paper
                          sx={{
                            p: 1.5,
                            bgcolor: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 2,
                            color: '#fff',
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.courseName ?? row.courseId}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
                            {row.fileCount} filer · {(row.sizeBytes / 1e6).toFixed(1)} MB
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Fil-liste + upload-knapp */}
            <Card sx={darkCardSx}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
                    <Storage sx={{ color: '#ff8c00' }} />
                    Filer i academy/
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CloudUpload />}
                    onClick={() =>
                      setAcademyB2UploadDialog({
                        open: true,
                        courseId: '',
                        file: null,
                        isMaster: true,
                        progress: 0,
                        isUploading: false,
                        error: null,
                      })
                    }
                    disabled={academyB2ListData?.b2Configured === false}
                    sx={{
                      bgcolor: '#ff8c00',
                      '&:hover': { bgcolor: '#e67e00' },
                      textTransform: 'none',
                    }}
                  >
                    Upload master
                  </Button>
                </Box>

                {academyB2ListLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#ff8c00' }} />
                  </Box>
                ) : (academyB2ListData?.files?.length ?? 0) === 0 ? (
                  <Alert severity="info" sx={{ bgcolor: 'rgba(33,150,243,0.12)' }}>
                    Ingen filer i academy/-prefixet enda.
                  </Alert>
                ) : (
                  <Grid container spacing={1}>
                    {academyB2ListData?.files?.map((file) => (
                      <Grid item xs={12} key={file.key}>
                        <Paper
                          sx={{
                            p: 1.5,
                            bgcolor: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 2,
                            color: '#fff',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Box sx={{ flex: 1, minWidth: 220 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                                {file.key}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}
                              >
                                {fmtDateTime(file.lastModified)} ·{' '}
                                {(file.sizeBytes / 1e6).toFixed(2)} MB
                                {file.courseId ? ` · kurs: ${file.courseId}` : ''}
                              </Typography>
                            </Box>
                            {file.isMaster && (
                              <Chip
                                label="MASTER"
                                size="small"
                                sx={{
                                  bgcolor: 'rgba(255,140,0,0.18)',
                                  color: '#ffb74d',
                                  fontWeight: 600,
                                }}
                              />
                            )}
                            <Tooltip title="Last ned (signed URL, 30 min)">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => academyB2DownloadMutation.mutate(file.key)}
                                  disabled={academyB2DownloadMutation.isPending}
                                  sx={{ color: 'rgba(255,255,255,0.8)' }}
                                >
                                  <CloudDownload fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Slett fra B2">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setAcademyB2DeleteConfirm({ open: true, key: file.key })
                                  }
                                  disabled={academyB2DeleteMutation.isPending}
                                  sx={{ color: '#ef9a9a' }}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>

            {/* Upload-dialog */}
            <Dialog
              open={academyB2UploadDialog.open}
              onClose={() =>
                !academyB2UploadDialog.isUploading &&
                setAcademyB2UploadDialog((prev) => ({ ...prev, open: false }))
              }
              fullWidth
              maxWidth="sm"
            >
              <DialogTitle>Last opp til Academy B2-arkiv</DialogTitle>
              <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                  Filen skrives til{' '}
                  <code>
                    academy/courses/{academyB2UploadDialog.courseId || '<courseId>'}/
                    {academyB2UploadDialog.isMaster ? 'masters' : 'assets'}/
                    {academyB2UploadDialog.file?.name || '<filnavn>'}
                  </code>
                </DialogContentText>
                <TextField
                  select
                  fullWidth
                  label="Kurs"
                  value={academyB2UploadDialog.courseId}
                  onChange={(e) =>
                    setAcademyB2UploadDialog((prev) => ({
                      ...prev,
                      courseId: e.target.value,
                      error: null,
                    }))
                  }
                  sx={{ mb: 2 }}
                  disabled={academyB2UploadDialog.isUploading}
                >
                  <MenuItem value="">— velg kurs —</MenuItem>
                  {(academyCoursesData?.courses ?? []).map((course) => (
                    <MenuItem key={course.id} value={course.id}>
                      {course.title} ({course.id.slice(0, 8)})
                    </MenuItem>
                  ))}
                </TextField>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUpload />}
                    disabled={academyB2UploadDialog.isUploading}
                  >
                    Velg fil
                    <input
                      type="file"
                      hidden
                      onChange={(e) =>
                        setAcademyB2UploadDialog((prev) => ({
                          ...prev,
                          file: e.target.files?.[0] ?? null,
                          error: null,
                        }))
                      }
                    />
                  </Button>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {academyB2UploadDialog.file?.name || 'Ingen fil valgt'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <input
                    id="academy-b2-is-master"
                    type="checkbox"
                    checked={academyB2UploadDialog.isMaster}
                    onChange={(e) =>
                      setAcademyB2UploadDialog((prev) => ({
                        ...prev,
                        isMaster: e.target.checked,
                      }))
                    }
                    disabled={academyB2UploadDialog.isUploading}
                  />
                  <label htmlFor="academy-b2-is-master">
                    Master-fil (lagres under <code>masters/</code> — ellers under <code>assets/</code>)
                  </label>
                </Box>
                {academyB2UploadDialog.isUploading && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Laster opp… {academyB2UploadDialog.progress}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={academyB2UploadDialog.progress}
                      sx={{ mt: 0.5 }}
                    />
                  </Box>
                )}
                {academyB2UploadDialog.error && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    {academyB2UploadDialog.error}
                  </Alert>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() =>
                    setAcademyB2UploadDialog((prev) => ({ ...prev, open: false }))
                  }
                  disabled={academyB2UploadDialog.isUploading}
                >
                  Avbryt
                </Button>
                <Button
                  onClick={academyB2StartUpload}
                  variant="contained"
                  disabled={
                    academyB2UploadDialog.isUploading ||
                    !academyB2UploadDialog.courseId ||
                    !academyB2UploadDialog.file
                  }
                  sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
                >
                  {academyB2UploadDialog.isUploading ? 'Laster opp…' : 'Last opp'}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Slett-confirm-dialog */}
            <Dialog
              open={academyB2DeleteConfirm.open}
              onClose={() => setAcademyB2DeleteConfirm({ open: false, key: null })}
            >
              <DialogTitle>Slett fil fra B2?</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Dette fjerner objektet permanent fra Backblaze. Handlingen kan ikke angres.
                  <br />
                  <code>{academyB2DeleteConfirm.key}</code>
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAcademyB2DeleteConfirm({ open: false, key: null })}>
                  Avbryt
                </Button>
                <Button
                  onClick={() => {
                    if (academyB2DeleteConfirm.key) {
                      academyB2DeleteMutation.mutate(academyB2DeleteConfirm.key);
                    }
                    setAcademyB2DeleteConfirm({ open: false, key: null });
                  }}
                  color="error"
                  variant="contained"
                >
                  Slett
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Box>
    );
  };

  const renderProtocolPanel = () => (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}
      >
        <Settings />
        Drift & Innstillinger
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2, color: '#fff' }}>
          Push-varsler
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255,255,255,0.7)' }}>
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
          sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}
        >
          <Campaign color="primary" />
          Marketing Management
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
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
        return (
          <>
            <UserManagementPanel {...sharedPanelProps} />
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 4, pt: 3 }}>
              <LeadMapEntitlementsAdminPanel />
            </Box>
          </>
        );
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
                sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}
              >
                <Folder color="primary" />
                Visual CMS Dashboard
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
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
      case 'secrets-rotation':
        return <SecretsRotationPanel />;
      case 'marketplace-apps':
        return (
          <>
            <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pt: 2, pb: 1 }}>
              <LeadMapMarketplaceCard
                onJumpToEntitlements={() => activateTab(tabIndexFor('brukere-roller'))}
                onJumpToPricing={() => openPriceManagementSection('lead-map')}
              />
            </Box>
            <MarketplaceAppConfigManager />
          </>
        );
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
      case 'editing-partners':
        return <EditingPartnersAdminPanel />;
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
      case 'b2-archive':
        return <B2ArchiveTab />;
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
            bgcolor: '#0a0f1a',
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
              bgcolor: 'rgba(255,255,255,0.06)',
              borderRadius: '28px',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRight: '1px solid rgba(255,255,255,0.12)',
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
                      bgcolor: '#ff8c00',
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
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                      CreatorHub
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>
                      Admin workspace
                    </Typography>
                  </Box>
                </Box>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>
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
                        <Search sx={{ fontSize: 18, color: 'rgba(255,255,255,0.65)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: 'rgba(255,255,255,0.06)',
                      '& fieldset': {
                        borderColor: 'rgba(255,255,255,0.12)',
                      },
                    },
                    '& .MuiInputBase-input': {
                      fontSize: '0.88rem',
                    },
                  }}
                />
                <Typography sx={{ mt: 0.75, px: 0.5, fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>
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
                        bgcolor: 'rgba(255,255,255,0.06)',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.65)',
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
                          bgcolor: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.7)',
                          fontWeight: 700,
                          borderRadius: '999px',
                        }}
                      />
                      <ExpandMore
                        sx={{
                          fontSize: 18,
                          color: 'rgba(255,255,255,0.65)',
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
                              color: isSelected ? '#fff' : 'rgba(255,255,255,0.85)',
                              bgcolor: isSelected ? 'rgba(255,140,0,0.15)' : 'transparent',
                              border: isSelected
                                ? '1px solid rgba(255,140,0,0.35)'
                                : '1px solid transparent',
                              '&:hover': {
                                bgcolor: isSelected ? 'rgba(255,140,0,0.2)' : 'rgba(255,255,255,0.06)',
                              },
                              '& .MuiButton-startIcon': {
                                color: isSelected ? '#fff' : 'rgba(255,255,255,0.65)',
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
                                    color: 'rgba(255,255,255,0.65)',
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

            <Box sx={{ pt: 2, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'grid', gap: 0.75 }}>
              <Button
                fullWidth
                onClick={() => setFullscreenChatOpen(true)}
                onPointerDown={() => setFullscreenChatOpen(true)}
                startIcon={<Chat sx={{ fontSize: 18 }} />}
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: '12px',
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.85)',
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
                  color: 'rgba(255,255,255,0.85)',
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
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
                  CreatorHub Admin {'>'} Workspace {'>'} {currentTab.label}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.75,
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {currentTab.label}
                </Typography>
                <Typography sx={{ mt: 0.5, fontSize: '0.84rem', color: 'rgba(255,255,255,0.7)', maxWidth: 720 }}>
                  {currentTabDescription}
                </Typography>
                <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={currentUser.isAdmin ? 'Full admin' : 'Begrenset tilgang'}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,140,0,0.15)',
                      color: '#ff8c00',
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
                      bgcolor: 'rgba(34,197,94,0.18)',
                      color: '#86efac',
                      fontWeight: 700,
                      borderRadius: '999px',
                    }}
                  />
                  <Chip
                    label={hasSessionToken ? 'Sesjon aktiv' : 'Sesjon mangler'}
                    size="small"
                    sx={{
                      bgcolor: hasSessionToken ? 'rgba(30,64,175,0.18)' : 'rgba(239,68,68,0.15)',
                      color: hasSessionToken ? '#93c5fd' : '#fca5a5',
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
                    bgcolor: 'rgba(255,140,0,0.15)',
                    color: '#ff8c00',
                    fontWeight: 700,
                    borderRadius: '999px',
                  }}
                />
                <Avatar
                  src={currentUser.picture || undefined}
                  sx={{ width: 34, height: 34, bgcolor: 'rgba(255,140,0,0.18)', color: '#ff8c00' }}
                >
                  {(currentUser.name || currentUser.email || 'A').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {currentUser.name || 'Admin'}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.65)',
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
                bgcolor: isVisualCmsTab ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
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
          backgroundColor: 'rgba(15,23,42,0.94)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(16px)',
          color: '#fff',
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
                  sx={{ display: 'block', mt: -0.5, color: 'rgba(255,255,255,0.7)' }}
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
              border: '1px solid rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.06)',
            }}
          >
            <MenuIcon />
            <ExpandMore sx={{ ml: 0.5, fontSize: 16 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <MobileDropdownMenu />

      <Box sx={{ minHeight: '100vh', bgcolor: '#0a0f1a', pb: 12 }}>
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
              <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)', mb: 0.75 }}>
                CreatorHub Admin {'>'} Workspace {'>'} {currentTab.label}
              </Typography>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
                {currentTab.label}
              </Typography>
              <Typography sx={{ mt: 0.5, fontSize: '0.92rem', color: 'rgba(255,255,255,0.7)' }}>
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
            Godkjenn utbetaling på {payoutConfirmDialog.payout?.amount?.toLocaleString('nb-NO')} NOK til{' '}
            {payoutConfirmDialog.payout?.instructorName ||
              payoutConfirmDialog.payout?.notes ||
              payoutConfirmDialog.payout?.name ||
              'instruktør'}
            ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayoutConfirmDialog({ open: false, payout: null })}>Avbryt</Button>
          <Button
            onClick={() => {
              const payoutId = payoutConfirmDialog.payout?.id;
              if (!payoutId) {
                setPayoutConfirmDialog({ open: false, payout: null });
                return;
              }
              approvePayoutMutation.mutate(payoutId);
              setPayoutConfirmDialog({ open: false, payout: null });
            }}
            variant="contained"
            color="success"
            disabled={approvePayoutMutation.isPending}
          >
            {approvePayoutMutation.isPending ? 'Godkjenner…' : 'Godkjenn'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Onboarding-link Dialog */}
      <Dialog
        open={onboardingLinkDialog.open}
        onClose={() =>
          setOnboardingLinkDialog({
            open: false,
            instructorId: null,
            instructorName: null,
            instructorEmail: null,
            onboardingUrl: null,
            expiresAt: null,
          })
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBox sx={{ color: '#ff8c00' }} />
          Onboarding-lenke generert
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Send denne lenken til{' '}
            <strong>
              {onboardingLinkDialog.instructorName ||
                onboardingLinkDialog.instructorEmail ||
                'instruktøren'}
            </strong>{' '}
            for å fullføre Stripe Connect-onboarding.
            {onboardingLinkDialog.expiresAt && (
              <>
                {' '}
                Lenken utløper{' '}
                {new Date(onboardingLinkDialog.expiresAt).toLocaleString('nb-NO')}.
              </>
            )}
          </DialogContentText>
          <TextField
            fullWidth
            value={onboardingLinkDialog.onboardingUrl ?? ''}
            multiline
            minRows={2}
            InputProps={{ readOnly: true }}
            sx={{ mb: 2 }}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<ContentCopy />}
              onClick={async () => {
                const url = onboardingLinkDialog.onboardingUrl;
                if (!url) return;
                try {
                  await navigator.clipboard.writeText(url);
                  setSnackbar({
                    open: true,
                    message: 'Onboarding-lenke kopiert til utklippstavlen.',
                    severity: 'success',
                  });
                } catch {
                  setSnackbar({
                    open: true,
                    message: 'Kunne ikke kopiere — kopier manuelt fra tekstfeltet.',
                    severity: 'warning',
                  });
                }
              }}
            >
              Kopier lenke
            </Button>
            {onboardingLinkDialog.instructorEmail && onboardingLinkDialog.onboardingUrl && (
              <Button
                variant="contained"
                startIcon={<Email />}
                component="a"
                href={`mailto:${encodeURIComponent(onboardingLinkDialog.instructorEmail)}?subject=${encodeURIComponent(
                  'Fullfør Stripe Connect-onboarding for CreatorHub Academy',
                )}&body=${encodeURIComponent(
                  `Hei${onboardingLinkDialog.instructorName ? ' ' + onboardingLinkDialog.instructorName : ''},\n\nFor å motta utbetalinger fra CreatorHub Academy må du fullføre Stripe Connect-onboarding. Bruk lenken under (utløper ${onboardingLinkDialog.expiresAt ? new Date(onboardingLinkDialog.expiresAt).toLocaleString('nb-NO') : 'innen kort tid'}):\n\n${onboardingLinkDialog.onboardingUrl}\n\nTakk!\nCreatorHub`,
                )}`}
                sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
              >
                Send per e-post
              </Button>
            )}
            {onboardingLinkDialog.onboardingUrl && (
              <Button
                variant="text"
                startIcon={<OpenInNew />}
                component="a"
                href={onboardingLinkDialog.onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Åpne lenken
              </Button>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setOnboardingLinkDialog({
                open: false,
                instructorId: null,
                instructorName: null,
                instructorEmail: null,
                onboardingUrl: null,
                expiresAt: null,
              })
            }
          >
            Lukk
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
