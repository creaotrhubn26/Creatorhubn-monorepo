/** aerospot/services/geo.ts — geodesi-hjelpere (haversine, bearing). */

import type { LatLng } from "../types";

const R_EARTH_KM = 6371;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(a.lat)) * Math.cos(deg2rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Kompass-bearing fra a til b, 0–360° */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(deg2rad(b.lng - a.lng)) * Math.cos(deg2rad(b.lat));
  const x =
    Math.cos(deg2rad(a.lat)) * Math.sin(deg2rad(b.lat)) -
    Math.sin(deg2rad(a.lat)) * Math.cos(deg2rad(b.lat)) * Math.cos(deg2rad(b.lng - a.lng));
  return (rad2deg(Math.atan2(y, x)) + 360) % 360;
}

/** Minste vinkelavstand mellom to kompassretninger, 0–180° */
export function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

export function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}

export function compassLabel(deg: number): string {
  const labels = ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"];
  return labels[Math.round(deg / 45) % 8];
}
