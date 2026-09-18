/**
 * aerospot/types.ts — domain types for AeroSpot.
 * UI, services og API-lag deler disse. Ingen `any`.
 */

// ── Aviation ────────────────────────────────────────────────────────

export type Rarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

export interface LiveFlight {
  id: string; // icao24 hex eller mock-id
  callsign: string;
  flightNumber?: string;
  registration?: string;
  aircraftType?: string; // "Boeing 747-8F"
  aircraftIcao?: string; // "B748"
  airline?: string;
  origin?: string; // IATA/by
  destination?: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  groundSpeedKt: number;
  verticalSpeedFpm: number;
  headingDeg: number;
  etaIso?: string;
  rarity: Rarity;
  onGround: boolean;
  lastSeenIso: string;
}

export interface Runway {
  id: string; // "01L"
  headingDeg: number;
  reciprocal: string; // "19R"
  lengthM: number;
  /** endepunkter for karttegning */
  thresholdA: LatLng;
  thresholdB: LatLng;
}

export interface Airport {
  icao: string; // "ENGM"
  iata: string; // "OSL"
  name: string; // "Oslo Gardermoen"
  position: LatLng;
  elevationFt: number;
  runways: Runway[];
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SpottingLocation {
  id: string;
  airportIcao: string;
  name: string;
  position: LatLng;
  description: string;
  rating: number; // 0–5
  bestFor: string[]; // ["RWY 01L arrivals", "morgen", "100–400 mm"]
  recommendedFocalLengthMm: [number, number];
  bestTimeOfDay: "morning" | "midday" | "evening" | "any";
  runwayIds: string[];
  arrivals: boolean;
  departures: boolean;
  sunNotes: string;
  parking: string;
  walkMinutes: number;
  publicAccess: boolean;
  restrictions?: string;
  /** kompassretning fotografen typisk peker (mot flyet) */
  shootingDirectionDeg: number;
}

// ── Weather / sun ───────────────────────────────────────────────────

export interface Weather {
  temperatureC: number;
  windDirectionDeg: number;
  windSpeedKt: number;
  gustKt?: number;
  visibilityKm: number;
  cloudCoverPct: number;
  precipitationMmH: number;
  pressureHpa: number;
  symbol?: string; // met.no symbol_code
  fetchedAtIso: string;
}

export interface SunTimes {
  sunriseIso: string;
  sunsetIso: string;
  goldenHourStartIso: string; // kveld
  goldenHourEndIso: string; // morgen slutt
  blueHourStartIso: string;
  azimuthDeg: number; // nå
  elevationDeg: number; // nå
}

// ── Intelligence ────────────────────────────────────────────────────

export interface RunwayRecommendation {
  runway: string;
  confidence: number; // 0–1
  reason: string;
}

export interface SpottingScore {
  total: number; // 0–100
  light: number;
  wind: number;
  visibility: number;
  traffic: number;
  position: number;
}

export interface SpottingRecommendation {
  location: SpottingLocation;
  score: SpottingScore;
  explanation: string;
  lightQuality: "excellent" | "good" | "fair" | "poor";
}

// ── Camera ──────────────────────────────────────────────────────────

export type PhotographyMode = "freeze" | "panning" | "propeller" | "night";

export interface CameraSettingsSnapshot {
  shutterSpeed?: string; // "1/1250"
  aperture?: string; // "f/7.1"
  iso?: number | "auto";
  focalLengthMm?: number;
}

export interface CameraRecommendation {
  shutterSpeed: string;
  aperture: string;
  iso: number | "auto";
  focalLengthMm: [number, number];
  mode: PhotographyMode;
  explanation: string;
}

export interface CameraRecommendationInput {
  aircraft?: {
    type?: string;
    speedKt?: number;
    altitudeFt?: number;
    distanceKm?: number;
    directionDeg?: number;
  };
  environment?: {
    lightLevel?: number; // 0–1
    sunElevationDeg?: number;
    weather?: Weather;
  };
  camera?: {
    model?: string;
    currentSettings?: CameraSettingsSnapshot;
  };
  lens?: {
    model?: string;
    minFocalLengthMm?: number;
    maxFocalLengthMm?: number;
    currentFocalLengthMm?: number;
  };
  photographyMode: PhotographyMode;
}

export interface CameraRecommendationResult {
  recommendation: CameraRecommendation;
  currentCameraState?: CameraSettingsSnapshot;
  differences: CameraSettingDifference[];
  explanation: string;
}

export interface CameraSettingDifference {
  setting: "shutterSpeed" | "aperture" | "iso" | "focalLength";
  recommended: string;
  current: string;
  message: string; // "Shutter is too slow."
}

/** Live-state fra tilkoblet kamera (normalisert fra CCAPI) */
export interface ConnectedCameraState {
  connected: boolean;
  reconnecting: boolean;
  model?: string;
  lensName?: string;
  batteryPercent?: number;
  storageFreeGb?: number;
  remainingShots?: number;
  settings: CameraSettingsSnapshot;
  ipAddress?: string;
  lastUpdatedIso?: string;
}

export interface CaptureContext {
  timestampIso: string;
  cameraModel?: string;
  lensName?: string;
  settings: CameraSettingsSnapshot;
  userLocation?: LatLng;
  airportIcao?: string;
  spottingLocationId?: string;
}

// ── Logbook ─────────────────────────────────────────────────────────

export interface LogbookEntry {
  id: string;
  photoUrl?: string;
  dateIso: string;
  location?: string;
  airportIcao?: string;
  flightNumber?: string;
  callsign?: string;
  registration?: string;
  aircraftType?: string;
  airline?: string;
  latitude?: number;
  longitude?: number;
  focalLengthMm?: number;
  shutterSpeed?: string;
  aperture?: string;
  iso?: number;
  cameraModel?: string;
  lensModel?: string;
  rating?: number; // 1–5
  notes?: string;
  favorite: boolean;
  rarity?: Rarity;
}

export interface LogbookStats {
  totalAircraft: number;
  airports: number;
  countries: number;
  rareAircraft: number;
  mostPhotographedType?: string;
  mostPhotographedAirline?: string;
  rarest?: string;
  favoriteAirport?: string;
}

// ── Alerts ──────────────────────────────────────────────────────────

export type AlertKind =
  | "aircraft_type"
  | "registration"
  | "airline"
  | "rare"
  | "airport"
  | "radius";

export interface SpottingAlert {
  id: string;
  kind: AlertKind;
  value: string; // "A388", "LN-XXX", "SAS", …
  airportIcao?: string;
  radiusKm?: number;
  enabled: boolean;
  createdAtIso: string;
}

// ── Providers (abstraction layer) ───────────────────────────────────

export interface FlightDataProvider {
  readonly name: string;
  getFlightsInBounds(bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
  }): Promise<LiveFlight[]>;
  getFlightById(id: string): Promise<LiveFlight | null>;
}

export interface WeatherProvider {
  readonly name: string;
  getCurrentWeather(pos: LatLng): Promise<Weather>;
}
