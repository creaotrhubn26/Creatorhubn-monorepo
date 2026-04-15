// @ts-nocheck
/**
 * CreatorHub Norge - Business Intelligence Dashboard
 * Comprehensive market analysis, SWOT analysis, and marketing strategy interface
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tab,
  Tabs,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  TextField,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Analytics as AnalyticsIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Star as StarIcon,
  Assignment as AssignmentIcon,
  Campaign as CampaignIcon,
  Email as EmailIcon,
  Insights as InsightsIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  Lightbulb as LightbulbIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  GridView as GridViewIcon,
  ViewKanban as ViewKanbanIcon,
  Person as PersonIcon,
  Poll as PollIcon,
  PictureAsPdf as PdfIcon,
  Close as CloseIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import Grid from '@mui/material/Grid2';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { alpha } from '@mui/material/styles';

// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';

// Import Business Intelligence components
import SWOTKanbanBoard from './SWOTKanbanBoard';
import SWOTVisualizations from './SWOTVisualizations';
import PersonaBuilder, { type PersonaData } from './PersonaBuilder';
import SurveyBuilder, { type SurveyData } from './SurveyBuilder';
import EmailDesignerComplete from '../EmailDesigner/EmailDesignerComplete';
import CommunicationHubV2 from './CommunicationHubV2';
import businessIntelligenceService, {
  type CustomerPersona,
  type Survey,
  type SWOTItem,
  type SWOTTrend,
} from '../../services/BusinessIntelligenceService';
import pdfExportService from '../../services/PDFExportService';
import { ALL_ENHANCED_NEWSLETTER_TEMPLATES } from '../../data/enhancedNewsletterTemplates';

interface BusinessIntelligenceDashboardProps {
  userId: string;
  profession: string
}

interface DashboardQuickStats {
  averageMarketPrice?: number;
  competitorCount?: number;
  seasonalDemand?: string;
  bestRegions?: string[];
}

interface DashboardResponse {
  data?: {
    quickStats?: DashboardQuickStats;
    recommendations?: string[];
  };
}

interface PriceRecommendationResponse {
  data?: {
    suggestedPrice?: number;
    confidence?: number;
    reasoning?: string;
    competitiveAdvantage?: string[];
  };
}

interface SeasonalTrendsResponse {
  data?: {
    serviceType?: string;
    monthlyFactors?: number[];
    recommendations?: string[];
  };
}

interface SwotResponse {
  data?: {
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    threats?: string[];
    recommendations?: string[];
    scores?: {
      brand: number;
      product: number;
      distribution: number;
      promotion: number;
      overall: number;
    };
  };
}

interface MarketingStrategyResponse {
  data?: {
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      twitter?: string;
    };
    contentPlan?: Array<{ day: string; content: string }>;
    seo?: {
      primaryKeywords?: string[];
      secondaryKeywords?: string[];
    };
    campaigns?: Array<{ title: string; description: string; duration: string; expectedROI: string }>;
  };
}

interface NewsletterCampaign {
  id: string | number;
  subject: string;
  audience: string;
  status: string;
  scheduledDate: string;
  openRate: string | number;
}

interface NewsletterResponse {
  data?: {
    stats?: {
      totalCampaigns?: number;
      totalSubscribers?: number;
      avgOpenRate?: number;
      avgClickRate?: number;
    };
    campaigns?: NewsletterCampaign[];
  };
}

interface NewsletterForm {
  subject: string;
  content: string;
  audienceSegment: string;
  scheduledDate: string;
  templateId: string;
}

interface ContractSummaryItem {
  id: string | number;
  title?: string;
  client_name?: string;
  project_name?: string;
  daysUntilExpiry?: number;
  signed_at?: string;
}

interface ContractSummaryResponse {
  pending?: ContractSummaryItem[];
  expiring?: ContractSummaryItem[];
  recent?: ContractSummaryItem[];
}

type PersonaRecord = PersonaData & { id: string };

interface ProjectTypeRef {
  label: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function parsePersonaAge(ageRange: string): number {
  const matches = ageRange.match(/\d+/g);
  if (!matches || matches.length === 0) {
    return 35;
  }

  const ages = matches.map((value) => Number.parseInt(value, 10)).filter((value) => !Number.isNaN(value));
  if (ages.length === 0) {
    return 35;
  }

  return Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length);
}

function mapCustomerPersonaToPersonaRecord(persona: CustomerPersona): PersonaRecord {
  return {
    id: persona.id,
    name: persona.name,
    age: parsePersonaAge(persona.ageRange),
    location: persona.location,
    occupation: persona.description,
    family: persona.customerType.replace(/_/g, ' '),
    income: persona.income,
    bio: persona.description,
    goals: persona.goals,
    frustrations: persona.painPoints,
    personality: {
      introvert: 50,
      sensing: 50,
      thinking: 50,
      judging: 50,
    },
    social: {
      growth: 50,
      power: 50,
      social: 50,
    },
    preferredChannels: {
      traditionalAds: 30,
      socialMedia: 50,
      referral: 60,
      email: 40,
    },
    preferredBrands: [],
    avatarColor: persona.avatarUrl ? undefined : '#ff6b35',
  };
}

function deriveCustomerType(persona: PersonaData): CustomerPersona['customerType'] {
  const referralBias = persona.preferredChannels.referral;
  const emailBias = persona.preferredChannels.email;
  const socialBias = persona.preferredChannels.socialMedia;

  if (referralBias >= 70) {
    return 'quality_focused';
  }
  if (emailBias >= 65) {
    return 'time_sensitive';
  }
  if (socialBias >= 75) {
    return 'luxury_seeker';
  }

  return 'budget_conscious';
}

function deriveBudgetTier(income: string): CustomerPersona['budgetTier'] {
  const normalizedIncome = income.toLowerCase();

  if (normalizedIncome.includes('high') || normalizedIncome.includes('premium') || normalizedIncome.includes('luxury')) {
    return 'luxury';
  }
  if (normalizedIncome.includes('mid') || normalizedIncome.includes('middle')) {
    return 'standard';
  }
  if (normalizedIncome.includes('upper')) {
    return 'premium';
  }

  return 'economy';
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`bi-tabpanel-${index}`}
      aria-labelledby={`bi-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// Use enhanced newsletter templates
const NEWSLETTER_TEMPLATES = ALL_ENHANCED_NEWSLETTER_TEMPLATES;

export default function BusinessIntelligenceDashboard({
  userId,
  profession,
}: BusinessIntelligenceDashboardProps) {
  const [tabValue, setTabValue] = useState(0);

  // Use dynamic profession system
  const { professionConfigs, getProfessionDisplayName } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data (tabs, stats, project types)
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters (project types, hourly rates, SEO, etc.)
  const professionAdapter = useProfessionAdapter();
  const {
    getProjectTypes,
    getDefaultHourlyRate,
    hasFeature,
    getContractTemplates,
    getProfessionSpecificKeywords,
    getProfessionSEOTips,
  } = professionAdapter;
  
  // Get profession icon
  const professionIcon = getProfessionIcon(profession);
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const professionConfig = professionConfigs?.[profession];
  
  // Merge API profession configs with dynamic configs for enhanced data
  const enhancedProfessionConfig = apiProfessionConfigs?.[profession] || professionConfig;
  
  // Get project types for reference (used in recommendations)
  const availableProjectTypes = React.useMemo(() => getProjectTypes(), [professionAdapter]);
  const isProjectTypeRef = (value: unknown): value is ProjectTypeRef => {
    if (typeof value !== 'object' || value === null) return false;
    const label = (value as Record<string, unknown>).label;
    return typeof label === 'string';
  };
  const projectTypeRefs = availableProjectTypes.filter(isProjectTypeRef);

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery<DashboardResponse>({
    queryKey: [`/api/business/dashboard/${userId}/${profession}`],
    queryFn: () => apiRequest(`/api/business/dashboard/${userId}/${profession}`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch price recommendation
  const { data: priceData } = useQuery<PriceRecommendationResponse>({
    queryKey: [`/api/business/price-recommendation/${profession}/bryllup`],
    staleTime: 30 * 60 * 1000, // 30 minutes
});

  // Fetch seasonal trends
  const { data: seasonalData } = useQuery<SeasonalTrendsResponse>({
    queryKey: [`/api/business/seasonal-trends/${profession}/bryllup`],
    staleTime: 60 * 60 * 1000, // 1 hour
});

  // Fetch SWOT analysis
  const { data: swotData, isLoading: swotLoading } = useQuery<SwotResponse>({
    queryKey: [`/api/business/swot-analysis/${userId}/${profession}`],
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch marketing strategy
  const { data: marketingData, isLoading: marketingLoading } = useQuery<MarketingStrategyResponse>({
    queryKey: [`/api/business/marketing-strategy/${userId}/${profession}`],
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Fetch newsletter campaigns
  const { data: newsletterData, isLoading: newsletterLoading } = useQuery<NewsletterResponse>({
    queryKey: [`/api/business/newsletter-campaigns/${userId}`],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const queryClient = useQueryClient();

  // Newsletter state
  const [newsletterDialog, setNewsletterDialog] = useState(false);
  const [emailDesignerDialog, setEmailDesignerDialog] = useState(false);
  const [newsletterForm, setNewsletterForm] = useState({
    subject: '',
    content: '',
    audienceSegment: 'all',
    scheduledDate: '',
    templateId: '',
  });

  // SWOT view mode state
  const [swotViewMode, setSwotViewMode] = useState<'grid' | 'kanban' | 'analytics'>('grid');

  // Persona state
  const [personaDialog, setPersonaDialog] = useState(false);
  const [editingPersona, setEditingPersona] = useState<PersonaData | undefined>(undefined);

  // Survey state
  const [surveyDialog, setSurveyDialog] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyData | undefined>(undefined);

  const mapSurveyRecordToBuilderData = (survey: Survey): SurveyData => ({
    id: survey.id,
    title: survey.title,
    description: survey.description,
    purpose: survey.purpose,
    questions: survey.questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      options: question.options,
      required: question.required,
    })),
    status: survey.status,
  });

  // Fetch SWOT items
  const { data: swotItems = [] } = useQuery<SWOTItem[]>({
    queryKey: [`swot_items_${userId}_${profession}`],
    queryFn: () => businessIntelligenceService.getSWOTItems({ userId, profession }),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch SWOT trends
  const { data: swotTrends = [] } = useQuery<SWOTTrend[]>({
    queryKey: [`swot_trends_${userId}_${profession}`],
    queryFn: () => businessIntelligenceService.getSWOTTrends(userId, profession, 30),
    staleTime: 60 * 60 * 1000,
  });

  // Fetch personas
  const { data: customerPersonas = [] } = useQuery<CustomerPersona[]>({
    queryKey: [`personas_${userId}_${profession}`],
    queryFn: () => businessIntelligenceService.getCustomerPersonas(userId, profession),
    staleTime: 60 * 60 * 1000,
  });
  const personas = React.useMemo<PersonaRecord[]>(
    () => customerPersonas.map(mapCustomerPersonaToPersonaRecord),
    [customerPersonas],
  );

  const { data: surveys = [], isLoading: surveysLoading } = useQuery<Survey[]>({
    queryKey: [`surveys_${userId}_${profession}`],
    queryFn: () => businessIntelligenceService.getSurveys(userId, profession),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch contract analytics
  const { data: contractStats } = useQuery({
    queryKey: ['/api/contracts/stats', userId],
    queryFn: () => apiRequest('/api/contracts/stats'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: contractSummary } = useQuery<ContractSummaryResponse>({
    queryKey: ['/api/contracts/summary', userId],
    queryFn: () => apiRequest('/api/contracts/summary'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Create newsletter mutation
  const createNewsletter = useMutation({
    mutationFn: async (data: NewsletterForm) => {
      const response = await fetch(`/api/business/newsletter-campaigns`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!response.ok) throw new Error('Failed to create newsletter');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/business/newsletter-campaigns/${userId}`] });
      setNewsletterDialog(false);
      setNewsletterForm({ subject: '', content: '', audienceSegment: 'all', scheduledDate: '', templateId: '' });
    },
  });

  // SWOT mutations
  const saveSWOTMutation = useMutation({
    mutationFn: (item: Partial<SWOTItem>) => businessIntelligenceService.saveSWOTItem(userId, profession, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`swot_items_${userId}_${profession}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/business/swot-analysis/${userId}/${profession}`] });
    },
  });

  const deleteSWOTMutation = useMutation({
    mutationFn: (itemId: string) => businessIntelligenceService.deleteSWOTItem(userId, profession, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`swot_items_${userId}_${profession}`] });
    },
  });

  // Persona mutations
  const savePersonaMutation = useMutation({
    mutationFn: (persona: PersonaData) =>
      businessIntelligenceService.savePersona(userId, profession, {
        id: persona.id,
        name: persona.name,
        description: persona.bio || persona.occupation,
        ageRange: `${Math.max(persona.age - 5, 18)}-${persona.age + 5}`,
        location: persona.location,
        income: persona.income,
        goals: persona.goals.filter((goal) => goal.trim().length > 0),
        painPoints: persona.frustrations.filter((painPoint) => painPoint.trim().length > 0),
        motivations: persona.preferredBrands.length > 0 ? persona.preferredBrands : persona.goals.filter((goal) => goal.trim().length > 0),
        customerType: deriveCustomerType(persona),
        budgetTier: deriveBudgetTier(persona.income),
        marketSize: 1000,
        averageValue: getDefaultHourlyRate() * 8,
        conversionRate: Math.round((persona.preferredChannels.referral + persona.preferredChannels.email) / 8),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`personas_${userId}_${profession}`] });
      setPersonaDialog(false);
      setEditingPersona(undefined);
    },
  });

  const deletePersonaMutation = useMutation({
    mutationFn: (personaId: string) => businessIntelligenceService.deletePersona(userId, profession, personaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`personas_${userId}_${profession}`] });
    },
  });

  const saveSurveyMutation = useMutation({
    mutationFn: (survey: SurveyData) =>
      businessIntelligenceService.createSurvey(userId, profession, {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        purpose: survey.purpose,
        questions: survey.questions,
        status: survey.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`surveys_${userId}_${profession}`] });
      queryClient.invalidateQueries({ queryKey: [`swot_items_${userId}_${profession}`] });
      setSurveyDialog(false);
      setEditingSurvey(undefined);
    },
  });

  const surveyStats = React.useMemo(() => {
    const activeCount = surveys.filter((survey) => survey.status === 'active').length;
    const totalResponses = surveys.reduce((sum, survey) => sum + (survey.responseCount || 0), 0);
    const generatedInsights = surveys.filter(
      (survey) => survey.purpose === 'swot_analysis' || survey.purpose === 'market_research',
    ).length;
    return { activeCount, totalResponses, generatedInsights };
  }, [surveys]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py:  4 }}>
        <CircularProgress sx={{ color: '#ff6b35' }} />
      </Box>
    );
}

  const quickStats = dashboardData?.data?.quickStats;
  const recommendations = dashboardData?.data?.recommendations || [];
  const seasonalRecommendations = seasonalData?.data?.recommendations ?? [];
  const primaryColor = theming.colors.primary || '#ff6b35';
  const secondaryColor = theming.colors.secondary || '#ff9a62';
  const contractTemplateCount = getContractTemplates().length;
  const activeTabLabel = [
    'Markedsanalyse',
    'SWOT Analyse',
    'Markedsføring',
    'Nyhetsbrev',
    'Personas',
    'Undersøkelser',
    'Kommunikasjon',
    'Kontrakter',
  ][tabValue];

  const topInsightChips = [
    getDefaultHourlyRate() ? `${getDefaultHourlyRate()} kr / time` : 'Sett standard timepris',
    `${projectTypeRefs.length || 0} prosjekttyper`,
    `${contractTemplateCount} kontraktsmaler`,
  ];

  const metricCards = [
    {
      label: 'Markedsgjennomsnitt',
      value: `${quickStats?.averageMarketPrice?.toLocaleString('no-NO') || '0'} kr`,
      description: 'Anbefalt prisnivå i markedet',
      icon: <MoneyIcon aria-hidden="true" />,
      gradient: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
    },
    {
      label: 'Konkurrenter',
      value: `${quickStats?.competitorCount || 0}`,
      description: 'Aktive aktører i segmentet',
      icon: <PeopleIcon aria-hidden="true" />,
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    },
    {
      label: 'Etterspørsel',
      value: `${quickStats?.seasonalDemand || 'Medium'}`,
      description: 'Nåværende markedsmoment',
      icon: <TrendingUpIcon aria-hidden="true" />,
      gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    },
    {
      label: 'Toppregioner',
      value: `${quickStats?.bestRegions?.length || 0}`,
      description: 'Regioner med best potensial',
      icon: <LocationIcon aria-hidden="true" />,
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2.5, md: 3 },
        '& .MuiCard-root:not(.bi-metric-card)': {
          borderRadius: 4,
          border: `1px solid ${alpha(primaryColor, 0.12)}`,
          background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${alpha(primaryColor, 0.04)} 100%)`,
          boxShadow: `0 20px 45px ${alpha('#0f172a', 0.08)}`,
        },
        '& .MuiCardContent-root': {
          p: { xs: 2.25, md: 3 },
        },
        '& .MuiAlert-root': {
          borderRadius: 3,
          border: `1px solid ${alpha(primaryColor, 0.12)}`,
        },
        '& .MuiTableContainer-root': {
          borderRadius: 3,
          border: `1px solid ${alpha(primaryColor, 0.1)}`,
          overflow: 'hidden',
        },
      }}
    >
      <Paper
        sx={{
          ...theming.getThemedCardSx(),
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 5,
          border: `1px solid ${alpha(primaryColor, 0.12)}`,
          background: `linear-gradient(135deg, ${alpha(primaryColor, 0.12)} 0%, rgba(255,255,255,0.98) 32%, ${alpha(secondaryColor, 0.10)} 100%)`,
          boxShadow: `0 28px 70px ${alpha('#0f172a', 0.12)}`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 'auto -80px -120px auto',
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(secondaryColor, 0.20)} 0%, transparent 68%)`,
            pointerEvents: 'none',
          }}
        />
        <Grid container spacing={3} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Box
                  sx={{
                    width: 54,
                    height: 54,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 3,
                    bgcolor: alpha(primaryColor, 0.12),
                    color: primaryColor,
                    border: `1px solid ${alpha(primaryColor, 0.16)}`,
                  }}
                >
                  {professionIcon || <InsightsIcon />}
                </Box>
                <Chip
                  size="small"
                  label={enhancedProfessionConfig?.displayName || professionConfig?.displayName || 'Business Intelligence'}
                  sx={{
                    bgcolor: alpha(primaryColor, 0.10),
                    color: primaryColor,
                    fontWeight: 700,
                    borderRadius: 999,
                  }}
                />
                <Chip
                  size="small"
                  label={activeTabLabel}
                  sx={{
                    bgcolor: 'rgba(15,23,42,0.06)',
                    color: '#0f172a',
                    fontWeight: 600,
                    borderRadius: 999,
                  }}
                />
              </Stack>
              <Box>
                <Typography
                  variant={isMobile ? 'h4' : 'h3'}
                  sx={{
                    color: '#0f172a',
                    fontWeight: 800,
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                    mb: 1.25,
                  }}
                >
                  Business Intelligence som faktisk er lett å bruke
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'rgba(15,23,42,0.72)',
                    maxWidth: 760,
                    lineHeight: 1.7,
                    fontSize: { xs: '0.96rem', md: '1.02rem' },
                  }}
                >
                  Få et ryddig overblikk over marked, SWOT, kommunikasjon, kontrakter og vekstmuligheter for{' '}
                  {(enhancedProfessionConfig?.displayName || professionConfig?.displayName || 'din virksomhet').toLowerCase()}.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {topInsightChips.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.72)',
                      backdropFilter: 'blur(12px)',
                      border: `1px solid ${alpha(primaryColor, 0.12)}`,
                      color: '#0f172a',
                      fontWeight: 600,
                      borderRadius: 999,
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box
              sx={{
                height: '100%',
                p: 2.5,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(18px)',
                border: `1px solid ${alpha(primaryColor, 0.10)}`,
                display: 'grid',
                gap: 1.5,
                alignContent: 'start',
              }}
            >
              <Typography variant="overline" sx={{ color: primaryColor, fontWeight: 800, letterSpacing: '0.12em' }}>
                Fokus akkurat nå
              </Typography>
              {recommendations.length > 0 ? (
                recommendations.slice(0, 3).map((recommendation, index) => (
                  <Box
                    key={`${recommendation}-${index}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: index === 0 ? alpha(primaryColor, 0.10) : 'rgba(15,23,42,0.04)',
                      border: `1px solid ${alpha(primaryColor, index === 0 ? 0.14 : 0.08)}`,
                    }}
                  >
                    <Typography sx={{ color: '#0f172a', fontWeight: 600, lineHeight: 1.45 }}>
                      {recommendation}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.68)', lineHeight: 1.6 }}>
                  Når innsiktene er klare, dukker de viktigste anbefalingene opp her først.
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2.5} role="region" aria-label="Hurtigstatistikk">
        {metricCards.map((card) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, xl: 3 }}>
            <Card
              className="bi-metric-card"
              role="article"
              aria-label={`${card.label}: ${card.value}`}
              sx={{
                borderRadius: 4,
                overflow: 'hidden',
                color: 'white',
                border: 'none',
                background: card.gradient,
                boxShadow: `0 24px 60px ${alpha('#0f172a', 0.14)}`,
              }}
            >
              <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.88, letterSpacing: '0.08em', fontWeight: 700 }}>
                      {card.label}
                    </Typography>
                    <Typography
                      variant="h4"
                      component="p"
                      sx={{
                        fontWeight: 800,
                        color: 'white',
                        lineHeight: 1.05,
                        textTransform: card.label === 'Etterspørsel' ? 'capitalize' : 'none',
                        mb: 0.75,
                      }}
                    >
                      {card.value}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.84, maxWidth: 220 }}>
                      {card.description}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.16)',
                      color: 'white',
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper
        sx={{
          ...theming.getThemedCardSx(),
          borderRadius: 5,
          overflow: 'hidden',
          border: `1px solid ${alpha(primaryColor, 0.12)}`,
          background: 'rgba(255,255,255,0.96)',
          boxShadow: `0 24px 60px ${alpha('#0f172a', 0.08)}`,
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            pt: { xs: 2, md: 2.5 },
            pb: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            borderBottom: `1px solid ${alpha(primaryColor, 0.10)}`,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 800 }}>
              Arbeidsflater
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.64)' }}>
              Bytt mellom innsikt, tiltak og oppfølging uten å miste oversikten.
            </Typography>
          </Box>
          <Chip
            label={`${activeTabLabel} aktiv`}
            sx={{
              bgcolor: alpha(primaryColor, 0.10),
              color: primaryColor,
              fontWeight: 700,
              borderRadius: 999,
            }}
          />
        </Box>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            aria-label="Business Intelligence navigasjon"
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              px: { xs: 1, md: 1.5 },
              '& .MuiTab-root': {
                color: 'rgba(15,23,42,0.64)',
                minHeight: 64,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 999,
                mx: 0.5,
                my: 1,
                minWidth: 'max-content',
                '&.Mui-selected': {
                  color: primaryColor,
                  bgcolor: alpha(primaryColor, 0.08),
                },
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: primaryColor,
                height: 3,
                borderRadius: '999px 999px 0 0',
              },
            }}
          >
            <Tab
              icon={<AnalyticsIcon aria-hidden="true" />}
              label="Markedsanalyse"
              iconPosition="start"
              id="bi-tab-0"
              aria-controls="bi-tabpanel-0"
            />
            <Tab
              icon={<AssignmentIcon aria-hidden="true" />}
              label="SWOT Analyse"
              iconPosition="start"
              id="bi-tab-1"
              aria-controls="bi-tabpanel-1"
            />
            <Tab
              icon={<CampaignIcon aria-hidden="true" />}
              label="Markedsføringsstrategi"
              iconPosition="start"
              id="bi-tab-2"
              aria-controls="bi-tabpanel-2"
            />
            <Tab
              icon={<EmailIcon aria-hidden="true" />}
              label="Nyhetsbrev"
              iconPosition="start"
              id="bi-tab-3"
              aria-controls="bi-tabpanel-3"
            />
            <Tab
              icon={<PersonIcon aria-hidden="true" />}
              label="Personas"
              iconPosition="start"
              id="bi-tab-4"
              aria-controls="bi-tabpanel-4"
            />
            <Tab
              icon={<PollIcon aria-hidden="true" />}
              label="Undersøkelser"
              iconPosition="start"
              id="bi-tab-5"
              aria-controls="bi-tabpanel-5"
            />
            <Tab
              icon={<ChatIcon aria-hidden="true" />}
              label="Kommunikasjon"
              iconPosition="start"
              id="bi-tab-6"
              aria-controls="bi-tabpanel-6"
            />
            <Tab
              icon={<AssignmentIcon aria-hidden="true" />}
              label="Kontraktanalytikk"
              iconPosition="start"
              id="bi-tab-7"
              aria-controls="bi-tabpanel-7"
            />
          </Tabs>
        </Box>

        {/* Market Analysis Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid size={{ xs:  12, md:  8 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Prisanbefaling
                  </Typography>
                  {priceData?.data ? (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                        <Typography variant="h4" sx={{ color: theming.colors.primary, mr:  2 }}>
                          {priceData.data.suggestedPrice?.toLocaleString('no-NO')} kr
                        </Typography>
                        <Chip
                          label={`${Math.round((priceData.data.confidence || 0) * 100)}% sikkerhet`}
                          color="success"
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        {priceData.data.reasoning}
                      </Typography>
                      {getDefaultHourlyRate() && (
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255, 107, 53, 0.1)', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Standard timepris for {getProfessionDisplayName(profession)}: {getDefaultHourlyRate()} kr/time
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ mb:  2 }}>
                        <Typography variant="subtitle2" sx={{ mb:  1 }}>
                          Konkurransefortrinn: </Typography>
                        {priceData.data.competitiveAdvantage?.map(
                          (advantage: string, index: number) => (
                            <Chip
                              key={index}
                              label={advantage}
                              variant="outlined"
                              size="small"
                              sx={{ mr: 1, mb: 1 }}
                            />
                          ),
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Alert severity="info">Henter prisanbefaling...</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs:  12, md:  4 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Beste regioner
                  </Typography>
                  {quickStats?.bestRegions?.map((region: string, index: number) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb:  1,
                        p:  1,
                        bgcolor: 'rgba(25, 107, 53, 0.1)',
                        borderRadius:  1}}
                    >
                      <StarIcon sx={{ color: '#ff6b30', mr: 1, fontSize: 20}} />
                      <Typography variant="body2">{region}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Sesongvariasjoner
                  </Typography>
                  {seasonalData?.data ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        Månedlige etterspørselsfaktorer for {seasonalData.data.serviceType}
                      </Typography>
                      <Grid container spacing={1}>
                        {seasonalData.data.monthlyFactors?.map((factor: number, index: number) => {
                          const months = [
                            'Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des',
                          ];
                          const isHigh = factor > 1.2;
                          const isLow = factor < 0.9;

                          return (
                            <Grid size={{ xs:  3, sm: 2, md:  1 }} key={index}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" display="block">
                                  {months[index]}
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(factor * 50, 100)}
                                  sx={{
                                    height:  8,
                                    borderRadius:  1,
                                    bgcolor: 'grey.300','& .MuiLinearProgress-bar': {
                                      bgcolor: isHigh ? '#4caf50' : isLow ? '#f44336' : '#ff6b30',
                                    }}}
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: isHigh ? '#4caf50' : isLow ? '#f44336' : '#666',
                                    fontWeight: 'bold' }}
                                >
                                  {factor.toFixed(1)}x
                                </Typography>
                              </Box>
                            </Grid>
                          );
                      })}
                      </Grid>
                      {seasonalRecommendations.length > 0 && (
                        <Box sx={{ mt:  2 }}>
                          <Typography variant="subtitle2" sx={{ mb:  1 }}>
                            Anbefalinger: </Typography>
                          {seasonalRecommendations.map((rec: string, index: number) => (
                            <Alert key={index} severity="info" sx={{ mb:  1 }}>
                              {rec}
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Alert severity="info">Henter sesongdata...</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* SWOT Analysis Tab */}
        <TabPanel value={tabValue} index={1}>
          {/* View Mode Toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              SWOT Analyse
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PdfIcon />}
                onClick={() => {
                  pdfExportService.exportSWOTAnalysis(swotItems, {
                    title: 'SWOT Analysis Report',
                    subtitle: `${profession} - ${new Date().toLocaleDateString('nb-NO')}`,
                    primaryColor: theming.colors.primary,
                  });
                }}
                sx={{
                  borderColor: theming.colors.primary,
                  color: theming.colors.primary, '&:hover': {
                    borderColor: theming.colors.primary,
                    bgcolor: `${theming.colors.primary}10`,
                  }}}
              >
                Export PDF
              </Button>
              <ToggleButtonGroup
                value={swotViewMode}
                exclusive
                onChange={(_, newMode) => newMode && setSwotViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="grid">
                  <GridViewIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Grid
                </ToggleButton>
                <ToggleButton value="kanban">
                  <ViewKanbanIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Kanban
                </ToggleButton>
                <ToggleButton value="analytics">
                  <AnalyticsIcon fontSize="small" sx={{ mr: 0.5 }} />
                  Analytics
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {swotLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: theming.colors.primary }} />
            </Box>
          ) : (
            <>
              {swotViewMode === 'grid' && (
                <Grid container spacing={3}>
              {/* Strengths */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ ...theming.getThemedCardSx(), borderTop: '4px solid #4caf50' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <CheckCircleIcon sx={{ color: '#4caf50', mr: 1, fontSize: 28 }} />
                      <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                        Styrker (Strengths)
                      </Typography>
                    </Box>
                    <List>
                      {(swotData?.data?.strengths || [
                        'Høy kvalitet på leveranser','Sterkt lokalt nettverk','Moderne utstyr og teknologi','Gode kundeomtaler',
                      ]).map((strength: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <CheckCircleIcon sx={{ color: '#4caf50' }} />
                          </ListItemIcon>
                          <ListItemText primary={strength} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Weaknesses */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ ...theming.getThemedCardSx(), borderTop: '4px solid #f44336' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <WarningIcon sx={{ color: '#f44336', mr: 1, fontSize: 28 }} />
                      <Typography variant="h6" sx={{ color: '#f44336', fontWeight: 'bold' }}>
                        Svakheter (Weaknesses)
                      </Typography>
                    </Box>
                    <List>
                      {(swotData?.data?.weaknesses || [
                        'Begrenset markedsføring','Høye priser sammenlignet med konkurrenter','Mangler online booking-system','Begrenset kapasitet i høysesongen',
                      ]).map((weakness: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <WarningIcon sx={{ color: '#f44336' }} />
                          </ListItemIcon>
                          <ListItemText primary={weakness} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Opportunities */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ ...theming.getThemedCardSx(), borderTop: '4px solid #2196f3' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <LightbulbIcon sx={{ color: '#2196f3', mr: 1, fontSize: 28 }} />
                      <Typography variant="h6" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                        Muligheter (Opportunities)
                      </Typography>
                    </Box>
                    <List>
                      {(swotData?.data?.opportunities || [
                        'Økende etterspørsel etter profesjonelle tjenester','Vekst i sosiale medier markedsføring','Nye teknologier (AI, automatisering)','Samarbeid med andre leverandører',
                      ]).map((opportunity: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <LightbulbIcon sx={{ color: '#2196f3' }} />
                          </ListItemIcon>
                          <ListItemText primary={opportunity} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Threats */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={{ ...theming.getThemedCardSx(), borderTop: '4px solid #ff9800' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <TrendingDownIcon sx={{ color: '#ff9800', mr: 1, fontSize: 28 }} />
                      <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                        Trusler (Threats)
                      </Typography>
                    </Box>
                    <List>
                      {(swotData?.data?.threats || [
                        'Økende konkurranse fra nye aktører','Økonomisk usikkerhet','Endringer i kundeatferd','Teknologiske endringer',
                      ]).map((threat: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <TrendingDownIcon sx={{ color: '#ff9800' }} />
                          </ListItemIcon>
                          <ListItemText primary={threat} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Strategic Recommendations */}
              <Grid size={{ xs: 12 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      Strategiske Anbefalinger
                    </Typography>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Prioriterte tiltak:
                      </Typography>
                      {(swotData?.data?.recommendations || [
                        'Utvikle en sterkere online tilstedeværelse gjennom sosiale medier','Implementer et online booking-system for å forbedre kundeopplevelsen','Utforsk samarbeidspartnere for å utvide tjenestetilbudet','Invester i markedsføring for å øke synlighet',
                      ]).map((rec: string, index: number) => (
                        <Typography key={index} variant="body2" sx={{ ml: 2, mb: 0.5 }}>
                          • {rec}
                        </Typography>
                      ))}
                    </Alert>
                    {projectTypeRefs.length > 0 && (
                      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Tilgjengelige prosjekttyper:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {projectTypeRefs.slice(0, 5).map((type, idx) => (
                            <Chip
                              key={idx}
                              label={type.label}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
                </Grid>
              )}

              {swotViewMode === 'kanban' && (
                <SWOTKanbanBoard
                  userId={userId}
                  profession={profession}
                  items={swotItems}
                  onItemUpdate={(item) => saveSWOTMutation.mutate(item)}
                  onItemDelete={(itemId) => deleteSWOTMutation.mutate(itemId)}
                  onItemCreate={(item) => saveSWOTMutation.mutate(item)}
                />
              )}

              {swotViewMode === 'analytics' && (
                <SWOTVisualizations
                  items={swotItems}
                  trends={swotTrends}
                  scores={swotData?.data?.scores || {
                    brand: 50,
                    product: 50,
                    distribution: 50,
                    promotion: 50,
                    overall: 50}}
                />
              )}
            </>
          )}
        </TabPanel>

        {/* Marketing Strategy Tab */}
        <TabPanel value={tabValue} index={2}>
          {marketingLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: theming.colors.primary }} />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* Social Media Strategy */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      Sosiale Medier Strategi
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <FacebookIcon sx={{ color: '#1877f2' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="Facebook"
                          secondary={
                            marketingData?.data?.socialMedia?.facebook ||
                            'Post 3-4 ganger per uke. Fokus på før/etter bilder og kundehistorier.'
                          }
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemIcon>
                          <InstagramIcon sx={{ color: '#e4405f' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="Instagram"
                          secondary={
                            marketingData?.data?.socialMedia?.instagram ||
                            'Daglige stories og 4-5 feed posts per uke. Bruk reels for økt rekkevidde.'
                          }
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemIcon>
                          <LinkedInIcon sx={{ color: '#0a66c2' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="LinkedIn"
                          secondary={
                            marketingData?.data?.socialMedia?.linkedin ||
                            'Profesjonelt innhold 2-3 ganger per uke. Del bransjeinnsikt og case studies.'
                          }
                        />
                      </ListItem>
                      <Divider />
                      <ListItem>
                        <ListItemIcon>
                          <TwitterIcon sx={{ color: '#1da1f2' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary="Twitter/X"
                          secondary={
                            marketingData?.data?.socialMedia?.twitter ||
                            'Engasjer deg i bransjesamtaler. Del tips og nyheter daglig.'
                          }
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Content Strategy */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      Innholdsstrategi
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Ukentlig Innholdsplan:
                      </Typography>
                      {(marketingData?.data?.contentPlan || [
                        { day: 'Mandag', content: 'Motiverende sitat eller tips' },
                        { day: 'Onsdag', content: 'Før/etter showcase' },
                        { day: 'Fredag', content: 'Kundehistorie eller testimonial' },
                        { day: 'Søndag', content: 'Bak kulissene innhold' },
                      ]).map((item: { day: string; content: string }, index: number) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            bgcolor: 'rgba(255, 107, 53, 0.1)',
                            borderRadius: 1,
                            borderLeft: '3px solid',
                            borderColor: theming.colors.primary}}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {item.day}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.content}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* SEO Strategy */}
              <Grid size={{ xs: 12 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      SEO Strategi
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Primære Søkeord:
                          </Typography>
                          {(marketingData?.data?.seo?.primaryKeywords || [
                            `${getProfessionDisplayName(profession)} Oslo`,
                            `Bryllup ${getProfessionDisplayName(profession).toLowerCase()}`,
                            `Profesjonell ${getProfessionDisplayName(profession).toLowerCase()}`,
                          ]).map((keyword: string, index: number) => (
                            <Chip
                              key={index}
                              label={keyword}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Sekundære Søkeord:
                          </Typography>
                          {(marketingData?.data?.seo?.secondaryKeywords || getProfessionSpecificKeywords() || [
                            'Beste fotograf Norge','Rimelig bryllupsfotograf','Profesjonelle bilder',
                          ]).map((keyword: string, index: number) => (
                            <Chip
                              key={index}
                              label={keyword}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Alert severity="info">
                          <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>
                            Optimaliser nettstedet ditt med disse søkeordene for bedre synlighet i
                            søkemotorer.
                          </Typography>
                          {getProfessionSEOTips().length > 0 && (
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                                SEO Tips:
                              </Typography>
                              {getProfessionSEOTips().slice(0, 2).map((tip: string, idx: number) => (
                                <Typography key={idx} variant="caption" component="div" sx={{ fontSize: '0.7rem' }}>
                                  • {tip}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          {hasFeature('seo_optimization') && (
                            <Typography variant="caption" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                              SEO-optimalisering er aktivert for din profesjon.
                            </Typography>
                          )}
                        </Alert>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              {/* Campaign Ideas */}
              <Grid size={{ xs: 12 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      Kampanjeideer
                    </Typography>
                    <Grid container spacing={2}>
                      {(marketingData?.data?.campaigns || [
                        {
                          title: 'Vår Kampanje',
                          description: 'Tilby 15% rabatt på bryllupspakker booket i vårsesongen',
                          duration: 'Mars - Mai',
                          expectedROI: '25%',
                        },
                        {
                          title: 'Henvisningsprogram',
                          description: 'Gi eksisterende kunder 10% rabatt for hver ny kunde de henviser',
                          duration: 'Hele året',
                          expectedROI: '40%',
                        },
                        {
                          title: 'Sosiale Medier Konkurranse',
                          description: 'Månedskonkurranse for å øke følgere og engasjement',
                          duration: 'Månedlig',
                          expectedROI: '15%',
                        },
                      ]).map((campaign: { title: string; description: string; duration: string; expectedROI: string }, index: number) => (
                        <Grid size={{ xs: 12, md: 4 }} key={index}>
                          <Card
                            sx={{
                              height: '100%',
                              border: '1px solid',
                              borderColor: 'divider','&:hover': {
                                borderColor: theming.colors.primary,
                                boxShadow: 2,
                              }}}
                          >
                            <CardContent>
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                {campaign.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                {campaign.description}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                                <Chip label={campaign.duration} size="small" />
                                <Chip
                                  label={`ROI: ${campaign.expectedROI}`}
                                  size="small"
                                  color="success"
                                />
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* Newsletter Strategy Tab */}
        <TabPanel value={tabValue} index={3}>
          {newsletterLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: theming.colors.primary }} />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* Newsletter Overview */}
              <Grid size={{ xs: 12 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        Nyhetsbrev Kampanjer
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setNewsletterDialog(true)}
                        sx={{
                          bgcolor: theming.colors.primary,
                          '&:hover': { bgcolor: theming.colors.primary, opacity: 0.9 }}}
                      >
                        Ny Kampanje
                      </Button>
                    </Box>

                    {/* Newsletter Stats */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                            {newsletterData?.data?.stats?.totalCampaigns || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Totale Kampanjer
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                            {newsletterData?.data?.stats?.totalSubscribers || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Abonnenter
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                            {newsletterData?.data?.stats?.avgOpenRate || 0}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Åpningsrate
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
                            {newsletterData?.data?.stats?.avgClickRate || 0}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Klikkrate
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Campaign List */}
                    <TableContainer>
                      <Table aria-label="Nyhetsbrev kampanjer tabell">
                        <TableHead>
                          <TableRow>
                            <TableCell scope="col">Emne</TableCell>
                            <TableCell scope="col">Målgruppe</TableCell>
                            <TableCell scope="col">Status</TableCell>
                            <TableCell scope="col">Planlagt Dato</TableCell>
                            <TableCell scope="col">Åpningsrate</TableCell>
                            <TableCell scope="col" align="right">Handlinger</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(newsletterData?.data?.campaigns || [
                            {
                              id: 1,
                              subject: 'Vårtilbud 2024',
                              audience: 'Alle kunder',
                              status: 'Sendt',
                              scheduledDate: '2024-03-15',
                              openRate: '45%',
                            },
                            {
                              id: 2,
                              subject: 'Nye tjenester tilgjengelig',
                              audience: 'Aktive kunder',
                              status: 'Planlagt',
                              scheduledDate: '2024-04-01',
                              openRate: '-',
                            },
                            {
                              id: 3,
                              subject: 'Månedens tips',
                              audience: 'Alle abonnenter',
                              status: 'Utkast',
                              scheduledDate: '-',
                              openRate: '-',
                            },
                          ]).map((campaign: NewsletterCampaign) => (
                            <TableRow key={campaign.id}>
                              <TableCell component="th" scope="row">{campaign.subject}</TableCell>
                              <TableCell>{campaign.audience}</TableCell>
                              <TableCell>
                                <Chip
                                  label={campaign.status}
                                  size="small"
                                  aria-label={`Status: ${campaign.status}`}
                                  color={
                                    campaign.status === 'Sendt'
                                      ? 'success'
                                      : campaign.status === 'Planlagt'
                                      ? 'primary'
                                      : 'default'
                                  }
                                />
                              </TableCell>
                              <TableCell>{campaign.scheduledDate}</TableCell>
                              <TableCell>{campaign.openRate}</TableCell>
                              <TableCell align="right">
                                <Tooltip title="Rediger">
                                  <IconButton
                                    size="small"
                                    aria-label={`Rediger kampanje: ${campaign.subject}`}
                                    sx={{
                                      '&:focus-visible': {
                                        outline: '3px solid',
                                        outlineColor: 'primary.main',
                                        outlineOffset: '2px',
                                      }}}
                                  >
                                    <EditIcon aria-hidden="true" fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Slett">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label={`Slett kampanje: ${campaign.subject}`}
                                    sx={{
                                      '&:focus-visible': {
                                        outline: '3px solid',
                                        outlineColor: 'error.main',
                                        outlineOffset: '2px',
                                      }}}
                                  >
                                    <DeleteIcon aria-hidden="true" fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Newsletter Templates */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        Nyhetsbrev Maler
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setEmailDesignerDialog(true)}
                        sx={{
                          borderColor: theming.colors.primary,
                          color: theming.colors.primary,
                          '&:hover': {
                            borderColor: theming.colors.secondary,
                            bgcolor: `${theming.colors.primary}10`,
                          }}}
                      >
                        Visuell Designer
                      </Button>
                    </Box>
                    <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {NEWSLETTER_TEMPLATES.map((template, index) => (
                        <React.Fragment key={template.id}>
                          <ListItem
                            sx={{
                              '&:hover': {
                                bgcolor: `${theming.colors.primary}08`,
                              }}}
                          >
                            <ListItemIcon>
                              <EmailIcon sx={{ color: theming.colors.primary }} />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body1">{template.title}</Typography>
                                  <Chip
                                    label={template.category}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      fontSize: '0.7rem',
                                      bgcolor: `${theming.colors.primary}20`,
                                      color: theming.colors.primary}}
                                  />
                                </Box>
                              }
                              secondary={template.description}
                            />
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setNewsletterForm({
                                  subject: template.subject,
                                  content: template.content,
                                  audienceSegment: 'all',
                                  scheduledDate: '',
                                  templateId: template.id,
                                });
                                setNewsletterDialog(true);
                              }}
                              sx={{
                                borderColor: theming.colors.primary,
                                color: theming.colors.primary, '&:hover': {
                                  borderColor: theming.colors.secondary,
                                  bgcolor: `${theming.colors.primary}10`,
                                }}}
                            >
                              Bruk
                            </Button>
                          </ListItem>
                          {index < NEWSLETTER_TEMPLATES.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Best Practices */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      Best Practices
                    </Typography>
                    <List>
                      {[
                        'Send nyhetsbrev konsekvent (ukentlig eller månedlig)','Personaliser innholdet basert på kundesegmenter','Bruk engasjerende emnelinjer (under 50 tegn)','Inkluder tydelig call-to-action (CTA)','Optimaliser for mobil (60%+ åpner på mobil)','Test forskjellige sendetidspunkter','Analyser åpnings- og klikkrater regelmessig','Hold e-postlisten ren (fjern inaktive)',
                      ].map((tip, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={<Typography variant="body2">{tip}</Typography>}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* Personas Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Customer Personas
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {customerPersonas.length > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PdfIcon />}
                  onClick={() => {
                    pdfExportService.exportPersonas(customerPersonas, {
                      title: 'Customer Personas',
                      subtitle: `${profession} - ${new Date().toLocaleDateString('nb-NO')}`,
                      primaryColor: theming.colors.primary,
                    });
                  }}
                  sx={{
                    borderColor: theming.colors.primary,
                    color: theming.colors.primary, '&:hover': {
                      borderColor: theming.colors.primary,
                      bgcolor: `${theming.colors.primary}10`,
                    }}}
                >
                  Export PDF
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingPersona(undefined);
                  setPersonaDialog(true);
                }}
                sx={{
                  bgcolor: theming.colors.primary,
                  '&:hover': { bgcolor: theming.colors.primary, opacity: 0.9 }}}
              >
                Create Persona
              </Button>
            </Box>
          </Box>

          {personas.length === 0 ? (
            <Alert severity="info">
              No personas created yet. Click "Create Persona" to get started.
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {personas.map((persona) => (
                <Grid key={persona.id} size={{ xs: 12, md: 6, lg: 4 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar
                          sx={{
                            width: 60,
                            height: 60,
                            bgcolor: persona.avatarColor || '#ff6b35',
                            mr: 2}}
                        >
                          {persona.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6">{persona.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {persona.age} years • {persona.location}
                          </Typography>
                        </Box>
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingPersona(persona);
                              setPersonaDialog(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (window.confirm(`Delete persona "${persona.name}"?`)) {
                                deletePersonaMutation.mutate(persona.id);
                              }
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Occupation
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {persona.occupation}
                      </Typography>

                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Goals
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        {persona.goals?.slice(0, 3).map((goal: string, idx: number) => (
                          <Chip key={idx} label={goal} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>

                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Frustrations
                      </Typography>
                      <Box>
                        {persona.frustrations?.slice(0, 3).map((frustration: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={frustration}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>

        {/* Surveys Tab */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Customer Surveys
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingSurvey(undefined);
                setSurveyDialog(true);
              }}
              sx={{
                bgcolor: theming.colors.primary,
                '&:hover': { bgcolor: theming.colors.primary, opacity: 0.9 }}}
            >
              Create Survey
            </Button>
          </Box>

          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              ✅ Survey Builder Now Available!
            </Typography>
            <Typography variant="body2">
              Create custom surveys with multiple question types. Survey responses will automatically generate SWOT items and persona insights through sentiment analysis.
            </Typography>
          </Alert>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <PollIcon sx={{ fontSize: 40, color: theming.colors.primary }} />
                    <Box>
                      <Typography variant="h4">{surveysLoading ? '…' : surveyStats.activeCount}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Surveys
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <PeopleIcon sx={{ fontSize: 40, color: '#4caf50' }} />
                    <Box>
                      <Typography variant="h4">{surveysLoading ? '…' : surveyStats.totalResponses}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Responses
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <InsightsIcon sx={{ fontSize: 40, color: '#2196f3' }} />
                    <Box>
                      <Typography variant="h4">{surveysLoading ? '…' : surveyStats.generatedInsights}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Insights Generated
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ ...theming.getThemedCardSx(), mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Surveyflyt
              </Typography>
              {surveysLoading ? (
                <Alert severity="info">Henter undersøkelser...</Alert>
              ) : surveys.length === 0 ? (
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon sx={{ color: '#4caf50' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Drag-and-drop survey builder"
                      secondary="Multiple question types: text, rating, multiple choice, checkbox, scale"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon sx={{ color: '#4caf50' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Real-time preview"
                      secondary="See how your survey will look to respondents"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon sx={{ color: '#4caf50' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sentiment analysis"
                      secondary="Automatically analyze responses for positive/negative sentiment"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircleIcon sx={{ color: '#4caf50' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary="Auto-generate SWOT items"
                      secondary="Convert survey insights into actionable SWOT analysis"
                    />
                  </ListItem>
                </List>
              ) : (
                <Stack spacing={1.25}>
                  {surveys.map((survey) => (
                    <Box
                      key={survey.id}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: `1px solid ${alpha(primaryColor, 0.12)}`,
                        bgcolor: 'rgba(255,255,255,0.92)',
                        display: 'grid',
                        gap: 1,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap">
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {survey.title}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip size="small" label={survey.status} sx={{ fontWeight: 700 }} />
                          <Chip size="small" label={`${survey.responseCount} svar`} sx={{ fontWeight: 700 }} />
                          <Chip size="small" label={`${survey.completionRate}% fullført`} sx={{ fontWeight: 700 }} />
                        </Stack>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {survey.description || 'Ingen beskrivelse lagt til ennå.'}
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setEditingSurvey(mapSurveyRecordToBuilderData(survey));
                            setSurveyDialog(true);
                          }}
                        >
                          Rediger
                        </Button>
                        {survey.shareableLink && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PollIcon />}
                            onClick={() => window.open(survey.shareableLink, '_blank', 'noopener,noreferrer')}
                          >
                            Åpne lenke
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        {/* Communication Hub Tab */}
        <TabPanel value={tabValue} index={6}>
          <CommunicationHubV2 userId={userId} profession={profession} />
        </TabPanel>

        {/* Contract Analytics Tab */}
        <TabPanel value={tabValue} index={7}>
          <Grid container spacing={3}>
            {/* Contract Statistics */}
            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Kontraktstatistikk
                    </Typography>
                    {getContractTemplates().length > 0 && (
                      <Chip
                        label={`${getContractTemplates().length} tilgjengelige maler`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  {contractStats?.stats ? (
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(33, 150, 243, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 'bold' }}>
                            {contractStats.stats.total}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Totale Kontrakter
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                            {contractStats.stats.active}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Aktive
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                            {contractStats.stats.pendingSignatures}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Venter Signatur
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Box sx={{ p: 2, bgcolor: 'rgba(156, 39, 176, 0.1)', borderRadius: 1 }}>
                          <Typography variant="h4" sx={{ color: '#9c27b0', fontWeight: 'bold' }}>
                            {contractStats.stats.totalValue.toLocaleString('no-NO')} kr
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total Verdi
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  ) : (
                    <Alert severity="info">Henter kontraktstatistikk...</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Contract Performance Metrics */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Kontrakt Ytelse
                  </Typography>
                  {contractStats?.stats && (
                    <Box>
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Aktive Rate</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {contractStats.stats.total > 0
                              ? Math.round((contractStats.stats.active / contractStats.stats.total) * 100)
                              : 0}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            contractStats.stats.total > 0
                              ? (contractStats.stats.active / contractStats.stats.total) * 100
                              : 0
                          }
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Fullført Rate</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {contractStats.stats.total > 0
                              ? Math.round((contractStats.stats.completed / contractStats.stats.total) * 100)
                              : 0}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            contractStats.stats.total > 0
                              ? (contractStats.stats.completed / contractStats.stats.total) * 100
                              : 0
                          }
                          sx={{ height: 8, borderRadius: 1 }}
                          color="success"
                        />
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Signatur Rate</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {contractStats.stats.total > 0
                              ? Math.round(
                                  ((contractStats.stats.total - contractStats.stats.pendingSignatures) /
                                    contractStats.stats.total) *
                                    100
                                )
                              : 0}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={
                            contractStats.stats.total > 0
                              ? ((contractStats.stats.total - contractStats.stats.pendingSignatures) /
                                  contractStats.stats.total) *
                                100
                              : 0
                          }
                          sx={{ height: 8, borderRadius: 1 }}
                          color="warning"
                        />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Contract Value Analysis */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                    Verdi Analyse
                  </Typography>
                  {contractStats?.stats && contractStats.stats.total > 0 ? (
                    <Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Gjennomsnittlig Kontraktverdi
                        </Typography>
                        <Typography variant="h5" sx={{ color: theming.colors.primary, fontWeight: 'bold' }}>
                          {Math.round(contractStats.stats.totalValue / contractStats.stats.total).toLocaleString(
                            'no-NO'
                          )}{' '}
                          kr
                        </Typography>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Verdi per Status
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText
                              primary="Aktive Kontrakter"
                              secondary={`${contractStats.stats.active} kontrakter`}
                            />
                            <Typography variant="body2" fontWeight="bold">
                              {contractStats.stats.active > 0
                                ? Math.round(
                                    (contractStats.stats.totalValue * (contractStats.stats.active / contractStats.stats.total)) /
                                      contractStats.stats.active
                                  ).toLocaleString('no-NO')
                                : 0}
                              kr
                            </Typography>
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Fullførte Kontrakter"
                              secondary={`${contractStats.stats.completed} kontrakter`}
                            />
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {contractStats.stats.completed > 0
                                ? Math.round(
                                    (contractStats.stats.totalValue * (contractStats.stats.completed / contractStats.stats.total)) /
                                      contractStats.stats.completed
                                  ).toLocaleString('no-NO')
                                : 0}
                              kr
                            </Typography>
                          </ListItem>
                        </List>
                      </Box>
                    </Box>
                  ) : (
                    <Alert severity="info">Ingen kontraktdata tilgjengelig</Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Contracts Summary */}
            {contractSummary && (
              <Grid size={{ xs: 12 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
                      Kontrakt Oversikt
                    </Typography>
                    <Grid container spacing={2}>
                      {contractSummary.pending && contractSummary.pending.length > 0 && (
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Box sx={{ p: 2, bgcolor: 'rgba(255, 152, 0, 0.1)', borderRadius: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Venter Signatur ({contractSummary.pending.length})
                            </Typography>
                            <List dense>
                              {contractSummary.pending.slice(0, 3).map((contract: ContractSummaryItem) => (
                                <ListItem key={contract.id}>
                                  <ListItemText
                                    primary={contract.title || contract.client_name}
                                    secondary={contract.project_name || 'Ingen prosjekt'}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </Grid>
                      )}
                      {contractSummary.expiring && contractSummary.expiring.length > 0 && (
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Box sx={{ p: 2, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Utløper Snart ({contractSummary.expiring.length})
                            </Typography>
                            <List dense>
                              {contractSummary.expiring.slice(0, 3).map((contract: ContractSummaryItem) => (
                                <ListItem key={contract.id}>
                                  <ListItemText
                                    primary={contract.title || contract.client_name}
                                    secondary={`${contract.daysUntilExpiry} dager igjen`}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </Grid>
                      )}
                      {contractSummary.recent && contractSummary.recent.length > 0 && (
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Box sx={{ p: 2, bgcolor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                              Nylig Signert ({contractSummary.recent.length})
                            </Typography>
                            <List dense>
                              {contractSummary.recent.slice(0, 3).map((contract: ContractSummaryItem) => (
                                <ListItem key={contract.id}>
                                  <ListItemText
                                    primary={contract.title || contract.client_name}
                                    secondary={
                                      contract.signed_at
                                        ? new Date(contract.signed_at).toLocaleDateString('no-NO')
                                        : 'Dato mangler'
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Persona Creation/Edit Dialog */}
        <Dialog
          open={personaDialog}
          onClose={() => {
            setPersonaDialog(false);
            setEditingPersona(undefined);
          }}
          maxWidth="lg"
          fullWidth
        >
          <PersonaBuilder
            persona={editingPersona}
            onSave={(persona) => savePersonaMutation.mutate(persona)}
            onCancel={() => {
              setPersonaDialog(false);
              setEditingPersona(undefined);
            }}
          />
        </Dialog>

        {/* Newsletter Creation Dialog */}
        <Dialog
          open={newsletterDialog}
          onClose={() => setNewsletterDialog(false)}
          maxWidth="md"
          fullWidth
          aria-labelledby="newsletter-dialog-title"
          aria-describedby="newsletter-dialog-description"
          role="dialog"
        >
          <DialogTitle id="newsletter-dialog-title">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmailIcon aria-hidden="true" />
              <span>Opprett Ny Nyhetsbrev Kampanje</span>
            </Box>
          </DialogTitle>
          <DialogContent id="newsletter-dialog-description">
            <Box component="form" role="form" aria-label="Nyhetsbrev skjema" sx={{ pt: 2 }}>
              {/* Visual Designer Button */}
              <Alert severity="info" sx={{ mb: 2 }} role="status">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">
                    Vil du designe e-posten visuelt med drag-and-drop?
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<EditIcon aria-hidden="true" />}
                    onClick={() => {
                      setNewsletterDialog(false);
                      setEmailDesignerDialog(true);
                    }}
                    aria-label="Åpne visuell e-post designer"
                    sx={{
                      borderColor: theming.colors.primary,
                      color: theming.colors.primary,
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '2px',
                      }}}
                  >
                    Åpne Designer
                  </Button>
                </Box>
              </Alert>

              <TextField
                fullWidth
                label="Emne"
                value={newsletterForm.subject}
                onChange={(e) => setNewsletterForm({ ...newsletterForm, subject: e.target.value })}
                sx={{ mb: 2 }}
                helperText="Tips: Bruk variabler som {{first_name}}, {{business_name}}"
                inputProps={{
                  'aria-label':'E-post emne (påkrevd)','aria-required' : 'true'}}
                required
              />
              <TextField
                fullWidth
                label="Innhold"
                multiline
                rows={8}
                value={newsletterForm.content}
                onChange={(e) => setNewsletterForm({ ...newsletterForm, content: e.target.value })}
                sx={{ mb: 2 }}
                helperText="HTML støttes. Bruk variabler: {{first_name}}, {{business_name}}, {{profession}}"
                inputProps={{
                  'aria-label':'E-post innhold (påkrevd)','aria-required' : 'true'}}
                required
              />

              {/* Template Variables Helper */}
              {newsletterForm.templateId && (
                <Alert severity="success" sx={{ mb: 2 }} role="status" aria-live="polite">
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Tilgjengelige Variabler:
                  </Typography>
                  <Typography variant="caption" component="div">
                    • {'{{first_name}},'} - Kundens fornavn<br />
                    • {'{{business_name}},'} - Ditt firmanavn<br />
                    • {'{{profession}}'} - Din profesjon<br />
                    • {'{{discount}}'} - Rabatt prosent<br />
                    • {'{{promo_code}}'} - Kampanjekode<br />
                    • {'{{event_name}}'} - Arrangementsnavn
                  </Typography>
                </Alert>
              )}
              <TextField
                fullWidth
                select
                label="Målgruppe"
                value={newsletterForm.audienceSegment}
                onChange={(e) =>
                  setNewsletterForm({ ...newsletterForm, audienceSegment: e.target.value })
                }
                sx={{ mb: 2 }}
                slotProps={{ select: { native: true } }}
                inputProps={{
                  'aria-label' : 'Velg målgruppe for nyhetsbrevet'}}
              >
                <option value="all">Alle abonnenter</option>
                <option value="active">Aktive kunder</option>
                <option value="inactive">Inaktive kunder</option>
                <option value="new">Nye abonnenter</option>
              </TextField>
              <TextField
                fullWidth
                type="datetime-local"
                label="Planlagt Dato"
                value={newsletterForm.scheduledDate}
                onChange={(e) =>
                  setNewsletterForm({ ...newsletterForm, scheduledDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
                inputProps={{
                  'aria-label' : 'Velg planlagt dato og tid for utsendelse'}}
              />
            </Box>
          </DialogContent>
          <DialogActions role="group" aria-label="Dialoghandlinger">
            <Button
              onClick={() => setNewsletterDialog(false)}
              aria-label="Avbryt og lukk dialogen"
              sx={{
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Avbryt
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon aria-hidden="true" />}
              onClick={() => createNewsletter.mutate(newsletterForm)}
              disabled={!newsletterForm.subject || !newsletterForm.content}
              aria-label={createNewsletter.isPending ? 'Oppretter kampanje...' : 'Opprett nyhetsbrev kampanje'}
              aria-busy={createNewsletter.isPending}
              sx={{
                bgcolor: theming.colors.primary,
                '&:hover': { bgcolor: theming.colors.primary, opacity: 0.9 },
                '&:focus-visible': {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: '2px',
                }}}
            >
              Opprett Kampanje
            </Button>
          </DialogActions>
        </Dialog>

        {/* Survey Builder Dialog */}
        <SurveyBuilder
          open={surveyDialog}
          onClose={() => {
            setSurveyDialog(false);
            setEditingSurvey(undefined);
          }}
          onSave={(survey) => saveSurveyMutation.mutate(survey)}
          initialData={editingSurvey}
        />

        {/* Email Designer Dialog */}
        <Dialog
          open={emailDesignerDialog}
          onClose={() => setEmailDesignerDialog(false)}
          maxWidth={false}
          fullScreen
          aria-labelledby="email-designer-dialog-title"
          role="dialog"
          slotProps={{
            paper: {
              sx: {
                bgcolor: '#f5f5f5',
              },
            }}}
        >
          <DialogTitle id="email-designer-dialog-title" sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EmailIcon aria-hidden="true" sx={{ color: theming.colors.primary }} />
                <Typography variant="h6" component="span">Visuell E-post Designer</Typography>
              </Box>
              <IconButton
                onClick={() => setEmailDesignerDialog(false)}
                edge="end"
                aria-label="Lukk e-post designer"
                sx={{
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                  }}}
              >
                <CloseIcon aria-hidden="true" />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
            <EmailDesignerComplete />
          </DialogContent>
        </Dialog>
      </Paper>

      {/* Recommendations Panel */}
      {recommendations.length > 0 && (
        <Card
          role="region"
          aria-label="Anbefalinger"
          sx={{
            ...theming.getThemedCardSx(),
            mt: 3}}
        >
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography
              variant="h6"
              component="h2"
              sx={{
                mb: 2,
                color: theming.colors.primary,
                display: 'flex',
                alignItems: 'center'}}
            >
              <InsightsIcon aria-hidden="true" sx={{ mr: 1 }} />
              Anbefalinger
            </Typography>
            <List aria-label="Liste over anbefalinger">
              {recommendations.map((rec: string, index: number) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemIcon>
                      <StarIcon aria-hidden="true" sx={{ color:'#ff6b35' }} />
                    </ListItemIcon>
                    <ListItemText primary={rec} />
                  </ListItem>
                  {index < recommendations.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
