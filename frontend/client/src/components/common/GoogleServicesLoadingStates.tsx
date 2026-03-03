/**
 * Enhanced Loading States for Google Services
 * Provides progressive loading feedback and status indicators.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  CloudDone,
  CloudSync,
  Error as ErrorIcon,
  Refresh,
  Warning,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTheming } from '../../utils/theming-helper';

export interface SyncStatus {
  service: string;
  status: 'idle' | 'loading' | 'syncing' | 'success' | 'error' | 'warning';
  progress?: number;
  message?: string;
  lastSync?: Date;
  itemsProcessed?: number;
  totalItems?: number;
}

interface GoogleServicesLoadingStatesProps {
  syncStatuses: SyncStatus[];
  showDetailedProgress?: boolean;
  compact?: boolean;
}

const getProgressLabel = (status: SyncStatus): string => {
  if (typeof status.progress === 'number') {
    return `${Math.round(status.progress)}%`;
  }

  if (typeof status.itemsProcessed === 'number' && typeof status.totalItems === 'number') {
    return `${status.itemsProcessed}/${status.totalItems}`;
  }

  if (status.message?.trim()) {
    return status.message;
  }

  switch (status.status) {
    case 'loading':
      return 'Initializing';
    case 'syncing':
      return 'Synchronizing';
    case 'success':
      return 'Up to date';
    case 'warning':
      return 'Needs attention';
    case 'error':
      return 'Sync failed';
    default:
      return 'Idle';
  }
};

const formatLastSync = (lastSync?: Date): string => {
  if (!lastSync) {
    return 'Never';
  }

  const now = Date.now();
  const diffMs = now - lastSync.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export const GoogleServicesLoadingStates: React.FC<GoogleServicesLoadingStatesProps> = ({
  syncStatuses,
  showDetailedProgress = true,
  compact = false,
}) => {
  const theme = useTheme();
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
        return <CloudDone fontSize="small" />;
      case 'error':
        return <ErrorIcon fontSize="small" />;
      case 'warning':
        return <Warning fontSize="small" />;
      case 'loading':
      case 'syncing':
        return <CloudSync fontSize="small" />;
      default:
        return <CheckCircle fontSize="small" />;
    }
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {syncStatuses.map((status) => {
          const color = getStatusColor(status.status);
          return (
            <Chip
              key={status.service}
              icon={getStatusIcon(status.status)}
              label={`${status.service}: ${getProgressLabel(status)}`}
              size="small"
              sx={{
                color,
                border: `1px solid ${alpha(color, 0.35)}`,
                backgroundColor: alpha(color, 0.1),
              }}
            />
          );
        })}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {syncStatuses.map((status) => {
        const color = getStatusColor(status.status);
        return (
          <Card key={status.service} variant="outlined" sx={theming.getThemedCardSx()}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, ...theming.getThemedCardSx() }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{getStatusIcon(status.status)}</Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2">{status.service}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getProgressLabel(status)}
                  </Typography>
                  {showDetailedProgress && status.lastSync && (
                    <Typography variant="caption" color="text.secondary">
                      Last sync: {formatLastSync(status.lastSync)}
                    </Typography>
                  )}
                </Box>

                {typeof status.progress === 'number' && (
                  <Box sx={{ width: 120 }}>
                    <LinearProgress
                      variant="determinate"
                      value={status.progress}
                      sx={{
                        height: 6,
                        borderRadius: 4,
                        backgroundColor: alpha(color, 0.2),
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: color,
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.25 }}>
                      {Math.round(status.progress)}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export const useGoogleServicesSyncStatus = () => {
  const [syncStatuses, setSyncStatuses] = React.useState<SyncStatus[]>([]);

  const updateSyncStatus = React.useCallback(
    (service: string, updates: Partial<Omit<SyncStatus, 'service'>>) => {
      setSyncStatuses((previousStatuses) => {
        const index = previousStatuses.findIndex((entry) => entry.service === service);
        if (index === -1) {
          return [...previousStatuses, { service, status: 'idle', ...updates }];
        }

        const nextStatuses = [...previousStatuses];
        nextStatuses[index] = { ...nextStatuses[index], ...updates };
        return nextStatuses;
      });
    },
    [],
  );

  const setSyncStatus = React.useCallback(
    (service: string, status: SyncStatus['status'], message?: string) => {
      updateSyncStatus(service, {
        status,
        message,
        lastSync: status === 'success' ? new Date() : undefined,
      });
    },
    [updateSyncStatus],
  );

  const setSyncProgress = React.useCallback(
    (service: string, progress: number, itemsProcessed?: number, totalItems?: number) => {
      updateSyncStatus(service, {
        status: 'syncing',
        progress,
        itemsProcessed,
        totalItems,
      });
    },
    [updateSyncStatus],
  );

  const clearSyncStatus = React.useCallback((service: string) => {
    setSyncStatuses((previousStatuses) => previousStatuses.filter((entry) => entry.service !== service));
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

interface GoogleServiceOperationLoaderProps {
  service: string;
  operation: string;
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: string;
  onRetry?: () => void;
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
  const theming = useTheming('photographer');

  if (!isLoading && !error) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ mb: 2, ...theming.getThemedCardSx() }}>
      <CardContent sx={{ ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {isLoading ? <CircularProgress size={20} /> : <ErrorIcon color="error" fontSize="small" />}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">
              {service} - {operation}
            </Typography>
            <Typography variant="body2" color={error ? 'error.main' : 'text.secondary'}>
              {error ?? message ?? 'Processing'}
            </Typography>
            {typeof progress === 'number' && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  mt: 0.75,
                  height: 4,
                  borderRadius: 4,
                }}
              />
            )}
          </Box>

          {error && onRetry && (
            <Box
              onClick={onRetry}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRetry();
                }
              }}
              sx={{
                p: 1,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                color: theme.palette.primary.main,
                '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
              }}
            >
              <Refresh fontSize="small" />
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
