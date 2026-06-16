/**
 * MovementVocabCard — bevegelses-leksikon for "movement_vocab"-fanen.
 * Porter overlay-designet (rr-dance-vokabular): nummerert rutenett av
 * bevegelser med kategori-tag + footer (sesong + antall bevegelser).
 *
 * Ren presentasjon over dance_movement_vocab (mig 0068). Ingen migrasjon.
 */

import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import AccessibilityNewOutlinedIcon from '@mui/icons-material/AccessibilityNewOutlined';
import { danceFlowColors } from './danceFlowTheme';
import type { MovementVocabTerm, VocabCategory } from './danceStudioOpsService';

const ACCENT = danceFlowColors.lavender;
const ACCENT_DEEP = danceFlowColors.lavenderDeep;
const MUTED = 'rgba(229,231,235,0.55)';

const CATEGORY_LABEL: Record<VocabCategory, string> = {
  turn: 'Dreining', leap: 'Sprang', lift: 'Løft', extension: 'Tøyning',
  partnering: 'Partnering', improv: 'Improvisasjon', other: 'Annet',
};

export interface MovementVocabCardProps {
  terms: MovementVocabTerm[];
  seasonLabel?: string;
  limit?: number;
}

export function MovementVocabCard({ terms, seasonLabel, limit = 6 }: MovementVocabCardProps): React.ReactElement | null {
  if (!terms.length) return null;
  const shown = terms.slice(0, limit);

  return (
    <Box
      data-testid="movement-vocab-card"
      sx={{
        position: 'relative', bgcolor: danceFlowColors.bgCard,
        border: `1px solid ${danceFlowColors.borderStrong}`, borderRadius: 3,
        p: { xs: 2.5, md: 3.5 }, maxWidth: 920,
        background: `radial-gradient(700px 320px at 92% -10%, rgba(167,139,250,0.10), transparent 60%), ${danceFlowColors.bgCard}`,
      }}
    >
      {/* Brand-rad */}
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${ACCENT_DEEP}, ${ACCENT})`, color: '#fff', fontWeight: 800, fontSize: 20 }}>R</Box>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 }}>THE ROLE ROOM</Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: ACCENT }}>● DANS</Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
        <MenuBookOutlinedIcon sx={{ fontSize: 17, color: ACCENT }} />
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: ACCENT }}>BEVEGELSES-VOKABULAR</Typography>
      </Stack>
      <Typography sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>Bevegelses-leksikon</Typography>
      <Typography sx={{ fontSize: 15, color: MUTED, mt: 0.75 }}>Felles språk for koreografi, øvingslogg og repetisjoner i salen.</Typography>

      {/* Rutenett */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2, mt: 3 }}>
        {shown.map((t, i) => (
          <Box
            key={t.id}
            data-testid={`vocab-card-${t.id}`}
            sx={{ p: 2.25, borderRadius: 2.5, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.04)', minHeight: 150, display: 'flex', flexDirection: 'column' }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: ACCENT, mb: 1 }}>{String(i + 1).padStart(2, '0')}</Typography>
            <Typography sx={{ fontSize: 21, fontWeight: 800, color: '#fff', lineHeight: 1.12, flex: 1 }}>{t.term}</Typography>
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 1.5, px: 1.25, py: 0.75, borderRadius: 99, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.08)', width: 'fit-content' }}>
              <SellOutlinedIcon sx={{ fontSize: 14, color: ACCENT }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: danceFlowColors.lavenderLight }}>{CATEGORY_LABEL[t.category] ?? t.category}</Typography>
            </Stack>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${danceFlowColors.borderStrong}` }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flex: 'none', display: 'grid', placeItems: 'center', bgcolor: 'rgba(167,139,250,0.16)', border: `1px solid ${danceFlowColors.borderStrong}` }}>
            <AccessibilityNewOutlinedIcon sx={{ fontSize: 20, color: ACCENT }} />
          </Box>
          {seasonLabel ? (
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: ACCENT }}>SESONG</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{seasonLabel}</Typography>
            </Box>
          ) : null}
        </Stack>
        <Typography sx={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', color: MUTED }}>{terms.length} BEVEGELSER</Typography>
      </Stack>
    </Box>
  );
}
