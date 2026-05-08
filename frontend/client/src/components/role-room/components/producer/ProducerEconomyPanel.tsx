import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useProducerEconomy } from '../../hooks/useProducerEconomy';
import type { ProducerPhase } from '../../services/producerWorkflowService';
import { getProducerEconomyStatusLabel } from '../../utils/producerWorkflow';
import BudgetCategoryPicker from './BudgetCategoryPicker';

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

  // Gruppér linjer per kategori innenfor hver fase, med fast rekkefølge
  // basert på første-sett-rekkefølge for å unngå at lagring-flytter linjen
  // hopper rundt visuelt.
  const categoryGrouped = useMemo(() => {
    const result: Record<ProducerPhase, Array<{ category: string; items: typeof items }>> = {
      preproduction: [],
      production: [],
      postproduction: [],
    };
    for (const phaseKey of Object.keys(grouped) as ProducerPhase[]) {
      const order: string[] = [];
      const buckets = new Map<string, typeof items>();
      for (const item of grouped[phaseKey]) {
        const cat = (item.category ?? '').trim() || 'Ukategorisert';
        if (!buckets.has(cat)) {
          buckets.set(cat, []);
          order.push(cat);
        }
        buckets.get(cat)!.push(item);
      }
      result[phaseKey] = order.map((cat) => ({ category: cat, items: buckets.get(cat)! }));
    }
    return result;
  }, [grouped]);

  // Format-helper: norsk tusenskille + NOK-suffix.
  const formatCurrency = (value: number): string => {
    if (!Number.isFinite(value) || value === 0) return '0 NOK';
    return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Math.round(value))} NOK`;
  };

  // Avvik = (actual - approved) / approved. Returnerer null hvis approved=0
  // (kan ikke beregne meningsfullt avvik).
  const computeVariance = (approved: number, actual: number): number | null => {
    if (!Number.isFinite(approved) || approved === 0) return null;
    return (actual - approved) / approved;
  };

  const formatVariance = (variance: number | null): string => {
    if (variance === null) return '—';
    const pct = variance * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  const varianceColor = (variance: number | null): { bg: string; fg: string } => {
    if (variance === null) return { bg: 'rgba(148,163,184,0.16)', fg: '#cbd5e1' };
    if (variance <= 0) return { bg: 'rgba(74,222,128,0.16)', fg: '#86efac' };
    if (variance <= 0.1) return { bg: 'rgba(251,191,36,0.18)', fg: '#fde68a' };
    return { bg: 'rgba(248,113,113,0.18)', fg: '#fca5a5' };
  };

  // Collapse-state: lukket-set istedenfor åpen-set så nye kategorier er
  // åpne by default uten ekstra effekter.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const toggleCategoryCollapsed = (key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          <BudgetCategoryPicker
            projectId={projectId}
            value={category}
            onChange={setCategory}
            size="small"
            minWidth={200}
            phase={phase}
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>{PHASE_LABELS[phaseKey]}</Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                <Chip size="small" label={`Estimat ${formatCurrency(phaseTotals[phaseKey].estimate)}`} sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#e2e8f0' }} />
                <Chip size="small" label={`Godkjent ${formatCurrency(phaseTotals[phaseKey].approved)}`} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                <Chip size="small" label={`Faktisk ${formatCurrency(phaseTotals[phaseKey].actual)}`} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                {(() => {
                  const v = computeVariance(phaseTotals[phaseKey].approved, phaseTotals[phaseKey].actual);
                  const t = varianceColor(v);
                  return <Chip size="small" label={`Avvik ${formatVariance(v)}`} sx={{ bgcolor: t.bg, color: t.fg, fontWeight: 700 }} />;
                })()}
              </Stack>
            </Stack>
            {grouped[phaseKey].length === 0 ? (
              <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.9rem' }}>Ingen kostlinjer i denne fasen.</Typography>
            ) : (
              <Stack spacing={0.8}>
                {categoryGrouped[phaseKey].map((group) => {
                  const collapseKey = `${phaseKey}::${group.category}`;
                  const isCollapsed = collapsedCategories.has(collapseKey);
                  const groupTotals = group.items.reduce(
                    (sum, item) => ({
                      estimate: sum.estimate + (Number(item.estimate) || 0),
                      approved: sum.approved + (Number(item.approved) || 0),
                      actual: sum.actual + (Number(item.actual) || 0),
                    }),
                    { estimate: 0, approved: 0, actual: 0 },
                  );
                  const groupVariance = computeVariance(groupTotals.approved, groupTotals.actual);
                  const groupVarianceTone = varianceColor(groupVariance);
                  return (
                    <Box
                      key={collapseKey}
                      sx={{
                        border: '1px solid rgba(148,163,184,0.16)',
                        borderRadius: 1.5,
                        background: 'rgba(15,23,42,0.36)',
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        alignItems={{ md: 'center' }}
                        justifyContent="space-between"
                        spacing={1}
                        onClick={() => toggleCategoryCollapsed(collapseKey)}
                        sx={{ cursor: 'pointer', p: 1, '&:hover': { background: 'rgba(168,85,247,0.06)' } }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <IconButton size="small" sx={{ color: 'rgba(226,232,240,0.7)', p: 0.25 }}>
                            {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                          </IconButton>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                            {group.category}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${group.items.length} linje${group.items.length === 1 ? '' : 'r'}`}
                            sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1', height: 22 }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.6} flexWrap="wrap">
                          <Chip size="small" label={`Est ${formatCurrency(groupTotals.estimate)}`} sx={{ bgcolor: 'rgba(148,163,184,0.10)', color: '#e2e8f0', height: 22 }} />
                          <Chip size="small" label={`Godkj ${formatCurrency(groupTotals.approved)}`} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe', height: 22 }} />
                          <Chip size="small" label={`Faktisk ${formatCurrency(groupTotals.actual)}`} sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#ddd6fe', height: 22 }} />
                          <Chip size="small" label={`Avvik ${formatVariance(groupVariance)}`} sx={{ bgcolor: groupVarianceTone.bg, color: groupVarianceTone.fg, fontWeight: 700, height: 22 }} />
                        </Stack>
                      </Stack>
                      <Collapse in={!isCollapsed}>
                        <Stack spacing={0.8} sx={{ p: 1, pt: 0 }}>
                          {group.items.map((item) => {
                            const itemVariance = computeVariance(Number(item.approved) || 0, Number(item.actual) || 0);
                            const itemVarTone = varianceColor(itemVariance);
                            return (
                              <Stack
                                key={item.id}
                                direction="column"
                                spacing={1}
                                sx={{ border: '1px solid rgba(148,163,184,0.14)', borderRadius: 1.25, p: 1, background: 'rgba(2,6,23,0.4)' }}
                              >
                                <Stack
                                  direction={{ xs: 'column', md: 'row' }}
                                  spacing={1}
                                  alignItems={{ md: 'center' }}
                                  justifyContent="space-between"
                                >
                                  <Box>
                                    <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{item.item_name}</Typography>
                                    {item.description ? (
                                      <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.8rem' }}>
                                        {item.description}
                                      </Typography>
                                    ) : null}
                                  </Box>
                                  <Stack direction="row" spacing={0.75} flexWrap="wrap">
                                    <Chip size="small" label={`Est ${formatCurrency(Number(item.estimate) || 0)}`} sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#e2e8f0' }} />
                                    <Chip size="small" label={`Godkj ${formatCurrency(Number(item.approved) || 0)}`} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                                    <Chip size="small" label={`Faktisk ${formatCurrency(Number(item.actual) || 0)}`} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                                    <Chip size="small" label={`Avvik ${formatVariance(itemVariance)}`} sx={{ bgcolor: itemVarTone.bg, color: itemVarTone.fg, fontWeight: 700 }} />
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
                            );
                          })}
                        </Stack>
                      </Collapse>
                    </Box>
                  );
                })}
              </Stack>
            )}
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
