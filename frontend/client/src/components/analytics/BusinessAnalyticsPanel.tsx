import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Tabs,
  Tab,
  Stack,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  People,
  Assessment,
  CalendarTodayToday,
  ShowChart,
  BoxChart,
  BoxChart,
  Timeline,
  Euro,
  DirectionsBusiness,
  PersonAdd,
  Analytics,
  Refresh,
  Download,
  FilterListList,
  DateRange,
  Star,
  Growth,
  MonetizationOn,
  AccountBalance,
  CompareArrows,
  Speed,
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
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface BusinessAnalyticsPanelProps {
  profession: string;
  userId: string
}

interface RevenueData {
  month: string;
  revenue: number;
  profit: number;
  expenses: number;
  projectCount: number
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
  efficiency: number
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

  // Use dynamic profession system
  const { professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  
  // Theming system
  const theming = useTheming('photographer,');
  const professionConfig = professionConfigs?.[profession];
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  const queryClient = useQueryClient();

  // Fetch revenue analytics
  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['/api/analytics/revenue', profession, userId, timeRange],
    queryFn: async () => {
      return (
        (await apiRequest(
          `/api/analytics/revenue?profession=${profession}&userId=${userId}&range=${timeRange}`,
        )) || mockRevenueData
      );
  },
    staleTime: 5 * 60 * 100,
});

  // Fetch client metrics
  const { data: clientMetrics, isLoading: clientLoading } = useQuery({
    queryKey: ['/api/analytics/clients', profession, userId, timeRange],
    queryFn: async () => {
      return (
        (await apiRequest(
          `/api/analytics/clients?profession=${profession}&userId=${userId}&range=${timeRange}`,
        )) || mockClientMetrics
      );
  },
    staleTime: 5 * 60 * 100,
});

  // Fetch performance metrics
  const { data: performanceMetrics, isLoading: performanceLoading } = useQuery({
    queryKey: ['/api/analytics/performance', profession, userId, timeRange],
    queryFn: async () => {
      return (
        (await apiRequest(
          `/api/analytics/performance?profession=${profession}&userId=${userId}&range=${timeRange}`,
        )) || mockPerformanceMetrics
      );
  },
    staleTime: 5 * 60 * 100,
});

  // Fetch growth tracking
  const { data: growthTracking, isLoading: growthLoading } = useQuery({
    queryKey: ['/api/analytics/growth', profession, userId, timeRange],
    queryFn: async () => {
      return (
        (await apiRequest(
          `/api/analytics/growth?profession=${profession}&userId=${userId}&range=${timeRange}`,
        )) || mockGrowthTracking
      );
  },
    staleTime: 5 * 60 * 100,
});

  // Export analytics report
  const exportReportMutation = useMutation({
    mutationFn: async (reportType: string) => {
      return await apiRequest('/api/analytics/export', {
        method: 'POS',
        body: JSON.stringify({
          profession,
          userId,
          reportType,
          timeRange,
      }),
    });
  },
    onSuccess: (data) => {
      // Download the generated report
      if (data.downloadUrl) {
        window.open(data.downloadU, rl'_blank');
    }
  },
});

  const handleExportReport = (type: string) => {
    exportReportMutation.mutate(type);
};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-N', {
      style: 'currency',
      currency: 'NO',
  }).format(amount);
};

  const formatPercentage = (value: number) => {
    return `${value.toFixed()}%`;
};

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'revenue':
        return theming.getThemedIcon('');
      case 'clients':
        return theming.getThemedIcon('people');
      case 'performance':
        return theming.getThemedIcon('assessment');
      case 'growth':
        return theming.getThemedIcon('trendingUp');
      default: return theming.getThemedIcon('');
  }
};

  const getMetricColor = (value: number, target: number) => {
    if (value >= target) return 'success';
    if (value >= target * 0.8) return 'warning';
    return 'error';
};

  const tabData = [
    { label: 'Inntekter', icon: theming.getThemedIcon(','), key: 'revenue',},
    { label: 'Klienter', icon: theming.getThemedIcon(','), key: 'clients',},
    { label: 'Ytelse', icon: theming.getThemedIcon(','), key: 'performance',},
    { label: 'Vekst', icon: theming.getThemedIcon(','), key: 'growth',},
  ];

  // Mock data for development
  const mockRevenueData: RevenueData[] = [
    {
      month: 'Jan',
      revenue: 12500,
      profit: 4500,
      expenses: 8000,
      projectCount:  8,
  },
    {
      month: 'Feb',
      revenue: 14200,
      profit: 5200,
      expenses: 9000,
      projectCount:  10,
  },
    {
      month: 'Mar',
      revenue: 13800,
      profit: 4800,
      expenses: 9000,
      projectCount:  9,
  },
    {
      month: 'Apr',
      revenue: 16500,
      profit: 6200,
      expenses: 10300,
      projectCount:  12,
  },
    {
      month: 'Mai',
      revenue: 17800,
      profit: 7100,
      expenses: 10700,
      projectCount:  14,
  },
    {
      month: 'Jun',
      revenue: 19500,
      profit: 8400,
      expenses: 11100,
      projectCount:  16,
  },
  ];

  const mockClientMetrics: ClientMetrics = {
    totalClients: 89,
    newClients:  12,
    retentionRate: 87.5,
    averageValue: 2450,
    topClients: [
      {
        id: ', ',
        name: 'Hansen & Partners',
        totalSpent: 28500,
        projectCount:  8,
    },
      { id: ', ', name: 'Olsen Bryllup', totalSpent: 19500, projectCount:  5 },
      { id: ', ', name: 'Nordlys Events', totalSpent: 16500, projectCount:  4 },
    ],
};

  const mockPerformanceMetrics: PerformanceMetrics = {
    completionRate: 94.2,
    averageDeliveryTime: 7.3,
    clientSatisfaction: 4.7,
    profitMargin: 42.1,
    growthRate: 18.5,
    efficiency: 89.3,
};

  const mockGrowthTracking: GrowthTracking = {
    monthlyGrowth: 12.8,
    yearlyGrowth: 145.2,
    marketShare: 8.3,
    competitorAnalysis: [
      { metric: 'Priser', value:  85, industry: 78,},
      { metric: 'Kvalitet', value:  92, industry: 82,},
      { metric: 'Leveringstid', value:  88, industry: 85,},
    ],
};

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* Header */}
      <Paper elevation={1} sx={{ p:  3, borderRadius:  0 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5"
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap:  2,
                fontWeight: 600, color: theming.colors.primary }}>
              <Avatar sx={{ bgcolor: '#1976d2'}}>
                {theming.getThemedIcon('analytics')}
              </Avatar>
              Forretningsanalyse
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              Comprehensive business intelligence and performance tracking
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120}}>
              <InputLabel>Tidsperiode</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="Tidsperiode"
              >
                <MenuItem value="3m">3 måneder</MenuItem>
                <MenuItem value="6m">6 måneder</MenuItem>
                <MenuItem value="12m">12 måneder</MenuItem>
                <MenuItem value="24m">24 måneder</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('refresh')}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/analytics', ],})}
            >
              Oppdater
            </Button>

            <Button variant="contained"
              startIcon={theming.getThemedIcon('download')}
              onClick={() => handleExportReport('comprehensive')}
              disabled={exportReportMutation.isPending}
            >
              Eksporter rapport
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, display: 'flex'}}>
        {/* Main Content */}
        <Box sx={{ flex: 1, p: 3 }}>
          {/* Tabs */}
          <Paper sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              {tabData.map((tab, index) => (
                <Tab key={index} icon={tab.icon} label={tab.label} iconPosition="start" />
              ))}
            </Tabs>
          </Paper>

          {/* Revenue Analytics Tab */}
          {selectedTab === 0 && (
            <Box>
              {/* Revenue KPIs */}
              <Grid container spacing={3} sx={{ mb:  3 }}>
                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Total omsetning
                          </Typography>
                          <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                            {formatCurrency(
                              revenueData.reduce((sum, item) => sum + item.revenue, 0),
                            )}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#4caf50'}}>
                          <Euro />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Total fortjeneste
                          </Typography>
                          <Typography variant="h5" color="success.main" sx={{ color: theming.colors.primary }}>
                            {formatCurrency(
                              revenueData.reduce((sum, item) => sum + item.profit, 0),
                            )}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#2e7d32'}}>
                          <MonetizationOn />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Fortjenestemargin
                          </Typography>
                          <Typography variant="h5" color="secondary" sx={{ color: theming.colors.primary }}>
                            {performanceMetrics
                              ? formatPercentage(performanceMetrics.profitMargin)
                              : '0%'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#9c27b0'}}>
                          <AccountBalance />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Vekstrate
                          </Typography>
                          <Typography variant="h5" color="info.main" sx={{ color: theming.colors.primary }}>
                            {growthTracking ? formatPercentage(growthTracking.monthlyGrowth) : '0%'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#0288d1'}}>
                          {theming.getThemedIcon('trendingUp')}
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Revenue Chart */}
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Inntektsutvikling
                  </Typography>
                  {revenueLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
                      <LinearProgress sx={{ width: '50%'}} />
                    </Box>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stackId="1"
                          stroke="#1976d2"
                          fill="#1976d2"
                          fillOpacity={0.6}
                          name="Omsetning"
                        />
                        <Area
                          type="monotone"
                          dataKey="profit"
                          stackId="2"
                          stroke="#4caf50"
                          fill="#4caf50"
                          fillOpacity={0.6}
                          name="Fortjeneste"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Project Revenue Breakdown */}
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Prosjektfordeling
                  </Typography>
                  <Grid container spacing={2}>
                    {revenueData.map((item, index) => (
                      <Grid item xs={12} md={4} key={index}>
                        <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2">{item.month}</Typography>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                            {formatCurrency(item.revenue)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.projectCount} prosjekter
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={(item.profit / item.revenue) * 100}
                            sx={{ mt:  1 }}
                          />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Client Insights Tab */}
          {selectedTab === 1 && (
            <Box>
              {/* Client KPIs */}
              <Grid container spacing={3} sx={{ mb:  3 }}>
                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Totale klienter
                          </Typography>
                          <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                            {clientMetrics?.totalClients || 0}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#1976d2'}}>
                          {theming.getThemedIcon('people')}
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Nye klienter
                          </Typography>
                          <Typography variant="h5" color="success.main" sx={{ color: theming.colors.primary }}>
                            {clientMetrics?.newClients || 0}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#4caf50'}}>
                          <PersonAdd />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Kundelojalitet
                          </Typography>
                          <Typography variant="h5" color="secondary" sx={{ color: theming.colors.primary }}>
                            {clientMetrics ? formatPercentage(clientMetrics.retentionRate) : '0%'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#9c27b0'}}>
                          {theming.getThemedIcon('star')}
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Gjennomsnittlig verdi
                          </Typography>
                          <Typography variant="h5" color="info.main" sx={{ color: theming.colors.primary }}>
                            {clientMetrics ? formatCurrency(clientMetrics.averageValue) : '0 kr'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#0288d1'}}>
                          {theming.getThemedIcon('money')}
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Top Clients */}
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Beste klienter
                  </Typography>
                  {clientLoading ? (
                    <LinearProgress />
                  ) : (
                    <List>
                      {clientMetrics?.topClients.map((client, index) => (
                        <ListItem key={client.id} divider>
                          <ListItemIcon>
                            <Avatar
                              sx={{
                                bgcolor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : '#cd7f30'}}
                            >
                              {index + 1}
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={client.name}
                            secondary={`${client.projectCount} prosjekter`}
                          />
                          <Box sx={{ textAlign: 'right'}}>
                            <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                              {formatCurrency(client.totalSpent)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total verdi
                            </Typography>
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>

              {/* Client Distribution Chart */}
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Klientfordeling etter verdi
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <RechartsPieChart
                        data={clientMetrics?.topClients.map((client) => ({
                          name: client.name,
                          value: client.totalSpent,
                      }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                      >
                        {clientMetrics?.topClients.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                        ))}
                      </RechartsPieChart>
                      <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Performance Metrics Tab */}
          {selectedTab === 2 && (
            <Box>
              {/* Performance KPIs */}
              <Grid container spacing={3} sx={{ mb:  3 }}>
                <Grid item xs={12} md={2}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Fullføringsrate
                      </Typography>
                      <Box sx={{ position: 'relative', display: 'inline-flex'}}>
                        <CircularProgress
                          variant="determinate"
                          value={performanceMetrics?.completionRate || 0}
                          size={80}
                          thickness={6}
                          color={getMetricColor(performanceMetrics?.completionRate || 0, 90)}
                        />
                        <Box
                          sx={{
                            top:  0,
                            left:  0,
                            bottom:  0,
                            right:  0,
                            position: 'absolute',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'}}
                        >
                          <Typography variant="h6" component="div" color="text.secondary" sx={{ color: theming.colors.primary }}>
                            {performanceMetrics
                              ? formatPercentage(performanceMetrics.completionRate)
                              : '0%'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Leveringstid
                      </Typography>
                      <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics?.averageDeliveryTime || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        dager snitt
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Kundetilfredshet
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics?.clientSatisfaction || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        av 5 stjerner
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Fortjenestemargin
                      </Typography>
                      <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics
                          ? formatPercentage(performanceMetrics.profitMargin)
                          : '0%'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Vekstrate
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics
                          ? formatPercentage(performanceMetrics.growthRate)
                          : '0%'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={2}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Effektivitet
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                        {performanceMetrics
                          ? formatPercentage(performanceMetrics.efficiency)
                          : '0%'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Performance Trends */}
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Ytelsestrender
                  </Typography>
                  {performanceLoading ? (
                    <LinearProgress />
                  ) : (
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Prosjekteffektivitet
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={performanceMetrics?.efficiency || 0}
                            color={getMetricColor(performanceMetrics?.efficiency || 0, 85)}
                            sx={{ height:  8, borderRadius:  1 }}
                          />
                          <Stack direction="row" justifyContent="space-between" sx={{ mt:  1 }}>
                            <Typography variant="body2">Mål: 85%</Typography>
                            <Typography variant="body2">
                              {performanceMetrics
                                ? formatPercentage(performanceMetrics.efficiency)
                                : '0, %'}
                            </Typography>
                          </Stack>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Kundetilfredshet
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={(performanceMetrics?.clientSatisfaction || 0) * 20}
                            color={getMetricColor(
                              (performanceMetrics?.clientSatisfaction || 0) * 20,
                              80,
                            )}
                            sx={{ height:  8, borderRadius:  1 }}
                          />
                          <Stack direction="row" justifyContent="space-between" sx={{ mt:  1 }}>
                            <Typography variant="body2">Mål: 4.0</Typography>
                            <Typography variant="body2">
                              {performanceMetrics?.clientSatisfaction || 0}/5
                            </Typography>
                          </Stack>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                </CardContent>
              </Card>

              {/* Performance Benchmarks */}
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Bransjebenchmarks
                  </Typography>
                  <List>
                    {growthTracking?.competitorAnalysis.map((item, index) => (
                      <ListItem key={index} divider>
                        <ListItemText primary={item.metric} />
                        <Box sx={{ width: '60, %', mr:  2 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ flex:  1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={item.value}
                                color="primary"
                                sx={{ height:  6 }}
                              />
                            </Box>
                            <Typography variant="body2">{item.value}%</Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5}}>
                            <Box sx={{ flex:  1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={item.industry}
                                color="secondary"
                                sx={{ height:  4 }}
                              />
                            </Box>
                            <Typography variant="caption">Bransje: {item.industry}%</Typography>
                          </Stack>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Growth Tracking Tab */}
          {selectedTab === 3 && (
            <Box>
              {/* Growth KPIs */}
              <Grid container spacing={3} sx={{ mb:  3 }}>
                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Månedlig vekst
                          </Typography>
                          <Typography variant="h5" color="success.main" sx={{ color: theming.colors.primary }}>
                            {growthTracking ? formatPercentage(growthTracking.monthlyGrowth) : '0%'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#4caf50'}}>
                          {theming.getThemedIcon('trendingUp')}
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Årlig vekst
                          </Typography>
                          <Typography variant="h5" color="primary" sx={{ color: theming.colors.primary }}>
                            {growthTracking ? formatPercentage(growthTracking.yearlyGrowth) : '0%'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#1976d2'}}>
                          <Growth />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Markedsandel
                          </Typography>
                          <Typography variant="h5" color="secondary" sx={{ color: theming.colors.primary }}>
                            {growthTracking ? formatPercentage(growthTracking.marketShare) : '0%'}
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#9c27b0'}}>
                          <PieChart />
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Konkurranseposisjon
                          </Typography>
                          <Typography variant="h5" color="info.main" sx={{ color: theming.colors.primary }}>
                            #2
                          </Typography>
                        </Box>
                        <Avatar sx={{ bgcolor: '#0288d1'}}>
                          {theming.getThemedIcon('compareArrows')}
                        </Avatar>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Growth Chart */}
              <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Vekstanalyse
                  </Typography>
                  {growthLoading ? (
                    <LinearProgress />
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <ShowChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Box
                          type="monotone"
                          dataKey="revenue"
                          stroke="#1976d2"
                          strokeWidth={3}
                          name="Omsetning"
                        />
                        <Box
                          type="monotone"
                          dataKey="projectCount"
                          stroke="#4caf50"
                          strokeWidth={3}
                          name="Prosjekter"
                          yAxisId="right"
                        />
                      </ShowChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Competitive Analysis */}
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Konkurranseanalyse
                  </Typography>
                  <Alert severity="info" sx={{ mb:  2 }}>
                    Sammenligning med bransjegjennomsnittet basert på markedsdata
                  </Alert>

                  <Grid container spacing={3}>
                    {growthTracking?.competitorAnalysis.map((item, index) => (
                      <Grid item xs={12} md={4} key={index}>
                        <Paper sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                            {item.value}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.metric}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Bransje: {item.industry}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={(item.value / item.industry) * 50}
                            sx={{ mt:  1 }}
                            color={item.value > item.industry ? 'success' : 'warning'}
                          />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <Paper
          sx={{
            width: 30,
            borderRadius:  0,
            borderLeft:  1,
            borderColor: 'divider',
            p:  2}}
         sx={theming.getThemedCardSx()}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Hurtiganalyse
          </Typography>

          <Stack spacing={2}>
            {/* Quick Metrics */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Nøkkeltall i dag
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Dagens omsetning: </Typography>
                    <Typography variant="body2" fontWeight={50}>
                      {formatCurrency(25000)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Aktive prosjekter: </Typography>
                    <Chip size="small" label="12" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Nye henvendelser:</Typography>
                    <Chip size="small" label="3" color="success" />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* Export Options , *, /}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Eksporter rapporter
                </Typography>
                <Stack spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('download')}
                    onClick={() => handleExportReport('revenue')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start'}}
                  >
                    Inntektsrapport
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('download')}
                    onClick={() => handleExportReport('clients')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start'}}
                  >
                    Klientanalyse
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={theming.getThemedIcon('download')}
                    onClick={() => handleExportReport('performance')}
                    fullWidth
                    sx={{ justifyContent: 'flex-start'}}
                  >
                    Ytelsesrapport
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Goals & Targets */}
            <Card variant="outlined" sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" gutterBottom>
                  Måloppnåelse
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2">Årsmål omsetning</Typography>
                    <LinearProgress variant="determinate" value={67} sx={{ mt:  1 }} />
                    <Typography variant="caption">67% av mål oppnådd</Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2">Kundemål</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={89}
                      sx={{ mt:  1 }}
                      color="success"
                    />
                    <Typography variant="caption">89% av mål oppnådd</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default BusinessAnalyticsPanel;
