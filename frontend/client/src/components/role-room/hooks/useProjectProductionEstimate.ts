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

const buildRecordSignature = <T extends { id?: string; updatedAt?: string; createdAt?: string }>(
  items?: T[] | null,
): string => {
  if (!Array.isArray(items) || items.length === 0) {
    return '[]';
  }

  return items
    .map((item, index) => `${item.id ?? index}:${item.updatedAt ?? item.createdAt ?? ''}`)
    .join('|');
};

const areRecordArraysEquivalent = <T extends { id?: string; updatedAt?: string; createdAt?: string }>(
  left: T[],
  right: T[],
): boolean => {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];
    if (
      (leftItem?.id ?? index) !== (rightItem?.id ?? index)
      || (leftItem?.updatedAt ?? leftItem?.createdAt ?? '') !== (rightItem?.updatedAt ?? rightItem?.createdAt ?? '')
    ) {
      return false;
    }
  }

  return true;
};

export function useProjectProductionEstimate({
  projectId,
  initialProject = null,
  initialShotLists,
  initialProductionDays,
}: UseProjectProductionEstimateOptions): UseProjectProductionEstimateResult {
  const initialProjectSignature = useMemo(
    () => `${initialProject?.id ?? 'null'}:${initialProject?.updatedAt ?? initialProject?.createdAt ?? ''}`,
    [initialProject?.createdAt, initialProject?.id, initialProject?.updatedAt],
  );
  const initialShotListsSignature = useMemo(
    () => buildRecordSignature(initialShotLists),
    [initialShotLists],
  );
  const initialProductionDaysSignature = useMemo(
    () => buildRecordSignature(initialProductionDays),
    [initialProductionDays],
  );
  const resolvedInitialProject = useMemo(
    () => initialProject,
    [initialProjectSignature],
  );
  const resolvedInitialShotLists = useMemo(
    () => (Array.isArray(initialShotLists) ? initialShotLists : undefined),
    [initialShotListsSignature],
  );
  const resolvedInitialProductionDays = useMemo(
    () => (Array.isArray(initialProductionDays) ? initialProductionDays : undefined),
    [initialProductionDaysSignature],
  );
  const [project, setProject] = useState<CastingProject | null>(initialProject);
  const [shotLists, setShotLists] = useState<ShotList[]>(initialShotLists ?? []);
  const [productionDays, setProductionDays] = useState<ProductionDay[]>(initialProductionDays ?? []);
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [scenes, setScenes] = useState<SceneBreakdown[]>([]);
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProject((previous) => (
      previous === resolvedInitialProject ? previous : resolvedInitialProject
    ));
  }, [resolvedInitialProject]);

  useEffect(() => {
    if (Array.isArray(resolvedInitialShotLists)) {
      setShotLists((previous) => (
        areRecordArraysEquivalent(previous, resolvedInitialShotLists) ? previous : resolvedInitialShotLists
      ));
    }
  }, [resolvedInitialShotLists]);

  useEffect(() => {
    if (Array.isArray(resolvedInitialProductionDays)) {
      setProductionDays((previous) => (
        areRecordArraysEquivalent(previous, resolvedInitialProductionDays) ? previous : resolvedInitialProductionDays
      ));
    }
  }, [resolvedInitialProductionDays]);

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
          resolvedInitialProject ? Promise.resolve(resolvedInitialProject) : castingService.getProject(projectId),
          Array.isArray(resolvedInitialShotLists) ? Promise.resolve(resolvedInitialShotLists) : castingService.getShotLists(projectId),
          Array.isArray(resolvedInitialProductionDays)
            ? Promise.resolve(resolvedInitialProductionDays)
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
        setProject(resolvedInitialProject);
        setShotLists(Array.isArray(resolvedInitialShotLists) ? resolvedInitialShotLists : []);
        setProductionDays(Array.isArray(resolvedInitialProductionDays) ? resolvedInitialProductionDays : []);
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
  }, [projectId, resolvedInitialProductionDays, resolvedInitialProject, resolvedInitialShotLists]);

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
