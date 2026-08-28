/**
 * Innholdsbevisst kvalitetskontroll for Mockup Studio.
 * Strukturreglene er rene og testbare; bildeoppløsning lastes asynkront.
 */
import { readImageB64 } from '../../api';
import { DEVICE_FRAMES } from '../demo-studio/deviceFrames';
import {
  type MockupDoc,
  type MockupDeviceSlot,
  type MockupTextRole,
  deviceHeight,
  resolveColor,
  resolveBaseBg,
  contrastRatio,
  FRAME_ASPECT,
} from './mockupStudioModel';
import { hasMeaningfulMockupContent, isPortableMockupAsset, mockupTargetExists } from './mockupPreflightRules';

export type PreflightSeverity = 'must' | 'should' | 'info';
export interface PreflightIssue {
  severity: PreflightSeverity;
  title: string;
  detail?: string;
  deviceId?: string;
  textId?: string;
  imageId?: string;
  annotationId?: string;
}
export const SEVERITY_LABEL: Record<PreflightSeverity, string> = {
  must: 'Må løses', should: 'Bør vurderes', info: 'Informasjon',
};
export const RECOMMENDED_MAX: Record<MockupTextRole, number> = {
  eyebrow: 24, title: 42, body: 150, tag: 40,
};
const VARIANT_LABEL: Record<string, string> = {
  macbook: 'MacBook', ipad: 'iPad', ipad_landscape: 'iPad (liggende)',
  iphone: 'iPhone', watch: 'Apple Watch', android: 'Android', browser: 'Nettleser', tablet: 'Nettbrett',
};
async function canvasSafeSource(src: string): Promise<string> {
  if (isPortableMockupAsset(src) || src.startsWith('blob:')) return src;
  try { return await readImageB64(src); } catch { return src; }
}
async function imageDims(src: string): Promise<{ w: number; h: number }> {
  const resolved = await canvasSafeSource(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = resolved;
  });
}
function screenWidthPx(dev: MockupDeviceSlot): number {
  if (dev.variant === 'watch') return dev.w * 0.76;
  return DEVICE_FRAMES[dev.variant].screen.w * dev.w;
}
function isPortraitDevice(dev: MockupDeviceSlot): boolean {
  return FRAME_ASPECT[dev.variant] < 1;
}

/** Rene regler uten DOM/bildelasting. */
export function runStructuralPreflight(doc: MockupDoc): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const base = resolveBaseBg(doc.canvas);
  if (!hasMeaningfulMockupContent(doc)) {
    issues.push({ severity: 'must', title: 'Tomt materiell', detail: 'Legg til tekst, bilde, enhet eller mind map før eksport.' });
  }
  const hasTitle = doc.texts.some((text) => text.role === 'title' && text.text.trim());
  if (!hasTitle && doc.texts.some((text) => text.text.trim())) {
    issues.push({ severity: 'should', title: 'Mangler overskrift', detail: 'En tydelig overskrift gjør materialet lettere å forstå.' });
  }
  for (const dev of doc.devices) {
    if (!dev.image) {
      issues.push({ severity: 'must', title: `${VARIANT_LABEL[dev.variant] ?? dev.variant} uten skjermbilde`, detail: 'Last opp, fang fra URL eller hent fra simulator.', deviceId: dev.id });
    } else if (!isPortableMockupAsset(dev.image)) {
      issues.push({ severity: 'info', title: 'Lokalt skjermbilde', detail: 'Bildet lastes opp automatisk når prosjektet synkes til skyen.', deviceId: dev.id });
    }
  }
  for (const image of doc.images ?? []) {
    if (!image.image && !image.illustration) {
      issues.push({ severity: 'must', title: 'Bilde mangler kilde', detail: 'Bytt eller fjern det tomme bildeelementet.', imageId: image.id });
    } else if (image.image && !image.illustration && !isPortableMockupAsset(image.image)) {
      issues.push({ severity: 'info', title: 'Lokalt prosjektbilde', detail: 'Bildet lastes opp automatisk som en portabel asset ved skysynk.', imageId: image.id });
    }
  }
  for (const text of doc.texts) {
    const max = RECOMMENDED_MAX[text.role];
    if (text.text.length > max) {
      issues.push({
        severity: 'should', title: 'Tekst er for lang',
        detail: `«${text.text.slice(0, 28)}…» er ${text.text.length - max} tegn over anbefalt lengde for ${text.role}.`,
        textId: text.id,
      });
    }
    const color = resolveColor(text.color, doc.canvas);
    if (contrastRatio(color, base) < 2.5 && text.text.trim()) {
      issues.push({ severity: 'should', title: 'Svak tekstkontrast', detail: `«${text.text.slice(0, 24)}…» har svak kontrast mot bakgrunnen.`, textId: text.id });
    }
    const estimatedHeight = Math.max(text.size * 1.2, Math.ceil(Math.max(1, text.text.length) / Math.max(8, text.w / (text.size * 0.55))) * text.size * 1.2);
    if (text.x < 0 || text.y < 0 || text.x + text.w > doc.canvas.w || text.y + estimatedHeight > doc.canvas.h) {
      issues.push({ severity: 'should', title: 'Tekst kan bli klippet', detail: `«${text.text.slice(0, 24)}» går utenfor lerretet.`, textId: text.id });
    }
  }
  if (doc.devices.length > 3) {
    issues.push({ severity: 'should', title: 'Mange enheter i komposisjonen', detail: `${doc.devices.length} enheter kan svekke hierarkiet. 1–3 anbefales.` });
  }
  for (const annotation of doc.annotations ?? []) {
    if (annotation.kind !== 'connector') continue;
    if (annotation.startTarget && !mockupTargetExists(doc, annotation.startTarget)) {
      issues.push({ severity: 'must', title: 'Connector mangler startmål', detail: 'Velg et eksisterende element som startpunkt.', annotationId: annotation.id });
    }
    if (annotation.endTarget && !mockupTargetExists(doc, annotation.endTarget)) {
      issues.push({ severity: 'must', title: 'Connector mangler sluttmål', detail: 'Velg et eksisterende element som sluttpunkt.', annotationId: annotation.id });
    }
  }
  const margin = doc.canvas.w * 0.03;
  const nearEdge = (x: number, y: number, w: number, h: number) =>
    x < margin || y < margin || x + w > doc.canvas.w - margin || y + h > doc.canvas.h - margin;
  for (const dev of doc.devices) {
    if (nearEdge(dev.x, dev.y, dev.w, deviceHeight(dev))) {
      issues.push({ severity: 'info', title: `${VARIANT_LABEL[dev.variant] ?? dev.variant} nær kanten`, detail: 'Deler av enheten er utenfor trygt område.', deviceId: dev.id });
    }
  }
  return issues;
}

export async function runPreflight(doc: MockupDoc, exportScale = 1): Promise<PreflightIssue[]> {
  const issues = runStructuralPreflight(doc);
  for (const dev of doc.devices) {
    if (!dev.image) continue;
    const dims = await imageDims(dev.image);
    if (!dims.w || !dims.h) {
      issues.push({ severity: 'must', title: `${VARIANT_LABEL[dev.variant] ?? dev.variant}-bildet kan ikke leses`, detail: 'Kilden er flyttet, slettet eller utilgjengelig.', deviceId: dev.id });
      continue;
    }
    const neededPx = screenWidthPx(dev) * exportScale;
    if (dims.w < neededPx * 0.9) {
      issues.push({
        severity: 'should', title: `Lav oppløsning i ${VARIANT_LABEL[dev.variant] ?? dev.variant}`,
        detail: `Bildet er ${dims.w}px bredt, men trenger ~${Math.round(neededPx)}px ved ${exportScale}× eksport. Kan bli uklart.`,
        deviceId: dev.id,
      });
    }
    const imgPortrait = dims.h > dims.w;
    if (imgPortrait !== isPortraitDevice(dev)) {
      issues.push({
        severity: 'should', title: `Feil bildeforhold i ${VARIANT_LABEL[dev.variant] ?? dev.variant}`,
        detail: imgPortrait ? 'Et stående skjermbilde i en liggende enhet blir kraftig beskåret.' : 'Et liggende skjermbilde i en stående enhet blir kraftig beskåret.',
        deviceId: dev.id,
      });
    }
  }
  const order: Record<PreflightSeverity, number> = { must: 0, should: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}
export function preflightSummary(issues: PreflightIssue[]): { must: number; should: number; info: number; ok: boolean } {
  const must = issues.filter((issue) => issue.severity === 'must').length;
  const should = issues.filter((issue) => issue.severity === 'should').length;
  const info = issues.filter((issue) => issue.severity === 'info').length;
  return { must, should, info, ok: must === 0 };
}
