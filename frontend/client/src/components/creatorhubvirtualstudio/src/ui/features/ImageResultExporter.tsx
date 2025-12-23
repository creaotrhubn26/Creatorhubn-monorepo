import * as React from 'react';
import { Box, Button, Typography } from'@mui/material';

export default function ImageResultExporter() {
  const exportImg = () => alert('Export rendered image not yet implemented.');
  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={700}>Image Export</Typography>
      <Button variant="outlined" onClick={exportImg}>
        Export PNG
      </Button>
    </Box>
  );
}
