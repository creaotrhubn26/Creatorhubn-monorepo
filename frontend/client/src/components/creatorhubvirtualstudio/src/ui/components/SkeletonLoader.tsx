/**
 * Skeleton Loader Component
 * 
 * Loading placeholder with shimmer animation
 */

import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { colors, borderRadius } from '../../styles/designTokens';
import { animations } from '../../styles/animations';

export interface SkeletonLoaderProps extends BoxProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  animation?: 'pulse' | 'wave' | 'shimmer';
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'rectangular',
  width,
  height,
  animation = 'shimmer',
  sx,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
    };

    switch (variant) {
      case 'text':
        return {
          ...baseStyles,
          height: height || 16,
          width: width || '100%',
          borderRadius: borderRadius.sm,
        };
      case 'circular':
        return {
          ...baseStyles,
          width: width || 40,
          height: height || 40,
          borderRadius: '50%',
        };
      case 'rectangular':
      default:
        return {
          ...baseStyles,
          width: width || '100%',
          height: height || 200,
        };
    }
  };

  const getAnimationStyles = (): React.CSSProperties => {
    switch (animation) {
      case 'pulse':
        return {
          animation: animations.pulse.animation,
        };
      case 'wave':
        return {
          background: `linear-gradient(90deg, ${colors.background.card} 25%, ${colors.background.elevated} 50%, ${colors.background.card} 75%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        };
      case 'shimmer':
      default:
        return {
          background: `linear-gradient(90deg, ${colors.background.card} 0%, ${colors.background.elevated} 50%, ${colors.background.card} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        };
    }
  };

  return (
    <Box
      {...props}
      sx={{
        ...getVariantStyles(),
        ...getAnimationStyles(),
        ...sx,
      }}
    />
  );
};


