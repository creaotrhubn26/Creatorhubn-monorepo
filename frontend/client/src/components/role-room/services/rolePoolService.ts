export interface PoolRole {
  id: string;
  name: string;
  description?: string;
  roleType?: string;
  requirements: Record<string, unknown>;
  tags: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PoolImportOptions {
  initialStatus?: 'draft' | 'open' | 'casting' | 'filled' | 'cancelled';
  castingWindow?: {
    start?: string;
    end?: string;
  };
  auditNote?: string;
}

import authSessionService from './authSessionService';

const API_BASE = '/api/casting';

// Pool-endepunktene er session-gated (requireUserSession) og theroleroom.com
// autentiserer via Bearer-header — uten dette får kallene 401.
const getAuthHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export const rolePoolService = {
  async getPoolRoles(): Promise<PoolRole[]> {
    try {
      const response = await fetch(`${API_BASE}/role-pool`, { headers: getAuthHeaders() });
      const data = await response.json();
      return data.success ? data.roles : [];
    } catch (error) {
      console.error('Error fetching pool roles:', error);
      return [];
    }
  },

  async saveToPool(role: Partial<PoolRole>): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/role-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(role),
      });
      const data = await response.json();
      return data.success ? data.roleId : null;
    } catch (error) {
      console.error('Error saving role to pool:', error);
      return null;
    }
  },

  async deleteFromPool(roleId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/role-pool/${roleId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting role from pool:', error);
      return false;
    }
  },

  async importToProject(
    poolRoleId: string,
    targetProjectId: string,
    options?: PoolImportOptions,
  ): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/role-pool/import-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ poolRoleId, targetProjectId, options }),
      });
      const data = await response.json();
      return data.success ? data.roleId : null;
    } catch (error) {
      console.error('Error importing role to project:', error);
      return null;
    }
  },

  async saveRoleToPool(roleId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/roles/save-to-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ roleId }),
      });
      const data = await response.json();
      return data.success ? data.poolRoleId : null;
    } catch (error) {
      console.error('Error saving role to pool:', error);
      return null;
    }
  },
};
