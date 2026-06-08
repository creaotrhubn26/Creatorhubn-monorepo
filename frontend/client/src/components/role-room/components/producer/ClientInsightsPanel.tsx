/**
 * ClientInsightsPanel.tsx
 *
 * Samlet dashboard for klient-config: GA4 + Google Ads + GSC + tracked events.
 * Viser KPI-er øverst, deretter trend / topp-kanaler / topp-søk / topp-sider,
 * og auto-genererte observasjoner ("hva skjer + hva bør du gjøre").
 *
 * Backend: GET /api/admin-room/agent/ads/configs/:id/insights?range=28
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import AdsClickOutlinedIcon from '@mui/icons-material/AdsClickOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const palette = {
  bgCard: '#150b2e',
  bgElevated: '#1a0f3a',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  ga4: '#fbbf24',
  ads: '#60a5fa',
  gsc: '#34d399',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface Insights {
  range: { start: string; end: string; days: number };
  ga4: any;
  ads: any;
  gsc: any;
  linkedin: any;
  meta: any;
  tiktok: any;
  setupHealth: { totalChecks: number; ok: number; score: number };
  trackedEvents: { total: number; uniqueActions: number; topActions: Array<{ actionName: string; count: number }> };
  summary: {
    totalSessions: number;
    totalAdsClicks: number;
    totalOrganicClicks: number;
    totalConversions: number;
    totalSpendNok: number;
    avgCostPerConversion: number;
    organicShare: number;
    paidShare: number;
    spendByPlatform: Array<{ platform: string; spend: number; share: number }>;
  };
  observations: string[];
}

const RANGE_OPTIONS = [
  { value: 7, label: '7 dager' },
  { value: 28, label: '28 dager' },
  { value: 90, label: '90 dager' },
];

const fmt = (n: number) => Math.round(n).toLocaleString('nb-NO');
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtMoney = (n: number) => `${fmt(n)} kr`;

export default function ClientInsightsPanel({
  configId,
  clientName,
}: {
  configId: string;
  clientName: string;
}) {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(28);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/insights?range=${range}`, {
        credentials: 'include',
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Insights-henting feilet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const copyToClient = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`📊 Innsikt — ${clientName} (siste ${range} dager)`);
    lines.push("");
    lines.push(`Trafikk: ${fmt(data.summary.totalSessions)} økter`);
    lines.push(`Klikk fra Google: ${fmt(data.summary.totalAdsClicks)} betalt, ${fmt(data.summary.totalOrganicClicks)} organisk`);
    lines.push(`Konverteringer: ${fmt(data.summary.totalConversions)}`);
    if (data.summary.totalSpendNok > 0) {
      lines.push(`Ads-spend: ${fmtMoney(data.summary.totalSpendNok)}`);
      if (data.summary.avgCostPerConversion > 0) lines.push(`CPA: ${fmtMoney(data.summary.avgCostPerConversion)}/konvertering`);
      if (data.ads?.roas) lines.push(`ROAS: ${data.ads.roas.toFixed(1)}x`);
    }
    if (data.observations.length > 0) {
      lines.push("");
      lines.push("📌 Observasjoner:");
      data.observations.forEach((o) => lines.push(`• ${o}`));
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.6 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: 'rgba(192,132,252,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <InsightsOutlinedIcon sx={{ color: palette.accent }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
              Innsikt — full stack
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
              Google Ads + GA4 + Search Console + tracked events — én oversikt.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.6}>
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="small"
                onClick={() => setRange(opt.value)}
                sx={{
                  textTransform: 'none',
                  background: range === opt.value ? palette.accentGradient : 'transparent',
                  border: `1px solid ${range === opt.value ? 'transparent' : palette.borderStrong}`,
                  color: range === opt.value ? '#fff' : palette.textSecondary,
                  fontWeight: 700,
                  minWidth: 0, px: 1.4,
                  '&:hover': { background: range === opt.value ? palette.accentGradient : 'rgba(168,85,247,0.08)' },
                }}
              >
                {opt.label}
              </Button>
            ))}
            <Button
              size="small"
              onClick={load}
              disabled={loading}
              sx={{ color: palette.textMuted, minWidth: 0, px: 1 }}
            >
              <RefreshOutlinedIcon fontSize="small" />
            </Button>
          </Stack>
        </Stack>

        {loading && !data ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 3, justifyContent: 'center' }}>
            <CircularProgress size={20} />
            <Typography sx={{ color: palette.textMuted }}>Henter data fra Google…</Typography>
          </Stack>
        ) : null}

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}

        {data ? (
          <>
            {/* Topplinje-KPI */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
              gap: 1.2,
              mb: 2,
            }}>
              <KpiBox
                label="Økter (GA4)"
                value={fmt(data.summary.totalSessions)}
                color={palette.ga4}
                source="Google Analytics"
              />
              <KpiBox
                label="Klikk (Ads + organisk)"
                value={fmt(data.summary.totalAdsClicks + data.summary.totalOrganicClicks)}
                color={palette.ads}
                sub={`${fmt(data.summary.totalAdsClicks)} betalt · ${fmt(data.summary.totalOrganicClicks)} organisk`}
                source="Google Ads + GSC"
              />
              <KpiBox
                label="Konverteringer"
                value={fmt(data.summary.totalConversions)}
                color={palette.gsc}
                sub={data.summary.avgCostPerConversion > 0 ? `${fmtMoney(data.summary.avgCostPerConversion)} CPA` : undefined}
                source={data.trackedEvents.total > 0 ? `${data.trackedEvents.total} events tracked` : 'Ads + GA4'}
              />
              <KpiBox
                label="Ads-spend"
                value={fmtMoney(data.summary.totalSpendNok)}
                color={palette.accent}
                sub={data.ads?.roas ? `${data.ads.roas.toFixed(1)}x ROAS` : undefined}
                source={`Siste ${data.range.days} dager`}
              />
            </Box>

            {/* Observasjoner (det viktigste) */}
            {data.observations.length > 0 ? (
              <Box sx={{
                bgcolor: 'rgba(192,132,252,0.08)',
                border: `1px solid ${palette.borderStrong}`,
                borderRadius: 1.4,
                p: 1.6,
                mb: 2,
              }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <LightbulbOutlinedIcon sx={{ color: palette.accent, fontSize: 18 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: '0.86rem' }}>
                    Observasjoner & anbefalinger
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button
                    size="small"
                    onClick={copyToClient}
                    startIcon={copied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    sx={{
                      color: copied ? '#34d399' : palette.accent,
                      textTransform: 'none', fontWeight: 700,
                    }}
                  >
                    {copied ? 'Kopiert' : 'Kopier som rapport'}
                  </Button>
                </Stack>
                <Stack spacing={0.8}>
                  {data.observations.map((o, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Box sx={{ color: palette.accent, mt: 0.2 }}>•</Box>
                      <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', flex: 1 }}>
                        {o}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {/* Channel-fordeling */}
            {data.ga4?.trafficByChannel?.length > 0 ? (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.8 }}>
                  Trafikk per kanal (GA4)
                </Typography>
                <Stack spacing={0.8}>
                  {data.ga4.trafficByChannel.slice(0, 6).map((c: any) => {
                    const max = data.ga4.trafficByChannel[0].sessions;
                    const pct = max > 0 ? (c.sessions / max) * 100 : 0;
                    return (
                      <Box key={c.channel}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                          <Typography sx={{ color: palette.textPrimary, fontSize: '0.82rem' }}>
                            {c.channel}
                          </Typography>
                          <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem' }}>
                            {fmt(c.sessions)} økter · {fmt(c.conversions)} konv.
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 6, borderRadius: 1,
                            bgcolor: 'rgba(168,85,247,0.08)',
                            '& .MuiLinearProgress-bar': { bgcolor: palette.accent },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ) : null}

            {/* To kolonner: GSC topp-søk + Ads topp-kampanjer */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 1.6,
              mb: 2,
            }}>
              {data.gsc?.topQueries?.length > 0 ? (
                <DataTable
                  icon={<SearchOutlinedIcon sx={{ color: palette.gsc }} />}
                  title="Topp Google-søk"
                  source={`Søkeposisjon ⌀ ${data.gsc.averagePosition?.toFixed(1) ?? '—'}`}
                  rows={data.gsc.topQueries.slice(0, 8).map((q: any) => ({
                    label: q.query,
                    primary: `${fmt(q.clicks)} klikk`,
                    secondary: `pos ${q.position.toFixed(1)} · ${fmt(q.impressions)} visn.`,
                  }))}
                />
              ) : null}
              {data.ads?.topCampaigns?.length > 0 ? (
                <DataTable
                  icon={<AdsClickOutlinedIcon sx={{ color: palette.ads }} />}
                  title="Topp Google Ads-kampanjer"
                  source={`CTR ⌀ ${data.ads.ctr ? fmtPct(data.ads.ctr) : '—'}`}
                  rows={data.ads.topCampaigns.map((c: any) => ({
                    label: c.campaignName,
                    primary: fmtMoney(c.cost),
                    secondary: `${fmt(c.clicks)} klikk · ${fmt(c.conversions)} konv.`,
                  }))}
                />
              ) : null}
            </Box>

            {/* Topp landing-sider fra GSC */}
            {data.gsc?.topPages?.length > 0 ? (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.8 }}>
                  Topp landing-sider (Search Console)
                </Typography>
                <Table size="small" sx={{ '& td, & th': { borderColor: palette.border, color: palette.textPrimary } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>URL</TableCell>
                      <TableCell sx={{ color: palette.textMuted, fontSize: '0.72rem' }} align="right">Klikk</TableCell>
                      <TableCell sx={{ color: palette.textMuted, fontSize: '0.72rem' }} align="right">Visn.</TableCell>
                      <TableCell sx={{ color: palette.textMuted, fontSize: '0.72rem' }} align="right">CTR</TableCell>
                      <TableCell sx={{ color: palette.textMuted, fontSize: '0.72rem' }} align="right">Pos</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.gsc.topPages.slice(0, 6).map((p: any) => (
                      <TableRow key={p.page}>
                        <TableCell sx={{ fontSize: '0.78rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.page.replace(/^https?:\/\/[^/]+/, '')}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmt(p.clicks)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmt(p.impressions)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{fmtPct(p.ctr)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.78rem' }}>{p.position.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : null}

            {/* Spend-fordeling per plattform */}
            {data.summary.spendByPlatform?.length > 1 ? (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.8 }}>
                  Spend-fordeling per plattform
                </Typography>
                <Stack spacing={0.8}>
                  {data.summary.spendByPlatform.map((p) => (
                    <Box key={p.platform}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
                        <Typography sx={{ color: palette.textPrimary, fontSize: '0.82rem' }}>{p.platform}</Typography>
                        <Typography sx={{ color: palette.textSecondary, fontSize: '0.78rem' }}>
                          {fmtMoney(p.spend)} · {Math.round(p.share * 100)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={p.share * 100}
                        sx={{
                          height: 6, borderRadius: 1,
                          bgcolor: 'rgba(168,85,247,0.08)',
                          '& .MuiLinearProgress-bar': { bgcolor: p.platform === 'LinkedIn' ? '#0a66c2' : palette.ads },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {/* Tilkoblings-status */}
            <Divider sx={{ borderColor: palette.border, my: 1.4 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <SourceChip label="GA4" connected={!!data.ga4} color={palette.ga4} />
              <SourceChip label="Google Ads" connected={!!data.ads} color={palette.ads} />
              <SourceChip label="Search Console" connected={!!data.gsc} color={palette.gsc} />
              <SourceChip label="LinkedIn" connected={!!data.linkedin} color="#0a66c2" />
              <SourceChip label="Meta" connected={!!data.meta} color="#1877f2" />
              <SourceChip label="TikTok" connected={!!data.tiktok} color="#ff0050" />
              <SourceChip label={`${data.trackedEvents.total} tracked events`} connected={data.trackedEvents.total > 0} color={palette.accent} />
            </Stack>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function KpiBox({ label, value, color, sub, source }: { label: string; value: string; color: string; sub?: string; source?: string }) {
  return (
    <Box sx={{
      bgcolor: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 1.4,
      p: 1.4,
    }}>
      <Typography sx={{ color: `${color}cc`, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Typography>
      <Typography sx={{ color, fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.2, mt: 0.4 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography sx={{ color: 'rgba(196,181,253,0.85)', fontSize: '0.74rem', mt: 0.3 }}>
          {sub}
        </Typography>
      ) : null}
      {source ? (
        <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.66rem', mt: 0.4 }}>
          {source}
        </Typography>
      ) : null}
    </Box>
  );
}

function DataTable({
  icon, title, source, rows,
}: {
  icon: React.ReactNode;
  title: string;
  source: string;
  rows: Array<{ label: string; primary: string; secondary?: string }>;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
        {icon}
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.86rem' }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.72rem' }}>{source}</Typography>
      </Stack>
      <Stack spacing={0.6}>
        {rows.map((r, i) => (
          <Box
            key={`${r.label}-${i}`}
            sx={{
              bgcolor: 'rgba(168,85,247,0.04)',
              border: `1px solid ${palette.border}`,
              borderRadius: 1,
              px: 1.2, py: 0.8,
              display: 'flex', alignItems: 'center', gap: 1,
            }}
          >
            <Typography sx={{
              color: palette.textPrimary, fontSize: '0.78rem',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {r.label}
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.1 }}>
                {r.primary}
              </Typography>
              {r.secondary ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem', lineHeight: 1.1 }}>
                  {r.secondary}
                </Typography>
              ) : null}
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function SourceChip({ label, connected, color }: { label: string; connected: boolean; color: string }) {
  return (
    <Chip
      size="small"
      label={`${label} ${connected ? '✓' : 'venter'}`}
      sx={{
        bgcolor: connected ? `${color}28` : 'rgba(148,163,184,0.18)',
        color: connected ? color : palette.textMuted,
        fontWeight: 700,
      }}
    />
  );
}
