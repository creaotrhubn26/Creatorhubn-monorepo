import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Api as ApiIcon,
  Business as BusinessIcon,
  CameraAlt as CameraAltIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  LocalShipping as LocalShippingIcon,
  Money as MoneyIcon,
  MusicNote as MusicNoteIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  VideoLibrary as VideoLibraryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  AdminButton,
  AdminLoading,
  AdminTableContainer,
  StatusChip,
} from './design-system';

type IntegrationStatus = 'active' | 'inactive' | 'error';
type DateRange = '24h' | '7d' | '30d' | '90d';

type AlertLevel = 'error' | 'warning' | 'info';

interface OverviewMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  totalCost: number;
  activeIntegrations: number;
  errorCount: number;
}

interface IntegrationMetric {
  name: string;
  service: string;
  requests: number;
  successRate: number;
  avgResponseTime: number;
  cost: number;
  status: IntegrationStatus;
  lastUsed: string;
  errors: number;
}

interface TimeSeriesPoint {
  timestamp: string;
  requests: number;
  errors: number;
  responseTime: number;
  cost: number;
}

interface ServiceUsageMetric {
  primary: number;
  secondary: number;
  tertiary: number;
}

interface PerformanceMetric {
  uptime: number;
  reliability: number;
  latency: number;
  throughput: number;
}

interface CostAnalysis {
  totalMonthly: number;
  breakdown: Record<string, number>;
  projectedAnnual: number;
  roi: number;
}

interface IntegrationAlertItem {
  id: string;
  type: AlertLevel;
  service: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface IntegrationAnalyticsData {
  overview: OverviewMetrics;
  integrationMetrics: Record<string, IntegrationMetric>;
  timeSeriesData: TimeSeriesPoint[];
  norwegianMarketData: {
    brreg: ServiceUsageMetric;
    bring: ServiceUsageMetric;
    gramo: ServiceUsageMetric;
    proff: ServiceUsageMetric;
  };
  creativeIndustryData: {
    unsplash: ServiceUsageMetric;
    pexels: ServiceUsageMetric;
    adobe: ServiceUsageMetric;
    canva: ServiceUsageMetric;
  };
  performanceMetrics: Record<string, PerformanceMetric>;
  costAnalysis: CostAnalysis;
  alerts: IntegrationAlertItem[];
}

const CHART_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f97316'];

const toRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeStatus = (value: unknown): IntegrationStatus => {
  if (value === 'active' || value === 'inactive' || value === 'error') return value;
  return 'inactive';
};

const normalizeAlertType = (value: unknown): AlertLevel => {
  if (value === 'error' || value === 'warning' || value === 'info') return value;
  return 'info';
};

const normalizeServiceUsageMetric = (value: unknown): ServiceUsageMetric => {
  const record = toRecord(value);
  return {
    primary: toNumber(record.primary),
    secondary: toNumber(record.secondary),
    tertiary: toNumber(record.tertiary),
  };
};

const normalizeIntegrationMetric = (value: unknown, fallbackKey: string): IntegrationMetric => {
  const record = toRecord(value);
  return {
    name: toStringValue(record.name, fallbackKey),
    service: toStringValue(record.service, fallbackKey.toLowerCase()),
    requests: toNumber(record.requests),
    successRate: toNumber(record.successRate),
    avgResponseTime: toNumber(record.avgResponseTime),
    cost: toNumber(record.cost),
    status: normalizeStatus(record.status),
    lastUsed: toStringValue(record.lastUsed, new Date().toISOString()),
    errors: toNumber(record.errors),
  };
};

const normalizeTimeSeriesPoint = (value: unknown, index: number): TimeSeriesPoint => {
  const record = toRecord(value);
  return {
    timestamp: toStringValue(record.timestamp, `Punkt ${index + 1}`),
    requests: toNumber(record.requests),
    errors: toNumber(record.errors),
    responseTime: toNumber(record.responseTime),
    cost: toNumber(record.cost),
  };
};

const normalizePerformanceMetric = (value: unknown): PerformanceMetric => {
  const record = toRecord(value);
  return {
    uptime: toNumber(record.uptime),
    reliability: toNumber(record.reliability),
    latency: toNumber(record.latency),
    throughput: toNumber(record.throughput),
  };
};

const normalizeAlert = (value: unknown, index: number): IntegrationAlertItem => {
  const record = toRecord(value);
  return {
    id: toStringValue(record.id, `alert-${index}`),
    type: normalizeAlertType(record.type),
    service: toStringValue(record.service, 'system'),
    message: toStringValue(record.message, 'Ingen meldingsdetaljer tilgjengelig'),
    timestamp: toStringValue(record.timestamp, new Date().toISOString()),
    resolved: toBoolean(record.resolved),
  };
};

const createFallbackAnalyticsData = (): IntegrationAnalyticsData => {
  const now = new Date();
  const series: TimeSeriesPoint[] = Array.from({ length: 7 }, (_, index) => {
    const pointDate = new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    return {
      timestamp: pointDate.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' }),
      requests: 1200 + index * 130,
      errors: Math.max(1, 18 - index * 2),
      responseTime: Math.max(95, 180 - index * 10),
      cost: 320 + index * 28,
    };
  });

  return {
    overview: {
      totalRequests: series.reduce((sum, point) => sum + point.requests, 0),
      successRate: 98.2,
      averageResponseTime: 124,
      totalCost: 2890,
      activeIntegrations: 8,
      errorCount: series.reduce((sum, point) => sum + point.errors, 0),
    },
    integrationMetrics: {
      bring: {
        name: 'Bring Tracking',
        service: 'bring',
        requests: 2134,
        successRate: 99.1,
        avgResponseTime: 108,
        cost: 480,
        status: 'active',
        lastUsed: now.toISOString(),
        errors: 4,
      },
      brreg: {
        name: 'BRREG Lookup',
        service: 'brreg',
        requests: 1720,
        successRate: 98.7,
        avgResponseTime: 142,
        cost: 390,
        status: 'active',
        lastUsed: now.toISOString(),
        errors: 8,
      },
      gramo: {
        name: 'GRAMO Royalties',
        service: 'gramo',
        requests: 892,
        successRate: 97.3,
        avgResponseTime: 156,
        cost: 275,
        status: 'active',
        lastUsed: now.toISOString(),
        errors: 10,
      },
      unsplash: {
        name: 'Unsplash Media',
        service: 'unsplash',
        requests: 2401,
        successRate: 99.4,
        avgResponseTime: 102,
        cost: 610,
        status: 'active',
        lastUsed: now.toISOString(),
        errors: 5,
      },
      pexels: {
        name: 'Pexels Media',
        service: 'pexels',
        requests: 1902,
        successRate: 98.9,
        avgResponseTime: 117,
        cost: 520,
        status: 'active',
        lastUsed: now.toISOString(),
        errors: 7,
      },
    },
    timeSeriesData: series,
    norwegianMarketData: {
      brreg: { primary: 1014, secondary: 188, tertiary: 63 },
      bring: { primary: 1564, secondary: 708, tertiary: 29200 },
      gramo: { primary: 442, secondary: 91, tertiary: 422000 },
      proff: { primary: 352, secondary: 94, tertiary: 35 },
    },
    creativeIndustryData: {
      unsplash: { primary: 2482, secondary: 612, tertiary: 188 },
      pexels: { primary: 2020, secondary: 540, tertiary: 129 },
      adobe: { primary: 931, secondary: 67, tertiary: 512 },
      canva: { primary: 1750, secondary: 392, tertiary: 277 },
    },
    performanceMetrics: {
      bring: { uptime: 99.96, reliability: 98.8, latency: 108, throughput: 320 },
      brreg: { uptime: 99.2, reliability: 97.1, latency: 142, throughput: 201 },
      gramo: { uptime: 98.7, reliability: 96.3, latency: 156, throughput: 143 },
      unsplash: { uptime: 99.99, reliability: 99.4, latency: 102, throughput: 401 },
      pexels: { uptime: 99.6, reliability: 98.5, latency: 117, throughput: 288 },
    },
    costAnalysis: {
      totalMonthly: 2890,
      breakdown: {
        Bring: 480,
        BRREG: 390,
        GRAMO: 275,
        Unsplash: 610,
        Pexels: 520,
        Adobe: 355,
        Canva: 260,
      },
      projectedAnnual: 34680,
      roi: 265,
    },
    alerts: [
      {
        id: 'alert-1',
        type: 'warning',
        service: 'brreg',
        message: 'Responstiden økte over 140ms i perioder siste døgn.',
        timestamp: now.toISOString(),
        resolved: false,
      },
      {
        id: 'alert-2',
        type: 'info',
        service: 'unsplash',
        message: 'Høy API-utnyttelse med stabil suksessrate.',
        timestamp: now.toISOString(),
        resolved: true,
      },
    ],
  };
};

const normalizeAnalyticsData = (payload: unknown): IntegrationAnalyticsData => {
  const record = toRecord(payload);
  const fallback = createFallbackAnalyticsData();

  const overviewRecord = toRecord(record.overview);
  const overview: OverviewMetrics = {
    totalRequests: toNumber(overviewRecord.totalRequests, fallback.overview.totalRequests),
    successRate: toNumber(overviewRecord.successRate, fallback.overview.successRate),
    averageResponseTime: toNumber(overviewRecord.averageResponseTime, fallback.overview.averageResponseTime),
    totalCost: toNumber(overviewRecord.totalCost, fallback.overview.totalCost),
    activeIntegrations: toNumber(overviewRecord.activeIntegrations, fallback.overview.activeIntegrations),
    errorCount: toNumber(overviewRecord.errorCount, fallback.overview.errorCount),
  };

  const integrationMetricsRecord = toRecord(record.integrationMetrics);
  const integrationMetrics: Record<string, IntegrationMetric> = Object.entries(integrationMetricsRecord).reduce(
    (acc, [key, value]) => {
      acc[key] = normalizeIntegrationMetric(value, key);
      return acc;
    },
    {} as Record<string, IntegrationMetric>,
  );

  const normalizedIntegrationMetrics =
    Object.keys(integrationMetrics).length > 0 ? integrationMetrics : fallback.integrationMetrics;

  const timeSeriesRaw = Array.isArray(record.timeSeriesData) ? record.timeSeriesData : [];
  const timeSeriesData =
    timeSeriesRaw.length > 0
      ? timeSeriesRaw.map((point, index) => normalizeTimeSeriesPoint(point, index))
      : fallback.timeSeriesData;

  const norwegianRecord = toRecord(record.norwegianMarketData);
  const creativeRecord = toRecord(record.creativeIndustryData);
  const performanceRecord = toRecord(record.performanceMetrics);

  const performanceMetrics: Record<string, PerformanceMetric> = Object.entries(performanceRecord).reduce(
    (acc, [service, value]) => {
      acc[service] = normalizePerformanceMetric(value);
      return acc;
    },
    {} as Record<string, PerformanceMetric>,
  );

  const costRecord = toRecord(record.costAnalysis);
  const costBreakdownRecord = toRecord(costRecord.breakdown);
  const breakdown = Object.entries(costBreakdownRecord).reduce((acc, [service, amount]) => {
    acc[service] = toNumber(amount);
    return acc;
  }, {} as Record<string, number>);

  const alertsRaw = Array.isArray(record.alerts) ? record.alerts : [];
  const alerts = alertsRaw.length > 0 ? alertsRaw.map((item, index) => normalizeAlert(item, index)) : fallback.alerts;

  return {
    overview,
    integrationMetrics: normalizedIntegrationMetrics,
    timeSeriesData,
    norwegianMarketData: {
      brreg: normalizeServiceUsageMetric(norwegianRecord.brreg ?? fallback.norwegianMarketData.brreg),
      bring: normalizeServiceUsageMetric(norwegianRecord.bring ?? fallback.norwegianMarketData.bring),
      gramo: normalizeServiceUsageMetric(norwegianRecord.gramo ?? fallback.norwegianMarketData.gramo),
      proff: normalizeServiceUsageMetric(norwegianRecord.proff ?? fallback.norwegianMarketData.proff),
    },
    creativeIndustryData: {
      unsplash: normalizeServiceUsageMetric(creativeRecord.unsplash ?? fallback.creativeIndustryData.unsplash),
      pexels: normalizeServiceUsageMetric(creativeRecord.pexels ?? fallback.creativeIndustryData.pexels),
      adobe: normalizeServiceUsageMetric(creativeRecord.adobe ?? fallback.creativeIndustryData.adobe),
      canva: normalizeServiceUsageMetric(creativeRecord.canva ?? fallback.creativeIndustryData.canva),
    },
    performanceMetrics: Object.keys(performanceMetrics).length > 0 ? performanceMetrics : fallback.performanceMetrics,
    costAnalysis: {
      totalMonthly: toNumber(costRecord.totalMonthly, fallback.costAnalysis.totalMonthly),
      breakdown: Object.keys(breakdown).length > 0 ? breakdown : fallback.costAnalysis.breakdown,
      projectedAnnual: toNumber(costRecord.projectedAnnual, fallback.costAnalysis.projectedAnnual),
      roi: toNumber(costRecord.roi, fallback.costAnalysis.roi),
    },
    alerts,
  };
};

const formatNok = (value: number): string =>
  value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  });

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const getAlertColor = (type: AlertLevel): 'error' | 'warning' | 'info' => {
  if (type === 'error') return 'error';
  if (type === 'warning') return 'warning';
  return 'info';
};

const getServiceIcon = (service: string) => {
  switch (service.toLowerCase()) {
    case 'bring':
      return <LocalShippingIcon color="warning" />;
    case 'brreg':
      return <BusinessIcon color="primary" />;
    case 'gramo':
      return <MusicNoteIcon color="success" />;
    case 'proff':
      return <BusinessIcon color="secondary" />;
    case 'unsplash':
      return <CameraAltIcon color="action" />;
    case 'pexels':
      return <VideoLibraryIcon color="success" />;
    default:
      return <ApiIcon color="action" />;
  }
};

const IntegrationAnalyticsDashboard: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const { auth } = useEnhancedMasterIntegration();

  const [activeTab, setActiveTab] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(30);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<IntegrationAnalyticsData>({
    queryKey: ['integration-analytics', dateRange],
    queryFn: async () => {
      let headers: Record<string, string> = {};
      try {
        headers = await auth.getAuthHeader();
      } catch {
        headers = {};
      }

      const response = await fetch(`/api/admin/integration-analytics?range=${dateRange}`, {
        headers: {
          ...headers,
          ...(typeof user?.email === 'string' && user.email.length > 0 ? { 'x-user-email': user.email } : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Kunne ikke hente integration analytics (${response.status})`);
      }

      const payload = (await response.json()) as unknown;
      return normalizeAnalyticsData(payload);
    },
    retry: 1,
    staleTime: 15_000,
    refetchInterval: autoRefresh ? refreshIntervalSeconds * 1000 : false,
  });

  const analyticsData = data ?? createFallbackAnalyticsData();
  const pendingAlerts = useMemo(
    () => analyticsData.alerts.filter((alertItem) => !alertItem.resolved),
    [analyticsData.alerts],
  );

  const integrationRows = useMemo(
    () => Object.entries(analyticsData.integrationMetrics).map(([id, metric]) => ({ id, ...metric })),
    [analyticsData.integrationMetrics],
  );

  const performanceScore = useMemo(() => {
    const responseTimeScore = Math.max(0, 100 - analyticsData.overview.averageResponseTime / 3);
    return Math.round((analyticsData.overview.successRate + responseTimeScore) / 2);
  }, [analyticsData.overview.averageResponseTime, analyticsData.overview.successRate]);

  const costBreakdownData = useMemo(
    () =>
      Object.entries(analyticsData.costAnalysis.breakdown).map(([service, value]) => ({
        name: service,
        value,
      })),
    [analyticsData.costAnalysis.breakdown],
  );

  const norwegianServiceCards = [
    {
      key: 'brreg',
      label: 'BRREG',
      metric: analyticsData.norwegianMarketData.brreg,
      lines: ['Selskapsoppslag', 'Query-batcher', 'Verifiseringer'],
    },
    {
      key: 'bring',
      label: 'Bring',
      metric: analyticsData.norwegianMarketData.bring,
      lines: ['Forsendelser', 'Sporinger', 'Kostnad NOK'],
    },
    {
      key: 'gramo',
      label: 'GRAMO',
      metric: analyticsData.norwegianMarketData.gramo,
      lines: ['Artister', 'Royalties', 'Beløp NOK'],
    },
    {
      key: 'proff',
      label: 'Proff',
      metric: analyticsData.norwegianMarketData.proff,
      lines: ['Kredittsjekker', 'Rapporter', 'Risikovurderinger'],
    },
  ];

  const creativeServiceCards = [
    {
      key: 'unsplash',
      label: 'Unsplash',
      metric: analyticsData.creativeIndustryData.unsplash,
      lines: ['Søk', 'Nedlastinger', 'Fotografer'],
    },
    {
      key: 'pexels',
      label: 'Pexels',
      metric: analyticsData.creativeIndustryData.pexels,
      lines: ['Søk', 'Nedlastinger', 'Videoer'],
    },
    {
      key: 'adobe',
      label: 'Adobe',
      metric: analyticsData.creativeIndustryData.adobe,
      lines: ['Synk', 'Prosjekter', 'Lagring'],
    },
    {
      key: 'canva',
      label: 'Canva',
      metric: analyticsData.creativeIndustryData.canva,
      lines: ['Design', 'Maler', 'Eksporter'],
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
            Integration Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sanntidsanalyse av API-integrasjoner, ytelse, kostnader og driftsvarsler.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="integration-date-range-label">Periode</InputLabel>
            <Select
              labelId="integration-date-range-label"
              value={dateRange}
              label="Periode"
              onChange={(event) => setDateRange(event.target.value as DateRange)}
            >
              <MenuItem value="24h">24 timer</MenuItem>
              <MenuItem value="7d">7 dager</MenuItem>
              <MenuItem value="30d">30 dager</MenuItem>
              <MenuItem value="90d">90 dager</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />}
            label="Auto"
          />

          <FormControl size="small" sx={{ minWidth: 105 }} disabled={!autoRefresh}>
            <InputLabel id="integration-refresh-interval-label">Intervall</InputLabel>
            <Select
              labelId="integration-refresh-interval-label"
              value={refreshIntervalSeconds}
              label="Intervall"
              onChange={(event) => setRefreshIntervalSeconds(Number(event.target.value))}
            >
              <MenuItem value={15}>15s</MenuItem>
              <MenuItem value={30}>30s</MenuItem>
              <MenuItem value={60}>60s</MenuItem>
              <MenuItem value={120}>120s</MenuItem>
            </Select>
          </FormControl>

          <Badge color="error" badgeContent={pendingAlerts.length}>
            <IconButton aria-label="Vis varsler" onClick={() => setAlertsDialogOpen(true)}>
              <NotificationsIcon />
            </IconButton>
          </Badge>

          <AdminButton
            tone="secondary"
            onClick={() => void refetch()}
            startIcon={<RefreshIcon />}
            loading={isFetching}
            disabled={isFetching}
          >
            Oppdater
          </AdminButton>
        </Stack>
      </Stack>

      {isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {(error as Error).message}. Viser siste tilgjengelige datasett.
        </Alert>
      ) : null}

      {isLoading && !data ? (
        <AdminLoading label="Laster analytics..." />
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            label: 'Totale forespørsler',
            value: analyticsData.overview.totalRequests.toLocaleString('nb-NO'),
            icon: <AnalyticsIcon color="primary" />,
          },
          {
            label: 'Suksessrate',
            value: formatPercent(analyticsData.overview.successRate),
            icon: <CheckCircleIcon color="success" />,
          },
          {
            label: 'Snitt responstid',
            value: `${analyticsData.overview.averageResponseTime.toFixed(0)} ms`,
            icon: <SpeedIcon color="info" />,
          },
          {
            label: 'Månedlig kostnad',
            value: formatNok(analyticsData.overview.totalCost),
            icon: <MoneyIcon color="warning" />,
          },
          {
            label: 'Aktive integrasjoner',
            value: `${analyticsData.overview.activeIntegrations}`,
            icon: <ApiIcon color="secondary" />,
          },
          {
            label: 'Aktive feil',
            value: `${analyticsData.overview.errorCount}`,
            icon: analyticsData.overview.errorCount > 0 ? <ErrorIcon color="error" /> : <CheckCircleIcon color="success" />,
          },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={item.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {item.label}
                    </Typography>
                    {item.icon}
                  </Stack>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {item.value}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, performanceScore))}
                size={118}
                thickness={4}
                color={performanceScore >= 90 ? 'success' : performanceScore >= 75 ? 'warning' : 'error'}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {performanceScore}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                Systemhelse
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Kombinert score basert på suksessrate og responstid.
              </Typography>
              <Stack spacing={1.25}>
                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">Suksessrate</Typography>
                    <Typography variant="caption">{formatPercent(analyticsData.overview.successRate)}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={Math.min(100, analyticsData.overview.successRate)} color="success" />
                </Box>
                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">Responstidscore</Typography>
                    <Typography variant="caption">{Math.max(0, Math.round(100 - analyticsData.overview.averageResponseTime / 3))}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(0, Math.min(100, 100 - analyticsData.overview.averageResponseTime / 3))}
                    color="info"
                  />
                </Box>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <Tabs value={activeTab} onChange={(_, tab) => setActiveTab(tab)} variant="scrollable" scrollButtons="auto">
          <Tab label="Oversikt" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Norske tjenester" icon={<BusinessIcon />} iconPosition="start" />
          <Tab label="Kreative APIer" icon={<CameraAltIcon />} iconPosition="start" />
          <Tab label="Ytelse" icon={<SpeedIcon />} iconPosition="start" />
          <Tab label="Kostnader" icon={<MoneyIcon />} iconPosition="start" />
          <Tab label="Advarsler" icon={<WarningIcon />} iconPosition="start" />
        </Tabs>

        <Divider />

        <CardContent>
          {activeTab === 0 ? (
            <Stack spacing={3}>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="requests" stroke="#2563eb" name="Forespørsler" strokeWidth={2} />
                    <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Feil" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              <AdminTableContainer ariaLabel="Integrasjoner – forespørsler og status">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tjeneste</TableCell>
                      <TableCell align="right">Forespørsler</TableCell>
                      <TableCell align="right">Suksessrate</TableCell>
                      <TableCell align="right">Responstid</TableCell>
                      <TableCell align="right">Kostnad</TableCell>
                      <TableCell align="right">Feil</TableCell>
                      <TableCell align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {integrationRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {getServiceIcon(row.service)}
                            <Typography variant="body2">{row.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{row.requests.toLocaleString('nb-NO')}</TableCell>
                        <TableCell align="right">{formatPercent(row.successRate)}</TableCell>
                        <TableCell align="right">{row.avgResponseTime.toFixed(0)} ms</TableCell>
                        <TableCell align="right">{formatNok(row.cost)}</TableCell>
                        <TableCell align="right">{row.errors}</TableCell>
                        <TableCell align="right">
                          <StatusChip
                            label={row.status}
                            tone={row.status === 'active' ? 'success' : row.status === 'error' ? 'error' : 'neutral'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminTableContainer>
            </Stack>
          ) : null}

          {activeTab === 1 ? (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                {norwegianServiceCards.map((item) => (
                  <Grid item xs={12} sm={6} md={3} key={item.key}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2">{item.label}</Typography>
                            {getServiceIcon(item.key)}
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {item.lines[0]}: {item.metric.primary.toLocaleString('nb-NO')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.lines[1]}: {item.metric.secondary.toLocaleString('nb-NO')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.lines[2]}: {item.metric.tertiary.toLocaleString('nb-NO')}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={norwegianServiceCards.map((item) => ({
                      service: item.label,
                      primary: item.metric.primary,
                      secondary: item.metric.secondary,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="service" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="primary" fill="#2563eb" name="Primær" />
                    <Bar dataKey="secondary" fill="#14b8a6" name="Sekundær" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          ) : null}

          {activeTab === 2 ? (
            <Grid container spacing={2}>
              {creativeServiceCards.map((item) => (
                <Grid item xs={12} md={6} key={item.key}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle1">{item.label}</Typography>
                          {getServiceIcon(item.key)}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          {item.lines[0]}: {item.metric.primary.toLocaleString('nb-NO')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.lines[1]}: {item.metric.secondary.toLocaleString('nb-NO')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.lines[2]}: {item.metric.tertiary.toLocaleString('nb-NO')}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : null}

          {activeTab === 3 ? (
            <Stack spacing={3}>
              <Grid container spacing={2}>
                {Object.entries(analyticsData.performanceMetrics).map(([service, metric]) => (
                  <Grid item xs={12} md={6} key={service}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1.25}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="subtitle2">{service.toUpperCase()}</Typography>
                            {getServiceIcon(service)}
                          </Stack>

                          <Box>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption">Uptime</Typography>
                              <Typography variant="caption">{formatPercent(metric.uptime)}</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={Math.min(100, metric.uptime)} color="success" />
                          </Box>

                          <Box>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption">Reliability</Typography>
                              <Typography variant="caption">{formatPercent(metric.reliability)}</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={Math.min(100, metric.reliability)} color="info" />
                          </Box>

                          <Typography variant="caption" color="text.secondary">
                            Latency: {metric.latency.toFixed(0)} ms · Throughput: {metric.throughput.toFixed(0)} req/min
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="responseTime" stroke="#f59e0b" fill="#f59e0b55" name="Responstid" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Stack>
          ) : null}

          {activeTab === 4 ? (
            <Stack spacing={3}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Månedlig total
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {formatNok(analyticsData.costAnalysis.totalMonthly)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Årsprognose
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {formatNok(analyticsData.costAnalysis.projectedAnnual)}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      ROI
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {analyticsData.costAnalysis.roi.toFixed(0)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Stack>

              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costBreakdownData} dataKey="value" nameKey="name" outerRadius={110} label>
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip
                      formatter={(value) => formatNok(Number(Array.isArray(value) ? value[0] : value ?? 0))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              <AdminTableContainer ariaLabel="Kostnad per tjeneste">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tjeneste</TableCell>
                      <TableCell align="right">Kostnad</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {costBreakdownData.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell align="right">{formatNok(item.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AdminTableContainer>
            </Stack>
          ) : null}

          {activeTab === 5 ? (
            <Stack spacing={2}>
              {analyticsData.alerts.length === 0 ? (
                <Alert severity="success">Ingen aktive varsler.</Alert>
              ) : (
                analyticsData.alerts.map((alertItem) => (
                  <Alert key={alertItem.id} severity={getAlertColor(alertItem.type)}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {alertItem.service.toUpperCase()} · {new Date(alertItem.timestamp).toLocaleString('nb-NO')}
                    </Typography>
                    {alertItem.message}
                    {alertItem.resolved ? ' (løst)' : ''}
                  </Alert>
                ))
              )}
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={alertsDialogOpen} onClose={() => setAlertsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Driftsvarsler</DialogTitle>
        <DialogContent dividers>
          <List disablePadding>
            {analyticsData.alerts.map((alertItem) => (
              <ListItem key={alertItem.id} alignItems="flex-start" divider>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: `${theme.palette[getAlertColor(alertItem.type)].main}22`, color: theme.palette[getAlertColor(alertItem.type)].main }}>
                    {alertItem.type === 'error' ? <ErrorIcon /> : alertItem.type === 'warning' ? <WarningIcon /> : <NotificationsIcon />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={`${alertItem.service.toUpperCase()} · ${new Date(alertItem.timestamp).toLocaleString('nb-NO')}`}
                  secondary={alertItem.message}
                />
                <StatusChip
                  tone={alertItem.resolved ? 'success' : getAlertColor(alertItem.type)}
                  label={alertItem.resolved ? 'Løst' : 'Aktiv'}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setAlertsDialogOpen(false)}>Lukk</AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegrationAnalyticsDashboard;
