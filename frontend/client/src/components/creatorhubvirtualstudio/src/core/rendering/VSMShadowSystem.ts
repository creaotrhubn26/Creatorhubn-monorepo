/**
 * Variance Shadow Maps (VSM) System
 * 
 * Implements VSM for softer, more realistic shadows
 * Based on "Variance Shadow Maps" by Donnelly & Lauritzen (2006)
 */

import * as THREE from 'three';
import { logger } from '../services/logger';

const log = logger.module('VSMShadowSystem');

export interface VSMShadowConfig {
  enabled: boolean;
  mapSize: number; // Shadow map resolution (e.g., 2048)
  blurRadius: number; // Blur radius for variance filtering (0-10)
  lightBleedingReduction: number; // Light bleeding reduction factor (0-1)
  minVariance: number; // Minimum variance to prevent numerical issues
}

/**
 * VSM Shadow Map Generator
 * 
 * Generates shadow maps that store depth and depth^2 (moments)
 * for variance-based shadow calculation
 */
export class VSMShadowMapGenerator {
  private renderer: THREE.WebGLRenderer;
  private config: VSMShadowConfig;
  private shadowMaps: Map<THREE.Light, THREE.WebGLRenderTarget> = new Map();
  private blurPasses: Map<THREE.Light, THREE.ShaderMaterial> = new Map();

  constructor(renderer: THREE.WebGLRenderer, config: Partial<VSMShadowConfig> = {}) {
    this.renderer = renderer;
    this.config = {
      enabled: true,
      mapSize: 2048,
      blurRadius: 3.0,
      lightBleedingReduction: 0.1,
      minVariance: 0.00002,
      ...config,
    };
  }

  /**
   * Create a VSM shadow map for a light
   * VSM stores depth in R channel and depth^2 in G channel
   */
  createShadowMap(light: THREE.Light): THREE.WebGLRenderTarget | null {
    if (!this.config.enabled) return null;

    // Check if we already have a shadow map for this light
    if (this.shadowMaps.has(light)) {
      return this.shadowMaps.get(light)!;
    }

    // Create render target with RG format (depth, depth^2)
    const shadowMap = new THREE.WebGLRenderTarget(this.config.mapSize, this.config.mapSize, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGFormat, // Store depth in R, depth^2 in G
      type: THREE.FloatType,
      generateMipmaps: false,
    });

    this.shadowMaps.set(light, shadowMap);
    log.debug(`Created VSM shadow map for light: ${light.type}`);

    return shadowMap;
  }

  /**
   * Render shadow map from light's perspective
   * Stores depth and depth^2 in RG channels
   */
  renderShadowMap(
    light: THREE.Light,
    scene: THREE.Scene,
    shadowCamera?: THREE.Camera
  ): void {
    if (!this.config.enabled) return;

    const shadowMap = this.shadowMaps.get(light);
    if (!shadowMap) {
      log.warn(`No shadow map found for light: ${light.type}`);
      return;
    }

    // Set up shadow camera
    if (!shadowCamera) {
      if (light instanceof THREE.DirectionalLight || light instanceof THREE.SpotLight) {
        shadowCamera = light.shadow.camera;
      } else {
        log.warn(`No shadow camera available for light: ${light.type}`);
        return;
      }
    }

    // Create VSM material that outputs depth and depth^2
    const vsmMaterial = this.createVSMMaterial();

    // Render scene from light's perspective
    const originalRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(shadowMap);
    this.renderer.clear();

    // Render all meshes with VSM material
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.castShadow) {
        const originalMaterial = object.material;
        object.material = vsmMaterial;
        this.renderer.render(object, shadowCamera);
        object.material = originalMaterial;
      }
    });

    this.renderer.setRenderTarget(originalRenderTarget);

    // Apply blur to reduce light bleeding
    if (this.config.blurRadius > 0) {
      this.blurShadowMap(shadowMap);
    }
  }

  /**
   * Create material that outputs depth and depth^2 for VSM
   */
  private createVSMMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec4 vShadowCoord;
        
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vShadowCoord = gl_Position;
        }
      `,
      fragmentShader: `
        varying vec4 vShadowCoord;
        
        void main() {
          // Normalize depth to [0, 1]
          float depth = vShadowCoord.z / vShadowCoord.w;
          depth = depth * 0.5 + 0.5; // Transform from [-1,1] to [0,1]
          
          // Store depth in R channel, depth^2 in G channel
          float depthSquared = depth * depth;
          
          gl_FragColor = vec4(depth, depthSquared, 0.0, 1.0);
        }
      `,
    });
  }

  /**
   * Blur shadow map to reduce light bleeding
   */
  private blurShadowMap(shadowMap: THREE.WebGLRenderTarget): void {
    // Simple box blur implementation
    // For production, consider using separable Gaussian blur
    const blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: shadowMap.texture },
        uBlurRadius: { value: this.config.blurRadius },
        uResolution: { value: new THREE.Vector2(this.config.mapSize, this.config.mapSize) },
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
        uniform float uBlurRadius;
        uniform vec2 uResolution;
        varying vec2 vUv;
        
        void main() {
          vec2 texelSize = 1.0 / uResolution;
          vec4 sum = vec4(0.0);
          float count = 0.0;
          
          // Box blur
          for (float x = -uBlurRadius; x <= uBlurRadius; x += 1.0) {
            for (float y = -uBlurRadius; y <= uBlurRadius; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize;
              sum += texture2D(tDiffuse, vUv + offset);
              count += 1.0;
            }
          }
          
          gl_FragColor = sum / count;
        }
      `,
    });

    // Apply blur (simplified - would need proper ping-pong buffers for production)
    const tempTarget = new THREE.WebGLRenderTarget(
      this.config.mapSize,
      this.config.mapSize,
      {
        format: THREE.RGFormat,
        type: THREE.FloatType,
      }
    );

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      blurMaterial
    );
    const scene = new THREE.Scene();
    scene.add(plane);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const originalRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(tempTarget);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(originalRenderTarget);

    // Copy blurred result back to shadow map
    shadowMap.texture = tempTarget.texture;
    tempTarget.dispose();
    blurMaterial.dispose();
  }

  /**
   * Get shadow map for a light
   */
  getShadowMap(light: THREE.Light): THREE.WebGLRenderTarget | undefined {
    return this.shadowMaps.get(light);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VSMShadowConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Dispose of all shadow maps
   */
  dispose(): void {
    this.shadowMaps.forEach((shadowMap) => shadowMap.dispose());
    this.shadowMaps.clear();
    this.blurPasses.forEach((material) => material.dispose());
    this.blurPasses.clear();
    log.info('VSM shadow system disposed');
  }
}

/**
 * VSM Shadow Chunk for integration into materials
 */
export const VSMShadowChunk = `
#ifdef USE_VSM_SHADOW

uniform sampler2D vsmShadowMap;
uniform mat4 vsmShadowMatrix;
uniform float vsmShadowBias;
uniform float vsmShadowDarkness;
uniform float vsmShadowSoftness;
uniform float vsmMinVariance;

varying vec4 vVSMShadowCoord;

float calculateVSMShadow(vec4 shadowCoord, float bias) {
  vec3 projCoords = shadowCoord.xyz / shadowCoord.w;
  projCoords = projCoords * 0.5 + 0.5; // Transform to [0,1] range
  
  if (projCoords.x < 0.0 || projCoords.x > 1.0 ||
      projCoords.y < 0.0 || projCoords.y > 1.0) {
    return 1.0; // Outside shadow map
  }
  
  float currentDepth = projCoords.z - bias;
  
  // Sample VSM (stores depth in R, depth^2 in G)
  vec2 moments = texture2D(vsmShadowMap, projCoords.xy).rg;
  
  // Chebyshev's inequality for soft shadows
  float p = step(currentDepth, moments.x);
  float variance = moments.y - (moments.x * moments.x);
  variance = max(variance, vsmMinVariance); // Prevent numerical issues
  
  float d = currentDepth - moments.x;
  float pMax = variance / (variance + d * d);
  
  // Apply light bleeding reduction
  pMax = smoothstep(vsmShadowSoftness, 1.0, pMax);
  
  return max(p, pMax);
}

#endif
`;

