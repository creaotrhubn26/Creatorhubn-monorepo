/**
 * Monitoring Dashboard Component
 * Real-time monitoring dashboard for system health
 */

// import { useTheming } from '../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
  Avatar,
  ListItemAvatar,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  // Cpu as CpuIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  BugReport as BugReportIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Storage as DatabaseIcon,
  Api as ApiIcon,
  Monitor as MonitorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  Clear as ClearIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { usePerformanceProfiler } from '@/hooks/usePerformanceProfiler';
import { useCachingStrategy } from '@/hooks/useCachingStrategy';

interface MonitoringDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showAlerts?: boolean;
  showMetrics?: boolean;
  showPerformance?: boolean;
  showCaching?: boolean;
  showSystem?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onAlertsClick?: () => void;
  onMetricsClick?: () => void;
  onPerformanceClick?: () => void;
  onCachingClick?: () => void;
  onSystemClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showAlerts = true,
  showMetrics = true,
  showPerformance = true,
  showCaching = true,
  showSystem = true,
  variant = 'full',
  position = 'top-left',
  onSettingsClick,
  onAlertsClick,
  onMetricsClick,
  onPerformanceClick,
  onCachingClick,
  onSystemClick,
  className,
  style
}) => {
  // Mock performance profiler
  const [profilingActive, setProfilingActive] = useState(false);
  const performanceProfiler = useMemo(() => ({
    overallScore: 85,
    bottleneckCount: 3,
    alertCount: 2,
    metrics: [
      { id: '1', name: 'Render Time', duration: 16.5, category: 'performance', severity: 'low', timestamp: new Date().toISOString() },
      { id: '2', name: 'Memory Usage', duration: 45.2, category: 'memory', severity: 'medium', timestamp: new Date().toISOString() }
    ],
    clear: () => { setAlerts([]); setSystemHealth('healthy'); },
    startProfiling: () => { setProfilingActive(true); setIsMonitoring(true); },
    stopProfiling: () => { setProfilingActive(false); },
    getMetrics: () => []
  }), []);

  // Mock caching strategy
  const cachingStrategy = useMemo(() => ({
    totalSize: 50 * 1024 * 1024, // 50MB
    hitRate: 0.85,
    entryCount: 1250,
    clear: () => { setSystemHealth('healthy'); },
    stats: {
      topKeys: [
        { key: 'user:123', accessCount: 150 },
        { key: 'session:abc', accessCount: 120 },
        { key: 'cache:data', accessCount: 100 }
      ],
      topTags: [
        { tag: 'user-data', count: 45 },
        { tag: 'session', count: 32 },
        { tag: 'cache', count: 28 }
      ]
  }
  }), []);

  const [tabValue, setTabValue] = useState(0);

  // Theming system - mock implementation
  const theming = {
    getThemedCardSx: () => ({ bgcolor: 'background.paper' }),
    colors: { primary: 'primary.main' }
};
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<Record<string, unknown> | null>(null);
  const [metricDetailsOpen, setMetricDetailsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([]);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  // System health calculation
  useEffect(() => {
    const calculateSystemHealth = () => {
      const score = performanceProfiler.overallScore;
      const bottleneckCount = performanceProfiler.bottleneckCount;
      const alertCount = performanceProfiler.alertCount;
      const hitRate = cachingStrategy.hitRate;

      if (score < 50 || bottleneckCount > 10 || alertCount > 5 || hitRate < 0.5) {
        setSystemHealth('critical');
    } else if (score < 80 || bottleneckCount > 5 || alertCount > 2 || hitRate < 0.8) {
        setSystemHealth('warning');
    } else {
        setSystemHealth('healthy');
    }
  };

    calculateSystemHealth();
}, [performanceProfiler.overallScore, performanceProfiler.bottleneckCount, performanceProfiler.alertCount, cachingStrategy.hitRate]);

  // Get health color
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
}
};

  // Get health icon
  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircleIcon />;
      case 'warning': return <WarningIcon />;
      case 'critical': return <ErrorIcon />;
      default: return <InfoIcon />;
}
};

  // Get trend icon
  const getTrendIcon = (value: number, previous: number) => {
    if (value > previous) return <TrendingUpIcon />;
    if (value < previous) return <TrendingDownIcon />;
    return <TrendingFlatIcon />;
};

  // Handle metric click
  const handleMetricClick = useCallback((metric: Record<string, unknown>) => {
    setSelectedMetric(metric);
    setMetricDetailsOpen(true);
}, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    // Force refresh of all data
    performanceProfiler.clear();
    cachingStrategy.clear();
}, [performanceProfiler, cachingStrategy]);

  // Handle monitoring toggle
  const handleMonitoringToggle = useCallback(() => {
    const newState = !isMonitoring;
    setIsMonitoring(newState);
    if (newState) {
      performanceProfiler.startProfiling();
    } else {
      performanceProfiler.stopProfiling();
    }
}, [isMonitoring, performanceProfiler]);

  if (variant === 'minimal') {
    return (
      <Card className={className} style={style} sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>System Health</Typography>
            <Chip
              label={systemHealth}
              color={getHealthColor(systemHealth) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
              icon={getHealthIcon(systemHealth)}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Score: {performanceProfiler.overallScore}/100
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
}

  return (
    <Box className={className} style={style}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
          System Monitoring
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          {profilingActive && (
            <Chip label="Profiling" color="warning" size="small" />
          )}
          <Tooltip title={isMonitoring ? "Pause Monitoring" : "Resume Monitoring"}>
            <IconButton onClick={handleMonitoringToggle} color={isMonitoring ? "primary" : "default"}>
              {isMonitoring ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={onSettingsClick}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* System Health Overview */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: `${getHealthColor(systemHealth)}.main`, mr: 2 }}>
                  {getHealthIcon(systemHealth)}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{systemHealth.toUpperCase()}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    System Health
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <SpeedIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{performanceProfiler.overallScore}/100</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Performance Score
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <BugReportIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{performanceProfiler.bottleneckCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bottlenecks
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <MemoryIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{(cachingStrategy.totalSize / 1024 / 1024).toFixed(1)}MB</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Cache Size
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" icon={<MonitorIcon />} />
          <Tab label="Performance" icon={<SpeedIcon />} />
          <Tab label="Caching" icon={<StorageIcon />} />
          <Tab label="Alerts" icon={<NotificationsIcon />} />
          <Tab label="System" icon={<SettingsIcon />} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Performance Metrics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <SpeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Overall Score"
                        secondary={`${performanceProfiler.overallScore}/100`}
                      />
                      <ListItemSecondaryAction>
                        <Chip
                          label={performanceProfiler.overallScore > 80 ? 'Good' : performanceProfiler.overallScore > 60 ? 'Fair' : 'Poor'}
                          color={performanceProfiler.overallScore > 80 ? 'success' : performanceProfiler.overallScore > 60 ? 'warning' : 'error'}
                          size="small"
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <BugReportIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Bottlenecks"
                        secondary={`${performanceProfiler.bottleneckCount} found`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Alerts"
                        secondary={`${performanceProfiler.alertCount} active`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Cache Metrics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <StorageIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Hit Rate"
                        secondary={`${(cachingStrategy.hitRate * 100).toFixed(1)}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <DatabaseIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Entries"
                        secondary={`${cachingStrategy.entryCount} items`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <MemoryIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Size"
                        secondary={`${(cachingStrategy.totalSize / 1024 / 1024).toFixed(1)}MB`}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {tabValue === 1 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Metrics
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {performanceProfiler.metrics.slice(0, 10).map((metric) => (
                      <TableRow key={metric.id} hover>
                        <TableCell>{metric.name}</TableCell>
                        <TableCell>{metric.category}</TableCell>
                        <TableCell>{metric.duration.toFixed(2)}ms</TableCell>
                        <TableCell>
                          <Chip
                            label={metric.severity}
                            color={metric.severity === 'critical' ? 'error' : metric.severity === 'high' ? 'warning' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{new Date(metric.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleMetricClick(metric)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {tabValue === 2 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Cache Statistics
              </Typography>
              {cachingStrategy.stats && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Top Keys</Typography>
                    <List dense>
                      {cachingStrategy.stats.topKeys.slice(0, 5).map((item, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={item.key}
                            secondary={`${item.accessCount} accesses`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Top Tags</Typography>
                    <List dense>
                      {cachingStrategy.stats.topTags.slice(0, 5).map((item, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={item.tag}
                            secondary={`${item.count} items`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {tabValue === 3 && (
        <Box>
          <Alert severity="info">
            Alert system is not yet implemented. This will show real-time alerts and notifications.
          </Alert>
        </Box>
      )}

      {tabValue === 4 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                System Settings
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isMonitoring}
                      onChange={handleMonitoringToggle}
                    />
                }
                  label="Enable Monitoring"
                />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Refresh Interval: {refreshInterval}ms
                  </Typography>
                  <Slider
                    value={refreshInterval}
                    onChange={(_, value) => setRefreshInterval(value as number)}
                    min={500}
                    max={5000}
                    step={500}
                    marks={[
                      { value: 500, label: '0.5s' },
                      { value: 1000, label: '1s' },
                      { value: 2000, label: '2s' },
                      { value: 5000, label: '5s' }
                    ]}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Metric Details Dialog */}
      <Dialog
        open={metricDetailsOpen}
        onClose={() => setMetricDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Metric Details</DialogTitle>
        <DialogContent>
          {selectedMetric && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Name</Typography>
                  <Typography variant="body2">{selectedMetric.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Category</Typography>
                  <Typography variant="body2">{selectedMetric.category}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Duration</Typography>
                  <Typography variant="body2">{selectedMetric.duration.toFixed(2)}ms</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Severity</Typography>
                  <Chip
                    label={selectedMetric.severity}
                    color={selectedMetric.severity === 'critical' ? 'error' : selectedMetric.severity === 'high' ? 'warning' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Metadata</Typography>
                  <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedMetric.metadata, null, 2)}
                    </pre>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMetricDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

MonitoringDashboard.displayName ='MonitoringDashboard';

export default MonitoringDashboard;

