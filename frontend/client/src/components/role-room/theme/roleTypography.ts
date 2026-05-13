/**
 * Role Room typografi-skala.
 *
 * Kanonisk 5-tier responsive font-size-mønster ekstraktert fra Crew/
 * Candidate/Role/Audition-panelene som alle bruker identisk skala.
 * Brukes i Equipment/Prop/Kanban/StoryLogic-migrasjonen for å oppnå
 * visuell konsistens på tvers av alle Role Room-paneler.
 *
 * Bruk:
 *   import { roleTypography } from '../theme/roleTypography';
 *
 *   sx={{ fontSize: roleTypography.body }}
 *
 * Breakpoint-strategi:
 *   xs = 0-600px   (mobile)
 *   sm = 600-900px (mobile landscape / small tablet)
 *   md = 900-1200px (tablet portrait / small laptop)
 *   lg = 1200-1536px (standard desktop)
 *   xl = 1536px+    (large desktop / 2K)
 */

export const roleTypography = {
  /** Hovedtittel — h4-skala. Brukes for panel-headere. */
  headerH4: {
    xs: '1.25rem',
    sm: '1.5rem',
    md: '1.4rem',
    lg: '1.6rem',
    xl: '2rem',
  },

  /** Seksjons-tittel — h5-skala. */
  headerH5: {
    xs: '1.05rem',
    sm: '1.25rem',
    md: '1.18rem',
    lg: '1.35rem',
    xl: '1.5rem',
  },

  /** Card-tittel — h6-skala. */
  headerH6: {
    xs: '0.95rem',
    sm: '1.1rem',
    md: '1.05rem',
    lg: '1.18rem',
    xl: '1.3rem',
  },

  /** Body — standard tekst. Vanligst brukt. */
  body: {
    xs: '0.875rem',
    sm: '1rem',
    md: '0.95rem',
    lg: '1.05rem',
    xl: '1.125rem',
  },

  /** Mindre body. */
  bodySmall: {
    xs: '0.8rem',
    sm: '0.875rem',
    md: '0.85rem',
    lg: '0.9rem',
    xl: '1rem',
  },

  /** Caption — for muted/sekundær-info. */
  caption: {
    xs: '0.7rem',
    sm: '0.75rem',
    md: '0.72rem',
    lg: '0.8rem',
    xl: '0.9rem',
  },

  /** Mikro — for chips og badges. */
  micro: {
    xs: '0.65rem',
    sm: '0.7rem',
    md: '0.68rem',
    lg: '0.75rem',
    xl: '0.85rem',
  },
} as const;

/**
 * Standard chip-høyder (matcher fontSize-skala).
 */
export const roleChipHeight = {
  small: { xs: 20, sm: 22, md: 21, lg: 24, xl: 28 },
  medium: { xs: 22, sm: 24, md: 23, lg: 26, xl: 30 },
} as const;

/**
 * Standard ikon-størrelser (for konsistens på tvers av paneler).
 */
export const roleIconSize = {
  small: { xs: 16, sm: 18, md: 17, lg: 19, xl: 22 },
  medium: { xs: 18, sm: 20, md: 19, lg: 22, xl: 26 },
  large: { xs: 20, sm: 24, md: 22, lg: 26, xl: 30 },
} as const;
