import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Sync,
  CheckCircle,
  Error as ErrorIcon,
  CloudUpload,
  CloudDownload,
  Folder,
  Schedule,
  Settings,
  PlayArrow,
  Pause,
  Refresh,
} from '@mui/icons-material';

interface GoogleDriveProjectSyncProps {
  userId: string;
  projectId?: string;
  // Integration props for universal workflow connectivity
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface SyncStatus {
  id: string;
  projectName: string;
  status: 'syncing' | 'completed' | 'error' | 'pending';
  progress: number;
  lastSync: string;
  totalFiles: number;
  syncedFiles: number;
  errors: string[]
}

export const GoogleDriveProjectSync: React.FC<GoogleDriveProjectSyncProps> = ({
  userd,
  projectId,
  onFileUpload,
  onFileDownload,
  onProjectUpdate,
  selectedProject,
  onProjectSelect
}) => {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Mock sync status data for demonstration
  

  const startSyncMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // Simulate sync start
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, message: 'Sync started successfully' };
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status', ],});
  }
});

  const getStatusColor = (status: SyncStatus['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'syncing': return 'info';
      case 'error': return 'error';
      default: return 'default';
}
};

  const getStatusIcon = (status: SyncStatus['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle color="success" />;
      case 'syncing': return <Sync sx={{ animation: 'spin 2s linear infinite' }} />;
      case 'error': return <ErrorIcon color="error" />;
      default: return theming.getThemedIcon(', ');
  }
};

  const formatLastSync = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Akkurat nå';
    if (diffMinutes < 60) return `${diffMinutes} min siden`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} timer siden`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dager siden`;
};

  return (
    <MuiCard elevation={2}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <Sync color="primary" />
            Prosjekt Synkronisering
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  size="small"
                />
            }
              label="Auto-sync"
            />
            <IconButton 
              size="small" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['sync-status', ],})}
              title="Oppdater status"
            >
              {theming.getThemedIcon('refresh')}
            </IconButton>
            <Button
              variant="outlined"
              size="small"
              startIcon={theming.getThemedIcon('settings')}
              onClick={() => setSyncDialogOpen(true)}
            >
              Innstillinger
            </Button>
          </Box>
        </Box>

        <List dense>
          {mockSyncStatuses.map((sync) => (
            <ListItem key={sync.id} divider>
              <ListItemIcon>
                {getStatusIcon(sync.status)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" sx={{ fontWeight: 500}}>
                      {sync.projectName}
                    </Typography>
                    <Chip 
                      label={sync.status === 'syncing' ? 'Synkroniserer' : 
                           sync.status === 'completed' ? 'Fullført' :
                           sync.status === 'error' ? 'Feil' : 'Venter'}
                      size="small"
                      color={getStatusColor(sync.status)}
                    />
                  </Box>
              }
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {sync.syncedFiles}/{sync.totalFiles} filer • Sist: {formatLastSync(sync.lastSync)}
                    </Typography>
                    {sync.status === 'syncing' && (
                      <LinearProgress 
                        variant="determinate" 
                        value={sync.progress}
                        sx={{ mt: 0, height: 4, borderRadius: 2 }}
                      />
                    )}
                    {sync.errors.length > 0 && (
                      <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                        <Typography variant="caption">
                          {sync.errors[0]}
                        </Typography>
                      </Alert>
                    )}
                  </Box>
              }
              />
              <ListItemSecondaryAction>
                <IconButton
                  size="small"
                  onClick={() => startSyncMutation.mutate(sync.id)}
                  disabled={sync.status === 'syncing' || startSyncMutation.isPending}
                  title={sync.status === 'syncing' ? 'Synkroniserer...' : 'Start synkronisering'}
                >
                  {sync.status ==='syncing' ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        <Box mt={2} display="flex" gap={1}>
          <Button
            variant="contained"
            size="small"
            startIcon={theming.getThemedIcon('cloudUpload')}
            onClick={() => startSyncMutation.mutate('all')}
            disabled={startSyncMutation.isPending}
            sx={theming.getThemedButtonSx()}
          >
            Sync Alle Prosjekter
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={theming.getThemedIcon('cloudDownload')}
          >
            Bare Nedlasting
          </Button>
        </Box>
      </CardContent>

      {/* Sync Settings Dialog */}
      <Dialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Synkroniseringsinnstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ mt:  1 }}>
            <FormControlLabel
              control={<Switch checked={autoSyncEnabled} onChange={(e) => setAutoSyncEnabled(e.target.checked)} />}
              label="Automatisk synkronisering"
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml:  4, mb:  2 }}>
              Synkroniser automatisk når nye filer legges til prosjekter
            </Typography>

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Synkroniser RAW-filer"
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml:  4, mb:  2 }}>
              Inkluderer store RAW-filer i synkronisering (krever mer lagringsplass)
            </Typography>

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Komprimer før opplasting"
            />
            <Typography variant="body2" color="text.secondary" sx={{ ml:  4, mb:  2 }}>
              Komprimerer bilder for raskere opplasting og mindre lagringsplass
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained" onClick={() => setSyncDialogOpen(false)} sx={theming.getThemedButtonSx()}>
            Lagre Innstillinger
          </Button>
        </DialogActions>
      </Dialog>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg) }
            to { transform: rotate(360deg) }
        }
        `}
      </style>
    </MuiCard>
  );
};

export default GoogleDriveProjectSync;