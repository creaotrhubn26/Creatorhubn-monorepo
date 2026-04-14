import type { ReactNode } from 'react';
import { Box } from '@mui/material';

import { useProductionManuscriptContext } from './ProductionManuscriptContext';

interface ShotInspectorProps {
  children: ReactNode;
}

export const ShotInspector = ({ children }: ShotInspectorProps) => {
  const { layout } = useProductionManuscriptContext();

  return (
    <Box
      sx={{
        width: layout.sidebarWidth || 280,
        maxWidth: layout.panelMaxWidth ? layout.sidebarWidth : undefined,
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
};
