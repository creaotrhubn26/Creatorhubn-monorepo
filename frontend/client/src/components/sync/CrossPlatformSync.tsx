/**
 * Cross-Platform Project Sync with Cloud Bookmarking
 * Provides seamless project synchronization across devices and platforms
 */

import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Alert,
  LinearProgress,
  Badge,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  CloudSync as SyncIcon,
  Bookmark as BookmarkIcon,
  Devices as DevicesIcon,
  PhoneAndroid as MobileIcon,
  Computer as ComputerIcon,
  TabletAndroid as TabletIcon,
  CloudDone as CloudDoneIcon,
  CloudOff as CloudOffIcon,
  Sync as RefreshIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { AnimatedComponent, AnimatedButton, AnimatedMuiCard } from '../animations/MicroAnimations';
import { useContextualAnimations } from '../../hooks/useContextualAnimations';

interface SyncProject {
  id: string;
  name: string;
  type: 'wedding' | 'portrait' | 'corporate' | 'music' | 'video';
  lastModified: string;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'offline';
  devices: Array<{
    id: string;
    name: string;
    type: 'mobile' | 'desktop' | 'tablet';
    lastSeen: string;
    isActive: boolean;
}>;
  bookmarks: Array<{
    id: string;
    title: string;
    url: string;
    type: 'inspiration' | 'client' | 'vendor' | 'reference';
    tags: string[];
    addedDate: string;
}>;
  cloudStorage: {
    googleDrive?: string;
    oneDrive?: string;
    dropbox?: string;
};
  isStarred: boolean;
  shareCode?: string
}

interface CrossPlatformSyncProps {
  userId?: string;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor'
}

export default function CrossPlatformSync({
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Database connection for CrossPlatformSync
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateCrossPlatformSync = useMutation({
    mutationFn: async (data: any) => 
      apiRequest('/api/component/update', {
        method: 'POS',
        body: JSON.stringify(data)
  }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/component', ],});
  }
});
 userId, profession }: CrossPlatformSyncProps) {
  const [projects, setProjects] = useState<SyncProject[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SyncProject | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(5); // minutes
  
  const { triggerSuccess, triggerError, triggerLoading, controls } = useContextualAnimations();

  useEffect(() => {
    loadProjects();
    setupAutoSync();
}, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/sync/projects', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem(',')}` }
    });
      const data = await response.json();
      setProjects(data.projects || []);
  } catch (error) {
      console.error('Failed to load projects: ', error);
      setProjects(mockProjects); // Fallback to mock data for demo
  }
};

  const setupAutoSync = () => {
    if (autoSync) {
      const interval = setInterval(() => {
        syncAllProjects();
    }, syncInterval * 60 * 1000);
      return () => clearInterval(interval);
  }
};

  const syncAllProjects = async () => {
    setSyncStatus('syncing');
    triggerLoading('Synkroniserer prosjekter...');

    try {
      // Sync with Google Drive
      const driveResponse = await fetch('/api/workspace/drive/sync-projects', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userd, projects: projects.map(p => p.id, ),})
    });

      if (driveResponse.ok) {
        const updatedProjects = projects.map(project => ({
          ...project,
          syncStatus: 'synced' as const,
          lastModified: new Date().toISOString()
    }));
        setProjects(updatedProjects);
        triggerSuccess('Alle prosjekter synkronisert');
    } else {
        throw new Error('Sync failed');
    }
  } catch (error) {
      console.error('Sync error:', error);
      triggerError('Synkronisering feilet');
  } finally {
      setSyncStatus('idle');
  }
};

  const syncSingleProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Update project status to syncing
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { .., .syncStatus: 'syncing' } : p
    ));

    try {
      const response = await fetch('/api/sync/project', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ projectd, userId })
    });

      if (response.ok) {
        setProjects(prev => prev.map(p => 
          p.id === projectId ? { 
            ...p, 
            syncStatus: 'synced',
            lastModified: new Date().toISOString()
      } : p
        ));
        triggerSuccess(`${project.name} synkronisert`);
    } else {
        throw new Error('Project sync failed');
    }
  } catch (error) {
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, syncStatus: 'pending' } : p
      ));
      triggerError(`Feil ved synkronisering av ${project.name}`);
  }
};

  const toggleBookmark = (projectId: string, bookmarkId: string) => {
    setProjects(prev => prev.map(project => {
      if (project.id === projectId) {
        return {
          ...project,
          bookmarks: project.bookmarks.map(bookmark => 
            bookmark.id === bookmarkId 
              ? { ...bookmark, isStarred: !bookmark.isStarred } 
              : bookmark
          )
      };
    }
      return project;
  }));
};

  const addBookmark = async (projectId: string, bookmarkData: {
    title: string;
    url: string;
    type: string;
    tags: string[];
}) => {
    const newBookmark = {
      id: Date.now().toString(),
      ...bookmarkData,
      addedDate: new Date().toISOString()
};

    setProjects(prev => prev.map(project => 
      project.id === projectId 
        ? { ...project, bookmarks: [...project.bookmarks, newBookmark] }
        : project
    ));

    triggerSuccess('Bokmerke lagt til');
};

  const shareProject = async (projectId: string) => {
    try {
      const response = await fetch('/api/sync/share-project', {
        method: 'POS',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ projectd, userId })
    });

      const data = await response.json();
      if (data.shareCode) {
        setProjects(prev => prev.map(p => 
          p.id === projectId ? { ...p, shareCode: data.shareCode } : p
        ));
        
        navigator.clipboard.writeText(`https: //creatorhubn.no/sync/${data.shareCode}`);
        triggerSuccess('Delingslenke kopiert til utklippstavle');
    }
  } catch (error) {
      triggerError('Feil ved deling av prosjekt');
  }
};

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <MobileIcon />;
      case 'tablet': return <TabletIcon />;
      case 'desktop': return <DesktopIcon />;
      default: return <DevicesIcon />;
}
};

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'success';
      case 'syncing': return 'info';
      case 'pending': return 'warning';
      case 'offline': return 'error';
      default: return 'default';
}
};

  const mockProjects: SyncProject[] = [
    {
      id: '',
      name: 'Bryllup - Kari og Ole',
      type: 'wedding',
      lastModified: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      syncStatus: 'synced',
      devices: [
        { id: '', name: 'iPhone 15 Pro', type: 'mobile', lastSeen: new Date().toISOString(), isActive: true },
        { id: '', name: 'MacBook Pro', type: 'desktop', lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(), isActive: false }
      ],
      bookmarks: [
        { id: ', ', title: 'Bryllupsinspirasjoner Pinterest', url: 'https://pinterest.com/wedding', type: 'inspiration', tags: ['rustic','outdoor'], addedDate: new Date().toISOString(),},
        { id: ', ', title: 'Lokale blomsterhandlere', url: 'https://local-florists.no', type: 'vendor', tags: ['flowers','local'], addedDate: new Date().toISOString(),}
      ],
      cloudStorage: { googleDrive: 'folder-id-123' },
      isStarred: true,
      shareCode: 'WED2025'
},
    {
      id: ', ',
      name: 'Bedriftsfotografering - Tech A',
      type: 'corporate',
      lastModified: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      syncStatus: 'pending',
      devices: [
        { id: ', ', name: 'iPad Pro', type: 'tablet', lastSeen: new Date(Date.now() - 1000 * 60 * 45).toISOString(), isActive: false }
      ],
      bookmarks: [
        { id: ', ', title: 'Corporate Photography Examples', url: 'https://corporate-photos.com', type: 'reference', tags: ['corporate','professional'], addedDate: new Date().toISOString(),}
      ],
      cloudStorage: { googleDrive: 'folder-id-456' },
      isStarred: false
}
  ];

  return (
    <Box>
      <AnimatedMuiCard>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
            <SyncIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5" sx={{ color: theming.colors.primary }}>
              Tverrplattform Prosjektsynkronisering
            </Typography>
            <Box sx={{ ml: 'auto', display: 'flex', gap:  1 }}>
              <AnimatedButton onClick={syncAllProjects} loading={syncStatus === 'syncing'}>
                <RefreshIcon />
                Synkroniser alle
              </AnimatedButton>
              <IconButton onClick={() => setShowSettings(true)}>
                <SettingsIcon />
              </IconButton>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {projects.map((project, index) => (
              <Grid item xs={12} md={6} key={project.id}>
                <AnimatedComponent variant="fadeIn" delay={index * 100}>
                  <MuiCard sx={{ mb: 2, border: project.isStarred ? '2px solid #fbbf24' : 'none' }}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb:  2 }}>
                        <Typography variant="h6" sx={{  flexGrow:  1  }}>
                          {project.name}
                        </Typography>
                        <IconButton 
                          onClick={() => setProjects(prev => prev.map(p => 
                            p.id === project.id ? { ...p, isStarred: !p.isStarred } : p
                          ))}
                        >
                          {project.isStarred ? <StarIcon sx={{ color: '#fbbf24' }} /> : <StarBorderIcon />}
                        </IconButton>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Chip 
                          size="small" 
                          label={project.type} 
                          color="primary" 
                          variant="outlined" 
                        />
                        <Chip 
                          size="small"
                          label={project.syncStatus}
                          color={getSyncStatusColor(project.syncStatus)}
                          icon={project.syncStatus === 'synced' ? <CloudDoneIcon /> : <CloudOffIcon />}
                        />
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        Sist endret: {new Date(project.lastModified).toLocaleString('')}
                      </Typography>

                      <Box sx={{ mb:  2 }}>
                        <Typography variant="subtitle2" sx={{ mb:  1 }}>
                          Aktive enheter ({project.devices.length})
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {project.devices.map(device => (
                            <Tooltip key={device.id} title={`Sist sett: ${new Date(device.lastSeen).toLocaleString(', ')}`}>
                              <Chip
                                size="small"
                                icon={getDeviceIcon(device.type)}
                                label={device.name}
                                color={device.isActive ? 'success' : 'default'}
                                variant={device.isActive ? 'filled' : 'outlined'}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </Box>

                      <Box sx={{ mb:  2 }}>
                        <Typography variant="subtitle2" sx={{ mb:  1 }}>
                          Bokmerker ({project.bookmarks.length})
                        </Typography>
                        <Badge badgeContent={project.bookmarks.length} color="primary">
                          <Button
                            size="small"
                            startIcon={<BookmarkIcon />}
                            onClick={() => {
                              setSelectedProject(project);
                              setShowBookmarks(true);
                          }}
                          >
                            Vis bokmerker
                          </Button>
                        </Badge>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap:  1 }}>
                          <AnimatedButton
                            size="small"
                            onClick={() => syncSingleProject(project.id)}
                            loading={project.syncStatus === 'syncing'}
                          >
                            <SyncIcon />
                            Synkroniser
                          </AnimatedButton>
                          <Button
                            size="small"
                            startIcon={<ShareIcon />}
                            onClick={() => shareProject(project.id)}
                          >
                            Del
                          </Button>
                        </Box>
                        {project.shareCode && (
                          <Chip 
                            size="small" 
                            label={`Kode: ${project.shareCode}`} 
                            color="secondary"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </MuiCard>
                </AnimatedComponent>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </AnimatedMuiCard>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Synkroniseringsinnstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ pt:  2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                />
            }
              label="Automatisk synkronisering"
            />
            
            <TextField
              fullWidth
              label="Synkroniseringsintervall (minutter)"
              type="number"
              value={syncInterval}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              disabled={!autoSync}
              sx={{ mt: 2, mb: 2 }}
            />

            <Divider sx={{ my:  2 }} />

            <Typography variant="subtitle1" sx={{ mb:  1 }}>
              Skylagring
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <CloudDoneIcon color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary="Google Drive" 
                  secondary="Tilkoblet og aktiv"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CloudOffIcon color="disabled" />
                </ListItemIcon>
                <ListItemText 
                  primary="Microsoft OneDrive" 
                  secondary="Ikke konfigurert"
                />
                <ListItemSecondaryAction>
                  <Button size="small">Koble til</Button>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Bookmarks Dialog */}
      <Dialog open={showBookmarks} onClose={() => setShowBookmarks(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Bokmerker - {selectedProject?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt:  1 }}>
            {selectedProject?.bookmarks.map((bookmark) => (
              <AnimatedMuiCard key={bookmark.id} sx={{ mb:  2 }}>
                <Box sx={{ p:  2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                    <Typography variant="subtitle1" sx={{ flexGrow:  1 }}>
                      {bookmark.title}
                    </Typography>
                    <IconButton
                      onClick={() => toggleBookmark(selectedProject.id, bookmark.id)}
                      size="small"
                    >
                      <BookmarkIcon />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                    {bookmark.url}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 0,flexWrap:'wrap' }}>
                    <Chip size="small" label={bookmark.type} color="primary" />
                    {bookmark.tags.map(tag => (
                      <Chip key={tag} size="small" label={tag} variant="outlined" />
                    ))}
                  </Box>
                </Box>
              </AnimatedMuiCard>
            ))}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}