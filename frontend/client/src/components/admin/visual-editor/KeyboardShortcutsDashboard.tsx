/**
 * KeyboardShortcutsDashboard Component
 * Keyboard shortcuts dashboard with management and monitoring
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
  StepButton
} from '@mui/material';
import {
  Keyboard,
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
  Speed,
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
  KeyboardAlt,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  KeyboardBackspace,
  KeyboardReturn,
  KeyboardTab
} from '@mui/icons-material';
import { useKeyboardShortcuts, UseKeyboardShortcutsOptions } from '../../../hooks/useKeyboardShortcuts';
import { KeyboardConfig, KeyboardShortcut } from '../../../utils/keyboardShortcutsManager';

interface KeyboardShortcutsDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showShortcuts?: boolean;
  showContexts?: boolean;
  showRecording?: boolean;
  showPlayback?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onShortcutsClick?: () => void;
  onContextsClick?: () => void;
  onRecordingClick?: () => void;
  onPlaybackClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const KeyboardShortcutsDashboard: React.FC<KeyboardShortcutsDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showShortcuts = true,
  showContexts = true,
  showRecording = true,
  showPlayback = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onShortcutsClick,
  onContextsClick,
  onRecordingClick,
  onPlaybackClick,
  className,
  style
}) => {
  const [showKeyboardDialog, setShowKeyboardDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showContextsDialog, setShowContextsDialog] = useState(false);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [showPlaybackDialog, setShowPlaybackDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedShortcut, setSelectedShortcut] = useState<KeyboardShortcut | null>(null);

  // Keyboard shortcuts options
  const keyboardOptions: UseKeyboardShortcutsOptions = useMemo(() => ({
    onShortcutCreated: (data: { shortcut: KeyboardShortcut }) => {
      // Handle shortcut created
  },
    onShortcutExecuted: (data: { shortcut: KeyboardShortcut; event?: KeyboardEvent }) => {
      // Handle shortcut executed
  },
    onShortcutExecutionFailed: (data: { shortcut: KeyboardShortcut; event?: KeyboardEvent; error: string }) => {
      console.error('Shortcut execution failed:', data.error);
  },
    onContextChanged: (data: { contexts: string[] }) => {
      // Handle context changed
  },
    onError: (error: string) => {
      console.error('Keyboard shortcuts error:', error);
  },
    onInitialized: () => {
      // Handle initialized
}
}), []);

  // Use keyboard shortcuts hook
  const {
    createShortcut,
    executeShortcut,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    shortcuts,
    contexts,
    activeContexts,
    recording,
    playback,
    totalShortcuts,
    totalContexts,
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageExecutionTime,
    averageMemoryUsage,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getShortcuts,
    getContexts
} = useKeyboardShortcuts(keyboardOptions);

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

  // Handle shortcuts click
  const handleShortcutsClick = useCallback(() => {
    if (onShortcutsClick) {
      onShortcutsClick();
  } else {
      setShowShortcutsDialog(true);
  }
}, [onShortcutsClick]);

  // Handle contexts click
  const handleContextsClick = useCallback(() => {
    if (onContextsClick) {
      onContextsClick();
  } else {
      setShowContextsDialog(true);
  }
}, [onContextsClick]);

  // Handle recording click
  const handleRecordingClick = useCallback(() => {
    if (onRecordingClick) {
      onRecordingClick();
  } else {
      setShowRecordingDialog(true);
  }
}, [onRecordingClick]);

  // Handle playback click
  const handlePlaybackClick = useCallback(() => {
    if (onPlaybackClick) {
      onPlaybackClick();
  } else {
      setShowPlaybackDialog(true);
  }
}, [onPlaybackClick]);

  // Handle create shortcut
  const handleCreateShortcut = useCallback(async () => {
    try {
      const shortcutData: Partial<KeyboardShortcut> = {
        name: 'Custom Shortcut',
        description: 'A custom keyboard shortcut',
        category: 'custom',
        key: 'F1',
        modifiers:  [],
        context: ['*'],
        action: 'custom',
        handler: () => console.log('Custom shortcut executed'),
        enabled: true,
        global: true,
        preventDefault: true,
        stopPropagation: false,
        priority: 1 };
      await createShortcut(shortcutData);
  } catch (error) {
      console.error('Failed to create shortcut:', error);
  }
}, [createShortcut]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return theming.getThemedIcon('keyboard');
    return theming.getThemedIcon('warning');
}, [hasError, isInitialized, isEnabled]);

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
    <Tooltip title={`Shortcuts: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalShortcuts}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowKeyboardDialog(true)}
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
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowKeyboardDialog(true)}>
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
            {totalShortcuts} shortcuts
          </Typography>
          {totalExecutions > 0 && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {totalExecutions} executions
            </Typography>
          )}
          {totalErrors > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {totalErrors} errors
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
          <Keyboard color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Keyboard Shortcuts
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreateShortcut}
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
                Total Shortcuts
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalShortcuts}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Executions
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalExecutions}
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
                {totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0}%
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
          Active contexts: {activeContexts.length} • Recording: {recording ? 'Yes' : 'N'} • Playback: {playback ? 'Yes' : 'N'}
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

      {/* Keyboard Dialog */}
      <Dialog open={showKeyboardDialog} onClose={() => setShowKeyboardDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('keyboard')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Keyboard Shortcuts Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Shortcuts" />
            <Tab label="Contexts" />
            <Tab label="Recording" />
            <Tab label="Playback" />
            <Tab label="Monitoring" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Shortcuts
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalShortcuts}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Executions
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalExecutions}
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
                      {totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0}%
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
                Shortcut Management
              </Typography>
              <List>
                {shortcuts.map((shortcut) => (
                  <ListItem key={shortcut.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theming.getThemedIcon('keyboard')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={shortcut.name}
                      secondary={`${shortcut.key} • ${shortcut.modifiers.join('+')} • ${shortcut.category}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => executeShortcut(shortcut.id)}
                          startIcon={theming.getThemedIcon('play')}
                        >
                          Execute
                        </Button>
                        <Button
                          onClick={() => setSelectedShortcut(shortcut)}
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
                Context Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total contexts: {totalContexts}
              </Typography>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Shortcut Recording
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                <AlertTitle>Recording Mode</AlertTitle>
                Press any key combination to record a new shortcut
              </Alert>

              {/* Recording Controls */}
              <Box display="flex" gap={1} mb={2}>
                <Button startIcon={<PlayArrow />} variant="contained" size="small">Start</Button>
                <Button startIcon={<Pause />} variant="outlined" size="small">Pause</Button>
                <Button startIcon={<Stop />} variant="outlined" size="small" color="error">Stop</Button>
                <Button startIcon={<Refresh />} variant="outlined" size="small">Reset</Button>
              </Box>

              {/* Keyboard Key Display */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <KeyboardAlt />
                    <Typography>Modifier Keys</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip icon={<KeyboardArrowLeft />} label="Left" variant="outlined" />
                    <Chip icon={<KeyboardArrowRight />} label="Right" variant="outlined" />
                    <Chip icon={<KeyboardArrowUp />} label="Up" variant="outlined" />
                    <Chip icon={<KeyboardArrowDown />} label="Down" variant="outlined" />
                    <Chip icon={<KeyboardBackspace />} label="Backspace" variant="outlined" />
                    <Chip icon={<KeyboardReturn />} label="Return" variant="outlined" />
                    <Chip icon={<KeyboardTab />} label="Tab" variant="outlined" />
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* Recording Pipeline */}
              <Stepper activeStep={1} orientation="vertical" sx={{ mt: 2 }}>
                <Step>
                  <StepButton icon={<Schedule />}>
                    <StepLabel>Capture Input</StepLabel>
                  </StepButton>
                  <StepContent>
                    <Typography variant="body2">Listening for keyboard input...</Typography>
                  </StepContent>
                </Step>
                <Step>
                  <StepButton icon={<Timer />}>
                    <StepLabel>Process Keys</StepLabel>
                  </StepButton>
                  <StepContent>
                    <Typography variant="body2">Processing key combinations...</Typography>
                  </StepContent>
                </Step>
                <Step>
                  <StepButton icon={<Event />}>
                    <StepLabel>Create Shortcut</StepLabel>
                  </StepButton>
                  <StepContent>
                    <Typography variant="body2">Creating shortcut binding...</Typography>
                  </StepContent>
                </Step>
              </Stepper>

              <Divider sx={{ my: 2 }} />

              {/* Recorded Shortcuts Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Key</TableCell>
                      <TableCell>Modifiers</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><Chip label="Ctrl+S" size="small" /></TableCell>
                      <TableCell><Badge badgeContent={2} color="primary"><Speed fontSize="small" /></Badge></TableCell>
                      <TableCell>Save</TableCell>
                      <TableCell align="right">
                        <IconButton size="small"><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={totalShortcuts}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              />

              {/* Status Indicators */}
              <Box display="flex" gap={2} mt={2} justifyContent="center">
                <Tooltip title="Recording"><Memory color={recording ? 'primary' : 'disabled'} /></Tooltip>
                <Tooltip title="Storage"><Storage color="success" /></Tooltip>
                <Tooltip title="Security"><Security color="info" /></Tooltip>
                <Tooltip title="Lock"><Lock color="warning" /></Tooltip>
              </Box>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Shortcut Playback
              </Typography>

              {hasError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>Playback Error</AlertTitle>
                  {error || 'An error occurred during playback'}
                </Alert>
              )}

              {/* Playback Controls */}
              <Card sx={theming.getThemedCardSx()}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Timeline color="primary" />
                    <Typography variant="subtitle2">Playback Timeline</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={50} sx={{ mt: 1 }} />
                </CardContent>
                <CardActions>
                  <ButtonGroup size="small">
                    <Button startIcon={<PlayArrow />}>Play</Button>
                    <Button startIcon={<Pause />}>Pause</Button>
                    <Button startIcon={<Stop />}>Stop</Button>
                    <Button startIcon={<Add />}>Add</Button>
                    <Button startIcon={<Remove />}>Remove</Button>
                  </ButtonGroup>
                </CardActions>
              </Card>

              <Divider sx={{ my: 2 }} />

              {/* Quick Actions */}
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                <Tooltip title="View Code"><IconButton><Code /></IconButton></Tooltip>
                <Tooltip title="API"><IconButton><Api /></IconButton></Tooltip>
                <Tooltip title="Build"><IconButton><Build /></IconButton></Tooltip>
                <Tooltip title="Filter"><IconButton><FilterList /></IconButton></Tooltip>
                <Tooltip title="Search"><IconButton><Search /></IconButton></Tooltip>
                <Tooltip title="Sort"><IconButton><Sort /></IconButton></Tooltip>
              </Box>

              {/* View Controls */}
              <Box display="flex" gap={1} mb={2}>
                <Tooltip title="List View"><IconButton><ViewList /></IconButton></Tooltip>
                <Tooltip title="Module View"><IconButton><ViewModule /></IconButton></Tooltip>
                <Tooltip title="Compact View"><IconButton><ViewComfy /></IconButton></Tooltip>
              </Box>

              {/* Category Icons */}
              <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center" mb={2}>
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
              <Box display="flex" gap={1} justifyContent="center" mb={2}>
                <IconButton><CloudUpload /></IconButton>
                <IconButton><CloudDownload /></IconButton>
                <IconButton><CloudSync /></IconButton>
                <IconButton><CloudQueue /></IconButton>
                <IconButton><CloudOff /></IconButton>
              </Box>

              {/* More Actions */}
              <Box display="flex" gap={1} justifyContent="center" mb={2}>
                <IconButton><AccountTree /></IconButton>
                <IconButton><Hub /></IconButton>
                <IconButton><Share /></IconButton>
                <IconButton><Link /></IconButton>
                <IconButton><GetApp /></IconButton>
                <IconButton><Publish /></IconButton>
              </Box>

              {/* Favorites & Stars */}
              <Box display="flex" gap={1} justifyContent="center" mb={2}>
                <IconButton><Star color="warning" /></IconButton>
                <IconButton><StarBorder /></IconButton>
                <IconButton><Favorite color="error" /></IconButton>
                <IconButton><FavoriteBorder /></IconButton>
                <IconButton><MoreVert /></IconButton>
              </Box>

              {/* Visibility Controls */}
              <Box display="flex" gap={1} justifyContent="center" mb={2}>
                <IconButton><Visibility /></IconButton>
                <IconButton><VisibilityOff /></IconButton>
                <IconButton><Download /></IconButton>
                <IconButton><Upload /></IconButton>
                <IconButton><Queue /></IconButton>
              </Box>

              {/* Charts */}
              <Box display="flex" gap={2} justifyContent="center" mb={2}>
                <Chip icon={<BarChart />} label="Analytics" />
                <Chip icon={<PieChart />} label="Distribution" />
                <Chip icon={<ShowChart />} label="Trends" />
              </Box>

              {/* Expand Controls */}
              <Box display="flex" gap={1} justifyContent="center" mb={2}>
                <IconButton><ExpandMore /></IconButton>
                <IconButton><ExpandLess /></IconButton>
              </Box>

              {/* Cloud Status */}
              <Box display="flex" gap={2} mt={2} justifyContent="center">
                <CloudDone color="success" />
                <Sync color={isEnabled ? 'primary' : 'disabled'} />
                {hasError ? <SyncProblem color="error" /> : <CheckCircle color="success" />}
              </Box>

              {/* Status Indicators */}
              <Box display="flex" gap={2} mt={2} justifyContent="center">
                <Info color="info" />
                <Warning color="warning" />
                <Error color="error" />
              </Box>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Performance Monitoring
              </Typography>
              <Grid container spacing={2}>
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
                        Avg Memory Usage
                      </Typography>
                      <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                        {averageMemoryUsage.toFixed(2)}MB
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
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        Total Conflicts
                      </Typography>
                      <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                        {totalConflicts}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 6 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Keyboard Shortcuts Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShortcuts}
                        onChange={(e) => updateConfig({ enableShortcuts: e.target.checked })}
                      />
                  }
                    label="Enable Shortcuts"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableHotkeys}
                        onChange={(e) => updateConfig({ enableHotkeys: e.target.checked })}
                      />
                  }
                    label="Enable Hotkeys"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableGlobalShortcuts}
                        onChange={(e) => updateConfig({ enableGlobalShortcuts: e.target.checked })}
                      />
                  }
                    label="Enable Global Shortcuts"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableContextShortcuts}
                        onChange={(e) => updateConfig({ enableContextShortcuts: e.target.checked })}
                      />
                  }
                    label="Enable Context Shortcuts"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableCustomShortcuts}
                        onChange={(e) => updateConfig({ enableCustomShortcuts: e.target.checked })}
                      />
                  }
                    label="Enable Custom Shortcuts"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShortcutOverrides}
                        onChange={(e) => updateConfig({ enableShortcutOverrides: e.target.checked })}
                      />
                  }
                    label="Enable Shortcut Overrides"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShortcutConflicts}
                        onChange={(e) => updateConfig({ enableShortcutConflicts: e.target.checked })}
                      />
                  }
                    label="Enable Shortcut Conflicts"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShortcutHelp}
                        onChange={(e) => updateConfig({ enableShortcutHelp: e.target.checked })}
                      />
                  }
                    label="Enable Shortcut Help"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShortcutRecording}
                        onChange={(e) => updateConfig({ enableShortcutRecording: e.target.checked })}
                      />
                  }
                    label="Enable Shortcut Recording"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableShortcutPlayback}
                        onChange={(e) => updateConfig({ enableShortcutPlayback: e.target.checked })}
                      />
                  }
                    label="Enable Shortcut Playback"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowKeyboardDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreateShortcut}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
           sx={theming.getThemedButtonSx()}>
            Create Shortcut
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Keyboard Shortcuts Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShortcuts}
                    onChange={(e) => updateConfig({ enableShortcuts: e.target.checked })}
                  />
              }
                label="Enable Shortcuts"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableHotkeys}
                    onChange={(e) => updateConfig({ enableHotkeys: e.target.checked })}
                  />
              }
                label="Enable Hotkeys"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableGlobalShortcuts}
                    onChange={(e) => updateConfig({ enableGlobalShortcuts: e.target.checked })}
                  />
              }
                label="Enable Global Shortcuts"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableContextShortcuts}
                    onChange={(e) => updateConfig({ enableContextShortcuts: e.target.checked })}
                  />
              }
                label="Enable Context Shortcuts"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCustomShortcuts}
                    onChange={(e) => updateConfig({ enableCustomShortcuts: e.target.checked })}
                  />
              }
                label="Enable Custom Shortcuts"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShortcutOverrides}
                    onChange={(e) => updateConfig({ enableShortcutOverrides: e.target.checked })}
                  />
              }
                label="Enable Shortcut Overrides"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShortcutConflicts}
                    onChange={(e) => updateConfig({ enableShortcutConflicts: e.target.checked })}
                  />
              }
                label="Enable Shortcut Conflicts"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShortcutHelp}
                    onChange={(e) => updateConfig({ enableShortcutHelp: e.target.checked })}
                  />
              }
                label="Enable Shortcut Help"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShortcutRecording}
                    onChange={(e) => updateConfig({ enableShortcutRecording: e.target.checked })}
                  />
              }
                label="Enable Shortcut Recording"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableShortcutPlayback}
                    onChange={(e) => updateConfig({ enableShortcutPlayback: e.target.checked })}
                  />
              }
                label="Enable Shortcut Playback"
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

KeyboardShortcutsDashboard.displayName ='KeyboardShortcutsDashboard';

export default KeyboardShortcutsDashboard;





