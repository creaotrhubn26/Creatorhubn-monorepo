const API_BASE = '/api/studio';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  return response.json();
}

export interface StudioScene {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  scene_data: Record<string, unknown>;
  thumbnail?: string;
  is_template?: boolean;
  category?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface StudioPreset {
  id: string;
  user_id?: string;
  name: string;
  type: string;
  preset_data: Record<string, unknown>;
  is_default?: boolean;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LightGroup {
  id: string;
  user_id?: string;
  scene_id?: string;
  name: string;
  lights: unknown[];
  settings: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface UserAsset {
  id: string;
  user_id?: string;
  asset_type: string;
  name: string;
  file_path?: string;
  asset_data: Record<string, unknown>;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface SceneVersion {
  id: string;
  scene_id: string;
  version_number: number;
  name?: string;
  scene_data: Record<string, unknown>;
  created_by?: string;
  created_at?: string;
}

export interface StudioNote {
  id: string;
  user_id?: string;
  project_id?: string;
  title: string;
  content?: string;
  category?: string;
  color?: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CameraPreset {
  id: string;
  user_id?: string;
  name: string;
  camera_data: Record<string, unknown>;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExportTemplate {
  id: string;
  user_id?: string;
  name: string;
  template_type: string;
  template_data: Record<string, unknown>;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const sceneApi = {
  getAll: async (userId?: string, isTemplate?: boolean): Promise<StudioScene[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (isTemplate !== undefined) params.append('is_template', String(isTemplate));
    const query = params.toString();
    const result = await apiRequest<{ scenes: StudioScene[] }>(`/scenes${query ? `?${query}` : ''}`);
    return result.scenes;
  },
  
  get: async (sceneId: string): Promise<StudioScene> => {
    const result = await apiRequest<{ scene: StudioScene }>(`/scenes/${sceneId}`);
    return result.scene;
  },
  
  save: async (scene: Partial<StudioScene>, userId?: string): Promise<StudioScene> => {
    const result = await apiRequest<{ scene: StudioScene }>('/scenes', {
      method: 'POST',
      body: JSON.stringify({ ...scene, userId }),
    });
    return result.scene;
  },
  
  delete: async (sceneId: string): Promise<boolean> => {
    await apiRequest(`/scenes/${sceneId}`, { method: 'DELETE' });
    return true;
  },
};

export const presetApi = {
  getAll: async (userId?: string, type?: string): Promise<StudioPreset[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (type) params.append('type', type);
    const query = params.toString();
    const result = await apiRequest<{ presets: StudioPreset[] }>(`/presets${query ? `?${query}` : ''}`);
    return result.presets;
  },
  
  save: async (preset: Partial<StudioPreset>, userId?: string): Promise<StudioPreset> => {
    const result = await apiRequest<{ preset: StudioPreset }>('/presets', {
      method: 'POST',
      body: JSON.stringify({ ...preset, userId }),
    });
    return result.preset;
  },
  
  delete: async (presetId: string): Promise<boolean> => {
    await apiRequest(`/presets/${presetId}`, { method: 'DELETE' });
    return true;
  },
};

export const lightGroupApi = {
  getAll: async (userId?: string, sceneId?: string): Promise<LightGroup[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (sceneId) params.append('scene_id', sceneId);
    const query = params.toString();
    const result = await apiRequest<{ lightGroups: LightGroup[] }>(`/light-groups${query ? `?${query}` : ''}`);
    return result.lightGroups;
  },
  
  save: async (group: Partial<LightGroup>, userId?: string): Promise<LightGroup> => {
    const result = await apiRequest<{ lightGroup: LightGroup }>('/light-groups', {
      method: 'POST',
      body: JSON.stringify({ ...group, userId }),
    });
    return result.lightGroup;
  },
  
  delete: async (groupId: string): Promise<boolean> => {
    await apiRequest(`/light-groups/${groupId}`, { method: 'DELETE' });
    return true;
  },
};

export const assetApi = {
  getAll: async (userId?: string, type?: string): Promise<UserAsset[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (type) params.append('type', type);
    const query = params.toString();
    const result = await apiRequest<{ assets: UserAsset[] }>(`/assets${query ? `?${query}` : ''}`);
    return result.assets;
  },
  
  save: async (asset: Partial<UserAsset>, userId?: string): Promise<UserAsset> => {
    const result = await apiRequest<{ asset: UserAsset }>('/assets', {
      method: 'POST',
      body: JSON.stringify({ ...asset, userId }),
    });
    return result.asset;
  },
  
  delete: async (assetId: string): Promise<boolean> => {
    await apiRequest(`/assets/${assetId}`, { method: 'DELETE' });
    return true;
  },
};

export const sceneVersionApi = {
  getAll: async (sceneId: string): Promise<SceneVersion[]> => {
    const result = await apiRequest<{ versions: SceneVersion[] }>(`/scenes/${sceneId}/versions`);
    return result.versions;
  },
  
  save: async (sceneId: string, version: Partial<SceneVersion>): Promise<SceneVersion> => {
    const result = await apiRequest<{ version: SceneVersion }>(`/scenes/${sceneId}/versions`, {
      method: 'POST',
      body: JSON.stringify(version),
    });
    return result.version;
  },
  
  delete: async (versionId: string): Promise<boolean> => {
    await apiRequest(`/versions/${versionId}`, { method: 'DELETE' });
    return true;
  },
};

export const noteApi = {
  getAll: async (userId?: string, projectId?: string): Promise<StudioNote[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (projectId) params.append('project_id', projectId);
    const query = params.toString();
    const result = await apiRequest<{ notes: StudioNote[] }>(`/notes${query ? `?${query}` : ''}`);
    return result.notes;
  },
  
  save: async (note: Partial<StudioNote>, userId?: string): Promise<StudioNote> => {
    const result = await apiRequest<{ note: StudioNote }>('/notes', {
      method: 'POST',
      body: JSON.stringify({ ...note, userId }),
    });
    return result.note;
  },
  
  delete: async (noteId: string): Promise<boolean> => {
    await apiRequest(`/notes/${noteId}`, { method: 'DELETE' });
    return true;
  },
};

export const cameraPresetApi = {
  getAll: async (userId?: string): Promise<CameraPreset[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    const query = params.toString();
    const result = await apiRequest<{ cameraPresets: CameraPreset[] }>(`/camera-presets${query ? `?${query}` : ''}`);
    return result.cameraPresets;
  },
  
  save: async (preset: Partial<CameraPreset>, userId?: string): Promise<CameraPreset> => {
    const result = await apiRequest<{ cameraPreset: CameraPreset }>('/camera-presets', {
      method: 'POST',
      body: JSON.stringify({ ...preset, userId }),
    });
    return result.cameraPreset;
  },
  
  delete: async (presetId: string): Promise<boolean> => {
    await apiRequest(`/camera-presets/${presetId}`, { method: 'DELETE' });
    return true;
  },
};

export const exportTemplateApi = {
  getAll: async (userId?: string, type?: string): Promise<ExportTemplate[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (type) params.append('type', type);
    const query = params.toString();
    const result = await apiRequest<{ exportTemplates: ExportTemplate[] }>(`/export-templates${query ? `?${query}` : ''}`);
    return result.exportTemplates;
  },
  
  save: async (template: Partial<ExportTemplate>, userId?: string): Promise<ExportTemplate> => {
    const result = await apiRequest<{ exportTemplate: ExportTemplate }>('/export-templates', {
      method: 'POST',
      body: JSON.stringify({ ...template, userId }),
    });
    return result.exportTemplate;
  },
  
  delete: async (templateId: string): Promise<boolean> => {
    await apiRequest(`/export-templates/${templateId}`, { method: 'DELETE' });
    return true;
  },
};

export const virtualStudioApi = {
  scenes: sceneApi,
  presets: presetApi,
  lightGroups: lightGroupApi,
  assets: assetApi,
  versions: sceneVersionApi,
  notes: noteApi,
  cameraPresets: cameraPresetApi,
  exportTemplates: exportTemplateApi,
};

export default virtualStudioApi;
