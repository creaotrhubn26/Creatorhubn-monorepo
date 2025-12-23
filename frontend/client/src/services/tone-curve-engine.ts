/**
 * TONE CURVE ENGINE
 * Professional tone curve manipulation for Lightroom-style editing
 * Supports RGB, Red, Green, Blue channel curves with bezier interpolation
 */

export interface CurvePoint {
  x: number; // Input value (0-255)
  y: number; // Output value (0-255)
}

export interface ToneCurve {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

/**
 * Default linear curve (no adjustment)
 */
export const DEFAULT_CURVE: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

/**
 * Tone Curve Engine
 */
export class ToneCurveEngine {
  /**
   * Apply bezier curve interpolation between points
   */
  static bezierInterpolation(
    points: CurvePoint[],
    input: number
  ): number {
    if (points.length === 0) return input;
    if (points.length === 1) return points[0].y;

    // Sort points by x
    const sorted = [...points].sort((a, b) => a.x - b.x);

    // Clamp input
    if (input <= sorted[0].x) return sorted[0].y;
    if (input >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

    // Find surrounding points and apply true Bezier interpolation
    for (let i = 0; i < sorted.length - 1; i++) {
      if (input >= sorted[i].x && input <= sorted[i + 1].x) {
        const t = (input - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
        
        // Use cubic Bezier for smooth curves (research-backed: Yan et al., 2016)
        if (sorted.length >= 4 && i > 0 && i < sorted.length - 2) {
          // Use surrounding points as control points for Bezier
          const p0 = sorted[i - 1] || sorted[i];
          const p1 = sorted[i];
          const p2 = sorted[i + 1];
          const p3 = sorted[i + 2] || sorted[i + 1];
          return this.cubicBezier(p0, p1, p2, p3, t);
        } else {
          // Fallback to smooth interpolation for edge cases
          // Use ease-in-out curve for natural transitions
          const easedT = t < 0.5 
            ? 2 * t * t 
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
          return sorted[i].y + easedT * (sorted[i + 1].y - sorted[i].y);
        }
      }
    }

    return input;
  }

  /**
   * Apply cubic bezier curve (smooth curve)
   */
  static cubicBezier(
    p0: CurvePoint,
    p1: CurvePoint,
    p2: CurvePoint,
    p3: CurvePoint,
    t: number
  ): number {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return (
      mt3 * p0.y +
      3 * mt2 * t * p1.y +
      3 * mt * t2 * p2.y +
      t3 * p3.y
    );
  }

  /**
   * Apply tone curve to image data
   */
  static applyCurve(
    imageData: ImageData,
    curve: CurvePoint[],
    channel: 'rgb' | 'red' | 'green' | 'blue' = 'rgb'
  ): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const curveFn = (value: number) => this.bezierInterpolation(curve, value);

    for (let i = 0; i < data.length; i += 4) {
      if (channel === 'rgb') {
        // Apply to all channels
        data[i] = Math.round(curveFn(data[i])); // R
        data[i + 1] = Math.round(curveFn(data[i + 1])); // G
        data[i + 2] = Math.round(curveFn(data[i + 2])); // B
      } else if (channel === 'red') {
        data[i] = Math.round(curveFn(data[i]));
      } else if (channel === 'green') {
        data[i + 1] = Math.round(curveFn(data[i + 1]));
      } else if (channel === 'blue') {
        data[i + 2] = Math.round(curveFn(data[i + 2]));
      }
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply multiple curves (RGB + individual channels)
   */
  static applyToneCurve(
    imageData: ImageData,
    curves: Partial<ToneCurve>
  ): ImageData {
    let result = imageData;

    // Apply RGB curve first
    if (curves.rgb && curves.rgb.length > 0) {
      result = this.applyCurve(result, curves.rgb, 'rgb');
    }

    // Then apply individual channel curves
    if (curves.red && curves.red.length > 0) {
      result = this.applyCurve(result, curves.red, 'red');
    }
    if (curves.green && curves.green.length > 0) {
      result = this.applyCurve(result, curves.green, 'green');
    }
    if (curves.blue && curves.blue.length > 0) {
      result = this.applyCurve(result, curves.blue, 'blue');
    }

    return result;
  }

  /**
   * Create S-curve (contrast enhancement)
   */
  static createSCurve(intensity: number = 50): CurvePoint[] {
    const points: CurvePoint[] = [];
    const strength = intensity / 100;

    for (let x = 0; x <= 255; x += 5) {
      const normalized = x / 255;
      // S-curve formula
      const adjusted = normalized + strength * (normalized - normalized * normalized) * (normalized - 0.5) * 4;
      const y = Math.max(0, Math.min(255, adjusted * 255));
      points.push({ x, y });
    }

    return points;
  }

  /**
   * Create inverted curve
   */
  static createInvertedCurve(): CurvePoint[] {
    return [
      { x: 0, y: 255 },
      { x: 255, y: 0 },
    ];
  }

  /**
   * Create high contrast curve
   */
  static createHighContrastCurve(): CurvePoint[] {
    return [
      { x: 0, y: 0 },
      { x: 64, y: 32 },
      { x: 128, y: 128 },
      { x: 192, y: 224 },
      { x: 255, y: 255 },
    ];
  }

  /**
   * Create low contrast curve
   */
  static createLowContrastCurve(): CurvePoint[] {
    return [
      { x: 0, y: 32 },
      { x: 64, y: 80 },
      { x: 128, y: 128 },
      { x: 192, y: 176 },
      { x: 255, y: 223 },
    ];
  }

  /**
   * Create lift curve (brighten shadows)
   */
  static createLiftCurve(amount: number = 20): CurvePoint[] {
    const lift = (amount / 100) * 50;
    return [
      { x: 0, y: lift },
      { x: 128, y: 128 + lift * 0.5 },
      { x: 255, y: 255 },
    ];
  }

  /**
   * Create gamma curve
   */
  static createGammaCurve(gamma: number = 1.0): CurvePoint[] {
    const points: CurvePoint[] = [];
    for (let x = 0; x <= 255; x += 5) {
      const normalized = x / 255;
      const adjusted = Math.pow(normalized, 1 / gamma);
      const y = Math.max(0, Math.min(255, adjusted * 255));
      points.push({ x, y });
    }
    return points;
  }

  /**
   * Get curve presets
   */
  static getCurvePresets(): Array<{ name: string; curve: CurvePoint[] }> {
    return [
      { name: 'Linear', curve: DEFAULT_CURVE },
      { name: 'S-Curve (Medium)', curve: this.createSCurve(50) },
      { name: 'S-Curve (Strong)', curve: this.createSCurve(75) },
      { name: 'High Contrast', curve: this.createHighContrastCurve() },
      { name: 'Low Contrast', curve: this.createLowContrastCurve() },
      { name: 'Lift Shadows', curve: this.createLiftCurve(30) },
      { name: 'Inverted', curve: this.createInvertedCurve() },
    ];
  }

  /**
   * Validate curve points
   */
  static validateCurve(points: CurvePoint[]): boolean {
    if (points.length < 2) return false;

    // Check x values are in range and sorted
    for (let i = 0; i < points.length; i++) {
      if (points[i].x < 0 || points[i].x > 255) return false;
      if (points[i].y < 0 || points[i].y > 255) return false;
      if (i > 0 && points[i].x <= points[i - 1].x) return false;
    }

    return true;
  }

  /**
   * Normalize curve (ensure it starts at 0,0 and ends at 255,255)
   */
  static normalizeCurve(points: CurvePoint[]): CurvePoint[] {
    const normalized = [...points];

    // Ensure first point is at x=0
    if (normalized[0].x !== 0) {
      normalized.unshift({ x: 0, y: normalized[0].y });
    }

    // Ensure last point is at x=255
    if (normalized[normalized.length - 1].x !== 255) {
      normalized.push({ x: 255, y: normalized[normalized.length - 1].y });
    }

    return normalized;
  }

  /**
   * Smooth curve using moving average (research-backed: removes jitter from manual adjustments)
   */
  static smoothCurve(points: CurvePoint[], windowSize: number = 3): CurvePoint[] {
    if (points.length <= 2) return points;

    const smoothed: CurvePoint[] = [];
    const sorted = [...points].sort((a, b) => a.x - b.x);

    for (let i = 0; i < sorted.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(sorted.length, i + Math.ceil(windowSize / 2));
      const window = sorted.slice(start, end);

      const avgY = window.reduce((sum, p) => sum + p.y, 0) / window.length;
      smoothed.push({ x: sorted[i].x, y: Math.round(avgY) });
    }

    return smoothed;
  }

  /**
   * Compare two curves and return difference metrics
   */
  static compareCurves(curve1: CurvePoint[], curve2: CurvePoint[]): {
    meanDifference: number;
    maxDifference: number;
    differencePoints: Array<{ x: number; diff: number }>;
  } {
    const differences: Array<{ x: number; diff: number }> = [];
    let totalDiff = 0;

    for (let x = 0; x <= 255; x += 5) {
      const y1 = this.bezierInterpolation(curve1, x);
      const y2 = this.bezierInterpolation(curve2, x);
      const diff = Math.abs(y1 - y2);
      differences.push({ x, diff });
      totalDiff += diff;
    }

    return {
      meanDifference: totalDiff / differences.length,
      maxDifference: Math.max(...differences.map(d => d.diff)),
      differencePoints: differences,
    };
  }

  /**
   * Convert RGB to LAB color space (perceptual color space)
   */
  static rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
    // Normalize RGB to 0-1
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    // Convert to XYZ
    const x = (rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375) / 0.95047;
    const y = (rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750) / 1.00000;
    const z = (rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041) / 1.08883;

    // Convert to LAB
    const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
    const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
    const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

    const l = 116 * fy - 16;
    const aValue = 500 * (fx - fy);
    const bValue = 200 * (fy - fz);

    return { l, a: aValue, b: bValue };
  }

  /**
   * Convert LAB to RGB color space
   */
  static labToRgb(l: number, a: number, b: number): { r: number; g: number; blue: number } {
    // Convert LAB to XYZ
    const fy = (l + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;

    const x = (fx > 0.206897 ? Math.pow(fx, 3) : (fx - 16/116) / 7.787) * 0.95047;
    const y = (fy > 0.206897 ? Math.pow(fy, 3) : (fy - 16/116) / 7.787) * 1.00000;
    const z = (fz > 0.206897 ? Math.pow(fz, 3) : (fz - 16/116) / 7.787) * 1.08883;

    // Convert XYZ to RGB
    const r = Math.max(0, Math.min(255, (x * 3.2404542 - y * 1.5371385 - z * 0.4985314) * 255));
    const g = Math.max(0, Math.min(255, (-x * 0.9692660 + y * 1.8760108 + z * 0.0415560) * 255));
    const blue = Math.max(0, Math.min(255, (x * 0.0556434 - y * 0.2040259 + z * 1.0572252) * 255));

    return { r, g, blue };
  }

  /**
   * Apply curve in LAB color space (perceptual color space - research-backed)
   */
  static applyCurveLAB(
    imageData: ImageData,
    curve: CurvePoint[],
    channel: 'l' | 'a' | 'b' = 'l'
  ): ImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to LAB
      const lab = this.rgbToLab(r, g, b);

      // Apply curve to selected channel
      if (channel === 'l') {
        lab.l = this.bezierInterpolation(curve, lab.l * 255 / 100) * 100 / 255;
      } else if (channel === 'a') {
        lab.a = this.bezierInterpolation(curve, (lab.a + 128) * 255 / 256) * 256 / 255 - 128;
      } else {
        lab.b = this.bezierInterpolation(curve, (lab.b + 128) * 255 / 256) * 256 / 255 - 128;
      }

      // Convert back to RGB
      const rgb = this.labToRgb(lab.l, lab.a, lab.b);
      data[i] = Math.round(rgb.r);
      data[i + 1] = Math.round(rgb.g);
      data[i + 2] = Math.round(rgb.blue);
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Export curve to JSON format
   */
  static exportCurve(points: CurvePoint[]): string {
    return JSON.stringify(points, null, 2);
  }

  /**
   * Import curve from JSON format
   */
  static importCurve(json: string): CurvePoint[] {
    try {
      const points = JSON.parse(json);
      if (Array.isArray(points) && points.every(p => p.x !== undefined && p.y !== undefined)) {
        return points;
      }
      throw new Error('Invalid curve format');
    } catch (error) {
      throw new Error('Failed to import curve: ' + (error instanceof Error ? error.message :'Unknown error'));
    }
  }
}

