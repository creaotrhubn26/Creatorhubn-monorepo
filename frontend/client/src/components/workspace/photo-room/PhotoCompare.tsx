import React, { useRef, useState } from 'react';
import { Box, Button, Slider, Stack, Typography } from '@mui/material';
import Compare from '@mui/icons-material/Compare';
import ViewColumn from '@mui/icons-material/ViewColumn';
import { ws } from '../workspaceTheme';

interface ComparablePhoto { id: string; filename: string; fullUrl?: string | null; thumbUrl?: string | null }

export default function PhotoCompare({ assets }: { assets: [ComparablePhoto, ComparablePhoto] }) {
  const [mode, setMode] = useState<'side' | 'wipe'>('side');
  const [zoom, setZoom] = useState(1);
  const [wipe, setWipe] = useState(50);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const imageSx = { width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center' } as const;
  const start = (event: React.PointerEvent) => {
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent) => {
    if (!drag.current || zoom <= 1) return;
    setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
  };
  const stop = () => { drag.current = null; };

  return <Stack spacing={1.25}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
      <Button size="small" startIcon={<ViewColumn />} variant={mode === 'side' ? 'contained' : 'outlined'} onClick={() => setMode('side')}>Side ved side</Button>
      <Button size="small" startIcon={<Compare />} variant={mode === 'wipe' ? 'contained' : 'outlined'} onClick={() => setMode('wipe')}>Wipe</Button>
      <Typography sx={{ ml: { sm: 'auto' }, fontSize: 11, color: ws.textDim }}>Synkronisert zoom og panorering</Typography>
      <Slider size="small" min={1} max={4} step={0.25} value={zoom} onChange={(_event, value) => { setZoom(value as number); if (value === 1) setPan({ x: 0, y: 0 }); }} sx={{ width: 150 }} />
    </Stack>
    <Box onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
      sx={{ position: 'relative', height: { xs: 420, md: '68vh' }, minHeight: 360, overflow: 'hidden', bgcolor: '#05070a', borderRadius: `${ws.radiusSm}px`, cursor: zoom > 1 ? 'grab' : 'default' }}>
      {mode === 'side' ? <Stack direction="row" sx={{ height: '100%' }}>
        {assets.map((asset) => <Box key={asset.id} sx={{ width: '50%', minWidth: 0, position: 'relative', overflow: 'hidden', borderRight: `1px solid ${ws.border}` }}>
          <Box component="img" draggable={false} src={asset.fullUrl || asset.thumbUrl || undefined} alt={asset.filename} sx={imageSx} />
          <Typography sx={{ position: 'absolute', left: 8, bottom: 8, px: 1, py: 0.4, bgcolor: 'rgba(0,0,0,.65)', borderRadius: 1, fontSize: 11 }}>{asset.filename}</Typography>
        </Box>)}
      </Stack> : <>
        <Box component="img" draggable={false} src={assets[0].fullUrl || assets[0].thumbUrl || undefined} alt={assets[0].filename} sx={imageSx} />
        <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - wipe}% 0 0)`, overflow: 'hidden' }}>
          <Box component="img" draggable={false} src={assets[1].fullUrl || assets[1].thumbUrl || undefined} alt={assets[1].filename} sx={imageSx} />
        </Box>
        <Box sx={{ position: 'absolute', left: `${wipe}%`, top: 0, bottom: 0, width: 2, bgcolor: ws.accent, pointerEvents: 'none' }} />
      </>}
    </Box>
    {mode === 'wipe' && <Slider min={0} max={100} value={wipe} onChange={(_event, value) => setWipe(value as number)} aria-label="Wipe-posisjon" />}
  </Stack>;
}
