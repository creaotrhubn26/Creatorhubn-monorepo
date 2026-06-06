/**
 * DancerInjuryLogPanel — skadelogg-panel for "injuries"-fanen i
 * DanceWorkspace. Viser aktive og avsluttede skader, og lar bruker
 * legge til nye eller markere som leget.
 *
 * NAV-søknadsgrunnlag (Slice 2) bygger videre på samme datasett.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as CheckIcon,
  HealthAndSafety as HealthIcon,
  Delete as DeleteIcon,
  LocalHospital as InjuryIcon,
} from '@mui/icons-material';
import {
  listInjuries,
  createInjury,
  patchInjury,
  deleteInjury,
  INJURY_BODY_PARTS,
  type InjuryLogEntry,
  type InjuryEntryStatus,
  type InjuryBodyPart,
  type InjurySide,
  type InjuryTrigger,
} from './dancerInjuryLogService';
import {
  listDancerProfiles,
  type DancerProfile,
} from './dancerProfileService';

const PURPLE = danceFlowColors.lavenderDark;
const BG_DARK = danceFlowColors.bgBase;
const CARD_BG = danceFlowColors.bgCard;
const BORDER = 'rgba(139,92,246,0.25)';

const BODY_PART_LABEL: Record<InjuryBodyPart, string> = {
  ankle: 'Ankel',
  knee: 'Kne',
  hip: 'Hofte',
  lower_back: 'Korsrygg',
  shoulder: 'Skulder',
  wrist: 'Håndledd',
  foot: 'Fot',
  neck: 'Nakke',
  other: 'Annet',
};

const SIDE_LABEL: Record<InjurySide, string> = {
  left: 'Venstre',
  right: 'Høyre',
  both: 'Begge',
};

const TRIGGER_LABEL: Record<InjuryTrigger, string> = {
  rehearsal: 'Prøve',
  performance: 'Forestilling',
  audition: 'Audition',
  training: 'Trening',
  other: 'Annet',
};

const STATUS_LABEL: Record<InjuryEntryStatus, string> = {
  active: 'Aktiv',
  healing: 'Under heling',
  resolved: 'Frisk',
};

const STATUS_COLOR: Record<InjuryEntryStatus, string> = {
  active: danceFlowColors.errorStrong,
  healing: danceFlowColors.amber,
  resolved: danceFlowColors.successDark,
};

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

interface FormState {
  dancerId: string;
  entryDate: string;
  bodyPart: InjuryBodyPart;
  side: InjurySide | '';
  severity: number;
  note: string;
  triggeredBy: InjuryTrigger | '';
  expectedReturnDate: string;
}

function emptyForm(defaults: { dancerId?: string } = {}): FormState {
  return {
    dancerId: defaults.dancerId ?? '',
    entryDate: todayIso(),
    bodyPart: 'ankle',
    side: '',
    severity: 2,
    note: '',
    triggeredBy: '',
    expectedReturnDate: '',
  };
}

export interface DancerInjuryLogPanelProps {
  /** Når null, viser skadeloggen alle eierens dansere på tvers av prosjekter. */
  projectId: string | null;
}

export function DancerInjuryLogPanel({
  projectId,
}: DancerInjuryLogPanelProps): React.ReactElement {
  const [entries, setEntries] = React.useState<InjuryLogEntry[]>([]);
  const [profiles, setProfiles] = React.useState<DancerProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'open' | 'resolved' | 'all'>('open');

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(() => emptyForm());

  const refresh = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [injuries, dancerProfiles] = await Promise.all([
        listInjuries({ projectId: projectId ?? undefined, limit: 200 }),
        listDancerProfiles(projectId ?? undefined),
      ]);
      setEntries(injuries);
      setProfiles(dancerProfiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste skadelogg');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const dancerName = React.useCallback(
    (dancerId: string): string => {
      const p = profiles.find((x) => x.dancerId === dancerId);
      return p?.displayName ?? dancerId;
    },
    [profiles],
  );

  const filtered = React.useMemo(() => {
    if (tab === 'all') return entries;
    if (tab === 'resolved') return entries.filter((e) => e.status === 'resolved');
    return entries.filter((e) => e.status !== 'resolved');
  }, [entries, tab]);

  const counts = React.useMemo(() => {
    let active = 0, healing = 0, resolved = 0;
    for (const e of entries) {
      if (e.status === 'active') active += 1;
      else if (e.status === 'healing') healing += 1;
      else resolved += 1;
    }
    return { active, healing, resolved, open: active + healing };
  }, [entries]);

  const openCreateDialog = (): void => {
    const defaultDancerId = profiles[0]?.dancerId ?? '';
    setForm(emptyForm({ dancerId: defaultDancerId }));
    setSubmitError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!form.dancerId) {
      setSubmitError('Velg en danser først.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createInjury({
        dancerId: form.dancerId,
        entryDate: form.entryDate,
        bodyPart: form.bodyPart,
        side: form.side === '' ? null : form.side,
        severity: form.severity,
        note: form.note.trim() === '' ? null : form.note.trim(),
        status: 'active',
        expectedReturnDate: form.expectedReturnDate === '' ? null : form.expectedReturnDate,
        triggeredBy: form.triggeredBy === '' ? null : form.triggeredBy,
        projectId: projectId ?? null,
      });
      setEntries((prev) => [created, ...prev]);
      setDialogOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kunne ikke lagre');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (
    entry: InjuryLogEntry,
    nextStatus: InjuryEntryStatus,
  ): Promise<void> => {
    try {
      const patched = await patchInjury(entry.id, { status: nextStatus });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? patched : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke oppdatere status');
    }
  };

  const removeEntry = async (entry: InjuryLogEntry): Promise<void> => {
    if (!window.confirm(`Slett skadeoppføring for ${dancerName(entry.dancerId)}?`)) return;
    try {
      await deleteInjury(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    }
  };

  return (
    <Box
      data-testid="dancer-injury-log-panel"
      sx={{ bgcolor: BG_DARK, color: danceFlowColors.textSecondary, minHeight: '100%', p: { xs: 2, md: 3 } }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'rgba(139,92,246,0.18)',
              color: danceFlowColors.lavender,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InjuryIcon />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 10, letterSpacing: 2, color: danceFlowColors.lavender, fontWeight: 700 }}>
              SKADELOGG
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>
              {counts.open} åpne · {counts.resolved} avsluttet
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
          disabled={loading || profiles.length === 0}
          sx={{
            bgcolor: PURPLE,
            '&:hover': { bgcolor: danceFlowColors.lavenderDeep },
            textTransform: 'none',
            fontWeight: 600,
          }}
          data-testid="injury-log-add"
        >
          Ny skadeoppføring
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v: 'open' | 'resolved' | 'all') => setTab(v)}
        sx={{
          mb: 2,
          minHeight: 36,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            color: 'rgba(229,231,235,0.62)',
            minHeight: 36,
          },
          '& .Mui-selected': { color: '#fff' },
          '& .MuiTabs-indicator': { bgcolor: PURPLE, height: 3, borderRadius: 1.5 },
        }}
      >
        <Tab value="open" label={`Åpne (${counts.open})`} />
        <Tab value="resolved" label={`Friske (${counts.resolved})`} />
        <Tab value="all" label={`Alle (${entries.length})`} />
      </Tabs>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading && entries.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} sx={{ color: PURPLE }} />
        </Stack>
      ) : null}

      {!loading && profiles.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ingen danserprofiler i prosjektet. Legg til dansere under "Studenter"-fanen først,
          så kan du registrere skader på dem her.
        </Alert>
      ) : null}

      {!loading && filtered.length === 0 && profiles.length > 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
          <HealthIcon sx={{ fontSize: 48, color: STATUS_COLOR.resolved }} />
          <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)' }}>
            {tab === 'open'
              ? 'Ingen åpne skader. Alle dansere er klare for innsats.'
              : tab === 'resolved'
              ? 'Ingen avsluttede oppføringer enda.'
              : 'Skadeloggen er tom.'}
          </Typography>
        </Stack>
      ) : null}

      <Stack spacing={1.5}>
        {filtered.map((entry) => (
          <Box
            key={entry.id}
            data-testid={`injury-log-entry-${entry.id}`}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: CARD_BG,
              border: `1px solid ${BORDER}`,
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {dancerName(entry.dancerId)}
                  </Typography>
                  <Chip
                    size="small"
                    label={STATUS_LABEL[entry.status]}
                    sx={{
                      bgcolor: `${STATUS_COLOR[entry.status]}26`,
                      color: STATUS_COLOR[entry.status],
                      fontWeight: 700,
                      height: 22,
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Alvor ${entry.severity}/5`}
                    sx={{
                      bgcolor: 'rgba(229,231,235,0.08)',
                      color: danceFlowColors.textSecondary,
                      height: 22,
                    }}
                  />
                </Stack>
                <Typography sx={{ fontSize: 14, color: 'rgba(229,231,235,0.85)', mb: 0.5 }}>
                  {BODY_PART_LABEL[entry.bodyPart]}
                  {entry.side ? ` · ${SIDE_LABEL[entry.side]}` : ''}
                  {' · '}
                  <span style={{ color: 'rgba(229,231,235,0.55)' }}>
                    {new Date(entry.entryDate).toLocaleDateString('nb-NO', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                  {entry.triggeredBy ? (
                    <span style={{ color: 'rgba(229,231,235,0.55)' }}>
                      {' · '}
                      {TRIGGER_LABEL[entry.triggeredBy]}
                    </span>
                  ) : null}
                </Typography>
                {entry.note ? (
                  <Typography sx={{ fontSize: 13, color: 'rgba(229,231,235,0.7)', mt: 0.5 }}>
                    {entry.note}
                  </Typography>
                ) : null}
                {entry.expectedReturnDate && entry.status !== 'resolved' ? (
                  <Typography sx={{ fontSize: 12, color: danceFlowColors.lavender, mt: 0.5, fontWeight: 600 }}>
                    Forventet retur:{' '}
                    {new Date(entry.expectedReturnDate).toLocaleDateString('nb-NO', {
                      day: 'numeric', month: 'long',
                    })}
                  </Typography>
                ) : null}
                {entry.resolvedDate && entry.status === 'resolved' ? (
                  <Typography sx={{ fontSize: 12, color: STATUS_COLOR.resolved, mt: 0.5, fontWeight: 600 }}>
                    Frisk fra:{' '}
                    {new Date(entry.resolvedDate).toLocaleDateString('nb-NO', {
                      day: 'numeric', month: 'long',
                    })}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {entry.status === 'active' ? (
                  <Tooltip title="Marker som under heling">
                    <Button
                      size="small"
                      onClick={() => void updateStatus(entry, 'healing')}
                      sx={{ color: danceFlowColors.amber, textTransform: 'none' }}
                    >
                      Heler
                    </Button>
                  </Tooltip>
                ) : null}
                {entry.status !== 'resolved' ? (
                  <Tooltip title="Marker som frisk">
                    <Button
                      size="small"
                      startIcon={<CheckIcon />}
                      onClick={() => void updateStatus(entry, 'resolved')}
                      sx={{ color: STATUS_COLOR.resolved, textTransform: 'none' }}
                      data-testid={`injury-log-resolve-${entry.id}`}
                    >
                      Frisk
                    </Button>
                  </Tooltip>
                ) : null}
                <Tooltip title="Slett oppføring">
                  <IconButton
                    size="small"
                    onClick={() => void removeEntry(entry)}
                    sx={{ color: 'rgba(229,231,235,0.5)' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Dialog
        open={dialogOpen}
        onClose={submitting ? undefined : () => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Ny skadeoppføring</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Danser"
              value={form.dancerId}
              onChange={(e) => setForm((f) => ({ ...f, dancerId: e.target.value }))}
              fullWidth
              size="small"
              data-testid="injury-form-dancer"
            >
              {profiles.map((p) => (
                <MenuItem key={p.dancerId} value={p.dancerId}>
                  {p.displayName ?? p.dancerId}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
                label="Dato"
                value={form.entryDate}
                onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Hendelse"
                value={form.triggeredBy}
                onChange={(e) =>
                  setForm((f) => ({ ...f, triggeredBy: e.target.value as InjuryTrigger | '' }))
                }
                fullWidth
                size="small"
              >
                <MenuItem value="">— ukjent —</MenuItem>
                {(Object.keys(TRIGGER_LABEL) as InjuryTrigger[]).map((t) => (
                  <MenuItem key={t} value={t}>
                    {TRIGGER_LABEL[t]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Kroppsdel"
                value={form.bodyPart}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bodyPart: e.target.value as InjuryBodyPart }))
                }
                fullWidth
                size="small"
              >
                {INJURY_BODY_PARTS.map((bp) => (
                  <MenuItem key={bp} value={bp}>
                    {BODY_PART_LABEL[bp]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Side"
                value={form.side}
                onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as InjurySide | '' }))}
                fullWidth
                size="small"
              >
                <MenuItem value="">—</MenuItem>
                {(Object.keys(SIDE_LABEL) as InjurySide[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {SIDE_LABEL[s]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Alvor (1 = mild irritasjon, 5 = krever lege)
              </Typography>
              <Slider
                value={form.severity}
                onChange={(_, v) => setForm((f) => ({ ...f, severity: v as number }))}
                min={1}
                max={5}
                step={1}
                marks
                valueLabelDisplay="auto"
                sx={{ color: PURPLE }}
              />
            </Box>
            <TextField
              type="date"
              label="Forventet retur (valgfri)"
              value={form.expectedReturnDate}
              onChange={(e) => setForm((f) => ({ ...f, expectedReturnDate: e.target.value }))}
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Notat"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              size="small"
              placeholder="Hva skjedde? — brukes også som NAV-grunnlag senere."
            />
            {submitError ? <Alert severity="error">{submitError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            variant="contained"
            disabled={submitting}
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: danceFlowColors.lavenderDeep } }}
            data-testid="injury-form-submit"
          >
            {submitting ? 'Lagrer…' : 'Lagre'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DancerInjuryLogPanel;
