import {
  PRODUCTION_PRESETS,
  type CastingProject,
  type CastingShot,
  type DialogueLine,
  type Manuscript,
  type ProductionContext,
  type ProductionDay,
  type SceneBreakdown,
  type ShotList,
  type ShotType,
} from '../models/casting';
import { productionPlanningService } from './productionPlanningService';

type EstimateConfidence = 'low' | 'medium' | 'high';
type ProductionDayLoadStatus = 'healthy' | 'tight' | 'overloaded' | 'unscheduled';

interface DeliveryFormatTemplate {
  id: string;
  label: string;
  aspectRatio: string;
  minSeconds: number;
  maxSeconds: number;
  multiplier: number;
  description: string;
  emphasis?: 'primary' | 'secondary';
}

export interface DeliveryFormatEstimate {
  id: string;
  label: string;
  aspectRatio: string;
  estimatedSeconds: number;
  description: string;
  emphasis: 'primary' | 'secondary';
}

export interface ProductionDayLoadEstimate {
  dayId: string;
  label: string;
  date?: string;
  shotListCount: number;
  shotCount: number;
  sceneCount: number;
  onLocationMinutes: number;
  rawCaptureMinutes: number;
  realisticFieldMinutes: number;
  estimatedOutputSeconds: number;
  bufferMinutes: number | null;
  utilizationPct: number | null;
  status: ProductionDayLoadStatus;
}

export interface ShotLoadEstimate {
  shotCount: number;
  rawCaptureMinutes: number;
  realisticFieldMinutes: number;
  estimatedOutputSeconds: number;
}

export interface ProductionDayScheduleEstimate extends ShotLoadEstimate {
  onLocationMinutes: number;
  bufferMinutes: number | null;
  utilizationPct: number | null;
  status: ProductionDayLoadStatus;
}

export interface ContentProductionEstimate {
  dominantContext: ProductionContext;
  confidence: EstimateConfidence;
  totalRawCaptureMinutes: number;
  totalRealisticFieldMinutes: number;
  totalEstimatedOutputSeconds: number;
  totalScriptDrivenSeconds: number;
  suggestedShootDays: number;
  overloadedDayCount: number;
  formatEstimates: DeliveryFormatEstimate[];
  productionDayLoads: ProductionDayLoadEstimate[];
  notes: string[];
}

interface EstimateInputs {
  project: CastingProject | null;
  manuscript: Manuscript | null;
  scenes: SceneBreakdown[];
  dialogue: DialogueLine[];
  shotLists: ShotList[];
  productionDays: ProductionDay[];
}

const DEFAULT_SHOT_DURATION_SECONDS = 4;

const SHOT_DURATION_BY_TYPE: Record<ShotType, number> = {
  Wide: 5,
  Medium: 4,
  'Close-up': 3,
  'Extreme Close-up': 2,
  Establishing: 6,
  Detail: 2,
  'Two Shot': 4,
  'Over Shoulder': 4,
  'Point of View': 3,
  Portrait: 4,
};

const FORMAT_TEMPLATES_BY_CONTEXT: Partial<Record<ProductionContext, DeliveryFormatTemplate[]>> = {
  corporate: [
    {
      id: 'vertical_teaser',
      label: 'SoMe-teaser',
      aspectRatio: '9:16',
      minSeconds: 15,
      maxSeconds: 35,
      multiplier: 0.22,
      description: 'Kort hook for annonsering, teaser og remarketing.',
    },
    {
      id: 'campaign_cut',
      label: 'Kort versjon',
      aspectRatio: '4:5 / 1:1',
      minSeconds: 35,
      maxSeconds: 75,
      multiplier: 0.46,
      description: 'Kompakt versjon til feed, landingsside og kampanje.',
    },
    {
      id: 'hero_film',
      label: 'Hovedfilm',
      aspectRatio: '16:9',
      minSeconds: 75,
      maxSeconds: 210,
      multiplier: 0.95,
      description: 'Primær leveranse for salg, onboarding eller merkevare.',
      emphasis: 'primary',
    },
    {
      id: 'training_module',
      label: 'Opplæringssegment',
      aspectRatio: '16:9',
      minSeconds: 150,
      maxSeconds: 420,
      multiplier: 1.45,
      description: 'Utvidet versjon for forklaring, HMS eller intern opplæring.',
    },
  ],
  documentary: [
    {
      id: 'teaser',
      label: 'Teaser',
      aspectRatio: '16:9',
      minSeconds: 20,
      maxSeconds: 45,
      multiplier: 0.22,
      description: 'Kort inngang til kampanje og distribusjon.',
    },
    {
      id: 'short_cut',
      label: 'Kortversjon',
      aspectRatio: '16:9',
      minSeconds: 60,
      maxSeconds: 150,
      multiplier: 0.62,
      description: 'Kondensert historie for rask publisering.',
    },
    {
      id: 'mini_doc',
      label: 'Mini-dokumentar',
      aspectRatio: '16:9',
      minSeconds: 180,
      maxSeconds: 600,
      multiplier: 1.2,
      description: 'Full fortelling med rom for observasjon og overganger.',
      emphasis: 'primary',
    },
  ],
  social_media: [
    {
      id: 'story_cut',
      label: 'Story / Reel',
      aspectRatio: '9:16',
      minSeconds: 10,
      maxSeconds: 25,
      multiplier: 0.18,
      description: 'Hurtig vertikal leveranse for høy frekvens.',
      emphasis: 'primary',
    },
    {
      id: 'feed_cut',
      label: 'Feed-versjon',
      aspectRatio: '4:5',
      minSeconds: 20,
      maxSeconds: 45,
      multiplier: 0.32,
      description: 'Kortformat til feed og kampanje.',
    },
    {
      id: 'recap',
      label: 'Recap',
      aspectRatio: '16:9',
      minSeconds: 30,
      maxSeconds: 75,
      multiplier: 0.6,
      description: 'Utvidet versjon når én opptaksdag skal gi flere flater.',
    },
  ],
  commercial: [
    {
      id: 'bumper',
      label: 'Bumper',
      aspectRatio: '16:9 / 9:16',
      minSeconds: 6,
      maxSeconds: 10,
      multiplier: 0.1,
      description: 'Kort bump for paid og retargeting.',
    },
    {
      id: 'cutdown_15',
      label: '15s cutdown',
      aspectRatio: '16:9 / 4:5',
      minSeconds: 12,
      maxSeconds: 20,
      multiplier: 0.22,
      description: 'Kampanjeversjon for korte placements.',
    },
    {
      id: 'hero_30',
      label: 'Hero-film',
      aspectRatio: '16:9',
      minSeconds: 20,
      maxSeconds: 40,
      multiplier: 0.42,
      description: 'Primær reklameleveranse med tydelig budskap.',
      emphasis: 'primary',
    },
    {
      id: 'extended_60',
      label: 'Utvidet versjon',
      aspectRatio: '16:9',
      minSeconds: 40,
      maxSeconds: 75,
      multiplier: 0.9,
      description: 'Version med mer produkt-, case- eller forklaringsinnhold.',
    },
  ],
};

const DEFAULT_FORMAT_TEMPLATES: DeliveryFormatTemplate[] = FORMAT_TEMPLATES_BY_CONTEXT.corporate || [];

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const readDialogueText = (line: DialogueLine): string => {
  const candidate = line.text;
  if (hasText(candidate)) {
    return candidate;
  }
  const fallback = line.dialogueText;
  return hasText(fallback) ? fallback : '';
};

const inferContextFromProject = (project: CastingProject | null): ProductionContext | null => {
  const projectType = String(project?.projectType || '').toLowerCase();
  if (projectType.includes('corporate') || projectType.includes('training') || projectType.includes('onboarding')) {
    return 'corporate';
  }
  if (projectType.includes('documentary') || projectType.includes('doc')) {
    return 'documentary';
  }
  if (projectType.includes('commercial') || projectType.includes('campaign') || projectType.includes('brand')) {
    return 'commercial';
  }
  if (projectType.includes('social')) {
    return 'social_media';
  }
  return null;
};

const getDominantContext = (project: CastingProject | null, shotLists: ShotList[]): ProductionContext => {
  const counts = new Map<ProductionContext, number>();
  shotLists.forEach((shotList) => {
    const context = shotList.productionContext;
    if (context) {
      counts.set(context, (counts.get(context) || 0) + 1);
    }
  });

  const winningContext = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  return winningContext || inferContextFromProject(project) || 'custom';
};

export const resolveProductionEstimateContext = (
  project: CastingProject | null,
  preferredContext?: ProductionContext | null,
): ProductionContext => preferredContext || inferContextFromProject(project) || 'custom';

export const estimateShotOutputSeconds = (shot: CastingShot): number => {
  if (typeof shot.duration === 'number' && shot.duration > 0) {
    return shot.duration;
  }
  return SHOT_DURATION_BY_TYPE[shot.shotType] || DEFAULT_SHOT_DURATION_SECONDS;
};

export const estimateShotCaptureMinutes = (shot: CastingShot, context: ProductionContext): number => {
  if (typeof shot.estimatedTime === 'number' && shot.estimatedTime > 0) {
    return shot.estimatedTime;
  }
  const preset = PRODUCTION_PRESETS[context];
  return preset?.typicalDuration || 5;
};

export const estimateShotFieldMinutes = (shot: CastingShot, context: ProductionContext): number => {
  const baseCaptureMinutes = estimateShotCaptureMinutes(shot, context);
  let setupOverheadMinutes = 2;

  if (shot.cameraMovement && shot.cameraMovement !== 'Static') {
    setupOverheadMinutes += 2.5;
  }

  if (shot.mediaType === 'video') {
    setupOverheadMinutes += 1;
  } else if (shot.mediaType === 'hybrid') {
    setupOverheadMinutes += 2;
  }

  if (shot.shotType === 'Establishing' || shot.shotType === 'Wide' || shot.shotType === 'Two Shot') {
    setupOverheadMinutes += 1.5;
  }

  if (shot.priority === 'critical') {
    setupOverheadMinutes += 1;
  }

  if (hasText(shot.lightingSetup)) {
    setupOverheadMinutes += 1.5;
  }

  if (hasText(shot.notes) || hasText(shot.fieldNotes)) {
    setupOverheadMinutes += 0.5;
  }

  return Math.round((baseCaptureMinutes + setupOverheadMinutes) * 10) / 10;
};

export const estimateShotLoad = (
  shots: CastingShot[],
  context: ProductionContext,
  options?: { hasNotes?: boolean; baseCoordinationMinutes?: number },
): ShotLoadEstimate => {
  const shotCount = shots.length;
  const rawCaptureMinutes = shots.reduce((sum, shot) => sum + estimateShotCaptureMinutes(shot, context), 0);
  const realisticShotMinutes = shots.reduce((sum, shot) => sum + estimateShotFieldMinutes(shot, context), 0);
  const coordinationMinutes = shotCount > 0
    ? (options?.baseCoordinationMinutes ?? 8) + Math.min(8, shotCount) * 0.8
    : 0;
  const notesMinutes = options?.hasNotes ? 4 : 0;
  const estimatedOutputSeconds = shots.reduce((sum, shot) => sum + estimateShotOutputSeconds(shot), 0);

  return {
    shotCount,
    rawCaptureMinutes: Math.round(rawCaptureMinutes),
    realisticFieldMinutes: Math.round(realisticShotMinutes + coordinationMinutes + notesMinutes),
    estimatedOutputSeconds: Math.round(estimatedOutputSeconds),
  };
};

const estimateShotListFieldMinutes = (shotList: ShotList, context: ProductionContext): number =>
  estimateShotLoad(shotList.shots, context, {
    hasNotes: hasText(shotList.notes),
    baseCoordinationMinutes: 12,
  }).realisticFieldMinutes;

const estimateScriptDrivenSeconds = (
  manuscript: Manuscript | null,
  scenes: SceneBreakdown[],
  dialogue: DialogueLine[],
  fallbackOutputSeconds: number,
): number => {
  const totalPageLength = scenes.reduce((sum, scene) => {
    const value = typeof scene.pageLength === 'number' ? scene.pageLength : 0;
    return sum + Math.max(0, value);
  }, 0);
  const dialogueWordCount = dialogue.reduce((sum, line) => {
    const text = readDialogueText(line);
    return sum + (text ? text.trim().split(/\s+/u).length : 0);
  }, 0);
  const pageDrivenSeconds = totalPageLength > 0 ? totalPageLength * 55 : 0;
  const dialogueDrivenSeconds = dialogueWordCount > 0 ? (dialogueWordCount / 150) * 60 : 0;
  const sceneBridgeSeconds = scenes.length > 0 ? scenes.length * 6 : 0;
  const contentWeightBonus = hasText(manuscript?.content) ? 20 : 0;

  const scriptDrivenSeconds = Math.max(
    pageDrivenSeconds,
    dialogueDrivenSeconds + sceneBridgeSeconds + contentWeightBonus,
    fallbackOutputSeconds * 0.8,
  );

  return Math.round(scriptDrivenSeconds);
};

const getFormatTemplates = (context: ProductionContext): DeliveryFormatTemplate[] =>
  FORMAT_TEMPLATES_BY_CONTEXT[context] || DEFAULT_FORMAT_TEMPLATES;

const getConfidence = (hasScriptSignal: boolean, hasShotSignal: boolean, hasProductionDays: boolean): EstimateConfidence => {
  if (hasScriptSignal && hasShotSignal && hasProductionDays) {
    return 'high';
  }
  if ((hasScriptSignal && hasShotSignal) || (hasShotSignal && hasProductionDays)) {
    return 'medium';
  }
  return 'low';
};

export const estimateProductionDaySchedule = (
  productionDay: ProductionDay,
  shots: CastingShot[],
  context: ProductionContext,
): ProductionDayScheduleEstimate => {
  const load = estimateShotLoad(shots, context);
  const onLocationMinutes = productionPlanningService.calculateAvailableTime(productionDay);
  const bufferMinutes = onLocationMinutes > 0
    ? Math.round((onLocationMinutes - load.realisticFieldMinutes) * 10) / 10
    : null;
  const utilizationPct = onLocationMinutes > 0
    ? Math.round((load.realisticFieldMinutes / onLocationMinutes) * 100)
    : null;

  let status: ProductionDayLoadStatus = 'healthy';
  if (utilizationPct === null) {
    status = 'unscheduled';
  } else if (utilizationPct > 100) {
    status = 'overloaded';
  } else if (utilizationPct >= 85) {
    status = 'tight';
  }

  return {
    ...load,
    onLocationMinutes,
    bufferMinutes: bufferMinutes === null ? null : Math.round(bufferMinutes),
    utilizationPct,
    status,
  };
};

export function estimateContentProduction(inputs: EstimateInputs): ContentProductionEstimate {
  const { project, manuscript, scenes, dialogue, shotLists, productionDays } = inputs;
  const dominantContext = getDominantContext(project, shotLists);
  const availableScenes = Array.isArray(project?.sceneBreakdowns) ? project?.sceneBreakdowns || [] : [];
  const mergedScenes = [...scenes];
  availableScenes.forEach((scene) => {
    if (!mergedScenes.some((existing) => existing.id === scene.id)) {
      mergedScenes.push(scene);
    }
  });

  const totalOutputSeconds = shotLists.reduce(
    (sum, shotList) => sum + shotList.shots.reduce((shotSum, shot) => shotSum + estimateShotOutputSeconds(shot), 0),
    0,
  );

  const totalRawCaptureMinutes = shotLists.reduce(
    (sum, shotList) => sum + shotList.shots.reduce((shotSum, shot) => shotSum + estimateShotCaptureMinutes(shot, dominantContext), 0),
    0,
  );

  const totalRealisticFieldMinutes = shotLists.reduce(
    (sum, shotList) => sum + estimateShotListFieldMinutes(shotList, dominantContext),
    0,
  );

  const totalScriptDrivenSeconds = estimateScriptDrivenSeconds(
    manuscript,
    mergedScenes,
    dialogue,
    totalOutputSeconds,
  );

  const baseRuntimeSeconds = clamp(
    Math.round(totalScriptDrivenSeconds * 0.58 + totalOutputSeconds * 0.42),
    15,
    60 * 20,
  );

  const formatEstimates = getFormatTemplates(dominantContext).map((template) => ({
    id: template.id,
    label: template.label,
    aspectRatio: template.aspectRatio,
    estimatedSeconds: clamp(Math.round(baseRuntimeSeconds * template.multiplier), template.minSeconds, template.maxSeconds),
    description: template.description,
    emphasis: template.emphasis || 'secondary',
  }));

  const productionDayBySceneId = new Map<string, ProductionDay>();
  productionDays.forEach((day) => {
    (day.scenes || []).forEach((sceneId) => {
      if (hasText(sceneId) && !productionDayBySceneId.has(sceneId)) {
        productionDayBySceneId.set(sceneId, day);
      }
    });
  });

  const shotListsByDay = new Map<string, ShotList[]>();
  const unscheduledShotLists: ShotList[] = [];
  shotLists.forEach((shotList) => {
    const day = productionDayBySceneId.get(shotList.sceneId);
    if (!day) {
      unscheduledShotLists.push(shotList);
      return;
    }
    const current = shotListsByDay.get(day.id) || [];
    current.push(shotList);
    shotListsByDay.set(day.id, current);
  });

  const productionDayLoads: ProductionDayLoadEstimate[] = productionDays.map((day) => {
    const dayShotLists = shotListsByDay.get(day.id) || [];
    const shotCount = dayShotLists.reduce((sum, shotList) => sum + shotList.shots.length, 0);
    const rawCaptureMinutes = dayShotLists.reduce(
      (sum, shotList) => sum + shotList.shots.reduce((shotSum, shot) => shotSum + estimateShotCaptureMinutes(shot, dominantContext), 0),
      0,
    );
    const realisticFieldMinutes = dayShotLists.reduce(
      (sum, shotList) => sum + estimateShotListFieldMinutes(shotList, dominantContext),
      25,
    );
    const onLocationMinutes = productionPlanningService.calculateAvailableTime(day);
    const bufferMinutes = onLocationMinutes > 0 ? Math.round((onLocationMinutes - realisticFieldMinutes) * 10) / 10 : null;
    const utilizationPct = onLocationMinutes > 0
      ? Math.round((realisticFieldMinutes / onLocationMinutes) * 100)
      : null;
    const estimatedOutputSeconds = dayShotLists.reduce(
      (sum, shotList) => sum + shotList.shots.reduce((shotSum, shot) => shotSum + estimateShotOutputSeconds(shot), 0),
      0,
    );

    let status: ProductionDayLoadStatus = 'healthy';
    if (utilizationPct === null) {
      status = 'unscheduled';
    } else if (utilizationPct > 100) {
      status = 'overloaded';
    } else if (utilizationPct >= 85) {
      status = 'tight';
    }

    return {
      dayId: day.id,
      label: day.date ? new Date(day.date).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Produksjonsdag',
      date: day.date,
      shotListCount: dayShotLists.length,
      shotCount,
      sceneCount: dayShotLists.length,
      onLocationMinutes,
      rawCaptureMinutes: Math.round(rawCaptureMinutes),
      realisticFieldMinutes: Math.round(realisticFieldMinutes),
      estimatedOutputSeconds: Math.round(estimatedOutputSeconds),
      bufferMinutes: bufferMinutes === null ? null : Math.round(bufferMinutes),
      utilizationPct,
      status,
    };
  });

  if (unscheduledShotLists.length > 0) {
    const shotCount = unscheduledShotLists.reduce((sum, shotList) => sum + shotList.shots.length, 0);
    productionDayLoads.push({
      dayId: 'unscheduled',
      label: 'Ikke lagt på opptaksdag',
      shotListCount: unscheduledShotLists.length,
      shotCount,
      sceneCount: unscheduledShotLists.length,
      onLocationMinutes: 0,
      rawCaptureMinutes: Math.round(
        unscheduledShotLists.reduce(
          (sum, shotList) => sum + shotList.shots.reduce((shotSum, shot) => shotSum + estimateShotCaptureMinutes(shot, dominantContext), 0),
          0,
        ),
      ),
      realisticFieldMinutes: Math.round(
        unscheduledShotLists.reduce((sum, shotList) => sum + estimateShotListFieldMinutes(shotList, dominantContext), 0),
      ),
      estimatedOutputSeconds: Math.round(
        unscheduledShotLists.reduce(
          (sum, shotList) => sum + shotList.shots.reduce((shotSum, shot) => shotSum + estimateShotOutputSeconds(shot), 0),
          0,
        ),
      ),
      bufferMinutes: null,
      utilizationPct: null,
      status: 'unscheduled',
    });
  }

  const hasScriptSignal = mergedScenes.length > 0 || dialogue.length > 0 || hasText(manuscript?.content);
  const hasShotSignal = shotLists.length > 0;
  const confidence = getConfidence(hasScriptSignal, hasShotSignal, productionDays.length > 0);

  const overloadedDayCount = productionDayLoads.filter((day) => day.status === 'overloaded').length;
  const notes: string[] = [];

  if (!hasScriptSignal) {
    notes.push('Manusdata mangler. Runtime-estimatet er derfor primært basert på shotlist og formatvalg.');
  }
  if (unscheduledShotLists.length > 0) {
    notes.push(`${unscheduledShotLists.length} shotlist${unscheduledShotLists.length === 1 ? '' : 'er'} er ikke koblet til produksjonsdag ennå.`);
  }
  if (overloadedDayCount > 0) {
    notes.push(`${overloadedDayCount} produksjonsdag${overloadedDayCount === 1 ? '' : 'er'} ser overbooket ut mot realistisk opptaksbelastning.`);
  }

  const suggestedShootDays = Math.max(1, Math.ceil(totalRealisticFieldMinutes / 480));

  return {
    dominantContext,
    confidence,
    totalRawCaptureMinutes: Math.round(totalRawCaptureMinutes),
    totalRealisticFieldMinutes: Math.round(totalRealisticFieldMinutes),
    totalEstimatedOutputSeconds: Math.round(totalOutputSeconds),
    totalScriptDrivenSeconds,
    suggestedShootDays,
    overloadedDayCount,
    formatEstimates,
    productionDayLoads,
    notes,
  };
}
