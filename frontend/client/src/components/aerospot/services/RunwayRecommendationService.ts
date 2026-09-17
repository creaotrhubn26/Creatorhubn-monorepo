/**
 * aerospot/services/RunwayRecommendationService.ts
 *
 * Vind-basert rullebane-anbefaling. Dette er en ESTIMERT anbefaling —
 * ikke en ATC-beslutning. UI må merke det.
 */

import type { Airport, RunwayRecommendation, Weather } from "../types";
import { angleDiffDeg } from "./geo";

export function recommendRunway(airport: Airport, weather: Weather): RunwayRecommendation {
  // Fly lander/tar av mot vinden. For hver rullebaneretning (begge ender):
  // score = headwind-komponent.
  const candidates = airport.runways.flatMap((rwy) => [
    { id: rwy.id, heading: rwy.headingDeg },
    { id: rwy.reciprocal, heading: (rwy.headingDeg + 180) % 360 },
  ]);

  let best = candidates[0];
  let bestHeadwind = -Infinity;
  for (const c of candidates) {
    const diff = angleDiffDeg(weather.windDirectionDeg, c.heading);
    const headwind = weather.windSpeedKt * Math.cos((diff * Math.PI) / 180);
    if (headwind > bestHeadwind) {
      bestHeadwind = headwind;
      best = c;
    }
  }

  // Confidence: sterk vind rett imot = høy. Vindstille = lav (ATC velger
  // preferert bane — på ENGM typisk 01-operasjoner).
  const confidence =
    weather.windSpeedKt < 4
      ? 0.5
      : Math.min(0.95, 0.55 + (bestHeadwind / weather.windSpeedKt) * 0.4);

  const reason =
    weather.windSpeedKt < 4
      ? `Svak vind (${weather.windSpeedKt} kt) — preferert baneretning antas`
      : `Vind ${Math.round(weather.windDirectionDeg)}° / ${weather.windSpeedKt} kt gir ${Math.round(bestHeadwind)} kt motvind for ${best.id}`;

  return { runway: best.id, confidence: Number(confidence.toFixed(2)), reason };
}
