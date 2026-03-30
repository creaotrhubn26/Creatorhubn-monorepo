import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  Launch as LaunchIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import type {
  ProducerPlanningFrameworkStepKey,
  CastingProject,
  ProducerBrandGuideColor,
  ProducerClientIntake,
  ProducerClientLogicMode,
  ProducerClientMaterial,
  ProducerContentCalendarStatus,
  ProducerPhasePlanItem,
  ProducerPlanningPhase,
  ProducerPlanningStatus,
  ProducerProjectPlanning,
  ProductionDay,
  ShotList,
} from '../../models/casting';
import { castingService } from '../../services/castingService';
import { producerWorkflowService } from '../../services/producerWorkflowService';
import { onProducerWorkflowEvent } from '../../services/producerWorkflowEvents';
import { storyLogicService, type StoryLogicState } from '../../services/storyLogicService';
import type { ContentProductionEstimate } from '../../services/contentProductionEstimateService';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import {
  applyProducerClientGroundingToPlanning,
  applyStoryLogicToProducerPlanning,
  getProducerClientContributionTasks,
  getProducerContentLogicMomentKind,
  getProducerWorkspaceLocationForSurface,
  mergeProducerPlanningClientMomentsWithReviews,
  PRODUCER_CONTENT_LOGIC_MOMENT_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS,
  PRODUCER_PLANNING_CLIENT_MOMENT_LABELS,
  PRODUCER_PLANNING_FRAMEWORK_HELPERS,
  PRODUCER_PLANNING_FRAMEWORK_LABELS,
  PRODUCER_CONTENT_CALENDAR_STATUS_LABELS,
  PRODUCER_CONTENT_CHANNEL_OPTIONS,
  PRODUCER_CONTENT_FORMAT_OPTIONS,
  PRODUCER_PLANNING_PHASE_LABELS,
  PRODUCER_PLANNING_STATUS_LABELS,
  getProducerContentChannelOption,
  getPrimaryFormatForProducerChannel,
  getProducerContentFormatOption,
  getRecommendedFormatsForProducerChannel,
  getProducerStrategySnapshot,
  createProducerContentCalendarItem,
  normalizeProducerProjectPlanning,
  summarizeProducerClientGrounding,
} from '../../utils/producerProjectPlanning';
import type { ClientPortalWorkspaceFocus } from '../../utils/clientPortal';

type PlanningPanelTab = 'activation' | 'phase_plan' | 'calendar' | 'brand' | 'delivery';
type ActivationEditorMode = ProducerClientLogicMode;

interface ProducerClientPlanningPanelProps {
  project: CastingProject;
  productionEstimate: ContentProductionEstimate;
  shotLists: ShotList[];
  productionDays: ProductionDay[];
  readOnly?: boolean;
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onOpenShotList?: (focus?: { phase?: ProducerPlanningPhase | 'all'; shotListId?: string }) => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
}

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) {
    return '0 t';
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) {
    return `${remainder} min`;
  }
  if (remainder <= 0) {
    return `${hours} t`;
  }
  return `${hours} t ${remainder} min`;
};

const formatSeconds = (seconds: number): string => {
  if (seconds <= 0) {
    return '0:00';
  }
  const totalMinutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  return `${totalMinutes}:${String(remainderSeconds).padStart(2, '0')}`;
};

const toDateInputValue = (value?: string): string => {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
};

const withDateOffset = (date: Date, offsetDays: number): string => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + offsetDays);
  return nextDate.toISOString().slice(0, 10);
};

const parseLineSeparatedValues = (value: string): string[] => (
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
);

const stringifyLineSeparatedValues = (value: string[] | undefined): string => (
  Array.isArray(value) ? value.join('\n') : ''
);

const getPrimaryFormatSeconds = (estimate: ContentProductionEstimate): number => (
  estimate.formatEstimates.find((item) => item.emphasis === 'primary')?.estimatedSeconds
  ?? estimate.formatEstimates[0]?.estimatedSeconds
  ?? 0
);

const getPhaseLoadSummary = (
  phase: ProducerPlanningPhase,
  estimate: ContentProductionEstimate,
  shotLists: ShotList[],
): { headline: string; detail: string } => {
  if (phase === 'preproduction') {
    const unscheduledCount = estimate.productionDayLoads.find((item) => item.dayId === 'unscheduled')?.shotListCount ?? 0;
    return {
      headline: `${shotLists.length} shotlister i spill`,
      detail: unscheduledCount > 0
        ? `${unscheduledCount} shotlister mangler opptaksdag og bør prioriteres før klienten låser planen.`
        : `${estimate.suggestedShootDays} anbefalte opptaksdager basert på shotlist og manus.`,
    };
  }

  if (phase === 'production') {
    return {
      headline: `${formatMinutes(estimate.totalRealisticFieldMinutes)} realistisk feltbelastning`,
      detail: estimate.overloadedDayCount > 0
        ? `${estimate.overloadedDayCount} opptaksdager ser overbooket ut mot realistisk belastning.`
        : 'Opptaksdagen er innenfor beregnet belastning slik planene står nå.',
    };
  }

  return {
    headline: `${formatSeconds(getPrimaryFormatSeconds(estimate))} forventet hovedleveranse`,
    detail: `${estimate.formatEstimates.length} leveranseformat${estimate.formatEstimates.length === 1 ? '' : 'er'} kan planlegges ut fra samme materiale.`,
  };
};

const getPlanningTimelineRange = (phasePlan: ProducerPhasePlanItem[]): { start: Date; end: Date } | null => {
  const dates = phasePlan.flatMap((item) => [item.startDate, item.endDate])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (dates.length === 0) {
    return null;
  }

  const sorted = [...dates].sort((left, right) => left.getTime() - right.getTime());
  return {
    start: sorted[0],
    end: sorted[sorted.length - 1],
  };
};

const getBarMetrics = (range: { start: Date; end: Date } | null, startDate?: string, endDate?: string) => {
  if (!range || !startDate || !endDate) {
    return null;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const totalSpan = Math.max(1, range.end.getTime() - range.start.getTime());
  const left = ((start.getTime() - range.start.getTime()) / totalSpan) * 100;
  const width = Math.max(6, ((end.getTime() - start.getTime()) / totalSpan) * 100);
  return {
    left: Math.max(0, Math.min(100, left)),
    width: Math.max(6, Math.min(100 - left, width)),
  };
};

const createBrandColor = (): ProducerBrandGuideColor => ({
  id: globalThis.crypto?.randomUUID?.() ?? `brand-color-${Date.now()}-${Math.round(Math.random() * 1000)}`,
  label: '',
  hex: '#ffffff',
  usage: '',
});

const getFrameworkStep = (planning: ProducerProjectPlanning, key: ProducerPlanningFrameworkStepKey) => (
  planning.activationPlan.framework?.find((item) => item.key === key)
);

const EMPTY_CLIENT_INTAKE: ProducerClientIntake = {
  projectGoal: '',
  deliverables: '',
  targetAudience: '',
  keyMessage: '',
  timingConstraints: '',
  brandNotes: '',
  materialOverview: '',
  referenceLinks: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  additionalNotes: '',
};

const ensureContentLogic = (planning: ProducerProjectPlanning) => ({
  mode: (planning.contentLogic?.mode ?? 'content_logic') as ActivationEditorMode,
  objective: planning.contentLogic?.objective ?? '',
  audience: planning.contentLogic?.audience ?? '',
  hook: planning.contentLogic?.hook ?? '',
  coreMessage: planning.contentLogic?.coreMessage ?? '',
  proofPoints: planning.contentLogic?.proofPoints ?? [],
  callToAction: planning.contentLogic?.callToAction ?? '',
  distributionPlan: planning.contentLogic?.distributionPlan ?? '',
  successSignals: planning.contentLogic?.successSignals ?? [],
});

export default function ProducerClientPlanningPanel({
  project,
  productionEstimate,
  shotLists,
  productionDays,
  readOnly = false,
  onProjectUpdated,
  onOpenShotList,
  onOpenMedia,
}: ProducerClientPlanningPanelProps) {
  const [activeTab, setActiveTab] = useState<PlanningPanelTab>('activation');
  const normalizedProjectPlanning = useMemo(
    () => normalizeProducerProjectPlanning(project),
    [project],
  );
  const [draft, setDraft] = useState<ProducerProjectPlanning>(() => normalizedProjectPlanning);
  const [activationEditorMode, setActivationEditorMode] = useState<ActivationEditorMode>(
    ensureContentLogic(normalizedProjectPlanning).mode,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [clientIntake, setClientIntake] = useState<ProducerClientIntake>(EMPTY_CLIENT_INTAKE);
  const [clientMaterials, setClientMaterials] = useState<ProducerClientMaterial[]>([]);
  const [clientWorkspaceLoading, setClientWorkspaceLoading] = useState(false);
  const [clientWorkspaceError, setClientWorkspaceError] = useState<string | null>(null);
  const [storyLogicData, setStoryLogicData] = useState<StoryLogicState | null>(null);
  const {
    items: reviewItems,
    loading: reviewsLoading,
    error: reviewsError,
  } = useProducerReviews(project.id);

  useEffect(() => {
    setDraft(normalizedProjectPlanning);
    setActivationEditorMode(ensureContentLogic(normalizedProjectPlanning).mode);
    setLastSavedAt(normalizedProjectPlanning.updatedAt ?? null);
    setSaveError(null);
  }, [normalizedProjectPlanning]);

  useEffect(() => {
    if (readOnly) {
      return;
    }

    void producerWorkflowService.ensurePlanningClientReviews(project.id, normalizedProjectPlanning).catch((syncError) => {
      console.error('[ProducerClientPlanningPanel] Failed to ensure planning review flow', syncError);
    });
  }, [normalizedProjectPlanning, project.id, readOnly]);

  useEffect(() => {
    let cancelled = false;

    const loadClientWorkspace = async () => {
      setClientWorkspaceLoading(true);
      setClientWorkspaceError(null);
      try {
        const [nextIntake, nextMaterials, nextStoryLogic] = await Promise.all([
          producerWorkflowService.getClientIntake(project.id),
          producerWorkflowService.getClientMaterials(project.id),
          storyLogicService.getStoryLogic(project.id),
        ]);
        if (cancelled) {
          return;
        }
        setClientIntake({
          ...EMPTY_CLIENT_INTAKE,
          ...nextIntake,
        });
        setClientMaterials(nextMaterials);
        setStoryLogicData(nextStoryLogic);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error('[ProducerClientPlanningPanel] Failed to load client grounding', error);
        setClientWorkspaceError('Kunne ikke hente klientgrunnlag og story logic.');
      } finally {
        if (!cancelled) {
          setClientWorkspaceLoading(false);
        }
      }
    };

    void loadClientWorkspace();

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => onProducerWorkflowEvent((payload) => {
    if (payload.projectId !== project.id || payload.domain !== 'project') {
      return;
    }

    void (async () => {
      try {
        const [nextIntake, nextMaterials] = await Promise.all([
          producerWorkflowService.getClientIntake(project.id),
          producerWorkflowService.getClientMaterials(project.id),
        ]);
        setClientIntake({
          ...EMPTY_CLIENT_INTAKE,
          ...nextIntake,
        });
        setClientMaterials(nextMaterials);
      } catch (error) {
        console.error('[ProducerClientPlanningPanel] Failed to refresh client grounding', error);
      }
    })();
  }), [project.id]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalizedProjectPlanning),
    [draft, normalizedProjectPlanning],
  );

  const planningRange = useMemo(
    () => getPlanningTimelineRange(draft.phasePlan),
    [draft.phasePlan],
  );

  const contentCalendarCountByPhase = useMemo(
    () => draft.contentCalendar.reduce<Record<ProducerPlanningPhase, number>>((acc, item) => {
      acc[item.phase] += 1;
      return acc;
    }, {
      preproduction: 0,
      production: 0,
      postproduction: 0,
    }),
    [draft.contentCalendar],
  );

  const strategySnapshot = useMemo(
    () => getProducerStrategySnapshot(draft),
    [draft],
  );
  const contentLogicDraft = useMemo(
    () => ensureContentLogic(draft),
    [draft],
  );

  const clientGroundingSummary = useMemo(
    () => summarizeProducerClientGrounding(clientIntake, clientMaterials),
    [clientIntake, clientMaterials],
  );
  const clientContributionTasks = useMemo(
    () => getProducerClientContributionTasks(draft, clientIntake, clientMaterials),
    [clientIntake, clientMaterials, draft],
  );
  const openClientContributionTasks = useMemo(
    () => clientContributionTasks.filter((task) => task.status !== 'ready'),
    [clientContributionTasks],
  );
  const briefWorkspaceFocus = useMemo<ClientPortalWorkspaceFocus>(() => {
    const location = getProducerWorkspaceLocationForSurface(draft.workspaceNavigation, 'brief');
    return {
      workspace: 'brief',
      sectionId: location?.sectionId,
      pageId: location?.pageId,
    };
  }, [draft.workspaceNavigation]);

  const storyLogicSnapshot = useMemo(() => {
    if (!storyLogicData) {
      return [];
    }

    return [
      { label: 'Premiss', value: storyLogicData.concept.corePremise },
      { label: 'Unik vinkel', value: storyLogicData.concept.uniqueAngle },
      { label: 'Full logline', value: storyLogicData.logline.fullLogline },
      { label: 'Tema', value: storyLogicData.theme.themeStatement || storyLogicData.theme.centralTheme },
    ].filter((item) => item.value && item.value.trim().length > 0);
  }, [storyLogicData]);

  const clientMoments = useMemo(
    () => mergeProducerPlanningClientMomentsWithReviews(draft, reviewItems),
    [draft, reviewItems],
  );

  const updateContentCalendarItem = (
    index: number,
    updater: (item: ProducerContentCalendarItem) => ProducerContentCalendarItem,
  ) => {
    setDraft((previous) => ({
      ...previous,
      contentCalendar: previous.contentCalendar.map((entry, entryIndex) => (
        entryIndex === index ? updater(entry) : entry
      )),
    }));
  };

  const updateContentLogic = (
    patch: Partial<ReturnType<typeof ensureContentLogic>>,
  ) => {
    setDraft((previous) => {
      const nextContentLogic = {
        ...ensureContentLogic(previous),
        ...patch,
      };

      return {
        ...previous,
        contentLogic: nextContentLogic,
        activationPlan: {
          ...previous.activationPlan,
          idea: patch.hook ?? previous.activationPlan.idea,
          activation: patch.distributionPlan ?? previous.activationPlan.activation,
          targetAudience: patch.audience ?? previous.activationPlan.targetAudience,
          businessGoal: patch.objective ?? previous.activationPlan.businessGoal,
          coreMessage: patch.coreMessage ?? previous.activationPlan.coreMessage,
          successSignals: patch.successSignals ?? previous.activationPlan.successSignals,
        },
      };
    });
  };

  const syncPlanningFromEstimate = () => {
    const firstProductionDay = productionDays
      .map((day) => day.date)
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    const startAnchor = firstProductionDay ? new Date(firstProductionDay) : new Date();
    const productionStart = withDateOffset(startAnchor, firstProductionDay ? 0 : 7);
    const productionEnd = withDateOffset(new Date(productionStart), Math.max(0, productionEstimate.suggestedShootDays - 1));
    const preStart = withDateOffset(new Date(productionStart), -10);
    const preEnd = withDateOffset(new Date(productionStart), -1);
    const postStart = withDateOffset(new Date(productionEnd), 1);
    const postDurationDays = Math.max(
      3,
      Math.ceil(getPrimaryFormatSeconds(productionEstimate) / 90),
    );
    const postEnd = withDateOffset(new Date(postStart), postDurationDays);
    const activationAnchor = [draft.activationPlan.direction, draft.activationPlan.activation]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(' · ');

    const nextPhasePlan = draft.phasePlan.map((item) => {
      if (item.phase === 'preproduction') {
          return {
            ...item,
            startDate: item.startDate || preStart,
            endDate: item.endDate || preEnd,
            linkedShotListIds: shotLists.filter((shotList) => !productionDays.some((day) => day.scenes?.includes(shotList.sceneId))).map((shotList) => shotList.id),
          notes: `${productionEstimate.suggestedShootDays} anbefalte opptaksdager og ${shotLists.length} shotlister må avklares før opptak.${activationAnchor ? ` ${activationAnchor}.` : ''}`,
        };
      }
      if (item.phase === 'production') {
        return {
          ...item,
          startDate: item.startDate || productionStart,
          endDate: item.endDate || productionEnd,
          linkedShotListIds: shotLists.map((shotList) => shotList.id),
          notes: `${formatMinutes(productionEstimate.totalRealisticFieldMinutes)} realistisk opptaksbelastning fordelt på ${Math.max(1, productionDays.length || productionEstimate.suggestedShootDays)} dager.`,
        };
      }
      return {
        ...item,
        startDate: item.startDate || postStart,
        endDate: item.endDate || postEnd,
        linkedShotListIds: shotLists.map((shotList) => shotList.id),
        notes: `${productionEstimate.formatEstimates.length} leveranseformat${productionEstimate.formatEstimates.length === 1 ? '' : 'er'} planlagt ut fra samme opptak.`,
      };
    });

    const existingCalendarKeys = new Set(
      draft.contentCalendar.map((item) => `${item.title.toLowerCase()}::${item.format || ''}`),
    );
    const generatedCalendarItems = productionEstimate.formatEstimates
      .filter((item) => !existingCalendarKeys.has(`${item.label.toLowerCase()}::${item.aspectRatio}`))
      .map((item, index) => ({
        ...createProducerContentCalendarItem('postproduction'),
        title: item.label,
        channel: item.emphasis === 'primary' ? 'Hovedleveranse' : 'Distribusjon',
        format: item.aspectRatio,
        phase: 'postproduction' as const,
        status: 'planned' as ProducerContentCalendarStatus,
        publishAt: withDateOffset(new Date(postStart), index * 2),
        notes: `${formatSeconds(item.estimatedSeconds)} estimert lengde basert på manus og shotlist.`,
      }));

    setDraft((previous) => ({
      ...previous,
      phasePlan: nextPhasePlan,
      contentCalendar: [...previous.contentCalendar, ...generatedCalendarItems],
      updatedAt: previous.updatedAt,
    }));
  };

  const syncPlanningFromClientGrounding = () => {
    setDraft((previous) => applyProducerClientGroundingToPlanning(previous, clientIntake, clientMaterials));
  };

  const syncPlanningFromStoryLogic = () => {
    if (!storyLogicData) {
      return;
    }
    setDraft((previous) => applyStoryLogicToProducerPlanning(previous, storyLogicData));
  };

  const handleSave = async () => {
    let savedProject = false;
    try {
      setSaving(true);
      setSaveError(null);
      const nextPlanning: ProducerProjectPlanning = {
        ...draft,
        updatedAt: new Date().toISOString(),
      };
      const nextProject: CastingProject = {
        ...project,
        producerPlanning: nextPlanning,
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveProject(nextProject);
      savedProject = true;
      await producerWorkflowService.syncPlanningClientReviews(project.id, nextPlanning);
      await onProjectUpdated?.(nextProject);
      setDraft(nextPlanning);
      setLastSavedAt(nextPlanning.updatedAt ?? null);
    } catch (error) {
      console.error('[ProducerClientPlanningPanel] Failed to save planning data', error);
      setSaveError(
        savedProject
          ? 'Planen ble lagret, men klientpunkter og godkjenningsflyt kunne ikke synkroniseres.'
          : 'Kunne ikke lagre klient- og produksjonsplanen.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.82) 100%)',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={1.25} sx={{ p: { xs: 1.25, md: 1.5 } }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ lg: 'center' }}>
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.02rem', md: '1.12rem' } }}>
              Klientplan og produksjonsgrunnlag
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem', maxWidth: 860, mt: 0.35 }}>
              Samler retning, idé, aktivering, faseplan, content-kalender, merkevareguide og leveringsrutine i samme arbeidsflate slik at klient, produsent og team planlegger ut fra samme sannhet.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Chip
              size="small"
              label={`${productionEstimate.formatEstimates.length} formater`}
              sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
            />
            <Chip
              size="small"
              label={`${productionEstimate.suggestedShootDays} opptaksdager`}
              sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#a7f3d0' }}
            />
            <Chip
              size="small"
              label={`Hovedfilm ${formatSeconds(getPrimaryFormatSeconds(productionEstimate))}`}
              sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }}
            />
            {!readOnly ? (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={syncPlanningFromEstimate}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Synk fra estimat
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={syncPlanningFromClientGrounding}
                  disabled={clientWorkspaceLoading}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Fyll fra klientbrief
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={syncPlanningFromStoryLogic}
                  disabled={!storyLogicData}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Fyll fra story logic
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => { void handleSave(); }}
                  disabled={saving || !dirty}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1d4ed8' }}
                >
                  Lagre plan
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Stack>

        {strategySnapshot.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {strategySnapshot.map((item) => (
              <Chip
                key={item.label}
                size="small"
                label={`${item.label}: ${item.value}`}
                sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff', maxWidth: '100%' }}
              />
            ))}
          </Stack>
        ) : null}

        {saveError ? <Alert severity="error">{saveError}</Alert> : null}
        {!saveError && lastSavedAt ? (
          <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.78rem' }}>
            Sist lagret {new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastSavedAt))}
          </Typography>
        ) : null}
        {clientWorkspaceError ? <Alert severity="warning">{clientWorkspaceError}</Alert> : null}
        {clientWorkspaceLoading ? <Alert severity="info">Henter klientgrunnlag og story logic.</Alert> : null}
        {reviewsError ? <Alert severity="warning">{reviewsError}</Alert> : null}
        {reviewsLoading ? <Alert severity="info">Oppdaterer klientpunkter og godkjenningsstatus.</Alert> : null}

        <Box
          sx={{
            p: 1.2,
            borderRadius: 1.6,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'rgba(2,6,23,0.42)',
          }}
        >
          <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25} justifyContent="space-between">
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>
                Arbeidsgrunnlag fra klient
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.86rem' }}>
                Planen kan fylles direkte fra brief, materialer og story logic, slik at retning, idé og aktivering ikke må skrives opp på nytt.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Chip
                size="small"
                label={`Brief ${clientGroundingSummary.briefReadyCount}/${clientGroundingSummary.totalBriefFields}`}
                sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
              />
              <Chip
                size="small"
                label={`Materialer ${clientGroundingSummary.materialCount}`}
                sx={{ bgcolor: 'rgba(16,185,129,0.16)', color: '#a7f3d0' }}
              />
              <Chip
                size="small"
                label={storyLogicSnapshot.length > 0 ? `Story logic ${storyLogicSnapshot.length} signaler` : 'Story logic ikke fylt ut'}
                sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }}
              />
              {onOpenMedia ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LaunchIcon />}
                  onClick={() => onOpenMedia(briefWorkspaceFocus)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Åpne brief og materiale
                </Button>
              ) : null}
            </Stack>
          </Stack>

          <Box
            sx={{
              mt: 1.2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.15,
            }}
          >
            <Box
              sx={{
                p: 1.1,
                borderRadius: 1.4,
                border: '1px solid rgba(148,163,184,0.14)',
                background: 'rgba(15,23,42,0.52)',
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                Brief og materiale
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
                {Object.entries(clientGroundingSummary.materialsByPhase).map(([phase, count]) => (
                  <Chip
                    key={phase}
                    size="small"
                    label={`${PRODUCER_PLANNING_PHASE_LABELS[phase as ProducerPlanningPhase]} ${count}`}
                    sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1' }}
                  />
                ))}
              </Stack>
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem' }}>
                {clientGroundingSummary.topMaterialTitles.length > 0
                  ? `Nøkkelmateriale: ${clientGroundingSummary.topMaterialTitles.join(', ')}`
                  : 'Ingen materialtitler er registrert ennå.'}
              </Typography>
              {clientGroundingSummary.missingEssentials.length > 0 ? (
                <Stack spacing={0.45} sx={{ mt: 0.8 }}>
                  {clientGroundingSummary.missingEssentials.slice(0, 3).map((item) => (
                    <Typography key={item} sx={{ color: '#fcd34d', fontSize: '0.8rem' }}>
                      • {item}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: '#86efac', fontSize: '0.8rem', mt: 0.8 }}>
                  Klientgrunnlaget dekker de viktigste punktene for videre planlegging.
                </Typography>
              )}
            </Box>

            <Box
              sx={{
                p: 1.1,
                borderRadius: 1.4,
                border: '1px solid rgba(148,163,184,0.14)',
                background: 'rgba(15,23,42,0.52)',
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                Story logic som planmotor
              </Typography>
              {storyLogicSnapshot.length > 0 ? (
                <Stack spacing={0.65}>
                  {storyLogicSnapshot.map((item) => (
                    <Box key={item.label}>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.2 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem' }}>
                  Story logic er ikke fylt ut ennå. Du kan fortsatt fylle planen direkte fra klientbrief og materiale.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            p: 1.2,
            borderRadius: 1.6,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'rgba(2,6,23,0.42)',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
            Gantt-oversikt
          </Typography>
          <Stack spacing={1}>
            {draft.phasePlan.map((item) => {
              const metrics = getBarMetrics(planningRange, item.startDate, item.endDate);
              const loadSummary = getPhaseLoadSummary(item.phase, productionEstimate, shotLists);
              return (
                <Box key={item.phase}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                      {PRODUCER_PLANNING_PHASE_LABELS[item.phase]}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap">
                      <Chip size="small" label={loadSummary.headline} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }} />
                      <Chip size="small" label={`${contentCalendarCountByPhase[item.phase]} kalenderpunkt`} sx={{ bgcolor: 'rgba(192,132,252,0.14)', color: '#e9d5ff' }} />
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      position: 'relative',
                      height: 16,
                      borderRadius: 999,
                      bgcolor: 'rgba(15,23,42,0.9)',
                      border: '1px solid rgba(148,163,184,0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: 'linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
                        backgroundSize: '8.33% 100%',
                      }}
                    />
                    {metrics ? (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${metrics.left}%`,
                          width: `${metrics.width}%`,
                          top: 2,
                          bottom: 2,
                          borderRadius: 999,
                          background: item.phase === 'preproduction'
                            ? 'linear-gradient(90deg, rgba(59,130,246,0.92) 0%, rgba(37,99,235,0.84) 100%)'
                            : item.phase === 'production'
                              ? 'linear-gradient(90deg, rgba(16,185,129,0.92) 0%, rgba(5,150,105,0.84) 100%)'
                              : 'linear-gradient(90deg, rgba(251,191,36,0.92) 0%, rgba(217,119,6,0.84) 100%)',
                        }}
                      />
                    ) : null}
                  </Box>
                  <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.82rem', mt: 0.55 }}>
                    {item.startDate && item.endDate
                      ? `${toDateInputValue(item.startDate)} til ${toDateInputValue(item.endDate)}`
                      : 'Ingen datoer satt ennå. Bruk Synk fra estimat eller legg dem inn manuelt.'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.8rem', mt: 0.25 }}>
                    {loadSummary.detail}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Box
          sx={{
            p: 1.2,
            borderRadius: 1.6,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'rgba(2,6,23,0.42)',
          }}
        >
          <Stack spacing={1}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                Klientflyt og publiseringspunkter
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.85rem', mt: 0.35 }}>
                Faseplan og content-kalender brukes her som én samlet klientflyt, slik at godkjenninger og publisering ikke blir liggende i hvert sitt spor.
              </Typography>
            </Box>
            <Stack spacing={0.9}>
              {clientMoments.slice(0, 6).map((moment) => {
                const contentLogicMomentKind = getProducerContentLogicMomentKind(moment.id);
                const isContentLogicMoment = Boolean(contentLogicMomentKind);
                const contentLogicMomentLabel = contentLogicMomentKind
                  ? PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]
                  : '';
                return (
                  <Box
                    key={moment.id}
                    sx={{
                      p: 1,
                      borderRadius: 1.25,
                      border: isContentLogicMoment
                        ? '1px solid rgba(167,139,250,0.26)'
                        : '1px solid rgba(148,163,184,0.14)',
                      background: isContentLogicMoment
                        ? 'rgba(76,29,149,0.14)'
                        : 'rgba(15,23,42,0.55)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 0.4 }}>
                          <Chip
                            size="small"
                            label={isContentLogicMoment ? 'Content Logic' : PRODUCER_PLANNING_CLIENT_MOMENT_LABELS[moment.type]}
                            sx={{
                              bgcolor: isContentLogicMoment ? 'rgba(167,139,250,0.18)' : 'rgba(59,130,246,0.14)',
                              color: isContentLogicMoment ? '#ede9fe' : '#bfdbfe',
                            }}
                          />
                          <Chip
                            size="small"
                            label={isContentLogicMoment ? contentLogicMomentLabel : PRODUCER_PLANNING_PHASE_LABELS[moment.phase]}
                            sx={{
                              bgcolor: isContentLogicMoment ? 'rgba(34,211,238,0.14)' : 'rgba(192,132,252,0.14)',
                              color: isContentLogicMoment ? '#cffafe' : '#e9d5ff',
                            }}
                          />
                          <Chip
                            size="small"
                            label={moment.reviewStatusLabel ?? moment.statusLabel}
                            sx={{
                              bgcolor: moment.reviewStatus === 'approved'
                                ? 'rgba(16,185,129,0.16)'
                                : moment.reviewStatus === 'changes_requested' || moment.reviewStatus === 'rejected'
                                  ? 'rgba(248,113,113,0.16)'
                                  : 'rgba(148,163,184,0.16)',
                              color: moment.reviewStatus === 'approved'
                                ? '#a7f3d0'
                                : moment.reviewStatus === 'changes_requested' || moment.reviewStatus === 'rejected'
                                  ? '#fecaca'
                                  : '#cbd5e1',
                            }}
                          />
                        </Stack>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                          {moment.title}
                        </Typography>
                        <Typography sx={{ color: isContentLogicMoment ? 'rgba(233,213,255,0.9)' : 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                          {moment.detail || 'Ingen detaljer lagt inn ennå.'}
                        </Typography>
                        {isContentLogicMoment ? (
                          <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.78rem', mt: 0.3 }}>
                            Content Logic-punktet låser innholdsvalg tidlig, før resten av produksjonsløpet tar over.
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack spacing={0.6} alignItems={{ lg: 'flex-end' }}>
                        {moment.date ? (
                          <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.78rem' }}>
                            {moment.date}
                          </Typography>
                        ) : null}
                        {moment.drivenByReview ? (
                          <Typography sx={{ color: 'rgba(148,163,184,0.84)', fontSize: '0.76rem', textAlign: { lg: 'right' } }}>
                            {[
                              moment.commentCount ? `${moment.commentCount} kommentar${moment.commentCount === 1 ? '' : 'er'}` : '',
                              moment.reviewDecisionAt ? `Beslutning ${moment.reviewDecisionAt}` : moment.reviewRequestedAt ? `Sendt ${moment.reviewRequestedAt}` : '',
                            ].filter(Boolean).join(' · ') || 'Klientpunktet styres av reviewflyten'}
                          </Typography>
                        ) : null}
                        {moment.linkedShotListId && !isContentLogicMoment && onOpenShotList ? (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<LaunchIcon />}
                          onClick={() => onOpenShotList({ phase: moment.phase, shotListId: moment.linkedShotListId })}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Åpne shotlist
                        </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        </Box>

        <Tabs
          value={activeTab}
          onChange={(_event, value: PlanningPanelTab) => setActiveTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            borderBottom: '1px solid rgba(148,163,184,0.16)',
            '& .MuiTab-root': {
              textTransform: 'none',
              color: 'rgba(203,213,225,0.72)',
              fontWeight: 700,
              minHeight: 42,
            },
            '& .Mui-selected': {
              color: '#f8fafc',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#fbbf24',
            },
          }}
        >
          <Tab value="activation" label="Content Logic" />
          <Tab value="phase_plan" label="Faseplan" />
          <Tab value="calendar" label="Content-kalender" />
          <Tab value="brand" label="Merkevareguide" />
          <Tab value="delivery" label="Leveringsrutine" />
        </Tabs>

        {activeTab === 'activation' ? (
          <Stack spacing={1.2}>
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem' }}>
              `Content Logic` er innholdsprodusentens og klientens arbeidsmodus. Den gjør mål, hook, budskap, bevis og CTA konkrete uten å endre produksjonsteamets separate `Story Logic`.
            </Typography>

            <ToggleButtonGroup
              size="small"
              exclusive
              value={activationEditorMode}
              onChange={(_, value: ActivationEditorMode | null) => {
                if (!value) {
                  return;
                }
                setActivationEditorMode(value);
                updateContentLogic({ mode: value });
              }}
              sx={{
                gap: 0.7,
                flexWrap: 'wrap',
                '& .MuiToggleButton-root': {
                  borderRadius: '999px !important',
                  px: 1.2,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: 'rgba(148,163,184,0.18)',
                  color: 'rgba(226,232,240,0.82)',
                },
                '& .Mui-selected': {
                  bgcolor: 'rgba(56,189,248,0.16) !important',
                  borderColor: 'rgba(56,189,248,0.34) !important',
                  color: '#e0f2fe !important',
                },
              }}
            >
              <ToggleButton value="content_logic">Content Logic</ToggleButton>
              <ToggleButton value="activation_plan">Planramme</ToggleButton>
            </ToggleButtonGroup>

            {activationEditorMode === 'content_logic' ? (
              <Stack spacing={1.15}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 1.5,
                    border: '1px solid rgba(56,189,248,0.2)',
                    background: 'rgba(8,47,73,0.18)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Arbeid med innholdet slik klienten faktisk tar stilling til det
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.84rem', mt: 0.45 }}>
                    Her definerer dere hva innholdet skal oppnå, hvilken krok som skal stoppe scrollen, hva som beviser budskapet, og hvilken handling publikum skal ta etterpå.
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
                  <TextField
                    size="small"
                    label="Mål"
                    helperText="Hva innholdet skal oppnå for virksomheten."
                    value={contentLogicDraft.objective}
                    disabled={readOnly}
                    onChange={(event) => updateContentLogic({ objective: event.target.value })}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                  <TextField
                    size="small"
                    label="Målgruppe"
                    helperText="Hvem innholdet må treffe og være relevant for."
                    value={contentLogicDraft.audience}
                    disabled={readOnly}
                    onChange={(event) => updateContentLogic({ audience: event.target.value })}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
                  <TextField
                    size="small"
                    label="Hook"
                    helperText="Første linje, første bilde eller første idé som skal få folk til å stoppe opp."
                    value={contentLogicDraft.hook}
                    disabled={readOnly}
                    onChange={(event) => updateContentLogic({ hook: event.target.value })}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                  <TextField
                    size="small"
                    label="CTA"
                    helperText="Hva publikum konkret skal gjøre etter å ha sett innholdet."
                    value={contentLogicDraft.callToAction}
                    disabled={readOnly}
                    onChange={(event) => updateContentLogic({ callToAction: event.target.value })}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                </Stack>

                <TextField
                  size="small"
                  label="Kjernebudskap"
                  multiline
                  minRows={2}
                  value={contentLogicDraft.coreMessage}
                  disabled={readOnly}
                  onChange={(event) => updateContentLogic({ coreMessage: event.target.value })}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />

                <TextField
                  size="small"
                  label="Bevis / proof points (én per linje)"
                  multiline
                  minRows={3}
                  value={stringifyLineSeparatedValues(contentLogicDraft.proofPoints)}
                  disabled={readOnly}
                  onChange={(event) => updateContentLogic({ proofPoints: parseLineSeparatedValues(event.target.value) })}
                  helperText="Konkrete momenter som underbygger budskapet: tall, referanser, egenskaper, kundeverdi eller demonstrasjoner."
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                />

                <TextField
                  size="small"
                  label="Distribusjon og kanalbruk"
                  multiline
                  minRows={2}
                  value={contentLogicDraft.distributionPlan}
                  disabled={readOnly}
                  onChange={(event) => updateContentLogic({ distributionPlan: event.target.value })}
                  helperText="Hvordan budskapet skal fordeles mellom nettside, feed, reels, annonser eller andre flater."
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                />

                <TextField
                  size="small"
                  label="Tegn på suksess (én per linje)"
                  multiline
                  minRows={3}
                  value={stringifyLineSeparatedValues(contentLogicDraft.successSignals)}
                  disabled={readOnly}
                  onChange={(event) => updateContentLogic({ successSignals: parseLineSeparatedValues(event.target.value) })}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />

                <Box
                  sx={{
                    p: 1.15,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.18)',
                    background: 'rgba(15,23,42,0.52)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.45 }}>
                    Grunnlag fra produksjonsteamets Story Logic
                  </Typography>
                  <Typography sx={{ color: 'rgba(148,163,184,0.84)', fontSize: '0.82rem', mb: 1 }}>
                    Story Logic beholdes som eget system for produksjonsteamet. Her kan du bare hente inn relevante signaler og oversette dem til klientvennlige content-beslutninger.
                  </Typography>
                  {storyLogicSnapshot.length > 0 ? (
                    <Stack spacing={0.65}>
                      {storyLogicSnapshot.map((item) => (
                        <Box key={item.label}>
                          <Typography sx={{ color: '#e2e8f0', fontSize: '0.82rem', fontWeight: 700 }}>
                            {item.label}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.2 }}>
                            {item.value}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem' }}>
                      Story Logic er ikke fylt ut ennå. Det stopper ikke Content Logic for klient og innholdsprodusent.
                    </Typography>
                  )}
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.2}>
                <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.88rem' }}>
                  `Planramme` bevarer den eksisterende produsentlogikken med retning, idé, aktivering og faseforankring. Den brukes fortsatt videre i plan, reviews og leveranser.
                </Typography>

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
                  <TextField
                    size="small"
                    label="Retning"
                    helperText="Hva eventet eller produksjonen skal oppnå."
                    value={draft.activationPlan.direction ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft((previous) => ({
                        ...previous,
                        activationPlan: {
                          ...previous.activationPlan,
                          direction: event.target.value,
                        },
                      }));
                    }}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                  <TextField
                    size="small"
                    label="Idé"
                    helperText="Hvorfor folk skal bry seg, møte opp eller følge med."
                    value={draft.activationPlan.idea ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft((previous) => ({
                        ...previous,
                        activationPlan: {
                          ...previous.activationPlan,
                          idea: event.target.value,
                        },
                      }));
                    }}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                  <TextField
                    size="small"
                    label="Aktivering"
                    helperText="Hvordan kampanjen gjør eventet synlig og effektivt."
                    value={draft.activationPlan.activation ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft((previous) => ({
                        ...previous,
                        activationPlan: {
                          ...previous.activationPlan,
                          activation: event.target.value,
                        },
                      }));
                    }}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                    FormHelperTextProps={{ sx: { color: 'rgba(148,163,184,0.86)' } }}
                  />
                </Stack>

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
                  <TextField
                    size="small"
                    label="Målgruppe"
                    value={draft.activationPlan.targetAudience ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft((previous) => ({
                        ...previous,
                        activationPlan: {
                          ...previous.activationPlan,
                          targetAudience: event.target.value,
                        },
                      }));
                    }}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <TextField
                    size="small"
                    label="Forretningsmål"
                    value={draft.activationPlan.businessGoal ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      setDraft((previous) => ({
                        ...previous,
                        activationPlan: {
                          ...previous.activationPlan,
                          businessGoal: event.target.value,
                        },
                      }));
                    }}
                    fullWidth
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                </Stack>

                <TextField
                  size="small"
                  label="Kjernebudskap"
                  multiline
                  minRows={2}
                  value={draft.activationPlan.coreMessage ?? ''}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      activationPlan: {
                        ...previous.activationPlan,
                        coreMessage: event.target.value,
                      },
                    }));
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />

                <TextField
                  size="small"
                  label="Tegn på suksess (én per linje)"
                  multiline
                  minRows={3}
                  value={stringifyLineSeparatedValues(draft.activationPlan.successSignals)}
                  disabled={readOnly}
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      activationPlan: {
                        ...previous.activationPlan,
                        successSignals: parseLineSeparatedValues(event.target.value),
                      },
                    }));
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />

                <Stack spacing={1.1}>
                  {(draft.activationPlan.framework ?? []).map((section) => (
                    <Box
                      key={section.key}
                      sx={{
                        p: 1.2,
                        borderRadius: 1.5,
                        border: '1px solid rgba(148,163,184,0.18)',
                        background: 'rgba(15,23,42,0.52)',
                      }}
                    >
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                        {PRODUCER_PLANNING_FRAMEWORK_LABELS[section.key]}
                      </Typography>
                      <Typography sx={{ color: 'rgba(148,163,184,0.86)', fontSize: '0.82rem', mt: 0.35, mb: 1 }}>
                        {PRODUCER_PLANNING_FRAMEWORK_HELPERS[section.key]}
                      </Typography>
                      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.1}>
                        <TextField
                          size="small"
                          label="Fokus"
                          fullWidth
                          value={getFrameworkStep(draft, section.key)?.focus ?? ''}
                          disabled={readOnly}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setDraft((previous) => ({
                              ...previous,
                              activationPlan: {
                                ...previous.activationPlan,
                                framework: (previous.activationPlan.framework ?? []).map((entry) => (
                                  entry.key === section.key ? { ...entry, focus: nextValue } : entry
                                )),
                              },
                            }));
                          }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <TextField
                          size="small"
                          label="Leveranse / utfall"
                          fullWidth
                          value={getFrameworkStep(draft, section.key)?.output ?? ''}
                          disabled={readOnly}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setDraft((previous) => ({
                              ...previous,
                              activationPlan: {
                                ...previous.activationPlan,
                                framework: (previous.activationPlan.framework ?? []).map((entry) => (
                                  entry.key === section.key ? { ...entry, output: nextValue } : entry
                                )),
                              },
                            }));
                          }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                      </Stack>
                      <TextField
                        size="small"
                        label="Notater"
                        fullWidth
                        multiline
                        minRows={2}
                        sx={{ mt: 1.1 }}
                        value={getFrameworkStep(draft, section.key)?.notes ?? ''}
                        disabled={readOnly}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setDraft((previous) => ({
                            ...previous,
                            activationPlan: {
                              ...previous.activationPlan,
                              framework: (previous.activationPlan.framework ?? []).map((entry) => (
                                entry.key === section.key ? { ...entry, notes: nextValue } : entry
                              )),
                            },
                          }));
                        }}
                        InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        ) : null}

        {activeTab === 'phase_plan' ? (
          <Stack spacing={1.2}>
            {draft.phasePlan.map((item, index) => (
              <Box
                key={item.phase}
                sx={{
                  p: 1.2,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: 'rgba(15,23,42,0.52)',
                }}
              >
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
                  <TextField
                    label={`${PRODUCER_PLANNING_PHASE_LABELS[item.phase]} tittel`}
                    size="small"
                    fullWidth
                    value={item.title ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: nextValue } : entry),
                      }));
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <TextField
                    select
                    label="Status"
                    size="small"
                    value={item.status ?? 'planned'}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value as ProducerPlanningStatus;
                      setDraft((previous) => ({
                        ...previous,
                        phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, status: nextValue } : entry),
                      }));
                    }}
                    sx={{ minWidth: { lg: 170 } }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  >
                    {Object.entries(PRODUCER_PLANNING_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Ansvarlig"
                    size="small"
                    value={item.owner ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, owner: nextValue } : entry),
                      }));
                    }}
                    sx={{ minWidth: { lg: 180 } }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} sx={{ mt: 1.1 }}>
                  <TextField
                    label="Start"
                    type="date"
                    size="small"
                    value={toDateInputValue(item.startDate)}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, startDate: nextValue } : entry),
                      }));
                    }}
                    InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
                    sx={{ minWidth: { md: 180 } }}
                  />
                  <TextField
                    label="Slutt"
                    type="date"
                    size="small"
                    value={toDateInputValue(item.endDate)}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, endDate: nextValue } : entry),
                      }));
                    }}
                    InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
                    sx={{ minWidth: { md: 180 } }}
                  />
                  <TextField
                    label="Klient-checkpoint"
                    size="small"
                    fullWidth
                    value={item.clientCheckpoint ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, clientCheckpoint: nextValue } : entry),
                      }));
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                </Stack>
                <TextField
                  label="Mål for fasen"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  sx={{ mt: 1.1 }}
                  value={item.objective ?? ''}
                  disabled={readOnly}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDraft((previous) => ({
                      ...previous,
                      phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, objective: nextValue } : entry),
                    }));
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />
                <TextField
                  label="Notater"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  sx={{ mt: 1.1 }}
                  value={item.notes ?? ''}
                  disabled={readOnly}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDraft((previous) => ({
                      ...previous,
                      phasePlan: previous.phasePlan.map((entry, entryIndex) => entryIndex === index ? { ...entry, notes: nextValue } : entry),
                    }));
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />
              </Box>
            ))}
          </Stack>
        ) : null}

        {activeTab === 'calendar' ? (
          <Stack spacing={1.1}>
            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem' }}>
              Kalenderen viser hva klienten faktisk skal se publisert eller levert, ikke den avanserte shotlisten som teamet jobber etter.
            </Typography>
            {openClientContributionTasks.length > 0 ? (
              <Box
                sx={{
                  p: 1.15,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: 'rgba(15,23,42,0.52)',
                }}
              >
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      Klientinnspill som styrer planen
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.3 }}>
                      Disse punktene er direkte koblet til retning, faseplan og content-kalender.
                    </Typography>
                  </Box>
                  {onOpenMedia ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LaunchIcon />}
                      onClick={() => onOpenMedia(briefWorkspaceFocus)}
                      sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { lg: 'flex-start' } }}
                    >
                      Åpne brief og materiale
                    </Button>
                  ) : null}
                </Stack>
                <Stack spacing={0.85}>
                  {openClientContributionTasks.slice(0, 6).map((task) => (
                    <Box
                      key={task.id}
                      sx={{
                        p: 0.95,
                        borderRadius: 1.2,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: 'rgba(2,6,23,0.46)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.65} flexWrap="wrap" sx={{ mb: 0.35 }}>
                            <Chip
                              size="small"
                              label={PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType]}
                              sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                            />
                            <Chip
                              size="small"
                              label={PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status]}
                              sx={{
                                bgcolor: task.status === 'missing'
                                  ? 'rgba(248,113,113,0.16)'
                                  : 'rgba(251,191,36,0.14)',
                                color: task.status === 'missing' ? '#fecaca' : '#fde68a',
                              }}
                            />
                          </Stack>
                          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                            {task.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.82rem', mt: 0.3 }}>
                            {task.detail}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={PRODUCER_PLANNING_PHASE_LABELS[task.phase]}
                          sx={{ bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0', alignSelf: { md: 'flex-start' } }}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
            {draft.contentCalendar.map((item, index) => (
              <Box
                key={item.id}
                sx={{
                  p: 1.15,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: 'rgba(15,23,42,0.52)',
                }}
              >
                <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.1}>
                  <TextField
                    size="small"
                    label="Tittel"
                    value={item.title}
                    fullWidth
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, title: nextValue } : entry),
                      }));
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <TextField
                    size="small"
                    select
                    label="Kanal"
                    value={item.channel ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const recommendedFormats = getRecommendedFormatsForProducerChannel(nextValue);
                      const shouldResetFormat = !item.format || recommendedFormats.every((option) => option.value !== item.format);
                      updateContentCalendarItem(index, (entry) => ({
                        ...entry,
                        channel: nextValue,
                        format: shouldResetFormat ? getPrimaryFormatForProducerChannel(nextValue) : entry.format,
                      }));
                    }}
                    sx={{ minWidth: { xl: 180 } }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  >
                    {PRODUCER_CONTENT_CHANNEL_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Box
                    sx={{
                      minWidth: { xl: 280 },
                      flex: { xl: 1 },
                      p: 0.85,
                      borderRadius: 1.35,
                      border: '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(2,6,23,0.42)',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      justifyContent="space-between"
                      spacing={0.9}
                      sx={{ mb: 0.85 }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.83rem' }}>
                          Format
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.74rem', lineHeight: 1.45, mt: 0.2 }}>
                          {getProducerContentFormatOption(item.format)?.helper
                            ?? 'Velg format ut fra kanal og hvordan innholdet skal publiseres.'}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 68,
                          height: 68,
                          alignSelf: { xs: 'flex-start', md: 'center' },
                          borderRadius: 1.35,
                          border: '1px solid rgba(148,163,184,0.18)',
                          background: 'linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.92))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {(() => {
                          const formatOption = getProducerContentFormatOption(item.format) ?? PRODUCER_CONTENT_FORMAT_OPTIONS[0];
                          const isVertical = formatOption.frame.height > formatOption.frame.width;
                          const previewWidth = isVertical ? 26 : formatOption.frame.width === formatOption.frame.height ? 36 : 44;
                          const previewHeight = isVertical ? 46 : formatOption.frame.width === formatOption.frame.height ? 36 : 28;
                          return (
                            <Box
                              sx={{
                                width: previewWidth,
                                height: previewHeight,
                                borderRadius: 0.9,
                                border: '1px solid rgba(191,219,254,0.36)',
                                bgcolor: 'rgba(59,130,246,0.16)',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                              }}
                            />
                          );
                        })()}
                      </Box>
                    </Stack>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={item.format ?? ''}
                      onChange={(_, nextValue: string | null) => {
                        if (!nextValue) {
                          return;
                        }
                        updateContentCalendarItem(index, (entry) => ({ ...entry, format: nextValue }));
                      }}
                      sx={{
                        flexWrap: 'wrap',
                        gap: 0.6,
                        '& .MuiToggleButton-root': {
                          px: 1,
                          borderRadius: '999px !important',
                          borderColor: 'rgba(148,163,184,0.2)',
                          color: 'rgba(226,232,240,0.82)',
                          textTransform: 'none',
                          fontWeight: 700,
                        },
                        '& .Mui-selected': {
                          bgcolor: 'rgba(56,189,248,0.16) !important',
                          borderColor: 'rgba(56,189,248,0.36) !important',
                          color: '#e0f2fe !important',
                        },
                      }}
                    >
                      {(getRecommendedFormatsForProducerChannel(item.channel).length > 0
                        ? getRecommendedFormatsForProducerChannel(item.channel)
                        : PRODUCER_CONTENT_FORMAT_OPTIONS
                      ).map((option) => (
                        <ToggleButton key={option.value} value={option.value} disabled={readOnly}>
                          {option.label}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                  <TextField
                    size="small"
                    type="date"
                    label="Publiseres"
                    value={toDateInputValue(item.publishAt)}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, publishAt: nextValue } : entry),
                      }));
                    }}
                    InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
                    sx={{ minWidth: { xl: 170 } }}
                  />
                  <TextField
                    size="small"
                    select
                    label="Status"
                    value={item.status ?? 'planned'}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value as ProducerContentCalendarStatus;
                      setDraft((previous) => ({
                        ...previous,
                        contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, status: nextValue } : entry),
                      }));
                    }}
                    sx={{ minWidth: { xl: 180 } }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  >
                    {Object.entries(PRODUCER_CONTENT_CALENDAR_STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                {(item.channel || item.format) ? (
                  <Typography sx={{ color: 'rgba(191,219,254,0.76)', fontSize: '0.76rem', lineHeight: 1.45, mt: 0.85 }}>
                    {[
                      getProducerContentChannelOption(item.channel)?.helper,
                      item.format ? `Vises som ${item.format} i plan og leveranse.` : null,
                    ].filter(Boolean).join(' · ')}
                  </Typography>
                ) : null}
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} sx={{ mt: 1.1 }}>
                  <TextField
                    size="small"
                    select
                    label="Fase"
                    value={item.phase}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value as ProducerPlanningPhase;
                      setDraft((previous) => ({
                        ...previous,
                        contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, phase: nextValue } : entry),
                      }));
                    }}
                    sx={{ minWidth: { lg: 180 } }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  >
                    {Object.entries(PRODUCER_PLANNING_PHASE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Ansvarlig"
                    value={item.owner ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, owner: nextValue } : entry),
                      }));
                    }}
                    sx={{ minWidth: { lg: 190 } }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <TextField
                    size="small"
                    select
                    label="Knytt til shotlist"
                    value={item.linkedShotListId ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, linkedShotListId: nextValue } : entry),
                      }));
                    }}
                    sx={{ flex: 1 }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  >
                    <MenuItem value="">Ingen kobling</MenuItem>
                    {shotLists.map((shotList) => (
                      <MenuItem key={shotList.id} value={shotList.id}>
                        {shotList.sceneName || shotList.sceneId}
                      </MenuItem>
                    ))}
                  </TextField>
                  {!readOnly ? (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        setDraft((previous) => ({
                          ...previous,
                          contentCalendar: previous.contentCalendar.filter((_, entryIndex) => entryIndex !== index),
                        }));
                      }}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Fjern
                    </Button>
                  ) : null}
                </Stack>
                {openClientContributionTasks.some((task) => task.linkedCalendarItemId === item.id) ? (
                  <Box
                    sx={{
                      mt: 1.05,
                      p: 0.9,
                      borderRadius: 1.2,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background: 'rgba(2,6,23,0.46)',
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.84rem', mb: 0.55 }}>
                      Klientgrunnlag som fortsatt mangler for dette punktet
                    </Typography>
                    <Stack spacing={0.55}>
                      {openClientContributionTasks
                        .filter((task) => task.linkedCalendarItemId === item.id)
                        .map((task) => (
                          <Box key={task.id}>
                            <Stack direction="row" spacing={0.65} flexWrap="wrap" sx={{ mb: 0.25 }}>
                              <Chip
                                size="small"
                                label={PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status]}
                                sx={{
                                  bgcolor: task.status === 'missing'
                                    ? 'rgba(248,113,113,0.16)'
                                    : 'rgba(251,191,36,0.14)',
                                  color: task.status === 'missing' ? '#fecaca' : '#fde68a',
                                }}
                              />
                              <Chip
                                size="small"
                                label={task.sourceLabel}
                                sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                              />
                            </Stack>
                            <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.8rem' }}>
                              {task.detail}
                            </Typography>
                          </Box>
                        ))}
                    </Stack>
                  </Box>
                ) : null}
                <TextField
                  size="small"
                  label="Notater"
                  multiline
                  minRows={2}
                  fullWidth
                  sx={{ mt: 1.1 }}
                  value={item.notes ?? ''}
                  disabled={readOnly}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDraft((previous) => ({
                      ...previous,
                      contentCalendar: previous.contentCalendar.map((entry, entryIndex) => entryIndex === index ? { ...entry, notes: nextValue } : entry),
                    }));
                  }}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />
                {item.linkedShotListId && onOpenShotList ? (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<LaunchIcon />}
                    onClick={() => onOpenShotList({ shotListId: item.linkedShotListId, phase: item.phase })}
                    sx={{ mt: 0.7, alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                  >
                    Åpne koblet shotlist
                  </Button>
                ) : null}
              </Box>
            ))}
            {!readOnly ? (
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  setDraft((previous) => ({
                    ...previous,
                    contentCalendar: [...previous.contentCalendar, createProducerContentCalendarItem()],
                  }));
                }}
                sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
              >
                Legg til kalenderpunkt
              </Button>
            ) : null}
          </Stack>
        ) : null}

        {activeTab === 'brand' ? (
          <Stack spacing={1.2}>
            <TextField
              size="small"
              label="Logo-URL"
              value={draft.brandGuide.logoUrl ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraft((previous) => ({
                  ...previous,
                  brandGuide: {
                    ...previous.brandGuide,
                    logoUrl: nextValue,
                  },
                }));
              }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            {draft.brandGuide.logoUrl ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  p: 1.1,
                  borderRadius: 1.5,
                  border: '1px solid rgba(148,163,184,0.16)',
                  background: 'rgba(15,23,42,0.52)',
                }}
              >
                <Box
                  component="img"
                  src={draft.brandGuide.logoUrl}
                  alt={`${project.name} logo`}
                  sx={{ maxHeight: 72, maxWidth: '100%', objectFit: 'contain' }}
                />
              </Box>
            ) : null}
            <Stack spacing={1}>
              {(draft.brandGuide.colors ?? []).map((color, index) => (
                <Box
                  key={color.id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      lg: 'minmax(160px, 0.9fr) minmax(140px, 0.6fr) minmax(220px, 1fr) auto',
                    },
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <TextField
                    size="small"
                    label="Fargenavn"
                    value={color.label}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        brandGuide: {
                          ...previous.brandGuide,
                          colors: (previous.brandGuide.colors ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, label: nextValue } : entry),
                        },
                      }));
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <TextField
                    size="small"
                    label="HEX"
                    value={color.hex}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        brandGuide: {
                          ...previous.brandGuide,
                          colors: (previous.brandGuide.colors ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, hex: nextValue } : entry),
                        },
                      }));
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <TextField
                    size="small"
                    label="Bruk"
                    value={color.usage ?? ''}
                    disabled={readOnly}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraft((previous) => ({
                        ...previous,
                        brandGuide: {
                          ...previous.brandGuide,
                          colors: (previous.brandGuide.colors ?? []).map((entry, entryIndex) => entryIndex === index ? { ...entry, usage: nextValue } : entry),
                        },
                      }));
                    }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 1.2,
                      border: '1px solid rgba(148,163,184,0.2)',
                      backgroundColor: color.hex || '#ffffff',
                    }}
                  />
                </Box>
              ))}
              {!readOnly ? (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setDraft((previous) => ({
                      ...previous,
                      brandGuide: {
                        ...previous.brandGuide,
                        colors: [...(previous.brandGuide.colors ?? []), createBrandColor()],
                      },
                    }));
                  }}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                >
                  Legg til farge
                </Button>
              ) : null}
            </Stack>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
              <TextField
                size="small"
                label="Skrifter (én per linje)"
                multiline
                minRows={4}
                fullWidth
                value={stringifyLineSeparatedValues(draft.brandGuide.fonts)}
                disabled={readOnly}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    brandGuide: {
                      ...previous.brandGuide,
                      fonts: parseLineSeparatedValues(event.target.value),
                    },
                  }));
                }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
              <TextField
                size="small"
                label="Språk og tone"
                multiline
                minRows={4}
                fullWidth
                value={draft.brandGuide.toneOfVoice ?? ''}
                disabled={readOnly}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    brandGuide: {
                      ...previous.brandGuide,
                      toneOfVoice: event.target.value,
                    },
                  }));
                }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            </Stack>
            <TextField
              size="small"
              label="Visuell stil"
              multiline
              minRows={3}
              value={draft.brandGuide.visualStyle ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  brandGuide: {
                    ...previous.brandGuide,
                    visualStyle: event.target.value,
                  },
                }));
              }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
              <TextField
                size="small"
                label="Anbefalt (én per linje)"
                multiline
                minRows={4}
                fullWidth
                value={stringifyLineSeparatedValues(draft.brandGuide.dos)}
                disabled={readOnly}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    brandGuide: {
                      ...previous.brandGuide,
                      dos: parseLineSeparatedValues(event.target.value),
                    },
                  }));
                }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
              <TextField
                size="small"
                label="Unngå (én per linje)"
                multiline
                minRows={4}
                fullWidth
                value={stringifyLineSeparatedValues(draft.brandGuide.donts)}
                disabled={readOnly}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    brandGuide: {
                      ...previous.brandGuide,
                      donts: parseLineSeparatedValues(event.target.value),
                    },
                  }));
                }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            </Stack>
          </Stack>
        ) : null}

        {activeTab === 'delivery' ? (
          <Stack spacing={1.1}>
            <Alert severity="info" sx={{ bgcolor: 'rgba(15,23,42,0.45)' }}>
              Denne rutinen brukes som prosjektets ene sannhet for mapper, versjoner, draft/final, backup og leveranse.
            </Alert>
            <TextField
              size="small"
              label="Filnavnstandard"
              multiline
              minRows={2}
              value={draft.deliveryWorkflow.fileNamingConvention ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  deliveryWorkflow: {
                    ...previous.deliveryWorkflow,
                    presetId: undefined,
                    fileNamingConvention: event.target.value,
                  },
                }));
              }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <TextField
              size="small"
              label="Versjonsregel"
              multiline
              minRows={2}
              value={draft.deliveryWorkflow.versioningRule ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  deliveryWorkflow: {
                    ...previous.deliveryWorkflow,
                    presetId: undefined,
                    versioningRule: event.target.value,
                  },
                }));
              }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <TextField
              size="small"
              label="Mappestruktur"
              multiline
              minRows={4}
              value={draft.deliveryWorkflow.folderStructure ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  deliveryWorkflow: {
                    ...previous.deliveryWorkflow,
                    presetId: undefined,
                    folderStructure: event.target.value,
                  },
                }));
              }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1}>
              <TextField
                size="small"
                label="Utkast vs final"
                multiline
                minRows={3}
                fullWidth
                value={draft.deliveryWorkflow.draftVsFinalRule ?? ''}
                disabled={readOnly}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      presetId: undefined,
                      draftVsFinalRule: event.target.value,
                    },
                  }));
                }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
              <TextField
                size="small"
                label="Backup-rutine"
                multiline
                minRows={3}
                fullWidth
                value={draft.deliveryWorkflow.backupRoutine ?? ''}
                disabled={readOnly}
                onChange={(event) => {
                  setDraft((previous) => ({
                    ...previous,
                    deliveryWorkflow: {
                      ...previous.deliveryWorkflow,
                      presetId: undefined,
                      backupRoutine: event.target.value,
                    },
                  }));
                }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            </Stack>
            <TextField
              size="small"
              label="Leveringsrutine"
              multiline
              minRows={3}
              value={draft.deliveryWorkflow.deliveryCadence ?? ''}
              disabled={readOnly}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  deliveryWorkflow: {
                    ...previous.deliveryWorkflow,
                    presetId: undefined,
                    deliveryCadence: event.target.value,
                  },
                }));
              }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
          </Stack>
        ) : null}

        {dirty && !readOnly ? (
          <>
            <Divider sx={{ borderColor: 'rgba(148,163,184,0.16)' }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.85rem' }}>
                Du har endringer som ikke er lagret i prosjektet ennå.
              </Typography>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => { void handleSave(); }}
                disabled={saving}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb' }}
              >
                Lagre plan
              </Button>
            </Stack>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
