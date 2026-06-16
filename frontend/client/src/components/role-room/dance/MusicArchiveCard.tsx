/**
 * MusicArchiveCard — visuelt musikk-arkiv-kort for "music"-fanen i
 * DanceWorkspace. Porter overlay-designet (rr-dance-musikk): spor-liste med
 * nummer, tittel, komponist/artist, waveform, BPM og varighet, + footer
 * «N spor klare for innøving».
 *
 * Ren presentasjon over eksisterende dance_music_archive (mig 0069) —
 * ingen migrasjon nødvendig. Leser DanceMusicArchiveItem[].
 */

import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import LibraryMusicOutlinedIcon from '@mui/icons-material/LibraryMusicOutlined';
import QueueMusicOutlinedIcon from '@mui/icons-material/QueueMusicOutlined';
import { danceFlowColors } from './danceFlowTheme';
import type { DanceMusicArchiveItem } from './danceAdminOpsService';

const ACCENT = danceFlowColors.lavender;
const ACCENT_DEEP = danceFlowColors.lavenderDeep;
const MUTED = 'rgba(229,231,235,0.55)';

function fmtDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Deterministiske waveform-høyder (0.3–1) fra en streng — stabil per spor. */
function waveform(seed: string, bars = 18): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(0.3 + (h % 1000) / 1000 * 0.7);
  }
  return out;
}

function Wave({ seed }: { seed: string }): React.ReactElement {
  const bars = waveform(seed);
  return (
    <Stack direction="row" alignItems="flex-end" spacing={0.4} sx={{ height: 30 }}>
      {bars.map((v, i) => (
        <Box key={i} sx={{
          width: 3, height: `${Math.round(v * 100)}%`, borderRadius: 1,
          background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT_DEEP})`,
        }} />
      ))}
    </Stack>
  );
}

export interface MusicArchiveCardProps {
  tracks: DanceMusicArchiveItem[];
  title?: string;
  subtitle?: string;
  /** Maks antall spor å vise i kortet. */
  limit?: number;
}

export function MusicArchiveCard({ tracks, title, subtitle, limit = 6 }: MusicArchiveCardProps): React.ReactElement | null {
  if (!tracks.length) return null;
  const shown = tracks.slice(0, limit);
  const cleared = tracks.filter((t) => t.tonoStatus === 'cleared').length;

  return (
    <Box
      data-testid="music-archive-card"
      sx={{
        position: 'relative', bgcolor: danceFlowColors.bgCard,
        border: `1px solid ${danceFlowColors.borderStrong}`, borderRadius: 3,
        p: { xs: 2.5, md: 3.5 }, maxWidth: 720,
        background: `radial-gradient(620px 300px at 92% -10%, rgba(167,139,250,0.10), transparent 60%), ${danceFlowColors.bgCard}`,
      }}
    >
      {/* Brand-rad */}
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`, color: '#fff', fontWeight: 800, fontSize: 20 }}>R</Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 }}>THE ROLE ROOM</Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: ACCENT }}>DANS</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
        <LibraryMusicOutlinedIcon sx={{ fontSize: 17, color: ACCENT }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: ACCENT }}>MUSIKK-ARKIV</Typography>
      </Stack>
      <Typography sx={{ fontSize: { xs: 28, md: 36 }, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>
        {title ?? 'Musikk-arkiv'}
      </Typography>
      <Typography sx={{ fontSize: 15, color: danceFlowColors.lavenderLight, mt: 0.5 }}>
        {subtitle ?? `${tracks.length} spor i biblioteket`}
      </Typography>

      {/* Spor-liste */}
      <Stack spacing={1.25} sx={{ mt: 3 }}>
        {shown.map((t, i) => (
          <Stack
            key={t.id}
            data-testid={`music-track-${t.id}`}
            direction="row" alignItems="center" spacing={2}
            sx={{ p: 1.75, borderRadius: 2, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.04)' }}
          >
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: ACCENT, width: 22, flex: 'none', textAlign: 'center' }}>{i + 1}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{t.title}</Typography>
              {t.composer ? <Typography noWrap sx={{ fontSize: 13.5, color: MUTED }}>{t.composer}</Typography> : null}
            </Box>
            <Box sx={{ flex: 'none', display: { xs: 'none', sm: 'block' } }}><Wave seed={t.id + t.title} /></Box>
            <Box sx={{ flex: 'none', textAlign: 'right', minWidth: 64 }}>
              {t.bpm ? (
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>
                  {t.bpm}<Box component="span" sx={{ fontSize: 10, fontWeight: 700, color: MUTED, ml: 0.5 }}>BPM</Box>
                </Typography>
              ) : null}
              <Typography sx={{ fontSize: 13, color: MUTED }}>{fmtDuration(t.durationSec)}</Typography>
            </Box>
          </Stack>
        ))}
      </Stack>

      {/* Footer */}
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${danceFlowColors.borderStrong}` }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flex: 'none', display: 'grid', placeItems: 'center', bgcolor: 'rgba(167,139,250,0.16)', border: `1px solid ${danceFlowColors.borderStrong}` }}>
          <QueueMusicOutlinedIcon sx={{ fontSize: 20, color: ACCENT }} />
        </Box>
        <Typography sx={{ fontSize: 15, color: 'rgba(229,231,235,0.85)' }}>
          <Box component="span" sx={{ fontWeight: 800, color: '#fff' }}>{cleared || tracks.length}</Box>{' '}
          spor klare for innøving
        </Typography>
      </Stack>
    </Box>
  );
}
