// @ts-nocheck
/**
 * LUT LOADER SERVICE
 * Fetch, parse, and cache real .cube LUT files
 * Integrated with wasm-vips for fast preview generation
 */

import type { LUT3D } from './lut-engine';
import { LUTEngine } from './lut-engine';

interface LUTCacheEntry {
  lut: LUT3D;
  timestamp: number;
}

export class LUTLoader {
  private static cache = new Map<string, LUTCacheEntry>();
  private static maxCacheSize = 50; // Keep 50 parsed LUTs in memory
  private static maxCacheAge = 10 * 60 * 1000; // 10 minutes

  /**
   * Fetch and parse a .cube LUT file
   */
  static async loadLUT(path: string): Promise<LUT3D | null> {
    // Check cache first
    const cached = this.cache.get(path);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.maxCacheAge) {
        console.log(`✅ LUT cache hit: ${path}`);
        return cached.lut;
      }
    }

    try {
      console.log(`⏳ Loading LUT: ${path}`);
      const startTime = performance.now();

      // Fetch the .cube file
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`❌ LUT not found: ${path}`);
        return null;
      }

      const cubeContent = await response.text();

      // Parse the .cube file
      const lut = LUTEngine.parseCubeFile(cubeContent);

      const elapsed = performance.now() - startTime;
      console.log(`✅ Loaded LUT in ${elapsed.toFixed(1)}ms: ${lut.title} (${lut.size}³)`);

      // Cache it
      this.cache.set(path, {
        lut,
        timestamp: Date.now(),
      });

      // Prune old cache entries
      this.pruneCache();

      return lut;
    } catch (error) {
      console.error(`❌ Failed to load LUT ${path}:`, error);
      return null;
    }
  }

  /**
   * Apply LUT to ImageData (for preview generation)
   */
  static applyLUTToImageData(imageData: ImageData, lut: LUT3D): ImageData {
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

      // 3D trilinear interpolation lookup
      const transformed = this.lookup3D(r, g, b, lut);

      pixels[i] = Math.round(transformed[0] * 255);
      pixels[i + 1] = Math.round(transformed[1] * 255);
      pixels[i + 2] = Math.round(transformed[2] * 255);
      // Alpha channel unchanged
    }

    return result;
  }

  /**
   * 3D trilinear interpolation lookup
   * (Same as LUTEngine but extracted for ImageData processing)
   */
  private static lookup3D(r: number, g: number, b: number, lut: LUT3D): number[] {
    const size = lut.size;
    const maxIndex = size - 1;

    // Map 0-1 to LUT indices
    const rIndex = r * maxIndex;
    const gIndex = g * maxIndex;
    const bIndex = b * maxIndex;

    // Get surrounding cube indices
    const r0 = Math.floor(rIndex);
    const r1 = Math.min(r0 + 1, maxIndex);
    const g0 = Math.floor(gIndex);
    const g1 = Math.min(g0 + 1, maxIndex);
    const b0 = Math.floor(bIndex);
    const b1 = Math.min(b0 + 1, maxIndex);

    // Fractional parts for interpolation
    const rFrac = rIndex - r0;
    const gFrac = gIndex - g0;
    const bFrac = bIndex - b0;

    // Get 8 corner values of the cube
    const c000 = lut.data[r0][g0][b0];
    const c001 = lut.data[r0][g0][b1];
    const c010 = lut.data[r0][g1][b0];
    const c011 = lut.data[r0][g1][b1];
    const c100 = lut.data[r1][g0][b0];
    const c101 = lut.data[r1][g0][b1];
    const c110 = lut.data[r1][g1][b0];
    const c111 = lut.data[r1][g1][b1];

    // Trilinear interpolation
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
   * Batch load multiple LUTs
   */
  static async loadLUTsBatch(paths: string[]): Promise<Map<string, LUT3D>> {
    const results = new Map<string, LUT3D>();

    const promises = paths.map(async (path) => {
      const lut = await this.loadLUT(path);
      if (lut) {
        results.set(path, lut);
      }
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * Prune old cache entries (LRU)
   */
  private static pruneCache() {
    if (this.cache.size <= this.maxCacheSize) return;

    // Sort by timestamp (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    // Remove oldest entries
    const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
    toRemove.forEach(([path]) => {
      this.cache.delete(path);
      console.log(`🗑️ Pruned LUT from cache: ${path}`);
    });
  }

  /**
   * Clear cache
   */
  static clearCache() {
    this.cache.clear();
    console.log('🗑️ LUT cache cleared');
  }

  /**
   * Get cache stats
   */
  static getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Generate sample LUT files if they don't exist
   * (For demo purposes - creates identity and basic correction LUTs)
   */
  static generateSampleLUTs(): Map<string, string> {
    const samples = new Map<string, string>();

    // Identity LUT (no change)
    const identityLUT = this.generateIdentityLUT(17);
    samples.set('/luts/identity.cube', identityLUT);

    // Warm LUT
    const warmLUT = this.generateWarmLUT(17);
    samples.set('/luts/warm.cube', warmLUT);

    // Cool LUT
    const coolLUT = this.generateCoolLUT(17);
    samples.set('/luts/cool.cube', coolLUT);

    // Cinematic teal & orange
    const cinematicLUT = this.generateCinematicLUT(17);
    samples.set('/luts/cinematic.cube', cinematicLUT);

    return samples;
  }

  /**
   * Generate identity LUT (no transformation)
   */
  private static generateIdentityLUT(size: number): string {
    let cube = `TITLE "Identity LUT"\nLUT_3D_SIZE ${size}\n\n`;

    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);
          cube += `${rVal.toFixed(6)} ${gVal.toFixed(6)} ${bVal.toFixed(6)}\n`;
        }
      }
    }

    return cube;
  }

  /**
   * Generate warm tone LUT
   */
  private static generateWarmLUT(size: number): string {
    let cube = `TITLE "Warm Tones"\nLUT_3D_SIZE ${size}\n\n`;

    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);

          // Warm transformation
          const rOut = Math.min(1.0, rVal * 1.15);
          const gOut = Math.min(1.0, gVal * 1.05);
          const bOut = Math.min(1.0, bVal * 0.85);

          cube += `${rOut.toFixed(6)} ${gOut.toFixed(6)} ${bOut.toFixed(6)}\n`;
        }
      }
    }

    return cube;
  }

  /**
   * Generate cool tone LUT
   */
  private static generateCoolLUT(size: number): string {
    let cube = `TITLE "Cool Tones"\nLUT_3D_SIZE ${size}\n\n`;

    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);

          // Cool transformation
          const rOut = Math.min(1.0, rVal * 0.85);
          const gOut = Math.min(1.0, gVal * 1.05);
          const bOut = Math.min(1.0, bVal * 1.15);

          cube += `${rOut.toFixed(6)} ${gOut.toFixed(6)} ${bOut.toFixed(6)}\n`;
        }
      }
    }

    return cube;
  }

  /**
   * Generate cinematic teal & orange LUT
   */
  private static generateCinematicLUT(size: number): string {
    let cube = `TITLE"Cinematic Teal Orange"\nLUT_3D_SIZE ${size}\n\n`;

    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const rVal = r / (size - 1);
          const gVal = g / (size - 1);
          const bVal = b / (size - 1);

          // Teal & orange transformation
          // Push shadows toward teal, highlights toward orange
          const luminance = (rVal + gVal + bVal) / 3;

          let rOut = rVal;
          let gOut = gVal;
          let bOut = bVal;

          if (luminance < 0.5) {
            // Shadows: push toward teal
            rOut *= 0.9;
            gOut *= 1.1;
            bOut *= 1.15;
          } else {
            // Highlights: push toward orange
            rOut *= 1.15;
            gOut *= 1.05;
            bOut *= 0.85;
          }

          rOut = Math.min(1.0, Math.max(0.0, rOut));
          gOut = Math.min(1.0, Math.max(0.0, gOut));
          bOut = Math.min(1.0, Math.max(0.0, bOut));

          cube += `${rOut.toFixed(6)} ${gOut.toFixed(6)} ${bOut.toFixed(6)}\n`;
        }
      }
    }

    return cube;
  }
}

// Export singleton instance
export const lutLoader = LUTLoader;
