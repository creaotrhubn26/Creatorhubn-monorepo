import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AssignmentOutlined as CallSheetIcon,
  CalendarMonthOutlined as ScheduleIcon,
  DeleteOutline as DeleteIcon,
  GroupsOutlined as CrewIcon,
  OpenInFullOutlined as FullWorkspaceIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  ProductionCoordinationDocument,
  ProductionCoordinationEscalation,
  ProductionCoordinationLogisticsItem,
  ProductionCoordinationOperations,
  ProductionCoordinationTask,
  ProductionDay,
} from '../../models/casting';
import { useBeforeUnloadIfDirty } from '../../hooks/useBeforeUnloadIfDirty';
import {
  ProductionCoordinationConflictError,
  productionCoordinationService,
} from '../../services/productionCoordinationService';
import {
  buildProductionCoordinationOperations,
  createCoordinationId,
  productionCoordinationReadiness,
  selectProductionCoordinationDay,
} from './productionCoordinationWorkspaceModel';

interface Props {
  project: CastingProject;
  readOnly?: boolean;
  dataLoading?: boolean;
  onOpenCallSheet: (productionDayId?: string) => void;
  onOpenSchedule: () => void;
  onOpenCrew: () => void;
  onOpenFullWorkspace: () => void;
  onSaved?: (day: ProductionDay) => void;
}

const panelSx = {
  bgcolor: 'rgba(9, 18, 32, .86)',
  borderColor: 'rgba(56, 189, 248, .2)',
  color: '#f8fafc',
};

const fieldSx = {
  '& .MuiInputBase-root': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,.025)' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& fieldset': { borderColor: 'rgba(125,211,252,.25)' },
};

const TASK_STATUS_LABELS = { todo: 'Ikke startet', in_progress: 'Pågår', blocked: 'Blokkert', done: 'Ferdig' } as const;
const TASK_CATEGORY_LABELS = { crew: 'Crew', supplier: 'Leverandør', transport: 'Transport', catering: 'Catering', equipment: 'Utstyr', permit: 'Tillatelse', document: 'Dokument', other: 'Annet' } as const;
const PRIORITY_LABELS = { low: 'Lav', normal: 'Normal', high: 'Høy', urgent: 'Haster' } as const;
const CREW_STATUS_LABELS = { pending: 'Ikke kontaktet', contacted: 'Kontaktet', confirmed: 'Bekreftet', problem: 'Problem' } as const;
const READINESS_LABELS = { not_started: 'Ikke startet', in_progress: 'Pågår', ready: 'Klar', blocked: 'Blokkert' } as const;
const LOGISTICS_CATEGORY_LABELS = { transport: 'Transport', catering: 'Catering', equipment: 'Utstyr', permit: 'Tillatelse', supplier: 'Leverandør', other: 'Annet' } as const;
const DOCUMENT_STATUS_LABELS = { missing: 'Mangler', requested: 'Etterspurt', received: 'Mottatt', verified: 'Kontrollert' } as const;
const DOCUMENT_CATEGORY_LABELS = { permit: 'Tillatelse', agreement: 'Avtale', insurance: 'Forsikring', safety: 'HMS', schedule: 'Plan', other: 'Annet' } as const;
const ESCALATION_SEVERITY_LABELS = { info: 'Info', warning: 'Viktig', critical: 'Kritisk' } as const;
const ESCALATION_STATUS_LABELS = { open: 'Åpen', acknowledged: 'Sett', resolved: 'Løst' } as const;

const nowIso = () => new Date().toISOString();

export function ProductionCoordinationWorkspace({
  project,
  readOnly = false,
  dataLoading = false,
  onOpenCallSheet,
  onOpenSchedule,
  onOpenCrew,
  onOpenFullWorkspace,
  onSaved,
}: Props) {
  const productionDays = useMemo(() => Array.isArray(project.productionDays) ? project.productionDays : [], [project.productionDays]);
  const activeProductionDays = useMemo(() => productionDays.filter((day) => day.status !== 'cancelled'), [productionDays]);
  const initialDay = useMemo(() => selectProductionCoordinationDay(productionDays), [productionDays]);
  const [dayId, setDayId] = useState(initialDay?.id ?? '');
  const selectedDay = productionDays.find((day) => day.id === dayId) ?? initialDay;
  const [operations, setOperations] = useState<ProductionCoordinationOperations | null>(
    selectedDay ? buildProductionCoordinationOperations(project, selectedDay) : null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [taskDraft, setTaskDraft] = useState({ title: '', category: 'crew' as ProductionCoordinationTask['category'], priority: 'normal' as ProductionCoordinationTask['priority'], assignee: '', dueAt: '' });
  const [logisticsDraft, setLogisticsDraft] = useState({ title: '', category: 'supplier' as ProductionCoordinationLogisticsItem['category'], supplier: '', contact: '', dueAt: '' });
  const [documentDraft, setDocumentDraft] = useState({ title: '', category: 'permit' as ProductionCoordinationDocument['category'], owner: '', dueAt: '' });
  const [escalationDraft, setEscalationDraft] = useState({ title: '', severity: 'warning' as ProductionCoordinationEscalation['severity'], owner: '', dueAt: '' });
  const { confirmIfDirty } = useBeforeUnloadIfDirty({
    isDirty: dirty,
    message: 'Koordinatorflaten har ulagrede endringer. Vil du forlate den?',
  });

  useEffect(() => {
    setDayId((current) => productionDays.some((day) => day.id === current)
      ? current
      : selectProductionCoordinationDay(productionDays)?.id ?? '');
  }, [productionDays]);

  useEffect(() => {
    setOperations(selectedDay ? buildProductionCoordinationOperations(project, selectedDay) : null);
    setDirty(false);
  }, [project, selectedDay]);

  useEffect(() => setFeedback(null), [project.id, selectedDay?.id]);

  const readiness = useMemo(() => operations ? productionCoordinationReadiness(operations) : null, [operations]);

  const updateOperations = (updater: (current: ProductionCoordinationOperations) => ProductionCoordinationOperations) => {
    setOperations((current) => current ? updater(current) : current);
    setDirty(true);
    setFeedback(null);
  };

  const save = async () => {
    if (!selectedDay || !operations || readOnly) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updatedDay = await productionCoordinationService.save(
        project.id,
        selectedDay.id,
        Number(selectedDay.coordinationVersion ?? 0),
        operations,
      );
      onSaved?.(updatedDay);
      setOperations(buildProductionCoordinationOperations(project, updatedDay));
      setDirty(false);
      setFeedback({ type: 'success', text: `Koordinatorflaten er lagret som versjon ${updatedDay.coordinationVersion ?? 0}.` });
    } catch (error) {
      if (error instanceof ProductionCoordinationConflictError) {
        onSaved?.(error.productionDay);
        setOperations(buildProductionCoordinationOperations(project, error.productionDay));
        setDirty(false);
        setFeedback({ type: 'warning', text: 'En annen bruker lagret først. Siste serverversjon er lastet inn; kontroller endringene før du prøver igjen.' });
      } else {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke lagre koordinatorflaten.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!selectedDay) return;
    setOperations(buildProductionCoordinationOperations(project, selectedDay));
    setDirty(false);
    setFeedback(null);
  };

  const addTask = () => {
    const title = taskDraft.title.trim();
    if (!title) return;
    const task: ProductionCoordinationTask = {
      id: createCoordinationId('task'),
      title,
      category: taskDraft.category,
      priority: taskDraft.priority,
      status: 'todo',
      dueAt: taskDraft.dueAt || undefined,
      assignee: taskDraft.assignee.trim() || undefined,
      updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setTaskDraft({ title: '', category: 'crew', priority: 'normal', assignee: '', dueAt: '' });
  };

  const addLogistics = () => {
    const title = logisticsDraft.title.trim();
    if (!title) return;
    const item: ProductionCoordinationLogisticsItem = {
      id: createCoordinationId('logistics'),
      title,
      category: logisticsDraft.category,
      status: 'not_started',
      supplier: logisticsDraft.supplier.trim() || undefined,
      contact: logisticsDraft.contact.trim() || undefined,
      dueAt: logisticsDraft.dueAt || undefined,
      updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, logistics: [...current.logistics, item] }));
    setLogisticsDraft({ title: '', category: 'supplier', supplier: '', contact: '', dueAt: '' });
  };

  const addDocument = () => {
    const title = documentDraft.title.trim();
    if (!title) return;
    const item: ProductionCoordinationDocument = {
      id: createCoordinationId('document'),
      title,
      category: documentDraft.category,
      status: 'missing',
      owner: documentDraft.owner.trim() || undefined,
      dueAt: documentDraft.dueAt || undefined,
      updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, documents: [...current.documents, item] }));
    setDocumentDraft({ title: '', category: 'permit', owner: '', dueAt: '' });
  };

  const addEscalation = () => {
    const title = escalationDraft.title.trim();
    if (!title) return;
    const item: ProductionCoordinationEscalation = {
      id: createCoordinationId('escalation'),
      title,
      severity: escalationDraft.severity,
      status: 'open',
      owner: escalationDraft.owner.trim() || undefined,
      dueAt: escalationDraft.dueAt || undefined,
      updatedAt: nowIso(),
    };
    updateOperations((current) => ({ ...current, escalations: [...current.escalations, item] }));
    setEscalationDraft({ title: '', severity: 'warning', owner: '', dueAt: '' });
  };

  return (
    <Box component="section" data-testid="production-coordination-workspace" sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#06101b', color: '#f8fafc', p: { xs: 1.5, md: 3 } }}>
      <Box sx={{ maxWidth: 1540, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Chip label="PRODUKSJONSKOORDINERING · DAGSFLYT" size="small" sx={{ color: '#bae6fd', bgcolor: 'rgba(14,165,233,.12)', border: '1px solid rgba(56,189,248,.32)', fontWeight: 800 }} />
            <Typography component="h1" sx={{ mt: 1, fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800 }}>{project.name}</Typography>
            <Typography sx={{ color: 'rgba(203,213,225,.72)' }}>Oppfølging, logistikk og overlevering – uten tilgang til kostnader eller godkjenninger.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ lg: 'center' }}>
            <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={() => { if (confirmIfDirty()) onOpenSchedule(); }} sx={{ color: '#e0f2fe', borderColor: 'rgba(56,189,248,.35)' }}>Opptaksplan</Button>
            <Button variant="outlined" startIcon={<CrewIcon />} onClick={() => { if (confirmIfDirty()) onOpenCrew(); }} sx={{ color: '#e0f2fe', borderColor: 'rgba(56,189,248,.35)' }}>Team</Button>
            <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={() => { if (confirmIfDirty()) onOpenFullWorkspace(); }} sx={{ color: '#e0f2fe', borderColor: 'rgba(56,189,248,.35)' }}>Hele prosjektet</Button>
          </Stack>
        </Stack>

        {dataLoading && productionDays.length === 0 ? <Alert severity="info">Henter produksjonsdager…</Alert> : productionDays.length === 0 ? (
          <Alert severity="info">Ingen produksjonsdag er registrert. Opprett dagen i opptaksplanen først.</Alert>
        ) : activeProductionDays.length === 0 ? (
          <Alert severity="info">Alle registrerte produksjonsdager er avlyst.</Alert>
        ) : operations && selectedDay ? (
          <>
            <Card variant="outlined" sx={{ ...panelSx, p: 2, mb: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 235, ...fieldSx }}>
                  <InputLabel id="pc-day-label">Produksjonsdag</InputLabel>
                  <Select labelId="pc-day-label" label="Produksjonsdag" value={selectedDay.id} disabled={dirty} onChange={(event) => setDayId(String(event.target.value))}>
                    {activeProductionDays.map((day) => <MenuItem key={day.id} value={day.id}>{day.date || 'Udatert dag'} · {day.callTime || 'call ikke satt'}</MenuItem>)}
                  </Select>
                </FormControl>
                <Typography sx={{ color: 'rgba(203,213,225,.68)', fontSize: '.8rem' }}>
                  {selectedDay.scenes.length} scener · {selectedDay.callTime || '—'}–{selectedDay.wrapTime || '—'} · versjon {selectedDay.coordinationVersion ?? 0}
                </Typography>
                <Stack direction="row" gap={1} sx={{ ml: { md: 'auto' } }}>
                  {dirty ? <Button color="inherit" disabled={saving} onClick={discard}>Forkast</Button> : null}
                  <Button variant="contained" startIcon={<SaveIcon />} disabled={readOnly || saving || !dirty} onClick={() => void save()} sx={{ bgcolor: '#0369a1', '&:hover': { bgcolor: '#075985' } }}>
                    {saving ? 'Lagrer…' : 'Lagre koordinering'}
                  </Button>
                </Stack>
              </Stack>
              {dirty ? <Typography sx={{ mt: 1, color: '#fde68a', fontSize: '.75rem' }}>Ulagrede endringer. Lagre eller forkast før du bytter dag.</Typography> : null}
            </Card>

            {feedback ? <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert> : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, 1fr)' }, gap: 1.25, mb: 2 }}>
              {[
                ['Åpne oppgaver', String(readiness?.openTasks ?? 0)],
                ['Crew bekreftet', `${readiness?.crewConfirmed ?? 0}/${readiness?.crewTotal ?? 0}`],
                ['Logistikk klar', `${readiness?.logisticsReady ?? 0}/${readiness?.logisticsTotal ?? 0}`],
                ['Dokumenter mangler', String(readiness?.missingDocuments ?? 0)],
                ['Blokkeringer', String(readiness?.blockers ?? 0)],
              ].map(([label, value]) => (
                <Card key={label} variant="outlined" sx={{ ...panelSx, p: 1.5 }}>
                  <Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.76rem' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '1.45rem', fontWeight: 850, color: label === 'Blokkeringer' && value !== '0' ? '#fca5a5' : '#7dd3fc' }}>{value}</Typography>
                </Card>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
              <Stack spacing={2}>
                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Oppgaver og frister</Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem', mb: 1.5 }}>Produksjonsleder og koordinator kan bruke samme operative oppgaveliste.</Typography>
                  <Stack spacing={1}>
                    {operations.tasks.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.82rem' }}>Ingen oppgaver er registrert.</Typography> : operations.tasks.map((task) => (
                      <Box key={task.id} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${task.status === 'blocked' ? 'rgba(248,113,113,.5)' : 'rgba(148,163,184,.14)'}` }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                          <Chip size="small" label={PRIORITY_LABELS[task.priority]} sx={{ color: task.priority === 'urgent' ? '#fecaca' : '#bae6fd' }} />
                          <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{task.title}</Typography><Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.72rem' }}>{TASK_CATEGORY_LABELS[task.category]}{task.assignee ? ` · ansvarlig ${task.assignee}` : ''}{task.dueAt ? ` · frist ${new Date(task.dueAt).toLocaleString('nb-NO')}` : ''}</Typography></Box>
                          <FormControl size="small" sx={{ minWidth: 135, ...fieldSx }}><Select aria-label={`Status for ${task.title}`} value={task.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status: event.target.value as typeof item.status, updatedAt: nowIso() } : item) }))}>{Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                          <Button aria-label={`Fjern ${task.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }))} sx={{ minWidth: 38, color: '#fca5a5' }}><DeleteIcon /></Button>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 1fr 1fr', lg: '2fr 1fr 1fr 1.2fr 1.3fr auto' }, gap: 1, mt: 1.5 }}>
                    <TextField size="small" label="Ny oppgave" value={taskDraft.title} disabled={readOnly} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} sx={{ ...fieldSx, gridColumn: { xs: '1 / -1', sm: 'auto' } }} />
                    <FormControl size="small" sx={fieldSx}><InputLabel id="pc-task-category">Kategori</InputLabel><Select labelId="pc-task-category" label="Kategori" value={taskDraft.category} disabled={readOnly} onChange={(event) => setTaskDraft((current) => ({ ...current, category: event.target.value as typeof current.category }))}>{Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <FormControl size="small" sx={fieldSx}><InputLabel id="pc-task-priority">Prioritet</InputLabel><Select labelId="pc-task-priority" label="Prioritet" value={taskDraft.priority} disabled={readOnly} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <TextField size="small" label="Ansvarlig" value={taskDraft.assignee} disabled={readOnly} onChange={(event) => setTaskDraft((current) => ({ ...current, assignee: event.target.value }))} sx={fieldSx} />
                    <TextField size="small" type="datetime-local" label="Frist" value={taskDraft.dueAt} disabled={readOnly} onChange={(event) => setTaskDraft((current) => ({ ...current, dueAt: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
                    <Button aria-label="Legg til oppgave" variant="outlined" disabled={readOnly || !taskDraft.title.trim()} onClick={addTask} sx={{ color: '#bae6fd', borderColor: 'rgba(56,189,248,.35)', minWidth: 44 }}><AddIcon /></Button>
                  </Box>
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Crew-oppfølging</Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem', mb: 1.5 }}>Kun crew som er tildelt denne produksjonsdagen vises.</Typography>
                  {operations.crewFollowUps.length === 0 ? <Alert severity="info">Ingen crew er tildelt dagen.</Alert> : (
                    <Stack divider={<Divider flexItem sx={{ borderColor: 'rgba(148,163,184,.12)' }} />}>
                      {operations.crewFollowUps.map((followUp) => {
                        const crew = (project.crew ?? []).find((member) => member.id === followUp.crewId);
                        return <Stack key={followUp.crewId} direction="row" alignItems="center" gap={1.5} sx={{ py: 1 }}><Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{crew?.name || followUp.crewId}</Typography><Typography sx={{ color: 'rgba(203,213,225,.62)', fontSize: '.75rem' }}>{crew?.role || 'Crew'}</Typography></Box><FormControl size="small" sx={{ minWidth: 150, ...fieldSx }}><Select aria-label={`Oppfølging for ${crew?.name || followUp.crewId}`} value={followUp.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, crewFollowUps: current.crewFollowUps.map((item) => item.crewId === followUp.crewId ? { ...item, status: event.target.value as typeof item.status, updatedAt: nowIso() } : item) }))}>{Object.entries(CREW_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl></Stack>;
                      })}
                    </Stack>
                  )}
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Logistikk og leverandører</Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {operations.logistics.map((item) => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}><Chip size="small" label={LOGISTICS_CATEGORY_LABELS[item.category]} sx={{ color: '#bae6fd', bgcolor: 'rgba(14,165,233,.1)', width: 105 }} /><Box sx={{ flex: 1 }}><Typography sx={{ fontSize: '.88rem' }}>{item.title}</Typography>{item.supplier || item.contact || item.dueAt ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.72rem' }}>{item.supplier || 'Leverandør ikke satt'}{item.contact ? ` · ${item.contact}` : ''}{item.dueAt ? ` · frist ${new Date(item.dueAt).toLocaleString('nb-NO')}` : ''}</Typography> : null}</Box><FormControl size="small" sx={{ minWidth: 135, ...fieldSx }}><Select aria-label={`Status for ${item.title}`} value={item.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, logistics: current.logistics.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: nowIso() } : entry) }))}>{Object.entries(READINESS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><Button aria-label={`Fjern ${item.title}`} disabled={readOnly || item.id.startsWith('default:')} onClick={() => updateOperations((current) => ({ ...current, logistics: current.logistics.filter((entry) => entry.id !== item.id) }))} sx={{ minWidth: 38, color: '#fca5a5' }}><DeleteIcon /></Button></Stack>)}
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr', lg: '2fr 1fr 1.2fr 1.4fr 1.4fr auto' }, gap: 1, mt: 1.5 }}><TextField size="small" label="Nytt logistikkpunkt" value={logisticsDraft.title} disabled={readOnly} onChange={(event) => setLogisticsDraft((current) => ({ ...current, title: event.target.value }))} sx={fieldSx} /><FormControl size="small" sx={fieldSx}><InputLabel id="pc-logistics-category">Kategori</InputLabel><Select labelId="pc-logistics-category" label="Kategori" value={logisticsDraft.category} disabled={readOnly} onChange={(event) => setLogisticsDraft((current) => ({ ...current, category: event.target.value as typeof current.category }))}>{Object.entries(LOGISTICS_CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField size="small" label="Leverandør" value={logisticsDraft.supplier} disabled={readOnly} onChange={(event) => setLogisticsDraft((current) => ({ ...current, supplier: event.target.value }))} sx={fieldSx} /><TextField size="small" label="Kontakt" value={logisticsDraft.contact} disabled={readOnly} onChange={(event) => setLogisticsDraft((current) => ({ ...current, contact: event.target.value }))} sx={fieldSx} /><TextField size="small" type="datetime-local" label="Frist" value={logisticsDraft.dueAt} disabled={readOnly} onChange={(event) => setLogisticsDraft((current) => ({ ...current, dueAt: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} /><Button variant="outlined" aria-label="Legg til logistikkpunkt" disabled={readOnly || !logisticsDraft.title.trim()} onClick={addLogistics} sx={{ color: '#bae6fd', borderColor: 'rgba(56,189,248,.35)', minWidth: 44 }}><AddIcon /></Button></Box>
                </Card>
              </Stack>

              <Stack spacing={2}>
                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}><Box><Typography component="h2" sx={{ fontWeight: 800 }}>Callsheet-sjekk</Typography><Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem' }}>Koordinatoren gjør klar grunnlaget. Godkjenning ligger fortsatt hos produksjonsledelsen.</Typography></Box><Button variant="outlined" startIcon={<CallSheetIcon />} onClick={() => onOpenCallSheet(selectedDay.id)} sx={{ color: '#e0f2fe', borderColor: 'rgba(56,189,248,.35)', flexShrink: 0 }}>Åpne</Button></Stack>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>{operations.callSheetChecklist.map((item) => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}><Typography sx={{ flex: 1, fontSize: '.88rem' }}>{item.title}</Typography><FormControl size="small" sx={{ minWidth: 135, ...fieldSx }}><Select aria-label={`Status for ${item.title}`} value={item.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, callSheetChecklist: current.callSheetChecklist.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: nowIso() } : entry) }))}>{Object.entries(READINESS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl></Stack>)}</Stack>
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Dokumentberedskap</Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {operations.documents.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.82rem' }}>Ingen dokumentkrav er registrert.</Typography> : operations.documents.map((item) => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}><Chip size="small" label={DOCUMENT_CATEGORY_LABELS[item.category]} sx={{ color: '#bae6fd' }} /><Box sx={{ flex: 1 }}><Typography sx={{ fontSize: '.88rem' }}>{item.title}</Typography>{item.owner || item.dueAt ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.72rem' }}>{item.owner ? `ansvarlig ${item.owner}` : 'ansvarlig ikke satt'}{item.dueAt ? ` · frist ${new Date(item.dueAt).toLocaleString('nb-NO')}` : ''}</Typography> : null}</Box><FormControl size="small" sx={{ minWidth: 130, ...fieldSx }}><Select aria-label={`Dokumentstatus for ${item.title}`} value={item.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, documents: current.documents.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: nowIso() } : entry) }))}>{Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><Button aria-label={`Fjern ${item.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, documents: current.documents.filter((entry) => entry.id !== item.id) }))} sx={{ minWidth: 38, color: '#fca5a5' }}><DeleteIcon /></Button></Stack>)}
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr', lg: '2fr 1fr 1.2fr 1.4fr auto' }, gap: 1, mt: 1.5 }}><TextField size="small" label="Nytt dokumentkrav" value={documentDraft.title} disabled={readOnly} onChange={(event) => setDocumentDraft((current) => ({ ...current, title: event.target.value }))} sx={fieldSx} /><FormControl size="small" sx={fieldSx}><InputLabel id="pc-document-category">Kategori</InputLabel><Select labelId="pc-document-category" label="Kategori" value={documentDraft.category} disabled={readOnly} onChange={(event) => setDocumentDraft((current) => ({ ...current, category: event.target.value as typeof current.category }))}>{Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField size="small" label="Ansvarlig" value={documentDraft.owner} disabled={readOnly} onChange={(event) => setDocumentDraft((current) => ({ ...current, owner: event.target.value }))} sx={fieldSx} /><TextField size="small" type="datetime-local" label="Frist" value={documentDraft.dueAt} disabled={readOnly} onChange={(event) => setDocumentDraft((current) => ({ ...current, dueAt: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} /><Button variant="outlined" aria-label="Legg til dokumentkrav" disabled={readOnly || !documentDraft.title.trim()} onClick={addDocument} sx={{ color: '#bae6fd', borderColor: 'rgba(56,189,248,.35)', minWidth: 44 }}><AddIcon /></Button></Box>
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Varsler og eskalering</Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {operations.escalations.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.82rem' }}>Ingen åpne eskaleringer.</Typography> : operations.escalations.map((item) => <Box key={item.id} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${item.severity === 'critical' ? 'rgba(248,113,113,.5)' : 'rgba(148,163,184,.14)'}` }}><Stack direction="row" gap={1} alignItems="center"><Chip size="small" label={ESCALATION_SEVERITY_LABELS[item.severity]} sx={{ color: item.severity === 'critical' ? '#fecaca' : '#fde68a' }} /><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>{item.owner || item.dueAt ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.72rem' }}>{item.owner ? `eier ${item.owner}` : 'eier ikke satt'}{item.dueAt ? ` · frist ${new Date(item.dueAt).toLocaleString('nb-NO')}` : ''}</Typography> : null}</Box><Button aria-label={`Fjern ${item.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, escalations: current.escalations.filter((entry) => entry.id !== item.id) }))} sx={{ minWidth: 38, color: '#fca5a5' }}><DeleteIcon /></Button></Stack><FormControl fullWidth size="small" sx={{ mt: 1, ...fieldSx }}><InputLabel id={`pc-escalation-${item.id}`}>Status</InputLabel><Select labelId={`pc-escalation-${item.id}`} label="Status" value={item.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, escalations: current.escalations.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: nowIso() } : entry) }))}>{Object.entries(ESCALATION_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl></Box>)}
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr', lg: '2fr 1fr 1.2fr 1.4fr auto' }, gap: 1, mt: 1.5 }}><TextField size="small" label="Nytt varsel" value={escalationDraft.title} disabled={readOnly} onChange={(event) => setEscalationDraft((current) => ({ ...current, title: event.target.value }))} sx={fieldSx} /><FormControl size="small" sx={fieldSx}><InputLabel id="pc-escalation-severity">Nivå</InputLabel><Select labelId="pc-escalation-severity" label="Nivå" value={escalationDraft.severity} disabled={readOnly} onChange={(event) => setEscalationDraft((current) => ({ ...current, severity: event.target.value as typeof current.severity }))}>{Object.entries(ESCALATION_SEVERITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl><TextField size="small" label="Eier" value={escalationDraft.owner} disabled={readOnly} onChange={(event) => setEscalationDraft((current) => ({ ...current, owner: event.target.value }))} sx={fieldSx} /><TextField size="small" type="datetime-local" label="Frist" value={escalationDraft.dueAt} disabled={readOnly} onChange={(event) => setEscalationDraft((current) => ({ ...current, dueAt: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} /><Button variant="outlined" aria-label="Registrer varsel" disabled={readOnly || !escalationDraft.title.trim()} onClick={addEscalation} sx={{ color: '#bae6fd', borderColor: 'rgba(56,189,248,.35)', minWidth: 44 }}><AddIcon /></Button></Box>
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Daglig overlevering til produksjonsleder</Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}><TextField fullWidth multiline minRows={2} label="Kort status" value={operations.handover.summary ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, handover: { ...current.handover, summary: event.target.value, updatedAt: nowIso() } }))} sx={fieldSx} /><TextField fullWidth multiline minRows={2} label="Blokkeringer og beslutninger som trengs" value={operations.handover.blockers ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, handover: { ...current.handover, blockers: event.target.value, updatedAt: nowIso() } }))} sx={fieldSx} /><TextField fullWidth multiline minRows={2} label="Neste handlinger" value={operations.handover.nextActions ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, handover: { ...current.handover, nextActions: event.target.value, updatedAt: nowIso() } }))} sx={fieldSx} /><FormControl size="small" sx={{ maxWidth: 240, ...fieldSx }}><InputLabel id="pc-handover-status">Overleveringsstatus</InputLabel><Select labelId="pc-handover-status" label="Overleveringsstatus" value={operations.handover.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, handover: { ...current.handover, status: event.target.value as typeof current.handover.status, updatedAt: nowIso() } }))}><MenuItem value="draft">Utkast</MenuItem><MenuItem value="ready_for_review">Klar for gjennomgang</MenuItem></Select></FormControl></Stack>
                  <Divider sx={{ my: 1.5, borderColor: 'rgba(148,163,184,.14)' }} />
                  <Stack spacing={.75} data-testid="production-coordination-activity">{operations.activity.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.78rem' }}>Aktivitetsloggen starter ved første lagring.</Typography> : [...operations.activity].reverse().map((entry) => <Box key={entry.id}><Typography sx={{ fontSize: '.8rem' }}>{entry.message}</Typography><Typography sx={{ color: 'rgba(203,213,225,.55)', fontSize: '.7rem' }}>{new Date(entry.createdAt).toLocaleString('nb-NO')} · {entry.actorUserId || 'Prosjektmedlem'}</Typography></Box>)}</Stack>
                </Card>
              </Stack>
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
