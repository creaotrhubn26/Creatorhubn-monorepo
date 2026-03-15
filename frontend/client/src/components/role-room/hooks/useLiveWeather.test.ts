import { describe, expect, it } from 'vitest';
import { computeLiveWeatherRisk } from './useLiveWeather';

describe('computeLiveWeatherRisk', () => {
  it('returns Høy on blocking alerts', () => {
    expect(computeLiveWeatherRisk({
      blockingRisk: true,
      alerts: [],
      windSpeed: 2,
      precipitation: 0,
    })).toBe('Høy');
  });

  it('returns Høy on severe wind/precipitation thresholds', () => {
    expect(computeLiveWeatherRisk({ windSpeed: 15, precipitation: 0, alerts: [] })).toBe('Høy');
    expect(computeLiveWeatherRisk({ windSpeed: 5, precipitation: 6, alerts: [] })).toBe('Høy');
  });

  it('returns Moderat on medium weather risk', () => {
    expect(computeLiveWeatherRisk({ windSpeed: 9, precipitation: 0, alerts: [] })).toBe('Moderat');
    expect(computeLiveWeatherRisk({ windSpeed: 4, precipitation: 2.5, alerts: [] })).toBe('Moderat');
  });

  it('returns Lav on calm conditions', () => {
    expect(computeLiveWeatherRisk({ windSpeed: 3, precipitation: 0, alerts: [] })).toBe('Lav');
  });
});
