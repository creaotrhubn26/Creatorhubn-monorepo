import * as React from 'react';
import {
  Box,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { useNodes } from '@/state/selectors';
import { setActiveCameraId } from '@/core/services/viewports';

export default function CameraSwitcher() {
  const nodes = useNodes();
  const cams = nodes.filter((n) => n.camera);
  const [id, setId] = React.useState<string>(cams[0]?.id ||'');

  React.useEffect(() => {
    if (!id && cams[0]?.id) setId(cams[0].id);
  }, [cams.length]); // re-evaluate when cameras change

  React.useEffect(() => {
    setActiveCameraId(id || null);
  }, [id]);

  if (cams.length === 0) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography color="text.secondary">No cameras in scene.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Active camera
      </Typography>
      <Select size="small" fullWidth value={id} onChange={(e) => setId(e.target.value)}>
        {cams.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name || c.id}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
