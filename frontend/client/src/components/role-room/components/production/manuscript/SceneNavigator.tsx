import type { ReactNode } from 'react';
import { Box, Drawer, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

import { useProductionManuscriptContext } from './ProductionManuscriptContext';

interface SceneNavigatorProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  children: ReactNode;
}

export const SceneNavigator = ({
  mobileOpen,
  onMobileClose,
  children,
}: SceneNavigatorProps) => {
  const { screen, responsive } = useProductionManuscriptContext();

  if (screen.isMobile) {
    return (
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={onMobileClose}
        PaperProps={{
          sx: {
            width: 280,
            bgcolor: '#0f1318',
            borderRight: '1px solid #1e2536',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton onClick={onMobileClose} sx={{ color: '#6b7280' }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        width: responsive.sidebarWidth,
        display: 'flex',
        bgcolor: '#0f1318',
        borderRight: '1px solid #1e2536',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  );
};
