/**
 * ClientMetaSuitePanel.tsx
 *
 * Meta-speil av Google/LinkedIn-suiten: list Ad Accounts → velg/opprett Pixel
 * → sync Custom Conversions → CAPI-token-lagring (gated på App Review).
 *
 * Backend-endepunkter:
 *   GET   /api/admin-room/agent/ads/meta/accounts
 *   GET   /api/admin-room/agent/ads/meta/pixels?adAccountId=act_X
 *   POST  /api/admin-room/agent/ads/configs/:id/meta/provision-pixel
 *   POST  /api/admin-room/agent/ads/configs/:id/meta/sync-conversions
 *   PATCH /api/admin-room/agent/ads/configs/:id/meta/capi-token
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import FacebookOutlinedIcon from '@mui/icons-material/FacebookOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const palette = {
  bgCard: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  meta: '#1877f2',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface MetaAdAccount {
  id: string;          // act_XXXXXXXXX
  accountId: string;   // XXXXXXXXX
  name: string;
  currency: string;
  businessName?: string;
}

interface MetaPixel {
  id: string;
  name: string;
  lastFiredAt?: string;
}

export default function ClientMetaSuitePanel({
  configId,
  clientName,
}: {
  configId: string;
  clientName: string;
}) {
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [adAccountId, setAdAccountId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  const [pixels, setPixels] = useState<MetaPixel[]>([]);
  const [loadingPixels, setLoadingPixels] = useState(false);
  const [pixelMode, setPixelMode] = useState<'new' | 'existing'>('new');
  const [existingPixelId, setExistingPixelId] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [pixel, setPixel] = useState<{ pixelId: string; pixelName: string; baseCode: string | null } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; failed: number } | null>(null);

  const [capiToken, setCapiToken] = useState('');
  const [capiSaved, setCapiSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/meta/accounts', { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) setAdAccountId(data.accounts[0].id);
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Kunne ikke hente Meta Ad Accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadPixels = async (acctId: string) => {
    setLoadingPixels(true);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/meta/pixels?adAccountId=${encodeURIComponent(acctId)}`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setPixels(data.pixels ?? []);
    } catch (err) {
      // Stille — Meta returnerer 403 hvis app review ikke godkjent for ads_read
      setPixels([]);
    } finally {
      setLoadingPixels(false);
    }
  };

  const provisionPixel = async () => {
    if (!adAccountId) return;
    setProvisioning(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/meta/provision-pixel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          adAccountId,
          ...(pixelMode === 'existing' && existingPixelId ? { existingPixelId } : {}),
          ...(pixelMode === 'new' ? { pixelName: `RR-Agent: ${clientName}` } : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setPixel({ pixelId: data.pixelId, pixelName: data.pixelName, baseCode: data.baseCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pixel-provisioning feilet');
    } finally {
      setProvisioning(false);
    }
  };

  const syncConversions = async () => {
    setSyncing(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/meta/sync-conversions`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setSyncResult({
        created: data.created?.length ?? 0,
        failed: data.failed?.length ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync feilet');
    } finally {
      setSyncing(false);
    }
  };

  const saveCapiToken = async () => {
    if (!capiToken) return;
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/meta/capi-token`, {
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
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (adAccountId) loadPixels(adAccountId);
  }, [adAccountId]);

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.4 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: 'rgba(24,119,242,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FacebookOutlinedIcon sx={{ color: palette.meta }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
              Meta — Pixel + Custom Conversions
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
              Facebook + Instagram. Bruker producerens eksisterende Meta-tilkobling. CAPI gated på App Review.
            </Typography>
          </Box>
          <Chip
            size="small"
            label="App Review: scopes pending"
            sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 700, fontSize: '0.68rem' }}
          />
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}
        {accountsError ? <Alert severity="warning" sx={{ mb: 1.4 }}>{accountsError}</Alert> : null}

        {/* Steg 1: velg Ad Account */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 1 — Velg Meta Ad Account
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              disabled={loadingAccounts || accounts.length === 0 || !!pixel}
              displayEmpty
              sx={{ minWidth: 320, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value=""><em style={{ color: palette.textMuted }}>
                {loadingAccounts ? 'Henter…' : accounts.length === 0 ? 'Ingen kontoer' : 'Velg ad account'}
              </em></MenuItem>
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.name} {a.businessName ? `· ${a.businessName}` : ''} ({a.currency})</MenuItem>
              ))}
            </Select>
            <Button onClick={loadAccounts} size="small" sx={{ color: palette.accent, textTransform: 'none' }}>
              Last på nytt
            </Button>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 2: opprett eller velg Pixel */}
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
              value={existingPixelId}
              onChange={(e) => setExistingPixelId(e.target.value)}
              disabled={loadingPixels || pixels.length === 0 || !!pixel}
              displayEmpty
              sx={{ minWidth: 320, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value=""><em style={{ color: palette.textMuted }}>Velg eksisterende pixel</em></MenuItem>
              {pixels.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name} ({p.id})</MenuItem>
              ))}
            </Select>
          ) : null}

          <Button
            onClick={provisionPixel}
            disabled={!adAccountId || provisioning || !!pixel || (pixelMode === 'existing' && !existingPixelId)}
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
                Pixel klar: <strong>{pixel.pixelName}</strong> ({pixel.pixelId})
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
                  }}>
                    {pixel.baseCode}
                  </Box>
                  <Button
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(pixel.baseCode!);
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

        {/* Steg 3: sync custom conversions */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 3 — Sync custom conversions
          </Typography>
          <Button
            onClick={syncConversions}
            disabled={syncing || !pixel}
            startIcon={syncing ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
            sx={{
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              color: '#0a0a1a', textTransform: 'none', fontWeight: 800,
            }}
          >
            {syncing ? 'Synker…' : 'Sync til Meta'}
          </Button>
          {syncResult ? (
            <Alert severity={syncResult.failed > 0 ? 'warning' : 'success'} sx={{ mt: 1 }}>
              {syncResult.created} custom conversion{syncResult.created === 1 ? '' : 's'} opprettet
              {syncResult.failed > 0 ? ` — ${syncResult.failed} feilet (sjekk Meta scope-tilgang)` : ''}.
            </Alert>
          ) : null}
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.6 }}>
            Krever approval_status = 'approved'. Per action: goal_category → Meta standard event (Lead/Purchase/AddToCart/Schedule/…).
          </Typography>
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 4: CAPI token */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
            <LockOutlinedIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Steg 4 — Conversions API (server-side)
            </Typography>
            <Chip
              size="small"
              label="Live krever App Review per scope"
              sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 700, height: 20, fontSize: '0.68rem' }}
            />
          </Stack>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', mb: 1 }}>
            CAPI håndterer iOS ATT-blokkering + offline-konverteringer. Token kan lagres nå — fungerer for app admins/testere, går live når Meta godkjenner.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="password"
              placeholder="Meta CAPI access token"
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
