/**
 * aerospot-services.test.ts — sanity-checks for AeroSpot domain-logikk.
 * Kjør: npx vitest run client/src/components/aerospot
 */

import { describe, expect, it } from "vitest";
import { OSL } from "../data/osl";
import { recommendRunway } from "./RunwayRecommendationService";
import { computeSunTimes, lightQualityForDirection, sunPosition } from "./SunService";
import { classifyRarity } from "./RarityService";
import { estimateFocalLengthMm, recommendCameraSettings } from "./CameraRecommendationService";
import { parseLensRange } from "./CameraSyncService";
import { matchPhotoToFlight } from "./FlightPhotoMatchingService";
import { distanceKm, angleDiffDeg } from "./geo";
import type { LiveFlight, Weather } from "../types";

const WEATHER: Weather = {
  temperatureC: 17,
  windDirectionDeg: 20,
  windSpeedKt: 11,
  visibilityKm: 10,
  cloudCoverPct: 40,
  precipitationMmH: 0,
  pressureHpa: 1016,
  fetchedAtIso: new Date().toISOString(),
};

describe("geo", () => {
  it("distanse Oslo–Gardermoen ~35–45 km", () => {
    const d = distanceKm({ lat: 59.9139, lng: 10.7522 }, OSL.position);
    expect(d).toBeGreaterThan(30);
    expect(d).toBeLessThan(50);
  });
  it("angleDiff håndterer wrap", () => {
    expect(angleDiffDeg(350, 10)).toBe(20);
  });
});

describe("SunService", () => {
  it("solposisjon midt på dagen i Oslo om sommeren: sør + høyt", () => {
    const { azimuthDeg, elevationDeg } = sunPosition(
      new Date("2026-06-21T11:00:00Z"), // ~13:00 lokal
      OSL.position,
    );
    expect(azimuthDeg).toBeGreaterThan(140);
    expect(azimuthDeg).toBeLessThan(220);
    expect(elevationDeg).toBeGreaterThan(45);
  });
  it("soltider har sunrise før sunset", () => {
    const t = computeSunTimes(new Date("2026-08-19T10:00:00Z"), OSL.position);
    expect(new Date(t.sunriseIso).getTime()).toBeLessThan(new Date(t.sunsetIso).getTime());
  });
  it("motlys detekteres", () => {
    expect(lightQualityForDirection(180, 20, 180).quality).toBe("poor");
    expect(lightQualityForDirection(90, 20, 180).quality).toBe("excellent");
  });
});

describe("RunwayRecommendationService", () => {
  it("vind 020/11kt gir 01-operasjoner", () => {
    const rec = recommendRunway(OSL, WEATHER);
    expect(["01L", "01R"]).toContain(rec.runway);
    expect(rec.confidence).toBeGreaterThan(0.7);
  });
  it("vind 190 gir 19-operasjoner", () => {
    const rec = recommendRunway(OSL, { ...WEATHER, windDirectionDeg: 190 });
    expect(["19R", "19L"]).toContain(rec.runway);
  });
});

describe("RarityService", () => {
  it("klassifiserer", () => {
    expect(classifyRarity({ aircraftIcao: "B738" })).toBe("common");
    expect(classifyRarity({ aircraftIcao: "A388" })).toBe("very_rare");
    expect(classifyRarity({ aircraftIcao: "A124" })).toBe("legendary");
  });
});

describe("CameraRecommendationService", () => {
  it("brennvidde-estimat øker med avstand", () => {
    expect(estimateFocalLengthMm(4)).toBeGreaterThan(estimateFocalLengthMm(1));
  });
  it("flagger for treg lukker mot live kamera-state", () => {
    const result = recommendCameraSettings({
      photographyMode: "freeze",
      aircraft: { speedKt: 300, distanceKm: 2 },
      camera: { currentSettings: { shutterSpeed: "1/250", iso: 400 } },
    });
    const shutterDiff = result.differences.find((d) => d.setting === "shutterSpeed");
    expect(shutterDiff).toBeDefined();
    expect(shutterDiff?.message).toContain("treg");
  });
  it("propeller-modus holder lukkeren treg", () => {
    const r = recommendCameraSettings({ photographyMode: "propeller" });
    expect(r.recommendation.shutterSpeed).toBe("1/160");
  });
});

describe("CameraSyncService", () => {
  it("parser lens-range", () => {
    expect(parseLensRange("RF100-500mm F4.5-7.1 L IS USM")).toEqual([100, 500]);
    expect(parseLensRange("RF 400mm F2.8")).toEqual([400, 400]);
    expect(parseLensRange(undefined)).toBeNull();
  });
});

describe("FlightPhotoMatchingService", () => {
  it("nærmeste lave fly vinner", () => {
    const base: Omit<LiveFlight, "id" | "latitude" | "longitude" | "altitudeFt"> = {
      callsign: "SAS465",
      groundSpeedKt: 160,
      verticalSpeedFpm: -800,
      headingDeg: 13,
      rarity: "common",
      onGround: false,
      lastSeenIso: new Date().toISOString(),
    };
    const near: LiveFlight = { ...base, id: "near", latitude: 60.17, longitude: 11.07, altitudeFt: 1800 };
    const far: LiveFlight = { ...base, id: "far", callsign: "X", latitude: 60.6, longitude: 11.9, altitudeFt: 35000 };
    const matches = matchPhotoToFlight({
      capture: { timestampIso: new Date().toISOString(), settings: {} },
      candidates: [far, near],
      userLocation: { lat: 60.169, lng: 11.0655 },
    });
    expect(matches[0]?.flight.id).toBe("near");
  });
});
