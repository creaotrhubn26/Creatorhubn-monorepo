/**
 * White-Label Theme Provider
 *
 * Dynamically generates MUI theme based on user, 's white-label branding
 * Automatically applies brand colors, typography, and component styling
 * Supports light/dark mode with brand color variants
 */

import React, { useMemo, ReactNode } from 'react';
import { ThemeProvider, createTheme, Theme, alpha, darken, lighten } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useWhiteLabelBranding } from './WhiteLabelBrandingContext';

interface WhiteLabelThemeProviderProps {
  children: ReactNode;
  mode?: 'light' | 'dark';
  photographerId: string;
}

/**
 * Generates color variants from a base brand color
 */
const generateColorPalette = (baseColor: string, mode: 'light' | 'dark') => {
  const main = baseColor;
  const light = lighten(baseColor, 0.3);
  const dark = darken(baseColor, 0.2);
  const contrastText = mode === 'light' ? '#ffffff' : '#000000';

  return {
    main,
    light,
    dark,
    contrastText,
  };
};

/**
 * Generates a complete MUI theme based on white-label branding
 */
const createBrandedTheme = (brandColor: string, mode: 'light' | 'dark', branding: unknown): Theme => {
  const primaryPalette = generateColorPalette(brandColor, mode);

  return createTheme({
    palette: {
      mode,
      primary: primaryPalette,
      secondary: {
        main: mode === 'light' ? darken(brandColor, 0.1) : lighten(brandColor, 0.1),
        light: lighten(brandColor, 0.4),
        dark: darken(brandColor, 0.3),
        contrastText: mode === 'light' ? '#ffffff' : '#000000',
      },
      background: {
        default: mode === 'light' ? '#f5f5f5' : '#121212',
        paper: mode === 'light' ? '#ffffff' : '#1e1e1e',
      },
      text: {
        primary: mode === 'light' ? '#000000' : '#ffffff',
        secondary: mode === 'light' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system','BlinkMacSystemFont','"Segoe UI"','Roboto',', "Helvetica Neue"','Arial','sans-serif',
      ].join(''),
      h1: {
        fontWeight: 700,
        color: primaryPalette.main,
      },
      h2: {
        fontWeight: 600,
        color: primaryPalette.main,
      },
      h3: {
        fontWeight: 600,
        color: primaryPalette.main,
      },
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 500,
      },
      h6: {
        fontWeight: 500,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: `0 4px 12px ${alpha(brandColor, 0.3)}`,
            },
          },
          containedPrimary: {
            backgroundColor: primaryPalette.main,
            '&:hover': {
              backgroundColor: primaryPalette.dark,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow:
              mode === 'light' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.4)',
            border: mode === 'light' ? 'none' : `1px solid ${alpha('#ffffff', 0.1)}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
          elevation1: {
            boxShadow:
              mode === 'light' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : '0 1px 4px rgba(0, 0, 0, 0.4)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: primaryPalette.main,
            boxShadow: 'none',
            borderBottom: `1px solid ${alpha(primaryPalette.dark, 0.2)}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
          filled: {
            backgroundColor: alpha(primaryPalette.main, 0.1),
            color: primaryPalette.main,
            fontWeight: 500,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: primaryPalette.main,
                borderWidth: 2,
              },
            },
            '& .MuiInputLabel-root.Mui-focused': {
              color: primaryPalette.main,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            backgroundColor: alpha(primaryPalette.main, 0.05),
            color: primaryPalette.main,
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            color: primaryPalette.main,
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
          standardSuccess: {
            backgroundColor: alpha(primaryPalette.main, 0.1),
            color: primaryPalette.dark,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            '&.Mui-selected': {
              color: primaryPalette.main,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: primaryPalette.main,
            height: 3,
            borderRadius: '3px 3px 0 0',
          },
        },
      },
    },
  });
};

/**
 * White-Label Theme Provider Component
 * Wraps app with dynamically branded MUI theme
 */
export const WhiteLabelThemeProvider: React.FC<WhiteLabelThemeProviderProps> = ({
  children,
  mode ='light',
  photographerId,
}) => {
  const { branding, isLoading, getBrandColor } = useWhiteLabelBranding();

  const theme = useMemo(() => {
    const brandColor = getBrandColor();
    return createBrandedTheme(brandColor, mode, branding);
  }, [branding, mode, getBrandColor]);

  if (isLoading) {
    return <div>Loading theme...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

/**
 * Hook to access branded theme values
 */
export const useBrandedTheme = () => {
  const { getBrandColor, getLogoUrl, getBusinessName, branding } = useWhiteLabelBranding();

  return {
    brandColor: getBrandColor(),
    logoUrl: getLogoUrl(),
    businessName: getBusinessName(),
    branding,

    // Helper functions for common styling patterns
    getBrandedBackground: (opacity: number = 0.1) => {
      return alpha(getBrandColor(), opacity);
    },

    getBrandedBorder: (width: number = 1) => {
      return `${width}px solid ${getBrandColor()}`;
    },

    getBrandedShadow: (opacity: number = 0.3) => {
      return `0 4px 12px ${alpha(getBrandColor(), opacity)}`;
    },

    getBrandedGradient: () => {
      const color = getBrandColor();
      return `linear-gradient(135deg, ${color} 0%, ${darken(color, 0.2)} 100%)`;
    },
  };
};

export default WhiteLabelThemeProvider;
