/**
 * DanceProductionCalendar — F8: full produksjons-kalender med rehearsals,
 * performances, classes, auditions og dancer-availability.
 *
 *  • Multi-view: Måned / Uke / Dag / Agenda
 *  • Filter per event-type
 *  • Klikk-tom-dato → quick-create
 *  • Klikk-event → detail-modal
 *  • Drag-and-drop reschedule (måned-view)
 *  • Sidepanel "Kommende denne måneden"
 *  • iCal-eksport
 *  • Ressurs-kollisjons-varsler
 *  • Mobil-drawer + print-stylesheet + recurring-affordance
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  Drawer,
  CircularProgress,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Add as AddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { ProfessionMode } from '../config/professionMode';
import { listDancerProfiles } from './dancerProfileService';
import { listRehearsals, createRehearsal } from './danceRehearsalService';
import { listPerformances, createPerformance } from './danceAdminOpsService';
import { listClasses, createClass } from './danceStudioOpsService';
import {
  KIND_META,
  findCollisions,
  eventsToIcs,
  type CalendarEvent,
  type CalendarEventKind,
} from './calendarTypes';

const PURPLE = '#8b5cf6';
const PURPLE_LIGHT = '#a78bfa';
const PURPLE_SOFT = 'rgba(139,92,246,0.12)';
const ALL_KINDS: readonly CalendarEventKind[] = ['rehearsal', 'performance', 'class', 'audition', 'availability'];
const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const MONTH_LABELS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

export interface DanceProductionCalendarProps {
  projectId: string | null;
  professionMode: ProfessionMode;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isoWeekStart(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
}
function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDateShort(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}
function eventsOnDay(events: readonly CalendarEvent[], day: Date): CalendarEvent[] {
  const s = startOfDay(day).getTime();
  const e = endOfDay(day).getTime();
  return events.filter((ev) => {
    const evStart = new Date(ev.startSec).getTime();
    const evEnd = ev.endSec ? new Date(ev.endSec).getTime() : evStart + 60 * 60_000;
    return evStart < e && evEnd > s;
  });
}

// ─── Komponent ───────────────────────────────────────────────────────────

export function DanceProductionCalendar({
  projectId,
  professionMode,
}: DanceProductionCalendarProps): React.ReactElement {
  const isStudio = professionMode === 'dance_studio';

  // ─── State ──────────────────────────────────────────────────────────
  const [view, setView] = React.useState<ViewMode>('month');
  const [anchorDate, setAnchorDate] = React.useState<Date>(() => startOfDay(new Date()));
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enabledKinds, setEnabledKinds] = React.useState<Set<CalendarEventKind>>(() => new Set(ALL_KINDS));
  const [drawerDay, setDrawerDay] = React.useState<Date | null>(null);
  const [createDay, setCreateDay] = React.useState<Date | null>(null);
  const [createKind, setCreateKind] = React.useState<CalendarEventKind>('rehearsal');
  const [createTitle, setCreateTitle] = React.useState('');
  const [createLocation, setCreateLocation] = React.useState('');
  const [createRecurring, setCreateRecurring] = React.useState<'weekly' | 'monthly' | 'none'>('none');
  const [detailEvent, setDetailEvent] = React.useState<CalendarEvent | null>(null);
  const dragRef = React.useRef<{ event: CalendarEvent; dropDay: Date | null } | null>(null);

  // ─── Fetch all sources ──────────────────────────────────────────────
  const refresh = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [rehearsals, performances, classes, dancers] = await Promise.all([
        listRehearsals({ projectId: projectId ?? undefined, limit: 200 }).catch(() => []),
        listPerformances(projectId ?? null).catch(() => []),
        isStudio ? listClasses(projectId ?? null).catch(() => []) : Promise.resolve([]),
        listDancerProfiles(projectId ?? undefined).catch(() => []),
      ]);

      const all: CalendarEvent[] = [];
      for (const r of rehearsals) {
        all.push({
          id: `reh-${r.id}`,
          sourceId: r.id,
          kind: 'rehearsal',
          title: r.title,
          startSec: r.scheduledAt,
          endSec: new Date(new Date(r.scheduledAt).getTime() + (r.estimatedMinutes ?? 60) * 60_000).toISOString(),
          location: r.location ?? null,
          dancerIds: r.invitedDancerIds,
          roomId: r.location ?? null,
        });
      }
      for (const p of performances) {
        all.push({
          id: `perf-${p.id}`,
          sourceId: p.id,
          kind: 'performance',
          title: p.title,
          startSec: p.performanceDate,
          endSec: null,
          location: p.venue ?? null,
          roomId: p.venue ?? null,
          meta: { capacity: p.capacity, ticketsSold: p.ticketsSold },
        });
      }
      for (const c of classes as Array<{ id: string; title: string; kind?: string; startsAt?: string | null; endsAt?: string | null; description?: string | null }>) {
        if (!c.startsAt) continue;
        const cStart = new Date(c.startsAt);
        if (Number.isNaN(cStart.getTime())) continue;

        // Semester-klasser har lang startsAt→endsAt-spenn. Strekker vi
        // dem som ett event spenner det alle dager mellom — feil for
        // kalender. Vi ekspanderer derfor til ukentlige forekomster
        // INNENFOR visnings-vinduet (denne måneden ± 1 måned).
        const isSemester = c.kind === 'semester';
        const cEnd = c.endsAt ? new Date(c.endsAt) : null;

        if (isSemester && cEnd && cEnd.getTime() - cStart.getTime() > 7 * 86_400_000) {
          // Ekspander til ukentlige occurrences i et 90-dagers vindu rundt nå.
          const windowStart = new Date();
          windowStart.setDate(windowStart.getDate() - 45);
          const windowEnd = new Date();
          windowEnd.setDate(windowEnd.getDate() + 90);
          // Klassens varighet per forekomst = differanse mellom startsAt og endsAt
          // for første forekomst (men siden semester-end er semester-slutt,
          // tar vi en safe default på 90 min).
          const occurrenceDurationMin = 90;
          let cur = new Date(cStart);
          // Hopp fremover til første occurrence i window.
          while (cur < windowStart) cur = new Date(cur.getTime() + 7 * 86_400_000);
          while (cur < windowEnd && cur < cEnd) {
            const occEnd = new Date(cur.getTime() + occurrenceDurationMin * 60_000);
            all.push({
              id: `class-${c.id}-${cur.getTime()}`,
              sourceId: c.id,
              kind: 'class',
              title: c.title,
              startSec: cur.toISOString(),
              endSec: occEnd.toISOString(),
              location: null,
              description: c.description ?? null,
              recurring: 'weekly',
            });
            cur = new Date(cur.getTime() + 7 * 86_400_000);
          }
        } else {
          // Drop-in / workshop / private — én forekomst.
          all.push({
            id: `class-${c.id}`,
            sourceId: c.id,
            kind: 'class',
            title: c.title,
            startSec: c.startsAt,
            endSec: c.endsAt ?? null,
            location: null,
            description: c.description ?? null,
          });
        }
      }
      // Auditions-source er ikke implementert i admin-ops-service ennå —
      // events.audition er reservert for fremtidig wiring.
      // Availability — én event per dag der hver danser har et vindu.
      for (const d of dancers) {
        for (const w of d.availabilityWindows ?? []) {
          if (!w.from || !w.to) continue;
          all.push({
            id: `avail-${d.dancerId}-${w.from}`,
            sourceId: d.dancerId,
            kind: 'availability',
            title: d.displayName ?? d.dancerId,
            startSec: w.from,
            endSec: w.to,
            location: null,
            description: w.note ?? null,
            dancerIds: [d.dancerId],
          });
        }
      }

      setEvents(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste kalender');
    } finally {
      setLoading(false);
    }
  }, [projectId, isStudio]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  // Hide hidden kinds.
  const visibleEvents = React.useMemo(
    () => events.filter((e) => enabledKinds.has(e.kind)),
    [events, enabledKinds],
  );

  // ─── Title / nav helpers ────────────────────────────────────────────
  const goPrev = (): void => setAnchorDate((d) => {
    if (view === 'month') return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    if (view === 'week')  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
    if (view === 'day')   return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    return new Date(d.getFullYear(), d.getMonth() - 1, 1);
  });
  const goNext = (): void => setAnchorDate((d) => {
    if (view === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 1);
    if (view === 'week')  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    if (view === 'day')   return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  });
  const goToday = (): void => setAnchorDate(startOfDay(new Date()));

  const title = (() => {
    if (view === 'month' || view === 'agenda') return `${MONTH_LABELS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    if (view === 'week') {
      const start = isoWeekStart(anchorDate);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return `${formatDateShort(start)}–${formatDateShort(end)} ${anchorDate.getFullYear()}`;
    }
    return anchorDate.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  })();

  // ─── Filter toggle ──────────────────────────────────────────────────
  const toggleKind = (k: CalendarEventKind): void => {
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // ─── iCal-eksport ───────────────────────────────────────────────────
  const exportIcs = (): void => {
    const ics = eventsToIcs(visibleEvents);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dance-calendar-${new Date().toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Quick-create ───────────────────────────────────────────────────
  const openCreate = (day: Date): void => {
    setCreateDay(day);
    setCreateTitle('');
    setCreateLocation('');
    setCreateKind('rehearsal');
    setCreateRecurring('none');
  };
  const submitCreate = async (): Promise<void> => {
    if (!createDay || !createTitle.trim()) return;
    const isoStart = new Date(createDay.getFullYear(), createDay.getMonth(), createDay.getDate(), 18).toISOString();
    try {
      if (createKind === 'rehearsal') {
        await createRehearsal({
          choreographyId: 'unbound',
          title: createTitle.trim(),
          scheduledAt: isoStart,
          location: createLocation || null,
          projectId: projectId ?? null,
        });
      } else if (createKind === 'performance') {
        await createPerformance({
          projectId: projectId ?? null,
          title: createTitle.trim(),
          performanceDate: isoStart,
          venue: createLocation || null,
        });
      } else if (createKind === 'class') {
        await createClass({
          projectId: projectId ?? null,
          title: createTitle.trim(),
          startsAt: isoStart,
        });
      }
      setCreateDay(null);
      void refresh();
    } catch { /* silent */ }
  };

  // ─── Detail-modal handler ───────────────────────────────────────────
  const navToSourceTab = (kind: CalendarEventKind): void => {
    const tabId =
      kind === 'rehearsal' ? 'rehearsal_log' :
      kind === 'performance' ? 'performances' :
      kind === 'class' ? 'classes' :
      kind === 'audition' ? 'reel' :
      'students';
    window.dispatchEvent(new CustomEvent('dance:set-tab', { detail: { tabId } }));
    setDetailEvent(null);
  };

  // ─── Drag-and-drop ──────────────────────────────────────────────────
  const handleDropOnDay = async (event: CalendarEvent, day: Date): Promise<void> => {
    const orig = new Date(event.startSec);
    const newStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), orig.getHours(), orig.getMinutes());
    const isoNew = newStart.toISOString();
    try {
      if (event.kind === 'rehearsal') {
        const { patchRehearsal } = await import('./danceRehearsalService');
        await patchRehearsal(event.sourceId, { scheduledAt: isoNew });
      } else if (event.kind === 'performance') {
        const { patchPerformance } = await import('./danceAdminOpsService');
        await patchPerformance(event.sourceId, { performanceDate: isoNew });
      }
      void refresh();
    } catch { /* silent */ }
  };

  // ─── Renders per view ───────────────────────────────────────────────
  return (
    <Box
      data-testid="dance-production-calendar"
      sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', bgcolor: '#0a0a0a' }}
      className="dance-calendar-root"
    >
      {/* Toolbar — horizontal-scroll på mobil slik at alle knapper er nåbar
          uten å bli klippet. */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          p: { xs: 1, md: 2 },
          borderBottom: `1px solid ${PURPLE_SOFT}`,
          overflowX: 'auto',
          flexShrink: 0,
        }}
        className="dance-calendar-toolbar"
      >
        <CalendarIcon sx={{ color: PURPLE_LIGHT }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff', mr: 1 }}>
          Sesong
        </Typography>
        <IconButton size="small" onClick={goPrev} sx={{ color: PURPLE_LIGHT }} data-testid="calendar-prev">
          <ChevronLeft />
        </IconButton>
        <Typography sx={{ fontSize: 13, color: '#e5e7eb', minWidth: 180, textAlign: 'center' }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={goNext} sx={{ color: PURPLE_LIGHT }} data-testid="calendar-next">
          <ChevronRight />
        </IconButton>
        <Tooltip title="I dag">
          <IconButton size="small" onClick={goToday} sx={{ color: PURPLE_LIGHT }} data-testid="calendar-today">
            <TodayIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={0.25} data-testid="calendar-view-toggle">
          {(['month', 'week', 'day', 'agenda'] as const).map((v) => (
            <Box
              key={v}
              role="tab"
              tabIndex={0}
              aria-selected={view === v}
              onClick={() => setView(v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView(v); } }}
              data-testid={`calendar-view-${v}`}
              sx={{
                cursor: 'pointer', px: 1.2, py: 0.5, fontSize: 10.5, fontWeight: 700, letterSpacing: 1,
                color: view === v ? '#fff' : 'rgba(229,231,235,0.5)',
                bgcolor: view === v ? 'rgba(167,139,250,0.22)' : 'transparent',
                border: `1px solid ${view === v ? PURPLE_LIGHT : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 0.5,
                textTransform: 'uppercase',
              }}
            >
              {v === 'month' ? 'Måned' : v === 'week' ? 'Uke' : v === 'day' ? 'Dag' : 'Agenda'}
            </Box>
          ))}
        </Stack>
        <Tooltip title="Eksporter til kalender (.ics)">
          <IconButton size="small" onClick={exportIcs} data-testid="calendar-export" sx={{ color: PURPLE_LIGHT }}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Skriv ut">
          <IconButton size="small" onClick={() => window.print()} data-testid="calendar-print" sx={{ color: PURPLE_LIGHT }}>
            <PrintIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Filter-row */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: 2, py: 1, borderBottom: `1px solid ${PURPLE_SOFT}`, flexWrap: 'wrap' }}
        useFlexGap
        data-testid="calendar-filters"
        className="dance-calendar-filters"
      >
        {ALL_KINDS.map((k) => {
          const meta = KIND_META[k];
          const on = enabledKinds.has(k);
          return (
            <Box
              key={k}
              component="label"
              data-testid={`calendar-filter-${k}`}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5,
                cursor: 'pointer', fontSize: 11,
                color: on ? meta.color : 'rgba(229,231,235,0.45)',
              }}
            >
              <Checkbox
                size="small"
                checked={on}
                onChange={() => toggleKind(k)}
                inputProps={{ 'data-testid': `calendar-filter-${k}-checkbox` } as React.InputHTMLAttributes<HTMLInputElement>}
                sx={{ p: 0.25, color: meta.color, '&.Mui-checked': { color: meta.color } }}
              />
              {meta.label}
            </Box>
          );
        })}
      </Stack>

      {/* Main + sidepanel */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 260px' }, gap: 0, flex: 1 }}>
        <Box sx={{ p: 2, minHeight: 0 }} className="dance-calendar-main">
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress sx={{ color: PURPLE }} />
            </Stack>
          ) : error ? (
            <Typography sx={{ color: '#fca5a5' }}>{error}</Typography>
          ) : view === 'month' ? (
            <MonthGrid
              anchorDate={anchorDate}
              events={visibleEvents}
              allEvents={events}
              onClickDate={(d) => {
                // Mobile: open drawer; desktop: open create.
                if (window.matchMedia('(max-width: 640px)').matches) {
                  setDrawerDay(d);
                } else {
                  openCreate(d);
                }
              }}
              onClickEvent={(ev) => setDetailEvent(ev)}
              onDropEvent={(ev, d) => void handleDropOnDay(ev, d)}
            />
          ) : view === 'week' ? (
            <WeekView anchorDate={anchorDate} events={visibleEvents} onClickEvent={(ev) => setDetailEvent(ev)} />
          ) : view === 'day' ? (
            <DayView anchorDate={anchorDate} events={visibleEvents} onClickEvent={(ev) => setDetailEvent(ev)} />
          ) : (
            <AgendaView anchorDate={anchorDate} events={visibleEvents} onClickEvent={(ev) => setDetailEvent(ev)} />
          )}
        </Box>

        {/* Sidepanel — Kommende */}
        <Box
          sx={{
            borderLeft: { md: `1px solid ${PURPLE_SOFT}` },
            p: 1.5, display: { xs: 'none', md: 'block' },
          }}
          className="dance-calendar-sidepanel"
          data-testid="calendar-upcoming-sidepanel"
        >
          <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700, mb: 1 }}>
            KOMMENDE DENNE MÅNEDEN
          </Typography>
          <Stack spacing={0.75}>
            {visibleEvents
              .filter((e) => {
                const d = new Date(e.startSec);
                return d.getFullYear() === anchorDate.getFullYear() && d.getMonth() === anchorDate.getMonth() && d >= new Date();
              })
              .sort((a, b) => new Date(a.startSec).getTime() - new Date(b.startSec).getTime())
              .slice(0, 12)
              .map((e) => {
                const meta = KIND_META[e.kind];
                return (
                  <Box
                    key={e.id}
                    data-testid={`upcoming-row-${e.id}`}
                    onClick={() => setDetailEvent(e)}
                    sx={{
                      p: 0.75, borderRadius: 1, cursor: 'pointer',
                      bgcolor: meta.bg, borderLeft: `3px solid ${meta.color}`,
                      '&:hover': { bgcolor: meta.bg.replace('0.18', '0.28') },
                    }}
                  >
                    <Typography sx={{ fontSize: 10, color: meta.color, fontWeight: 700, letterSpacing: 0.5 }}>
                      {new Date(e.startSec).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                      {' · '}
                      {formatTimeShort(e.startSec)}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#fff', fontWeight: 600 }} noWrap>
                      {e.title}
                    </Typography>
                  </Box>
                );
              })}
          </Stack>
        </Box>
      </Box>

      {/* Quick-create dialog */}
      <Dialog
        open={!!createDay}
        onClose={() => setCreateDay(null)}
        PaperProps={{ sx: { bgcolor: '#0f0a1c', color: '#e5e7eb', minWidth: 360 } }}
      >
        <DialogTitle sx={{ color: PURPLE_LIGHT, fontWeight: 700 }}>
          Nytt event {createDay ? `· ${formatDateShort(createDay)}` : ''}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              select
              size="small"
              label="Type"
              value={createKind}
              onChange={(e) => setCreateKind(e.target.value as CalendarEventKind)}
              fullWidth
              inputProps={{ 'data-testid': 'calendar-create-kind' }}
            >
              <MenuItem value="rehearsal">Prøve</MenuItem>
              <MenuItem value="performance">Forestilling</MenuItem>
              {isStudio ? <MenuItem value="class">Klasse</MenuItem> : null}
            </TextField>
            <TextField
              size="small"
              label="Tittel"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              fullWidth
              inputProps={{ 'data-testid': 'calendar-create-title' }}
            />
            <TextField
              size="small"
              label="Sted (valgfri)"
              value={createLocation}
              onChange={(e) => setCreateLocation(e.target.value)}
              fullWidth
              inputProps={{ 'data-testid': 'calendar-create-location' }}
            />
            {createKind === 'class' ? (
              <TextField
                select
                size="small"
                label="Gjentakelse"
                value={createRecurring}
                onChange={(e) => setCreateRecurring(e.target.value as 'weekly' | 'monthly' | 'none')}
                fullWidth
                inputProps={{ 'data-testid': 'calendar-create-recurring' }}
              >
                <MenuItem value="none">Engangs</MenuItem>
                <MenuItem value="weekly">Ukentlig</MenuItem>
                <MenuItem value="monthly">Månedlig</MenuItem>
              </TextField>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDay(null)} sx={{ color: PURPLE_LIGHT }}>Avbryt</Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => void submitCreate()}
            disabled={!createTitle.trim()}
            data-testid="calendar-create-submit"
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' } }}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail modal */}
      <Dialog
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        PaperProps={{ sx: { bgcolor: '#0f0a1c', color: '#e5e7eb', minWidth: 360 } }}
      >
        {detailEvent ? (() => {
          const meta = KIND_META[detailEvent.kind];
          const collisions = findCollisions(detailEvent, events);
          return (
            <>
              <DialogTitle sx={{ color: meta.color, fontWeight: 700 }}>
                {meta.label}: {detailEvent.title}
              </DialogTitle>
              <DialogContent>
                <Stack spacing={1}>
                  <Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>
                    {new Date(detailEvent.startSec).toLocaleString('nb-NO')}
                    {detailEvent.endSec ? ` – ${formatTimeShort(detailEvent.endSec)}` : ''}
                  </Typography>
                  {detailEvent.location ? (
                    <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>📍 {detailEvent.location}</Typography>
                  ) : null}
                  {detailEvent.description ? (
                    <Typography sx={{ fontSize: 11.5, color: '#e5e7eb' }}>
                      {detailEvent.description}
                    </Typography>
                  ) : null}
                  {collisions.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      data-testid="calendar-event-collision-warning"
                      sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)' }}
                    >
                      <WarningIcon sx={{ fontSize: 16, color: '#f87171' }} />
                      <Typography sx={{ fontSize: 11, color: '#fca5a5' }}>
                        Kolliderer med: {collisions.map((c) => c.title).join(', ')}
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDetailEvent(null)} sx={{ color: PURPLE_LIGHT }}>Lukk</Button>
                <Button
                  onClick={() => navToSourceTab(detailEvent.kind)}
                  variant="contained"
                  data-testid="calendar-event-open-tab"
                  sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' } }}
                >
                  Åpne i {meta.label}-tab
                </Button>
              </DialogActions>
            </>
          );
        })() : null}
      </Dialog>

      {/* Mobile drawer */}
      <Drawer
        anchor="bottom"
        open={!!drawerDay}
        onClose={() => setDrawerDay(null)}
        PaperProps={{ sx: { bgcolor: '#0f0a1c', color: '#e5e7eb', borderTopLeftRadius: 12, borderTopRightRadius: 12, p: 2 } }}
      >
        {drawerDay ? (
          <>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>
                {drawerDay.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Typography>
              <IconButton size="small" onClick={() => setDrawerDay(null)} sx={{ color: '#9ca3af' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Stack spacing={0.5} data-testid="calendar-mobile-drawer">
              {eventsOnDay(visibleEvents, drawerDay).map((e) => {
                const meta = KIND_META[e.kind];
                return (
                  <Box
                    key={e.id}
                    sx={{ p: 1, borderRadius: 1, bgcolor: meta.bg, borderLeft: `3px solid ${meta.color}` }}
                    onClick={() => { setDetailEvent(e); setDrawerDay(null); }}
                  >
                    <Typography sx={{ fontSize: 11, color: meta.color, fontWeight: 700 }}>
                      {formatTimeShort(e.startSec)} · {meta.label}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#fff' }}>{e.title}</Typography>
                  </Box>
                );
              })}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => { openCreate(drawerDay); setDrawerDay(null); }}
                sx={{ mt: 1, textTransform: 'none', color: PURPLE_LIGHT, borderColor: PURPLE_SOFT }}
              >
                Nytt event her
              </Button>
            </Stack>
          </>
        ) : null}
      </Drawer>

      {/* Print stylesheet — usynlig i UI, virker bare ved utskrift */}
      <style>{`
        @media print {
          .dance-calendar-toolbar, .dance-calendar-filters, .dance-calendar-sidepanel { display: none !important; }
          .dance-calendar-root { background: #fff !important; color: #000 !important; }
          .dance-calendar-main { padding: 0 !important; }
        }
      `}</style>
    </Box>
  );
}

// ─── Sub-views ───────────────────────────────────────────────────────────

interface MonthGridProps {
  anchorDate: Date;
  events: readonly CalendarEvent[];
  allEvents: readonly CalendarEvent[]; // for collision-detect
  onClickDate: (d: Date) => void;
  onClickEvent: (e: CalendarEvent) => void;
  onDropEvent: (e: CalendarEvent, day: Date) => void;
}

const MonthGrid: React.FC<MonthGridProps> = ({ anchorDate, events, allEvents, onClickDate, onClickEvent, onDropEvent }) => {
  const today = new Date();
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstWeekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  return (
    <Box data-testid="calendar-month-grid">
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5 }}>
        {WEEKDAY_LABELS.map((wd) => (
          <Typography key={wd} sx={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}>
            {wd.toUpperCase()}
          </Typography>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === anchorDate.getMonth();
          const isToday = isSameDay(d, today);
          const dayEvents = eventsOnDay(events, d);
          const collisionFlag = dayEvents.some((ev) => findCollisions(ev, allEvents).length > 0);
          return (
            <Box
              key={i}
              data-testid={`calendar-day-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`}
              onClick={(e) => {
                // Bare reager hvis klikket ikke kom fra et event-element.
                const target = e.target as HTMLElement;
                if (target.closest('[data-event-id]')) return;
                onClickDate(d);
              }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/event-id');
                const ev = events.find((x) => x.id === id);
                if (ev) onDropEvent(ev, d);
              }}
              sx={{
                // Compact på mobil — celler kan bli 40-50px brede når 7
                // celler deler 350px-viewport. Sett minHeight responsiv
                // og skjul event-tekster til ren prikk-indikator på små
                // viewports (klikk åpner mobil-drawer som viser detaljene).
                minHeight: { xs: 48, sm: 72, md: 96 },
                p: { xs: 0.25, md: 0.5 },
                borderRadius: 0.5,
                border: `1px solid ${isToday ? PURPLE_LIGHT : 'rgba(255,255,255,0.06)'}`,
                bgcolor: inMonth ? '#0f1318' : 'rgba(255,255,255,0.01)',
                opacity: inMonth ? 1 : 0.45,
                cursor: 'pointer',
                position: 'relative',
                '&:hover': { borderColor: PURPLE_LIGHT },
              }}
            >
              <Stack direction="row" alignItems="center" sx={{ mb: 0.25 }}>
                <Typography sx={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? PURPLE_LIGHT : '#e5e7eb', flex: 1 }}>
                  {d.getDate()}
                </Typography>
                {collisionFlag ? (
                  <Tooltip title="Ressurs-kollisjon">
                    <WarningIcon sx={{ fontSize: 12, color: '#f87171' }} />
                  </Tooltip>
                ) : null}
              </Stack>
              <Stack spacing={0.25}>
                {/* På mobil: bare farge-prikker (klikk åpner drawer).
                    På desktop: full event-tekst. */}
                <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 0.25, flexWrap: 'wrap' }}>
                  {dayEvents.slice(0, 6).map((ev) => {
                    const meta = KIND_META[ev.kind];
                    return (
                      <Box
                        key={ev.id}
                        data-testid={`calendar-event-${ev.id}`}
                        sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: meta.color }}
                      />
                    );
                  })}
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.25 }}>
                  {dayEvents.slice(0, 3).map((ev) => {
                    const meta = KIND_META[ev.kind];
                    return (
                      <Box
                        key={ev.id}
                        data-testid={`calendar-event-${ev.id}`}
                        data-event-id={ev.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/event-id', ev.id); }}
                        onClick={(e) => { e.stopPropagation(); onClickEvent(ev); }}
                        sx={{
                          px: 0.5, py: 0.1, borderRadius: 0.5,
                          bgcolor: meta.bg, color: meta.color,
                          fontSize: 9.5, fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          '&:hover': { filter: 'brightness(1.2)' },
                        }}
                      >
                        {formatTimeShort(ev.startSec)} {ev.title}
                      </Box>
                    );
                  })}
                  {dayEvents.length > 3 ? (
                    <Typography sx={{ fontSize: 9, color: '#9ca3af', pl: 0.5 }}>
                      + {dayEvents.length - 3} flere
                    </Typography>
                  ) : null}
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const WeekView: React.FC<{ anchorDate: Date; events: readonly CalendarEvent[]; onClickEvent: (e: CalendarEvent) => void }> = ({ anchorDate, events, onClickEvent }) => {
  const start = isoWeekStart(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  return (
    <Box
      data-testid="calendar-week-view"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(7, 1fr)' },
        gap: 0.5,
      }}
    >
      {days.map((d) => (
        <Box
          key={d.toISOString()}
          sx={{
            minHeight: { xs: 80, md: 320 },
            p: 0.75,
            bgcolor: '#0f1318',
            borderRadius: 0.5,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Typography sx={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, mb: 0.5, letterSpacing: 0.5 }}>
            {d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric' })}
          </Typography>
          <Stack spacing={0.25}>
            {eventsOnDay(events, d).map((ev) => {
              const meta = KIND_META[ev.kind];
              return (
                <Box
                  key={ev.id}
                  data-testid={`calendar-event-${ev.id}`}
                  onClick={() => onClickEvent(ev)}
                  sx={{
                    p: 0.5, borderRadius: 0.5, cursor: 'pointer',
                    bgcolor: meta.bg, borderLeft: `2px solid ${meta.color}`,
                  }}
                >
                  <Typography sx={{ fontSize: 9.5, color: meta.color, fontWeight: 700 }}>{formatTimeShort(ev.startSec)}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#fff' }} noWrap>{ev.title}</Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Box>
  );
};

const DayView: React.FC<{ anchorDate: Date; events: readonly CalendarEvent[]; onClickEvent: (e: CalendarEvent) => void }> = ({ anchorDate, events, onClickEvent }) => {
  const list = eventsOnDay(events, anchorDate).sort(
    (a, b) => new Date(a.startSec).getTime() - new Date(b.startSec).getTime(),
  );
  return (
    <Box data-testid="calendar-day-view">
      <Stack spacing={0.5}>
        {list.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Ingen events denne dagen.</Typography>
        ) : null}
        {list.map((ev) => {
          const meta = KIND_META[ev.kind];
          return (
            <Box
              key={ev.id}
              data-testid={`calendar-event-${ev.id}`}
              onClick={() => onClickEvent(ev)}
              sx={{ p: 1, borderRadius: 0.5, bgcolor: meta.bg, borderLeft: `3px solid ${meta.color}`, cursor: 'pointer' }}
            >
              <Typography sx={{ fontSize: 10, color: meta.color, fontWeight: 700, letterSpacing: 0.5 }}>
                {formatTimeShort(ev.startSec)}{ev.endSec ? ` – ${formatTimeShort(ev.endSec)}` : ''} · {meta.label}
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{ev.title}</Typography>
              {ev.location ? <Typography sx={{ fontSize: 11, color: '#9ca3af' }}>📍 {ev.location}</Typography> : null}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

const AgendaView: React.FC<{ anchorDate: Date; events: readonly CalendarEvent[]; onClickEvent: (e: CalendarEvent) => void }> = ({ anchorDate, events, onClickEvent }) => {
  const list = events
    .filter((e) => {
      const d = new Date(e.startSec);
      return d.getFullYear() === anchorDate.getFullYear() && d.getMonth() === anchorDate.getMonth();
    })
    .sort((a, b) => new Date(a.startSec).getTime() - new Date(b.startSec).getTime());
  return (
    <Stack spacing={0.5} data-testid="calendar-agenda-view">
      {list.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Ingen events i denne måneden.</Typography>
      ) : null}
      {list.map((ev) => {
        const meta = KIND_META[ev.kind];
        return (
          <Box
            key={ev.id}
            data-testid={`calendar-event-${ev.id}`}
            onClick={() => onClickEvent(ev)}
            sx={{
              p: 1, borderRadius: 0.5, cursor: 'pointer',
              borderLeft: `3px solid ${meta.color}`, bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            <Stack direction="row" justifyContent="space-between">
              <Typography sx={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{ev.title}</Typography>
              <Typography sx={{ fontSize: 11, color: meta.color, fontFamily: 'monospace' }}>
                {new Date(ev.startSec).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};

export default DanceProductionCalendar;
