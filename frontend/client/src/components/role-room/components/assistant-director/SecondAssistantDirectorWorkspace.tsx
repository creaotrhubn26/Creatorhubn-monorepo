import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AssignmentOutlined as CallSheetIcon,
  AddOutlined as AddIcon,
  DeleteOutline as DeleteIcon,
  CalendarMonthOutlined as ScheduleIcon,
  SaveOutlined as SaveIcon,
  RefreshOutlined as RefreshIcon,
  SpaceDashboardOutlined as FullWorkspaceIcon,
  VideoCameraBackOutlined as OnSetIcon,
} from '@mui/icons-material';
import type { CastingProject, ProductionDay, SecondAdMovementEntry } from '../../models/casting';
import { castingService } from '../../services/castingService';
import { roleRoomAgentDefaultHeaders } from '../../services/roleRoomAgentService';
import { roleTokens } from '../../theme/roleTokens';
import {
  buildSecondAdMovementEntries,
  SECOND_AD_STATUSES,
  SECOND_AD_STATUS_LABELS,
  secondAdReadiness,
  selectSecondAdProductionDay,
} from './secondAssistantDirectorWorkspaceModel';

interface Props {
  project: CastingProject;
  readOnly?: boolean;
  dataLoading?: boolean;
  deliveryRefreshSignal?: number;
  onOpenCallSheet: (productionDayId?: string) => void;
  onOpenSchedule: () => void;
  onOpenLiveSet: () => void;
  onOpenFullWorkspace: () => void;
  onSaved?: (day: ProductionDay) => void;
}

interface DeliverySummary {
  id: string;
  revision: number;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  acknowledged: number;
  recipients: DeliveryRecipient[];
}

interface DeliveryRecipient {
  id: string;
  name?: string | null;
  email: string;
  deliveryStatus: 'pending' | 'sent' | 'failed';
  failureReason?: string | null;
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  reminderCount: number;
  lastRemindedAt?: string | null;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.025)' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.68)' },
  '& fieldset': { borderColor: 'rgba(45,212,191,0.25)' },
};

export function SecondAssistantDirectorWorkspace({
  project,
  readOnly = false,
  dataLoading = false,
  deliveryRefreshSignal = 0,
  onOpenCallSheet,
  onOpenSchedule,
  onOpenLiveSet,
  onOpenFullWorkspace,
  onSaved,
}: Props) {
  const embeddedProductionDays = useMemo(
    () => (Array.isArray(project.productionDays) ? project.productionDays : []),
    [project.productionDays],
  );
  const embeddedSceneBreakdowns = useMemo(
    () => (Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : []),
    [project.sceneBreakdowns],
  );
  const productionDays = embeddedProductionDays;
  const sceneBreakdowns = embeddedSceneBreakdowns;
  const initialDay = useMemo(() => selectSecondAdProductionDay(productionDays), [productionDays]);
  const [dayId, setDayId] = useState(initialDay?.id ?? '');
  const selectedDay = productionDays.find((day) => day.id === dayId) ?? initialDay;
  const operationalProject = useMemo(
    () => ({ ...project, sceneBreakdowns }),
    [project, sceneBreakdowns],
  );
  const derivedEntries = useMemo(
    () => selectedDay ? buildSecondAdMovementEntries(operationalProject, selectedDay) : [],
    [operationalProject, selectedDay],
  );
  const [entries, setEntries] = useState<SecondAdMovementEntry[]>(derivedEntries);
  const [notes, setNotes] = useState(selectedDay?.secondAd?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    setDayId((current) => (
      productionDays.some((day) => day.id === current)
        ? current
        : selectSecondAdProductionDay(productionDays)?.id ?? ''
    ));
  }, [productionDays]);

  const selectedDayId = selectedDay?.id;
  const loadDeliveries = useCallback(async () => {
    if (!selectedDayId) return;
    setDeliveriesLoading(true);
    try {
      const response = await fetch(`/api/role-room/projects/${encodeURIComponent(project.id)}/call-sheet-deliveries?productionDayId=${encodeURIComponent(selectedDayId)}`, {
        headers: { ...roleRoomAgentDefaultHeaders() },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { deliveries?: DeliverySummary[] };
      setDeliveries(Array.isArray(payload.deliveries) ? payload.deliveries.map((delivery) => ({
        ...delivery,
        failed: Number(delivery.failed ?? 0),
        recipients: Array.isArray(delivery.recipients) ? delivery.recipients : [],
      })) : []);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  }, [project.id, selectedDayId]);

  useEffect(() => {
    setEntries(derivedEntries);
    setNotes(selectedDay?.secondAd?.notes ?? '');
  }, [derivedEntries, selectedDay?.id, selectedDay?.secondAd?.notes]);

  useEffect(() => {
    setFeedback(null);
  }, [project.id, selectedDay?.id]);

  useEffect(() => { void loadDeliveries(); }, [deliveryRefreshSignal, loadDeliveries]);

  const latestDelivery = deliveries[0];
  const missingAcknowledgements = useMemo(
    () => latestDelivery?.recipients.filter((recipient) => recipient.deliveryStatus === 'sent' && !recipient.acknowledgedAt) ?? [],
    [latestDelivery],
  );

  const remindMissing = async () => {
    if (!latestDelivery || missingAcknowledgements.length === 0 || readOnly) return;
    setReminding(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/role-room/call-sheet-deliveries/${encodeURIComponent(latestDelivery.id)}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...roleRoomAgentDefaultHeaders() },
        body: JSON.stringify({ recipientIds: missingAcknowledgements.map((recipient) => recipient.id) }),
      });
      const payload = await response.json().catch(() => ({})) as { reminded?: number; total?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Kunne ikke sende påminnelsen.');
      setFeedback({
        type: payload.reminded === payload.total ? 'success' : 'error',
        text: payload.reminded === payload.total
          ? `Påminnelse sendt til ${payload.reminded ?? 0} ${(payload.reminded ?? 0) === 1 ? 'mottaker' : 'mottakere'}.`
          : `Påminnelse sendt til ${payload.reminded ?? 0} av ${payload.total ?? missingAcknowledgements.length} mottakere.`,
      });
      await loadDeliveries();
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke sende påminnelsen.' });
    } finally {
      setReminding(false);
    }
  };

  const stats = useMemo(() => secondAdReadiness(entries), [entries]);
  const patchEntry = (id: string, patch: Partial<SecondAdMovementEntry>) => {
    setEntries((current) => current.map((entry) => (
      entry.id === id ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry
    )));
  };
  const addEntry = (personType: 'stand_in' | 'background') => {
    setEntries((current) => [...current, {
      id: `manual:${personType}:${Date.now()}`,
      personType,
      name: '',
      callTime: selectedDay?.callTime || '',
      status: 'not_called',
    }]);
  };

  const save = async () => {
    if (!selectedDay || readOnly) return;
    if (entries.some((entry) => !entry.name.trim())) {
      setFeedback({ type: 'error', text: 'Alle stand-ins og statister må ha et navn før lagring.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const updated: ProductionDay = {
      ...selectedDay,
      secondAd: { entries, notes: notes.trim() || undefined, updatedAt: new Date().toISOString() },
    };
    try {
      await castingService.saveProductionDay(project.id, updated);
      onSaved?.(updated);
      setFeedback({ type: 'success', text: 'Dagsstatusen er lagret.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Kunne ikke lagre dagsstatus.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box component="section" data-testid="second-ad-workspace" sx={{ minHeight: '100%', overflowY: 'auto', bgcolor: '#07110f', color: roleTokens.text, p: { xs: 1.5, md: 3 } }}>
      <Box sx={{ maxWidth: 1540, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Chip label="2ND AD · CAST OG DAGSDRIFT" size="small" sx={{ color: '#99f6e4', bgcolor: 'rgba(20,184,166,.12)', border: '1px solid rgba(45,212,191,.3)', fontWeight: 800 }} />
            <Typography component="h1" sx={{ mt: 1, fontSize: { xs: '1.45rem', md: '1.9rem' }, fontWeight: 780 }}>{project.name}</Typography>
            <Typography sx={{ color: roleTokens.textMuted }}>Individuelle tider, cast movement og bekreftet dagsstatus basert på registrerte prosjektdata.</Typography>
          </Box>
          <Button variant="outlined" startIcon={<FullWorkspaceIcon />} onClick={onOpenFullWorkspace} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.4)', alignSelf: { xs: 'stretch', md: 'center' } }}>Hele prosjektet</Button>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mb: 2 }}>
          <Button variant="outlined" startIcon={<ScheduleIcon />} onClick={onOpenSchedule} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.3)' }}>Opptaksplan</Button>
          <Button variant="outlined" startIcon={<CallSheetIcon />} onClick={() => onOpenCallSheet(selectedDay?.id)} disabled={!selectedDay} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.3)' }}>Callsheet og utsending</Button>
          <Button variant="outlined" startIcon={<OnSetIcon />} onClick={onOpenLiveSet} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.3)' }}>Live Set</Button>
        </Stack>

        {dataLoading && productionDays.length === 0 ? (
          <Alert severity="info">Henter produksjonsdager…</Alert>
        ) : productionDays.length === 0 ? (
          <Alert severity="info">Ingen produksjonsdag er registrert. Opprett en dag i opptaksplanen før cast movement kan føres.</Alert>
        ) : (
          <>
            <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'rgba(15,23,42,.75)', borderColor: 'rgba(45,212,191,.2)', color: '#fff' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 230, ...fieldSx }}>
                  <InputLabel id="second-ad-day-label">Produksjonsdag</InputLabel>
                  <Select labelId="second-ad-day-label" value={selectedDay?.id ?? ''} label="Produksjonsdag" onChange={(event) => setDayId(String(event.target.value))}>
                    {productionDays.filter((day) => day.status !== 'cancelled').map((day) => <MenuItem key={day.id} value={day.id}>{day.date || 'Udatert dag'} · {day.callTime || 'tid ikke satt'}</MenuItem>)}
                  </Select>
                </FormControl>
                {[['Personer', stats.total], ['Bekreftet', stats.acknowledged], ['Ankommet', stats.arrived], ['Klar', stats.ready]].map(([label, value]) => <Chip key={String(label)} label={`${label}: ${value}`} sx={{ color: '#ccfbf1', bgcolor: 'rgba(20,184,166,.1)' }} />)}
                <Button disabled={readOnly} size="small" startIcon={<AddIcon />} onClick={() => addEntry('stand_in')} sx={{ color: '#99f6e4' }}>Stand-in</Button>
                <Button disabled={readOnly} size="small" startIcon={<AddIcon />} onClick={() => addEntry('background')} sx={{ color: '#99f6e4' }}>Statist</Button>
                <Button disabled={readOnly || saving} variant="contained" startIcon={<SaveIcon />} onClick={save} sx={{ ml: { md: 'auto' }, bgcolor: '#0f766e' }}>{saving ? 'Lagrer…' : 'Lagre dagsstatus'}</Button>
              </Stack>
            </Card>

            <Card variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'rgba(15,23,42,.62)', borderColor: 'rgba(45,212,191,.16)', color: '#fff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 750 }}>Siste callsheet-utsending</Typography>
                  <Typography sx={{ color: roleTokens.textMuted, fontSize: '.82rem' }}>
                    {latestDelivery
                      ? `Revisjon ${latestDelivery.revision} · ${new Date(latestDelivery.createdAt).toLocaleString('nb-NO')}`
                      : deliveriesLoading ? 'Henter status…' : 'Ingen utsending er registrert for denne dagen.'}
                  </Typography>
                  {latestDelivery ? (
                    <>
                      <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                        <Chip size="small" label={`Sendt ${latestDelivery.sent}/${latestDelivery.total}`} sx={{ color: '#bae6fd', bgcolor: 'rgba(14,165,233,.14)' }} />
                        <Chip size="small" label={`Feilet ${latestDelivery.failed}/${latestDelivery.total}`} sx={{ color: '#fecaca', bgcolor: 'rgba(239,68,68,.14)' }} />
                        <Chip size="small" label={`Bekreftet ${latestDelivery.acknowledged}/${latestDelivery.total}`} sx={{ color: '#bbf7d0', bgcolor: 'rgba(34,197,94,.14)' }} />
                      </Stack>
                      <Stack spacing={0.5} sx={{ mt: 1 }} data-testid="call-sheet-recipient-statuses">
                        {latestDelivery.recipients.map((recipient) => {
                          const label = recipient.acknowledgedAt ? 'Bekreftet' : recipient.deliveryStatus === 'failed' ? 'Feilet' : recipient.deliveryStatus === 'sent' ? 'Sendt' : 'Venter';
                          const color = recipient.acknowledgedAt ? '#86efac' : recipient.deliveryStatus === 'failed' ? '#fca5a5' : '#7dd3fc';
                          return (
                            <Stack key={recipient.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.25}>
                              <Typography sx={{ fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipient.name || recipient.email} · {recipient.email}</Typography>
                              <Typography sx={{ color, fontSize: '.76rem', fontWeight: 750, flexShrink: 0 }}>{label}{recipient.reminderCount ? ` · purret ${recipient.reminderCount}` : ''}</Typography>
                            </Stack>
                          );
                        })}
                      </Stack>
                    </>
                  ) : null}
                </Box>
                <Stack direction={{ xs: 'row', sm: 'column' }} gap={0.5}>
                  <Button size="small" startIcon={<RefreshIcon />} disabled={deliveriesLoading} onClick={() => void loadDeliveries()} sx={{ color: '#99f6e4' }}>Oppdater</Button>
                  {missingAcknowledgements.length > 0 ? <Button size="small" variant="outlined" disabled={readOnly || reminding} onClick={() => void remindMissing()} sx={{ color: '#fde68a', borderColor: 'rgba(251,191,36,.4)' }}>{reminding ? 'Sender…' : `Purr manglende (${missingAcknowledgements.length})`}</Button> : null}
                </Stack>
              </Stack>
            </Card>

            {feedback ? <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert> : null}
            {entries.length === 0 ? <Alert severity="info" sx={{ mb: 2 }}>Ingen karakterer er knyttet til scenene på denne dagen. Du kan kontrollere scenegrunnlaget i opptaksplanen.</Alert> : null}

            <Stack spacing={1.25}>
              {entries.map((entry) => (
                <Card key={entry.id} variant="outlined" data-testid={`second-ad-entry-${entry.id}`} sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,.68)', borderColor: 'rgba(148,163,184,.18)', color: '#fff' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'minmax(180px,1.3fr) repeat(5,minmax(105px,.7fr)) minmax(150px,1fr)' }, gap: 1.25, alignItems: 'center' }}>
                    <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
                      {entry.personType === 'cast' ? <><Typography sx={{ fontWeight: 750 }}>{entry.name}</Typography><Typography sx={{ color: roleTokens.textMuted, fontSize: '.78rem' }}>{entry.roleName}</Typography></> : <Stack direction="row" gap={.5} alignItems="center"><TextField fullWidth required size="small" disabled={readOnly} label={entry.personType === 'stand_in' ? 'Stand-in' : 'Statist'} value={entry.name} onChange={(event) => patchEntry(entry.id, { name: event.target.value })} sx={fieldSx} /><Button aria-label="Fjern person" disabled={readOnly} onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))} sx={{ minWidth: 40, color: '#fca5a5' }}><DeleteIcon /></Button></Stack>}
                    </Box>
                    {(['pickupTime', 'callTime', 'makeupTime', 'wardrobeTime', 'onSetTime'] as const).map((key) => <TextField key={key} type="time" size="small" disabled={readOnly} label={{ pickupTime: 'Henting', callTime: 'Call', makeupTime: 'Sminke', wardrobeTime: 'Kostyme', onSetTime: 'På sett' }[key]} value={entry[key] || ''} onChange={(event) => patchEntry(entry.id, { [key]: event.target.value })} InputLabelProps={{ shrink: true }} sx={fieldSx} />)}
                    <FormControl size="small" sx={fieldSx}><InputLabel id={`second-ad-status-${entry.id}`}>Status</InputLabel><Select labelId={`second-ad-status-${entry.id}`} disabled={readOnly} value={entry.status} label="Status" onChange={(event) => patchEntry(entry.id, { status: event.target.value as SecondAdMovementEntry['status'] })}>{SECOND_AD_STATUSES.map((status) => <MenuItem key={status} value={status}>{SECOND_AD_STATUS_LABELS[status]}</MenuItem>)}</Select></FormControl>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 1.25, mt: 1.25 }}>
                    <TextField size="small" disabled={readOnly} label="Transport / sjåfør" value={entry.transport || ''} onChange={(event) => patchEntry(entry.id, { transport: event.target.value })} sx={fieldSx} />
                    <TextField size="small" disabled={readOnly} label="Operativ merknad" value={entry.notes || ''} onChange={(event) => patchEntry(entry.id, { notes: event.target.value })} sx={fieldSx} />
                  </Box>
                </Card>
              ))}
            </Stack>
            <TextField fullWidth multiline minRows={2} disabled={readOnly} label="Felles dagsmerknad" value={notes} onChange={(event) => setNotes(event.target.value)} sx={{ mt: 2, ...fieldSx }} />
          </>
        )}
      </Box>
    </Box>
  );
}

export default SecondAssistantDirectorWorkspace;
