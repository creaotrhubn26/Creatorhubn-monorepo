/**
 * Shared design-tokens for AdminRoom-tabs.
 *
 * AdminRoom har et eget visuelt språk (dark-tema med lilla primær,
 * deep slate-bakgrunn) som er forskjellig fra dashboard-design-tokens
 * (som er for produkt-dashboardet med custom branding-farger).
 *
 * Bruk:
 *   import { adminTokens, adminSx } from './styles';
 *   <Card sx={adminSx.panel}>…</Card>
 *   <Button sx={adminSx.primaryButton}>…</Button>
 */

export const adminTokens = {
  // Text
  text: {
    primary: '#fff',                      // headers / emphasis
    body: '#e2e8f0',                      // body
    secondary: 'rgba(203,213,225,0.72)',  // captions / supporting
    muted: 'rgba(203,213,225,0.5)',       // hints / metadata
    disabled: 'rgba(203,213,225,0.32)',
  },
  // Backgrounds
  bg: {
    base: '#0a0807',
    panel: 'rgba(2,6,23,0.42)',           // standard card bg
    panelDeep: 'rgba(2,6,23,0.6)',        // nested elements inside a panel
    overlay: 'rgba(2,6,23,0.96)',         // drawers / dialogs
  },
  // Borders
  border: {
    subtle: 'rgba(148,163,184,0.10)',     // dividers between rows
    nominal: 'rgba(148,163,184,0.18)',    // standard panel border
    accent: 'rgba(168,85,247,0.32)',      // primary action highlight
  },
  // Primary brand-purple (matcher AdminRoom inline-styles)
  primary: {
    base: '#7c3aed',
    soft: 'rgba(168,85,247,0.16)',
    softer: 'rgba(168,85,247,0.08)',
    text: '#ddd6fe',
    textLight: '#c4b5fd',
    textBright: '#a78bfa',
  },
  // Status palette (konsistent på tvers av panel-typer)
  status: {
    success:    { bg: 'rgba(16,185,129,0.15)', text: '#86efac', border: 'rgba(16,185,129,0.32)', base: '#22c55e' },
    warning:    { bg: 'rgba(251,191,36,0.15)', text: '#fde68a', border: 'rgba(251,191,36,0.32)', base: '#fbbf24' },
    error:      { bg: 'rgba(239,68,68,0.15)',  text: '#fca5a5', border: 'rgba(239,68,68,0.32)',  base: '#ef4444' },
    info:       { bg: 'rgba(59,130,246,0.16)', text: '#bfdbfe', border: 'rgba(59,130,246,0.32)', base: '#60a5fa' },
    neutral:    { bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1', border: 'rgba(148,163,184,0.32)', base: '#94a3b8' },
  },
  // Sosial-plattform-aksenter (gjenbruk i panel-headers)
  platforms: {
    facebook:  '#60a5fa',
    instagram: '#ec4899',
    linkedin:  '#0a66c2',
    tiktok:    '#f97316',
    youtube:   '#ef4444',
  },
} as const;

export const adminSx = {
  // Standard panel/card
  panel: {
    background: adminTokens.bg.panel,
    border: `1px solid ${adminTokens.border.nominal}`,
    color: adminTokens.text.body,
  },
  // Accent-paneler (lilla-rammet for AI/insights)
  panelAccent: {
    background: adminTokens.bg.panel,
    border: `1px solid ${adminTokens.border.accent}`,
    color: adminTokens.text.body,
  },
  // Primary CTA-knapp
  primaryButton: {
    background: adminTokens.primary.base,
    color: '#fff',
    textTransform: 'none' as const,
    fontWeight: 700,
    '&:hover': { background: '#6d28d9' },
  },
  // Sekundær knapp (text-stil)
  secondaryButton: {
    color: adminTokens.primary.textBright,
    textTransform: 'none' as const,
    fontWeight: 600,
  },
  // Section-header (h6-aktig)
  sectionHeader: {
    color: adminTokens.text.primary,
    fontWeight: 800,
    fontSize: '1.05rem',
  },
  // Section sub-header (under panel-tittel)
  sectionSubHeader: {
    color: adminTokens.text.secondary,
    fontWeight: 600,
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  // Standard chip (lilla)
  chipPrimary: {
    background: adminTokens.primary.soft,
    color: adminTokens.primary.text,
    fontSize: '0.65rem',
    height: 18,
  },
} as const;

// Helper: status-chip-styling basert på kategori
export function statusChipSx(status: keyof typeof adminTokens.status) {
  const s = adminTokens.status[status];
  return {
    background: s.bg,
    color: s.text,
    fontSize: '0.65rem',
    height: 18,
  };
}
