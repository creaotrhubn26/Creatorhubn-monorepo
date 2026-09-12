import { useCallback, useEffect, useMemo, useState } from 'react';
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
  RefreshOutlined as RefreshIcon,
  SaveOutlined as SaveIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  ProductionDay,
  ProductionManagementCheckpoint,
  ProductionManagementCostItem,
  ProductionManagementIssue,
  ProductionManagementOperations,
} from '../../models/casting';
import { roleRoomAgentDefaultHeaders } from '../../services/roleRoomAgentService';
import { useBeforeUnloadIfDirty } from '../../hooks/useBeforeUnloadIfDirty';
import {
  ProductionManagementConflictError,
  productionManagementService,
} from '../../services/productionManagementService';
import {
  buildProductionManagementOperations,
  createManagementId,
  productionManagementCosts,
  productionManagementReadiness,
  selectProductionManagementDay,
  type ProductionManagementDeliverySummary,
} from './productionManagementWorkspaceModel';

interface Props {
  project: CastingProject;
  readOnly?: boolean;
  dataLoading?: boolean;
  deliveryRefreshSignal?: number;
  onOpenCallSheet: (productionDayId?: string) => void;
  onOpenSchedule: () => void;
  onOpenCrew: () => void;
  onOpenFullWorkspace: () => void;
  onSaved?: (day: ProductionDay) => void;
}

const panelSx = {
  bgcolor: 'rgba(9, 18, 32, .82)',
  borderColor: 'rgba(45, 212, 191, .18)',
  color: '#f8fafc',
};

const fieldSx = {
  '& .MuiInputBase-root': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,.025)' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,.68)' },
  '& fieldset': { borderColor: 'rgba(94,234,212,.25)' },
};

const DAY_STATUS_LABELS = {
  not_started: 'Ikke kontrollert',
  ready: 'Klar for opptak',
  at_risk: 'Krever oppfølging',
  completed: 'Dagen avsluttet',
} as const;

const CALL_SHEET_LABELS = {
  not_ready: 'Ikke klar',
  ready_for_review: 'Klar for kontroll',
  approved: 'Godkjent',
} as const;

const CHECKPOINT_LABELS = {
  not_started: 'Ikke startet',
  in_progress: 'Pågår',
  ready: 'Klar',
  blocked: 'Blokkert',
} as const;

const CATEGORY_LABELS = {
  location: 'Lokasjon',
  transport: 'Transport',
  catering: 'Catering',
  equipment: 'Utstyr',
  permit: 'Tillatelse',
} as const;

const ISSUE_SEVERITY_LABELS = {
  low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk',
} as const;

const ISSUE_STATUS_LABELS = {
  open: 'Åpen', in_progress: 'Følges opp', resolved: 'Løst',
} as const;

const COST_STATUS_LABELS = {
  draft: 'Utkast', pending: 'Til godkjenning', approved: 'Godkjent', rejected: 'Avvist',
} as const;

const CREW_STATUS_LABELS = {
  pending: 'Venter', confirmed: 'Bekreftet', declined: 'Kan ikke',
} as const;

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency', currency: currency || 'NOK', maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency', currency: 'NOK', maximumFractionDigits: 0,
    }).format(value);
  }
}

export function ProductionManagementWorkspace({
  project,
  readOnly = false,
  dataLoading = false,
  deliveryRefreshSignal = 0,
  onOpenCallSheet,
  onOpenSchedule,
  onOpenCrew,
  onOpenFullWorkspace,
  onSaved,
}: Props) {
  const productionDays = useMemo(
    () => Array.isArray(project.productionDays) ? project.productionDays : [],
    [project.productionDays],
  );
  const activeProductionDays = useMemo(
    () => productionDays.filter((day) => day.status !== 'cancelled'),
    [productionDays],
  );
  const initialDay = useMemo(() => selectProductionManagementDay(productionDays), [productionDays]);
  const [dayId, setDayId] = useState(initialDay?.id ?? '');
  const selectedDay = productionDays.find((day) => day.id === dayId) ?? initialDay;
  const [operations, setOperations] = useState<ProductionManagementOperations | null>(
    selectedDay ? buildProductionManagementOperations(project, selectedDay) : null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [deliveries, setDeliveries] = useState<ProductionManagementDeliverySummary[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState(false);
  const [checkpointDraft, setCheckpointDraft] = useState({ title: '', category: 'transport' as ProductionManagementCheckpoint['category'] });
  const [issueDraft, setIssueDraft] = useState({ title: '', severity: 'medium' as ProductionManagementIssue['severity'] });
  const [costDraft, setCostDraft] = useState({ title: '', category: 'Annet', estimatedCost: '', actualCost: '' });
  const { confirmIfDirty } = useBeforeUnloadIfDirty({
    isDirty: dirty,
    message: 'Dagskontrollen har ulagrede endringer. Vil du forlate den?',
  });

  useEffect(() => {
    setDayId((current) => productionDays.some((day) => day.id === current)
      ? current
      : selectProductionManagementDay(productionDays)?.id ?? '');
  }, [productionDays]);

  useEffect(() => {
    setOperations(selectedDay ? buildProductionManagementOperations(project, selectedDay) : null);
    setDirty(false);
  }, [project, selectedDay]);

  useEffect(() => {
    setFeedback(null);
  }, [project.id, selectedDay?.id]);

  const loadDeliveries = useCallback(async () => {
    if (!selectedDay?.id) return;
    setDeliveriesLoading(true);
    setDeliveriesError(false);
    try {
      const response = await fetch(
        `/api/role-room/projects/${encodeURIComponent(project.id)}/call-sheet-deliveries?productionDayId=${encodeURIComponent(selectedDay.id)}`,
        { credentials: 'include', headers: roleRoomAgentDefaultHeaders() },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { deliveries?: ProductionManagementDeliverySummary[] };
      setDeliveries(Array.isArray(payload.deliveries) ? payload.deliveries : []);
    } catch {
      setDeliveries([]);
      setDeliveriesError(true);
    } finally {
      setDeliveriesLoading(false);
    }
  }, [project.id, selectedDay?.id]);

  useEffect(() => { void loadDeliveries(); }, [deliveryRefreshSignal, loadDeliveries]);

  const latestDelivery = deliveries.find((delivery) => delivery.status === 'published')
    ?? deliveries.find((delivery) => !delivery.status);
  const readiness = useMemo(
    () => operations ? productionManagementReadiness(operations) : null,
    [operations],
  );
  const costs = useMemo(
    () => productionManagementCosts(operations?.costItems ?? []),
    [operations?.costItems],
  );
  const currency = project.currency || 'NOK';

  const updateOperations = (updater: (current: ProductionManagementOperations) => ProductionManagementOperations) => {
    setOperations((current) => current ? updater(current) : current);
    setDirty(true);
    setFeedback(null);
  };

  const save = async () => {
    if (!selectedDay || !operations || readOnly) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updatedDay = await productionManagementService.save(
        project.id,
        selectedDay.id,
        Number(selectedDay.managementVersion ?? 0),
        operations,
      );
      onSaved?.(updatedDay);
      setOperations(buildProductionManagementOperations(project, updatedDay));
      setDirty(false);
      setFeedback({ type: 'success', text: `Dagskontrollen er lagret som versjon ${updatedDay.managementVersion ?? 0}.` });
    } catch (error) {
      if (error instanceof ProductionManagementConflictError) {
        onSaved?.(error.productionDay);
        setOperations(buildProductionManagementOperations(project, error.productionDay));
        setDirty(false);
        setFeedback({ type: 'warning', text: 'En annen bruker lagret først. Siste serverversjon er lastet inn; kontroller endringene før du prøver igjen.' });
      } else {
        setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke lagre dagskontrollen.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!selectedDay) return;
    setOperations(buildProductionManagementOperations(project, selectedDay));
    setDirty(false);
    setFeedback(null);
  };

  const addCheckpoint = () => {
    const title = checkpointDraft.title.trim();
    if (!title) return;
    const entry: ProductionManagementCheckpoint = {
      id: createManagementId('checkpoint'), category: checkpointDraft.category, title,
      status: 'not_started', updatedAt: new Date().toISOString(),
    };
    updateOperations((current) => ({ ...current, checkpoints: [...current.checkpoints, entry] }));
    setCheckpointDraft((current) => ({ ...current, title: '' }));
  };

  const addIssue = () => {
    const title = issueDraft.title.trim();
    if (!title) return;
    const entry: ProductionManagementIssue = {
      id: createManagementId('issue'), title, severity: issueDraft.severity,
      status: 'open', updatedAt: new Date().toISOString(),
    };
    updateOperations((current) => ({ ...current, issues: [...current.issues, entry] }));
    setIssueDraft((current) => ({ ...current, title: '' }));
  };

  const addCost = () => {
    const title = costDraft.title.trim();
    const estimatedCost = Number(costDraft.estimatedCost || 0);
    const actualCost = Number(costDraft.actualCost || 0);
    if (!title || !Number.isFinite(estimatedCost) || !Number.isFinite(actualCost) || estimatedCost < 0 || actualCost < 0) return;
    const entry: ProductionManagementCostItem = {
      id: createManagementId('cost'), title, category: costDraft.category.trim() || 'Annet',
      estimatedCost, actualCost, status: 'draft', updatedAt: new Date().toISOString(),
    };
    updateOperations((current) => ({ ...current, costItems: [...current.costItems, entry] }));
    setCostDraft({ title: '', category: 'Annet', estimatedCost: '', actualCost: '' });
  };

  return (
    <Box component="section" data-testid="production-management-workspace" sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#06121a', color: '#f8fafc', p: { xs: 1.5, md: 3 } }}>
      <Box sx={{ maxWidth: 1540, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Chip label="PRODUKSJONSLEDELSE · DAGSKONTROLL" size="small" sx={{ color: '#99f6e4', bgcolor: 'rgba(20,184,166,.12)', border: '1px solid rgba(45,212,191,.3)', fontWeight: 800 }} />
            <Typography component="h1" sx={{ mt: 1, fontSize: { xs: '1.5rem', md: '2rem' }, fontWeight: 800 }}>{project.name}</Typography>
            <Typography sx={{ color: 'rgba(203,213,225,.72)' }}>Beslutninger, beredskap og kostnadsavvik for én produksjonsdag.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ lg: 'center' }}>
            <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={() => { if (confirmIfDirty()) onOpenSchedule(); }} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.35)' }}>Opptaksplan</Button>
            <Button variant="outlined" startIcon={<CrewIcon />} onClick={() => { if (confirmIfDirty()) onOpenCrew(); }} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.35)' }}>Team</Button>
            <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={() => { if (confirmIfDirty()) onOpenFullWorkspace(); }} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.35)' }}>Hele prosjektet</Button>
          </Stack>
        </Stack>

        {dataLoading && productionDays.length === 0 ? <Alert severity="info">Henter produksjonsdager…</Alert> : productionDays.length === 0 ? (
          <Alert severity="info">Ingen produksjonsdag er registrert. Opprett dagen i opptaksplanen før dagskontrollen starter.</Alert>
        ) : activeProductionDays.length === 0 ? (
          <Alert severity="info">Alle registrerte produksjonsdager er avlyst. Velg opptaksplanen for å opprette eller aktivere en dag.</Alert>
        ) : operations && selectedDay ? (
          <>
            <Card variant="outlined" sx={{ ...panelSx, p: 2, mb: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 235, ...fieldSx }}>
                  <InputLabel id="pm-day-label">Produksjonsdag</InputLabel>
                  <Select labelId="pm-day-label" label="Produksjonsdag" value={selectedDay.id} disabled={dirty} onChange={(event) => setDayId(String(event.target.value))}>
                    {activeProductionDays.map((day) => (
                      <MenuItem key={day.id} value={day.id}>{day.date || 'Udatert dag'} · {day.callTime || 'call ikke satt'}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 205, ...fieldSx }}>
                  <InputLabel id="pm-day-status-label">Dagsstatus</InputLabel>
                  <Select labelId="pm-day-status-label" label="Dagsstatus" value={operations.dayStatus} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, dayStatus: event.target.value as ProductionManagementOperations['dayStatus'] }))}>
                    {Object.entries(DAY_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </Select>
                </FormControl>
                <Typography sx={{ color: 'rgba(203,213,225,.68)', fontSize: '.8rem' }}>
                  {selectedDay.scenes.length} scener · {selectedDay.callTime || '—'}–{selectedDay.wrapTime || '—'} · versjon {selectedDay.managementVersion ?? 0}
                </Typography>
                <Stack direction="row" gap={1} sx={{ ml: { md: 'auto' } }}>
                  {dirty ? <Button color="inherit" disabled={saving} onClick={discard}>Forkast</Button> : null}
                  <Button variant="contained" startIcon={<SaveIcon />} disabled={readOnly || saving || !dirty} onClick={() => void save()} sx={{ bgcolor: '#0f766e', '&:hover': { bgcolor: '#115e59' } }}>
                    {saving ? 'Lagrer…' : 'Lagre dagskontroll'}
                  </Button>
                </Stack>
              </Stack>
              {dirty ? <Typography sx={{ mt: 1, color: '#fde68a', fontSize: '.75rem' }}>Ulagrede endringer. Lagre eller forkast før du bytter dag.</Typography> : null}
            </Card>

            {feedback ? <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert> : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
              {[
                ['Crew bekreftet', `${readiness?.crewConfirmed ?? 0}/${readiness?.crewTotal ?? 0}`],
                ['Logistikk klar', `${readiness?.logisticsReady ?? 0}/${readiness?.logisticsTotal ?? 0}`],
                ['Åpne avvik', String(readiness?.openIssues ?? 0)],
                ['Blokkeringer', String(readiness?.blockers ?? 0)],
              ].map(([label, value]) => (
                <Card key={label} variant="outlined" sx={{ ...panelSx, p: 1.5 }}>
                  <Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.76rem' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '1.55rem', fontWeight: 850, color: label === 'Blokkeringer' && value !== '0' ? '#fca5a5' : '#99f6e4' }}>{value}</Typography>
                </Card>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
              <Stack spacing={2}>
                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box>
                      <Typography component="h2" sx={{ fontWeight: 800 }}>Callsheet og godkjenning</Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem' }}>
                        {latestDelivery
                          ? `Publisert revisjon ${latestDelivery.revision} · ${latestDelivery.sent}/${latestDelivery.total} sendt · ${latestDelivery.acknowledged}/${latestDelivery.total} bekreftet`
                          : deliveriesLoading
                            ? 'Henter utsendingsstatus…'
                            : deliveriesError
                              ? 'Utsendingsstatus kunne ikke hentes. Dette betyr ikke at callsheet mangler.'
                              : 'Ingen publisert callsheet for dagen.'}
                      </Typography>
                    </Box>
                    <Button aria-label="Oppdater callsheet-status" size="small" onClick={() => void loadDeliveries()} disabled={deliveriesLoading} sx={{ color: '#99f6e4', minWidth: 40 }}><RefreshIcon /></Button>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 1.5 }}>
                    <FormControl fullWidth size="small" sx={fieldSx}>
                      <InputLabel id="pm-call-sheet-status-label">Intern godkjenning</InputLabel>
                      <Select labelId="pm-call-sheet-status-label" label="Intern godkjenning" value={operations.callSheetApproval} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, callSheetApproval: event.target.value as ProductionManagementOperations['callSheetApproval'] }))}>
                        {Object.entries(CALL_SHEET_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button variant="outlined" startIcon={<CallSheetIcon />} onClick={() => onOpenCallSheet(selectedDay.id)} sx={{ flexShrink: 0, color: '#ccfbf1', borderColor: 'rgba(45,212,191,.35)' }}>Åpne callsheet</Button>
                  </Stack>
                  {latestDelivery?.failed ? <Alert severity="warning" sx={{ mt: 1.5 }}>{latestDelivery.failed} mottakere feilet ved siste utsending.</Alert> : null}
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Crew-bekreftelser</Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem', mb: 1.5 }}>Kun crew som er tildelt denne produksjonsdagen vises.</Typography>
                  {operations.crewConfirmations.length === 0 ? <Alert severity="info">Ingen crew er tildelt dagen.</Alert> : (
                    <Stack divider={<Divider flexItem sx={{ borderColor: 'rgba(148,163,184,.12)' }} />}>
                      {operations.crewConfirmations.map((confirmation) => {
                        const crew = (project.crew ?? []).find((member) => member.id === confirmation.crewId);
                        return (
                          <Stack key={confirmation.crewId} direction="row" alignItems="center" gap={1.5} sx={{ py: 1 }}>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography sx={{ fontWeight: 700 }}>{crew?.name || confirmation.crewId}</Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,.62)', fontSize: '.75rem' }}>{crew?.role || 'Crew'}</Typography>
                            </Box>
                            <FormControl size="small" sx={{ minWidth: 140, ...fieldSx }}>
                              <Select aria-label={`Bekreftelse for ${crew?.name || confirmation.crewId}`} value={confirmation.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({
                                ...current,
                                crewConfirmations: current.crewConfirmations.map((entry) => entry.crewId === confirmation.crewId ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: new Date().toISOString() } : entry),
                              }))}>
                                {Object.entries(CREW_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Stack>
                        );
                      })}
                    </Stack>
                  )}
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Logistikk</Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {operations.checkpoints.map((checkpoint) => (
                      <Stack key={checkpoint.id} direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                        <Chip size="small" label={CATEGORY_LABELS[checkpoint.category]} sx={{ color: '#a5f3fc', bgcolor: 'rgba(6,182,212,.1)', width: 105 }} />
                        <Typography sx={{ flex: 1, fontSize: '.88rem' }}>{checkpoint.title}</Typography>
                        <FormControl size="small" sx={{ minWidth: 135, ...fieldSx }}>
                          <Select aria-label={`Status for ${checkpoint.title}`} value={checkpoint.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, checkpoints: current.checkpoints.map((entry) => entry.id === checkpoint.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: new Date().toISOString() } : entry) }))}>
                            {Object.entries(CHECKPOINT_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <Button aria-label={`Fjern ${checkpoint.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, checkpoints: current.checkpoints.filter((entry) => entry.id !== checkpoint.id) }))} sx={{ minWidth: 38, color: '#fca5a5' }}><DeleteIcon /></Button>
                      </Stack>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5 }}>
                    <TextField fullWidth size="small" label="Nytt kontrollpunkt" value={checkpointDraft.title} disabled={readOnly} onChange={(event) => setCheckpointDraft((current) => ({ ...current, title: event.target.value }))} sx={fieldSx} />
                    <FormControl size="small" sx={{ minWidth: 130, ...fieldSx }}><InputLabel id="pm-checkpoint-category-label">Kategori</InputLabel><Select labelId="pm-checkpoint-category-label" label="Kategori" value={checkpointDraft.category} disabled={readOnly} onChange={(event) => setCheckpointDraft((current) => ({ ...current, category: event.target.value as typeof current.category }))}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <Button variant="outlined" startIcon={<AddIcon />} disabled={readOnly || !checkpointDraft.title.trim()} onClick={addCheckpoint} sx={{ color: '#99f6e4', borderColor: 'rgba(45,212,191,.35)' }}>Legg til</Button>
                  </Stack>
                </Card>
              </Stack>

              <Stack spacing={2}>
                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box><Typography component="h2" sx={{ fontWeight: 800 }}>Kostnadsavvik</Typography><Typography sx={{ color: 'rgba(203,213,225,.66)', fontSize: '.78rem' }}>Kun operative kostnader for denne dagen.</Typography></Box>
                    <Box sx={{ textAlign: 'right' }}><Typography sx={{ fontSize: '.75rem', color: 'rgba(203,213,225,.65)' }}>Avvik</Typography><Typography sx={{ fontWeight: 850, color: costs.deviation > 0 ? '#fca5a5' : '#86efac' }}>{formatMoney(costs.deviation, currency)}</Typography></Box>
                  </Stack>
                  <Stack direction="row" gap={1} sx={{ my: 1 }}><Chip size="small" label={`Estimat ${formatMoney(costs.estimated, currency)}`} /><Chip size="small" label={`Faktisk ${formatMoney(costs.actual, currency)}`} /><Chip size="small" label={`${readiness?.pendingCosts ?? 0} til godkjenning`} /></Stack>
                  <Stack spacing={1}>
                    {operations.costItems.map((item) => (
                      <Box key={item.id} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid rgba(148,163,184,.14)' }}>
                        <Stack direction="row" gap={1} alignItems="center"><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{item.title}</Typography><Typography sx={{ color: 'rgba(203,213,225,.6)', fontSize: '.73rem' }}>{item.category} · {formatMoney(item.estimatedCost, currency)} → {formatMoney(item.actualCost, currency)}</Typography></Box><Button aria-label={`Fjern kostnad ${item.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, costItems: current.costItems.filter((entry) => entry.id !== item.id) }))} sx={{ minWidth: 36, color: '#fca5a5' }}><DeleteIcon /></Button></Stack>
                        <FormControl fullWidth size="small" sx={{ mt: 1, ...fieldSx }}><InputLabel id={`cost-${item.id}`}>Godkjenningsstatus</InputLabel><Select labelId={`cost-${item.id}`} label="Godkjenningsstatus" value={item.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, costItems: current.costItems.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: new Date().toISOString() } : entry) }))}>{Object.entries(COST_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                      </Box>
                    ))}
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1.5fr 1fr .8fr .8fr auto' }, gap: 1, mt: 1.5 }}>
                    <TextField size="small" label="Kostnad" value={costDraft.title} disabled={readOnly} onChange={(event) => setCostDraft((current) => ({ ...current, title: event.target.value }))} sx={{ ...fieldSx, gridColumn: { xs: '1 / -1', sm: 'auto' } }} />
                    <TextField size="small" label="Kategori" value={costDraft.category} disabled={readOnly} onChange={(event) => setCostDraft((current) => ({ ...current, category: event.target.value }))} sx={fieldSx} />
                    <TextField size="small" type="number" label="Estimat" value={costDraft.estimatedCost} disabled={readOnly} onChange={(event) => setCostDraft((current) => ({ ...current, estimatedCost: event.target.value }))} inputProps={{ min: 0 }} sx={fieldSx} />
                    <TextField size="small" type="number" label="Faktisk" value={costDraft.actualCost} disabled={readOnly} onChange={(event) => setCostDraft((current) => ({ ...current, actualCost: event.target.value }))} inputProps={{ min: 0 }} sx={fieldSx} />
                    <Button aria-label="Legg til kostnad" variant="outlined" disabled={readOnly || !costDraft.title.trim()} onClick={addCost} sx={{ color: '#99f6e4', borderColor: 'rgba(45,212,191,.35)', minWidth: 44 }}><AddIcon /></Button>
                  </Box>
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Avvik og tiltak</Typography>
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    {operations.issues.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.82rem' }}>Ingen avvik er registrert.</Typography> : operations.issues.map((issue) => (
                      <Box key={issue.id} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${issue.severity === 'critical' ? 'rgba(248,113,113,.5)' : 'rgba(148,163,184,.14)'}` }}>
                        <Stack direction="row" alignItems="center" gap={1}><Chip size="small" label={ISSUE_SEVERITY_LABELS[issue.severity]} sx={{ color: issue.severity === 'critical' || issue.severity === 'high' ? '#fecaca' : '#fde68a' }} /><Typography sx={{ flex: 1, fontWeight: 700 }}>{issue.title}</Typography><Button aria-label={`Fjern avvik ${issue.title}`} disabled={readOnly} onClick={() => updateOperations((current) => ({ ...current, issues: current.issues.filter((entry) => entry.id !== issue.id) }))} sx={{ minWidth: 36, color: '#fca5a5' }}><DeleteIcon /></Button></Stack>
                        <FormControl fullWidth size="small" sx={{ mt: 1, ...fieldSx }}><InputLabel id={`issue-${issue.id}`}>Tiltaksstatus</InputLabel><Select labelId={`issue-${issue.id}`} label="Tiltaksstatus" value={issue.status} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, issues: current.issues.map((entry) => entry.id === issue.id ? { ...entry, status: event.target.value as typeof entry.status, updatedAt: new Date().toISOString() } : entry) }))}>{Object.entries(ISSUE_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                      </Box>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5 }}>
                    <TextField fullWidth size="small" label="Nytt avvik" value={issueDraft.title} disabled={readOnly} onChange={(event) => setIssueDraft((current) => ({ ...current, title: event.target.value }))} sx={fieldSx} />
                    <FormControl size="small" sx={{ minWidth: 120, ...fieldSx }}><InputLabel id="pm-issue-severity-label">Alvorlighet</InputLabel><Select labelId="pm-issue-severity-label" label="Alvorlighet" value={issueDraft.severity} disabled={readOnly} onChange={(event) => setIssueDraft((current) => ({ ...current, severity: event.target.value as typeof current.severity }))}>{Object.entries(ISSUE_SEVERITY_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
                    <Button variant="outlined" startIcon={<AddIcon />} disabled={readOnly || !issueDraft.title.trim()} onClick={addIssue} sx={{ color: '#99f6e4', borderColor: 'rgba(45,212,191,.35)' }}>Registrer</Button>
                  </Stack>
                </Card>

                <Card variant="outlined" sx={{ ...panelSx, p: 2 }}>
                  <Typography component="h2" sx={{ fontWeight: 800 }}>Dagsnotat og aktivitet</Typography>
                  <TextField fullWidth multiline minRows={3} label="Produksjonsledelsens dagsnotat" value={operations.notes ?? ''} disabled={readOnly} onChange={(event) => updateOperations((current) => ({ ...current, notes: event.target.value }))} sx={{ mt: 1.5, ...fieldSx }} />
                  <Divider sx={{ my: 1.5, borderColor: 'rgba(148,163,184,.14)' }} />
                  <Stack spacing={.75} data-testid="production-management-activity">
                    {operations.activity.length === 0 ? <Typography sx={{ color: 'rgba(203,213,225,.58)', fontSize: '.78rem' }}>Aktivitetsloggen starter ved første lagring.</Typography> : [...operations.activity].reverse().map((entry) => (
                      <Box key={entry.id}><Typography sx={{ fontSize: '.8rem' }}>{entry.message}</Typography><Typography sx={{ color: 'rgba(203,213,225,.55)', fontSize: '.7rem' }}>{new Date(entry.createdAt).toLocaleString('nb-NO')} · {entry.actorUserId || 'Prosjektmedlem'}</Typography></Box>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}
