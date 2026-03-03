import React, { useEffect, useMemo, useState } from 'react';
import { useTheming } from '../../../utils/theming-helper';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  type AlertColor,
  type ChipProps,
  type SelectChangeEvent,
} from '@mui/material';
import { Analytics, Info, Insights, Warning } from '@mui/icons-material';
import { useAdvancedAnalytics } from '../../../hooks/useAdvancedAnalytics';
import type { ABTest, AnalyticsInsight } from '../../../utils/advancedAnalytics';

interface AdvancedAnalyticsDashboardProps {
  onSettingsClick: () => void;
  onHeatmapsClick: () => void;
  onBehaviorClick: () => void;
  onFunnelsClick: () => void;
  onTestsClick: () => void;
  onInsightsClick: () => void;
}

type SnackbarState = {
  open: boolean;
  message: string;
  severity: AlertColor;
};

const INSIGHT_STATUSES: AnalyticsInsight['status'][] = [
  'new',
  'reviewed',
  'implemented',
  'dismissed',
];

const isInsightStatus = (value: string): value is AnalyticsInsight['status'] =>
  INSIGHT_STATUSES.includes(value as AnalyticsInsight['status']);

const getAbStatusColor = (status: ABTest['status']): ChipProps['color'] => {
  switch (status) {
    case 'running':
      return 'success';
    case 'draft':
      return 'default';
    case 'paused':
      return 'warning';
    case 'completed':
      return 'info';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getImpactColor = (
  impact: AnalyticsInsight['impact'],
): ChipProps['color'] => {
  switch (impact) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  onSettingsClick,
  onHeatmapsClick,
  onBehaviorClick,
  onFunnelsClick,
  onTestsClick,
  onInsightsClick,
}) => {
  const theming = useTheming('prototype_tester');
  const [activeTab, setActiveTab] = useState<number>(0);
  const [showCreateFunnelDialog, setShowCreateFunnelDialog] = useState(false);
  const [showCreateTestDialog, setShowCreateTestDialog] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [errorDismissed, setErrorDismissed] = useState(false);

  const {
    heatmapData,
    userBehaviorEvents,
    conversionFunnels,
    abTests,
    insights,
    realTimeMetrics,
    isLoading,
    error,
    recordHeatmapEvent,
    getHeatmapAggregatedData,
    recordUserBehaviorEvent,
    getPopularElements,
    createConversionFunnel,
    updateConversionFunnel,
    createABTest,
    startABTest,
    stopABTest,
    calculateABTestResults,
    updateRealTimeMetrics,
    generateInsights,
    updateInsightStatus,
    refreshData,
    exportData,
    importData,
  } = useAdvancedAnalytics();

  const heatmapAggregatedData = useMemo(
    () => getHeatmapAggregatedData(),
    [getHeatmapAggregatedData, heatmapData.length],
  );
  const popularElements = useMemo(
    () => getPopularElements(),
    [getPopularElements, userBehaviorEvents.length],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      updateRealTimeMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, [updateRealTimeMetrics]);

  const showSnackbar = (message: string, severity: AlertColor): void => {
    setSnackbar({ open: true, message, severity });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleCreateFunnel = () => {
    const funnelName = newFunnelName.trim();
    if (!funnelName) return;

    try {
      createConversionFunnel({
        name: funnelName,
        steps: [
          {
            id: `step-view-${Date.now()}`,
            name: 'Page View',
            description: 'User viewed the target page',
            eventType: 'page_view',
            order: 1,
            sessions: 0,
            conversionRate: 0,
            averageTime: 0,
            dropOffRate: 0,
          },
          {
            id: `step-click-${Date.now()}`,
            name: 'Primary Action',
            description: 'User clicked primary CTA',
            eventType: 'click',
            eventSelector: '.primary-cta',
            order: 2,
            sessions: 0,
            conversionRate: 0,
            averageTime: 0,
            dropOffRate: 0,
          },
        ],
        totalSessions: 0,
        conversionRate: 0,
        averageTimeToConvert: 0,
      });
      setShowCreateFunnelDialog(false);
      setNewFunnelName('');
      showSnackbar('Conversion funnel created successfully', 'success');
    } catch {
      showSnackbar('Failed to create conversion funnel', 'error');
    }
  };

  const handleCreateTest = () => {
    const testName = newTestName.trim();
    if (!testName) return;

    try {
      createABTest({
        name: testName,
        description: 'New A/B test',
        status: 'draft',
        variants: [
          {
            id: `variant-control-${Date.now()}`,
            name: 'Control',
            description: 'Current baseline experience',
            trafficPercentage: 50,
            changes: [],
            sessions: 0,
            conversions: 0,
            conversionRate: 0,
            averageSessionDuration: 0,
            bounceRate: 0,
          },
          {
            id: `variant-test-${Date.now()}`,
            name: 'Variant',
            description: 'Alternative experience',
            trafficPercentage: 50,
            changes: [],
            sessions: 0,
            conversions: 0,
            conversionRate: 0,
            averageSessionDuration: 0,
            bounceRate: 0,
          },
        ],
        trafficAllocation: 100,
        startDate: new Date(),
        primaryMetric: 'conversion_rate',
        secondaryMetrics: ['bounce_rate'],
        confidenceLevel: 95,
        minimumDetectableEffect: 10,
      });
      setShowCreateTestDialog(false);
      setNewTestName('');
      showSnackbar('A/B test created successfully', 'success');
    } catch {
      showSnackbar('Failed to create A/B test', 'error');
    }
  };

  const handleStartTest = (testId: string) => {
    try {
      startABTest(testId);
      showSnackbar('A/B test started successfully', 'success');
    } catch {
      showSnackbar('Failed to start A/B test', 'error');
    }
  };

  const handleStopTest = (testId: string) => {
    try {
      stopABTest(testId);
      calculateABTestResults(testId);
      showSnackbar('A/B test stopped and results calculated', 'success');
    } catch {
      showSnackbar('Failed to stop A/B test', 'error');
    }
  };

  const handleGenerateInsights = () => {
    try {
      generateInsights();
      showSnackbar('New insights generated', 'success');
    } catch {
      showSnackbar('Failed to generate insights', 'error');
    }
  };

  const handleUpdateInsightStatus = (
    id: string,
    status: AnalyticsInsight['status'],
  ) => {
    try {
      updateInsightStatus(id, status);
      showSnackbar('Insight status updated', 'success');
    } catch {
      showSnackbar('Failed to update insight status', 'error');
    }
  };

  const handleInsightStatusChange =
    (insightId: string) => (event: SelectChangeEvent<AnalyticsInsight['status']>) => {
      const value = event.target.value;
      if (!isInsightStatus(value)) {
        showSnackbar('Invalid insight status selected', 'warning');
        return;
      }
      handleUpdateInsightStatus(insightId, value);
    };

  const handleRecordDemoInteraction = () => {
    try {
      const now = Date.now();
      const sessionId = `session-${Math.floor(now / 1000)}`;
      const userId = 'demo-user';
      const x = 320 + Math.floor(Math.random() * 120);
      const y = 180 + Math.floor(Math.random() * 80);

      recordHeatmapEvent({
        type: 'click',
        x,
        y,
        intensity: 75,
        sessionId,
        userId,
        elementId: 'demo-cta',
        elementType: 'button',
        viewport: { width: 1920, height: 1080 },
      });

      recordUserBehaviorEvent({
        sessionId,
        userId,
        eventType: 'click',
        elementId: 'demo-cta',
        elementType: 'button',
        elementText: 'Create Story Arc',
        position: { x, y },
        metadata: {
          path: '/story-arc-studio',
          referrer: 'internal',
          device: 'desktop',
          browser: 'chrome',
          country: 'NO',
        },
      });

      updateRealTimeMetrics();
      showSnackbar('Recorded sample heatmap and behavior event', 'success');
    } catch {
      showSnackbar('Failed to record sample analytics event', 'error');
    }
  };

  const handleNormalizeFunnels = () => {
    try {
      conversionFunnels.forEach((funnel) => {
        if (funnel.steps.length === 0) return;
        const firstSessions = funnel.steps[0].sessions;
        const lastSessions = funnel.steps[funnel.steps.length - 1].sessions;
        const conversionRate =
          firstSessions > 0 ? (lastSessions / firstSessions) * 100 : 0;

        updateConversionFunnel(funnel.id, {
          totalSessions: firstSessions,
          conversionRate,
        });
      });
      showSnackbar('Funnels normalized from step session data', 'success');
    } catch {
      showSnackbar('Failed to normalize funnels', 'error');
    }
  };

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `advanced-analytics-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const raw = loadEvent.target?.result;
        if (typeof raw !== 'string') {
          throw new Error('Invalid import payload');
        }
        importData(JSON.parse(raw));
        showSnackbar('Data imported successfully', 'success');
      } catch {
        showSnackbar('Failed to import data', 'error');
      }
    };
    reader.readAsText(file);
  };

  const deviceTotal =
    realTimeMetrics.deviceBreakdown.desktop +
    realTimeMetrics.deviceBreakdown.mobile +
    realTimeMetrics.deviceBreakdown.tablet;

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Analytics color="primary" />
          Advanced Analytics Dashboard
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={onSettingsClick}
            aria-label="Open analytics settings"
          >
            Settings
          </Button>
          <Button variant="outlined" onClick={onHeatmapsClick}>
            Heatmaps
          </Button>
          <Button variant="outlined" onClick={onBehaviorClick}>
            Behavior
          </Button>
          <Button variant="outlined" onClick={onFunnelsClick}>
            Funnels
          </Button>
          <Button variant="outlined" onClick={onTestsClick}>
            Tests
          </Button>
          <Button variant="outlined" onClick={onInsightsClick}>
            Insights
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('refresh')}
          onClick={refreshData}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('download')}
          onClick={handleExportData}
        >
          Export
        </Button>
        <Button
          variant="outlined"
          startIcon={theming.getThemedIcon('upload')}
          component="label"
        >
          Import
          <input type="file" hidden accept=".json" onChange={handleImportData} />
        </Button>
        <Button variant="outlined" onClick={handleRecordDemoInteraction}>
          Record Demo Event
        </Button>
        <Button variant="outlined" onClick={handleNormalizeFunnels}>
          Normalize Funnels
        </Button>
      </Box>

      {error && !errorDismissed && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setErrorDismissed(true)}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Heatmaps" />
          <Tab label="User Behavior" />
          <Tab label="Conversion Funnels" />
          <Tab label="A/B Tests" />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Insights
                <Chip size="small" label={insights.length} />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="text.secondary" gutterBottom>
                  Active Users
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {realTimeMetrics.activeUsers}
                </Typography>
                <Typography color="text.secondary">Last hour</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="text.secondary" gutterBottom>
                  Page Views
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {realTimeMetrics.pageViews}
                </Typography>
                <Typography color="text.secondary">Last hour</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="text.secondary" gutterBottom>
                  Bounce Rate
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {realTimeMetrics.bounceRate.toFixed(1)}%
                </Typography>
                <Typography color="text.secondary">Last hour</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="text.secondary" gutterBottom>
                  Avg Session Duration
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {Math.round(realTimeMetrics.averageSessionDuration)}s
                </Typography>
                <Typography color="text.secondary">Last hour</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  Top Pages
                </Typography>
                <List dense>
                  {realTimeMetrics.topPages.slice(0, 5).map((page) => (
                    <ListItem key={page.path}>
                      <ListItemText
                        primary={page.path}
                        secondary={`${page.views} views, ${page.uniqueViews} unique`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  Device Breakdown
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                  >
                    <Typography variant="body2">Desktop</Typography>
                    <Typography variant="body2">
                      {realTimeMetrics.deviceBreakdown.desktop}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      deviceTotal > 0
                        ? (realTimeMetrics.deviceBreakdown.desktop / deviceTotal) *
                          100
                        : 0
                    }
                    sx={{ mb: 2 }}
                  />

                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                  >
                    <Typography variant="body2">Mobile</Typography>
                    <Typography variant="body2">
                      {realTimeMetrics.deviceBreakdown.mobile}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      deviceTotal > 0
                        ? (realTimeMetrics.deviceBreakdown.mobile / deviceTotal) * 100
                        : 0
                    }
                    sx={{ mb: 2 }}
                  />

                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
                  >
                    <Typography variant="body2">Tablet</Typography>
                    <Typography variant="body2">
                      {realTimeMetrics.deviceBreakdown.tablet}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={
                      deviceTotal > 0
                        ? (realTimeMetrics.deviceBreakdown.tablet / deviceTotal) * 100
                        : 0
                    }
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  Heatmap Aggregates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {heatmapAggregatedData.length} unique hot zones tracked
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  Popular Elements
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {popularElements.length} tracked elements with interaction data
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  Heatmap Data
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {heatmapData.length} heatmap events recorded
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Position</TableCell>
                        <TableCell>Intensity</TableCell>
                        <TableCell>Element</TableCell>
                        <TableCell>Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {heatmapData.slice(-10).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <Chip
                              label={event.type}
                              size="small"
                              color={event.type === 'click' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            ({event.x}, {event.y})
                          </TableCell>
                          <TableCell>
                            <LinearProgress
                              variant="determinate"
                              value={event.intensity}
                              sx={{ width: 100 }}
                            />
                          </TableCell>
                          <TableCell>{event.elementId ?? 'N/A'}</TableCell>
                          <TableCell>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theming.colors.primary }}
                >
                  User Behavior Events
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {userBehaviorEvents.length} behavior events recorded
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Event Type</TableCell>
                        <TableCell>Element</TableCell>
                        <TableCell>Position</TableCell>
                        <TableCell>Session</TableCell>
                        <TableCell>Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {userBehaviorEvents.slice(-10).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <Chip
                              label={event.eventType}
                              size="small"
                              color={event.eventType === 'click' ? 'primary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {event.elementText ?? event.elementId ?? 'N/A'}
                          </TableCell>
                          <TableCell>
                            ({event.position.x}, {event.position.y})
                          </TableCell>
                          <TableCell>
                            {event.sessionId.substring(0, 8)}
                            ...
                          </TableCell>
                          <TableCell>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Conversion Funnels
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('add')}
                    onClick={() => setShowCreateFunnelDialog(true)}
                    sx={theming.getThemedButtonSx()}
                  >
                    Create Funnel
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Steps</TableCell>
                        <TableCell>Conversion Rate</TableCell>
                        <TableCell>Total Sessions</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {conversionFunnels.map((funnel) => (
                        <TableRow key={funnel.id}>
                          <TableCell>{funnel.name}</TableCell>
                          <TableCell>{funnel.steps.length}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">
                                {funnel.conversionRate.toFixed(1)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={Math.max(0, Math.min(100, funnel.conversionRate))}
                                sx={{ width: 100 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>{funnel.totalSessions}</TableCell>
                          <TableCell>
                            {new Date(funnel.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Recalculate from steps">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  if (funnel.steps.length === 0) return;
                                  const first = funnel.steps[0].sessions;
                                  const last =
                                    funnel.steps[funnel.steps.length - 1].sessions;
                                  updateConversionFunnel(funnel.id, {
                                    totalSessions: first,
                                    conversionRate:
                                      first > 0 ? (last / first) * 100 : 0,
                                  });
                                }}
                              >
                                {theming.getThemedIcon('edit')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="No hard delete in dashboard">
                              <IconButton size="small" color="error" disabled>
                                {theming.getThemedIcon('delete')}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    A/B Tests
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={theming.getThemedIcon('add')}
                    onClick={() => setShowCreateTestDialog(true)}
                    sx={theming.getThemedButtonSx()}
                  >
                    Create Test
                  </Button>
                </Box>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Variants</TableCell>
                        <TableCell>Traffic</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {abTests.map((test) => (
                        <TableRow key={test.id}>
                          <TableCell>{test.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={test.status}
                              color={getAbStatusColor(test.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{test.variants.length}</TableCell>
                          <TableCell>{test.trafficAllocation}%</TableCell>
                          <TableCell>
                            {new Date(test.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {test.status === 'draft' && (
                              <Tooltip title="Start test">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleStartTest(test.id)}
                                >
                                  {theming.getThemedIcon('play')}
                                </IconButton>
                              </Tooltip>
                            )}
                            {test.status === 'running' && (
                              <Tooltip title="Stop test and calculate results">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleStopTest(test.id)}
                                >
                                  {theming.getThemedIcon('stop')}
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Analytics Insights
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Insights />}
                    onClick={handleGenerateInsights}
                  >
                    Generate Insights
                  </Button>
                </Box>
                <List>
                  {insights.map((insight) => (
                    <React.Fragment key={insight.id}>
                      <ListItem alignItems="flex-start">
                        <ListItemIcon>
                          {insight.impact === 'critical' ||
                          insight.impact === 'high' ? (
                            <Warning color="error" />
                          ) : insight.impact === 'medium' ? (
                            <Warning color="warning" />
                          ) : (
                            <Info color="info" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box
                              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                              <Typography variant="subtitle1">
                                {insight.title}
                              </Typography>
                              <Chip
                                label={insight.impact}
                                size="small"
                                color={getImpactColor(insight.impact)}
                              />
                              <Chip
                                label={`${(insight.confidence * 100).toFixed(0)}% confidence`}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {insight.description}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Recommendations:{' '}
                                {insight.recommendations.join(', ')}
                              </Typography>
                            </Box>
                          }
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Chip
                            label={insight.status}
                            size="small"
                            color={
                              insight.status === 'implemented'
                                ? 'success'
                                : 'default'
                            }
                          />
                          <Select<AnalyticsInsight['status']>
                            value={insight.status}
                            onChange={handleInsightStatusChange(insight.id)}
                            size="small"
                            sx={{ minWidth: 140 }}
                          >
                            {INSIGHT_STATUSES.map((status) => (
                              <MenuItem key={status} value={status}>
                                {status}
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog
        open={showCreateFunnelDialog}
        onClose={() => setShowCreateFunnelDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Conversion Funnel</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Funnel Name"
            value={newFunnelName}
            onChange={(event) => setNewFunnelName(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateFunnelDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateFunnel}
            variant="contained"
            sx={theming.getThemedButtonSx()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showCreateTestDialog}
        onClose={() => setShowCreateTestDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create A/B Test</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Test Name"
            value={newTestName}
            onChange={(event) => setNewTestName(event.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateTestDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateTest}
            variant="contained"
            sx={theming.getThemedButtonSx()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((previous) => ({ ...previous, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdvancedAnalyticsDashboard;


