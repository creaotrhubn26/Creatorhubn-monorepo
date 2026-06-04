import { useEffect, useState } from 'react';
import { Avatar, Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  AddCircleOutline as ConnectIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { InstagramBrandLogo } from './SocialBrandLogo';
import roleRoomAgentService, {
  type RoleRoomInstagramConnection,
} from '../../services/roleRoomAgentService';

interface PlatformSlot {
  id: 'instagram' | 'facebook_page' | 'tiktok' | 'linkedin' | 'youtube' | 'x' | 'threads';
  label: string;
  shortLabel: string;
  color: string;
  status: 'connected' | 'available' | 'coming_soon';
  hint?: string;
  followerCount?: number | null;
  username?: string | null;
  profilePictureUrl?: string | null;
}

interface RoleRoomAgentConnectionsBarProps {
  projectId: string;
  /** Trigger Instagram OAuth on click. Provided by parent so vi kan
   *  åpne i samme browser-context og refreshe ved tilbakekomst. */
  onConnectInstagram?: () => void;
  /** Connect FB Page bruker samme OAuth som IG (Pages discoveres parallelt). */
  onConnectFacebookPage?: () => void;
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function RoleRoomAgentConnectionsBar({
  projectId,
  onConnectInstagram,
  onConnectFacebookPage,
}: RoleRoomAgentConnectionsBarProps): React.ReactElement {
  const [igConnections, setIgConnections] = useState<RoleRoomInstagramConnection[]>([]);
  const [linkedInProfile, setLinkedInProfile] = useState<{
    connected: boolean;
    name?: string | null;
    profilePictureUrl?: string | null;
  }>({ connected: false });
  const [tiktokProfile, setTiktokProfile] = useState<{
    connected: boolean;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  }>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [igData, liData, ttData] = await Promise.all([
          roleRoomAgentService.listInstagramConnections(),
          roleRoomAgentService.fetchLinkedInProfile(),
          roleRoomAgentService.fetchTikTokConnection(),
        ]);
        if (cancelled) return;
        setIgConnections(igData.connections ?? []);
        setLinkedInProfile({
          connected: liData.connected,
          name: liData.name,
          profilePictureUrl: liData.profilePictureUrl,
        });
        setTiktokProfile({
          connected: ttData.connected,
          displayName: ttData.displayName,
          username: ttData.username,
          avatarUrl: ttData.avatarUrl,
        });
      } catch (err) {
        // Previously a rejection here left `loading` stuck true forever and
        // swallowed the error — the bar just showed a permanent spinner.
        if (!cancelled) {
          setLoadError('Kunne ikke hente tilkoblinger. Prøv å laste siden på nytt.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Bygg slots: én rad per IG-konto + én rad per FB-page-id (kan være
  // duplikater hvis IG og FB ligger i samme rad).
  const slots: PlatformSlot[] = [];
  if (igConnections.length === 0) {
    slots.push({
      id: 'instagram',
      label: 'Instagram',
      shortLabel: 'IG',
      color: '#ec4899',
      status: 'available',
      hint: 'Koble Business eller Creator-konto',
    });
    slots.push({
      id: 'facebook_page',
      label: 'Facebook Page',
      shortLabel: 'FB',
      color: '#3b82f6',
      status: 'available',
      hint: 'Page-publisering + comments',
    });
  } else {
    for (const c of igConnections) {
      slots.push({
        id: 'instagram',
        label: c.igUsername ? `@${c.igUsername}` : 'Instagram',
        shortLabel: 'IG',
        color: '#ec4899',
        status: 'connected',
        followerCount: c.followersCount,
        username: c.igUsername,
        profilePictureUrl: c.profilePictureUrl,
      });
      if (c.facebookPageName) {
        slots.push({
          id: 'facebook_page',
          label: c.facebookPageName,
          shortLabel: 'FB',
          color: '#3b82f6',
          status: 'connected',
          username: c.facebookPageName,
        });
      }
    }
  }

  // LinkedIn er live for text + image. Hvis brukeren har en aktiv kobling,
  // viser vi connected slot med navn/avatar (samme nivå som IG); ellers
  // viser vi den som available med Connect-CTA.
  const linkedInSlot: PlatformSlot = linkedInProfile.connected
    ? {
        id: 'linkedin',
        label: linkedInProfile.name ?? 'LinkedIn',
        shortLabel: 'LI',
        color: '#0a66c2',
        status: 'connected',
        username: linkedInProfile.name ?? null,
        profilePictureUrl: linkedInProfile.profilePictureUrl ?? null,
      }
    : {
        id: 'linkedin',
        label: 'LinkedIn',
        shortLabel: 'LI',
        color: '#0a66c2',
        status: 'available',
        hint: 'Tekst, bilde, video og lenke-posts',
      };

  // TikTok er live for inbox-mode publisering (kreator publiserer fra app).
  const tiktokSlot: PlatformSlot = tiktokProfile.connected
    ? {
        id: 'tiktok',
        label: tiktokProfile.displayName ?? tiktokProfile.username ?? 'TikTok',
        shortLabel: 'TT',
        color: '#22d3ee',
        status: 'connected',
        username: tiktokProfile.username ?? null,
        profilePictureUrl: tiktokProfile.avatarUrl ?? null,
      }
    : {
        id: 'tiktok',
        label: 'TikTok',
        shortLabel: 'TT',
        color: '#22d3ee',
        status: 'available',
        hint: 'Video til kreators TikTok-inbox',
      };

  // Plattformer som ikke er ferdig integrert vises som "available" med hint
  // for å fortelle bruker hva som er på veikartet.
  const comingSoon: PlatformSlot[] = [
    tiktokSlot,
    linkedInSlot,
    {
      id: 'youtube',
      label: 'YouTube',
      shortLabel: 'YT',
      color: '#ef4444',
      status: 'available',
      hint: 'Shorts (≤60s vertikal video)',
    },
  ];

  return (
    <Stack
      direction="row"
      spacing={1}
      data-testid="role-room-agent-connections-bar"
      alignItems="center"
      sx={{
        px: { xs: 1, md: 2 },
        py: 0.8,
        bgcolor: 'rgba(15,23,42,0.4)',
        borderBottom: '1px solid rgba(148,163,184,0.12)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{
          color: 'rgba(226,232,240,0.55)',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
          minWidth: { xs: 60, md: 80 },
        }}
      >
        Kontoer
      </Typography>
      <Stack direction="row" spacing={0.8} sx={{ flex: 1 }}>
        {[...slots, ...comingSoon].map((slot, idx) => {
          if (slot.status === 'coming_soon') {
            return (
              <Tooltip key={`${slot.id}-${idx}`} title={`${slot.label} kommer i neste fase`} disableInteractive>
                <Chip
                  size="small"
                  label={slot.shortLabel}
                  data-testid={`connection-slot-${slot.id}`}
                  data-status="coming_soon"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(148,163,184,0.10)',
                    color: 'rgba(226,232,240,0.4)',
                    border: '1px dashed rgba(148,163,184,0.3)',
                  }}
                />
              </Tooltip>
            );
          }
          if (slot.status === 'available') {
            return (
              <Tooltip key={`${slot.id}-${idx}`} title={slot.hint ?? 'Koble konto'} disableInteractive>
                <Chip
                  size="small"
                  icon={<ConnectIcon fontSize="small" />}
                  label={slot.label}
                  data-testid={`connection-slot-${slot.id}`}
                  data-status="available"
                  onClick={
                    slot.id === 'instagram'
                      ? onConnectInstagram
                      : slot.id === 'facebook_page'
                        ? onConnectFacebookPage ?? onConnectInstagram
                        : undefined
                  }
                  clickable={Boolean(onConnectInstagram)}
                  sx={{
                    height: 24,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    bgcolor: `${slot.color}1F`,
                    color: slot.color,
                    border: `1px solid ${slot.color}55`,
                    '& .MuiChip-icon': { color: slot.color, fontSize: '0.95rem' },
                    '&:hover': { bgcolor: `${slot.color}33` },
                  }}
                />
              </Tooltip>
            );
          }
          // Tokens er sømløse: proaktiv refresh-worker holder dem friskte
          // bak kulissene. UI-en viser ingen countdown — kun en diskret
          // rød-flagging hvis connection_state faktisk har slipt til
          // 'expired' (refresh feilet og brukeren MÅ reconnecte).
          return (
            <Tooltip
              key={`${slot.id}-${idx}`}
              title={`${slot.label}${slot.followerCount != null ? ` · ${formatCount(slot.followerCount)} følgere` : ''}`}
              disableInteractive
            >
              <Stack
                direction="row"
                spacing={0.6}
                alignItems="center"
                data-testid={`connection-slot-${slot.id}`}
                data-status="connected"
                sx={{
                  height: 24,
                  pl: 0.4,
                  pr: 0.8,
                  borderRadius: 99,
                  bgcolor: `${slot.color}1F`,
                  color: slot.color,
                  border: `1px solid ${slot.color}55`,
                }}
              >
                {slot.profilePictureUrl ? (
                  <Avatar
                    src={slot.profilePictureUrl}
                    alt={slot.username ?? slot.label}
                    sx={{ width: 18, height: 18, fontSize: '0.7rem' }}
                  />
                ) : (
                  <CheckIcon sx={{ fontSize: '0.95rem' }} />
                )}
                <Typography
                  sx={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: slot.color,
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {slot.label}
                </Typography>
                {slot.followerCount != null ? (
                  <Typography sx={{ fontSize: '0.66rem', color: `${slot.color}cc`, opacity: 0.85 }}>
                    {formatCount(slot.followerCount)}
                  </Typography>
                ) : null}
              </Stack>
            </Tooltip>
          );
        })}
      </Stack>
      {loadError ? (
        <Tooltip title={loadError} disableInteractive>
          <Box
            sx={{
              fontSize: '0.7rem', color: '#fca5a5', fontWeight: 700, px: 0.8, py: 0.2,
              borderRadius: 1, bgcolor: 'rgba(248,113,113,0.12)',
              border: '1px solid rgba(248,113,113,0.35)', flexShrink: 0,
            }}
            data-testid="connections-bar-error"
          >
            Tilkoblinger feilet
          </Box>
        </Tooltip>
      ) : null}
      {loading || loadError ? null : igConnections.length === 0 ? (
        <Tooltip title="Du må koble en konto for å begynne å publisere og lytte" disableInteractive>
          <Box
            sx={{
              fontSize: '0.7rem',
              color: '#fbbf24',
              fontWeight: 700,
              px: 0.8,
              py: 0.2,
              borderRadius: 1,
              bgcolor: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.3)',
              flexShrink: 0,
            }}
          >
            Start her
          </Box>
        </Tooltip>
      ) : null}
    </Stack>
  );
}
