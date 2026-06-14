/**
 * SignaturePad — signér ved å TEGNE med finger/mus, eller SKRIVE navnet ditt
 * (gjengis som håndskrift). Eksponerer get() → { dataUrl (PNG), method }.
 * Brukes både i studioet (eier signerer egen rad) og på delt signeringsside.
 */
import React from 'react';
import { Box, Stack, ToggleButton, ToggleButtonGroup, TextField, Button, Typography } from '@mui/material';
import { Gesture, Keyboard, Backspace } from '@mui/icons-material';

const INK = '#16110b';
export type SignatureValue = { dataUrl: string; method: 'drawn' | 'typed' };
export type SignatureHandle = { get: () => SignatureValue | null; clear: () => void; isEmpty: () => boolean };

const SCRIPT_FONT = "'Snell Roundhand','Segoe Script','Brush Script MT','Bradley Hand',cursive";

const SignaturePad = React.forwardRef<SignatureHandle, { name?: string; accent?: string; height?: number; fieldSx?: any }>(
  ({ name = '', accent = '#FF6B35', height = 130, fieldSx }, ref) => {
    const [mode, setMode] = React.useState<'draw' | 'type'>('draw');
    const [typed, setTyped] = React.useState(name);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const drawing = React.useRef(false);
    const dirty = React.useRef(false);
    const [hasInk, setHasInk] = React.useState(false);

    React.useEffect(() => { if (name && !typed) setTyped(name); }, [name]); // eslint-disable-line

    const setupCanvas = React.useCallback(() => {
      const c = canvasRef.current; if (!c) return;
      const ratio = window.devicePixelRatio || 1;
      const w = c.clientWidth || 400;
      c.width = Math.round(w * ratio); c.height = Math.round(height * ratio);
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    }, [height]);
    React.useEffect(() => { if (mode === 'draw') setupCanvas(); }, [mode, setupCanvas]);

    const point = (e: React.PointerEvent) => {
      const c = canvasRef.current!; const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: React.PointerEvent) => { e.preventDefault(); const ctx = canvasRef.current!.getContext('2d')!; const p = point(e); drawing.current = true; ctx.beginPath(); ctx.moveTo(p.x, p.y); (e.target as Element).setPointerCapture?.(e.pointerId); };
    const moveP = (e: React.PointerEvent) => { if (!drawing.current) return; e.preventDefault(); const ctx = canvasRef.current!.getContext('2d')!; const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true; if (!hasInk) setHasInk(true); };
    const up = () => { drawing.current = false; };
    const clearCanvas = () => { const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); dirty.current = false; setHasInk(false); };

    const renderTyped = (text: string): string => {
      const ratio = 2; const cv = document.createElement('canvas'); cv.width = 440 * ratio; cv.height = 120 * ratio;
      const ctx = cv.getContext('2d')!; ctx.scale(ratio, ratio); ctx.fillStyle = INK;
      ctx.textBaseline = 'middle'; ctx.font = `italic 46px ${SCRIPT_FONT}`;
      ctx.fillText(text, 10, 62, 420);
      return cv.toDataURL('image/png');
    };

    React.useImperativeHandle(ref, () => ({
      get: () => {
        if (mode === 'draw') return dirty.current ? { dataUrl: canvasRef.current!.toDataURL('image/png'), method: 'drawn' } : null;
        const t = (typed || '').trim(); return t ? { dataUrl: renderTyped(t), method: 'typed' } : null;
      },
      clear: () => { clearCanvas(); setTyped(''); },
      isEmpty: () => mode === 'draw' ? !dirty.current : !(typed || '').trim(),
    }), [mode, typed]);

    return (
      <Stack spacing={1}>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}
          sx={{ '& .MuiToggleButton-root': { color: 'rgba(245,242,234,0.6)', borderColor: 'rgba(255,255,255,0.15)', textTransform: 'none', fontSize: '0.76rem', py: 0.4 }, '& .Mui-selected': { color: `${accent} !important`, bgcolor: 'rgba(255,107,53,0.12) !important' } }}>
          <ToggleButton value="draw"><Gesture sx={{ fontSize: 16, mr: 0.5 }} /> Tegn signatur</ToggleButton>
          <ToggleButton value="type"><Keyboard sx={{ fontSize: 16, mr: 0.5 }} /> Skriv navn</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'draw' ? (
          <Box sx={{ position: 'relative', border: '1px dashed rgba(255,255,255,0.25)', borderRadius: '10px', bgcolor: '#fbf9f5', overflow: 'hidden' }}>
            <canvas ref={canvasRef} onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerLeave={up}
              style={{ width: '100%', height, display: 'block', touchAction: 'none', cursor: 'crosshair' }} />
            {!hasInk && <Typography sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.3)', fontSize: '0.82rem', pointerEvents: 'none' }}>Tegn signaturen din her</Typography>}
            <Button size="small" startIcon={<Backspace sx={{ fontSize: '14px !important' }} />} onClick={clearCanvas} sx={{ position: 'absolute', top: 4, right: 4, color: '#999', textTransform: 'none', fontSize: '0.7rem', minWidth: 0 }}>Tøm</Button>
          </Box>
        ) : (
          <Box>
            <TextField fullWidth size="small" label="Skriv navnet ditt" value={typed} onChange={(e) => setTyped(e.target.value)} sx={fieldSx} />
            <Box sx={{ mt: 1, height, border: '1px dashed rgba(255,255,255,0.25)', borderRadius: '10px', bgcolor: '#fbf9f5', display: 'flex', alignItems: 'center', px: 2, overflow: 'hidden' }}>
              <Typography sx={{ fontFamily: SCRIPT_FONT, fontStyle: 'italic', fontSize: '2.2rem', color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{typed || 'Signaturen din'}</Typography>
            </Box>
          </Box>
        )}
      </Stack>
    );
  });
SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;
