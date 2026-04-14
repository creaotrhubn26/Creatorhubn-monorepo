import type { ReactNode } from 'react';
import { Box, Drawer } from '@mui/material';

import { useProductionManuscriptContext } from './ProductionManuscriptContext';

interface TalentDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const TalentDrawer = ({
  open,
  onClose,
  children,
}: TalentDrawerProps) => {
  const { screen, responsive } = useProductionManuscriptContext();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        'data-testid': 'pmv-talent-drawer',
        sx: {
          width: screen.isMobile ? '85vw' : Math.min(400, responsive.rightPanelWidth),
          maxWidth: screen.isMobile ? '100vw' : responsive.rightPanelWidth,
          bgcolor: '#1a1f2e',
          borderLeft: '1px solid #2a3142',
        },
      }}
    >
      <Box sx={{ p: screen.isMobile ? 2 : 3 }}>
        {children}
      </Box>
    </Drawer>
  );
};
