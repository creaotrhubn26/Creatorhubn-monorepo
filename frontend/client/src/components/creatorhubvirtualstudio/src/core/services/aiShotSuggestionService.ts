/**
 * AI Shot Suggestion Service
 * 
 * Analyzes current setup and suggests alternative camera angles,
 * lighting setups, and composition variations
 */

import { sam2Service } from '@/services/SAM2Service';
import { sceneCompositionService } from './sceneCompositionService';

export interface ShotSuggestion {
  id: string;
  name: string;
  type: 'angle' | 'lighting' | 'composition';
  description: string;
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number];
  lightingAdjustments?: Array<{
    lightId: string;
    position?: [number, number, number];
    intensity?: number;
  }>;
  expectedScore: number;
  preview?: string; // Base64 preview image
}

export class AIShotSuggestionService {
  /**
   * Generate shot suggestions based on current scene
   */
  async generateSuggestions(imageUrl: string, currentSceneData?: any): Promise<ShotSuggestion[]> {
    const suggestions: ShotSuggestion[] = [];

    // Analyze current composition
    const composition = await sceneCompositionService.analyzeComposition(imageUrl);

    // Detect subjects
    const segmentation = await sam2Service.segmentImageFromUrl(
      imageUrl,
      undefined'auto','small'
    );

    // Generate alternative angles
    if (composition.score.ruleOfThirds < 70) {
      suggestions.push({
        id: 'angle_rule_thirds',
        name: 'Rule of Thirds Angle',
        type: 'angle',
        description: 'Reposition camera to align subject with rule of thirds',
        cameraPosition: [0.3, 1.65, 2.5], // Slight left offset
        cameraRotation: [0, -5, 0], // Slight rotation
        expectedScore: Math.min(100, composition.score.overall + 15),
      });
    }

    // Low angle suggestion
    suggestions.push({
      id: 'angle_low',
      name: 'Low Angle Shot',
      type: 'angle',
      description: 'Dramatic low angle for more impact',
      cameraPosition: [0, 1.2, 2.5], // Lower camera
      cameraRotation: [10, 0, 0], // Tilt up
      expectedScore: composition.score.overall + 5,
    });

    // High angle suggestion
    suggestions.push({
      id: 'angle_high',
      name: 'High Angle Shot',
      type: 'angle',
      description: 'High angle for a more flattering perspective',
      cameraPosition: [0, 2.0, 2.5], // Higher camera
      cameraRotation: [-5, 0, 0], // Tilt down
      expectedScore: composition.score.overall + 3,
    });

    // Lighting suggestions
    if (composition.score.balance < 60) {
      suggestions.push({
        id: 'lighting_balanced',
        name: 'Balanced Lighting',
        type: 'lighting',
        description: 'Add fill light to balance the scene',
        cameraPosition: [0, 1.65, 2.5],
        cameraRotation: [0, 0, 0],
        lightingAdjustments: [
          {
            lightId: 'fill_light',
            position: [1.0, 1.5, 2.0],
            intensity: 0.3,
          },
        ],
        expectedScore: composition.score.overall + 10,
      });
    }

    // Composition variation
    suggestions.push({
      id: 'composition_centered',
      name: 'Centered Composition',
      type: 'composition',
      description: 'Try a centered, symmetrical composition',
      cameraPosition: [0, 1.65, 2.5],
      cameraRotation: [0, 0, 0],
      expectedScore: composition.score.symmetry > 70 ? composition.score.overall + 5 : composition.score.overall - 5,
    });

    // Sort by expected score (highest first)
    suggestions.sort((a, b) => b.expectedScore - a.expectedScore);

    return suggestions;
  }

  /**
   * Get preview for a shot suggestion
   */
  async getShotPreview(suggestion: ShotSuggestion, imageUrl: string): Promise<string> {
    // In production, would render preview with suggested camera/lighting
    // For now, return placeholder
    return'';
  }
}

export const aiShotSuggestionService = new AIShotSuggestionService();


























