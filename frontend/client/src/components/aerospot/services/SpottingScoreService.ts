/**
 * aerospot/services/SpottingScoreService.ts
 *
 * AeroSpot-score for et spottepunkt akkurat nå. Vekter er samlet i
 * WEIGHTS-objektet så justering ikke krever endring i beregningen.
 */

import type {
  LatLng,
  RunwayRecommendation,
  SpottingLocation,
  SpottingRecommendation,
  SpottingScore,
  SunTimes,
  Weather,
} from "../types";
import { distanceKm } from "./geo";
import { lightQualityForDirection } from "./SunService";

const WEIGHTS = {
  light: 0.28,
  wind: 0.14,
  visibility: 0.18,
  traffic: 0.2,
  position: 0.2,
} as const;

const QUALITY_SCORE: Record<string, number> = {
  excellent: 95,
  good: 78,
  fair: 55,
  poor: 25,
};

export function scoreLocation(input: {
  location: SpottingLocation;
  weather: Weather;
  sun: SunTimes;
  runway: RunwayRecommendation;
  trafficCount: number; // fly i området nå
  userPosition?: LatLng;
}): SpottingRecommendation {
  const { location, weather, sun, runway, trafficCount, userPosition } = input;

  const light = lightQualityForDirection(
    sun.azimuthDeg,
    sun.elevationDeg,
    location.shootingDirectionDeg,
  );
  const lightScore = QUALITY_SCORE[light.quality];

  // Vind: kraftig vind gjør fotografering ubehagelig + heat haze i stille
  const windScore =
    weather.windSpeedKt <= 15 ? 90 : Math.max(30, 90 - (weather.windSpeedKt - 15) * 4);

  const visibilityScore = Math.min(95, (weather.visibilityKm / 10) * 95);

  const trafficScore = Math.min(96, 30 + trafficCount * 3);

  // Posisjon: matcher punktet aktiv rullebane? + nærhet for brukeren
  const runwayMatch = location.runwayIds.some(
    (id) => id === runway.runway || id === runway.runway.replace("19R", "01L").replace("19L", "01R"),
  );
  let positionScore = runwayMatch ? 92 : 45;
  if (userPosition) {
    const dist = distanceKm(userPosition, location.position);
    if (dist > 30) positionScore -= 15;
  }

  const score: SpottingScore = {
    light: Math.round(lightScore),
    wind: Math.round(windScore),
    visibility: Math.round(visibilityScore),
    traffic: Math.round(trafficScore),
    position: Math.round(positionScore),
    total: 0,
  };
  score.total = Math.round(
    score.light * WEIGHTS.light +
      score.wind * WEIGHTS.wind +
      score.visibility * WEIGHTS.visibility +
      score.traffic * WEIGHTS.traffic +
      score.position * WEIGHTS.position,
  );

  const explanation = [
    `${light.label} fra ${Math.round(sun.azimuthDeg)}°.`,
    runwayMatch
      ? `${runway.runway} er sannsynlig aktiv bane — punktet dekker den.`
      : `Aktiv bane ${runway.runway} dekkes ikke optimalt herfra.`,
    weather.visibilityKm >= 10 ? "God sikt." : `Sikt ${weather.visibilityKm} km.`,
  ].join(" ");

  return { location, score, explanation, lightQuality: light.quality };
}

/** Ranger alle punkter og returner beste først. */
export function rankLocations(
  locations: SpottingLocation[],
  ctx: Omit<Parameters<typeof scoreLocation>[0], "location">,
): SpottingRecommendation[] {
  return locations
    .map((location) => scoreLocation({ location, ...ctx }))
    .sort((a, b) => b.score.total - a.score.total);
}
