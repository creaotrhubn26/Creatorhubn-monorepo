/**
 * SocialProfileCandidatesPreview — item #20.
 *
 * Renders the bootstrap's socialProfileCandidates as branded preview
 * cards inside the Research Complete overlay. Doesn't fetch live profile
 * data (which would require per-platform OAuth) — instead surfaces what
 * the bootstrap already discovered: platform, canonical URL, displayName,
 * handle, confidence and verification status, plus a one-click "open
 * profile" link to the real account.
 *
 * Why this design vs. true live previews:
 *   - Instagram Graph API now requires a long-lived user token tied to
 *     the customer's IG Business account — we don't have that during
 *     research, so a "live preview" would have to be a server-side
 *     unauthenticated scrape, which Instagram actively blocks.
 *   - oEmbed for TikTok/YouTube does exist but adds a new pipeline
 *     stage. Out of scope for this batch.
 * The card design follows each platform's brand color so the user can
 * at a glance see "yes, this is the right Instagram for this brand."
 */

import React from 'react';
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import {
  Instagram as InstagramIcon,
  Facebook as FacebookIcon,
  LinkedIn as LinkedInIcon,
  YouTube as YouTubeIcon,
  MusicNote as TikTokIcon,
  Twitter as TwitterIcon,
  AlternateEmail as ThreadsIcon,
  VideoLibrary as VimeoIcon,
  PushPin as PinterestIcon,
  Public as GenericIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as VerifiedIcon,
  HelpOutline as UnclearIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { RoleRoomAgentSocialProfileCandidate } from '../../services/roleRoomAgentService';

/** Platforms with an OAuth-start endpoint we can dypelink to. Others
 *  show a disabled Connect-button with "Snart" hint. Keep in sync with
 *  backend-side OAuth route registration. */
const CONNECT_OAUTH_URLS: Partial<Record<RoleRoomAgentSocialProfileCandidate['platform'], (projectId: string) => string>> = {
  instagram: (projectId) => `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent(projectId)}`,
  facebook: (projectId) => `/api/role-room/instagram/oauth/start?projectId=${encodeURIComponent(projectId)}`, // shares Meta OAuth
  linkedin: () => '/api/role-room/linkedin/oauth/start',
};

interface PlatformStyle {
  label: string;
  color: string;
  Icon: React.ComponentType<{ fontSize?: 'small' | 'medium' | 'large' | 'inherit' }>;
}

const PLATFORM_STYLES: Record<RoleRoomAgentSocialProfileCandidate['platform'], PlatformStyle> = {
  instagram: { label: 'Instagram', color: '#E1306C', Icon: InstagramIcon },
  facebook: { label: 'Facebook', color: '#1877F2', Icon: FacebookIcon },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', Icon: LinkedInIcon },
  youtube: { label: 'YouTube', color: '#FF0000', Icon: YouTubeIcon },
  tiktok: { label: 'TikTok', color: '#000000', Icon: TikTokIcon },
  x: { label: 'X / Twitter', color: '#1D9BF0', Icon: TwitterIcon },
  threads: { label: 'Threads', color: '#000000', Icon: ThreadsIcon },
  vimeo: { label: 'Vimeo', color: '#1AB7EA', Icon: VimeoIcon },
  pinterest: { label: 'Pinterest', color: '#BD081C', Icon: PinterestIcon },
};

interface SocialProfileCandidatesPreviewProps {
  candidates: RoleRoomAgentSocialProfileCandidate[];
  maxVisible?: number;
  /** When set, each platform supported in CONNECT_OAUTH_URLS gets a
   *  Connect-button that opens the OAuth-start endpoint in a new tab.
   *  Without projectId we hide the buttons (can't anchor OAuth state). */
  projectId?: string | null;
}

const SocialProfileCandidatesPreview: React.FC<SocialProfileCandidatesPreviewProps> = ({
  candidates,
  maxVisible = 9,
  projectId = null,
}) => {
  if (!candidates || candidates.length === 0) return null;

  // Sort: verified first, then likely, then confidence desc. Rejected
  // candidates are skipped entirely — they're not useful in a "research
  // overview" view, only in detail-review UIs.
  const sorted = [...candidates]
    .filter((c) => c.status !== 'rejected')
    .sort((a, b) => {
      const statusOrder = { verified: 0, likely: 1, needs_review: 2, rejected: 3 } as const;
      const sa = statusOrder[a.status] ?? 9;
      const sb = statusOrder[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      return b.confidence - a.confidence;
    })
    .slice(0, maxVisible);

  return (
    <Box>
      <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 1 }}>
        Sosiale profiler vi fant ({candidates.length})
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 1,
        }}
      >
        {sorted.map((candidate) => {
          const style = PLATFORM_STYLES[candidate.platform] ?? {
            label: candidate.platform,
            color: '#64748b',
            Icon: GenericIcon as PlatformStyle['Icon'],
          };
          const Icon = style.Icon;
          const isVerified = candidate.status === 'verified';
          const isLikely = candidate.status === 'likely';
          const handleClick = (): void => {
            try {
              window.open(candidate.canonicalUrl || candidate.url, '_blank', 'noopener,noreferrer');
            } catch {
              // popup blocked — silently ignore
            }
          };
          const evidenceCount = candidate.evidence?.length ?? 0;
          const displayLabel =
            candidate.displayName
            || candidate.handle
            || candidate.canonicalUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
          return (
            <Box
              key={`${candidate.platform}-${candidate.canonicalUrl}`}
              sx={{
                position: 'relative',
                p: 1.2,
                borderRadius: 2,
                border: `1px solid ${isVerified ? 'rgba(52,211,153,0.32)' : 'rgba(148,163,184,0.18)'}`,
                bgcolor: 'rgba(15,23,42,0.4)',
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': {
                  borderColor: style.color,
                  bgcolor: 'rgba(15,23,42,0.6)',
                },
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: style.color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography
                      sx={{
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={displayLabel}
                    >
                      {displayLabel}
                    </Typography>
                    {isVerified ? (
                      <Tooltip title="Verifisert match — funnet på kundens egen nettside">
                        <VerifiedIcon sx={{ color: '#34d399', fontSize: 14 }} />
                      </Tooltip>
                    ) : isLikely ? (
                      <Tooltip title="Sannsynlig match — flere signaler peker hit">
                        <VerifiedIcon sx={{ color: '#fbbf24', fontSize: 14 }} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Trenger manuell verifisering">
                        <UnclearIcon sx={{ color: 'rgba(148,163,184,0.6)', fontSize: 14 }} />
                      </Tooltip>
                    )}
                  </Stack>
                  <Typography
                    sx={{
                      color: 'rgba(226,232,240,0.5)',
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={candidate.canonicalUrl}
                  >
                    {style.label}
                  </Typography>
                  <Stack direction="row" spacing={0.4} alignItems="center" sx={{ mt: 0.3 }}>
                    <Box
                      sx={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'rgba(148,163,184,0.18)',
                        overflow: 'hidden',
                        maxWidth: 80,
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.min(100, Math.max(0, candidate.confidence))}%`,
                          height: '100%',
                          bgcolor: isVerified ? '#34d399' : isLikely ? '#fbbf24' : '#94a3b8',
                        }}
                      />
                    </Box>
                    <Typography
                      sx={{
                        color: 'rgba(226,232,240,0.7)',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {Math.round(candidate.confidence)}%
                    </Typography>
                  </Stack>
                  {evidenceCount > 0 ? (
                    <Chip
                      size="small"
                      label={`${evidenceCount} bevis`}
                      sx={{
                        height: 18,
                        fontSize: '0.66rem',
                        bgcolor: 'rgba(148,163,184,0.12)',
                        color: 'rgba(226,232,240,0.7)',
                        alignSelf: 'flex-start',
                        mt: 0.4,
                      }}
                    />
                  ) : null}
                </Stack>
                <Stack direction="column" spacing={0.3} alignItems="flex-end">
                  <IconButton
                    size="small"
                    onClick={handleClick}
                    sx={{ color: 'rgba(226,232,240,0.6)', mt: -0.4, mr: -0.4 }}
                    aria-label={`Åpne ${style.label}-profil`}
                  >
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  {projectId && CONNECT_OAUTH_URLS[candidate.platform] ? (
                    <Tooltip title={`Koble ${style.label}-konto til prosjektet via OAuth`}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          try {
                            const urlBuilder = CONNECT_OAUTH_URLS[candidate.platform];
                            if (!urlBuilder) return;
                            window.open(urlBuilder(projectId), '_blank', 'width=600,height=720,noopener');
                          } catch {
                            // popup blocked — silently ignore
                          }
                        }}
                        sx={{
                          color: style.color,
                          bgcolor: `${style.color}1f`,
                          mt: -0.2,
                          mr: -0.4,
                          '&:hover': { bgcolor: `${style.color}33` },
                        }}
                        aria-label={`Koble ${style.label}`}
                      >
                        <LinkIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Box>
      {sorted.length < candidates.filter((c) => c.status !== 'rejected').length ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', mt: 0.6 }}>
          Viser {sorted.length} av {candidates.filter((c) => c.status !== 'rejected').length} profiler.
        </Typography>
      ) : null}
    </Box>
  );
};

export default SocialProfileCandidatesPreview;
