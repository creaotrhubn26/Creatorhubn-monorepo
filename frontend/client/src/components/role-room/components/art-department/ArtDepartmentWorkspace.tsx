import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Add as AddIcon,
  ArchitectureOutlined as DesignIcon,
  ArrowForward as ArrowForwardIcon,
  AssignmentTurnedInOutlined as HandoffIcon,
  AutoAwesomeMosaicOutlined as VisualIcon,
  CategoryOutlined as PropsIcon,
  ChecklistRtlOutlined as ContinuityIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  GroupsOutlined as DepartmentsIcon,
  MovieCreationOutlined as ScenesIcon,
  PhotoCameraOutlined as PhotoIcon,
  RefreshOutlined as RefreshIcon,
  SaveOutlined as SaveIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
  WarningAmberOutlined as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type {
  ArtDecisionImpact,
  ArtDecisionStatus,
  ArtContinuityCondition,
  ArtContinuityDepartment,
  ArtContinuityItem,
  ArtContinuitySource,
  ArtContinuityStatus,
  ArtDepartmentDecision,
  ArtDepartmentHandoff,
  ArtDepartmentId,
  ArtDepartmentOperations,
  ArtDepartmentPhase,
  ArtDepartmentRecord,
  ArtDepartmentScenePlan,
  ArtHandoffStatus,
  ArtSceneStatus,
  ArtSetStrategy,
  CastingProject,
  ProductionContinuityReference,
} from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { useBeforeUnloadIfDirty } from '../../hooks/useBeforeUnloadIfDirty';
import { roleTokens } from '../../theme/roleTokens';
import {
  ArtDepartmentConflictError,
  artDepartmentService,
} from '../../services/artDepartmentService';
import { productionContinuityService } from '../../services/productionContinuityService';
import { useScreenTier } from '../production/useScreenTier';
import {
  ART_DEPARTMENT_LABELS,
  ART_DEPARTMENT_SURFACES,
  buildArtDepartmentWorkspaceBrief,
  clearArtDepartmentDraft,
  createArtDepartmentId,
  createEmptyArtDepartmentOperations,
  loadArtDepartmentDraft,
  mergeArtDepartmentOperations,
  saveArtDepartmentDraft,
  upsertDecision,
  upsertContinuityItem,
  upsertScenePlan,
  type ArtDepartmentSurface,
} from './artDepartmentWorkspaceModel';

interface Props {
  project: CastingProject;
  activeSurface: ArtDepartmentSurface;
  readOnly?: boolean;
  onNavigate: (surface: ArtDepartmentSurface) => void;
  onOpenStoryboard: (sceneId?: string) => void;
  onOpenProps: () => void;
  onOpenSchedule: () => void;
  onOpenFullWorkspace: () => void;
}

const PHASE_LABELS: Record<ArtDepartmentPhase, string> = {
  concept: 'Konsept', design: 'Design', build: 'Bygg', shoot: 'Innspilling', wrap: 'Wrap',
};
const SCENE_STATUS_LABELS: Record<ArtSceneStatus, string> = {
  not_started: 'Ikke startet', researching: 'Research', designing: 'Design pågår', ready_for_review: 'Klar for review', blocked: 'Blokkert',
};
const SET_STRATEGY_LABELS: Record<ArtSetStrategy, string> = {
  unknown: 'Ikke avklart', location: 'Praktisk lokasjon', build: 'Set build', hybrid: 'Hybrid',
};
const DECISION_STATUS_LABELS: Record<ArtDecisionStatus, string> = {
  draft: 'Utkast', ready_for_review: 'Klar for review', changes_requested: 'Endringer ønsket',
};
const DECISION_IMPACT_LABELS: Record<ArtDecisionImpact, string> = {
  creative: 'Kreativt', schedule: 'Plan', budget: 'Budsjett', safety: 'Sikkerhet', continuity: 'Kontinuitet',
};
const HANDOFF_STATUS_LABELS: Record<ArtHandoffStatus, string> = {
  not_started: 'Ikke startet', in_progress: 'Pågår', ready: 'Klar', blocked: 'Blokkert',
};
const CONTINUITY_DEPARTMENT_LABELS: Record<ArtContinuityDepartment, string> = {
  sets: 'Set', props: 'Rekvisitt', costume: 'Kostyme', hair_makeup: 'Hår og sminke',
};
const CONTINUITY_STATUS_LABELS: Record<ArtContinuityStatus, string> = {
  planned: 'Planlagt', in_progress: 'Under arbeid', ready: 'Klar', on_set: 'På set',
  reset_required: 'Må resettes', complete: 'Ferdig', blocked: 'Blokkert',
};
const CONTINUITY_SOURCE_LABELS: Record<ArtContinuitySource, string> = {
  unknown: 'Ikke avklart', owned: 'Eid', rented: 'Leid', purchased: 'Kjøpt', fabricated: 'Bygget', borrowed: 'Lånt',
};
const CONTINUITY_CONDITION_LABELS: Record<ArtContinuityCondition, string> = {
  unknown: 'Ikke kontrollert', good: 'God', attention: 'Må følges opp', damaged: 'Skadet', missing: 'Mangler',
};

const DEPARTMENTS = Object.keys(ART_DEPARTMENT_LABELS) as ArtDepartmentId[];

const SURFACE_META: Record<ArtDepartmentSurface, { label: string; icon: typeof DesignIcon }> = {
  overview: { label: 'Oversikt', icon: DesignIcon },
  scenes: { label: 'Scener', icon: ScenesIcon },
  'visual-direction': { label: 'Visuell retning', icon: VisualIcon },
  continuity: { label: 'Continuity', icon: ContinuityIcon },
  departments: { label: 'Avdelinger', icon: DepartmentsIcon },
  handoff: { label: 'Handoff', icon: HandoffIcon },
};

const panelSx = {
  bgcolor: 'rgba(10,15,24,.88)',
  borderColor: 'rgba(244,114,182,.2)',
  color: roleTokens.text,
};
const fieldSx = {
  '& .MuiInputBase-root': { color: roleTokens.text, bgcolor: 'rgba(255,255,255,.025)' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& fieldset': { borderColor: 'rgba(244,114,182,.24)' },
};

function statusTone(status: string): { color: string; background: string } {
  if (status === 'blocked' || status === 'changes_requested') return { color: '#fca5a5', background: 'rgba(239,68,68,.12)' };
  if (status === 'reset_required') return { color: '#fde68a', background: 'rgba(245,158,11,.12)' };
  if (status === 'ready' || status === 'ready_for_review' || status === 'complete') return { color: '#86efac', background: 'rgba(34,197,94,.12)' };
  if (status === 'designing' || status === 'researching' || status === 'in_progress' || status === 'on_set') return { color: '#f9a8d4', background: 'rgba(236,72,153,.12)' };
  return { color: roleTokens.textMuted, background: 'rgba(148,163,184,.08)' };
}

function formatTimestamp(value?: string): string {
  if (!value) return 'Ikke synkronisert ennå';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }).format(date)
    : 'Ukjent tidspunkt';
}

export function ArtDepartmentWorkspace({
  project,
  activeSurface,
  readOnly = false,
  onNavigate,
  onOpenStoryboard,
  onOpenProps,
  onOpenSchedule,
  onOpenFullWorkspace,
}: Props) {
  const { isMobile } = useScreenTier();
  const targetSize = isMobile ? MOBILE_TOUCH_TARGET_SIZE : TOUCH_TARGET_SIZE;
  const [record, setRecord] = useState<ArtDepartmentRecord | null>(null);
  const [operations, setOperations] = useState<ArtDepartmentOperations>(createEmptyArtDepartmentOperations);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [conflict, setConflict] = useState<ArtDepartmentRecord | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [decisionDraft, setDecisionDraft] = useState({ title: '', impact: 'creative' as ArtDecisionImpact });
  const [continuityDraft, setContinuityDraft] = useState({
    department: 'props' as ArtContinuityDepartment,
    title: '',
    sceneId: '',
    productionDayId: '',
    characterRoleId: '',
    propId: '',
  });
  const [continuityDepartmentFilter, setContinuityDepartmentFilter] = useState<'all' | ArtContinuityDepartment>('all');
  const [uploadingContinuityKey, setUploadingContinuityKey] = useState('');
  const [continuityPreview, setContinuityPreview] = useState<{
    src: string;
    label: string;
    kind: ProductionContinuityReference['kind'];
  } | null>(null);
  const [openingContinuityReferenceId, setOpeningContinuityReferenceId] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const { confirmIfDirty } = useBeforeUnloadIfDirty({
    isDirty: dirty,
    message: 'Produksjonsdesignflaten har ulagrede endringer. Vil du forlate den?',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const next = await artDepartmentService.get(project.id);
      setRecord(next);
      const localDraft = readOnly ? null : loadArtDepartmentDraft(project.id);
      if (localDraft) {
        setOperations(mergeArtDepartmentOperations(localDraft.operations));
        setDirty(true);
        setDraftSavedAt(localDraft.updatedAt);
        if (localDraft.baseVersion !== next.version) {
          setConflict(next);
          setFeedback({ type: 'warning', text: 'Et lokalt utkast er gjenopprettet, men serveren har en nyere versjon. Utkastet er beholdt til du velger.' });
        } else {
          setConflict(null);
          setFeedback({ type: 'warning', text: 'Et ulagret lokalt utkast er gjenopprettet.' });
        }
      } else {
        setOperations(mergeArtDepartmentOperations(next.operations));
        setDirty(false);
        setDraftSavedAt(null);
        setConflict(null);
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke hente produksjonsdesigngrunnlaget.' });
    } finally {
      setLoading(false);
    }
  }, [project.id, readOnly]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (readOnly || !dirty) return;
    const timer = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      saveArtDepartmentDraft(project.id, { baseVersion: record?.version ?? 0, updatedAt, operations });
      setDraftSavedAt(updatedAt);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [dirty, operations, project.id, readOnly, record?.version]);

  const brief = useMemo(
    () => buildArtDepartmentWorkspaceBrief(project, operations),
    [operations, project],
  );
  const selectedScene = brief.scenes.find((scene) => scene.id === selectedSceneId) ?? brief.scenes[0] ?? null;

  useEffect(() => {
    if (!selectedSceneId && brief.scenes[0]) setSelectedSceneId(brief.scenes[0].id);
    if (selectedSceneId && !brief.scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(brief.scenes[0]?.id ?? '');
    }
  }, [brief.scenes, selectedSceneId]);

  useEffect(() => {
    if (!continuityDraft.sceneId && brief.scenes[0]) {
      const sceneId = brief.scenes[0].id;
      const day = (project.productionDays ?? []).find((candidate) => (candidate.scenes ?? []).map(String).includes(sceneId));
      setContinuityDraft((current) => ({ ...current, sceneId, productionDayId: day?.id ?? '' }));
    }
  }, [brief.scenes, continuityDraft.sceneId, project.productionDays]);

  const updateOperations = (updater: (current: ArtDepartmentOperations) => ArtDepartmentOperations) => {
    if (readOnly) return;
    setOperations((current) => updater(current));
    setDirty(true);
    setFeedback(null);
  };

  const updateScenePlan = (patch: Partial<ArtDepartmentScenePlan>) => {
    if (!selectedScene) return;
    updateOperations((current) => upsertScenePlan(current, {
      ...selectedScene.plan,
      ...patch,
      sceneId: selectedScene.id,
      updatedAt: new Date().toISOString(),
    }));
  };

  const updateHandoff = (handoff: ArtDepartmentHandoff, patch: Partial<ArtDepartmentHandoff>) => {
    updateOperations((current) => ({
      ...current,
      handoffs: current.handoffs.map((item) => item.id === handoff.id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item),
    }));
  };

  const save = async () => {
    if (readOnly || saving || !dirty) return;
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await artDepartmentService.save(project.id, record?.version ?? 0, operations);
      setRecord(saved);
      setOperations(mergeArtDepartmentOperations(saved.operations));
      setDirty(false);
      setConflict(null);
      setDraftSavedAt(null);
      clearArtDepartmentDraft(project.id);
      setFeedback({ type: 'success', text: 'Produksjonsdesigngrunnlaget er synkronisert.' });
    } catch (error) {
      if (error instanceof ArtDepartmentConflictError) {
        setConflict(error.artDepartment);
        setFeedback({ type: 'warning', text: 'En annen bruker lagret først. Ditt lokale utkast er beholdt.' });
      } else {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke lagre produksjonsdesigngrunnlaget.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const loadConflictVersion = () => {
    if (!conflict) return;
    setRecord(conflict);
    setOperations(mergeArtDepartmentOperations(conflict.operations));
    setDirty(false);
    setConflict(null);
    setDraftSavedAt(null);
    clearArtDepartmentDraft(project.id);
    setFeedback({ type: 'success', text: 'Serverversjonen er lastet inn.' });
  };

  const keepLocalConflictVersion = () => {
    if (!conflict) return;
    setRecord(conflict);
    setConflict(null);
    const updatedAt = new Date().toISOString();
    saveArtDepartmentDraft(project.id, { baseVersion: conflict.version, updatedAt, operations });
    setDraftSavedAt(updatedAt);
    setFeedback({ type: 'warning', text: 'Det lokale utkastet er beholdt og kan nå lagres oppå den nyeste serverversjonen.' });
  };

  const discardLocalDraft = () => {
    if (!record) return;
    setOperations(mergeArtDepartmentOperations(record.operations));
    setDirty(false);
    setConflict(null);
    setDraftSavedAt(null);
    clearArtDepartmentDraft(project.id);
    setFeedback({ type: 'success', text: 'Det lokale utkastet er forkastet.' });
  };

  const navigateSafely = (surface: ArtDepartmentSurface) => {
    if (surface === activeSurface || confirmIfDirty()) onNavigate(surface);
  };

  const addDecision = () => {
    const title = decisionDraft.title.trim();
    if (!title) return;
    const decision: ArtDepartmentDecision = {
      id: createArtDepartmentId('decision'),
      title,
      impact: decisionDraft.impact,
      status: 'draft',
      sceneIds: selectedScene ? [selectedScene.id] : [],
      updatedAt: new Date().toISOString(),
    };
    updateOperations((current) => upsertDecision(current, decision));
    setDecisionDraft({ title: '', impact: 'creative' });
  };

  const updateContinuityItem = (item: ArtContinuityItem, patch: Partial<ArtContinuityItem>) => {
    updateOperations((current) => upsertContinuityItem(current, {
      ...item,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  };

  const addContinuityItem = () => {
    const title = continuityDraft.title.trim();
    if (!title || !continuityDraft.sceneId) return;
    const item: ArtContinuityItem = {
      id: createArtDepartmentId('continuity'),
      department: continuityDraft.department,
      title,
      sceneId: continuityDraft.sceneId,
      productionDayId: continuityDraft.productionDayId || undefined,
      characterRoleId: continuityDraft.characterRoleId || undefined,
      propId: continuityDraft.department === 'props' && continuityDraft.propId ? continuityDraft.propId : undefined,
      status: 'planned',
      source: 'unknown',
      condition: 'unknown',
      beforeReferences: [],
      afterReferences: [],
      updatedAt: new Date().toISOString(),
    };
    updateOperations((current) => upsertContinuityItem(current, item));
    setContinuityDraft((current) => ({ ...current, title: '', characterRoleId: '', propId: '' }));
  };

  const uploadContinuityReference = async (
    item: ArtContinuityItem,
    phase: 'before' | 'after',
    file: File,
  ) => {
    if (!item.productionDayId || uploadingContinuityKey) {
      setFeedback({ type: 'warning', text: 'Velg en opptaksdag før du laster opp continuity-bilder.' });
      return;
    }
    const key = `${item.id}:${phase}`;
    setUploadingContinuityKey(key);
    setFeedback(null);
    try {
      const reference = await productionContinuityService.uploadMedia(
        project.id,
        item.productionDayId,
        item.sceneId,
        file,
      );
      updateContinuityItem(item, phase === 'before'
        ? { beforeReferences: [...item.beforeReferences, reference] }
        : { afterReferences: [...item.afterReferences, reference] });
      setFeedback({ type: 'success', text: 'Referansen er lastet privat til Role Room-lagringen. Lagre arbeidsflaten for å feste den til punktet.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke laste opp continuity-referansen.' });
    } finally {
      setUploadingContinuityKey('');
    }
  };

  const openContinuityReference = async (
    item: ArtContinuityItem,
    phase: 'Før' | 'Etter',
    reference: ProductionContinuityReference,
  ) => {
    const label = `${phase} · ${reference.label || reference.kind}`;
    if (reference.url) {
      setContinuityPreview({ src: reference.url, label, kind: reference.kind });
      return;
    }
    if (!item.productionDayId || !reference.storageFileId || openingContinuityReferenceId) return;
    setOpeningContinuityReferenceId(reference.id);
    try {
      const result = await productionContinuityService.getMediaUrl(project.id, item.productionDayId, reference.storageFileId);
      setContinuityPreview({ src: result.url, label: result.displayName ? `${phase} · ${result.displayName}` : label, kind: reference.kind });
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke åpne continuity-referansen.' });
    } finally {
      setOpeningContinuityReferenceId('');
    }
  };

  const visualFrames = useMemo(() => (
    (project.sceneBreakdowns ?? []).flatMap((scene) => (scene.storyboardFrames ?? []).map((frame) => ({
      id: `${scene.id}-${frame.id}`,
      sceneId: scene.id,
      label: frame.title || frame.description || `Storyboard · ${scene.sceneNumber ?? scene.id}`,
      imageUrl: frame.thumbnailUrl || frame.imageUrl,
    }))).filter((frame) => Boolean(frame.imageUrl)).slice(0, 12)
  ), [project.sceneBreakdowns]);

  if (loading) {
    return (
      <Box data-testid="art-department-workspace-loading" sx={{ minHeight: '100%', display: 'grid', placeItems: 'center', bgcolor: '#080c13', color: roleTokens.text }}>
        <Stack alignItems="center" spacing={1.5}><CircularProgress size={34} sx={{ color: '#f472b6' }} /><Typography>Laster produksjonsdesign …</Typography></Stack>
      </Box>
    );
  }

  const renderOverview = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0,1.5fr) minmax(320px,.72fr)' }, gap: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 780 }}>Neste designarbeid</Typography>
          <Typography sx={{ color: roleTokens.textMuted, fontSize: '.82rem' }}>Prioritert fra registrerte scener, rekvisitter og art-status—ikke antakelser.</Typography>
        </Box>
        {brief.nextActions.map((action) => {
          const tone = action.tone === 'attention' ? '#fca5a5' : action.tone === 'ready' ? '#86efac' : action.tone === 'active' ? '#f9a8d4' : '#cbd5e1';
          return (
            <Card key={action.id} variant="outlined" sx={{ ...panelSx, borderColor: `${tone}44` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1.5 }}>
                  <Box><Typography sx={{ fontWeight: 760 }}>{action.title}</Typography><Typography sx={{ mt: .4, color: roleTokens.textMuted, fontSize: '.82rem' }}>{action.detail}</Typography></Box>
                  <Button endIcon={<ArrowForwardIcon />} onClick={() => navigateSafely(action.surface)} sx={{ minHeight: targetSize, color: tone, alignSelf: { xs: 'stretch', sm: 'center' }, ...focusVisibleStyles }}>Åpne</Button>
                </Box>
              </CardContent>
            </Card>
          );
        })}

        <Card variant="outlined" sx={panelSx}>
          <CardContent sx={{ p: 2 }}>
            <Typography component="h2" sx={{ fontSize: '1.02rem', fontWeight: 760, mb: 1.25 }}>Beslutninger som må til review</Typography>
            {!readOnly ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(0,1fr) 170px auto' }, gap: 1, mb: 1.5 }}>
                <TextField label="Ny beslutning" value={decisionDraft.title} onChange={(event) => setDecisionDraft((current) => ({ ...current, title: event.target.value }))} size="small" inputProps={{ maxLength: 240 }} sx={fieldSx} />
                <FormControl size="small" sx={fieldSx}><InputLabel>Konsekvens</InputLabel><Select label="Konsekvens" inputProps={{ 'aria-label': 'Beslutningskonsekvens' }} value={decisionDraft.impact} onChange={(event) => setDecisionDraft((current) => ({ ...current, impact: event.target.value as ArtDecisionImpact }))}>{Object.entries(DECISION_IMPACT_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={addDecision} disabled={!decisionDraft.title.trim()} sx={{ minHeight: targetSize, color: '#f9a8d4', borderColor: 'rgba(244,114,182,.35)' }}>Legg til</Button>
              </Box>
            ) : null}
            {operations.decisions.length === 0 ? <Typography sx={{ color: roleTokens.textMuted, fontSize: '.82rem' }}>Ingen beslutninger er registrert.</Typography> : (
              <Stack spacing={1}>
                {operations.decisions.map((decision) => {
                  const tone = statusTone(decision.status);
                  return <Box key={decision.id} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid rgba(255,255,255,.07)', bgcolor: 'rgba(255,255,255,.025)' }}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1, alignItems: { md: 'center' } }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 720 }}>{decision.title}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>{DECISION_IMPACT_LABELS[decision.impact]} · {decision.sceneIds.length} scener</Typography></Box>
                      <FormControl size="small" sx={{ ...fieldSx, minWidth: 175 }} disabled={readOnly}><InputLabel>Status</InputLabel><Select label="Status" inputProps={{ 'aria-label': `${decision.title} beslutningsstatus` }} value={decision.status} onChange={(event) => updateOperations((current) => upsertDecision(current, { ...decision, status: event.target.value as ArtDecisionStatus, updatedAt: new Date().toISOString() }))}>{Object.entries(DECISION_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                      {!readOnly ? <Button aria-label={`Slett ${decision.title}`} onClick={() => updateOperations((current) => ({ ...current, decisions: current.decisions.filter((item) => item.id !== decision.id) }))} sx={{ minWidth: targetSize, minHeight: targetSize, color: '#fca5a5' }}><DeleteIcon /></Button> : <Chip label={DECISION_STATUS_LABELS[decision.status]} size="small" sx={{ color: tone.color, bgcolor: tone.background }} />}
                    </Box>
                  </Box>;
                })}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>

      <Stack spacing={2}>
        <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: 2 }}><Typography component="h2" sx={{ fontSize: '1.02rem', fontWeight: 760, mb: 1.25 }}>Art-status</Typography><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>{[
          ['Scener', brief.stats.sceneCount], ['Planlagt', brief.stats.plannedSceneCount], ['Blokkert', brief.stats.blockedSceneCount], ['Continuity', brief.stats.continuityItemCount], ['Reset/avvik', brief.stats.continuityAttentionCount], ['Handoffs klare', brief.stats.readyHandoffCount],
        ].map(([label, value]) => <Box key={label} sx={{ p: 1.15, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.06)' }}><Typography sx={{ fontSize: '1.4rem', fontWeight: 800 }}>{value}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.69rem' }}>{label}</Typography></Box>)}</Box></CardContent></Card>
        <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: 2 }}><Typography component="h2" sx={{ fontSize: '1.02rem', fontWeight: 760 }}>Sporbarhet</Typography><Typography sx={{ mt: .5, color: roleTokens.textMuted, fontSize: '.78rem' }}>Versjon {record?.version ?? 0} · {formatTimestamp(record?.updatedAt)}</Typography><Stack spacing={.8} sx={{ mt: 1.25 }}>{(operations.activity ?? []).slice(-4).reverse().map((entry) => <Box key={entry.id}><Typography sx={{ fontSize: '.78rem' }}>{entry.message}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.68rem' }}>{formatTimestamp(entry.createdAt)}</Typography></Box>)}{(operations.activity ?? []).length === 0 ? <Typography sx={{ color: roleTokens.textMuted, fontSize: '.78rem' }}>Ingen lagrede endringer ennå.</Typography> : null}</Stack></CardContent></Card>
      </Stack>
    </Box>
  );

  const renderScenes = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px,.55fr) minmax(0,1.45fr)' }, gap: 2 }}>
      <Stack spacing={1} aria-label="Scener i art breakdown">
        {brief.scenes.length === 0 ? <Alert severity="info">Ingen scener er tilgjengelige. Importer eller opprett manusbreakdown først.</Alert> : brief.scenes.map((scene) => {
          const tone = statusTone(scene.plan.status);
          return <Card key={scene.id} variant="outlined" sx={{ ...panelSx, borderColor: selectedScene?.id === scene.id ? 'rgba(244,114,182,.65)' : panelSx.borderColor }}><CardActionArea onClick={() => setSelectedSceneId(scene.id)} sx={{ minHeight: targetSize, p: 1.25, ...focusVisibleStyles }}><Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}><Box sx={{ minWidth: 0 }}><Typography sx={{ color: '#f9a8d4', fontSize: '.68rem', fontWeight: 800, letterSpacing: .6 }}>{scene.label}</Typography><Typography noWrap sx={{ fontWeight: 720 }}>{scene.heading}</Typography><Typography noWrap sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>{scene.location}</Typography></Box><Chip label={SCENE_STATUS_LABELS[scene.plan.status]} size="small" sx={{ color: tone.color, bgcolor: tone.background, maxWidth: 135 }} /></Box></CardActionArea></Card>;
        })}
      </Stack>
      {selectedScene ? <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}><Box><Typography sx={{ color: '#f9a8d4', fontSize: '.72rem', fontWeight: 800 }}>{selectedScene.label}</Typography><Typography component="h2" sx={{ fontSize: '1.2rem', fontWeight: 780 }}>{selectedScene.heading}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.78rem' }}>{selectedScene.location}</Typography></Box><Button variant="outlined" onClick={() => onOpenStoryboard(selectedScene.id)} sx={{ minHeight: targetSize, color: '#f9a8d4', borderColor: 'rgba(244,114,182,.35)' }}>Storyboard</Button></Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.25 }}>
          <FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Status</InputLabel><Select label="Status" inputProps={{ 'aria-label': 'Scenestatus' }} value={selectedScene.plan.status} onChange={(event) => updateScenePlan({ status: event.target.value as ArtSceneStatus })}>{Object.entries(SCENE_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Set-strategi</InputLabel><Select label="Set-strategi" inputProps={{ 'aria-label': 'Set-strategi' }} value={selectedScene.plan.setStrategy} onChange={(event) => updateScenePlan({ setStrategy: event.target.value as ArtSetStrategy })}>{Object.entries(SET_STRATEGY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
          <TextField label="Ansvarlig" value={selectedScene.plan.owner ?? ''} onChange={(event) => updateScenePlan({ owner: event.target.value })} disabled={readOnly} inputProps={{ maxLength: 160 }} size="small" sx={fieldSx} />
          <TextField label="Frist" type="datetime-local" value={selectedScene.plan.dueAt?.slice(0, 16) ?? ''} onChange={(event) => updateScenePlan({ dueAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} disabled={readOnly} InputLabelProps={{ shrink: true }} size="small" sx={fieldSx} />
        </Box>
        <Typography sx={{ mt: 2, mb: .75, fontSize: '.78rem', fontWeight: 760 }}>Fagbehov</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: .5 }}>{DEPARTMENTS.map((department) => <FormControlLabel key={department} disabled={readOnly} control={<Switch size="small" checked={selectedScene.plan.departments.includes(department)} onChange={(event) => updateScenePlan({ departments: event.target.checked ? [...selectedScene.plan.departments, department] : selectedScene.plan.departments.filter((item) => item !== department) })} />} label={<Typography sx={{ fontSize: '.72rem' }}>{ART_DEPARTMENT_LABELS[department]}</Typography>} />)}</Box>
        <TextField label="Designintensjon" value={selectedScene.plan.designIntent ?? ''} onChange={(event) => updateScenePlan({ designIntent: event.target.value })} disabled={readOnly} multiline minRows={3} inputProps={{ maxLength: 5000 }} fullWidth sx={{ ...fieldSx, mt: 1.5 }} />
        <TextField label="Blokkering / hva må avklares" value={selectedScene.plan.blocker ?? ''} onChange={(event) => updateScenePlan({ blocker: event.target.value })} disabled={readOnly} multiline minRows={2} inputProps={{ maxLength: 2000 }} fullWidth sx={{ ...fieldSx, mt: 1.25 }} />
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(244,114,182,.055)', border: '1px solid rgba(244,114,182,.15)' }}><Typography sx={{ fontWeight: 760, fontSize: '.8rem' }}>Kildegrunnlag</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.74rem', mt: .35 }}>Opptaksdager: {selectedScene.productionDayLabels.join(', ') || 'ikke planlagt'} · Rekvisitter: {selectedScene.propNames.join(', ') || 'ingen scenekoblede'} · Breakdown: {selectedScene.sourceNeeds.join(', ') || 'ingen registrerte art-elementer'}</Typography></Box>
      </CardContent></Card> : null}
    </Box>
  );

  const renderVisualDirection = () => (
    <Stack spacing={2}>
      <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: 2 }}><Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 780 }}>Visuell bibel</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.8rem', mt: .25, mb: 1.5 }}>Ett dokumentert språk for regissør, foto og art-avdeling. Systemet genererer ikke retningen automatisk.</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0,1fr)' }, gap: 1.25 }}><FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Fase</InputLabel><Select label="Fase" inputProps={{ 'aria-label': 'Produksjonsdesignfase' }} value={operations.phase} onChange={(event) => updateOperations((current) => ({ ...current, phase: event.target.value as ArtDepartmentPhase }))}>{Object.entries(PHASE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField label="Palett" helperText="Farger eller materialord, separert med komma" value={operations.palette.join(', ')} onChange={(event) => updateOperations((current) => ({ ...current, palette: event.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 16) }))} disabled={readOnly} inputProps={{ maxLength: 640 }} size="small" sx={fieldSx} /></Box><TextField label="Designintensjon" value={operations.visualDirection ?? ''} onChange={(event) => updateOperations((current) => ({ ...current, visualDirection: event.target.value }))} disabled={readOnly} multiline minRows={6} inputProps={{ maxLength: 10000 }} fullWidth sx={{ ...fieldSx, mt: 1.5 }} /></CardContent></Card>
      <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: 2 }}><Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1, mb: 1.25 }}><Box><Typography component="h2" sx={{ fontSize: '1.02rem', fontWeight: 760 }}>Eksisterende visuelle kilder</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.76rem' }}>Storyboardbilder fra prosjektets scene-ID-er. Nye filer må følge privat S3-flyt.</Typography></Box><Button variant="outlined" startIcon={<VisualIcon />} onClick={() => onOpenStoryboard()} sx={{ minHeight: targetSize, color: '#f9a8d4', borderColor: 'rgba(244,114,182,.35)' }}>Åpne storyboard</Button></Box>{visualFrames.length === 0 ? <Alert severity="info">Ingen storyboardbilder er tilgjengelige ennå.</Alert> : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(3,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1 }}>{visualFrames.map((frame) => <Card key={frame.id} variant="outlined" sx={{ bgcolor: '#070b11', borderColor: 'rgba(255,255,255,.08)' }}><CardActionArea onClick={() => onOpenStoryboard(frame.sceneId)}><Box component="img" src={frame.imageUrl} alt="" loading="lazy" sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', bgcolor: '#111827' }} /><Typography noWrap sx={{ p: 1, color: roleTokens.textMuted, fontSize: '.7rem' }}>{frame.label}</Typography></CardActionArea></Card>)}</Box>}</CardContent></Card>
    </Stack>
  );

  const renderContinuity = () => {
    const visibleItems = operations.continuityItems.filter((item) => (
      continuityDepartmentFilter === 'all' || item.department === continuityDepartmentFilter
    ));
    const sceneName = (sceneId: string) => brief.scenes.find((scene) => scene.id === sceneId)?.label ?? sceneId;
    const roleName = (roleId?: string) => project.roles.find((role) => role.id === roleId)?.name;
    const propName = (propId?: string) => project.props.find((prop) => prop.id === propId)?.name;
    return (
      <Stack spacing={2} data-testid="art-continuity-board">
        <Card variant="outlined" sx={panelSx}>
          <CardContent sx={{ p: 2 }}>
            <Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 780 }}>Art continuity og dagsberedskap</Typography>
            <Typography sx={{ color: roleTokens.textMuted, fontSize: '.8rem', mt: .25, mb: 1.5 }}>
              Ett delt spor for preset, reset, tilstand og avvik. Scene, opptaksdag, karakter, rekvisitt og media beholder sine kanoniske ID-er.
            </Typography>
            {!readOnly ? (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '170px minmax(180px,1fr) 180px 180px' }, gap: 1 }}>
                  <FormControl size="small" sx={fieldSx}><InputLabel>Fag</InputLabel><Select label="Fag" inputProps={{ 'aria-label': 'Continuity-fag' }} value={continuityDraft.department} onChange={(event) => setContinuityDraft((current) => ({ ...current, department: event.target.value as ArtContinuityDepartment, propId: '' }))}>{Object.entries(CONTINUITY_DEPARTMENT_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                  <TextField label="Plagg, look, set eller rekvisitt" value={continuityDraft.title} onChange={(event) => setContinuityDraft((current) => ({ ...current, title: event.target.value }))} inputProps={{ maxLength: 240 }} size="small" sx={fieldSx} />
                  <FormControl size="small" sx={fieldSx}><InputLabel>Scene</InputLabel><Select label="Scene" inputProps={{ 'aria-label': 'Continuity-scene' }} value={continuityDraft.sceneId} onChange={(event) => { const sceneId = String(event.target.value); const day = (project.productionDays ?? []).find((candidate) => (candidate.scenes ?? []).map(String).includes(sceneId)); setContinuityDraft((current) => ({ ...current, sceneId, productionDayId: day?.id ?? '' })); }}>{brief.scenes.map((scene) => <MenuItem key={scene.id} value={scene.id}>{scene.label} · {scene.heading}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={fieldSx}><InputLabel>Opptaksdag</InputLabel><Select label="Opptaksdag" inputProps={{ 'aria-label': 'Continuity-opptaksdag' }} value={continuityDraft.productionDayId} onChange={(event) => setContinuityDraft((current) => ({ ...current, productionDayId: String(event.target.value) }))}><MenuItem value="">Ikke planlagt</MenuItem>{(project.productionDays ?? []).filter((day) => (day.scenes ?? []).map(String).includes(continuityDraft.sceneId)).map((day) => <MenuItem key={day.id} value={day.id}>{day.date || day.id}</MenuItem>)}</Select></FormControl>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px,1fr) minmax(180px,1fr) auto' }, gap: 1, mt: 1 }}>
                  <FormControl size="small" sx={fieldSx}><InputLabel>Karakter</InputLabel><Select label="Karakter" inputProps={{ 'aria-label': 'Continuity-karakter' }} value={continuityDraft.characterRoleId} onChange={(event) => setContinuityDraft((current) => ({ ...current, characterRoleId: String(event.target.value) }))}><MenuItem value="">Ingen karakter</MenuItem>{project.roles.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={fieldSx} disabled={continuityDraft.department !== 'props'}><InputLabel>Kanonisk rekvisitt</InputLabel><Select label="Kanonisk rekvisitt" inputProps={{ 'aria-label': 'Kanonisk rekvisitt' }} value={continuityDraft.propId} onChange={(event) => setContinuityDraft((current) => ({ ...current, propId: String(event.target.value) }))}><MenuItem value="">Ingen kobling</MenuItem>{project.props.map((prop) => <MenuItem key={prop.id} value={prop.id}>{prop.name}</MenuItem>)}</Select></FormControl>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={addContinuityItem} disabled={!continuityDraft.title.trim() || !continuityDraft.sceneId} sx={{ minHeight: targetSize, bgcolor: '#db2777', '&:hover': { bgcolor: '#be185d' } }}>Legg til punkt</Button>
                </Box>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: .75, flexWrap: 'wrap' }} role="group" aria-label="Filtrer continuity-fag">
          <Button onClick={() => setContinuityDepartmentFilter('all')} aria-pressed={continuityDepartmentFilter === 'all'} sx={{ minHeight: targetSize, color: continuityDepartmentFilter === 'all' ? '#fbcfe8' : roleTokens.textMuted }}>Alle ({operations.continuityItems.length})</Button>
          {(Object.keys(CONTINUITY_DEPARTMENT_LABELS) as ArtContinuityDepartment[]).map((department) => <Button key={department} onClick={() => setContinuityDepartmentFilter(department)} aria-pressed={continuityDepartmentFilter === department} sx={{ minHeight: targetSize, color: continuityDepartmentFilter === department ? '#fbcfe8' : roleTokens.textMuted }}>{CONTINUITY_DEPARTMENT_LABELS[department]} ({operations.continuityItems.filter((item) => item.department === department).length})</Button>)}
        </Box>

        {visibleItems.length === 0 ? <Alert severity="info">Ingen continuity-punkter i dette fagområdet. Legg til et punkt fra en faktisk scene for å starte.</Alert> : visibleItems.map((item) => {
          const tone = statusTone(item.status);
          const daysForScene = (project.productionDays ?? []).filter((day) => (day.scenes ?? []).map(String).includes(item.sceneId));
          const references = [
            ...item.beforeReferences.map((reference) => ({ phase: 'Før', reference })),
            ...item.afterReferences.map((reference) => ({ phase: 'Etter', reference })),
          ];
          return (
            <Card key={item.id} variant="outlined" sx={{ ...panelSx, borderColor: `${tone.color}44` }} data-testid={`art-continuity-item-${item.id}`}>
              <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={.75} useFlexGap flexWrap="wrap"><Chip size="small" label={CONTINUITY_DEPARTMENT_LABELS[item.department]} /><Chip size="small" label={CONTINUITY_STATUS_LABELS[item.status]} sx={{ color: tone.color, bgcolor: tone.background }} /></Stack><Typography component="h3" sx={{ mt: .75, fontSize: '1rem', fontWeight: 780 }}>{item.title}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>{sceneName(item.sceneId)}{item.productionDayId ? ` · ${daysForScene.find((day) => day.id === item.productionDayId)?.date || item.productionDayId}` : ' · uten opptaksdag'}{roleName(item.characterRoleId) ? ` · ${roleName(item.characterRoleId)}` : ''}{propName(item.propId) ? ` · ${propName(item.propId)}` : ''}</Typography></Box>
                  {!readOnly ? <Button aria-label={`Slett ${item.title}`} onClick={() => updateOperations((current) => ({ ...current, continuityItems: current.continuityItems.filter((candidate) => candidate.id !== item.id) }))} sx={{ minWidth: targetSize, minHeight: targetSize, color: '#fca5a5', alignSelf: { sm: 'flex-start' } }}><DeleteIcon /></Button> : null}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4,minmax(0,1fr))' }, gap: 1, mt: 1.5 }}>
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Status</InputLabel><Select label="Status" inputProps={{ 'aria-label': `${item.title} status` }} value={item.status} onChange={(event) => updateContinuityItem(item, { status: event.target.value as ArtContinuityStatus })}>{Object.entries(CONTINUITY_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Kilde</InputLabel><Select label="Kilde" inputProps={{ 'aria-label': `${item.title} kilde` }} value={item.source} onChange={(event) => updateContinuityItem(item, { source: event.target.value as ArtContinuitySource })}>{Object.entries(CONTINUITY_SOURCE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Tilstand</InputLabel><Select label="Tilstand" inputProps={{ 'aria-label': `${item.title} tilstand` }} value={item.condition} onChange={(event) => updateContinuityItem(item, { condition: event.target.value as ArtContinuityCondition })}>{Object.entries(CONTINUITY_CONDITION_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                  <FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Opptaksdag</InputLabel><Select label="Opptaksdag" inputProps={{ 'aria-label': `${item.title} opptaksdag` }} value={item.productionDayId ?? ''} onChange={(event) => updateContinuityItem(item, { productionDayId: String(event.target.value) || undefined })}><MenuItem value="">Ikke planlagt</MenuItem>{daysForScene.map((day) => <MenuItem key={day.id} value={day.id}>{day.date || day.id}</MenuItem>)}</Select></FormControl>
                  <TextField label="Ansvarlig" value={item.owner ?? ''} onChange={(event) => updateContinuityItem(item, { owner: event.target.value })} disabled={readOnly} inputProps={{ maxLength: 160 }} size="small" sx={fieldSx} />
                  <TextField label="Plassering / rack / kasse" value={item.location ?? ''} onChange={(event) => updateContinuityItem(item, { location: event.target.value })} disabled={readOnly} inputProps={{ maxLength: 500 }} size="small" sx={{ ...fieldSx, gridColumn: { md: 'span 3' } }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,minmax(0,1fr))' }, gap: 1, mt: 1 }}>
                  <TextField label="Preset / før opptak" value={item.presetNotes ?? ''} onChange={(event) => updateContinuityItem(item, { presetNotes: event.target.value })} disabled={readOnly} multiline minRows={2} inputProps={{ maxLength: 4000 }} sx={fieldSx} />
                  <TextField label="Reset / etter take" value={item.resetNotes ?? ''} onChange={(event) => updateContinuityItem(item, { resetNotes: event.target.value })} disabled={readOnly} multiline minRows={2} inputProps={{ maxLength: 4000 }} sx={fieldSx} />
                  <TextField label="Avvik / skade / mangler" value={item.issue ?? ''} onChange={(event) => updateContinuityItem(item, { issue: event.target.value })} disabled={readOnly} multiline minRows={2} inputProps={{ maxLength: 2000 }} sx={fieldSx} />
                </Box>
                {references.length > 0 ? (
                  <Box
                    aria-label={`${item.title} referansebilder`}
                    sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1, mt: 1.25 }}
                  >
                    {references.map(({ phase, reference }) => {
                      const isOpening = openingContinuityReferenceId === reference.id;
                      return (
                        <Card key={`${phase}-${reference.id}`} variant="outlined" sx={{ bgcolor: '#070b11', borderColor: 'rgba(147,197,253,.22)', overflow: 'hidden' }}>
                          <CardActionArea
                            aria-label={`Åpne ${phase.toLowerCase()}-referanse ${reference.label || reference.kind}`}
                            onClick={() => void openContinuityReference(item, phase as 'Før' | 'Etter', reference)}
                            disabled={isOpening || (!reference.url && (!reference.storageFileId || !item.productionDayId))}
                            sx={{ display: 'grid', gridTemplateColumns: { xs: '112px minmax(0,1fr)', md: 'minmax(150px,.78fr) minmax(0,1fr)' }, minHeight: { xs: 112, md: 132 }, textAlign: 'left', ...focusVisibleStyles }}
                          >
                            <Box sx={{ position: 'relative', height: '100%', minHeight: { xs: 112, md: 132 }, bgcolor: '#111827', overflow: 'hidden' }}>
                              {reference.url && reference.kind === 'photo' ? (
                                <Box component="img" src={reference.url} alt={`${phase}-referanse for ${item.title}`} loading="lazy" sx={{ width: '100%', height: '100%', position: 'absolute', inset: 0, objectFit: 'cover' }} />
                              ) : (
                                <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', color: '#93c5fd' }}>
                                  {isOpening ? <CircularProgress size={24} color="inherit" /> : <PhotoIcon sx={{ fontSize: 34 }} />}
                                </Box>
                              )}
                              <Chip label={phase} size="small" sx={{ position: 'absolute', top: 8, left: 8, color: '#fff', bgcolor: phase === 'Før' ? 'rgba(30,64,175,.88)' : 'rgba(157,23,77,.88)', fontWeight: 800 }} />
                            </Box>
                            <Box sx={{ minWidth: 0, p: 1.25 }}>
                              <Typography noWrap sx={{ fontWeight: 760, fontSize: '.82rem' }}>{reference.label || `${phase}-referanse`}</Typography>
                              <Typography sx={{ color: roleTokens.textMuted, fontSize: '.7rem', mt: .35 }}>
                                {reference.storageProvider === 'aws_s3' ? 'Privat Role Room-media' : 'Produksjonsreferanse'} · Trykk for å kontrollere
                              </Typography>
                            </Box>
                          </CardActionArea>
                        </Card>
                      );
                    })}
                  </Box>
                ) : (
                  <Box sx={{ mt: 1.25, p: 2, display: 'flex', alignItems: 'center', gap: 1.25, border: '1px dashed rgba(147,197,253,.28)', borderRadius: 1.5, color: roleTokens.textMuted, bgcolor: 'rgba(59,130,246,.035)' }}>
                    <PhotoIcon sx={{ color: '#93c5fd' }} />
                    <Box><Typography sx={{ color: roleTokens.text, fontSize: '.8rem', fontWeight: 720 }}>Ingen før-/etterreferanser ennå</Typography><Typography sx={{ fontSize: '.7rem' }}>Fotografer fra samme vinkel for en trygg visuell sammenligning.</Typography></Box>
                  </Box>
                )}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, gap: 1, mt: 1.25 }}>
                  {!readOnly ? <><Button component="label" variant="outlined" startIcon={uploadingContinuityKey === `${item.id}:before` ? <CircularProgress size={16} /> : <PhotoIcon />} disabled={!item.productionDayId || Boolean(uploadingContinuityKey)} sx={{ minHeight: targetSize }}>Før-bilde<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadContinuityReference(item, 'before', file); event.currentTarget.value = ''; }} /></Button><Button component="label" variant="outlined" startIcon={uploadingContinuityKey === `${item.id}:after` ? <CircularProgress size={16} /> : <PhotoIcon />} disabled={!item.productionDayId || Boolean(uploadingContinuityKey)} sx={{ minHeight: targetSize }}>Etter-bilde<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadContinuityReference(item, 'after', file); event.currentTarget.value = ''; }} /></Button></> : null}
                  {!item.productionDayId ? <Typography sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>Velg opptaksdag for private før-/etterbilder.</Typography> : null}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    );
  };

  const renderDepartments = () => (
    <Stack spacing={1.25}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 1 }}><Box><Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 780 }}>Avdelingshandoff</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.8rem' }}>Ansvar, frist og status per fagområde—samme scenegrunnlag, ingen kopierte lister.</Typography></Box><Button variant="outlined" startIcon={<PropsIcon />} onClick={onOpenProps} sx={{ minHeight: targetSize, color: '#f9a8d4', borderColor: 'rgba(244,114,182,.35)' }}>Rekvisittregister</Button></Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2,minmax(0,1fr))' }, gap: 1.25 }}>{operations.handoffs.map((handoff) => {
        const tone = statusTone(handoff.status);
        return <Card key={handoff.id} variant="outlined" sx={{ ...panelSx, borderColor: `${tone.color}33` }}><CardContent sx={{ p: 1.5 }}><Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1.25 }}><Box><Typography sx={{ fontWeight: 760 }}>{ART_DEPARTMENT_LABELS[handoff.department]}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.7rem' }}>{handoff.title}</Typography></Box><Chip label={HANDOFF_STATUS_LABELS[handoff.status]} size="small" sx={{ color: tone.color, bgcolor: tone.background }} /></Box><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0,1fr)' }, gap: 1 }}><FormControl size="small" sx={fieldSx} disabled={readOnly}><InputLabel>Status</InputLabel><Select label="Status" inputProps={{ 'aria-label': `${ART_DEPARTMENT_LABELS[handoff.department]} handoffstatus` }} value={handoff.status} onChange={(event) => updateHandoff(handoff, { status: event.target.value as ArtHandoffStatus })}>{Object.entries(HANDOFF_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField label="Ansvarlig" value={handoff.owner ?? ''} onChange={(event) => updateHandoff(handoff, { owner: event.target.value })} disabled={readOnly} inputProps={{ maxLength: 160 }} size="small" sx={fieldSx} /></Box><TextField label="Notat / leveranse" value={handoff.notes ?? ''} onChange={(event) => updateHandoff(handoff, { notes: event.target.value })} disabled={readOnly} multiline minRows={2} inputProps={{ maxLength: 3000 }} fullWidth sx={{ ...fieldSx, mt: 1 }} /></CardContent></Card>;
      })}</Box>
    </Stack>
  );

  const renderHandoff = () => (
    <Stack spacing={2}>
      <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: 2 }}><Typography component="h2" sx={{ fontSize: '1.08rem', fontWeight: 780 }}>Klar til neste avdeling?</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.8rem', mt: .3 }}>Dette er en forhåndsvisning av registrert status. «Klar for review» er ikke det samme som godkjent eller låst.</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1, mt: 1.5 }}>{[
        { label: 'Scener til review', value: brief.stats.reviewSceneCount, detail: `${brief.stats.blockedSceneCount} blokkert` },
        { label: 'Beslutninger åpne', value: brief.stats.openDecisionCount, detail: `${operations.decisions.length} totalt` },
        { label: 'Handoffs klare', value: brief.stats.readyHandoffCount, detail: `${operations.handoffs.length} fagområder` },
      ].map((item) => <Box key={item.label} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}><Typography sx={{ fontSize: '1.6rem', fontWeight: 820 }}>{item.value}</Typography><Typography sx={{ fontWeight: 720, fontSize: '.78rem' }}>{item.label}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.68rem' }}>{item.detail}</Typography></Box>)}</Box></CardContent></Card>
      <Card variant="outlined" sx={panelSx}><CardContent sx={{ p: 2 }}><Typography component="h2" sx={{ fontSize: '1.02rem', fontWeight: 760, mb: 1 }}>Review-kø</Typography>{operations.decisions.filter((decision) => decision.status === 'ready_for_review').length === 0 ? <Typography sx={{ color: roleTokens.textMuted, fontSize: '.8rem' }}>Ingen beslutninger er markert klare for review.</Typography> : <Stack spacing={1}>{operations.decisions.filter((decision) => decision.status === 'ready_for_review').map((decision) => <Box key={decision.id} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.18)' }}><Typography sx={{ fontWeight: 740 }}>{decision.title}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.72rem' }}>{DECISION_IMPACT_LABELS[decision.impact]} · {decision.notes || 'Ingen begrunnelse registrert'}</Typography></Box>)}</Stack>}</CardContent></Card>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}><Button variant="outlined" onClick={onOpenSchedule} sx={{ minHeight: targetSize, color: roleTokens.text, borderColor: roleTokens.border }}>Kontroller opptaksplan</Button><Button variant="outlined" onClick={() => onOpenStoryboard()} sx={{ minHeight: targetSize, color: roleTokens.text, borderColor: roleTokens.border }}>Kontroller storyboard</Button></Box>
    </Stack>
  );

  return (
    <Box component="section" aria-labelledby="art-department-title" data-testid="art-department-workspace" sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#080c13', color: roleTokens.text, p: { xs: 1.25, sm: 2, lg: 3 } }}>
      <Box sx={{ width: '100%', maxWidth: 1540, mx: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: { lg: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 2 }}><Box><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: .5 }}><Chip label="PRODUKSJONSDESIGN" size="small" sx={{ color: '#fbcfe8', bgcolor: 'rgba(236,72,153,.12)', border: '1px solid rgba(244,114,182,.28)', fontWeight: 820, letterSpacing: .7 }} />{readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}{dirty ? <Chip label={draftSavedAt ? `Lokalt utkast · ${new Date(draftSavedAt).toLocaleTimeString('nb-NO')}` : 'Lokalt utkast'} size="small" sx={{ color: '#fde68a', bgcolor: 'rgba(245,158,11,.12)' }} /> : <Chip label={`Synkronisert · v${record?.version ?? 0}`} size="small" sx={{ color: '#86efac', bgcolor: 'rgba(34,197,94,.1)' }} />}</Stack><Typography id="art-department-title" component="h1" sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 800 }}>{project.name}</Typography><Typography sx={{ color: roleTokens.textMuted, mt: .25, maxWidth: 840 }}>Fra manusbehov og visuell retning til set, rekvisitt, kostyme, hår/sminke og dokumentert continuity.</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={() => { if (confirmIfDirty()) onOpenFullWorkspace(); }} sx={{ minHeight: targetSize, color: roleTokens.text, borderColor: roleTokens.border }}>Hele prosjektet</Button>{!readOnly && dirty ? <Button variant="text" onClick={discardLocalDraft} sx={{ minHeight: targetSize, color: roleTokens.textMuted }}>Forkast utkast</Button> : null}{!readOnly ? <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} disabled={!dirty || saving || Boolean(conflict)} onClick={() => void save()} data-testid="art-department-save" sx={{ minHeight: targetSize, bgcolor: '#db2777', '&:hover': { bgcolor: '#be185d' } }}>Lagre</Button> : null}</Stack></Box>

        {feedback ? <Alert severity={feedback.type} sx={{ mb: 1.5 }} action={conflict ? <Stack direction="row" spacing={.5}><Button color="inherit" size="small" onClick={keepLocalConflictVersion}>Behold lokalt</Button><Button color="inherit" size="small" onClick={loadConflictVersion}>Last serverversjon</Button></Stack> : feedback.type === 'error' ? <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>Prøv igjen</Button> : undefined}>{feedback.text}</Alert> : null}
        {conflict ? <Alert icon={<WarningIcon />} severity="warning" sx={{ mb: 1.5 }}>Serveren er på versjon {conflict.version}. Ditt lokale utkast er ikke overskrevet; velg eksplisitt om serverversjonen skal lastes.</Alert> : null}

        <Box component="nav" aria-label="Produksjonsdesignerens arbeidsflater" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: `repeat(${ART_DEPARTMENT_SURFACES.length},minmax(0,1fr))` }, gap: .75, p: .75, mb: 2, border: `1px solid ${roleTokens.border}`, bgcolor: 'rgba(14,18,30,.94)', borderRadius: 2 }}>{ART_DEPARTMENT_SURFACES.map((surface) => { const meta = SURFACE_META[surface]; const Icon = meta.icon; const active = surface === activeSurface; return <Button key={surface} startIcon={<Icon sx={{ fontSize: 19 }} />} onClick={() => navigateSafely(surface)} aria-current={active ? 'page' : undefined} sx={{ minHeight: targetSize, justifyContent: 'flex-start', color: active ? '#fbcfe8' : roleTokens.textMuted, bgcolor: active ? 'rgba(236,72,153,.13)' : 'transparent', border: `1px solid ${active ? 'rgba(244,114,182,.3)' : 'transparent'}`, ...focusVisibleStyles }}>{meta.label}</Button>; })}</Box>

        {activeSurface === 'overview' ? renderOverview() : null}
        {activeSurface === 'scenes' ? renderScenes() : null}
        {activeSurface === 'visual-direction' ? renderVisualDirection() : null}
        {activeSurface === 'continuity' ? renderContinuity() : null}
        {activeSurface === 'departments' ? renderDepartments() : null}
        {activeSurface === 'handoff' ? renderHandoff() : null}
      </Box>
      <Dialog
        open={Boolean(continuityPreview)}
        onClose={() => setContinuityPreview(null)}
        maxWidth="lg"
        fullWidth
        aria-labelledby="continuity-preview-title"
        PaperProps={{ sx: { bgcolor: '#070b11', color: roleTokens.text, border: '1px solid rgba(147,197,253,.22)' } }}
      >
        <DialogTitle id="continuity-preview-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
          <Typography component="span" noWrap sx={{ fontWeight: 780 }}>{continuityPreview?.label}</Typography>
          <IconButton aria-label="Lukk bildevisning" onClick={() => setContinuityPreview(null)} sx={{ minWidth: targetSize, minHeight: targetSize, color: roleTokens.text }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: { xs: 1, sm: 2 }, bgcolor: '#03060a' }}>
          {continuityPreview?.kind === 'video' ? (
            <Box component="video" src={continuityPreview.src} controls playsInline sx={{ display: 'block', width: '100%', maxHeight: '76vh', bgcolor: '#000' }} />
          ) : continuityPreview ? (
            <Box component="img" src={continuityPreview.src} alt={continuityPreview.label} sx={{ display: 'block', width: '100%', maxHeight: '76vh', objectFit: 'contain', bgcolor: '#000' }} />
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default ArtDepartmentWorkspace;
