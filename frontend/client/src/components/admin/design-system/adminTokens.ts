/**
 * adminTokens.ts — kanoniske design-tokens for admin-dashbordet.
 *
 * Admin-flaten har historisk hardkodet farger/spacing direkte i `sx` (5588+
 * hex-literaler, 3 konkurrerende brand-oransjer). Disse tokenene fanger de
 * DE-FACTO mest brukte verdiene, så å ta dem i bruk er visuelt nøytralt, men
 * gir én kilde til sannhet. Bruk via design-system-komponentene (AdminCard,
 * AdminButton, StatusChip …) eller direkte i `sx`.
 *
 * Brand = #ff8c00 (admin-standard, 326 forekomster). Kan senere forenes med
 * det globale temaet (`theme/creatorHubTheme.ts`, #FF6B35) i ett steg.
 */
export const adminTokens = {
  color: {
    // Merkevare-aksent
    brand: "#ff8c00",
    brandHover: "#e67c00",
    brandSubtle: "rgba(255, 140, 0, 0.12)",

    // Overflater (mørkt tema)
    surface: "rgba(255, 255, 255, 0.04)",
    surfaceElevated: "rgba(255, 255, 255, 0.06)",
    surfaceHover: "rgba(255, 255, 255, 0.08)",

    // Kantlinjer
    border: "rgba(255, 255, 255, 0.12)",
    borderSubtle: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.20)",

    // Tekst (alle ≥ WCAG AA mot mørk overflate)
    text: "#ffffff",
    textSecondary: "rgba(255, 255, 255, 0.78)",
    textMuted: "rgba(255, 255, 255, 0.62)",

    // Status / semantikk
    success: "#4caf50",
    warning: "#ff9800",
    error: "#f44336",
    danger: "#d32f2f",
    dangerHover: "#b71c1c",
    info: "#29b6f6",
  },

  /** Rolle → fargekode (super_admin rød, admin oransje, bruker grønn). */
  role: {
    super_admin: "#f44336",
    admin: "#ff9800",
    user: "#4caf50",
  } as Record<string, string>,

  radius: { sm: 8, md: 12, lg: 16, pill: 999 },

  /** MUI-spacing-skala (8px-basert) — bruk for konsistent padding/gap. */
  space: (n: number): number => n * 8,
} as const;

export type AdminTokens = typeof adminTokens;
