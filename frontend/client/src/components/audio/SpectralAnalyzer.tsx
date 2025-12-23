/**
 * Spectral Analyzer Component
 * Professional frequency analysis with FFT, waterfall, and phase correlation
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton, Slider } from '@mui/material';
import { GraphicEq } from '@mui/icons-material';

interface SpectralAnalyzerProps {
  audioUrl?: string;
  isPlaying?: boolean;
  currentTime?: number;
  width?: number;
  height?: number;
}

type ViewMode = 'spectrum' | 'waterfall' | 'phase';

const SpectralAnalyzer: React.FC<SpectralAnalyzerProps> = ({
  audioUrl,
  isPlaying = false,
  currentTime = 0,
  width = 800,
  height = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('spectrum');
  const [fftSize, setFFTSize] = useState(2048);
  const [spectralData, setSpectralData] = useState<number[]>([]);
  const [waterfallHistory, setWaterfallHistory] = useState<number[][]>([]);

  // Fetch spectral data
  useEffect(() => {
    if (!audioUrl) return;

    const fetchSpectralData = async () => {
      try {
        const response = await fetch('/api/audio/spectral-analysis', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            audioUrl,
            currentTime,
            fftSize
          })
        });

        const data = await response.json();

        if (data.success) {
          setSpectralData(data.spectrum);

          // Add to waterfall history
          if (viewMode === 'waterfall') {
            setWaterfallHistory(prev => {
              const newHistory = [...prev, data.spectrum];
              return newHistory.slice(-100); // Keep last 100 frames
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch spectral data: ', error);
      }
    };

    fetchSpectralData();

    // Update every 100ms when playing
    if (isPlaying) {
      const interval = setInterval(fetchSpectralData, 100);
      return () => clearInterval(interval);
    }
  }, [audioUrl, isPlaying, currentTime, fftSize, viewMode]);

  // Draw visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height);

    // Draw based on view mode
    switch (viewMode) {
      case 'spectrum':
        drawSpectrum(ctx, width, height, spectralData);
        break;
      case 'waterfall':
        drawWaterfall(ctx, width, height, waterfallHistory);
        break;
      case 'phase':
        drawPhaseCorrelation(ctx, width, height);
        break;
    }

    // Draw frequency labels
    drawFrequencyLabels(ctx, width, height);

  }, [spectralData, waterfallHistory, viewMode, width, height]);

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;

    // Horizontal lines (dB scale)
    for (let i = 0; i <= 10; i++) {
      const y = (h / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      // dB labels
      const db = -60 + (i * 6);
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${db} dB`, w - 5, y - 2);
    }

    // Vertical lines (frequency scale)
    const frequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    frequencies.forEach(freq => {
      const x = freqToX(freq, w);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });
  };

  const drawSpectrum = (ctx: CanvasRenderingContext2D, w: number, h: number, data: number[]) => {
    if (data.length === 0) return;

    // Draw spectrum line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const binWidth = w / data.length;

    data.forEach((value, index) => {
      const x = index * binWidth;
      const normalizedValue = (value + 60) / 60; // Normalize -60dB to 0dB
      const y = h - (normalizedValue * h);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Fill under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  };

  const drawWaterfall = (ctx: CanvasRenderingContext2D, w: number, h: number, history: number[][]) => {
    if (history.length === 0) return;

    const rowHeight = h / history.length;

    history.forEach((frame, frameIndex) => {
      const y = frameIndex * rowHeight;
      const binWidth = w / frame.length;

      frame.forEach((value, binIndex) => {
        const x = binIndex * binWidth;
        const normalizedValue = (value + 60) / 60;

        // Color based on intensity
        const hue = 240 - (normalizedValue * 240); // Blue to red
        ctx.fillStyle = `hsl(${hue}, 100%, ${normalizedValue * 50}%)`;
        ctx.fillRect(x, y, binWidth, rowHeight);
      });
    });
  };

  const drawPhaseCorrelation = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Draw Lissajous curve for phase correlation
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;

    // Simulate phase correlation (in real implementation, use actual L/R channel data)
    ctx.beginPath();
    for (let i = 0; i < 360; i++) {
      const angle = (i * Math.PI) / 180;
      const x = w / 2 + (Math.cos(angle) * w / 3);
      const y = h / 2 + (Math.sin(angle) * h / 3);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw center crosshair
    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  };

  const drawFrequencyLabels = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const frequencies = [20, 50, 100, 200, 500'1k','2k','5k','10k', '20k'];
    ctx.fillStyle = '#888';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';

    frequencies.forEach((freq, index) => {
      const numFreq = typeof freq === 'string' ? parseFloat(freq) * 1000 : freq;
      const x = freqToX(numFreq, w);
      ctx.fillText(String(freq), x, h - 5);
    });
  };

  const freqToX = (freq: number, w: number): number => {
    // Logarithmic frequency scale
    const minFreq = 20;
    const maxFreq = 20000;
    return (Math.log(freq / minFreq) / Math.log(maxFreq / minFreq)) * w;
  };

  return (
    <Paper elevation={3} sx={{ p: 2, width: width + 40 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <GraphicEq />
          <Typography variant="h6">Spectral Analyzer</Typography>
        </Box>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="spectrum">Spectrum</ToggleButton>
          <ToggleButton value="waterfall">Waterfall</ToggleButton>
          <ToggleButton value="phase">Phase</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', margin: '0 auto', border: '1px solid #333' }}
      />

      <Box mt={2}>
        <Typography variant="caption" gutterBottom>
          FFT Size: {fftSize}
        </Typography>
        <Slider
          value={fftSize}
          onChange={(_, value) => setFFTSize(value as number)}
          min={512}
          max={8192}
          step={512}
          marks={[
            { value: 512, label: '512' },
            { value: 2048, label: '2048' },
            { value: 8192, label: '8192' }
          ]}
        />
      </Box>
    </Paper>
  );
};

export default SpectralAnalyzer;

