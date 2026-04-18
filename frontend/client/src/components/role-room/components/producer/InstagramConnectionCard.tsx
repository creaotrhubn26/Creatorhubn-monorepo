import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  LinkOff as LinkOffIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomInstagramConnection,
} from '../../services/roleRoomAgentService';
import { InstagramBrandLogo } from './SocialBrandLogo';

type InstagramConnectionCardProps = {
  projectId: string;
  /** Showrunner-tier? Only then can the user actually publish. */
  showrunner: boolean;
  onConnectionsChange?: (connections: RoleRoomInstagramConnection[]) => void;
};

export default function InstagramConnectionCard({
  projectId,
  showrunner,
  onConnectionsChange,
}: InstagramConnectionCardProps) {
  const [loading, setLoading] = useState(true);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [imageHostingConfigured, setImageHostingConfigured] = useState(false);
  const [connections, setConnections] = useState<RoleRoomInstagramConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await roleRoomAgentService.listInstagramConnections();
      setMetaConfigured(data.metaConfigured);
      setImageHostingConfigured(data.imageHostingConfigured);
      setConnections(data.connections);
      onConnectionsChange?.(data.connections);
    } catch {
      setError('Klarte ikke å hente Instagram-tilkoblinger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && (event.data as { type?: string }).type === 'instagram-connected') {
        void refresh();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startOauth = async () => {
    setConnecting(true);
    try {
      const result = await roleRoomAgentService.startInstagramOauth(projectId);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const popup = window.open(result.url, 'ig-oauth', 'width=720,height=820,resizable=yes');
      if (!popup) {
        setError('Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Koble fra denne Instagram-kontoen?')) return;
    await roleRoomAgentService.revokeInstagramConnection(id);
    await refresh();
  };

  if (!showrunner) {
    // Spotlight/Headliner: hide the connection UI entirely; tier-upsell is
    // surfaced from the publish button instead.
    return null;
  }

  return (
    <Stack
      spacing={1}
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.16)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <InstagramBrandLogo size={22} />
        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }}>
          Instagram-publisering
        </Typography>
        {connections.length > 0 ? (
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={`${connections.length} koblet`}
            sx={{
              ml: 1,
              fontWeight: 700,
              color: '#86efac',
              bgcolor: 'rgba(134,239,172,0.08)',
              border: '1px solid rgba(134,239,172,0.3)',
              '& .MuiChip-icon': { color: '#86efac' },
            }}
          />
        ) : null}
      </Stack>

      {!metaConfigured ? (
        <Alert
          severity="warning"
          sx={{
            bgcolor: 'rgba(234,179,8,0.08)',
            color: '#fde68a',
            border: '1px solid rgba(234,179,8,0.25)',
          }}
        >
          Meta App er ikke konfigurert i backend ennå (mangler META_APP_ID/META_APP_SECRET). IG-publisering blir tilgjengelig så snart Meta App Review er godkjent.
        </Alert>
      ) : !imageHostingConfigured ? (
        <Alert
          severity="warning"
          sx={{
            bgcolor: 'rgba(234,179,8,0.08)',
            color: '#fde68a',
            border: '1px solid rgba(234,179,8,0.25)',
          }}
        >
          R2 image hosting er ikke konfigurert (mangler R2_ENDPOINT/BUCKET/keys). Bilder må hostes offentlig før Meta kan hente dem.
        </Alert>
      ) : connections.length === 0 ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' }}>
            Koble en Instagram Business-konto (linket til en Facebook Page) for å publisere direkte fra feed-planneren.
          </Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={startOauth}
            disabled={connecting || loading}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #f58529 0%, #DD2A7B 50%, #515BD4 100%)',
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 4px 16px rgba(221,42,123,0.3)' },
            }}
          >
            Koble Instagram
          </Button>
        </Stack>
      ) : (
        <Stack spacing={0.6}>
          {connections.map((c) => (
            <Stack
              key={c.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                p: 0.8,
                borderRadius: 1.4,
                bgcolor: 'rgba(15,23,42,0.65)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.86rem' }}>
                  @{c.igUsername ?? c.igBusinessAccountId}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>
                  Page: {c.facebookPageName ?? '—'}{c.tokenExpiresAt ? ` · token utløper ${new Date(c.tokenExpiresAt).toLocaleDateString('nb-NO')}` : ''}
                </Typography>
              </Box>
              <Tooltip title="Koble fra">
                <IconButton size="small" onClick={() => revoke(c.id)} sx={{ color: 'rgba(248,113,113,0.85)' }}>
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
          <Button
            size="small"
            startIcon={<OpenInNewIcon fontSize="small" />}
            onClick={startOauth}
            disabled={connecting || loading}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              fontWeight: 600,
              color: 'rgba(226,232,240,0.7)',
              fontSize: '0.74rem',
              '&:hover': { bgcolor: 'rgba(34,211,238,0.06)' },
            }}
          >
            Koble en til
          </Button>
        </Stack>
      )}

      {error ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca' }}>
          {error}
        </Alert>
      ) : null}
    </Stack>
  );
}
