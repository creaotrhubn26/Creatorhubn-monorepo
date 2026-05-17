/**
 * MarketingPlanPostPreview — platform-spesifikk preview-modus (item #174).
 *
 * Ikke pixel-perfect mockup av IG/TikTok/LinkedIn-feed (det krever
 * mye design-arbeid + asset-håndtering). I stedet: recognizable
 * platform-styling som gir produsenten en følelse av hvordan posten
 * vil se ut — riktig fargepalett, plassering av handle, format på
 * caption-truncation, tid-stempel-konvensjon.
 *
 * Render-prinsipp: ett platform-rendert kort per platform i
 * crossPostPlan, eller bare primaryPlatform hvis ingen crossposts.
 */

import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import {
  Instagram as InstagramIcon,
  MusicNote as TikTokIcon,
  LinkedIn as LinkedInIcon,
  YouTube as YouTubeIcon,
  Facebook as FacebookIcon,
  Favorite as LikeIcon,
  ChatBubbleOutline as CommentIcon,
  Share as ShareIcon,
  BookmarkBorder as SaveIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import type { MarketingPlanPost } from '../../services/roleRoomAgentService';

interface MarketingPlanPostPreviewProps {
  post: MarketingPlanPost;
  /** Vises ved siden av "@handle" og "h" for ago-time. */
  companyHandle?: string;
  /** Hvis logo finnes i bootstrap, vises rundt i avatar-sirkel. */
  logoUrl?: string | null;
}

const MarketingPlanPostPreview: React.FC<MarketingPlanPostPreviewProps> = ({
  post,
  companyHandle = 'din_konto',
  logoUrl = null,
}) => {
  const platform = post.primaryPlatform ?? 'instagram';
  switch (platform) {
    case 'instagram': return <InstagramPreview post={post} handle={companyHandle} logoUrl={logoUrl} />;
    case 'tiktok': return <TikTokPreview post={post} handle={companyHandle} logoUrl={logoUrl} />;
    case 'linkedin': return <LinkedInPreview post={post} handle={companyHandle} logoUrl={logoUrl} />;
    case 'youtube': return <YouTubePreview post={post} handle={companyHandle} logoUrl={logoUrl} />;
    case 'facebook': return <FacebookPreview post={post} handle={companyHandle} logoUrl={logoUrl} />;
    default: return <InstagramPreview post={post} handle={companyHandle} logoUrl={logoUrl} />;
  }
};

interface PreviewSubProps {
  post: MarketingPlanPost;
  handle: string;
  logoUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Instagram preview — rosa border + bottom-bar med like/comment/share
// ─────────────────────────────────────────────────────────────────────
const InstagramPreview: React.FC<PreviewSubProps> = ({ post, handle, logoUrl }) => (
  <Box sx={{ width: 280, bgcolor: '#fff', borderRadius: 1.5, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.16)' }}>
    {/* Header */}
    <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1 }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
        p: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {logoUrl ? (
          <Box component="img" src={logoUrl} alt="" sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: '#fff', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: '#fff' }} />
        )}
      </Box>
      <Typography sx={{ color: '#262626', fontWeight: 600, fontSize: '0.78rem', flex: 1 }}>
        {handle}
      </Typography>
      <InstagramIcon sx={{ color: '#E1306C', fontSize: 16 }} />
    </Stack>
    {/* "Image" placeholder med hook overlay */}
    <Box sx={{
      width: '100%', aspectRatio: '1 / 1', bgcolor: '#f5f5f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <Typography sx={{ color: '#262626', fontWeight: 700, fontSize: '0.94rem', px: 2, textAlign: 'center' }}>
        {post.hook}
      </Typography>
      {post.format === 'reel' ? (
        <PlayIcon sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', fontSize: 18 }} />
      ) : null}
    </Box>
    {/* Action bar */}
    <Stack direction="row" alignItems="center" spacing={1.4} sx={{ px: 1, py: 0.6 }}>
      <LikeIcon sx={{ color: '#262626', fontSize: 22 }} />
      <CommentIcon sx={{ color: '#262626', fontSize: 22 }} />
      <ShareIcon sx={{ color: '#262626', fontSize: 22 }} />
      <Box sx={{ flex: 1 }} />
      <SaveIcon sx={{ color: '#262626', fontSize: 22 }} />
    </Stack>
    {/* Caption */}
    <Box sx={{ px: 1, pb: 1 }}>
      <Typography sx={{ color: '#262626', fontSize: '0.78rem', lineHeight: 1.35 }}>
        <strong>{handle}</strong>{' '}
        {(post.captionDraft ?? '').length > 100
          ? `${post.captionDraft?.slice(0, 100)}... `
          : post.captionDraft ?? ''}
        {(post.captionDraft ?? '').length > 100 ? (
          <span style={{ color: '#8e8e8e' }}>mer</span>
        ) : null}
      </Typography>
      <Typography sx={{ color: '#8e8e8e', fontSize: '0.66rem', mt: 0.3 }}>
        FOR EN TIME SIDEN
      </Typography>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────
// TikTok — svart bakgrunn + portrait-aspect + lyd-ikon
// ─────────────────────────────────────────────────────────────────────
const TikTokPreview: React.FC<PreviewSubProps> = ({ post, handle, logoUrl }) => (
  <Box sx={{ width: 220, aspectRatio: '9 / 16', bgcolor: '#000', borderRadius: 1.5, position: 'relative', overflow: 'hidden' }}>
    {/* Center hook */}
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
        {post.hook}
      </Typography>
    </Box>
    {/* Bottom-left handle + caption */}
    <Box sx={{ position: 'absolute', bottom: 12, left: 12, right: 60, color: '#fff' }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>@{handle}</Typography>
      <Typography sx={{ fontSize: '0.72rem', mt: 0.4, opacity: 0.9 }}>
        {(post.captionDraft ?? '').slice(0, 80)}{(post.captionDraft ?? '').length > 80 ? '...' : ''}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.4} sx={{ mt: 0.6, opacity: 0.8 }}>
        <TikTokIcon sx={{ fontSize: 12 }} />
        <Typography sx={{ fontSize: '0.66rem' }}>Original sound</Typography>
      </Stack>
    </Box>
    {/* Right-side action stack */}
    <Stack spacing={1.6} alignItems="center" sx={{ position: 'absolute', right: 8, bottom: 16, color: '#fff' }}>
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt="" sx={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover' }} />
      ) : (
        <Box sx={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #fff', bgcolor: '#666' }} />
      )}
      <LikeIcon sx={{ fontSize: 24 }} />
      <CommentIcon sx={{ fontSize: 24 }} />
      <ShareIcon sx={{ fontSize: 24 }} />
    </Stack>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────
// LinkedIn — hvit bg, blå accent, formell typografi
// ─────────────────────────────────────────────────────────────────────
const LinkedInPreview: React.FC<PreviewSubProps> = ({ post, handle, logoUrl }) => (
  <Box sx={{ width: 320, bgcolor: '#fff', borderRadius: 1, p: 1.4, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
    <Stack direction="row" spacing={1} alignItems="flex-start">
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt="" sx={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#0A66C2' }} />
      )}
      <Stack spacing={0.1} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: '#000', fontWeight: 600, fontSize: '0.84rem' }}>
          {handle}
        </Typography>
        <Typography sx={{ color: '#666', fontSize: '0.7rem' }}>
          16 t · 🌐
        </Typography>
      </Stack>
      <LinkedInIcon sx={{ color: '#0A66C2', fontSize: 18 }} />
    </Stack>
    <Typography sx={{ color: '#000', fontSize: '0.86rem', mt: 1, lineHeight: 1.45 }}>
      <strong>{post.hook}</strong>
    </Typography>
    {post.captionDraft ? (
      <Typography sx={{ color: '#000', fontSize: '0.8rem', mt: 0.6, lineHeight: 1.45 }}>
        {(post.captionDraft ?? '').length > 200
          ? `${post.captionDraft?.slice(0, 200)}... `
          : post.captionDraft}
        {(post.captionDraft ?? '').length > 200 ? (
          <span style={{ color: '#0A66C2', cursor: 'pointer' }}>...see more</span>
        ) : null}
      </Typography>
    ) : null}
    <Stack direction="row" spacing={1.4} sx={{ mt: 1.2, pt: 0.8, borderTop: '1px solid #e0e0e0' }}>
      <Stack direction="row" spacing={0.4} alignItems="center">
        <LikeIcon sx={{ color: '#666', fontSize: 16 }} />
        <Typography sx={{ color: '#666', fontSize: '0.72rem' }}>Like</Typography>
      </Stack>
      <Stack direction="row" spacing={0.4} alignItems="center">
        <CommentIcon sx={{ color: '#666', fontSize: 16 }} />
        <Typography sx={{ color: '#666', fontSize: '0.72rem' }}>Comment</Typography>
      </Stack>
      <Stack direction="row" spacing={0.4} alignItems="center">
        <ShareIcon sx={{ color: '#666', fontSize: 16 }} />
        <Typography sx={{ color: '#666', fontSize: '0.72rem' }}>Repost</Typography>
      </Stack>
    </Stack>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────
// YouTube — rød accent + Shorts-style for korte videoer
// ─────────────────────────────────────────────────────────────────────
const YouTubePreview: React.FC<PreviewSubProps> = ({ post, handle }) => (
  <Box sx={{ width: 280, bgcolor: '#0f0f0f', borderRadius: 1.5, overflow: 'hidden', color: '#fff' }}>
    <Box sx={{
      width: '100%', aspectRatio: '16 / 9', bgcolor: '#1a1a1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    }}>
      <PlayIcon sx={{ color: '#fff', fontSize: 48, opacity: 0.8 }} />
      <Typography sx={{
        position: 'absolute', bottom: 6, right: 6,
        bgcolor: 'rgba(0,0,0,0.7)', color: '#fff', px: 0.6, py: 0.2,
        borderRadius: 0.4, fontSize: '0.66rem', fontWeight: 600,
      }}>
        {post.format === 'youtube_short' ? '0:45' : '2:30'}
      </Typography>
    </Box>
    <Box sx={{ p: 1 }}>
      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.86rem', lineHeight: 1.3, mb: 0.4 }}>
        {post.hook}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.6}>
        <YouTubeIcon sx={{ color: '#FF0000', fontSize: 14 }} />
        <Typography sx={{ color: '#aaa', fontSize: '0.74rem' }}>
          {handle} · 1.2k visninger · 1 t siden
        </Typography>
      </Stack>
    </Box>
  </Box>
);

// ─────────────────────────────────────────────────────────────────────
// Facebook — klassisk blå header + reactions-rad
// ─────────────────────────────────────────────────────────────────────
const FacebookPreview: React.FC<PreviewSubProps> = ({ post, handle, logoUrl }) => (
  <Box sx={{ width: 320, bgcolor: '#fff', borderRadius: 1.4, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.2 }}>
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt="" sx={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#1877F2' }} />
      )}
      <Stack spacing={0.1} sx={{ flex: 1 }}>
        <Typography sx={{ color: '#1c1e21', fontWeight: 600, fontSize: '0.86rem' }}>
          {handle}
        </Typography>
        <Typography sx={{ color: '#65676b', fontSize: '0.74rem' }}>
          2 t · 🌐
        </Typography>
      </Stack>
      <FacebookIcon sx={{ color: '#1877F2', fontSize: 18 }} />
    </Stack>
    <Box sx={{ px: 1.2, pb: 1 }}>
      <Typography sx={{ color: '#1c1e21', fontSize: '0.86rem', lineHeight: 1.4 }}>
        {post.hook}
      </Typography>
      {post.captionDraft ? (
        <Typography sx={{ color: '#1c1e21', fontSize: '0.8rem', mt: 0.5 }}>
          {(post.captionDraft ?? '').slice(0, 180)}{(post.captionDraft ?? '').length > 180 ? '...' : ''}
        </Typography>
      ) : null}
    </Box>
    <Box sx={{ width: '100%', aspectRatio: '4 / 3', bgcolor: '#f0f2f5' }} />
    <Stack direction="row" spacing={1.4} sx={{ p: 1, borderTop: '1px solid #e4e6eb' }}>
      <Stack direction="row" spacing={0.3} alignItems="center">
        <LikeIcon sx={{ color: '#65676b', fontSize: 16 }} />
        <Typography sx={{ color: '#65676b', fontSize: '0.74rem' }}>Liker</Typography>
      </Stack>
      <Stack direction="row" spacing={0.3} alignItems="center">
        <CommentIcon sx={{ color: '#65676b', fontSize: 16 }} />
        <Typography sx={{ color: '#65676b', fontSize: '0.74rem' }}>Kommenter</Typography>
      </Stack>
      <Stack direction="row" spacing={0.3} alignItems="center">
        <ShareIcon sx={{ color: '#65676b', fontSize: 16 }} />
        <Typography sx={{ color: '#65676b', fontSize: '0.74rem' }}>Del</Typography>
      </Stack>
    </Stack>
  </Box>
);

export default MarketingPlanPostPreview;
