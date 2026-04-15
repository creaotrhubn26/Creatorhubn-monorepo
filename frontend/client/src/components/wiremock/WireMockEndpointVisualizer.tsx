// @ts-nocheck
/**
 * WireMock Interactive Endpoint Visualizer
 * Real-time API simulation tracking and interactive endpoint management
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Alert,
  Stack,
  Divider,
  Fade,
  Zoom,
  Collapse,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Timeline as TimelineIcon,
  NetworkCheck as NetworkIcon,
  Api as ApiIcon,
  Code as CodeIcon,
  BugReport as BugIcon,
  Science as TestIcon,
  Monitor as MonitorIcon,
  Psychology as AiIcon,
  Payment as PaymentIcon,
  Security as SecurityIcon,
  Instagram as InstagramIcon,
  MusicNote as MusicIcon,
} from '@mui/icons-material';
import { useWireMock } from '@/hooks/useWireMock';

interface ApiCall {
  id: string;
  endpointId: string;
  method: string;
  url: string;
  timestamp: Date;
  responseTime: number;
  status: number;
  requestSize: number;
  responseSize: number;
  clientIp?: string
}

interface EndpointMetrics {
  totalCalls: number;
  avgResponseTime: number;
  successRate: number;
  errorRate: number;
  lastCalled: Date | null;
  callsPerMinute: number
}

const TabPanel: React.FC<{
  children?: React.ReactNode;
  value: number;
  index: number
}> = ({ children, value, index }) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ p:  3 }}>{children}</Box>}</div>
);

export function WireMockEndpointVisualizer() {
  const { status, endpoints, isLoading, toggleEndpoint, testEndpoint, refresh } = useWireMock();
  
  // Theming system
  const theming = useTheming('photographer');
  const [activeTab, setActiveTab] = useState(0);
  const [realtimeData, setRealtimeData] = useState<ApiCall[]>([]);
  const [endpointMetrics, setEndpointMetrics] = useState<Record<string, EndpointMetrics>>({});
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showLiveActivity, setShowLiveActivity] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!status?.isEnabled) return;

    const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/wiremock`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('🔗 WireMock WebSocket connected');
  };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'api_call') {
        const newCall: ApiCall = {
          id: `${Date.now()}-${Math.random()}`,
          endpointId: data.endpointd,
          method: data.method,
          url: data.url,
          timestamp: new Date(data.timestamp),
          responseTime: data.responseTime,
          status: data.status,
          requestSize: data.requestSize || 0,
          responseSize: data.responseSize || 0,
          clientIp: data.clientIp,
      };

        setRealtimeData((prev) => [newCall, ...prev.slice(0, 99)]); // Keep last 100 calls
        updateEndpointMetrics(newCall);
    }
  };

    wsRef.current.onerror = (error) => {
      console.error('❌ WireMock WebSocket error:', error);
  };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
    }
  };
}, [status?.isEnabled]);

  // Auto refresh mechanism
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
  }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
}, [autoRefresh, refresh]);

  // Update endpoint metrics
  const updateEndpointMetrics = (apiCall: ApiCall) => {
    setEndpointMetrics((prev) => {
      const current = prev[apiCall.endpointId] || {
        totalCalls: 0,
        avgResponseTime:  0,
        successRate: 10,
        errorRate:  0,
        lastCalled: null,
        callsPerMinute:  0,
    };

      const newTotalCalls = current.totalCalls + 1;
      const newAvgResponseTime =
        (current.avgResponseTime * current.totalCalls + apiCall.responseTime) / newTotalCalls;
      const isSuccess = apiCall.status >= 200 && apiCall.status < 400;
      const successCount =
        Math.round((current.successRate * current.totalCalls) / 100) + (isSuccess ? 1 : 0);
      const newSuccessRate = (successCount / newTotalCalls) * 100;

      return {
        ...prev,
        [apiCall.endpointId]: {
          totalCalls: newTotalCalls,
          avgResponseTime: newAvgResponseTime,
          successRate: newSuccessRate,
          errorRate: 100 - newSuccessRate,
          lastCalled: apiCall.timestamp,
          callsPerMinute: calculateCallsPerMinute(apiCall.endpointd, [...realtimeData, apiCall]),
      },
    };
  });
};

  // Calculate calls per minute for an endpoint
  const calculateCallsPerMinute = (endpointId: string, calls: ApiCall[]) => {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCalls = calls.filter(
      (call) => call.endpointId === endpointId && call.timestamp >= oneMinuteAo,
    );
    return recentCalls.length;
};

  // Get endpoint icon based on service
  const getEndpointIcon = (service: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      anthropic: <AiIcon sx={{ color: '#ff6b35' }} />,
      openai: <AiIcon sx={{ color: '#10a37f' }} />,
      gemini: <AiIcon sx={{ color: '#4285f4' }} />,
      vipps: <PaymentIcon sx={{ color: '#ff5100' }} />,
      stripe: <PaymentIcon sx={{ color: '#635bff' }} />,
      bankid: <SecurityIcon sx={{ color: '#005aa0' }} />,
      brreg: <SecurityIcon sx={{ color: '#d70926' }} />,
      instagram: <InstagramIcon sx={{ color: '#e4405f' }} />,
      spotify: <MusicIcon sx={{ color: '#1db954' }} />,
      custom: <ApiIcon sx={{ color: '#ff8c00' }} />,
  };
    return iconMap[service] || <ApiIcon sx={{ color: '#666' }} />;
};

  // Get status color
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    return 'error';
};

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <LinearProgress sx={{ width: '50%' }} />
        <Typography variant="body2" sx={{ ml:  2 }}>
          Laster WireMock Visualizer...
        </Typography>
      </Box>
    );
}

  if (!status?.isEnabled) {
    return (
      <Alert severity="info" sx={{ m:  2 }}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>WireMock er ikke aktivert</Typography>
        <Typography variant="body2">
          Aktiver WireMock for å begynne visualisering av API-endepunkter.
        </Typography>
      </Alert>
    );
}

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Controls */}
      <Paper sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
              🎯 Endpoint Visualizer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time API simulering og endpoint monitoring
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
              }
                label="Auto-oppdatering"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={showLiveActivity}
                    onChange={(e) => setShowLiveActivity(e.target.checked)}
                  />
              }
                label="Live aktivitet"
              />

              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refresh}>
                Oppdater
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Real-time Status Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Aktive Endepunkter
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {status.activeEndpoints}
                  </Typography>
                </Box>
                <NetworkIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    API-kall (siste min)
                  </Typography>
                  <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                    {
                      realtimeData.filter((call) => call.timestamp >= new Date(Date.now() - 60000))
                        .length
                  }
                  </Typography>
                </Box>
                <TrendingUpIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Gj.snitt responstid
                  </Typography>
                  <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                    {realtimeData.length > 0
                      ? Math.round(
                          realtimeData
                            .slice(0, 10)
                            .reduce((sum, call) => sum + call.responseTime, 0) /
                            Math.min(10, realtimeData.length),
                        )
                      : 0}
                    ms
                  </Typography>
                </Box>
                <SpeedIcon color="info" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Suksessrate
                  </Typography>
                  <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                    {realtimeData.length > 0
                      ? Math.round(
                          (realtimeData.filter((call) => call.status >= 200 && call.status < 400)
                            .length /
                            realtimeData.length) *
                            100,
                        )
                      : 100}
                    %
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Endpoint Oversikt" icon={<ApiIcon />} />
            <Tab label="Live Aktivitet" icon={<TimelineIcon />} />
            <Tab label="Test Console" icon={<Science />} />
            <Tab label="Metrics Dashboard" icon={<MonitorIcon />} />
          </Tabs>
        </Box>

        {/* Endpoint Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={2}>
            {endpoints.map((endpoint) => {
              const metrics = endpointMetrics[endpoint.id];
              const recentCalls = realtimeData
                .filter((call) => call.endpointId === endpoint.id)
                .slice(0, 5);

              return (
                <Grid item xs={12} md={6} lg={4} key={endpoint.id}>
                  <Card
                    sx={{
                      height: '100%',
                      border: selectedEndpoint === endpoint.id
                          ? '2px solid #ff8c00'
                          : '1px solid #e0e0e0',
                      transition: 'all 0.3s ease' }}
                   sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getEndpointIcon(endpoint.service)}
                          <Typography variant="h6" noWrap sx={{ color: theming.colors.primary }}>
                            {endpoint.name}
                          </Typography>
                        </Box>
                        <Chip
                          label={endpoint.method}
                          size="small"
                          color={endpoint.method === 'GET' ? 'info' : 'primary'}
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" noWrap mb={1}>
                        {endpoint.url}
                      </Typography>

                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Chip
                          label={endpoint.isActive ? 'Aktiv' : 'Inaktiv'}
                          size="small"
                          color={endpoint.isActive ? 'success' : 'default'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {endpoint.service}
                        </Typography>
                      </Box>

                      {metrics && (
                        <Box mb={2}>
                          <Typography variant="caption" color="text.secondary">
                            Statistikk
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6} >
                              <Typography variant="body2">Kall: {metrics.totalCalls}</Typography>
                            </Grid>
                            <Grid item xs={6} >
                              <Typography variant="body2">
                                Respons: {Math.round(metrics.avgResponseTime)}ms
                              </Typography>
                            </Grid>
                            <Grid item xs={6} >
                              <Typography variant="body2" color="success.main">
                                ✓ {Math.round(metrics.successRate)}%
                              </Typography>
                            </Grid>
                            <Grid item xs={6} >
                              <Typography variant="body2">{metrics.callsPerMinute}/min</Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {recentCalls.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Siste kall
                          </Typography>
                          <Stack spacing={0.5}>
                            {recentCalls.map((call) => (
                              <Box key={call.id} display="flex" alignItems="center" gap={1}>
                                <Chip
                                  label={call.status}
                                  size="small"
                                  color={getStatusColor(call.status)}
                                  sx={{ minWidth: 50}}
                                />
                                <Typography variant="caption">{call.responseTime}ms</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {call.timestamp.toLocaleTimeString()}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      )}
                    </CardContent>

                    <CardActions sx={theming.getThemedCardSx()}>
                      <Button
                        size="small"
                        startIcon={endpoint.isActive ? <StopIcon /> : <PlayIcon />}
                        onClick={() => toggleEndpoint(endpoint.id, !endpoint.isActive)}
                      >
                        {endpoint.isActive ? 'Stopp' : 'Start'}
                      </Button>

                      <Button
                        size="small"
                        startIcon={<Science />}
                        onClick={() => testEndpoint(endpoint)}
                      >
                        Test
                      </Button>

                      <Button
                        size="small"
                        startIcon={<ViewIcon />}
                        onClick={() => setSelectedEndpoint(endpoint.id)}
                      >
                        Detaljer
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
          })}
          </Grid>
        </TabPanel>

        {/* Live Activity Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box mb={2}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Live API-aktivitet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time sporing av API-kall og responser
            </Typography>
          </Box>

          {realtimeData.length === 0 ? (
            <Alert severity="info">
              Ingen API-aktivitet registrert ennå. Start testing av endepunkter for å se live data.
            </Alert>
          ) : (
            <List>
              {realtimeData.slice(0, 20).map((call, index) => {
                const endpoint = endpoints.find((ep) => ep.id === call.endpointId);

                return (
                  <Fade in timeout={500} key={call.id}>
                    <ListItem
                      sx={{
                        mb:  1,
                        bgcolor: 'background.paper',
                        borderRadius:  1,
                        border:'1px solid #e0e0e0' }}
                    >
                      <ListItemIcon>
                        {endpoint ? getEndpointIcon(endpoint.service) : <ApiIcon />}
                      </ListItemIcon>

                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip label={call.method} size="small" color="primary" />
                            <Typography variant="body1" component="span">
                              {endpoint?.name || call.url}
                            </Typography>
                            <Chip
                              label={call.status}
                              size="small"
                              color={getStatusColor(call.status)}
                            />
                          </Box>
                      }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {call.url}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                              <Typography variant="caption">⏱️ {call.responseTime}ms</Typography>
                              <Typography variant="caption">📤 {call.requestSize}B</Typography>
                              <Typography variant="caption">📥 {call.responseSize}B</Typography>
                              <Typography variant="caption">
                                🕐 {call.timestamp.toLocaleTimeString()}
                              </Typography>
                              {call.clientIp && (
                                <Typography variant="caption">🌐 {call.clientIp}</Typography>
                              )}
                            </Box>
                          </Box>
                      }
                      />
                    </ListItem>
                  </Fade>
                );
            })}
            </List>
          )}
        </TabPanel>

        {/* Test Console Tab */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Interactive Test Console
          </Typography>
          <Alert severity="info" sx={{ mb:  3 }}>
            Her kan du teste endepunkter interaktivt og se responser i sanntid.
          </Alert>
          {/* Test console content will be implemented in next iteration */}
        </TabPanel>

        {/* Metrics Dashboard Tab */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Metrics Dashboard
          </Typography>
          <Alert severity="info" sx={{ mb:  3 }}>
            Detaljerte metrics og ytelsesdata for alle endepunkter.
          </Alert>
          {/* Metrics dashboard content will be implemented in next iteration */}
        </TabPanel>
      </Paper>
    </Box>
  );
}
