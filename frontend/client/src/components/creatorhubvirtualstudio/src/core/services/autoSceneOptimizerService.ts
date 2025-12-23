/**
 * Auto Scene Optimizer Service
 * 
 * Analyzes entire scene and suggests optimizations for:
 * - Camera position
 * - Light positioning and intensity
 * - Subject positioning
 * - Background adjustments
 */

import { sam2Service } from '@/services/SAM2Service';
import { sceneCompositionService } from './sceneCompositionService';

export interface SceneOptimization {
  camera: {
    position: [number, number, number];
    rotation: [number, number, number];
    suggested: boolean;
  };
  lights: Array<{
    id: string;
    position: [number, number, number];
    intensity: number;
    suggested: boolean;
  }>;
  subjects: Array<{
    id: string;
    position: [number, number, number];
    suggested: boolean;
  }>;
  background: {
    adjustments: string[];
    suggested: boolean;
  };
  overallScore: number;
  expectedImprovement: number;
}

export class AutoSceneOptimizerService {
  /**
   * Optimize entire scene
   */
  async optimizeScene(imageUrl: string, currentSceneData?: any): Promise<SceneOptimization> {
    // Analyze composition
    const composition = await sceneCompositionService.analyzeComposition(imageUrl);

    // Detect subjects
    const segmentation = await sam2Service.segmentImageFromUrl(
      imageUrl,
      undefined'auto','small'
    );

    // Generate optimization suggestions
    const optimization: SceneOptimization = {
      camera: {
        position: [0, 1.65, 2.5],
        rotation: [0, 0, 0],
        suggested: composition.score.overall < 70,
      },
      lights: [],
      subjects: [],
      background: {
        adjustments: [],
        suggested: false,
      },
      overallScore: composition.score.overall,
      expectedImprovement: Math.max(0, 85 - composition.score.overall),
    };

    // Camera suggestions based on composition
    if (composition.score.ruleOfThirds < 60) {
      optimization.camera.position = [0.2, 1.65, 2.5]; // Slight offset for rule of thirds
      optimization.camera.suggested = true;
    }

    // Subject positioning suggestions
    if (segmentation.masks && segmentation.masks.length > 0) {
      segmentation.masks.forEach((mask, idx) => {
        const [x, y, w, h] = mask.bbox;
        const [width, height] = segmentation.image_size;
        
        // Suggest optimal position (rule of thirds)
        const optimalX = width * 0.33; // Left third
        const optimalY = height * 0.33; // Top third
        
        optimization.subjects.push({
          id: `subject_${idx}`,
          position: [
            (optimalX - x) / 100, // Convert to 3D coordinates (simplified)
            (optimalY - y) / 100,
            0,
          ],
          suggested: Math.abs(x - optimalX) > width * 0.1 || Math.abs(y - optimalY) > height * 0.1,
        });
      });
    }

    // Background suggestions
    if (composition.score.balance < 50) {
      optimization.background.adjustments.push('Consider simplifying background for better balance');
      optimization.background.suggested = true;
    }

    return optimization;
  }

  /**
   * Get optimization preview
   */
  async getOptimizationPreview(imageUrl: string): Promise<{
    before: { score: number };
    after: { score: number; expected: number };
  }> {
    const composition = await sceneCompositionService.analyzeComposition(imageUrl);
    const optimization = await this.optimizeScene(imageUrl);

    return {
      before: {
        score: composition.score.overall,
      },
      after: {
        score: composition.score.overall,
        expected: composition.score.overall + optimization.expectedImprovement,
      },
    };
  }
}

export const autoSceneOptimizerService = new AutoSceneOptimizerService();


























