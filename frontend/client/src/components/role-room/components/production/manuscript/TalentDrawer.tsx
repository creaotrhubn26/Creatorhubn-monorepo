import type { ReactNode } from 'react';
import { Box, Drawer } from '@mui/material';

interface TalentDrawerProps {
  open: boolean;
  isMobile: boolean;
  width: number;
  onClose: () => void;
  children: ReactNode;
}

export const TalentDrawer = ({
  open,
  isMobile,
  width,
  onClose,
  children,
}: TalentDrawerProps) => (
  <Drawer
    anchor="right"
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        width: isMobile ? '85vw' : Math.min(400, width),
        maxWidth: isMobile ? '100vw' : width,
        bgcolor: '#1a1f2e',
        borderLeft: '1px solid #2a3142',
      },
    }}
  >
    <Box sx={{ p: isMobile ? 2 : 3 }}>
      {children}
    </Box>
  </Drawer>
);
