import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Alert,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
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
  Divider,
} from '@mui/material';
import {
  TrendingUp,
  Analytics,
  Assessment,
  Business as BusinessCenter,
  AttachMoney,
  LocationOn,
  Refresh,
  InfoOutlined,
  TableView,
  TrendingUpOutlined,
  RecommendOutlined,
  ShowChart,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useTheming } from '../utils/theming-helper';
import { useExternalData } from '../services/ExternalDataService';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { PushNotificationSettings } from './shared/PushNotificationSettings';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from './universal/hooks/useDynamicProfessions';
import {
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// System status shape returned from /api/business/intelligence/status
interface SystemStatus {
  online: boolean;
  analyticsEngine: string;
  performance: {
    dataAccuracy: string;
    queryResponseTime: string;
  };
  version: string;
  timestamp: string;
  dataSources?: {
    vendors: number;
    products: number;
  };
}

// SSB economic indicator from ExternalDataService
interface SSBIndicator {
  title: string;
  value: number;
  unit: string;
  period: string;
}

interface SSBEconomicData {
  source: string;
  lastUpdated: string;
  indicators: SSBIndicator[];
}

interface SSBPopulationData {
  region: string;
  year: string;
  data: {
    population: number;
    growth: number;
    density: number;
  };
  source: 'ssb_api' | 'fallback';
  lastUpdated: string;
}

interface ProffCompany {
  name: string;
  orgNumber: string;
  industry: string;
  employees: number;
  revenue: number;
  location: string;
}

// Map profession to Norwegian search term for Proff.no
function professionToNorwegianSearch(profession: string): string {
  const map: Record<string, string> = {
    photographer: 'Fotograf',
    videographer: 'Videograf',
    music_producer: 'Musikkprodusent',
    musician: 'Musiker',
    venue: 'Selskapslokaler',
    planner: 'Bryllupsplanlegger',
    makeup: 'Makeup',
    florist: 'Blomsterdekoratør',
    catering: 'Catering',
    cake: 'Konditor',
    transport: 'Limousine',
  };
  return map[profession] || profession;
}

const COLORS = ['#ff6b35','#4dabf7','#69db7c','#ffd43b','#f783ac'];

export default function BusinessIntelligenceDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const profession = user?.profession || 'photographer';
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);
  const [selectedRegion, setSelectedRegion] = useState('Oslo');
  const [selectedService, setSelectedService] = useState('bryllup');
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const userId = user?.id || user?.sub || 'demo-user';
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  const isMusicProducer = profession === 'music_producer';
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Profession configuration & adapter
  const { professionConfigs, hasData: hasProfessionConfig } = useProfessionConfigs();
  const { adaptDashboardTitle, trackProfessionActivity, getProfessionAnalytics } = useProfessionAdapter();
  const professionIcon = getProfessionIcon(profession);
  const currentProfConfig = professionConfigs[profession];
  
  // ⭐ Enhanced Master Integration
  const { integration, communication, dataFlow, componentRegistry, lifecycle, analytics, performance, debugging } = useEnhancedMasterIntegration();
  
  // ⭐ Norwegian Business Intelligence from ExternalDataService
  const { 
    getSSBEconomicIndicators,
    getSSBPopulationData,
    getProffCompanyData,
    searchProffCompanies
  } = useExternalData();
  
  // State for Norwegian data
  const [ssbEconomicData, setSSBEconomicData] = useState<SSBEconomicData | null>(null);
  const [ssbPopulationData, setSSBPopulationData] = useState<SSBPopulationData | null>(null);
  const [proffMarketData, setProffMarketData] = useState<ProffCompany[] | null>(null);
  
  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    lifecycle.registerComponent({
      id: 'BusinessIntelligenceDashboard,',
      type: 'dashboard',
      version: '1.0.0',
      capabilities: {
        data: ['ssbEconomic','ssbPopulation','marketData','regionalData','dashboardData'],
        events: ['region:changed','service:changed','data:refreshed','norwegian_data_fetched'],
        actions: ['refresh','changeRegion','changeService','fetchNorwegianData'],
        ui: ['dashboard','charts','tables','filters','statistics'],
        system: ['market-analysis','regional-analysis','ssb-integration','proff-integration']
      },
      dependencies: ['external-data-service','theming-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0
      }
    });

    // Track dashboard opened
    analytics.trackEvent('business_intelligence_dashboard_opened', {
      profession,
      region: selectedRegion,
      service: selectedService
    });

    // Track profession activity via adapter
    trackProfessionActivity('dashboard_view', { component: 'BusinessIntelligenceDashboard' });

    // Register with component registry for cross-component discovery
    componentRegistry.registerComponent({
      id: 'BusinessIntelligenceDashboard',
      name: 'Business Intelligence Dashboard',
      type: 'dashboard',
      capabilities: ['market-analysis', 'regional-analysis', 'ssb-integration'],
    });

    return () => {
      lifecycle.unregisterComponent('BusinessIntelligenceDashboard');
    };
  }, []);

  // Dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['/api/business/dashboard', userId, profession],
    queryFn: () => apiRequest(`/api/business/dashboard/${userId}/${profession}`),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Market data
  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ['/api/business/market-analysis', profession, selectedService, selectedRegion],
    queryFn: () => apiRequest(`/api/business/market-analysis/${profession}/${selectedService}?region=${selectedRegion}`),
    retry: 2,
  });

  // Regional data
  const { data: regionalData, isLoading: regionalLoading } = useQuery({
    queryKey: ['/api/business/regional-analysis', profession],
    queryFn: () => apiRequest(`/api/business/regional-analysis/${profession}`),
    retry: 2,
  });

  // System status
  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ['/api/business/intelligence/status'],
    queryFn: () => apiRequest('/api/business/intelligence/status'),
    retry: 1,
    refetchInterval: 60000,
  });

  // Split Sheet Revenue Analytics (only for music producers)
  const { data: revenueAnalyticsData, isLoading: revenueAnalyticsLoading } = useQuery({
    queryKey: ['split-sheets-revenue-analytics', profession],
    queryFn: () => apiRequest(`/api/split-sheets/revenue-analytics?profession=${profession}`),
    enabled: isMusicProducer,
    retry: 2,
  });

  // Split Sheet Payment Analytics (only for music producers)
  const { data: paymentAnalyticsData, isLoading: paymentAnalyticsLoading } = useQuery({
    queryKey: ['split-sheets-payment-analytics', profession],
    queryFn: () => apiRequest(`/api/split-sheets/payment-analytics?profession=${profession}`),
    enabled: isMusicProducer,
    retry: 2,
  });

  // Split Sheet Market Insights (only for music producers)
  const { data: marketInsightsData, isLoading: marketInsightsLoading } = useQuery({
    queryKey: ['split-sheets-market-insights', profession],
    queryFn: () => apiRequest(`/api/split-sheets/market-insights`),
    enabled: isMusicProducer,
    retry: 2,
  });

  const handleRefresh = () => {
    const endTiming = performance.startTiming('dashboard_refresh');
    
    queryClient.invalidateQueries({ queryKey: ['/api/business'] });
    fetchNorwegianData(); // Also refresh Norwegian data
    fetchProffData(); // Refresh Proff.no data
    
    // Track refresh action
    analytics.trackEvent('dashboard_refreshed', {
      region: selectedRegion,
      service: selectedService,
      profession
    });
    
    // Log integration status
    debugging.logIntegration('info', 'Dashboard data refreshed', {
      region: selectedRegion,
      service: selectedService,
      integrationActive: Boolean(integration),
    });
    
    endTiming();
  };
  
  // ⭐ Fetch real Norwegian business intelligence data
  const fetchNorwegianData = async () => {
    const endTiming = performance.startTiming('fetch_norwegian_data');
    
    try {
      // Fetch SSB economic indicators for the selected region
      const economicData = await getSSBEconomicIndicators({ region: selectedRegion });
      setSSBEconomicData(economicData);
      
      // Fetch SSB population data for the selected region
      const populationData = await getSSBPopulationData({ region: selectedRegion });
      setSSBPopulationData(populationData);
      
      // Track successful fetch
      analytics.trackEvent('norwegian_data_fetched', {
        region: selectedRegion,
        hasEconomicData: !!economicData,
        hasPopulationData: !!populationData,
        source: economicData.source
      });
      
      // Sync data with data flow
      dataFlow.syncData('BusinessIntelligenceDashboard:ssbEconomic', economicData);
      dataFlow.syncData('BusinessIntelligenceDashboard:ssbPopulation', populationData);
      
      debugging.logIntegration('info', 'Norwegian business intelligence data loaded', {
        region: selectedRegion,
        economicIndicators: economicData.indicators?.length,
        population: populationData.data.population
      });
    } catch (error) {
      debugging.logIntegration('error','Failed to fetch Norwegian data', { error, region: selectedRegion });
      analytics.trackEvent('norwegian_data_fetch_failed', { error: (error as Error).message, region: selectedRegion });
    } finally {
      endTiming();
    }
  };
  
  // Fetch Norwegian data when region changes
  React.useEffect(() => {
    fetchNorwegianData();
    
    // Track region change
    analytics.trackEvent('region_changed', {
      previousRegion: selectedRegion,
      newRegion: selectedRegion,
      profession
    });
    
    // Broadcast region change event
    communication.sendBroadcast('business:region:changed', {
      type: 'region_changed',
      region: selectedRegion,
      component: 'BusinessIntelligenceDashboard'
    });
  }, [selectedRegion]);

  // ⭐ Fetch Proff.no competitor data for the selected region
  const fetchProffData = useCallback(async () => {
    try {
      const categoryName = professionToNorwegianSearch(profession);
      const companies = await searchProffCompanies(categoryName);
      const companyList: ProffCompany[] = (companies?.companies ?? [])
        .map((company) => ({
          name: company.companyName,
          orgNumber: company.organizationNumber,
          industry: categoryName,
          employees: company.employees ?? 0,
          revenue: company.revenue ?? 0,
          location: selectedRegion,
        }));

      // Enrich first company with detailed Proff.no data if available
      if (companyList.length > 0 && companyList[0].orgNumber) {
        try {
          const detail = await getProffCompanyData(companyList[0].orgNumber);
          if (detail?.revenue) {
            companyList[0] = {
              ...companyList[0],
              revenue: detail.revenue.amount,
              employees: detail.employees ?? companyList[0].employees,
            };
          }
        } catch {
          // Detailed data optional
        }
      }

      setProffMarketData(companyList);
      analytics.trackEvent('proff_data_fetched', { region: selectedRegion, profession, count: companyList.length });
    } catch (error) {
      debugging.logIntegration('warn', 'Proff.no data unavailable, using backend data only', { error: (error as Error).message });
    }
  }, [selectedRegion, profession, searchProffCompanies, getProffCompanyData, analytics, debugging]);

  useEffect(() => {
    fetchProffData();
  }, [fetchProffData]);
  
  // Track service selection changes
  React.useEffect(() => {
    analytics.trackEvent('service_changed', {
      service: selectedService,
      region: selectedRegion,
      profession
    });
  }, [selectedService]);

  if (dashboardError) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="h6">Feil ved lasting av business intelligence data</Typography>
        <Typography variant="body2">
          {dashboardError instanceof Error ? dashboardError.message : 'Kunne ikke laste markedsdata. Prøv igjen senere.'}
        </Typography>
        <Button variant="outlined" onClick={handleRefresh} sx={{ mt: 1 }}>
          Prøv igjen
        </Button>
      </Alert>
    );
  }

  const isLoading = dashboardLoading || marketLoading || regionalLoading || 
    (isMusicProducer && (revenueAnalyticsLoading || paymentAnalyticsLoading || marketInsightsLoading));

  return (
    <Box sx={{ p: 3, maxWidth: '100%' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          {professionIcon && (
            <Avatar sx={{ bgcolor: currentProfConfig?.color || theming.colors.primary, width: 48, height: 48 }}>
              {professionIcon}
            </Avatar>
          )}
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: theming.colors.primary }}>
              {adaptDashboardTitle ? adaptDashboardTitle() : 'Business Intelligence Dashboard'}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Markedsanalyse og forretningsmessig innsikt for{' '}
              {getProfessionDisplayName(profession).toLowerCase()}er
              {hasProfessionConfig && currentProfConfig ? ` (${currentProfConfig.displayName})` : ''}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          {systemStatus && (
            <Chip
              label={systemStatus.online ? 'System Online' : 'System Offline'}
              color={systemStatus.online ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
          )}
          {isSupported && (
            <Tooltip title="Push-varsler innstillinger">
              <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Oppdater data">
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Region</InputLabel>
              <Select value={selectedRegion} label="Region" onChange={(e) => setSelectedRegion(e.target.value)}>
                <MenuItem value="Oslo">Oslo</MenuItem>
                <MenuItem value="Bergen">Bergen</MenuItem>
                <MenuItem value="Trondheim">Trondheim</MenuItem>
                <MenuItem value="Stavanger">Stavanger</MenuItem>
                <MenuItem value="Tromsø">Tromsø</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Tjenestetype</InputLabel>
              <Select value={selectedService} label="Tjenestetype" onChange={(e) => setSelectedService(e.target.value)}>
                <MenuItem value="bryllup">Bryllup</MenuItem>
                <MenuItem value="portrett">Portrett</MenuItem>
                <MenuItem value="bedrift">Bedriftsfoto</MenuItem>
                <MenuItem value="arrangement">Arrangement</MenuItem>
                <MenuItem value="produkt">Produktfoto</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* ⭐ Norwegian Economic Indicators (SSB) */}
        {ssbEconomicData && (
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'primary.light', border: '2px solid', borderColor: 'primary.main' }}>
              <CardHeader 
                title="📊 Norske Økonomiske Indikatorer (SSB)"
                subheader={`Oppdatert: ${new Date(ssbEconomicData.lastUpdated).toLocaleDateString('no-NO')}`}
                avatar={<Analytics color="primary" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  {ssbEconomicData.indicators?.slice(0, 5).map((indicator: any, index: number) => (
                    <Grid item xs={12} sm={6} md={4} lg={2.4} key={index}>
                      <Card sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
                        <Typography variant="caption" color="text.secondary">
                          {indicator.title}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main', my: 1 }}>
                          {indicator.value}{indicator.unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {indicator.period}
                        </Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>💡 Markedsanalyse:</strong> {selectedRegion} viser{', '}
                    {ssbEconomicData.indicators?.[2]?.value > 70 ? 'høy sysselsetting' : 'moderat sysselsetting'}{', '}
                    ({ssbEconomicData.indicators?.[2]?.value}%) og{', '}
                    {ssbEconomicData.indicators?.[1]?.value < 4 ? 'lav arbeidsledighet' : 'normal arbeidsledighet'}{','}
                    ({ssbEconomicData.indicators?.[1]?.value}%) - et sterkt marked for kreative tjenester.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {/* ⭐ Population & Customer Base (SSB) */}
        {ssbPopulationData && (
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'info.light', border: '2px solid', borderColor: 'info.main' }}>
              <CardHeader 
                title="👥 Befolkning & Kundebase (SSB)"
                subheader={`${ssbPopulationData.region} - ${ssbPopulationData.year}`}
                avatar={<LocationOn color="info" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Card sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Befolkning</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600, color: 'info.dark' }}>
                        {ssbPopulationData.data.population.toLocaleString('no-NO')}
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Card sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Årlig vekst</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600, color: 'success.dark' }}>
                        +{ssbPopulationData.data.growth}%
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Card sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">Tetthet</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                        {ssbPopulationData.data.density}/km²
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>🎯 Kundebase Potensial:</strong> Med {ssbPopulationData.data.population.toLocaleString('no-NO')} innbyggere
                    og +{ssbPopulationData.data.growth}% årlig vekst, har {ssbPopulationData.region} et stort marked
                    for {getProfessionDisplayName(profession).toLowerCase()} tjenester.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        )}
      
        {/* Quick Stats Cards */}
        {dashboardData?.data?.quickStats && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Gjennomsnittspris
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600}}>
                        kr {dashboardData.data.quickStats.averageMarketPrice?.toLocaleString() || 'N/A'}
                      </Typography>
                    </Box>
                    <AttachMoney color="primary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Konkurrenter
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 600}}>
                        {dashboardData.data.quickStats.competitorCount || 0}
                      </Typography>
                    </Box>
                    <BusinessCenter color="secondary" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Sesongetterspørsel
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600}}>
                        {dashboardData.data.quickStats.seasonalDemand === 'high' ? 'Høy' : dashboardData.data.quickStats.seasonalDemand === 'medium' ? 'Middels' : 'Lav'}
                      </Typography>
                    </Box>
                    <TrendingUp color="success" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Beste regioner
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600}}>
                        {dashboardData.data.quickStats.bestRegions?.slice(0, 2).join(', ') || 'N/A'}
                      </Typography>
                    </Box>
                    <LocationOn color="info" sx={{ fontSize: 40 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Market Analysis Chart */}
        {marketData?.data && (
          <Grid item xs={12} lg={8}>
            <Card>
              <CardHeader 
                title="Markedsanalyse"
                subheader={`${selectedService} i ${selectedRegion}`}
                avatar={<Analytics color="primary" />}
              />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={[
                      { navn: 'Gjennomsnitt', verdi: marketData.data.averagePrice || 0 },
                      { navn: 'Minimum', verdi: marketData.data.priceRange?.min || 0 },
                      { navn: 'Maksimum', verdi: marketData.data.priceRange?.max || 0 },
                      { navn: 'Premium', verdi: (marketData.data.averagePrice || 0) * 1.5 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="navn" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => [`kr ${(value as number)?.toLocaleString()}`, 'Pris']} />
                    <Area type="monotone" dataKey="verdi" stroke="#ff6b35" fill="#ff6b35" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Regional Analysis Chart */}
        {regionalData?.data && (
          <Grid item xs={12} lg={4}>
            <Card>
              <CardHeader 
                title="Regional analyse"
                subheader="Markedsmuligheter per region"
                avatar={<LocationOn color="secondary" />}
              />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <RechartsTooltip />
                    <Legend />
                    <Pie
                      data={regionalData.data.slice(0, 5).map((region: any) => ({
                        name: region.region,
                        value: region.marketOpportunity || Math.random() * 10,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {regionalData.data.slice(0, 5).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Seasonal Trends Chart */}
        {marketData?.data?.seasonalFactors && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardHeader 
                title="Sesongvariasjon"
                subheader="Etterspørsel gjennom året"
                avatar={<ShowChart color="info" />}
              />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={marketData.data.seasonalFactors.map((factor: number, index: number) => ({
                      måned: ['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt', 'Nov', 'Des'][index],
                      faktor: factor,
                      etterspørsel: Math.round(factor * 10),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="måned" />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(value, name) => [
                        name === 'faktor' ? `${(value as number).toFixed(1)}x` : `${value}%`,
                        name === 'faktor' ? 'Faktor' : 'Etterspørsel',
                      ]}
                    />
                    <Line type="monotone" dataKey="faktor" stroke="#4dabf7" strokeWidth={3} />
                    <Line type="monotone" dataKey="etterspørsel" stroke="#69db7c" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Pricing Guidance */}
        {dashboardData?.data?.marketInsights?.pricingGuidance && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardHeader 
                title="Prisguiding"
                subheader="Anbefalt prissetting og positioning"
                avatar={<AttachMoney color="success" />}
              />
              <CardContent>
                <Box mb={2}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 600}}>
                    kr {dashboardData.data.marketInsights.pricingGuidance.suggestedPrice?.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Anbefalt pris for {selectedService}
                  </Typography>
                </Box>
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Konfidensgrad
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(dashboardData.data.marketInsights.pricingGuidance.confidence || 0) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {Math.round((dashboardData.data.marketInsights.pricingGuidance.confidence || 0) * 100)}% sikkerhet
                  </Typography>
                </Box>
                <Box mb={2}>
                  <Chip
                    label={dashboardData.data.marketInsights.pricingGuidance.marketPosition || 'Mid-market'}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {dashboardData.data.marketInsights.pricingGuidance.reasoning}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Recommendations */}
        {dashboardData?.data?.recommendations && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="Anbefalinger"
                subheader="Basert på markedsanalyse og data"
                avatar={<RecommendOutlined color="info" />}
              />
              <CardContent>
                <List>
                  {dashboardData.data.recommendations.map((recommendation: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon><InfoOutlined color="primary" /></ListItemIcon>
                      <ListItemText primary={recommendation} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ⭐ Market Intelligence Summary (Combined Data) */}
        {(ssbEconomicData || ssbPopulationData) && (
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'success.light', border: '2px solid', borderColor: 'success.main' }}>
              <CardHeader 
                title="🎯 Markedsintelligens - Norske Data"
                subheader={`Basert på SSB & Proff.no data for ${selectedRegion}`}
                avatar={<TrendingUpOutlined color="success" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                      💼 Økonomisk Miljø
                    </Typography>
                    <List dense>
                      {ssbEconomicData?.indicators?.slice(0, 3).map((indicator: any, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon><InfoOutlined color="primary" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary={`${indicator.title}: ${indicator.value}${indicator.unit}`}
                            secondary={indicator.period}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                      👥 Kundebase
                    </Typography>
                    {ssbPopulationData && (
                      <List dense>
                        <ListItem>
                          <ListItemIcon><InfoOutlined color="info" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary={`${ssbPopulationData.data.population.toLocaleString('no-NO')} innbyggere`}
                            secondary={`+${ssbPopulationData.data.growth}% årlig vekst`}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon><InfoOutlined color="info" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary={`Tetthet: ${ssbPopulationData.data.density}/km²`}
                            secondary={ssbPopulationData.data.density > 500 ? 'Urban område' : 'Mindre urban'}
                          />
                        </ListItem>
                      </List>
                    )}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                      📈 Anbefalinger
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon><TrendingUp color="success" fontSize="small" /></ListItemIcon>
                        <ListItemText 
                          primary="Sterkt marked"
                          secondary={`${selectedRegion} har god økonomisk aktivitet`}
                        />
                      </ListItem>
                      {typeof ssbPopulationData?.data.growth === 'number' && ssbPopulationData.data.growth > 1 && (
                        <ListItem>
                          <ListItemIcon><TrendingUp color="success" fontSize="small" /></ListItemIcon>
                          <ListItemText 
                            primary="Voksende kundebase"
                            secondary={`+${ssbPopulationData.data.growth}% årlig vekst`}
                          />
                        </ListItem>
                      )}
                      <ListItem>
                        <ListItemIcon><TrendingUp color="success" fontSize="small" /></ListItemIcon>
                        <ListItemText 
                          primary="Lav arbeidsledighet"
                          secondary={`${ssbEconomicData?.indicators?.[1]?.value || 'N/A'}% - god kjøpekraft`}
                        />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      
        {/* Competitive Advantages */}
        {dashboardData?.data?.marketInsights?.pricingGuidance?.competitiveAdvantage && (
          <Grid item xs={12} lg={6}>
            <Card>
              <CardHeader 
                title="Konkurransefortrinn"
                subheader="Dine unike markedsposisjonering"
                avatar={<TrendingUpOutlined color="success" />}
              />
              <CardContent>
                <List>
                  {dashboardData.data.marketInsights.pricingGuidance.competitiveAdvantage.map((advantage: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon><TrendingUp color="primary" /></ListItemIcon>
                      <ListItemText primary={advantage} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Regional Analysis Table */}
        {regionalData?.data && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="Detaljert regional analyse"
                subheader="Komplett markedsdata for alle regioner"
                avatar={<TableView color="primary" />}
              />
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Region</strong></TableCell>
                        <TableCell align="right"><strong>Populasjon</strong></TableCell>
                        <TableCell align="right"><strong>Gj.snitt inntekt</strong></TableCell>
                        <TableCell align="right"><strong>Konkurrenter</strong></TableCell>
                        <TableCell align="right"><strong>Markedsmulighet</strong></TableCell>
                        <TableCell><strong>Anbefalt strategi</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {regionalData.data.map((region: any) => (
                        <TableRow key={region.region} hover>
                          <TableCell component="th" scope="row">
                            <Box display="flex" alignItems="center" gap={1}>
                              <LocationOn color="primary" fontSize="small" />
                              <strong>{region.region}</strong>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{region.populationSize?.toLocaleString()}</TableCell>
                          <TableCell align="right">kr {region.averageIncome?.toLocaleString()}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={region.competitionDensity}
                              size="small"
                              color={region.competitionDensity > 80 ? 'error' : region.competitionDensity > 50 ? 'warning' : 'success'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" alignItems="center" gap={1}>
                              <LinearProgress
                                variant="determinate"
                                value={region.marketOpportunity}
                                sx={{ width: 60, height: 6 }}
                                color={region.marketOpportunity > 60 ? 'success' : region.marketOpportunity > 30 ? 'warning' : 'error'}
                              />
                              <Typography variant="body2">{region.marketOpportunity}%</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{region.recommendedStrategy}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ⭐ Proff.no Competitor Intelligence */}
        {proffMarketData && proffMarketData.length > 0 && (
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'warning.light', border: '2px solid', borderColor: 'warning.main' }}>
              <CardHeader 
                title="🏢 Konkurrentoversikt (Proff.no)"
                subheader={`${proffMarketData.length} relaterte bedrifter i ${selectedRegion}`}
                avatar={<BusinessCenter color="warning" />}
              />
              <CardContent>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Bedrift</strong></TableCell>
                        <TableCell><strong>Bransje</strong></TableCell>
                        <TableCell align="right"><strong>Ansatte</strong></TableCell>
                        <TableCell align="right"><strong>Omsetning</strong></TableCell>
                        <TableCell><strong>Sted</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {proffMarketData.slice(0, 8).map((company, index) => (
                        <TableRow key={company.orgNumber || index} hover>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{company.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{company.industry}</Typography>
                          </TableCell>
                          <TableCell align="right">{company.employees || '–'}</TableCell>
                          <TableCell align="right">
                            {company.revenue ? `kr ${company.revenue.toLocaleString('no-NO')}` : '–'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">{company.location}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Data fra Proff.no. Viser {professionToNorwegianSearch(profession)}-relaterte bedrifter.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Split Sheet Revenue Analytics - Only for Music Producers */}
        {isMusicProducer && revenueAnalyticsData?.data && (
          <>
            <Grid item xs={12}>
              <Card sx={{ bgcolor: 'primary.light', border: '2px solid', borderColor: 'primary.main' }}>
                <CardHeader 
                  title="💰 Split Sheet Inntektsanalyse"
                  subheader="Inntektsdata fra split sheets"
                  avatar={<AttachMoney color="primary" />}
                />
                <CardContent>
                  <Grid container spacing={2}>
                    {/* Revenue Trends Chart */}
                    {revenueAnalyticsData.data.trends && revenueAnalyticsData.data.trends.length > 0 && (
                      <Grid item xs={12} lg={8}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                          Inntektsutvikling over tid
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={revenueAnalyticsData.data.trends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="month" 
                              tickFormatter={(value) => new Date(value).toLocaleDateString('no-NO', { month: 'short', year: '2-digit' })}
                            />
                            <YAxis />
                            <RechartsTooltip 
                              formatter={(value: any) => [`kr ${value.toLocaleString('nb-NO')}`, 'Inntekt']}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="totalRevenue" 
                              stroke="#9f7aea" 
                              fill="#9f7aea" 
                              fillOpacity={0.3} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Grid>
                    )}
                    {/* Revenue by Project */}
                    {revenueAnalyticsData.data.byProject && revenueAnalyticsData.data.byProject.length > 0 && (
                      <Grid item xs={12} lg={4}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                          Inntekt per prosjekt
                        </Typography>
                        <List dense>
                          {revenueAnalyticsData.data.byProject.slice(0, 5).map((project: any, index: number) => (
                            <ListItem key={index}>
                              <ListItemIcon><AttachMoney color="primary" fontSize="small" /></ListItemIcon>
                              <ListItemText 
                                primary={project.projectName}
                                secondary={`kr ${project.totalRevenue.toLocaleString('nb-NO')}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Split Sheet Payment Analytics */}
            {paymentAnalyticsData?.data && (
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardHeader 
                    title="💳 Betalingsstatus Analyse"
                    subheader="Betalinger fra split sheets"
                    avatar={<AttachMoney color="success" />}
                  />
                  <CardContent>
                    {/* Payment Status Distribution */}
                    {paymentAnalyticsData.data.statusDistribution && (
                      <Box mb={3}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                          Statusfordeling
                        </Typography>
                        <ResponsiveContainer width="100%" height={200}>
                          <RechartsPieChart>
                            <RechartsTooltip />
                            <Legend />
                            <Pie
                              data={paymentAnalyticsData.data.statusDistribution.map((item: any) => ({
                                name: item.status === 'paid' ? 'Betalt' : 
                                      item.status === 'pending' ? 'Venter' : 
                                      item.status === 'overdue' ? 'Forfalt' : item.status,
                                value: item.count
                              }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              label
                            >
                              {paymentAnalyticsData.data.statusDistribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                    {/* Average Processing Time */}
                    {paymentAnalyticsData.data.averageProcessing && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                          Gjennomsnittlig behandlingstid
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {paymentAnalyticsData.data.averageProcessing.avgDays.toFixed(1)} dager
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Min: {paymentAnalyticsData.data.averageProcessing.minDays.toFixed(1)} dager | 
                          Max: {paymentAnalyticsData.data.averageProcessing.maxDays.toFixed(1)} dager
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Split Sheet Market Insights */}
            {marketInsightsData?.data && (
              <Grid item xs={12} lg={6}>
                <Card sx={{ bgcolor: 'info.light', border: '2px solid', borderColor: 'info.main' }}>
                  <CardHeader 
                    title="📊 Split Sheet Markedsinnsikt"
                    subheader="Industribenchmarks og anbefalinger"
                    avatar={<TrendingUp color="info" />}
                  />
                  <CardContent>
                    {/* Average Splits by Role */}
                    {marketInsightsData.data.averageSplitsByRole && marketInsightsData.data.averageSplitsByRole.length > 0 && (
                      <Box mb={2}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                          Gjennomsnittlige split-prosenter per rolle
                        </Typography>
                        <List dense>
                          {marketInsightsData.data.averageSplitsByRole.slice(0, 5).map((role: any, index: number) => (
                            <ListItem key={index}>
                              <ListItemIcon><TrendingUp color="primary" fontSize="small" /></ListItemIcon>
                              <ListItemText 
                                primary={`${role.role}: ${role.avgPercentage.toFixed(1)}%`}
                                secondary={`Range: ${role.minPercentage.toFixed(1)}% - ${role.maxPercentage.toFixed(1)}% (${role.count} split sheets)`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                    {/* Recommendations */}
                    {marketInsightsData.data.recommendations && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
                          Anbefalinger
                        </Typography>
                        <List dense>
                          {marketInsightsData.data.recommendations.map((rec: string, index: number) => (
                            <ListItem key={index}>
                              <ListItemIcon><InfoOutlined color="info" fontSize="small" /></ListItemIcon>
                              <ListItemText primary={rec} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}
          </>
        )}

        {/* System Status */}
        {systemStatus && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="System Status"
                subheader={`Sist oppdatert: ${new Date(systemStatus.timestamp).toLocaleString('no-NO')}`}
                avatar={<Assessment color="success" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Analytics Engine</Typography>
                    <Chip
                      label={systemStatus.analyticsEngine === 'active' ? 'Aktiv' : 'Inaktiv'}
                      color={systemStatus.analyticsEngine === 'active' ? 'success': 'error'}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Data Nøyaktighet</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600}}>
                      {systemStatus.performance?.dataAccuracy || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Response Time</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600}}>
                      {systemStatus.performance?.queryResponseTime || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Versjon</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600}}>
                      {systemStatus.version || 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
                {/* Profession usage analytics */}
                {(() => {
                  const profAnalytics = getProfessionAnalytics();
                  if (!profAnalytics) return null;
                  return (
                    <Box mt={2}>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        Profesjonsaktivitet: {typeof profAnalytics === 'object' && 'totalEvents' in profAnalytics
                          ? `${(profAnalytics as { totalEvents: number }).totalEvents} hendelser registrert`
                          : 'Sporing aktiv'}
                      </Typography>
                    </Box>
                  );
                })()}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
