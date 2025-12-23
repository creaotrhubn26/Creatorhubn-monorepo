/**
 * CreatorHub Norge - Integration Analytics Dashboard
 * Phase 14: Advanced Analytics & Business Intelligence
 * 
 * Comprehensive analytics for all Phase 13+ API integrations with:
 * - Real-time usage metrics
 * - Performance monitoring
 * - Cost analysis
 * - Success/failure tracking
 * - Business intelligence insights
 * - Norwegian market analytics
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { apiRequest } from '../../lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Tab,
  Tabs,
  LinearProgress,
  Alert,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
  LocalShipping as BringIcon,
  Business as BrregIcon,
  MusicNote as GramoIcon,
  CameraAlt as UnsplashIcon,
  VideoLibrary as PexelsIcon,
  AccountBalance as ProffIcon,
  Api as ApiIcon,
  CloudSync as SyncIcon,
  Money as MoneyIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { useToast } from '../../hooks/use-toast';

interface AnalyticsData {
  overview: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    totalCost: number;
    activeIntegrations: number;
    errorCount: number;
};
  integrationMetrics: {
    [key: string]: {
      name: string;
      service: string;
      requests: number;
      successRate: number;
      avgResponseTime: number;
      cost: number;
      status: 'active' | 'inactive' | 'error';
      lastUsed: string;
      errors: number;
  };
};
  timeSeriesData: Array<{
    timestamp: string;
    requests: number;
    errors: number;
    responseTime: number;
    cost: number;
}>;
  norwegianMarketData: {
    brreg: { companies: number; queries: number; success: number };
    bring: { shipments: number; tracking: number; cost: number };
    gramo: { artists: number; royalties: number; amount: number };
    proff: { creditChecks: number; reports: number; riskAssessments: number };
};
  creativeIndustryData: {
    unsplash: { searches: number; downloads: number; photographers: number };
    pexels: { searches: number; downloads: number; videos: number };
    adobe: { syncs: number; projects: number; storage: number };
    canva: { designs: number; templates: number; exports: number };
};
  performanceMetrics: {
    [service: string]: {
      uptime: number;
      reliability: number;
      latency: number;
      throughput: number;
  };
};
  costAnalysis: {
    totalMonthly: number;
    breakdown: { [service: string]: number };
    projectedAnnual: number;
    roi: number;
};
  alerts: Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    service: string;
    message: string;
    timestamp: string;
    resolved: boolean;
}>;
}

const IntegrationAnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { auth } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester, ');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30);
  const [dateRange, setDateRange] = useState<string>('7d');
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [showAlerts, setShowAlerts] = useState<boolean>(false);
  const [alertsDialog, setAlertsDialog] = useState<boolean>(false);

  const { toast } = useToast();

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const authHeader = await auth.getAuthHeader();
      const response = await fetch(`/api/admin/integration-analytics?range=${dateRange}`, {
        headers: {
          ...authHeader, 'x-user-email': user?.email || ', '
      }
    });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
      
      const data = await response.json();
      setAnalyticsData(data);
      setError(null);
  } catch (error) {
      console.error('❌ Error fetching analytics data: ', error);
      setError('Kunne ikke hente analytics data');
      toast({
        title: "❌ Analytics Feil",
        description: "Kunne ikke laste analytics data",
        variant: "destructive"
   });
  } finally {
      setLoading(false);
  }
};

  // Auto refresh effect
  useEffect(() => {
    fetchAnalyticsData();

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchAnalyticsData, refreshInterval * 1000);
  }

    return () => {
      if (interval) clearInterval(interval);
  };
}, [autoRefresh, refreshInterval, dateRange]);

  // Service icons mapping
  const getServiceIcon = (service: string) => {
    const iconMap: { [key: string]: JSX.Element } = {
      'bring': <BringIcon sx={{ color: '#ff6b35' }} />'brreg': <BrregIcon sx={{ color: '#2196f3' }} />'gramo': <GramoIcon sx={{ color: '#4caf50' }} />'proff': <ProffIcon sx={{ color: '#9c27b0' }} />'unsplash': <UnsplashIcon sx={{ color: '#000000' }} />'pexels': <PexelsIcon sx={{ color: '#05a081' }} />'adobe': <SyncIcon sx={{ color: '#ff0000' }} />'canva': <BarChartIcon sx={{ color: '#00c4cc' }} />
  };
    return iconMap[service] || <ApiIcon />;
};

  // Color mapping for charts
  const chartColors = ['#ff6b35', '#2196f3', '#4caf50', '#9c27b0', '#ff9800', '#00bcd4', '#e91e63', '#795548'];

  // Performance metrics calculation
  const performanceScore = useMemo(() => {
    if (!analyticsData!) return 0;
    const { successRate, averageResponseTime } = analyticsData!.overview;
    const responseTimeScore = Math.max(0, 100 - (averageResponseTime / 10));
    return Math.round((successRate + responseTimeScore) / 2);
}, [analyticsData!]);

  if (loading && !analyticsData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2, color: theming.colors.primary }}>
          Laster analytics data...
        </Typography>
      </Box>
    );
}

  if (error && !analyticsData) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Analytics Data Feil</Typography>
        <Typography>{error}</Typography>
        <Button onClick={fetchAnalyticsData} startIcon={<RefreshIcon />}, sx={{ mt: 1 }}>
          Prøv igjen
        </Button>
      </Alert>
    );
}

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: theming.colors.primary }}>
            📊 Integration Analytics Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Phase 14: Avansert analyse av alle API-integrasjoner og norske tjenester
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center'}}>
          <FormControl size="small">
            <InputLabel>Tidsperiode</InputLabel>
            <Select
              value={dateRange}
              label="Tidsperiode"
              onChange={(e) => setDateRange(e.target.value)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="24h">Siste 24t</MenuItem>
              <MenuItem value="7d">Siste 7 dager</MenuItem>
              <MenuItem value="30d">Siste 30 dager</MenuItem>
              <MenuItem value="90d">Siste 90 dager</MenuItem>
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
          }
            label="Auto-oppdater"
          />
          
          <Badge badgeContent={analyticsData!?.alerts.filter(a => !a.resolved).length || 0} color="error">
            <IconButton onClick={() => setAlertsDialog(true)}>
              <NotificationsIcon />
            </IconButton>
          </Badge>
          
          <Button
            onClick={fetchAnalyticsData}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            variant="outlined"
            disabled={loading}
          >
            Oppdater
          </Button>
        </Box>
      </Box>

      {analyticsData! && (
        <>
          {/* Overview Cards */}
          <Grid container spacing={3}, sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <Card >
                <CardContent sx={{ textAlign: 'cente, r'py:  2 }}>
                  <Typography variant="h4" sx={{ color: 'primary.mai, n'fontWeight: 600, color: theming.colors.primary }}>
                    {analyticsData!.overview.totalRequests.toLocaleString('no-NO')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totale Forespørsler
                  </Typography>
                  <TrendingUpIcon sx={{ color: 'success.mai, n'mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card >
                <CardContent sx={{ textAlign: 'cente, r'py:  2 }}>
                  <Typography variant="h4" sx={{ color: 'success.mai, n'fontWeight: 600, color: theming.colors.primary }}>
                    {analyticsData!.overview.successRate}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Suksessrate
                  </Typography>
                  <CheckCircleIcon sx={{ color: 'success.mai, n'mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card >
                <CardContent sx={{ textAlign: 'cente, r'py:  2 }}>
                  <Typography variant="h4" sx={{ color: 'info.mai, n'fontWeight: 600, color: theming.colors.primary }}>
                    {analyticsData!.overview.averageResponseTime}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg. Responstid
                  </Typography>
                  <SpeedIcon sx={{ color: 'info.mai, n'mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card >
                <CardContent sx={{ textAlign: 'cente, r'py:  2 }}>
                  <Typography variant="h4" sx={{ color: 'warning.mai, n'fontWeight: 600, color: theming.colors.primary }}>
                    {analyticsData!.overview.totalCost.toLocaleString('no-NO', { style: 'currency'currency: 'NOK' })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Månedlig Kostnad
                  </Typography>
                  <MoneyIcon sx={{ color: 'warning.mai, n'mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card >
                <CardContent sx={{ textAlign: 'cente, r'py:  2 }}>
                  <Typography variant="h4" sx={{ color: 'success.mai, n'fontWeight: 600, color: theming.colors.primary }}>
                    {analyticsData!.overview.activeIntegrations}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Integrasjoner
                  </Typography>
                  <ApiIcon sx={{ color: 'success.mai, n'mt: 1 }} />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card >
                <CardContent sx={{ textAlign: 'cente, r'py:  2 }}>
                  <Typography variant="h4" sx={{ color: analyticsData!.overview.errorCount  sx={{ color: theming.colors.primary }}> 0 ? 'error.main' : 'success.main', fontWeight: 600}>
                    {analyticsData!.overview.errorCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Aktive Feil
                  </Typography>
                  {analyticsData!.overview.errorCount > 0 ? (
                    <ErrorIcon sx={{ color: 'error.mai, n'mt: 1 }} />
                  ) : (
                    <CheckCircleIcon sx={{ color: 'success.mai, n'mt: 1 }} />
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Performance Score */}
          <Card sx={{ mb: 3 }}>
            <CardContent >
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', color: theming.colors.primary }}>
                <AssessmentIcon sx={{ mr:  1 }} />
                Ytelsesscore - Samlet Systemhelse
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ position: 'relativ, e'display:'inline-flex' }}>
                  <CircularProgress
                    variant="determinate"
                    value={performanceScore}
                    size={120}
                    thickness={4}
                    sx={{
                      color: performanceScore >= 90 ? 'success.main' : 
                             performanceScore >= 70 ? 'warning.main' : 'error.main'
                 }}
                  />
                  <Box sx={{
                    top:  0, left:  0, bottom:  0, right:  0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'}}>
                    <Typography variant="h4" component="div" color="text.secondary" sx={{ color: theming.colors.primary }}>
                      {performanceScore}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ flex:  1 }}>
                  <Typography variant="h5" sx={{ mb: 1, color: theming.colors.primary }}>
                    {performanceScore >= 90 ? 'Utmerket' : 
                     performanceScore >= 70 ? 'Bra' : 'Trenger Forbedring'}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Basert på suksessrate, responstid og feilfrekvens
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 4 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Suksessrate</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={analyticsData!.overview.successRate}
                        sx={{ width: 10, mt: 0.5}}
                        color="success"
                      />
                      <Typography variant="caption">{analyticsData!.overview.successRate}%</Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" color="text.secondary">Responstid</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.max(0, 100 - (analyticsData!.overview.averageResponseTime / 10))}
                        sx={{ width: 10, mt: 0.5}}
                        color="info"
                      />
                      <Typography variant="caption">{analyticsData!.overview.averageResponseTime}ms</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Main Analytics Tabs */}
          <Card >
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}, sx={{ borderBottom:  1, borderColor: 'divider' }}>
              <Tab label="📊 Oversikt" icon={<AnalyticsIcon />} iconPosition="start" />
              <Tab label="🇳🇴 Norske Tjenester" icon={<BrregIcon />} iconPosition="start" />
              <Tab label="🎨 Kreative APIs" icon={<UnsplashIcon />} iconPosition="start" />
              <Tab label="⚡ Ytelse" icon={<SpeedIcon />} iconPosition="start" />
              <Tab label="💰 Kostnader" icon={<MoneyIcon />} iconPosition="start" />
              <Tab label="🚨 Advarsler" icon={<WarningIcon />} iconPosition="start" />
            </Tabs>

            {/* Tab Content */}
            <CardContent sx={{ p:  0 }}>
              {activeTab === 0 && (
                <Box sx={{ p:  3 }}>
                  <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>Integrasjoner Oversikt</Typography>
                  
                  {/* Time Series Chart */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      📈 Forespørsler og Feil Over Tid
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analyticsData!.timeSeriesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timestamp" />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Line type="monotone" dataKey="requests" stroke="#2196f3" name="Forespørsler" />
                        <Line type="monotone" dataKey="errors" stroke="#f44336" name="Feil" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>

                  {/* Integration Status Table */}
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Tjeneste</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell align="right">Forespørsler</TableCell>
                          <TableCell align="right">Suksessrate</TableCell>
                          <TableCell align="right">Avg. Tid</TableCell>
                          <TableCell align="right">Kostnad</TableCell>
                          <TableCell>Sist Brukt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(analyticsData!.integrationMetrics).map(([key, integration]) => (
                          <TableRow key={key}>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center'}}>
                                {getServiceIcon(integration.service)}
                                <Typography sx={{ ml: 2 }}>{integration.name}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={integration.status === 'active' ? 'Aktiv' : 
                                       integration.status === 'inactive' ? 'Inaktiv' : 'Feil'}
                                color={integration.status === 'active' ? 'success' : 
                                       integration.status === 'inactive' ? 'default' : 'error'}
                              />
                            </TableCell>
                            <TableCell align="right">{integration.requests.toLocaleString('no-NO')}</TableCell>
                            <TableCell align="right">{integration.successRate}%</TableCell>
                            <TableCell align="right">{integration.avgResponseTime}ms</TableCell>
                            <TableCell align="right">{integration.cost.toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}</TableCell>
                            <TableCell>{new Date(integration.lastUsed).toLocaleDateString('no-NO')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {activeTab === 1 && (
                <Box sx={{ p:  3 }}>
                  <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>🇳🇴 Norske Business Ecosystem Tjenester</Typography>
                  
                  <Grid container spacing={3}>
                    {/* BRREG */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <BrregIcon sx={{ mr:  1, color: '#2196f3' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>BRREG - Bedriftsregister</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="primary.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.brreg.companies}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Bedrifter analysert</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.brreg.queries}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">API-kall</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* BRING */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <BringIcon sx={{ mr:  1, color: '#ff6b35' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>BRING - Logistikk</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.bring.shipments}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Forsendelser</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.bring.cost.toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Fraktkostnad</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* GRAMO */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <GramoIcon sx={{ mr:  1, color: '#4caf50' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>GRAMO - Musikk-royalties</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.gramo.artists}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Artister</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.gramo.amount.toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Royalties</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* PROFF */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <ProffIcon sx={{ mr:  1, color: '#9c27b0' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>PROFF.no - Kredittsjekk</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="secondary.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.proff.creditChecks}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Kredittsjekker</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="secondary.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.norwegianMarketData.proff.riskAssessments}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Risikovurderinger</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeTab === 2 && (
                <Box sx={{ p:  3 }}>
                  <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>🎨 Creative Industry APIs</Typography>
                  
                  <Grid container spacing={3}>
                    {/* UNSPLASH */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <UnsplashIcon sx={{ mr:  1, color: '#000000' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Unsplash - Stock Photos</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="primary.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.unsplash.searches}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Søk</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.unsplash.downloads}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Nedlastinger</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.unsplash.photographers}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Fotografer</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* PEXELS */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <PexelsIcon sx={{ mr:  1, color: '#05a081' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Pexels - Stock Media</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="primary.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.pexels.searches}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Søk</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.pexels.downloads}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Nedlastinger</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.pexels.videos}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Videoer</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Adobe Creative */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <SyncIcon sx={{ mr:  1, color: '#ff0000' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Adobe Creative Cloud</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.adobe.syncs}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Synkroniseringer</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.adobe.projects}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Prosjekter</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.adobe.storage} GB
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Lagring</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Canva */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <BarChartIcon sx={{ mr:  1, color: '#00c4cc' }} />
                            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Canva - Design Platform</Typography>
                          </Box>
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.canva.designs}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Designs</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.canva.templates}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Maler</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                                {analyticsData!.creativeIndustryData.canva.exports}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">Eksporter</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeTab === 3 && (
                <Box sx={{ p:  3 }}>
                  <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>⚡ Ytelsesmetriker</Typography>
                  
                  {/* Performance Cards */}
                  <Grid container spacing={3}>
                    {Object.entries(analyticsData!.performanceMetrics).map(([service, metrics]) => (
                      <Grid item xs={12} key={service}>
                        <Card >
                          <CardContent >
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              {getServiceIcon(service)}
                              <Typography variant="h6" sx={{ ml: 1, textTransform: 'capitalize', color: theming.colors.primary }}>
                                {service}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="text.secondary">Oppetid</Typography>
                              <LinearProgress variant="determinate" value={metrics.uptime}, sx={{ mt: 0.5}} />
                              <Typography variant="caption">{metrics.uptime}%</Typography>
                            </Box>
                            
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="text.secondary">Pålitelighet</Typography>
                              <LinearProgress variant="determinate" value={metrics.reliability} color="success" sx={{ mt: 0.5}} />
                              <Typography variant="caption">{metrics.reliability}%</Typography>
                            </Box>
                            
                            <Grid container spacing={2}>
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">Latens</Typography>
                                <Typography variant="h6" sx={{ color: theming.colors.primary }}>{metrics.latency}ms</Typography>
                              </Grid>
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">Throughput</Typography>
                                <Typography variant="h6" sx={{ color: theming.colors.primary }}>{metrics.throughput}/s</Typography>
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {activeTab === 4 && (
                <Box sx={{ p:  3 }}>
                  <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>💰 Kostnadsanalyse</Typography>
                  
                  <Grid container spacing={3}>
                    {/* Cost Overview */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Månedlig Totalkostnad</Typography>
                          <Typography variant="h3" color="warning.main" sx={{ color: theming.colors.primary }}>
                            {analyticsData!.costAnalysis.totalMonthly.toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Projisert årlig: {analyticsData!.costAnalysis.projectedAnnual.toLocaleString('no-N, O'{ style: 'currency'currency:'NOK' })}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* ROI */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Return on Investment</Typography>
                          <Typography variant="h3" color={analyticsData!.costAnalysis.roi  sx={{ color: theming.colors.primary }}>= 0 ? "success.main" : "error.main"}>
                            {analyticsData!.costAnalysis.roi}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {analyticsData!.costAnalysis.roi >= 0 ? 'Positiv avkastning' : 'Negativ avkastning'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Cost Breakdown Chart */}
                    <Grid item xs={12}>
                      <Card >
                        <CardContent >
                          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>Kostnadsfordeling</Typography>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={Object.entries(analyticsData!.costAnalysis.breakdown).map(([service, cost], index) => ({
                                  name: service,
                                  value: cost,
                                  fill: chartColors[index % chartColors.length]
                             }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                dataKey="value"
                              >
                                {Object.entries(analyticsData!.costAnalysis.breakdown).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip formatter={(value) => [`${Number(value).toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}`'Kostnad']} />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </Grid>

                    {/* Cost Breakdown Table */}
                    <Grid item xs={12 }}>
                      <TableContainer component={Paper}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Tjeneste</TableCell>
                              <TableCell align="right">Månedlig Kostnad</TableCell>
                              <TableCell align="right">Årlig Projeksjon</TableCell>
                              <TableCell align="right">% av Total</TableCell>
                              <TableCell align="center">Kostnad per Forespørsel</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(analyticsData!.costAnalysis.breakdown).map(([service, cost]) => {
                              const percentage = (cost / analyticsData!.costAnalysis.totalMonthly * 100).toFixed(1);
                              const requests = analyticsData!.integrationMetrics[service]?.requests || 1;
                              const costPerRequest = cost / requests;
                              
                              return (
                                <TableRow key={service}>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center'}}>
                                      {getServiceIcon(service)}
                                      <Typography sx={{ ml: 2, textTransform: 'capitalize' }}>{service}</Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right">
                                    {cost.toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}
                                  </TableCell>
                                  <TableCell align="right">
                                    {(cost * 12).toLocaleString('no-NO', { style: 'currency'currency:'NOK' })}
                                  </TableCell>
                                  <TableCell align="right">{percentage}%</TableCell>
                                  <TableCell align="center">
                                    {costPerRequest.toLocaleString('no-NO', { style: 'currency'currency:'NO, K'minimumFractionDigits:  4 })}
                                  </TableCell>
                                </TableRow>
                              );
                          })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeTab === 5 && (
                <Box sx={{ p:  3 }}>
                  <Typography variant="h6" sx={{ mb: 3, color: theming.colors.primary }}>🚨 Aktive Advarsler og Varsler</Typography>
                  
                  {analyticsData!.alerts.length === 0 ? (
                    <Alert severity="success" sx={{ mb: 3 }}>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Ingen aktive advarsler</Typography>
                      <Typography>Alle integrasjoner fungerer som forventet.</Typography>
                    </Alert>
                  ) : (
                    <List>
                      {analyticsData!.alerts.map((alert) => (
                        <ListItem key={alert.id}, sx={{ mb: 1 }}>
                          <Card sx={{ width: '100%' }}>
                            <CardContent >
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center'}}>
                                  <ListItemIcon>
                                    {alert.type === 'error' ? <ErrorIcon color="error" /> :
                                     alert.type === 'warning' ? <WarningIcon color="warning" /> :
                                     <NotificationsIcon color="info" />}
                                  </ListItemIcon>
                                  <Box>
                                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                                      {alert.service.toUpperCase()} - {alert.type === 'error' ? 'Feil' : 
                                                                    alert.type === 'warning' ? 'Advarsel' : 'Info'}
                                    </Typography>
                                    <Typography variant="body1">{alert.message}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {new Date(alert.timestamp).toLocaleString('no-NO')}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Chip
                                  size="small"
                                  label={alert.resolved ? 'Løst' : 'Aktiv'}
                                  color={alert.resolved ? 'success' : 'error'}
                                />
                              </Box>
                            </CardContent>
                          </Card>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Alerts Dialog */}
      <Dialog open={alertsDialog} onClose={() => setAlertsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>🚨 Systemadvarsler</DialogTitle>
        <DialogContent>
          {analyticsData!?.alerts && analyticsData!.alerts.length > 0 ? (
            <List>
              {analyticsData!.alerts.map((alert) => (
                <ListItem key={alert.id}>
                  <ListItemIcon>
                    {alert.type === 'error' ? <ErrorIcon color="error" /> :
                     alert.type === 'warning' ? <WarningIcon color="warning" /> :
                     <NotificationsIcon color="info" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${alert.service.toUpperCase()} - ${alert.message}`}
                    secondary={new Date(alert.timestamp).toLocaleString('no-NO')}
                  />
                  <Chip
                    size="small"
                    label={alert.resolved ? 'Løst' : 'Aktiv'}
                    color={alert.resolved ? 'success' : 'error'}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>Ingen advarsler for øyeblikket.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertsDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IntegrationAnalyticsDashboard;