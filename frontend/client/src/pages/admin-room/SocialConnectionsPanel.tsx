/**
 * SocialConnectionsPanel — Marketing Cockpit social-koblings-status.
 *
 * Per plattform:
 *   - FB Page: vises som configured via env-var (THEROLERROOM_PAGE_*)
 *   - IG Business: configured via env-var (THEROLERROOM_IG_USER_ID)
 *   - LinkedIn: OAuth-tilkobling (admin user)
 *   - TikTok: OAuth-tilkobling med Connect/Disconnect knapper
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { adminTokens, adminSx, statusChipSx } from './styles';

interface ConnectionStatus {
  facebook: { configured: boolean; pageId?: string };
  instagram: { configured: boolean; userId?: string };
  linkedin: { connected: boolean; memberId?: string };
  tiktok: {
    connected: boolean;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    scopes?: string[];
  };
}

const EMPTY_STATUS: ConnectionStatus = {
  facebook: { configured: false },
  instagram: { configured: false },
  linkedin: { connected: false },
  tiktok: { connected: false },
};

function PlatformRow({
  icon, name, status, action, helper,
}: {
  icon: React.ReactElement;
  name: string;
  status: 'connected' | 'disconnected' | 'configured';
  action?: React.ReactElement;
  helper?: React.ReactElement;
}) {
  const statusMeta = {
    connected: { color: 'success' as const, label: 'Tilkoblet' },
    disconnected: { color: 'neutral' as const, label: 'Ikke tilkoblet' },
    configured: { color: 'info' as const, label: 'Konfigurert' },
  }[status];

  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{
      p: 1.5,
      background: adminTokens.bg.panel,
      borderRadius: 1,
      border: `1px solid ${adminTokens.border.subtle}`,
    }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: adminTokens.primary.softer }}>
        {icon}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, color: adminTokens.text.primary, fontSize: '0.92rem' }}>
          {name}
        </Typography>
        {helper && <Box sx={{ mt: 0.25 }}>{helper}</Box>}
      </Box>
      <Chip label={statusMeta.label} size="small" sx={statusChipSx(statusMeta.color)} />
      {action}
    </Stack>
  );
}

export default function SocialConnectionsPanel() {
  const [status, setStatus] = useState<ConnectionStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [connectingTikTok, setConnectingTikTok] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // 1. FB/IG fra env-var-status (via cockpit-summary)
      const cockpit = await fetch('/api/role-room/marketing-cockpit/summary?brandKey=theroleroom', {
        credentials: 'include',
      });
      const cockpitData = await cockpit.json().catch(() => ({}));
      const fbConfigured = !!cockpitData?.cta?.data?.configured || !!cockpitData?.profile?.data?.configured;
      const igConfigured = !!cockpitData?.ig?.data?.configured;

      // 2. TikTok-status
      const ttResp = await fetch('/api/role-room/tiktok/connection', { credentials: 'include' });
      const ttData = await ttResp.json().catch(() => ({}));

      // 3. LinkedIn-status: endepunktet finnes ikke ennå — hopper over
      // for å unngå 404-spam i konsollen. TODO: bygg connection-status-
      // endepunkt eller hent via eksisterende /linkedin/profile.
      const linkedinConnected = false;

      setStatus({
        facebook: { configured: fbConfigured, pageId: cockpitData?.profile?.data?.pageId },
        instagram: { configured: igConfigured, userId: cockpitData?.ig?.data?.igUserId },
        linkedin: { connected: linkedinConnected },
        tiktok: {
          connected: !!ttData?.connected || !!ttData?.connection?.connected,
          username: ttData?.username ?? ttData?.connection?.username,
          displayName: ttData?.displayName ?? ttData?.connection?.displayName,
          avatarUrl: ttData?.avatarUrl ?? ttData?.connection?.avatarUrl,
          scopes: ttData?.scopes ?? ttData?.connection?.scopes ?? [],
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object'
        && (event.data as { type?: string }).type === 'tiktok-connected') {
        void refresh();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh]);

  const startTikTokOauth = useCallback(async () => {
    setConnectingTikTok(true);
    setError(null);
    try {
      const r = await fetch('/api/role-room/tiktok/oauth/start', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: null,
          returnPath: window.location.pathname + window.location.search,
          browserOrigin: window.location.origin,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success || !d.authorizationUrl) {
        throw new Error(d.error || `OAuth start failed (status ${r.status})`);
      }
      const popup = window.open(d.authorizationUrl, 'tt-oauth', 'width=720,height=820,resizable=yes');
      if (!popup) {
        throw new Error('Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingTikTok(false);
    }
  }, []);

  const disconnectTikTok = useCallback(async () => {
    if (!confirm('Frakoble TikTok-kontoen?')) return;
    setConnectingTikTok(true);
    try {
      const r = await fetch('/api/role-room/tiktok/disconnect', {
        method: 'POST', credentials: 'include',
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `Disconnect failed (status ${r.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnectingTikTok(false);
    }
  }, [refresh]);

  return (
    <Card sx={adminSx.panel} data-testid="panel-social-connections">
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Box sx={{
            width: 28, height: 28, borderRadius: 1,
            background: adminTokens.primary.soft,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LinkIcon sx={{ color: adminTokens.primary.textBright, fontSize: 18 }} />
          </Box>
          <Typography sx={adminSx.sectionHeader}>Sosiale koblinger</Typography>
          <Box sx={{ flex: 1 }} />
          {loading && <CircularProgress size={16} sx={{ color: adminTokens.primary.textBright }} />}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>{error}</Alert>}

        <Stack spacing={1}>
          <PlatformRow
            icon={<FacebookIcon sx={{ color: '#60a5fa', fontSize: 18 }} />}
            name="Facebook Page"
            status={status.facebook.configured ? 'configured' : 'disconnected'}
            helper={status.facebook.configured ? (
              <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>
                Page-token via env-var (THEROLERROOM_PAGE_*)
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: adminTokens.status.warning.text }}>
                Sett THEROLERROOM_PAGE_ID + THEROLERROOM_PAGE_ACCESS_TOKEN på Render
              </Typography>
            )}
          />

          <PlatformRow
            icon={<InstagramIcon sx={{ color: '#ec4899', fontSize: 18 }} />}
            name="Instagram Business"
            status={status.instagram.configured ? 'configured' : 'disconnected'}
            helper={status.instagram.configured ? (
              <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>
                IG Business via env-var (THEROLERROOM_IG_USER_ID)
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ color: adminTokens.status.warning.text }}>
                Sett THEROLERROOM_IG_USER_ID på Render
              </Typography>
            )}
          />

          <PlatformRow
            icon={<LinkedInIcon sx={{ color: '#0ea5e9', fontSize: 18 }} />}
            name="LinkedIn"
            status={status.linkedin.connected ? 'connected' : 'disconnected'}
            helper={
              <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>
                Bruk LinkedIn-konsernens hovedconnection-side i Role Room for å koble til
              </Typography>
            }
          />

          <PlatformRow
            icon={<MusicNoteIcon sx={{ color: '#f97316', fontSize: 18 }} />}
            name="TikTok Business"
            status={status.tiktok.connected ? 'connected' : 'disconnected'}
            helper={status.tiktok.connected ? (
              <Stack direction="row" spacing={1} alignItems="center">
                {status.tiktok.avatarUrl && (
                  <Avatar sx={{ width: 18, height: 18 }} src={status.tiktok.avatarUrl} />
                )}
                <Typography variant="caption" sx={{ color: adminTokens.text.body, fontWeight: 600 }}>
                  @{status.tiktok.username || '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>
                  · {status.tiktok.displayName}
                </Typography>
                {status.tiktok.scopes?.includes('video.upload') && (
                  <CheckCircleIcon sx={{ fontSize: 12, color: adminTokens.status.success.base }} />
                )}
              </Stack>
            ) : (
              <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>
                Krever TikTok Developer App m/ video.upload-scope. Inbox-modus i v1 — bruker må selv åpne TikTok-appen for å publisere.
              </Typography>
            )}
            action={status.tiktok.connected ? (
              <Button
                size="small" startIcon={<LinkOffIcon />}
                onClick={() => void disconnectTikTok()} disabled={connectingTikTok}
                sx={{ color: adminTokens.status.error.base, textTransform: 'none' }}
                data-testid="tiktok-disconnect"
              >
                Frakoble
              </Button>
            ) : (
              <Button
                size="small" startIcon={connectingTikTok ? <CircularProgress size={12} /> : <LinkIcon />}
                onClick={() => void startTikTokOauth()} disabled={connectingTikTok}
                variant="contained" sx={adminSx.primaryButton}
                data-testid="tiktok-connect"
              >
                {connectingTikTok ? 'Åpner…' : 'Koble TikTok'}
              </Button>
            )}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
