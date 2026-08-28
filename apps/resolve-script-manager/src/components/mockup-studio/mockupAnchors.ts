import { deviceHeight, type MockupAnchorRef, type MockupAnnotation, type MockupDoc } from './mockupStudioModel';

interface Rect { x: number; y: number; w: number; h: number }

function rectFor(doc: MockupDoc, ref: MockupAnchorRef): Rect | null {
  if (ref.kind === 'canvas') return { x: 0, y: 0, w: doc.canvas.w, h: doc.canvas.h };
  if (!ref.id) return null;
  if (ref.kind === 'device') {
    const item = doc.devices.find((value) => value.id === ref.id);
    return item ? { x: item.x, y: item.y, w: item.w, h: deviceHeight(item) } : null;
  }
  if (ref.kind === 'image') {
    const item = (doc.images ?? []).find((value) => value.id === ref.id);
    return item ? { x: item.x, y: item.y, w: item.w, h: item.h } : null;
  }
  const item = doc.texts.find((value) => value.id === ref.id);
  if (!item) return null;
  const lines = Math.max(1, Math.ceil(Math.max(1, item.text.length) / Math.max(8, item.w / (item.size * 0.55))));
  return { x: item.x, y: item.y, w: item.w, h: lines * item.size * 1.2 };
}
export function resolveMockupAnchor(doc: MockupDoc, ref: MockupAnchorRef | undefined, fallback: { x: number; y: number }): { x: number; y: number } {
  if (!ref) return fallback;
  const rect = rectFor(doc, ref);
  if (!rect) return fallback;
  const edge = ref.edge ?? 'center';
  let x = rect.x + rect.w / 2;
  let y = rect.y + rect.h / 2;
  if (edge === 'left') x = rect.x;
  if (edge === 'right') x = rect.x + rect.w;
  if (edge === 'top') y = rect.y;
  if (edge === 'bottom') y = rect.y + rect.h;
  return { x: x + (ref.offsetX ?? 0), y: y + (ref.offsetY ?? 0) };
}
export function resolveConnectorEndpoints(doc: MockupDoc, annotation: MockupAnnotation): { x1: number; y1: number; x2: number; y2: number } {
  const start = resolveMockupAnchor(doc, annotation.startTarget, { x: annotation.fx * doc.canvas.w, y: annotation.fy * doc.canvas.h });
  const end = resolveMockupAnchor(doc, annotation.endTarget, {
    x: (annotation.fx2 ?? annotation.fx) * doc.canvas.w,
    y: (annotation.fy2 ?? annotation.fy) * doc.canvas.h,
  });
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}
