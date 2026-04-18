/**
 * Role Room product-tier naming.
 *
 * The entitlement layer uses internal source keys (`trial`, `addon_monthly`,
 * `plan_pro`, `plan_enterprise`, `admin`) for ops and audit clarity. The
 * UI-facing brand names — the "stage lights" metaphor agreed for pricing —
 * are mapped here so every surface shows consistent labels.
 */

import type { EntitlementSource } from './role-room-agent-entitlements.js';

export type RoleRoomTierSlug = 'spotlight' | 'headliner' | 'showrunner' | 'admin';

export interface RoleRoomTierInfo {
  slug: RoleRoomTierSlug;
  name: string;        // "Role Room Spotlight"
  shortName: string;   // "Spotlight" — use where the "Role Room" prefix is obvious
  tagline: string;     // paywall / upgrade copy
  accentHex: string;   // UI accent that matches the tier vibe
  level: 1 | 2 | 3 | 99;
}

export const ROLE_ROOM_TIERS: Record<RoleRoomTierSlug, RoleRoomTierInfo> = {
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
    tagline: 'Intern tilgang — ikke synlig for kunder.',
    accentHex: '#64748b',
    level: 99,
  },
};

export function tierForEntitlementSource(source: EntitlementSource | 'none'): RoleRoomTierInfo {
  switch (source) {
    case 'admin':
      return ROLE_ROOM_TIERS.admin;
    case 'plan_enterprise':
      return ROLE_ROOM_TIERS.showrunner;
    case 'plan_pro':
      return ROLE_ROOM_TIERS.headliner;
    case 'addon_monthly':
      return ROLE_ROOM_TIERS.headliner;
    case 'trial':
    case 'none':
    default:
      return ROLE_ROOM_TIERS.spotlight;
  }
}
