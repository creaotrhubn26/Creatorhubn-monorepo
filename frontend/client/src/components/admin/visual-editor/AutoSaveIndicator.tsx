/**
 * AutoSaveIndicator Component
 * Auto-save status indicator with conflict resolution
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect } from 'react';
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
  Save,
  SaveAlt,
  Pause,
  PlayArrow,
  Stop,
  Refresh,
  Settings,
  Warning,
  CheckCircle,
  Error,
  Info,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Backup,
  Restore,
  Conflict,
  Resolve,
  Queue,
  Timeline,
  BarChart,
  PieChart,
  ShowChart,
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
  Globe,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  PublicOn
} from '@mui/icons-material';
import { useAutoSave, UseAutoSaveOptions } from '../../../hooks/useAutoSave';
import { AutoSaveConfig, AutoSaveData } from '../../../utils/autoSaveManager';

interface AutoSaveIndicatorProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showConflicts?: boolean;
  showBackup?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onSettingsClick?: () => void;
  onConflictClick?: () => void;
  onBackupClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = memo(({
  showDetails = true,
  showSettings = true,
  showConflicts = true,
  showBackup = true,
  variant = 'minimal',
  position = 'top-right',
  onSettingsClick,
  onConflictClick,
  onBackupClick,
  className,
  style
}) => {
  const [showAutoSaveDialog, setShowAutoSaveDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showConflictsDialog, setShowConflictsDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [conflicts, setConflicts] = useState<Record<string, unknown>[]>([]);
  const [backups, setBackups] = useState<Record<string, unknown>[]>([]);

  // Auto-save options
  const autoSaveOptions: UseAutoSaveOptions = useMemo(() => ({
    onDataSaved: (_data: AutoSaveData) => {
      console.info('Auto-save: data saved');
},
    onDataQueued: (_data: AutoSaveData) => {
      console.info('Auto-save: data queued');
},
    onConflictDetected: (conflict: Record<string, unknown>) => {
      setConflicts(prev => [...prev, conflict]);
  },
    onConflictResolved: (conflict: Record<string, unknown>) => {
      setConflicts(prev => prev.filter(c => c.id !== conflict.id));
},
    onError: (error: string) => {
      console.error('Auto-save error:', error);
  },
    onPaused: () => {
      console.info('Auto-save: paused');
},
    onResumed: () => {
      console.info('Auto-save: resumed');
},
    onBackupCreated: (data: { timestamp: number }) => {
      setBackups(prev => [...prev, { timestamp: data.timestamp, type: 'created'}]);
  },
    onBackupRestored: (data: { timestamp: number }) => {
      setBackups(prev => [...prev, { timestamp: data.timestamp, type: 'restored'}]);
  },
    onInitialized: () => {
      console.info('Auto-save: initialized');
}
}), []);

  // Use auto-save hook
  const {
    save,
    forceSave,
    pause,
    resume,
    clearQueue,
    restoreFromBackup,
    state,
    config,
    updateConfig,
    isEnabled,
    isSaving,
    isPaused,
    hasError,
    error,
    lastSave,
    nextSave,
    saveCount,
    errorCount,
    conflictCount,
    queueSize,
    currentVersion,
    pendingChanges
} = useAutoSave(autoSaveOptions);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle conflict click
  const handleConflictClick = useCallback(() => {
    if (onConflictClick) {
      onConflictClick();
  } else {
      setShowConflictsDialog(true);
  }
}, [onConflictClick]);

  // Handle backup click
  const handleBackupClick = useCallback(() => {
    if (onBackupClick) {
      onBackupClick();
  } else {
      setShowBackupDialog(true);
  }
}, [onBackupClick]);

  // Handle force save
  const handleForceSave = useCallback(async () => {
    await forceSave();
}, [forceSave]);

  // Handle pause/resume
  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resume();
  } else {
      pause();
  }
}, [isPaused, pause, resume]);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (isSaving) return 'info';
    if (isPaused) return 'warning';
    if (pendingChanges) return 'warning';
    if (isEnabled) return 'success';
    return 'default';
}, [hasError, isSaving, isPaused, pendingChanges, isEnabled]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (isSaving) return <CircularProgress size={16} />;
    if (isPaused) return theming.getThemedIcon('pause');
    if (pendingChanges) return theming.getThemedIcon('sync');
    if (isEnabled) return theming.getThemedIcon('save');
    return theming.getThemedIcon('stop');
}, [hasError, isSaving, isPaused, pendingChanges, isEnabled]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (isSaving) return 'Saving...';
    if (isPaused) return 'Paused';
    if (pendingChanges) return 'Pending';
    if (isEnabled) return 'Auto-save';
    return 'Stopped';
}, [hasError, isSaving, isPaused, pendingChanges, isEnabled]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000};

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)'};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)'};
      default: return { ...baseStyles, top:  16, right: 16};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`Auto-save: ${getStatusText()}`}>
      <Chip
        icon={getStatusIcon()}
        label={queueSize > 0 ? queueSize : ', '}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowAutoSaveDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2}, sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          {getStatusIcon()}
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowAutoSaveDialog(true)}>
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
            {saveCount} saved
          </Typography>
          {queueSize > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ ml:  1 }}>
              {queueSize} queued
            </Typography>
          )}
          {conflictCount > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {conflictCount} conflicts
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3}, sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Save color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Auto-Save
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={theming.getThemedIcon('save')}
            onClick={handleForceSave}
            disabled={isSaving || !pendingChanges}
            variant="outlined"
            size="small"
          >
            Save Now
          </Button>
          
          <IconButton onClick={handlePauseResume}>
            {isPaused ? theming.getThemedIcon('play') : theming.getThemedIcon('pause')}
          </IconButton>
          
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
                Saved
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {saveCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Queue
              </Typography>
              <Typography variant="h4" color={queueSize  sx={{ color: theming.colors.primary }}> 0 ? 'warning' : 'text.secondary'}>
                {queueSize}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Conflicts
              </Typography>
              <Typography variant="h4" color={conflictCount  sx={{ color: theming.colors.primary }}> 0 ? 'error' : 'text.secondary'}>
                {conflictCount}
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
      
      {lastSave > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Last save: {new Date(lastSave).toLocaleString()}
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

      {/* Auto-Save Dialog */}
      <Dialog open={showAutoSaveDialog} onClose={() => setShowAutoSaveDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('save')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Auto-Save Status</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Saved
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {saveCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Queue
                  </Typography>
                  <Typography variant="h4" color={queueSize  sx={{ color: theming.colors.primary }}> 0 ? 'warning' : 'text.secondary'}>
                    {queueSize}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Conflicts
                  </Typography>
                  <Typography variant="h4" color={conflictCount  sx={{ color: theming.colors.primary }}> 0 ? 'error' : 'text.secondary'}>
                    {conflictCount}
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
          
          {hasError && (
            <Box mt={2}>
              <Alert severity="error">
                <AlertTitle>Auto-Save Error</AlertTitle>
                {error}
              </Alert>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowAutoSaveDialog(false)}>
            Close
          </Button>
          <Button onClick={handleForceSave}
            disabled={isSaving || !pendingChanges}
            variant="contained"
            startIcon={theming.getThemedIcon('save')}
           sx={theming.getThemedButtonSx()}>
            Save Now
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Auto-Save Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAutoSave}
                    onChange={(e) => updateConfig({ enableAutoSave: e.target.checked })}
                  />
              }
                label="Enable Auto-Save"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.saveOnBlur}
                    onChange={(e) => updateConfig({ saveOnBlur: e.target.checked })}
                  />
              }
                label="Save on Blur"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.saveOnChange}
                    onChange={(e) => updateConfig({ saveOnChange: e.target.checked })}
                  />
              }
                label="Save on Change"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.saveOnInterval}
                    onChange={(e) => updateConfig({ saveOnInterval: e.target.checked })}
                  />
              }
                label="Save on Interval"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableConflictDetection}
                    onChange={(e) => updateConfig({ enableConflictDetection: e.target.checked })}
                  />
              }
                label="Enable Conflict Detection"
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

AutoSaveIndicator.displayName ='AutoSaveIndicator';

export default AutoSaveIndicator;





