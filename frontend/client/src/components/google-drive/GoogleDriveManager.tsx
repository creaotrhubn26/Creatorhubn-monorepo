import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { getMissingFolders, getAccessibleFolders } from '../../utils/folderFeatureMapping';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Switch,
  FormControlLabel,
  LinearProgress,
  Tooltip,
  Badge,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  CloudDone,
  Folder,
  FolderOpen,
  CreateNewFolder,
  Settings,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  History,
  Backup,
  Sync,
  Edit,
  Undo,
  Redo,
  RestoreFromTrash,
  Schedule,
  Security,
  Group,
  Share,
  Lock,
  Visibility,
  MoreVert,
  Refresh,
  Launch,
  ContentCopy,
  ExpandMore,
  LockOpen,
  Upgrade
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface GoogleDriveManagerProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  // Integration props for universal workflow connectivity
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  onProjectUpdate?: (project: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface FolderChange {
  id: string;
  originalName: string;
  newName: string;
  action: 'rename' | 'create' | 'delete' | 'move';
  timestamp: Date;
  projectId: string
}

interface BackupStatus {
  lastBackup: Date;
  nextBackup: Date;
  status: 'idle' | 'running' | 'error';
  totalFiles: number;
  backedUpFiles: number
}

interface FolderPermissions {
  userId: string;
  email: string;
  role: 'viewer' | 'editor' | 'owner';
  expires?: Date
}

interface ProjectFolder {
  id: string;
  name: string;
  webViewLink: string;
  createdAt: string;
  subFolders: {
    id: string;
    name: string;
}[];
}

interface GoogleDriveStatus {
  success: boolean;
  workloadIdentitySuccess: boolean;
  oauthAvailable: boolean;
  recommendation: string;
  message: string
}

interface Project {
  id: string;
  title: string;
  clientName: string;
  profession: string;
  status: string
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  userId,
  profession,
  onFileUpload,
  onFileDownload,
  onProjectUpdate,
  selectedProject,
  onProjectSelect
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showMissingFolders, setShowMissingFolders] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [changeTrackingEnabled, setChangeTrackingEnabled] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<ProjectFolder | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(profession);

  // Check Google Drive hybrid service status
  const { data: driveStatus, isLoading: statusLoading } = useQuery({
    queryKey: [''],
    queryFn: async () => {
      const response = await fetch('/test/api/google-drive/hybrid/test');
      return response.json() as Promise<GoogleDriveStatus>;
}
});

  // Fetch all projects for the user
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', profession, userId],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/${profession}/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      return data.projects as Project[];
  }
});

  // Fetch project folders
  const { data: projectFolders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['google-drive-project-folders', userId],
    queryFn: async () => {
      const response = await fetch(`/api/google-drive/project-folders/${userId}`);
      if (!response.ok) return [];
      return response.json() as ProjectFolder[];
  }
});

  // Fetch folder changes for tracking
  const { data: folderChanges = [], isLoading: changesLoading } = useQuery({
    queryKey: ['google-drive-changes', userId],
    queryFn: async () => {
      const response = await fetch(`/api/google-drive/folder-changes/${userId}`);
      if (!response.ok) return [];
      return response.json() as FolderChange[];
  },
    enabled: changeTrackingEnabled
});

  // Fetch backup status
  const { data: backupStatus, isLoading: backupLoading } = useQuery({
    queryKey: ['google-drive-backup-status', userId],
    queryFn: async () => {
      const response = await fetch(`/api/google-drive/backup-status/${userId}`);
      if (!response.ok) return null;
      return response.json() as BackupStatus;
  },
    refetchInterval: 30000 // Update every 30 seconds
});

  // Fetch user subscription to determine plan level
  const { data: userSubscription } = useQuery({
    queryKey: ['/api/user/subscription-status'],
    queryFn: () => apiRequest('/api/user/subscription-status'),
    staleTime: 30000,
  });

  // Calculate user plan level
  const userPlan: 'basic' | 'pro' | 'enterprise' = React.useMemo(() => {
    if (!userSubscription?.planName) return 'basic';
    const planName = userSubscription.planName.toLowerCase();
    if (planName.includes('enterprise')) return 'enterprise';
    if (planName.includes('pro') || planName.includes('premium')) return 'pro';
    return 'basic';
  }, [userSubscription]);

  // Calculate accessible and missing folders
  const accessibleFolders = React.useMemo(() =>
    getAccessibleFolders(profession, userPlan),
    [profession, userPlan]
  );

  const missingFolders = React.useMemo(() =>
    getMissingFolders(profession, userPlan),
    [profession, userPlan]
  );

  // Initialize OAuth if needed
  const initOAuthMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/test/api/google-drive/hybrid/init-oauth', {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POS',
        body: JSON.stringify({ userId })
      });
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
      }
    }
  });

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent('GoogleDriveManager', {
      type: 'google-service',
      capabilities: ['google-drive','file-management','project-sync'],
      dataFlow: {
        sources: ['drive-status','project-folders','backup-status'],
        destinations: ['admin-dashboard','user-interface'],
        processors: ['drive-processing','file-processing']
      }
    });

    // Set up data flow nodes
    dataFlow.registerNode('drive-status', {
      type: 'source',
      data: driveStatus,
      metadata: { component: 'GoogleDriveManager', type: 'drive-status' }
  });

    dataFlow.registerNode('project-folders', {
      type: 'source',
      data: projectFolders,
      metadata: { component: 'GoogleDriveManager', type: 'project-folders' }
  });

    dataFlow.registerNode('backup-status', {
      type: 'source',
      data: backupStatus,
      metadata: { component: 'GoogleDriveManager', type: 'backup-status' }
  });

    // Listen for Google Drive events
    const unsubscribe = communication.onMessage((message: any) => {
      if (message.type === 'google-drive:init-oauth') {
        initOAuthMutation.mutate();
      }
      if (message.type === 'google-drive:create-folder' && message.data?.folderData) {
        createFolderMutation.mutate(message.data.folderData);
      }
      if (message.type === 'google-drive:backup' && message.data?.projectId) {
        handleBackupProject(message.data.projectId);
      }
      if (message.type === 'google-drive:save-file' && message.data) {
        const { fileName, fileBlob, folderPath, metadata } = message.data;
        if (fileName && fileBlob) {
          // Convert blob to base64 for API
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const response = await fetch('/api/google-drive/save-file', {
                method: 'POST',
                headers: { 'Content-Type' : 'application/json' },
                body: JSON.stringify({
                  fileName,
                  fileData: reader.result,
                  folderPath: folderPath || 'CreatorHub/Split Sheets',
                  metadata
                })
              });
              if (response.ok) {
                queryClient.invalidateQueries({ queryKey: ['google-drive-project-folders'] });
              }
            } catch (error) {
              console.error('Error saving file to Google Drive: ', error);
            }
          };
          reader.readAsDataURL(fileBlob);
        }
      }
    });

    return () => {
      componentRegistry.unregisterComponent('GoogleDriveManager');
      dataFlow.unregisterNode('drive-status');
      dataFlow.unregisterNode('project-folders');
      dataFlow.unregisterNode('backup-status');
      if (unsubscribe) unsubscribe();
  };
}, [driveStatus, projectFolders, backupStatus, componentRegistry, dataFlow, communication, initOAuthMutation, createFolderMutation, queryClient]);

  // Create project folder with advanced structure
  const createFolderMutation = useMutation({
    mutationFn: async (folderData: {
      userId: string;
      projectName: string;
      clientName: string;
      companyName: string;
      projectId: string;
      enableChangeTracking?: boolean;
      autoBackup?: boolean;
      clientPermissions?: string;
}) => {
      return apiRequest('/api/google-drive/create-project-folder-advanced', {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POS',
        body: JSON.stringify({
          ...folderData,
          enableChangeTracking: changeTrackingEnabled,
          autoBackup: autoBackupEnabled
    })
    });
  },
    onSuccess: () => {
      setCreateFolderOpen(false);
      setSelectedProjectId('');
      setCurrentProject(null);
      queryClient.invalidateQueries({ queryKey: ['google-drive-project-folders', ],});
      queryClient.invalidateQueries({ queryKey: ['google-drive-changes', ],});
  }
});

  // Undo folder change mutation
  const undoChangeMutation = useMutation({
    mutationFn: async (changeId: string) => {
      return apiRequest(`/api/google-drive/undo-change/${changeId}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POST'
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-changes', ],});
      queryClient.invalidateQueries({ queryKey: ['google-drive-project-folders', ],});
  }
});

  // Restore standard structure mutation
  const restoreStructureMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest(`/api/google-drive/restore-standard-structure/${projectId}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POST'
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-project-folders', ],});
      queryClient.invalidateQueries({ queryKey: ['google-drive-changes', ],});
  }
});

  // Manual backup mutation
  const manualBackupMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest(`/api/google-drive/manual-backup/${projectId}`, {
        headers: {
          "Content-Type" : "application/json"
    },
        
        method: 'POST'
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-drive-backup-status', ],});
  }
});

  const handleCreateFolder = () => {
    if (!currentProject) {
      return;
  }

    createFolderMutation.mutate({
      userId,
      projectName: currentProject.title,
      clientName: currentProject.clientName,
      companyName: getProfessionDefaultCompany(),
      projectId: currentProject.id
});
};

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects?.find(p => p.id === projectId);
    setCurrentProject(project || null);
};

  const getProfessionDefaultCompany = () => {
    switch (profession) {
      case 'photographer': return 'Fotostudio';
      case 'videographer': return 'Videostudio';
      case 'music_producer': return 'Musikk Studio';
      case 'vendor': return 'Leverandør';
      default: return 'Bedrift';
}
};

  const getStatusColor = () => {
    if (!driveStatus) return 'warning';
    if (driveStatus.success && driveStatus.oauthAvailable) return 'success';
    if (driveStatus.success) return 'info';
    return 'error';
};

  const getStatusIcon = () => {
    if (statusLoading) return <CircularProgress size={20} />;
    if (!driveStatus) return theming.getThemedIcon('warning');
    if (driveStatus.success && driveStatus.oauthAvailable) return theming.getThemedIcon('checkCircle');
    if (driveStatus.success) return theming.getThemedIcon('cloudDone');
    return <ErrorIcon />;
};

  const tabData = [
    { label: 'Oversikt', icon: theming.getThemedIcon(',') },
    { label: 'Mappestruktur', icon: theming.getThemedIcon(',') },
    { label: 'Endringshistorikk', icon: <History />,},
    { label: 'Backup', icon: <Backup />,},
    { label: 'Innstillinger', icon: theming.getThemedIcon(', ') }
  ];

  const standardFolders = [
    'RAW - Originale bilder','Bearbeidede bilder','Leveranse til klient','Kontrakter og dokumenter','Kommunikasjon','Timeline og notater','Backup og sikkerhetskopier','Referansebilder og inspirasjon'
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p:  3, borderRadius:  0 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600}}>
              <Box
                component="img"
                src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                alt="Google Drive"
                sx={{ width: 32, height: 32 }}
              />
              Google Drive Mappeadministrasjon
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
              8-mappestruktur automation med avansert endringssporing og backup
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              icon={getStatusIcon()}
              label={driveStatus?.success ? 'Tilkoblet' : 'Ikke tilkoblet'}
              color={getStatusColor()}
              variant="outlined"
            />
            
            {backupStatus && (
              <Chip
                icon={<Backup />}
                label={`Backup: ${backupStatus.status}`}
                color={backupStatus.status === 'error' ? 'error' : 'success'}
                variant="outlined"
              />
            )}
            
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('refresh')}
              onClick={() => queryClient.invalidateQueries()}
            >
              Oppdater
            </Button>
            
            <Button variant="contained"
              startIcon={<CreateNewFolder />}
              onClick={() => setCreateFolderOpen(true)}
              disabled={!driveStatus?.oauthAvailable}
            >
              Ny Prosjektmappe
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Main Content */}
        <Box sx={{ flex: 1, p: 3 }}>
          {/* Tabs */}
          <Paper sx={{ mb: 3, ...theming.getThemedCardSx() }}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
            >
              {tabData.map((tab, index) => (
                <Tab
                  key={index}
                  icon={tab.icon}
                  label={tab.label}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {selectedTab === 0 && (
            /* Overview Tab */
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }} md={6}>
                <MuiCard>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      {theming.getThemedIcon('folder')}
                      Prosjektmapper
                    </Typography>
                    <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                      {projectFolders.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Aktive prosjektmapper med 8-struktur
                    </Typography>
                  </CardContent>
                </MuiCard>
              </Grid>
              
              <Grid size={{ xs: 12 }} md={6}>
                <MuiCard>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                      <History />
                      Endringer i dag
                    </Typography>
                    <Typography variant="h4" color="secondary" sx={{ color: theming.colors.primary }}>
                      {folderChanges.filter(c => 
                        new Date(c.timestamp).toDateString() === new Date().toDateString()
                      ).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mappeendringer registrert
                    </Typography>
                  </CardContent>
                </MuiCard>
              </Grid>
              
              <Grid size={{ xs: 12 }}>
                <MuiCard>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Siste prosjektmapper
                    </Typography>
                    <List>
                      {projectFolders.slice(0, 5).map((folder) => (
                        <ListItem key={folder.id} divider>
                          <ListItemIcon>
                            {theming.getThemedIcon('folderOpen')}
                          </ListItemIcon>
                          <ListItemText
                            primary={folder.name}
                            secondary={`Opprettet: ${new Date(folder.createdAt).toLocaleDateString(', ')}`}
                          />
                          <Stack direction="row" spacing={1}>
                            <IconButton
                              size="small"
                              onClick={() => window.open(folder.webViewLink, '_blank')}
                            >
                              {theming.getThemedIcon('launch')}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedFolder(folder);
                                setPermissionsDialogOpen(true);
                            }}
                            >
                              {theming.getThemedIcon('group')}
                            </IconButton>
                          </Stack>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </MuiCard>
              </Grid>
            </Grid>
          )}
          
          {selectedTab === 1 && (
            /* Folder Structure Tab */
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Standard 8-mappestruktur
              </Typography>
              <Alert severity="info" sx={{ mb:  3 }}>
                Alle prosjektmapper opprettes automatisk med denne strukturen. 
                Du kan endre mappener, og systemet holder oversikt over endringer.
              </Alert>
              
              <List>
                {standardFolders.map((folderName, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Folder color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={folderName}
                      secondary={`Standardmappe ${index + 1} av 8`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {selectedTab === 2 && (
            /* Change History Tab */
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:  3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Endringshistorikk
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<RestoreFromTrash />}
                  onClick={() => {
                    if (currentProject) {
                      restoreStructureMutation.mutate(currentProject.id);
                  }
                }}
                  disabled={!currentProject || restoreStructureMutation.isPending}
                >
                  Gjenopprett standardstruktur
                </Button>
              </Stack>
              
              {changesLoading ? (
                <LinearProgress />
              ) : folderChanges.length === 0 ? (
                <Alert severity="info">
                  Ingen mappeendringer registrert ennå
                </Alert>
              ) : (
                <List>
                  {folderChanges.map((change) => (
                    <ListItem key={change.id} divider>
                      <ListItemIcon>
                        {change.action === 'rename' && theming.getThemedIcon('edit')}
                        {change.action === 'create' && <CreateNewFolder />}
                        {change.action === 'delete' && <RestoreFromTrash />}
                        {change.action === 'move' && theming.getThemedIcon('sync')}
                      </ListItemIcon>
                      <ListItemText
                        primary={`${change.originalName} → ${change.newName}`}
                        secondary={`${change.action.toUpperCase()} • ${new Date(change.timestamp).toLocaleString('nb-NO')}`}
                      />
                      <Tooltip title="Angre endring">
                        <IconButton
                          size="small"
                          onClick={() => undoChangeMutation.mutate(change.id)}
                          disabled={undoChangeMutation.isPending}
                        >
                          {theming.getThemedIcon('undo')}
                        </IconButton>
                      </Tooltip>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
          
          {selectedTab === 3 && (
            /* Backup Tab */
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:  3 }}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Backup og sikkerhetskopier
                </Typography>
                <Button variant="contained"
                  startIcon={<Backup />}
                  onClick={() => setBackupDialogOpen(true)}
                  color="secondary"
                >
                  Manuell backup
                </Button>
              </Stack>
              
              {backupStatus && (
                <MuiCard sx={{ mb:  3 }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Backup-status
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12 }} md={6}>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Siste backup
                            </Typography>
                            <Typography variant="body1">
                              {new Date(backupStatus.lastBackup).toLocaleString('nb-NO')}
                            </Typography>
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Neste planlagte backup
                            </Typography>
                            <Typography variant="body1">
                              {new Date(backupStatus.nextBackup).toLocaleString('nb-NO')}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      
                      <Grid size={{ xs: 12 }} md={6}>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Fremdrift
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={(backupStatus.backedUpFiles / backupStatus.totalFiles) * 100}
                              sx={{ mt:  1 }}
                            />
                            <Typography variant="caption">
                              {backupStatus.backedUpFiles} av {backupStatus.totalFiles} filer
                            </Typography>
                          </Box>
                          
                          <Chip
                            label={backupStatus.status.toUpperCase()}
                            color={backupStatus.status === 'error' ? 'error' : 
                                   backupStatus.status === 'running' ? 'warning' : 'success'}
                          />
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </MuiCard>
              )}
              
              <Alert severity="info" sx={{ mb:  3 }}>
                5-lagers forensisk filgjenoppretting med automatisk synkronisering hver 4. time
              </Alert>
              
              <List>
                <ListItem>
                  <ListItemIcon>{theming.getThemedIcon('security')}</ListItemIcon>
                  <ListItemText
                    primary="Lokal backup"
                    secondary="Sikkerhetskopier lagres lokalt på enheten"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>{theming.getThemedIcon('cloudDone')}</ListItemIcon>
                  <ListItemText
                    primary="Google Drive backup"
                    secondary="Hovedbackup i separate Google Drive-mapper"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>{theming.getThemedIcon('schedule')}</ListItemIcon>
                  <ListItemText
                    primary="Automatisk planlegging"
                    secondary="Backup kjører hver 4. time for aktive prosjekter"
                  />
                </ListItem>
              </List>
            </Box>
          )}
          
          {selectedTab === 4 && (
            /* Settings Tab */
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Avanserte innstillinger
              </Typography>
              
              <Stack spacing={3}>
                <MuiCard>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" gutterBottom>
                      Automatisering
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={changeTrackingEnabled}
                            onChange={(e) => setChangeTrackingEnabled(e.target.checked)}
                          />
                      }
                        label="Aktiver endringssporing"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={autoBackupEnabled}
                            onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                          />
                      }
                        label="Automatisk backup"
                      />
                    </Stack>
                  </CardContent>
                </MuiCard>
                
                <MuiCard>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="subtitle1" gutterBottom>
                      Google Drive-tilkobling
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <Button
                        variant="outlined"
                        startIcon={
                          <Box
                            component="img"
                            src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                            alt="Google Drive"
                            sx={{ width: 20, height: 20 }}
                          />
                        }
                        onClick={() => initOAuthMutation.mutate()}
                        disabled={initOAuthMutation.isPending}
                      >
                        {initOAuthMutation.isPending ? 'Kobler til...' : 'Koble til Google Drive'}
                      </Button>

                      <Button
                        variant="outlined"
                        startIcon={
                          <Box
                            component="img"
                            src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                            alt="Google Drive"
                            sx={{ width: 20, height: 20 }}
                          />
                        }
                        onClick={() => window.open('https://drive.google.com', '_blank')}
                      >
                        Åpne Google Drive
                      </Button>
                    </Stack>
                  </CardContent>
                </MuiCard>
              </Stack>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        <Paper sx={{ width: 30, borderRadius: 0, borderLeft: 1, borderColor: 'divider', p:  2 ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Hurtighandlinger
          </Typography>
          
          <Stack spacing={2}>
            {/* Quick Actions */}
            <MuiCard variant="outlined">
              <CardContent sx={{ pb:  1 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Hurtigopprett
                </Typography>
                <Stack spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<CreateNewFolder />}
                    onClick={() => setCreateFolderOpen(true)}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Ny prosjektmappe
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<Backup />}
                    onClick={() => setBackupDialogOpen(true)}
                    fullWidth
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    Kjør backup
                  </Button>
                </Stack>
              </CardContent>
            </MuiCard>

            {/* Stats */}
            <MuiCard variant="outlined">
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="subtitle2" gutterBottom>
                  Statistikk
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Aktive mapper: </Typography>
                    <Chip size="small" label={projectFolders.length} />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Tilgjengelige mapper: </Typography>
                    <Chip size="small" label={accessibleFolders.length} color="success" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Låste mapper: </Typography>
                    <Chip size="small" label={missingFolders.length} color="warning" />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Endringer i dag: </Typography>
                    <Chip size="small" label={folderChanges.filter(c =>
                      new Date(c.timestamp).toDateString() === new Date().toDateString()
                    ).length} />
                  </Stack>
                  {backupStatus && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Backup status: </Typography>
                      <Chip size="small" label={backupStatus.status}
                        color={backupStatus.status === 'error' ? 'error' : 'success'} />
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </MuiCard>

            {/* Missing Folders Section */}
            {missingFolders.length > 0 && (
              <MuiCard variant="outlined" sx={{ border: '2px solid', borderColor: 'warning.main' }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Lock color="warning" />
                        Låste mapper
                      </Typography>
                      <Chip
                        size="small"
                        label={missingFolders.length}
                        color="warning"
                      />
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      Disse mappene er ikke tilgjengelige med din nåværende plan ({userPlan})
                    </Typography>

                    <Button
                      size="small"
                      variant="text"
                      startIcon={showMissingFolders ? <ExpandMore /> : <LockOpen />}
                      onClick={() => setShowMissingFolders(!showMissingFolders)}
                      fullWidth
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {showMissingFolders ? 'Skjul' : 'Vis'} låste mapper
                    </Button>

                    {showMissingFolders && (
                      <Stack spacing={1} sx={{ maxHeight: 300, overflowY: 'auto' }}>
                        {missingFolders.map((folder) => (
                          <Paper
                            key={folder.folderId}
                            sx={{
                              p: 1.5,
                              bgcolor: 'rgba(255, 152, 0, 0.05)',
                              border: '1px solid rgba(255, 152, 0, 0.2)'
                            }}
                          >
                            <Stack spacing={0.5}>
                              <Typography variant="body2" fontWeight="600">
                                {folder.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {folder.description}
                              </Typography>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                <Chip
                                  size="small"
                                  label={folder.requiredPlan.toUpperCase()}
                                  color="warning"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                                {folder.requiredFeatures.length > 0 && (
                                  <Chip
                                    size="small"
                                    label={`${folder.requiredFeatures.length} funksjoner`}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        ))}

                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Upgrade />}
                          onClick={() => window.location.href = `/subscription?profession=${profession}`}
                          fullWidth
                          sx={{ mt: 1 }}
                        >
                          Oppgrader for å låse opp
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </CardContent>
              </MuiCard>
            )}
          </Stack>
        </Paper>
      </Box>

      {/* Create Project Folder Dialog */}
      <Dialog 
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Opprett Ny Prosjektmappe med 8-struktur
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt:  1 }}>
            <Alert severity="info" sx={{ mb:  3 }}>
              Automatisk opprettelse av standardisert 8-mappestruktur med endringssporing og backup
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  Prosjektinformasjon
                </Typography>
                
                {projectsLoading ? (
                  <Box display="flex" justifyContent="center" my={2}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ ml:  2 }}>
                      Henter prosjekter...
                    </Typography>
                  </Box>
                ) : projects && projects.length > 0 ? (
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Velg Prosjekt</InputLabel>
                    <Select
                      value={selectedProjectId}
                      onChange={(e) => handleProjectSelect(e.target.value)}
                      label="Velg Prosjekt"
                    >
                      {projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {project.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {project.clientName} • ID: {project.d}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Alert severity="warning" sx={{ mb:  2 }}>
                    Ingen prosjekter funnet. Opprett et prosjekt først.
                  </Alert>
                )}

                {currentProject && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.05)', borderRadius:  1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Valgt prosjekt: </Typography>
                    <Typography variant="body2">
                      <strong>{currentProject.title}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Klient: {currentProject.clientName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ID: {currentProject.d}
                    </Typography>
                  </Box>
                )}
                
                <Stack spacing={2} sx={{ mt:  3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={changeTrackingEnabled}
                        onChange={(e) => setChangeTrackingEnabled(e.target.checked)}
                      />
                  }
                    label="Aktiver endringssporing"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoBackupEnabled}
                        onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                      />
                  }
                    label="Automatisk backup"
                  />
                </Stack>
              </Grid>
              
              <Grid size={{ xs: 12 }} md={6}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                  8-mappestruktur som opprettes
                </Typography>
                <List dense>
                  {standardFolders.map((folderName, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Folder fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={folderName}
                        secondary={`Mappe ${index + 1}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>

            {createFolderMutation.error && (
              <Alert severity="error" sx={{ mt:  2 }}>
                {createFolderMutation.error.message}
              </Alert>
            )}

            {createFolderMutation.data && (
              <Alert severity="success" sx={{ mt:  2 }}>
                <Typography variant="body2">
                  Prosjektmappe opprettet: {createFolderMutation.data.folder?.name}
                </Typography>
                {createFolderMutation.data.folder?.webViewLink && (
                  <Button
                    size="small"
                    href={createFolderMutation.data.folder.webViewLink}
                    target="_blank"
                    sx={{ mt:  1 }}
                    startIcon={
                      <Box
                        component="img"
                        src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                        alt="Google Drive"
                        sx={{ width: 16, height: 16 }}
                      />
                    }
                  >
                    Åpne i Google Drive
                  </Button>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            onClick={handleCreateFolder}
            disabled={!currentProject || createFolderMutation.isPending}
           sx={theming.getThemedButtonSx()}>
            {createFolderMutation.isPending ? 'Oppretter mappe...' : 'Opprett 8-mappestruktur'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoogleDriveManager;