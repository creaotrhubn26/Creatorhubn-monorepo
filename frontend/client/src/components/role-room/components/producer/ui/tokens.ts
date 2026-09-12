/**
 * Role Room producer design tokens.
 *
 * The producer panels (SocialInboxPanel, SocialAnalyticsPanel, LeadsPanel, …)
 * all hardcode the same dark `rgba(...)` strings, accent colors and type-scale.
 * These constants are the single source of truth so future code stops copying
 * raw rgba literals around. They mirror the existing living panels EXACTLY —
 * adopting them must not change a single rendered pixel.
 *
 * @example
 * import { RR_COLORS, RR_RADIUS, RR_TYPE } from './ui/tokens';
 *
 * <Box sx={{
 *   bgcolor: RR_COLORS.panelBg,
 *   border: RR_COLORS.border,
 *   borderRadius: RR_RADIUS.panel,
 * }}>
 *   <Typography sx={{ ...RR_TYPE.header, color: RR_COLORS.headingStrong }}>Inbox</Typography>
 * </Box>
 */

/** Color palette shared by every producer panel. */
export const RR_COLORS = {
  /** Panel container background. */
  panelBg: 'rgba(15,23,42,0.55)',
  /** Card / nested-surface background. */
  cardBg: 'rgba(15,23,42,0.6)',
  /** Slightly recessed surface (rows, sub-cards). */
  surfaceBg: 'rgba(15,23,42,0.5)',
  /** Empty-state / muted surface background. */
  mutedBg: 'rgba(15,23,42,0.4)',
  /** Standard 1px border. */
  border: '1px solid rgba(148,163,184,0.18)',
  /** Raw border color (for partial borders, dividers with custom alpha). */
  borderColor: 'rgba(148,163,184,0.18)',
  /** Faint divider color. */
  dividerColor: 'rgba(148,163,184,0.12)',
  /** Dashed border used by empty states. */
  dashedBorder: '1px dashed rgba(148,163,184,0.25)',

  /** Primary accent (cyan). */
  accent: '#22d3ee',
  /** Light accent (cyan text on tint). */
  accentLight: '#a5f3fc',
  /** Accent tint background (subtle). */
  accentBgSubtle: 'rgba(34,211,238,0.08)',
  /** Accent tint background (stronger). */
  accentBg: 'rgba(34,211,238,0.12)',
  /** Accent border for chips/pills. */
  accentBorder: '1px solid rgba(34,211,238,0.3)',

  /** Strongest heading text. */
  headingStrong: '#f8fafc',
  /** Heading / body-strong text. */
  heading: '#e2e8f0',
  /** Muted body text. */
  textMuted: 'rgba(226,232,240,0.66)',
  /** More muted / caption text. */
  textFaint: 'rgba(226,232,240,0.55)',
  /** Faintest meta text (timestamps, footnotes). */
  textGhost: 'rgba(226,232,240,0.45)',

  /** Severity / sentiment colors. */
  negative: '#f87171',
  positive: '#86efac',
  neutral: '#94a3b8',
  /** Warning / medium severity. */
  warning: '#fbbf24',
  /** High severity (alias of negative). */
  high: '#f87171',

  /** Error alert background + text (matches every panel's <Alert severity="error">). */
  errorBg: 'rgba(239,68,68,0.08)',
  errorText: '#fecaca',
} as const;

/**
 * Radius scale (MUI `theme.spacing`-style multipliers — pass straight to
 * `borderRadius`). Panels use 2, rows/sub-cards use 1.4.
 */
export const RR_RADIUS = {
  /** Panel / card radius. */
  panel: 2,
  /** Row / sub-card radius. */
  row: 1.4,
} as const;

/**
 * Type-scale presets — spread directly into an `sx` prop. Colors are NOT
 * included (compose with RR_COLORS) so the same heading scale can render in
 * strong or muted ink.
 */
export const RR_TYPE = {
  /** Panel header title (~1.05rem / 800). */
  header: {
    fontSize: '1.05rem',
    fontWeight: 800,
  },
  /** Sub-section heading (~0.86rem / 700). */
  sectionTitle: {
    fontSize: '0.86rem',
    fontWeight: 700,
  },
  /** Default body text (~0.84rem). */
  body: {
    fontSize: '0.84rem',
  },
  /** Big metric value (~1.5rem / 800). */
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
  },
  /** Small uppercase label (~0.7rem / 700, tracked). */
  label: {
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
} as const;

export type RrColors = typeof RR_COLORS;
export type RrRadius = typeof RR_RADIUS;
export type RrType = typeof RR_TYPE;
