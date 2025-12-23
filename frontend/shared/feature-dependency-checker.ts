/**
 * 🔗 Feature Dependency Checker
 * Validates feature dependencies and provides user-friendly warnings
 */

import { PROFESSION_FEATURE_MATRIX } from './profession-feature-matrix';

export interface DependencyCheckResult {
  isValid: boolean;
  missingDependencies: string[];
  warnings: string[];
  suggestedActions: SuggestedAction[];
}

export interface SuggestedAction {
  type: 'enable_feature' | 'upgrade_plan' | 'warning_only';
  featureId: string;
  featureName: string;
  plan: 'basic' | 'pro' | 'enterprise';
  description: string;
}

/**
 * Check if a feature's dependencies are met
 */
export function checkFeatureDependencies(
  featureId: string,
  profession: string,
  enabledFeatures: Set<string>,
): DependencyCheckResult {
  const result: DependencyCheckResult = {
    isValid: true,
    missingDependencies: [],
    warnings: [],
    suggestedActions: [],
  };

  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];
  if (!professionConfig) {
    result.isValid = false;
    result.warnings.push(`Invalid profession: ${profession}`);
    return result;
  }

  const feature = professionConfig.availableFeatures[featureId];
  if (!feature) {
    result.isValid = false;
    result.warnings.push(`Feature not found: ${featureId}`);
    return result;
  }

  // Check dependencies
  if (feature.dependencies && feature.dependencies.length > 0) {
    for (const depId of feature.dependencies) {
      if (!enabledFeatures.has(depId)) {
        result.isValid = false;
        result.missingDependencies.push(depId);

        const depFeature = professionConfig.availableFeatures[depId];
        if (depFeature) {
          result.suggestedActions.push({
            type: depFeature.plan === 'basic' ? 'enable_feature' : 'upgrade_plan',
            featureId: depId,
            featureName: getFeatureName(depId),
            plan: depFeature.plan,
            description: depFeature.description,
          });

          result.warnings.push(
            `⚠️ "${getFeatureName(featureId)}" requires "${getFeatureName(depId)}" (${depFeature.plan} plan)`,
          );
        }
      }
    }
  }

  return result;
}

/**
 * Get all features that depend on a given feature
 */
export function getDependentFeatures(featureId: string, profession: string): string[] {
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];
  if (!professionConfig) return [];

  const dependents: string[] = [];

  for (const [fId, fConfig] of Object.entries(professionConfig.availableFeatures)) {
    if (fConfig.dependencies && fConfig.dependencies.includes(featureId)) {
      dependents.push(fId);
    }
  }

  return dependents;
}

/**
 * Build dependency graph for a profession
 */
export function buildDependencyGraph(profession: string): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];

  if (!professionConfig) return graph;

  for (const [featureId, config] of Object.entries(professionConfig.availableFeatures)) {
    graph.set(featureId, config.dependencies || []);
  }

  return graph;
}

/**
 * Get user-friendly feature name
 */
function getFeatureName(featureId: string): string {
  const names: Record<string, string> = {
    'story-arc-studio': 'Story Arc Studio',
    'real-video-playback': 'Real Video Playback',
    'frame-accurate-editing': 'Frame-Accurate Editing',
    'multitrack-timeline': 'Multi-Track Timeline',
    'jkl-controls': 'J/K/L Controls',
    '485-transitions': '485 Transitions',
    'text-overlays': 'Text Overlays',
    'speed-ramps': 'Speed Ramps',
    'color-grading': 'Color Grading',
    'gpu-filters': 'GPU Filters',
    'mobile-export-presets': 'Mobile Export Presets',
    'mp4-muxer-export': 'MP4 Muxer Export',
    'video-editor-workflow': 'Video Editor Workflow',
    'video-google-drive-import': 'Google Drive Import',
    '627-luts': '627 LUTs',
    'ai-story-generation': 'AI Story Generation',
    'cultural-ai-analysis': 'Cultural AI Analysis',
    'emotional-pacing': 'Emotional Pacing',
    '3-act-structure': '3-Act Structure',
    'cultural-luts': 'Cultural LUTs',
    'script-luts': 'Script LUTs',
    'professional-waveforms': 'Professional Waveforms',
    'beat-detection': 'Beat Detection',
    'auto-captions': 'Auto-Captions',
    'davinci-resolve-export': 'DaVinci Resolve Export',
    'video-worklog-automation': 'Video Worklog Automation',
    'optical-flow': 'Optical Flow',
    'background-removal': 'Background Removal',
    'hls-import': 'HLS Import',
    'custom-fonts': 'Custom Fonts',
  };

  return (
    names[featureId] ||
    featureId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

/**
 * Generate user-friendly error message
 */
export function generateDependencyErrorMessage(
  featureId: string,
  checkResult: DependencyCheckResult,
): string {
  if (checkResult.isValid) return '';

  const featureName = getFeatureName(featureId);
  const missing = checkResult.missingDependencies.map((id) => getFeatureName(id));

  if (missing.length === 1) {
    return `⚠️ To use "${featureName}", you need to enable "${missing[0]}" first.`;
  } else {
    return `⚠️ To use "${featureName}", you need to enable: ${missing.join(', ')}`;
  }
}

/**
 * Check all dependencies for a set of features
 */
export function checkAllDependencies(
  profession: string,
  enabledFeatures: Set<string>,
): Map<string, DependencyCheckResult> {
  const results = new Map<string, DependencyCheckResult>();
  const professionConfig = PROFESSION_FEATURE_MATRIX[profession];

  if (!professionConfig) return results;

  for (const featureId of enabledFeatures) {
    const result = checkFeatureDependencies(featureId, profession, enabledFeatures);
    if (!result.isValid) {
      results.set(featureId, result);
    }
  }

  return results;
}
