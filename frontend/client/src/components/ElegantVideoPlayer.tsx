import { useTheming } from '../utils/theming-helper';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Fade,
  LinearProgress,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
  Paper,
  CircularProgress,
  TextField,
  Avatar,
  InputAdornment,
  styled
} from '@mui/material';

// Styled video element to avoid inline styles
const StyledVideo = styled('video')({
  width: '100%',
  height: '100%',
  objectFit: 'cover'
});
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  HighQuality,
  FavoriteBorder,
  ClosedCaption,
  PictureInPicture,
  Replay10,
  Forward10,
  ErrorOutline
} from '@mui/icons-material';
import { HLSStreamingService } from '../services/hls-streaming-service';

// Video streaming types
type StreamType = 'hls' | 'mp4' | 'webm' | 'unknown';

// Comment interface for video timestamps
export interface VideoComment {
  id: string;
  text: string;
  author: string;
  avatarUrl?: string;
  timestamp: number; // video time in seconds
  createdAt: string;
}

interface ElegantVideoPlayerProps {
  videoUrl?: string;
  hlsUrl?: string; // Optional HLS manifest URL for adaptive streaming
  title: string;
  description?: string;
  thumbnailUrl?: string;
  onNext?: () => void;
  onPrevious?: () => void;
  autoPlay?: boolean;
  chapters?: { time: number; title: string; thumbnail?: string }[];
  subtitles?: { time: number; text: string }[];
  actors?: string[];
  sceneInfo?: string;
  // New streaming options
  preferHLS?: boolean; // Prefer HLS over direct MP4 when available
  onStreamError?: (error: string) => void;
  // New design props for comments
  comments?: VideoComment[];
  onAddComment?: (text: string, timestamp: number) => void;
  userAvatarUrl?: string;
  showComments?: boolean; // Show inline comments section
  // Theming integration
  profession?: string; // Profession for theming (photographer, videographer, etc.)
}

interface PreviewState {
  show: boolean;
  time: number;
  x: number;
  thumbnail?: string
}

// Detect stream type from URL
const detectStreamType = (url: string): StreamType => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.m3u8, ') || lowerUrl.includes('manifest,')) return 'hls';
  if (lowerUrl.includes('.mp4,')) return 'mp4';
  if (lowerUrl.includes('.webm')) return 'webm';
  return 'unknown';
};

const ElegantVideoPlayer: React.FC<ElegantVideoPlayerProps> = ({
  videoUrl,
  hlsUrl,
  title,
  description,
  thumbnailUrl,
  onNext,
  onPrevious,
  autoPlay = false,
  chapters = [],
  subtitles = [],
  actors = [],
  sceneInfo,
  preferHLS = true,
  onStreamError,
  comments = [],
  onAddComment,
  userAvatarUrl,
  showComments = true,
  profession = 'videographer', // Default to videographer for video player
}) => {
  // Theming system - use profession prop
  const theming = useTheming(profession);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hlsServiceRef = useRef<HLSStreamingService | null>(null);

  // Core playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('Auto');
  const [isFavorited, setIsFavorited] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ show: false, time: 0, x: 0 });
  const [qualityMenuAnchor, setQualityMenuAnchor] = useState<null | HTMLElement>(null);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Streaming state
  const [streamType, setStreamType] = useState<StreamType>('unknown');
  const [buffered, setBuffered] = useState(0); // Buffer progress (0-100)
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hlsQualityLevels, setHlsQualityLevels] = useState<Array<{ index: number; height: number; bitrate: number }>>([]);
  const [isBuffering, setIsBuffering] = useState(false);

  // Get profession colors from theming system
  const professionColors = theming.colors;

  // Theme-aware colors - dark mode video player with profession accent
  const colors = {
    bg: '#1a1a1a',
    card: '#252525',
    accent: professionColors.primary, // Use profession primary color for accent
    accentLight: professionColors.light,
    accentDark: professionColors.dark,
    text: '#ffffff',
    textSecondary: '#888888',
    border: '#333333',
    controlsBg: 'rgba(60, 60, 60, 0.95)',
    // Themed elements
    progressBar: professionColors.primary,
    progressBarHover: professionColors.accent,
    favoriteActive: professionColors.primary,
    chapterMarker: professionColors.primary,
    buttonHover: `${professionColors.primary}20`, // 20% opacity
  };

  // Initialize HLS streaming or fallback to direct playback
  const initializeStream = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous HLS instance
    if (hlsServiceRef.current) {
      hlsServiceRef.current.destroy();
      hlsServiceRef.current = null;
    }

    // Determine which URL to use
    const effectiveUrl = hlsUrl || videoUrl;
    if (!effectiveUrl) return;

    const detectedType = detectStreamType(effectiveUrl);
    setStreamType(detectedType);
    setStreamError(null);

    console.log(`🎬 Video player initializing: type=${detectedType}, url=${effectiveUrl.substring(0, 50)}...`);

    // HLS streaming (best for moov atom issues)
    if (detectedType === 'hls' || (hlsUrl && preferHLS)) {
      const hlsService = new HLSStreamingService();
      hlsServiceRef.current = hlsService;

      if (HLSStreamingService.isSupported()) {
        hlsService.loadStream(video, hlsUrl || effectiveUrl);

        // Get quality levels after manifest loads
        setTimeout(() => {
          const levels = hlsService.getQualityLevels();
          if (levels.length > 0) {
            setHlsQualityLevels(levels);
            console.log('📊 HLS quality levels: ', levels);
          }
        }, 2000);

        return;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = hlsUrl || effectiveUrl;
        console.log('🍎 Using Safari native HLS');
        return;
      }
    }

    // Direct MP4/WebM playback (may have moov atom issues)
    if (videoUrl) {
      video.src = videoUrl;
      console.log('📹 Using direct video playback (moov atom at start recommended)');
    }
  }, [videoUrl, hlsUrl, preferHLS]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setIsBuffering(false);
    };
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleError = () => {
      const errorMsg = video.error?.message || 'Video playback error';
      setStreamError(errorMsg);
      onStreamError?.(errorMsg);
      console.error('❌ Video error: ', video.error);
    };

    // Buffer progress tracking (helps detect moov atom issues)
    const updateBuffer = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferPercent = (bufferedEnd / video.duration) * 100;
        setBuffered(bufferPercent);
      }
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
    video.addEventListener('progress', updateBuffer);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
      video.removeEventListener('progress', updateBuffer);
    };
  }, [onStreamError]);

  // Initialize stream when URL changes
  useEffect(() => {
    initializeStream();

    // Cleanup on unmount
    return () => {
      if (hlsServiceRef.current) {
        hlsServiceRef.current.destroy();
        hlsServiceRef.current = null;
      }
    };
  }, [initializeStream]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showControls) {
      timer = setTimeout(() => setShowControls(false), 3000);
  }
    return () => clearTimeout(timer);
}, [showControls]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
  } else {
      video.play();
  }
    setIsPlaying(!isPlaying);
};

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = value;
    setCurrentTime(value);
};

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = value;
    setVolume(value);
    setIsMuted(value === 0);
};

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
  } else {
      video.volume = 0;
      setIsMuted(true);
  }
};

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
  } else {
      document.exitFullscreen();
  }
    setIsFullscreen(!isFullscreen);
};

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    
    video.playbackRate = speed;
    setPlaybackRate(speed);
    setSpeedMenuAnchor(null);
};

  const handleQualityChange = (newQuality: string, hlsLevelIndex?: number) => {
    setQuality(newQuality);
    setQualityMenuAnchor(null);

    // HLS quality switching
    if (hlsServiceRef.current) {
      if (newQuality === 'Auto' || hlsLevelIndex === undefined) {
        hlsServiceRef.current.setAutoQuality();
      } else {
        hlsServiceRef.current.setQualityLevel(hlsLevelIndex);
      }
    }
  };

  const handleTimelineHover = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    
    setPreview({
      show: true,
      time,
      x: event.clientX,
      thumbnail: `${thumbnailUrl}?t=${Math.floor(time)}`
    });
  };

  const handleTimelineLeave = () => {
    setPreview({ show: false, time: 0, x: 0 });
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const getCurrentSubtitle = () => {
    if (!showSubtitles || subtitles.length === 0) return null;
    
    const currentSubtitle = subtitles.find(sub => 
      currentTime >= sub.time && currentTime < sub.time + 3
    );
    
    return currentSubtitle?.text;
};

  const getCurrentChapter = () => {
    if (chapters.length === 0) return null;
    
    return chapters.reduce((prev, current) => 
      currentTime >= current.time ? current : prev
    );
};

  // Handle adding a comment
  const handleAddComment = () => {
    if (newCommentText.trim() && onAddComment) {
      onAddComment(newCommentText.trim(), currentTime);
      setNewCommentText('');
    }
  };

  // Get unique comment markers (users who commented with their timestamps)
  const commentMarkers = comments.reduce((acc, comment) => {
    const existing = acc.find(m => m.author === comment.author);
    if (!existing) {
      acc.push({ author: comment.author, avatarUrl: comment.avatarUrl, timestamp: comment.timestamp });
    }
    return acc;
  }, [] as { author: string; avatarUrl?: string; timestamp: number }[]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', bgcolor: colors.bg }}>
      {/* Main Video Container */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          flex: showComments ? '0 0 auto' : 1,
          aspectRatio: showComments ? '16/9' : undefined,
          borderRadius: '16px 40px 16px 16px', // Rounded corners, larger top-right
          overflow: 'hidden',
          bgcolor: '#000',
          '&:hover': {
            '& .video-controls': {
              opacity: 1
            }
          }
        }}
        onMouseMove={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Video Element - HLS or direct playback */}
        {(videoUrl || hlsUrl) ? (
          <StyledVideo
            ref={videoRef}
            poster={thumbnailUrl}
            playsInline
            crossOrigin="anonymous"
            onClick={togglePlay}
            autoPlay={autoPlay}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: thumbnailUrl
                ? `url(${thumbnailUrl})`
                : 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        )}

        {/* User Avatar in top-right */}
        {userAvatarUrl && (
          <Avatar
            src={userAvatarUrl}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              border: '2px solid rgba(255,255,255,0.3)',
              zIndex: 3,
            }}
          />
        )}

        {/* Preview Thumbnail in bottom-left (like reference) */}
        <Fade in={showControls && duration > 0}>
          <Paper
            sx={{
              position: 'absolute',
              bottom: 60,
              left: 16,
              width: 120,
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: 'transparent',
              border: '2px solid rgba(255,255,255,0.3)',
              zIndex: 3,
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: 70,
                backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                bgcolor: thumbnailUrl ? 'transparent' : 'rgba(0,0,0,0.5)',
              }}
            />
            <Box sx={{ bgcolor: 'rgba(0,0,0,0.7)', px: 1, py: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                {formatTime(currentTime)}
              </Typography>
            </Box>
          </Paper>
        </Fade>

        {/* Stream Error Display */}
        {streamError && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 5,
              bgcolor: 'rgba(0, 0, 0, 0.8)',
              p: 3,
              borderRadius: 2,
              border: `1px solid ${colors.accent}50` // 50% opacity
            }}
          >
            <ErrorOutline sx={{ fontSize: 48, color: colors.accent, mb: 1 }} />
            <Typography variant="body1" sx={{ color: '#fff' }}>
              Video playback error
            </Typography>
            <Typography variant="caption" sx={{ color: '#aaa' }}>
              {streamError}
            </Typography>
          </Box>
        )}

        {/* Buffering Indicator */}
        {isBuffering && !isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 4
            }}
          >
            <CircularProgress size={60} sx={{ color: colors.accent }} />
          </Box>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2
            }}
          >
            <LinearProgress
              sx={{
                backgroundColor: 'transparent',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: colors.accent
                }
              }}
            />
          </Box>
        )}

      {/* Buffer Progress Bar (shows download progress) */}
      {buffered > 0 && buffered < 100 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 80,
            left: 16,
            right: 16,
            height: 3,
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 1,
            zIndex: 2,
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              width: `${buffered}%`,
              height: '100%',
              bgcolor: 'rgba(255, 255, 255, 0.3)',
              transition: 'width 0.3s ease'
            }}
          />
        </Box>
      )}

      {/* Top Overlay Controls */}
      <Fade in={showControls} timeout={300}>
        <Box
          sx={{
            position: 'absolute',
            top:  0,
            left:  0,
            right:  0,
            background: 'linear-gradient(rgba(0,0,0,0.8), transparent)',
            backdropFilter: 'blur(20px)',
            p:  2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            zIndex: 3}}
        >
          {/* Left: Video Info */}
          <Box>
            <Typography variant="h5" sx={{  color: '#fff', fontWeight: 'bold', mb:  1  }}>
              {title}
            </Typography>
            {description && (
              <Typography variant="body1" sx={{ color: '#e0e0e0', opacity: 0.9}}>
                {description}
              </Typography>
            )}
            {getCurrentChapter() && (
              <Chip
                label={getCurrentChapter()?.title}
                size="small"
                sx={{
                  mt: 1,
                  bgcolor: colors.buttonHover,
                  color: '#fff',
                  fontSize: '0.75rem'
            }}
              />
            )}
          </Box>

          {/* Right: Favorite, Quality, Info */}
          <Box sx={{ display: 'flex', gap:  1 }}>
            <Tooltip title="Favoritt">
              <IconButton
                onClick={() => setIsFavorited(!isFavorited)}
                sx={{
                  color: isFavorited ? colors.favoriteActive : '#fff',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                {isFavorited ? theming.getThemedIcon('favorite') : <FavoriteBorder />}
              </IconButton>
            </Tooltip>

            <Chip
              label={quality}
              icon={<HighQuality />}
              size="small"
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: '#fff',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${colors.accent}20`
            }}
            />

            {(actors.length > 0 || sceneInfo) && (
              <Tooltip title="Scene Info">
                <IconButton
                  onClick={() => setShowInfo(!showInfo)}
                  sx={{
                    color: showInfo ? colors.accent : '#fff',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: colors.buttonHover }
                }}
                >
                  {theming.getThemedIcon('info')}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Fade>

      {/* Scene Info Popup (Amazon X-ray inspired) */}
      <Fade in={showInfo} timeout={300}>
        <Paper
          sx={{
            position: 'absolute',
            top: 80,
            right: 16,
            width: 300,
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 2,
            p: 2,
            zIndex: 4,
            ...theming.getThemedCardSx()
          }}
        >
          <Typography variant="h6" sx={{ color: theming.colors.primary, mb: 1 }}>
            Scene Information
          </Typography>
          {sceneInfo && (
            <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 2 }}>
              {sceneInfo}
            </Typography>
          )}
          {actors.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
                Cast
              </Typography>
              {actors.map((actor, index) => (
                <Typography key={index} variant="body2" sx={{ color: '#e0e0e0' }}>
                  {actor}
                </Typography>
              ))}
            </>
          )}
        </Paper>
      </Fade>

      {/* Glass Morphism Controls Overlay */}
      <Fade in={showControls} timeout={300}>
        <Box
          className="video-controls"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
            backdropFilter: 'blur(20px)',
            borderTop: `1px solid ${colors.accent}20`,
            p: 2,
            zIndex: 3}}
        >
          {/* Custom Progress Bar with Chapter Markers */}
          <Box 
            ref={progressRef}
            sx={{ mb: 2, position: 'relative'}}
            onMouseMove={handleTimelineHover}
            onMouseLeave={handleTimelineLeave}
          >
            {/* Chapter Markers */}
            {chapters.map((chapter, index) => (
              <Tooltip key={index} title={chapter.title}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: -2,
                    left: `${(chapter.time / duration) * 100}%`,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    border: `2px solid ${colors.chapterMarker}`,
                    cursor: 'pointer',
                    zIndex: 2,
                    transform: 'translateX(-50%)',
                    '&:hover': {
                      transform: 'translateX(-50%) scale(1.3)'
                    }
                  }}
                  onClick={() => handleSeek(chapter.time)}
                />
              </Tooltip>
            ))}
            
            <Slider
              value={currentTime}
              max={duration}
              onChange={(_, value) => handleSeek(value as number)}
              sx={{
                color: colors.progressBar,
                height: 6,
                '& .MuiSlider-thumb': {
                  width: 16,
                  height: 16,
                  background: '#fff',
                  border: `2px solid ${colors.progressBar}`,
                  '&:hover': {
                    boxShadow: `0 0 0 8px ${colors.buttonHover}`
                  }
                },
                '& .MuiSlider-track': {
                  background: `linear-gradient(90deg, ${colors.progressBar}, ${colors.progressBarHover})`,
                  border: 'none'
                },
                '& .MuiSlider-rail': {
                  background: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            />
          </Box>

          {/* Timeline Preview */}
          <Fade in={preview.show} timeout={200}>
            <Paper
              sx={{
                position: 'fixed',
                left: preview.x - 75,
                bottom: 100,
                width: 150,
                height: 100,
                bgcolor: 'rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 2,
                p: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 5,
                pointerEvents: 'none',
                ...theming.getThemedCardSx()
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: 70,
                  borderRadius: 1,
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  backgroundImage: preview.thumbnail ? `url(${preview.thumbnail})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
              <Typography variant="caption" sx={{ color: '#fff', mt: 0.5 }}>
                {formatTime(preview.time)}
              </Typography>
            </Paper>
          </Fade>

          {/* Control Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Play/Pause */}
            <IconButton
              onClick={togglePlay}
              sx={{
                color: '#fff',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)','&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'scale(1.1)'
                },
                transition: 'all 0.2s'
              }}
            >
              {isPlaying ? theming.getThemedIcon('pause') : theming.getThemedIcon('play')}
            </IconButton>

            {/* Skip Controls */}
            <Tooltip title="Gå tilbake 10s">
              <IconButton
                onClick={() => skip(-10)}
                sx={{
                  color: '#fff','&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
              }}
              >
                <Replay10 />
              </IconButton>
            </Tooltip>

            {/* Previous/Next */}
            {onPrevious && (
              <Tooltip title="Forrige video">
                <IconButton
                  onClick={onPrevious}
                  sx={{
                    color: '#fff',
                    '&:hover': { bgcolor: colors.buttonHover }
                }}
                >
                  {theming.getThemedIcon('skipPrevious')}
                </IconButton>
              </Tooltip>
            )}

            {onNext && (
              <Tooltip title="Neste video">
                <IconButton
                  onClick={onNext}
                  sx={{
                    color: '#fff',
                    '&:hover': { bgcolor: colors.buttonHover }
                }}
                >
                  {theming.getThemedIcon('skipNext')}
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Gå frem 10s">
              <IconButton
                onClick={() => skip(10)}
                sx={{
                  color: '#fff',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                <Forward10 />
              </IconButton>
            </Tooltip>

            {/* Volume Control */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 2 }}>
              <IconButton
                onClick={toggleMute}
                sx={{
                  color: '#fff',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                {isMuted ? theming.getThemedIcon('volumeOff') : theming.getThemedIcon('volumeUp')}
              </IconButton>
              <Slider
                value={isMuted ? 0 : volume}
                max={1}
                step={0.1}
                onChange={(_, value) => handleVolumeChange(value as number)}
                sx={{
                  width: 80,
                  color: colors.accent,
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                    background: '#fff',
                  },
                  '& .MuiSlider-track': {
                    bgcolor: colors.accent,
                  }
              }}
              />
            </Box>

            {/* Time Display */}
            <Typography variant="body2" sx={{ color: '#fff', minWidth: '100px'}}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>

            {/* Spacer */}
            <Box sx={{ flex:  1 }} />

            {/* Speed Control */}
            <Tooltip title="Hastighet">
              <IconButton
                onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
                sx={{
                  color: '#fff',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                {theming.getThemedIcon('speed')}
              </IconButton>
            </Tooltip>
            <Typography variant="caption" sx={{ color: '#fff', minWidth: '30px'}}>
              {playbackRate}x
            </Typography>

            {/* Quality Settings */}
            <Tooltip title="Kvalitet">
              <IconButton
                onClick={(e) => setQualityMenuAnchor(e.currentTarget)}
                sx={{
                  color: '#fff',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                {theming.getThemedIcon('settings')}
              </IconButton>
            </Tooltip>

            {/* Closed Captions */}
            <Tooltip title="Undertekster">
              <IconButton
                onClick={() => setShowSubtitles(!showSubtitles)}
                sx={{
                  color: showSubtitles ? colors.accent : '#fff',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                <ClosedCaption />
              </IconButton>
            </Tooltip>

            {/* Picture-in-Picture */}
            <Tooltip title="Bilde-i-bilde">
              <IconButton
                onClick={() => {
                  if (videoRef.current && 'requestPictureInPicture' in videoRef.current) {
                    videoRef.current.requestPictureInPicture();
                }
              }}
                sx={{
                  color: '#fff',
                  '&:hover': { bgcolor: colors.buttonHover }
              }}
              >
                <PictureInPicture />
              </IconButton>
            </Tooltip>

            {/* Fullscreen */}
            <IconButton
              onClick={toggleFullscreen}
              sx={{
                color: '#fff',
                '&:hover': { bgcolor: colors.buttonHover }
            }}
            >
              {isFullscreen ? theming.getThemedIcon('fullscreenExit') : theming.getThemedIcon('fullscreen')}
            </IconButton>
          </Box>
        </Box>
      </Fade>

        {/* Center Play Button (when paused) - Semi-transparent white/gray per reference */}
        {!isPlaying && !isLoading && (
          <Fade in={!isPlaying} timeout={300}>
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2
              }}
            >
              <IconButton
                onClick={togglePlay}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'rgba(200, 200, 200, 0.6)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.8)',
                    transform: 'scale(1.1)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <PlayArrow sx={{ fontSize: 48, color: 'rgba(0, 0, 0, 0.8)' }} />
              </IconButton>
            </Box>
          </Fade>
        )}

        {/* Blue Progress Bar at bottom of video */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            bgcolor: 'rgba(255,255,255,0.2)',
            zIndex: 4,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            handleSeek(percent * duration);
          }}
        >
          <Box
            sx={{
              width: `${(currentTime / duration) * 100 || 0}%`,
              height: '100%',
              bgcolor: colors.accent,
              transition: 'width 0.1s linear',
            }}
          />
        </Box>

        {/* Subtitles */}
        {showSubtitles && getCurrentSubtitle() && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(10px)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: 1,
              zIndex: 3
            }}
          >
            <Typography variant="body1" sx={{ textAlign: 'center' }}>
              {getCurrentSubtitle()}
            </Typography>
          </Box>
        )}
      </Box>
      {/* End of Video Container */}

      {/* Centered Pill-shaped Navigation Controls (below video per reference) */}
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: colors.controlsBg,
            borderRadius: '24px',
            px: 2,
            py: 1,
          }}
        >
          {/* Previous */}
          <IconButton
            onClick={onPrevious}
            disabled={!onPrevious}
            sx={{ color: colors.text, '&:disabled': { color: colors.textSecondary } }}
          >
            <SkipPrevious />
          </IconButton>

          {/* Play/Pause */}
          <IconButton
            onClick={togglePlay}
            sx={{
              color: colors.text,
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          {/* Next */}
          <IconButton
            onClick={onNext}
            disabled={!onNext}
            sx={{ color: colors.text, '&:disabled': { color: colors.textSecondary } }}
          >
            <SkipNext />
          </IconButton>
        </Box>
      </Box>

      {/* Comments Section (per reference design) */}
      {showComments && (
        <Box sx={{ display: 'flex', gap: 2, px: 2, pb: 2 }}>
          {/* Left side: Comment input & list */}
          <Box sx={{ flex: 1 }}>
            {/* Add comment input */}
            <TextField
              fullWidth
              placeholder="Add comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddComment();
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Avatar
                        src={userAvatarUrl}
                        sx={{ width: 32, height: 32 }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  bgcolor: colors.card,
                  borderRadius: '20px',
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.textSecondary },
                  '&.Mui-focused fieldset': { borderColor: colors.accent },
                },
                '& .MuiInputBase-input': { color: colors.text },
                '& .MuiInputBase-input::placeholder': { color: colors.textSecondary },
              }}
            />

            {/* Comments list */}
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {comments.map((comment) => (
                <Box
                  key={comment.id}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    mb: 2,
                    alignItems: 'flex-start',
                  }}
                >
                  <Avatar
                    src={comment.avatarUrl}
                    sx={{ width: 36, height: 36 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: colors.text, fontWeight: 600 }}>
                        {comment.author}
                      </Typography>
                      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                        {formatTime(comment.timestamp)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                      {comment.text}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right side: Comment markers (avatars with timestamps on the side) */}
          <Box sx={{ width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {commentMarkers.slice(0, 5).map((marker, idx) => (
              <Tooltip key={idx} title={`${marker.author} at ${formatTime(marker.timestamp)}`} placement="left">
                <Box
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleSeek(marker.timestamp)}
                >
                  <Avatar
                    src={marker.avatarUrl}
                    sx={{
                      width: 32,
                      height: 32,
                      border: '2px solid ' + colors.accent,
                    }}
                  />
                  <Typography variant="caption" sx={{ color: colors.textSecondary, fontSize: '0.65rem', textAlign: 'center', display: 'block' }}>
                    {formatTime(marker.timestamp)}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      {/* Speed Menu */}
      <Menu
        anchorEl={speedMenuAnchor}
        open={Boolean(speedMenuAnchor)}
        onClose={() => setSpeedMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff'
            }
          }
        }}
      >
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
          <MenuItem
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            selected={playbackRate === speed}
            sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
          >
            {speed}x
          </MenuItem>
        ))}
      </Menu>

      {/* Quality Menu - supports HLS adaptive bitrate levels */}
      <Menu
        anchorEl={qualityMenuAnchor}
        open={Boolean(qualityMenuAnchor)}
        onClose={() => setQualityMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff'
            }
          }
        }}
      >
        {/* Auto quality option */}
        <MenuItem
          onClick={() => handleQualityChange('Auto')}
          selected={quality === 'Auto'}
          sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
        >
          Auto {streamType === 'hls' && '(Adaptive)'}
        </MenuItem>

        {/* HLS quality levels if available */}
        {hlsQualityLevels.length > 0 ? (
          hlsQualityLevels.map((level) => {
            const label = level.height >= 2160 ? '4K' :
                         level.height >= 1080 ? '1080p' :
                         level.height >= 720 ? '720p' :
                         level.height >= 480 ? '480p' : `${level.height}p`;
            return (
              <MenuItem
                key={level.index}
                onClick={() => handleQualityChange(label, level.index)}
                selected={quality === label}
                sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
              >
                {label} ({Math.round(level.bitrate / 1000)}kbps)
              </MenuItem>
            );
          })
        ) : (
          /* Fallback quality options for non-HLS */
          ['4K', '1080p', '720p', '480p'].map((q) => (
            <MenuItem
              key={q}
              onClick={() => handleQualityChange(q)}
              selected={quality === q}
              sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              {q}
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
};

export default ElegantVideoPlayer;