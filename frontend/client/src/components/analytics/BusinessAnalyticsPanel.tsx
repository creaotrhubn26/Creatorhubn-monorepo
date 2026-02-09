import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Stack,
  Button,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  LinearProgress,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  People,
  Assessment,
  Refresh,
  Download
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useTheming } from '../../utils/theming-helper';

interface BusinessAnalyticsPanelProps {
  profession: string;
  userId: string;
}

interface RevenueData {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
  projectCount: number;
}

interface ClientMetrics {
  totalClients: number;
  newClients: number;
  retentionRate: number;
  averageValue: number;
  topClients: Array<{
    id: string;
    name: string;
    totalSpent: number;
    projectCount: number;
  }>;
}

interface PerformanceMetrics {
  completionRate: number;
  averageDeliveryTime: number;
  clientSatisfaction: number;
  profitMargin: number;
  growthRate: number;
  efficiency: number;
}

interface GrowthTracking {
  monthlyGrowth: number;
  yearlyGrowth: number;
  marketShare: number;
  competitorAnalysis: Array<{
    metric: string;
    value: number;
    industry: number;
  }>;
}

const BusinessAnalyticsPanel: React.FC<BusinessAnalyticsPanelProps> = ({ profession, userId }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [timeRange, setTimeRange] = useState('12m');

  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const theming = useTheming(profession);
  const professionConfig = professionConfigs?.[profession];

  const queryClient = useQueryClient();

  const { data: revenueData = [], isLoading: revenueLoading } = useQuery<RevenueData[]>({
    queryKey: ['/api/analytics/revenue', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/revenue?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: clientMetrics, isLoading: clientLoading } = useQuery<ClientMetrics>({
    queryKey: ['/api/analytics/clients', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/clients?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: performanceMetrics, isLoading: performanceLoading } = useQuery<PerformanceMetrics>({
    queryKey: ['/api/analytics/performance', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/performance?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const { data: growthTracking, isLoading: growthLoading } = useQuery<GrowthTracking>({
    queryKey: ['/api/analytics/growth', { profession, userId, range: timeRange }],
    queryFn: () =>
      apiRequest(
        `/api/analytics/growth?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(
          userId
        )}&range=${encodeURIComponent(timeRange)}`
      )
  });

  const exportReportMutation = useMutation({
    mutationFn: async (reportType: string) =>
      apiRequest('/api/analytics/export', {
        method: 'POST',
        body: {
          profession,
          userId,
          reportType,
          timeRange
        }
      }),
    onSuccess: (data) => {
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    }
  });

  const summaryCards = useMemo(
    () => [
      {
        label: 'Omsetning',
        value: revenueData.reduce((sum, row) => sum + row.revenue, 0),
        icon: <AttachMoney fontSize="small" />
      },
      {
        label: 'Prosjekter',
        value: revenueData.reduce((sum, row) => sum + row.projectCount, 0),
        icon: <Assessment fontSize="small" />
      },
      {
        label: 'Klienter',
        value: clientMetrics?.totalClients ?? 0,
        icon: <People fontSize="small" />
      }
    ],
    [clientMetrics?.totalClients, revenueData]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const loading = revenueLoading || clientLoading || performanceLoading || growthLoading;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {professionConfig ? `${professionConfig.displayName} - Business Analytics` : 'Business Analytics'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Oversikt over inntekt, klienter og ytelse
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small">
            <InputLabel id="analytics-range">Periode</InputLabel>
            <Select
              labelId="analytics-range"
              value={timeRange}
              label="Periode"
              onChange={(event) => setTimeRange(event.target.value)}
            >
              <MenuItem value="1m">1 mnd</MenuItem>
              <MenuItem value="3m">3 mnd</MenuItem>
              <MenuItem value="6m">6 mnd</MenuItem>
              <MenuItem value="12m">12 mnd</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/analytics'] })}>
            <Refresh />
          </IconButton>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => exportReportMutation.mutate('business')}
            disabled={exportReportMutation.isPending}
          >
            Eksporter
          </Button>
        </Stack>
      </Stack>

      {professionsLoading && <Typography variant="body2">Laster profesjonsdata...</Typography>}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2">Laster analyser...</Typography>
        </Box>
      )}

      <Grid container spacing={2} sx={{ mt: 2 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={4} key={card.label}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  {card.icon}
                  <Typography variant="caption" color="text.secondary">
                    {card.label}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {card.label === 'Omsetning' ? formatCurrency(card.value) : card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Tabs value={selectedTab} onChange={(_, value) => setSelectedTab(value)} sx={{ mt: 3 }}>
        <Tab label="Inntekter" />
        <Tab label="Klienter" />
        <Tab label="Ytelse" />
        <Tab label="Vekst" />
      </Tabs>

      {selectedTab === 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Inntekter og margin
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip
                  formatter={(value) =>
                    formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0))
                  }
                />
                <Legend />
                <Area type="monotone" dataKey="revenue" name="Omsetning" stroke={theming.colors.primary} fill={theming.colors.light} />
                <Area type="monotone" dataKey="profit" name="Resultat" stroke={theming.colors.accent} fill={theming.colors.secondary} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {selectedTab === 1 && clientMetrics && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Klientinnsikt
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Stack spacing={1}>
                  <Chip
                    label={`Nye klienter: ${clientMetrics.newClients}`}
                    color="success"
                    variant="outlined"
                    icon={<TrendingUp fontSize="small" />}
                  />
                  <Chip
                    label={`Retensjon: ${formatPercentage(clientMetrics.retentionRate)}`}
                    color="info"
                    variant="outlined"
                  />
                  <Chip
                    label={`Snittverdi: ${formatCurrency(clientMetrics.averageValue)}`}
                    color="primary"
                    variant="outlined"
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsBarChart data={clientMetrics.topClients} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={90} />
                    <RechartsTooltip
                      formatter={(value) =>
                        formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0))
                      }
                    />
                    <Bar dataKey="totalSpent" name="Omsetning" fill={theming.colors.primary} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {selectedTab === 2 && performanceMetrics && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Ytelsesindikatorer
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: 'Fullforing', value: performanceMetrics.completionRate },
                { label: 'Ytelseseffektivitet', value: performanceMetrics.efficiency },
                { label: 'Kundetilfredshet', value: performanceMetrics.clientSatisfaction },
                { label: 'Profit margin', value: performanceMetrics.profitMargin }
              ].map((metric) => (
                <Grid item xs={12} sm={6} key={metric.label}>
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(metric.value, 100)}
                      sx={{ height: 8, borderRadius: 2 }}
                    />
                    <Typography variant="body2">{formatPercentage(metric.value)}</Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {selectedTab === 3 && growthTracking && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Vekst og markedsandel
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Stack spacing={1}>
                  <Chip
                    label={`Maanedlig vekst: ${formatPercentage(growthTracking.monthlyGrowth)}`}
                    color={growthTracking.monthlyGrowth >= 0 ? 'success' : 'warning'}
                    icon={growthTracking.monthlyGrowth >= 0 ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
                  />
                  <Chip
                    label={`Aarvekst: ${formatPercentage(growthTracking.yearlyGrowth)}`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`Markedsandel: ${formatPercentage(growthTracking.marketShare)}`}
                    color="info"
                    variant="outlined"
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} md={8}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={growthTracking.competitorAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" name="Din bedrift" stroke={theming.colors.primary} />
                    <Line type="monotone" dataKey="industry" name="Bransjesnitt" stroke={theming.colors.secondary} />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {exportReportMutation.isPending && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          Genererer rapport...
        </Typography>
      )}
    </Box>
  );
};

export default BusinessAnalyticsPanel;
