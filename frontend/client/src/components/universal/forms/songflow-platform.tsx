import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import {
  LibraryMusic,
  CloudDone,
  PlayArrow,
  Pause,
  Stop,
  VolumeUp,
  Equalizer,
  Album,
  Mic,
  AddCircle as Add,
  Save,
  Backup,
  Sync,
  CloudQueue as GoogleDrive,
  AccessTime,
  Person,
  Star,
  AccountBalance,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../hooks/useDynamicProfessions';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  genre: string;
  status: 'recording' | 'mixing' | 'mastering' | 'completed';
  bpm: number;
  key: string;
  googleDriveBackup?: boolean;
  lastBackup?: string;
  collaborators: string[];
  notes: string;
  stemFiles: number;
  projectId?: string;
  projectName?: string;
}

interface SongFlowProject {
  id: string;
  name: string;
  artist: string;
  tracks: Track[];
  status: 'active' | 'completed' | 'on-hold';
  deadline?: string;
  googleWorkspaceSync: boolean;
  lastSync?: string;
}

export default function SongFlowPlatform() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Profession context
  const { professionConfigs } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const { getProjectTypes, getDefaultHourlyRate } = professionAdapter;
  const professionKey = apiProfessionConfigs?.music_producer
    ? 'music_producer'
    : professionConfigs?.music_producer
    ? 'music_producer'
    : 'photographer';
  const professionDisplayName =
    apiProfessionConfigs?.[professionKey]?.displayName ||
    professionConfigs?.[professionKey]?.displayName ||
    'Musikkprodusent';
  const professionIcon = getProfessionIcon(professionKey);
  const theming = useTheming(professionKey);

  const [activeTab, setActiveTab] = useState(0);
  const [showNewTrackDialog, setShowNewTrackDialog] = useState(false);
  const [showBackupStatus, setShowBackupStatus] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupSeverity, setBackupSeverity] = useState<'success' | 'error'>('success');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [collaboratorsInput, setCollaboratorsInput] = useState('');

  const cloudDoneIcon = theming.getThemedIcon('cloudDone') || <CloudDone />;
  const addIcon = theming.getThemedIcon('add') || <Add />;
  const libraryIcon = theming.getThemedIcon('libraryMusic') || <LibraryMusic />;
  const personIcon = theming.getThemedIcon('person') || <Person />;
  const playIcon = theming.getThemedIcon('play') || <PlayArrow />;
  const volumeIcon = theming.getThemedIcon('volumeUp') || <VolumeUp />;
  const projectTypes = getProjectTypes();
  const defaultHourlyRate = getDefaultHourlyRate();

  // Fetch Song Flow projects with real database integration
  const { data: projects = [], isLoading: projectsLoading } = useQuery<SongFlowProject[]>({
    queryKey: ['/api/songflow-projects'],
    queryFn: () => apiRequest('/api/songflow-projects'),
    enabled: true,
  });

  // Create new track mutation
  const createTrackMutation = useMutation({
    mutationFn: async (trackData: Omit<Track, 'id' | 'duration' | 'googleDriveBackup' | 'lastBackup'>) =>
      apiRequest('/api/songflow-tracks', {
        method: 'POST',
        body: {
          ...trackData,
          googleDriveBackup: true,
          createdAt: new Date().toISOString(),
          status: 'recording',
          duration: 0,
          stemFiles: trackData.stemFiles ?? 0,
          collaborators: trackData.collaborators ?? [],
          notes: trackData.notes ?? ''
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-tracks'] });
      setShowNewTrackDialog(false);
      setNewTrack({
        title: '',
        artist: '',
        genre: 'pop',
        bpm: 120,
        key: 'C',
        notes: '',
        stemFiles: 0,
        collaborators: [],
        projectId: ''
      });
      setCollaboratorsInput('');
      setBackupSeverity('success');
      setBackupMessage('Spor opprettet og automatisk sikkerhetskopiert til Google Drive.');
      setShowBackupStatus(true);
    },
  });

  const [newTrack, setNewTrack] = useState({
    title: '',
    artist: '',
    genre: 'pop',
    bpm: 120,
    key: 'C',
    notes: '',
    stemFiles: 0,
    collaborators: [] as string[],
    projectId: ''
  });

  // Google Drive backup mutation
  const backupToGoogleDrive = useMutation({
    mutationFn: async (trackId: string) =>
      apiRequest(`/api/songflow-tracks/${trackId}/backup`, {
        method: 'POST',
        body: {
          backupType: 'google-drive',
          includeStems: true,
          includeMixes: true,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-tracks'] });
      setBackupSeverity('success');
      setBackupMessage('Backup gjennomfort for valgt spor.');
      setShowBackupStatus(true);
    },
    onError: () => {
      setBackupSeverity('error');
      setBackupMessage('Backup feilet. Prov igjen.');
      setShowBackupStatus(true);
    }
  });

  const handleCreateTrack = () => {
    if (!newTrack.title || !newTrack.artist) return;
    const collaborators = collaboratorsInput
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    createTrackMutation.mutate({
      ...newTrack,
      collaborators,
    });
  };

  const handleManualBackup = async () => {
    if (tracksData.length === 0) {
      setBackupSeverity('error');
      setBackupMessage('Ingen spor tilgjengelig for manuell backup.');
      setShowBackupStatus(true);
      return;
    }

    try {
      await Promise.all(
        tracksData.map((track) =>
          apiRequest(`/api/songflow-tracks/${track.id}/backup`, {
            method: 'POST',
            body: {
              backupType: 'google-drive',
              includeStems: true,
              includeMixes: true,
            },
          })
        )
      );
      setBackupSeverity('success');
      setBackupMessage('Manuell backup gjennomfort for alle spor.');
      setShowBackupStatus(true);
    } catch (error) {
      console.error('Manual backup failed:', error);
      setBackupSeverity('error');
      setBackupMessage('Manuell backup feilet. Prov igjen.');
      setShowBackupStatus(true);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-tracks'] });
    }
  };

  const handleProjectBackup = async (project: SongFlowProject) => {
    if (project.tracks.length === 0) {
      setBackupSeverity('error');
      setBackupMessage('Prosjektet har ingen spor a sikkerhetskopiere.');
      setShowBackupStatus(true);
      return;
    }

    try {
      await Promise.all(
        project.tracks.map((track) =>
          apiRequest(`/api/songflow-tracks/${track.id}/backup`, {
            method: 'POST',
            body: {
              backupType: 'google-drive',
              includeStems: true,
              includeMixes: true,
            },
          })
        )
      );
      setBackupSeverity('success');
      setBackupMessage(`Backup gjennomfort for prosjektet ${project.name}.`);
      setShowBackupStatus(true);
    } catch (error) {
      console.error('Project backup failed:', error);
      setBackupSeverity('error');
      setBackupMessage(`Backup feilet for prosjektet ${project.name}. Prov igjen.`);
      setShowBackupStatus(true);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/songflow-tracks'] });
    }
  };

  const handlePlaybackToggle = (trackId: string) => {
    if (playingTrackId === trackId) {
      if (playbackState === 'playing') {
        setPlaybackState('paused');
      } else {
        setPlaybackState('playing');
      }
    } else {
      setPlayingTrackId(trackId);
      setPlaybackState('playing');
    }
  };

  const handleStopPlayback = () => {
    setPlaybackState('stopped');
    setPlayingTrackId(null);
  };

  // Database connection for tracks
  const { data: tracksData = [], isLoading: tracksLoading } = useQuery<Track[]>({
    queryKey: ['/api/songflow-tracks'],
    queryFn: () => apiRequest('/api/songflow-tracks'),
    retry: false,
  });
  const hasRecordingTracks = tracksData.some((track) => track.status === 'recording');

  useEffect(() => {
    if (!showBackupStatus) return;
    const timeout = setTimeout(() => setShowBackupStatus(false), 4000);
    return () => clearTimeout(timeout);
  }, [showBackupStatus]);

  const TabPanel = ({
    children,
    value,
    index,
}: {
    children: React.ReactNode;
    value: number;
    index: number;
}) => (
    <div hidden={value !== index}>{value === index && <Box sx={{ py:  3 }}>{children}</Box>}</div>
  );

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box
        sx={{
          mb:  4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center' }}
      >
        <Box>
          <Typography variant="h4"
            sx={{ 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap:  2 }}>
            {professionIcon || libraryIcon}
            Song Flow Platform
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {professionDisplayName} • Avansert musikkproduksjon med Google services integrasjon
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Standard timesats: {defaultHourlyRate} kr/time • {projectTypes.length} prosjekttyper tilgjengelig
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap:  2 }}>
          <Button
            variant="outlined"
            startIcon={cloudDoneIcon}
            color="success"
            onClick={handleManualBackup}
            disabled={tracksLoading || tracksData.length === 0}
          >
            Google Drive Sync
          </Button>
          <Button variant="outlined" startIcon={<AccountBalance />} onClick={() => setLocation('/dashboard')}>
            Split Sheets
          </Button>
          <Button variant="contained"
            startIcon={addIcon}
            onClick={() => setShowNewTrackDialog(true)}
          >
            Nytt Spor
          </Button>
        </Box>
      </Box>

      {/* Google Services Status */}
      <Alert
        severity="success"
        sx={{ mb:  3, display: 'flex', alignItems: 'center' }}
        icon={<GoogleDrive />}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600}>
            Google Workspace Integration Aktiv
          </Typography>
          <Typography variant="caption">
            Automatisk backup til Google Drive • Sanntids samarbeid • Intelligent mixing suggestions
          </Typography>
        </Box>
      </Alert>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Aktive Spor" icon={libraryIcon} />
          <Tab label="Prosjekter" icon={<Album />} />
          <Tab label="Google Services" icon={cloudDoneIcon} />
          <Tab label="Samarbeid" icon={personIcon} />
        </Tabs>
      </Box>

      {/* Active Tracks Tab */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Mic color={hasRecordingTracks ? 'error' : 'disabled'} />
          <Typography variant="body2" color="text.secondary">
            {hasRecordingTracks ? 'Opptak i gang' : 'Ingen aktive opptak'}
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {tracksLoading ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', p:  3 }}>
                <Typography>Laster tracks...</Typography>
              </Box>
            </Grid>
          ) : tracksData.length > 0 ? (
            tracksData.map((track: Track) => (
              <Grid item xs={12} key={track.id}>
                <MuiCard
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white' }}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                          <IconButton sx={{ color: 'white' }} onClick={() => handlePlaybackToggle(track.id)}>
                            {playingTrackId === track.id && playbackState === 'playing' ? (
                              <Pause />
                            ) : (
                              playIcon
                            )}
                          </IconButton>
                          <Box>
                            <Typography variant="h6" sx={{  fontWeight: 600}}>
                              {track.title}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9}}>
                              {track.artist} • {Math.floor(track.duration / 60)}:
                              {(track.duration % 60).toString().padStart(2, '0')}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={track.status}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(25,255,255,0.2)',
                              color: 'white' }}
                          />
                          <Chip
                            label={`${track.bpm} BPM`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(25,255,255,0.2)',
                              color: 'white' }}
                          />
                          <Chip
                            label={track.key}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(25,255,255,0.2)',
                              color: 'white' }}
                          />
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <CloudDone sx={{ color: 'lightgreen' }} />
                          <Typography variant="caption">
                            Google Drive backup:{' '}
                            {track.lastBackup
                              ? new Date(track.lastBackup).toLocaleString('nb-NO')
                              : 'Ikke sikkerhetskopiert'}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ opacity: 0.8}}>
                          {track.stemFiles} stem files • {track.collaborators.length} collaborators
                        </Typography>
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <Box sx={{ display: 'flex', gap:  1, flexDirection: 'column' }}>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AccountBalance />}
                            onClick={async () => {
                              try {
                                await apiRequest(`/api/split-sheets/from-songflow/${track.id}`, {
                                  method: 'POST',
                                  body: {
                                    projectId: track.projectId,
                                    title: `Split Sheet - ${track.title}`,
                                    description: `Auto-opprettet fra SongFlow, track: ${track.title}`
                                  }
                                });
                                alert('Split Sheet opprettet!');
                                // Navigate to split sheets tab or show the created sheet
                              } catch (error) {
                                console.error('Error creating split sheet: ', error);
                                alert('Feil ved opprettelse av split sheet');
                              }
                            }}
                            sx={{ 
                              bgcolor: '#9f7aea',
                              color: 'white','&:hover': { bgcolor: '#8e6ed6' },
                              fontSize: '0.7rem',
                              mb: 0.5
                            }}
                          >
                            Opprett Split Sheet
                          </Button>
                          <Box sx={{ display: 'flex', gap:  1 }}>
                            <IconButton
                              size="small"
                              sx={{ color: 'white' }}
                              onClick={() => backupToGoogleDrive.mutate(track.id)}
                            >
                              <Backup />
                            </IconButton>
                            <IconButton size="small" sx={{ color: 'white' }} onClick={() => handlePlaybackToggle(track.id)}>
                              {playbackState === 'paused' && playingTrackId === track.id ? playIcon : <Equalizer />}
                            </IconButton>
                            <IconButton size="small" sx={{ color: 'white' }}>
                              {volumeIcon}
                            </IconButton>
                            <IconButton size="small" sx={{ color: 'white' }} onClick={handleStopPlayback}>
                              <Stop />
                            </IconButton>
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>

                    {track.notes && (
                      <Box
                        sx={{
                          mt:  2,
                          p:  2,
                          bgcolor: 'rgba(25,255,255,0.1)',
                          borderRadius:  1}}
                      >
                        <Typography variant="body2">💭 {track.notes}</Typography>
                      </Box>
                    )}
                  </CardContent>
                </MuiCard>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <MuiCard>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" align="center" color="text.secondary" sx={{ color: theming.colors.primary }}>
                    Ingen tracks funnet
                  </Typography>
                  <Typography variant="body2" align="center" color="text.secondary">
                    Tracks vil vises her når de er lagt til i systemet
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Projects Tab */}
      <TabPanel value={activeTab} index={1}>
        <Typography variant="h6" sx={{  mb:  2  }}>
          Musikkprosjekter
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {projectTypes.map((projectType) => (
            <Chip
              key={projectType.value}
              label={
                projectType.defaultHours
                  ? `${projectType.label} (${projectType.defaultHours}t)`
                  : projectType.label
              }
              size="small"
              sx={{ bgcolor: 'rgba(25,255,255,0.2)', color: 'white' }}
            />
          ))}
        </Box>
        <Grid container spacing={2}>
          {projectsLoading ? (
            <Grid item xs={12}>
              <MuiCard>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Laster prosjekter...
                  </Typography>
                  <LinearProgress />
                </CardContent>
              </MuiCard>
            </Grid>
          ) : projects.length > 0 ? (
            projects.map((project) => (
              <Grid item xs={12} md={6} key={project.id}>
                <MuiCard>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                          {project.name}
                        </Typography>
                        <Typography color="text.secondary">
                          {project.tracks.length} spor • Status: {project.status}
                        </Typography>
                      </Box>
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={() => handleProjectBackup(project)}
                          disabled={project.tracks.length === 0}
                        >
                          <Backup />
                        </IconButton>
                        <IconButton size="small" onClick={() => setShowNewTrackDialog(true)}>
                          <Add />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={project.status === 'completed' ? 100 : project.status === 'on-hold' ? 40 : 70}
                      sx={{ mt: 2 }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="caption">
                        Artist: {project.artist}
                      </Typography>
                      <Typography variant="caption">
                        {project.deadline
                          ? `Deadline: ${new Date(project.deadline).toLocaleDateString('nb-NO')}`
                          : 'Ingen deadline'}
                      </Typography>
                    </Box>
                    {project.lastSync && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <AccessTime fontSize="small" color="action" />
                        <Typography variant="caption">
                          Sist synket: {new Date(project.lastSync).toLocaleString('nb-NO')}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </MuiCard>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <MuiCard>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    Ingen prosjekter tilgjengelig
                  </Typography>
                  <Typography color="text.secondary">
                    Prosjektene dine vises her nar de er opprettet.
                  </Typography>
                </CardContent>
              </MuiCard>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Google Services Tab */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6"
                  sx={{  display: 'flex', alignItems: 'center', gap: 1, mb: 2  }}>
                  <GoogleDrive color="primary" />
                  Google Drive Integration
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CloudDone color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Automatisk backup"
                      secondary="Alle spor og stemfiler synkroniseres automatisk"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Sync color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sanntids samarbeid"
                      secondary="Del prosjekter med artister og andre produsenter"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Star color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Intelligent insights"
                      secondary="Få forslag til mixing og mastering basert på genre"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </MuiCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  mb:  2  }}>
                  Backup Status
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                  Siste backup: {new Date().toLocaleString('nb-NO')}
                </Typography>
                <Button variant="contained"
                  startIcon={<Backup />}
                  fullWidth
                  onClick={handleManualBackup}
                >
                  Start Manuell Backup
                </Button>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Collaboration Tab */}
      <TabPanel value={activeTab} index={3}>
        <Typography variant="h6" sx={{  mb:  2  }}>
          Aktive Samarbeidsprosjekter
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <MuiCard>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>Sanntids Google Workspace Samarbeid</Typography>
                <Typography color="text.secondary" sx={{ mb:  2 }}>
                  Del og samarbeid på musikkprosjekter i sanntid med Google Drive og Docs
                  integration
                </Typography>
                <Alert severity="info">
                  Song Flow er spesielt designet for musikkprodusenter med full Google services
                  integrasjon
                </Alert>
              </CardContent>
            </MuiCard>
          </Grid>
        </Grid>
      </TabPanel>

      {/* New Track Dialog */}
      <Dialog
        open={showNewTrackDialog}
        onClose={() => setShowNewTrackDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Opprett Nytt Spor</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid item xs={12}>
              <TextField
                label="Sporets tittel"
                fullWidth
                value={newTrack.title}
                onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Artist"
                fullWidth
                value={newTrack.artist}
                onChange={(e) => setNewTrack({ ...newTrack, artist: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Prosjekt</InputLabel>
                <Select
                  label="Prosjekt"
                  value={newTrack.projectId}
                  onChange={(e) => setNewTrack({ ...newTrack, projectId: e.target.value })}
                >
                  <MenuItem value="">Ingen</MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} >
              <FormControl fullWidth>
                <InputLabel>Genre</InputLabel>
                <Select
                  value={newTrack.genre}
                  onChange={(e) => setNewTrack({ ...newTrack, genre: e.target.value })}
                >
                  <MenuItem value="pop">Pop</MenuItem>
                  <MenuItem value="electronic">Electronic</MenuItem>
                  <MenuItem value="hip-hop">Hip-Hop</MenuItem>
                  <MenuItem value="rock">Rock</MenuItem>
                  <MenuItem value="jazz">Jazz</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3} >
              <TextField
                label="BPM"
                type="number"
                fullWidth
                value={newTrack.bpm}
                onChange={(e) => setNewTrack({ ...newTrack, bpm: parseInt(e.target.value, 10) })}
              />
            </Grid>
            <Grid item xs={3} >
              <FormControl fullWidth>
                <InputLabel>Toneart</InputLabel>
                <Select
                  value={newTrack.key}
                  onChange={(e) => setNewTrack({ ...newTrack, key: e.target.value })}
                >
                  <MenuItem value="C">C</MenuItem>
                  <MenuItem value="C#">C#</MenuItem>
                  <MenuItem value="D">D</MenuItem>
                  <MenuItem value="D#">D#</MenuItem>
                  <MenuItem value="E">E</MenuItem>
                  <MenuItem value="F">F</MenuItem>
                  <MenuItem value="F#">F#</MenuItem>
                  <MenuItem value="G">G</MenuItem>
                  <MenuItem value="G#">G#</MenuItem>
                  <MenuItem value="A">A</MenuItem>
                  <MenuItem value="A#">A#</MenuItem>
                  <MenuItem value="B">B</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={3}>
              <TextField
                label="Stemfiler"
                type="number"
                fullWidth
                value={newTrack.stemFiles}
                onChange={(e) => setNewTrack({ ...newTrack, stemFiles: Number(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Medskapere (kommaseparert)"
                fullWidth
                value={collaboratorsInput}
                onChange={(e) => setCollaboratorsInput(e.target.value)}
                helperText="Eksempel: Kari Nordmann, Ola Nordmann"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notater"
                fullWidth
                multiline
                minRows={3}
                value={newTrack.notes}
                onChange={(e) => setNewTrack({ ...newTrack, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewTrackDialog(false)}>Avbryt</Button>
          <Button variant="contained"
            startIcon={<Save />}
            onClick={handleCreateTrack}
            disabled={createTrackMutation.isPending || !newTrack.title || !newTrack.artist}
           sx={theming.getThemedButtonSx()}>
            {createTrackMutation.isPending ? 'Oppretter...' : 'Opprett Spor'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Zero Toast Compliance - Backup status shown inline */}
      {showBackupStatus && (
        <Box sx={{ position: 'fixed', bottom:  20, right:  20, zIndex: 150}}>
          <Alert
            severity={backupSeverity}
            onClose={() => setShowBackupStatus(false)}
            sx={{
              bgcolor: backupSeverity === 'success'
                ? 'rgba(6, 175, 80, 0.9)'
                : 'rgba(185, 28, 28, 0.9)',
              color: 'white',
              boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}
          >
            {backupMessage}
          </Alert>
        </Box>
      )}
    </Box>
  );
}
