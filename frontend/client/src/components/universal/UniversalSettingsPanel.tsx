/**
 * Universal Settings Panel - Automatisk FAQ for alle profesjoner
 * AUTOMATISK POPULERING: Fungerer for alle nye profesjoner uten manuell konfigurasjon
 */

import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider";
import { useTheming } from '../../utils/theming-helper';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Card as MuiCard,
  CardContent as MuiCardContent,
  Typography,
  Button,
  Tabs as MuiTabs,
  Tab,
  useTheme,
  Chip,
  Alert,
  alpha,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Snackbar,
  MenuItem,
} from '@mui/material';
import {
  Business,
  AttachMoney,
  CloudDone,
  Quiz,
  Settings,
  PhotoLibrary,
  Download,
  CloudDownload,
  Extension,
  Storage,
  AutoFixHigh,
  VideoLibrary,
  MusicNote,
  SmartToy,
  Login,
  Dashboard as DashboardIcon,
  Cancel,
  Refresh,
  MoneyOff,
  CheckCircle,
  Warning,
  CreditCard,
  Add as AddIcon,
  AccountBalance,
  Language,
  Science,
  Link as LinkIcon,
} from '@mui/icons-material';

// Import existing components
import BusinessBrandingSettings from '../BusinessBrandingSettings';
import PriceAdministration from '../PriceAdministration';
import AccountingBillingOverview from '../accounting/AccountingBillingOverview';
import { TutorialFAQIntegration } from '../tutorial/TutorialFAQIntegration';
import { LightroomInteractiveDemo } from './misc/LightroomInteractiveDemo';
import { usePlatformPricing, platformPricingService } from '../../services/PlatformPricingService';
import { lightroomIntegrationService } from '../../services/lightroomIntegrationService';
import { getAllProfessionFeatures } from '@shared/profession-feature-matrix';
import PlanFeaturePreview from '../subscription/PlanFeaturePreview';
import { EnterpriseInquiryForm } from '../enterprise/EnterpriseInquiryForm';
import EnterpriseTeamManagement from '../enterprise/EnterpriseTeamManagement';

// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/hooks/useAuth';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type PaymentHistoryEntry = {
  id: string;
  type?: string | null;
  amount?: number | null;
  planId?: string | null;
  planName?: string | null;
  status?: string | null;
  currency?: string | null;
  createdAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  transactionId?: string | null;
  isInFiken?: boolean;
  refunded?: boolean;
  refundedAt?: string | null;
  refundReason?: string | null;
  refundRequestId?: number | null;
  refundRequestStatus?: 'pending' | 'approved' | 'rejected' | null;
  refundRequestedAt?: string | null;
  receiptSentAt?: string | null;
  receiptUrl?: string | null;
  invoiceUrl?: string | null;
};

type AccountingIntegrationStatus = {
  configured?: boolean;
  provider?: 'fiken' | 'tripletex';
  environment?: 'test' | 'production';
  activationEnabled?: boolean;
  activatedAt?: string | null;
  activatedByName?: string | null;
  status?: 'connected' | 'disconnected' | 'error';
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
};

const formatPaymentDate = (value?: string | null) => {
  if (!value) return 'Ikke tilgjengelig';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ikke tilgjengelig';
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatPaymentAmount = (amount?: number | null, currency?: string | null) => {
  const numericAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = readNonEmptyString(currency) || 'NOK';

  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount} ${normalizedCurrency}`;
  }
};

const getPaymentStatusPresentation = (payment: PaymentHistoryEntry) => {
  if (payment.refunded || payment.status === 'refunded' || payment.refundRequestStatus === 'approved') {
    return { label: 'Refundert', color: 'success' as const };
  }
  if (payment.refundRequestStatus === 'pending') {
    return { label: 'Refundering behandles', color: 'warning' as const };
  }
  if (payment.refundRequestStatus === 'rejected') {
    return { label: 'Refundering avslått', color: 'error' as const };
  }

  switch ((payment.status || '').toLowerCase()) {
    case 'active':
    case 'completed':
      return { label: 'Betalt', color: 'success' as const };
    case 'pending':
      return { label: 'Venter betaling', color: 'warning' as const };
    case 'failed':
    case 'payment_failed':
      return { label: 'Betaling feilet', color: 'error' as const };
    case 'cancelled':
    case 'canceled':
      return { label: 'Kansellert', color: 'default' as const };
    default:
      return { label: payment.status || 'Ukjent status', color: 'default' as const };
  }
};

interface UniversalSettingsPanelProps {
  profession: string;
  userId: string;
  customBranding?: {
    color: string;
    darkColor?: string;
};
  // Integration props for universal workflow connectivity
  onSettingsUpdate?: (settings: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  activeTabValue?: number;
  onTabChange?: (value: number) => void;
}

export const UniversalSettingsPanel: React.FC<UniversalSettingsPanelProps> = ({
  profession,
  userId,
  customBranding = { color: '#1976d2' },
  onSettingsUpdate,
  onProjectUpdate,
  selectedProject,
  onProjectSelect,
  activeTabValue,
  onTabChange,
}) => {
  const [internalSettingsTabValue, setInternalSettingsTabValue] = useState(0);
  const [showFAQDialog, setShowFAQDialog] = useState(false);
  const [autoRedirectToDashboard, setAutoRedirectToDashboard] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showEnterpriseInquiryDialog, setShowEnterpriseInquiryDialog] = useState(false);
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [refundReason, setRefundReason] = useState(' , ');
  const [cancellationReason, setCancellationReason] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'info' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [newWebsiteTarget, setNewWebsiteTarget] = useState({
    name: '',
    domain: '',
    apiKey: '',
    provider: 'norwedfilm' as 'norwedfilm' | 'custom',
    defaultStorage: 'google_drive' as 'google_drive' | 'youtube' | 'custom',
  });
  const [lightroomAction, setLightroomAction] = useState<null | 'download' | 'test' | 'reconnect'>(null);
  const theme = useTheme();
  const { isAdmin } = useAuth();
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Dynamic profession system
  const { professionConfigs, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle, adaptTabLabels } = useProfessionAdapter();
  const { settings } = useSettings();
  const publishingSettings = settings.publishing || { enableWebsitePublish: false, websiteTargets: [] };

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();

  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // UNIVERSAL SETTINGS TABS - works for all active professions
  const universalSettingsTabs = React.useMemo(() => [
    { id: 'business', label: 'Bedriftsprofil', icon: <Business /> },
    { id: 'my-features', label: 'Mine Funksjoner', icon: <Extension /> },
    { id: 'profession-suites', label: 'Profesjons Suiter', icon: <SmartToy /> },
    ...(profession === 'photographer' ? [{ id: 'photo-integrations', label: 'Foto integrasjoner', icon: <PhotoLibrary /> }] : []),
    { id: 'faq', label: 'FAQ Veiledninger', icon: <Quiz /> },
    { id: 'preferences', label: 'Brukerpreferanser', icon: <Settings /> }
  ], [profession]);
  const settingsTabValue = Math.min(
    Math.max(activeTabValue ?? internalSettingsTabValue, 0),
    Math.max(universalSettingsTabs.length - 1, 0)
  );
  const setSettingsTabValue = onTabChange ?? setInternalSettingsTabValue;
  const getSettingsTabIndex = React.useCallback(
    (tabId: string) => {
      const resolvedTabId = tabId === 'backup' || tabId === 'storage' ? 'preferences' : tabId;
      return universalSettingsTabs.findIndex((tab) => tab.id === resolvedTabId);
    },
    [universalSettingsTabs]
  );
  const isBusinessTabActive = settingsTabValue === getSettingsTabIndex('business');
  const isProfessionSuitesTabActive = settingsTabValue === getSettingsTabIndex('profession-suites');
  const isPhotoIntegrationsTabActive = profession === 'photographer' && settingsTabValue === getSettingsTabIndex('photo-integrations');
  const { subscriptionPlans, isLoading: plansLoading } = usePlatformPricing({
    enabled: isBusinessTabActive || isProfessionSuitesTabActive,
  });
  const lightroomStatusQuery = useQuery({
    queryKey: ['universal-settings-lightroom-status', userId],
    queryFn: () => lightroomIntegrationService.getStatus(userId),
    enabled: isPhotoIntegrationsTabActive,
  });

  const handleLightroomDownload = async () => {
    try {
      setLightroomAction('download');
      await lightroomIntegrationService.downloadPluginPackage(false, userId);
      setSnackbar({
        open: true,
        message: 'CreatorHub Lightroom-installasjonspakken lastes ned.',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke laste ned Lightroom-pluginen.',
        severity: 'error',
      });
    } finally {
      setLightroomAction(null);
    }
  };

  const handleLightroomSmokeTest = async () => {
    try {
      setLightroomAction('test');
      await lightroomIntegrationService.runSmokeExport(userId);
      await lightroomStatusQuery.refetch();
      setSnackbar({
        open: true,
        message: 'Lightroom smoke-test fullført. Filen er lagret i Google Drive og publisert til showcase.',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Lightroom smoke-test feilet.',
        severity: 'error',
      });
    } finally {
      setLightroomAction(null);
    }
  };

  const handleLightroomReconnect = async () => {
    setLightroomAction('reconnect');
    try {
      await lightroomIntegrationService.startGoogleWorkspaceReconnect(userId);
    } catch (error) {
      console.error('Lightroom Google reconnect failed:', error);
    } finally {
      setLightroomAction(null);
    }
  };

  // Get profession-specific premium features from feature matrix
  const premiumFeatures = React.useMemo(() => {
    const professionFeatures = getAllProfessionFeatures(profession);
    if (!professionFeatures) return [];

    // Filter for premium/pro features only
    return Object.entries(professionFeatures)
      .filter(([_, feature]: [string, any]) =>
        feature.plan === 'pro' || feature.plan === 'enterprise' || feature.plan === 'marketplace'
      )
      .map(([id, feature]: [string, any]) => ({
        id,
        description: feature.description,
        plan: feature.plan,
        impact: feature.impact
      }))
      .sort((a, b) => {
        // Sort by impact: critical > high > medium > low
        const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (impactOrder[a.impact as keyof typeof impactOrder] || 4) -
               (impactOrder[b.impact as keyof typeof impactOrder] || 4);
      })
      .slice(0, 6); // Show top 6 premium features
  }, [profession]);
  const { data: paymentHistory } = useQuery({
    queryKey: ['/api/payments/history', userId],
    queryFn: () => apiRequest(`/api/payments/history?userId=${encodeURIComponent(userId)}`),
    staleTime: 30000,
    enabled: isBusinessTabActive,
  });
  const { data: accountingIntegrationStatus } = useQuery({
    queryKey: ['/api/accounting/integration/status', userId],
    queryFn: () => apiRequest(`/api/accounting/integration/status?userId=${encodeURIComponent(userId)}`),
    staleTime: 30000,
    enabled: isBusinessTabActive,
  });
  const { data: currentSubscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/user/subscription-status', userId],
    queryFn: () => apiRequest(`/api/user/subscription-status?userId=${encodeURIComponent(userId)}`),
    staleTime: 30000,
    enabled: isBusinessTabActive || isProfessionSuitesTabActive,
  });
  const isEnterprisePlan = (currentSubscription?.selectedPlan || '').toLowerCase() === 'enterprise';

  // Fetch user payment methods
  const { data: paymentMethodsData, refetch: refetchPaymentMethods } = useQuery({
    queryKey: ['/api/user/payment-methods', userId],
    queryFn: () => apiRequest(`/api/user/payment-methods?userId=${encodeURIComponent(userId)}`),
    staleTime: 30000,
    enabled: isBusinessTabActive,
  });
  const paymentHistoryItems = React.useMemo(() => {
    const items = Array.isArray(paymentHistory?.history)
      ? (paymentHistory.history as PaymentHistoryEntry[])
      : [];

    return [...items].sort((left, right) => {
      const leftDate = new Date(left.createdAt || left.currentPeriodStart || 0).getTime();
      const rightDate = new Date(right.createdAt || right.currentPeriodStart || 0).getTime();
      return rightDate - leftDate;
    });
  }, [paymentHistory]);
  const latestPayment = paymentHistoryItems[0] || null;
  const paymentHistorySummary = React.useMemo(() => {
    const approvedRefunds = paymentHistoryItems.filter(
      (payment) =>
        payment.refunded ||
        payment.status === 'refunded' ||
        payment.refundRequestStatus === 'approved',
    );
    const pendingRefunds = paymentHistoryItems.filter(
      (payment) => payment.refundRequestStatus === 'pending',
    );
    const totalVolume = paymentHistoryItems.reduce((sum, payment) => {
      const amount = typeof payment.amount === 'number' && Number.isFinite(payment.amount)
        ? payment.amount
        : 0;
      return sum + amount;
    }, 0);

    return {
      totalPayments: paymentHistoryItems.length,
      approvedRefunds: approvedRefunds.length,
      pendingRefunds: pendingRefunds.length,
      totalVolume,
    };
  }, [paymentHistoryItems]);
  const queryClient = useQueryClient();

  // Comprehensive Feature System for profession suites
  const audioSuiteAccess = features.checkFeatureAccess('audio-enhancement-suite');
  const photoSuiteAccess = features.checkFeatureAccess('photo-enhancement-suite');
  const videoSuiteAccess = features.checkFeatureAccess('video-enhancement-suite');
  const storyArcAccess = features.checkFeatureAccess('story-arc-studio');
  const professionSuitesAccess = features.checkFeatureAccess('profession-suites');
  
  const isAudioSuiteEnabled = audioSuiteAccess.hasAccess;
  const isPhotoSuiteEnabled = photoSuiteAccess.hasAccess;
  const isVideoSuiteEnabled = videoSuiteAccess.hasAccess;
  const isStoryArcEnabled = storyArcAccess.hasAccess;
  const isProfessionSuitesEnabled = professionSuitesAccess.hasAccess;

  // Load user preferences on mount
  React.useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch('/api/user/ui-preferences', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.autoRedirectToDashboard !== undefined) {
            setAutoRedirectToDashboard(data.autoRedirectToDashboard);
          }
        }
      } catch (error) {
        console.error('Failed to load user preferences: ', error);
      }
    };
    loadPreferences();
  }, []);

  // Save auto-redirect preference
  const handleAutoRedirectChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setAutoRedirectToDashboard(newValue);
    setSavingPreferences(true);

    try {
      const response = await fetch('/api/user/ui-preferences', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ autoRedirectToDashboard: newValue })
      });

      if (response.ok) {
        console.log('✅ Auto-redirect preference saved: ', newValue);

        // Also save to localStorage as fallback
        localStorage.setItem('autoRedirectToDashboard', String(newValue));
      } else {
        console.error('Failed to save preference');
      }
    } catch (error) {
      console.error('Error saving auto-redirect preference:', error);
      // Fallback to localStorage
      localStorage.setItem('autoRedirectToDashboard', String(newValue));
    } finally {
      setSavingPreferences(false);
    }
  };

  // Get profession display name (plural form for certain contexts)
  const getProfessionDisplayNamePlural = () => {
    const config = professionConfigs[profession];
    if (!config) return 'din profesjon';

    const displayNames: Record<string, string> = {
      photographer: 'fotografer',
      videographer: 'videografer',
      music_producer: 'musikkprodusenter',
      vendor: 'leverandører'
    };

    return displayNames[profession] || config.displayName?.toLowerCase() || 'din profesjon';
};

  const showLegacyPricingSettings = false;

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'UniversalSettingsPanel',
      name: 'Universal Settings Panel',
      type: 'universal',
      category: 'settings',
      capabilities: ['settings-management','profession-adaptation','faq-management'],
      dependencies: [],
      props: ['profession','userId','customBranding'],
      events: ['settings:update','settings:profession-change'],
      dataKeys: ['settings-data','profession-config','faq-data']
    });

    // Track feature usage
    features.trackFeatureUsage('profession-suites', 'settings_opened, ', {
      timestamp: Date.now(),
      profession: profession,
      userId: userId,
      component: 'UniversalSettingsPanel'
    });

    // Set up data flow nodes
    const settingsNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalSettingsPanel',
      dataKey: 'settings-data'
});

    const professionNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'UniversalSettingsPanel',
      dataKey: 'profession-config'
});

    // Listen for settings events
    const unsubscribeSettings = communication.onMessageType('settings:update', (message: any) => {
      if (message.data.settings && onSettingsUpdate) {
        onSettingsUpdate(message.data.settings);
      }
    });

    const unsubscribeProfession = communication.onMessageType('settings:profession-change', (message: any) => {
      if (message.data.profession) {
        console.log('Profession changed to:', message.data.profession);
      }
    });

    return () => {
      componentRegistry.unregisterComponent('UniversalSettingsPanel');
      dataFlow.unregisterNode(settingsNodeId);
      dataFlow.unregisterNode(professionNodeId);
      unsubscribeSettings();
      unsubscribeProfession();
  };
}, [profession, userId, customBranding, professionConfigs, componentRegistry, dataFlow, communication, onSettingsUpdate]);

  return (
    <Box>
      {/* Universal Settings Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <MuiTabs 
          value={settingsTabValue}
          onChange={(e, newValue) => setSettingsTabValue(newValue)}
          aria-label="universal settings tabs"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              minWidth: 100, '&.Mui-selected': { color: customBranding.color,
                fontWeight: 600}
            }, '& .MuiTabs-indicator': {
              backgroundColor: customBranding.color,
              height: 3,
              borderRadius: '3px 3px 0 0'
            }
          }}
        >
          {universalSettingsTabs.map((tab) => (
            <Tab 
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              iconPosition="start"
              sx={{ gap: 1 }}
            />
          ))}
        </MuiTabs>
        
        {/* Feature Analytics Display */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          gap: 1,
          mt: 1,
          px: 2 }}>
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

      {/* Tab 0: Bedriftsprofil */}
      <TabPanel value={settingsTabValue} index={getSettingsTabIndex('business')}>
        <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <Business sx={{ color: customBranding.color }} />
              Bedriftsprofil & Logo
            </Typography>
            <BusinessBrandingSettings userId={userId} />
            {isAdmin ? (
              <AccountingBillingOverview
                userId={userId}
                accentColor={customBranding.color}
              />
            ) : null}
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab 1: Mine Funksjoner - Feature Access Overview */}
      <TabPanel value={settingsTabValue} index={getSettingsTabIndex('my-features')}>
        <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <Extension sx={{ color: customBranding.color }} />
              Mine Funksjoner
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Oversikt over funksjoner tilgjengelig for din profesjon ({getProfessionDisplayName(profession)}) og abonnementsplan.
              Funksjoner som er deaktivert i systemet vises ikke.
            </Typography>

            {/* Current Plan Info */}
            {currentSubscription?.subscriptionSelected && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle2">
                  Din nåværende plan: <strong>{currentSubscription.planName || currentSubscription.selectedPlan || 'Basic'}</strong>
                </Typography>
              </Alert>
            )}

            {/* Feature Preview Component */}
            <PlanFeaturePreview
              profession={profession}
              selectedPlan={currentSubscription?.selectedPlan || 'basic'}
              showLocked={true}
              showDetails={true}
              maxFeatures={20}
            />

            {/* Plan-specific upgrade paths */}
            {(() => {
              const currentPlan = (currentSubscription?.selectedPlan || 'basic').toLowerCase();

              // Basic → Pro upgrade
              if (currentPlan === 'basic') {
                return (
                  <Box sx={{ mt: 3 }}>
                    <Box sx={{ p: 2, border: `2px solid #2196f3`, borderRadius: 2, bgcolor: 'rgba(33, 150, 243, 0.05)', mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, color: '#2196f3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        🚀 Oppgrader til Pro
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Pro-planen gir deg tilgang til avanserte funksjoner som AI-verktøy,
                        custom branding, prioritert support og API-tilgang. Perfekt for profesjonelle
                        som ønsker å ta virksomheten til neste nivå.
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setShowUpgradeDialog(true)}
                        sx={{ bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' } }}
                      >
                        Oppgrader til Pro
                      </Button>
                    </Box>

                    {/* Enterprise teaser for Basic users */}
                    <Box sx={{ p: 2, border: `1px dashed #9c27b0`, borderRadius: 2, bgcolor: 'rgba(156, 39, 176, 0.03)' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: '#9c27b0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        🏢 Enterprise - For team og bedrifter
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Enterprise-planen er designet for team og bedrifter med flere brukere.
                        Inkluderer white-label, dedikert support, SLA-garanti og avanserte sikkerhetsinnstillinger.
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kontakt oss for å diskutere enterprise-løsninger for ditt team.
                      </Typography>
                    </Box>
                  </Box>
                );
              }

              // Pro → Enterprise upgrade
              if (currentPlan === 'pro') {
                return (
                  <Box sx={{ mt: 3, p: 2, border: `2px solid #9c27b0`, borderRadius: 2, bgcolor: 'rgba(156, 39, 176, 0.05)' }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, color: '#9c27b0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                      🏢 Oppgrader til Enterprise
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Enterprise-planen er designet for <strong>team og bedrifter</strong> med flere brukere.
                      Du får tilgang til:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2, mb: 2 }}>
                      <Typography component="li" variant="body2" color="text.secondary">White-label med fullstendig merkevarebygging</Typography>
                      <Typography component="li" variant="body2" color="text.secondary">Dedikert support med navngitt kontakt</Typography>
                      <Typography component="li" variant="body2" color="text.secondary">SLA-garanti og oppetidsforpliktelser</Typography>
                      <Typography component="li" variant="body2" color="text.secondary">Egendefinerte integrasjoner og API-utvidelser</Typography>
                      <Typography component="li" variant="body2" color="text.secondary">Multi-lokasjon og team-administrasjon</Typography>
                      <Typography component="li" variant="body2" color="text.secondary">Avanserte sikkerhetsinnstillinger og revisjonsspor</Typography>
                    </Box>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Merk:</strong> Enterprise er team-basert og krever minimum 3 brukere.
                        Alle team-medlemmer må ha Google Workspace for full funksjonalitet.
                      </Typography>
                    </Alert>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setShowEnterpriseInquiryDialog(true)}
                      sx={{ bgcolor: '#9c27b0','&:hover': { bgcolor: '#7b1fa2' } }}
                    >
                      Send Enterprise-forespørsel
                    </Button>
                  </Box>
                );
              }

              // Enterprise users - show team management and marketplace options
              if (currentPlan === 'enterprise') {
                return (
                  <>
                    {/* Team Management Section */}
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, color: '#9c27b0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        👥 Administrer ditt Enterprise-team
                      </Typography>
                      <EnterpriseTeamManagement
                        organizationId={currentSubscription?.organizationNumber || userId}
                        currentUserCount={3}
                        profession={profession}
                      />
                    </Box>

                  </>
                );
              }

              return null;
            })()}
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {showLegacyPricingSettings && (
        <>
      {/* Tab 2: Prisadministrasjon */}
      <TabPanel value={settingsTabValue} index={2}>
        <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <AttachMoney sx={{ color: customBranding.color }} />
              Prisadministrasjon
            </Typography>
            <PriceAdministration />

            {/* Simple plan upgrade CTA */}
            <Box sx={{ mt: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ mb: 1, color: theming.colors.primary }}>
                Oppgrader abonnement
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Velg en plan som passer bedre. Du kan endre plan og fullføre betaling på neste side.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {!plansLoading && (subscriptionPlans || []).map((p: any) => (
                  <Chip key={p.id} label={`${p.displayName || p.name} – ${p.price} ${p.currency}/mnd`} size="small" />
                ))}
              </Box>
              {/* Impact preview: show feature access per plan for current profession */}
              {!plansLoading && (
                <Box sx={{ mb: 2 }}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Slik påvirker oppgradering tilgang for {profession}.
                  </Alert>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 1 }}>
                    {(subscriptionPlans as any[] || []).map((p) => {
                      const planId = (p.name || p.id || '').toString().toLowerCase();
                      const features = getAllProfessionFeatures(profession) as any[];
                      const rank = (tier: string) => ({ free: 0, basic: 1, professional: 2, premium: 2, enterprise: 3 }[tier] ?? 0);
                      const reqRank = (req: string) => ({ basic: 1, pro: 2, enterprise: 3 }[req] ?? 0);
                      const available = features.filter((f) => reqRank(f.plan || 'basic') <= rank(planId));
                      const proOnly = features.filter((f) => reqRank(f.plan || 'basic') === 2);
                      const entOnly = features.filter((f) => reqRank(f.plan || 'basic') === 3);
                      const marketplace = features.filter((f) => f.plan === 'marketplace');
                      return (
                        <Box key={p.id} sx={{ p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ color: theming.colors.primary }}>
                            {p.displayName || p.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Tilgjengelige funksjoner: {available.length}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                            <Chip size="small" label={`Pro-krever: ${proOnly.length}`} color="warning" variant="outlined" />
                            <Chip
                              size="small"
                              label={`Enterprise-krever: ${entOnly.length}`}
                              color="error"
                              variant="outlined"
                              clickable
                              onClick={() => {
                                // Enterprise-låste funksjoner krever team-registrering
                                window.location.href = `/onboarding?flow=team&plan=${encodeURIComponent(p.id)}`;
                              }}
                            />
                            <Chip size="small" label={`Marketplace: ${marketplace.length}`} variant="outlined" />
                          </Box>
                          {entOnly.length > 0 && (
                            <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                              Enterprise-funksjoner krever team-registrering. Klikk chippen for å registrere team.
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
              <Button
                variant="contained"
                onClick={() => {
                  try {
                    platformPricingService.clearCache();
                    queryClient.invalidateQueries({ queryKey: ['platform_subscription_plans'] });
                  } catch {}
                  window.location.href = `/subscription?profession=${encodeURIComponent(profession)}`;
                }}
                sx={{ bgcolor: customBranding.color, '&:hover': { bgcolor: customBranding.darkColor || customBranding.color } }}
              >
                Gå til abonnementsvalg
              </Button>

              {/* Payment History */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, color: theming.colors.primary, fontWeight: 700 }}>
                  Betaling, faktura og historikk
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Her ser du hva som er betalt, hva som er refundert, og hvilke kvitteringer eller fakturaer som er klare.
                </Typography>
                {accountingIntegrationStatus?.activationEnabled ? (
                  <Alert
                    severity={
                      accountingIntegrationStatus?.status === 'connected'
                        ? 'success'
                        : accountingIntegrationStatus?.status === 'error'
                          ? 'warning'
                          : 'info'
                    }
                    sx={{ mb: 2 }}
                  >
                    {accountingIntegrationStatus?.status === 'connected'
                      ? 'Regnskapsflyten er aktivert og koblet til. Fakturaer, kvitteringer og regnskapsgrunnlag vises fortløpende her.'
                      : accountingIntegrationStatus?.status === 'error'
                        ? 'Regnskapsflyten er aktivert, men koblingen trenger oppfølging fra admin før alle dokumenter blir tilgjengelige.'
                        : 'Regnskapsflyten er aktivert av admin og klargjøres for brukeren.'}
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Betalinger og kvitteringer vises her. Fiken eller Tripletex kan aktiveres av CreatorHub admin ved behov.
                  </Alert>
                )}
                {!paymentHistoryItems.length ? (
                  <Alert severity="info">Ingen betalinger funnet.</Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                        gap: 2,
                      }}
                    >
                      <Box sx={{ p: 2, border: '1px solid #e8edf3', borderRadius: 2, bgcolor: '#fff' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Registrerte betalinger
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary, mt: 0.5 }}>
                          {paymentHistorySummary.totalPayments}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, border: '1px solid #e8edf3', borderRadius: 2, bgcolor: '#fff' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Totalt betalt
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: theming.colors.primary, mt: 0.5 }}>
                          {formatPaymentAmount(paymentHistorySummary.totalVolume, latestPayment?.currency || currentSubscription?.currency || 'NOK')}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, border: '1px solid #e8edf3', borderRadius: 2, bgcolor: '#fff' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Dokumenter klare
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                          {paymentHistoryItems.filter((payment) => payment.receiptUrl || payment.invoiceUrl).length}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 2, border: '1px solid #e8edf3', borderRadius: 2, bgcolor: '#fff' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Refunderinger
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: paymentHistorySummary.approvedRefunds > 0 ? '#2e7d32' : 'text.primary', mt: 0.5 }}>
                          {paymentHistorySummary.approvedRefunds}
                        </Typography>
                      </Box>
                    </Box>

                    {latestPayment && (
                      <Box
                        sx={{
                          p: 2.5,
                          border: '1px solid #e8edf3',
                          borderRadius: 2,
                          bgcolor: alpha(customBranding.color, 0.04),
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          Siste registrerte betaling
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {latestPayment.planName || latestPayment.planId || 'Betaling'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatPaymentDate(latestPayment.createdAt || latestPayment.currentPeriodStart)}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                              {formatPaymentAmount(latestPayment.amount, latestPayment.currency)}
                            </Typography>
                            <Chip
                              size="small"
                              color={getPaymentStatusPresentation(latestPayment).color}
                              label={getPaymentStatusPresentation(latestPayment).label}
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {paymentHistoryItems.slice(0, 10).map((payment, idx) => {
                        const statusPresentation = getPaymentStatusPresentation(payment);

                        return (
                          <Box
                            key={payment.id || `${payment.transactionId || 'payment'}-${idx}`}
                            sx={{
                              p: 2,
                              border: '1px solid #e8edf3',
                              borderRadius: 2,
                              bgcolor: '#fff',
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                  {payment.planName || payment.planId || 'Betaling'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Registrert {formatPaymentDate(payment.createdAt || payment.currentPeriodStart)}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                  {formatPaymentAmount(payment.amount, payment.currency)}
                                </Typography>
                                <Chip
                                  size="small"
                                  color={statusPresentation.color}
                                  label={statusPresentation.label}
                                  sx={{ mt: 0.5 }}
                                />
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                              {payment.receiptUrl || payment.invoiceUrl ? (
                                <Chip size="small" color="success" variant="outlined" label="Dokumenter klare" />
                              ) : (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={
                                    accountingIntegrationStatus?.activationEnabled
                                      ? 'Flere dokumenter kommer'
                                      : 'Kun betalingshistorikk tilgjengelig'
                                  }
                                />
                              )}
                              {payment.refundRequestStatus === 'rejected' && (
                                <Chip size="small" color="error" variant="outlined" label="Refundering avslått" />
                              )}
                              {payment.currentPeriodEnd && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`Tilgang til ${formatPaymentDate(payment.currentPeriodEnd)}`}
                                />
                              )}
                            </Box>

                            <Box
                              sx={{
                                mt: 1.5,
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr auto' },
                                gap: 1.5,
                                alignItems: 'start',
                              }}
                            >
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                                  Transaksjons-ID
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                    color: 'text.secondary',
                                  }}
                                >
                                  {payment.transactionId || payment.id}
                                </Typography>
                              </Box>

                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                                  Refundering
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {payment.refundedAt
                                    ? `Behandlet ${formatPaymentDate(payment.refundedAt)}`
                                    : payment.refundRequestedAt
                                      ? `Forespurt ${formatPaymentDate(payment.refundRequestedAt)}`
                                      : 'Ingen refundering registrert'}
                                </Typography>
                                {payment.refundReason && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Årsak: {payment.refundReason}
                                  </Typography>
                                )}
                              </Box>

                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 1 }}>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                                  {payment.receiptUrl ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="a"
                                      href={payment.receiptUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Åpne kvittering
                                    </Button>
                                  ) : null}
                                  {payment.invoiceUrl ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      component="a"
                                      href={payment.invoiceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Åpne faktura
                                    </Button>
                                  ) : null}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                                  {payment.receiptSentAt
                                    ? `Kvittering registrert ${formatPaymentDate(payment.receiptSentAt)}`
                                    : 'Kvittering er tilgjengelig i historikken.'}
                                </Typography>
                                {!payment.invoiceUrl && (
                                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                                    {accountingIntegrationStatus?.activationEnabled
                                      ? 'Faktura og regnskapsgrunnlag blir tilgjengelig her når de er klare.'
                                      : 'Faktura og regnskapsgrunnlag blir synlige her hvis regnskapsflyten aktiveres.'}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>

                    {paymentHistoryItems.length > 10 && (
                      <Typography variant="caption" color="text.secondary">
                        Viser de 10 siste betalingene av totalt {paymentHistoryItems.length}.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Subscription Management Section */}
              <Box sx={{ mt: 4 }}>
                <Divider sx={{ mb: 3 }} />
                <Typography variant="subtitle1" sx={{ mb: 2, color: theming.colors.primary, fontWeight: 600}}>
                  Abonnementshåndtering
                </Typography>

                {/* Current Subscription Status */}
                {currentSubscription && (
                  <Box sx={{ mb: 3, p: 3, border: '2px solid #eee', borderRadius: 2, bgcolor: '#fafafa' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          Nåværende abonnement
                        </Typography>
                        <Typography variant="h5" sx={{ color: customBranding.color, mt: 0.5, fontWeight: 700}}>
                          {currentSubscription.planName || 'Gratis'}
                        </Typography>
                        {currentSubscription.memberSince && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <CheckCircle sx={{ fontSize: 14 }} />
                            Medlem siden {new Date(currentSubscription.memberSince).toLocaleDateString('nb-NO', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={currentSubscription.subscriptionSelected ? 'Aktiv' : 'Inaktiv'}
                        color={currentSubscription.subscriptionSelected ? 'success' : 'default'}
                        icon={currentSubscription.subscriptionSelected ? <CheckCircle /> : <Warning />}
                        sx={{ fontSize: '0.875rem', fontWeight: 600}}
                      />
                    </Box>

                    {currentSubscription.subscriptionSelected && (
                      <>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 2 }}>
                          <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                              Månedlig beløp
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: customBranding.color }}>
                              {currentSubscription.amount || 0} {currentSubscription.currency || 'NOK'}
                            </Typography>
                          </Box>
                          <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                              Neste fakturering
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                              {currentSubscription.nextBillingDate
                                ? new Date(currentSubscription.nextBillingDate).toLocaleDateString('nb-NO', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                : 'Ikke tilgjengelig'}
                            </Typography>
                          </Box>
                          <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600}}>
                              Tilgang til
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                              {currentSubscription.accessUntil
                                ? new Date(currentSubscription.accessUntil).toLocaleDateString('nb-NO', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })
                                : currentSubscription.nextBillingDate
                                  ? new Date(currentSubscription.nextBillingDate).toLocaleDateString('nb-NO', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : 'Aktiv'}
                            </Typography>
                          </Box>
                        </Box>

                        {currentSubscription.paymentCompleted && (
                          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />}>
                            <Typography variant="body2" sx={{ fontWeight: 600}}>
                              ✅ Betaling bekreftet
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Transaksjons-ID: {currentSubscription.transactionId || 'N/A'}
                            </Typography>
                          </Alert>
                        )}

                        {/* Subscription Actions */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Refresh />}
                            onClick={() => setShowUpgradeDialog(true)}
                            sx={{ borderColor: customBranding.color, color: customBranding.color }}
                          >
                            Endre abonnement
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            startIcon={<Cancel />}
                            onClick={() => setShowCancelDialog(true)}
                          >
                            Kanseller abonnement
                          </Button>
                        </Box>
                      </>
                    )}

                    {!currentSubscription.subscriptionSelected && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          window.location.href = `/subscription?profession=${encodeURIComponent(profession)}`;
                        }}
                        sx={{
                          bgcolor: customBranding.color,
                          '&:hover': { bgcolor: customBranding.darkColor || customBranding.color }
                        }}
                      >
                        Velg abonnement
                      </Button>
                    )}
                  </Box>
                )}

                {/* Refund Management */}
                {paymentHistory?.history?.length > 0 && (
                  <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      Refunderingshåndtering
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      Be om refundering for betalinger innen 30 dager
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {paymentHistory.history.slice(0, 3).map((payment: any, idx: number) => {
                        const paymentDate = new Date(payment.createdAt || payment.currentPeriodStart || Date.now());
                        const daysSincePayment = Math.floor((Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
                        const refundRequestPending = payment.refundRequestStatus === 'pending';
                        const refundRequestRejected = payment.refundRequestStatus === 'rejected';
                        const canRefund =
                          daysSincePayment <= 30 &&
                          payment.status === 'active' &&
                          !payment.refunded &&
                          !refundRequestPending;

                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              p: 1.5,
                              bgcolor: '#f9f9f9',
                              borderRadius: 1
                            }}
                          >
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600}}>
                                {payment.planName || payment.planId || 'Betaling'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {paymentDate.toLocaleDateString('nb-NO')} - {payment.amount} {payment.currency || 'NOK'}
                              </Typography>
                            </Box>
                            {canRefund ? (
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<MoneyOff />}
                                onClick={() => {
                                  setSelectedPaymentForRefund(payment);
                                  setShowRefundDialog(true);
                                }}
                              >
                                Be om refundering
                              </Button>
                            ) : (
                              <Chip
                                label={
                                  payment.refunded
                                    ? 'Refundert'
                                    : refundRequestPending
                                      ? 'Venter behandling'
                                      : refundRequestRejected
                                        ? 'Avslått'
                                        : 'Ikke refunderbar'
                                }
                                size="small"
                                color={
                                  payment.refunded
                                    ? 'success'
                                    : refundRequestPending
                                      ? 'warning'
                                      : refundRequestRejected
                                        ? 'error'
                                        : 'default'
                                }
                              />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* Payment Methods Section */}
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CreditCard sx={{ color: customBranding.color }} />
                    Betalingsmetoder
                  </Typography>

                  <Box sx={{ p: 2, border: '1px solid #eee', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      Lagrede betalingsmetoder
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      Administrer dine lagrede betalingsmetoder
                    </Typography>

                    {paymentMethodsData?.paymentMethods?.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                        {paymentMethodsData.paymentMethods.map((method: any) => (
                          <Box
                            key={method.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              p: 1.5,
                              bgcolor: '#f9f9f9',
                              borderRadius: 1,
                              border: method.is_default ? `2px solid ${customBranding.color}` : '1px solid #eee'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <CreditCard sx={{ color: customBranding.color }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600}}>
                                  {method.payment_type === 'google_pay' ? '🔵 Google Pay' : `💳 ${method.payment_type}`}
                                  {method.last_four && ` •••• ${method.last_four}`}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {method.expiry_month && method.expiry_year && `Utløper ${method.expiry_month}/${method.expiry_year}`}
                                  {method.is_default && (
                                    <Chip
                                      label="Standard"
                                      size="small"
                                      sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                                      color="success"
                                    />
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {!method.is_default && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={async () => {
                                    try {
                                      await apiRequest(`/api/user/payment-methods/${method.id}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ isDefault: true })
                                      });
                                      refetchPaymentMethods();
                                    } catch (error) {
                                      console.error('Failed to set default:', error);
                                    }
                                  }}
                                >
                                  Sett som standard
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                startIcon={<MoneyOff />}
                                onClick={() => {
                                  setConfirmDialog({
                                    open: true,
                                    title: 'Slett betalingsmetode',
                                    message: 'Er du sikker på at du vil slette denne betalingsmetoden?',
                                    onConfirm: async () => {
                                      try {
                                        await apiRequest(`/api/user/payment-methods/${method.id}`, {
                                          method: 'DELETE'
                                        });
                                        refetchPaymentMethods();
                                        setSnackbar({ open: true, message: 'Betalingsmetode slettet', severity: 'success' });
                                      } catch (error) {
                                        console.error('Failed to delete:', error);
                                        setSnackbar({ open: true, message: 'Kunne ikke slette betalingsmetode', severity: 'error' });
                                      }
                                      setConfirmDialog(prev => ({ ...prev, open: false }));
                                    }
                                  });
                                }}
                              >
                                Slett
                              </Button>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Ingen betalingsmetoder lagret ennå. Legg til en betalingsmetode for raskere betaling.
                      </Alert>
                    )}

                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      sx={{ borderColor: customBranding.color, color: customBranding.color }}
                      onClick={() => setShowPaymentMethodDialog(true)}
                    >
                      Legg til betalingsmetode
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </MuiCardContent>
        </MuiCard>
      </TabPanel>
        </>
      )}

      {/* Tab 4: Profession Suites */}
      <TabPanel value={settingsTabValue} index={getSettingsTabIndex('profession-suites')}>
        <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <SmartToy sx={{ color: customBranding.color }} />
              Profesjons Suiter
              {!isProfessionSuitesEnabled && (
                <Chip 
                  label="Deaktivert av admin" 
                  size="small" 
                  color="error" 
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
            
            {!isProfessionSuitesEnabled ? (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Profesjons suiter er deaktivert av systemadministratoren. 
                  Kontakt din admin for å aktivere disse funksjonene.
                </Typography>
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Velg og konfigurer profesjons-spesifikke suiter for optimalisert arbeidsflyt. 
                Hver suite er tilpasset for din profesjon og gir tilgang til spesialiserte verktøy.
              </Typography>
            )}
            
            {/* Profession Suites Grid */}
            {isProfessionSuitesEnabled && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 3 }}>
                {/* Audio Enhancement Suite */}
                {isAudioSuiteEnabled && (
                  <MuiCard sx={{ 
                    border: profession === 'music_producer' ? `2px solid ${customBranding.color}` : '1px solid #e0e0e0',
                    bgcolor: profession === 'music_producer' ? `${customBranding.color}05` : 'background.paper'
                  }}>
                    <MuiCardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <MusicNote sx={{ fontSize: 32, color: '#3f51b5' }} />
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                            Audio Enhancement Suite
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Forbedre lydkvalitet automatisk
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mb:  2 }}>
                        Forbedre lydkvaliteten på dine opptak automatisk. Fjern bakgrunnsstøy, 
                        gjør stemmer tydeligere og separer instrumenter for profesjonell lyd.
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Chip label="Støyreduksjon" size="small" color="primary" />
                        <Chip label="Stemmeoppklaring" size="small" color="primary" />
                        <Chip label="Instrument-separasjon" size="small" color="primary" />
                        <Chip label="Automatisk" size="small" color="secondary" />
                      </Box>
                      <Button
                        variant={profession === 'music_producer' ? 'contained' : 'outlined'}
                        startIcon={<AutoFixHigh />}
                        fullWidth
                        sx={{
                          bgcolor: profession === 'music_producer' ? customBranding.color : 'transparent',
                          borderColor: customBranding.color,
                          color: profession === 'music_producer' ? 'white' : customBranding.color, '&:hover': {
                            bgcolor: profession === 'music_producer' ? `${customBranding.color}dd` : `${customBranding.color}10`
                          }
                        }}
                      >
                        {profession === 'music_producer' ? 'Aktivert' : `Aktiver for ${getProfessionDisplayName('music_producer')}`}
                      </Button>
                    </MuiCardContent>
                  </MuiCard>
                )}

                {/* Photo Enhancement Suite */}
                {isPhotoSuiteEnabled && (
                  <MuiCard sx={{ 
                    border: profession === 'photographer' ? `2px solid ${customBranding.color}` : '1px solid #e0e0e0',
                    bgcolor: profession === 'photographer' ? `${customBranding.color}05` : 'background.paper'
                  }}>
                    <MuiCardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <PhotoLibrary sx={{ fontSize: 32, color: '#e74c3c' }} />
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                            Photo Enhancement Suite
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Gjør bilder skarpere og mer profesjonelle
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mb:  2 }}>
                        Gjør bildene dine skarpere og mer profesjonelle. Forbedre ansikter, 
                        øk oppløsningen og fjern støy for perfekte resultater.
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Chip label="Ansiktsforbedring" size="small" color="primary" />
                        <Chip label="Oppløsningsforbedring" size="small" color="primary" />
                        <Chip label="Støyreduksjon" size="small" color="primary" />
                        <Chip label="Automatisk" size="small" color="secondary" />
                      </Box>
                      <Button
                        variant={profession === 'photographer' ? 'contained' : 'outlined'}
                        startIcon={<AutoFixHigh />}
                        fullWidth
                        sx={{
                          bgcolor: profession === 'photographer' ? customBranding.color : 'transparent',
                          borderColor: customBranding.color,
                          color: profession === 'photographer' ? 'white' : customBranding.color, '&:hover': {
                            bgcolor: profession === 'photographer' ? `${customBranding.color}dd` : `${customBranding.color}10`
                          }
                        }}
                      >
                        {profession === 'photographer' ? 'Aktivert' : `Aktiver for ${getProfessionDisplayName('photographer')}`}
                      </Button>
                    </MuiCardContent>
                  </MuiCard>
                )}

                {/* Video Enhancement Suite */}
                {isVideoSuiteEnabled && (
                  <MuiCard sx={{ 
                    border: profession === 'videographer' ? `2px solid ${customBranding.color}` : '1px solid #e0e0e0',
                    bgcolor: profession === 'videographer' ? `${customBranding.color}05` : 'background.paper'
                  }}>
                    <MuiCardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <VideoLibrary sx={{ fontSize: 32, color: '#9b59b6' }} />
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                            Video Enhancement Suite
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Lag engasjerende videoer enkelt
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mb:  2 }}>
                        Lag engasjerende videoer enkelt. Automatisk klipping, lydforbedring 
                        og optimalisering for sosiale medier gir deg profesjonelle resultater.
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Chip label="Automatisk klipping" size="small" color="primary" />
                        <Chip label="Lydforbedring" size="small" color="primary" />
                        <Chip label="Sosiale medier" size="small" color="primary" />
                        <Chip label="Automatisk" size="small" color="secondary" />
                      </Box>
                      <Button
                        variant={profession === 'videographer' ? 'contained' : 'outlined'}
                        startIcon={theming.getThemedIcon('autoFixHigh')}
                        fullWidth
                        sx={{
                          bgcolor: profession === 'videographer' ? customBranding.color : 'transparent',
                          borderColor: customBranding.color,
                          color: profession === 'videographer' ? 'white' : customBranding.color, '&:hover': {
                            bgcolor: profession === 'videographer' ? `${customBranding.color}dd` : `${customBranding.color}10`
                        }
                      }}
                      >
                        {profession === 'videographer' ? 'Aktivert' : `Aktiver for ${getProfessionDisplayName('videographer')}`}
                      </Button>
                    </MuiCardContent>
                  </MuiCard>
                )}

                {/* Story Arc Studio */}
                {isStoryArcEnabled && (
                  <MuiCard sx={{ 
                    border: profession === 'videographer' ? `2px solid ${customBranding.color}` : '1px solid #e0e0e0',
                    bgcolor: profession === 'videographer' ? `${customBranding.color}05` : 'background.paper'
                  }}>
                    <MuiCardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <VideoLibrary sx={{ fontSize: 32, color: '#f39c12' }} />
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                            Story Arc Studio
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Skap overbevisende video-historier
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mb:  2 }}>
                        Skap overbevisende historier for dine videoer. Fra idé til ferdig prosjekt 
                        med automatisk script-generering og DaVinci Resolve integrasjon.
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                        <Chip label="Historie-skriving" size="small" color="primary" />
                        <Chip label="Script-generering" size="small" color="primary" />
                        <Chip label="Prosjekt-oppsett" size="small" color="primary" />
                        <Chip label="Automatisk" size="small" color="secondary" />
                      </Box>
                      <Button
                        variant={profession === 'videographer' ? 'contained' : 'outlined'}
                        startIcon={theming.getThemedIcon('autoFixHigh')}
                        fullWidth
                        sx={{
                          bgcolor: profession === 'videographer' ? customBranding.color : 'transparent',
                          borderColor: customBranding.color,
                          color: profession === 'videographer' ? 'white' : customBranding.color, '&:hover': {
                            bgcolor: profession === 'videographer' ? `${customBranding.color}dd` : `${customBranding.color}10`
                        }
                      }}
                      >
                        {profession === 'videographer' ? 'Aktivert' : `Aktiver for ${getProfessionDisplayName('videographer')}`}
                      </Button>
                    </MuiCardContent>
                  </MuiCard>
                )}
              </Box>
            )}

            {/* Suite Configuration */}
            {isProfessionSuitesEnabled && (
              <Box sx={{ mt: 3, p: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                  <Settings sx={{ color: customBranding.color }} />
                  Suite Konfigurasjon
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Konfigurer globale innstillinger for alle aktiverte suiter. Endringer gjelder for alle brukere i din organisasjon.
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    sx={{ borderColor: customBranding.color, color: customBranding.color }}
                  >
                    Konfigurer AI-modeller
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Settings />}
                    sx={{ borderColor: customBranding.color, color: customBranding.color }}
                  >
                    Avanserte innstillinger
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Extension />}
                    sx={{ borderColor: customBranding.color, color: customBranding.color }}
                  >
                    Integrasjoner
                  </Button>
                </Box>
              </Box>
            )}
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab 5: Foto integrasjoner - ONLY for photographers */}
      {profession === 'photographer' && (
        <TabPanel value={settingsTabValue} index={getSettingsTabIndex('photo-integrations')}>
          <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
            <MuiCardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <PhotoLibrary sx={{ color: customBranding.color }} />
                Foto integrasjoner
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Installer Lightroom-pluginen, verifiser Google Workspace-tilkoblingen og test den faktiske eksportløypa til Google Drive og showcase.
              </Typography>

              {/* Lightroom Plugin Download Section */}
              <Box sx={{ mb: 4, p: 3, border: `2px solid ${customBranding.color}20`, borderRadius: 2, bgcolor: `${customBranding.color}05` }}>
                <Typography variant="h6" sx={{ mb: 2, color: customBranding.color, fontWeight: 600}}>
                  Adobe Lightroom Plugin
                </Typography>
                <Typography variant="body2" sx={{ mb: 3 }}>
                  Pluginen eksporterer Lightroom-bilder til CreatorHub, lagrer originalfilene i Google Drive og oppretter showcase-elementer i samme flyt.
                </Typography>

                {lightroomStatusQuery.data ? (
                  <>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2, mb: 2.5 }}>
                      <Chip
                        icon={<CheckCircle />}
                        label={lightroomStatusQuery.data.workspaceConnected
                          ? `Google Drive: ${lightroomStatusQuery.data.googleEmail || 'koblet'}`
                          : 'Google Workspace mangler'}
                        color={lightroomStatusQuery.data.workspaceConnected ? 'success' : 'warning'}
                        variant="outlined"
                      />
                      <Chip
                        label={`Kilde: ${lightroomStatusQuery.data.workspaceSource || 'ukjent'}`}
                        color={lightroomStatusQuery.data.workspaceConnected ? 'info' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        label={`Plugin: ${lightroomStatusQuery.data.tokenPreview || 'ikke generert'}`}
                        color={lightroomStatusQuery.data.connected ? 'info' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        label={`Siste synk: ${lightroomStatusQuery.data.lastSyncAt ? new Date(lightroomStatusQuery.data.lastSyncAt).toLocaleString('no-NO') : 'ikke kjørt'}`}
                        color="default"
                        variant="outlined"
                      />
                      {lightroomStatusQuery.data.driveRootFolderName ? (
                        <Chip
                          icon={<Storage />}
                          label={`Drive-rot: ${lightroomStatusQuery.data.driveRootFolderName}`}
                          color="default"
                          variant="outlined"
                        />
                      ) : null}
                    </Box>
                    {lightroomStatusQuery.data.workspaceWarning ? (
                      <Alert severity="info" sx={{ mb: 2.5 }}>
                        {lightroomStatusQuery.data.workspaceWarning}
                      </Alert>
                    ) : null}
                  </>
                ) : null}
                
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                  <Button 
                    variant="contained"
                    startIcon={<CloudDownload />}
                    sx={{
                      background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`,
                      color: 'white',
                      fontWeight: 600,
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 25px ${customBranding.color}40`
                      }
                    }}
                    disabled={lightroomAction === 'download'}
                    onClick={() => { void handleLightroomDownload(); }}
                  >
                    {lightroomAction === 'download' ? 'Forbereder pakke…' : 'Last ned installasjonspakke'}
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<Science />}
                    disabled={lightroomAction === 'test' || !lightroomStatusQuery.data?.workspaceConnected}
                    onClick={() => { void handleLightroomSmokeTest(); }}
                    sx={{ borderColor: customBranding.color, color: customBranding.color }}
                  >
                    {lightroomAction === 'test' ? 'Tester…' : 'Kjør Drive/showcase-test'}
                  </Button>

                  {!lightroomStatusQuery.data?.workspaceConnected ? (
                    <Button
                      variant="outlined"
                      startIcon={<LinkIcon />}
                      disabled={lightroomAction === 'reconnect'}
                      onClick={() => { void handleLightroomReconnect(); }}
                      sx={{ borderColor: theme.palette.warning.main, color: theme.palette.warning.main }}
                    >
                      {lightroomAction === 'reconnect' ? 'Starter…' : 'Koble Google Workspace'}
                    </Button>
                  ) : null}

                  {lightroomStatusQuery.data?.driveRootFolderUrl ? (
                    <Button
                      component="a"
                      href={lightroomStatusQuery.data.driveRootFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      variant="text"
                      startIcon={<Storage />}
                    >
                      Åpne Drive-rot
                    </Button>
                  ) : null}
                </Box>

                <Typography variant="body2" color="text.secondary">
                  Nedlastingen er en zip-pakke som inneholder mappen <strong>CreatorHubNorge.lrplugin</strong>. Pakk den ut før du legger den til i Lightroom.
                </Typography>
              </Box>

              {/* Interactive Integration Demo */}
              <LightroomInteractiveDemo customBranding={customBranding} />
              
              {/* Quick Installation Guide */}
              <Box sx={{ p: 3, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2, mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, color: customBranding.color, fontWeight: 600}}>
                  Installasjon (2 min)
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      bgcolor: customBranding.color, 
                      color: 'white',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '12px', 
                      fontWeight: 600}}>1</Box>
                    <Typography variant="body2">Last ned zip-pakken → Pakk ut → Åpne Lightroom → Plug-in Manager → Add</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      bgcolor: customBranding.color, 
                      color: 'white',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '12px', 
                      fontWeight: 600}}>2</Box>
                    <Typography variant="body2">Velg mappen <strong>CreatorHubNorge.lrplugin</strong> → eksporter via File → Export → CreatorHub Norge</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      bgcolor: customBranding.color, 
                      color: 'white',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontSize: '12px', 
                      fontWeight: 600}}>3</Box>
                    <Typography variant="body2">🎉 Klar! Eksportene lagres i Google Drive og publiseres til showcase i samme løype</Typography>
                  </Box>
                </Box>
              </Box>
            </MuiCardContent>
          </MuiCard>
        </TabPanel>
      )}

      {/* Tab FAQ: FAQ Veiledninger - UNIVERSAL FOR ALLE PROFESJONER */}
      <TabPanel value={settingsTabValue} index={getSettingsTabIndex('faq')}>
        <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <Quiz sx={{ color: customBranding.color }} />
              FAQ Veiledninger
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Tilgang til godkjente tutorials og veiledninger fra CreatorHub Norge community. 
              Automatisk tilpasset for {getProfessionDisplayName()}.
            </Typography>
            <Button 
              variant="contained"
              onClick={() => setShowFAQDialog(true)}
              sx={{
                background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`, '&:hover': { transform: 'translateY(-2px)' }
              }}
              startIcon={<Quiz />}
            >
              Åpne FAQ Bibliotek
            </Button>
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab Preferences: Brukerpreferanser */}
      <TabPanel value={settingsTabValue} index={getSettingsTabIndex('preferences')}>
        <MuiCard sx={{ bgcolor: 'rgba(255,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <Settings sx={{ color: customBranding.color }} />
              Brukerpreferanser
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Personaliser din arbeidsflyt og tilpass systemet til dine preferanser.
            </Typography>

            <Divider sx={{ my: 3 }} />

            {/* Login & Navigation Preferences */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Login sx={{ color: customBranding.color }} />
                Innlogging & Navigasjon
              </Typography>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRedirectToDashboard}
                      onChange={handleAutoRedirectChange}
                      disabled={savingPreferences}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: customBranding.color,
                        }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: customBranding.color,
                        }}}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500}}>
                        Automatisk omdirigering til dashboard etter innlogging
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Når aktivert, blir du automatisk sendt til ditt dashboard etter vellykket innlogging.
                        Når deaktivert, forblir du på landingssiden og kan navigere manuelt.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 2 }}
                />
              </FormGroup>

              {autoRedirectToDashboard && (
                <Alert severity="info" icon={<DashboardIcon />} sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Du vil automatisk bli omdirigert til ditt {getProfessionDisplayName(profession).toLowerCase()} dashboard etter innlogging.
                  </Typography>
                </Alert>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Split Sheet Notifications (Music Producers Only) */}
            {profession === 'music_producer' && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccountBalance sx={{ color: '#9f7aea' }} />
                  Split Sheet Varsler
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Kontroller hvilke varsler du mottar om split sheet-aktiviteter.
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Split Sheet opprettet/oppdatert"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Signaturforespørsler"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Betalinger prosessert"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Inntektsrapporter"
                  />
                </FormGroup>
                <PushNotificationSettings userId={userId} contextId="split-sheets" />
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Website Publishing (Enterprise) */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Language sx={{ color: customBranding.color }} />
                Publisering til nettside
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Whitelist domener som kan motta publisering fra Universal Showcase. Tilgjengelig for enterprise-brukere.
              </Typography>

              {!isEnterprisePlan && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Publisering til nettside krever enterprise-plan. Kontakt oss for aktivering.
                </Alert>
              )}

              <FormGroup sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={publishingSettings.enableWebsitePublish}
                      onChange={(e) => updateSetting('publishing', {
                        ...publishingSettings,
                        enableWebsitePublish: e.target.checked,
                      })}
                      disabled={!isEnterprisePlan}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: customBranding.color },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: customBranding.color },
                      }}
                    />
                  }
                  label="Aktiver publisering til nettside"
                />
              </FormGroup>

              {publishingSettings.enableWebsitePublish && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {publishingSettings.websiteTargets.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Ingen whitelistede domener ennå.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {publishingSettings.websiteTargets.map((target) => (
                        <Box key={target.id} sx={{ p: 2, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{target.name}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {target.domain} • {target.provider} • {target.defaultStorage}
                          </Typography>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => updateSetting('publishing', {
                              ...publishingSettings,
                              websiteTargets: publishingSettings.websiteTargets.filter((entry) => entry.id !== target.id),
                            })}
                            sx={{ mt: 1 }}
                          >
                            Fjern
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  )}

                  <Divider />

                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Legg til whitelistet domene</Typography>
                  <TextField
                    label="Navn"
                    value={newWebsiteTarget.name}
                    onChange={(e) => setNewWebsiteTarget((prev) => ({ ...prev, name: e.target.value }))}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Domene"
                    value={newWebsiteTarget.domain}
                    onChange={(e) => setNewWebsiteTarget((prev) => ({ ...prev, domain: e.target.value }))}
                    size="small"
                    fullWidth
                    placeholder="norwedfilm.no"
                  />
                  <TextField
                    label="API-nokkel"
                    value={newWebsiteTarget.apiKey}
                    onChange={(e) => setNewWebsiteTarget((prev) => ({ ...prev, apiKey: e.target.value }))}
                    size="small"
                    fullWidth
                  />
                  <TextField
                    select
                    label="Provider"
                    value={newWebsiteTarget.provider}
                    onChange={(e) => setNewWebsiteTarget((prev) => ({ ...prev, provider: e.target.value as 'norwedfilm' | 'custom' }))}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="norwedfilm">Norwedfilm</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Standard lagring"
                    value={newWebsiteTarget.defaultStorage}
                    onChange={(e) => setNewWebsiteTarget((prev) => ({ ...prev, defaultStorage: e.target.value as 'google_drive' | 'youtube' | 'custom' }))}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="google_drive">Google Drive</MenuItem>
                    <MenuItem value="youtube">YouTube</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </TextField>
                  <Button
                    variant="contained"
                    disabled={!isEnterprisePlan || !newWebsiteTarget.name.trim() || !newWebsiteTarget.domain.trim() || !newWebsiteTarget.apiKey.trim()}
                    onClick={() => {
                      const cleanedDomain = newWebsiteTarget.domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
                      if (!cleanedDomain) return;
                      const entry = {
                        id: `${Date.now()}`,
                        name: newWebsiteTarget.name.trim(),
                        domain: cleanedDomain,
                        apiKey: newWebsiteTarget.apiKey.trim(),
                        provider: newWebsiteTarget.provider,
                        defaultStorage: newWebsiteTarget.defaultStorage,
                      };
                      updateSetting('publishing', {
                        ...publishingSettings,
                        websiteTargets: [...publishingSettings.websiteTargets, entry],
                      });
                      setNewWebsiteTarget({
                        name: '',
                        domain: '',
                        apiKey: '',
                        provider: 'norwedfilm',
                        defaultStorage: 'google_drive',
                      });
                    }}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Legg til domene
                  </Button>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Future preferences can be added here */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Flere preferanser kommer snart...
              </Typography>
            </Box>
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Universal FAQ Dialog - Automatisk profession-tilpasset */}
      <TutorialFAQIntegration
        open={showFAQDialog}
        onClose={() => setShowFAQDialog(false)}
        profession={profession}
      />

      {/* Cancel Subscription Dialog */}
      <Dialog
        open={showCancelDialog}
        onClose={() => !processingAction && setShowCancelDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Cancel color="error" />
            <Box>
              <Typography variant="h6">Kanseller abonnement</Typography>
              <Typography variant="caption" color="text.secondary">
                Vi er lei oss for å se deg gå
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Important Notice */}
          <Alert severity="info" sx={{ mb: 3 }} icon={<CheckCircle />}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              ✅ Du har allerede betalt for denne måneden
            </Typography>
            <Typography variant="body2">
              Du beholder full tilgang til alle funksjoner til{', '}
              <strong>
                {currentSubscription?.accessUntil
                  ? new Date(currentSubscription.accessUntil).toLocaleDateString('nb-NO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : currentSubscription?.nextBillingDate
                    ? new Date(currentSubscription.nextBillingDate).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'slutten av perioden'}
              </strong>
            </Typography>
          </Alert>

          {/* What You'll Lose - Dynamic from profession feature matrix */}
          <Box sx={{ mb: 3, p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffb74d' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning color="warning" />
              Hva du mister tilgang til etter {currentSubscription?.accessUntil
                ? new Date(currentSubscription.accessUntil).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
                : 'utløpsdato'}:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {/* Always show basic limits */}
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                <strong>Ubegrenset prosjekter</strong> - Går tilbake til gratis plan (maks 3 prosjekter)
              </Typography>

              {/* Show profession-specific premium features */}
              {premiumFeatures.length > 0 ? (
                premiumFeatures.map((feature) => (
                  <Typography key={feature.id} component="li" variant="body2" sx={{ mb: 1 }}>
                    <strong>{feature.description.split(' - ')[0]}</strong>
                    {feature.description.includes(' - ') && ` - ${feature.description.split(' - ').slice(1).join(' - ')}`}
                    {feature.plan === 'marketplace' && (
                      <Chip
                        label="Marketplace"
                        size="small"
                        sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                        color="secondary"
                      />
                    )}
                  </Typography>
                ))
              ) : (
                <>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    <strong>Premium AI-funksjoner</strong> - Foto/video forbedring, automatisk redigering
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    <strong>Avansert lagring</strong> - Google Drive sync, automatisk backup
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    <strong>Profesjonelle verktøy</strong> - Story Arc Studio, Magic Creator
                  </Typography>
                  <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                    <strong>Prioritert support</strong> - Raskere responstid og dedikert hjelp
                  </Typography>
                  <Typography component="li" variant="body2">
                    <strong>Marketplace tilgang</strong> - Premium maler og ressurser
                  </Typography>
                </>
              )}
            </Box>
          </Box>

          {/* What Happens Next */}
          <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #64b5f6' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Hva skjer når du kansellerer:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                ✅ Du beholder tilgang til{', '}
                <strong>
                  {currentSubscription?.accessUntil
                    ? new Date(currentSubscription.accessUntil).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'slutten av perioden'}
                </strong>
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                ✅ Du vil <strong>ikke bli fakturert igjen</strong>
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                ✅ Alle dine prosjekter og data blir <strong>lagret</strong>
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                ✅ Du kan <strong>reaktivere når som helst</strong> og få tilbake full tilgang
              </Typography>
              <Typography component="li" variant="body2">
                ✅ Du får en <strong>bekreftelse på e-post</strong> med alle detaljer
              </Typography>
            </Box>
          </Box>

          {/* Cancellation Reason */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Hjelp oss å bli bedre (valgfritt)
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Hvorfor kansellerer du?"
              placeholder="For dyrt, mangler funksjoner, bruker ikke nok, fant et annet verktøy..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              helperText="Din tilbakemelding hjelper oss å forbedre tjenesten"
            />
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600}}>
              Er du sikker på at du vil kansellere?
            </Typography>
            <Typography variant="caption">
              Denne handlingen kan ikke angres, men du kan reaktivere abonnementet når som helst.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setShowCancelDialog(false);
              setCancellationReason(', ');
            }}
            disabled={processingAction}
            size="large"
          >
            Nei, behold abonnement
          </Button>
          <Button
            variant="contained"
            color="error"
            size="large"
            onClick={async () => {
              setProcessingAction(true);
              try {
                await apiRequest('/api/subscription/cancel', {
                  method: 'POST',
                  body: JSON.stringify({
                    userId,
                    reason: cancellationReason || 'No reason provided'
                  })
                });
                await refetchSubscription();
                setShowCancelDialog(false);
                setCancellationReason('');

                // Show success message
                const accessUntil = currentSubscription?.accessUntil || currentSubscription?.nextBillingDate;
                setSnackbar({
                  open: true,
                  message: `Abonnement kansellert. Du beholder tilgang til ${accessUntil ? new Date(accessUntil).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'slutten av perioden'}.`,
                  severity: 'success'
                });
              } catch (error) {
                console.error('Failed to cancel subscription:', error);
                setSnackbar({ open: true, message: 'Kunne ikke kansellere abonnement. Prøv igjen senere eller kontakt support.', severity: 'error' });
              } finally {
                setProcessingAction(false);
              }
            }}
            disabled={processingAction}
            startIcon={processingAction ? <CircularProgress size={16} /> : <Cancel />}
          >
            {processingAction ? 'Kansellerer...' : 'Ja, kanseller abonnement'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund Request Dialog */}
      <Dialog open={showRefundDialog} onClose={() => !processingAction && setShowRefundDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyOff color="warning" />
            Be om refundering
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedPaymentForRefund && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Du ber om refundering for:
                <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    {selectedPaymentForRefund.planName || selectedPaymentForRefund.planId}
                  </Typography>
                  <Typography variant="caption">
                    Beløp: {selectedPaymentForRefund.amount} {selectedPaymentForRefund.currency || 'NOK'}
                  </Typography>
                  <br />
                  <Typography variant="caption">
                    Dato: {new Date(selectedPaymentForRefund.createdAt || Date.now()).toLocaleDateString('nb-NO')}
                  </Typography>
                </Box>
              </Alert>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Årsak til refundering (valgfritt)"
                placeholder="Fortell oss hvorfor du ønsker refundering..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Typography variant="caption" color="text.secondary">
                Refunderinger behandles vanligvis innen 5-10 virkedager. Du vil motta en e-post når refunderingen er behandlet.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowRefundDialog(false);
            setRefundReason(', ');
            setSelectedPaymentForRefund(null);
          }} disabled={processingAction}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              if (!selectedPaymentForRefund) return;

              setProcessingAction(true);
              try {
                const response = await apiRequest('/api/google-pay/refund', {
                  method: 'POST',
                  body: JSON.stringify({
                    transactionId: selectedPaymentForRefund.transactionId || selectedPaymentForRefund.id,
                    amount: selectedPaymentForRefund.amount,
                    reason: refundReason || 'User requested refund'
                  })
                });
                await queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
                setShowRefundDialog(false);
                setRefundReason('');
                setSelectedPaymentForRefund(null);
                setSnackbar({
                  open: true,
                  message: response?.alreadyRequested
                    ? 'Det finnes allerede en aktiv refunderingsforespørsel for denne betalingen.'
                    : 'Refunderingsforespørsel sendt! Du vil motta en e-post når den er behandlet.',
                  severity: response?.alreadyRequested ? 'warning' : 'success',
                });
              } catch (error) {
                console.error('Failed to request refund:', error);
                setSnackbar({ open: true, message: 'Kunne ikke sende refunderingsforespørsel. Prøv igjen senere.', severity: 'error' });
              } finally {
                setProcessingAction(false);
              }
            }}
            disabled={processingAction}
            startIcon={processingAction ? <CircularProgress size={16} /> : <MoneyOff />}
          >
            {processingAction ? 'Sender...' : 'Send refunderingsforespørsel'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upgrade/Change Subscription Dialog */}
      <Dialog
        open={showUpgradeDialog}
        onClose={() => !processingAction && setShowUpgradeDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Refresh color="primary" />
            <Box>
              <Typography variant="h6">Endre abonnement</Typography>
              <Typography variant="caption" color="text.secondary">
                Velg en ny plan som passer dine behov
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          {plansLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              {/* Show current plan */}
              {currentSubscription?.planName && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600}}>
                    Nåværende plan: {currentSubscription.planName}
                  </Typography>
                  <Typography variant="caption">
                    {currentSubscription.amount} {currentSubscription.currency || 'NOK'}/måned
                  </Typography>
                </Alert>
              )}

              {/* Display subscription plans */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
                {subscriptionPlans && subscriptionPlans.length > 0 ? (
                  subscriptionPlans.map((plan: any) => (
                    <Box
                      key={plan.id}
                      sx={{
                        p: 3,
                        border: '2px solid',
                        borderColor: plan.popular ? customBranding.color : '#e0e0e0',
                        borderRadius: 2,
                        bgcolor: plan.popular ? alpha(customBranding.color, 0.05) : 'white',
                        position: 'relative',
                        transition: 'all 0.3s','&:hover': {
                          borderColor: customBranding.color,
                          transform: 'translateY(-4px)',
                          boxShadow: 3
                        }
                      }}
                    >
                      {plan.popular && (
                        <Chip
                          label="Mest populær"
                          color="primary"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: -12,
                            right: 16,
                            fontWeight: 60
                          }}
                        />
                      )}

                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        {plan.displayName || plan.name}
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: customBranding.color }}>
                          {plan.price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          {plan.currency || 'NOK'}/{plan.interval || 'måned'}
                        </Typography>
                      </Box>

                      {plan.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {plan.description}
                        </Typography>
                      )}

                      <Divider sx={{ my: 2 }} />

                      {/* Features list */}
                      <Box component="ul" sx={{ m: 0, p: 0, pl: 2, mb: 3 }}>
                        {plan.features && plan.features.map((feature: string, idx: number) => (
                          <Typography
                            key={idx}
                            component="li"
                            variant="body2"
                            sx={{ mb: 0.5 }}
                          >
                            {feature}
                          </Typography>
                        ))}
                      </Box>

                      <Button
                        fullWidth
                        variant={plan.popular ? 'contained' : 'outlined'}
                        onClick={() => {
                          // Navigate to subscription page with selected plan
                          window.location.href = `/subscription?profession=${encodeURIComponent(profession)}&plan=${plan.id}`;
                        }}
                        sx={{
                          bgcolor: plan.popular ? customBranding.color : 'transparent',
                          borderColor: customBranding.color,
                          color: plan.popular ? 'white' : customBranding.color, '&:hover': {
                            bgcolor: plan.popular ? customBranding.darkColor || customBranding.color : alpha(customBranding.color, 0.1)
                          }
                        }}
                      >
                        {(currentSubscription?.selectedPlan || '').toLowerCase() === (plan.id || '').toLowerCase()
                          ? 'Nåværende plan'
                          : 'Velg plan'}
                      </Button>
                    </Box>
                  ))
                ) : (
                  <Alert severity="info">
                    Ingen abonnementsplaner tilgjengelig for øyeblikket.
                  </Alert>
                )}
              </Box>

              {/* Show profession-specific features that will be unlocked */}
              {premiumFeatures.length > 0 && (
                <Box sx={{ mt: 4, p: 3, bgcolor: '#e8f5e9', borderRadius: 2, border: '1px solid #4caf50' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: '#2e7d32' }}>
                    ✨ Premium funksjoner du får tilgang til:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    {premiumFeatures.map((feature) => (
                      <Typography key={feature.id} component="li" variant="body2" sx={{ mb: 1 }}>
                        <strong>{feature.description.split(' - ')[0]}</strong>
                        {feature.description.includes(' - ') && ` - ${feature.description.split(' - ').slice(1).join(' - ')}`}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowUpgradeDialog(false)} size="large">
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <Dialog
        open={showPaymentMethodDialog}
        onClose={() => setShowPaymentMethodDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Legg til betalingsmetode
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Legg til en betalingsmetode for raskere betaling ved fremtidige kjøp.
          </Alert>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<span style={{ fontSize: '1.5rem' }}>🔵</span>}
              sx={{
                borderColor: '#4285f4',
                color: '#4285f4',
                justifyContent: 'flex-start',
                p: 2, '&:hover': {
                  borderColor: '#357ae8',
                  bgcolor: 'rgba(66, 133, 244, 0.04)'
                }
              }}
              onClick={async () => {
                try {
                  // Mock Google Pay integration - in production, use actual Google Pay API
                  const mockPaymentData = {
                    paymentType: 'google_pay',
                    lastFour: '1234',
                    expiryMonth: 12,
                    expiryYear: 2025,
                    isDefault: paymentMethodsData?.paymentMethods?.length === 0
                  };

                  await apiRequest('/api/user/payment-methods', {
                    method: 'POST',
                    body: JSON.stringify(mockPaymentData)
                  });

                  refetchPaymentMethods();
                  setShowPaymentMethodDialog(false);
                  setSnackbar({ open: true, message: 'Betalingsmetode lagt til!', severity: 'success' });
                } catch (error) {
                  console.error('Failed to add payment method:', error);
                  setSnackbar({ open: true, message: 'Kunne ikke legge til betalingsmetode. Prøv igjen.', severity: 'error' });
                }
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body1" sx={{ fontWeight: 600}}>
                  Google Pay
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rask og sikker betaling med Google
                </Typography>
              </Box>
            </Button>

            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<CreditCard />}
              sx={{
                justifyContent: 'flex-start',
                p: 2
              }}
              disabled
            >
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body1" sx={{ fontWeight: 600}}>
                  Kredittkort / Debetkort
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Kommer snart
                </Typography>
              </Box>
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentMethodDialog(false)}>
            Avbryt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enterprise Inquiry Form Dialog */}
      {showEnterpriseInquiryDialog && (
        <EnterpriseInquiryForm
          open={showEnterpriseInquiryDialog}
          onClose={() => setShowEnterpriseInquiryDialog(false)}
          onSuccess={() => {
            setShowEnterpriseInquiryDialog(false);
            // Show success notification or update UI
          }}
          existingOrgNumber={currentSubscription?.organizationNumber || ''}
          existingCompanyName={currentSubscription?.companyName || ''}
          existingEmail={currentSubscription?.email || ''}
          existingProfession={profession}
          currentPlan={currentSubscription?.selectedPlan ||'pro'}
        />
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
            Avbryt
          </Button>
          <Button variant="contained" color="error" onClick={confirmDialog.onConfirm}>
            Bekreft
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UniversalSettingsPanel;
