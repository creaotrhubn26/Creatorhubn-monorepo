import React from 'react';
import { Box } from '@mui/material';
import { useAcademyLocale } from './academyLocale';

interface AcademyBrandMarkProps {
  width?: number | { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
}

export default function AcademyBrandMark({ width = { xs: 186, sm: 202 } }: AcademyBrandMarkProps) {
  const { tt } = useAcademyLocale();

  return (
    <Box
      component="img"
      src="/academy-logo-lockup.svg"
      alt={tt('CreatorHub Norge Academy logo', 'CreatorHub Norway Academy logo')}
      sx={{
        width,
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.35))',
      }}
    />
  );
}
