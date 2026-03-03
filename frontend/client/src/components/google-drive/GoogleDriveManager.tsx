import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  AccordionDetails,
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
  Upgrade,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface GoogleDriveManagerProps {
  userId: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
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
  const [showMissingFolders, setShowMissingFolders] = useState(true);
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
    queryKey: ['google-drive-status'],
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
      const data = await response.json();
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    }
  });

  // Fetch folder changes for tracking
  const { data: folderChanges = [], isLoading: changesLoading } = useQuery({
    queryKey: ['google-drive-changes', userId],
    queryFn: async () => {
      const response = await fetch(`/api/google-drive/folder-changes/${userId}`);
      if (!response.ok) return [];
      const data = await response.json();
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
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
    queryKey: ['user-subscription'],
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
        
        method: 'POST',
        body: JSON.stringify({ userId })
      });
    },
    onSuccess: (data: any) => {
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
      }
    }
  });

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
        
        method: 'POST',
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

      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'row',
        gap: 3,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Main Content */}
        <Box sx={{ 
          flex: 1, 
          p: { xs: 2, md: 3 },
          overflow: 'auto',
          minWidth: 0
        }}>
          {/* Tabs */}
          <Paper sx={{ 
            mb: 4, 
            ...theming.getThemedCardSx(),
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(33, 203, 243, 0.05) 100%)'
          }}>
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 72,
                  fontSize: '1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3,
                  '&.Mui-selected': {
                    color: theming.colors.primary,
                    fontWeight: 700
                  }
                },
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: '3px 3px 0 0'
                }
              }}
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
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <MuiCard sx={{ 
                    height: '100%',
                    borderRadius: 4,
                    bgcolor: theming.colors.primary,
                    boxShadow: `0 8px 24px ${theming.colors.primary}40`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: `0 16px 48px ${theming.colors.primary}60`
                    }
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <Box sx={{ 
                          p: 1.5, 
                          borderRadius: 3, 
                          bgcolor: 'rgba(255,255,255,0.2)',
                          display: 'flex'
                        }}>
                          {theming.getThemedIcon('folder', { sx: { color: '#fff' } })}
                        </Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                          Prosjektmapper
                        </Typography>
                      </Box>
                      <Typography variant="h2" sx={{ color: '#fff', mb: 1, fontWeight: 800, fontSize: '3rem' }}>
                        {Array.isArray(projectFolders) ? projectFolders.length : 0}
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                        Aktive prosjektmapper med 8-struktur
                      </Typography>
                    </CardContent>
                  </MuiCard>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <MuiCard sx={{ 
                    height: '100%',
                    borderRadius: 4,
                    bgcolor: theming.colors.secondary,
                    boxShadow: `0 8px 24px ${theming.colors.secondary}40`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: `0 16px 48px ${theming.colors.secondary}60`
                    }
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <Box sx={{ 
                          p: 1.5, 
                          borderRadius: 3, 
                          bgcolor: 'rgba(255,255,255,0.2)',
                          display: 'flex'
                        }}>
                          <History sx={{ color: '#fff' }} />
                        </Box>
                        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                          Endringer i dag
                        </Typography>
                      </Box>
                      <Typography variant="h2" sx={{ color: '#fff', mb: 1, fontWeight: 800, fontSize: '3rem' }}>
                        {Array.isArray(folderChanges) ? folderChanges.filter(c => 
                          new Date(c.timestamp).toDateString() === new Date().toDateString()
                        ).length : 0}
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                        Mappeendringer registrert
                      </Typography>
                    </CardContent>
                  </MuiCard>
                </Grid>
                
                <Grid item xs={12}>
                  <MuiCard sx={{ 
                    borderRadius: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: '1px solid rgba(33, 150, 243, 0.15)'
                  }}>
                    <Box sx={{ 
                      bgcolor: theming.colors.cardBackground,
                      borderBottom: `3px solid ${theming.colors.primary}`,
                      p: 3
                    }}>
                      <Typography variant="h4" sx={{ color: theming.colors.primary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                        {theming.getThemedIcon('folderOpen')}
                        Siste prosjektmapper
                      </Typography>
                      <Typography variant="body1" sx={{ color: theming.colors.textSecondary, mt: 1 }}>
                        De 5 nyeste prosjektmappene dine
                      </Typography>
                    </Box>
                    <CardContent sx={{ ...theming.getThemedCardSx(), p: 0 }}>
                      <List sx={{ '& .MuiListItem-root': { borderRadius: 0 } }}>
                        {Array.isArray(projectFolders) && projectFolders.length > 0 ? projectFolders.slice(0, 5).map((folder, index) => (
                        <ListItem 
                          key={folder.id} 
                          sx={{ 
                            py: 3,
                            px: 3,
                            borderBottom: index < 4 ? `1px solid ${theming.colors.border}` : 'none',
                            transition: 'all 0.2s',
                            borderLeft: '4px solid transparent',
                            '&:hover': { 
                              bgcolor: `${theming.colors.primary}08`,
                              borderLeftColor: theming.colors.primary,
                              transform: 'translateX(4px)'
                            }
                          }}
                        >
                          <ListItemIcon>
                            <Box sx={{ 
                              p: 1.5, 
                              borderRadius: 3, 
                              bgcolor: `${theming.colors.primary}15`,
                              display: 'flex'
                            }}>
                              {theming.getThemedIcon('folderOpen')}
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {folder.name}
                              </Typography>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Chip 
                                  icon={theming.getThemedIcon('calendar')}
                                  label={new Date(folder.createdAt).toLocaleDateString('nb-NO')} 
                                  size="small"
                                  sx={{ fontWeight: 500 }}
                                />
                              </Box>
                            }
                          />
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Åpne i Google Drive">
                              <IconButton
                                size="medium"
                                onClick={() => window.open(folder.webViewLink, '_blank')}
                                sx={{ 
                                  bgcolor: `${theming.colors.primary}20`,
                                  color: theming.colors.primary,
                                  '&:hover': { 
                                    bgcolor: `${theming.colors.primary}40`,
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s'
                                }}
                              >
                                {theming.getThemedIcon('launch')}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Administrer tilganger">
                              <IconButton
                                size="medium"
                                onClick={() => {
                                  setSelectedFolder(folder);
                                  setPermissionsDialogOpen(true);
                              }}
                                sx={{ 
                                  bgcolor: `${theming.colors.secondary}20`,
                                  color: theming.colors.secondary,
                                  '&:hover': { 
                                    bgcolor: `${theming.colors.secondary}40`,
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s'
                                }}
                              >
                                {theming.getThemedIcon('group')}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </ListItem>
                      )) : (
                        <Box sx={{ p: 6, textAlign: 'center' }}>
                          {theming.getThemedIcon('folderOpen', { sx: { fontSize: 60, color: 'text.secondary', opacity: 0.3, mb: 2 } })}
                          <Typography variant="h6" color="text.secondary">
                            Ingen prosjektmapper ennå
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Opprett din første prosjektmappe for å komme i gang
                          </Typography>
                        </Box>
                      )}
                      </List>
                    </CardContent>
                  </MuiCard>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {selectedTab === 1 && (
            /* Folder Structure Tab */
            <Box>
              <MuiCard sx={{ 
                mb: 4,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
              }}>
                <Box sx={{ 
                  bgcolor: theming.colors.primary,
                  p: 3
                }}>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Folder sx={{ fontSize: 40, color: '#fff' }} />
                    Standard 8-mappestruktur
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
                    Alle prosjektmapper opprettes automatisk med denne strukturen
                  </Typography>
                </Box>
                <CardContent sx={{ ...theming.getThemedCardSx(), p: 0 }}>
                  <List>
                    {standardFolders.map((folderName, index) => (
                      <ListItem 
                        key={index}
                        sx={{
                          py: 2.5,
                          px: 3,
                          transition: 'all 0.2s',
                          borderLeft: '4px solid transparent',
                          '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.05)',
                            borderLeftColor: theming.colors.primary
                          }
                        }}
                      >
                        <ListItemIcon>
                          <Box sx={{ 
                            p: 1.5, 
                            borderRadius: 2, 
                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                            display: 'flex'
                          }}>
                            <Folder sx={{ color: theming.colors.primary, fontSize: 28 }} />
                          </Box>
                        </ListItemIcon>
                        <ListItemText 
                          primary={<Typography variant="h6" sx={{ fontWeight: 600 }}>{folderName}</Typography>}
                          secondary={<Chip label={`${index + 1} av 8`} size="small" sx={{ mt: 0.5 }} />}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </MuiCard>
            </Box>
          )}
          
          {selectedTab === 2 && (
            /* Change History Tab */
            <Box>
              <MuiCard sx={{ 
                mb: 4,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
              }}>
                <Box sx={{ 
                  bgcolor: theming.colors.secondary,
                  p: 3
                }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <History sx={{ fontSize: 40, color: '#fff' }} />
                        Endringshistorikk
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#fff', mt: 1 }}>
                        Oversikt over alle mappeendringer
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<RestoreFromTrash />}
                      onClick={() => {
                        if (currentProject) {
                          restoreStructureMutation.mutate(currentProject.id);
                      }
                    }}
                      disabled={!currentProject || restoreStructureMutation.isPending}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                        fontWeight: 600
                      }}
                    >
                      Gjenopprett standardstruktur
                    </Button>
                  </Stack>
                </Box>
                <CardContent sx={{ ...theming.getThemedCardSx(), p: 0 }}>
                  {changesLoading ? (
                    <Box sx={{ p: 6, textAlign: 'center' }}>
                      <CircularProgress size={60} sx={{ color: theming.colors.secondary, mb: 2 }} />
                      <Typography variant="h6" color="text.secondary">
                        Laster endringshistorikk...
                      </Typography>
                    </Box>
                  ) : !Array.isArray(folderChanges) || folderChanges.length === 0 ? (
                    <Box sx={{ p: 8, textAlign: 'center' }}>
                      <Box sx={{ 
                        display: 'inline-flex',
                        p: 3,
                        borderRadius: '50%',
                        bgcolor: `${theming.colors.secondary}10`,
                        mb: 3
                      }}>
                        <History sx={{ fontSize: 60, color: theming.colors.secondary, opacity: 0.5 }} />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                        Ingen mappeendringer registrert ennå
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Endringer vil vises her når du redigerer mappestrukturen
                      </Typography>
                    </Box>
                  ) : (
                    <List sx={{ p: 2 }}>
                      {folderChanges.map((change, index) => (
                        <ListItem 
                          key={change.id} 
                          sx={{ 
                            py: 3,
                            px: 3,
                            mb: 2,
                            borderRadius: 3,
                            transition: 'all 0.3s',
                            border: `2px solid ${theming.colors.border}`,
                            '&:hover': {
                              bgcolor: `${theming.colors.secondary}08`,
                              borderColor: theming.colors.secondary,
                              transform: 'translateX(8px)',
                              boxShadow: `0 4px 12px ${theming.colors.secondary}20`
                            }
                          }}
                        >
                          <ListItemIcon>
                            <Box sx={{ 
                              p: 2, 
                              borderRadius: 3, 
                              bgcolor: change.action === 'rename' ? theming.colors.primary :
                                         change.action === 'create' ? theming.colors.success :
                                         change.action === 'delete' ? theming.colors.error :
                                         theming.colors.info,
                              display: 'flex',
                              color: '#fff',
                              boxShadow: change.action === 'rename' ? `0 4px 12px ${theming.colors.primary}40` :
                                          change.action === 'create' ? `0 4px 12px ${theming.colors.success}40` :
                                          change.action === 'delete' ? `0 4px 12px ${theming.colors.error}40` :
                                          `0 4px 12px ${theming.colors.info}40`
                            }}>
                              {change.action === 'rename' && theming.getThemedIcon('edit', { sx: { fontSize: 28 } })}
                              {change.action === 'create' && <CreateNewFolder sx={{ fontSize: 28 }} />}
                              {change.action === 'delete' && <RestoreFromTrash sx={{ fontSize: 28 }} />}
                              {change.action === 'move' && theming.getThemedIcon('sync', { sx: { fontSize: 28 } })}
                            </Box>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                {change.originalName} 
                                <Box component="span" sx={{ color: theming.colors.secondary, mx: 1 }}>→</Box>
                                {change.newName}
                              </Typography>
                            }
                            secondary={
                              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1 }}>
                                <Chip 
                                  label={change.action.toUpperCase()} 
                                  size="medium" 
                                  sx={{ 
                                    fontWeight: 700,
                                    bgcolor: change.action === 'rename' ? theming.colors.primary :
                                             change.action === 'create' ? theming.colors.success :
                                             change.action === 'delete' ? theming.colors.error :
                                             theming.colors.info,
                                    color: '#fff'
                                  }} 
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {theming.getThemedIcon('schedule', { sx: { fontSize: 16, color: 'text.secondary' } })}
                                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                    {new Date(change.timestamp).toLocaleString('nb-NO')}
                                  </Typography>
                                </Box>
                              </Stack>
                            }
                          />
                          <Tooltip title="Angre endring" arrow>
                            <IconButton
                              size="large"
                              onClick={() => undoChangeMutation.mutate(change.id)}
                              disabled={undoChangeMutation.isPending}
                              sx={{ 
                                bgcolor: `${theming.colors.warning}15`,
                                color: theming.colors.warning,
                                '&:hover': { 
                                  bgcolor: `${theming.colors.warning}30`,
                                  transform: 'rotate(-15deg) scale(1.1)'
                                },
                                transition: 'all 0.2s'
                              }}
                            >
                              {theming.getThemedIcon('undo')}
                            </IconButton>
                          </Tooltip>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </MuiCard>
            </Box>
          )}
          
          {selectedTab === 3 && (
            /* Backup Tab */
            <Box>
              <MuiCard sx={{ 
                mb: 4,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
              }}>
                <Box sx={{ 
                  bgcolor: theming.colors.info,
                  p: 3
                }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Backup sx={{ fontSize: 40, color: '#fff' }} />
                        Backup og sikkerhetskopier
                      </Typography>
                      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
                        5-lagers forensisk filgjenoppretting
                      </Typography>
                    </Box>
                    <Button 
                      variant="contained"
                      startIcon={<Backup />}
                      onClick={() => setBackupDialogOpen(true)}
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                        fontWeight: 600
                      }}
                    >
                      Manuell backup
                    </Button>
                  </Stack>
                </Box>
              </MuiCard>
              
              {backupStatus && (
                <MuiCard sx={{ mb: 4, borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary, fontWeight: 700, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                      {theming.getThemedIcon('assessment')}
                      Backup-status
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Stack spacing={3}>
                          <Box sx={{ 
                            p: 2.5, 
                            borderRadius: 3, 
                            bgcolor: `${theming.colors.success}10`,
                            border: `2px solid ${theming.colors.success}30`
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                              {theming.getThemedIcon('schedule', { sx: { color: theming.colors.success } })}
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theming.colors.success }}>
                                Siste backup
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {new Date(backupStatus.lastBackup).toLocaleString('nb-NO')}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ 
                            p: 2.5, 
                            borderRadius: 3, 
                            bgcolor: `${theming.colors.info}10`,
                            border: `2px solid ${theming.colors.info}30`
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                              {theming.getThemedIcon('schedule', { sx: { color: theming.colors.info } })}
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theming.colors.info }}>
                                Neste planlagte backup
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {new Date(backupStatus.nextBackup).toLocaleString('nb-NO')}
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Stack spacing={3}>
                          <Box sx={{ 
                            p: 2.5, 
                            borderRadius: 3, 
                            bgcolor: `${theming.colors.primary}10`,
                            border: `2px solid ${theming.colors.primary}30`
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                              {theming.getThemedIcon('sync', { sx: { color: theming.colors.primary } })}
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theming.colors.primary }}>
                                Fremdrift
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={(backupStatus.backedUpFiles / backupStatus.totalFiles) * 100}
                              sx={{ 
                                height: 8,
                                borderRadius: 2,
                                bgcolor: `${theming.colors.primary}20`,
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 2,
                                  bgcolor: theming.colors.primary
                                }
                              }}
                            />
                            <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
                              {backupStatus.backedUpFiles} av {backupStatus.totalFiles} filer
                            </Typography>
                          </Box>
                          
                          <Box sx={{ 
                            p: 2.5, 
                            borderRadius: 3, 
                            bgcolor: backupStatus.status === 'error' ? `${theming.colors.error}10` :
                                      backupStatus.status === 'running' ? `${theming.colors.warning}10` :
                                      `${theming.colors.success}10`,
                            border: backupStatus.status === 'error' ? `2px solid ${theming.colors.error}30` :
                                    backupStatus.status === 'running' ? `2px solid ${theming.colors.warning}30` :
                                    `2px solid ${theming.colors.success}30`,
                            textAlign: 'center'
                          }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                              Status
                            </Typography>
                            <Chip
                              label={(backupStatus.status || 'unknown').toUpperCase()}
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                py: 2.5,
                                bgcolor: backupStatus.status === 'error' ? theming.colors.error :
                                         backupStatus.status === 'running' ? theming.colors.warning :
                                         theming.colors.success,
                                color: '#fff'
                              }}
                            />
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>
                  </CardContent>
                </MuiCard>
              )}
              
              <MuiCard sx={{ borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <Box sx={{ 
                  bgcolor: `${theming.colors.info}15`,
                  p: 2.5,
                  borderBottom: `2px solid ${theming.colors.info}`
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: theming.colors.primary, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {theming.getThemedIcon('security')}
                    Backup-funksjoner
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    5-lagers forensisk filgjenoppretting med automatisk synkronisering hver 4. time
                  </Typography>
                </Box>
                <List>
                  <ListItem sx={{ 
                    py: 3, 
                    px: 3,
                    transition: 'all 0.2s',
                    borderLeft: '4px solid transparent',
                    '&:hover': { 
                      bgcolor: `${theming.colors.primary}08`,
                      borderLeftColor: theming.colors.primary
                    }
                  }}>
                    <ListItemIcon>
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 3, 
                        bgcolor: `${theming.colors.primary}15`,
                        display: 'flex'
                      }}>
                        {theming.getThemedIcon('save', { sx: { color: theming.colors.primary, fontSize: 28 } })}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="h6" sx={{ fontWeight: 700 }}>Lokal backup</Typography>}
                      secondary={<Typography variant="body2" color="text.secondary">Sikkerhetskopier lagres lokalt på enheten</Typography>}
                    />
                  </ListItem>
                  <ListItem sx={{ 
                    py: 3, 
                    px: 3,
                    transition: 'all 0.2s',
                    borderLeft: '4px solid transparent',
                    '&:hover': { 
                      bgcolor: `${theming.colors.info}08`,
                      borderLeftColor: theming.colors.info
                    }
                  }}>
                    <ListItemIcon>
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 3, 
                        bgcolor: `${theming.colors.info}15`,
                        display: 'flex'
                      }}>
                        {theming.getThemedIcon('cloudDone', { sx: { color: theming.colors.info, fontSize: 28 } })}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="h6" sx={{ fontWeight: 700 }}>Google Drive backup</Typography>}
                      secondary={<Typography variant="body2" color="text.secondary">Hovedbackup i separate Google Drive-mapper</Typography>}
                    />
                  </ListItem>
                  <ListItem sx={{ 
                    py: 3, 
                    px: 3,
                    transition: 'all 0.2s',
                    borderLeft: '4px solid transparent',
                    '&:hover': { 
                      bgcolor: `${theming.colors.success}08`,
                      borderLeftColor: theming.colors.success
                    }
                  }}>
                    <ListItemIcon>
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 3, 
                        bgcolor: `${theming.colors.success}15`,
                        display: 'flex'
                      }}>
                        {theming.getThemedIcon('schedule', { sx: { color: theming.colors.success, fontSize: 28 } })}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="h6" sx={{ fontWeight: 700 }}>Automatisk planlegging</Typography>}
                      secondary={<Typography variant="body2" color="text.secondary">Backup kjører hver 4. time for aktive prosjekter</Typography>}
                    />
                  </ListItem>
                </List>
              </MuiCard>
            </Box>
          )}
          
          {selectedTab === 4 && (
            /* Settings Tab */
            <Box>
              <MuiCard sx={{ 
                mb: 4,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
              }}>
                <Box sx={{ 
                  bgcolor: theming.colors.warning,
                  p: 3
                }}>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {theming.getThemedIcon('settings', { sx: { fontSize: 40, color: '#fff' } })}
                    Avanserte innstillinger
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#fff', mt: 1 }}>
                    Konfigurer automatisering og tilkoblinger
                  </Typography>
                </Box>
              </MuiCard>
              
              <Stack spacing={3}>
                <MuiCard sx={{ borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                      {theming.getThemedIcon('autoAwesome')}
                      Automatisering
                    </Typography>
                    <Stack spacing={3}>
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 3, 
                        bgcolor: `${theming.colors.primary}08`,
                        border: `2px solid ${theming.colors.primary}30`,
                        transition: 'all 0.3s',
                        '&:hover': { 
                          borderColor: theming.colors.primary,
                          bgcolor: `${theming.colors.primary}12`,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 12px ${theming.colors.primary}20`
                        }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box sx={{ 
                            p: 1.5, 
                            borderRadius: 2, 
                            bgcolor: theming.colors.primary,
                            display: 'flex'
                          }}>
                            {theming.getThemedIcon('visibility', { sx: { color: '#fff', fontSize: 24 } })}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Aktiver endringssporing</Typography>
                            <Typography variant="body2" color="text.secondary">Spor alle endringer i mappestrukturen automatisk</Typography>
                          </Box>
                          <Switch
                            checked={changeTrackingEnabled}
                            onChange={(e) => setChangeTrackingEnabled(e.target.checked)}
                            color="primary"
                            size="medium"
                          />
                        </Box>
                      </Box>
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: 3, 
                        bgcolor: `${theming.colors.info}08`,
                        border: `2px solid ${theming.colors.info}30`,
                        transition: 'all 0.3s',
                        '&:hover': { 
                          borderColor: theming.colors.info,
                          bgcolor: `${theming.colors.info}12`,
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 12px ${theming.colors.info}20`
                        }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box sx={{ 
                            p: 1.5, 
                            borderRadius: 2, 
                            bgcolor: theming.colors.info,
                            display: 'flex'
                          }}>
                            {theming.getThemedIcon('backup', { sx: { color: '#fff', fontSize: 24 } })}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Automatisk backup</Typography>
                            <Typography variant="body2" color="text.secondary">Kjør backup hver 4. time automatisk uten brukerinteraksjon</Typography>
                          </Box>
                          <Switch
                            checked={autoBackupEnabled}
                            onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                            color="primary"
                            size="medium"
                          />
                        </Box>
                      </Box>
                    </Stack>
                  </CardContent>
                </MuiCard>
                
                <MuiCard sx={{ borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <Box sx={{ 
                    bgcolor: `${theming.colors.success}15`,
                    p: 2.5,
                    borderBottom: `2px solid ${theming.colors.success}`
                  }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="img"
                        src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                        alt="Google Drive"
                        sx={{ width: 28, height: 28 }}
                      />
                      Google Drive-tilkobling
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Administrer tilkobling til Google Drive for mappeadministrasjon
                    </Typography>
                  </Box>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Stack spacing={2}>
                      <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        startIcon={
                          <Box
                            component="img"
                            src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                            alt="Google Drive"
                            sx={{ width: 24, height: 24 }}
                          />
                        }
                        onClick={() => initOAuthMutation.mutate()}
                        disabled={initOAuthMutation.isPending}
                        sx={{ 
                          bgcolor: theming.colors.success,
                          py: 1.8,
                          fontWeight: 700,
                          fontSize: '1rem',
                          '&:hover': { 
                            bgcolor: theming.colors.successDark || theming.colors.success,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 6px 20px ${theming.colors.success}40`
                          },
                          transition: 'all 0.2s'
                        }}
                      >
                        {initOAuthMutation.isPending ? 'Kobler til...' : 'Koble til Google Drive'}
                      </Button>

                      <Button
                        variant="outlined"
                        size="large"
                        fullWidth
                        startIcon={
                          <Box
                            component="img"
                            src="https://fonts.gstatic.com/s/i/productlogos/drive_2020q4/v8/web-64dp/logo_drive_2020q4_color_2x_web_64dp.png"
                            alt="Google Drive"
                            sx={{ width: 24, height: 24 }}
                          />
                        }
                        onClick={() => window.open('https://drive.google.com', '_blank')}
                        sx={{
                          py: 1.8,
                          fontWeight: 600,
                          fontSize: '1rem',
                          borderWidth: 2,
                          '&:hover': {
                            borderWidth: 2,
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          },
                          transition: 'all 0.2s'
                        }}
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
        <Paper sx={{ 
          width: 340, 
          borderRadius: 4, 
          p: 0,
          ...theming.getThemedCardSx(),
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          maxHeight: '100vh',
          overflow: 'hidden'
        }}>
          <Box sx={{ 
            bgcolor: theming.colors.primary,
            p: 3,
            flexShrink: 0
          }}>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {theming.getThemedIcon('bolt', { sx: { color: '#fff' } })}
              Hurtighandlinger
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 0.5 }}>
              Rask tilgang til viktige funksjoner
            </Typography>
          </Box>
          
          <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
            <Stack spacing={2.5}>
              {/* Quick Actions */}
              <MuiCard sx={{ 
                borderRadius: 3,
                overflow: 'hidden',
                border: '2px solid rgba(102, 126, 234, 0.2)',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.1)'
              }}>
                <Box sx={{ 
                  bgcolor: `${theming.colors.primary}15`,
                  p: 2,
                  borderBottom: `2px solid ${theming.colors.primary}30`
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CreateNewFolder sx={{ color: theming.colors.primary }} />
                    Hurtigopprett
                  </Typography>
                </Box>
                <CardContent sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Button
                      size="medium"
                      variant="contained"
                      startIcon={<CreateNewFolder />}
                      onClick={() => setCreateFolderOpen(true)}
                      fullWidth
                      sx={{ 
                        justifyContent: 'flex-start',
                        bgcolor: theming.colors.primary,
                        fontWeight: 600,
                        py: 1.2,
                        '&:hover': {
                          bgcolor: theming.colors.primaryDark || theming.colors.primary,
                          transform: 'translateX(4px)'
                        },
                        transition: 'all 0.2s'
                      }}
                    >
                      Ny prosjektmappe
                    </Button>
                    <Button
                      size="medium"
                      variant="outlined"
                      startIcon={<Backup />}
                      onClick={() => setBackupDialogOpen(true)}
                      fullWidth
                      sx={{ 
                        justifyContent: 'flex-start',
                        borderWidth: 2,
                        fontWeight: 600,
                        py: 1.2,
                        borderColor: theming.colors.primary,
                        '&:hover': {
                          borderWidth: 2,
                          transform: 'translateX(4px)',
                          bgcolor: 'rgba(102, 126, 234, 0.05)'
                        },
                        transition: 'all 0.2s'
                      }}
                    >
                      Kjør backup
                    </Button>
                  </Stack>
                </CardContent>
              </MuiCard>

              {/* Stats */}
              <MuiCard sx={{ 
                borderRadius: 3,
                overflow: 'hidden',
                border: '2px solid rgba(240, 147, 251, 0.2)',
                boxShadow: '0 2px 8px rgba(240, 147, 251, 0.1)'
              }}>
                <Box sx={{ 
                  bgcolor: `${theming.colors.secondary}15`,
                  p: 2,
                  borderBottom: `2px solid ${theming.colors.secondary}30`
                }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    {theming.getThemedIcon('assessment')}
                    Statistikk
                  </Typography>
                </Box>
                <CardContent sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'rgba(102, 126, 234, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Aktive mapper</Typography>
                      <Chip 
                        size="medium" 
                        label={Array.isArray(projectFolders) ? projectFolders.length : 0}
                        sx={{ 
                          fontWeight: 700,
                          bgcolor: theming.colors.primary,
                          color: '#fff'
                        }}
                      />
                    </Box>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'rgba(76, 175, 80, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Tilgjengelige</Typography>
                      <Chip 
                        size="medium" 
                        label={accessibleFolders.length} 
                        sx={{ 
                          fontWeight: 700,
                          bgcolor: '#4caf50',
                          color: '#fff'
                        }}
                      />
                    </Box>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'rgba(255, 152, 0, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Låste mapper</Typography>
                      <Chip 
                        size="medium" 
                        label={missingFolders.length} 
                        sx={{ 
                          fontWeight: 700,
                          bgcolor: '#ff9800',
                          color: '#fff'
                        }}
                      />
                    </Box>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'rgba(240, 147, 251, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Endringer i dag</Typography>
                      <Chip 
                        size="medium" 
                        label={Array.isArray(folderChanges) ? folderChanges.filter(c =>
                          new Date(c.timestamp).toDateString() === new Date().toDateString()
                        ).length : 0}
                        sx={{ 
                          fontWeight: 700,
                          bgcolor: theming.colors.secondary,
                          color: '#fff'
                        }}
                      />
                    </Box>
                    {backupStatus && (
                      <Box sx={{ 
                        p: 2, 
                        borderRadius: 2, 
                        bgcolor: backupStatus.status === 'error' ? 'rgba(244, 67, 54, 0.05)' : 'rgba(76, 175, 80, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>Backup status</Typography>
                        <Chip 
                          size="medium" 
                          label={backupStatus.status}
                          sx={{ 
                            fontWeight: 700,
                            bgcolor: backupStatus.status === 'error' ? '#f44336' : '#4caf50',
                            color: '#fff'
                          }}
                        />
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </MuiCard>

              {/* Missing Folders Section */}
              {missingFolders.length > 0 && (
                <MuiCard sx={{ 
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: `2px solid ${theming.colors.success}`,
                  boxShadow: `0 4px 16px ${theming.colors.success}20`
                }}>
                  <Box sx={{ 
                    bgcolor: `${theming.colors.success}15`,
                    p: 2,
                    borderBottom: `2px solid ${theming.colors.success}`
                  }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Lock sx={{ color: theming.colors.success }} />
                      Låste mapper
                    </Typography>
                  </Box>
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      <Box sx={{ 
                        p: 2.5, 
                        borderRadius: 3, 
                        bgcolor: `${theming.colors.success}10`,
                        border: `2px solid ${theming.colors.success}30`,
                        textAlign: 'center'
                      }}>
                        <Chip
                          size="medium"
                          label={`${missingFolders.length} låste`}
                          sx={{ 
                            fontWeight: 700,
                            bgcolor: theming.colors.success,
                            color: '#fff',
                            fontSize: '0.875rem'
                          }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 1.5, fontWeight: 500 }}>
                          Ikke tilgjengelige med {userPlan}-plan
                        </Typography>
                      </Box>

                      <Button
                        size="medium"
                        variant="outlined"
                        startIcon={showMissingFolders ? <ExpandMore /> : <LockOpen />}
                        onClick={() => setShowMissingFolders(!showMissingFolders)}
                        fullWidth
                        sx={{ 
                          borderWidth: 2,
                          borderColor: theming.colors.success,
                          color: theming.colors.success,
                          fontWeight: 600,
                          py: 1.2,
                          '&:hover': { 
                            borderWidth: 2,
                            bgcolor: `${theming.colors.success}10`,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 4px 12px ${theming.colors.success}20`
                          }
                        }}
                      >
                        {showMissingFolders ? 'Skjul' : 'Vis'} låste mapper
                      </Button>

                      {showMissingFolders && (
                        <Box sx={{ mt: 2, maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                          <Stack spacing={2}>
                            {missingFolders.map((folder) => (
                              <Paper
                                key={folder.folderId}
                                sx={{
                                  p: 3,
                                  bgcolor: `${theming.colors.success}10`,
                                  border: `2px solid ${theming.colors.success}`,
                                  borderRadius: 3,
                                  transition: 'all 0.3s',
                                  '&:hover': {
                                    bgcolor: `${theming.colors.success}15`,
                                    borderColor: theming.colors.success,
                                    transform: 'translateX(4px)',
                                    boxShadow: `0 6px 16px ${theming.colors.success}30`
                                  }
                                }}
                              >
                                <Stack spacing={1.5}>
                                  <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5, color: theming.colors.success }}>
                                    <Lock sx={{ fontSize: 24 }} />
                                    {folder.name}
                                  </Typography>
                                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                    {folder.description}
                                  </Typography>
                                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                                    <Chip
                                      size="medium"
                                      label={folder.requiredPlan.toUpperCase()}
                                      sx={{ 
                                        fontWeight: 700,
                                        bgcolor: theming.colors.success,
                                        color: '#fff',
                                        fontSize: '0.875rem'
                                      }}
                                    />
                                    {folder.requiredFeatures.length > 0 && (
                                      <Chip
                                        size="medium"
                                        label={`${folder.requiredFeatures.length} funksjoner`}
                                        variant="outlined"
                                        sx={{ 
                                          borderColor: theming.colors.success, 
                                          color: theming.colors.success,
                                          borderWidth: 2,
                                          fontWeight: 600
                                        }}
                                      />
                                    )}
                                  </Stack>
                                </Stack>
                              </Paper>
                            ))}

                            <Button
                              variant="contained"
                              size="large"
                              startIcon={<Upgrade />}
                              onClick={() => {
                                const professionStr = typeof profession === 'string' ? profession : 'photographer';
                                window.location.href = `/subscription?profession=${professionStr}`;
                              }}
                              fullWidth
                              sx={{ 
                                mt: 2,
                                bgcolor: theming.colors.success,
                                color: '#fff',
                                fontWeight: 700,
                                py: 2,
                                fontSize: '1.1rem',
                                transition: 'all 0.3s',
                                boxShadow: `0 4px 12px ${theming.colors.success}30`,
                                '&:hover': {
                                  bgcolor: theming.colors.success,
                                  filter: 'brightness(0.9)',
                                  transform: 'translateY(-2px)',
                                  boxShadow: `0 8px 20px ${theming.colors.success}40`
                                }
                              }}
                            >
                              Oppgrader for å låse opp
                            </Button>
                          </Stack>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </MuiCard>
              )}
            </Stack>
          </Box>
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