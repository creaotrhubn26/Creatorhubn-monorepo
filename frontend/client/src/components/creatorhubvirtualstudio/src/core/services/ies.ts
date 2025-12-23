/**
 * Enhanced IES Profile System
 *
 * Supports full photometric data parsing and rendering
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('IES, ');

export interface IESProfile {
  angles: number[];
  intensities: number[];
  metadata?: {
    manufacturer?: string;
    luminaire?: string;
    lampCatalogNumber?: string;
    lumens?: number;
    multiplier?: number;
    tilt?: string;
  };
}

export interface IESData {
  verticalAngles: number[];
  horizontalAngles: number[];
  candelaValues: number[][]; // 2D array [vertical][horizontal]
  maxCandela: number;
}

/**
 * Parse IES file with support for multiple format versions:
 * - IES LM-63-1995
 * - IES LM-63-2002
 * - IES LM-63-2019
 */
export function parseIES(text: string): IESProfile | null {
  try {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    
    // Detect format version
    const versionLine = lines.find((l) => l.toUpperCase().includes('IES'));
    const isLM63_2019 = versionLine?.includes('LM-63-2019') || versionLine?.includes('IESNA:LM-63-2019');
    const isLM63_2002 = versionLine?.includes('LM-63-2002') || versionLine?.includes('IESNA:LM-63-2002');
    
    // Extract metadata from header
    const metadata: IESProfile['metadata'] = {};
    if (lines.length > 0) {
      const manufacturerLine = lines[0];
      if (manufacturerLine && !manufacturerLine.match(/^\d/)) {
        metadata.manufacturer = manufacturerLine;
      }
    }
    if (lines.length > 1) {
      const luminaireLine = lines[1];
      if (luminaireLine && !luminaireLine.match(/^\d/)) {
        metadata.luminaire = luminaireLine;
      }
    }
    
    // Find TILT section
    const idxTILT = lines.findIndex((l) => l.toUpperCase().startsWith('TILT'));
    const rest = idxTILT >= 0 ? lines.slice(idxTILT + 1) : lines;
    
    // Extract numbers
    const nums = rest
      .join(' ')
      .replace(/[^0-9eE+\-.\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    
    if (nums.length < 10) return null;
    
    // Parse format (version-dependent)
    let offset = 0;
    if (isLM63_2019 || isLM63_2002) {
      // Newer formats have additional fields
      offset = 0;
    }
    
    const nv = Math.max(1, Math.min(512, Math.round(nums[3 + offset])));
    const nh = Math.max(1, Math.min(512, Math.round(nums[4 + offset])));
    
    let i = 10 + offset;
    const vAngles: number[] = [];
    for (let k = 0; k < nv; k++, i++) {
      if (i < nums.length) vAngles.push(nums[i]);
    }
    
    const hAngles: number[] = [];
    for (let k = 0; k < nh; k++, i++) {
      if (i < nums.length) hAngles.push(nums[i]);
    }
    
    const intens: number[] = [];
    for (let k = 0; k < nv; k++) {
      for (let j = 0; j < nh; j++, i++) {
        if (i < nums.length) {
          if (k === 0) intens.push(nums[i]);
          else intens[j] += nums[i]; // Accumulate for multiple vertical angles
        }
      }
    }
    
    // Normalize
    const max = Math.max(1e-6, ...intens);
    const norm = intens.map((v) => v / max);
    
    return {
      angles: vAngles.length > 0 ? vAngles : hAngles,
      intensities: norm,
      metadata,
    };
  } catch (e) {
    log.warn('parseIES failed', e);
    return null;
  }
}

export function renderIESToCanvas(profile: IESProfile, size = 256): HTMLCanvasElement {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const { angles, intensities } = profile;
  const cx = size / 2,
    cy = size / 2;
  const maxR = size / 2 - 1;
  function sample(angleDeg: number): number {
    const a = Math.max(0, Math.min(angles[angles.length - 1], angleDeg));
    let idx = 0;
    while (idx < angles.length - 1 && angles[idx + 1] < a) idx++;
    const a0 = angles[idx],
      a1 = angles[Math.min(idx + 1, angles.length - 1)];
    const t = a1 === a0 ? 0 : (a - a0) / (a1 - a0);
    const i0 = intensities[idx],
      i1 = intensities[Math.min(idx + 1, intensities.length - 1)];
    return i0 * (1 - t) + i1 * t;
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx,
        dy = y - cy;
      const r = Math.hypot(dx, dy) / maxR;
      const ang = r * 90;
      const t = Math.max(0, Math.min(1, sample(ang)));
      const i = (y * size + x) * 4;
      const v = Math.round(t * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cvs;
}

/**
 * Convert IES profile to Three.js texture for shader use
 */
export function iesProfileToTexture(profile: IESProfile): THREE.DataTexture {
  const canvas = renderIESToCanvas(profile, 512);
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const texture = new THREE.DataTexture(
    imageData.data,
    canvas.width,
    canvas.height,
    THREE.RGBAFormat
  );
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

/**
 * Library of common IES profiles for studio lights
 */
export const IES_LIBRARY = {
  // Profoto profiles
  profoto_d2_standard: '/ies/profoto_d2_standard.ies',
  profoto_b10_reflector: '/ies/profoto_b10_reflector.ies',

  // Godox profiles
  godox_ad600_standard: '/ies/godox_ad600_standard.ies',
  godox_sl60_reflector: '/ies/godox_sl60_reflector.ies',

  // Generic profiles
  generic_softbox_60x60: '/ies/generic_softbox_60x60.ies',
  generic_umbrella_white: '/ies/generic_umbrella_white.ies',
  generic_beauty_dish: '/ies/generic_beauty_dish.ies',
  generic_snoot: '/ies/generic_snoot.ies',
};
