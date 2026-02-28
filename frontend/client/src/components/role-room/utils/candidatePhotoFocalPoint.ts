type CandidatePhotoFocalPoint = {
  x?: number | null;
  y?: number | null;
};

type CandidateWithPhotoFocalPoints =
  | {
      photoFocalPoints?: Array<CandidatePhotoFocalPoint | null | undefined>;
    }
  | null
  | undefined;

const DEFAULT_FOCAL_POINT = { x: 50, y: 50 };

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

export function getCandidatePhotoFocalPoint(
  candidate: CandidateWithPhotoFocalPoints,
  photoIndex = 0,
  fallback: { x: number; y: number } = DEFAULT_FOCAL_POINT,
): { x: number; y: number } {
  const rawFocalPoints = Array.isArray(candidate?.photoFocalPoints) ? candidate.photoFocalPoints : [];
  const point = rawFocalPoints[photoIndex];
  if (!point || typeof point !== 'object') {
    return { x: fallback.x, y: fallback.y };
  }

  const rawX = point.x;
  const rawY = point.y;
  if (typeof rawX !== 'number' || !Number.isFinite(rawX) || typeof rawY !== 'number' || !Number.isFinite(rawY)) {
    return { x: fallback.x, y: fallback.y };
  }

  return {
    x: clampPercent(rawX),
    y: clampPercent(rawY),
  };
}

export function getCandidatePhotoObjectPosition(
  candidate: CandidateWithPhotoFocalPoints,
  photoIndex = 0,
  fallback: { x: number; y: number } = DEFAULT_FOCAL_POINT,
): string {
  const focalPoint = getCandidatePhotoFocalPoint(candidate, photoIndex, fallback);
  return `${focalPoint.x}% ${focalPoint.y}%`;
}
