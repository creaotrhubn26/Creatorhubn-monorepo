/**
 * LightMeterOverlay - Professional Light Metering Tools
 *
 * Features: * - Real-time Histogram (RGB + Luminance)
 * - Zebra Stripes (overexposure indicator)
 * - False Color mode (exposure visualization)
 * - Focus Peaking (in-focus areas)
 * - Waveform monitor
 */

import React, { useRef, useEffect, useState } from 'react';
import { Box, ButtonGroup, Button, Tooltip, Paper, Typography, Stack, Chip } from '@mui/material';
import {
  BarChart as HistogramIcon,
  Straighten as ZebraIcon,
  Palette as FalseColorIcon,
  FilterCenterFocus as PeakingIcon,
  ShowChart as WaveformIcon,
} from '@mui/icons-material';

export type OverlayMode = 'none' | 'histogram' | 'zebra' | 'falsecolor' | 'peaking' | 'waveform';

interface LightMeterOverlayProps {
  mode: OverlayMode;
  onModeChange: (mode: OverlayMode) => void;
  canvas: HTMLCanvasElement | null; // Source canvas to analyze
}

/**
 * Calculate histogram from image data
 */
function calculateHistogram(imageData: ImageData): {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
} {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);
  const luma = new Array(256).fill(0);

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;

    // Calculate luminance (Rec., 709)
    const y = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
    luma[y]++;
  }

  // Normalize
  const totalPixels = imageData.width * imageData.height;
  return {
    r: r.map((v) => v / totalPixels),
    g: g.map((v) => v / totalPixels),
    b: b.map((v) => v / totalPixels),
    luma: luma.map((v) => v / totalPixels),
  };
}

/**
 * Histogram display component
 */
function HistogramDisplay({ canvas }: { canvas: HTMLCanvasElement | null }) {
  const histCanvas = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ avg: 0, overexposed: 0, underexposed: 0 });

  useEffect(() => {
    if (!canvas || !histCanvas.current) return;

    const interval = setInterval(() => {
      const ctx = canvas.getContext('2d, ');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const histogram = calculateHistogram(imageData);

      // Draw histogram
      const histCtx = histCanvas.current!.getContext('2d')!;
      const width = histCanvas.current!.width;
      const height = histCanvas.current!.height;

      // Clear
      histCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      histCtx.fillRect(0, 0, width, height);

      // Find max for scaling
      const maxVal = Math.max(...histogram.luma);

      // Draw RGB histograms
      const drawChannel = (data: number[], color: string, alpha: number = 0.5) => {
        histCtx.beginPath();
        histCtx.moveTo(0, height);
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * width;
          const y = height - (data[i] / maxVal) * height;
          histCtx.lineTo(x, y);
        }
        histCtx.lineTo(width, height);
        histCtx.closePath();
        histCtx.fillStyle = color.replace(')', `, ${alpha})`).replace('rgb,', 'rgba');
        histCtx.fill();
      };

      drawChannel(histogram.r'rgb(255, 0, 0)');
      drawChannel(histogram.g'rgb(0, 255, 0)');
      drawChannel(histogram.b'rgb(0, 255, 255)');

      // Draw luminance (white outline)
      histCtx.beginPath();
      histCtx.moveTo(0, height);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * width;
        const y = height - (histogram.luma[i] / maxVal) * height;
        histCtx.lineTo(x, y);
      }
      histCtx.strokeStyle = 'rgba(2, 5, 5, 255, 255, 0.8)';
      histCtx.lineWidth = 1.5;
      histCtx.stroke();

      // Calculate stats
      const data = imageData.data;
      let totalLuma = 0;
      let overexposed = 0;
      let underexposed = 0;

      for (let i = 0; i < data.length; i += 4) {
        const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        totalLuma += y;
        if (y > 250) overexposed++;
        if (y < 10) underexposed++;
      }

      const avg = totalLuma / (imageData.width * imageData.height);
      const totalPixels = imageData.width * imageData.height;

      setStats({
        avg: Math.round(avg),
        overexposed: Math.round((overexposed / totalPixels) * 100),
        underexposed: Math.round((underexposed / totalPixels) * 100),
      });
    }, 100);

    return () => clearInterval(interval);
  }, [canvas]);

  return (
    <Paper sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.9)', borderRadius: 1 }}>
      <Stack spacing={1}>
        <Typography variant="caption" color="white" fontWeight="bold">
          Histogram & Exposure
        </Typography>
        <canvas
          ref={histCanvas}
          width={256}
          height={100}
          style={{ width: '100%', height: 'auto', imageRendering: 'crisp-edges' }}
        />
        <Stack direction="row" spacing={2} justifyContent="space-around">
          <Tooltip title="Average luminance">
            <Chip
              label={`Avg: ${stats.avg}`}
              size="small"
              sx={{ bgcolor: 'grey.700', color: 'white' }}
            />
          </Tooltip>
          <Tooltip title="Clipped highlights">
            <Chip
              label={`Clip: ${stats.overexposed}%`}
              size="small"
              sx={{ bgcolor: stats.overexposed > 5 ? 'error.main' : 'grey.700', color: 'white' }}
            />
          </Tooltip>
          <Tooltip title="Crushed shadows">
            <Chip
              label={`Black: ${stats.underexposed}%`}
              size="small"
              sx={{ bgcolor: stats.underexposed > 5 ? 'warning.main' : 'grey.700', color: 'white' }}
            />
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

/**
 * Light Meter Overlay Component
 */
export function LightMeterOverlay({ mode, onModeChange, canvas }: LightMeterOverlayProps) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 100,
        pointerEvents: 'auto'}}
    >
      <Stack spacing={2}>
        {/* Mode Selector */}
        <Paper sx={{ p: 1, bgcolor: 'rgba(0, 0, 0, 0.8)' }}>
          <ButtonGroup size="small" orientation="vertical" fullWidth>
            <Tooltip title="Histogram" placement="left">
              <Button
                onClick={() => onModeChange(mode === 'histogram' ? 'none' : 'histogram')}
                variant={mode === 'histogram' ? 'contained' : 'outlined'}
                startIcon={<HistogramIcon />}
              >
                Histogram
              </Button>
            </Tooltip>

            <Tooltip title="Zebra Stripes (Overexposure)" placement="left">
              <Button
                onClick={() => onModeChange(mode === 'zebra' ? 'none' : 'zebra')}
                variant={mode === 'zebra' ? 'contained' : 'outlined'}
                startIcon={<ZebraIcon />}
              >
                Zebra
              </Button>
            </Tooltip>

            <Tooltip title="False Color (Exposure Map)" placement="left">
              <Button
                onClick={() => onModeChange(mode === 'falsecolor' ? 'none' : 'falsecolor')}
                variant={mode === 'falsecolor' ? 'contained' : 'outlined'}
                startIcon={<FalseColorIcon />}
              >
                False Color
              </Button>
            </Tooltip>

            <Tooltip title="Focus Peaking" placement="left">
              <Button
                onClick={() => onModeChange(mode === 'peaking' ? 'none' : 'peaking')}
                variant={mode === 'peaking' ? 'contained' : 'outlined'}
                startIcon={<PeakingIcon />}
              >
                Peaking
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Paper>

        {/* Histogram Display */}
        {mode === 'histogram' && canvas && <HistogramDisplay canvas={canvas} />}

        {/* Legend for modes */}
        {mode === 'falsecolor' && (
          <Paper sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.9)' }}>
            <Typography
              variant="caption"
              color="white"
              fontWeight="bold"
              gutterBottom
              sx={{ display: 'block' }}
            >
              False Color Legend
            </Typography>
            <Stack spacing={0.5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 12, bgcolor: 'rgb(0, 0, 128)' }} />
                <Typography variant="caption" color="white">
                  Very Dark (&lt;10%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 12, bgcolor: 'rgb(0, 0, 255)' }} />
                <Typography variant="caption" color="white">
                  Dark (10-20%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 12, bgcolor: 'rgb(0, 255, 255)' }} />
                <Typography variant="caption" color="white">
                  Underexposed (20-40%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 12, bgcolor: 'rgb(0, 255, 0)' }} />
                <Typography variant="caption" color="white">
                  Good (40-60%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 12, bgcolor: 'rgb(255, 255, 0)' }} />
                <Typography variant="caption" color="white">
                  Bright (60-80%)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 12, bgcolor: 'rgb(255, 0, 0)' }} />
                <Typography variant="caption" color="white">
                  Clipped (&gt;80%)
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {mode === 'zebra' && (
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(0, 0, 0, 0.9)' }}>
            <Typography variant="caption" color="white">
              🦓 Stripes indicate overexposure (&gt;90%)
            </Typography>
          </Paper>
        )}

        {mode === 'peaking' && (
          <Paper sx={{ p: 1.5, bgcolor: 'rgba(0, 0, 0, 0.9)' }}>
            <Typography variant="caption" color="white">
              🎯 Green highlights show in-focus areas
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
