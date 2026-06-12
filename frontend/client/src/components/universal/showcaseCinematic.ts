/**
 * showcaseCinematic.ts
 * ────────────────────────────────────────────────────────────────────────
 * Single source of truth for the Universal Showcase "dark cinematic premium"
 * design language. The shell of UniversalShowcase already established a dark
 * "academy" palette inline (radial-gradient #06080d, amber accent, cool
 * secondary #5279cc, Manrope/Barlow editorial type). This module extracts and
 * unifies those tokens so cards, the detail view and empty states all speak
 * the same visual language instead of drifting into the older blue palette.
 *
 * Design intent: the content owns the stage. Chrome is quiet, surfaces have
 * subtle depth (not flat, not glassy-overdone), accent is used sparingly so it
 * reads as exclusive rather than loud. Motion is calm and respects
 * prefers-reduced-motion (handled at the shell level).
 */

/**
 * Core palette — dark cinematic premium (warm neutral, NOT blue).
 * Aligned to the brand brief §7: warm-black backdrops, cream text, controlled
 * amber accent. Deliberately avoids any cool/blue undertone so the surface reads
 * as A24/Apple TV+ editorial rather than generic blue SaaS.
 */
export const CINE = {
  // Backdrops — warm neutral black (no blue undertone)
  bg: '#0B0B0C',
  bgDeep: '#070707',
  // Surfaces (translucent so the layered radial backdrop reads through them)
  surface: 'rgba(17, 17, 19, 0.84)',
  surfaceElevated: 'rgba(24, 24, 27, 0.92)',
  surfaceSolid: '#111113',
  // Hairlines
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  // Text — warm off-white / cream
  textPrimary: '#F5F2EA',
  textSecondary: 'rgba(245, 242, 234, 0.68)',
  textMuted: 'rgba(245, 242, 234, 0.42)',
  // Accent — CreatorHub amber/orange, used sparingly so it reads exclusive
  accent: '#FF6B35',
  accentSoft: '#FF8F5C',
  accentSubtle: 'rgba(255, 140, 0, 0.12)',
  // Muted, professional status colors (never neon)
  success: '#5fb88a',
  danger: '#e0606a',
  warning: '#e0a955',
} as const;

/** Editorial type stack used across the showcase shell. */
export const CINE_FONT = '"Manrope", "Barlow", "Segoe UI", sans-serif';
export const CINE_FONT_DISPLAY = '"Barlow", "Manrope", "Segoe UI", sans-serif';

/** Calm motion. Components must still gate these behind reduced-motion. */
export const CINE_MOTION = {
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  fast: '160ms',
  base: '280ms',
  slow: '480ms',
  hoverZoom: 1.045,
} as const;

/** 8px spacing baseline helper (returns px string). */
export const space = (n: number): string => `${n * 8}px`;

/**
 * Compose an rgba() string from a #RRGGBB hex + alpha (0–1).
 * Tolerant of values already in rgba()/hsl() form (returns them untouched).
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  const full = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** A bottom-up scrim so titles/actions stay legible over any image. */
export const scrimGradient =
  'linear-gradient(180deg, rgba(7,7,7,0) 0%, rgba(7,7,7,0.05) 38%, rgba(7,7,7,0.62) 78%, rgba(7,7,7,0.94) 100%)';

/** A top-down scrim for top-aligned chrome (counts, badges). */
export const scrimGradientTop =
  'linear-gradient(0deg, rgba(7,7,7,0) 30%, rgba(7,7,7,0.55) 100%)';

/** Uppercase small-caps metadata label style (editorial). */
export const metaLabelSx = {
  fontFamily: CINE_FONT,
  fontSize: '0.66rem',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: CINE.textMuted,
};

/**
 * Frosted panel surface used by the detail sidebar, empty states and any
 * floating control surface. Pass an accent to tint the hairline subtly.
 */
export function glassPanelSx(accent: string = CINE.accent) {
  return {
    bgcolor: CINE.surfaceElevated,
    backdropFilter: 'blur(22px)',
    border: `1px solid ${CINE.border}`,
    borderRadius: '16px',
    boxShadow: `0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 ${withAlpha(accent, 0.06)}`,
  };
}

/**
 * Content-first poster-card surface. The media should fill it; metadata and
 * actions live on a scrim that strengthens on hover. `accent` tints the
 * hover glow so each profession's color carries through.
 */
export function posterCardSx(accent: string = CINE.accent, reducedMotion = false) {
  const t = reducedMotion ? '0.001ms' : CINE_MOTION.base;
  return {
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: '14px',
    bgcolor: CINE.surfaceSolid,
    border: `1px solid ${CINE.border}`,
    cursor: 'pointer',
    transition: `transform ${t} ${CINE_MOTION.ease}, box-shadow ${t} ${CINE_MOTION.ease}, border-color ${t} ${CINE_MOTION.ease}`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
    '&:hover': reducedMotion
      ? { borderColor: withAlpha(accent, 0.45) }
      : {
          transform: 'translateY(-6px)',
          borderColor: withAlpha(accent, 0.5),
          boxShadow: `0 22px 48px rgba(0,0,0,0.6), 0 0 0 1px ${withAlpha(accent, 0.25)}, 0 0 40px ${withAlpha(accent, 0.18)}`,
        },
    '&:focus-visible': {
      outline: `2px solid ${withAlpha(accent, 0.8)}`,
      outlineOffset: '2px',
    },
  };
}
