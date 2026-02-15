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

export interface BrushConfig {
  type: AdvancedBrushType;
  size: number;
  color: string;
  opacity: number;
  // Advanced settings
  hardness: number;      // 0-1: edge softness
  flow: number;          // 0-1: paint flow rate
  wetness: number;       // 0-1: watercolor wetness
  grain: number;         // 0-1: texture grain amount
  tiltSensitivity: number;
  pressureSensitivity: number;
}

// Alias for external usage
export type ProBrushSettings = BrushConfig;

export const DEFAULT_BRUSH_CONFIG: BrushConfig = {
  type: 'pen',
  size: 4,
  color: '#000000',
  opacity: 1,
  hardness: 0.8,
  flow: 1,
  wetness: 0.5,
  grain: 0.3,
  tiltSensitivity: 0.5,
  pressureSensitivity: 0.8,
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
  },
  eraser: {
    hardness: 0.5,
    flow: 1,
    grain: 0,
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

// =============================================================================
// Advanced Brush Rendering
// =============================================================================

export class AdvancedBrushEngine {
  private ctx: CanvasRenderingContext2D;
  private config: BrushConfig;
  private lastPoint: PencilPoint | null = null;
  private strokeBuffer: ImageData | null = null;
  
  constructor(ctx: CanvasRenderingContext2D, config: BrushConfig = DEFAULT_BRUSH_CONFIG) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_BRUSH_CONFIG, ...config };
  }

  setConfig(config: Partial<BrushConfig>) {
    this.config = { ...this.config, ...config };
    // Apply brush preset if type changed
    if (config.type) {
      const preset = BRUSH_PRESETS[config.type];
      this.config = { ...this.config, ...preset };
    }
  }

  getConfig(): BrushConfig {
    return { ...this.config };
  }

  startStroke(point: PencilPoint) {
    this.lastPoint = point;
    // Capture canvas state for watercolor blending
    if (this.config.type === 'watercolor') {
      this.strokeBuffer = this.ctx.getImageData(
        0, 0, this.ctx.canvas.width, this.ctx.canvas.height
      );
    }
  }

  continueStroke(point: PencilPoint) {
    if (!this.lastPoint) {
      this.lastPoint = point;
      return;
    }

    switch (this.config.type) {
      case 'pencil':
        this.drawPencilStroke(this.lastPoint, point);
        break;
      case 'pen':
        this.drawPenStroke(this.lastPoint, point);
        break;
      case 'marker':
        this.drawMarkerStroke(this.lastPoint, point);
        break;
      case 'brush':
        this.drawBristleBrush(this.lastPoint, point);
        break;
      case 'watercolor':
        this.drawWatercolorStroke(this.lastPoint, point);
        break;
      case 'ink':
        this.drawInkStroke(this.lastPoint, point);
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
    this.strokeBuffer = null;
  }

  // =========================================================================
  // Pencil - Textured with grain
  // =========================================================================
  
  private drawPencilStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, grain, pressureSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 2));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const pressure = from.pressure + (to.pressure - from.pressure) * t;
      
      const strokeSize = size * (0.3 + pressure * 0.7 * pressureSensitivity);
      const strokeOpacity = opacity * (0.5 + pressure * 0.5);
      
      // Draw multiple particles for pencil texture
      const particles = Math.ceil(strokeSize * 2);
      for (let p = 0; p < particles; p++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * strokeSize * 0.5;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        
        // Apply grain noise
        const noiseVal = noise2D(px * 0.5, py * 0.5);
        if (noiseVal < grain * 0.5) continue;
        
        const particleOpacity = strokeOpacity * (0.3 + noiseVal * 0.7);
        
        this.ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${particleOpacity})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 0.5 + Math.random() * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  // =========================================================================
  // Pen - Smooth technical pen
  // =========================================================================
  
  private drawPenStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, pressureSensitivity } = this.config;
    
    const pressure = (from.pressure + to.pressure) / 2;
    const strokeWidth = size * (0.5 + pressure * 0.5 * pressureSensitivity);
    
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = opacity;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.stroke();
    
    this.ctx.globalAlpha = 1;
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
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      
      // Draw ellipse for chisel marker
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(tiltAngle);
      this.ctx.globalAlpha = opacity * 0.3; // Semi-transparent for layering
      this.ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
    
    this.ctx.globalAlpha = 1;
  }

  // =========================================================================
  // Bristle Brush - Multiple bristle strands
  // =========================================================================
  
  private drawBristleBrush(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, pressureSensitivity, tiltSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const bristleCount = Math.ceil(size * 1.5);
    const spread = size * (1 + (1 - pressure) * 0.5);
    
    // Direction of stroke
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const perpAngle = angle + Math.PI / 2;
    
    for (let b = 0; b < bristleCount; b++) {
      // Offset each bristle
      const offset = ((b / bristleCount) - 0.5) * spread;
      const bristleNoise = noise2D(b * 100, from.x + from.y);
      
      const fromX = from.x + Math.cos(perpAngle) * offset;
      const fromY = from.y + Math.sin(perpAngle) * offset;
      const toX = to.x + Math.cos(perpAngle) * (offset + bristleNoise * 2 - 1);
      const toY = to.y + Math.sin(perpAngle) * (offset + bristleNoise * 2 - 1);
      
      const bristleOpacity = opacity * (0.3 + bristleNoise * 0.4) * pressure;
      const bristleWidth = 0.5 + bristleNoise * 1.5;
      
      this.ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${bristleOpacity})`;
      this.ctx.lineWidth = bristleWidth;
      this.ctx.lineCap = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(toX, toY);
      this.ctx.stroke();
    }
  }

  // =========================================================================
  // Watercolor - Wet blending with edge darkening
  // =========================================================================
  
  private drawWatercolorStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, wetness, hardness, pressureSensitivity } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const strokeSize = size * 2 * (0.5 + pressure * 0.5 * pressureSensitivity);
    
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(dist / 4));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      
      // Create soft radial gradient for watercolor blob
      const gradient = this.ctx.createRadialGradient(
        x, y, 0,
        x, y, strokeSize
      );
      
      // Watercolor edge darkening effect
      const edgeDarkening = 1 - hardness * 0.3;
      gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity * 0.1})`);
      gradient.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity * 0.15})`);
      gradient.addColorStop(0.8, `rgba(${rgb.r * edgeDarkening},${rgb.g * edgeDarkening},${rgb.b * edgeDarkening},${opacity * 0.2})`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      
      // Add some randomness to simulate water flow
      const flowNoise = smoothNoise(x, y, 20) * wetness * strokeSize * 0.3;
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.ellipse(
        x + flowNoise * (Math.random() - 0.5),
        y + flowNoise * (Math.random() - 0.5),
        strokeSize * (0.8 + Math.random() * 0.4),
        strokeSize * (0.8 + Math.random() * 0.4),
        Math.random() * Math.PI,
        0, Math.PI * 2
      );
      this.ctx.fill();
    }
  }

  // =========================================================================
  // Ink - Smooth with slight feathering
  // =========================================================================
  
  private drawInkStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity, pressureSensitivity, wetness } = this.config;
    const rgb = hexToRgb(color);
    
    const pressure = (from.pressure + to.pressure) / 2;
    const strokeWidth = size * (0.3 + pressure * 0.7 * pressureSensitivity);
    
    // Main stroke
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = opacity;
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
        
        this.ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${featherOpacity})`;
        this.ctx.lineWidth = featherWidth;
        this.ctx.stroke();
      }
    }
    
    this.ctx.globalAlpha = 1;
  }

  // =========================================================================
  // Highlighter - Transparent multiply overlay
  // =========================================================================
  
  private drawHighlighterStroke(from: PencilPoint, to: PencilPoint) {
    const { size, color, opacity } = this.config;
    
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'multiply';
    this.ctx.strokeStyle = color;
    this.ctx.globalAlpha = opacity * 0.3;
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

    // Temporarily switch context
    const originalCtx = this.ctx;
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

    // Restore original context
    this.ctx = originalCtx;
  }

  /**
   * Create an engine instance without requiring a canvas context
   * Useful for deferred rendering
   */
  static createDeferred(config: Partial<BrushConfig> = {}): AdvancedBrushEngine {
    // Create a temporary canvas for initialization
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const ctx = tempCanvas.getContext('2d')!;
    return new AdvancedBrushEngine(ctx, { ...DEFAULT_BRUSH_CONFIG, ...config });
  }
}

export default AdvancedBrushEngine;
