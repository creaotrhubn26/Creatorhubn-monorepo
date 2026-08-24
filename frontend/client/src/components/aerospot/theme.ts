/**
 * aerospot/theme.ts — sentrale design tokens for AeroSpot.
 * Ingen komponent skal hardkode farger/spacing — importer herfra.
 */

export const colors = {
  background: "#050B14",
  surface: "#0B1522",
  surfaceElevated: "#111E2D",
  border: "rgba(145,160,180,0.12)",
  primary: "#268CFF",
  primaryBright: "#4DA3FF",
  textPrimary: "#F6F8FB",
  textSecondary: "#91A0B4",
  textTertiary: "#5C6B80",
  success: "#42D392",
  warning: "#FFB84D",
  danger: "#FF5A67",
  gold: "#F5C518",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const shadows = {
  card: "0 4px 24px rgba(0,0,0,0.35)",
  sheet: "0 -8px 40px rgba(0,0,0,0.5)",
} as const;

export const typography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
  hero: { fontSize: 28, fontWeight: 700, lineHeight: 1.15 },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.2 },
  headline: { fontSize: 17, fontWeight: 600, lineHeight: 1.25 },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.4 },
  caption: { fontSize: 13, fontWeight: 500, lineHeight: 1.3 },
  micro: { fontSize: 11, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0.6 },
} as const;

export const durations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

/** Rarity → farge-mapping (brukes av RareBadge) */
export const rarityColors: Record<string, string> = {
  common: colors.textTertiary,
  uncommon: colors.primaryBright,
  rare: colors.warning,
  very_rare: "#FF8A3D",
  legendary: colors.gold,
};
