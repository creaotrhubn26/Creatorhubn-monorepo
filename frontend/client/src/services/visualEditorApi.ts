/**
 * API Service for Visual Editor Projects
 * Handles all API calls for saving/loading visual editor projects
 */

export interface ApiProject {
  id: string;
  name: string;
  description?: string;
  elements: unknown[];
  settings: unknown;
  metadata: {
    createdBy: string;
    createdAt: Date;
    lastModified: Date;
    version: number;
  };
  status: 'draft' | 'review' | 'published' | 'archived';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class VisualEditorApi {
  private baseUrl = '/api/visual-editor';

  async listProjects(userId?: string): Promise<ApiResponse<ApiProject[]>> {
    try {
      const url = userId ? `${this.baseUrl}/projects?userId=${userId}` : `${this.baseUrl}/projects`;
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getProject(id: string): Promise<ApiResponse<ApiProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${id}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async createProject(
    project: Omit<ApiProject, 'id' | 'metadata'>,
  ): Promise<ApiResponse<ApiProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          ...project,
          metadata: {
            createdBy: 'current-user', // TODO: Get from auth context
            createdAt: new Date(),
            lastModified: new Date(),
            version: 1,
          },
        }),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async updateProject(id: string, updates: Partial<ApiProject>): Promise<ApiResponse<ApiProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(updates),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async deleteProject(id: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${id}`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async duplicateProject(id: string): Promise<ApiResponse<ApiProject>> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${id}/duplicate`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async autoSaveProject(id: string, data: Partial<ApiProject>): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/projects/${id}/autosave`, {
        method: 'PATCH',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

export const visualEditorApi = new VisualEditorApi();
