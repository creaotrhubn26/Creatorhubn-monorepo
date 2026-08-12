/**
 * MarketingPlanKpiPanel — render KPI-data for en plan.
 *
 *   #181 Target vs Actual-graf
 *   #183 Auto-foreslå korrigerende handlinger
 *   #184-#187 Aggregering på tvers (pillar/platform/format/tid)
 *   #189 Outlier-deteksjon
 *   #190 Sparkline per metric
 *   #191 Cumulative vs goal
 *   #195 What-if-simulator
 *
 * Henter alt fra /kpi-summary i ett kall. Henter også /kpi-sync som
 * trigger ved klikk på "Synk fra plattformer". Tom-state har "Generer
 * mock-data"-knapp for å validere flyten uten ekte koblinger.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  AutoGraph as GraphIcon,
} from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

interface MarketingPlanKpiPanelProps {
  planId: string;
}

type KpiSummary = NonNullable<Awaited<ReturnType<typeof roleRoomAgentService.fetchKpiSummary>>>;

const MarketingPlanKpiPanel: React.FC<MarketingPlanKpiPanelProps> = ({ planId }) => {
  const { t } = useT();
  const [data, setData] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // #195 — what-if state
  const [whatIfFrequency, setWhatIfFrequency] = useState(5);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await roleRoomAgentService.fetchKpiSummary(planId, 30);
      setData(result);
      if (!result) setError(t('marketingKpi.s010'));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { void load(); }, [load]);

  const handleSync = useCallback(async (): Promise<void> => {
    setSyncing(true);
    try {
      const result = await roleRoomAgentService.syncKpis(planId);
      if (!result) {
        setError(t('marketingKpi.s014'));
      } else if (result.snapshotsWritten === 0 && result.eligiblePosts === 0) {
        setError(t('marketingKpi.s008'));
      } else {
        await load();
      }
    } finally {
      setSyncing(false);
    }
  }, [planId, load]);

  // Sparkline-data per (platform, metric) — siste 14 dager
  const sparklinesByKey = useMemo(() => {
    if (!data) return new Map<string, number[]>();
    const out = new Map<string, Array<{ date: string; value: number }>>();
    for (const snap of data.snapshots) {
      const key = `${snap.platform}|${snap.metric}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push({ date: snap.capturedAt, value: snap.value });
    }
    const numeric = new Map<string, number[]>();
    for (const [key, points] of out) {
      const sorted = points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      numeric.set(key, sorted.slice(-14).map((p) => p.value));
    }
    return numeric;
  }, [data]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 4 }}>
        <CircularProgress size={32} sx={{ color: 'var(--role-cyan, #22d3ee)' }} />
      </Stack>
    );
  }

  if (!data || data.snapshotCount === 0) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.8}>
            <GraphIcon sx={{ color: 'var(--role-cyan, #22d3ee)' }} />
            <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{t('marketingKpi.s009')}</Typography>
          </Stack>
          <Button
            size="small"
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={12} /> : <RefreshIcon />}
            onClick={() => void handleSync()}
            disabled={syncing}
            sx={{ textTransform: 'none' }}
          >
            {syncing ? t('marketingKpi.s017') : t('marketingKpi.s015')}
          </Button>
        </Stack>
        <Alert
          severity="info"
          sx={{ bgcolor: 'rgba(34,211,238,0.08)', color: '#cbd5e1', border: '1px solid rgba(34,211,238,0.24)' }}
        >
          {t('marketingKpi.s007')}
        </Alert>
        {error ? <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert> : null}
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <GraphIcon sx={{ color: 'var(--role-cyan, #22d3ee)' }} />
          <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>{t('marketingKpi.s009')}</Typography>
          <Chip
            size="small"
            label={t('marketingKpi.p03', { v0: data.snapshotCount })}
            sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: '#cbd5e1', height: 18, fontSize: '0.7rem' }}
          />
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={syncing ? <CircularProgress size={12} /> : <RefreshIcon />}
          onClick={() => void handleSync()}
          disabled={syncing}
          sx={{ textTransform: 'none' }}
        >
          {syncing ? t('marketingKpi.s017') : t('marketingKpi.s016')}
        </Button>
      </Stack>

      {/* #181 — Target vs Actual per metric */}
      {data.targets.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.86rem', mb: 0.8 }}>
            Target vs Actual
          </Typography>
          <Stack spacing={0.8}>
            {data.targets.map((t) => {
              // Beregn snitt actual fra platform-aggregat
              const actuals = data.aggregates.byPlatform
                .map((b) => b.avgByMetric[t.metric])
                .filter((v): v is number => typeof v === 'number');
              const actual = actuals.length > 0 ? actuals.reduce((a, b) => a + b, 0) / actuals.length : 0;
              const ratio = t.target > 0 ? actual / t.target : 0;
              const pct = Math.min(150, Math.round(ratio * 100));
              const color = ratio >= 1 ? '#34d399' : ratio >= 0.8 ? '#fbbf24' : '#f87171';
              return (
                <Box key={t.metric}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 600 }}>
                      {t.metric.replace(/_/g, ' ')} <Typography component="span" sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem' }}>/ {t.per}</Typography>
                    </Typography>
                    <Typography sx={{ color, fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700 }}>
                      {Math.round(actual)} / {t.target} ({pct}%)
                    </Typography>
                  </Stack>
                  <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: 'rgba(148,163,184,0.18)', overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, pct)}%`, bgcolor: color }} />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      {/* #190 — sparklines per (platform, metric) */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.86rem', mb: 0.8 }}>
          {t('marketingKpi.s011')}
        </Typography>
        <Stack spacing={0.6}>
          {data.summary.map((m) => {
            const sparkData = sparklinesByKey.get(`${m.platform}|${m.metric}`) ?? [];
            const max = Math.max(1, ...sparkData);
            const points = sparkData.map((v, i) => {
              const x = (i / Math.max(1, sparkData.length - 1)) * 100;
              const y = 100 - (v / max) * 100;
              return `${x},${y}`;
            }).join(' ');
            return (
              <Stack
                key={`${m.platform}-${m.metric}`}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ p: 0.6, borderRadius: 1, bgcolor: 'rgba(15,23,42,0.4)' }}
              >
                <Box sx={{ minWidth: 110 }}>
                  <Typography sx={{ color: '#f8fafc', fontSize: '0.78rem', fontWeight: 600 }}>
                    {m.metric.replace(/_/g, ' ')}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.66rem' }}>{m.platform}</Typography>
                </Box>
                {sparkData.length > 0 ? (
                  <Box sx={{ width: 100, height: 28, flexShrink: 0 }}>
                    <svg width="100" height="28" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </Box>
                ) : null}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.round(m.latestValue).toLocaleString('nb-NO')}
                </Typography>
                {m.deltaPct !== null ? (
                  <Tooltip title={t('marketingKpi.p02', { v0: m.previousValue ?? '?' })}>
                    <Stack direction="row" alignItems="center" spacing={0.2}>
                      {m.deltaPct >= 0 ? (
                        <TrendingUpIcon sx={{ color: '#34d399', fontSize: 14 }} />
                      ) : (
                        <TrendingDownIcon sx={{ color: '#f87171', fontSize: 14 }} />
                      )}
                      <Typography sx={{ color: m.deltaPct >= 0 ? '#34d399' : '#f87171', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {m.deltaPct >= 0 ? '+' : ''}{m.deltaPct}%
                      </Typography>
                    </Stack>
                  </Tooltip>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </Box>

      {/* #183 — auto-foreslå korrigeringer */}
      {data.corrections.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.86rem', mb: 0.6 }}>
            {t('marketingKpi.s002')}
          </Typography>
          <Stack spacing={0.6}>
            {data.corrections.map((c) => {
              const Icon = c.severity === 'critical' ? WarningIcon : c.severity === 'warning' ? WarningIcon : CheckIcon;
              const color = c.severity === 'critical' ? '#f87171' : c.severity === 'warning' ? '#fbbf24' : '#60a5fa';
              return (
                <Box key={c.id} sx={{ p: 0.8, borderRadius: 1.2, bgcolor: `${color}11`, border: `1px solid ${color}33` }}>
                  <Stack direction="row" spacing={0.6} alignItems="flex-start">
                    <Icon sx={{ color, fontSize: 16, mt: 0.2, flexShrink: 0 }} />
                    <Stack spacing={0.2} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: '#f8fafc', fontSize: '0.82rem', fontWeight: 700 }}>{c.title}</Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.74rem', lineHeight: 1.4 }}>
                        {c.detail}
                      </Typography>
                      <Typography sx={{ color, fontSize: '0.7rem', fontStyle: 'italic' }}>
                        → {c.actionHint}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}

      {/* #189 — outliers */}
      {data.outliers.length > 0 ? (
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.86rem', mb: 0.6 }}>
            {t('marketingKpi.s012')}
          </Typography>
          <Stack spacing={0.4}>
            {data.outliers.slice(0, 5).map((o) => (
              <Box key={o.postId} sx={{ p: 0.6, borderRadius: 1, bgcolor: 'rgba(15,23,42,0.4)' }}>
                <Stack direction="row" alignItems="center" spacing={0.6}>
                  <Chip
                    size="small"
                    label={o.kind === 'winner' ? t('marketingKpi.p01', { v0: o.zScore }) : t('marketingKpi.p00', { v0: o.zScore })}
                    sx={{
                      bgcolor: o.kind === 'winner' ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)',
                      color: o.kind === 'winner' ? '#bbf7d0' : '#fecaca',
                      height: 18,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  />
                  <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.74rem', flex: 1 }}>
                    {o.recommendation}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      {/* #184-#187 — aggregater på tvers */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.86rem', mb: 0.6 }}>
          {t('marketingKpi.s013')}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
          {(['byPillar', 'byPlatform', 'byFormat', 'byTimeWindow'] as const).map((dimensionKey) => {
            const buckets = data.aggregates[dimensionKey];
            if (buckets.length === 0) return null;
            const label = dimensionKey === 'byPillar' ? 'Pillar'
              : dimensionKey === 'byPlatform' ? 'Platform'
              : dimensionKey === 'byFormat' ? 'Format' : t('marketingKpi.s018');
            return (
              <Box key={dimensionKey} sx={{ flex: '1 1 200px', p: 0.8, borderRadius: 1.2, bgcolor: 'rgba(15,23,42,0.4)', minWidth: 0 }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', mb: 0.3 }}>{label}</Typography>
                <Stack spacing={0.2}>
                  {buckets.slice(0, 4).map((b) => (
                    <Stack key={b.key} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ color: '#f8fafc', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.label}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.65)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        {b.postCount}p · {b.snapshotCount}s
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* #195 — What-if-simulator */}
      <Divider sx={{ my: 1.4, borderColor: 'rgba(148,163,184,0.18)' }} />
      <Box>
        <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.86rem', mb: 0.4 }}>
          {t('marketingKpi.s019')}
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem', mb: 0.8 }}>
          {t('marketingKpi.s004')}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ color: '#f8fafc', fontSize: '0.78rem' }}>{t('marketingKpi.s006')}</Typography>
          <input
            type="range"
            min={1}
            max={10}
            value={whatIfFrequency}
            onChange={(e) => setWhatIfFrequency(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--role-cyan, #22d3ee)' }}
          />
          <Typography sx={{ color: 'var(--role-cyan, #22d3ee)', fontFamily: 'monospace', fontWeight: 700, minWidth: 40 }}>
            {whatIfFrequency}{t('marketingKpi.s001')}
          </Typography>
        </Stack>
        {(() => {
          // Tar gjennomsnitt impressions per post fra platform-aggregat
          const allImpressionsAvg = data.aggregates.byPlatform
            .map((b) => b.avgByMetric['impressions'] ?? 0)
            .filter((v) => v > 0);
          const avgPerPost = allImpressionsAvg.length > 0
            ? allImpressionsAvg.reduce((a, b) => a + b, 0) / allImpressionsAvg.length
            : 0;
          const projectedWeekly = Math.round(avgPerPost * whatIfFrequency);
          const projectedMonthly = projectedWeekly * 4;
          return (
            <Box sx={{ mt: 0.8, p: 0.8, borderRadius: 1, bgcolor: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.24)' }}>
              <Typography sx={{ color: '#a5f3fc', fontSize: '0.82rem' }}>
                {t('marketingKpi.s005')} <strong>{projectedWeekly.toLocaleString('nb-NO')}{t('marketingKpi.s001')}</strong> · <strong>{projectedMonthly.toLocaleString('nb-NO')}{t('marketingKpi.s000')}</strong>
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem', mt: 0.2 }}>
                {t('marketingKpi.s003')} {allImpressionsAvg.length} {t('marketingKpi.s020')} {whatIfFrequency} {t('marketingKpi.s021')}
              </Typography>
            </Box>
          );
        })()}
      </Box>

      {error ? <Alert severity="warning" sx={{ mt: 1 }}>{error}</Alert> : null}
    </Box>
  );
};

export default MarketingPlanKpiPanel;
