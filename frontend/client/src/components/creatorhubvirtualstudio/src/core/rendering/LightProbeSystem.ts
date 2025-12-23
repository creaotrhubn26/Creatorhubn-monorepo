/**
 * Light Probe System
 * 
 * Implements proper light probes with spherical harmonics for Global Illumination
 * Based on techniques used in professional rendering engines
 * 
 * References:
 * - "Real-Time Rendering" by Akenine-Möller et al.
 * - "Spherical Harmonics Lighting: The Gritty Details" by Robin Green
 */

import * as THREE from 'three';
import { AreaLight } from './AreaLight';
import { logger } from '../services/logger';

const log = logger.module('LightProbeSystem');

export interface LightProbeConfig {
  resolution: number; // Probe resolution (typically 16, 32, or 64)
  updateFrequency: number; // Frames between updates
  enableDiffuse: boolean; // Enable diffuse GI (spherical harmonics)
  enableSpecular: boolean; // Enable specular GI (reflection probes)
  intensity: number; // Overall GI intensity
}

export interface SphericalHarmonicsCoefficients {
  coefficients: Float32Array; // 9 coefficients for L0, L1, L2 bands (RGB each = 27 total)
}

/**
 * Light Probe with Spherical Harmonics
 */
export class LightProbe {
  public position: THREE.Vector3;
  public shCoefficients: SphericalHarmonicsCoefficients;
  public radius: number;
  public intensity: number;
  
  private probeMesh: THREE.Mesh | null = null;
  
  constructor(position: THREE.Vector3, radius: number = 1.0) {
    this.position = position.clone();
    this.radius = radius;
    this.intensity = 1.0;
    
    // Initialize SH coefficients (9 bands, RGB = 27 values)
    this.shCoefficients = {
      coefficients: new Float32Array(27),
    };
  }
  
  /**
   * Update spherical harmonics from lighting
   */
  updateFromLights(lights: AreaLight[], scene: THREE.Scene): void {
    // Reset coefficients
    this.shCoefficients.coefficients.fill(0);
    
    // Sample lighting from all directions
    const sampleCount = 64; // Number of samples for SH calculation
    const samples = this.generateSphereSamples(sampleCount);
    
    let totalWeight = 0;
    
    for (const sample of samples) {
      const direction = new THREE.Vector3(sample.x, sample.y, sample.z);
      const worldDir = direction.clone();
      
      // Calculate irradiance from all lights in this direction
      const irradiance = this.calculateIrradiance(worldDir, lights, scene);
      
      // Project onto spherical harmonics basis functions
      const shBasis = this.evaluateSHBasis(sample.x, sample.y, sample.z);
      
      // Accumulate into SH coefficients
      for (let i = 0; i < 9; i++) {
        const basis = shBasis[i];
        this.shCoefficients.coefficients[i * 3] += irradiance.r * basis * sample.weight;
        this.shCoefficients.coefficients[i * 3 + 1] += irradiance.g * basis * sample.weight;
        this.shCoefficients.coefficients[i * 3 + 2] += irradiance.b * basis * sample.weight;
      }
      
      totalWeight += sample.weight;
    }
    
    // Normalize
    if (totalWeight > 0) {
      for (let i = 0; i < 27; i++) {
        this.shCoefficients.coefficients[i] /= totalWeight;
      }
    }
  }
  
  /**
   * Generate uniform sphere samples for SH calculation
   */
  private generateSphereSamples(count: number): Array<{
    x: number;
    y: number;
    z: number;
    weight: number;
  }> {
    const samples: Array<{ x: number; y: number; z: number; weight: number }> = [];
    
    // Use Fibonacci sphere sampling for uniform distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      
      samples.push({
        x,
        y,
        z,
        weight: 1.0 / count, // Uniform weight
      });
    }
    
    return samples;
  }
  
  /**
   * Calculate irradiance from lights in a given direction
   */
  private calculateIrradiance(
    direction: THREE.Vector3,
    lights: AreaLight[],
    scene: THREE.Scene
  ): THREE.Color {
    const irradiance = new THREE.Color(0, 0, 0);
    
    for (const light of lights) {
      const lightPos = new THREE.Vector3();
      light.getWorldPosition(lightPos);
      
      const toLight = new THREE.Vector3().subVectors(lightPos, this.position);
      const distance = toLight.length();
      toLight.normalize();
      
      // Calculate angle between direction and light
      const cosAngle = Math.max(0, direction.dot(toLight));
      
      // Calculate light contribution
      const intensity = light.uniformData.intensity;
      const attenuation = 1.0 / (distance * distance);
      const contribution = intensity * attenuation * cosAngle;
      
      // Add to irradiance
      const lightColor = light.uniformData.color.clone();
      lightColor.multiplyScalar(contribution);
      irradiance.add(lightColor);
    }
    
    return irradiance;
  }
  
  /**
   * Evaluate spherical harmonics basis functions
   * 
   * SH basis functions for L0, L1, L2 bands:
   * L0: Y0,0 = 1/2 * sqrt(1/π)
   * L1: Y1,-1 = sqrt(3/4π) * y
   *     Y1,0  = sqrt(3/4π) * z
   *     Y1,1  = sqrt(3/4π) * x
   * L2: Y2,-2 = sqrt(15/4π) * x * y
   *     Y2,-1 = sqrt(15/4π) * y * z
   *     Y2,0  = sqrt(5/16π) * (3*z² - 1)
   *     Y2,1  = sqrt(15/4π) * x * z
   *     Y2,2  = sqrt(15/16π) * (x² - y²)
   */
  private evaluateSHBasis(x: number, y: number, z: number): number[] {
    const basis = new Array(9);
    
    // Normalize
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length > 0) {
      x /= length;
      y /= length;
      z /= length;
    }
    
    // L0 band
    basis[0] = 0.282095; // Y0,0 = 1/2 * sqrt(1/π)
    
    // L1 band
    basis[1] = 0.488603 * y; // Y1,-1
    basis[2] = 0.488603 * z; // Y1,0
    basis[3] = 0.488603 * x; // Y1,1
    
    // L2 band
    basis[4] = 1.092548 * x * y; // Y2,-2
    basis[5] = 1.092548 * y * z; // Y2,-1
    basis[6] = 0.315392 * (3 * z * z - 1); // Y2,0
    basis[7] = 1.092548 * x * z; // Y2,1
    basis[8] = 0.546274 * (x * x - y * y); // Y2,2
    
    return basis;
  }
  
  /**
   * Evaluate SH at a given direction
   */
  evaluate(direction: THREE.Vector3): THREE.Color {
    const shBasis = this.evaluateSHBasis(direction.x, direction.y, direction.z);
    const color = new THREE.Color(0, 0, 0);
    
    for (let i = 0; i < 9; i++) {
      const basis = shBasis[i];
      color.r += this.shCoefficients.coefficients[i * 3] * basis;
      color.g += this.shCoefficients.coefficients[i * 3 + 1] * basis;
      color.b += this.shCoefficients.coefficients[i * 3 + 2] * basis;
    }
    
    return color.multiplyScalar(this.intensity);
  }
  
  /**
   * Create visual representation of the probe
   */
  createVisualization(): THREE.Mesh {
    if (this.probeMesh) {
      return this.probeMesh;
    }
    
    const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    
    this.probeMesh = new THREE.Mesh(geometry, material);
    this.probeMesh.position.copy(this.position);
    
    return this.probeMesh;
  }
  
  dispose(): void {
    if (this.probeMesh) {
      this.probeMesh.geometry.dispose();
      (this.probeMesh.material as THREE.Material).dispose();
      this.probeMesh = null;
    }
  }
}

/**
 * Light Probe System
 */
export class LightProbeSystem {
  private config: LightProbeConfig;
  private probes: LightProbe[] = [];
  private reflectionProbes: THREE.CubeTexture[] = [];
  private frameCount: number = 0;
  
  constructor(config: Partial<LightProbeConfig> = {}) {
    this.config = {
      resolution: 32,
      updateFrequency: 5,
      enableDiffuse: true,
      enableSpecular: true,
      intensity: 1.0,
      ...config,
    };
  }
  
  /**
   * Add a light probe at a specific position
   */
  addProbe(position: THREE.Vector3, radius: number = 1.0): LightProbe {
    const probe = new LightProbe(position, radius);
    this.probes.push(probe);
    return probe;
  }
  
  /**
   * Remove a light probe
   */
  removeProbe(probe: LightProbe): void {
    const index = this.probes.indexOf(probe);
    if (index > -1) {
      this.probes.splice(index, 1);
      probe.dispose();
    }
  }
  
  /**
   * Update all probes from current lighting
   */
  update(areaLights: AreaLight[], scene: THREE.Scene): void {
    if (!this.config.enableDiffuse) return;
    
    this.frameCount++;
    if (this.frameCount % this.config.updateFrequency !== 0) return;
    
    // Update each probe
    for (const probe of this.probes) {
      probe.updateFromLights(areaLights, scene);
    }
  }
  
  /**
   * Get ambient light from nearest probe
   */
  getAmbientLight(position: THREE.Vector3, normal: THREE.Vector3): THREE.Color {
    if (this.probes.length === 0) {
      return new THREE.Color(0, 0, 0);
    }
    
    // Find nearest probe
    let nearestProbe: LightProbe | null = null;
    let nearestDistance = Infinity;
    
    for (const probe of this.probes) {
      const distance = position.distanceTo(probe.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestProbe = probe;
      }
    }
    
    if (!nearestProbe) {
      return new THREE.Color(0, 0, 0);
    }
    
    // Evaluate SH at surface normal direction
    return nearestProbe.evaluate(normal);
  }
  
  /**
   * Create default studio probes
   */
  createStudioProbes(scene: THREE.Scene): void {
    // Main subject area probe
    const mainProbe = this.addProbe(new THREE.Vector3(0, 1.6, 0), 2.0);
    
    // Floor probe
    const floorProbe = this.addProbe(new THREE.Vector3(0, 0.1, 0), 1.5);
    
    // Corner probes for better coverage
    const cornerProbe1 = this.addProbe(new THREE.Vector3(-2, 1.0, -2), 1.5);
    const cornerProbe2 = this.addProbe(new THREE.Vector3(2, 1.0, -2), 1.5);
    const cornerProbe3 = this.addProbe(new THREE.Vector3(-2, 1.0, 2), 1.5);
    const cornerProbe4 = this.addProbe(new THREE.Vector3(2, 1.0, 2), 1.5);
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<LightProbeConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Dispose all probes
   */
  dispose(): void {
    for (const probe of this.probes) {
      probe.dispose();
    }
    this.probes = [];
    this.reflectionProbes = [];
  }
}


