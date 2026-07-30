/**
 * role-room-oslo-time.ts
 *
 * Norsk veggklokke, uavhengig av serverens tidssone.
 *
 * Arbeidsmiljøloven snakker om klokkeslett: nattarbeidsforbudet for barn
 * gjelder «mellom kl. 20.00 og kl. 06.00» (§ 11-3 andre ledd), for 15–18
 * «mellom kl. 23.00 og kl. 06.00» (§ 11-3 første ledd). Det er den norske
 * klokka, ikke serverens.
 *
 * Uten dette er sjekken avhengig av `process.env.TZ` på maskinen den kjører
 * på. Render og de fleste containere kjører UTC, og da leses en wrap kl.
 * 21.30 norsk sommertid som 19.30 — utenfor 20–06-vinduet. Bruddet forsvinner
 * stille, og det er verre enn et falskt varsel: ingen leter etter et funn som
 * aldri kom.
 *
 * Sommertid gjør at forskjellen ikke er en konstant. Offsetet slås derfor opp
 * per tidspunkt via ICU framfor å hardkodes til +1 eller +2.
 */

const OSLO = "Europe/Oslo";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: OSLO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Veggklokka i Oslo for et gitt tidspunkt. */
export function osloWallClock(date: Date): WallClock {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // hourCycle h23 gir 00–23; noen eldre ICU-versjoner gir «24» ved midnatt.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Timen på norsk klokke, 0–23. */
export function osloHour(date: Date): number {
  return osloWallClock(date).hour;
}

/** Oslos avvik fra UTC i millisekunder på et gitt tidspunkt (+1t eller +2t). */
export function osloOffsetMs(date: Date): number {
  const w = osloWallClock(date);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Sekundpresisjon holder: tidssoneavvik er hele timer eller halvtimer.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Tidspunktet som svarer til en norsk veggklokke-avlesning.
 *
 * Offsetet slås opp to ganger. Første gjetning bruker offsetet ved det
 * *naive* tidspunktet, men rundt sommertidsskiftet kan det korrigerte
 * tidspunktet ligge på den andre siden av skiftet og ha et annet offset.
 * Andre oppslag retter det.
 */
export function osloInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstGuess = naive - osloOffsetMs(new Date(naive));
  const corrected = naive - osloOffsetMs(new Date(firstGuess));
  return new Date(corrected);
}

/** «2027-03-15» + «07:30» → tidspunktet det svarer til i Norge. */
export function osloInstantFrom(date: string, time: string, dayOffset = 0): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const [hh, mm] = time.slice(0, 5).split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) {
    throw new Error(`Ugyldig dato eller klokkeslett: ${date} ${time}`);
  }
  return osloInstant(y, m, d + dayOffset, hh, mm);
}

/** Dato på norsk klokke, «2027-03-15». Brukes til merking av vakter. */
export function osloDateString(date: Date): string {
  const w = osloWallClock(date);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}
