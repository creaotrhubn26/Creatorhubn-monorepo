/**
 * Hover Effects
 * 
 * Reusable hover effect utilities
 */

import { colors, transitions, shadows } from './designTokens';

/**
 * Standard hover effect (for buttons, cards, etc.)
 */
export const standardHover = {
  transform: 'translateY(-2px) scale(1.02)',
  boxShadow: shadows.md,
  transition: transitions.normal,
} as const;

/**
 * Subtle hover effect (for icons, small elements)
 */
export const subtleHover = {
  transform: 'scale(1.1)',
  transition: transitions.fast,
} as const;

/**
 * Background hover effect
 */
export function backgroundHover(baseColor: string) {
  return {
    backgroundColor: colors.background.elevated,
    transition: transitions.fast,
  };
}

/**
 * Border hover effect
 */
export function borderHover(baseColor: string) {
  return {
    borderColor: colors.border.hover,
    transition: transitions.fast,
  };
}

/**
 * Combined hover effect (transform + shadow + border)
 */
export const combinedHover = {
  transform: 'translateY(-2px)',
  boxShadow: shadows.md,
  borderColor: colors.border.hover,
  transition: transitions.normal,
} as const;


