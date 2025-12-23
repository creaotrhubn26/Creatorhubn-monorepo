/**
 * Lens Effects Renderer
 * 
 * Simulates real lens optical characteristics:
 * - Vignetting (corner falloff)
 * - Distortion (barrel/pincushion)
 * - Chromatic Aberration
 * - Lens flare
 * 
 * Based on real lens specifications from LensSpecifications.ts
 */

import { logger } from '../services/logger';

const log = logger.module('LensEffects');

// Dynamic THREE import for SSR compatibility
let THREE: any = null;
try {
  THREE = require('three');
} catch (e) {
  log.warn('THREE.js not available for LensEffectsRenderer');
}

// =============================================================================
// LENS EFFECTS PARAMETERS
// =============================================================================

export interface LensEffectsParams {
  // Vignetting (0 = none, 1 = maximum)
  vignetting: number;
  vignettingFalloff: number; // 1 = linear, 2 = quadratic (more realistic)
  
  // Distortion (-1 = barrel, 0 = none, 1 = pincushion)
  distortion: number;
  
  // Chromatic Aberration
  chromaticAberration: number;
  
  // Bokeh quality (affects shape/smoothness)
  bokehQuality: number;
  apertureBlades: number;
  
  // Lens flare sensitivity
  flareSensitivity: number;
  
  // T-stop vs F-stop (light transmission factor, 1.0 = perfect)
  transmissionFactor: number;
}

export const DEFAULT_LENS_EFFECTS: LensEffectsParams = {
  vignetting: 0.3,
  vignettingFalloff: 2,
  distortion: 0,
  chromaticAberration: 0,
  bokehQuality: 0.8,
  apertureBlades: 9,
  flareSensitivity: 0.5,
  transmissionFactor: 0.95,
};

// =============================================================================
// LENS EFFECTS FROM SPEC
// =============================================================================

/**
 * Convert lens spec to rendering effects parameters
 */
export function lensSpecToEffects(lensSpec: any): LensEffectsParams {
  if (!lensSpec) return DEFAULT_LENS_EFFECTS;
  
  return {
    vignetting: lensSpec.vignetting ?? 0.3,
    vignettingFalloff: 2, // Quadratic falloff is most realistic
    distortion: lensSpec.distortion ?? 0,
    chromaticAberration: lensSpec.chromaticAberration ?? 0.02,
    bokehQuality: lensSpec.bokehQuality ?? 0.8,
    apertureBlades: lensSpec.apertureBlades ?? 9,
    flareSensitivity: 0.5,
    transmissionFactor: calculateTransmissionFactor(lensSpec),
  };
}

/**
 * Calculate T-stop transmission factor from lens construction
 * More elements = more light loss
 */
function calculateTransmissionFactor(lensSpec: any): number {
  const elements = lensSpec.elements || 10;
  // Each element loses ~0.5% light transmission
  // Base transmission ~99.5% per element with modern coatings
  return Math.pow(0.995, elements);
}

// =============================================================================
// VIGNETTING SHADER
// =============================================================================

export const VignettingShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetting: { value: 0.3 },
    vignettingFalloff: { value: 2.0 },
    aspectRatio: { value: 1.5 },
  },
  
  vertexShader: `
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetting;
    uniform float vignettingFalloff;
    uniform float aspectRatio;
    
    varying vec2 vUv;
    
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      
      // Calculate distance from center (normalized to 0-1)
      vec2 center = vUv - 0.5;
      center.x *= aspectRatio;
      float dist = length(center) * 2.0; // 0 at center, ~1.4 at corners
      
      // Apply vignetting falloff
      float vignette = 1.0 - pow(dist * vignetting, vignettingFalloff);
      vignette = clamp(vignette, 0.0, 1.0);
      
      // Apply vignetting to color
      gl_FragColor = vec4(texel.rgb * vignette, texel.a);
    }
  `,
};

// =============================================================================
// DISTORTION SHADER
// =============================================================================

export const DistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    distortion: { value: 0.0 },
    aspectRatio: { value: 1.5 },
  },
  
  vertexShader: `
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float distortion;
    uniform float aspectRatio;
    
    varying vec2 vUv;
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      
      // Apply barrel/pincushion distortion
      float factor = 1.0 + distortion * dist * dist;
      vec2 distortedUv = center * factor + 0.5;
      
      // Clamp to valid UV range
      if (distortedUv.x < 0.0 || distortedUv.x > 1.0 || 
          distortedUv.y < 0.0 || distortedUv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, distortedUv);
      }
    }
  `,
};

// =============================================================================
// CHROMATIC ABERRATION SHADER
// =============================================================================

export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    chromaticAberration: { value: 0.02 },
  },
  
  vertexShader: `
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float chromaticAberration;
    
    varying vec2 vUv;
    
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      
      // Offset for red and blue channels
      vec2 redOffset = center * (1.0 + chromaticAberration * dist);
      vec2 blueOffset = center * (1.0 - chromaticAberration * dist);
      
      float r = texture2D(tDiffuse, redOffset + 0.5).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, blueOffset + 0.5).b;
      
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

// =============================================================================
// LENS EFFECTS PASS (for post-processing)
// =============================================================================

export class LensEffectsPass {
  private enabled: boolean = true;
  private params: LensEffectsParams;
  private vignettingPass: any;
  private distortionPass: any;
  private caPass: any;
  
  constructor(params: Partial<LensEffectsParams> = {}) {
    this.params = { ...DEFAULT_LENS_EFFECTS, ...params };
  }
  
  /**
   * Update lens effects parameters
   */
  setParams(params: Partial<LensEffectsParams>) {
    this.params = { ...this.params, ...params };
    this.updateUniforms();
  }
  
  /**
   * Update from lens specification
   */
  setFromLensSpec(lensSpec: any) {
    this.params = lensSpecToEffects(lensSpec);
    this.updateUniforms();
  }
  
  /**
   * Enable/disable effects
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
  
  /**
   * Update shader uniforms
   */
  private updateUniforms() {
    if (this.vignettingPass) {
      this.vignettingPass.uniforms.vignetting.value = this.params.vignetting;
      this.vignettingPass.uniforms.vignettingFalloff.value = this.params.vignettingFalloff;
    }
    if (this.distortionPass) {
      this.distortionPass.uniforms.distortion.value = this.params.distortion;
    }
    if (this.caPass) {
      this.caPass.uniforms.chromaticAberration.value = this.params.chromaticAberration;
    }
  }
  
  /**
   * Create Three.js ShaderPass objects
   */
  createPasses(): any[] {
    if (!THREE) return [];
    
    const { ShaderPass } = require('three/examples/jsm/postprocessing/ShaderPass');
    
    // Create passes
    this.vignettingPass = new ShaderPass(VignettingShader);
    this.distortionPass = new ShaderPass(DistortionShader);
    this.caPass = new ShaderPass(ChromaticAberrationShader);
    
    // Set initial values
    this.updateUniforms();
    
    return [
      this.distortionPass,
      this.caPass,
      this.vignettingPass, // Vignetting last for correct compositing
    ];
  }
  
  /**
   * Get current parameters
   */
  getParams(): LensEffectsParams {
    return { ...this.params };
  }
}

// =============================================================================
// VIGNETTE OVERLAY (for simple canvas overlay)
// =============================================================================

/**
 * Draw vignette overlay on a canvas context
 * Useful for simple 2D vignette without full post-processing
 */
export function drawVignetteOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: { vignetting: number; falloff?: number } = { vignetting: 0.3 }
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
  
  // Create radial gradient
  const gradient = ctx.createRadialGradient(
    centerX, centerY, maxRadius * (1 - params.vignetting),
    centerX, centerY, maxRadius
  );
  
  gradient.addColorStop(0'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${params.vignetting})`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

// =============================================================================
// VIGNETTE PREVIEW COMPONENT DATA
// =============================================================================

/**
 * Generate vignette preview data for UI display
 */
export function generateVignettePreview(
  vignetting: number,
  width: number = 200,
  height: number = 150
): ImageData | null {
  if (typeof document === 'undefined') return null;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  // Fill with white
  ctx.fillStyle ='white';
  ctx.fillRect(0, 0, width, height);
  
  // Draw vignette
  drawVignetteOverlay(ctx, width, height, { vignetting });
  
  return ctx.getImageData(0, 0, width, height);
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const lensEffects = new LensEffectsPass();
export default lensEffects;

