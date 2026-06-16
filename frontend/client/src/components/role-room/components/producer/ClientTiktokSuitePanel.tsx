/**
 * ClientTiktokSuitePanel.tsx
 *
 * TikTok-speil av Google/LinkedIn/Meta-suitene: OAuth → list advertisers →
 * Pixel (ny / eksisterende) → sync event-mapping → Events API-token.
 *
 * Backend-endepunkter:
 *   GET   /api/admin-room/agent/ads/oauth/tiktok/start
 *   GET   /api/admin-room/agent/ads/tiktok/advertisers
 *   GET   /api/admin-room/agent/ads/tiktok/pixels?advertiserId=X
 *   POST  /api/admin-room/agent/ads/configs/:id/tiktok/provision-pixel
 *   POST  /api/admin-room/agent/ads/configs/:id/tiktok/sync-events
 *   PATCH /api/admin-room/agent/ads/configs/:id/tiktok/capi-token
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TiktokPublisher from './TiktokPublisher';

const palette = {
  bgCard: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  tiktok: '#ff0050',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface Advertiser { id: string; name: string; currency: string; }
interface TtPixel { code: string; name: string; }

export default function ClientTiktokSuitePanel({
  configId,
  clientName,
}: {
  configId: string;
  clientName: string;
}) {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [advertiserId, setAdvertiserId] = useState('');
  const [loadingAdvertisers, setLoadingAdvertisers] = useState(false);
  const [advertisersError, setAdvertisersError] = useState<string | null>(null);

  const [pixels, setPixels] = useState<TtPixel[]>([]);
  const [pixelMode, setPixelMode] = useState<'new' | 'existing'>('new');
  const [existingPixelCode, setExistingPixelCode] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [pixel, setPixel] = useState<{ pixelCode: string; pixelName: string; baseCode: string } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number } | null>(null);

  const [capiToken, setCapiToken] = useState('');
  const [capiSaved, setCapiSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const loadAdvertisers = async () => {
    setLoadingAdvertisers(true);
    setAdvertisersError(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/tiktok/advertisers', { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setAdvertisers(data.advertisers ?? []);
      if (data.advertisers?.length === 1) setAdvertiserId(data.advertisers[0].id);
    } catch (err) {
      setAdvertisersError(err instanceof Error ? err.message : 'Kunne ikke hente TikTok-advertisers');
    } finally {
      setLoadingAdvertisers(false);
    }
  };

  const loadPixels = async (advId: string) => {
    try {
      const r = await fetch(`/api/admin-room/agent/ads/tiktok/pixels?advertiserId=${encodeURIComponent(advId)}`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setPixels(data.pixels ?? []);
    } catch {
      setPixels([]);
    }
  };

  const connectOAuth = async () => {
    try {
      const r = await fetch(`/api/admin-room/agent/ads/oauth/tiktok/start?configId=${encodeURIComponent(configId)}`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok || !data.authUrl) throw new Error(data.error || `HTTP ${r.status}`);
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth-start feilet');
    }
  };

  const provisionPixel = async () => {
    if (!advertiserId) return;
    setProvisioning(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/tiktok/provision-pixel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          advertiserId,
          ...(pixelMode === 'existing' && existingPixelCode ? { existingPixelCode } : {}),
          ...(pixelMode === 'new' ? { pixelName: `RR-Agent: ${clientName}` } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setPixel({ pixelCode: data.pixelCode, pixelName: data.pixelName, baseCode: data.baseCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pixel-provisioning feilet');
    } finally {
      setProvisioning(false);
    }
  };

  const syncEvents = async () => {
    setSyncing(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/tiktok/sync-events`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setSyncResult({ created: data.created?.length ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync feilet');
    } finally {
      setSyncing(false);
    }
  };

  const saveCapiToken = async () => {
    if (!capiToken) return;
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/tiktok/capi-token`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ capiToken }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setCapiSaved(true);
      setTimeout(() => setCapiSaved(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token-lagring feilet');
    }
  };

  useEffect(() => {
    loadAdvertisers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (advertiserId) loadPixels(advertiserId);
  }, [advertiserId]);

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        {/* Publiser til TikTok med telefon-mockup (pub-tiktok) */}
        <Box sx={{ mb: 2 }}>
          <TiktokPublisher handle={clientName ? `@${clientName.replace(/\s+/g, '').toLowerCase()}` : undefined} />
        </Box>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.4 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MusicNoteOutlinedIcon sx={{ color: palette.tiktok }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
              TikTok — Pixel + Events
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
              Speil av Google/Meta/LinkedIn. Bruker TikTok Business API. Events API gated til token er satt.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}

        {/* Steg 1: OAuth + advertiser-velger */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 1 — Koble TikTok Business Account
          </Typography>
          {advertisersError || advertisers.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                onClick={connectOAuth}
                startIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ border: `1px solid ${palette.borderStrong}`, color: palette.accent, textTransform: 'none', fontWeight: 700 }}
              >
                Koble TikTok
              </Button>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                {advertisersError ?? 'Krever TikTok Business app-creds satt på server.'}
              </Typography>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={advertiserId}
                onChange={(e) => setAdvertiserId(e.target.value)}
                disabled={loadingAdvertisers || !!pixel}
                displayEmpty
                sx={{ minWidth: 320, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
              >
                <MenuItem value=""><em style={{ color: palette.textMuted }}>Velg advertiser</em></MenuItem>
                {advertisers.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.name} ({a.currency})</MenuItem>
                ))}
              </Select>
              <Button onClick={loadAdvertisers} size="small" sx={{ color: palette.accent, textTransform: 'none' }}>
                Last på nytt
              </Button>
            </Stack>
          )}
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 2: Pixel */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 2 — Pixel
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              size="small"
              onClick={() => setPixelMode('new')}
              disabled={!!pixel}
              sx={{
                background: pixelMode === 'new' ? palette.accentGradient : 'transparent',
                border: `1px solid ${pixelMode === 'new' ? 'transparent' : palette.borderStrong}`,
                color: pixelMode === 'new' ? '#fff' : palette.textSecondary,
                textTransform: 'none', fontWeight: 700,
              }}
            >
              Opprett ny
            </Button>
            <Button
              size="small"
              onClick={() => setPixelMode('existing')}
              disabled={!!pixel || pixels.length === 0}
              sx={{
                background: pixelMode === 'existing' ? palette.accentGradient : 'transparent',
                border: `1px solid ${pixelMode === 'existing' ? 'transparent' : palette.borderStrong}`,
                color: pixelMode === 'existing' ? '#fff' : palette.textSecondary,
                textTransform: 'none', fontWeight: 700,
              }}
            >
              Bruk eksisterende {pixels.length > 0 ? `(${pixels.length})` : ''}
            </Button>
          </Stack>

          {pixelMode === 'existing' ? (
            <Select
              size="small"
              value={existingPixelCode}
              onChange={(e) => setExistingPixelCode(e.target.value)}
              disabled={pixels.length === 0 || !!pixel}
              displayEmpty
              sx={{ minWidth: 320, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value=""><em style={{ color: palette.textMuted }}>Velg eksisterende pixel</em></MenuItem>
              {pixels.map((p) => (
                <MenuItem key={p.code} value={p.code}>{p.name} ({p.code})</MenuItem>
              ))}
            </Select>
          ) : null}

          <Button
            onClick={provisionPixel}
            disabled={!advertiserId || provisioning || !!pixel || (pixelMode === 'existing' && !existingPixelCode)}
            startIcon={provisioning ? <CircularProgress size={14} /> : <SaveOutlinedIcon fontSize="small" />}
            sx={{
              mt: 1,
              background: palette.accentGradient,
              color: '#fff', textTransform: 'none', fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            {provisioning ? 'Klargjør…' : pixelMode === 'existing' ? 'Bruk valgt pixel' : `Opprett pixel for ${clientName}`}
          </Button>

          {pixel ? (
            <Box sx={{ mt: 1.2 }}>
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                Pixel klar: <strong>{pixel.pixelName}</strong> ({pixel.pixelCode})
              </Alert>
              {pixel.baseCode ? (
                <>
                  <Box sx={{
                    mt: 1.2,
                    bgcolor: '#0a0a1a',
                    border: `1px solid ${palette.borderStrong}`,
                    borderRadius: 1,
                    p: 1.2,
                    fontFamily: 'monospace',
                    fontSize: '0.74rem',
                    color: '#a5f3fc',
                    maxHeight: 220, overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>{pixel.baseCode}</Box>
                  <Button
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(pixel.baseCode);
                      setSnippetCopied(true);
                      setTimeout(() => setSnippetCopied(false), 1800);
                    }}
                    startIcon={snippetCopied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    sx={{ mt: 0.8, color: snippetCopied ? '#34d399' : palette.accent, textTransform: 'none' }}
                  >
                    {snippetCopied ? 'Kopiert' : 'Kopier base-code'}
                  </Button>
                </>
              ) : null}
            </Box>
          ) : null}
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 3: sync events */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 3 — Sync events
          </Typography>
          <Button
            onClick={syncEvents}
            disabled={syncing || !pixel}
            startIcon={syncing ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
            sx={{
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              color: '#0a0a1a', textTransform: 'none', fontWeight: 800,
            }}
          >
            {syncing ? 'Synker…' : 'Sync til TikTok'}
          </Button>
          {syncResult ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              {syncResult.created} action{syncResult.created === 1 ? '' : 's'} mappet til TikTok-events (CompletePayment/SubmitForm/CompleteRegistration/…).
            </Alert>
          ) : null}
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.6 }}>
            TikTok-events trenger ikke å "opprettes" via API — pixel registrerer dem automatisk ved første fyring. Sync-en mapper bare goal_category → riktig standard event-navn så AI-prompter får riktig kode.
          </Typography>
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 4: Events API (CAPI) */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
            <LockOutlinedIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Steg 4 — Events API (server-side)
            </Typography>
            <Chip
              size="small"
              label="Trenger token fra TikTok Events Manager"
              sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 700, height: 20, fontSize: '0.68rem' }}
            />
          </Stack>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', mb: 1 }}>
            Server-side fixer iOS ATT-blokkering + tillater offline-events. Token fås manuelt fra TikTok Events Manager → pixel → Settings → Set up Events API.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="password"
              placeholder="TikTok Events API token"
              value={capiToken}
              onChange={(e) => setCapiToken(e.target.value)}
              InputProps={{ sx: { color: palette.textPrimary, fontFamily: 'monospace' } }}
              sx={{ minWidth: 280 }}
            />
            <Button
              onClick={saveCapiToken}
              disabled={!capiToken}
              startIcon={capiSaved ? <CheckCircleOutlineIcon fontSize="small" /> : <SaveOutlinedIcon fontSize="small" />}
              sx={{
                background: capiSaved
                  ? 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                  : palette.accentGradient,
                color: '#fff', textTransform: 'none', fontWeight: 700,
                '&:hover': {
                  background: capiSaved
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
                },
              }}
            >
              {capiSaved ? 'Lagret' : 'Lagre'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
