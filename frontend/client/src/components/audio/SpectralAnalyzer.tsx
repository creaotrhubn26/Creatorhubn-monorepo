import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
} from '@mui/material';
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

  useEffect(() => {
    if (!audioUrl) return;

    const fetchSpectralData = async () => {
      try {
        const response = await fetch('/api/audio/spectral-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          if (viewMode === 'waterfall') {
            setWaterfallHistory((prev) => {
              const newHistory = [...prev, data.spectrum];
              return newHistory.slice(-100);
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch spectral data:', error);
      }
    };

    fetchSpectralData();

    if (isPlaying) {
      const interval = setInterval(fetchSpectralData, 100);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [audioUrl, isPlaying, currentTime, fftSize, viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height);

    if (viewMode === 'spectrum') {
      drawSpectrum(ctx, width, height, spectralData);
    } else if (viewMode === 'waterfall') {
      drawWaterfall(ctx, width, height, waterfallHistory);
    } else {
      drawPhaseCorrelation(ctx, width, height);
    }

    drawFrequencyLabels(ctx, width, height);
  }, [spectralData, waterfallHistory, viewMode, width, height]);

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 10; i += 1) {
      const y = (h / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      const db = -60 + i * 6;
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${db} dB`, w - 5, y - 2);
    }

    const frequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    frequencies.forEach((freq) => {
      const x = freqToX(freq, w);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });
  };

  const drawSpectrum = (ctx: CanvasRenderingContext2D, w: number, h: number, data: number[]) => {
    if (data.length === 0) return;

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const binWidth = w / data.length;

    data.forEach((value, index) => {
      const x = index * binWidth;
      const normalizedValue = (value + 60) / 60;
      const y = h - normalizedValue * h;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

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
        const hue = 240 - normalizedValue * 240;
        ctx.fillStyle = `hsl(${hue}, 100%, ${normalizedValue * 50}%)`;
        ctx.fillRect(x, y, binWidth, rowHeight);
      });
    });
  };

  const drawPhaseCorrelation = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let i = 0; i < 360; i += 1) {
      const angle = (i * Math.PI) / 180;
      const x = w / 2 + Math.cos(angle) * (w / 3);
      const y = h / 2 + Math.sin(angle) * (h / 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#444';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  };

  const drawFrequencyLabels = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const frequencies: Array<number | string> = [20, 50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k'];
    ctx.fillStyle = '#888';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';

    frequencies.forEach((freq) => {
      const numFreq = typeof freq === 'string' ? parseFloat(freq) * 1000 : freq;
      const x = freqToX(numFreq, w);
      ctx.fillText(String(freq), x, h - 5);
    });
  };

  const freqToX = (freq: number, w: number): number => {
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

      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="caption">FFT Size</Typography>
        <Slider
          value={fftSize}
          onChange={(_, value) => setFFTSize(value as number)}
          min={512}
          max={8192}
          step={512}
          sx={{ maxWidth: 200 }}
        />
      </Box>

      <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block' }} />
    </Paper>
  );
};

export default SpectralAnalyzer;
