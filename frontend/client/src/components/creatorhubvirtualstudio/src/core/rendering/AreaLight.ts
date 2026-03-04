/**
 * Area Light System
 * 
 * Implements mesh-based area lights for:
 * - Softboxes (rectangular)
 * - Umbrellas (circular/parabolic)
 * - Strip lights (linear)
 * - Ring lights (circular)
 * 
 * Features:
 * - Physically accurate light distribution
 * - Proper falloff and attenuation
 * - Light shaping with grids/diffusion
 * - IES profile support
 */

import * as THREE from 'three';
import type { IESProfile } from '../services/ies';
import { photometricCalculator } from '../services/photometric';

export type AreaLightType = 'softbox' | 'umbrella' | 'strip' | 'ring' | 'panel';

export interface AreaLightConfig {
  type: AreaLightType;
  width: number;  // meters
  height: number; // meters
  power: number;  // watts
  color: THREE.Color;
  temperature: number; // Kelvin
  
  // Light shaping
  diffusion: number; // 0-1, affects softness
  grid: boolean;     // Honeycomb grid for directionality
  gridAngle: number; // degrees
  
  // IES profile (optional)
  iesProfile?: IESProfile;
  
  // Physical properties
  innerDiffusor: boolean; // Inner vs outer diffusion
  reflectorEfficiency: number; // 0-1
}

export class AreaLight extends THREE.Object3D {
  public config: AreaLightConfig;
  public lightMesh: THREE.Mesh;
  public helperMesh?: THREE.Mesh;
  private emissiveMaterial: THREE.MeshStandardMaterial;
  
  // For shader integration
  public uniformData: {
    position: THREE.Vector3;
    color: THREE.Color;
    intensity: number;
    size: THREE.Vector3;
  };

  constructor(config: Partial<AreaLightConfig> = {}) {
    super();
    
    this.config = {
      type: 'softbox',
      width: 0.6,
      height: 0.6,
      power: 300,
      color: new THREE.Color(1, 1, 1),
      temperature: 5600,
      diffusion: 0.8,
      grid: false,
      gridAngle: 40,
      innerDiffusor: true,
      reflectorEfficiency: 0.9,
      ...config,
    };
    
    this.uniformData = {
      position: new THREE.Vector3(),
      color: this.config.color.clone(),
      intensity: this.calculateIntensity(),
      size: new THREE.Vector3(this.config.width, this.config.height, 0),
    };
    
    this.createLightMesh();
    this.createHelper();
  }
  
  private createLightMesh(): void {
    const geometry = this.createGeometry();
    
    // Emissive material for the light surface
    this.emissiveMaterial = new THREE.MeshStandardMaterial({
      color: this.config.color,
      emissive: this.config.color,
      emissiveIntensity: this.config.power / 100,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    
    this.lightMesh = new THREE.Mesh(geometry, this.emissiveMaterial);
    this.lightMesh.castShadow = false;
    this.lightMesh.receiveShadow = false;
    
    this.add(this.lightMesh);
  }
  
  private createGeometry(): THREE.BufferGeometry {
    switch (this.config.type) {
      case 'softbox':
      case 'panel':
        return new THREE.PlaneGeometry(this.config.width, this.config.height, 4, 4);
      
      case 'umbrella':
        // Parabolic shape
        return this.createUmbrellaGeometry();
      
      case 'strip':
        return new THREE.PlaneGeometry(this.config.width, this.config.height, 8, 2);
      
      case'ring':
        return this.createRingGeometry();
      
      default:
        return new THREE.PlaneGeometry(this.config.width, this.config.height);
    }
  }
  
  private createUmbrellaGeometry(): THREE.BufferGeometry {
    const radius = this.config.width / 2;
    const segments = 32;
    const geometry = new THREE.SphereGeometry(radius, segments, segments, 0, Math.PI * 2, 0, Math.PI / 3);
    
    // Invert normals for umbrella (light reflects inward then outward)
    const normals = geometry.attributes.normal.array as Float32Array;
    for (let i = 0; i < normals.length; i++) {
      normals[i] *= -1;
    }
    geometry.attributes.normal.needsUpdate = true;
    
    return geometry;
  }
  
  private createRingGeometry(): THREE.BufferGeometry {
    const outerRadius = this.config.width / 2;
    const innerRadius = outerRadius * 0.4;
    return new THREE.RingGeometry(innerRadius, outerRadius, 32);
  }
  
  private createHelper(): void {
    // Visual helper showing light direction and coverage
    const helperGeometry = new THREE.BoxGeometry(
      this.config.width + 0.02,
      this.config.height + 0.02,
      0.05
    );
    const helperMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      wireframe: false,
      transparent: true,
      opacity: 0.3,
    });
    
    this.helperMesh = new THREE.Mesh(helperGeometry, helperMaterial);
    this.helperMesh.position.z = -0.03;
    this.add(this.helperMesh);
  }
  
  private calculateIntensity(): number {
    // Use photometric calculator for physically accurate intensity
    // Account for area, efficiency, and diffusion
    const area = this.config.width * this.config.height;
    const efficiency = this.config.reflectorEfficiency;
    const diffusionFactor = 1.0 - (this.config.diffusion * 0.3); // Diffusion reduces intensity slightly
    
    // Calculate effective power with efficiency and diffusion
    const effectivePower = this.config.power * efficiency * diffusionFactor;
    
    // Use photometric calculator to get proper intensity
    // For area lights, we need to account for the area
    const wattage = this.config.power; // Assume power is in watts if > 1, otherwise normalized
    const actualWattage = wattage > 1 ? wattage : 500 * wattage; // Convert normalized to watts
    
    // Calculate lumens using photometric calculator
    const lumens = photometricCalculator.powerToLumens(
      effectivePower,
      'strobe',
      actualWattage
    );
    
    // For area lights, intensity is distributed over the area
    // Convert to candelas per square meter (luminance)
    const candelasPerSquareMeter = lumens / (area * Math.PI);
    
    // Scale for Three.js rendering (divide by 1000 for reasonable values)
    return candelasPerSquareMeter / 1000;
  }
  
  public updateUniforms(): void {
    this.getWorldPosition(this.uniformData.position);
    this.uniformData.intensity = this.calculateIntensity();
    this.uniformData.color.copy(this.config.color);
  }
  
  public setPower(watts: number): void {
    this.config.power = watts;
    this.emissiveMaterial.emissiveIntensity = watts / 100;
    this.updateUniforms();
  }
  
  public setColor(color: THREE.Color): void {
    this.config.color.copy(color);
    this.emissiveMaterial.color.copy(color);
    this.emissiveMaterial.emissive.copy(color);
    this.updateUniforms();
  }
  
  public setTemperature(kelvin: number): void {
    this.config.temperature = kelvin;
    const color = this.kelvinToRGB(kelvin);
    this.setColor(color);
  }
  
  private kelvinToRGB(kelvin: number): THREE.Color {
    const temp = kelvin / 100;
    let r, g, b;
    
    if (temp <= 66) {
      r = 255;
      g = temp;
      g = 99.4708025861 * Math.log(g) - 161.1195681661;
      if (temp <= 19) {
        b = 0;
      } else {
        b = temp - 10;
        b = 138.5177312231 * Math.log(b) - 305.0447927307;
      }
    } else {
      r = temp - 60;
      r = 329.698727446 * Math.pow(r, -0.1332047592);
      g = temp - 60;
      g = 288.1221695283 * Math.pow(g, -0.0755148492);
      b = 255;
    }
    
    return new THREE.Color(
      Math.max(0, Math.min(255, r)) / 255,
      Math.max(0, Math.min(255, g)) / 255,
      Math.max(0, Math.min(255, b)) / 255
    );
  }
}

