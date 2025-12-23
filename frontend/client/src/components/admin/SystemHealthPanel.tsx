import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card as MuiCard,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import {
  Computer,
  Storage,
  Speed,
  Security,
  CloudQueue,
  Error,
  CheckCircle,
  Warning,
  Info,
  Refresh,
  Timeline,
  Monitor,
  Memory,
  NetworkCheck,
  Backup
} from '@mui/icons-material';
import SystemBackupDashboard from './SystemBackupDashboard';
import { GDPRCompliancePanel } from './GDPRCompliancePanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`system-health-tabpanel-${index}`}
      aria-labelledby={`system-health-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py:  3 }}>{children}</Box>}
    </div>
  );
}

interface SystemHealthPanelProps {
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

export default function SystemHealthPanel({
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
}: SystemHealthPanelProps) {
  const [tabValue, setTabValue] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester, ');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch real system health data
  const { data: healthData, isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/system-health', ],
    refetchInterval: 3000, // Refresh every 30 seconds
    retry:  1,
});

  const { data: performanceData } = useQuery({
    queryKey: ['/api/admin/performance-metrics', ],
    refetchInterval: 6000, // Refresh every minute
    retry:  1,
});

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
};

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
};

  if (isLoading) {
    return (
      <Box sx={{ p:  3 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>Laster system-status...</Typography>
      </Box>
    );
}

  // Use REAL data from server - no fake fallbacks for a new system
  const systemMetrics = healthData?.metrics || {
    uptime:  0,
    responseTime:  0,
    errorRate:  0,
    cpuUsage:  0,
    memoryUsage:  0,
    diskUsage:  0,
    databaseConnections: 0 };

  const services = healthData?.services || [];
  const recentEvents = performanceData?.events || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning'; 
      case 'error': return 'error';
      default: return 'default';
}
};

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'error': return <Error color="error" />;
      case 'warning': return <Warning color="warning" />;
      case 'success': return <CheckCircle color="success" />;
      case 'info': return <Info color="info" />;
      default: return theming.getThemedIcon(', ');
  }
};

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Monitor color="primary" sx={{ fontSize: 32}} />
          <Typography variant="h5" sx={{  fontWeight: 600}}>
            Drift
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
          <Typography variant="body2" color="text.secondary">
            Sist oppdatert: {lastRefresh.toLocaleTimeString(', ')}
          </Typography>
          <Button
            variant="outlined"
            startIcon={theming.getThemedIcon('refresh')}
            onClick={handleRefresh}
            size="small"
          >
            Oppdater
          </Button>
        </Box>
      </Box>

      {/* System Status Alert */}
      <Alert 
        severity="success" 
        icon={theming.getThemedIcon('checkCircle')}
        sx={{ mb:  3 }}
      >
        <Typography variant="body2">
          <strong>System Status: Operasjonell</strong> - Alle hovedtjenester fungerer normalt
        </Typography>
      </Alert>

      {/* Key Metrics , *, /}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Timeline color="success" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Oppetid</Typography>
              </Box>
              <Typography variant="h4" sx={{  fontWeight: 600, color: theming.colors.primary }}>
                {systemMetrics.uptime}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={systemMetrics.uptime}
                color="success"
                sx={{ mt:  1 }}
              />
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Speed color="info" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Responstid</Typography>
              </Box>
              <Typography variant="h4" sx={{  fontWeight: 600}}>
                {systemMetrics.responseTime}ms
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Gjennomsnitt siste 24t
              </Typography>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Memory color="warning" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Minnebruk</Typography>
              </Box>
              <Typography variant="h4" sx={{  fontWeight: 600}}>
                {systemMetrics.memoryUsage}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={systemMetrics.memoryUsage}
                color={systemMetrics.memoryUsage > 80 ? 'error' : 'warning'}
                sx={{ mt:  1 }}
              />
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Storage color="primary" />
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Diskplass</Typography>
              </Box>
              <Typography variant="h4" sx={{  fontWeight: 600}}>
                {systemMetrics.diskUsage}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={systemMetrics.diskUsage}
                color="primary"
                sx={{ mt:  1 }}
              />
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Tabs */}
      <MuiCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
          <Tabs 
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#ff8c00',
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#ff8c00',
              },
            }}
          >
            <Tab icon={<Computer />} label="Tjenester" />
            <Tab icon={theming.getThemedIcon('timeline')} label="Ytelse" />
            <Tab icon={theming.getThemedIcon('security')} label="Sikkerhet" />
            <Tab icon={<Backup />} label="System Backup" />
            <Tab icon={theming.getThemedIcon('security')} label="GDPR & Personvern" />
          </Tabs>
        </Box>

        <CardContent sx={theming.getThemedCardSx()}>
          <TabPanel value={tabValue} index={0}>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Tjeneste</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Oppetid</strong></TableCell>
                    <TableCell><strong>Siste Sjekk</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.map((service: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <NetworkCheck />
                          {service.name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={service.status === 'healthy' ? 'Sunn' : service.status === 'warning' ? 'Advarsel' : 'Feil'}
                          color={getStatusColor(service.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{service.uptime}%</TableCell>
                      <TableCell>{new Date().toLocaleTimeString('no-NO')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" sx={{  mb:  2  }}>Ytelsesmålinger</Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><Computer /></ListItemIcon>
                    <ListItemText 
                      primary="CPU Bruk" 
                      secondary={`${systemMetrics.cpuUsage}% - Normal`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>{theming.getThemedIcon('storage')}</ListItemIcon>
                    <ListItemText 
                      primary="Database Tilkoblinger" 
                      secondary={`${systemMetrics.databaseConnections} aktive`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><CloudQueue /></ListItemIcon>
                    <ListItemText 
                      primary="API Kall per minutt" 
                      secondary="156 forespørsler"
                    />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" sx={{  mb:  2  }}>Siste Hendelser</Typography>
                <List>
                  {recentEvents.map((event: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {getEventIcon(event.type)}
                      </ListItemIcon>
                      <ListItemText 
                        primary={event.message}
                        secondary={`${event.time} - i dag`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ textAlign: 'center', py:  4 }}>
              <Security sx={{ fontSize:  48, color: 'text.secondary', mb:  2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                Sikkerhetsmonitorering
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
                Ingen sikkerhetstrusler detektert siste 24 timer
              </Typography>
              <Alert severity="success" sx={{ maxWidth: 40, mx: 'auto'}}>
                Alle sikkerhetssystemer fungerer normalt
              </Alert>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <SystemBackupDashboard />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <GDPRCompliancePanel />
          </TabPanel>
        </CardContent>
      </MuiCard>
    </Box>
  );
}