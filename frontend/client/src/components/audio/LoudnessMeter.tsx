import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { VolumeUp, Warning } from '@mui/icons-material';

interface LoudnessMeterProps {
  audioUrl?: string;
  isPlaying?: boolean;
  currentTime?: number;
  width?: number;
  height?: number;
}

interface LoudnessMetrics {
  momentaryLUFS: number;
  shortTermLUFS: number;
  integratedLUFS: number;
  truePeak: number;
  loudnessRange: number;
}

const LoudnessMeter: React.FC<LoudnessMeterProps> = ({
  audioUrl,
  isPlaying = false,
  currentTime = 0,
  width = 300,
  height = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metrics, setMetrics] = useState<LoudnessMetrics>({
    momentaryLUFS: -23,
    shortTermLUFS: -23,
    integratedLUFS: -23,
    truePeak: -6,
    loudnessRange: 10
  });

  useEffect(() => {
    if (!audioUrl) return;

    const fetchLoudness = async () => {
      try {
        const response = await fetch('/api/audio/loudness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ audioUrl, currentTime })
        });

        const data = await response.json();
        if (data.success) {
          setMetrics(data.metrics);
        }
      } catch (error) {
        console.error('Failed to fetch loudness:', error);
      }
    };

    fetchLoudness();

    if (isPlaying) {
      const interval = setInterval(fetchLoudness, 1000);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [audioUrl, isPlaying, currentTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    drawLUFSMeter(ctx, 20, 50, 120, 300, metrics.momentaryLUFS, 'Momentary');
    drawLUFSMeter(ctx, 160, 50, 120, 300, metrics.shortTermLUFS, 'Short-term');
    drawPeakMeter(ctx, 20, 370, 260, 20, metrics.truePeak);
  }, [metrics, width, height]);

  const drawLUFSMeter = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    value: number,
    label: string
  ) => {
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);

    const minLUFS = -60;
    const maxLUFS = 0;
    const normalizedValue = (value - minLUFS) / (maxLUFS - minLUFS);
    const barHeight = h * Math.min(1, Math.max(0, normalizedValue));

    let color = '#00ff00';
    if (value > -9) color = '#ff0000';
    else if (value > -16) color = '#ffff00';
    else if (value > -23) color = '#00ff00';
    else color = '#0088ff';

    ctx.fillStyle = color;
    ctx.fillRect(x, y + h - barHeight, w, barHeight);

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    const target23 = y + h * (1 - (-23 - minLUFS) / (maxLUFS - minLUFS));
    ctx.beginPath();
    ctx.moveTo(x, target23);
    ctx.lineTo(x + w, target23);
    ctx.stroke();

    const target16 = y + h * (1 - (-16 - minLUFS) / (maxLUFS - minLUFS));
    ctx.beginPath();
    ctx.moveTo(x, target16);
    ctx.lineTo(x + w, target16);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y - 10);
    ctx.fillText(`${value.toFixed(1)} LUFS`, x + w / 2, y - 25);
  };

  const drawPeakMeter = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    value: number
  ) => {
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, w, h);

    const minDB = -60;
    const maxDB = 0;
    const normalizedValue = (value - minDB) / (maxDB - minDB);
    const barWidth = w * Math.min(1, Math.max(0, normalizedValue));

    const color = value > -1 ? '#ff0000' : value > -6 ? '#ffff00' : '#00ff00';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, h);

    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`True Peak: ${value.toFixed(1)} dBTP`, x, y - 5);
  };

  const getIntegratedColor = () => {
    const lufs = metrics.integratedLUFS;
    if (lufs > -9) return 'error';
    if (lufs > -16) return 'warning';
    if (lufs > -23) return 'success';
    return 'info';
  };

  const isPeaking = metrics.truePeak > -1;

  return (
    <Paper elevation={3} sx={{ p: 2, width: width + 40 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <VolumeUp />
        <Typography variant="h6">Loudness Meter</Typography>
        {isPeaking && (
          <Chip icon={<Warning />} label="PEAKING!" color="error" size="small" />
        )}
      </Box>

      <canvas ref={canvasRef} width={width} height={height} style={{ display: 'block', margin: '0 auto' }} />

      <Box mt={2}>
        <Chip
          label={`Integrated: ${metrics.integratedLUFS.toFixed(1)} LUFS`}
          color={getIntegratedColor()}
          sx={{ mr: 1, mb: 1 }}
        />
        <Chip label={`LRA: ${metrics.loudnessRange.toFixed(1)} LU`} sx={{ mb: 1 }} />
      </Box>

      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
        EBU R128 Targets: -23 LUFS (broadcast), -16 LUFS (streaming)
      </Typography>
    </Paper>
  );
};

export default LoudnessMeter;
