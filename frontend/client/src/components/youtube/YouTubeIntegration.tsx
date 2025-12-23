import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  YouTube as YouTubeIcon,
  Upload as UploadIcon,
  Analytics as AnalyticsIcon,
  Visibility as VisibilityIcon,
  PlaylistPlay as PlaylistIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  status: 'private' | 'unlisted' | 'public';
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  url: string
}

interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  status: 'private' | 'unlisted' | 'public'
}

interface YouTubeIntegrationProps {
  projectId: string;
  onVideoUploaded?: (video: YouTubeVideo) => void;
  onPlaylistCreated?: (playlist: YouTubePlaylist) => void
}

export const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({
  projectd,
  onVideoUploaded,
  onPlaylistCreated,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('videographer');
  const [isConnected, setIsConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: ',',
    description: '',
    tags: [] as string[],
    status: 'private' as 'private' | 'unlisted' | 'public',
    categoryId: '2', // People & Blogs default
    playlistId: '',
});

  // Playlist form state
  const [playlistForm, setPlaylistForm] = useState({
    title: '',
    description: '',
    status: 'private' as 'private' | 'unlisted' | 'public',
});

  const [tagInput, setTagInput] = useState('');

  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    componentRegistry.registerComponent('YouTubeIntegration', {
      type: 'google-service',
      capabilities: ['video-upload','playlist-management''analytics','project-integration'],
      dataFlow: {
        sources: ['videos','playlists','upload-status','connection-status'],
        destinations: ['admin-dashboard','user-interface','project-showcase'],
        processors: ['video-processing','playlist-processing','upload-processing']
    }
  });

    // Set up data flow nodes
    dataFlow.registerNode('videos', {
      type: 'source',
      data: videos,
      metadata: { component: 'YouTubeIntegration', type: 'videos', projectId }
  });

    dataFlow.registerNode('playlists', {
      type: 'source',
      data: playlists,
      metadata: { component: 'YouTubeIntegration', type: 'playlists', projectId }
  });

    dataFlow.registerNode('upload-status', {
      type: 'source',
      data: { uploading, uploadProgress },
      metadata: { component: 'YouTubeIntegration', type: 'upload-status', projectId }
  });

    dataFlow.registerNode('connection-status', {
      type: 'source',
      data: { isConnected },
      metadata: { component: 'YouTubeIntegration', type: 'connection-status', projectId }
  });

    // Listen for YouTube events
    communication.subscribe('youtube: upload-request', (data) => {
      if (data.projectId === projectId && data.file) {
        handleVideoUpload(data.file);
    }
  });

    communication.subscribe('youtube: playlist-create', (data) => {
      if (data.projectId === projectId) {
        setPlaylistForm(data.playlistData);
        setPlaylistDialogOpen(true);
    }
  });

    communication.subscribe('youtube: connect', () => {
      connectToYouTube();
  });

    return () => {
      componentRegistry.unregisterComponent('YouTubeIntegration');
      dataFlow.unregisterNode('videos');
      dataFlow.unregisterNode('playlists');
      dataFlow.unregisterNode('upload-status');
      dataFlow.unregisterNode('connection-status');
  };
}, [videos, playlists, uploading, uploadProgress, isConnected, projectId, componentRegistry, dataFlow, communication]);

  // Check YouTube connection status
  useEffect(() => {
    checkYouTubeConnection();
    if (isConnected) {
      fetchProjectVideos();
      fetchProjectPlaylists();
  }
}, [projectId, isConnected]);

  const checkYouTubeConnection = async () => {
    try {
      const response = await fetch('/api/youtube/status', {
        headers: {
          ...auth, 'x-project-id': projectId
      }
    });
      const data = await response.json();
      setIsConnected(data.connected);
  } catch (error) {
      console.error('Error checking YouTube connection: ', error);
      setIsConnected(false);
  }
};

  const connectToYouTube = async () => {
    try {
      const response = await fetch('/api/youtube/connect', {
        method: 'POS',
        headers: {
          ...auth, 'Content-Type' : 'application/json','x-project-id': projectId,
      },
    });
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
    }
  } catch (error) {
      console.error('Error connecting to YouTube:', error);
  }
};

  const fetchProjectVideos = async () => {
    try {
      const response = await fetch(`/api/youtube/videos?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
    }
  } catch (error) {
      console.error('Error fetching YouTube videos:', error);
  }
};

  const fetchProjectPlaylists = async () => {
    try {
      const response = await fetch(`/api/youtube/playlists?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.playlists || []);
    }
  } catch (error) {
      console.error('Error fetching YouTube playlists:', error);
  }
};

  const handleVideoUpload = async (file: File) => {
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate project-specific metadata
      const metadata = {
        ...uploadForm,
        title: uploadForm.title || `${projectId} - Video`,
        description: uploadForm.description || `Video fra prosjekt ${projectId}`,
    };

      const formData = new FormData();
      formData.append('video', file);
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('projectId', projectId);

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
      }
    });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          const newVideo = result.video;
          setVideos(prev => [newVideo, ...prev]);
          onVideoUploaded?.(newVideo);
          
          // Broadcast video uploaded event
          communication.broadcast('youtube: video-uploaded', {
            type: 'video_uploaded',
            data: { video: newVideo, projectId },
            component: 'YouTubeIntegration'
      });
          
          setUploadDialogOpen(false);
          resetUploadForm();
      }
        setUploading(false);
        setUploadProgress(0);
    };

      xhr.onerror = () => {
        console.error('Upload failed');
        setUploading(false);
        setUploadProgress(0);
    };

      xhr.open('POST', '/api/youtube/upload');
      xhr.send(formData);

  } catch (error) {
      console.error('Error uploading video:', error);
      setUploading(false);
      setUploadProgress(0);
  }
};

  const createPlaylist = async () => {
    try {
      const response = await fetch('/api/youtube/playlists', {
        method: 'POS',
        headers: {
          ...auth'Content-Type' : 'application/json','x-project-id': projectId,
      },
        body: JSON.stringify({
          ...playlistForm,
          title: playlistForm.title || `Prosjekt ${projectId}`,
      }),
    });

      if (response.ok) {
        const result = await response.json();
        const newPlaylist = result.playlist;
        setPlaylists(prev => [newPlaylist, ...prev]);
        onPlaylistCreated?.(newPlaylist);
        
        // Broadcast playlist created event
        communication.broadcast('youtube: playlist-created', {
          type: 'playlist_created',
          data: { playlist: newPlaylist, projectId },
          component: 'YouTubeIntegration'
    });
        
        setPlaylistDialogOpen(false);
        resetPlaylistForm();
    }
  } catch (error) {
      console.error('Error creating playlist:', error);
  }
};

  const resetUploadForm = () => {
    setUploadForm({
      title: ', ',
      description: ', ',
      tags:  [],
      status: 'private',
      categoryId: '2',
      playlistId: ', ',
  });
    setTagInput(', ');
};

  const resetPlaylistForm = () => {
    setPlaylistForm({
      title: ', ',
      description: '',
      status: 'private' });
};

  const handleAddTag = () => {
    if (tagInput.trim() && !uploadForm.tags.includes(tagInput.trim())) {
      setUploadForm({
        ...uploadForm,
        tags: [...uploadForm.tags, tagInput.trim()],
    });
      setTagInput('');
  }
};

  const handleRemoveTag = (tagToRemove: string) => {
    setUploadForm({
      ...uploadForm,
      tags: uploadForm.tags.filter(tag => tag !== tagToRemove),
  });
};

  if (!isConnected) {
    return (
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ textAlign: 'center', py:  4 }}>
            <YouTubeIcon sx={{ fontSize:  64, color: '#FF0000', mb:  2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              YouTube Integration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
              Koble til YouTube for å laste opp videoer direkte fra prosjektet
            </Typography>
            <Button variant="contained"
              onClick={connectToYouTube}
              sx={{
                bgcolor: '#FF0000', '&:hover': { bgcolor: '#CC0000' }}}
             sx={theming.getThemedButtonSx()}>
              Koble til YouTube
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
}

  return (
    <Box>
      {/* YouTube Status Card */}
      <Card sx={{ mb:  3, border: `2px solid ${theme.palette.success.main}` ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <YouTubeIcon sx={{ color: '#FF0000', fontSize: 32}} />
            <Box sx={{ flexGrow:  1 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>YouTube Tilkoblet</Typography>
              <Typography variant="body2" color="text.secondary">
                Klar for video upload og administrasjon
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Last opp video
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlaylistIcon />}
                onClick={() => setPlaylistDialogOpen(true)}
              >
                Ny spilleliste
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Project Videos */}
      {videos.length > 0 && (
        <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
              <YouTubeIcon sx={{ color: '#FF0000' }} />
              Prosjekt Videoer ({videos.length})
            </Typography>
            <Grid container spacing={2}>
              {videos.map((video) => (
                <Grid size={{ xs: 12 }} sm={6} md={4} key={video.id}>
                  <Card sx={{ height: '100%' ,  ...theming.getThemedCardSx() }}>
                    <Box
                      sx={{
                        height: 10,
                        backgroundImage: `url(${video.thumbnailUl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'relative' }}
                    >
                      <Chip
                        label={video.status}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top:  8,
                          right:  8,
                          bgcolor: video.status === 'public' ? 'success.main' : 'warning.main',
                          color: 'white' }}
                      />
                    </Box>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle2" gutterBottom>
                        {video.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {video.viewCount} visninger • {video.likeCount} likes
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Project Playlists */}
      {playlists.length > 0 && (
        <Card sx={theming.getThemedCardSx()}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
              <PlaylistIcon />
              Spillelister ({playlists.length})
            </Typography>
            <Grid container spacing={2}>
              {playlists.map((playlist) => (
                <Grid size={{ xs: 12 }} sm={6} key={playlist.id}>
                  <Card variant="outlined" sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Typography variant="subtitle1" gutterBottom>
                        {playlist.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {playlist.itemCount} videoer • {playlist.status}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Last opp video til YouTube</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt:  1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Videotittel"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12 }} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Synlighet</InputLabel>
                <Select
                  value={uploadForm.status}
                  onChange={(e) => setUploadForm({ ...uploadForm, status: e.target.value as any })}
                >
                  <MenuItem value="private">Privat</MenuItem>
                  <MenuItem value="unlisted">Ikke oppført</MenuItem>
                  <MenuItem value="public">Offentlig</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Spilleliste</InputLabel>
                <Select
                  value={uploadForm.playlistId}
                  onChange={(e) => setUploadForm({ ...uploadForm, playlistId: e.target.value })}
                >
                  <MenuItem value="">Ingen spilleliste</MenuItem>
                  {playlists.map((playlist) => (
                    <MenuItem key={playlist.id} value={playlist.id}>
                      {playlist.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  label="Legg til tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag}>Legg til</Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 0,flexWrap: 'wrap' }}>
                {uploadForm.tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    size="small"
                    onDelete={() => handleRemoveTag(tag)}
                  />
                ))}
              </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                style={{ display:'none' }}
                id="video-upload"
              />
              <label htmlFor="video-upload">
                <Button variant="outlined" component="span" fullWidth>
                  Velg videofil
                </Button>
              </label>
            </Grid>

            {uploading && (
              <Grid size={{ xs: 12 }}>
                <Box sx={{ mb:  2 }}>
                  <Typography variant="body2" gutterBottom>
                    Laster opp... {Math.round(uploadProgress)}%
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Avbryt</Button>
        </DialogActions>
      </Dialog>

      {/* Playlist Dialog */}
      <Dialog open={playlistDialogOpen} onClose={() => setPlaylistDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett ny spilleliste</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt:  1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Spilleliste navn"
                value={playlistForm.title}
                onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Beskrivelse"
                value={playlistForm.description}
                onChange={(e) => setPlaylistForm({ ...playlistForm, description: e.target.value })}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Synlighet</InputLabel>
                <Select
                  value={playlistForm.status}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, status: e.target.value as any })}
                >
                  <MenuItem value="private">Privat</MenuItem>
                  <MenuItem value="unlisted">Ikke oppført</MenuItem>
                  <MenuItem value="public">Offentlig</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaylistDialogOpen(false)}>Avbryt</Button>
          <Button onClick={createPlaylist}
            variant="contained"
            disabled={!playlistForm.title}
           sx={theming.getThemedButtonSx()}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};