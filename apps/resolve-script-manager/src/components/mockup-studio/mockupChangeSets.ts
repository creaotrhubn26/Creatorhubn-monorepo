import type { MockupDoc } from "./mockupStudioModel";

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

const FIELDS: Record<string, Set<string>> = {
  canvas: new Set(["accent", "accent2", "bgColor", "background", "bgStyle", "decor", "decorIntensity"]),
  text: new Set(["text", "x", "y", "w", "size", "weight", "color", "align", "lineHeight", "tracking", "uppercase"]),
  device: new Set(["x", "y", "w", "rotation", "variant", "fit", "focusX", "focusY", "shadow"]),
  image: new Set(["x", "y", "w", "h", "rotation", "radius", "fit", "focusX", "focusY", "shadow"]),
  annotation: new Set(["label", "label2", "fx", "fy", "fx2", "fy2", "scale", "color", "side", "n"]),
};

function sameValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b);
}

export class StaleLocalMockupChangeError extends Error {
  constructor(public operation: MockupChangeOperation) {
    super(operation.targetLabel + " · " + operation.label + " er allerede endret.");
  }
}

export function applyMockupChangeSet(
  doc: MockupDoc,
  operations: MockupChangeOperation[],
  now = Date.now(),
): MockupDoc {
  const next = JSON.parse(JSON.stringify(doc)) as MockupDoc;
  const seen = new Set<string>();
  for (const operation of operations) {
    const [kind, ...idParts] = operation.targetRef.split(":");
    const id = idParts.join(":");
    let target: Record<string, unknown> | undefined;
    if (operation.targetRef === "canvas") target = next.canvas as unknown as Record<string, unknown>;
    else if (kind === "text") target = next.texts.find((item) => item.id === id) as unknown as Record<string, unknown> | undefined;
    else if (kind === "device") target = next.devices.find((item) => item.id === id) as unknown as Record<string, unknown> | undefined;
    else if (kind === "image") target = next.images?.find((item) => item.id === id) as unknown as Record<string, unknown> | undefined;
    else if (kind === "annotation") target = next.annotations?.find((item) => item.id === id) as unknown as Record<string, unknown> | undefined;
    const key = operation.targetRef + "\0" + operation.field;
    if (!target || !FIELDS[kind]?.has(operation.field) || seen.has(key)) throw new Error("Ugyldig endringsforslag.");
    if (!sameValue(target[operation.field], operation.before)) throw new StaleLocalMockupChangeError(operation);
    target[operation.field] = operation.value;
    seen.add(key);
  }
  next.updatedAt = Math.max(now, doc.updatedAt + 1);
  delete next.reviewPreview;
  delete next.reviewElements;
  return next;
}

export function applyHydratedMockupChangeSet(
  doc: MockupDoc,
  operations: MockupChangeOperation[],
  appliedProject: Pick<MockupDoc, "updatedAt" | "reviewPreview" | "reviewElements">,
): MockupDoc {
  const next = applyMockupChangeSet(doc, operations, appliedProject.updatedAt);
  next.reviewPreview = appliedProject.reviewPreview;
  next.reviewElements = appliedProject.reviewElements;
  return next;
}
