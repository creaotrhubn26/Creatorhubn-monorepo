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
