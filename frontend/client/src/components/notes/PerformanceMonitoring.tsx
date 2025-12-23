import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Radio,
  RadioGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface PerformanceMetric {
  id: string;
  name: string;
  description: string;
  category: 'core_web_vitals' | 'performance' | 'accessibility' | 'seo' | 'best_practices';
  value: number;
  threshold: number;
  unit: 'ms' | 'score' | 'bytes' | 'count' | 'percentage';
  status: 'good' | 'needs_improvement' | 'poor';
  trend: 'up' | 'down' | 'stable';
  lastUpdated: Date;
  history: PerformanceDataPoint[]
}

interface PerformanceDataPoint {
  timestamp: Date;
  value: number;
  context?: string
}

interface PerformanceAlert {
  id: string;
  metricId: string;
  type: 'threshold' | 'anomaly' | 'degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggered: Date;
  resolved?: Date;
  status: 'active' | 'resolved' | 'dismissed'
}

interface PerformanceMonitoringProps {
  className?: string;
  onMetricChange?: (metric: PerformanceMetric) => void;
  onAlertChange?: (alert: PerformanceAlert) => void;
  onPerformanceExport?: (data: { metrics: PerformanceMetric[], alerts: PerformanceAlert[, ],}) => void;
}

// Mock data
const defaultMetrics: PerformanceMetric[] = [
  {
    id: 'lcp',
    name: 'Largest Contentful Paint',
    description: 'Time to render the largest content element',
    category: 'core_web_vitals',
    value: 2.1,
    threshold: 2.5,
    unit: 'ms',
    status: 'good',
    trend: 'stable',
    lastUpdated: new Date('2024-01-15', ),
    history: [
      { timestamp: new Date('2024-01-10,', ), value: 2.3,},
      { timestamp: new Date('2024-01-11,', ), value: 2.1,},
      { timestamp: new Date('2024-01-12', ), value: 2.0,},
      { timestamp: new Date('2024-01-13', ), value: 2.2,},
      { timestamp: new Date('2024-01-14', ), value: 2.1,},
      { timestamp: new Date('2024-01-15', ), value: 2.1,}
    ]
},
  {
    id: 'fid',
    name: 'First Input Delay',
    description: 'Time from first user interaction to browser response',
    category: 'core_web_vitals',
    value:  45,
    threshold: 10,
    unit: 'ms',
    status: 'good',
    trend: 'down',
    lastUpdated: new Date('2024-01-15', ),
    history: [
      { timestamp: new Date('2024-01-10', ), value: 60,},
      { timestamp: new Date('2024-01-11', ), value: 55,},
      { timestamp: new Date('2024-01-12', ), value: 50,},
      { timestamp: new Date('2024-01-13', ), value: 48,},
      { timestamp: new Date('2024-01-14', ), value: 46,},
      { timestamp: new Date('2024-01-15', ), value: 45,}
    ]
},
  {
    id: 'cls',
    name: 'Cumulative Layout Shift',
    description: 'Visual stability of the page',
    category: 'core_web_vitals',
    value: 0.5,
    threshold: 0.1,
    unit: 'score',
    status: 'needs_improvement',
    trend: 'up',
    lastUpdated: new Date('2024-01-15', ),
    history: [
      { timestamp: new Date('2024-01-10', ), value: 0.1, 2,},
      { timestamp: new Date('2024-01-11', ), value: 0.1, 3,},
      { timestamp: new Date('2024-01-12', ), value: 0.1, 4,},
      { timestamp: new Date('2024-01-13', ), value: 0.1, 5,},
      { timestamp: new Date('2024-01-14', ), value: 0.1, 5,},
      { timestamp: new Date('2024-01-15', ), value: 0.1, 5,}
    ]
},
  {
    id: 'ttfb',
    name: 'Time to First Byte',
    description: 'Time until the first byte of response',
    category: 'performance',
    value: 80,
    threshold: 60,
    unit: 'ms',
    status: 'needs_improvement',
    trend: 'stable',
    lastUpdated: new Date('2024-01-15', ),
    history: [
      { timestamp: new Date('2024-01-10', ), value: 850,},
      { timestamp: new Date('2024-01-11', ), value: 820,},
      { timestamp: new Date('2024-01-12', ), value: 800,},
      { timestamp: new Date('2024-01-13', ), value: 810,},
      { timestamp: new Date('2024-01-14', ), value: 800,},
      { timestamp: new Date('2024-01-15', ), value: 800,}
    ]
},
  {
    id: 'accessibility',
    name: 'Accessibility Score',
    description: 'Overall accessibility compliance',
    category: 'accessibility',
    value:  85,
    threshold:  90,
    unit: 'score',
    status: 'needs_improvement',
    trend: 'up',
    lastUpdated: new Date('2024-01-15', ),
    history: [
      { timestamp: new Date('2024-01-10', ), value: 80,},
      { timestamp: new Date('2024-01-11', ), value: 82,},
      { timestamp: new Date('2024-01-12', ), value: 83,},
      { timestamp: new Date('2024-01-13', ), value: 84,},
      { timestamp: new Date('2024-01-14', ), value: 85,},
      { timestamp: new Date('2024-01-15', ), value: 85,}
    ]
}
];

const defaultAlerts: PerformanceAlert[] = [
  {
    id: 'alert',
    metricId: 'cls',
    type: 'threshold',
    severity: 'medium',
    message: 'Cumulative Layout Shift exceeds threshold',
    triggered: new Date('2024-01-15', ),
    status: 'active'
},
  {
    id: 'alert',
    metricId: 'ttfb',
    type: 'threshold',
    severity: 'low',
    message: 'Time to First Byte is above recommended value',
    triggered: new Date('2024-01-14', ),
    status: 'active'
}
];

const PerformanceMonitoring: React.FC<PerformanceMonitoringProps> = ({
  className =', ',
  onMetricChange,
  onAlertChange,
  onPerformanceExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<PerformanceAlert | null>(null);
  const [showMetricEditor, setShowMetricEditor] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>(defaultMetrics);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>(defaultAlerts);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Handlers
  const handleMetricSelect = useCallback((metric: PerformanceMetric) => {
    setSelectedMetric(metric);
    onMetricChange?.(metric);
}, [onMetricChange]);

  const handleAlertSelect = useCallback((alert: PerformanceAlert) => {
    setSelectedAlert(alert);
    setShowAlertDialog(true);
}, []);

  const handleMetricEdit = useCallback((metric: PerformanceMetric) => {
    setSelectedMetric(metric);
    setShowMetricEditor(true);
}, []);

  const handleMetricSave = useCallback(() => {
    if (selectedMetric) {
      const existingIndex = metrics.findIndex(m => m.id === selectedMetric.id);
      if (existingIndex >= 0) {
        setMetrics(prev => prev.map((m, i) => i === existingIndex ? selectedMetric : m));
    } else {
        setMetrics(prev => [...prev, selectedMetric]);
    }
      setShowMetricEditor(false);
  }
}, [selectedMetric, metrics]);

  const handleAlertDismiss = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { .., .status: 'dismissed' as const } : a
    ));
}, []);

  const handleAlertResolve = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { .., .status: 'resolved' as const, resolved: new Date(),} : a
    ));
}, []);

  const handlePerformanceExport = useCallback(() => {
    onPerformanceExport?.({ metrics, alerts });
}, [metrics, alerts, onPerformanceExport]);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'core_web_vitals': return <CREATOR_HUB_ICONS.timeline />;
      case 'performance': return <CREATOR_HUB_ICONS.speed />;
      case 'accessibility': return <CREATOR_HUB_ICONS.accessibility />;
      case 'seo': return <CREATOR_HUB_ICONS.seo />;
      case 'best_practices': return <CREATOR_HUB_ICONS.checkCircle />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'good': return <CREATOR_HUB_ICONS.checkCircle />;
      case 'needs_improvement': return <CREATOR_HUB_ICONS.warning />;
      case 'poor': return <CREATOR_HUB_ICONS.error />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'needs_improvement': return 'warning';
      case 'poor': return 'error';
      default: return 'default';
}
}, []);

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
}
}, []);

  const getTrendIcon = useCallback((trend: string) => {
    switch (trend) {
      case 'up': return <CREATOR_HUB_ICONS.trendingUp />;
      case 'down': return <CREATOR_HUB_ICONS.trendingDown />;
      case 'stable': return <CREATOR_HUB_ICONS.trendingFlat />;
      default: return <CREATOR_HUB_ICONS.info />;
}
}, []);

  // Memoized data
  const performanceStats = useMemo(() => {
    const totalMetrics = metrics.length;
    const goodMetrics = metrics.filter(m => m.status === 'good').length;
    const needsImprovementMetrics = metrics.filter(m => m.status === 'needs_improvement').length;
    const poorMetrics = metrics.filter(m => m.status === 'poor').length;
    const activeAlerts = alerts.filter(a => a.status === 'active').length;
    const avgScore = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
    
    return { totalMetrics, goodMetrics, needsImprovementMetrics, poorMetrics, activeAlerts, avgScore };
}, [metrics, alerts]);

  const recentActivity = useMemo(() => {
    return [
      { id: 1, action: 'Performance metric updated', metric: 'LC', timestamp: new Date(), type: 'metric',},
      { id: 2, action: 'Alert triggered', alert: 'CLS threshold exceeded', timestamp: new Date(), type: 'alert',},
      { id:  3, action: 'Performance test completed', test: 'Core Web Vitals', timestamp: new Date(), type: 'test',},
    ];
}, []);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.performance sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Performance Monitoring</Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time performance metrics and monitoring
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.add />}
              onClick={() => {
                setSelectedMetric({
                  id: `metric-${Date.now()}`,
                  name: 'New Metric',
                  description: 'Custom performance metric',
                  category: 'performance',
                  value:  0,
                  threshold: 10,
                  unit: 'score',
                  status: 'good',
                  trend: 'stable',
                  lastUpdated: new Date(),
                  history: []
            });
                setShowMetricEditor(true);
            }}
            >
              New Metric
            </Button>
            <Button variant="contained"
              startIcon={isMonitoring ? <CREATOR_HUB_ICONS.pause sx={theming.getThemedButtonSx()} /> : <CREATOR_HUB_ICONS.playArrow />}
              onClick={() => setIsMonitoring(!isMonitoring)}
            >
              {isMonitoring ? 'Pause' : 'Start'} Monitoring
            </Button>
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.download />}
              onClick={handlePerformanceExport}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb:  3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.performance sx={{ fontSize:  40, color: 'primary.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{performanceStats.totalMetrics}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Metrics</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.checkCircle sx={{ fontSize:  40, color: 'success.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{performanceStats.goodMetrics}</Typography>
                  <Typography variant="body2" color="text.secondary">Good Metrics</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.warning sx={{ fontSize:  40, color: 'warning.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{performanceStats.needsImprovementMetrics}</Typography>
                  <Typography variant="body2" color="text.secondary">Need Improvement</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" spacing={2} alignItems="center">
                <CREATOR_HUB_ICONS.error sx={{ fontSize:  40, color: 'error.main'}} />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{performanceStats.activeAlerts}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Alerts</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Metrics" icon={<CREATOR_HUB_ICONS.timeline />} />
        <Tab label="Alerts" icon={<CREATOR_HUB_ICONS.warning />} />
        <Tab label="Trends" icon={<CREATOR_HUB_ICONS.trendingUp />} />
        <Tab label="Activity" icon={<CREATOR_HUB_ICONS.history />} />
      </Tabs>

      {/* Metrics Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {metrics.map((metric) => (
            <Grid item xs={12} sm={6} md={4} key={metric.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer', '&:hover': { elevation:  4 },
                  transition: 'all 0.2',
                  border: selectedMetric?.id === metric.id ? 2 : 0,
                  borderColor: selectedMetric?.id === metric.id ? 'primary.main' : 'transparent'
            }}
                onClick={() => handleMetricSelect(metric)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {getCategoryIcon(metric.category)}
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                        {metric.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {metric.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                        <Chip 
                          label={metric.category.replace('_', ', ')}
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          icon={getStatusIcon(metric.status)}
                          label={metric.status}
                          size="small" 
                          color={getStatusColor(metric.status) as any}
                        />
                        <Chip 
                          icon={getTrendIcon(metric.trend)}
                          label={metric.trend}
                          size="small" 
                          variant="outlined"
                        />
                      </Stack>
                      
                      <Stack direction="row" spacing={2} sx={{ mb:  2 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Current Value
                          </Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {metric.value} {metric.unit}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Threshold
                          </Typography>
                          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                            {metric.threshold} {metric.unit}
                          </Typography>
                        </Box>
                      </Stack>
                      
                      <LinearProgress 
                        variant="determinate" 
                        value={(metric.value / metric.threshold) * 100}
                        sx={{ mb: 2, height:  4, borderRadius:  2 }}
                        color={metric.status === 'good' ? 'success' : metric.status === 'needs_improvement' ? 'warning' : 'error'}
                      />
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.edit />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMetricEdit(metric);
                        }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CREATOR_HUB_ICONS.timeline />}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle view history
                        }}
                        >
                          History
                        </Button>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Alerts Tab */}
      {activeTab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Performance Alerts
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Alert</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Triggered</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {alert.message}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {metrics.find(m => m.id === alert.metricId)?.name || 'Unknown Metric'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.severity}
                        color={getSeverityColor(alert.severity) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={alert.status}
                        color={alert.status === 'active' ? 'error' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {alert.triggered.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAlertSelect(alert)}
                        >
                          View
                        </Button>
                        {alert.status === 'active' && (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleAlertResolve(alert.id)}
                            >
                              Resolve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleAlertDismiss(alert.id)}
                            >
                              Dismiss
                            </Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Trends Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Performance Trends
          </Typography>
          <Grid container spacing={2}>
            {metrics.map((metric) => (
              <Grid item xs={12} md={6} key={metric.id}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {metric.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {metric.description}
                    </Typography>
                    
                    <Box sx={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Typography variant="body1" color="text.secondary">
                        Chart visualization would go here
                      </Typography>
                    </Box>
                    
                    <Stack direction="row" spacing={2} sx={{ mt:  2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Current
                        </Typography>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {metric.value} {metric.unit}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Trend
                        </Typography>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {metric.trend}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Chip
                          label={metric.status}
                          color={getStatusColor(metric.status) as any}
                          size="small"
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Activity Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Performance Activity
          </Typography>
          <List>
            {recentActivity.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemIcon>
                  <CREATOR_HUB_ICONS.history />
                </ListItemIcon>
                <ListItemText
                  primary={activity.action}
                  secondary={`${activity.metric || activity.alert || activity.test} • ${activity.timestamp.toLocaleString()}`}
                />
                <Chip 
                  label={activity.type}
                  size="small" 
                  color="primary"
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Metric Editor Dialog */}
      <Dialog open={showMetricEditor} onClose={() => setShowMetricEditor(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.performance />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              {selectedMetric?.id.startsWith('metric-') ? 'Create Metric' : 'Edit Metric'}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedMetric && (
            <Stack spacing={3} sx={{ mt:  2 }}>
              <TextField
                label="Metric Name"
                value={selectedMetric.name}
                onChange={(e) => setSelectedMetric(prev => prev ? { ...prev, name: e.target.value } : null)}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedMetric.description}
                onChange={(e) => setSelectedMetric(prev => prev ? { ...prev, description: e.target.value } : null)}
                fullWidth
                multiline
                rows={2}
              />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedMetric.category}
                    onChange={(e) => setSelectedMetric(prev => prev ? { ...prev, category: e.target.value as any } : null)}
                  >
                    <MenuItem value="core_web_vitals">Core Web Vitals</MenuItem>
                    <MenuItem value="performance">Performance</MenuItem>
                    <MenuItem value="accessibility">Accessibility</MenuItem>
                    <MenuItem value="seo">SEO</MenuItem>
                    <MenuItem value="best_practices">Best Practices</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={selectedMetric.unit}
                    onChange={(e) => setSelectedMetric(prev => prev ? { ...prev, unit: e.target.value as any } : null)}
                  >
                    <MenuItem value="ms">Milliseconds</MenuItem>
                    <MenuItem value="score">Score</MenuItem>
                    <MenuItem value="bytes">Bytes</MenuItem>
                    <MenuItem value="count">Count</MenuItem>
                    <MenuItem value="percentage">Percentage</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Current Value"
                  type="number"
                  value={selectedMetric.value}
                  onChange={(e) => setSelectedMetric(prev => prev ? { ...prev, value: parseFloat(e.target.value, ),} : null)}
                  fullWidth
                />
                <TextField
                  label="Threshold"
                  type="number"
                  value={selectedMetric.threshold}
                  onChange={(e) => setSelectedMetric(prev => prev ? { ...prev, threshold: parseFloat(e.target.value, ),} : null)}
                  fullWidth
                />
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMetricEditor(false)}>
            Cancel
          </Button>
          <Button variant="contained" 
            onClick={handleMetricSave}
           sx={theming.getThemedButtonSx()}>
            {selectedMetric?.id.startsWith('metric-') ? 'Create' : 'Update'} Metric
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onClose={() => setShowAlertDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.warning />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Alert Details
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Stack spacing={2} sx={{ mt:  2 }}>
              <Box>
                <Typography variant="subtitle2">Message</Typography>
                <Typography variant="body1">
                  {selectedAlert.message}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Severity</Typography>
                <Chip
                  label={selectedAlert.severity}
                  color={getSeverityColor(selectedAlert.severity) as any}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2">Status</Typography>
                <Chip
                  label={selectedAlert.status}
                  color={selectedAlert.status === 'active' ? 'error' : 'success'}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2">Triggered</Typography>
                <Typography variant="body1">
                  {selectedAlert.triggered.toLocaleString()}
                </Typography>
              </Box>
              {selectedAlert.resolved && (
                <Box>
                  <Typography variant="subtitle2">Resolved</Typography>
                  <Typography variant="body1">
                    {selectedAlert.resolved.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAlertDialog(false)}>
            Close
          </Button>
          {selectedAlert?.status ==='active' && (
            <>
              <Button
                variant="outlined"
                color="success"
                onClick={() => {
                  handleAlertResolve(selectedAlert.id);
                  setShowAlertDialog(false);
              }}
              >
                Resolve
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => {
                  handleAlertDismiss(selectedAlert.id);
                  setShowAlertDialog(false);
              }}
              >
                Dismiss
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PerformanceMonitoring;

