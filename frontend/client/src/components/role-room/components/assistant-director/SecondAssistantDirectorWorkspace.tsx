import { useEffect, useMemo, useState } from 'react';
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
  onOpenCallSheet: () => void;
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
  acknowledged: number;
}

const fieldSx = {
  '& .MuiInputBase-root': { color: '#fff', bgcolor: 'rgba(255,255,255,0.025)' },
  '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.68)' },
  '& fieldset': { borderColor: 'rgba(45,212,191,0.25)' },
};

export function SecondAssistantDirectorWorkspace({
  project,
  readOnly = false,
  onOpenCallSheet,
  onOpenSchedule,
  onOpenLiveSet,
  onOpenFullWorkspace,
  onSaved,
}: Props) {
  const productionDays = useMemo(
    () => (Array.isArray(project.productionDays) ? project.productionDays : []),
    [project.productionDays],
  );
  const initialDay = useMemo(() => selectSecondAdProductionDay(productionDays), [productionDays]);
  const [dayId, setDayId] = useState(initialDay?.id ?? '');
  const selectedDay = productionDays.find((day) => day.id === dayId) ?? initialDay;
  const derivedEntries = useMemo(
    () => selectedDay ? buildSecondAdMovementEntries(project, selectedDay) : [],
    [project, selectedDay],
  );
  const [entries, setEntries] = useState<SecondAdMovementEntry[]>(derivedEntries);
  const [notes, setNotes] = useState(selectedDay?.secondAd?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const loadDeliveries = async () => {
    if (!selectedDay) return;
    setDeliveriesLoading(true);
    try {
      const response = await fetch(`/api/role-room/projects/${encodeURIComponent(project.id)}/call-sheet-deliveries?productionDayId=${encodeURIComponent(selectedDay.id)}`, {
        headers: { ...roleRoomAgentDefaultHeaders() },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { deliveries?: DeliverySummary[] };
      setDeliveries(Array.isArray(payload.deliveries) ? payload.deliveries : []);
    } catch {
      setDeliveries([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  useEffect(() => {
    setEntries(derivedEntries);
    setNotes(selectedDay?.secondAd?.notes ?? '');
    setFeedback(null);
  }, [derivedEntries, selectedDay?.id, selectedDay?.secondAd?.notes]);

  useEffect(() => { void loadDeliveries(); }, [project.id, selectedDay?.id]);

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
          <Button variant="outlined" startIcon={<CallSheetIcon />} onClick={onOpenCallSheet} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.3)' }}>Callsheet og utsending</Button>
          <Button variant="outlined" startIcon={<OnSetIcon />} onClick={onOpenLiveSet} sx={{ color: '#ccfbf1', borderColor: 'rgba(45,212,191,.3)' }}>Live Set</Button>
        </Stack>

        {productionDays.length === 0 ? (
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
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 750 }}>Siste callsheet-utsending</Typography>
                  <Typography sx={{ color: roleTokens.textMuted, fontSize: '.82rem' }}>
                    {deliveries[0]
                      ? `Revisjon ${deliveries[0].revision} · sendt ${deliveries[0].sent}/${deliveries[0].total} · bekreftet ${deliveries[0].acknowledged}/${deliveries[0].total}`
                      : deliveriesLoading ? 'Henter status…' : 'Ingen utsending er registrert for denne dagen.'}
                  </Typography>
                </Box>
                <Button size="small" startIcon={<RefreshIcon />} disabled={deliveriesLoading} onClick={() => void loadDeliveries()} sx={{ color: '#99f6e4' }}>Oppdater</Button>
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
                    <FormControl size="small" sx={fieldSx}><InputLabel>Status</InputLabel><Select disabled={readOnly} value={entry.status} label="Status" onChange={(event) => patchEntry(entry.id, { status: event.target.value as SecondAdMovementEntry['status'] })}>{SECOND_AD_STATUSES.map((status) => <MenuItem key={status} value={status}>{SECOND_AD_STATUS_LABELS[status]}</MenuItem>)}</Select></FormControl>
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
