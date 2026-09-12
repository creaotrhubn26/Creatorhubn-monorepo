/**
 * mockupPreflight.ts — kvalitetskontroll (§1.7 / §7 / eksport-skjerm steg 1).
 *
 * «Profesjonell kvalitet skal være standard»: systemet forhindrer aktivt
 * dårlige resultater. runPreflight analyserer et MockupDoc og returnerer funn
 * gruppert etter alvorlighetsgrad (Må løses / Bør vurderes / Informasjon).
 * Async fordi noen sjekker (oppløsning, bildeforhold) laster device-bildene.
 */

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

export type PreflightSeverity = 'must' | 'should' | 'info';

export interface PreflightIssue {
  severity: PreflightSeverity;
  title: string;
  detail?: string;
  deviceId?: string;
  textId?: string;
}

export const SEVERITY_LABEL: Record<PreflightSeverity, string> = {
  must: 'Må løses',
  should: 'Bør vurderes',
  info: 'Informasjon',
};

/** Anbefalt maks tegn per tekst-rolle (§ steg 4 / §7 tekst). */
export const RECOMMENDED_MAX: Record<MockupTextRole, number> = {
  eyebrow: 24,
  title: 42,
  body: 150,
  tag: 40,
};

const VARIANT_LABEL: Record<string, string> = {
  macbook: 'MacBook', ipad: 'iPad', ipad_landscape: 'iPad (liggende)', iphone: 'iPhone', watch: 'Apple Watch',
};

function imageDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = src;
  });
}

/** Skjerm-flatens bredde i lerret-px (for oppløsnings-sjekk). */
function screenWidthPx(dev: MockupDeviceSlot): number {
  if (dev.variant === 'watch') return dev.w * 0.76; // inset 0.12 hver side
  return DEVICE_FRAMES[dev.variant].screen.w * dev.w;
}

/** Er enheten portrett-orientert? */
function isPortraitDevice(dev: MockupDeviceSlot): boolean {
  return FRAME_ASPECT[dev.variant] < 1;
}

/**
 * Kjør full kvalitetskontroll. `exportScale` (1/2/4) påvirker oppløsnings-
 * kravet — vi beregner EFFEKTIV oppløsning i endelig eksport, ikke bare
 * originalfilens størrelse.
 */
export async function runPreflight(doc: MockupDoc, exportScale = 1): Promise<PreflightIssue[]> {
  const issues: PreflightIssue[] = [];
  const base = resolveBaseBg(doc.canvas);

  // 1. Manglende innhold (må).
  if (doc.devices.length === 0) {
    issues.push({ severity: 'must', title: 'Ingen enheter', detail: 'Legg til minst én enhet med et produktskjermbilde.' });
  }
  const hasTitle = doc.texts.some((t) => t.role === 'title' && t.text.trim().length > 0);
  if (!hasTitle && doc.texts.length > 0) {
    issues.push({ severity: 'should', title: 'Mangler overskrift', detail: 'En tydelig overskrift gjør materialet lettere å forstå.' });
  }

  // 2. Device-slots uten skjermbilde (må).
  for (const dev of doc.devices) {
    if (!dev.image) {
      issues.push({ severity: 'must', title: `${VARIANT_LABEL[dev.variant] ?? dev.variant} uten skjermbilde`, detail: 'Last opp, fang fra URL eller hent fra simulator.', deviceId: dev.id });
    }
  }

  // 3. Oppløsning + bildeforhold per device med bilde.
  for (const dev of doc.devices) {
    if (!dev.image) continue;
    const dims = await imageDims(dev.image);
    if (!dims.w || !dims.h) continue;
    const neededPx = screenWidthPx(dev) * exportScale;
    if (dims.w < neededPx * 0.9) {
      issues.push({
        severity: 'should',
        title: `Lav oppløsning i ${VARIANT_LABEL[dev.variant] ?? dev.variant}`,
        detail: `Bildet er ${dims.w}px bredt, men trenger ~${Math.round(neededPx)}px ved ${exportScale}× eksport. Kan bli uklart.`,
        deviceId: dev.id,
      });
    }
    const imgPortrait = dims.h > dims.w;
    if (imgPortrait !== isPortraitDevice(dev)) {
      issues.push({
        severity: 'should',
        title: `Feil bildeforhold i ${VARIANT_LABEL[dev.variant] ?? dev.variant}`,
        detail: imgPortrait ? 'Et stående skjermbilde i en liggende enhet blir kraftig beskåret.' : 'Et liggende skjermbilde i en stående enhet blir kraftig beskåret.',
        deviceId: dev.id,
      });
    }
  }

  // 4. Tekst for lang + svak kontrast.
  for (const t of doc.texts) {
    const max = RECOMMENDED_MAX[t.role];
    if (t.text.length > max) {
      issues.push({
        severity: 'should',
        title: 'Tekst er for lang',
        detail: `«${t.text.slice(0, 28)}…» er ${t.text.length - max} tegn over anbefalt lengde for ${t.role}.`,
        textId: t.id,
      });
    }
    const color = resolveColor(t.color, doc.canvas);
    if (contrastRatio(color, base) < 2.5 && t.text.trim()) {
      issues.push({ severity: 'should', title: 'Svak tekstkontrast', detail: `«${t.text.slice(0, 24)}…» har svak kontrast mot bakgrunnen.`, textId: t.id });
    }
  }

  // 5. For mange enheter (bør) — spec: maler optimalisert for maks 3.
  if (doc.devices.length > 3) {
    issues.push({ severity: 'should', title: 'Mange enheter i komposisjonen', detail: `${doc.devices.length} enheter kan svekke hierarkiet. 1–3 anbefales.` });
  }

  // 6. Trygt område (info): elementer nær kanten.
  const m = doc.canvas.w * 0.03;
  const nearEdge = (x: number, y: number, w: number, h: number) =>
    x < m || y < m || x + w > doc.canvas.w - m || y + h > doc.canvas.h - m;
  for (const dev of doc.devices) {
    if (nearEdge(dev.x, dev.y, dev.w, deviceHeight(dev))) {
      issues.push({ severity: 'info', title: `${VARIANT_LABEL[dev.variant] ?? dev.variant} nær kanten`, detail: 'Deler av enheten er utenfor trygt område.', deviceId: dev.id });
    }
  }

  // Sorter: må → bør → info.
  const order: Record<PreflightSeverity, number> = { must: 0, should: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Kort oppsummering (for badge/knapp). */
export function preflightSummary(issues: PreflightIssue[]): { must: number; should: number; info: number; ok: boolean } {
  const must = issues.filter((i) => i.severity === 'must').length;
  const should = issues.filter((i) => i.severity === 'should').length;
  const info = issues.filter((i) => i.severity === 'info').length;
  return { must, should, info, ok: must === 0 };
}
