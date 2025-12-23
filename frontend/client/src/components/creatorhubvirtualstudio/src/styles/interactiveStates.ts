/**
 * Interactive States
 * 
 * Reusable hover, active, and focus states for interactive elements
 */

import { colors, transitions, shadows, borderRadius } from './designTokens';

/**
 * Hover state styles
 */
export const hoverStates = {
  // Button hover
  button: {
    transform: 'translateY(-2px) scale(1.02)',
    boxShadow: shadows.md,
    transition: transitions.normal,
  },
  
  // Card hover
  card: {
    borderColor: colors.border.hover,
    transform: 'translateY(-2px)',
    boxShadow: shadows.md,
    transition: transitions.normal,
  },
  
  // Link hover
  link: {
    color: colors.primary,
    transition: transitions.fast,
  },
  
  // Icon button hover
  iconButton: {
    backgroundColor: colors.background.elevated,
    transform: 'scale(1.1)',
    transition: transitions.fast,
  },
  
  // Input hover
  input: {
    borderColor: colors.border.hover,
    transition: transitions.fast,
  },
} as const;

/**
 * Active state styles
 */
export const activeStates = {
  // Button active
  button: {
    transform: 'translateY(0) scale(0.98)',
    boxShadow: shadows.sm,
    transition: transitions.fast,
  },
  
  // Card active
  card: {
    transform: 'translateY(0)',
    boxShadow: shadows.sm,
    transition: transitions.fast,
  },
  
  // Icon button active
  iconButton: {
    transform: 'scale(0.95)',
    transition: transitions.fast,
  },
} as const;

/**
 * Focus state styles (for accessibility)
 */
export const focusStates = {
  // Focus ring
  ring: {
    outline: `2px solid ${colors.border.focus}`,
    outlineOffset: '2px',
    borderRadius: borderRadius.md,
  },
  
  // Focus visible (keyboard navigation)
  visible: {
    '&:focus-visible': {
      outline: `2px solid ${colors.border.focus}`,
      outlineOffset: '2px',
      borderRadius: borderRadius.md,
    },
  },
  
  // Focus within (for form groups)
  within: {
    '&:focus-within': {
      borderColor: colors.border.focus,
    },
  },
} as const;

/**
 * Disabled state styles
 */
export const disabledStates = {
  // Disabled element
  element: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
  },
  
  // Disabled button
  button: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
    '&:hover': {
      transform: 'none',
      boxShadow: 'none',
    },
  },
} as const;

/**
 * Combined interactive states for common components
 */
export const interactiveStyles = {
  button: {
    transition: transitions.normal,
    '&:hover': hoverStates.button,
    '&:active': activeStates.button,
    '&:focus-visible': focusStates.ring,
    '&:disabled': disabledStates.button,
  },
  
  card: {
    transition: transitions.normal,
    cursor: 'pointer',
    '&:hover': hoverStates.card,
    '&:active': activeStates.card,
    '&:focus-visible': focusStates.ring,
  },
  
  iconButton: {
    transition: transitions.fast,
    '&:hover': hoverStates.iconButton,
    '&:active': activeStates.iconButton,
    '&:focus-visible': focusStates.ring,
    '&:disabled': disabledStates.element,
  },
  
  input: {
    transition: transitions.fast,
    '&:hover': hoverStates.input,
    '&:focus': {
      borderColor: colors.border.focus,
      outline: 'none',
    },
    '&:focus-visible': focusStates.ring,
    '&:disabled': disabledStates.element,
  },
  
  link: {
    transition: transitions.fast,
    textDecoration: 'none',
    '&:hover': hoverStates.link,
    '&:focus-visible': focusStates.ring,
  },
} as const;


