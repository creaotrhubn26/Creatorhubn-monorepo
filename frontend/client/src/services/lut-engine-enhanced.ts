// @ts-nocheck
/**
 * ENHANCED LUT ENGINE
 * Extends base LUT engine with Color.js for professional color science
 * Supports multiple color spaces, gamut mapping, and skin tone preservation
 */

import type { LUT3D } from './lut-engine';
import { LUTEngine } from './lut-engine';
import { ColorScience } from './color-science';
import Color from 'colorjs.io';

export interface EnhancedLUTOptions {
  colorSpace?: 'srgb' | 'oklch' | 'lab' | 'oklab' | 'p3' | 'rec2020';
  preserveSkinTones?: boolean;
  gamutMapping?: 'clip' | 'css' | { method: 'raytrace' | 'minde'; space?: string };
  skinToneProtection?: number; // 0-1, how much to protect skin tones
}

export class EnhancedLUTEngine extends LUTEngine {
  /**
   * Generate LUT with Color.js transformations
   */
  static generateEnhancedLUT(
    title: string,
    size: number,
    transformFn: (r: number, g: number, b: number) => [number, number, number],
    options: EnhancedLUTOptions = {},
  ): string {
    const {
      colorSpace = 'oklch',
      preserveSkinTones = false,
      gamutMapping = 'css',
      skinToneProtection = 0.8,
    } = options;

    let cube = `TITLE "${title}"\nLUT_3D_SIZE ${size}\n\n`;

    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);

          let [rOut, gOut, bOut] = transformFn(rVal, gVal, bVal);

          // Skin tone preservation
          if (preserveSkinTones) {
            const skinAnalysis = ColorScience.analyzeSkinTone(rVal, gVal, bVal);

            if (skinAnalysis.isSkinTone) {
              // Blend original and transformed based on protection level
              rOut = rVal + (rOut - rVal) * (1 - skinToneProtection);
              gOut = gVal + (gOut - gVal) * (1 - skinToneProtection);
              bOut = bVal + (bOut - bVal) * (1 - skinToneProtection);
            }
          }

          // Gamut mapping
          if (gamutMapping) {
            try {
              const color = new Color('srgb', [rOut, gOut, bOut]);

              if (gamutMapping === 'css') {
                color.toGamut({ method: 'css', space: 'srgb' });
              } else if (gamutMapping === 'clip') {
                color.toGamut({ method: 'clip', space: 'srgb' });
              } else if (typeof gamutMapping === 'object') {
                color.toGamut({
                  method: gamutMapping.method,
                  space: gamutMapping.space || 'srgb',
                });
              }

              const result = color.to('srgb');
              [rOut, gOut, bOut] = result.coords;
            } catch (error) {
              // Fallback to clipping
              rOut = Math.max(0, Math.min(1, rOut));
              gOut = Math.max(0, Math.min(1, gOut));
              bOut = Math.max(0, Math.min(1, bOut));
            }
          }

          cube += `${rOut.toFixed(6)} ${gOut.toFixed(6)} ${bOut.toFixed(6)}\n`;
        }
      }
    }

    return cube;
  }

  /**
   * Apply LUT with gamut mapping and color space awareness
   */
  static applyLUTEnhanced(
    imageData: ImageData,
    lut: LUT3D,
    options: {
      targetSpace?: string;
      gamutMapping?: boolean;
      preserveSkinTones?: boolean;
    } = {},
  ): ImageData {
    const { targetSpace = 'srgb', gamutMapping = true, preserveSkinTones = false } = options;

    const result = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );

    const pixels = result.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] / 255;
      const g = pixels[i + 1] / 255;
      const b = pixels[i + 2] / 255;

      // Check skin tone protection
      let protection = 0;
      if (preserveSkinTones) {
        const skinAnalysis = ColorScience.analyzeSkinTone(r, g, b);
        if (skinAnalysis.isSkinTone) {
          protection = 0.7; // Protect 70% of original color
        }
      }

      // Apply LUT (trilinear interpolation)
      const transformed = this.lookup3D(r, g, b, lut);

      // Blend if skin tone protection is active
      let [rOut, gOut, bOut] = transformed;
      if (protection > 0) {
        rOut = r + (rOut - r) * (1 - protection);
        gOut = g + (gOut - g) * (1 - protection);
        bOut = b + (bOut - b) * (1 - protection);
      }

      // Gamut mapping if needed
      if (gamutMapping && targetSpace !== 'srgb') {
        try {
          const color = new Color('srgb', [rOut, gOut, bOut]);
          color.toGamut({ method: 'css', space: targetSpace });
          const result = color.to('srgb');
          [rOut, gOut, bOut] = result.coords;
        } catch (error) {
          // Fallback to clipping
          rOut = Math.max(0, Math.min(1, rOut));
          gOut = Math.max(0, Math.min(1, gOut));
          bOut = Math.max(0, Math.min(1, bOut));
        }
      }

      pixels[i] = Math.round(rOut * 255);
      pixels[i + 1] = Math.round(gOut * 255);
      pixels[i + 2] = Math.round(bOut * 255);
      // Alpha channel unchanged
    }

    return result;
  }

  /**
   * 3D lookup helper (same as parent but exposed)
   */
  private static lookup3D(r: number, g: number, b: number, lut: LUT3D): number[] {
    const size = lut.size;
    const maxIndex = size - 1;

    const rIndex = r * maxIndex;
    const gIndex = g * maxIndex;
    const bIndex = b * maxIndex;

    const r0 = Math.floor(rIndex);
    const r1 = Math.min(r0 + 1, maxIndex);
    const g0 = Math.floor(gIndex);
    const g1 = Math.min(g0 + 1, maxIndex);
    const b0 = Math.floor(bIndex);
    const b1 = Math.min(b0 + 1, maxIndex);

    const rFrac = rIndex - r0;
    const gFrac = gIndex - g0;
    const bFrac = bIndex - b0;

    const c000 = lut.data[r0][g0][b0];
    const c001 = lut.data[r0][g0][b1];
    const c010 = lut.data[r0][g1][b0];
    const c011 = lut.data[r0][g1][b1];
    const c100 = lut.data[r1][g0][b0];
    const c101 = lut.data[r1][g0][b1];
    const c110 = lut.data[r1][g1][b0];
    const c111 = lut.data[r1][g1][b1];

    const result = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const c00 = c000[i] * (1 - rFrac) + c100[i] * rFrac;
      const c01 = c001[i] * (1 - rFrac) + c101[i] * rFrac;
      const c10 = c010[i] * (1 - rFrac) + c110[i] * rFrac;
      const c11 = c011[i] * (1 - rFrac) + c111[i] * rFrac;

      const c0 = c00 * (1 - gFrac) + c10 * gFrac;
      const c1 = c01 * (1 - gFrac) + c11 * gFrac;

      result[i] = c0 * (1 - bFrac) + c1 * bFrac;
    }

    return result;
  }

  /**
   * Generate LUT in OKLCh color space (perceptually uniform)
   */
  static generateOKLChLUT(
    title: string,
    size: number,
    adjustments: {
      lightness?: number; // -1 to 1
      chroma?: number; // -1 to 1
      hue?: number; // -360 to 360
    },
  ): string {
    return this.generateEnhancedLUT(
      title,
      size,
      (r, g, b) => {
        return ColorScience.adjustColor(r, g, b, adjustments);
      },
      {
        colorSpace: 'oklch',
        gamutMapping: 'css',
      },
    );
  }

  /**
   * Generate cinematic LUT with teal shadows and orange highlights
   * Uses OKLCh for better color separation
   */
  static generateCinematicTealOrangeLUT(size: number = 17): string {
    return this.generateEnhancedLUT(
      'Cinematic Teal & Orange (OKLCh)',
      size,
      (r, g, b) => {
        const oklch = ColorScience.toOKLCh(r, g, b);
        let [l, c, h] = oklch;

        if (l < 0.5) {
          // Shadows: push toward teal (cyan)
          h = h * 0.7 + 180 * 0.3; // Blend toward 180° (cyan)
          c = c * 1.2; // Increase saturation
        } else {
          // Highlights: push toward orange
          h = h * 0.7 + 30 * 0.3; // Blend toward 30° (orange)
          c = c * 1.1;
        }

        return ColorScience.fromOKLCh(l, c, h);
      },
      {
        colorSpace: 'oklch',
        preserveSkinTones: true,
        gamutMapping: 'css',
      },
    );
  }

  /**
   * Generate vintage film LUT with reduced saturation and warm tones
   */
  static generateVintageFilmLUT(size: number = 17): string {
    return this.generateEnhancedLUT(
      'Vintage Film (OKLCh)',
      size,
      (r, g, b) => {
        const oklch = ColorScience.toOKLCh(r, g, b);
        let [l, c, h] = oklch;

        // Reduce contrast (compress dynamic range)
        l = 0.5 + (l - 0.5) * 0.85;

        // Reduce saturation
        c = c * 0.7;

        // Add warmth
        h = h + 10;

        // Lift blacks (faded look)
        l = l * 0.95 + 0.05;

        return ColorScience.fromOKLCh(l, c, h);
      },
      {
        colorSpace: 'oklch',
        preserveSkinTones: true,
        gamutMapping: 'css',
      },
    );
  }

  /**
   * Generate cross-processing LUT (film effect)
   */
  static generateCrossProcessLUT(size: number = 17): string {
    return this.generateEnhancedLUT(
      'Cross Process (OKLCh)',
      size,
      (r, g, b) => {
        const oklch = ColorScience.toOKLCh(r, g, b);
        let [l, c, h] = oklch;

        // Increase contrast
        l = 0.5 + (l - 0.5) * 1.3;

        // Boost saturation
        c = c * 1.4;

        // Shift hues (green → yellow, blue → cyan)
        if (h > 90 && h < 150) {
          // Greens toward yellow
          h = h - 20;
        } else if (h > 210 && h < 270) {
          // Blues toward cyan
          h = h - 15;
        }

        return ColorScience.fromOKLCh(l, c, h);
      },
      {
        colorSpace: 'oklch',
        gamutMapping: 'css',
      },
    );
  }

  /**
   * Compare two LUTs by applying them to a test image and calculating average deltaE
   */
  static compareLUTs(
    imageData: ImageData,
    lut1: LUT3D,
    lut2: LUT3D,
  ): {
    avgDeltaE: number;
    maxDeltaE: number;
    differences: number;
  } {
    const result1 = this.applyLUTEnhanced(imageData, lut1);
    const result2 = this.applyLUTEnhanced(imageData, lut2);

    let totalDeltaE = 0;
    let maxDeltaE = 0;
    let differences = 0;

    for (let i = 0; i < result1.data.length; i += 4) {
      const color1: [number, number, number] = [
        result1.data[i] / 255,
        result1.data[i + 1] / 255,
        result1.data[i + 2] / 255,
      ];

      const color2: [number, number, number] = [
        result2.data[i] / 255,
        result2.data[i + 1] / 255,
        result2.data[i + 2] / 255,
      ];

      const deltaE = ColorScience.deltaE2000(color1, color2);
      totalDeltaE += deltaE;
      maxDeltaE = Math.max(maxDeltaE, deltaE);

      if (deltaE > 2) differences++; // Noticeable difference
    }

    return {
      avgDeltaE: totalDeltaE / (imageData.data.length / 4),
      maxDeltaE,
      differences,
    };
  }
}

// Export singleton
export const enhancedLUTEngine = EnhancedLUTEngine;
