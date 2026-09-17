/**
 * Theme-tokens for MarketingFeedPoster — styrer accent-farger, gradient-
 * stops og glow. La hver template velge tema uavhengig av layout-variant.
 */

export type MarketingPosterTheme = 'purple' | 'film_warm' | 'dance_pink';

export interface ThemeTokens {
  /** Default-aksent (lilla i Role Room) */
  accent: string;
  /** Mørkere aksent (gradient-stop) */
  accentDark: string;
  /** Hex til radial-glow + transparency */
  glowRgb: string;
  /** Hex til subtle-tint (cards, CTA-bg) */
  tintRgb: string;
  /** Full background-gradient */
  background: string;
  /** Box-shadow */
  shadow: string;
}

const THEMES: Record<MarketingPosterTheme, ThemeTokens> = {
  purple: {
    accent: '#9e8cf8',
    accentDark: '#6249df',
    glowRgb: '167,139,250',
    tintRgb: '167,139,250',
    background:
      'radial-gradient(circle at 15% 10%, rgba(158, 140, 248,0.30), transparent 40%),' +
      ' radial-gradient(circle at 95% 105%, rgba(98, 73, 223,0.22), transparent 50%),' +
      ' linear-gradient(180deg, #0a0515 0%, #100b1e 50%, #18122b 100%)',
    shadow: '0 20px 60px rgba(98, 73, 223,0.25)',
  },
  film_warm: {
    accent: '#fb923c',
    accentDark: '#c2410c',
    glowRgb: '251,146,60',
    tintRgb: '251,146,60',
    background:
      'radial-gradient(circle at 15% 10%, rgba(251,146,60,0.28), transparent 40%),' +
      ' radial-gradient(circle at 95% 105%, rgba(194,65,12,0.20), transparent 50%),' +
      ' linear-gradient(180deg, #0a0515 0%, #1e1006 50%, #2a1404 100%)',
    shadow: '0 20px 60px rgba(194,65,12,0.25)',
  },
  dance_pink: {
    accent: '#f472b6',
    accentDark: '#be185d',
    glowRgb: '244,114,182',
    tintRgb: '244,114,182',
    background:
      'radial-gradient(circle at 15% 10%, rgba(244,114,182,0.28), transparent 40%),' +
      ' radial-gradient(circle at 95% 105%, rgba(190,24,93,0.20), transparent 50%),' +
      ' linear-gradient(180deg, #0a0515 0%, #1e0a16 50%, #18122b 100%)',
    shadow: '0 20px 60px rgba(190,24,93,0.25)',
  },
};

export const THEME_OPTIONS: Array<{ id: MarketingPosterTheme; label: string }> = [
  { id: 'purple', label: 'Role Room lilla' },
  { id: 'film_warm', label: 'Film warm orange' },
  { id: 'dance_pink', label: 'Dance pink' },
];

export function getTheme(id: MarketingPosterTheme | string | undefined): ThemeTokens {
  if (id && id in THEMES) return THEMES[id as MarketingPosterTheme];
  return THEMES.purple;
}
