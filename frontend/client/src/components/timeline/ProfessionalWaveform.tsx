/**
 * PROFESSIONAL WAVEFORM COMPONENT
 * Using wavesurfer.js for production-grade audio visualization
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Slider, Typography, Stack, Chip } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@mui/icons-material';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

interface ProfessionalWaveformProps {
  audioUrl: string;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  onReady?: (wavesurfer: WaveSurfer) => void;
  onRegionCreated?: (region: any) => void;
  enableRegions?: boolean;
}

export default function ProfessionalWaveform({
  audioUrl,
  height = 128,
  waveColor = '#667eea',
  progressColor = '#764ba2',
  cursorColor = '#ffffff',
  onReady,
  onRegionCreated,
  enableRegions = false
}: ProfessionalWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Create WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height,
      waveColor,
      progressColor,
      cursorColor,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      backend: 'WebAudio',
      interact: true,
      dragToSeek: true
    });
    
    // Add regions plugin if enabled
    if (enableRegions) {
      const regions = wavesurfer.registerPlugin(RegionsPlugin.create());
      
      regions.on('region-created', (region) => {
        console.log('Region created: ', region);
        if (onRegionCreated) {
          onRegionCreated(region);
        }
      });
      
      // Enable region creation on double-click
      wavesurfer.on('dblclick', (relativeX) => {
        const duration = wavesurfer.getDuration();
        const start = relativeX * duration;
        
        regions.addRegion({
          start,
          end: Math.min(start + 2, duration),
          color: 'rgba(102, 126, 234, 0.3)',
          drag: true,
          resize: true
        });
      });
    }
    
    // Load audio
    wavesurfer.load(audioUrl);
    
    // Event listeners
    wavesurfer.on('ready', () => {
      setIsReady(true);
      setDuration(wavesurfer.getDuration());
      
      console.log('✅ Waveform ready:', {
        duration: wavesurfer.getDuration(),
        sampleRate: wavesurfer.options.sampleRate
      });
      
      if (onReady) {
        onReady(wavesurfer);
      }
    });
    
    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    
    wavesurfer.on('timeupdate', (time) => {
      setCurrentTime(time);
    });
    
    wavesurferRef.current = wavesurfer;
    
    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, height, waveColor, progressColor, cursorColor, enableRegions]);
  
  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };
  
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume);
    }
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };
  
  return (
    <Box sx={{ width: '100%', bgcolor: '#1A1A1A', p: 2, borderRadius: 1 }}>
      {/* Waveform Container */}
      <Box 
        ref={containerRef} 
        sx={{ 
          width: '100%', 
          mb: 2,
          border: '1px solid #333',
          borderRadius: 1,
          overflow: 'hidden'
        }} 
      />
      
      {/* Controls */}
      <Stack direction="row" spacing={2} alignItems="center">
        <IconButton 
          onClick={handlePlayPause}
          disabled={!isReady}
          sx={{ color: '#667eea' }}
        >
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>
        
        <Typography variant="caption" sx={{ color: '#9CA3AF', fontFamily: 'monospace', minWidth: 80 }}>
          {formatTime(currentTime)}
        </Typography>
        
        <Typography variant="caption" sx={{ color: '#555', mx: 1 }}>
          /
        </Typography>
        
        <Typography variant="caption" sx={{ color: '#9CA3AF', fontFamily: 'monospace', minWidth: 80 }}>
          {formatTime(duration)}
        </Typography>
        
        <Box sx={{ flex: 1 }} />
        
        {isReady && (
          <Chip 
            label="Ready" 
            size="small" 
            sx={{ bgcolor: '#10B981', color: 'white', height: 20 }}
          />
        )}
        
        <VolumeUp sx={{ color: '#9CA3AF', fontSize: 20 }} />
        <Slider
          value={volume}
          onChange={(_, v) => handleVolumeChange(v as number)}
          min={0}
          max={1}
          step={0.01}
          sx={{ width: 100, color: '#667eea' }}
        />
        
        {enableRegions && (
          <Chip 
            label="Double-click to add region" 
            size="small" 
            variant="outlined"
            sx={{ color: '#9CA3AF', borderColor: '#333' }}
          />
        )}
      </Stack>
    </Box>
  );
}


