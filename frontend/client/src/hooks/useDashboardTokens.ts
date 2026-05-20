/**
 * useDashboardTokens — Slice 9X.72
 *
 * Henter design-tokens for dashboardet. Returnerer alltid en gyldig
 * token-tre, men prioriteringen er:
 *
 *   1. Admin-overrides fra /api/admin/design-tokens (Visual CMS-styrt)
 *   2. Profesjons-spesifikk override fra useProfessionConfigs
 *      (accent-color settes der hver enkelt profesjon kan ha sin egen)
 *   3. Hardkodede defaults i dashboard-design-tokens.ts
 *
 * Dette gjør at Daniel kan endre dashboard-farger/border-radius i admin
 * uten kode-deploy, MEN at appen alltid har gyldig fallback hvis API
 * eller CMS er nede.
 *
 * Visual CMS-integration:
 *   - Backend-endpoint må eksistere (TODO Slice 9X.73)
 *   - CMS-UI for token-redigering (color-pickere, slidere) (TODO Slice 9X.73)
 *   - Det vi gir hooket i dag er bare grunnstrukturen.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { tokens as defaultTokens, gradient as defaultGradient, dashboardSx as defaultSx } from '@/utils/dashboard-design-tokens';

interface AdminTokenOverrides {
  /** Hovedaccent (overstyrer profession-color). */
  accentColor?: string;
  /** Sekundær accent for kontrast. */
  accentColorSecondary?: string;
  /** Tekstfarger — sjelden overstyrt. */
  textPrimary?: string;
  textSecondary?: string;
  /** Border-radius som tall (px). */
  radiusMd?: number;
  radiusLg?: string;
  /** Font-family for overskrifter. */
  fontDisplay?: string;
}

export function useDashboardTokens(professionAccent?: string) {
  // Hent admin-overrides (CMS-styrt). Cache i 60s for å unngå mange kall.
  const { data: adminOverrides } = useQuery<AdminTokenOverrides>({
    queryKey: ['admin-design-tokens'],
    queryFn: async () => {
      try {
        const res = await apiRequest('/api/admin/design-tokens');
        return (res?.data || {}) as AdminTokenOverrides;
      } catch {
        return {};
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  return useMemo(() => {
    // Resolveringsrekkefølge: admin → profesjons-color → default
    const accent =
      adminOverrides?.accentColor
      || professionAccent
      || '#ffba6c';

    const merged = {
      ...defaultTokens,
      text: {
        ...defaultTokens.text,
        primary: adminOverrides?.textPrimary ?? defaultTokens.text.primary,
        secondary: adminOverrides?.textSecondary ?? defaultTokens.text.secondary,
      },
      radius: {
        ...defaultTokens.radius,
        md: adminOverrides?.radiusMd ?? defaultTokens.radius.md,
        lg: adminOverrides?.radiusLg ?? defaultTokens.radius.lg,
      },
      font: {
        ...defaultTokens.font,
        display: adminOverrides?.fontDisplay ?? defaultTokens.font.display,
      },
      // Aktiv accent for denne bruker-konteksten
      accent,
      accentSecondary: adminOverrides?.accentColorSecondary,
    };

    return {
      tokens: merged,
      accent,
      gradient: {
        dashboardSurface: () => defaultGradient.dashboardSurface(accent),
        headerBand: () => defaultGradient.headerBand(accent),
        cta: () => defaultGradient.cta(accent),
      },
      sx: {
        glassCard: () => defaultSx.glassCard(accent),
        surfaceCard: defaultSx.surfaceCard,
        pillButton: () => defaultSx.pillButton(accent),
        pillOutlined: () => defaultSx.pillOutlined(accent),
        dialogHeader: () => defaultSx.dialogHeader(accent),
        darkTextField: () => defaultSx.darkTextField(accent),
      },
    };
  }, [adminOverrides, professionAccent]);
}

export type DashboardTokens = ReturnType<typeof useDashboardTokens>;
