/**
 * Delt palett for AdminWorkspace-flatene.
 *
 * Lå tidligere som en lokal kopi i hver fil (AdminWorkspace.tsx og
 * SakerTab.tsx hadde hver sin, med litt ulikt innhold). Ett sted nå, så
 * nye paneler ikke driver fra hverandre.
 */
export const BRAND = {
  bgGradient: 'linear-gradient(180deg, #0b0518 0%, #1a0a2e 100%)',
  sidebarBg: 'rgba(11, 5, 24, 0.92)',
  panelBg: 'rgba(26, 10, 46, 0.72)',
  accent: '#a78bfa',
  accentStrong: '#7c3aed',
  border: 'rgba(167, 139, 250, 0.2)',
  borderHover: 'rgba(167, 139, 250, 0.4)',
  text: '#f1f5f9',
  textMuted: 'rgba(241, 245, 249, 0.78)',
  textDim: 'rgba(241, 245, 249, 0.55)',
  hoverBg: 'rgba(167, 139, 250, 0.08)',
  selectedBg: 'rgba(167, 139, 250, 0.16)',
  danger: '#fda4af',
  success: '#22c55e',
  warning: '#fbbf24',
} as const;
