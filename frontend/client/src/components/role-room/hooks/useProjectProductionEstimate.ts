import { useEffect, useMemo, useState } from 'react';
import type {
  CastingProject,
  DialogueLine,
  Manuscript,
  ProductionDay,
  SceneBreakdown,
  ShotList,
} from '../models/casting';
import { castingService } from '../services/castingService';
import {
  estimateContentProduction,
  type ContentProductionEstimate,
} from '../services/contentProductionEstimateService';
import { manuscriptService } from '../services/manuscriptService';
import { productionPlanningService } from '../services/productionPlanningService';

interface UseProjectProductionEstimateOptions {
  projectId: string;
  initialProject?: CastingProject | null;
  initialShotLists?: ShotList[];
  initialProductionDays?: ProductionDay[];
}

interface UseProjectProductionEstimateResult {
  project: CastingProject | null;
  shotLists: ShotList[];
  productionDays: ProductionDay[];
  manuscript: Manuscript | null;
  scenes: SceneBreakdown[];
  dialogue: DialogueLine[];
  loading: boolean;
  error: string | null;
  productionEstimate: ContentProductionEstimate;
}

const EMPTY_ESTIMATE = estimateContentProduction({
  project: null,
  manuscript: null,
  scenes: [],
  dialogue: [],
  shotLists: [],
  productionDays: [],
});

export function useProjectProductionEstimate({
  projectId,
  initialProject = null,
  initialShotLists,
  initialProductionDays,
}: UseProjectProductionEstimateOptions): UseProjectProductionEstimateResult {
  const [project, setProject] = useState<CastingProject | null>(initialProject);
  const [shotLists, setShotLists] = useState<ShotList[]>(initialShotLists ?? []);
  const [productionDays, setProductionDays] = useState<ProductionDay[]>(initialProductionDays ?? []);
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [scenes, setScenes] = useState<SceneBreakdown[]>([]);
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  useEffect(() => {
    if (Array.isArray(initialShotLists)) {
      setShotLists(initialShotLists);
    }
  }, [initialShotLists]);

  useEffect(() => {
    if (Array.isArray(initialProductionDays)) {
      setProductionDays(initialProductionDays);
    }
  }, [initialProductionDays]);

  useEffect(() => {
    let cancelled = false;

    const loadEstimateContext = async () => {
      if (!projectId) {
        setProject(null);
        setShotLists([]);
        setProductionDays([]);
        setManuscript(null);
        setScenes([]);
        setDialogue([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [resolvedProject, resolvedShotLists, resolvedProductionDays, manuscripts] = await Promise.all([
          initialProject ? Promise.resolve(initialProject) : castingService.getProject(projectId),
          Array.isArray(initialShotLists) ? Promise.resolve(initialShotLists) : castingService.getShotLists(projectId),
          Array.isArray(initialProductionDays)
            ? Promise.resolve(initialProductionDays)
            : productionPlanningService.getProductionDays(projectId),
          manuscriptService.getManuscripts(projectId),
        ]);

        const primaryManuscript = [...manuscripts].sort((left, right) => {
          const leftTime = Date.parse(left.updatedAt || left.createdAt || '');
          const rightTime = Date.parse(right.updatedAt || right.createdAt || '');
          return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
        })[0] || null;

        const [resolvedScenes, resolvedDialogue] = primaryManuscript
          ? await Promise.all([
              manuscriptService.getScenes(primaryManuscript.id),
              manuscriptService.getDialogue(primaryManuscript.id),
            ])
          : [[], []];

        if (cancelled) {
          return;
        }

        setProject(resolvedProject);
        setShotLists(Array.isArray(resolvedShotLists) ? resolvedShotLists : []);
        setProductionDays(Array.isArray(resolvedProductionDays) ? resolvedProductionDays : []);
        setManuscript(primaryManuscript);
        setScenes(Array.isArray(resolvedScenes) ? resolvedScenes : []);
        setDialogue(Array.isArray(resolvedDialogue) ? resolvedDialogue : []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.error('[useProjectProductionEstimate] Failed to load project estimate context', loadError);
        setError('Kunne ikke laste produksjonsgrunnlaget for plan og estimat.');
        setProject(initialProject);
        setShotLists(Array.isArray(initialShotLists) ? initialShotLists : []);
        setProductionDays(Array.isArray(initialProductionDays) ? initialProductionDays : []);
        setManuscript(null);
        setScenes([]);
        setDialogue([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEstimateContext();
    return () => {
      cancelled = true;
    };
  }, [initialProductionDays, initialProject, initialShotLists, projectId]);

  const productionEstimate = useMemo(() => {
    if (!projectId) {
      return EMPTY_ESTIMATE;
    }
    return estimateContentProduction({
      project,
      manuscript,
      scenes,
      dialogue,
      shotLists,
      productionDays,
    });
  }, [dialogue, manuscript, productionDays, project, projectId, scenes, shotLists]);

  return {
    project,
    shotLists,
    productionDays,
    manuscript,
    scenes,
    dialogue,
    loading,
    error,
    productionEstimate,
  };
}
