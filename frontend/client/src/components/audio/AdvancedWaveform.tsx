import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Stack,
  Typography,
  Chip,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  ZoomOutMap,
  PlayArrow,
  Pause,
} from '@mui/icons-material';

interface AdvancedWaveformProps {
  waveformData: number[];
  stereoData?: { left: number[]; right: number[] };
  spectrogramData?: number[][];
  sampleRate: number;
  duration: number;
  currentTime?: number;
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
  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showSpectrogram, setShowSpectrogram] = useState(initialShowSpectrogram);
  const [showStereo, setShowStereo] = useState(initialShowStereo && !!stereoData);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const visibleSamples = useMemo(() => Math.floor(waveformData.length / zoom), [waveformData.length, zoom]);

  const startSample = useMemo(
    () => Math.floor(scrollOffset * Math.max(1, waveformData.length - visibleSamples)),
    [scrollOffset, waveformData.length, visibleSamples]
  );

  const endSample = useMemo(
    () => Math.min(startSample + visibleSamples, waveformData.length),
    [startSample, visibleSamples, waveformData.length]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (showSpectrogram && spectrogramData && spectrogramData.length > 0) {
      drawSpectrogram(ctx, width, height, spectrogramData);
    }

    if (showStereo && stereoData) {
      drawStereoWaveform(ctx, width, height, stereoData, startSample, endSample);
    } else {
      drawMonoWaveform(ctx, width, height, waveformData, startSample, endSample);
    }

    if (duration > 0) {
      const scrubberX = (currentTime / duration) * width;
      ctx.strokeStyle = '#ff8c00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scrubberX, 0);
      ctx.lineTo(scrubberX, height);
      ctx.stroke();
    }

    if (hoveredTime !== null && duration > 0) {
      const hoverX = (hoveredTime / duration) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
    }
  }, [
    waveformData,
    stereoData,
    spectrogramData,
    showSpectrogram,
    showStereo,
    currentTime,
    hoveredTime,
    startSample,
    endSample,
    duration,
    height
  ]);

  const drawMonoWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    canvasHeight: number,
    data: number[],
    start: number,
    end: number
  ) => {
    const visible = data.slice(start, end);
    const centerY = canvasHeight / 2;
    const amplitude = canvasHeight * 0.4;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#ef4444');
    gradient.addColorStop(0.05, '#3b82f6');
    gradient.addColorStop(0.5, '#3b82f6');
    gradient.addColorStop(0.95, '#3b82f6');
    gradient.addColorStop(1, '#ef4444');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    visible.forEach((value, i) => {
      const x = (i / Math.max(1, visible.length)) * width;
      const y = centerY - value * amplitude;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  };

  const drawStereoWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    canvasHeight: number,
    data: { left: number[]; right: number[] },
    start: number,
    end: number
  ) => {
    const leftData = data.left.slice(start, end);
    const rightData = data.right.slice(start, end);
    const quarterHeight = canvasHeight / 4;
    const amplitude = quarterHeight * 0.8;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    leftData.forEach((value, i) => {
      const x = (i / Math.max(1, leftData.length)) * width;
      const y = quarterHeight - value * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = '#9333ea';
    ctx.beginPath();
    rightData.forEach((value, i) => {
      const x = (i / Math.max(1, rightData.length)) * width;
      const y = canvasHeight - quarterHeight - value * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px monospace';
    ctx.fillText('L', 5, 15);
    ctx.fillText('R', 5, canvasHeight - 5);
  };

  const drawSpectrogram = (
    ctx: CanvasRenderingContext2D,
    width: number,
    canvasHeight: number,
    data: number[][]
  ) => {
    const rows = Math.min(data.length, 80);
    const rowHeight = canvasHeight / rows;

    for (let row = 0; row < rows; row += 1) {
      const rowData = data[row];
      if (!rowData || rowData.length === 0) continue;
      const binWidth = width / rowData.length;
      rowData.forEach((value, index) => {
        const intensity = Math.min(1, Math.max(0, value));
        const hue = 220 - intensity * 200;
        ctx.fillStyle = `hsl(${hue}, 80%, ${20 + intensity * 40}%)`;
        ctx.fillRect(index * binWidth, row * rowHeight, binWidth, rowHeight);
      });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickRatio = x / rect.width;
    onSeek(clickRatio * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoveredTime((x / rect.width) * duration);
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={() => setZoom(Math.min(zoom * 1.5, 10))}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={() => setZoom(Math.max(zoom / 1.5, 1))}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset Zoom">
            <IconButton size="small" onClick={() => setZoom(1)}>
              <ZoomOutMap />
            </IconButton>
          </Tooltip>
        </Stack>

        <Slider
          value={scrollOffset}
          onChange={(_, value) => setScrollOffset(value as number)}
          min={0}
          max={1}
          step={0.01}
          sx={{ maxWidth: 200 }}
        />

        <FormControlLabel
          control={<Switch checked={showSpectrogram} onChange={(e) => setShowSpectrogram(e.target.checked)} />}
          label="Spectrogram"
        />
        <FormControlLabel
          control={<Switch checked={showStereo} onChange={(e) => setShowStereo(e.target.checked)} />}
          label="Stereo"
        />

        <Chip
          label={`Peak: ${(peakLevel * 100).toFixed(0)}%`}
          color={isPeaking ? 'error' : 'default'}
          size="small"
        />

        <Chip
          icon={isPlaying ? <Pause /> : <PlayArrow />}
          label={isPlaying ? 'Playing' : 'Paused'}
          size="small"
          variant="outlined"
        />
      </Stack>

      <canvas
        ref={canvasRef}
        width={900}
        height={height}
        style={{ width: '100%', display: 'block', borderRadius: 8 }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredTime(null)}
      />

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        Sample rate: {sampleRate} Hz • Duration: {duration.toFixed(2)}s
      </Typography>
    </Box>
  );
}
