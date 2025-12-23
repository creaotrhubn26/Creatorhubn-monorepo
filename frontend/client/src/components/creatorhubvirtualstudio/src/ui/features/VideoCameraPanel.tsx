import * as React from 'react';
import { Box, FormControlLabel, Checkbox, Grid, TextField, Typography } from '@mui/material';
import { useActions, useScene } from '@/state/selectors';

function shutterFromAngle(angle: number, fps: number) {
  const exposureTime = angle / 360 / fps; // seconds
  return exposureTime;
}

export default function VideoCameraPanel() {
  const scene = useScene();
  const { updateNode } = useActions();
  const camId =
    scene.selection.find((id) => scene.nodes.find((n) => n.id === id && n.camera)) ||
    scene.nodes.find((n) => n.camera)?.id;
  const cam = scene.nodes.find((n) => n.id === camId);

  const [angle, setAngle] = React.useState(180);
  const [fps, setFps] = React.useState(24);
  const [nd, setNd] = React.useState(0);
  const [focus, setFocus] = React.useState(3);
  const [coc, setCoC] = React.useState(0.03);
  const [filmic, setFilmic] = React.useState(true);

  React.useEffect(() => {
    if (!cam?.camera) return;
    // apply shutter from angle & fps
    const shutter = shutterFromAngle(angle, fps);
    const iso = cam.camera.iso;
    updateNode(cam.id, { camera: { ...cam.camera, shutter, focusDistance: focus, coc } });
    // store video settings in userData (for export or later use)
    updateNode(cam.id, {
      userData: {
        ...(cam.userData || {}),
        video: { shutterAngle: angle, fps, ndStops: nd, filmic },
      } as any,
    });
  }, [angle, fps, nd, filmic]);  

  if (!cam)
    return (
      <Box sx={{ p: 1 }}>
        <Typography color="text.secondary">Select a camera to edit filmic settings.</Typography>
      </Box>
    );

  return (
    <Box sx={{ p: 1 }}>
      <Typography fontWeight={600} fontSize={13} color="#1e293b" gutterBottom>Filmic Settings</Typography>
      <Grid container spacing={1} sx={{ mt: 0.5 }}>
        <Grid item xs={6}>
          <TextField
            size="small"
            label="Shutter Angle"
            type="number"
            value={angle}
            onChange={(e) => setAngle(parseFloat(e.target.value || '180'))}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            size="small"
            label="Frame Rate"
            type="number"
            value={fps}
            onChange={(e) => setFps(parseFloat(e.target.value || '24'))}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            size="small"
            label="ND Stops"
            type="number"
            value={nd}
            onChange={(e) => setNd(parseFloat(e.target.value || '0'))}
          />
        </Grid>
        <Grid item xs={6}>
          <FormControlLabel
            control={<Checkbox checked={filmic} onChange={(e) => setFilmic(e.target.checked)} />}
            label="Filmic curve"
          />
        </Grid>
      </Grid>
      <Grid container spacing={1} sx={{ mt: 1 }}>
        <Grid item xs={6}>
          <TextField
            size="small"
            label="Focus Distance (m)"
            type="number"
            value={focus}
            onChange={(e) => setFocus(parseFloat(e.target.value || '3'))}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            size="small"
            label="CoC (mm)"
            type="number"
            value={coc}
            onChange={(e) => setCoC(parseFloat(e.target.value ||'0.03'))}
          />
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary">
        Shutter is recalculated as angle/(360·fps). Stored in camera.shutter
      </Typography>
    </Box>
  );
}
