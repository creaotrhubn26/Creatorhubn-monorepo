import { annRect, measureTextHeight } from './mockupRaster';
import { resolveConnectorEndpoints } from './mockupAnchors';
import { deviceHeight, type MockupDoc, type MockupReviewElement } from './mockupStudioModel';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const normalized = (value: number, base: number): number => clamp01(value / Math.max(1, base));

export function buildMockupReviewElements(doc: MockupDoc): MockupReviewElement[] {
  const W = Math.max(1, doc.canvas.w), H = Math.max(1, doc.canvas.h);
  const elements: MockupReviewElement[] = [];
  for (const device of doc.devices) {
    elements.push({
      ref: `device:${device.id}`, kind: 'device', id: device.id,
      label: `Enhet · ${device.variant}`,
      x: normalized(device.x, W), y: normalized(device.y, H),
      w: normalized(device.w, W), h: normalized(deviceHeight(device), H),
    });
  }
  for (const image of doc.images ?? []) {
    elements.push({
      ref: `image:${image.id}`, kind: 'image', id: image.id,
      label: image.source?.label ? `Bilde · ${image.source.label}` : 'Bilde',
      x: normalized(image.x, W), y: normalized(image.y, H),
      w: normalized(image.w, W), h: normalized(image.h, H),
    });
  }
  for (const text of doc.texts) {
    elements.push({
      ref: `text:${text.id}`, kind: 'text', id: text.id,
      label: `Tekst · ${text.text.replace(/\s+/g, ' ').trim().slice(0, 54) || text.role}`,
      x: normalized(text.x, W), y: normalized(text.y, H),
      w: normalized(text.w, W), h: normalized(measureTextHeight(text), H),
    });
  }
  for (const annotation of doc.annotations ?? []) {
    const bounds = annRect(doc, annotation);
    if (annotation.kind === 'connector') {
      const endpoints = resolveConnectorEndpoints(doc, annotation);
      const pad = Math.max(18, (annotation.scale ?? 1) * 18);
      const minX = Math.min(endpoints.x1, endpoints.x2) - pad;
      const minY = Math.min(endpoints.y1, endpoints.y2) - pad;
      const maxX = Math.max(endpoints.x1, endpoints.x2) + pad;
      const maxY = Math.max(endpoints.y1, endpoints.y2) + pad;
      elements.push({
        ref: `annotation:${annotation.id}`, kind: 'annotation', id: annotation.id,
        label: `Connector · ${annotation.label || annotation.id}`,
        x: normalized(minX, W), y: normalized(minY, H),
        w: normalized(maxX - minX, W), h: normalized(maxY - minY, H),
        path: [
          { x: normalized(endpoints.x1, W), y: normalized(endpoints.y1, H) },
          { x: normalized(endpoints.x2, W), y: normalized(endpoints.y2, H) },
        ],
      });
      continue;
    }
    const cx = bounds.x + annotation.fx * bounds.w;
    const cy = bounds.y + annotation.fy * bounds.h;
    const width = annotation.kind === 'marker'
      ? Math.max(40, (annotation.fw ?? 0.2) * bounds.w)
      : annotation.kind === 'loupe' ? Math.max(60, (annotation.radius ?? 120) * 2) : 150;
    const height = annotation.kind === 'marker'
      ? Math.max(32, (annotation.fh ?? 0.12) * bounds.h)
      : annotation.kind === 'loupe' ? width : 76;
    elements.push({
      ref: `annotation:${annotation.id}`, kind: 'annotation', id: annotation.id,
      label: `${annotation.kind} · ${annotation.label || annotation.n || annotation.id}`,
      x: normalized(cx - width / 2, W), y: normalized(cy - height / 2, H),
      w: normalized(width, W), h: normalized(height, H),
    });
  }
  return elements.map((element) => ({
    ...element,
    x: clamp01(element.x), y: clamp01(element.y),
    w: Math.max(0.002, Math.min(1 - clamp01(element.x), element.w)),
    h: Math.max(0.002, Math.min(1 - clamp01(element.y), element.h)),
  }));
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp01(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function reviewElementAtPoint(elements: MockupReviewElement[], point: { x: number; y: number }): MockupReviewElement | null {
  const candidates = elements.filter((element) => {
    if (element.path?.length === 2 && distanceToSegment(point, element.path[0], element.path[1]) <= 0.025) return true;
    return point.x >= element.x && point.x <= element.x + element.w
      && point.y >= element.y && point.y <= element.y + element.h;
  });
  return candidates.sort((a, b) => {
    if (a.kind === 'annotation' && b.kind !== 'annotation') return -1;
    if (b.kind === 'annotation' && a.kind !== 'annotation') return 1;
    return a.w * a.h - b.w * b.h;
  })[0] ?? null;
}

export function resolveReviewAnchor(
  elements: MockupReviewElement[],
  anchorRef: string | null | undefined,
  offsetX: number | null | undefined,
  offsetY: number | null | undefined,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const element = anchorRef ? elements.find((item) => item.ref === anchorRef) : null;
  if (!element || offsetX == null || offsetY == null) return fallback;
  return {
    x: clamp01(element.x + element.w * clamp01(offsetX)),
    y: clamp01(element.y + element.h * clamp01(offsetY)),
  };
}

export function elementOffset(element: MockupReviewElement | null, point: { x: number; y: number }): { x: number | null; y: number | null } {
  if (!element) return { x: null, y: null };
  return {
    x: clamp01((point.x - element.x) / Math.max(0.0001, element.w)),
    y: clamp01((point.y - element.y) / Math.max(0.0001, element.h)),
  };
}
