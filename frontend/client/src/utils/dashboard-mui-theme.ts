/**
 * dashboard-mui-theme — Slice 9X.72
 *
 * MUI ThemeProvider-tema som tvinger dark-overflater på alle MUI-komponenter
 * inne i UniversalDashboard. Eliminerer behovet for å manuelt fikse hver
 * `bgcolor: 'background.paper'` eller `color: 'text.primary'`-default.
 *
 * Brukes som:
 *   <ThemeProvider theme={buildDashboardTheme(customBranding.color)}>
 *     <UniversalDashboardContent />
 *   </ThemeProvider>
 *
 * Påvirker:
 *   - palette.background.paper → dark
 *   - palette.text.* → lys-toner
 *   - palette.primary → customBranding.color
 *   - MuiCard, MuiPaper, MuiChip, MuiDialog defaults
 */

import { createTheme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

export function buildDashboardTheme(accent: string = '#ffba6c') {
  const opts: ThemeOptions = {
    palette: {
      mode: 'dark',
      primary: {
        main: accent,
        contrastText: '#150d05',
      },
      background: {
        default: '#0a0807',
        paper: 'rgba(255,255,255,0.04)',
      },
      text: {
        primary: '#fff5e8',
        secondary: 'rgba(246,242,234,0.72)',
        disabled: 'rgba(246,242,234,0.32)',
      },
      divider: 'rgba(255,186,108,0.18)',
    },
    typography: {
      fontFamily: '"Inter", -apple-system, sans-serif',
      h1: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800 },
      h2: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800 },
      h3: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800 },
      h4: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
      h5: { fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      // Card: dark surface med accent border
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,255,255,0.04)',
            backgroundImage: 'none',
            border: `1px solid rgba(255,186,108,0.18)`,
            color: '#fff5e8',
          },
        },
      },
      // Paper: dark — overstyrer 'background.paper' default
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,255,255,0.04)',
            backgroundImage: 'none',
            color: '#fff5e8',
          },
        },
      },
      // Chip: sikrer lys tekst på accent-bg
      MuiChip: {
        styleOverrides: {
          root: {
            color: '#fff5e8',
          },
          // Outlined-variant
          outlined: {
            borderColor: 'rgba(246,242,234,0.32)',
          },
        },
      },
      // Dialog Paper må også være dark
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: 'rgba(15,10,7,0.96)',
            backgroundImage: 'none',
            color: '#fff5e8',
            border: `1px solid rgba(255,186,108,0.18)`,
          },
        },
      },
      // Accordion + accordion-summary
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,255,255,0.03)',
            color: '#fff5e8',
            '&:before': { display: 'none' },
          },
        },
      },
      // Inputs får dark-styling
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            color: '#fff5e8',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,255,255,0.18)',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(255,186,108,0.4)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: accent,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'rgba(246,242,234,0.72)',
            '&.Mui-focused': { color: accent },
          },
        },
      },
      // Tabs i seksjoner
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: accent, height: 3, borderRadius: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: 'rgba(246,242,234,0.62)',
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-selected': { color: accent },
          },
        },
      },
      // Divider
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: 'rgba(255,255,255,0.08)' },
        },
      },
      // List + ListItem
      MuiListItemText: {
        styleOverrides: {
          primary: { color: '#fff5e8' },
          secondary: { color: 'rgba(246,242,234,0.72)' },
        },
      },
      // Button — outlined får accent-border default
      MuiButton: {
        styleOverrides: {
          outlined: {
            borderColor: 'rgba(246,242,234,0.32)',
            color: '#fff5e8',
            textTransform: 'none',
          },
        },
      },
      // Switch
      MuiSwitch: {
        styleOverrides: {
          track: { backgroundColor: 'rgba(255,255,255,0.18)' },
        },
      },
      // Table for stats-tabeller
      MuiTableCell: {
        styleOverrides: {
          root: {
            color: '#fff5e8',
            borderBottomColor: 'rgba(255,255,255,0.08)',
          },
          head: {
            color: 'rgba(246,242,234,0.72)',
            fontWeight: 600,
          },
        },
      },
      // Menu (dropdown)
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: 'rgba(15,10,7,0.96)',
            backgroundImage: 'none',
            border: `1px solid rgba(255,186,108,0.18)`,
            color: '#fff5e8',
          },
        },
      },
    },
    shape: {
      borderRadius: 12,
    },
  };
  return createTheme(opts);
}
