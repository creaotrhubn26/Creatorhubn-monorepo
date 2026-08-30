import {
  DEFAULT_SHOT_FRAMING_STATE,
  normalizeShotFramingState,
  type ShotFramingState,
} from './storyboard-shot-framing.js';

/**
 * CoveragePolicy v1 is deliberately pure and platform-neutral. It evaluates
 * the same normalized source-space viewport polygons that native live/export
 * rendering consumes, without reading editor state, wall-clock time or I/O.
 *
 * The constants below are part of the persisted/render contract. Changing one
 * requires a new policy version and new cross-platform fixtures.
 */
export const STORYBOARD_COVERAGE_POLICY_V1 = Object.freeze({
  version: 1 as const,
  legacyProjectFrameRate: Object.freeze({ value: 25, timescale: 1 }),
  allowedProjectFrameRates: Object.freeze([
    Object.freeze({ value: 24, timescale: 1 }),
    Object.freeze({ value: 25, timescale: 1 }),
    Object.freeze({ value: 30, timescale: 1 }),
    Object.freeze({ value: 50, timescale: 1 }),
    Object.freeze({ value: 60, timescale: 1 }),
    Object.freeze({ value: 24_000, timescale: 1_001 }),
    Object.freeze({ value: 30_000, timescale: 1_001 }),
  ]),
  containmentEpsilon: 0.000_001,
  minimumCoverageFraction: 0.999,
  largeEmptyCornerWarningFraction: 0.999_999,
  minimumSourcePixelsPerOutputPixel: 1,
  aggressiveDigitalZoom: 4,
  focusSafeAreaInset: 0.05,
  aspectRatioTolerance: 0.01,
  maximumCurveErrorNormalized: 0.000_25,
  maximumSubdivisionDepth: 8,
  adaptiveTimeTimescale: 1_000_000,
  maximumTimeTimescale: 1_000_000,
  maximumDurationSeconds: 600,
  maximumKeyframeCount: 64,
  maximumEvaluationSampleCount: 40_000,
});

export interface StoryboardMediaTimeV1 {
  value: number;
  timescale: number;
}

export interface StoryboardSizeV1 {
  width: number;
  height: number;
}

export interface StoryboardPointV1 {
  x: number;
  y: number;
}

export interface StoryboardNormalizedRectV1 {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export type StoryboardCameraEasingV1 =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'hold';

export interface StoryboardCameraPoseV1 {
  centerX: number;
  centerY: number;
  zoom: number;
  rollDegrees: number;
  focusAnchorX?: number;
  focusAnchorY?: number;
}

export interface StoryboardCameraKeyframeV1 {
  id: string;
  time: StoryboardMediaTimeV1;
  pose: StoryboardCameraPoseV1;
  easingFromPrevious: { kind: StoryboardCameraEasingV1 };
}

export interface StoryboardCameraMotionTrackV1 {
  version: 1;
  enabled: boolean;
  mode: 'keyframed' | 'performed';
  presetId?: string;
  keyframes: StoryboardCameraKeyframeV1[];
}

export type StoryboardCoverageAssetV1 =
  | { kind: 'source_space' }
  | {
    kind: 'viewport_raster';
    /** The complete pose at which the viewport-bound raster was generated. */
    rasterPlacementFraming: unknown;
  };

export interface StoryboardCoverageInputV1 {
  policyVersion: 1;
  sourceSize: StoryboardSizeV1;
  outputSize: StoryboardSizeV1;
  initialFraming?: unknown;
  asset?: StoryboardCoverageAssetV1;
  shotDuration?: StoryboardMediaTimeV1;
  projectFrameRate?: StoryboardMediaTimeV1;
  motionTrack?: StoryboardCameraMotionTrackV1 | null;
  criticalSubjectBounds?: StoryboardNormalizedRectV1;
}

export type StoryboardCoverageSeverity = 'blocking' | 'warning' | 'info';

export type StoryboardCoverageIssueCode =
  | 'unsupported_policy_version'
  | 'invalid_dimensions'
  | 'invalid_framing'
  | 'invalid_motion_track'
  | 'unsupported_project_frame_rate'
  | 'coverage_non_convergent'
  | 'empty_viewport'
  | 'uncovered_viewport'
  | 'critical_subject_outside'
  | 'motion_plate_required'
  | 'aspect_ratio_mismatch'
  | 'low_source_resolution'
  | 'large_empty_corners'
  | 'focus_near_crop_edge'
  | 'aggressive_digital_zoom'
  | 'provider_may_synthesize_outside_source';

export interface StoryboardCoverageIssueV1 {
  code: StoryboardCoverageIssueCode;
  severity: StoryboardCoverageSeverity;
  /** Earliest canonical shot-local time at which the issue was observed. */
  time?: StoryboardMediaTimeV1;
}

export interface StoryboardCoverageReportV1 {
  policyVersion: 1;
  classification: 'valid' | 'warning' | 'blocking';
  issues: StoryboardCoverageIssueV1[];
  blockingCodes: StoryboardCoverageIssueCode[];
  warningCodes: StoryboardCoverageIssueCode[];
  infoCodes: StoryboardCoverageIssueCode[];
  evaluatedSampleCount: number;
  evaluatedTimes: StoryboardMediaTimeV1[];
  minimumCoverageFraction: number;
  minimumSourcePixelsPerOutputPixel: number;
  sweptVisibleBounds?: StoryboardNormalizedRectV1;
}

type NormalizedMotion = {
  enabled: boolean;
  keyframes: StoryboardCameraKeyframeV1[];
};

type MotionSegment = {
  left: StoryboardMediaTimeV1;
  right: StoryboardMediaTimeV1;
  easing: StoryboardCameraEasingV1 | 'static';
};

type Geometry = {
  polygon: StoryboardPointV1[];
  coverageFraction: number;
  sourcePixelsPerOutputPixel: number;
  focusInViewport?: StoryboardPointV1;
};

const severityOrder: Record<StoryboardCoverageSeverity, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

const roundMetric = (value: number): number => (
  Number.isFinite(value) ? Number(value.toFixed(9)) : 0
);

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return Math.max(1, a);
};

const normalizeTime = (value: unknown): StoryboardMediaTimeV1 | undefined => {
  if (!isRecord(value)
      || !Number.isSafeInteger(value.value)
      || !Number.isSafeInteger(value.timescale)
      || (value.value as number) < 0
      || (value.timescale as number) <= 0
      || (value.timescale as number)
        > STORYBOARD_COVERAGE_POLICY_V1.maximumTimeTimescale) {
    return undefined;
  }
  const numerator = value.value as number;
  const denominator = value.timescale as number;
  if (numerator === 0) return { value: 0, timescale: 1 };
  const divisor = greatestCommonDivisor(numerator, denominator);
  return {
    value: numerator / divisor,
    timescale: denominator / divisor,
  };
};

const compareTime = (
  left: StoryboardMediaTimeV1,
  right: StoryboardMediaTimeV1,
): number => {
  const leftProduct = left.value * right.timescale;
  const rightProduct = right.value * left.timescale;
  if (!Number.isSafeInteger(leftProduct) || !Number.isSafeInteger(rightProduct)) {
    return Number.NaN;
  }
  return leftProduct === rightProduct ? 0 : leftProduct < rightProduct ? -1 : 1;
};

const timeKey = (time: StoryboardMediaTimeV1): string => (
  `${time.value}/${time.timescale}`
);

const timeSeconds = (time: StoryboardMediaTimeV1): number => (
  time.value / time.timescale
);

const midpointTime = (
  left: StoryboardMediaTimeV1,
  right: StoryboardMediaTimeV1,
): StoryboardMediaTimeV1 | undefined => {
  const seconds = (timeSeconds(left) + timeSeconds(right)) / 2;
  const scaled = seconds * STORYBOARD_COVERAGE_POLICY_V1.adaptiveTimeTimescale;
  if (!Number.isFinite(scaled) || !Number.isSafeInteger(Math.floor(scaled + 0.5))) {
    return undefined;
  }
  return normalizeTime({
    value: Math.floor(scaled + 0.5),
    timescale: STORYBOARD_COVERAGE_POLICY_V1.adaptiveTimeTimescale,
  });
};

const normalizedDegrees = (value: number): number => {
  const positiveModulo = ((value % 360) + 360) % 360;
  return positiveModulo > 180 ? positiveModulo - 360 : positiveModulo;
};

const hasInvalidKnownFramingValue = (value: Record<string, unknown>): boolean => {
  const numericFields = [
    'centerX', 'centerY', 'zoom', 'scale', 'rollDegrees', 'rotationDegrees',
    'aspectRatio', 'focusAnchorX', 'focusAnchorY', 'lensMm', 'revision',
  ];
  return numericFields.some((field) => (
    value[field] !== undefined && !isFiniteNumber(value[field])
  ));
};

const parseFraming = (value: unknown): ShotFramingState | undefined => {
  if (value === undefined || value === null) {
    return { ...DEFAULT_SHOT_FRAMING_STATE };
  }
  if (!isRecord(value) || hasInvalidKnownFramingValue(value)) return undefined;
  return normalizeShotFramingState(value);
};

const poseFromFraming = (framing: ShotFramingState): StoryboardCameraPoseV1 => ({
  centerX: framing.centerX,
  centerY: framing.centerY,
  zoom: framing.zoom,
  rollDegrees: framing.rollDegrees,
  ...(framing.focusAnchorX !== undefined && framing.focusAnchorY !== undefined
    ? {
      focusAnchorX: framing.focusAnchorX,
      focusAnchorY: framing.focusAnchorY,
    }
    : {}),
});

const parsePose = (value: unknown): StoryboardCameraPoseV1 | undefined => {
  if (!isRecord(value)) return undefined;
  const required = ['centerX', 'centerY', 'zoom', 'rollDegrees'];
  if (required.some((field) => !isFiniteNumber(value[field]))) return undefined;
  const hasFocusX = value.focusAnchorX !== undefined;
  const hasFocusY = value.focusAnchorY !== undefined;
  if (hasFocusX !== hasFocusY) return undefined;
  if (hasFocusX
      && (!isFiniteNumber(value.focusAnchorX) || !isFiniteNumber(value.focusAnchorY))) {
    return undefined;
  }
  return {
    centerX: clamp(value.centerX as number, 0, 1),
    centerY: clamp(value.centerY as number, 0, 1),
    zoom: clamp(value.zoom as number, 1, 16),
    rollDegrees: normalizedDegrees(value.rollDegrees as number),
    ...(hasFocusX
      ? {
        focusAnchorX: clamp(value.focusAnchorX as number, 0, 1),
        focusAnchorY: clamp(value.focusAnchorY as number, 0, 1),
      }
      : {}),
  };
};

const parseMotion = (
  value: unknown,
  duration: StoryboardMediaTimeV1,
): NormalizedMotion | undefined => {
  if (value === undefined || value === null) {
    return { enabled: false, keyframes: [] };
  }
  if (!isRecord(value)
      || value.version !== 1
      || typeof value.enabled !== 'boolean'
      || (value.mode !== 'keyframed' && value.mode !== 'performed')
      || !Array.isArray(value.keyframes)
      || value.keyframes.length > STORYBOARD_COVERAGE_POLICY_V1.maximumKeyframeCount) {
    return undefined;
  }

  const ids = new Set<string>();
  const times = new Set<string>();
  const keyframes: StoryboardCameraKeyframeV1[] = [];
  for (const raw of value.keyframes) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id.trim().length === 0) {
      return undefined;
    }
    const id = raw.id.trim();
    const time = normalizeTime(raw.time);
    const pose = parsePose(raw.pose);
    const easingRecord = isRecord(raw.easingFromPrevious)
      ? raw.easingFromPrevious : undefined;
    const easing = easingRecord?.kind;
    if (!time || !pose
        || !['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'].includes(
          easing as string,
        )
        || compareTime(time, { value: 0, timescale: 1 }) <= 0
        || compareTime(time, duration) > 0
        || Number.isNaN(compareTime(time, duration))
        || ids.has(id)
        || times.has(timeKey(time))) {
      return undefined;
    }
    ids.add(id);
    times.add(timeKey(time));
    keyframes.push({
      id,
      time,
      pose,
      easingFromPrevious: { kind: easing as StoryboardCameraEasingV1 },
    });
  }
  keyframes.sort((left, right) => compareTime(left.time, right.time));
  return { enabled: value.enabled, keyframes };
};

const easingProgress = (value: number, kind: StoryboardCameraEasingV1): number => {
  switch (kind) {
    case 'linear': return value;
    case 'easeIn': return value * value;
    case 'easeOut': {
      const inverse = 1 - value;
      return 1 - inverse * inverse;
    }
    case 'easeInOut': return value * value * (3 - 2 * value);
    case 'hold': return 0;
  }
};

const interpolatePose = (
  left: StoryboardCameraPoseV1,
  right: StoryboardCameraPoseV1,
  progress: number,
): StoryboardCameraPoseV1 => {
  const linear = (start: number, end: number): number => (
    start + (end - start) * progress
  );
  const rollDelta = normalizedDegrees(right.rollDegrees - left.rollDegrees);
  let focus: Pick<StoryboardCameraPoseV1, 'focusAnchorX' | 'focusAnchorY'> = {};
  if (left.focusAnchorX !== undefined && left.focusAnchorY !== undefined
      && right.focusAnchorX !== undefined && right.focusAnchorY !== undefined) {
    focus = {
      focusAnchorX: linear(left.focusAnchorX, right.focusAnchorX),
      focusAnchorY: linear(left.focusAnchorY, right.focusAnchorY),
    };
  } else if (left.focusAnchorX !== undefined && left.focusAnchorY !== undefined) {
    focus = { focusAnchorX: left.focusAnchorX, focusAnchorY: left.focusAnchorY };
  } else if (right.focusAnchorX !== undefined && right.focusAnchorY !== undefined) {
    focus = { focusAnchorX: right.focusAnchorX, focusAnchorY: right.focusAnchorY };
  }
  return {
    centerX: linear(left.centerX, right.centerX),
    centerY: linear(left.centerY, right.centerY),
    zoom: Math.exp(linear(Math.log(left.zoom), Math.log(right.zoom))),
    rollDegrees: normalizedDegrees(left.rollDegrees + rollDelta * progress),
    ...focus,
  };
};

const evaluatePose = (
  initial: StoryboardCameraPoseV1,
  motion: NormalizedMotion,
  duration: StoryboardMediaTimeV1,
  requestedTime: StoryboardMediaTimeV1,
): StoryboardCameraPoseV1 => {
  if (!motion.enabled || motion.keyframes.length === 0) return initial;
  const requestedSeconds = clamp(timeSeconds(requestedTime), 0, timeSeconds(duration));
  const exact = motion.keyframes.find((keyframe) => (
    compareTime(keyframe.time, requestedTime) === 0
  ));
  if (exact) return exact.pose;
  const rightIndex = motion.keyframes.findIndex((keyframe) => (
    timeSeconds(keyframe.time) > requestedSeconds
  ));
  if (rightIndex < 0) return motion.keyframes[motion.keyframes.length - 1].pose;
  const right = motion.keyframes[rightIndex];
  const left = rightIndex === 0 ? undefined : motion.keyframes[rightIndex - 1];
  const leftTime = left?.time ?? { value: 0, timescale: 1 };
  const leftPose = left?.pose ?? initial;
  const denominator = timeSeconds(right.time) - timeSeconds(leftTime);
  const rawProgress = denominator > 0
    ? (requestedSeconds - timeSeconds(leftTime)) / denominator
    : 0;
  return interpolatePose(
    leftPose,
    right.pose,
    easingProgress(clamp(rawProgress, 0, 1), right.easingFromPrevious.kind),
  );
};

const rotate = (x: number, y: number, degrees: number): StoryboardPointV1 => {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
};

const polygonArea = (polygon: StoryboardPointV1[]): number => {
  if (polygon.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += polygon[index].x * next.y - next.x * polygon[index].y;
  }
  return Math.abs(twiceArea) / 2;
};

const intersectionAtX = (
  start: StoryboardPointV1,
  end: StoryboardPointV1,
  x: number,
): StoryboardPointV1 => {
  const delta = end.x - start.x;
  if (Math.abs(delta) <= Number.EPSILON) return { x, y: start.y };
  const progress = (x - start.x) / delta;
  return { x, y: start.y + (end.y - start.y) * progress };
};

const intersectionAtY = (
  start: StoryboardPointV1,
  end: StoryboardPointV1,
  y: number,
): StoryboardPointV1 => {
  const delta = end.y - start.y;
  if (Math.abs(delta) <= Number.EPSILON) return { x: start.x, y };
  const progress = (y - start.y) / delta;
  return { x: start.x + (end.x - start.x) * progress, y };
};

const clipEdge = (
  polygon: StoryboardPointV1[],
  inside: (point: StoryboardPointV1) => boolean,
  intersection: (start: StoryboardPointV1, end: StoryboardPointV1) => StoryboardPointV1,
): StoryboardPointV1[] => {
  if (polygon.length === 0) return [];
  const output: StoryboardPointV1[] = [];
  let previous = polygon[polygon.length - 1];
  let previousInside = inside(previous);
  for (const current of polygon) {
    const currentInside = inside(current);
    if (currentInside) {
      if (!previousInside) output.push(intersection(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersection(previous, current));
    }
    previous = current;
    previousInside = currentInside;
  }
  return output;
};

const clipToUnitSquare = (polygon: StoryboardPointV1[]): StoryboardPointV1[] => {
  let result = polygon;
  result = clipEdge(result, (point) => point.x >= 0,
    (start, end) => intersectionAtX(start, end, 0));
  result = clipEdge(result, (point) => point.x <= 1,
    (start, end) => intersectionAtX(start, end, 1));
  result = clipEdge(result, (point) => point.y >= 0,
    (start, end) => intersectionAtY(start, end, 0));
  result = clipEdge(result, (point) => point.y <= 1,
    (start, end) => intersectionAtY(start, end, 1));
  return result;
};

const geometryForPose = (
  pose: StoryboardCameraPoseV1,
  sourceSize: StoryboardSizeV1,
  outputSize: StoryboardSizeV1,
): Geometry | undefined => {
  const aspectFillScale = Math.max(
    outputSize.width / sourceSize.width,
    outputSize.height / sourceSize.height,
  );
  const sourceScale = aspectFillScale * pose.zoom;
  if (!Number.isFinite(sourceScale) || sourceScale <= 0) return undefined;
  const centerX = pose.centerX * sourceSize.width;
  const centerY = pose.centerY * sourceSize.height;
  const viewportCorners = [
    { x: 0, y: 0 },
    { x: outputSize.width, y: 0 },
    { x: outputSize.width, y: outputSize.height },
    { x: 0, y: outputSize.height },
  ];
  const polygon = viewportCorners.map((point) => {
    const translatedX = (point.x - outputSize.width / 2) / sourceScale;
    const translatedY = (point.y - outputSize.height / 2) / sourceScale;
    const unrotated = rotate(translatedX, translatedY, -pose.rollDegrees);
    return {
      x: (centerX + unrotated.x) / sourceSize.width,
      y: (centerY + unrotated.y) / sourceSize.height,
    };
  });
  const visibleArea = polygonArea(polygon);
  if (!Number.isFinite(visibleArea) || visibleArea <= 0) return undefined;
  const coveredArea = polygonArea(clipToUnitSquare(polygon));
  let focusInViewport: StoryboardPointV1 | undefined;
  if (pose.focusAnchorX !== undefined && pose.focusAnchorY !== undefined) {
    const translatedX = pose.focusAnchorX * sourceSize.width - centerX;
    const translatedY = pose.focusAnchorY * sourceSize.height - centerY;
    const rotated = rotate(translatedX, translatedY, pose.rollDegrees);
    focusInViewport = {
      x: (outputSize.width / 2 + rotated.x * sourceScale) / outputSize.width,
      y: (outputSize.height / 2 + rotated.y * sourceScale) / outputSize.height,
    };
  }
  return {
    polygon,
    coverageFraction: clamp(coveredArea / visibleArea, 0, 1),
    sourcePixelsPerOutputPixel: 1 / sourceScale,
    ...(focusInViewport ? { focusInViewport } : {}),
  };
};

const cross = (
  origin: StoryboardPointV1,
  left: StoryboardPointV1,
  right: StoryboardPointV1,
): number => (
  (left.x - origin.x) * (right.y - origin.y)
    - (left.y - origin.y) * (right.x - origin.x)
);

const convexHull = (points: StoryboardPointV1[]): StoryboardPointV1[] => {
  const sorted = [...points].sort((left, right) => (
    left.x === right.x ? left.y - right.y : left.x - right.x
  ));
  const unique = sorted.filter((point, index) => (
    index === 0
      || point.x !== sorted[index - 1].x
      || point.y !== sorted[index - 1].y
  ));
  if (unique.length <= 2) return unique;
  const lower: StoryboardPointV1[] = [];
  for (const point of unique) {
    while (lower.length >= 2
        && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: StoryboardPointV1[] = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index];
    while (upper.length >= 2
        && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
};

const pointInConvexPolygon = (
  point: StoryboardPointV1,
  polygon: StoryboardPointV1[],
  epsilon: number,
): boolean => {
  if (polygon.length < 3) return false;
  let orientation = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const value = cross(start, end, point);
    if (Math.abs(value) <= epsilon) continue;
    const current = value > 0 ? 1 : -1;
    if (orientation === 0) orientation = current;
    else if (current !== orientation) return false;
  }
  return true;
};

const polygonsIntersect = (
  left: StoryboardPointV1[],
  right: StoryboardPointV1[],
  epsilon: number,
): boolean => {
  const polygons = [left, right];
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const axis = { x: -(end.y - start.y), y: end.x - start.x };
      const project = (points: StoryboardPointV1[]): [number, number] => {
        const values = points.map((point) => point.x * axis.x + point.y * axis.y);
        return [Math.min(...values), Math.max(...values)];
      };
      const [leftMin, leftMax] = project(left);
      const [rightMin, rightMax] = project(right);
      if (leftMax < rightMin - epsilon || rightMax < leftMin - epsilon) return false;
    }
  }
  return true;
};

const rectanglePolygon = (rect: StoryboardNormalizedRectV1): StoryboardPointV1[] => ([
  { x: rect.minX, y: rect.minY },
  { x: rect.minX + rect.width, y: rect.minY },
  { x: rect.minX + rect.width, y: rect.minY + rect.height },
  { x: rect.minX, y: rect.minY + rect.height },
]);

const parseNormalizedRect = (value: unknown): StoryboardNormalizedRectV1 | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)
      || !isFiniteNumber(value.minX)
      || !isFiniteNumber(value.minY)
      || !isFiniteNumber(value.width)
      || !isFiniteNumber(value.height)
      || value.width <= 0
      || value.height <= 0) {
    return undefined;
  }
  const minX = clamp(value.minX, 0, 1);
  const minY = clamp(value.minY, 0, 1);
  const maxX = clamp(value.minX + value.width, 0, 1);
  const maxY = clamp(value.minY + value.height, 0, 1);
  if (maxX <= minX || maxY <= minY) return undefined;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
};

const projectFrameRateIsAllowed = (rate: StoryboardMediaTimeV1): boolean => (
  STORYBOARD_COVERAGE_POLICY_V1.allowedProjectFrameRates.some((allowed) => (
    compareTime(rate, allowed) === 0
  ))
);

const addExportTimes = (
  times: Map<string, StoryboardMediaTimeV1>,
  duration: StoryboardMediaTimeV1,
  frameRate: StoryboardMediaTimeV1,
): boolean => {
  const frameCountNumerator = duration.value * frameRate.value;
  const frameCountDenominator = duration.timescale * frameRate.timescale;
  if (!Number.isSafeInteger(frameCountNumerator)
      || !Number.isSafeInteger(frameCountDenominator)
      || frameCountDenominator <= 0) return false;
  const finalFrameIndex = Math.floor(frameCountNumerator / frameCountDenominator);
  if (finalFrameIndex + 1 > STORYBOARD_COVERAGE_POLICY_V1.maximumEvaluationSampleCount) {
    return false;
  }
  for (let frameIndex = 0; frameIndex <= finalFrameIndex; frameIndex += 1) {
    const value = frameIndex * frameRate.timescale;
    if (!Number.isSafeInteger(value)) return false;
    const time = normalizeTime({ value, timescale: frameRate.value });
    if (!time) return false;
    times.set(timeKey(time), time);
  }
  times.set(timeKey(duration), duration);
  return true;
};

const segmentList = (
  motion: NormalizedMotion,
  duration: StoryboardMediaTimeV1,
): MotionSegment[] => {
  if (!motion.enabled || motion.keyframes.length === 0) return [];
  const segments: MotionSegment[] = [];
  let left: StoryboardMediaTimeV1 = { value: 0, timescale: 1 };
  for (const keyframe of motion.keyframes) {
    segments.push({
      left,
      right: keyframe.time,
      easing: keyframe.easingFromPrevious.kind,
    });
    left = keyframe.time;
  }
  if (compareTime(left, duration) < 0) {
    segments.push({ left, right: duration, easing: 'static' });
  }
  return segments;
};

const polygonMidpointDeviation = (
  left: StoryboardPointV1[],
  midpoint: StoryboardPointV1[],
  right: StoryboardPointV1[],
): number => {
  let maximum = 0;
  for (let index = 0; index < midpoint.length; index += 1) {
    const expectedX = (left[index].x + right[index].x) / 2;
    const expectedY = (left[index].y + right[index].y) / 2;
    maximum = Math.max(
      maximum,
      Math.hypot(midpoint[index].x - expectedX, midpoint[index].y - expectedY),
    );
  }
  return maximum;
};

const addAdaptiveTimes = (
  times: Map<string, StoryboardMediaTimeV1>,
  segments: MotionSegment[],
  evaluateGeometry: (time: StoryboardMediaTimeV1) => Geometry | undefined,
): boolean => {
  let converged = true;
  const visit = (
    left: StoryboardMediaTimeV1,
    right: StoryboardMediaTimeV1,
    depth: number,
  ): void => {
    if (!converged) return;
    const midpoint = midpointTime(left, right);
    if (!midpoint
        || compareTime(midpoint, left) <= 0
        || compareTime(midpoint, right) >= 0) {
      converged = false;
      return;
    }
    times.set(timeKey(midpoint), midpoint);
    if (times.size > STORYBOARD_COVERAGE_POLICY_V1.maximumEvaluationSampleCount) {
      converged = false;
      return;
    }
    const leftGeometry = evaluateGeometry(left);
    const midpointGeometry = evaluateGeometry(midpoint);
    const rightGeometry = evaluateGeometry(right);
    if (!leftGeometry || !midpointGeometry || !rightGeometry) {
      converged = false;
      return;
    }
    const error = polygonMidpointDeviation(
      leftGeometry.polygon,
      midpointGeometry.polygon,
      rightGeometry.polygon,
    );
    if (error <= STORYBOARD_COVERAGE_POLICY_V1.maximumCurveErrorNormalized) return;
    if (depth >= STORYBOARD_COVERAGE_POLICY_V1.maximumSubdivisionDepth) {
      converged = false;
      return;
    }
    visit(left, midpoint, depth + 1);
    visit(midpoint, right, depth + 1);
  };
  for (const segment of segments) {
    if (segment.easing === 'hold' || segment.easing === 'static') continue;
    visit(segment.left, segment.right, 0);
  }
  return converged;
};

const emptyReport = (
  code: StoryboardCoverageIssueCode,
): StoryboardCoverageReportV1 => ({
  policyVersion: 1,
  classification: 'blocking',
  issues: [{ code, severity: 'blocking' }],
  blockingCodes: [code],
  warningCodes: [],
  infoCodes: [],
  evaluatedSampleCount: 0,
  evaluatedTimes: [],
  minimumCoverageFraction: 0,
  minimumSourcePixelsPerOutputPixel: 0,
});

const validSize = (value: unknown): value is StoryboardSizeV1 => (
  isRecord(value)
    && isFiniteNumber(value.width)
    && isFiniteNumber(value.height)
    && value.width > 0
    && value.height > 0
);

/**
 * Evaluate static t=0 coverage or one v1 camera path. The function never
 * repairs the document or blocks persistence; callers use `classification`
 * to gate playback/export/generation while still retaining recoverable drafts.
 */
export const evaluateStoryboardCoverageV1 = (
  value: unknown,
): StoryboardCoverageReportV1 => {
  if (!isRecord(value) || value.policyVersion !== 1) {
    return emptyReport('unsupported_policy_version');
  }
  if (!validSize(value.sourceSize) || !validSize(value.outputSize)) {
    return emptyReport('invalid_dimensions');
  }
  const sourceSize = value.sourceSize;
  const outputSize = value.outputSize;
  const initialFraming = parseFraming(value.initialFraming);
  if (!initialFraming) return emptyReport('invalid_framing');

  const rawMotion = value.motionTrack;
  const hasTrackKeyframes = isRecord(rawMotion)
    && Array.isArray(rawMotion.keyframes)
    && rawMotion.keyframes.length > 0;
  const hasEffectiveMotion = hasTrackKeyframes && rawMotion.enabled === true;
  const duration = hasTrackKeyframes
    ? normalizeTime(value.shotDuration)
    : { value: 0, timescale: 1 };
  if (!duration
      || (hasEffectiveMotion
        && (duration.value <= 0
          || timeSeconds(duration) > STORYBOARD_COVERAGE_POLICY_V1.maximumDurationSeconds))) {
    return emptyReport('invalid_motion_track');
  }
  const motion = parseMotion(rawMotion, duration);
  if (!motion) return emptyReport('invalid_motion_track');

  const frameRate = normalizeTime(
    value.projectFrameRate ?? STORYBOARD_COVERAGE_POLICY_V1.legacyProjectFrameRate,
  );
  if (!frameRate || frameRate.value <= 0 || !projectFrameRateIsAllowed(frameRate)) {
    return emptyReport('unsupported_project_frame_rate');
  }
  const criticalSubjectBounds = parseNormalizedRect(value.criticalSubjectBounds);
  if (value.criticalSubjectBounds !== undefined && !criticalSubjectBounds) {
    return emptyReport('invalid_framing');
  }

  const initialPose = poseFromFraming(initialFraming);
  const geometryAt = (time: StoryboardMediaTimeV1): Geometry | undefined => (
    geometryForPose(
      evaluatePose(initialPose, motion, duration, time),
      sourceSize,
      outputSize,
    )
  );
  const times = new Map<string, StoryboardMediaTimeV1>();
  const zero = { value: 0, timescale: 1 };
  times.set(timeKey(zero), zero);
  if (hasEffectiveMotion) {
    if (!addExportTimes(times, duration, frameRate)) {
      return emptyReport('coverage_non_convergent');
    }
    for (const keyframe of motion.keyframes) {
      times.set(timeKey(keyframe.time), keyframe.time);
    }
    if (!addAdaptiveTimes(times, segmentList(motion, duration), geometryAt)) {
      return emptyReport('coverage_non_convergent');
    }
  }
  const evaluatedTimes = [...times.values()].sort(compareTime);

  const issues = new Map<StoryboardCoverageIssueCode, StoryboardCoverageIssueV1>();
  const addIssue = (
    code: StoryboardCoverageIssueCode,
    severity: StoryboardCoverageSeverity,
    time?: StoryboardMediaTimeV1,
  ): void => {
    if (!issues.has(code)) issues.set(code, { code, severity, ...(time ? { time } : {}) });
  };

  const aspectDifference = Math.abs(
    outputSize.width / outputSize.height - initialFraming.aspectRatio,
  ) / initialFraming.aspectRatio;
  if (aspectDifference > STORYBOARD_COVERAGE_POLICY_V1.aspectRatioTolerance) {
    addIssue('aspect_ratio_mismatch', 'warning');
  }

  let minimumCoverage = 1;
  let minimumResolution = Number.POSITIVE_INFINITY;
  const visiblePoints: StoryboardPointV1[] = [];
  const subjectPolygon = criticalSubjectBounds
    ? rectanglePolygon(criticalSubjectBounds) : undefined;
  for (const time of evaluatedTimes) {
    const geometry = geometryAt(time);
    if (!geometry) return emptyReport('empty_viewport');
    visiblePoints.push(...geometry.polygon);
    minimumCoverage = Math.min(minimumCoverage, geometry.coverageFraction);
    minimumResolution = Math.min(
      minimumResolution,
      geometry.sourcePixelsPerOutputPixel,
    );
    if (geometry.coverageFraction <= STORYBOARD_COVERAGE_POLICY_V1.containmentEpsilon) {
      addIssue('empty_viewport', 'blocking', time);
    } else if (geometry.coverageFraction
        < STORYBOARD_COVERAGE_POLICY_V1.minimumCoverageFraction) {
      addIssue('uncovered_viewport', 'blocking', time);
    } else if (geometry.coverageFraction
        < STORYBOARD_COVERAGE_POLICY_V1.largeEmptyCornerWarningFraction) {
      addIssue('large_empty_corners', 'warning', time);
    }
    if (geometry.sourcePixelsPerOutputPixel
        < STORYBOARD_COVERAGE_POLICY_V1.minimumSourcePixelsPerOutputPixel) {
      addIssue('low_source_resolution', 'warning', time);
    }
    const pose = evaluatePose(initialPose, motion, duration, time);
    if (pose.zoom >= STORYBOARD_COVERAGE_POLICY_V1.aggressiveDigitalZoom) {
      addIssue('aggressive_digital_zoom', 'warning', time);
    }
    const focus = geometry.focusInViewport;
    const safeInset = STORYBOARD_COVERAGE_POLICY_V1.focusSafeAreaInset;
    if (focus && (focus.x < safeInset || focus.x > 1 - safeInset
        || focus.y < safeInset || focus.y > 1 - safeInset)) {
      addIssue('focus_near_crop_edge', 'warning', time);
    }
    if (subjectPolygon && !polygonsIntersect(
      geometry.polygon,
      subjectPolygon,
      STORYBOARD_COVERAGE_POLICY_V1.containmentEpsilon,
    )) {
      addIssue('critical_subject_outside', 'blocking', time);
    }
  }

  const sweptHull = convexHull(visiblePoints);
  const asset = isRecord(value.asset) ? value.asset : { kind: 'source_space' };
  if (asset.kind !== 'source_space' && asset.kind !== 'viewport_raster') {
    return emptyReport('invalid_framing');
  }
  if (asset.kind === 'viewport_raster') {
    const placement = parseFraming(asset.rasterPlacementFraming);
    if (!placement) return emptyReport('invalid_framing');
    const placementOutputSize = {
      width: outputSize.width,
      height: outputSize.width / placement.aspectRatio,
    };
    const available = geometryForPose(
      poseFromFraming(placement), sourceSize, placementOutputSize,
    )?.polygon;
    if (!available || sweptHull.some((point) => !pointInConvexPolygon(
      point,
      available,
      STORYBOARD_COVERAGE_POLICY_V1.containmentEpsilon,
    ))) {
      addIssue('motion_plate_required', 'blocking');
      addIssue('provider_may_synthesize_outside_source', 'info');
    }
  }

  const xs = sweptHull.map((point) => point.x);
  const ys = sweptHull.map((point) => point.y);
  const sweptVisibleBounds = sweptHull.length > 0 ? {
    minX: roundMetric(Math.min(...xs)),
    minY: roundMetric(Math.min(...ys)),
    width: roundMetric(Math.max(...xs) - Math.min(...xs)),
    height: roundMetric(Math.max(...ys) - Math.min(...ys)),
  } : undefined;

  const orderedIssues = [...issues.values()].sort((left, right) => (
    severityOrder[left.severity] - severityOrder[right.severity]
      || (left.code === right.code ? 0 : left.code < right.code ? -1 : 1)
  ));
  const blockingCodes = orderedIssues
    .filter((issue) => issue.severity === 'blocking').map((issue) => issue.code);
  const warningCodes = orderedIssues
    .filter((issue) => issue.severity === 'warning').map((issue) => issue.code);
  const infoCodes = orderedIssues
    .filter((issue) => issue.severity === 'info').map((issue) => issue.code);
  return {
    policyVersion: 1,
    classification: blockingCodes.length > 0
      ? 'blocking' : warningCodes.length > 0 ? 'warning' : 'valid',
    issues: orderedIssues,
    blockingCodes,
    warningCodes,
    infoCodes,
    evaluatedSampleCount: evaluatedTimes.length,
    evaluatedTimes,
    minimumCoverageFraction: roundMetric(minimumCoverage),
    minimumSourcePixelsPerOutputPixel: roundMetric(minimumResolution),
    ...(sweptVisibleBounds ? { sweptVisibleBounds } : {}),
  };
};
