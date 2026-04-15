// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Stack,
  LinearProgress,
  Divider,
  Tooltip,
  Badge,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Alert,
  AlertTitle,
} from '@mui/material';
import { CREATOR_HUB_ICONS } from '../shared/CreatorHubIcons';

// Types
interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  description: string;
  category: 'loading' | 'rendering' | 'memory' | 'network' | 'interaction'
}

interface PerformanceAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  component?: string;
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface ResourceUsage {
  id: string;
  name: string;
  type: 'javascript' | 'css' | 'image' | 'font' | 'api';
  size: number;
  loadTime: number;
  cached: boolean;
  compression: number;
  priority: 'high' | 'medium' | 'low'
}

interface PerformanceMonitorProps {
  className?: string;
  onAlert?: (alert: PerformanceAlert) => void;
  onOptimize?: (suggestions: string[]) => void;
  onExport?: (data: any) => void
}

// Mock data






const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  className ='',
  onAlert,
  onOptimize,
  onExport
}) => {
  // State
  const [activeTab, setActiveTab] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric | null>(null);
  const [showOptimization, setShowOptimization] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Handlers
  const handleMetricClick = useCallback((metric: PerformanceMetric) => {
    setSelectedMetric(metric);
}, []);

  const handleOptimize = useCallback(() => {
    const suggestions = [
      'Enable gzip compression for static assets', 'Implement lazy loading for images', 'Minify JavaScript and CSS files', 'Use CDN for static resources', 'Optimize database queries'
    ];
    onOptimize?.(suggestions);
    setShowOptimization(true);
}, [onOptimize]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
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

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'javascript': return <CREATOR_HUB_ICONS.code />;
      case 'css': return <CREATOR_HUB_ICONS.palette />;
      case 'image': return <CREATOR_HUB_ICONS.image />;
      case 'font': return <CREATOR_HUB_ICONS.typography />;
      case 'api': return <CREATOR_HUB_ICONS.settings />;
      default: return <CREATOR_HUB_ICONS.description />;
}
}, []);

  const formatValue = useCallback((metric: PerformanceMetric) => {
    const { value, unit } = metric;
    switch (unit) {
      case 'ms':
        return `${value}ms`;
      case 'bytes':
        return `${(value / 1024).toFixed(1)}KB`;
      case 'count':
        return value.toString();
      case 'percentage':
        return `${value}%`;
      default: return value.toString();
}
}, []);

  const formatSize = useCallback((bytes: number) => {
    if (bytes === 0) return 'N/A';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed()}MB`;
    return `${kb.toFixed(1)}KB`;
}, []);

  // Memoized data
  const criticalAlerts = useMemo(() => {
    return mockAlerts.filter(alert => !alert.resolved && alert.severity === 'critical');
}, []);

  const warningAlerts = useMemo(() => {
    return mockAlerts.filter(alert => !alert.resolved && alert.severity === 'high');
}, []);

  const performanceScore = useMemo(() => {
    const goodMetrics = mockMetrics.filter(m => m.status === 'good').length;
    return Math.round((goodMetrics / mockMetrics.length) * 100);
}, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (!monitoringEnabled) return;

    const interval = setInterval(() => {
      // Simulate metric updates
      console.log('Refreshing performance metrics...');
  }, refreshInterval);

    return () => clearInterval(interval);
}, [monitoringEnabled, refreshInterval]);

  return (
    <Box className={className} sx={{ width: '100%'}}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.assessment sx={{ fontSize:  32, color: 'primary.main'}} />
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>Performance Monitor</Typography>
              <Typography variant="body2" color="text.secondary">
                Real-time performance monitoring and optimization
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={monitoringEnabled}
                  onChange={(e) => setMonitoringEnabled(e.target.checked)}
                />
            }
              label="Monitoring"
            />
            <Button
              variant="outlined"
              startIcon={<CREATOR_HUB_ICONS.autoFixHigh />}
              onClick={handleOptimize}
            >
              Optimize
            </Button>
            <Button variant="contained"
              startIcon={<CREATOR_HUB_ICONS.download sx={theming.getThemedButtonSx()} />}
              onClick={() => onExport?.(mockMetrics)}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Alerts */}
      {criticalAlerts.length > 0 && (
        <Alert severity="error" sx={{ mb:  2 }}>
          <AlertTitle>Critical Performance Issues</AlertTitle>
          {criticalAlerts.length} critical issue(s) detected that require immediate attention.
        </Alert>
      )}

      {warningAlerts.length > 0 && (
        <Alert severity="warning" sx={{ mb:  2 }}>
          <AlertTitle>Performance Warnings</AlertTitle>
          {warningAlerts.length} warning(s) that may impact user experience.
        </Alert>
      )}

      {/* Performance Score */}
      <Grid container spacing={2} sx={{ mb:  2 }}>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.assessment color="primary" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{performanceScore}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Performance Score
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.warning color="warning" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{mockAlerts.filter(a => !a.resolved).length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Alerts
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <CREATOR_HUB_ICONS.timeline color="info" />
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{refreshInterval / 1000}s</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Refresh Rate
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb:  2 }}>
        <Tab label="Metrics" icon={<CREATOR_HUB_ICONS.assessment />} />
        <Tab label="Resources" icon={<CREATOR_HUB_ICONS.description />} />
        <Tab label="Alerts" icon={<CREATOR_HUB_ICONS.warning />} />
        <Tab label="Optimization" icon={<CREATOR_HUB_ICONS.autoFixHigh />} />
      </Tabs>

      {/* Metrics Tab */}
      {activeTab === 0 && (
        <Grid container spacing={2}>
          {mockMetrics.map((metric) => (
            <Grid item xs={12} sm={6} md={4} key={metric.id}>
              <Card 
                sx={{ 
                  cursor: 'pointer','&:hover': { elevation:  4 },
                  transition: 'all 0.2s'
            }}
                onClick={() => handleMetricClick(metric)} sx={theming.getThemedCardSx()}
              >
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {metric.name}
                      </Typography>
                      <Typography variant="h4" component="div" sx={{ color: theming.colors.primary }}>
                        {formatValue(metric)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt:  1 }}>
                        <Chip 
                          label={metric.status}
                          size="small" 
                          color={getStatusColor(metric.status)}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Threshold: {formatValue({ ...metric, value: metric.threshold })}
                        </Typography>
                      </Stack>
                    </Box>
                    <Chip 
                      label={metric.category}
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                  </Stack>
                  <LinearProgress 
                    variant="determinate" 
                    value={(metric.value / metric.threshold) * 100}
                    color={getStatusColor(metric.status)}
                    sx={{ mt: 2, height:  4, borderRadius:  2 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Resources Tab */}
      {activeTab === 1 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Resource Usage
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Resource</TableCell>
                  <TableCell align="right">Type</TableCell>
                  <TableCell align="right">Size</TableCell>
                  <TableCell align="right">Load Time</TableCell>
                  <TableCell align="right">Cached</TableCell>
                  <TableCell align="right">Compression</TableCell>
                  <TableCell align="right">Priority</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockResources.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {getTypeIcon(resource.type)}
                        <Typography variant="body2">{resource.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={resource.type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{formatSize(resource.size)}</TableCell>
                    <TableCell align="right">{resource.loadTime}ms</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={resource.cached ? 'Yes' : 'No'}
                        size="small" 
                        color={resource.cached ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">{resource.compression}%</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={resource.priority}
                        size="small" 
                        color={resource.priority === 'high' ? 'error' : resource.priority === 'medium' ? 'warning' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Alerts Tab */}
      {activeTab === 2 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Performance Alerts
          </Typography>
          <List>
            {mockAlerts.map((alert) => (
              <React.Fragment key={alert.id}>
                <ListItem>
                  <ListItemIcon>
                    <Badge 
                      color={getSeverityColor(alert.severity)}
                      variant="dot"
                    >
                      <CREATOR_HUB_ICONS.warning />
                    </Badge>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1">{alert.title}</Typography>
                        <Chip 
                          label={alert.severity}
                          size="small" 
                          color={getSeverityColor(alert.severity)}
                        />
                        {alert.component && (
                          <Chip label={alert.component} size="small" variant="outlined" />
                        )}
                        <Chip 
                          label={alert.resolved ? 'Resolved' : 'Active'}
                          size="small" 
                          color={alert.resolved ? 'success' : 'warning'}
                        />
                      </Stack>
                  }
                    secondary={
                      <Stack spacing={1}>
                        <Typography variant="body2">{alert.message}</Typography>
                        <Typography variant="caption">
                          {alert.timestamp.toLocaleString()}
                        </Typography>
                      </Stack>
                  }
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Optimization Tab */}
      {activeTab === 3 && (
        <Paper elevation={1} sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Optimization Suggestions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CREATOR_HUB_ICONS.autoFixHigh color="primary" />
                    <Box>
                      <Typography variant="subtitle1">Enable Compression</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Enable gzip compression for static assets to reduce load times
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CREATOR_HUB_ICONS.image color="primary" />
                    <Box>
                      <Typography variant="subtitle1">Lazy Load Images</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Implement lazy loading for images to improve initial page load
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CREATOR_HUB_ICONS.code color="primary" />
                    <Box>
                      <Typography variant="subtitle1">Minify Assets</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Minify JavaScript and CSS files to reduce file sizes
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <CREATOR_HUB_ICONS.settings color="primary" />
                    <Box>
                      <Typography variant="subtitle1">Use CDN</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Use a CDN for static resources to improve global performance
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Optimization Dialog */}
      <Dialog open={showOptimization} onClose={() => setShowOptimization(false)}>
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <CREATOR_HUB_ICONS.autoFixHigh />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Optimization Applied</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Performance optimizations have been applied. Monitor the metrics to see improvements.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOptimization(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PerformanceMonitor;

