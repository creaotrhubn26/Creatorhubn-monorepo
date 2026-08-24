/**
 * AvatarCropDialog — velg utsnitt (focal point) for profilbildet.
 *
 * Profilbildet ble tidligere lagret rått som data-URI og vist med
 * `object-fit: cover` sentrert overalt (shell, chat, board, team). Var ikke
 * motivet midt i bildet, ble det feil beskåret — uten mulighet til å justere.
 *
 * Her drar/zoomer brukeren bildet i en rund maske, og vi lagrer SELVE
 * utsnittet (512×512 JPEG). Da blir alle avatar-flater riktige uten at de
 * trenger å kjenne til noe focal point — og filen krymper fra flere MB til
 * ~50–80 kB, som også gjør avatarene raske å laste.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Slider, Stack, Typography, IconButton,
} from '@mui/material';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import RestartAlt from '@mui/icons-material/RestartAlt';
import { ws } from '@/components/workspace/workspaceTheme';

const VIEWPORT = 300;   // px — kvadratisk arbeidsflate i dialogen
const OUTPUT = 512;     // px — lagret avatar (kvadrat)
const MAX_ZOOM = 4;

const AvatarCropDialog: React.FC<{
  open: boolean;
  src: string | null;
  onClose: () => void;
  onConfirm: (dataUrl: string) => void;
}> = ({ open, src, onClose, onConfirm }) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // Nytt bilde → nullstill utsnittet.
  useEffect(() => {
    if (!open) return;
    setNatural(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, src]);

  // Skalering som akkurat dekker masken («cover») før brukerens zoom.
  const baseScale = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const scale = baseScale * zoom;
  const displayW = natural ? natural.w * scale : 0;
  const displayH = natural ? natural.h * scale : 0;

  // Bildet skal alltid dekke masken — klem forskyvningen til kantene.
  const clamp = useCallback((next: { x: number; y: number }) => {
    const maxX = Math.max(0, (displayW - VIEWPORT) / 2);
    const maxY = Math.max(0, (displayH - VIEWPORT) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, [displayW, displayH]);

  useEffect(() => { setOffset((o) => clamp(o)); }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }));
  };
  const endDrag = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z - e.deltaY * 0.0015)));
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !natural || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setBusy(false); return; }
      // Maskens hjørne omregnet til kildebildets koordinater.
      const sx = ((displayW - VIEWPORT) / 2 - offset.x) / scale;
      const sy = ((displayH - VIEWPORT) / 2 - offset.y) / scale;
      const size = VIEWPORT / scale;
      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
      ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT);
      onConfirm(canvas.toDataURL('image/jpeg', 0.9));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"
      PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 800 }}>Juster profilbildet</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1.5 }}>
          Dra bildet for å velge utsnitt, og zoom til det sitter. Slik det ser ut her, vises det overalt.
        </Typography>
        <Box
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          sx={{
            position: 'relative', width: VIEWPORT, height: VIEWPORT, mx: 'auto',
            borderRadius: '50%', overflow: 'hidden', cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            bgcolor: 'rgba(255,255,255,0.04)', border: `2px solid ${ws.accentBorder}`,
            touchAction: 'none', userSelect: 'none',
          }}
        >
          {src && (
            <Box
              component="img"
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e: any) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              sx={{
                position: 'absolute', left: '50%', top: '50%',
                width: displayW || 'auto', height: displayH || 'auto', maxWidth: 'none',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                pointerEvents: 'none',
              }}
            />
          )}
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <ZoomOut sx={{ fontSize: 18, color: ws.textDim }} />
          <Slider
            value={zoom} min={1} max={MAX_ZOOM} step={0.01}
            onChange={(_e, v) => setZoom(Array.isArray(v) ? v[0] : v)}
            aria-label="Zoom"
            sx={{ color: ws.accent }}
          />
          <ZoomIn sx={{ fontSize: 18, color: ws.textDim }} />
          <IconButton size="small" aria-label="Nullstill utsnitt"
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            sx={{ color: ws.textDim }}>
            <RestartAlt sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
        <Button variant="contained" onClick={confirm} disabled={!natural || busy}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
          Bruk utsnittet
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AvatarCropDialog;
