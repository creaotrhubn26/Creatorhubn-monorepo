import { isDeepStrictEqual } from "node:util";

export type MockupChangeValue = string | number | boolean | null;
export interface MockupChangeOperation {
  id: string;
  targetRef: string;
  targetLabel: string;
  field: string;
  label: string;
  before: MockupChangeValue;
  value: MockupChangeValue;
}
export interface MockupChangeDraft {
  title: string;
  summary: string;
  confidence: number;
  model: string;
  operations: MockupChangeOperation[];
}
export interface MockupChangeComment {
  id: string;
  number: number;
  body: string;
  anchorKind: string;
  anchorRef: string | null;
  anchorX: number | null;
  anchorY: number | null;
}

type JsonObject = Record<string, unknown>;
type ElementKind = "canvas" | "device" | "text" | "image" | "annotation";
type EditableTarget = { ref: string; kind: ElementKind; label: string; value: JsonObject };

const MAX_OPERATIONS = 24;
const TARGET_FIELDS: Record<ElementKind, Set<string>> = {
  canvas: new Set(["accent", "accent2", "bgColor", "background", "bgStyle", "decor", "decorIntensity"]),
  text: new Set(["text", "x", "y", "w", "size", "weight", "color", "align", "lineHeight", "tracking", "uppercase"]),
  device: new Set(["x", "y", "w", "rotation", "variant", "fit", "focusX", "focusY", "shadow"]),
  image: new Set(["x", "y", "w", "h", "rotation", "radius", "fit", "focusX", "focusY", "shadow"]),
  annotation: new Set(["label", "label2", "fx", "fy", "fx2", "fy2", "scale", "color", "side", "n"]),
};
const FIELD_LABELS: Record<string, string> = {
  text: "Tekst", x: "X-posisjon", y: "Y-posisjon", w: "Bredde", h: "Høyde",
  size: "Tekststørrelse", weight: "Skriftvekt", color: "Farge", align: "Justering",
  lineHeight: "Linjehøyde", tracking: "Bokstavavstand", uppercase: "Store bokstaver",
  rotation: "Rotasjon", variant: "Enhetstype", fit: "Bildeutsnitt", focusX: "Fokus vannrett",
  focusY: "Fokus loddrett", shadow: "Skygge", radius: "Hjørneradius",
  label: "Etikett", label2: "Undertekst", fx: "Anker X", fy: "Anker Y",
  fx2: "Sluttpunkt X", fy2: "Sluttpunkt Y", scale: "Skala", n: "Nummer",
  accent: "Primærfarge", accent2: "Sekundærfarge", bgColor: "Bakgrunnsfarge",
  background: "Bakgrunnsmodus", bgStyle: "Bakgrunnsstil", decor: "Dekor",
  decorIntensity: "Dekorstyrke", side: "Retning",
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function scalar(value: unknown): value is MockupChangeValue {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function canvasSize(project: JsonObject): { w: number; h: number } {
  const canvas = isObject(project.canvas) ? project.canvas : {};
  return { w: Math.max(1, Number(canvas.w) || 1080), h: Math.max(1, Number(canvas.h) || 1080) };
}
function targetKind(ref: string): ElementKind | null {
  if (ref === "canvas") return "canvas";
  const kind = ref.split(":", 1)[0];
  return ["device", "text", "image", "annotation"].includes(kind) ? kind as ElementKind : null;
}
function targetId(ref: string): string {
  return ref.includes(":") ? ref.slice(ref.indexOf(":") + 1) : "";
}
function elementArray(project: JsonObject, kind: ElementKind): unknown[] {
  if (kind === "device") return Array.isArray(project.devices) ? project.devices : [];
  if (kind === "text") return Array.isArray(project.texts) ? project.texts : [];
  if (kind === "image") return Array.isArray(project.images) ? project.images : [];
  if (kind === "annotation") return Array.isArray(project.annotations) ? project.annotations : [];
  return [];
}
function targetFor(project: JsonObject, ref: string): EditableTarget | null {
  const kind = targetKind(ref);
  if (!kind) return null;
  if (kind === "canvas") {
    const value = isObject(project.canvas) ? project.canvas : null;
    return value ? { ref, kind, label: "Lerret", value } : null;
  }
  const id = targetId(ref);
  const value = elementArray(project, kind).find((item) => isObject(item) && item.id === id);
  if (!isObject(value)) return null;
  const review = (Array.isArray(project.reviewElements) ? project.reviewElements : [])
    .find((item) => isObject(item) && item.ref === ref);
  const label = isObject(review) ? clean(review.label, 160) : "";
  return { ref, kind, label: label || `${kind} ${id}`, value };
}
function allTargetRefs(project: JsonObject): string[] {
  const refs = ["canvas"];
  for (const kind of ["device", "text", "image", "annotation"] as const) {
    for (const item of elementArray(project, kind)) {
      if (isObject(item) && typeof item.id === "string") refs.push(`${kind}:${item.id}`);
    }
  }
  return refs;
}
function nearestReviewRef(project: JsonObject, x: number | null, y: number | null): string | null {
  if (x == null || y == null || !Array.isArray(project.reviewElements)) return null;
  let best: { ref: string; distance: number } | null = null;
  for (const raw of project.reviewElements) {
    if (!isObject(raw) || typeof raw.ref !== "string") continue;
    const rx = Number(raw.x), ry = Number(raw.y), rw = Number(raw.w), rh = Number(raw.h);
    if (![rx, ry, rw, rh].every(Number.isFinite)) continue;
    const dx = x < rx ? rx - x : x > rx + rw ? x - (rx + rw) : 0;
    const dy = y < ry ? ry - y : y > ry + rh ? y - (ry + rh) : 0;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { ref: raw.ref, distance };
  }
  return best?.ref || null;
}

export function allowedChangeRefs(project: JsonObject, comments: MockupChangeComment[]): string[] {
  const refs = new Set<string>();
  for (const comment of comments) {
    if (comment.anchorRef && targetFor(project, comment.anchorRef)) refs.add(comment.anchorRef);
    else {
      const nearest = nearestReviewRef(project, comment.anchorX, comment.anchorY);
      if (nearest && targetFor(project, nearest)) refs.add(nearest);
      else if (comment.anchorKind === "general") refs.add("canvas");
    }
  }
  return [...refs].slice(0, 80);
}

function normalizeValue(field: string, value: unknown, project: JsonObject): MockupChangeValue | undefined {
  const { w: canvasW, h: canvasH } = canvasSize(project);
  if (["text", "label", "label2"].includes(field)) {
    const text = clean(value, field === "text" ? 4_000 : 500);
    return text || undefined;
  }
  if (["color", "accent", "accent2", "bgColor"].includes(field)) {
    const color = clean(value, 16);
    if (field === "color" && color === "accent") return color;
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : undefined;
  }
  const enums: Record<string, string[]> = {
    align: ["left", "center", "right"], background: ["light", "dark", "brand"],
    bgStyle: ["clean", "gradient", "atmospheric"],
    decor: ["none", "orbs", "mesh", "grid", "shapes", "rings", "stripes", "waves", "spotlight", "confetti", "halftone", "band", "arc"],
    variant: ["iphone", "android", "ipad", "ipad_landscape", "tablet", "macbook", "browser", "watch"],
    fit: ["cover", "contain"], side: ["left", "right", "top", "bottom"],
  };
  if (enums[field]) {
    const item = clean(value, 40);
    return enums[field].includes(item) ? item : undefined;
  }
  if (["uppercase", "shadow"].includes(field)) return typeof value === "boolean" ? value : undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const ranges: Record<string, [number, number]> = {
    x: [0, canvasW], y: [0, canvasH], w: [20, canvasW * 2], h: [20, canvasH * 2],
    size: [6, 400], weight: [100, 1_000], lineHeight: [0.5, 4], tracking: [-20, 50],
    rotation: [-180, 180], focusX: [0, 1], focusY: [0, 1], radius: [0, 500],
    fx: [0, 1], fy: [0, 1], fx2: [0, 1], fy2: [0, 1], scale: [0.2, 4],
    n: [0, 999], decorIntensity: [0, 2],
  };
  const range = ranges[field];
  if (!range) return undefined;
  const bounded = Math.max(range[0], Math.min(range[1], value));
  return field === "n" || field === "weight" ? Math.round(bounded) : Math.round(bounded * 1_000) / 1_000;
}

export function normalizeMockupChangeOperations(
  project: JsonObject,
  rawOperations: unknown,
  allowedRefs = allTargetRefs(project),
): MockupChangeOperation[] {
  if (!Array.isArray(rawOperations)) return [];
  const allowed = new Set(allowedRefs);
  const seen = new Set<string>();
  const operations: MockupChangeOperation[] = [];
  for (const raw of rawOperations.slice(0, MAX_OPERATIONS)) {
    if (!isObject(raw)) continue;
    const ref = clean(raw.targetRef, 220);
    const field = clean(raw.field, 80);
    const target = allowed.has(ref) ? targetFor(project, ref) : null;
    if (!target || !TARGET_FIELDS[target.kind].has(field)) continue;
    const before = target.value[field];
    if (!scalar(before)) continue;
    const value = normalizeValue(field, raw.value, project);
    if (value === undefined || isDeepStrictEqual(before, value)) continue;
    const key = `${ref}\0${field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    operations.push({
      id: clean(raw.id, 100) || `op_${operations.length + 1}`,
      targetRef: ref, targetLabel: target.label, field,
      label: clean(raw.label, 180) || FIELD_LABELS[field] || field,
      before, value,
    });
  }
  return operations;
}

export class StaleMockupChangeError extends Error {
  constructor(public operation: MockupChangeOperation) { super("stale_change_set"); }
}

export function applyMockupChangeOperations(project: JsonObject, operations: MockupChangeOperation[]): JsonObject {
  const next = JSON.parse(JSON.stringify(project)) as JsonObject;
  const seen = new Set<string>();
  for (const operation of operations) {
    const ref = clean(operation.targetRef, 220);
    const field = clean(operation.field, 80);
    const target = targetFor(next, ref);
    const key = `${ref}\0${field}`;
    if (!target || !TARGET_FIELDS[target.kind].has(field) || seen.has(key) || !scalar(operation.before)) {
      throw new Error("ugyldige_operasjoner");
    }
    const value = normalizeValue(field, operation.value, next);
    if (value === undefined) throw new Error("ugyldige_operasjoner");
    if (!isDeepStrictEqual(target.value[operation.field], operation.before)) throw new StaleMockupChangeError(operation);
    seen.add(key);
    target.value[field] = value;
  }
  return next;
}

export function submittedProjectMatchesApplied(expected: JsonObject, submitted: JsonObject): boolean {
  const comparable = (value: JsonObject): JsonObject => {
    const next = JSON.parse(JSON.stringify(value)) as JsonObject;
    delete next.updatedAt;
    delete next.reviewPreview;
    delete next.reviewElements;
    return next;
  };
  return isDeepStrictEqual(comparable(expected), comparable(submitted));
}

function quotedReplacement(body: string): string | null {
  const match = body.match(/(?:til|med|skriv(?:e)?|bruk)\s+[«\"“]([^»\"”]{1,4000})[»\"”]/i)
    || body.match(/[«\"“]([^»\"”]{1,4000})[»\"”]/);
  return match?.[1]?.trim() || null;
}
function requestedDistancePx(body: string): number | null {
  const match = body.match(/\b(\d+(?:[.,]\d+)?)\s*(?:px|piks(?:el|ler|lene)?)\b/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.min(value, 10_000) : null;
}
function requestedDirections(body: string): { left: boolean; right: boolean; up: boolean; down: boolean } {
  const explicitLeft = /\b(?:mot|til|lengre|lenger)\s+(?:mot\s+)?venstre\b/.test(body);
  const explicitRight = /\b(?:mot|til|lengre|lenger)\s+(?:mot\s+)?(?:høyre|hoeyre)\b/.test(body);
  const explicitUp = /\b(?:mot|til|lengre|lenger)\s+(?:mot\s+)?(?:opp|oppover)\b/.test(body);
  const explicitDown = /\b(?:mot|til|lengre|lenger)\s+(?:mot\s+)?(?:ned|nedover)\b/.test(body);
  const hasExplicitHorizontal = explicitLeft || explicitRight;
  const hasExplicitVertical = explicitUp || explicitDown;
  return {
    left: hasExplicitHorizontal ? explicitLeft : /\bvenstre\b/.test(body),
    right: hasExplicitHorizontal ? explicitRight : /\b(?:høyre|hoeyre)\b/.test(body),
    up: hasExplicitVertical ? explicitUp : /\b(?:opp|høyere|hoeyere)\b/.test(body),
    down: hasExplicitVertical ? explicitDown : /\b(?:ned|lavere)\b/.test(body),
  };
}
function annotationEndpointFields(target: EditableTarget, comment: MockupChangeComment): { x: "fx" | "fx2"; y: "fy" | "fy2" } {
  if (target.value.kind !== "connector" || typeof target.value.fx2 !== "number" || typeof target.value.fy2 !== "number") {
    return { x: "fx", y: "fy" };
  }
  if (comment.anchorX == null || comment.anchorY == null || typeof target.value.fx !== "number" || typeof target.value.fy !== "number") {
    return { x: "fx", y: "fy" };
  }
  const first = Math.hypot(comment.anchorX - target.value.fx, comment.anchorY - target.value.fy);
  const second = Math.hypot(comment.anchorX - target.value.fx2, comment.anchorY - target.value.fy2);
  return second < first ? { x: "fx2", y: "fy2" } : { x: "fx", y: "fy" };
}
function suggestedOperations(project: JsonObject, comments: MockupChangeComment[]): unknown[] {
  const { w: canvasW, h: canvasH } = canvasSize(project);
  const result: JsonObject[] = [];
  for (const comment of comments) {
    const ref = comment.anchorRef && targetFor(project, comment.anchorRef)
      ? comment.anchorRef : nearestReviewRef(project, comment.anchorX, comment.anchorY)
        || (comment.anchorKind === "general" ? "canvas" : null);
    if (!ref) continue;
    const target = targetFor(project, ref);
    if (!target) continue;
    const body = comment.body.toLocaleLowerCase("nb-NO");
    const add = (field: string, value: MockupChangeValue, label: string) =>
      result.push({ targetRef: ref, field, value, label: `#${comment.number}: ${label}` });
    const replacement = quotedReplacement(comment.body);
    if (target.kind === "text" && replacement) add("text", replacement, "oppdater teksten");
    if (target.kind === "annotation" && replacement) add("label", replacement, "oppdater etiketten");
    const verticalStep = Math.max(8, Math.round(canvasH * 0.05));
    const horizontalStep = Math.max(8, Math.round(canvasW * 0.05));
    const distancePx = requestedDistancePx(body);
    const directions = requestedDirections(body);
    const distanceLabel = distancePx == null ? "" : ` ${distancePx} px`;
    if (target.kind === "annotation") {
      const fields = annotationEndpointFields(target, comment);
      const x = target.value[fields.x], y = target.value[fields.y];
      const horizontalFraction = (distancePx ?? horizontalStep) / canvasW;
      const verticalFraction = (distancePx ?? verticalStep) / canvasH;
      if (directions.up && typeof y === "number") add(fields.y, y - verticalFraction, `flytt endepunkt${distanceLabel} opp`);
      if (directions.down && typeof y === "number") add(fields.y, y + verticalFraction, `flytt endepunkt${distanceLabel} ned`);
      if (directions.left && typeof x === "number") add(fields.x, x - horizontalFraction, `flytt endepunkt${distanceLabel} mot venstre`);
      if (directions.right && typeof x === "number") add(fields.x, x + horizontalFraction, `flytt endepunkt${distanceLabel} mot høyre`);
    } else {
      if (directions.up && typeof target.value.y === "number") add("y", target.value.y - (distancePx ?? verticalStep), `flytt${distanceLabel} opp`);
      if (directions.down && typeof target.value.y === "number") add("y", target.value.y + (distancePx ?? verticalStep), `flytt${distanceLabel} ned`);
      if (directions.left && typeof target.value.x === "number") add("x", target.value.x - (distancePx ?? horizontalStep), `flytt${distanceLabel} mot venstre`);
      if (directions.right && typeof target.value.x === "number") add("x", target.value.x + (distancePx ?? horizontalStep), `flytt${distanceLabel} mot høyre`);
    }
    if (/\bsentr(?:er|ert|ere)\b/.test(body) && target.kind === "text") add("align", "center", "sentrer teksten");
    const sizeField = target.kind === "text" ? "size" : target.kind === "annotation" ? "scale" : "w";
    const size = target.value[sizeField];
    if (/\b(større|stoerre|øk|oek)\w*\b/.test(body) && typeof size === "number") add(sizeField, size * 1.1, "gjør større");
    if (/\b(mindre|reduser)\w*\b/.test(body) && typeof size === "number") add(sizeField, size * 0.9, "gjør mindre");
    const color = comment.body.match(/#[0-9a-f]{6}\b/i)?.[0];
    if (color && TARGET_FIELDS[target.kind].has("color")) add("color", color, "oppdater fargen");
    if (target.kind === "image" && /\b(vis hele|ikke beskjær|contain)\b/.test(body)) add("fit", "contain", "vis hele bildet");
    if ((target.kind === "image" || target.kind === "device") && /\b(fyll|cover|beskjær)\b/.test(body)) add("fit", "cover", "fyll bildeflaten");
  }
  return result;
}

export function generateLocalMockupChangeDraft(project: JsonObject, comments: MockupChangeComment[]): MockupChangeDraft {
  const refs = allowedChangeRefs(project, comments);
  const operations = normalizeMockupChangeOperations(project, suggestedOperations(project, comments), refs);
  if (!operations.length) throw new Error("ingen_gjennomfoerbare_endringer");
  return {
    title: comments.length === 1 ? `Endring fra kommentar #${comments[0].number}` : `Endringer fra ${comments.length} kommentarer`,
    summary: "Lokalt forslag basert på plassering og konkrete ord i valgt feedback. Kontroller og rediger hver verdi før du godtar.",
    confidence: 0.72,
    model: "local-rules-v1",
    operations,
  };
}
