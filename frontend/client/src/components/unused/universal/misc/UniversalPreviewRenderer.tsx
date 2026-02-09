// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useCallback } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import { 
  Box, 
  Typography, 
  Card, 
  CardMedia, 
  IconButton, 
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Tooltip
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import { 
  PlayArrow, 
  Pause, 
  VolumeUp, 
  VolumeOff, 
  Fullscreen, 
  ZoomIn, 
  ZoomOut,
  Download,
  Share,
  Image,
  VideoLibrary,
  AudioFile,
  Description
} from '@mui/icons-material';

interface PreviewItem {
  id: string;
  title: string;
  fileUrl: string;
  fileType: 'image' | 'video' | 'audio' | 'document';
  thumbnailUrl?: string;
  duration?: number;
  size?: number;
  dimensions?: { width: number; height: number };
}

interface UniversalPreviewRendererProps {
  item: PreviewItem;
  onClose?: () => void;
  showControls?: boolean;
  autoPlay?: boolean;
  maxWidth?: number;
  maxHeight?: number; 
}

export default function UniversalPreviewRenderer({ 
  item, 
  onClose, 
  showControls = true, 
  autoPlay = false,
  maxWidth = 800,
  maxHeight = 600 }: UniversalPreviewRendererProps) {
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const queryClient = useQueryClient();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Database connection for UniversalPreviewRenderer
  const { data: componentData = [], isLoading } = useQuery({
    queryKey: ['/api/component','user-data'],
    queryFn: () => apiRequest('/api/component/user-data', ),
    retry: false,
});

  // Mutation for updating component data
  const updateUniversalPreviewRenderer = useMutation({
    mutationFn: async (data: any) => 
      const auth = await getAuthHeader();
      return apiRequest('/api/component/update', {
        headers: auth,
        headers: {},
        method: 'POS',
        body: JSON.stringify(data)
    ,}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/component", ],});
  }
});

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return <Image />;
      case 'video': return theming.getThemedIcon(', ');
      case 'audio': return <AudioFile />;
      case 'document': return <Description />;
      default: return <Description />;
  }
};

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB','MB','GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ', ' + sizes[i];
};

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

  // Handle play/pause
  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
}, [isPlaying]);

  // Handle volume change
  const handleVolumeChange = useCallback((event: Event, newValue: number | number[]) => {
    setVolume(newValue as number);
,}, []);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
}, [isMuted]);

  // Handle zoom change
  const handleZoomChange = useCallback((event: Event, newValue: number | number[]) => {
    setZoom(newValue as number);
,}, []);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setShowFullscreen(!showFullscreen);
}, [showFullscreen]);

  // Handle download
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = item.fileUrl;
    link.download = item.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}, [item.fileUrl, item.title]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          url: item.fileUrl
      ,});
    } catch (err) {
        console.log('Error sharing: ', err);
    }
  } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(item.fileUrl);
  }
}, [item.title, item.fileUrl]);

  return (
    <Box sx={{ maxWidth: maxWidth, maxHeight: maxHeight, position: 'relative'}}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        {getFileTypeIcon(item.fileType)}
        <Typography variant="h6" sx={{  flexGrow:  1  }}>
          {item.title}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip 
            label={item.fileType.toUpperCase()} 
            size="small" 
            color="primary" 
          />
          {item.size && (
            <Chip 
              label={formatFileSize(item.size)} 
              size="small" 
              variant="outlined" 
            />
          )}
          {item.duration && (
            <Chip 
              label={formatDuration(item.duration)} 
              size="small" 
              variant="outlined" 
            />
          )}
        </Stack>
      </Box>

      {/* Preview Area */}
      <Card sx={{ position: 'relative', overflow: 'hidden',  ...theming.getThemedCardSx() }}>
        {isLoading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: 40,
            bgcolor: 'grey.100'
        }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m:  2 }}>
            {error}
          </Alert>
        )}

        {/* Image Preview */}
        {item.fileType === 'image' && (
          <CardMedia
            component="img"
            image={item.fileUrl}
            alt={item.title}
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: maxHeight - 10,
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              transition: 'transform 0.3s ease'
          }}
            onLoad={() => sx={theming.getThemedCardSx()}> setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError('Failed to load image');
          }}
          />
        )}

        {/* Video Preview */}
        {item.fileType === 'video' && (
          <Box sx={{ position: 'relative'}}>
            <CardMedia
              component="video"
              src={item.fileUrl}
              controls={showControls}
              autoPlay={autoPlay}
              muted={isMuted}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: maxHeight - 100
            }}
              onLoadStart={() => sx={theming.getThemedCardSx()}> setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('Failed to load video');
            }}
            />
          </Box>
        )}

        {/* Audio Preview */}
        {item.fileType === 'audio' && (
          <Box sx={{ p:  4, textAlign: 'center'}}>
            <AudioFile sx={{ fontSize:  64, color: 'primary.main', mb:  2 }} />
            <Typography variant="h6" sx={{  mb:  2  }}>
              {item.title}
            </Typography>
            <CardMedia
              component="audio"
              src={item.fileUrl}
              controls={showControls}
              autoPlay={autoPlay}
              muted={isMuted}
              sx={{ width: '100%'}}
              onLoadStart={() => sx={theming.getThemedCardSx()}> setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('Failed to load audio');
            }}
            />
          </Box>
        )}

        {/* Document Preview */}
        {item.fileType === 'document' && (
          <Box sx={{ p:  4, textAlign: 'center'}}>
            <Description sx={{ fontSize:  64, color: 'primary.main', mb:  2 }} />
            <Typography variant="h6" sx={{  mb:  2  }}>
              {item.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
              Document preview not available. Click download to view.
            </Typography>
            <Button variant="contained"
              startIcon={theming.getThemedIcon('download')}
              onClick={handleDownload}
             sx={theming.getThemedButtonSx()}>
              Download Document
            </Button>
          </Box>
        )}

        {/* Overlay Controls */}
        {showControls && item.fileType === 'video' && (
          <Box sx={{
            position: 'absolute',
            bottom:  0,
            left:  0,
            right:  0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            p: 2
        }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={togglePlayPause} sx={{ color: 'white'}}>
                {isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
              </IconButton>
              
              <IconButton onClick={toggleMute} sx={{ color: 'white'}}>
                {isMuted ? theming.getThemedIcon('volumeOff') : theming.getThemedIcon('volumeUp')}
              </IconButton>
              
              <Box sx={{ width: 100}}>
                <Slider
                  value={volume}
                  onChange={handleVolumeChange}
                  min={0}
                  max={1}
                  step={0.1}
                  sx={{ color: 'white'}}
                />
              </Box>
              
              <Box sx={{ flexGrow:  1 }} />
              
              <IconButton onClick={toggleFullscreen} sx={{ color: 'white'}}>
                {theming.getThemedIcon('fullscreen')}
              </IconButton>
            </Stack>
          </Box>
        )}
      </Card>

      {/* Controls */}
      {showControls && (
        <Box sx={{ mt:  2 }}>
          <Stack direction="row" spacing={1} justifyContent="center">
            <Tooltip title="Zoom In">
              <IconButton onClick={() => setZoom(Math.min(zoom + 0.1, 3))}>
                {theming.getThemedIcon('zoomIn')}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Zoom Out">
              <IconButton onClick={() => setZoom(Math.max(zoom - 0.1, 0.1))}>
                {theming.getThemedIcon('zoomOut')}
              </IconButton>
            </Tooltip>
            
            <Box sx={{ width: 10, mx:  2 }}>
              <Slider
                value={zoom}
                onChange={handleZoomChange}
                min={0.1}
                max={3}
                step={0.1}
                marks={[
                  { value: 0, .label: '10%',},
                  { value: 1, label: '100%',},
                  { value:  3, label: '300%',}
                ]}
              />
            </Box>
            
            <Tooltip title="Download">
              <IconButton onClick={handleDownload}>
                {theming.getThemedIcon('download')}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Share">
              <IconButton onClick={handleShare}>
                {theming.getThemedIcon('share')}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      {/* Fullscreen Dialog */}
      <Dialog 
        open={showFullscreen} 
        onClose={() => setShowFullscreen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            maxWidth: '90vw',
            maxHeight: '90vh',
            bgcolor: 'black'
        }
      }}
      >
        <DialogTitle sx={{ color: 'white', bgcolor: 'black'}}>
          {item.title}
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: 'black'}}>
          <Box sx={{ 
            width: '100%', 
            height: '70vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
        }}>
            {item.fileType === 'image' && (
              <img
                src={item.fileUrl}
                alt={item.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
              }}
              />
            )}
            {item.fileType === 'video' && (
              <video
                src={item.fileUrl}
                controls
                autoPlay
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%'
              }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ bgcolor: 'black'}}>
          <Button onClick={() => setShowFullscreen(false)} sx={{ color:'white'}}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
