// Placeholder for AdvancedAnalyticsDashboard.tsx
// This component will provide a comprehensive interface for advanced analytics features.
// It will display heatmaps, user behavior tracking, conversion funnels, A/B tests, and real-time metrics.

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge
} from '@mui/material';
import {
  Analytics,
  TrendingUp,
  Visibility,
  MouseIcon,
  Timeline,
  Science,
  Insights,
  Refresh,
  Download,
  Upload,
  PlayArrow,
  Stop,
  Add,
  Edit,
  Delete,
  Warning,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useAdvancedAnalytics } from '../../../hooks/useAdvancedAnalytics';

interface AdvancedAnalyticsDashboardProps {
  onSettingsClick: () => void;
  onHeatmapsClick: () => void;
  onBehaviorClick: () => void;
  onFunnelsClick: () => void;
  onTestsClick: () => void;
  onInsightsClick: () => void;
}

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({
  onSettingsClick,
  onHeatmapsClick,
  onBehaviorClick,
  onFunnelsClick,
  onTestsClick,
  onInsightsClick
}) => {
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showCreateFunnelDialog, setShowCreateFunnelDialog] = useState(false);
  const [showCreateTestDialog, setShowCreateTestDialog] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState('');
  const [newTestName, setNewTestName] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: ', ', severity: 'success' as 'success' | 'error' | 'warning' | 'info',});

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
    importData
} = useAdvancedAnalytics();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
};

  const handleCreateFunnel = () => {
    if (!newFunnelName.trim()) return;

    try {
      createConversionFunnel({
        name: newFunnelName,
        steps:  [],
        totalSessions:  0,
        conversionRate:  0,
        averageTimeToConvert: 0 });
      setSnackbar({ open: true, message: 'Conversion funnel created successfully', severity: 'success',});
      setShowCreateFunnelDialog(false);
      setNewFunnelName(', ');
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to create conversion funnel', severity: 'error',});
  }
};

  const handleCreateTest = () => {
    if (!newTestName.trim()) return;

    try {
      createABTest({
        name: newTestName,
        description: 'New A/B test',
        status: 'draft',
        variants:  [],
        trafficAllocation: 10,
        startDate: new Date(),
        primaryMetric: 'conversion_rate',
        secondaryMetrics:  [],
        confidenceLevel:  95,
        minimumDetectableEffect: 10 });
      setSnackbar({ open: true, message: 'A/B test created successfully', severity: 'success',});
      setShowCreateTestDialog(false);
      setNewTestName('');
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to create A/B test', severity: 'error',});
  }
};

  const handleStartTest = (testId: string) => {
    try {
      startABTest(testId);
      setSnackbar({ open: true, message: 'A/B test started successfully', severity: 'success',});
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to start A/B test', severity: 'error',});
  }
};

  const handleStopTest = (testId: string) => {
    try {
      stopABTest(testId);
      calculateABTestResults(testId);
      setSnackbar({ open: true, message: 'A/B test stopped and results calculated', severity: 'success',});
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to stop A/B test', severity: 'error',});
  }
};

  const handleGenerateInsights = () => {
    try {
      generateInsights();
      setSnackbar({ open: true, message: 'New insights generated', severity: 'success',});
  } catch (err) {
      setSnackbar({ open: true, message: 'Failed to generate insights', severity: 'error',});
  }
};

  const handleUpdateInsightStatus = (id: string, status: string) => {
    try {
      updateInsightStatus(id, status as any);
      setSnackbar({ open: true, message: 'Insight status updated', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to update insight status', severity: 'error' });
  }
};

  const handleExportData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json',});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advanced-analytics-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        importData(data);
        setSnackbar({ open: true, message: 'Data imported successfully', severity: 'success',});
    } catch (err) {
        setSnackbar({ open: true, message: 'Failed to import data', severity: 'error',});
    }
  };
    reader.readAsText(file);
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'draft': return 'default';
      case 'paused': return 'warning';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
}
};

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
}
};

  // Update real-time metrics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      updateRealTimeMetrics();
  }, 30000);

    return () => clearInterval(interval);
}, [updateRealTimeMetrics]);

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  3 }}>
        <Typography variant="h4" component="h1" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          <Analytics color="primary" />
          Advanced Analytics Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap:  1 }}>
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
            <input
              type="file"
              hidden
              accept=".json"
              onChange={handleImportData}
            />
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb:  2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Heatmaps" />
          <Tab label="User Behavior" />
          <Tab label="Conversion Funnels" />
          <Tab label="A/B Tests" />
          <Tab label="Insights" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Real-time Metrics Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Active Users
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {realTimeMetrics.activeUsers}
                </Typography>
                <Typography color="textSecondary">
                  Last hour
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Page Views
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {realTimeMetrics.pageViews}
                </Typography>
                <Typography color="textSecondary">
                  Last hour
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Bounce Rate
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {realTimeMetrics.bounceRate.toFixed(1)}%
                </Typography>
                <Typography color="textSecondary">
                  Last hour
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography color="textSecondary" gutterBottom>
                  Avg Session Duration
                </Typography>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {Math.round(realTimeMetrics.averageSessionDuration)}s
                </Typography>
                <Typography color="textSecondary">
                  Last hour
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Pages */}
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Top Pages
                </Typography>
                <List dense>
                  {realTimeMetrics.topPages.slice(0, 5).map((page, index) => (
                    <ListItem key={index}>
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

          {/* Device Breakdown */}
          <Grid item xs={12} md={6}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Device Breakdown
                </Typography>
                <Box sx={{ mt:  2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                    <Typography variant="body2">Desktop</Typography>
                    <Typography variant="body2">{realTimeMetrics.deviceBreakdown.desktop}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(realTimeMetrics.deviceBreakdown.desktop / (realTimeMetrics.deviceBreakdown.desktop + realTimeMetrics.deviceBreakdown.mobile + realTimeMetrics.deviceBreakdown.tablet)) * 100}
                    sx={{ mb:  2 }}
                  />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                    <Typography variant="body2">Mobile</Typography>
                    <Typography variant="body2">{realTimeMetrics.deviceBreakdown.mobile}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(realTimeMetrics.deviceBreakdown.mobile / (realTimeMetrics.deviceBreakdown.desktop + realTimeMetrics.deviceBreakdown.mobile + realTimeMetrics.deviceBreakdown.tablet)) * 100}
                    sx={{ mb:  2 }}
                  />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1 }}>
                    <Typography variant="body2">Tablet</Typography>
                    <Typography variant="body2">{realTimeMetrics.deviceBreakdown.tablet}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(realTimeMetrics.deviceBreakdown.tablet / (realTimeMetrics.deviceBreakdown.desktop + realTimeMetrics.deviceBreakdown.mobile + realTimeMetrics.deviceBreakdown.tablet)) * 100}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Heatmaps Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Heatmap Data
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb:  2 }}>
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
                          <TableCell>({event.x}, {event.y})</TableCell>
                          <TableCell>
                            <LinearProgress
                              variant="determinate"
                              value={event.intensity}
                              sx={{ width: 100}}
                            />
                          </TableCell>
                          <TableCell>{event.elementId || 'N/A'}</TableCell>
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

      {/* User Behavior Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  User Behavior Events
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb:  2 }}>
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
                          <TableCell>{event.elementText || event.elementId || 'N/A'}</TableCell>
                          <TableCell>({event.position.x}, {event.position.y})</TableCell>
                          <TableCell>{event.sessionId.substring(0, 8)}...</TableCell>
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

      {/* Conversion Funnels Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Conversion Funnels</Typography>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Typography variant="body2">
                                {funnel.conversionRate.toFixed(1)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={funnel.conversionRate}
                                sx={{ width: 100}}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>{funnel.totalSessions}</TableCell>
                          <TableCell>
                            {new Date(funnel.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Edit Funnel">
                              <IconButton size="small">
                                {theming.getThemedIcon('edit')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Funnel">
                              <IconButton size="small" color="error">
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

      {/* A/B Tests Tab */}
      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>A/B Tests</Typography>
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
                              color={getStatusColor(test.status)}
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
                              <Tooltip title="Start Test">
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
                              <Tooltip title="Stop Test">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleStopTest(test.id)}
                                >
                                  {theming.getThemedIcon('stop')}
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Edit Test">
                              <IconButton size="small">
                                {theming.getThemedIcon('edit')}
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

      {/* Insights Tab */}
      {activeTab === 5 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>Analytics Insights</Typography>
                  <Button variant="contained"
                    startIcon={<Insights />}
                    onClick={handleGenerateInsights}
                  >
                    Generate Insights
                  </Button>
                </Box>
                <List>
                  {insights.map((insight) => (
                    <React.Fragment key={insight.id}>
                      <ListItem>
                        <ListItemIcon>
                          {insight.impact === 'critical' || insight.impact === 'high' ? (
                            <Warning color="error" />
                          ) : insight.impact === 'medium' ? (
                            <Warning color="warning" />
                          ) : (
                            <Info color="info" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Typography variant="subtitle1">{insight.title}</Typography>
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
                              <Typography variant="body2" sx={{ mb:  1 }}>
                                {insight.description}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Recommendations: {insight.recommendations.join(', ')}
                              </Typography>
                            </Box>
                        }
                        />
                        <Box sx={{ display: 'flex', gap:  1 }}>
                          <Chip
                            label={insight.status}
                            size="small"
                            color={insight.status === 'implemented' ? 'success' : 'default'}
                          />
                          <Select
                            value={insight.status}
                            onChange={(e) => handleUpdateInsightStatus(insight.id, e.target.value)}
                            size="small"
                            sx={{ minWidth: 120}}
                          >
                            <MenuItem value="new">New</MenuItem>
                            <MenuItem value="reviewed">Reviewed</MenuItem>
                            <MenuItem value="implemented">Implemented</MenuItem>
                            <MenuItem value="dismissed">Dismissed</MenuItem>
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

      {/* Create Funnel Dialog */}
      <Dialog open={showCreateFunnelDialog} onClose={() => setShowCreateFunnelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Conversion Funnel</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Funnel Name"
            value={newFunnelName}
            onChange={(e) => setNewFunnelName(e.target.value)}
            sx={{ mt:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateFunnelDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateFunnel} variant="contained" sx={theming.getThemedButtonSx()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Test Dialog */}
      <Dialog open={showCreateTestDialog} onClose={() => setShowCreateTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create A/B Test</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Test Name"
            value={newTestName}
            onChange={(e) => setNewTestName(e.target.value)}
            sx={{ mt:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateTestDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateTest} variant="contained" sx={theming.getThemedButtonSx()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdvancedAnalyticsDashboard;




