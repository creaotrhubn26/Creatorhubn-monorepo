/**
 * MarketingReportPanel — periode-rapport (uke / måned / kvartal) per kanal.
 * Porter rep-uke/rep-maaned/rep-kvartal-designene til ÉN komponent med
 * periode-toggle og kanal-indikasjon. Brukes av BÅDE produsenten (projectId
 * + agent-session) OG klienten (clientToken via portal). Viser endring mot
 * forrige periode.
 *
 * Backend: /api/role-room/kpi-report (produsent) + /api/client/portal/kpi-report.
 */

import * as React from 'react';
import { Box, Stack, Typography, Chip, CircularProgress, ToggleButton, ToggleButtonGroup } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CampaignIcon from '@mui/icons-material/Campaign';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import roleRoomAgentService, {
  type KpiReport, type KpiReportPeriod, type KpiReportMetric,
} from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const PLATFORM: Record<string, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  tiktok: { label: 'TikTok', color: '#69C9D0' },
  youtube: { label: 'YouTube', color: '#FF0000' },
};

const TITLE: Record<KpiReportPeriod, string> = { week: 'Ukerapport', month: 'Månedsrapport', quarter: 'Kvartalsrapport' };

export interface MarketingReportPanelProps {
  /** Produsent-side: prosjekt-id (bruker agent-session). */
  projectId?: string | null;
  /** Klient-side: portal-token (ingen agent-session). */
  clientToken?: string | null;
}

function fmtNo(n: number): string {
  const v = Math.round(n);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function Delta({ pct }: { pct: number | null }): React.ReactElement | null {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <Stack direction="row" alignItems="center" spacing={0.2}>
      {up ? <ArrowUpwardIcon sx={{ fontSize: 13, color: '#34d399' }} /> : <ArrowDownwardIcon sx={{ fontSize: 13, color: '#f87171' }} />}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: up ? '#34d399' : '#f87171' }}>{up ? '+' : ''}{pct} %</Typography>
    </Stack>
  );
}

export default function MarketingReportPanel({ projectId, clientToken }: MarketingReportPanelProps): React.ReactElement {
  const [period, setPeriod] = React.useState<KpiReportPeriod>('month');
  const [channel, setChannel] = React.useState('alle');
  const [report, setReport] = React.useState<KpiReport | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = clientToken
      ? roleRoomAgentService.fetchClientKpiReport(clientToken, period, channel)
      : projectId
        ? roleRoomAgentService.fetchKpiReport(projectId, period, channel)
        : Promise.resolve(null);
    void p.then((r) => { if (!cancelled) setReport(r); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, clientToken, period, channel]);

  const tiles: Array<{ key: keyof KpiReport['metrics']; label: string; icon: React.ReactElement; m: KpiReportMetric | undefined }> = [
    { key: 'visninger', label: 'Visninger', icon: <VisibilityIcon sx={{ fontSize: 17, color: '#fff' }} />, m: report?.metrics.visninger },
    { key: 'rekkevidde', label: 'Rekkevidde', icon: <CampaignIcon sx={{ fontSize: 17, color: '#fff' }} />, m: report?.metrics.rekkevidde },
    { key: 'engasjement', label: 'Engasjement', icon: <FavoriteIcon sx={{ fontSize: 17, color: '#fff' }} />, m: report?.metrics.engasjement },
    { key: 'reaksjoner', label: 'Reaksjoner', icon: <ThumbUpIcon sx={{ fontSize: 17, color: '#fff' }} />, m: report?.metrics.reaksjoner },
  ];
  const kpiColors = [{ c1: '#a855f7', c2: '#7c3aed' }, { c1: '#d946ef', c2: '#a21caf' }, { c1: '#8b5cf6', c2: '#6d28d9' }, { c1: '#c026d3', c2: '#86198f' }];
  const channelsForSelector = report?.channels ?? [];

  return (
    <Box
      sx={{
        position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.6 }, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background:
          'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.20), transparent 55%), radial-gradient(110% 80% at 100% 114%, rgba(217,70,239,0.14), transparent 50%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 18px 48px rgba(124,58,237,0.26)',
      }}
    >
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.8 }}>
        <Stack direction="row" alignItems="center" spacing={1.1}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
            <AutoAwesomeIcon sx={{ fontSize: 17, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{TITLE[period]}</Typography>
            <Typography sx={{ fontSize: 12.5, color: MUTED }}>{report?.periodLabel ?? '—'}</Typography>
          </Box>
        </Stack>
        <ToggleButtonGroup
          size="small" exclusive value={period}
          onChange={(_, v) => { if (v) setPeriod(v); }}
          sx={{
            '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: MUTED, borderColor: 'rgba(167,139,250,0.28)', px: 1.4, py: 0.4 },
            '& .Mui-selected': { color: '#fff !important', background: `${GRAD} !important` },
          }}
        >
          <ToggleButton value="week">Uke</ToggleButton>
          <ToggleButton value="month">Måned</ToggleButton>
          <ToggleButton value="quarter">Kvartal</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Kanal-indikasjon / -velger */}
      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip size="small" label="Alle kanaler" onClick={() => setChannel('alle')}
          sx={{ fontWeight: 700, fontSize: 11.5, color: channel === 'alle' ? '#fff' : '#c4b5fd', background: channel === 'alle' ? GRAD : 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)' }} />
        {channelsForSelector.map((p) => {
          const meta = PLATFORM[p] ?? { label: p, color: ACCENT };
          const active = channel === p;
          return (
            <Chip key={p} size="small" label={meta.label} onClick={() => setChannel(p)}
              sx={{ fontWeight: 700, fontSize: 11.5, color: active ? '#fff' : meta.color, bgcolor: active ? meta.color : `${meta.color}22`, border: `1px solid ${meta.color}55` }} />
          );
        })}
      </Stack>

      {loading ? (
        <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: ACCENT }} /></Box>
      ) : !report?.hasData ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <AutoAwesomeIcon sx={{ fontSize: 36, color: ACCENT, mb: 1 }} />
          <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: INK, mb: 0.5 }}>Ingen data for perioden ennå</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, maxWidth: 360, mx: 'auto' }}>
            Tallene fylles inn etter hvert som innlegg publiseres og KPI-er synkroniseres fra kanalene.
          </Typography>
        </Box>
      ) : (
        <>
          {/* 4 KPI-fliser */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.2, mb: 2 }}>
            {tiles.map((t, i) => (
              <Box key={t.key} sx={{ p: 1.4, borderRadius: 2.2, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(15,23,42,0.5)' }}>
                <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                  <Box sx={{ width: 26, height: 26, borderRadius: 1.2, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${kpiColors[i].c1}, ${kpiColors[i].c2})`, boxShadow: `0 6px 14px ${kpiColors[i].c1}55` }}>
                    {t.icon}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{t.label}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1, mb: 0.4 }}>{fmtNo(t.m?.value ?? 0)}</Typography>
                <Delta pct={t.m?.deltaPct ?? null} />
              </Box>
            ))}
          </Box>

          {/* Per-kanal-fordeling */}
          {report.byChannel.length > 0 ? (
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', mb: 0.8 }}>Per kanal</Typography>
              <Stack spacing={0.8}>
                {report.byChannel.map((c) => {
                  const meta = PLATFORM[c.platform] ?? { label: c.platform, color: ACCENT };
                  return (
                    <Stack key={c.platform} direction="row" alignItems="center" spacing={1} sx={{ p: 1, borderRadius: 1.8, bgcolor: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.1)' }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: INK, flex: 1 }}>{meta.label}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: MUTED }}>{fmtNo(c.visninger)} visn.</Typography>
                      <Typography sx={{ fontSize: 12.5, color: MUTED }}>{fmtNo(c.engasjement)} eng.</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          ) : null}
        </>
      )}

      {/* Footer */}
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mt: 2, pt: 1.4, borderTop: '1px solid rgba(148,163,184,0.12)' }}>
        <AutoAwesomeIcon sx={{ fontSize: 13, color: ACCENT }} />
        <Typography sx={{ fontSize: 11, color: MUTED }}>Generert av The Role Room Agent</Typography>
      </Stack>
    </Box>
  );
}
