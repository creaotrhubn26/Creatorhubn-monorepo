/**
 * Audio Narration Component for ScrollStory
 * Provides synchronized audio narration with scroll progress
 * Supports multiple audio tracks, auto-play, and timeline synchronization
 */

import React, { useRef, useEffect, useState } from 'react';
import { Box, IconButton, Slider, Typography, Tooltip, Paper, Chip } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff, SkipNext, SkipPrevious } from '@mui/icons-material';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';

interface AudioTrack {
  id: string;
  url: string;
  title: string;
  startPage: number; // Page index where this track starts
  endPage?: number; // Page index where this track ends (optional)
  duration?: number; // Duration in seconds
  driveFileId?: string;
}

interface AudioNarrationProps {
  tracks: AudioTrack[];
  currentPage: number;
  scrollProgress: number;
  autoPlay?: boolean;
  syncWithScroll?: boolean;
  storyId: string;
}

export default function AudioNarration({
  tracks,
  currentPage,
  scrollProgress,
  autoPlay = false,
  syncWithScroll = true,
  storyId,
}: AudioNarrationProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const { analytics, features } = useEnhancedMasterIntegration();

  // Get current track based on page
  const currentTrack =
    tracks.find(
      (track) => currentPage >= track.startPage && (!track.endPage || currentPage <= track.endPage),
    ) || tracks[0];

  // Update audio source when track changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();

      if (autoPlay && !isPlaying) {
        handlePlay();
      }

      analytics.trackEvent('scroll_story_audio_track_change', {
        storyId,
        trackId: currentTrack.id,
        trackTitle: currentTrack.title,
        page: currentPage,
      });
    }
  }, [currentTrack?.id]);

  // Sync audio with scroll progress
  useEffect(() => {
    if (syncWithScroll && audioRef.current && duration > 0) {
      const targetTime = scrollProgress * duration;
      const diff = Math.abs(targetTime - currentTime);

      // Only seek if difference is significant (> 1 second)
      if (diff > 1) {
        audioRef.current.currentTime = targetTime;
      }
    }
  }, [scrollProgress, syncWithScroll, duration, currentTime]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);

      analytics.trackEvent('scroll_story_audio_play,', {
        storyId,
        trackId: currentTrack?.id,
        page: currentPage,
      });

      features.trackFeatureUsage('scroll-story', 'audio-narration-played', {
        trackId: currentTrack?.id,
      });
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);

      analytics.trackEvent('scroll_story_audio_pause', {
        storyId,
        trackId: currentTrack?.id,
        currentTime,
      });
    }
  };

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const vol = Array.isArray(newValue) ? newValue[0] : newValue;
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const handleTimeChange = (_event: Event, newValue: number | number[]) => {
    const time = Array.isArray(newValue) ? newValue[0] : newValue;
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : tracks.length - 1;
    setCurrentTrackIndex(prevIndex);
  };

  const handleNext = () => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(nextIndex);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: 600,
        p: 2,
        zIndex: 110,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        borderRadius: 2}}>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          setIsPlaying(false);
          handleNext();
        }}
      />

      {/* Track Info */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="body2" color="white" fontWeight="bold">
            {currentTrack?.title || 'No track'}
          </Typography>
          <Typography variant="caption" color="grey.400">
            Track {currentTrackIndex + 1} of {tracks.length}
          </Typography>
        </Box>
        {syncWithScroll && (
          <Chip label="Scroll Synced" size="small" color="primary" sx={{ opacity: 0.8 }} />
        )}
      </Box>

      {/* Progress Slider */}
      <Box mb={1}>
        <Slider
          value={currentTime}
          max={duration}
          onChange={handleTimeChange}
          sx={{
            color: 'primary.main', '& .MuiSlider-thumb': {
              width: 12,
              height: 12,
            }}}
        />
        <Box display="flex" justifyContent="space-between">
          <Typography variant="caption" color="grey.400">
            {formatTime(currentTime)}
          </Typography>
          <Typography variant="caption" color="grey.400">
            {formatTime(duration)}
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Previous Track">
            <IconButton onClick={handlePrevious} size="small" sx={{ color: 'white' }}>
              <SkipPrevious />
            </IconButton>
          </Tooltip>

          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <IconButton
              onClick={isPlaying ? handlePause : handlePlay}
              sx={{
                color: 'white',
                backgroundColor: 'primary.main','&:hover': { backgroundColor: 'primary.dark' }}}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Next Track">
            <IconButton onClick={handleNext} size="small" sx={{ color: 'white' }}>
              <SkipNext />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Volume Control */}
        <Box display="flex" alignItems="center" gap={1} width={150}>
          <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
            <IconButton onClick={handleMuteToggle} size="small" sx={{ color: 'white' }}>
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
          </Tooltip>
          <Slider
            value={volume}
            max={1}
            step={0.1}
            onChange={handleVolumeChange}
            sx={{
              color: 'white','& .MuiSlider-thumb': {
                width: 10,
                height: 10,
              }}}
          />
        </Box>
      </Box>
    </Paper>
  );
}
