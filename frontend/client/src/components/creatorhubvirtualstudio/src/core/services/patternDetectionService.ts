/**
 * Pattern Detection Service
 * 
 * Detects lighting patterns from light positions and provides contextual tips
 */

import { logger } from './logger';

const log = logger.module('PatternDetection, ');
const API_BASE = '/api/smart-lighting, ';

export interface DetectedPattern {
  id: string;
  name: string;
  slug: string;
  role: string;
  expectedAngle: number;
  actualAngle: number;
  distance: number;
  confidence: number;
}

export interface PatternTips {
  name: string;
  slug: string;
  description: string;
  whenToUse: string;
  setupInstructions: string[];
  recommendedModifiers: string[];
  subjectOrientation: string;
  subjectDistance: number;
  shadowRules: string;
}

export interface LightPlacementTip {
  category: 'positioning' | 'power' | 'modifier' | 'angle' | 'height';
  title: string;
  description: string;
  icon: string;
}

class PatternDetectionService {
  /**
   * Detect which lighting pattern a light position matches
   */
  async detectPattern(
    lightPosition: [number, number, number],
    subjectPosition: [number, number, number] = [0, 0, 0],
    threshold: number = 0.5
  ): Promise<{
    detected: boolean;
    pattern?: DetectedPattern;
    alternatives?: DetectedPattern[];
  }> {
    try {
      const [x, y, z] = lightPosition;
      const [subjectX, subjectY, subjectZ] = subjectPosition;

      const params = new URLSearchParams({
        x: x.toString(),
        y: y.toString(),
        z: z.toString(),
        subjectX: subjectX.toString(),
        subjectY: subjectY.toString(),
        subjectZ: subjectZ.toString(),
        threshold: threshold.toString(),
      });

      const response = await fetch(`${API_BASE}/detect-pattern?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to detect pattern: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      log.error('Error detecting pattern: ', error);
      return { detected: false };
    }
  }

  /**
   * Get contextual tips for a specific pattern
   */
  async getPatternTips(patternId: string, role?: string): Promise<PatternTips | null> {
    try {
      const params = role ? `?role=${role}` : ', ';
      const response = await fetch(`${API_BASE}/pattern-tips/${patternId}${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pattern tips: ${response.statusText}`);
      }

      const data = await response.json();
      return data.pattern || null;
    } catch (error) {
      log.error('Error fetching pattern tips: ', error);
      return null;
    }
  }

  /**
   * Calculate angle from subject to light (in degrees)
   */
  calculateAngle(
    lightPosition: [number, number, number],
    subjectPosition: [number, number, number] = [0, 0, 0]
  ): number {
    const [lx, lz] = lightPosition;
    const [sx, sz] = subjectPosition;

    const dx = lx - sx;
    const dz = lz - sz;

    // Calculate angle in radians using atan2
    const angleRad = Math.atan2(dx, dz);

    // Convert to degrees
    let angleDeg = (angleRad * 180) / Math.PI;

    // Normalize to 0-360
    if (angleDeg < 0) {
      angleDeg += 360;
    }

    return Math.round(angleDeg);
  }

  /**
   * Calculate distance between two 3D points
   */
  calculateDistance(
    point1: [number, number, number],
    point2: [number, number, number]
  ): number {
    const [x1, y1, z1] = point1;
    const [x2, y2, z2] = point2;

    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2));
  }

  /**
   * Generate contextual tips based on detected pattern and light properties
   */
  generateLightPlacementTips(
    detectedPattern: DetectedPattern | null,
    lightPosition: [number, number, number],
    lightProperties?: { power?: number; beam?: number; modifier?: string }
  ): LightPlacementTip[] {
    const tips: LightPlacementTip[] = [];

    if (detectedPattern) {
      // Pattern-specific tips
      tips.push({
        category: 'positioning',
        title: `${detectedPattern.name} - ${detectedPattern.role}`,
        description: `You're placing a ${detectedPattern.role.replace('_', ', ')} at ${detectedPattern.actualAngle}° (expected: ${detectedPattern.expectedAngle}°)`,
        icon: '🎯',
      });

      if (detectedPattern.confidence > 0.8) {
        tips.push({
          category: 'positioning',
          title: 'Perfect Position!',
          description: `This matches the ${detectedPattern.name} pattern with ${Math.round(detectedPattern.confidence * 100)}% confidence`,
          icon: '✅',
        });
      } else if (detectedPattern.confidence > 0.5) {
        tips.push({
          category: 'positioning',
          title: 'Close to Pattern',
          description: `Move ${detectedPattern.distance.toFixed(2)}m closer to match ${detectedPattern.name} exactly`,
          icon: '📍',
        });
      }
    }

    // Height tips
    const height = lightPosition[1];
    if (height < 1.0) {
      tips.push({
        category: 'height',
        title: 'Low Light Position',
        description: 'Light is below eye level. Good for dramatic upward shadows.',
        icon: '⬇️',
      });
    } else if (height > 2.5) {
      tips.push({
        category: 'height',
        title: 'High Light Position',
        description: 'Light is well above subject. Creates downward shadows like natural sunlight.',
        icon: '⬆️',
      });
    } else {
      tips.push({
        category: 'height',
        title: 'Eye-Level Light',
        description: 'Light is at eye level. Adjust 20-40cm higher for flattering portraits.',
        icon: '↕️',
      });
    }

    // Power tips
    if (lightProperties?.power) {
      if (lightProperties.power < 0.3) {
        tips.push({
          category: 'power',
          title: 'Low Power',
          description: 'Increase power for brighter light or use as subtle fill.',
          icon: '🔅',
        });
      } else if (lightProperties.power > 0.7) {
        tips.push({
          category: 'power',
          title: 'High Power',
          description: 'Strong light. Consider reducing power or moving light further away.',
          icon: '🔆',
        });
      }
    }

    // Modifier tips
    if (lightProperties?.modifier) {
      const modifierTips: Record<string, string> = {
        softbox: 'Softbox creates soft, even light. Position close to subject for softer shadows.',
        octabox: 'Octabox produces beautiful round catchlights. Perfect for beauty and fashion.',
        beauty_dish: 'Beauty dish creates focused, sculpted light. Great for beauty shots.',
        umbrella: 'Umbrella spreads light widely. Budget-friendly option for soft light.',
        grid: 'Grid focuses light into narrow beam. Great for hair lights and accents.',
        reflector: 'Reflector creates hard, direct light. Use for dramatic effects.',
      };

      const tip = modifierTips[lightProperties.modifier];
      if (tip) {
        tips.push({
          category: 'modifier',
          title: `${lightProperties.modifier.replace('_', ', ')} Usage`,
          description: tip,
          icon: '📦',
        });
      }
    }

    return tips;
  }
}

export const patternDetectionService = new PatternDetectionService();

