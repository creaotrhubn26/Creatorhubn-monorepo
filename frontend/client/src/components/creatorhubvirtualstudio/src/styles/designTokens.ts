/**
 * Design Tokens System
 * 
 * Central design tokens for CreatorHub Virtual Studio
 * Based on Set A Light 3D design principles and professional software UI best practices
 * 
 * Tokens are exported as both TypeScript objects and CSS custom properties
 */

/**
 * Color Tokens
 */
export const colors = {
  // Primary Colors
  primary: '#4a9eff',
  primaryHover: '#3a8eef',
  primaryActive: '#2a7edf',
  primaryLight: '#6ab0ff',
  primaryDark: '#1a5eaf',
  
  // Secondary Colors
  secondary: '#7a7a7a',
  secondaryHover: '#8a8a8a',
  secondaryActive: '#6a6a6a',
  
  // Background Colors (Surface Levels)
  background: {
    base: '#0a0a0a',        // Main background
    panel: '#1a1a1a',       // Panel background
    card: '#2a2a2a',        // Card background
    elevated: '#3a3a3a',    // Elevated surface
    overlay: 'rgba(0, 0, 0, 0.8)', // Overlay background
  },
  
  // Text Colors
  text: {
    primary: '#ffffff',     // Primary text
    secondary: '#e0e0e0',   // Secondary text
    tertiary: '#aaaaaa',    // Tertiary text
    disabled: '#888888',    // Disabled text
    inverse: '#000000',     // Text on light background
  },
  
  // Border Colors
  border: {
    default: '#2a2a2a',     // Default border
    hover: '#3a3a3a',       // Hover border
    active: '#4a4a4a',      // Active border
    focus: '#4a9eff',       // Focus border
    divider: '#2a2a2a',     // Divider line
  },
  
  // Semantic Colors
  success: '#22c55e',
  successHover: '#16a34a',
  error: '#ef4444',
  errorHover: '#dc2626',
  warning: '#f59e0b',
  warningHover: '#d97706',
  info: '#3b82f6',
  infoHover: '#2563eb',
  
  // Light Colors (for light theme - future)
  light: {
    background: {
      base: '#ffffff',
      panel: '#f5f5f5',
      card: '#fafafa',
    },
    text: {
      primary: '#000000',
      secondary: '#333333',
      tertiary: '#666666',
    },
  },
} as const;

/**
 * Spacing Tokens (8px baseline)
 */
export const spacing = {
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 16,   // 16px
  lg: 24,   // 24px
  xl: 32,   // 32px
  xxl: 48,  // 48px
  xxxl: 64, // 64px
} as const;

/**
 * Typography Tokens
 */
export const typography = {
  fontFamily: {
    primary: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    monospace: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Consolas', 'Liberation Mono', 'Menlo', monospace",
  },
  fontSize: {
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 16,
    h5: 14,
    h6: 12,
    body1: 14,
    body2: 13,
    caption: 11,
    overline: 10,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.5,
    loose: 1.6,
  },
} as const;

/**
 * Border Radius Tokens
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Shadow Tokens
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  xl: '0 12px 48px rgba(0, 0, 0, 0.6)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
} as const;

/**
 * Transition Tokens
 */
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '350ms cubic-bezier(0.4, 0, 0.2, 1)',
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
} as const;

/**
 * Z-Index Tokens
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

/**
 * Breakpoint Tokens
 */
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1920,
} as const;

/**
 * Export all tokens as a single object
 */
export const designTokens = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
} as const;

/**
 * Generate CSS Custom Properties
 * Returns a string that can be injected into :root
 */
export function generateCSSCustomProperties(): string {
  const props: string[] = [];
  
  // Colors
  Object.entries(colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      props.push(`  --color-${key}: ${value};`);
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        props.push(`  --color-${key}-${subKey}: ${subValue};`);
      });
    }
  });
  
  // Spacing
  Object.entries(spacing).forEach(([key, value]) => {
    props.push(`  --spacing-${key}: ${value}px;`);
  });
  
  // Typography
  Object.entries(typography.fontSize).forEach(([key, value]) => {
    props.push(`  --font-size-${key}: ${value}px;`);
  });
  Object.entries(typography.fontWeight).forEach(([key, value]) => {
    props.push(`  --font-weight-${key}: ${value};`);
  });
  Object.entries(typography.lineHeight).forEach(([key, value]) => {
    props.push(`  --line-height-${key}: ${value};`);
  });
  
  // Border Radius
  Object.entries(borderRadius).forEach(([key, value]) => {
    props.push(`  --border-radius-${key}: ${value}px;`);
  });
  
  // Shadows
  Object.entries(shadows).forEach(([key, value]) => {
    props.push(`  --shadow-${key}: ${value};`);
  });
  
  // Transitions
  Object.entries(transitions).forEach(([key, value]) => {
    if (typeof value === 'string') {
      props.push(`  --transition-${key}: ${value};`);
    }
  });
  
  // Z-Index
  Object.entries(zIndex).forEach(([key, value]) => {
    props.push(`  --z-index-${key}: ${value};`);
  });
  
  // Breakpoints
  Object.entries(breakpoints).forEach(([key, value]) => {
    props.push(`  --breakpoint-${key}: ${value}px;`);
  });
  
  return `:root {\n${props.join('\n')}\n}`;
}

/**
 * Helper function to get spacing value
 */
export function getSpacing(size: keyof typeof spacing): string {
  return `${spacing[size]}px`;
}

/**
 * Helper function to get color value
 */
export function getColor(path: string): string {
  const parts = path.split('.');
  let value: any = colors;
  for (const part of parts) {
    value = value[part];
    if (value === undefined) {
      console.warn(`Color path "${path}" not found`);
      return '#ffffff';
    }
  }
  return value;
}


