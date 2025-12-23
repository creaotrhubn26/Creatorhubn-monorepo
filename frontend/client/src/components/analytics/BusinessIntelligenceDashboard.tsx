/**
 * Business Intelligence Dashboard for CreatorHub Norge
 * Comprehensive analytics and Norwegian market insights
 * Real-time performance monitoring with profession-specific metrics
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tab,
  Tabs,
  Alert,
  Chip,
  LinearProgress,
  Skeleton,
  CircularProgress,
  Paper,
  Stack,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  DirectionsBusiness as BusinessIcon,
  Analytics as AnalyticsIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  CheckCircle,
  Error,
  Warning,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { useExternalData } from '../../services/ExternalDataService';

// Mock data for demo mode
const mockPerformanceData = {
  pageLoad: {
    avg_load_time: 120,
    p95_load_time: 210,
},
  api: {
    avg_response_time: 10,
    p95_response_time: 40,
},
  webVitals: [
    { name: 'largest-contentful-paint', avg_value: 1, .p75_value: 1.8,},
    { name: 'cumulative-layout-shift', avg_value: 0.5, p75_value: 0.1,},
    { name: 'first-input-delay', avg_value:  45, p75_value: 80,},
  ],
};

const mockBusinessData = {
  projectMetrics: [
    { profession: 'photographer', total_projects: 16, total_revenue: 1250000,},
    { profession: 'videographer', total_projects:  89, total_revenue: 980000,},
    { profession: 'music_producer', total_projects:  45, total_revenue: 320000,},
  ],
  featureUsage: [
    { component: 'UniversalDashboard', usage_count: 1250,},
    { component: 'ProjectCreation', usage_count: 890,},
    { component: 'FileUpload', usage_count: 670,},
    { component: 'CalendarIntegration', usage_count: 450,},
    { component: 'GoogleDriveSync', usage_count: 380,},
  ],
  deviceMetrics: [
    { device_type: 'Desktop', session_count: 65,},
    { device_type: 'Mobile', session_count: 25,},
    { device_type: 'Tablet', session_count: 10,},
  ],
};

const mockMarketData = {
  marketInsights: [
    { profession: 'photographer', user_count: 120, avg_hourly_rate: 850,},
    { profession: 'videographer', user_count: 60, avg_hourly_rate: 1200,},
    { profession: 'music_producer', user_count: 30, avg_hourly_rate: 950,},
  ],
  equipmentTrends: [
    { equipment_name: 'Canon EOS R', usage_count: 450,},
    { equipment_name: 'Sony A7 I', usage_count: 380,},
    { equipment_name: 'MacBook Pro M', usage_count: 320,},
  ],
  geographicData: [
    { county: 'Oslo', municipality: 'Oslo', user_count: 40, profession: 'photographer',},
    { county: 'Vestland', municipality: 'Bergen', user_count: 20, profession: 'videographer',},
    { county: 'Trøndelag', municipality: 'Trondheim', user_count: 10, profession: 'photographer',},
    { county: 'Rogaland', municipality: 'Stavanger', user_count: 10, profession: 'music_producer',},
  ],
  seasonalTrends: [
    { month: 1project_count: 45,},
    { month: 2project_count: 38,},
    { month:  3, project_count: 52,},
    { month:  4, project_count: 68,},
    { month:  5, project_count: 85,},
    { month:  6, project_count: 95,},
    { month:  7, project_count: 78,},
    { month:  8, project_count: 65,},
    { month:  9, project_count: 72,},
    { month:  10, project_count: 88,},
    { month:  11, project_count: 75,},
    { month:  12, project_count: 58,},
  ],
};

const mockRealTimeData = {
  activeUsers:  42,
  errorRate: 2.1,
  systemLoad: {
    avg_memory_mb: 52,
    cpu_usage:  35,
},
};

interface BusinessIntelligenceDashboardProps {
  className?: string;
}

export default function BusinessIntelligenceDashboard({
  className,
}: BusinessIntelligenceDashboardProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedProfession, setSelectedProfession] = useState('');
  
  // SSB Economic Data State
  const [ssbEconomicData, setSsbEconomicData] = useState<any>(null);
  const [ssbPopulationData, setSsbPopulationData] = useState<any>(null);
  const [ssbDatasets, setSsbDatasets] = useState<any[]>([]);
  const [ssbLoading, setSsbLoading] = useState(false);

  const { isDemoMode } = useDemoMode();
  
  // Theming system
  const theming = useTheming('photographer');
  const theme = useTheme();

  // Dynamic profession system
  const { user } = useAuth();
  const {
    professionConfigs,
    loading: professionsLoading,
    error: professionsError,
} = useDynamicProfessions();
  
  // External Data Service integration for SSB economic data
  const { 
    getSSBEconomicIndicators,
    getSSBPopulationData,
    getSSBDatasets,
    getSSBDataset
} = useExternalData();

  // Performance summary query
  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
} = useQuery({
    queryKey: [
      '/api/analytics/performance/summary',
      { range: timeRange, profession: selectedProfession },
    ],
    queryFn: () =>
      apiRequest(
        'GE',
        `/api/analytics/performance/summary?range=${timeRange}&profession=${selectedProfession}`,
      ),
    refetchInterval: 6000, // Refresh every minute
    enabled: !isDemoMode,
});

  // Business intelligence query
  const { data: businessData, isLoading: businessLoading } = useQuery({
    queryKey: [
      '/api/analytics/business-intelligence',
      { range: timeRange, profession: selectedProfession },
    ],
    queryFn: () =>
      apiRequest(
        'GE',
        `/api/analytics/business-intelligence?range=${timeRange}&profession=${selectedProfession}`,
      ),
    refetchInterval: 30000, // Refresh every 5 minutes
    enabled: !isDemoMode,
});

  // Norwegian market data query
  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ['/api/analytics/norwegian-market', ],
    queryFn: () => apiRequest('GE', '/api/analytics/norwegian-market'),
    refetchInterval: 360000, // Refresh every hour
    enabled: !isDemoMode,
});

  // Real-time analytics query
  const { data: realTimeData, isLoading: realTimeLoading } = useQuery({
    queryKey: ['/api/analytics/real-time', ],
    queryFn: () => apiRequest('GE','/api/analytics/real-time'),
    refetchInterval: 1000, // Refresh every 10 seconds
    enabled: !isDemoMode,
});

  // SSB Economic Data fetching functions
  const fetchSSBData = async () => {
    if (isDemoMode) return;
    
    setSsbLoading(true);
    try {
      // Fetch economic indicators
      const economicData = await getSSBEconomicIndicators();
      setSsbEconomicData(economicData);
      
      // Fetch population data for major Norwegian cities
      const populationData = await getSSBPopulationData('Oslo');
      setSsbPopulationData(populationData);
      
      // Fetch available datasets
      const datasets = await getSSBDatasets();
      setSsbDatasets(datasets.datasets || []);
      
  } catch (error) {
      console.warn('Failed to fetch SSB data: ', error);
  } finally {
      setSsbLoading(false);
  }
};

  // Fetch SSB data on component mount
  useEffect(() => {
    fetchSSBData();
}, [isDemoMode]);

  // Use demo data when in demo mode
  const displayPerformanceData = isDemoMode ? mockPerformanceData : performanceData;
  const displayBusinessData = isDemoMode ? mockBusinessData : businessData;
  const displayMarketData = isDemoMode ? mockMarketData : marketData;
  const displayRealTimeData = isDemoMode ? mockRealTimeData : realTimeData;

  const professionConfig = professionConfigs[user?.profession || 'photographer'];
  const professions = Object.values(professionConfigs);

  // Helper components
  const MetricCard = ({ title, value, subtitle, trend, trendValue, icon }: any) => (
    <Card
      role="article"
      aria-label={`${title}: ${value}`}
      sx={{
        height: '100%',
        ...theming.getThemedCardSx()'&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
        }}}
      tabIndex={0}
    >
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {icon && <Box sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true">{icon}</Box>}
          <Typography variant="h6" component="h2" color="text.secondary" sx={{ color: theming.colors.primary }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" color="primary" gutterBottom sx={{ color: theming.colors.primary }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
        {trendValue && (
          <Chip
            label={trendValue}
            color={trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'default'}
            size="small"
            sx={{ mt: 1 }}
            aria-label={`Trend: ${trendValue}`}
          />
        )}
      </CardContent>
    </Card>
  );

  const StatusIndicator = ({ status, text }: any) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} role="status" aria-live="polite">
      {status === 'success' && <CheckCircle color="success" aria-hidden="true" />}
      {status === 'error' && <Error color="error" aria-hidden="true" />}
      {status === 'warning' && <Warning color="warning" aria-hidden="true" />}
      <Typography variant="body2">
        <span className="sr-only">{status === 'success' ? 'Suksess:' : status === 'error' ? 'Feil:' : 'Advarsel:'}</span>
        {text}
      </Typography>
    </Box>
  );

  const LoadingWrapper = ({ loading, error, children }: any) => {
    if (loading) {
      return (
        <Box sx={{ p:  3 }}>
          <Skeleton variant="rectangular" height={200} sx={{ mb:  2 }} />
          <Skeleton variant="rectangular" height={200} />
        </Box>
      );
  }
    if (error) {
      return (
        <Alert severity="error" sx={{ m:  2 }}>
          Failed to load data: {error.message}
        </Alert>
      );
  }
    return children;
};

  const renderPerformanceTab = () => (
    <LoadingWrapper loading={performanceLoading} error={performanceError}>
      <Grid container spacing={3}>
        <Grid item >
          <MetricCard
            title="Gjennomsnittlig Lastetid"
            value={`${Math.round(displayPerformanceData?.pageLoad?.avg_load_time || 0)}ms`}
            subtitle="Siste 24 timer"
            trend={displayPerformanceData?.pageLoad?.avg_load_time < 3000 ? 'up' : 'down'}
            trendValue={
              displayPerformanceData?.pageLoad?.avg_load_time < 3000 ? 'Bra ytelse' : 'Treg lastetid'
          }
            icon={<SpeedIcon />}
          />
        </Grid>

        <Grid item >
          <MetricCard
            title="API Responstid"
            value={`${Math.round(displayPerformanceData?.api?.avg_response_time || 0)}ms`}
            subtitle="P95 responstid"
            trend={displayPerformanceData?.api?.avg_response_time < 1000 ? 'up' : 'down'}
            trendValue={`${Math.round(displayPerformanceData?.api?.p95_response_time || 0)}ms P95`}
            icon={<AnalyticsIcon />}
          />
        </Grid>

        <Grid item >
          <MetricCard
            title="Aktive Brukere"
            value={displayRealTimeData?.activeUsers || 0}
            subtitle="Siste 15 minutter"
            trend="neutral"
            icon={<PeopleIcon />}
          />
        </Grid>

        <Grid item >
          <MetricCard
            title="Feilrate"
            value={`${Math.round(displayRealTimeData?.errorRate || 0)}%`}
            subtitle="API feilrate"
            trend={displayRealTimeData?.errorRate < 5 ? 'up' : 'down'}
            trendValue={displayRealTimeData?.errorRate < 5 ? 'Lav feilrate' : 'Høy feilrate'}
            icon={<AssessmentIcon />}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt:  4 }}>
        <Grid container spacing={3}>
          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Core Web Vitals
                </Typography>
                {displayPerformanceData?.webVitals?.length > 0 ? (
                  <Box sx={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Typography color="text.secondary">
                      Web Vitals Chart Placeholder
                    </Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">Ingen Web Vitals data tilgjengelig</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  System Status
                </Typography>
                <Box sx={{ mb:  2 }}>
                  <StatusIndicator
                    status={displayRealTimeData?.errorRate < 5 ? 'success' : 'error'}
                    text={`${Math.round(displayRealTimeData?.errorRate || 0)}% feilrate`}
                  />
                </Box>
                <Box sx={{ mb:  2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Minnebruk
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, (displayRealTimeData?.systemLoad?.avg_memory_mb || 0) / 10)}
                    sx={{ height:  8, borderRadius:  4 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {Math.round(displayRealTimeData?.systemLoad?.avg_memory_mb || 0)} MB
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LoadingWrapper>
  );

  const renderBusinessTab = () => (
    <LoadingWrapper loading={businessLoading}>
      <Grid container spacing={3}>
        <Grid item >
          <MetricCard
            title="Totale Prosjekter"
            value={
              displayBusinessData?.projectMetrics?.reduce(
                (sum: number, p: any) => sum + p.total_projects,
                0,
              ) || 0 }
            subtitle={`Siste ${timeRange}`}
            icon={<BusinessIcon />}
          />
        </Grid>

        <Grid item >
          <MetricCard
            title="Total Omsetning"
            value={`${Math.round(displayBusinessData?.projectMetrics?.reduce((sum: number, p: any) => sum + p.total_revenue, 0) || 0).toLocaleString('no-NO')} kr`}
            subtitle="Alle prosjekter"
            trend="up"
            icon={<TrendingUpIcon />}
          />
        </Grid>

        <Grid item >
          <MetricCard
            title="Gjennomsnittlig Prosjektverdi"
            value={`${Math.round(
              displayBusinessData?.projectMetrics?.reduce(
                (sum: number, p: any) => sum + p.total_revenue,
                0,
              ) /
                Math.max(
                  1,
                  displayBusinessData?.projectMetrics?.reduce(
                    (sum: number, p: any) => sum + p.total_projects,
                    0,
                  ),
                ) || 0,
            ).toLocaleString('no-NO')} kr`}
            subtitle="Per prosjekt"
            icon={<AssessmentIcon />}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt:  4 }}>
        <Grid container spacing={3}>
          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Populære Funksjoner
                </Typography>
                {displayBusinessData?.featureUsage?.slice(0, 10).map((feature: any, index: number) => (
                  <Box key={feature.component} sx={{ mb:  2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.5}}
                    >
                      <Typography variant="body2">{feature.component}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.usage_count}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={
                        (feature.usage_count /
                          (displayBusinessData?.featureUsage?.[0]?.usage_count || 1)) *
                        100 }
                      sx={{ height:  6, borderRadius:  3 }}
                    />
                  </Box>
                )) || <Typography color="text.secondary">Ingen data tilgjengelig</Typography>}
              </CardContent>
            </Card>
          </Grid>

          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Enhetstyper
                </Typography>
                {displayBusinessData?.deviceMetrics?.length > 0 ? (
                  <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Typography color="text.secondary">
                      Device Metrics Chart Placeholder
                    </Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">Ingen enhetsdata tilgjengelig</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LoadingWrapper>
  );

  const renderMarketTab = () => (
    <LoadingWrapper loading={marketLoading}>
      <Alert severity="info" sx={{ mb:  3 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Norsk Markedsanalyse</Typography>
        <Typography variant="body2">
          Innsikt i det norske fotografer- og videografermarkedet basert på CreatorHub Norge-data
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {Object.values(professionConfigs).map((config) => (
          <Grid item  key={config.name}>
            <MetricCard
              title={`${config.displayName} i Norge`}
              value={
                displayMarketData?.marketInsights
                  ?.filter((m: any) => m.profession === config.name)
                  ?.reduce((sum: number, m: any) => sum + m.user_count, 0) || 0 }
              subtitle="Registrerte på plattformen"
              icon={<PeopleIcon />}
            />
          </Grid>
        ))}

        <Grid item >
          <MetricCard
            title="Gjennomsnittlig Timelønn"
            value={`${Math.round(displayMarketData?.marketInsights?.reduce((sum: number, m: any) => sum + (m.avg_hourly_rate || 0), 0) / Math.max(1, displayMarketData?.marketInsights?.length) || 0)} kr`}
            subtitle="Alle profesjoner"
            icon={<TrendingUpIcon />}
          />
        </Grid>

        <Grid item >
          <MetricCard
            title="Populært Utstyr"
            value={displayMarketData?.equipmentTrends?.[0]?.equipment_name || 'N/A'}
            subtitle="Mest brukte utstyr"
            icon={<BusinessIcon />}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt:  4 }}>
        <Grid container spacing={3}>
          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Geografisk Fordeling
                </Typography>
                {displayMarketData?.geographicData?.slice(0, 10).map((location: any, index: number) => (
                  <Box key={`${location.county}-${location.municipality}`} sx={{ mb:  2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'}}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {location.municipality}, {location.county}
                        </Typography>
                        <Chip label={location.profession} size="small" sx={{ mt: 0.5}} />
                      </Box>
                      <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                        {location.user_count}
                      </Typography>
                    </Box>
                  </Box>
                )) || (
                  <Typography color="text.secondary">Ingen geografisk data tilgjengelig</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item >
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Sesongmønstre
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Prosjektaktivitet gjennom året
                </Typography>
                {displayMarketData?.seasonalTrends?.length > 0 ? (
                  <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Typography color="text.secondary">
                      Seasonal Trends Chart Placeholder
                    </Typography>
                  </Box>
                ) : (
                  <Typography color="text.secondary">Ingen sesongdata tilgjengelig</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LoadingWrapper>
  );

  const renderSSBEconomicTab = () => (
    <LoadingWrapper loading={ssbLoading}>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          📊 SSB Økonomiske Indikatorer
        </Typography>
        <Typography variant="body2">
          Offisielle norske økonomiske data fra Statistisk sentralbyrå (SSB)
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {/* Economic Indicators */}
        {ssbEconomicData?.indicators?.map((indicator: any, index: number) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
            <MetricCard
              title={indicator.title}
              value={`${indicator.value} ${indicator.unit}`}
              subtitle={`Periode: ${indicator.period}`}
              icon={<AssessmentIcon />}
            />
          </Grid>
        ))}

        {/* Population Data */}
        {ssbPopulationData && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <MetricCard
              title="Befolkning Oslo"
              value={ssbPopulationData.data?.population?.toLocaleString() || 'N/A'}
              subtitle={`Vekst: ${ssbPopulationData.data?.growth || 0}%`}
              icon={<PeopleIcon />}
            />
          </Grid>
        )}

        {/* Available Datasets */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <MetricCard
            title="Tilgjengelige Datasett"
            value={ssbDatasets.length}
            subtitle="SSB datasett"
            icon={<AnalyticsIcon />}
          />
        </Grid>
      </Grid>

      {/* SSB Datasets List */}
      {ssbDatasets.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📈 Tilgjengelige SSB Datasett
              </Typography>
              <Grid container spacing={2}>
                {ssbDatasets.slice(0, 6).map((dataset: any, index: number) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                    <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle2" gutterBottom>
                        {dataset.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dataset.description}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {dataset.keywords?.slice(0, 3).map((keyword: string, i: number) => (
                          <Chip
                            key={i}
                            label={keyword}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Economic Insights */}
      <Box sx={{ mt: 4 }}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              💡 Økonomiske Innspill for {professionConfig?.displayName || 'Din Profesjon'}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📈 Markedsmuligheter
                  </Typography>
                  <Typography variant="body2">
                    Basert på SSB-data kan du identifisere voksende markeder og 
                    økonomiske trender som påvirker din bransje.
                  </Typography>
                </Alert>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    🎯 Prisstrategi
                  </Typography>
                  <Typography variant="body2">
                    Bruk offisielle økonomiske indikatorer for å justere 
                    prising basert på nasjonal økonomisk utvikling.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </LoadingWrapper>
  );

  return (
    <Container maxWidth="xl" className={className} role="main" aria-label="Business Intelligence Dashboard">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: theming.colors.primary }}>
          Business Intelligence Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Omfattende analyser og ytelsesovervåking for{', '}
          {professionConfig?.displayName || 'CreatorHub Norge'}
        </Typography>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }} role="group" aria-label="Filtreringsalternativer">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="time-range-label">Tidsperiode</InputLabel>
            <Select
              labelId="time-range-label"
              id="time-range-select"
              value={timeRange}
              label="Tidsperiode"
              onChange={(e) => setTimeRange(e.target.value)}
              inputProps={{ 'aria-label' : 'Velg tidsperiode' }}
            >
              <MenuItem value="1h">Siste time</MenuItem>
              <MenuItem value="24h">Siste 24 timer</MenuItem>
              <MenuItem value="7d">Siste uke</MenuItem>
              <MenuItem value="30d">Siste måned</MenuItem>
              <MenuItem value="90d">Siste 3 måneder</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="profession-label">Profesjon</InputLabel>
            <Select
              labelId="profession-label"
              id="profession-select"
              value={selectedProfession}
              label="Profesjon"
              onChange={(e) => setSelectedProfession(e.target.value)}
              inputProps={{ 'aria-label' : 'Velg profesjon' }}
            >
              <MenuItem value="">Alle profesjoner</MenuItem>
              {professions.map((profession) => (
                <MenuItem key={profession.id} value={profession.id}>
                  {profession.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Tabs */}
        <Tabs
          value={selectedTab}
          onChange={(_, newValue) => setSelectedTab(newValue)}
          aria-label="Business Intelligence navigasjon"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            mb: 3'& .MuiTab-root': {
              '&:focus-visible': {
                outline: '3px solid',
                outlineColor: 'primary.main',
                outlineOffset:'2px',
              },
            }}}
        >
          <Tab
            label="Ytelse"
            icon={<SpeedIcon aria-hidden="true" />}
            id="bi-tab-0"
            aria-controls="bi-tabpanel-0"
          />
          <Tab
            label="Forretning"
            icon={<BusinessIcon aria-hidden="true" />}
            id="bi-tab-1"
            aria-controls="bi-tabpanel-1"
          />
          <Tab
            label="Norsk Marked"
            icon={<LocationIcon aria-hidden="true" />}
            id="bi-tab-2"
            aria-controls="bi-tabpanel-2"
          />
          <Tab
            label="SSB Økonomi"
            icon={<AssessmentIcon aria-hidden="true" />}
            id="bi-tab-3"
            aria-controls="bi-tabpanel-3"
          />
        </Tabs>

        {/* Tab Content */}
        <Box role="tabpanel" id="bi-tabpanel-0" aria-labelledby="bi-tab-0" hidden={selectedTab !== 0}>
          {selectedTab === 0 && renderPerformanceTab()}
        </Box>
        <Box role="tabpanel" id="bi-tabpanel-1" aria-labelledby="bi-tab-1" hidden={selectedTab !== 1}>
          {selectedTab === 1 && renderBusinessTab()}
        </Box>
        <Box role="tabpanel" id="bi-tabpanel-2" aria-labelledby="bi-tab-2" hidden={selectedTab !== 2}>
          {selectedTab === 2 && renderMarketTab()}
        </Box>
        <Box role="tabpanel" id="bi-tabpanel-3" aria-labelledby="bi-tab-3" hidden={selectedTab !== 3}>
          {selectedTab === 3 && renderSSBEconomicTab()}
        </Box>
      </Box>
    </Container>
  );
}
