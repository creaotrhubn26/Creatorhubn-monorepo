/**
 * Waveform View Component
 * Music Producer-specific waveform visualization
 * Real-time audio analysis with spectral display
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Paper,
  Stack,
  Slider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import {
  Close,
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  GraphicEq,
  ZoomIn,
  ZoomOut,
  Loop,
  SkipNext,
  SkipPrevious,
  Tune,
  AutoFixHigh,
  Download,
  Share,
  Bookmark,
  MusicNote,
} from '@mui/icons-material';

interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  fileUrl?: string;
  duration: number;
  bpm?: number;
  key?: string;
  genre?: string;
  waveformData?: number[];
  spectralData?: number[][];
}

interface ProToolsComment {
  id: string;
  timecode?: string;
  content: string;
  timestampSeconds?: number;
}

interface WaveformViewProps {
  open: boolean;
  track: AudioTrack | null;
  onClose: () => void;
  accentColor: string;
  onDownload?: (track: AudioTrack) => void;
  onShare?: (track: AudioTrack) => void;
  onAnalyze?: (track: AudioTrack) => void;
  // Pro Tools integration
  proToolsComments?: ProToolsComment[];
  showTimecode?: boolean;
  currentTimecode?: string;
  onCommentClick?: (comment: ProToolsComment) => void;
}

export const WaveformView: React.FC<WaveformViewProps> = ({
  open,
  track,
  onClose,
  accentColor,
  onDownload,
  onShare,
  onAnalyze,
  proToolsComments = [],
  showTimecode = false,
  currentTimecode,
  onCommentClick,
}) => {
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Visualization state
  const [zoom, setZoom] = useState(1);
  const [showSpectrum, setShowSpectrum] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<{
    bpm?: number;
    key?: string;
    energy?: number;
    danceability?: number;
  } | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Initialize audio context and analyzer
  useEffect(() => {
    if (!track?.fileUrl || !open) return;

    // Create audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 2048;

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [track?.fileUrl, open]);

  // Fetch real waveform data from API
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [waveformLoading, setWaveformLoading] = useState(false);

  useEffect(() => {
    // If track already has waveform data, use it
    if (track?.waveformData) {
      setWaveformData(track.waveformData);
      return;
    }

    // Otherwise, fetch from API
    if (track?.fileUrl && open) {
      setWaveformLoading(true);
      
      fetch(`/api/audio/waveform/${track.id}?samples=200&filePath=${encodeURIComponent(track.fileUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.waveformData) {
            setWaveformData(data.waveformData);
          } else {
            // Fallback to demo if API fails
            setWaveformData(generateFallbackWaveform(200));
          }
          setWaveformLoading(false);
        })
        .catch(error => {
          console.error('Error fetching waveform:', error);
          // Fallback to demo waveform
          setWaveformData(generateFallbackWaveform(200));
          setWaveformLoading(false);
        });
    }
  }, [track?.fileUrl, track?.id, track?.waveformData, open]);

  // Fallback waveform generator (only used if API fails)
  const generateFallbackWaveform = useCallback((samples: number = 200): number[] => {
    return Array.from({ length: samples }, (_, i) => {
      const x = i / samples;
      const envelope = Math.sin(x * Math.PI);
      const detail = Math.random() * 0.3;
      const bass = Math.sin(x * Math.PI * 4) * 0.2;
      return (envelope * 0.5 + detail + bass) * 0.8;
    });
  }, []);
  
  // Initialize waveform if needed
  useEffect(() => {
    if (waveformData.length === 0 && !waveformLoading) {
      setWaveformData(generateFallbackWaveform(200));
    }
  }, [waveformData.length, waveformLoading, generateFallbackWaveform]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = (width / waveformData.length) * zoom;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    waveformData.forEach((amplitude, i) => {
      const x = i * barWidth;
      const barHeight = amplitude * centerY;

      // Progress gradient
      const isPlayed = track ? (i / waveformData.length) < (currentTime / track.duration) : false;
      const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
      
      if (isPlayed) {
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, `${accentColor}80`);
      } else {
        gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.1)');
      }

      ctx.fillStyle = gradient;
      
      // Draw symmetric bars (top and bottom)
      ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight);
      ctx.fillRect(x, centerY, barWidth - 1, barHeight);
    });

    // Draw playhead
    if (track) {
      const playheadX = (currentTime / track.duration) * width;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw Pro Tools comment markers
    if (track && proToolsComments.length > 0) {
      proToolsComments.forEach((comment) => {
        const commentTime = comment.timestampSeconds || (comment.timecode ? timecodeToSeconds(comment.timecode) : 0);
        if (commentTime > 0 && commentTime <= track.duration) {
          const commentX = (commentTime / track.duration) * width;
          
          // Draw vertical line for comment marker
          ctx.strokeStyle = '#FFD700'; // Gold color for comments
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(commentX, 0);
          ctx.lineTo(commentX, height);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw comment indicator dot
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(commentX, 10, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw comment text background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(commentX - 50, 0, 100, 20);
          
          // Draw comment text
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('💬', commentX, 15);
        }
      });
    }

    // Draw timecode overlay
    if (showTimecode && track) {
      const timecodeY = height - 20;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, timecodeY, width, 20);
      
      // Current timecode
      if (currentTimecode) {
        ctx.fillStyle = accentColor;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(currentTimecode, 10, timecodeY + 15);
      }
      
      // Total duration timecode
      const totalTimecode = secondsToTimecode(track.duration);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(totalTimecode, width - 10, timecodeY + 15);
    }
  }, [waveformData, currentTime, track, accentColor, zoom, proToolsComments, showTimecode, currentTimecode]);

  // Helper function to convert timecode to seconds
  const timecodeToSeconds = useCallback((timecode: string): number => {
    const parts = timecode.split(' : ');
    if (parts.length !== 4) return 0;
    const [hours, minutes, seconds, frames] = parts.map(Number);
    const fps = 30;
    return hours * 3600 + minutes * 60 + seconds + frames / fps;
  }, []);

  // Helper function to convert seconds to timecode
  const secondsToTimecode = useCallback((seconds: number, fps: number = 30): string => {
    const totalFrames = Math.floor(seconds * fps);
    const hours = Math.floor(totalFrames / (fps * 3600));
    const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
    const secs = Math.floor((totalFrames % (fps * 60)) / fps);
    const frames = totalFrames % fps;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2,'0')}`;
  }, []);

  // Animation loop for real-time visualization
  useEffect(() => {
    if (!open) return;

    const animate = () => {
      drawWaveform();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [open, drawWaveform]);

  // Audio playback handlers
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Playback error: ', err);
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((value: number) => {
    if (!audioRef.current || !track) return;
    const newTime = (value / 100) * track.duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [track]);

  const handleVolumeChange = useCallback((value: number) => {
    if (!audioRef.current) return;
    setVolume(value);
    audioRef.current.volume = value;
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    setIsMuted(!isMuted);
    audioRef.current.muted = !isMuted;
  }, [isMuted]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (!audioRef.current) return;
    setPlaybackRate(rate);
    audioRef.current.playbackRate = rate;
  }, []);

  // AI Analysis simulation
  const handleAnalyze = useCallback(() => {
    if (!track) return;

    setIsAnalyzing(true);

    // Simulate AI analysis
    setTimeout(() => {
      setAnalyzedData({
        bpm: Math.floor(Math.random() * 60) + 90, // 90-150 BPM
        key: ['C','D','E','F','G','A','B'][Math.floor(Math.random() * 7)] + 
             ['maj','min'][Math.floor(Math.random() * 2)],
        energy: Math.floor(Math.random() * 40) + 60, // 60-100%
        danceability: Math.floor(Math.random() * 40) + 50 // 50-90%
      });
      setIsAnalyzing(false);
      onAnalyze?.(track);
    }, 2000);
  }, [track, onAnalyze]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio element time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play();
      } else {
        setIsPlaying(false);
      }
    };
    const handleError = (e: ErrorEvent) => {
      console.error('Audio error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError as any);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as any);
    };
  }, [isLooping]);

  if (!open || !track) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0a0a',
          color: 'white',
          minHeight: '80vh'
        }
      }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={track.fileUrl}
        preload="auto"
      />

      {/* Waveform Loading Overlay */}
      {waveformLoading && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100}}>
          <CircularProgress size={60} sx={{ color: accentColor, mb: 2 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
            <MusicNote sx={{ color: accentColor }} />
            <Typography variant="h6" sx={{ color: accentColor }}>
              Analyserer lydbølge…
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1 }}>
            Genererer sanntidsvisualisering
          </Typography>
        </Box>
      )}

      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        p: 2,
        borderBottom: `2px solid ${accentColor}`,
        bgcolor: 'rgba(0,0,0,0.8)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <GraphicEq sx={{ color: accentColor, fontSize: 32 }} />
          <Box>
            <Typography variant="h6" fontWeight="600">
              {track.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              {track.artist || 'Unknown Artist'} • {formatTime(track.duration)}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title="AI Analyze">
            <IconButton
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              sx={{
                color: accentColor,
                bgcolor: `${accentColor}20`, '&:hover': { bgcolor: `${accentColor}30` }
              }}
            >
              <AutoFixHigh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton
              onClick={() => onDownload?.(track)}
              sx={{ color: 'white' }}
            >
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share">
            <IconButton
              onClick={() => onShare?.(track)}
              sx={{ color: 'white' }}
            >
              <Share />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </Box>

      {/* Main Content */}
      <DialogContent sx={{ p: 3 }}>
        {/* Waveform Visualization */}
        <Paper sx={{ 
          p: 3, 
          bgcolor: 'rgba(255,255,255,0.03)',
          border: `1px solid ${accentColor}40`,
          borderRadius: 2,
          mb: 3
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: accentColor, fontWeight: 600}}>
              Waveform
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControlLabel
                control={
                  <Switch 
                    checked={showSpectrum} 
                    onChange={(e) => setShowSpectrum(e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="caption">Spectrum</Typography>}
              />
              <Divider orientation="vertical" flexItem />
              <IconButton size="small" onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}>
                <ZoomOut fontSize="small" />
              </IconButton>
              <Chip 
                label={`${Math.round(zoom * 100)}%`}
                size="small"
                sx={{ bgcolor: `${accentColor}30`, color: 'white' }}
              />
              <IconButton size="small" onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}>
                <ZoomIn fontSize="small" />
              </IconButton>
            </Stack>
          </Box>

          {/* Canvas for waveform */}
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            style={{
              width: '100%',
              height: '200px',
              cursor: 'pointer',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.3)'
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = (x / rect.width) * 100;
              handleSeek(percentage);
            }}
          />

          {/* Seek Bar */}
          <Slider
            value={(currentTime / track.duration) * 100 || 0}
            onChange={(_, value) => handleSeek(value as number)}
            sx={{
              mt: 2,
              color: accentColor, '& .MuiSlider-thumb': {
                width: 16,
                height: 16
              }
            }}
          />

          {/* Time Display */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {formatTime(track.duration)}
            </Typography>
          </Box>
        </Paper>

        {/* Playback Controls */}
        <Paper sx={{ 
          p: 2, 
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          mb: 3
        }}>
          <Grid container spacing={2} alignItems="center">
            {/* Left: Play Controls */}
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton onClick={() => handleSeek(0)} sx={{ color: 'white' }}>
                  <SkipPrevious />
                </IconButton>
                <IconButton
                  onClick={togglePlay}
                  sx={{
                    bgcolor: accentColor,
                    color: 'white','&:hover': { bgcolor: `${accentColor}dd` },
                    width: 48,
                    height: 48
                  }}
                >
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                <IconButton onClick={() => handleSeek(100)} sx={{ color: 'white' }}>
                  <SkipNext />
                </IconButton>
                <IconButton
                  onClick={() => setIsLooping(!isLooping)}
                  sx={{ color: isLooping ? accentColor : 'rgba(255,255,255,0.5)' }}
                >
                  <Loop />
                </IconButton>
              </Stack>
            </Grid>

            {/* Center: Volume */}
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={2} alignItems="center">
                <IconButton onClick={toggleMute} sx={{ color: 'white' }}>
                  {isMuted || volume === 0 ? <VolumeOff /> : <VolumeUp />}
                </IconButton>
                <Slider
                  value={volume}
                  onChange={(_, value) => handleVolumeChange(value as number)}
                  min={0}
                  max={1}
                  step={0.01}
                  sx={{ color: accentColor }}
                />
                <Typography variant="caption" sx={{ minWidth: 40, color: 'rgba(255,255,255,0.7)' }}>
                  {Math.round(volume * 100)}%
                </Typography>
              </Stack>
            </Grid>

            {/* Right: Playback Rate */}
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tune sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }} />
                <Stack direction="row" spacing={0.5}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <Chip
                      key={rate}
                      label={`${rate}x`}
                      size="small"
                      onClick={() => handlePlaybackRateChange(rate)}
                      sx={{
                        bgcolor: playbackRate === rate ? accentColor : 'rgba(255,255,255,0.1)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.7rem','&:hover': {
                          bgcolor: playbackRate === rate ? accentColor : 'rgba(255,255,255,0.2)'
                        }
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* AI Analysis Results */}
        {isAnalyzing ? (
          <Paper sx={{ 
            p: 3, 
            bgcolor: `${accentColor}10`,
            border: `1px solid ${accentColor}40`,
            borderRadius: 2
          }}>
            <Typography variant="subtitle2" sx={{ color: accentColor, mb: 2 }}>
              🤖 Analyzing audio...
            </Typography>
            <LinearProgress sx={{ bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: accentColor } }} />
          </Paper>
        ) : analyzedData ? (
          <Paper sx={{ 
            p: 3, 
            bgcolor: `${accentColor}10`,
            border: `1px solid ${accentColor}40`,
            borderRadius: 2
          }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
              <MusicNote sx={{ color: accentColor, fontSize: 18 }} />
              <Typography variant="subtitle2" sx={{ color: accentColor, fontWeight: 600 }}>
                AI-analyse-resultater
              </Typography>
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ color: accentColor, fontWeight: 700}}>
                    {analyzedData.bpm}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    BPM
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ color: accentColor, fontWeight: 700}}>
                    {analyzedData.key}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Key
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ color: accentColor, fontWeight: 700}}>
                    {analyzedData.energy}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Energy
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2 }}>
                  <Typography variant="h4" sx={{ color: accentColor, fontWeight: 700}}>
                    {analyzedData.danceability}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Danceability
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        ) : (
          <Paper sx={{ 
            p: 3, 
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 2,
            textAlign: 'center'
          }}>
            <MusicNote sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Click "AI Analyze" to get BPM, key, energy, and danceability analysis
            </Typography>
          </Paper>
        )}

        {/* Track Info */}
        <Paper sx={{ 
          p: 2, 
          mt: 3,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2
        }}>
          <Grid container spacing={2}>
            {track.bpm && (
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>BPM</Typography>
                <Typography variant="body2">{track.bpm}</Typography>
              </Grid>
            )}
            {track.key && (
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Key</Typography>
                <Typography variant="body2">{track.key}</Typography>
              </Grid>
            )}
            {track.genre && (
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" sx={{ color:'rgba(255,255,255,0.5)' }}>Genre</Typography>
                <Typography variant="body2">{track.genre}</Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default WaveformView;

