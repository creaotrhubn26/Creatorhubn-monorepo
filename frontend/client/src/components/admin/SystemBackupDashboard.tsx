import React, { useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  LinearProgress,
  Tooltip,
  Paper,
  Divider,
  Stack,
  ThemeProvider,
} from '@mui/material';
import { adminDarkTheme } from './adminDarkTheme';
import Grid from '@mui/material/Grid2';
import {
  Backup as BackupIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { formatBytes, formatDate } from '@/lib/utils';
import {
  AdminButton,
  AdminLoading,
  AdminEmpty,
  AdminError,
  useIsMobile,
} from './design-system';
import { useTheming } from '../../utils/theming-helper';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface SystemBackup {
  id: string;
  description: string;
  timestamp: string;
  size: number;
  type: 'SYSTEM' | 'PROJECT' | 'DATABASE';
  success: boolean;
  downloadUrl?: string;
  files: string[];
}

interface BackupStats {
  totalBackups: number;
  totalSize: number;
  successfulBackups: number;
  failedBackups: number;
  lastBackup?: SystemBackup;
  averageSize: number;
}

interface FolderStructure {
  name: string;
  type: 'directory' | 'file';
  path: string;
  children?: FolderStructure[];
}

interface BackupOptions {
  includeDatabase: boolean;
  includeUploads: boolean;
  includeProjectFiles: boolean;
  includeSettings: boolean;
  includeWireMockData: boolean;
  description: string;
}

interface NotificationPayload {
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

interface SystemBackupDashboardProps {
  onMeetingCreate?: (meeting: unknown) => void;
  onProjectUpdate?: (project: unknown) => void;
  onWorklogCreate?: (worklog: unknown) => void;
  onClientSelect?: (client: unknown) => void;
  onClientUpdate?: (client: unknown) => void;
  onShowcaseCreate?: (showcase: unknown) => void;
  onFileUpload?: (file: unknown) => void;
  onFileDownload?: (file: unknown) => void;
  selectedProject?: unknown;
  onProjectSelect?: (project: unknown) => void;
  selectedClient?: unknown;
  onSettingsUpdate?: (settings: unknown) => void;
  onNotificationCreate?: (notification: NotificationPayload) => void;
}

function defaultBackupOptions(): BackupOptions {
  return {
    includeDatabase: false,
    includeUploads: true,
    includeProjectFiles: true,
    includeSettings: true,
    includeWireMockData: true,
    description: '',
  };
}

export default function SystemBackupDashboard(props: SystemBackupDashboardProps) {
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester');
  const { auth } = useEnhancedMasterIntegration();
  const isMobile = useIsMobile();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [backupOptions, setBackupOptions] = useState<BackupOptions>(defaultBackupOptions);

  const connectedIntegrationCount = useMemo(
    () =>
      [
        props.onMeetingCreate,
        props.onProjectUpdate,
        props.onWorklogCreate,
        props.onClientSelect,
        props.onClientUpdate,
        props.onShowcaseCreate,
        props.onFileUpload,
        props.onFileDownload,
        props.onProjectSelect,
        props.onSettingsUpdate,
      ].filter(Boolean).length,
    [props],
  );

  const notify = (type: NotificationPayload['type'], message: string) => {
    props.onNotificationCreate?.({
      type,
      message,
      timestamp: new Date().toISOString(),
    });
  };

  const {
    data: backupsData,
    isLoading: backupsLoading,
    refetch: refetchBackups,
  } = useQuery<SystemBackup[]>({
    queryKey: ['/api/system-backup/list'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/system-backup/list', { headers });
    },
    refetchInterval: 30000,
  });

  const backups = Array.isArray(backupsData) ? backupsData : [];

  const { data: stats, isLoading: statsLoading } = useQuery<BackupStats>({
    queryKey: ['/api/system-backup/stats'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/system-backup/stats', { headers });
    },
    refetchInterval: 30000,
  });

  const { data: folderStructure, isLoading: folderLoading } = useQuery<FolderStructure>({
    queryKey: ['/api/system-backup/folder-structure'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/system-backup/folder-structure', { headers });
    },
    enabled: folderDialogOpen,
  });

  const createBackupMutation = useMutation({
    mutationFn: async (options: BackupOptions) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/system-backup/create-system-backup', {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(options),
      });
    },
    onSuccess: () => {
      setCreateDialogOpen(false);
      setBackupOptions((prev) => ({ ...prev, description: '' }));
      refetchBackups();
      queryClient.invalidateQueries({ queryKey: ['/api/system-backup/stats'] });
      notify('success', 'System-backup opprettet.');
    },
    onError: () => {
      notify('error', 'Klarte ikke å opprette system-backup.');
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/system-backup/delete/${backupId}`, {
        headers,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      refetchBackups();
      queryClient.invalidateQueries({ queryKey: ['/api/system-backup/stats'] });
      notify('success', 'Backup slettet.');
    },
    onError: () => {
      notify('error', 'Sletting av backup feilet.');
    },
  });

  const handleCreateBackup = () => {
    createBackupMutation.mutate(backupOptions);
  };

  const handleDownload = (backup: SystemBackup) => {
    if (!backup.downloadUrl) {
      notify('info', 'Ingen nedlastingslenke er tilgjengelig for denne backupen.');
      return;
    }

    window.open(backup.downloadUrl, '_blank', 'noopener,noreferrer');
    notify('success', `Starter nedlasting av backup: ${backup.description}`);
  };

  const renderFolderStructure = (item: FolderStructure, depth = 0): React.ReactNode => (
    <Box key={item.path} sx={{ ml: depth * 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
        {item.type === 'directory' ? (
          <FolderIcon sx={{ mr: 1, color: 'primary.main' }} />
        ) : (
          <DescriptionIcon sx={{ mr: 1, color: 'text.secondary' }} />
        )}
        <Typography variant="body2">{item.name}</Typography>
      </Box>
      {item.children?.map((child) => renderFolderStructure(child, depth + 1))}
    </Box>
  );

  return (
    <ThemeProvider theme={adminDarkTheme}>
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h2" gutterBottom sx={{ color: theming.colors.primary }}>
            💾 System Backup Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Integrasjoner koblet: {connectedIntegrationCount}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <AdminButton
            tone="secondary"
            startIcon={<FolderIcon />}
            onClick={() => setFolderDialogOpen(true)}
          >
            Vis Mappestruktur
          </AdminButton>
          <AdminButton
            tone="primary"
            startIcon={<BackupIcon />}
            onClick={() => setCreateDialogOpen(true)}
            loading={createBackupMutation.isPending}
          >
            Opprett System Backup
          </AdminButton>
        </Stack>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ArchiveIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Totale Backups
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : stats?.totalBackups ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StorageIcon sx={{ mr: 2, color: 'info.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Størrelse
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : formatBytes(stats?.totalSize ?? 0)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircleIcon sx={{ mr: 2, color: 'success.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Vellykkede
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : stats?.successfulBackups ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ mr: 2, color: 'warning.main' }} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Siste Backup
                  </Typography>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {statsLoading
                      ? '-'
                      : stats?.lastBackup
                        ? formatDate(stats.lastBackup.timestamp)
                        : 'Ingen'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={theming.getThemedCardSx()}>
        <CardHeader
          title="System Backups"
          action={
            <IconButton onClick={() => refetchBackups()} aria-label="Oppdater backup-liste">
              <RefreshIcon />
            </IconButton>
          }
        />
        <CardContent sx={theming.getThemedCardSx()}>
          {backupsLoading ? (
            <AdminLoading />
          ) : backups.length === 0 ? (
            <AdminEmpty
              title="Ingen system-backups funnet"
              description="Opprett din første backup."
            />
          ) : (
            <List>
              {backups.map((backup, index) => (
                <React.Fragment key={backup.id}>
                  <ListItem>
                    <ListItemIcon>
                      {backup.success ? (
                        <CheckCircleIcon color="success" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">{backup.description}</Typography>
                          <Chip
                            label={backup.type}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(backup.timestamp)} • {formatBytes(backup.size)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Filer: {(Array.isArray(backup.files) ? backup.files : []).join(', ')}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Last ned backup">
                          <span>
                            <IconButton
                              onClick={() => handleDownload(backup)}
                              disabled={!backup.success}
                              aria-label="Last ned backup"
                            >
                              <DownloadIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Slett backup">
                          <IconButton
                            onClick={() => deleteBackupMutation.mutate(backup.id)}
                            color="error"
                            aria-label="Slett backup"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < backups.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Opprett System Backup</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Beskrivelse"
            value={backupOptions.description}
            onChange={(event) =>
              setBackupOptions((prev) => ({ ...prev, description: event.target.value }))
            }
            sx={{ mb: 2, mt: 1 }}
            placeholder="f.eks. Pre-deployment backup"
          />

          <Typography variant="h6" component="h3" gutterBottom sx={{ color: theming.colors.primary }}>
            Inkluder i backup:
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeProjectFiles}
                onChange={(event) =>
                  setBackupOptions((prev) => ({
                    ...prev,
                    includeProjectFiles: event.target.checked,
                  }))
                }
              />
            }
            label="Prosjektfiler (client, server, shared)"
          />

          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeUploads}
                onChange={(event) =>
                  setBackupOptions((prev) => ({
                    ...prev,
                    includeUploads: event.target.checked,
                  }))
                }
              />
            }
            label="Opplastede filer"
          />

          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeDatabase}
                onChange={(event) =>
                  setBackupOptions((prev) => ({
                    ...prev,
                    includeDatabase: event.target.checked,
                  }))
                }
              />
            }
            label="Database (schema og data)"
          />

          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeSettings}
                onChange={(event) =>
                  setBackupOptions((prev) => ({
                    ...prev,
                    includeSettings: event.target.checked,
                  }))
                }
              />
            }
            label="Konfigurasjonsfiler"
          />

          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeWireMockData}
                onChange={(event) =>
                  setBackupOptions((prev) => ({
                    ...prev,
                    includeWireMockData: event.target.checked,
                  }))
                }
              />
            }
            label="WireMock-data og mock-endpoints"
          />

          {createBackupMutation.isPending && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Oppretter system-backup...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setCreateDialogOpen(false)}>
            Avbryt
          </AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleCreateBackup}
            loading={createBackupMutation.isPending}
          >
            Opprett Backup
          </AdminButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={folderDialogOpen}
        onClose={() => setFolderDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Mappestruktur Oversikt</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, maxHeight: 600, overflow: 'auto', ...theming.getThemedCardSx() }}>
            {folderLoading ? (
              <AdminLoading />
            ) : folderStructure ? (
              renderFolderStructure(folderStructure)
            ) : (
              <AdminError message="Kunne ikke laste mappestruktur" />
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setFolderDialogOpen(false)}>
            Lukk
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
    </ThemeProvider>
  );
}
