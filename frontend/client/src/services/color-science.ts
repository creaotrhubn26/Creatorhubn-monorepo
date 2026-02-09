/**
 * COLOR SCIENCE SERVICE
 * Professional color space conversions using Color.js
 * Supports Lab, OKLab, Display P3, Rec.2100, and more
 */

import Color from 'colorjs.io';

export interface ColorSpaceConversionOptions {
  gamutMapping?: 'clip' | 'css' | { method: 'raytrace' | 'minde'; space?: string };
  precision?: number;
}

export interface SkinToneRange {
  minL: number;
  maxL: number;
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
}

export class ColorScience {
  /**
   * Convert color between color spaces with proper gamut mapping
   */
  static convertColor(
    r: number,
    g: number,
    b: number,
    fromSpace: string = 'srgb',
    toSpace: string = 'lab',
    options?: ColorSpaceConversionOptions,
  ): number[] {
    try {
      const color = new Color(fromSpace, [r, g, b]);

      // Apply gamut mapping if needed
      if (options?.gamutMapping) {
        if (options.gamutMapping === 'css') {
          color.toGamut({ method: 'css', space: toSpace });
        } else if (typeof options.gamutMapping === 'object') {
          color.toGamut({
            method: options.gamutMapping.method,
            space: options.gamutMapping.space || toSpace,
          });
        }
      }

      const result = color.to(toSpace);
      return result.coords;
    } catch (error) {
      console.error('Color conversion error: ', error);
      return [r, g, b]; // Fallback to original
    }
  }

  /**
   * Calculate perceptual color difference (DeltaE 2000)
   * Returns a number where 0 = identical, higher = more different
   * Industry standard: <1 imperceptible, 1-2 perceptible, >2 noticeable
   */
  static deltaE2000(
    color1: [number, number, number],
    color2: [number, number, number],
    colorSpace: string = 'srgb',
  ): number {
    try {
      const c1 = new Color(colorSpace, color1);
      const c2 = new Color(colorSpace, color2);
      return c1.deltaE2000(c2);
    } catch (error) {
      console.error('DeltaE calculation error:', error);
      return 0;
    }
  }

  /**
   * Calculate DeltaE using Jz (more accurate for HDR)
   */
  static deltaEJz(
    color1: [number, number, number],
    color2: [number, number, number],
    colorSpace: string = 'srgb',
  ): number {
    try {
      const c1 = new Color(colorSpace, color1);
      const c2 = new Color(colorSpace, color2);
      return c1.deltaEJz(c2);
    } catch (error) {
      console.error('DeltaEJz calculation error:', error);
      return 0;
    }
  }

  /**
   * Check if color is in skin tone range (using LAB)
   * Based on professional skin tone charts
   */
  static isSkinTone(r: number, g: number, b: number): boolean {
    try {
      const lab = new Color('srgb', [r, g, b]).to('lab');
      const [L, a, bVal] = lab.coords;

      // Typical skin tone range in LAB
      // L*: 50-85 (lightness)
      // a*: 5-25 (red-green, skin is reddish)
      // b*: 10-35 (blue-yellow, skin is yellowish)

      return L >= 50 && L <= 85 && a >= 5 && a <= 25 && bVal >= 10 && bVal <= 35;
    } catch (error) {
      console.error('Skin tone detection error:', error);
      return false;
    }
  }

  /**
   * Get detailed skin tone information
   */
  static analyzeSkinTone(
    r: number,
    g: number,
    b: number,
  ): {
    isSkinTone: boolean;
    lightness: number;
    warmth: number; // Higher = warmer
    classification: 'very-light' | 'light' | 'medium' | 'dark' | 'very-dark' | 'not-skin';
  } {
    try {
      const lab = new Color('srgb', [r, g, b]).to('lab');
      const [L, a, bVal] = lab.coords;

      const isSkin = this.isSkinTone(r, g, b);

      let classification: 'very-light' | 'light' | 'medium' | 'dark' | 'very-dark' | 'not-skin' =
        'not-skin';

      if (isSkin) {
        if (L > 75) classification = 'very-light';
        else if (L > 65) classification = 'light';
        else if (L > 55) classification = 'medium';
        else if (L > 50) classification = 'dark';
        else classification = 'very-dark';
      }

      return {
        isSkinTone: isSkin,
        lightness: L,
        warmth: bVal / a, // Yellow/red ratio
        classification,
      };
    } catch (error) {
      console.error('Skin tone analysis error:', error);
      return {
        isSkinTone: false,
        lightness: 0,
        warmth: 0,
        classification: 'not-skin',
      };
    }
  }

  /**
   * Convert to OKLab (perceptually uniform, better than LAB)
   */
  static toOKLab(r: number, g: number, b: number): [number, number, number] {
    return this.convertColor(r, g, b, 'srgb', 'oklab') as [number, number, number];
  }

  /**
   * Convert to OKLCh (OKLab in cylindrical coordinates)
   * Great for hue rotations and saturation adjustments
   */
  static toOKLCh(r: number, g: number, b: number): [number, number, number] {
    return this.convertColor(r, g, b, 'srgb','oklch') as [number, number, number];
  }

  /**
   * Convert from OKLCh back to sRGB with gamut mapping
   */
  static fromOKLCh(l: number, c: number, h: number): [number, number, number] {
    try {
      const color = new Color('oklch', [l, c, h]);

      // Gamut map to sRGB using perceptual raytrace method
      color.toGamut({ method: 'css', space: 'srgb' });

      const result = color.to('srgb');
      return result.coords as [number, number, number];
    } catch (error) {
      console.error('OKLCh to sRGB conversion error:', error);
      return [0, 0, 0];
    }
  }

  /**
   * Adjust color in perceptual space (OKLCh)
   * This is better than HSL because it's perceptually uniform
   */
  static adjustColor(
    r: number,
    g: number,
    b: number,
    adjustments: {
      lightness?: number; // -1 to 1
      chroma?: number; // -1 to 1 (saturation)
      hue?: number; // -360 to 360 degrees
    },
  ): [number, number, number] {
    try {
      const color = new Color('srgb', [r, g, b]);
      const oklch = color.to('oklch');
      let [l, c, h] = oklch.coords;

      // Apply adjustments
      if (adjustments.lightness !== undefined) {
        l = Math.max(0, Math.min(1, l + adjustments.lightness));
      }

      if (adjustments.chroma !== undefined) {
        c = Math.max(0, c + adjustments.chroma * 0.4); // Scale for reasonable range
      }

      if (adjustments.hue !== undefined) {
        h = (h + adjustments.hue) % 360;
      }

      return this.fromOKLCh(l, c, h);
    } catch (error) {
      console.error('Color adjustment error:', error);
      return [r, g, b];
    }
  }

  /**
   * Check if color is in gamut for target space
   */
  static isInGamut(r: number, g: number, b: number, targetSpace: string = 'srgb'): boolean {
    try {
      const color = new Color('srgb', [r, g, b]);
      return color.inGamut(targetSpace);
    } catch (error) {
      return true; // Assume in gamut if error
    }
  }

  /**
   * Get color in CSS Color 4 format
   */
  static toCSSColor(
    r: number,
    g: number,
    b: number,
    format: 'rgb' | 'oklch' | 'lab' | 'p3' = 'rgb',
  ): string {
    try {
      const color = new Color('srgb', [r, g, b]);

      switch (format) {
        case 'oklch':
          return color.to('oklch').toString({ precision: 4 });
        case 'lab':
          return color.to('lab').toString({ precision: 4 });
        case 'p3':
          return color.to('p3').toString({ precision: 4 });
        default:
          return color.toString({ precision: 4 });
      }
    } catch (error) {
      return `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
    }
  }

  /**
   * Interpolate between two colors in perceptual space
   */
  static interpolate(
    color1: [number, number, number],
    color2: [number, number, number],
    t: number, // 0 to 1,

    space: string = 'oklch',
  ): [number, number, number] {
    try {
      const c1 = new Color('srgb', color1);
      const c2 = new Color('srgb', color2);

      const interpolated = c1.range(c2, { space })(t);
      const result = interpolated.to('srgb');

      return result.coords as [number, number, number];
    } catch (error) {
      console.error('Color interpolation error:', error);
      // Linear fallback
      return [
        color1[0] + (color2[0] - color1[0]) * t,
        color1[1] + (color2[1] - color1[1]) * t,
        color1[2] + (color2[2] - color1[2]) * t,
      ];
    }
  }

  /**
   * Get complementary color (opposite on color wheel)
   */
  static getComplementary(r: number, g: number, b: number): [number, number, number] {
    return this.adjustColor(r, g, b, { hue: 180 });
  }

  /**
   * Get analogous colors (adjacent on color wheel)
   */
  static getAnalogous(
    r: number,
    g: number,
    b: number,
  ): {
    left: [number, number, number];
    right: [number, number, number];
  } {
    return {
      left: this.adjustColor(r, g, b, { hue: -30 }),
      right: this.adjustColor(r, g, b, { hue: 30 }),
    };
  }

  /**
   * Get triadic colors (120° apart)
   */
  static getTriadic(
    r: number,
    g: number,
    b: number,
  ): {
    color1: [number, number, number];
    color2: [number, number, number];
  } {
    return {
      color1: this.adjustColor(r, g, b, { hue: 120 }),
      color2: this.adjustColor(r, g, b, { hue: 240 }),
    };
  }

  /**
   * Convert Display P3 to sRGB with gamut mapping
   */
  static p3ToSRGB(r: number, g: number, b: number): [number, number, number] {
    return this.convertColor(r, g, b, 'p3', 'srgb', {
      gamutMapping: { method: 'css' },
    }) as [number, number, number];
  }

  /**
   * Convert Rec.2020 to sRGB with gamut mapping
   */
  static rec2020ToSRGB(r: number, g: number, b: number): [number, number, number] {
    return this.convertColor(r, g, b, 'rec2020', 'srgb', {
      gamutMapping: { method: 'css' },
    }) as [number, number, number];
  }

  /**
   * Get color luminance (relative luminance for contrast calculations)
   */
  static getLuminance(r: number, g: number, b: number): number {
    try {
      const color = new Color('srgb', [r, g, b]);
      return color.luminance;
    } catch (error) {
      // Fallback calculation
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
  }

  /**
   * Calculate contrast ratio (WCAG)
   */
  static contrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
    try {
      const c1 = new Color('srgb', color1);
      const c2 = new Color('srgb', color2);
      return c1.contrast(c2, 'WCAG21');
    } catch (error) {
      return 1;
    }
  }
}

// Export singleton instance
export const colorScience = ColorScience;
