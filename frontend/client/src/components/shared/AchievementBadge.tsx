import React, { useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

export interface AchievementBadgeProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
  icon?: React.ReactNode;
  label?: string;
  tooltip?: string;
  locked?: boolean;
  animated?: boolean;
  glow?: number;
  variant?: 'star' | 'circle' | 'shield';
}

function buildStarPath(cx: number, cy: number, outerRadius: number, innerRadius: number, points = 5): string {
  const angleStep = (Math.PI * 2) / points;
  let path = '';

  for (let pointIndex = 0; pointIndex < points * 2; pointIndex += 1) {
    const radius = pointIndex % 2 === 0 ? outerRadius : innerRadius;
    const angle = (pointIndex * angleStep) / 2 - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    path += `${pointIndex === 0 ? 'M' : 'L'} ${x} ${y} `;
  }

  return `${path} Z`;
}

function buildShieldPath(cx: number, cy: number, width: number, height: number): string {
  const top = cy - height / 2;
  const bottom = cy + height / 2;
  const left = cx - width / 2;
  const right = cx + width / 2;
  const shoulderY = cy - height * 0.2;
  const taperY = cy + height * 0.2;

  return [
    `M ${cx} ${top}`,
    `L ${right} ${shoulderY}`,
    `L ${right - width * 0.1} ${taperY}`,
    `Q ${cx} ${bottom} ${left + width * 0.1} ${taperY}`,
    `L ${left} ${shoulderY}`,
    'Z',
  ].join(' ');
}

const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  size = 60,
  color = '#f5c542',
  secondaryColor = '#f0932b',
  icon,
  label,
  tooltip,
  locked = false,
  animated = true,
  glow = 0.35,
  variant = 'star',
}) => {
  const gradientId = useMemo(() => `badge-gradient-${Math.random().toString(36).slice(2, 10)}`, []);
  const glowId = useMemo(() => `badge-glow-${Math.random().toString(36).slice(2, 10)}`, []);

  const iconColor = locked ? '#9ca3af' : '#ffffff';
  const badgeOpacity = locked ? 0.45 : 1;
  const badgeFilter = !locked && glow > 0 ? `url(#${glowId})` : 'none';
  const center = size / 2;
  const radius = size * 0.4;

  const shape = useMemo(() => {
    if (variant === 'circle') {
      return <circle cx={center} cy={center} r={radius} />;
    }

    if (variant === 'shield') {
      const shieldPath = buildShieldPath(center, center, size * 0.75, size * 0.82);
      return <path d={shieldPath} />;
    }

    const starPath = buildStarPath(center, center, radius, radius * 0.5, 5);
    return <path d={starPath} />;
  }, [center, radius, size, variant]);

  const content = (
    <Box
      sx={{
        width: size,
        height: size,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: locked ? 'default' : 'pointer',
        opacity: badgeOpacity,
        transition: 'transform 160ms ease, filter 160ms ease',
        filter: locked ? 'grayscale(1)' : 'none',
        animation: animated ? 'achievement-badge-pop 420ms ease' : 'none',
        '@keyframes achievement-badge-pop': {
          '0%': { transform: 'scale(0.8)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
        '&:hover': locked
          ? undefined
          : {
              transform: 'scale(1.08)',
              filter: glow > 0 ? `drop-shadow(0 0 ${Math.round(glow * 14)}px ${color})` : 'none',
            },
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={Math.max(0, glow * 3)} result="blur" />
            <feFlood floodColor={color} floodOpacity={Math.min(1, glow)} />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g fill={`url(#${gradientId})`} stroke={locked ? '#6b7280' : color} strokeWidth={2} filter={badgeFilter}>
          {shape}
        </g>
      </svg>

      {icon && (
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            fontSize: size * 0.38,
            textShadow: '0 2px 8px rgba(0,0,0,0.35)',
          }}
        >
          {icon}
        </Box>
      )}

      {label && (
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: size + 4,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            color: locked ? 'text.disabled' : 'text.primary',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow>
        <Box component="span">{content}</Box>
      </Tooltip>
    );
  }

  return content;
};

export default AchievementBadge;
