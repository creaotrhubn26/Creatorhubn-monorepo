/**
 * MUI Theme Extension
 * 
 * Extends Material-UI theme with Virtual Studio design tokens
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';
import { colors, spacing, typography, borderRadius, shadows, transitions } from './designTokens';

/**
 * Create Virtual Studio theme
 */
export function createVirtualStudioTheme(): ThemeOptions {
  return {
    palette: {
      mode: 'dark',
      primary: {
        main: colors.primary,
        light: colors.primaryLight,
        dark: colors.primaryDark,
        contrastText: colors.text.inverse,
      },
      secondary: {
        main: colors.secondary,
        light: colors.secondaryHover,
        dark: colors.secondaryActive,
        contrastText: colors.text.primary,
      },
      error: {
        main: colors.error,
        light: colors.errorHover,
        contrastText: colors.text.primary,
      },
      warning: {
        main: colors.warning,
        light: colors.warningHover,
        contrastText: colors.text.inverse,
      },
      info: {
        main: colors.info,
        light: colors.infoHover,
        contrastText: colors.text.primary,
      },
      success: {
        main: colors.success,
        light: colors.successHover,
        contrastText: colors.text.inverse,
      },
      background: {
        default: colors.background.base,
        paper: colors.background.panel,
      },
      text: {
        primary: colors.text.primary,
        secondary: colors.text.secondary,
        disabled: colors.text.disabled,
      },
      divider: colors.border.divider,
    },
    typography: {
      fontFamily: typography.fontFamily.primary,
      h1: {
        fontSize: `${typography.fontSize.h1}px`,
        lineHeight: typography.lineHeight.tight,
        fontWeight: typography.fontWeight.bold,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: `${typography.fontSize.h2}px`,
        lineHeight: typography.lineHeight.normal,
        fontWeight: typography.fontWeight.semibold,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: `${typography.fontSize.h3}px`,
        lineHeight: typography.lineHeight.normal,
        fontWeight: typography.fontWeight.semibold,
      },
      h4: {
        fontSize: `${typography.fontSize.h4}px`,
        lineHeight: typography.lineHeight.normal,
        fontWeight: typography.fontWeight.medium,
      },
      h5: {
        fontSize: `${typography.fontSize.h5}px`,
        lineHeight: typography.lineHeight.relaxed,
        fontWeight: typography.fontWeight.medium,
      },
      h6: {
        fontSize: `${typography.fontSize.h6}px`,
        lineHeight: typography.lineHeight.relaxed,
        fontWeight: typography.fontWeight.medium,
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
      button: {
        textTransform: 'none' as const,
        fontWeight: typography.fontWeight.medium,
      },
    },
    shape: {
      borderRadius: borderRadius.md,
    },
    shadows: [
      'none',
      shadows.sm,
      shadows.md,
      shadows.lg,
      shadows.xl,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
      shadows.lg,
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: borderRadius.md,
            textTransform: 'none',
            fontWeight: typography.fontWeight.medium,
            padding: `${spacing.sm}px ${spacing.md}px`,
            transition: transitions.normal,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: shadows.md,
            },
            '&:active': {
              transform: 'translateY(0) scale(0.98)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: colors.background.card,
              borderRadius: borderRadius.md,
              transition: transitions.normal,
              '& fieldset': {
                borderColor: colors.border.default,
              },
              '&:hover fieldset': {
                borderColor: colors.border.hover,
              },
              '&.Mui-focused fieldset': {
                borderColor: colors.border.focus,
              },
            },
            '& .MuiInputBase-input': {
              color: colors.text.primary,
              '&::placeholder': {
                color: colors.text.tertiary,
                opacity: 1,
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.md,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.border.default,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.border.hover,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.border.focus,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: typography.fontWeight.medium,
              minHeight: 48,
              transition: transitions.normal,
              '&.Mui-selected': {
                color: colors.text.primary,
              },
            },
            '& .MuiTabs-indicator': {
              height: 2,
              backgroundColor: colors.primary,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: colors.background.card,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.border.default}`,
            transition: transitions.normal,
            '&:hover': {
              borderColor: colors.border.hover,
              boxShadow: shadows.md,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: colors.background.panel,
            backgroundImage: 'none',
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundColor: colors.background.panel,
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.md,
            '&:before': {
              display: 'none',
            },
            '&.Mui-expanded': {
              margin: 0,
            },
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            color: colors.primary,
            '& .MuiSlider-thumb': {
              '&:hover': {
                boxShadow: `0 0 0 8px rgba(74, 158, 255, 0.16)`,
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Create and export theme instance
 */
export const virtualStudioTheme = createTheme(createVirtualStudioTheme());


