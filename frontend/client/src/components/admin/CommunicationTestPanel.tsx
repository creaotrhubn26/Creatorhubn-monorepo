/**
 * Communication Test Panel for Admin Dashboard
 * Testing and monitoring communication system functionality
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  Chat as ChatIcon,
  Notifications as NotificationIcon,
  Work as ProjectIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Language as LanguageIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useCommunicationStatus } from '../../contexts/CommunicationStatusContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`communication-test-tabpanel-${index}`}
      aria-labelledby={`communication-test-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface CommunicationTestPanelProps {
  onNotificationCreate?: (notification: any) => void;
}

export default function CommunicationTestPanel({
  onNotificationCreate,
}: CommunicationTestPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    status: communicationStatus,
    updateStatus,
    testConnection,
    testGoogleChat,
  } = useCommunicationStatus();
  const {
    integration,
    communication,
    dataFlow,
    componentRegistry,
    analytics,
    lifecycle,
    performance,
    features,
  } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Comprehensive Feature System for Communication Test Panel
  const communicationTestPanelAccess = features.checkFeatureAccess('communication-test-panel,');
  const communicationTestingAccess = features.checkFeatureAccess('communication-testing,');
  const messageTestingAccess = features.checkFeatureAccess('message-testing, ');
  const notificationTestingAccess = features.checkFeatureAccess('notification-testing');
  const realTimeTestingAccess = features.checkFeatureAccess('real-time-testing');
  const googleChatTestingAccess = features.checkFeatureAccess('google-chat-testing');
  const webSocketTestingAccess = features.checkFeatureAccess('websocket-testing');
  const communicationAnalyticsAccess = features.checkFeatureAccess('communication-analytics');

  const [activeTab, setActiveTab] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [channels, setChannels] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [monitoringActive, setMonitoringActive] = useState(true);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<
    Array<{ timestamp: Date; status: string }>
  >([]);

  // Register component in integration system
  useEffect(() => {
    lifecycle.registerComponent({
      id: 'communication-test-panel',
      type: 'admin-panel',
      version: '1.0.0',
      capabilities: {
        data: ['communication:test','communication:health','communication:status'],
        events: [
          'communication:test:start','communication:test:complete','communication:test:error',
        ],
        actions: [
          'communication:test:execute','communication:monitor:start','communication:monitor:stop',
        ],
        ui: ['communication:status:display','communication:results:show'],
        system: ['communication:health:check','communication:websocket:test'],
      },
      dependencies: ['communication-status-context','auth-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('communication_test_panel_mounted', {
      userId: user?.email || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    // Track feature usage
    features.trackFeatureUsage('communication-test-panel','opened', {
      timestamp: Date.now(),
      component: 'CommunicationTestPanel',
      userId: user?.email || 'anonymous',
      activeTab: activeTab,
    });

    return () => {
      lifecycle.unregisterComponent('communication-test-panel');
      analytics.trackEvent('communication_test_panel_unmounted', {
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      });
    };
  }, [lifecycle, analytics, user?.email, features, activeTab]);

  // Test Google Chat connectivity
  const testGoogleChatConnectivity = useCallback(async () => {
    const endTiming = performance.startTiming('google_chat_test');
    setLoading(true);

    // Broadcast test start
    analytics.trackEvent('google_chat_test_started', {
      userId: user?.email || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    (communication as any).broadcast(
      'communication:test:start',
      {
        type: 'google_chat_test',
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      }, 'high',
    );

    try {
      await testGoogleChat();

      const testResult = {
        success: communicationStatus.googleChatStatus === 'connected',
        status: communicationStatus.googleChatStatus,
        response: communicationStatus.googleChatResponse,
        timestamp: new Date().toISOString(),
      };

      // Broadcast test completion
      (communication as any).broadcast(
        'communication:test:complete',
        {
          type: 'google_chat_test',
          result: testResult,
          userId: user?.email || 'anonymous',
          timestamp: new Date().toISOString(),
        }, 'high',
      );

      analytics.trackEvent('google_chat_test_completed', {
        success: testResult.success,
        status: testResult.status,
        response: testResult.response,
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      });

      onNotificationCreate?.({
        id: `google_chat_test_${Date.now()}`,
        type: communicationStatus.googleChatStatus === 'connected' ? 'success' : 'error',
        title: 'Google Chat Test',
        message: `Google Chat: ${communicationStatus.googleChatResponse}`,
        priority: communicationStatus.googleChatStatus === 'connected' ? 'low' : 'high',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Google Chat test error: ', error);

      const errorResult = {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };

      // Broadcast test error
      (communication as any).broadcast(
        'communication:test:error',
        {
          type: 'google_chat_test',
          error: errorResult,
          userId: user?.email || 'anonymous',
          timestamp: new Date().toISOString(),
        }, 'high',
      );

      analytics.trackEvent('google_chat_test_failed', {
        error: errorResult.error,
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      });

      onNotificationCreate?.({
        id: `google_chat_test_error_${Date.now()}`,
        type: 'error',
        title: 'Google Chat Test Failed',
        message: 'Failed to test Google Chat connectivity',
        priority: 'high',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    }

    setLoading(false);
    endTiming();
  }, [
    testGoogleChat,
    communicationStatus.googleChatStatus,
    communicationStatus.googleChatResponse,
    onNotificationCreate,
    performance,
    analytics,
    communication,
    user?.email,
  ]);

  // Test system health
  const testSystemHealth = useCallback(async () => {
    const endTiming = performance.startTiming('system_health_test');
    setLoading(true);

    // Broadcast health test start
    analytics.trackEvent('system_health_test_started', {
      userId: user?.email || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    (communication as any).broadcast(
      'communication:test:start',
      {
        type: 'system_health_test',
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      }, 'high',
    );

    try {
      const response = await fetch('/api/communication/health');
      const data = await response.json();
      setTestResults((prev) => ({ ...prev, health: data }));

      // Also get system stats
      const statsResponse = await fetch('/api/communication/stats');
      const statsData = await statsResponse.json();
      setSystemStats(statsData);

      const healthResult = {
        status: data.status,
        service: data.service,
        websocket: data.websocket,
        activeConnections: statsData.activeConnections || 0,
        serverStatus: data.status || 'ok',
        timestamp: new Date().toISOString(),
      };

      // Broadcast status update to context
      updateStatus({
        isConnected: true,
        connectionStatus: 'connected',
        systemHealthy: data.status === 'ok',
        activeConnections: statsData.activeConnections || 0,
        serverStatus: data.status || 'ok',
      });

      // Broadcast health test completion
      (communication as any).broadcast(
        'communication:test:complete',
        {
          type: 'system_health_test',
          result: healthResult,
          userId: user?.email || 'anonymous',
          timestamp: new Date().toISOString(),
        }, 'high',
      );

      analytics.trackEvent('system_health_test_completed', {
        success: true,
        status: data.status,
        activeConnections: statsData.activeConnections || 0,
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      });

      onNotificationCreate?.({
        id: `health_test_${Date.now()}`,
        type: 'success',
        title: 'Health Test Completed',
        message: 'Communication system health check successful',
        priority: 'low',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Health check error:', error);
      setTestResults((prev) => ({
        ...prev,
        health: { error: error instanceof Error ? error.message : String(error) },
      }));

      const errorResult = {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };

      // Broadcast error status to context
      updateStatus({
        isConnected: false,
        connectionStatus: 'disconnected',
        systemHealthy: false,
        serverStatus: 'error',
      });

      // Broadcast health test error
      (communication as any).broadcast(
        'communication:test:error',
        {
          type: 'system_health_test',
          error: errorResult,
          userId: user?.email || 'anonymous',
          timestamp: new Date().toISOString(),
        }, 'high',
      );

      analytics.trackEvent('system_health_test_failed', {
        error: errorResult.error,
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      });

      onNotificationCreate?.({
        id: `health_test_error_${Date.now()}`,
        type: 'error',
        title: 'Health Test Failed',
        message: 'Communication system health check failed',
        priority: 'high',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    }

    setLoading(false);
    endTiming();
  }, [onNotificationCreate, updateStatus, performance, analytics, communication, user?.email]);

  // Listen for integration events from other components
  useEffect(() => {
    const handleCommunicationEvent = (message: any) => {
      if (message.type === 'communication:status:request') {
        // Another component is requesting communication status
        analytics.trackEvent('communication_status_requested', {
          requester: message.from,
          timestamp: new Date().toISOString(),
        });

        // Respond with current status
        (communication as any).broadcast(
          'communication:status:response',
          {
            status: communicationStatus,
            connectionStatus,
            systemStats,
            timestamp: new Date().toISOString(),
          }, 'medium',
        );
      }

      if (message.type === 'communication: test:trigger') {
        // Another component wants to trigger a communication test
        analytics.trackEvent('communication_test_triggered_externally', {
          triggerer: message.from,
          testType: message.data?.testType || 'all',
          timestamp: new Date().toISOString(),
        });

        const testType = message.data?.testType || 'all';
        if (testType === 'google_chat' || testType === 'all') {
          testGoogleChatConnectivity();
        }
        if (testType === 'health' || testType === 'all') {
          testSystemHealth();
        }
      }
    };

    // Subscribe to communication events
    const unsubscribe = (communication as any).onMessage(handleCommunicationEvent);

    return unsubscribe;
  }, [
    communication,
    analytics,
    communicationStatus,
    connectionStatus,
    systemStats,
    testGoogleChatConnectivity,
    testSystemHealth,
  ]);

  // Test channel creation
  const testCreateChannel = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/communication/channels', {
        method: 'POS',
        headers: { , 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Test Channel ${Date.now()}`,
          type: 'project',
          userId: user?.email || 'admin@creatorhub.no',
        }),
      });
      const data = await response.json();
      setTestResults((prev) => ({ ...prev, channel: data }));

      onNotificationCreate?.({
        id: `channel_test_${Date.now()}`,
        type: 'success',
        title: 'Channel Test Completed',
        message: 'Test channel created successfully',
        priority: 'low',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Channel creation error:', error);
      setTestResults((prev) => ({
        ...prev,
        channel: { error: error instanceof Error ? error.message : String(error) },
      }));
    }
    setLoading(false);
  }, [user?.email, onNotificationCreate]);

  // Test message sending
  const testSendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/communication/messages', {
        method: 'POS',
        headers: { , 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage,
          channelId: 'test-channel',
          userId: user?.email || 'admin@creatorhub.no',
        }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { ...data, timestamp: new Date().toISOString() }]);
      setNewMessage('');

      onNotificationCreate?.({
        id: `message_test_${Date.now()}`,
        type: 'success',
        title: 'Message Test Completed',
        message: 'Test message sent successfully',
        priority: 'low',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Message sending error:', error);
      onNotificationCreate?.({
        id: `message_test_error_${Date.now()}`,
        type: 'error',
        title: 'Message Test Failed',
        message: 'Failed to send test message',
        priority: 'high',
        source: 'communication_test',
        timestamp: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, [newMessage, user?.email, onNotificationCreate]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const response = await fetch('/api/communication/channels?userId=test-user');
      const data = await response.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Channel fetch error:', error);
    }
  }, []);

  // WebSocket connection test
  useEffect(() => {
    const testWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🔔 Communication test WebSocket connected');
          setConnectionStatus('connected');
          updateStatus({
            isConnected: true,
            connectionStatus: 'connected',
          });
        };

        ws.onclose = () => {
          console.log('🔔 Communication test WebSocket disconnected');
          setConnectionStatus('disconnected');
          updateStatus({
            isConnected: false,
            connectionStatus: 'disconnected',
          });
        };

        ws.onerror = (error) => {
          console.error('🔔 Communication test WebSocket error:', error);
          setConnectionStatus('disconnected');
          updateStatus({
            isConnected: false,
            connectionStatus: 'disconnected',
          });
        };

        return ws;
      } catch (error) {
        console.error('WebSocket setup error:', error);
        setConnectionStatus('disconnected');
        return null;
      }
    };

    const ws = testWebSocket();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Continuous monitoring
  useEffect(() => {
    if (!monitoringActive) return;

    const monitoringInterval = setInterval(() => {
      testSystemHealth();
      testGoogleChatConnectivity();
      fetchChannels();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(monitoringInterval);
  }, [monitoringActive, testSystemHealth, testGoogleChatConnectivity, fetchChannels]);

  // Initial load
  useEffect(() => {
    testSystemHealth();
    testGoogleChatConnectivity();
    fetchChannels();
  }, [testSystemHealth, testGoogleChatConnectivity, fetchChannels]);

  // Track connection status changes
  useEffect(() => {
    const timestamp = new Date();
    setConnectionHistory((prev) => [
      { timestamp, status: connectionStatus },
      ...prev.slice(0, 9), // Keep last 10 entries
    ]);
    setLastHealthCheck(timestamp);
  }, [connectionStatus]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'disconnected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircleIcon />;
      case 'connecting':
        return <CircularProgress size={16} />;
      case 'disconnected':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={2}, sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Box display="flex" alignItems="center" gap={1}>
              <ChatIcon color={getStatusColor() as any} />
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                Communication System Test
              </Typography>
              <Chip
                icon={getStatusIcon()}
                label={connectionStatus.toUpperCase()}
                color={getStatusColor() as any}
                size="small"
              />
            </Box>

            {/* Feature Analytics Display */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mt: 1}}
            >
              <Typography variant="caption" color="text.secondary">
                Features: {features.getFeatureAnalytics().enabledFeatures}/
                {features.getFeatureAnalytics().totalFeatures}
              </Typography>
              <Chip
                label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '10px', height: 18 }}
              />
            </Box>
          </Box>

          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={testSystemHealth}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="System Health" icon={<CheckCircleIcon />} />
          <Tab label="Monitoring" icon={<SpeedIcon />} />
          <Tab label="Channels" icon={<ChatIcon />} />
          <Tab label="Messages" icon={<SendIcon />} />
          <Tab label="Integration Status" icon={<ProjectIcon />} />
        </Tabs>

        {/* System Health Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    System Status
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    {getStatusIcon()}
                    <Typography variant="body1">WebSocket: {connectionStatus}</Typography>
                    <Chip
                      label={monitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}
                      color={monitoringActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      Last Check: {lastHealthCheck ? lastHealthCheck.toLocaleTimeString() : 'Never'}
                    </Typography>
                    {systemStats && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Active Connections: {systemStats.activeConnections}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Server Status: {systemStats.serverStatus}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Google Chat Status */}
                  <Box mb={2} p={2}, sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Google Chat Status
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50, %',
                          backgroundColor:
                            communicationStatus.googleChatStatus === 'connected'
                              ? '#4caf50'
                              : '#f44336'}}
                      />
                      <Typography variant="body2">
                        {communicationStatus.googleChatStatus === 'connected'
                          ? 'Connected'
                          : 'Disconnected'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Response: {communicationStatus.googleChatResponse || 'Not tested'}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="text.secondary">
                      Last Check:{' '}
                      {communicationStatus.googleChatLastCheck
                        ? communicationStatus.googleChatLastCheck.toLocaleTimeString()
                        : 'Never'}
                    </Typography>
                  </Box>

                  {/* Connection History */}
                  <Typography variant="subtitle2" gutterBottom>
                    Connection History (Last 10)
                  </Typography>
                  <Box sx={{ maxHeight: 10, overflow: 'auto' }}>
                    {connectionHistory.length > 0 ? (
                      connectionHistory.map((entry, index) => (
                        <Box
                          key={index}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          py={0.5}
                        >
                          <Typography variant="caption">
                            {entry.timestamp.toLocaleTimeString()}
                          </Typography>
                          <Chip
                            label={entry.status}
                            size="small"
                            color={
                              entry.status === 'connected'
                                ? 'success'
                                : entry.status === 'connecting'
                                  ? 'warning'
                                  : 'error'
                            }
                          />
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No connection history yet
                      </Typography>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={theming.getThemedCardSx()}>
                  <Button
                    variant="contained"
                    onClick={testSystemHealth}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <SpeedIcon />}
                    sx={theming.getThemedButtonSx()}
                  >
                    Test Health
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setMonitoringActive(!monitoringActive)}
                    color={monitoringActive ? 'warning' : 'success'}
                  >
                    {monitoringActive ? 'Pause Monitoring' : 'Resume Monitoring'}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={testGoogleChatConnectivity}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : <ChatIcon />}
                    color="primary"
                    sx={theming.getThemedButtonSx()}
                  >
                    Test Google Chat
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Test Results
                  </Typography>
                  {testResults.health ? (
                    <Alert severity={testResults.health.error ? 'error' : 'success'}>
                      {testResults.health.error ? (
                        <Typography variant="body2">Error: {testResults.health.error}</Typography>
                      ) : (
                        <Box>
                          <Typography variant="body2">
                            Status: {testResults.health.status}
                          </Typography>
                          <Typography variant="body2">
                            Service: {testResults.health.service}
                          </Typography>
                          <Typography variant="body2">
                            WebSocket: {testResults.health.websocket}
                          </Typography>
                        </Box>
                      )}
                    </Alert>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No test results yet. Click "Test Health" to run diagnostics.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Monitoring Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Real-time Monitoring
                  </Typography>

                  <Box mb={2}>
                    <Typography variant="body2" gutterBottom>
                      Monitoring Status:{' '}
                    </Typography>
                    <Chip
                      label={monitoringActive ? 'ACTIVE' : 'PAUSE'}
                      color={monitoringActive ? 'success' : 'warning'}
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" gutterBottom>
                      Check Interval: Every 30 seconds
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      Last Health Check:{''}
                      {lastHealthCheck ? lastHealthCheck.toLocaleString() : 'Never'}
                    </Typography>
                  </Box>

                  <Alert severity={monitoringActive ? 'success' : 'warning'}, sx={{ mb: 2 }}>
                    {monitoringActive
                      ? 'System is actively monitoring communication health. Status updates every 30 seconds.'
                      : 'Monitoring is paused. Click "Resume Monitoring" to restart automatic health checks.'}
                  </Alert>

                  <Box display="flex" gap={1}>
                    <Button
                      variant={monitoringActive ? 'outlined' : 'contained'}
                      onClick={() => setMonitoringActive(!monitoringActive)}
                      color={monitoringActive ? 'warning' : 'success'}
                      fullWidth
                    >
                      {monitoringActive ? 'Pause Monitoring' : 'Resume Monitoring'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Connection Timeline
                  </Typography>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Recent connection status changes:{', '}
                  </Typography>

                  <Box sx={{ maxHeight: 30, overflow: 'auto' }}>
                    {connectionHistory.length > 0 ? (
                      connectionHistory.map((entry, index) => (
                        <Box
                          key={index}
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                          py={1}
                          borderBottom={index < connectionHistory.length - 1 ? 1 : 0}
                          borderColor="divider"
                        >
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {entry.timestamp.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {index === 0 ? 'Current' : `${index} changes ago`}
                            </Typography>
                          </Box>
                          <Chip
                            label={entry.status.toUpperCase()}
                            size="small"
                            color={
                              entry.status === 'connected'
                                ? 'success'
                                : entry.status === 'connecting'
                                  ? 'warning'
                                  : 'error'
                            }
                          />
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No connection history available
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Channels Tab */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      Channel Management
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={testCreateChannel}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={16} /> : <ChatIcon />}
                      sx={theming.getThemedButtonSx()}
                    >
                      Create Test Channel
                    </Button>
                  </Box>

                  {testResults.channel && (
                    <Alert
                      severity={testResults.channel.error ? 'error': 'success'}
                      sx={{ mb: 2 }}
                    >
                      {testResults.channel.error ? (
                        <Typography variant="body2">Error: {testResults.channel.error}</Typography>
                      ) : (
                        <Typography variant="body2">
                          Channel created successfully: {testResults.channel.name}
                        </Typography>
                      )}
                    </Alert>
                  )}

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Available Channels ({channels.length})
                  </Typography>
                  {channels.length > 0 ? (
                    <List>
                      {channels.map((channel, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <ChatIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={channel.name || `Channel ${index + 1}`}
                            secondary={channel.type || 'Unknown type'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No channels found. Create a test channel to see results.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Messages Tab */}
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Message Testing
                  </Typography>

                  <Box display="flex" gap={1} mb={2}>
                    <TextField
                      fullWidth
                      label="Test Message"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Enter a test message..."
                      onKeyDown={(e) => e.key === 'Enter' && testSendMessage()}
                    />
                    <Button
                      variant="contained"
                      onClick={testSendMessage}
                      disabled={loading || !newMessage.trim()}
                      startIcon={loading ? <CircularProgress size={16} /> : <SendIcon />}
                      sx={theming.getThemedButtonSx()}
                    >
                      Send
                    </Button>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Message History ({messages.length})
                  </Typography>
                  {messages.length > 0 ? (
                    <List sx={{ maxHeight: 20, overflow: 'auto' }}>
                      {messages.map((message, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <SendIcon />
                          </ListItemIcon>
                          <ListItemText primary={message.content} secondary={message.timestamp} />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No messages sent yet. Send a test message to see results.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Integration Status Tab */}
        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Integration System Status
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <StorageIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Master Integration Provider"
                        secondary="Connected & Active"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ChatIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Cross-Component Communication"
                        secondary="Broadcasting & Listening"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SpeedIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Performance Monitoring"
                        secondary="Tracking & Analytics"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ProjectIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Component Registry"
                        secondary="Communication Test Panel Registered"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Integration Features
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Event Broadcasting"
                        secondary="Test results broadcast to all components"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Performance Tracking"
                        secondary="Test execution times monitored"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Analytics Integration"
                        secondary="All test events tracked and logged"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Cross-Component Requests"
                        secondary="Responds to external test triggers"
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Integration Actions
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        // Trigger integration test broadcast
                        (communication as any).broadcast(
                          'communication:test:trigger',
                          {
                            testType: 'all',
                            source: 'integration_panel',
                            timestamp: new Date().toISOString(),
                          }'high',
                        );

                        analytics.trackEvent('integration_test_triggered', {
                          source: 'integration_panel',
                          timestamp: new Date().toISOString(),
                        });
                      }}
                      disabled={loading}
                      startIcon={<RefreshIcon />}
                      sx={theming.getThemedButtonSx()}
                    >
                      Broadcast Test Trigger to All Components
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        // Request status from all components
                        (communication as any).broadcast(
                          'communication:status:request',
                          {
                            requester: 'communication_test_panel',
                            timestamp: new Date().toISOString(),
                          }'medium',
                        );

                        analytics.trackEvent('status_request_broadcasted', {
                          requester:'communication_test_panel',
                          timestamp: new Date().toISOString(),
                        });
                      }}
                      startIcon={<ChatIcon />}
                    >
                      Request Status from All Components
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        testSystemHealth();
                        testGoogleChatConnectivity();
                        fetchChannels();
                      }}
                      disabled={loading}
                      startIcon={<SpeedIcon />}
                    >
                      Run All Communication Tests
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setTestResults({});
                        setMessages([]);
                        setChannels([]);
                        analytics.clearMetrics();
                      }}
                      startIcon={<StorageIcon />}
                    >
                      Clear All Results & Analytics
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Box>
  );
}
