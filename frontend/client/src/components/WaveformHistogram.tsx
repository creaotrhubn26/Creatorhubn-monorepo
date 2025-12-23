/**
 * Waveform Monitor and Histogram Display Components
 *
 * Professional-grade visualization tools for exposure monitoring
 */

import React, { useRef, useEffect } from 'react';

// ==================== WAVEFORM MONITOR ====================

export interface WaveformData {
  data: number[][]; // [x_position][luminance_distribution],
  peakWhite: number;
  blackLevel: number;
  averageLevel: number;
}

interface WaveformMonitorProps {
  data: WaveformData;
  width?: number;
  height?: number;
  backgroundColor?: string;
  lineColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  showLabels?: boolean;
}

export const WaveformMonitor: React.FC<WaveformMonitorProps> = ({
  data,
  width = 512,
  height = 256,
  backgroundColor = '#1a1a1a',
  lineColor = '#00ff00',
  gridColor = '#333333',
  showGrid = true,
  showLabels = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      // Horizontal lines (0%, 25%, 50%, 75%, 100%)
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let i = 0; i <= 8; i++) {
        const x = (width / 8) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw waveform
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    const xScale = width / data.data.length;

    for (let x = 0; x < data.data.length; x++) {
      const column = data.data[x];
      if (!column || column.length === 0) continue;

      const xPos = x * xScale;

      // Draw vertical line representing luminance distribution at this x position
      for (let i = 0; i < column.length; i++) {
        const lumaValue = column[i]; // 0-255
        const yPos = height - (lumaValue / 255) * height;

        ctx.fillStyle = lineColor;
        ctx.fillRect(xPos, yPos, Math.max(1, xScale), 2);
      }
    }

    ctx.globalAlpha = 1.0;

    // Draw reference lines for peak white and black level
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Peak white line
    const peakY = height - (data.peakWhite / 255) * height;
    ctx.beginPath();
    ctx.moveTo(0, peakY);
    ctx.lineTo(width, peakY);
    ctx.stroke();

    // Black level line
    const blackY = height - (data.blackLevel / 255) * height;
    ctx.beginPath();
    ctx.moveTo(0, blackY);
    ctx.lineTo(width, blackY);
    ctx.stroke();

    ctx.setLineDash([]);

    // Draw labels
    if (showLabels) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';

      ctx.fillText('100%', 5, 15);
      ctx.fillText('75%', 5, height * 0.25 + 5);
      ctx.fillText('50%', 5, height * 0.5 + 5);
      ctx.fillText('25%', 5, height * 0.75 + 5);
      ctx.fillText('0%', 5, height - 5);

      // Peak/Black labels
      ctx.fillStyle = '#ff0000';
      ctx.fillText(`Peak: ${data.peakWhite}`, width - 80, peakY - 5);
      ctx.fillText(`Black: ${data.blackLevel}`, width - 80, blackY + 15);
    }
  }, [data, width, height, backgroundColor, lineColor, gridColor, showGrid, showLabels]);

  return (
    <div className="waveform-monitor" style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid #444',
          borderRadius: '4px',
          display: 'block'}} />
      <div
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#fff',
          fontFamily: 'monospace'}}>
        WAVEFORM
      </div>
    </div>
  );
};

// ==================== HISTOGRAM ====================

export interface HistogramData {
  histogram: number[]; // 256 bins,
  clippedHighlights: number;
  blockedShadows: number;
  averageLevel: number;
}

interface HistogramDisplayProps {
  data: HistogramData;
  width?: number;
  height?: number;
  backgroundColor?: string;
  barColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  showStats?: boolean;
}

export const HistogramDisplay: React.FC<HistogramDisplayProps> = ({
  data,
  width = 512,
  height = 200,
  backgroundColor = '#1a1a1a',
  barColor = '#00ff00',
  gridColor = '#333333',
  showGrid = true,
  showStats = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.histogram.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      // Horizontal lines
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical lines for shadows (0-16%), midtones (16-92%), highlights (92-100%)
      const shadowEnd = (16 / 100) * width;
      const highlightStart = (92 / 100) * width;

      ctx.strokeStyle = '#555555';
      ctx.beginPath();
      ctx.moveTo(shadowEnd, 0);
      ctx.lineTo(shadowEnd, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(highlightStart, 0);
      ctx.lineTo(highlightStart, height);
      ctx.stroke();
    }

    // Find max value for scaling
    const maxValue = Math.max(...data.histogram);

    // Draw histogram bars
    const barWidth = width / data.histogram.length;

    for (let i = 0; i < data.histogram.length; i++) {
      const value = data.histogram[i];
      const barHeight = (value / maxValue) * height;
      const x = i * barWidth;
      const y = height - barHeight;

      // Color based on zone
      let color = barColor;
      if (i < 16) {
        // Shadows - purple tint
        color = '#8800ff';
      } else if (i < 235) {
        // Midtones - green
        color = barColor;
      } else {
        // Highlights - red
        color = '#ff0000';
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, Math.max(1, barWidth), barHeight);
    }

    ctx.globalAlpha = 1.0;

    // Draw average level marker
    const avgX = (data.averageLevel / 255) * width;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(avgX, 0);
    ctx.lineTo(avgX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw labels
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.fillText('Shadows', 5, height - 5);
    ctx.fillText('Midtones', width / 2 - 30, height - 5);
    ctx.fillText('Highlights', width - 70, height - 5);
  }, [data, width, height, backgroundColor, barColor, gridColor, showGrid]);

  return (
    <div className="histogram-display" style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid #444',
          borderRadius: '4px',
          display: 'block'}} />
      <div
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#fff',
          fontFamily: 'monospace'}}>
        HISTOGRAM
      </div>
      {showStats && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#222',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#fff'}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: data.clippedHighlights > 0 ? '#ff0000' : '#00ff00' }}>
              ☀️ Clipped: {data.clippedHighlights.toFixed(1)}%
            </span>
            <span style={{ color: data.blockedShadows > 0 ? '#ff0000' : '#00ff00' }}>
              🌑 Blocked: {data.blockedShadows.toFixed(1)}%
            </span>
            <span style={{ color: '#ffff00' }}>📊 Avg: {data.averageLevel}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== COMBINED COMPONENT ====================

interface WaveformHistogramPanelProps {
  waveformData: WaveformData;
  histogramData: HistogramData;
  layout?: 'horizontal' | 'vertical';
}

export const WaveformHistogramPanel: React.FC<WaveformHistogramPanelProps> = ({
  waveformData,
  histogramData,
  layout = 'horizontal',
}) => {
  return (
    <div
      className="waveform-histogram-panel"
      style={{
        display: 'flex',
        flexDirection: layout === 'horizontal' ? 'row' : 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: '#0a0a0a',
        borderRadius: '8px',
        border: '1px solid #333'}}>
      <WaveformMonitor data={waveformData} />
      <HistogramDisplay data={histogramData} />
    </div>
  );
};

// ==================== MINI VERSIONS FOR COMPACT UI ====================

export const MiniWaveform: React.FC<{ data: WaveformData }> = ({ data }) => (
  <WaveformMonitor data={data} width={256} height={128} showGrid={false} showLabels={false} />
);

export const MiniHistogram: React.FC<{ data: HistogramData }> = ({ data }) => (
  <HistogramDisplay data={data} width={256} height={128} showGrid={false} showStats={false} />
);
