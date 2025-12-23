/**
 * AI Recommendation Service
 * 
 * Provides intelligent lighting recommendations based on:
 * - Scene analysis
 * - Quality scoring
 * - Cinematography patterns
 * - Industry best practices
 * 
 * References:
 * - ASC Manual, 10th Edition
 * - "Film Lighting" by Kris Malkiewicz
 * -"Set Lighting Technician, 's Handbook" by Harry C. Box
 */

import type { LightSourceProperties } from '../types';
import { logger } from './logger';
import { sceneAnalysisService } from './sceneAnalysisService';

const log = logger.module('AIRecommendation, ');
import { lightingQualityScoreService } from './lightingQualityScoreService';
import { cinematographyPatternsService, type CinematographyPattern } from './cinematographyPatternsService';
import { lightingMLService, type SceneFeatures, type MLRecommendation } from './lightingMLService';

export interface AIRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'quick-fix' | 'pattern' | 'enhancement' | 'learning';
  title: string;
  description: string;
  reasoning: string;
  action: {
    type: 'apply-pattern' | 'adjust-light' | 'add-light' | 'remove-light' | 'learn-more';
    data?: any;
  };
  expectedImprovement: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface AIAssistantResponse {
  recommendations: AIRecommendation[];
  qualityScore: number;
  grade: string;
  summary: string;
  suggestedPatterns: CinematographyPattern[];
}

class AIRecommendationService {
  private useML: boolean = false;

  /**
   * Initialize ML model (call this on app startup)
   */
  async initializeML(): Promise<void> {
    try {
      await lightingMLService.initialize();
      this.useML = lightingMLService.isLoaded();
      log.info(`AI Recommendations: ${this.useML ? 'ML-powered, ' : 'Heuristic-based'}`);
    } catch (error) {
      log.warn('ML model failed to load, using heuristic recommendations');
      this.useML = false;
    }
  }

  /**
   * Get AI recommendations for current lighting setup
   * Uses ML model if available, falls back to heuristics
   */
  async getRecommendations(lights: LightSourceProperties[]): Promise<AIAssistantResponse> {
    // Analyze scene
    const analysis = sceneAnalysisService.analyzeScene(lights);

    // Calculate quality score
    const qualityScore = lightingQualityScoreService.calculateScore(lights);

    // Generate recommendations
    const recommendations: AIRecommendation[] = [];

    // Try ML recommendations first if available
    if (this.useML) {
      try {
        await this.addMLRecommendations(analysis, lights, recommendations);
      } catch (error) {
        log.warn('ML prediction failed, falling back to heuristics: ', error);
        this.useML = false;
      }
    }

    // Priority 1: Critical issues
    this.addCriticalIssueRecommendations(analysis, recommendations);

    // Priority 2: Pattern suggestions (heuristic-based)
    if (!this.useML) {
      this.addPatternRecommendations(analysis, lights, recommendations);
    }

    // Priority 3: Enhancement opportunities
    this.addEnhancementRecommendations(analysis, recommendations);

    // Priority 4: Learning opportunities
    this.addLearningRecommendations(qualityScore, recommendations);

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Get suggested patterns
    const suggestedPatterns = this.getSuggestedPatterns(analysis, lights);

    // Generate summary
    const summary = this.generateSummary(qualityScore, analysis, recommendations);

    return {
      recommendations: recommendations.slice(0, 8), // Top 8 recommendations
      qualityScore: qualityScore.overall,
      grade: qualityScore.grade,
      summary,
      suggestedPatterns,
    };
  }

  /**
   * Add ML-powered recommendations
   */
  private async addMLRecommendations(
    analysis: any,
    lights: LightSourceProperties[],
    recommendations: AIRecommendation[]
  ): Promise<void> {
    // Extract scene features
    const features: SceneFeatures = {
      subjectType: this.inferSubjectType(analysis),
      environment: this.inferEnvironment(analysis),
      mood: this.inferMood(analysis),
      lightCount: lights.length,
      hasKeyLight: analysis.hasKeyLight,
      hasFillLight: analysis.hasFillLight,
      hasBackLight: analysis.hasBackLight,
      avgLightPower: this.calculateAvgPower(lights),
      avgColorTemp: this.calculateAvgColorTemp(lights),
    };

    // Get ML prediction
    const mlRecommendation = await lightingMLService.predict(features);

    // Add ML recommendation
    recommendations.push({
      id: 'ml-pattern-suggestion',
      priority: 'high',
      category: 'pattern',
      title: `🤖 AI Suggests: ${this.formatPatternName(mlRecommendation.patternSuggestion)}`,
      description: `Our ML model recommends applying the ${this.formatPatternName(mlRecommendation.patternSuggestion)} pattern based on your current scene.`,
      reasoning: `ML, confidence: ${(mlRecommendation.confidence * 100).toFixed(1)}%. This pattern is optimal for your scene context.`,
      action: {
        type: 'apply-pattern',
        data: { patternId: mlRecommendation.patternSuggestion },
      },
      expectedImprovement: `+${mlRecommendation.expectedQualityImprovement.toFixed(0)}% quality improvement`,
      difficulty: 'easy',
    });

    // Add adjustment recommendations if needed
    if (mlRecommendation.adjustments.addLights) {
      recommendations.push({
        id: 'ml-add-lights',
        priority: 'medium',
        category: 'enhancement',
        title: `Add ${mlRecommendation.adjustments.addLights} More Light${mlRecommendation.adjustments.addLights > 1 ? 's' : ', '}`,
        description: `The ML model suggests adding ${mlRecommendation.adjustments.addLights} additional light source${mlRecommendation.adjustments.addLights > 1 ? 's' : ', '} to improve your setup.`,
        reasoning: 'Current light count is below optimal for this scene type.',
        action: {
          type: 'add-light',
          data: { count: mlRecommendation.adjustments.addLights },
        },
        expectedImprovement: '+10-15% quality',
        difficulty: 'easy',
      });
    }
  }

  // Helper methods for ML feature extraction
  private inferSubjectType(analysis: any): 'portrait' | 'product' | 'commercial' {
    // Simple heuristic - can be improved with actual scene detection
    if (analysis.lightCount <= 3) return 'portrait';
    if (analysis.lightCount >= 6) return 'commercial';
    return 'product';
  }

  private inferEnvironment(analysis: any): 'studio' | 'outdoor' | 'indoor' {
    // Default to studio for now - can be improved with scene detection
    return 'studio';
  }

  private inferMood(analysis: any): 'neutral' | 'dramatic' | 'soft' {
    const keyFillRatio = analysis.keyFillRatio || 2;
    if (keyFillRatio > 4) return 'dramatic';
    if (keyFillRatio < 2) return 'soft';
    return 'neutral';
  }

  private calculateAvgPower(lights: LightSourceProperties[]): number {
    if (lights.length === 0) return 0;
    const totalPower = lights.reduce((sum, light) => sum + (light.power || 500), 0);
    return totalPower / lights.length;
  }

  private calculateAvgColorTemp(lights: LightSourceProperties[]): number {
    if (lights.length === 0) return 5600;
    const totalTemp = lights.reduce((sum, light) => sum + (light.colorTemperature || 5600), 0);
    return totalTemp / lights.length;
  }

  private formatPatternName(patternId: string): string {
    return patternId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(', ');
  }

  /**
   * Add recommendations for critical issues
   */
  private addCriticalIssueRecommendations(analysis: any, recommendations: AIRecommendation[]) {
    analysis.issues
      .filter((issue: any) => issue.severity === 'critical')
      .forEach((issue: any) => {
        recommendations.push({
          id: `critical-${issue.id}`,
          priority: 'high',
          category: 'quick-fix',
          title: issue.title,
          description: issue.description,
          reasoning: 'Critical issue that prevents proper lighting setup.',
          action: {
            type: issue.id === 'no-key-light' ? 'add-light' : 'adjust-light',
            data: { role: 'key' },
          },
          expectedImprovement: issue.recommendation,
          difficulty: 'easy',
        });
      });
  }

  /**
   * Add pattern recommendations
   */
  private addPatternRecommendations(analysis: any, lights: LightSourceProperties[], recommendations: AIRecommendation[]) {
    analysis.opportunities
      .filter((opp: any) => opp.category === 'pattern' && opp.suggestedPattern)
      .forEach((opp: any) => {
        const pattern = cinematographyPatternsService.getPatternById(opp.suggestedPattern);
        if (pattern) {
          recommendations.push({
            id: `pattern-${pattern.id}`,
            priority: 'medium',
            category: 'pattern',
            title: opp.title,
            description: opp.description,
            reasoning: `Based on your current setup (${lights.length} lights), this pattern would enhance your lighting.`,
            action: {
              type: 'apply-pattern',
              data: { patternId: pattern.id },
            },
            expectedImprovement: opp.benefit,
            difficulty: pattern.difficulty === 'beginner' ? 'easy' : pattern.difficulty === 'intermediate' ? 'medium' : 'hard',
          });
        }
      });
  }

  /**
   * Add enhancement recommendations
   */
  private addEnhancementRecommendations(analysis: any, recommendations: AIRecommendation[]) {
    analysis.opportunities
      .filter((opp: any) => opp.category === 'enhancement')
      .forEach((opp: any) => {
        recommendations.push({
          id: `enhancement-${opp.id}`,
          priority: 'medium',
          category: 'enhancement',
          title: opp.title,
          description: opp.description,
          reasoning: 'This enhancement would improve the overall quality of your lighting.',
          action: {
            type: opp.id.includes('add') ? 'add-light' : 'adjust-light',
            data: {},
          },
          expectedImprovement: opp.benefit,
          difficulty: 'medium',
        });
      });
  }

  /**
   * Add learning recommendations
   */
  private addLearningRecommendations(qualityScore: any, recommendations: AIRecommendation[]) {
    // Suggest learning based on weak areas
    const weakCategories = Object.entries(qualityScore.categories)
      .filter(([_, data]: [string, any]) => data.score < 80)
      .sort((a: any, b: any) => a[1].score - b[1].score);

    weakCategories.slice(0, 2).forEach(([category, data]: [string, any]) => {
      recommendations.push({
        id: `learn-${category}`,
        priority: 'low',
        category: 'learning',
        title: `Learn More About ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        description: `Your ${category} score is ${data.score}/100. ${data.details}`,
        reasoning: 'Understanding this area will help you create better lighting setups.',
        action: {
          type: 'learn-more',
          data: { topic: category },
        },
        expectedImprovement: `Improve your ${category} skills and create more professional lighting.`,
        difficulty: 'easy',
      });
    });
  }

  /**
   * Get suggested patterns based on analysis
   */
  private getSuggestedPatterns(analysis: any, lights: LightSourceProperties[]): CinematographyPattern[] {
    const patterns: CinematographyPattern[] = [];

    // Get patterns from opportunities
    analysis.opportunities
      .filter((opp: any) => opp.suggestedPattern)
      .forEach((opp: any) => {
        const pattern = cinematographyPatternsService.getPatternById(opp.suggestedPattern);
        if (pattern) patterns.push(pattern);
      });

    // Add beginner-friendly patterns if user has few lights
    if (lights.length < 3) {
      const threePoint = cinematographyPatternsService.getPatternById('three-point');
      if (threePoint && !patterns.find(p => p.id === 'three-point')) {
        patterns.push(threePoint);
      }
    }

    // Add patterns by category
    if (patterns.length < 3) {
      const allPatterns = cinematographyPatternsService.getAllPatterns();
      const beginnerPatterns = allPatterns.filter(p => p.difficulty === 'beginner');
      patterns.push(...beginnerPatterns.slice(0, 3 - patterns.length));
    }

    return patterns.slice(0, 3);
  }

  /**
   * Generate summary text
   */
  private generateSummary(qualityScore: any, analysis: any, recommendations: AIRecommendation[]): string {
    const score = qualityScore.overall;
    const grade = qualityScore.grade;
    const criticalIssues = analysis.issues.filter((i: any) => i.severity === 'critical').length;
    const warnings = analysis.issues.filter((i: any) => i.severity === 'warning').length;

    if (score >= 90) {
      return `Excellent work! Your lighting setup scores ${score}/100 (Grade ${grade}). ${recommendations.length > 0 ? 'A few minor tweaks could make it even better.' : 'Keep up the great work!'}`;
    } else if (score >= 75) {
      return `Good lighting setup with a score of ${score}/100 (Grade ${grade}). ${warnings > 0 ? `Address ${warnings} warning(s) to improve quality.` : 'Consider the suggestions below to enhance your setup.'}`;
    } else if (score >= 60) {
      return `Your setup scores ${score}/100 (Grade ${grade}). ${criticalIssues > 0 ? `Fix ${criticalIssues} critical issue(s) first.` : 'Several improvements needed.'} Follow the recommendations below.`;
    } else {
      return `Your lighting needs significant improvement (${score}/100, Grade ${grade}). ${criticalIssues > 0 ? `Start by fixing ${criticalIssues} critical issue(s).` :'Start with the high-priority recommendations below.'}`;
    }
  }
}

export const aiRecommendationService = new AIRecommendationService();

