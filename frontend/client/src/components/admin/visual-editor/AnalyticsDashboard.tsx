import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type ChipProps,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Analytics,
  BarChart,
  BugReport,
  Description,
  Download,
  FilterList,
  MouseOutlined,
  Refresh,
  Search,
  Settings,
  ShowChart,
  Sort,
  Speed,
  Sync,
  SyncProblem,
  Timeline,
  TrendingUp,
  Visibility,
} from '@mui/icons-material';
import { useAnalytics } from '../../../hooks/useAnalytics';
import type { AnalyticsConfig } from '../../../utils/analyticsManager';
import { useTheming } from '../../../utils/theming-helper';
import { useVisualEditor } from './VisualEditorContext';

interface AnalyticsDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showExport?: boolean;
  showFilters?: boolean;
  showSorting?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?:
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center';
  onSettingsClick?: () => void;
  onExportClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

type SortField = 'timestamp' | 'type' | 'category' | 'action';
type ViewMode = 'table' | 'cards';
const sortFieldOptions: SortField[] = ['timestamp', 'type', 'category', 'action'];
const sortOrderOptions = ['desc', 'asc'] as const;

const positionStyles = (
  position: NonNullable<AnalyticsDashboardProps['position']>,
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

const getConfigNumber = (
  value: number,
  fallback: number,
): number => (Number.isFinite(value) && value > 0 ? value : fallback);

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = memo(
  ({
    showDetails = true,
    showSettings = true,
    showExport = true,
    showFilters = false,
    showSorting = false,
    variant = 'full',
    position = 'top-right',
    onSettingsClick,
    onExportClick,
    className,
    style,
  }) => {
    const theming = useTheming('prototype_tester');
    const { state: editorState, addToast } = useVisualEditor();

    const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
    const [showSettingsDialog, setShowSettingsDialog] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortBy, setSortBy] = useState<SortField>('timestamp');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [filtersExpanded, setFiltersExpanded] = useState(showFilters);
    const [sortingExpanded, setSortingExpanded] = useState(showSorting);

    const currentProject = editorState.currentProject;
    const elementCount = editorState.elements.length;
    const performanceMetrics = editorState.performanceMetrics;

    const analyticsOptions = useMemo(
      () => ({
        onEventTracked: () => setPage(0),
        onSessionStarted: () => setPage(0),
        onSessionEnded: () => setPage(0),
        onEventsFlushed: () => setPage(0),
        onError: (message: string) => {
          addToast({
            message,
            type: 'error',
          });
        },
      }),
      [addToast],
    );

    const {
      trackEvent,
      trackPageView,
      trackClick,
      trackScroll,
      trackFormSubmit,
      trackCustomEvent,
      trackError,
      trackPerformance,
      flush,
      state: analyticsState,
      config,
      updateConfig,
      isTracking,
      isInitialized,
      hasError,
      error,
      currentSession,
      eventQueue,
      totalEvents,
      totalSessions,
    } = useAnalytics(analyticsOptions);

    useEffect(() => {
      trackPageView('/visual-editor/analytics-dashboard', {
        projectId: currentProject?.id,
        variant,
      });
    }, [currentProject?.id, trackPageView, variant]);

    const typeOptions = useMemo(() => {
      return ['all', ...new Set(eventQueue.map((event) => event.type))];
    }, [eventQueue]);

    const categoryOptions = useMemo(() => {
      return ['all', ...new Set(eventQueue.map((event) => event.category))];
    }, [eventQueue]);

    const filteredEvents = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();

      return eventQueue
        .filter((event) => {
          const matchesSearch =
            !query ||
            event.type.toLowerCase().includes(query) ||
            event.category.toLowerCase().includes(query) ||
            event.action.toLowerCase().includes(query) ||
            (event.page ?? '').toLowerCase().includes(query);

          const matchesType = filterType === 'all' || event.type === filterType;
          const matchesCategory =
            filterCategory === 'all' || event.category === filterCategory;

          return matchesSearch && matchesType && matchesCategory;
        })
        .sort((left, right) => {
          const orderMultiplier = sortOrder === 'desc' ? -1 : 1;

          if (sortBy === 'timestamp') {
            return (left.timestamp - right.timestamp) * orderMultiplier;
          }

          const leftValue = left[sortBy].toLowerCase();
          const rightValue = right[sortBy].toLowerCase();

          return leftValue.localeCompare(rightValue) * orderMultiplier;
        });
    }, [eventQueue, filterCategory, filterType, searchQuery, sortBy, sortOrder]);

    const pagedEvents = useMemo(
      () =>
        filteredEvents.slice(
          page * rowsPerPage,
          page * rowsPerPage + rowsPerPage,
        ),
      [filteredEvents, page, rowsPerPage],
    );

    const currentStatus = useMemo(() => {
      if (hasError) return 'error';
      if (!isInitialized) return 'initializing';
      if (isTracking) return 'tracking';
      return 'idle';
    }, [hasError, isInitialized, isTracking]);

    const statusColor = useMemo<ChipProps['color']>(() => {
      switch (currentStatus) {
        case 'error':
          return 'error';
        case 'initializing':
          return 'warning';
        case 'tracking':
          return 'success';
        default:
          return 'default';
      }
    }, [currentStatus]);

    const statusIcon = useMemo(() => {
      switch (currentStatus) {
        case 'error':
          return <SyncProblem fontSize="small" />;
        case 'tracking':
          return <Sync fontSize="small" />;
        default:
          return <Analytics fontSize="small" />;
      }
    }, [currentStatus]);

    const workspaceMetrics = useMemo(
      () => [
        {
          icon: <Visibility color="primary" />,
          label: 'Page Views',
          value: currentSession?.pageViews ?? 0,
          helper: 'Current session',
        },
        {
          icon: <MouseOutlined color="primary" />,
          label: 'Clicks',
          value: currentSession?.clicks ?? 0,
          helper: 'Current session',
        },
        {
          icon: <Description color="primary" />,
          label: 'Forms',
          value: currentSession?.forms ?? 0,
          helper: 'Current session',
        },
        {
          icon: <Speed color="primary" />,
          label: 'Render Time',
          value: `${performanceMetrics.renderTime.toFixed(0)}ms`,
          helper: 'Editor metric',
        },
        {
          icon: <BarChart color="primary" />,
          label: 'Elements',
          value: elementCount,
          helper: currentProject?.name ?? 'No project loaded',
        },
        {
          icon: <ShowChart color="primary" />,
          label: 'Memory',
          value: `${performanceMetrics.memoryUsage.toFixed(1)}%`,
          helper: `Zoom ${Math.round(editorState.zoom * 100)}%`,
        },
      ],
      [
        currentProject?.name,
        currentSession?.clicks,
        currentSession?.forms,
        currentSession?.pageViews,
        editorState.zoom,
        elementCount,
        performanceMetrics.memoryUsage,
        performanceMetrics.renderTime,
      ],
    );

    const queueSummary = useMemo(
      () => ({
        queued: eventQueue.length,
        lastFlush: analyticsState.lastFlush
          ? new Date(analyticsState.lastFlush).toLocaleTimeString()
          : 'Never',
        retryCount: analyticsState.retryCount,
      }),
      [analyticsState.lastFlush, analyticsState.retryCount, eventQueue.length],
    );

    const trackAndToast = useCallback(
      (label: string, action: () => void) => {
        action();
        addToast({
          message: `${label} tracked`,
          type: 'success',
        });
      },
      [addToast],
    );

    const quickActions = useMemo(
      () => [
        {
          label: 'Page View',
          handler: () =>
            trackAndToast('Page view', () =>
              trackPageView('/visual-editor/demo-page', {
                source: 'analytics-dashboard',
              }),
            ),
        },
        {
          label: 'Click',
          handler: () =>
            trackAndToast('Click', () =>
              trackClick('analytics-demo-button', { source: 'analytics-dashboard' }),
            ),
        },
        {
          label: 'Scroll',
          handler: () =>
            trackAndToast('Scroll', () =>
              trackScroll(75, { source: 'analytics-dashboard' }),
            ),
        },
        {
          label: 'Form Submit',
          handler: () =>
            trackAndToast('Form submission', () =>
              trackFormSubmit('analytics-settings-form', {
                source: 'analytics-dashboard',
              }),
            ),
        },
        {
          label: 'Custom Event',
          handler: () =>
            trackAndToast('Custom event', () =>
              trackCustomEvent('analytics_dashboard_ping', {
                projectId: currentProject?.id,
                elementCount,
              }),
            ),
        },
        {
          label: 'Performance',
          handler: () =>
            trackAndToast('Performance metric', () =>
              trackPerformance('editor_render', performanceMetrics.renderTime, {
                fps: performanceMetrics.fps,
              }),
            ),
        },
        {
          label: 'Workspace Pulse',
          handler: () =>
            trackAndToast('Workspace pulse', () =>
              trackEvent('workspace', 'editor', 'snapshot', {
                projectId: currentProject?.id,
                elements: elementCount,
                gridVisible: editorState.gridVisible,
              }),
            ),
        },
        {
          label: 'Error',
          handler: () =>
            trackAndToast('Error sample', () =>
              trackError(new Error('Manual analytics dashboard sample error'), {
                source: 'analytics-dashboard',
              }),
            ),
        },
      ],
      [
        currentProject?.id,
        editorState.gridVisible,
        elementCount,
        performanceMetrics.fps,
        performanceMetrics.renderTime,
        trackAndToast,
        trackClick,
        trackCustomEvent,
        trackError,
        trackEvent,
        trackFormSubmit,
        trackPageView,
        trackPerformance,
        trackScroll,
      ],
    );

    const handleAnalyticsOpen = () => {
      setShowAnalyticsDialog(true);
      trackCustomEvent('analytics_dashboard_opened', {
        variant,
        projectId: currentProject?.id,
      });
    };

    const handleSettingsOpen = () => {
      if (onSettingsClick) {
        onSettingsClick();
      }
      setShowSettingsDialog(true);
      trackClick('analytics-settings-open');
    };

    const handleExport = () => {
      trackCustomEvent('analytics_export_requested', { queued: eventQueue.length });

      if (onExportClick) {
        onExportClick();
      }

      const payload = {
        config,
        currentSession,
        eventQueue,
        totalEvents,
        totalSessions,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `analytics-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    };

    const handleFlush = async () => {
      await flush();
      addToast({
        message: 'Analytics queue flushed',
        type: 'success',
      });
    };

    const handleConfigBoolean =
      (field: keyof Pick<
        AnalyticsConfig,
        | 'enableTracking'
        | 'enableHeatmaps'
        | 'enableUserBehavior'
        | 'enablePerformance'
        | 'enableErrors'
        | 'enableClicks'
        | 'enableScrolls'
        | 'enableForms'
        | 'debug'
      >) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        updateConfig({ [field]: event.target.checked });
      };

    const handleConfigNumber =
      (field: keyof Pick<AnalyticsConfig, 'batchSize' | 'flushInterval' | 'maxRetries'>) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(event.target.value);
        updateConfig({
          [field]: getConfigNumber(
            nextValue,
            field === 'batchSize'
              ? config.batchSize
              : field === 'flushInterval'
              ? config.flushInterval
              : config.maxRetries,
          ),
        });
      };

    const handleEndpointChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      updateConfig({ endpoint: event.target.value });
    };

    const handleSortByChange = (value: string) => {
      const nextSortField = sortFieldOptions.find((option) => option === value);
      if (!nextSortField) {
        return;
      }

      setSortBy(nextSortField);
    };

    const handleSortOrderChange = (value: string) => {
      const nextSortOrder = sortOrderOptions.find((option) => option === value);
      if (!nextSortOrder) {
        return;
      }

      setSortOrder(nextSortOrder);
    };

    const dashboardContent = (
      <Box display="flex" flexDirection="column" gap={3}>
        {hasError && error && <Alert severity="error">{error}</Alert>}

        {showDetails && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2">Total Events</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {totalEvents}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2">Total Sessions</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {totalSessions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2">Current Session Events</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {currentSession?.events ?? 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2">Queue Length</Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {eventQueue.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Instrumentation Lab
            </Typography>
            <Chip
              icon={<Analytics fontSize="small" />}
              label={`Tracking ${isTracking ? 'enabled' : 'disabled'}`}
              color={isTracking ? 'success' : 'default'}
            />
          </Box>
          <Grid container spacing={1.5}>
            {quickActions.map((action) => (
              <Grid key={action.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Button fullWidth variant="outlined" onClick={action.handler}>
                  {action.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Paper>

        <Paper sx={{ ...theming.getThemedCardSx(), p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap" mb={2}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Queued Events
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                variant={viewMode === 'table' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('table')}
                sx={viewMode === 'table' ? theming.getThemedButtonSx() : undefined}
              >
                Table
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('cards')}
                sx={viewMode === 'cards' ? theming.getThemedButtonSx() : undefined}
              >
                Cards
              </Button>
              <Button startIcon={<FilterList />} onClick={() => setFiltersExpanded((value) => !value)}>
                Filters
              </Button>
              <Button startIcon={<Sort />} onClick={() => setSortingExpanded((value) => !value)}>
                Sorting
              </Button>
            </Box>
          </Box>

          {filtersExpanded && (
            <Grid container spacing={2} mb={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Search queued events"
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
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="analytics-type-filter-label">Type</InputLabel>
                  <Select
                    labelId="analytics-type-filter-label"
                    label="Type"
                    value={filterType}
                    onChange={(event) => setFilterType(event.target.value)}
                  >
                    {typeOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option === 'all' ? 'All types' : option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="analytics-category-filter-label">Category</InputLabel>
                  <Select
                    labelId="analytics-category-filter-label"
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
            </Grid>
          )}

          {sortingExpanded && (
            <Grid container spacing={2} mb={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="analytics-sort-by-label">Sort By</InputLabel>
                  <Select
                    labelId="analytics-sort-by-label"
                    label="Sort By"
                    value={sortBy}
                    onChange={(event) => handleSortByChange(event.target.value)}
                  >
                    <MenuItem value="timestamp">Timestamp</MenuItem>
                    <MenuItem value="type">Type</MenuItem>
                    <MenuItem value="category">Category</MenuItem>
                    <MenuItem value="action">Action</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="analytics-sort-order-label">Sort Order</InputLabel>
                  <Select
                    labelId="analytics-sort-order-label"
                    label="Sort Order"
                    value={sortOrder}
                    onChange={(event) => handleSortOrderChange(event.target.value)}
                  >
                    <MenuItem value="desc">Newest First</MenuItem>
                    <MenuItem value="asc">Oldest First</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {viewMode === 'cards' ? (
            <Grid container spacing={2}>
              {pagedEvents.map((event) => (
                <Grid key={event.id} size={{ xs: 12, md: 6 }}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Chip label={event.type} size="small" color="primary" />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                      <Typography variant="subtitle2">{event.action}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {event.category} • {event.page ?? 'no page'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Page</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary">
                          No queued events match the current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                        <TableCell>{event.type}</TableCell>
                        <TableCell>{event.category}</TableCell>
                        <TableCell>{event.action}</TableCell>
                        <TableCell>{event.page ?? 'n/a'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredEvents.length}
                page={page}
                onPageChange={(_, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25]}
              />
            </TableContainer>
          )}
        </Paper>
      </Box>
    );

    const renderVariant = () => {
      if (variant === 'minimal') {
        return (
          <Tooltip title={`Analytics ${currentStatus}`}>
            <Chip
              icon={statusIcon}
              label={`${totalEvents} events`}
              color={statusColor}
              onClick={handleAnalyticsOpen}
              sx={{ cursor: 'pointer' }}
            />
          </Tooltip>
        );
      }

      if (variant === 'detailed') {
        return (
          <Paper sx={{ ...theming.getThemedCardSx(), minWidth: 260, p: 1.5 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle2" sx={{ color: theming.colors.primary }}>
                  Analytics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {queueSummary.queued} queued, {totalSessions} sessions
                </Typography>
              </Box>
              <Box display="flex" gap={0.5}>
                <IconButton size="small" onClick={handleAnalyticsOpen}>
                  <Timeline fontSize="small" />
                </IconButton>
                {showSettings && (
                  <IconButton size="small" onClick={handleSettingsOpen}>
                    <Settings fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          </Paper>
        );
      }

      return (
        <Paper sx={{ ...theming.getThemedCardSx(), p: 2.5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h5" sx={{ color: theming.colors.primary }}>
                Analytics Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Track Visual CMS usage, instrument events, and verify queue health.
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Button startIcon={<Refresh />} variant="outlined" onClick={handleFlush}>
                Flush Queue
              </Button>
              {showExport && (
                <Button startIcon={<Download />} variant="outlined" onClick={handleExport}>
                  Export
                </Button>
              )}
              {showSettings && (
                <Button startIcon={<Settings />} variant="contained" onClick={handleSettingsOpen} sx={theming.getThemedButtonSx()}>
                  Settings
                </Button>
              )}
            </Box>
          </Box>

          <Grid container spacing={2}>
            {workspaceMetrics.map((metric) => (
              <Grid key={metric.label} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                      {metric.icon}
                      <Typography variant="subtitle2">{metric.label}</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                      {metric.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {metric.helper}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box mt={2} display="flex" gap={1} flexWrap="wrap">
            <Chip icon={statusIcon} label={currentStatus} color={statusColor} />
            <Chip icon={<TrendingUp fontSize="small" />} label={`${totalEvents} total events`} color="primary" />
            <Chip
              icon={<Sync fontSize="small" />}
              label={`${queueSummary.queued} queued • last flush ${queueSummary.lastFlush}`}
              color={queueSummary.queued > 0 ? 'warning' : 'success'}
            />
            <Chip
              icon={<BugReport fontSize="small" />}
              label={`retry count ${queueSummary.retryCount}`}
              variant="outlined"
            />
          </Box>

          <Box mt={3}>{dashboardContent}</Box>
        </Paper>
      );
    };

    return (
      <>
        <Box
          className={className}
          style={{
            ...(variant === 'full' ? {} : positionStyles(position)),
            ...style,
          }}
        >
          {renderVariant()}
        </Box>

        {variant !== 'full' && (
          <Dialog
            open={showAnalyticsDialog}
            onClose={() => setShowAnalyticsDialog(false)}
            maxWidth="xl"
            fullWidth
          >
            <DialogTitle>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Analytics Dashboard
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Project: {currentProject?.name ?? 'No active project'} • {elementCount} canvas elements
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button startIcon={<Refresh />} onClick={handleFlush}>
                    Flush Queue
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
              <Button onClick={() => setShowAnalyticsDialog(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        )}

        <Dialog
          open={showSettingsDialog}
          onClose={() => setShowSettingsDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Analytics Settings</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={3} pt={1}>
              <Alert severity="info">
                Changes here apply immediately to the in-browser analytics manager.
              </Alert>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTracking}
                        onChange={handleConfigBoolean('enableTracking')}
                      />
                    }
                    label="Enable tracking"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableHeatmaps}
                        onChange={handleConfigBoolean('enableHeatmaps')}
                      />
                    }
                    label="Enable heatmaps"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableUserBehavior}
                        onChange={handleConfigBoolean('enableUserBehavior')}
                      />
                    }
                    label="Enable user behavior"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enablePerformance}
                        onChange={handleConfigBoolean('enablePerformance')}
                      />
                    }
                    label="Enable performance tracking"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableErrors}
                        onChange={handleConfigBoolean('enableErrors')}
                      />
                    }
                    label="Enable error tracking"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableClicks}
                        onChange={handleConfigBoolean('enableClicks')}
                      />
                    }
                    label="Enable click tracking"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableScrolls}
                        onChange={handleConfigBoolean('enableScrolls')}
                      />
                    }
                    label="Enable scroll tracking"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableForms}
                        onChange={handleConfigBoolean('enableForms')}
                      />
                    }
                    label="Enable form tracking"
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.debug}
                        onChange={handleConfigBoolean('debug')}
                      />
                    }
                    label="Debug mode"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Batch size"
                    value={config.batchSize}
                    onChange={handleConfigNumber('batchSize')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Flush interval (ms)"
                    value={config.flushInterval}
                    onChange={handleConfigNumber('flushInterval')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max retries"
                    value={config.maxRetries}
                    onChange={handleConfigNumber('maxRetries')}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Endpoint"
                    value={config.endpoint}
                    onChange={handleEndpointChange}
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettingsDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </>
    );
  },
);

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;
