import * as React from 'react';
import { Box, Slider, Typography } from '@mui/material';

export default function ModelPoseEditor() {
  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={700}>Pose Editor</Typography>
      <Typography variant="caption" color="text.secondary">
        Head tilt
      </Typography>
      <Slider size="small" min={-45} max={45} defaultValue={0} />
      <Typography variant="caption" color="text.secondary">
        Arm raise
      </Typography>
      <Slider size="small" min={0} max={100} defaultValue={0} />
    </Box>
  );
}
