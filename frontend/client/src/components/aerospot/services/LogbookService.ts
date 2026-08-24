/**
 * aerospot/services/LogbookService.ts
 *
 * Loggbok-CRUD mot /api/aerospot/logbook med localStorage-cache for
 * offline-lesing. EXIF leses med exifr (allerede installert).
 */

import exifr from "exifr";
import type { LogbookEntry, LogbookStats } from "../types";

const CACHE_KEY = "aerospot-logbook-cache";

export interface ExifSummary {
  cameraModel?: string;
  lensModel?: string;
  focalLengthMm?: number;
  shutterSpeed?: string;
  aperture?: string;
  iso?: number;
  dateIso?: string;
  latitude?: number;
  longitude?: number;
}

export async function readExif(file: File): Promise<ExifSummary> {
  try {
    const data = (await exifr.parse(file, {
      pick: [
        "Model",
        "LensModel",
        "FocalLength",
        "ExposureTime",
        "FNumber",
        "ISO",
        "DateTimeOriginal",
        "latitude",
        "longitude",
      ],
      gps: true,
    })) as Record<string, unknown> | undefined;
    if (!data) return {};
    const exposure = typeof data.ExposureTime === "number" ? data.ExposureTime : undefined;
    return {
      cameraModel: typeof data.Model === "string" ? data.Model : undefined,
      lensModel: typeof data.LensModel === "string" ? data.LensModel : undefined,
      focalLengthMm: typeof data.FocalLength === "number" ? Math.round(data.FocalLength) : undefined,
      shutterSpeed:
        exposure !== undefined
          ? exposure >= 1
            ? `${exposure}s`
            : `1/${Math.round(1 / exposure)}`
          : undefined,
      aperture: typeof data.FNumber === "number" ? `f/${data.FNumber}` : undefined,
      iso: typeof data.ISO === "number" ? data.ISO : undefined,
      dateIso: data.DateTimeOriginal instanceof Date ? data.DateTimeOriginal.toISOString() : undefined,
      latitude: typeof data.latitude === "number" ? data.latitude : undefined,
      longitude: typeof data.longitude === "number" ? data.longitude : undefined,
    };
  } catch {
    return {};
  }
}

export async function fetchLogbook(): Promise<LogbookEntry[]> {
  try {
    const res = await fetch("/api/aerospot/logbook", { credentials: "include" });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { entries: LogbookEntry[] };
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(body.entries));
    } catch {
      // storage full — cache er best-effort
    }
    return body.entries;
  } catch {
    // Offline: les cache
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as LogbookEntry[]) : [];
    } catch {
      return [];
    }
  }
}

export async function createLogbookEntry(
  entry: Omit<LogbookEntry, "id">,
): Promise<string | null> {
  const res = await fetch("/api/aerospot/logbook", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { id: string };
  return body.id;
}

export async function updateLogbookEntry(
  id: string,
  patch: Partial<Pick<LogbookEntry, "rating" | "notes" | "favorite">>,
): Promise<boolean> {
  const res = await fetch(`/api/aerospot/logbook/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

export async function deleteLogbookEntry(id: string): Promise<boolean> {
  const res = await fetch(`/api/aerospot/logbook/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

// ── Statistikk (utledet klient-side) ────────────────────────────────

function topOf(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function computeStats(entries: LogbookEntry[]): LogbookStats {
  const types = new Map<string, number>();
  const airlines = new Map<string, number>();
  const airports = new Map<string, number>();
  const rarityOrder = ["common", "uncommon", "rare", "very_rare", "legendary"];
  let rarest: LogbookEntry | undefined;
  let rareCount = 0;

  for (const e of entries) {
    if (e.aircraftType) types.set(e.aircraftType, (types.get(e.aircraftType) ?? 0) + 1);
    if (e.airline) airlines.set(e.airline, (airlines.get(e.airline) ?? 0) + 1);
    if (e.airportIcao) airports.set(e.airportIcao, (airports.get(e.airportIcao) ?? 0) + 1);
    const r = rarityOrder.indexOf(e.rarity ?? "common");
    if (r >= 2) rareCount += 1;
    if (!rarest || r > rarityOrder.indexOf(rarest.rarity ?? "common")) rarest = e;
  }

  return {
    totalAircraft: entries.length,
    airports: airports.size,
    // ponytail: land utledes ikke uten flyplass→land-datasett; teller
    // unike flyplasser som proxy inntil datasett legges til.
    countries: airports.size,
    rareAircraft: rareCount,
    mostPhotographedType: topOf(types),
    mostPhotographedAirline: topOf(airlines),
    rarest: rarest?.aircraftType,
    favoriteAirport: topOf(airports),
  };
}

/** Collection-view: manufacturer → type → antall */
export function computeCollection(entries: LogbookEntry[]): Map<string, Map<string, number>> {
  const byMaker = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (!e.aircraftType) continue;
    const maker = e.aircraftType.split(" ")[0]; // "Boeing 747-8F" → "Boeing"
    const model = e.aircraftType.slice(maker.length).trim() || e.aircraftType;
    const inner = byMaker.get(maker) ?? new Map<string, number>();
    inner.set(model, (inner.get(model) ?? 0) + 1);
    byMaker.set(maker, inner);
  }
  return byMaker;
}
