/**
 * aerospot/services/FlightPhotoMatchingService.ts
 *
 * Matcher et capture-tidspunkt (+ posisjon) mot live-flydata og
 * foreslår hvilket fly som ble fotografert.
 *
 * MVP-signaler: tidsstempel + avstand + høyde. Arkitekturen tar imot
 * flere signaler senere (heading, brennvidde, image recognition) uten
 * å endre call-siten — utvid bare MatchSignal-vektingen.
 */

import type { CaptureContext, LatLng, LiveFlight } from "../types";
import { bearingDeg, distanceKm } from "./geo";

export interface FlightMatch {
  flight: LiveFlight;
  confidence: number; // 0–1
  distanceKm: number;
  bearingDeg: number;
}

export function matchPhotoToFlight(input: {
  capture: CaptureContext;
  candidates: LiveFlight[];
  userLocation: LatLng;
}): FlightMatch[] {
  const { candidates, userLocation } = input;

  const scored = candidates
    .filter((f) => !f.onGround)
    .map((f) => {
      const pos = { lat: f.latitude, lng: f.longitude };
      const dist = distanceKm(userLocation, pos);
      // Nærmere = mer sannsynlig fotografert. >15 km = urealistisk.
      const distScore = Math.max(0, 1 - dist / 15);
      // Lav høyde (approach/departure) er mer sannsynlig enn cruise.
      const altScore = f.altitudeFt < 8000 ? 1 : Math.max(0, 1 - (f.altitudeFt - 8000) / 30000);
      const confidence = distScore * 0.7 + altScore * 0.3;
      return {
        flight: f,
        confidence: Number(confidence.toFixed(2)),
        distanceKm: Number(dist.toFixed(1)),
        bearingDeg: Math.round(bearingDeg(userLocation, pos)),
      };
    })
    .filter((m) => m.confidence > 0.2)
    .sort((a, b) => b.confidence - a.confidence);

  return scored.slice(0, 3);
}
