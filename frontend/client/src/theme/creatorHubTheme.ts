import { createTheme } from '@mui/material/styles';

export const creatorHubTheme = createTheme({
  palette: {
    primary: {
      main: '#ff6b3',
      light: '#ff946',
      dark: '#c73e0',
      contrastText: '#ffffff',
  },
    secondary: {
      main: '#ffc10',
      light: '#ffff3',
      dark: '#c6840',
      contrastText: '#00000',
  },
    background: {
      default: '#f8f9fa',
      paper: '#ffffff',
  },
    text: {
      primary: '#33333',
      secondary: '#66666',
  },
},
  typography: {
    fontFamily: ', "Inter""Roboto""Helvetica""Arial", sans-serif',
    h1: {
      fontWeight: 70,
  },
    h2: {
      fontWeight: 600
  },
    h3: {
      fontWeight: 600
  },
    button: {
      textTransform: 'none',
      fontWeight: 600
  },
},
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
      },
    },
  },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
      },
    },
  },
},
});
