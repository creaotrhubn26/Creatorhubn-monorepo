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
  EmailOutlined as EmailIcon,
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
import { PostAgentPricingPanel } from './PostAgentPricingPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 1, pb: 3 }}>{children}</Box>}
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
  description: string;
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

interface CreatorHubEmailTemplateRow {
  id:
    | 'creatorhub_payment_confirmed'
    | 'creatorhub_account_activated'
    | 'creatorhub_payment_failed'
    | 'creatorhub_payment_recovered'
    | 'creatorhub_subscription_cancelled';
  name: string;
  description: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel?: string | null;
  footerNote?: string | null;
}

type CreatorHubEmailSenderKind = 'billing' | 'welcome' | 'system';

interface CreatorHubEmailSettings {
  identity: {
    appName: string;
    tagline: string;
    domain: string;
    supportEmail: string;
    docsUrl: string;
    emailLogoUrl: string;
  };
  email: {
    fromEmail: string;
    welcomeFromEmail: string;
    systemFromEmail: string;
    replyToEmail: string;
    footerText: string;
    theme: {
      canvasBackground: string;
      cardBackground: string;
      cardBorder: string;
      headerBackground: string;
      headerText: string;
      brandLabelColor: string;
      bodyText: string;
      mutedText: string;
      buttonBackground: string;
      buttonText: string;
      footerText: string;
    };
    templates: CreatorHubEmailTemplateRow[];
  };
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
type PriceManagementSection =
  | 'platform-flags'
  | 'subscriptions'
  | 'email-templates'
  | 'analytics'
  | 'enterprise'
  | 'post-agent';

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
  initialSection?: PriceManagementSection;
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

const defaultCreatorHubEmailSettings: CreatorHubEmailSettings = {
  identity: {
    appName: 'CreatorHub Norge',
    tagline: 'Business OS for creators',
    domain: 'creatorhubn.com',
    supportEmail: 'hello@creatorhubn.com',
    docsUrl: 'https://creatorhubn.com',
    emailLogoUrl: '/creatorhub-wordmark-light.png',
  },
  email: {
    fromEmail: 'billing@creatorhubn.com',
    welcomeFromEmail: 'hello@creatorhubn.com',
    systemFromEmail: 'noreply@creatorhubn.com',
    replyToEmail: 'hello@creatorhubn.com',
    footerText: 'CreatorHub Norge • creatorhubn.com',
    theme: {
      canvasBackground: '#06070b',
      cardBackground: '#11141b',
      cardBorder: '#2a2f39',
      headerBackground: '#0c0f15',
      headerText: '#f6efe4',
      brandLabelColor: '#ffba6c',
      bodyText: '#e7dece',
      mutedText: '#b8aa93',
      buttonBackground: '#ffba6c',
      buttonText: '#16120d',
      footerText: '#918573',
    },
    templates: [
      {
        id: 'creatorhub_payment_confirmed',
        name: 'Betaling registrert',
        description: 'Sendes etter første vellykkede betaling for CreatorHub.',
        subject: 'Betalingen for CreatorHub er registrert',
        title: 'Abonnementet ditt er aktivt',
        body:
          '<p>Hei {{recipientName}},</p><p>Betalingen for <strong>{{planName}}</strong> er registrert. CreatorHub-abonnementet ditt er nå aktivt.</p><p>Du kan gå tilbake til CreatorHub og fortsette arbeidet med en gang.</p>',
        ctaLabel: 'Åpne CreatorHub',
        footerNote:
          'Hvis du trenger hjelp med onboarding eller fakturering, kan du svare direkte på denne e-posten.',
      },
      {
        id: 'creatorhub_account_activated',
        name: 'Konto aktivert',
        description: 'Sendes når CreatorHub-kontoen er aktivert og klar for innlogging.',
        subject: 'CreatorHub-kontoen din er aktivert',
        title: 'Kontoen din er aktivert',
        body:
          '<p>Hei {{recipientName}},</p><p>Kontoen din for <strong>{{planName}}</strong> er nå aktivert i CreatorHub.</p><p>Du kan logge inn med <strong>{{recipientEmail}}</strong> og starte arbeidet med en gang.</p>',
        ctaLabel: 'Logg inn i CreatorHub',
        footerNote:
          'Svar på denne e-posten hvis du vil ha hjelp med oppsett, tilgang eller onboarding.',
      },
      {
        id: 'creatorhub_payment_failed',
        name: 'Betaling feilet',
        description: 'Sendes når Stripe ikke klarer å fornye CreatorHub-abonnementet.',
        subject: 'Betalingen for CreatorHub må oppdateres',
        title: 'Betalingen må oppdateres',
        body:
          '<p>Hei {{recipientName}},</p><p>Stripe klarte ikke å gjennomføre betalingen for <strong>{{planName}}</strong> i CreatorHub.</p><p>Oppdater betalingsinformasjonen så snart som mulig for å unngå avbrudd i abonnementet.</p>',
        ctaLabel: 'Åpne CreatorHub',
        footerNote:
          'Hvis betalingen allerede er oppdatert, kan du se bort fra denne e-posten.',
      },
      {
        id: 'creatorhub_payment_recovered',
        name: 'Betaling gjenopprettet',
        description: 'Sendes når en tidligere mislykket betaling er registrert igjen.',
        subject: 'Betalingen for CreatorHub er godkjent',
        title: 'Betalingen er registrert igjen',
        body:
          '<p>Hei {{recipientName}},</p><p>Betalingen for <strong>{{planName}}</strong> er nå registrert igjen, og CreatorHub-abonnementet ditt er aktivt.</p><p>Du kan fortsette som normalt i CreatorHub.</p>',
        ctaLabel: 'Gå tilbake til CreatorHub',
        footerNote: '',
      },
      {
        id: 'creatorhub_subscription_cancelled',
        name: 'Abonnement avsluttet',
        description: 'Sendes når Stripe melder at CreatorHub-abonnementet er avsluttet.',
        subject: 'CreatorHub-abonnementet ditt er avsluttet',
        title: 'Abonnementet er avsluttet',
        body:
          '<p>Hei {{recipientName}},</p><p>Stripe har registrert at abonnementet for <strong>{{planName}}</strong> er avsluttet.</p><p>Tilgangen din i CreatorHub er derfor stoppet. Hvis du vil fortsette, må abonnementet aktiveres på nytt fra CreatorHub.</p>',
        ctaLabel: 'Åpne CreatorHub',
        footerNote:
          'Dette er en systemmelding. Hvis du trenger hjelp, kan du kontakte oss via supportsiden i CreatorHub.',
      },
    ],
  },
};

function getCreatorHubTemplateSenderKind(
  templateId: CreatorHubEmailTemplateRow['id'],
): CreatorHubEmailSenderKind {
  switch (templateId) {
    case 'creatorhub_account_activated':
      return 'welcome';
    case 'creatorhub_subscription_cancelled':
      return 'system';
    case 'creatorhub_payment_confirmed':
    case 'creatorhub_payment_failed':
    case 'creatorhub_payment_recovered':
    default:
      return 'billing';
  }
}

function getCreatorHubTemplateSenderInfo(
  templateId: CreatorHubEmailTemplateRow['id'],
  settings: CreatorHubEmailSettings,
) {
  switch (getCreatorHubTemplateSenderKind(templateId)) {
    case 'welcome':
      return {
        label: 'Velkomst-avsender',
        email: settings.email.welcomeFromEmail,
      };
    case 'system':
      return {
        label: 'System-avsender',
        email: settings.email.systemFromEmail,
      };
    case 'billing':
    default:
      return {
        label: 'Betalings-avsender',
        email: settings.email.fromEmail,
      };
  }
}

function getPlanRequirement(feature: PlatformFeature): PlanRequirement {
  if (feature.category === 'enterprise') return 'enterprise';
  if (feature.category === 'professional' || feature.category === 'premium') return 'pro';
  return 'basic';
}

function mapSubscriptionPlans(plans: PlatformSubscriptionPlan[]): SubscriptionPlanRow[] {
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.displayName || plan.name,
    description: plan.description,
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

function sanitizeSubscriptionPlans(plans: SubscriptionPlanRow[]): SubscriptionPlanRow[] {
  const commercialPlans = plans.filter((plan) => {
    if (plan.id === 'free') {
      return false;
    }

    if (plan.contactSalesOnly) {
      return true;
    }

    if (plan.monthlyPrice > 0) {
      return true;
    }

    return typeof plan.yearlyPrice === 'number' && plan.yearlyPrice > 0;
  });

  const planOrder = ['basic', 'professional', 'premium', 'enterprise'];

  return commercialPlans.sort((left, right) => {
    const leftIndex = planOrder.indexOf(left.id);
    const rightIndex = planOrder.indexOf(right.id);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return left.name.localeCompare(right.name, 'nb-NO');
  });
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
  initialSection = 'subscriptions',
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
  const [editingPlanName, setEditingPlanName] = useState('');
  const [editingPlanDescription, setEditingPlanDescription] = useState('');
  const [editingPlanFeatures, setEditingPlanFeatures] = useState('');
  const [editingPlanMonthlyPrice, setEditingPlanMonthlyPrice] = useState('');
  const [editingPlanYearlyPrice, setEditingPlanYearlyPrice] = useState('');
  const [editingPlanYearlySavingsLabel, setEditingPlanYearlySavingsLabel] = useState('');
  const [editingPlanPublicPriceLabel, setEditingPlanPublicPriceLabel] = useState('');
  const [editingPlanCtaLabel, setEditingPlanCtaLabel] = useState('');
  const [editingPlanActive, setEditingPlanActive] = useState(true);
  const [editingPlanContactSalesOnly, setEditingPlanContactSalesOnly] = useState(false);
  const [creatorHubEmailSettings, setCreatorHubEmailSettings] = useState<CreatorHubEmailSettings>(
    defaultCreatorHubEmailSettings,
  );
  const [creatorHubEmailSettingsSaving, setCreatorHubEmailSettingsSaving] = useState(false);
  const [editEmailTemplateDialogOpen, setEditEmailTemplateDialogOpen] = useState(false);
  const [editingEmailTemplateId, setEditingEmailTemplateId] =
    useState<CreatorHubEmailTemplateRow['id']>('creatorhub_payment_confirmed');
  const [editingEmailTemplateName, setEditingEmailTemplateName] = useState('');
  const [editingEmailTemplateDescription, setEditingEmailTemplateDescription] = useState('');
  const [editingEmailTemplateSubject, setEditingEmailTemplateSubject] = useState('');
  const [editingEmailTemplateTitle, setEditingEmailTemplateTitle] = useState('');
  const [editingEmailTemplateBody, setEditingEmailTemplateBody] = useState('');
  const [editingEmailTemplateCtaLabel, setEditingEmailTemplateCtaLabel] = useState('');
  const [editingEmailTemplateFooterNote, setEditingEmailTemplateFooterNote] = useState('');
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
  const previewSender = getCreatorHubTemplateSenderInfo(
    editingEmailTemplateId,
    creatorHubEmailSettings,
  );
  const sectionToIndex: Record<PriceManagementSection, number> = {
    'platform-flags': 0,
    subscriptions: 1,
    'email-templates': 2,
    analytics: 3,
    enterprise: 4,
    'post-agent': 5,
  };

  useEffect(() => {
    setTabValue(sectionToIndex[initialSection] ?? 1);
  }, [initialSection]);

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

        let nextPlans = sanitizeSubscriptionPlans(mapSubscriptionPlans(subscriptionPlans));

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
              nextPlans = sanitizeSubscriptionPlans(mapSubscriptionPlans(plansData.plans));
            }
          }
        } catch {
          // Fall back to public pricing hook data.
        }

        try {
          const headers = await auth.getAuthHeader();
          const emailResponse = await fetch('/api/platform/admin/email-settings', {
            headers,
            credentials: 'include',
          });
          if (emailResponse.ok) {
            const emailData = (await emailResponse.json()) as {
              success?: boolean;
              settings?: CreatorHubEmailSettings;
            };
            if (emailData.settings && mounted) {
              setCreatorHubEmailSettings(emailData.settings);
            }
          }
        } catch {
          if (mounted) {
            setCreatorHubEmailSettings(defaultCreatorHubEmailSettings);
          }
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

  const selfServePlans = useMemo(
    () => plans.filter((plan) => !plan.contactSalesOnly),
    [plans],
  );
  const hasLegacyFreePlan = useMemo(
    () => subscriptionPlans.some((plan) => plan.id === 'free' || (plan.price ?? 0) === 0),
    [subscriptionPlans],
  );

  const activePlanCount = useMemo(
    () => plans.filter((plan) => plan.isActive).length,
    [plans],
  );

  const annualPlanCount = useMemo(
    () => plans.filter((plan) => typeof plan.yearlyPrice === 'number' && plan.yearlyPrice > 0).length,
    [plans],
  );

  const monthlyEntryPrice = useMemo(() => {
    const monthlyPrices = selfServePlans
      .map((plan) => plan.monthlyPrice)
      .filter((price): price is number => Number.isFinite(price));
    if (monthlyPrices.length === 0) {
      return null;
    }
    return Math.min(...monthlyPrices);
  }, [selfServePlans]);

  const highlightedPlan = useMemo(
    () => selfServePlans.find((plan) => plan.id === 'professional') ?? selfServePlans[0] ?? null,
    [selfServePlans],
  );
  const enabledFeatureCount = useMemo(
    () => features.filter((feature) => feature.isEnabled).length,
    [features],
  );
  const activeBillingTemplateCount = creatorHubEmailSettings.email.templates.length;
  const priceManagementSurfaceSx = {
    borderRadius: '24px',
    border: '1px solid rgba(17, 24, 39, 0.08)',
    bgcolor: '#ffffff',
    boxShadow: '0 18px 44px rgba(15, 23, 42, 0.06)',
  } as const;
  const priceManagementInsetSx = {
    borderRadius: '18px',
    border: '1px solid rgba(17, 24, 39, 0.07)',
    bgcolor: '#fcfaf7',
    p: 1.75,
  } as const;

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
      displayName: editingPlanName.trim(),
      description: editingPlanDescription.trim(),
      features: editingPlanFeatures
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
      price: monthlyPrice,
      monthlyPrice,
      yearlyPrice,
      yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
      publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
      ctaLabel: editingPlanCtaLabel.trim() || null,
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
            displayName: editingPlanName.trim(),
            description: editingPlanDescription.trim(),
            features: editingPlanFeatures
              .split('\n')
              .map((entry) => entry.trim())
              .filter(Boolean),
            price: monthlyPrice,
            monthlyPrice,
            yearlyPrice,
            yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
            publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
            ctaLabel: editingPlanCtaLabel.trim() || null,
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
            name: editingPlanName.trim() || plan.name,
            description: editingPlanDescription.trim(),
            features: editingPlanFeatures
              .split('\n')
              .map((entry) => entry.trim())
              .filter(Boolean),
            price: monthlyPrice,
            monthlyPrice,
            yearlyPrice,
            yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
            publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
            ctaLabel: editingPlanCtaLabel.trim() || null,
            isActive: editingPlanActive,
          }
        : plan,
    );
    setPlans(
      updatedPlanFromServer
        ? sanitizeSubscriptionPlans(locallyUpdatedRows.map((plan) =>
            plan.id === editingPlanId ? mapSubscriptionPlans([updatedPlanFromServer])[0] : plan,
          ))
        : sanitizeSubscriptionPlans(locallyUpdatedRows),
    );
    setEditPlanDialogOpen(false);

    onSettingsUpdate?.({
      source: 'price_management',
      action: 'plan_updated',
      planId: editingPlanId,
      displayName: editingPlanName.trim(),
      description: editingPlanDescription.trim(),
      features: editingPlanFeatures
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
      monthlyPrice,
      yearlyPrice,
      yearlySavingsLabel: editingPlanYearlySavingsLabel.trim() || null,
      publicPriceLabel: editingPlanPublicPriceLabel.trim() || null,
      ctaLabel: editingPlanCtaLabel.trim() || null,
      isActive: editingPlanActive,
      serverUpdated: updatedServer,
    });

    setSnackbar({
      open: true,
      message: updatedServer ? 'Plan oppdatert på server.' : 'Plan oppdatert lokalt.',
      severity: 'success',
    });
  };

  const saveCreatorHubEmailSettings = async (
    nextSettings: CreatorHubEmailSettings,
    successMessage: string,
  ) => {
    setCreatorHubEmailSettingsSaving(true);
    try {
      const headers = await auth.getAuthHeader();
      const response = await fetch('/api/platform/admin/email-settings', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: nextSettings }),
      });

      if (!response.ok) {
        throw new Error('Save CreatorHub email settings failed');
      }

      const data = (await response.json()) as {
        settings?: CreatorHubEmailSettings;
      };
      setCreatorHubEmailSettings(data.settings ?? nextSettings);
      setSnackbar({ open: true, message: successMessage, severity: 'success' });
      return true;
    } catch {
      setSnackbar({
        open: true,
        message: 'Kunne ikke lagre CreatorHub e-postoppsett på server.',
        severity: 'error',
      });
      return false;
    } finally {
      setCreatorHubEmailSettingsSaving(false);
    }
  };

  const openEmailTemplateEditor = (template: CreatorHubEmailTemplateRow) => {
    setEditingEmailTemplateId(template.id);
    setEditingEmailTemplateName(template.name);
    setEditingEmailTemplateDescription(template.description);
    setEditingEmailTemplateSubject(template.subject);
    setEditingEmailTemplateTitle(template.title);
    setEditingEmailTemplateBody(template.body);
    setEditingEmailTemplateCtaLabel(template.ctaLabel ?? '');
    setEditingEmailTemplateFooterNote(template.footerNote ?? '');
    setEditEmailTemplateDialogOpen(true);
  };

  const saveEmailTemplate = async () => {
    const nextSettings: CreatorHubEmailSettings = {
      ...creatorHubEmailSettings,
      email: {
        ...creatorHubEmailSettings.email,
        templates: creatorHubEmailSettings.email.templates.map((template) =>
          template.id === editingEmailTemplateId
            ? {
                ...template,
                name: editingEmailTemplateName.trim() || template.name,
                description: editingEmailTemplateDescription.trim() || template.description,
                subject: editingEmailTemplateSubject.trim(),
                title: editingEmailTemplateTitle.trim(),
                body: editingEmailTemplateBody.trim(),
                ctaLabel: editingEmailTemplateCtaLabel.trim() || null,
                footerNote: editingEmailTemplateFooterNote.trim() || null,
              }
            : template,
        ),
      },
    };

    const saved = await saveCreatorHubEmailSettings(nextSettings, 'CreatorHub e-postmal lagret.');
    if (saved) {
      setEditEmailTemplateDialogOpen(false);
    }
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
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Laster prisstyring...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          mb: 3,
          borderRadius: '24px',
          border: '1px solid rgba(15, 52, 96, 0.08)',
          background: 'linear-gradient(135deg, rgba(15, 52, 96, 0.08), rgba(233, 69, 96, 0.05))',
          px: { xs: 2, sm: 3 },
          py: { xs: 2.25, sm: 2.75 },
        }}
      >
        <Stack
          direction={{ xs: 'column', xl: 'row' }}
          spacing={2.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', xl: 'stretch' }}
        >
          <Box sx={{ maxWidth: 720, flex: 1 }}>
            <Typography variant="overline" sx={{ color: '#0f3460', fontWeight: 700, letterSpacing: '0.08em' }}>
              CreatorHub Commerce
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700, letterSpacing: '-0.03em', color: '#111827' }}>
              Prisstyring
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: '#5b6472', lineHeight: 1.7 }}>
              Hold selvbetjente planer, årsprising og enterprise-sporet samlet i én arbeidsflate.
              Endringene her skal være lesbare både for teamet og for det som faktisk publiseres på CreatorHub.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              <Chip label={`${activePlanCount} aktive planer`} sx={{ bgcolor: '#ffffff', border: '1px solid rgba(15, 52, 96, 0.08)' }} />
              <Chip label={`${annualPlanCount} med årsbetaling`} sx={{ bgcolor: '#ffffff', border: '1px solid rgba(15, 52, 96, 0.08)' }} />
              <Chip label={`${enabledFeatureCount} aktive features`} sx={{ bgcolor: '#ffffff', border: '1px solid rgba(15, 52, 96, 0.08)' }} />
              {highlightedPlan ? (
                <Chip
                  label={`Hovedplan: ${highlightedPlan.name}`}
                  sx={{ bgcolor: '#ffffff', border: '1px solid rgba(15, 52, 96, 0.08)' }}
                />
              ) : null}
              {hasLegacyFreePlan ? (
                <Chip
                  label="Gratisplan skjules internt"
                  sx={{ bgcolor: '#ffffff', border: '1px solid rgba(15, 52, 96, 0.08)' }}
                />
              ) : (
                <Chip
                  label="Kun betalte planer publiseres"
                  sx={{ bgcolor: '#ffffff', border: '1px solid rgba(15, 52, 96, 0.08)' }}
                />
              )}
            </Stack>
          </Box>

          <Box
            sx={{
              minWidth: { xl: 320 },
              width: { xs: '100%', xl: 360 },
              display: 'grid',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                borderRadius: '18px',
                border: '1px solid rgba(17, 24, 39, 0.08)',
                bgcolor: 'rgba(255,255,255,0.72)',
                px: 1.75,
                py: 1.5,
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 }}>
                Det som publiseres nå
              </Typography>
              <Typography sx={{ mt: 0.6, fontWeight: 700, color: '#111827' }}>
                {selfServePlans.length} selvbetjente planer og {annualPlanCount} årspriser er ute.
              </Typography>
            </Box>
            <Box
              sx={{
                borderRadius: '18px',
                border: '1px solid rgba(17, 24, 39, 0.08)',
                bgcolor: 'rgba(255,255,255,0.72)',
                px: 1.75,
                py: 1.5,
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 }}>
                Operativ kontroll
              </Typography>
              <Typography sx={{ mt: 0.6, color: '#5b6472', lineHeight: 1.6 }}>
                Samme innhold styrer landingssiden, abonnementssiden, checkout og CreatorHub-mailene.
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard tone="teal" icon={<MoneyIcon sx={{ fontSize: 30 }} />} label="Laveste månedlige inngang">
            {monthlyEntryPrice != null
              ? formatPrice(monthlyEntryPrice, 'NOK')
              : 'Ikke satt'}
          </MetricCard>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard tone="blue" icon={<PeopleIcon sx={{ fontSize: 30 }} />} label="Selvbetjente planer">
            {selfServePlans.length}
          </MetricCard>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard tone="violet" icon={<ToggleIcon sx={{ fontSize: 30 }} />} label="Årspris tilgjengelig">
            {annualPlanCount}
          </MetricCard>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard tone="amber" icon={<EnterpriseIcon sx={{ fontSize: 30 }} />} label="Kontakt salg-spor">
            {plans.some((plan) => plan.contactSalesOnly) ? 'Aktivt' : 'Av'}
          </MetricCard>
        </Grid>
      </Grid>

      <Box
        sx={{
          mb: 3,
          p: 0.75,
          borderRadius: '18px',
          border: '1px solid rgba(17, 24, 39, 0.08)',
          bgcolor: '#fbfbfc',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(_, value: number) => setTabValue(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 0,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              minHeight: 42,
              textTransform: 'none',
              color: '#667085',
              borderRadius: '12px',
              px: 1.75,
              mr: 0.75,
              fontWeight: 700,
            },
            '& .Mui-selected': {
              bgcolor: '#ffffff',
              color: '#111827',
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
            },
          }}
        >
          <Tab icon={<ToggleIcon />} label="Plattform-flagg" />
          <Tab icon={<PeopleIcon />} label="Abonnementer" />
          <Tab icon={<EmailIcon />} label="E-postmaler" />
          <Tab icon={<AnalyticsIcon />} label="Analyse" />
          <Tab icon={<EnterpriseIcon />} label="Enterprise" />
          <Tab icon={<MoneyIcon />} label="Post Agent" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Alert severity="info" sx={{ mb: 3, borderRadius: '16px' }}>
          Denne fanen styrer tekniske plattform-flagg. Hva som faktisk vises i abonnementene redigeres under
          <strong> Abonnementer</strong>, slik at landingssiden, subscription-flyten og checkout bruker samme innhold.
        </Alert>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            mb: 3,
          }}
        >
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
            sx={{
              bgcolor: professionColors[selectedProfession],
              borderRadius: '12px',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: professionColors[selectedProfession],
                boxShadow: 'none',
                opacity: 0.92,
              },
            }}
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
                    borderRadius: '22px',
                    border: '1px solid rgba(17, 24, 39, 0.08)',
                    boxShadow: '0 14px 34px rgba(15, 23, 42, 0.05)',
                    bgcolor: '#ffffff',
                    '&:hover': { boxShadow: '0 20px 42px rgba(15, 23, 42, 0.08)' },
                  }}
                >
                  <CardContent sx={{ p: 2.4 }}>
                    <Box
                      sx={{
                        mb: 2,
                        height: 6,
                        width: 56,
                        borderRadius: '999px',
                        bgcolor: getProfessionColor(feature.professions[0]),
                      }}
                    />
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
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  sx={{ mb: 2.5 }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                      <MoneyIcon sx={{ mr: 1 }} />
                      Selvbetjente abonnementer
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Dette er planene som vises offentlig og kan gå direkte til Stripe.
                    </Typography>
                  </Box>
                  <Chip
                    label={`${selfServePlans.length} planer ute i salg`}
                    sx={{ bgcolor: '#f8fafc', border: '1px solid rgba(15, 23, 42, 0.08)', fontWeight: 700 }}
                  />
                </Stack>
                <TableContainer
                  sx={{
                    borderRadius: '20px',
                    border: '1px solid rgba(17, 24, 39, 0.08)',
                    bgcolor: '#fffdfa',
                  }}
                >
                  <Table
                    size="small"
                    sx={{
                      '& thead th': {
                        bgcolor: '#f8f5ef',
                        color: '#6b6257',
                        fontSize: '0.78rem',
                        borderBottom: '1px solid rgba(17, 24, 39, 0.08)',
                      },
                      '& tbody td': {
                        borderBottom: '1px solid rgba(17, 24, 39, 0.06)',
                        verticalAlign: 'top',
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#fffaf1',
                      },
                    }}
                  >
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
                              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280, display: 'block' }}>
                                {plan.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {plan.features.length} features i visning
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
                              sx={{ fontWeight: 700 }}
                            />
                            <Button
                              size="small"
                              sx={{ ml: 1, textTransform: 'none', fontWeight: 700 }}
                              onClick={() => {
                                setEditingPlanId(plan.id);
                                setEditingPlanName(plan.name);
                                setEditingPlanDescription(plan.description);
                                setEditingPlanFeatures(plan.features.join('\n'));
                                setEditingPlanMonthlyPrice(String(plan.monthlyPrice));
                                setEditingPlanYearlyPrice(String(plan.yearlyPrice ?? plan.monthlyPrice * 10));
                                setEditingPlanYearlySavingsLabel(plan.yearlySavingsLabel ?? '');
                                setEditingPlanPublicPriceLabel(plan.publicPriceLabel ?? '');
                                setEditingPlanCtaLabel(plan.ctaLabel ?? '');
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
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Publiseringsstatus
                </Typography>
                <Stack spacing={1.25}>
                  <Box sx={priceManagementInsetSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Hovedplan for konvertering
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>
                      {highlightedPlan?.name || 'Ikke satt'}
                    </Typography>
                  </Box>
                  <Box sx={priceManagementInsetSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Aktiv månedsinngang
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>
                      {monthlyEntryPrice != null ? formatPrice(monthlyEntryPrice, 'NOK') : 'Ikke satt'}
                    </Typography>
                  </Box>
                  <Box sx={priceManagementInsetSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Enterprise-spor
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 700 }}>
                      {plans.some((plan) => plan.contactSalesOnly) ? 'Kontakt salg aktivert' : 'Ikke konfigurert'}
                    </Typography>
                  </Box>
                  <Box sx={priceManagementInsetSx}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                      Hva oppdateres automatisk
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.6, color: '#5b6472', lineHeight: 1.6 }}>
                      Landingssiden, abonnementssiden og CreatorHub-checkout bruker samme planstruktur
                      som denne tabellen.
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  sx={{ mb: 2.5 }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                      <EmailIcon sx={{ mr: 1 }} />
                      CreatorHub e-postmaler
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Samme settings brukes i checkout, webhook og i all automatisk billing-kommunikasjon.
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={creatorHubEmailSettingsSaving}
                    onClick={() =>
                      void saveCreatorHubEmailSettings(
                        creatorHubEmailSettings,
                        'CreatorHub e-postinnstillinger lagret.',
                      )
                    }
                    sx={theming.getThemedButtonSx()}
                  >
                    {creatorHubEmailSettingsSaving ? 'Lagrer...' : 'Lagre oppsett'}
                  </Button>
                </Stack>

                <Stack spacing={2.25}>
                  <Box sx={priceManagementInsetSx}>
                    <Typography variant="overline" sx={{ color: '#0f3460', fontWeight: 700 }}>
                      Brand og support
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        label="Appnavn i e-post"
                        value={creatorHubEmailSettings.identity.appName}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            identity: { ...previous.identity, appName: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="Tagline"
                        value={creatorHubEmailSettings.identity.tagline}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            identity: { ...previous.identity, tagline: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="Support e-post"
                        value={creatorHubEmailSettings.identity.supportEmail}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            identity: { ...previous.identity, supportEmail: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="Domene"
                        value={creatorHubEmailSettings.identity.domain}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            identity: { ...previous.identity, domain: event.target.value },
                          }))
                        }
                      />
                    </Stack>
                  </Box>

                  <Box sx={priceManagementInsetSx}>
                    <Typography variant="overline" sx={{ color: '#0f3460', fontWeight: 700 }}>
                      Avsendere
                    </Typography>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      <TextField
                        fullWidth
                        label="Fra-adresse"
                        helperText="Bruk en Google Workspace-alias som finnes på avsenderbrukeren, for eksempel billing@creatorhubn.com."
                        value={creatorHubEmailSettings.email.fromEmail}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            email: { ...previous.email, fromEmail: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="Velkomst-avsender"
                        helperText="Brukes for konto aktivert / velkomst, for eksempel hello@creatorhubn.com."
                        value={creatorHubEmailSettings.email.welcomeFromEmail}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            email: { ...previous.email, welcomeFromEmail: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="System-avsender"
                        helperText="Brukes for enveis systemvarsler, for eksempel abonnement avsluttet og andre driftsmeldinger."
                        value={creatorHubEmailSettings.email.systemFromEmail}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            email: { ...previous.email, systemFromEmail: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="Reply-to"
                        value={creatorHubEmailSettings.email.replyToEmail}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            email: { ...previous.email, replyToEmail: event.target.value },
                          }))
                        }
                      />
                      <TextField
                        fullWidth
                        label="Footer"
                        value={creatorHubEmailSettings.email.footerText}
                        onChange={(event) =>
                          setCreatorHubEmailSettings((previous) => ({
                            ...previous,
                            email: { ...previous.email, footerText: event.target.value },
                          }))
                        }
                      />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 7 }}>
            <Card sx={{ ...priceManagementSurfaceSx, height: '100%' }}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Når disse mailene går ut
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ ...priceManagementInsetSx, bgcolor: '#f8fafc' }}>
                    <Typography variant="overline" sx={{ color: '#0f3460', fontWeight: 700 }}>
                      Første vellykkede betaling
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Sendes etter første vellykkede Stripe-checkout, slik at brukeren får en tydelig bekreftelse på at CreatorHub-abonnementet er aktivt.
                    </Typography>
                  </Box>
                  <Box sx={{ ...priceManagementInsetSx, bgcolor: '#eff6ff' }}>
                    <Typography variant="overline" sx={{ color: '#1d4ed8', fontWeight: 700 }}>
                      Konto aktivert
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Sendes sammen med første aktivering når kontoen faktisk er aktivert og brukeren kan logge inn i CreatorHub med den registrerte e-posten.
                    </Typography>
                  </Box>
                  <Box sx={{ ...priceManagementInsetSx, bgcolor: '#fff7ed' }}>
                    <Typography variant="overline" sx={{ color: '#c2410c', fontWeight: 700 }}>
                      Betaling feilet
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Sendes når Stripe melder `invoice.payment_failed` eller abonnementet blir stoppet før betalingen er tilbake på plass.
                    </Typography>
                  </Box>
                  <Box sx={{ ...priceManagementInsetSx, bgcolor: '#ecfdf5' }}>
                    <Typography variant="overline" sx={{ color: '#047857', fontWeight: 700 }}>
                      Betaling gjenopprettet
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Sendes når en konto som tidligere sto som feilet får en ny vellykket `invoice.paid` og abonnementet blir aktivt igjen.
                    </Typography>
                  </Box>
                  <Box sx={{ ...priceManagementInsetSx, bgcolor: '#f5f3ff' }}>
                    <Typography variant="overline" sx={{ color: '#6d28d9', fontWeight: 700 }}>
                      Alias i bruk
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      <Chip label={`billing: ${creatorHubEmailSettings.email.fromEmail}`} sx={{ width: 'fit-content', bgcolor: '#ffffff' }} />
                      <Chip label={`hello: ${creatorHubEmailSettings.email.welcomeFromEmail}`} sx={{ width: 'fit-content', bgcolor: '#ffffff' }} />
                      <Chip label={`noreply: ${creatorHubEmailSettings.email.systemFromEmail}`} sx={{ width: 'fit-content', bgcolor: '#ffffff' }} />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  sx={{ mb: 2.5 }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Maler som går ut automatisk
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Daniel kan styre subject, tittel, innhold, CTA og fotnote per mal. Public CreatorHub bruker samme språk og prisnivå som her.
                    </Typography>
                  </Box>
                  <Chip
                    label={`${activeBillingTemplateCount} aktive billing-maler`}
                    sx={{ bgcolor: '#f8fafc', border: '1px solid rgba(15, 23, 42, 0.08)', fontWeight: 700 }}
                  />
                </Stack>

                <TableContainer
                  sx={{
                    borderRadius: '20px',
                    border: '1px solid rgba(17, 24, 39, 0.08)',
                    bgcolor: '#fffdfa',
                  }}
                >
                  <Table
                    size="small"
                    sx={{
                      '& thead th': {
                        bgcolor: '#f8f5ef',
                        color: '#6b6257',
                        fontSize: '0.78rem',
                        borderBottom: '1px solid rgba(17, 24, 39, 0.08)',
                      },
                      '& tbody td': {
                        borderBottom: '1px solid rgba(17, 24, 39, 0.06)',
                        verticalAlign: 'top',
                      },
                      '& tbody tr:hover': {
                        bgcolor: '#fffaf1',
                      },
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Mal</strong></TableCell>
                        <TableCell><strong>Avsender</strong></TableCell>
                        <TableCell><strong>Subject</strong></TableCell>
                        <TableCell><strong>CTA</strong></TableCell>
                        <TableCell><strong>Handling</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {creatorHubEmailSettings.email.templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {template.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360, display: 'block' }}>
                                {template.description}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.35}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {getCreatorHubTemplateSenderInfo(template.id, creatorHubEmailSettings).label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {getCreatorHubTemplateSenderInfo(template.id, creatorHubEmailSettings).email}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>{template.subject}</TableCell>
                          <TableCell>{template.ctaLabel || 'Ingen CTA'}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                              onClick={() => openEmailTemplateEditor(template)}
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
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard tone="emerald" icon={<TrendingUpIcon sx={{ fontSize: 30 }} />} label="Total Revenue (30d)">
              {analytics.metrics.totalRevenue.toLocaleString('nb-NO')} kr
            </MetricCard>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard tone="blue" icon={<PeopleIcon sx={{ fontSize: 30 }} />} label="New Subscriptions">
              {analytics.metrics.newSubscriptions}
            </MetricCard>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard tone="violet" icon={<ToggleIcon sx={{ fontSize: 30 }} />} label="Feature Usage">
              {analytics.metrics.featureUsage}
            </MetricCard>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <MetricCard tone="amber" icon={<TrendingUpIcon sx={{ fontSize: 30 }} />} label="Plan Upgrades">
              {analytics.metrics.upgrades}
            </MetricCard>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
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

      <TabPanel value={tabValue} index={4}>
        <Alert severity="info" sx={{ mb: 3, borderRadius: '16px' }}>
          <strong>Norsk MVA (25%):</strong> Alle priser under er oppgitt <strong>eks. MVA</strong>.
        </Alert>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
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
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
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
            <Card sx={priceManagementSurfaceSx}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
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

      <TabPanel value={tabValue} index={5}>
        <PostAgentPricingPanel theming={theming} priceManagementSurfaceSx={priceManagementSurfaceSx} />
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
            label="Navn i UI"
            value={editingPlanName}
            onChange={(event) => setEditingPlanName(event.target.value)}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Beskrivelse"
            value={editingPlanDescription}
            onChange={(event) => setEditingPlanDescription(event.target.value)}
            sx={{ mt: 2 }}
          />
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
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            label="CTA-knapp"
            placeholder={editingPlanContactSalesOnly ? 'Kontakt salg' : 'Velg plan'}
            value={editingPlanCtaLabel}
            onChange={(event) => setEditingPlanCtaLabel(event.target.value)}
            sx={{ mt: 2 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={5}
            label="Features som vises"
            placeholder={'Én feature per linje'}
            value={editingPlanFeatures}
            onChange={(event) => setEditingPlanFeatures(event.target.value)}
            helperText="Disse punktene brukes i landingssiden og i subscription-flyten automatisk."
            sx={{ mt: 2 }}
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

      <Dialog
        open={editEmailTemplateDialogOpen}
        onClose={() => setEditEmailTemplateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Rediger CreatorHub e-postmal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Navn"
              value={editingEmailTemplateName}
              onChange={(event) => setEditingEmailTemplateName(event.target.value)}
            />
            <TextField
              fullWidth
              label="Beskrivelse"
              value={editingEmailTemplateDescription}
              onChange={(event) => setEditingEmailTemplateDescription(event.target.value)}
            />
            <TextField
              fullWidth
              label="Subject"
              value={editingEmailTemplateSubject}
              onChange={(event) => setEditingEmailTemplateSubject(event.target.value)}
            />
            <TextField
              fullWidth
              label="Overskrift i e-posten"
              value={editingEmailTemplateTitle}
              onChange={(event) => setEditingEmailTemplateTitle(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={8}
              label="Body (HTML tillatt)"
              value={editingEmailTemplateBody}
              onChange={(event) => setEditingEmailTemplateBody(event.target.value)}
              helperText="Bruk variabler som {{recipientName}}, {{planName}}, {{amountLabel}} og {{billingCycleLabel}}."
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="CTA-label"
                  value={editingEmailTemplateCtaLabel}
                  onChange={(event) => setEditingEmailTemplateCtaLabel(event.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Fotnote"
                  value={editingEmailTemplateFooterNote}
                  onChange={(event) => setEditingEmailTemplateFooterNote(event.target.value)}
                />
              </Grid>
            </Grid>

            <Box
              sx={{
                borderRadius: '28px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: creatorHubEmailSettings.email.theme.canvasBackground,
                p: { xs: 1.5, sm: 2.5 },
              }}
            >
              <Box
                sx={{
                  maxWidth: 720,
                  margin: '0 auto',
                  borderRadius: '28px',
                  overflow: 'hidden',
                  border: `1px solid ${creatorHubEmailSettings.email.theme.cardBorder}`,
                  background: creatorHubEmailSettings.email.theme.cardBackground,
                  boxShadow: '0 28px 70px rgba(0,0,0,0.34)',
                }}
              >
                <Box
                  sx={{
                    px: { xs: 2.25, sm: 3.5 },
                    py: { xs: 2.5, sm: 3.5 },
                    background: creatorHubEmailSettings.email.theme.headerBackground,
                    color: creatorHubEmailSettings.email.theme.headerText,
                    borderBottom: `1px solid ${creatorHubEmailSettings.email.theme.cardBorder}`,
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {creatorHubEmailSettings.identity.emailLogoUrl ? (
                      <Box
                        component="img"
                        src={creatorHubEmailSettings.identity.emailLogoUrl}
                        alt={creatorHubEmailSettings.identity.appName}
                        sx={{ width: 40, height: 40, flexShrink: 0 }}
                      />
                    ) : null}
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          display: 'block',
                          color: creatorHubEmailSettings.email.theme.brandLabelColor,
                          fontWeight: 800,
                          letterSpacing: '0.18em',
                        }}
                      >
                        {creatorHubEmailSettings.identity.appName}
                      </Typography>
                      <Typography sx={{ fontSize: '0.88rem', color: creatorHubEmailSettings.email.theme.mutedText }}>
                        {creatorHubEmailSettings.identity.tagline}
                      </Typography>
                    </Box>
                  </Stack>
                  <Box
                    sx={{
                      mt: 2.5,
                      display: 'inline-flex',
                      px: 1.5,
                      py: 0.8,
                      borderRadius: '999px',
                      bgcolor: '#171d26',
                      color: creatorHubEmailSettings.email.theme.brandLabelColor,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    CreatorHub Commerce
                  </Box>
                  <Typography
                    variant="h4"
                    sx={{
                      mt: 2,
                      fontWeight: 700,
                      letterSpacing: '-0.03em',
                      fontFamily: '"Space Grotesk", "Inter", sans-serif',
                    }}
                  >
                    {editingEmailTemplateTitle || 'Tittel'}
                  </Typography>
                  <Typography sx={{ mt: 1.25, color: creatorHubEmailSettings.email.theme.mutedText, maxWidth: 520 }}>
                    {creatorHubEmailSettings.identity.tagline} • {creatorHubEmailSettings.identity.domain}
                  </Typography>
                  <Typography
                    sx={{
                      mt: 1.25,
                      color: creatorHubEmailSettings.email.theme.mutedText,
                      fontSize: '0.82rem',
                      lineHeight: 1.7,
                    }}
                  >
                    Sender: {previewSender.label} {' • '} Fra: {previewSender.email} {' • '} Svar til: {creatorHubEmailSettings.email.replyToEmail}
                  </Typography>
                </Box>
                <Box sx={{ px: { xs: 2.25, sm: 3.5 }, py: { xs: 2.5, sm: 3.5 } }}>
                  <Box
                    sx={{ color: creatorHubEmailSettings.email.theme.bodyText, lineHeight: 1.9, fontSize: '0.98rem' }}
                    dangerouslySetInnerHTML={{ __html: editingEmailTemplateBody || '<p>Forhåndsvisning av e-postinnhold.</p>' }}
                  />
                  <Box
                    sx={{
                      mt: 2.5,
                      mb: 2.5,
                      p: 2.25,
                      borderRadius: '20px',
                      border: `1px solid ${creatorHubEmailSettings.email.theme.cardBorder}`,
                      bgcolor: '#141922',
                    }}
                  >
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: creatorHubEmailSettings.email.theme.brandLabelColor, fontWeight: 800 }}>
                          Plan
                        </Typography>
                        <Typography sx={{ mt: 0.75, color: creatorHubEmailSettings.email.theme.headerText, fontWeight: 600 }}>
                          Professional Creator
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography sx={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: creatorHubEmailSettings.email.theme.brandLabelColor, fontWeight: 800 }}>
                          Status
                        </Typography>
                        <Typography sx={{ mt: 0.75, color: creatorHubEmailSettings.email.theme.headerText, fontWeight: 600 }}>
                          Konto aktivert
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                  {editingEmailTemplateCtaLabel ? (
                    <Button
                      variant="contained"
                      sx={{
                        mt: 2.5,
                        borderRadius: '999px',
                        bgcolor: creatorHubEmailSettings.email.theme.buttonBackground,
                        color: creatorHubEmailSettings.email.theme.buttonText,
                        boxShadow: 'none',
                        px: 2.5,
                        py: 1.15,
                        fontWeight: 800,
                        '&:hover': {
                          bgcolor: creatorHubEmailSettings.email.theme.buttonBackground,
                          boxShadow: 'none',
                          opacity: 0.92,
                        },
                      }}
                    >
                      {editingEmailTemplateCtaLabel}
                    </Button>
                  ) : null}
                  {editingEmailTemplateFooterNote ? (
                    <Typography variant="caption" sx={{ display: 'block', mt: 2.5, color: creatorHubEmailSettings.email.theme.mutedText, lineHeight: 1.8 }}>
                      {editingEmailTemplateFooterNote}
                    </Typography>
                  ) : null}
                  <Box sx={{ mt: 2.25, pt: 2, borderTop: `1px solid ${creatorHubEmailSettings.email.theme.cardBorder}` }}>
                    <Typography variant="caption" sx={{ display: 'block', color: creatorHubEmailSettings.email.theme.footerText, lineHeight: 1.8 }}>
                      {creatorHubEmailSettings.email.footerText}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEmailTemplateDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => void saveEmailTemplate()}>
            Lagre mal
          </Button>
        </DialogActions>
      </Dialog>

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
  tone = 'slate',
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  tone?: 'teal' | 'blue' | 'violet' | 'amber' | 'emerald' | 'slate';
}) {
  const toneMap = {
    teal: {
      background: 'linear-gradient(180deg, #f2fbf8 0%, #ffffff 100%)',
      border: 'rgba(13, 148, 136, 0.20)',
      icon: '#0f766e',
      value: '#0f766e',
    },
    blue: {
      background: 'linear-gradient(180deg, #f4f8ff 0%, #ffffff 100%)',
      border: 'rgba(37, 99, 235, 0.18)',
      icon: '#1d4ed8',
      value: '#1d4ed8',
    },
    violet: {
      background: 'linear-gradient(180deg, #f8f5ff 0%, #ffffff 100%)',
      border: 'rgba(124, 58, 237, 0.18)',
      icon: '#7c3aed',
      value: '#6d28d9',
    },
    amber: {
      background: 'linear-gradient(180deg, #fff8ed 0%, #ffffff 100%)',
      border: 'rgba(217, 119, 6, 0.18)',
      icon: '#b45309',
      value: '#c2410c',
    },
    emerald: {
      background: 'linear-gradient(180deg, #effcf5 0%, #ffffff 100%)',
      border: 'rgba(5, 150, 105, 0.18)',
      icon: '#059669',
      value: '#047857',
    },
    slate: {
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
      border: 'rgba(100, 116, 139, 0.16)',
      icon: '#475569',
      value: '#111827',
    },
  } as const;
  const palette = toneMap[tone];
  return (
    <Card
      sx={{
        borderRadius: '22px',
        border: `1px solid ${palette.border}`,
        boxShadow: '0 14px 34px rgba(15, 23, 42, 0.05)',
        background: palette.background,
      }}
    >
      <CardContent sx={{ textAlign: 'center', px: 2, py: 2.25 }}>
        <Box sx={{ color: palette.icon, mb: 1, display: 'flex', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: palette.value }}>
          {children}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}
