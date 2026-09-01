/**
 * Canonical, non-destructive camera viewport for one storyboard frame.
 *
 * Shot intent (`shotType`, `angle`, `lensMm`) remains on the frame. This
 * sidecar records the viewport that was actually applied to the artwork.
 * Keeping it as a top-level frame field prevents drawing autosave (which
 * replaces `drawingData`) from overwriting a concurrent framing edit.
 */
export type ShotFramingMode = 'automatic' | 'manual' | 'recomposed';

export interface ShotFramingState {
  version: 1;
  centerX: number;
  centerY: number;
  zoom: number;
  rollDegrees: number;
  aspectRatio: number;
  focusAnchorX?: number;
  focusAnchorY?: number;
  mode: ShotFramingMode;
  intentFingerprint?: string;
  revision: number;
  shotSize?: string;
  angle?: string;
  lensMm?: number;
}

export const DEFAULT_SHOT_FRAMING_STATE: Readonly<ShotFramingState> = Object.freeze({
  version: 1,
  centerX: 0.5,
  centerY: 0.5,
  zoom: 1,
  rollDegrees: 0,
  aspectRatio: 16 / 9,
  mode: 'automatic',
  revision: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const finiteNumber = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

/** Wrap arbitrary rotations to the native canonical interval (-180, 180]. */
const normalizeRollDegrees = (value: number): number => {
  const positiveModulo = ((value % 360) + 360) % 360;
  return positiveModulo > 180 ? positiveModulo - 360 : positiveModulo;
};

const nonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Tolerant decoder shared by web and backend. It mirrors the native decoder:
 * missing/malformed values get safe defaults, legacy aliases are accepted,
 * and the returned object contains canonical field names only.
 */
export const normalizeShotFramingState = (value: unknown): ShotFramingState | undefined => {
  if (!isRecord(value)) return undefined;

  const rawFocusX = typeof value.focusAnchorX === 'number' && Number.isFinite(value.focusAnchorX)
    ? clamp(value.focusAnchorX, 0, 1)
    : undefined;
  const rawFocusY = typeof value.focusAnchorY === 'number' && Number.isFinite(value.focusAnchorY)
    ? clamp(value.focusAnchorY, 0, 1)
    : undefined;
  const hasCompleteFocusAnchor = rawFocusX !== undefined && rawFocusY !== undefined;
  const mode: ShotFramingMode = value.mode === 'manual' || value.mode === 'recomposed'
    ? value.mode
    : 'automatic';
  const legacyZoom = value.zoom ?? value.scale;
  const legacyRoll = value.rollDegrees ?? value.rotationDegrees;
  const rawLensMm = finiteNumber(value.lensMm, 0);
  const intentFingerprint = nonEmptyString(value.intentFingerprint);
  const shotSize = nonEmptyString(value.shotSize) ?? nonEmptyString(value.shotType);
  const angle = nonEmptyString(value.angle);

  return {
    version: 1,
    centerX: clamp(finiteNumber(value.centerX, DEFAULT_SHOT_FRAMING_STATE.centerX), 0, 1),
    centerY: clamp(finiteNumber(value.centerY, DEFAULT_SHOT_FRAMING_STATE.centerY), 0, 1),
    zoom: clamp(finiteNumber(legacyZoom, DEFAULT_SHOT_FRAMING_STATE.zoom), 1, 16),
    rollDegrees: normalizeRollDegrees(
      finiteNumber(legacyRoll, DEFAULT_SHOT_FRAMING_STATE.rollDegrees),
    ),
    aspectRatio: clamp(
      finiteNumber(value.aspectRatio, DEFAULT_SHOT_FRAMING_STATE.aspectRatio),
      0.1,
      10,
    ),
    ...(hasCompleteFocusAnchor
      ? { focusAnchorX: rawFocusX, focusAnchorY: rawFocusY }
      : {}),
    mode,
    ...(intentFingerprint ? { intentFingerprint } : {}),
    revision: Math.max(0, Math.floor(finiteNumber(value.revision, 0))),
    ...(shotSize ? { shotSize } : {}),
    ...(angle ? { angle } : {}),
    ...(rawLensMm > 0 ? { lensMm: Math.round(rawLensMm) } : {}),
  };
};

export const shotFramingStatesEqual = (left: unknown, right: unknown): boolean => {
  const normalizedLeft = normalizeShotFramingState(left);
  const normalizedRight = normalizeShotFramingState(right);
  if (!normalizedLeft || !normalizedRight) return normalizedLeft === normalizedRight;
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
};

/**
 * Stable cross-platform identity for the viewport that was actually applied.
 * This deliberately excludes revision and the fingerprint field itself: two
 * devices that arrived at the same camera transform must agree even if their
 * local edit counters differ. Keep formatting in lockstep with Swift's
 * `ShotFramingState.canonicalFingerprint`.
 */
export const shotFramingFingerprint = (value: unknown): string | undefined => {
  const state = normalizeShotFramingState(value);
  if (!state) return undefined;
  return [
    'framing-v1',
    state.shotSize ?? '',
    state.angle ?? '',
    state.lensMm == null ? '' : String(state.lensMm),
    state.centerX.toFixed(6),
    state.centerY.toFixed(6),
    state.zoom.toFixed(6),
    state.rollDegrees.toFixed(4),
    state.aspectRatio.toFixed(6),
  ].join('|');
};
