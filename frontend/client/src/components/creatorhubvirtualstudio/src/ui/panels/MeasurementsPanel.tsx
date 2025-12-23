import * as React from 'react';
import {
  Box,
  Button,
  Divider,
  Grid,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import { useActions, useNodes, useMeasurements, useMeasureMode, useShowLightCones } from '@/state/selectors';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

export default function MeasurementsPanel() {
  const nodes = useNodes();
  const measurements = useMeasurements();
  const measureMode = useMeasureMode();
  const showLightCones = useShowLightCones();
  const { addMeasurementBetween, removeMeasurement, toggleMeasureMode, toggleLightCones } = useActions();
  const [a, setA] = React.useState<string>('');
  const [b, setB] = React.useState<string>('');

  const ids = nodes.map((n) => ({ id: n.id, label: n.name || `${n.type}:${n.id.slice(-4)}` }));

  const addPair = () => {
    if (!a || !b || a === b) return;
    addMeasurementBetween(a, b);
    setA('');
    setB('');
  };

  return (
    <Box sx={{ p: 2, pt: 0 }}>
      <Typography fontWeight={600} fontSize={14} color="#1e293b" gutterBottom>
        Measurements
      </Typography>
      <Stack spacing={1.25}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary">
              Custom pair
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Select
              size="small"
              fullWidth
              value={a}
              onChange={(e) => setA(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>A</em>
              </MenuItem>
              {ids.map((x) => (
                <MenuItem key={x.id} value={x.id}>
                  {x.label}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={6}>
            <Select
              size="small"
              fullWidth
              value={b}
              onChange={(e) => setB(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>B</em>
              </MenuItem>
              {ids.map((x) => (
                <MenuItem key={x.id} value={x.id}>
                  {x.label}
                </MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={12}>
            <Button 
              variant="outlined" 
              onClick={addPair} 
              fullWidth
              sx={{ 
                textTransform: 'none',
                fontSize: 12,
                borderColor: '#d1d5db',
                color: '#0f172a',
                '&:hover': {
                  borderColor: '#94a3b8',
                  bgcolor: '#f8fafc'
                }
              }}
            >
              Add measurement
            </Button>
          </Grid>
        </Grid>

        <Divider />

        <Stack direction="row" spacing={1}>
          <Button
            variant={measureMode ? 'contained' : 'outlined'}
            onClick={toggleMeasureMode}
            fullWidth
            sx={{ 
              textTransform: 'none',
              fontSize: 12,
              ...(measureMode ? {
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
            {measureMode ? 'Exit measure mode' : 'Measure on stage (click 2 points)'}
          </Button>
        </Stack>

        <Divider />

        <Tooltip title="Show/hide light beam visualization in 3D view" placement="top">
          <Button
            variant={showLightCones ? 'contained' : 'outlined'}
            onClick={toggleLightCones}
            fullWidth
            startIcon={<LightbulbOutlinedIcon />}
            sx={{ 
              textTransform: 'none',
              fontSize: 12,
              ...(showLightCones ? {
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
            {showLightCones ? 'Hide Light Cones' : 'Show Light Cones'}
          </Button>
        </Tooltip>

        <Divider />

        <Typography variant="caption" color="text.secondary">
          Existing measurements
        </Typography>
        <Stack spacing={0.75}>
          {measurements.length === 0 ? (
            <Typography color="text.secondary">No measurements yet.</Typography>
          ) : null}
          {measurements.map((m) => (
            <Stack key={m.id} direction="row" spacing={1} alignItems="center">
              <input
                type="color"
                value={m.color || '#2563eb'}
                onChange={(e) => {
                  // mutate via store quickly
                  const ev = new CustomEvent('ch-measure-update', {
                    detail: { id: m.id, color: e.target.value },
                  });
                  window.dispatchEvent(ev as any);
                }}
                style={{ width: 26, height: 26, border: '1px solid #e2e8f0', borderRadius: 4 }}
              />
              <TextField
                size="small"
                placeholder="Label"
                value={m.name || ''}
                onChange={(e) => {
                  const ev = new CustomEvent('ch-measure-update', {
                    detail: { id: m.id, name: e.target.value },
                  });
                  window.dispatchEvent(ev as any);
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {(m.label || m.name) ??
                  `${Math.hypot(m.a[0] - m.b[0], m.a[1] - m.b[1]).toFixed(2)} m`}
              </Typography>
              <Button size="small" color="error" onClick={() => removeMeasurement(m.id)}>
                Remove
              </Button>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
