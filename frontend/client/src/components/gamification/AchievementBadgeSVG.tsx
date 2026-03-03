/**
 * Achievement Badge SVG Component
 * Dynamic SVG badges with gradients, animations, and customization
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { SVG } from '@/utils/svg-render';

export interface AchievementBadgeSVGProps {
  /** Badge level (affects appearance) */
  level: 1 | 2 | 3 | 4 | 5;
  /** Badge title */
  title: string;
  /** Badge description */
  description?: string;
  /** Badge color (auto-determined by level if not provided) */
  color?: string;
  /** Icon type */
  icon?: 'star' | 'trophy' | 'school' | 'verified' | 'trending';
  /** Size of the badge */
  size?: number;
  /** Show glow effect */
  showGlow?: boolean;
  /** Unlocked state */
  unlocked?: boolean;
  /** On click handler */
  onClick?: () => void;
}

const getBadgeColor = (level: number, unlocked: boolean): string => {
  if (!unlocked) return '#9e9e9e';

  switch (level) {
    case 1:
      return '#cd7f32';
    case 2:
      return '#c0c0c0';
    case 3:
      return '#ffd700';
    case 4:
      return '#e5e4e2';
    case 5:
      return '#50c878';
    default:
      return '#4caf50';
  }
};

const getLevelName = (level: number): string => {
  switch (level) {
    case 1:
      return 'Bronze';
    case 2:
      return 'Silver';
    case 3:
      return 'Gold';
    case 4:
      return 'Platinum';
    case 5:
      return 'Emerald';
    default:
      return 'Badge';
  }
};

const createStarPath = (cx: number, cy: number, outer: number, inner: number, points = 5): string => {
  const step = Math.PI / points;
  let path = '';

  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    path += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
  }

  return `${path}Z`;
};

const getIconSvg = (icon: AchievementBadgeSVGProps['icon'], size: number): React.ReactElement => {
  const center = size / 2;
  const radius = size * 0.18;

  switch (icon) {
    case 'star':
      return <path d={createStarPath(center, center, radius, radius * 0.5)} fill="#fff" />;
    case 'trophy':
      return (
        <g fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${center - radius} ${center - radius * 0.7} h ${radius * 2} v ${radius} c 0 ${radius * 0.8} -${radius * 2} ${radius * 0.8} -${radius * 2} 0 z`} />
          <path d={`M ${center - radius * 0.45} ${center + radius * 0.25} h ${radius * 0.9}`} />
          <path d={`M ${center} ${center + radius * 0.25} v ${radius * 0.9}`} />
        </g>
      );
    case 'school':
      return (
        <g fill="#fff">
          <path d={`M ${center} ${center - radius} L ${center + radius} ${center - radius * 0.35} L ${center} ${center + radius * 0.3} L ${center - radius} ${center - radius * 0.35} Z`} />
          <rect x={center - radius * 0.6} y={center + radius * 0.2} width={radius * 1.2} height={radius * 0.55} rx={1} />
        </g>
      );
    case 'verified':
      return (
        <g fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={center} cy={center} r={radius * 0.9} />
          <path d={`M ${center - radius * 0.5} ${center} L ${center - radius * 0.1} ${center + radius * 0.4} L ${center + radius * 0.6} ${center - radius * 0.35}`} />
        </g>
      );
    case 'trending':
      return (
        <g fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${center - radius} ${center + radius * 0.55} L ${center - radius * 0.2} ${center - radius * 0.2} L ${center + radius * 0.3} ${center + radius * 0.1} L ${center + radius} ${center - radius * 0.75}`} />
          <path d={`M ${center + radius * 0.55} ${center - radius * 0.75} H ${center + radius} V ${center - radius * 0.3}`} />
        </g>
      );
    default:
      return <path d={createStarPath(center, center, radius, radius * 0.5)} fill="#fff" />;
  }
};

export const AchievementBadgeSVG: React.FC<AchievementBadgeSVGProps> = ({
  level,
  title,
  description,
  color,
  icon = 'star',
  size = 120,
  showGlow = true,
  unlocked = true,
  onClick,
}) => {
  const badgeColor = color || getBadgeColor(level, unlocked);
  const radius = size * 0.35;
  const center = size / 2;
  const safeTitle = title.replace(/\s/g, '-').toLowerCase();
  const gradientId = `badge-gradient-${level}-${safeTitle}`;
  const glowId = `badge-glow-${level}-${safeTitle}`;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.3s ease',
        '&:hover': onClick ? { transform: 'scale(1.1)' } : {},
        opacity: unlocked ? 1 : 0.5,
      }}
    >
      <SVG width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={badgeColor} stopOpacity={1} />
            <stop offset="100%" stopColor={badgeColor} stopOpacity={0.7} />
          </linearGradient>

          {showGlow && unlocked && (
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        <circle cx={center} cy={center} r={radius + 5} fill="none" stroke={badgeColor} strokeWidth={2} opacity={0.3} />

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={`url(#${gradientId})`}
          filter={showGlow && unlocked ? `url(#${glowId})` : undefined}
          style={{ animation: unlocked ? 'pulse 2s ease-in-out infinite' : 'none' }}
        />

        <circle cx={center - radius * 0.3} cy={center - radius * 0.3} r={radius * 0.3} fill="#fff" opacity={0.2} />

        {getIconSvg(icon, size)}

        <circle
          cx={center + radius * 0.7}
          cy={center - radius * 0.7}
          r={radius * 0.3}
          fill="#fff"
          stroke={badgeColor}
          strokeWidth={2}
        />
        <text
          x={center + radius * 0.7}
          y={center - radius * 0.7}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={badgeColor}
          fontSize={size * 0.15}
          fontWeight="700"
        >
          {level}
        </text>
      </SVG>

      <Box sx={{ textAlign: 'center', maxWidth: size * 1.2 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: badgeColor }}>
          {getLevelName(level)}
        </Typography>
        {description && (
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.8;
            }
          }
        `}
      </style>
    </Box>
  );
};
