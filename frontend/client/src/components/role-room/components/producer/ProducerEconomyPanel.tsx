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
  LinearProgress,
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
import { useSnackbar } from 'notistack';
import { useProducerEconomy } from '../../hooks/useProducerEconomy';
import type { ProducerPhase } from '../../services/producerWorkflowService';
import { getProducerEconomyStatusLabel } from '../../utils/producerWorkflow';
import { describeProducerError } from '../../utils/producerErrorMessage';
import BudgetCategoryPicker from './BudgetCategoryPicker';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

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

const buildPHASE_LABELS = (t: TFn): Record<ProducerPhase, string> => ({
  preproduction: t('prodEconomy.s017'),
  production: t('prodEconomy.s018'),
  postproduction: t('prodEconomy.s016'),
});

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
  title,
  readOnly = false,
  canSendBudgetReview = true,
  onSendBudgetReview,
  contractsPanel,
  focusedPhase = 'all',
  onFocusedPhaseChange,
}: ProducerEconomyPanelProps) {
  const { t } = useT();
  const PHASE_LABELS = useMemo(() => buildPHASE_LABELS(t), [t]);
  const { items, totals, loading, error, createItem, updateItem, removeItem } = useProducerEconomy(projectId);
  const { enqueueSnackbar } = useSnackbar();

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
        const cat = (item.category ?? '').trim() || t('prodEconomy.s023');
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
    try {
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
      enqueueSnackbar(t('prodEconomy.s003'), { variant: 'success' });
    } catch (createError) {
      // Behold feltene så Stig ikke mister det han skrev, og forklar hva som skjedde.
      enqueueSnackbar(describeProducerError(createError, t('prodEconomy.s026')), { variant: 'error' });
    }
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
      enqueueSnackbar(t('prodEconomy.s002'), { variant: 'success' });
    } catch (saveError) {
      // Hold linjen «dirty» så Stig ser at den ikke ble lagret og kan prøve igjen.
      enqueueSnackbar(describeProducerError(saveError, t('prodEconomy.s025')), { variant: 'error' });
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
      enqueueSnackbar(t('prodEconomy.s004'), { variant: 'success' });
    } catch (deleteError) {
      enqueueSnackbar(describeProducerError(deleteError, t('prodEconomy.s029')), { variant: 'error' });
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
            {title ?? t('prodEconomy.title')}
          </Typography>
        </Stack>
      </Stack>

      {/* Sammendrags-band: budsjettets tre stadier (estimert → godkjent →
          faktisk) med tydelig hierarki og forbruksbar, i stedet for en
          kram chip-rekke. Leses på ett blikk før linjene under. */}
      {(() => {
        const utilPct = totals.approved > 0
          ? Math.min(100, (totals.actual / totals.approved) * 100)
          : 0;
        const overApproved = totals.actual > totals.approved && totals.approved > 0;
        const variancePct = totals.approved > 0
          ? ((totals.actual - totals.approved) / totals.approved) * 100
          : null;
        const stat = (label: string, value: number, fg: string, sub?: string) => (
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </Typography>
            <Typography sx={{ color: fg, fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(value)}
            </Typography>
            {sub ? (
              <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.68rem' }}>{sub}</Typography>
            ) : null}
          </Box>
        );
        return (
          <Box
            sx={{
              p: { xs: 1.2, md: 1.5 },
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              bgcolor: 'rgba(2,6,23,0.45)',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} divider={<Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(148,163,184,0.14)', display: { xs: 'none', sm: 'block' } }} />}>
              {stat(t('prodEconomy.s005'), totals.estimate, '#86efac')}
              {stat(t('prodEconomy.s010'), totals.approved, 'var(--role-cyan, #7dd3fc)')}
              {stat(t('prodEconomy.s006'), totals.actual, overApproved ? '#fca5a5' : '#fde68a')}
              <Box sx={{ flex: 1, minWidth: 120 }}>
                <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('prodEconomy.s001')}
                </Typography>
                <Typography sx={{ color: variance >= 0 ? '#86efac' : '#fca5a5', fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
                  {`${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`}
                </Typography>
                <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.68rem' }}>
                  {variancePct === null ? t('prodEconomy.s024') : `${variancePct > 0 ? '+' : ''}${variancePct.toFixed(1)} % ${variance >= 0 ? t('prodEconomy.s030') : t('prodEconomy.s027')}`}
                </Typography>
              </Box>
            </Stack>
            {totals.approved > 0 ? (
              <Box sx={{ mt: 1.2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.7rem' }}>
                    {t('prodEconomy.s009')}
                  </Typography>
                  <Typography sx={{ color: overApproved ? '#fca5a5' : '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {`${Math.round((totals.actual / totals.approved) * 100)} %`}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={utilPct}
                  sx={{
                    height: 7,
                    borderRadius: 4,
                    bgcolor: 'rgba(148,163,184,0.16)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      bgcolor: overApproved ? '#f87171' : utilPct > 85 ? '#fbbf24' : '#34d399',
                    },
                  }}
                />
              </Box>
            ) : null}
          </Box>
        );
      })()}

      {showBudgetReviewAction && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            size="large"
            onClick={onSendBudgetReview}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '1.02rem',
              px: 2.6,
              py: 1.1,
              minHeight: 52,
              borderRadius: 2.5,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(139,92,246,0.35)',
              '&:hover': { background: 'linear-gradient(135deg, #7c4ff0 0%, #5457e0 100%)' },
            }}
          >
            {t('prodEconomy.s019')}
          </Button>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!readOnly && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ lg: 'flex-end' }}>
          <Box sx={{ minWidth: 180 }}>
            <Typography sx={{ color: 'rgba(226,232,240,0.8)', mb: 0.5, fontSize: '0.85rem' }}>{t('prodEconomy.s007')}</Typography>
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
            label={t('prodEconomy.s013')}
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <TextField
            size="small"
            label={t('prodEconomy.s005')}
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            sx={{ width: 140 }}
            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
          />
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => { void handleCreate(); }}
            disabled={loading || !category.trim() || !itemName.trim()}
            sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.4)', fontWeight: 700, textTransform: 'none', minWidth: 140, '&:hover': { borderColor: 'rgba(148,163,184,0.7)', background: 'rgba(148,163,184,0.08)' } }}
          >
            {t('prodEconomy.s015')}
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
          {t('prodEconomy.s000')}
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
                <Chip size="small" label={t('prodEconomy.p01', { v0: formatCurrency(phaseTotals[phaseKey].estimate) })} sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#e2e8f0' }} />
                <Chip size="small" label={t('prodEconomy.p04', { v0: formatCurrency(phaseTotals[phaseKey].approved) })} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                <Chip size="small" label={t('prodEconomy.p02', { v0: formatCurrency(phaseTotals[phaseKey].actual) })} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                {(() => {
                  const v = computeVariance(phaseTotals[phaseKey].approved, phaseTotals[phaseKey].actual);
                  const tone = varianceColor(v);
                  return <Chip size="small" label={t('prodEconomy.p00', { v0: formatVariance(v) })} sx={{ bgcolor: tone.bg, color: tone.fg, fontWeight: 700 }} />;
                })()}
              </Stack>
            </Stack>
            {grouped[phaseKey].length === 0 ? (
              <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.9rem' }}>{t('prodEconomy.s011')}</Typography>
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
                            label={t('prodEconomy.p05', { v0: group.items.length, v1: group.items.length === 1 ? '' : t('prodEconomy.s028') })}
                            sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1', height: 22 }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.6} flexWrap="wrap">
                          <Chip size="small" label={`Est ${formatCurrency(groupTotals.estimate)}`} sx={{ bgcolor: 'rgba(148,163,184,0.10)', color: '#e2e8f0', height: 22 }} />
                          <Chip size="small" label={t('prodEconomy.p03', { v0: formatCurrency(groupTotals.approved) })} sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe', height: 22 }} />
                          <Chip size="small" label={t('prodEconomy.p02', { v0: formatCurrency(groupTotals.actual) })} sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#ddd6fe', height: 22 }} />
                          <Chip size="small" label={t('prodEconomy.p00', { v0: formatVariance(groupVariance) })} sx={{ bgcolor: groupVarianceTone.bg, color: groupVarianceTone.fg, fontWeight: 700, height: 22 }} />
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
                                    <Chip size="small" label={t('prodEconomy.p03', { v0: formatCurrency(Number(item.approved) || 0) })} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                                    <Chip size="small" label={t('prodEconomy.p02', { v0: formatCurrency(Number(item.actual) || 0) })} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                                    <Chip size="small" label={t('prodEconomy.p00', { v0: formatVariance(itemVariance) })} sx={{ bgcolor: itemVarTone.bg, color: itemVarTone.fg, fontWeight: 700 }} />
                                    <Chip size="small" label={getProducerEconomyStatusLabel(item.status)} />
                                    <Chip
                                      size="small"
                                      label={item.client_visible ? t('prodEconomy.s021') : t('prodEconomy.s020')}
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
                          label={t('prodEconomy.s005')}
                          value={draftsById[item.id]?.estimate ?? String(item.estimate ?? 0)}
                          onChange={(event) => handleDraftChange(item.id, { estimate: event.target.value })}
                          sx={{ width: { xs: '100%', md: 130 } }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <TextField
                          size="small"
                          label={t('prodEconomy.s010')}
                          value={draftsById[item.id]?.approved ?? String(item.approved ?? 0)}
                          onChange={(event) => handleDraftChange(item.id, { approved: event.target.value })}
                          sx={{ width: { xs: '100%', md: 130 } }}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <TextField
                          size="small"
                          label={t('prodEconomy.s006')}
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
                          label={t('prodEconomy.s012')}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { void handleSaveItem(item.id); }}
                          disabled={loading || savingItemId === item.id || !draftsById[item.id]?.dirty}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          {t('prodEconomy.s014')}
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
                          {t('prodEconomy.s008')}
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
              {t('prodEconomy.s022')}
            </Typography>
            {contractsPanel}
          </Box>
        </>
      ) : null}
    </Box>
  );
}
