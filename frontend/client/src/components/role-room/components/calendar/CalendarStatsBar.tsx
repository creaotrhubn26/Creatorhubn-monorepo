/**
 * CalendarStatsBar — bunn-bar med produksjons-stats + neste hendelse.
 *
 * Viser fire kategori-tall + en fremdrift-progress + neste-hendelse-kort
 * som i designet:
 *
 *   [24 Hendelser] [12 Opptaksdager] [5 Prøvedager] [2 Auditions]
 *                                    [Fremdrift 68% ▓▓▓▓▓░░░]
 *                                    [Neste hendelse: I morgen, 09:00]
 *                                    [Opptak – Studio A]
 *
 * Stats beregnes fra en CalendarEvent[]-liste og en valgfri progress-prosent
 * (typisk avledet fra completed/planlagte hendelser i forelder).
 */

import React, { useMemo } from 'react';
import { Box, Typography, LinearProgress, Tooltip } from '@mui/material';
import {
  Event as EventIcon,
  Movie as MovieIcon,
  Groups as GroupsIcon,
  Theaters as TheatersIcon,
  EventAvailable as NextEventIcon,
} from '@mui/icons-material';
import type { CalendarEvent } from '../../services/castingApiService';
import { formatRelativeNb } from '../../utils/formatRelativeNb';

export interface CalendarStatsBarProps {
  events: CalendarEvent[];
  /** Fremdrift 0-100. Hvis null/undefined, beregnes som past-events/total. */
  progressPct?: number;
}

const PILL_PALETTE = {
  total: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.14)' },
  shooting: { color: '#10b981', bg: 'rgba(16,185,129,0.14)' },
  rehearsal: { color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  audition: { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
  next: { color: '#22d3ee', bg: 'rgba(34,211,238,0.14)' },
};

function uniqueDayCount(events: CalendarEvent[]): number {
  const days = new Set<string>();
  for (const e of events) {
    if (!e.start_time) continue;
    const d = new Date(e.start_time);
    if (Number.isNaN(d.getTime())) continue;
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  return days.size;
}

interface StatPillProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  palette: { color: string; bg: string };
}

const StatPill: React.FC<StatPillProps> = ({ icon, count, label, palette }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 1,
      borderRadius: 1.5,
      bgcolor: palette.bg,
      border: `1px solid ${palette.color}33`,
      minWidth: 120,
      flex: '0 0 auto',
    }}
  >
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 1,
        bgcolor: `${palette.color}22`,
        color: palette.color,
        '& svg': { fontSize: 18 },
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography sx={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, lineHeight: 1 }}>
        {count}
      </Typography>
      <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.68rem', lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Box>
  </Box>
);

export const CalendarStatsBar: React.FC<CalendarStatsBarProps> = ({ events, progressPct }) => {
  const stats = useMemo(() => {
    const shooting = events.filter((e) => e.event_type === 'shooting');
    const rehearsal = events.filter((e) => e.event_type === 'rehearsal');
    const audition = events.filter((e) => e.event_type === 'audition');
    return {
      total: events.length,
      shootingDays: uniqueDayCount(shooting),
      rehearsalDays: uniqueDayCount(rehearsal),
      auditions: audition.length,
    };
  }, [events]);

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.start_time && new Date(e.start_time).getTime() > now)
      .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime())[0];
  }, [events]);

  const computedProgress = useMemo(() => {
    if (typeof progressPct === 'number') return Math.max(0, Math.min(100, progressPct));
    if (events.length === 0) return 0;
    const now = Date.now();
    const past = events.filter((e) => e.start_time && new Date(e.start_time).getTime() <= now).length;
    return Math.round((past / events.length) * 100);
  }, [progressPct, events]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: 1.25,
        p: 1.5,
        bgcolor: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 2,
      }}
    >
      <StatPill icon={<EventIcon />} count={stats.total} label="Hendelser" palette={PILL_PALETTE.total} />
      <StatPill icon={<MovieIcon />} count={stats.shootingDays} label="Opptaksdager" palette={PILL_PALETTE.shooting} />
      <StatPill icon={<GroupsIcon />} count={stats.rehearsalDays} label="Prøvedager" palette={PILL_PALETTE.rehearsal} />
      <StatPill icon={<TheatersIcon />} count={stats.auditions} label="Auditions" palette={PILL_PALETTE.audition} />

      <Box
        sx={{
          flex: 1,
          minWidth: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 1.5,
          py: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 600 }}>
            Fremdrift
          </Typography>
          <Typography sx={{ color: '#a78bfa', fontSize: '0.72rem', fontWeight: 700 }}>
            {computedProgress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={computedProgress}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': {
              bgcolor: computedProgress >= 70 ? '#10b981' : computedProgress >= 40 ? '#a78bfa' : '#f59e0b',
              borderRadius: 3,
            },
          }}
        />
      </Box>

      {nextEvent && (
        <Tooltip title="Klikk for å hoppe til neste hendelse" arrow>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderRadius: 1.5,
              bgcolor: PILL_PALETTE.next.bg,
              border: `1px solid ${PILL_PALETTE.next.color}33`,
              minWidth: 200,
              flex: '0 0 auto',
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 1,
                bgcolor: `${PILL_PALETTE.next.color}22`,
                color: PILL_PALETTE.next.color,
                '& svg': { fontSize: 18 },
              }}
            >
              <NextEventIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.68rem', lineHeight: 1 }}>
                Neste hendelse
              </Typography>
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatRelativeNb(nextEvent.start_time) || 'snart'}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: '0.7rem',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextEvent.title}
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};
