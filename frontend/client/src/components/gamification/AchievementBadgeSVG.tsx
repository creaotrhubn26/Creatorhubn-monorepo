/**
 * Achievement Badge SVG Component
 * Dynamic SVG badges with gradients, animations, and customization
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { SVG, badgeUtils, colorUtils } from '@/utils/svg-render';
import {
  Star,
  EmojiEvents,
  School,
  Verified,
  TrendingUp,
} from '@mui/icons-material';

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
    case 1: return '#cd7f32'; // Bronze
    case 2: return '#c0c0c0'; // Silver
    case 3: return '#ffd700'; // Gold
    case 4: return '#e5e4e2'; // Platinum
    case 5: return '#50c878'; // Emerald
    default: return '#4caf50';
  }
};

const getLevelName = (level: number): string => {
  switch (level) {
    case 1: return 'Bronze';
    case 2: return 'Silver';
    case 3: return 'Gold';
    case 4: return 'Platinum';
    case 5: return 'Emerald';
    default: return 'Badge';
  }
};

const getIconPath = (icon: string, size: number): React.ReactElement => {
  const center = size / 2;
  const iconSize = size * 0.3;

  switch (icon) {
    case 'star': return (
        <path
          d={badgeUtils.createStarBadge(center, center, iconSize, iconSize * 0.5 5'#fff',)}
          fill="#fff"
        />
      );
    case 'trophy': return (
        <g transform={`translate(${center - iconSize / 2}, ${center - iconSize / 2})`}>
          <EmojiEvents style={{ fontSize: iconSize, color: '#fff'}} />
        </g>
      );
    default: return <circle cx={center} cy={center} r={iconSize * 0.6} fill="#fff" />;
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
  const gradientId = `badge-gradient-${level}-${title.replace(/\s/g, '')}`;
  const glowId = `badge-glow-${level}-${title.replace(/\s/g, '')}`;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.3s ease','&:hover': onClick
          ? {
              transform: 'scale(1.1)' }
          : {},
        opacity: unlocked ? 1 : 0.5 }}
    >
      <SVG width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {/* Gradient for badge */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={badgeColor} stopOpacity={1} />
            <stop offset="100%" stopColor={badgeColor} stopOpacity={0.7} />
          </linearGradient>

          {/* Glow filter */}
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

        {/* Outer ring */}
        <circle
          cx={center}
          cy={center}
          r={radius + 5}
          fill="none"
          stroke={badgeColor}
          strokeWidth={2}
          opacity={0.3}
        />

        {/* Main badge circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={`url(#${gradientId})`}
          filter={showGlow && unlocked ? `url(#${glowId})` : undefined}
          style={{
            animation: unlocked ? 'pulse 2s ease-in-out infinite' : 'none' }} />

        {/* Inner highlight */}
        <circle
          cx={center - radius * 0.3}
          cy={center - radius * 0.3}
          r={radius * 0.3}
          fill="#fff"
          opacity={0.2}
        />

        {/* Icon */}
        {getIconPath(icon, size)}

        {/* Level indicator */}
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

      {/* Badge title */}
      <Box sx={{ textAlign: 'center', maxWidth: size * 1.2 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: badgeColor }}>
          {getLevelName(level)}
        </Typography>
        {description && (
          <Typography
            variant="caption"
            sx={{ fontSize: '0.6rem', color: 'text.secondary', display: 'block', mt: 0.5 }}>
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

export default AchievementBadgeSVG;
