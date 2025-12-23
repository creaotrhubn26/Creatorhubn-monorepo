/**
 * Typography System
 * 
 * Professional typography scale and utilities
 * Based on Set A Light 3D and Material Design 3 principles
 */

import { typography, spacing } from './designTokens';

/**
 * Typography scale with consistent sizing
 */
export const typeScale = {
  h1: {
    fontSize: `${typography.fontSize.h1}px`,
    lineHeight: typography.lineHeight.tight,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: '-0.02em',
    marginBottom: spacing.md,
  },
  h2: {
    fontSize: `${typography.fontSize.h2}px`,
    lineHeight: typography.lineHeight.normal,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: '-0.01em',
    marginBottom: spacing.md,
  },
  h3: {
    fontSize: `${typography.fontSize.h3}px`,
    lineHeight: typography.lineHeight.normal,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  h4: {
    fontSize: `${typography.fontSize.h4}px`,
    lineHeight: typography.lineHeight.normal,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
  },
  h5: {
    fontSize: `${typography.fontSize.h5}px`,
    lineHeight: typography.lineHeight.relaxed,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  h6: {
    fontSize: `${typography.fontSize.h6}px`,
    lineHeight: typography.lineHeight.relaxed,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  body1: {
    fontSize: `${typography.fontSize.body1}px`,
    lineHeight: typography.lineHeight.loose,
    fontWeight: typography.fontWeight.regular,
  },
  body2: {
    fontSize: `${typography.fontSize.body2}px`,
    lineHeight: typography.lineHeight.loose,
    fontWeight: typography.fontWeight.regular,
  },
  caption: {
    fontSize: `${typography.fontSize.caption}px`,
    lineHeight: typography.lineHeight.relaxed,
    fontWeight: typography.fontWeight.regular,
    letterSpacing: '0.01em',
  },
  overline: {
    fontSize: `${typography.fontSize.overline}px`,
    lineHeight: typography.lineHeight.relaxed,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
} as const;

/**
 * Font family utilities
 */
export const fontFamily = {
  primary: typography.fontFamily.primary,
  monospace: typography.fontFamily.monospace,
} as const;

/**
 * Font weight utilities
 */
export const fontWeight = {
  regular: typography.fontWeight.regular,
  medium: typography.fontWeight.medium,
  semibold: typography.fontWeight.semibold,
  bold: typography.fontWeight.bold,
} as const;

/**
 * Line height utilities
 */
export const lineHeight = {
  tight: typography.lineHeight.tight,
  normal: typography.lineHeight.normal,
  relaxed: typography.lineHeight.relaxed,
  loose: typography.lineHeight.loose,
} as const;

/**
 * Get typography style for a variant
 */
export function getTypographyStyle(variant: keyof typeof typeScale) {
  return typeScale[variant];
}

/**
 * Typography utility for MUI Typography component
 */
export const typographyStyles = {
  h1: {
    fontFamily: fontFamily.primary,
    ...typeScale.h1,
  },
  h2: {
    fontFamily: fontFamily.primary,
    ...typeScale.h2,
  },
  h3: {
    fontFamily: fontFamily.primary,
    ...typeScale.h3,
  },
  h4: {
    fontFamily: fontFamily.primary,
    ...typeScale.h4,
  },
  h5: {
    fontFamily: fontFamily.primary,
    ...typeScale.h5,
  },
  h6: {
    fontFamily: fontFamily.primary,
    ...typeScale.h6,
  },
  body1: {
    fontFamily: fontFamily.primary,
    ...typeScale.body1,
  },
  body2: {
    fontFamily: fontFamily.primary,
    ...typeScale.body2,
  },
  caption: {
    fontFamily: fontFamily.primary,
    ...typeScale.caption,
  },
  overline: {
    fontFamily: fontFamily.primary,
    ...typeScale.overline,
  },
} as const;


