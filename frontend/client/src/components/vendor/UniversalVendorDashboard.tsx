import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Avatar,
  useTheme,
  alpha,
  Chip,
  Paper,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Store,
  TrendingUp,
  Download,
  Star,
  AttachMoney,
  Analytics,
  Visibility,
  Add,
  Edit,
  Notifications,
  ShoppingCart,
  Assessment,
  CloudUpload,
  Print,
  AudioFile,
  Brush,
  Code,
  Security,
  Launch,
  Category,
  People,
  Schedule,
  Settings,
  Inventory
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import UniversalVendorShowcase from '../showcase/UniversalVendorShowcase';
import { getVendorTypeConfig, VendorTypeConfig } from '@shared/vendor-type-registry';
const UniversalVendorOnboarding = React.lazy(() => import('./UniversalVendorOnboarding'));
import VendorQuickStats from './VendorQuickStats';
import VendorTasksWidget from './VendorTasksWidget';
import VendorOrdersManager from './VendorOrdersManager';
import VendorInventoryManager from './VendorInventoryManager';
import VendorInsightsWidget from './VendorInsightsWidget';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface UniversalVendorDashboardProps {
  vendorType: string; // Now supports any registered vendor type
  vendorName: string;
  userId: string;
  compact?: boolean;
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

// Dynamic vendor type configuration - now uses registry
function getVendorDashboardConfig(vendorType: string) {
  const config = getVendorTypeConfig(vendorType);
  
  if (!config) {
    console.warn(`Unknown vendor type: ${vendorType}`);
    // Return default config
    return {
      name: 'Unknown Vendor',
      color: '#9e9e9e',
      icon: <Store />,
      primaryActions: [
        { label: 'Administrer', icon: <Edit />, action: 'manage_general' }
      ],
      quickStats: [
        { label: 'Produkter', key: 'products', icon: <Store /> }
      ]
  };
}

  // Convert registry config to dashboard format
  return {
    name: config.name,
    color: config.color,
    icon: React.createElement(config.icon),
    primaryActions: config.primaryActions.map(action => ({
      ...action,
      icon: React.createElement(action.icon)
  })),
    quickStats: config.quickStats.map(stat => ({
      ...stat,
      icon: React.createElement(stat.icon)
  }))
};
}

export default function UniversalVendorDashboard({ 
  vendorType, 
  vendorName, 
  userId,
  compact = false,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: UniversalVendorDashboardProps) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  const config = getVendorDashboardConfig(vendorType);
  const vendorTypeConfig = getVendorTypeConfig(vendorType);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId, vendorName);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('universal-vendor-dashboard,', 'dashboard', [
      'data:read','data:write','event:emit','event:listen','ui:update','vendor:manage','product:manage','order:manage','analytics:track','notification:manage','showcase:manage'
    ]);

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-vendor-dashboard',
      dataKey: 'universal-vendor-dashboard:stats',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-vendor-dashboard',
      dataKey: 'universal-vendor-dashboard:products',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'universal-vendor-dashboard',
      dataKey: 'universal-vendor-dashboard:showcases',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now() })
  });

    return () => {
      communication.unregisterComponent('universal-vendor-dashboard');
  };
}, [communication, dataFlow]);

  // Listen to global events
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'project:selected' && message.data) {
        if (onProjectSelect) {
          onProjectSelect(message.data);
      }
    }
      if (message.type === 'client:selected' && message.data) {
        if (onClientSelect) {
          onClientSelect(message.data);
      }
    }
      if (message.type === 'data:sync' && message.data.dataKey === 'universal-vendor-dashboard:stats') {
        // Handle stats sync
        console.log('Universal vendor stats synced: ', message.data.data);
    }
  });
    return unsubscribe;
}, [communication, onProjectSelect, onClientSelect]);

  // Fetch vendor dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/vendor-dashboard', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-dashboard/${vendorType}/${vendorName}/${userId}`)
});

  // Fetch vendor showcase stats
  const { data: showcaseStats } = useQuery({
    queryKey: ['/api/universal-vendor-showcase-stats', vendorType, vendorName],
    queryFn: () => apiRequest(`/api/universal-vendor-showcase-stats/${vendorType}/${vendorName}`)
});

  // Check onboarding status
  const { data: onboardingStatus } = useQuery({
    queryKey: ['/api/vendor-onboarding/status', vendorType, userId],
    queryFn: () => apiRequest(`/api/vendor-onboarding/status/${vendorType}/${userId}`)
});

  const handleActionClick = (action: string) => {
    console.log(`🎯 Vendor action: ${action} for ${vendorType} - ${vendorName}`);
    // Implement specific actions based on vendor type
};

  // Show onboarding if not completed
  if (!compact && onboardingStatus && !onboardingStatus.isComplete) {
    return (
      <React.Suspense fallback={
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography>Laster onboarding...</Typography>
        </Box>
    }>
        <UniversalVendorOnboarding
          vendorType={vendorType}
          vendorName={vendorName}
          userId={userId}
          onComplete={() => {
            // Refresh dashboard data after onboarding
            window.location.reload();
        }}
        />
      </React.Suspense>
    );
}

  if (compact) {
    return (
      <Card sx={{ 
        height: '100%',
        border: `2px solid ${config.color}30`, '&:hover': { borderColor: config.color }
    }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ bgcolor: config.color, width: 32, height: 32 }}>
              {config.icon}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontSize: '0.9rem', fontWeight: 600}}>
                {vendorName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {config.name}
              </Typography>
            </Box>
          </Box>
          
          <Grid container spacing={1}>
            <Grid size={6}>
              <Typography variant="h5" sx={{ color: config.color, fontWeight: 700}}>
                {showcaseStats?.totalProducts || 0}
              </Typography>
              <Typography variant="caption">Produkter</Typography>
            </Grid>
            <Grid size={6}>
              <Typography variant="h5" sx={{ color: config.color, fontWeight: 700}}>
                {showcaseStats?.totalDownloads || 0}
              </Typography>
              <Typography variant="caption">Downloads</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
}

  return (
    <Box component="main" role="main" aria-label={`${config.name} Dashboard`} sx={{ p: 3 }}>
      {/* Universal Vendor Dashboard Header */}
      <Paper sx={{ 
        p: 3, 
        mb: 3, 
        background: `linear-gradient(135deg, ${config.color}15 0%, ${config.color}05 100%)`,
        border: `1px solid ${config.color}30`
    }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Avatar sx={{ 
            bgcolor: config.color, 
            width: 80, 
            height: 80,
            fontSize: '2rem',
            boxShadow: `0 8px 20px ${config.color}40`
        }}>
            {config.icon}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3" sx={{ 
              fontWeight: 70, 
              color: config.color,
              mb: 1
          }}>
              {vendorName}
            </Typography>
            <Typography variant="h6" sx={{ color: 'text.secondary', mb: 2 }}>
              {config.name} • Universal Vendor Dashboard
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={config.name}
                sx={{ 
                  bgcolor: config.color,
                  color: 'white',
                  fontWeight: 60
              }}
              />
              <Chip 
                label="Aktiv"
                color="success"
                size="small"
              />
            </Box>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {config.primaryActions.map((action, index) => (
              <Button
                key={index}
                variant="outlined"
                startIcon={React.cloneElement(action.icon, { 'aria-hidden': true })}
                onClick={() => handleActionClick(action.action)}
                aria-label={action.label}
                sx={{
                  borderColor: config.color,
                  color: config.color,
                  minHeight: 48,
                  '&:hover': {
                    borderColor: config.color,
                    bgcolor: `${config.color}10`
                  },
                  '&:focus-visible': {
                    outline: `3px solid ${config.color}`,
                    outlineOffset: '2px'
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
            
            {/* Push Notifications Bell */}
            {isSupported && (
              <IconButton
                onClick={() => setPushSettingsOpen(true)}
                aria-label={pushEnabled ? 'Push-varsler aktivert - Åpne innstillinger' : 'Push-varsler deaktivert - Åpne innstillinger'}
                sx={{
                  color: pushEnabled ? config.color : 'text.secondary',
                  minWidth: 48,
                  minHeight: 48,
                  '&:focus-visible': {
                    outline: `3px solid ${config.color}`,
                    outlineOffset: '2px'
                  }
                }}
              >
                <Badge
                  variant="dot"
                  color="success"
                  invisible={!pushEnabled}
                  aria-hidden="true"
                >
                  <Notifications aria-hidden="true" />
                </Badge>
              </IconButton>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Dashboard Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Main Performance Stats */}
        <Grid size={{ xs: 12 }} md={8}>
          <Card sx={{ height: '100%', border: `1px solid ${config.color}30` }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, color: config.color }}>
                Performance Oversikt
              </Typography>
              
              <Grid container spacing={3}>
                <Grid size={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ 
                      bgcolor: `${config.color}15`, 
                      color: config.color,
                      mx: 'auto', 
                      mb: 1,
                      width: 56,
                      height: 56
                  }}>
                      <Store />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 70, color: config.color }}>
                      {showcaseStats?.totalProducts || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Totale Produkter
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid size={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ 
                      bgcolor: `${config.color}15`, 
                      color: config.color,
                      mx: 'auto', 
                      mb: 1,
                      width: 56,
                      height: 56
                  }}>
                      <Download />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 70, color: config.color }}>
                      {showcaseStats?.totalDownloads || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Downloads
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid size={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ 
                      bgcolor: `${config.color}15`, 
                      color: config.color,
                      mx: 'auto', 
                      mb: 1,
                      width: 56,
                      height: 56
                  }}>
                      <Star />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 70, color: config.color }}>
                      {showcaseStats?.averageRating?.toFixed(1) || '0.0'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Gjennomsnitt Rating
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid size={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Avatar sx={{ 
                      bgcolor: `${config.color}15`, 
                      color: config.color,
                      mx: 'auto', 
                      mb: 1,
                      width: 56,
                      height: 56
                  }}>
                      <TrendingUp />
                    </Avatar>
                    <Typography variant="h4" sx={{ fontWeight: 70, color: config.color }}>
                      {showcaseStats?.featuredProducts || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Fremhevede
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Category Stats */}
        <Grid size={{ xs: 12 }} md={4}>
          <Card sx={{ height: '100%', border: `1px solid ${config.color}30` }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
                Kategori Oversikt
              </Typography>
              
              <List dense>
                {config.quickStats.map((stat, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Avatar sx={{ 
                        bgcolor: `${config.color}10`, 
                        color: config.color,
                        width: 32, 
                        height: 32 
                    }}>
                        {stat.icon}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText 
                      primary={stat.label}
                      secondary={`${Math.floor(Math.random() * 50 + 10)} produkter`} // Replace with real data
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dashboard Tabs */}
      <Card sx={{ border: `1px solid ${config.color}30` }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Dashboard navigasjon"
            sx={{
              '& .MuiTab-root': {
                '&.Mui-selected': {
                  color: config.color
              }
            }, '& .MuiTabs-indicator': {
                backgroundColor: config.color
            }
          }}
          >
            <Tab label="Oversikt" icon={<Analytics aria-hidden="true" />} iconPosition="start" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Showcase" icon={<Visibility aria-hidden="true" />} iconPosition="start" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="Produkter" icon={<Store aria-hidden="true" />} iconPosition="start" id="tab-2" aria-controls="tabpanel-2" />
            <Tab label="Ordre" icon={<ShoppingCart aria-hidden="true" />} iconPosition="start" id="tab-3" aria-controls="tabpanel-3" />
            <Tab label="Lager" icon={<Inventory aria-hidden="true" />} iconPosition="start" id="tab-4" aria-controls="tabpanel-4" />
            <Tab label="Statistikk" icon={<Assessment aria-hidden="true" />} iconPosition="start" id="tab-5" aria-controls="tabpanel-5" />
            <Tab label="Innstillinger" icon={<Settings aria-hidden="true" />} iconPosition="start" id="tab-6" aria-controls="tabpanel-6" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Overview with Quick Stats, Insights, and Tasks */}
          {activeTab === 0 && (
            <Box role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0" hidden={activeTab !== 0}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <VendorQuickStats
                  vendorType={vendorType}
                  vendorName={vendorName}
                  userId={userId}
                  onStatClick={(statKey) => {
                    // Navigate to relevant tab
                    if (statKey === 'pending_orders') setActiveTab(3);
                    if (statKey === 'low_stock') setActiveTab(4);
                    if (statKey === 'products') setActiveTab(2);
                  }}
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <VendorInsightsWidget
                  vendorType={vendorType}
                  vendorName={vendorName}
                  userId={userId}
                  onInsightAction={(action, data) => {
                    // Handle insight actions
                    if (action === 'reorder_bestseller') setActiveTab(4);
                    if (action === 'view_high_views_low_sales') setActiveTab(2);
                    if (action === 'edit_descriptions') setActiveTab(2);
                    if (action === 'setup_bring_shipping') setActiveTab(4);
                    if (action === 'view_pricing_recommendations') setActiveTab(2);
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <VendorTasksWidget
                  vendorType={vendorType}
                  vendorName={vendorName}
                  userId={userId}
                  onTaskClick={(action) => {
                    // Navigate to relevant tab based on task action
                    if (action === 'add_products') setActiveTab(2);
                    if (action === 'setup_payment') setActiveTab(6);
                    if (action === 'create_showcase') setActiveTab(1);
                    if (action === 'setup_inventory') setActiveTab(4);
                  }}
                />
              </Grid>
            </Grid>
            </Box>
          )}

          {/* Tab 1: Showcase */}
          {activeTab === 1 && (
            <Box role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1" hidden={activeTab !== 1}>
            <UniversalVendorShowcase
              vendorType={vendorType}
              vendorName={vendorName}
              userId={userId}
              viewMode="admin"
            />
            </Box>
          )}
          
          {/* Tab 2: Products */}
          {activeTab === 2 && (
            <Box role="tabpanel" id="tabpanel-2" aria-labelledby="tab-2" hidden={activeTab !== 2}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ 
                bgcolor: config.color, 
                mx: 'auto', 
                mb: 2,
                width: 80,
                height: 80,
                fontSize: '2rem'
            }}>
                {config.icon}
              </Avatar>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
                Produktadministrasjon
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
                Administrer dine {config.name.toLowerCase()} produkter
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add aria-hidden="true" />}
                sx={{
                  bgcolor: config.color,
                  minHeight: 48,
                  '&:hover': { bgcolor: alpha(config.color, 0.8) },
                  '&:focus-visible': {
                    outline: `3px solid ${config.color}`,
                    outlineOffset: '2px'
                  }
              }}
                onClick={() => handleActionClick('add_product')}
                aria-label="Legg til nytt produkt"
              >
                Legg til nytt produkt
              </Button>
            </Box>
            </Box>
          )}

          {/* Tab 3: Orders */}
          {activeTab === 3 && (
            <Box role="tabpanel" id="tabpanel-3" aria-labelledby="tab-3" hidden={activeTab !== 3}>
            <VendorOrdersManager
              vendorType={vendorType}
              vendorName={vendorName}
              userId={userId}
            />
            </Box>
          )}

          {/* Tab 4: Inventory */}
          {activeTab === 4 && (
            <Box role="tabpanel" id="tabpanel-4" aria-labelledby="tab-4" hidden={activeTab !== 4}>
            <VendorInventoryManager
              vendorType={vendorType}
              vendorName={vendorName}
              userId={userId}
            />
            </Box>
          )}
          
          {/* Tab 5: Statistics */}
          {activeTab === 5 && (
            <Box role="tabpanel" id="tabpanel-5" aria-labelledby="tab-5" hidden={activeTab !== 5}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ 
                bgcolor: config.color, 
                mx: 'auto', 
                mb: 2,
                width: 80,
                height: 80,
                fontSize: '2rem'
            }} aria-hidden="true">
                <Analytics aria-hidden="true" />
              </Avatar>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
                Detaljert Statistikk
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                Avanserte analytics og rapporter kommer snart
              </Typography>
            </Box>
            </Box>
          )}
          
          {/* Tab 6: Settings */}
          {activeTab === 6 && (
            <Box role="tabpanel" id="tabpanel-6" aria-labelledby="tab-6" hidden={activeTab !== 6}>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ 
                bgcolor: config.color, 
                mx: 'auto', 
                mb: 2,
                width: 80,
                height: 80,
                fontSize: '2rem'
            }} aria-hidden="true">
                <Edit aria-hidden="true" />
              </Avatar>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2, color: config.color }}>
                Vendor Innstillinger
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                Konfigurer dine vendor-spesifikke innstillinger
              </Typography>
            </Box>
            </Box>
          )}
        </Box>
      </Card>

      {/* Push Notification Settings Dialog */}
      <Dialog
        open={pushSettingsOpen}
        onClose={() => setPushSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="push-settings-title"
      >
        <DialogTitle id="push-settings-title">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Notifications sx={{ color: config.color }} aria-hidden="true" />
            <Typography variant="h6" component="h2">
              Push-varsler for {vendorName}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <PushNotificationSettings 
              userId={userId} 
              contextId={vendorName}
              showDescription={true}
            />
          </Box>
          <Box sx={{ mt: 3, p: 2, bgcolor: alpha(config.color, 0.1), borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Du vil motta varsler om:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ShoppingCart sx={{ fontSize: 18, color: config.color }} aria-hidden="true" />
                </ListItemIcon>
                <ListItemText primary="Nye bestillinger" secondary="Umiddelbart når kunder kjøper" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Inventory sx={{ fontSize: 18, color: config.color }} aria-hidden="true" />
                </ListItemIcon>
                <ListItemText primary="Lav lagerbeholdning" secondary="Når produkter er i ferd med å gå tomt" />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TrendingUp sx={{ fontSize: 18, color: config.color }} aria-hidden="true" />
                </ListItemIcon>
                <ListItemText primary="Viktige oppdateringer" secondary="Produktanbefalinger og innsikt" />
              </ListItem>
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setPushSettingsOpen(false)}
            sx={{
              minHeight: 48,
              '&:focus-visible': {
                outline: `3px solid ${config.color}`,
                outlineOffset: '2px'
              }
            }}
          >
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}