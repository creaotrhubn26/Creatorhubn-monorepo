import type { ReactNode } from 'react';
import { Box } from '@mui/material';

interface ShotInspectorProps {
  width: number;
  maxWidth?: number;
  children: ReactNode;
}

export const ShotInspector = ({ width, maxWidth, children }: ShotInspectorProps) => (
  <Box
    sx={{
      width,
      maxWidth,
      bgcolor: '#1e2536',
      borderLeft: '1px solid #2a3142',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'visible',
      position: 'relative',
    }}
  >
    {children}
  </Box>
);
