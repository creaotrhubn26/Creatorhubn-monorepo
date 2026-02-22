import * as React from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { useActions, useScene } from '@/state/selectors';

export default function ModifiersPanel() {
  const scene = useScene();
  const { updateNode } = useActions();
  const id = scene.selection[0];
  const node = scene.nodes.find((n) => n.id === id && n.light);

  const [grid, setGrid] = React.useState(false);
  const [barn, setBarn] = React.useState(false);
  const [gobo, setGobo] = React.useState('');
  const [zoom, setZoom] = React.useState<number | ''>('');

  React.useEffect(() => {
    if (!node?.light) return;
    setZoom(node.light.beam ?? '');
    setGobo(node.light.modifier === 'spot' && node.userData?.goboId ? node.userData?.goboId : '');
  }, [node?.id]); // initialize when selection changes

  const commit = () => {
    if (!node) return;
    const light = { ...node.light!, beam: typeof zoom === 'number' ? zoom : node.light?.beam };
    const userData = { ...(node.userData || {}), grid, barn, goboId: gobo || undefined };
    updateNode(node.id, { light, userData });
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={600} fontSize={13} color="#1e293b" gutterBottom>Light Modifiers</Typography>
      {!node ? (
        <Typography color="text.secondary" variant="body2">
          Select a light to edit modifiers.
        </Typography>
      ) : (
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={grid}
                  onChange={(e) => setGrid(e.target.checked)}
                  onBlur={commit}
                />
              }
              label="Grid"
            />
          </Grid>
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={barn}
                  onChange={(e) => setBarn(e.target.checked)}
                  onBlur={commit}
                />
              }
              label="Barn doors"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              size="small"
              label="Gobo id"
              placeholder="e.g. leaf-01"
              fullWidth
              value={gobo}
              onChange={(e) => setGobo(e.target.value)}
              onBlur={commit}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              size="small"
              label="Zoom / Beam (°)"
              type="number"
              fullWidth
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value ||'0'))}
              onBlur={commit}
            />
          </Grid>
        </Grid>
      )}
      <Typography variant="caption" color="text.secondary">
        Updates selected light's properties immediately.
      </Typography>
    </Box>
  );
}
