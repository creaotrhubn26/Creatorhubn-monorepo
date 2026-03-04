/**
 * ViewfinderRenderer - Professional Camera Viewfinder Rendering Engine
 * 
 * Provides real-time camera POV rendering with:
 * - Exposure simulation (aperture, shutter, ISO)
 * - Lens effects (vignetting, distortion, chromatic aberration)
 * - Depth of field preview
 * - Focus peaking detection
 * - Zebra pattern for overexposure
 * - Frame guides rendering
 */

import type { LensSpec } from '../data/LensSpecifications';

// ============================================================================
// Types
// ============================================================================

export interface ViewfinderSettings {
  // Display
  showGuides: boolean;
  guideType: 'thirds' | 'golden' | 'crosshair' | 'safe_areas' | 'all';
  showZebras: boolean;
  zebraThreshold: number; // 0-100 (percentage of max brightness)
  showFocusPeaking: boolean;
  focusPeakingColor: string;
  focusPeakingThreshold: number; // Edge detection sensitivity
  showHistogram: boolean;
  histogramPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showInfo: boolean;
  
  // Simulation
  simulateExposure: boolean;
  simulateDOF: boolean;
  simulateLensEffects: boolean;
  
  // Aspect Ratio
  aspectRatio: '16:9' | '4:3' | '2.39:1' | '1:1' | '3:2' | 'custom';
  customAspectRatio?: [number, number];
}

export interface CameraState {
  aperture: number;
  shutter: number;
  iso: number;
  focalLength: number;
  focusDistance: number;
  sensor: [number, number];
  position: [number, number, number];
  rotation: [number, number, number];
  lensSpec?: LensSpec;
}

export interface ExposureInfo {
  ev: number;
  stops: number; // Stops over/under
  isOverexposed: boolean;
  isUnderexposed: boolean;
  suggestedAperture?: number;
  suggestedShutter?: number;
  suggestedISO?: number;
}

export interface FocusInfo {
  nearLimit: number;
  farLimit: number;
  hyperfocal: number;
  depthOfField: number;
  inFocus: boolean;
}

// ============================================================================
// Default Settings
// ============================================================================

export const DEFAULT_VIEWFINDER_SETTINGS: ViewfinderSettings = {
  showGuides: true,
  guideType: 'thirds',
  showZebras: false,
  zebraThreshold: 95,
  showFocusPeaking: false,
  focusPeakingColor: '#ff0000',
  focusPeakingThreshold: 30,
  showHistogram: true,
  histogramPosition: 'bottom-right',
  showInfo: true,
  simulateExposure: true,
  simulateDOF: false,
  simulateLensEffects: true,
  aspectRatio: '16:9',
};

// ============================================================================
// Exposure Calculation
// ============================================================================

export function calculateEV(aperture: number, shutter: number, iso: number): number {
  // EV = log2(N² / t) - log2(ISO / 100)
  const ev = Math.log2((aperture * aperture) / shutter) - Math.log2(iso / 100);
  return Math.round(ev * 10) / 10;
}

export function calculateExposureInfo(camera: CameraState, sceneLuminance: number = 500): ExposureInfo {
  const ev = calculateEV(camera.aperture, camera.shutter, camera.iso);
  
  // Middle gray = 18% reflectance = EV 0 at 100 ISO
  // Typical outdoor sunny = EV 15, indoor = EV 5-7
  const targetEV = Math.log2(sceneLuminance / 2.5); // Rough luminance to EV
  const stops = ev - targetEV;
  
  return {
    ev,
    stops: Math.round(stops * 10) / 10,
    isOverexposed: stops > 2,
    isUnderexposed: stops < -2,
    suggestedAperture: stops > 0 ? camera.aperture * Math.pow(2, stops / 2) : camera.aperture / Math.pow(2, -stops / 2),
    suggestedShutter: stops > 0 ? camera.shutter / Math.pow(2, stops) : camera.shutter * Math.pow(2, -stops),
    suggestedISO: stops > 0 ? camera.iso / Math.pow(2, stops) : camera.iso * Math.pow(2, -stops),
  };
}

// ============================================================================
// Depth of Field Calculation
// ============================================================================

export function calculateDOF(camera: CameraState): FocusInfo {
  const { aperture, focalLength, focusDistance, sensor } = camera;
  
  // Circle of confusion (based on sensor size)
  const sensorDiagonal = Math.sqrt(sensor[0] * sensor[0] + sensor[1] * sensor[1]);
  const coc = sensorDiagonal / 1500; // Standard formula
  
  // Hyperfocal distance
  const hyperfocal = (focalLength * focalLength) / (aperture * coc) + focalLength;
  const hyperfocalM = hyperfocal / 1000; // Convert to meters
  
  // Near and far limits
  const focusM = focusDistance;
  const nearLimit = (hyperfocalM * focusM) / (hyperfocalM + (focusM - focalLength / 1000));
  const farLimit = focusM >= hyperfocalM 
    ? Infinity 
    : (hyperfocalM * focusM) / (hyperfocalM - (focusM - focalLength / 1000));
  
  const depthOfField = farLimit === Infinity ? Infinity : farLimit - nearLimit;
  
  return {
    nearLimit: Math.max(0, nearLimit),
    farLimit,
    hyperfocal: hyperfocalM,
    depthOfField,
    inFocus: true, // Would need scene analysis to determine
  };
}

// ============================================================================
// Zebra Pattern Generation (WebGL Shader)
// ============================================================================

export const ZEBRA_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float threshold;
    uniform float time;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      
      if (luminance > threshold) {
        // Animated diagonal stripes
        float stripe = sin((vUv.x + vUv.y) * resolution.x * 0.1 + time * 5.0);
        if (stripe > 0.0) {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red stripes
        } else {
          gl_FragColor = color;
        }
      } else {
        gl_FragColor = color;
      }
    }
  `,
};

// ============================================================================
// Focus Peaking Shader
// ============================================================================

export const FOCUS_PEAKING_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float threshold;
    uniform vec3 peakColor;
    uniform vec2 resolution;
    
    varying vec2 vUv;
    
    float getLuminance(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }
    
    void main() {
      vec2 texel = 1.0 / resolution;
      
      // Sobel edge detection
      float tl = getLuminance(texture2D(tDiffuse, vUv + texel * vec2(-1, 1)).rgb);
      float t  = getLuminance(texture2D(tDiffuse, vUv + texel * vec2( 0, 1)).rgb);
      float tr = getLuminance(texture2D(tDiffuse, vUv + texel * vec2( 1, 1)).rgb);
      float l  = getLuminance(texture2D(tDiffuse, vUv + texel * vec2(-1, 0)).rgb);
      float r  = getLuminance(texture2D(tDiffuse, vUv + texel * vec2( 1, 0)).rgb);
      float bl = getLuminance(texture2D(tDiffuse, vUv + texel * vec2(-1,-1)).rgb);
      float b  = getLuminance(texture2D(tDiffuse, vUv + texel * vec2( 0,-1)).rgb);
      float br = getLuminance(texture2D(tDiffuse, vUv + texel * vec2( 1,-1)).rgb);
      
      float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
      float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
      float edge = sqrt(gx*gx + gy*gy);
      
      vec4 color = texture2D(tDiffuse, vUv);
      
      if (edge > threshold / 100.0) {
        gl_FragColor = vec4(mix(color.rgb, peakColor, 0.8), 1.0);
      } else {
        gl_FragColor = color;
      }
    }
  `,
};

// ============================================================================
// Vignette & Lens Effects Shader
// ============================================================================

export const LENS_EFFECTS_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    uniform float distortion;
    uniform float chromaticAberration;
    uniform float exposure;
    
    varying vec2 vUv;
    
    vec2 distort(vec2 uv, float k) {
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);
      float f = 1.0 + k * r2;
      return centered * f + 0.5;
    }
    
    void main() {
      vec2 uv = vUv;
      
      // Apply barrel/pincushion distortion
      if (abs(distortion) > 0.001) {
        uv = distort(uv, distortion * 0.5);
      }
      
      vec4 color;
      
      // Chromatic aberration
      if (chromaticAberration > 0.001) {
        float ca = chromaticAberration * 0.01;
        color.r = texture2D(tDiffuse, distort(uv, -ca)).r;
        color.g = texture2D(tDiffuse, uv).g;
        color.b = texture2D(tDiffuse, distort(uv, ca)).b;
        color.a = 1.0;
      } else {
        color = texture2D(tDiffuse, uv);
      }
      
      // Vignette
      if (vignette > 0.001) {
        vec2 centered = vUv - 0.5;
        float dist = length(centered) * 1.414; // Normalize to corner
        float vig = 1.0 - smoothstep(0.5, 1.0, dist) * vignette;
        color.rgb *= vig;
      }
      
      // Exposure adjustment
      color.rgb *= pow(2.0, exposure);
      
      gl_FragColor = color;
    }
  `,
};

// ============================================================================
// Frame Guides Generator
// ============================================================================

export interface FrameGuide {
  type: 'line' | 'rect';
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  color: string;
  opacity: number;
  label?: string;
}

export function generateFrameGuides(
  type: ViewfinderSettings[ 'guideType'],
  width: number,
  height: number
): FrameGuide[] {
  const guides: FrameGuide[] = [];
  const color = 'rgba(255,255,255,0.5)';
  
  if (type === 'thirds' || type === 'all') {
    // Rule of thirds
    const thirdW = width / 3;
    const thirdH = height / 3;
    guides.push(
      { type: 'line', x1: thirdW, y1: 0, x2: thirdW, y2: height, color, opacity: 0.5 },
      { type: 'line', x1: thirdW * 2, y1: 0, x2: thirdW * 2, y2: height, color, opacity: 0.5 },
      { type: 'line', x1: 0, y1: thirdH, x2: width, y2: thirdH, color, opacity: 0.5 },
      { type: 'line', x1: 0, y1: thirdH * 2, x2: width, y2: thirdH * 2, color, opacity: 0.5 },
    );
  }
  
  if (type === 'golden' || type === 'all') {
    // Golden ratio (phi ≈ 1.618)
    const phi = 1.618;
    const goldenW = width / phi;
    const goldenH = height / phi;
    guides.push(
      { type: 'line', x1: goldenW, y1: 0, x2: goldenW, y2: height, color: 'rgba(255,215,0,0.4)', opacity: 0.4 },
      { type: 'line', x1: width - goldenW, y1: 0, x2: width - goldenW, y2: height, color: 'rgba(255,215,0,0.4)', opacity: 0.4 },
      { type: 'line', x1: 0, y1: goldenH, x2: width, y2: goldenH, color: 'rgba(255,215,0,0.4)', opacity: 0.4 },
      { type: 'line', x1: 0, y1: height - goldenH, x2: width, y2: height - goldenH, color: 'rgba(255,215,0,0.4)', opacity: 0.4 },
    );
  }
  
  if (type === 'crosshair' || type === 'all') {
    // Center crosshair
    const centerX = width / 2;
    const centerY = height / 2;
    const crossSize = Math.min(width, height) * 0.05;
    guides.push(
      { type: 'line', x1: centerX - crossSize, y1: centerY, x2: centerX + crossSize, y2: centerY, color: 'rgba(255,0,0,0.7)', opacity: 0.7 },
      { type: 'line', x1: centerX, y1: centerY - crossSize, x2: centerX, y2: centerY + crossSize, color: 'rgba(255,0,0,0.7)', opacity: 0.7 },
    );
  }
  
  if (type === 'safe_areas' || type === 'all') {
    // Title safe (90%) and action safe (93%)
    const titleSafe = 0.90;
    const actionSafe = 0.93;
    
    const titleMarginW = width * (1 - titleSafe) / 2;
    const titleMarginH = height * (1 - titleSafe) / 2;
    const actionMarginW = width * (1 - actionSafe) / 2;
    const actionMarginH = height * (1 - actionSafe) / 2;
    
    guides.push(
      // Title safe (inner)
      { type: 'rect', x1: titleMarginW, y1: titleMarginH, width: width * titleSafe, height: height * titleSafe, color: 'rgba(0,255,0,0.3)', opacity: 0.3, label: 'Title Safe' },
      // Action safe (outer)
      { type: 'rect', x1: actionMarginW, y1: actionMarginH, width: width * actionSafe, height: height * actionSafe, color: 'rgba(255,255,0,0.2)', opacity: 0.2, label: 'Action Safe' },
    );
  }
  
  return guides;
}

// ============================================================================
// Aspect Ratio Helpers
// ============================================================================

export function getAspectRatioDimensions(
  aspectRatio: ViewfinderSettings['aspectRatio'],
  customRatio?: [number, number]
): [number, number] {
  switch (aspectRatio) {
    case '16:9': return [16, 9];
    case '4:3': return [4, 3];
    case '2.39:1': return [2.39, 1];
    case '1:1': return [1, 1];
    case '3:2': return [3, 2];
    case'custom': return customRatio || [16, 9];
    default: return [16, 9];
  }
}

export function calculateLetterbox(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: [number, number]
): { width: number; height: number; x: number; y: number } {
  const containerAR = containerWidth / containerHeight;
  const targetAR = aspectRatio[0] / aspectRatio[1];
  
  let width: number;
  let height: number;
  
  if (containerAR > targetAR) {
    // Container is wider - letterbox on sides
    height = containerHeight;
    width = height * targetAR;
  } else {
    // Container is taller - letterbox on top/bottom
    width = containerWidth;
    height = width / targetAR;
  }
  
  return {
    width,
    height,
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
  };
}

// ============================================================================
// Camera Info Formatter
// ============================================================================

export interface CameraInfoDisplay {
  aperture: string;
  shutter: string;
  iso: string;
  focalLength: string;
  focusDistance: string;
  ev: string;
  dof: string;
  lens?: string;
}

export function formatCameraInfo(camera: CameraState, exposure: ExposureInfo, dof: FocusInfo): CameraInfoDisplay {
  // Format shutter speed
  let shutterStr: string;
  if (camera.shutter >= 1) {
    shutterStr = `${camera.shutter.toFixed(1)}"`;
  } else if (camera.shutter >= 0.5) {
    shutterStr = `1/${Math.round(1 / camera.shutter)}`;
  } else {
    shutterStr = `1/${Math.round(1 / camera.shutter)}`;
  }
  
  // Format DOF
  let dofStr: string;
  if (dof.depthOfField === Infinity) {
    dofStr = `${dof.nearLimit.toFixed(1)}m - ∞`;
  } else {
    dofStr = `${dof.nearLimit.toFixed(2)}m - ${dof.farLimit.toFixed(2)}m`;
  }
  
  return {
    aperture: `f/${camera.aperture.toFixed(1)}`,
    shutter: shutterStr,
    iso: `ISO ${camera.iso}`,
    focalLength: `${camera.focalLength}mm`,
    focusDistance: `${camera.focusDistance.toFixed(1)}m`,
    ev: `EV ${exposure.ev.toFixed(1)}`,
    dof: dofStr,
    lens: camera.lensSpec?.model,
  };
}

// ============================================================================
// Histogram Data Generator
// ============================================================================

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  luminance: number[];
}

export function generateHistogramFromImageData(imageData: ImageData): HistogramData {
  const histogram: HistogramData = {
    r: new Array(256).fill(0),
    g: new Array(256).fill(0),
    b: new Array(256).fill(0),
    luminance: new Array(256).fill(0),
  };
  
  const data = imageData.data;
  const pixelCount = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    histogram.r[r]++;
    histogram.g[g]++;
    histogram.b[b]++;
    histogram.luminance[l]++;
  }
  
  // Normalize
  const maxR = Math.max(...histogram.r);
  const maxG = Math.max(...histogram.g);
  const maxB = Math.max(...histogram.b);
  const maxL = Math.max(...histogram.luminance);
  const maxAll = Math.max(maxR, maxG, maxB, maxL);
  
  if (maxAll > 0) {
    histogram.r = histogram.r.map(v => v / maxAll);
    histogram.g = histogram.g.map(v => v / maxAll);
    histogram.b = histogram.b.map(v => v / maxAll);
    histogram.luminance = histogram.luminance.map(v => v / maxAll);
  }
  
  return histogram;
}

// ============================================================================
// Export
// ============================================================================

export class ViewfinderRenderer {
  private settings: ViewfinderSettings;
  private camera: CameraState | null = null;
  
  constructor(settings?: Partial<ViewfinderSettings>) {
    this.settings = { ...DEFAULT_VIEWFINDER_SETTINGS, ...settings };
  }
  
  setSettings(settings: Partial<ViewfinderSettings>) {
    this.settings = { ...this.settings, ...settings };
  }
  
  getSettings(): ViewfinderSettings {
    return { ...this.settings };
  }
  
  setCamera(camera: CameraState) {
    this.camera = camera;
  }
  
  getCamera(): CameraState | null {
    return this.camera;
  }
  
  getExposureInfo(sceneLuminance?: number): ExposureInfo | null {
    if (!this.camera) return null;
    return calculateExposureInfo(this.camera, sceneLuminance);
  }
  
  getDOFInfo(): FocusInfo | null {
    if (!this.camera) return null;
    return calculateDOF(this.camera);
  }
  
  getCameraInfoDisplay(sceneLuminance?: number): CameraInfoDisplay | null {
    if (!this.camera) return null;
    const exposure = this.getExposureInfo(sceneLuminance);
    const dof = this.getDOFInfo();
    if (!exposure || !dof) return null;
    return formatCameraInfo(this.camera, exposure, dof);
  }
  
  getFrameGuides(width: number, height: number): FrameGuide[] {
    if (!this.settings.showGuides) return [];
    return generateFrameGuides(this.settings.guideType, width, height);
  }
  
  getLetterbox(containerWidth: number, containerHeight: number) {
    const ratio = getAspectRatioDimensions(this.settings.aspectRatio, this.settings.customAspectRatio);
    return calculateLetterbox(containerWidth, containerHeight, ratio);
  }
}

