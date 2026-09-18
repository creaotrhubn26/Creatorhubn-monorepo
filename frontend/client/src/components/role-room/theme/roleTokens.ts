/**
 * Role Room design-tokens.
 *
 * Kanonisk farge-palette ekstraktert fra RolePoolPanel.tsx (linje 63-71)
 * som har blitt repetert lokalt i 5 paneler (Role/Candidate/Crew/Audition/
 * RolePool) og hardkodet i 7+ andre.
 *
 * Bruk i nye paneler:
 *   import { roleTokens } from '../theme/roleTokens';
 *
 *   sx={{
 *     bgcolor: roleTokens.surface,
 *     color: roleTokens.text,
 *     border: `1px solid ${roleTokens.border}`,
 *   }}
 */

export const roleTokens = {
  /** Hovedaksent — lilla #5d76cb. CreatorHub Design (Fase C): CSS-var-drevet fra
   *  design-tokens (ws=theroleroom); literal-fallback = identisk. accentHover/Soft er
   *  håndplukkede (ikke eksakt aksent-derivbare) → holdes literal. */
  accent: 'var(--role-accent, #5d76cb)',
  /** Hover-aksent — litt mørkere lilla #5d76cb. */
  accentHover: '#5d76cb',
  /** Soft aksent — rgba med 0.24 alpha. Brukes for bakgrunn på chips. */
  accentSoft: 'rgba(93, 118, 203,0.24)',
  /** Surface — dypt lilla bg #2a3d56. Brukes for hovedflater. */
  surface: 'rgba(24, 18, 43,0.84)',
  /** Dempet surface — for nestede flater. */
  surfaceMuted: 'rgba(33, 28, 59,0.72)',
  /** Standard border for kort/dialoger (aksent-derivbar). */
  border: 'var(--role-border, rgba(93, 118, 203,0.32))',
  /** Primær tekst-farge — varm-hvit #eef1fb. */
  text: '#eef1fb',
  /** Dempet tekst — beige-lavendel for sekundær-info. */
  textMuted: 'rgba(224, 219, 250,0.82)',

  /** Status-farger (matcher roleWorkflow.ts) */
  status: {
    draft: '#6b7280',
    open: '#00d4ff',
    casting: '#ffb800',
    filled: '#10b981',
    cancelled: '#ef4444',
  },
} as const;

export type RoleToken = keyof typeof roleTokens;
