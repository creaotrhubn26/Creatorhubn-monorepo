import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs as _useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter as _useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import _getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Chip,
  Button,
  Alert,
  CircularProgress as _CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Tooltip,
  IconButton as _IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction as _ListItemSecondaryAction,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider,
  Snackbar,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import { AdminButton, AdminLoading, AdminError, useIsMobile } from './design-system';
import {
  ExpandMore,
  Settings,
  Info as _Info,
  Warning,
  CheckCircle,
  Error as _ErrorIcon,
  Refresh,
  Save as _Save,
  RestoreFromTrash as _RestoreFromTrash,
  PowerSettingsNew,
  Category,
  Lock,
  LockOpen,
  Star,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { 
  PROFESSION_FEATURE_MATRIX,
  isProfessionFeatureAvailable as _isProfessionFeatureAvailable,
  isProfessionFeatureEnabled as _isProfessionFeatureEnabled,
  isProfessionFeatureOptional as _isProfessionFeatureOptional,
  enableProfessionFeature,
  disableProfessionFeature,
  getOptionalFeaturesForProfession,
  getRequiredFeaturesForProfession,
  getProfessionFeatureStats
} from '@shared/profession-feature-matrix';
import { getAllProfessionTypes as _getAllProfessionTypes } from '@shared/profession-type-registry';
import type {
  DashboardTabConfig
} from '@shared/profession-dashboard-config';
import {
  PROFESSION_DASHBOARD_CONFIG,
  getProfessionTabs,
  getProfessionTab as _getProfessionTab,
  isTabEnabled as _isTabEnabled,
  isTabFeatureEnabled as _isTabFeatureEnabled,
  toggleProfessionTab,
  toggleTabFeature,
  getProfessionDashboardStats
} from '@shared/profession-dashboard-config';
import {
  UserFeatureOverride as _UserFeatureOverride,
  hasUserTabAccess as _hasUserTabAccess,
  hasUserFeatureAccess as _hasUserFeatureAccess,
  createUserFeatureOverride as _createUserFeatureOverride,
  addUserTabOverride as _addUserTabOverride,
  addUserFeatureOverride as _addUserFeatureOverride,
  upgradeUserPlan as _upgradeUserPlan,
  enableBetaTester as _enableBetaTester,
  enableVIP as _enableVIP,
  getActiveUserOverrides as _getActiveUserOverrides
} from '@shared/user-feature-override';

interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  configurable: boolean;
  dependencies?: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  lastModified: string;
  modifiedBy: string;
}

// Integration props for unified workflow connectivity
interface FeatureManagementProps {
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (_meeting: any) => void;
  onProjectUpdate?: (_project: any) => void;
  onWorklogCreate?: (_worklog: any) => void;
  onClientSelect?: (_client: any) => void;
  onClientUpdate?: (_client: any) => void;
  onShowcaseCreate?: (_showcase: any) => void;
  onFileUpload?: (_file: any) => void;
  onFileDownload?: (_file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (_project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

export default function FeatureManagement({
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
  onSettingsUpdate,
  onNotificationCreate
}: FeatureManagementProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // ⭐ Enhanced Master Integration
  const { lifecycle, analytics, performance, debugging, dataFlow, communication, auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');
  // Lys oransje aksent på mørk bakgrunn (matcher admin-skallet).
  const themeColors = { ...theming.colors, primary: '#ff8c00' };
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProfession, setSelectedProfession] = useState<string>('videographer');
  const [mainTabValue, setMainTabValue] = useState(0);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    feature?: Feature;
    action: 'enable' | 'disable';
}>({ open: false, action: 'enable' });
  const [professionFeatureDialog, setProfessionFeatureDialog] = useState<{
    open: boolean;
    professionId?: string;
    featureId?: string;
    featureName?: string;
    action: 'enable' | 'disable';
  }>({ open: false, action: 'enable' });
  const [_selectedTabId, setSelectedTabId] = useState<string>('');
  const [tabDialog, setTabDialog] = useState<{
    open: boolean;
    professionId?: string;
    tabId?: string;
    tabLabel?: string;
    action: 'enable' | 'disable';
  }>({ open: false, action: 'enable' });
  const [_searchQuery, _setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(', ');
  const [_userOverrideDialog, setUserOverrideDialog] = useState<{
    open: boolean;
    type: 'tab' | 'feature' | 'plan' | 'beta' | 'vip';
    userId?: string;
    itemId?: string;
    itemLabel?: string;
  }>({ open: false, type: 'tab' });

  // Register component with Master Integration
  React.useEffect(() => {
    lifecycle.registerComponent({
      id: 'FeatureManagement',
      type: 'admin',
      version: '1.0.0',
      capabilities: {
        data: ['features','categories','stats'],
        events: ['feature:toggled','category:toggled','features:initialized'],
        actions: ['toggleFeature','toggleCategory','initializeFeatures','refresh'],
        ui: ['dashboard','cards','accordions','dialogs','switches'],
        system: ['feature-flags','admin-controls','unified-workflow-integration']
      },
      dependencies: ['theming-system','api-client'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    // Track component opened
    analytics.trackEvent('feature_management_opened', {
      selectedCategory,
      totalFeatures: 0
    });

    return () => {
      lifecycle.unregisterComponent('FeatureManagement');
    };
  }, []);

  // Integration handlers for unified workflow system
  const handleFeatureToggled = (feature: Feature, enabled: boolean) => {
    debugging.logIntegration('info', 'Feature toggled', { feature: feature.name, enabled });
    
    // Track analytics
    analytics.trackEvent('feature_toggled', {
      featureId: feature.id,
      featureName: feature.name,
      enabled,
      impact: feature.impact,
      category: feature.category
    });
    
    // Sync data with data flow
    dataFlow.syncData('FeatureManagement:featureToggled', {
      feature,
      enabled,
      timestamp: new Date().toISOString()
    });
    
    // Broadcast event
    communication.sendBroadcast('feature:toggled', {
      type: 'feature_toggled',
      featureId: feature.id,
      featureName: feature.name,
      enabled,
      component: 'FeatureManagement'
    });
    
    // Trigger unified workflow events
    if (onSettingsUpdate) {
      onSettingsUpdate({
        featureId: feature.id,
        featureName: feature.name,
        enabled: enabled,
        timestamp: new Date().toISOString(),
        source: 'feature_management'
    });
  }
    
    if (onNotificationCreate) {
      onNotificationCreate({
        id: `feature_toggled_${Date.now()}`,
        type: 'feature_toggled',
        title: `Feature ${enabled ? 'Enabled' : 'Disabled'}`,
        message: `Feature "${feature.name}," has been ${enabled ? 'enabled' : 'disabled'}`,
        priority: feature.impact === 'critical' ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        source: 'feature_management'
    });
  }
};

  // Fetch all features
  const { data: features = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/features'],
    queryFn: async () => {
      const endTiming = performance.startTiming('fetch_features');
      try {
        const headers = await auth.getAuthHeader();
        const data = await apiRequest('/api/admin/features', { headers });
        const safeData = Array.isArray(data) ? data : [];
        analytics.trackEvent('features_fetched', { count: safeData.length });
        return safeData;
      } finally {
        endTiming();
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
});

  // Feature toggle mutation
  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ featureId, enabled }: { featureId: string; enabled: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/features/${featureId}/toggle`, {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          adminId: 'current-admin'
      })
    });
  },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      setConfirmDialog({ open: false, action: 'enable' });
      
      // Find the feature and trigger integration event
      const feature = features.find((f: Feature) => f.id === variables.featureId);
      if (feature) {
        handleFeatureToggled(feature, variables.enabled);
    }
  }
});

  // Category toggle mutation
  const toggleCategoryMutation = useMutation({
    mutationFn: async ({ category, enabled }: { category: string; enabled: boolean }) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/admin/features/category/${category}/toggle`, {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'PATCH',
        body: JSON.stringify({
          enabled,
          adminId: 'current-admin'
      })
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
  }
});

  // Initialize features mutation
  const initializeFeaturesMutation = useMutation({
    mutationFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/admin/features/initialize', {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
      },
        method: 'POST'
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
  }
});

  const categories = useMemo(
    () => Array.from(new Set(features.map((f: Feature) => f.category))) as string[],
    [features]
  );
  const _filteredFeatures = useMemo(
    () => selectedCategory === 'all'
      ? features
      : features.filter((f: Feature) => f.category === selectedCategory),
    [features, selectedCategory]
  );

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
}
};

  const getCategoryStats = (category: string) => {
    const categoryFeatures = features.filter((f: Feature) => f.category === category);
    const enabled = categoryFeatures.filter((f: Feature) => f.enabled).length;
    return { total: categoryFeatures.length, enabled, percentage: (enabled / categoryFeatures.length) * 100 };
};

  const handleFeatureToggle = (feature: Feature, enabled: boolean) => {
    if (feature.impact === 'critical' || feature.dependencies?.length) {
      setConfirmDialog({
        open: true,
        feature,
        action: enabled ? 'enable' : 'disable'
    });
  } else {
      toggleFeatureMutation.mutate({ featureId: feature.id, enabled });
  }
};

  const handleCategoryToggle = (category: string, enabled: boolean) => {
    analytics.trackEvent('category_toggled', { category, enabled });
    debugging.logIntegration('info','Category toggled', { category, enabled });
    toggleCategoryMutation.mutate({ category, enabled });
};

  const confirmFeatureToggle = () => {
    if (confirmDialog.feature) {
      toggleFeatureMutation.mutate({
        featureId: confirmDialog.feature.id,
        enabled: confirmDialog.action === 'enable'
    });
  }
};

  if (isLoading) {
    return <AdminLoading label="Laster inn funksjoner..." />;
}

  if (error) {
    return (
      <AdminError
        message="Feil ved lasting av funksjoner. Vennligst prøv igjen."
        onRetry={() => window.location.reload()}
      />
    );
}

  // Handle profession feature toggle
  const handleProfessionFeatureToggle = (professionId: string, featureId: string, enabled: boolean) => {
    const feature = PROFESSION_FEATURE_MATRIX[professionId]?.availableFeatures[featureId];
    if (!feature) return;
    
    setProfessionFeatureDialog({
      open: true,
      professionId,
      featureId,
      featureName: featureId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      action: enabled ? 'enable' : 'disable'
    });
  };
  
  const confirmProfessionFeatureToggle = async () => {
    const { professionId, featureId, action } = professionFeatureDialog;
    if (!professionId || !featureId) return;
    
    try {
      // Update in-memory matrix
      if (action === 'enable') {
        enableProfessionFeature(professionId, featureId);
      } else {
        disableProfessionFeature(professionId, featureId);
      }

      // Save to backend
      const headers = await auth.getAuthHeader();
      await apiRequest(`/api/admin/profession-features/${professionId}/${featureId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: action === 'enable' }),
        headers: { ...headers, 'Content-Type' : 'application/json' }
      });
      
      // Track analytics
      analytics.trackEvent('profession_feature_toggled', {
        professionId,
        featureId,
        enabled: action === 'enable'
      });
      
      // Close dialog and refresh
      setProfessionFeatureDialog({ open: false, action: 'enable' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/profession-features'] });
      
    } catch (error) {
      console.error('profession_feature_toggle_failed', error);
    }
  };

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h2" sx={{ fontWeight: 600, color: themeColors.primary }}>
          Funksjonsadministrasjon
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] })}
          >
            Oppdater
          </Button>
          <AdminButton
            tone="primary"
            startIcon={<PowerSettingsNew />}
            onClick={() => initializeFeaturesMutation.mutate()}
            loading={initializeFeaturesMutation.isPending}
          >
            Initialiser funksjoner
          </AdminButton>
        </Box>
      </Box>
      
      {/* Main Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={mainTabValue} onChange={(e, v) => setMainTabValue(v)}>
          <Tab label="Global Features" icon={<Settings />} iconPosition="start" />
          <Tab label="Profession Features" icon={<Category />} iconPosition="start" />
          <Tab label="Dashboard Control" icon={<Category />} iconPosition="start" />
          <Tab label="User Control" icon={<Star />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab 0: Global Features */}
      {mainTabValue === 0 && (
        <>
          {/* Stats Overview */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6">Totalt aktive</Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {features.filter((f: Feature) => f.enabled).length}
              </Typography>
              <Typography variant="body2">av {features.length} funksjoner</Typography>
            </CardContent>
          </Card>
        </Grid>
        {categories.slice(0, 3).map((category: string) => {
          const stats = getCategoryStats(category);
          return (
            <Grid item xs={12} md={3} key={category}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize', color: themeColors.primary }}>
                    {category}
                  </Typography>
                  <Typography variant="h4" sx={{ color: themeColors.primary, fontWeight: 700 }}>
                    {stats.enabled}
                  </Typography>
                  <Typography variant="body2">av {stats.total}</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={stats.percentage}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          );
      })}
      </Grid>

      {/* Category Filter */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="Alle"
            onClick={() => setSelectedCategory('all')}
            color={selectedCategory === 'all' ? 'primary' : 'default'}
            variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
          />
          {categories.map((category: string) => (
            <Chip
              key={category}
              label={category.charAt(0).toUpperCase() + category.slice(1)}
              onClick={() => setSelectedCategory(category)}
              color={selectedCategory === category ? 'primary' : 'default'}
              variant={selectedCategory === category ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      </Box>

      {/* Features by Category */}
      {categories.map((category: string) => {
        const categoryFeatures = features.filter((f: Feature) => f.category === category);
        const stats = getCategoryStats(category);
        
        if (selectedCategory !== 'all' && selectedCategory !== category) return null;
        
        return (
          <Accordion key={category} defaultExpanded={selectedCategory === category}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Typography variant="h6" sx={{ textTransform: 'capitalize', flexGrow: 1, color: themeColors.primary }}>
                  {category} ({stats.enabled}/{stats.total})
                </Typography>
                <Chip
                  size="small"
                  label={`${Math.round(stats.percentage)}%`}
                  color={stats.percentage > 80 ? 'success' : stats.percentage > 50 ? 'warning' : 'error'}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={stats.percentage === 100}
                      onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Aktiver eller deaktiver alle funksjoner i ${category}`}
                    />
                }
                  label=""
                  onClick={(e) => e.stopPropagation()}
                  sx={{ ml: 2 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {categoryFeatures.map((feature: Feature) => (
                  <Grid item xs={12} md={6} lg={4} key={feature.id}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        border: feature.enabled ? '2px solid #4caf50' : '1px solid #e0e0e0',
                        opacity: feature.enabled ? 1 : 0.7
                    }}
                    >
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Typography variant="h6" sx={{ flexGrow: 1, color: themeColors.primary }}>
                            {feature.name}
                          </Typography>
                          <Switch
                            checked={feature.enabled}
                            onChange={(e) => handleFeatureToggle(feature, e.target.checked)}
                            disabled={toggleFeatureMutation.isPending}
                            aria-label={`Aktiver eller deaktiver ${feature.name}`}
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {feature.description}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                          <Chip
                            size="small"
                            label={feature.impact}
                            color={getImpactColor(feature.impact) as any}
                            variant="outlined"
                          />
                          {feature.configurable && (
                            <Chip size="small" label="Konfigurerbar" color="info" variant="outlined" />
                          )}
                          {feature.dependencies?.length && (
                            <Tooltip title={`Avhenger av: ${feature.dependencies.join('')}`}>
                              <Chip size="small" label="Avhengigheter" color="warning" variant="outlined" />
                            </Tooltip>
                          )}
                        </Box>
                        
                        <Typography variant="caption" color="text.secondary">
                          Sist endret: {new Date(feature.lastModified).toLocaleDateString('no-NO')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        );
    })}
        </>
      )}

      {/* Tab 1: Profession Features */}
      {mainTabValue === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Profession-spesifikke funksjoner:</strong> Aktiver eller deaktiver funksjoner for spesifikke profesjoner. 
              Kun brukere av den valgte profesjonen vil se disse funksjonene.
            </Typography>
          </Alert>
          
          {/* Profession Selector */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Velg Profesjon</InputLabel>
            <Select
              value={selectedProfession}
              label="Velg Profesjon"
              onChange={(e) => setSelectedProfession(e.target.value)}
            >
              <MenuItem value="photographer">📸 Fotograf</MenuItem>
              <MenuItem value="videographer">🎥 Videograf</MenuItem>
              <MenuItem value="music_producer">🎵 Musikkprodusent</MenuItem>
              <MenuItem value="vendor">🏢 Leverandør</MenuItem>
              <MenuItem value="pet_hotel">🏨 Dyrehotell</MenuItem>
              <MenuItem value="yoga_studio">🧘 Yogastudio</MenuItem>
              <MenuItem value="tattoo_artist">🎨 Tatovør</MenuItem>
              <MenuItem value="hairdresser">✂️ Frisør</MenuItem>
            </Select>
          </FormControl>
          
          {/* Profession Stats */}
          {PROFESSION_FEATURE_MATRIX[selectedProfession] && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {(() => {
                const stats = getProfessionFeatureStats(selectedProfession);
                return (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Totalt Funksjoner</Typography>
                          <Typography variant="h4" sx={{ color: themeColors.primary, fontWeight: 700 }}>
                            {stats.total}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Aktiverte</Typography>
                          <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
                            {stats.enabled}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Valgfrie</Typography>
                          <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700 }}>
                            {stats.optional}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Påkrevde</Typography>
                          <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 700 }}>
                            {stats.required}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </>
                );
              })()}
            </Grid>
          )}
          
          {/* Required Features */}
          <Card sx={{ mb: 3, border: '2px solid #ff9800' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Lock sx={{ color: '#ff9800' }} />
                <Typography variant="h6" sx={{ color: '#ff9800' }}>
                  Påkrevde Funksjoner (Alltid Aktiv)
                </Typography>
              </Box>
              
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Disse funksjonene er essensielle for {selectedProfession} og kan ikke deaktiveres.
              </Typography>
              
              <Grid container spacing={2}>
                {getRequiredFeaturesForProfession(selectedProfession).map((feature: any) => (
                  <Grid item xs={12} md={6} key={feature.featureId}>
                    <Card variant="outlined" sx={{ bgcolor: 'rgba(255, 152, 0, 0.05)' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                            {feature.featureId
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (l: string) => l.toUpperCase())}

                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {feature.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip label="PÅKREVD" size="small" color="warning" />
                              <Chip label={feature.impact.toUpperCase()} size="small" variant="outlined" />
                            </Box>
                          </Box>
                          <CheckCircle sx={{ color: '#4caf50', fontSize: 32 }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
          
          {/* Optional Features */}
          <Card sx={{ border: '2px solid #2196f3' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <LockOpen sx={{ color: '#2196f3' }} />
                <Typography variant="h6" sx={{ color: '#2196f3' }}>
                  Valgfrie Funksjoner (Kan Aktiveres)
                </Typography>
              </Box>
              
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Disse funksjonene kan aktiveres for {selectedProfession} ved behov.
              </Typography>
              
              <Grid container spacing={2}>
                {getOptionalFeaturesForProfession(selectedProfession).map((feature: any) => (
                  <Grid item xs={12} md={6} key={feature.featureId}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        bgcolor: feature.enabled ? 'rgba(76, 175, 80, 0.05)' : 'rgba(158, 158, 158, 0.05)',
                        border: feature.enabled ? '2px solid #4caf50' : '1px solid #e0e0e0'
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                              {feature.featureId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                              {feature.description}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                              <Chip label="VALGFRI" size="small" color="info" />
                              <Chip label={feature.impact.toUpperCase()} size="small" variant="outlined" />
                              <Chip 
                                label={feature.enabled ? 'AKTIV' : 'INAKTIV'} 
                                size="small" 
                                color={feature.enabled ? 'success' : 'default'}
                              />
                            </Box>
                          </Box>
                          <Switch
                            checked={feature.enabled}
                            onChange={(e) => handleProfessionFeatureToggle(
                              selectedProfession,
                              feature.featureId,
                              e.target.checked
                            )}
                            aria-label={`Aktiver eller deaktiver valgfri funksjon ${feature.featureId.replace(/_/g, ' ')}`}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab 2: Dashboard Control (Tabs & Components) */}
      {mainTabValue === 2 && (
        <Box>
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>🎯 Komplett Dashboard Kontroll:</strong> Styr hver enkelt tab, funksjon og komponent for hver profesjon. 
              Du har full kontroll over hva brukerne ser i sitt dashboard!
            </Typography>
          </Alert>
          
          {/* Profession Selector */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Velg Profesjon</InputLabel>
            <Select
              value={selectedProfession}
              label="Velg Profesjon"
              onChange={(e) => {
                setSelectedProfession(e.target.value);
                setSelectedTabId('');
              }}
            >
              <MenuItem value="photographer">📸 Fotograf</MenuItem>
              <MenuItem value="videographer">🎥 Videograf</MenuItem>
              <MenuItem value="music_producer">🎵 Musikkprodusent</MenuItem>
              <MenuItem value="vendor">🏢 Leverandør</MenuItem>
              <MenuItem value="pet_hotel">🏨 Dyrehotell</MenuItem>
            </Select>
          </FormControl>
          
          {/* Dashboard Stats */}
          {PROFESSION_DASHBOARD_CONFIG[selectedProfession] && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {(() => {
                const stats = getProfessionDashboardStats(selectedProfession);
                const config = PROFESSION_DASHBOARD_CONFIG[selectedProfession];
                return (
                  <>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Totalt Tabs</Typography>
                          <Typography variant="h4" sx={{ color: themeColors.primary, fontWeight: 700 }}>
                            {stats.totalTabs}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Aktiverte Tabs</Typography>
                          <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 700 }}>
                            {stats.enabledTabs}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Påkrevde Tabs</Typography>
                          <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 700 }}>
                            {stats.requiredTabs}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Valgfrie Tabs</Typography>
                          <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 700 }}>
                            {stats.optionalTabs}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="textSecondary">Standard Prosjekttype</Typography>
                          <Typography variant="h4" sx={{ color: themeColors.primary, mt: 1 }}>
                            {config.defaultProjectType}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                            {config.projectTypes.filter(pt => pt.enabled).map(pt => (
                              <Chip key={pt.id} label={pt.label} color="primary" variant="outlined" />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </>
                );
              })()}
            </Grid>
          )}
          
          {/* Tab List with Expand/Collapse */}
          <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 600}}>
            Dashboard Tabs
          </Typography>
          
          {getProfessionTabs(selectedProfession).length === 0 && (
            <Alert severity="warning">
              Ingen tabs funnet for denne profesjonen.
            </Alert>
          )}
          
          {PROFESSION_DASHBOARD_CONFIG[selectedProfession]?.tabs.map((tab: DashboardTabConfig) => (
            <Accordion key={tab.tabId} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600}}>
                      {tab.label}
                    </Typography>
                    {tab.required && <Chip label="PÅKREVD" size="small" color="warning" />}
                    {!tab.required && <Chip label="VALGFRI" size="small" color="info" />}
                    <Chip 
                      label={tab.enabled ? 'AKTIV' : 'INAKTIV'} 
                      size="small" 
                      color={tab.enabled ? 'success' : 'default'}
                    />
                    <Chip label={`Order: ${tab.order}`} size="small" variant="outlined" />
                  </Box>
                  {!tab.required && (
                    <Switch
                      checked={tab.enabled}
                      aria-label={`Aktiver eller deaktiver tab ${tab.label}`}
                      onChange={(e) => {
                        e.stopPropagation();
                        setTabDialog({
                          open: true,
                          professionId: selectedProfession,
                          tabId: tab.tabId,
                          tabLabel: tab.label,
                          action: e.target.checked ? 'enable' : 'disable'
                        });
                      }}
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    <strong>Beskrivelse:</strong> {tab.description}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    <strong>Komponent:</strong> <code>{tab.component}</code>
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    <strong>Icon:</strong> {tab.icon}
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Funksjoner i denne taben:
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {Object.entries(tab.features).map(([featureId, feature]: [string, any]) => (
                      <Grid item xs={12} md={6} key={featureId}>
                        <Card 
                          variant="outlined"
                          sx={{ 
                            bgcolor: feature.enabled ? 'rgba(76, 175, 80, 0.05)' : 'rgba(158, 158, 158, 0.05)',
                            border: feature.enabled ? '2px solid #4caf50' : '1px solid #e0e0e0'
                          }}
                        >
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                                  {feature.label}
                                </Typography>
                                <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 1 }}>
                                  ID: <code>{featureId}</code>
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                  {feature.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Chip 
                                    label={feature.optional ? 'VALGFRI' : 'PÅKREVD'} 
                                    size="small" 
                                    color={feature.optional ? 'info' : 'warning'}
                                  />
                                  <Chip 
                                    label={feature.enabled ? 'PÅ' : 'AV'} 
                                    size="small" 
                                    color={feature.enabled ? 'success' : 'default'}
                                  />
                                </Box>
                              </Box>
                              {feature.optional && (
                                <Switch
                                  checked={feature.enabled}
                                  aria-label={`Aktiver eller deaktiver funksjon ${feature.label}`}
                                  onChange={async (e) => {
                                    const success = toggleTabFeature(
                                      selectedProfession,
                                      tab.tabId,
                                      featureId,
                                      e.target.checked
                                    );
                                    if (success) {
                                      // Save to backend
                                      const headers = await auth.getAuthHeader();
                                      apiRequest(`/api/admin/dashboard-config/${selectedProfession}/${tab.tabId}/${featureId}`, {
                                        method: 'PATCH',
                                        body: JSON.stringify({ enabled: e.target.checked }),
                                        headers: { ...headers, 'Content-Type': 'application/json' }
                                      });
                                      
                                      // Track analytics
                                      analytics.trackEvent('tab_feature_toggled', {
                                        professionId: selectedProfession,
                                        tabId: tab.tabId,
                                        featureId,
                                        enabled: e.target.checked
                                      });
                                      
                                      // Force re-render
                                      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-config'] });
                                    }
                                  }}
                                />
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Tab 3: User Control (User-Specific Features) */}
      {mainTabValue === 3 && (
        <Box>
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>👤 Brukerbasert Kontroll:</strong> Aktiver eller deaktiver funksjoner for spesifikke brukere. 
              Dette overstyrer alle andre innstillinger (global, profesjon, dashboard)!
            </Typography>
          </Alert>
          
          {/* User Search */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Søk etter bruker
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Søk etter e-post eller navn</InputLabel>
                  <Select
                    value={selectedUserId}
                    label="Søk etter e-post eller navn"
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <MenuItem value="">-- Velg bruker --</MenuItem>
                    <MenuItem value="user1">john.doe@example.com (Fotograf)</MenuItem>
                    <MenuItem value="user2">jane.smith@example.com (Videograf)</MenuItem>
                    <MenuItem value="user3">erik.olsen@example.com (Musikkprodusent)</MenuItem>
                    <MenuItem value="user4">nina.berg@example.com (Dyrehotell)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              {selectedUserId && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Prioritetsrekkefølge:</strong><br />
                    1. Brukeroverride (høyeste prioritet) ← DET DU SETTER HER<br />
                    2. Plan-basert tilgang (Enterprise &gt; Pro &gt; Free)<br />
                    3. Beta tester tilgang<br />
                    4. Profesjonsbasert tilgang<br />
                    5. Global tilgang (standard)
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          {selectedUserId && (
            <>
              {/* User Info Card */}
              <Card sx={{ mb: 3, border: '2px solid', borderColor: themeColors.primary }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                        {selectedUserId === 'user1' ? 'John Doe' : 
                         selectedUserId === 'user2' ? 'Jane Smith' :
                         selectedUserId === 'user3' ? 'Erik Olsen' : 'Nina Berg'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {selectedUserId === 'user1' ? 'john.doe@example.com' : 
                         selectedUserId === 'user2' ? 'jane.smith@example.com' :
                         selectedUserId === 'user3' ? 'erik.olsen@example.com' : 'nina.berg@example.com'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                        <Chip 
                          label={selectedUserId === 'user1' ? getProfessionDisplayName('photographer') : 
                                 selectedUserId === 'user2' ? getProfessionDisplayName('videographer') :
                                 selectedUserId === 'user3' ? getProfessionDisplayName('music_producer') : 'Dyrehotell'} 
                          color="primary" 
                        />
                        <Chip label="FREE Plan" color="default" />
                        <Chip label="Beta Tester" color="info" variant="outlined" />
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setUserOverrideDialog({ 
                          open: true, 
                          type: 'plan', 
                          userId: selectedUserId 
                        })}
                      >
                        Oppgrader Plan
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setUserOverrideDialog({ 
                          open: true, 
                          type: 'beta', 
                          userId: selectedUserId 
                        })}
                      >
                        Toggle Beta Tester
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setUserOverrideDialog({ 
                          open: true, 
                          type: 'vip', 
                          userId: selectedUserId 
                        })}
                      >
                        Make VIP
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              
              {/* Active Overrides */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Aktive Overrides
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="textSecondary">Tab Overrides</Typography>
                          <Typography variant="h4" sx={{ color: themeColors.primary }}>
                            0
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Ingen tabs manuelt aktivert/deaktivert
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="textSecondary">Feature Overrides</Typography>
                          <Typography variant="h4" sx={{ color: themeColors.primary }}>
                            0
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            Ingen funksjoner manuelt aktivert/deaktivert
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              {/* Tab Overrides */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Overstyr Tabs for denne brukeren
                  </Typography>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Aktiver eller deaktiver spesifikke tabs kun for denne brukeren. Dette overstyrer profesjons- og globale innstillinger.
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* Wedding Timeline Override Example */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                Bryllupstidslinje
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Aktiver bryllupstidslinje kun for denne brukeren
                              </Typography>
                              <Chip label="Standard: AV" size="small" color="default" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr tab Bryllupstidslinje for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'tab',
                                  userId: selectedUserId,
                                  itemId: 'wedding_timeline',
                                  itemLabel: 'Bryllupstidslinje'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Business Intelligence Override Example */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                Forretningsanalyse
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Premium funksjon med SSB og Proff.no data
                              </Typography>
                              <Chip label="Standard: PRO PLAN" size="small" color="warning" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr tab Forretningsanalyse for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'tab',
                                  userId: selectedUserId,
                                  itemId: 'business_intelligence',
                                  itemLabel: 'Forretningsanalyse'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Live Cameras Override Example */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                Live Kameraer
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Premium funksjon for dyrehoteller
                              </Typography>
                              <Chip label="Standard: PREMIUM" size="small" color="warning" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr tab Live Kameraer for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'tab',
                                  userId: selectedUserId,
                                  itemId: 'live_cameras',
                                  itemLabel: 'Live Kameraer'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* AI Assistant Override Example */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                AI Assistent (Beta)
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Ny funksjon i beta-testing
                              </Typography>
                              <Chip label="Standard: BETA ONLY" size="small" color="info" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr tab AI Assistent for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'tab',
                                  userId: selectedUserId,
                                  itemId: 'ai_assistant',
                                  itemLabel: 'AI Assistent'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
              
              {/* Feature Overrides */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Overstyr Funksjoner for denne brukeren
                  </Typography>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Aktiver eller deaktiver spesifikke funksjoner kun for denne brukeren.
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* Unlimited Storage Override */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                Ubegrenset Lagring
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Fjern lagringsgrense for denne brukeren
                              </Typography>
                              <Chip label="Standard: 10GB" size="small" color="default" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr funksjon Ubegrenset Lagring for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'feature',
                                  userId: selectedUserId,
                                  itemId: 'unlimited_storage',
                                  itemLabel: 'Ubegrenset Lagring'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Priority Support Override */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                Prioritert Support
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                24/7 prioritert kundesupport
                              </Typography>
                              <Chip label="Standard: PRO PLAN" size="small" color="warning" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr funksjon Prioritert Support for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'feature',
                                  userId: selectedUserId,
                                  itemId: 'priority_support',
                                  itemLabel: 'Prioritert Support'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* API Access Override */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                API Tilgang
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Full REST API tilgang
                              </Typography>
                              <Chip label="Standard: ENTERPRISE" size="small" color="error" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr funksjon API Tilgang for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'feature',
                                  userId: selectedUserId,
                                  itemId: 'api_access',
                                  itemLabel: 'API Tilgang'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Custom Branding Override */}
                    <Grid item xs={12} md={6}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                                Tilpasset Branding
                              </Typography>
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                Egne farger, logo og domene
                              </Typography>
                              <Chip label="Standard: ENTERPRISE" size="small" color="error" />
                            </Box>
                            <Switch
                              checked={false}
                              aria-label="Overstyr funksjon Tilpasset Branding for denne brukeren"
                              onChange={(_e) => {
                                setUserOverrideDialog({
                                  open: true,
                                  type: 'feature',
                                  userId: selectedUserId,
                                  itemId: 'custom_branding',
                                  itemLabel: 'Tilpasset Branding'
                                });
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </>
          )}
        </Box>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} fullScreen={isMobile} onClose={() => setConfirmDialog({ open: false, action: 'enable' })}>
        <DialogTitle>
          Bekreft funksjonsendring
        </DialogTitle>
        <DialogContent>
          {confirmDialog.feature && (
            <Box>
              <Alert 
                severity={confirmDialog.feature.impact === 'critical' ? 'error' : 'warning'}
                sx={{ mb: 2 }}
              >
                Du er i ferd med å {confirmDialog.action === 'enable' ? 'aktivere' : 'deaktivere'} en{', '}
                {confirmDialog.feature.impact === 'critical' ? 'kritisk' : 'viktig'} funksjon.
              </Alert>
              
              <Typography variant="h6" sx={{ mb: 1, color: themeColors.primary }}>
                {confirmDialog.feature.name}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {confirmDialog.feature.description}
              </Typography>
              
              {confirmDialog.feature.dependencies?.length && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Avhengigheter:
                  </Typography>
                  <List dense>
                    {confirmDialog.feature.dependencies.map(dep => (
                      <ListItem key={dep}>
                        <ListItemText primary={dep} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setConfirmDialog({ open: false, action: 'enable' })}>
            Avbryt
          </AdminButton>
          <AdminButton
            onClick={confirmFeatureToggle}
            tone={confirmDialog.action === 'enable' ? 'primary' : 'danger'}
            loading={toggleFeatureMutation.isPending}
          >
            {confirmDialog.action === 'enable' ? 'Aktiver' : 'Deaktiver'}
          </AdminButton>
        </DialogActions>
      </Dialog>
      
      {/* Profession Feature Confirmation Dialog */}
      <Dialog
        open={professionFeatureDialog.open}
        onClose={() => setProfessionFeatureDialog({ open: false, action: 'enable' })}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {professionFeatureDialog.action === 'enable' ? (
              <CheckCircle sx={{ color: '#4caf50' }} />
            ) : (
              <Warning sx={{ color: '#ff9800' }} />
            )}
            <Typography variant="h6">
              {professionFeatureDialog.action === 'enable' ? 'Aktiver' : 'Deaktiver'} Funksjon
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity={professionFeatureDialog.action === 'enable' ? 'info' : 'warning'} sx={{ mb: 2 }}>
            <Typography variant="body2">
              Du er i ferd med å {professionFeatureDialog.action === 'enable' ? 'aktivere' : 'deaktivere'}{', '}
              <strong>{professionFeatureDialog.featureName}</strong> for{', '}
              <strong>{selectedProfession}</strong>.
            </Typography>
          </Alert>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Dette vil påvirke:</strong>
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Alle brukere av denne profesjonen" 
                secondary="Funksjonen blir synlig/skjult i deres dashboard"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Dashboard tabs" 
                secondary={professionFeatureDialog.action === 'enable' 
                  ? 'Ny tab vil bli lagt til' 
                  : 'Tab vil bli fjernet'}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Funksjonstilgang" 
                secondary={professionFeatureDialog.action === 'enable'
                  ? 'Brukere får tilgang til nye funksjoner'
                  : 'Brukere mister tilgang (eksisterende data beholdes)'}
              />
            </ListItem>
          </List>
          
          {professionFeatureDialog.featureId === 'wedding_timeline' && professionFeatureDialog.professionId === 'videographer' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Bryllupstidslinje for Videografer:</strong><br />
                • Lar videografer planlegge bryllupsvideoproduksjon<br />
                • Synkroniseres med fotografens tidslinje<br />
                • Koordinerer filming med andre leverandører<br />
                • Estimert brukere påvirket: ~150 videografer
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setProfessionFeatureDialog({ open: false, action: 'enable' })}>
            Avbryt
          </AdminButton>
          <AdminButton
            onClick={confirmProfessionFeatureToggle}
            tone={professionFeatureDialog.action === 'enable' ? 'primary' : 'secondary'}
          >
            {professionFeatureDialog.action === 'enable' ? 'Ja, Aktiver' : 'Ja, Deaktiver'}
          </AdminButton>
        </DialogActions>
      </Dialog>
      
      {/* Tab Toggle Confirmation Dialog */}
      <Dialog
        open={tabDialog.open}
        onClose={() => setTabDialog({ open: false, action: 'enable' })}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {tabDialog.action === 'enable' ? (
              <CheckCircle sx={{ color: '#4caf50' }} />
            ) : (
              <Warning sx={{ color: '#ff9800' }} />
            )}
            <Typography variant="h6">
              {tabDialog.action === 'enable' ? 'Aktiver' : 'Deaktiver'} Tab
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity={tabDialog.action === 'enable' ? 'info' : 'warning'} sx={{ mb: 2 }}>
            <Typography variant="body2">
              Du er i ferd med å {tabDialog.action === 'enable' ? 'aktivere' : 'deaktivere'}{', '}
              <strong>"{tabDialog.tabLabel}"</strong> tab for{', '}
              <strong>{selectedProfession}</strong>.
            </Typography>
          </Alert>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Dette vil påvirke:</strong>
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Dashboard tab synlighet" 
                secondary={tabDialog.action === 'enable' 
                  ? 'Tab vil vises i brukerens dashboard' 
                  : 'Tab vil skjules fra brukerens dashboard'}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Alle funksjoner i taben" 
                secondary={tabDialog.action === 'enable'
                  ? 'Alle funksjoner i taben blir tilgjengelige'
                  : 'Alle funksjoner i taben blir utilgjengelige (data beholdes)'}
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Brukeropplevelse" 
                secondary={tabDialog.action === 'enable'
                  ? 'Brukere får tilgang til nye verktøy'
                  : 'Brukere mister tilgang til verktøy (kan reverseres)'}
              />
            </ListItem>
          </List>
          
          {tabDialog.tabId === 'wedding_timeline' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Bryllupstidslinje:</strong><br />
                • Kulturtilpassede tidslinjer (norske, pakistanske, polske bryllup)<br />
                • Koordinering med andre leverandører<br />
                • Klienttilgang via webportal<br />
                • Sanntidssynkronisering
              </Typography>
            </Alert>
          )}
          
          {tabDialog.tabId === 'live_cameras' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Live Kameraer (Premium):</strong><br />
                • Eiere kan se sine kjæledyr live<br />
                • 24/7 opptak og lagring<br />
                • Premium funksjon med ekstra kostnad<br />
                • Øker kundetilfredshet betydelig
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setTabDialog({ open: false, action: 'enable' })}>
            Avbryt
          </AdminButton>
          <AdminButton
            onClick={async () => {
              const { professionId, tabId, action } = tabDialog;
              if (!professionId || !tabId) return;
              
              try {
                // Update in-memory config
                const success = toggleProfessionTab(professionId, tabId, action === 'enable');
                if (!success) {
                  setSnackbar({ open: true, message: 'Kunne ikke endre tab (kan være påkrevd)', severity: 'warning' });
                  return;
                }

                // Save to backend
                const headers = await auth.getAuthHeader();
                await apiRequest(`/api/admin/dashboard-config/${professionId}/${tabId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ enabled: action === 'enable' }),
                  headers: { ...headers, 'Content-Type': 'application/json' }
                });
                
                // Track analytics
                analytics.trackEvent('dashboard_tab_toggled', {
                  professionId,
                  tabId,
                  enabled: action === 'enable'
                });
                
                // Close dialog and refresh
                setTabDialog({ open: false, action: 'enable' });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard-config'] });
                
              } catch (error) {
                console.error('tab_toggle_failed', error);
              }
            }}
            tone={tabDialog.action === 'enable' ? 'primary' : 'secondary'}
          >
            {tabDialog.action === 'enable' ? 'Ja, Aktiver Tab': 'Ja, Deaktiver Tab'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </ThemeProvider>
  );
}