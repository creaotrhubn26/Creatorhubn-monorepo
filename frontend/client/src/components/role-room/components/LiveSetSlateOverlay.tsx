/**
 * LiveSetSlateOverlay.tsx
 *
 * Visuelt klappe-/slate-overlay som vises før eller under opptak.
 * Matcher bransje-standard digital slate-format (Pro Slate, Movie
 * Slate, ScriptE) med scene/take/roll/cam/fps-data.
 *
 * To bruksmodi:
 *   1. Pre-roll: vises 3 sekunder før ROLL trykkes — gir slate
 *      til scriptie/script-supervisor å notere
 *   2. Marker (hotkey 'M'): vises under opptak som sync-marker
 *      for lyd/bilde-sync i post
 *
 * Backend-ready: når CLI-helperen detekterer slate i frame
 * (via OCR), kan den auto-fylle metadata fra denne overlay-en
 * inn i dit_backup_jobs.metadata. Det er v2-arbeid.
 */

import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';

export interface SlateData {
  scene: string;
  take: number;
  cam: string;
  roll?: string;
  fps?: number;
  shutter?: string;
  iso?: number;
  whiteBalance?: number;
  lens?: string;
  date?: string;
  director?: string;
  dop?: string;
}

export interface LiveSetSlateOverlayProps {
  open: boolean;
  data: SlateData;
  /** Auto-dismiss etter N millisekunder (default 4000). 0 = manuell dismiss. */
  autoDismissMs?: number;
  onDismiss: () => void;
}

export default function LiveSetSlateOverlay({
  open,
  data,
  autoDismissMs = 4000,
  onDismiss,
}: LiveSetSlateOverlayProps) {
  const [clapped, setClapped] = useState(false);
  const [countdown, setCountdown] = useState(autoDismissMs / 1000);

  useEffect(() => {
    if (!open) {
      setClapped(false);
      setCountdown(autoDismissMs / 1000);
      return;
    }
    if (autoDismissMs <= 0) return;
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [open, autoDismissMs, onDismiss]);

  // Click + space + esc dismisses
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        if (!clapped) {
          setClapped(true);
          setTimeout(() => onDismiss(), 400);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, clapped, onDismiss]);

  if (!open) return null;

  const dateStr = data.date ?? new Date().toLocaleDateString('nb-NO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <Box
      onClick={() => {
        if (!clapped) {
          setClapped(true);
          setTimeout(() => onDismiss(), 400);
        }
      }}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        bgcolor: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        animation: 'slateFadeIn 0.2s ease-out',
        '@keyframes slateFadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {/* Slate-frame */}
      <Box
        sx={{
          width: { xs: '94vw', sm: 680, md: 820 },
          maxWidth: '94vw',
          aspectRatio: '5 / 3',
          bgcolor: '#0a0a0a',
          border: '4px solid #f8fafc',
          borderRadius: 1,
          boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.18) inset',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Klappe-stripper øverst */}
        <Box
          sx={{
            position: 'relative',
            height: '14%',
            display: 'flex',
            overflow: 'hidden',
            transformOrigin: 'top right',
            transform: clapped ? 'rotateX(0deg)' : 'rotateX(-22deg) translateY(-2px)',
            transition: 'transform 0.35s cubic-bezier(0.6, -0.05, 0.7, 1.4)',
            boxShadow: clapped ? '0 2px 6px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                bgcolor: i % 2 === 0 ? '#f8fafc' : '#0a0a0a',
                borderRight: '2px solid #0a0a0a',
                transform: 'skewX(-18deg)',
                ml: i === 0 ? '-12px' : 0,
                mr: i === 11 ? '-12px' : 0,
              }}
            />
          ))}
        </Box>

        {/* Hoved-info-grid */}
        <Box sx={{ flex: 1, p: { xs: 1.5, md: 2.5 }, display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 1.5 }}>
          {/* SCENE — stort */}
          <Box>
            <Typography sx={slateLabelSx}>SCENE</Typography>
            <Typography sx={{ ...slateValueLargeSx, color: '#ffd700' }}>
              {data.scene || '—'}
            </Typography>
            <Typography sx={{ ...slateLabelSx, mt: 1.5 }}>DATE</Typography>
            <Typography sx={slateValueSx}>{dateStr}</Typography>
          </Box>

          {/* TAKE — størst */}
          <Box sx={{ borderLeft: '2px solid rgba(255,255,255,0.18)', borderRight: '2px solid rgba(255,255,255,0.18)', px: { xs: 1, md: 2 } }}>
            <Typography sx={slateLabelSx}>TAKE</Typography>
            <Typography
              sx={{
                ...slateValueLargeSx,
                fontSize: { xs: '4rem', md: '5.5rem' },
                color: '#fff',
                textAlign: 'center',
                lineHeight: 1,
              }}
            >
              {String(data.take).padStart(2, '0')}
            </Typography>
            <Typography sx={{ ...slateLabelSx, mt: 1.5, textAlign: 'center' }}>CAM</Typography>
            <Typography sx={{ ...slateValueSx, textAlign: 'center' }}>{data.cam}</Typography>
          </Box>

          {/* ROLL + TECH */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography sx={slateLabelSx}>ROLL</Typography>
            <Typography sx={slateValueSx}>{data.roll ?? 'A001'}</Typography>
            {data.fps ? (
              <>
                <Typography sx={{ ...slateLabelSx, mt: 1 }}>FPS</Typography>
                <Typography sx={slateValueSx}>{data.fps}</Typography>
              </>
            ) : null}
            {data.iso ? (
              <>
                <Typography sx={{ ...slateLabelSx, mt: 1 }}>ISO</Typography>
                <Typography sx={slateValueSx}>{data.iso}</Typography>
              </>
            ) : null}
            {data.whiteBalance ? (
              <>
                <Typography sx={{ ...slateLabelSx, mt: 1 }}>WB</Typography>
                <Typography sx={slateValueSx}>{data.whiteBalance}K</Typography>
              </>
            ) : null}
          </Box>
        </Box>

        {/* Bunn-strip: director/dop + countdown */}
        <Box sx={{ borderTop: '2px solid rgba(255,255,255,0.18)', px: { xs: 1.5, md: 2.5 }, py: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          {data.director ? (
            <Box>
              <Typography sx={{ ...slateLabelSx, fontSize: 9 }}>DIR</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: 13 }}>{data.director}</Typography>
            </Box>
          ) : null}
          {data.dop ? (
            <Box>
              <Typography sx={{ ...slateLabelSx, fontSize: 9 }}>DOP</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: 13 }}>{data.dop}</Typography>
            </Box>
          ) : null}
          {data.lens ? (
            <Box>
              <Typography sx={{ ...slateLabelSx, fontSize: 9 }}>LENS</Typography>
              <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: 13 }}>{data.lens}</Typography>
            </Box>
          ) : null}
          <Box sx={{ flex: 1 }} />
          {!clapped ? (
            <Typography sx={{ color: '#fbbf24', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em' }}>
              KLIKK / SPACE FOR CLAP · {countdown}s
            </Typography>
          ) : (
            <Typography sx={{ color: '#86efac', fontWeight: 700, fontSize: 14, letterSpacing: '0.1em' }}>
              ⚡ MARKED
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

const slateLabelSx = {
  color: 'rgba(255,255,255,0.5)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  fontFamily: 'monospace',
};

const slateValueSx = {
  color: '#f8fafc',
  fontSize: { xs: 18, md: 22 },
  fontWeight: 700,
  fontFamily: 'monospace',
  lineHeight: 1.1,
};

const slateValueLargeSx = {
  color: '#f8fafc',
  fontSize: { xs: '2.4rem', md: '3.2rem' },
  fontWeight: 900,
  fontFamily: 'monospace',
  lineHeight: 1.1,
};

/**
 * Stack af slate-data fra LiveSet-state. Bygger SlateData fra
 * scene/take/cam som er aktive akkurat nå.
 */
export function buildSlateFromLiveSet(input: {
  sceneNumber: string | number;
  takeNumber: number;
  cam: string;
  fps?: number;
  iso?: number;
  whiteBalance?: number;
  shutter?: string;
  lens?: string;
  roll?: string;
  director?: string;
  dop?: string;
}): SlateData {
  return {
    scene: String(input.sceneNumber),
    take: input.takeNumber,
    cam: input.cam,
    roll: input.roll,
    fps: input.fps,
    iso: input.iso,
    whiteBalance: input.whiteBalance,
    shutter: input.shutter,
    lens: input.lens,
    director: input.director,
    dop: input.dop,
  };
}
