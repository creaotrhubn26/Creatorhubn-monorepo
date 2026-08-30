/**
 * Canonical Storyboard Room shot-duration contract.
 *
 * Persisted duration identity is always a reduced rational MediaTime. Legacy
 * floating-point seconds exist only at compatibility boundaries and are
 * normalized to the v1 timeline timescale with an explicit rounding rule.
 * This module is deliberately pure so routes, services and fixture tests
 * cannot grow different duration semantics.
 */

export const STORYBOARD_SHOT_DURATION_V1 = Object.freeze({
  version: 1 as const,
  legacyTimelineTimescale: 600,
  maximumDurationSeconds: 600,
  maximumTimescale: 2_147_483_647,
});

/** Deterministic project timing written on the first timing mutation. */
export function makeStoryboardTimingV1Default(): {
  version: 1;
  projectFrameRate: StoryboardMediaTimeV1;
  timelineTimescale: number;
} {
  return {
    version: 1,
    projectFrameRate: { value: 25, timescale: 1 },
    timelineTimescale: STORYBOARD_SHOT_DURATION_V1.legacyTimelineTimescale,
  };
}

export interface StoryboardMediaTimeV1 {
  value: number;
  timescale: number;
}

export type FrameDurationWriteErrorCode =
  | "duration_required"
  | "invalid_shot_duration"
  | "invalid_legacy_duration"
  | "invalid_expected_duration_revision"
  | "legacy_duration_required"
  | "duration_mismatch"
  | "client_upgrade_required"
  | "duration_revision_conflict"
  | "invalid_duration_state";

export interface PreparedFrameDurationWriteV1 {
  requestedDuration: StoryboardMediaTimeV1;
  expectedDurationRevision?: number;
  canonicalProvided: boolean;
  legacyProvided: boolean;
}

export type PrepareFrameDurationWriteResultV1 =
  | { ok: true; write: PreparedFrameDurationWriteV1 }
  | { ok: false; error: FrameDurationWriteErrorCode };

export interface AppliedFrameDurationV1 {
  shotDuration: StoryboardMediaTimeV1;
  durationRevision: number;
  duration: number;
  durationSec: number;
  changed: boolean;
}

export type ApplyFrameDurationWriteResultV1 =
  | { ok: true; value: AppliedFrameDurationV1 }
  | {
      ok: false;
      error: FrameDurationWriteErrorCode;
      currentShotDuration?: StoryboardMediaTimeV1;
      currentDurationRevision?: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function greatestCommonDivisor(lhs: number, rhs: number): number {
  let left = lhs;
  let right = rhs;
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return Math.max(1, left);
}

/** Reduces equivalent values such as 48/24 and 2/1 to one wire identity. */
export function normalizeStoryboardMediaTimeV1(
  input: unknown,
): StoryboardMediaTimeV1 | null {
  if (!isRecord(input)) return null;
  const value = input.value;
  const timescale = input.timescale;
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(timescale) ||
    (value as number) < 0 ||
    (timescale as number) <= 0 ||
    (timescale as number) > STORYBOARD_SHOT_DURATION_V1.maximumTimescale
  ) {
    return null;
  }
  if (value === 0) return { value: 0, timescale: 1 };
  const divisor = greatestCommonDivisor(value as number, timescale as number);
  return {
    value: (value as number) / divisor,
    timescale: (timescale as number) / divisor,
  };
}

function compareMediaTimeToWholeSeconds(
  time: StoryboardMediaTimeV1,
  seconds: number,
): number {
  const lhs = BigInt(time.value);
  const rhs = BigInt(seconds) * BigInt(time.timescale);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

export function normalizeShotDurationV1(
  input: unknown,
): StoryboardMediaTimeV1 | null {
  const time = normalizeStoryboardMediaTimeV1(input);
  if (!time || time.value <= 0) return null;
  if (
    compareMediaTimeToWholeSeconds(
      time,
      STORYBOARD_SHOT_DURATION_V1.maximumDurationSeconds,
    ) > 0
  )
    return null;
  return time;
}

function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Compatibility conversion required by ADR-CAM-003: nearest 1/600 second,
 * with exact halfway values rounded away from zero.
 */
export function legacySecondsToShotDurationV1(
  input: unknown,
): StoryboardMediaTimeV1 | null {
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input <= 0 ||
    input > STORYBOARD_SHOT_DURATION_V1.maximumDurationSeconds
  ) {
    return null;
  }
  const scaled = input * STORYBOARD_SHOT_DURATION_V1.legacyTimelineTimescale;
  if (!Number.isFinite(scaled)) return null;
  const rounded = roundHalfAwayFromZero(scaled);
  return normalizeShotDurationV1({
    value: rounded,
    timescale: STORYBOARD_SHOT_DURATION_V1.legacyTimelineTimescale,
  });
}

export function shotDurationToLegacySecondsV1(
  input: StoryboardMediaTimeV1,
): number {
  return input.value / input.timescale;
}

export function storyboardMediaTimesEqualV1(
  lhs: StoryboardMediaTimeV1,
  rhs: StoryboardMediaTimeV1,
): boolean {
  return (
    BigInt(lhs.value) * BigInt(rhs.timescale) ===
    BigInt(rhs.value) * BigInt(lhs.timescale)
  );
}

function normalizeLegacyFields(
  input: Record<string, unknown>,
):
  | { ok: true; provided: false }
  | { ok: true; provided: true; duration: StoryboardMediaTimeV1 }
  | { ok: false; error: FrameDurationWriteErrorCode } {
  const hasDuration = Object.prototype.hasOwnProperty.call(input, "duration");
  const hasDurationSec = Object.prototype.hasOwnProperty.call(
    input,
    "durationSec",
  );
  if (!hasDuration && !hasDurationSec) return { ok: true, provided: false };

  const duration = hasDuration
    ? legacySecondsToShotDurationV1(input.duration)
    : null;
  const durationSec = hasDurationSec
    ? legacySecondsToShotDurationV1(input.durationSec)
    : null;
  if ((hasDuration && !duration) || (hasDurationSec && !durationSec)) {
    return { ok: false, error: "invalid_legacy_duration" };
  }
  if (
    duration &&
    durationSec &&
    !storyboardMediaTimesEqualV1(duration, durationSec)
  ) {
    return { ok: false, error: "duration_mismatch" };
  }
  return {
    ok: true,
    provided: true,
    duration: (duration ?? durationSec) as StoryboardMediaTimeV1,
  };
}

/** Validates and canonicalizes one route/service write intent. */
export function prepareFrameDurationWriteV1(
  rawInput: unknown,
): PrepareFrameDurationWriteResultV1 {
  if (!isRecord(rawInput)) return { ok: false, error: "duration_required" };
  const canonicalProvided = Object.prototype.hasOwnProperty.call(
    rawInput,
    "shotDuration",
  );
  const canonical = canonicalProvided
    ? normalizeShotDurationV1(rawInput.shotDuration)
    : null;
  if (canonicalProvided && !canonical) {
    return { ok: false, error: "invalid_shot_duration" };
  }

  const legacy = normalizeLegacyFields(rawInput);
  if (!legacy.ok) return legacy;
  if (!canonicalProvided && !legacy.provided) {
    return { ok: false, error: "duration_required" };
  }
  // New clients must dual-write so old readers see the same duration. The
  // service derives the persisted Double from canonical time; this request
  // value is only a consistency assertion.
  if (canonicalProvided && !legacy.provided) {
    return { ok: false, error: "legacy_duration_required" };
  }
  if (
    canonical &&
    legacy.provided &&
    !storyboardMediaTimesEqualV1(canonical, legacy.duration)
  ) {
    return { ok: false, error: "duration_mismatch" };
  }

  const hasExpectedRevision = Object.prototype.hasOwnProperty.call(
    rawInput,
    "expectedDurationRevision",
  );
  const expectedDurationRevision = rawInput.expectedDurationRevision;
  if (
    hasExpectedRevision &&
    (!Number.isSafeInteger(expectedDurationRevision) ||
      (expectedDurationRevision as number) < 0)
  ) {
    return { ok: false, error: "invalid_expected_duration_revision" };
  }

  return {
    ok: true,
    write: {
      requestedDuration:
        canonical ?? (legacy as { duration: StoryboardMediaTimeV1 }).duration,
      ...(hasExpectedRevision
        ? { expectedDurationRevision: expectedDurationRevision as number }
        : {}),
      canonicalProvided,
      legacyProvided: legacy.provided,
    },
  };
}

function readCurrentRevision(
  frame: Record<string, unknown>,
  hasCanonicalDuration: boolean,
): number | null {
  if (!hasCanonicalDuration) return 0;
  const revision = frame.durationRevision;
  // Canonical duration predates the revision field in some phase-1 fixtures.
  // Treat that persisted state as revision 1 without fabricating a client-side
  // increment; the next real mutation writes the server-owned successor.
  if (revision === undefined || revision === null) return 1;
  if (!Number.isSafeInteger(revision) || (revision as number) < 1) return null;
  return revision as number;
}

/** Applies OCC and migration rules to one already-loaded frame, without I/O. */
export function applyFrameDurationWriteV1(
  rawFrame: unknown,
  write: PreparedFrameDurationWriteV1,
): ApplyFrameDurationWriteResultV1 {
  if (!isRecord(rawFrame)) {
    return { ok: false, error: "invalid_duration_state" };
  }
  const hasCanonicalDuration =
    rawFrame.shotDuration !== undefined && rawFrame.shotDuration !== null;
  const currentDuration = hasCanonicalDuration
    ? normalizeShotDurationV1(rawFrame.shotDuration)
    : null;
  if (hasCanonicalDuration && !currentDuration) {
    return { ok: false, error: "invalid_duration_state" };
  }
  const currentRevision = readCurrentRevision(rawFrame, hasCanonicalDuration);
  if (currentRevision === null) {
    return { ok: false, error: "invalid_duration_state" };
  }
  const current = currentDuration as StoryboardMediaTimeV1 | null;
  const sameAsCurrent = current
    ? storyboardMediaTimesEqualV1(current, write.requestedDuration)
    : false;

  // This is the one legal write from an old client after migration: replaying
  // the already-canonical legacy value is a true no-op.
  if (!write.canonicalProvided && current && sameAsCurrent) {
    const legacySeconds = shotDurationToLegacySecondsV1(current);
    return {
      ok: true,
      value: {
        shotDuration: current,
        durationRevision: currentRevision,
        duration: legacySeconds,
        durationSec: legacySeconds,
        changed: false,
      },
    };
  }

  if (write.canonicalProvided && write.expectedDurationRevision === undefined) {
    return {
      ok: false,
      error: "client_upgrade_required",
      ...(current ? { currentShotDuration: current } : {}),
      currentDurationRevision: currentRevision,
    };
  }
  if (
    !write.canonicalProvided &&
    current &&
    !sameAsCurrent &&
    write.expectedDurationRevision === undefined
  ) {
    return {
      ok: false,
      error: "client_upgrade_required",
      currentShotDuration: current,
      currentDurationRevision: currentRevision,
    };
  }
  if (
    write.expectedDurationRevision !== undefined &&
    write.expectedDurationRevision !== currentRevision
  ) {
    return {
      ok: false,
      error: "duration_revision_conflict",
      ...(current ? { currentShotDuration: current } : {}),
      currentDurationRevision: currentRevision,
    };
  }

  if (current && sameAsCurrent) {
    const legacySeconds = shotDurationToLegacySecondsV1(current);
    return {
      ok: true,
      value: {
        shotDuration: current,
        durationRevision: currentRevision,
        duration: legacySeconds,
        durationSec: legacySeconds,
        changed: false,
      },
    };
  }

  const nextRevision = current ? currentRevision + 1 : 1;
  if (!Number.isSafeInteger(nextRevision)) {
    return {
      ok: false,
      error: "invalid_duration_state",
      ...(current ? { currentShotDuration: current } : {}),
      currentDurationRevision: currentRevision,
    };
  }
  const legacySeconds = shotDurationToLegacySecondsV1(write.requestedDuration);
  return {
    ok: true,
    value: {
      shotDuration: write.requestedDuration,
      durationRevision: nextRevision,
      duration: legacySeconds,
      durationSec: legacySeconds,
      changed: true,
    },
  };
}

export type ReconcileLegacyFrameDurationResultV1 =
  | { ok: true; frame: Record<string, unknown> }
  | {
      ok: false;
      error: FrameDurationWriteErrorCode;
      currentShotDuration?: StoryboardMediaTimeV1;
      currentDurationRevision?: number;
    };

function withDurationProjection(
  frame: Record<string, unknown>,
  value: AppliedFrameDurationV1,
): Record<string, unknown> {
  const next = { ...frame };
  // Request-only OCC input must never become document state.
  delete next.expectedDurationRevision;
  return {
    ...next,
    shotDuration: value.shotDuration,
    durationRevision: value.durationRevision,
    duration: value.duration,
    durationSec: value.durationSec,
  };
}

/**
 * Compatibility guard for whole-scene writers. Missing timing fields preserve
 * canonical state; an unchanged full-frame echo is accepted; a changed
 * legacy/canonical value must use the dedicated OCC endpoint.
 */
export function reconcileLegacyFrameDurationWriteV1(
  rawExistingFrame: unknown,
  rawIncomingFrame: unknown,
): ReconcileLegacyFrameDurationResultV1 {
  if (!isRecord(rawIncomingFrame)) {
    return { ok: false, error: "invalid_duration_state" };
  }
  const existingFrame = isRecord(rawExistingFrame) ? rawExistingFrame : {};
  const hasCurrentCanonical =
    existingFrame.shotDuration !== undefined &&
    existingFrame.shotDuration !== null;
  const currentDuration = hasCurrentCanonical
    ? normalizeShotDurationV1(existingFrame.shotDuration)
    : null;
  if (hasCurrentCanonical && !currentDuration) {
    return { ok: false, error: "invalid_duration_state" };
  }
  const currentRevision = readCurrentRevision(
    existingFrame,
    hasCurrentCanonical,
  );
  if (currentRevision === null) {
    return { ok: false, error: "invalid_duration_state" };
  }

  const hasIncomingCanonical = Object.prototype.hasOwnProperty.call(
    rawIncomingFrame,
    "shotDuration",
  );
  const hasIncomingLegacy =
    Object.prototype.hasOwnProperty.call(rawIncomingFrame, "duration") ||
    Object.prototype.hasOwnProperty.call(rawIncomingFrame, "durationSec");

  if (currentDuration && !hasIncomingCanonical && !hasIncomingLegacy) {
    const seconds = shotDurationToLegacySecondsV1(currentDuration);
    return {
      ok: true,
      frame: withDurationProjection(rawIncomingFrame, {
        shotDuration: currentDuration,
        durationRevision: currentRevision,
        duration: seconds,
        durationSec: seconds,
        changed: false,
      }),
    };
  }

  if (currentDuration && hasIncomingCanonical) {
    const incomingDuration = normalizeShotDurationV1(
      rawIncomingFrame.shotDuration,
    );
    if (!incomingDuration) {
      return { ok: false, error: "invalid_shot_duration" };
    }
    if (!storyboardMediaTimesEqualV1(currentDuration, incomingDuration)) {
      return {
        ok: false,
        error: "client_upgrade_required",
        currentShotDuration: currentDuration,
        currentDurationRevision: currentRevision,
      };
    }
    if (hasIncomingLegacy) {
      const assertion = prepareFrameDurationWriteV1(rawIncomingFrame);
      if (!assertion.ok) return assertion;
    }
    const seconds = shotDurationToLegacySecondsV1(currentDuration);
    return {
      ok: true,
      frame: withDurationProjection(rawIncomingFrame, {
        shotDuration: currentDuration,
        durationRevision: currentRevision,
        duration: seconds,
        durationSec: seconds,
        changed: false,
      }),
    };
  }

  if (currentDuration && hasIncomingLegacy) {
    const prepared = prepareFrameDurationWriteV1(rawIncomingFrame);
    if (!prepared.ok) return prepared;
    const applied = applyFrameDurationWriteV1(existingFrame, prepared.write);
    if (!applied.ok) return applied;
    if (applied.value.changed) {
      return {
        ok: false,
        error: "client_upgrade_required",
        currentShotDuration: currentDuration,
        currentDurationRevision: currentRevision,
      };
    }
    return {
      ok: true,
      frame: withDurationProjection(rawIncomingFrame, applied.value),
    };
  }

  if (!hasIncomingCanonical && !hasIncomingLegacy) {
    const frame = { ...rawIncomingFrame };
    delete frame.durationRevision;
    delete frame.expectedDurationRevision;
    return { ok: true, frame };
  }
  const prepared = prepareFrameDurationWriteV1(rawIncomingFrame);
  if (!prepared.ok) return prepared;
  const applied = applyFrameDurationWriteV1({}, prepared.write);
  return applied.ok
    ? {
        ok: true,
        frame: withDurationProjection(rawIncomingFrame, applied.value),
      }
    : applied;
}

export function frameDurationWriteHTTPStatus(
  error: FrameDurationWriteErrorCode,
): 400 | 409 | 500 {
  if (
    error === "duration_mismatch" ||
    error === "client_upgrade_required" ||
    error === "duration_revision_conflict"
  )
    return 409;
  if (error === "invalid_duration_state") return 500;
  return 400;
}
