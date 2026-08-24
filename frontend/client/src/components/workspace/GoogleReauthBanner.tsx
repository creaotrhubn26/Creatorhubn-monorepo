/**
 * GoogleReauthBanner — «SSO-liming» mellom innlogging og Google Workspace-
 * tilkoblingen. Login (ID-token) kan per Google-design ikke fornye API-
 * tilgangen, så når refresh-tokenet er revokert (state='needs_reauth')
 * viser vi et tydelig banner med ettklikks re-tilkobling: oauth/start
 * forhåndsvelger kontoen via login_hint, så Google-skjermen er én
 * bekreftelse. Sjekkes én gang per fane-sesjon; aldri for brukere som
 * aldri har koblet til (onboarding-kortet eier første gangs samtykke).
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, IconButton, CircularProgress } from '@mui/material';
import Close from '@mui/icons-material/Close';
import SyncProblem from '@mui/icons-material/SyncProblem';
import { apiRequest } from '@/lib/queryClient';
import { ws } from './workspaceTheme';

const DISMISS_KEY = 'google-reauth-banner-dismissed';

const GoogleReauthBanner: React.FC = () => {
  const [needsReauth, setNeedsReauth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkErr, setLinkErr] = useState<string | null>(null);

  useEffect(() => {
    // FULLFØR tilkoblingen når Google-callbacket returnerer hit: mode='link'
    // lagrer ikke tokenene i callbacket — de ligger i en transfer som
    // retursiden må hente (session-result) og binde (POST link). Tidligere
    // fantes denne koden bare i universaldashboardet, så en reconnect som
    // returnerte til /workspace forkastet tokenene i det stille og
    // tilkoblingen forble needs_reauth.
    const params = new URLSearchParams(window.location.search);
    const transferId = params.get('chGoogleTransfer');
    const cleanUrl = () => {
      const u = new URL(window.location.href);
      for (const k of ['chGoogleStatus', 'chGoogleMode', 'chGoogleTransfer', 'chGoogleMessage']) u.searchParams.delete(k);
      window.history.replaceState({}, '', u.toString());
    };
    if (params.get('chGoogleStatus') === 'error') {
      setLinkErr(params.get('chGoogleMessage') || 'Google-tilkoblingen feilet — prøv igjen.');
      setNeedsReauth(true);
      cleanUrl();
      return;
    }
    if (params.get('chGoogleStatus') === 'success' && params.get('chGoogleMode') === 'link' && transferId) {
      cleanUrl();
      void (async () => {
        try {
          await apiRequest(`/api/creatorhub/google/oauth/session-result/${encodeURIComponent(transferId)}`);
          await apiRequest('/api/creatorhub/google/link', { method: 'POST', body: { transferId } });
          setNeedsReauth(false);
          window.dispatchEvent(new CustomEvent('creatorhub-google-workspace-linked', { detail: { transferId } }));
        } catch {
          setLinkErr('Kunne ikke fullføre Google-tilkoblingen — prøv igjen.');
          setNeedsReauth(true);
        }
      })();
      return;
    }
    try { if (sessionStorage.getItem(DISMISS_KEY)) return; } catch { /* */ }
    apiRequest('/api/creatorhub/google/status')
      .then((r: any) => { if (r?.state === 'needs_reauth') setNeedsReauth(true); })
      .catch(() => {});
  }, []);

  if (!needsReauth) return null;

  const reconnect = async () => {
    setBusy(true);
    try {
      const r: any = await apiRequest('/api/creatorhub/google/oauth/start', { method: 'POST', body: {
        mode: 'link', returnPath: window.location.pathname + window.location.search, browserOrigin: window.location.origin,
      } });
      if (r?.authorizationUrl) { window.location.href = r.authorizationUrl; return; }
    } catch { /* */ }
    setBusy(false);
  };
  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* */ }
    setNeedsReauth(false);
  };

  return (
    <Box sx={{ mb: 2, px: 1.75, py: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <SyncProblem sx={{ fontSize: 20, color: ws.amber }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: ws.text }}>Google-tilkoblingen må fornyes</Typography>
        <Typography sx={{ fontSize: 12, color: ws.textDim }}>
          {linkErr || 'Google har trukket tilbake tilgangen (skjer bl.a. ved passordbytte). Drive, kalender og backup er pauset til du kobler til på nytt.'}
        </Typography>
      </Box>
      <Button size="small" variant="contained" onClick={reconnect} disabled={busy}
        startIcon={busy ? <CircularProgress size={14} /> : undefined}
        sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, flexShrink: 0, '&:hover': { bgcolor: ws.accent } }}>
        Koble til på nytt
      </Button>
      <IconButton size="small" onClick={dismiss} sx={{ color: ws.textFaint }}><Close sx={{ fontSize: 16 }} /></IconButton>
    </Box>
  );
};

export default GoogleReauthBanner;
