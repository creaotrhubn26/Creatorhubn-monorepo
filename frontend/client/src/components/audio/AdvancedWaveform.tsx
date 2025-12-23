/**
 * ADVANCED WAVEFORM COMPONENT
 * Professional waveform visualization with:
 * - Stereo L/R channels
 * - Spectrogram overlay
 * - Scrubber line with playback sync
 * - Zoom controls
 * - Real-time level metering
 * - Peak indicators
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, IconButton, Slider, Stack, Typography, Chip, Tooltip, Switch, FormControlLabel } from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  ZoomOutMap,
  ShowChart,
  GraphicEq,
  PlayArrow,
  Pause
} from '@mui/icons-material';

interface AdvancedWaveformProps {
  waveformData: number[];  // Mono or average
  stereoData?: { left: number[];, right: number[] };  // Separate L/R channels
  spectrogramData?: number[][];  // Frequency bins over time
  sampleRate: number;
  duration: number;  // seconds
  currentTime?: number;  // Current playback position
  onSeek?: (time: number) => void;
  isPlaying?: boolean;
  peakLevel?: number;
  isPeaking?: boolean;
  height?: number;
  showSpectrogram?: boolean;
  showStereo?: boolean;
}

export default function AdvancedWaveform({
  waveformData,
  stereoData,
  spectrogramData,
  sampleRate,
  duration,
  currentTime = 0,
  onSeek,
  isPlaying = false,
  peakLevel = 0,
  isPeaking = false,
  height = 200,
  showSpectrogram: initialShowSpectrogram = false,
  showStereo: initialShowStereo = false
}: AdvancedWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showSpectrogram, setShowSpectrogram] = useState(initialShowSpectrogram);
  const [showStereo, setShowStereo] = useState(initialShowStereo && !!stereoData);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  // Calculate visible range based on zoom
  const visibleSamples = useMemo(() => {
    return Math.floor(waveformData.length / zoom);
  }, [waveformData.length, zoom]);

  const startSample = useMemo(() => {
    return Math.floor(scrollOffset * (waveformData.length - visibleSamples));
  }, [scrollOffset, waveformData.length, visibleSamples]);

  const endSample = useMemo(() => {
    return Math.min(startSample + visibleSamples, waveformData.length);
  }, [startSample, visibleSamples, waveformData.length]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw spectrogram if enabled
    if (showSpectrogram && spectrogramData && spectrogramData.length > 0) {
      drawSpectrogram(ctx, width, height);
    }

    // Draw waveform
    if (showStereo && stereoData) {
      drawStereoWaveform(ctx, width, height);
    } else {
      drawMonoWaveform(ctx, width, height);
    }

    // Draw scrubber line
    if (currentTime > 0) {
      const scrubberX = (currentTime / duration) * width;
      ctx.strokeStyle = '#ff8c00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scrubberX, 0);
      ctx.lineTo(scrubberX, height);
      ctx.stroke();
    }

    // Draw hover line
    if (hoveredTime !== null) {
      const hoverX = (hoveredTime / duration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
    }

    // Draw peak indicators
    drawPeakIndicators(ctx, width, height);
  }, [waveformData, stereoData, spectrogramData, showSpectrogram, showStereo, currentTime, hoveredTime, startSample, endSample, duration]);

  const drawMonoWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const visibleData = waveformData.slice(startSample, endSample);
    const centerY = height / 2;
    const amplitude = height * 0.4;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#ef4444');
    gradient.addColorStop(0.05'#3b82f6');
    gradient.addColorStop(0.5'#3b82f6');
    gradient.addColorStop(0.95'#3b82f6');
    gradient.addColorStop(1'#ef4444');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    visibleData.forEach((value, i) => {
      const x = (i / visibleData.length) * width;
      const y = centerY - value * amplitude;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  };

  const drawStereoWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!stereoData) return;

    const leftData = stereoData.left.slice(startSample, endSample);
    const rightData = stereoData.right.slice(startSample, endSample);
    
    const quarterHeight = height / 4;
    const leftCenterY = quarterHeight;
    const rightCenterY = height - quarterHeight;
    const amplitude = quarterHeight * 0.8;

    // Draw left channel (top)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    leftData.forEach((value, i) => {
      const x = (i / leftData.length) * width;
      const y = leftCenterY - value * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw right channel (bottom)
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    rightData.forEach((value, i) => {
      const x = (i / rightData.length) * width;
      const y = rightCenterY - value * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw channel labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('L', 5, 15);
    ctx.fillText('R', 5, height - 5);
  };

  const drawSpectrogram = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Placeholder for spectrogram - would need FFT data
    // This would show frequency content over time
  };

  const drawPeakIndicators = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const visibleData = waveformData.slice(startSample, endSample);
    
    visibleData.forEach((value, i) => {
      if (value > 0.95) {
        const x = (i / visibleData.length) * width;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, height / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  // Handle canvas click for seeking
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickRatio = x / rect.width;
    const seekTime = clickRatio * duration;
    
    onSeek(seekTime);
  };

  // Handle mouse move for hover time
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const hoverRatio = x / rect.width;
    setHoveredTime(hoverRatio * duration);
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
  };

  return (
    <Box>
      {/* Controls */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Zoom In">
            <IconButton
              size="small"
              onClick={() => setZoom(Math.min(zoom * 1.5, 10))}
              disabled={zoom >= 10}
            >
              <ZoomIn fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton
              size="small"
              onClick={() => setZoom(Math.max(zoom / 1.5, 1))}
              disabled={zoom <= 1}
            >
              <ZoomOut fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Zoom">
            <IconButton
              size="small"
              onClick={() => { setZoom(1); setScrollOffset(0); }}
            >
              <ZoomOutMap fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          Zoom: {zoom.toFixed(1)}x
        </Typography>

        {stereoData && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showStereo}
                onChange={(e) => setShowStereo(e.target.checked)}
              />
            }
            label={<Typography variant="caption">Stereo</Typography>}
          />
        )}

        {spectrogramData && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showSpectrogram}
                onChange={(e) => setShowSpectrogram(e.target.checked)}
              />
            }
            label={<Typography variant="caption">Spectrogram</Typography>}
          />
        )}

        {isPeaking && (
          <Chip
            label="PEAKING"
            size="small"
            sx={{
              bgcolor: '#ef4444',
              color: '#fff',
              animation: 'pulse 1s infinite'
            }}
          />
        )}
      </Stack>

      {/* Waveform Canvas */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          bgcolor: '#0a0a0a',
          borderRadius: 1,
          border: isPeaking ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden'
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={height}
          style={{ width: '100%', height: `${height}px`, cursor: onSeek ? 'pointer' : 'default' }}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Time display */}
        {hoveredTime !== null && (
          <Box
            sx={{
              position: 'absolute',
              top: 5,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(0,0,0,0.8)',
              color: 'white',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: '0.75rem',
              pointerEvents: 'none'
            }}
          >
            {formatTime(hoveredTime)}
          </Box>
        )}
      </Box>

      {/* Zoom scroll slider */}
      {zoom > 1 && (
        <Slider
          value={scrollOffset}
          onChange={(_, value) => setScrollOffset(value as number)}
          min={0}
          max={1}
          step={0.01}
          sx={{ mt: 1 }}
        />
      )}

      {/* Time markers */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {formatTime(0)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {formatTime(currentTime)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {formatTime(duration)}
        </Typography>
      </Stack>
    </Box>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

