/**
 * Enhanced Button Component
 * 
 * Professional button component with variants and states
 * Based on design system tokens
 */

import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';
import { colors, spacing, borderRadius, transitions, shadows } from '../../styles/designTokens';
import { interactiveStyles } from '../../styles/interactiveStates';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'icon';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends Omit<MuiButtonProps, 'variant' | 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const sizeStyles = {
  small: {
    height: 32,
    padding: `${spacing.xs}px ${spacing.sm}px`,
    fontSize: 13,
  },
  medium: {
    height: 40,
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: 14,
  },
  large: {
    height: 48,
    padding: `${spacing.md}px ${spacing.lg}px`,
    fontSize: 16,
  },
} as const;

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  children,
  sx,
  startIcon,
  endIcon,
  fullWidth,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      borderRadius: borderRadius.md,
      textTransform: 'none',
      fontWeight: 500,
      transition: transitions.normal,
      ...sizeStyles[size],
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          backgroundColor: colors.primary,
          color: colors.text.inverse,
          '&:hover': {
            backgroundColor: colors.primaryHover,
            transform: 'translateY(-2px)',
            boxShadow: shadows.md,
          },
          '&:active': {
            transform: 'translateY(0) scale(0.98)',
            boxShadow: shadows.sm,
          },
        };
      
      case 'secondary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          color: colors.text.primary,
          border: `1px solid ${colors.border.default}`,
          '&:hover': {
            borderColor: colors.border.hover,
            backgroundColor: colors.background.elevated,
            transform: 'translateY(-2px)',
            boxShadow: shadows.md,
          },
          '&:active': {
            transform: 'translateY(0) scale(0.98)',
            boxShadow: shadows.sm,
          },
        };
      
      case 'tertiary':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          color: colors.text.primary,
          '&:hover': {
            backgroundColor: colors.background.elevated,
            color: colors.primary,
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
        };
      
      case 'icon':
        return {
          ...baseStyles,
          minWidth: sizeStyles[size].height,
          width: sizeStyles[size].height,
          padding: 0,
          backgroundColor: 'transparent',
          color: colors.text.primary,
          '&:hover': {
            backgroundColor: colors.background.elevated,
            transform: 'scale(1.1)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        };
      
      default:
        return baseStyles;
    }
  };

  return (
    <MuiButton
      {...props}
      disabled={disabled || loading}
      startIcon={startIcon}
      endIcon={endIcon}
      fullWidth={fullWidth}
      sx={{
        ...getVariantStyles(),
        ...(fullWidth && { width: '100%' }),
        '&:focus-visible': {
          outline: `2px solid ${colors.border.focus}`,
          outlineOffset: '2px',
        },
        '&:disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
          pointerEvents: 'none',
        },
        ...sx,
      }}
    >
      {loading ? (
        <>
          <CircularProgress size={16} sx={{ mr: 1, color: 'inherit' }} />
          {children}
        </>
      ) : (
        children
      )}
    </MuiButton>
  );
};

