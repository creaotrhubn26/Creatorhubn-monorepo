/**
 * role-room-calendar-ics.ts
 *
 * Bygger iCalendar-feed (RFC 5545) for et Role Room-prosjekt — Del A punkt 60.
 *
 * «Vanligste grunn til at planlegger ignoreres»: folk lever i Google Calendar,
 * Outlook eller Apple Calendar. En opptaksdag som ikke dukker opp der, blir
 * ikke sett.
 *
 * Envegs, bevisst. Toveis synk (punkt 149) krever konfliktløsning når begge
 * sider endrer samme hendelse; envegs dekker 80 % uten den kompleksiteten.
 *
 * Formatet er kresent, og de tre stedene implementasjoner vanligvis brekker:
 *   1. Linjebretting skal telle OKTETTER, ikke tegn. «Ålesund» er 8 tegn men
 *      9 byte, og en feilberegnet brett gir korrupt fil hos Outlook.
 *   2. Komma, semikolon, backslash og linjeskift må escapes i tekstverdier —
 *      et stedsnavn med komma deler ellers feltet i to.
 *   3. DTEND på heldagshendelser er EKSKLUSIV. Uten +1 dag vises en
 *      opptaksdag som «ingen dager» i Google Calendar.
 */

export interface CalendarEvent {
  /** Stabil id — samme hendelse skal ikke dupliseres ved neste henting. */
  uid: string;
  /** Heldagshendelse: YYYY-MM-DD. */
  date: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Satt når hendelsen er avlyst — vises som CANCELLED framfor å forsvinne. */
  cancelled?: boolean;
}

export interface CalendarFeedInput {
  projectName: string;
  events: CalendarEvent[];
  /** Tidspunkt feeden ble generert. Injiseres for testbarhet. */
  now?: Date;
}

/**
 * Escaper en tekstverdi etter RFC 5545 §3.3.11. Rekkefølgen er ikke
 * likegyldig: backslash må escapes først, ellers dobbelt-escapes de andre.
 */
export function escapeIcsText(value: string): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Bretter en linje til maks 75 oktetter, med mellomrom som fortsettelses-
 * markør. Teller bytes fordi norske tegn er flerbyte i UTF-8 — og bretter
 * aldri midt i et tegn, som ville gitt ugyldig UTF-8.
 */
export function foldIcsLine(line: string): string {
  const MAX = 75;
  const bytes = Buffer.byteLength(line, "utf8");
  if (bytes <= MAX) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  // Første linje tar 75 oktetter; fortsettelseslinjer 74 + det innledende
  // mellomrommet.
  let limit = MAX;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = char;
      currentBytes = charBytes;
      limit = MAX - 1;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current) out.push(current);

  return out[0] + out.slice(1).map((seg) => `\r\n ${seg}`).join("");
}

/**
 * Gjør en verdi fra basen om til YYYY-MM-DD slik DAGEN faktisk er ment.
 *
 * Dette er en felle verdt å være eksplisitt om: en DATE-kolonne kommer ut av
 * node-postgres som et Date-objekt på LOKAL midnatt. `toISOString()` regner
 * om til UTC, og i enhver tidssone øst for Greenwich — altså Europe/Oslo —
 * havner man dagen før. En opptaksdag 15. august ville vist 14. august i alle
 * abonnentenes kalendere.
 *
 * Derfor leses de lokale datodelene direkte, aldri via UTC.
 */
export function toLocalDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

/** YYYYMMDD — formen heldagshendelser bruker. */
export function toIcsDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** YYYYMMDDTHHMMSSZ — formen tidsstempler bruker. */
export function toIcsTimestamp(d: Date): string {
  return `${toIcsDate(d)}T${String(d.getUTCHours()).padStart(2, "0")}${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;
}

/** Dagen etter — DTEND på heldagshendelser er eksklusiv. */
function nextDay(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toIcsDate(d);
}

export function buildIcsFeed(input: CalendarFeedInput): string {
  const now = input.now ?? new Date();
  const stamp = toIcsTimestamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Role Room//Produksjonsplan//NO",
    "CALSCALE:GREGORIAN",
    // Envegs feed: si til klienten at den ikke skal tilby redigering.
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.projectName)}`,
    // Hint om hentefrekvens. Uten dette poller enkelte klienter sjelden.
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const event of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    // Avlyste dager beholdes som CANCELLED framfor å fjernes, slik at de
    // forsvinner fra abonnentens kalender i stedet for å bli hengende igjen.
    lines.push(`STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF er påkrevd av spesifikasjonen, ikke en stilpreferanse.
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
