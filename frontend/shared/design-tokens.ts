/**
 * Design Tokens for Apple Liquid Glass System
 * Universal design system tokens for CreatorHub Norge
 */

export const designTokens = {
  // ============ GLASS EFFECTS ============
  glass: {
    blur: {
      light: '8px',
      medium: '12px',
      heavy: '20px',
      ultra: '32px',
    },
    opacity: {
      light: '0.15',
      medium: '0.25',
      heavy: '0.35',
      ultra: '0.45',
    },
    background: {
      light: 'rgba(255, 255, 255, 0.1)',
      medium: 'rgba(255, 255, 255, 0.15)',
      heavy: 'rgba(255, 255, 255, 0.25)',
      ultra: 'rgba(255, 255, 255, 0.35)',
    },
    border: {
      light: 'rgba(255, 255, 255, 0.2)',
      medium: 'rgba(255, 255, 255, 0.3)',
      heavy: 'rgba(255, 255, 255, 0.4)',
      ultra: 'rgba(255, 255, 255, 0.5)',
    },
  },

  // ============ MOTION CURVES ============
  motion: {
    spring: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    bounce: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '500ms',
    },
  },

  // ============ USER TYPE COLORS ============
  userTypes: {
    photographer: {
      primary: '#F59E0B',
      secondary: '#FCD34D',
      accent: '#F3F4F6',
      glass: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.3)',
    },
    videographer: {
      primary: '#3B82F6',
      secondary: '#60A5FA',
      accent: '#EFF6FF',
      glass: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.3)',
    },
    musicProducer: {
      primary: '#8B5CF6',
      secondary: '#A78BFA',
      accent: '#F5F3FF',
      glass: 'rgba(139, 92, 246, 0.15)',
      border: 'rgba(139, 92, 246, 0.3)',
    },
    admin: {
      primary: '#6B7280',
      secondary: '#9CA3AF',
      accent: '#F9FAFB',
      glass: 'rgba(107, 114, 128, 0.15)',
      border: 'rgba(107, 114, 128, 0.3)',
    },
  },

  // ============ NORWEGIAN COLOR PALETTE ============
  norwegian: {
    fjordBlue: '#2563EB',
    auroraGreen: '#10B981',
    midnight: '#1F2937',
    snow: '#F9FAFB',
    forestGreen: '#059669',
    salmonOrange: '#F97316',
  },

  // ============ SPACING SCALE ============
  spacing: {
    mobile: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    tablet: {
      xs: '6px',
      sm: '12px',
      md: '20px',
      lg: '32px',
      xl: '40px',
    },
    desktop: {
      xs: '8px',
      sm: '16px',
      md: '24px',
      lg: '40px',
      xl: '48px',
    },
  },

  // ============ BREAKPOINTS ============
  breakpoints: {
    mobile: '320px',
    tablet: '768px',
    desktop: '1280px',
    ultrawide: '1920px',
  },

  // ============ TYPOGRAPHY ============
  typography: {
    families: {
      heading: '"Playfair Display", serif',
      body: '"Inter", sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weights: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  // ============ SHADOWS ============
  shadows: {
    glass: {
      light: '0 4px 16px rgba(31, 38, 135, 0.2)',
      medium: '0 8px 32px rgba(31, 38, 135, 0.3)',
      heavy: '0 16px 64px rgba(31, 38, 135, 0.4)',
    },
    elevation: {
      low: '0 1px 3px rgba(0, 0, 0, 0.1)',
      medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
      high: '0 10px 15px rgba(0, 0, 0, 0.1)',
      highest: '0 25px 50px rgba(0, 0, 0, 0.25)',
    },
  },

  // ============ WCAG COMPLIANT COLORS ============
  accessibility: {
    contrastRatios: {
      normal: '4.5:1',
      large: '3:1',
      enhanced: '7:1',
    },
    focusRing: {
      width: '2px',
      offset: '2px',
      color: 'rgba(59, 130, 246, 0.5)',
    },
    touchTargets: {
      minimum: '44px',
      recommended: '48px',
    },
  },
};

export default designTokens;
