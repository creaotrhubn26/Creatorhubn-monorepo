/**
 * Chart Components Library
 * SVG-based chart components for data visualization
 */

import React, { useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartProps {
  width?: number;
  height?: number;
  data: ChartDataPoint[];
  title?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  colors?: string[];
}

const DEFAULT_PADDING = {
  top: 40,
  right: 40,
  bottom: 60,
  left: 60,
};

const BASE_COLORS = ['#2196f3', '#26a69a', '#ff9800', '#ab47bc', '#ef5350', '#42a5f5'];

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number): string {
  if (points.length === 0) return '';
  const linePath = buildLinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

function getDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const delta = min === 0 ? 1 : Math.abs(min) * 0.1;
    return [min - delta, max + delta];
  }
  return [min, max];
}

function getColor(index: number, colors?: string[], fallback?: string): string {
  if (fallback) return fallback;
  if (colors && colors.length > 0) {
    return colors[index % colors.length];
  }
  return BASE_COLORS[index % BASE_COLORS.length];
}

function chartY(
  value: number,
  minY: number,
  maxY: number,
  chartTop: number,
  chartBottom: number,
): number {
  const normalized = (value - minY) / (maxY - minY);
  return chartBottom - normalized * (chartBottom - chartTop);
}

function emptyState(
  width: number,
  height: number,
  message: string,
  color: string,
): React.ReactElement {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={13}
        fill={color}
      >
        {message}
      </text>
    </svg>
  );
}

export const LineChart: React.FC<ChartProps & { smooth?: boolean }> = ({
  width = 600,
  height = 400,
  data,
  title,
  showGrid = true,
  colors = ['#2196f3'],
}) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const values = data.map((d) => d.value);
    const [minY, maxY] = getDomain(values);
    const chartLeft = DEFAULT_PADDING.left;
    const chartRight = width - DEFAULT_PADDING.right;
    const chartTop = DEFAULT_PADDING.top;
    const chartBottom = height - DEFAULT_PADDING.bottom;
    const usableWidth = Math.max(1, chartRight - chartLeft);

    const points = data.map((d, index) => {
      const step = data.length > 1 ? usableWidth / (data.length - 1) : 0;
      return {
        x: chartLeft + index * step,
        y: chartY(d.value, minY, maxY, chartTop, chartBottom),
        label: d.label,
        value: d.value,
      };
    });

    return { points, minY, maxY, chartLeft, chartRight, chartTop, chartBottom };
  }, [data, width, height]);

  const linePath = buildLinePath(chartData.points);
  const areaPath = buildAreaPath(chartData.points, chartData.chartBottom);

  return (
    <Box>
      {title ? (
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      ) : null}
      {data.length === 0 ? (
        emptyState(width, height, 'No data available', theme.palette.text.secondary)
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="line-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[0]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors[0]} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {showGrid
            ? Array.from({ length: 5 }).map((_, i) => {
                const ratio = i / 4;
                const y = chartData.chartTop + ratio * (chartData.chartBottom - chartData.chartTop);
                const value = chartData.maxY - ratio * (chartData.maxY - chartData.minY);
                return (
                  <g key={`line-grid-${i}`}>
                    <line
                      x1={chartData.chartLeft}
                      y1={y}
                      x2={chartData.chartRight}
                      y2={y}
                      stroke={alpha(theme.palette.text.secondary, 0.25)}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={chartData.chartLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={11}
                      fill={theme.palette.text.secondary}
                    >
                      {formatCompact(value)}
                    </text>
                  </g>
                );
              })
            : null}

          <path d={areaPath} fill="url(#line-chart-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke={colors[0]}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartData.points.map((point) => (
            <g key={`line-point-${point.label}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r={4.5} fill={colors[0]} stroke="white" strokeWidth={2} />
              <title>{`${point.label}: ${point.value}`}</title>
            </g>
          ))}

          {chartData.points.map((point) => (
            <text
              key={`line-label-${point.label}-${point.x}`}
              x={point.x}
              y={height - DEFAULT_PADDING.bottom + 20}
              textAnchor="middle"
              fontSize={11}
              fill={theme.palette.text.secondary}
            >
              {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
            </text>
          ))}

          <line
            x1={chartData.chartLeft}
            y1={chartData.chartTop}
            x2={chartData.chartLeft}
            y2={chartData.chartBottom}
            stroke={theme.palette.divider}
            strokeWidth={2}
          />
          <line
            x1={chartData.chartLeft}
            y1={chartData.chartBottom}
            x2={chartData.chartRight}
            y2={chartData.chartBottom}
            stroke={theme.palette.divider}
            strokeWidth={2}
          />
        </svg>
      )}
    </Box>
  );
};

export const BarChart: React.FC<ChartProps & { horizontal?: boolean }> = ({
  width = 600,
  height = 400,
  data,
  title,
  showGrid = true,
  showLegend = false,
  colors,
  horizontal = false,
}) => {
  const theme = useTheme();

  const values = data.map((d) => d.value);
  const [minY, maxY] = getDomain(values);
  const chartLeft = DEFAULT_PADDING.left;
  const chartRight = width - DEFAULT_PADDING.right;
  const chartTop = DEFAULT_PADDING.top;
  const chartBottom = height - DEFAULT_PADDING.bottom;

  const bars = useMemo(() => {
    if (data.length === 0) return [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
      value: number;
      color: string;
    }>;

    if (horizontal) {
      const rowHeight = (chartBottom - chartTop) / data.length;
      return data.map((item, index) => {
        const x = chartLeft;
        const y = chartTop + index * rowHeight + rowHeight * 0.1;
        const barWidth = ((item.value - minY) / (maxY - minY)) * (chartRight - chartLeft);
        const barHeight = rowHeight * 0.8;
        return {
          x,
          y,
          width: Math.max(0, barWidth),
          height: barHeight,
          label: item.label,
          value: item.value,
          color: getColor(index, colors, item.color),
        };
      });
    }

    const columnWidth = (chartRight - chartLeft) / data.length;
    return data.map((item, index) => {
      const x = chartLeft + index * columnWidth + columnWidth * 0.15;
      const barWidth = columnWidth * 0.7;
      const barHeight = ((item.value - minY) / (maxY - minY)) * (chartBottom - chartTop);
      const y = chartBottom - barHeight;
      return {
        x,
        y,
        width: barWidth,
        height: Math.max(0, barHeight),
        label: item.label,
        value: item.value,
        color: getColor(index, colors, item.color),
      };
    });
  }, [chartBottom, chartLeft, chartRight, chartTop, colors, data, horizontal, maxY, minY]);

  return (
    <Box>
      {title ? (
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      ) : null}

      {data.length === 0 ? (
        emptyState(width, height, 'No data available', theme.palette.text.secondary)
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {showGrid
            ? Array.from({ length: 5 }).map((_, i) => {
                const ratio = i / 4;
                const y = chartTop + ratio * (chartBottom - chartTop);
                return (
                  <line
                    key={`bar-grid-${i}`}
                    x1={chartLeft}
                    y1={y}
                    x2={chartRight}
                    y2={y}
                    stroke={alpha(theme.palette.text.secondary, 0.2)}
                    strokeDasharray="4 4"
                  />
                );
              })
            : null}

          {bars.map((bar) => (
            <g key={`bar-${bar.label}-${bar.x}`}>
              <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.color} rx={4} />
              <title>{`${bar.label}: ${bar.value}`}</title>
              {!horizontal ? (
                <>
                  <text
                    x={bar.x + bar.width / 2}
                    y={bar.y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill={bar.color}
                  >
                    {formatCompact(bar.value)}
                  </text>
                  <text
                    x={bar.x + bar.width / 2}
                    y={chartBottom + 20}
                    textAnchor="middle"
                    fontSize={11}
                    fill={theme.palette.text.secondary}
                  >
                    {bar.label.length > 10 ? `${bar.label.slice(0, 9)}…` : bar.label}
                  </text>
                </>
              ) : (
                <>
                  <text
                    x={bar.x - 8}
                    y={bar.y + bar.height / 2 + 4}
                    textAnchor="end"
                    fontSize={11}
                    fill={theme.palette.text.secondary}
                  >
                    {bar.label.length > 14 ? `${bar.label.slice(0, 13)}…` : bar.label}
                  </text>
                  <text
                    x={bar.x + bar.width + 6}
                    y={bar.y + bar.height / 2 + 4}
                    textAnchor="start"
                    fontSize={11}
                    fill={bar.color}
                  >
                    {formatCompact(bar.value)}
                  </text>
                </>
              )}
            </g>
          ))}

          <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke={theme.palette.divider} strokeWidth={2} />
          <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke={theme.palette.divider} strokeWidth={2} />
        </svg>
      )}

      {showLegend ? (
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {bars.map((bar) => (
            <Box
              key={`legend-${bar.label}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                backgroundColor: alpha(bar.color, 0.1),
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: bar.color }} />
              <Typography variant="caption">{bar.label}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export const PieChart: React.FC<ChartProps & { innerRadius?: number; showLabels?: boolean }> = ({
  width = 400,
  height = 400,
  data,
  title,
  colors,
  showLegend = true,
  innerRadius = 0,
  showLabels = true,
}) => {
  const theme = useTheme();

  const prepared = useMemo(() => {
    const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
    const radius = Math.min(width, height) / 2 - 40;
    const cx = width / 2;
    const cy = height / 2;

    let currentAngle = -Math.PI / 2;
    const slices = data.map((item, index) => {
      const value = Math.max(0, item.value);
      const ratio = total > 0 ? value / total : 0;
      const angle = ratio * Math.PI * 2;
      const start = currentAngle;
      const end = currentAngle + angle;
      currentAngle = end;

      const x1 = cx + radius * Math.cos(start);
      const y1 = cy + radius * Math.sin(start);
      const x2 = cx + radius * Math.cos(end);
      const y2 = cy + radius * Math.sin(end);
      const largeArc = angle > Math.PI ? 1 : 0;

      let path: string;
      if (innerRadius > 0) {
        const ix1 = cx + innerRadius * Math.cos(start);
        const iy1 = cy + innerRadius * Math.sin(start);
        const ix2 = cx + innerRadius * Math.cos(end);
        const iy2 = cy + innerRadius * Math.sin(end);
        path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
      } else {
        path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      }

      const labelAngle = (start + end) / 2;
      const labelRadius = innerRadius > 0 ? (radius + innerRadius) / 2 : radius * 0.7;

      return {
        label: item.label,
        value,
        ratio,
        color: getColor(index, colors, item.color),
        path,
        labelX: cx + labelRadius * Math.cos(labelAngle),
        labelY: cy + labelRadius * Math.sin(labelAngle),
      };
    });

    return { slices, total, cx, cy };
  }, [colors, data, height, innerRadius, width]);

  return (
    <Box>
      {title ? (
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      ) : null}

      {prepared.total <= 0 ? (
        emptyState(width, height, 'No data available', theme.palette.text.secondary)
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {prepared.slices.map((slice) => (
            <g key={`pie-${slice.label}`}>
              <path d={slice.path} fill={slice.color} stroke="white" strokeWidth={2} opacity={0.95}>
                <title>{`${slice.label}: ${slice.value} (${(slice.ratio * 100).toFixed(1)}%)`}</title>
              </path>
              {showLabels && slice.ratio > 0.05 ? (
                <text
                  x={slice.labelX}
                  y={slice.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="white"
                >
                  {`${Math.round(slice.ratio * 100)}%`}
                </text>
              ) : null}
            </g>
          ))}

          {innerRadius > 0 ? (
            <>
              <text
                x={prepared.cx}
                y={prepared.cy - 5}
                textAnchor="middle"
                fontSize={22}
                fontWeight={700}
                fill={theme.palette.text.primary}
              >
                {formatCompact(prepared.total)}
              </text>
              <text
                x={prepared.cx}
                y={prepared.cy + 14}
                textAnchor="middle"
                fontSize={11}
                fill={theme.palette.text.secondary}
              >
                Total
              </text>
            </>
          ) : null}
        </svg>
      )}

      {showLegend ? (
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
          {prepared.slices.map((slice) => (
            <Box
              key={`pie-legend-${slice.label}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                backgroundColor: alpha(slice.color, 0.1),
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: slice.color }} />
              <Typography variant="caption">{`${slice.label}: ${formatCompact(slice.value)}`}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

export const AreaChart: React.FC<ChartProps & { smooth?: boolean }> = ({
  width = 600,
  height = 400,
  data,
  title,
  showGrid = true,
  colors = ['#4caf50'],
}) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const values = data.map((d) => d.value);
    const [minY, maxY] = getDomain(values);
    const chartLeft = DEFAULT_PADDING.left;
    const chartRight = width - DEFAULT_PADDING.right;
    const chartTop = DEFAULT_PADDING.top;
    const chartBottom = height - DEFAULT_PADDING.bottom;
    const usableWidth = Math.max(1, chartRight - chartLeft);

    const points = data.map((d, index) => {
      const step = data.length > 1 ? usableWidth / (data.length - 1) : 0;
      return {
        x: chartLeft + index * step,
        y: chartY(d.value, minY, maxY, chartTop, chartBottom),
        label: d.label,
        value: d.value,
      };
    });

    return { points, minY, maxY, chartLeft, chartRight, chartTop, chartBottom };
  }, [data, width, height]);

  const linePath = buildLinePath(chartData.points);
  const areaPath = buildAreaPath(chartData.points, chartData.chartBottom);

  return (
    <Box>
      {title ? (
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      ) : null}

      {data.length === 0 ? (
        emptyState(width, height, 'No data available', theme.palette.text.secondary)
      ) : (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="area-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[0]} stopOpacity={0.6} />
              <stop offset="100%" stopColor={colors[0]} stopOpacity={0.1} />
            </linearGradient>
          </defs>

          {showGrid
            ? Array.from({ length: 5 }).map((_, i) => {
                const ratio = i / 4;
                const y = chartData.chartTop + ratio * (chartData.chartBottom - chartData.chartTop);
                return (
                  <line
                    key={`area-grid-${i}`}
                    x1={chartData.chartLeft}
                    y1={y}
                    x2={chartData.chartRight}
                    y2={y}
                    stroke={alpha(theme.palette.text.secondary, 0.2)}
                    strokeDasharray="4 4"
                  />
                );
              })
            : null}

          <path d={areaPath} fill="url(#area-chart-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke={colors[0]}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chartData.points.map((point) => (
            <circle
              key={`area-point-${point.label}-${point.x}`}
              cx={point.x}
              cy={point.y}
              r={4}
              fill={colors[0]}
              stroke="white"
              strokeWidth={2}
            >
              <title>{`${point.label}: ${point.value}`}</title>
            </circle>
          ))}

          {chartData.points.map((point) => (
            <text
              key={`area-label-${point.label}-${point.x}`}
              x={point.x}
              y={height - DEFAULT_PADDING.bottom + 20}
              textAnchor="middle"
              fontSize={11}
              fill={theme.palette.text.secondary}
            >
              {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
            </text>
          ))}

          <line
            x1={chartData.chartLeft}
            y1={chartData.chartTop}
            x2={chartData.chartLeft}
            y2={chartData.chartBottom}
            stroke={theme.palette.divider}
            strokeWidth={2}
          />
          <line
            x1={chartData.chartLeft}
            y1={chartData.chartBottom}
            x2={chartData.chartRight}
            y2={chartData.chartBottom}
            stroke={theme.palette.divider}
            strokeWidth={2}
          />
        </svg>
      )}
    </Box>
  );
};

export const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}> = ({ data, width = 100, height = 30, color = '#2196f3', showArea = true }) => {
  const chart = useMemo(() => {
    if (data.length === 0) {
      return { points: [] as Array<{ x: number; y: number }> };
    }
    const [minY, maxY] = getDomain(data);
    const points = data.map((value, index) => {
      const step = data.length > 1 ? width / (data.length - 1) : 0;
      const x = index * step;
      const y = chartY(value, minY, maxY, 2, height - 2);
      return { x, y };
    });
    return { points };
  }, [data, height, width]);

  const linePath = buildLinePath(chart.points);
  const areaPath = buildAreaPath(chart.points, height - 2);

  if (data.length === 0) {
    return emptyState(width, height, 'No data', '#999');
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showArea ? <path d={areaPath} fill={color} opacity={0.2} /> : null}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
};

export default {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  Sparkline,
};
