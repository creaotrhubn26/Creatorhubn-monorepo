/**
 * aerospot/services/weatherProviders.ts
 *
 * WeatherProvider-abstraksjon. HttpWeatherProvider går via backend-
 * proxy /api/aerospot/weather (MET Norway, cachet server-side).
 * MockWeatherProvider gir stabile demo-verdier offline.
 */

import type { LatLng, Weather, WeatherProvider } from "../types";

export class MockWeatherProvider implements WeatherProvider {
  readonly name = "mock";
  async getCurrentWeather(): Promise<Weather> {
    return {
      temperatureC: 17,
      windDirectionDeg: 220,
      windSpeedKt: 12,
      gustKt: 18,
      visibilityKm: 10,
      cloudCoverPct: 40,
      precipitationMmH: 0,
      pressureHpa: 1016,
      symbol: "partlycloudy_day",
      fetchedAtIso: new Date().toISOString(),
    };
  }
}

export class HttpWeatherProvider implements WeatherProvider {
  readonly name = "met-norway";
  async getCurrentWeather(pos: LatLng): Promise<Weather> {
    const res = await fetch(
      `/api/aerospot/weather?lat=${pos.lat.toFixed(4)}&lon=${pos.lng.toFixed(4)}&icao=ENGM`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error(`weather fetch failed (${res.status})`);
    const body = (await res.json()) as { weather: Weather };
    return body.weather;
  }
}

let cached: WeatherProvider | null = null;

export function getWeatherProvider(): WeatherProvider {
  if (cached) return cached;
  const http = new HttpWeatherProvider();
  const mock = new MockWeatherProvider();
  cached = {
    name: "auto",
    async getCurrentWeather(pos) {
      try {
        return await http.getCurrentWeather(pos);
      } catch {
        return mock.getCurrentWeather();
      }
    },
  };
  return cached;
}
