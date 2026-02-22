import * as React from 'react';
import {
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { getHistogramCanvas, getActiveCameraId, setOverlayMode } from '@/core/services/viewports';
import { computeHistogramFromCanvas, Histogram } from '@/core/services/image';
import { useScene } from '@/state/selectors';
import { exposureValue } from '@/core/services/photometrics';

function Bars({ hist, color }: { hist: number[]; color: string }) {
  const max = Math.max(1, ...hist);
  return (
    <Box sx={{ display: 'flex', alignItems: 'end', height: 80, gap: '1px' }}>
      {hist.map((v, i) => (
        <div key={i} style={{ width: 1, height: `${(v / max) * 80}px`, background: color }} />
      ))}
    </Box>
  );
}

export default function HistogramPanel() {
  const [hist, setHist] = React.useState<Histogram | null>(null);
  const [auto, setAuto] = React.useState(false);
  const [mode, setMode] = React.useState<'luma' | 'rgb'>('luma');
  const [overlay, setOverlay] = React.useState<'none' | 'zebra' | 'falsecolor' | 'peaking'>('none');
  const scene = useScene();

  const capture = React.useCallback(() => {
    const canvas = getHistogramCanvas();
    if (!canvas) {
      alert('Histogram source not available yet (open 3D preview).');
      return;
    }
    const h = computeHistogramFromCanvas(canvas);
    setHist(h);
  }, []);

  React.useEffect(() => {
    let id: any;
    if (auto) id = setInterval(capture, 500);
    return () => id && clearInterval(id);
  }, [auto, capture]);

  React.useEffect(() => {
    setOverlayMode(overlay);
  }, [overlay]);

  const activeId = getActiveCameraId();
  const camNode = activeId
    ? scene.nodes.find((n) => n.id === activeId)
    : scene.nodes.find((n) => n.camera);
  const cam = camNode?.camera;
  const ev = cam ? exposureValue(cam.aperture, cam.shutter, cam.iso) : undefined;
  const totals = hist
    ? {
        r: hist.r.reduce((a, b) => a + b, 0),
        g: hist.g.reduce((a, b) => a + b, 0),
        b: hist.b.reduce((a, b) => a + b, 0),
        y: hist.luma.reduce((a, b) => a + b, 0),
      }
    : undefined;

  return (
    <Box sx={{ p: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
        <Typography fontWeight={600} fontSize={13} color="#1e293b">Histogram</Typography>
        <Button 
          size="small" 
          variant="outlined" 
          onClick={capture}
          sx={{ 
            textTransform: 'none',
            fontSize: 11,
            borderColor: '#d1d5db',
            color: '#0f172a',
            '&:hover': {
              borderColor: '#94a3b8',
              bgcolor: '#f8fafc'
            }
          }}
        >
          Capture
        </Button>
        <Button
          size="small"
          variant={auto ? 'contained' : 'outlined'}
          onClick={() => setAuto((v) => !v)}
          sx={{ 
            textTransform: 'none',
            fontSize: 11,
            ...(auto ? {
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
          {auto ? 'Auto On' : 'Auto Off'}
        </Button>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}>
          <ToggleButton value="luma">Luma</ToggleButton>
          <ToggleButton value="rgb">RGB</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={overlay}
          onChange={(_, v) => v && setOverlay(v)}
        >
          <ToggleButton value="none">No Overlay</ToggleButton>
          <ToggleButton value="zebra">Zebras</ToggleButton>
          <ToggleButton value="falsecolor">False Color</ToggleButton>
          <ToggleButton value="peaking">Peaking</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Box sx={{ mt: 1, position: 'relative' }}>
        {!hist ? (
          <Box sx={{ height: 80, border: '1px dashed #cbd5e1', borderRadius: 1 }} />
        ) : mode === 'luma' ? (
          <Bars hist={hist.luma} color={'#94a3b8'} />
        ) : (
          <>
            <Bars hist={hist.r} color={'#ef4444'} />
            <Bars hist={hist.g} color={'#22c55e'} />
            <Bars hist={hist.b} color={'#3b82f6'} />
          </>
        )}

        {/* Legend overlay */}
        <Box
          sx={{
            position: 'absolute',
            right: 4,
            bottom: -2,
            bgcolor: 'rgba(255,255,255,0.85)',
            border: '1px solid #e2e8f0',
            borderRadius: 1,
            p: '2px 6px'}}
        >
          <Typography variant="caption" sx={{ display: 'block' }}>
            {totals ? `px: ${totals.y}` : 'px: -'}
            {ev !== undefined ? ` • EV100: ${ev.toFixed(2)}` : ''}
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {mode === 'luma'
          ? 'Luma (Y) distribution from active camera view' : 'Per-channel RGB distributions from active camera view'}
      </Typography>
    </Box>
  );
}
