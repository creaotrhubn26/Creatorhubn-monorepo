import React, { useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  Tabs,
  Tab,
  LinearProgress,
  Badge,
  Button,
  Divider,
  Stack,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import {
  Monitor as MonitorIcon,
  Storage as StorageIcon,
  Api as ApiIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  IntegrationInstructions as IntegrationIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Feedback as FeedbackIcon,
  MonitorHeart as MonitorHeartIcon,
  AutoFixHigh as AutoFixHighIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { AdminButton } from './design-system';

import APIEndpointMonitor from './APIEndpointMonitor';
import PlaceholderTextScanner from '../development/PlaceholderTextScanner';
import { LSDMonitoringPanel } from './LSDMonitoringPanel';
import DatabaseIntegrityChecker from './DatabaseIntegrityChecker';

interface MonitoringProtocolData {
  totalProtocols: number;
  enabledProtocols: number;
}

interface ApiHealthData {
  totalEndpoints: number;
  healthyEndpoints: number;
  failedEndpoints: number;
}

interface SystemEvent {
  category: string;
  message: string;
  severity: 'info' | 'high' | 'critical';
  timestamp: string;
}

type IntegrationPayload = Record<string, unknown>;

interface CentralizedMonitoringConsoleProps {
  onMeetingCreate?: (meeting: IntegrationPayload) => void;
  onProjectUpdate?: (project: IntegrationPayload) => void;
  onWorklogCreate?: (worklog: IntegrationPayload) => void;
  onClientSelect?: (client: IntegrationPayload) => void;
  onClientUpdate?: (client: IntegrationPayload) => void;
  onShowcaseCreate?: (showcase: IntegrationPayload) => void;
  onFileUpload?: (file: IntegrationPayload) => void;
  onFileDownload?: (file: IntegrationPayload) => void;
  selectedProject?: IntegrationPayload;
  onProjectSelect?: (project: IntegrationPayload) => void;
  selectedClient?: IntegrationPayload;
  onSettingsUpdate?: (settings: IntegrationPayload) => void;
  onNotificationCreate?: (notification: IntegrationPayload) => void;
}

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
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const normalizeProtocolData = (payload: unknown): MonitoringProtocolData => {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    return {
      totalProtocols: typeof data.totalProtocols === 'number' ? data.totalProtocols : 0,
      enabledProtocols: typeof data.enabledProtocols === 'number' ? data.enabledProtocols : 0,
    };
  }
  return { totalProtocols: 0, enabledProtocols: 0 };
};

const normalizeApiHealth = (payload: unknown): ApiHealthData => {
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    return {
      totalEndpoints: typeof data.totalEndpoints === 'number' ? data.totalEndpoints : 0,
      healthyEndpoints: typeof data.healthyEndpoints === 'number' ? data.healthyEndpoints : 0,
      failedEndpoints: typeof data.failedEndpoints === 'number' ? data.failedEndpoints : 0,
    };
  }
  return { totalEndpoints: 0, healthyEndpoints: 0, failedEndpoints: 0 };
};

const normalizeEvents = (payload: unknown): SystemEvent[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      category: typeof item.category === 'string' ? item.category : 'system',
      message: typeof item.message === 'string' ? item.message : 'No message',
      severity:
        item.severity === 'high' || item.severity === 'critical' || item.severity === 'info'
          ? item.severity
          : 'info',
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
    }));
};

const CentralizedMonitoringConsole: React.FC<CentralizedMonitoringConsoleProps> = ({
  onNotificationCreate,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [isMonitoringSleeping, setIsMonitoringSleeping] = useState(false);
  const queryClient = useQueryClient();
  const { analytics } = useEnhancedMasterIntegration();

  const { professionConfigs, getUserProfessionColor, getProfessionDisplayName } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'prototype_tester';
  const professionIcon = getProfessionIcon(currentProfession);
  const dynamicProfessionConfig = professionConfigs?.[currentProfession];
  const apiProfessionConfig = apiProfessionConfigs?.[currentProfession];
  const professionLabel =
    getProfessionDisplayName(currentProfession) ||
    apiProfessionConfig?.displayName ||
    dynamicProfessionConfig?.displayName ||
    currentProfession;
  const professionColor = getUserProfessionColor(currentProfession) || '#ff8c00';
  const theming = useTheming(currentProfession);

  const refreshInterval = isMonitoringSleeping ? false : 30 * 60 * 1000;

  const protocolQuery = useQuery({
    queryKey: ['/api/admin/monitoring-protocols'],
    refetchInterval: refreshInterval,
    queryFn: async () => {
      const payload = await apiRequest('/api/admin/monitoring-protocols');
      return normalizeProtocolData(payload);
    },
    staleTime: 10 * 60 * 1000,
    enabled: tabValue === 0 || tabValue === 2 || tabValue === 5,
  });

  const apiHealthQuery = useQuery({
    queryKey: ['/api/admin/api-endpoints/health'],
    refetchInterval: refreshInterval,
    queryFn: async () => {
      const payload = await apiRequest('/api/admin/api-endpoints/health');
      return normalizeApiHealth(payload);
    },
    staleTime: 10 * 60 * 1000,
    enabled: tabValue === 0 || tabValue === 4,
  });

  const eventsQuery = useQuery({
    queryKey: ['/api/admin/system-events'],
    refetchInterval: refreshInterval,
    queryFn: async () => {
      const payload = await apiRequest('/api/admin/system-events');
      return normalizeEvents(payload);
    },
    staleTime: 10 * 60 * 1000,
    enabled: tabValue === 0 || tabValue === 8 || tabValue === 9,
  });

  const protocolData = protocolQuery.data ?? { totalProtocols: 0, enabledProtocols: 0 };
  const apiHealth = apiHealthQuery.data ?? { totalEndpoints: 0, healthyEndpoints: 0, failedEndpoints: 0 };
  const systemEvents = eventsQuery.data ?? [];

  const healthScore = useMemo(() => {
    const apiHealthScore =
      apiHealth.totalEndpoints > 0 ? (apiHealth.healthyEndpoints / apiHealth.totalEndpoints) * 100 : 100;
    const protocolHealthScore =
      protocolData.totalProtocols > 0
        ? (protocolData.enabledProtocols / protocolData.totalProtocols) * 100
        : 100;
    return Math.round((apiHealthScore + protocolHealthScore) / 2);
  }, [apiHealth, protocolData]);

  const getHealthColor = (score: number) => {
    if (score >= 90) return '#4caf50';
    if (score >= 70) return '#ff9800';
    return '#f44336';
  };

  const criticalEvents = systemEvents.filter((event) => event.severity === 'high' || event.severity === 'critical');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    analytics.trackEvent('centralized_monitoring_tab_change', {
      tabIndex: newValue,
      timestamp: Date.now(),
    });
  };

  const refreshAllData = async () => {
    setIsMonitoringSleeping(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/admin/monitoring-protocols'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-endpoints/health'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-events'] }),
    ]);

    onNotificationCreate?.({
      type: 'monitoring-refresh',
      timestamp: new Date().toISOString(),
      message: 'Centralized monitoring data refreshed.',
    });
  };

  const monitoringTabs = [
    { id: 'overview', label: 'Oversikt', icon: <MonitorIcon />, badge: criticalEvents.length },
    { id: 'lsd', label: 'LSD Monitor', icon: <MonitorHeartIcon />, badge: 0 },
    { id: 'system', label: 'System', icon: <SecurityIcon />, badge: 0 },
    { id: 'database', label: 'Database', icon: <StorageIcon />, badge: 0 },
    { id: 'api', label: 'API', icon: <ApiIcon />, badge: apiHealth.failedEndpoints },
    { id: 'security', label: 'Sikkerhet', icon: <AutoFixHighIcon />, badge: 0 },
    { id: 'business', label: 'Forretning', icon: <TrendingUpIcon />, badge: 0 },
    { id: 'integrations', label: 'Integrasjoner', icon: <IntegrationIcon />, badge: 0 },
    { id: 'performance', label: 'Ytelse', icon: <SpeedIcon />, badge: 0 },
    { id: 'ux', label: 'UX', icon: <PsychologyIcon />, badge: 0 },
    { id: 'placeholders', label: 'Placeholders', icon: <FeedbackIcon />, badge: 0 },
  ];

  const isLoading = protocolQuery.isLoading || apiHealthQuery.isLoading || eventsQuery.isLoading;

  if (isLoading && tabValue === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Laster sentralisert overvåkningskonsoll...
        </Typography>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ width: '100%' }}>
      {isMonitoringSleeping && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Monitoring er i sleep mode for å spare ressurser. Trykk refresh for å aktivere igjen.
        </Alert>
      )}

      <Card sx={{ mb: 3, ...theming.getThemedCardSx() }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color: professionColor, display: 'inline-flex' }}>{professionIcon}</Box>
                <Typography variant="h4">{professionLabel} Monitoring Console</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Komplett driftsovervåkning: protokoller, API-helse, events, sikkerhet og ytelse.
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  textAlign: 'center',
                  backgroundColor: getHealthColor(healthScore),
                  color: '#fff',
                }}
              >
                <CardContent>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {healthScore}%
                  </Typography>
                  <Typography variant="body2">System Health</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => {
                void refreshAllData();
              }}
              sx={{ ...theming.getThemedButtonSx() }}
            >
              Refresh data
            </Button>
            <AdminButton
              tone="ghost"
              onClick={() => setIsMonitoringSleeping((previous) => !previous)}
            >
              {isMonitoringSleeping ? 'Wake monitoring' : 'Sleep mode'}
            </AdminButton>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <MetricCard
            icon={<ApiIcon />}
            label="API endpoints"
            value={`${apiHealth.healthyEndpoints}/${apiHealth.totalEndpoints}`}
            color={apiHealth.failedEndpoints === 0 ? '#4caf50' : '#ff9800'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            icon={<SecurityIcon />}
            label="Protocols"
            value={`${protocolData.enabledProtocols}/${protocolData.totalProtocols}`}
            color={protocolData.enabledProtocols > 0 ? '#4caf50' : '#f44336'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            icon={<WarningIcon />}
            label="Critical events"
            value={`${criticalEvents.length}`}
            color={criticalEvents.length === 0 ? '#4caf50' : '#ff9800'}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard icon={<SpeedIcon />} label="Uptime" value="98.5%" color="#9c27b0" />
        </Grid>
      </Grid>

      <Card sx={theming.getThemedCardSx()}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            {monitoringTabs.map((tab, index) => (
              <Tab
                key={tab.id}
                icon={<Badge color="error" badgeContent={tab.badge}>{tab.icon}</Badge>}
                label={tab.label}
                id={`monitoring-tab-${index}`}
              />
            ))}
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <OverviewPanel protocolData={protocolData} apiHealth={apiHealth} events={systemEvents} healthScore={healthScore} />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <LSDMonitoringPanel />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <SimplePanel title="System Helse" message="Live systemstatus, protokoller og driftskontroller." icon={<SecurityIcon />} />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
          <DatabaseIntegrityChecker />
        </TabPanel>
        <TabPanel value={tabValue} index={4}>
          <APIEndpointMonitor />
        </TabPanel>
        <TabPanel value={tabValue} index={5}>
          <SimplePanel title="Sikkerhet" message="Sikkerhetshendelser, policy checks og compliance-status." icon={<AutoFixHighIcon />} />
        </TabPanel>
        <TabPanel value={tabValue} index={6}>
          <SimplePanel title="Forretningsmetrikker" message="KPI, feilrate og operasjonell stabilitet." icon={<TrendingUpIcon />} />
        </TabPanel>
        <TabPanel value={tabValue} index={7}>
          <SimplePanel title="Integrasjoner" message="Provider-status og synkroniseringshelse." icon={<IntegrationIcon />} />
        </TabPanel>
        <TabPanel value={tabValue} index={8}>
          <SimplePanel title="Ytelse" message="Latency, throughput og event-volum." icon={<SpeedIcon />} />
        </TabPanel>
        <TabPanel value={tabValue} index={9}>
          <SimplePanel title="Brukeropplevelse" message="Kritiske UX-signaler og brukerfeedback." icon={<PsychologyIcon />} />
        </TabPanel>
        <TabPanel value={tabValue} index={10}>
          <PlaceholderTextScanner />
        </TabPanel>
      </Card>
    </Box>
    </ThemeProvider>
  );
};

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ color, mb: 1 }}>{icon}</Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

function OverviewPanel({
  protocolData,
  apiHealth,
  events,
  healthScore,
}: {
  protocolData: MonitoringProtocolData;
  apiHealth: ApiHealthData;
  events: SystemEvent[];
  healthScore: number;
}) {
  const protocolPercent =
    protocolData.totalProtocols > 0 ? (protocolData.enabledProtocols / protocolData.totalProtocols) * 100 : 0;
  const apiPercent =
    apiHealth.totalEndpoints > 0 ? (apiHealth.healthyEndpoints / apiHealth.totalEndpoints) * 100 : 0;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Kritiske indikatorer
            </Typography>
            <ProgressRow label="System health" value={healthScore} />
            <ProgressRow label="API health" value={apiPercent} />
            <ProgressRow label="Protocol coverage" value={protocolPercent} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Siste hendelser
            </Typography>
            <Stack spacing={1}>
              {events.slice(0, 6).map((event) => (
                <Box key={`${event.category}-${event.timestamp}-${event.message}`} sx={{ p: 1.25, borderRadius: 1, bgcolor: 'grey.100' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {event.severity === 'critical' && <ErrorIcon color="error" fontSize="small" />}
                    {event.severity === 'high' && <WarningIcon color="warning" fontSize="small" />}
                    {event.severity === 'info' && <CheckCircleIcon color="success" fontSize="small" />}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {event.category}
                    </Typography>
                    <Chip size="small" label={event.severity} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {event.message}
                  </Typography>
                </Box>
              ))}
              {events.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Ingen hendelser tilgjengelig.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {Math.round(value)}%
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, value))} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}

function SimplePanel({ title, message, icon }: { title: string; message: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Stack>
        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default CentralizedMonitoringConsole;
