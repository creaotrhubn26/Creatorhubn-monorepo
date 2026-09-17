import type { Attraction, LatLng } from '../data/types';

const EARTH_RADIUS_M = 6_371_000;

/** Storsirkelavstand i meter (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface AttractionWithDistance {
  attraction: Attraction;
  distanceM: number;
}

/** Sorterer severdigheter etter avstand fra `from`. */
export function sortByDistance(
  attractions: readonly Attraction[],
  from: LatLng,
): AttractionWithDistance[] {
  return attractions
    .map((attraction) => ({ attraction, distanceM: distanceMeters(from, attraction.position) }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function nearest(
  attractions: readonly Attraction[],
  from: LatLng,
): AttractionWithDistance | null {
  return sortByDistance(attractions, from)[0] ?? null;
}

/**
 * Menneskelig avstand: under 1 km i meter (avrundet til 10 m),
 * ellers km med én desimal. Bruker `Intl.NumberFormat` for lokal tallformatering.
 */
export function formatDistance(meters: number, locale: string): string {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', unitDisplay: 'short' }).format(rounded);
  }
  const km = Math.round(meters / 100) / 10;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(km);
}

/** Enkelt tekstsøk på navn (alle språk) og sted. */
export function matchesQuery(attraction: Attraction, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  const haystack = [
    ...Object.values(attraction.name),
    attraction.place,
    attraction.country,
  ]
    .join(' ')
    .toLocaleLowerCase();
  return haystack.includes(q);
}
