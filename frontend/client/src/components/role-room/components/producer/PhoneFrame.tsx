/**
 * PhoneFrame — gjenbrukbar iPhone-mockup (public/iphone-frame.png) for å vise
 * preview-er konsistent på tvers av publisherne (TikTok, Facebook/IG osv.).
 * Children rendres på den svarte skjermflaten.
 */

import * as React from 'react';
import { Box } from '@mui/material';

export interface PhoneFrameProps {
  children?: React.ReactNode;
  width?: number;
  screenBg?: string;
}

export default function PhoneFrame({ children, width = 240, screenBg = '#000' }: PhoneFrameProps): React.ReactElement {
  return (
    <Box sx={{ position: 'relative', width, flexShrink: 0, aspectRatio: '1086 / 1448' }}>
      <Box component="img" src="/iphone-frame.png" alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }} />
      <Box sx={{ position: 'absolute', top: '4.5%', bottom: '4.5%', left: '7%', right: '7%', borderRadius: '30px', overflow: 'hidden', zIndex: 1, background: screenBg, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Box>
  );
}
