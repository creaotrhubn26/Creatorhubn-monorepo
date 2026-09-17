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
  /** Hovedaksent — lilla #8d80ea. CreatorHub Design (Fase C): CSS-var-drevet fra
   *  design-tokens (ws=theroleroom); literal-fallback = identisk. accentHover/Soft er
   *  håndplukkede (ikke eksakt aksent-derivbare) → holdes literal. */
  accent: 'var(--role-accent, #8d80ea)',
  /** Hover-aksent — litt mørkere lilla #7666e6. */
  accentHover: '#7666e6',
  /** Soft aksent — rgba med 0.24 alpha. Brukes for bakgrunn på chips. */
  accentSoft: 'rgba(141, 128, 234,0.24)',
  /** Surface — dypt lilla bg #120e30. Brukes for hovedflater. */
  surface: 'rgba(20,14,48,0.84)',
  /** Dempet surface — for nestede flater. */
  surfaceMuted: 'rgba(33,24,70,0.72)',
  /** Standard border for kort/dialoger (aksent-derivbar). */
  border: 'var(--role-border, rgba(141, 128, 234,0.32))',
  /** Primær tekst-farge — varm-hvit #efedfc. */
  text: '#efedfc',
  /** Dempet tekst — beige-lavendel for sekundær-info. */
  textMuted: 'rgba(215, 212, 248,0.82)',

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
