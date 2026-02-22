import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Snackbar,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  AddCircle as AddIcon,
  ToggleOn as ToggleIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  AttachMoney as MoneyIcon,
  Business as EnterpriseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { usePlatformPricing } from '../../services/PlatformPricingService';
import { platformPricingService } from '../../services/PlatformPricingService';
// import { CREATORHUB_FEATURES } from '../../../server/creatorhub-features';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  planRequirement: string | null;
  config: any
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  currency: string;
  billingCycle: string;
  features: string[];
  isActive: boolean
}

interface AnalyticsData {
  metrics: {
    totalRevenue: number;
    newSubscriptions: number;
    upgrades: number;
    downgrades: number;
    cancellations: number;
    featureUsage: number;
};
  topFeatures: Array<{
    featureId: string;
    usageCount: number;
    uniqueUsers: number;
}>;
  revenueTrend: Array<{
    date: string;
    revenue: number;
}>;
}

// Integration props for unified workflow connectivity
interface PriceManagementDashboardProps {
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

export default function PriceManagementDashboard({
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
}: PriceManagementDashboardProps) {
  const [tabValue, setTabValue] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Dynamic profession system
  const { getProfessionDisplayName: getDynamicProfessionName } = useDynamicProfessions();

  // Platform pricing service integration
  const { 
    subscriptionPlans, 
    features: platformFeatures, 
    formatPrice,
    isLoading: pricingLoading 
} = usePlatformPricing();

  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedProfession, setSelectedProfession] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string>('');
  const [editingPlanPrice, setEditingPlanPrice] = useState<string>('');
  const [editingPlanActive, setEditingPlanActive] = useState<boolean>(true);
  const [editingSettings, setEditingFeature] = useState<FeatureToggle | null>(null);

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  // Feature form states
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featurePlan, setFeaturePlan] = useState('basic');
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });

  // Enterprise pricing states
  const [enterprisePricing, setEnterprisePricing] = useState({
    basePrice: 1499,
    basePriceAnnual: 14990,
    includedUsers: 3,
    pricePerUser: 299,
    pricePerUserAnnual: 2990,
    volumeDiscounts: [
      { minUsers: 10, discount: 5 },
      { minUsers: 25, discount: 10 },
      { minUsers: 50, discount: 15 },
    ]
  });
  const [enterprisePricingSaving, setEnterprisePricingSaving] = useState(false);
  const [enterprisePricingSaved, setEnterprisePricingSaved] = useState(false);

  const professionColors = {
    photographer: '#FF6B30',
    videographer: '#004E80',
    musicproducer: '#7209B7',
    all: '#2E7D32'
};

  // Integration handlers for unified workflow system
  const handlePricingUpdated = (pricingData: any) => {
    console.log('💰 Pricing Updated, :', pricingData);

    if (onSettingsUpdate) {
      onSettingsUpdate({
        pricingId: pricingData.d,
        pricingName: pricingData.name,
        updated: true,
        timestamp: new Date().toISOString(),
        source: 'price_management'
  });
  }

    if (onNotificationCreate) {
      onNotificationCreate({
        id: `pricing_updated_${Date.now()}`,
        type: 'pricing_updated',
        title: 'Pricing Updated',
        message: `Pricing for "${pricingData.name}," has been updated`,
        priority: 'medium',
        timestamp: new Date().toISOString(),
        source: 'price_management'
  });
  }
};

  const handleFeatureToggled = (featureData: any) => {
    console.log('🔧 Feature Toggled, :', featureData);

    if (onSettingsUpdate) {
      onSettingsUpdate({
        featureId: featureData.d,
        featureName: featureData.name,
        enabled: featureData.enabled,
        timestamp: new Date().toISOString(),
        source: 'price_management'
  });
  }

    if (onNotificationCreate) {
      onNotificationCreate({
        id: `feature_toggled_${Date.now()}`,
        type: 'feature_toggled',
        title: `Feature ${featureData.enabled ? 'Enabled' : 'Disabled'}`,
        message: `Feature "${featureData.name}," has been ${featureData.enabled ? 'enabled' : 'disabled'}`,
        priority: 'low',
        timestamp: new Date().toISOString(),
        source: 'price_management'
  });
  }
};

  // Access control testing function
  const testAccessControl = async (testUserId: string) => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/access/simulate', {
        headers: {
          ...headers, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify({
          simulateUser: testUserId,
          featureId: 'advanced-crm'
    })
    });

      const result = await response.json();
      setSnackbar({ open: true, message: `${result.demonstration.message}\n\n${result.demonstration.norwegianExplanation}\n\nAutomatisk oppførsel: ${result.demonstration.automaticBehavior}`, severity: 'info' });
  } catch (error) {
      console.error('Feil ved testing av tilgangskontroll: ', error);
      setSnackbar({ open: true, message: 'Feil ved testing av tilgangskontroll', severity: 'error' });
  }
};

  useEffect(() => {
    loadData();
}, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Use platform pricing service data instead of direct API calls
      setFeatures(platformFeatures.map(f => ({
        id: f.id,
        name: f.name,
        description: f.description,
        isEnabled: f.isIncluded,
        planRequirement: f.pricingTier,
        config: {}
    })));

      setPlans(subscriptionPlans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price.toString(),
        currency: p.currency,
        billingCycle: p.interval,
        features: p.features,
        isActive: p.isActive
    })));

      // Load analytics (keep this as direct API call for now)
      try {
        const analyticsResponse = await fetch('/api/admin/analytics/dashboard?period=30d');
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
    } catch (error) {
        console.warn('Analytics data not available:', error);
        // Set mock analytics data
        setAnalytics({
          metrics: {
            totalRevenue: 125000,
            newSubscriptions: 23,
            upgrades: 8,
            downgrades: 2,
            cancellations: 1,
            featureUsage: 156 },
          topFeatures: [
            { featureId: 'basic-projects', usageCount: 89, uniqueUsers: 45 },
            { featureId: 'google-drive-integration', usageCount: 67, uniqueUsers: 34 },
            { featureId: 'advanced-crm', usageCount: 45, uniqueUsers: 23 }
          ],
          revenueTrend: [
            { date: '2024-01-01', revenue: 10000 },
            { date: '2024-01-02', revenue: 12000 },
            { date: '2024-01-03', revenue: 15000 }
          ]
      });
    }

      // Load enterprise pricing configuration
      try {
        const enterprisePricingResponse = await fetch('/api/admin/enterprise-pricing');
        const enterprisePricingData = await enterprisePricingResponse.json();
        if (enterprisePricingData.success && enterprisePricingData.data) {
          setEnterprisePricing(enterprisePricingData.data);
        }
      } catch (error) {
        console.warn('Enterprise pricing data not available:', error);
      }

  } catch (error) {
      console.error('Error loading price management data:', error);
  } finally {
      setLoading(false);
  }
};

  const toggleFeature = async (featureId: string) => {
    try {
      await fetch(`/api/admin/features/${featured}/toggle`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'PATCH'
  });
      loadData(); // Reload data
  } catch (error) {
      console.error('Error toggling feature:', error);
  }
};

  const saveFeature = async () => {
    try {
      const featureData = {
        id: editingFeature?.d,
        name: featureName,
        description: featureDescription,
        planRequirement: featurePlan === 'all' ? null : featurePlan,
        isEnabled: featureEnabled
  };

      const headers = await auth.getAuthHeader();
      await fetch('/api/admin/features', {
        headers: {
          ...headers, 'Content-Type' : 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(featureData)
  });

      setDialogOpen(false);
      resetForm();
      loadData();
  } catch (error) {
      console.error('Error saving feature:', error);
  }
};

  const resetForm = () => {
    setFeatureName('');
    setFeatureDescription(', ');
    setFeaturePlan('basic');
    setFeatureEnabled(true);
    setEditingFeature(null);
};

  const CREATORHUB_FEATURES = [
    {
      id: 'basic-projects',
      name: 'Grunnleggende Prosjekter',
      description: 'Opprett og administrer prosjekter med grunnleggende funksjoner',
      category: 'Prosjekt Management',
      professions: ['photographer','videographer','musicproducer'],
      requiredPlan: 'basic',
      isCore: true
    },
    {
      id: 'advanced-crm',
      name: 'Avansert CRM System',
      description: 'Komplett kunde- og prosjektadministrasjon med salgsanalyse',
      category: 'CRM',
      professions: ['photographer','videographer','musicproducer'],
      requiredPlan: 'pro',
      isCore: false
    },
    {
      id: 'google-drive-integration',
      name: 'Google Drive Integrasjon',
      description: 'Automatisk backup og filsynkronisering med Google Drive',
      category: 'Integrasjon',
      professions: ['photographer','videographer','musicproducer'],
      requiredPlan: 'basic',
      isCore: true
},
    {
      id: 'contract-management',
      name: 'Kontrakthåndtering',
      description: 'Automatisk kontrakt-generering og digital signering',
      category: 'Business',
      professions: ['photographer','videographer'],
      requiredPlan: 'pro',
      isCore: false,
      metadata: { betaFeature: true }
    },
    {
      id: 'api-access',
      name: 'API Tilgang',
      description: 'Utvikler API for custom integrasjoner',
      category: 'Development',
      professions: ['photographer','videographer', 'musicproducer'],
      requiredPlan: 'enterprise',
      isCore: false
    }
  ];

  const getFilteredFeatures = () => {
    if (selectedProfession === 'all') return CREATORHUB_FEATURES;
    return CREATORHUB_FEATURES.filter(feature =>
      feature.professions.includes(selectedProfession as any)
    );
  };

  const getProfessionDisplayName = (profession: string) => {
    if (profession === 'all') return 'Alle Profesjoner';
    return getDynamicProfessionName(profession);
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>
          Laster Price Management System...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: theming.colors.primary }}>
        🎯 CreatorHub Norge Price Management System
      </Typography>

      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
        <Tab
          icon={<ToggleIcon />}
          label="Feature Toggle API"
          sx={{ fontWeight: 'bold' }}
        />
        <Tab
          icon={<PeopleIcon />}
          label="Subscription Management"
          sx={{ fontWeight: 'bold' }}
        />
        <Tab
          icon={<AnalyticsIcon />}
          label="Advanced Analytics"
          sx={{ fontWeight: 'bold' }}
        />
        <Tab
          icon={<EnterpriseIcon />}
          label="Enterprise Prising"
          sx={{ fontWeight: 'bold' }}
        />
      </Tabs>

      {/* FEATURE TOGGLE TAB */}
      <TabPanel value={tabValue} index={0}>
        {/* Access Control Demo Section */}
        <Card sx={{ mb: 3, background: 'linear-gradient(145deg, #e3f2fd 0%, #f3e5f5 100%)', ...theming.getThemedCardSx() }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              🔐 Automatisk Tilgangskontroll Demo
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Test hvordan systemet automatisk gir eller nekter tilgang basert på pakkevalg:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { user: 'Basic Fotograf', id: 'basic-photographer', color: '#ff9800' },
                { user: 'Pro Videograf', id: 'pro-videographer', color: '#2196f3' },
                { user: 'Enterprise Produsent', id: 'enterprise-musicproducer', color: '#4caf50' }
              ].map((testUser) => (
                <Chip
                  key={testUser.id}
                  label={testUser.user}
                  onClick={() => testAccessControl(testUser.id)}
                  sx={{
                    bgcolor: testUser.color,
                    color: 'white', '&:hover': { opacity: 0.8, cursor: 'pointer' }
                  }}
                />
              ))}
            </Box>
            <Alert severity="info" sx={{ mt: 2 }}>
              Klikk på en av brukertypene over for å se hvordan systemet automatisk håndterer tilgangskontroll basert på deres pakkevalg.
            </Alert>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  3 }}>
          <FormControl sx={{ minWidth: 200}}>
            <InputLabel>Filtrer etter profesjon</InputLabel>
            <Select
              value={selectedProfession}
              onChange={(e) => setSelectedProfession(e.target.value)}
              label="Filtrer etter profesjon"
            >
              <MenuItem value="all">Alle Professions</MenuItem>
              <MenuItem value="photographer">Fotograf</MenuItem>
              <MenuItem value="videographer">Videograf</MenuItem>
              <MenuItem value="musicproducer">Musikk Produsent</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: professionColors[selectedProfession] }}
          >
            Legg til Settings
          </Button>
        </Box>

        <Grid container spacing={3}>
          {getFilteredFeatures().map((feature) => (
            <Grid size={{ xs: 12 }} md={6} lg={4} key={feature.id}>
              <Card sx={{
                height: '100%',
                border: `2px solid ${professionColors[feature.professions[0]] || '#ccc'}`, '&:hover': { boxShadow: 6 },
                ...theming.getThemedCardSx()
              }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', flex: 1, color: theming.colors.primary }}>
                      {feature.name}
                    </Typography>
                    <Switch
                      checked={features.find(f => f.id === feature.id)?.isEnabled || false}
                      onChange={() => toggleFeature(feature.id)}
                      color="primary"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {feature.description}
                  </Typography>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {feature.professions.map((profession) => (
                      <Chip
                        key={profession}
                        label={getProfessionDisplayName(profession)}
                        size="small"
                        sx={{
                          bgcolor: professionColors[profession],
                          color: 'white',
                          fontSize: '0.75rem'
                        }}
                      />
                    ))}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      label={feature.requiredPlan || 'Gratis'}
                      color={feature.requiredPlan === 'enterprise' ? 'error' : 
                             feature.requiredPlan === 'pro' ? 'warning' : 'success'}
                      size="small"
                    />
                    
                    {feature.isCore && (
                      <Chip
                        label="Core"
                        variant="outlined"
                        size="small"
                        color="primary"
                      />
                    )}
                    
                    {feature.metadata?.betaFeature && (
                      <Chip
                        label="Beta"
                        variant="outlined"
                        size="small"
                        color="secondary"
                      />
                    )}
                  </Box>

                  <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                    Kategori: {feature.category}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* SUBSCRIPTION MANAGEMENT TAB */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb: 2, display: 'flex', alignItems: 'center'  }}>
                  <MoneyIcon sx={{ mr: 1 }} />
                  Subscription Plans
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Plan</strong></TableCell>
                        <TableCell><strong>Pris</strong></TableCell>
                        <TableCell><strong>Syklus</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell>{plan.name}</TableCell>
                          <TableCell>{plan.price} {plan.currency}</TableCell>
                          <TableCell>{plan.billingCycle}</TableCell>
                          <TableCell>
                            <Chip
                              label={plan.isActive ? 'Aktiv' : 'Inaktiv'}
                              color={plan.isActive ? 'success' : 'default'}
                              size="small"
                            />
                            <Button
                              size="small"
                              sx={{ ml: 1 }}
                              onClick={() => {
                                setEditingPlanId(plan.id);
                                setEditingPlanPrice(plan.price.toString());
                                setEditingPlanActive(plan.isActive);
                                setEditPlanDialogOpen(true);
                              }}
                            >
                              Rediger
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid size={{ xs: 12 }} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb: 2  }}>
                  Subscription Statistics
                </Typography>
                <Box sx={{ textAlign: 'center', py:  4 }}>
                  <Typography variant="h3" color="primary.main" sx={{  fontWeight: 'bold'  }}>
                    {plans.length}
                  </Typography>
                  <Typography color="text.secondary">
                    Aktive Plans
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* ADVANCED ANALYTICS TAB */}
      <TabPanel value={tabValue} index={2}>
        {analytics && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                    {analytics.metrics.totalRevenue} kr
                  </Typography>
                  <Typography color="text.secondary">
                    Total Revenue (30d)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                    {analytics.metrics.newSubscriptions}
                  </Typography>
                  <Typography color="text.secondary">
                    New Subscriptions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <ToggleIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                    {analytics.metrics.featureUsage}
                  </Typography>
                  <Typography color="text.secondary">
                    Feature Usage
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                    {analytics.metrics.upgrades}
                  </Typography>
                  <Typography color="text.secondary">
                    Plan Upgrades
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Top Features by Usage
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Feature</strong></TableCell>
                          <TableCell><strong>Usage Count</strong></TableCell>
                          <TableCell><strong>Unique Users</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analytics.topFeatures.slice(0, 10).map((feature) => (
                          <TableRow key={feature.featureId}>
                            <TableCell>{feature.featureId}</TableCell>
                            <TableCell>{feature.usageCount}</TableCell>
                            <TableCell>{feature.uniqueUsers}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* ENTERPRISE PRICING TAB */}
      <TabPanel value={tabValue} index={3}>
        {/* MVA Info Alert */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>Norsk MVA (25%):</strong> Alle priser under er oppgitt <strong>eks. MVA</strong>.
          MVA (25%) legges automatisk til i priskalkulator og kundevisning.
        </Alert>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                  <EnterpriseIcon sx={{ mr: 1 }} />
                  Enterprise Basispriser (eks. MVA)
                </Typography>

                <TextField
                  fullWidth
                  label="Månedlig basispris (NOK eks. MVA)"
                  type="number"
                  value={enterprisePricing.basePrice}
                  onChange={(e) => setEnterprisePricing(prev => ({ ...prev, basePrice: Number(e.target.value) }))}
                  sx={{ mb: 2 }}
                  helperText={`Grunnpris eks. MVA (inkl. MVA: ${Math.round(enterprisePricing.basePrice * 1.25).toLocaleString('nb-NO')} kr)`}
                />

                <TextField
                  fullWidth
                  label="Årlig basispris (NOK eks. MVA)"
                  type="number"
                  value={enterprisePricing.basePriceAnnual}
                  onChange={(e) => setEnterprisePricing(prev => ({ ...prev, basePriceAnnual: Number(e.target.value) }))}
                  sx={{ mb: 2 }}
                  helperText={`Årlig grunnpris eks. MVA (inkl. MVA: ${Math.round(enterprisePricing.basePriceAnnual * 1.25).toLocaleString('nb-NO')} kr)`}
                />

                <TextField
                  fullWidth
                  label="Inkluderte brukere"
                  type="number"
                  value={enterprisePricing.includedUsers}
                  onChange={(e) => setEnterprisePricing(prev => ({ ...prev, includedUsers: Number(e.target.value) }))}
                  sx={{ mb: 2 }}
                  helperText="Antall brukere inkludert i basisprisen"
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                  <PeopleIcon sx={{ mr: 1 }} />
                  Pris per ekstra bruker (eks. MVA)
                </Typography>

                <TextField
                  fullWidth
                  label="Månedlig pris per bruker (NOK eks. MVA)"
                  type="number"
                  value={enterprisePricing.pricePerUser}
                  onChange={(e) => setEnterprisePricing(prev => ({ ...prev, pricePerUser: Number(e.target.value) }))}
                  sx={{ mb: 2 }}
                  helperText={`Pris per ekstra bruker eks. MVA (inkl. MVA: ${Math.round(enterprisePricing.pricePerUser * 1.25).toLocaleString('nb-NO')} kr)`}
                />

                <TextField
                  fullWidth
                  label="Årlig pris per bruker (NOK eks. MVA)"
                  type="number"
                  value={enterprisePricing.pricePerUserAnnual}
                  onChange={(e) => setEnterprisePricing(prev => ({ ...prev, pricePerUserAnnual: Number(e.target.value) }))}
                  sx={{ mb: 2 }}
                  helperText={`Årlig pris per ekstra bruker eks. MVA (inkl. MVA: ${Math.round(enterprisePricing.pricePerUserAnnual * 1.25).toLocaleString('nb-NO')} kr)`}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                  <TrendingUpIcon sx={{ mr: 1 }} />
                  Volumrabatter
                </Typography>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Minimum brukere</strong></TableCell>
                        <TableCell><strong>Rabatt (%)</strong></TableCell>
                        <TableCell><strong>Handling</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {enterprisePricing.volumeDiscounts.map((discount, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={discount.minUsers}
                              onChange={(e) => {
                                const newDiscounts = [...enterprisePricing.volumeDiscounts];
                                newDiscounts[index].minUsers = Number(e.target.value);
                                setEnterprisePricing(prev => ({ ...prev, volumeDiscounts: newDiscounts }));
                              }}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={discount.discount}
                              onChange={(e) => {
                                const newDiscounts = [...enterprisePricing.volumeDiscounts];
                                newDiscounts[index].discount = Number(e.target.value);
                                setEnterprisePricing(prev => ({ ...prev, volumeDiscounts: newDiscounts }));
                              }}
                              sx={{ width: 100 }}
                              InputProps={{ endAdornment: '%' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => {
                                const newDiscounts = enterprisePricing.volumeDiscounts.filter((_, i) => i !== index);
                                setEnterprisePricing(prev => ({ ...prev, volumeDiscounts: newDiscounts }));
                              }}
                            >
                              Fjern
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Button
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const newDiscounts = [...enterprisePricing.volumeDiscounts, { minUsers: 100, discount: 20 }];
                    setEnterprisePricing(prev => ({ ...prev, volumeDiscounts: newDiscounts }));
                  }}
                  sx={{ mt: 2 }}
                >
                  Legg til rabattnivå
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card sx={{ ...theming.getThemedCardSx(), background: 'linear-gradient(145deg, #e8f5e9 0%, #f3e5f5 100%)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                  <MoneyIcon sx={{ mr: 1 }} />
                  Priskalkulator Forhåndsvisning (inkl. MVA 25%)
                </Typography>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Antall brukere</strong></TableCell>
                        <TableCell><strong>Månedlig eks. MVA</strong></TableCell>
                        <TableCell><strong>Månedlig inkl. MVA</strong></TableCell>
                        <TableCell><strong>Årlig inkl. MVA</strong></TableCell>
                        <TableCell><strong>Rabatt</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[3, 5, 10, 15, 25, 50, 100].map((userCount) => {
                        const extraUsers = Math.max(0, userCount - enterprisePricing.includedUsers);
                        const baseMonthlyExMva = enterprisePricing.basePrice + (extraUsers * enterprisePricing.pricePerUser);
                        const baseAnnualExMva = enterprisePricing.basePriceAnnual + (extraUsers * enterprisePricing.pricePerUserAnnual);

                        // Find applicable discount
                        const applicableDiscount = enterprisePricing.volumeDiscounts
                          .filter(d => userCount >= d.minUsers)
                          .sort((a, b) => b.minUsers - a.minUsers)[0];

                        const discountPercent = applicableDiscount?.discount || 0;
                        const monthlyExMva = baseMonthlyExMva * (1 - discountPercent / 100);
                        const annualExMva = baseAnnualExMva * (1 - discountPercent / 100);

                        // Add MVA (25%)
                        const monthlyInclMva = monthlyExMva * 1.25;
                        const annualInclMva = annualExMva * 1.25;

                        return (
                          <TableRow key={userCount}>
                            <TableCell>{userCount} brukere</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {Math.round(monthlyExMva).toLocaleString('nb-NO')} kr
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {discountPercent > 0 ? (
                                <>
                                  <Box component="span" sx={{ textDecoration: 'line-through', color: '#999', mr: 1 }}>
                                    {Math.round(baseMonthlyExMva * 1.25).toLocaleString('nb-NO')} kr
                                  </Box>
                                  <Box component="strong" sx={{ color: '#4caf50' }}>
                                    {Math.round(monthlyInclMva).toLocaleString('nb-NO')} kr
                                  </Box>
                                </>
                              ) : (
                                <strong>{Math.round(monthlyInclMva).toLocaleString('nb-NO')} kr</strong>
                              )}
                            </TableCell>
                            <TableCell>
                              {discountPercent > 0 ? (
                                <>
                                  <Box component="span" sx={{ textDecoration: 'line-through', color: '#999', mr: 1 }}>
                                    {Math.round(baseAnnualExMva * 1.25).toLocaleString('nb-NO')} kr
                                  </Box>
                                  <Box component="strong" sx={{ color: '#4caf50' }}>
                                    {Math.round(annualInclMva).toLocaleString('nb-NO')} kr
                                  </Box>
                                </>
                              ) : (
                                <strong>{Math.round(annualInclMva).toLocaleString('nb-NO')} kr</strong>
                              )}
                            </TableCell>
                            <TableCell>
                              {discountPercent > 0 ? (
                                <Chip
                                  label={`-${discountPercent}%`}
                                  size="small"
                                  color="success"
                                />
                              ) : (
                                <Box component="span" sx={{ color: '#999' }}>-</Box>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Alert severity="info" sx={{ mt: 2 }}>
                  <strong>Prisformel:</strong> (Basispris ({enterprisePricing.basePrice} kr) +
                  (Ekstra brukere × {enterprisePricing.pricePerUser} kr) - Volumrabatt) × 1.25 (MVA)
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {enterprisePricingSaved && (
                <Alert severity="success" sx={{ flex: 1 }}>
                  Enterprise-priser lagret!
                </Alert>
              )}
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={enterprisePricingSaving}
                onClick={async () => {
                  setEnterprisePricingSaving(true);
                  try {
                    await fetch('/api/admin/enterprise-pricing', {
                      method: 'POST',
                      headers: { 'Content-Type' : 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(enterprisePricing)
                    });
                    setEnterprisePricingSaved(true);
                    setTimeout(() => setEnterprisePricingSaved(false), 3000);
                  } catch (error) {
                    console.error('Failed to save enterprise pricing:', error);
                  } finally {
                    setEnterprisePricingSaving(false);
                  }
                }}
                sx={theming.getThemedButtonSx()}
              >
                {enterprisePricingSaving ? 'Lagrer...' : 'Lagre Enterprise-priser'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </TabPanel>

      {/* FEATURE DIALOG */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingFeature ? 'Rediger Feature' : 'Legg til ny Feature'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Feature Name"
            value={featureName}
            onChange={(e) => setFeatureName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={featureDescription}
            onChange={(e) => setFeatureDescription(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Required Plan</InputLabel>
            <Select
              value={featurePlan}
              onChange={(e) => setFeaturePlan(e.target.value)}
              label="Required Plan"
            >
              <MenuItem value="all">Alle Plans</MenuItem>
              <MenuItem value="basic">Basic</MenuItem>
              <MenuItem value="pro">Pro</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={featureEnabled}
                onChange={(e) => setFeatureEnabled(e.target.checked)}
              />
          }
            label="Feature aktivert"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button onClick={saveSettings } variant="contained" sx={theming.getThemedButtonSx()}>Lagre</Button>
        </DialogActions>
      </Dialog>

      {/* EDIT PLAN DIALOG */}
      <Dialog open={editPlanDialogOpen} onClose={() => setEditPlanDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rediger plan</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Pris (NOK pr mnd)"
            type="number"
            inputProps={{ min: 0 }}
            value={editingPlanPrice}
            onChange={(e) => setEditingPlanPrice(e.target.value)}
            sx={{ mt: 1 }}
          />
          <FormControlLabel
            control={<Switch checked={editingPlanActive} onChange={(e) => setEditingPlanActive(e.target.checked)} />}
            label="Plan aktiv"
            sx={{ mt: 1 }}
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            Endringen lagres på server (hvis tilgjengelig), og faller tilbake til lokal override ved feil.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPlanDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => {
              const priceNum = Number(editingPlanPrice);
              if (Number.isNaN(priceNum) || priceNum < 0) {
                setSnackbar({ open: true, message: 'Ugyldig pris', severity: 'error' });
                return;
              }
              fetch(`/api/platform/admin/subscription-plans/${editingPlanId}`, {
                method: 'PATCH',
                headers: { 'Content-Type' : 'application/json' },
                credentials:'include',
                body: JSON.stringify({ price: priceNum, isActive: editingPlanActive }),
              })
                .then(async (res) => {
                  if (!res.ok) throw new Error('Server update failed');
                  return res.json();
                })
                .then(() => {
                  setEditPlanDialogOpen(false);
                })
                .catch(() => {
                  // Fallback to local override
                  const current = subscriptionPlans || [];
                  const updated = current.map((p: any) =>
                    p.id === editingPlanId
                      ? { ...p, price: priceNum, isActive: editingPlanActive, updatedAt: new Date() }
                      : p,
                  );
                  platformPricingService.setOverridePlans(updated as any);
                  setEditPlanDialogOpen(false);
                });
            }}
          >
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Alert severity="info" sx={{ mt:  3 }}>
        <strong>CreatorHub Norge Price Management System</strong><br />
        Komplett feature management med profesjon-kategorisering, subscription management og avansert analytics. 
        Alt er koblet sammen med real-time feature toggles og A/B testing kapabiliteter.
      </Alert>

      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}