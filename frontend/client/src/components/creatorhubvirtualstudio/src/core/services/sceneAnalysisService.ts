/**
 * Scene Analysis Service
 * 
 * Analyzes lighting setup and detects issues/opportunities.
 * Based on cinematography standards and best practices.
 * 
 * References:
 * - ASC Manual, 10th Edition
 * - "Film Lighting" by Kris Malkiewicz
 * - "Set Lighting Technician's Handbook" by Harry C. Box
 */

import type { LightSourceProperties } from '../types';

export interface SceneIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'exposure' | 'contrast' | 'color' | 'composition' | 'quality';
  title: string;
  description: string;
  recommendation: string;
  affectedLights: string[];
}

export interface SceneOpportunity {
  id: string;
  category: 'pattern' | 'enhancement' | 'efficiency';
  title: string;
  description: string;
  benefit: string;
  suggestedPattern?: string;
}

export interface SceneAnalysisResult {
  score: number; // 0-100
  issues: SceneIssue[];
  opportunities: SceneOpportunity[];
  summary: {
    totalLights: number;
    keyLights: number;
    fillLights: number;
    rimLights: number;
    averageExposure: number;
    contrastRatio: number;
    colorConsistency: number;
  };
}

type SceneAnalysisSummary = SceneAnalysisResult['summary'];

class SceneAnalysisService {
  /**
   * Analyze the current lighting setup
   */
  analyzeScene(lights: LightSourceProperties[]): SceneAnalysisResult {
    const issues: SceneIssue[] = [];
    const opportunities: SceneOpportunity[] = [];

    // Analyze light count and roles
    const summary = this.analyzeSummary(lights);

    // Check for common issues
    this.checkExposureIssues(lights, issues);
    this.checkContrastIssues(lights, issues);
    this.checkColorIssues(lights, issues);
    this.checkCompositionIssues(lights, issues);
    this.checkQualityIssues(lights, issues);

    // Find opportunities
    this.findPatternOpportunities(lights, opportunities);
    this.findEnhancementOpportunities(lights, opportunities);
    this.findEfficiencyOpportunities(lights, opportunities);

    // Calculate overall score
    const score = this.calculateScore(issues, summary);

    return {
      score,
      issues,
      opportunities,
      summary,
    };
  }

  /**
   * Analyze summary statistics
   */
  private analyzeSummary(lights: LightSourceProperties[]) {
    const keyLights = lights.filter(l => l.role === 'key').length;
    const fillLights = lights.filter(l => l.role === 'fill').length;
    const rimLights = lights.filter(l => l.role === 'rim' || l.role === 'back').length;

    // Calculate average exposure (simplified)
    const averageExposure = lights.reduce((sum, l) => sum + (l.power || 0.5), 0) / lights.length;

    // Calculate contrast ratio (key to fill)
    const keyPower = lights.find(l => l.role === 'key')?.power || 1.0;
    const fillPower = lights.find(l => l.role === 'fill')?.power || 0.5;
    const contrastRatio = keyPower / fillPower;

    // Calculate color consistency (CCT variance)
    const ccts = lights.map(l => l.cct || 5600);
    const avgCCT = ccts.reduce((sum, cct) => sum + cct, 0) / ccts.length;
    const variance = ccts.reduce((sum, cct) => sum + Math.pow(cct - avgCCT, 2), 0) / ccts.length;
    const colorConsistency = Math.max(0, 100 - Math.sqrt(variance) / 10);

    return {
      totalLights: lights.length,
      keyLights,
      fillLights,
      rimLights,
      averageExposure,
      contrastRatio,
      colorConsistency,
    };
  }

  /**
   * Check for exposure issues
   * Reference: ASC Manual, Chapter 5: Exposure Control
   */
  private checkExposureIssues(lights: LightSourceProperties[], issues: SceneIssue[]) {
    const avgPower = lights.reduce((sum, l) => sum + (l.power || 0.5), 0) / lights.length;

    // Overexposure
    if (avgPower > 0.8) {
      issues.push({
        id: 'overexposure',
        severity: 'warning',
        category: 'exposure',
        title: 'Potential Overexposure',
        description: `Average light power is ${(avgPower * 100).toFixed(0)}%, which may cause blown highlights.`,
        recommendation: 'Reduce overall light intensity or adjust camera exposure settings.',
        affectedLights: lights.filter(l => (l.power || 0.5) > 0.8).map(l => l.id),
      });
    }

    // Underexposure
    if (avgPower < 0.2) {
      issues.push({
        id: 'underexposure',
        severity: 'warning',
        category: 'exposure',
        title: 'Potential Underexposure',
        description: `Average light power is ${(avgPower * 100).toFixed(0)}%, which may cause crushed shadows.`,
        recommendation: 'Increase overall light intensity or add fill lights.',
        affectedLights: lights.map(l => l.id),
      });
    }
  }

  /**
   * Check for contrast issues
   * Reference: Malkiewicz, Chapter 2: Contrast Ratios
   */
  private checkContrastIssues(lights: LightSourceProperties[], issues: SceneIssue[]) {
    const keyLight = lights.find(l => l.role === 'key');
    const fillLight = lights.find(l => l.role === 'fill');

    if (!keyLight) {
      issues.push({
        id: 'no-key-light',
        severity: 'critical',
        category: 'composition',
        title: 'No Key Light',
        description: 'Scene has no designated key light, which is essential for proper lighting.',
        recommendation: 'Add a key light to establish the primary light source and direction.',
        affectedLights: [],
      });
      return;
    }

    if (!fillLight) {
      issues.push({
        id: 'no-fill-light',
        severity: 'info',
        category: 'composition',
        title: 'No Fill Light',
        description: 'Scene has no fill light. This creates high contrast, which may be intentional.',
        recommendation: 'Consider adding a fill light to soften shadows (unless going for dramatic look).',
        affectedLights: [],
      });
    }
  }

  /**
   * Calculate overall score
   */
  private calculateScore(issues: SceneIssue[], summary: SceneAnalysisSummary): number {
    let score = 100;

    // Deduct for issues
    issues.forEach(issue => {
      if (issue.severity === 'critical') score -= 20;
      else if (issue.severity === 'warning') score -= 10;
      else score -= 5;
    });

    // Bonus for good practices
    if (summary.keyLights >= 1) score += 0;
    if (summary.fillLights >= 1) score += 0;
    if (summary.contrastRatio >= 2 && summary.contrastRatio <= 4) score += 5;
    if (summary.colorConsistency > 90) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check for color temperature issues
   * Reference: Box, Chapter 4: Color Temperature
   */
  private checkColorIssues(lights: LightSourceProperties[], issues: SceneIssue[]) {
    const ccts = lights.map(l => l.cct || 5600);
    const avgCCT = ccts.reduce((sum, cct) => sum + cct, 0) / ccts.length;
    const maxDeviation = Math.max(...ccts.map(cct => Math.abs(cct - avgCCT)));

    // Mixed color temperatures
    if (maxDeviation > 1000) {
      issues.push({
        id: 'mixed-color-temps',
        severity: 'warning',
        category: 'color',
        title: 'Mixed Color Temperatures',
        description: `Color temperatures vary by ${maxDeviation.toFixed(0)}K, which may create color casts.`,
        recommendation: 'Match color temperatures for consistent look, or use intentionally for creative effect.',
        affectedLights: lights.filter(l => Math.abs((l.cct || 5600) - avgCCT) > 500).map(l => l.id),
      });
    }

    // Extreme color temperatures
    lights.forEach(light => {
      const cct = light.cct || 5600;
      if (cct < 2000 || cct > 8000) {
        issues.push({
          id: `extreme-cct-${light.id}`,
          severity: 'info',
          category: 'color',
          title: 'Extreme Color Temperature',
          description: `Light "${light.name}" has ${cct}K, which is outside typical range (2000-8000K).`,
          recommendation: 'Verify this is intentional for creative effect.',
          affectedLights: [light.id],
        });
      }
    });
  }

  /**
   * Check for composition issues
   * Reference: ASC Manual, Chapter 10: Lighting Composition
   */
  private checkCompositionIssues(lights: LightSourceProperties[], issues: SceneIssue[]) {
    const keyLights = lights.filter(l => l.role === 'key');
    const rimLights = lights.filter(l => l.role === 'rim' || l.role === 'back');

    // Multiple key lights
    if (keyLights.length > 1) {
      issues.push({
        id: 'multiple-key-lights',
        severity: 'warning',
        category: 'composition',
        title: 'Multiple Key Lights',
        description: `Scene has ${keyLights.length} key lights, which may create conflicting shadows.`,
        recommendation: 'Use only one key light as the primary source. Convert others to fill or rim.',
        affectedLights: keyLights.map(l => l.id),
      });
    }

    // No rim/back light
    if (rimLights.length === 0 && lights.length >= 2) {
      issues.push({
        id: 'no-rim-light',
        severity: 'info',
        category: 'composition',
        title: 'No Rim/Back Light',
        description: 'Scene lacks rim or back light for subject separation.',
        recommendation: 'Add a rim light behind the subject to create depth and separation from background.',
        affectedLights: [],
      });
    }

    // Too many lights
    if (lights.length > 6) {
      issues.push({
        id: 'too-many-lights',
        severity: 'info',
        category: 'composition',
        title: 'Complex Lighting Setup',
        description: `Scene has ${lights.length} lights, which may be overly complex.`,
        recommendation: 'Consider simplifying. Most professional setups use 3-5 lights.',
        affectedLights: [],
      });
    }
  }

  /**
   * Check for quality issues
   * Reference: EBU Tech 3355 (TLCI standards)
   */
  private checkQualityIssues(lights: LightSourceProperties[], issues: SceneIssue[]) {
    lights.forEach(light => {
      // Check for low CRI
      const cri = light.cri || 95;
      if (cri < 80) {
        issues.push({
          id: `low-cri-${light.id}`,
          severity: 'warning',
          category: 'quality',
          title: 'Low Color Rendering Index',
          description: `Light "${light.name}" has CRI ${cri}, which may cause poor color reproduction.`,
          recommendation: 'Use lights with CRI ≥ 90 for professional work, especially for skin tones.',
          affectedLights: [light.id],
        });
      }

      // Check for very low power
      const power = light.power || 0.5;
      if (power < 0.1) {
        issues.push({
          id: `low-power-${light.id}`,
          severity: 'info',
          category: 'quality',
          title: 'Very Low Light Power',
          description: `Light"${light.name}" is at ${(power * 100).toFixed(0)}% power.`,
          recommendation: 'Increase power or remove light if not contributing to the scene.',
          affectedLights: [light.id],
        });
      }
    });
  }

  /**
   * Find pattern opportunities
   * Reference: Cinematography patterns library
   */
  private findPatternOpportunities(lights: LightSourceProperties[], opportunities: SceneOpportunity[]) {
    const keyLights = lights.filter(l => l.role === 'key').length;
    const fillLights = lights.filter(l => l.role === 'fill').length;

    // Suggest three-point lighting
    if (lights.length < 3 && keyLights === 1) {
      opportunities.push({
        id: 'three-point-pattern',
        category: 'pattern',
        title: 'Try Three-Point Lighting',
        description: 'Your setup could benefit from the classic three-point lighting pattern.',
        benefit: 'Creates professional, well-balanced lighting with depth and dimension.',
        suggestedPattern: 'three-point',
      });
    }

    // Suggest Rembrandt for dramatic
    if (keyLights === 1 && fillLights === 0) {
      opportunities.push({
        id: 'rembrandt-pattern',
        category: 'pattern',
        title: 'Try Rembrandt Lighting',
        description: 'Your high-contrast setup is perfect for Rembrandt lighting.',
        benefit: 'Creates dramatic, artistic portraits with the signature triangle highlight.',
        suggestedPattern: 'rembrandt',
      });
    }

    // Suggest high-key for bright scenes
    const avgPower = lights.reduce((sum, l) => sum + (l.power || 0.5), 0) / lights.length;
    if (avgPower > 0.7 && fillLights >= 1) {
      opportunities.push({
        id: 'high-key-pattern',
        category: 'pattern',
        title: 'Try High-Key Lighting',
        description: 'Your bright setup is ideal for high-key lighting.',
        benefit: 'Creates upbeat, commercial look with minimal shadows.',
        suggestedPattern: 'high-key',
      });
    }
  }

  /**
   * Find enhancement opportunities
   */
  private findEnhancementOpportunities(lights: LightSourceProperties[], opportunities: SceneOpportunity[]) {
    const rimLights = lights.filter(l => l.role === 'rim' || l.role === 'back').length;
    const backgroundLights = lights.filter(l => l.role === 'background').length;

    // Suggest rim light
    if (rimLights === 0 && lights.length >= 2) {
      opportunities.push({
        id: 'add-rim-light',
        category: 'enhancement',
        title: 'Add Rim Light',
        description: 'A rim light would add depth and separation.',
        benefit: 'Creates a subtle highlight around the subject, separating them from the background.',
      });
    }

    // Suggest background light
    if (backgroundLights === 0 && lights.length >= 3) {
      opportunities.push({
        id: 'add-background-light',
        category: 'enhancement',
        title: 'Add Background Light',
        description: 'A background light would add visual interest.',
        benefit: 'Illuminates the background, creating depth and preventing a flat look.',
      });
    }

    // Suggest modifiers
    const lightsWithoutModifiers = lights.filter(l => !l.modifier || l.modifier === 'bare');
    if (lightsWithoutModifiers.length > 0) {
      opportunities.push({
        id: 'add-modifiers',
        category: 'enhancement',
        title: 'Use Light Modifiers',
        description: `${lightsWithoutModifiers.length} light(s) have no modifiers.`,
        benefit: 'Softboxes, umbrellas, and grids shape light quality and create more professional results.',
      });
    }
  }

  /**
   * Find efficiency opportunities
   */
  private findEfficiencyOpportunities(lights: LightSourceProperties[], opportunities: SceneOpportunity[]) {
    // Check for redundant lights
    const veryLowPowerLights = lights.filter(l => (l.power || 0.5) < 0.1);
    if (veryLowPowerLights.length > 0) {
      opportunities.push({
        id: 'remove-low-power',
        category: 'efficiency',
        title: 'Remove Low-Power Lights',
        description: `${veryLowPowerLights.length} light(s) are below 10% power.`,
        benefit: 'Simplify your setup by removing lights that barely contribute to the scene.',
      });
    }

    // Check for overlapping lights
    if (lights.length > 5) {
      opportunities.push({
        id: 'simplify-setup',
        category: 'efficiency',
        title: 'Simplify Lighting Setup',
        description: `Your setup has ${lights.length} lights, which may be complex to manage.`,
        benefit: 'Professional setups typically use 3-5 lights. Fewer lights are easier to control and adjust.',
      });
    }
  }
}

export const sceneAnalysisService = new SceneAnalysisService();
