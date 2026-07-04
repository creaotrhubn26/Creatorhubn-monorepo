// @ts-nocheck
/**
 * useWorkspaceCategory — admin-styrt workspace-kategori per profesjon.
 *
 * Henter profesjonslisten fra /api/admin/profession-types (samme queryKey/
 * cache som useDynamicProfessions, 5 min) og bygger profesjon→kategori-map
 * fra workspaceCategory-feltet (DB-kolonnen profession_types.workspace_category,
 * satt i ProfessionTypeManager). workspaceCategoryFor() faller tilbake til
 * kode-mappet ved offline/første render — nav-en kan aldri bli tom eller feil
 * under lasting, bare et kort øyeblikk kode-baseline i stedet for admin-valget.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isWorkspaceCategory } from '@shared/profession-types';
import { workspaceCategoryFor, wsProfessionKey, type WorkspaceCategory } from './workspaceTheme';

export function useWorkspaceCategoryMap(): Record<string, WorkspaceCategory> {
  const { data } = useQuery({
    queryKey: ['/api/admin/profession-types'],
    queryFn: () => apiRequest('/api/admin/profession-types'),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
  return useMemo(() => {
    const rows = Array.isArray(data) ? data : Array.isArray(data?.professions) ? data.professions : [];
    const map: Record<string, WorkspaceCategory> = {};
    for (const r of rows) {
      if (r?.name && isWorkspaceCategory(r.workspaceCategory)) {
        map[wsProfessionKey(r.name)] = r.workspaceCategory;
      }
    }
    return map;
  }, [data]);
}

export function useWorkspaceCategory(profession?: string | null): WorkspaceCategory {
  const overrides = useWorkspaceCategoryMap();
  return workspaceCategoryFor(profession, overrides);
}
