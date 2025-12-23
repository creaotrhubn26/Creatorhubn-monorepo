// Brand configuration with default values and localStorage override
const KEY = 'CH_BRAND_LOGO_DATAURL';
// 1x1 transparent PNG as fallback (can be replaced in UI or via localStorage)
const TRANSPARENT_PX =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/YNxv+EAAAAASUVORK5CYII=';

export type Brand = {
  name: string;
  website?: string;
  logoDataUrl?: string;
};

export function getBrand(): Brand {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
  const logoDataUrl = stored ? stored : 'data:image/png;base64' + TRANSPARENT_PX;
  return {
    name: 'CreatorHub Norge',
    website: 'creatorhub.no',
    logoDataUrl,
  };
}

export function setBrandLogoDataUrl(dataUrl: string) {
  try {
    window.localStorage.setItem(KEY, dataUrl);
  } catch {}
}
