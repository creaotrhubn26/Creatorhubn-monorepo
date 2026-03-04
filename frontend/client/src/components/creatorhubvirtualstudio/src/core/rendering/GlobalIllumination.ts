/**
 * Global Illumination Bounce Approximation
 * 
 * Implements real-time GI for studio environments:
 * - Floor bounce (white/gray floors)
 * - Wall bounce (cyclorama, v-flats)
 * - Reflector bounce (silver/white reflectors)
 * - Multi-bounce approximation
 * 
 * Uses simplified light probes and virtual point lights
 */

import * as THREE from 'three';
import type { AreaLight } from './AreaLight';
import { LightProbeSystem } from './LightProbeSystem';

export interface BounceSource {
  type: 'floor' | 'wall' | 'reflector' | 'ceiling';
  geometry: THREE.Mesh;
  reflectance: number; // 0-1 (albedo)
  color: THREE.Color;
  roughness: number; // 0-1, affects bounce spread
}

export interface GIConfig {
  enabled: boolean;
  bounces: number; // 1-3 bounces
  intensity: number; // 0-1, overall GI strength
  resolution: number; // Probe resolution
  updateFrequency: number; // Frames between updates
}

export class GlobalIlluminationSystem {
  private config: GIConfig;
  private bounceSources: BounceSource[] = [];
  private virtualLights: THREE.PointLight[] = [];
  private lightProbes: THREE.LightProbe[] = [];
  private lightProbeSystem: LightProbeSystem | null = null;
  private frameCount: number = 0;
  
  constructor(config: Partial<GIConfig> = {}) {
    this.config = {
      enabled: true,
      bounces: 2,
      intensity: 0.5,
      resolution: 16,
      updateFrequency: 5,
      ...config,
    };
  }
  
  public addBounceSource(source: BounceSource): void {
    this.bounceSources.push(source);
  }
  
  public removeBounceSource(source: BounceSource): void {
    const index = this.bounceSources.indexOf(source);
    if (index > -1) {
      this.bounceSources.splice(index, 1);
    }
  }
  
  /**
   * Initialize light probe system
   */
  public initializeLightProbes(scene: THREE.Scene): void {
    if (!this.lightProbeSystem) {
      this.lightProbeSystem = new LightProbeSystem({
        resolution: this.config.resolution,
        updateFrequency: this.config.updateFrequency,
        enableDiffuse: true,
        intensity: this.config.intensity,
      });
      this.lightProbeSystem.createStudioProbes(scene);
    }
  }
  
  /**
   * Calculate bounce lighting from area lights
   */
  public calculateBounces(areaLights: AreaLight[], scene: THREE.Scene): void {
    if (!this.config.enabled) return;
    
    this.frameCount++;
    if (this.frameCount % this.config.updateFrequency !== 0) return;
    
    // Update light probes if available
    if (this.lightProbeSystem) {
      this.lightProbeSystem.update(areaLights, scene);
    }
    
    // Clear previous virtual lights
    this.clearVirtualLights(scene);
    
    // For each area light, calculate bounces
    for (const light of areaLights) {
      for (const source of this.bounceSources) {
        this.calculateSingleBounce(light, source, scene);
      }
    }
  }
  
  /**
   * Get ambient light from light probes
   */
  public getAmbientLight(position: THREE.Vector3, normal: THREE.Vector3): THREE.Color {
    if (this.lightProbeSystem) {
      return this.lightProbeSystem.getAmbientLight(position, normal);
    }
    return new THREE.Color(0, 0, 0);
  }
  
  private calculateSingleBounce(
    light: AreaLight,
    source: BounceSource,
    scene: THREE.Scene
  ): void {
    // Get light position and direction
    const lightPos = new THREE.Vector3();
    light.getWorldPosition(lightPos);
    
    const lightDir = new THREE.Vector3(0, 0, -1);
    lightDir.applyQuaternion(light.quaternion);
    
    // Get bounce surface center
    const surfacePos = new THREE.Vector3();
    source.geometry.getWorldPosition(surfacePos);
    
    const surfaceNormal = new THREE.Vector3(0, 1, 0);
    surfaceNormal.applyQuaternion(source.geometry.quaternion);
    
    // Check if light hits the surface
    const toSurface = new THREE.Vector3().subVectors(surfacePos, lightPos);
    const distance = toSurface.length();
    toSurface.normalize();
    
    const angle = lightDir.dot(toSurface);
    if (angle < 0.1) return; // Light not pointing at surface
    
    // Calculate incident light intensity
    const attenuation = 1.0 / (distance * distance);
    const incidentIntensity = light.uniformData.intensity * attenuation * angle;
    
    // Calculate bounce intensity
    const bounceIntensity = incidentIntensity * source.reflectance * this.config.intensity;
    
    // Create virtual point light at bounce location
    const bounceColor = new THREE.Color().copy(light.uniformData.color);
    bounceColor.multiply(source.color);
    
    const virtualLight = new THREE.PointLight(
      bounceColor,
      bounceIntensity,
      distance * 2, // Range
      2.0 // Decay
    );
    
    virtualLight.position.copy(surfacePos);
    virtualLight.castShadow = false; // Bounce lights don't cast shadows
    
    scene.add(virtualLight);
    this.virtualLights.push(virtualLight);
    
    // For multiple bounces, recursively calculate
    if (this.config.bounces > 1) {
      this.calculateSecondaryBounce(virtualLight, source, scene);
    }
  }
  
  private calculateSecondaryBounce(
    primaryBounce: THREE.PointLight,
    primarySource: BounceSource,
    scene: THREE.Scene
  ): void {
    // Simplified secondary bounce - just add ambient fill
    for (const source of this.bounceSources) {
      if (source === primarySource) continue;
      
      const surfacePos = new THREE.Vector3();
      source.geometry.getWorldPosition(surfacePos);
      
      const distance = primaryBounce.position.distanceTo(surfacePos);
      if (distance > 5.0) continue; // Too far for secondary bounce
      
      const secondaryIntensity = primaryBounce.intensity * 0.3 * source.reflectance;
      
      const secondaryLight = new THREE.PointLight(
        primaryBounce.color,
        secondaryIntensity,
        distance * 1.5,
        2.0
      );
      
      secondaryLight.position.copy(surfacePos);
      secondaryLight.castShadow = false;
      
      scene.add(secondaryLight);
      this.virtualLights.push(secondaryLight);
    }
  }
  
  private clearVirtualLights(scene: THREE.Scene): void {
    for (const light of this.virtualLights) {
      scene.remove(light);
      light.dispose();
    }
    this.virtualLights = [];
  }
  
  /**
   * Create standard studio bounce sources
   */
  public static createStudioEnvironment(scene: THREE.Scene): BounceSource[] {
    const sources: BounceSource[] = [];
    
    // White floor (high reflectance)
    const floorGeometry = new THREE.PlaneGeometry(10, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    sources.push({
      type: 'floor',
      geometry: floor,
      reflectance: 0.8,
      color: new THREE.Color(1, 1, 1),
      roughness: 0.8,
    });
    
    // Back wall (cyclorama)
    const wallGeometry = new THREE.PlaneGeometry(10, 5);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.9,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.z = -5;
    wall.position.y = 2.5;
    wall.receiveShadow = true;
    scene.add(wall);
    
    sources.push({
      type: 'wall',
      geometry: wall,
      reflectance: 0.7,
      color: new THREE.Color(0.95, 0.95, 0.95),
      roughness: 0.9,
    });
    
    return sources;
  }
}

