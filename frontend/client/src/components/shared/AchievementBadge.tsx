/**
 * Achievement Badge Component
 * SVG-based badge component with star shapes, gradients, and animations
 * Perfect for CreatorHub badge system, awards, and achievements
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { badgeUtils } from '@/utils/svg-render';

export interface AchievementBadgeProps {
  /** Size of the badge in pixels */
  size?: number;
  /** Badge color (main fill) */
  color?: string;
  /** Secondary color for gradient */
  secondaryColor?: string;
  /** Badge icon/content in center */
  icon?: React.ReactNode;
  /** Badge label/text */
  label?: string;
  /** Tooltip text on hover */
  tooltip?: string;
  /** Whether badge is locked/disabled */
  locked?: boolean;
  /** Animation on mount */
  animated?: boolean;
  /** Glow effect intensity (0-1) */
  glow?: number;
  /** Badge variant */
  variant?: 'star' | 'circle' | 'shield';
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  size = 60,
  color = '#FFD700',
  secondaryColor = '#FFA500',
  icon,
  label,
  tooltip,
  locked = false,
  animated = true,
  glow = 0.5
  variant = 'star',
}) => {
  const gradientId = `badge-gradient-${Math.random().toString(36).substr(2, 9)}`;
  const glowId = `badge-glow-${Math.random().toString(36).substr(2, 9)}`;

  // Calculate dimensions
  const svgSize = size;
  const centerX = svgSize / 2;
  const centerY = svgSize / 2;
  const badgeSize = size * 0.8;

  // Badge path based on variant
  const getBadgePath = () => {
    switch (variant) {
      case 'star': return badgeUtils.createStarBadge(centerX, centerY, badgeSize / 2, badgeSize / 4);
      case 'circle': return `<circle cx="${centerX}" cy="${centerY}" r="${badgeSize / 2}" />`;
      case 'shield': const shieldPath = `
          M ${centerX},${centerY - badgeSize / 2}
          L ${centerX + badgeSize / 3},${centerY - badgeSize / 3}
          L ${centerX + badgeSize / 3},${centerY + badgeSize / 4}
          Q ${centerX + badgeSize / 3},${centerY + badgeSize / 2} ${centerX},${centerY + badgeSize / 2}
          Q ${centerX - badgeSize / 3},${centerY + badgeSize / 2} ${centerX - badgeSize / 3},${centerY + badgeSize / 4}
          L ${centerX - badgeSize / 3},${centerY - badgeSize / 3}
          Z
        `;
        return `<path d="${shieldPath}" />`;
      default: return badgeUtils.createStarBadge(centerX, centerY, badgeSize / 2, badgeSize / 4);
    }
  };

  const badgeContent = (
    <Box
      sx={{
        position: 'relative',
        width: svgSize,
        height: svgSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.4 : 1,
        filter: locked ? 'grayscale(100%)' : 'none',
        transition: 'all 0.3s ease','&:hover': !locked
          ? {
              transform: 'scale(1.1)',
              filter: glow > 0 ? `drop-shadow(0 0 ${glow * 10}px ${color})` : 'none',
            }
          : {},
        animation: animated && !locked ? 'badge-pop 0.6s cubic-bezier(0.68 -0.55 0.265 1.55)' : 'none','@keyframes badge-pop': {
          '0%': { transform: 'scale(0) rotate(-180deg)', opacity: 0 }'50%': { transform: 'scale(1.2) rotate(10deg)' }'100%': { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        },
      }
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        style={{ position: 'absolute' }}>
        <defs>
          {/* Gradient definition */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>

          {/* Glow filter */}
          {glow > 0 && (
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={glow * 3} result="blur" />
              <feFlood floodColor={color} floodOpacity={glow * 0.5} />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Badge shape */}
        <g
          fill={`url(#${gradientId})`}
          stroke={locked ? '#999', : color}
          strokeWidth="2"
          filter={glow > 0 && !locked ? `url(#${glowId})` : 'none'}
          dangerouslySetInnerHTML={{ __html: getBadgePath() }} />
      </svg>

      {/* Center icon/content */}
      {icon && (
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4
           , color: locked ? '#999', : '#FFF',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            zIndex: 1}}>
          {icon}
        </Box>
      )}

      {/* Label below badge */}
      {label && (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            bottom: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            color: locked ? 'text.disabled' : 'text.primary',
            fontSize: size * 0.15 }}>
          {label}
        </Typography>
      )}
    </Box>
  );

  // Wrap in tooltip if provided
  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow>
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
};

export default AchievementBadge;
