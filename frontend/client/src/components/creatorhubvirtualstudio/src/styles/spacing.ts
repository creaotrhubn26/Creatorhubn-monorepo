/**
 * Spacing System
 * 
 * 8px baseline grid system for consistent spacing
 * All spacing values are multiples of 8px (or 4px for fine adjustments)
 */

import { spacing } from './designTokens';

/**
 * Spacing scale (8px baseline)
 */
export const spacingScale = {
  xs: spacing.xs,    // 4px
  sm: spacing.sm,    // 8px
  md: spacing.md,    // 16px
  lg: spacing.lg,    // 24px
  xl: spacing.xl,    // 32px
  xxl: spacing.xxl,  // 48px
  xxxl: spacing.xxxl, // 64px
} as const;

/**
 * Get spacing value as pixel string
 */
export function getSpacing(size: keyof typeof spacingScale): string {
  return `${spacingScale[size]}px`;
}

/**
 * Get spacing value as number
 */
export function getSpacingNumber(size: keyof typeof spacingScale): number {
  return spacingScale[size];
}

/**
 * Spacing utilities for common patterns
 */
export const spacingUtils = {
  // Padding
  padding: {
    xs: { padding: getSpacing('xs') },
    sm: { padding: getSpacing('sm') },
    md: { padding: getSpacing('md') },
    lg: { padding: getSpacing('lg') },
    xl: { padding: getSpacing('xl') },
  },
  paddingX: {
    xs: { paddingLeft: getSpacing('xs'), paddingRight: getSpacing('xs') },
    sm: { paddingLeft: getSpacing('sm'), paddingRight: getSpacing('sm') },
    md: { paddingLeft: getSpacing('md'), paddingRight: getSpacing('md') },
    lg: { paddingLeft: getSpacing('lg'), paddingRight: getSpacing('lg') },
    xl: { paddingLeft: getSpacing('xl'), paddingRight: getSpacing('xl') },
  },
  paddingY: {
    xs: { paddingTop: getSpacing('xs'), paddingBottom: getSpacing('xs') },
    sm: { paddingTop: getSpacing('sm'), paddingBottom: getSpacing('sm') },
    md: { paddingTop: getSpacing('md'), paddingBottom: getSpacing('md') },
    lg: { paddingTop: getSpacing('lg'), paddingBottom: getSpacing('lg') },
    xl: { paddingTop: getSpacing('xl'), paddingBottom: getSpacing('xl') },
  },
  
  // Margin
  margin: {
    xs: { margin: getSpacing('xs') },
    sm: { margin: getSpacing('sm') },
    md: { margin: getSpacing('md') },
    lg: { margin: getSpacing('lg') },
    xl: { margin: getSpacing('xl') },
  },
  marginX: {
    xs: { marginLeft: getSpacing('xs'), marginRight: getSpacing('xs') },
    sm: { marginLeft: getSpacing('sm'), marginRight: getSpacing('sm') },
    md: { marginLeft: getSpacing('md'), marginRight: getSpacing('md') },
    lg: { marginLeft: getSpacing('lg'), marginRight: getSpacing('lg') },
    xl: { marginLeft: getSpacing('xl'), marginRight: getSpacing('xl') },
  },
  marginY: {
    xs: { marginTop: getSpacing('xs'), marginBottom: getSpacing('xs') },
    sm: { marginTop: getSpacing('sm'), marginBottom: getSpacing('sm') },
    md: { marginTop: getSpacing('md'), marginBottom: getSpacing('md') },
    lg: { marginTop: getSpacing('lg'), marginBottom: getSpacing('lg') },
    xl: { marginTop: getSpacing('xl'), marginBottom: getSpacing('xl') },
  },
  
  // Gap (for flexbox/grid)
  gap: {
    xs: { gap: getSpacing('xs') },
    sm: { gap: getSpacing('sm') },
    md: { gap: getSpacing('md') },
    lg: { gap: getSpacing('lg') },
    xl: { gap: getSpacing('xl') },
  },
} as const;

/**
 * Component spacing presets
 */
export const componentSpacing = {
  // Panel padding
  panelPadding: getSpacing('md'), // 16px
  
  // Card padding
  cardPadding: getSpacing('md'), // 16px
  
  // Button padding
  buttonPaddingX: getSpacing('md'), // 16px
  buttonPaddingY: getSpacing('sm'), // 8px
  
  // Input padding
  inputPaddingX: getSpacing('sm'), // 8px
  inputPaddingY: getSpacing('xs'), // 4px
  
  // Section spacing
  sectionSpacing: getSpacing('lg'), // 24px
  
  // Item spacing (in lists)
  itemSpacing: getSpacing('sm'), // 8px
} as const;


