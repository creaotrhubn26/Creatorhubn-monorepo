import { useEffect, useState } from 'react';
import { Avatar, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  OpenInNew as OpenInNewIcon,
  Email as EmailIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomTikTokConnection,
} from '../../services/roleRoomAgentService';
import SocialAccessRequestDialog from './SocialAccessRequestDialog';

interface TikTokConnectionCardProps {
  projectId: string;
}

/**
 * TikTok connection card. Mirror of LinkedInConnectionCard.
 *
 * Status:
 *   - Disconnected → Connect-CTA (popup OAuth) + Be om tilgang-CTA hvis
 *     kunden eier kontoen
 *   - Connected → vis avatar + display_name + scope-state + Frakoble
 *
 * Merknad: TikTok-publisering går til kreatorens TikTok-app-inbox i
 * inbox-mode (default). Kreator må selv åpne appen og publisere.
 * Direct publish krever ekstra TikTok App Review.
 */
export default function TikTokConnectionCard({
  projectId,
}: TikTokConnectionCardProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<RoleRoomTikTokConnection>({
    connected: false,
    openId: null,
    username: null,
    displayName: null,
    avatarUrl: null,
    scopes: [],
    expiryDate: null,
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    const result = await roleRoomAgentService.fetchTikTokConnection();
    setConnection(result);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const onMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === 'object' &&
        (event.data as { type?: string }).type === 'tiktok-connected'
      ) {
        void refresh();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function startOauth() {
    setConnecting(true);
    setError(null);
    const result = await roleRoomAgentService.startTikTokOauth({ projectId });
    if (result.error || !result.authorizationUrl) {
      setError(result.error ?? 'Kunne ikke starte TikTok OAuth.');
      setConnecting(false);
      return;
    }
    const popup = window.open(
      result.authorizationUrl,
      'tt-oauth',
      'width=720,height=820,resizable=yes',
    );
    if (!popup) {
      setError('Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.');
    }
    setConnecting(false);
  }

  async function disconnect() {
    setConnecting(true);
    setError(null);
    const result = await roleRoomAgentService.disconnectTikTok();
    if (result.error) setError(result.error);
    await refresh();
    setConnecting(false);
  }

  return (
    <Stack
      spacing={1}
      data-testid="tiktok-connection-card"
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.16)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: 0.6,
            bgcolor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 800,
          }}
        >
          ♪
        </Box>
        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }}>
          TikTok-publisering
        </Typography>
        {connection.connected ? (
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label="Koblet"
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

      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={14} />
          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.78rem' }}>
            Sjekker TikTok-status…
          </Typography>
        </Stack>
      ) : connection.connected ? (
        <Stack
          direction="row"
          spacing={1.2}
          alignItems="center"
          sx={{
            p: 0.9,
            borderRadius: 1.4,
            bgcolor: 'rgba(15,23,42,0.65)',
            border: '1px solid rgba(148,163,184,0.18)',
          }}
        >
          <Avatar
            src={connection.avatarUrl ?? undefined}
            alt={connection.displayName ?? 'TikTok'}
            sx={{
              width: 38,
              height: 38,
              bgcolor: 'rgba(34,211,238,0.18)',
              color: '#67e8f9',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: '1px solid rgba(34,211,238,0.4)',
            }}
          >
            {(connection.displayName ?? 'TT').charAt(0)}
          </Avatar>
          <Stack spacing={0.1} sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                color: '#e2e8f0',
                fontSize: '0.88rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {connection.displayName ?? connection.username ?? 'TikTok-konto'}
            </Typography>
            {connection.username ? (
              <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.72rem' }}>
                @{connection.username}
              </Typography>
            ) : null}
          </Stack>
          <Button
            size="small"
            variant="text"
            startIcon={<LinkOffIcon sx={{ fontSize: '0.95rem' }} />}
            onClick={disconnect}
            disabled={connecting}
            sx={{
              textTransform: 'none',
              fontSize: '0.74rem',
              color: 'rgba(252,165,165,0.85)',
              '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' },
            }}
          >
            Frakoble
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' }}>
            Koble TikTok for å sende videoer rett til kreatorens TikTok-inbox. Hvis kunden eier
            kontoen, kan vi sende dem en e-post som inviterer deg som Operator.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              startIcon={
                connecting ? (
                  <CircularProgress size={14} sx={{ color: 'inherit' }} />
                ) : (
                  <OpenInNewIcon fontSize="small" />
                )
              }
              onClick={startOauth}
              disabled={connecting}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#000',
                '&:hover': { bgcolor: '#1a1a1a' },
              }}
            >
              {connecting ? 'Åpner TikTok…' : 'Koble TikTok'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EmailIcon sx={{ fontSize: '0.95rem' }} />}
              onClick={() => setAccessDialogOpen(true)}
              sx={{
                textTransform: 'none',
                fontSize: '0.82rem',
                color: '#93c5fd',
                borderColor: 'rgba(59,130,246,0.4)',
              }}
            >
              Be kunden om tilgang
            </Button>
          </Stack>
          {error ? (
            <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem' }}>{error}</Typography>
          ) : null}
        </Stack>
      )}

      <SocialAccessRequestDialog
        open={accessDialogOpen}
        onClose={() => setAccessDialogOpen(false)}
        projectId={projectId}
        platform="tiktok"
        platformLabel="TikTok"
      />
    </Stack>
  );
}
