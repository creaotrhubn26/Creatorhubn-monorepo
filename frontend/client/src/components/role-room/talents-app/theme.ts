/**
 * theme.ts — The Role Room Talents design tokens.
 *
 * Mørk indigo palett. Avløser den lilla/magenta paletten fra mockup-specen
 * (2026-05-30) — indigo er valgt som The Role Rooms uttrykk, og fargen er et
 * merkevalg som må gjelde alle flatene samtidig. Én side i en annen farge
 * koster mer konsistens enn den kjøper.
 *
 * Alle sider (Partners & Collaboration, Talent Registry, Auditions,
 * Self-Tape Studio, CV) bruker disse konstantene. Endres en farge her,
 * endres den overalt — det er hele poenget med at de står ett sted.
 */

export const palette = {
  // Bakgrunner — fra ytterst (deep navy-black) til innerst (kort)
  bgRoot: '#060a18',
  bgShell: '#0b1024',
  bgCard: '#111832',
  bgCardElevated: '#17203f',

  // Borders — CreatorHub Design (Fase C): aksent-avledet, CSS-var-drevet fra
  // design-tokens (ws=theroleroom). Uten override = literalene her (identisk).
  border: 'var(--rr-border, rgba(99, 102, 241, 0.18))',
  borderStrong: 'var(--rr-border-strong, rgba(99, 102, 241, 0.32))',
  borderSubtle: 'var(--rr-border-subtle, rgba(99, 102, 241, 0.08))',

  // Tekst
  textPrimary: '#f2f4ff',
  textSecondary: '#c7cdfd',
  textMuted: '#8e97c9',

  // Accent — indigo, fra dyp til lys (token-drevet, literal-fallback)
  accent: 'var(--rr-accent, #6366f1)',
  accentBright: '#a5b4fc',
  accentMuted: '#4338ca',
  accentGradient: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)',

  // Status
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#38bdf8',

  // Filmstrip-shimmer på sidebaren (aksent-avledet)
  filmstrip: 'var(--rr-filmstrip, rgba(99, 102, 241, 0.06))',
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
  card: '0 8px 32px rgba(99, 102, 241, 0.08)',
  cardHover: '0 12px 40px rgba(99, 102, 241, 0.16)',
  glow: '0 0 24px rgba(99, 102, 241, 0.32)',
} as const;

export const space = {
  xs: 0.5,
  sm: 1,
  md: 1.5,
  lg: 2,
  xl: 3,
  xxl: 4,
} as const;
