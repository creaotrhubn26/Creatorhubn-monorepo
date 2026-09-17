/**
 * aerospot/services/SunService.ts — solposisjon og soltider.
 *
 * Selvstendig implementasjon av standard NOAA/astronomi-formler
 * (samme algoritme-familie som suncalc). Nøyaktighet ±0.5° — mer enn
 * godt nok for fotograferings-anbefalinger.
 */

import type { LatLng, SunTimes } from "../types";
import { deg2rad, rad2deg } from "./geo";

const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = deg2rad(23.4397);

function toJulian(date: Date): number {
  return date.getTime() / DAY_MS - 0.5 + J1970;
}
function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}
function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(d: number): number {
  return deg2rad(357.5291 + 0.98560028 * d);
}
function eclipticLongitude(M: number): number {
  const C =
    deg2rad(1.9148) * Math.sin(M) +
    deg2rad(0.02) * Math.sin(2 * M) +
    deg2rad(0.0003) * Math.sin(3 * M);
  const P = deg2rad(102.9372);
  return M + C + P + Math.PI;
}
function declination(L: number): number {
  return Math.asin(Math.sin(L) * Math.sin(OBLIQUITY));
}
function rightAscension(L: number): number {
  return Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
}
function siderealTime(d: number, lw: number): number {
  return deg2rad(280.16 + 360.9856235 * d) - lw;
}

/** Solens asimut (fra nord, med klokken) og elevasjon i grader. */
export function sunPosition(date: Date, pos: LatLng): { azimuthDeg: number; elevationDeg: number } {
  const lw = deg2rad(-pos.lng);
  const phi = deg2rad(pos.lat);
  const d = toDays(date);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = rightAscension(L);
  const H = siderealTime(d, lw) - ra;

  const elevation = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H),
  );
  const azimuth =
    Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;

  return { azimuthDeg: (rad2deg(azimuth) + 360) % 360, elevationDeg: rad2deg(elevation) };
}

// Soltider — NOAA "hour angle"-metoden
const J0 = 0.0009;

function julianCycle(d: number, lw: number): number {
  return Math.round(d - J0 - lw / (2 * Math.PI));
}
function approxTransit(Ht: number, lw: number, n: number): number {
  return J0 + (Ht + lw) / (2 * Math.PI) + n;
}
function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}
function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos(
    (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)),
  );
}

/** Tidspunkt (Date) solen krysser gitt elevasjon (grader); settende (kveld) eller stigende. */
function timeAtElevation(date: Date, pos: LatLng, elevationDeg: number, rising: boolean): Date | null {
  const lw = deg2rad(-pos.lng);
  const phi = deg2rad(pos.lat);
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);
  const w = hourAngle(deg2rad(elevationDeg), phi, dec);
  if (Number.isNaN(w)) return null; // midnattssol / polarnatt
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  return fromJulian(rising ? Jnoon - (Jset - Jnoon) : Jset);
}

export function computeSunTimes(date: Date, pos: LatLng): SunTimes {
  const now = sunPosition(date, pos);
  const sunrise = timeAtElevation(date, pos, -0.833, true);
  const sunset = timeAtElevation(date, pos, -0.833, false);
  const goldenStart = timeAtElevation(date, pos, 6, false); // kveld: sol < 6°
  const goldenMorningEnd = timeAtElevation(date, pos, 6, true);
  const blueStart = timeAtElevation(date, pos, -4, false);

  const iso = (d: Date | null) => (d ? d.toISOString() : "");
  return {
    sunriseIso: iso(sunrise),
    sunsetIso: iso(sunset),
    goldenHourStartIso: iso(goldenStart),
    goldenHourEndIso: iso(goldenMorningEnd),
    blueHourStartIso: iso(blueStart),
    azimuthDeg: now.azimuthDeg,
    elevationDeg: now.elevationDeg,
  };
}

/**
 * Lyskvalitet for et spottepunkt: sammenlign solretning med
 * fotograferingsretning. Sol bak fotografen = frontlys (bra),
 * 90° = sidelys (utmerket for fly), mot = motlys.
 */
export function lightQualityForDirection(
  sunAzimuthDeg: number,
  sunElevationDeg: number,
  shootingDirectionDeg: number,
): { quality: "excellent" | "good" | "fair" | "poor"; label: string } {
  if (sunElevationDeg < -4) return { quality: "poor", label: "Mørkt" };
  const relative = Math.abs(
    (((sunAzimuthDeg - shootingDirectionDeg) % 360) + 540) % 360 - 180,
  ); // 180 = sol rett bak fotografen, 0 = rett imot
  if (relative < 45) return { quality: "poor", label: "Motlys" };
  if (relative < 100) return { quality: "excellent", label: "Sidelys" };
  if (relative < 145) return { quality: "good", label: "Skrått frontlys" };
  return { quality: "good", label: "Frontlys" };
}
