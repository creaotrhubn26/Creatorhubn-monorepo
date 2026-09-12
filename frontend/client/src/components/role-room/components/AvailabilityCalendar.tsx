/**
 * AvailabilityCalendar — branded Role Room tilgjengelighets-kalender.
 *
 * To moduser:
 *   • editable: medlemmet «maler» datoer ledig/opptatt/tentativ med en pensel,
 *     endringer auto-lagres (bulk-replace) til role_room_member_availability.
 *   • read-only: viser et annet medlems kalender (fra `entries` eller ved å
 *     hente `userId`) — produsenten ser konkrete ledige/opptatte datoer.
 *
 * Internt jobber vi på et per-dag-kart (YYYY-MM-DD → status) fordi det gjør
 * «paint days»-UX-en triviell. Ved lagring komprimeres sammenhengende like
 * dager til dato-intervaller som backend forventer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Chip, CircularProgress, IconButton, Stack, Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Check, EditCalendar } from '@mui/icons-material';
import {
  roleRoomMemberProfileService,
  type AvailabilityEntry, type CalendarDayStatus,
} from '../services/roleRoomMemberProfileService';

type Brush = CalendarDayStatus | 'clear';

export interface AvailabilityCalendarProps {
  editable?: boolean;
  /** Read-only: hent et annet medlems kalender. */
  userId?: string;
  /** Read-only: forhåndslastede oppføringer (unngår ekstra fetch). */
  entries?: AvailabilityEntry[];
  /** Antall måneder som vises samtidig (default 1). */
  months?: number;
  /**
   * Kontrollert modus: seed fra `value` og lever endringer via `onChangeEntries`
   * i stedet for medlems-tjenesten. Brukes når produsent maler en KANDIDATs
   * tilgjengelighet (kandidaten har ingen egen `role_room_member_availability`).
   * Krever `editable`. Utelater medlems-fetch/-lagring helt.
   */
  onChangeEntries?: (entries: AvailabilityEntry[]) => void;
  /** Overstyr header-tittel (default «Min tilgjengelighet»/«Tilgjengelighet»). */
  title?: string;
}

const STATUS_META: Record<CalendarDayStatus, { label: string; color: string; soft: string }> = {
  available: { label: 'Ledig', color: '#22c55e', soft: 'rgba(34,197,94,0.16)' },
  busy: { label: 'Opptatt', color: '#ef4444', soft: 'rgba(239,68,68,0.16)' },
  tentative: { label: 'Tentativ', color: '#f59e0b', soft: 'rgba(245,158,11,0.18)' },
};

const MONTH_NAMES = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
];
const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

// ─── Dato-hjelpere (lokal tid, unngår TZ-forskyvning på ISO-strenger) ───
function toStr(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toStr(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** Ekspander intervaller → per-dag-kart. */
function entriesToDayMap(entries: AvailabilityEntry[]): Map<string, CalendarDayStatus> {
  const map = new Map<string, CalendarDayStatus>();
  for (const e of entries) {
    if (!e.startDate) continue;
    let cur = e.startDate;
    const end = e.endDate || e.startDate;
    // Guard mot patologiske intervaller (maks ~2 år per oppføring).
    for (let i = 0; i < 800 && cur <= end; i += 1) {
      map.set(cur, e.status);
      cur = addDays(cur, 1);
    }
  }
  return map;
}

/** Komprimer per-dag-kart → intervaller (sammenhengende like dager slås sammen). */
function dayMapToEntries(map: Map<string, CalendarDayStatus>): AvailabilityEntry[] {
  const days = Array.from(map.keys()).sort();
  const out: AvailabilityEntry[] = [];
  let run: { start: string; end: string; status: CalendarDayStatus } | null = null;
  for (const day of days) {
    const status = map.get(day)!;
    if (run && status === run.status && addDays(run.end, 1) === day) {
      run.end = day;
    } else {
      if (run) out.push({ startDate: run.start, endDate: run.end, status: run.status, note: '' });
      run = { start: day, end: day, status };
    }
  }
  if (run) out.push({ startDate: run.start, endDate: run.end, status: run.status, note: '' });
  return out;
}

function buildMonthGrid(year: number, month: number): Array<string | null> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (new Date(year, month, 1).getDay() + 6) % 7; // Man-først
  const cells: Array<string | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(toStr(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  editable = false, userId, entries, months = 1, onChangeEntries, title,
}) => {
  const controlled = typeof onChangeEntries === 'function';
  const today = useMemo(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth(), iso: toStr(n.getFullYear(), n.getMonth(), n.getDate()) };
  }, []);

  const [cursor, setCursor] = useState({ y: today.y, m: today.m });
  const [dayMap, setDayMap] = useState<Map<string, CalendarDayStatus>>(new Map());
  const [brush, setBrush] = useState<Brush>('available');
  const [loading, setLoading] = useState(!onChangeEntries && (editable || !!userId));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const paintingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Last data
  useEffect(() => {
    // Kontrollert modus: seed fra `entries` (kandidatens celler), ingen fetch.
    // Parent gir `key={candidateId}` for å re-seede ved bytte av kandidat.
    if (controlled) { setDayMap(entriesToDayMap(entries ?? [])); setLoading(false); return; }
    if (entries) { setDayMap(entriesToDayMap(entries)); setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = editable
          ? await roleRoomMemberProfileService.getMyAvailability()
          : userId
            ? await roleRoomMemberProfileService.getMemberAvailability(userId)
            : [];
        if (!cancelled) setDayMap(entriesToDayMap(data));
      } catch {
        if (!cancelled) setDayMap(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editable, userId, entries, controlled]);

  // Stopp maling når pekeren slippes hvor som helst
  useEffect(() => {
    if (!editable) return undefined;
    const up = () => { paintingRef.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [editable]);

  const scheduleSave = useCallback((next: Map<string, CalendarDayStatus>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      const nextEntries = dayMapToEntries(next);
      if (onChangeEntries) {
        // Kontrollert modus: parent eier lagringen (f.eks. kandidatens availabilityCells).
        try { onChangeEntries(nextEntries); setSaveState('saved'); }
        catch { setSaveState('error'); }
        return;
      }
      void roleRoomMemberProfileService
        .setMyAvailability(nextEntries)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 700);
  }, [onChangeEntries]);

  const applyBrush = useCallback((iso: string) => {
    if (!editable) return;
    setDayMap((prev) => {
      const next = new Map(prev);
      if (brush === 'clear') next.delete(iso);
      else next.set(iso, brush);
      scheduleSave(next);
      return next;
    });
  }, [editable, brush, scheduleSave]);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const monthsToRender = Array.from({ length: Math.max(1, months) }, (_, i) => {
    const d = new Date(cursor.y, cursor.m + i, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const hasAny = dayMap.size > 0;

  return (
    <Box sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
      {/* Branded header */}
      <Box sx={{
        px: 2, py: 1.5,
        background: 'linear-gradient(135deg, #1e1a2e, #2d1b4e)',
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <EditCalendar sx={{ color: '#c084fc', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, flex: 1 }}>
          {title ?? (editable ? 'Min tilgjengelighet' : 'Tilgjengelighet')}
        </Typography>
        <IconButton size="small" onClick={() => shiftMonth(-1)} sx={{ color: 'white' }}>
          <ChevronLeft fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => shiftMonth(1)} sx={{ color: 'white' }}>
          <ChevronRight fontSize="small" />
        </IconButton>
      </Box>

      {/* Pensel-velger (kun editable) */}
      {editable && (
        <Stack direction="row" spacing={0.75} sx={{ px: 2, py: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Marker som:
          </Typography>
          {(Object.keys(STATUS_META) as CalendarDayStatus[]).map((s) => (
            <Chip
              key={s}
              size="small"
              clickable
              label={STATUS_META[s].label}
              onClick={() => setBrush(s)}
              sx={{
                fontWeight: 600,
                bgcolor: brush === s ? STATUS_META[s].color : STATUS_META[s].soft,
                color: brush === s ? '#fff' : STATUS_META[s].color,
                border: `1px solid ${STATUS_META[s].color}`,
              }}
            />
          ))}
          <Chip
            size="small" clickable label="Viske ut"
            variant={brush === 'clear' ? 'filled' : 'outlined'}
            color={brush === 'clear' ? 'default' : undefined}
            onClick={() => setBrush('clear')}
          />
          <Box sx={{ flex: 1 }} />
          {saveState === 'saving' && (
            <Typography variant="caption" color="text.secondary">Lagrer…</Typography>
          )}
          {saveState === 'saved' && (
            <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: 'success.main' }}>
              <Check sx={{ fontSize: 14 }} />
              <Typography variant="caption">Lagret</Typography>
            </Stack>
          )}
          {saveState === 'error' && (
            <Typography variant="caption" color="error">Ikke lagret</Typography>
          )}
        </Stack>
      )}

      <Box sx={{ p: 2, pt: editable ? 0 : 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : (!editable && !hasAny) ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Ingen tilgjengelighet lagt inn ennå.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {monthsToRender.map(({ y, m }) => {
              const cells = buildMonthGrid(y, m);
              return (
                <Box key={`${y}-${m}`}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, textTransform: 'capitalize' }}>
                    {MONTH_NAMES[m]} {y}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                    {WEEKDAYS.map((w) => (
                      <Typography key={w} variant="caption" align="center"
                        sx={{ color: 'text.secondary', fontWeight: 600, pb: 0.5 }}>
                        {w}
                      </Typography>
                    ))}
                    {cells.map((iso, idx) => {
                      if (!iso) return <Box key={`b${idx}`} />;
                      const status = dayMap.get(iso);
                      const meta = status ? STATUS_META[status] : null;
                      const isToday = iso === today.iso;
                      const dayNum = Number(iso.slice(8, 10));
                      return (
                        <Box
                          key={iso}
                          onPointerDown={editable ? () => { paintingRef.current = true; applyBrush(iso); } : undefined}
                          onPointerEnter={editable ? () => { if (paintingRef.current) applyBrush(iso); } : undefined}
                          sx={{
                            aspectRatio: '1 / 1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 1.5,
                            fontSize: 13,
                            userSelect: 'none',
                            touchAction: editable ? 'none' : undefined,
                            cursor: editable ? 'pointer' : 'default',
                            fontWeight: meta ? 700 : 400,
                            color: meta ? meta.color : 'text.primary',
                            bgcolor: meta ? meta.soft : 'transparent',
                            border: isToday
                              ? '2px solid #a030c0'
                              : meta ? `1px solid ${meta.color}` : '1px solid transparent',
                            transition: 'background-color 0.1s ease',
                            '&:hover': editable ? { bgcolor: meta ? meta.soft : 'rgba(160,48,192,0.08)' } : undefined,
                          }}
                        >
                          {dayNum}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}

            {/* Tegnforklaring */}
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', pt: 0.5 }}>
              {(Object.keys(STATUS_META) as CalendarDayStatus[]).map((s) => (
                <Stack key={s} direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: STATUS_META[s].color }} />
                  <Typography variant="caption" color="text.secondary">{STATUS_META[s].label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

export default AvailabilityCalendar;
