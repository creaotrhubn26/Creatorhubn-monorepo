import React from 'react';
import {
  Box,
  Chip,
  Badge,
  Tooltip,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  CloudDone as CloudIcon,
  CloudOff as CloudOffIcon,
} from '@mui/icons-material';
import { useWireMockReloadMonitor } from '../../hooks/useWireMockReloadMonitor';
import { toast } from '../../hooks/use-toast';

interface WireMockReloadIndicatorProps {
  pollingInterval?: number;
  showHistory?: boolean;
}

export const WireMockReloadIndicator: React.FC<WireMockReloadIndicatorProps> = ({
  pollingInterval = 5000,
  showHistory = true
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const {
    isConnected,
    lastReload,
    reloadHistory,
    mappingsCount,
    forceReload,
    clearHistory
  } = useWireMockReloadMonitor({
    pollingInterval,
    enabled: true,
    onReload: (event) => {
      // Show toast notification on reload
      if (event.status === 'success') {
        toast({
          title: '🔄 WireMock Mappings Reloaded',
          description: event.message || `${event.mappingsCount} mappings loaded`,
          variant: 'default'
        });
      } else {
        toast({
          title: '❌ WireMock Reload Error',
          description: event.message || 'Failed to reload mappings',
          variant: 'destructive'
        });
      }
    }
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('no-NO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      <Box display="flex" alignItems="center" gap={1}>
        {/* Connection Status Badge */}
        <Tooltip title={isConnected ? 'Connected to WireMock' : 'Disconnected from WireMock'}>
          <Badge
            badgeContent={mappingsCount}
            color={isConnected ? 'success' : 'error'}
            max={999}
          >
            <Chip
              icon={isConnected ? <CloudIcon /> : <CloudOffIcon />}
              label={isConnected ? 'WireMock Live' : 'WireMock Offline'}
              color={isConnected ? 'success' : 'error'}
              size="small"
              onClick={handleClick}
              sx={{ cursor: 'pointer' }}
            />
          </Badge>
        </Tooltip>

        {/* Manual Reload Button */}
        <Tooltip title="Force Reload Mappings">
          <IconButton size="small" onClick={forceReload} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* History Popover */}
      {showHistory && (
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
          }}
        >
          <Box sx={{ p: 2, minWidth: 350, maxWidth: 500 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                🔄 WireMock Reload History
              </Typography>
              <IconButton size="small" onClick={clearHistory}>
                <Typography variant="caption">Clear</Typography>
              </IconButton>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Current Status */}
            <Box sx={{ mb: 2, p: 2, bgcolor: isConnected ? 'success.light' : 'error.light', borderRadius: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </Typography>
              <Typography variant="body2">
                Mappings: {mappingsCount}
              </Typography>
              {lastReload && (
                <Typography variant="caption">
                  Last Update: {formatTime(lastReload.timestamp)}
                </Typography>
              )}
            </Box>

            {/* Reload History */}
            {reloadHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                No reload events yet
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {reloadHistory.map((event, index) => (
                  <ListItem key={index} divider>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {event.status ==='success' ? (
                            <SuccessIcon fontSize="small" color="success" />
                          ) : (
                            <ErrorIcon fontSize="small" color="error" />
                          )}
                          <Typography variant="body2">
                            {event.message || `${event.mappingsCount} mappings`}
                          </Typography>
                        </Box>
                      }
                      secondary={formatTime(event.timestamp)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Popover>
      )}
    </>
  );
};

