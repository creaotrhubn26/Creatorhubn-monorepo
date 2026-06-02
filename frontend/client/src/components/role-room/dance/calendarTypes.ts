/**
 * CalendarEvent — felles event-modell på tvers av rehearsals, performances,
 * classes, auditions og dancer-availability. Brukes av DanceProductionCalendar
 * for å rendre events som blokker i grid/uke/dag-view.
 */
import { danceFlowColors } from './danceFlowTheme';

export type CalendarEventKind =
  | 'rehearsal'
  | 'performance'
  | 'class'
  | 'audition'
  | 'availability';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startSec: string; // ISO timestamp
  endSec: string | null; // ISO timestamp, null = punkt-event
  location: string | null;
  /** Underliggende objekt-id (for edit/delete-handler). */
  sourceId: string;
  /** Kort tekst for tooltip + agenda-listen. */
  description?: string | null;
  /** Hvilke dancers er involvert? Brukes til kollisjons-flagg. */
  dancerIds?: string[];
  /** Rom/sal — brukes til kollisjons-flagg på ressurs. */
  roomId?: string | null;
  /** Ekstra meta for visning (f.eks. ticketsSold/capacity for performances). */
  meta?: Record<string, unknown>;
  /** Markert som tilbakevendende (klasse hver uke etc). */
  recurring?: 'weekly' | 'monthly' | null;
}

export const KIND_META: Record<CalendarEventKind, { label: string; color: string; bg: string }> = {
  rehearsal:    { label: 'Prøver',          color: danceFlowColors.lavender, bg: 'rgba(167,139,250,0.18)' },
  performance:  { label: 'Forestillinger',  color: danceFlowColors.gold, bg: 'rgba(251,191,36,0.18)' },
  class:        { label: 'Klasser',         color: danceFlowColors.successPrimary, bg: 'rgba(52,211,153,0.18)' },
  audition:     { label: 'Auditions',       color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
  availability: { label: 'Tilgjengelighet', color: danceFlowColors.textMuted, bg: 'rgba(156,163,175,0.18)' },
};

/** Returns hvis to events overlapper i tid OG samme rom (ressurs-kollisjon). */
export function eventsCollide(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.id === b.id) return false;
  if (!a.roomId || !b.roomId) return false;
  if (a.roomId !== b.roomId) return false;
  const aStart = new Date(a.startSec).getTime();
  const aEnd = a.endSec ? new Date(a.endSec).getTime() : aStart + 3600_000;
  const bStart = new Date(b.startSec).getTime();
  const bEnd = b.endSec ? new Date(b.endSec).getTime() : bStart + 3600_000;
  return aStart < bEnd && bStart < aEnd;
}

/** Returnerer alle events som kolliderer med event-id, eller [] hvis ingen. */
export function findCollisions(target: CalendarEvent, all: readonly CalendarEvent[]): CalendarEvent[] {
  return all.filter((e) => eventsCollide(target, e));
}

/** Bygger en .ics-streng fra events (RFC 5545-light). */
export function eventsToIcs(events: readonly CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CreatorHub//Dance//NO',
    'CALSCALE:GREGORIAN',
  ];
  const toIcsDate = (iso: string): string => {
    // YYYYMMDDTHHMMSSZ
    const d = new Date(iso);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };
  const escape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  for (const e of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@creatorhubn.com`);
    lines.push(`DTSTAMP:${toIcsDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${toIcsDate(e.startSec)}`);
    if (e.endSec) lines.push(`DTEND:${toIcsDate(e.endSec)}`);
    lines.push(`SUMMARY:${escape(`${KIND_META[e.kind].label.slice(0, 4)}: ${e.title}`)}`);
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
    if (e.recurring === 'weekly') lines.push('RRULE:FREQ=WEEKLY');
    if (e.recurring === 'monthly') lines.push('RRULE:FREQ=MONTHLY');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
