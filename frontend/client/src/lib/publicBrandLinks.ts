export type PublicBrandKey = 'creatorhub' | 'roleRoom';
export type PublicSocialPlatform = 'instagram' | 'facebook';

export interface PublicSocialProfile {
  platform: PublicSocialPlatform;
  label: string;
  href: string;
}

export const PUBLIC_BRAND_LINKS = {
  creatorhub: {
    website: 'https://creatorhubn.com',
    email: 'hello@creatorhubn.com',
    instagram: 'https://www.instagram.com/creatorhubn/',
    facebook: 'https://www.facebook.com/creatorhubn/',
  },
  roleRoom: {
    website: 'https://theroleroom.com',
    email: 'support@theroleroom.com',
    instagram: 'https://www.instagram.com/theroleroom/',
    facebook: 'https://www.facebook.com/profile.php?id=61573320716662',
  },
} as const;

const ROLE_ROOM_PUBLIC_HOSTS = new Set([
  'theroleroom.com',
  'www.theroleroom.com',
]);

export function resolvePublicBrandFromHostname(hostname?: string | null): PublicBrandKey {
  const normalized = String(hostname || '').trim().toLowerCase();
  return ROLE_ROOM_PUBLIC_HOSTS.has(normalized) ? 'roleRoom' : 'creatorhub';
}

export function resolvePublicBrandFromWindow(): PublicBrandKey {
  if (typeof window === 'undefined') {
    return 'creatorhub';
  }
  return resolvePublicBrandFromHostname(window.location.hostname);
}

export function getPublicSocialProfiles(brand: PublicBrandKey): PublicSocialProfile[] {
  const links = PUBLIC_BRAND_LINKS[brand];

  return [
    {
      platform: 'instagram',
      label: 'Instagram',
      href: links.instagram,
    },
    {
      platform: 'facebook',
      label: 'Facebook',
      href: links.facebook,
    },
  ];
}
