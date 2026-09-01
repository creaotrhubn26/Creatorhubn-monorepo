import { createHash } from "node:crypto";

import { shotFramingFingerprint } from "../../frontend/shared/storyboard-shot-framing.js";
import {
  STORYBOARD_COVERAGE_POLICY_V1,
  evaluateStoryboardCoverageV1,
  type StoryboardCameraEasingV1,
  type StoryboardCameraKeyframeV1,
  type StoryboardCameraMotionTrackV1,
  type StoryboardCameraPoseV1,
  type StoryboardCoverageInputV1,
  type StoryboardCoverageIssueCode,
  type StoryboardCoverageIssueV1,
  type StoryboardCoverageReportV1,
  type StoryboardMediaTimeV1,
} from "../../frontend/shared/storyboard-coverage-policy.js";
import {
  legacySecondsToShotDurationV1,
  normalizeShotDurationV1,
  normalizeStoryboardMediaTimeV1,
  storyboardMediaTimesEqualV1,
} from "./storyboard-shot-duration.js";

export { STORYBOARD_COVERAGE_POLICY_V1, evaluateStoryboardCoverageV1 };
export type {
  StoryboardCameraKeyframeV1,
  StoryboardCameraMotionTrackV1,
  StoryboardCameraPoseV1,
  StoryboardCoverageInputV1,
  StoryboardCoverageIssueCode,
  StoryboardCoverageIssueV1,
  StoryboardCoverageReportV1,
  StoryboardMediaTimeV1,
};

export const STORYBOARD_CAMERA_MOTION_V1 = Object.freeze({
  version: 1 as const,
  maximumPayloadBytes: 64 * 1024,
  maximumPayloadDepth: 16,
  maximumKeyframeCount: STORYBOARD_COVERAGE_POLICY_V1.maximumKeyframeCount,
  maximumTimeTimescale: STORYBOARD_COVERAGE_POLICY_V1.maximumTimeTimescale,
  maximumIdentifierLength: 128,
  maximumPresetIdentifierLength: 128,
});

export const CAMERA_MOTION_ENVELOPE_FIELDS = [
  "cameraMotionTrack",
  "cameraMotionRevision",
  "cameraMotionUpdatedAt",
  "cameraMotionFingerprint",
  "cameraMotionBaseFramingFingerprint",
  "cameraMotionStatus",
] as const;

export type CameraMotionStatusV1 = "valid" | "needsRebase" | "invalid";
export type CameraMotionWriteErrorCode =
  | "camera_motion_required"
  | "invalid_expected_motion_revision"
  | "invalid_camera_motion_track"
  | "unsupported_camera_motion_version"
  | "camera_motion_payload_too_large"
  | "camera_motion_payload_too_deep"
  | "invalid_camera_motion_state"
  | "camera_motion_revision_conflict"
  | "camera_motion_upgrade_required";

export interface CameraMotionEnvelopeV1 {
  cameraMotionTrack: StoryboardCameraMotionTrackV1 | null;
  cameraMotionRevision: number;
  cameraMotionUpdatedAt: string;
  cameraMotionFingerprint: string | null;
  cameraMotionBaseFramingFingerprint: string | null;
  cameraMotionStatus: CameraMotionStatusV1;
}

export type AppliedCameraMotionWriteV1 = CameraMotionEnvelopeV1 & {
  changed: boolean;
  updatedAt: string;
  sourceUpdatedAt?: string;
};

export type ApplyCameraMotionWriteResultV1 =
  | { ok: true; value: AppliedCameraMotionWriteV1 }
  | {
      ok: false;
      error: CameraMotionWriteErrorCode;
      currentCameraMotionTrack: unknown;
      currentCameraMotionRevision: number;
      currentCameraMotionUpdatedAt: string;
      currentCameraMotionFingerprint: string | null;
      currentCameraMotionBaseFramingFingerprint: string | null;
      currentCameraMotionStatus: CameraMotionStatusV1;
    };

type JsonRecord = Record<string, unknown>;
type NormalizedTrackResult =
  | { ok: true; value: StoryboardCameraMotionTrackV1 }
  | { ok: false; error: CameraMotionWriteErrorCode };

const TRACK_V1_FIELDS = new Set([
  "version",
  "enabled",
  "mode",
  "presetId",
  "keyframes",
]);
const KEYFRAME_V1_FIELDS = new Set([
  "id",
  "time",
  "pose",
  "easingFromPrevious",
]);
const MEDIA_TIME_V1_FIELDS = new Set(["value", "timescale"]);
const POSE_V1_FIELDS = new Set([
  "centerX",
  "centerY",
  "zoom",
  "rollDegrees",
  "focusAnchorX",
  "focusAnchorY",
]);
const EASING_V1_FIELDS = new Set(["kind"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyFields(
  value: JsonRecord,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  const result = Math.min(maximum, Math.max(minimum, value));
  return Object.is(result, -0) ? 0 : result;
}

function normalizeDegrees(value: number): number {
  const modulo = ((value % 360) + 360) % 360;
  const result = modulo > 180 ? modulo - 360 : modulo;
  return Object.is(result, -0) ? 0 : result;
}

function compareTime(
  left: StoryboardMediaTimeV1,
  right: StoryboardMediaTimeV1,
): number {
  const lhs = BigInt(left.value) * BigInt(right.timescale);
  const rhs = BigInt(right.value) * BigInt(left.timescale);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

function greatestCommonDivisorBigInt(lhs: bigint, rhs: bigint): bigint {
  let left = lhs < BigInt(0) ? -lhs : lhs;
  let right = rhs < BigInt(0) ? -rhs : rhs;
  while (right !== BigInt(0)) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left === BigInt(0) ? BigInt(1) : left;
}

function retimeMediaTimeExactV1(
  time: StoryboardMediaTimeV1,
  oldDuration: StoryboardMediaTimeV1,
  newDuration: StoryboardMediaTimeV1,
): StoryboardMediaTimeV1 | null {
  // (time / oldDuration) * newDuration. BigInt keeps the ratio exact before
  // reduction; converting earlier would silently move authored keyframes.
  let numerator =
    BigInt(time.value) *
    BigInt(oldDuration.timescale) *
    BigInt(newDuration.value);
  let denominator =
    BigInt(time.timescale) *
    BigInt(oldDuration.value) *
    BigInt(newDuration.timescale);
  if (numerator <= BigInt(0) || denominator <= BigInt(0)) return null;
  const divisor = greatestCommonDivisorBigInt(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;
  if (
    numerator > BigInt(Number.MAX_SAFE_INTEGER) ||
    denominator > BigInt(STORYBOARD_CAMERA_MOTION_V1.maximumTimeTimescale)
  ) {
    return null;
  }
  return {
    value: Number(numerator),
    timescale: Number(denominator),
  };
}

function serializedSize(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined
      ? null
      : Buffer.byteLength(serialized, "utf8");
  } catch {
    return null;
  }
}

function payloadDepthWithinLimit(value: unknown): boolean {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 1 }];
  const visited = new Set<object>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current.depth > STORYBOARD_CAMERA_MOTION_V1.maximumPayloadDepth)
      return false;
    if (!current.value || typeof current.value !== "object") continue;
    if (visited.has(current.value as object)) return false;
    visited.add(current.value as object);
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as JsonRecord);
    for (const child of children) {
      if (child && typeof child === "object") {
        stack.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  return true;
}

function normalizePose(value: unknown): StoryboardCameraPoseV1 | null {
  if (!isRecord(value) || !hasOnlyFields(value, POSE_V1_FIELDS)) return null;
  if (
    !finiteNumber(value.centerX) ||
    !finiteNumber(value.centerY) ||
    !finiteNumber(value.zoom) ||
    !finiteNumber(value.rollDegrees)
  )
    return null;
  const hasFocusX = Object.prototype.hasOwnProperty.call(value, "focusAnchorX");
  const hasFocusY = Object.prototype.hasOwnProperty.call(value, "focusAnchorY");
  if (hasFocusX !== hasFocusY) return null;
  if (
    hasFocusX &&
    (!finiteNumber(value.focusAnchorX) || !finiteNumber(value.focusAnchorY))
  )
    return null;
  return {
    centerX: clamp(value.centerX, 0, 1),
    centerY: clamp(value.centerY, 0, 1),
    zoom: clamp(value.zoom, 1, 16),
    rollDegrees: normalizeDegrees(value.rollDegrees),
    ...(hasFocusX
      ? {
          focusAnchorX: clamp(value.focusAnchorX as number, 0, 1),
          focusAnchorY: clamp(value.focusAnchorY as number, 0, 1),
        }
      : {}),
  };
}

function normalizeEasing(
  value: unknown,
): { kind: StoryboardCameraEasingV1 } | null {
  if (!isRecord(value) || !hasOnlyFields(value, EASING_V1_FIELDS)) return null;
  const kind = value.kind;
  return kind === "linear" ||
    kind === "easeIn" ||
    kind === "easeOut" ||
    kind === "easeInOut" ||
    kind === "hold"
    ? { kind }
    : null;
}

/** Strict v1 write boundary; unknown versions are preserved by reads, not edited. */
export function normalizeCameraMotionTrackV1(
  rawTrack: unknown,
  shotDuration: StoryboardMediaTimeV1,
): NormalizedTrackResult {
  const size = serializedSize(rawTrack);
  if (size === null) return { ok: false, error: "invalid_camera_motion_track" };
  if (size > STORYBOARD_CAMERA_MOTION_V1.maximumPayloadBytes) {
    return { ok: false, error: "camera_motion_payload_too_large" };
  }
  if (!payloadDepthWithinLimit(rawTrack)) {
    return { ok: false, error: "camera_motion_payload_too_deep" };
  }
  if (!isRecord(rawTrack))
    return { ok: false, error: "invalid_camera_motion_track" };
  if (rawTrack.version !== 1) {
    return {
      ok: false,
      error: Number.isSafeInteger(rawTrack.version)
        ? "unsupported_camera_motion_version"
        : "invalid_camera_motion_track",
    };
  }
  if (!hasOnlyFields(rawTrack, TRACK_V1_FIELDS)) {
    return { ok: false, error: "invalid_camera_motion_track" };
  }
  if (
    typeof rawTrack.enabled !== "boolean" ||
    (rawTrack.mode !== "keyframed" && rawTrack.mode !== "performed") ||
    !Array.isArray(rawTrack.keyframes) ||
    rawTrack.keyframes.length > STORYBOARD_CAMERA_MOTION_V1.maximumKeyframeCount
  ) {
    return { ok: false, error: "invalid_camera_motion_track" };
  }
  const presetId =
    rawTrack.presetId === undefined || rawTrack.presetId === null
      ? undefined
      : typeof rawTrack.presetId === "string"
        ? rawTrack.presetId.trim()
        : null;
  if (
    presetId === null ||
    (presetId?.length ?? 0) >
      STORYBOARD_CAMERA_MOTION_V1.maximumPresetIdentifierLength
  ) {
    return { ok: false, error: "invalid_camera_motion_track" };
  }
  const ids = new Set<string>();
  const times = new Set<string>();
  const keyframes: StoryboardCameraKeyframeV1[] = [];
  for (const raw of rawTrack.keyframes) {
    if (
      !isRecord(raw) ||
      !hasOnlyFields(raw, KEYFRAME_V1_FIELDS) ||
      typeof raw.id !== "string" ||
      !isRecord(raw.time) ||
      !hasOnlyFields(raw.time, MEDIA_TIME_V1_FIELDS)
    ) {
      return { ok: false, error: "invalid_camera_motion_track" };
    }
    const id = raw.id.trim();
    const time = normalizeStoryboardMediaTimeV1(raw.time);
    const pose = normalizePose(raw.pose);
    const easing = normalizeEasing(raw.easingFromPrevious);
    const timeKey = time ? `${time.value}/${time.timescale}` : "";
    if (
      !id ||
      id.length > STORYBOARD_CAMERA_MOTION_V1.maximumIdentifierLength ||
      !time ||
      time.timescale > STORYBOARD_CAMERA_MOTION_V1.maximumTimeTimescale ||
      compareTime(time, { value: 0, timescale: 1 }) <= 0 ||
      compareTime(time, shotDuration) > 0 ||
      !pose ||
      !easing ||
      ids.has(id) ||
      times.has(timeKey)
    ) {
      return { ok: false, error: "invalid_camera_motion_track" };
    }
    ids.add(id);
    times.add(timeKey);
    keyframes.push({ id, time, pose, easingFromPrevious: easing });
  }
  keyframes.sort((left, right) => compareTime(left.time, right.time));
  return {
    ok: true,
    value: {
      version: 1,
      enabled: rawTrack.enabled,
      mode: rawTrack.mode,
      ...(presetId ? { presetId } : {}),
      keyframes,
    },
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function canonicalJSON(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** Canonical pixel identity; editor keyframe IDs and preset labels are excluded. */
export function cameraMotionRenderFingerprintV1(
  track: StoryboardCameraMotionTrackV1,
  shotDuration: StoryboardMediaTimeV1,
): string {
  const identity = {
    version: 1,
    enabled: track.enabled,
    mode: track.mode,
    shotDuration,
    keyframes: track.keyframes.map((keyframe) => ({
      time: keyframe.time,
      pose: keyframe.pose,
      easingFromPrevious: keyframe.easingFromPrevious,
    })),
  };
  return `sha256:${createHash("sha256").update(canonicalJSON(identity)).digest("hex")}`;
}

/** Proportionally retimes every keyframe with exact reduced rational math. */
export function retimeCameraMotionTrackV1(
  rawTrack: unknown,
  rawOldDuration: unknown,
  rawNewDuration: unknown,
): StoryboardCameraMotionTrackV1 | null {
  const oldDuration = normalizeShotDurationV1(rawOldDuration);
  const newDuration = normalizeShotDurationV1(rawNewDuration);
  if (!oldDuration || !newDuration) return null;
  const normalized = normalizeCameraMotionTrackV1(rawTrack, oldDuration);
  if (!normalized.ok) return null;
  const keyframes: StoryboardCameraKeyframeV1[] = [];
  for (const keyframe of normalized.value.keyframes) {
    const time = retimeMediaTimeExactV1(
      keyframe.time,
      oldDuration,
      newDuration,
    );
    if (!time) return null;
    keyframes.push({ ...keyframe, time });
  }
  const retimed = { ...normalized.value, keyframes };
  const validated = normalizeCameraMotionTrackV1(retimed, newDuration);
  return validated.ok ? validated.value : null;
}

export function cameraMotionShotDurationFromFrameV1(
  rawFrame: unknown,
): StoryboardMediaTimeV1 | null {
  if (!isRecord(rawFrame)) return null;
  if (Object.prototype.hasOwnProperty.call(rawFrame, "shotDuration")) {
    return normalizeShotDurationV1(rawFrame.shotDuration);
  }
  const hasDuration = Object.prototype.hasOwnProperty.call(
    rawFrame,
    "duration",
  );
  const hasDurationSec = Object.prototype.hasOwnProperty.call(
    rawFrame,
    "durationSec",
  );
  const duration = hasDuration
    ? legacySecondsToShotDurationV1(rawFrame.duration)
    : null;
  const durationSec = hasDurationSec
    ? legacySecondsToShotDurationV1(rawFrame.durationSec)
    : null;
  if ((hasDuration && !duration) || (hasDurationSec && !durationSec))
    return null;
  if (
    duration &&
    durationSec &&
    !storyboardMediaTimesEqualV1(duration, durationSec)
  ) {
    return null;
  }
  return duration ?? durationSec ?? { value: 2, timescale: 1 };
}

export function cameraMotionFramingFingerprintFromFrameV1(
  rawFrame: unknown,
): string | null {
  if (!isRecord(rawFrame)) return null;
  const drawing = isRecord(rawFrame.drawingData) ? rawFrame.drawingData : {};
  const width =
    finiteNumber(drawing.width) && drawing.width > 0 ? drawing.width : 1920;
  const height =
    finiteNumber(drawing.height) && drawing.height > 0 ? drawing.height : 1080;
  return (
    shotFramingFingerprint(
      isRecord(rawFrame.shotFraming)
        ? rawFrame.shotFraming
        : {
            shotSize: rawFrame.shotType,
            angle: rawFrame.angle,
            lensMm: rawFrame.lensMm,
            aspectRatio: width / height,
          },
    ) ?? null
  );
}

function readRevision(frame: JsonRecord): number | null {
  const revision = frame.cameraMotionRevision;
  if (revision === undefined || revision === null) return 0;
  return Number.isSafeInteger(revision) && (revision as number) >= 0
    ? (revision as number)
    : null;
}

function readStatus(
  frame: JsonRecord,
  fallback: CameraMotionStatusV1,
): CameraMotionStatusV1 {
  return frame.cameraMotionStatus === "valid" ||
    frame.cameraMotionStatus === "needsRebase" ||
    frame.cameraMotionStatus === "invalid"
    ? frame.cameraMotionStatus
    : fallback;
}

function inspectCurrent(
  frame: JsonRecord,
  duration: StoryboardMediaTimeV1 | null,
) {
  const rawTrack = frame.cameraMotionTrack;
  let kind: "none" | "valid" | "invalid" | "future" = "none";
  let track: StoryboardCameraMotionTrackV1 | null = null;
  const rawSize =
    rawTrack === undefined || rawTrack === null ? 0 : serializedSize(rawTrack);
  const rawIsBounded =
    rawSize !== null &&
    rawSize <= STORYBOARD_CAMERA_MOTION_V1.maximumPayloadBytes &&
    payloadDepthWithinLimit(rawTrack);
  if (rawTrack !== undefined && rawTrack !== null) {
    if (!rawIsBounded) kind = "invalid";
    else if (
      isRecord(rawTrack) &&
      Number.isSafeInteger(rawTrack.version) &&
      (rawTrack.version as number) > STORYBOARD_CAMERA_MOTION_V1.version
    )
      kind = "future";
    else if (isRecord(rawTrack) && rawTrack.version !== 1) kind = "invalid";
    else if (!duration) kind = "invalid";
    else {
      const parsed = normalizeCameraMotionTrackV1(rawTrack, duration);
      if (parsed.ok) {
        kind = "valid";
        track = parsed.value;
      } else
        kind =
          parsed.error === "unsupported_camera_motion_version"
            ? "future"
            : "invalid";
    }
  }
  const revision = readRevision(frame);
  const fallback: CameraMotionStatusV1 =
    kind === "invalid" || kind === "future" ? "invalid" : "valid";
  return {
    rawTrack,
    rawIsBounded,
    kind,
    track,
    revision,
    updatedAt:
      typeof frame.cameraMotionUpdatedAt === "string"
        ? frame.cameraMotionUpdatedAt
        : typeof frame.updatedAt === "string"
          ? frame.updatedAt
          : "",
    fingerprint:
      typeof frame.cameraMotionFingerprint === "string"
        ? frame.cameraMotionFingerprint
        : null,
    baseFingerprint:
      typeof frame.cameraMotionBaseFramingFingerprint === "string"
        ? frame.cameraMotionBaseFramingFingerprint
        : null,
    status:
      kind === "invalid" || kind === "future"
        ? "invalid"
        : readStatus(frame, fallback),
  };
}

/** Full stored sidecar projection for duration acknowledgements and no-ops. */
export function cameraMotionEnvelopeSnapshotV1(rawFrame: unknown): JsonRecord {
  if (!isRecord(rawFrame)) return {};
  const hasEnvelope = CAMERA_MOTION_ENVELOPE_FIELDS.some((key) =>
    Object.prototype.hasOwnProperty.call(rawFrame, key),
  );
  if (!hasEnvelope) return {};
  const state = inspectCurrent(
    rawFrame,
    cameraMotionShotDurationFromFrameV1(rawFrame),
  );
  return {
    cameraMotionTrack: state.rawTrack ?? null,
    cameraMotionRevision: state.revision ?? 0,
    cameraMotionUpdatedAt: state.updatedAt,
    cameraMotionFingerprint: state.fingerprint,
    cameraMotionBaseFramingFingerprint: state.baseFingerprint,
    cameraMotionStatus: state.status,
  };
}

function failure(
  error: CameraMotionWriteErrorCode,
  state: ReturnType<typeof inspectCurrent>,
): ApplyCameraMotionWriteResultV1 {
  return {
    ok: false,
    error,
    currentCameraMotionTrack: state.rawIsBounded
      ? (state.rawTrack ?? null)
      : null,
    currentCameraMotionRevision: state.revision ?? 0,
    currentCameraMotionUpdatedAt: state.updatedAt,
    currentCameraMotionFingerprint: state.fingerprint,
    currentCameraMotionBaseFramingFingerprint: state.baseFingerprint,
    currentCameraMotionStatus: state.status,
  };
}

/** Validates, canonicalizes and applies one OCC mutation without performing I/O. */
export function applyCameraMotionWriteV1(
  rawFrame: unknown,
  rawRequest: unknown,
  changedAt: string,
): ApplyCameraMotionWriteResultV1 {
  if (!isRecord(rawFrame)) {
    return failure("invalid_camera_motion_state", inspectCurrent({}, null));
  }
  const duration = cameraMotionShotDurationFromFrameV1(rawFrame);
  const state = inspectCurrent(rawFrame, duration);
  if (!duration) return failure("invalid_camera_motion_state", state);
  if (
    !isRecord(rawRequest) ||
    !Object.prototype.hasOwnProperty.call(rawRequest, "cameraMotionTrack")
  ) {
    return failure("camera_motion_required", state);
  }
  if (
    !Object.prototype.hasOwnProperty.call(
      rawRequest,
      "expectedMotionRevision",
    ) ||
    !Number.isSafeInteger(rawRequest.expectedMotionRevision) ||
    (rawRequest.expectedMotionRevision as number) < 0
  ) {
    return failure("invalid_expected_motion_revision", state);
  }
  if (state.revision === null)
    return failure("invalid_camera_motion_state", state);
  if (state.kind === "future")
    return failure("camera_motion_upgrade_required", state);
  if (rawRequest.expectedMotionRevision !== state.revision) {
    return failure("camera_motion_revision_conflict", state);
  }
  let requested: StoryboardCameraMotionTrackV1 | null;
  if (rawRequest.cameraMotionTrack === null) requested = null;
  else {
    const parsed = normalizeCameraMotionTrackV1(
      rawRequest.cameraMotionTrack,
      duration,
    );
    if (!parsed.ok) return failure(parsed.error, state);
    requested = parsed.value;
  }
  const sameTrack =
    requested === null
      ? state.kind === "none"
      : state.kind === "valid" &&
        canonicalJSON(requested) === canonicalJSON(state.track);
  const framingFingerprint =
    cameraMotionFramingFingerprintFromFrameV1(rawFrame);
  const fingerprint = requested
    ? cameraMotionRenderFingerprintV1(requested, duration)
    : null;
  const hasStoredEnvelope = CAMERA_MOTION_ENVELOPE_FIELDS.some((key) =>
    Object.prototype.hasOwnProperty.call(rawFrame, key),
  );
  const hasCanonicalDeletionEnvelope =
    Object.prototype.hasOwnProperty.call(rawFrame, "cameraMotionTrack") &&
    rawFrame.cameraMotionTrack === null &&
    state.revision >= 1 &&
    state.fingerprint === null &&
    state.baseFingerprint === null &&
    state.status === "valid" &&
    typeof rawFrame.cameraMotionUpdatedAt === "string" &&
    Boolean(rawFrame.cameraMotionUpdatedAt.trim());
  const completeEnvelope =
    requested === null
      ? !hasStoredEnvelope || hasCanonicalDeletionEnvelope
      : state.revision >= 1 &&
        state.fingerprint === fingerprint &&
        state.baseFingerprint === framingFingerprint &&
        state.status === "valid" &&
        Boolean(state.updatedAt);
  if (sameTrack && completeEnvelope) {
    return {
      ok: true,
      value: {
        cameraMotionTrack: requested,
        cameraMotionRevision: state.revision,
        cameraMotionUpdatedAt: state.updatedAt,
        cameraMotionFingerprint: state.fingerprint,
        cameraMotionBaseFramingFingerprint: state.baseFingerprint,
        cameraMotionStatus: state.status,
        changed: false,
        updatedAt:
          typeof rawFrame.updatedAt === "string" ? rawFrame.updatedAt : "",
        ...(typeof rawFrame.sourceUpdatedAt === "string"
          ? { sourceUpdatedAt: rawFrame.sourceUpdatedAt }
          : {}),
      },
    };
  }
  const revision = state.revision + 1;
  if (!Number.isSafeInteger(revision))
    return failure("invalid_camera_motion_state", state);
  return {
    ok: true,
    value: {
      cameraMotionTrack: requested,
      cameraMotionRevision: revision,
      cameraMotionUpdatedAt: changedAt,
      cameraMotionFingerprint: fingerprint,
      cameraMotionBaseFramingFingerprint: requested ? framingFingerprint : null,
      cameraMotionStatus: "valid",
      changed: true,
      updatedAt: changedAt,
      ...(typeof rawFrame.sourceUpdatedAt === "string"
        ? { sourceUpdatedAt: rawFrame.sourceUpdatedAt }
        : typeof rawFrame.updatedAt === "string"
          ? { sourceUpdatedAt: rawFrame.updatedAt }
          : {}),
    },
  };
}

export function cameraMotionEnvelopePatchV1(
  value: CameraMotionEnvelopeV1,
): JsonRecord {
  return {
    cameraMotionTrack: value.cameraMotionTrack,
    cameraMotionRevision: value.cameraMotionRevision,
    cameraMotionUpdatedAt: value.cameraMotionUpdatedAt,
    cameraMotionFingerprint: value.cameraMotionFingerprint,
    cameraMotionBaseFramingFingerprint:
      value.cameraMotionBaseFramingFingerprint,
    cameraMotionStatus: value.cameraMotionStatus,
  };
}

/** Revalidate an unchanged raw draft when its t=0 framing or duration changes. */
export function revalidateCameraMotionDependencyV1(
  rawPreviousFrame: unknown,
  rawNextFrame: unknown,
  reason: "framing" | "duration",
  changedAt: string,
): JsonRecord {
  if (
    !isRecord(rawPreviousFrame) ||
    !isRecord(rawNextFrame) ||
    rawPreviousFrame.cameraMotionTrack === undefined ||
    rawPreviousFrame.cameraMotionTrack === null
  )
    return {};
  const previousDuration =
    cameraMotionShotDurationFromFrameV1(rawPreviousFrame);
  const previous = inspectCurrent(rawPreviousFrame, previousDuration);
  if (
    previous.revision === null ||
    !Number.isSafeInteger(previous.revision + 1)
  ) {
    throw new Error("invalid_camera_motion_state");
  }
  const duration = cameraMotionShotDurationFromFrameV1(rawNextFrame);
  if (
    reason === "duration" &&
    previous.kind === "valid" &&
    previous.track &&
    previousDuration &&
    duration
  ) {
    const retimed = retimeCameraMotionTrackV1(
      previous.track,
      previousDuration,
      duration,
    );
    if (retimed) {
      return {
        cameraMotionTrack: retimed,
        cameraMotionRevision: previous.revision + 1,
        cameraMotionUpdatedAt: changedAt,
        cameraMotionFingerprint: cameraMotionRenderFingerprintV1(
          retimed,
          duration,
        ),
        cameraMotionBaseFramingFingerprint:
          previous.baseFingerprint ??
          cameraMotionFramingFingerprintFromFrameV1(rawPreviousFrame),
        cameraMotionStatus: previous.status,
      };
    }
    // A valid old track whose exact scaled ratio cannot be represented within
    // v1 bounds remains recoverable, but must never masquerade as valid timing.
    return {
      cameraMotionTrack: rawPreviousFrame.cameraMotionTrack,
      cameraMotionRevision: previous.revision + 1,
      cameraMotionUpdatedAt: changedAt,
      cameraMotionFingerprint: null,
      cameraMotionBaseFramingFingerprint:
        previous.baseFingerprint ??
        cameraMotionFramingFingerprintFromFrameV1(rawPreviousFrame),
      cameraMotionStatus: "invalid",
    };
  }
  const parsed = duration
    ? normalizeCameraMotionTrackV1(rawPreviousFrame.cameraMotionTrack, duration)
    : { ok: false as const, error: "invalid_camera_motion_state" as const };
  const status: CameraMotionStatusV1 = !parsed.ok
    ? "invalid"
    : reason === "framing" || previous.status === "needsRebase"
      ? "needsRebase"
      : "valid";
  return {
    cameraMotionTrack: rawPreviousFrame.cameraMotionTrack,
    cameraMotionRevision: previous.revision + 1,
    cameraMotionUpdatedAt: changedAt,
    cameraMotionFingerprint:
      parsed.ok && duration
        ? cameraMotionRenderFingerprintV1(parsed.value, duration)
        : null,
    cameraMotionBaseFramingFingerprint:
      previous.baseFingerprint ??
      cameraMotionFramingFingerprintFromFrameV1(rawPreviousFrame),
    cameraMotionStatus: status,
  };
}

export function cameraMotionWriteHTTPStatus(
  error: CameraMotionWriteErrorCode,
): 400 | 409 | 422 | 500 {
  if (
    error === "camera_motion_revision_conflict" ||
    error === "camera_motion_upgrade_required"
  )
    return 409;
  if (
    error === "unsupported_camera_motion_version" ||
    error === "invalid_camera_motion_track" ||
    error === "camera_motion_payload_too_large" ||
    error === "camera_motion_payload_too_deep"
  )
    return 422;
  if (error === "invalid_camera_motion_state") return 500;
  return 400;
}
