/**
 * 3D LUT (Look-Up Table) Service
 * 
 * Supports import/export of industry-standard .cube LUT files
 * for color grading and color management.
 * 
 * Reference:
 * - Adobe Cube LUT Specification
 * - Blackmagic Design DaVinci Resolve LUT format
 * - Autodesk Flame LUT format
 * 
 * LUT sizes supported: 17x17x17, 33x33x33, 65x65x65
 */

import * as THREE from 'three';

export interface LUT3D {
  size: number;           // LUT dimension (17, 33, or 65)
  data: Float32Array;     // RGB triplets (size^3 * 3 values)
  title?: string;         // LUT title/name
  domainMin: THREE.Vector3; // Input domain minimum (usually [0,0,0])
  domainMax: THREE.Vector3; // Input domain maximum (usually [1,1,1])
}

export interface LUTMetadata {
  title?: string;
  size: number;
  domainMin?: [number, number, number];
  domainMax?: [number, number, number];
}

class LUTService {
  /**
   * Parse .cube LUT file
   * 
   * Reference: Adobe Cube LUT Specification
   */
  parseCubeLUT(cubeFileContent: string): LUT3D {
    const lines = cubeFileContent.split('\n, ').map(line => line.trim());
    
    let title: string | undefined;
    let size = 33; // Default size
    let domainMin = new THREE.Vector3(0, 0, 0);
    let domainMax = new THREE.Vector3(1, 1, 1);
    const lutData: number[] = [];

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line || line.startsWith('#,')) continue;

      // Parse TITLE
      if (line.startsWith('TITLE,')) {
        title = line.substring(5).trim().replace(/"/g, '');
        continue;
      }

      // Parse LUT_3D_SIZE
      if (line.startsWith('LUT_3D_SIZE')) {
        size = parseInt(line.split(/\s+/)[1]);
        continue;
      }

      // Parse DOMAIN_MIN
      if (line.startsWith('DOMAIN_MIN')) {
        const values = line.split(/\s+/).slice(1).map(parseFloat);
        domainMin = new THREE.Vector3(values[0], values[1], values[2]);
        continue;
      }

      // Parse DOMAIN_MAX
      if (line.startsWith('DOMAIN_MAX')) {
        const values = line.split(/\s+/).slice(1).map(parseFloat);
        domainMax = new THREE.Vector3(values[0], values[1], values[2]);
        continue;
      }

      // Parse RGB triplet
      const values = line.split(/\s+/).map(parseFloat);
      if (values.length === 3 && values.every(v => !isNaN(v))) {
        lutData.push(values[0], values[1], values[2]);
      }
    }

    // Validate LUT data
    const expectedSize = size * size * size * 3;
    if (lutData.length !== expectedSize) {
      throw new Error(`Invalid LUT data: expected ${expectedSize} values, got ${lutData.length}`);
    }

    return {
      size,
      data: new Float32Array(lutData),
      title,
      domainMin,
      domainMax,
    };
  }

  /**
   * Export LUT to .cube format
   * 
   * Reference: Adobe Cube LUT Specification
   */
  exportToCube(lut: LUT3D): string {
    let cube = ', ';

    // Header
    if (lut.title) {
      cube += `TITLE "${lut.title}"\n`;
    }
    cube += `LUT_3D_SIZE ${lut.size}\n`;
    
    // Domain (optional, defaults to [0,0,0] to [1,1,1])
    if (lut.domainMin.x !== 0 || lut.domainMin.y !== 0 || lut.domainMin.z !== 0) {
      cube += `DOMAIN_MIN ${lut.domainMin.x} ${lut.domainMin.y} ${lut.domainMin.z}\n`;
    }
    if (lut.domainMax.x !== 1 || lut.domainMax.y !== 1 || lut.domainMax.z !== 1) {
      cube += `DOMAIN_MAX ${lut.domainMax.x} ${lut.domainMax.y} ${lut.domainMax.z}\n`;
    }

    cube += '\n';

    // LUT data (R G B triplets)
    // Order: Blue changes fastest, then Green, then Red
    for (let i = 0; i < lut.data.length; i += 3) {
      const r = lut.data[i].toFixed(6);
      const g = lut.data[i + 1].toFixed(6);
      const b = lut.data[i + 2].toFixed(6);
      cube += `${r} ${g} ${b}\n`;
    }

    return cube;
  }

  /**
   * Create identity LUT (no color transformation)
   */
  createIdentityLUT(size: number = 33): LUT3D {
    const data = new Float32Array(size * size * size * 3);
    let index = 0;

    // Generate identity LUT
    // Order: Blue changes fastest, then Green, then Red
    for (let r = 0; r < size; r++) {
      for (let g = 0; g < size; g++) {
        for (let b = 0; b < size; b++) {
          data[index++] = r / (size - 1);
          data[index++] = g / (size - 1);
          data[index++] = b / (size - 1);
        }
      }
    }

    return {
      size,
      data,
      title: 'Identity',
      domainMin: new THREE.Vector3(0, 0, 0),
      domainMax: new THREE.Vector3(1, 1, 1),
    };
  }

  /**
   * Apply LUT to a color
   * Uses trilinear interpolation for smooth results
   */
  applyLUT(color: THREE.Color, lut: LUT3D): THREE.Color {
    const r = color.r;
    const g = color.g;
    const b = color.b;

    // Normalize to LUT domain
    const size = lut.size;
    const scale = size - 1;

    // Calculate LUT coordinates
    const rIndex = r * scale;
    const gIndex = g * scale;
    const bIndex = b * scale;

    // Get integer and fractional parts
    const r0 = Math.floor(rIndex);
    const g0 = Math.floor(gIndex);
    const b0 = Math.floor(bIndex);

    const r1 = Math.min(r0 + 1, scale);
    const g1 = Math.min(g0 + 1, scale);
    const b1 = Math.min(b0 + 1, scale);

    const rFrac = rIndex - r0;
    const gFrac = gIndex - g0;
    const bFrac = bIndex - b0;

    // Trilinear interpolation
    // Sample 8 corners of the cube
    const getLUTValue = (ri: number, gi: number, bi: number): [number, number, number] => {
      const index = (ri * size * size + gi * size + bi) * 3;
      return [lut.data[index], lut.data[index + 1], lut.data[index + 2]];
    };

    const c000 = getLUTValue(r0, g0, b0);
    const c001 = getLUTValue(r0, g0, b1);
    const c010 = getLUTValue(r0, g1, b0);
    const c011 = getLUTValue(r0, g1, b1);
    const c100 = getLUTValue(r1, g0, b0);
    const c101 = getLUTValue(r1, g0, b1);
    const c110 = getLUTValue(r1, g1, b0);
    const c111 = getLUTValue(r1, g1, b1);

    // Interpolate along B axis
    const c00 = [
      c000[0] + bFrac * (c001[0] - c000[0]),
      c000[1] + bFrac * (c001[1] - c000[1]),
      c000[2] + bFrac * (c001[2] - c000[2]),
    ];
    const c01 = [
      c010[0] + bFrac * (c011[0] - c010[0]),
      c010[1] + bFrac * (c011[1] - c010[1]),
      c010[2] + bFrac * (c011[2] - c010[2]),
    ];
    const c10 = [
      c100[0] + bFrac * (c101[0] - c100[0]),
      c100[1] + bFrac * (c101[1] - c100[1]),
      c100[2] + bFrac * (c101[2] - c100[2]),
    ];
    const c11 = [
      c110[0] + bFrac * (c111[0] - c110[0]),
      c110[1] + bFrac * (c111[1] - c110[1]),
      c110[2] + bFrac * (c111[2] - c110[2]),
    ];

    // Interpolate along G axis
    const c0 = [
      c00[0] + gFrac * (c01[0] - c00[0]),
      c00[1] + gFrac * (c01[1] - c00[1]),
      c00[2] + gFrac * (c01[2] - c00[2]),
    ];
    const c1 = [
      c10[0] + gFrac * (c11[0] - c10[0]),
      c10[1] + gFrac * (c11[1] - c10[1]),
      c10[2] + gFrac * (c11[2] - c10[2]),
    ];

    // Interpolate along R axis
    const result = [
      c0[0] + rFrac * (c1[0] - c0[0]),
      c0[1] + rFrac * (c1[1] - c0[1]),
      c0[2] + rFrac * (c1[2] - c0[2]),
    ];

    return new THREE.Color(result[0], result[1], result[2]);
  }
}

export const lutService = new LUTService();

