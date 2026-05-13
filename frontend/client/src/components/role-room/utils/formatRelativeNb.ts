/**
 * Norsk-bokmål relativ-tid-formatter for "Sist oppdatert"/"Lagret"-kolonner.
 *
 * Returnerer brukervennlige strenger:
 *   - < 30s         → "akkurat nå"
 *   - < 60m         → "Ns siden" / "Nm siden"
 *   - samme dag      → "I dag, HH:MM"
 *   - i går         → "I går, HH:MM"
 *   - < 7 dager     → "N dager siden"
 *   - < 30 dager    → "N uker siden"
 *   - eldre         → "DD. mmm YYYY"
 *
 * Bruk:
 *   formatRelativeNb(candidate.updatedAt, Date.now())
 *
 * Ekstrahert som delt utility fordi flere paneler trenger samme
 * formatering (CandidateManagementPanel, AuditionSchedulePanel, m.fl.).
 */

const MONTH_LABELS_NB_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
];

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

export function formatRelativeNb(iso: string | number | Date | null | undefined, nowMs?: number): string {
  if (!iso) return '';
  const then = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = nowMs ?? Date.now();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));

  if (seconds < 30) return 'akkurat nå';
  if (seconds < 60) return `${seconds}s siden`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m siden`;

  const thenDate = new Date(then);
  const nowDate = new Date(now);
  const hhmm = `${pad2(thenDate.getHours())}:${pad2(thenDate.getMinutes())}`;

  if (isSameDay(thenDate, nowDate)) return `I dag, ${hhmm}`;

  const yesterday = new Date(nowDate);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(thenDate, yesterday)) return `I går, ${hhmm}`;

  const days = Math.floor((now - then) / 86_400_000);
  if (days < 7) return `${days} dager siden`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 uke siden' : `${weeks} uker siden`;
  }

  return `${thenDate.getDate()}. ${MONTH_LABELS_NB_SHORT[thenDate.getMonth()]} ${thenDate.getFullYear()}`;
}
