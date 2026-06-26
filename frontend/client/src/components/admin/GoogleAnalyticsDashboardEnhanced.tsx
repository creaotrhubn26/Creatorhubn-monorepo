// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Grid from '@mui/material/Grid2';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AnalyticsOutlined,
  AutoGraphRounded,
  BookOnlineRounded,
  CheckCircleOutlineRounded,
  MailOutlineRounded,
  OpenInNewRounded,
  PersonAddAlt1Rounded,
  PublicRounded,
  RefreshRounded,
  TimelineRounded,
  VisibilityRounded,
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  apiRequest,
  isApiEndpointMissing,
} from '../../lib/queryClient';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface GoogleAnalyticsDashboardProps {
  hideHeader?: boolean;
}

type AnalyticsRangeKey = '7daysAgo' | '30daysAgo' | '90daysAgo';
type AnalyticsMetricKey =
  | 'totalEvents'
  | 'newUsers'
  | 'activeCreators'
  | 'pageViews'
  | 'bookings'
  | 'invitationsSent'
  | 'acceptedInvitations';

interface MetricDelta {
  current: number;
  previous: number;
  change: number;
}

interface OverviewResponse {
  range: {
    key: AnalyticsRangeKey;
    label: string;
    days: number;
    startDate: string;
    endDateExclusive: string;
  };
  freshness: {
    latestEventAt: string | null;
    latestUserLoginAt: string | null;
    daysSinceLatestEvent: number | null;
    hasDataInRange: boolean;
    isStale: boolean;
  };
  summary: {
    totalUsers: MetricDelta;
    newUsers: MetricDelta;
    activeCreators: MetricDelta;
    totalEvents: MetricDelta;
    pageViews: MetricDelta;
    bookings: MetricDelta;
    invitationsSent: MetricDelta;
    acceptedInvitations: MetricDelta;
    inviteAcceptanceRate: MetricDelta;
  };
  eventTypes: Array<{
    eventType: string;
    count: number;
    share: number;
  }>;
  topPages: Array<{
    page: string;
    count: number;
  }>;
  sources: Array<{
    source: string;
    count: number;
    share: number;
  }>;
  roles: Array<{
    role: string;
    count: number;
  }>;
  generatedAt: string;
}

interface TimeseriesResponse {
  metric: AnalyticsMetricKey;
  label: string;
  range: {
    key: AnalyticsRangeKey;
    label: string;
    days: number;
  };
  series: Array<{
    date: string;
    value: number;
  }>;
  totals: MetricDelta;
  generatedAt: string;
}

const rangeOptions: Array<{ key: AnalyticsRangeKey; label: string }> = [
  { key: '7daysAgo', label: '7 dager' },
  { key: '30daysAgo', label: '30 dager' },
  { key: '90daysAgo', label: '90 dager' },
];

const metricOptions: Array<{ key: AnalyticsMetricKey; label: string }> = [
  { key: 'totalEvents', label: 'Hendelser' },
  { key: 'pageViews', label: 'Sidevisninger' },
  { key: 'bookings', label: 'Bookinger' },
  { key: 'invitationsSent', label: 'Invitasjoner' },
  { key: 'acceptedInvitations', label: 'Akseptert' },
  { key: 'newUsers', label: 'Nye brukere' },
  { key: 'activeCreators', label: 'Aktive brukere' },
];

const shellBackground =
  'radial-gradient(circle at top right, rgba(255, 138, 61, 0.18) 0%, rgba(255, 138, 61, 0) 34%), linear-gradient(180deg, #171311 0%, #120f0d 100%)';
const surfaceBorder = '1px solid rgba(255, 166, 94, 0.16)';
const surfaceShadow = '0 24px 60px rgba(0, 0, 0, 0.28)';
const surfaceInset = 'inset 0 1px 0 rgba(255,255,255,0.04)';
const accent = '#ff8a3d';
const accentStrong = '#ff6b30';
const accentSoft = 'rgba(255, 138, 61, 0.14)';
const ink = '#fff6ed';
const mutedInk = 'rgba(255, 239, 224, 0.72)';
const success = '#61c976';
const danger = '#ff735c';
const chartGrid = 'rgba(255, 226, 198, 0.08)';
const surface = 'rgba(255,255,255,0.05)';
const surfaceElevated = 'rgba(255,255,255,0.07)';
const tableRow = 'rgba(255,255,255,0.035)';

function formatNumber(value: number): string {
  return value.toLocaleString('nb-NO');
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('nb-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatMetric(value: number, kind: 'number' | 'percent') {
  return kind === 'percent' ? formatPercent(value) : formatNumber(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'Ikke registrert';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Ikke registrert';
  }

  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDay(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
  });
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getTrendTone(change: number) {
  if (change > 0) {
    return {
      color: success,
      prefix: '+',
      label: 'opp fra forrige periode',
    };
  }

  if (change < 0) {
    return {
      color: danger,
      prefix: '',
      label: 'ned fra forrige periode',
    };
  }

  return {
    color: mutedInk,
    prefix: '',
    label: 'uendret fra forrige periode',
  };
}

function PlaceholderTable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Box
      sx={{
        borderRadius: '24px',
        border: surfaceBorder,
        background: surface,
        boxShadow: surfaceShadow,
        backdropFilter: 'blur(16px)',
        p: 3,
        minHeight: 260,
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, color: ink, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: mutedInk, maxWidth: 440 }}>
        {description}
      </Typography>
    </Box>
  );
}

export default function GoogleAnalyticsDashboardEnhanced({
  hideHeader = false,
}: GoogleAnalyticsDashboardProps) {
  const { auth } = useEnhancedMasterIntegration();
  const [dateRange, setDateRange] = useState<AnalyticsRangeKey>('90daysAgo');
  const [selectedMetric, setSelectedMetric] =
    useState<AnalyticsMetricKey>('totalEvents');

  const {
    data: overviewData,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery<OverviewResponse>({
    queryKey: ['/api/analytics/overview', dateRange],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/analytics/overview?startDate=${dateRange}`, {
        headers,
      });
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const {
    data: timeseriesData,
    isLoading: timeseriesLoading,
    isFetching: timeseriesFetching,
    error: timeseriesError,
    refetch: refetchTimeseries,
  } = useQuery<TimeseriesResponse>({
    queryKey: ['/api/analytics/timeseries', dateRange, selectedMetric],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(
        `/api/analytics/timeseries?metric=${selectedMetric}&startDate=${dateRange}`,
        { headers },
      );
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const loading = overviewLoading || timeseriesLoading;
  const fetching = overviewFetching || timeseriesFetching;
  const missingFeed =
    isApiEndpointMissing(overviewError) || isApiEndpointMissing(timeseriesError);
  const fatalError = overviewError || timeseriesError;

  const metricCards = useMemo(
    () =>
      overviewData
        ? [
            {
              key: 'totalUsers',
              label: 'Brukere totalt',
              icon: <PublicRounded sx={{ color: accent }} />,
              metric: overviewData.summary.totalUsers,
              kind: 'number' as const,
              helper: 'Alle profiler i CreatorHub',
            },
            {
              key: 'newUsers',
              label: 'Nye brukere',
              icon: <PersonAddAlt1Rounded sx={{ color: accent }} />,
              metric: overviewData.summary.newUsers,
              kind: 'number' as const,
              helper: overviewData.range.label,
            },
            {
              key: 'activeCreators',
              label: 'Aktive brukere',
              icon: <TimelineRounded sx={{ color: accent }} />,
              metric: overviewData.summary.activeCreators,
              kind: 'number' as const,
              helper: 'Innlogging eller aktivitet i perioden',
            },
            {
              key: 'pageViews',
              label: 'Sidevisninger',
              icon: <VisibilityRounded sx={{ color: accent }} />,
              metric: overviewData.summary.pageViews,
              kind: 'number' as const,
              helper: 'Fra eventloggen',
            },
            {
              key: 'bookings',
              label: 'Bookinger',
              icon: <BookOnlineRounded sx={{ color: accent }} />,
              metric: overviewData.summary.bookings,
              kind: 'number' as const,
              helper: 'booking_created',
            },
            {
              key: 'totalEvents',
              label: 'Hendelser',
              icon: <AnalyticsOutlined sx={{ color: accent }} />,
              metric: overviewData.summary.totalEvents,
              kind: 'number' as const,
              helper: 'Alle registrerte CreatorHub-events',
            },
            {
              key: 'invitationsSent',
              label: 'Invitasjoner sendt',
              icon: <MailOutlineRounded sx={{ color: accent }} />,
              metric: overviewData.summary.invitationsSent,
              kind: 'number' as const,
              helper: 'invitation_sent',
            },
            {
              key: 'inviteAcceptanceRate',
              label: 'Akseptgrad',
              icon: <CheckCircleOutlineRounded sx={{ color: accent }} />,
              metric: overviewData.summary.inviteAcceptanceRate,
              kind: 'percent' as const,
              helper: 'Aksepterte invitasjoner delt på sendt',
            },
          ]
        : [],
    [overviewData],
  );

  const seriesPoints = useMemo(
    () => (Array.isArray(timeseriesData?.series) ? timeseriesData.series : []),
    [timeseriesData],
  );

  const roles = useMemo(
    () => (Array.isArray(overviewData?.roles) ? overviewData.roles : []),
    [overviewData],
  );
  const sources = useMemo(
    () => (Array.isArray(overviewData?.sources) ? overviewData.sources : []),
    [overviewData],
  );
  const eventTypes = useMemo(
    () => (Array.isArray(overviewData?.eventTypes) ? overviewData.eventTypes.slice(0, 5) : []),
    [overviewData],
  );
  const topPages = useMemo(
    () => (Array.isArray(overviewData?.topPages) ? overviewData.topPages.slice(0, 5) : []),
    [overviewData],
  );
  const primaryMetricCards = useMemo(() => metricCards.slice(0, 4), [metricCards]);
  const secondaryMetricCards = useMemo(() => metricCards.slice(4), [metricCards]);

  const handleRefresh = () => {
    void Promise.all([refetchOverview(), refetchTimeseries()]);
  };

  const openGa4 = () => {
    if (typeof window === 'undefined') return;
    window.open('https://analytics.google.com/analytics/web/', '_blank', 'noopener,noreferrer');
  };

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: '32px',
        border: `1px solid ${alpha(accent, 0.16)}`,
        background: shellBackground,
        boxShadow: '0 32px 80px rgba(0, 0, 0, 0.34)',
        p: { xs: 2.5, md: 4 },
        overflow: 'hidden',
      }}
    >
      {fetching ? (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            '& .MuiLinearProgress-bar': {
              backgroundColor: accent,
            },
          }}
        />
      ) : null}

      {!hideHeader ? (
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
          spacing={2.5}
          sx={{ mb: 3 }}
        >
          <Box sx={{ maxWidth: 760 }}>
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '2.75rem', md: '4.75rem' },
                lineHeight: 0.94,
                fontWeight: 900,
                color: ink,
                letterSpacing: '-0.03em',
                mb: 1.25,
                whiteSpace: 'pre-line',
              }}
            >
              {'Analytics\nDashboard'}
            </Typography>
            <Chip
              label="CreatorHub live-data"
              sx={{
                borderRadius: '999px',
                bgcolor: accentSoft,
                color: accent,
                fontWeight: 800,
                mb: 1.5,
                border: `1px solid ${alpha(accent, 0.25)}`,
              }}
            />
            <Typography
              variant="body1"
              sx={{
                color: mutedInk,
                maxWidth: 560,
                lineHeight: 1.7,
              }}
            >
              Operativ flate bygget p&aring; ekte CreatorHub-aktivitet fra bruker-
              og eventtabellene. Tallene er ikke hardkodet, og flaten markerer
              tydelig n&aring;r datagrunnlaget er ferskt eller trenger oppf&oslash;lging.
            </Typography>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ width: { xs: '100%', lg: 'auto' } }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: 1,
                p: 0.75,
                borderRadius: '18px',
                border: surfaceBorder,
                backgroundColor: surface,
                boxShadow: surfaceInset,
              }}
            >
              {rangeOptions.map((option) => {
                const active = option.key === dateRange;
                return (
                  <Button
                    key={option.key}
                    onClick={() => setDateRange(option.key)}
                    variant="text"
                    sx={{
                      minWidth: 0,
                      px: 2,
                      py: 1,
                      borderRadius: '14px',
                      color: active ? '#14110f' : ink,
                      background: active
                        ? `linear-gradient(135deg, ${accentStrong} 0%, ${accent} 100%)`
                        : 'transparent',
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: active
                        ? '0 14px 30px rgba(255, 107, 48, 0.24)'
                        : 'none',
                      '&:hover': {
                        backgroundColor: active
                          ? accentStrong
                          : alpha(accent, 0.08),
                      },
                    }}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </Box>

            <Button
              variant="outlined"
              onClick={handleRefresh}
              startIcon={<RefreshRounded />}
              sx={{
                alignSelf: 'stretch',
                borderRadius: '18px',
                borderColor: alpha(accent, 0.28),
                color: ink,
                px: 2.25,
                textTransform: 'none',
                fontWeight: 700,
                backgroundColor: surface,
                '&:hover': {
                  borderColor: accent,
                  backgroundColor: alpha(accent, 0.06),
                },
              }}
            >
              Oppdater
            </Button>
            <Button
              variant="contained"
              onClick={openGa4}
              endIcon={<OpenInNewRounded />}
              sx={{
                alignSelf: 'stretch',
                borderRadius: '18px',
                px: 2.25,
                textTransform: 'none',
                fontWeight: 800,
                color: '#171311',
                background: `linear-gradient(135deg, ${accentStrong} 0%, ${accent} 100%)`,
                boxShadow: '0 16px 36px rgba(255, 107, 48, 0.28)',
                '&:hover': {
                  background: `linear-gradient(135deg, ${accentStrong} 0%, ${accentStrong} 100%)`,
                },
              }}
            >
              Open in GA4
            </Button>
          </Stack>
        </Stack>
      ) : null}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 3 }}
      >
        <Chip
          label={overviewData?.range.label ?? 'Laster datointervall'}
          sx={{
            borderRadius: '999px',
            bgcolor: accentSoft,
            color: accent,
            fontWeight: 700,
            border: `1px solid ${alpha(accent, 0.24)}`,
          }}
        />
        <Chip
          icon={<AutoGraphRounded sx={{ color: accent }} />}
          label={
            overviewData?.freshness.latestEventAt
              ? `Siste aktivitet ${formatDate(overviewData.freshness.latestEventAt)}`
              : 'Ingen aktivitet registrert ennå'
          }
          sx={{
            borderRadius: '999px',
            bgcolor: surface,
            color: ink,
            border: surfaceBorder,
            fontWeight: 600,
          }}
        />
        {overviewData?.freshness.isStale ? (
          <Chip
            icon={<TimelineRounded sx={{ color: danger }} />}
            label={`Eldre datagrunnlag${
              overviewData.freshness.daysSinceLatestEvent !== null
                ? ` (${overviewData.freshness.daysSinceLatestEvent} dager siden)`
                : ''
            }`}
            sx={{
              borderRadius: '999px',
              bgcolor: alpha(danger, 0.1),
              color: danger,
              fontWeight: 700,
              border: `1px solid ${alpha(danger, 0.28)}`,
            }}
          />
        ) : null}
      </Stack>

      {missingFeed ? (
        <Alert severity="info" sx={{ mb: 3, borderRadius: '20px' }}>
          Analytics-feedene ruller ut. Frontenden er klar, men backend-endepunktene
          er ikke live i denne instansen enn&aring;.
        </Alert>
      ) : fatalError ? (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '20px' }}>
          Analyticsflaten kunne ikke lastes akkurat n&aring;. Pr&oslash;v p&aring;
          nytt, eller sjekk backend-loggene hvis feilen vedvarer.
        </Alert>
      ) : null}

      {overviewData?.freshness.isStale ? (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: '20px' }}
        >
          Aktiviteten i valgt periode er eldre enn vanlig. Tallene er ekte, men
          dette miljøet har lite ferske CreatorHub-events akkurat n&aring;.
        </Alert>
      ) : null}

      {loading && !overviewData ? (
        <Box sx={{ py: 6 }}>
          <LinearProgress
            sx={{
              borderRadius: '999px',
              '& .MuiLinearProgress-bar': { backgroundColor: accent },
            }}
          />
        </Box>
      ) : null}

      {overviewData ? (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Grid container spacing={2}>
                {primaryMetricCards.map((item) => {
                  const trend = getTrendTone(item.metric.change);
                  return (
                    <Grid key={item.key} size={{ xs: 12, sm: 6 }}>
                      <Box
                        sx={{
                          height: '100%',
                          minHeight: 210,
                          borderRadius: '28px',
                          border: surfaceBorder,
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                          boxShadow: surfaceShadow,
                          backdropFilter: 'blur(18px)',
                          p: 2.5,
                          transition:
                            'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 26px 56px rgba(0,0,0,0.34)',
                            borderColor: alpha(accent, 0.28),
                          },
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" spacing={2}>
                          <Box
                            sx={{
                              width: 46,
                              height: 46,
                              borderRadius: '16px',
                              bgcolor: accentSoft,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              border: `1px solid ${alpha(accent, 0.18)}`,
                            }}
                          >
                            {item.icon}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: accent,
                              fontWeight: 700,
                              textAlign: 'right',
                              maxWidth: 150,
                            }}
                          >
                            {item.label}
                          </Typography>
                        </Stack>

                        <Typography
                          variant="h2"
                          sx={{
                            color: ink,
                            fontWeight: 900,
                            letterSpacing: '-0.05em',
                            lineHeight: 0.94,
                            mt: 3,
                            mb: 2,
                          }}
                        >
                          {formatMetric(item.metric.current, item.kind)}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            color: trend.color,
                            fontWeight: 800,
                            mb: 0.75,
                          }}
                        >
                          {trend.prefix}
                          {formatPercent(item.metric.change)}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{ color: mutedInk, maxWidth: 200, lineHeight: 1.75 }}
                        >
                          vs forrige periode ({formatMetric(item.metric.previous, item.kind)})
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>

            <Grid size={{ xs: 12, lg: 7 }}>
              <Box
                sx={{
                  borderRadius: '32px',
                  border: surfaceBorder,
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
                  boxShadow: surfaceShadow,
                  backdropFilter: 'blur(18px)',
                  p: 3,
                  minHeight: 452,
                  height: '100%',
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  sx={{ mb: 3 }}
                >
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: ink }}>
                      {timeseriesData?.label ?? 'Aktivitet'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: mutedInk, mt: 0.75 }}>
                      Trend for {timeseriesData?.label?.toLowerCase() ?? 'valgt metric'} gjennom{' '}
                      {overviewData.range.label.toLowerCase()}.
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {metricOptions.map((option) => {
                      const active = option.key === selectedMetric;
                      return (
                        <Button
                          key={option.key}
                          onClick={() => setSelectedMetric(option.key)}
                          variant="text"
                          sx={{
                            minWidth: 0,
                            px: 1.5,
                            py: 0.9,
                            borderRadius: '999px',
                            textTransform: 'none',
                            fontWeight: 700,
                            color: active ? '#14110f' : ink,
                            background: active
                              ? `linear-gradient(135deg, ${accentStrong} 0%, ${accent} 100%)`
                              : surface,
                            border: active ? 'none' : surfaceBorder,
                            '&:hover': {
                              backgroundColor: active
                                ? accentStrong
                                : alpha(accent, 0.08),
                            },
                          }}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </Stack>
                </Stack>

                {seriesPoints.some((point) => point.value > 0) ? (
                  <Box sx={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={seriesPoints}>
                        <defs>
                          <linearGradient id="creatorhubAnalyticsArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={accentStrong} stopOpacity={0.45} />
                            <stop offset="95%" stopColor={accentStrong} stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={chartGrid} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#f4b27d', fontSize: 12 }}
                          tickFormatter={formatShortDay}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#f4b27d', fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatNumber(value),
                            timeseriesData?.label ?? 'Verdi',
                          ]}
                          labelFormatter={(value: string) => formatDate(value)}
                          contentStyle={{
                            borderRadius: 18,
                            border: surfaceBorder,
                            boxShadow: surfaceShadow,
                            color: ink,
                            background: '#181311',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={accentStrong}
                          fill="url(#creatorhubAnalyticsArea)"
                          strokeWidth={3}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      height: 320,
                      borderRadius: '24px',
                      bgcolor: alpha(accent, 0.05),
                      display: 'grid',
                      placeItems: 'center',
                      textAlign: 'center',
                      p: 3,
                    }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: ink, mb: 1 }}>
                        Ingen aktivitet i valgt periode
                      </Typography>
                      <Typography variant="body2" sx={{ color: mutedInk, maxWidth: 420 }}>
                        Det finnes ingen registrerte verdier for{' '}
                        {timeseriesData?.label?.toLowerCase() ?? 'dette metricet'} i
                        {` ${overviewData.range.label.toLowerCase()}`}. Bytt til 90 dager
                        for lengre historikk eller vent p&aring; nye CreatorHub-events.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {secondaryMetricCards.map((item) => {
              const trend = getTrendTone(item.metric.change);
              return (
                <Grid key={item.key} size={{ xs: 12, md: 4 }}>
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: '28px',
                      border: surfaceBorder,
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                      boxShadow: surfaceShadow,
                      backdropFilter: 'blur(18px)',
                      p: 2.5,
                      transition:
                        'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 24px 52px rgba(0,0,0,0.34)',
                        borderColor: alpha(accent, 0.26),
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                      <Box>
                        <Typography
                          variant="body2"
                          sx={{
                            color: mutedInk,
                            fontWeight: 700,
                            letterSpacing: '0.01em',
                            mb: 0.75,
                          }}
                        >
                          {item.label}
                        </Typography>
                        <Typography
                          variant="h4"
                          sx={{
                            color: ink,
                            fontWeight: 800,
                            letterSpacing: '-0.03em',
                            mb: 0.75,
                          }}
                        >
                          {formatMetric(item.metric.current, item.kind)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: '16px',
                          bgcolor: accentSoft,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          border: `1px solid ${alpha(accent, 0.18)}`,
                        }}
                      >
                        {item.icon}
                      </Box>
                    </Stack>

                    <Typography
                      variant="body2"
                      sx={{
                        color: trend.color,
                        fontWeight: 700,
                        mb: 0.75,
                      }}
                    >
                      {trend.prefix}
                      {formatPercent(item.metric.change)} {trend.label}
                    </Typography>

                    <Typography variant="caption" sx={{ color: mutedInk }}>
                      Forrige periode: {formatMetric(item.metric.previous, item.kind)}
                      {' · '}
                      {item.helper}
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Box
                sx={{
                  height: '100%',
                  borderRadius: '28px',
                  border: surfaceBorder,
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
                  boxShadow: surfaceShadow,
                  backdropFilter: 'blur(18px)',
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: ink }}>
                    Datakvalitet
                  </Typography>
                  <Typography variant="body2" sx={{ color: mutedInk, mt: 0.5 }}>
                    Hva som faktisk ligger bak tallene i denne flaten.
                  </Typography>
                </Box>

                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" sx={{ color: mutedInk, fontWeight: 700 }}>
                      Siste event
                    </Typography>
                    <Typography variant="body1" sx={{ color: ink, fontWeight: 700 }}>
                      {formatDate(overviewData.freshness.latestEventAt)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: mutedInk, fontWeight: 700 }}>
                      Siste innlogging registrert
                    </Typography>
                    <Typography variant="body1" sx={{ color: ink, fontWeight: 700 }}>
                      {formatDate(overviewData.freshness.latestUserLoginAt)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: mutedInk, fontWeight: 700 }}>
                      Datakilder
                    </Typography>
                    <Typography variant="body1" sx={{ color: ink, fontWeight: 700 }}>
                      `creatorhub_users` og `creatorhub_analytics_events`
                    </Typography>
                  </Box>
                </Stack>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: ink, mb: 1.5 }}>
                    Rollefordeling
                  </Typography>
                  <Stack spacing={1}>
                    {roles.length > 0 ? (
                      roles.map((role) => (
                        <Stack
                          key={role.role}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{
                            px: 1.5,
                            py: 1.1,
                            borderRadius: '16px',
                            bgcolor: tableRow,
                          }}
                        >
                          <Typography variant="body2" sx={{ color: ink, fontWeight: 600 }}>
                            {formatLabel(role.role)}
                          </Typography>
                          <Chip
                            size="small"
                            label={formatNumber(role.count)}
                            sx={{
                              bgcolor: accentSoft,
                              color: ink,
                              fontWeight: 700,
                            }}
                          />
                        </Stack>
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ color: mutedInk }}>
                        Ingen rolledata registrert enn&aring;.
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: ink, mb: 1.5 }}>
                    Aktivitetskilder
                  </Typography>
                  <Stack spacing={1}>
                    {sources.length > 0 ? (
                      sources.slice(0, 4).map((source) => (
                        <Stack
                          key={source.source}
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography variant="body2" sx={{ color: ink, fontWeight: 600 }}>
                            {formatLabel(source.source)}
                          </Typography>
                          <Typography variant="body2" sx={{ color: mutedInk }}>
                            {formatNumber(source.count)} · {formatPercent(source.share)}
                          </Typography>
                        </Stack>
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ color: mutedInk }}>
                        Ingen kildefordeling registrert enn&aring;.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              {eventTypes.length > 0 ? (
                <Box
                  sx={{
                    borderRadius: '24px',
                    border: surfaceBorder,
                    background: surface,
                    boxShadow: surfaceShadow,
                    backdropFilter: 'blur(16px)',
                    p: 3,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, color: ink, mb: 2 }}>
                    Topp hendelser
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: mutedInk, fontWeight: 700 }}>
                            Hendelse
                          </TableCell>
                          <TableCell sx={{ color: mutedInk, fontWeight: 700 }}>
                            Antall
                          </TableCell>
                          <TableCell sx={{ color: mutedInk, fontWeight: 700 }}>
                            Andel
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {eventTypes.map((row) => (
                          <TableRow key={row.eventType}>
                            <TableCell sx={{ borderColor: chartGrid, color: ink }}>
                              {formatLabel(row.eventType)}
                            </TableCell>
                            <TableCell sx={{ borderColor: chartGrid, color: ink, fontWeight: 700 }}>
                              {formatNumber(row.count)}
                            </TableCell>
                            <TableCell sx={{ borderColor: chartGrid, color: mutedInk }}>
                              {formatPercent(row.share)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <PlaceholderTable
                  title="Topp hendelser"
                  description="Det finnes ingen eventtyper i valgt periode enn&aring;."
                />
              )}
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
              {topPages.length > 0 ? (
                <Box
                  sx={{
                    borderRadius: '24px',
                    border: surfaceBorder,
                    background: surface,
                    boxShadow: surfaceShadow,
                    backdropFilter: 'blur(16px)',
                    p: 3,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 800, color: ink, mb: 2 }}>
                    Mest viste sider
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ color: mutedInk, fontWeight: 700 }}>
                            Side
                          </TableCell>
                          <TableCell sx={{ color: mutedInk, fontWeight: 700 }}>
                            Sidevisninger
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topPages.map((row) => (
                          <TableRow key={row.page}>
                            <TableCell sx={{ borderColor: chartGrid, color: ink }}>
                              {row.page}
                            </TableCell>
                            <TableCell sx={{ borderColor: chartGrid, color: ink, fontWeight: 700 }}>
                              {formatNumber(row.count)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : (
                <PlaceholderTable
                  title="Mest viste sider"
                  description="Det finnes ingen sidevisninger i valgt periode enn&aring;."
                />
              )}
            </Grid>
          </Grid>
        </>
      ) : null}
    </Box>
  );
}
