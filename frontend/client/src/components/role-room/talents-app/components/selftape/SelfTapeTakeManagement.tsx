/**
 * SelfTapeTakeManagement — radio-list med 5 takes + varigheter
 *
 * Brukes i høyre kolonne (etter Status-cards). Mockup #15: radio-knapper
 * med "Take N · 00:32" og en pille for "valgt" på den aktive.
 */
import { Box, Button, Radio, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { palette, radius } from '../../theme';
import {
  brukSomShowreel,
  formatDuration,
  selectTake,
  type SelftapeTake,
} from '../../../services/roleRoomSelfTapesService';

interface Props {
  takes: SelftapeTake[];
  currentTakeId: string | null;
  onSelect: () => Promise<void> | void;
  onShowreelSatt?: () => void;
}

export default function SelfTapeTakeManagement({
  takes,
  currentTakeId,
  onSelect,
  onShowreelSatt,
}: Props) {
  const [setter, setSetter] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [satt, setSatt] = useState(false);

  const gjørTilShowreel = async (takeId: string) => {
    setSetter(takeId);
    setFeil(null);
    try {
      await brukSomShowreel(takeId);
      setSatt(true);
      onShowreelSatt?.();
    } catch (e) {
      // Ruten sier 409 når opptaket ikke har spillbar video ennå. Si det med
      // ord personen kan handle på.
      setFeil(e instanceof Error ? e.message : 'Klarte ikke å sette showreel');
    } finally {
      setSetter(null);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
          Take-håndtering
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
          {takes.length} totalt
        </Typography>
      </Stack>
      <Stack spacing={0.6}>
        {takes.map((t) => {
          const isCurrent = t.id === currentTakeId;
          return (
            <Box
              key={t.id}
              onClick={async () => {
                if (isCurrent) return;
                await selectTake(t.id);
                await onSelect();
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.2,
                py: 1,
                borderRadius: radius.sm,
                cursor: isCurrent ? 'default' : 'pointer',
                bgcolor: isCurrent ? 'rgba(75, 61, 143,0.12)' : 'transparent',
                border: `1px solid ${isCurrent ? palette.accentBright : 'transparent'}`,
                transition: 'background-color 0.18s, border-color 0.18s',
                '&:hover': isCurrent
                  ? undefined
                  : { bgcolor: 'rgba(75, 61, 143,0.06)' },
              }}
            >
              <Radio
                checked={isCurrent}
                size="small"
                sx={{
                  color: palette.borderStrong,
                  '&.Mui-checked': { color: palette.accentBright },
                  p: 0.4,
                }}
              />
              <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>
                Take {t.take_number}
              </Typography>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                {formatDuration(t.duration_ms)}
              </Typography>
              {isCurrent ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.4}
                  sx={{
                    bgcolor: 'rgba(75, 61, 143,0.22)',
                    color: palette.accentBright,
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    px: 0.8,
                    py: 0.2,
                    borderRadius: 999,
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 12 }} />
                  Valgt
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Stack>

      {/* Casting gjøres på bevegelse og stemme. Et opptak som alt ligger her er
          korteste vei til en showreel for en profil uten — alternativet er at
          den aldri kommer, fordi terskelen for å lage noe nytt er høyere enn
          terskelen for å gjenbruke noe du alt har spilt inn. */}
      {currentTakeId && (
        <Box sx={{ mt: 1.6, pt: 1.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
          <Button
            size="small"
            disabled={setter !== null}
            onClick={() => void gjørTilShowreel(currentTakeId)}
            sx={{ textTransform: 'none', fontWeight: 700, color: palette.accentBright, px: 0 }}
          >
            {satt ? 'Showreel oppdatert' : 'Bruk dette som showreel'}
          </Button>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            {satt
              ? 'Profilen viser dette opptaket nå.'
              : 'Profiler uten showreel blir sjelden valgt — dette tar ett trykk.'}
          </Typography>
          {feil && (
            <Typography sx={{ color: palette.danger, fontSize: '0.78rem', mt: 0.4 }}>
              {feil}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
