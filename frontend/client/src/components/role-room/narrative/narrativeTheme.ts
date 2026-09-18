/**
 * Story Graph design-tokens. Mørk flate som dans, grønn aksent (spillstudio).
 */

export const narrativeColors = {
  bgBase: '#0a0a0a',
  bgPanel: '#0f1318',
  bgCard: '#111114',
  borderStrong: '#1e2536',
  borderSoft: '#2a3142',
  accent: '#22c55e',
  accentDark: '#16a34a',
  accentSoft: 'rgba(34,197,94,0.15)',
  text: '#e5e7eb',
  textDim: 'rgba(229,231,235,0.62)',
  warning: '#f59e0b',
  error: '#f87171',
} as const;

/** Tema-farger for elementer (Arcweave: colour themes). */
export const ELEMENT_THEME_COLORS: Record<string, { border: string; header: string }> = {
  default: { border: '#3b4252', header: '#1f2430' },
  green: { border: '#22c55e', header: '#14532d' },
  blue: { border: '#3b82f6', header: '#1e3a8a' },
  purple: { border: '#a78bfa', header: '#3b1d6e' },
  amber: { border: '#f59e0b', header: '#78350f' },
  red: { border: '#ef4444', header: '#7f1d1d' },
  teal: { border: '#14b8a6', header: '#134e4a' },
  pink: { border: '#ec4899', header: '#831843' },
  gray: { border: '#6b7280', header: '#374151' },
};

export function themeColors(theme: string | null | undefined): { border: string; header: string } {
  return ELEMENT_THEME_COLORS[theme ?? 'default'] ?? ELEMENT_THEME_COLORS.default;
}
