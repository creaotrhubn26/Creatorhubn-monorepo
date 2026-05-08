/**
 * EconomyCashflowPanel
 *
 * Cashflow-fremvisning for budsjett: kumulativ estimat / godkjent / faktisk
 * over tid, samt netto månedlig forbruk. Bruker linjer fra
 * useProducerEconomy + utgifter fra role_room_expenses (hvis tilgjengelige
 * via en egen rute) — for nå limt sammen fra budget-items kun, siden
 * expenses-routen ikke har et getAll-endepunkt enda. Når brukeren mangler
 * faktisk-data viser komponenten kun estimat-kurven.
 */

import { useMemo } from 'react';
import {
  Alert,
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useProducerEconomy } from '../../hooks/useProducerEconomy';

interface EconomyCashflowPanelProps {
  projectId: string;
}

const PHASE_LABELS: Record<string, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export default function EconomyCashflowPanel({ projectId }: EconomyCashflowPanelProps) {
  const { items, loading, error } = useProducerEconomy(projectId);

  // Bygg en tidsserie pr. uke basert på item.created_at som proxy for
  // forpliktelse-tidspunkt. Estimat akkumulerer fra opprettelse, faktisk
  // akkumulerer fra updated_at hvis actual > 0. Dette er en visualisering
  // for "når ble penger forpliktet vs brukt", ikke en finansiell
  // prognose — markeres tydelig i UI.
  const series = useMemo(() => {
    if (!items || items.length === 0) return [];

    const buckets = new Map<string, { date: string; estimate: number; approved: number; actual: number }>();
    const toNum = (v: string | number) => (typeof v === 'number' ? v : Number.parseFloat(v) || 0);

    for (const item of items) {
      const createdDate = item.created_at ? new Date(item.created_at) : new Date();
      // Bucket per uke (mandag-start).
      const monday = new Date(createdDate);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const key = monday.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, { date: key, estimate: 0, approved: 0, actual: 0 });
      }
      const bucket = buckets.get(key)!;
      bucket.estimate += toNum(item.estimate);
      bucket.approved += toNum(item.approved);
      bucket.actual += toNum(item.actual);
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
    // Kumulativ akkumulering
    let estimateAcc = 0;
    let approvedAcc = 0;
    let actualAcc = 0;
    return sorted.map((bucket) => {
      estimateAcc += bucket.estimate;
      approvedAcc += bucket.approved;
      actualAcc += bucket.actual;
      return {
        date: bucket.date,
        estimate: estimateAcc,
        approved: approvedAcc,
        actual: actualAcc,
        weeklyEstimate: bucket.estimate,
        weeklyActual: bucket.actual,
      };
    });
  }, [items]);

  const totals = useMemo(() => {
    if (!items || items.length === 0) return { estimate: 0, approved: 0, actual: 0 };
    const toNum = (v: string | number) => (typeof v === 'number' ? v : Number.parseFloat(v) || 0);
    return items.reduce(
      (sum, item) => ({
        estimate: sum.estimate + toNum(item.estimate),
        approved: sum.approved + toNum(item.approved),
        actual: sum.actual + toNum(item.actual),
      }),
      { estimate: 0, approved: 0, actual: 0 },
    );
  }, [items]);

  const phaseDistribution = useMemo(() => {
    if (!items || items.length === 0) return [];
    const map = new Map<string, { phase: string; estimate: number; actual: number }>();
    const toNum = (v: string | number) => (typeof v === 'number' ? v : Number.parseFloat(v) || 0);
    for (const item of items) {
      const key = item.phase ?? 'unknown';
      if (!map.has(key)) map.set(key, { phase: key, estimate: 0, actual: 0 });
      const bucket = map.get(key)!;
      bucket.estimate += toNum(item.estimate);
      bucket.actual += toNum(item.actual);
    }
    return Array.from(map.values());
  }, [items]);

  if (loading && items.length === 0) {
    return <Alert severity="info">Laster cashflow-data…</Alert>;
  }

  if (error) {
    return <Alert severity="error">Kunne ikke laste cashflow: {String(error)}</Alert>;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          Cashflow vises når du har opprettet budsjett-linjer i Linjer-fanen. Tidsserien grupperer per uke
          basert på når linjen ble opprettet, og viser kumulativ utvikling for estimat, godkjent og faktisk.
        </Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* KPI-stripe */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {[
          { label: 'Estimat', value: totals.estimate, tone: 'rgba(148,163,184,0.18)', fg: '#e2e8f0' },
          { label: 'Godkjent', value: totals.approved, tone: 'rgba(59,130,246,0.18)', fg: '#bfdbfe' },
          { label: 'Faktisk', value: totals.actual, tone: 'rgba(168,85,247,0.18)', fg: '#ddd6fe' },
          {
            label: 'Avvik',
            value: totals.approved > 0 ? ((totals.actual - totals.approved) / totals.approved) * 100 : 0,
            tone:
              totals.approved === 0
                ? 'rgba(148,163,184,0.16)'
                : totals.actual <= totals.approved
                  ? 'rgba(74,222,128,0.16)'
                  : (totals.actual - totals.approved) / totals.approved <= 0.1
                    ? 'rgba(251,191,36,0.18)'
                    : 'rgba(248,113,113,0.18)',
            fg: totals.actual <= totals.approved ? '#86efac' : '#fca5a5',
            isPercent: true,
          },
        ].map((card) => (
          <Box
            key={card.label}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.16)',
              background: card.tone,
            }}
          >
            <Typography sx={{ color: card.fg, fontSize: '0.78rem', fontWeight: 700, mb: 0.4, opacity: 0.86 }}>
              {card.label}
            </Typography>
            <Typography sx={{ color: card.fg, fontWeight: 800, fontSize: '1.2rem' }}>
              {card.isPercent
                ? `${card.value > 0 ? '+' : ''}${card.value.toFixed(1)}%`
                : `${formatCurrency(card.value)} NOK`}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Kumulativ cashflow */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.16)',
          background: 'rgba(15,23,42,0.66)',
        }}
      >
        <Typography sx={{ color: '#fff', fontWeight: 800, mb: 0.5 }}>
          Kumulativ utvikling
        </Typography>
        <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.84rem', mb: 1.2 }}>
          Tidsserien grupperer pr. uke fra første budsjett-linje til siste. Forskjellen mellom Godkjent og
          Faktisk viser hvor mye av rammen som faktisk har blitt brukt.
        </Typography>
        <Box sx={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
              <XAxis dataKey="date" stroke="rgba(203,213,225,0.7)" fontSize={12} />
              <YAxis
                stroke="rgba(203,213,225,0.7)"
                fontSize={12}
                tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
              />
              <RechartsTooltip
                contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.3)', color: '#e2e8f0' }}
                formatter={(value, name) => [`${formatCurrency(Number(value) || 0)} NOK`, String(name)]}
              />
              <Legend />
              <Area type="monotone" dataKey="estimate" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.18} name="Estimat" />
              <Area type="monotone" dataKey="approved" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.22} name="Godkjent" />
              <Area type="monotone" dataKey="actual" stroke="#a855f7" fill="#a855f7" fillOpacity={0.32} name="Faktisk" />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {/* Per-fase fordeling */}
      {phaseDistribution.length > 0 ? (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.16)',
            background: 'rgba(15,23,42,0.66)',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
            Estimat vs faktisk per fase
          </Typography>
          <Stack spacing={1}>
            {phaseDistribution.map((p) => {
              const variance = p.estimate > 0 ? ((p.actual - p.estimate) / p.estimate) * 100 : null;
              const tone =
                variance === null
                  ? 'rgba(148,163,184,0.16)'
                  : variance <= 0
                    ? 'rgba(74,222,128,0.16)'
                    : variance <= 10
                      ? 'rgba(251,191,36,0.18)'
                      : 'rgba(248,113,113,0.18)';
              const fg =
                variance === null
                  ? '#cbd5e1'
                  : variance <= 0
                    ? '#86efac'
                    : variance <= 10
                      ? '#fde68a'
                      : '#fca5a5';
              return (
                <Stack
                  key={p.phase}
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ p: 1, borderRadius: 1.25, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.4)' }}
                >
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                    {PHASE_LABELS[p.phase] ?? p.phase}
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap">
                    <Chip size="small" label={`Est ${formatCurrency(p.estimate)} NOK`} sx={{ bgcolor: 'rgba(148,163,184,0.12)', color: '#e2e8f0' }} />
                    <Chip size="small" label={`Faktisk ${formatCurrency(p.actual)} NOK`} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#ddd6fe' }} />
                    <Chip
                      size="small"
                      label={`Avvik ${variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`}`}
                      sx={{ bgcolor: tone, color: fg, fontWeight: 700 }}
                    />
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
