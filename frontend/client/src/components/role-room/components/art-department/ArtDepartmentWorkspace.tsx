import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Add as AddIcon,
  ArchitectureOutlined as DesignIcon,
  ArrowForward as ArrowForwardIcon,
  AssignmentTurnedInOutlined as HandoffIcon,
  AutoAwesomeMosaicOutlined as VisualIcon,
  CategoryOutlined as PropsIcon,
  DeleteOutline as DeleteIcon,
  GroupsOutlined as DepartmentsIcon,
  MovieCreationOutlined as ScenesIcon,
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
  FormControl,
  FormControlLabel,
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
} from '../../models/casting';
import { MOBILE_TOUCH_TARGET_SIZE, TOUCH_TARGET_SIZE, focusVisibleStyles } from '../../constants/accessibility';
import { useBeforeUnloadIfDirty } from '../../hooks/useBeforeUnloadIfDirty';
import { roleTokens } from '../../theme/roleTokens';
import {
  ArtDepartmentConflictError,
  artDepartmentService,
} from '../../services/artDepartmentService';
import { useScreenTier } from '../production/useScreenTier';
import {
  ART_DEPARTMENT_LABELS,
  ART_DEPARTMENT_SURFACES,
  buildArtDepartmentWorkspaceBrief,
  createArtDepartmentId,
  createEmptyArtDepartmentOperations,
  mergeArtDepartmentOperations,
  upsertDecision,
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

const DEPARTMENTS = Object.keys(ART_DEPARTMENT_LABELS) as ArtDepartmentId[];

const SURFACE_META: Record<ArtDepartmentSurface, { label: string; icon: typeof DesignIcon }> = {
  overview: { label: 'Oversikt', icon: DesignIcon },
  scenes: { label: 'Scener', icon: ScenesIcon },
  'visual-direction': { label: 'Visuell retning', icon: VisualIcon },
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
  if (status === 'ready' || status === 'ready_for_review') return { color: '#86efac', background: 'rgba(34,197,94,.12)' };
  if (status === 'designing' || status === 'researching' || status === 'in_progress') return { color: '#f9a8d4', background: 'rgba(236,72,153,.12)' };
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
      setOperations(mergeArtDepartmentOperations(next.operations));
      setDirty(false);
      setConflict(null);
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke hente produksjonsdesigngrunnlaget.' });
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { void load(); }, [load]);

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
    setFeedback({ type: 'success', text: 'Serverversjonen er lastet inn.' });
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
          ['Scener', brief.stats.sceneCount], ['Planlagt', brief.stats.plannedSceneCount], ['Blokkert', brief.stats.blockedSceneCount], ['Til review', brief.stats.reviewSceneCount], ['Rekvisitt uten scene', brief.stats.unassignedPropCount], ['Handoffs klare', brief.stats.readyHandoffCount],
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
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: { lg: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 2 }}><Box><Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: .5 }}><Chip label="PRODUKSJONSDESIGN" size="small" sx={{ color: '#fbcfe8', bgcolor: 'rgba(236,72,153,.12)', border: '1px solid rgba(244,114,182,.28)', fontWeight: 820, letterSpacing: .7 }} />{readOnly ? <Chip label="Skrivebeskyttet" size="small" variant="outlined" /> : null}{dirty ? <Chip label="Lokalt utkast" size="small" sx={{ color: '#fde68a', bgcolor: 'rgba(245,158,11,.12)' }} /> : <Chip label={`Synkronisert · v${record?.version ?? 0}`} size="small" sx={{ color: '#86efac', bgcolor: 'rgba(34,197,94,.1)' }} />}</Stack><Typography id="art-department-title" component="h1" sx={{ fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 800 }}>{project.name}</Typography><Typography sx={{ color: roleTokens.textMuted, mt: .25, maxWidth: 840 }}>Fra manusbehov og visuell retning til set, rekvisitt, konstruksjon og dokumentert handoff.</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={() => { if (confirmIfDirty()) onOpenFullWorkspace(); }} sx={{ minHeight: targetSize, color: roleTokens.text, borderColor: roleTokens.border }}>Hele prosjektet</Button>{!readOnly ? <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} disabled={!dirty || saving} onClick={() => void save()} data-testid="art-department-save" sx={{ minHeight: targetSize, bgcolor: '#db2777', '&:hover': { bgcolor: '#be185d' } }}>Lagre</Button> : null}</Stack></Box>

        {feedback ? <Alert severity={feedback.type} sx={{ mb: 1.5 }} action={conflict ? <Button color="inherit" size="small" onClick={loadConflictVersion}>Last serverversjon</Button> : feedback.type === 'error' ? <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => void load()}>Prøv igjen</Button> : undefined}>{feedback.text}</Alert> : null}
        {conflict ? <Alert icon={<WarningIcon />} severity="warning" sx={{ mb: 1.5 }}>Serveren er på versjon {conflict.version}. Ditt lokale utkast er ikke overskrevet; velg eksplisitt om serverversjonen skal lastes.</Alert> : null}

        <Box component="nav" aria-label="Produksjonsdesignerens arbeidsflater" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: `repeat(${ART_DEPARTMENT_SURFACES.length},minmax(0,1fr))` }, gap: .75, p: .75, mb: 2, border: `1px solid ${roleTokens.border}`, bgcolor: 'rgba(14,18,30,.94)', borderRadius: 2 }}>{ART_DEPARTMENT_SURFACES.map((surface) => { const meta = SURFACE_META[surface]; const Icon = meta.icon; const active = surface === activeSurface; return <Button key={surface} startIcon={<Icon sx={{ fontSize: 19 }} />} onClick={() => navigateSafely(surface)} aria-current={active ? 'page' : undefined} sx={{ minHeight: targetSize, justifyContent: 'flex-start', color: active ? '#fbcfe8' : roleTokens.textMuted, bgcolor: active ? 'rgba(236,72,153,.13)' : 'transparent', border: `1px solid ${active ? 'rgba(244,114,182,.3)' : 'transparent'}`, ...focusVisibleStyles }}>{meta.label}</Button>; })}</Box>

        {activeSurface === 'overview' ? renderOverview() : null}
        {activeSurface === 'scenes' ? renderScenes() : null}
        {activeSurface === 'visual-direction' ? renderVisualDirection() : null}
        {activeSurface === 'departments' ? renderDepartments() : null}
        {activeSurface === 'handoff' ? renderHandoff() : null}
      </Box>
    </Box>
  );
}

export default ArtDepartmentWorkspace;
