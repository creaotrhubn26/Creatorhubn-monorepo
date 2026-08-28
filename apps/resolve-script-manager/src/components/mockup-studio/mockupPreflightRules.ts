import type { MockupDoc } from './mockupStudioModel';

export interface PreflightTargetRef {
  kind: 'canvas' | 'device' | 'image' | 'text';
  id?: string;
}
export interface PreflightDocShape {
  devices: { id: string }[];
  images?: { id: string }[];
  texts: { id: string; text: string }[];
  mindmap?: string;
}
export function isPortableMockupAsset(src: string): boolean {
  return /^(?:data:|https?:|mockup-cloud-file:)/i.test(src) || src.startsWith('/assets/');
}

function portableRemoteSource(value: unknown): string | undefined {
  return typeof value === 'string' && isPortableMockupAsset(value) ? value : undefined;
}

/**
 * Cloud payloads are collaborator-controlled input. Strip local paths and
 * transient blob/file URLs before the document reaches Tauri image loading.
 * This prevents a shared project from making another desktop read a local file.
 */
export function sanitizeRemoteMockupProjectAssets(doc: MockupDoc): MockupDoc {
  const out = structuredClone(doc);

  for (const device of out.devices) device.image = portableRemoteSource(device.image);
  for (const image of out.images ?? []) {
    image.image = portableRemoteSource(image.image) ?? '';
    image.video = portableRemoteSource(image.video);
    if (image.sprite) {
      image.sprite.frames = image.sprite.frames.filter((frame) => Boolean(portableRemoteSource(frame)));
      if (image.sprite.frames.length === 0) image.sprite = undefined;
    }
  }

  if (out.canvas.logo) {
    const logo = portableRemoteSource(out.canvas.logo.image);
    if (logo) out.canvas.logo.image = logo;
    else out.canvas.logo = undefined;
  }
  out.canvas.bgImage = portableRemoteSource(out.canvas.bgImage);
  if (out.canvas.audio) {
    const audio = portableRemoteSource(out.canvas.audio.src);
    out.canvas.audio = audio ? { ...out.canvas.audio, src: audio } : undefined;
  }
  out.reviewPreview = portableRemoteSource(out.reviewPreview);

  return out;
}
export function hasMeaningfulMockupContent(doc: PreflightDocShape): boolean {
  return doc.devices.length > 0
    || (doc.images?.length ?? 0) > 0
    || Boolean(doc.mindmap?.trim())
    || doc.texts.some((text) => Boolean(text.text.trim()));
}
export function mockupTargetExists(doc: PreflightDocShape, target: PreflightTargetRef): boolean {
  if (target.kind === 'canvas') return true;
  if (!target.id) return false;
  if (target.kind === 'device') return doc.devices.some((item) => item.id === target.id);
  if (target.kind === 'image') return (doc.images ?? []).some((item) => item.id === target.id);
  return doc.texts.some((item) => item.id === target.id);
}
