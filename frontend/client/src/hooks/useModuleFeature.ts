/**
 * useModuleFeature.ts
 *
 * Sjekker om en modul-feature er aktivert for innlogget brukers org, via
 * GET /api/module-features/:moduleKey/:featureKey (module_feature_entitlements-
 * resolveren, CTO-audit P1). Skiller seg fra useFeatureFlag (flate
 * admin-flagg) ved å være org-/entitlement-scopet.
 *
 * Semantikk:
 *   - Under lasting: enabled=false + isLoading=true — kall-stedet bør la være
 *     å mounte modul-komponenter før svaret er inne, så de ikke fyrer
 *     API-kall som 403-er når modulen er låst.
 *   - Ved feil (nettverk/endepunkt mangler): fail-open til 'included' for
 *     bakoverkompatibilitet — samme policy som backend-resolveren.
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

export type ModuleFeatureState = "included" | "trial" | "add_on" | "locked";

interface ModuleFeatureResponse {
  moduleKey: string;
  featureKey: string;
  state: ModuleFeatureState;
  enabled: boolean;
}

export function useModuleFeature(moduleKey: string, featureKey = "core") {
  const { data, isLoading, isError } = useQuery<ModuleFeatureResponse>({
    queryKey: ["/api/module-features", moduleKey, featureKey],
    queryFn: () => apiRequest(`/api/module-features/${moduleKey}/${featureKey}`),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fail-open ved feil; ellers stol på backend-svaret.
  const enabled = isError ? true : data?.enabled ?? false;

  return {
    enabled: isLoading ? false : enabled,
    state: data?.state ?? null,
    isLoading,
  };
}
