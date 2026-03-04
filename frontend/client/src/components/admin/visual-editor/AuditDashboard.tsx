/**
 * Audit Dashboard Component
 * Comprehensive audit logging and change tracking dashboard
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import type {
  ChipProps} from '@mui/material';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
  Avatar,
  ListItemAvatar,
  ListItemSecondaryAction
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  BugReport as BugReportIcon,
  Assessment as AssessmentIcon,
  GetApp as GetAppIcon,
  Clear as ClearIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Computer as ComputerIcon,
  Cloud as CloudIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useAuditLogger } from '@/hooks/useAuditLogger';
import type { AuditEvent, AuditQuery, AuditStats } from '@/utils/auditLogger';

interface AuditDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showEvents?: boolean;
  showStats?: boolean;
  showAlerts?: boolean;
  showExport?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onEventsClick?: () => void;
  onStatsClick?: () => void;
  onAlertsClick?: () => void;
  onExportClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const AuditDashboard: React.FC<AuditDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showEvents = true,
  showStats = true,
  showAlerts = true,
  showExport = true,
  variant = 'full',
  position = 'top-left',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onEventsClick,
  onStatsClick,
  onAlertsClick,
  onExportClick,
  className,
  style
}) => {
  const auditLogger = useAuditLogger({
    enableAutoLogging: true,
    logUserActions: true,
    logPerformance: true,
    logErrors: true,
    logPageViews: true,
    logClicks: true,
    logFormSubmissions: true,
    logApiCalls: true
});

  const [tabValue, setTabValue] = useState(0);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Load events and stats
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query: AuditQuery = {
        limit: 10,
        sortBy: 'timestamp',
        sortOrder: 'desc'
  };

      const eventsData = auditLogger.query(query);
      const statsData = auditLogger.getStats();

      setEvents(eventsData);
      setStats(statsData);
  } catch (error) {
      console.error('Failed to load audit data: ', error);
  } finally {
      setLoading(false);
  }
}, [auditLogger]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
}, [autoRefresh, refreshInterval, loadData]);

  // Initial load
  useEffect(() => {
    loadData();
}, [loadData]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = !searchQuery || 
        event.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.details?.message?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
      const matchesSeverity = filterSeverity === 'all' || event.severity === filterSeverity;
      const matchesAction = filterAction === 'all' || event.action === filterAction;

      return matchesSearch && matchesCategory && matchesSeverity && matchesAction;
  });
}, [events, searchQuery, filterCategory, filterSeverity, filterAction]);

  // Get severity color
  const getSeverityColor = (severity: string): ChipProps['color'] => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
}
};

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'user': return <PersonIcon />;
      case 'system': return <ComputerIcon />;
      case 'security': return <SecurityIcon />;
      case 'performance': return <SpeedIcon />;
      case 'error': return <ErrorIcon />;
      default: return <InfoIcon />;
}
};

  // Handle event click
  const handleEventClick = useCallback((event: AuditEvent) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
}, []);

  // Confirm clear dialog state
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Handle export
  const handleExport = useCallback((format: 'json' | 'csv' | 'xml') => {
    const data = auditLogger.export(format);
    const blob = new Blob([data], { type: 'text/plain',});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log.${format}`;
    a.click();
    URL.revokeObjectURL(url);
}, [auditLogger]);

  // Handle clear
  const handleClear = useCallback(() => {
    setConfirmClearOpen(true);
  }, []);

  const executeClear = useCallback(() => {
    auditLogger.clear();
    loadData();
    setConfirmClearOpen(false);
  }, [auditLogger, loadData]);

  if (variant === 'minimal') {
    return (
      <Card className={className} style={style} sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>Audit Logs</Typography>
            <Badge badgeContent={events.length} color="primary">
              <TimelineIcon />
            </Badge>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {stats?.totalEvents || 0} total events
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
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
        <Typography variant="h5" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
          Audit Dashboard
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton onClick={() => handleExport('json')}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear">
            <IconButton onClick={handleClear} color="error">
              <ClearIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats Cards */}
      {showStats && stats && (
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs:  12, sm:  6, md:  3 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main', mr:  2 }}>
                    <TimelineIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>{stats.totalEvents}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Events
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs:  12, sm:  6, md:  3 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'error.main', mr:  2 }}>
                    <ErrorIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
                      {(stats.errorRate * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Error Rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs:  12, sm:  6, md:  3 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'warning.main', mr:  2 }}>
                    <SpeedIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
                      {stats.averageResponseTime.toFixed(0)}ms
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Response Time
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs:  12, sm:  6, md:  3 }}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Box display="flex" alignItems="center">
                  <Avatar sx={{ bgcolor: 'info.main', mr:  2 }}>
                    <StorageIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ ...{}, color: theming.colors.primary }}>
                      {(stats.memoryUsage * 100).toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Memory Usage
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Events" icon={<TimelineIcon />} />
          <Tab label="Statistics" icon={<AssessmentIcon />} />
          <Tab label="Alerts" icon={<WarningIcon />} />
          <Tab label="Settings" icon={<SettingsIcon />} />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box>
          {/* Search and Filters */}
          <Box display="flex" gap={2} mb={2} alignItems="center">
            <TextField
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon />
          }}
              sx={{ flex:  1 }}
            />
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
          </Box>

          {/* Filters */}
          {showFilters && (
            <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Grid container spacing={2}>
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                      >
                        <MenuItem value="all">All Categories</MenuItem>
                        <MenuItem value="user">User</MenuItem>
                        <MenuItem value="system">System</MenuItem>
                        <MenuItem value="security">Security</MenuItem>
                        <MenuItem value="performance">Performance</MenuItem>
                        <MenuItem value="error">Error</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <FormControl fullWidth>
                      <InputLabel>Severity</InputLabel>
                      <Select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value)}
                      >
                        <MenuItem value="all">All Severities</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="low">Low</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs:  12, sm:  4 }}>
                    <FormControl fullWidth>
                      <InputLabel>Action</InputLabel>
                      <Select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                      >
                        <MenuItem value="all">All Actions</MenuItem>
                        {Array.from(new Set(events.map(e => e.action))).map(action => (
                          <MenuItem key={action} value={action}>{action}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Events Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <LinearProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">
                        No events found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id} hover>
                      <TableCell>
                        {new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{event.action}</TableCell>
                      <TableCell>{event.resource}</TableCell>
                      <TableCell>
                        <Chip
                          label={event.severity}
                          color={getSeverityColor(event.severity) as 'error' | 'warning' | 'success' | 'default' | 'info'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getCategoryIcon(event.category)}
                          {event.category}
                        </Box>
                      </TableCell>
                      <TableCell>{event.userId}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEventClick(event)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tabValue === 1 && stats && (
        <Box>
          <Grid container spacing={2}>
            <Grid size={{ xs:  12, md:  6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                    Events by Category
                  </Typography>
                  <List>
                    {Object.entries(stats.eventsByCategory).map(([category, count]) => (
                      <ListItem key={category}>
                        <ListItemIcon>
                          {getCategoryIcon(category)}
                        </ListItemIcon>
                        <ListItemText primary={category} secondary={String(count)} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs:  12, md:  6 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                    Events by Severity
                  </Typography>
                  <List>
                    {Object.entries(stats.eventsBySeverity).map(([severity, count]) => (
                      <ListItem key={severity}>
                        <ListItemIcon>
                          <Chip
                            label={severity}
                            color={getSeverityColor(severity) as 'error' | 'warning' | 'success' | 'default' | 'info'}
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText primary={severity} secondary={String(count)} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {tabValue === 2 && (
        <Box>
          <Alert severity="info">
            Alert system is not yet implemented. This will show real-time alerts and notifications.
          </Alert>
        </Box>
      )}

      {tabValue === 3 && (
        <Box>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ ...{}, color: theming.colors.primary }}>
                Audit Settings
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                }
                  label="Auto Refresh"
                />
                <TextField
                  label="Refresh Interval (ms)"
                  type="number"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  disabled={!autoRefresh}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Event Details Dialog */}
      <Dialog
        open={eventDetailsOpen}
        onClose={() => setEventDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Event Details</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Box>
              <Grid container spacing={2}>
                <Grid size={{ xs:  12, sm:  6 }}>
                  <Typography variant="subtitle2">ID</Typography>
                  <Typography variant="body2">{selectedEvent.id}</Typography>
                </Grid>
                <Grid size={{ xs:  12, sm:  6 }}>
                  <Typography variant="subtitle2">Timestamp</Typography>
                  <Typography variant="body2">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid size={{ xs:  12, sm:  6 }}>
                  <Typography variant="subtitle2">Action</Typography>
                  <Typography variant="body2">{selectedEvent.action}</Typography>
                </Grid>
                <Grid size={{ xs:  12, sm:  6 }}>
                  <Typography variant="subtitle2">Resource</Typography>
                  <Typography variant="body2">{selectedEvent.resource}</Typography>
                </Grid>
                <Grid size={{ xs:  12, sm:  6 }}>
                  <Typography variant="subtitle2">Severity</Typography>
                  <Chip
                    label={selectedEvent.severity}
                    color={getSeverityColor(selectedEvent.severity) as 'error' | 'warning' | 'success' | 'default' | 'info'}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs:  12, sm:  6 }}>
                  <Typography variant="subtitle2">Category</Typography>
                  <Typography variant="body2">{selectedEvent.category}</Typography>
                </Grid>
                <Grid size={12}>
                  <Typography variant="subtitle2">Details</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', ...theming.getThemedCardSx() }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedEvent.details, null, 2)}
                    </pre>
                  </Paper>
                </Grid>
                <Grid size={12}>
                  <Typography variant="subtitle2">Tags</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {selectedEvent.tags.map((tag: string, index: number) => (
                      <Chip key={index} label={tag} size="small" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Clear Audit Logs Dialog */}
      <Dialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
      >
        <DialogTitle>Clear Audit Logs</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to clear all audit logs? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClearOpen(false)}>Cancel</Button>
          <Button onClick={executeClear} color="error" variant="contained">
            Clear All Logs
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

AuditDashboard.displayName ='AuditDashboard';

export default AuditDashboard;
