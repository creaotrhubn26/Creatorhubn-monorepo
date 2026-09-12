// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import EditingVendorWorkspace from '../universal/editing-marketplace/EditingVendorWorkspace';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Button,
  LinearProgress,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  Store,
  Inventory,
  ShoppingCart,
  TrendingUp,
  AttachMoney,
  Group,
  Star,
  Download,
  Upload,
  Sync,
  Analytics,
  Extension,
  CloudDownload,
  CloudUpload,
  Assignment,
  Assessment,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { vendorOperationService } from '@/services/VendorOperationService';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

// Tospråklig innhold — utenlandske vendors ser engelsk ved default.
const STR = {
  no: {
    title: 'Leverandør Dashboard', subtitle: 'Plugin-leverandør og produkthåndtering',
    pushSettings: 'Push-varsler innstillinger', close: 'Lukk',
    stats: ['Totale Produkter', 'Aktive Bestillinger', 'Plugin Downloads', 'Månedlig Omsetning'],
    activeOps: 'Aktive Vendor-operasjoner', complete: 'fullført',
    pluginPerf: 'Plugin Ytelse', noPluginData: 'Ingen plugin-data tilgjengelig', recentActivity: 'Nylig Aktivitet',
    uploadPlugin: 'Last opp Plugin', syncLicenses: 'Synkroniser Lisenser', genReport: 'Generer Rapport',
    acts: [
      ['Native Instruments Kontakt 7 oppdatert', 'Ny versjon 7.8.1 tilgjengelig for nedlasting', '2 timer siden'],
      ['Bestilling #128470 fullført', 'Komplete 14 Ultimate levert til kunde', '4 timer siden'],
      ['Lisenser synkronisert', '156 aktive lisenser oppdatert i systemet', '6 timer siden'],
      ['Månedlig rapport generert', 'August 2025 salgsrapport er klar', '1 dag siden'],
    ],
  },
  en: {
    title: 'Vendor Dashboard', subtitle: 'Plugin vendor & product management',
    pushSettings: 'Push notification settings', close: 'Close',
    stats: ['Total products', 'Active orders', 'Plugin downloads', 'Monthly revenue'],
    activeOps: 'Active vendor operations', complete: 'complete',
    pluginPerf: 'Plugin performance', noPluginData: 'No plugin data available', recentActivity: 'Recent activity',
    uploadPlugin: 'Upload plugin', syncLicenses: 'Sync licenses', genReport: 'Generate report',
    acts: [
      ['Native Instruments Kontakt 7 updated', 'New version 7.8.1 available for download', '2 hours ago'],
      ['Order #128470 completed', 'Komplete 14 Ultimate delivered to customer', '4 hours ago'],
      ['Licenses synced', '156 active licenses updated in the system', '6 hours ago'],
      ['Monthly report generated', 'August 2025 sales report is ready', '1 day ago'],
    ],
  },
};

interface VendorDashboardProps {
  profession: 'vendor';
  userId: string;
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
  onNotificationCreate?: (notification: any) => void
}

export default function VendorDashboard({ 
  profession, 
  userId,
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
}: VendorDashboardProps) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry, features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('vendor');
  
  // Comprehensive Feature System for Vendor Dashboard
  const vendorDashboardAccess = features.checkFeatureAccess('vendor-dashboard,');
  const inventoryManagementAccess = features.checkFeatureAccess('inventory-management,');
  const orderManagementAccess = features.checkFeatureAccess('order-management');
  const customerManagementAccess = features.checkFeatureAccess('customer-management');
  const analyticsAccess = features.checkFeatureAccess('analytics');
  const reportingAccess = features.checkFeatureAccess('reporting');
  const productCatalogAccess = features.checkFeatureAccess('product-catalog');
  const salesTrackingAccess = features.checkFeatureAccess('sales-tracking');
  
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    communication.registerComponent('vendor-dashboard', 'dashboard', [
      'data: read', 'data: write', 'event: emit', 'event: listen', 'ui: update', 'vendor: manage', 'product: manage', 'order: manage', 'analytics: track', 'notification: manage'
    ]);

    // Track feature usage
    features.trackFeatureUsage('vendor-dashboard', 'opened', {
      timestamp: Date.now(),
      component: 'VendorDashboard',
      activeTab: activeTab
});

    // Register data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'vendor-dashboard',
      dataKey: 'vendor-dashboard:stats',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'vendor-dashboard',
      dataKey: 'vendor-dashboard:products',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'vendor-dashboard',
      dataKey: 'vendor-dashboard:orders',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    return () => {
      communication.unregisterComponent('vendor-dashboard');
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
      if (message.type === 'client: selected' && message.data) {
        if (onClientSelect) {
          onClientSelect(message.data);
    }
    }
      if (message.type === 'data: sync' && message.data.dataKey === 'vendor-dashboard:stats') {
        // Handle stats sync
        console.log('Vendor stats synced, :', message.data.data);
    }
  });
    return unsubscribe;
}, [communication, onProjectSelect, onClientSelect]);

  // Fetch vendor-specific data
  const { data: vendorStats } = useQuery({
    queryKey: ['/api/vendor/stats', userId],
    queryFn: () => apiRequest(`/api/vendor/stats/${userId}`)
});

  const { data: vendorProducts } = useQuery({
    queryKey: ['/api/vendor/products', userId],
    queryFn: () => apiRequest(`/api/vendor/products/${userId}`)
});

  const { data: vendorOrders } = useQuery({
    queryKey: ['/api/vendor/orders', userId],
    queryFn: () => apiRequest(`/api/vendor/orders/${userId}`)
});

  const { data: pluginMetrics } = useQuery({
    queryKey: ['/api/vendor/plugin-metrics', userId],
    queryFn: () => apiRequest(`/api/vendor/plugin-metrics/${userId}`)
});

  // #15: utenlandsk redigeringsvendor får HELE dashboardet på engelsk =
  // det allerede-engelske arbeidsområdet (vi skipper den norske chromen).
  const { data: editingMe } = useQuery({
    queryKey: ['/api/editing/vendor/me'],
    queryFn: () => apiRequest('/api/editing/vendor/me'),
  });
  const isEditingVendor = Boolean(editingMe?.isEditingVendor);
  // Utenlandsk vendor → engelsk ved default (gjelder generisk plugin-/produkt-vendor).
  const locale = editingMe?.isForeign ? 'en' : 'no';
  const L = STR[locale];

  // Get active vendor operations
  const activeOperations = vendorOperationService.getActiveOperations();

  const vendorStatsCards = [
    { title: L.stats[0], value: vendorStats?.totalProducts || 0, icon: <Inventory />, color: '#e74c30', trend: '+12%' },
    { title: L.stats[1], value: vendorStats?.activeOrders || 0, icon: <ShoppingCart />, color: '#3498db', trend: '+8%' },
    { title: L.stats[2], value: vendorStats?.pluginDownloads || 0, icon: <CloudDownload />, color: '#9b59b0', trend: '+25%' },
    { title: L.stats[3], value: `${vendorStats?.monthlyRevenue || 0} NOK`, icon: <AttachMoney />, color: '#27ae60', trend: '+15%' },
  ];

  const recentVendorActivities = [
    { type: 'plugin_upload', title: L.acts[0][0], description: L.acts[0][1], time: L.acts[0][2], icon: <CloudUpload sx={{ color: '#9b59b6'}} /> },
    { type: 'order_completed', title: L.acts[1][0], description: L.acts[1][1], time: L.acts[1][2], icon: <Assignment sx={{ color: '#27ae60'}} /> },
    { type: 'license_sync', title: L.acts[2][0], description: L.acts[2][1], time: L.acts[2][2], icon: <Sync sx={{ color: '#3498db'}} /> },
    { type: 'analytics_generated', title: L.acts[3][0], description: L.acts[3][1], time: L.acts[3][2], icon: <Assessment sx={{ color: '#e74c3c'}} /> },
  ];

  // Redigeringsvendors (foto/video) ser KUN redigerings-arbeidsområdet:
  // Partner-dashboard + oppdrag/compliance/katalog/chat — IKKE den generiske
  // plugin-/produkt-vendor-chromen. Workspace self-lokaliserer (no/en) ut fra land.
  if (isEditingVendor) {
    return (
      <Box sx={{ p: { xs: 1.5, md: 3 } }}>
        <EditingVendorWorkspace userId={userId} />
      </Box>
    );
  }

  // Generisk plugin-/produkt-vendor-dashboard (kun ikke-redigeringsvendors).
  return (
    <Box sx={{ p:  3 }}>
      {/* Vendor Header */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" sx={{  
          fontWeight: 700, 
          color: '#27ae60',
          display: 'flex', 
          alignItems: 'center',
          mb: 1  }}>
          <Store sx={{ mr: 2, fontSize: 40}} />
          {L.title}
        </Typography>
        <Typography variant="h6" sx={{  color: 'text.secondary' }}>
          {L.subtitle}
        </Typography>
        
        {/* Feature Analytics Display */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: 1, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
            </Typography>
            <Chip 
              label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '10px', height: 18}}
            />
          </Box>
          {isSupported && (
            <Tooltip title={L.pushSettings}>
              <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                {pushEnabled ? <NotificationsActive /> : <Notifications />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Vendor Stats Cards */}
      <Grid container spacing={2} sx={{ mb:  4 }}>
        {vendorStatsCards.map((stat, index) => (
          <Grid size={{ xs:  12, sm:  6, md:  3 }} key={index}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card sx={{
                background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}25 100%)`,
                border: `1px solid ${stat.color}30`,
                height: '100%'
          ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  2 }}>
                    <Box>
                      <Typography variant="h5" sx={{  fontWeight: 700, color: stat.color, mb:  1  }}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary'}}>
                        {stat.title}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: `${stat.color}20`, color: stat.color }}>
                      {stat.icon}
                    </Avatar>
                  </Box>
                  <Chip 
                    label={stat.trend}
                    size="small"
                    sx={{ 
                      bgcolor: `${stat.color}20`,
                      color: stat.color,
                      fontWeight: 600}}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Active Vendor Operations */}
      {activeOperations.length > 0 && (
        <Card sx={{ mb:  4, border: '1px solid #9b59b630',  ...theming.getThemedCardSx() }}>
          <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
            <Typography variant="h6" sx={{  
              fontWeight: 600,
              color: '#9b59b0',
              display: 'flex',
              alignItems: 'center',
              mb: 2  }}>
              <CloudUpload sx={{ mr:  2 }} />
              {L.activeOps}
            </Typography>
            <List>
              {activeOperations.map((operation) => (
                <ListItem key={operation.id} sx={{ px:  0 }}>
                  <ListItemIcon>
                    {operation.operationType === 'plugin_download' && <CloudDownload sx={{ color: '#3498db'}} />}
                    {operation.operationType === 'license_sync' && <Sync sx={{ color: '#27ae60'}} />}
                    {operation.operationType === 'asset_upload' && <CloudUpload sx={{ color: '#9b59b6'}} />}
                    {operation.operationType === 'update_check' && <Analytics sx={{ color: '#e74c3c'}} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {operation.vendor} - {operation.pluginName || operation.operationType}
                        </Typography>
                        <Chip
                          label={operation.status}
                          size="small"
                          color={operation.status === 'processing' ? 'primary' : 'default'}
                        />
                      </Box>
                  }
                    secondary={
                      <Box sx={{ mt:  1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={operation.progress}
                          sx={{ mb:  1 }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary'}}>
                          {operation.progress}% {L.complete}
                        </Typography>
                      </Box>
                  }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Plugin Performance */}
        <Grid size={{ xs:  12, md:  6 }}>
          <Card sx={{ height: '100%', border: '1px solid #3498db30',  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{  
                fontWeight: 600,
                color: '#3498db',
                display: 'flex',
                alignItems: 'center',
                mb: 3  }}>
                <Extension sx={{ mr:  2 }} />
                {L.pluginPerf}
              </Typography>
              
              {pluginMetrics?.topPlugins?.map((plugin: any, index: number) => (
                <Box key={index} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #f0f0f0'}}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {plugin.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#3498db', fontWeight: 600 }}>
                      {plugin.downloads} downloads
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(plugin.downloads / (pluginMetrics.maxDownloads || 1)) * 100}
                    sx={{ 
                      height:  8,
                      borderRadius:  4,
                      bgcolor: '#3498db2','& .MuiLinearProgress-bar': {
                        bgcolor: '#3498db'
                  }
                  }}
                  />
                </Box>
              )) || (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py:  3 }}>
                  {L.noPluginData}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Vendor Activity */}
        <Grid size={{ xs:  12, md:  6 }}>
          <Card sx={{ height: '100%', border: '1px solid #27ae6030',  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" sx={{  
                fontWeight: 600,
                color: '#27ae60',
                display: 'flex',
                alignItems: 'center',
                mb: 3  }}>
                <TrendingUp sx={{ mr:  2 }} />
                {L.recentActivity}
              </Typography>
              
              <List sx={{ p:  0 }}>
                {recentVendorActivities.map((activity, index) => (
                  <ListItem key={index} sx={{ px: 0, py: 1.5}}>
                    <ListItemIcon sx={{ minWidth: 40}}>
                      {activity.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5}}>
                          {activity.title}
                        </Typography>
                    }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5}}>
                            {activity.description}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.disabled'}}>
                            {activity.time}
                          </Typography>
                        </Box>
                    }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mt:  4, display: 'flex', gap: 2, flexWrap: 'wrap'}}>
        <Button variant="contained"
          startIcon={theming.getThemedIcon('cloudUpload')}
          onClick={() => {
            // Trigger plugin upload via Smart Queue Management
            console.log('Starting plugin upload...');
        }}
          sx={{
            bgcolor: '#9b59b0', '&:hover': { bgcolor: '#8e44ad',}
        }}
        >
          {L.uploadPlugin}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('sync')}
          onClick={() => {
            // Trigger license sync via Smart Queue Management
            console.log('Starting license sync...');
        }}
          sx={{
            borderColor: '#3498db',
            color: '#3498db','&:hover': { borderColor: '#2980b0', bgcolor: '#3498db10',}
        }}
        >
          {L.syncLicenses}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('assessment')}
          onClick={() => {
            // Generate vendor analytics report
            console.log('Generating analytics...');
        }}
          sx={{
            borderColor: '#e74c30',
            color: '#e74c30', '&:hover': { borderColor: '#c03920', bgcolor: '#e74c3c10',}
        }}
        >
          {L.genReport}
        </Button>
      </Box>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{L.pushSettings}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>{L.close}</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}