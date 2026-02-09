/**
 * Lightroom Theme Provider
 * Wraps photo editing components with Lightroom-style dark theme
 */

import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import '../../styles/lightroom-photo-editor-theme.css';

const lightroomTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4a9eff',
      light: '#6bb5ff',
      dark: '#2e7fd9',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff6b6b',
      light: '#ff8e8e',
      dark: '#ff4848',
      contrastText: '#ffffff',
    },
    background: {
      default: '#1a1a1a',
      paper: '#252525',
    },
    text: {
      primary: '#e6e6e6',
      secondary: '#999999',
      disabled: '#666666',
    },
    divider: '#3a3a3a',
    action: {
      active: '#4a9eff',
      hover: 'rgba(74, 158, 255, 0.08)',
      selected: 'rgba(74, 158, 255, 0.16)',
      disabled: '#666666',
      disabledBackground: '#3a3a3a',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont "Segoe UI","Roboto","Helvetica Neue", Arial, sans-serif',
    h6: {
      fontSize: '14px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#ffffff',
    },
    body1: {
      fontSize: '13px',
      color: '#e6e6e6',
    },
    body2: {
      fontSize: '12px',
      color: '#999999',
    },
    caption: {
      fontSize: '11px',
      color: '#999999',
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#252525',
          border: '1px solid #3a3a3a',
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#4a9eff',
        },
        thumb: {
          width: 14,
          height: 14,
          border: '2px solid #1a1a1a',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)','&:hover': {
            boxShadow: '0 0 0 8px rgba(74, 158, 255, 0.16)',
          },
        },
        track: {
          height: 2,
          border: 'none',
        },
        rail: {
          height: 2,
          backgroundColor: '#3a3a3a',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #3a3a3a',
          minHeight: 40,
        },
        indicator: {
          backgroundColor: '#4a9eff',
          height: 2,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
          textTransform: 'none',
          color: '#999999','&:hover': {
            color: '#ffffff',
          }, '&.Mui-selected': {
            color: '#4a9eff',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '13px',
          fontWeight: 500,
          borderRadius: '4px',
          padding: '8px 16px',
        },
        outlined: {
          borderColor: '#3a3a3a',
          color: '#e6e6e6','&:hover': {
            borderColor: '#4a4a4a',
            backgroundColor: 'rgba(74, 158, 255, 0.08)',
          },
        },
        contained: {
          backgroundColor: '#4a9eff',
          color: '#ffffff','&:hover': {
            backgroundColor: '#5aaeff',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#3a3a3a',
          color: '#e6e6e6',
          fontSize: '11px',
          height: 24,
        },
        colorPrimary: {
          backgroundColor: '#4a9eff',
          color: '#ffffff',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: '#1f1f1f',
          border: '1px solid #3a3a3a',
          borderRadius: '4px',
          marginBottom: '8px',
          boxShadow: 'none','&:before': {
            display: 'none',
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
          minHeight: 48,
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '16px',
          backgroundColor: '#252525',
          borderTop: '1px solid #3a3a3a',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3a3a3a',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4a4a4a',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4a9eff',
          },
        },
        input: {
          color: '#e6e6e6',
          fontSize: '13px',
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          color: '#999999',
          '&.Mui-focused': {
            color: '#4a9eff',
          },
        },
      },
    },
  },
});

interface LightroomThemeProviderProps {
  children: React.ReactNode;
}

export default function LightroomThemeProvider({ children }: LightroomThemeProviderProps) {
  return (
    <ThemeProvider theme={lightroomTheme}>
      <CssBaseline />
      <div className="lightroom-photo-editor">
        {children}
      </div>
    </ThemeProvider>
  );
}

