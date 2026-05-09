/**
 * useRoleNavConfig — admin-konfigurerbar tab-rekkefølge per brukerrolle.
 *
 * Backend: GET/PUT/DELETE /api/admin-room/role-nav-config[/:role]
 *
 * Modell:
 *   - GET returnerer alle eksisterende konfigurasjoner som en liste.
 *   - PUT lagrer ordnet liste av subTab-verdier for én rolle.
 *   - DELETE tilbakestiller en rolle til hardcoded defaults.
 *
 * Hooks i denne filen:
 *   - useRoleNavConfigs(): fetcher alle konfig-rader, returnerer Map<role, tabValues>.
 *   - useUpdateRoleNavConfig(): mutation som lagrer én rolles konfig.
 *   - useDeleteRoleNavConfig(): mutation som sletter (tilbakestiller).
 *   - useEffectiveTabsForRole(role): returnerer den faktiske ordnede listen
 *     som rolen skal se — server-config med fallback til hardcoded defaults.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UserRoleType } from '../models/casting';

const QUERY_KEY = ['/api/admin-room/role-nav-config'] as const;

export type SubTabValue =
  | 'roles'
  | 'candidates'
  | 'crew'
  | 'schedule'
  | 'publishing'
  | 'carousel'
  | 'approval'
  | 'brief'
  | 'planner'
  | 'shooting'
  | 'shotlist'
  | 'mannskap'
  | 'agent'
  | 'admin-room';

export interface RoleNavConfigEntry {
  role: UserRoleType;
  tabValues: SubTabValue[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Hardcoded fallback. Brukes hvis ingen rad finnes for rolen i databasen.
 * Disse mirrors RoleRoomBottomNav.bottomNavConfigForRole men inneholder hele
 * ordnede listen — telefon tar 4 første som primære + Mer.
 */
export const DEFAULT_TABS_BY_ROLE: Record<UserRoleType, SubTabValue[]> = {
  director: [
    'roles', 'candidates', 'schedule', 'brief',
    'crew', 'approval', 'shooting', 'shotlist', 'planner', 'agent',
  ],
  casting_director: [
    'roles', 'candidates', 'schedule', 'brief',
    'approval', 'crew', 'planner', 'agent',
  ],
  producer: [
    'roles', 'schedule', 'crew', 'approval',
    'candidates', 'brief', 'planner', 'shooting', 'shotlist', 'mannskap', 'agent',
  ],
  production_manager: [
    'roles', 'schedule', 'crew', 'approval',
    'candidates', 'shooting', 'shotlist', 'mannskap', 'planner',
  ],
  camera_team: [
    'shooting', 'shotlist', 'schedule', 'crew',
    'mannskap', 'roles',
  ],
  content_producer: [
    'candidates', 'brief', 'planner', 'approval',
    'roles', 'carousel', 'publishing', 'schedule', 'agent',
  ],
  client_reviewer: [
    'approval', 'brief', 'roles', 'schedule',
    'candidates',
  ],
  agency: [
    'approval', 'brief', 'roles', 'schedule',
    'candidates', 'planner',
  ],
  writer: [
    'brief', 'roles', 'candidates', 'agent',
    'planner',
  ],
  script_editor: [
    'brief', 'roles', 'candidates', 'agent',
    'planner',
  ],
  reader: [
    'brief', 'roles', 'candidates', 'agent',
  ],
};

export const ALL_USER_ROLES: UserRoleType[] = [
  'director',
  'producer',
  'casting_director',
  'production_manager',
  'camera_team',
  'content_producer',
  'client_reviewer',
  'agency',
  'writer',
  'script_editor',
  'reader',
];

export const USER_ROLE_LABELS: Record<UserRoleType, string> = {
  director: 'Regissør',
  producer: 'Produsent',
  casting_director: 'Casting-ansvarlig',
  production_manager: 'Produksjonsleder',
  camera_team: 'Kameraavd.',
  content_producer: 'Innholdsprodusent',
  client_reviewer: 'Klient (anmelder)',
  agency: 'Byrå',
  writer: 'Manusforfatter',
  script_editor: 'Manusredaktør',
  reader: 'Leser',
};

async function fetchRoleNavConfigs(): Promise<RoleNavConfigEntry[]> {
  const res = await fetch('/api/admin-room/role-nav-config', { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return [];
    throw new Error(`Kunne ikke hente rolle-nav-konfig (${res.status})`);
  }
  const json = await res.json();
  return (json.configs ?? []) as RoleNavConfigEntry[];
}

async function putRoleNavConfig(role: UserRoleType, tabValues: SubTabValue[]): Promise<RoleNavConfigEntry> {
  const res = await fetch(`/api/admin-room/role-nav-config/${encodeURIComponent(role)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabValues }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kunne ikke lagre rolle-nav-konfig (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.config as RoleNavConfigEntry;
}

async function deleteRoleNavConfig(role: UserRoleType): Promise<void> {
  const res = await fetch(`/api/admin-room/role-nav-config/${encodeURIComponent(role)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kunne ikke slette rolle-nav-konfig (${res.status}): ${text}`);
  }
}

export function useRoleNavConfigs() {
  return useQuery<RoleNavConfigEntry[]>({
    queryKey: QUERY_KEY,
    queryFn: fetchRoleNavConfigs,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateRoleNavConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ role, tabValues }: { role: UserRoleType; tabValues: SubTabValue[] }) =>
      putRoleNavConfig(role, tabValues),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteRoleNavConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: UserRoleType) => deleteRoleNavConfig(role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

/**
 * Hovedhook for nav-rendering: returnerer listen som rolen skal se.
 * Server-overstyring først, så hardcoded default. Aldri tom — alltid noe
 * å vise selv om rolen er ukjent.
 */
export function useEffectiveTabsForRole(role: UserRoleType | null | undefined): SubTabValue[] {
  const { data: configs } = useRoleNavConfigs();
  return useMemo(() => {
    if (role && configs) {
      const found = configs.find((c) => c.role === role);
      if (found && found.tabValues.length > 0) return found.tabValues;
    }
    if (role && DEFAULT_TABS_BY_ROLE[role]) {
      return DEFAULT_TABS_BY_ROLE[role];
    }
    // Ukjent eller manglende rolle: vis defaults for produsent (vid scope)
    return DEFAULT_TABS_BY_ROLE.producer;
  }, [configs, role]);
}
