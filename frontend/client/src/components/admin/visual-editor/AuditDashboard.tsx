import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Switch,
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
  type ChipProps,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Assessment,
  AutoMode,
  BugReport,
  Clear,
  Download,
  ErrorOutline,
  ExpandMore,
  FilterList,
  History,
  InfoOutlined,
  MonitorHeart,
  Refresh,
  Search,
  Security,
  Settings,
  Speed,
  Timeline,
  WarningAmber,
} from '@mui/icons-material';
import { useAuditLogger } from '../../../hooks/useAuditLogger';
import type { AuditEvent, AuditQuery, AuditStats } from '../../../utils/auditLogger';
import { useTheming } from '../../../utils/theming-helper';
import { useVisualEditor } from './VisualEditorContext';

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
  position?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center';
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

interface AuditAlert {
  id: string;
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

type AuditTab = 'events' | 'stats' | 'alerts' | 'monitoring' | 'management' | 'settings';
type ExportFormat = 'json' | 'csv' | 'xml';

const refreshIntervalOptions = [5000, 10000, 30000, 60000];
const queryLimitOptions = [10, 25, 50, 100];
const exportFormatOptions: ExportFormat[] = ['json', 'csv', 'xml'];

const positionStyles = (
  position: NonNullable<AuditDashboardProps['position']>,
): React.CSSProperties => {
  const base: React.CSSProperties = { position: 'fixed', zIndex: 1000 };

  switch (position) {
    case 'top-left':
      return { ...base, top: 16, left: 16 };
    case 'top-right':
      return { ...base, top: 16, right: 16 };
    case 'bottom-left':
      return { ...base, bottom: 16, left: 16 };
    case 'bottom-right':
      return { ...base, bottom: 16, right: 16 };
    case 'top-center':
      return { ...base, top: 16, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-center':
      return { ...base, bottom: 16, left: '50%', transform: 'translateX(-50%)' };
    default:
      return { ...base, top: 16, right: 16 };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAuditEvent = (value: unknown): value is AuditEvent => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.timestamp === 'number' &&
    typeof value.action === 'string' &&
    typeof value.resource === 'string' &&
    typeof value.resourceId === 'string' &&
    typeof value.category === 'string' &&
    typeof value.severity === 'string' &&
    Array.isArray(value.tags) &&
    isRecord(value.details)
  );
};

const isAuditAlert = (value: unknown): value is AuditAlert => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.timestamp === 'number' &&
    typeof value.type === 'string' &&
    typeof value.severity === 'string' &&
    isRecord(value.data)
  );
};

const saveAuditExport = (content: string, format: ExportFormat) => {
  const blob = new Blob([content], {
    type: format === 'json' ? 'application/json' : 'text/plain',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `audit-log-${Date.now()}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const getSeverityColor = (
  severity: AuditEvent['severity'] | AuditAlert['severity'],
): ChipProps['color'] => {
  switch (severity) {
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

const getCategoryIcon = (category: AuditEvent['category']) => {
  switch (category) {
    case 'security':
      return <Security fontSize="small" />;
    case 'performance':
      return <Speed fontSize="small" />;
    case 'error':
      return <ErrorOutline fontSize="small" />;
    case 'system':
      return <Assessment fontSize="small" />;
    case 'user':
    default:
      return <Timeline fontSize="small" />;
  }
};

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const AuditDashboard: React.FC<AuditDashboardProps> = memo(
  ({
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
    style,
  }) => {
    const theming = useTheming('prototype_tester');
    const { state: editorState, addToast } = useVisualEditor();
    const currentProject = editorState.currentProject;

    const {
      log,
      logUserAction,
      logError,
      logPerformance,
      logPageView,
      logClick,
      logFormSubmission,
      logApiCall,
      query: queryAudit,
      getStats,
      export: exportAudit,
      clear: clearAudit,
    } = useAuditLogger({
      enableAutoLogging: true,
      logUserActions: true,
      logPerformance: true,
      logErrors: true,
      logPageViews: true,
      logClicks: true,
      logFormSubmissions: true,
      logApiCalls: true,
    });

    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [stats, setStats] = useState<AuditStats | null>(null);
    const [alerts, setAlerts] = useState<AuditAlert[]>([]);
    const [selectedTab, setSelectedTab] = useState<AuditTab>('events');
    const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
    const [showEventDialog, setShowEventDialog] = useState(false);
    const [showCompactDialog, setShowCompactDialog] = useState(false);
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterSeverity, setFilterSeverity] = useState('all');
    const [filterAction, setFilterAction] = useState('all');
    const [filtersExpanded, setFiltersExpanded] = useState(showDetails);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(10000);
    const [queryLimit, setQueryLimit] = useState(25);
    const [realtimeAlerts, setRealtimeAlerts] = useState(true);
    const [exportFormat, setExportFormat] = useState<ExportFormat>('json');

    const availableTabs = useMemo(() => {
      const tabs: Array<{
        value: AuditTab;
        label: string;
        onOpen?: () => void;
      }> = [];

      if (showEvents) {
        tabs.push({ value: 'events', label: 'Events', onOpen: onEventsClick });
      }
      if (showStats) {
        tabs.push({ value: 'stats', label: 'Statistics', onOpen: onStatsClick });
      }
      if (showAlerts) {
        tabs.push({ value: 'alerts', label: 'Alerts', onOpen: onAlertsClick });
      }
      if (showMonitoring) {
        tabs.push({ value: 'monitoring', label: 'Monitoring', onOpen: onMonitoringClick });
      }
      if (showManagement) {
        tabs.push({ value: 'management', label: 'Management', onOpen: onManagementClick });
      }
      if (showSettings) {
        tabs.push({ value: 'settings', label: 'Settings', onOpen: onSettingsClick });
      }

      return tabs;
    }, [
      onAlertsClick,
      onEventsClick,
      onManagementClick,
      onMonitoringClick,
      onSettingsClick,
      onStatsClick,
      showAlerts,
      showEvents,
      showManagement,
      showMonitoring,
      showSettings,
      showStats,
    ]);

    const loadData = useCallback(() => {
      setLoading(true);

      try {
        const query: AuditQuery = {
          limit: queryLimit,
          sortBy: 'timestamp',
          sortOrder: 'desc',
        };

        setEvents(queryAudit(query));
        setStats(getStats());
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load audit data';
        addToast({
          message,
          type: 'error',
        });
      } finally {
        setLoading(false);
      }
    }, [addToast, getStats, queryAudit, queryLimit]);

    useEffect(() => {
      if (availableTabs.length === 0) {
        return;
      }

      const tabExists = availableTabs.some((tab) => tab.value === selectedTab);
      if (!tabExists) {
        setSelectedTab(availableTabs[0].value);
      }
    }, [availableTabs, selectedTab]);

    useEffect(() => {
      loadData();
    }, [loadData]);

    useEffect(() => {
      logPageView('/visual-editor/audit-dashboard', {
        projectId: currentProject?.id,
        projectName: currentProject?.name,
      });
    }, [currentProject?.id, currentProject?.name, logPageView]);

    useEffect(() => {
      if (!autoRefresh || typeof window === 'undefined') {
        return undefined;
      }

      const intervalId = window.setInterval(() => {
        loadData();
      }, refreshInterval);

      return () => window.clearInterval(intervalId);
    }, [autoRefresh, loadData, refreshInterval]);

    useEffect(() => {
      if (!realtimeAlerts || typeof window === 'undefined') {
        return undefined;
      }

      const handleAuditEvent = (event: Event) => {
        if (!(event instanceof CustomEvent) || !isAuditEvent(event.detail)) {
          return;
        }

        setEvents((previous) => {
          const nextEvents = [
            event.detail,
            ...previous.filter((item) => item.id !== event.detail.id),
          ];

          return nextEvents.slice(0, queryLimit);
        });
        setStats(getStats());
      };

      const handleAuditAlert = (event: Event) => {
        if (!(event instanceof CustomEvent) || !isAuditAlert(event.detail)) {
          return;
        }

        setAlerts((previous) => {
          const nextAlerts = [
            event.detail,
            ...previous.filter((item) => item.id !== event.detail.id),
          ];

          return nextAlerts.slice(0, queryLimit);
        });
      };

      window.addEventListener('audit-event', handleAuditEvent);
      window.addEventListener('audit-alert', handleAuditAlert);

      return () => {
        window.removeEventListener('audit-event', handleAuditEvent);
        window.removeEventListener('audit-alert', handleAuditAlert);
      };
    }, [getStats, queryLimit, realtimeAlerts]);

    const categoryOptions = useMemo(
      () => ['all', ...new Set(events.map((event) => event.category))],
      [events],
    );

    const severityOptions = useMemo(
      () => ['all', ...new Set(events.map((event) => event.severity))],
      [events],
    );

    const actionOptions = useMemo(
      () => ['all', ...new Set(events.map((event) => event.action))],
      [events],
    );

    const filteredEvents = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();

      return events.filter((event) => {
        const detailText = JSON.stringify(event.details).toLowerCase();
        const matchesSearch =
          !query ||
          event.action.toLowerCase().includes(query) ||
          event.resource.toLowerCase().includes(query) ||
          event.resourceId.toLowerCase().includes(query) ||
          detailText.includes(query) ||
          event.userId.toLowerCase().includes(query);

        const matchesCategory =
          filterCategory === 'all' || event.category === filterCategory;
        const matchesSeverity =
          filterSeverity === 'all' || event.severity === filterSeverity;
        const matchesAction = filterAction === 'all' || event.action === filterAction;

        return matchesSearch && matchesCategory && matchesSeverity && matchesAction;
      });
    }, [events, filterAction, filterCategory, filterSeverity, searchQuery]);

    const topActions = useMemo(() => {
      if (!stats) {
        return [];
      }

      return Object.entries(stats.eventsByAction)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5);
    }, [stats]);

    const monitoringCards = useMemo(
      () => [
        {
          label: 'Error Rate',
          value: stats ? formatPercent(stats.errorRate) : '0.0%',
          helper: 'Across all tracked audit events',
          color: stats && stats.errorRate > 0.05 ? 'error' : 'success',
          icon: <BugReport color={stats && stats.errorRate > 0.05 ? 'error' : 'success'} />,
        },
        {
          label: 'Average Response',
          value: stats ? `${stats.averageResponseTime.toFixed(0)}ms` : '0ms',
          helper: 'Performance entries with response time',
          color: stats && stats.averageResponseTime > 1000 ? 'warning' : 'success',
          icon: <Speed color={stats && stats.averageResponseTime > 1000 ? 'warning' : 'success'} />,
        },
        {
          label: 'Memory Usage',
          value: stats ? formatPercent(stats.memoryUsage) : '0.0%',
          helper: `Editor memory ${editorState.performanceMetrics.memoryUsage.toFixed(1)}%`,
          color: stats && stats.memoryUsage > 0.8 ? 'warning' : 'success',
          icon: <MonitorHeart color={stats && stats.memoryUsage > 0.8 ? 'warning' : 'success'} />,
        },
        {
          label: 'Realtime Alerts',
          value: realtimeAlerts ? 'Enabled' : 'Paused',
          helper: autoRefresh
            ? `Auto-refresh every ${refreshInterval / 1000}s`
            : 'Manual refresh mode',
          color: realtimeAlerts ? 'primary' : 'default',
          icon: <AutoMode color={realtimeAlerts ? 'primary' : 'disabled'} />,
        },
      ],
      [
        autoRefresh,
        editorState.performanceMetrics.memoryUsage,
        realtimeAlerts,
        refreshInterval,
        stats,
      ],
    );

    const openEventDetails = useCallback((event: AuditEvent) => {
      setSelectedEvent(event);
      setShowEventDialog(true);
    }, []);

    const activateTab = useCallback(
      (nextTab: AuditTab) => {
        const tabConfig = availableTabs.find((tab) => tab.value === nextTab);
        if (!tabConfig) {
          return;
        }

        setSelectedTab(nextTab);
        tabConfig.onOpen?.();
        logUserAction('audit_tab_changed', nextTab, {
          projectId: currentProject?.id,
          projectName: currentProject?.name,
        });
      },
      [availableTabs, currentProject?.id, currentProject?.name, logUserAction],
    );

    const handleTabChange = (_event: React.SyntheticEvent, value: string) => {
      const nextTab = availableTabs.find((tab) => tab.value === value)?.value;
      if (!nextTab) {
        return;
      }

      activateTab(nextTab);
    };

    const runAuditAction = useCallback(
      (label: string, action: () => void) => {
        action();
        loadData();
        addToast({
          message: `${label} recorded in audit log`,
          type: 'success',
        });
      },
      [addToast, loadData],
    );

    const managementActions = useMemo(
      () => [
        {
          label: 'User Action',
          handler: () =>
            runAuditAction('User action', () =>
              logUserAction('audit_management_triggered', 'audit-dashboard', {
                projectId: currentProject?.id,
                visibleEvents: filteredEvents.length,
              }),
            ),
        },
        {
          label: 'Page View',
          handler: () =>
            runAuditAction('Page view', () =>
              logPageView('/visual-editor/audit-dashboard/manual', {
                projectId: currentProject?.id,
              }),
            ),
        },
        {
          label: 'Click Event',
          handler: () =>
            runAuditAction('Click event', () =>
              logClick('audit-dashboard-action-button', {
                source: 'management-lab',
              }),
            ),
        },
        {
          label: 'Form Submission',
          handler: () =>
            runAuditAction('Form submission', () =>
              logFormSubmission('audit-dashboard-settings', true, {
                changedSettings: {
                  autoRefresh,
                  refreshInterval,
                  queryLimit,
                },
              }),
            ),
        },
        {
          label: 'API Call',
          handler: () =>
            runAuditAction('API call', () =>
              logApiCall(
                '/api/visual-editor/audit-preview',
                'GET',
                true,
                Math.max(120, Math.round(editorState.performanceMetrics.renderTime)),
                {
                  projectId: currentProject?.id,
                },
              ),
            ),
        },
        {
          label: 'Performance Sample',
          handler: () =>
            runAuditAction('Performance sample', () =>
              logPerformance('audit_dashboard_render', editorState.performanceMetrics.renderTime, {
                fps: editorState.performanceMetrics.fps,
                memoryUsage: editorState.performanceMetrics.memoryUsage,
              }),
            ),
        },
        {
          label: 'Error Sample',
          handler: () =>
            runAuditAction('Error sample', () =>
              logError(new Error('Manual audit dashboard verification error'), {
                source: 'management-lab',
              }),
            ),
        },
        {
          label: 'System Snapshot',
          handler: () =>
            runAuditAction('System snapshot', () =>
              log({
                action: 'audit_dashboard_snapshot',
                resource: 'project',
                resourceId: currentProject?.id ?? 'no-project',
                details: {
                  projectName: currentProject?.name ?? 'No project',
                  elements: editorState.elements.length,
                  zoom: editorState.zoom,
                  gridVisible: editorState.gridVisible,
                },
                severity: 'low',
                category: 'system',
                tags: ['audit', 'snapshot', 'visual-editor'],
              }),
            ),
        },
      ],
      [
        autoRefresh,
        currentProject?.id,
        currentProject?.name,
        editorState.elements.length,
        editorState.gridVisible,
        editorState.performanceMetrics.fps,
        editorState.performanceMetrics.memoryUsage,
        editorState.performanceMetrics.renderTime,
        editorState.zoom,
        filteredEvents.length,
        log,
        logApiCall,
        logClick,
        logError,
        logFormSubmission,
        logPageView,
        logPerformance,
        logUserAction,
        queryLimit,
        refreshInterval,
        runAuditAction,
      ],
    );

    const handleRefresh = useCallback(() => {
      loadData();
      addToast({
        message: 'Audit dashboard refreshed',
        type: 'info',
      });
    }, [addToast, loadData]);

    const handleExport = useCallback(() => {
      const payload = exportAudit(exportFormat);
      saveAuditExport(payload, exportFormat);
      onExportClick?.();
      addToast({
        message: `Audit log exported as ${exportFormat.toUpperCase()}`,
        type: 'success',
      });
    }, [addToast, exportAudit, exportFormat, onExportClick]);

    const handleClear = useCallback(() => {
      clearAudit();
      setAlerts([]);
      setEvents([]);
      setStats(getStats());
      setShowClearDialog(false);
      addToast({
        message: 'Audit log cleared',
        type: 'warning',
      });
    }, [addToast, clearAudit, getStats]);

    const renderSummaryCards = showDetails && stats && (
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2">Tracked Events</Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {stats.totalEvents}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentProject?.name ?? 'No active project'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2">Visible Events</Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {filteredEvents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                After active filters
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2">Realtime Alerts</Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {alerts.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active in this session
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2">Audit Health</Typography>
              <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                {stats.errorRate > 0.05 ? 'Watch' : 'Stable'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Error rate {formatPercent(stats.errorRate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );

    const tabPanels: Record<AuditTab, React.ReactNode> = {
      events: (
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Audit Events
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button startIcon={<FilterList />} onClick={() => setFiltersExpanded((value) => !value)}>
                Filters
              </Button>
              <Button startIcon={<Refresh />} onClick={handleRefresh}>
                Refresh
              </Button>
            </Box>
          </Box>

          {filtersExpanded && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Search events"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel id="audit-category-label">Category</InputLabel>
                  <Select
                    labelId="audit-category-label"
                    label="Category"
                    value={filterCategory}
                    onChange={(event) => setFilterCategory(event.target.value)}
                  >
                    {categoryOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option === 'all' ? 'All categories' : option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 2.5 }}>
                <FormControl fullWidth>
                  <InputLabel id="audit-severity-label">Severity</InputLabel>
                  <Select
                    labelId="audit-severity-label"
                    label="Severity"
                    value={filterSeverity}
                    onChange={(event) => setFilterSeverity(event.target.value)}
                  >
                    {severityOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option === 'all' ? 'All severities' : option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 2.5 }}>
                <FormControl fullWidth>
                  <InputLabel id="audit-action-label">Action</InputLabel>
                  <Select
                    labelId="audit-action-label"
                    label="Action"
                    value={filterAction}
                    onChange={(event) => setFilterAction(event.target.value)}
                  >
                    {actionOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option === 'all' ? 'All actions' : option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell align="right">Inspect</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No audit events match the current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id} hover onClick={() => openEventDetails(event)} sx={{ cursor: 'pointer' }}>
                      <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{event.action}</TableCell>
                      <TableCell>
                        {event.resource}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {event.resourceId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getCategoryIcon(event.category)}
                          label={event.category}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.severity}
                          size="small"
                          color={getSeverityColor(event.severity)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Open event details">
                          <IconButton size="small" onClick={() => openEventDetails(event)}>
                            <InfoOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ),
      stats: (
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Audit Statistics
          </Typography>
          {stats ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1">By Category</Typography>
                    <Box mt={1.5} display="flex" flexDirection="column" gap={1}>
                      {Object.entries(stats.eventsByCategory).map(([category, count]) => (
                        <Box key={category}>
                          <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="body2">{category}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {count}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={stats.totalEvents === 0 ? 0 : (count / stats.totalEvents) * 100}
                          />
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1">By Severity</Typography>
                    <Box mt={1.5} display="flex" flexDirection="column" gap={1}>
                      {Object.entries(stats.eventsBySeverity).map(([severity, count]) => (
                        <Box key={severity} display="flex" justifyContent="space-between" alignItems="center">
                          <Chip
                            label={severity}
                            size="small"
                            color={getSeverityColor(severity as AuditEvent['severity'])}
                          />
                          <Typography variant="body2">{count}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1">Top Actions</Typography>
                    <Box mt={1.5} display="flex" flexDirection="column" gap={1}>
                      {topActions.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No actions recorded yet.
                        </Typography>
                      ) : (
                        topActions.map(([action, count]) => (
                          <Box key={action} display="flex" justifyContent="space-between">
                            <Typography variant="body2">{action}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {count}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">Statistics will appear after audit data loads.</Alert>
          )}
        </Box>
      ),
      alerts: (
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Audit Alerts
            </Typography>
            <Chip
              icon={<WarningAmber fontSize="small" />}
              label={`${alerts.length} active alerts`}
              color={alerts.length > 0 ? 'warning' : 'default'}
            />
          </Box>

          {alerts.length === 0 ? (
            <Alert severity="info">
              No realtime alerts captured in this browser session yet.
            </Alert>
          ) : (
            alerts.map((alertItem) => (
              <Accordion key={alertItem.id} defaultExpanded={alertItem.severity === 'critical'}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        size="small"
                        label={alertItem.severity}
                        color={getSeverityColor(alertItem.severity)}
                      />
                      <Typography variant="subtitle2">{alertItem.type}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(alertItem.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                    {JSON.stringify(alertItem.data, null, 2)}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      ),
      monitoring: (
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Monitoring
          </Typography>
          <Grid container spacing={2}>
            {monitoringCards.map((card) => (
              <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                      {card.icon}
                      <Typography variant="subtitle2">{card.label}</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.helper}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ),
      management: (
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Management Lab
            </Typography>
            <Box display="flex" gap={1}>
              {showExport && (
                <Button startIcon={<Download />} variant="outlined" onClick={handleExport}>
                  Export
                </Button>
              )}
              <Button startIcon={<Clear />} color="error" variant="outlined" onClick={() => setShowClearDialog(true)}>
                Clear Log
              </Button>
            </Box>
          </Box>
          <Grid container spacing={1.5}>
            {managementActions.map((action) => (
              <Grid key={action.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Button fullWidth variant="outlined" onClick={action.handler}>
                  {action.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      ),
      settings: (
        <Box display="flex" flexDirection="column" gap={2}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Audit Dashboard Settings
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(event) => setAutoRefresh(event.target.checked)}
                  />
                }
                label="Enable auto refresh"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={realtimeAlerts}
                    onChange={(event) => setRealtimeAlerts(event.target.checked)}
                  />
                }
                label="Enable realtime alerts"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="audit-refresh-label">Refresh Interval</InputLabel>
                <Select
                  labelId="audit-refresh-label"
                  label="Refresh Interval"
                  value={String(refreshInterval)}
                  onChange={(event) => {
                    const nextInterval = refreshIntervalOptions.find(
                      (option) => String(option) === event.target.value,
                    );
                    if (nextInterval) {
                      setRefreshInterval(nextInterval);
                    }
                  }}
                >
                  {refreshIntervalOptions.map((option) => (
                    <MenuItem key={option} value={String(option)}>
                      {option / 1000}s
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="audit-limit-label">Query Limit</InputLabel>
                <Select
                  labelId="audit-limit-label"
                  label="Query Limit"
                  value={String(queryLimit)}
                  onChange={(event) => {
                    const nextLimit = queryLimitOptions.find(
                      (option) => String(option) === event.target.value,
                    );
                    if (nextLimit) {
                      setQueryLimit(nextLimit);
                    }
                  }}
                >
                  {queryLimitOptions.map((option) => (
                    <MenuItem key={option} value={String(option)}>
                      {option} events
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="audit-export-label">Export Format</InputLabel>
                <Select
                  labelId="audit-export-label"
                  label="Export Format"
                  value={exportFormat}
                  onChange={(event) => {
                    const nextFormat = exportFormatOptions.find(
                      (option) => option === event.target.value,
                    );
                    if (nextFormat) {
                      setExportFormat(nextFormat);
                    }
                  }}
                >
                  {exportFormatOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Alert severity="info">
            These controls affect dashboard behaviour immediately. The audit logger itself continues
            recording events using the existing hook and utility pipeline.
          </Alert>
        </Box>
      ),
    };

    const dashboardContent = (
      <Box display="flex" flexDirection="column" gap={3}>
        {loading && <LinearProgress />}
        {renderSummaryCards}

        <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2 }}
          >
            {availableTabs.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                icon={
                  tab.value === 'events' ? (
                    <History fontSize="small" />
                  ) : tab.value === 'stats' ? (
                    <Assessment fontSize="small" />
                  ) : tab.value === 'alerts' ? (
                    <Badge badgeContent={alerts.length} color="error">
                      <WarningAmber fontSize="small" />
                    </Badge>
                  ) : tab.value === 'monitoring' ? (
                    <MonitorHeart fontSize="small" />
                  ) : tab.value === 'management' ? (
                    <Security fontSize="small" />
                  ) : (
                    <Settings fontSize="small" />
                  )
                }
                iconPosition="start"
              />
            ))}
          </Tabs>

          {tabPanels[selectedTab]}
        </Paper>
      </Box>
    );

    const compactSummary = (
      <Paper sx={{ ...theming.getThemedCardSx(), p: 1.5, minWidth: 260 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: theming.colors.primary }}>
              Audit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stats?.totalEvents ?? 0} events • {alerts.length} alerts
            </Typography>
          </Box>
          <Box display="flex" gap={0.5}>
            <IconButton size="small" onClick={() => setShowCompactDialog(true)}>
              <History fontSize="small" />
            </IconButton>
            {showSettings && (
              <IconButton
                size="small"
                onClick={() => {
                  activateTab('settings');
                  setShowCompactDialog(true);
                }}
              >
                <Settings fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </Paper>
    );

    return (
      <>
        <Box
          className={className}
          style={{
            ...(variant === 'full' ? {} : positionStyles(position)),
            ...style,
          }}
        >
          {variant === 'minimal' ? (
            <Tooltip title="Open audit dashboard">
              <Chip
                icon={<History fontSize="small" />}
                label={`${stats?.totalEvents ?? 0} audit events`}
                color={alerts.length > 0 ? 'warning' : 'default'}
                onClick={() => setShowCompactDialog(true)}
                sx={{ cursor: 'pointer' }}
              />
            </Tooltip>
          ) : variant === 'detailed' ? (
            compactSummary
          ) : (
            <Paper sx={{ ...theming.getThemedCardSx(), p: 2.5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
                <Box>
                  <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                    Audit Dashboard
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Track events, alerts, monitoring, and operational audit health for the Visual CMS.
                  </Typography>
                </Box>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button startIcon={<Refresh />} variant="outlined" onClick={handleRefresh}>
                    Refresh
                  </Button>
                  {showExport && (
                    <Button startIcon={<Download />} variant="outlined" onClick={handleExport}>
                      Export
                    </Button>
                  )}
                  {showSettings && (
                    <Button
                      startIcon={<Settings />}
                      variant="contained"
                      onClick={() => activateTab('settings')}
                      sx={theming.getThemedButtonSx()}
                    >
                      Settings
                    </Button>
                  )}
                </Box>
              </Box>

              <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
                <Chip
                  icon={<History fontSize="small" />}
                  label={`${stats?.totalEvents ?? 0} total events`}
                  color="primary"
                />
                <Chip
                  icon={<WarningAmber fontSize="small" />}
                  label={`${alerts.length} active alerts`}
                  color={alerts.length > 0 ? 'warning' : 'default'}
                />
                <Chip
                  icon={<AutoMode fontSize="small" />}
                  label={autoRefresh ? `auto refresh ${refreshInterval / 1000}s` : 'manual refresh'}
                  variant="outlined"
                />
                <Chip
                  icon={<Speed fontSize="small" />}
                  label={`${editorState.performanceMetrics.renderTime.toFixed(0)}ms render`}
                  variant="outlined"
                />
              </Box>

              {dashboardContent}
            </Paper>
          )}
        </Box>

        {variant !== 'full' && (
          <Dialog
            open={showCompactDialog}
            onClose={() => setShowCompactDialog(false)}
            maxWidth="xl"
            fullWidth
          >
            <DialogTitle>
              <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Audit Dashboard
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Project: {currentProject?.name ?? 'No active project'} • {editorState.elements.length} elements
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button startIcon={<Refresh />} onClick={handleRefresh}>
                    Refresh
                  </Button>
                  {showExport && (
                    <Button startIcon={<Download />} onClick={handleExport}>
                      Export
                    </Button>
                  )}
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>{dashboardContent}</DialogContent>
            <DialogActions>
              <Button onClick={() => setShowCompactDialog(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        )}

        <Dialog
          open={showEventDialog}
          onClose={() => setShowEventDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Audit Event Details</DialogTitle>
          <DialogContent>
            {selectedEvent && (
              <Box display="flex" flexDirection="column" gap={2}>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    icon={getCategoryIcon(selectedEvent.category)}
                    label={selectedEvent.category}
                    variant="outlined"
                  />
                  <Chip
                    label={selectedEvent.severity}
                    color={getSeverityColor(selectedEvent.severity)}
                  />
                  <Chip label={selectedEvent.action} color="primary" />
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </Typography>

                <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
                  <Typography variant="subtitle2">Resource</Typography>
                  <Typography variant="body1">{selectedEvent.resource}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEvent.resourceId}
                  </Typography>
                </Paper>

                <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Details
                  </Typography>
                  <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </Typography>
                </Paper>

                <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Metadata
                  </Typography>
                  <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </Typography>
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowEventDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={showClearDialog}
          onClose={() => setShowClearDialog(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Clear Audit Log</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This removes the in-memory audit history currently held by the browser session.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowClearDialog(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleClear}>
              Clear
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  },
);

AuditDashboard.displayName = 'AuditDashboard';

export default AuditDashboard;
