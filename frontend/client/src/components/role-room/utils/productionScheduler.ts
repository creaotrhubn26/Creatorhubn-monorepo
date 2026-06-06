/**
 * productionScheduler.ts — ren, testbar planlegging av produksjonsdager fra
 * lokasjoner. Bransje-default: skyt alt på én location samlet, sekvensielle
 * datoer. Avansert: jevn fordeling av scener (9 scener / maks 8 → 5+4, ikke
 * 8+1), helg-hopping (lør/søn hoppes over), og produsent-styrte parametre.
 *
 * Ingen React, ingen I/O — kun datatransformasjon, så det kan enhetstestes.
 */

const DAY_MS = 86_400_000;

export interface SchedulerLocation {
  id?: string;
  name?: string;
  assignedScenes?: unknown[];
}

export interface SchedulingOptions {
  /** Startdato (ms). Normaliseres til midnatt UTC. */
  startDateMs: number;
  /** Maks scener per skytedag (load-balansering). */
  maxScenesPerDay: number;
  /** Hopp over lørdag/søndag når datoer tildeles. */
  skipWeekends: boolean;
}

export interface PlannedDay {
  /** 'YYYY-MM-DD' (UTC). */
  dateIso: string;
  locationId?: string;
  locationName: string;
  scenes: unknown[];
  /** 1-basert del-nummer når en location deles over flere dager. */
  partIndex: number;
  partCount: number;
  /** Menneskelig etikett, f.eks. «Studio A (del 2/3)». */
  label: string;
}

/** Normaliser ms til midnatt UTC samme dato. */
function toUtcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** 0 = søndag, 6 = lørdag. */
function isWeekend(ms: number): boolean {
  const day = new Date(ms).getUTCDay();
  return day === 0 || day === 6;
}

/** Flytt frem til neste hverdag hvis helg-hopping er på. */
export function adjustToWorkingDay(ms: number, skipWeekends: boolean): number {
  let cursor = toUtcMidnight(ms);
  if (!skipWeekends) return cursor;
  while (isWeekend(cursor)) cursor += DAY_MS;
  return cursor;
}

/** Neste tilgjengelige skytedag etter `ms` (1 dag frem, evt. forbi helg). */
export function nextWorkingDayMs(ms: number, skipWeekends: boolean): number {
  return adjustToWorkingDay(ms + DAY_MS, skipWeekends);
}

/**
 * Del `items` i mest mulig like store biter, hver ≤ maxPerChunk.
 * 9 items, maks 8 → [5, 4] (ikke [8, 1]). Tom liste → [[]] (én tom dag,
 * f.eks. rigg/scouting på en location uten tildelte scener ennå).
 */
export function balancedChunks<T>(items: T[], maxPerChunk: number): T[][] {
  const max = Math.max(1, Math.floor(maxPerChunk));
  if (items.length === 0) return [[]];
  const chunkCount = Math.ceil(items.length / max);
  const base = Math.floor(items.length / chunkCount);
  const remainder = items.length % chunkCount;
  const chunks: T[][] = [];
  let offset = 0;
  for (let i = 0; i < chunkCount; i += 1) {
    const size = base + (i < remainder ? 1 : 0);
    chunks.push(items.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

/**
 * Planlegg produksjonsdager fra lokasjoner. Én location skytes samlet, delt
 * over flere sekvensielle (evt. hverdags-)datoer ved mange scener.
 */
export function planProductionDays(
  locations: SchedulerLocation[],
  options: SchedulingOptions,
): PlannedDay[] {
  const maxPerDay = Math.max(1, Math.floor(options.maxScenesPerDay));
  let cursor = adjustToWorkingDay(options.startDateMs, options.skipWeekends);
  const planned: PlannedDay[] = [];

  for (const loc of locations) {
    const scenes = Array.isArray(loc.assignedScenes) ? loc.assignedScenes : [];
    const chunks = balancedChunks(scenes, maxPerDay);
    const partCount = chunks.length;
    chunks.forEach((chunkScenes, ci) => {
      const name = (loc.name && String(loc.name).trim()) || 'Uten navn';
      const partLabel = partCount > 1 ? ` (del ${ci + 1}/${partCount})` : '';
      planned.push({
        dateIso: new Date(cursor).toISOString().split('T')[0],
        locationId: loc.id,
        locationName: name,
        scenes: chunkScenes,
        partIndex: ci + 1,
        partCount,
        label: `${name}${partLabel}`,
      });
      cursor = nextWorkingDayMs(cursor, options.skipWeekends);
    });
  }

  return planned;
}
