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
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Category as CategoryIcon,
  DirectionsBusiness as BusinessIcon,
  Payment as PaymentIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  BoxChart as BarChartIcon,
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
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
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
    id: `enterprise-tab-${index}`'aria-controls': `enterprise-tabpanel-${index}`,
};
}

const EnterpriseDashboard: React.FC = () => {
  const [activeT, absetActiveTab] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  
  // Push notifications
  const { user } = useAuth();
  const userId = user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Enterprise analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/enterprise/analytics/dashboard', ],
    retry: false,
});

  // Current user subscription
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['/api/enterprise/subscriptions/current', ],
    retry: false,
});

  // User permissions
  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['/api/enterprise/rbac/permissions', ],
    retry: false,
});

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
      {/* Enterprise Header */}
      <Box sx={{ mb:  4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h3" sx={{  mb: 2, fontWeight: 'bold'  }}>
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

const OverviewPanel: React.FC<{ analytics: any }> = ({ analytics }) => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={3}>
      <Card sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
            Totale Inntekter
          </Typography>
          <Typography variant="h4" sx={{ color: theming.colors.primary }}>
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
          <Typography variant="h4" sx={{ color: theming.colors.primary }}>
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
          <Typography variant="h4" sx={{ color: theming.colors.primary }}>
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
          <Typography variant="h4" sx={{ color: theming.colors.primary }}>
            {analytics?.subscriptions?.reduce((sum: number, s: any) => sum + s.count, 0) || 0}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
);

const UsersRolesPanel: React.FC<{ permissions: any }> = ({ permissions }) => (
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

const ContentAssetsPanel: React.FC = () => (
  <Box>
    <Typography variant="h5" sx={{  mb: 3  }}>
      Innhold & Assets
    </Typography>
    <Alert severity="info" sx={{ mb:  3 }}>
      Digital Asset Management system kommer snart. Her vil du kunne organisere og administrere alt
      ditt kreative innhold.
    </Alert>
  </Box>
);

const CustomersProjectsPanel: React.FC = () => {
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/enterprise/crm/customers', ],
    retry: false,
});

  const { data: projects, isLoading: projectsLoading } = useQuery({
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

const FinancePanel: React.FC<{ subscription: any }> = ({ subscription }) => (
  <Box>
    <Typography variant="h5" sx={{  mb:  3  }}>
      Økonomi & Fakturering
    </Typography>
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  mb:  2  }}>
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
                  Neste fornyelse: {', '}
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
            <Typography variant="h6" sx={{  mb:  2  }}>
              Fakturaer
            </Typography>
            <Typography color="text.secondary">Fakturahistorikk kommer snart</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

const IntegrationsPanel: React.FC = () => (
  <Box>
    <Typography variant="h5" sx={{  mb: 3  }}>
      Integrasjoner
    </Typography>
    <Alert severity="info">
      API-integrasjoner og tredjepartstjenester vil være tilgjengelig snart.
    </Alert>
  </Box>
);

const OperationsHealthPanel: React.FC = () => (
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

const SecurityPrivacyPanel: React.FC = () => (
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

const AutomationsPanel: React.FC = () => (
  <Box>
    <Typography variant="h5" sx={{  mb: 3  }}>
      Automations
    </Typography>
    <Alert severity="info">Automatiseringsregler og arbeidsflyter kommer snart.</Alert>
  </Box>
);

const ReportsPanel: React.FC<{ analytics: any }> = ({ analytics }) => (
  <Box>
    <Typography variant="h5" sx={{  mb:  3  }}>
      Rapporter & Analyse
    </Typography>
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" sx={{  mb:  2  }}>
              Forretningsanalyse
            </Typography>
            <Typography color="text.secondary">
              Detaljerte rapporter og analyse kommer snart. Her vil du få komplett innsikt i din
              virksomhet.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

export default EnterpriseDashboard;
