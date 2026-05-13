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
  /** Hovedaksent — lilla #b86bff. Brukes for active-state, knapper, fokus. */
  accent: '#b86bff',
  /** Hover-aksent — litt mørkere lilla #a855f7. */
  accentHover: '#a855f7',
  /** Soft aksent — rgba med 0.24 alpha. Brukes for bakgrunn på chips. */
  accentSoft: 'rgba(184,107,255,0.24)',
  /** Surface — dypt lilla bg #200e30. Brukes for hovedflater. */
  surface: 'rgba(20,14,48,0.84)',
  /** Dempet surface — for nestede flater. */
  surfaceMuted: 'rgba(33,24,70,0.72)',
  /** Standard border for kort/dialoger. */
  border: 'rgba(184,107,255,0.32)',
  /** Primær tekst-farge — varm-hvit #f3eaff. */
  text: '#f3eaff',
  /** Dempet tekst — beige-lavendel for sekundær-info. */
  textMuted: 'rgba(220,205,255,0.82)',

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
