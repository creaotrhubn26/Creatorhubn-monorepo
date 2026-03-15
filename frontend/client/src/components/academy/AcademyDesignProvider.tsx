import React, { useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { GlobalStyles } from '@mui/material';
import { creatorHubTheme } from '@/theme/creatorHubTheme';

interface AcademyDesignProviderProps {
  children: React.ReactNode;
}

export default function AcademyDesignProvider({ children }: AcademyDesignProviderProps) {
  const academyTheme = useMemo(() => {
    const theme = createTheme(creatorHubTheme, {
      typography: {
        fontFamily: '"Manrope", "Barlow", "Segoe UI", sans-serif',
        h1: {
          fontSize: 'clamp(2.1rem, 1.65rem + 1.25vw, 3.05rem)',
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: '0.01em',
        },
        h2: {
          fontSize: 'clamp(1.7rem, 1.35rem + 0.95vw, 2.4rem)',
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: '0.01em',
        },
        h3: {
          fontSize: 'clamp(1.4rem, 1.18rem + 0.7vw, 1.95rem)',
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: '0.01em',
        },
        h4: {
          fontSize: 'clamp(1.15rem, 1.04rem + 0.4vw, 1.42rem)',
          lineHeight: 1.25,
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
        body1: {
          fontSize: 'clamp(0.93rem, 0.9rem + 0.16vw, 1.03rem)',
          lineHeight: 1.5,
          letterSpacing: '0.005em',
        },
        body2: {
          fontSize: 'clamp(0.84rem, 0.81rem + 0.14vw, 0.92rem)',
          lineHeight: 1.45,
          letterSpacing: '0.004em',
        },
        subtitle1: {
          fontSize: 'clamp(1rem, 0.96rem + 0.2vw, 1.1rem)',
          lineHeight: 1.35,
          fontWeight: 600,
          letterSpacing: '0.008em',
        },
        subtitle2: {
          fontSize: 'clamp(0.89rem, 0.86rem + 0.14vw, 0.98rem)',
          lineHeight: 1.35,
          fontWeight: 600,
          letterSpacing: '0.008em',
        },
        button: {
          fontSize: 'clamp(0.84rem, 0.82rem + 0.14vw, 0.95rem)',
          lineHeight: 1.2,
          textTransform: 'none',
          fontWeight: 600,
          letterSpacing: '0.01em',
        },
        caption: {
          fontSize: 'clamp(0.73rem, 0.71rem + 0.1vw, 0.8rem)',
          lineHeight: 1.35,
          letterSpacing: '0.015em',
        },
      },
      components: {
        MuiButton: {
          defaultProps: {
            disableElevation: true,
          },
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: 8,
              minHeight: 38,
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              fontSize: 'clamp(0.83rem, 0.81rem + 0.12vw, 0.92rem)',
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 600,
              letterSpacing: '0.01em',
            },
          },
        },
        MuiListItemText: {
          styleOverrides: {
            primary: {
              fontSize: 'clamp(0.9rem, 0.87rem + 0.12vw, 0.98rem)',
              lineHeight: 1.35,
              letterSpacing: '0.006em',
            },
            secondary: {
              fontSize: 'clamp(0.79rem, 0.77rem + 0.11vw, 0.87rem)',
              lineHeight: 1.35,
              letterSpacing: '0.005em',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              fontSize: 'clamp(0.82rem, 0.8rem + 0.11vw, 0.9rem)',
              lineHeight: 1.4,
            },
            head: {
              fontWeight: 700,
              fontSize: 'clamp(0.81rem, 0.79rem + 0.11vw, 0.89rem)',
              letterSpacing: '0.01em',
            },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              fontSize: 'clamp(0.83rem, 0.81rem + 0.11vw, 0.91rem)',
              lineHeight: 1.35,
            },
          },
        },
        MuiInputLabel: {
          styleOverrides: {
            root: {
              fontSize: 'clamp(0.82rem, 0.8rem + 0.11vw, 0.9rem)',
              fontWeight: 500,
            },
          },
        },
        MuiFormLabel: {
          styleOverrides: {
            root: {
              fontSize: 'clamp(0.82rem, 0.8rem + 0.11vw, 0.9rem)',
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            label: {
              fontWeight: 600,
              letterSpacing: '0.01em',
            },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            input: {
              fontSize: 'clamp(0.84rem, 0.82rem + 0.14vw, 0.95rem)',
            },
          },
        },
      },
    });

    return theme;
  }, []);

  return (
    <ThemeProvider theme={academyTheme}>
      <GlobalStyles
        styles={{
          'body.academy-route': {
            '--academy-shell-max-width': '1920px',
            '--academy-hairline-width': '1px',
            '--academy-divider-width': '1px',
            '--academy-right-panel-width': '440px',
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          'body.academy-route .MuiTypography-root': {
            letterSpacing: '0.005em',
            lineHeight: 1.4,
          },
          'body.academy-route .MuiButton-root': {
            textTransform: 'none',
            fontWeight: 600,
          },
          'body.academy-route .MuiFormLabel-root': {
            fontSize: 'clamp(0.82rem, 0.8rem + 0.11vw, 0.9rem)',
          },
          'body.academy-route .MuiInputBase-input': {
            fontSize: 'clamp(0.84rem, 0.82rem + 0.14vw, 0.95rem)',
          },
          'body.academy-route .MuiTableCell-root': {
            fontSize: 'clamp(0.82rem, 0.8rem + 0.11vw, 0.9rem)',
          },
          'body.academy-route .MuiTab-root': {
            fontSize: 'clamp(0.83rem, 0.81rem + 0.12vw, 0.92rem)',
          },
          'body.academy-route .MuiChip-label': {
            fontWeight: 600,
            letterSpacing: '0.01em',
          },
          'body.academy-route .MuiOutlinedInput-notchedOutline': {
            borderWidth: 'var(--academy-hairline-width)',
          },
          'body.academy-route .MuiPaper-root.MuiPaper-outlined, body.academy-route .MuiCard-root': {
            borderWidth: 'var(--academy-hairline-width)',
          },
          'body.academy-route .MuiDivider-root': {
            borderBottomWidth: 'var(--academy-divider-width)',
          },
          'body.academy-route .MuiSvgIcon-root': {
            shapeRendering: 'geometricPrecision',
          },
          'body.academy-route img, body.academy-route video, body.academy-route canvas': {
            backfaceVisibility: 'hidden',
          },
          'body.academy-route aside .MuiButton-root': {
            fontSize: 'clamp(0.83rem, 0.8rem + 0.12vw, 0.92rem) !important',
          },
          'body.academy-route aside .MuiTypography-root': {
            fontSize: 'clamp(0.87rem, 0.84rem + 0.12vw, 0.97rem)',
          },
          'body.academy-route aside .MuiButton-root + .MuiButton-root': {
            marginTop: 4,
          },
          '@media (min-resolution: 2dppx)': {
            'body.academy-route': {
              '--academy-shell-max-width': '2000px',
              '--academy-hairline-width': '0.85px',
              '--academy-divider-width': '0.85px',
            },
          },
          '@media (min-resolution: 3dppx)': {
            'body.academy-route': {
              '--academy-shell-max-width': '2080px',
              '--academy-hairline-width': '0.75px',
              '--academy-divider-width': '0.75px',
            },
          },
        }}
      />
      {children}
    </ThemeProvider>
  );
}
