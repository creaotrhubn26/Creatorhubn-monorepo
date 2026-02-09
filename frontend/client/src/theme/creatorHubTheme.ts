import { createTheme, alpha } from '@mui/material/styles';

// Modern 2026 Design System Colors
const colors = {
  // Primary gradient palette - warm amber/orange
  primary: {
    main: '#FF6B35',
    light: '#FF8F5C',
    dark: '#E85A24',
    lighter: '#FFF0E8',
  },
  // Secondary - deep purple for contrast
  secondary: {
    main: '#6366F1',
    light: '#818CF8',
    dark: '#4F46E5',
  },
  // Success - modern teal
  success: {
    main: '#10B981',
    light: '#34D399',
    dark: '#059669',
  },
  // Background gradients
  background: {
    gradient: 'linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 50%, #FFEDD5 100%)',
    glass: 'rgba(255, 255, 255, 0.85)',
    glassHover: 'rgba(255, 255, 255, 0.95)',
  },
  // Neutral grays
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
};

export const creatorHubTheme = createTheme({
  palette: {
    primary: {
      main: colors.primary.main,
      light: colors.primary.light,
      dark: colors.primary.dark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.secondary.main,
      light: colors.secondary.light,
      dark: colors.secondary.dark,
      contrastText: '#ffffff',
    },
    success: {
      main: colors.success.main,
      light: colors.success.light,
      dark: colors.success.dark,
    },
    background: {
      default: '#FFFBF5',
      paper: '#ffffff',
    },
    text: {
      primary: colors.gray[800],
      secondary: colors.gray[600],
    },
    divider: colors.gray[200],
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", "Segoe UI", "Roboto", "Helvetica", sans-serif',
    h1: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: 1.1,
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.015em',
      lineHeight: 1.2,
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.005em',
      lineHeight: 1.35,
    },
    h5: {
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      lineHeight: 1.4,
    },
    subtitle1: {
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      lineHeight: 1.6,
    },
    body2: {
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.04)',
    '0 2px 4px rgba(0,0,0,0.06)',
    '0 4px 8px rgba(0,0,0,0.06)',
    '0 6px 12px rgba(0,0,0,0.08)',
    '0 8px 16px rgba(0,0,0,0.08)',
    '0 12px 24px rgba(0,0,0,0.10)',
    '0 16px 32px rgba(0,0,0,0.10)',
    '0 20px 40px rgba(0,0,0,0.12)',
    '0 24px 48px rgba(0,0,0,0.12)',
    '0 32px 64px rgba(0,0,0,0.14)',
    '0 40px 80px rgba(0,0,0,0.14)',
    '0 1px 2px rgba(0,0,0,0.04)',
    '0 2px 4px rgba(0,0,0,0.06)',
    '0 4px 8px rgba(0,0,0,0.06)',
    '0 6px 12px rgba(0,0,0,0.08)',
    '0 8px 16px rgba(0,0,0,0.08)',
    '0 12px 24px rgba(0,0,0,0.10)',
    '0 16px 32px rgba(0,0,0,0.10)',
    '0 20px 40px rgba(0,0,0,0.12)',
    '0 24px 48px rgba(0,0,0,0.12)',
    '0 32px 64px rgba(0,0,0,0.14)',
    '0 40px 80px rgba(0,0,0,0.14)',
    '0 48px 96px rgba(0,0,0,0.16)',
    '0 56px 112px rgba(0,0,0,0.18)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: colors.gray[100],
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: colors.gray[300],
            borderRadius: '4px',
            '&:hover': {
              background: colors.gray[400],
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 20px',
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          boxShadow: '0 2px 8px rgba(255, 107, 53, 0.25)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(255, 107, 53, 0.35)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
            backgroundColor: alpha(colors.primary.main, 0.04),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.04)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          transition: 'all 0.2s ease',
        },
        filled: {
          '&:hover': {
            transform: 'scale(1.02)',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.95rem',
          minHeight: 48,
          transition: 'all 0.2s ease',
          '&.Mui-selected': {
            fontWeight: 600,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: '2px solid rgba(255,255,255,0.8)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.8rem',
          padding: '8px 12px',
          backgroundColor: colors.gray[800],
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
          backgroundColor: colors.gray[100],
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(255, 107, 53, 0.35)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: '0 6px 28px rgba(255, 107, 53, 0.45)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(colors.primary.main, 0.15)}`,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        standardSuccess: {
          backgroundColor: alpha(colors.success.main, 0.1),
          border: `1px solid ${alpha(colors.success.main, 0.3)}`,
        },
        standardError: {
          backgroundColor: alpha('#EF4444', 0.1),
          border: `1px solid ${alpha('#EF4444', 0.3)}`,
        },
        standardWarning: {
          backgroundColor: alpha('#F59E0B', 0.1),
          border: `1px solid ${alpha('#F59E0B', 0.3)}`,
        },
        standardInfo: {
          backgroundColor: alpha(colors.secondary.main, 0.1),
          border: `1px solid ${alpha(colors.secondary.main, 0.3)}`,
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
          fontSize: '0.7rem',
          minWidth: 18,
          height: 18,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.gray[100],
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          margin: '2px 8px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: alpha(colors.primary.main, 0.06),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary.main, 0.1),
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.15),
            },
          },
        },
      },
    },
  },
});

// Export utility function for glassmorphism effects
export const glassEffect = (opacity = 0.85) => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
});

// Export gradient presets
export const gradients = {
  primary: 'linear-gradient(135deg, #FF6B35 0%, #FF8F5C 100%)',
  secondary: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
  success: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
  warm: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
  sunset: 'linear-gradient(135deg, #FF6B35 0%, #F59E0B 50%, #FF8F5C 100%)',
  aurora: 'linear-gradient(135deg, #6366F1 0%, #EC4899 50%, #F59E0B 100%)',
};
