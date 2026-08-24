/**
 * aerospot/services/CameraRecommendationService.ts
 *
 * Regelbasert eksponerings-anbefaling for flyfoto. Tar aviation-data +
 * miljø + (valgfritt) live kamera-state fra CCAPI og returnerer
 * anbefaling + differ mot kameraets faktiske innstillinger.
 */

import type {
  CameraRecommendation,
  CameraRecommendationInput,
  CameraRecommendationResult,
  CameraSettingDifference,
  PhotographyMode,
} from "../types";

// ── Basisprofiler per modus ─────────────────────────────────────────

const BASE: Record<PhotographyMode, CameraRecommendation> = {
  freeze: {
    shutterSpeed: "1/1000",
    aperture: "f/5.6",
    iso: 400,
    focalLengthMm: [100, 400],
    mode: "freeze",
    explanation:
      "Rask lukker fryser jetfly skarpt. Servo AF og burst anbefales.",
  },
  panning: {
    shutterSpeed: "1/125",
    aperture: "f/8",
    iso: "auto",
    focalLengthMm: [100, 400],
    mode: "panning",
    explanation:
      "Følg flyet jevnt gjennom søkeren og fortsett bevegelsen etter eksponeringen. Continuous AF + burst.",
  },
  propeller: {
    shutterSpeed: "1/160",
    aperture: "f/8",
    iso: "auto",
    focalLengthMm: [100, 400],
    mode: "propeller",
    explanation:
      "Lukkertid rundt 1/160 gir propell-blur — frossen propell ser unaturlig og «parkert» ut.",
  },
  night: {
    shutterSpeed: "1/60",
    aperture: "f/2.8",
    iso: 3200,
    focalLengthMm: [70, 200],
    mode: "night",
    explanation:
      "Åpen blender og høy ISO. Stativ eller stabilisering anbefales — panorer med flyet for å redde lukkertiden.",
  },
};

function shutterToSeconds(s: string): number {
  const m = s.match(/^1\/(\d+)$/);
  if (m) return 1 / Number(m[1]);
  const n = Number(s.replace("s", ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pickShutterForSpeed(speedKt: number, distanceKm: number): string {
  // Vinkelhastighet styrer krav: raskt + nært = raskere lukker
  const angular = speedKt / Math.max(0.5, distanceKm);
  if (angular > 250) return "1/2000";
  if (angular > 120) return "1/1600";
  if (angular > 60) return "1/1250";
  return "1/1000";
}

/**
 * Estimer nødvendig brennvidde for å fylle ~60% av rammen (fullformat)
 * for et fly med gitt lengde på gitt avstand.
 */
export function estimateFocalLengthMm(distanceKm: number, aircraftLengthM = 45): number {
  const sensorWidthMm = 36;
  const targetFraction = 0.6;
  const focal = (sensorWidthMm * distanceKm * 1000) / (aircraftLengthM / targetFraction);
  return Math.round(Math.min(800, Math.max(24, focal)));
}

export function recommendCameraSettings(
  input: CameraRecommendationInput,
): CameraRecommendationResult {
  const rec: CameraRecommendation = { ...BASE[input.photographyMode] };
  const notes: string[] = [rec.explanation];

  // Juster lukker for freeze basert på faktisk fart/avstand
  if (input.photographyMode === "freeze" && input.aircraft?.speedKt) {
    rec.shutterSpeed = pickShutterForSpeed(
      input.aircraft.speedKt,
      input.aircraft.distanceKm ?? 3,
    );
  }

  // Lysnivå → ISO (kun freeze/panning med fast ISO)
  const sunElev = input.environment?.sunElevationDeg;
  const cloud = input.environment?.weather?.cloudCoverPct ?? 0;
  if (typeof rec.iso === "number" && typeof sunElev === "number") {
    if (sunElev < 5 || cloud > 80) {
      rec.iso = Math.min(3200, rec.iso * 4);
      notes.push("Lite lys — ISO hevet.");
    } else if (sunElev > 25 && cloud < 40) {
      rec.iso = Math.max(100, rec.iso / 2);
      notes.push("Godt lys — ISO senket.");
    }
  }

  // Brennvidde fra avstand, klippet til objektivets range
  if (input.aircraft?.distanceKm) {
    const ideal = estimateFocalLengthMm(input.aircraft.distanceKm);
    let lo = Math.max(24, Math.round(ideal * 0.8));
    let hi = Math.min(800, Math.round(ideal * 1.15));
    if (input.lens?.minFocalLengthMm && input.lens?.maxFocalLengthMm) {
      lo = Math.max(lo, input.lens.minFocalLengthMm);
      hi = Math.min(hi, input.lens.maxFocalLengthMm);
      if (lo > hi) {
        lo = input.lens.maxFocalLengthMm;
        hi = input.lens.maxFocalLengthMm;
        notes.push("Flyet krever mer rekkevidde enn objektivet har — beskjær i etterkant.");
      }
    }
    rec.focalLengthMm = [lo, hi];
    notes.push(`Ca. ${ideal} mm på fullformat fra denne avstanden.`);
  }

  // Differ mot live kamera-state
  const current = input.camera?.currentSettings;
  const differences: CameraSettingDifference[] = [];
  if (current) {
    if (current.shutterSpeed && current.shutterSpeed !== rec.shutterSpeed) {
      const curS = shutterToSeconds(current.shutterSpeed);
      const recS = shutterToSeconds(rec.shutterSpeed);
      if (curS > 0 && recS > 0 && Math.abs(Math.log2(curS / recS)) >= 0.5) {
        differences.push({
          setting: "shutterSpeed",
          recommended: rec.shutterSpeed,
          current: current.shutterSpeed,
          message:
            curS > recS
              ? "Lukkeren er for treg — risiko for bevegelsesuskarphet."
              : "Lukkeren er raskere enn nødvendig — koster ISO/støy.",
        });
      }
    }
    if (
      typeof current.iso === "number" &&
      typeof rec.iso === "number" &&
      Math.abs(Math.log2(current.iso / rec.iso)) >= 1
    ) {
      differences.push({
        setting: "iso",
        recommended: String(rec.iso),
        current: String(current.iso),
        message:
          current.iso > rec.iso
            ? "ISO er høyere enn nødvendig — mer støy enn du trenger."
            : "ISO er lav — sjekk at lukkertiden holder.",
      });
    }
    if (current.focalLengthMm) {
      const [lo, hi] = rec.focalLengthMm;
      if (current.focalLengthMm < lo * 0.85 || current.focalLengthMm > hi * 1.15) {
        differences.push({
          setting: "focalLength",
          recommended: `${lo}–${hi} mm`,
          current: `${current.focalLengthMm} mm`,
          message:
            current.focalLengthMm < lo
              ? "Zoom inn — flyet blir lite i rammen."
              : "Zoom ut — du risikerer å klippe vingene.",
        });
      }
    }
  }

  return {
    recommendation: rec,
    currentCameraState: current,
    differences,
    explanation: notes.join(" "),
  };
}
