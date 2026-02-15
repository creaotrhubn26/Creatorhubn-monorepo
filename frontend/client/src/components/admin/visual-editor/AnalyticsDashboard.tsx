/**
 * AnalyticsDashboard Component
 * Analytics dashboard with real-time metrics and insights
 */

import { useTheming } from '../../../utils/theming-helper';
import * as React from 'react';
import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { useVisualEditor } from './VisualEditorContext';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  LinearProgress, 
  Tooltip, 
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination
} from '@mui/material';
import {
  Analytics,
  TrendingUp,
  TrendingDown,
  Visibility,
  MouseOutlined,
  Lock,
  Description,
  Error as ErrorIcon,
  Warning,
  Speed,
  Timeline,
  BarChart,
  PieChart,
  ShowChart,
  Refresh,
  Settings,
  Download,
  Upload,
  FilterList,
  Search,
  Sort,
  ViewList,
  ViewModule,
  ViewComfy,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore,
  ExpandLess,
  Flag,
  Language,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Public,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync
} from '@mui/icons-material';
import { useAnalytics, UseAnalyticsOptions } from '../../../hooks/useAnalytics';
import { AnalyticsConfig, AnalyticsEvent } from '../../../utils/analyticsManager';

interface AnalyticsDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showExport?: boolean;
  showFilters?: boolean;
  showSorting?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onExportClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showExport = true,
  showFilters = false,
  showSorting = false,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onExportClick,
  className,
  style
}) => {
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Analytics options
  const analyticsOptions: UseAnalyticsOptions = useMemo(() => ({
    onEventTracked: (_event: AnalyticsEvent) => {
      setPage(0);
},
    onSessionStarted: (_session: Record<string, unknown>) => {
      setFilterType('all');
      setPage(0);
},
    onSessionEnded: (_session: Record<string, unknown>) => {
      setPage(0);
},
    onEventsFlushed: (_data: { count: number }) => {
      setPage(0);
  },
    onError: (error: string) => {
      console.error('Analytics error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use analytics hook
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
    state,
    config,
    updateConfig,
    isTracking,
    isInitialized,
    hasError,
    error,
    currentSession,
    eventQueue,
    totalEvents,
    totalSessions
} = useAnalytics(analyticsOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle export click
  const handleExportClick = useCallback(() => {
    if (onExportClick) {
      onExportClick();
  } else {
      // Export analytics data
      const data = {
        events: eventQueue,
        session: currentSession,
        totalEvents,
        totalSessions,
        timestamp: Date.now()
  };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json',});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
  }
}, [onExportClick, eventQueue, currentSession, totalEvents, totalSessions]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isTracking) return 'success';
    return 'default';
}, [hasError, isInitialized, isTracking]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return <ErrorIcon />;
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isTracking) return theming.getThemedIcon('analytics');
    return theming.getThemedIcon('warning');
}, [hasError, isInitialized, isTracking]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isTracking) return 'Tracking';
    return 'Stopped';
}, [hasError, isInitialized, isTracking]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,  };

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Analytics: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalEvents}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowAnalyticsDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ ...theming.getThemedCardSx(), p: 1, minWidth: 200 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <Analytics sx={{ color: getStatusColor() + '.main'}} />
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowAnalyticsDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {totalEvents} events
          </Typography>
          {currentSession && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {currentSession.events} in session
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 2, minWidth: 300 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Analytics color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Analytics Dashboard
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('analytics')}
            onClick={() => setShowAnalyticsDialog(true)}
            variant="outlined"
            size="small"
          >
            View Details
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid size={{ xs:  6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Events
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalEvents}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs:  6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Sessions
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalSessions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs:  6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Event Queue
              </Typography>
              <Typography variant="h4" color={eventQueue.length > 0 ? 'warning' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                {eventQueue.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs:  6 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon()}
                <Typography variant="body2" color={getStatusColor() + '.main'}>
                  {getStatusText()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {currentSession && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Current session: {currentSession.events} events, {currentSession.pageViews} page views
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Analytics Dialog */}
      <Dialog open={showAnalyticsDialog} onClose={() => setShowAnalyticsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('analytics')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Analytics Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={{ xs:  12, sm:  6, md:  3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Total Events
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {totalEvents}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs:  12, sm:  6, md:  3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Total Sessions
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {totalSessions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs:  12, sm:  6, md:  3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Event Queue
                  </Typography>
                  <Typography variant="h4" color={eventQueue.length > 0 ? 'warning' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                    {eventQueue.length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid size={{ xs:  12, sm:  6, md:  3 }}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Status
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getStatusIcon()}
                    <Typography variant="body2" color={getStatusColor() + '.main'}>
                      {getStatusText()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {eventQueue.length > 0 && (
            <Box mt={2}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Recent Events
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eventQueue
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{event.type}</TableCell>
                          <TableCell>{event.category}</TableCell>
                          <TableCell>{event.action}</TableCell>
                          <TableCell>
                            {new Date(event.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[510, 25]}
                  component="div"
                  count={eventQueue.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                />
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowAnalyticsDialog(false)}>
            Close
          </Button>
          {showExport && (
            <Button
              onClick={handleExportClick}
              variant="outlined"
              startIcon={theming.getThemedIcon('download')}
            >
              Export Data
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Analytics Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTracking}
                    onChange={(e) => updateConfig({ enableTracking: e.target.checked })}
                  />
              }
                label="Enable Tracking"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableHeatmaps}
                    onChange={(e) => updateConfig({ enableHeatmaps: e.target.checked })}
                  />
              }
                label="Enable Heatmaps"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableUserBehavior}
                    onChange={(e) => updateConfig({ enableUserBehavior: e.target.checked })}
                  />
              }
                label="Enable User Behavior Tracking"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePerformance}
                    onChange={(e) => updateConfig({ enablePerformance: e.target.checked })}
                  />
              }
                label="Enable Performance Tracking"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableErrors}
                    onChange={(e) => updateConfig({ enableErrors: e.target.checked })}
                  />
              }
                label="Enable Error Tracking"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableClicks}
                    onChange={(e) => updateConfig({ enableClicks: e.target.checked })}
                  />
              }
                label="Enable Click Tracking"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableScrolls}
                    onChange={(e) => updateConfig({ enableScrolls: e.target.checked })}
                  />
              }
                label="Enable Scroll Tracking"
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableForms}
                    onChange={(e) => updateConfig({ enableForms: e.target.checked })}
                  />
              }
                label="Enable Form Tracking"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

AnalyticsDashboard.displayName ='AnalyticsDashboard';

export default AnalyticsDashboard;

