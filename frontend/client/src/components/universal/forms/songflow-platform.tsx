import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Album,
  Backup,
  CloudDone,
  CloudQueue,
  Equalizer,
  LibraryMusic,
  Mic,
  Pause,
  PlayArrow,
  Stop,
  Sync,
  VolumeUp,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

type TrackStatus = 'recording' | 'mixing' | 'mastering' | 'completed';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  genre: string;
  status: TrackStatus;
  bpm: number;
  key: string;
  googleDriveBackup: boolean;
  lastBackup: string;
  collaborators: string[];
  notes: string;
  lyrics: string;
  stemFiles: number;
  projectId: string;
}

interface SongFlowProject {
  id: string;
  name: string;
  artist: string;
  tracks: Track[];
  status: 'active' | 'completed' | 'on-hold';
  deadline: string;
  googleWorkspaceSync: boolean;
  lastSync: string;
}

interface NewTrackInput {
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  notes: string;
  lyrics: string;
  stemFiles: number;
  projectId: string;
  collaborators: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asTrackStatus(value: unknown): TrackStatus {
  if (value === 'recording' || value === 'mixing' || value === 'mastering' || value === 'completed') {
    return value;
  }
  return 'recording';
}

function parseTrack(raw: unknown): Track | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = asString(raw.id);
  const title = asString(raw.title);
  const artist = asString(raw.artist);

  if (!id || !title || !artist) {
    return null;
  }

  return {
    id,
    title,
    artist,
    duration: asNumber(raw.duration),
    genre: asString(raw.genre, 'pop'),
    status: asTrackStatus(raw.status),
    bpm: asNumber(raw.bpm, 120),
    key: asString(raw.key, 'C'),
    googleDriveBackup: raw.googleDriveBackup === true,
    lastBackup: asString(raw.lastBackup),
    collaborators: asArray(raw.collaborators).map((item) => asString(item)).filter((item) => item.length > 0),
    notes: asString(raw.notes),
    lyrics: asString(raw.lyrics),
    stemFiles: asNumber(raw.stemFiles),
    projectId: asString(raw.projectId),
  };
}

function parseProject(raw: unknown): SongFlowProject | null {
  if (!isRecord(raw)) {
    return null;
  }

  const id = asString(raw.id);
  const name = asString(raw.name);
  const artist = asString(raw.artist);

  if (!id || !name || !artist) {
    return null;
  }

  const parsedTracks = asArray(raw.tracks)
    .map(parseTrack)
    .filter((track): track is Track => track !== null);

  const statusValue = asString(raw.status);
  const status: SongFlowProject['status'] =
    statusValue === 'completed' || statusValue === 'on-hold' || statusValue === 'active' ? statusValue : 'active';

  return {
    id,
    name,
    artist,
    tracks: parsedTracks,
    status,
    deadline: asString(raw.deadline),
    googleWorkspaceSync: raw.googleWorkspaceSync === true,
    lastSync: asString(raw.lastSync),
  };
}

const FALLBACK_TRACKS: Track[] = [
  {
    id: 'demo-track-1',
    title: 'Story Arc Intro Theme',
    artist: 'CreatorHub Studio',
    duration: 132,
    genre: 'cinematic',
    status: 'mixing',
    bpm: 118,
    key: 'Dm',
    googleDriveBackup: true,
    lastBackup: new Date().toISOString(),
    collaborators: ['Producer', 'Editor'],
    notes: 'Needs stronger transition into chorus.',
    lyrics: 'Instrumental concept',
    stemFiles: 12,
    projectId: 'demo-project',
  },
];

const FALLBACK_PROJECTS: SongFlowProject[] = [
  {
    id: 'demo-project',
    name: 'Wedding Story Suite',
    artist: 'CreatorHub Studio',
    tracks: FALLBACK_TRACKS,
    status: 'active',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    googleWorkspaceSync: true,
    lastSync: new Date().toISOString(),
  },
];

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function formatDateTime(value: string): string {
  if (!value) {
    return 'Never';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }
  return date.toLocaleString('nb-NO');
}

async function fetchTracks(): Promise<Track[]> {
  try {
    const response = await apiRequest('/api/easeverse-tracks');
    const parsed = asArray(response).map(parseTrack).filter((track): track is Track => track !== null);
    return parsed.length > 0 ? parsed : FALLBACK_TRACKS;
  } catch {
    return FALLBACK_TRACKS;
  }
}

async function fetchProjects(): Promise<SongFlowProject[]> {
  try {
    const response = await apiRequest('/api/easeverse-projects');
    const parsed = asArray(response).map(parseProject).filter((project): project is SongFlowProject => project !== null);
    return parsed.length > 0 ? parsed : FALLBACK_PROJECTS;
  } catch {
    return FALLBACK_PROJECTS;
  }
}

export default function SongFlowPlatform(): JSX.Element {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState(0);
  const [showNewTrackDialog, setShowNewTrackDialog] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [statusAlert, setStatusAlert] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [newTrack, setNewTrack] = useState<NewTrackInput>({
    title: '',
    artist: '',
    genre: 'pop',
    bpm: 120,
    key: 'C',
    notes: '',
    lyrics: '',
    stemFiles: 0,
    projectId: '',
    collaborators: '',
  });

  const tracksQuery = useQuery<Track[]>({
    queryKey: ['easeverse-tracks'],
    queryFn: fetchTracks,
  });

  const projectsQuery = useQuery<SongFlowProject[]>({
    queryKey: ['easeverse-projects'],
    queryFn: fetchProjects,
  });

  const createTrackMutation = useMutation<unknown, Error, NewTrackInput>({
    mutationFn: async (payload) => {
      const collaborators = payload.collaborators
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      return apiRequest('/api/easeverse-tracks', {
        method: 'POST',
        body: {
          ...payload,
          collaborators,
          status: 'recording',
          duration: 0,
          googleDriveBackup: true,
          lastBackup: new Date().toISOString(),
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['easeverse-tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['easeverse-projects'] });
      setShowNewTrackDialog(false);
      setStatusAlert({ severity: 'success', message: 'Track created and synced to Google Drive.' });
      setNewTrack({
        title: '',
        artist: '',
        genre: 'pop',
        bpm: 120,
        key: 'C',
        notes: '',
        lyrics: '',
        stemFiles: 0,
        projectId: '',
        collaborators: '',
      });
    },
    onError: () => {
      setStatusAlert({ severity: 'error', message: 'Failed to create track.' });
    },
  });

  const backupTrackMutation = useMutation<unknown, Error, string>({
    mutationFn: async (trackId) =>
      apiRequest(`/api/easeverse-tracks/${trackId}/backup`, {
        method: 'POST',
        body: {
          backupType: 'google-drive',
          includeStems: true,
          includeMixes: true,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['easeverse-tracks'] });
      setStatusAlert({ severity: 'success', message: 'Backup completed.' });
    },
    onError: () => {
      setStatusAlert({ severity: 'error', message: 'Backup failed.' });
    },
  });

  const syncLyricsMutation = useMutation<unknown, Error, { trackId: string; lyrics: string }>({
    mutationFn: async ({ trackId, lyrics }) =>
      apiRequest(`/api/easeverse-tracks/${trackId}/sync-lyrics`, {
        method: 'POST',
        body: {
          lyrics,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['easeverse-tracks'] });
      setStatusAlert({ severity: 'success', message: 'Lyrics synced.' });
    },
    onError: () => {
      setStatusAlert({ severity: 'error', message: 'Lyrics sync failed.' });
    },
  });

  const tracks = tracksQuery.data ?? FALLBACK_TRACKS;
  const projects = projectsQuery.data ?? FALLBACK_PROJECTS;

  const collaborators = useMemo(() => {
    const unique = new Set<string>();
    tracks.forEach((track) => {
      track.collaborators.forEach((name) => {
        unique.add(name);
      });
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [tracks]);

  const handlePlaybackToggle = (trackId: string) => {
    if (playingTrackId === trackId) {
      setPlaybackState((previous) => (previous === 'playing' ? 'paused' : 'playing'));
      return;
    }

    setPlayingTrackId(trackId);
    setPlaybackState('playing');
  };

  const handleStop = () => {
    setPlaybackState('stopped');
    setPlayingTrackId(null);
  };

  const handleCreateTrack = () => {
    if (!newTrack.title.trim() || !newTrack.artist.trim()) {
      setStatusAlert({ severity: 'error', message: 'Title and artist are required.' });
      return;
    }

    createTrackMutation.mutate(newTrack);
  };

  const handleBackupAll = async () => {
    try {
      await Promise.all(
        tracks.map((track) =>
          apiRequest(`/api/easeverse-tracks/${track.id}/backup`, {
            method: 'POST',
            body: {
              backupType: 'google-drive',
              includeStems: true,
              includeMixes: true,
            },
          })
        )
      );
      void queryClient.invalidateQueries({ queryKey: ['easeverse-tracks'] });
      setStatusAlert({ severity: 'success', message: 'All tracks backed up to Google Drive.' });
    } catch {
      setStatusAlert({ severity: 'error', message: 'Bulk backup failed.' });
    }
  };

  const hasRecordingTracks = tracks.some((track) => track.status === 'recording');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
            <LibraryMusic fontSize="large" />
            SongFlow Platform
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage tracks, backups, lyrics sync, and collaboration inside Story Arc Studio.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<CloudDone />} onClick={handleBackupAll} disabled={tracks.length === 0}>
            Backup all
          </Button>
          <Button variant="outlined" startIcon={<Album />} onClick={() => setLocation('/dashboard')}>
            Split sheets
          </Button>
          <Button variant="contained" startIcon={<Mic />} onClick={() => setShowNewTrackDialog(true)}>
            New track
          </Button>
        </Box>
      </Box>

      {statusAlert ? (
        <Alert severity={statusAlert.severity} sx={{ mb: 2 }} onClose={() => setStatusAlert(null)}>
          {statusAlert.message}
        </Alert>
      ) : null}

      <Alert severity="success" icon={<CloudQueue />} sx={{ mb: 2 }}>
        Google Workspace integration enabled for project backup and collaborator sharing.
      </Alert>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
        <Tab label="Tracks" />
        <Tab label="Projects" />
        <Tab label="Google Services" />
        <Tab label="Collaboration" />
      </Tabs>

      {activeTab === 0 ? (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Mic color={hasRecordingTracks ? 'error' : 'disabled'} />
            <Typography variant="body2" color="text.secondary">
              {hasRecordingTracks ? 'At least one track is recording now.' : 'No active recording track.'}
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {(tracksQuery.isLoading ? FALLBACK_TRACKS : tracks).map((track) => (
              <Grid item xs={12} key={track.id}>
                <Card>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconButton onClick={() => handlePlaybackToggle(track.id)}>
                            {playingTrackId === track.id && playbackState === 'playing' ? <Pause /> : <PlayArrow />}
                          </IconButton>
                          <IconButton onClick={handleStop}>
                            <Stop />
                          </IconButton>
                          <IconButton>
                            <VolumeUp />
                          </IconButton>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {track.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {track.artist} • {formatDuration(track.duration)}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          <Chip size="small" label={track.status} />
                          <Chip size="small" label={`${track.bpm} BPM`} variant="outlined" />
                          <Chip size="small" label={track.key} variant="outlined" />
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={3}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Last backup: {formatDateTime(track.lastBackup)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Stem files: {track.stemFiles}
                        </Typography>
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                          <IconButton onClick={() => backupTrackMutation.mutate(track.id)}>
                            <Backup />
                          </IconButton>
                          <IconButton
                            onClick={() =>
                              syncLyricsMutation.mutate({
                                trackId: track.id,
                                lyrics: track.lyrics || track.notes,
                              })
                            }
                          >
                            <Sync />
                          </IconButton>
                          <IconButton>
                            <Equalizer />
                          </IconButton>
                        </Box>
                      </Grid>
                    </Grid>

                    {track.notes ? (
                      <Alert severity="info" sx={{ mt: 1.5 }}>
                        {track.notes}
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : null}

      {activeTab === 1 ? (
        <Grid container spacing={2}>
          {(projectsQuery.isLoading ? FALLBACK_PROJECTS : projects).map((project) => (
            <Grid item xs={12} md={6} key={project.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {project.artist}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
                    <Chip size="small" label={project.status} />
                    <Chip size="small" label={`${project.tracks.length} tracks`} variant="outlined" />
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Deadline: {project.deadline || 'No deadline'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    Last sync: {formatDateTime(project.lastSync)}
                  </Typography>

                  <LinearProgress variant="determinate" value={project.status === 'completed' ? 100 : project.status === 'on-hold' ? 40 : 70} sx={{ mb: 1.5 }} />

                  <Button
                    size="small"
                    startIcon={<Backup />}
                    onClick={() => {
                      Promise.all(
                        project.tracks.map((track) =>
                          apiRequest(`/api/easeverse-tracks/${track.id}/backup`, {
                            method: 'POST',
                            body: {
                              backupType: 'google-drive',
                              includeStems: true,
                              includeMixes: true,
                            },
                          })
                        )
                      )
                        .then(() => {
                          setStatusAlert({ severity: 'success', message: `Project backup complete: ${project.name}` });
                        })
                        .catch(() => {
                          setStatusAlert({ severity: 'error', message: `Project backup failed: ${project.name}` });
                        })
                        .finally(() => {
                          void queryClient.invalidateQueries({ queryKey: ['easeverse-tracks'] });
                          void queryClient.invalidateQueries({ queryKey: ['easeverse-projects'] });
                        });
                    }}
                  >
                    Backup project
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : null}

      {activeTab === 2 ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Drive Backup
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tracks are automatically backup-eligible with one-click manual backup for all.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Lyrics Sync
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sync current lyrics to EaseVerse endpoint for shared writing workflows.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  Realtime Health
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active tracks: {tracks.length} • Projects: {projects.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : null}

      {activeTab === 3 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Collaborators
            </Typography>
            <List dense>
              {collaborators.map((name) => (
                <ListItem key={name} divider>
                  <ListItemText primary={name} secondary="Active contributor" />
                  <ListItemSecondaryAction>
                    <Chip size="small" label="active" color="success" variant="outlined" />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {collaborators.length === 0 ? (
                <ListItem>
                  <ListItemText primary="No collaborators found" secondary="Add collaborators when creating a new track." />
                </ListItem>
              ) : null}
            </List>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showNewTrackDialog} onClose={() => setShowNewTrackDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Track</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
            <TextField
              label="Title"
              value={newTrack.title}
              onChange={(event) => setNewTrack((previous) => ({ ...previous, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Artist"
              value={newTrack.artist}
              onChange={(event) => setNewTrack((previous) => ({ ...previous, artist: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Genre"
              select
              value={newTrack.genre}
              onChange={(event) => setNewTrack((previous) => ({ ...previous, genre: event.target.value }))}
              fullWidth
            >
              <MenuItem value="pop">Pop</MenuItem>
              <MenuItem value="hiphop">Hip-hop</MenuItem>
              <MenuItem value="cinematic">Cinematic</MenuItem>
              <MenuItem value="electronic">Electronic</MenuItem>
            </TextField>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField
                  label="BPM"
                  type="number"
                  value={newTrack.bpm}
                  onChange={(event) =>
                    setNewTrack((previous) => ({
                      ...previous,
                      bpm: Number.parseInt(event.target.value, 10) || 120,
                    }))
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Key"
                  value={newTrack.key}
                  onChange={(event) => setNewTrack((previous) => ({ ...previous, key: event.target.value }))}
                  fullWidth
                />
              </Grid>
            </Grid>
            <TextField
              label="Collaborators (comma separated)"
              value={newTrack.collaborators}
              onChange={(event) => setNewTrack((previous) => ({ ...previous, collaborators: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Notes"
              value={newTrack.notes}
              onChange={(event) => setNewTrack((previous) => ({ ...previous, notes: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />
            <TextField
              label="Lyrics"
              value={newTrack.lyrics}
              onChange={(event) => setNewTrack((previous) => ({ ...previous, lyrics: event.target.value }))}
              multiline
              minRows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewTrackDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTrack} disabled={createTrackMutation.isPending}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
