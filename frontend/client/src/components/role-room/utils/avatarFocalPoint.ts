/**
 * Avatar-fokuspunkt for Role Room-profilbilder.
 *
 * Fokuspunktet lagres som prosent (0–100) av bildet og brukes som CSS
 * `object-position` overalt avataren rendres — slik at et rundt/beskåret
 * profilbilde alltid sentreres på ansiktet, ikke midt i bildet.
 *
 * «Smart» default: prøver nettleserens native Shape Detection API
 * (`window.FaceDetector`, progressiv forbedring — ingen avhengighet) for å
 * finne det største ansiktet og bruke senteret som fokuspunkt. Faller tilbake
 * til midten når API-et mangler (Firefox/Safari) eller ingen ansikt finnes.
 */

export interface FocalPoint {
  x: number;
  y: number;
}

/** Nøytral fallback: bildets senter. */
export const DEFAULT_AVATAR_FOCAL: FocalPoint = { x: 50, y: 50 };

const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(value)));

/** Bygger en CSS `object-position`-streng fra et (mulig manglende) fokuspunkt. */
export function focalToObjectPosition(
  x?: number | null,
  y?: number | null,
): string {
  const fx = typeof x === 'number' && Number.isFinite(x) ? clampPercent(x) : DEFAULT_AVATAR_FOCAL.x;
  const fy = typeof y === 'number' && Number.isFinite(y) ? clampPercent(y) : DEFAULT_AVATAR_FOCAL.y;
  return `${fx}% ${fy}%`;
}

interface DetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
}

/**
 * Finn fokuspunkt automatisk fra det største ansiktet i et lastet bilde.
 * Returnerer null hvis API-et ikke finnes eller ingen ansikt oppdages —
 * kaller-siden bør da beholde eksisterende/standard fokuspunkt.
 */
export async function detectFaceFocalPoint(
  img: HTMLImageElement,
): Promise<FocalPoint | null> {
  try {
    const FaceDetectorCtor = (window as unknown as {
      FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
        detect: (source: CanvasImageSource) => Promise<DetectedFace[]>;
      };
    }).FaceDetector;
    if (!FaceDetectorCtor) return null;

    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 5 });
    const faces = await detector.detect(img);
    if (!faces || faces.length === 0) return null;

    const largest = faces.reduce((best, f) => {
      const area = f.boundingBox.width * f.boundingBox.height;
      const bestArea = best.boundingBox.width * best.boundingBox.height;
      return area > bestArea ? f : best;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const cx = largest.boundingBox.x + largest.boundingBox.width / 2;
    const cy = largest.boundingBox.y + largest.boundingBox.height / 2;
    return { x: clampPercent((cx / w) * 100), y: clampPercent((cy / h) * 100) };
  } catch {
    return null;
  }
}
