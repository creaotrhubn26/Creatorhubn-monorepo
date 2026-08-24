/**
 * aerospot/services/RarityService.ts — rarity-klassifisering av flytyper.
 *
 * ponytail: statisk frekvenstabell for norsk luftrom; oppgrader til
 * historikk-basert scoring (besøksfrekvens per flyplass) når loggbok-
 * data finnes.
 */

import type { Rarity } from "../types";

/** ICAO type designator → rarity i norsk luftrom */
const TYPE_RARITY: Record<string, Rarity> = {
  // Hverdagskost
  B738: "common",
  B38M: "common",
  A320: "common",
  A20N: "common",
  A21N: "common",
  E190: "common",
  DH8D: "common",
  AT76: "common",
  // Widebody rute
  B788: "uncommon",
  B789: "uncommon",
  A333: "uncommon",
  A339: "uncommon",
  B77W: "rare",
  A359: "rare",
  B763: "rare",
  // Sjeldne besøk
  B748: "very_rare",
  A388: "very_rare",
  B744: "very_rare",
  MD11: "very_rare",
  // Legender
  A124: "legendary",
  A225: "legendary",
  C5M: "legendary",
  B52: "legendary",
};

const MILITARY_PREFIXES = ["C17", "C30", "A400", "K35", "E3", "P8"];
const CARGO_AIRLINES = ["FDX", "UPS", "GTI", "CLX", "BCS", "ABW"];

export function classifyRarity(input: {
  aircraftIcao?: string;
  callsign?: string;
}): Rarity {
  const icao = (input.aircraftIcao ?? "").toUpperCase();
  const callsign = (input.callsign ?? "").toUpperCase();

  if (TYPE_RARITY[icao]) {
    let base = TYPE_RARITY[icao];
    // Cargo-operatør på widebody løfter ett hakk
    if (CARGO_AIRLINES.some((c) => callsign.startsWith(c)) && base === "rare") {
      base = "very_rare";
    }
    return base;
  }
  if (MILITARY_PREFIXES.some((p) => icao.startsWith(p))) return "very_rare";
  return "common";
}

export const rarityLabels: Record<Rarity, string> = {
  common: "VANLIG",
  uncommon: "UVANLIG",
  rare: "SJELDEN",
  very_rare: "SVÆRT SJELDEN",
  legendary: "LEGENDARISK",
};
