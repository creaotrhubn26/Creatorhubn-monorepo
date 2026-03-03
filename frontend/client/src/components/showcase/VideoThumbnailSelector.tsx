import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Slider,
  Typography,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  SkipNext as SkipNextIcon,
  SkipPrevious as SkipPreviousIcon,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

interface VideoThumbnailSelectorProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  currentThumbnailTime?: number;
  onSave: (thumbnailTime: number, thumbnailUrl: string) => void;
}

interface Thumbnail {
  time: number;
  url: string;
}

function formatTime(time: number): string {
  const safe = Number.isFinite(time) ? Math.max(0, time) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Could not load video metadata.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
    };
    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Number.isFinite(time) ? Math.max(0, time) : 0;
  if (Math.abs(video.currentTime - target) < 0.05) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Video seek failed.'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.currentTime = target;
  });
}

export const VideoThumbnailSelector: React.FC<VideoThumbnailSelectorProps> = ({
  open,
  onClose,
  videoUrl,
  currentThumbnailTime = 0,
  onSave,
}) => {
  const [currentTime, setCurrentTime] = useState(currentThumbnailTime);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState<Thumbnail | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theming = useTheming('photographer');

  const captureFrameAt = useCallback(async (time: number): Promise<Thumbnail | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return null;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    await waitForMetadata(video);
    await seekTo(video, time);

    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      time: video.currentTime,
      url: canvas.toDataURL('image/jpeg', 0.9),
    };
  }, []);

  const generateAutoThumbnails = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setIsGenerating(true);
    try {
      await waitForMetadata(video);
      const videoDuration = video.duration;
      setDuration(videoDuration);

      const capturePoints = [0, 0.1, 0.25, 0.5, 0.75, 0.9]
        .map((factor) => factor * videoDuration)
        .filter((time, index, array) => {
          if (!Number.isFinite(time)) return false;
          if (index === 0) return true;
          return Math.abs(time - array[index - 1]) > 0.2;
        });

      const generated: Thumbnail[] = [];
      for (const time of capturePoints) {
        const frame = await captureFrameAt(time);
        if (frame) {
          generated.push(frame);
        }
      }

      setThumbnails(generated);
      if (generated.length > 0) {
        setSelectedThumbnail((current) => current ?? generated[0]);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [captureFrameAt]);

  const captureCurrentFrame = useCallback(async () => {
    const frame = await captureFrameAt(currentTime);
    if (!frame) {
      return;
    }

    setThumbnails((prev) => [...prev, frame]);
    setSelectedThumbnail(frame);
  }, [captureFrameAt, currentTime]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCurrentTime(currentThumbnailTime);
    setSelectedThumbnail(null);
    void generateAutoThumbnails();
  }, [currentThumbnailTime, generateAutoThumbnails, open, videoUrl]);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onLoaded = () => setDuration(video.duration || 0);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('pause', onPause);
    video.addEventListener('play', onPlay);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', onPlay);
    };
  }, [open]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const handleTimeChange = useCallback((newTime: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const bounded = Math.min(Math.max(newTime, 0), duration || 0);
    video.currentTime = bounded;
    setCurrentTime(bounded);
  }, [duration]);

  const handleSkip = useCallback((seconds: number) => {
    const nextTime = Math.max(0, Math.min(duration, currentTime + seconds));
    handleTimeChange(nextTime);
  }, [currentTime, duration, handleTimeChange]);

  const canSave = useMemo(() => Boolean(selectedThumbnail), [selectedThumbnail]);

  const handleSave = useCallback(() => {
    if (!selectedThumbnail) {
      return;
    }
    onSave(selectedThumbnail.time, selectedThumbnail.url);
    onClose();
  }, [onClose, onSave, selectedThumbnail]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CameraIcon />
          Velg video-thumbnail
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '100%', ...theming.getThemedCardSx() }}>
              <Box sx={{ position: 'relative', mb: 2 }}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  style={{
                    width: '100%',
                    maxHeight: 420,
                    objectFit: 'contain',
                    backgroundColor: '#000',
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                    }
                  }}
                />

                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </Box>

              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <IconButton onClick={() => handleSkip(-10)} aria-label="Tilbake 10 sekunder">
                  <SkipPreviousIcon />
                </IconButton>
                <IconButton onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                <IconButton onClick={() => handleSkip(10)} aria-label="Fram 10 sekunder">
                  <SkipNextIcon />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: 56 }}>
                  {formatTime(currentTime)}
                </Typography>
                <Slider
                  value={currentTime}
                  min={0}
                  max={Math.max(duration, 0)}
                  step={0.1}
                  onChange={(_, value) => handleTimeChange(Number(value))}
                  sx={{ flex: 1 }}
                />
                <Typography variant="body2" sx={{ minWidth: 56, textAlign: 'right' }}>
                  {formatTime(duration)}
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={() => void captureCurrentFrame()}
                fullWidth
              >
                Fang gjeldende frame
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%', overflow: 'auto', ...theming.getThemedCardSx() }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                  Thumbnail-alternativer
                </Typography>
                <IconButton
                  onClick={() => void generateAutoThumbnails()}
                  disabled={isGenerating}
                  size="small"
                  aria-label="Regenerer thumbnails"
                >
                  <RefreshIcon />
                </IconButton>
              </Box>

              {isGenerating ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  Genererer thumbnails...
                </Typography>
              ) : null}

              <Grid container spacing={1}>
                {thumbnails.map((thumbnail, index) => (
                  <Grid item xs={6} key={`${thumbnail.time}-${index}`}>
                    <Card
                      onClick={() => setSelectedThumbnail(thumbnail)}
                      sx={{
                        cursor: 'pointer',
                        border: selectedThumbnail?.url === thumbnail.url ? 2 : 1,
                        borderColor:
                          selectedThumbnail?.url === thumbnail.url
                            ? theming.colors.primary
                            : 'divider',
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: theming.colors.primary,
                        },
                      }}
                    >
                      <CardMedia component="img" image={thumbnail.url} height={90} />
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" display="block" textAlign="center">
                          {formatTime(thumbnail.time)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button variant="contained" onClick={handleSave} disabled={!canSave}>
          Bruk valgt thumbnail
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VideoThumbnailSelector;

