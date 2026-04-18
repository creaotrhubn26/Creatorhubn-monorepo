import type { CSSProperties } from 'react';

export type RoleRoomTierSlug = 'spotlight' | 'headliner' | 'showrunner' | 'admin';

type RoleRoomTierIconProps = {
  tier: RoleRoomTierSlug;
  size?: number;
  style?: CSSProperties;
  title?: string;
};

/**
 * Brand-tone SVG icons for the three paid tiers + admin.
 *
 * Metaphor: stage lights. Spotlight is a single focused beam for the entry
 * tier. Headliner is a marquee with bulbs lighting a billboard. Showrunner
 * is a director's chair with a crown-anchor indicating production control.
 */
export default function RoleRoomTierIcon({ tier, size = 28, style, title }: RoleRoomTierIconProps) {
  switch (tier) {
    case 'spotlight':
      return <SpotlightIcon size={size} style={style} title={title ?? 'Spotlight'} />;
    case 'headliner':
      return <HeadlinerIcon size={size} style={style} title={title ?? 'Headliner'} />;
    case 'showrunner':
      return <ShowrunnerIcon size={size} style={style} title={title ?? 'Showrunner'} />;
    case 'admin':
      return <AdminIcon size={size} style={style} title={title ?? 'Admin'} />;
    default:
      return null;
  }
}

function SpotlightIcon({ size, style, title }: { size: number; style?: CSSProperties; title: string }) {
  const gradientId = 'tier-spotlight-beam';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={style}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Beam */}
      <path d="M26 10 L38 10 L56 56 L8 56 Z" fill={`url(#${gradientId})`} opacity="0.55" />
      {/* Ground ellipse */}
      <ellipse cx="32" cy="56" rx="22" ry="3.2" fill="#22d3ee" opacity="0.25" />
      {/* Lamp body */}
      <rect x="24" y="6" width="16" height="10" rx="3" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
      {/* Lens glow */}
      <rect x="26" y="14" width="12" height="3" rx="1.2" fill="#22d3ee" />
      {/* Top handle */}
      <rect x="30" y="2" width="4" height="5" rx="1.5" fill="#22d3ee" />
    </svg>
  );
}

function HeadlinerIcon({ size, style, title }: { size: number; style?: CSSProperties; title: string }) {
  const bulbs = [
    [14, 20],
    [22, 16],
    [32, 14],
    [42, 16],
    [50, 20],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={style}>
      <title>{title}</title>
      {/* Marquee frame */}
      <rect x="8" y="22" width="48" height="26" rx="4" fill="#0f172a" stroke="#a855f7" strokeWidth="2" />
      {/* Inner frame */}
      <rect x="11" y="25" width="42" height="20" rx="2" fill="none" stroke="#a855f7" strokeWidth="1" opacity="0.5" />
      {/* Bottom stand */}
      <rect x="28" y="48" width="8" height="8" fill="#a855f7" opacity="0.75" />
      <rect x="22" y="56" width="20" height="3" rx="1" fill="#a855f7" />
      {/* Headline text proxy */}
      <rect x="16" y="31" width="32" height="3" rx="1" fill="#a855f7" opacity="0.9" />
      <rect x="18" y="37" width="28" height="2.5" rx="1" fill="#a855f7" opacity="0.55" />
      {/* Top bulbs with glow */}
      {bulbs.map(([cx, cy], index) => (
        <g key={`bulb-${index}`}>
          <circle cx={cx} cy={cy} r="4.5" fill="#fbbf24" opacity="0.25" />
          <circle cx={cx} cy={cy} r="2.4" fill="#fbbf24" />
        </g>
      ))}
    </svg>
  );
}

function ShowrunnerIcon({ size, style, title }: { size: number; style?: CSSProperties; title: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={style}>
      <title>{title}</title>
      {/* Clapperboard body */}
      <rect x="10" y="24" width="44" height="30" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
      {/* Hinge strip */}
      <path
        d="M10 24 L54 18 L54 24 Z"
        fill="#f59e0b"
      />
      <path
        d="M10 24 L54 18 L54 14 L10 20 Z"
        fill="#0f172a"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Diagonal stripes */}
      <path d="M16 14 L22 22" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 12 L32 20" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 10 L42 18" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 8 L52 16" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      {/* Crown on top — showrunner accent */}
      <path
        d="M26 8 L30 3 L32 7 L34 3 L38 8 L34 12 L30 12 Z"
        fill="#f59e0b"
      />
      {/* Screen text */}
      <rect x="16" y="32" width="20" height="3" rx="1" fill="#f59e0b" opacity="0.85" />
      <rect x="16" y="38" width="28" height="2.5" rx="1" fill="#f59e0b" opacity="0.55" />
      <rect x="16" y="43" width="14" height="2.5" rx="1" fill="#f59e0b" opacity="0.4" />
    </svg>
  );
}

function AdminIcon({ size, style, title }: { size: number; style?: CSSProperties; title: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={style}>
      <title>{title}</title>
      <circle cx="32" cy="32" r="26" fill="#0f172a" stroke="#64748b" strokeWidth="2" />
      <path
        d="M22 30 L30 38 L44 24"
        fill="none"
        stroke="#64748b"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const ROLE_ROOM_TIERS: Record<
  RoleRoomTierSlug,
  { slug: RoleRoomTierSlug; name: string; shortName: string; tagline: string; accentHex: string; level: number }
> = {
  spotlight: {
    slug: 'spotlight',
    name: 'Role Room Spotlight',
    shortName: 'Spotlight',
    tagline: 'Kom i gang med kundeanalyse og feed-planlegging.',
    accentHex: '#22d3ee',
    level: 1,
  },
  headliner: {
    slug: 'headliner',
    name: 'Role Room Headliner',
    shortName: 'Headliner',
    tagline: 'Full tilgang til alle AI-anbefalinger og planleggingsverktøy.',
    accentHex: '#a855f7',
    level: 2,
  },
  showrunner: {
    slug: 'showrunner',
    name: 'Role Room Showrunner',
    shortName: 'Showrunner',
    tagline: 'Ubegrenset bruk og enterprise-støtte for team.',
    accentHex: '#f59e0b',
    level: 3,
  },
  admin: {
    slug: 'admin',
    name: 'Role Room Admin',
    shortName: 'Admin',
    tagline: 'Intern tilgang.',
    accentHex: '#64748b',
    level: 99,
  },
};

export function tierForEntitlementSource(source: string | null | undefined): RoleRoomTierSlug {
  switch (source) {
    case 'admin':
      return 'admin';
    case 'plan_enterprise':
      return 'showrunner';
    case 'plan_pro':
    case 'addon_monthly':
      return 'headliner';
    case 'trial':
    case 'none':
    default:
      return 'spotlight';
  }
}
