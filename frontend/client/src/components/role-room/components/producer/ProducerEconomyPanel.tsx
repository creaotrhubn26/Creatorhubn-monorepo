import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CurrencyExchange as CurrencyExchangeIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import { useProducerEconomy } from '../../hooks/useProducerEconomy';
import type { ProducerPhase } from '../../services/producerWorkflowService';
import { getProducerEconomyStatusLabel } from '../../utils/producerWorkflow';

interface ProducerEconomyPanelProps {
  projectId: string;
  title?: string;
  readOnly?: boolean;
  canSendBudgetReview?: boolean;
  onSendBudgetReview?: () => void;
  contractsPanel?: ReactNode;
  focusedPhase?: ProducerPhase | 'all';
  onFocusedPhaseChange?: (phase: ProducerPhase | 'all') => void;
}

const PHASE_LABELS: Record<ProducerPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};

const STATUS_OPTIONS = ['draft', 'pending_approval', 'approved', 'blocked', 'completed'] as const;

interface EconomyDraft {
  estimate: string;
  approved: string;
  actual: string;
  status: string;
  clientVisible: boolean;
  dirty: boolean;
}

export default function ProducerEconomyPanel({
  projectId,
  title = 'Økonomi',
  readOnly = false,
  canSendBudgetReview = true,
  onSendBudgetReview,
  contractsPanel,
  focusedPhase = 'all',
  onFocusedPhaseChange,
}: ProducerEconomyPanelProps) {
  const { items, totals, loading, error, createItem, updateItem, removeItem } = useProducerEconomy(projectId);

  const [phase, setPhase] = useState<ProducerPhase>('preproduction');
  const [category, setCategory] = useState('');
  const [itemName, setItemName] = useState('');
  const [estimate, setEstimate] = useState('');
  const [draftsById, setDraftsById] = useState<Record<string, EconomyDraft>>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<ProducerPhase, typeof items> = {
      preproduction: [],
      production: [],
      postproduction: [],
    };
    for (const item of items) {
      map[item.phase].push(item);
    }
    return map;
  }, [items]);

  const phaseTotals = useMemo(() => {
    const toNumber = (value: string | number): number => {
      if (typeof value === 'number') return value;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return (Object.keys(PHASE_LABELS) as ProducerPhase[]).reduce<Record<ProducerPhase, { estimate: number; approved: number; actual: number }>>(
      (acc, currentPhase) => {
        const phaseItems = grouped[currentPhase];
        acc[currentPhase] = phaseItems.reduce(
          (sum, item) => ({
            estimate: sum.estimate + toNumber(item.estimate),
            approved: sum.approved + toNumber(item.approved),
            actual: sum.actual + toNumber(item.actual),
          }),
          { estimate: 0, approved: 0, actual: 0 },
        );
        return acc;
      },
      {
        preproduction: { estimate: 0, approved: 0, actual: 0 },
        production: { estimate: 0, approved: 0, actual: 0 },
        postproduction: { estimate: 0, approved: 0, actual: 0 },
      },
    );
  }, [grouped]);

  const visiblePhaseKeys = useMemo(
    () => (focusedPhase === 'all' ? (Object.keys(PHASE_LABELS) as ProducerPhase[]) : [focusedPhase]),
    [focusedPhase],
  );

  useEffect(() => {
    setDraftsById((previous) => {
      const next: Record<string, EconomyDraft> = {};
      for (const item of items) {
        const existing = previous[item.id];
        if (existing?.dirty) {
          next[item.id] = existing;
          continue;
        }
        next[item.id] = {
          estimate: String(item.estimate ?? 0),
          approved: String(item.approved ?? 0),
          actual: String(item.actual ?? 0),
          status: item.status || 'draft',
          clientVisible: Boolean(item.client_visible),
          dirty: false,
        };
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (focusedPhase !== 'all') {
      setPhase(focusedPhase);
    }
  }, [focusedPhase]);

  const handleCreate = async () => {
    if (!category.trim() || !itemName.trim()) return;
    await createItem({
      phase,
      category: category.trim(),
      itemName: itemName.trim(),
      estimate: Number.parseFloat(estimate || '0') || 0,
      approved: 0,
      actual: 0,
      status: 'draft',
      clientVisible: true,
    });
    setCategory('');
    setItemName('');
    setEstimate('');
  };

  const handleDraftChange = (itemId: string, patch: Partial<EconomyDraft>) => {
    setDraftsById((previous) => {
      const current = previous[itemId] ?? {
        estimate: '0',
        approved: '0',
        actual: '0',
        status: 'draft',
        clientVisible: true,
        dirty: false,
      };
      return {
        ...previous,
        [itemId]: {
          ...current,
          ...patch,
          dirty: true,
        },
      };
    });
  };

  const handleSaveItem = async (itemId: string) => {
    const draft = draftsById[itemId];
    if (!draft) return;
    setSavingItemId(itemId);
    try {
      await updateItem(itemId, {
        estimate: Number.parseFloat(draft.estimate) || 0,
        approved: Number.parseFloat(draft.approved) || 0,
        actual: Number.parseFloat(draft.actual) || 0,
        status: draft.status || 'draft',
        clientVisible: draft.clientVisible,
      });
      setDraftsById((previous) => ({
        ...previous,
        [itemId]: {
          ...draft,
          dirty: false,
        },
      }));
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setSavingItemId(itemId);
    try {
      await removeItem(itemId);
      setDraftsById((previous) => {
        const next = { ...previous };
        delete next[itemId];
        return next;
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const variance = totals.approved - totals.actual;
  const showBudgetReviewAction = Boolean(onSendBudgetReview) && canSendBudgetReview && !readOnly;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <CurrencyExchangeIcon sx={{ color: '#34d399' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            {title}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" label={`Estimert ${Math.round(totals.estimate)} NOK`} sx={{ bgcolor: 'rgba(52,211,153,0.16)', color: '#86efac' }} />
          <Chip size="small" label={`Godkjent ${Math.round(totals.approved)} NOK`} sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#7dd3fc' }} />
          <Chip size="small" label={`Faktisk ${Math.round(totals.actual)} NOK`} sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }} />
          <Chip
            size="small"
            label={`Avvik ${Math.round(variance)} NOK`}
            sx={{
              bgcolor: variance >= 0 ? 'rgba(74,222,128,0.16)' : 'rgba(248,113,113,0.16)',
              color: variance >= 0 ? '#86efac' : '#fca5a5',
            }}
          />
        </Stack>
      </Stack>

      {showBudgetReviewAction && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            onClick={onSendBudgetReview}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: '#fbbf24',
              color: '#111827',
              '&:hover': { bgcolor: '#f59e0b' },
            }}
          >
            Send budsjett til klient
          </Button>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!readOnly && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ lg: 'flex-end' }}>
          <Box sx={{ minWidth: 180 }}>
            <Typography sx={{ color: 'rgba(226,232,240,0.8)', mb: 0.5, fontSize: '0.85rem' }}>Fase</Typography>
            <Select
              size="small"
              value={phase}
              onChange={(event) => setPhase(event.target.value as ProducerPhase)}
              fullWidth
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
            >
              {Object.entries(PHASE_LABELS).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
          </Box>
          <TextField
            size="small"
            label="Kategori"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            sx={{ minWidth: 180 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label="Kostlinje"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label="Estimert"
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            sx={{ width: 140 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { void handleCreate(); }}
            disabled={loading || !category.trim() || !itemName.trim()}
            sx={{ bgcolor: '#fbbf24', color: '#111827', fontWeight: 700, textTransform: 'none', minWidth: 140 }}
          >
            Legg til linje
          </Button>
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap">
        <Button
          size="small"
          variant={focusedPhase === 'all' ? 'contained' : 'outlined'}
          onClick={() => onFocusedPhaseChange?.('all')}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            alignSelf: 'flex-start',
            bgcolor: focusedPhase === 'all' ? '#1d4ed8' : 'transparent',
          }}
        >
          Alle faser
        </Button>
        {(Object.keys(PHASE_LABELS) as ProducerPhase[]).map((phaseKey) => (
          <Button
            key={phaseKey}
            size="small"
            variant={focusedPhase === phaseKey ? 'contained' : 'outlined'}
            onClick={() => onFocusedPhaseChange?.(phaseKey)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              alignSelf: 'flex-start',
              bgcolor: focusedPhase === phaseKey ? '#0f766e' : 'transparent',
            }}
          >
            {PHASE_LABELS[phaseKey]}
          </Button>
        ))}
      </Stack>

      <Stack spacing={1.5}>
        {visiblePhaseKeys.map((phaseKey) => (
          <Box key={phaseKey} sx={{ borderRadius: 1.5, border: '1px solid rgba(148,163,184,0.2)', p: 1.25 }}>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 700, mb: 1 }}>{PHASE_LABELS[phaseKey]}</Typography>
            {grouped[phaseKey].length === 0 ? (
              <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.9rem' }}>Ingen kostlinjer i denne fasen.</Typography>
            ) : (
              <Stack spacing={0.8}>
                {grouped[phaseKey].map((item) => (
                  <Stack
                    key={item.id}
                    direction="column"
                    spacing={1}
                    sx={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: 1.25, p: 1 }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ md: 'center' }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{item.item_name}</Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.85rem' }}>{item.category}</Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip size="small" label={`Est ${Math.round(Number(item.estimate) || 0)}`} />
                        <Chip size="small" label={`Godkjent ${Math.round(Number(item.approved) || 0)}`} />
                        <Chip size="small" label={`Faktisk ${Math.round(Number(item.actual) || 0)}`} />
                        <Chip size="small" label={getProducerEconomyStatusLabel(item.status)} />
                        <Chip
                          size="small"
                          label={item.client_visible ? 'Synlig for klient' : 'Skjult for klient'}
                          sx={{
                            bgcolor: item.client_visible ? 'rgba(74,222,128,0.16)' : 'rgba(148,163,184,0.16)',
                            color: item.client_visible ? '#86efac' : '#cbd5e1',
                          }}
                        />
                      </Stack>
                    </Stack>
                    {!readOnly && (
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                        <TextField
                          size="small"
                          label="Estimert"
                          value={draftsById[item.id]?.estimate ?? String(item.estimate ?? 0)}
                          onChange={(event) => handleDraftChange(item.id, { estimate: event.target.value })}
                          sx={{ width: { xs: '100%', md: 130 } }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <TextField
                          size="small"
                          label="Godkjent"
                          value={draftsById[item.id]?.approved ?? String(item.approved ?? 0)}
                          onChange={(event) => handleDraftChange(item.id, { approved: event.target.value })}
                          sx={{ width: { xs: '100%', md: 130 } }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <TextField
                          size="small"
                          label="Faktisk"
                          value={draftsById[item.id]?.actual ?? String(item.actual ?? 0)}
                          onChange={(event) => handleDraftChange(item.id, { actual: event.target.value })}
                          sx={{ width: { xs: '100%', md: 130 } }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <Box sx={{ minWidth: { xs: '100%', md: 170 } }}>
                          <Select
                            size="small"
                            value={draftsById[item.id]?.status ?? item.status}
                            onChange={(event) => handleDraftChange(item.id, { status: String(event.target.value) })}
                            fullWidth
                            sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                          >
                            {STATUS_OPTIONS.map((statusValue) => (
                              <MenuItem key={statusValue} value={statusValue}>
                                {getProducerEconomyStatusLabel(statusValue)}
                              </MenuItem>
                            ))}
                          </Select>
                        </Box>
                        <FormControlLabel
                          sx={{ ml: { md: 1 } }}
                          control={
                            <Switch
                              size="small"
                              checked={draftsById[item.id]?.clientVisible ?? Boolean(item.client_visible)}
                              onChange={(event) => handleDraftChange(item.id, { clientVisible: event.target.checked })}
                            />
                          }
                          label="Klientsynlighet"
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { void handleSaveItem(item.id); }}
                          disabled={loading || savingItemId === item.id || !draftsById[item.id]?.dirty}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Lagre linje
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => { void handleDeleteItem(item.id); }}
                          disabled={loading || savingItemId === item.id}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Fjern
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
              <Chip size="small" label={`Estimert ${Math.round(phaseTotals[phaseKey].estimate)} NOK`} />
              <Chip size="small" label={`Godkjent ${Math.round(phaseTotals[phaseKey].approved)} NOK`} />
              <Chip size="small" label={`Faktisk ${Math.round(phaseTotals[phaseKey].actual)} NOK`} />
            </Stack>
          </Box>
        ))}
      </Stack>

      {contractsPanel ? (
        <>
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />
          <Box sx={{ pt: 0.5 }}>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 700, mb: 1 }}>
              Tilbud og kontrakter
            </Typography>
            {contractsPanel}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
