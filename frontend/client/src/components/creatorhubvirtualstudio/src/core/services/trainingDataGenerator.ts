/**
 * Training Data Generator
 *
 * Generates synthetic training data from cinematography patterns
 * for ML lighting recommendation model
 */

import { cinematographyPatternsService } from './cinematographyPatternsService';
import { qualityScoringService } from './qualityScoringService';

interface TrainingLight {
  id: string;
  type: string;
  name: string;
  position: [number, number, number];
  power: number;
  colorTemp: number;
  softness: number;
  castShadow: boolean;
  visible: boolean;
}

interface TrainingScene {
  nodes: TrainingLight[];
  selection: string[];
  environment: {
    showGrid: boolean;
    showAxes: boolean;
    backgroundColor: string;
    ambientLightIntensity: number;
  };
  units: 'metric' | 'imperial';
}

export interface TrainingExample {
  // Input features
  sceneContext: {
    subjectType: string;
    environment: string;
    mood: string;
    lightCount: number;
    hasKeyLight: boolean;
    hasFillLight: boolean;
    hasBackLight: boolean;
    avgLightPower: number;
    avgColorTemp: number;
  };
  currentLighting: {
    lights: Array<{
      type: string;
      position: [number, number, number];
      power: number;
      colorTemp: number;
      softness: number;
    }>;
  };

  // Output labels
  recommendedChanges: {
    addLights?: Array<{
      type: string;
      position: [number, number, number];
      power: number;
      colorTemp: number;
      softness: number;
    }>;
    modifyLights?: Array<{
      index: number;
      position?: [number, number, number];
      power?: number;
      colorTemp?: number;
      softness?: number;
    }>;
    removeLights?: number[];
  };
  patternSuggestion: string;

  // Quality metrics
  qualityBefore: number;
  qualityAfter: number;
  improvementScore: number;
}

class TrainingDataGenerator {
  /**
   * Generate training examples from all cinematography patterns
   */
  generateFromPatterns(variationsPerPattern: number = 100): TrainingExample[] {
    const examples: TrainingExample[] = [];
    const patterns = cinematographyPatternsService.getAllPatterns();

    for (const pattern of patterns) {
      for (let i = 0; i < variationsPerPattern; i++) {
        const example = this.generateVariation(pattern);
        examples.push(example);
      }
    }

    return examples;
  }

  /**
   * Generate a single training example with random variations
   */
  private generateVariation(pattern: any): TrainingExample {
    // Create "before" scene (suboptimal lighting)
    const beforeScene = this.createSuboptimalScene(pattern);
    const beforeQuality = this.calculateQuality(beforeScene);

    // Create "after" scene (optimal lighting from pattern)
    const afterScene = this.applyPattern(pattern);
    const afterQuality = this.calculateQuality(afterScene);

    // Extract features
    const sceneContext = this.extractSceneContext(beforeScene);
    const currentLighting = this.extractLighting(beforeScene);
    const recommendedChanges = this.calculateChanges(beforeScene, afterScene);

    return {
      sceneContext,
      currentLighting,
      recommendedChanges,
      patternSuggestion: pattern.slug,
      qualityBefore: beforeQuality,
      qualityAfter: afterQuality,
      improvementScore: afterQuality - beforeQuality,
    };
  }

  /**
   * Create a suboptimal lighting scene (for "before" state)
   */
  private createSuboptimalScene(_pattern: unknown): TrainingScene {
    const scene: TrainingScene = {
      nodes: [],
      selection: [],
      environment: {
        showGrid: true,
        showAxes: false,
        backgroundColor: '#1a1a1a',
        ambientLightIntensity: 0.1,
      },
      units: 'metric',
    };

    // Add 1-3 random lights with suboptimal settings
    const lightCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < lightCount; i++) {
      const light: TrainingLight = {
        id: `light-${i}`,
        type: 'point',
        name: `Light ${i + 1}`,
        position: [
          (Math.random() - 0.5) * 10,
          Math.random() * 5 + 1,
          (Math.random() - 0.5) * 10,
        ],
        power: Math.random() * 500 + 100, // 100-600W (often too low or too high)
        colorTemp: Math.random() * 2000 + 3000, // 3000-5000K (often wrong)
        softness: Math.random(), // Random softness
        castShadow: true,
        visible: true,
      };
      scene.nodes.push(light);
    }

    return scene;
  }

  /**
   * Apply cinematography pattern to create optimal scene
   */
  private applyPattern(pattern: {
    lights: Array<{
      type: string;
      position: [number, number, number];
      power: number;
      colorTemp: number;
      softness: number;
      castShadow?: boolean;
      visible?: boolean;
      name?: string;
    }>;
  }): TrainingScene {
    const scene: TrainingScene = {
      nodes: [],
      selection: [],
      environment: {
        showGrid: true,
        showAxes: false,
        backgroundColor: '#1a1a1a',
        ambientLightIntensity: 0.1,
      },
      units: 'metric',
    };

    // Apply pattern lights with small random variations
    for (const lightConfig of pattern.lights) {
      const light: TrainingLight = {
        ...lightConfig,
        id: `light-${scene.nodes.length}`,
        name: lightConfig.name ?? `Pattern Light ${scene.nodes.length + 1}`,
        position: [
          lightConfig.position[0] + (Math.random() - 0.5) * 0.5,
          lightConfig.position[1] + (Math.random() - 0.5) * 0.5,
          lightConfig.position[2] + (Math.random() - 0.5) * 0.5,
        ],
        power: lightConfig.power * (0.9 + Math.random() * 0.2), // ±10% variation
        colorTemp: lightConfig.colorTemp + (Math.random() - 0.5) * 200, // ±100K variation
        castShadow: lightConfig.castShadow ?? true,
        visible: lightConfig.visible ?? true,
      };
      scene.nodes.push(light);
    }

    return scene;
  }

  /**
   * Calculate quality score for a scene
   */
  private calculateQuality(scene: TrainingScene): number {
    const lights = scene.nodes;

    if (lights.length === 0) return 0;

    // Calculate quality metrics
    const metrics = qualityScoringService.calculateQualityScore(lights, {
      subjectPosition: [0, 1, 0],
      cameraPosition: [0, 1.6, 5],
    });

    return metrics.overallScore;
  }

  /**
   * Extract scene context features
   */
  private extractSceneContext(scene: TrainingScene): TrainingExample['sceneContext'] {
    const lights = scene.nodes;

    const hasKeyLight = lights.some((l) => l.power > 300);
    const hasFillLight = lights.some((l) => l.power > 100 && l.power < 300);
    const hasBackLight = lights.some((l) => l.position[2] < 0);

    const avgLightPower = lights.reduce((sum, l) => sum + l.power, 0) / lights.length;
    const avgColorTemp = lights.reduce((sum, l) => sum + l.colorTemp, 0) / lights.length;

    return {
      subjectType: 'portrait', // Default for now
      environment: 'studio', // Default for now
      mood: 'neutral', // Default for now
      lightCount: lights.length,
      hasKeyLight,
      hasFillLight,
      hasBackLight,
      avgLightPower,
      avgColorTemp,
    };
  }

  /**
   * Extract lighting configuration
   */
  private extractLighting(scene: TrainingScene): TrainingExample['currentLighting'] {
    const lights = scene.nodes;

    return {
      lights: lights.map((light) => ({
        type: light.type,
        position: light.position as [number, number, number],
        power: light.power,
        colorTemp: light.colorTemp,
        softness: light.softness,
      })),
    };
  }

  /**
   * Calculate changes between before and after scenes
   */
  private calculateChanges(
    beforeScene: TrainingScene,
    afterScene: TrainingScene
  ): TrainingExample['recommendedChanges'] {
    const beforeLights = beforeScene.nodes;
    const afterLights = afterScene.nodes;

    const changes: TrainingExample['recommendedChanges'] = {};

    // Lights to add
    if (afterLights.length > beforeLights.length) {
      changes.addLights = afterLights.slice(beforeLights.length).map((light) => ({
        type: light.type,
        position: light.position as [number, number, number],
        power: light.power,
        colorTemp: light.colorTemp,
        softness: light.softness,
      }));
    }

    // Lights to modify
    const modifyLights = [];
    for (let i = 0; i < Math.min(beforeLights.length, afterLights.length); i++) {
      const before = beforeLights[i];
      const after = afterLights[i];

      const positionChanged =
        Math.abs(before.position[0] - after.position[0]) > 0.1 ||
        Math.abs(before.position[1] - after.position[1]) > 0.1 ||
        Math.abs(before.position[2] - after.position[2]) > 0.1;

      const powerChanged = Math.abs(before.power - after.power) > 10;
      const colorTempChanged = Math.abs(before.colorTemp - after.colorTemp) > 100;
      const softnessChanged = Math.abs(before.softness - after.softness) > 0.05;

      if (positionChanged || powerChanged || colorTempChanged || softnessChanged) {
        modifyLights.push({
          index: i,
          ...(positionChanged && { position: after.position as [number, number, number] }),
          ...(powerChanged && { power: after.power }),
          ...(colorTempChanged && { colorTemp: after.colorTemp }),
          ...(softnessChanged && { softness: after.softness }),
        });
      }
    }

    if (modifyLights.length > 0) {
      changes.modifyLights = modifyLights;
    }

    // Lights to remove
    if (beforeLights.length > afterLights.length) {
      changes.removeLights = Array.from(
        { length: beforeLights.length - afterLights.length },
        (_, i) => afterLights.length + i
      );
    }

    return changes;
  }

  /**
   * Export training data to JSON format
   */
  exportToJSON(examples: TrainingExample[]): string {
    return JSON.stringify(examples, null, 2);
  }

  /**
   * Export training data to CSV format (for Python training)
   */
  exportToCSV(examples: TrainingExample[]): string {
    const headers = [
      'subjectType','environment','mood','lightCount','hasKeyLight','hasFillLight','hasBackLight','avgLightPower','avgColorTemp','patternSuggestion','qualityBefore','qualityAfter','improvementScore',
    ];

    const rows = examples.map((ex) => [
      ex.sceneContext.subjectType,
      ex.sceneContext.environment,
      ex.sceneContext.mood,
      ex.sceneContext.lightCount,
      ex.sceneContext.hasKeyLight ? 1 : 0,
      ex.sceneContext.hasFillLight ? 1 : 0,
      ex.sceneContext.hasBackLight ? 1 : 0,
      ex.sceneContext.avgLightPower,
      ex.sceneContext.avgColorTemp,
      ex.patternSuggestion,
      ex.qualityBefore,
      ex.qualityAfter,
      ex.improvementScore,
    ]);

    return [headers.join(''), ...rows.map((row) => row.join(', '))].join('\n');
  }
}

export const trainingDataGenerator = new TrainingDataGenerator();
