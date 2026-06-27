/**
 * File Management System Test Panel for Admin Dashboard
 * Testing and monitoring file upload/download functionality with Google Drive/Photos integration
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid2,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Google as GoogleIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useCommunicationStatus } from '../../contexts/CommunicationStatusContext';
import { useFileManagementStatus } from '../../contexts/FileManagementStatusContext';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { StatusChip } from './design-system';

interface FileManagementTestPanelProps {
  onNotificationCreate?: (notification: {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    source: string;
    timestamp: string;
  }) => void;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'testing';

interface HealthResult {
  ok: boolean;
  status: number;
  message: string;
  payload?: unknown;
}

function statusColor(status: ConnectionStatus): 'success' | 'warning' | 'error' {
  if (status === 'connected') {
    return 'success';
  }
  if (status === 'testing') {
    return 'warning';
  }
  return 'error';
}

function statusIcon(status: ConnectionStatus) {
  if (status === 'connected') {
    return <CloudDoneIcon fontSize="small" />;
  }
  if (status === 'testing') {
    return <SyncIcon fontSize="small" />;
  }
  return <CloudOffIcon fontSize="small" />;
}

export default function FileManagementTestPanel({ onNotificationCreate }: FileManagementTestPanelProps) {
  const { user } = useAuth();
  const { status: communicationStatus } = useCommunicationStatus();
  const { status: fileManagementStatus, updateStatus: updateFileStatus } = useFileManagementStatus();
  const { analytics, communication, lifecycle, performance } = useEnhancedMasterIntegration();
  const theming = useTheming('prototype_tester');

  const [activeTab, setActiveTab] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [googleDriveStatus, setGoogleDriveStatus] = useState<ConnectionStatus>('testing');
  const [googlePhotosStatus, setGooglePhotosStatus] = useState<ConnectionStatus>('testing');
  const [googleDriveResponse, setGoogleDriveResponse] = useState('Pending test');
  const [googlePhotosResponse, setGooglePhotosResponse] = useState('Pending test');
  const [operations, setOperations] = useState<string[]>([]);

  const addOperation = useCallback((message: string) => {
    setOperations((prev) => [`${new Date().toLocaleTimeString('nb-NO')} - ${message}`, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    lifecycle.registerComponent({
      id: 'file-management-test-panel',
      type: 'admin-panel',
      version: '1.0.0',
      capabilities: {
        data: ['file:upload', 'file:download', 'file:health', 'file:status'],
        events: ['file:test:start', 'file:test:complete', 'file:test:error'],
        actions: ['file:test:execute', 'file:monitor:start', 'file:monitor:stop'],
        ui: ['file:status:display', 'file:results:show'],
        system: ['file:health:check', 'file:google:test'],
      },
      dependencies: ['communication-status-context', 'auth-system'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0,
      },
    });

    analytics.trackEvent('file_management_test_panel_mounted', {
      userId: user?.email || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    return () => {
      lifecycle.unregisterComponent('file-management-test-panel');
      analytics.trackEvent('file_management_test_panel_unmounted', {
        userId: user?.email || 'anonymous',
        timestamp: new Date().toISOString(),
      });
    };
  }, [analytics, lifecycle, user?.email]);

  const runEndpointCheck = useCallback(
    async (endpoint: string, label: 'Google Drive' | 'Google Photos'): Promise<HealthResult> => {
      const endTiming = performance.startTiming(`file_management_${label.toLowerCase().replace(' ', '_')}_test`);
      const headers = user?.email ? { 'x-user-email': user.email } : undefined;

      try {
        addOperation(`${label}: test started`);
        communication?.sendBroadcast?.(
          'file:test:start',
          {
            type: label,
            userId: user?.email || 'anonymous',
            timestamp: new Date().toISOString(),
          },
          'high',
        );

        const response = await fetch(endpoint, {
          method: 'GET',
          credentials: 'include',
          headers,
        });
        const payload = await response.json().catch(() => null);
        const ok = response.status === 200;
        const message = ok ? '200 OK' : `HTTP ${response.status}`;

        endTiming();

        communication?.sendBroadcast?.(
          'file:test:complete',
          {
            type: label,
            ok,
            status: response.status,
            timestamp: new Date().toISOString(),
          },
          'high',
        );

        analytics.trackEvent('file_management_connectivity_test_completed', {
          provider: label,
          ok,
          status: response.status,
          userId: user?.email || 'anonymous',
        });

        return {
          ok,
          status: response.status,
          message,
          payload,
        };
      } catch (error) {
        endTiming();
        const message = error instanceof Error ? error.message : 'Unknown error';
        communication?.sendBroadcast?.(
          'file:test:error',
          {
            type: label,
            error: message,
            timestamp: new Date().toISOString(),
          },
          'high',
        );

        analytics.trackEvent('file_management_connectivity_test_failed', {
          provider: label,
          error: message,
          userId: user?.email || 'anonymous',
        });

        return {
          ok: false,
          status: 0,
          message,
        };
      }
    },
    [addOperation, analytics, communication, performance, user?.email],
  );

  const testGoogleDrive = useCallback(async () => {
    setGoogleDriveStatus('testing');
    const result = await runEndpointCheck('/api/file-management/google-drive/status', 'Google Drive');
    setGoogleDriveStatus(result.ok ? 'connected' : 'disconnected');
    setGoogleDriveResponse(result.message);

    updateFileStatus({
      googleDriveStatus: result.ok ? 'connected' : 'disconnected',
      googleDriveResponse: result.message,
      googleDriveLastCheck: new Date(),
    });

    addOperation(`Google Drive: ${result.message}`);
  }, [addOperation, runEndpointCheck, updateFileStatus]);

  const testGooglePhotos = useCallback(async () => {
    setGooglePhotosStatus('testing');
    const result = await runEndpointCheck('/api/file-management/google-photos/status', 'Google Photos');
    setGooglePhotosStatus(result.ok ? 'connected' : 'disconnected');
    setGooglePhotosResponse(result.message);

    updateFileStatus({
      googlePhotosStatus: result.ok ? 'connected' : 'disconnected',
      googlePhotosResponse: result.message,
      googlePhotosLastCheck: new Date(),
    });

    addOperation(`Google Photos: ${result.message}`);
  }, [addOperation, runEndpointCheck, updateFileStatus]);

  const runAllTests = useCallback(async () => {
    setIsRunning(true);
    await Promise.all([testGoogleDrive(), testGooglePhotos()]);
    setIsRunning(false);

    const allConnected = googleDriveStatus === 'connected' && googlePhotosStatus === 'connected';
    onNotificationCreate?.({
      id: `file-management-test-${Date.now()}`,
      type: allConnected ? 'success' : 'error',
      title: 'File Management Test',
      message: allConnected
        ? 'Google Drive og Google Photos er tilkoblet.'
        : 'Minst én filintegrasjon feilet under test.',
      priority: allConnected ? 'low' : 'high',
      source: 'file_management_test',
      timestamp: new Date().toISOString(),
    });
  }, [googleDriveStatus, googlePhotosStatus, onNotificationCreate, testGoogleDrive, testGooglePhotos]);

  const { data: uploadStats } = useQuery({
    queryKey: ['/api/file-management/uploads/stats', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/file-management/uploads/stats', { credentials: 'include' });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    refetchInterval: 30_000,
  });

  const { data: downloadStats } = useQuery({
    queryKey: ['/api/file-management/downloads/stats', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/file-management/downloads/stats', { credentials: 'include' });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    refetchInterval: 30_000,
  });

  const summaryText = useMemo(() => {
    const drive = googleDriveStatus === 'connected' ? 'Drive OK' : 'Drive feil';
    const photos = googlePhotosStatus === 'connected' ? 'Photos OK' : 'Photos feil';
    return `${drive} • ${photos}`;
  }, [googleDriveStatus, googlePhotosStatus]);

  return (
    <Card sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            File Management Test Panel
          </Typography>
          <Button
            variant="contained"
            startIcon={isRunning ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={() => {
              void runAllTests();
            }}
            disabled={isRunning}
            sx={theming.getThemedButtonSx()}
          >
            {isRunning ? 'Kjører tester...' : 'Kjør alle tester'}
          </Button>
        </Box>

        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
          <Tab label="Oversikt" />
          <Tab label="Integrasjoner" />
          <Tab label="Operasjoner" />
        </Tabs>

        {activeTab === 0 && (
          <Grid2 container spacing={2}>
            <Grid2 size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Communication Status
                  </Typography>
                  <Chip label={String(communicationStatus)} size="small" />
                </CardContent>
              </Card>
            </Grid2>
            <Grid2 size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    File Management Status
                  </Typography>
                  <Typography variant="body2">{summaryText}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Context status: {String(fileManagementStatus)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid2>
            <Grid2 size={{ xs: 12, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Throughput (30s poll)
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip icon={<UploadIcon />} label={`Uploads: ${uploadStats?.total ?? 0}`} size="small" />
                    <Chip icon={<DownloadIcon />} label={`Downloads: ${downloadStats?.total ?? 0}`} size="small" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid2>
          </Grid2>
        )}

        {activeTab === 1 && (
          <List>
            <ListItem
              secondaryAction={
                <Button size="small" onClick={() => void testGoogleDrive()} startIcon={<GoogleIcon />}>
                  Test
                </Button>
              }
            >
              <ListItemIcon>{statusIcon(googleDriveStatus)}</ListItemIcon>
              <ListItemText primary="Google Drive" secondary={googleDriveResponse} />
              <StatusChip tone={statusColor(googleDriveStatus)} label={googleDriveStatus} />
            </ListItem>
            <Divider component="li" />
            <ListItem
              secondaryAction={
                <Button size="small" onClick={() => void testGooglePhotos()} startIcon={<GoogleIcon />}>
                  Test
                </Button>
              }
            >
              <ListItemIcon>{statusIcon(googlePhotosStatus)}</ListItemIcon>
              <ListItemText primary="Google Photos" secondary={googlePhotosResponse} />
              <StatusChip tone={statusColor(googlePhotosStatus)} label={googlePhotosStatus} />
            </ListItem>
          </List>
        )}

        {activeTab === 2 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Operasjonslogg for filintegrasjoner og testkjøringer.
            </Alert>
            <PaperLog operations={operations} />
          </Box>
        )}

        {!isRunning && googleDriveStatus === 'connected' && googlePhotosStatus === 'connected' && (
          <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mt: 2 }}>
            Alle filintegrasjonstester er grønne.
          </Alert>
        )}

        {!isRunning && (googleDriveStatus === 'disconnected' || googlePhotosStatus === 'disconnected') && (
          <Alert icon={<ErrorIcon />} severity="warning" sx={{ mt: 2 }}>
            Minst én integrasjon er frakoblet. Kjør test på nytt eller sjekk credentials/endpoint.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function PaperLog({ operations }: { operations: string[] }) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        maxHeight: 320,
        overflow: 'auto',
      }}
    >
      {operations.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Ingen operasjoner logget ennå.
        </Typography>
      ) : (
        <List dense>
          {operations.map((entry) => (
            <ListItem key={entry}>
              <ListItemIcon>
                <StorageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={entry} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
