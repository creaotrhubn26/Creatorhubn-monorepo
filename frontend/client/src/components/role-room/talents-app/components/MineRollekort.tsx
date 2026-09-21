/**
 * MineRollekort — kortene du er satt opp på, uten å lete etter lenken.
 *
 * Lenken i e-posten er fortsatt hovedveien: en statist har sjelden konto. Men
 * den som HAR konto skal slippe å grave i innboksen etter en lenke hen fikk
 * for tre uker siden — særlig dagen det gjelder.
 *
 * Kortet vises ikke i sin helhet her. Det hører hjemme på /statist/<token>,
 * som er bygget for å leses på settet med én tommel. Dette er inngangen:
 * hvilken produksjon, hvilken scene, når, og hvor.
 */

import { Box, Button, Stack, Typography } from '@mui/material';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import { useEffect, useState } from 'react';

import { palette, radius } from '../theme';
import authSessionService from '../../services/authSessionService';

interface Rollekort {
  id: string;
  token: string;
  person_name: string;
  action: string;
  cue: string | null;
  call_time: string | null;
  response: 'kommer' | 'kan_ikke' | null;
  scene_title: string | null;
  int_ext: string | null;
  project_name: string | null;
  day_date: string | null;
  location_name: string | null;
  location_address: string | null;
}

const tid = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('nb-NO', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;

export default function MineRollekort() {
  const [kort, setKort] = useState<Rollekort[]>([]);
  const [lastet, setLastet] = useState(false);

  useEffect(() => {
    let avbrutt = false;
    void fetch('/api/role-room/talents/me/rollekort', {
      credentials: 'include',
      headers: authSessionService.getAuthHeadersSync(),
    })
      .then(async (r) => (r.ok ? await r.json() : { kort: [] }))
      .then((d) => { if (!avbrutt) { setKort(d?.kort ?? []); setLastet(true); } })
      .catch(() => { if (!avbrutt) setLastet(true); });
    return () => { avbrutt = true; };
  }, []);

  // Tomt er den vanlige tilstanden, og det er ikke en feil: de fleste kort går
  // til folk uten konto. Da er det bedre å ikke vise seksjonen i det hele tatt
  // enn å vise en tom ramme som ser ut som noe mangler.
  if (!lastet || kort.length === 0) return null;

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.2,
        mb: 2.4,
      }}
    >
      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.02rem' }}>
        Dine rollekort
      </Typography>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', mt: 0.3, maxWidth: '58ch' }}>
        Produksjoner du er satt opp på. Kortet viser hva du skal gjøre, når og hvor.
      </Typography>

      <Stack spacing={1.2} sx={{ mt: 1.8 }}>
        {kort.map((k) => (
          <Box key={k.id} sx={{ border: `1px solid ${palette.border}`, borderRadius: radius.md, p: 1.6 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.4}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>
                  {k.project_name ?? 'Produksjon'}
                </Typography>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem', mt: 0.2 }}>
                  {[k.int_ext, k.scene_title].filter(Boolean).join(' · ') || 'Scene'}
                </Typography>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem', mt: 0.6, lineHeight: 1.5 }}>
                  {k.action}
                </Typography>
                <Stack direction="row" spacing={1.4} sx={{ mt: 0.8, flexWrap: 'wrap' }}>
                  {tid(k.call_time) && (
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                      Oppmøte {tid(k.call_time)}
                    </Typography>
                  )}
                  {(k.location_name || k.location_address) && (
                    <Stack direction="row" spacing={0.4} alignItems="center">
                      <PlaceIcon sx={{ fontSize: 15, color: palette.textMuted }} />
                      <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                        {k.location_name ?? k.location_address}
                      </Typography>
                    </Stack>
                  )}
                  {/* Svaret ditt står her fordi det er lett å glemme hva man
                      har sagt — og fordi det kan endres på kortet. */}
                  {k.response && (
                    <Typography
                      sx={{
                        color: k.response === 'kommer' ? palette.success : palette.warning,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      {k.response === 'kommer' ? 'Du har sagt at du kommer' : 'Du har sagt at du ikke kan'}
                    </Typography>
                  )}
                </Stack>
              </Box>
              <Button
                size="small"
                href={`/statist/${k.token}`}
                sx={{ textTransform: 'none', fontWeight: 700, color: palette.accentBright, flexShrink: 0 }}
              >
                Åpne kortet
              </Button>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
