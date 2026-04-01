import React, { useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { GlobalStyles } from '@mui/material';
import { creatorHubTheme } from '@/theme/creatorHubTheme';

interface AcademyDesignProviderProps {
  children: React.ReactNode;
}

export default function AcademyDesignProvider({ children }: AcademyDesignProviderProps) {
  const academyModalSurface =
    'linear-gradient(180deg, rgba(12, 17, 27, 0.96), rgba(8, 11, 18, 0.98))';
  const academyModalHeader =
    'linear-gradient(180deg, rgba(18, 25, 37, 0.98), rgba(11, 15, 24, 0.96))';
  const academyModalSection =
    'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))';
  const academyModalBorder = 'rgba(255,255,255,0.08)';
  const academyModalDivider = 'rgba(255,255,255,0.07)';
  const academyModalText = '#edf0f7';
  const academyModalTextSecondary = 'rgba(237,240,247,0.64)';
  const academyModalField = 'rgba(255,255,255,0.035)';
  const academyModalFieldHover = 'rgba(255,255,255,0.055)';
  const academyModalFieldBorder = 'rgba(255,255,255,0.14)';
  const academyModalAccent = '#f5a623';
  const academyModalAccentStrong = '#d88912';

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
        MuiDialog: {
          styleOverrides: {
            paper: {
              background: academyModalSurface,
              color: academyModalText,
              border: `1px solid ${academyModalBorder}`,
              borderRadius: 20,
              boxShadow: '0 28px 80px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(24px)',
              overflow: 'hidden',
            },
          },
        },
        MuiDialogTitle: {
          styleOverrides: {
            root: {
              background: academyModalHeader,
              color: academyModalText,
              borderBottom: `1px solid ${academyModalDivider}`,
              padding: '18px 24px',
            },
          },
        },
        MuiDialogContent: {
          styleOverrides: {
            root: {
              background: 'transparent',
              color: academyModalText,
            },
          },
        },
        MuiDialogActions: {
          styleOverrides: {
            root: {
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.015))',
              borderTop: `1px solid ${academyModalDivider}`,
              padding: '14px 20px 18px',
            },
          },
        },
        MuiBackdrop: {
          styleOverrides: {
            root: {
              backgroundColor: 'rgba(3, 7, 13, 0.72)',
              backdropFilter: 'blur(14px)',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              background: academyModalSurface,
              color: academyModalText,
              border: `1px solid ${academyModalBorder}`,
              borderRadius: 16,
              boxShadow: '0 22px 60px rgba(0,0,0,0.45)',
            },
          },
        },
        MuiPopover: {
          styleOverrides: {
            paper: {
              background: academyModalSurface,
              color: academyModalText,
              border: `1px solid ${academyModalBorder}`,
              borderRadius: 16,
              boxShadow: '0 22px 60px rgba(0,0,0,0.45)',
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
          'body.academy-route .MuiDialog-paper, body.academy-route .MuiMenu-paper, body.academy-route .MuiPopover-paper': {
            background: `${academyModalSurface} !important`,
            color: `${academyModalText} !important`,
            border: `1px solid ${academyModalBorder}`,
            boxShadow: '0 28px 80px rgba(0,0,0,0.5) !important',
            backdropFilter: 'blur(24px)',
          },
          'body.academy-route .MuiDialogTitle-root': {
            background: `${academyModalHeader} !important`,
            color: `${academyModalText} !important`,
            borderBottom: `1px solid ${academyModalDivider}`,
            padding: '18px 24px !important',
          },
          'body.academy-route .MuiDialogContent-root': {
            background: 'transparent !important',
            color: `${academyModalText} !important`,
          },
          'body.academy-route .MuiDialogActions-root': {
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.015)) !important',
            borderTop: `1px solid ${academyModalDivider}`,
            padding: '14px 20px 18px !important',
          },
          'body.academy-route .MuiDialog-paper .MuiPaper-root': {
            background: `${academyModalSection} !important`,
            color: `${academyModalText} !important`,
            border: `1px solid ${academyModalBorder}`,
            boxShadow: 'none !important',
          },
          'body.academy-route .MuiDialog-paper .MuiTypography-root, body.academy-route .MuiMenu-paper .MuiTypography-root, body.academy-route .MuiPopover-paper .MuiTypography-root': {
            color: 'inherit',
          },
          'body.academy-route .MuiDialog-paper .MuiOutlinedInput-root, body.academy-route .MuiDialog-paper .MuiFilledInput-root, body.academy-route .MuiDialog-paper .MuiInputBase-root, body.academy-route .MuiMenu-paper .MuiOutlinedInput-root, body.academy-route .MuiPopover-paper .MuiOutlinedInput-root': {
            backgroundColor: `${academyModalField} !important`,
            color: `${academyModalText} !important`,
            borderRadius: '12px',
          },
          'body.academy-route .MuiDialog-paper .MuiOutlinedInput-root:hover, body.academy-route .MuiDialog-paper .MuiFilledInput-root:hover, body.academy-route .MuiDialog-paper .MuiInputBase-root:hover, body.academy-route .MuiMenu-paper .MuiOutlinedInput-root:hover, body.academy-route .MuiPopover-paper .MuiOutlinedInput-root:hover': {
            backgroundColor: `${academyModalFieldHover} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiInputLabel-root, body.academy-route .MuiDialog-paper .MuiFormLabel-root, body.academy-route .MuiMenu-paper .MuiInputLabel-root, body.academy-route .MuiPopover-paper .MuiInputLabel-root': {
            color: `${academyModalTextSecondary} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiOutlinedInput-notchedOutline, body.academy-route .MuiDialog-paper .MuiFilledInput-root:before, body.academy-route .MuiDialog-paper .MuiFilledInput-root:after, body.academy-route .MuiMenu-paper .MuiOutlinedInput-notchedOutline, body.academy-route .MuiPopover-paper .MuiOutlinedInput-notchedOutline': {
            borderColor: `${academyModalFieldBorder} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline, body.academy-route .MuiMenu-paper .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline, body.academy-route .MuiPopover-paper .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: `${academyModalAccent} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiSelect-icon, body.academy-route .MuiDialog-paper .MuiSvgIcon-root, body.academy-route .MuiMenu-paper .MuiSvgIcon-root, body.academy-route .MuiPopover-paper .MuiSvgIcon-root': {
            color: 'inherit',
          },
          'body.academy-route .MuiDialog-paper .MuiCheckbox-root, body.academy-route .MuiDialog-paper .MuiRadio-root, body.academy-route .MuiDialog-paper .MuiSwitch-switchBase, body.academy-route .MuiMenu-paper .MuiCheckbox-root': {
            color: `${academyModalTextSecondary} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiCheckbox-root.Mui-checked, body.academy-route .MuiDialog-paper .MuiRadio-root.Mui-checked, body.academy-route .MuiDialog-paper .MuiSwitch-switchBase.Mui-checked, body.academy-route .MuiMenu-paper .MuiCheckbox-root.Mui-checked': {
            color: `${academyModalAccent} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiButton-contained, body.academy-route .MuiMenu-paper .MuiButton-contained, body.academy-route .MuiPopover-paper .MuiButton-contained': {
            background: `linear-gradient(135deg, ${academyModalAccent}, ${academyModalAccentStrong}) !important`,
            color: '#111722 !important',
          },
          'body.academy-route .MuiDialog-paper .MuiButton-outlined, body.academy-route .MuiMenu-paper .MuiButton-outlined, body.academy-route .MuiPopover-paper .MuiButton-outlined': {
            borderColor: `${academyModalAccent}55 !important`,
            color: `${academyModalAccent} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiButton-text, body.academy-route .MuiMenu-paper .MuiButton-text, body.academy-route .MuiPopover-paper .MuiButton-text': {
            color: `${academyModalTextSecondary} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiChip-root, body.academy-route .MuiMenu-paper .MuiChip-root, body.academy-route .MuiPopover-paper .MuiChip-root': {
            background: 'rgba(255,255,255,0.06) !important',
            color: `${academyModalText} !important`,
            border: `1px solid ${academyModalBorder}`,
          },
          'body.academy-route .MuiDialog-paper .MuiDivider-root, body.academy-route .MuiMenu-paper .MuiDivider-root, body.academy-route .MuiPopover-paper .MuiDivider-root': {
            borderColor: `${academyModalDivider} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiLinearProgress-root': {
            backgroundColor: 'rgba(255,255,255,0.08) !important',
          },
          'body.academy-route .MuiDialog-paper .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${academyModalAccent}, ${academyModalAccentStrong}) !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiMenuItem-root, body.academy-route .MuiMenu-paper .MuiMenuItem-root, body.academy-route .MuiPopover-paper .MuiMenuItem-root': {
            color: `${academyModalText} !important`,
          },
          'body.academy-route .MuiDialog-paper .MuiMenuItem-root.Mui-selected, body.academy-route .MuiMenu-paper .MuiMenuItem-root.Mui-selected, body.academy-route .MuiPopover-paper .MuiMenuItem-root.Mui-selected': {
            backgroundColor: 'rgba(245,166,35,0.14) !important',
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
