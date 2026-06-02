// Brand scope for CRM surfaces. Overrides the MUI palette `primary` with the
// active dashboard brand colour (from useTheming/profession or ThemingAdminService)
// so every color="primary" / variant="contained" inside a CRM dialog or drawer
// matches the dashboard branding. Semantic colours (success/error/warning) are
// left untouched — they convey state, not brand.
import React from 'react';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';

export function BrandScope({ brandColor, children }: { brandColor?: string; children: React.ReactNode }) {
  const base = useTheme();
  const theme = React.useMemo(() => {
    if (!brandColor) return base;
    return createTheme(base, { palette: { primary: { main: brandColor } } });
  }, [base, brandColor]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
