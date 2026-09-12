import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  DownloadOutlined as DownloadIcon,
  PermMediaOutlined as MediaIcon,
  OpenInFullOutlined as FullWorkspaceIcon,
  RestoreOutlined as RestoreIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  ProductionContinuityDeviation,
  ProductionContinuityEntry,
  ProductionContinuityOperations,
  ProductionContinuityReference,
  ProductionContinuityTake,
  ProductionDay,
} from '../../models/casting';
import { useBeforeUnloadIfDirty } from '../../hooks/useBeforeUnloadIfDirty';
import {
  ProductionContinuityConflictError,
  productionContinuityService,
} from '../../services/productionContinuityService';
import {
  buildContinuityDailyReport,
  buildContinuityOperations,
  buildLinedScriptReport,
  clearContinuityDraft,
  continuitySummary,
  createContinuityId,
  loadContinuityDraft,
  mergeContinuityServerMetadata,
  nextTakeNumber,
  restoreContinuitySnapshot,
  saveContinuityDraft,
  sceneLabel,
  selectContinuityDay,
  type ContinuityDraft,
} from './continuityWorkspaceModel';

interface Props {
  project: CastingProject;
  readOnly?: boolean;
  canComment?: boolean;
  dataLoading?: boolean;
  onOpenFullWorkspace: () => void;
  onSaved?: (day: ProductionDay) => void;
}

const panelSx = {
  bgcolor: 'rgba(7, 17, 29, .9)',
  borderColor: 'rgba(45, 212, 191, .2)',
  color: '#f8fafc',
};

const fieldSx = {
  '& .MuiInputBase-root': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,.025)' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& fieldset': { borderColor: 'rgba(94,234,212,.25)' },
};

const TAKE_STATUS_LABELS = { good: 'God', hold: 'Hold', ng: 'NG', false_start: 'Feilstart' } as const;
const SCENE_STATUS_LABELS = { not_started: 'Ikke startet', in_progress: 'Pågår', complete: 'Ferdig' } as const;
const CATEGORY_LABELS = { costume: 'Kostyme', hair: 'Hår', makeup: 'Sminke', props: 'Rekvisitt', blocking: 'Posisjon', action: 'Handling', eyeline: 'Blikkretning', set: 'Set' } as const;
const SEVERITY_LABELS = { info: 'Info', warning: 'Viktig', critical: 'Kritisk' } as const;
const DEVIATION_LABELS = { improvised_dialogue: 'Improvisert dialog', missing_line: 'Utelatt replikk', dialogue_change: 'Endret replikk', action_change: 'Endret handling', continuity_risk: 'Kontinuitetsrisiko', other: 'Annet' } as const;

const nowIso = () => new Date().toISOString();

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function SectionCard({ title, subtitle, children, testId }: { title: string; subtitle?: string; children: React.ReactNode; testId?: string }) {
  return (
    <Card data-testid={testId} variant="outlined" sx={{ ...panelSx, p: { xs: 1.5, md: 2 } }}>
      <Typography component="h2" sx={{ fontSize: '1.05rem', fontWeight: 800 }}>{title}</Typography>
      {subtitle ? <Typography sx={{ mt: .3, mb: 1.5, color: 'rgba(203,213,225,.68)', fontSize: '.8rem' }}>{subtitle}</Typography> : <Box sx={{ mb: 1.5 }} />}
      {children}
    </Card>
  );
}

function MediaReference({
  projectId,
  dayId,
  reference,
}: {
  projectId: string;
  dayId: string;
  reference: ProductionContinuityReference;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(reference.url ?? null);
  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!reference.storageFileId) {
      setSignedUrl(reference.url ?? null);
      setMediaError(false);
      return () => { active = false; };
    }
    setSignedUrl(null);
    setMediaError(false);
    void productionContinuityService.getMediaUrl(projectId, dayId, reference.storageFileId)
      .then((result) => { if (active) setSignedUrl(result.url); })
      .catch(() => { if (active) setMediaError(true); });
    return () => { active = false; };
  }, [dayId, projectId, reference.storageFileId, reference.url]);

  if (mediaError) {
    return <Typography sx={{ color: '#fca5a5', fontSize: '.76rem' }}>Mediet kunne ikke åpnes. Prøv å laste siden på nytt.</Typography>;
  }
  if (!signedUrl) {
    return <Stack direction="row" gap={.7} alignItems="center"><CircularProgress size={13} /><Typography sx={{ fontSize: '.76rem' }}>Henter privat mediereferanse…</Typography></Stack>;
  }
  return (
    <Box sx={{ mt: .8, maxWidth: 420 }}>
      {reference.kind === 'photo'
        ? <Box component="img" src={signedUrl} alt={reference.label || 'Kontinuitetsreferanse'} sx={{ display: 'block', width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 1.5, bgcolor: '#020617' }} />
        : reference.kind === 'video'
          ? <Box component="video" src={signedUrl} controls preload="metadata" sx={{ display: 'block', width: '100%', maxHeight: 280, borderRadius: 1.5, bgcolor: '#020617' }} />
          : null}
      <Typography component="a" href={signedUrl} target="_blank" rel="noreferrer" sx={{ display: 'block', mt: .5, color: '#5eead4', fontSize: '.76rem' }}>
        {reference.label || 'Åpne referanse'}
      </Typography>
    </Box>
  );
}

export function ContinuityWorkspace({
  project,
  readOnly = false,
  canComment = false,
  dataLoading = false,
  onOpenFullWorkspace,
  onSaved,
}: Props) {
  const productionDays = useMemo(() => Array.isArray(project.productionDays) ? project.productionDays : [], [project.productionDays]);
  const activeDays = useMemo(() => productionDays.filter((day) => day.status !== 'cancelled'), [productionDays]);
  const initialDay = useMemo(() => selectContinuityDay(productionDays), [productionDays]);
  const [dayId, setDayId] = useState(initialDay?.id ?? '');
  const selectedDay = productionDays.find((day) => day.id === dayId) ?? initialDay;
  const [sceneId, setSceneId] = useState(selectedDay?.scenes[0] ?? '');
  const [operations, setOperations] = useState<ProductionContinuityOperations | null>(selectedDay ? buildContinuityOperations(selectedDay) : null);
  const [baseVersion, setBaseVersion] = useState(Number(selectedDay?.continuityVersion ?? 0));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [staleDraft, setStaleDraft] = useState<ContinuityDraft | null>(null);
  const [conflictDay, setConflictDay] = useState<ProductionDay | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; text: string } | null>(null);
  const [takeDraft, setTakeDraft] = useState({ slate: '', cameraRoll: '', soundRoll: '', timecodeStart: '', timecodeEnd: '', status: 'good' as ProductionContinuityTake['status'], circled: false, continuityNotes: '', performanceNotes: '', technicalNotes: '', soundNotes: '' });
  const [entryDraft, setEntryDraft] = useState({ category: 'props' as ProductionContinuityEntry['category'], subject: '', description: '', severity: 'info' as ProductionContinuityEntry['severity'], referenceUrl: '', referenceKind: 'photo' as 'photo' | 'video' | 'other' });
  const [pendingReferences, setPendingReferences] = useState<ProductionContinuityReference[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deviationDraft, setDeviationDraft] = useState({ type: 'improvised_dialogue' as ProductionContinuityDeviation['type'], character: '', originalText: '', performedText: '', note: '', timecode: '', accepted: false });
  const [commentDraft, setCommentDraft] = useState('');
  const hydratedSelectionRef = useRef<string | null>(null);
  const { confirmIfDirty } = useBeforeUnloadIfDirty({ isDirty: dirty, message: 'Kontinuitetsflaten har ulagrede endringer. Vil du forlate den?' });

  useEffect(() => {
    setDayId((current) => productionDays.some((day) => day.id === current)
      ? current
      : selectContinuityDay(productionDays)?.id ?? '');
  }, [productionDays]);

  useEffect(() => {
    if (!selectedDay) {
      hydratedSelectionRef.current = null;
      setOperations(null);
      return;
    }
    const selectionKey = `${project.id}:${selectedDay.id}`;
    const selectionChanged = hydratedSelectionRef.current !== selectionKey;
    hydratedSelectionRef.current = selectionKey;
    const serverOperations = buildContinuityOperations(selectedDay);
    const draft = loadContinuityDraft(project.id, selectedDay.id);
    setSceneId((current) => selectedDay.scenes.includes(current) ? current : selectedDay.scenes[0] ?? '');
    setBaseVersion(Number(selectedDay.continuityVersion ?? 0));
    setConflictDay(null);
    if (draft && draft.baseVersion === Number(selectedDay.continuityVersion ?? 0) && !readOnly) {
      setOperations(mergeContinuityServerMetadata(draft.operations, serverOperations));
      setDirty(true);
      setDraftSavedAt(draft.updatedAt);
      setStaleDraft(null);
      setFeedback({ type: 'info', text: 'Et lokalt sikkerhetsutkast ble gjenopprettet.' });
    } else {
      setOperations(serverOperations);
      setDirty(false);
      setDraftSavedAt(null);
      setStaleDraft(draft);
      if (draft && !readOnly) {
        setFeedback({ type: 'warning', text: 'Det finnes et lokalt utkast fra en eldre serverversjon. Velg om det skal gjenopprettes.' });
      } else if (selectionChanged) {
        setFeedback(null);
      } else {
        setFeedback((current) => current?.type === 'success' ? current : null);
      }
    }
  }, [project.id, readOnly, selectedDay]);

  useEffect(() => {
    if (!dirty || !operations || !selectedDay || readOnly) return;
    const timer = window.setTimeout(() => {
      const updatedAt = nowIso();
      saveContinuityDraft(project.id, selectedDay.id, { baseVersion, updatedAt, operations });
      setDraftSavedAt(updatedAt);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [baseVersion, dirty, operations, project.id, readOnly, selectedDay]);

  useEffect(() => {
    setPendingReferences([]);
  }, [sceneId, selectedDay?.id]);

  const summary = useMemo(() => operations ? continuitySummary(operations) : null, [operations]);
  const sceneTakes = useMemo(() => operations?.takes.filter((item) => item.sceneId === sceneId) ?? [], [operations, sceneId]);
  const sceneEntries = useMemo(() => operations?.entries.filter((item) => item.sceneId === sceneId) ?? [], [operations, sceneId]);
  const sceneDeviations = useMemo(() => operations?.deviations.filter((item) => item.sceneId === sceneId) ?? [], [operations, sceneId]);
  const currentSceneRecord = operations?.sceneRecords.find((item) => item.sceneId === sceneId);
  const previousTake = sceneTakes.at(-1);
  const previousSceneId = selectedDay && sceneId ? selectedDay.scenes[selectedDay.scenes.indexOf(sceneId) - 1] : undefined;
  const previousSceneRecord = operations?.sceneRecords.find((item) => item.sceneId === previousSceneId);
  const sceneComments = operations?.comments.filter((item) => !item.sceneId || item.sceneId === sceneId) ?? [];

  const updateOperations = (updater: (current: ProductionContinuityOperations) => ProductionContinuityOperations) => {
    if (readOnly) return;
    setOperations((current) => current ? updater(current) : current);
    setDirty(true);
    setConflictDay(null);
    setFeedback(null);
  };

  const save = async () => {
    if (!selectedDay || !operations || readOnly) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updatedDay = await productionContinuityService.save(project.id, selectedDay.id, baseVersion, operations);
      onSaved?.(updatedDay);
      setOperations(buildContinuityOperations(updatedDay));
      setBaseVersion(Number(updatedDay.continuityVersion ?? baseVersion + 1));
      setDirty(false);
      setConflictDay(null);
      setStaleDraft(null);
      clearContinuityDraft(project.id, selectedDay.id);
      setDraftSavedAt(null);
      setFeedback({ type: 'success', text: `Kontinuitetsloggen er lagret som versjon ${updatedDay.continuityVersion ?? baseVersion + 1}.` });
    } catch (error) {
      if (error instanceof ProductionContinuityConflictError) {
        onSaved?.(error.productionDay);
        setConflictDay(error.productionDay);
        setFeedback({ type: 'warning', text: 'En annen bruker lagret først. Ditt lokale utkast er beholdt; velg hvilken versjon du vil fortsette med.' });
      } else {
        setFeedback({ type: 'error', text: `${error instanceof Error ? error.message : 'Kunne ikke lagre.'} Det lokale utkastet er beholdt.` });
      }
    } finally {
      setSaving(false);
    }
  };

  const addTake = () => {
    if (!operations || !sceneId) return;
    const take: ProductionContinuityTake = {
      id: createContinuityId('take'), sceneId, takeNumber: nextTakeNumber(operations, sceneId),
      status: takeDraft.status, circled: takeDraft.circled,
      slate: takeDraft.slate.trim() || undefined, cameraRoll: takeDraft.cameraRoll.trim() || undefined, soundRoll: takeDraft.soundRoll.trim() || undefined,
      timecodeStart: takeDraft.timecodeStart.trim() || undefined, timecodeEnd: takeDraft.timecodeEnd.trim() || undefined,
      continuityNotes: takeDraft.continuityNotes.trim() || undefined, performanceNotes: takeDraft.performanceNotes.trim() || undefined,
      technicalNotes: takeDraft.technicalNotes.trim() || undefined, soundNotes: takeDraft.soundNotes.trim() || undefined,
      recordedAt: nowIso(), updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, takes: [...current.takes, take] }));
    setTakeDraft((current) => ({ ...current, timecodeStart: '', timecodeEnd: '', circled: false, continuityNotes: '', performanceNotes: '', technicalNotes: '', soundNotes: '' }));
  };

  const addEntry = () => {
    if (!sceneId || !entryDraft.description.trim()) return;
    const references: ProductionContinuityEntry['references'] = [...pendingReferences];
    if (entryDraft.referenceUrl.trim()) {
      try {
        const url = new URL(entryDraft.referenceUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid');
        references.push({ id: createContinuityId('reference'), kind: entryDraft.referenceKind, url: url.toString() });
      } catch {
        setFeedback({ type: 'error', text: 'Referansen må være en gyldig http- eller https-lenke.' });
        return;
      }
    }
    const entry: ProductionContinuityEntry = {
      id: createContinuityId('entry'), sceneId, category: entryDraft.category,
      subject: entryDraft.subject.trim() || undefined, description: entryDraft.description.trim(), severity: entryDraft.severity,
      references, updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, entries: [...current.entries, entry] }));
    setEntryDraft((current) => ({ ...current, subject: '', description: '', referenceUrl: '' }));
    setPendingReferences([]);
  };

  const uploadMediaReference = async (file: File) => {
    if (!selectedDay || !sceneId) return;
    const isImage = file.type.startsWith('image/');
    const maxBytes = isImage ? 25 * 1024 * 1024 : 250 * 1024 * 1024;
    if ((!isImage && !file.type.startsWith('video/')) || file.size < 1 || file.size > maxBytes) {
      setFeedback({ type: 'error', text: isImage ? 'Bildet må være under 25 MB.' : 'Videoen må være under 250 MB og ha en støttet filtype.' });
      return;
    }
    setUploadingMedia(true);
    setFeedback(null);
    try {
      const reference = await productionContinuityService.uploadMedia(project.id, selectedDay.id, sceneId, file);
      setPendingReferences((current) => [...current, reference]);
      setFeedback({ type: 'success', text: `${reference.label || file.name} er lastet opp privat. Legg til kontinuitetspunktet for å knytte referansen til loggen.` });
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke laste opp mediet.' });
    } finally {
      setUploadingMedia(false);
    }
  };

  const addDeviation = () => {
    if (!sceneId || (!deviationDraft.originalText.trim() && !deviationDraft.performedText.trim() && !deviationDraft.note.trim())) return;
    const deviation: ProductionContinuityDeviation = {
      id: createContinuityId('deviation'), sceneId, type: deviationDraft.type,
      character: deviationDraft.character.trim() || undefined, originalText: deviationDraft.originalText.trim() || undefined,
      performedText: deviationDraft.performedText.trim() || undefined, note: deviationDraft.note.trim() || undefined,
      timecode: deviationDraft.timecode.trim() || undefined, accepted: deviationDraft.accepted, updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, deviations: [...current.deviations, deviation] }));
    setDeviationDraft((current) => ({ ...current, character: '', originalText: '', performedText: '', note: '', timecode: '', accepted: false }));
  };

  const addComment = async () => {
    if (!selectedDay || !commentDraft.trim() || !canComment) return;
    setSaving(true);
    try {
      const updatedDay = await productionContinuityService.addComment(project.id, selectedDay.id, baseVersion, { sceneId: sceneId || undefined, message: commentDraft.trim() });
      onSaved?.(updatedDay);
      setOperations((current) => current ? mergeContinuityServerMetadata(current, buildContinuityOperations(updatedDay)) : buildContinuityOperations(updatedDay));
      setBaseVersion(Number(updatedDay.continuityVersion ?? baseVersion + 1));
      setCommentDraft('');
      setFeedback({ type: 'success', text: 'Kommentaren er lagret uten å endre fagloggen.' });
    } catch (error) {
      if (error instanceof ProductionContinuityConflictError) {
        onSaved?.(error.productionDay);
        setConflictDay(error.productionDay);
        setFeedback({ type: 'warning', text: 'Kontinuitetsloggen ble oppdatert først. Last inn serverversjonen og prøv kommentaren igjen.' });
      } else {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke lagre kommentaren.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const chooseLocalConflict = () => {
    if (!conflictDay || !operations) return;
    setOperations(mergeContinuityServerMetadata(operations, buildContinuityOperations(conflictDay)));
    setBaseVersion(Number(conflictDay.continuityVersion ?? 0));
    setConflictDay(null);
    setDirty(true);
    setFeedback({ type: 'info', text: 'Lokalt utkast er beholdt og nye kommentarer er flettet inn. Kontroller og lagre på nytt.' });
  };

  const chooseServerConflict = () => {
    if (!conflictDay || !selectedDay) return;
    setOperations(buildContinuityOperations(conflictDay));
    setBaseVersion(Number(conflictDay.continuityVersion ?? 0));
    setConflictDay(null);
    setDirty(false);
    clearContinuityDraft(project.id, selectedDay.id);
    setDraftSavedAt(null);
    setFeedback({ type: 'info', text: 'Serverversjonen er lastet inn.' });
  };

  if (dataLoading && productionDays.length === 0) return <Alert severity="info">Henter produksjonsdager…</Alert>;
  if (productionDays.length === 0) return <Alert severity="info">Ingen produksjonsdag er registrert. Opprett dagen i opptaksplanen først.</Alert>;
  if (activeDays.length === 0) return <Alert severity="info">Alle registrerte produksjonsdager er avlyst.</Alert>;
  if (!selectedDay || !operations) return null;

  return (
    <Box component="section" data-testid="continuity-workspace" sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#051019', color: '#f8fafc', p: { xs: 1.5, md: 3 } }}>
      <Box sx={{ maxWidth: 1540, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Chip label="SCRIPT SUPERVISOR · KONTINUITET" size="small" sx={{ color: '#99f6e4', bgcolor: 'rgba(20,184,166,.12)', border: '1px solid rgba(45,212,191,.32)', fontWeight: 800 }} />
            <Typography component="h1" sx={{ mt: 1, fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800 }}>{project.name}</Typography>
            <Typography sx={{ color: 'rgba(203,213,225,.72)' }}>Take-logg, manusavvik og visuell kontinuitet samlet per scene.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ lg: 'center' }}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadText(`${project.name}-${selectedDay.date ?? selectedDay.id}-continuity.csv`, buildContinuityDailyReport(project, selectedDay, operations), 'text/csv;charset=utf-8')}>Dagsrapport</Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadText(`${project.name}-${selectedDay.date ?? selectedDay.id}-lined-script.txt`, buildLinedScriptReport(project, selectedDay, operations), 'text/plain;charset=utf-8')}>Klipperrapport</Button>
            <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={() => { if (confirmIfDirty()) onOpenFullWorkspace(); }}>Hele prosjektet</Button>
          </Stack>
        </Stack>

        {feedback ? <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert> : null}
        {staleDraft && !readOnly ? (
          <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => { setOperations(mergeContinuityServerMetadata(staleDraft.operations, operations)); setBaseVersion(Number(selectedDay.continuityVersion ?? 0)); setDirty(true); setStaleDraft(null); }}>Gjenopprett utkast</Button>}>
            Lokalt utkast fra {new Date(staleDraft.updatedAt).toLocaleString('nb-NO')} bygger på versjon {staleDraft.baseVersion}.
          </Alert>
        ) : null}
        {conflictDay ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
              <span>Lokal versjon {baseVersion} og serverversjon {conflictDay.continuityVersion ?? 0} må avklares.</span>
              <Stack direction="row" gap={1}><Button color="inherit" size="small" onClick={chooseLocalConflict}>Behold lokalt</Button><Button color="inherit" size="small" onClick={chooseServerConflict}>Last serverversjon</Button></Stack>
            </Stack>
          </Alert>
        ) : null}

        <Card variant="outlined" sx={{ ...panelSx, p: 2, mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 220, ...fieldSx }}><InputLabel>Produksjonsdag</InputLabel><Select value={selectedDay.id} label="Produksjonsdag" onChange={(event) => { if (!confirmIfDirty()) return; setDayId(String(event.target.value)); }}>
              {activeDays.map((day) => <MenuItem key={day.id} value={day.id}>{day.date ?? day.id}</MenuItem>)}
            </Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 320, flex: 1, ...fieldSx }}><InputLabel>Scene</InputLabel><Select value={sceneId} label="Scene" onChange={(event) => setSceneId(String(event.target.value))}>
              {selectedDay.scenes.map((id) => <MenuItem key={id} value={id}>{sceneLabel(project, id)}</MenuItem>)}
            </Select></FormControl>
            <Chip label={`Versjon ${baseVersion}`} variant="outlined" sx={{ color: '#99f6e4', borderColor: 'rgba(45,212,191,.35)' }} />
            <Typography data-testid="continuity-save-status" sx={{ color: 'rgba(203,213,225,.65)', fontSize: '.76rem', minWidth: 180 }}>
              {dirty ? draftSavedAt ? `Utkast lagret lokalt ${new Date(draftSavedAt).toLocaleTimeString('nb-NO')}` : 'Lagrer lokalt utkast…' : selectedDay.continuityUpdatedAt ? `Synkronisert ${new Date(selectedDay.continuityUpdatedAt).toLocaleString('nb-NO')}` : 'Ikke synkronisert ennå'}
            </Typography>
            {!readOnly ? <><Button variant="text" disabled={!dirty || saving} onClick={() => { setOperations(buildContinuityOperations(selectedDay)); setBaseVersion(Number(selectedDay.continuityVersion ?? 0)); setDirty(false); clearContinuityDraft(project.id, selectedDay.id); }}>Forkast</Button><Button data-testid="save-continuity" variant="contained" startIcon={<SaveIcon />} disabled={!dirty || saving || Boolean(conflictDay)} onClick={save}>Lagre kontinuitet</Button></> : <Chip label="Lesetilgang" />}
          </Stack>
        </Card>

        {summary ? <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mb: 2 }}>
          {[['Scener ferdig', `${summary.completedScenes}/${summary.totalScenes}`], ['Takes', summary.takes], ['Sirklede takes', summary.circledTakes], ['Åpne risikoer', summary.openRisks], ['Manusavvik', summary.deviations]].map(([label, value]) => <Card key={String(label)} variant="outlined" sx={{ ...panelSx, py: 1.25, px: 1.5, flex: 1 }}><Typography sx={{ color: 'rgba(203,213,225,.62)', fontSize: '.72rem' }}>{label}</Typography><Typography sx={{ fontSize: '1.3rem', fontWeight: 800 }}>{value}</Typography></Card>)}
        </Stack> : null}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.45fr) minmax(360px, .75fr)' }, gap: 2 }}>
          <Stack gap={2}>
            <SectionCard title="Scene og take-logg" subtitle="Registrer take, tidskode og fagnotater. Eksisterende tekst endres aldri automatisk." testId="continuity-take-log">
              {currentSceneRecord ? <Stack direction={{ xs: 'column', md: 'row' }} gap={1} sx={{ mb: 1.5 }}>
                <FormControl size="small" sx={{ minWidth: 160, ...fieldSx }}><InputLabel>Scenestatus</InputLabel><Select disabled={readOnly} value={currentSceneRecord.status} label="Scenestatus" onChange={(event) => updateOperations((current) => ({ ...current, sceneRecords: current.sceneRecords.map((item) => item.sceneId === sceneId ? { ...item, status: event.target.value as typeof item.status, updatedAt: nowIso() } : item) }))}>{Object.entries(SCENE_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                <TextField disabled={readOnly} size="small" label="Sider planlagt" type="number" value={currentSceneRecord.pagesPlanned ?? ''} onChange={(event) => updateOperations((current) => ({ ...current, sceneRecords: current.sceneRecords.map((item) => item.sceneId === sceneId ? { ...item, pagesPlanned: event.target.value ? Number(event.target.value) : undefined, updatedAt: nowIso() } : item) }))} sx={{ width: 150, ...fieldSx }} inputProps={{ min: 0, step: .125 }} />
                <TextField disabled={readOnly} size="small" label="Sider filmet" type="number" value={currentSceneRecord.pagesShot ?? ''} onChange={(event) => updateOperations((current) => ({ ...current, sceneRecords: current.sceneRecords.map((item) => item.sceneId === sceneId ? { ...item, pagesShot: event.target.value ? Number(event.target.value) : undefined, updatedAt: nowIso() } : item) }))} sx={{ width: 150, ...fieldSx }} inputProps={{ min: 0, step: .125 }} />
                <TextField disabled={readOnly} size="small" label="Oppsett / blocking" value={currentSceneRecord.setup ?? ''} onChange={(event) => updateOperations((current) => ({ ...current, sceneRecords: current.sceneRecords.map((item) => item.sceneId === sceneId ? { ...item, setup: event.target.value, updatedAt: nowIso() } : item) }))} sx={{ flex: 1, ...fieldSx }} />
              </Stack> : null}
              {!readOnly ? <><Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
                <TextField size="small" label={`Take ${nextTakeNumber(operations, sceneId)}`} value={takeDraft.slate} onChange={(event) => setTakeDraft((current) => ({ ...current, slate: event.target.value }))} placeholder="Slate" sx={{ width: 150, ...fieldSx }} />
                <TextField size="small" label="Kamerarull" value={takeDraft.cameraRoll} onChange={(event) => setTakeDraft((current) => ({ ...current, cameraRoll: event.target.value }))} sx={{ width: 145, ...fieldSx }} />
                <TextField size="small" label="Lydrull" value={takeDraft.soundRoll} onChange={(event) => setTakeDraft((current) => ({ ...current, soundRoll: event.target.value }))} sx={{ width: 130, ...fieldSx }} />
                <TextField size="small" label="Start-TC" value={takeDraft.timecodeStart} onChange={(event) => setTakeDraft((current) => ({ ...current, timecodeStart: event.target.value }))} placeholder="01:02:03:04" sx={{ width: 150, ...fieldSx }} />
                <TextField size="small" label="Slutt-TC" value={takeDraft.timecodeEnd} onChange={(event) => setTakeDraft((current) => ({ ...current, timecodeEnd: event.target.value }))} sx={{ width: 150, ...fieldSx }} />
                <FormControl size="small" sx={{ minWidth: 130, ...fieldSx }}><InputLabel>Status</InputLabel><Select value={takeDraft.status} label="Status" onChange={(event) => setTakeDraft((current) => ({ ...current, status: event.target.value as ProductionContinuityTake['status'] }))}>{Object.entries(TAKE_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                <FormControlLabel control={<Checkbox checked={takeDraft.circled} onChange={(event) => setTakeDraft((current) => ({ ...current, circled: event.target.checked }))} />} label="Sirkle" />
              </Stack><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1, mt: 1 }}>
                <TextField size="small" label="Kontinuitetsnotat" multiline minRows={2} value={takeDraft.continuityNotes} onChange={(event) => setTakeDraft((current) => ({ ...current, continuityNotes: event.target.value }))} sx={fieldSx} />
                <TextField size="small" label="Performance" multiline minRows={2} value={takeDraft.performanceNotes} onChange={(event) => setTakeDraft((current) => ({ ...current, performanceNotes: event.target.value }))} sx={fieldSx} />
                <TextField size="small" label="Teknisk" multiline minRows={2} value={takeDraft.technicalNotes} onChange={(event) => setTakeDraft((current) => ({ ...current, technicalNotes: event.target.value }))} sx={fieldSx} />
                <TextField size="small" label="Lyd" multiline minRows={2} value={takeDraft.soundNotes} onChange={(event) => setTakeDraft((current) => ({ ...current, soundNotes: event.target.value }))} sx={fieldSx} />
              </Box><Button sx={{ mt: 1 }} startIcon={<AddIcon />} variant="outlined" onClick={addTake}>Registrer take {nextTakeNumber(operations, sceneId)}</Button></> : null}
              <Divider sx={{ my: 1.5, borderColor: 'rgba(148,163,184,.14)' }} />
              <Stack gap={1}>{sceneTakes.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.62)' }}>Ingen takes registrert.</Typography> : sceneTakes.slice().reverse().map((take) => <Box key={take.id} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: take.circled ? 'rgba(20,184,166,.1)' : 'rgba(255,255,255,.025)', border: '1px solid rgba(148,163,184,.12)' }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 800 }}>Take {take.takeNumber}{take.slate ? ` · ${take.slate}` : ''} {take.circled ? '⭕' : ''}</Typography><Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem' }}>{TAKE_STATUS_LABELS[take.status]} · {take.timecodeStart || 'uten TC'}{take.timecodeEnd ? `–${take.timecodeEnd}` : ''}</Typography></Box>{!readOnly ? <Stack direction="row"><Button size="small" onClick={() => updateOperations((current) => ({ ...current, takes: current.takes.map((item) => item.id === take.id ? { ...item, circled: !item.circled, updatedAt: nowIso() } : item) }))}>{take.circled ? 'Fjern sirkel' : 'Sirkle'}</Button><Button aria-label={`Slett take ${take.takeNumber}`} color="error" onClick={() => updateOperations((current) => ({ ...current, takes: current.takes.filter((item) => item.id !== take.id), entries: current.entries.filter((item) => item.takeId !== take.id), deviations: current.deviations.filter((item) => item.takeId !== take.id) }))}><DeleteIcon fontSize="small" /></Button></Stack> : null}</Stack>{take.continuityNotes ? <Typography sx={{ mt: .7 }}>{take.continuityNotes}</Typography> : null}</Box>)}</Stack>
            </SectionCard>

            <SectionCard title="Visuell og fysisk kontinuitet" subtitle="Kostyme, hår, sminke, rekvisitt, posisjon, handling, blikk og set. Opplastede referanser lagres privat og deles bare med prosjektet." testId="continuity-entry-log">
              {!readOnly ? <><Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
                <FormControl size="small" sx={{ minWidth: 145, ...fieldSx }}><InputLabel>Kategori</InputLabel><Select value={entryDraft.category} label="Kategori" onChange={(event) => setEntryDraft((current) => ({ ...current, category: event.target.value as ProductionContinuityEntry['category'] }))}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                <TextField size="small" label="Person / objekt" value={entryDraft.subject} onChange={(event) => setEntryDraft((current) => ({ ...current, subject: event.target.value }))} sx={{ minWidth: 180, ...fieldSx }} />
                <FormControl size="small" sx={{ minWidth: 120, ...fieldSx }}><InputLabel>Viktighet</InputLabel><Select value={entryDraft.severity} label="Viktighet" onChange={(event) => setEntryDraft((current) => ({ ...current, severity: event.target.value as ProductionContinuityEntry['severity'] }))}>{Object.entries(SEVERITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                <TextField size="small" label="Foto-/videolenke" value={entryDraft.referenceUrl} onChange={(event) => setEntryDraft((current) => ({ ...current, referenceUrl: event.target.value }))} sx={{ flex: 1, ...fieldSx }} />
              </Stack><Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} sx={{ mt: 1 }}><Button component="label" variant="outlined" startIcon={uploadingMedia ? <CircularProgress size={16} /> : <MediaIcon />} disabled={uploadingMedia}>Last opp foto/video<input data-testid="continuity-media-input" hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,video/mp4,video/quicktime,video/webm" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadMediaReference(file); event.currentTarget.value = ''; }} /></Button><Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.75rem' }}>Bilder maks 25 MB · video maks 250 MB</Typography></Stack>{pendingReferences.length > 0 ? <Stack direction="row" flexWrap="wrap" gap={.7} sx={{ mt: 1 }}>{pendingReferences.map((reference) => <Chip key={reference.id} label={reference.label || `${reference.kind}-referanse`} onDelete={() => setPendingReferences((current) => current.filter((item) => item.id !== reference.id))} />)}</Stack> : null}<TextField size="small" required fullWidth label="Hva må matche?" value={entryDraft.description} onChange={(event) => setEntryDraft((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} sx={{ mt: 1, ...fieldSx }} /><Button sx={{ mt: 1 }} startIcon={<AddIcon />} variant="outlined" disabled={!entryDraft.description.trim() || uploadingMedia} onClick={addEntry}>Legg til kontinuitet</Button></> : null}
              <Stack gap={1} sx={{ mt: 1.5 }}>{sceneEntries.map((entry) => <Box key={entry.id} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.025)', border: `1px solid ${entry.severity === 'critical' ? 'rgba(248,113,113,.42)' : entry.severity === 'warning' ? 'rgba(251,191,36,.3)' : 'rgba(148,163,184,.12)'}` }}><Stack direction="row" justifyContent="space-between"><Box sx={{ minWidth: 0, flex: 1 }}><Chip size="small" label={CATEGORY_LABELS[entry.category]} /><Typography sx={{ mt: .6, fontWeight: 700 }}>{entry.subject || 'Generelt'}</Typography><Typography>{entry.description}</Typography>{entry.references.map((reference) => <MediaReference key={reference.id} projectId={project.id} dayId={selectedDay.id} reference={reference} />)}</Box>{!readOnly ? <Button aria-label="Slett kontinuitetsnotat" color="error" onClick={() => updateOperations((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }))}><DeleteIcon fontSize="small" /></Button> : null}</Stack></Box>)}{sceneEntries.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.62)' }}>Ingen kontinuitetspunkter for scenen.</Typography> : null}</Stack>
            </SectionCard>

            <SectionCard title="Manusavvik og improvisasjon" subtitle="Registrer hva som faktisk ble fremført. Ingen endring skrives tilbake til manus automatisk." testId="continuity-deviations">
              {!readOnly ? <><Stack direction={{ xs: 'column', md: 'row' }} gap={1}><FormControl size="small" sx={{ minWidth: 190, ...fieldSx }}><InputLabel>Avvikstype</InputLabel><Select value={deviationDraft.type} label="Avvikstype" onChange={(event) => setDeviationDraft((current) => ({ ...current, type: event.target.value as ProductionContinuityDeviation['type'] }))}>{Object.entries(DEVIATION_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField size="small" label="Karakter" value={deviationDraft.character} onChange={(event) => setDeviationDraft((current) => ({ ...current, character: event.target.value }))} sx={{ minWidth: 150, ...fieldSx }} /><TextField size="small" label="Tidskode" value={deviationDraft.timecode} onChange={(event) => setDeviationDraft((current) => ({ ...current, timecode: event.target.value }))} sx={{ minWidth: 145, ...fieldSx }} /><FormControlLabel control={<Checkbox checked={deviationDraft.accepted} onChange={(event) => setDeviationDraft((current) => ({ ...current, accepted: event.target.checked }))} />} label="Godkjent av regi" /></Stack><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1, mt: 1 }}><TextField size="small" label="Original tekst" multiline minRows={2} value={deviationDraft.originalText} onChange={(event) => setDeviationDraft((current) => ({ ...current, originalText: event.target.value }))} sx={fieldSx} /><TextField size="small" label="Fremført tekst" multiline minRows={2} value={deviationDraft.performedText} onChange={(event) => setDeviationDraft((current) => ({ ...current, performedText: event.target.value }))} sx={fieldSx} /></Box><TextField size="small" fullWidth label="Notat" value={deviationDraft.note} onChange={(event) => setDeviationDraft((current) => ({ ...current, note: event.target.value }))} sx={{ mt: 1, ...fieldSx }} /><Button sx={{ mt: 1 }} startIcon={<AddIcon />} variant="outlined" onClick={addDeviation}>Registrer avvik</Button></> : null}
              <Stack gap={1} sx={{ mt: 1.5 }}>{sceneDeviations.map((item) => <Box key={item.id} sx={{ p: 1.2, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.025)', border: '1px solid rgba(148,163,184,.12)' }}><Stack direction="row" justifyContent="space-between"><Box><Typography sx={{ fontWeight: 800 }}>{DEVIATION_LABELS[item.type]}{item.character ? ` · ${item.character}` : ''}</Typography>{item.originalText ? <Typography sx={{ color: 'rgba(203,213,225,.62)', textDecoration: 'line-through' }}>{item.originalText}</Typography> : null}{item.performedText ? <Typography>{item.performedText}</Typography> : null}{item.note ? <Typography sx={{ mt: .4 }}>{item.note}</Typography> : null}<Chip size="small" sx={{ mt: .6 }} label={item.accepted ? 'Godkjent' : 'Ikke avklart'} color={item.accepted ? 'success' : 'default'} /></Box>{!readOnly ? <Button aria-label="Slett manusavvik" color="error" onClick={() => updateOperations((current) => ({ ...current, deviations: current.deviations.filter((entry) => entry.id !== item.id) }))}><DeleteIcon fontSize="small" /></Button> : null}</Stack></Box>)}{sceneDeviations.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.62)' }}>Ingen manusavvik registrert.</Typography> : null}</Stack>
            </SectionCard>
          </Stack>

          <Stack gap={2}>
            <SectionCard title="Forrige referanse" subtitle="Rask sammenligning før kamera går.">
              <Typography sx={{ color: 'rgba(203,213,225,.62)', fontSize: '.75rem' }}>FORRIGE TAKE</Typography>
              {previousTake ? <Box sx={{ mt: .6 }}><Typography sx={{ fontWeight: 800 }}>Take {previousTake.takeNumber}{previousTake.circled ? ' ⭕' : ''}</Typography><Typography>{previousTake.continuityNotes || 'Ingen kontinuitetsnotater.'}</Typography></Box> : <Typography>Ingen tidligere take i scenen.</Typography>}
              <Divider sx={{ my: 1.5, borderColor: 'rgba(148,163,184,.14)' }} />
              <Typography sx={{ color: 'rgba(203,213,225,.62)', fontSize: '.75rem' }}>FORRIGE SCENE</Typography>
              {previousSceneId ? <Box sx={{ mt: .6 }}><Typography sx={{ fontWeight: 800 }}>{sceneLabel(project, previousSceneId)}</Typography><Typography>{previousSceneRecord?.setup || previousSceneRecord?.notes || 'Ingen oppsett-notater.'}</Typography></Box> : <Typography>Dette er dagens første scene.</Typography>}
            </SectionCard>

            <SectionCard title="Dagsnotat og klipperoverlevering" subtitle="Følger rapportene, men endrer ikke manus.">
              <Stack gap={1}><TextField disabled={readOnly} label="Dagsnotat" multiline minRows={4} value={operations.dailyNotes ?? ''} onChange={(event) => updateOperations((current) => ({ ...current, dailyNotes: event.target.value }))} sx={fieldSx} /><TextField disabled={readOnly} label="Til klipp" multiline minRows={4} value={operations.editorNotes ?? ''} onChange={(event) => updateOperations((current) => ({ ...current, editorNotes: event.target.value }))} sx={fieldSx} /></Stack>
            </SectionCard>

            <SectionCard title="Kommentarer" subtitle="Regi og AD kan kommentere uten å endre take- eller kontinuitetsloggen." testId="continuity-comments">
              {canComment ? <Stack direction="row" gap={1}><TextField fullWidth size="small" label="Kommentar til valgt scene" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} sx={fieldSx} /><Button variant="outlined" disabled={saving || !commentDraft.trim() || Boolean(conflictDay)} onClick={addComment}>Send</Button></Stack> : null}
              <Stack gap={1} sx={{ mt: 1.5 }}>{sceneComments.slice().reverse().map((comment) => <Box key={comment.id} sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.025)' }}><Typography>{comment.message}</Typography><Typography sx={{ color: 'rgba(203,213,225,.55)', fontSize: '.7rem' }}>{comment.actorUserId || 'Prosjektmedlem'} · {new Date(comment.createdAt).toLocaleString('nb-NO')}</Typography></Box>)}{sceneComments.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.62)' }}>Ingen kommentarer.</Typography> : null}</Stack>
            </SectionCard>

            <SectionCard title="Versjoner" subtitle="Tidligere lagrede faglogger kan lastes inn som et nytt, angrebar utkast." testId="continuity-revisions">
              <Stack gap={1}>{operations.revisions.slice().reverse().map((revision) => <Box key={revision.id} sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,.025)' }}><Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography sx={{ fontWeight: 750 }}>Versjon {revision.version}</Typography><Typography sx={{ color: 'rgba(203,213,225,.62)', fontSize: '.75rem' }}>{revision.message} · {new Date(revision.createdAt).toLocaleString('nb-NO')}</Typography></Box>{!readOnly ? <Button size="small" startIcon={<RestoreIcon />} onClick={() => updateOperations((current) => restoreContinuitySnapshot(current, revision.snapshot))}>Gjenopprett</Button> : null}</Stack></Box>)}{operations.revisions.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.62)' }}>Versjonshistorikk opprettes etter neste lagring.</Typography> : null}</Stack>
            </SectionCard>

            <SectionCard title="Aktivitet" subtitle="Serverstyrt journal – kan ikke skrives om fra klienten.">
              <Stack gap={.8}>{operations.activity.slice(-8).reverse().map((entry) => <Box key={entry.id}><Typography sx={{ fontSize: '.82rem' }}>{entry.message}</Typography><Typography sx={{ color: 'rgba(203,213,225,.5)', fontSize: '.68rem' }}>{new Date(entry.createdAt).toLocaleString('nb-NO')}</Typography></Box>)}{operations.activity.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.62)' }}>Ingen serveraktivitet ennå.</Typography> : null}</Stack>
            </SectionCard>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default ContinuityWorkspace;
