/**
 * AdConversionPanel — annonse-konvertering (porter adv-konvertering-designet).
 * Bruker EKTE data fra /ads/results/summary (ads_attribution_daily): KPI-er
 * (konverteringer + kost/konvertering m/ endring mot forrige periode),
 * konverteringstrakt (visninger → klikk → konverteringer) og bunnstripe
 * (annonsebruk · konv.rate · omsetning).
 */

import * as React from 'react';
import { Box, Stack, Typography, Chip, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import PaymentsIcon from '@mui/icons-material/Payments';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import roleRoomAgentService, { type RoleRoomChannelResults } from '../../services/roleRoomAgentService';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const PLATFORM: Record<string, { label: string; color: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C' }, facebook: { label: 'Facebook', color: '#1877F2' },
  meta: { label: 'Meta', color: '#1877F2' }, linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  tiktok: { label: 'TikTok', color: '#69C9D0' }, youtube: { label: 'YouTube', color: '#FF0000' }, google: { label: 'Google', color: '#34A853' },
};

export interface AdConversionPanelProps { projectId: string; period: string }

function fmtInt(n: number): string { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function prevPeriod(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (!m) return p;
  let y = Number(m[1]); let mo = Number(m[2]) - 1;
  if (mo < 1) { mo = 12; y -= 1; }
  return `${y}-${String(mo).padStart(2, '0')}`;
}
function delta(cur: number, prev: number): number | null { return prev ? Math.round(((cur - prev) / prev) * 100) : null; }

function DeltaChip({ pct, invert }: { pct: number | null; invert?: boolean }): React.ReactElement | null {
  if (pct == null) return null;
  const good = invert ? pct <= 0 : pct >= 0;
  const up = pct >= 0;
  return (
    <Stack direction="row" alignItems="center" spacing={0.2}>
      {up ? <ArrowUpwardIcon sx={{ fontSize: 13, color: good ? '#34d399' : '#f87171' }} /> : <ArrowDownwardIcon sx={{ fontSize: 13, color: good ? '#34d399' : '#f87171' }} />}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: good ? '#34d399' : '#f87171' }}>{up ? '+' : ''}{pct} %</Typography>
    </Stack>
  );
}

export default function AdConversionPanel({ projectId, period }: AdConversionPanelProps): React.ReactElement | null {
  const [cur, setCur] = React.useState<RoleRoomChannelResults | null>(null);
  const [prev, setPrev] = React.useState<RoleRoomChannelResults | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      roleRoomAgentService.fetchAdsResults(projectId, period),
      roleRoomAgentService.fetchAdsResults(projectId, prevPeriod(period)),
    ]).then(([c, p]) => { if (!cancelled) { setCur(c); setPrev(p); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, period]);

  const t = cur?.totals;
  const pt = prev?.totals;
  const hasData = Boolean(t && (t.impressions || t.clicks || t.conversions || t.spendNok));

  if (loading) return <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>;
  if (!hasData) return null; // ingen annonsedata → ikke vis panelet

  const conv = t!.conversions || 0;
  const clicks = t!.clicks || 0;
  const imp = t!.impressions || 0;
  const spend = t!.spendNok || 0;
  const revenue = t!.conversionValueNok || 0;
  const cpa = t!.costPerConversionNok ?? (conv ? spend / conv : 0);
  const convRate = clicks ? (conv / clicks) * 100 : 0;
  const maxFunnel = Math.max(imp, clicks, conv, 1);
  const funnel = [
    { label: 'Visninger', val: imp, icon: <VisibilityIcon sx={{ fontSize: 15 }} /> },
    { label: 'Klikk', val: clicks, icon: <AdsClickIcon sx={{ fontSize: 15 }} /> },
    { label: 'Konverteringer', val: conv, icon: <CheckCircleIcon sx={{ fontSize: 15 }} /> },
  ];

  return (
    <Box sx={{
      position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.4 }, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.2)',
      background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.18), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
      boxShadow: '0 14px 40px rgba(124,58,237,0.22)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1.4 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>Annonseytelse</Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED }}>Konverteringer · {period}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
          {(cur?.perChannel ?? []).filter((c) => c.conversions || c.clicks).map((c) => {
            const meta = PLATFORM[c.platform] ?? { label: c.platform, color: ACCENT };
            return <Chip key={c.platform} size="small" label={meta.label} sx={{ height: 20, fontSize: 10.5, fontWeight: 700, color: meta.color, bgcolor: `${meta.color}22`, border: `1px solid ${meta.color}55` }} />;
          })}
        </Stack>
      </Stack>

      {/* 2 KPI-fliser */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.2, mb: 1.8 }}>
        <Box sx={{ p: 1.4, borderRadius: 2.2, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(15,23,42,0.5)' }}>
          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
            <ShoppingCartCheckoutIcon sx={{ fontSize: 16, color: ACCENT }} />
            <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Konverteringer</Typography>
          </Stack>
          <Stack direction="row" alignItems="baseline" spacing={0.8}>
            <Typography sx={{ fontSize: 23, fontWeight: 800, color: INK, lineHeight: 1 }}>{fmtInt(conv)}</Typography>
            <DeltaChip pct={delta(conv, pt?.conversions ?? 0)} />
          </Stack>
        </Box>
        <Box sx={{ p: 1.4, borderRadius: 2.2, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(15,23,42,0.5)' }}>
          <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mb: 0.7 }}>
            <PaymentsIcon sx={{ fontSize: 16, color: ACCENT }} />
            <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>Kost / konvertering</Typography>
          </Stack>
          <Stack direction="row" alignItems="baseline" spacing={0.8}>
            <Typography sx={{ fontSize: 23, fontWeight: 800, color: INK, lineHeight: 1 }}>{fmtInt(cpa)} kr</Typography>
            <DeltaChip pct={delta(cpa, pt?.costPerConversionNok ?? (pt?.conversions ? (pt.spendNok / pt.conversions) : 0))} invert />
          </Stack>
        </Box>
      </Box>

      {/* Konverteringstrakt */}
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', mb: 0.8 }}>Konverteringstrakt</Typography>
      <Stack spacing={0.7} sx={{ mb: 1.8 }}>
        {funnel.map((f) => (
          <Box key={f.label} sx={{ position: 'relative', p: 0.9, borderRadius: 1.6, bgcolor: 'rgba(15,23,42,0.45)', border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', inset: 0, width: `${(f.val / maxFunnel) * 100}%`, background: 'linear-gradient(90deg, rgba(168,85,247,0.28), rgba(217,70,239,0.14))', transition: 'width 0.4s' }} />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ color: ACCENT }}>{f.icon}</Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: INK, flex: 1 }}>{f.label}</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{fmtInt(f.val)}</Typography>
            </Stack>
          </Box>
        ))}
      </Stack>

      {/* Bunnstripe */}
      <Stack direction="row" spacing={1}>
        {[
          { label: 'Annonsebruk', val: `${fmtInt(spend)} kr` },
          { label: 'Konv.rate', val: `${convRate.toFixed(2).replace('.', ',')} %` },
          { label: 'Omsetning', val: `${fmtInt(revenue)} kr` },
        ].map((s) => (
          <Box key={s.label} sx={{ flex: 1, p: 1, borderRadius: 1.6, bgcolor: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.1)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{s.val}</Typography>
            <Typography sx={{ fontSize: 10.5, color: MUTED }}>{s.label}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
