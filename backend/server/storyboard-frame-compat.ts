import {
  storyboardPaintoverChanges,
  storyboardPaintoverStateForFrame,
  storyboardPencilOverlayProjection,
} from "./storyboard-paintover-contract.js";
import { CAMERA_MOTION_ENVELOPE_FIELDS } from "./storyboard-camera-motion.js";

type JsonRecord = Record<string, unknown>;

const SERVER_OWNED_AI_SIDECARS = [
  "aiOutputStale",
  "aiOutputStaleReason",
  "aiSourceFramingFingerprint",
  "aiRasterPlacementFraming",
  "aiColorFramingFingerprint",
  "aiAtmosphereFramingFingerprint",
  "aiSourceRevision",
  "aiStoryboardId",
  "aiVideoURL",
  "aiVideoJobId",
  "aiVideoStatus",
  "aiVideoModel",
  "aiVideoArchiveKey",
  "aiVideoSourceFramingFingerprint",
  "aiVideoSourceRevision",
  "aiVideoSourceUpdatedAt",
  "aiVideoSourceFrameUpdatedAt",
  "aiVideoSourceBaseVersionId",
  "aiVideoSourceStage",
  "aiVideoSourceColorRevision",
  "aiVideoSourceAtmosphereRevision",
  "aiVideoSourceColorFingerprint",
  "aiVideoSourceAtmosphereFingerprint",
  "aiVideoSourceColorHasContent",
  "aiVideoSourceAtmosphereHasContent",
  "aiVideoSourceCompositeFingerprint",
  "aiVideoSourceBindingFingerprint",
  "aiVideoSourceMotionRevision",
  "aiVideoSourceMotionFingerprint",
  "aiVideoSourceMotionStatus",
  "aiVideoSourceMotionBaseFramingFingerprint",
  "aiVideoSourceShotDuration",
  "aiVideoSourceDurationRevision",
  "aiPaintoverState",
  "sourceUpdatedAt",
] as const;

const AI_ADOPTION_RASTER_FIELDS = [
  "imageUrl",
  "thumbnailUrl",
  "imageSource",
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function differsWhenSupplied(
  existing: JsonRecord,
  incoming: JsonRecord,
  key: string,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(incoming, key)) return false;
  return JSON.stringify(existing[key]) !== JSON.stringify(incoming[key]);
}

function canonicalStringList(value: unknown, preserveOrder: boolean): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result = value.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const normalized = entry.trim();
    return normalized && !seen.has(normalized)
      ? (seen.add(normalized), [normalized])
      : [];
  });
  return preserveOrder
    ? result
    : result.sort((left, right) => left.localeCompare(right));
}

function canonicalOpacity(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .flatMap(([layer, opacity]) => {
        const number = typeof opacity === "number" ? opacity : Number(opacity);
        if (!layer.trim() || !Number.isFinite(number)) return [];
        const normalized = Math.min(1, Math.max(0, number));
        // Missing entries render at full opacity, so an explicit 1 is not a
        // visual document change.
        return normalized === 1 ? [] : [[layer.trim(), normalized] as const];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function canonicalBlendModes(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .flatMap(([layer, mode]) => {
        const normalizedLayer = layer.trim();
        const normalizedMode =
          typeof mode === "string" ? mode.trim().toLowerCase() : "";
        // Missing entries render as normal, so do not create a false source
        // revision for an explicitly materialized default.
        return !normalizedLayer ||
          !normalizedMode ||
          normalizedMode === "normal"
          ? []
          : [[normalizedLayer, normalizedMode] as const];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Canonical subset of BoardLayerState that can change rendered pixels.
 * Selection and edit locks are intentionally excluded; hidden is a set,
 * while layer order remains ordered because it affects compositing.
 */
export function canonicalVisualLayerState(value: unknown): unknown {
  if (!isRecord(value)) return null;
  return {
    order: canonicalStringList(value.order, true),
    hidden: canonicalStringList(value.hidden, false),
    opacity: canonicalOpacity(value.opacity),
    blendModes: canonicalBlendModes(value.blendModes),
  };
}

export function visualLayerStateChanged(
  existing: unknown,
  incoming: unknown,
): boolean {
  return (
    JSON.stringify(canonicalVisualLayerState(existing)) !==
    JSON.stringify(canonicalVisualLayerState(incoming))
  );
}

/** Imported native rasters are Pencil source truth, never AI adoption output. */
export function importedRasterMirror(
  fields: unknown,
  sourceChanged: boolean,
): { shouldMirror: boolean; imageData: string | null } {
  if (
    !sourceChanged ||
    !isRecord(fields) ||
    !Object.prototype.hasOwnProperty.call(fields, "imageUrl")
  ) {
    return { shouldMirror: false, imageData: null };
  }
  const source =
    typeof fields.imageSource === "string"
      ? fields.imageSource.trim().toLowerCase()
      : "";
  const imageData =
    typeof fields.imageUrl === "string" ? fields.imageUrl : null;
  return {
    shouldMirror: source === "imported" || fields.imageUrl === null,
    imageData,
  };
}

function frameWithSuppliedDocument(
  existingFrame: JsonRecord,
  incomingFrame: JsonRecord,
): JsonRecord {
  const existingDrawing = isRecord(existingFrame.drawingData)
    ? existingFrame.drawingData
    : {};
  const incomingDrawing = isRecord(incomingFrame.drawingData)
    ? incomingFrame.drawingData
    : null;
  const drawingData: JsonRecord = incomingDrawing
    ? { ...existingDrawing, ...incomingDrawing }
    : { ...existingDrawing };
  const hasTopLevelStrokes =
    Object.prototype.hasOwnProperty.call(incomingFrame, "strokesJSON") ||
    Object.prototype.hasOwnProperty.call(incomingFrame, "strokes");
  if (
    hasTopLevelStrokes &&
    !Object.prototype.hasOwnProperty.call(incomingDrawing ?? {}, "strokes")
  ) {
    // Explicit legacy top-level strokes are authoritative when no modern
    // drawingData.strokes value accompanies them.
    delete drawingData.strokes;
  }
  return {
    ...existingFrame,
    ...incomingFrame,
    drawingData,
  };
}

/** Whether a legacy scene replacement changes pixels/camera source truth. */
export function nativeFrameSourceChanged(
  existingFrame: unknown,
  incomingFrame: unknown,
): boolean {
  return nativeFrameSourceChangeReason(existingFrame, incomingFrame) !== null;
}

export type NativeFrameSourceChangeReason =
  "shot-framing-changed" | "source-document-changed";

/**
 * Classifies the source mutation so consumers can distinguish a camera-only
 * reframe (which CoveragePolicy may still prove safe) from changed pixels.
 */
export function nativeFrameSourceChangeReason(
  existingFrame: unknown,
  incomingFrame: unknown,
): NativeFrameSourceChangeReason | null {
  if (!isRecord(existingFrame) || !isRecord(incomingFrame)) return null;
  const framingChanged = ["shotFraming", "shotType", "angle", "lensMm"].some(
    (key) => differsWhenSupplied(existingFrame, incomingFrame, key),
  );
  if (differsWhenSupplied(existingFrame, incomingFrame, "imageUrl")) {
    return "source-document-changed";
  }
  const existingDrawing = isRecord(existingFrame.drawingData)
    ? existingFrame.drawingData
    : {};
  const incomingDrawing = isRecord(incomingFrame.drawingData)
    ? incomingFrame.drawingData
    : null;
  if (
    incomingDrawing &&
    ["width", "height"].some((key) =>
      differsWhenSupplied(existingDrawing, incomingDrawing, key),
    )
  )
    return "source-document-changed";
  const suppliesEditableDocument =
    (incomingDrawing &&
      (Object.prototype.hasOwnProperty.call(incomingDrawing, "strokes") ||
        Object.prototype.hasOwnProperty.call(incomingDrawing, "layerState"))) ||
    Object.prototype.hasOwnProperty.call(incomingFrame, "strokesJSON") ||
    Object.prototype.hasOwnProperty.call(incomingFrame, "strokes");
  if (suppliesEditableDocument) {
    const effectiveFrame = frameWithSuppliedDocument(
      existingFrame,
      incomingFrame,
    );
    const pencilChanged =
      JSON.stringify(storyboardPencilOverlayProjection(existingFrame)) !==
      JSON.stringify(storyboardPencilOverlayProjection(effectiveFrame));
    if (pencilChanged) return "source-document-changed";
  }
  return framingChanged ? "shot-framing-changed" : null;
}

/**
 * Full-scene POST is a legacy replacement route used by older web clients.
 * Those clients cannot send fields introduced by the native iPad app. Keep
 * the canonical top-level framing sidecar when it is absent from the incoming
 * frame; an explicitly supplied value (including null) remains authoritative.
 */
export function preserveAbsentShotFraming(
  existingFrame: unknown,
  incomingFrame: unknown,
): unknown {
  if (!isRecord(existingFrame) || !isRecord(incomingFrame)) {
    return incomingFrame;
  }
  const sourceChangeReason = nativeFrameSourceChangeReason(
    existingFrame,
    incomingFrame,
  );
  const sourceChanged = sourceChangeReason !== null;
  const effectiveFrame = frameWithSuppliedDocument(
    existingFrame,
    incomingFrame,
  );
  const paintoverChanges = storyboardPaintoverChanges(
    existingFrame,
    effectiveFrame,
  );
  const protectedFrame: JsonRecord = { ...incomingFrame };
  if (
    !Object.prototype.hasOwnProperty.call(incomingFrame, "shotFraming") &&
    Object.prototype.hasOwnProperty.call(existingFrame, "shotFraming")
  ) {
    protectedFrame.shotFraming = existingFrame.shotFraming;
  }
  // AI approvals/job identity are server-owned. A stale full-scene snapshot
  // must not clear or roll them back, even if the old web client echoes an
  // outdated value instead of omitting the field.
  for (const key of SERVER_OWNED_AI_SIDECARS) {
    if (Object.prototype.hasOwnProperty.call(existingFrame, key)) {
      protectedFrame[key] = existingFrame[key];
    } else {
      delete protectedFrame[key];
    }
  }
  // Older whole-scene clients often omit raster fields entirely. Omission is
  // not deletion: retain the atomically adopted image/thumbnail/source while
  // still allowing an explicitly supplied new drawing/import to replace it.
  for (const key of AI_ADOPTION_RASTER_FIELDS) {
    if (
      !Object.prototype.hasOwnProperty.call(incomingFrame, key) &&
      Object.prototype.hasOwnProperty.call(existingFrame, key)
    ) {
      protectedFrame[key] = existingFrame[key];
    }
  }
  if (
    sourceChanged &&
    SERVER_OWNED_AI_SIDECARS.some((key) =>
      Object.prototype.hasOwnProperty.call(existingFrame, key),
    )
  ) {
    protectedFrame.aiOutputStale = true;
    protectedFrame.aiOutputStaleReason = sourceChangeReason;
  }
  if (
    Object.prototype.hasOwnProperty.call(existingFrame, "aiPaintoverState") ||
    paintoverChanges.colorChanged ||
    paintoverChanges.atmosphereChanged
  ) {
    protectedFrame.aiPaintoverState = storyboardPaintoverStateForFrame(
      existingFrame.aiPaintoverState,
      paintoverChanges,
      effectiveFrame,
    );
  }
  return protectedFrame;
}

/**
 * Whole-scene POST is a compatibility transport, never motion authority.
 * Preserve the complete existing envelope even when an old/stale client sends
 * null or a changed opaque future payload. New frames cannot inject motion via
 * this legacy route; the dedicated OCC endpoint is the only writer.
 */
export function preserveCameraMotionEnvelope(
  existingFrame: unknown,
  incomingFrame: unknown,
): unknown {
  if (!isRecord(incomingFrame)) return incomingFrame;
  const protectedFrame: JsonRecord = { ...incomingFrame };
  for (const key of CAMERA_MOTION_ENVELOPE_FIELDS) {
    if (
      isRecord(existingFrame) &&
      Object.prototype.hasOwnProperty.call(existingFrame, key)
    ) {
      protectedFrame[key] = existingFrame[key];
    } else {
      delete protectedFrame[key];
    }
  }
  delete protectedFrame.expectedMotionRevision;
  return protectedFrame;
}

/** Strip authority-only fields before any generic per-frame merge. */
export function stripFramePatchServerOwnedSidecars(fields: unknown): JsonRecord {
  if (!isRecord(fields)) return {};
  const next: JsonRecord = { ...fields };
  for (const key of SERVER_OWNED_AI_SIDECARS) {
    if (key !== "aiOutputStale" && key !== "aiOutputStaleReason") {
      delete next[key];
    }
  }
  for (const key of CAMERA_MOTION_ENVELOPE_FIELDS) delete next[key];
  for (const key of [
    "shotDuration",
    "duration",
    "durationSec",
    "durationRevision",
    "expectedMotionRevision",
  ]) delete next[key];
  return next;
}

/**
 * Generic frame writers may re-arm the stale gate, but they may never clear
 * it. Clearing stale is an approval authority and is performed only by the
 * transactional image-stage adoption service.
 */
export function enforceFramePatchAIStaleAuthority(
  fields: unknown,
  sourceDocumentChanged: boolean,
): JsonRecord {
  if (!isRecord(fields)) return {};
  const next = stripFramePatchServerOwnedSidecars(fields);
  const explicitlyStale = next.aiOutputStale === true;
  if (sourceDocumentChanged || explicitlyStale) {
    next.aiOutputStale = true;
    const suppliedReason =
      typeof next.aiOutputStaleReason === "string"
        ? next.aiOutputStaleReason.trim()
        : "";
    next.aiOutputStaleReason = sourceDocumentChanged
      ? "source-document-changed"
      : suppliedReason || "source-document-changed";
    return next;
  }
  delete next.aiOutputStale;
  delete next.aiOutputStaleReason;
  return next;
}
