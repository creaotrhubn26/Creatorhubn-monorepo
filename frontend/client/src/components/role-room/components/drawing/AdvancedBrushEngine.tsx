/**
 * AdvancedBrushEngine - Professional brush effects for storyboard drawing
 * 
 * Features:
 * - Watercolor wet-on-wet blending
 * - Pencil grain texture
 * - Marker bleed effects
 * - Brush bristle simulation
 * - Ink feathering
 */

import { PencilPoint } from '../../hooks/useApplePencil';

// =============================================================================
// Seeded RNG — deterministic per-stroke randomness
// =============================================================================

/** mulberry32: fast 32-bit seeded PRNG returning 0-1 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple string/number hash → 32-bit integer for seeding */
function hashSeed(...values: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const v of values) {
    const s = String(v);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

// =============================================================================
// Types
// =============================================================================

export type AdvancedBrushType = 
  | 'pencil'      // Textured pencil with grain
  | 'pen'         // Smooth technical pen
  | 'marker'      // Chisel tip marker with bleed
  | 'brush'       // Bristle brush
  | 'watercolor'  // Wet watercolor with blending
  | 'ink'         // Ink with feathering
  | 'highlighter' // Transparent overlay
  | 'eraser';

// Alias for external usage
export type ProBrushType = AdvancedBrushType;

export type CinematicBrushPresetId =
  | 'none'
  | 'noir-lighting'
  | 'commercial-high-key'
  | 'action-crosshatch'
  | 'soft-drama-wash';

export interface BrushConfig {
  type: AdvancedBrushType;
  size: number;
  color: string;
  opacity: number;
  blendMode: GlobalCompositeOperation;
  cinematicPreset: CinematicBrushPresetId;
  // Advanced settings
  hardness: number;      // 0-1: edge softness
  flow: number;          // 0-1: paint flow rate
  wetness: number;       // 0-1: watercolor wetness
  grain: number;         // 0-1: texture grain amount
  tiltSensitivity: number;
  pressureSensitivity: number;
  // Cinematography-aware settings
  lensMm: number;
  aperture: number;
  keyLightDirection: number; // 0-360 degrees
  keyLightIntensity: number; // 0-1
  valueContrast: number; // 0-1
  shadowBias: number; // -1 to 1
  highlightBias: number; // -1 to 1
  warmTint: number; // -1 to 1 (cool to warm)
  hatchAngle: number; // 0-360
  hatchDensity: number; // 0-1
  motionAccent: number; // 0-1
  lightWrap: number; // 0-1
  lensAwareShading: boolean;
  lightingAware: boolean;
}

// Alias for external usage
export type ProBrushSettings = BrushConfig;

export const DEFAULT_BRUSH_CONFIG: BrushConfig = {
  type: 'pen',
  size: 4,
  color: '#000000',
  opacity: 1,
  blendMode: 'source-over',
  cinematicPreset: 'none',
  hardness: 0.8,
  flow: 1,
  wetness: 0.5,
  grain: 0.3,
  tiltSensitivity: 0.5,
  pressureSensitivity: 0.8,
  lensMm: 35,
  aperture: 2.8,
  keyLightDirection: 315,
  keyLightIntensity: 0.4,
  valueContrast: 0.35,
  shadowBias: 0,
  highlightBias: 0,
  warmTint: 0,
  hatchAngle: 45,
  hatchDensity: 0.45,
  motionAccent: 0.2,
  lightWrap: 0.15,
  lensAwareShading: false,
  lightingAware: false,
};

// Alias for external usage
export const DEFAULT_BRUSH_SETTINGS = DEFAULT_BRUSH_CONFIG;

// Brush presets matching the reference image
export const BRUSH_PRESETS: Record<AdvancedBrushType, Partial<BrushConfig>> = {
  pencil: {
    hardness: 0.6,
    flow: 0.8,
    grain: 0.7,
    pressureSensitivity: 0.9,
  },
  pen: {
    hardness: 1,
    flow: 1,
    grain: 0,
    pressureSensitivity: 0.5,
  },
  marker: {
    hardness: 0.3,
    flow: 0.9,
    grain: 0.1,
    tiltSensitivity: 0.8,
  },
  brush: {
    hardness: 0.4,
    flow: 0.7,
    grain: 0.4,
    pressureSensitivity: 1,
    tiltSensitivity: 0.7,
  },
  watercolor: {
    hardness: 0.1,
    flow: 0.5,
    wetness: 0.8,
    grain: 0.2,
    pressureSensitivity: 0.7,
  },
  ink: {
    hardness: 0.7,
    flow: 0.9,
    wetness: 0.3,
    grain: 0,
  },
  highlighter: {
    hardness: 0.2,
    flow: 1,
    grain: 0,
    blendMode: 'multiply',
  },
  eraser: {
    hardness: 0.5,
    flow: 1,
    grain: 0,
    blendMode: 'destination-out',
  },
};

export interface CinematicBrushPreset {
  id: Exclude<CinematicBrushPresetId, 'none'>;
  name: string;
  description: string;
  config: Partial<BrushConfig>;
}

export const CINEMATIC_BRUSH_PRESETS: Record<Exclude<CinematicBrushPresetId, 'none'>, CinematicBrushPreset> = {
  'noir-lighting': {
    id: 'noir-lighting',
    name: 'Noir Lighting Pack',
    description: 'High-contrast chiaroscuro with hard key light and deep shadows.',
    config: {
      type: 'brush',
      blendMode: 'multiply',
      hardness: 0.88,
      flow: 0.82,
      grain: 0.72,
      opacity: 0.95,
      pressureSensitivity: 0.95,
      cinematicPreset: 'noir-lighting',
      keyLightIntensity: 0.92,
      valueContrast: 0.9,
      shadowBias: -0.62,
      highlightBias: 0.2,
      warmTint: -0.04,
      hatchDensity: 0.22,
      lightWrap: 0,
      lensAwareShading: true,
      lightingAware: true,
    },
  },
  'commercial-high-key': {
    id: 'commercial-high-key',
    name: 'Commercial High-Key Pack',
    description: 'Bright, soft transitions with controlled shadow floor and light wrap.',
    config: {
      type: 'watercolor',
      blendMode: 'screen',
      hardness: 0.12,
      flow: 0.4,
      wetness: 0.65,
      opacity: 0.52,
      pressureSensitivity: 0.72,
      cinematicPreset: 'commercial-high-key',
      keyLightIntensity: 0.68,
      valueContrast: 0.2,
      shadowBias: 0.54,
      highlightBias: 0.35,
      warmTint: 0.18,
      lightWrap: 0.75,
      lensAwareShading: true,
      lightingAware: true,
    },
  },
  'action-crosshatch': {
    id: 'action-crosshatch',
    name: 'Action Crosshatch Pack',
    description: 'Gritty hatch-driven lines with velocity-reactive motion accents.',
    config: {
      type: 'ink',
      blendMode: 'multiply',
      hardness: 0.78,
      flow: 0.9,
      grain: 0.42,
      opacity: 0.9,
      pressureSensitivity: 0.98,
      cinematicPreset: 'action-crosshatch',
      keyLightIntensity: 0.58,
      valueContrast: 0.62,
      shadowBias: -0.34,
      highlightBias: 0.16,
      warmTint: -0.08,
      hatchAngle: 38,
      hatchDensity: 0.84,
      motionAccent: 0.82,
      lightWrap: 0.1,
      lensAwareShading: true,
      lightingAware: true,
    },
  },
  'soft-drama-wash': {
    id: 'soft-drama-wash',
    name: 'Soft Drama Wash',
    description: 'Low-flow atmospheric wash with subtle depth separation for emotional beats.',
    config: {
      type: 'watercolor',
      blendMode: 'soft-light',
      hardness: 0.1,
      flow: 0.3,
      wetness: 0.82,
      grain: 0.3,
      opacity: 0.62,
      pressureSensitivity: 0.74,
      cinematicPreset: 'soft-drama-wash',
      keyLightIntensity: 0.46,
      valueContrast: 0.34,
      shadowBias: 0.18,
      highlightBias: 0.12,
      warmTint: 0.08,
      hatchDensity: 0.2,
      motionAccent: 0.06,
      lightWrap: 0.22,
      lensAwareShading: true,
      lightingAware: true,
    },
  },
};

// =============================================================================
// Color Utilities
// =============================================================================

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// =============================================================================
// Noise/Grain Generation
// =============================================================================

// Simple noise function for texture
function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// Perlin-like smooth noise for watercolor
function smoothNoise(x: number, y: number, scale: number = 1): number {
  const ix = Math.floor(x / scale);
  const iy = Math.floor(y / scale);
  const fx = (x / scale) - ix;
  const fy = (y / scale) - iy;
  
  const a = noise2D(ix, iy);
  const b = noise2D(ix + 1, iy);
  const c = noise2D(ix, iy + 1);
  const d = noise2D(ix + 1, iy + 1);
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

// =============================================================================
// Advanced Brush Rendering
// =============================================================================

export class AdvancedBrushEngine {
  private ctx: CanvasRenderingContext2D;
  private config: BrushConfig;
  private lastPoint: PencilPoint | null = null;
  /** Per-stroke seeded PRNG — deterministic strokes for replay & undo */
  private rng: () => number = Math.random;
  private strokeId = 0;
  /** Smoothed velocity (px/ms) used for velocity-based width modulation */
  private velocity = 0;
  
  constructor(ctx: CanvasRenderingContext2D, config: BrushConfig = DEFAULT_BRUSH_CONFIG) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_BRUSH_CONFIG, ...config };
  }

  /**
   * Apply partial config. When `type` changes, preset defaults fill in only
   * the fields that the caller did NOT explicitly provide — so user tweaks
   * (opacity, size, colour …) are preserved.
   */
  setConfig(config: Partial<BrushConfig>) {
    let nextConfig: BrushConfig = { ...this.config };

    if (config.type && config.type !== this.config.type) {
      nextConfig = { ...nextConfig, ...BRUSH_PRESETS[config.type] };
    }

    if (
      config.cinematicPreset &&
      config.cinematicPreset !== 'none' &&
      config.cinematicPreset !== this.config.cinematicPreset
    ) {
      nextConfig = {
        ...nextConfig,
        ...CINEMATIC_BRUSH_PRESETS[config.cinematicPreset].config,
      };
    }

    this.config = {
      ...nextConfig,
      ...config,
      keyLightDirection: normalizeAngle((config.keyLightDirection ?? nextConfig.keyLightDirection)),
      lensMm: clamp(config.lensMm ?? nextConfig.lensMm, 8, 400),
      aperture: clamp(config.aperture ?? nextConfig.aperture, 0.95, 22),
      keyLightIntensity: clamp(config.keyLightIntensity ?? nextConfig.keyLightIntensity, 0, 1),
      valueContrast: clamp(config.valueContrast ?? nextConfig.valueContrast, 0, 1),
      shadowBias: clamp(config.shadowBias ?? nextConfig.shadowBias, -1, 1),
      highlightBias: clamp(config.highlightBias ?? nextConfig.highlightBias, -1, 1),
      warmTint: clamp(config.warmTint ?? nextConfig.warmTint, -1, 1),
      hatchAngle: normalizeAngle(config.hatchAngle ?? nextConfig.hatchAngle),
      hatchDensity: clamp(config.hatchDensity ?? nextConfig.hatchDensity, 0, 1),
      motionAccent: clamp(config.motionAccent ?? nextConfig.motionAccent, 0, 1),
      lightWrap: clamp(config.lightWrap ?? nextConfig.lightWrap, 0, 1),
    };
  }

  getConfig(): BrushConfig {
    return { ...this.config };
  }

  private applyCinematicTone(
    x: number,
    y: number,
    input: { r: number; g: number; b: number; alpha: number },
  ): { r: number; g: number; b: number; alpha: number } {
    const cfg = this.config;
    const canvasWidth = Math.max(1, this.ctx.canvas.width);
    const canvasHeight = Math.max(1, this.ctx.canvas.height);
    const nx = x / canvasWidth - 0.5;
    const ny = y / canvasHeight - 0.5;
    const distanceFromCenter = clamp(Math.hypot(nx, ny) / 0.7071, 0, 1);

    const wideFactor = cfg.lensAwareShading ? clamp((35 - cfg.lensMm) / 27, 0, 1) : 0;
    const teleFactor = cfg.lensAwareShading ? clamp((cfg.lensMm - 85) / 180, 0, 1) : 0;
    const lensFalloff = wideFactor * distanceFromCenter * 0.36 - teleFactor * distanceFromCenter * 0.14;

    const lightRadians = (cfg.keyLightDirection * Math.PI) / 180;
    const lightX = Math.cos(lightRadians);
    const lightY = Math.sin(lightRadians);
    const facing = clamp(-(nx * lightX + ny * lightY), -1, 1);
    const lightInfluence = cfg.lightingAware ? facing * cfg.keyLightIntensity : 0;

    const contrast = 1 + cfg.valueContrast * 0.9;
    const lift = cfg.highlightBias * 42 - cfg.shadowBias * 50 + lightInfluence * 36 - lensFalloff * 62;
    const midpoint = 128;
    const applyChannel = (channel: number): number => {
      const shifted = channel + lift;
      const contrasted = (shifted - midpoint) * contrast + midpoint;
      return clamp(contrasted, 0, 255);
    };

    let r = applyChannel(input.r) + cfg.warmTint * 22;
    let g = applyChannel(input.g) + cfg.warmTint * 10;
    let b = applyChannel(input.b) - cfg.warmTint * 18;

    if (cfg.cinematicPreset === 'noir-lighting') {
      r = Math.pow(r / 255, 1.28) * 214;
      g = Math.pow(g / 255, 1.28) * 214;
      b = Math.pow(b / 255, 1.28) * 214;
    } else if (cfg.cinematicPreset === 'commercial-high-key') {
      r = Math.min(255, 158 + r * 0.44);
      g = Math.min(255, 160 + g * 0.44);
      b = Math.min(255, 164 + b * 0.43);
    } else if (cfg.cinematicPreset === 'soft-drama-wash') {
      const mood = 0.82;
      r = r * 0.88 + 255 * 0.12 * mood;
      g = g * 0.89 + 242 * 0.11 * mood;
      b = b * 0.9 + 235 * 0.1 * mood;
    }

    const alpha = clamp(
      input.alpha * (1 + lightInfluence * 0.12 - lensFalloff * 0.2 + cfg.shadowBias * -0.08),
      0,
      1,
    );

    return {
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      alpha,
    };
  }

  private drawCrosshatchAccents(
    from: PencilPoint,
    to: PencilPoint,
    width: number,
    baseRgb: { r: number; g: number; b: number },
    baseOpacity: number,
  ) {
    const hatchDensity = clamp(this.config.hatchDensity, 0, 1);
    if (hatchDensity <= 0.05) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;

    const steps = Math.max(1, Math.ceil(dist / Math.max(4, width * 1.1)));
    const angle = ((this.config.hatchAngle + (this.rng() - 0.5) * 18) * Math.PI) / 180;
    const hatchLen = clamp(width * (1.6 + this.config.motionAccent), 2, 42);

    this.ctx.save();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      const tone = this.applyCinematicTone(x, y, {
        r: baseRgb.r,
        g: baseRgb.g,
        b: baseRgb.b,
        alpha: baseOpacity * (0.2 + hatchDensity * 0.28),
      });

      const jitter = (this.rng() - 0.5) * width * 0.8;
      const cx = x + jitter;
      const cy = y - jitter * 0.4;
      const x1 = cx - Math.cos(angle) * hatchLen * 0.5;
      const y1 = cy - Math.sin(angle) * hatchLen * 0.5;
      const x2 = cx + Math.cos(angle) * hatchLen * 0.5;
      const y2 = cy + Math.sin(angle) * hatchLen * 0.5;

      this.ctx.strokeStyle = `rgba(${tone.r},${tone.g},${tone.b},${tone.alpha})`;
      this.ctx.lineWidth = clamp(width * 0.14, 0.7, 3);
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawMotionAccents(from: PencilPoint, to: PencilPoint, strokeWidth: number, rgb: { r: number; g: number; b: number }, opacity: number) {
    const accentStrength = clamp(this.config.motionAccent, 0, 1);
    if (accentStrength <= 0.05) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const ndx = dx / dist;
    const ndy = dy / dist;
    const tailLength = strokeWidth * (2.8 + accentStrength * 3.5);
    const streakCount = Math.max(1, Math.round(2 + accentStrength * 3));

    this.ctx.save();
    for (let i = 0; i < streakCount; i++) {
      const offset = ((i / Math.max(1, streakCount - 1)) - 0.5) * strokeWidth * 1.8;
      const px = to.x - ndy * offset;
      const py = to.y + ndx * offset;
      const tone = this.applyCinematicTone(px, py, {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        alpha: opacity * (0.08 + accentStrength * 0.22),
      });

      this.ctx.strokeStyle = `rgba(${tone.r},${tone.g},${tone.b},${tone.alpha})`;
      this.ctx.lineWidth = clamp(strokeWidth * 0.2, 0.6, 2.2);
      this.ctx.beginPath();
      this.ctx.moveTo(px, py);
      this.ctx.lineTo(px - ndx * tailLength, py - ndy * tailLength);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawLightWrap(from: PencilPoint, to: PencilPoint, strokeWidth: number) {
    const wrap = clamp(this.config.lightWrap, 0, 1);
    if (wrap <= 0.05) return;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.strokeStyle = `rgba(255,255,255,${0.04 + wrap * 0.12})`;
    this.ctx.lineWidth = strokeWidth * (1.6 + wrap);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawDepthSeparation(
    from: PencilPoint,
    to: PencilPoint,
    strokeWidth: number,
    rgb: { r: number; g: number; b: number },
    opacity: number,
  ) {
    if (this.config.cinematicPreset !== 'soft-drama-wash') return;
    if (this.config.lensMm < 75 || this.config.aperture > 2.2) return;

    const focusLineY = this.ctx.canvas.height * 0.58;
    const y = (from.y + to.y) / 2;
    const blurRadius = clamp((2.2 - this.config.aperture) * 1.8, 0.4, 3.5);
    const focusBoost = clamp((this.config.lensMm - 75) / 80, 0, 0.35);

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (y < focusLineY) {
      this.ctx.filter = `blur(${blurRadius}px)`;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity * 0.08})`;
      this.ctx.lineWidth = strokeWidth * 2.3;
      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.stroke();
    } else {
      this.ctx.filter = 'none';
      this.ctx.globalCompositeOperation = 'overlay';
      this.ctx.strokeStyle = `rgba(255,255,255,${opacity * (0.04 + focusBoost * 0.25)})`;
      this.ctx.lineWidth = clamp(strokeWidth * 0.62, 0.7, 8);
      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  startStroke(point: PencilPoint) {
    this.lastPoint = point;
    this.strokeId++;
    this.velocity = 0;
    // Seed the RNG from the stroke id + start position so playback is identical
    this.rng = mulberry32(hashSeed(this.strokeId, point.x, point.y, point.timestamp ?? 0));
  }

  continueStroke(point: PencilPoint) {
    if (!this.lastPoint) {
      this.lastPoint = point;
      return;
    }

    // Compute instantaneous velocity (px/ms) for width modulation
    const dt = (point.timestamp ?? 0) - (this.lastPoint.timestamp ?? 0);
    const segDist = Math.hypot(point.x - this.lastPoint.x, point.y - this.lastPoint.y);
    if (dt > 0) {
      const instantVel = segDist / dt;
      // Exponential smoothing (α=0.3) keeps transitions natural
      this.velocity = this.velocity * 0.7 + instantVel * 0.3;
    }

    // Velocity factor: fast strokes → thinner (factor < 1), slow → wider (factor ≈ 1)
    // Clamped to [0.4, 1.2] so lines never vanish or explode
    const velocityFactor = Math.max(0.4, Math.min(1.2, 1.0 - this.velocity * 0.15));

    switch (this.config.type) {
      case 'pencil':
        this.drawPencilStroke(this.lastPoint, point, velocityFactor);
        break;
      case 'pen':
        this.drawPenStroke(this.lastPoint, point, velocityFactor);
        break;
      case 'marker':
        this.drawMarkerStroke(this.lastPoint, point);
        break;
      case 'brush':
        this.drawBristleBrush(this.lastPoint, point, velocityFactor);
        break;
      case 'watercolor':
        this.drawWatercolorStroke(this.lastPoint, point);
        break;
      case 'ink':
        this.drawInkStroke(this.lastPoint, point, velocityFactor);
        break;
      case 'highlighter':
        this.drawHighlighterStroke(this.lastPoint, point);
        break;
      case 'eraser':
        this.drawEraserStroke(this.lastPoint, point);
        break;
    }

    this.lastPoint = point;
  }

  endStroke() {
    this.lastPoint = null;
  }

  // =========================================================================
  // Pencil - Textured with grain
  // =========================================================================
  
  private drawPencilStroke(from: PencilPoint, to: PencilPoint, velocityFactor: number = 1) {
    const { size, color, opacity, grain, pressureSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 2));
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = this.config.blendMode;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const pressure = from.pressure + (to.pressure - from.pressure) * t;
      
      const strokeSize = size * (0.3 + pressure * 0.7 * pressureSensitivity) * velocityFactor;
      const strokeOpacity = opacity * (0.5 + pressure * 0.5);
      
      // Draw multiple particles for pencil texture
      const particles = Math.ceil(strokeSize * 2);
      for (let p = 0; p < particles; p++) {
        const angle = this.rng() * Math.PI * 2;
        const radius = this.rng() * strokeSize * 0.5;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        
        // Apply grain noise
        const noiseVal = noise2D(px * 0.5, py * 0.5);
        if (noiseVal < grain * 0.5) continue;
        
        const particleOpacity = strokeOpacity * (0.3 + noiseVal * 0.7);
        const tone = this.applyCinematicTone(px, py, {
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          alpha: particleOpacity,
        });

        this.ctx.fillStyle = `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 0.5 + this.rng() * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();

    if (this.config.cinematicPreset === 'action-crosshatch') {
      this.drawCrosshatchAccents(from, to, size, rgb, opacity);
      this.drawMotionAccents(from, to, size, rgb, opacity);
    }
  }

  // =========================================================================
  // Pen - Smooth technical pen
  // =========================================================================
  
  private drawPenStroke(from: PencilPoint, to: PencilPoint, velocityFactor: number = 1) {
    const { size, color, opacity, pressureSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const strokeWidth = size * (0.5 + pressure * 0.5 * pressureSensitivity) * velocityFactor;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const tone = this.applyCinematicTone(midX, midY, {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      alpha: opacity,
    });
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = this.config.blendMode;
    this.ctx.strokeStyle = `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    this.ctx.restore();

    if (this.config.cinematicPreset === 'commercial-high-key') {
      this.drawLightWrap(from, to, strokeWidth);
    }
    if (this.config.cinematicPreset === 'action-crosshatch') {
      this.drawCrosshatchAccents(from, to, strokeWidth, rgb, opacity);
      this.drawMotionAccents(from, to, strokeWidth, rgb, opacity);
    }
    this.drawDepthSeparation(from, to, strokeWidth, rgb, opacity);
  }

  // =========================================================================
  // Marker - Chisel tip with slight bleed
  // =========================================================================
  
  private drawMarkerStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, tiltSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    // Calculate tilt-based width (chisel effect)
    const tiltAngle = Math.atan2(to.tiltY - from.tiltY, to.tiltX - from.tiltX);
    const tiltMag = Math.hypot(from.tiltX, from.tiltY) / 90;
    
    const baseWidth = size * 3;
    const width = baseWidth * (1 - tiltMag * tiltSensitivity * 0.5);
    const height = baseWidth * (0.3 + tiltMag * tiltSensitivity * 0.7);
    
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 3));
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = this.config.blendMode;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const tone = this.applyCinematicTone(x, y, {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        alpha: opacity * 0.3,
      });
      
      // Draw ellipse for chisel marker
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(tiltAngle);
      this.ctx.fillStyle = `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`;
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
    this.ctx.restore();

    if (this.config.cinematicPreset === 'commercial-high-key') {
      this.drawLightWrap(from, to, Math.max(width, height));
    }
    this.drawDepthSeparation(from, to, Math.max(width, height), rgb, opacity);
  }

  // =========================================================================
  // Bristle Brush - Multiple bristle strands
  // =========================================================================
  
  private drawBristleBrush(from: PencilPoint, to: PencilPoint, velocityFactor: number = 1) {
    const { size, color, opacity, pressureSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const pressureFactor = Math.max(0.25, 0.5 + pressure * pressureSensitivity);
    const bristleCount = Math.ceil(size * 1.5);
    const spread = size * (1 + (1 - pressureFactor) * 0.5) * velocityFactor;
    
    // Direction of stroke
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const perpAngle = angle + Math.PI / 2;
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = this.config.blendMode;
    for (let b = 0; b < bristleCount; b++) {
      // Offset each bristle
      const offset = ((b / bristleCount) - 0.5) * spread;
      const bristleNoise = noise2D(b * 100, from.x + from.y);
      
      const fromX = from.x + Math.cos(perpAngle) * offset;
      const fromY = from.y + Math.sin(perpAngle) * offset;
      const toX = to.x + Math.cos(perpAngle) * (offset + bristleNoise * 2 - 1);
      const toY = to.y + Math.sin(perpAngle) * (offset + bristleNoise * 2 - 1);
      
      const bristleOpacity = Math.min(
        1,
        opacity * (0.25 + bristleNoise * 0.45) * (0.55 + pressureFactor * 0.6)
      );
      const bristleWidth = (0.4 + bristleNoise * 1.5) * (0.45 + pressureFactor * 0.8);
      const tone = this.applyCinematicTone((fromX + toX) / 2, (fromY + toY) / 2, {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        alpha: bristleOpacity,
      });
      
      this.ctx.strokeStyle = `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`;
      this.ctx.lineWidth = bristleWidth;
      this.ctx.lineCap = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(toX, toY);
      this.ctx.stroke();
    }
    this.ctx.restore();

    if (this.config.cinematicPreset === 'commercial-high-key') {
      this.drawLightWrap(from, to, spread * 0.4);
    }
    if (this.config.cinematicPreset === 'action-crosshatch') {
      this.drawCrosshatchAccents(from, to, spread * 0.35, rgb, opacity);
      this.drawMotionAccents(from, to, spread * 0.35, rgb, opacity);
    }
    this.drawDepthSeparation(from, to, spread * 0.35, rgb, opacity);
  }

  // =========================================================================
  // Watercolor - Wet-on-wet blending with edge darkening & pigment mixing
  // =========================================================================

  /**
   * Convert RGB (0-255) to HSL (h:0-360, s:0-1, l:0-1)
   */
  private static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h * 360, s, l];
  }

  /**
   * Convert HSL back to RGB (0-255)
   */
  private static hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const hue2rgb = (p2: number, q2: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p2 + (q2 - p2) * 6 * t;
      if (t < 1/2) return q2;
      if (t < 2/3) return p2 + (q2 - p2) * (2/3 - t) * 6;
      return p2;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1/3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1/3) * 255),
    ];
  }
  
  private drawWatercolorStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, wetness, hardness, pressureSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const strokeSize = size * 2 * (0.5 + pressure * 0.5 * pressureSensitivity);
    
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 4));

    // Region for pixel readback (wet-on-wet blending)
    const regionX = Math.max(0, Math.floor(Math.min(from.x, to.x) - strokeSize - 2));
    const regionY = Math.max(0, Math.floor(Math.min(from.y, to.y) - strokeSize - 2));
    const regionW = Math.min(
      Math.ceil(Math.abs(to.x - from.x) + strokeSize * 2 + 4),
      (this.ctx.canvas.width - regionX)
    );
    const regionH = Math.min(
      Math.ceil(Math.abs(to.y - from.y) + strokeSize * 2 + 4),
      (this.ctx.canvas.height - regionY)
    );

    // Read existing pixels for wet-on-wet colour mixing
    let imageData: ImageData | null = null;
    if (wetness > 0.2 && regionW > 0 && regionH > 0) {
      try {
        imageData = this.ctx.getImageData(regionX, regionY, regionW, regionH);
      } catch {
        // Canvas may be tainted — fall back to overlay-only mode
        imageData = null;
      }
    }
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = this.config.blendMode;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      
      // Flow variation from seeded noise
      const flowNoise = smoothNoise(x, y, 20) * wetness * strokeSize * 0.3;
      const blobX = x + flowNoise * (this.rng() - 0.5);
      const blobY = y + flowNoise * (this.rng() - 0.5);
      const blobRx = strokeSize * (0.8 + this.rng() * 0.4);
      const blobRy = strokeSize * (0.8 + this.rng() * 0.4);
      const blobRot = this.rng() * Math.PI;

      // ── Wet-on-wet: sample centre pixel, mix in HSL ──
      let mr = rgb.r, mg = rgb.g, mb = rgb.b;
      if (imageData && wetness > 0.2) {
        const px = Math.round(blobX) - regionX;
        const py = Math.round(blobY) - regionY;
        if (px >= 0 && px < regionW && py >= 0 && py < regionH) {
          const idx = (py * regionW + px) * 4;
          const existA = imageData.data[idx + 3];
          if (existA > 10) {  // only blend if existing paint is visible
            const existR = imageData.data[idx];
            const existG = imageData.data[idx + 1];
            const existB = imageData.data[idx + 2];
            const [h1, s1, l1] = AdvancedBrushEngine.rgbToHsl(mr, mg, mb);
            const [h2, s2, l2] = AdvancedBrushEngine.rgbToHsl(existR, existG, existB);
            const blendAmt = wetness * 0.5;   // how much existing paint "bleeds in"
            // Weighted hue average (circular)
            let hDiff = h2 - h1;
            if (hDiff > 180) hDiff -= 360;
            if (hDiff < -180) hDiff += 360;
            const mh = (h1 + hDiff * blendAmt + 360) % 360;
            const ms = s1 + (s2 - s1) * blendAmt;
            const ml = l1 + (l2 - l1) * blendAmt * 0.3; // lightness mixes less aggressively
            [mr, mg, mb] = AdvancedBrushEngine.hslToRgb(mh, ms, ml);
          }
        }
      }

      // ── Radial gradient blob with edge darkening ──
      const gradient = this.ctx.createRadialGradient(
        blobX, blobY, 0,
        blobX, blobY, blobRx
      );
      
      const edgeDarkening = 1 - hardness * 0.3;
      const tone = this.applyCinematicTone(blobX, blobY, {
        r: mr,
        g: mg,
        b: mb,
        alpha: opacity * (0.12 + wetness * 0.1),
      });
      gradient.addColorStop(0, `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha * 0.7})`);
      gradient.addColorStop(0.5, `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`);
      gradient.addColorStop(
        0.8,
        `rgba(${Math.round(tone.r * edgeDarkening)},${Math.round(tone.g * edgeDarkening)},${Math.round(tone.b * edgeDarkening)},${tone.alpha * 1.18})`,
      );
      gradient.addColorStop(1, `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},0)`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.ellipse(blobX, blobY, blobRx, blobRy, blobRot, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ── Paper texture absorption: lighten areas with low density ──
    if (wetness > 0.4 && imageData && regionW > 0 && regionH > 0) {
      try {
        const outData = this.ctx.getImageData(regionX, regionY, regionW, regionH);
        const d = outData.data;
        const texScale = 6;
        for (let py = 0; py < regionH; py += 2) {
          for (let px = 0; px < regionW; px += 2) {
            const idx = (py * regionW + px) * 4;
            if (d[idx + 3] < 10) continue;
            const tex = noise2D((regionX + px) / texScale, (regionY + py) / texScale) * wetness * 0.15;
            d[idx]     = Math.min(255, d[idx]     + tex * 30);
            d[idx + 1] = Math.min(255, d[idx + 1] + tex * 30);
            d[idx + 2] = Math.min(255, d[idx + 2] + tex * 30);
          }
        }
        this.ctx.putImageData(outData, regionX, regionY);
      } catch {
        // tainted — skip texture pass
      }
    }

    this.ctx.restore();

    if (this.config.cinematicPreset === 'commercial-high-key') {
      this.drawLightWrap(from, to, strokeSize * 0.45);
    }
    this.drawDepthSeparation(from, to, strokeSize * 0.45, rgb, opacity);
  }

  // =========================================================================
  // Ink - Smooth with slight feathering
  // =========================================================================
  
  private drawInkStroke(from: PencilPoint, to: PencilPoint, velocityFactor: number = 1) {
    const { size, color, opacity, pressureSensitivity, wetness } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const strokeWidth = size * (0.3 + pressure * 0.7 * pressureSensitivity) * velocityFactor;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const tone = this.applyCinematicTone(midX, midY, {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      alpha: opacity,
    });
    
    this.ctx.save();
    // Main stroke
    this.ctx.globalCompositeOperation = this.config.blendMode;
    this.ctx.strokeStyle = `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    
    // Feathering edges
    if (wetness > 0.2) {
      const featherSteps = 3;
      for (let f = 1; f <= featherSteps; f++) {
        const featherOpacity = opacity * 0.1 * (1 - f / featherSteps) * wetness;
        const featherWidth = strokeWidth + f * 2;
        const featherTone = this.applyCinematicTone(midX, midY, {
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          alpha: featherOpacity,
        });
        
        this.ctx.strokeStyle = `rgba(${Math.round(featherTone.r)},${Math.round(featherTone.g)},${Math.round(featherTone.b)},${featherTone.alpha})`;
        this.ctx.lineWidth = featherWidth;
        this.ctx.stroke();
      }
    }
    this.ctx.restore();

    if (this.config.cinematicPreset === 'commercial-high-key') {
      this.drawLightWrap(from, to, strokeWidth);
    }
    if (this.config.cinematicPreset === 'action-crosshatch') {
      this.drawCrosshatchAccents(from, to, strokeWidth, rgb, opacity);
      this.drawMotionAccents(from, to, strokeWidth, rgb, opacity);
    }
    this.drawDepthSeparation(from, to, strokeWidth, rgb, opacity);
  }

  // =========================================================================
  // Highlighter - Transparent multiply overlay
  // =========================================================================
  
  private drawHighlighterStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity } = this.config;
    const rgb = hexToRgb(color);
    const tone = this.applyCinematicTone((from.x + to.x) / 2, (from.y + to.y) / 2, {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      alpha: opacity * 0.3,
    });
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = this.config.blendMode === 'destination-out' ? 'multiply' : this.config.blendMode;
    this.ctx.strokeStyle = `rgba(${Math.round(tone.r)},${Math.round(tone.g)},${Math.round(tone.b)},${tone.alpha})`;
    this.ctx.lineWidth = size * 4;
    this.ctx.lineCap = 'butt';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // =========================================================================
  // Eraser
  // =========================================================================
  
  private drawEraserStroke(from: PencilPoint, to: PencilPoint) {
    const { size, pressureSensitivity } = this.config;
    
    const pressure = (from.pressure + to.pressure) / 2;
    const eraserSize = size * 3 * (0.5 + pressure * 0.5 * pressureSensitivity);
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    this.ctx.lineWidth = eraserSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // =========================================================================
  // Render Complete Stroke - for external canvas rendering
  // =========================================================================

  /**
   * Render a complete stroke to a canvas context
   * @param ctx - Canvas context to render to
   * @param points - Array of pencil points forming the stroke
   * @param settings - Brush settings to apply
   */
  renderStroke(ctx: CanvasRenderingContext2D, points: PencilPoint[], settings?: Partial<BrushConfig>) {
    if (points.length < 2) return;

    // Temporarily switch context — save & restore to avoid leaking state
    const originalCtx = this.ctx;
    const originalConfig = { ...this.config };
    this.ctx = ctx;
    
    // Apply settings if provided
    if (settings) {
      this.setConfig(settings);
    }

    // Render all segments
    this.startStroke(points[0]);
    for (let i = 1; i < points.length; i++) {
      this.continueStroke(points[i]);
    }
    this.endStroke();

    // Restore original context and config
    this.ctx = originalCtx;
    this.config = originalConfig;
  }

  /**
   * Create an engine instance without requiring a canvas context.
   * SSR-safe: returns null when `document` is unavailable.
   */
  static createDeferred(config: Partial<BrushConfig> = {}): AdvancedBrushEngine | null {
    if (typeof document === 'undefined') return null;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;
    return new AdvancedBrushEngine(ctx, { ...DEFAULT_BRUSH_CONFIG, ...config });
  }
}

export default AdvancedBrushEngine;
