import { forwardRef, type ReactNode } from 'react';
import { Box } from '@mui/material';

interface ManuscriptCenterProps {
  isFullscreen: boolean;
  children: ReactNode;
}

export const ManuscriptCenter = forwardRef<HTMLDivElement, ManuscriptCenterProps>(({
  isFullscreen,
  children,
}, ref) => (
  <Box
    ref={ref}
    sx={{
      flex: isFullscreen ? 'auto' : 1,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#0f1318',
      overflow: 'hidden',
      ...(isFullscreen && {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
      }),
    }}
  >
    {children}
  </Box>
));

ManuscriptCenter.displayName = 'ManuscriptCenter';
