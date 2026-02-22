import * as React from 'react';
import {
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Stack,
} from '@mui/material';

export default function SnappingToggle() {
  const [grid, setGrid] = React.useState(true);
  const [angle, setAngle] = React.useState(true);
  
  React.useEffect(() => {
    // Dispatch event to notify snapping settings changed
    const event = new CustomEvent('vs-snapping-changed', { 
      detail: { gridSnap: grid, angleSnap: angle } 
    });
    window.dispatchEvent(event);
  }, [grid, angle]);
  
  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={600} fontSize={13} color="#1e293b" gutterBottom>
        Snapping
      </Typography>
      <Stack spacing={0.5}>
        <FormControlLabel
          control={
            <Switch 
              checked={grid} 
              onChange={(e) => setGrid(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2" fontSize={12}>Grid snap</Typography>}
        />
        <FormControlLabel
          control={
            <Switch 
              checked={angle} 
              onChange={(e) => setAngle(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2" fontSize={12}>Angle snap</Typography>}
        />
      </Stack>
    </Box>
  );
}
