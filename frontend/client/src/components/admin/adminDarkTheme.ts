import { createTheme } from '@mui/material';

/**
 * Felles mørkt MUI-tema for admin-paneler.
 *
 * Appens globale `creatorHubTheme` er lyst (background.paper: #ffffff, mørk
 * tekst). Admin-skallet er derimot mørkt (#0a0f1a, glassmorphism, oransje
 * aksent). Paneler som bruker default MUI `<Card>`/`<Paper>`/`text.secondary`
 * blir derfor lyse «øyer» inne i det mørke skallet.
 *
 * Pakk slike paneler i `<ThemeProvider theme={adminDarkTheme}>` så havner alle
 * flater, papir og sekundærtekst i samme palett som skallet – uten å måtte
 * style hvert enkelt kort manuelt.
 */
export const adminDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ff8c00' },
    background: { default: 'transparent', paper: 'rgba(15,23,42,0.72)' },
    text: { primary: 'rgba(255,255,255,0.95)', secondary: 'rgba(255,255,255,0.62)' },
    divider: 'rgba(255,255,255,0.12)',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 18px 36px rgba(0,0,0,0.30)',
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

export default adminDarkTheme;
