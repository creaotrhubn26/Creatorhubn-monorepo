/**
 * Enhanced Loading States for Google Services
 * Provides progressive loading feedback and status indicators
 */

import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  LinearProgress,
  Typography,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  CloudDone,
  CloudSync,
  Error as ErrorIcon,
  Warning,
  CheckCircle,
  Refresh,
} from '@mui/icons-material';

export interface SyncStatus {
  service: string;
  status: 'idle' | 'loading' | 'syncing' | 'success' | 'error' | 'warning';
  progress?: number;
  message?: string;
  lastSync?: Date;
  itemsProcessed?: number;
  totalItems?: number
}

interface GoogleServicesLoadingStatesProps {
  syncStatuses: SyncStatus[];
  showDetailedProgress?: boolean;
  compact?: boolean
}

export const GoogleServicesLoadingStates: React.FC<GoogleServicesLoadingStatesProps> = ({
  syncStatuses,
  showDetailedProgress = true,
  compact = false,
}) => {
  const theme = useTheme();
  
  // Theming system
  const theming = useTheming('photographer');

  const getStatusColor = (status: SyncStatus['status']) => {
    switch (status) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'loading':
      case 'syncing':
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
}
};

  const getStatusIcon = (status: SyncStatus['status']) => {
    switch (status) {
      case 'success':
        return theming.getThemedIcon(', ');
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return theming.getThemedIcon('warning');
      case 'loading':
      case 'syncing':
        return <CloudSync />;
      default: return theming.getThemedIcon(', ');
  }
};

  const formatProgressText = (status: SyncStatus): string => {
    if (status.status === 'syncing' && status.progress !== undefined) {
      return `${Math.round(status.progress)}% complete`;
  }
    
    if (status.itemsProcessed && status.totalItems) {
      return `${status.itemsProcessed} of ${status.totalItems} items`;
  }
    
    if (status.message) {
      return status.message;
  }
    
    switch (status.status) {
      case 'loading':
        return 'Initializing...';
      case 'syncing':
        return 'Synchronizing...';
      case 'success':
        return 'Up to date';
      case 'error':
        return 'Sync failed';
      case 'warning':
        return 'Partial sync';
      default: return 'Ready';
}
};

  const formatLastSync = (lastSync?: Date): string => {
    if (!lastSync) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
};

  if (compact) {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
        {syncStatuses.map((status) => (
          <Chip
            key={status.service}
            icon={getStatusIcon(status.status)}
            label={`${status.service}: ${formatProgressText(status)}`}
            size="small"
            sx={{
              bgcolor: alpha(getStatusColor(status.status), 0.1),
              color: getStatusColor(status.status),
              border: `1px solid ${alpha(getStatusColor(status.status), 0.3)}`}}
          />
        ))}
      </Box>
    );
}

  return (
    <Box sx={{ mb:  2 }}>
      {syncStatuses.map((status) => (
        <Card key={status.service} sx={{ mb:  1 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={{ py:  2 ,  ...theming.getThemedCardSx() }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  color: getStatusColor(status.status),
                  display: 'flex',
                  alignItems: 'center'}}
              >
                {getStatusIcon(status.status)}
              </Box>
              
              <Box sx={{ flex: 1, minWidth:  0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600}>
                  {status.service}
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  {formatProgressText(status)}
                </Typography>
                
                {showDetailedProgress && status.lastSync && (
                  <Typography variant="caption" color="text.secondary">
                    Last sync: {formatLastSync(status.lastSync)}
                  </Typography>
                )}
              </Box>
              
              {status.status === 'syncing' && status.progress !== undefined && (
                <Box sx={{ width: 100}}>
                  <LinearProgress
                    variant="determinate"
                    value={status.progress}
                    sx={{
                      height:  6,
                      borderRadius:  3,
                      bgcolor: alpha(getStatusColor(status.status), 0.1)'& .MuiLinearProgress-bar': {
                        bgcolor: getStatusColor(status.status),
                        borderRadius:  3,
                    }}}
                  />
                  <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', mt: 0.5}}>
                    {Math.round(status.progress)}%
                  </Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

// Hook for managing sync statuses
export const useGoogleServicesSyncStatus = () => {
  const [syncStatuses, setSyncStatuses] = React.useState<SyncStatus[]>([]);

  const updateSyncStatus = React.useCallback((
    service: string,
    updates: Partial<Omit<SyncStatus, 'service'>>
  ) => {
    setSyncStatuses(prev => {
      const existing = prev.find(s => s.service === service);
      if (existing) {
        return prev.map(s => s.service === service ? { ...s, ...updates } : s);
    } else {
        return [...prev, { service, ...updates }];
    }
  });
}, []);

  const setSyncStatus = React.useCallback((service: string, status: SyncStatus['status'], message?: string) => {
    updateSyncStatus(service, {
      status,
      message,
      lastSync: status === 'success' ? new Date() : undefined,
  });
}, [updateSyncStatus]);

  const setSyncProgress = React.useCallback((
    service: string,
    progress: number,
    itemsProcessed?: number,
    totalItems?: number
  ) => {
    updateSyncStatus(service, {
      status: 'syncing',
      progress,
      itemsProcessed,
      totalItems,
  });
}, [updateSyncStatus]);

  const clearSyncStatus = React.useCallback((service: string) => {
    setSyncStatuses(prev => prev.filter(s => s.service !== service));
}, []);

  const clearAllSyncStatuses = React.useCallback(() => {
    setSyncStatuses([]);
}, []);

  return {
    syncStatuses,
    updateSyncStatus,
    setSyncStatus,
    setSyncProgress,
    clearSyncStatus,
    clearAllSyncStatuses,
};
};

// Enhanced loading component for specific operations
interface GoogleServiceOperationLoaderProps {
  service: string;
  operation: string;
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: string;
  onRetry?: () => void
}

export const GoogleServiceOperationLoader: React.FC<GoogleServiceOperationLoaderProps> = ({
  service,
  operation,
  isLoading,
  progress,
  message,
  error,
  onRetry,
}) => {
  const theme = useTheme();

  if (!isLoading && !error) return null;

  return (
    <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack direction="row" spacing={2} alignItems="center">
          {isLoading ? (
            <CircularProgress size={24} />
          ) : (
            <ErrorIcon color="error" />
          )}
          
          <Box sx={{ flex:  1 }}>
            <Typography variant="subtitle2">
              {service} - {operation}
            </Typography>
            
            {error ? (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {message || 'Processing...'}
              </Typography>
            )}
            
            {progress !== undefined && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ mt: 1, height:  4, borderRadius:  2 }}
              />
            )}
          </Box>
          
          {error && onRetry && (
            <Box
              onClick={onRetry}
              sx={{
                cursor: 'pointer',
                p:  1,
                borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1),
              }}}
            >
              {theming.getThemedIcon('refresh')}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
