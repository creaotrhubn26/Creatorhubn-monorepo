/**
 * dashboard-design-tokens — Slice 9X.72
 *
 * Sentralisert design-tokens for hele Creatorhub-dashboardet. Brukes for
 * å sikre at:
 *   - Farger er konsistente (ikke spredd hardkodede #ffba6c/#9f7aea-strenger)
 *   - Border-radius følger 3 nivåer (small / medium / pill)
 *   - Tekstfarger matcher dark-temaet uansett MUI-defaults
 *   - Glass-card-styling er én helper, ikke duplisert
 *
 * Bruk:
 *   import { tokens, dashboardSx } from '@/utils/dashboard-design-tokens';
 *   <Box sx={dashboardSx.glassCard(customBranding.color)}>...</Box>
 */

import type { CSSProperties } from 'react';

// ─── Farger ────────────────────────────────────────────────────────
export const tokens = {
  // Tekst — alle nivåer på dark-bakgrunn
  text: {
    primary: '#fff5e8',
    secondary: 'rgba(246,242,234,0.72)',
    muted: 'rgba(246,242,234,0.5)',
    disabled: 'rgba(246,242,234,0.32)',
    inverse: '#150d05',
  },

  // Backgrounds — base og overlays
  bg: {
    base: '#0a0807',
    elevated: 'rgba(255,255,255,0.04)',
    elevatedHover: 'rgba(255,255,255,0.06)',
    overlay: 'rgba(15,10,7,0.96)',
    accentSoft: 'rgba(255,186,108,0.06)',
    accentMedium: 'rgba(255,186,108,0.12)',
    accentStrong: 'rgba(255,186,108,0.18)',
  },

  // Borders
  border: {
    subtle: 'rgba(255,255,255,0.08)',
    nominal: 'rgba(255,255,255,0.12)',
    accent: 'rgba(255,186,108,0.18)',
    accentStrong: 'rgba(255,186,108,0.32)',
  },

  // Status-farger (beholdes konsistent uavhengig av branding)
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#4cc9f0',
  },

  // Border-radius — kun 3 nivåer
  radius: {
    pill: '999px',
    md: 16,   // små kort, knapper, chips
    lg: '24px', // store dialoger, hero-kort
  },

  // Spacing — bruk sx={{ p: tokens.space.md }} eller theme.spacing()
  space: {
    xs: 0.5,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
  },

  // Typography
  font: {
    display: '"Space Grotesk", sans-serif',
    body: '"Inter", -apple-system, sans-serif',
  },

  // Skygger
  shadow: {
    soft: '0 8px 24px rgba(0,0,0,0.18)',
    elevated: '0 16px 48px rgba(0,0,0,0.35)',
    dialog: '0 24px 80px rgba(0,0,0,0.55)',
  },
} as const;

// ─── Gradient-helpers ─────────────────────────────────────────────
export const gradient = {
  /** Standard dashboard-overflate. Brukes på Dialog / Card med dark-tema. */
  dashboardSurface: (accent: string = '#ffba6c') =>
    `radial-gradient(circle at top, ${withAlpha(accent, 0.10)} 0%, rgba(15,10,7,0.98) 36%, #0a0807 100%)`,

  /** Brukes til header-band øverst i dialoger. */
  headerBand: (accent: string = '#ffba6c') =>
    `linear-gradient(135deg, ${withAlpha(accent, 0.16)}, ${withAlpha(accent, 0.02)})`,

  /** Brukes til primær-knapper / CTA-elementer. */
  cta: (accent: string = '#ffba6c') =>
    `linear-gradient(135deg, ${accent}, ${withAlpha(accent, 0.85)})`,
};

// ─── Helper: rgba med alpha ───────────────────────────────────────
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}
export { withAlpha };

// ─── sx-objekt-helpers ────────────────────────────────────────────
export const dashboardSx = {
  /**
   * Standard dark glass-card. Brukes som erstatning for hvite
   * rgba(255,255,255,0.95)-bakgrunner.
   */
  glassCard: (accent: string = '#ffba6c') => ({
    background: gradient.dashboardSurface(accent),
    color: tokens.text.primary,
    border: `1px solid ${tokens.border.accent}`,
    borderRadius: tokens.radius.lg,
    boxShadow: tokens.shadow.elevated,
  }),

  /** Card brukt for mindre seksjoner inne i dashboardet. */
  surfaceCard: () => ({
    bgcolor: tokens.bg.elevated,
    border: `1px solid ${tokens.border.subtle}`,
    borderRadius: tokens.radius.md / 8, // MUI bruker spacing-multiplier
    boxShadow: 'none',
    color: tokens.text.primary,
  }),

  /** Pill-knapp i dashboard-stil. */
  pillButton: (accent: string = '#ffba6c') => ({
    borderRadius: tokens.radius.pill,
    px: 2.5,
    py: 1,
    bgcolor: accent,
    color: tokens.text.inverse,
    fontWeight: 700,
    textTransform: 'none' as const,
    '&:hover': { bgcolor: withAlpha(accent, 0.88) },
  }),

  /** Outlined pill-knapp. */
  pillOutlined: (accent: string = '#ffba6c') => ({
    borderRadius: tokens.radius.pill,
    px: 2.5,
    py: 1,
    textTransform: 'none' as const,
    color: tokens.text.primary,
    borderColor: tokens.border.accentStrong,
    '&:hover': { borderColor: accent, bgcolor: withAlpha(accent, 0.08) },
  }),

  /** Header-band i toppen av dialog. */
  dialogHeader: (accent: string = '#ffba6c') => ({
    px: 3,
    pt: 3,
    pb: 2,
    background: gradient.headerBand(accent),
    borderBottom: `1px solid ${tokens.border.accent}`,
  }),

  /** Tekstfelt med dark-tema (override MUI-defaults). */
  darkTextField: (accent: string = '#ffba6c') => ({
    '& .MuiInputLabel-root': { color: tokens.text.secondary },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& .MuiOutlinedInput-root': {
      color: tokens.text.primary,
      '& fieldset': { borderColor: tokens.border.nominal },
      '&:hover fieldset': { borderColor: tokens.border.accentStrong },
      '&.Mui-focused fieldset': { borderColor: accent },
    },
  }),
};

// ─── Inline-style-helper (for legacy CSS) ──────────────────────────
export const dashboardStyles: Record<string, CSSProperties> = {
  textPrimary: { color: tokens.text.primary },
  textSecondary: { color: tokens.text.secondary },
  textMuted: { color: tokens.text.muted },
};
