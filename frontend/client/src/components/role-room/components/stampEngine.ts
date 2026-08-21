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

export interface HatchParams {
  lineLength: number;
  lineSpacing: number;
  lineWidth: number;
  angle: number;        // rad (35°)
  angleJitter: number;
  crossAngle: number;   // rad (112° — bevisst ikke 90°)
  positionJitter: number;
  lengthJitter: number;
  // Speed lines: følg strøkretningen, aldri kryss-lag.
  followDirection?: boolean;
  allowCross?: boolean;
}

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
  // Story Brush Engine-dynamikk (samme semantikk som iPad-motoren)
  pressureCurve?: number;      // pow-eksponent (default 1 = lineær)
  velocityToSize?: number;     // negativ = raskere → tynnere
  velocityToOpacity?: number;
  wobble?: number;             // lavfrekvent smooth noise, faktor
  taperDistance?: number;      // px taper inn/ut
  tiltOval?: number;           // 0..1 — tilt → bred/flat oval
  sizeJitter?: number;
  directionTexture?: number;   // mikrolinjer i strøkretning (Shade 2.0)
  hatch?: HatchParams;         // prosedural skravering
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
  // ── Story Brush Engine (storyboard-brush-engine.md, iPad-paritet) ──
  layout: {
    preset: 'pencil-graphite', spacing: 0.09, scatter: 0.08, jitterAngle: 10,
    tiltRotation: true, pressureToSize: 0.58, pressureToOpacity: 0.52,
    flow: 0.55, sizeMultiplier: 1.0,
    pressureCurve: 0.65, velocityToSize: -0.08, velocityToOpacity: -0.18, wobble: 0.14,
  },
  heavy: {
    preset: 'pencil-graphite', spacing: 0.08, scatter: 0.10, jitterAngle: 14,
    tiltRotation: true, pressureToSize: 0.78, pressureToOpacity: 0.72,
    flow: 1.0, sizeMultiplier: 1.3,
    pressureCurve: 0.65, velocityToSize: -0.12, velocityToOpacity: -0.24, wobble: 0.16,
  },
  detail: {
    preset: 'ink-round', spacing: 0.045, scatter: 0.025, jitterAngle: 5,
    tiltRotation: false, pressureToSize: 0.88, pressureToOpacity: 0.38,
    flow: 0.85, sizeMultiplier: 1.0,
    pressureCurve: 0.7, velocityToSize: -0.10, velocityToOpacity: -0.10,
    wobble: 0.05, taperDistance: 6,
  },
  hatch: {
    preset: 'ink-round', spacing: 0.14, scatter: 0, jitterAngle: 0,
    tiltRotation: false, pressureToSize: 0.2, pressureToOpacity: 0.4,
    flow: 0.9, sizeMultiplier: 1.0, pressureCurve: 0.75,
    hatch: {
      lineLength: 15, lineSpacing: 5, lineWidth: 0.85,
      angle: (35 * Math.PI) / 180, angleJitter: 0.06,
      crossAngle: (112 * Math.PI) / 180,
      positionJitter: 1.2, lengthJitter: 0.15,
    },
  },
  crosshatch: {
    preset: 'ink-round', spacing: 0.14, scatter: 0, jitterAngle: 0,
    tiltRotation: false, pressureToSize: 0.2, pressureToOpacity: 0.4,
    flow: 0.9, sizeMultiplier: 1.0, pressureCurve: 0.75,
    hatch: {
      lineLength: 15, lineSpacing: 5, lineWidth: 0.85,
      angle: (35 * Math.PI) / 180, angleJitter: 0.06,
      crossAngle: (112 * Math.PI) / 180,
      positionJitter: 1.2, lengthJitter: 0.15,
    },
  },
  shade: {
    preset: 'charcoal-tooth', spacing: 0.075, scatter: 0.04, jitterAngle: 6,
    tiltRotation: true, pressureToSize: 0.40, pressureToOpacity: 0.70,
    flow: 0.5, sizeMultiplier: 1.0,
    pressureCurve: 0.8, velocityToOpacity: -0.18,
    wobble: 0.3, tiltOval: 0.9, sizeJitter: 0.1, directionTexture: 0.8,
  },
  graintex: {
    preset: 'charcoal-tooth', spacing: 0.18, scatter: 0.72, jitterAngle: 180,
    tiltRotation: false, pressureToSize: 0.2, pressureToOpacity: 0.56,
    flow: 0.6, sizeMultiplier: 1.0, pressureCurve: 0.8, sizeJitter: 0.42,
  },
  kneaded: {
    preset: 'charcoal-tooth', spacing: 0.08, scatter: 0.05, jitterAngle: 20,
    tiltRotation: false, pressureToSize: 0.3, pressureToOpacity: 0.72,
    flow: 0.6, sizeMultiplier: 1.0, pressureCurve: 0.72,
  },
  lightlift: {
    preset: 'ink-round', spacing: 0.06, scatter: 0.1, jitterAngle: 0,
    tiltRotation: false, pressureToSize: 0.2, pressureToOpacity: 0.58,
    flow: 0.35, sizeMultiplier: 1.0, pressureCurve: 0.55,
  },
  // Fase 2 Environmental: native genererer strukturer (gran/kvister/shards/
  // strå); web viser forenklet scatter til egen generator porteres.
  forest: {
    preset: 'charcoal-tooth', spacing: 0.2, scatter: 0.5, jitterAngle: 90,
    tiltRotation: false, pressureToSize: 0.46, pressureToOpacity: 0.4,
    flow: 0.6, sizeMultiplier: 1.0, pressureCurve: 0.8, sizeJitter: 0.3,
  },
  debris: {
    preset: 'charcoal-tooth', spacing: 0.2, scatter: 0.6, jitterAngle: 180,
    tiltRotation: false, pressureToSize: 0.38, pressureToOpacity: 0.4,
    flow: 0.55, sizeMultiplier: 1.0, pressureCurve: 0.8, sizeJitter: 0.4,
  },
  organictex: {
    preset: 'charcoal-tooth', spacing: 0.18, scatter: 0.5, jitterAngle: 60,
    tiltRotation: false, pressureToSize: 0.4, pressureToOpacity: 0.74,
    flow: 0.55, sizeMultiplier: 1.0, pressureCurve: 0.8, sizeJitter: 0.35,
  },
  fur: {
    preset: 'ink-round', spacing: 0.12, scatter: 0.35, jitterAngle: 30,
    tiltRotation: false, pressureToSize: 0.4, pressureToOpacity: 0.4,
    flow: 0.5, sizeMultiplier: 0.6, pressureCurve: 0.8, sizeJitter: 0.4,
  },
  // Funnet i praksis-test mot referanse-storyboards:
  toneblock: {
    preset: 'marker-chisel', spacing: 0.045, scatter: 0.015, jitterAngle: 6,
    tiltRotation: true, pressureToSize: 0.3, pressureToOpacity: 0.35,
    flow: 0.95, sizeMultiplier: 1.4, pressureCurve: 0.8, wobble: 0.08,
  },
  speedlines: {
    preset: 'ink-round', spacing: 0.3, scatter: 0, jitterAngle: 0,
    tiltRotation: false, pressureToSize: 0.25, pressureToOpacity: 0.45,
    flow: 0.85, sizeMultiplier: 1.0, pressureCurve: 0.8,
    hatch: {
      lineLength: 64, lineSpacing: 9, lineWidth: 0.7,
      angle: 0, angleJitter: 0.03, crossAngle: 0,
      positionJitter: 2.2, lengthJitter: 0.4,
      followDirection: true, allowCross: false,
    },
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

// ============================================================================
// Seeded RNG — commit-rendering må være deterministisk: samme strøk skal se
// identisk ut ved hver redraw (undo, lagbytte, eksport). mulberry32.
// ============================================================================

export function hashStringToSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Papirtann låst til LERRETET (Procreate «Texturized» grain / Krita Texture
// multiply): tekstur samples på dab-POSISJON, så kornet er kontinuerlig på
// tvers av strøk — som å gni blyant over samme papir. To oktaver value-noise.
function valueNoise1(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothValueNoise(x: number, y: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx); const uy = fy * fy * (3 - 2 * fy);
  const a = valueNoise1(ix, iy);
  const b = valueNoise1(ix + 1, iy);
  const c = valueNoise1(ix, iy + 1);
  const d = valueNoise1(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function paperTooth(x: number, y: number): number {
  return 0.65 * smoothValueNoise(x, y) + 0.35 * smoothValueNoise(x * 2.7 + 11.3, y * 2.7 + 5.1);
}

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

/** Lavfrekvent smooth noise for menneskelig wobble (spec §15). */
function wobbleNoise(t: number): number {
  return Math.sin(t * 1.13) * 0.5 + Math.sin(t * 0.47) * 0.3 + Math.sin(t * 2.17) * 0.2;
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
  stretchX = 1,
  stretchY = 1,
): void {
  const scaleX = (size / DAB_CANVAS_SIZE) * stretchX;
  const scaleY = (size / DAB_CANVAS_SIZE) * stretchY;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  // transform (ikke setTransform) — bevarer basen (f.eks. devicePixelRatio)
  ctx.save();
  ctx.transform(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, x, y);
  ctx.globalAlpha = alpha;
  ctx.drawImage(dab, -DAB_CANVAS_SIZE / 2, -DAB_CANVAS_SIZE / 2);
  ctx.restore();
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
  rng: () => number = Math.random,
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

  // Prosedural skravering (spec §10/§37): klynger i stedet for dabs.
  if (config.hatch) {
    return hatchSegment(ctx, from, to, brush, config, config.hatch, carryDistance, rng);
  }

  // Fart i px/ms fra timestamps (spec §5).
  const dt = Math.max(1, (to.timestamp ?? 0) - (from.timestamp ?? 0));
  const velocity = dist / dt;

  let traveled = -carryDistance;
  // Tegn dabs ved jevne mellomrom langs segmentet
  while (traveled + spacingPx <= dist) {
    traveled += spacingPx;
    const t = traveled / dist;
    const sample = interpolatePoint(from, to, t);
    renderDabAt(ctx, tinted, sample, brush, config, dx, dy, rng, velocity);
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
  rng: () => number = Math.random,
  velocity = 0,
): void {
  // Pressure curve (spec §8): pow — ikke lineær.
  const pressure = Math.pow(Math.max(0.05, sample.pressure), config.pressureCurve ?? 1);
  // pressureToSize: 0=ingen effekt (full size), 1=lineær med pressure
  let pressureSizeFactor = 1 - config.pressureToSize + pressure * config.pressureToSize;
  if (config.velocityToSize) {
    pressureSizeFactor *= Math.max(0.6, 1 + config.velocityToSize * Math.min(velocity, 2));
  }
  const baseSize = Math.max(2, brush.size * config.sizeMultiplier);
  let size = baseSize * pressureSizeFactor * (0.6 + brush.pressureSensitivity * 0.4);
  if (config.sizeJitter) {
    size *= 1 + (rng() - 0.5) * 2 * config.sizeJitter;
  }

  let pressureAlphaFactor = 1 - config.pressureToOpacity + pressure * config.pressureToOpacity;
  if (config.velocityToOpacity) {
    pressureAlphaFactor *= Math.max(0.5, 1 + config.velocityToOpacity * Math.min(velocity, 2));
  }
  // Grain = papirtann i CANVAS-space (Procreate «Texturized» / Krita Texture
  // multiply): tekstur samples på posisjon, så kornet er kontinuerlig på
  // tvers av strøk. Grovere ved høy grain, aldri blekere snitt. En liten
  // rng-komponent gir dab-variasjon (Procreate «Moving»-følelse) på toppen.
  const grain = typeof brush.grain === 'number' ? Math.min(1, Math.max(0, brush.grain)) : 0;
  let grainFactor = 1;
  if (grain > 0) {
    const tooth = paperTooth(sample.x * 0.22, sample.y * 0.22);
    grainFactor = (1 - grain * (1 - tooth) * 0.85) * (1 - grain * 0.12 + rng() * grain * 0.24);
  }
  const alpha = Math.min(1, brush.opacity * config.flow * pressureAlphaFactor * grainFactor);

  // Scatter — radial jitter; grain øker spredningen litt (papirtann)
  let x = sample.x;
  let y = sample.y;
  // Menneskelig wobble (spec §15): vinkelrett på strøkretningen.
  if (config.wobble) {
    const dirLen = Math.max(0.0001, Math.hypot(dirX, dirY));
    const wob = wobbleNoise((sample.x + sample.y) * 0.05) * config.wobble * baseSize * 0.35;
    x += (-dirY / dirLen) * wob;
    y += (dirX / dirLen) * wob;
  }
  const scatter = config.scatter * (1 + grain * 0.6);
  if (scatter > 0) {
    const jitterMag = rng() * scatter * baseSize;
    const jitterAngle = rng() * Math.PI * 2;
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
    rotation += ((rng() * 2 - 1) * config.jitterAngle * Math.PI) / 180;
  }

  // Tilt-oval (spec §12): flat stylus → bred/flat grafittside.
  let stretchX = 1;
  let stretchY = 1;
  if (config.tiltOval) {
    const tilt = Math.min(1, Math.hypot(sample.tiltX ?? 0, sample.tiltY ?? 0) / 90);
    stretchX = 1 + tilt * 2.5 * config.tiltOval;
    stretchY = Math.max(0.3, 1 - tilt * 0.55 * config.tiltOval);
  }
  drawSingleDab(ctx, tinted, x, y, size, rotation, alpha, stretchX, stretchY);

  // Shade 2.0 (spec §38): mikrolinjer i strøkretningen.
  if (config.directionTexture && rng() < config.directionTexture) {
    const dirLen = Math.max(0.0001, Math.hypot(dirX, dirY));
    const ux = dirX / dirLen;
    const uy = dirY / dirLen;
    const offset = (rng() - 0.5) * size * 0.8;
    const lift = (rng() - 0.5) * size * 0.5;
    drawSingleDab(
      ctx, tinted,
      x + ux * offset - uy * lift,
      y + uy * offset + ux * lift,
      size * 0.18, Math.atan2(uy, ux), Math.min(1, alpha * 0.8), 3.5, 0.5,
    );
  }
}

/**
 * Story Hatch / Cross Hatch (spec §10/§37): organiske 5-segments merker i
 * klynger langs banen. Trykk styrer tetthet og kryss-lag. Deterministisk
 * med seeded rng (samme mekanikk som iPad-motoren).
 */
function hatchSegment(
  ctx: CanvasRenderingContext2D,
  from: PencilPoint,
  to: PencilPoint,
  brush: ProBrushSettings,
  config: StampConfig,
  params: HatchParams,
  carryDistance: number,
  rng: () => number,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return carryDistance;

  const region = Math.max(8, brush.size);
  const sizeRatio = Math.max(0.4, brush.size / 34);
  const markLength = params.lineLength * sizeRatio;
  const markWidth = Math.max(1, params.lineWidth * 1.6);
  const markSpacing = params.lineSpacing * sizeRatio;
  const alwaysCross = brush.type === 'crosshatch';

  ctx.save();
  ctx.strokeStyle = brush.color;
  ctx.lineCap = 'round';
  ctx.lineWidth = markWidth;

  const mark = (cx: number, cy: number, angle: number, alpha: number) => {
    const length = markLength * (1 + (rng() - 0.5) * params.lengthJitter);
    const markAngle = angle + (rng() - 0.5) * params.angleJitter * 2;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    let prevX = cx - Math.cos(markAngle) * length * 0.5;
    let prevY = cy - Math.sin(markAngle) * length * 0.5;
    ctx.moveTo(prevX, prevY);
    const segments = 5;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const wob = (rng() - 0.5) * 0.9;
      const px = cx + Math.cos(markAngle) * (t - 0.5) * length - Math.sin(markAngle) * wob;
      const py = cy + Math.sin(markAngle) * (t - 0.5) * length + Math.cos(markAngle) * wob;
      ctx.lineTo(px, py);
      prevX = px;
      prevY = py;
    }
    ctx.stroke();
  };

  const baseDirection = Math.atan2(dy, dx);
  const cluster = (point: PencilPoint) => {
    const pressure = Math.pow(Math.max(0.05, point.pressure), config.pressureCurve ?? 1);
    const density = pressure < 0.35 ? 0.3 : pressure < 0.7 ? 0.65 : 1.0;
    const cross = (params.allowCross ?? true) && (alwaysCross || pressure >= 0.7);
    const markAngle = params.followDirection ? baseDirection : params.angle;
    const alpha = Math.min(1, brush.opacity * (0.7 + pressure * 0.5));
    const rows = Math.max(1, Math.floor((region / markSpacing) * density));
    for (let i = 0; i < rows; i++) {
      const ox = (rng() - 0.5) * region;
      const oy = (rng() - 0.5) * region;
      const jx = (rng() - 0.5) * params.positionJitter;
      const jy = (rng() - 0.5) * params.positionJitter;
      mark(point.x + ox + jx, point.y + oy + jy, markAngle, alpha);
      if (cross) {
        mark(point.x + ox - jx, point.y + oy - jy, params.crossAngle, alpha * 0.85);
      }
    }
  };

  const clusterSpacing = region * 0.55;
  let traveled = -carryDistance;
  while (traveled + clusterSpacing <= dist) {
    traveled += clusterSpacing;
    cluster(interpolatePoint(from, to, traveled / dist));
  }
  ctx.restore();
  return dist - traveled;
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
  rng: () => number = Math.random,
): void {
  if (points.length < 2) {
    if (points.length === 1) {
      // Single tap — én dab
      const cache = ensureDabCache();
      const dab = cache[config.preset];
      const rgb = hexToRgbTriplet(brush.color);
      const tinted = getTintedDab(config.preset, dab, rgb);
      renderDabAt(ctx, tinted, points[0], brush, config, 1, 0, rng);
      ctx.globalAlpha = 1;
    }
    return;
  }
  let carry = 0;
  for (let i = 0; i < points.length - 1; i++) {
    carry = stampSegment(ctx, points[i], points[i + 1], brush, config, carry, rng);
  }
  ctx.globalAlpha = 1;
}

/**
 * Deterministisk commit-rendering av et helt strøk: samme strokeId gir
 * identisk resultat ved hver redraw (undo, lagbytte, eksport). Dette er
 * motoren det persisterte laget skal bruke — samme dabs som preview.
 */
export function renderStrokeStamped(
  ctx: CanvasRenderingContext2D,
  points: PencilPoint[],
  brush: ProBrushSettings,
  config: StampConfig,
  strokeId: string,
): void {
  const rng = createSeededRng(hashStringToSeed(strokeId || 'stroke'));
  // Taper inn/ut (spec §9): pressure skaleres mot endene — pressure driver
  // bredde, så dette gir smalere start/slutt uten motorendring.
  let renderPoints = points;
  if (config.taperDistance && points.length > 2) {
    let total = 0;
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      cumulative.push(total);
    }
    if (total > 0) {
      renderPoints = points.map((point, i) => {
        const taper = Math.min(1, Math.min(cumulative[i], total - cumulative[i]) / config.taperDistance!);
        return { ...point, pressure: point.pressure * Math.max(0.15, taper) };
      });
    }
  }
  stampPolyline(ctx, renderPoints, brush, config, rng);
}

/**
 * Reset ctx alpha — caller bør kalle denne etter en serie stamp-kall.
 * (Transform røres ikke lenger — dabs bruker save/restore og bevarer
 * basen, f.eks. devicePixelRatio-skalering.)
 */
export function resetCtxAfterStamp(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 1;
}
