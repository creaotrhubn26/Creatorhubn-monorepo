import crypto from "node:crypto";

type JsonRecord = Record<string, unknown>;

export type StoryboardPaintoverStage = "color" | "atmosphere";

export interface StoryboardPaintoverChangeSet {
  colorChanged: boolean;
  atmosphereChanged: boolean;
}

export interface StoryboardPaintoverRevisionState {
  colorRevision: number;
  atmosphereRevision: number;
  atmosphereStale: boolean;
  videoStale: boolean;
}

export interface StoryboardPaintoverState
  extends StoryboardPaintoverRevisionState {
  version: 1;
  colorFingerprint: string;
  atmosphereFingerprint: string;
  colorHasContent: boolean;
  atmosphereHasContent: boolean;
}

const LAYER_BY_STAGE: Record<StoryboardPaintoverStage, string> = {
  color: "Color",
  atmosphere: "Atmosphere",
};

const DEFAULT_LAYER_ORDER = [
  "Drawing", "Color", "Atmosphere", "Camera / Arrows", "Dialog", "Notes",
];
const STANDARD_RENDER_ORDER = [
  "Color", "Atmosphere", "Drawing", "Camera / Arrows", "Dialog", "Notes",
];
const COMPOSITE_LAYERS = new Set(["Drawing", "Color", "Atmosphere"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function parsedStrokeDocument(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rawFrameStrokeDocument(frame: unknown): unknown {
  if (!isRecord(frame)) return undefined;
  const drawingData = isRecord(frame.drawingData) ? frame.drawingData : {};
  for (const value of [drawingData.strokes, frame.strokesJSON, frame.strokes]) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function strokeLayer(stroke: unknown): string {
  if (!isRecord(stroke)) return "Drawing";
  return typeof stroke.boardLayer === "string" && stroke.boardLayer.trim()
    ? stroke.boardLayer.trim() : "Drawing";
}

function strokesForLayer(frame: unknown, layer: string): unknown {
  const rawDocument = rawFrameStrokeDocument(frame);
  if (rawDocument === undefined) return [];
  const document = parsedStrokeDocument(rawDocument);
  // Malformed supplied documents must never compare equal to an omitted
  // document. Keeping their canonical raw value makes stale gates fail
  // closed until normal route validation rejects or repairs the payload.
  if (!document) {
    return { invalidStrokeDocument: canonicalize(rawDocument) };
  }
  return canonicalize(document.filter((stroke) => strokeLayer(stroke) === layer));
}

function finiteRevision(value: unknown): number {
  const number = typeof value === "number" ? value
    : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function layerState(frame: unknown): JsonRecord {
  if (!isRecord(frame)) return {};
  const drawingData = isRecord(frame.drawingData) ? frame.drawingData : {};
  return isRecord(drawingData.layerState) ? drawingData.layerState : {};
}

function effectiveCompositeOrder(value: unknown): string[] {
  const proposed = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string") : [];
  const seen = new Set<string>();
  const normalized = proposed
    .map((entry) => entry.trim())
    .filter((entry) => entry && !seen.has(entry) && (seen.add(entry), true));
  for (const layer of DEFAULT_LAYER_ORDER) {
    if (!seen.has(layer)) {
      seen.add(layer);
      normalized.push(layer);
    }
  }
  const hasOnlyDefaultLayers = normalized.length === DEFAULT_LAYER_ORDER.length
    && normalized.every((entry) => DEFAULT_LAYER_ORDER.includes(entry));
  return (hasOnlyDefaultLayers ? STANDARD_RENDER_ORDER : normalized)
    .filter((entry) => COMPOSITE_LAYERS.has(entry));
}

function canonicalLayerVisualState(
  frame: unknown,
  layer: string,
  includeOrder = true,
): unknown {
  const state = layerState(frame);
  const hidden = Array.isArray(state.hidden)
    ? state.hidden.some((entry) => entry === layer) : false;
  const opacityRecord = isRecord(state.opacity) ? state.opacity : {};
  const rawOpacity = opacityRecord[layer];
  const opacityNumber = typeof rawOpacity === "number" ? rawOpacity : Number(rawOpacity);
  const opacity = Number.isFinite(opacityNumber)
    ? Math.min(1, Math.max(0, opacityNumber)) : 1;
  const blendRecord = isRecord(state.blendModes) ? state.blendModes : {};
  const blendMode = typeof blendRecord[layer] === "string"
    ? String(blendRecord[layer]).trim().toLowerCase() || "normal" : "normal";
  const order = effectiveCompositeOrder(state.order);
  return includeOrder
    ? { hidden, opacity, blendMode, order }
    : { hidden, opacity, blendMode };
}

function same(lhs: unknown, rhs: unknown): boolean {
  return JSON.stringify(lhs) === JSON.stringify(rhs);
}

/**
 * The editable stroke document is shared, but Color and Atmosphere are
 * independent production overlays. Their changes advance only their own
 * stage identity; Drawing remains the Pencil source contract.
 */
export function storyboardPaintoverChanges(
  existingFrame: unknown,
  nextFrame: unknown,
): StoryboardPaintoverChangeSet {
  const changed = (stage: StoryboardPaintoverStage): boolean => {
    const layer = LAYER_BY_STAGE[stage];
    return !same(
      strokesForLayer(existingFrame, layer),
      strokesForLayer(nextFrame, layer),
    ) || !same(
      canonicalLayerVisualState(existingFrame, layer),
      canonicalLayerVisualState(nextFrame, layer),
    );
  };
  return { colorChanged: changed("color"), atmosphereChanged: changed("atmosphere") };
}

/** Canonical stage identity used to bind a client-rendered composite to WAL/OCC truth. */
export function storyboardPaintoverFingerprint(
  frame: unknown,
  stage: StoryboardPaintoverStage,
): string {
  const layer = LAYER_BY_STAGE[stage];
  return crypto.createHash("sha256").update(JSON.stringify({
    version: "storyboard-paintover-v1",
    stage,
    strokes: strokesForLayer(frame, layer),
    layerState: canonicalLayerVisualState(frame, layer),
  })).digest("hex");
}

/**
 * Server-owned downstream invalidation. A Color edit invalidates Atmosphere
 * and video; an Atmosphere edit invalidates video only. Pencil stale is owned
 * by the existing source-document path and deliberately absent here.
 */
export function nextStoryboardPaintoverRevisionState(
  current: unknown,
  changes: StoryboardPaintoverChangeSet,
): StoryboardPaintoverRevisionState {
  const state = isRecord(current) ? current : {};
  const colorRevision = finiteRevision(state.colorRevision)
    + (changes.colorChanged ? 1 : 0);
  const atmosphereRevision = finiteRevision(state.atmosphereRevision)
    + (changes.atmosphereChanged ? 1 : 0);
  return {
    colorRevision,
    atmosphereRevision,
    atmosphereStale: changes.colorChanged
      ? true : state.atmosphereStale === true,
    videoStale: changes.colorChanged || changes.atmosphereChanged
      ? true : state.videoStale === true,
  };
}
/** Complete server-owned identity persisted beside the compat frame. */
export function storyboardPaintoverStateForFrame(
  current: unknown,
  changes: StoryboardPaintoverChangeSet,
  frame: unknown,
): StoryboardPaintoverState {
  return {
    version: 1,
    ...nextStoryboardPaintoverRevisionState(current, changes),
    colorFingerprint: storyboardPaintoverFingerprint(frame, "color"),
    atmosphereFingerprint: storyboardPaintoverFingerprint(frame, "atmosphere"),
    colorHasContent: paintoverLayerHasContent(frame, "color"),
    atmosphereHasContent: paintoverLayerHasContent(frame, "atmosphere"),
  };
}

function paintoverLayerHasContent(
  frame: unknown,
  stage: StoryboardPaintoverStage,
): boolean {
  const strokes = strokesForLayer(frame, LAYER_BY_STAGE[stage]);
  return !Array.isArray(strokes) || strokes.length > 0;
}

/** Only Drawing-layer pixels and Drawing visual state belong to Pencil source. */
export function storyboardPencilOverlayProjection(frame: unknown): unknown {
  return {
    strokes: strokesForLayer(frame, "Drawing"),
    layerState: canonicalLayerVisualState(frame, "Drawing", false),
  };
}
