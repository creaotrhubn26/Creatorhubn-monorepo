/**
 * DanceProjectCalendar — wrapper rundt prosjekt-/booking-kalenderen for
 * dans-vertikalen.
 *
 * STATUS: placeholder. I en senere PR vil denne komponenten wrappe
 * `frontend/client/src/components/role-room/components/production/CrewCalendarPanel.tsx`
 * og sende inn:
 *   - en `crewLabel`-token override (slik at "Crew" → "Dansere" via
 *     branding-tokens danceBookingHeader / danceBookingCalendarLabel)
 *   - et roller-filter som bare slipper gjennom roller med
 *     `professionMode === 'dance_*'` eller eksplisitt dancer-tag
 *
 * Vi mounter IKKE CrewCalendarPanel direkte i denne PR'en fordi den krever
 * mye kontekst (project-state, scheduling-store, drag-handlers). Wrappen
 * legges på når dans-vertikalen får en kobling til UniversalDashboard sin
 * project-state.
 *
 * VIKTIG: ingen eksisterende fil under `production/`, `casting/` eller
 * `models/` blir endret. Wrappen bruker komposisjon utenfra.
 */

import React from 'react';
import { Box, Stack, Typography, Chip } from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import type { ProfessionMode } from '../config/professionMode';
import useBrandingSettings from '../hooks/useBrandingSettings';

export interface DanceProjectCalendarProps {
  /** CreatorHub-prosjekt denne kalenderen er scopet til. */
  projectId: string;
  /** Aktiv profession-mode — brukes til å validere at vi faktisk er i
   *  dans-mode før vi rendrer (defensiv guard). */
  professionMode: ProfessionMode;
}

export function DanceProjectCalendar({
  projectId,
  professionMode,
}: DanceProjectCalendarProps): React.ReactElement {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;
  const headerLabel = labels.danceBookingHeader;
  const calendarLabel = labels.danceBookingCalendarLabel;
  const fromCrewNote = labels.danceBookingFromCrewNote;

  return (
    <Box
      data-testid="dance-project-calendar"
      sx={{
        p: 3,
        borderRadius: 2,
        border: '1px dashed rgba(139,92,246,0.3)',
        backgroundColor: 'rgba(139,92,246,0.04)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <CalendarIcon sx={{ color: '#8b5cf6' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {headerLabel} · {calendarLabel}
        </Typography>
        <Chip
          label={professionMode}
          size="small"
          sx={{ ml: 'auto', backgroundColor: 'rgba(139,92,246,0.12)' }}
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {fromCrewNote}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
        Prosjekt: <code>{projectId}</code>
      </Typography>
      {/*
        TODO (neste PR): Mount
        `frontend/client/src/components/role-room/components/production/CrewCalendarPanel.tsx`
        her, med:
          - crewLabel-token override → 'Dansere'
          - filter på roller med professionMode === 'dance_*' eller
            eksplisitt dancer-tag (DancerProfile.dance != null)
          - re-bruk av CrewAvailabilityDrawer for slot-detaljer
        CrewCalendarPanel skal ikke endres — wrappes utenfra.
      */}
    </Box>
  );
}

export default DanceProjectCalendar;
