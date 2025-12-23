import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useActions, useMeasureMode } from '@/state/selectors';

export default function Measurement3DPanel() {
  const { toggleMeasureMode } = useActions();
  const active = useMeasureMode();
  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={600} fontSize={13} color="#1e293b" gutterBottom>3D Measurements</Typography>
      <Button 
        variant={active ? 'contained' : 'outlined'} 
        onClick={toggleMeasureMode}
        fullWidth
        sx={{ 
          textTransform: 'none',
          fontSize: 12,
          ...(active ? {
            bgcolor: '#3b82f6',
            color: '#fff',
            '&:hover': { bgcolor: '#2563eb' }
          } : {
            borderColor: '#d1d5db',
            color: '#0f172a',
            '&:hover': {
              borderColor: '#94a3b8',
              bgcolor: '#f8fafc'
            }
          })
        }}
      >
        {active ? 'Click ground in 3D: pick 2 points' : 'Start 3D measure'}
      </Button>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        Tip: After picking two points on the ground, the tool will save a measurement and exit.
      </Typography>
    </Box>
  );
}
