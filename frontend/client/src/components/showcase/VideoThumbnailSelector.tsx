import React, { useState, useRef, useEffect } from 'react';
import { useEnhancedMasterIntegration } from "@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Slider,
  Grid,
  Paper,
  IconButton,
  Card,
  CardMedia,
  CardContent,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipPrevious as SkipPreviousIcon,
  SkipNext as SkipNextIcon,
  CameraAlt as CameraIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface VideoThumbnailSelectorProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  currentThumbnailTime?: number;
  onSave: (thumbnailTime: number, thumbnailUrl: string) => void
}

export const VideoThumbnailSelector: React.FC<VideoThumbnailSelectorProps> = ({
  open,
  onClose,
  videoUrl,
  currentThumbnailTime = 0,
  onSave
}) => {
  const [currentTime, setCurrentTime] = useState(currentThumbnailTime);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnails, setThumbnails] = useState<Array<{ time: number; url: string }>>([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState<{ time: number; url: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent({
      id: 'video-thumbnail-selector',
      type: 'editor',
      capabilities: [
        'video-data','thumbnails','selected-thumbnail','video: thumbnail-selected''video: thumbnail-saved','video: thumbnails-generated''select-thumbnail','generate-thumbnails''save-thumbnail','video-player', 'thumbnail-grid', 'time-selector', 'video-processing', 'canvas-manipulation', 'thumbnail-generation'
      ],
      dependencies: ['showcase-drive-grid','showcase-admin'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime:  0,
        memoryUsage: 0 }
  });

    // Register data flow nodes
    dataFlow.registerNode('video-data', 'source', {
      description: 'Video data for thumbnail selection',
      dataType: 'object',
      schema: 'VideoData'
});

    dataFlow.registerNode('thumbnails', 'source', {
      description: 'Generated video thumbnails',
      dataType: 'array',
      schema: 'Thumbnail[]'
});

    dataFlow.registerNode('selected-thumbnail', 'source', {
      description: 'Currently selected thumbnail',
      dataType: 'object',
      schema: 'Thumbnail'
});

    return () => {
      componentRegistry.unregisterComponent('video-thumbnail-selector');
  };
}, [componentRegistry, dataFlow]);

  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.currentTime = currentThumbnailTime;
      generateAutoThumbnails();
  }
}, [open, currentThumbnailTime]);

  const generateAutoThumbnails = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsGenerating(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Wait for video metadata to load
    if (video.readyState < 1) {
      video.addEventListener('loadedmetadata', generateAutoThumbnails, { once: true });
      return;
  }

    const videoDuration = video.duration;
    setDuration(videoDuration);
    
    // Generate thumbnails at strategic intervals
    const thumbnailTimes = [
      0, // Start
      videoDuration * 0.1, // 10%
      videoDuration * 0.25, // 25%
      videoDuration * 0.5, // Middle
      videoDuration * 0.75, // 75%
      videoDuration * 0.9, // 90%
    ];

    const generatedThumbnails: Array<{ time: number; url: string }> = [];

    for (const time of thumbnailTimes) {
      video.currentTime = time;
      
      await new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true });
    });

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      ctx.drawImage(video0, canvas.width, canvas.height);
      
      // Convert to blob and create URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      generatedThumbnails.push({
        time,
        url: dataUrl
  });
  }

    setThumbnails(generatedThumbnails);
    
    // Set first thumbnail as selected if none selected
    if (!selectedThumbnail && generatedThumbnails.length > 0) {
      setSelectedThumbnail(generatedThumbnails[0]);
  }
    
    setIsGenerating(false);
};

  const captureCurrentFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const newThumbnail = { time: video.currentTime, url: dataUrl };
    
    setThumbnails(prev => [...prev, newThumbnail]);
    setSelectedThumbnail(newThumbnail);
};

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
  } else {
      videoRef.current.play();
  }
    setIsPlaying(!isPlaying);
};

  const handleTimeChange = (newTime: number) => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
};

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    
    const newTime = Math.max, (Math.min(duration, videoRef.current.currentTime + seconds));
    handleTimeChange(newTime);
};

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

  const handleSave = () => {
    if (selectedThumbnail) {
      // Broadcast thumbnail saved event
      communication.emit('video: thumbnail-saved', {
        thumbnail: selectedThumbnail,
        videoUrl,
        timestamp: Date.now()
  });
      
      onSave(selectedThumbnail.time, selectedThumbnail.url);
      onClose();
  }
};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh'
    }
    }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CameraIcon />
          Velg video thumbnail
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p:  2 }}>
        <Grid container spacing={2} sx={{ height: '100%'}}>
          {/* Video Player */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '100%',  ...theming.getThemedCardSx() }}>
              <Box sx={{ position: 'relative', mb:  2 }}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    backgroundColor: '#000'}}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                  }
                }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
                  }
                }}
                />
                
                {/* Hidden canvas for thumbnail generation */}
                <canvas
                  ref={canvasRef}
                  style={{ display: 'none'}}
                />
              </Box>

              {/* Video Controls */}
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <IconButton onClick={() => handleSkip(-10)}>
                  <SkipPreviousIcon />
                </IconButton>
                <IconButton onClick={handlePlayPause}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                <IconButton onClick={() => handleSkip(10)}>
                  <SkipNextIcon />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: '60px'}}>
                  {formatTime(currentTime)}
                </Typography>
                <Slider
                  value={currentTime}
                  max={duration}
                  onChange={(_, value) => handleTimeChange(value as number)}
                  sx={{ flex:  1 }}
                />
                <Typography variant="body2" sx={{ minWidth: '60px'}}>
                  {formatTime(duration)}
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={captureCurrentFrame}
                fullWidth
              >
                Fang gjeldende frame
              </Button>
            </Paper>
          </Grid>

          {/* Thumbnail Gallery */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', overflow: 'auto',  ...theming.getThemedCardSx() }}>
              <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  🖼️ Thumbnail-alternativer
                </Typography>
                <IconButton
                  onClick={generateAutoThumbnails}
                  disabled={isGenerating}
                  size="small"
                >
                  <RefreshIcon />
                </IconButton>
              </Box>

              {isGenerating && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  Genererer thumbnails...
                </Typography>
              )}

              <Grid container spacing={1}>
                {thumbnails.map((thumbnail, index) => (
                  <Grid size={{ xs:  6 }} key={index}>
                    <MuiCard
                      sx={{
                        cursor: 'pointer',
                        border: selectedThumbnail?.time === thumbnail.time ? 2 : 1,
                        borderColor: selectedThumbnail?.time === thumbnail.time ? '#ff8c00' : 'divider', '&:hover': {
                          borderColor: '#ff8c00',
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease'
                    }
                    }}
                      onClick={() => setSelectedThumbnail(thumbnail)}
                    >
                      <CardMedia component="img"
                        height="80"
                        image={thumbnail.url}
                        alt={`Thumbnail ${formatTime(thumbnail.time)}`}
                        sx={{ objectFit: 'cover',  ...theming.getThemedCardSx() }}>
                      <CardContent sx={{ py: 1, px: 1, '&:last-child': { pb: 1 }, ...theming.getThemedCardSx() }}>
                        <Typography variant="caption" textAlign="center" display="block">
                          {formatTime(thumbnail.time)}
                        </Typography>
                      </CardContent>
                    </MuiCard>
                  </Grid>
                ))}
              </Grid>

              {selectedThumbnail && (
                <Box mt={2} p={2} sx={{ backgroundColor: 'rgba(25, 1400.1)', borderRadius:  1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    ✅ Valgt thumbnail: </Typography>
                  <img
                    src={selectedThumbnail.url}
                    alt="Selected thumbnail"
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius:  4,
                      border: '2px solid #ff8c00'
                }}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                    Tid: {formatTime(selectedThumbnail.time)}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Avbryt
        </Button>
        <Button onClick={handleSave}
          variant="contained"
          disabled={!selectedThumbnail}
          sx={{
            background: 'linear-gradient(45deg, #ff8c00, #ff6b35)','&:hover': {
              background: 'linear-gradient(45deg, #ff7b00, #ff5722)'
          }
        }}
         sx={theming.getThemedButtonSx()}>
          Lagre thumbnail
        </Button>
      </DialogActions>
    </Dialog>
  );
};