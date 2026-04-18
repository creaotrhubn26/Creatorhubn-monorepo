import type { CSSProperties } from 'react';
import type { RoleRoomFeedPlatform } from '../../services/roleRoomAgentService';

type SocialBrandLogoProps = {
  platform: RoleRoomFeedPlatform;
  size?: number;
  style?: CSSProperties;
  title?: string;
};

/**
 * Faithful platform brand marks — Instagram gradient camera, TikTok glyph,
 * LinkedIn "in". Rendered inline so they scale with the icon size and stay
 * crisp at any zoom level.
 */
export default function SocialBrandLogo({ platform, size = 18, style, title }: SocialBrandLogoProps) {
  switch (platform) {
    case 'instagram':
      return <InstagramBrandLogo size={size} style={style} title={title} />;
    case 'tiktok':
      return <TikTokBrandLogo size={size} style={style} title={title} />;
    case 'linkedin':
      return <LinkedInBrandLogo size={size} style={style} title={title} />;
    default:
      return null;
  }
}

export function InstagramBrandLogo({
  size = 18,
  style,
  title = 'Instagram',
}: {
  size?: number;
  style?: CSSProperties;
  title?: string;
}) {
  const gradientId = 'ig-gradient';
  const centerX = 32;
  const centerY = 32;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      style={style}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={gradientId} cx="22%" cy="100%" r="120%">
          <stop offset="0%" stopColor="#FEDA77" />
          <stop offset="25%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="75%" stopColor="#8134AF" />
          <stop offset="100%" stopColor="#515BD4" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${gradientId})`} />
      <rect
        x="12"
        y="12"
        width="40"
        height="40"
        rx="11"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
      />
      <circle
        cx={centerX}
        cy={centerY}
        r="9"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
      />
      <circle cx="46" cy="18" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}

export function TikTokBrandLogo({
  size = 18,
  style,
  title = 'TikTok',
}: {
  size?: number;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={style}>
      <title>{title}</title>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#010101" />
      {/* Cyan back layer */}
      <path
        d="M42 16c0.6 4.2 3.8 7.5 8 8v7c-3.4 0-6.6-1.1-9.2-3v14c0 8.4-6.8 15-15.2 15s-15.2-6.7-15.2-15 6.8-15 15.2-15c0.9 0 1.8 0.1 2.6 0.2v7.6c-0.8-0.2-1.7-0.3-2.6-0.3-4.2 0-7.6 3.4-7.6 7.5s3.4 7.5 7.6 7.5c4.2 0 7.6-3.2 7.6-7.4V12h8.8z"
        fill="#25F4EE"
        transform="translate(-3,3)"
      />
      {/* Magenta middle layer */}
      <path
        d="M42 16c0.6 4.2 3.8 7.5 8 8v7c-3.4 0-6.6-1.1-9.2-3v14c0 8.4-6.8 15-15.2 15s-15.2-6.7-15.2-15 6.8-15 15.2-15c0.9 0 1.8 0.1 2.6 0.2v7.6c-0.8-0.2-1.7-0.3-2.6-0.3-4.2 0-7.6 3.4-7.6 7.5s3.4 7.5 7.6 7.5c4.2 0 7.6-3.2 7.6-7.4V12h8.8z"
        fill="#FE2C55"
        transform="translate(3,-3)"
      />
      {/* White glyph */}
      <path
        d="M42 16c0.6 4.2 3.8 7.5 8 8v7c-3.4 0-6.6-1.1-9.2-3v14c0 8.4-6.8 15-15.2 15s-15.2-6.7-15.2-15 6.8-15 15.2-15c0.9 0 1.8 0.1 2.6 0.2v7.6c-0.8-0.2-1.7-0.3-2.6-0.3-4.2 0-7.6 3.4-7.6 7.5s3.4 7.5 7.6 7.5c4.2 0 7.6-3.2 7.6-7.4V12h8.8z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function LinkedInBrandLogo({
  size = 18,
  style,
  title = 'LinkedIn',
}: {
  size?: number;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={style}>
      <title>{title}</title>
      <rect x="2" y="2" width="60" height="60" rx="10" fill="#0A66C2" />
      <circle cx="19" cy="21" r="4.5" fill="#FFFFFF" />
      <rect x="15" y="28" width="8" height="22" rx="1.5" fill="#FFFFFF" />
      <path
        d="M29 28h7.5v3.1c1.7-2.2 4.6-3.9 8.7-3.9 8.7 0 10.2 5.7 10.2 13V50h-8V41c0-3.5-.1-8-4.9-8-4.9 0-5.6 3.8-5.6 7.8V50h-7.9V28Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
