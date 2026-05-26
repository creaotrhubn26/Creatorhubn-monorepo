import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HubIcon from '@mui/icons-material/Hub';
import {
  aiCitationApi,
  type AiCitationDashboard,
  type AiCitationQuery,
} from '../../../services/adminRoomApi';

/**
 * AI-citation-tracker — måler om GEO-strategien (14 pillar-sider) faktisk
 * fører til at AI-modeller siterer The Role Room. Sjekker hver registrert
 * query mot Claude og GPT-4 ukentlig (cron i backend) + manuell "Kjør nå"-
 * knapp.
 *
 * Dashbord viser:
 *  - Overall mention-rate
 *  - Per-provider sammenligning (Claude vs GPT-4)
 *  - Per-query rangering (hvilke spørringer vinner i AI-svar)
 *  - 12-ukers timeseries
 */

const CATEGORY_COLORS: Record<string, string> = {
  trust: '#fbbf24',
  compliance: '#a78bfa',
  data: '#22d3ee',
  education: '#34d399',
  brand: '#f472b6',
  casting: '#fb923c',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic_claude: 'Claude Opus 4.7',
  openai_gpt4: 'GPT-4o',
};

export function AiCitationTab() {
  const [dashboard, setDashboard] = useState<AiCitationDashboard | null>(null);
  const [queries, setQueries] = useState<AiCitationQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, q] = await Promise.all([
        aiCitationApi.dashboard(),
        aiCitationApi.listQueries(),
      ]);
      setDashboard(d);
      setQueries(q);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    try {
      const result = await aiCitationApi.run();
      setSnackbar(
        `Ferdig: ${result.totalMentions}/${result.totalChecks} mentions (${Math.round(result.mentionRate * 100)}%) over ${result.queriesChecked} queries`,
      );
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleToggle(query: AiCitationQuery, next: boolean) {
    try {
      await aiCitationApi.toggleQuery(query.id, next);
      setQueries((prev) => prev.map((q) => (q.id === query.id ? { ...q, active: next } : q)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const overall = dashboard?.overall ?? {};
  const totalChecks = overall.total_checks ?? 0;
  const mentions = overall.mentions ?? 0;
  const mentionRate = totalChecks > 0 ? Math.round((mentions / totalChecks) * 100) : 0;
  const urlCitations = overall.url_citations ?? 0;
  const lastCheck = overall.last_check_at
    ? new Date(overall.last_check_at).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <HubIcon sx={{ color: '#22d3ee', fontSize: 26 }} />
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
              AI-citation-tracker — måler GEO-effekten
            </Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem', mt: 0.5 }}>
            Sjekker hver query mot Claude og GPT-4. Er strategien virker hvis vi blir nevnt når noen spør om norsk casting.
            Cron: ukentlig mandag 03:00 CET. Manuell trigger til høyre.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={running ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <PlayArrowIcon />}
          onClick={handleRunNow}
          disabled={running || loading}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#22d3ee', color: '#0a0a0f', '&:hover': { bgcolor: '#06b6d4' } }}
        >
          {running ? 'Kjører sjekk…' : 'Kjør sjekk nå'}
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> : null}
      {snackbar ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSnackbar(null)}>{snackbar}</Alert> : null}

      {/* Overall stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 4 }}>
        <StatCard label="Mention-rate" value={`${mentionRate}%`} accent={mentionRate >= 30 ? '#22c55e' : mentionRate >= 10 ? '#fbbf24' : '#ef4444'} hint={`${mentions} av ${totalChecks} sjekker`} />
        <StatCard label="URL-sitasjoner" value={urlCitations} accent="#a78bfa" hint="theroleroom.com nevnt direkte" />
        <StatCard label="Queries trackes" value={overall.queries_checked ?? 0} accent="#22d3ee" />
        <StatCard label="Providers" value={overall.providers_checked ?? 0} accent="#34d399" />
        <StatCard label="Siste sjekk" value={lastCheck ?? '—'} accent="#fb923c" />
      </Box>

      {/* Per-provider */}
      {dashboard?.perProvider && dashboard.perProvider.length > 0 ? (
        <Paper sx={{ p: 2.5, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)', mb: 3 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', mb: 1.5 }}>
            Sammenligning per AI-modell
          </Typography>
          <Stack spacing={1}>
            {dashboard.perProvider.map((row) => {
              const rate = row.total > 0 ? Math.round((row.mentions / row.total) * 100) : 0;
              return (
                <Stack key={row.provider} direction="row" alignItems="center" spacing={2} sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(34,211,238,0.05)' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', minWidth: 180 }}>
                    {PROVIDER_LABELS[row.provider] ?? row.provider}
                  </Typography>
                  <Box sx={{ flex: 1, position: 'relative', height: 8, bgcolor: 'rgba(148,163,184,0.18)', borderRadius: 4, overflow: 'hidden' }}>
                    <Box sx={{
                      position: 'absolute', top: 0, left: 0, height: '100%',
                      width: `${rate}%`,
                      bgcolor: rate >= 30 ? '#22c55e' : rate >= 10 ? '#fbbf24' : '#ef4444',
                      transition: 'width 0.4s ease',
                    }} />
                  </Box>
                  <Typography sx={{ color: rate >= 30 ? '#86efac' : rate >= 10 ? '#fde68a' : '#fca5a5', fontWeight: 800, fontSize: '0.92rem', minWidth: 70, textAlign: 'right' }}>
                    {rate}% ({row.mentions}/{row.total})
                  </Typography>
                  {row.url_citations > 0 ? (
                    <Chip label={`${row.url_citations} URL`} size="small" sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', fontWeight: 700, fontSize: '0.7rem', height: 20 }} />
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      ) : null}

      {/* Queries-liste med toggle */}
      <Paper sx={{ p: 2.5, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)', mb: 3 }}>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
          Tracked queries ({queries.filter((q) => q.active).length} aktive av {queries.length})
        </Typography>
        <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem', mb: 2 }}>
          Hver aktiv query sjekkes ukentlig mot alle providers. Toggle av for å pause uten å slette.
        </Typography>
        <Stack spacing={0.75}>
          {queries.map((q) => {
            const qStats = dashboard?.perQuery.find((p) => p.id === q.id);
            const qRate = qStats && qStats.total_checks > 0 ? Math.round((qStats.mentions / qStats.total_checks) * 100) : null;
            const color = CATEGORY_COLORS[q.category] ?? '#94a3b8';
            return (
              <Box
                key={q.id}
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: q.active ? 'rgba(34,211,238,0.04)' : 'rgba(15,23,42,0.4)',
                  border: q.active ? '1px solid rgba(34,211,238,0.18)' : '1px solid rgba(148,163,184,0.1)',
                  opacity: q.active ? 1 : 0.55,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Switch
                    size="small"
                    checked={q.active}
                    onChange={(e) => handleToggle(q, e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#22d3ee' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#22d3ee !important' },
                    }}
                  />
                  <Chip
                    label={q.category}
                    size="small"
                    sx={{ bgcolor: `${color}22`, color, fontWeight: 700, fontSize: '0.66rem', height: 18, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                  />
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', flex: 1 }}>
                    {q.query_text}
                  </Typography>
                  {qStats && qStats.total_checks > 0 ? (
                    <Chip
                      label={`${qRate}% (${qStats.mentions}/${qStats.total_checks})`}
                      size="small"
                      sx={{
                        bgcolor: (qRate ?? 0) >= 30 ? 'rgba(34,197,94,0.18)' : (qRate ?? 0) >= 10 ? 'rgba(251,191,36,0.18)' : 'rgba(239,68,68,0.18)',
                        color: (qRate ?? 0) >= 30 ? '#86efac' : (qRate ?? 0) >= 10 ? '#fde68a' : '#fca5a5',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        height: 22,
                      }}
                    />
                  ) : (
                    <Chip
                      label="ikke testet"
                      size="small"
                      sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: 'rgba(203,213,225,0.7)', fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                    />
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {/* 12-ukers timeseries */}
      {dashboard?.timeseries && dashboard.timeseries.length > 0 ? (
        <Paper sx={{ p: 2.5, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.14)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', mb: 1.5 }}>
            12 uker — utvikling av mention-rate
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-end', height: 120 }}>
            {dashboard.timeseries.map((w) => {
              const rate = w.total > 0 ? (w.mentions / w.total) * 100 : 0;
              const week = new Date(w.week_start).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
              return (
                <Stack key={w.week_start} alignItems="center" spacing={0.5} sx={{ flex: 1 }}>
                  <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.66rem', fontWeight: 700 }}>
                    {Math.round(rate)}%
                  </Typography>
                  <Box sx={{
                    width: '100%',
                    height: `${Math.max(rate, 2)}%`,
                    bgcolor: rate >= 30 ? '#22c55e' : rate >= 10 ? '#fbbf24' : 'rgba(239,68,68,0.6)',
                    borderRadius: 0.5,
                    transition: 'height 0.4s ease',
                  }} />
                  <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.62rem' }}>
                    {week}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Paper>
      ) : (
        <Paper sx={{ p: 3, bgcolor: 'rgba(15,23,42,0.4)', border: '1px dashed rgba(148,163,184,0.25)', textAlign: 'center' }}>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem', mb: 1 }}>
            Ingen data ennå — kjør første sjekk for å starte timeseries.
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.78rem' }}>
            Forventet baseline 2026-05: 0-10% mention-rate. Mål Q3 2026: 30%+ mention-rate på brand-queries.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

function StatCard({ label, value, accent, hint }: { label: string; value: string | number; accent: string; hint?: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.5)',
        border: `1px solid ${accent}44`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ color: accent, fontWeight: 800, fontSize: '1.4rem', lineHeight: 1.1, mt: 0.25 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.72rem', mt: 0.25 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

export default AiCitationTab;
