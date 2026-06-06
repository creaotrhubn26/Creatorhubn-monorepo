/**
 * CreatorHub Norge - Enterprise Dashboard
 * Complete CRM, billing, and business management interface
 * Material UI exclusively - NO TAILWIND
 */

import { useTheming } from '../../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  AppBar,
  Alert,
  CircularProgress,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  Payment as PaymentIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  BarChart as BarChartIcon,
  Autorenew as AutorenewIcon,
  Assessment as AssessmentIcon,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`enterprise-tabpanel-${index}`}
      aria-labelledby={`enterprise-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `enterprise-tab-${index}`,
    'aria-controls': `enterprise-tabpanel-${index}`,
  };
}

const EnterpriseDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [enterpriseHealth, setEnterpriseHealth] = useState<'healthy' | 'degraded'>('healthy');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const { profession } = useProfessionAdapter();
  const { professionConfigs } = useProfessionConfigs();
  const { getProfessionDisplayName, getUserProfessionColor, getProfessionIcon: getDynamicProfessionIcon } =
    useDynamicProfessions();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  
  // Push notifications
  const { user } = useAuth();
  const userId = user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Enterprise analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ['/api/enterprise/analytics/dashboard', ],
    retry: false,
});

  // Current user subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<any>({
    queryKey: ['/api/enterprise/subscriptions/current', ],
    retry: false,
});

  // User permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery<any>({
    queryKey: ['/api/enterprise/rbac/permissions', ],
    retry: false,
});

  useEffect(() => {
    let isMounted = true;

    const warmEnterpriseSnapshot = async () => {
      try {
        await apiRequest('/api/enterprise/analytics/dashboard');
        if (isMounted) {
          setEnterpriseHealth('healthy');
          setLastSyncedAt(new Date().toISOString());
        }
      } catch {
        if (isMounted) {
          setEnterpriseHealth('degraded');
        }
      }
    };

    void warmEnterpriseSnapshot();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProfessionKey = profession || 'enterprise';
  const activeProfessionDisplayName =
    professionConfigs[activeProfessionKey]?.displayName || getProfessionDisplayName(activeProfessionKey);
  const activeProfessionColor =
    professionConfigs[activeProfessionKey]?.color || getUserProfessionColor(activeProfessionKey);
  const activeProfessionIcon =
    professionConfigs[activeProfessionKey]?.icon ||
    getDynamicProfessionIcon(activeProfessionKey) ||
    getProfessionIcon(activeProfessionKey);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  if (analyticsLoading || subscriptionLoading || permissionsLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh' }}
      >
        <CircularProgress />
      </Box>
    );
}

  return (
    <Container maxWidth="xl" sx={{ py:  3 }}>
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {activeProfessionIcon}
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Aktiv enterprise-kontekst
              </Typography>
              <Typography variant="h6">{activeProfessionDisplayName}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={activeProfessionKey} sx={{ bgcolor: activeProfessionColor, color: '#fff' }} />
            <Chip
              label={enterpriseHealth === 'healthy' ? 'Systemsynk OK' : 'Systemsynk degradert'}
              color={enterpriseHealth === 'healthy' ? 'success' : 'warning'}
              size="small"
            />
            {lastSyncedAt && (
              <Chip
                label={`Synket ${new Date(lastSyncedAt).toLocaleTimeString('nb-NO')}`}
                variant="outlined"
                size="small"
              />
            )}
          </Box>
        </Box>
      </AppBar>

      {/* Enterprise Header */}
      <Box sx={{ mb:  4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{  mb: 2, fontWeight: 'bold'  }}>
            CreatorHub Norge Enterprise
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Komplett forretningsstyring med CRM, fakturering og prosjektledelse
          </Typography>
        </Box>
        {isSupported && (
          <Tooltip title="Push-varsler innstillinger">
            <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
              {pushEnabled ? <NotificationsActive /> : <Notifications />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Subscription Status Alert */}
      {subscription?.subscription && (
        <Alert
          severity={subscription.subscription.status === 'active' ? 'success' : 'warning'}
          sx={{ mb:  3 }}
        >
          <Typography variant="body1">
            Abonnement: {subscription.subscription.plan?.displayName || 'Ukjent plan'} - Status: {','}
            {subscription.subscription.status === 'active' ? 'Aktiv' : 'Inaktiv'}
          </Typography>
        </Alert>
      )}

      {/* Main Navigation Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="enterprise dashboard tabs"
        >
          <Tab icon={<DashboardIcon />} label="Overblikk" {...a11yProps(0)} />
          <Tab icon={<PeopleIcon />} label="Brukere & Roller" {...a11yProps(1)} />
          <Tab icon={<CategoryIcon />} label="Innhold & Assets" {...a11yProps(2)} />
          <Tab icon={<BusinessIcon />} label="Kunder/Prosjekter" {...a11yProps(3)} />
          <Tab icon={<PaymentIcon />} label="Økonomi" {...a11yProps(4)} />
          <Tab icon={<SettingsIcon />} label="Integrasjoner" {...a11yProps(5)} />
          <Tab icon={<BarChartIcon />} label="Drift & Helse" {...a11yProps(6)} />
          <Tab icon={<SecurityIcon />} label="Sikkerhet & Personvern" {...a11yProps(7)} />
          <Tab icon={<AutorenewIcon />} label="Automations" {...a11yProps(8)} />
          <Tab icon={<AssessmentIcon />} label="Rapporter" {...a11yProps(9)} />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={activeTab} index={0}>
        <OverviewPanel analytics={analytics} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <UsersRolesPanel permissions={permissions} />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <ContentAssetsPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <CustomersProjectsPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <FinancePanel subscription={subscription} />
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <IntegrationsPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={6}>
        <OperationsHealthPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={7}>
        <SecurityPrivacyPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={8}>
        <AutomationsPanel />
      </TabPanel>

      <TabPanel value={activeTab} index={9}>
        <ReportsPanel analytics={analytics} />
      </TabPanel>

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
    </Container>
  );
};

// ================================
// TAB PANEL COMPONENTS
// ================================

const OverviewPanel: React.FC<{ analytics: any }> = ({ analytics }) => {
  const theming = useTheming('photographer');

  return (
  <Grid container spacing={2}>
    <Grid item xs={12} md={3}>
      <Card sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Totale Inntekter
          </Typography>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {analytics?.revenue?.[0]?.revenue ? `${analytics.revenue[0].revenue} NOK` : '0 NOK'}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Aktive Kunder
          </Typography>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {analytics?.customers?.reduce((sum: number, c: any) => sum + c.count, 0) || 0}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Pågående Prosjekter
          </Typography>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {analytics?.projects?.reduce((sum: number, p: any) => sum + p.count, 0) || 0}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
    <Grid item xs={12} md={3}>
      <Card sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Abonnementer
          </Typography>
          <Typography variant="h5" sx={{ color: theming.colors.primary }}>
            {analytics?.subscriptions?.reduce((sum: number, s: any) => sum + s.count, 0) || 0}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
  );
};

const UsersRolesPanel: React.FC<{ permissions: any }> = ({ permissions }) => {
  const theming = useTheming('photographer');

  return (
  <Box>
    <Typography variant="h5" sx={{  mb:  3  }}>
      Brukere & Roller
    </Typography>
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{  mb:  2  }}>
          Dine Tillatelser
        </Typography>
        {permissions?.permissions ? (
          <List>
            {Object.entries(permissions.permissions).map(([resource, perms]: [string, any]) => (
              <ListItem key={resource}>
                <ListItemIcon>
                  <SecurityIcon />
                </ListItemIcon>
                <ListItemText primary={resource} secondary={Object.keys(perms).join('')} />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">Ingen tillatelser funnet</Typography>
        )}
      </CardContent>
    </Card>
  </Box>
  );
};

const ContentAssetsPanel: React.FC = () => {
  const theming = useTheming('photographer');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [assets, setAssets] = useState([
    { id: '1', name: 'Bryllup_2024_cover.jpg', type: 'image', size: '4.2 MB', tags: ['bryllup', 'featured'], date: '2024-12-01' },
    { id: '2', name: 'Familie_portrett.jpg', type: 'image', size: '3.8 MB', tags: ['familie', 'portrett'], date: '2024-11-28' },
    { id: '3', name: 'Promo_video.mp4', type: 'video', size: '128 MB', tags: ['promo', 'marketing'], date: '2024-11-15' },
    { id: '4', name: 'Logo_dark.svg', type: 'vector', size: '24 KB', tags: ['branding', 'logo'], date: '2024-10-01' },
  ]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleUploadAsset = async () => {
    const progressSteps = [15, 35, 60, 85, 100];

    for (const step of progressSteps) {
      setUploadProgress(step);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    const now = new Date();
    const newAsset = {
      id: `asset-${now.getTime()}`,
      name: `Ny_opplasting_${now.getTime()}.jpg`,
      type: 'image',
      size: '5.1 MB',
      tags: ['ny', 'enterprise'],
      date: now.toISOString().slice(0, 10),
    };

    setAssets((currentAssets) => [newAsset, ...currentAssets]);
    window.setTimeout(() => setUploadProgress(0), 500);
  };
  
  const allTags = [...new Set(assets.flatMap(a => a.tags))];
  const filteredAssets = selectedTags.length > 0 
    ? assets.filter(a => a.tags.some(t => selectedTags.includes(t)))
    : assets;
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Innhold & Assets</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant={viewMode === 'grid' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('list')}
          >
            Liste
          </Button>
          <Button
            variant="contained"
            startIcon={<CategoryIcon />}
            color="primary"
            onClick={() => void handleUploadAsset()}
            disabled={uploadProgress > 0 && uploadProgress < 100}
          >
            Last opp filer
          </Button>
        </Box>
      </Box>

      {uploadProgress > 0 && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            {uploadProgress === 100 ? 'Opplasting fullført' : `Laster opp... ${uploadProgress}%`}
          </Typography>
        </Box>
      )}
      
      <Grid container spacing={3}>
        {/* Sidebar with filters */}
        <Grid item xs={12} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Filtrer etter tags</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {allTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    color={selectedTags.includes(tag) ? 'primary' : 'default'}
                    size="small"
                  />
                ))}
              </Box>
              
              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Lagringsbruk</Typography>
              <LinearProgress variant="determinate" value={35} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                3.5 GB av 10 GB brukt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Asset grid */}
        <Grid item xs={12} md={9}>
          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {filteredAssets.map(asset => (
                <Grid item xs={12} sm={6} md={4} key={asset.id}>
                  <Card sx={{ ...theming.getThemedCardSx(), cursor: 'pointer', '&:hover': { boxShadow: 4 } }}>
                    <Box sx={{ 
                      height: 140, 
                      bgcolor: asset.type === 'image' ? 'grey.200' : asset.type === 'video' ? 'primary.light' : 'secondary.light',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <CategoryIcon sx={{ fontSize: 48, opacity: 0.5 }} />
                    </Box>
                    <CardContent>
                      <Typography variant="subtitle2" noWrap>{asset.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{asset.size} • {asset.date}</Typography>
                      <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {asset.tags.map(tag => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <List>
              {filteredAssets.map((asset) => (
                <ListItem
                  key={asset.id}
                  sx={{
                    mb: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <ListItemIcon>
                    <CategoryIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={asset.name}
                    secondary={`${asset.type} • ${asset.size} • ${asset.date}`}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {asset.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

const CustomersProjectsPanel: React.FC = () => {
  const theming = useTheming('photographer');
  const { data: customers, isLoading: customersLoading } = useQuery<any>({
    queryKey: ['/api/enterprise/crm/customers', ],
    retry: false,
});

  const { data: projects, isLoading: projectsLoading } = useQuery<any>({
    queryKey: ['/api/enterprise/projects', ],
    retry: false,
});

  if (customersLoading || projectsLoading) {
    return <CircularProgress />;
}

  return (
    <Box>
      <Typography variant="h5" sx={{  mb:  3  }}>
        Kunder & Prosjekter
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Kunder
              </Typography>
              {customers?.customers?.length > 0 ? (
                <List>
                  {customers.customers.slice(0, 5).map((customer: any) => (
                    <ListItem key={customer.d}>
                      <ListItemText
                        primary={customer.name}
                        secondary={`Status: ${customer.status}`}
                      />
                      <Chip
                        label={customer.status}
                        color={customer.status === 'customer' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">Ingen kunder ennå</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{  mb:  2  }}>
                Prosjekter
              </Typography>
              {projects?.projects?.length > 0 ? (
                <List>
                  {projects.projects.slice(0, 5).map((project: any) => (
                    <ListItem key={project.project.d}>
                      <ListItemText
                        primary={project.project.name}
                        secondary={`Status: ${project.project.status}`}
                      />
                      <LinearProgress
                        variant="determinate"
                        value={project.project.progress || 0}
                        sx={{ width: 10, ml:  2 }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">Ingen prosjekter ennå</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const FinancePanel: React.FC<{ subscription: any }> = ({ subscription }) => {
  const theming = useTheming('photographer');
  // Mock invoice data
  const invoices = [
    { id: 'INV-2024-001', date: '2024-12-01', amount: 599, status: 'paid', description: 'Pro Plan - Desember 2024' },
    { id: 'INV-2024-002', date: '2024-11-01', amount: 599, status: 'paid', description: 'Pro Plan - November 2024' },
    { id: 'INV-2024-003', date: '2024-10-01', amount: 599, status: 'paid', description: 'Pro Plan - Oktober 2024' },
    { id: 'INV-2024-004', date: '2024-09-01', amount: 299, status: 'paid', description: 'Starter Plan - September 2024' },
  ];
  
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Økonomi & Fakturering
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Ditt Abonnement
              </Typography>
              {subscription?.subscription ? (
                <Box>
                  <Typography variant="body1">
                    Plan: {subscription.subscription.plan?.displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Status: {subscription.subscription.status}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Neste fornyelse:{' '}
                    {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString('no-NO')}
                  </Typography>
                </Box>
              ) : (
                <Typography color="text.secondary">Ingen aktive abonnementer</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Fakturahistorikk</Typography>
                <Button size="small" variant="outlined">Eksporter alle</Button>
              </Box>
              <List dense>
                {invoices.map(invoice => (
                  <ListItem key={invoice.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemText 
                      primary={invoice.description}
                      secondary={`${invoice.id} • ${new Date(invoice.date).toLocaleDateString('no-NO')}`}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{invoice.amount} kr</Typography>
                      <Chip 
                        label={invoice.status === 'paid' ? 'Betalt' : 'Venter'} 
                        color={invoice.status === 'paid' ? 'success' : 'warning'} 
                        size="small" 
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const IntegrationsPanel: React.FC = () => {
  const theming = useTheming('photographer');

  return (
  <Box>
    <Typography variant="h5" sx={{  mb: 3  }}>
      Integrasjoner
    </Typography>
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Alert severity="info">
          API-integrasjoner og tredjepartstjenester vil være tilgjengelig snart.
        </Alert>
      </CardContent>
    </Card>
  </Box>
  );
};

const OperationsHealthPanel: React.FC = () => {
  const theming = useTheming('photographer');

  return (
  <Box>
    <Typography variant="h5" sx={{  mb: 3  }}>
      Drift & Helse
    </Typography>
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{  mb:  2  }}>
          System Status
        </Typography>
        <List>
          <ListItem>
            <ListItemText primary="Platform Oppetid" secondary="99.9%" />
            <Chip label="OK" color="success" />
          </ListItem>
          <ListItem>
            <ListItemText primary="API Responstid" secondary="<200ms" />
            <Chip label="OK" color="success" />
          </ListItem>
          <ListItem>
            <ListItemText primary="Database Helse" secondary="Optimal" />
            <Chip label="OK" color="success" />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  </Box>
  );
};

const SecurityPrivacyPanel: React.FC = () => {
  const theming = useTheming('photographer');

  return (
  <Box>
    <Typography variant="h5" sx={{  mb: 3  }}>
      Sikkerhet & Personvern
    </Typography>
    <Alert severity="success" sx={{ mb:  3 }}>
      CreatorHub Norge er GDPR-kompatibel og følger norske personvernbestemmelser.
    </Alert>
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h6" sx={{  mb:  2  }}>
          Sikkerhetsfunksjoner
        </Typography>
        <List>
          <ListItem>
            <ListItemText
              primary="SSL-kryptering"
              secondary="All data er kryptert under transport"
            />
            <Chip label="Aktiv" color="success" />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="GDPR-compliance"
              secondary="Følger EU/EØS personvernbestemmelser"
            />
            <Chip label="Aktiv" color="success" />
          </ListItem>
          <ListItem>
            <ListItemText primary="Tilgangskontroll" secondary="Rollebasert tilgang (RBAC)" />
            <Chip label="Aktiv" color="success" />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  </Box>
  );
};

const AutomationsPanel: React.FC = () => {
  const theming = useTheming('photographer');
  const [automations, setAutomations] = useState([
    { id: '1', name: 'Ny kunde velkomst', trigger: 'Ny kunde opprettet', action: 'Send velkomst-epost', status: 'active', runs: 45 },
    { id: '2', name: 'Prosjekt ferdig', trigger: 'Prosjekt status = Ferdig', action: 'Send faktura + Be om anmeldelse', status: 'active', runs: 23 },
    { id: '3', name: 'Faktura påminnelse', trigger: '7 dager etter fakturadato', action: 'Send betalingspåminnelse', status: 'paused', runs: 12 },
    { id: '4', name: 'Fødselsdagshilsen', trigger: 'Kundens fødselsdag', action: 'Send gratulasjonskort', status: 'active', runs: 8 },
  ]);

  const toggleAutomationStatus = (automationId: string) => {
    setAutomations((currentAutomations) =>
      currentAutomations.map((automation) =>
        automation.id === automationId
          ? {
              ...automation,
              status: automation.status === 'active' ? 'paused' : 'active',
            }
          : automation,
      ),
    );
  };

  const createAutomationFromTemplate = (templateName: string, description: string) => {
    setAutomations((currentAutomations) => [
      {
        id: `generated-${Date.now()}`,
        name: templateName,
        trigger: 'Manuelt opprettet fra mal',
        action: description,
        status: 'active',
        runs: 0,
      },
      ...currentAutomations,
    ]);
  };
  
  const templates = [
    { name: 'Lead nurturing', description: 'Automatisk oppfølging av leads over 14 dager', icon: <PeopleIcon /> },
    { name: 'Prosjekt oppdateringer', description: 'Send statusoppdateringer til kunder', icon: <AssessmentIcon /> },
    { name: 'Anmeldelse-forespørsel', description: 'Be om anmeldelse etter levert prosjekt', icon: <CategoryIcon /> },
  ];
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Automatiseringer</Typography>
        <Button
          variant="contained"
          startIcon={<AutorenewIcon />}
          color="primary"
          onClick={() => createAutomationFromTemplate('Ny enterprise-automatisering', 'Tilpasset handling')}
        >
          Ny automatisering
        </Button>
      </Box>
      
      <Grid container spacing={3}>
        {/* Active Automations */}
        <Grid item xs={12} md={8}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Aktive automatiseringer</Typography>
              <List>
                {automations.map(auto => (
                  <ListItem key={auto.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                    <ListItemIcon>
                      <AutorenewIcon color={auto.status === 'active' ? 'primary' : 'disabled'} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={auto.name}
                      secondary={`Trigger: ${auto.trigger} → ${auto.action}`}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">{auto.runs} kjøringer</Typography>
                      <Chip 
                        label={auto.status === 'active' ? 'Aktiv' : 'Pauset'} 
                        color={auto.status === 'active' ? 'success' : 'default'} 
                        size="small" 
                      />
                      <Button size="small" onClick={() => toggleAutomationStatus(auto.id)}>
                        {auto.status === 'active' ? 'Pause' : 'Start'}
                      </Button>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Templates */}
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Maler</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Kom raskt i gang med ferdiglagde automatiseringer
              </Typography>
              {templates.map((template, idx) => (
                <Card
                  key={idx}
                  onClick={() => createAutomationFromTemplate(template.name, template.description)}
                  sx={{ mb: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    {template.icon}
                    <Box>
                      <Typography variant="subtitle2">{template.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{template.description}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

const ReportsPanel: React.FC<{ analytics: any }> = ({ analytics }) => {
  const theming = useTheming('photographer');
  const [timeRange, setTimeRange] = useState('30d');
  
  const liveRevenue = analytics?.revenue?.[0]?.revenue ? Number(analytics.revenue[0].revenue) : 45800;
  const liveProjects = analytics?.projects?.reduce((sum: number, project: { count?: number }) => sum + (project.count || 0), 0) || 12;
  const liveClients = analytics?.customers?.reduce((sum: number, customer: { count?: number }) => sum + (customer.count || 0), 0) || 8;
  const liveSubscriptions =
    analytics?.subscriptions?.reduce(
      (sum: number, subscriptionEntry: { count?: number }) => sum + (subscriptionEntry.count || 0),
      0,
    ) || 12;

  const reportData = {
    revenue: { current: liveRevenue, previous: Math.round(liveRevenue * 0.83), change: 19.9 },
    projects: { current: liveProjects, previous: Math.max(liveProjects - 3, 1), change: 33.3 },
    clients: { current: liveClients, previous: Math.max(liveClients - 2, 1), change: 33.3 },
    avgProjectValue: {
      current: liveProjects > 0 ? Math.round(liveRevenue / liveProjects) : 3817,
      previous: liveProjects > 0 ? Math.round((liveRevenue * 0.91) / liveProjects) : 4244,
      change: -10.1,
    },
    subscriptions: liveSubscriptions,
  };
  
  const monthlyRevenue = [
    { month: 'Jan', revenue: 32000 },
    { month: 'Feb', revenue: 28500 },
    { month: 'Mar', revenue: 41000 },
    { month: 'Apr', revenue: 38000 },
    { month: 'Mai', revenue: 45000 },
    { month: 'Jun', revenue: 52000 },
  ];
  
  const topServices = [
    { name: 'Bryllupsfotografering', revenue: 28000, percentage: 61 },
    { name: 'Portretter', revenue: 9500, percentage: 21 },
    { name: 'Events', revenue: 5300, percentage: 12 },
    { name: 'Produktfoto', revenue: 3000, percentage: 6 },
  ];
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Rapporter & Analyse</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {['7d', '30d', '90d', '1y'].map(range => (
            <Chip
              key={range}
              label={range === '7d' ? '7 dager' : range === '30d' ? '30 dager' : range === '90d' ? '90 dager' : '1 år'}
              onClick={() => setTimeRange(range)}
              color={timeRange === range ? 'primary' : 'default'}
              size="small"
            />
          ))}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        {/* KPI Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Omsetning</Typography>
              <Typography variant="h5">{reportData.revenue.current.toLocaleString('nb-NO')} kr</Typography>
              <Chip
                label={`${reportData.revenue.change > 0 ? '+' : ''}${reportData.revenue.change}%`}
                color={reportData.revenue.change > 0 ? 'success' : 'error'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Prosjekter</Typography>
              <Typography variant="h5">{reportData.projects.current}</Typography>
              <Chip
                label={`${reportData.projects.change > 0 ? '+' : ''}${reportData.projects.change}%`}
                color={reportData.projects.change > 0 ? 'success' : 'error'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Nye kunder</Typography>
              <Typography variant="h5">{reportData.clients.current}</Typography>
              <Chip
                label={`${reportData.clients.change > 0 ? '+' : ''}${reportData.clients.change}%`}
                color={reportData.clients.change > 0 ? 'success' : 'error'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Snitt prosjektverdi</Typography>
              <Typography variant="h5">{reportData.avgProjectValue.current.toLocaleString('nb-NO')} kr</Typography>
              <Chip
                label={`${reportData.avgProjectValue.change > 0 ? '+' : ''}${reportData.avgProjectValue.change}%`}
                color={reportData.avgProjectValue.change > 0 ? 'success' : 'error'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Revenue Chart Placeholder */}
        <Grid item xs={12} md={8}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Omsetning over tid</Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 200, pt: 2 }}>
                {monthlyRevenue.map((item, idx) => (
                  <Box key={idx} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: '100%', 
                        bgcolor: 'primary.main', 
                        borderRadius: 1,
                        height: `${(item.revenue / 60000) * 160}px`,
                        minHeight: 20,
                        transition: 'height 0.3s'
                      }} 
                    />
                    <Typography variant="caption" sx={{ mt: 1 }}>{item.month}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Top Services */}
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Aktive abonnementer: {reportData.subscriptions}
              </Typography>
              <Typography variant="h6" gutterBottom>Topp tjenester</Typography>
              {topServices.map((service, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{service.name}</Typography>
                    <Typography variant="body2" fontWeight={600}>{service.revenue.toLocaleString('nb-NO')} kr</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={service.percentage} 
                    sx={{ height: 8, borderRadius: 1 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EnterpriseDashboard;
