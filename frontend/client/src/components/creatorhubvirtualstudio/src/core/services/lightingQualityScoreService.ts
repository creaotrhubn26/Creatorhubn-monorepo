/**
 * Lighting Quality Score Service
 * 
 * Calculates comprehensive quality scores based on cinematography standards.
 * 
 * References:
 * - ASC Manual, 10th Edition
 * - "Film Lighting" by Kris Malkiewicz
 * - CIE 13.3-1995 (Color Rendering Index)
 * - EBU Tech 3355 (TLCI)
 */

import type { LightSourceProperties } from '../types';

export interface QualityScoreBreakdown {
  overall: number; // 0-100
  categories: {
    exposure: { score: number; weight: number; details: string };
    contrast: { score: number; weight: number; details: string };
    color: { score: number; weight: number; details: string };
    composition: { score: number; weight: number; details: string };
    technical: { score: number; weight: number; details: string };
  };
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  comparison: {
    professional: number; // % of professional standard
    broadcast: number; // % of broadcast standard
    cinema: number; // % of cinema standard
  };
}

class LightingQualityScoreService {
  /**
   * Calculate comprehensive quality score
   */
  calculateScore(lights: LightSourceProperties[]): QualityScoreBreakdown {
    // Calculate category scores
    const exposure = this.scoreExposure(lights);
    const contrast = this.scoreContrast(lights);
    const color = this.scoreColor(lights);
    const composition = this.scoreComposition(lights);
    const technical = this.scoreTechnical(lights);

    // Weights based on cinematography importance
    const weights = {
      exposure: 0.25,
      contrast: 0.20,
      color: 0.20,
      composition: 0.20,
      technical: 0.15,
    };

    // Calculate weighted overall score
    const overall =
      exposure.score * weights.exposure +
      contrast.score * weights.contrast +
      color.score * weights.color +
      composition.score * weights.composition +
      technical.score * weights.technical;

    // Determine grade
    const grade = this.calculateGrade(overall);

    // Compare to industry standards
    const comparison = {
      professional: (overall / 85) * 100, // Professional standard: 85+
      broadcast: (overall / 90) * 100, // Broadcast standard: 90+
      cinema: (overall / 95) * 100, // Cinema standard: 95+
    };

    return {
      overall: Math.round(overall),
      categories: {
        exposure: { ...exposure, weight: weights.exposure },
        contrast: { ...contrast, weight: weights.contrast },
        color: { ...color, weight: weights.color },
        composition: { ...composition, weight: weights.composition },
        technical: { ...technical, weight: weights.technical },
      },
      grade,
      comparison,
    };
  }

  /**
   * Score exposure quality
   * Reference: ASC Manual, Chapter 5
   */
  private scoreExposure(lights: LightSourceProperties[]): { score: number; details: string } {
    if (lights.length === 0) return { score: 0, details: 'No lights in scene' };

    const avgPower = lights.reduce((sum, l) => sum + (l.power || 0.5), 0) / lights.length;
    let score = 100;
    let details = '';

    // Optimal range: 0.3 - 0.7
    if (avgPower < 0.2) {
      score = 50;
      details = 'Underexposed - increase light intensity';
    } else if (avgPower < 0.3) {
      score = 75;
      details = 'Slightly underexposed - consider more light';
    } else if (avgPower > 0.8) {
      score = 60;
      details = 'Overexposed - reduce light intensity';
    } else if (avgPower > 0.7) {
      score = 85;
      details = 'Slightly overexposed - watch highlights';
    } else {
      score = 100;
      details = 'Optimal exposure range';
    }

    return { score, details };
  }

  /**
   * Score contrast ratio
   * Reference: Malkiewicz, Chapter 2
   */
  private scoreContrast(lights: LightSourceProperties[]): { score: number; details: string } {
    const keyLight = lights.find(l => l.role === 'key');
    const fillLight = lights.find(l => l.role === 'fill');

    if (!keyLight) {
      return { score: 0, details: 'No key light - critical issue' };
    }

    if (!fillLight) {
      return { score: 70, details: 'No fill light - high contrast (may be intentional)' };
    }

    const keyPower = keyLight.power || 1.0;
    const fillPower = fillLight.power || 0.5;
    const ratio = keyPower / fillPower;

    let score = 100;
    let details = '';

    // Optimal ratios: 2:1 to 4:1
    if (ratio < 1.5) {
      score = 75;
      details = `Low contrast (${ratio.toFixed(1)}:1) - flat lighting`;
    } else if (ratio >= 1.5 && ratio <= 4) {
      score = 100;
      details = `Optimal contrast (${ratio.toFixed(1)}:1)`;
    } else if (ratio > 4 && ratio <= 8) {
      score = 85;
      details = `High contrast (${ratio.toFixed(1)}:1) - dramatic look`;
    } else {
      score = 70;
      details = `Very high contrast (${ratio.toFixed(1)}:1) - extreme look`;
    }

    return { score, details };
  }

  /**
   * Score color quality
   * Reference: CIE 13.3-1995, EBU Tech 3355
   */
  private scoreColor(lights: LightSourceProperties[]): { score: number; details: string } {
    if (lights.length === 0) return { score: 0, details: 'No lights' };

    // Check CRI
    const avgCRI = lights.reduce((sum, l) => sum + (l.cri || 95), 0) / lights.length;
    
    // Check CCT consistency
    const ccts = lights.map(l => l.cct || 5600);
    const avgCCT = ccts.reduce((sum, cct) => sum + cct, 0) / ccts.length;
    const maxDeviation = Math.max(...ccts.map(cct => Math.abs(cct - avgCCT)));

    let score = 100;
    let details = '';

    // CRI scoring
    if (avgCRI < 80) {
      score -= 30;
      details += `Low CRI (${avgCRI.toFixed(0)}). `;
    } else if (avgCRI < 90) {
      score -= 10;
      details += `Fair CRI (${avgCRI.toFixed(0)}). `;
    } else {
      details += `Excellent CRI (${avgCRI.toFixed(0)}). `;
    }

    // CCT consistency scoring
    if (maxDeviation > 1500) {
      score -= 20;
      details += `Inconsistent color temps (±${maxDeviation.toFixed(0)}K)`;
    } else if (maxDeviation > 1000) {
      score -= 10;
      details += `Moderate color temp variation (±${maxDeviation.toFixed(0)}K)`;
    } else {
      details += `Consistent color temps (±${maxDeviation.toFixed(0)}K)`;
    }

    return { score: Math.max(0, score), details };
  }

  /**
   * Score composition
   */
  private scoreComposition(lights: LightSourceProperties[]): { score: number; details: string } {
    const keyLights = lights.filter(l => l.role === 'key').length;
    const fillLights = lights.filter(l => l.role === 'fill').length;
    const rimLights = lights.filter(l => l.role === 'rim' || l.role === 'back').length;

    let score = 100;
    let details = '';

    if (keyLights === 0) {
      score = 0;
      details = 'No key light - critical';
    } else if (keyLights > 1) {
      score = 70;
      details = `${keyLights} key lights - conflicting`;
    } else if (fillLights >= 1 && rimLights >= 1) {
      score = 100;
      details = 'Complete 3-point setup';
    } else if (fillLights >= 1) {
      score = 90;
      details = 'Good 2-point setup';
    } else {
      score = 75;
      details = 'Single key light - high contrast';
    }

    return { score, details };
  }

  /**
   * Score technical quality
   */
  private scoreTechnical(lights: LightSourceProperties[]): { score: number; details: string } {
    if (lights.length === 0) return { score: 0, details: 'No lights' };

    let score = 100;
    const issues: string[] = [];

    // Check for modifiers
    const withModifiers = lights.filter(l => l.modifier && l.modifier !== 'bare').length;
    const modifierRatio = withModifiers / lights.length;
    if (modifierRatio < 0.5) {
      score -= 15;
      issues.push('Few modifiers');
    }

    // Check for proper beam angles
    const withBeam = lights.filter(l => l.beam && l.beam > 0).length;
    if (withBeam < lights.length * 0.8) {
      score -= 10;
      issues.push('Missing beam angles');
    }

    const details = issues.length > 0 ? issues.join('') : 'Good technical setup';
    return { score: Math.max(0, score), details };
  }

  /**
   * Calculate letter grade
   */
  private calculateGrade(score: number): QualityScoreBreakdown['grade'] {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 77) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return'F';
  }
}

export const lightingQualityScoreService = new LightingQualityScoreService();

