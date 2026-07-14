/**
 * Project-scoped tab-konfig: produksjonsteam-leder styrer hvilke faner
 * hver rolle / hver bruker ser på sitt prosjekt.
 */

export type TabConfigTargetType = 'role' | 'user';

/** Nivå-kart: fane-nøkkel → 'view' | 'manage'. Fane som mangler = Skjult. */
export type TabAccessLevelMap = Record<string, 'view' | 'manage'>;

export interface ProjectTabOverride {
  targetType: TabConfigTargetType;
  targetValue: string;
  tabValues: string[];
  tabAccess: TabAccessLevelMap;
  updatedAt: string;
}

export interface ProjectTabMember {
  userId: string;
  role: string | null;
  email: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
}

export interface ProjectTabConfigResponse {
  projectId: string;
  overrides: ProjectTabOverride[];
  members: ProjectTabMember[];
  validTabValues: string[];
}

export interface MyTabsResponse {
  tabValues: string[] | null;
  /** Nivå-kart når det finnes en overstyring; null → bruk rollens preset. */
  tabAccess: TabAccessLevelMap | null;
  source: 'user' | 'role' | 'default';
  role: string | null;
}

export interface SeatStatusResponse {
  projectId: string;
  ownerUserId: string;
  isViewerLeader: boolean;
  hasActiveSubscription: boolean;
  persona: 'production_team' | 'content_producer' | null;
  includedSeats: number;
  usedSeats: number;
  extraSeats: number;
  seatPriceExVat: number;
  extraCostPerMonth: number;
  nextSeatNeedsBilling: boolean;
  nextSeatCost: number;
  subscriptionHealth?: {
    status: 'active' | 'trialing' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'canceled' | 'paused' | 'unpaid' | 'none';
    canMutateSeats: boolean;
    shouldRevokeAccess: boolean;
    message: string;
  };
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${url}: ${res.status} ${detail || res.statusText}`.trim());
  }
  return (await res.json()) as T;
}

export const roleRoomProjectTabConfigService = {
  async getConfig(projectId: string): Promise<ProjectTabConfigResponse> {
    return jsonRequest(`/api/role-room/projects/${encodeURIComponent(projectId)}/tab-config`, { method: 'GET' });
  },

  /**
   * Sett en overstyring. Ny studio-dialog sender et nivå-kart (`tabAccess`);
   * det gamle dashbordet kan fortsatt sende `tabValues` (synlighet = full
   * tilgang) via `setVisibilityOverride`.
   */
  async setOverride(
    projectId: string,
    targetType: TabConfigTargetType,
    targetValue: string,
    tabAccess: TabAccessLevelMap,
  ): Promise<{ ok: boolean }> {
    return jsonRequest(`/api/role-room/projects/${encodeURIComponent(projectId)}/tab-config`, {
      method: 'PUT',
      body: JSON.stringify({ targetType, targetValue, tabAccess }),
    });
  },

  /** Bakover-kompat: kun synlighet (behandles som full tilgang på backend). */
  async setVisibilityOverride(
    projectId: string,
    targetType: TabConfigTargetType,
    targetValue: string,
    tabValues: string[],
  ): Promise<{ ok: boolean }> {
    return jsonRequest(`/api/role-room/projects/${encodeURIComponent(projectId)}/tab-config`, {
      method: 'PUT',
      body: JSON.stringify({ targetType, targetValue, tabValues }),
    });
  },

  async clearOverride(
    projectId: string,
    targetType: TabConfigTargetType,
    targetValue: string,
  ): Promise<{ ok: boolean }> {
    return jsonRequest(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/tab-config/${targetType}/${encodeURIComponent(targetValue)}`,
      { method: 'DELETE' },
    );
  },

  async getMyTabs(projectId: string): Promise<MyTabsResponse> {
    return jsonRequest(`/api/role-room/projects/${encodeURIComponent(projectId)}/my-tabs`, { method: 'GET' });
  },

  async getSeatStatus(projectId: string): Promise<SeatStatusResponse> {
    return jsonRequest(`/api/role-room/projects/${encodeURIComponent(projectId)}/seat-status`, { method: 'GET' });
  },

  async upgradeSeat(projectId: string, targetQuantity?: number): Promise<{
    ok: boolean;
    previousQuantity: number;
    newQuantity: number;
    seatsAdded: number;
    estimatedExtraCostPerMonthMajor: number;
    currency: string;
  }> {
    return jsonRequest(
      `/api/role-room/projects/${encodeURIComponent(projectId)}/seats/upgrade`,
      {
        method: 'POST',
        body: JSON.stringify(targetQuantity != null ? { targetQuantity } : {}),
      },
    );
  },
};
