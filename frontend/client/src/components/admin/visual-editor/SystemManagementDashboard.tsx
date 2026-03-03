/**
 * System Management Dashboard Component
 * Comprehensive system management with auto-scaling and backup recovery
 */

import { useTheming } from '../../../utils/theming-helper';
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
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  Api as CpuIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  BugReport as BugReportIcon,
  Security as SecurityIcon,
  Cloud as CloudIcon,
  Dataset as DatabaseIcon,
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
  VisibilityOff as VisibilityOffIcon,
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  CheckCircle as VerifyIcon,
  Scale as ScaleIcon,
  AutoFixHigh as AutoFixHighIcon,
  Tune as TuneIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon2,
  History as HistoryIcon,
  Schedule as ScheduleIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
  WarningAmber as WarningAmberIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import { useAutoScaling } from '@/hooks/useAutoScaling';
import { useBackupRecovery } from '@/hooks/useBackupRecovery';

interface SystemManagementDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showAlerts?: boolean;
  showMetrics?: boolean;
  showScaling?: boolean;
  showBackup?: boolean;
  showRecovery?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onAlertsClick?: () => void;
  onMetricsClick?: () => void;
  onScalingClick?: () => void;
  onBackupClick?: () => void;
  onRecoveryClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const SystemManagementDashboard: React.FC<SystemManagementDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showAlerts = true,
  showMetrics = true,
  showScaling = true,
  showBackup = true,
  showRecovery = true,
  variant = 'full',
  position = 'top-left',
  onSettingsClick,
  onAlertsClick,
  onMetricsClick,
  onScalingClick,
  onBackupClick,
  onRecoveryClick,
  className,
  style
}) => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const autoScaling = useAutoScaling({
    enableAutoScaling: true,
    minInstances:  1,
    maxInstances:  10,
    targetCpuUsage:  70,
    targetMemoryUsage:  80,
    targetResponseTime: 100,
    enableFileSizeScaling: true,
    enableOperationScaling: true
});

  const backupRecovery = useBackupRecovery({
    enableAutoBackup: true,
    backupInterval: 60 * 60 * 100, // 1 hour
    maxBackups: 10,
    backupRetentionDays:  30,
    enableCompression: true,
    enableEncryption: false,
    enableLocalBackup: true,
    enableIncrementalBackup: true,
    enableDifferentialBackup: true,
    enableFullBackup: true,
    enableBackupVerification: true,
    enableBackupMonitoring: true,
    enableBackupAlerts: true
});

  const [tabValue, setTabValue] = useState(0);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  // System health calculation
  useEffect(() => {
    const calculateSystemHealth = () => {
      const scalingScore = autoScaling.currentPerformance;
      const backupScore = backupRecovery.successRate * 100;
      const alertCount = backupRecovery.criticalAlerts + backupRecovery.warningAlerts;
      
      const overallScore = (scalingScore + backupScore) / 2;
      
      if (overallScore < 50 || alertCount > 5) {
        setSystemHealth('critical');
    } else if (overallScore < 80 || alertCount > 2) {
        setSystemHealth('warning');
    } else {
        setSystemHealth('healthy');
    }
  };

    calculateSystemHealth();
}, [autoScaling.currentPerformance, backupRecovery.successRate, backupRecovery.criticalAlerts, backupRecovery.warningAlerts]);

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

  // Handle item click
  const handleItemClick = useCallback((item: unknown) => {
    setSelectedItem(isRecord(item) ? item : { value: item });
    setDetailsOpen(true);
}, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    // Force refresh of all data
    autoScaling.updateConfig({});
    backupRecovery.updateBackupConfig({});
}, [autoScaling, backupRecovery]);

  // Handle monitoring toggle
  const handleMonitoringToggle = useCallback(() => {
    setIsMonitoring(!isMonitoring);
}, [isMonitoring]);

  // Handle backup creation
  const handleCreateBackup = useCallback(async (type: 'full' | 'incremental' | 'differential' = 'full') => {
    try {
      await backupRecovery.createBackup(type, `Manual ${type} backup`);
  } catch (error) {
      console.error('Backup creation failed:', error);
  }
}, [backupRecovery]);

  // Handle backup restoration
  const handleRestoreBackup = useCallback(async (backupId: string) => {
    try {
      await backupRecovery.restoreBackup(backupId);
} catch (error) {
      console.error('Backup restoration failed:', error);
  }
}, [backupRecovery]);

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
            Instances: {autoScaling.currentInstances} | Backups: {backupRecovery.totalBackups}
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            sx={{ mt:  2 }}
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
          System Management
        </Typography>
        <Box display="flex" gap={1}>
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
                <Avatar sx={{ bgcolor: `${getHealthColor(systemHealth)}.main`, mr:  2 }}>
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
                <Avatar sx={{ bgcolor: 'primary.main', mr:  2 }}>
                  <ScaleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{autoScaling.currentInstances}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Instances
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
                <Avatar sx={{ bgcolor: 'info.main', mr:  2 }}>
                  <BackupIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{backupRecovery.totalBackups}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Backups
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
                <Avatar sx={{ bgcolor: 'warning.main', mr:  2 }}>
                  <NotificationsIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{backupRecovery.unreadAlerts}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unread Alerts
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" icon={<MonitorIcon />} />
          <Tab label="Auto Scaling" icon={<ScaleIcon />} />
          <Tab label="Backup" icon={<BackupIcon />} />
          <Tab label="Recovery" icon={<RestoreIcon />} />
          <Tab label="Alerts" icon={<NotificationsIcon />} />
          <Tab label="Settings" icon={<SettingsIcon />} />
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
                    Auto Scaling Status
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <CpuIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="CPU Usage"
                        secondary={`${autoScaling.cpuUsage.toFixed(1)}%`}
                      />
                      <ListItemSecondaryAction>
                        <LinearProgress
                          variant="determinate"
                          value={autoScaling.cpuUsage}
                          sx={{ width: 100}}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <MemoryIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Memory Usage"
                        secondary={`${autoScaling.memoryUsage.toFixed(1)}%`}
                      />
                      <ListItemSecondaryAction>
                        <LinearProgress
                          variant="determinate"
                          value={autoScaling.memoryUsage}
                          sx={{ width: 100}}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SpeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Response Time"
                        secondary={`${autoScaling.responseTime.toFixed(0)}ms`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ScaleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Instances"
                        secondary={`${autoScaling.currentInstances} active`}
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
                    Backup Status
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <BackupIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Total Backups"
                        secondary={`${backupRecovery.totalBackups} backups`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Success Rate"
                        secondary={`${(backupRecovery.successRate * 100).toFixed(1)}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <StorageIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Total Size"
                        secondary={`${(backupRecovery.totalSize / 1024 / 1024).toFixed(1)}MB`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ScheduleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Last Backup"
                        secondary={backupRecovery.lastBackupTime ? new Date(backupRecovery.lastBackupTime).toLocaleString() : 'Never'}
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Auto Scaling Metrics</Typography>
                <Box>
                  <Button
                    variant="outlined"
                    startIcon={<PlayIcon />}
                    onClick={() => autoScaling.updateConfig({ enableAutoScaling: true })}
                    disabled={autoScaling.isScaling}
                  >
                    Enable Scaling
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PauseIcon />}
                    onClick={() => autoScaling.updateConfig({ enableAutoScaling: false })}
                    sx={{ ml:  1 }}
                  >
                    Disable Scaling
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell>Current Value</TableCell>
                      <TableCell>Target</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>CPU Usage</TableCell>
                      <TableCell>{autoScaling.cpuUsage.toFixed(1)}%</TableCell>
                      <TableCell>70%</TableCell>
                      <TableCell>
                        <Chip
                          label={autoScaling.cpuUsage > 70 ? 'High' : 'Normal'}
                          color={autoScaling.cpuUsage > 70 ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small">
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Memory Usage</TableCell>
                      <TableCell>{autoScaling.memoryUsage.toFixed(1)}%</TableCell>
                      <TableCell>80%</TableCell>
                      <TableCell>
                        <Chip
                          label={autoScaling.memoryUsage > 80 ? 'High' : 'Normal'}
                          color={autoScaling.memoryUsage > 80 ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small">
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Response Time</TableCell>
                      <TableCell>{autoScaling.responseTime.toFixed(0)}ms</TableCell>
                      <TableCell>1000ms</TableCell>
                      <TableCell>
                        <Chip
                          label={autoScaling.responseTime > 1000 ? 'Slow' : 'Fast'}
                          color={autoScaling.responseTime > 1000 ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small">
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Backup Management</Typography>
                <Box>
                  <Button variant="contained"
                    startIcon={<BackupIcon />}
                    onClick={() => handleCreateBackup('full')}
                    disabled={backupRecovery.isBackingUp}
                  >
                    Create Full Backup
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<BackupIcon />}
                    onClick={() => handleCreateBackup('incremental')}
                    disabled={backupRecovery.isBackingUp}
                    sx={{ ml:  1 }}
                  >
                    Incremental
                  </Button>
                </Box>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {backupRecovery.backups.slice(0, 10).map((backup) => (
                      <TableRow key={backup.id} hover>
                        <TableCell>{backup.metadata.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={backup.metadata.type}
                            color={backup.metadata.type === 'full' ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{(backup.metadata.size / 1024 / 1024).toFixed(1)}MB</TableCell>
                        <TableCell>{new Date(backup.metadata.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip
                            label={backup.metadata.verified ? 'Verified' : 'Unverified'}
                            color={backup.metadata.verified ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleItemClick(backup)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleRestoreBackup(backup.id)}
                            disabled={backupRecovery.isRestoring}
                          >
                            <RestoreIcon />
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

      {tabValue === 3 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Recovery Points
              </Typography>
              <List>
                {backupRecovery.recoveryPoints.slice(0, 5).map((point) => (
                  <ListItem key={point.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <RestoreIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={point.name}
                      secondary={`${new Date(point.timestamp).toLocaleString()} - ${(point.size / 1024 / 1024).toFixed(1)}MB`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={point.status}
                        color={point.status === 'available' ? 'success' : 'warning'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      )}

      {tabValue === 4 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                System Alerts
              </Typography>
              <List>
                {backupRecovery.alerts.slice(0, 10).map((alert) => (
                  <ListItem key={alert.id}>
                    <ListItemIcon>
                      {alert.type === 'error' ? <ErrorIcon /> :
                       alert.type === 'warning' ? <WarningIcon /> :
                       alert.type === 'success' ? <CheckCircleIcon /> : <InfoIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={alert.message}
                      secondary={new Date(alert.timestamp).toLocaleString()}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={alert.severity}
                        color={alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'default'}
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      )}

      {tabValue === 5 && (
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
                      { value: 50, label: '0.5s',},
                      { value: 100, label: '1s',},
                      { value: 200, label: '2s',},
                      { value: 500, label: '5s',}
                    ]}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Details</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px'}}>
                {JSON.stringify(selectedItem, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

SystemManagementDashboard.displayName ='SystemManagementDashboard';

export default SystemManagementDashboard;




