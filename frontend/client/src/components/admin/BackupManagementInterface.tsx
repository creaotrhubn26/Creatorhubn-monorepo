import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Card as MuiCard,
  CardContent,
  Typography,
  Box,
  Grid,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import {
  Cloud as CloudIcon,
  CloudUpload as CloudUploadIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Notifications as NotificationsIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminCard, AdminButton, StatusChip, AdminLoading, AdminEmpty, useIsMobile } from './design-system';

interface BackupItem {
  id: string;
  description: string;
  timestamp: string;
  size: number;
  driveUrl?: string;
  success: boolean;
  type: 'PRIMARY' | 'SECONDARY';
}

interface BackupNotification {
  id: string;
  type: 'backup_started' | 'backup_completed' | 'backup_failed' | 'redundant_backup_completed';
  timestamp: string;
  message: string;
  details?: Record<string, unknown>;
}

interface CreateBackupOptions {
  description: string;
  redundant: boolean;
  uploads: boolean;
  database: boolean;
  aiModels: boolean;
  projectFiles: boolean;
}

export default function BackupManagementInterface() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Fetch backup list
  const {
    data: backups = [],
    isLoading: backupsLoading,
    refetch: refetchBackups,
  } = useQuery<BackupItem[]>({
    queryKey: ['/api/backup/list'],
    queryFn: async () => {
      const response = await fetch('/api/backup/list');
      if (!response.ok) {
        throw new Error('Kunne ikke hente backup-liste');
      }
      const json = await response.json();
      return (Array.isArray(json) ? json : []) as BackupItem[];
    },
    refetchInterval: 3000, // Refresh every 30 seconds
  });

  // Fetch backup notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery<BackupNotification[]>({
    queryKey: ['/api/backup/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/backup/notifications');
      if (!response.ok) {
        throw new Error('Kunne ikke hente backup-notifikasjoner');
      }
      const json = await response.json();
      return (Array.isArray(json) ? json : []) as BackupNotification[];
    },
    refetchInterval: 1000, // Refresh every 10 seconds
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async (options: CreateBackupOptions) => {
      const response = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(options),
      });
      if (!response.ok) throw new Error('Backup feilet');
      return response.json();
    },
    onSuccess: () => {
      setCreateDialogOpen(false);
      setBackupDescription('');
      refetchBackups();
      refetchNotifications();
    },
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [backupDescription, setBackupDescription] = useState('');
  const [redundantBackup, setRedundantBackup] = useState(true);
  const [includeOptions, setIncludeOptions] = useState({
    uploads: true,
    database: false, // Disabled for stability
    aiModels: true,
    projectFiles: true,
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const response = await fetch(`/api/backup/delete/${backupId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Sletting feilet');
      return response.json();
    },
    onSuccess: () => {
      refetchBackups();
    },
  });

  const handleCreateBackup = () => {
    createBackupMutation.mutate({
      description: backupDescription || 'Manuel backup fra admin interface',
      redundant: redundantBackup,
      ...includeOptions,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes','KB','MB','GB','TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('no-NO');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'backup_completed':
      case 'redundant_backup_completed':
        return <CheckCircleIcon color="success" />;
      case 'backup_failed':
        return <ErrorIcon color="error" />;
      case 'backup_started':
        return <CloudUploadIcon color="info" />;
      default:
        return <NotificationsIcon />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h4"
        component="h2"
        gutterBottom
        sx={{ display: 'flex', alignItems: 'center', gap: 2, color: theming.colors.primary }}
      >
        <SecurityIcon color="primary" />
        Backup Management - Daniel Drive Integration
      </Typography>

      {/* Status Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CloudIcon color="primary" />
                <Box>
                  <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                    Google Drive
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    daniel@creatorhubn.com
                  </Typography>
                  <StatusChip tone="success" label="Tilkoblet" />
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <StorageIcon color="secondary" />
                <Box>
                  <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                    Totale Backups
                  </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {backups.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <MuiCard>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SecurityIcon color="success" />
                <Box>
                  <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
                    Redundant Backup
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    2x Sikkerhet Aktivert
                  </Typography>
                  <StatusChip tone="success" label="Beskyttet" />
                </Box>
              </Box>
            </CardContent>
          </MuiCard>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <AdminButton
          tone="primary"
          startIcon={<CloudUploadIcon />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={createBackupMutation.isPending}
          size="large"
        >
          Opprett Backup
        </AdminButton>
        <AdminButton
          tone="secondary"
          startIcon={<RefreshIcon />}
          onClick={() => {
            refetchBackups();
            refetchNotifications();
          }}
        >
          Oppdater
        </AdminButton>
      </Box>

      {/* Notifications */}
      {notifications.length > 0 && (
        <AdminCard title="Backup Notifikasjoner" sx={{ mb: 4 }}>
            <List>
              {notifications.slice(0, 5).map((notification: BackupNotification) => (
                <ListItem key={notification.id}>
                  <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
                  <ListItemText
                    primary={notification.message}
                    secondary={formatTimestamp(notification.timestamp)}
                  />
                </ListItem>
              ))}
            </List>
        </AdminCard>
      )}

      {/* Zero Toast Compliance - Backup Progress as Typography */}
      {createBackupMutation.isPending && (
        <Box sx={{ mb: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ color: theming.colors.primary }}
            >
              Backup pågår...
            </Typography>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="body2" sx={{ color: 'info.contrastText' }}>
            {redundantBackup ? 'Oppretter redundant backup (2x sikkerhet)' : 'Oppretter backup'}
          </Typography>
        </Box>
      )}

      {/* Backup List */}
      <AdminCard
        title="Backup Historie"
        action={
          <Typography variant="body2" color="text.secondary" sx={theming.getThemedCardSx()}>
            {backups.length} backups totalt
          </Typography>
        }
      >
          {backupsLoading ? (
            <AdminLoading />
          ) : backups.length === 0 ? (
            <AdminEmpty title="Ingen backups funnet" />
          ) : (
            <List>
              {backups.map((backup: BackupItem, index: number) => (
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="subtitle1">{backup.description}</Typography>
                          <Chip
                            label={backup.type}
                            size="small"
                            color={backup.type === 'PRIMARY' ? 'primary': 'secondary'}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {formatTimestamp(backup.timestamp)} • {formatFileSize(backup.size)}
                          </Typography>
                          {backup.driveUrl && (
                            <Typography
                              variant="body2"
                              color="primary"
                              component="a"
                              href={backup.driveUrl}
                              target="_blank"
                              rel="noopener"
                            >
                              Se i Google Drive
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {backup.driveUrl && (
                        <IconButton
                          size="small"
                          onClick={() => window.open(backup.driveUrl, '_blank')}
                          title="Åpne i Google Drive"
                          aria-label="Åpne i Google Drive"
                        >
                          <DownloadIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => deleteBackupMutation.mutate(backup.id)}
                        disabled={deleteBackupMutation.isPending}
                        title="Slett backup"
                        aria-label="Slett backup"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                  {index < backups.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
      </AdminCard>

      {/* Create Backup Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Opprett Ny Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Backup Beskrivelse"
              value={backupDescription}
              onChange={(e) => setBackupDescription(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="F.eks: Backup før nye funksjoner"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={redundantBackup}
                  onChange={(e) => setRedundantBackup(e.target.checked)}
                  color="primary"
                />
              }
              label="Redundant Backup (2x sikkerhet)"
              sx={{ mb: 2 }}
            />

            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Inkluder i backup:
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={includeOptions.uploads}
                  onChange={(e) =>
                    setIncludeOptions((prev) => ({
                      ...prev,
                      uploads: e.target.checked,
                    }))
                  }
                />
              }
              label="Opplastede filer"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={includeOptions.aiModels}
                  onChange={(e) =>
                    setIncludeOptions((prev) => ({
                      ...prev,
                      aiModels: e.target.checked,
                    }))
                  }
                />
              }
              label="AI Modeller"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={includeOptions.projectFiles}
                  onChange={(e) =>
                    setIncludeOptions((prev) => ({
                      ...prev,
                      projectFiles: e.target.checked,
                    }))
                  }
                />
              }
              label="Prosjektfiler"
            />

            <Typography
              variant="body2"
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'info.light',
                borderRadius: 1,
                color: 'info.contrastText'}}
            >
              Database backup er deaktivert for stabilitet. Kun filbaserte backups opprettes.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <AdminButton tone="ghost" onClick={() => setCreateDialogOpen(false)}>Avbryt</AdminButton>
          <AdminButton
            tone="primary"
            onClick={handleCreateBackup}
            loading={createBackupMutation.isPending}
            disabled={createBackupMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            Opprett Backup
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
