import * as React from 'react';
import { Box, Typography } from '@mui/material';

export default function LayoutDocking() {
  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={700}>Layout & Docking</Typography>
      <Typography variant="body2" color="text.secondary">
        Dock/undock panels (placeholder UI).
      </Typography>
    </Box>
  );
}
