/**
 * ClientAdsDiagnosticsPanel.tsx
 *
 * N2-B6 — Monitoring + Diagnostics for klient-ads-tracking.
 *
 * Viser produsenten:
 *   - Hovedtall: events siste 24t/7d/30d
 *   - Delivery-rate (sendt til Google Ads OK vs feilet)
 *   - Per-action health (green/yellow/red m/ grunn)
 *   - Siste 20 events m/ status-chip
 *   - Top failures siste 48t
 *
 * Auto-refresh hvert 30s når panelet er åpent.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress,
  IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';

interface Diagnostics {
  configId: string;
  generatedAt: string;
  windowCounts: { last_24h: number; last_7d: number; last_30d: number };
  delivery: {
    total_attempted: number; delivered_to_google: number; failed: number;
    successRate: number;
    lastFailureAt: string | null; lastFailureMessage: string | null;
  };
  actionsHealth: Array<{
    action_id: string | null;
    action_name: string;
    display_name: string | null;
    is_active: boolean;
    google_ads_label: string | null;
    fired_24h: number; fired_7d: number; fired_30d: number;
    last_fired_at: string | null;
    days_since_fired: number | null;
    health: 'green' | 'yellow' | 'red' | 'inactive';
    healthReason: string;
  }>;
  recentEvents: Array<{
    id: string;
    action_name: string;
    event_value: number | null;
    currency: string | null;
    sent_to_google_ads: boolean;
    google_ads_error: string | null;
    transaction_id: string | null;
    created_at: string;
  }>;
  topFailures: Array<{ error: string; count: number; first_seen: string; last_seen: string }>;
}

const HEALTH_META = {
  green: { color: '#34d399', bg: 'rgba(52,211,153,0.18)', icon: CheckCircleOutlineIcon, label: 'OK' },
  yellow: { color: '#fbbf24', bg: 'rgba(251,191,36,0.18)', icon: WarningAmberOutlinedIcon, label: 'ADVARSEL' },
  red: { color: '#f87171', bg: 'rgba(248,113,113,0.18)', icon: ErrorOutlineOutlinedIcon, label: 'KRITISK' },
  inactive: { color: '#8b7ec4', bg: 'rgba(139,126,196,0.18)', icon: CancelOutlinedIcon, label: 'INAKTIV' },
};

const palette = {
  bg: '#150b2e',
  bgSubtle: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#c084fc',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'akkurat nå';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  return `${days} d siden`;
}

export default function ClientAdsDiagnosticsPanel({
  configId,
}: { configId: string }) {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/role-room/ads-configs/${configId}/diagnostics`, {
        credentials: 'include',
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [configId]);

  useEffect(() => {
    fetchDiagnostics();
    const id = setInterval(fetchDiagnostics, 30_000);
    return () => clearInterval(id);
  }, [fetchDiagnostics]);

  if (loading) {
    return (
      <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: palette.accent }} />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
        <CardContent>
          <Alert severity="warning">{error ?? 'Ingen diagnostikk tilgjengelig'}</Alert>
        </CardContent>
      </Card>
    );
  }

  // Overall health
  const redCount = data.actionsHealth.filter((a) => a.health === 'red').length;
  const yellowCount = data.actionsHealth.filter((a) => a.health === 'yellow').length;
  const overallHealth = redCount > 0 ? 'red' : yellowCount > 0 ? 'yellow' : 'green';
  const overallMeta = HEALTH_META[overallHealth];

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.4 }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.4,
              bgcolor: overallMeta.bg,
              border: `1px solid ${overallMeta.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MonitorHeartOutlinedIcon sx={{ color: overallMeta.color, fontSize: 22 }} />
            </Box>
            <Stack>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: palette.textPrimary }}>
                Diagnostikk
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                Live monitoring av konvertering-tracking
              </Typography>
            </Stack>
            <Chip
              icon={<overallMeta.icon sx={{ color: `${overallMeta.color} !important`, fontSize: 14 }} />}
              label={overallMeta.label}
              size="small"
              sx={{ bgcolor: overallMeta.bg, color: overallMeta.color, fontWeight: 700, fontSize: '0.72rem' }}
            />
          </Stack>
          <Tooltip title="Oppdater">
            <IconButton size="small" onClick={fetchDiagnostics} sx={{ color: palette.textSecondary }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Window-counts */}
        <Stack direction="row" spacing={1.4} sx={{ mb: 2 }}>
          {[
            { label: 'Siste 24t', value: data.windowCounts.last_24h, color: '#c084fc' },
            { label: 'Siste 7 dager', value: data.windowCounts.last_7d, color: '#60a5fa' },
            { label: 'Siste 30 dager', value: data.windowCounts.last_30d, color: '#34d399' },
            {
              label: 'Suksess-rate',
              value: `${data.delivery.successRate}%`,
              color: data.delivery.successRate >= 95 ? '#34d399'
                : data.delivery.successRate >= 80 ? '#fbbf24'
                : '#f87171',
            },
          ].map((k) => (
            <Box key={k.label} sx={{
              flex: 1, p: 1.6, borderRadius: 1.4,
              bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
            }}>
              <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {k.label}
              </Typography>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: k.color, lineHeight: 1.1, mt: 0.4 }}>
                {k.value}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Delivery */}
        {data.delivery.total_attempted > 0 && (
          <Box sx={{ p: 1.6, mb: 2, borderRadius: 1.4, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: palette.textPrimary, mb: 0.8 }}>
              Leveranse-rate (30 dager)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                size="small" label={`${data.delivery.delivered_to_google} OK`}
                sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700, fontSize: '0.72rem' }}
              />
              <Chip
                size="small" label={`${data.delivery.failed} feilet`}
                sx={{ bgcolor: 'rgba(248,113,113,0.18)', color: '#f87171', fontWeight: 700, fontSize: '0.72rem' }}
              />
            </Stack>
            {data.delivery.lastFailureMessage && (
              <Typography sx={{ fontSize: '0.74rem', color: '#f87171', mt: 0.8 }}>
                Siste feil: {data.delivery.lastFailureMessage.slice(0, 200)}
                {data.delivery.lastFailureAt && ` (${formatRelative(data.delivery.lastFailureAt)})`}
              </Typography>
            )}
          </Box>
        )}

        {/* Per-action health */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: palette.textPrimary, mb: 1.2 }}>
            Action-helse
          </Typography>
          {data.actionsHealth.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
              Ingen actions konfigurert. Provisjon i Setup-fanen.
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {data.actionsHealth.map((a) => {
                const meta = HEALTH_META[a.health];
                return (
                  <Box key={a.action_name} sx={{
                    p: 1.4, borderRadius: 1.2,
                    bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
                    display: 'flex', alignItems: 'center', gap: 1.4,
                  }}>
                    <meta.icon sx={{ color: meta.color, fontSize: 20 }} />
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.8}>
                        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: palette.textPrimary }}>
                          {a.display_name || a.action_name}
                        </Typography>
                        <Chip
                          size="small" label={meta.label}
                          sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: '0.66rem', height: 18 }}
                        />
                        {!a.google_ads_label && (
                          <Chip
                            size="small" label="MANGLER LABEL"
                            sx={{ bgcolor: 'rgba(248,113,113,0.18)', color: '#f87171', fontWeight: 700, fontSize: '0.62rem', height: 18 }}
                          />
                        )}
                      </Stack>
                      <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted }}>
                        {a.healthReason} · 24t: {a.fired_24h} · 7d: {a.fired_7d} · 30d: {a.fired_30d}
                      </Typography>
                    </Stack>
                    {a.last_fired_at && (
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted, whiteSpace: 'nowrap' }}>
                        Sist {formatRelative(a.last_fired_at)}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Top failures */}
        {data.topFailures.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: '#f87171', mb: 1.2 }}>
              Top feilmeldinger (siste 48t)
            </Typography>
            <Stack spacing={0.6}>
              {data.topFailures.map((f, i) => (
                <Box key={i} sx={{
                  p: 1.2, borderRadius: 1,
                  bgcolor: 'rgba(248,113,113,0.06)',
                  border: '1px solid rgba(248,113,113,0.28)',
                }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: '#f87171', fontWeight: 600, flex: 1 }}>
                      {f.error}
                    </Typography>
                    <Chip
                      size="small" label={`${f.count}x`}
                      sx={{ bgcolor: 'rgba(248,113,113,0.28)', color: '#f87171', fontWeight: 700, fontSize: '0.66rem', height: 18 }}
                    />
                  </Stack>
                  <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted }}>
                    {formatRelative(f.first_seen)} → {formatRelative(f.last_seen)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Recent events */}
        {data.recentEvents.length > 0 && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: palette.textPrimary, mb: 1.2 }}>
              Siste events
            </Typography>
            <Stack spacing={0.6}>
              {data.recentEvents.slice(0, 10).map((e) => (
                <Box key={e.id} sx={{
                  p: 1, borderRadius: 1,
                  bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
                  display: 'flex', alignItems: 'center', gap: 1,
                }}>
                  {e.sent_to_google_ads
                    ? <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 16 }} />
                    : e.google_ads_error
                      ? <ErrorOutlineOutlinedIcon sx={{ color: '#f87171', fontSize: 16 }} />
                      : <WarningAmberOutlinedIcon sx={{ color: '#fbbf24', fontSize: 16 }} />
                  }
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: palette.textPrimary }}>
                      {e.action_name}
                      {e.event_value !== null && (
                        <Box component="span" sx={{ color: palette.accent, ml: 0.6 }}>
                          {e.event_value.toLocaleString('nb-NO')} {e.currency}
                        </Box>
                      )}
                    </Typography>
                    {e.google_ads_error && (
                      <Typography sx={{ fontSize: '0.7rem', color: '#f87171' }}>
                        {e.google_ads_error.slice(0, 120)}
                      </Typography>
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted, whiteSpace: 'nowrap' }}>
                    {formatRelative(e.created_at)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Typography sx={{ fontSize: '0.68rem', color: palette.textMuted, mt: 2, textAlign: 'right' }}>
          Auto-oppdaterer hvert 30s · Sist {new Date(data.generatedAt).toLocaleTimeString('nb-NO')}
        </Typography>
      </CardContent>
    </Card>
  );
}
