/**
 * ClientTiktokCreatorsPanel.tsx — Creator Marketplace discovery
 *
 * Bestemor-vennlig: "Finn skapere som passer kampanjen din".
 *
 * Backend: GET /api/admin-room/agent/ads/tiktok/creators
 */

import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

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

interface Creator {
  handle: string;
  displayName: string;
  followerCount: number;
  engagementRate: number;
  location: string;
  niche: string;
  avatarUrl: string | null;
  marketplaceId: string | null;
}

export default function ClientTiktokCreatorsPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [country, setCountry] = useState('Norway');
  const [niche, setNiche] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config?.tiktok_advertiser_id) setAdvertiserId(d.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount]);

  const search = async () => {
    if (!advertiserId) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ advertiserId, country });
      if (niche) params.set('niche', niche);
      const r = await fetch(`/api/admin-room/agent/ads/tiktok/creators?${params}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Søk feilet');
      setCreators(d.creators ?? []);
      setIsCached(d.isCached ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Søk feilet');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PeopleAltOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Finn skapere som passer kampanjen
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              TikTok foreslår skapere som matcher land og bransje, klare for samarbeid.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {/* Søkeskjema */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.4, mb: 2 }}>
          <Box>
            <Typography sx={{ color: palette.textPrimary, fontSize: '0.86rem', fontWeight: 700, mb: 0.6 }}>
              Hvilket land?
            </Typography>
            <Select
              size="small"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              fullWidth
              sx={{ color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value="Norway">Norge</MenuItem>
              <MenuItem value="Sweden">Sverige</MenuItem>
              <MenuItem value="Denmark">Danmark</MenuItem>
              <MenuItem value="Finland">Finland</MenuItem>
              <MenuItem value="UK">Storbritannia</MenuItem>
              <MenuItem value="US">USA</MenuItem>
            </Select>
          </Box>
          <Box>
            <Typography sx={{ color: palette.textPrimary, fontSize: '0.86rem', fontWeight: 700, mb: 0.6 }}>
              Bransje eller tema (valgfritt)
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="f.eks. matlaging, film, trening"
              InputProps={{ sx: { color: palette.textPrimary } }}
            />
          </Box>
        </Box>

        <Button
          onClick={search}
          disabled={searching || !advertiserId}
          startIcon={searching ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SearchOutlinedIcon />}
          sx={{
            background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
            color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '1rem',
            px: 4, py: 1.4, borderRadius: 1.6,
            '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
          }}
        >
          {searching ? 'Søker…' : 'Finn skapere'}
        </Button>

        {/* Resultater */}
        {creators.length > 0 ? (
          <Box sx={{ mt: 2.4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {creators.length} skapere funnet
              </Typography>
              {isCached ? (
                <Chip size="small" label="Lagret fra tidligere søk" sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: palette.textMuted, fontSize: '0.72rem' }} />
              ) : null}
            </Stack>
            <Stack spacing={1.2}>
              {creators.slice(0, 20).map((c) => (
                <Box key={c.handle} sx={{
                  bgcolor: 'rgba(168,85,247,0.04)',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 1.4,
                  p: 1.6,
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.6}>
                    <Avatar src={c.avatarUrl ?? undefined} sx={{ width: 48, height: 48 }}>
                      {c.displayName?.[0] ?? c.handle?.[0]}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
                        @{c.handle}
                      </Typography>
                      <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
                        {c.displayName}
                      </Typography>
                      <Stack direction="row" spacing={1.4} sx={{ mt: 0.6 }}>
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                          👥 {c.followerCount.toLocaleString('nb-NO')} følgere
                        </Typography>
                        {c.engagementRate > 0 ? (
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                            💗 {(c.engagementRate * 100).toFixed(1)}% engasjement
                          </Typography>
                        ) : null}
                        {c.location ? (
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                            📍 {c.location}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                    <Button
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255,0,80,0.15)',
                        color: palette.tiktok,
                        textTransform: 'none', fontWeight: 700,
                        '&:hover': { bgcolor: 'rgba(255,0,80,0.25)' },
                      }}
                    >
                      Inviter
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
