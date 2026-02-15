/**
 * ExportDashboard Component
 * Export dashboard with multiple formats and compression
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
  Download,
  Upload,
  FileDownload,
  FileUpload,
  Code,
  Image,
  VideoFile as Video,
  AudioFile as Audio,
  Description,
  Archive,
  DataObject,
  Settings,
  Refresh,
  CheckCircle,
  Error,
  Info,
  Warning,
  Compress as CompressIcon,
  Lock as EncryptIcon,
  Tune as OptimizeIcon,
  Layers as BundleIcon,
  FilterAlt as TreeShakeIcon,
  CallSplit as SplitIcon,
  Map as SourceMapIcon,
  LinearScale as ProgressiveIcon,
  Cached as CacheIcon,
  Language as CDNIcon,
  History as VersionIcon,
  Backup,
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
  Public as Globe,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Public as PublicOn,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Queue,
  BarChart,
  PieChart,
  ShowChart
} from '@mui/icons-material';
import { useExport, UseExportOptions } from '../../../hooks/useExport';
import { ExportConfig, ExportFormat, ExportOptions, ExportResult } from '../../../utils/exportManager';

interface ExportDashboardProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showHistory?: boolean;
  showFormats?: boolean;
  showOptions?: boolean;
  showProgress?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onHistoryClick?: () => void;
  onFormatsClick?: () => void;
  onOptionsClick?: () => void;
  onProgressClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const ExportDashboard: React.FC<ExportDashboardProps> = memo(({
  showDetails = true,
  showSettings = true,
  showHistory = true,
  showFormats = true,
  showOptions = true,
  showProgress = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onHistoryClick,
  onFormatsClick,
  onOptionsClick,
  onProgressClick,
  className,
  style
}) => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showFormatsDialog, setShowFormatsDialog] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('javascript');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'javascript',
    compression: true,
    optimization: true,
    minification: true,
    bundling: true,
    treeShaking: true,
    codeSplitting: true,
    sourceMaps: true,
    progressiveLoading: true,
    caching: true,
    cdn: false,
    versioning: true,
    backup: true
});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportPipelineStep, setExportPipelineStep] = useState(0);

  // Export options
  const exportHookOptions: UseExportOptions = useMemo(() => ({
    onExportCompleted: (_result: ExportResult) => {
      setIsExporting(false);
      setExportProgress(100);
      setFilterType('all');
      setPage(0);
},
    onExportFailed: (_result: ExportResult) => {
      setIsExporting(false);
      setExportProgress(0);
      setPage(0);
},
    onExportStarted: (_options: ExportOptions) => {
      setIsExporting(true);
      setExportProgress(0);
      setExportPipelineStep(0);
},
    onExportProgress: (progress: number) => {
      setExportProgress(progress);
},
    onError: (error: string) => {
      console.error('Export error:', error);
  },
    onInitialized: () => {
      setFilterType('all');
      setPage(0);
}
}), []);

  // Use export hook
  const {
    export: exportData,
    getSupportedFormats,
    getExportHistory,
    getActiveExports,
    state,
    config,
    updateConfig,
    isEnabled,
    isInitialized,
    hasError,
    error,
    currentExport,
    exportQueue,
    exportHistory,
    supportedFormats,
    activeExports,
    lastExport,
    totalExports,
    successfulExports,
    failedExports,
    totalSize,
    compressedSize,
    compressionRatio,
    averageProcessingTime,
    averageOptimizationTime,
    averageCompressionTime,
    averageEncryptionTime,
    averageValidationTime,
    averageBundlingTime,
    averageTreeShakingTime,
    averageCodeSplittingTime,
    averageSourceMapTime,
    averageProgressiveLoadingTime,
    averageCachingTime,
    averageCdnTime,
    averageVersioningTime,
    averageBackupTime
} = useExport(exportHookOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle history click
  const handleHistoryClick = useCallback(() => {
    if (onHistoryClick) {
      onHistoryClick();
  } else {
      setShowHistoryDialog(true);
  }
}, [onHistoryClick]);

  // Handle formats click
  const handleFormatsClick = useCallback(() => {
    if (onFormatsClick) {
      onFormatsClick();
  } else {
      setShowFormatsDialog(true);
  }
}, [onFormatsClick]);

  // Handle options click
  const handleOptionsClick = useCallback(() => {
    if (onOptionsClick) {
      onOptionsClick();
  } else {
      setShowOptionsDialog(true);
  }
}, [onOptionsClick]);

  // Handle progress click
  const handleProgressClick = useCallback(() => {
    if (onProgressClick) {
      onProgressClick();
  } else {
      setShowProgressDialog(true);
  }
}, [onProgressClick]);

  // Handle export
  const handleExport = useCallback(async () => {
    try {
      const data = { timestamp: Date.now(),};
      await exportData(data, exportOptions);
  } catch (error) {
      console.error('Export failed: ', error);
  }
}, [exportData, exportOptions]);

  // Handle format change
  const handleFormatChange = useCallback((format: string) => {
    setSelectedFormat(format);
    setExportOptions(prev => ({ ...prev, format }));
}, []);

  // Handle option change
  const handleOptionChange = useCallback((option: keyof ExportOptions, value: boolean) => {
    setExportOptions(prev => ({ ...prev, [option]: value }));
}, []);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (isExporting) return 'info';
    if (!isInitialized) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isExporting, isInitialized, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (hasError) return <Error color="error" />;
    if (isExporting) return <CircularProgress size={16} />;
    if (!isInitialized) return <Warning color="warning" />;
    if (isEnabled) return <CheckCircle color="success" />;
    return <FileDownload />;
}, [hasError, isExporting, isInitialized, isEnabled]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (isExporting) return 'Exporting...';
    if (!isInitialized) return 'Initializing...';
    if (isEnabled) return 'Ready';
    return 'Disabled';
}, [hasError, isExporting, isInitialized, isEnabled]);

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
    <Tooltip title={`Export: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={totalExports}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowExportDialog(true)}
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
            {totalExports} exports
          </Typography>
          {isExporting && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              {exportProgress}%
            </Typography>
          )}
          {compressionRatio > 0 && (
            <Typography variant="caption" color="success.main" sx={{ ml:  1 }}>
              {compressionRatio.toFixed(1)}% compressed
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
          <Download color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Export
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('download')}
            onClick={handleExport}
            disabled={isExporting}
            variant="outlined"
            size="small"
          >
            Export
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
                Total Exports
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {totalExports}
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
                {totalExports > 0 ? ((successfulExports / totalExports) * 100).toFixed(1) : 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Compression
              </Typography>
              <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                {compressionRatio.toFixed(1)}%
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
      
      {isExporting && (
        <Box mt={2}>
          <LinearProgress variant="determinate" value={exportProgress} />
          <Typography variant="caption" color="text.secondary">
            Exporting... {exportProgress}%
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

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('download')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Export Dashboard</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="Formats" />
            <Tab label="Options" />
            <Tab label="History" />
            <Tab label="Progress" />
          </Tabs>
          
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt:  2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Total Exports
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {totalExports}
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
                      {totalExports > 0 ? ((successfulExports / totalExports) * 100).toFixed(1) : 0}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle2" gutterBottom>
                      Compression
                    </Typography>
                    <Typography variant="h4" color="info.main" sx={{ color: theming.colors.primary }}>
                      {compressionRatio.toFixed(1)}%
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
                Supported Formats
              </Typography>
              <Grid container spacing={2}>
                {supportedFormats.map((format) => (
                  <Grid item xs={12} sm={6} md={4} key={format.id}>
                    <Card
                      sx={{ 
                        cursor: 'pointer',
                        border: selectedFormat === format.id ? 2 : 1,
                        borderColor: selectedFormat === format.id ? 'primary.main' : 'divider'
                  }}
                      onClick={() => handleFormatChange(format.id)}
                    >
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          {String(format.category).includes('code') && <Code />}
                          {String(format.category).includes('image') && <Image />}
                          {String(format.category).includes('video') && <Video />}
                          {String(format.category).includes('audio') && <Audio />}
                          {String(format.category).includes('document') && <Description />}
                          {String(format.category).includes('archive') && <Archive />}
                          {String(format.category).includes('data') && <DataObject />}
                          <Typography variant="subtitle2">
                            {format.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {format.description}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          {format.compression && <Chip label="Compression" size="small" />}
                          {format.optimization && <Chip label="Optimization" size="small" />}
                          {format.minification && <Chip label="Minification" size="small" />}
                          {format.bundling && <Chip label="Bundling" size="small" />}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Export Options
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.compression}
                        onChange={(e) => handleOptionChange('compression', e.target.checked)}
                      />
                  }
                    label="Compression"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.optimization}
                        onChange={(e) => handleOptionChange('optimization', e.target.checked)}
                      />
                  }
                    label="Optimization"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.minification}
                        onChange={(e) => handleOptionChange('minification', e.target.checked)}
                      />
                  }
                    label="Minification"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.bundling}
                        onChange={(e) => handleOptionChange('bundling', e.target.checked)}
                      />
                  }
                    label="Bundling"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.treeShaking}
                        onChange={(e) => handleOptionChange('treeShaking', e.target.checked)}
                      />
                  }
                    label="Tree Shaking"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.codeSplitting}
                        onChange={(e) => handleOptionChange('codeSplitting', e.target.checked)}
                      />
                  }
                    label="Code Splitting"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.sourceMaps}
                        onChange={(e) => handleOptionChange('sourceMaps', e.target.checked)}
                      />
                  }
                    label="Source Maps"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.progressiveLoading}
                        onChange={(e) => handleOptionChange('progressiveLoading', e.target.checked)}
                      />
                  }
                    label="Progressive Loading"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.caching}
                        onChange={(e) => handleOptionChange('caching', e.target.checked)}
                      />
                  }
                    label="Caching"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.cdn}
                        onChange={(e) => handleOptionChange('cdn', e.target.checked)}
                      />
                  }
                    label="CDN"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.versioning}
                        onChange={(e) => handleOptionChange('versioning', e.target.checked)}
                      />
                  }
                    label="Versioning"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportOptions.backup}
                        onChange={(e) => handleOptionChange('backup', e.target.checked)}
                      />
                  }
                    label="Backup"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Export History
              </Typography>
              <List>
                {exportHistory.slice(0, 10).map((exportResult) => (
                  <ListItem key={exportResult.id}>
                    <ListItemAvatar>
                      <Avatar>
                        <FileDownload />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${exportResult.format} export`}
                      secondary={`${new Date(exportResult.metadata.timestamp).toLocaleString()} • ${exportResult.size} bytes`}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={exportResult.success ? 'Success' : 'Failed'}
                        size="small"
                        color={exportResult.success ? 'success' : 'error'}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {activeTab === 4 && (
            <Box sx={{ mt:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Export Progress
              </Typography>
              {isExporting ? (
                <Box>
                  <LinearProgress variant="determinate" value={exportProgress} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                    Exporting... {exportProgress}%
                  </Typography>
                </Box>
              ) : (
                <Typography color="text.secondary">
                  No active exports
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />
              
              {hasError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <AlertTitle>Export Error</AlertTitle>
                  {error || 'An error occurred during export'}
                </Alert>
              )}

              {/* Advanced Export Settings with Stepper */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">Advanced Export Pipeline</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stepper activeStep={isExporting ? exportPipelineStep : 0} orientation="vertical">
                    <Step>
                      <StepButton onClick={() => setExportPipelineStep(0)}>
                        <StepLabel>Prepare Data</StepLabel>
                      </StepButton>
                      <StepContent>
                        <Box display="flex" alignItems="center" gap={1}>
                          <BundleIcon fontSize="small" />
                          <Typography variant="body2">Bundling assets...</Typography>
                        </Box>
                      </StepContent>
                    </Step>
                    <Step>
                      <StepButton onClick={() => setExportPipelineStep(1)}>
                        <StepLabel>Optimize</StepLabel>
                      </StepButton>
                      <StepContent>
                        <Box display="flex" alignItems="center" gap={1}>
                          <OptimizeIcon fontSize="small" />
                          <Typography variant="body2">Optimizing output...</Typography>
                        </Box>
                      </StepContent>
                    </Step>
                    <Step>
                      <StepButton onClick={() => setExportPipelineStep(2)}>
                        <StepLabel>Compress</StepLabel>
                      </StepButton>
                      <StepContent>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CompressIcon fontSize="small" />
                          <Typography variant="body2">Compressing files...</Typography>
                        </Box>
                      </StepContent>
                    </Step>
                  </Stepper>
                </AccordionDetails>
              </Accordion>

              {/* Export Queue Table */}
              <TableContainer sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Queue fontSize="small" />
                          Queue
                        </Box>
                      </TableCell>
                      <TableCell>Format</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Size</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {exportQueue.slice(0, 5).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>{item.format}</TableCell>
                        <TableCell>
                          <Badge color="info" variant="dot" />
                          Pending
                        </TableCell>
                        <TableCell align="right">{item.size || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {exportQueue.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No items in queue
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={exportQueue.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />

              {/* Quick Actions */}
              <Card sx={{ mt: 2, ...theming.getThemedCardSx() }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <BarChart fontSize="small" />
                    <Typography variant="subtitle2">Export Statistics</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PieChart fontSize="small" color="primary" />
                        <Typography variant="body2">{successfulExports} Successful</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <ShowChart fontSize="small" color="warning" />
                        <Typography variant="body2">{failedExports} Failed</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Sync fontSize="small" color="info" />
                        <Typography variant="body2">{activeExports.length} Active</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
                <CardActions>
                  <ButtonGroup variant="outlined" size="small">
                    <Button startIcon={<Refresh />} onClick={() => { setPage(0); setFilterType('all'); setSearchQuery(''); }}>Refresh</Button>
                    <Button startIcon={<FilterList />}>Filter</Button>
                    <Button startIcon={<Sort />}>Sort</Button>
                  </ButtonGroup>
                </CardActions>
              </Card>

              {/* View Mode Selector */}
              <Box display="flex" justifyContent="flex-end" mt={2} gap={1}>
                <Tooltip title="List View">
                  <IconButton size="small"><ViewList /></IconButton>
                </Tooltip>
                <Tooltip title="Module View">
                  <IconButton size="small"><ViewModule /></IconButton>
                </Tooltip>
                <Tooltip title="Compact View">
                  <IconButton size="small"><ViewComfy /></IconButton>
                </Tooltip>
              </Box>

              {/* Advanced Search */}
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Search Exports</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="Search Exports"
                  startAdornment={
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  }
                >
                  <MenuItem value="all">All Exports</MenuItem>
                  <MenuItem value="successful">Successful</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>

              {/* Feature Icons Grid */}
              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>Export Features</Typography>
                <Grid container spacing={1}>
                  {[
                    { icon: <TreeShakeIcon />, label: 'Tree Shake', active: exportOptions.treeShaking },
                    { icon: <SplitIcon />, label: 'Code Split', active: exportOptions.codeSplitting },
                    { icon: <SourceMapIcon />, label: 'Source Maps', active: exportOptions.sourceMaps },
                    { icon: <ProgressiveIcon />, label: 'Progressive', active: exportOptions.progressiveLoading },
                    { icon: <CacheIcon />, label: 'Caching', active: exportOptions.caching },
                    { icon: <CDNIcon />, label: 'CDN', active: exportOptions.cdn },
                    { icon: <VersionIcon />, label: 'Versioning', active: exportOptions.versioning },
                    { icon: <EncryptIcon />, label: 'Security', active: true },
                  ].map((feature, idx) => (
                    <Grid item xs={3} key={idx}>
                      <Chip
                        icon={feature.icon}
                        label={feature.label}
                        size="small"
                        color={feature.active ? 'primary' : 'default'}
                        variant={feature.active ? 'filled' : 'outlined'}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Cloud Status Icons */}
              <Box mt={2} display="flex" gap={2} justifyContent="center">
                {isEnabled ? <CloudDone color="success" /> : <CloudOff color="disabled" />}
                {hasError ? <SyncProblem color="error" /> : <CloudSync color="primary" />}
              </Box>

              {/* Additional Icons Display */}
              <Box mt={2} display="flex" gap={1} flexWrap="wrap" justifyContent="center">
                <Tooltip title="Upload"><Upload fontSize="small" color="action" /></Tooltip>
                <Tooltip title="File Upload"><FileUpload fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Backup"><Backup fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Flag"><Flag fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Global"><Globe fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Documentation"><Book fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Education"><School fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Work"><Work fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Home"><Home fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Person"><Person fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Group"><Group fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Private"><PublicOff fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Public"><PublicOn fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Expand"><KeyboardArrowUp fontSize="small" color="action" /></Tooltip>
                <Tooltip title="Collapse"><ExpandLess fontSize="small" color="action" /></Tooltip>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            Close
          </Button>
          <Button onClick={handleExport}
            disabled={isExporting}
            variant="contained"
            startIcon={theming.getThemedIcon('download')}
           sx={theming.getThemedButtonSx()}>
            Export
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
                    checked={config.enableExport}
                    onChange={(e) => updateConfig({ enableExport: e.target.checked })}
                  />
              }
                label="Enable Export"
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
                    checked={config.enableEncryption}
                    onChange={(e) => updateConfig({ enableEncryption: e.target.checked })}
                  />
              }
                label="Enable Encryption"
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
                    checked={config.enableMinification}
                    onChange={(e) => updateConfig({ enableMinification: e.target.checked })}
                  />
              }
                label="Enable Minification"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBundling}
                    onChange={(e) => updateConfig({ enableBundling: e.target.checked })}
                  />
              }
                label="Enable Bundling"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableTreeShaking}
                    onChange={(e) => updateConfig({ enableTreeShaking: e.target.checked })}
                  />
              }
                label="Enable Tree Shaking"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCodeSplitting}
                    onChange={(e) => updateConfig({ enableCodeSplitting: e.target.checked })}
                  />
              }
                label="Enable Code Splitting"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSourceMaps}
                    onChange={(e) => updateConfig({ enableSourceMaps: e.target.checked })}
                  />
              }
                label="Enable Source Maps"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableProgressiveLoading}
                    onChange={(e) => updateConfig({ enableProgressiveLoading: e.target.checked })}
                  />
              }
                label="Enable Progressive Loading"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCaching}
                    onChange={(e) => updateConfig({ enableCaching: e.target.checked })}
                  />
              }
                label="Enable Caching"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableCDN}
                    onChange={(e) => updateConfig({ enableCDN: e.target.checked })}
                  />
              }
                label="Enable CDN"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableVersioning}
                    onChange={(e) => updateConfig({ enableVersioning: e.target.checked })}
                  />
              }
                label="Enable Versioning"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableBackup}
                    onChange={(e) => updateConfig({ enableBackup: e.target.checked })}
                  />
              }
                label="Enable Backup"
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

ExportDashboard.displayName ='ExportDashboard';

export default ExportDashboard;





