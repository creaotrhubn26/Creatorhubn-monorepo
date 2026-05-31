// @ts-nocheck
/**
 * stampEngine — Procreate-paritet stamp-rendering for brush preview.
 *
 * Strokes rendres som roterte teksturerte dabs langs banen i stedet for
 * en flat polyline. Hver dab tas fra en off-screen "dab-canvas" som er
 * generert proseduralt ved init — ingen disk-PNG, ingen runtime-deps.
 *
 * Brukes per i dag av live-preview-laget i PencilCanvasPro. Final
 * persistens går fortsatt via AdvancedBrushEngine + lagrede polyline-
 * strokes — kompatibilitet med eksisterende data er bevart.
 *
 * Konfigurerbar per dab:
 *   - spacing            (% av brush-size)
 *   - scatter            (% radial jitter rundt dab-senter)
 *   - jitterAngle        (±deg rotasjon per dab)
 *   - tiltRotation       (Apple Pencil tilt-vinkel → dab-rotasjon)
 *   - pressureToSize     (0..1 — hvor mye trykk skalerer dab)
 *   - pressureToOpacity  (0..1 — hvor mye trykk skalerer dab-alpha)
 *   - flow               (per-dab opacity før layer-opacity)
 */

import type { PencilPoint } from '../hooks/useApplePencil';
import type { ProBrushSettings, ProBrushType } from './drawing/AdvancedBrushEngine';

// ============================================================================
// Types
// ============================================================================

export type DabPreset =
  | 'pencil-graphite'
  | 'charcoal-tooth'
  | 'ink-round'
  | 'marker-chisel'
  | 'bristle-flat'
  | 'bristle-round'
  | 'airbrush-spray'
  | 'texture-paper';

export interface StampConfig {
  preset: DabPreset;
  spacing: number;          // % av size, 0.03..0.5
  scatter: number;          // % radial jitter, 0..0.3
  jitterAngle: number;      // ±deg
  tiltRotation: boolean;    // bruk Apple Pencil tilt for rotasjon
  pressureToSize: number;   // 0..1
  pressureToOpacity: number;// 0..1
  flow: number;             // 0..1 per-dab alpha
  sizeMultiplier: number;   // global skala vs brush.size
}

const DAB_CANVAS_SIZE = 128;

// ============================================================================
// Dab texture cache (proseduralt generert, ikke disk)
// ============================================================================

let dabCache: Partial<Record<DabPreset, HTMLCanvasElement>> | null = null;

function createDabCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = DAB_CANVAS_SIZE;
  c.height = DAB_CANVAS_SIZE;
  return c;
}

function buildPencilGraphite(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.45;
  // Hardere kant, granulær interior — pseudo-tilfeldige prikker
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, DAB_CANVAS_SIZE, DAB_CANVAS_SIZE);
  // Mild base-soft
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  // Granulær graupel: små prikker
  for (let i = 0; i < 220; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius * 0.95;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const fade = 1 - r / radius;
    const alpha = 0.18 + Math.random() * 0.5 * fade;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, 0.4 + Math.random() * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function buildCharcoalTooth(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.48;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, DAB_CANVAS_SIZE, DAB_CANVAS_SIZE);
  // Sprutete tekstur — større, varierte flekker
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.7) * radius;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const size = 0.6 + Math.random() * 3.2;
    const alpha = 0.05 + Math.random() * 0.55;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function buildInkRound(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.42;
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function buildMarkerChisel(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  // Rektangulær med rounded ends — chisel-tip
  const halfW = DAB_CANVAS_SIZE * 0.4;
  const halfH = DAB_CANVAS_SIZE * 0.16;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(cx - halfW + halfH, cy - halfH);
  ctx.lineTo(cx + halfW - halfH, cy - halfH);
  ctx.arc(cx + halfW - halfH, cy, halfH, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(cx - halfW + halfH, cy + halfH);
  ctx.arc(cx - halfW + halfH, cy, halfH, Math.PI / 2, -Math.PI / 2);
  ctx.fill();
  // Mykt overlay
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, DAB_CANVAS_SIZE * 0.45);
  grad.addColorStop(0, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, DAB_CANVAS_SIZE, DAB_CANVAS_SIZE);
  return c;
}

function buildBristleFlat(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.45;
  // Horisontale striper som mimer pensel-hår
  const bristleCount = 14;
  const spacing = (radius * 2) / bristleCount;
  for (let i = 0; i < bristleCount; i++) {
    const y = cy - radius + i * spacing + spacing / 2;
    const offsetTop = Math.sqrt(Math.max(0, radius * radius - (y - cy) * (y - cy)));
    const x1 = cx - offsetTop;
    const x2 = cx + offsetTop;
    const alpha = 0.35 + Math.random() * 0.45;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = 0.8 + Math.random() * 1.0;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }
  return c;
}

function buildBristleRound(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.45;
  // Radiale striper
  const spokes = 28;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + Math.random() * 0.06;
    const innerR = radius * (0.12 + Math.random() * 0.2);
    const outerR = radius * (0.7 + Math.random() * 0.3);
    const alpha = 0.25 + Math.random() * 0.55;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
    ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.stroke();
  }
  // Soft center
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function buildAirbrushSpray(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.25)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, DAB_CANVAS_SIZE, DAB_CANVAS_SIZE);
  return c;
}

function buildTexturePaper(): HTMLCanvasElement {
  const c = createDabCanvas();
  const ctx = c.getContext('2d')!;
  const cx = DAB_CANVAS_SIZE / 2;
  const cy = DAB_CANVAS_SIZE / 2;
  const radius = DAB_CANVAS_SIZE * 0.45;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  // Paper-grain støy
  const img = ctx.getImageData(0, 0, DAB_CANVAS_SIZE, DAB_CANVAS_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random();
    const cut = n < 0.4 ? 0.55 + n * 0.6 : 1;
    img.data[i + 3] = Math.floor(img.data[i + 3] * cut);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function ensureDabCache(): Required<Record<DabPreset, HTMLCanvasElement>> {
  if (dabCache && Object.keys(dabCache).length === 8) {
    return dabCache as Required<Record<DabPreset, HTMLCanvasElement>>;
  }
  dabCache = {
    'pencil-graphite': buildPencilGraphite(),
    'charcoal-tooth': buildCharcoalTooth(),
    'ink-round': buildInkRound(),
    'marker-chisel': buildMarkerChisel(),
    'bristle-flat': buildBristleFlat(),
    'bristle-round': buildBristleRound(),
    'airbrush-spray': buildAirbrushSpray(),
    'texture-paper': buildTexturePaper(),
  };
  return dabCache as Required<Record<DabPreset, HTMLCanvasElement>>;
}

/** Tving re-generering — brukes hvis store dab-størrelser krever ny tekstur. */
export function resetDabCache(): void {
  dabCache = null;
  // tintedCache er avhengig av dab-source — tøm også den.
  if (tintedCache) tintedCache.clear();
}

// ============================================================================
// ProBrushType → StampConfig mapping
// ============================================================================

const STAMP_CONFIG_BY_BRUSH: Partial<Record<ProBrushType, StampConfig>> = {
  pencil: {
    preset: 'pencil-graphite',
    spacing: 0.10,
    scatter: 0.02,
    jitterAngle: 25,
    tiltRotation: true,
    pressureToSize: 0.7,
    pressureToOpacity: 0.55,
    flow: 0.45,
    sizeMultiplier: 1.05,
  },
  ink: {
    preset: 'ink-round',
    spacing: 0.03,
    scatter: 0,
    jitterAngle: 0,
    tiltRotation: false,
    pressureToSize: 0.9,
    pressureToOpacity: 0.3,
    flow: 0.85,
    sizeMultiplier: 1.0,
  },
  pen: {
    preset: 'ink-round',
    spacing: 0.04,
    scatter: 0,
    jitterAngle: 0,
    tiltRotation: false,
    pressureToSize: 0.45,
    pressureToOpacity: 0.2,
    flow: 0.9,
    sizeMultiplier: 0.9,
  },
  marker: {
    preset: 'marker-chisel',
    spacing: 0.08,
    scatter: 0.01,
    jitterAngle: 4,
    tiltRotation: true,
    pressureToSize: 0.45,
    pressureToOpacity: 0.25,
    flow: 0.6,
    sizeMultiplier: 2.0,
  },
  brush: {
    preset: 'bristle-flat',
    spacing: 0.07,
    scatter: 0.02,
    jitterAngle: 10,
    tiltRotation: true,
    pressureToSize: 0.7,
    pressureToOpacity: 0.45,
    flow: 0.55,
    sizeMultiplier: 1.6,
  },
  watercolor: {
    preset: 'bristle-round',
    spacing: 0.10,
    scatter: 0.06,
    jitterAngle: 18,
    tiltRotation: true,
    pressureToSize: 0.5,
    pressureToOpacity: 0.4,
    flow: 0.25,
    sizeMultiplier: 2.2,
  },
  graphite: {
    preset: 'pencil-graphite',
    spacing: 0.08,
    scatter: 0.025,
    jitterAngle: 30,
    tiltRotation: true,
    pressureToSize: 0.8,
    pressureToOpacity: 0.55,
    flow: 0.5,
    sizeMultiplier: 1.4,
  },
  charcoal: {
    preset: 'charcoal-tooth',
    spacing: 0.09,
    scatter: 0.07,
    jitterAngle: 40,
    tiltRotation: true,
    pressureToSize: 0.85,
    pressureToOpacity: 0.5,
    flow: 0.4,
    sizeMultiplier: 1.6,
  },
  conte: {
    preset: 'charcoal-tooth',
    spacing: 0.08,
    scatter: 0.04,
    jitterAngle: 22,
    tiltRotation: true,
    pressureToSize: 0.7,
    pressureToOpacity: 0.5,
    flow: 0.5,
    sizeMultiplier: 1.3,
  },
};

/** Returnerer stamp-config for brush-type, eller null hvis brush ikke skal stamp-rendres. */
export function getStampConfigForBrush(type: ProBrushType): StampConfig | null {
  return STAMP_CONFIG_BY_BRUSH[type] ?? null;
}

/** True hvis brush skal stamp-rendres i preview-laget. */
export function shouldUseStampPreview(type: ProBrushType): boolean {
  return STAMP_CONFIG_BY_BRUSH[type] !== undefined;
}

// ============================================================================
// Stamp rendering
// ============================================================================

function hexToRgbTriplet(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// Tinted dab-cache — vi tinter dab-en med farge én gang per (preset, color)
// og re-bruker resulterende canvas på alle dabs i samme stroke. Cachen
// holdes minimal (typisk 1-2 entries i bruk om gangen).
const tintedCache = new Map<string, HTMLCanvasElement>();
const TINTED_CACHE_LIMIT = 16;

function getTintedDab(
  preset: DabPreset,
  source: HTMLCanvasElement,
  rgb: [number, number, number],
): HTMLCanvasElement {
  const key = `${preset}|${rgb[0]},${rgb[1]},${rgb[2]}`;
  const cached = tintedCache.get(key);
  if (cached) return cached;

  // Enkel LRU-ish: tøm når over limit (sjelden — bare ved palette-skift)
  if (tintedCache.size >= TINTED_CACHE_LIMIT) {
    tintedCache.clear();
  }

  const canvas = document.createElement('canvas');
  canvas.width = DAB_CANVAS_SIZE;
  canvas.height = DAB_CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  ctx.fillRect(0, 0, DAB_CANVAS_SIZE, DAB_CANVAS_SIZE);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  tintedCache.set(key, canvas);
  return canvas;
}

function interpolatePoint(a: PencilPoint, b: PencilPoint, t: number): PencilPoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    pressure: a.pressure + (b.pressure - a.pressure) * t,
    tiltX: (a.tiltX ?? 0) + ((b.tiltX ?? 0) - (a.tiltX ?? 0)) * t,
    tiltY: (a.tiltY ?? 0) + ((b.tiltY ?? 0) - (a.tiltY ?? 0)) * t,
    timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
  };
}

/** Returnerer tilt-vinkel (rad) basert på tiltX/tiltY — Apple Pencil chisel-rotasjon. */
function tiltAngleRad(p: PencilPoint): number {
  const tx = p.tiltX ?? 0;
  const ty = p.tiltY ?? 0;
  if (tx === 0 && ty === 0) return 0;
  return Math.atan2(ty, tx);
}

/**
 * Tegner én dab på ctx ved (x, y) med oppgitt rotasjon, skala og alpha.
 * Bruker setTransform direkte (raskere enn save/restore for hver dab).
 */
function drawSingleDab(
  ctx: CanvasRenderingContext2D,
  dab: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha: number,
): void {
  const scale = size / DAB_CANVAS_SIZE;
  const cos = Math.cos(rotation) * scale;
  const sin = Math.sin(rotation) * scale;
  ctx.setTransform(cos, sin, -sin, cos, x, y);
  ctx.globalAlpha = alpha;
  ctx.drawImage(dab, -DAB_CANVAS_SIZE / 2, -DAB_CANVAS_SIZE / 2);
}

/**
 * Stamp ett segment fra `from` til `to`. Returnerer "carry distance" — hvor
 * mye av neste segment som allerede er konsumert av spacing. Caller skal
 * holde state mellom segmenter for å unngå hopp ved punkt-bytter.
 */
export function stampSegment(
  ctx: CanvasRenderingContext2D,
  from: PencilPoint,
  to: PencilPoint,
  brush: ProBrushSettings,
  config: StampConfig,
  carryDistance: number,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return carryDistance;

  const baseSize = Math.max(2, brush.size * config.sizeMultiplier);
  const spacingPx = Math.max(0.5, baseSize * config.spacing);
  const cache = ensureDabCache();
  const dab = cache[config.preset];
  const rgb = hexToRgbTriplet(brush.color);
  const tinted = getTintedDab(config.preset, dab, rgb);

  let traveled = -carryDistance;
  // Tegn dabs ved jevne mellomrom langs segmentet
  while (traveled + spacingPx <= dist) {
    traveled += spacingPx;
    const t = traveled / dist;
    const sample = interpolatePoint(from, to, t);
    renderDabAt(ctx, tinted, sample, brush, config, dx, dy);
  }

  // Returnér uforbrukt rest så neste segment fortsetter rytmen
  return dist - traveled;
}

function renderDabAt(
  ctx: CanvasRenderingContext2D,
  tinted: HTMLCanvasElement,
  sample: PencilPoint,
  brush: ProBrushSettings,
  config: StampConfig,
  dirX: number,
  dirY: number,
): void {
  const pressure = Math.max(0.05, sample.pressure);
  // pressureToSize: 0=ingen effekt (full size), 1=lineær med pressure
  const pressureSizeFactor = 1 - config.pressureToSize + pressure * config.pressureToSize;
  const baseSize = Math.max(2, brush.size * config.sizeMultiplier);
  const size = baseSize * pressureSizeFactor * (0.6 + brush.pressureSensitivity * 0.4);

  const pressureAlphaFactor = 1 - config.pressureToOpacity + pressure * config.pressureToOpacity;
  const alpha = Math.min(1, brush.opacity * config.flow * pressureAlphaFactor);

  // Scatter — radial jitter
  let x = sample.x;
  let y = sample.y;
  if (config.scatter > 0) {
    const jitterMag = Math.random() * config.scatter * baseSize;
    const jitterAngle = Math.random() * Math.PI * 2;
    x += Math.cos(jitterAngle) * jitterMag;
    y += Math.sin(jitterAngle) * jitterMag;
  }

  // Rotation: tilt (hvis tiltRotation) eller bevegelsesretning + jitter
  let rotation: number;
  if (config.tiltRotation) {
    rotation = tiltAngleRad(sample);
    if (rotation === 0) {
      rotation = Math.atan2(dirY, dirX);
    }
  } else {
    rotation = Math.atan2(dirY, dirX);
  }
  if (config.jitterAngle > 0) {
    rotation += ((Math.random() * 2 - 1) * config.jitterAngle * Math.PI) / 180;
  }

  drawSingleDab(ctx, tinted, x, y, size, rotation, alpha);
}

/**
 * Tegner en hel stamp-stroke fra et punkt-array. Brukes for fallback /
 * batch-rendering. Returnerer total carry-state hvis caller fortsetter.
 */
export function stampPolyline(
  ctx: CanvasRenderingContext2D,
  points: PencilPoint[],
  brush: ProBrushSettings,
  config: StampConfig,
): void {
  if (points.length < 2) {
    if (points.length === 1) {
      // Single tap — én dab
      const cache = ensureDabCache();
      const dab = cache[config.preset];
      const rgb = hexToRgbTriplet(brush.color);
      const tinted = getTintedDab(config.preset, dab, rgb);
      ctx.save();
      renderDabAt(ctx, tinted, points[0], brush, config, 1, 0);
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }
    return;
  }
  ctx.save();
  let carry = 0;
  for (let i = 0; i < points.length - 1; i++) {
    carry = stampSegment(ctx, points[i], points[i + 1], brush, config, carry);
  }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

/**
 * Reset ctx transform/alpha — caller bør kalle denne etter en serie stamp-kall.
 */
export function resetCtxAfterStamp(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}
