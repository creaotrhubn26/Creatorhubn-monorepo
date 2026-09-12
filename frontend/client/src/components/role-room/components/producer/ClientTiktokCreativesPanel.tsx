/**
 * ClientTiktokCreativesPanel.tsx
 *
 * Bestemor-vennlig: viser bilder + videoer som er lastet opp til TikTok.
 * Forklart som "bildebank" + "videobank".
 *
 * Backend:
 *   GET  /api/admin-room/agent/ads/tiktok/creatives?advertiserId=X
 *   POST /api/admin-room/agent/ads/configs/:id/tiktok/smart-video
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

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

interface Asset {
  materialId: string;
  assetType: 'video' | 'image' | 'smart_video';
  fileName: string | null;
  previewUrl: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  uploadedAt: string;
}

export default function ClientTiktokCreativesPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config?.tiktok_advertiser_id) setAdvertiserId(d.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount]);

  const load = async () => {
    if (!advertiserId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/tiktok/creatives?advertiserId=${advertiserId}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Henting feilet');
      setAssets(d.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (advertiserId) load(); /* eslint-disable-next-line */ }, [advertiserId]);

  const videos = assets.filter((a) => a.assetType === 'video');
  const images = assets.filter((a) => a.assetType === 'image');
  const smart = assets.filter((a) => a.assetType === 'smart_video');

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PhotoLibraryOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Bilder og videoer hos TikTok
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Innholdet som er lastet opp og klart til å brukes i annonser.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {/* Sammendrag */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.4,
          mb: 2,
        }}>
          <Box sx={{
            bgcolor: 'rgba(255,0,80,0.06)',
            border: `1px solid rgba(255,0,80,0.20)`,
            borderRadius: 1.6,
            p: 2,
          }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
              <VideocamOutlinedIcon sx={{ color: palette.tiktok, fontSize: 20 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Videoer
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
              {videos.length}
            </Typography>
          </Box>
          <Box sx={{
            bgcolor: 'rgba(255,0,80,0.06)',
            border: `1px solid rgba(255,0,80,0.20)`,
            borderRadius: 1.6,
            p: 2,
          }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
              <PhotoLibraryOutlinedIcon sx={{ color: palette.tiktok, fontSize: 20 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Bilder
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
              {images.length}
            </Typography>
          </Box>
          <Box sx={{
            bgcolor: 'rgba(255,0,80,0.06)',
            border: `1px solid rgba(255,0,80,0.20)`,
            borderRadius: 1.6,
            p: 2,
          }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
              <AutoAwesomeOutlinedIcon sx={{ color: palette.tiktok, fontSize: 20 }} />
              <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                AI-laget
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
              {smart.length}
            </Typography>
          </Box>
        </Box>

        {/* Klartekst */}
        <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem', mb: 2 }}>
          Du har totalt <strong>{assets.length} elementer</strong> klare for annonsering.
          {assets.length > 0 ? ' For å laste opp nye, gjør det inne i TikTok Ads Manager — vi henter automatisk inn nye etter at de er lagt til.' : ' Last opp dine første bilder/videoer i TikTok Ads Manager — de dukker opp her etterpå.'}
        </Typography>

        <Button
          onClick={load}
          disabled={loading || !advertiserId}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600 }}
        >
          {loading ? 'Oppdaterer…' : 'Oppdater oversikten'}
        </Button>

        {/* Forhåndsvisning — siste 6 elementer */}
        {assets.length > 0 ? (
          <Box sx={{
            mt: 2.4,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 1.2,
          }}>
            {assets.slice(0, 12).map((a) => (
              <Box key={a.materialId} sx={{
                aspectRatio: a.assetType === 'image' ? '1' : '9/16',
                bgcolor: '#0a0a1a',
                border: `1px solid ${palette.border}`,
                borderRadius: 1.4,
                overflow: 'hidden',
                position: 'relative',
              }}>
                {a.previewUrl ? (
                  <Box component="img" src={a.previewUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.textMuted, fontSize: '0.7rem', textAlign: 'center', p: 1 }}>
                    {a.assetType === 'video' ? 'Video' : a.assetType === 'smart_video' ? 'AI' : 'Bilde'}
                    {a.fileName ? ` · ${a.fileName.slice(0, 16)}` : ''}
                  </Box>
                )}
                {a.assetType === 'smart_video' ? (
                  <Chip
                    label="AI"
                    size="small"
                    sx={{
                      position: 'absolute', top: 6, right: 6,
                      bgcolor: 'rgba(192,132,252,0.85)', color: '#fff', fontWeight: 700, fontSize: '0.6rem', height: 18,
                    }}
                  />
                ) : null}
              </Box>
            ))}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
