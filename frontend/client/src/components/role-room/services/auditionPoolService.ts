export interface PoolAudition {
  id: string;
  title: string;
  description?: string;
  auditionType?: string;
  durationMinutes: number;
  location?: string;
  requirements: Record<string, unknown>;
  tags: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

import authSessionService from './authSessionService';

const API_BASE = '/api/casting';

// theroleroom.com autentiserer via Authorization: Bearer (ikke cookie), og
// pool-endepunktene er session-gated (requireUserSession). Uten auth-headere
// får ALLE kall 401 — nettopp derfor virket «lagre/importer til pool» ikke.
const getAuthHeaders = (): Record<string, string> =>
  authSessionService.getAuthHeadersSync() as Record<string, string>;

export const auditionPoolService = {
  async getPoolAuditions(): Promise<PoolAudition[]> {
    try {
      const response = await fetch(`${API_BASE}/audition-pool`, { headers: getAuthHeaders() });
      const data = await response.json();
      return data.success ? data.auditions : [];
    } catch (error) {
      console.error('Error fetching pool auditions:', error);
      return [];
    }
  },

  async saveToPool(audition: Partial<PoolAudition>): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/audition-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(audition),
      });
      const data = await response.json();
      return data.success ? data.auditionId : null;
    } catch (error) {
      console.error('Error saving audition to pool:', error);
      return null;
    }
  },

  async deleteFromPool(auditionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/audition-pool/${auditionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting audition from pool:', error);
      return false;
    }
  },

  async importToProject(poolAuditionId: string, targetProjectId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/audition-pool/import-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ poolAuditionId, targetProjectId }),
      });
      const data = await response.json();
      return data.success ? data.scheduleId : null;
    } catch (error) {
      console.error('Error importing audition to project:', error);
      return null;
    }
  },

  async saveScheduleToPool(scheduleId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/schedules/save-to-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ scheduleId }),
      });
      const data = await response.json();
      return data.success ? data.poolAuditionId : null;
    } catch (error) {
      console.error('Error saving schedule to pool:', error);
      return null;
    }
  },
};
