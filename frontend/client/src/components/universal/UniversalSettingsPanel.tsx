/**
 * Universal Settings Panel - Automatisk FAQ for alle profesjoner
 * AUTOMATISK POPULERING: Fungerer for alle nye profesjoner uten manuell konfigurasjon
 */

import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
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
  Snackbar
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
  Store,
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
  AccountBalance
} from '@mui/icons-material';

// Import existing components
import PriceAdministration from '../PriceAdministration';
import BusinessBrandingSettings from '../BusinessBrandingSettings';
import GoogleDriveManager from '../google-drive/GoogleDriveManager';
import GoogleDriveProjectSync from '../google-drive/GoogleDriveProjectSync';
import { TutorialFAQIntegration } from '../tutorial/TutorialFAQIntegration';
import { LightroomInteractiveDemo } from './misc/LightroomInteractiveDemo';
import GoogleWorkspaceStorageInfo from './GoogleWorkspaceStorageInfo';
import CreatorHubMarketplace from '../resume/ResumeBuilderMarketplace';
import { usePlatformPricing, platformPricingService } from '../../services/PlatformPricingService';
import { useQueryClient } from '@tanstack/react-query';
import { getAllProfessionFeatures } from '../../../shared/profession-feature-matrix';
import PlanFeaturePreview from '../subscription/PlanFeaturePreview';
import { EnterpriseInquiryForm } from '../enterprise/EnterpriseInquiryForm';
import EnterpriseTeamManagement from '../enterprise/EnterpriseTeamManagement';

// Import dynamic profession system
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';

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
  onProjectSelect?: (project: any) => void
}

export const UniversalSettingsPanel: React.FC<UniversalSettingsPanelProps> = ({
  profession,
  userId,
  customBranding = { color: '#1976d2' },
  onSettingsUpdate,
  onProjectUpdate,
  selectedProject,
  onProjectSelect
}) => {
  const [settingsTabValue, setSettingsTabValue] = useState(0);
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
  const theme = useTheme();
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Dynamic profession system
  const { professionConfigs, getProfessionDisplayName, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { adaptDashboardTitle, adaptTabLabels } = useProfessionAdapter();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();

  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const { subscriptionPlans, isLoading: plansLoading } = usePlatformPricing();

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
    queryKey: ['/api/payments/history,'],
    queryFn: () => apiRequest('/api/payments/history'),
    staleTime: 30000,
  });
  const { data: mvaStatus, refetch: refetchMva } = useQuery({
    queryKey: ['/api/payments/fiken-mva-status'],
    queryFn: () => apiRequest('/api/payments/fiken-mva-status'),
    staleTime: 30000,
  });
  const { data: skattemeldingStatus, refetch: refetchSkattemelding } = useQuery({
    queryKey: ['/api/accounting/skattemelding/status'],
    queryFn: () => apiRequest('/api/accounting/skattemelding/status'),
    staleTime: 30000,
  });
  const { data: currentSubscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/user/subscription-status'],
    queryFn: () => apiRequest('/api/user/subscription-status'),
    staleTime: 30000,
  });

  // Fetch user payment methods
  const { data: paymentMethodsData, refetch: refetchPaymentMethods } = useQuery({
    queryKey: ['/api/user/payment-methods'],
    queryFn: () => apiRequest('/api/user/payment-methods'),
    staleTime: 30000,
  });
  const lastFikenSyncDays = React.useMemo(() => {
    const items = paymentHistory?.history as any[] | undefined;
    if (!items || items.length === 0) return null;
    const fikenItems = items
      .filter((h) => h.isInFiken)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const last = fikenItems[0];
    if (!last) return null;
    const lastDate = new Date(last.createdAt || Date.now()).getTime();
    const diffMs = Date.now() - lastDate;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }, [paymentHistory]);
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

  // UNIVERSAL SETTINGS TABS - Fungerer for ALLE profesjoner
  const universalSettingsTabs = [
    { id: 'business', label: 'Bedriftsprofil', icon: <Business /> },
    { id: 'my-features', label: 'Mine Funksjoner', icon: <Extension /> },
    { id: 'pricing', label: 'Prisadministrasjon', icon: <AttachMoney /> },
    { id: 'storage', label: 'Google Workspace Lagring', icon: <Storage /> },
    { id: 'backup', label: 'Backup & Sync', icon: <CloudDone /> },
    { id: 'profession-suites', label: 'Profesjons Suiter', icon: <SmartToy /> },
    ...(profession === 'photographer' ? [{ id: 'photo-integrations', label: 'Foto integrasjoner', icon: <PhotoLibrary /> }] : []), // Photo integrations tab is photographer-specific
    { id: 'marketplace', label: 'Marketplace', icon: <Store /> },
    { id: 'faq', label: 'FAQ Veiledninger', icon: <Quiz /> },
    { id: 'preferences', label: 'Brukerpreferanser', icon: <Settings /> }
  ];

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
          {universalSettingsTabs.map((tab, index) => (
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
      <TabPanel value={settingsTabValue} index={0}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <Business sx={{ color: customBranding.color }} />
              Bedriftsprofil & Logo
            </Typography>
            <BusinessBrandingSettings userId={userId} />
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab 1: Mine Funksjoner - Feature Access Overview */}
      <TabPanel value={settingsTabValue} index={1}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
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

                    {/* Marketplace Section */}
                    <Box sx={{ mt: 3, p: 2, border: `1px solid #ff9800`, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.05)' }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, color: '#ff9800', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        🛒 Marketplace - Utvid med tilleggsfunksjoner
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Du har allerede Enterprise-planen med alle kjernefunksjoner.
                        Utforsk Marketplace for spesialiserte tilleggsfunksjoner som kan
                        kjøpes separat for å tilpasse løsningen til dine spesifikke behov.
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setSettingsTabValue(profession === 'photographer' ? 7 : 6)}
                        sx={{ borderColor: '#ff9800', color: '#ff9800' }}
                      >
                        Utforsk Marketplace
                      </Button>
                    </Box>
                  </>
                );
              }

              return null;
            })()}
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab 2: Prisadministrasjon */}
      <TabPanel value={settingsTabValue} index={2}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
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
                <Typography variant="subtitle1" sx={{ mb: 1, color: theming.colors.primary }}>
                  Betalingshistorikk
                </Typography>
                {/* MVA Status */}
                <Alert severity={mvaStatus?.registered ? 'success' : 'warning'} sx={{ mb: 2 }}>
                  {mvaStatus?.registered === true && 'MVA-registrering er synkronisert med Fiken.'}
                  {mvaStatus?.registered === false && 'MVA-registrering ikke funnet i Fiken.'}
                  {mvaStatus?.registered === null && 'MVA-status ukjent. Prøv å synkronisere.'}
                  <Button size="small" sx={{ ml: 2 }} onClick={() => refetchMva()}>
                    Synkroniser MVA-status
                  </Button>
                </Alert>
                {/* Skattemelding annual status */}
                <Alert severity={skattemeldingStatus?.submitted ? 'success' : skattemeldingStatus?.prepared ? 'info' : 'warning'} sx={{ mb: 2 }}>
                  {`Skattemelding ${skattemeldingStatus?.year || new Date().getUTCFullYear()}: `}
                  {skattemeldingStatus?.submitted ? 'Innsendt til Fiken.' : skattemeldingStatus?.prepared ? 'Utkast er forberedt.' : 'Ikke forberedt.'}
                  <Button
                    size="small"
                    sx={{ ml: 2 }}
                    onClick={async () => {
                      try {
                        await apiRequest('/api/accounting/skattemelding/prepare', { method: 'POST', body: JSON.stringify({}) });
                        await refetchSkattemelding();
                      } catch {}
                    }}
                  >
                    Forbered skattemelding
                  </Button>
                  <Button
                    size="small"
                    sx={{ ml: 1 }}
                    onClick={async () => {
                      try {
                        await apiRequest('/api/accounting/skattemelding/send', { method: 'POST', body: JSON.stringify({}) });
                        await refetchSkattemelding();
                      } catch {}
                    }}
                  >
                    Send til Fiken
                  </Button>
                  <Button
                    size="small"
                    sx={{ ml: 1 }}
                    onClick={() => {
                      window.location.href = '/accounting/receipts';
                    }}
                  >
                    Åpne kvitteringer
                  </Button>
                </Alert>
                {!paymentHistory?.history?.length ? (
                  <Alert severity="info">Ingen betalinger funnet.</Alert>
                ) : (
                  <Box sx={{ border: '1px solid #eee', borderRadius: 1 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', p: 1, bgcolor: '#fafafa', borderBottom: '1px solid #eee' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>Dato</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>Plan</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>Beløp</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>Status</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600}}>Fiken</Typography>
                    </Box>
                    {paymentHistory.history.slice(0, 10).map((h: any, idx: number) => (
                      <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr', p: 1, borderBottom: '1px solid #f3f3f3' }}>
                        <Typography variant="caption">{new Date(h.createdAt || h.currentPeriodStart || Date.now()).toLocaleString('nb-NO')}</Typography>
                        <Typography variant="caption">{h.planName || h.planId || '-'}</Typography>
                        <Typography variant="caption">{h.amount ? `${Math.round(h.amount)} ${h.currency || 'NOK'}` : '-'}</Typography>
                        <Typography variant="caption">{h.status}</Typography>
                        <Box>
                          {h.isInFiken ? (
                            <Chip label="Registrert" size="small" color="success" />
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={async () => {
                                try {
                                  await apiRequest('/api/payments/fiken-register', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      referenceId: h.id,
                                      referenceType: h.type === 'subscription' ? 'subscription' : 'event',
                                      planId: h.planId,
                                      amount: h.amount,
                                      currency: h.currency,
                                    }),
                                  });
                                  await queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
                                } catch (e) {
                                  // noop
                                }
                              }}
                            >
                              Send til Fiken
                            </Button>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                {lastFikenSyncDays !== null && lastFikenSyncDays > 28 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Du har ikke registrert i Fiken på {lastFikenSyncDays} dager. Husk å registrere før MVA-frist.
                    <Button
                      size="small"
                      sx={{ ml: 2 }}
                      onClick={() => {
                        try {
                          communication.sendBroadcast('activity:notice', {
                            type: 'finance:fiken-reminder',
                            message: `Fiken-registrering mangler (${lastFikenSyncDays} dager) — gjør dette før MVA-frist`,
                            timestamp: Date.now(),
                          });
                        } catch {}
                      }}
                    >
                      Varsle i aktivitetsstrøm
                    </Button>
                  </Alert>
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
                        const canRefund = daysSincePayment <= 30 && payment.status === 'active' && !payment.refunded;

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
                                label={payment.refunded ? 'Refundert' : 'Ikke refunderbar'}
                                size="small"
                                color={payment.refunded ? 'success' : 'default'}
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
                        Ingen betalingsmetoder lagret ennå. Legg til en betalingsmetode for raskere checkout.
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

      {/* Tab 3: Google Workspace Lagring */}
      <TabPanel value={settingsTabValue} index={3}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <Storage sx={{ color: customBranding.color }} />
              Google Workspace Lagring
            </Typography>
            
            {/* Visual Storage Overview */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ 
                p: 3, 
                bgcolor: 'rgba(66, 133, 244, 0.05)', 
                border: '1px solid rgba(66, 133, 244, 0.2)',
                borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      component="img" 
                      src="https://fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                      alt="Google Workspace"
                      sx={{ width: 24, height: 24 }}
                    />
                    <Typography variant="h6">Lagringsoversikt</Typography>
                  </Box>
                  <Chip 
                    label="15 GB brukt av 100 GB" 
                    size="small" 
                    color="success"
                  />
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Total lagring</Typography>
                    <Typography variant="body2" fontWeight="600">15%</Typography>
                  </Box>
                  <Box sx={{ 
                    height: 8, 
                    bgcolor: 'rgba(0,0,0,0.1)', 
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      width: '15%', 
                      height: '100%', 
                      bgcolor: '#4285f4',
                      transition: 'width 0.3s ease'
                    }} />
                  </Box>
                </Box>

                {/* Storage Breakdown */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight="600">Lagringsfordeling</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhotoLibrary fontSize="small" sx={{ color: '#4285f4' }} />
                        <Typography variant="body2">Showcase & Portfolio</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="600">6.3 GB</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VideoLibrary fontSize="small" sx={{ color: '#34a853' }} />
                        <Typography variant="body2">Prosjekter & Filer</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="600">5.8 GB</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Business fontSize="small" sx={{ color: '#fbbc04' }} />
                        <Typography variant="body2">Bedriftsdokumenter</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="600">2.4 GB</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CloudDownload fontSize="small" sx={{ color: '#ea4335' }} />
                        <Typography variant="body2">Backups</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="600">0.5 GB</Typography>
                    </Box>
                  </Box>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{ mt: 2 }}
                    onClick={() => window.open('https://drive.google.com/settings/storage', ','_blank')}
                  >
                    Administrer Google Lagring
                  </Button>
                </Box>
              </Box>
            </Box>

            {/* Original Component */}
            <GoogleWorkspaceStorageInfo 
              userId={userId}
              profession={profession}
              compact={false}
              showDetailsButton={true}
            />
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab 4: Backup & Sync */}
      <TabPanel value={settingsTabValue} index={4}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
          <MuiCardContent>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
              <CloudDone sx={{ color: customBranding.color }} />
              Backup & Sync Administrasjon
            </Typography>

            {/* Google Drive Manager */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Storage sx={{ color: customBranding.color }} />
                Google Drive Filhåndtering
              </Typography>
              <GoogleDriveManager
                userId={userId}
                profession={profession}
                selectedProject={selectedProject}
                onProjectUpdate={onProjectUpdate}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Google Drive Project Sync */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudDone sx={{ color: customBranding.color }} />
                Prosjekt Synkronisering
              </Typography>
              <GoogleDriveProjectSync
                userId={userId}
                profession={profession}
                selectedProject={selectedProject}
                onProjectSelect={onProjectSelect}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Backup Status & Actions */}
            <Box sx={{
              p: 3,
              mb: 3,
              bgcolor: 'rgba(76, 175, 80, 0.05)',
              border: '1px solid rgba(76, 175, 80, 0.2)',
              borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="600">Siste backup</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date().toLocaleDateString('no-NO')} kl. {new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Chip label="✓ Suksess" color="success" size="small" />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<CloudDownload />}
                  sx={{ 
                    bgcolor: customBranding.color, '&:hover': { bgcolor: customBranding.darkColor || customBranding.color }
                  }}
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/backup/create', {
                        method: 'POST',
                        headers: { 'Content-Type' : 'application/json' },
                        body: JSON.stringify({ userId, profession })
                      });
                      if (response.ok) {
                        setSnackbar({ open: true, message: 'Manuell backup startet!', severity: 'success' });
                      }
                    } catch (error) {
                      console.error('Backup failed:', error);
                      setSnackbar({ open: true, message: 'Backup feilet. Prøv igjen.', severity: 'error' });
                    }
                  }}
                >
                  Kjør backup nå
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Download />}
                  sx={{ 
                    borderColor: customBranding.color,
                    color: customBranding.color
                  }}
                  onClick={() => window.open('/api/backup/download/latest', ','_blank')}
                >
                  Last ned siste backup
                </Button>
              </Box>
            </Box>

            {/* Sync Settings */}
            <Box sx={{ 
              p: 3, 
              mb: 3, 
              bgcolor: 'rgba(33, 150, 243, 0.05)', 
              border: '1px solid rgba(33, 150, 243, 0.2)',
              borderRadius: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="600" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudDone />
                Automatisk synkronisering
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      component="img" 
                      src="https://fonts.gstatic.com/s/i/productlogos/drive/v16/24px.svg"
                      alt="Google Drive"
                      sx={{ width: 20, height: 20 }}
                    />
                    <Typography variant="body2">Google Drive</Typography>
                  </Box>
                  <Chip label="Aktiv" color="success" size="small" />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      component="img" 
                      src="https://fonts.gstatic.com/s/i/productlogos/photos/v14/24px.svg"
                      alt="Google Photos"
                      sx={{ width: 20, height: 20 }}
                    />
                    <Typography variant="body2">Google Photos</Typography>
                  </Box>
                  <Chip label="Aktiv" color="success" size="small" />
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'white', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box 
                      component="img" 
                      src="https://fonts.gstatic.com/s/i/productlogos/contacts/v14/24px.svg"
                      alt="Google Contacts"
                      sx={{ width: 20, height: 20 }}
                    />
                    <Typography variant="body2">Google Contacts</Typography>
                  </Box>
                  <Chip label="Inaktiv" size="small" />
                </Box>
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                Synkronisering kjører automatisk hver 5. minutt. Siste synkronisering: {new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
              </Alert>
            </Box>

            {/* Original GoogleDriveManager Component */}
            <GoogleDriveManager 
              userId={userId}
              profession={profession as 'photographer' | 'videographer' | 'music_producer' | 'vendor'}
            />
          </MuiCardContent>
        </MuiCard>
      </TabPanel>

      {/* Tab 5: Profession Suites */}
      <TabPanel value={settingsTabValue} index={5}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
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
        <TabPanel value={settingsTabValue} index={6}>
          <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
            <MuiCardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
                <PhotoLibrary sx={{ color: customBranding.color }} />
                Foto integrasjoner
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Last ned og installer CreatorHub Norge Lightroom plugin for sømløs integrering med plattformen.
              </Typography>

              {/* Lightroom Plugin Download Section */}
              <Box sx={{ mb: 4, p: 3, border: `2px solid ${customBranding.color}20`, borderRadius: 2, bgcolor: `${customBranding.color}05` }}>
                <Typography variant="h6" sx={{ mb: 2, color: customBranding.color, fontWeight: 600}}>
                  Adobe Lightroom Plugin
                </Typography>
                <Typography variant="body2" sx={{ mb: 3 }}>
                  CreatorHub Norge Lightroom plugin gjør det mulig å synkronisere bilder, metadata og collections direkte med plattformen.
                </Typography>
                
                <Button 
                  variant="contained"
                  startIcon={<CloudDownload />}
                  sx={{
                    background: `linear-gradient(135deg, ${customBranding.color} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    fontWeight: 600,
                    mb: 2, '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 25px ${customBranding.color}40`
                    }
                  }}
                  onClick={() => {
                    // Create download link for Lightroom plugin
                    const link = document.createElement('a');
                    link.href = '/api/lightroom/download-plugin';
                    link.download = 'CreatorHub-Norge-Lightroom-Plugin.lrplugin';
                    link.click();
                }}
                >
                  Last ned Lightroom Plugin
                </Button>

                <Typography variant="body2" color="text.secondary">
                  Kompatibel med Adobe Lightroom CC 2019 og nyere versjoner
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
                    <Typography variant="body2">Last ned plugin → Åpne Lightroom → Plugin Manager → Add</Typography>
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
                    <Typography variant="body2">Enable plugin → File → Plug-in Extras → CreatorHub Norge</Typography>
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
                    <Typography variant="body2">🎉 Klar! Collections synkroniseres automatisk til showcase</Typography>
                  </Box>
                </Box>
              </Box>
            </MuiCardContent>
          </MuiCard>
        </TabPanel>
      )}

      {/* Tab Marketplace: Marketplace - UNIVERSAL FOR ALLE PROFESJONER */}
      <TabPanel value={settingsTabValue} index={profession === 'photographer' ? 7 : 6}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
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

      {/* Tab FAQ: FAQ Veiledninger - UNIVERSAL FOR ALLE PROFESJONER */}
      <TabPanel value={settingsTabValue} index={profession === 'photographer' ? 8 : 7}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
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
      <TabPanel value={settingsTabValue} index={profession === 'photographer' ? 9 : 8}>
        <MuiCard sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.9)' }}>
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
                await apiRequest('/api/google-pay/refund', {
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
                setSnackbar({ open: true, message: 'Refunderingsforespørsel sendt! Du vil motta en e-post når den er behandlet.', severity: 'success' });
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
                        {plan.name}
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
                          color: plan.popular ? 'white' : customBranding.color'&:hover': {
                            bgcolor: plan.popular ? customBranding.darkColor || customBranding.color : alpha(customBranding.color, 0.1)
                          }
                        }}
                      >
                        {currentSubscription?.planName === plan.name ? 'Nåværende plan' : 'Velg plan'}
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
            Legg til en betalingsmetode for raskere checkout ved fremtidige kjøp.
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