import React, { useEffect, useState } from 'react';
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
  Chip,
  Stack,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  BusinessCenter as BusinessIcon,
  Analytics as AnalyticsIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import {
  useExternalData,
  SSBEconomicIndicators,
  SSBPopulationData,
  SSBDatasets
} from '../../services/ExternalDataService';
import { useTheming } from '../../utils/theming-helper';

interface PerformanceSummary {
  pageLoad: { avgLoadTime: number; p95LoadTime: number };
  api: { avgResponseTime: number; p95ResponseTime: number };
  webVitals: Array<{ name: string; avgValue: number; p75Value: number }>;
}

interface BusinessIntelligenceData {
  projectMetrics: Array<{ profession: string; totalProjects: number; totalRevenue: number }>;
  featureUsage: Array<{ component: string; usageCount: number }>;
  deviceMetrics: Array<{ deviceType: string; sessionCount: number }>;
}

interface MarketData {
  marketInsights: Array<{ profession: string; userCount: number; avgHourlyRate: number }>;
  equipmentTrends: Array<{ equipmentName: string; usageCount: number }>;
  geographicData: Array<{ county: string; municipality: string; userCount: number; profession: string }>;
  seasonalTrends: Array<{ month: number; projectCount: number }>;
}

interface RealTimeData {
  activeUsers: number;
  errorRate: number;
  systemLoad: { avgMemoryMb: number; cpuUsage: number };
}

interface BusinessIntelligenceDashboardProps {
  className?: string;
}

export default function BusinessIntelligenceDashboard({
  className
}: BusinessIntelligenceDashboardProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedProfession, setSelectedProfession] = useState('');

  const [ssbEconomicData, setSsbEconomicData] = useState<SSBEconomicIndicators | null>(null);
  const [ssbPopulationData, setSsbPopulationData] = useState<SSBPopulationData | null>(null);
  const [ssbDatasets, setSsbDatasets] = useState<Array<{ id: string; title: string }>>([]);
  const [ssbLoading, setSsbLoading] = useState(false);

  const { isDemoMode } = useDemoMode();
  const theming = useTheming('photographer');

  const { user } = useAuth();
  const { professionConfigs } = useDynamicProfessions();

  const { getSSBEconomicIndicators, getSSBPopulationData, searchSSBDatasets } = useExternalData();

  const { data: performanceData, isLoading: performanceLoading } = useQuery<PerformanceSummary>({
    queryKey: ['/api/analytics/performance/summary', { range: timeRange, profession: selectedProfession }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/performance/summary?range=${encodeURIComponent(timeRange)}&profession=${encodeURIComponent(
          selectedProfession
        )}`
      ),
    refetchInterval: 60000,
    enabled: !isDemoMode
  });

  const { data: businessData, isLoading: businessLoading } = useQuery<BusinessIntelligenceData>({
    queryKey: ['/api/analytics/business-intelligence', { range: timeRange, profession: selectedProfession }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/business-intelligence?range=${encodeURIComponent(
          timeRange
        )}&profession=${encodeURIComponent(selectedProfession)}`
      ),
    refetchInterval: 300000,
    enabled: !isDemoMode
  });

  const { data: marketData, isLoading: marketLoading } = useQuery<MarketData>({
    queryKey: ['/api/analytics/norwegian-market'],
    queryFn: () => apiRequest('/api/analytics/norwegian-market'),
    refetchInterval: 3600000,
    enabled: !isDemoMode
  });

  const { data: realTimeData, isLoading: realTimeLoading } = useQuery<RealTimeData>({
    queryKey: ['/api/analytics/real-time'],
    queryFn: () => apiRequest('/api/analytics/real-time'),
    refetchInterval: 10000,
    enabled: !isDemoMode
  });

  useEffect(() => {
    if (isDemoMode) return;

    const fetchSsbData = async () => {
      setSsbLoading(true);
      try {
        const economic = await getSSBEconomicIndicators({ region: 'Oslo' });
        const population = await getSSBPopulationData({ region: 'Oslo' });
        const datasets = await searchSSBDatasets({ query: 'norge', limit: 12 });
        setSsbEconomicData(economic || null);
        setSsbPopulationData(population || null);
        const datasetItems = Array.isArray((datasets as SSBDatasets | null)?.datasets)
          ? ((datasets as SSBDatasets).datasets || [])
          : [];
        setSsbDatasets(
          datasetItems.map((item) => ({
            id: String(item.id ?? ''),
            title: String(item.title ?? '')
          }))
        );
      } finally {
        setSsbLoading(false);
      }
    };

    fetchSsbData();
  }, [getSSBEconomicIndicators, getSSBPopulationData, isDemoMode, searchSSBDatasets]);

  const currentProfession = selectedProfession || user?.profession || 'photographer';
  const professions = Object.values(professionConfigs || {});

  const loading = performanceLoading || businessLoading || marketLoading || realTimeLoading || ssbLoading;

  return (
    <Container maxWidth="xl" className={className} sx={{ py: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            Business Intelligence
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Markedsinnsikt og sanntidsytelse
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small">
            <InputLabel id="bi-range">Periode</InputLabel>
            <Select
              labelId="bi-range"
              value={timeRange}
              label="Periode"
              onChange={(event) => setTimeRange(event.target.value)}
            >
              <MenuItem value="7d">7 dager</MenuItem>
              <MenuItem value="30d">30 dager</MenuItem>
              <MenuItem value="90d">90 dager</MenuItem>
              <MenuItem value="180d">180 dager</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="bi-profession">Profesjon</InputLabel>
            <Select
              labelId="bi-profession"
              value={selectedProfession}
              label="Profesjon"
              onChange={(event) => setSelectedProfession(event.target.value)}
            >
              <MenuItem value="">Alle</MenuItem>
              {professions.map((prof) => (
                <MenuItem key={prof.name} value={prof.name}>
                  {prof.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Oppdaterer innsikt...</Typography>
        </Box>
      )}

      <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)} sx={{ mt: 3 }}>
        <Tab label="Ytelse" />
        <Tab label="Business" />
        <Tab label="Marked" />
        <Tab label="Sanntid" />
      </Tabs>

      {selectedTab === 0 && performanceData && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SpeedIcon color="primary" />
                  <Typography variant="subtitle1">Page load</Typography>
                </Stack>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {performanceData.pageLoad.avgLoadTime} ms
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  P95: {performanceData.pageLoad.p95LoadTime} ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AnalyticsIcon color="primary" />
                  <Typography variant="subtitle1">API responstid</Typography>
                </Stack>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {performanceData.api.avgResponseTime} ms
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  P95: {performanceData.api.p95ResponseTime} ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Web Vitals
                </Typography>
                {performanceData.webVitals.map((vital) => (
                  <Box key={vital.name} sx={{ mb: 1 }}>
                    <Typography variant="caption">{vital.name}</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip label={`Avg: ${vital.avgValue}`} size="small" />
                      <Chip label={`P75: ${vital.p75Value}`} size="small" />
                    </Stack>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {selectedTab === 1 && businessData && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BusinessIcon color="primary" />
                  <Typography variant="subtitle1">Prosjektvolum</Typography>
                </Stack>
                {businessData.projectMetrics.map((metric) => (
                  <Box key={metric.profession} sx={{ mt: 1 }}>
                    <Typography variant="body2">{metric.profession}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {metric.totalProjects} prosjekter • {metric.totalRevenue.toLocaleString('nb-NO')} NOK
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PeopleIcon color="primary" />
                  <Typography variant="subtitle1">Feature usage</Typography>
                </Stack>
                {businessData.featureUsage.map((feature) => (
                  <Box key={feature.component} sx={{ mt: 1 }}>
                    <Typography variant="body2">{feature.component}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feature.usageCount} bruk
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {selectedTab === 2 && marketData && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationIcon color="primary" />
                  <Typography variant="subtitle1">Geografi</Typography>
                </Stack>
                {marketData.geographicData.map((row, index) => (
                  <Box key={`${row.county}-${index}`} sx={{ mt: 1 }}>
                    <Typography variant="body2">{row.county}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.municipality} • {row.userCount} {row.profession}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle1">Sesongtrender</Typography>
                </Stack>
                {marketData.seasonalTrends.map((row) => (
                  <Box key={row.month} sx={{ mt: 1 }}>
                    <Typography variant="body2">Maaned {row.month}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.projectCount} prosjekter
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  SSB data
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">Okonomi: {ssbEconomicData ? 'Lastet' : 'Ingen data'}</Typography>
                  <Typography variant="body2">Befolkning: {ssbPopulationData ? 'Lastet' : 'Ingen data'}</Typography>
                  <Typography variant="body2">Datasett: {ssbDatasets.length}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {selectedTab === 3 && realTimeData && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PeopleIcon color="primary" />
                  <Typography variant="subtitle1">Aktive brukere</Typography>
                </Stack>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {realTimeData.activeUsers}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AnalyticsIcon color="primary" />
                  <Typography variant="subtitle1">Feilrate</Typography>
                </Stack>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {realTimeData.errorRate.toFixed(2)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ScheduleIcon color="primary" />
                  <Typography variant="subtitle1">Systemlast</Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Minne: {realTimeData.systemLoad.avgMemoryMb} MB
                </Typography>
                <Typography variant="body2">
                  CPU: {realTimeData.systemLoad.cpuUsage}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="caption" color="text.secondary">
        Valgt profesjon: {currentProfession}
      </Typography>
    </Container>
  );
}
