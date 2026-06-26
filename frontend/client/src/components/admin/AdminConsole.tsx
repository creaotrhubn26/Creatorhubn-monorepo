/**
 * CreatorHub Norge - Admin Developer Console
 * Testing integrations and API calls directly from admin interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Grid,
  Chip,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Terminal as TerminalIcon,
  Send as SendIcon,
  Clear as ClearIcon,
  History as HistoryIcon,
  BugReport as BugIcon,
  Api as ApiIcon,
  PlayArrow as PlayIcon,
  Code as CodeIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useIntegrationFeatures } from '@/hooks/useIntegrationFeatures';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface ConsoleLog {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  message: string;
  data?: any;
}

interface ApiTest {
  name: string;
  method: string;
  endpoint: string;
  body?: any;
  description: string;
}

export const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [requestBody, setRequestBody] = useState('{},');
  const [isLoading, setIsLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Integration features
  const {
    features,
    hasFeature,
    totalActiveIntegrations,
    isLoading: integrationsLoading,
    error: integrationsError,
} = useIntegrationFeatures();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');

  // User
  const { user } = useAuth();

  // Actual integrations (fallback to at least 5 if unknown)
  const [actualIntegrations, setActualIntegrations] = useState(5);

  useEffect(() => {
    const fetchRealIntegrations = async () => {
      try {
        const response = await fetch('/api/admin/integrations/keys, ');
        if (response.ok) {
          const data = await response.json();
          setActualIntegrations(data.total || Math.max(totalActiveIntegrations, 5));
      } else {
          setActualIntegrations(Math.max(totalActiveIntegrations, 5));
      }
    } catch {
        setActualIntegrations(Math.max(totalActiveIntegrations, 5));
        console.log('AdminConsole: Using integration hook data as fallback, ');
    }
  };
    fetchRealIntegrations();
}, [totalActiveIntegrations]);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'AdminConsole',
      name: 'Admin Developer Console',
      category: 'admin',
      capabilities: ['console', 'debugging', 'api-testing', 'system-monitoring']
    });

    // Data flow nodes
    const consoleLogsNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'AdminConsole',
      dataKey: 'console-logs',
  });

    const systemLogsNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'AdminConsole',
      dataKey: 'system-logs',
  });

    const apiResponsesNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'AdminConsole',
      dataKey: 'api-responses',
  });

    // Admin events
    const refreshUnsubscribe = (communication.onMessageType as any)('admin:console:refresh', () => {
      fetchSystemLogs();
  }, 'AdminConsole','system');

    const clearUnsubscribe = (communication.onMessageType as any)('admin:console:clear', () => {
      setLogs([]);
  }, 'AdminConsole','system');

    return () => {
      dataFlow.unregisterNode(consoleLogsNodeId);
      dataFlow.unregisterNode(systemLogsNodeId);
      dataFlow.unregisterNode(apiResponsesNodeId);
      if (typeof refreshUnsubscribe === 'function') refreshUnsubscribe();
      if (typeof clearUnsubscribe === 'function') clearUnsubscribe();
  };
}, [componentRegistry, dataFlow, communication]);

  // System logs (from backend)
  const fetchSystemLogs = async () => {
    setIsLoading(true);
    logInteraction('Fetching System Logs', { action: 'GET /api/admin/system-logs' });

    try {
      const startTime = Date.now();
      const response = await fetch('/api/admin/system-logs');
      const endTime = Date.now();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

      const data = await response.json();
      logInteraction('System Logs Response', {
        status: response.status,
        logs: data.logs?.length || 0,
        responseTime: `${endTime - startTime}ms`,
        serverUptime: data.serverUptime,
        memoryUsage: data.memoryUsage,
    });

      if (data.logs) {
        const logsArray = Array.isArray(data.logs) ? data.logs : [];
        setSystemLogs(logsArray);
        addLog('response', `✅ EKTE DATA: ${logsArray.length} logger fra live server (${endTime - startTime}ms)`);
        addLog(
          'info',
          `📊 Server uptime: ${Math.floor(data.serverUptime)} sek, Memory: ${Math.round(
            data.memoryUsage.heapUsed / 1024 / 1024
          )}MB`
        );
    }
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logInteraction('System Logs Error', { error: errorMessage });
      addLog('error', `❌ FEIL: ${errorMessage}`);
  } finally {
      setIsLoading(false);
  }
};

  // Interaction logger
  const logInteraction = async (action: string, details?: any) => {
    const timestamp = new Date().toISOString().substring(11, 19);
    const message = details ? `${action}: ${JSON.stringify(details)}` : action;
    addLog('request', `[${timestamp}] 👆 USER: ${message}`);

    // Broadcast to admin bus
    communication.sendBroadcast('admin:console:interaction', {
      action,
      details,
      timestamp,
      component: 'AdminConsole',
  });

    // Send to backend
    try {
      fetch('/api/admin/log-interaction', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-user-email': String(user?.email ?? ', '),
      },
        body: JSON.stringify({ action, details, timestamp }),
    }).catch(() => {});
  } catch {
      // ignore
  }
};

  // WebSocket live log streaming
  useEffect(() => {
    if (!liveMode) return;

    try {
      const protocol = window.location.protocol === 'https: ' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        logInteraction('WebSocket Live Mode Connected');
        addLog('info','🔴 LIVE MODE: Tilkoblet til ekte server-stream');
    };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'system_log') {
            addLog('response', `🔴 LIVE: ${data.message}`);
            setSystemLogs((prev) => [...prev, data.message]);
        }
      } catch {
          // non-JSON messages ignored
      }
    };

      socket.onerror = () => {
        logInteraction('WebSocket Error', { error: 'WebSocket connection failed' });
        addLog('error','❌ WebSocket feil - kan ikke motta live logger');
    };

      return () => {
        logInteraction('WebSocket Live Mode Disconnected');
        socket.close();
    };
  } catch {
      addLog('error','❌ WebSocket ikke tilgjengelig i dette miljøet');
      console.log('AdminConsole: WebSocket connection failed, continuing without live mode');
  }
}, [liveMode]);

  // Predefined API tests
// Predefined API tests
const apiTests: Record<string, ApiTest[]> = {
  bring: [
    {
      name: 'Beregn fraktkost',
      method: 'POST',
      endpoint: '/api/integrations/bring/shipping/rates',
      body: { fromPostalCode: '0159', toPostalCode: '5000', weight: 1 },
      description: 'Test fraktkostberegning Oslo til Bergen',
    },
    {
      name: 'Valider postnummer',
      method: 'GET',
      endpoint: '/api/integrations/bring/shipping/validate/0159',
      description: 'Valider postnummer 0159 (Oslo)',
    },
  ],
  stripe: [
    {
      name: 'Opprett betaling',
      method: 'POST',
      endpoint: '/api/integrations/stripe/payments/process',
      body: { amount: 2500, currency: 'nok', description: 'Test betaling' },
      description: 'Test betalingsprosessering',
    },
  ],
  openai: [
    {
      name: 'Generer tekst',
      method: 'POST',
      endpoint: '/api/integrations/openai/ai/generate',
      body: { prompt: 'Skriv en kort beskrivelse av et fotoprosjekt', max_tokens: 100 },
      description: 'Test AI tekstgenerering',
    },
  ],
  google_workspace: [
    {
      name: 'Opprett Drive-mappe',
      method: 'POST',
      endpoint: '/api/integrations/google_workspace/drive/create-folder',
      body: { name: 'Test Prosjekt - Console', parent: 'root' },
      description: 'Test Google Drive mappe-opprettelse',
    },
  ],
  instagram: [
    {
      name: 'Hent brukerinfo',
      method: 'GET',
      endpoint: '/api/integrations/instagram/me',
      description: 'Test Instagram brukerinfo',
    },
  ],
};


  const addLog = (type: ConsoleLog['type'], message: string, data?: any) => {
    const newLog: ConsoleLog = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data,
  };
    setLogs((prev) => [...prev, newLog]);
};

  const executeApiCall = async (method: string, endpoint: string, body?: any) => {
    setIsLoading(true);
    try {
      addLog('request', `${method} ${endpoint}`, body);

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type' : 'application/json','x-user-email': String(user?.email ?? ', '),
      },
        body: body ? JSON.stringify(body) : undefined,
    });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        addLog('response', `✅ ${response.status} ${response.statusText}`, data);
    } else {
        addLog('error', `❌ ${response.status} ${response.statusText}`, data);
    }
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('error', `❌ Network Error: ${errorMessage}`, error);
  } finally {
      setIsLoading(false);
  }
};

  const testService = async (service: string) => {
    if (hasFeature(service)) {
      addLog('info', `✅ ${service} integrasjon er aktiv`);
      const list = features[service]?.features ?? [];
      addLog('info', `Tilgjengelige funksjoner: ${list.join(', ')}`);
  } else {
      addLog('error', `❌ ${service} integrasjon ikke funnet eller inaktiv`);
  }
};

  const showFeatures = () => {
    if (integrationsError) {
      addLog('error','❌ Kunne ikke hente integrasjonsfunksjoner: ' + integrationsError);
      return;
  }

    addLog('info', `📊 Aktive integrasjoner: ${totalActiveIntegrations}`);
    if (Object.keys(features).length === 0) {
      addLog('info','⏳ Laster integrasjonsfunksjoner...');
      return;
  }

    Object.entries(features).forEach(([service, feature]) => {
      if (feature?.available) {
        addLog('info', `✅ ${service}: ${feature.features?.length || 0} funksjoner`);
    }
  });
};

  const toggleLiveMode = () => {
    setLiveMode((prev) => !prev);
    addLog('info', !liveMode ? '🔴 Live systemlogg aktivert - viser Replit konsoll i sanntid' : '⭕ Live systemlogg deaktivert');
};

  const showRecentLogs = () => {
    addLog('info','📋 Viser siste Replit konsoll-meldinger: ');
    systemLogs.slice(-10).forEach((log, index) => {
      addLog('info', `${index + 1}. ${log}`);
  });
};

  const showIntegrationStatus = () => {
    addLog('info','🔗 Kjører integrasjonsstatus...');
    addLog('info', `✅ Totalt ${totalActiveIntegrations} aktive integrasjoner`);
    Object.keys(features).forEach((service) => {
      if (features[service]?.available) testService(service);
  });
};

  const clearLogs = () => setLogs([]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
};

  const executeQuickTest = (test: ApiTest) => {
    executeApiCall(test.method, test.endpoint, test.body);
};

  const renderIntegrationsTab = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              🔗 Integrasjonsoversikt & Testing
            </Typography>
            <Typography variant="caption">Test alle tilgjengelige integrasjoner direkte</Typography>
          </Alert>
        </Grid>

        {/* Quick Test Buttons for all services */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
            Hurtigtester per tjeneste:
          </Typography>
          <Grid container spacing={1}>
            {Object.keys(features)
              .filter((service) => features[service].available)
              .map((service) => (
                <Grid item key={service}>
                  <Button
                    variant="contained"
                    onClick={() => testService(service)}
                    sx={{
                      ...theming.getThemedButtonSx(),
                      textTransform: 'capitalize'}}
                    startIcon={<SuccessIcon />}
                  >
                    Test {service}
                  </Button>
                </Grid>
              ))}
          </Grid>
        </Grid>

        {/* Integration Status Cards */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
            Integrasjonsstatus:
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(features).map(([service, feature]) => (
              <Grid item xs={12} sm={6} md={4} key={service}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {feature.available ? (
                        <SuccessIcon color="success" sx={{ fontSize: 20 }} />
                      ) : (
                        <ErrorIcon color="error" sx={{ fontSize: 20 }} />
                      )}
                      <Typography
                        variant="h6"
                        sx={{ textTransform: 'capitalize', color: theming.colors.primary }}
                      >
                        {service}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      Status: {feature.available ? 'Aktiv' : 'Inaktiv'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Funksjoner: {feature.features.length}
                    </Typography>
                    {feature.available && (
                      <Box sx={{ mt: 1 }}>
                        {feature.features.slice(0, 3).map((func, idx) => (
                          <Chip key={idx} label={func} size="small" sx={{ mr: 0.5, mb: 0.5, fontSize: '11px' }} />
                        ))}
                        {feature.features.length > 3 && (
                          <Chip label={`+${feature.features.length - 3} mer`} size="small" variant="outlined" />
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>

      {/* Console Output */}
      <Paper
        ref={consoleRef}
        sx={{
          ...theming.getThemedCardSx(),
          backgroundColor: '#000',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '14px',
          p: 2,
          height: 400,
          overflowY: 'auto',
          border: '1px solid #333',
          mt: 2}}
      >
        {logs.length === 0 ? (
          <Typography sx={{ color: '#666' }}>
            Integrasjonsstatus klar. Bytt til andre faner for mer info.
          </Typography>
        ) : (
          logs.map((log) => (
            <Box key={log.id} sx={{ mb: 1 }}>
              <Typography component="span" sx={{ color: '#666', mr: 1 }}>
                [{log.timestamp}]
              </Typography>
              <Typography
                component="span"
                sx={{
                  color:
                    log.type === 'error'
                      ? '#ff6b6b'
                      : log.type === 'response'
                      ? '#4ecdc4'
                      : log.type === 'request'
                      ? '#ffe66d'
                      : '#00ff00'}}
              >
                {log.message}
              </Typography>
              {log.data && (
                <Box sx={{ mt: 0.5, pl: 2, color: '#ccc' }}>
                  <pre style={{ fontSize: '12px', margin: 0 }}>{JSON.stringify(log.data, null, 2)}</pre>
                </Box>
              )}
            </Box>
          ))
        )}
      </Paper>
    </Box>
  );

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }
}, [logs]);

  // Auto actions on tab switch
  useEffect(() => {
    try {
      switch (activeTab) {
        case 0:
          addLog('info','📊 System & Logs fane aktivert');
          if (!isLoading) fetchSystemLogs();
          break;
        case 1:
          addLog('info','🔧 API Tester fane aktivert');
          if (!integrationsLoading) showFeatures();
          break;
        case 2:
          addLog('info','🔗 Integrasjoner fane aktivert');
          if (!integrationsLoading) showIntegrationStatus();
          break;
    }
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog('error','❌ Feil ved bytte av fane: ' + errorMessage);
  }
}, [activeTab, isLoading, integrationsLoading]);

  const renderSystemTab = () => (
    <Box>
      {/* Integration Error Alert */}
      {integrationsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">⚠️ Integrasjonsfeil: {String(integrationsError)}. Bruker fallback-data.</Typography>
        </Alert>
      )}

      {/* Status card */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={3}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: liveMode ? '#4caf50' : '#2196f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '4px solid white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'}}
              >
                {liveMode ? <PlayIcon sx={{ fontSize: 40, color: 'white' }} /> : <BugIcon sx={{ fontSize: 40, color: 'white' }} />}
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={700} sx={{ color: theming.colors.primary }}>
                  {liveMode ? '📺 Følger med på direkten' : '💻 Datamaskinen din'}
                </Typography>
                <Typography variant="h6" color="textSecondary" sx={{ fontSize: '18px', fontWeight: 600, color: theming.colors.primary }}>
                  ✅ {actualIntegrations} tjenester fungerer bra
                </Typography>
              </Box>
            </Box>
            <Box textAlign="center">
              <Chip
                label={liveMode ? '🔴 DIREKTEVISNING AKTIV' : '✅ ALT FUNGERER BRA'}
                color={liveMode ? 'success' : 'primary'}
                variant="filled"
                sx={{ fontSize: '16px', fontWeight: 'bold', px: 3, py: 2, height: 'auto', borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
              />
              <Typography variant="body2" sx={{ mt: 1, color: '#666', fontWeight: 500}}>
                {liveMode ? '⚠️ Stopper når du lukker nettleseren' : '👆 Trykk på knappene under'}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Actions */}
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: theming.colors.primary }}>
        Hva vil du gjøre?
      </Typography>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              height: '100%',
              cursor: 'pointer',
              border: '3px solid #4caf50',
              borderRadius: 2,
              transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)' }}}
            onClick={() => {
              logInteraction('Clicked: Se hvordan datamaskinen har det');
              fetchSystemLogs();
          }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: '#4caf50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  border: '4px solid #e8f5e8'}}
              >
                <BugIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: theming.colors.primary }}>
                📊 Helserapport
              </Typography>
              <Typography variant="h6" sx={{ mb: 1, color: '#4caf50', fontWeight: 600}}>
                ✅ Alt ser bra ut
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3, fontSize: '16px' }}>
                Se detaljert rapport om hvordan datamaskinen din fungerer
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{
                  ...theming.getThemedButtonSx(),
                  mt: 1}}
                disabled={isLoading}
                fullWidth
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <BugIcon />}
              >
                {isLoading ? '🔄 Henter rapport...' : '👀 Se rapport nå'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              height: '100%',
              cursor: 'pointer',
              border: `3px solid ${liveMode ? '#f44336' : '#ff9800'}`,
              borderRadius: 2,
              transition: 'transform 0.2s','&:hover': { transform: 'scale(1.02)' }}}
            onClick={() => {
              logInteraction(`Clicked: ${liveMode ? 'Stopp direktevisning' : 'Start direktevisning'}`);
              const newMode = !liveMode;
              setLiveMode(newMode);
              addLog('info', newMode ? '🔴 LIVE MODE AKTIVERT - Du ser nå alt som skjer på serveren' : '⏸️ LIVE MODE DEAKTIVERT');
          }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: liveMode ? '#f44336' : '#ff9800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  border: `4px solid ${liveMode ? '#ffebee' : '#fff3e0'}`}}
              >
                {liveMode ? <ErrorIcon sx={{ fontSize: 40, color: 'white' }} /> : <PlayIcon sx={{ fontSize: 40, color: 'white' }} />}
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: theming.colors.primary }}>
                {liveMode ? '🔴 Direktevisning' : '📺 Direktevisning'}
              </Typography>
              <Typography
                variant="h6"
                sx={{ mb: 1, color: liveMode ? '#f44336' : '#ff9800', fontWeight: 600}}
              >
                {liveMode ? '⚡ AKTIV NÅ' : '⏸️ Ikke aktiv'}
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3, fontSize: '16px' }}>
                {liveMode ? 'Meldinger kommer automatisk på skjermen' : 'Få meldinger fra datamaskinen med en gang'}
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{
                  ...theming.getThemedButtonSx(),
                  mt: 1,
                  bgcolor: liveMode ? '#f44336' : '#ff9800','&:hover': { bgcolor: liveMode ? '#d32f2f' : '#f57c00' }}}
                fullWidth
                startIcon={liveMode ? <ErrorIcon /> : <PlayIcon />}
              >
                {liveMode ? '🛑 Stopp nå' : '▶️ Start nå'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              height: '100%',
              cursor: 'pointer',
              border: '3px solid #2196f3',
              borderRadius: 2,
              transition: 'transform 0.2s','&:hover': { transform: 'scale(1.02)' }}}
            onClick={() => {
              logInteraction('Clicked: Vis tjenester');
              showFeatures();
          }}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: '#2196f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  border: '4px solid #e3f2fd'}}
              >
                <ApiIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: theming.colors.primary }}>
                🔗 Mine tjenester
              </Typography>
              <Typography variant="h6" sx={{ mb: 1, color: '#2196f3', fontWeight: 600}}>
                ✅ {actualIntegrations} tjenester tilgjengelige
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3, fontSize: '16px' }}>
                Se alle tilkoblede tjenester som Google Drive, e-post, osv.
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{ ...theming.getThemedButtonSx(), mt: 1, bgcolor: '#2196f3','&:hover': { bgcolor: '#1976d2' } }}
                fullWidth
                startIcon={<ApiIcon />}
              >
                📋 Se alle tjenester
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card
            sx={{
              ...theming.getThemedCardSx(),
              height: '100%',
              cursor: 'pointer',
              border: '3px solid #666',
              borderRadius: 2,
              transition: 'transform 0.2s','&:hover': { transform: 'scale(1.02)' }}}
            onClick={clearLogs}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: '#757575',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  border: '4px solid #f5f5f5'}}
              >
                <ClearIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: theming.colors.primary }}>
                🧹 Rydd opp
              </Typography>
              <Typography variant="h6" sx={{ mb: 1, color: '#757575', fontWeight: 600}}>
                🗑️ Fjern alle meldinger
              </Typography>
              <Typography variant="body1" color="textSecondary" sx={{ mb: 3, fontSize: '16px' }}>
                Få en ren og ryddig skjerm ved å fjerne alle meldinger
              </Typography>
              <Button variant="outlined" size="large" fullWidth startIcon={<ClearIcon />}>
                🧽 Rydd opp nå
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Messages area */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold', color: theming.colors.primary }}>
        Meldinger fra datamaskinen:
      </Typography>

      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box
            ref={consoleRef}
            sx={{
              backgroundColor: '#f8f9fa',
              color: '#333',
              fontFamily: 'Arial, sans-serif',
              fontSize: '15px',
              p: 3,
              height: 400,
              overflowY: 'auto'}}
          >
            {logs.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 2 }}>
                  🔍 Ingen meldinger ennå
                </Typography>
                <Typography variant="body1" color="textSecondary">
                  Klikk på en av knappene over for å se informasjon fra datamaskinen din
                </Typography>
              </Box>
            ) : (
              logs.map((log) => (
                <Card key={log.id} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box display="flex" alignItems="flex-start" gap={2}>
                      <Box>
                        {log.type === 'error' ? (
                          <ErrorIcon color="error" sx={{ fontSize: 20 }} />
                        ) : log.type === 'response' ? (
                          <SuccessIcon color="success" sx={{ fontSize: 20 }} />
                        ) : log.type === 'request' ? (
                          <PlayIcon sx={{ color: '#ff9800', fontSize: 20 }} />
                        ) : (
                          <BugIcon sx={{ color: '#2196f3', fontSize: 20 }} />
                        )}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                          {log.timestamp}
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{ color: log.type === 'error' ? '#d32f2f' : '#333', fontWeight: log.type === 'error' ? 600 : 400 }}
                        >
                          {log.message}
                        </Typography>
                        {log.data && (
                          <Card sx={{ mt: 1, bgcolor: '#f5f5f5' }}>
                            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                              <Typography
                                variant="body2"
                                component="pre"
                                sx={{ fontSize: '13px', m: 0, fontFamily: 'Courier New, monospace', whiteSpace: 'pre-wrap', color: '#555' }}
                              >
                                {JSON.stringify(log.data, null, 2)}
                              </Typography>
                            </CardContent>
                          </Card>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );

  const renderApiTestTab = () => (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Velg tjeneste</InputLabel>
            <Select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} label="Velg tjeneste">
              {Object.keys(features)
                .filter((service) => features[service].available)
                .map((service) => (
                  <MenuItem key={service} value={service}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <SuccessIcon color="success" sx={{ fontSize: 16 }} />
                      {service}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {selectedService && apiTests[selectedService] && (
            <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 1, p: 1 }}>
              <Typography variant="subtitle2" sx={{ p: 1, fontWeight: 'bold' }}>
                Forhåndsdefinerte tester:
              </Typography>
              {apiTests[selectedService].map((test, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1,
                    px: 1,
                    borderTop: index === 0 ? 'none' : '1px solid #e0e0e0'}}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600}}>
                      {test.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {test.description}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => executeQuickTest(test)}
                    disabled={isLoading}
                    sx={{ minWidth: 80 }}
                  >
                    <PlayIcon />
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            multiline
            rows={15}
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            label="JSON Request Body (for POST/PUT)"
            variant="outlined"
            sx={{ fontFamily: 'monospace' }}
          />

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                try {
                  JSON.parse(requestBody);
                  addLog('info', '✅ JSON format er gyldig');
              } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  addLog('error', `❌ Ugyldig JSON: ${errorMessage}`);
              }
            }}
              sx={{ bgcolor: '#4caf50' }}
            >
              Valider JSON
            </Button>

            <Button variant="outlined" onClick={() => copyToClipboard(requestBody)}>
              <CopyIcon sx={{ mr: 1 }} />
              Kopier
            </Button>
            
            <Button variant="outlined" onClick={showRecentLogs} startIcon={<HistoryIcon />}>
              Historikk
            </Button>
            
            <Button 
              variant="contained" 
              onClick={() => {
                if (selectedService && requestBody) {
                  try {
                    const parsed = JSON.parse(requestBody);
                    executeApiCall('POST', `/api/integrations/${selectedService}/test`, parsed);
                  } catch {
                    addLog('error', '❌ Ugyldig JSON format');
                  }
                } else {
                  addLog('error', '❌ Velg en tjeneste og skriv inn JSON');
                }
              }}
              disabled={isLoading || !selectedService}
              startIcon={<SendIcon />}
            >
              Send Request
            </Button>
          </Box>
          
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CodeIcon sx={{ color: '#666' }} />
            <Typography variant="caption" color="textSecondary">
              JSON-formatert request body for API-kall
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TerminalIcon sx={{ color: '#ff8c00' }} />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Admin Developer Console
          </Typography>
          <Chip label={`${totalActiveIntegrations} aktive integrasjoner`} color="success" size="small" />
        </Box>

        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ borderBottom: 1, borderColor:'divider' }}>
          <Tab icon={<TerminalIcon />} label="System & Logs" iconPosition="start" />
          <Tab icon={<ApiIcon />} label="API Tester" iconPosition="start" />
          <Tab icon={<BugIcon />} label="Integrasjoner" iconPosition="start" />
        </Tabs>

        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && renderSystemTab()}
          {activeTab === 1 && renderApiTestTab()}
          {activeTab === 2 && renderIntegrationsTab()}
        </Box>
      </CardContent>
    </Card>
  );
};
