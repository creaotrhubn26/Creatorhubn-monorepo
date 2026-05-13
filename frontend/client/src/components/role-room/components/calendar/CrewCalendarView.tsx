/**
 * CrewCalendarView — Gantt-/resource-view av crew × dager for en uke.
 *
 * Designparadigme (matcher screenshot fra produkteier):
 *   - Crew som RADER (en rad per crew-member, m/ avatar + navn + rolle)
 *   - Dager som KOLONNER (Man-Søn, "I dag" highlight'd)
 *   - Hver celle = events der event.crew_ids inkluderer crew-member.id
 *     OG event.start_time er på den dagen
 *   - Event-blokker fargekodet etter event_type (Opptak grønn, Prøve
 *     lilla, Audition orange, etc.) m/ ikon + tittel + tid-range + lokasjon
 *   - Day-header viser event-teller per dag som lilla pill (eks "FRE 8" med "5"
 *     under)
 *
 * Pure render-komponent — alle data-handlere kommer som props fra forelder.
 * Klikk på event → onEditEvent(event). Klikk på tom celle →
 * onAddEventForCrewDate(crewId, date).
 */

import React, { useMemo } from 'react';
import { Avatar, Box, Tooltip, Typography } from '@mui/material';
import type { CalendarEvent } from '../../services/castingApiService';

export interface CrewCalendarMember {
  id: string;
  name: string;
  role?: string;
  /** Optional avatar-URL. Hvis undefined faller vi tilbake til initialer. */
  avatarUrl?: string | null;
  /** Optional status-indikator-farge (grønn = tilgjengelig, rød = utilgjengelig) */
  statusColor?: string | null;
}

export interface CrewCalendarEventTypeMeta {
  label: string;
  color: string;
  icon: React.ReactNode;
}

export interface CrewCalendarViewProps {
  /** Mandag i den ukene som vises */
  weekStart: Date;
  /** Crew-medlemmer som rader (rekkefølge respektert) */
  members: CrewCalendarMember[];
  /** Events som skal placeres — filtreres internt på dato + crew_ids */
  events: CalendarEvent[];
  /** Mapping event_type → visuell meta */
  eventTypeConfig: Record<CalendarEvent['event_type'], CrewCalendarEventTypeMeta>;
  /** Optional handler for klikk på tom celle */
  onAddEventForCrewDate?: (crewId: string, date: Date) => void;
  /** Optional handler for klikk på event-blokk */
  onEditEvent?: (event: CalendarEvent) => void;
}

const WEEKDAY_LABELS_NB = ['MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR', 'SØN'];

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

interface DayKey {
  date: Date;
  key: string;
  label: string;
  weekdayIdx: number; // 0=Man, 6=Søn
  isWeekend: boolean;
  isToday: boolean;
}

function buildWeekDays(weekStart: Date): DayKey[] {
  const today = new Date();
  const days: DayKey[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    days.push({
      date: d,
      key,
      label: WEEKDAY_LABELS_NB[i],
      weekdayIdx: i,
      isWeekend: i >= 5,
      isToday: isSameDay(d, today),
    });
  }
  return days;
}

export const CrewCalendarView: React.FC<CrewCalendarViewProps> = ({
  weekStart,
  members,
  events,
  eventTypeConfig,
  onAddEventForCrewDate,
  onEditEvent,
}) => {
  const days = useMemo(() => buildWeekDays(weekStart), [weekStart]);

  // Index: crewId → dayKey → events[]
  const eventGrid = useMemo(() => {
    const grid = new Map<string, Map<string, CalendarEvent[]>>();
    for (const event of events) {
      if (!event.start_time) continue;
      const eventDate = new Date(event.start_time);
      if (Number.isNaN(eventDate.getTime())) continue;
      const dayKey = `${eventDate.getFullYear()}-${pad2(eventDate.getMonth() + 1)}-${pad2(eventDate.getDate())}`;
      const crewIds = event.crew_ids ?? [];
      for (const crewId of crewIds) {
        if (!grid.has(crewId)) grid.set(crewId, new Map());
        const crewMap = grid.get(crewId)!;
        if (!crewMap.has(dayKey)) crewMap.set(dayKey, []);
        crewMap.get(dayKey)!.push(event);
      }
    }
    return grid;
  }, [events]);

  // Day-header event-count badge per day (totalt på tvers av crew)
  const eventCountPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of days) counts[day.key] = 0;
    for (const event of events) {
      if (!event.start_time) continue;
      const eventDate = new Date(event.start_time);
      if (Number.isNaN(eventDate.getTime())) continue;
      const dayKey = `${eventDate.getFullYear()}-${pad2(eventDate.getMonth() + 1)}-${pad2(eventDate.getDate())}`;
      if (counts[dayKey] !== undefined) counts[dayKey] += 1;
    }
    return counts;
  }, [days, events]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 220px) repeat(7, minmax(120px, 1fr))',
        gap: 0,
        bgcolor: 'rgba(0,0,0,0.18)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      {/* Top-left tom celle */}
      <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }} />

      {/* Day-headers (Man-Søn) */}
      {days.map((day) => (
        <Box
          key={day.key}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 1,
            bgcolor: day.isToday ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            borderRight: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Typography
              sx={{
                color: day.isWeekend ? '#fca5a5' : 'rgba(255,255,255,0.55)',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              {day.label}
            </Typography>
            <Typography
              sx={{
                color: day.isToday ? '#c4b5fd' : day.isWeekend ? '#fca5a5' : '#fff',
                fontSize: '1.1rem',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {day.date.getDate()}
            </Typography>
          </Box>
          {eventCountPerDay[day.key] > 0 && (
            <Box
              sx={{
                mt: 0.5,
                px: 0.75,
                py: 0.15,
                borderRadius: 999,
                bgcolor: day.isToday ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)',
                color: day.isToday ? '#c4b5fd' : 'rgba(255,255,255,0.62)',
                fontSize: '0.62rem',
                fontWeight: 600,
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {eventCountPerDay[day.key]}
            </Box>
          )}
        </Box>
      ))}

      {/* Crew-rader */}
      {members.map((member) => (
        <React.Fragment key={member.id}>
          {/* Crew-info-celle (rad-header) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1.25,
              minHeight: 76,
              borderRight: '1px solid rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              bgcolor: 'rgba(0,0,0,0.25)',
            }}
          >
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar src={member.avatarUrl || undefined} sx={{ width: 36, height: 36, fontSize: '0.8rem' }}>
                {getInitials(member.name)}
              </Avatar>
              {member.statusColor && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: member.statusColor,
                    border: '2px solid rgba(15,23,42,1)',
                  }}
                />
              )}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {member.name}
              </Typography>
              {member.role && (
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '0.7rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {member.role}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Day-celler for denne crew-member */}
          {days.map((day) => {
            const cellEvents = eventGrid.get(member.id)?.get(day.key) ?? [];
            return (
              <Box
                key={`${member.id}-${day.key}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (cellEvents.length === 0) onAddEventForCrewDate?.(member.id, day.date);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && cellEvents.length === 0) {
                    e.preventDefault();
                    onAddEventForCrewDate?.(member.id, day.date);
                  }
                }}
                sx={{
                  minHeight: 76,
                  px: 0.5,
                  py: 0.5,
                  bgcolor: day.isToday ? 'rgba(139,92,246,0.04)' : 'transparent',
                  borderRight: '1px solid rgba(255,255,255,0.04)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: cellEvents.length === 0 ? 'pointer' : 'default',
                  transition: 'background-color 160ms ease-out',
                  '&:hover': cellEvents.length === 0
                    ? { bgcolor: 'rgba(96,165,250,0.06)' }
                    : undefined,
                  '&:focus-visible': { outline: '2px solid #60a5fa', outlineOffset: -2 },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.4,
                }}
              >
                {cellEvents.map((event) => {
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
                          bgcolor: `${meta.color}1a`,
                          pl: 0.75,
                          pr: 0.5,
                          py: 0.5,
                          borderRadius: 0.75,
                          cursor: 'pointer',
                          transition: 'background-color 160ms ease-out, transform 120ms ease-out',
                          '&:hover': {
                            bgcolor: `${meta.color}33`,
                            transform: 'translateX(1px)',
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mb: 0.15 }}>
                          <Box sx={{ color: meta.color, display: 'inline-flex', '& svg': { fontSize: 11 } }}>
                            {meta.icon}
                          </Box>
                          <Typography
                            sx={{
                              color: meta.color,
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              letterSpacing: 0.3,
                              textTransform: 'uppercase',
                            }}
                          >
                            {meta.label}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.88)',
                            fontSize: '0.7rem',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {event.title}
                        </Typography>
                        {!event.all_day && event.start_time && (
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.58rem', lineHeight: 1.2 }}>
                            {formatTime(event.start_time)}
                            {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            );
          })}
        </React.Fragment>
      ))}

      {members.length === 0 && (
        <Box
          sx={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 6,
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          <Typography sx={{ fontSize: '0.9rem' }}>Ingen crew-medlemmer å vise</Typography>
          <Typography sx={{ fontSize: '0.75rem', mt: 0.5 }}>
            Legg til crew under Team-fanen for å se Gantt-kalenderen
          </Typography>
        </Box>
      )}
    </Box>
  );
};
