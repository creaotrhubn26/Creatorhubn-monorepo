/**
 * AvatarFocalPointEditor — la brukeren justere fokuspunktet på profilbildet.
 *
 * «Smarte løsninger»:
 *  - Auto-forslag: prøver native ansiktsgjenkjenning (window.FaceDetector) når
 *    bildet lastes og setter fokuspunktet på det største ansiktet.
 *  - Manuell finjustering: dra markøren (eller klikk) hvor som helst på bildet.
 *  - Live rund forhåndsvisning viser nøyaktig hvordan avataren beskjæres.
 *
 * Fokuspunktet rapporteres som prosent (0–100) via onChange og lagres på
 * profilen (profile_image_focal_x/y) → brukt som CSS object-position overalt.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { AutoFixHigh, CenterFocusStrong } from '@mui/icons-material';
import {
  detectFaceFocalPoint, focalToObjectPosition, DEFAULT_AVATAR_FOCAL,
} from '../utils/avatarFocalPoint';

export interface AvatarFocalPointEditorProps {
  imageUrl: string;
  focalX: number | null;
  focalY: number | null;
  onChange: (x: number, y: number) => void;
  /** Auto-detekter ansikt første gang bildet lastes hvis fokuspunkt mangler. */
  autoDetectOnLoad?: boolean;
}

const clampPercent = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

export const AvatarFocalPointEditor: React.FC<AvatarFocalPointEditorProps> = ({
  imageUrl, focalX, focalY, onChange, autoDetectOnLoad = true,
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const fx = focalX ?? DEFAULT_AVATAR_FOCAL.x;
  const fy = focalY ?? DEFAULT_AVATAR_FOCAL.y;

  // Ny bilde-URL → nullstill auto-forsøk slik at neste last kan detektere på nytt.
  useEffect(() => { setAutoTried(false); setHint(null); }, [imageUrl]);

  const runDetection = useCallback(async (silent: boolean) => {
    const img = imgRef.current;
    if (!img) return;
    setDetecting(true);
    try {
      const point = await detectFaceFocalPoint(img);
      if (point) {
        onChange(point.x, point.y);
        setHint('Ansikt funnet — fokuspunktet er satt automatisk. Dra for å justere.');
      } else if (!silent) {
        setHint('Fant ikke noe ansikt automatisk. Dra markøren dit du vil ha fokus.');
      }
    } finally {
      setDetecting(false);
    }
  }, [onChange]);

  const handleImageLoad = useCallback(() => {
    if (!autoDetectOnLoad || autoTried) return;
    setAutoTried(true);
    // Kun auto-detekter når brukeren ikke allerede har et lagret fokuspunkt.
    if (focalX == null && focalY == null) {
      void runDetection(true);
    }
  }, [autoDetectOnLoad, autoTried, focalX, focalY, runDetection]);

  const setFromPointer = useCallback((clientX: number, clientY: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = clampPercent(((clientX - rect.left) / rect.width) * 100);
    const y = clampPercent(((clientY - rect.top) / rect.height) * 100);
    onChange(x, y);
  }, [onChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    setFromPointer(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setFromPointer(e.clientX, e.clientY);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  const objectPosition = focalToObjectPosition(fx, fy);

  return (
    <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
      <Stack
        direction="row"
        spacing={2.5}
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        sx={{ width: '100%' }}
      >
        {/* Redigerbart bilde med draggbar fokus-markør */}
        <Box
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          sx={{
            position: 'relative',
            width: 210,
            height: 210,
            borderRadius: 3,
            overflow: 'hidden',
            cursor: dragging ? 'grabbing' : 'crosshair',
            touchAction: 'none',
            border: '1px solid rgba(0,0,0,0.14)',
            boxShadow: '0 0 0 4px rgba(160,48,192,0.14), 0 8px 24px rgba(0,0,0,0.25)',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            ref={imgRef}
            src={imageUrl}
            alt="Profilbilde"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            draggable={false}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                   pointerEvents: 'none' }}
          />
          {/* Mørk overlay-hint + fadenkryss-markør */}
          <Box sx={{
            position: 'absolute',
            left: `${fx}%`,
            top: `${fy}%`,
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '2.5px solid #fff',
            boxShadow: '0 0 0 2px rgba(160,48,192,0.95), 0 2px 10px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '50%',
              width: '110%',
              height: '2px',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.85)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: '50%',
              height: '110%',
              width: '2px',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255,255,255,0.85)',
            },
          }} />
        </Box>

        {/* Live rund forhåndsvisning (slik avataren faktisk vises) */}
        <Stack spacing={0.7} alignItems="center">
          <Box sx={{
            p: 0.7,
            borderRadius: '50%',
            background: 'conic-gradient(from 180deg, #a030c0, #7c3aed, #22d3ee, #a030c0)',
            flexShrink: 0,
          }}>
            <Box sx={{
              width: 96, height: 96, borderRadius: '50%', overflow: 'hidden',
              border: '3px solid #fff',
            }}>
              <Box component="img" src={imageUrl} alt="Forhåndsvisning"
                   sx={{ width: '100%', height: '100%', objectFit: 'cover',
                         objectPosition, display: 'block' }} />
            </Box>
          </Box>
          <Box sx={{
            px: 1.1, py: 0.35, borderRadius: 999,
            bgcolor: 'rgba(160,48,192,0.12)',
            color: '#c084fc',
          }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>Slik vises den</Typography>
          </Box>
        </Stack>
      </Stack>

      <Button
        size="small"
        variant="contained"
        onClick={() => void runDetection(false)}
        disabled={detecting}
        startIcon={detecting ? <CircularProgress size={14} /> : <AutoFixHigh />}
        sx={{
          borderRadius: 999,
          px: 2.5,
          py: 0.7,
          textTransform: 'none',
          fontWeight: 700,
          color: '#fff',
          background: 'linear-gradient(135deg, #a030c0 0%, #7c3aed 100%)',
          boxShadow: '0 4px 14px rgba(160,48,192,0.3)',
          '&:hover': { background: 'linear-gradient(135deg, #b33dd0 0%, #8b5cf6 100%)' },
        }}
      >
        Finn ansikt automatisk
      </Button>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="center"
        sx={{
          width: '100%',
          px: 1.5,
          py: 0.8,
          borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <CenterFocusStrong sx={{ fontSize: 15, color: 'rgba(160,48,192,0.9)', flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" align="center" sx={{ lineHeight: 1.45 }}>
          {hint ?? 'Dra i bildet for å velge hvilken del som skal være i fokus.'}
        </Typography>
      </Stack>
    </Stack>
  );
};

export default AvatarFocalPointEditor;
