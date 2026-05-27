import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface SignaturePadProps {
  brand: string;
  /** Called with a PNG data-URL when a stroke ends, or null when cleared/empty. */
  onChange: (dataUrl: string | null) => void;
}

/**
 * Selvstendig signatur-pad (HTML canvas, ingen eksterne avhengigheter).
 * Støtter mus, finger og penn via pointer-events.
 */
export default function SignaturePad({ brand, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = brand;
    }
  }, [brand]);

  useEffect(() => {
    setup();
    const onResize = () => setup();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setup]);

  const posOf = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    last.current = posOf(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = posOf(e);
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
    if (empty) setEmpty(false);
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas && !empty) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          borderRadius: 2.5,
          border: '1px dashed',
          borderColor: alpha(brand, 0.45),
          bgcolor: alpha(brand, 0.03),
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
          style={{ width: '100%', height: 170, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        />
        {empty && (
          <Typography
            variant="body2"
            sx={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              textAlign: 'center',
              transform: 'translateY(-50%)',
              color: 'text.disabled',
              pointerEvents: 'none',
              fontStyle: 'italic',
            }}
          >
            Tegn signaturen din her
          </Typography>
        )}
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Bruk mus, finger eller penn.
        </Typography>
        <Button size="small" onClick={clear} disabled={empty} sx={{ textTransform: 'none' }}>
          Tøm
        </Button>
      </Stack>
    </Box>
  );
}
