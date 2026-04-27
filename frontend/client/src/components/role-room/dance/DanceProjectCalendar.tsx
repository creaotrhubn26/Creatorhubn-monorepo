/**
 * DanceProjectCalendar — månedsgrid som viser hvilke dansere som er
 * tilgjengelige hver dag basert på `availability_windows` i
 * dancer_profile_extras (migration 0061).
 *
 * Designvalg: vi bruker IKKE CrewCalendarPanel som wrapper. Den er
 * 3000+ linjer film-produksjons-semantikk (regi/kamera/lys/grip…) og
 * passer ikke for en danser-tilgjengelighet-visning. I stedet bygger vi
 * en fokusert komponent som leser direkte fra dance-profil-API.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  IconButton,
  Drawer,
  Divider,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  EventBusy as EventBusyIcon,
} from '@mui/icons-material';
import type { ProfessionMode } from '../config/professionMode';
import useBrandingSettings from '../hooks/useBrandingSettings';
import {
  listDancerProfiles,
  type DancerProfile,
  type DancerAvailabilityWindow,
} from './dancerProfileService';

const PURPLE = '#8b5cf6';
const PURPLE_SOFT = 'rgba(139,92,246,0.12)';

export interface DanceProjectCalendarProps {
  /** Når null/undefined, viser kalenderen alle eierens dansere på tvers av prosjekter. */
  projectId: string | null;
  professionMode: ProfessionMode;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  available: AvailableDancer[];
}

interface AvailableDancer {
  dancerId: string;
  name: string;
  note?: string;
}

/** Returnerer alle tilgjengelighets-vinduer som overlapper [dayStart, dayEnd). */
function dancersAvailableOn(
  profiles: DancerProfile[],
  day: Date,
): AvailableDancer[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const result: AvailableDancer[] = [];
  for (const profile of profiles) {
    const windows: DancerAvailabilityWindow[] = profile.availabilityWindows ?? [];
    let overlap: DancerAvailabilityWindow | undefined;
    for (const w of windows) {
      const from = new Date(w.from);
      const to = new Date(w.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;
      if (from < dayEnd && to > dayStart) {
        overlap = w;
        break;
      }
    }
    if (overlap) {
      result.push({
        dancerId: profile.dancerId,
        name: profile.displayName ?? profile.dancerId,
        note: overlap.note,
      });
    }
  }
  return result;
}

function buildMonthGrid(viewMonth: Date, profiles: DancerProfile[]): DayCell[] {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  // Mandag-først (Norge). getDay(): 0=søn, 1=man… → vi vil ha man=0.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstWeekday);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    cells.push({
      date,
      inMonth: date.getMonth() === viewMonth.getMonth(),
      isToday: key === todayKey,
      available: dancersAvailableOn(profiles, date),
    });
  }
  return cells;
}

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

const MONTH_LABELS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];

export function DanceProjectCalendar({
  projectId,
  professionMode,
}: DanceProjectCalendarProps): React.ReactElement {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;

  const [viewMonth, setViewMonth] = React.useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [profiles, setProfiles] = React.useState<DancerProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedCell, setSelectedCell] = React.useState<DayCell | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listDancerProfiles(projectId ?? undefined)
      .then((rows) => {
        if (cancelled) return;
        setProfiles(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Kunne ikke laste dansere');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const cells = React.useMemo(
    () => buildMonthGrid(viewMonth, profiles),
    [viewMonth, profiles],
  );

  const handlePrev = (): void => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const handleNext = (): void => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const handleToday = (): void => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const monthTitle = `${MONTH_LABELS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  return (
    <Box
      data-testid="dance-project-calendar"
      sx={{
        p: 3,
        borderRadius: 2,
        border: `1px solid ${PURPLE_SOFT}`,
        backgroundColor: 'rgba(139,92,246,0.03)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <CalendarIcon sx={{ color: PURPLE }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {labels.danceBookingHeader} · {labels.danceBookingCalendarLabel}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={professionMode}
          size="small"
          sx={{ backgroundColor: PURPLE_SOFT }}
        />
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={handlePrev} aria-label="Forrige måned">
          <ChevronLeft />
        </IconButton>
        <Typography variant="subtitle1" sx={{ minWidth: 180, fontWeight: 600 }}>
          {monthTitle}
        </Typography>
        <IconButton size="small" onClick={handleNext} aria-label="Neste måned">
          <ChevronRight />
        </IconButton>
        <Tooltip title="Hopp til i dag">
          <IconButton size="small" onClick={handleToday} aria-label="I dag">
            <TodayIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {profiles.length} {profiles.length === 1 ? 'danser' : 'dansere'} i prosjektet
        </Typography>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.5,
          mb: 0.5,
        }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <Typography
            key={label}
            variant="caption"
            sx={{ textAlign: 'center', color: 'text.secondary', fontWeight: 600 }}
          >
            {label}
          </Typography>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.5,
          opacity: loading ? 0.5 : 1,
          pointerEvents: loading ? 'none' : 'auto',
        }}
      >
        {cells.map((cell, idx) => {
          const count = cell.available.length;
          const intensity = Math.min(count / 5, 1);
          return (
            <Box
              key={idx}
              data-testid={`dance-calendar-cell-${cell.date.toISOString().slice(0, 10)}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCell(cell)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedCell(cell);
              }}
              sx={{
                minHeight: 64,
                p: 0.75,
                borderRadius: 1,
                border: cell.isToday ? `1.5px solid ${PURPLE}` : '1px solid transparent',
                backgroundColor: cell.inMonth
                  ? `rgba(139,92,246,${0.04 + intensity * 0.18})`
                  : 'rgba(0,0,0,0.02)',
                color: cell.inMonth ? 'text.primary' : 'text.disabled',
                cursor: 'pointer',
                transition: 'background-color 120ms ease, transform 80ms ease',
                '&:hover': { backgroundColor: 'rgba(139,92,246,0.16)' },
                '&:focus-visible': {
                  outline: `2px solid ${PURPLE}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" sx={{ fontWeight: cell.isToday ? 700 : 500 }}>
                  {cell.date.getDate()}
                </Typography>
                {count > 0 ? (
                  <Chip
                    label={count}
                    size="small"
                    sx={{
                      height: 18,
                      backgroundColor: PURPLE,
                      color: 'white',
                      '& .MuiChip-label': { px: 0.75, fontSize: 11, fontWeight: 600 },
                    }}
                  />
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Box>

      {loading ? (
        <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Stack>
      ) : null}

      {!loading && profiles.length === 0 && !error ? (
        <Stack alignItems="center" spacing={1} sx={{ mt: 3 }}>
          <EventBusyIcon sx={{ color: 'text.disabled' }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Ingen dansere registrert ennå. Legg til danserprofiler for å se tilgjengelighet her.
          </Typography>
        </Stack>
      ) : null}

      <Drawer
        anchor="right"
        open={selectedCell !== null}
        onClose={() => setSelectedCell(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 360 }, p: 2 } }}
      >
        {selectedCell ? (
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CalendarIcon sx={{ color: PURPLE }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {selectedCell.date.toLocaleDateString('nb-NO', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Typography>
            </Stack>
            <Divider />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {labels.danceBookingAvailabilityLabel} ·{' '}
              {selectedCell.available.length}{' '}
              {selectedCell.available.length === 1 ? 'tilgjengelig' : 'tilgjengelige'}
            </Typography>
            {selectedCell.available.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ingen registrert tilgjengelighet denne dagen.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {selectedCell.available.map((d) => (
                  <Box
                    key={d.dancerId}
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      border: `1px solid ${PURPLE_SOFT}`,
                      backgroundColor: 'rgba(139,92,246,0.04)',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {d.name}
                    </Typography>
                    {d.note ? (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {d.note}
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            )}
            {projectId ? (
              <Typography variant="caption" sx={{ color: 'text.disabled', mt: 2 }}>
                Prosjekt: <code>{projectId}</code>
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </Drawer>
    </Box>
  );
}

export default DanceProjectCalendar;
