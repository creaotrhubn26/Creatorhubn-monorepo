import { lightingQualityScoreService } from './lightingQualityScoreService';
import type { LightSourceProperties } from '../types';

export interface QualityScoreContext {
  subjectPosition: [number, number, number];
  cameraPosition: [number, number, number];
}

export interface QualityScoreResult {
  overallScore: number;
  breakdown: ReturnType<typeof lightingQualityScoreService.calculateScore>;
}

export interface ScoredLightInput {
  id?: string;
  type?: string;
  position: [number, number, number];
  power: number;
  colorTemp: number;
  softness?: number;
  modifier?: string;
}

function normalizePower(power: number): number {
  return power <= 1 ? power : Math.min(1, power / 1000);
}

function inferRole(light: ScoredLightInput, subjectPosition: [number, number, number]): LightSourceProperties['role'] {
  const dx = light.position[0] - subjectPosition[0];
  const dz = light.position[2] - subjectPosition[2];

  if (dz < -0.5) {
    return 'back';
  }
  if (Math.abs(dx) > 0.4) {
    return 'fill';
  }
  return 'key';
}

export const qualityScoringService = {
  calculateQualityScore(lights: ScoredLightInput[], context: QualityScoreContext): QualityScoreResult {
    const adaptedLights: LightSourceProperties[] = lights.map((light, index) => ({
      id: light.id ?? `training-light-${index}`,
      position: light.position,
      power: normalizePower(light.power),
      cct: light.colorTemp,
      modifier: light.modifier ?? (light.softness && light.softness > 0.5 ? 'softbox' : 'bare'),
      beam: 45 + Math.round((1 - (light.softness ?? 0.5)) * 30),
      role: inferRole(light, context.subjectPosition),
    }));

    const breakdown = lightingQualityScoreService.calculateScore(adaptedLights);

    return {
      overallScore: breakdown.overall,
      breakdown,
    };
  },
};

