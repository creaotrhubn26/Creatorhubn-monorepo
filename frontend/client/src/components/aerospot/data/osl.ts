/**
 * aerospot/data/osl.ts — kuratert airport-metadata for demo-flyplassen
 * Oslo Gardermoen (OSL/ENGM). Statisk data (24h+ cache-klasse) — IKKE
 * live-data. Rullebane-koordinater er tilnærmet for kartvisning.
 */

import type { Airport, SpottingLocation } from "../types";

export const OSL: Airport = {
  icao: "ENGM",
  iata: "OSL",
  name: "Oslo Gardermoen",
  position: { lat: 60.1976, lng: 11.1004 },
  elevationFt: 681,
  runways: [
    {
      id: "01L",
      headingDeg: 13,
      reciprocal: "19R",
      lengthM: 3600,
      thresholdA: { lat: 60.1756, lng: 11.073 },
      thresholdB: { lat: 60.2079, lng: 11.0806 },
    },
    {
      id: "01R",
      headingDeg: 13,
      reciprocal: "19L",
      lengthM: 2950,
      thresholdA: { lat: 60.1822, lng: 11.1113 },
      thresholdB: { lat: 60.2088, lng: 11.1176 },
    },
  ],
};

export const OSL_SPOTTING_LOCATIONS: SpottingLocation[] = [
  {
    id: "osl-vollen",
    airportIcao: "ENGM",
    name: "Vollen",
    position: { lat: 60.169, lng: 11.0655 },
    description:
      "Klassikeren for 01L-ankomster. Flyene passerer lavt rett over, " +
      "og du står med solen i ryggen på morgenen.",
    rating: 4.8,
    bestFor: ["RWY 01L arrivals", "morgen", "100–400 mm"],
    recommendedFocalLengthMm: [100, 400],
    bestTimeOfDay: "morning",
    runwayIds: ["01L"],
    arrivals: true,
    departures: false,
    sunNotes: "Sidebelysning fra sørøst på morgenen, motlys sen kveld.",
    parking: "Gratis parkering langs veien, 200 m unna.",
    walkMinutes: 3,
    publicAccess: true,
    shootingDirectionDeg: 45,
  },
  {
    id: "osl-kirkegarden",
    airportIcao: "ENGM",
    name: "Gardermoen kirke",
    position: { lat: 60.2145, lng: 11.078 },
    description:
      "Nordenden av 01L/19R. Perfekt for 19R-ankomster og 01L-avganger " +
      "med rotasjon rett foran deg.",
    rating: 4.5,
    bestFor: ["RWY 19R arrivals", "RWY 01L departures", "ettermiddag", "200–500 mm"],
    recommendedFocalLengthMm: [200, 500],
    bestTimeOfDay: "evening",
    runwayIds: ["01L"],
    arrivals: true,
    departures: true,
    sunNotes: "Best lys på ettermiddag/kveld med sol fra vest.",
    parking: "Parkering ved kirken.",
    walkMinutes: 5,
    publicAccess: true,
    shootingDirectionDeg: 135,
  },
  {
    id: "osl-east-mound",
    airportIcao: "ENGM",
    name: "Østre voll",
    position: { lat: 60.1935, lng: 11.1265 },
    description:
      "Forhøyning øst for 01R med oversikt over taxiway og terminal. " +
      "Fin for dokumentasjon av trafikk og spesial-liveries.",
    rating: 4.2,
    bestFor: ["RWY 01R", "taxiway", "formiddag", "70–300 mm"],
    recommendedFocalLengthMm: [70, 300],
    bestTimeOfDay: "midday",
    runwayIds: ["01R"],
    arrivals: true,
    departures: true,
    sunNotes: "Sol bakfra på formiddagen — god frontbelysning mot vest.",
    parking: "Begrenset — bruk pendlerparkering.",
    walkMinutes: 10,
    publicAccess: true,
    restrictions: "Ikke gå innenfor gjerdet. Respekter skilting.",
    shootingDirectionDeg: 270,
  },
  {
    id: "osl-approach-south",
    airportIcao: "ENGM",
    name: "Sørlige innflyving",
    position: { lat: 60.152, lng: 11.068 },
    description:
      "Under glideslope for 01L, ca. 2,5 km fra terskel. Flyene i " +
      "~800 ft — store undersidebilder og teleperspektiv.",
    rating: 4.0,
    bestFor: ["RWY 01L arrivals", "underside", "24–105 mm"],
    recommendedFocalLengthMm: [24, 105],
    bestTimeOfDay: "any",
    runwayIds: ["01L"],
    arrivals: true,
    departures: false,
    sunNotes: "Fungerer i alt lys — flyet er over deg.",
    parking: "Landbruksvei — parker hensynsfullt.",
    walkMinutes: 2,
    publicAccess: true,
    shootingDirectionDeg: 0,
  },
];
