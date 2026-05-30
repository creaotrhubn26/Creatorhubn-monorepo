/**
 * theme.ts — The Role Room Talents design tokens.
 *
 * Mørk lilla/navy palett matchet til Daniels mockup-spec (2026-05-30).
 * Alle nye sider (Partners & Collaboration, Talent Registry, Auditions,
 * Self-Tape Studio) bruker disse konstantene for visuell konsistens.
 */

export const palette = {
  // Bakgrunner — fra ytterst (deep navy-black) til innerst (kort)
  bgRoot: '#0a0118',
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  bgCardElevated: '#1a0f3a',

  // Borders
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',

  // Tekst
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',

  // Accent — primær lilla + magenta-glow
  accent: '#a855f7',
  accentBright: '#c084fc',
  accentMuted: '#7c3aed',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',

  // Status
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#38bdf8',

  // Filmstrip-shimmer på sidebaren
  filmstrip: 'rgba(168, 85, 247, 0.06)',
} as const;

export const radius = {
  xs: '6px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '24px',
  pill: '999px',
} as const;

export const shadow = {
  card: '0 8px 32px rgba(168, 85, 247, 0.08)',
  cardHover: '0 12px 40px rgba(168, 85, 247, 0.16)',
  glow: '0 0 24px rgba(168, 85, 247, 0.32)',
} as const;

export const space = {
  xs: 0.5,
  sm: 1,
  md: 1.5,
  lg: 2,
  xl: 3,
  xxl: 4,
} as const;
