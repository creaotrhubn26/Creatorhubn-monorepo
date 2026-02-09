/**
 * Enhanced Google Analytics 4 Dashboard Component
 * Inspired by modern analytics dashboard design
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  ButtonGroup,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Avatar
} from '@mui/material';
import {
  Analytics,
  TrendingUp,
  TrendingDown,
  People,
  Visibility,
  Timeline,
  AttachMoney,
  Event,
  Share,
  OpenInNew,
  Refresh,
  DateRange,
  Public,
  Language,
  AutoAwesome,
  Psychology,
  Settings
} from '@mui/icons-material';
import AIAnalyticsInsights from './AIAnalyticsInsights';
import GA4AutomationDashboard from './GA4AutomationDashboard';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface GoogleAnalyticsDashboardProps {
  hideHeader?: boolean;
}

export default function GoogleAnalyticsDashboardEnhanced({ hideHeader = false }: GoogleAnalyticsDashboardProps) {
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();

  // Date range control
  const [dateRange, setDateRange] = useState<'7daysAgo' | '30daysAgo' | '90daysAgo'>('30daysAgo');

  // Selected metric for chart
  const [selectedMetric, setSelectedMetric] = useState<'activeUsers' | 'sessions' | 'pageViews' | 'conversions'>('activeUsers');

  // AI insights toggle
  const [showAIInsights, setShowAIInsights] = useState(true);

  // Automation dashboard toggle
  const [showAutomation, setShowAutomation] = useState(false);

  // Enhanced styling inspired by the design
  const dashboardTheme = {
    background: '#1a1a1a',
    cardBackground: '#2d2d2d',
    primary: '#ff6b35',
    secondary: '#ffa726',
    text: '#ffffff',
    textSecondary: '#ffa726',
    success: '#4caf50',
    error: '#f44336',
    border: '#404040',
    gradient: 'linear-gradient(135deg, #ff6b35 0%, #ffa726 100%)'
  };

  // Fetch real-time data
  const { data: realtimeData, refetch: refetchRealtime } = useQuery({
    queryKey: ['/api/analytics/realtime'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/analytics/realtime', { headers });
    },
    refetchInterval: 30000,
    staleTime: 0
  });

  // Fetch overview data
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['/api/analytics/overview', dateRange],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/analytics/overview?startDate=${dateRange}&endDate=today`, { headers });
    },
    refetchInterval: 60000,
    staleTime: 0
  });

  // Fetch time series data for chart
  const { data: timeSeriesData } = useQuery({
    queryKey: ['/api/analytics/timeseries', selectedMetric, dateRange],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/analytics/timeseries?metric=${selectedMetric}&startDate=${dateRange}&endDate=today`, { headers });
    },
    refetchInterval: 60000,
    staleTime: 0
  });

  // Fetch traffic sources
  const { data: trafficSourcesData } = useQuery({
    queryKey: ['/api/analytics/traffic-sources', dateRange],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/analytics/traffic-sources?startDate=${dateRange}&endDate=today`, { headers });
    },
    refetchInterval: 60000,
    staleTime: 0
  });

  // Fetch top events
  const { data: topEventsData } = useQuery({
    queryKey: ['/api/analytics/top-events', dateRange],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/analytics/top-events?startDate=${dateRange}&endDate=today`, { headers });
    },
    refetchInterval: 60000,
    staleTime: 0
  });

  // Fetch top pages
  const { data: topPagesData } = useQuery({
    queryKey: ['/api/analytics/top-pages', dateRange],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/analytics/top-pages?startDate=${dateRange}&endDate=today`, { headers });
    },
    refetchInterval: 60000,
    staleTime: 0
  });

  const handleRefresh = () => {
    refetchRealtime();
  };

  // Mock data for development (matches inspiration structure)
  const mockUserMetrics = [
    {
      title: "New Users",
      value: "322",
      change: -55,
      previousValue: "709",
      icon: <People sx={{ color: dashboardTheme.primary }} />
    },
    {
      title: "1-Day Active Users", 
      value: "679",
      change: -15,
      previousValue: "796",
      icon: <Timeline sx={{ color: dashboardTheme.primary }} />
    },
    {
      title: "7-Day Active Users",
      value: "282", 
      change: -45,
      previousValue: "510",
      icon: <Event sx={{ color: dashboardTheme.primary }} />
    },
    {
      title: "28-Day Active Users",
      value: "709",
      change: 104,
      previousValue: "347",
      icon: <Visibility sx={{ color: dashboardTheme.primary }} />
    }
  ];

  const mockRevenueMetrics = [
    {
      title: "Total Revenue",
      value: "$ 849",
      change: -13,
      previousValue: "$ 971",
      icon: <AttachMoney sx={{ color: dashboardTheme.success }} />
    },
    {
      title: "Total Revenue per User",
      value: "$ 883.00",
      change: 77,
      previousValue: "$ 499.00",
      icon: <People sx={{ color: dashboardTheme.success }} />
    }
  ];

  const mockCountriesData = [
    { country: "Croatia", value: 993, change: 49 },
    { country: "Finland", value: 976, change: 184 },
    { country: "Korea", value: 968, change: 463 },
    { country: "Antigua and Barbuda", value: 964, change: 216 },
    { country: "Saint Martin", value: 914, change: 218 }
  ];

  const mockSourcesData = [
    { source: "yahoo", value: 879, change: 19 },
    { source: "google", value: 814, change: 58 },
    { source: "(not set)", value: 791, change: 215 },
    { source: "bing", value: 521, change: -14 },
    { source: "(direct)", value: 241, change: -73 }
  ];

  // Mock chart data
  const mockChartData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    users: Math.floor(Math.random() * 200) + 600,
    sessions: Math.floor(Math.random() * 300) + 800,
    pageViews: Math.floor(Math.random() * 500) + 1200,
    conversions: Math.floor(Math.random() * 20) + 5
  }));

  const getDateRangeLabel = () => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
      case '7daysAgo':
        startDate.setDate(endDate.getDate() - 7);
        return `Last 7 days (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      case '30daysAgo':
        startDate.setDate(endDate.getDate() - 30);
        return `Last 30 days (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      case '90daysAgo':
        startDate.setDate(endDate.getDate() - 90);
        return `Last 90 days (${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
      default:
        return 'Last 30 days';
    }
  };

  return (
    <Box sx={{ 
      background: dashboardTheme.background,
      borderRadius: 3,
      p: 4,
      mb: 3,
      minHeight: '100vh'
    }}>
      {/* Header */}
      {!hideHeader && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: dashboardTheme.text }}>
              Analytics Dashboard
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant={showAutomation ? 'contained' : 'outlined'}
                startIcon={<Settings />}
                onClick={() => setShowAutomation(!showAutomation)}
                sx={{ 
                  borderColor: dashboardTheme.primary, 
                  color: dashboardTheme.primary, '&:hover': { borderColor: dashboardTheme.secondary },
                  ...(showAutomation && {
                    background: dashboardTheme.gradient,
                    color: '#ffffff','&:hover': { background: dashboardTheme.primary }
                  })
                }}
              >
                Automation
              </Button>
              <Button
                variant={showAIInsights ? 'contained' : 'outlined'}
                startIcon={<AutoAwesome />}
                onClick={() => setShowAIInsights(!showAIInsights)}
                sx={{ 
                  borderColor: dashboardTheme.primary, 
                  color: dashboardTheme.primary, '&:hover': { borderColor: dashboardTheme.secondary },
                  ...(showAIInsights && {
                    background: dashboardTheme.gradient,
                    color: '#ffffff','&:hover': { background: dashboardTheme.primary }
                  })
                }}
              >
                AI Insights
              </Button>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
                sx={{ 
                  borderColor: dashboardTheme.primary, 
                  color: dashboardTheme.primary,
                  '&:hover': { borderColor: dashboardTheme.secondary }
                }}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                endIcon={<OpenInNew />}
                onClick={() => window.open('https://analytics.google.com/', '_blank')}
                sx={{ 
                  background: dashboardTheme.gradient,
                  '&:hover': { background: dashboardTheme.primary }
                }}
              >
                Open in GA4
              </Button>
            </Box>
          </Box>
          <Typography variant="body1" sx={{ color: dashboardTheme.textSecondary }}>
            {getDateRangeLabel()}
          </Typography>
        </Box>
      )}

      {/* Date Range Controls */}
      <Box sx={{ mb: 4 }}>
        <ToggleButtonGroup
          value={dateRange}
          exclusive
          onChange={(_, newValue) => newValue && setDateRange(newValue)}
          sx={{
            '& .MuiToggleButton-root': {
              borderColor: dashboardTheme.border,
              color: dashboardTheme.textSecondary,
              '&.Mui-selected': {
                backgroundColor: dashboardTheme.primary,
                color: dashboardTheme.text,
                '&:hover': {
                  backgroundColor: dashboardTheme.secondary,
                },
              },
            },
          }}
        >
          <ToggleButton value="7daysAgo">Last 7 Days</ToggleButton>
          <ToggleButton value="30daysAgo">Last 30 Days</ToggleButton>
          <ToggleButton value="90daysAgo">Last 90 Days</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Top Row - User Activity Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {mockUserMetrics.map((metric, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Card sx={{ 
                  background: dashboardTheme.cardBackground,
                  border: `1px solid ${dashboardTheme.border}`,
                  height: '100%'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {metric.icon}
                      <Typography variant="caption" sx={{ color: dashboardTheme.textSecondary, fontWeight: 500}}>
                        {metric.title}
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ 
                      fontWeight: 'bold', 
                      color: dashboardTheme.text,
                      mb: 1
                    }}>
                      {metric.value}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {metric.change > 0 ? (
                        <TrendingUp sx={{ color: dashboardTheme.success, fontSize: 16 }} />
                      ) : (
                        <TrendingDown sx={{ color: dashboardTheme.error, fontSize: 16 }} />
                      )}
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: metric.change > 0 ? dashboardTheme.success : dashboardTheme.error,
                          fontWeight: 50
                        }}
                      >
                        {metric.change > 0 ? '▲' : '▼'} {Math.abs(metric.change)}% vs previous period ({metric.previousValue})
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Chart Section */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: dashboardTheme.cardBackground,
            border: `1px solid ${dashboardTheme.border}`,
            height: '100%'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                color: dashboardTheme.text,
                mb: 3
              }}>
                Users
              </Typography>
              <Box sx={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockChartData}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={dashboardTheme.primary} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={dashboardTheme.primary} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: dashboardTheme.textSecondary }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: dashboardTheme.textSecondary }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: dashboardTheme.cardBackground,
                        border: `1px solid ${dashboardTheme.border}`,
                        borderRadius: 8,
                        color: dashboardTheme.text
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="users" 
                      stroke={dashboardTheme.primary}
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorUsers)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Revenue Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {mockRevenueMetrics.map((metric, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card sx={{ 
              background: dashboardTheme.cardBackground,
              border: `1px solid ${dashboardTheme.border}`,
              height: '100%'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {metric.icon}
                  <Typography variant="caption" sx={{ color: dashboardTheme.textSecondary, fontWeight: 500}}>
                    {metric.title}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ 
                  fontWeight: 'bold', 
                  color: dashboardTheme.text,
                  mb: 1
                }}>
                  {metric.value}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {metric.change > 0 ? (
                    <TrendingUp sx={{ color: dashboardTheme.success, fontSize: 16 }} />
                  ) : (
                    <TrendingDown sx={{ color: dashboardTheme.error, fontSize: 16 }} />
                  )}
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: metric.change > 0 ? dashboardTheme.success : dashboardTheme.error,
                      fontWeight: 50
                    }}
                  >
                    {metric.change > 0 ? '▲' : '▼'} {Math.abs(metric.change)}% vs previous period ({metric.previousValue})
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Bottom Row - Tables */}
      <Grid container spacing={3}>
        {/* Users by Country */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: dashboardTheme.cardBackground,
            border: `1px solid ${dashboardTheme.border}`
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                color: dashboardTheme.text,
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Public sx={{ color: dashboardTheme.primary }} />
                Users by Country
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: dashboardTheme.textSecondary, fontWeight: 600}}>Country</TableCell>
                      <TableCell sx={{ color: dashboardTheme.textSecondary, fontWeight: 600}}>Value</TableCell>
                      <TableCell sx={{ color: dashboardTheme.textSecondary, fontWeight: 600}}>vs prev</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockCountriesData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ color: dashboardTheme.text }}>{row.country}</TableCell>
                        <TableCell sx={{ color: dashboardTheme.text, fontWeight: 600}}>{row.value.toLocaleString()}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {row.change > 0 ? (
                              <TrendingUp sx={{ color: dashboardTheme.success, fontSize: 14 }} />
                            ) : (
                              <TrendingDown sx={{ color: dashboardTheme.error, fontSize: 14 }} />
                            )}
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: row.change > 0 ? dashboardTheme.success : dashboardTheme.error,
                                fontWeight: 50
                              }}
                            >
                              {row.change > 0 ? '▲' : '▼'} {Math.abs(row.change)}%
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Users by Source */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: dashboardTheme.cardBackground,
            border: `1px solid ${dashboardTheme.border}`
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                color: dashboardTheme.text,
                mb: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Share sx={{ color: dashboardTheme.primary }} />
                Users by Source
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: dashboardTheme.textSecondary, fontWeight: 600}}>Source</TableCell>
                      <TableCell sx={{ color: dashboardTheme.textSecondary, fontWeight: 600}}>Value</TableCell>
                      <TableCell sx={{ color: dashboardTheme.textSecondary, fontWeight: 600}}>vs prev</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mockSourcesData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell sx={{ color: dashboardTheme.text }}>{row.source}</TableCell>
                        <TableCell sx={{ color: dashboardTheme.text, fontWeight: 600}}>{row.value.toLocaleString()}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {row.change > 0 ? (
                              <TrendingUp sx={{ color: dashboardTheme.success, fontSize: 14 }} />
                            ) : (
                              <TrendingDown sx={{ color: dashboardTheme.error, fontSize: 14 }} />
                            )}
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: row.change > 0 ? dashboardTheme.success : dashboardTheme.error,
                                fontWeight: 50
                              }}
                            >
                              {row.change > 0 ? '▲' : '▼'} {Math.abs(row.change)}%
                            </Typography>
                          </Box>
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

      {/* GA4 Automation Dashboard */}
      {showAutomation && (
        <Box sx={{ mt: 4 }}>
          <GA4AutomationDashboard />
        </Box>
      )}

      {/* AI Analytics Insights */}
      {showAIInsights && (
        <Box sx={{ mt: 4 }}>
          <AIAnalyticsInsights 
            dateRange={dateRange}
            autoRefresh={true}
          />
        </Box>
      )}
    </Box>
  );
}
