/**
 * Exposure Validation Service
 * 
 * Compares simulated lighting with real-world measurements
 * Validates photometric accuracy
 */

import * as THREE from 'three';
import { photometricCalculator } from './photometric';
import type { LightSourceConfig } from './photometric';
import { logger } from './logger';

const log = logger.module('ExposureValidation');

export interface RealWorldMeasurement {
  position: [number, number, number];
  lux: number;
  footCandles?: number;
  timestamp?: Date;
  notes?: string;
}

export interface ValidationResult {
  simulatedLux: number;
  measuredLux: number;
  difference: number;
  differencePercent: number;
  isValid: boolean;
  tolerance: number; // Acceptable difference in %
}

export interface ValidationReport {
  results: ValidationResult[];
  averageDifference: number;
  averageDifferencePercent: number;
  overallValid: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export class ExposureValidationService {
  private readonly DEFAULT_TOLERANCE = 15; // 15% tolerance for validation
  
  /**
   * Validate simulated lighting against real-world measurements
   */
  validate(
    lights: Array<{
      id: string;
      position: [number, number, number];
      power: number;
      beamAngle?: number;
      wattage?: number;
      efficacy?: number;
    }>,
    measurements: RealWorldMeasurement[],
    tolerance: number = this.DEFAULT_TOLERANCE
  ): ValidationReport {
    const results: ValidationResult[] = [];
    
    measurements.forEach((measurement) => {
      const targetPoint = new THREE.Vector3(...measurement.position);
      const surfaceNormal = new THREE.Vector3(0, 1, 0); // Assume horizontal surface
      
      let totalLux = 0;
      
      // Calculate simulated illuminance from all lights
      lights.forEach((light) => {
        const lightConfig: LightSourceConfig = {
          power: light.power,
          wattage: light.wattage,
          efficacy: light.efficacy,
          position: new THREE.Vector3(...light.position),
          beamAngle: light.beamAngle,
          distance: new THREE.Vector3(...light.position).distanceTo(targetPoint),
        };
        
        const lux = photometricCalculator.calculateIlluminance(
          lightConfig,
          targetPoint,
          surfaceNormal
        );
        
        totalLux += lux;
      });
      
      const difference = Math.abs(totalLux - measurement.lux);
      const differencePercent = (difference / measurement.lux) * 100;
      const isValid = differencePercent <= tolerance;
      
      results.push({
        simulatedLux: totalLux,
        measuredLux: measurement.lux,
        difference,
        differencePercent,
        isValid,
        tolerance,
      });
    });
    
    // Calculate averages
    const averageDifference = results.reduce((sum, r) => sum + r.difference, 0) / results.length;
    const averageDifferencePercent = results.reduce((sum, r) => sum + r.differencePercent, 0) / results.length;
    const overallValid = results.every((r) => r.isValid);
    
    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (averageDifferencePercent < 5) {
      confidence = 'high';
    } else if (averageDifferencePercent < 10) {
      confidence = 'medium';
    }
    
    return {
      results,
      averageDifference,
      averageDifferencePercent,
      overallValid,
      confidence,
    };
  }
  
  /**
   * Compare simulated vs measured values and log differences
   */
  logValidationReport(report: ValidationReport): void {
    log.info('Exposure Validation Report:');
    log.info(`  Average Difference: ${report.averageDifference.toFixed(2)} lux (${report.averageDifferencePercent.toFixed(1)}%)`);
    log.info(`  Overall Valid: ${report.overallValid ? 'YES' : 'NO'}`);
    log.info(`  Confidence: ${report.confidence.toUpperCase()}`);
    
    report.results.forEach((result, index) => {
      log.info(`  Measurement ${index + 1}:`);
      log.info(`    Simulated: ${result.simulatedLux.toFixed(2)} lux`);
      log.info(`    Measured: ${result.measuredLux.toFixed(2)} lux`);
      log.info(`    Difference: ${result.difference.toFixed(2)} lux (${result.differencePercent.toFixed(1)}%)`);
      log.info(`    Valid: ${result.isValid ? 'YES' : 'NO'}`);
    });
  }
  
  /**
   * Suggest calibration adjustments based on validation results
   */
  suggestCalibration(report: ValidationReport): {
    adjustEfficacy: boolean;
    efficacyMultiplier: number;
    adjustWattage: boolean;
    wattageMultiplier: number;
    message: string;
  } {
    const { averageDifferencePercent } = report;
    
    // If simulated is consistently higher, reduce efficacy or wattage
    const simulatedHigher = report.results.every(
      (r) => r.simulatedLux > r.measuredLux
    );
    
    // If simulated is consistently lower, increase efficacy or wattage
    const simulatedLower = report.results.every(
      (r) => r.simulatedLux < r.measuredLux
    );
    
    if (simulatedHigher && averageDifferencePercent > 10) {
      const multiplier = 1 - (averageDifferencePercent / 100);
      return {
        adjustEfficacy: true,
        efficacyMultiplier: multiplier,
        adjustWattage: false,
        wattageMultiplier: 1,
        message: `Simulated values are ${averageDifferencePercent.toFixed(1)}% higher. Consider reducing efficacy by ${((1 - multiplier) * 100).toFixed(1)}%.`,
      };
    } else if (simulatedLower && averageDifferencePercent > 10) {
      const multiplier = 1 + (averageDifferencePercent / 100);
      return {
        adjustEfficacy: true,
        efficacyMultiplier: multiplier,
        adjustWattage: false,
        wattageMultiplier: 1,
        message: `Simulated values are ${averageDifferencePercent.toFixed(1)}% lower. Consider increasing efficacy by ${((multiplier - 1) * 100).toFixed(1)}%.`,
      };
    }
    
    return {
      adjustEfficacy: false,
      efficacyMultiplier: 1,
      adjustWattage: false,
      wattageMultiplier: 1,
      message: 'Calibration appears accurate. No adjustments needed.',
    };
  }
}

// Export singleton instance
export const exposureValidationService = new ExposureValidationService();


