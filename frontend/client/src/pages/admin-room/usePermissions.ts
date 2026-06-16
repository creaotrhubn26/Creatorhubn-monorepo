/**
 * usePermissions.ts
 *
 * React-hook for å gate UI på effective Lead Map-permissions for
 * innlogget bruker. Henter en gang per org-id-endring og leverer
 * en `can(key)` helper.
 *
 * Bruk:
 *   const { can, role } = usePermissions();
 *   {can('leads.delete') && <button>Slett</button>}
 */

import { useCallback, useEffect, useState } from 'react';

interface PermissionsState {
  role: string | null;
  permissions: Set<string>;
  organizationId: string | null;
  loaded: boolean;
}

function getActiveOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rr_lead_map_active_org');
}

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rr_bearer') ?? '';
}

export function usePermissions() {
  const [state, setState] = useState<PermissionsState>({
    role: null,
    permissions: new Set(),
    organizationId: null,
    loaded: false,
  });

  const reload = useCallback(async () => {
    const orgId = getActiveOrgId();
    const token = getAuthToken();
    if (!token) {
      setState({ role: null, permissions: new Set(), organizationId: null, loaded: true });
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
        setState({ role: null, permissions: new Set(), organizationId: orgId, loaded: true });
        return;
      }
      const j = await r.json();
      setState({
        role: j.role,
        permissions: new Set(j.permissions ?? []),
        organizationId: j.organization_id,
        loaded: true,
      });
    } catch {
      setState({ role: null, permissions: new Set(), organizationId: orgId, loaded: true });
    }
  }, []);

  useEffect(() => {
    void reload();
    // Reload når org-id endres i en annen tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rr_lead_map_active_org' || e.key === 'rr_bearer') void reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);

  const can = useCallback(
    (key: string): boolean => state.permissions.has(key),
    [state.permissions],
  );

  return {
    role: state.role,
    organizationId: state.organizationId,
    permissions: state.permissions,
    loaded: state.loaded,
    can,
    reload,
  };
}
