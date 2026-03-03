/**
 * Notification System Test Center
 * Interactive harness for upload/project/system notification flows.
 */

import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Folder as ProjectIcon,
  Notifications as NotificationIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import {
  triggerProjectCreated,
  triggerProjectShared,
  triggerSyncComplete,
  triggerUploadComplete,
  triggerUploadError,
  triggerUploadNotification,
  triggerUploadProgress,
} from './NotificationSystem';

interface NotificationTestSettings {
  fileName: string;
  fileCount: number;
  projectName: string;
  projectId: string;
  shareCode: string;
}

interface TestHistoryItem {
  id: string;
  type: string;
  createdAt: string;
  payload: unknown;
}

interface NotificationTestApiResponse {
  history?: TestHistoryItem[];
}

function toHistory(payload: unknown): TestHistoryItem[] {
  if (typeof payload !== 'object' || payload === null) {
    return [];
  }
  const candidate = payload as NotificationTestApiResponse;
  if (!Array.isArray(candidate.history)) {
    return [];
  }
  return candidate.history.filter((entry): entry is TestHistoryItem => {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as TestHistoryItem).id === 'string' &&
      typeof (entry as TestHistoryItem).type === 'string' &&
      typeof (entry as TestHistoryItem).createdAt === 'string'
    );
  });
}

function randomCode(length: number): string {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

export default function NotificationTestCenter() {
  const queryClient = useQueryClient();
  const theming = useTheming('photographer');

  const [settings, setSettings] = useState<NotificationTestSettings>({
    fileName: 'test_upload.zip',
    fileCount: 1,
    projectName: 'Test Project',
    projectId: `test-${Date.now()}`,
    shareCode: `TEST${randomCode(4)}`,
  });
  const [isUploading, setIsUploading] = useState(false);

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['/api/notifications/test-history'],
    queryFn: async () => {
      const payload = await apiRequest('/api/notifications/test-history');
      return toHistory(payload);
    },
    retry: false,
  });

  const logNotificationTest = useMutation({
    mutationFn: async (payload: { type: string; payload: unknown }) => {
      return apiRequest('/api/notifications/log-test', {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/test-history'] });
    },
  });

  const updateSettings = <K extends keyof NotificationTestSettings>(
    key: K,
    value: NotificationTestSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const simulateFileUpload = async () => {
    setIsUploading(true);
    const fileId = `upload_${Date.now()}`;

    triggerUploadNotification({
      fileId,
      fileName: settings.fileName,
      fileCount: settings.fileCount,
    });
    await logNotificationTest.mutateAsync({
      type: 'upload_started',
      payload: { fileId, ...settings },
    });

    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      triggerUploadProgress({
        fileId,
        fileName: settings.fileName,
        progress,
      });
    }

    triggerUploadComplete({
      fileId,
      fileName: settings.fileName,
      fileCount: settings.fileCount,
      projectId: settings.projectId,
      folderUrl: `https://drive.google.com/drive/folders/${settings.projectId}`,
    });
    await logNotificationTest.mutateAsync({
      type: 'upload_completed',
      payload: { fileId, ...settings },
    });

    setIsUploading(false);
  };

  const simulateUploadError = async () => {
    const fileId = `upload_error_${Date.now()}`;
    const error = 'Nettverksfeil - prov igjen senere';
    triggerUploadError({
      fileId,
      fileName: settings.fileName,
      error,
    });
    await logNotificationTest.mutateAsync({
      type: 'upload_error',
      payload: { fileId, fileName: settings.fileName, error },
    });
  };

  const simulateProjectCreation = async () => {
    triggerProjectCreated({
      projectName: settings.projectName,
      projectId: settings.projectId,
      folderUrl: `https://drive.google.com/drive/folders/${settings.projectId}`,
    });
    await logNotificationTest.mutateAsync({
      type: 'project_created',
      payload: settings,
    });
  };

  const simulateProjectSharing = async () => {
    triggerProjectShared({
      projectName: settings.projectName,
      shareCode: settings.shareCode,
    });
    await logNotificationTest.mutateAsync({
      type: 'project_shared',
      payload: settings,
    });
  };

  const simulateSync = async () => {
    triggerSyncComplete({
      projectCount: 5,
      syncedCount: 4,
    });
    await logNotificationTest.mutateAsync({
      type: 'sync_complete',
      payload: { projectCount: 5, syncedCount: 4 },
    });
  };

  const sendServerTestNotification = async (type: 'success' | 'error' | 'warning' | 'info') => {
    await apiRequest('/api/notifications/test', {
      method: 'POST',
      body: {
        type,
        title: `${type.toUpperCase()} test`,
        message: `Server-side ${type}-notifikasjon fra NotificationTestCenter`,
      },
    });
    await logNotificationTest.mutateAsync({
      type: `server_${type}`,
      payload: { title: `${type.toUpperCase()} test` },
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
        Notifikasjonssystem Demo
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Kjor komplette testflyter for opplasting, prosjekt og systemsynk.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Demo innstillinger
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="Filnavn"
                  value={settings.fileName}
                  onChange={(event) => updateSettings('fileName', event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Antall filer"
                  type="number"
                  value={settings.fileCount}
                  onChange={(event) =>
                    updateSettings('fileCount', Math.max(1, Number(event.target.value || 1)))
                  }
                  fullWidth
                />
                <TextField
                  label="Prosjektnavn"
                  value={settings.projectName}
                  onChange={(event) => updateSettings('projectName', event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Delingskode"
                  value={settings.shareCode}
                  onChange={(event) => updateSettings('shareCode', event.target.value)}
                  fullWidth
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <UploadIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Upload-flyt
              </Typography>
              <Stack spacing={1.5}>
                <Button
                  variant="contained"
                  disabled={isUploading}
                  onClick={() => void simulateFileUpload()}
                  startIcon={isUploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
                >
                  {isUploading ? 'Simulerer opplasting...' : 'Simuler opplasting'}
                </Button>
                <Button variant="outlined" color="error" onClick={() => void simulateUploadError()}>
                  Simuler opplastingsfeil
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ProjectIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Prosjekt-hendelser
              </Typography>
              <Stack spacing={1.5}>
                <Button variant="contained" onClick={() => void simulateProjectCreation()}>
                  Prosjekt opprettet
                </Button>
                <Button variant="outlined" onClick={() => void simulateProjectSharing()}>
                  Prosjekt delt
                </Button>
                <Button variant="outlined" onClick={() => void simulateSync()} startIcon={<SyncIcon />}>
                  Synk fullfort
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <NotificationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Server testnotifikasjoner
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button size="small" variant="outlined" color="success" onClick={() => void sendServerTestNotification('success')}>
                  Success
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => void sendServerTestNotification('error')}>
                  Error
                </Button>
                <Button size="small" variant="outlined" color="warning" onClick={() => void sendServerTestNotification('warning')}>
                  Warning
                </Button>
                <Button size="small" variant="outlined" color="info" onClick={() => void sendServerTestNotification('info')}>
                  Info
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Testhistorikk
              </Typography>
              {loadingHistory ? (
                <CircularProgress size={20} />
              ) : (
                <Stack spacing={1}>
                  {history.slice(0, 8).map((entry) => (
                    <Box
                      key={entry.id}
                      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Chip size="small" label={entry.type} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.createdAt).toLocaleString('nb-NO')}
                      </Typography>
                    </Box>
                  ))}
                  {history.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Ingen testhistorikk registrert.
                    </Typography>
                  ) : null}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

