import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Button,
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
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Paper,
  Divider,
  Stack
} from '@mui/material';
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
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Archive as ArchiveIcon,
  Computer as ComputerIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { formatBytes, formatDate } from '@/lib/utils';

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

interface SystemBackupDashboardProps {
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
}

export default function SystemBackupDashboard({
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onSettingsUpdate,
  onNotificationCreate
}: SystemBackupDashboardProps) {
  const queryClient = useQueryClient();

  // Theming system
  const theming = useTheming('prototype_tester');

  // Get auth from master integration
  const { auth } = useEnhancedMasterIntegration();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [backupOptions, setBackupOptions] = useState({
    includeDatabase: false,
    includeUploads: true,
    includeProjectFiles: true,
    includeSettings: true,
    includeWireMockData: true,
    description: ''
});

  // Fetch system backups
  const { data: backups = [], isLoading: backupsLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['/api/system-backup/list'],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/system-backup/list', { headers });
  },
    refetchInterval: 30000 });

  // Fetch backup statistics
  const { data: stats, isLoading: statsLoading } = useQuery<BackupStats>({
    queryKey: ['/api/system-backup/stats'],
    refetchInterval: 30000 });

  // Fetch folder structure
  const { data: folderStructure, isLoading: folderLoading } = useQuery<FolderStructure>({
    queryKey: ['/api/system-backup/folder-structure'],
    enabled: folderDialogOpen
});

  // Create system backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async (options: any) => {
      const headers = await auth.getAuthHeader();
      return apiRequest('/api/system-backup/create-system-backup', {
        headers: {
          ...headers,
          'Content-Type': 'application/json'
      },
        method: 'POST',
        body: JSON.stringify(options)
    });
  },
    onSuccess: () => {
      setCreateDialogOpen(false);
      setBackupOptions(prev => ({ ...prev, description: '' }));
      refetchBackups();
      queryClient.invalidateQueries({ queryKey: ['/api/system-backup/stats'] });
  }
});

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const response = await fetch(`/api/system-backup/delete/${backupd}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'DELETE'
  });
      if (!response.ok) throw new Error('Sletting feilet');
      return response.json();
  },
    onSuccess: () => {
      refetchBackups();
      queryClient.invalidateQueries({ queryKey: ['/api/system-backup/stats'] });
  }
});

  const handleCreateBackup = () => {
    createBackupMutation.mutate(backupOptions);
};

  const handleDownload = (backup: SystemBackup) => {
    if (backup.downloadUrl) {
      window.open(backup.downloadUrl, '_blank');
    }
  };

  const renderFolderStructure = (item: FolderStructure, depth = 0) => {
    return (
      <Box key={item.path} sx={{ ml: depth * 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5}}>
          {item.type === 'directory' ? (
            <FolderIcon sx={{ mr: 1, color: 'primary.main'}} />
          ) : (
            <DescriptionIcon sx={{ mr: 1, color: 'text.secondary'}} />
          )}
          <Typography variant="body2">{item.name}</Typography>
        </Box>
        {item.children && item.children.map(child => 
          renderFolderStructure(child, depth + 1)
        )}
      </Box>
    );
};

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ mb:  3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          💾 System Backup Dashboard
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<FolderIcon />}
            onClick={() => setFolderDialogOpen(true)}
          >
            Vis Mappestruktur
          </Button>
          <Button variant="contained"
            startIcon={<BackupIcon />}
            onClick={() => setCreateDialogOpen(true)}
            disabled={createBackupMutation.isPending}
          >
            Opprett System Backup
          </Button>
        </Stack>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb:  3 }}>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center'}}>
                <ArchiveIcon sx={{ mr: 2, color: 'primary.main'}} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Totale Backups
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : stats?.totalBackups || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center'}}>
                <StorageIcon sx={{ mr: 2, color: 'info.main'}} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Størrelse
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : formatBytes(stats?.totalSize || 0)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center'}}>
                <CheckCircleIcon sx={{ mr: 2, color: 'success.main'}} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Vellykkede
                  </Typography>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : stats?.successfulBackups || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Box sx={{ display: 'flex', alignItems: 'center'}}>
                <ScheduleIcon sx={{ mr: 2, color: 'warning.main'}} />
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Siste Backup
                  </Typography>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {statsLoading ? '-' : stats?.lastBackup ? 
                      formatDate(stats.lastBackup.timestamp) : 'Ingen'
                  }
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Backup List */}
      <Card sx={theming.getThemedCardSx()}>
        <CardHeader
          title="System Backups"
          action={
            <IconButton onClick={() => refetchBackups()} sx={theming.getThemedCardSx()}>
              <RefreshIcon />
            </IconButton>
          }
        />
        <CardContent sx={theming.getThemedCardSx()}>
          {backupsLoading ? (
            <LinearProgress />
          ) : backups.length === 0 ? (
            <Alert severity="info">
              Ingen system backups funnet. Opprett din første backup.
            </Alert>
          ) : (
            <List>
              {backups.map((backup: SystemBackup, index: number) => (
                <React.Fragment key={backup.d}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Typography variant="subtitle1">
                            {backup.description}
                          </Typography>
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
                            Filer: {backup.files.join(', ')}
                          </Typography>
                        </Box>
                    }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Last ned backup">
                          <IconButton
                            onClick={() => handleDownload(backup)}
                            disabled={!backup.success}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Slett backup">
                          <IconButton
                            onClick={() => deleteBackupMutation.mutate(backup.id)}
                            color="error"
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

      {/* Create Backup Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Opprett System Backup</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Beskrivelse"
            value={backupOptions.description}
            onChange={(e) => setBackupOptions(prev => ({ ...prev, description: e.target.value }))}
            sx={{ mb: 2, mt: 1 }}
            placeholder="f.eks. Pre-deployment backup"
          />
          
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Inkluder i backup: </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeProjectFiles}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeProjectFiles: e.target.checked }))}
              />
          }
            label="Prosjektfiler (client, server, shared)"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeUploads}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeUploads: e.target.checked }))}
              />
          }
            label="Opplastede filer"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeDatabase}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeDatabase: e.target.checked }))}
              />
          }
            label="Database (schema og data)"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeSettings}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeSettings: e.target.checked }))}
              />
          }
            label="Konfigurasjonsfiler"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={backupOptions.includeWireMockData}
                onChange={(e) => setBackupOptions(prev => ({ ...prev, includeWireMockData: e.target.checked }))}
              />
          }
            label="WireMock-data og mock-endpoints"
          />

          {createBackupMutation.isPending && (
            <Box sx={{ mt:  2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                Oppretter system backup...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreateBackup}
            variant="contained"
            disabled={createBackupMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            Opprett Backup
          </Button>
        </DialogActions>
      </Dialog>

      {/* Folder Structure Dialog */}
      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Mappestruktur Oversikt</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, maxHeight: 600, overflow: 'auto', ...theming.getThemedCardSx() }}>
            {folderLoading ? (
              <LinearProgress />
            ) : folderStructure ? (
              renderFolderStructure(folderStructure)
            ) : (
              <Alert severity="error">
                Kunne ikke laste mappestruktur
              </Alert>
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}