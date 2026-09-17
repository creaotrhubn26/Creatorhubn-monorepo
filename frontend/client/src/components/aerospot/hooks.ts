/**
 * aerospot/hooks.ts — react-query-hooks som binder services til UI.
 * Cache-intervaller per datatype (se spec §32).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { OSL, OSL_SPOTTING_LOCATIONS } from "./data/osl";
import { getFlightProvider } from "./services/flightProviders";
import { getWeatherProvider } from "./services/weatherProviders";
import { computeSunTimes } from "./services/SunService";
import { recommendRunway } from "./services/RunwayRecommendationService";
import { rankLocations } from "./services/SpottingScoreService";
import { useAeroStore } from "./store";
import type { LiveFlight, SpottingRecommendation, SunTimes } from "./types";

/** Bounds ~±60 km rundt OSL */
const OSL_BOUNDS = {
  south: OSL.position.lat - 0.55,
  west: OSL.position.lng - 1.1,
  north: OSL.position.lat + 0.55,
  east: OSL.position.lng + 1.1,
};

export function useFlights() {
  return useQuery<LiveFlight[]>({
    queryKey: ["aerospot", "flights"],
    queryFn: () => getFlightProvider().getFlightsInBounds(OSL_BOUNDS),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useWeather() {
  return useQuery({
    queryKey: ["aerospot", "weather", OSL.icao],
    queryFn: () => getWeatherProvider().getCurrentWeather(OSL.position),
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
  });
}

export function useSun(): SunTimes {
  // Re-beregnes hvert minutt via key på minutt-oppløsning
  const minute = Math.floor(Date.now() / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `minute` er selve triggeren; posisjon er konstant
  return useMemo(() => computeSunTimes(new Date(), OSL.position), [minute]);
}

/** Samlet intelligence: aktiv rullebane + rangerte spottepunkter. */
export function useSpottingIntelligence(): {
  runway: ReturnType<typeof recommendRunway> | null;
  ranked: SpottingRecommendation[];
  isLoading: boolean;
  isError: boolean;
} {
  const weather = useWeather();
  const flights = useFlights();
  const sun = useSun();
  const userPosition = useAeroStore((s) => s.userPosition);

  return useMemo(() => {
    if (!weather.data) {
      return { runway: null, ranked: [], isLoading: weather.isLoading, isError: weather.isError };
    }
    const runway = recommendRunway(OSL, weather.data);
    const ranked = rankLocations(OSL_SPOTTING_LOCATIONS, {
      weather: weather.data,
      sun,
      runway,
      trafficCount: flights.data?.length ?? 0,
      userPosition: userPosition ?? undefined,
    });
    return { runway, ranked, isLoading: false, isError: false };
  }, [weather.data, weather.isLoading, weather.isError, flights.data, sun, userPosition]);
}
