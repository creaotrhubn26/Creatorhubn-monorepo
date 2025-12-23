/**
 * Photometric Calculator
 * 
 * Implements physically accurate light calculations based on:
 * - Inverse square law: I = P / (4π * d²)
 * - CIE standards for photometric units
 * - Real-world light source specifications
 * 
 * Reference: PBR Book Chapter 12.1 - Light Sources
 */

import * as THREE from 'three';

/**
 * Photometric units conversion
 */
export interface PhotometricUnits {
  watts: number;          // Electrical power (W)
  lumens: number;         // Luminous flux (lm)
  candelas: number;       // Luminous intensity (cd)
  lux: number;           // Illuminance (lx) at a point
  footCandles: number;    // Illuminance in imperial units (fc)
}

/**
 * Light source configuration
 */
export interface LightSourceConfig {
  power: number;          // Normalized power (0-1) or watts
  wattage?: number;       // Electrical power in watts
  efficacy?: number;      // Luminous efficacy (lm/W)
  position: THREE.Vector3;
  distance?: number;      // Distance to target point
  beamAngle?: number;    // Full beam angle in degrees
  modifier?: string;     // Light modifier type
  modifierSize?: number; // Modifier size in meters
}

/**
 * Photometric Calculator Class
 */
export class PhotometricCalculator {
  // Physical constants
  private readonly LUMINOUS_EFFICACY_STANDARD = 683; // lm/W at 555nm (peak human eye sensitivity)
  
  // Typical light source efficacies (lm/W)
  private readonly EFFICACY_TUNGSTEN = 15;      // Tungsten incandescent
  private readonly EFFICACY_HALOGEN = 20;        // Halogen
  private readonly EFFICACY_LED_WARM = 80;      // LED warm white
  private readonly EFFICACY_LED_COOL = 100;      // LED cool white
  private readonly EFFICACY_HMI = 95;            // HMI (film industry standard)
  private readonly EFFICACY_STROBE = 80;        // Studio strobe
  
  // Default assumptions
  private readonly DEFAULT_WATTAGE = 500;       // 500W light (common studio light)
  private readonly DEFAULT_EFFICACY = 80;       // LED/strobe efficacy

  /**
   * Calculate intensity at distance using inverse square law
   * 
   * Formula: I = P / (4π * d²)
   * Where:
   *   I = intensity at point (candelas)
   *   P = power (lumens)
   *   d = distance (meters)
   * 
   * Reference: PBR Book Chapter 12.1
   */
  calculateIntensityAtDistance(
    power: number,        // Normalized power (0-1)
    distance: number,     // Distance in meters
    wattage?: number,     // Electrical power in watts
    efficacy?: number     // Luminous efficacy (lm/W)
  ): number {
    // Ensure minimum distance to avoid division by zero
    const d = Math.max(0.01, distance);
    
    // Calculate luminous flux (lumens)
    const w = wattage || this.DEFAULT_WATTAGE;
    const e = efficacy || this.DEFAULT_EFFICACY;
    const lumens = w * e * power;
    
    // Apply inverse square law
    // I = P / (4π * d²)
    const intensity = lumens / (4 * Math.PI * d * d);
    
    return intensity;
  }

  /**
   * Convert power (0-1) to lumens
   */
  powerToLumens(
    power: number,
    lightType: 'tungsten' | 'halogen' | 'led-warm' | 'led-cool' | 'hmi' | 'strobe' = 'strobe',
    wattage: number = 500
  ): number {
    const efficacyMap: Record<string, number> = {
      'tungsten': this.EFFICACY_TUNGSTEN,
      'halogen': this.EFFICACY_HALOGEN,
      'led-warm': this.EFFICACY_LED_WARM,
      'led-cool': this.EFFICACY_LED_COOL,
      'hmi': this.EFFICACY_HMI,
      'strobe': this.EFFICACY_STROBE,
    };
    
    const efficacy = efficacyMap[lightType] || this.DEFAULT_EFFICACY;
    return wattage * efficacy * power;
  }

  /**
   * Convert lumens to candelas (for point source)
   * 
   * For uniform point source: I = Φ / (4π)
   * For spot light: I = Φ / Ω where Ω is solid angle
   */
  lumensToCandelas(lumens: number, beamAngleDegrees?: number): number {
    if (!beamAngleDegrees) {
      // Point light: uniform sphere
      return lumens / (4 * Math.PI);
    }
    
    // Spot light: calculate solid angle
    const beamAngleRadians = (beamAngleDegrees * Math.PI) / 180;
    const solidAngle = 2 * Math.PI * (1 - Math.cos(beamAngleRadians / 2));
    
    return lumens / solidAngle;
  }

  /**
   * Calculate illuminance (lux) at a point
   * 
   * Formula: E = (I × cos(θ)) / d²
   * Where:
   *   E = illuminance (lux)
   *   I = luminous intensity (candelas)
   *   θ = angle between light direction and surface normal
   *   d = distance (meters)
   */
  calculateIlluminance(
    lightConfig: LightSourceConfig,
    targetPoint: THREE.Vector3,
    surfaceNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  ): number {
    // Calculate distance
    const distance = lightConfig.distance || 
      lightConfig.position.distanceTo(targetPoint);
    
    // Calculate luminous flux
    const wattage = lightConfig.wattage || this.DEFAULT_WATTAGE;
    const efficacy = lightConfig.efficacy || this.DEFAULT_EFFICACY;
    const lumens = this.powerToLumens(lightConfig.power, 'strobe', wattage);
    
    // Calculate luminous intensity
    const candelas = this.lumensToCandelas(lumens, lightConfig.beamAngle);
    
    // Calculate angle between light direction and surface normal
    const lightDirection = new THREE.Vector3()
      .subVectors(targetPoint, lightConfig.position)
      .normalize();
    const cosTheta = Math.max(0, lightDirection.dot(surfaceNormal));
    
    // Calculate illuminance using inverse square law with angle
    const illuminance = (candelas * cosTheta) / (distance * distance);
    
    return illuminance;
  }

  /**
   * Convert lux to foot-candles
   * 1 fc = 10.764 lux
   */
  luxToFootCandles(lux: number): number {
    return lux / 10.764;
  }

  /**
   * Convert foot-candles to lux
   */
  footCandlesToLux(fc: number): number {
    return fc * 10.764;
  }

  /**
   * Calculate Three.js intensity from photometric values
   * 
   * Three.js uses a simplified model where intensity is in candelas
   * and decay=2 implements inverse square law.
   */
  calculateThreeJSIntensity(
    power: number,
    wattage?: number,
    efficacy?: number,
    beamAngle?: number
  ): number {
    const w = wattage || this.DEFAULT_WATTAGE;
    const e = efficacy || this.DEFAULT_EFFICACY;
    const lumens = this.powerToLumens(power, 'strobe', w);
    const candelas = this.lumensToCandelas(lumens, beamAngle);
    
    // Three.js intensity is in candelas
    // Scale down for reasonable rendering values
    return candelas / 1000; // Scale factor for Three.js
  }

  /**
   * Get all photometric units for a light source
   */
  getPhotometricUnits(
    lightConfig: LightSourceConfig,
    targetPoint?: THREE.Vector3
  ): PhotometricUnits {
    const wattage = lightConfig.wattage || this.DEFAULT_WATTAGE;
    const efficacy = lightConfig.efficacy || this.DEFAULT_EFFICACY;
    const lumens = this.powerToLumens(lightConfig.power, 'strobe', wattage);
    const candelas = this.lumensToCandelas(lumens, lightConfig.beamAngle);
    
    let lux = 0;
    let footCandles = 0;
    
    if (targetPoint) {
      lux = this.calculateIlluminance(lightConfig, targetPoint);
      footCandles = this.luxToFootCandles(lux);
    }
    
    return {
      watts: wattage * lightConfig.power,
      lumens,
      candelas,
      lux,
      footCandles,
    };
  }
}

// Export singleton instance
export const photometricCalculator = new PhotometricCalculator();


