/**
 * SVG Rendering Utility
 * Secure and performant SVG rendering with sanitization and optimization
 */

import React from 'react';
import DOMPurify from 'dompurify';

export interface SVGRenderOptions {
  width?: number | string;
  height?: number | string;
  viewBox?: string;
  preserveAspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
  sanitize?: boolean;
  animate?: boolean;
}

/**
 * Sanitize SVG content to prevent XSS attacks
 */
export function sanitizeSVG(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use','defs','pattern','mask','clipPath'],
    ADD_ATTR: ['xmlns','xmlns:xlink','xlink:href'],
  });
}

/**
 * Render raw SVG content safely
 */
export function renderSVG(svgContent: string, options: SVGRenderOptions = {}): React.ReactElement {
  const { width = '100%', height = '100%', className, style, sanitize = true } = options;

  const sanitizedContent = sanitize ? sanitizeSVG(svgContent) : svgContent;

  return (
    <div
      className={className}
      style={{ width, height, ...style }}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}

/**
 * SVG Component wrapper
 */
export interface SVGComponentProps extends SVGRenderOptions {
  children: React.ReactNode;
}

export const SVG: React.FC<SVGComponentProps> = ({
  width = '100%',
  height = '100%',
  viewBox,
  preserveAspectRatio = 'xMidYMid meet',
  className,
  style,
  children,
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
};

/**
 * Generate path data for various chart types
 */
export const pathGenerators = {
  /**
   * Generate line path from data points
   */
  line: (points: Array<{ x: number; y: number }>, smooth = false): string => {
    if (points.length === 0) return '';

    if (!smooth) {
      return points
        .map((point, index) => {
          const command = index === 0 ? 'M' : 'L';
          return `${command} ${point.x} ${point.y}`;
        })
        .join('');
    }

    // Smooth curve using quadratic bezier
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      const cpY = (prev.y + curr.y) / 2;
      path += ` Q ${prev.x} ${prev.y}, ${cpX} ${cpY}`;
    }
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;
    return path;
  },

  /**
   * Generate area path (filled line chart)
   */
  area: (points: Array<{ x: number; y: number }>, baseline: number, smooth = false): string => {
    if (points.length === 0) return '';

    const linePath = pathGenerators.line(points, smooth);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return `${linePath} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`;
  },

  /**
   * Generate pie/donut arc path
   */
  arc: (
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    innerRadius = 0,
  ): string => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    if (innerRadius === 0) {
      // Pie chart
      return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    } else {
      // Donut chart
      const x3 = centerX + innerRadius * Math.cos(endRad);
      const y3 = centerY + innerRadius * Math.sin(endRad);
      const x4 = centerX + innerRadius * Math.cos(startRad);
      const y4 = centerY + innerRadius * Math.sin(startRad);

      return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    }
  },
};

/**
 * Scale utilities for mapping data to SVG coordinates
 */
export const scaleUtils = {
  /**
   * Linear scale
   */
  linear: (value: number, domain: [number, number], range: [number, number]): number => {
    const [domainMin, domainMax] = domain;
    const [rangeMin, rangeMax] = range;
    const ratio = (value - domainMin) / (domainMax - domainMin);
    return rangeMin + ratio * (rangeMax - rangeMin);
  },

  /**
   * Get domain (min, max) from data array
   */
  getDomain: (data: number[]): [number, number] => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    return [min, max];
  },

  /**
   * Get nice domain with padding
   */
  getNiceDomain: (data: number[], padding = 0.1): [number, number] => {
    const [min, max] = scaleUtils.getDomain(data);
    const range = max - min;
    const paddedMin = min - range * padding;
    const paddedMax = max + range * padding;
    return [Math.floor(paddedMin), Math.ceil(paddedMax)];
  },
};

/**
 * Color utilities
 */
export const colorUtils = {
  /**
   * Generate color palette
   */
  generatePalette: (count: number, baseHue = 200): string[] => {
    return Array.from({ length: count }, (_, i) => {
      const hue = (baseHue + (i * 360) / count) % 360;
      return `hsl(${hue}, 70%, 50%)`;
    });
  },

  /**
   * Generate gradient definition
   */
  createGradient: (
    id: string,
    colors: string[],
    direction: 'vertical' | 'horizontal' = 'vertical',
  ): React.ReactElement => {
    const isVertical = direction === 'vertical';
    return (
      <defs>
        <linearGradient
          id={id}
          x1={isVertical ? '0%' : '0%'}
          y1={isVertical ? '0%' : '0%'}
          x2={isVertical ? '0%' : '100%'}
          y2={isVertical ? '100%' : '0%'}
        >
          {colors.map((color, index) => (
            <stop
              key={index}
              offset={`${(index / (colors.length - 1)) * 100}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>
    );
  },
};

/**
 * Animation utilities
 */
export const animationUtils = {
  /**
   * Create fade-in animation
   */
  fadeIn: (duration = 0.5, delay = 0): React.CSSProperties => ({
    animation: `fadeIn ${duration}s ease-in ${delay}s forwards`,
    opacity: 0,
  }),

  /**
   * Create scale-in animation
   */
  scaleIn: (duration = 0.5, delay = 0): React.CSSProperties => ({
    animation: `scaleIn ${duration}s ease-out ${delay}s forwards`,
    transform: 'scale(0)',
  }),

  /**
   * Create draw animation for paths
   */
  drawPath: (pathLength: number, duration = 1, delay = 0): React.CSSProperties => ({
    strokeDasharray: pathLength,
    strokeDashoffset: pathLength,
    animation: `drawPath ${duration}s ease-out ${delay}s forwards`,
  }),
};

/**
 * Text utilities
 */
export const textUtils = {
  /**
   * Wrap text to fit width
   */
  wrapText: (text: string, maxWidth: number, fontSize = 12): string[] => {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = ', ';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = testLine.length * (fontSize * 0.6); // Approximate

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  },

  /**
   * Truncate text with ellipsis
   */
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength - 3)}...`;
  },

  /**
   * Format number with abbreviations
   */
  formatNumber: (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  },
};

/**
 * Grid utilities
 */
export const gridUtils = {
  /**
   * Generate horizontal grid lines
   */
  generateHorizontalLines: (
    count: number,
    width: number,
    height: number,
    padding: { top: number; bottom: number },
  ): Array<{ y: number }> => {
    const effectiveHeight = height - padding.top - padding.bottom;
    return Array.from({ length: count }, (_, i) => ({
      y: padding.top + (effectiveHeight / (count - 1)) * i,
    }));
  },

  /**
   * Generate vertical grid lines
   */
  generateVerticalLines: (
    count: number,
    width: number,
    padding: { left: number; right: number },
  ): Array<{ x: number }> => {
    const effectiveWidth = width - padding.left - padding.right;
    return Array.from({ length: count }, (_, i) => ({
      x: padding.left + (effectiveWidth / (count - 1)) * i,
    }));
  },
};

/**
 * Progress visualization utilities
 */
export const progressUtils = {
  /**
   * Create a progress ring
   */
  progressRing: (
    percentage: number,
    radius: number,
    strokeWidth: number,
    color: string,
    backgroundColor = '#e0e0e0',
  ): React.ReactElement => {
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const size = radius * 2 + strokeWidth;
    const center = size / 2;

    return (
      <SVG width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </SVG>
    );
  },

  /**
   * Create a multi-segment progress ring
   */
  multiProgressRing: (
    segments: Array<{ value: number; color: string }>,
    radius: number,
    strokeWidth: number,
    backgroundColor = '#e0e0e0',
  ): React.ReactElement => {
    const circumference = 2 * Math.PI * radius;
    const size = radius * 2 + strokeWidth;
    const center = size / 2;
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);

    let currentOffset = 0;

    return (
      <SVG width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Segment circles */}
        {segments.map((segment, index) => {
          const percentage = (segment.value / total) * 100;
          const segmentLength = (percentage / 100) * circumference;
          const offset = circumference - currentOffset - segmentLength;
          currentOffset += segmentLength;

          return (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-currentOffset + segmentLength}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              style={{
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
          );
        })}
      </SVG>
    );
  },
};

/**
 * Flowchart and diagram utilities
 */
export const flowchartUtils = {
  /**
   * Create a flowchart node
   */
  createNode: (
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: string,
    textColor = '#fff',
  ): React.ReactElement => {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          stroke="#333"
          strokeWidth={2}
          rx={8}
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        />
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={14}
          fontWeight="600"
        >
          {label}
        </text>
      </g>
    );
  },

  /**
   * Create a connection line with arrow
   */
  createConnection: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = '#666',
    dashed = false,
  ): React.ReactElement => {
    const arrowId = `arrow-${x1}-${y1}-${x2}-${y2}`;
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    const arrowLength = 10;

    return (
      <g>
        <defs>
          <marker
            id={arrowId}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={color} />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={dashed ? '5,5' : 'none'}
          markerEnd={`url(#${arrowId})`}
        />
      </g>
    );
  },

  /**
   * Create a curved connection
   */
  createCurvedConnection: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = '#666',
  ): React.ReactElement => {
    const controlPointOffset = Math.abs(x2 - x1) / 2;
    const path = `M ${x1} ${y1} C ${x1 + controlPointOffset} ${y1}, ${x2 - controlPointOffset} ${y2}, ${x2} ${y2}`;
    const arrowId = `curved-arrow-${x1}-${y1}`;

    return (
      <g>
        <defs>
          <marker
            id={arrowId}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={color} />
          </marker>
        </defs>
        <path d={path} stroke={color} strokeWidth={2} fill="none" markerEnd={`url(#${arrowId})`} />
      </g>
    );
  },
};

/**
 * Badge utilities
 */
export const badgeUtils = {
  /**
   * Create a star badge
   */
  createStarBadge: (
    centerX: number,
    centerY: number,
    outerRadius: number,
    innerRadius: number,
    points: number,
    color: string,
  ): string => {
    const angleStep = (Math.PI * 2) / points;
    let path = '';

    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * angleStep) / 2 - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      path += `${i === 0 ? 'M': 'L'} ${x} ${y} `;
    }
    path +='Z';

    return path;
  },
};

/**
 * Export all utilities
 */
export default {
  renderSVG,
  sanitizeSVG,
  SVG,
  pathGenerators,
  scaleUtils,
  colorUtils,
  animationUtils,
  textUtils,
  gridUtils,
  progressUtils,
  flowchartUtils,
  badgeUtils,
};
