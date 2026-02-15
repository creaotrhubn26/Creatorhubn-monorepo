export interface PoolCandidate {
  id: string;
  name: string;
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
  };
  photos: string[];
  videos: string[];
  modelUrl?: string;
  personality?: string;
  notes?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

const API_BASE = '/api/casting';

export const candidatePoolService = {
  async getPoolCandidates(): Promise<PoolCandidate[]> {
    try {
      const response = await fetch(`${API_BASE}/candidate-pool`);
      const data = await response.json();
      return data.success ? data.candidates : [];
    } catch (error) {
      console.error('Error fetching pool candidates:', error);
      return [];
    }
  },

  async saveToPool(candidate: Partial<PoolCandidate>): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/candidate-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
      const data = await response.json();
      return data.success ? data.candidateId : null;
    } catch (error) {
      console.error('Error saving to pool:', error);
      return null;
    }
  },

  async deleteFromPool(candidateId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/candidate-pool/${candidateId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting from pool:', error);
      return false;
    }
  },

  async importToProject(poolCandidateId: string, targetProjectId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/candidate-pool/import-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolCandidateId, targetProjectId }),
      });
      const data = await response.json();
      return data.success ? data.candidateId : null;
    } catch (error) {
      console.error('Error importing to project:', error);
      return null;
    }
  },

  async copyToProject(candidateId: string, targetProjectId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/candidates/copy-to-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, targetProjectId }),
      });
      const data = await response.json();
      return data.success ? data.candidateId : null;
    } catch (error) {
      console.error('Error copying to project:', error);
      return null;
    }
  },

  async saveCandidateToPool(candidateId: string): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE}/candidates/save-to-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      });
      const data = await response.json();
      return data.success ? data.poolCandidateId : null;
    } catch (error) {
      console.error('Error saving candidate to pool:', error);
      return null;
    }
  },
};
