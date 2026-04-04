import React, { useEffect, useMemo, useState } from 'react';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import Grid from '@mui/material/Grid2';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
  AddCircle as AddIcon,
  Analytics as AnalyticsIcon,
  AttachMoney as MoneyIcon,
  Business as EnterpriseIcon,
  People as PeopleIcon,
  Save as SaveIcon,
  ToggleOn as ToggleIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  platformPricingService,
  usePlatformPricing,
  type BillingCycle,
  type PlatformFeature,
  type PlatformSubscriptionPlan,
} from '../../services/PlatformPricingService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

type PlanRequirement = 'basic' | 'pro' | 'enterprise' | null;
type ProfessionKey = 'photographer' | 'videographer' | 'musicproducer' | 'all';

interface FeatureToggle {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  planRequirement: PlanRequirement;
}

interface SubscriptionPlanRow {
  id: string;
  name: string;
  price: number;
  monthlyPrice: number;
  yearlyPrice: number | null;
  yearlySavingsLabel?: string | null;
  publicPriceLabel?: string | null;
  currency: string;
  billingCycle: BillingCycle;
  features: string[];
  isActive: boolean;
  contactSalesOnly?: boolean;
  ctaLabel?: string | null;
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

interface EnterprisePricingConfig {
  basePrice: number;
  basePriceAnnual: number;
  includedUsers: number;
  pricePerUser: number;
  pricePerUserAnnual: number;
  volumeDiscounts: Array<{
    minUsers: number;
    discount: number;
  }>;
}

interface CreatorHubFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  professions: Exclude<ProfessionKey, 'all'>[];
  requiredPlan: PlanRequirement;
  isCore: boolean;
  metadata?: {
    betaFeature?: boolean;
  };
}

type WorkflowPayload = Record<string, unknown>;

interface PriceManagementDashboardProps {
  onMeetingCreate?: (meeting: WorkflowPayload) => void;
  onProjectUpdate?: (project: WorkflowPayload) => void;
  onWorklogCreate?: (worklog: WorkflowPayload) => void;
  onClientSelect?: (client: WorkflowPayload) => void;
  onClientUpdate?: (client: WorkflowPayload) => void;
  onShowcaseCreate?: (showcase: WorkflowPayload) => void;
  onFileUpload?: (file: WorkflowPayload) => void;
  onFileDownload?: (file: WorkflowPayload) => void;
  selectedProject?: WorkflowPayload;
  onProjectSelect?: (project: WorkflowPayload) => void;
  selectedClient?: WorkflowPayload;
  onSettingsUpdate?: (settings: WorkflowPayload) => void;
  onNotificationCreate?: (notification: WorkflowPayload) => void;
}

const professionColors: Record<ProfessionKey, string> = {
  photographer: '#FF6B30',
  videographer: '#004E80',
  musicproducer: '#7209B7',
  all: '#2E7D32',
};

const creatorHubFeatures: CreatorHubFeature[] = [
  {
    id: 'basic-projects',
    name: 'Grunnleggende Prosjekter',
    description: 'Opprett og administrer prosjekter med grunnleggende funksjoner.',
    category: 'Prosjektstyring',
    professions: ['photographer', 'videographer', 'musicproducer'],
    requiredPlan: 'basic',
    isCore: true,
  },
  {
    id: 'advanced-crm',
    name: 'Avansert CRM System',
    description: 'Komplett kunde- og prosjektadministrasjon med salgsanalyse.',
    category: 'CRM',
    professions: ['photographer', 'videographer', 'musicproducer'],
    requiredPlan: 'pro',
    isCore: false,
  },
  {
    id: 'google-drive-integration',
    name: 'Google Drive Integrasjon',
    description: 'Automatisk backup og filsynkronisering med Google Drive.',
    category: 'Integrasjon',
    professions: ['photographer', 'videographer', 'musicproducer'],
    requiredPlan: 'basic',
    isCore: true,
  },
  {
    id: 'contract-management',
    name: 'Kontrakthåndtering',
    description: 'Automatisk kontrakt-generering og digital signering.',
    category: 'Business',
    professions: ['photographer', 'videographer'],
    requiredPlan: 'pro',
    isCore: false,
    metadata: { betaFeature: true },
  },
  {
    id: 'api-access',
    name: 'API Tilgang',
    description: 'Utvikler-API for custom integrasjoner.',
    category: 'Development',
    professions: ['photographer', 'videographer', 'musicproducer'],
    requiredPlan: 'enterprise',
    isCore: false,
  },
];

const defaultAnalytics: AnalyticsData = {
  metrics: {
    totalRevenue: 125000,
    newSubscriptions: 23,
    upgrades: 8,
    downgrades: 2,
    cancellations: 1,
    featureUsage: 156,
  },
  topFeatures: [
    { featureId: 'basic-projects', usageCount: 89, uniqueUsers: 45 },
    { featureId: 'google-drive-integration', usageCount: 67, uniqueUsers: 34 },
    { featureId: 'advanced-crm', usageCount: 45, uniqueUsers: 23 },
  ],
  revenueTrend: [
    { date: '2026-01-01', revenue: 10000 },
    { date: '2026-01-02', revenue: 12000 },
    { date: '2026-01-03', revenue: 15000 },
  ],
};

const defaultEnterprisePricing: EnterprisePricingConfig = {
  basePrice: 1499,
  basePriceAnnual: 14990,
  includedUsers: 3,
  pricePerUser: 299,
  pricePerUserAnnual: 2990,
  volumeDiscounts: [
    { minUsers: 10, discount: 5 },
    { minUsers: 25, discount: 10 },
    { minUsers: 50, discount: 15 },
  ],
};

function getPlanRequirement(feature: PlatformFeature): PlanRequirement {
  if (feature.category === 'enterprise') return 'enterprise';
  if (feature.category === 'professional' || feature.category === 'premium') return 'pro';
  return 'basic';
}

function mapSubscriptionPlans(plans: PlatformSubscriptionPlan[]): SubscriptionPlanRow[] {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.displayName || plan.name,
    price: typeof plan.monthlyPrice === 'number' ? plan.monthlyPrice : plan.price,
    monthlyPrice: typeof plan.monthlyPrice === 'number' ? plan.monthlyPrice : plan.price,
    yearlyPrice: typeof plan.yearlyPrice === 'number' ? plan.yearlyPrice : null,
    yearlySavingsLabel: plan.yearlySavingsLabel ?? null,
    publicPriceLabel: plan.publicPriceLabel ?? null,
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    features: plan.features,
    isActive: plan.isActive,
    contactSalesOnly: Boolean(plan.contactSalesOnly),
    ctaLabel: plan.ctaLabel ?? null,
  }));
}

function getProfessionColor(profession: string): string {
  if (Object.prototype.hasOwnProperty.call(professionColors, profession)) {
    return professionColors[profession as ProfessionKey];
  }
  return professionColors.all;
}

function toStatusColor(plan: PlanRequirement): ChipProps['color'] {
  if (plan === 'enterprise') return 'error';
  if (plan === 'pro') return 'warning';
  return 'success';
}

export default function PriceManagementDashboard({
  onSettingsUpdate,
  onNotificationCreate,
  selectedProject,
}: PriceManagementDashboardProps) {
  const [tabValue, setTabValue] = useState(0);
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>(defaultAnalytics);
  const [selectedProfession, setSelectedProfession] = useState<ProfessionKey>('all');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState('');
  const [editingPlanMonthlyPrice, setEditingPlanMonthlyPrice] = useState('');
  const [editingPlanYearlyPrice, setEditingPlanYearlyPrice] = useState('');
  const [editingPlanYearlySavingsLabel, setEditingPlanYearlySavingsLabel] = useState('');
  const [editingPlanPublicPriceLabel, setEditingPlanPublicPriceLabel] = useState('');
  const [editingPlanActive, setEditingPlanActive] = useState(true);
  const [editingPlanContactSalesOnly, setEditingPlanContactSalesOnly] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureToggle | null>(null);
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featurePlan, setFeaturePlan] = useState<Exclude<PlanRequirement, null>>('basic');
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [enterprisePricing, setEnterprisePricing] = useState<EnterprisePricingConfig>(defaultEnterprisePricing);
  const [enterprisePricingSaving, setEnterprisePricingSaving] = useState(false);
  const [enterprisePricingSaved, setEnterprisePricingSaved] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  const theming = useTheming('prototype_tester');
  const { getProfessionDisplayName: getDynamicProfessionName } = useDynamicProfessions();
  const { auth } = useEnhancedMasterIntegration();
  const { subscriptionPlans, features: platformFeatures, isLoading: pricingLoading, formatPrice } = usePlatformPricing();

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const mappedFeatures = platformFeatures.map((feature) => ({
          id: feature.id,
          name: feature.name,
          description: feature.description,
          isEnabled: feature.isIncluded,
          planRequirement: getPlanRequirement(feature),
        }));

        if (!mounted) return;
        setFeatures(mappedFeatures);

        let nextPlans = mapSubscriptionPlans(subscriptionPlans);

        try {
          const headers = await auth.getAuthHeader();
          const plansResponse = await fetch('/api/platform/admin/subscription-plans', {
            headers,
            credentials: 'include',
          });
          if (plansResponse.ok) {
            const plansData = (await plansResponse.json()) as {
              success?: boolean;
              plans?: PlatformSubscriptionPlan[];
            };
            if (Array.isArray(plansData.plans)) {
              nextPlans = mapSubscriptionPlans(plansData.plans);
            }
          }
        } catch {
          // Fall back to public pricing hook data.
        }

        setPlans(nextPlans);

        try {
          const analyticsResponse = await fetch('/api/admin/analytics/dashboard?period=30d');
          if (analyticsResponse.ok) {
            const analyticsData = (await analyticsResponse.json()) as AnalyticsData;
            if (mounted) {
              setAnalytics(analyticsData);
            }
          }
        } catch {
          if (mounted) {
            setAnalytics(defaultAnalytics);
          }
        }

        try {
          const enterpriseResponse = await fetch('/api/admin/enterprise-pricing');
          if (enterpriseResponse.ok) {
            const enterpriseData = (await enterpriseResponse.json()) as {
              success?: boolean;
              data?: EnterprisePricingConfig;
            };
            if (mounted && enterpriseData.success && enterpriseData.data) {
              setEnterprisePricing(enterpriseData.data);
            }
          }
        } catch {
          if (mounted) {
            setEnterprisePricing(defaultEnterprisePricing);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [platformFeatures, subscriptionPlans]);

  const filteredFeatures = useMemo(() => {
    if (selectedProfession === 'all') return creatorHubFeatures;
    return creatorHubFeatures.filter((feature) => feature.professions.includes(selectedProfession));
  }, [selectedProfession]);

  const getProfessionDisplayName = (profession: string) => {
    if (profession === 'all') return 'Alle Profesjoner';
    return getDynamicProfessionName(profession);
  };

  const resetFeatureForm = () => {
    setFeatureName('');
    setFeatureDescription('');
    setFeaturePlan('basic');
    setFeatureEnabled(true);
    setEditingFeature(null);
  };

  const openCreateFeatureDialog = () => {
    resetFeatureForm();
    setDialogOpen(true);
  };

  const toggleFeature = async (featureId: string) => {
    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch(`/api/admin/features/${featureId}/toggle`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Feature toggle failed');
      }
    } catch {
      setSnackbar({ open: true, message: 'Klarte ikke å togggle feature på server.', severity: 'error' });
    } finally {
      setFeatures((previous) =>
        previous.map((feature) =>
          feature.id === featureId ? { ...feature, isEnabled: !feature.isEnabled } : feature,
        ),
      );
    }
  };

  const saveFeature = async () => {
    if (!featureName.trim()) {
      setSnackbar({ open: true, message: 'Feature må ha navn.', severity: 'error' });
      return;
    }

    const featurePayload = {
      id: editingFeature?.id,
      name: featureName.trim(),
      description: featureDescription.trim(),
      planRequirement: featurePlan,
      isEnabled: featureEnabled,
    };

    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(featurePayload),
      });

      if (!response.ok) {
        throw new Error('Save feature failed');
      }
    } catch {
      setSnackbar({
        open: true,
        message: 'Feature lagret lokalt (server utilgjengelig).',
        severity: 'info',
      });
    }

    setFeatures((previous) => {
      const existing = previous.find((feature) => feature.id === (editingFeature?.id ?? ''));
      if (existing) {
        return previous.map((feature) =>
          feature.id === existing.id
            ? {
                ...feature,
                name: featurePayload.name,
                description: featurePayload.description,
                planRequirement: featurePayload.planRequirement,
                isEnabled: featurePayload.isEnabled,
              }
            : feature,
        );
      }

      return [
        ...previous,
        {
          id: featurePayload.id ?? `custom-feature-${Date.now()}`,
          name: featurePayload.name,
          description: featurePayload.description,
          planRequirement: featurePayload.planRequirement,
          isEnabled: featurePayload.isEnabled,
        },
      ];
    });

    onSettingsUpdate?.({
      source: 'price_management',
      action: existingOrNewAction(editingFeature),
      feature: featurePayload,
    });

    setSnackbar({ open: true, message: 'Feature lagret.', severity: 'success' });
    setDialogOpen(false);
    resetFeatureForm();
  };

  const savePlanEdit = async () => {
    const monthlyPrice = Number(editingPlanMonthlyPrice);
    const yearlyPrice = Number(editingPlanYearlyPrice);

    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      setSnackbar({ open: true, message: 'Ugyldig månedspris.', severity: 'error' });
      return;
    }

    if (!Number.isFinite(yearlyPrice) || yearlyPrice < 0) {
      setSnackbar({ open: true, message: 'Ugyldig årspris.', severity: 'error' });
      return;
    }

    const patchPayload = {
      price: monthlyPrice,
      monthlyPrice,
      yearlyPrice,
      yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
      publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
      isActive: editingPlanActive,
    };
    let updatedServer = false;
    let updatedPlanFromServer: PlatformSubscriptionPlan | null = null;

    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch(`/api/platform/admin/subscription-plans/${editingPlanId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      updatedServer = response.ok;
      if (response.ok) {
        const data = (await response.json()) as { plan?: PlatformSubscriptionPlan };
        updatedPlanFromServer = data.plan ?? null;
      }
    } catch {
      updatedServer = false;
    }

    const updatedPlans = subscriptionPlans.map((plan) =>
      plan.id === editingPlanId
        ? {
            ...plan,
            price: monthlyPrice,
            monthlyPrice,
            yearlyPrice,
            yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
            publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
            isActive: editingPlanActive,
            updatedAt: new Date(),
          }
        : plan,
    );

    platformPricingService.setOverridePlans(updatedPlans);
    const locallyUpdatedRows = plans.map((plan) =>
      plan.id === editingPlanId
        ? {
            ...plan,
            price: monthlyPrice,
            monthlyPrice,
            yearlyPrice,
            yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
            publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
            isActive: editingPlanActive,
          }
        : plan,
    );
    setPlans(
      updatedPlanFromServer
        ? locallyUpdatedRows.map((plan) =>
            plan.id === editingPlanId ? mapSubscriptionPlans([updatedPlanFromServer])[0] : plan,
          )
        : locallyUpdatedRows,
    );
    setEditPlanDialogOpen(false);

    onSettingsUpdate?.({
      source: 'price_management',
      action: 'plan_updated',
      planId: editingPlanId,
      monthlyPrice,
      yearlyPrice,
      yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
      publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
      isActive: editingPlanActive,
      serverUpdated: updatedServer,
    });

    setSnackbar({
      open: true,
      message: updatedServer ? 'Plan oppdatert på server.' : 'Plan oppdatert lokalt.',
      severity: 'success',
    });
  };

  const saveEnterprisePricing = async () => {
    setEnterprisePricingSaving(true);
    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/admin/enterprise-pricing', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(enterprisePricing),
      });

      if (!response.ok) {
        throw new Error('Save enterprise pricing failed');
      }

      setEnterprisePricingSaved(true);
      onNotificationCreate?.({
        id: `enterprise-pricing-updated-${Date.now()}`,
        source: 'price_management',
        title: 'Enterprise-priser oppdatert',
        type: 'enterprise_pricing_updated',
        project: selectedProject ?? null,
      });
      setTimeout(() => setEnterprisePricingSaved(false), 3000);
    } catch {
      setSnackbar({
        open: true,
        message: 'Kunne ikke lagre enterprise-priser til server.',
        severity: 'error',
      });
    } finally {
      setEnterprisePricingSaving(false);
    }
  };

  if (loading || pricingLoading) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster Price Management System...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold', color: theming.colors.primary }}>
        CreatorHub Norge Price Management
      </Typography>

      <Tabs value={tabValue} onChange={(_, value: number) => setTabValue(value)} sx={{ mb: 3 }}>
        <Tab icon={<ToggleIcon />} label="Feature Toggle" sx={{ fontWeight: 'bold' }} />
        <Tab icon={<PeopleIcon />} label="Subscriptions" sx={{ fontWeight: 'bold' }} />
        <Tab icon={<AnalyticsIcon />} label="Analytics" sx={{ fontWeight: 'bold' }} />
        <Tab icon={<EnterpriseIcon />} label="Enterprise Prising" sx={{ fontWeight: 'bold' }} />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <FormControl sx={{ minWidth: 240 }}>
            <InputLabel>Filtrer etter profesjon</InputLabel>
            <Select
              value={selectedProfession}
              onChange={(event) => setSelectedProfession(event.target.value as ProfessionKey)}
              label="Filtrer etter profesjon"
            >
              <MenuItem value="all">Alle profesjoner</MenuItem>
              <MenuItem value="photographer">Fotograf</MenuItem>
              <MenuItem value="videographer">Videograf</MenuItem>
              <MenuItem value="musicproducer">Musikkprodusent</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateFeatureDialog}
            sx={{ bgcolor: professionColors[selectedProfession] }}
          >
            Legg til feature
          </Button>
        </Box>

        <Grid container spacing={3}>
          {filteredFeatures.map((feature) => {
            const featureState = features.find((item) => item.id === feature.id);
            const isEnabled = featureState?.isEnabled ?? false;
            const planRequirement = featureState?.planRequirement ?? feature.requiredPlan;

            return (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={feature.id}>
                <Card
                  sx={{
                    height: '100%',
                    border: `2px solid ${getProfessionColor(feature.professions[0])}`,
                    '&:hover': { boxShadow: 6 },
                    ...theming.getThemedCardSx(),
                  }}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', flex: 1, color: theming.colors.primary }}>
                        {feature.name}
                      </Typography>
                      <Switch checked={isEnabled} onChange={() => void toggleFeature(feature.id)} color="primary" />
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
                            bgcolor: getProfessionColor(profession),
                            color: 'white',
                            fontSize: '0.75rem',
                          }}
                        />
                      ))}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip label={planRequirement ?? 'Gratis'} color={toStatusColor(planRequirement)} size="small" />

                      {feature.isCore ? (
                        <Chip label="Core" variant="outlined" size="small" color="primary" />
                      ) : null}
                      {feature.metadata?.betaFeature ? (
                        <Chip label="Beta" variant="outlined" size="small" color="secondary" />
                      ) : null}
                    </Box>

                    <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                      Kategori: {feature.category}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                  <MoneyIcon sx={{ mr: 1 }} />
                  Subscription Plans
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <strong>Plan</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Månedlig</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Årlig</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Offentlig visning</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Status</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {plan.name}
                              </Typography>
                              {plan.contactSalesOnly ? (
                                <Chip size="small" label="Kontakt salg" color="warning" sx={{ width: 'fit-content' }} />
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {formatPrice(plan.monthlyPrice, plan.currency as PlatformSubscriptionPlan['currency'])}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.25}>
                              <Typography variant="body2">
                                {plan.yearlyPrice != null
                                  ? formatPrice(plan.yearlyPrice, plan.currency as PlatformSubscriptionPlan['currency'])
                                  : '—'}
                              </Typography>
                              {plan.yearlySavingsLabel ? (
                                <Typography variant="caption" color="text.secondary">
                                  {plan.yearlySavingsLabel}
                                </Typography>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {plan.publicPriceLabel || (plan.contactSalesOnly ? 'Kontakt salg' : 'Pris vises automatisk')}
                          </TableCell>
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
                                setEditingPlanMonthlyPrice(String(plan.monthlyPrice));
                                setEditingPlanYearlyPrice(String(plan.yearlyPrice ?? plan.monthlyPrice * 10));
                                setEditingPlanYearlySavingsLabel(plan.yearlySavingsLabel ?? '');
                                setEditingPlanPublicPriceLabel(plan.publicPriceLabel ?? '');
                                setEditingPlanActive(plan.isActive);
                                setEditingPlanContactSalesOnly(Boolean(plan.contactSalesOnly));
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

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Subscription Statistics
                </Typography>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h3" color="primary.main" sx={{ fontWeight: 'bold' }}>
                    {plans.filter((plan) => plan.isActive).length}
                  </Typography>
                  <Typography color="text.secondary">Aktive planer</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard icon={<TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />} label="Total Revenue (30d)">
              {analytics.metrics.totalRevenue.toLocaleString('nb-NO')} kr
            </MetricCard>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard icon={<PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />} label="New Subscriptions">
              {analytics.metrics.newSubscriptions}
            </MetricCard>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard icon={<ToggleIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />} label="Feature Usage">
              {analytics.metrics.featureUsage}
            </MetricCard>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard icon={<TrendingUpIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />} label="Plan Upgrades">
              {analytics.metrics.upgrades}
            </MetricCard>
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
                        <TableCell>
                          <strong>Feature</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Usage Count</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Unique Users</strong>
                        </TableCell>
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
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <strong>Norsk MVA (25%):</strong> Alle priser under er oppgitt <strong>eks. MVA</strong>.
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
                  onChange={(event) =>
                    setEnterprisePricing((previous) => ({ ...previous, basePrice: Number(event.target.value) }))
                  }
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Årlig basispris (NOK eks. MVA)"
                  type="number"
                  value={enterprisePricing.basePriceAnnual}
                  onChange={(event) =>
                    setEnterprisePricing((previous) => ({ ...previous, basePriceAnnual: Number(event.target.value) }))
                  }
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Inkluderte brukere"
                  type="number"
                  value={enterprisePricing.includedUsers}
                  onChange={(event) =>
                    setEnterprisePricing((previous) => ({ ...previous, includedUsers: Number(event.target.value) }))
                  }
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
                  onChange={(event) =>
                    setEnterprisePricing((previous) => ({ ...previous, pricePerUser: Number(event.target.value) }))
                  }
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Årlig pris per bruker (NOK eks. MVA)"
                  type="number"
                  value={enterprisePricing.pricePerUserAnnual}
                  onChange={(event) =>
                    setEnterprisePricing((previous) => ({ ...previous, pricePerUserAnnual: Number(event.target.value) }))
                  }
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>
                  Volumrabatter
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <strong>Minimum brukere</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Rabatt (%)</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Handling</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {enterprisePricing.volumeDiscounts.map((discount, index) => (
                        <TableRow key={`${discount.minUsers}-${index}`}>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={discount.minUsers}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setEnterprisePricing((previous) => {
                                  const discounts = [...previous.volumeDiscounts];
                                  discounts[index] = { ...discounts[index], minUsers: value };
                                  return { ...previous, volumeDiscounts: discounts };
                                });
                              }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              size="small"
                              value={discount.discount}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setEnterprisePricing((previous) => {
                                  const discounts = [...previous.volumeDiscounts];
                                  discounts[index] = { ...discounts[index], discount: value };
                                  return { ...previous, volumeDiscounts: discounts };
                                });
                              }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              color="error"
                              onClick={() =>
                                setEnterprisePricing((previous) => ({
                                  ...previous,
                                  volumeDiscounts: previous.volumeDiscounts.filter((_, i) => i !== index),
                                }))
                              }
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
                  sx={{ mt: 2 }}
                  onClick={() =>
                    setEnterprisePricing((previous) => ({
                      ...previous,
                      volumeDiscounts: [...previous.volumeDiscounts, { minUsers: 100, discount: 20 }],
                    }))
                  }
                >
                  Legg til rabattnivå
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {enterprisePricingSaved ? <Alert severity="success">Enterprise-priser lagret!</Alert> : null}
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={enterprisePricingSaving}
                onClick={() => void saveEnterprisePricing()}
                sx={theming.getThemedButtonSx()}
              >
                {enterprisePricingSaving ? 'Lagrer...' : 'Lagre Enterprise-priser'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </TabPanel>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingFeature ? 'Rediger feature' : 'Legg til ny feature'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Feature Name"
            value={featureName}
            onChange={(event) => setFeatureName(event.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={featureDescription}
            onChange={(event) => setFeatureDescription(event.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Required Plan</InputLabel>
            <Select
              value={featurePlan}
              onChange={(event) => setFeaturePlan(event.target.value as Exclude<PlanRequirement, null>)}
              label="Required Plan"
            >
              <MenuItem value="basic">Basic</MenuItem>
              <MenuItem value="pro">Pro</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={featureEnabled} onChange={(event) => setFeatureEnabled(event.target.checked)} />}
            label="Feature aktivert"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Avbryt</Button>
          <Button onClick={() => void saveFeature()} variant="contained" sx={theming.getThemedButtonSx()}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editPlanDialogOpen} onClose={() => setEditPlanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Rediger plan</DialogTitle>
        <DialogContent>
          {editingPlanContactSalesOnly ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              Enterprise er fortsatt kontakt-salg utad, men intern måneds- og årspris brukes i admin og rapportering.
            </Alert>
          ) : null}
          <TextField
            fullWidth
            label="Månedspris (NOK)"
            type="number"
            inputProps={{ min: 0 }}
            value={editingPlanMonthlyPrice}
            onChange={(event) => setEditingPlanMonthlyPrice(event.target.value)}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label="Årspris (NOK)"
            type="number"
            inputProps={{ min: 0 }}
            value={editingPlanYearlyPrice}
            onChange={(event) => setEditingPlanYearlyPrice(event.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="Årlig savings-label"
            placeholder="For eksempel: 2 måneder gratis"
            value={editingPlanYearlySavingsLabel}
            onChange={(event) => setEditingPlanYearlySavingsLabel(event.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="Offentlig prislabel"
            placeholder={editingPlanContactSalesOnly ? 'Kontakt salg' : 'Valgfritt'}
            value={editingPlanPublicPriceLabel}
            onChange={(event) => setEditingPlanPublicPriceLabel(event.target.value)}
            helperText={
              editingPlanContactSalesOnly
                ? 'Dette brukes i public UI i stedet for numerisk pris.'
                : 'La feltet stå tomt for vanlig numerisk visning.'
            }
            sx={{ mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch checked={editingPlanActive} onChange={(event) => setEditingPlanActive(event.target.checked)} />
            }
            label="Plan aktiv"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPlanDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void savePlanEdit()}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>

      <Alert severity="info" sx={{ mt: 3 }}>
        Komplett feature management med profesjon-kategorisering, subscription management og analytics.
      </Alert>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function existingOrNewAction(editingFeature: FeatureToggle | null): string {
  return editingFeature ? 'feature_updated' : 'feature_created';
}

function MetricCard({
  children,
  icon,
  label,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  const theming = useTheming('prototype_tester');
  return (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
        {icon}
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
          {children}
        </Typography>
        <Typography color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}
