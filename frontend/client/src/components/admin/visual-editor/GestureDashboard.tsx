/**
 * GestureDashboard Component
 * Gesture management dashboard with monitoring and configuration
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
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
  ListItemAvatar,
  Avatar,
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
  TablePagination,
  Badge,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepButton,
} from '@mui/material';
import {
  Gesture,
  Add,
  Remove,
  PlayArrow,
  Pause,
  Stop,
  Settings,
  Refresh,
  CheckCircle,
  Error,
  Info,
  Warning,
  Download,
  Upload,
  Code,
  Api,
  Build,
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
  Public,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Queue,
  BarChart,
  PieChart,
  ShowChart,
  Memory,
  Speed as Speed,
  Storage,
  Security,
  Lock,
  Visibility,
  VisibilityOff,
  Edit,
  Delete,
  MoreVert,
  Star,
  StarBorder,
  Favorite,
  FavoriteBorder,
  Schedule,
  Timer,
  Event,
  Timeline,
  AccountTree,
  Hub,
  Share,
  Link,
  GetApp,
  Publish,
  CloudUpload,
  CloudDownload,
  CloudQueue,
  TouchApp,
  PanTool,
  Swipe,
} from '@mui/icons-material';
import type { UseGesturesOptions } from '../../../hooks/useGestures';
import { useGestures } from '../../../hooks/useGestures';
import type { Gesture as GestureType, GestureEvent } from '../../../utils/gestureManager';
import { GestureConfig } from '../../../utils/gestureManager';

interface GestureDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showGestures?: boolean;
  showRecognition?: boolean;
  showExecution?: boolean;
  showAnalytics?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onGesturesClick?: () => void;
  onRecognitionClick?: () => void;
  onExecutionClick?: () => void;
  onAnalyticsClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const GestureDashboard: React.FC<GestureDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showGestures = true,
  showRecognition = true,
  showExecution = true,
  showAnalytics = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onGesturesClick,
  onRecognitionClick,
  onExecutionClick,
  onAnalyticsClick,
  className,
  style
}) => {
  const [showGestureDialog, setShowGestureDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showGesturesDialog, setShowGesturesDialog] = useState(false);
  const [showRecognitionDialog, setShowRecognitionDialog] = useState(false);
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedGesture, setSelectedGesture] = useState<GestureType | null>(null);

  // Gesture options
  const gestureOptions: UseGesturesOptions = useMemo(() => ({
    onGestureCreated: (_data: { gesture: GestureType }) => {
      setPage(0);
  },
    onGestureRecognized: (data: { gesture: GestureType; event: TouchEvent | MouseEvent | KeyboardEvent }) => {
      setSelectedGesture(data.gesture);
  },
    onGestureExecuted: (data: { gesture: GestureType; event: GestureEvent }) => {
      setSelectedGesture(data.gesture);
  },
    onGestureExecutionFailed: (data: { gesture: GestureType; event: GestureEvent; error: string }) => {
      console.error('Gesture execution failed: ', data.error);
  },
    onGestureRecognitionFailed: (data: { event: TouchEvent | MouseEvent | KeyboardEvent; error: string }) => {
      console.error('Gesture recognition failed:', data.error);
  },
    onError: (error: string) => {
      console.error('Gesture error, :', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use gestures hook
  const {
    createGesture,
    recognizeGesture,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    gestures,
    activeGestures,
    totalGestures,
    totalRecognitions,
    successfulRecognitions,
    failedRecognitions,
    averageRecognitionTime,
    averageExecutionTime,
    averageAccuracy,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getGestures
} = useGestures(gestureOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle management click
  const handleManagementClick = useCallback(() => {
    if (onManagementClick) {
      onManagementClick();
  } else {
      setShowManagementDialog(true);
  }
}, [onManagementClick]);

  // Handle monitoring click
  const handleMonitoringClick = useCallback(() => {
    if (onMonitoringClick) {
      onMonitoringClick();
  } else {
      setShowMonitoringDialog(true);
  }
}, [onMonitoringClick]);

  // Handle gestures click
  const handleGesturesClick = useCallback(() => {
    if (onGesturesClick) {
      onGesturesClick();
  } else {
      setShowGesturesDialog(true);
  }
}, [onGesturesClick]);

  // Handle recognition click
  const handleRecognitionClick = useCallback(() => {
    if (onRecognitionClick) {
      onRecognitionClick();
  } else {
      setShowRecognitionDialog(true);
  }
}, [onRecognitionClick]);

  // Handle execution click
  const handleExecutionClick = useCallback(() => {
    if (onExecutionClick) {
      onExecutionClick();
  } else {
      setShowExecutionDialog(true);
  }
}, [onExecutionClick]);

  // Handle analytics click
  const handleAnalyticsClick = useCallback(() => {
    if (onAnalyticsClick) {
      onAnalyticsClick();
  } else {
      setShowAnalyticsDialog(true);
  }
}, [onAnalyticsClick]);

  // Handle create gesture
  const handleCreateGesture = useCallback(async () => {
    try {
      const gestureData: Partial<GestureType> = {
        name: 'Custom Gesture',
        description: 'A custom gesture created by the user',
        type: 'custom',
        fingers:  1,
        threshold:  10,
        tolerance:  5,
        element: document.body,
        handler: () => { document.dispatchEvent(new CustomEvent('visual-editor:gesture', { detail: { type: 'custom', timestamp: Date.now() } })); },
        enabled: true,
        preventDefault: true,
        stopPropagation: false,
        priority: 1
  };
      await createGesture(gestureData);
  } catch (error) {
      console.error('Failed to create gesture:', error);
  }
}, [createGesture]);

  // Get status color
  const getStatusColor = useCallback((): 'default' | 'error' | 'warning' | 'success' => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (hasError) return <Error fontSize="small" />;
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <Gesture />;
    return <Warning fontSize="small" />;
}, [hasError, isInitialized, isEnabled]);

  const getStatusTextColor = useCallback((): 'error.main' | 'warning.main' | 'success.main' | 'text.secondary' => {
    if (hasError) return 'error.main';
    if (!isInitialized) return 'warning.main';
    if (isEnabled) return 'success.main';
    return 'text.secondary';
  }, [hasError, isEnabled, isInitialized]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Active';
    return 'Disabled';
}, [hasError, isInitialized, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 100,
};

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
    <Tooltip title={`Gestures: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalGestures}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowGestureDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusTextColor()}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowGestureDialog(true)}>
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
            {totalGestures} gestures • {totalRecognitions} recognitions
          </Typography>
          {activeGestures.length > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {activeGestures.length} active
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Gesture color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Gestures
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateGesture}
            variant="outlined"
            size="small"
          >
            Create
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Total Gestures
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalGestures}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Recognitions
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalRecognitions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Success Rate
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalRecognitions > 0 ? Math.round((successfulRecognitions / totalRecognitions) * 100) : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
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
      
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          Active: {activeGestures.length} • Accuracy: {averageAccuracy.toFixed()}% • Touch: {config.enableTouchGestures ? 'On' : 'Off'}
        </Typography>
      </Box>
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

      {/* Gesture Dialog */}
      <Dialog open={showGestureDialog} onClose={() => setShowGestureDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Gesture />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Gesture Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Gestures" />
            <Tab label="Recognition" />
            <Tab label="Execution" />
            <Tab label="Analytics" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Gestures
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalGestures}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Recognitions
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalRecognitions}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Success Rate
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalRecognitions > 0 ? Math.round((successfulRecognitions / totalRecognitions) * 100) : 0}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
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
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Gesture Management
              </Typography>
              <List>
                {gestures.map((gesture) => (
                  <ListItem key={gesture.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theming.getThemedIcon('touch')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={gesture.name}
                      secondary={`${gesture.type} • ${gesture.fingers} finger${gesture.fingers > 1 ? 's' : ', '} • ${gesture.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedGesture(gesture)}
                          startIcon={theming.getThemedIcon('edit')}
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {/* Handle delete */}}
                          startIcon={theming.getThemedIcon('delete')}
                          color="error"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Gesture Recognition
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Recognition Active</AlertTitle>
                Gesture recognition is {isEnabled ? 'enabled' : 'disabled'}. Total recognitions: {totalRecognitions}
              </Alert>

              {/* Recognition Controls */}
              <Box display="flex" gap={1} mb={2}>
                <Button startIcon={<PlayArrow />} variant="outlined" size="small">Start</Button>
                <Button startIcon={<Pause />} variant="outlined" size="small">Pause</Button>
                <Button startIcon={<Stop />} variant="outlined" size="small">Stop</Button>
                <Button startIcon={<Refresh />} variant="outlined" size="small">Reset</Button>
              </Box>

              {/* Gesture Types */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <TouchApp />
                    <Typography>Touch Gestures</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip icon={<Swipe />} label="Swipe" variant="outlined" />
                    <Chip icon={<PanTool />} label="Pan" variant="outlined" />
                    <Chip icon={<TouchApp />} label="Tap" variant="outlined" />
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Recognition Stats Table */}
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell align="right">Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Speed fontSize="small" />Avg Time</Box></TableCell>
                      <TableCell align="right">{averageRecognitionTime.toFixed(2)}ms</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Memory fontSize="small" />Success Rate</Box></TableCell>
                      <TableCell align="right">{successfulRecognitions}/{totalRecognitions}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Storage fontSize="small" />Failed</Box></TableCell>
                      <TableCell align="right">{failedRecognitions}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={totalRecognitions}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              />

              {/* Status Indicators */}
              <Box display="flex" gap={2} mt={2} justifyContent="center">
                <Tooltip title="Cloud Status"><CloudDone color={isEnabled ? 'success' : 'disabled'} /></Tooltip>
                <Tooltip title="Sync Status"><Sync color={isInitialized ? 'primary' : 'disabled'} /></Tooltip>
                <Tooltip title="Error Status">{hasError ? <SyncProblem color="error" /> : <CheckCircle color="success" />}</Tooltip>
              </Box>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Gesture Execution
              </Typography>

              {hasError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>Execution Error</AlertTitle>
                  {error || 'An error occurred during gesture execution'}
                </Alert>
              )}

              {/* Execution Pipeline */}
              <Stepper activeStep={1} orientation="vertical" sx={{ mb: 2 }}>
                <Step>
                  <StepButton icon={<Schedule />}>
                    <StepLabel>Detect Gesture</StepLabel>
                  </StepButton>
                  <StepContent>
                    <Typography variant="body2">Gesture detection in progress...</Typography>
                  </StepContent>
                </Step>
                <Step>
                  <StepButton icon={<Timer />}>
                    <StepLabel>Validate</StepLabel>
                  </StepButton>
                  <StepContent>
                    <Typography variant="body2">Validating gesture parameters...</Typography>
                  </StepContent>
                </Step>
                <Step>
                  <StepButton icon={<Event />}>
                    <StepLabel>Execute</StepLabel>
                  </StepButton>
                  <StepContent>
                    <Typography variant="body2">Executing gesture handler...</Typography>
                  </StepContent>
                </Step>
              </Stepper>

              <Divider sx={{ my: 2 }} />

              {/* Execution Stats */}
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Timeline color="primary" />
                        <Typography variant="subtitle2">Execution Time</Typography>
                      </Box>
                      <Typography variant="h5">{averageExecutionTime.toFixed(2)}ms</Typography>
                    </CardContent>
                    <CardActions>
                      <ButtonGroup size="small">
                        <Button startIcon={<Download />}>Export</Button>
                        <Button startIcon={<Upload />}>Import</Button>
                      </ButtonGroup>
                    </CardActions>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AccountTree color="primary" />
                        <Typography variant="subtitle2">Active Handlers</Typography>
                      </Box>
                      <Typography variant="h5">{activeGestures.length}</Typography>
                    </CardContent>
                    <CardActions>
                      <ButtonGroup size="small">
                        <Button startIcon={<Add />}>Add</Button>
                        <Button startIcon={<Remove />}>Remove</Button>
                      </ButtonGroup>
                    </CardActions>
                  </Card>
                </Grid>
              </Grid>

              {/* Quick Actions */}
              <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                <Tooltip title="View Code"><IconButton><Code /></IconButton></Tooltip>
                <Tooltip title="API"><IconButton><Api /></IconButton></Tooltip>
                <Tooltip title="Build"><IconButton><Build /></IconButton></Tooltip>
                <Tooltip title="Filter"><IconButton><FilterList /></IconButton></Tooltip>
                <Tooltip title="Search"><IconButton><Search /></IconButton></Tooltip>
                <Tooltip title="Sort"><IconButton><Sort /></IconButton></Tooltip>
              </Box>

              {/* View Controls */}
              <Box mt={2} display="flex" gap={1}>
                <Tooltip title="List View"><IconButton><ViewList /></IconButton></Tooltip>
                <Tooltip title="Module View"><IconButton><ViewModule /></IconButton></Tooltip>
                <Tooltip title="Compact View"><IconButton><ViewComfy /></IconButton></Tooltip>
              </Box>

              {/* Additional Icons */}
              <Box mt={2} display="flex" gap={1} flexWrap="wrap" justifyContent="center">
                <Flag fontSize="small" />
                <Public fontSize="small" />
                <Book fontSize="small" />
                <School fontSize="small" />
                <Work fontSize="small" />
                <Home fontSize="small" />
                <Person fontSize="small" />
                <Group fontSize="small" />
                <PublicOff fontSize="small" />
              </Box>

              {/* Cloud Actions */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton><CloudUpload /></IconButton>
                <IconButton><CloudDownload /></IconButton>
                <IconButton><CloudSync /></IconButton>
                <IconButton><CloudQueue /></IconButton>
                <IconButton><CloudOff /></IconButton>
              </Box>

              {/* More Actions */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton><Hub /></IconButton>
                <IconButton><Share /></IconButton>
                <IconButton><Link /></IconButton>
                <IconButton><GetApp /></IconButton>
                <IconButton><Publish /></IconButton>
              </Box>

              {/* Favorites & Stars */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton><Star color="warning" /></IconButton>
                <IconButton><StarBorder /></IconButton>
                <IconButton><Favorite color="error" /></IconButton>
                <IconButton><FavoriteBorder /></IconButton>
                <IconButton><Edit /></IconButton>
                <IconButton><Delete /></IconButton>
                <IconButton><MoreVert /></IconButton>
              </Box>

              {/* Visibility Controls */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton><Visibility /></IconButton>
                <IconButton><VisibilityOff /></IconButton>
                <IconButton><Lock /></IconButton>
                <IconButton><Security /></IconButton>
                <IconButton><Queue /></IconButton>
              </Box>

              {/* Charts */}
              <Box mt={2} display="flex" gap={2} justifyContent="center">
                <Chip icon={<BarChart />} label="Analytics" />
                <Chip icon={<PieChart />} label="Distribution" />
                <Chip icon={<ShowChart />} label="Trends" />
              </Box>

              {/* Expand Controls */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton><KeyboardArrowUp /></IconButton>
                <IconButton><KeyboardArrowDown /></IconButton>
                <IconButton><ExpandMore /></IconButton>
                <IconButton><ExpandLess /></IconButton>
              </Box>

              {/* Status Indicators */}
              <Box mt={2} display="flex" gap={2} justifyContent="center">
                <Info color="info" />
                <Warning color="warning" />
                <Error color="error" />
                <CheckCircle color="success" />
              </Box>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Analytics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Recognition Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageRecognitionTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Avg Execution Time
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageExecutionTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Accuracy
                      </Typography>
                      <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                        {averageAccuracy.toFixed(1)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Errors
                      </Typography>
                      <Typography variant="h4" color="error.main" sx={{ color: theming.colors.primary }}>
                        {totalErrors}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Gesture Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGestures}
                        onChange={(e) => updateConfig({ enableGestures: e.target.checked })}
                      />
                  }
                    label="Enable Gestures"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableTouchGestures}
                        onChange={(e) => updateConfig({ enableTouchGestures: e.target.checked })}
                      />
                  }
                    label="Enable Touch Gestures"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableMouseGestures}
                        onChange={(e) => updateConfig({ enableMouseGestures: e.target.checked })}
                      />
                  }
                    label="Enable Mouse Gestures"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableKeyboardGestures}
                        onChange={(e) => updateConfig({ enableKeyboardGestures: e.target.checked })}
                      />
                  }
                    label="Enable Keyboard Gestures"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAccessibility}
                        onChange={(e) => updateConfig({ enableAccessibility: e.target.checked })}
                      />
                  }
                    label="Enable Accessibility"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableHapticFeedback}
                        onChange={(e) => updateConfig({ enableHapticFeedback: e.target.checked })}
                      />
                  }
                    label="Enable Haptic Feedback"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGestureRecognition}
                        onChange={(e) => updateConfig({ enableGestureRecognition: e.target.checked })}
                      />
                  }
                    label="Enable Gesture Recognition"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGestureValidation}
                        onChange={(e) => updateConfig({ enableGestureValidation: e.target.checked })}
                      />
                  }
                    label="Enable Gesture Validation"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGestureOptimization}
                        onChange={(e) => updateConfig({ enableGestureOptimization: e.target.checked })}
                      />
                  }
                    label="Enable Gesture Optimization"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGestureAnalytics}
                        onChange={(e) => updateConfig({ enableGestureAnalytics: e.target.checked })}
                      />
                  }
                    label="Enable Gesture Analytics"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowGestureDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateGesture}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Gesture
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Gesture Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGestures}
                    onChange={(e) => updateConfig({ enableGestures: e.target.checked })}
                  />
              }
                label="Enable Gestures"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTouchGestures}
                    onChange={(e) => updateConfig({ enableTouchGestures: e.target.checked })}
                  />
              }
                label="Enable Touch Gestures"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableMouseGestures}
                    onChange={(e) => updateConfig({ enableMouseGestures: e.target.checked })}
                  />
              }
                label="Enable Mouse Gestures"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableKeyboardGestures}
                    onChange={(e) => updateConfig({ enableKeyboardGestures: e.target.checked })}
                  />
              }
                label="Enable Keyboard Gestures"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAccessibility}
                    onChange={(e) => updateConfig({ enableAccessibility: e.target.checked })}
                  />
              }
                label="Enable Accessibility"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableHapticFeedback}
                    onChange={(e) => updateConfig({ enableHapticFeedback: e.target.checked })}
                  />
              }
                label="Enable Haptic Feedback"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGestureRecognition}
                    onChange={(e) => updateConfig({ enableGestureRecognition: e.target.checked })}
                  />
              }
                label="Enable Gesture Recognition"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGestureValidation}
                    onChange={(e) => updateConfig({ enableGestureValidation: e.target.checked })}
                  />
              }
                label="Enable Gesture Validation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGestureOptimization}
                    onChange={(e) => updateConfig({ enableGestureOptimization: e.target.checked })}
                  />
              }
                label="Enable Gesture Optimization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGestureAnalytics}
                    onChange={(e) => updateConfig({ enableGestureAnalytics: e.target.checked })}
                  />
              }
                label="Enable Gesture Analytics"
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

GestureDashboard.displayName ='GestureDashboard';

export default GestureDashboard;




