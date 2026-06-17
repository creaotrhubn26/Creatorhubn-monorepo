/**
 * usePermissions.ts
 *
 * React-hook for å gate UI på effective Lead Map-permissions.
 *
 * 'View as role'-preview (PR #634):
 *   Admin kan velge en rolle å forhåndsvise i. Da overstyres `can()`
 *   til å bruke rolle-defaults i stedet for admin's egne. Backend-
 *   permissions endres IKKE (kun visuell preview) — denne overstyringen
 *   lever kun i localStorage og brukes til å verifisere RBAC-gating.
 *
 *   Aktiver:
 *     setViewAsRole('salgskonsulent')
 *   Avslutt:
 *     setViewAsRole(null)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

interface PermissionsState {
  role: string | null;
  realPermissions: Set<string>;
  organizationId: string | null;
  loaded: boolean;
}

const VIEW_AS_STORAGE_KEY = 'rr_lead_map_view_as_role';

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rr_lead_map_active_org');
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

function getStoredViewAsRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VIEW_AS_STORAGE_KEY);
}

// Defaults cache — hentes én gang per org-context
const roleDefaultsCache = new Map<string, Record<string, string[]>>();

async function fetchRoleDefaults(orgId: string, token: string): Promise<Record<string, string[]>> {
  if (roleDefaultsCache.has(orgId)) {
    return roleDefaultsCache.get(orgId)!;
  }
  try {
    const r = await fetch(
      `/api/admin-room/lead-map/organizations/${orgId}/role-defaults`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return {};
    const j = await r.json();
    const defaults = (j.defaults ?? {}) as Record<string, string[]>;
    roleDefaultsCache.set(orgId, defaults);
    return defaults;
  } catch {
    return {};
  }
}

export function usePermissions() {
  const [state, setState] = useState<PermissionsState>({
    role: null,
    realPermissions: new Set(),
    organizationId: null,
    loaded: false,
  });
  const [viewAsRole, setViewAsRoleState] = useState<string | null>(getStoredViewAsRole());
  const [roleDefaults, setRoleDefaults] = useState<Record<string, string[]>>({});

  const reload = useCallback(async () => {
    const orgId = getActiveOrgId();
    const token = getAuthToken();
    if (!token) {
      setState({ role: null, realPermissions: new Set(), organizationId: null, loaded: true });
      return;
    }
    try {
      const url = `/api/admin-room/lead-map/me/permissions${
        orgId ? `?organization_id=${orgId}` : ''
      }`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setState({ role: null, realPermissions: new Set(), organizationId: orgId, loaded: true });
        return;
      }
      const j = await r.json();
      setState({
        role: j.role,
        realPermissions: new Set(j.permissions ?? []),
        organizationId: j.organization_id,
        loaded: true,
      });
      // Hent rolle-defaults parallelt så preview-mode er klar når admin
      // velger View-as
      if (j.organization_id) {
        const defs = await fetchRoleDefaults(j.organization_id, token);
        setRoleDefaults(defs);
      }
    } catch {
      setState({ role: null, realPermissions: new Set(), organizationId: orgId, loaded: true });
    }
  }, []);

  useEffect(() => {
    void reload();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rr_lead_map_active_org' || e.key === 'rr_bearer') void reload();
      if (e.key === VIEW_AS_STORAGE_KEY) {
        setViewAsRoleState(getStoredViewAsRole());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);

  // Hvem kan bruke view-as? Admin + salgssjef + teamleder.
  // (Salgskonsulent/promotor/member/viewer kan ikke — det er deres
  // faktiske rolle de ser uansett.)
  const canPreview = state.role === 'admin'
    || state.role === 'salgssjef'
    || state.role === 'teamleder';

  // Effective permissions:
  //   - viewAsRole satt + caller er leder: bruk role-defaults for valgt rolle
  //   - ellers: ekte permissions
  const effectivePermissions = useMemo(() => {
    if (viewAsRole && canPreview) {
      return new Set(roleDefaults[viewAsRole] ?? []);
    }
    return state.realPermissions;
  }, [viewAsRole, canPreview, state.realPermissions, roleDefaults]);

  const can = useCallback(
    (key: string): boolean => effectivePermissions.has(key),
    [effectivePermissions],
  );

  const setViewAsRole = useCallback((role: string | null) => {
    // Admin/salgssjef/teamleder kan slå på preview-mode
    if (role && !canPreview) {
      console.warn('[usePermissions] view-as krever leder-rolle');
      return;
    }
    if (role) {
      localStorage.setItem(VIEW_AS_STORAGE_KEY, role);
    } else {
      localStorage.removeItem(VIEW_AS_STORAGE_KEY);
    }
    setViewAsRoleState(role);
  }, [canPreview]);

  return {
    /** Brukerens FAKTISKE rolle (uavhengig av view-as) */
    role: state.role,
    /** Effektiv rolle som vises (viewAsRole || role) */
    effectiveRole: viewAsRole ?? state.role,
    /** Er view-as preview aktivt? */
    isPreviewing: Boolean(viewAsRole) && canPreview,
    /** Kan denne brukeren bruke view-as i det hele tatt? */
    canPreview,
    /** Den simulerte rollen (null hvis ikke i preview) */
    viewAsRole,
    /** Set/unset preview-rolle */
    setViewAsRole,
    organizationId: state.organizationId,
    /** Effektive permissions (preview-bevisst) */
    permissions: effectivePermissions,
    /** Faktiske permissions (ignorerer preview) — sjelden brukt */
    realPermissions: state.realPermissions,
    /** Alle rolle-defaults (for picker-UI) */
    roleDefaults,
    loaded: state.loaded,
    can,
    reload,
  };
}
