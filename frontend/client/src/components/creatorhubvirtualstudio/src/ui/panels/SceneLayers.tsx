import * as React from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useActions, useScene } from '@/state/selectors';

export default function SceneLayers() {
  const scene = useScene();
  const { updateNode } = useActions();
  const groups = [
    { type: 'softbox', label: 'Softbox' },
    { type: 'camera', label: 'Camera' },
    { type: 'model', label: 'Model' },
  ] as const;
  const getChecked = (t: string) => scene.nodes.some((n) => n.type === t && n.visible !== false);
  const toggle = (t: string, checked: boolean) => {
    scene.nodes.filter((n) => n.type === t).forEach((n) => updateNode(n.id, { visible: checked }));
  };
  return (
    <Box sx={{ p: 2, pt: 0 }}>
      <Typography fontWeight={600} fontSize={14} color="#1e293b" gutterBottom>
        Scene Layers
      </Typography>
      <Stack spacing={0.5}>
        {groups.map((g) => (
          <FormControlLabel
            key={g.type}
            control={
              <Checkbox
                size="small"
                checked={getChecked(g.type)}
                onChange={(e) => toggle(g.type, e.target.checked)}
                sx={{
                  color: '#64748b',
                  '&.Mui-checked': {
                    color: '#3b82f6',
                  },
                }}
              />
            }
            label={<Typography variant="body2" fontSize={12}>{g.label}</Typography>}
          />
        ))}
      </Stack>
    </Box>
  );
}
