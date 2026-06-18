/**
 * ClientTiktokSpendPanel.tsx
 *
 * Bestemor-vennlig: "Hva har dere brukt på TikTok-annonser?"
 *
 * Backend: GET /api/admin-room/agent/ads/configs/:id/insights
 * (eksisterende endpoint som returnerer tiktok-metrics).
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';

const palette = {
  bg: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  tiktok: '#ff0050',
};

interface Spend {
  totalSpend: number;
  spendLast7d: number;
  spendLast28d: number;
  spendPrev28d: number | null;
  clicks: number;
  conversions: number;
  costPerConversion: number;
  topCampaigns: Array<{ campaignName: string; spend: number; clicks: number; conversions: number }>;
  dailyTrend: Array<{ date: string; spend: number }>;
}

const fmtNok = (n: number) => Math.round(n).toLocaleString('nb-NO') + ' kr';

export default function ClientTiktokSpendPanel({
  configId,
  advertiserId: providedAdvertiserId,
}: {
  configId: string;
  advertiserId?: string | null;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [data, setData] = useState<Spend | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (advertiserId) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config?.tiktok_advertiser_id) setAdvertiserId(d.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Bruker eksisterende insights-endpoint som returnerer tiktok-metrics
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/insights?range=28`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Henting feilet');
      if (!d.tiktok) {
        setData(null);
        return;
      }
      const t = d.tiktok;
      // Beregn siste 7 dager fra dailyTrend
      const trend = (t.dailyTrend ?? []).slice(-28);
      const last7 = trend.slice(-7).reduce((s: number, x: any) => s + (x.spend ?? 0), 0);
      const last28 = trend.reduce((s: number, x: any) => s + (x.spend ?? 0), 0);

      setData({
        totalSpend: t.spend ?? last28,
        spendLast7d: last7,
        spendLast28d: last28,
        spendPrev28d: null,
        clicks: t.clicks ?? 0,
        conversions: t.conversions ?? 0,
        costPerConversion: t.costPerConversion ?? 0,
        topCampaigns: t.topCampaigns ?? [],
        dailyTrend: trend,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (configId) load(); /* eslint-disable-next-line */ }, [configId]);

  // 7-dagers tendens
  const trendDiff = data ? (data.spendLast7d - (data.spendLast28d - data.spendLast7d) / 3) : 0;
  const trendDirection = trendDiff > 50 ? 'up' : trendDiff < -50 ? 'down' : 'flat';

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PaymentsOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Hva er brukt på TikTok-annonser?
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Penger som har gått fra ad-kontoen til TikTok siste 28 dager.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {loading && !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ color: palette.tiktok }} />
          </Box>
        ) : data ? (
          <>
            {/* STORT hovedtall */}
            <Box sx={{
              bgcolor: 'rgba(255,0,80,0.08)',
              border: `1px solid rgba(255,0,80,0.30)`,
              borderRadius: 1.6,
              p: 2.6,
              mb: 2,
            }}>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', mb: 0.6 }}>
                Brukt siste 4 uker
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1.4}>
                <Typography sx={{ fontSize: '2.6rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
                  {fmtNok(data.spendLast28d)}
                </Typography>
                {trendDirection !== 'flat' ? (
                  <Chip
                    icon={trendDirection === 'up'
                      ? <TrendingUpOutlinedIcon sx={{ color: '#fbbf24 !important', fontSize: 16 }} />
                      : <TrendingDownOutlinedIcon sx={{ color: '#34d399 !important', fontSize: 16 }} />
                    }
                    label={trendDirection === 'up' ? 'Økende' : 'Synkende'}
                    size="small"
                    sx={{
                      bgcolor: trendDirection === 'up' ? 'rgba(251,191,36,0.18)' : 'rgba(52,211,153,0.18)',
                      color: trendDirection === 'up' ? '#fbbf24' : '#34d399',
                      fontWeight: 700,
                    }}
                  />
                ) : null}
              </Stack>
              <Typography sx={{ color: palette.textPrimary, fontSize: '0.96rem', mt: 1.4, fontStyle: 'italic' }}>
                Tilsvarer ca. <strong>{fmtNok(data.spendLast28d / 28)}</strong> per dag.
              </Typography>
            </Box>

            {/* Detalj-kort */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 1.4,
              mb: 2,
            }}>
              <Box sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.border}`, borderRadius: 1.4, p: 1.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Siste uke
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.3rem', fontWeight: 800, mt: 0.4 }}>
                  {fmtNok(data.spendLast7d)}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.border}`, borderRadius: 1.4, p: 1.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Klikk på annonser
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.3rem', fontWeight: 800, mt: 0.4 }}>
                  {Math.round(data.clicks).toLocaleString('nb-NO')}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.border}`, borderRadius: 1.4, p: 1.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Pris per kunde
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.3rem', fontWeight: 800, mt: 0.4 }}>
                  {data.costPerConversion > 0 ? fmtNok(data.costPerConversion) : '—'}
                </Typography>
              </Box>
            </Box>

            {/* Topp kampanjer */}
            {data.topCampaigns.length > 0 ? (
              <Box>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1.2 }}>
                  Hva dro mest av spend?
                </Typography>
                <Stack spacing={1}>
                  {data.topCampaigns.slice(0, 5).map((c, i) => {
                    const pct = data.spendLast28d > 0 ? Math.round((c.spend / data.spendLast28d) * 100) : 0;
                    return (
                      <Box key={c.campaignName || i} sx={{
                        bgcolor: 'rgba(168,85,247,0.04)',
                        border: `1px solid ${palette.border}`,
                        borderRadius: 1.2,
                        p: 1.4,
                      }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
                          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.9rem' }}>
                            {c.campaignName}
                          </Typography>
                          <Typography sx={{ color: palette.tiktok, fontWeight: 800, fontSize: '0.96rem' }}>
                            {fmtNok(c.spend)}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={2}>
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                            {pct}% av total spend
                          </Typography>
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                            {c.clicks} klikk
                          </Typography>
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                            {c.conversions} kunder
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ) : null}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.92rem' }}>
              Ingen annonser kjørt ennå.
            </Typography>
          </Box>
        )}

        <Button
          onClick={load}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={14} sx={{ color: palette.accent }} /> : null}
          sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600, mt: 1 }}
        >
          {loading ? 'Oppdaterer…' : 'Oppdater'}
        </Button>
      </CardContent>
    </Card>
  );
}
