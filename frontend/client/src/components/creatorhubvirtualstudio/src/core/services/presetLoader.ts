/**
 * Preset Loader Service
 * 
 * Loads character poses and expressions from preset files
 * Similar to Set A Light 3D's .poselib and .expressionlib files
 */

import { logger } from './logger';
import type { PosePreset } from '../animation/PoseLibrary';

const log = logger.module('PresetLoader');

export interface PosePresetData {
  id: string;
  name: string;
  category: 'standing' | 'sitting' | 'lying' | 'other';
  description?: string;
  bones: Record<string, {
    rotation?: { x: number; y: number; z: number };
    position?: [number, number, number];
  }>;
}

export interface ExpressionPresetData {
  id: string;
  name: string;
  category: 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'other';
  description?: string;
  blendShapes?: Record<string, number>; // Blend shape name -> weight (0-1)
  boneRotations?: Record<string, { x: number; y: number; z: number }>; // For bone-based expressions
}

export class PresetLoader {
  /**
   * Load pose preset from JSON file
   */
  async loadPosePreset(presetId: string): Promise<PosePresetData | null> {
    try {
      const response = await fetch(`/assets/presets/poses/${presetId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load pose preset: ${response.statusText}`);
      }
      
      const preset: PosePresetData = await response.json();
      return preset;
    } catch (error) {
      log.error(`Failed to load pose preset ${presetId}:`, error);
      return null;
    }
  }
  
  /**
   * Load expression preset from JSON file
   */
  async loadExpressionPreset(presetId: string): Promise<ExpressionPresetData | null> {
    try {
      const response = await fetch(`/assets/presets/expressions/${presetId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load expression preset: ${response.statusText}`);
      }
      
      const preset: ExpressionPresetData = await response.json();
      return preset;
    } catch (error) {
      log.error(`Failed to load expression preset ${presetId}:`, error);
      return null;
    }
  }
  
  /**
   * Get available pose preset IDs
   */
  getAvailablePosePresets(): string[] {
    return [
      'standing_neutral',
      'standing_confident',
      'standing_casual',
      'sitting_neutral',
      'sitting_relaxed',
      'sitting_formal',
      'lying_back',
      'lying_side',
    ];
  }
  
  /**
   * Get available expression preset IDs
   */
  getAvailableExpressionPresets(): string[] {
    return [
      'happy',
      'sad',
      'angry',
      'surprised',
      'neutral',
      'smile',
      'frown',
      'wink',
    ];
  }
  
  /**
   * Convert pose preset data to PosePreset format
   */
  convertToPosePreset(data: PosePresetData): Partial<PosePreset> {
    return {
      id: data.id,
      name: data.name,
      category: data.category === 'standing' ? 'portrait' : 
                data.category === 'sitting' ? 'commercial' : 'editorial',
      description: data.description,
      difficulty: 'beginner',
      pose: {
        name: data.id,
        bones: Object.fromEntries(
          Object.entries(data.bones).map(([boneName, boneData]) => [
            boneName,
            {
              rotation: boneData.rotation || { x: 0, y: 0, z: 0 },
              position: boneData.position || [0, 0, 0],
            },
          ])
        ),
      },
    };
  }
}

// Export singleton instance
export const presetLoader = new PresetLoader();


