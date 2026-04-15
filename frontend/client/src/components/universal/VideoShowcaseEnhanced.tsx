// @ts-nocheck
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Chip,
  LinearProgress,
  Tooltip,
  Stack,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  alpha,
  Slider,
  Select,
  FormControl,
  InputLabel,
  Badge,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  PictureInPicture,
  Speed as Speed,
  Subtitles,
  Timeline,
  HighQuality,
  Download,
  Share,
  Comment,
  Bookmark,
  BookmarkBorder,
  AccessTime,
  Movie,
  VideoSettings,
  Instagram,
  YouTube,
  CloudUpload,
  AutoFixHigh,
  GraphicEq,
} from '@mui/icons-material';

interface VideoChapter {
  id: string;
  title: string;
  timestamp: number;
  thumbnailUrl?: string
}

interface VideoBookmark {
  id: string;
  timestamp: number;
  note?: string;
  userId: string;
  createdAt: Date
}

interface VideoMetadata {
  duration: number;
  resolution: string;
  fps: number;
  codec: string;
  bitrate: string;
  camera?: string;
  iso?: number;
  shutterSpeed?: string;
  colorProfile?: string;
  hasHDR?: boolean
}

interface VideoShowcaseItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  chapters?: VideoChapter[];
  bookmarks?: VideoBookmark[];
  metadata?: VideoMetadata;
  waveform?: string;
  subtitles?: Array<{ language: string; url: string }>;
  qualityLevels?: Array<{ label: string; resolution: string; url: string }>;
}

interface VideoShowcaseEnhancedProps {
  item: VideoShowcaseItem;
  onChapterClick?: (chapter: VideoChapter) => void;
  onBookmarkAdd?: (timestamp: number, note?: string) => void;
  onExport?: (format: 'instagram' | 'youtube' | 'tiktok') => void;
  profession: 'videographer'
}

const VideoShowcaseEnhanced: React.FC<VideoShowcaseEnhancedProps> = ({
  item,
  onChapterClick,
  onBookmarkAdd,
  onExport,
  profession
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isPiP, setIsPiP] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState('');
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showBookmarkDialog, setShowBookmarkDialog] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [showWaveform, setShowWaveform] = useState(false);

  // Auto-generate thumbnail at 15% if not provided
  useEffect(() => {
    if (videoRef.current && !item.thumbnailUrl) {
      videoRef.current.currentTime = (item.duration || 0) * 0.15;
  }
}, [item]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
    } else {
        videoRef.current.play();
    }
      setIsPlaying(!isPlaying);
  }
};

  // Handle time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Handle loop
      if (loopEnd && videoRef.current.currentTime >= loopEnd) {
        videoRef.current.currentTime = loopStart || 0;
    }
  }
};

  // Handle seeking
  const handleSeek = (event: Event, newValue: number | number[]) => {
    const time = newValue as number;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
}
};

  // Handle volume change
  const handleVolumeChange = (event: Event, newValue: number | number[]) => {
    const vol = newValue as number;
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
}
    setIsMuted(vol === 0);
};

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
  }
};

  // Handle Picture-in-Picture
  const togglePiP = async () => {
    if (!document.pictureInPictureElement && videoRef.current) {
      try {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
    } catch (error) {
        console.error('PiP failed: ', error);
    }
  } else {
      await document.exitPictureInPicture();
      setIsPiP(false);
  }
};

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        videoRef.current.requestFullscreen();
    }
  }
};

  // Handle playback speed
  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
}
};

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    setSelectedQuality(quality);
    // Implementation would change video source based on quality
};

  // Jump to chapter
  const jumpToChapter = (chapter: VideoChapter) => {
    if (videoRef.current) {
      videoRef.current.currentTime = chapter.timestamp;
      setCurrentTime(chapter.timestamp);
}
    if (onChapterClick) {
      onChapterClick(chapter);
  }
};

  // Add bookmark
  const handleAddBookmark = () => {
    if (onBookmarkAdd) {
      onBookmarkAdd(currentTime, bookmarkNote);
  }
    setShowBookmarkDialog(false);
    setBookmarkNote(', ');
};

  // Set loop points
  const setLoopPoint = (type: 'start' | 'end') => {
    if (type === 'start') {
      setLoopStart(currentTime);
} else {
      setLoopEnd(currentTime);
  }
};

  // Clear loop
  const clearLoop = () => {
    setLoopStart(null);
    setLoopEnd(null);
};

  // Generate preview thumbnail on hover
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    setHoveredTime(time);
    
    // Generate thumbnail preview (would need actual implementation)
    // This is a placeholder for the actual thumbnail generation
    setPreviewThumbnail(`/api/video/thumbnail/${item.d}?time=${time}`);
};

  // Get current chapter
  const currentChapter = useMemo(() => {
    if (!item.chapters || item.chapters.length === 0) return null;
    return item.chapters
      .filter(ch => ch.timestamp <= currentTime)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [currentTime, item.chapters]);

  return (
    <Card sx={{
      bgcolor: '#1a1a1a',
      color: '#fff',
      position: 'relative',
      overflow: 'visible',
      ...theming.getThemedCardSx()
    }}>
      {/* Video Player */}
      <Box sx={{ position: 'relative', paddingTop: '56.25%' /* 16:9 aspect ratio */ }}>
        <video
          ref={videoRef}
          src={item.videoUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000'}}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
          }}
          poster={item.thumbnailUrl}
        />
        
        {/* Video Controls Overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            p: 2,
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.3s'
          }}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Progress Bar with Thumbnails */}
          <Box sx={{ mb: 1, position: 'relative' }}>
            {/* Preview Thumbnail on Hover */}
            {hoveredTime !== null && previewThumbnail && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '100%',
                  left: `${(hoveredTime / duration) * 100}%`,
                  transform: 'translateX(-50%)',
                  mb: 1,
                  p: 0.5,
                  bgcolor: 'rgba(0, 0, 0, 0.9)',
                  borderRadius: 1,
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                <img
                  src={previewThumbnail}
                  alt="Preview"
                  style={{ width: 100, height: 68, borderRadius: 4 }}
                />
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                  {formatTime(hoveredTime)}
                </Typography>
              </Box>
            )}

            {/* Chapter Markers */}
            {item.chapters?.map(chapter => (
              <Tooltip key={chapter.id} title={chapter.title}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${(chapter.timestamp / duration) * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#ff6b35',
                    cursor: 'pointer',
                    zIndex: 2, '&:hover': {
                      transform: 'translate(-50%, -50%) scale(1.5)'
                    }
                  }}
                  onClick={() => jumpToChapter(chapter)}
                />
              </Tooltip>
            ))}
            
            {/* Progress Slider */}
            <Slider
              value={currentTime}
              max={duration}
              onChange={handleSeek}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => {
                setHoveredTime(null);
                setPreviewThumbnail(null);
              }}
              sx={{
                color: '#ff6b35','& .MuiSlider-track': {
                  bgcolor: loopStart !== null && loopEnd !== null &&
                          currentTime >= loopStart && currentTime <= loopEnd
                    ? '#4CAF50' : '#ff6b35'
                },
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12
                }
              }}
            />
          </Box>

          {/* Control Buttons */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* Play/Pause */}
              <IconButton onClick={togglePlayPause} sx={{ color: '#fff' }}>
                {isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
              </IconButton>

              {/* Skip Previous/Next Chapter */}
              {item.chapters && item.chapters.length > 0 && (
                <>
                  <IconButton
                    onClick={() => {
                      const prevChapter = item.chapters!
                        .filter(ch => ch.timestamp < currentTime - 1)
                        .sort((a, b) => b.timestamp - a.timestamp)[0];
                      if (prevChapter) jumpToChapter(prevChapter);
                    }}
                    sx={{ color: '#fff' }}
                  >
                    {theming.getThemedIcon('skipPrevious')}
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      const nextChapter = item.chapters!
                        .find(ch => ch.timestamp > currentTime);
                      if (nextChapter) jumpToChapter(nextChapter);
                    }}
                    sx={{ color: '#fff' }}
                  >
                    {theming.getThemedIcon('skipNext')}
                  </IconButton>
                </>
              )}

              {/* Volume */}
              <IconButton onClick={toggleMute} sx={{ color: '#fff' }}>
                {isMuted ? theming.getThemedIcon('volumeOff') : theming.getThemedIcon('volumeUp')}
              </IconButton>
              <Slider
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                max={1}
                step={0.1}
                sx={{
                  width: 80,
                  color: '#fff', '& .MuiSlider-thumb': {
                    width: 10,
                    height: 10
                  }
                }}
              />

              {/* Time Display */}
              <Typography variant="caption" sx={{ color: '#fff', minWidth: 100 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Typography>

              {/* Current Chapter */}
              {currentChapter && (
                <Chip
                  label={currentChapter.title}
                  size="small"
                  icon={theming.getThemedIcon('timeline')}
                  sx={{
                    bgcolor: 'rgba(255, 107, 53, 0.2)',
                    color: '#ff6b35',
                    borderColor: '#ff6b35'
                  }}
                  variant="outlined"
                />
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              {/* Bookmark */}
              <Tooltip title="Legg til bokmerke">
                <IconButton
                  onClick={() => setShowBookmarkDialog(true)}
                  sx={{ color: '#fff' }}
                >
                  {theming.getThemedIcon('bookmarkBorder')}
                </IconButton>
              </Tooltip>

              {/* Loop */}
              {(loopStart !== null || loopEnd !== null) && (
                <Chip
                  label={`Loop: ${formatTime(loopStart || 0)} - ${formatTime(loopEnd || duration)}`}
                  size="small"
                  onDelete={clearLoop}
                  sx={{
                    bgcolor: 'rgba(76, 175, 80, 0.2)',
                    color: '#4CAF50'
                  }}
                />
              )}

              {/* Speed */}
              <Button
                size="small"
                startIcon={theming.getThemedIcon('speed')}
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ color: '#fff' }}
              >
                {playbackRate}x
              </Button>

              {/* Quality */}
              {item.qualityLevels && (
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <Select
                    value={selectedQuality}
                    onChange={(e) => handleQualityChange(e.target.value)}
                    sx={{
                      color: '#fff', '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.3)'
                      }
                    }}
                  >
                    <MenuItem value="auto">Auto</MenuItem>
                    {item.qualityLevels.map(level => (
                      <MenuItem key={level.resolution} value={level.resolution}>
                        {level.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Subtitles */}
              {item.subtitles && item.subtitles.length > 0 && (
                <IconButton
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  sx={{ color: showSubtitles ? '#ff6b35' : '#fff' }}
                >
                  {theming.getThemedIcon('subtitles')}
                </IconButton>
              )}

              {/* Waveform */}
              {item.waveform && (
                <IconButton
                  onClick={() => setShowWaveform(!showWaveform)}
                  sx={{ color: showWaveform ? '#ff6b35' : '#fff' }}
                >
                  <GraphicEq />
                </IconButton>
              )}

              {/* PiP */}
              <IconButton onClick={togglePiP} sx={{ color: isPiP ? '#ff6b35' : '#fff' }}>
                <PictureInPicture />
              </IconButton>

              {/* Fullscreen */}
              <IconButton onClick={toggleFullscreen} sx={{ color: '#fff' }}>
                {theming.getThemedIcon('fullscreen')}
              </IconButton>
            </Stack>
          </Stack>

          {/* Waveform Overlay */}
          {showWaveform && item.waveform && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 60,
                left: 0,
                right: 0,
                height: 50,
                backgroundImage: `url(${item.waveform})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.5,
                pointerEvents: 'none'
              }}
            />
          )}
        </Box>
      </Box>

      {/* Video Info and Actions */}
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              {item.title}
            </Typography>

            {/* Metadata Badges */}
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {item.metadata?.resolution && (
                <Chip
                  label={item.metadata.resolution}
                  size="small"
                  icon={<HighQuality />}
                  sx={{ bgcolor: 'rgba(33, 150, 243, 0.2)', color: '#2196F3' }}
                />
              )}
              {item.metadata?.fps && (
                <Chip
                  label={`${item.metadata.fps} FPS`}
                  size="small"
                  sx={{ bgcolor: 'rgba(255, 152, 0, 0.2)', color: '#FF9800' }}
                />
              )}
              {item.metadata?.colorProfile && (
                <Chip
                  label={item.metadata.colorProfile}
                  size="small"
                  sx={{ bgcolor: 'rgba(156, 39, 176, 0.2)', color: '#9C27B0' }}
                />
              )}
              {item.metadata?.hasHDR && (
                <Badge badgeContent="HDR" color="primary">
                  <Chip
                    label="HDR"
                    size="small"
                    sx={{ bgcolor: 'rgba(76, 175, 80, 0.2)', color: '#4CAF50' }}
                  />
                </Badge>
              )}
            </Stack>

            {/* Export Options */}
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                startIcon={<Instagram />}
                onClick={() => onExport && onExport('instagram')}
                sx={{ color: '#E4405F' }}
              >
                Instagram (4:5)
              </Button>
              <Button
                size="small"
                startIcon={<YouTube />}
                onClick={() => onExport && onExport('youtube')}
                sx={{ color: '#FF0000' }}
              >
                YouTube (16:9)
              </Button>
              <Button
                size="small"
                startIcon={<Movie />}
                onClick={() => onExport && onExport('tiktok')}
                sx={{ color: '#000' }}
              >
                TikTok (9:16)
              </Button>
            </Stack>
          </Box>

          {/* Actions */}
          <Stack spacing={1}>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('share')}
              size="small"
              sx={{ borderColor: 'rgba(255, 255, 255, 0.3)', color: '#fff' }}
            >
              Del
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('download')}
              size="small"
              sx={{ borderColor: 'rgba(255, 255, 255, 0.3)', color:'#fff' }}
            >
              Last ned
            </Button>
          </Stack>
        </Stack>
      </CardContent>

      {/* Speed Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
          <MenuItem
            key={speed}
            selected={playbackRate === speed}
            onClick={() => {
              handleSpeedChange(speed);
              setAnchorEl(null);
          }}
          >
            {speed}x
          </MenuItem>
        ))}
      </Menu>
      
      {/* Bookmark Dialog */}
      <Dialog
        open={showBookmarkDialog}
        onClose={() => setShowBookmarkDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Legg til bokmerke ved {formatTime(currentTime)}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notat (valgfritt)"
            value={bookmarkNote}
            onChange={(e) => setBookmarkNote(e.target.value)}
            sx={{ mt:  2 }}
          />
          <Stack direction="row" spacing={2} sx={{ mt:  3 }}>
            <Button onClick={() => setShowBookmarkDialog(false)}>
              Avbryt
            </Button>
            <Button variant="contained" onClick={handleAddBookmark} sx={theming.getThemedButtonSx()}>
              Legg til bokmerke
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default VideoShowcaseEnhanced;