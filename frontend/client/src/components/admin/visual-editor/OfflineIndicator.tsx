/**
 * OfflineIndicator Component
 * Shows offline status and sync information
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
  Divider,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  CardActions,
  Badge,
  Snackbar,
} from '@mui/material';
import {
  WifiOff,
  Wifi,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync,
  Warning,
  CheckCircle,
  Error,
  Info,
  Refresh,
  Settings,
  Storage,
  Queue,
  Delete,
  Download,
  Upload,
} from '@mui/icons-material';
import type { UseOfflineOptions } from '../../../hooks/useOffline';
import { useOffline } from '../../../hooks/useOffline';
import type { OfflineData, SyncResult } from '../../../utils/offlineManager';

interface OfflineIndicatorProps {
  showDetails?: boolean;
  showSyncButton?: boolean;
  showSettings?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  variant?: 'minimal' | 'detailed' | 'full';
  onSyncClick?: () => void;
  onSettingsClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = memo(({
  showDetails = true,
  showSyncButton = true,
  showSettings = true,
  position = 'top-right',
  variant = 'minimal',
  onSyncClick,
  onSettingsClick,
  className,
  style
}) => {
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Offline options
  const offlineOptions: UseOfflineOptions = useMemo(() => ({
    onDataSaved: (data: OfflineData) => {
      setSnackbarMessage(`Data saved offline: ${data.type}`);
      setShowSnackbar(true);
  },
    onDataDeleted: (id: string) => {
      setSnackbarMessage(`Data deleted: ${id}`);
      setShowSnackbar(true);
    },
    onSyncComplete: (result: SyncResult) => {
      setSyncResult(result);
      setSnackbarMessage(`Sync complete: ${result.syncedItems} items synced`);
      setShowSnackbar(true);
  },
    onSyncError: (error: unknown) => {
      const message = error instanceof globalThis.Error ? error.message : 'Unknown error';
      setSnackbarMessage(`Sync error: ${message}`);
      setShowSnackbar(true);
  },
    onOnline: () => {
      setSnackbarMessage('Connection restored');
      setShowSnackbar(true);
},
    onOffline: () => {
      setSnackbarMessage('Connection lost - working offline');
      setShowSnackbar(true);
}
}), []);

  // Use offline hook
  const {
    state,
    saveData,
    getData,
    getAllData,
    getDataByType,
    deleteData,
    syncData,
    clearAllData,
    updateConfig,
    getConfig,
    isOnline,
    isOfflineMode,
    isSyncing,
    hasUnsyncedData,
    offlineDataCount,
    syncQueueSize,
    conflictCount,
    errorCount,
    lastSyncTime
} = useOffline(offlineOptions);

  // Handle sync click
  const handleSyncClick = useCallback(async () => {
    if (onSyncClick) {
      onSyncClick();
  } else {
      setShowSyncDialog(true);
  }
}, [onSyncClick]);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Handle sync
  const handleSync = useCallback(async () => {
    try {
      const result = await syncData();
      setSyncResult(result);
      setShowSyncDialog(false);
  } catch (error) {
      console.error('Sync failed: ', error);
  }
}, [syncData]);

  // Handle clear data
  const handleClearData = useCallback(() => {
    clearAllData();
    setShowSettingsDialog(false);
}, [clearAllData]);

  // Get status color
  const getStatusColor = useCallback((): 'success' | 'info' | 'warning' | 'error' => {
    if (isSyncing) return 'info';
    if (isOfflineMode) return 'warning';
    if (hasUnsyncedData) return 'error';
    return 'success';
}, [isSyncing, isOfflineMode, hasUnsyncedData]);

  // Get status icon
  const getStatusIcon = useCallback((): React.ReactElement => {
    if (isSyncing) return <CloudSync />;
    if (isOfflineMode) return <WifiOff />;
    if (hasUnsyncedData) return <SyncProblem />;
    return <Wifi />;
}, [isSyncing, isOfflineMode, hasUnsyncedData]);

  const getStatusTextColor = useCallback((): 'info.main' | 'warning.main' | 'error.main' | 'success.main' => {
    if (isSyncing) return 'info.main';
    if (isOfflineMode) return 'warning.main';
    if (hasUnsyncedData) return 'error.main';
    return 'success.main';
  }, [hasUnsyncedData, isOfflineMode, isSyncing]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (isSyncing) return 'Syncing...';
    if (isOfflineMode) return 'Offline';
    if (hasUnsyncedData) return 'Unsynced';
    return 'Online';
}, [isSyncing, isOfflineMode, hasUnsyncedData]);

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
    <Tooltip title={getStatusText()}>
      <Chip
        icon={getStatusIcon()}
        label={getStatusText()}
        color={getStatusColor()}
        size="small"
        onClick={showDetails ? handleSyncClick : undefined}
        sx={{ cursor: showDetails ? 'pointer' : 'default'}}
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
        
        {showSyncButton && (
          <IconButton size="small" onClick={handleSyncClick} disabled={isSyncing}>
            {theming.getThemedIcon('refresh')}
          </IconButton>
        )}
        
        {showSettings && (
          <IconButton size="small" onClick={handleSettingsClick}>
            {theming.getThemedIcon('settings')}
          </IconButton>
        )}
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {offlineDataCount} offline items
          </Typography>
          {syncQueueSize > 0 && (
            <Typography variant="caption" color="error.main" sx={{ ml:  1 }}>
              {syncQueueSize} unsynced
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
          {getStatusIcon()}
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            {getStatusText()}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          {showSyncButton && (
            <Button
              startIcon={theming.getThemedIcon('sync')}
              onClick={handleSyncClick}
              disabled={isSyncing}
              size="small"
            >
              Sync
            </Button>
          )}
          
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
                Offline Data
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {offlineDataCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Sync Queue
              </Typography>
              <Typography variant="h4" color={hasUnsyncedData ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                {syncQueueSize}
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
              <Typography
                variant="h4"
                sx={{ color: conflictCount > 0 ? 'warning.main' : 'text.secondary' }}
              >
                {conflictCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Errors
              </Typography>
              <Typography
                variant="h4"
                sx={{ color: errorCount > 0 ? 'error.main' : 'text.secondary' }}
              >
                {errorCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {lastSyncTime > 0 && (
        <Box mt={2}>
          <Typography variant="caption" color="text.secondary">
            Last sync: {new Date(lastSyncTime).toLocaleString()}
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

      {/* Sync Dialog */}
      <Dialog open={showSyncDialog} onClose={() => setShowSyncDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('sync')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Sync Data</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Offline Data
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {offlineDataCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Sync Queue
                  </Typography>
                  <Typography variant="h4" color={hasUnsyncedData ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                    {syncQueueSize}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          {syncResult && (
            <Box mt={2}>
              <Alert severity={syncResult.success ? 'success' : 'error'}>
                <AlertTitle>
                  {syncResult.success ? 'Sync Complete' : 'Sync Failed'}
                </AlertTitle>
                <Typography variant="body2">
                  Synced: {syncResult.syncedItems} | Failed: {syncResult.failedItems} | 
                  Conflicts: {syncResult.conflicts} | Duration: {syncResult.duration.toFixed()}ms
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSyncDialog(false)}>
            Close
          </Button>
          <Button onClick={handleSync}
            disabled={isSyncing || !hasUnsyncedData}
            variant="contained"
            startIcon={theming.getThemedIcon('sync')}
           sx={theming.getThemedButtonSx()}>
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Offline Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Offline Data
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {offlineDataCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="subtitle2" gutterBottom>
                    Sync Queue
                  </Typography>
                  <Typography variant="h4" color={hasUnsyncedData ? 'error' : 'text.secondary'} sx={{ color: theming.colors.primary }}>
                    {syncQueueSize}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Box mt={2}>
            <Button
              onClick={handleClearData}
              variant="outlined"
              color="error"
              startIcon={theming.getThemedIcon('delete')}
              fullWidth
            >
              Clear All Offline Data
            </Button>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
        message={snackbarMessage}
      />
    </>
  );
});

OfflineIndicator.displayName ='OfflineIndicator';

export default OfflineIndicator;



