/**
 * Lighting ML Service (Frontend)
 * 
 * Loads and runs the trained TensorFlow.js model in the browser
 * for real-time lighting recommendations
 */

import * as tf from '@tensorflow/tfjs';
import { logger } from './logger';

const log = logger.module('LightingML');

export interface SceneFeatures {
  subjectType: 'portrait' | 'product' | 'commercial';
  environment: 'studio' | 'outdoor' | 'indoor';
  mood: 'neutral' | 'dramatic' | 'soft';
  lightCount: number;
  hasKeyLight: boolean;
  hasFillLight: boolean;
  hasBackLight: boolean;
  avgLightPower: number;
  avgColorTemp: number;
}

export interface MLRecommendation {
  patternSuggestion: string;
  confidence: number;
  adjustments: {
    addLights?: number;
    modifyPower?: number;
    modifyColorTemp?: number;
    modifySoftness?: number;
  };
  expectedQualityImprovement: number;
}

class LightingMLService {
  private model: tf.LayersModel | null = null;
  private modelLoaded: boolean = false;
  private modelVersion: string = 'v1.0.0';

  /**
   * Initialize and load the trained model
   */
  async initialize(): Promise<void> {
    if (this.modelLoaded) {
      log.debug('ML model already loaded');
      return;
    }

    try {
      log.info('Loading ML model from server...');
      
      // Load model from public directory
      this.model = await tf.loadLayersModel(`/models/lighting-recommendation-${this.modelVersion}/model.json`);
      
      this.modelLoaded = true;
      log.info('ML model loaded successfully');
    } catch (error) {
      log.error('Failed to load ML model: ', error);
      log.warn('Falling back to heuristic-based recommendations');
      this.modelLoaded = false;
    }
  }

  /**
   * Get ML-powered lighting recommendation
   */
  async predict(features: SceneFeatures): Promise<MLRecommendation> {
    if (!this.modelLoaded || !this.model) {
      throw new Error('ML model not loaded. Call initialize() first.');
    }

    // Encode features
    const inputVector = [
      this.encodeSubjectType(features.subjectType),
      this.encodeEnvironment(features.environment),
      this.encodeMood(features.mood),
      features.lightCount / 10, // Normalize to 0-1
      features.hasKeyLight ? 1 : 0,
      features.hasFillLight ? 1 : 0,
      features.hasBackLight ? 1 : 0,
      features.avgLightPower / 1000, // Normalize to 0-1
      (features.avgColorTemp - 2000) / 8000, // Normalize to 0-1
    ];

    // Create tensor and predict
    const inputTensor = tf.tensor2d([inputVector]);
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    // Get top prediction
    const patternMap = this.getPatternMap();
    const patternNames = Object.keys(patternMap);
    const maxIndex = Array.from(probabilities).indexOf(Math.max(...Array.from(probabilities)));
    const confidence = probabilities[maxIndex];

    return {
      patternSuggestion: patternNames[maxIndex],
      confidence,
      adjustments: this.calculateAdjustments(features),
      expectedQualityImprovement: confidence * 30, // Rough estimate
    };
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.modelLoaded;
  }

  /**
   * Calculate recommended adjustments
   */
  private calculateAdjustments(features: SceneFeatures): MLRecommendation['adjustments'] {
    const adjustments: MLRecommendation['adjustments'] = {};

    // Recommend adding lights if too few
    if (features.lightCount < 3) {
      adjustments.addLights = 3 - features.lightCount;
    }

    // Recommend power adjustment
    if (features.avgLightPower < 300) {
      adjustments.modifyPower = 1.5; // Increase by 50%
    } else if (features.avgLightPower > 700) {
      adjustments.modifyPower = 0.7; // Decrease by 30%
    }

    // Recommend color temp adjustment
    if (features.avgColorTemp < 4000) {
      adjustments.modifyColorTemp = 500; // Increase by 500K
    } else if (features.avgColorTemp > 7000) {
      adjustments.modifyColorTemp = -500; // Decrease by 500K
    }

    return adjustments;
  }

  // Helper encoding methods
  private encodeSubjectType(type: string): number {
    const map: Record<string, number> = { portrait: 0, product: 1, commercial: 2 };
    return map[type] || 0;
  }

  private encodeEnvironment(env: string): number {
    const map: Record<string, number> = { studio: 0, outdoor: 1, indoor: 2 };
    return map[env] || 0;
  }

  private encodeMood(mood: string): number {
    const map: Record<string, number> = { neutral: 0, dramatic: 1, soft: 2 };
    return map[mood] || 0;
  }

  private getPatternMap(): Record<string, number> {
    return {
      'three-point-lighting': 0,
      'rembrandt-lighting': 1,
      'butterfly-lighting': 2,
      'loop-lighting': 3,
      'split-lighting': 4,
      'broad-lighting': 5,
      'short-lighting': 6,
      'rim-lighting': 7,
      'high-key-lighting': 8,
      'low-key-lighting': 9,
      chiaroscuro: 10,
      'flat-lighting': 11,
      'side-lighting': 12,
      'top-lighting': 13,
      'bottom-lighting': 14,
      'cross-lighting': 15,
      'motivated-lighting': 16,
      'practical-lighting': 17,
      'natural-window-light': 18,
      'golden-hour': 19,
      'blue-hour': 20,
      'noir-lighting': 21,
    };
  }
}

export const lightingMLService = new LightingMLService();
