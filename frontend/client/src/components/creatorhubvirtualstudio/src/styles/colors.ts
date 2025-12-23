/**
 * Color System
 * 
 * Semantic color system with WCAG 2.2 compliance
 * Provides color utilities and contrast validation
 */

import { colors } from './designTokens';

/**
 * Semantic color roles
 */
export const semanticColors = {
  primary: colors.primary,
  secondary: colors.secondary,
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
} as const;

/**
 * Surface color roles (for elevation)
 */
export const surfaceColors = {
  base: colors.background.base,
  panel: colors.background.panel,
  card: colors.background.card,
  elevated: colors.background.elevated,
  overlay: colors.background.overlay,
} as const;

/**
 * Text color roles
 */
export const textColors = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  tertiary: colors.text.tertiary,
  disabled: colors.text.disabled,
  inverse: colors.text.inverse,
} as const;

/**
 * Border color roles
 */
export const borderColors = {
  default: colors.border.default,
  hover: colors.border.hover,
  active: colors.border.active,
  focus: colors.border.focus,
  divider: colors.border.divider,
} as const;

/**
 * Calculate relative luminance (for contrast calculation)
 * Based on WCAG 2.2 guidelines
 */
function getLuminance(hex: string): number {
  // Remove # if present
  const rgb = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(rgb.substring(0, 2), 16) / 255;
  const g = parseInt(rgb.substring(2, 4), 16) / 255;
  const b = parseInt(rgb.substring(4, 6), 16) / 255;
  
  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio from 1:1 to 21:1
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG 2.2 requirements
 * - AA Normal: 4.5:1 for normal text, 3:1 for large text
 * - AAA Normal: 7:1 for normal text, 4.5:1 for large text
 */
export function meetsWCAG(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): boolean {
  const ratio = getContrastRatio(foreground, background);
  
  if (level === 'AA') {
    return size === 'normal' ? ratio >= 4.5 : ratio >= 3.0;
  } else {
    return size === 'normal' ? ratio >= 7.0 : ratio >= 4.5;
  }
}

/**
 * Get appropriate text color for a background
 * Returns white or black based on contrast
 */
export function getTextColorForBackground(background: string): string {
  const whiteContrast = getContrastRatio('#ffffff', background);
  const blackContrast = getContrastRatio('#000000', background);
  
  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
}

/**
 * Lighten a color by a percentage
 */
export function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) + Math.round(255 * percent);
  const g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  const b = (num & 0x0000ff) + Math.round(255 * percent);
  
  return `#${(0x1000000 + (r < 255 ? r : 255) * 0x10000 + (g < 255 ? g : 255) * 0x100 + (b < 255 ? b : 255)).toString(16).slice(1)}`;
}

/**
 * Darken a color by a percentage
 */
export function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) - Math.round(255 * percent);
  const g = ((num >> 8) & 0x00ff) - Math.round(255 * percent);
  const b = (num & 0x0000ff) - Math.round(255 * percent);
  
  return `#${(0x1000000 + (r > 0 ? r : 0) * 0x10000 + (g > 0 ? g : 0) * 0x100 + (b > 0 ? b : 0)).toString(16).slice(1)}`;
}

/**
 * Validate all color combinations for WCAG compliance
 */
export function validateColorContrast(): Array<{
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
}> {
  const results: Array<{
    foreground: string;
    background: string;
    ratio: number;
    passes: boolean;
  }> = [];
  
  // Test text colors on backgrounds
  Object.values(textColors).forEach((textColor) => {
    Object.values(surfaceColors).forEach((bgColor) => {
      if (typeof bgColor === 'string') {
        const ratio = getContrastRatio(textColor, bgColor);
        const passes = meetsWCAG(textColor, bgColor, 'AA', 'normal');
        results.push({ foreground: textColor, background: bgColor, ratio, passes });
      }
    });
  });
  
  return results;
}


