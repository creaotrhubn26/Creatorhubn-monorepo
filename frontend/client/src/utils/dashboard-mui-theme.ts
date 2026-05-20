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

/**
 * Slice 9X.72 — alle theme-verdier kan overstyres av CMS via
 * useDashboardTokens. Hooket sender oss tokens som inneholder
 * accent + tekst-farger + radius + font. Vi flyter dem inn i MUI-tema.
 */
interface DashboardThemeOptions {
  accent?: string;
  textPrimary?: string;
  textSecondary?: string;
  fontDisplay?: string;
  radius?: number;
}

export function buildDashboardTheme(arg: string | DashboardThemeOptions = '#ffba6c') {
  // Bakoverkompatibel: hvis bare accent-string blir gitt, bruk defaults
  const tokens: Required<DashboardThemeOptions> = typeof arg === 'string'
    ? {
        accent: arg,
        textPrimary: '#fff5e8',
        textSecondary: 'rgba(246,242,234,0.72)',
        fontDisplay: '"Space Grotesk", sans-serif',
        radius: 12,
      }
    : {
        accent: arg.accent || '#ffba6c',
        textPrimary: arg.textPrimary || '#fff5e8',
        textSecondary: arg.textSecondary || 'rgba(246,242,234,0.72)',
        fontDisplay: arg.fontDisplay || '"Space Grotesk", sans-serif',
        radius: arg.radius ?? 12,
      };

  const { accent, textPrimary, textSecondary, fontDisplay, radius } = tokens;
  // Avled accent-alpha for borders (24-bit hex → rgba med 0.18 alpha)
  const accentBorder = accent.startsWith('#') && accent.length === 7
    ? `rgba(${parseInt(accent.slice(1, 3), 16)},${parseInt(accent.slice(3, 5), 16)},${parseInt(accent.slice(5, 7), 16)},0.18)`
    : 'rgba(255,186,108,0.18)';

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
        primary: textPrimary,
        secondary: textSecondary,
        disabled: 'rgba(246,242,234,0.32)',
      },
      divider: accentBorder,
    },
    typography: {
      fontFamily: '"Inter", -apple-system, sans-serif',
      h1: { fontFamily: fontDisplay, fontWeight: 800 },
      h2: { fontFamily: fontDisplay, fontWeight: 800 },
      h3: { fontFamily: fontDisplay, fontWeight: 800 },
      h4: { fontFamily: fontDisplay, fontWeight: 700 },
      h5: { fontFamily: fontDisplay, fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    components: {
      // Card: dark surface med accent border
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,255,255,0.04)',
            backgroundImage: 'none',
            border: `1px solid ${accentBorder}`,
            color: textPrimary,
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
      borderRadius: radius,
    },
  };
  return createTheme(opts);
}
