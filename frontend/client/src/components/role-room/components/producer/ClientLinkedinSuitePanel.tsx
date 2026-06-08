/**
 * ClientLinkedinSuitePanel.tsx
 *
 * LinkedIn-speil av ClientGoogleSuitePanel: OAuth → list accounts →
 * Insight Tag → conversion-sync. Mountes i AgentAdsPanel etter Google-suiten.
 *
 * Backend-endepunkter:
 *   GET  /api/admin-room/agent/ads/oauth/linkedin/start
 *   GET  /api/admin-room/agent/ads/linkedin/accounts
 *   POST /api/admin-room/agent/ads/configs/:id/linkedin/provision-insight-tag
 *   POST /api/admin-room/agent/ads/configs/:id/linkedin/sync-conversions
 *   PATCH /api/admin-room/agent/ads/configs/:id/linkedin/capi-token
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  IconButton, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
  linkedin: '#0a66c2',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

export default function ClientLinkedinSuitePanel({
  configId,
  clientName,
}: {
  configId: string;
  clientName: string;
}) {
  const [accounts, setAccounts] = useState<Array<{ id: string; urn: string; name: string; currency: string }>>([]);
  const [accountUrn, setAccountUrn] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [insightTag, setInsightTag] = useState<{ insightTagId: number; partnerId: number; tagSnippet: string } | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; failed: number } | null>(null);
  const [capiToken, setCapiToken] = useState('');
  const [capiSaved, setCapiSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagSnippetCopied, setTagSnippetCopied] = useState(false);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const r = await fetch('/api/admin-room/agent/ads/linkedin/accounts', { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setAccounts(data.accounts ?? []);
      if (data.accounts?.length === 1) setAccountUrn(data.accounts[0].urn);
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Kunne ikke hente LinkedIn-kontoer');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const connectOAuth = async () => {
    try {
      const r = await fetch(`/api/admin-room/agent/ads/oauth/linkedin/start?configId=${encodeURIComponent(configId)}`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok || !data.authUrl) throw new Error(data.error || `HTTP ${r.status}`);
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth-start feilet');
    }
  };

  const provisionInsightTag = async () => {
    if (!accountUrn) return;
    setProvisioning(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/linkedin/provision-insight-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ adAccountUrn: accountUrn }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setInsightTag({
        insightTagId: data.insightTagId,
        partnerId: data.partnerId,
        tagSnippet: data.tagSnippet,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning feilet');
    } finally {
      setProvisioning(false);
    }
  };

  const syncConversions = async () => {
    setSyncing(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/linkedin/sync-conversions`, {
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
      const r = await fetch(`/api/admin-room/agent/ads/configs/${configId}/linkedin/capi-token`, {
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

  return (
    <Card sx={{ bgcolor: palette.bgCard, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.4 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.4,
            bgcolor: 'rgba(10,102,194,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BusinessCenterOutlinedIcon sx={{ color: palette.linkedin }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
              LinkedIn — Insight Tag + conversion-rules
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem' }}>
              Speil av Google-flowen for B2B-trafikk. Opprett Insight Tag for {clientName} og sync alle godkjente conversion-actions.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}

        {/* Steg 1: OAuth + konto-velger */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 1 — Koble LinkedIn Ad Account
          </Typography>
          {accountsError || accounts.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                onClick={connectOAuth}
                startIcon={<OpenInNewIcon fontSize="small" />}
                sx={{ border: `1px solid ${palette.borderStrong}`, color: palette.accent, textTransform: 'none', fontWeight: 700 }}
              >
                Koble LinkedIn
              </Button>
              <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                {accountsError ? `${accountsError} — koble på nytt for å løse.` : 'Krever LinkedIn Marketing Developer Platform-tilgang.'}
              </Typography>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={accountUrn}
                onChange={(e) => setAccountUrn(e.target.value)}
                disabled={loadingAccounts || !!insightTag}
                displayEmpty
                sx={{ minWidth: 280, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
              >
                <MenuItem value=""><em style={{ color: palette.textMuted }}>Velg ad account</em></MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.urn} value={a.urn}>{a.name} ({a.currency})</MenuItem>
                ))}
              </Select>
              <Button onClick={loadAccounts} size="small" sx={{ color: palette.accent, textTransform: 'none' }}>
                Last på nytt
              </Button>
            </Stack>
          )}
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 2: Provision Insight Tag */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 2 — Opprett Insight Tag (klient-pixel)
          </Typography>
          <Button
            onClick={provisionInsightTag}
            disabled={!accountUrn || provisioning || !!insightTag}
            startIcon={provisioning ? <CircularProgress size={14} /> : <SaveOutlinedIcon fontSize="small" />}
            sx={{
              background: palette.accentGradient,
              color: '#fff', textTransform: 'none', fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            {provisioning ? 'Oppretter…' : `Opprett Insight Tag for ${clientName}`}
          </Button>
          {insightTag ? (
            <Box sx={{ mt: 1.2 }}>
              <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                Insight Tag opprettet. Partner-ID: <strong>{insightTag.partnerId}</strong>. Pixel-snippet er klar til klient.
              </Alert>
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
                {insightTag.tagSnippet}
              </Box>
              <Button
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(insightTag.tagSnippet);
                  setTagSnippetCopied(true);
                  setTimeout(() => setTagSnippetCopied(false), 1800);
                }}
                startIcon={tagSnippetCopied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                sx={{ mt: 0.8, color: tagSnippetCopied ? '#34d399' : palette.accent, textTransform: 'none' }}
              >
                {tagSnippetCopied ? 'Kopiert' : 'Kopier snippet'}
              </Button>
            </Box>
          ) : null}
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 3: Sync conversion-rules */}
        <Box sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.6 }}>
            Steg 3 — Sync conversion-rules
          </Typography>
          <Button
            onClick={syncConversions}
            disabled={syncing || !insightTag}
            startIcon={syncing ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
            sx={{
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              color: '#0a0a1a', textTransform: 'none', fontWeight: 800,
            }}
          >
            {syncing ? 'Synker…' : 'Sync til LinkedIn'}
          </Button>
          {syncResult ? (
            <Alert severity={syncResult.failed > 0 ? 'warning' : 'success'} sx={{ mt: 1 }}>
              {syncResult.created} conversion rule{syncResult.created === 1 ? '' : 's'} opprettet
              {syncResult.failed > 0 ? ` — ${syncResult.failed} feilet (sjekk LinkedIn-tilgang + scope)` : ''}.
            </Alert>
          ) : null}
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', mt: 0.6 }}>
            Krever approval_status = 'approved'. Per action lages én rule med riktig conversion-type (LEAD/PURCHASE/etc.) basert på goal_category.
          </Typography>
        </Box>

        <Divider sx={{ borderColor: palette.border, my: 1.4 }} />

        {/* Steg 4: CAPI (gated) */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
            <LockOutlinedIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Steg 4 — Conversions API (server-side)
            </Typography>
            <Chip
              size="small"
              label="Venter på LinkedIn-godkjenning"
              sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24', fontWeight: 700, height: 20, fontSize: '0.68rem' }}
            />
          </Stack>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', mb: 1 }}>
            LinkedIn CAPI lar oss sende conversion-events server-side (kritisk for ITP/ETP-blokkering og offline-konverteringer). LinkedIn Conversions API (Standard tier) er "Review in progress" — token-feltet er klart for når godkjenning lander.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              type="password"
              placeholder="LinkedIn CAPI access token"
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
