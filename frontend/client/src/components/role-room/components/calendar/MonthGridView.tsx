/**
 * MonthGridView — produksjons-kalender måneds-modus.
 *
 * 7-kolonner-grid (Man → Søn) som viser én måned om gangen med
 * event-kort plassert på riktig dag. Følger designet i Mai 2025-mockup:
 *   - Mandag-først (norsk/europeisk konvensjon)
 *   - Lørdag/Søndag fargekodet rødt
 *   - "Out-of-month"-celler dempet
 *   - "I dag"-celle markert med lilla pill
 *   - Event-kort med kategori-farget venstre-border + ikon + tittel + tid-range
 *
 * Designprinsipper:
 *   - Pure render-komponent, ingen mutasjon — state holdes i parent
 *   - Klikk på dag-celle → onAddEventForDate(date)
 *   - Klikk på event-kort → onEditEvent(event)
 */

import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import type { CalendarEvent } from '../../services/castingApiService';

export interface MonthGridViewProps {
  /** Viste måneden (1. dag i måneden brukes som ankerpunkt) */
  monthDate: Date;
  /** Alle events i måneden — filtreres internt på dag */
  events: CalendarEvent[];
  /** Mapping fra event_type → { label, color, icon } for fargekoding */
  eventTypeConfig: Record<
    CalendarEvent['event_type'],
    { label: string; color: string; icon: React.ReactNode }
  >;
  /** Trigget når brukeren klikker på en dag-celle (utenfor event) */
  onAddEventForDate?: (date: Date) => void;
  /** Trigget når brukeren klikker på et event-kort */
  onEditEvent?: (event: CalendarEvent) => void;
}

const WEEKDAY_LABELS_NB = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
}

function buildMonthGrid(monthDate: Date): DayCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday = 1 i ISO; JS getDay() returnerer 0 (Søn) - 6 (Lør). Konverter til Monday-first.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const today = new Date();

  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - firstWeekday);

  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: isSameDay(d, today),
    });
  }
  return cells;
}

export const MonthGridView: React.FC<MonthGridViewProps> = ({
  monthDate,
  events,
  eventTypeConfig,
  onAddEventForDate,
  onEditEvent,
}) => {
  const cells = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!event.start_time) continue;
      const d = new Date(event.start_time);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 0.5,
        bgcolor: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      {WEEKDAY_LABELS_NB.map((label, idx) => (
        <Box
          key={label}
          sx={{
            py: 1,
            textAlign: 'center',
            bgcolor: 'rgba(255,255,255,0.04)',
            color: idx >= 5 ? '#fca5a5' : 'rgba(255,255,255,0.72)',
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Box>
      ))}

      {cells.map((cell) => {
        const key = `${cell.date.getFullYear()}-${pad2(cell.date.getMonth() + 1)}-${pad2(cell.date.getDate())}`;
        const dayEvents = eventsByDay.get(key) ?? [];
        return (
          <Box
            key={key}
            role="button"
            tabIndex={0}
            onClick={() => onAddEventForDate?.(cell.date)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAddEventForDate?.(cell.date);
              }
            }}
            sx={{
              minHeight: 110,
              p: 1,
              bgcolor: cell.inMonth ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.06)',
              opacity: cell.inMonth ? 1 : 0.45,
              cursor: 'pointer',
              transition: 'background-color 160ms ease-out',
              '&:hover': { bgcolor: 'rgba(96,165,250,0.06)' },
              '&:focus-visible': { outline: '2px solid #60a5fa', outlineOffset: -2 },
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              position: 'relative',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              {cell.isToday ? (
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: '#8b5cf6',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  {cell.date.getDate()}
                </Box>
              ) : (
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    color: cell.isWeekend ? '#fca5a5' : 'rgba(255,255,255,0.78)',
                  }}
                >
                  {cell.date.getDate()}
                </Typography>
              )}
            </Box>

            {dayEvents.slice(0, 3).map((event) => {
              const meta = eventTypeConfig[event.event_type] ?? eventTypeConfig.general;
              return (
                <Tooltip key={event.id} title={`${meta.label} — ${event.title}`} arrow>
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditEvent?.(event);
                    }}
                    sx={{
                      borderLeft: `3px solid ${meta.color}`,
                      bgcolor: `${meta.color}15`,
                      pl: 0.75,
                      pr: 0.5,
                      py: 0.5,
                      borderRadius: 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.1,
                      cursor: 'pointer',
                      transition: 'background-color 160ms ease-out, transform 120ms ease-out',
                      '&:hover': { bgcolor: `${meta.color}28`, transform: 'translateX(1px)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ color: meta.color, display: 'inline-flex', '& svg': { fontSize: 12 } }}>
                        {meta.icon}
                      </Box>
                      <Typography
                        sx={{
                          color: meta.color,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: 0.3,
                        }}
                      >
                        {meta.label}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.88)',
                        fontSize: '0.68rem',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {event.title}
                    </Typography>
                    {!event.all_day && event.start_time && (
                      <Typography
                        sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.6rem' }}
                      >
                        {formatTime(event.start_time)}
                        {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              );
            })}

            {dayEvents.length > 3 && (
              <Typography
                sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', textAlign: 'right' }}
              >
                +{dayEvents.length - 3} flere
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
