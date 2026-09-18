/**
 * theme.ts — The Role Room Talents design tokens.
 *
 * Mørk indigo palett, utledet av logoen.
 *
 * Fargene er ikke hentet fra et bibliotek. Logoen har sin egen hue-akse:
 * den mørke grunnen ligger på 258–265 (#1b122c), den dype fioletten på 268
 * (#2b2553) og den lyse magentaen på 290 (#a830c0). Paletten legger seg i
 * den kjølige enden av nettopp den aksen — indigo som fortsatt tilhører
 * merket, i stedet for en indigo som tilfeldigvis står i en fargeskala.
 *
 * Bakgrunnen ytterst (#1b122c) er logoens egen mørke grunn.
 *
 * Kontrast mot kortbakgrunnen: primærtekst 15,9:1, sekundærtekst 9,7:1,
 * dempet tekst 6,9:1, lys aksent 6,5:1. Den dempede teksten lå tidligere
 * på grensen av 4,5:1 — en palettendring er billigste tidspunkt å rette
 * det på.
 *
 * Alle sider (Partners & Collaboration, Talent Registry, Auditions,
 * Self-Tape Studio, CV) bruker disse konstantene. Endres en farge her,
 * endres den overalt — det er hele poenget med at de står ett sted.
 */

export const palette = {
  // Bakgrunner — fra ytterst (deep navy-black) til innerst (kort)
  bgRoot: '#1b122c',
  bgShell: '#2a3152',
  bgCard: '#2a3d56',
  bgCardElevated: '#3c4e6d',

  // Borders — CreatorHub Design (Fase C): aksent-avledet, CSS-var-drevet fra
  // design-tokens (ws=theroleroom). Uten override = literalene her (identisk).
  border: 'var(--rr-border, rgba(75, 61, 143, 0.18))',
  borderStrong: 'var(--rr-border-strong, rgba(75, 61, 143, 0.32))',
  borderSubtle: 'var(--rr-border-subtle, rgba(75, 61, 143, 0.08))',

  // Tekst
  textPrimary: '#eef1fb',
  textSecondary: '#c3cbe6',
  textMuted: '#95a3b2',   // Faded Indigo Denim, lysnet til 4,3:1 mot kort

  // Accent — fiolett-enden: merket (token-drevet, literal-fallback)
  accent: 'var(--rr-accent, #4b3d8f)',
  accentBright: '#93a4dc',
  accentMuted: '#32127a',
  accentGradient: 'linear-gradient(135deg, #3e3180 0%, #5d76cb 100%)',

  // Veifinning — denim-enden. Brukes der noe skal skilles fra merket:
  // faner, sekundærknapper, kanter i produksjonsflaten.
  secondary: '#3f51b5',        // Earth Indigo
  secondarySoft: '#4a5f89',    // Indigo Pebble
  secondaryEdge: '#51668b',    // Tumbled Indigo

  // Status
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#ef4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#5d76cb',

  // Filmstrip-shimmer på sidebaren (aksent-avledet)
  filmstrip: 'var(--rr-filmstrip, rgba(75, 61, 143, 0.06))',
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
  card: '0 8px 32px rgba(75, 61, 143, 0.08)',
  cardHover: '0 12px 40px rgba(75, 61, 143, 0.16)',
  glow: '0 0 24px rgba(75, 61, 143, 0.32)',
} as const;

export const space = {
  xs: 0.5,
  sm: 1,
  md: 1.5,
  lg: 2,
  xl: 3,
  xxl: 4,
} as const;
