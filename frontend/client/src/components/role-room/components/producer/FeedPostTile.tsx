import { Box, Stack, Typography } from '@mui/material';
import {
  MovieCreation as ReelIcon,
  ViewCarousel as CarouselIcon,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import type {
  RoleRoomFeedBrandSnapshot,
  RoleRoomFeedLogoPlacement,
  RoleRoomFeedPost,
} from '../../services/roleRoomAgentService';
import { CONCEPT_LABELS } from '../../utils/feedPlanner';

type FeedPostTileProps = {
  post: RoleRoomFeedPost;
  index: number;
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  selected?: boolean;
  onSelect?: () => void;
};

const LOGO_PLACEMENT_STYLES: Record<RoleRoomFeedLogoPlacement, { top?: number | string; bottom?: number | string; left?: number | string; right?: number | string; transform?: string }> = {
  'top-left': { top: 8, left: 8 },
  'top-right': { top: 8, right: 8 },
  'bottom-left': { bottom: 8, left: 8 },
  'bottom-right': { bottom: 8, right: 8 },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
};

function buildGradient(
  backgroundColor: string | null | undefined,
  accentColor: string | null | undefined,
): string {
  const base = backgroundColor || '#0f172a';
  const accent = accentColor || '#22d3ee';
  return `linear-gradient(135deg, ${base} 0%, ${mixHex(base, accent, 0.3)} 55%, ${accent} 100%)`;
}

/** Mix two hex colors perceptually enough for preview purposes. */
function mixHex(a: string, b: string, weight: number): string {
  const parse = (value: string) => {
    const cleaned = value.replace('#', '');
    const hex = cleaned.length === 3
      ? cleaned.split('').map((ch) => ch + ch).join('')
      : cleaned.padEnd(6, '0').slice(0, 6);
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  };
  try {
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const r = Math.round(ar * (1 - weight) + br * weight);
    const g = Math.round(ag * (1 - weight) + bg * weight);
    const bl = Math.round(ab * (1 - weight) + bb * weight);
    return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return a;
  }
}

export default function FeedPostTile({
  post,
  index,
  brandSnapshot,
  selected = false,
  onSelect,
}: FeedPostTileProps) {
  const placement = post.logoPlacement || 'top-left';
  const placementStyles = LOGO_PLACEMENT_STYLES[placement];
  const gradient = buildGradient(post.backgroundColor, post.accentColor);
  const textColor = post.textColor || '#f8fafc';
  const conceptLabel = CONCEPT_LABELS[post.concept as keyof typeof CONCEPT_LABELS] || 'Post';

  const hasCustomImage = Boolean(post.customImageUrl);

  return (
    <Box
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${conceptLabel}: ${post.title}`}
      aria-pressed={selected}
      sx={{
        position: 'relative',
        aspectRatio: '4 / 5',
        cursor: onSelect ? 'pointer' : 'default',
        background: hasCustomImage ? '#000' : gradient,
        overflow: 'hidden',
        outline: selected ? '2px solid #22d3ee' : '2px solid transparent',
        outlineOffset: -2,
        transition: 'transform 0.18s ease, outline-color 0.18s ease',
        '&:hover': onSelect
          ? {
              transform: 'scale(1.02)',
              zIndex: 1,
            }
          : undefined,
      }}
    >
      {hasCustomImage ? (
        <Box
          component="img"
          src={post.customImageUrl ?? ''}
          alt=""
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : null}

      {/* Decorative geometric overlay for visual variety (hidden when a real
          image is provided — let the image carry the composition). */}
      {!hasCustomImage ? (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              index % 3 === 0
                ? 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)'
                : index % 3 === 1
                  ? 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)'
                  : 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 0 8px, rgba(255,255,255,0) 8px 16px)',
          }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}

      {/* Concept badge top-opposite-of-logo. */}
      <Box
        sx={{
          position: 'absolute',
          ...(placement === 'top-right' || placement === 'bottom-right'
            ? { top: 8, left: 8 }
            : { top: 8, right: 8 }),
          px: 0.8,
          py: 0.3,
          borderRadius: 999,
          bgcolor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        <Typography
          sx={{
            color: '#f8fafc',
            fontSize: '0.6rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {conceptLabel}
        </Typography>
      </Box>

      {/* Media-type indicator (reel/carousel). */}
      {post.mediaType !== 'image' ? (
        <Box
          sx={{
            position: 'absolute',
            top: placement === 'top-left' || placement === 'top-right' ? 36 : 8,
            right: 8,
            color: '#fff',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {post.mediaType === 'reel' ? <ReelIcon fontSize="small" /> : <CarouselIcon fontSize="small" />}
        </Box>
      ) : null}

      {/* Logo. */}
      {brandSnapshot?.logoUrl ? (
        <Box
          sx={{
            position: 'absolute',
            ...placementStyles,
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <Box
            component="img"
            src={brandSnapshot.logoUrl}
            alt=""
            sx={{ maxWidth: 24, maxHeight: 24, objectFit: 'contain' }}
          />
        </Box>
      ) : brandSnapshot?.companyName ? (
        <Box
          sx={{
            position: 'absolute',
            ...placementStyles,
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: textColor,
            fontWeight: 800,
            fontSize: '0.72rem',
          }}
        >
          {brandSnapshot.companyName.slice(0, 1).toUpperCase()}
        </Box>
      ) : null}

      {/* Title + CTA footer. */}
      <Stack
        spacing={0.4}
        sx={{
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: 10,
        }}
      >
        <Typography
          sx={{
            color: textColor,
            fontSize: '0.82rem',
            fontWeight: 800,
            lineHeight: 1.2,
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.title}
        </Typography>
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: post.accentColor || '#22d3ee',
              boxShadow: `0 0 8px ${post.accentColor || '#22d3ee'}`,
            }}
          />
          <Typography
            sx={{
              color: 'rgba(248,250,252,0.85)',
              fontSize: '0.66rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {post.callToAction}
          </Typography>
        </Stack>
      </Stack>

      {post.locked ? (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <LockIcon fontSize="small" />
        </Box>
      ) : null}
    </Box>
  );
}
