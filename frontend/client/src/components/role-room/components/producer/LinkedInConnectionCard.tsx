import { useEffect, useState } from 'react';
import { Avatar, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  OpenInNew as OpenInNewIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';
import SocialAccessRequestDialog from './SocialAccessRequestDialog';

interface LinkedInConnectionCardProps {
  projectId: string;
}

/**
 * Speiler InstagramConnectionCard for LinkedIn:
 *  - Henter LinkedIn-profil fra /linkedin/profile
 *  - Connect-CTA hvis ikke koblet
 *  - "Be kunden om tilgang"-CTA hvis kunden eier siden
 *  - Connected state viser navn + avatar
 */
export default function LinkedInConnectionCard({
  projectId,
}: LinkedInConnectionCardProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    connected: boolean;
    name?: string | null;
    profilePictureUrl?: string | null;
    email?: string | null;
  }>({ connected: false });
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const result = await roleRoomAgentService.fetchLinkedInProfile();
    setProfile({
      connected: result.connected,
      name: result.name,
      profilePictureUrl: result.profilePictureUrl,
      email: result.email,
    });
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const onMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === 'object' &&
        (event.data as { type?: string }).type === 'linkedin-connected'
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
    try {
      const response = await fetch('/api/role-room/linkedin/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          returnPath: window.location.pathname + window.location.search,
          browserOrigin: window.location.origin,
        }),
        credentials: 'include',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data.authorizationUrl) {
        setError(data?.error ?? 'Kunne ikke starte LinkedIn OAuth.');
        return;
      }
      const popup = window.open(
        data.authorizationUrl,
        'li-oauth',
        'width=720,height=820,resizable=yes',
      );
      if (!popup) {
        setError('Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Stack
      spacing={1}
      data-testid="linkedin-connection-card"
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
            bgcolor: '#0a66c2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 800,
          }}
        >
          in
        </Box>
        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }}>
          LinkedIn-publisering
        </Typography>
        {profile.connected ? (
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
            Sjekker LinkedIn-status…
          </Typography>
        </Stack>
      ) : profile.connected ? (
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
            src={profile.profilePictureUrl ?? undefined}
            alt={profile.name ?? 'LinkedIn'}
            sx={{
              width: 38,
              height: 38,
              bgcolor: 'rgba(10,102,194,0.18)',
              color: '#7dd3fc',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: '1px solid rgba(10,102,194,0.4)',
            }}
          >
            {(profile.name ?? 'LI').charAt(0)}
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
              {profile.name ?? 'LinkedIn-konto'}
            </Typography>
            {profile.email ? (
              <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.72rem' }}>
                {profile.email}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' }}>
            Koble LinkedIn for å publisere som personlig profil eller bedriftsside. Hvis kunden eier
            bedriftssiden, kan vi sende dem en e-post som inviterer deg som Innholdsadministrator.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              startIcon={connecting ? (
                <CircularProgress size={14} sx={{ color: 'inherit' }} />
              ) : (
                <OpenInNewIcon fontSize="small" />
              )}
              onClick={startOauth}
              disabled={connecting}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#0a66c2',
                '&:hover': { bgcolor: '#0958a8' },
              }}
            >
              {connecting ? 'Åpner LinkedIn…' : 'Koble LinkedIn'}
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
        platform="linkedin"
        platformLabel="LinkedIn"
      />
    </Stack>
  );
}
