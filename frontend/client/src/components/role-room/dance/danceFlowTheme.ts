/**
 * DanceFlow design tokens.
 *
 * Sentralisert palette + spacing for The Role Room's dans-formasjons-flate.
 * Frekvensene i kommentarene refererer til dagens hardkodede hex-bruk i
 * dance/-mappen (per audit 2026-05-31) — vi sentraliserer det som allerede
 * dominerer kodebasen i stedet for å innføre ny palett.
 *
 * Phase 1 wave: bare nye komponenter (DanceFlowShell + senere FormationHeaderBar,
 * ClipsSidebar, ...) bruker tokens. Phase 6 vandrer eksisterende hex-literals
 * over (FormationView, FormationDetailsPanel, etc.).
 */

export const danceFlowColors = {
  // Surfaces (mørke nyanser av samme blå-svart)
  bgBase: '#0a0a0a', //   35× — workspace-bakgrunn (DanceWorkspace, FormationView ytre)
  bgPanel: '#0f1318', //  22× — paneler, sidebar-kort, modaler
  bgInset: '#0d1218', //   1× — innfelte felt (textareas, inputs)
  bgRaised: '#11151c', //  1× — løftede knapper/chips over panel

  // Borders & dividers
  borderStrong: '#1e2536', // 60× — primær panelbord/divider
  borderSoft: '#2a3142', //   21× — sekundær divider, hover-states

  // Brand accent (lavender)
  lavender: '#a78bfa', //      103× — primær aksent (knapper, fokusring, badges)
  lavenderDark: '#8b5cf6', //   43× — hover/active
  lavenderDeep: '#7c3aed', //   25× — pressed/selected
  lavenderLight: '#c4b5fd', //  30× — disabled-aksent, dim aksent-tekst

  // Secondary accents
  gold: '#fbbf24', //   42× — highlights, premium-badges
  amber: '#f59e0b', //  12× — varselsaccent (mindre alvorlig enn rød)

  // Status
  successPrimary: '#34d399', //  29× — bekreftet/saved-pill
  successDark: '#10b981', //     22× — success-hover
  errorPrimary: '#f87171', //    18× — feiltilstand
  errorSoft: '#fca5a5', //       17× — feilbakgrunn
  warning: '#f59e0b', //         alias for amber — semantic

  // Text
  textPrimary: '#ffffff', //    77× — overskrifter, brødtekst på dark bg
  textSecondary: '#e5e7eb', //  70× — beskrivelser
  textMuted: '#9ca3af', //      63× — metadata, helper-tekst
  textDisabled: '#6b7280', //   59× — disabled-state
} as const;

export const danceFlowSpacing = {
  /** Outer shell grid columns */
  clipsSidebarWidth: 220,
  detailsSidebarWidth: 320,

  /** Inner content padding */
  paneGutter: 16,
  rowGap: 12,

  /** Header bar */
  headerHeight: 48,

  /** Timeline */
  timelineHeight: 220,
} as const;

export const danceFlowRadius = {
  panel: 12,
  control: 8,
  pill: 999,
} as const;

export const danceFlowShadows = {
  panel: '0 1px 3px rgba(0, 0, 0, 0.4)',
  raised: '0 4px 12px rgba(0, 0, 0, 0.5)',
} as const;

/**
 * MUI sx-shortcuts for ofte brukte kombinasjoner. Returner et sx-object,
 * ikke en hex-string — så bruk sx={{ ...danceFlowSx.panelSurface, ... }}.
 */
export const danceFlowSx = {
  panelSurface: {
    bgcolor: danceFlowColors.bgPanel,
    border: `1px solid ${danceFlowColors.borderStrong}`,
    borderRadius: `${danceFlowRadius.panel}px`,
  },
  workspaceSurface: {
    bgcolor: danceFlowColors.bgBase,
    color: danceFlowColors.textPrimary,
    minHeight: '100%',
  },
} as const;
