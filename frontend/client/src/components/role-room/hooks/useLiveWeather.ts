import { useCallback, useEffect, useMemo, useState } from 'react';
import { castingService } from '../services/castingService';
import type { WeatherAlertNormalized } from '../types/liveSetContracts';
import type { SceneCoordinates } from './useLiveSetContext';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const compactText = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

export type LiveWeatherRiskLevel = 'Lav' | 'Moderat' | 'Høy';

export interface LiveWeatherState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  locationLabel?: string;
  temperature?: number;
  precipitation?: number;
  windSpeed?: number;
  symbolCode?: string;
  alerts: string[];
  normalizedAlerts?: WeatherAlertNormalized[];
  blockingRisk?: boolean;
  updatedAt?: string;
  source?: string;
  error?: string;
}

export interface UseLiveWeatherOptions {
  projectId: string;
  activeSceneLocation: string;
  activeSceneCoordinates?: SceneCoordinates;
  pollMs?: number;
  onRiskComputed?: (risk: LiveWeatherRiskLevel) => void;
}

export function computeLiveWeatherRisk(weather: {
  blockingRisk?: boolean;
  alerts?: string[];
  windSpeed?: number;
  precipitation?: number;
}): LiveWeatherRiskLevel {
  const windSpeed = weather.windSpeed ?? 0;
  const precipitation = weather.precipitation ?? 0;
  const alertCount = Array.isArray(weather.alerts) ? weather.alerts.length : 0;
  if (weather.blockingRisk || alertCount > 0 || windSpeed >= 14 || precipitation >= 5) return 'Høy';
  if (windSpeed >= 8 || precipitation >= 2) return 'Moderat';
  return 'Lav';
}

export function useLiveWeather({
  projectId,
  activeSceneLocation,
  activeSceneCoordinates,
  pollMs = 180_000,
  onRiskComputed,
}: UseLiveWeatherOptions) {
  const [weather, setWeather] = useState<LiveWeatherState>({ status: 'idle', alerts: [] });
  const activeSceneLat = activeSceneCoordinates?.lat;
  const activeSceneLon = activeSceneCoordinates?.lon;

  const refreshWeather = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return;
    const locationLabel = activeSceneLocation;

    setWeather((current) => ({
      ...current,
      status: current.status === 'ready' ? 'ready' : 'loading',
      locationLabel,
    }));

    try {
      const payload = await castingService.getLiveSetWeather(projectId, {
        location: locationLabel,
        lat: activeSceneLat,
        lon: activeSceneLon,
      });
      if (signal?.aborted) return;

      const currentPayload = payload.current;
      const normalizedAlerts = Array.isArray(payload.alerts) ? payload.alerts : [];
      const alerts = normalizedAlerts
        .map((entry) => compactText(entry.title, entry.description))
        .filter((entry): entry is string => Boolean(entry));
      const blockingRisk = normalizedAlerts.some((entry) => entry.blockingRisk);
      const nextWeather: LiveWeatherState = {
        status: 'ready',
        locationLabel: compactText(currentPayload.location, locationLabel) || locationLabel,
        temperature: asNumber(currentPayload.temperature),
        precipitation: asNumber(currentPayload.precipitation),
        windSpeed: asNumber(currentPayload.windSpeed),
        symbolCode: compactText(currentPayload.symbolCode),
        alerts,
        normalizedAlerts,
        blockingRisk,
        updatedAt: compactText(currentPayload.timestamp, new Date().toISOString()),
        source: compactText(currentPayload.source, 'yr_api') || 'yr_api',
      };
      setWeather(nextWeather);
      onRiskComputed?.(computeLiveWeatherRisk(nextWeather));
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : 'Yr-oppdatering feilet';
      setWeather((current) => ({
        ...current,
        status: 'error',
        locationLabel,
        error: message,
      }));
    }
  }, [projectId, activeSceneLocation, activeSceneLat, activeSceneLon, onRiskComputed]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshWeather(controller.signal);
    const intervalId = window.setInterval(() => {
      void refreshWeather();
    }, pollMs);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [refreshWeather, pollMs]);

  const weatherRisk = useMemo(
    () => computeLiveWeatherRisk(weather),
    [weather],
  );

  return {
    weather,
    weatherRisk,
    refreshWeather,
  };
}
