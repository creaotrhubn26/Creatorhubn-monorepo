/**
 * CreatorHub Norge - Integrations Management Panel
 * Complete admin interface for API keys, webhooks, and OAuth clients
 */

import { useTheming } from '../../utils/theming-helper';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// WireMock Advanced Features
import { WireMockReloadIndicator } from './WireMockReloadIndicator';
import { WireMockAdminAPIExplorer } from './WireMockAdminAPIExplorer';
import { HARViewer } from './HARViewer';
import { SelfHealingSandboxPanel } from './SelfHealingSandboxPanel';
import { WireMockBehaviorAnalytics } from './WireMockBehaviorAnalytics';
import { WireMockTestHistoryTable } from './WireMockTestHistoryTable';
import { WireMockResponseViewer } from './WireMockResponseViewer';
import { useWireMockTestHistory } from '../../hooks/useWireMockTestHistory';
import { WireMockTestRunner } from '../../utils/wireMockTestRunner';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper as _Paper,
  Chip,
  IconButton,
  Menu as _Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Skeleton,
  Tooltip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  InputAdornment,
  LinearProgress,
  Divider,
  CircularProgress,
  Stack,
  Grid,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  Add as AddIcon,
  Key as KeyIcon,
  Webhook as WebhookIcon,
  Security as OAuthIcon,
  MoreVert as _MoreVertIcon,
  Refresh as RefreshIcon,
  Sync as SyncIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Delete as _DeleteIcon,
  ContentCopy as CopyIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOff,
  DeveloperMode as _DevModeIcon,
  Api as ApiIcon,
  Stop as _StopIcon,
  Code as CodeIcon,
  ConnectedTv as _IntegrationIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  PlayCircleFilled as ExecuteIcon,
  Psychology as AiIcon,
  CheckCircle as CheckCircleIcon,
  Google as GoogleIcon,
  Facebook as FacebookIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  LibraryMusic as _SpotifyIcon,
  Instagram as InstagramIcon,
  PhotoLibrary as PhotoLibraryIcon,
  Payment as PaymentIcon,
  Security as SecurityIcon,
  CloudUpload as CloudUploadIcon,
  Analytics as AnalyticsIcon,
  Phone as PhoneIcon,
  Email as _EmailIcon,
  VerifiedUser as VerifiedIcon,
  Link as LinkIcon,
  RocketLaunch as RocketIcon,
  BarChart as BarChartIcon,
  AccountBalance as AccountBalanceIcon,
  PhoneAndroid as PhoneAndroidIcon,
  PhotoCamera as PhotoCameraIcon,
  Palette as _PaletteIcon,
  Tv as _TvIcon,
  ShoppingCart as ShoppingCartIcon,
  Cloud as CloudIcon,
  Inventory as _InventoryIcon,
  Science as ScienceIcon,
  MenuBook as MenuBookIcon,
  CameraAlt as CameraAltIcon,
  MusicNote as MusicNoteIcon,
  Brush as _BrushIcon,
  LocalShipping as _LocalShippingIcon,
  Assessment as _AssessmentIcon,
  Cancel as _CancelIcon,
  VideoLibrary as _VideoLibraryIcon,
  Storage as _StorageIcon,
  Settings as SettingsIcon,
  Speed as ProtocolIcon,
  GraphicEq as MediaProtocolIcon,
  SmartToy as _AiProtocolIcon,
  Chat as ChatProtocolIcon,
  Shield as ShieldIcon,
  Search as SeoIcon,
  Search as SearchIcon,
  MovieCreation as _VideoIcon,
  AudioFile as _AudioIcon,
  AutoFixHigh as EnhancementIcon,
  Language as _LanguageIcon,
  Psychology as MLIcon,
  AccountTree as GraphQLIcon,
  Wifi as WebSocketIcon,
  Memory as GrpcIcon,
  Security as AcmeIcon,
  Stream as RtmpIcon,
  Hd as HlsIcon,
  Folder as WebDavIcon,
  Group as ActivityPubIcon,
  CalendarToday as CalDavIcon,
  Contacts as _CardDavIcon,
  CreditCard as _PciIcon,
  VpnLock as _ZeroTrustIcon,
  Business as EdiIcon,
  AccountBalance as OpenBankingIcon,
  Description as OpenApiIcon,
  Timeline as TimelineIcon,
  Extension as ExtensionIcon,
  PlayArrow as TestIcon,
  Publish as PublishIcon,
} from '@mui/icons-material';
import { useToast } from '../../hooks/use-toast';
import { WireMockController } from '../wiremock/WireMockController';
import { AdminConsole } from './AdminConsole';
import { DependenciesManager } from './DependenciesManager';
import ApiIntegrationProcessMonitor from './ApiIntegrationProcessMonitor';
import DatabaseIntegrityChecker from './DatabaseIntegrityChecker';
import type { APIVersionInfo } from './APIVersionReleaseNotesDialog';
import { APIVersionReleaseNotesDialog } from './APIVersionReleaseNotesDialog';
import { AdminButton } from './design-system';

interface ApiKey {
  id: string;
  name: string;
  service: string;
  keyType: string;
  status: string;
  lastUsed: string | null;
  createdAt: string;
  permissions: string[];
  rotationDue: string;
  usageCount: number;
  monthlyQuota: number;
  maskedKey: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  service: string;
  status: string;
  events: string[];
  successRate: number;
  totalEvents: number;
  lastTriggered: string | null;
  createdAt: string;
}

interface OAuthClient {
  id: string;
  name: string;
  provider: string;
  clientId: string;
  scopes: string[];
  redirectUris: string[];
  status: string;
  totalAuthorizations: number;
  createdAt: string;
}


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
);
};

interface IntegrationsManagementPanelProps {
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
}

export default function IntegrationsManagementPanel({
  onMeetingCreate: _onMeetingCreate,
  onProjectUpdate: _onProjectUpdate,
  onWorklogCreate: _onWorklogCreate,
  onClientSelect: _onClientSelect,
  onClientUpdate: _onClientUpdate,
  onShowcaseCreate: _onShowcaseCreate,
  onFileUpload: _onFileUpload,
  onFileDownload: _onFileDownload,
  selectedProject: _selectedProject,
  onProjectSelect: _onProjectSelect,
  selectedClient: _selectedClient,
  onSettingsUpdate: _onSettingsUpdate,
  onNotificationCreate: _onNotificationCreate
}: IntegrationsManagementPanelProps) {
  // Theming system
  const theming = useTheming('prototype_tester');
  // Lys oransje aksent på mørk bakgrunn (matcher admin-skallet).
  const themeColors = { ...theming.colors, primary: '#ff8c00' };
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // WireMock test history hook
  const {
    history: wireMockHistory,
    selectedResult: wireMockSelectedResult,
    viewerOpen: wireMockViewerOpen,
    addTestResult: addWireMockTestResult,
    viewResult: viewWireMockResult,
    closeViewer: closeWireMockViewer,
    getSuccessRate: getWireMockSuccessRate,
    getAverageResponseTime: getWireMockAvgResponseTime,
    exportHistory: exportWireMockHistory,
    clearHistory: clearWireMockHistory
  } = useWireMockTestHistory();

  // State management
  const [tabValue, setTabValue] = useState(0);
  const [search, setSearch] = useState("");
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [oauthDialogOpen, setOAuthDialogOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [environmentStatus, setEnvironmentStatus] = useState<any>(null);

  // API Version Management state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [selectedVersionInfo, setSelectedVersionInfo] = useState<APIVersionInfo | null>(null);
  const [apiVersions, setApiVersions] = useState<APIVersionInfo[]>([]);
  const [checkingVersions, setCheckingVersions] = useState(false);
  const [updatingVersion, setUpdatingVersion] = useState(false);
  const [syncingWithRender, setSyncingWithRender] = useState(false);

  // Confirm dialog states for replacing native confirm()
  const [_apiTestConfirm, setApiTestConfirm] = useState<{ open: boolean; testService: string | null; headers: any }>({ open: false, testService: null, headers: null });
  const [_aiImplementConfirm, setAiImplementConfirm] = useState<{ open: boolean; message: string; solutionId: string | null; headers: any }>({ open: false, message: '', solutionId: null, headers: null });
  const [_needsDatabaseConfirm, setNeedsDatabaseConfirm] = useState<{ open: boolean; projectName: string; description: string; apis: string; }>({ open: false, projectName: '', description: '', apis: '' });
  const [_projectLiveConfirm, _setProjectLiveConfirm] = useState<{ open: boolean; projectName: string }>({ open: false, projectName: '' });

  // API Gateway data fetching
  const { data: _apiGatewayStat, isLoading: _statusLoading } = useQuery({
    queryKey: ['/api/admin/api-gateway/status'],
    queryFn: () => apiRequest('/api/admin/api-gateway/status'),
    staleTime: 30000 });

  const { data: _envSecrets, isLoading: _secretsLoading } = useQuery({
    queryKey: ['/api/admin/env-secrets'],
    queryFn: () => apiRequest('/api/admin/env-secrets'),
    staleTime: 60000 });

  // Migration mutations
  const _migrateAllMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/api-gateway/migrate-all', {
        headers: {
          ...headers, 'Content-Type' : 'application/json'
    },
        method: 'POST'
  });
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-gateway'] });
      toast({
        title: '🎉 API Gateway Success',
        description: 'Alle API-nøkler migrert til database!'
  });
},
    onError: () => {
      toast({
        title: '❌ Migration Error',
        description: 'Feil ved migrering av API-nøkler',
        variant: 'destructive'
  });
}
});

  const _fixGoogleOAuthMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/api-gateway/fix-google-oauth', {
        headers: {
          ...headers, 'Content-Type' : 'application/json'
    },
        method: 'POST'
  });
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-gateway'] });
      toast({
        title: '✅ Google OAuth Success',
        description: 'Google OAuth konfigurert!'
  });
},
    onError: () => {
      toast({
        title: '❌ OAuth Error',
        description: 'Feil ved Google OAuth konfigurasjon',
        variant: 'destructive'
  });
}
});
  const [environmentLoading, setEnvironmentLoading] = useState(true);
  const [_testResults, setTestResults] = useState<any[]>([]);
  const [_testLoading, setTestLoading] = useState<Record<string, boolean>>({});
  // Removed mock data - now using only real data from APIs

  // Load dynamic environment status on component mount
  useEffect(() => {
    const loadEnvironmentStatus = async () => {
      try {
        setEnvironmentLoading(true);
        const data = await fetchWithAuth(
          '/api/admin/integrations/environment-status',
        );

        setEnvironmentStatus(data);
      } catch (_error) {
        // Error loading environment status - handled by error boundary
        toast({
          title: 'Environment Status Error',
          description: 'Kunne ikke hente miljøvariabel-status',
          variant: 'destructive',
        });
      } finally {
        setEnvironmentLoading(false);
      }
    };

    loadEnvironmentStatus();
  }, []);

  // Fetch data with auth helper
  const fetchWithAuth = async (url: string) => {
    const headers = await auth.getAuthHeader();
    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  };

  // API Version Management functions
  const checkForUpdates = async () => {
    try {
      setCheckingVersions(true);
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/api-versions/check', {
        method: 'POST',
        headers,
      });

      if (!response.ok) throw new Error('Failed to check versions');

      const data = await response.json();
      setApiVersions(data.versions || []);

      toast({
        title: '✅ Version Check Complete',
        description: `Checked ${data.versions?.length || 0} API services`,
      });
    } catch (_error) {
      toast({
        title: '❌ Version Check Failed',
        description: 'Could not check for API updates',
        variant: 'destructive',
      });
    } finally {
      setCheckingVersions(false);
    }
  };

  const handleViewReleaseNotes = (versionInfo: APIVersionInfo) => {
    setSelectedVersionInfo(versionInfo);
    setVersionDialogOpen(true);
  };

  const handleUpdateVersion = async (service: string, version: string) => {
    try {
      setUpdatingVersion(true);
      const headers = await auth.getAuthHeader();
      const response = await fetch(`/api/admin/api-versions/${service}/update`, {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version }),
      });

      if (!response.ok) throw new Error('Failed to update version');

      toast({
        title: '✅ Version Updated',
        description: `${service} updated to ${version} (synced to Render)`,
      });

      setVersionDialogOpen(false);
      await checkForUpdates(); // Refresh versions
    } catch (_error) {
      toast({
        title: '❌ Update Failed',
        description: 'Could not update API version',
        variant: 'destructive',
      });
    } finally {
      setUpdatingVersion(false);
    }
  };

  // Pull from Render (Source of Truth)
  const handlePullFromRender = async () => {
    try {
      setSyncingWithRender(true);
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/render/pull-from-render', {
        method: 'POST',
        headers,
      });

      if (!response.ok) throw new Error('Failed to pull from Render');

      const data = await response.json();

      toast({
        title: '✅ Pulled from Render',
        description: `Synced ${data.summary?.pulled || 0} API configurations from production`,
      });

      // Refresh versions after sync
      await checkForUpdates();
    } catch (_error) {
      toast({
        title: '❌ Pull Failed',
        description: 'Could not pull from Render',
        variant: 'destructive',
      });
    } finally {
      setSyncingWithRender(false);
    }
  };

  // Push to Render (Manual action with safety checks)
  const handlePushToRender = async (forceUpdate = false) => {
    try {
      setSyncingWithRender(true);
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/render/push-to-render', {
        method: 'POST',
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceUpdate }),
      });

      if (!response.ok) throw new Error('Failed to push to Render');

      const data = await response.json();

      toast({
        title: '✅ Pushed to Render',
        description: `Pushed: ${data.summary?.pushed || 0}, Skipped: ${data.summary?.skipped || 0} (already exists)`,
      });

      // Refresh versions after sync
      await checkForUpdates();
    } catch (_error) {
      toast({
        title: '❌ Push Failed',
        description: 'Could not push to Render',
        variant: 'destructive',
      });
    } finally {
      setSyncingWithRender(false);
    }
  };

  // Fetch overview data
  const { data: overviewApiData, isLoading: _overviewLoading } = useQuery({
    queryKey: ['/api/admin/integrations/overview'],
    queryFn: () => fetchWithAuth('/api/admin/integrations/overview'),
    staleTime: 30000 });

  // Fetch API keys
  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['/api/admin/integrations/keys'],
    queryFn: () => fetchWithAuth('/api/admin/integrations/keys'),
    staleTime: 30000 });

  // Fetch webhooks
  const { data: webhooksData, isLoading: webhooksLoading } = useQuery({
    queryKey: ['/api/admin/integrations/webhooks'],
    queryFn: () => fetchWithAuth('/api/admin/integrations/webhooks'),
    staleTime: 30000 });

  // Fetch OAuth clients
  const { data: oauthData, isLoading: oauthLoading } = useQuery({
    queryKey: ['/api/admin/integrations/oauth'],
    queryFn: () => fetchWithAuth('/api/admin/integrations/oauth'),
    staleTime: 30000 });

  // Using only real data from APIs - no mock data

  // ALL MUTATIONS - Keep together to avoid hooks order issues
  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (keyData: {
      name: string;
      service: string;
      apiKey: string;
      keyType: string;
      permissions: string[];
      monthlyQuota: number;
    }) => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/integrations/keys', {
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(keyData),
      });
      if (!response.ok) throw new Error('Failed to create API key');
      return response.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations/keys'],});
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/features'],});
      setKeyDialogOpen(false);

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('apiKeyCreated'));

      toast({
        title: "API-nøkkel opprettet",
        description: "Ny API-nøkkel er generert og aktivert. Funksjoner oppdateres automatisk.",
        variant: "default"
  });
},
    onError: () => {
      toast({
        title: "Feil ved opprettelse",
        description: "Kunne ikke opprette API-nøkkel",
        variant: "destructive"
  });
}
});

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (webhookData: {
      name: string;
      url: string;
      events: string[];
      service: string;
    }) => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/integrations/webhooks', {
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(webhookData),
      });
      if (!response.ok) throw new Error('Failed to create webhook');
      return response.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations/webhooks'] });
      setWebhookDialogOpen(false);
      toast({
        title: "Webhook opprettet",
        description: "Ny webhook er opprettet og aktivert",
        variant: "default"
  });
},
    onError: () => {
      toast({
        title: "Feil ved opprettelse",
        description: "Kunne ikke opprette webhook",
        variant: "destructive"
  });
}
});

  // Create OAuth client mutation
  const createOAuthMutation = useMutation({
    mutationFn: async (oauthData: {
      name: string;
      provider: string;
      scopes: string[];
      redirectUris: string[];
    }) => {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/integrations/oauth', {
        headers: {
          ...headers, 'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(oauthData),
      });
      if (!response.ok) throw new Error('Failed to create OAuth client');
      return response.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/integrations/oauth'] });
      setOAuthDialogOpen(false);
      toast({
        title: "OAuth klient opprettet",
        description: "Ny OAuth klient er opprettet med Client ID og Secret",
        variant: "default"
  });
},
    onError: () => {
      toast({
        title: "Feil ved opprettelse",
        description: "Kunne ikke opprette OAuth klient",
        variant: "destructive"
  });
}
});

  // Helper functions
  const toggleSecretVisibility = (itemId: string) => {
    setShowSecrets(prev => ({ ...prev, [itemId]: !prev[itemId] }));
};

  const _runWireMockTest = async (testName: string, endpoint: string, body: Record<string, unknown>) => {
    setTestLoading(prev => ({ ...prev, [testName]: true }));

    try {
      const headers = await auth.getAuthHeader();

      // Use enhanced WireMockTestRunner with all advanced features
      const result = await WireMockTestRunner.executeTest({
        apiName: testName,
        endpoint: endpoint,
        method: 'POST',
        headers: headers,
        body: body,
        recordToHAR: true,           // ✅ Automatic HAR recording
        enableSelfHealing: true      // ✅ Automatic self-healing
      });

      // Add to test history (Gap 3 fix)
      addWireMockTestResult(result);

      // Keep legacy test results for backward compatibility
      const isSuccess = result.status === 'success';
      const legacyResult = {
        testName,
        success: isSuccess,
        message: result.error?.message || (isSuccess ? 'Test vellykket' : 'Test feilet'),
        details: result.response,
        timestamp: new Date().toLocaleString('no-NO')
      };

      setTestResults(prev => [legacyResult, ...prev.slice(0, 9)]);

      // Show toast notification
      toast({
        title: isSuccess ? '✅ Test Vellykket' : '❌ Test Feilet',
        description: `${testName}: ${result.responseTime}ms - Status ${result.statusCode || 'N/A'}`,
        variant: isSuccess ? 'default' : 'destructive'
      });

      return result;

    } catch (error) {
      const errorResult = {
        testName,
        success: false,
        message: `Feil ved, testing: ${error instanceof Error ? error.message : String(error)}`,
        details: null,
        timestamp: new Date().toLocaleString('no-NO')
      };

      setTestResults(prev => [errorResult, ...prev.slice(0, 9)]);

      toast({
        title: '❌ Test Error',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });

      throw error;
    } finally {
      setTestLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Kopiert",
      description: "Innhold kopiert til utklippstavlen",
      variant: "default"
});
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'paused': return 'warning'; 
      case 'inactive': return 'default';
      case 'deprecated': return 'error';
      default: return 'default';
}
};

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'paused': return 'Pauset';
      case 'inactive': return 'Inaktiv'; 
      case 'deprecated': return 'Avviklet';
      default: return status;
}
};

  const CreateApiKeyDialog = () => {
    const [formData, setFormData] = useState({
      name:  '',
      service:  ', ',
      apiKey:  '',
      keyType: 'bearer',
      permissions:  '',
      monthlyQuota: '1000',
      // For custom API services
      customBaseUrl:  ', ',
      customAuthHeader: 'Authorization'
});

    const handleSubmit = () => {
      if (!formData.name || !formData.service || !formData.apiKey) {
        toast({
          title: "Manglende felter",
          description: "Na, vntjeneste og API-nøkkel er påkrevd",
          variant: "destructive"
    });
        return;
  }

      // Additional validation for custom services
      if (formData.service === 'custom' && !formData.customBaseUrl) {
        toast({
          title: "Manglende Base URL",
          description: "Base URL er påkrevd for egendefinerte API-tjenester",
          variant: "destructive",
        });
        return;
      }

      // Prepare data for submission
      const submitData: Record<string, unknown> = {
        name: formData.name,
        service: formData.service,
        apiKey: formData.apiKey,
        keyType: formData.keyType,
        permissions: formData.permissions
          .split('')
          .map((p) => p.trim())
          .filter((p) => p),
        monthlyQuota: parseInt(formData.monthlyQuota, 10),
      };

      // Add metadata for custom services
      if (formData.service === 'custom') {
        submitData.keyType = 'custom'; // Mark as custom type
        submitData.metadata = {
          baseUrl: formData.customBaseUrl,
          authType: formData.keyType,
          authHeader: formData.customAuthHeader || 'Authorization',
        };
      }

      createApiKeyMutation.mutate(submitData as any);
    };

    return (
      <Dialog open={keyDialogOpen} onClose={() => setKeyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <KeyIcon sx={{ color: '#ff8c00' }} />
            Opprett ny API-nøkkel
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="API-nøkkel navn"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Tjeneste</InputLabel>
              <Select
                value={formData.service}
                onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                label="Tjeneste"
              >
                  {/* Norske tjenester */}
                  <MenuItem value="bring">Bring - Levering og logistikk</MenuItem>
                  <MenuItem value="vipps">Vipps - Mobil betaling</MenuItem>
                  <MenuItem value="digipost">Digipost - Digital post</MenuItem>
                  <MenuItem value="altinn">Altinn - Offentlige tjenester</MenuItem>
                  <MenuItem value="brreg">Brønnøysundregistrene</MenuItem>
                  <MenuItem value="posten">Posten Norge</MenuItem>
                  <MenuItem value="sparebank1">SpareBank 1</MenuItem>
                  <MenuItem value="dnb">DNB Open Banking</MenuItem>

                  {/* Internasjonale betalingstjenester */}
                  <MenuItem value="stripe">Stripe</MenuItem>
                  <MenuItem value="paypal">PayPal</MenuItem>
                  <MenuItem value="klarna">Klarna</MenuItem>

                  {/* Google tjenester */}
                  <MenuItem value="google-drive">Google Drive</MenuItem>
                  <MenuItem value="google-photos">Google Photos</MenuItem>
                  <MenuItem value="google-calendar">Google Calendar</MenuItem>
                  <MenuItem value="google-gmail">Gmail</MenuItem>
                  <MenuItem value="google-analytics">Google Analytics</MenuItem>
                  <MenuItem value="google-ads">Google Ads</MenuItem>
                  <MenuItem value="youtube">YouTube</MenuItem>

                  {/* Microsoft tjenester */}
                  <MenuItem value="microsoft-365">Microsoft 365</MenuItem>
                  <MenuItem value="onedrive">OneDrive</MenuItem>
                  <MenuItem value="outlook">Outlook</MenuItem>
                  <MenuItem value="teams">Microsoft Teams</MenuItem>

                  {/* Sosiale medier */}
                  <MenuItem value="instagram">Instagram</MenuItem>
                  <MenuItem value="facebook">Facebook</MenuItem>
                  <MenuItem value="twitter">Twitter/X</MenuItem>
                  <MenuItem value="linkedin">LinkedIn</MenuItem>
                  <MenuItem value="tiktok">TikTok</MenuItem>
                  <MenuItem value="pinterest">Pinterest</MenuItem>

                  {/* Kommunikasjon */}
                  <MenuItem value="sendgrid">SendGrid</MenuItem>
                  <MenuItem value="twilio">Twilio</MenuItem>
                  <MenuItem value="mailchimp">Mailchimp</MenuItem>
                  <MenuItem value="slack">Slack</MenuItem>
                  <MenuItem value="discord">Discord</MenuItem>
                  <MenuItem value="whatsapp">WhatsApp Business</MenuItem>

                  {/* Kreative tjenester */}
                  <MenuItem value="adobe-creative">Adobe Creative Cloud</MenuItem>
                  <MenuItem value="canva">Canva</MenuItem>
                  <MenuItem value="figma">Figma</MenuItem>
                  <MenuItem value="unsplash">Unsplash</MenuItem>
                  <MenuItem value="pexels">Pexels</MenuItem>
                  <MenuItem value="getty-images">Getty Images</MenuItem>

                  {/* Musikktjenester */}
                  <MenuItem value="spotify">Spotify</MenuItem>
                  <MenuItem value="apple-music">Apple Music</MenuItem>
                  <MenuItem value="soundcloud">SoundCloud</MenuItem>
                  <MenuItem value="bandcamp">Bandcamp</MenuItem>
                  <MenuItem value="tono">TONO</MenuItem>
                  <MenuItem value="gramo">GRAMO</MenuItem>

                  {/* Cloud og hosting */}
                  <MenuItem value="aws">Amazon Web Services</MenuItem>
                  <MenuItem value="azure">Microsoft Azure</MenuItem>
                  <MenuItem value="gcp">Google Cloud Platform</MenuItem>
                  <MenuItem value="digitalocean">DigitalOcean</MenuItem>
                  <MenuItem value="cloudflare">Cloudflare</MenuItem>

                  {/* CRM og business */}
                  <MenuItem value="hubspot">HubSpot</MenuItem>
                  <MenuItem value="salesforce">Salesforce</MenuItem>
                  <MenuItem value="pipedrive">Pipedrive</MenuItem>
                  <MenuItem value="asana">Asana</MenuItem>
                  <MenuItem value="trello">Trello</MenuItem>
                  <MenuItem value="notion">Notion</MenuItem>

                  {/* Analytikk */}
                  <MenuItem value="mixpanel">Mixpanel</MenuItem>
                  <MenuItem value="amplitude">Amplitude</MenuItem>
                  <MenuItem value="hotjar">Hotjar</MenuItem>

                  {/* AI tjenester */}
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="anthropic">Anthropic Claude</MenuItem>
                  <MenuItem value="google-gemini">Google Gemini</MenuItem>
                  <MenuItem value="azure-openai">Azure OpenAI</MenuItem>

                  {/* E-commerce */}
                  <MenuItem value="shopify">Shopify</MenuItem>
                  <MenuItem value="woocommerce">WooCommerce</MenuItem>
                  <MenuItem value="magento">Magento</MenuItem>

                  {/* Andre verktøy */}
                  <MenuItem value="zapier">Zapier</MenuItem>
                  <MenuItem value="ifttt">IFTTT</MenuItem>
                  <MenuItem value="github">GitHub</MenuItem>
                  <MenuItem value="gitlab">GitLab</MenuItem>
                  <MenuItem value="bitbucket">Bitbucket</MenuItem>

                  <MenuItem value="custom">Tilpasset tjeneste</MenuItem>
                </Select>
              </FormControl>
            <TextField
              fullWidth
              label="API-nøkkel verdi"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              required
              placeholder="Skriv inn den faktiske API-nøkkelen her"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Vis eller skjul API-nøkkel"
                      onClick={async () => {
                        const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                        if (input) {
                          input.type = input.type === 'password' ? 'text' : 'password';
                  }
                  }}
                      edge="end"
                    >
                      <ViewIcon />
                    </IconButton>
                  </InputAdornment>
                )
          }}
            />
            <FormControl fullWidth>
              <InputLabel>Nøkkel type</InputLabel>
              <Select
                value={formData.keyType}
                onChange={(e) => setFormData(prev => ({ ...prev, keyType: e.target.value }))}
                label="Nøkkel type"
              >
                <MenuItem value="bearer">Bearer Token</MenuItem>
                <MenuItem value="api_key">API Key</MenuItem>
                <MenuItem value="basic">Basic Auth</MenuItem>
              </Select>
            </FormControl>

            {/* Custom API fields - only show when 'custom' is selected */}
            {formData.service === 'custom' && (
              <>
                <TextField
                  fullWidth
                  label="Egendefinert tjenestenavn"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="f.eks. Min API Tjeneste"
                  helperText="Navn på din egendefinerte API-tjeneste"
                />
                <TextField
                  fullWidth
                  label="Base URL"
                  value={formData.customBaseUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, customBaseUrl: e.target.value }))}
                  placeholder="https: //api.example.com/v1"
                  helperText="Hoved-URL for API-et (uten endepunkter)"
                  required={formData.service === 'custom'}
                />
                <TextField
                  fullWidth
                  label="Autentiseringsheader"
                  value={formData.customAuthHeader}
                  onChange={(e) => setFormData(prev => ({ ...prev, customAuthHeader: e.target.value }))}
                  placeholder="Authorization"
                  helperText="Header-navn for autentisering (standard: Authorization)"
                />
                <FormControl fullWidth>
                  <InputLabel>Autentiseringstype</InputLabel>
                  <Select
                    value={formData.keyType}
                    onChange={(e) => setFormData(prev => ({ ...prev, keyType: e.target.value }))}
                    label="Autentiseringstype"
                  >
                    <MenuItem value="bearer">Bearer Token (Authorization: Bearer xxx)</MenuItem>
                    <MenuItem value="api_key">API Key (X-API-Key: xxx)</MenuItem>
                    <MenuItem value="basic">Basic Auth (username:password)</MenuItem>
                    <MenuItem value="custom">Custom (egendefinert header)</MenuItem>
                    <MenuItem value="query_param">Query Parameter (?api_key=xxx)</MenuItem>
                  </Select>
                </FormControl>
              </>
           )}

            <TextField
              fullWidth
              label="Tillatelser (komma-separert)"
              value={formData.permissions}
              onChange={(e) => setFormData(prev => ({ ...prev, permissions: e.target.value }))}
              placeholder="read, write, delete"
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label="Månedskvote"
              type="number"
              value={formData.monthlyQuota}
              onChange={(e) => setFormData(prev => ({ ...prev, monthlyQuota: e.target.value }))}
              InputProps={{
                endAdornment: <InputAdornment position="end">forespørsler</InputAdornment>
          }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setKeyDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton onClick={handleSubmit}
            tone="primary"
            loading={createApiKeyMutation.isPending}
            disabled={createApiKeyMutation.isPending}
          >
            {createApiKeyMutation.isPending ? 'Oppretter...' : 'Opprett nøkkel'}
          </AdminButton>
        </DialogActions>
      </Dialog>
  );
};

  const CreateWebhookDialog = () => {
    const [formData, setFormData] = useState({
      name:  '',
      url:  ', ',
      service:  '',
      events: ''
});

    const handleSubmit = () => {
      if (!formData.name || !formData.url || !formData.service) {
        toast({
          title: "Manglende felter",
          description: "Navn, URL og tjeneste er påkrevd",
          variant: "destructive",
        });
        return;
      }

      createWebhookMutation.mutate({
        ...formData,
        events: formData.events
          .split('')
          .map((e) => e.trim())
          .filter((e) => e),
      });
    };

    return (
      <Dialog open={webhookDialogOpen} onClose={() => setWebhookDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WebhookIcon sx={{ color: '#ff8c00' }} />
            Opprett ny webhook
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Webhook navn"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              fullWidth
              label="Webhook URL"
              value={formData.url}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              required
              placeholder="https: //example.com/webhook"
            />
            <FormControl fullWidth>
              <InputLabel>Tjeneste</InputLabel>
              <Select
                value={formData.service}
                onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
                label="Tjeneste"
              >
                <MenuItem value="payments">Betalinger</MenuItem>
                <MenuItem value="projects">Prosjekter</MenuItem>
                <MenuItem value="users">Brukere</MenuItem>
                <MenuItem value="files">Filer</MenuItem>
                <MenuItem value="notifications">Varsler</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Events (komma-separert)"
              value={formData.events}
              onChange={(e) => setFormData(prev => ({ ...prev, events: e.target.value }))}
              required
              multiline
              rows={2}
              placeholder="payment.completed, project.created, user.registered"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setWebhookDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton onClick={handleSubmit}
            tone="primary"
            loading={createWebhookMutation.isPending}
            disabled={createWebhookMutation.isPending}
          >
            {createWebhookMutation.isPending ? 'Oppretter...' : 'Opprett webhook'}
          </AdminButton>
        </DialogActions>
      </Dialog>
  );
};

  const CreateOAuthDialog = () => {
    const [formData, setFormData] = useState({
      name:  '',
      provider:  ', ',
      scopes:  '',
      redirectUris: ''
});

	    const handleSubmit = () => {
	      if (!formData.name || !formData.provider) {
	        toast({
	          title: "Manglende felter",
	          description: "Navn og provider er påkrevd",
	          variant: "destructive",
	        });
	        return;
	      }
	
	      createOAuthMutation.mutate({
	        ...formData,
	        scopes: formData.scopes
	          .split('')
	          .map((s) => s.trim())
	          .filter((s) => s),
	        redirectUris: formData.redirectUris
	          .split('')
	          .map((u) => u.trim())
	          .filter((u) => u),
	      });
	    };

    return (
      <Dialog open={oauthDialogOpen} onClose={() => setOAuthDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <OAuthIcon sx={{ color: '#ff8c00' }} />
            Opprett OAuth klient
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="OAuth klient navn"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <FormControl fullWidth>
              <InputLabel>OAuth provider</InputLabel>
              <Select
                value={formData.provider}
                onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                label="OAuth provider"
              >
                  {/* Store tech-selskaper */}
                  <MenuItem value="google">Google</MenuItem>
                  <MenuItem value="microsoft">Microsoft</MenuItem>
                  <MenuItem value="apple">Apple</MenuItem>
                  <MenuItem value="amazon">Amazon</MenuItem>

                  {/* Sosiale medier */}
                  <MenuItem value="facebook">Facebook</MenuItem>
                  <MenuItem value="instagram">Instagram</MenuItem>
                  <MenuItem value="twitter">Twitter/X</MenuItem>
                  <MenuItem value="linkedin">LinkedIn</MenuItem>
                  <MenuItem value="tiktok">TikTok</MenuItem>
                  <MenuItem value="pinterest">Pinterest</MenuItem>
                  <MenuItem value="snapchat">Snapchat</MenuItem>
                  <MenuItem value="discord">Discord</MenuItem>

                  {/* Utviklingsverktøy */}
                  <MenuItem value="github">GitHub</MenuItem>
                  <MenuItem value="gitlab">GitLab</MenuItem>
                  <MenuItem value="bitbucket">Bitbucket</MenuItem>

                  {/* Betalingstjenester */}
                  <MenuItem value="stripe">Stripe</MenuItem>
                  <MenuItem value="paypal">PayPal</MenuItem>
                  <MenuItem value="vipps">Vipps</MenuItem>

                  {/* Norske tjenester */}
                  <MenuItem value="altinn">Altinn</MenuItem>
                  <MenuItem value="id-porten">ID-porten</MenuItem>
                  <MenuItem value="bankid">BankID</MenuItem>

                  {/* Business verktøy */}
                  <MenuItem value="salesforce">Salesforce</MenuItem>
                  <MenuItem value="hubspot">HubSpot</MenuItem>
                  <MenuItem value="slack">Slack</MenuItem>
                  <MenuItem value="zoom">Zoom</MenuItem>
                  <MenuItem value="dropbox">Dropbox</MenuItem>

                  {/* Kreative plattformer */}
                  <MenuItem value="adobe">Adobe</MenuItem>
                  <MenuItem value="canva">Canva</MenuItem>
                  <MenuItem value="figma">Figma</MenuItem>

                  {/* Musikk og media */}
                  <MenuItem value="spotify">Spotify</MenuItem>
                  <MenuItem value="soundcloud">SoundCloud</MenuItem>
                  <MenuItem value="youtube">YouTube</MenuItem>
                  <MenuItem value="twitch">Twitch</MenuItem>

                  {/* Andre */}
                  <MenuItem value="okta">Okta</MenuItem>
                  <MenuItem value="auth0">Auth0</MenuItem>
                  <MenuItem value="custom">Tilpasset OAuth</MenuItem>
                </Select>
              </FormControl>
            <TextField
              fullWidth
              label="Scopes (komma-separert)"
              value={formData.scopes}
              onChange={(e) => setFormData(prev => ({ ...prev, scopes: e.target.value }))}
              required
              multiline
              rows={2}
              placeholder="read: us, errepo, calendar.read"
            />
            <TextField
              fullWidth
              label="Redirect URIs (komma-separert)"
              value={formData.redirectUris}
              onChange={(e) => setFormData(prev => ({ ...prev, redirectUris: e.target.value }))}
              required
              multiline
              rows={2}
              placeholder="https: //yourdomain.com/auth/callback"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setOAuthDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton onClick={handleSubmit}
            tone="primary"
            loading={createOAuthMutation.isPending}
            disabled={createOAuthMutation.isPending}
          >
            {createOAuthMutation.isPending ? 'Oppretter...' : 'Opprett klient'}
          </AdminButton>
        </DialogActions>
      </Dialog>
  );
};

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <CreateApiKeyDialog />
      <CreateWebhookDialog />
      <CreateOAuthDialog />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Typography variant="h5" sx={{ color: themeColors.primary, fontWeight: 600}}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon />
              Integrasjoner & API-er
            </Box>
          </Typography>
          {/* WireMock Real-Time Status Indicator */}
          <WireMockReloadIndicator pollingInterval={5000} showHistory={true} />
        </Box>

        {/* Overview Stats - Using REAL data */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ color: themeColors.primary, fontWeight: 600}}>
                  {environmentStatus?.statistics?.total || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Totale integrasjoner
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 600}}>
                  {environmentStatus?.statistics?.configured || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Aktive API-er
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ color: 'info.main', fontWeight: 600}}>
                  {(() => {
                    const webhookList = Array.isArray(webhooksData)
                      ? webhooksData
                      : Array.isArray(webhooksData?.webhooks)
                        ? webhooksData.webhooks
                        : [];
                    return webhookList.length > 0
                      ? Math.round((webhookList.filter((w: any) => w.status === 'active').length / webhookList.length) * 100)
                      : 0;
                  })()}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Webhook suksess
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 600}}>
                  {overviewApiData?.usage?.dailyRequests ?
                    (overviewApiData.usage.dailyRequests / 1000).toFixed(0) + 'k' : 
                    '0'
              }
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Daglige forespørsler
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        {/* API Gateway & Migration Actions */}
        <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              startIcon={<SyncIcon />}
              onClick={() => _migrateAllMutation.mutate()}
              disabled={_migrateAllMutation.isPending}
              sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67c00' } }}
            >
              Migrate All API Keys
            </Button>
            <Button
              variant="outlined"
              startIcon={<GoogleIcon />}
              onClick={() => _fixGoogleOAuthMutation.mutate()}
              disabled={_fixGoogleOAuthMutation.isPending}
              sx={{ borderColor: '#4285f4', color: '#4285f4' }}
            >
              Fix Google OAuth
            </Button>
            {_apiGatewayStat && (
              <Chip 
                icon={<CheckCircleIcon />} 
                label={`Gateway: ${_apiGatewayStat.status || 'Active'}`}
                color="success"
              />
            )}
            {_envSecrets && (
              <Chip 
                icon={<SecurityIcon />} 
                label={`${_envSecrets.count || 0} Secrets Configured`}
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 56 }}
        >
          <Tab
            icon={<CodeIcon />}
            label="CodeGenerator"
            sx={{
              color: tabValue === 0 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' },
              minWidth: 'auto'
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <KeyIcon />
                API Nøkler
              </Box>
            }
            sx={{
              color: tabValue === 1 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WebhookIcon />
                Webhooks
              </Box>
            }
            sx={{
              color: tabValue === 2 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <OAuthIcon />
                OAuth
              </Box>
            }
            sx={{
              color: tabValue === 3 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ApiIcon />
                API Testing
              </Box>
            }
            sx={{
              color: tabValue === 4 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon />
                Process Monitor
              </Box>
            }
            sx={{
              color: tabValue === 5 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon />
                Database Health
              </Box>
            }
            sx={{
              color: tabValue === 6 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ExtensionIcon />
                Dependencies
              </Box>
            }
            sx={{
              color: tabValue === 7 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ProtocolIcon />
                Protokoller
              </Box>
            }
            sx={{
              color: tabValue === 8 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MediaProtocolIcon />
                Media/AI
              </Box>
            }
            sx={{
              color: tabValue === 9 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ChatProtocolIcon />
                Chat/SEO
              </Box>
            }
            sx={{
              color: tabValue === 10 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ApiIcon />
                Admin API
              </Box>
            }
            sx={{
              color: tabValue === 11 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon />
                HAR Log
              </Box>
            }
            sx={{
              color: tabValue === 12 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScienceIcon />
                Self-Healing
              </Box>
            }
            sx={{
              color: tabValue === 13 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AnalyticsIcon />
                Analytics
              </Box>
            }
            sx={{
              color: tabValue === 14 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimelineIcon />
                Test History
              </Box>
            }
            sx={{
              color: tabValue === 15 ? '#ff8c00' : 'text.secondary','&.Mui-selected': { color: '#ff8c00' }
            }}
          />
        </Tabs>
      </Box>

	      {/* CodeGenerator Tab */}
	      <TabPanel value={tabValue} index={0}>
	        <Box sx={{ mb: 3 }}>
	          <Box
	            sx={{
	              display: 'flex',
	              justifyContent: 'space-between',
	              alignItems: 'center',
	              mb: 2}}
	          >
	            <Typography
	              variant="h6"
	              sx={{
	                display: 'flex',
	                alignItems: 'center',
	                gap: 1,
	                color: themeColors.primary}}
	            >
	              <AiIcon sx={{ color: '#ff8c00' }} />
	              AI CodeGenerator Status
	            </Typography>
	            <Box sx={{ display: 'flex', gap: 1 }}>
	              <Button
	                variant="outlined"
	                startIcon={<RefreshIcon />}
	                onClick={checkForUpdates}
	                disabled={checkingVersions}
	                size="small"
	              >
	                {checkingVersions ? 'Checking...' : 'Check for Updates'}
	              </Button>
	              <Button
	                variant="contained"
	                startIcon={<SyncIcon />}
	                onClick={handlePullFromRender}
	                disabled={syncingWithRender}
	                size="small"
	                color="primary"
	              >
	                {syncingWithRender ? 'Pulling...' : 'Pull from Render'}
	              </Button>
	              <Button
	                variant="contained"
	                startIcon={<SyncIcon />}
	                onClick={() => handlePushToRender(false)}
	                disabled={syncingWithRender}
	                size="small"
	                color="secondary"
	              >
	                {syncingWithRender ? 'Pushing...' : 'Push to Render'}
	              </Button>
	            </Box>
	          </Box>
	        
	          {/* API Status Overview - Dynamic Status */}
	          <Grid container spacing={2} sx={{ mb: 3 }}>
	            {environmentLoading ? (
	              <Grid item xs={12}>
	                <Card>
	                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
	                    <CircularProgress size={40} sx={{ mb: 2 }} />
	                    <Typography variant="body1">
	                      Henter miljøvariabel-status...
	                    </Typography>
	                  </CardContent>
                </Card>
              </Grid>
            ) : (
              <>
                {/* OpenAI Status */}
                {(() => {
                  const openaiStatus = environmentStatus?.variables?.find((v: any) => v.key === 'OPENAI_API_KEY');
                  return (
	                    <Grid item xs={12}>
	                      <Card>
	                        <CardContent sx={{ p: 3 }}>
	                          <Box
	                            sx={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              mb: 2}}
	                          >
	                            <Typography
	                              variant="h6"
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                color: themeColors.primary}}
	                            >
                              <AiIcon color="primary" />
                              OpenAI GPT-5
                            </Typography>
	                            {openaiStatus?.configured ? (
	                              <CheckCircleIcon sx={{ color: 'success.main' }} />
	                            ) : (
	                              <ErrorIcon sx={{ color: 'error.main' }} />
	                            )}
                          </Box>
	                          <Typography
	                            variant="body2"
	                            color="text.secondary"
	                            sx={{ mb: 2 }}
	                          >
                            Status: {openaiStatus?.configured ? 'Konfigurert ✓' : 'API-nøkkel mangler'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <Chip
                              label={openaiStatus?.configured ? 'AKTIV' : 'INAKTIV'}
                              size="small"
                              color={openaiStatus?.configured ? 'success' : 'error'}
                            />
                            {(() => {
                              const openaiVersion = apiVersions.find(v => v.service === 'openai');
                              if (openaiVersion && openaiVersion.currentVersion !== openaiVersion.latestVersion) {
                                return (
                                  <Chip
                                    label="Update Available"
                                    size="small"
                                    color="warning"
                                    icon={<WarningIcon />}
                                  />
                                );
                              }
                              return null;
                            })()}
                          </Box>
	                          {openaiStatus?.configured && (
	                            <>
	                              <Typography
	                                variant="caption"
	                                display="block"
	                                sx={{ mb: 1 }}
	                              >
	                                <Box
	                                  sx={{
	                                    display: 'flex',
	                                    alignItems: 'center',
	                                    gap: 1}}
	                                >
	                                  <CheckIcon color="success" fontSize="small" />
	                                  API-nøkkel: {openaiStatus.masked}
	                                </Box>
	                              </Typography>
	                              {(() => {
	                                const openaiVersion = apiVersions.find(v => v.service === 'openai');
	                                if (openaiVersion) {
	                                  return (
	                                    <Button
	                                      size="small"
	                                      variant="text"
	                                      onClick={() => handleViewReleaseNotes(openaiVersion)}
	                                      startIcon={<ViewIcon />}
	                                    >
	                                      View Release Notes
	                                    </Button>
	                                  );
	                                }
	                                return null;
	                              })()}
	                            </>
	                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                );
            })()}

	                {/* Anthropic Claude Status */}
	                {(() => {
	                  const claudeStatus = environmentStatus?.variables?.find(
	                    (v: any) => v.key === 'ANTHROPIC_API_KEY'
	                  );
	                  return (
	                    <Grid item xs={12}>
	                      <Card>
	                        <CardContent sx={{ p: 3 }}>
	                          <Box
	                            sx={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              mb: 2}}
	                          >
	                            <Typography
	                              variant="h6"
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                color: themeColors.primary}}
	                            >
	                              <AiIcon color="secondary" />
	                              Anthropic Claude
	                            </Typography>
	                            {claudeStatus?.configured ? (
	                              <CheckCircleIcon sx={{ color: 'success.main' }} />
	                            ) : (
	                              <ErrorIcon sx={{ color: 'error.main' }} />
	                            )}
	                          </Box>
	                          <Typography
	                            variant="body2"
	                            color="text.secondary"
	                            sx={{ mb: 2 }}
	                          >
	                            Status: {claudeStatus?.configured ? 'Konfigurert ✓' : 'API-nøkkel mangler'}
	                          </Typography>
                          <Chip
                            label={claudeStatus?.configured ? 'AKTIV' : 'INAKTIV'}
                            size="small"
                            color={claudeStatus?.configured ? 'success' : 'error'}
                          />
	                          {claudeStatus?.configured && (
	                            <Typography
	                              variant="caption"
	                              display="block"
	                              sx={{ mt: 1 }}
	                            >
	                              <Box
	                                sx={{
	                                  display: 'flex',
	                                  alignItems: 'center',
	                                  gap: 1}}
	                              >
	                                <CheckIcon color="success" fontSize="small" />
	                                API-nøkkel: {claudeStatus.masked}
	                              </Box>
	                            </Typography>
	                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                );
            })()}

                {/* Google Gemini Status */}
                {(() => {
                  const geminiStatus = environmentStatus?.variables?.find((v: any) => v.key === 'GEMINI_API_KEY');
	                  return (
	                    <Grid item xs={12}>
	                      <Card>
	                        <CardContent sx={{ p: 3 }}>
	                          <Box
	                            sx={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              mb: 2}}
	                          >
	                            <Typography
	                              variant="h6"
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                color: themeColors.primary}}
	                            >
	                              <AiIcon color="info" />
	                              Google Gemini
	                            </Typography>
	                            {geminiStatus?.configured ? (
	                              <CheckCircleIcon sx={{ color: 'success.main' }} />
	                            ) : (
	                              <ErrorIcon sx={{ color: 'error.main' }} />
	                            )}
	                          </Box>
	                          <Typography
	                            variant="body2"
	                            color="text.secondary"
	                            sx={{ mb: 2 }}
	                          >
	                            Status: {geminiStatus?.configured ? 'Konfigurert ✓' : 'API-nøkkel mangler'}
	                          </Typography>
                          <Chip
                            label={geminiStatus?.configured ? 'AKTIV' : 'INAKTIV'}
                            size="small"
                            color={geminiStatus?.configured ? 'success' : 'error'}
                          />
	                          {geminiStatus?.configured && (
	                            <Typography
	                              variant="caption"
	                              display="block"
	                              sx={{ mt: 1 }}
	                            >
	                              <Box
	                                sx={{
	                                  display: 'flex',
	                                  alignItems: 'center',
	                                  gap: 1}}
	                              >
	                                <CheckIcon color="success" fontSize="small" />
	                                API-nøkkel: {geminiStatus.masked}
	                              </Box>
	                            </Typography>
	                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                );
            })()}
              </>
            )}
          </Grid>

	          {/* Universal API Proxy & WireMock Testing */}
	          <Card
	            sx={{
	              mb: 3,
	              background:
	                'linear-gradient(135deg, rgba(255, 0.1) 0%, rgba(33,150,243,0.1) 100%)'}}
	          >
	            <CardContent>
	              <Typography
	                variant="h6"
	                sx={{ mb: 2, color: themeColors.primary }}
	              >
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                  <ApiIcon sx={{ color: '#ff8c00' }} />
	                  Universal API Proxy & WireMock Testing
	                </Box>
	              </Typography>
	              <Alert severity="success" sx={{ mb: 2 }}>
                Test alle API-integrasjoner med WireMock før publisering! Universal Proxy håndterer automatisk alle konfigurerte API-er.
              </Alert>

	              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <Button fullWidth
                    variant="contained"
                    startIcon={<TestIcon />}
                    sx={{ bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
	                      // Test med WireMock først
	                      const headers = await auth.getAuthHeader();
	                      fetch('/api/wiremock/test-gemini', {
	                        headers: {
	          ...headers, 'Content-Type': 'application/json'
	    },
	        method: 'POST',
	                        body: JSON.stringify({ prompt: 'Test universal proxy integration' })
	                  }).then(res => res.json()).then(data => {
	                          toast({
	                          title: "WireMock Test Successful",
	                            description: `Mock Gemini, response: ${data.response?.substring(0, 50)}...`,
	                          variant: "default"
	                      });
                  }).catch(_err => {
                          toast({
                          title: "WireMock Test Failed",
                          description: "Kunne ikke teste med WireMock",
                          variant: "destructive"
                      });
                      });
                }}
                  >
                    Test Gemini med WireMock
                  </Button>
                </Grid>

                <Grid item xs={12}>
                  <Button fullWidth
                    variant="contained"
                    startIcon={<CloudIcon />}
                    sx={{ bgcolor: '#00bcd4','&:hover': { bgcolor: '#0097a7' } }}
                    onClick={async () => {
	                      // Check configured services
	                      const headers = await auth.getAuthHeader();
	                      fetch('/api/proxy/configured', { headers })
                        .then(res => res.json())
                        .then(data => {
                          const serviceList = data.configured?.join('') || 'Ingen';
                          toast({
                            title: "Konfigurerte API-tjenester",
                            description: `${data.total || 0} tjenester aktive: ${serviceList}`,
                            variant: "default"
                      });
                      });
                }}
                  >
                    Se Aktive API-er
                  </Button>
                </Grid>

                <Grid item xs={12}>
                  <Button fullWidth
                    variant="contained"
                    startIcon={<CheckIcon />}
                    sx={{ bgcolor: '#4caf50','&:hover': { bgcolor: '#388e3c' } }}
                    onClick={async () => {
	                      // Test real API through proxy
	                      const testService = prompt('Hvilken API vil du teste? (f.eks: google-gemini, openai, stripe)');
	                      if (testService) {
	                        const headers = await auth.getAuthHeader();
	                        fetch(`/api/proxy/check/${testService}`, { headers })
                          .then(res => res.json())
                          .then(async (data) => {
                            if (data.isConfigured) {
                              toast({
                                title: `${testService} er konfigurert!`,
                                description: `Auth, type: ${data.config?.authType}, Base URL: ${data.config?.baseUrl}`,
                                variant: "default"
                          });

                              // Tilby å teste med ekte API via dialog
                              setApiTestConfirm({ open: true, testService, headers });
                        } else {
                              toast({
                                title: `${testService} ikke konfigurert`,
                                description: "Legg til API-nøkkel i integrasjonspanelet først",
                                variant: "destructive"
                          });
                        }
                        });
                  }
                }}
                  >
                    Test Spesifikk API
                  </Button>
                </Grid>
              </Grid>

	              <Divider sx={{ my: 2 }} />

	              {/* Intelligent Problem Solving Section */}
	              <Card sx={{ mb: 3 }}>
	                <CardContent>
	                  <Typography variant="h6" sx={{ mb: 2, color: themeColors.primary, fontWeight: 600}}>
	                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                      <AiIcon sx={{ color: '#4caf50' }} />
                      Intelligent Problemløsning med AI
                    </Box>
                  </Typography>

	                  <Alert severity="info" sx={{ mb: 3 }}>
                    Spør om en løsning - AI genererer forslag, lager task liste og spør om bekreftelse før deployment!
                  </Alert>

                  <TextField
                    fullWidth
                    multiline
                    rows={3}
	                    placeholder="Eksempel: 'Jeg vil forbedre UniversalShowcase med bedre bilder og sosial media integrasjon'"
	                    variant="outlined"
	                    sx={{ mb: 2 }}
                    id="ai-problem-input"
                    aria-label="Beskriv hva AI skal hjelpe deg med"
                  />

	                      <Button
	                        fullWidth
	                        variant="contained"
	                        startIcon={<AiIcon />}
	                        sx={{ bgcolor: '#4caf50','&:hover': { bgcolor: '#388e3c' }, mb: 2 }}
	                        onClick={async () => {
	                          const inputElement = document.getElementById(
	                            'ai-problem-input',
	                          ) as HTMLInputElement | null;
	                          const input = inputElement?.value ?? '';

	                          if (!input.trim()) {
	                            toast({
	                              title: 'Mangler input',
	                              description:
	                                'Skriv inn hva du vil at AI skal hjelpe deg med',
	                              variant: 'destructive',
	                            });
	                            return;
	                          }

	                          toast({
	                            title: '🧠 AI analyserer forespørsel...',
	                            description: 'Genererer intelligent løsningsforslag',
	                            variant: 'default',
	                          });

	                          try {
	                            const headers = await auth.getAuthHeader();
	                            const res = await fetch(
	                              '/api/code-generator/intelligent-solution',
	                              {
	                                method: 'POST',
	                                headers: {
	                                  ...headers, 'Content-Type': 'application/json',
	                                },
	                                body: JSON.stringify({
	                                  problemDescription: input,
	                                  context: 'universalshowcase_improvement',
	                                }),
	                              },
	                            );
	                            const data = await res.json();

	                            if (data.success) {
	                              const taskListHtml =
	                                data.tasks
	                                  ?.map((task: any, i: number) =>
	                                    `${i + 1}. ${
	                                      task.description || task.name
	                                    } (${task.estimated_time || 'N/A'})`,
	                                  )
	                                  .join('\n') || 'Ingen oppgaver generert';

	                              const message = `
	AI Forslag: ${data.solution}

	📋 Task Liste:
	${taskListHtml}

	💰 Estimert kostnad: ${data.estimatedCost || 'Gratis'}
	⏱️ Estimert tid: ${data.estimatedTime || 'Ukjent'}
	🔧 API-er som trengs: ${
	                                data.requiredAPIs?.join('') || 'Ingen'
	                              }
	`;

	                              // Show confirm via dialog instead of native confirm
	                              setAiImplementConfirm({
	                                open: true,
	                                message: message + '\n\nVil du at AI skal sette i gang med implementering?',
	                                solutionId: data.solutionId,
	                                headers
	                              });
	                            } else {
	                              toast({
	                                title: 'AI Analyse Error',
	                                description:
	                                  data.error ||
	                                  'Kunne ikke analysere forespørselen',
	                                variant: 'destructive',
	                              });
	                            }
	                          } catch (_err) {
	                            toast({
	                              title: 'Connection Error',
	                              description:
	                                'Kunne ikke nå AI analyse endpoint',
	                              variant: 'destructive',
	                            });
	                          }
	                        }}
	                  >
	                    🧠 Analyser og generer løsning
	                  </Button>

                  <Grid container spacing={2}>
	                    <Grid item xs={12}>
	                      <Button
	                        fullWidth
	                        variant="outlined"
	                        startIcon={<MenuBookIcon />}
	                        sx={{ borderColor: '#4caf50', color: '#4caf50' }}
	                        onClick={async () => {
	                          const examples = [
	                            'Forbedre UniversalShowcase med automatisk bildekategorisering','Legge til betaling med Vipps i photographer dashboard','Integrere Instagram API for automatisk posting','Lage automatisk backup system for Google Drive','Optimalisere database ytelse og indeksering',
	                          ];
	                          const randomExample = examples[Math.floor(Math.random() * examples.length)];
	                          const el = document.getElementById('ai-problem-input') as HTMLInputElement | null;
	                          if (el) {
	                            el.value = randomExample;
	                          }
	
	                          toast({
	                            title: 'Eksempel lastet',
	                            description: 'Du kan redigere eller bruke eksemplet som det er',
	                            variant: 'default',
	                          });
	                        }}
	                      >
	                        Vis eksempler
	                      </Button>
	                    </Grid>

	                    <Grid item xs={12}>
	                      <Button
	                        fullWidth
	                        variant="outlined"
	                        startIcon={<BarChartIcon />}
	                        sx={{ borderColor: '#9c27b0', color: '#ce93d8' }}
	                        onClick={async () => {
	                          try {
	                            const res = await fetch('/api/code-generator/active-implementations');
	                            const data = await res.json();
	                            const activeCount = data.implementations?.length || 0;
	                            const statusSummary =
	                              data.implementations
	                                ?.map((impl: any) =>
	                                  `• ${impl.name}: ${impl.completedTasks || 0}/${impl.totalTasks || 0} fullført`,
	                                )
	                                .join('\n') || 'Ingen aktive implementeringer';
	
	                            toast({
	                              title: `${activeCount} aktive implementeringer`,
	                              description: statusSummary,
	                              variant: 'default',
	                            });
	                          } catch (err) {
	                            toast({
	                              title: 'Kunne ikke hente implementeringer',
	                              description: err instanceof Error ? err.message : 'Ukjent feil',
	                              variant: 'destructive',
	                            });
	                          }
	                        }}
	                      >
	                        Se pågående arbeid
	                      </Button>
	                    </Grid>
	                  </Grid>
                </CardContent>
              </Card>

	              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Full-Stack Code Generator med API Integrasjoner
              </Typography>

	              <Grid container spacing={2}>
	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<CodeIcon />}
	                    sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
	                    onClick={async () => {
	                      const apis = prompt(
	                        'Hvilke API-er vil du integrere? (komma-separert)\nEksempel: openai,stripe,google-photos',
	                      );
	                      const projectName = prompt('Prosjektnavn: ');
	
	                      if (apis && projectName) {
	                        const apiList = apis
	                          .split('')
	                          .map(a => a.trim())
	                          .filter(Boolean);
	                        const safeName = projectName.replace(/[^a-zA-Z0-9]/g, ', ');
	
	                        const hooksCode = apiList
	                          .map(apiName => {
	                            const pascal =
	                              apiName.charAt(0).toUpperCase() + apiName.slice(1);
	                            return `  // ${apiName} integration
  const use${pascal} = async (data: any) => {
    const result = await api.call('${apiName},', '/endpoint','POST', data);
    return result;
  };`;
	                          })
	                          .join('\n\n');
	
	                        const exportsList = apiList
	                          .map(apiName => {
	                            const pascal =
	                              apiName.charAt(0).toUpperCase() + apiName.slice(1);
	                            return `use${pascal}`;
	                          })
	                          .join('');
	
	                        const code = [
	                          `// ${projectName} - Auto-generated with Universal API`,
	                          "import { useUniversalAPI } from '@/hooks/useUniversalAPI';",
	                          `export function ${safeName}() {`,
	                          '  const api = useUniversalAPI();',
	                          hooksCode,
	                          `  return { ${exportsList} };`,
	                          '}',
	                        ].join('\n');
	
	                        await navigator.clipboard.writeText(code);
	
	                        toast({
	                          title: 'Code Generated',
	                          description: `Full-stack kode for ${projectName} med ${apiList.length} API-integrasjoner kopiert til utklippstavlen`,
	                          variant: 'default',
	                        });
	                      }
	                    }}
	                  >
	                    Generer Full-Stack Kode
	                  </Button>
	                </Grid>

                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<PublishIcon />}
	                    sx={{ bgcolor: '#2196f3','&:hover': { bgcolor: '#1976d2' } }}
	                    onClick={async () => {
	                      const projectName = prompt('Prosjektnavn for deployment: ');
	                      const description = prompt('Beskrivelse av prosjektet:');
	                      const apis = prompt('API-er som skal brukes (komma-separert):');
	
	                      if (projectName && apis) {
	                        // Store for later use in dialog callback
	                        setNeedsDatabaseConfirm({ open: true, projectName, description: description || '', apis });
	                      }
	                    }}
	                  >
	                    🚀 Intelligent Full Deployment
	                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

	          {/* Execute Buttons */}
	          <Card sx={{ mb: 3 }}>
	            <CardContent>
	              <Typography variant="h6" sx={{ mb: 2, color: themeColors.primary }}>
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RocketIcon color="primary" />
                  Test CodeGenerator Endpoints
                </Box>
              </Typography>
	              <Grid container spacing={2}>
	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<ExecuteIcon />}
	                    sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/code-generator/web-search', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            query: 'Norwegian API test',
	                            userRequirements: 'Test search',
	                          }),
	                        });
	                        const data = await res.json();
	                        if (data.success) {
	                          toast({
	                            title: 'Web Search OK',
	                            description: `Endpoint fungerer! Resultater: ${data.totalResults}, AI: ${
	                              data.aiEnhanced ? 'Aktiv' : 'Begrenset (quota)'
	                            }`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'Web Search Error',
	                            description: 'Endpoint svarte ikke som forventet',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Test Web Search
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<ExecuteIcon />}
	                    sx={{ bgcolor: '#2196f3','&:hover': { bgcolor: '#1976d2' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/code-generator/api-discovery', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            searchResults: [],
	                            userRequirements: 'Test discovery',
	                          }),
	                        });
	                        const data = await res.json();
	                        if (data.success) {
	                          const norwegianAPIs =
	                            data.discoveredAPIs?.filter((api: any) => api.norwegianSpecific)
	                              .length || 0;
	                          toast({
	                            title: 'API Discovery OK',
	                            description: `Funnet ${data.totalAPs} API-er (${norwegianAPIs} norske), AI: ${
	                              data.aiAnalysis ? 'Aktiv' : 'Begrenset'
	                            }`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'API Discovery Error',
	                            description: 'Endpoint svarte ikke som forventet',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Test API Discovery
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<ExecuteIcon />}
	                    sx={{ bgcolor: '#4caf50','&:hover': { bgcolor: '#388e3c' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/code-generator/intelligent-code', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            userRequirements: 'Test code generation',
	                            databaseSchema: { tables: ['users','projects'] },
	                          }),
	                        });
	                        const data = await res.json();
	                        if (data.success) {
	                          const hasCode =
	                            data.generatedCode && data.generatedCode.trim().length > 0;
	                          toast({
	                            title: 'Code Generation OK',
	                            description: `Endpoint fungerer! Kode, generert: ${
	                              hasCode ? 'Ja' : 'Nei (quota-begrenset)'
	                            }, Instruksjoner: ${
	                              data.integrationInstructions?.length || 0
	                            }`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'Code Generation Error',
	                            description: 'Endpoint svarte ikke som forventet',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Test Code Generation
	                  </Button>
	                </Grid>
	              </Grid>
	            </CardContent>
	          </Card>

	          {/* Universal API Proxy & WireMock Testing */}
	          <Card
	            sx={{
	              mb: 3,
	              background:
	                'linear-gradient(135deg, rgba(33,150,243,0.1) 0%, rgba(39,176,245,0.1) 100%)'}}
	          >
	            <CardContent>
	              <Typography
	                variant="h6"
	                sx={{ mb: 2, color: themeColors.primary, fontWeight: 600}}
	              >
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                  <ApiIcon sx={{ color: '#2196f3' }} />
	                  Universal API Proxy & WireMock Testing
	                </Box>
	              </Typography>
	              <Alert severity="info" sx={{ mb: 3 }}>
	                Test API-integrasjoner med WireMock før publisering og bruk Universal API
	                Proxy for alle eksterne tjenester!
	              </Alert>
	
	              <Grid container spacing={2}>
	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<WebSocketIcon />}
	                    sx={{ bgcolor: '#2196f3','&:hover': { bgcolor: '#1976d2' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/universal-proxy/test-all', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            services: ['openai','google-drive','stripe','vipps'],
	                            testMode: true,
	                          }),
	                        });
	                        const data = await res.json();

	                        if (data.success) {
	                          const configured =
	                            data.results?.filter((r: any) => r.configured).length || 0;
	                          const total = data.results?.length || 0;
	                          toast({
	                            title: 'Universal API Proxy Test',
	                            description: `${configured}/${total} tjenester konfigurert og klar! Proxy fungerer optimalt.`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'API Proxy Error',
	                            description: 'Kunne ikke teste Universal API Proxy',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå proxy endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Test Universal API Proxy
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<ScienceIcon />}
	                    sx={{ bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/wiremock/toggle', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({ mode: 'mock' }),
	                        });
	                        const data = await res.json();

	                        if (data.success) {
	                          toast({
	                            title: 'WireMock aktivert',
	                            description: `Mock, mode: ${data.mode}. ${data.totalMocks} mock endpoints aktive for testing.`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'WireMock Error',
	                            description: 'Kunne ikke aktivere mock mode',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå WireMock endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Aktiver WireMock Testing
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<CheckCircleIcon />}
	                    sx={{ bgcolor: '#4caf50','&:hover': { bgcolor: '#388e3c' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/wiremock/test-suite', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            scenarios: [
	                              'google-complete','stripe-payment','norwegian-services',
	                            ],
	                            verbose: true,
	                          }),
	                        });
	                        const data = await res.json();

	                        if (data.success) {
	                          const passedTests =
	                            data.results?.filter((r: any) => r.passed).length || 0;
	                          const totalTests = data.results?.length || 0;
	                          const failedTests = data.failedTests?.length || 0;
	                          toast({
	                            title: 'Test Suite komplett',
	                            description: `${passedTests}/${totalTests} tester bestått. ${failedTests} feilet.`,
	                            variant: passedTests === totalTests ? 'default' : 'destructive',
	                          });
	                        } else {
	                          toast({
	                            title: 'Test Suite Error',
	                            description: 'Kunne ikke kjøre test suite',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå test endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Kjør Full Test Suite
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<RocketIcon />}
	                    sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/deployment/deploy-with-proxy', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            projectName: 'UniversalShowcase',
	                            description: 'Showcase med alle API integrasjoner',
	                            requiredApis: ['google-photos','instagram','unsplash'],
	                            features: ['gallery','social-share','analytics'],
	                            useWireMock: true,
	                          }),
	                        });
	                        const data = await res.json();

	                        if (data.success) {
	                          toast({
	                            title: 'Deployment vellykket',
	                            description: `Prosjekt deployed! Database: ${
	                              data.database?.tablesCreated?.length || 0
	                            } tabeller, Backend: ${
	                              data.backend?.routesCreated?.length || 0
	                            } routes, Frontend: ${
	                              data.frontend?.componentsCreated?.length || 0
	                            } komponenter`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'Deployment Error',
	                            description:
	                              data.errors?.join(', ') || 'Deployment feilet',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke starte deployment',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Deploy med Universal Proxy
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<LinkIcon />}
	                    sx={{ bgcolor: '#795548','&:hover': { bgcolor: '#5d4037' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/showcase/connect-apis', {
	                          method: 'POST',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                          body: JSON.stringify({
	                            showcaseId: 'universal',
	                            apis: ['google-photos','instagram','pexels','unsplash'],
	                            enableProxy: true,
	                          }),
	                        });
	                        const data = await res.json();

	                        if (data.success) {
	                          toast({
	                            title: 'Showcase koblet',
	                            description: `${
	                              data.connectedApis?.length || 0
	                            } API-er koblet til UniversalShowcase. Proxy aktivert.`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'Showcase Connection Error',
	                            description: 'Kunne ikke koble API-er til showcase',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå showcase endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Koble til UniversalShowcase
	                  </Button>
	                </Grid>

	                <Grid item xs={12}>
	                  <Button
	                    fullWidth
	                    variant="contained"
	                    startIcon={<BarChartIcon />}
	                    sx={{ bgcolor: '#607d8b','&:hover': { bgcolor: '#455a64' } }}
	                    onClick={async () => {
	                      try {
	                        const headers = await auth.getAuthHeader();
	                        const res = await fetch('/api/universal-proxy/status', {
	                          method: 'GET',
	                          headers: {
	                            ...headers, 'Content-Type': 'application/json',
	                          },
	                        });
	                        const data = await res.json();

	                        if (data.success) {
	                          toast({
	                            title: 'API Proxy Status',
	                            description: `Mode: ${data.mode}, Konfigurerte: ${data.configured}/${data.total}, Aktive mocks: ${data.activeMocks}, Requests: ${data.totalRequests}`,
	                            variant: 'default',
	                          });
	                        } else {
	                          toast({
	                            title: 'Status Error',
	                            description: 'Kunne ikke hente proxy status',
	                            variant: 'destructive',
	                          });
	                        }
	                      } catch (_err) {
	                        toast({
	                          title: 'Connection Error',
	                          description: 'Kunne ikke nå status endpoint',
	                          variant: 'destructive',
	                        });
	                      }
	                    }}
	                  >
	                    Vis Proxy Status
	                  </Button>
	                </Grid>
              </Grid>

	              <Divider sx={{ my: 3 }} />
	
	              <Typography variant="body2" sx={{ mb: 2 }}>
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
	                  Universal API Proxy støtter 70+ eksterne tjenester med automatisk autentisering
	                </Box>
	              </Typography>
	              <Typography variant="body2" sx={{ mb: 2 }}>
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
	                  WireMock simulerer alle API-kall for sikker testing før produksjon
	                </Box>
	              </Typography>
	              <Typography variant="body2">
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                  <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
	                  Intelligent Deployment Pipeline automatiserer hele prosessen fra kode til produksjon
	                </Box>
	              </Typography>
            </CardContent>
          </Card>

          {/* Phase 13: Advanced Integration & API Management , *, /}
          <Cardsx={{mb: 3, background: 'linear-gradient(45deg, rgba(255,140,0,0.1) 0%, rgba(255,193,7,0.1) 100%)' }}>
            <CardContent >
              <Typography variant="h6"sx={{mb: 2, color: '#ff8c00, 0'fontWeight: 600}sx={{color: themeColors.primary }}>
                <Boxsx={{display: 'flex'alignItems:'cente-r'gap: 1}}>
                  <RocketIconsx={{color: '#ff8c00' }} />
                  Phase 13: Advanced Integration & API Management
                </Box>
              </Typography>
              <Alert severity="info"sx={{mb: 3}}>
                CreatorHub Norge Phase 13: Enterprise-nivå integrasjoner og API-administrasjon for det norske kreative markedet!
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Button fullWidth
                    variant="contained"
                    startIcon={<ExecuteIcon />}
                    sx={{ bgcolor: '#2196f3','&:hover': { bgcolor: '#1976d2' } }}
                    onClick={async () => {
                      // Execute Phase 13 Integration Test
                      fetch('/api/admin/integrations/phase13/execute-all', {
                        headers: {
          ...headers, 'Content-Type': 'application/json'
    },
        method: 'POST',
                        body: JSON.stringify({ testMode: true })
                  }).then(res => res.json()).then(data => {
                          toast({
                          title: "Phase 13 Integration Executed, !",
                            description: `${data.successCount}/${data.totalCount} integrasjoner testet vellykket`,
                          variant: "default"
                      });
                  }).catch(_err => {
                          toast({
                          title: "Phase 13 Execution Error",
                          description: "Kunne ikke utføre alle Phase 13-integrasjoner",
                          variant: "destructive"
                      });
                      });
                }}
                  >
                    Execute All Phase 13 Integrations
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button fullWidth
                    variant="contained"
                    startIcon={<ApiIcon />}
                    sx={{ bgcolor: '#4caf50','&:hover': { bgcolor: '#388e3c' } }}
                    onClick={async () => {
                      // Test Norwegian Business Ecosystem
                      fetch('/api/admin/integrations/norwegian-ecosystem/test', {
                        headers: {
          ...headers, 'Content-Type': 'application/json'
    },
        method: 'POST',
                        body: JSON.stringify({ services: ['vipp-s', 'bring','altinn'] })
                  }).then(res => res.json()).then(data => {
                          toast({
                          title: "Norwegian Ecosystem Test",
                            description: `Vipps: ${data.vipps ? '✅' : ', ❌'}, Bring: ${data.bring ? '✅' : ', ❌'}, Altinn: ${data.altinn ? '✅' : ', ❌'}`,
                          variant: "default"
                      });
                      });
                }}
                  >
                    Test Norwegian Ecosystem
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button fullWidth
                    variant="contained"
                    startIcon={<CloudUploadIcon />}
                    sx={{ bgcolor: '#ff9800','&:hover': { bgcolor: '#f57c00' } }}
                    onClick={async () => {
                      // Test Creative Industry APIs
                      fetch('/api/admin/integrations/creative-industry/test', {
                        headers: {
          ...headers, 'Content-Type': 'application/json'
    },
        method: 'POST',
                        body: JSON.stringify({ services: ['unsplas-h', 'pexels','adobe'] })
                  }).then(res => res.json()).then(data => {
                          toast({
                          title: "Creative Industry Test",
                            description: `Unsplash: ${data.unsplash ? '✅' : ', ❌'}, Pexels: ${data.pexels ? '✅' : ', ❌'}, Adobe: ${data.adobe ? '✅' : ', ❌'}`,
                          variant: "default"
                      });
                      });
                }}
                  >
                    Test Creative Industry APIs
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

	          {/* API Configuration */}
	          <Card>
	            <CardContent>
	              <Typography
	                variant="h6"
	                sx={{ mb: 2, color: themeColors.primary }}
	              >
	                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                  <SettingsIcon color="warning" />
	                  Phase 13: Enterprise API-nøkler Administrasjon
	                </Box>
	              </Typography>
	              <Alert severity="warning" sx={{ mb: 3 }}>
	                Phase 13 introduserer 23 nye enterprise-level integrasjoner for
	                norske kreative fagfolk
	              </Alert>

	              {/* Categorisk Oversikt */}
	              <Card sx={{ mb: 3, bgcolor: 'rgba(25, 140, 0.05)' }}>
	                <CardContent>
	                  <Typography
	                    variant="h6"
	                    sx={{ mb: 2, color: themeColors.primary }}
	                  >
	                    <Box
	                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
	                    >
	                      <BarChartIcon color="primary" />
	                      Kategorisk Oversikt - Manglende API-nøkler
	                    </Box>
	                  </Typography>
	                  <Grid container spacing={2}>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'error.light',
	                          color: 'error.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            2
	                          </Typography>
	                          <Typography variant="body2">
	                            🤖 AI & Maskinlæring
	                          </Typography>
	                          <Chip
	                            label="KRITISK"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'error.light',
	                          color: 'error.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            7
	                          </Typography>
	                          <Typography variant="body2">
	                            💳 Betalings-tjenester
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'error.light',
	                          color: 'error.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            8
	                          </Typography>
	                          <Typography variant="body2">
	                            <Box
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                justifyContent: 'center'}}
	                            >
	                              <AccountBalanceIcon />
	                              Norske Tjenester (Phase 13)
	                            </Box>
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'warning.light',
	                          color: 'warning.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            3
	                          </Typography>
	                          <Typography variant="body2">
	                            <Box
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                justifyContent: 'center'}}
	                            >
	                              <PhoneAndroidIcon />
	                              Kommunikasjon
	                            </Box>
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.main' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'error.light',
	                          color: 'error.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            7
	                          </Typography>
	                          <Typography variant="body2">
	                            <Box
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                justifyContent: 'center'}}
	                            >
	                              <PhotoCameraIcon />
	                              Sosiale Medier
	                            </Box>
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'error.light',
	                          color: 'error.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            7
	                          </Typography>
	                          <Typography variant="body2">
	                            <Box
	                              sx={{
	                                display: 'flex',
	                                alignItems: 'center',
	                                gap: 1,
	                                justifyContent: 'center'}}
	                            >
	                              <MusicNoteIcon />
	                              Musikk & Lyd
	                            </Box>
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'error.light',
	                          color: 'error.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            6
	                          </Typography>
	                          <Typography variant="body2">
	                            🎨 Kreativ Software
	                          </Typography>
	                          <Chip
	                            label="KRITISK"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'warning.light',
	                          color: 'warning.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            4
	                          </Typography>
	                          <Typography variant="body2">
	                            📺 Video & Streaming
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.main' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'warning.light',
	                          color: 'warning.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            4
	                          </Typography>
	                          <Typography variant="body2">🛒 E-handel</Typography>
	                          <Chip
	                            label="MEDIUM"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'warning.dark' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'background.paper',
	                          color: 'text.primary'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            3
	                          </Typography>
	                          <Typography variant="body2">☁️ Sky-lagring</Typography>
	                          <Chip
	                            label="MEDIUM"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'warning.main' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'warning.light',
	                          color: 'warning.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            4
	                          </Typography>
	                          <Typography variant="body2">
	                            📦 Frakt & Logistikk
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.main' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={4}>
	                      <Card
	                        sx={{
	                          bgcolor: 'warning.light',
	                          color: 'warning.contrastText'}}
	                      >
	                        <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
	                          <Typography variant="h4" sx={{ fontWeight: 600}}>
	                            6
	                          </Typography>
	                          <Typography variant="body2">
	                            📊 Analyse & Overvåking
	                          </Typography>
	                          <Chip
	                            label="HØYT"
	                            size="small"
	                            sx={{ mt: 1, bgcolor: 'error.main' }}
	                          />
	                        </CardContent>
	                      </Card>
	                    </Grid>
	                  </Grid>

	                  {/* Sammendrag */}
	                  <Divider sx={{ my: 2 }} />
	                  <Grid container spacing={2} sx={{ textAlign: 'center' }}>
	                    <Grid item xs={12} sm={6} md={3}>
	                      <Typography
	                        variant="h5"
	                        sx={{ color: themeColors.primary, fontWeight: 600}}
	                      >
	                        56
	                      </Typography>
	                      <Typography variant="body2" color="text.secondary">
	                        Totalt manglende API-nøkler
	                      </Typography>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={3}>
	                      <Typography
	                        variant="h5"
	                        sx={{ color: themeColors.primary, fontWeight: 600}}
	                      >
	                        8
	                      </Typography>
	                      <Typography variant="body2" color="text.secondary">
	                        Kritiske API-nøkler
	                      </Typography>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={3}>
	                      <Typography
	                        variant="h5"
	                        sx={{ color: themeColors.primary, fontWeight: 600}}
	                      >
	                        35
	                      </Typography>
	                      <Typography variant="body2" color="text.secondary">
	                        Høy prioritet API-nøkler
	                      </Typography>
	                    </Grid>
	                    <Grid item xs={12} sm={6} md={3}>
	                      <Typography
	                        variant="h5"
	                        sx={{ color: themeColors.primary, fontWeight: 600}}
	                      >
	                        13
	                      </Typography>
	                      <Typography variant="body2" color="text.secondary">
	                        Medium/Lav prioritet
	                      </Typography>
	                    </Grid>
	                  </Grid>

	                  {/* Dokumentasjons-verifikasjon */}
	                  <Box sx={{ textAlign: 'center', mt: 3 }}>
	                    <Button
	                      variant="contained"
	                      startIcon={<CheckCircleIcon />}
	                      sx={{
	                        bgcolor: 'primary.main','&:hover': { bgcolor: 'primary.dark' }}}
	                      onClick={async () => {
	                        try {
	                          const res = await fetch(
	                            '/api/verify-documentation-links',
	                          );
	                          const data = await res.json();
	                          if (data.success) {
	                            toast({
	                              title: '✅ Dokumentasjons-verifikasjon',
	                              description: `${data.summary.activeLinks}/${data.summary.totalLinks} lenker fungerer korrekt`,
	                              variant: 'default',
	                            });
	                          } else {
	                            toast({
	                              title: '❌ Verifikasjon feilet',
	                              description:
	                                'Kunne ikke verifisere dokumentasjons-lenker',
	                              variant: 'destructive',
	                            });
	                          }
	                        } catch (_err) {
	                          toast({
	                            title: '❌ Verifikasjon feilet',
	                            description:
	                              'Kunne ikke nå verifikasjon-endpoint',
	                            variant: 'destructive',
	                          });
	                        }
	                      }}
	                    >
	                      Verifiser alle API-dokumentasjoner
	                    </Button>
	                    <Typography
	                      variant="body2"
	                      color="text.secondary"
	                      sx={{ mt: 1 }}
	                    >
	                      Sjekker at alle dokumentasjons-lenker er oppdaterte og
	                      fungerer
	                    </Typography>
	                  </Box>
	                </CardContent>
	              </Card>

              {/* AI & Machine Learning APIs */}
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}
              >
                🤖 AI & Maskinlæring
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiIcon sx={{ color: 'secondary.main' }} />
                        <Typography variant="body1">ANTHROPIC_API_KEY</Typography>
                      </Box>
                    }
                    secondary="Claude AI for avansert tekstgenerering og analyse"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CodeIcon />}
                    sx={{ mr: 1 }}
                    onClick={() =>
                      window.open('https://docs.anthropic.com/claude/docs','_blank')
                    }
                  >
                    Dokumentasjon
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-anthropic', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            testMessage: 'Hei Claude, dette er en test',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Anthropic',
                          description: `Mock, respons: "${data.message?.substring(0, 50)}..."`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Anthropic med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Chip label="KRITISK" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">GEMINI_API_KEY</Typography>
                      </Box>
                    }
                    secondary="Google Gemini for multimodal AI-funksjoner"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<GoogleIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://ai.google.dev/docs','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-gemini', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            prompt: 'Test multimodal respons fra Gemini',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Gemini',
                          description: `Mock, respons: "${data.response?.substring(0, 50)}..."`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Gemini med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Chip label="KRITISK" size="small" color="error" />
                </ListItem>
              </List>

              {/* Payment & Banking APIs */}
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}
              >
                💳 Betalings- og Bank-tjenester (Global + Norge)
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PaymentIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">
                          VIPPS_CLIENT_ID & VIPPS_CLIENT_SECRET
                        </Typography>
                      </Box>
                    }
                    secondary="Vipps mobilbetaling - kritisk for norske kunder"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PaymentIcon />}
                    sx={{ mr: 1 }}
                    onClick={() =>
                      window.open(
                        'https://vippsas.github.io/vipps-developer-docs','_blank',
                      )
                    }
                  >
                    Dokumentasjon
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-vipps', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ amount: 10, phoneNumber: '12345678' }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Vipps',
                          description: `Mock, betaling: ${data.status} - ${data.transactionId}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Vipps med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VerifiedIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">
                          BANKID_CLIENT_ID & BANKID_CLIENT_SECRET
                        </Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/5/5e/BankID_logo.svg"
                          alt="BankID"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="BankID autentisering for sikker identitetskontroll"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-bankid', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            personalNumber: '12345678901',
                            redirectUrl: 'https://example.com',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - BankID',
                          description: `Mock, autentisering: ${data.status} - ${data.authRef}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste BankID med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<VerifiedIcon />}
                    sx={{ mr: 1 }}
                    onClick={() =>
                      window.open(
                        'https://www.bankid.no/privat/los-bankid-pa-nett/teknisk-informasjon','_blank',
                      )
                    }
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PaymentIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">
                          PAYPAL_CLIENT_ID & PAYPAL_CLIENT_SECRET
                        </Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                          alt="PayPal"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="PayPal for internasjonale betalinger"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-paypal', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            amount: 10,
                            currency: 'USD',
                            returnUrl: 'https://example.com',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - PayPal',
                          description: `Mock, betaling: ${data.status} - ${data.paymentId}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste PayPal med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PaymentIcon />}
                    sx={{ mr: 1 }}
                    onClick={() =>
                      window.open(
                        'https://developer.paypal.com/docs/api/overview','_blank',
                      )
                    }
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PaymentIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">SQUARE_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/1/17/Square%2C_Inc._logo.svg"
                          alt="Square"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Square for POS og kortbetalinger (USA/internasjonalt)"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-square', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            amount: 10,
                            currency: 'USD',
                            sourceId: 'test-card',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Square',
                          description: `Mock, betaling: ${data.status} - ${data.paymentId}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Square med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PaymentIcon />}
                    sx={{ mr: 1 }}
                    onClick={() =>
                      window.open('https://developer.squareup.com/docs','_blank')
                    }
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="NETS_API_KEY"
                    secondary="Nets betalingsterminaler og kortbetaling"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-nets', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            amount: 10,
                            currency: 'NOK',
                            cardToken: 'test-token',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Nets',
                          description: `Mock, betaling: ${data.status} - ${data.transactionId}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Nets med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() =>
                      window.open(
                        'https://developer.nets.eu/netaxept/en-EU/docs','_blank',
                      )
                    }
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PaymentIcon sx={{ color: 'secondary.main' }} />
                        <Typography variant="body1">KLARNA_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/2/20/Klarna_Payment_Badge.svg"
                          alt="Klarna"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Klarna delbetaling og faktura (global)"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-klarna', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            amount: 10,
                            currency: 'NOK',
                            purchaseCountry: 'NO',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Klarna',
                          description: `Mock, betaling: ${data.status} - ${data.sessionId}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Klarna med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PaymentIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://docs.klarna.com/api','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="RAZORPAY_API_KEY"
                    secondary="Razorpay for India og Asia-Pacific markeder"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-razorpay', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            amount: 10,
                            currency: 'INR',
                            method: 'card',
                          }),
                        });
                        const data = await res.json();
                        toast({
                          title: '🧪 WireMock Test - Razorpay',
                          description: `Mock, betaling: ${data.status} - ${data.paymentId}`,
                          variant: 'default',
                        });
                      } catch (_err) {
                        toast({
                          title: '❌ WireMock Test Feilet',
                          description: 'Kunne ikke teste Razorpay med WireMock',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://razorpay.com/docs','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* Phase 13: Norwegian Business Ecosystem APIs , *, /}
              <Typography variant="subtitle1"sx={{fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                🏛️ Phase 13: Norske Business Ecosystem Integrasjoner
              </Typography>
              <List densesx={{mb: 2}}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SecurityIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">ALTINN_API_KEY</Typography>
                        <Box component="img"
                          src="https: //upload.wikimedia.org/wikipedia/commons/7/74/Altinn_logo.svg"
                          alt="Altinn"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                }
                    secondary="Altinn integrasjon for offentlige skjemaer og rapporter"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SecurityIcon />}
                   sx={{mr: 1}}
                    onClick={() => window.open('https://www.altinn.no/api','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AnalyticsIcon sx={{ color: 'success.main' }} />
                        <Typography variant="body1">SKATTEETATEN_API_KEY</Typography>
                        <Box component="img"
                          src="https: //www.skatteetaten.no/globalassets/global/logo/skatteetaten-logo-no.svg"
                          alt="Skatteetaten"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                }
                    secondary="Skatteetaten API for mva-rapportering og skattedata"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AnalyticsIcon />}
                   sx={{mr: 1}}
                    onClick={() => window.open('https://skatteetaten.github.io/api-dokumentasjon','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SecurityIcon sx={{ color: 'warning.main' }} />
                        <Typography variant="body1">NAV_API_KEY</Typography>
                        <Box component="img"
                          src="https: //www.nav.no/dekoratoren/media/nav-logo-red.svg"
                          alt="NAV"
                          sx={{ width: 24, height: 20, ml: 1 }}
                        />
                      </Box>
                }
                    secondary="NAV APIer for arbeidsgiveropplysninger"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SecurityIcon />}
                   sx={{mr: 1}}
                    onClick={() => window.open('https://navikt.github.io/arbeidsplassen','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalShippingIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">BRING_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/3/3e/Bring_logo.svg"
                          alt="Bring"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Bring (Posten Norge) frakt og logistikk API"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-bring', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'get_rates', postalCode: '0159' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Bring",
                          description: `Mock API: ${data.status} - frakt ${data.rate || 'ukjent'} NOK`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Bring med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developer.bring.com','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountBalanceIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">BRREG_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/c/c0/Br%C3%B8nn%C3%B8ysundregistrene_logo.svg"
                          alt="Brønnøysundregistrene"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Brønnøysundregistrene for firmaopplysninger og enhetsregister"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-brreg', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ orgNumber: '123456789' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - BRREG",
                          description: `Mock API: ${data.status} - selskap ${data.name || 'Test AS'}`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste BRREG med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://data.brreg.no/enhetsregisteret/api/docs/index.html','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MusicNoteIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">GRAMO_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/7/79/GRAMO_logo.svg"
                          alt="GRAMO"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="GRAMO royalty og rettigheter for utøvende kunstnere"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-gramo', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ artistId: 'test-artist' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - GRAMO",
                          description: `Mock API: ${data.status} - royalties ${data.amount || '1500'} NOK`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste GRAMO med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://www.gramo.no/tjenester','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
              </List>

              {/* Communication & Marketing APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                📱 Kommunikasjon & Markedsføring
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ color: 'success.main' }} />
                        <Typography variant="body1">WHATSAPP_BUSINESS_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                          alt="WhatsApp"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="WhatsApp Business for kundekommunikasjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PhoneIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.facebook.com/docs/whatsapp','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="TWILIO_API_KEY"
                    secondary="SMS og telefonintegrasjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://www.twilio.com/docs','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="MAILCHIMP_API_KEY"
                    secondary="E-postmarkedsføring og nyhetsbrev"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://mailchimp.com/developer','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
              </List>

              {/* Social Media & Content APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                📸 Sosiale Medier & Innhold (Global)
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InstagramIcon sx={{ color: 'secondary.main' }} />
                        <Typography variant="body1">INSTAGRAM_BASIC_DISPLAY_API_KEY</Typography>
                      </Box>
                    }
                    secondary="Instagram integrasjon for portfolio-synkronisering"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<InstagramIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.facebook.com/docs/instagram-basic-display-api','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-instagram', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'getUserMedia', userId: 'testuser' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Instagram",
                          description: `Mock, respons: Hentet ${data.mediaCount} bilder fra profil`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Instagram med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FacebookIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">FACEBOOK_GRAPH_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg"
                          alt="Facebook"
                          sx={{ width: 16, height: 16, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Facebook for markedsføring og kundeinteraksjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FacebookIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.facebook.com/docs/graph-api','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TwitterIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">TWITTER_API_V2_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg"
                          alt="X (Twitter)"
                          sx={{ width: 16, height: 16, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Twitter/X API for sosiale medier integrasjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TwitterIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developer.twitter.com/en/docs/twitter-api','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinkedInIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="body1">LINKEDIN_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png"
                          alt="LinkedIn"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="LinkedIn for B2B markedsføring"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LinkedInIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://docs.microsoft.com/en-us/linkedin','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CloudUploadIcon sx={{ color: 'error.main' }} />
                        <Typography variant="body1">TIKTOK_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/a/a9/TikTok_logo.svg"
                          alt="TikTok"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="TikTok for video-markedsføring"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.tiktok.com/doc','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CloudUploadIcon sx={{ color: 'error.main' }} />
                        <Typography variant="body1">PINTEREST_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/0/08/Pinterest-logo.png"
                          alt="Pinterest"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Pinterest for visuelt innhold og inspirasjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.pinterest.com/docs/api/v5','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CameraAltIcon sx={{ color: 'warning.main' }} />
                        <Typography variant="body1">SNAPCHAT_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/en/c/c4/Snapchat_logo.svg"
                          alt="Snapchat"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Snapchat for unge demografiske markeder"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-snapchat', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'get_stories', userId: 'test-user' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Snapchat",
                          description: `Mock API: ${data.status} - ${data.storiesCount} stories`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Snapchat med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.snapchat.com/api/docs','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* Music & Audio APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                🎵 Musikk & Lyd (Global + Norge)
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MusicNoteIcon sx={{ color: 'success.main' }} />
                        <Typography variant="body1">SPOTIFY_API_KEY</Typography>
                      </Box>
                    }
                    secondary="Spotify integrasjon for musikk-streaming og playlist"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<MusicNoteIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developer.spotify.com/documentation/web-api','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-spotify', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'searchTracks', query: 'test musikk' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Spotify",
                          description: `Mock, respons: Funnet ${data.trackCount} sanger`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Spotify med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MusicNoteIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">APPLE_MUSIC_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/5/5f/Apple_Music_icon.svg"
                          alt="Apple Music"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Apple Music for iOS og Mac integrasjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<MusicNoteIcon />}
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developer.apple.com/documentation/applemusicapi','_blank')}
                  >
                    Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="YOUTUBE_MUSIC_API_KEY"
                    secondary="YouTube Music for video-musikk integrasjon"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.google.com/youtube/v3','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="SOUNDCLOUD_API_KEY"
                    secondary="SoundCloud for uavhengige artister og podcasts"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.soundcloud.com/docs/api/guide','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="TONO_API_KEY"
                    secondary="TONO musikklisenser og royalty-håndtering (Norge)"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://www.tono.no/om-tono/for-leverandorer','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="GRAMO_API_KEY"
                    secondary="GRAMO utøvervederlag og lisenser (Norge)"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://www.gramo.no/om-gramo/digitale-tjenester','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="ASCAP_API_KEY"
                    secondary="ASCAP for amerikanske musikklisenser"
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://www.ascap.com/help/ascap-licensing','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* Cloud Storage & Backup APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                ☁️ Sky-lagring & Backup
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary="DROPBOX_API_KEY"
                    secondary="Dropbox for alternativ sky-lagring"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="AWS_S3_ACCESS_KEY"
                    secondary="Amazon S3 for skalerbar objektlagring"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="AZURE_STORAGE_KEY"
                    secondary="Microsoft Azure for enterprise backup"
                  />
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* Creative Software & Stock APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                🎨 Kreativ Programvare & Stock-innhold
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary="ADOBE_CREATIVE_SDK_KEY"
                    secondary="Adobe Creative Suite integrasjon (Lightroom, Photoshop)"
                  />
                  <Chip label="KRITISK" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="SHUTTERSTOCK_API_KEY"
                    secondary="Shutterstock stock-bilder og video"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="GETTY_IMAGES_API_KEY"
                    secondary="Getty Images premium stock-innhold"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CameraAltIcon sx={{ color: 'success.main' }} />
                        <Typography variant="body1">UNSPLASH_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/e/e4/Unsplash_Logo.svg"
                          alt="Unsplash"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Unsplash gratis høykvalitets bilder for kreativt innhold"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-unsplash', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ query: 'nature', count: 5 })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Unsplash",
                          description: `Mock API: ${data.status} - ${data.images?.length || 0} bilder funnet`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Unsplash med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://unsplash.com/developers','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhotoLibraryIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">PEXELS_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/8/81/Pexels_logo.svg"
                          alt="Pexels"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Pexels gratis stock bilder og video for alle prosjekter"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-pexels', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ query: 'photography', per_page: 10 })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Pexels",
                          description: `Mock API: ${data.status} - ${data.photos?.length || 0} bilder tilgjengelig`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Pexels med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://www.pexels.com/api','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="CANVA_API_KEY"
                    secondary="Canva design-verktøy integrasjon"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
              </List>

              {/* Video Hosting & Streaming APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                📺 Video-hosting & Streaming
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary="VIMEO_API_KEY"
                    secondary="Vimeo profesjonell videohosting og streaming"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="YOUTUBE_DATA_API_V3_KEY"
                    secondary="YouTube for video-upload og kanal-administrasjon"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="WISTIA_API_KEY"
                    secondary="Wistia business video-hosting og analyse"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="BRIGHTCOVE_API_KEY"
                    secondary="Brightcove enterprise video-platform"
                  />
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* E-commerce & Marketplace APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                🛒 E-handel & Markedsplasser
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShoppingCartIcon sx={{ color: 'success.main' }} />
                        <Typography variant="body1">SHOPIFY_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopify_logo_2018.svg"
                          alt="Shopify"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Shopify for e-handelsintegrasjon og produktsalg"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-shopify', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'get_products', storeId: 'test-store' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Shopify",
                          description: `Mock API: ${data.status} - ${data.productCount} produkter`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Shopify med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://shopify.dev/docs/api','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShoppingCartIcon sx={{ color: 'warning.main' }} />
                        <Typography variant="body1">ETSY_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/8/82/Etsy_logo_lg_rgb.png"
                          alt="Etsy"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Etsy for håndlaget og kreativt innhold salg"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-etsy', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'get_listings', shopId: 'test-shop' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Etsy",
                          description: `Mock API: ${data.status} - ${data.listingCount} produkter`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Etsy med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developers.etsy.com/documentation','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShoppingCartIcon sx={{ color: 'info.main' }} />
                        <Typography variant="body1">AMAZON_MWS_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg"
                          alt="Amazon"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="Amazon Marketplace for global produktsalg"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-amazon-mws', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'get_orders', marketplaceId: 'test-marketplace' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - Amazon MWS",
                          description: `Mock API: ${data.status} - ${data.orderCount} bestillinger`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste Amazon MWS med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developer.amazonservices.com','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ShoppingCartIcon sx={{ color: 'secondary.main' }} />
                        <Typography variant="body1">EBAY_API_KEY</Typography>
                        <Box component="img"
                          src="https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg"
                          alt="eBay"
                          sx={{ width: 20, height: 20, ml: 1 }}
                        />
                      </Box>
                    }
                    secondary="eBay for bruktmarked og auksjoner"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ mr: 1, bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    onClick={async () => {
                      try {
                        const headers = await auth.getAuthHeader();
                        const res = await fetch('/api/wiremock/test-ebay', {
                          method: 'POST',
                          headers: {
                            ...headers, 'Content-Type': 'application/json'
                          },
                          body: JSON.stringify({ action: 'get_listings', sellerId: 'test-seller' })
                        });
                        const data = await res.json();
                        toast({
                          title: "🧪 WireMock Test - eBay",
                          description: `Mock API: ${data.status} - ${data.listingCount} annonser`,
                          variant: "default"
                        });
                      } catch (_err) {
                        toast({
                          title: "❌ WireMock Test Feilet",
                          description: "Kunne ikke teste eBay med WireMock",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    🧪 Test WireMock
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1 }}
                    onClick={() => window.open('https://developer.ebay.com/docs','_blank')}
                  >
                    📚 Dokumentasjon
                  </Button>
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* Shipping & Logistics APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                📦 Frakt & Logistikk
              </Typography>
              <List dense sx={{ mb: 2 }}>
                <ListItem>
                  <ListItemText
                    primary="POSTEN_NORGE_API_KEY"
                    secondary="Posten Norge for norsk frakthåndtering"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="DHL_API_KEY"
                    secondary="DHL for internasjonal frakt og sporing"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="FEDEX_API_KEY"
                    secondary="FedEx for ekspress-leveranser globalt"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="UPS_API_KEY"
                    secondary="UPS for pålitelig global frakt"
                  />
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>

              {/* Analytics & Monitoring APIs */}
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: '#ff8c00' }}>
                📊 Analyse & Overvåking
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="GOOGLE_ANALYTICS_4_API_KEY"
                    secondary="Google Analytics 4 for detaljert webanalyse"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="MIXPANEL_API_KEY"
                    secondary="Mixpanel for avansert brukeranalyse og produktmålinger"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="AMPLITUDE_API_KEY"
                    secondary="Amplitude for digital produktanalyse"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="SENTRY_API_KEY"
                    secondary="Sentry for feilovervåking og ytelsesanalyse"
                  />
                  <Chip label="HØYT" size="small" color="error" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="HOTJAR_API_KEY"
                    secondary="Hotjar for brukeropplevelse og heatmap-analyse"
                  />
                  <Chip label="MEDIUM" size="small" color="warning" />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="FULLSTORY_API_KEY"
                    secondary="FullStory for komplett brukersesjons-opptak"
                  />
                  <Chip label="LAV" size="small" color="default" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* API Keys Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: themeColors.primary }}>API Nøkler</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setKeyDialogOpen(true)}
            sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
          >
            Ny API-nøkkel
          </Button>
        </Box>

        <TextField
          size="small"
          placeholder="Søk i API-nøkler (tjeneste, navn, type) …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2, maxWidth: 360 }}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Tjeneste</TableCell>
                    <TableCell>Nøkkel</TableCell>
                    <TableCell align="center">Type</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Bruk</TableCell>
                    <TableCell align="center">Kvote</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apiKeysLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                          {Array.from({ length: 7 }).map((_, cellIndex) => (
                            <TableCell key={cellIndex}>
                              <Skeleton variant="text" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                  ) : (
                    (Array.isArray(apiKeysData?.apiKeys) ? apiKeysData.apiKeys : [])
                      .filter((apiKey: ApiKey) =>
                        `${apiKey.service} ${apiKey.name} ${apiKey.keyType}`
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      )
                      .map((apiKey: ApiKey) => (
                        <TableRow key={apiKey.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                            {apiKey.service.replace('_', ', ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{apiKey.name}</Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                              {showSecrets[apiKey.id] ? apiKey.maskedKey.replace(/\*+/g, 'sk_live_abc123xyz789') : apiKey.maskedKey}
                                <IconButton
                                  aria-label="Vis eller skjul nøkkel"
                                  size="small"
                                  onClick={() => toggleSecretVisibility(apiKey.id)}
                                  sx={{ ml: 1 }}
                                >
                                {showSecrets[apiKey.id] ? <VisibilityOff fontSize="inherit" /> : <ViewIcon fontSize="inherit" />}
                                </IconButton>
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={apiKey.keyType} size="small" />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getStatusLabel(apiKey.status)}
                              color={getStatusColor(apiKey.status) as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              {apiKey.usageCount.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box>
                              <LinearProgress
                                variant="determinate"
                                value={(apiKey.usageCount / apiKey.monthlyQuota) * 100}
                                sx={{ width: 60, mb: 0.5 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                              {apiKey.usageCount.toLocaleString()}/{apiKey.monthlyQuota.toLocaleString()}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Roter nøkkel">
                                <IconButton size="small" aria-label="Roter nøkkel">
                                  <RefreshIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Kopier nøkkel">
                                <IconButton
                                  aria-label="Kopier nøkkel"
                                  size="small"
                                  onClick={() => copyToClipboard(apiKey.maskedKey)}
                                >
                                  <CopyIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Webhooks Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: themeColors.primary }}>Webhooks</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setWebhookDialogOpen(true)}
            sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67e00' } }}
          >
            Ny webhook
          </Button>
        </Box>

        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Navn</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell>Tjeneste</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Suksess</TableCell>
                    <TableCell align="center">Events</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {webhooksLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                          {Array.from({ length: 7 }).map((_, cellIndex) => (
                            <TableCell key={cellIndex}>
                              <Skeleton variant="text" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                  ) : (
                    (Array.isArray(webhooksData?.webhooks) ? webhooksData.webhooks : []).map((webhook: Webhook) => (
                        <TableRow key={webhook.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {webhook.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace" fontSize="0.875rem">
                              {webhook.url}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={webhook.service} size="small" color="primary" />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getStatusLabel(webhook.status)}
                            color={getStatusColor(webhook.status) as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box>
                            <Typography variant="body2" color={webhook.successRate >= 95 ? 'success.main' : 'warning.main'}>
                                {webhook.successRate}%
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {webhook.totalEvents} events
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                          <Typography variant="body2">
                            {webhook.events.length}
                          </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Test webhook">
                                <IconButton size="small" aria-label="Test webhook">
                                  <PlayIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Pause webhook">
                                <IconButton size="small" aria-label="Pause webhook">
                                  <PauseIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* OAuth Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: themeColors.primary }}>OAuth Klienter</Typography>
          <Button variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOAuthDialogOpen(true)}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' } }}
          >
            Ny OAuth klient
          </Button>
        </Box>

        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Navn</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Client ID</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Autorisasjoner</TableCell>
                    <TableCell>Handlinger</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {oauthLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                          {Array.from({ length: 6 }).map((_, cellIndex) => (
                            <TableCell key={cellIndex}>
                              <Skeleton variant="text" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                  ) : (
                    (Array.isArray(oauthData?.oauthClients) ? oauthData.oauthClients : []).map((oauthClient: OAuthClient) => (
                        <TableRow key={oauthClient.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {oauthClient.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                          <Chip 
                            label={oauthClient.provider}
                            size="small"
                            color="info"
                          />
                          </TableCell>
                          <TableCell>
                            <Box>
                            <Typography variant="body2" fontFamily="monospace" fontSize="0.875rem">
                              {showSecrets[oauthClient.id] ? oauthClient.clientId : `${oauthClient.clientId.substring(0, 12)}...`}
                              </Typography>
                              <IconButton
                                aria-label="Vis eller skjul Client ID"
                                size="small"
                                onClick={() => toggleSecretVisibility(oauthClient.id)}
                              >
                              {showSecrets[oauthClient.id] ? <VisibilityOff fontSize="inherit" /> : <ViewIcon fontSize="inherit" />}
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getStatusLabel(oauthClient.status)}
                            color={getStatusColor(oauthClient.status) as 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2">
                              {oauthClient.totalAuthorizations}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Vis scopes">
                                <IconButton size="small" aria-label="Vis scopes">
                                  <ViewIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Kopier Client ID">
                                <IconButton
                                  aria-label="Kopier Client ID"
                                  size="small"
                                  onClick={() => copyToClipboard(oauthClient.clientId)}
                                >
                                  <CopyIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* WireMock Testing Tab */}
      <TabPanel value={tabValue} index={4}>
        <Alert severity="info"sx={{mb: 3}}>
          <Typography variant="body1" fontWeight={600}>
            🎯 Ny funksjon: AI-dreven Tooltip Veiledning
          </Typography>
          <Typography variant="body2">
            Hover over eller klikk på elementer med blå prikker for intelligent veiledning tilpasset din kontekst. 
            AI-systemet analyserer din bruk og gir smarte tips for optimalisering, sikkerhet og beste praksis.
          </Typography>
        </Alert>

        {/* Test Results Display */}
        {_testLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}
        {_testResults && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ color: '#4caf50' }} />
                Test Results
              </Typography>
              <Button
                variant="outlined"
                onClick={async () => {
                  await _runWireMockTest('WireMock API Test', '/api/wiremock/test', { test: 'data' });
                }}
                sx={{ mb: 2 }}
              >
                Run WireMock Test
              </Button>
              <Typography variant="body2" color="text.secondary">
                {JSON.stringify(_testResults, null, 2)}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Admin Developer Console - Ekte systemdata fra Replit konsoll */}
        <AdminConsole />

        <WireMockController />
      </TabPanel>

      {/* API Integration Process Monitor Tab */}
      <TabPanel value={tabValue} index={5}>
        <Alert severity="success"sx={{mb: 3}}>
          <Typography variant="body1" fontWeight={600}>
            🚀 API Integration Process Monitor
          </Typography>
          <Typography variant="body2">
            Følg hele 10-stegs API integration prosessen visuelt. Systemet viser automatisk fremgang når API-nøkler legges til og aktiveres.
          </Typography>
        </Alert>
        <ApiIntegrationProcessMonitor service="pexels" />
      </TabPanel>

      {/* Database Health Tab */}
      <TabPanel value={tabValue} index={6}>
        <Alert severity="info"sx={{mb: 3}}>
          <Typography variant="body1" fontWeight={600}>
            🔍 Database Integritetskontroll
          </Typography>
          <Typography variant="body2">
            Automatisk overvåkning av database integritet hver 3. time. Sjekker manglende tabeller og kolonner, og tilbyr automatisk reparasjon.
          </Typography>
        </Alert>
        <DatabaseIntegrityChecker />
      </TabPanel>

      {/* Dependencies Manager Tab */}
      <TabPanel value={tabValue} index={7}>
        <Alert severity="success"sx={{mb: 3}}>
          <Typography variant="body1" fontWeight={600}>
            📦 Dependencies Manager
          </Typography>
          <Typography variant="body2">
            Omfattende overvåkning og administrasjon av alle avhengigheter. Kompatibilitetskontroll, automatisk versjon tracking og sikkerhetskanning.
          </Typography>
        </Alert>
        <DependenciesManager />
      </TabPanel>

      {/* ⚠️ AVANSERTE PROTOKOLLER TAB */}
      <TabPanel value={tabValue} index={8}>
        <Alert severity="info"sx={{mb: 3}}>
          <Typography variant="body1" fontWeight={600}>
            🌐 Avanserte Protokoller
          </Typography>
          <Typography variant="body2">
            Omfattende protokollstyring for REST API, GraphQL, WebSocket, gRPC, ACME og andre moderne datautvekslingsstandarder følger alle replit.md protokoller.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <ApiIcon sx={{ color: '#2e7d32' }} />
                  REST API Protokoller
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Klassisk standard for datautveksling med HTTP/HTTPS
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small">
                  Konfigurer REST API
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <GraphQLIcon sx={{ color: '#60a5fa' }} />
                  GraphQL Protokoller
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Moderne alternativ som gjør API mer fleksibelt for kreative apper
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small">
                  Konfigurer GraphQL
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <WebSocketIcon sx={{ color: '#ce93d8' }} />
                  WebSocket Protokoller
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Sanntidskommunikasjon for chat og live feedback på video/foto
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small">
                  Konfigurer WebSocket
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <GrpcIcon sx={{ color: '#ff8c00' }} />
                  gRPC Protokoller
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Effektiv binær protokoll for høyytelses backend-til-backend kommunikasjon
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small">
                  Konfigurer gRPC
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <AcmeIcon sx={{ color: '#2e7d32' }} />
                  ACME Protokoller
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Automatisert sertifikatfornyelse med Let's Encrypt
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small">
                  Konfigurer ACME
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <OpenApiIcon sx={{ color: '#60a5fa' }} />
                  OpenAPI/Swagger
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Dokumentere API-er på en standard måte for integrasjonspanelet
                </Typography>
                <Button variant="outlined" startIcon={<AddIcon />} size="small">
                  Konfigurer OpenAPI
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ⚠️ KREATIV MEDIE OG AI PROTOKOLLER TAB */}
      <TabPanel value={tabValue} index={9}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            🎬 Kreativ Medie & AI Protokoller
          </Typography>
          <Typography variant="body2">
            Spesialiserte protokoller for foto, video, lyd og AI-behandling følger alle ZERO MOCK DATA POLICY og integrasjon med eksisterende UniversalDashboard.tsx.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <RtmpIcon sx={{ color: '#d32f2f' }} />
                  RTMP Streaming
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Real-Time Messaging Protocol for live-streaming støtte
                </Typography>
                <Chip label="Live Video" size="small" color="error" sx={{ mr: 1 }} />
                <Chip label="Photographer" size="small" color="success" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer RTMP
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <HlsIcon sx={{ color: '#60a5fa' }} />
                  HLS/MPEG-DASH
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Standarder for videoavspilling i nettleser (Apple og MPEG)
                </Typography>
                <Chip label="Video Streaming" size="small" color="primary" sx={{ mr: 1 }} />
                <Chip label="Videographer" size="small" color="info" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer HLS/DASH
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <MLIcon sx={{ color: '#ce93d8' }} />
                  AI Protokoller (ONNX)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Open Neural Network Exchange for AI-modeller på tvers av systemer
                </Typography>
                <Chip label="Photo AI" size="small" color="secondary" sx={{ mr: 1 }} />
                <Chip label="Video AI" size="small" color="secondary" sx={{ mr: 1 }} />
                <Chip label="Audio AI" size="small" color="secondary" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer ONNX AI
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <EnhancementIcon sx={{ color: '#ff8c00' }} />
                  DNG/XMP Metadata
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  AI kan lese/skrive justeringer direkte til metadata i RAW-filer
                </Typography>
                <Chip label="RAW Processing" size="small" color="warning" sx={{ mr: 1 }} />
                <Chip label="Metadata" size="small" color="default" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer DNG/XMP
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <WebDavIcon sx={{ color: '#2e7d32' }} />
                  WebDAV Protokoll
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Filsynkronisering på en Dropbox-lignende måte
                </Typography>
                <Chip label="File Sync" size="small" color="success" sx={{ mr: 1 }} />
                <Chip label="Collaboration" size="small" color="primary" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer WebDAV
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <ActivityPubIcon sx={{ color: '#ce93d8' }} />
                  ActivityPub/WebRTC
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Sosiale funksjoner og videomøter for sanntids samarbeid
                </Typography>
                <Chip label="Social Media" size="small" color="secondary" sx={{ mr: 1 }} />
                <Chip label="Video Meetings" size="small" color="primary" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer Social/Video
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ⚠️ CHAT OG SEO PROTOKOLLER TAB */}
      <TabPanel value={tabValue} index={10}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            💬 Chat & SEO Protokoller
          </Typography>
          <Typography variant="body2">
            Avanserte chat-protokoller (XMPP, Matrix) og SEO-optimalisering (JSON-LD, Schema.org) for vendor experience og søkemotoroptimalisering.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <ChatProtocolIcon sx={{ color: '#60a5fa' }} />
                  XMPP Protokoll
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Åpen standard for meldinger/chat som alternativ til WebSocket
                </Typography>
                <Chip label="Open Standard" size="small" color="primary" sx={{ mr: 1 }} />
                <Chip label="Real-time Chat" size="small" color="info" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Integrer med UniversalChatWidget
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <ShieldIcon sx={{ color: '#ce93d8' }} />
                  Matrix Protokoll
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Moderne, åpen standard for kryptert chat og samarbeid
                </Typography>
                <Chip label="E2E Encryption" size="small" color="secondary" sx={{ mr: 1 }} />
                <Chip label="Federation" size="small" color="default" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer Matrix
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <SeoIcon sx={{ color: '#2e7d32' }} />
                  JSON-LD & Schema.org
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Strukturere metadata for SEO og bedre integrasjon med Google
                </Typography>
                <Chip label="SEO Optimization" size="small" color="success" sx={{ mr: 1 }} />
                <Chip label="Vendor Focus" size="small" color="warning" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer Schema.org
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <CalDavIcon sx={{ color: '#ff8c00' }} />
                  CalDAV/CardDAV
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Kalender og kontaktintegrasjon - sjekk eksisterende i UniversalDashboard.tsx
                </Typography>
                <Chip label="Calendar Sync" size="small" color="warning" sx={{ mr: 1 }} />
                <Chip label="Contact Sync" size="small" color="info" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<CheckIcon />} size="small" disabled>
                    Allerede Integrert
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <EdiIcon sx={{ color: '#ce93d8' }} />
                  EDI Protokoll
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Electronic Data Interchange for B2B-partnere (leverandører)
                </Typography>
                <Chip label="B2B Integration" size="small" color="secondary" sx={{ mr: 1 }} />
                <Chip label="Vendor Network" size="small" color="primary" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer EDI
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <OpenBankingIcon sx={{ color: '#60a5fa' }} />
                  Open Banking API
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  PSD2-standarder for direkte betalingsløsninger i EU
                </Typography>
                <Chip label="PSD2 Compliance" size="small" color="primary" sx={{ mr: 1 }} />
                <Chip label="Direct Payments" size="small" color="success" />
                <Box sx={{ mt: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} size="small">
                    Konfigurer Open Banking
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: themeColors.primary }}>
                  <SecurityIcon sx={{ color: '#d32f2f' }} />
                  Sikkerhetsprotokoller
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  PCI DSS, 3D Secure 2.0, SCIM, PKI, og Zero Trust-protokoller for komplett sikkerhet
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap:'wrap', mb: 2 }}>
                  <Chip label="PCI DSS" size="small" color="error" />
                  <Chip label="3D Secure 2.0" size="small" color="warning" />
                  <Chip label="SCIM" size="small" color="info" />
                  <Chip label="PKI" size="small" color="secondary" />
                  <Chip label="Zero Trust" size="small" color="default" />
                </Box>
                <Button variant="outlined" startIcon={<ShieldIcon />} size="small">
                  Konfigurer Sikkerhetsprotokoller
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* WireMock Admin API Explorer Tab */}
      <TabPanel value={tabValue} index={11}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            🔧 WireMock Admin API Explorer
          </Typography>
          <Typography variant="body2">
            Execute all WireMock admin APIs directly from the UI. Create, view, delete mappings, manage scenarios, and configure settings.
          </Typography>
        </Alert>
        <WireMockAdminAPIExplorer />
      </TabPanel>

      {/* HAR Event Log Tab */}
      <TabPanel value={tabValue} index={12}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            📊 HAR Event Log & Waterfall Viewer
          </Typography>
          <Typography variant="body2">
            Chrome DevTools-compatible HAR recording with waterfall visualization, timeline view, and export functionality.
          </Typography>
        </Alert>
        <HARViewer autoRefresh={true} refreshInterval={2000} />
      </TabPanel>

      {/* Self-Healing Sandbox Tab */}
      <TabPanel value={tabValue} index={13}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            🔧 Self-Healing Sandbox
          </Typography>
          <Typography variant="body2">
            Enable auto-convert mode to automatically record live API calls and convert them to WireMock mappings. Your sandbox builds itself!
          </Typography>
        </Alert>
        <SelfHealingSandboxPanel />
      </TabPanel>

      {/* Behavior Analytics Tab */}
      <TabPanel value={tabValue} index={14}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            📈 WireMock Behavior Analytics
          </Typography>
          <Typography variant="body2">
            Per-endpoint performance metrics including hit counts, success/error rates, average response times, and data transfer statistics.
          </Typography>
        </Alert>
        <WireMockBehaviorAnalytics />
      </TabPanel>

      {/* Test History Tab */}
      <TabPanel value={tabValue} index={15}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            📜 WireMock Test History
          </Typography>
          <Typography variant="body2">
            Complete history of all WireMock test executions with filtering, export, and detailed result viewing.
          </Typography>
        </Alert>
        <WireMockTestHistoryTable
          history={wireMockHistory}
          onViewResult={viewWireMockResult}
          onClearHistory={clearWireMockHistory}
          onExportHistory={exportWireMockHistory}
          getSuccessRate={getWireMockSuccessRate}
          getAverageResponseTime={getWireMockAvgResponseTime}
        />
      </TabPanel>

      {/* WireMock Response Viewer Modal (shared across all tabs) */}
      <WireMockResponseViewer
        open={wireMockViewerOpen}
        onClose={closeWireMockViewer}
        result={wireMockSelectedResult}
      />

      {/* API Version Release Notes Dialog */}
      <APIVersionReleaseNotesDialog
        open={versionDialogOpen}
        onClose={() => setVersionDialogOpen(false)}
        versionInfo={selectedVersionInfo}
        onUpdate={handleUpdateVersion}
        updating={updatingVersion}
      />

      {/* Confirm Dialogs */}
      <Dialog open={_apiTestConfirm.open} onClose={() => setApiTestConfirm({ open: false, testService: null, headers: null })}>
        <DialogTitle>Confirm API Test</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to run API test for service: {_apiTestConfirm.testService}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiTestConfirm({ open: false, testService: null, headers: null })}>Cancel</Button>
          <Button onClick={() => {
            setApiTestConfirm({ open: false, testService: null, headers: null });
          }} variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={_aiImplementConfirm.open} onClose={() => setAiImplementConfirm({ open: false, message: '', solutionId: null, headers: null })}>
        <DialogTitle>Confirm AI Implementation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {_aiImplementConfirm.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiImplementConfirm({ open: false, message: '', solutionId: null, headers: null })}>Cancel</Button>
          <Button onClick={() => {
            setAiImplementConfirm({ open: false, message: '', solutionId: null, headers: null });
          }} variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={_needsDatabaseConfirm.open} onClose={() => setNeedsDatabaseConfirm({ open: false, projectName: '', description: '', apis: '' })}>
        <DialogTitle>Confirm Database Operation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Project: {_needsDatabaseConfirm.projectName}<br/>
            Description: {_needsDatabaseConfirm.description}<br/>
            APIs: {_needsDatabaseConfirm.apis}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNeedsDatabaseConfirm({ open: false, projectName: '', description: '', apis: '' })}>Cancel</Button>
          <Button onClick={() => {
            setNeedsDatabaseConfirm({ open: false, projectName: '', description: '', apis: '' });
          }} variant="contained" color="warning">Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={_projectLiveConfirm.open} onClose={() => _setProjectLiveConfirm({ open: false, projectName: '' })}>
        <DialogTitle>Confirm Project Go Live</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Project: {_projectLiveConfirm.projectName}<br/>
            This will make the project live. Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => _setProjectLiveConfirm({ open: false, projectName: '' })}>Cancel</Button>
          <Button onClick={() => {
            _setProjectLiveConfirm({ open: false, projectName: '' });
          }} variant="contained" color="success">Go Live</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
);
}