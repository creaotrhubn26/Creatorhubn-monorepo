/**
 * AvailabilityCalendar — Talents «Tilgjengelighet»-kalender.
 *
 * Porter overlay-designet (rr-talents-tilgjengelighet): måneds-rutenett der
 * hver dag er Ledig (grønn) / Opptatt (rød), «TILGJENGELIG FRA <dato>», og en
 * SAMTYKKE-TRYGG-badge. Klikk på en dag veksler status og lagrer via
 * roleRoomTalentsService.updateMyTalent({ availability_calendar }) (mig 0154).
 */

import * as React from 'react';
import { Box, Stack, Typography, Chip, CircularProgress } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FlightTakeoffOutlinedIcon from '@mui/icons-material/FlightTakeoffOutlined';
import { palette, radius } from '../theme';
import { roleRoomTalentsService } from '../../services/roleRoomTalentsService';

type DayStatus = 'available' | 'busy';
type Calendar = Record<string, { status: DayStatus; note?: string }>;

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
const WEEKDAYS = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];

const AVAIL = palette.success;       // grønn — Ledig
const BUSY = palette.danger;         // rød — Opptatt

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface AvailabilityCalendarProps {
  initialCalendar: Calendar;
  /** Skrivebeskyttet (f.eks. demo eller andres profil). */
  readOnly?: boolean;
}

export function AvailabilityCalendar({ initialCalendar, readOnly }: AvailabilityCalendarProps): React.ReactElement {
  const now = React.useMemo(() => new Date(), []);
  const [cal, setCal] = React.useState<Calendar>(initialCalendar ?? {});
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const persist = React.useCallback(async (next: Calendar) => {
    setSaving(true); setError(null);
    const res = await roleRoomTalentsService.updateMyTalent({ availability_calendar: next });
    setSaving(false);
    if (res && typeof res === 'object' && 'error' in res) setError(res.error);
  }, []);

  const toggleDay = (key: string): void => {
    if (readOnly) return;
    setCal((prev) => {
      const cur = prev[key]?.status;
      const next: Calendar = { ...prev };
      if (cur === 'available') next[key] = { status: 'busy' };
      else if (cur === 'busy') delete next[key];
      else next[key] = { status: 'available' };
      void persist(next);
      return next;
    });
  };

  // Grid-oppsett: mandag-først.
  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // «Tilgjengelig fra»: første ledige dag fra og med i dag.
  const todayKey = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const firstAvailable = Object.keys(cal)
    .filter((k) => cal[k].status === 'available' && k >= todayKey)
    .sort()[0];
  const firstAvailableLabel = firstAvailable
    ? (() => { const [y, m, d] = firstAvailable.split('-').map(Number); return `${d}. ${MONTHS[m - 1]}`; })()
    : null;

  const step = (delta: number): void => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; }
    setMonth(m); setYear(y);
  };

  const cardSx = { bgcolor: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: radius.xl, p: { xs: 2.5, md: 3.5 }, maxWidth: 620 };

  return (
    <Box sx={cardSx} data-testid="availability-calendar">
      {/* Brand + samtykke-badge */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{ width: 40, height: 40, borderRadius: radius.md, display: 'grid', placeItems: 'center', background: palette.accentGradient, color: '#fff', fontWeight: 800, fontSize: 19 }}>R</Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: palette.textPrimary, lineHeight: 1 }}>THE ROLE ROOM</Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: palette.accent }}>TALENTS</Typography>
          </Box>
        </Stack>
        <Chip
          icon={<ShieldOutlinedIcon sx={{ fontSize: 16, color: `${palette.accent} !important` }} />}
          label="SAMTYKKE-TRYGG"
          sx={{ bgcolor: 'rgba(168,85,247,0.10)', border: `1px solid ${palette.border}`, color: palette.accent, fontWeight: 800, letterSpacing: '0.1em', fontSize: 11, height: 30 }}
        />
      </Stack>

      {/* Tittel + måned-nav */}
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: palette.accent }}>TILGJENGELIGHET</Typography>
          <Typography sx={{ fontSize: 30, fontWeight: 800, color: palette.textPrimary, textTransform: 'capitalize' }}>
            {MONTHS[month]} {year}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {saving ? <CircularProgress size={16} sx={{ color: palette.accent, mr: 0.5 }} /> : null}
          <Box onClick={() => step(-1)} sx={{ cursor: 'pointer', p: 0.5, borderRadius: radius.sm, color: palette.textSecondary, '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' } }}><ChevronLeftIcon /></Box>
          <Box onClick={() => step(1)} sx={{ cursor: 'pointer', p: 0.5, borderRadius: radius.sm, color: palette.textSecondary, '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' } }}><ChevronRightIcon /></Box>
        </Stack>
      </Stack>

      {/* Ukedager */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
        {WEEKDAYS.map((w) => (
          <Typography key={w} sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: palette.textMuted }}>{w}</Typography>
        ))}
      </Box>

      {/* Dager */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((d, idx) => {
          if (d == null) return <Box key={`b${idx}`} />;
          const key = ymd(year, month, d);
          const status = cal[key]?.status;
          const isToday = key === todayKey;
          const color = status === 'available' ? AVAIL : status === 'busy' ? BUSY : palette.textSecondary;
          const bg = status === 'available' ? 'rgba(34,197,94,0.10)' : status === 'busy' ? 'rgba(239,68,68,0.10)' : 'rgba(168,85,247,0.04)';
          const border = status === 'available' ? 'rgba(34,197,94,0.45)' : status === 'busy' ? 'rgba(239,68,68,0.45)' : palette.border;
          return (
            <Box
              key={key}
              data-testid={`availability-day-${key}`}
              onClick={() => toggleDay(key)}
              sx={{
                position: 'relative', aspectRatio: '1 / 1', borderRadius: radius.md,
                display: 'grid', placeItems: 'center', cursor: readOnly ? 'default' : 'pointer',
                bgcolor: bg, border: `1.5px solid ${isToday ? palette.accentBright : border}`,
                boxShadow: isToday ? `0 0 0 3px rgba(168,85,247,0.18)` : 'none',
                transition: 'background 120ms ease',
                '&:hover': readOnly ? {} : { borderColor: palette.accentBright },
              }}
            >
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: status ? '#fff' : palette.textSecondary }}>{d}</Typography>
              {status ? <Box sx={{ position: 'absolute', bottom: 6, width: 6, height: 6, borderRadius: '50%', bgcolor: color }} /> : null}
            </Box>
          );
        })}
      </Box>

      {/* Legend + tilgjengelig fra */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2} sx={{ mt: 3 }}>
        <Stack direction="row" spacing={2.5}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 14, height: 14, borderRadius: 0.75, border: `1.5px solid rgba(34,197,94,0.55)`, bgcolor: 'rgba(34,197,94,0.12)' }} />
            <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>Ledig</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 14, height: 14, borderRadius: 0.75, border: `1.5px solid rgba(239,68,68,0.55)`, bgcolor: 'rgba(239,68,68,0.12)' }} />
            <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>Opptatt</Typography>
          </Stack>
        </Stack>

        {firstAvailableLabel ? (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2, py: 1.25, borderRadius: radius.lg, bgcolor: 'rgba(168,85,247,0.10)', border: `1px solid ${palette.border}` }}>
            <FlightTakeoffOutlinedIcon sx={{ color: palette.accent }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: palette.accent }}>TILGJENGELIG FRA</Typography>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: palette.textPrimary }}>{firstAvailableLabel}</Typography>
            </Box>
          </Stack>
        ) : null}
      </Stack>

      {error ? <Typography sx={{ fontSize: 12, color: palette.danger, mt: 1.5 }}>{error}</Typography> : null}
      {!readOnly ? (
        <Typography sx={{ fontSize: 12, color: palette.textMuted, mt: 2 }}>
          <CalendarMonthOutlinedIcon sx={{ fontSize: 14, verticalAlign: -2, mr: 0.5 }} />
          Klikk en dag: tom → Ledig → Opptatt. Lagres automatisk.
        </Typography>
      ) : null}
    </Box>
  );
}
