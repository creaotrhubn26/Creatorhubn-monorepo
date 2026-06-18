/**
 * ClientTiktokAttributionPanel.tsx
 *
 * Bestemor-vennlig UI: viser hvor mye av salget klient/The Role Room
 * kan takke TikTok-annonsene for, og hvor mye penger man får igjen for
 * hver krone investert (ROAS).
 *
 * Designprinsipper:
 *   - Ett STORT tall som svarer på "hva har vi tjent på dette?"
 *   - Sammenligning med totalt annonse-spend
 *   - Klar handling: "Oppdater nå" hvis tallene er gamle
 *   - Norsk språk, ingen API-jargon
 *
 * Backend: GET /api/admin-room/agent/ads/configs/:id/tiktok/attribution
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';

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

interface Attribution {
  clickConversions: number;
  viewThroughConversions: number;
  totalAttributedRevenue: number;
  totalAdSpend: number;
  roas: number | null;
  fetchedAt: string;
  isCached: boolean;
  days: number;
  startDate: string;
  endDate: string;
}

const fmtNok = (n: number) => Math.round(n).toLocaleString('nb-NO') + ' kr';
const fmtInt = (n: number) => Math.round(n).toLocaleString('nb-NO');

export default function ClientTiktokAttributionPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [data, setData] = useState<Attribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 28 | 90>(28);

  const effectiveConfigId = isOwnAccount ? 'self' : configId;

  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config?.tiktok_advertiser_id) setAdvertiserId(d.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount]);

  const load = async (force = false) => {
    if (!advertiserId) return;
    if (force) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/attribution?advertiserId=${advertiserId}&days=${range}${force ? '&force=1' : ''}`,
        { credentials: 'include' },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Kunne ikke hente attribution');
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (advertiserId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertiserId, range]);

  const totalConv = (data?.clickConversions ?? 0) + (data?.viewThroughConversions ?? 0);
  const cpa = totalConv > 0 && data ? data.totalAdSpend / totalConv : 0;
  const roas = data?.roas ?? null;

  // Bestemor-friendly status-tekst
  const roasMessage = roas == null
    ? 'Vi har ikke nok salgsdata ennå.'
    : roas >= 3
      ? `For hver krone du brukte fikk du ${roas.toFixed(1)} kr tilbake. Det er svært bra!`
      : roas >= 1.5
        ? `For hver krone du brukte fikk du ${roas.toFixed(1)} kr tilbake. Du går i pluss.`
        : roas >= 1
          ? `For hver krone du brukte fikk du ${roas.toFixed(1)} kr tilbake. Du går omtrent i null.`
          : `For hver krone du brukte fikk du bare ${roas.toFixed(2)} kr tilbake. Tilsynelatende går vi i minus — sjekk kampanjeoppsett.`;

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUpOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Hva har TikTok-annonsene gitt tilbake?
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Inntekter sporet til TikTok i valgt periode.
            </Typography>
          </Box>
        </Stack>

        {/* Periode-velger */}
        <Stack direction="row" spacing={0.6} sx={{ mb: 2 }}>
          {[7, 28, 90].map((d) => (
            <Button
              key={d}
              onClick={() => setRange(d as 7 | 28 | 90)}
              size="small"
              sx={{
                background: range === d ? 'rgba(255,0,80,0.2)' : 'transparent',
                color: range === d ? palette.tiktok : palette.textMuted,
                border: `1px solid ${range === d ? palette.tiktok : palette.border}`,
                textTransform: 'none',
                fontWeight: 700,
                minWidth: 0, px: 1.6,
                '&:hover': { background: 'rgba(255,0,80,0.1)' },
              }}
            >
              {d === 7 ? 'Siste uke' : d === 28 ? 'Siste 4 uker' : 'Siste 3 mnd'}
            </Button>
          ))}
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {loading && !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ color: palette.tiktok }} />
          </Box>
        ) : data ? (
          <>
            {/* HOVEDTALL: Hva har vi tjent? */}
            <Box sx={{
              bgcolor: 'rgba(255,0,80,0.08)',
              border: `1px solid rgba(255,0,80,0.30)`,
              borderRadius: 1.6,
              p: 2.6,
              mb: 2,
            }}>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', mb: 0.6 }}>
                Inntekt sporet til TikTok-annonser
              </Typography>
              <Typography sx={{ fontSize: '2.6rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
                {fmtNok(data.totalAttributedRevenue)}
              </Typography>
              <Typography sx={{ color: palette.textPrimary, fontSize: '1rem', mt: 1.4, fontStyle: 'italic' }}>
                {roasMessage}
              </Typography>
            </Box>

            {/* Detalj-kort */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
              gap: 1.4,
              mb: 2,
            }}>
              <Box sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.border}`, borderRadius: 1.4, p: 1.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Annonse-spend
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.3rem', fontWeight: 800, mt: 0.4 }}>
                  {fmtNok(data.totalAdSpend)}
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.border}`, borderRadius: 1.4, p: 1.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Konverteringer
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.3rem', fontWeight: 800, mt: 0.4 }}>
                  {fmtInt(totalConv)}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.2 }}>
                  {fmtInt(data.clickConversions)} fra klikk · {fmtInt(data.viewThroughConversions)} etter visning
                </Typography>
              </Box>
              <Box sx={{ bgcolor: 'rgba(168,85,247,0.06)', border: `1px solid ${palette.border}`, borderRadius: 1.4, p: 1.6 }}>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Pris per konvertering
                </Typography>
                <Typography sx={{ color: palette.textPrimary, fontSize: '1.3rem', fontWeight: 800, mt: 0.4 }}>
                  {cpa > 0 ? fmtNok(cpa) : '—'}
                </Typography>
              </Box>
            </Box>

            {/* Cache-status + refresh */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <Chip
                icon={<AccessTimeOutlinedIcon sx={{ fontSize: 14, color: palette.textMuted + ' !important' }} />}
                label={data.isCached ? `Sist oppdatert ${new Date(data.fetchedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : 'Nettopp oppdatert'}
                size="small"
                sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: palette.textMuted, fontSize: '0.74rem' }}
              />
              <Box sx={{ flex: 1 }} />
              <Button
                onClick={() => load(true)}
                disabled={refreshing}
                startIcon={refreshing ? <CircularProgress size={14} sx={{ color: palette.accent }} /> : <RefreshOutlinedIcon fontSize="small" />}
                sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600 }}
              >
                {refreshing ? 'Oppdaterer…' : 'Oppdater nå'}
              </Button>
            </Stack>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
