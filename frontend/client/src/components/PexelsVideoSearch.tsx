import { useTheming } from '../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  TextField,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
} from '@mui/material';
import { Search,
  PlayArrowArrow,
  Download,
  Add,
  Close,
  VideographyIconLibrary, } from '../shared/CreatorHubIcons';
import { apiRequest } from '@/lib/queryClient';

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: {
    id: number;
    name: string;
    url: string;
};
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
}>;
}

interface PexelsVideoSearchProps {
  onVideosSelected: (videos: PexelsVideo[]) => void;
  onClose: () => void;
  open: boolean
}

export default function PexelsVideoSearch({ onVideosSelected, onClose, open }: PexelsVideoSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<PexelsVideo[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for videos
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest(`/api/pexels/search?q=${encodeURIComponent(searchQuery)}&per_page=20`);
      
      if (response.success) {
        setVideos(response.data.videos);
    } else {
        setError('Search failed. Please try again., ');
    }
  } catch (error) {
      console.error('Pexels search error: ', error);
      setError('Failed to search videos. Please check your connection., ');
  } finally {
      setIsLoading(false);
  }
};

  // Load popular videos on mount
  useEffect(() => {
    if (open) {
      loadPopularVideos();
  }
}, [open]);

  const loadPopularVideos = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/pexels/popular?per_page=12');
      
      if (response.success) {
        setVideos(response.data.videos);
    } else {
        setError('Failed to load popular videos.');
    }
  } catch (error) {
      console.error('Popular videos error: ', error);
      setError('Failed to load popular videos. Please check your connection.');
  } finally {
      setIsLoading(false);
  }
};

  // Handle video selection
  const handleVideoSelect = (videoId: number) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
} else {
      newSelected.add(videoId);
  }
    setSelectedVideos(newSelected);
};

  // Handle adding selected videos to timeline
  const handleAddToTimeline = () => {
    const selectedVideoObjects = videos.filter(video => selectedVideos.has(video.id));
    onVideosSelected(selectedVideoObjects);
    setSelectedVideos(new Set());
    onClose();
};

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <VideoLibrary color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Pexels Video Search</Typography>
          </Stack>
          <IconButton onClick={onClose}>
            {theming.getThemedIcon('close')}
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Search Bar */}
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Search for videos (e.g., wedding, ceremony, dance)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />}}
            />
            <Button variant="contained"
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim()}
              startIcon={isLoading ? <CircularProgress size={20} sx={theming.getThemedButtonSx()} /> : theming.getThemedIcon('search')}
            >
              Search
            </Button>
            <Button
              variant="outlined"
              onClick={loadPopularVideos}
              disabled={isLoading}
            >
              Popular
            </Button>
          </Stack>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Video Grid */}
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p:  4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {videos.map((video) => (
                <Grid item xs={12} key={video.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selectedVideos.has(video.id) ? 2 : 1,
                      borderColor: selectedVideos.has(video.id) ? 'primary.main' : 'divider', '&:hover': {
                        boxShadow:  2,
                    }}}
                    onClick={() => handleVideoSelect(video.id)}
                  >
                    <Box sx={{ position: 'relative'}}>
                      <CardMedia 
                        component="img"
                        height="200"
                        image={video.image}
                        alt={`Video ${video.id}`} 
                        sx={theming.getThemedCardSx()}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top:  8,
                          right:  8,
                          bgcolor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          px:  1,
                          py: 0.5,
                          borderRadius:  1,
                          fontSize: '0.75rem'}}
                      >
                        {formatDuration(video.duration)}
                      </Box>
                      <Box
                        sx={{
                          position: 'absolute',
                          top:  8,
                          left:  8}}
                      >
                        <Checkbox
                          checked={selectedVideos.has(video.id)}
                          sx={{
                            color: 'white',
                            bgcolor: 'rgba(0,0,0,0.5)', '&.Mui-checked': {
                              color: 'primary.main',
                          }}}
                        />
                      </Box>
                    </Box>
                    <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {video.width} × {video.height}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        by {video.user.name}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt:  1 }}>
                        <Chip
                          label={video.video_files[0]?.quality || 'HD'}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip
                          label={`${video.duration}s`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* No Results */}
          {!isLoading && videos.length === 0 && !error && (
            <Box sx={{ textAlign: 'center', py:  4 }}>
              <VideoLibrary sx={{ fontSize:  64, color: 'text.secondary', mb:  2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom sx={{ color: theming.colors.primary }}>
                No videos found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try searching for different keywords or browse popular videos
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained"
          onClick={handleAddToTimeline}
          disabled={selectedVideos.size === 0}
          startIcon={theming.getThemedIcon('add')}
         sx={theming.getThemedButtonSx()}>
          Add {selectedVideos.size} Video{selectedVideos.size !== 1 ? 's' :','} to Timeline
        </Button>
      </DialogActions>
    </Dialog>
  );
}
