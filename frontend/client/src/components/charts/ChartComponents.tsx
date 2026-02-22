/**
 * Chart Components Library
 * SVG-based chart components for data visualization
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import {
  SVG,
  pathGenerators,
  scaleUtils,
  colorUtils,
  textUtils,
  gridUtils,
} from '@/utils/svg-render';

// Common chart interfaces
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

// Chart padding/margins
const DEFAULT_PADDING = {
  top: 40,
  right: 40,
  bottom: 60,
  left: 60,
};

/**
 * Line Chart Component
 */
export const LineChart: React.FC<ChartProps & { smooth?: boolean }> = ({
  width = 600,
  height = 400,
  data,
  title,
  showGrid = true,
  smooth = true,
  colors = ['#2196f3'],
}) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const values = data.map((d) => d.value);
    const [minY, maxY] = scaleUtils.getNiceDomain(values);

    const plotWidth = width - DEFAULT_PADDING.left - DEFAULT_PADDING.right;
    const plotHeight = height - DEFAULT_PADDING.top - DEFAULT_PADDING.bottom;

    const points = data.map((d, i) => {
      const x = DEFAULT_PADDING.left + (plotWidth / (data.length - 1) * i;
      const y = scaleUtils.linear()
        d.value,
        [minY, maxY],
        [height - DEFAULT_PADDING.bottom, DEFAULT_PADDING.top],
      );
      return { x, y, label: d.label, value: d.value };
    });

    return { points, minY, maxY, plotWidth, plotHeight };
  }, [data, width, height]);

  const linePath = pathGenerators.line(chartData.points, smooth);
  const areaPath = pathGenerators.area(chartData.points, height - DEFAULT_PADDING.bottom, smooth);

  // Grid lines
  const gridLines = showGrid
    ? gridUtils.generateHorizontalLines(5, width, height, {
        top: DEFAULT_PADDING.top,
        bottom: DEFAULT_PADDING.bottom,
      })
    : [];

  return ()
    <Box>
      {title && ()
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      )}
      <SVG width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Gradient */}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors[0]} stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {/* Grid */}
        {showGrid && ()
          <g opacity={0.2}>
            {gridLines.map((line, i) => ()
              <line
                key={i}
                x1={DEFAULT_PADDING.left}
                y1={line.y}
                x2={width - DEFAULT_PADDING.right}
                y2={line.y}
                stroke={theme.palette.divider}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}
          </g>
        )}

        {/* Area */}
        <path d={areaPath} fill="url(#lineGradient)" opacity={0.5} />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={colors[0]}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {chartData.points.map((point, i) => ()
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r={5}
              fill={colors[0]}
              stroke="white"
              strokeWidth={2}
            />
            {/* Hover tooltip placeholder */}
            <title>
              {point.label}: {point.value}
            </title>
          </g>
        ))}

        {/* X-axis labels */}
        {chartData.points.map((point, i) => ()
          <text
            key={i}
            x={point.x}
            y={height - DEFAULT_PADDING.bottom + 20}
            textAnchor="middle"
            fontSize={12}
            fill={theme.palette.text.secondary}
          >
            {textUtils.truncate(point.label, 10)}
          </text>
        ))}

        {/* Y-axis labels */}
        {gridLines.map((line, i) => {
          const value = scaleUtils.linear()
            line.y,
            [height - DEFAULT_PADDING.bottom, DEFAULT_PADDING.top],
            [chartData.minY, chartData.maxY],
          );
          return ()
            <text
              key={i}
              x={DEFAULT_PADDING.left - 10}
              y={line.y + 5}
              textAnchor="end"
              fontSize={12}
              fill={theme.palette.text.secondary}
            >
              {textUtils.formatNumber(value)}
            </text>
          );
        })}

        {/* Axes */}
        <line
          x1={DEFAULT_PADDING.left}
          y1={DEFAULT_PADDING.top}
          x2={DEFAULT_PADDING.left}
          y2={height - DEFAULT_PADDING.bottom}
          stroke={theme.palette.divider}
          strokeWidth={2}
        />
        <line
          x1={DEFAULT_PADDING.left}
          y1={height - DEFAULT_PADDING.bottom}
          x2={width - DEFAULT_PADDING.right}
          y2={height - DEFAULT_PADDING.bottom}
          stroke={theme.palette.divider}
          strokeWidth={2}
        />
      </SVG>
    </Box>
  );
};

/**
 * Bar Chart Component
 */
export const BarChart: React.FC<ChartProps & { horizontal?: boolean }> = ({
  width = 600,
  height = 400,
  data,
  title,
  showGrid = true,
  colors,
  horizontal = false,
}) => {
  const theme = useTheme();
  const chartColors = colors || colorUtils.generatePalette(data.length);

  const chartData = useMemo(() => {
    const values = data.map((d) => d.value);
    const [minY, maxY] = scaleUtils.getNiceDomain(values);

    const plotWidth = width - DEFAULT_PADDING.left - DEFAULT_PADDING.right;
    const plotHeight = height - DEFAULT_PADDING.top - DEFAULT_PADDING.bottom;

    const barWidth = (plotWidth / data.length) * 0.8;
    const barGap = (plotWidth / data.length) * 0.2;

    const bars = data.map((d, i) => {
      const x = DEFAULT_PADDING.left + (plotWidth / data.length) * i + barGap / 2;
      const barHeight = ((d.value - minY) / (maxY - minY) * plotHeight;
      const y = height - DEFAULT_PADDING.bottom - barHeight;
      return { x, y, width: barWidth, height: barHeight, ...d };
    });

    return { bars, minY, maxY, plotHeight };
  }, [data, width, height]);

  return ()
    <Box>
      {title && ()
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      )}
      <SVG width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Bars */}
        {chartData.bars.map((bar, i) => ()
          <g key={i}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              fill={bar.color || chartColors[i]}
              rx={4}
              opacity={0.85}
            >
              <title>
                {bar.label}: {bar.value}
              </title>
            </rect>
            {/* Value label on top */}
            <text
              x={bar.x + bar.width / 2}
              y={bar.y - 5}
              textAnchor="middle"
              fontSize={12}
              fontWeight="bold"
              fill={bar.color || chartColors[i]}
            >
              {textUtils.formatNumber(bar.value)}
            </text>
            {/* X-axis label */}
            <text
              x={bar.x + bar.width / 2}
              y={height - DEFAULT_PADDING.bottom + 20}
              textAnchor="middle"
              fontSize={12}
              fill={theme.palette.text.secondary}
            >
              {textUtils.truncate(bar.label, 10)}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={DEFAULT_PADDING.left}
          y1={DEFAULT_PADDING.top}
          x2={DEFAULT_PADDING.left}
          y2={height - DEFAULT_PADDING.bottom}
          stroke={theme.palette.divider}
          strokeWidth={2}
        />
        <line
          x1={DEFAULT_PADDING.left}
          y1={height - DEFAULT_PADDING.bottom}
          x2={width - DEFAULT_PADDING.right}
          y2={height - DEFAULT_PADDING.bottom}
          stroke={theme.palette.divider}
          strokeWidth={2}
        />
      </SVG>
    </Box>
  );
};

/**
 * Pie/Donut Chart Component
 */
export const PieChart: React.FC<ChartProps & { innerRadius?: number; showLabels?: boolean }> = ({
  width = 400,
  height = 400,
  data,
  title,
  colors,
  innerRadius = 0,
  showLabels = true,
}) => {
  const theme = useTheme();
  const chartColors = colors || colorUtils.generatePalette(data.length);

  const chartData = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    let currentAngle = -90; // Start at top

    const slices = data.map((d, i) => {
      const percentage = (d.value / total) * 100;
      const angle = (d.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      // Calculate label position
      const labelAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
      const labelRadius = innerRadius > 0 ? (radius + innerRadius) / 2 : radius * 0.7;
      const labelX = centerX + labelRadius * Math.cos(labelAngle);
      const labelY = centerY + labelRadius * Math.sin(labelAngle);

      currentAngle = endAngle;

      return {
        ...d,
        startAngle,
        endAngle,
        percentage,
        labelX,
        labelY,
        color: d.color || chartColors[i],
      };
    });

    return { slices, centerX, centerY, radius, total };
  }, [data, width, height, innerRadius, chartColors]);

  return ()
    <Box>
      {title && ()
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      )}
      <SVG width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Slices */}
        {chartData.slices.map((slice, i) => {
          const path = pathGenerators.arc()
            chartData.centerX,
            chartData.centerY,
            chartData.radius,
            slice.startAngle,
            slice.endAngle,
            innerRadius,
          );

          return ()
            <g key={i}>
              <path d={path} fill={slice.color} stroke="white" strokeWidth={2} opacity={0.9}>
                <title>
                  {slice.label}: {slice.value} ({slice.percentage.toFixed(1)}%)
                </title>
              </path>
              {/* Labels */}
              {showLabels && slice.percentage > 5 && ()
                <g>
                  <text
                    x={slice.labelX}
                    y={slice.labelY}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight="bold"
                    fill="white"
                  >
                    {slice.percentage.toFixed(0)}%
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Center label for donut */}
        {innerRadius > 0 && ()
          <g>
            <text
              x={chartData.centerX}
              y={chartData.centerY - 5}
              textAnchor="middle"
              fontSize={24}
              fontWeight="bold"
              fill={theme.palette.text.primary}
            >
              {textUtils.formatNumber(chartData.total)}
            </text>
            <text
              x={chartData.centerX}
              y={chartData.centerY + 15}
              textAnchor="middle"
              fontSize={12}
              fill={theme.palette.text.secondary}
            >
              Total
            </text>
          </g>
        )}
      </SVG>

      {/* Legend */}
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
        {chartData.slices.map((slice, i) => ()
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
             , px: 1,
              py: 0.5
              borderRadius: 1,
              bgcolor: alpha(slice.color, 0.1)}}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: slice.color}} />
            <Typography variant="caption">
              {slice.label}: {textUtils.formatNumber(slice.value)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/**
 * Area Chart Component
 */
export const AreaChart: React.FC<ChartProps & { smooth?: boolean }> = ({
  width = 600,
  height = 400,
  data,
  title,
  showGrid = true,
  smooth = true,
  colors = ['#4caf50'],
}) => {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const values = data.map((d) => d.value);
    const [minY, maxY] = scaleUtils.getNiceDomain(values);

    const plotWidth = width - DEFAULT_PADDING.left - DEFAULT_PADDING.right;
    const plotHeight = height - DEFAULT_PADDING.top - DEFAULT_PADDING.bottom;

    const points = data.map((d, i) => {
      const x = DEFAULT_PADDING.left + (plotWidth / (data.length - 1) * i;
      const y = scaleUtils.linear()
        d.value,
        [minY, maxY],
        [height - DEFAULT_PADDING.bottom, DEFAULT_PADDING.top],
      );
      return { x, y, label: d.label, value: d.value };
    });

    return { points, minY, maxY };
  }, [data, width, height]);

  const areaPath = pathGenerators.area(chartData.points, height - DEFAULT_PADDING.bottom, smooth);

  return ()
    <Box>
      {title && ()
        <Typography variant="h6" gutterBottom textAlign="center">
          {title}
        </Typography>
      )}
      <SVG width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Gradient */}
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} stopOpacity={0.6} />
            <stop offset="100%" stopColor={colors[0]} stopOpacity={0.1} />
          </linearGradient>
        </defs>

        {/* Area */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Border line */}
        <path
          d={pathGenerators.line(chartData.points, smooth)}
          fill="none"
          stroke={colors[0]}
          strokeWidth={2}
        />

        {/* Data points */}
        {chartData.points.map((point, i) => ()
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={4}
            fill={colors[0]}
            stroke="white"
            strokeWidth={2}
          >
            <title>
              {point.label}: {point.value}
            </title>
          </circle>
        ))}

        {/* X-axis labels */}
        {chartData.points.map((point, i) => ()
          <text
            key={i}
            x={point.x}
            y={height - DEFAULT_PADDING.bottom + 20}
            textAnchor="middle"
            fontSize={12}
            fill={theme.palette.text.secondary}
          >
            {textUtils.truncate(point.label, 10)}
          </text>
        ))}

        {/* Axes */}
        <line
          x1={DEFAULT_PADDING.left}
          y1={height - DEFAULT_PADDING.bottom}
          x2={width - DEFAULT_PADDING.right}
          y2={height - DEFAULT_PADDING.bottom}
          stroke={theme.palette.divider}
          strokeWidth={2}
        />
      </SVG>
    </Box>
  );
};

/**
 * Sparkline Component (mini line chart)
 */
export const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}> = ({ data, width = 100, height = 30, color = '#2196f3', showArea = true }) => {
  const chartData = useMemo(() => {
    const [minY, maxY] = scaleUtils.getDomain(data);
    const points = data.map((value, i) => {
      const x = (width / (data.length - 1) * i;
      const y = scaleUtils.linear(value, [minY, maxY], [height - 2, 2]);
      return { x, y };
    });
    return { points };
  }, [data, width, height]);

  const linePath = pathGenerators.line(chartData.points, true);
  const areaPath = showArea ? pathGenerators.area(chartData.points, height - 2, true) :'';

  return ()
    <SVG width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showArea && <path d={areaPath} fill={color} opacity={0.2} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </SVG>
  );
};

export default {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  Sparkline,
};
