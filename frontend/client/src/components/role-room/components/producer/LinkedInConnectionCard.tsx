import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  OpenInNew as OpenInNewIcon,
  Email as EmailIcon,
  WarningAmber as WarningIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomLinkedInProfile,
} from '../../services/roleRoomAgentService';
import SocialAccessRequestDialog from './SocialAccessRequestDialog';

interface LinkedInConnectionCardProps {
  projectId: string;
}

const EMPTY_PROFILE: RoleRoomLinkedInProfile = {
  connected: false,
  connectionId: null,
  memberId: null,
  email: null,
  name: null,
  profilePictureUrl: null,
  publishReady: false,
  organizationPublishReady: false,
  reconnectRequired: false,
  scopes: [],
  expiryDate: null,
};

const OAUTH_POLL_INTERVAL_MS = 1_500;
const OAUTH_TIMEOUT_MS = 2 * 60_000;

function isLinkedInConnectedMessage(event: MessageEvent): boolean {
  if (event.origin !== window.location.origin || !event.data || typeof event.data !== 'object') {
    return false;
  }
  const type = (event.data as { type?: string }).type;
  return type === 'linkedin-connected' || type === 'role-room:linkedin-connected';
}

function formatExpiry(expiryDate: string | null): string | null {
  if (!expiryDate) return null;
  const date = new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [profile, setProfile] = useState<RoleRoomLinkedInProfile>(EMPTY_PROFILE);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const oauthNeedsOrganizationRef = useRef(false);

  const stopOauthWatch = useCallback(() => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  }, []);

  const refresh = useCallback(async (showLoading = true): Promise<RoleRoomLinkedInProfile | null> => {
    if (showLoading) setLoading(true);
    try {
      const result = await roleRoomAgentService.fetchLinkedInProfile(projectId);
      setProfile(result);
      setError(null);
      window.dispatchEvent(new CustomEvent('role-room:linkedin-connection-updated', {
        detail: result,
      }));
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke hente LinkedIn-status.');
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [projectId]);

  const completeOauth = useCallback(async (popupClosed = false) => {
    const result = await refresh(false);
    const reachedRequestedReadiness = Boolean(
      result?.publishReady
      && (!oauthNeedsOrganizationRef.current || result.organizationPublishReady),
    );
    if (reachedRequestedReadiness) {
      stopOauthWatch();
      setConnecting(false);
      oauthNeedsOrganizationRef.current = false;
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      popupRef.current = null;
      return;
    }
    if (popupClosed) {
      stopOauthWatch();
      setConnecting(false);
      popupRef.current = null;
      setError(
        oauthNeedsOrganizationRef.current && result?.publishReady
          ? 'LinkedIn er klar for personlig publisering, men mangler fortsatt w_organization_social for bedriftssider.'
          : result?.connected
          ? 'LinkedIn er tilkoblet, men mangler gyldig w_member_social-tilgang. Koble til på nytt.'
          : 'LinkedIn-vinduet ble lukket før tilkoblingen ble publiseringsklar.',
      );
      oauthNeedsOrganizationRef.current = false;
    }
  }, [refresh, stopOauthWatch]);

  useEffect(() => {
    void refresh();
    const onMessage = (event: MessageEvent) => {
      if (isLinkedInConnectedMessage(event)) void completeOauth(false);
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      stopOauthWatch();
    };
  }, [completeOauth, refresh, stopOauthWatch]);

  async function startOauth() {
    stopOauthWatch();
    oauthNeedsOrganizationRef.current = profile.publishReady && !profile.organizationPublishReady;
    setConnecting(true);
    setError(null);
    const popup = window.open('', 'li-oauth', 'width=720,height=820,resizable=yes');
    if (!popup) {
      setConnecting(false);
      setError('Popupen ble blokkert. Tillat popup for denne siden og prøv igjen.');
      return;
    }
    popupRef.current = popup;
    try {
      const result = await roleRoomAgentService.startLinkedInOauth({
        projectId,
        returnPath: `${window.location.pathname}${window.location.search}`,
        browserOrigin: window.location.origin,
      });
      popup.location.assign(result.authorizationUrl);
      pollRef.current = window.setInterval(() => {
        const currentPopup = popupRef.current;
        if (!currentPopup) return;
        void completeOauth(currentPopup.closed);
      }, OAUTH_POLL_INTERVAL_MS);
      timeoutRef.current = window.setTimeout(() => {
        stopOauthWatch();
        setConnecting(false);
        setError('LinkedIn-tilkoblingen tok for lang tid. Lukk vinduet og prøv igjen.');
      }, OAUTH_TIMEOUT_MS);
    } catch (caught) {
      popup.close();
      popupRef.current = null;
      setConnecting(false);
      setError(caught instanceof Error ? caught.message : 'Kunne ikke starte LinkedIn OAuth.');
    }
  }

  const personalReady = profile.publishReady && Boolean(profile.connectionId);
  const organizationReady = personalReady && profile.organizationPublishReady;
  const expiryLabel = formatExpiry(profile.expiryDate);

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
        {personalReady ? (
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label="Publiseringsklar"
            data-testid="linkedin-publish-ready-state"
            sx={{
              ml: 1,
              fontWeight: 700,
              color: '#86efac',
              bgcolor: 'rgba(134,239,172,0.08)',
              border: '1px solid rgba(134,239,172,0.3)',
              '& .MuiChip-icon': { color: '#86efac' },
            }}
          />
        ) : profile.connected ? (
          <Chip
            size="small"
            icon={<WarningIcon sx={{ fontSize: 14 }} />}
            label="Koble til på nytt"
            data-testid="linkedin-reconnect-required-state"
            sx={{
              ml: 1,
              fontWeight: 700,
              color: '#fde68a',
              bgcolor: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.35)',
              '& .MuiChip-icon': { color: '#fbbf24' },
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
        <Stack spacing={1}>
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
                color: 'var(--role-cyan, #7dd3fc)',
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

          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={personalReady ? 'Personlig profil: klar' : 'Personlig profil: mangler w_member_social'}
              sx={{
                color: personalReady ? '#86efac' : '#fde68a',
                bgcolor: personalReady ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.08)',
                fontSize: '0.68rem',
              }}
            />
            <Chip
              size="small"
              label={organizationReady ? 'Bedriftssider: klar' : 'Bedriftssider: ekstra scope kreves'}
              sx={{
                color: organizationReady ? '#86efac' : '#bfdbfe',
                bgcolor: organizationReady ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.08)',
                fontSize: '0.68rem',
              }}
            />
          </Stack>

          {!personalReady ? (
            <Typography sx={{ color: '#fde68a', fontSize: '0.76rem' }}>
              {profile.reconnectRequired
                ? 'Tokenet er utløpt eller mangler publiseringsscope. Koble til på nytt før du publiserer.'
                : 'Kontoen er tilkoblet, men er ikke publiseringsklar ennå.'}
            </Typography>
          ) : !organizationReady ? (
            <Typography sx={{ color: 'rgba(191,219,254,0.9)', fontSize: '0.76rem' }}>
              Personlig publisering er klar. Bedriftssider krever w_organization_social og adminrolle på siden.
            </Typography>
          ) : (
            <Typography sx={{ color: 'rgba(134,239,172,0.9)', fontSize: '0.76rem' }}>
              Klar for publisering som personlig profil og som bedriftssider du administrerer.
            </Typography>
          )}

          {expiryLabel ? (
            <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.68rem' }}>
              Token utløper: {expiryLabel}
            </Typography>
          ) : null}

          {!personalReady || !organizationReady ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                size="small"
                startIcon={connecting ? <CircularProgress size={14} color="inherit" /> : <OpenInNewIcon fontSize="small" />}
                onClick={startOauth}
                disabled={connecting}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0a66c2', '&:hover': { bgcolor: '#0958a8' } }}
              >
                {connecting
                  ? 'Venter på LinkedIn…'
                  : personalReady
                    ? 'Aktiver bedriftspublisering'
                    : 'Koble til på nytt'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EmailIcon sx={{ fontSize: '0.95rem' }} />}
                onClick={() => setAccessDialogOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.82rem', color: '#93c5fd', borderColor: 'rgba(59,130,246,0.4)' }}
              >
                Be kunden om sidetilgang
              </Button>
            </Stack>
          ) : null}
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
              {connecting ? 'Venter på LinkedIn…' : 'Koble LinkedIn'}
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
        </Stack>
      )}

      {error ? (
        <Typography role="alert" sx={{ color: '#fca5a5', fontSize: '0.78rem' }}>{error}</Typography>
      ) : null}

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
