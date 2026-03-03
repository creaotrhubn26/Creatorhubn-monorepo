/**
 * AI Vision Integration for Virtual Studio
 *
 * Connects the Virtual Studio with the main app, 's AI Vision service
 * to provide intelligent lighting setup recommendations based on reference photos.
 */

import { AIVisionService, PhotoAnalysis } from '@/services/ai-vision-service';
import { Scene, SceneNode, LightProps } from '../models/scene';
import { logger } from './logger';

const log = logger.module('AIIntegration, ');

export interface LightingRecommendation {
  setup: 'key-fill-rim' | 'natural' | 'dramatic' | 'soft' | 'high-key' | 'low-key';
  lights: Array<{
    type: 'softbox' | 'umbrella' | 'spot' | 'reflector';
    position: [number, number, number];
    power: number;
    cct: number;
    modifier?: string;
    modifierSize?: [number, number];
    purpose: 'key' | 'fill' | 'rim' | 'background' | 'hair';
  }>;
  environment: {
    wallColor: string;
    floorColor: string;
  };
  rationale: string;
  confidence: number;
}

export interface SceneAnalysisResult {
  original: PhotoAnalysis;
  recommendation: LightingRecommendation;
  estimatedCost?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  setupTime: number; // minutes
}

/**
 * Analyze a reference photo and suggest Virtual Studio lighting setup
 */
export async function analyzeReferencePhoto(
  imageFile: File | Blob | string,
): Promise<SceneAnalysisResult> {
  log.info('Analyzing reference photo for lighting setup...');

  // Convert to appropriate format
  let imageData: Blob;
  if (typeof imageFile === 'string') {
    const response = await fetch(imageFile);
    imageData = await response.blob();
  } else {
    imageData = imageFile;
  }

  // Use AI Vision service
  const analysis = await AIVisionService.analyzePhoto(imageData, {
    includeComposition: true,
    includeQuality: true,
  });

  // Generate lighting recommendation based on analysis
  const recommendation = generateLightingRecommendation(analysis);

  return {
    original: analysis,
    recommendation,
    difficulty: calculateDifficulty(recommendation),
    setupTime: estimateSetupTime(recommendation),
  };
}

/**
 * Generate lighting setup recommendations based on photo analysis
 */
function generateLightingRecommendation(analysis: PhotoAnalysis): LightingRecommendation {
  const { scene, quality } = analysis;

  // Determine setup type based on scene characteristics
  let setup: LightingRecommendation['setup'];
  let lights: LightingRecommendation['lights'] = [];
  let rationale = '';

  // Indoor studio detection
  if (scene.type === 'studio' || scene.type === 'indoor') {
    if (scene.lighting === 'bright' || scene.lighting === 'artificial') {
      // High-key or professional studio setup
      setup = 'high-key';
      rationale =
        'Detected bright indoor/studio lighting. Recommending high-key setup with soft, even illumination.';

      lights = [
        {
          type: 'softbox',
          position: [-2.2, 1.6, 1.5],
          power: 0.65,
          cct: 5600,
          modifier: 'softbox',
          modifierSize: [0.9, 0.9],
          purpose: 'key',
        },
        {
          type: 'softbox',
          position: [2.2, 1.6, 1.5],
          power: 0.35,
          cct: 5600,
          modifier: 'softbox',
          modifierSize: [0.6, 0.6],
          purpose: 'fill',
        },
        {
          type: 'softbox',
          position: [0, 1.8, -1.5],
          power: 0.45,
          cct: 5600,
          modifier: 'softbox',
          modifierSize: [1.2, 0.6],
          purpose: 'background',
        },
      ];
    } else if (scene.lighting === 'low') {
      // Dramatic/moody setup
      setup = 'dramatic';
      rationale =
        'Detected low-key indoor lighting. Recommending dramatic single-source setup with rim lighting.';

      lights = [
        {
          type: 'softbox',
          position: [-2.0, 1.5, 1.2],
          power: 0.75,
          cct: 4800,
          modifier: 'softbox',
          modifierSize: [0.6, 0.6],
          purpose: 'key',
        },
        {
          type: 'spot',
          position: [1.8, 1.8, -0.5],
          power: 0.55,
          cct: 5600,
          purpose: 'rim',
        },
      ];
    } else {
      // Soft natural-looking indoor
      setup = 'soft';
      rationale =
        'Detected natural indoor lighting. Recommending soft, natural-looking studio setup.';

      lights = [
        {
          type: 'softbox',
          position: [-1.8, 1.6, 1.3],
          power: 0.55,
          cct: 5200,
          modifier: 'softbox',
          modifierSize: [0.9, 0.9],
          purpose: 'key',
        },
        {
          type: 'reflector',
          position: [1.5, 1.2, 1.0],
          power: 0.25,
          cct: 5200,
          purpose: 'fill',
        },
      ];
    }
  }
  // Outdoor natural light
  else if (
    scene.type === 'outdoor' &&
    (scene.lighting === 'natural' ||
      scene.lighting === 'golden-hour' ||
      scene.lighting === 'sunset')
  ) {
    setup = 'natural';
    rationale =
      'Detected outdoor natural lighting. Recommending natural-style setup mimicking outdoor conditions.';

    const cct = scene.lighting === 'golden-hour' || scene.lighting === 'sunset' ? 3800 : 5600;

    lights = [
      {
        type: 'softbox',
        position: [-2.5, 2.0, 1.8],
        power: 0.7,
        cct,
        modifier: 'softbox',
        modifierSize: [1.2, 1.2],
        purpose: 'key',
      },
      {
        type: 'reflector',
        position: [2.0, 1.0, 1.2],
        power: 0.2,
        cct,
        purpose: 'fill',
      },
    ];
  }
  // Default: balanced 3-point lighting
  else {
    setup = 'key-fill-rim';
    rationale = 'Standard scene detected. Recommending classic 3-point lighting setup.';

    lights = [
      {
        type: 'softbox',
        position: [-2.0, 1.6, 1.4],
        power: 0.6,
        cct: 5600,
        modifier: 'softbox',
        modifierSize: [0.8, 0.8],
        purpose: 'key',
      },
      {
        type: 'umbrella',
        position: [2.2, 1.4, 1.2],
        power: 0.3,
        cct: 5600,
        purpose: 'fill',
      },
      {
        type: 'spot',
        position: [1.5, 1.8, -0.8],
        power: 0.45,
        cct: 5600,
        purpose: 'rim',
      },
    ];
  }

  // Environment colors based on scene
  const environment = {
    wallColor: scene.type === 'studio' ? '#ffffff' : '#f5f5f0',
    floorColor: scene.type === 'studio' ? '#e8e8e8' : '#d4d4c8',
  };

  return {
    setup,
    lights,
    environment,
    rationale,
    confidence: scene.confidence,
  };
}

/**
 * Apply AI-recommended lighting to current scene
 */
export function applyLightingRecommendation(
  currentScene: Scene,
  recommendation: LightingRecommendation,
): Scene {
  log.info('Applying AI lighting recommendation...');

  // Remove existing lights (keep camera, model, backdrop)
  const nonLightNodes = currentScene.nodes.filter(
    (n) =>
      n.type !== 'softbox' && n.type !== 'umbrella' && n.type !== 'spot' && n.type !== 'reflector',
  );

  // Create new light nodes from recommendation
  const newLightNodes: SceneNode[] = recommendation.lights.map((light, idx) => ({
    id: `ai-light-${idx}`,
    type: light.type,
    name: `${light.purpose.charAt(0).toUpperCase() + light.purpose.slice(1)} Light, `,
    visible: true,
    transform: {
      position: light.position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    light: {
      power: light.power,
      cct: light.cct,
      beam: light.type === 'spot' ? 28 : 60,
      modifier: light.modifier as any,
      modifierSize: light.modifierSize,
    },
    userData: {
      aiGenerated: true,
      purpose: light.purpose,
      recommendation: recommendation.setup,
    },
  }));

  // Update environment
  const updatedEnvironment = {
    ...currentScene.environment,
    room: {
      ...currentScene.environment.room!,
      wallColor: recommendation.environment.wallColor,
      floorColor: recommendation.environment.floorColor,
    },
  };

  return {
    ...currentScene,
    nodes: [...nonLightNodes, ...newLightNodes],
    environment: updatedEnvironment,
    selection: [newLightNodes[0]?.id || ', '],
  };
}

/**
 * Calculate setup difficulty
 */
function calculateDifficulty(
  recommendation: LightingRecommendation,
): 'beginner' | 'intermediate' | 'advanced' | 'professional' {
  const lightCount = recommendation.lights.length;

  if (lightCount <= 1) return 'beginner';
  if (lightCount === 2) return 'intermediate';
  if (lightCount === 3) return 'advanced';
  return 'professional';
}

/**
 * Estimate setup time in minutes
 */
function estimateSetupTime(recommendation: LightingRecommendation): number {
  const baseTime = 10; // Base setup time
  const perLightTime = 5; // Minutes per light
  const modifierTime = recommendation.lights.filter((l) => l.modifier).length * 3;

  return baseTime + recommendation.lights.length * perLightTime + modifierTime;
}

/**
 * Compare current scene with reference photo
 * Returns similarity score and suggestions
 */
export async function compareSceneWithReference(
  currentScene: Scene,
  referencePhotoUrl: string,
): Promise<{
  similarity: number;
  suggestions: string[];
  missingElements: string[];
  excessElements: string[];
}> {
  const analysis = await analyzeReferencePhoto(referencePhotoUrl);
  const recommendation = analysis.recommendation;

  // Count lights by purpose in current scene
  const currentLights = currentScene.nodes.filter(
    (n) =>
      n.type === 'softbox' || n.type === 'umbrella' || n.type === 'spot' || n.type ==='reflector',
  );

  const suggestions: string[] = [];
  const missingElements: string[] = [];
  const excessElements: string[] = [];

  // Compare light count
  if (currentLights.length < recommendation.lights.length) {
    missingElements.push(`${recommendation.lights.length - currentLights.length} more light(s)`);
    suggestions.push(
      `Add ${recommendation.lights.length - currentLights.length} more light(s) to match reference`,
    );
  } else if (currentLights.length > recommendation.lights.length) {
    excessElements.push(`${currentLights.length - recommendation.lights.length} extra light(s)`);
  }

  // Calculate similarity (0-1)
  const lightCountSimilarity =
    1 -
    Math.abs(currentLights.length - recommendation.lights.length) /
      Math.max(currentLights.length, recommendation.lights.length, 1);
  const similarity = lightCountSimilarity * 100;

  return {
    similarity,
    suggestions,
    missingElements,
    excessElements,
  };
}
