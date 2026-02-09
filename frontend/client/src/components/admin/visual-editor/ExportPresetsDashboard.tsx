/**
 * ExportPresetsDashboard Component
 * Export presets management dashboard with platform and format support
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
  Slider
} from '@mui/material';
import {
  GetApp,
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
  Publish,
  CloudUpload,
  CloudDownload,
  CloudQueue,
  PlayCircleOutline,
  PauseCircleOutline,
  StopCircle,
  SkipNext,
  SkipPrevious,
  Replay,
  FastForward,
  FastRewind,
  VolumeUp,
  VolumeOff,
  VolumeDown,
  Fullscreen,
  FullscreenExit,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  CenterFocusWeak
} from '@mui/icons-material';
import { useExportPresets, UseExportPresetsOptions } from '../../../hooks/useExportPresets';
import { ExportPresetConfig, ExportPreset, ExportPlatform, ExportFormat } from '../../../utils/exportPresetsManager';

interface ExportPresetsDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showManagement?: boolean;
  showMonitoring?: boolean;
  showPresets?: boolean;
  showPlatforms?: boolean;
  showFormats?: boolean;
  showPreview?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onManagementClick?: () => void;
  onMonitoringClick?: () => void;
  onPresetsClick?: () => void;
  onPlatformsClick?: () => void;
  onFormatsClick?: () => void;
  onPreviewClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const ExportPresetsDashboard: React.FC<ExportPresetsDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showManagement = true,
  showMonitoring = true,
  showPresets = true,
  showPlatforms = true,
  showFormats = true,
  showPreview = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onManagementClick,
  onMonitoringClick,
  onPresetsClick,
  onPlatformsClick,
  onFormatsClick,
  onPreviewClick,
  className,
  style
}) => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showPresetsDialog, setShowPresetsDialog] = useState(false);
  const [showPlatformsDialog, setShowPlatformsDialog] = useState(false);
  const [showFormatsDialog, setShowFormatsDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all,');
  const [filterFormat, setFilterFormat] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedPreset, setSelectedPreset] = useState<ExportPreset | null>(null);

  // Export presets options
  const exportPresetsOptions: UseExportPresetsOptions = useMemo(() => ({
    onPresetAdded: (data: { preset: ExportPreset }) => {
      // Handle preset added
  },
    onPlatformAdded: (data: { platform: ExportPlatform }) => {
      // Handle platform added
  },
    onFormatAdded: (data: { format: ExportFormat }) => {
      // Handle format added
  },
    onError: (error: string) => {
      console.error('Export presets error, :', error);
  },
    onInitialized: () => {
      // Handle initialized
}
}), []);

  // Use export presets hook
  const {
    addPreset,
    addPlatform,
    addFormat,
    getPreset,
    getPlatform,
    getFormat,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    presets,
    platforms,
    formats,
    lastExport,
    totalPresets,
    totalPlatforms,
    totalFormats,
    totalExports,
    totalErrors,
    totalConflicts,
    totalOverrides,
    getAllPresets,
    getAllPlatforms,
    getAllFormats
} = useExportPresets(exportPresetsOptions);

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

  // Handle presets click
  const handlePresetsClick = useCallback(() => {
    if (onPresetsClick) {
      onPresetsClick();
  } else {
      setShowPresetsDialog(true);
  }
}, [onPresetsClick]);

  // Handle platforms click
  const handlePlatformsClick = useCallback(() => {
    if (onPlatformsClick) {
      onPlatformsClick();
  } else {
      setShowPlatformsDialog(true);
  }
}, [onPlatformsClick]);

  // Handle formats click
  const handleFormatsClick = useCallback(() => {
    if (onFormatsClick) {
      onFormatsClick();
  } else {
      setShowFormatsDialog(true);
  }
}, [onFormatsClick]);

  // Handle preview click
  const handlePreviewClick = useCallback(() => {
    if (onPreviewClick) {
      onPreviewClick();
  } else {
      setShowPreviewDialog(true);
  }
}, [onPreviewClick]);

  // Handle create preset
  const handleCreatePreset = useCallback(async () => {
    try {
      const presetData: Partial<ExportPreset> = {
        name: 'Custom Export Preset',
        description: 'A custom export preset created by the user',
        platform: platforms[0],
        format: formats[0],
        settings: {
          quality: 80,
          compression:  6,
          format: 'webp',
          colorSpace: 'sRG',
          transparent: true,
          dpi: 72 },
        optimization: {
          enableOptimization: true,
          targetSize: 500 * 1024,
          targetQuality: 80,
          targetSpeed: 5,
          algorithms: ['mozjpeg','pngquant','webp'],
          parameters: {
            mozjpeg: { quality: 80 },
            pngquant: { quality: [65, 80] },
            webp: { quality: 80 }
          },
          preview: true,
          batch: true,
          parallel: true,
          cache: true,
          metadata: {},
          config: {}
        } as any,
        compression: {
          enableCompression: true,
          algorithm: 'gzip',
          level: 6,
          dictionary: 3278,
          strategy: 'default',
          windowBits: 15,
          memLevel: 8,
          chunkSize: 1634,
          parallel: true,
          streaming: true,
          metadata: {},
          config: {}
        } as any,
        validation: {
          enableValidation: true,
          rules: [],
          strict: true,
          warnings: true,
          errors: true,
          metadata: {},
          config: {}
        } as any,
        metadata: {
          title: 'Custom Export Preset',
          description: 'A custom export preset created by the user',
          author: 'User',
          copyright: '© 2024',
          license: 'MIT',
          keywords: ['custom', 'export', 'preset'],
          version: '1.0.0',
          created: Date.now(),
          modified: Date.now(),
          platform: 'web',
          format: 'webp',
          size: 0,
          quality: 80,
          compression: 6
        }
      };
      await addPreset(presetData);
    } catch (error) {
      console.error('Failed to create preset: ', error);
    }
}, [addPreset, platforms, formats]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (hasError) return <Error color="error" />;
    if (!isInitialized) return <CircularProgress size={16} />;
    if (isEnabled) return <CheckCircle color="success" />;
    return <Warning color="warning" />;
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
    <Tooltip title={`Export Presets: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalPresets}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowExportDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ ...theming.getThemedCardSx(), p: 1, minWidth: 200 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowExportDialog(true)}>
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
            {totalPresets} presets • {totalPlatforms} platforms • {totalFormats} formats
          </Typography>
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ ...theming.getThemedCardSx(), p: 2, minWidth: 300 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <GetApp color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Export Presets
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('add')}
            onClick={handleCreatePreset}
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
        <Grid item xs={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Presets
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalPresets}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Platforms
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {totalPlatforms}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Formats
              </Typography>
              <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                {totalFormats}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Exports
              </Typography>
              <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                {totalExports}
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
          Errors: {totalErrors} • Conflicts: {totalConflicts} • Overrides: {totalOverrides}
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

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('getApp')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Export Presets Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Presets" />
            <Tab label="Platforms" />
            <Tab label="Formats" />
            <Tab label="Preview" />
            <Tab label="Settings" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Presets
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalPresets}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Platforms
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {totalPlatforms}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Formats
                    </Typography>
                    <Typography variant="h4" color="success.main" sx={{ color: theming.colors.primary }}>
                      {totalFormats}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Exports
                    </Typography>
                    <Typography variant="h4" color="warning.main" sx={{ color: theming.colors.primary }}>
                      {totalExports}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Export Presets Management
              </Typography>
              <List>
                {presets.map((preset) => (
                  <ListItem key={preset.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {theming.getThemedIcon('getApp')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={preset.name}
                      secondary={`${preset.platform.name} • ${preset.format.name} • ${preset.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => setSelectedPreset(preset)}
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
                Platform Management
              </Typography>
              <List>
                {platforms.map((platform) => (
                  <ListItem key={platform.id}>
                    <ListItemAvatar>
                      <Avatar>
                        {platform.icon}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={platform.name}
                      secondary={`${platform.type} • ${platform.description} • ${platform.supportedFormats.length} formats`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => {/* Handle edit */}}
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

          {activeTab === 3 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Format Management
              </Typography>
              <List>
                {formats.map((format) => (
                  <ListItem key={format.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <Code />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={format.name}
                      secondary={`${format.extension} • ${format.category} • ${format.description}`}
                    />
                    <ListItemSecondaryAction>
                      <ButtonGroup size="small">
                        <Button
                          onClick={() => {/* Handle edit */}}
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
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Export Preview
              </Typography>
              
              {hasError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>Preview Error</AlertTitle>
                  {error || 'An error occurred loading preview'}
                </Alert>
              )}
              
              <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius: 1, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  Export preview area
                </Typography>
                {selectedPreset && (
                  <Box sx={{ mt:  2 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <Star color="warning" />
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedPreset.name}</Typography>
                      <IconButton size="small"><MoreVert /></IconButton>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {selectedPreset.description}
                    </Typography>
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius:  1 }}>
                      <Typography variant="body2">
                        Platform: {selectedPreset.platform.name}
                      </Typography>
                      <Typography variant="body2">
                        Format: {selectedPreset.format.name}
                      </Typography>
                      <Typography variant="body2">
                        Quality: {selectedPreset.settings.quality}%
                      </Typography>
                      <Typography variant="body2">
                        Compression: {selectedPreset.settings.compression}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Preview Controls */}
              <Box display="flex" justifyContent="center" gap={1} mb={2}>
                <IconButton><SkipPrevious /></IconButton>
                <IconButton><FastRewind /></IconButton>
                <IconButton color="primary"><PlayArrow /></IconButton>
                <IconButton><Pause /></IconButton>
                <IconButton><Stop /></IconButton>
                <IconButton><FastForward /></IconButton>
                <IconButton><SkipNext /></IconButton>
                <IconButton><Replay /></IconButton>
              </Box>

              {/* Volume & View Controls */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton size="small"><VolumeOff /></IconButton>
                  <IconButton size="small"><VolumeDown /></IconButton>
                  <Slider sx={{ width: 100 }} size="small" defaultValue={70} />
                  <IconButton size="small"><VolumeUp /></IconButton>
                </Box>
                <Box display="flex" gap={0.5}>
                  <IconButton size="small"><ZoomOut /></IconButton>
                  <IconButton size="small"><ZoomIn /></IconButton>
                  <IconButton size="small"><CenterFocusWeak /></IconButton>
                  <IconButton size="small"><CenterFocusStrong /></IconButton>
                  <IconButton size="small"><Fullscreen /></IconButton>
                  <IconButton size="small"><FullscreenExit /></IconButton>
                </Box>
              </Box>

              {/* Timeline */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Timeline />
                    <Typography>Export Timeline</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stepper activeStep={0} alternativeLabel>
                    <Step>
                      <StepButton icon={<Schedule />}>Schedule</StepButton>
                    </Step>
                    <Step>
                      <StepButton icon={<Timer />}>Process</StepButton>
                    </Step>
                    <Step>
                      <StepButton icon={<Event />}>Complete</StepButton>
                    </Step>
                  </Stepper>
                </AccordionDetails>
              </Accordion>

              {/* Advanced Features Table */}
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Feature</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Performance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Memory fontSize="small" />Memory</Box></TableCell>
                      <TableCell><Badge color="success" variant="dot" /> Active</TableCell>
                      <TableCell>Optimal</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Speed fontSize="small" />Speed</Box></TableCell>
                      <TableCell><Badge color="info" variant="dot" /> Fast</TableCell>
                      <TableCell>High</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Storage fontSize="small" />Storage</Box></TableCell>
                      <TableCell><Badge color="warning" variant="dot" /> Limited</TableCell>
                      <TableCell>Medium</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Box display="flex" alignItems="center" gap={1}><Security fontSize="small" />Security</Box></TableCell>
                      <TableCell><Badge color="success" variant="dot" /> Secure</TableCell>
                      <TableCell><Lock fontSize="small" /></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                rowsPerPageOptions={[5, 10]}
                component="div"
                count={10}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              />

              {/* Quick Actions Card */}
              <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <AccountTree />
                    <Typography variant="subtitle2">Export Architecture</Typography>
                  </Box>
                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <Chip icon={<Hub />} label="Hub" size="small" variant="outlined" />
                    </Grid>
                    <Grid item xs={4}>
                      <Chip icon={<Share />} label="Share" size="small" variant="outlined" />
                    </Grid>
                    <Grid item xs={4}>
                      <Chip icon={<Link />} label="Link" size="small" variant="outlined" />
                    </Grid>
                  </Grid>
                </CardContent>
                <CardActions>
                  <ButtonGroup size="small">
                    <Button startIcon={<Api />}>API</Button>
                    <Button startIcon={<Build />}>Build</Button>
                    <Button startIcon={<Publish />}>Publish</Button>
                  </ButtonGroup>
                </CardActions>
              </Card>

              {/* Cloud Actions */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <Tooltip title="Upload"><IconButton><CloudUpload /></IconButton></Tooltip>
                <Tooltip title="Download"><IconButton><CloudDownload /></IconButton></Tooltip>
                <Tooltip title="Sync"><IconButton><CloudSync /></IconButton></Tooltip>
                <Tooltip title="Queue"><IconButton><CloudQueue /></IconButton></Tooltip>
              </Box>

              {/* Visibility & Favorites */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton><Visibility /></IconButton>
                <IconButton><VisibilityOff /></IconButton>
                <IconButton><Favorite color="error" /></IconButton>
                <IconButton><FavoriteBorder /></IconButton>
                <IconButton><Star color="warning" /></IconButton>
                <IconButton><StarBorder /></IconButton>
              </Box>

              {/* Control Buttons */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <Tooltip title="Play"><IconButton color="success"><PlayCircleOutline /></IconButton></Tooltip>
                <Tooltip title="Pause"><IconButton color="warning"><PauseCircleOutline /></IconButton></Tooltip>
                <Tooltip title="Stop"><IconButton color="error"><StopCircle /></IconButton></Tooltip>
              </Box>

              {/* Search & Filter Bar */}
              <Box mt={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Search Presets</InputLabel>
                  <Select
                    value={filterFormat}
                    onChange={(e) => setFilterFormat(e.target.value)}
                    label="Search Presets"
                    startAdornment={
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    }
                  >
                    <MenuItem value="all">All Formats</MenuItem>
                    <MenuItem value="images">Images</MenuItem>
                    <MenuItem value="videos">Videos</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* View & Sort Controls */}
              <Box mt={2} display="flex" justifyContent="space-between">
                <ButtonGroup size="small" variant="outlined">
                  <Button startIcon={<ViewList />}>List</Button>
                  <Button startIcon={<ViewModule />}>Grid</Button>
                  <Button startIcon={<ViewComfy />}>Compact</Button>
                </ButtonGroup>
                <ButtonGroup size="small" variant="outlined">
                  <Button startIcon={<Sort />}>Sort</Button>
                  <Button startIcon={<FilterList />}>Filter</Button>
                </ButtonGroup>
              </Box>

              {/* Statistics Bar */}
              <Box mt={2} display="flex" gap={2} justifyContent="center">
                <Chip icon={<BarChart />} label="Analytics" size="small" />
                <Chip icon={<PieChart />} label="Distribution" size="small" />
                <Chip icon={<ShowChart />} label="Trends" size="small" />
              </Box>

              {/* Status Icons */}
              <Box mt={2} display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                <Tooltip title="Sync"><Sync color="primary" /></Tooltip>
                <Tooltip title="Sync Problem"><SyncProblem color="warning" /></Tooltip>
                <Tooltip title="Cloud Off"><CloudOff color="disabled" /></Tooltip>
                <Tooltip title="Cloud Done"><CloudDone color="success" /></Tooltip>
                <Tooltip title="Queue"><Queue color="info" /></Tooltip>
                <Tooltip title="Refresh"><Refresh color="action" /></Tooltip>
              </Box>

              {/* Category Icons */}
              <Box mt={2} display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                <Tooltip title="Flag"><Flag fontSize="small" /></Tooltip>
                <Tooltip title="Public"><Public fontSize="small" /></Tooltip>
                <Tooltip title="Book"><Book fontSize="small" /></Tooltip>
                <Tooltip title="School"><School fontSize="small" /></Tooltip>
                <Tooltip title="Work"><Work fontSize="small" /></Tooltip>
                <Tooltip title="Home"><Home fontSize="small" /></Tooltip>
                <Tooltip title="Person"><Person fontSize="small" /></Tooltip>
                <Tooltip title="Group"><Group fontSize="small" /></Tooltip>
                <Tooltip title="Private"><PublicOff fontSize="small" /></Tooltip>
              </Box>

              {/* Additional Controls */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton size="small"><Add /></IconButton>
                <IconButton size="small"><Remove /></IconButton>
                <IconButton size="small"><Edit /></IconButton>
                <IconButton size="small"><Delete /></IconButton>
                <IconButton size="small"><Upload /></IconButton>
                <IconButton size="small"><Download /></IconButton>
              </Box>

              {/* Expand/Collapse Controls */}
              <Box mt={2} display="flex" gap={1} justifyContent="center">
                <IconButton size="small"><KeyboardArrowUp /></IconButton>
                <IconButton size="small"><KeyboardArrowDown /></IconButton>
                <IconButton size="small"><ExpandMore /></IconButton>
                <IconButton size="small"><ExpandLess /></IconButton>
              </Box>

              {/* Status Indicators */}
              <Box mt={2} display="flex" gap={2} justifyContent="center">
                <CheckCircle color="success" />
                <Info color="info" />
                <Warning color="warning" />
                <Error color="error" />
              </Box>
            </Box>
          )}
          
          {activeTab === 5 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Export Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enablePresets}
                        onChange={(e) => updateConfig({ enablePresets: e.target.checked })}
                      />
                  }
                    label="Enable Presets"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enablePlatforms}
                        onChange={(e) => updateConfig({ enablePlatforms: e.target.checked })}
                      />
                  }
                    label="Enable Platforms"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableFormats}
                        onChange={(e) => updateConfig({ enableFormats: e.target.checked })}
                      />
                  }
                    label="Enable Formats"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableOptimization}
                        onChange={(e) => updateConfig({ enableOptimization: e.target.checked })}
                      />
                  }
                    label="Enable Optimization"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableCompression}
                        onChange={(e) => updateConfig({ enableCompression: e.target.checked })}
                      />
                  }
                    label="Enable Compression"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableValidation}
                        onChange={(e) => updateConfig({ enableValidation: e.target.checked })}
                      />
                  }
                    label="Enable Validation"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enablePreview}
                        onChange={(e) => updateConfig({ enablePreview: e.target.checked })}
                      />
                  }
                    label="Enable Preview"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableBatch}
                        onChange={(e) => updateConfig({ enableBatch: e.target.checked })}
                      />
                  }
                    label="Enable Batch Export"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableScheduling}
                        onChange={(e) => updateConfig({ enableScheduling: e.target.checked })}
                      />
                  }
                    label="Enable Scheduling"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableCloud}
                        onChange={(e) => updateConfig({ enableCloud: e.target.checked })}
                      />
                  }
                    label="Enable Cloud Export"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            Close
          </Button>
          <Button onClick={handleCreatePreset}
            variant="contained"
            startIcon={theming.getThemedIcon('add')}
            sx={theming.getThemedButtonSx()}>
            Create Preset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Export Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePresets}
                    onChange={(e) => updateConfig({ enablePresets: e.target.checked })}
                  />
              }
                label="Enable Presets"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePlatforms}
                    onChange={(e) => updateConfig({ enablePlatforms: e.target.checked })}
                  />
              }
                label="Enable Platforms"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableFormats}
                    onChange={(e) => updateConfig({ enableFormats: e.target.checked })}
                  />
              }
                label="Enable Formats"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableOptimization}
                    onChange={(e) => updateConfig({ enableOptimization: e.target.checked })}
                  />
              }
                label="Enable Optimization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCompression}
                    onChange={(e) => updateConfig({ enableCompression: e.target.checked })}
                  />
              }
                label="Enable Compression"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableValidation}
                    onChange={(e) => updateConfig({ enableValidation: e.target.checked })}
                  />
              }
                label="Enable Validation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePreview}
                    onChange={(e) => updateConfig({ enablePreview: e.target.checked })}
                  />
              }
                label="Enable Preview"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBatch}
                    onChange={(e) => updateConfig({ enableBatch: e.target.checked })}
                  />
              }
                label="Enable Batch Export"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableScheduling}
                    onChange={(e) => updateConfig({ enableScheduling: e.target.checked })}
                  />
              }
                label="Enable Scheduling"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCloud}
                    onChange={(e) => updateConfig({ enableCloud: e.target.checked })}
                  />
              }
                label="Enable Cloud Export"
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

ExportPresetsDashboard.displayName ='ExportPresetsDashboard';

export default ExportPresetsDashboard;





