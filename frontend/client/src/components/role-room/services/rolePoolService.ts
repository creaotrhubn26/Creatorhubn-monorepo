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

const API_BASE = '/api/casting';

export const rolePoolService = {
  async getPoolRoles(): Promise<PoolRole[]> {
    try {
      const response = await fetch(`${API_BASE}/role-pool`);
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
        headers: { 'Content-Type': 'application/json' },
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
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting role from pool:', error);
      return false;
    }
  },

  async importToProject(poolRoleId: string, targetProjectId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/role-pool/import-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolRoleId, targetProjectId }),
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
        headers: { 'Content-Type': 'application/json' },
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
