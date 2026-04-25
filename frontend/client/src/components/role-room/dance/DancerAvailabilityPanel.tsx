/**
 * DancerAvailabilityPanel — wrapper rundt CrewAvailabilityDrawer for
 * dans-vertikalen.
 *
 * STATUS: placeholder med en demo-liste. I en senere PR vil denne
 * komponenten wrappe
 * `frontend/client/src/components/role-room/components/CrewAvailabilityDrawer.tsx`
 * og sende inn et filter som bare slipper gjennom roller med
 * `professionMode === 'dance_*'` eller eksplisitt dancer-tag
 * (DancerProfile.dance != null).
 *
 * Demo-laget viser de første 4 danserne fra DEMO_DANCERS med dummy
 * availability-windows, så vi kan ramme inn UX'en før vi kobler på
 * faktiske booking-data.
 *
 * VIKTIG: ingen eksisterende fil under `production/`, `casting/` eller
 * `models/` blir endret. Wrappen bruker komposisjon utenfra.
 */

import React from 'react';
import { Box, Stack, Typography, Chip, Avatar, Divider } from '@mui/material';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import type { ProfessionMode } from '../config/professionMode';
import useBrandingSettings from '../hooks/useBrandingSettings';
import { DEMO_DANCERS } from './formationTypes';
import type { DancerAvailabilityWindow } from './dancerProfile';
import { getInitials } from './dancerProfile';

export interface DancerAvailabilityPanelProps {
  /** CreatorHub-prosjekt for filteret. */
  projectId?: string;
  /** Aktiv profession-mode — defensiv guard. */
  professionMode: ProfessionMode;
}

interface DemoDancerSlot {
  dancerId: string;
  windows: DancerAvailabilityWindow[];
}

// Demo-tilgjengelighet for de første 4 danserne. Tider er ISO-strenger
// så vi matcher DancerAvailabilityWindow-formatet eksakt.
const DEMO_AVAILABILITY: readonly DemoDancerSlot[] = [
  {
    dancerId: 'd-ingrid',
    windows: [
      { from: '2026-04-26T10:00:00+02:00', to: '2026-04-26T13:00:00+02:00', note: 'Formiddagsblokk' },
      { from: '2026-04-27T17:00:00+02:00', to: '2026-04-27T21:00:00+02:00', note: 'Etter dagjobb' },
    ],
  },
  {
    dancerId: 'd-martin',
    windows: [
      { from: '2026-04-26T09:00:00+02:00', to: '2026-04-26T12:00:00+02:00' },
      { from: '2026-04-28T14:00:00+02:00', to: '2026-04-28T18:00:00+02:00', note: 'Studio 2' },
    ],
  },
  {
    dancerId: 'd-sofie',
    windows: [
      { from: '2026-04-26T18:00:00+02:00', to: '2026-04-26T21:00:00+02:00', note: 'Kveld' },
    ],
  },
  {
    dancerId: 'd-jonas',
    windows: [
      { from: '2026-04-27T09:00:00+02:00', to: '2026-04-27T15:00:00+02:00' },
      { from: '2026-04-28T09:00:00+02:00', to: '2026-04-28T13:00:00+02:00' },
    ],
  },
] as const;

function formatWindow(w: DancerAvailabilityWindow): string {
  // Komprimert ISO-rendering: "26.04 10:00 – 13:00".
  // Forsiktig parsing — hvis input er ugyldig, faller vi tilbake til rå strenger.
  try {
    const from = new Date(w.from);
    const to = new Date(w.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return `${w.from} – ${w.to}`;
    }
    const date = `${String(from.getDate()).padStart(2, '0')}.${String(from.getMonth() + 1).padStart(2, '0')}`;
    const fromTime = `${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}`;
    const toTime = `${String(to.getHours()).padStart(2, '0')}:${String(to.getMinutes()).padStart(2, '0')}`;
    return `${date} ${fromTime} – ${toTime}`;
  } catch {
    return `${w.from} – ${w.to}`;
  }
}

export function DancerAvailabilityPanel({
  projectId,
  professionMode,
}: DancerAvailabilityPanelProps): React.ReactElement {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;
  const headerLabel = labels.danceBookingHeader;
  const availabilityLabel = labels.danceBookingAvailabilityLabel;
  const fromCrewNote = labels.danceBookingFromCrewNote;

  return (
    <Box
      data-testid="dancer-availability-panel"
      sx={{
        p: 3,
        borderRadius: 2,
        border: '1px dashed rgba(139,92,246,0.3)',
        backgroundColor: 'rgba(139,92,246,0.04)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ScheduleIcon sx={{ color: '#8b5cf6' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {headerLabel} · {availabilityLabel}
        </Typography>
        <Chip
          label={professionMode}
          size="small"
          sx={{ ml: 'auto', backgroundColor: 'rgba(139,92,246,0.12)' }}
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {fromCrewNote}
      </Typography>
      {projectId ? (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1 }}>
          Prosjekt: <code>{projectId}</code>
        </Typography>
      ) : null}

      <Divider sx={{ my: 2 }} />

      <Stack spacing={2}>
        {DEMO_AVAILABILITY.map((slot) => {
          const dancer = DEMO_DANCERS.find((d) => d.id === slot.dancerId);
          if (!dancer) return null;
          return (
            <Stack key={slot.dancerId} direction="row" spacing={2} alignItems="flex-start">
              <Avatar
                sx={{
                  bgcolor: dancer.color ?? '#8b5cf6',
                  color: '#fff',
                  width: 36,
                  height: 36,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {dancer.initials || getInitials(dancer.name)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {dancer.name}
                </Typography>
                {dancer.role ? (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {dancer.role}
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5, gap: 0.5 }}>
                  {slot.windows.map((w, i) => (
                    <Chip
                      key={i}
                      size="small"
                      label={w.note ? `${formatWindow(w)} · ${w.note}` : formatWindow(w)}
                      sx={{
                        backgroundColor: 'rgba(16,185,129,0.12)',
                        color: '#10b981',
                        fontSize: '0.72rem',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          );
        })}
      </Stack>

      {/*
        TODO (neste PR): Wrap
        `frontend/client/src/components/role-room/components/CrewAvailabilityDrawer.tsx`
        her, med:
          - filter på roller med professionMode === 'dance_*' eller eksplisitt
            dancer-tag (DancerProfile.dance != null)
          - prosjekt-scoping via projectId
          - demo-listen ovenfor erstattes med faktiske booking-data
        CrewAvailabilityDrawer skal ikke endres — wrappes utenfra.
      */}
    </Box>
  );
}

export default DancerAvailabilityPanel;
