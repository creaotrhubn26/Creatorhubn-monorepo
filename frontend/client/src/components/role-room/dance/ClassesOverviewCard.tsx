/**
 * ClassesOverviewCard — klasse-oversikt for "classes"-fanen i DanceWorkspace.
 * Porter overlay-designet (rr-dance-klasser): «Ukens klasser» + klasse-rader
 * (ikon, navn, nivå-chip, dag/tid, elev-antall) + footer «Totalt N påmeldte».
 *
 * Ren presentasjon over dance_class (mig 0068 + level i 0156). enrollmentCount
 * kommer fra listClasses-subquery. Ingen ekstra fetch.
 */

import * as React from 'react';
import { Box, Stack, Typography, Chip } from '@mui/material';
import DirectionsRunOutlinedIcon from '@mui/icons-material/DirectionsRunOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { danceFlowColors } from './danceFlowTheme';
import type { DanceClass } from './danceStudioOpsService';

const ACCENT = danceFlowColors.lavender;
const ACCENT_DEEP = danceFlowColors.lavenderDeep;
const MUTED = 'rgba(229,231,235,0.55)';

const LEVEL_LABEL: Record<string, string> = {
  nybegynner: 'Nybegynner', mellomniva: 'Mellomnivå', viderekomne: 'Viderekomne', alle: 'Alle nivå',
};
const ICON_CYCLE = [DirectionsRunOutlinedIcon, SelfImprovementOutlinedIcon, MusicNoteOutlinedIcon];

export interface ClassesOverviewCardProps {
  classes: DanceClass[];
  studioName?: string;
  seasonLabel?: string;
  limit?: number;
}

export function ClassesOverviewCard({ classes, studioName, seasonLabel, limit = 6 }: ClassesOverviewCardProps): React.ReactElement | null {
  if (!classes.length) return null;
  const shown = classes.slice(0, limit);
  const totalStudents = classes.reduce((sum, c) => sum + (c.enrollmentCount ?? 0), 0);

  return (
    <Box
      data-testid="classes-overview-card"
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
          <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: ACCENT }}>
            DANS{studioName ? ` · ${studioName}` : ''}
          </Typography>
        </Box>
      </Stack>

      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: ACCENT, mb: 0.5 }}>KLASSE-OVERSIKT</Typography>
      <Typography sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>
        Ukens <Box component="span" sx={{ color: ACCENT }}>klasser</Box>
      </Typography>
      {seasonLabel ? (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.5, px: 1.5, py: 0.75, borderRadius: 99, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.06)', width: 'fit-content' }}>
          <AccessTimeOutlinedIcon sx={{ fontSize: 15, color: ACCENT }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{seasonLabel}</Typography>
        </Stack>
      ) : null}

      {/* Klasse-rader */}
      <Stack spacing={1.25} sx={{ mt: 3 }}>
        {shown.map((c, i) => {
          const Icon = ICON_CYCLE[i % ICON_CYCLE.length];
          const levelLabel = c.level ? LEVEL_LABEL[c.level] : null;
          return (
            <Stack
              key={c.id}
              data-testid={`class-row-${c.id}`}
              direction="row" alignItems="center" spacing={2}
              sx={{ p: 1.75, borderRadius: 2, borderLeft: `3px solid ${ACCENT}`, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.04)' }}
            >
              <Box sx={{ width: 44, height: 44, borderRadius: 1.5, flex: 'none', display: 'grid', placeItems: 'center', bgcolor: 'rgba(167,139,250,0.12)', border: `1px solid ${danceFlowColors.borderStrong}` }}>
                <Icon sx={{ fontSize: 22, color: ACCENT }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{c.title}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  {levelLabel ? (
                    <Chip label={levelLabel.toUpperCase()} size="small" sx={{ height: 20, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', bgcolor: 'rgba(167,139,250,0.16)', color: danceFlowColors.lavenderLight }} />
                  ) : null}
                  {c.schedulePattern ? (
                    <Stack direction="row" spacing={0.4} alignItems="center">
                      <AccessTimeOutlinedIcon sx={{ fontSize: 14, color: MUTED }} />
                      <Typography sx={{ fontSize: 13, color: MUTED }}>{c.schedulePattern}</Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </Box>
              <Box sx={{ flex: 'none', textAlign: 'right' }}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{c.enrollmentCount ?? 0}</Typography>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: ACCENT }}>ELEVER</Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>

      {/* Footer */}
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${danceFlowColors.borderStrong}` }}>
        <GroupsOutlinedIcon sx={{ fontSize: 20, color: ACCENT }} />
        <Typography sx={{ fontSize: 15, color: 'rgba(229,231,235,0.85)' }}>
          Totalt <Box component="span" sx={{ fontWeight: 800, color: '#fff' }}>{totalStudents}</Box> påmeldte elever
        </Typography>
      </Stack>
    </Box>
  );
}
