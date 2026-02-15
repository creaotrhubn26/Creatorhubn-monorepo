import { SceneComposition, EnvironmentState, WallState, FloorState, AtmosphereSettings, GoboState } from '../models/sceneComposer';
import { sceneApi } from './virtualStudioApiService';
import settingsService, { getCurrentUserId } from './settingsService';

const SCENES_NAMESPACE = 'virtualStudio_sceneCompositions';
const TEMPLATES_NAMESPACE = 'virtualStudio_sceneTemplates';

const templatesCache: SceneComposition[] = [];

const setTemplatesCache = (templates: SceneComposition[]) => {
  templatesCache.splice(0, templatesCache.length, ...templates);
};

const hydrateScenesFromSettings = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const remote = await settingsService.getSetting<SceneComposition[]>(SCENES_NAMESPACE, { userId });
    if (remote) {
      remote.forEach(scene => sceneCache.set(scene.id, scene));
      return;
    }
  } catch {
    // Ignore hydration errors
  }
};

const hydrateTemplatesFromSettings = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const remote = await settingsService.getSetting<SceneComposition[]>(TEMPLATES_NAMESPACE, { userId });
    if (remote) {
      setTemplatesCache(remote);
      return;
    }
  } catch {
    // Ignore hydration errors
  }
};

void hydrateScenesFromSettings();
void hydrateTemplatesFromSettings();

// Simple in-memory cache for scenes
const sceneCache = new Map<string, SceneComposition>();

export const sceneComposerService = {
  /**
  * Get all saved scenes from database (with settings cache fallback)
   */
  async getAllScenesAsync(): Promise<SceneComposition[]> {
    try {
      const dbScenes = await sceneApi.getAll();
      if (dbScenes.length > 0) {
        const scenes: SceneComposition[] = dbScenes.map(s => ({
          ...s.scene_data as Partial<SceneComposition>,
          id: s.id,
          name: s.name,
          description: s.description,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        } as SceneComposition));
        scenes.forEach(scene => sceneCache.set(scene.id, scene));
        return scenes;
      }
    } catch (error) {
      console.warn('Database unavailable, falling back to settings cache:', error);
    }
    try {
      const userId = getCurrentUserId();
      const cached = await settingsService.getSetting<SceneComposition[]>(SCENES_NAMESPACE, { userId });
      if (cached) {
        cached.forEach(scene => sceneCache.set(scene.id, scene));
        return cached;
      }
    } catch {
      // Ignore cache errors
    }
    return this.getAllScenes();
  },

  getAllScenes(): SceneComposition[] {
    return Array.from(sceneCache.values());
  },

  /**
  * Save a scene to database and settings cache
   */
  async saveSceneAsync(scene: SceneComposition, incremental: boolean = true): Promise<void> {
    const cached = sceneCache.get(scene.id);
    if (incremental && cached) {
      const cachedJson = JSON.stringify(cached);
      const newJson = JSON.stringify(scene);
      if (cachedJson === newJson) return;
    }

    const updatedScene = { ...scene, updatedAt: new Date().toISOString() };

    try {
      await sceneApi.save({
        id: updatedScene.id,
        name: updatedScene.name,
        description: updatedScene.description,
        scene_data: updatedScene,
      });
    } catch (error) {
      console.warn('Database save failed, using settings cache:', error);
    }

    this.saveScene(updatedScene, false);
  },

  saveScene(scene: SceneComposition, incremental: boolean = true): void {
    try {
      const cached = sceneCache.get(scene.id);

      if (incremental && cached) {
        const cachedJson = JSON.stringify(cached);
        const newJson = JSON.stringify(scene);
        if (cachedJson === newJson) {
          return;
        }
      }

      const scenes = this.getAllScenes();
      const existingIndex = scenes.findIndex(s => s.id === scene.id);

      const updatedScene = { ...scene, updatedAt: new Date().toISOString() };

      if (existingIndex >= 0) {
        scenes[existingIndex] = updatedScene;
      } else {
        scenes.push(updatedScene);
      }

      sceneCache.set(updatedScene.id, updatedScene);
      void settingsService.setSetting(SCENES_NAMESPACE, scenes, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Error saving scene to settings cache:', error);
      throw error;
    }
  },

  /**
  * Load a scene by ID from database or settings cache
   */
  async loadSceneAsync(id: string): Promise<SceneComposition | null> {
    try {
      const dbScene = await sceneApi.get(id);
      if (dbScene) {
        return {
          ...dbScene.scene_data as Partial<SceneComposition>,
          id: dbScene.id,
          name: dbScene.name,
          description: dbScene.description,
          createdAt: dbScene.created_at,
          updatedAt: dbScene.updated_at,
        } as SceneComposition;
      }
    } catch (error) {
      console.warn('Database load failed, using settings cache:', error);
    }
    return this.loadScene(id);
  },

  loadScene(id: string): SceneComposition | null {
    try {
      const scenes = this.getAllScenes();
      return scenes.find(s => s.id === id) || null;
    } catch (error) {
      console.error('Error loading scene from cache:', error);
      return null;
    }
  },

  /**
  * Delete a scene by ID from database and settings cache
   */
  async deleteSceneAsync(id: string): Promise<void> {
    try {
      await sceneApi.delete(id);
    } catch (error) {
      console.warn('Database delete failed:', error);
    }
    this.deleteScene(id);
  },

  deleteScene(id: string): void {
    try {
      const scenes = this.getAllScenes().filter(s => s.id !== id);
      sceneCache.delete(id);
      void settingsService.setSetting(SCENES_NAMESPACE, scenes, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Error deleting scene from cache:', error);
      throw error;
    }
  },

  /**
   * Export a scene as JSON string
   */
  exportScene(scene: SceneComposition): string {
    try {
      return JSON.stringify(scene, null, 2);
    } catch (error) {
      console.error('Error exporting scene:', error);
      throw error;
    }
  },

  /**
   * Import a scene from JSON string
   */
  importScene(json: string): SceneComposition {
    try {
      const scene = JSON.parse(json) as SceneComposition;
      
      // Validate scene structure
      if (!scene.id || !scene.name) {
        throw new Error('Invalid scene format: missing id or name');
      }
      
      // Generate new ID and timestamps to avoid conflicts
      scene.id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      scene.createdAt = new Date().toISOString();
      scene.updatedAt = new Date().toISOString();
      
      return scene;
    } catch (error) {
      console.error('Error importing scene:', error);
      throw error;
    }
  },

  /**
   * Download scene as JSON file
   */
  downloadScene(scene: SceneComposition): void {
    try {
      const json = this.exportScene(scene);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scene.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading scene:', error);
      throw error;
    }
  },

  /**
   * Import scene from file input
   */
  async importSceneFromFile(file: File): Promise<SceneComposition> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const scene = this.importScene(json);
          resolve(scene);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  /**
   * Generate a unique scene ID
   */
  generateSceneId(): string {
    return `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Toggle favorite status
   */
  toggleFavorite(id: string): void {
    const scenes = this.getAllScenes();
    const scene = scenes.find(s => s.id === id);
    if (scene) {
      scene.isFavorite = !scene.isFavorite;
      this.saveScene(scene);
    }
  },

  /**
   * Get favorite scenes
   */
  getFavoriteScenes(): SceneComposition[] {
    return this.getAllScenes().filter(s => s.isFavorite);
  },

  /**
   * Calculate scene size in bytes
   */
  calculateSceneSize(scene: SceneComposition): number {
    return new Blob([JSON.stringify(scene)]).size;
  },

  /**
   * Sort scenes
   */
  sortScenes(scenes: SceneComposition[], sortBy: 'name' | 'createdAt' | 'updatedAt' | 'size'): SceneComposition[] {
    const sorted = [...scenes];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'createdAt':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'updatedAt':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'size':
          const sizeA = a.size || this.calculateSceneSize(a);
          const sizeB = b.size || this.calculateSceneSize(b);
          return sizeB - sizeA;
        default:
          return 0;
      }
    });
    return sorted;
  },

  /**
   * Filter scenes
   */
  filterScenes(
    scenes: SceneComposition[],
    filters: {
      tags?: string[];
      minCameras?: number;
      minLights?: number;
      dateFrom?: Date;
      dateTo?: Date;
      favoritesOnly?: boolean;
      searchQuery?: string;
    }
  ): SceneComposition[] {
    return scenes.filter(scene => {
      if (filters.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(tag => scene.tags.includes(tag));
        if (!hasTag) return false;
      }
      if (filters.minCameras !== undefined && scene.cameras.length < filters.minCameras) {
        return false;
      }
      if (filters.minLights !== undefined && scene.lights.length < filters.minLights) {
        return false;
      }
      if (filters.dateFrom) {
        const sceneDate = new Date(scene.updatedAt);
        if (sceneDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const sceneDate = new Date(scene.updatedAt);
        if (sceneDate > filters.dateTo) return false;
      }
      if (filters.favoritesOnly && !scene.isFavorite) {
        return false;
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = scene.name.toLowerCase().includes(query);
        const matchesDescription = scene.description?.toLowerCase().includes(query);
        const matchesTags = scene.tags.some(tag => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesDescription && !matchesTags) return false;
      }
      return true;
    });
  },

  /**
   * Duplicate scene
   */
  duplicateScene(id: string): SceneComposition | null {
    const scene = this.loadScene(id);
    if (!scene) return null;
    
    const duplicated: SceneComposition = {
      ...scene,
      id: this.generateSceneId(),
      name: `${scene.name} (Kopi)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false,
    };
    
    this.saveScene(duplicated);
    return duplicated;
  },

  /**
   * Move scene to trash (soft delete)
   */
  moveToTrash(id: string): void {
    const scene = this.loadScene(id);
    if (scene) {
      scene.deletedAt = new Date().toISOString();
      this.saveScene(scene);
    }
  },

  /**
   * Restore scene from trash
   */
  restoreFromTrash(id: string): void {
    const scene = this.loadScene(id);
    if (scene) {
      scene.deletedAt = undefined;
      this.saveScene(scene);
    }
  },

  /**
   * Get scenes in trash
   */
  getTrashedScenes(): SceneComposition[] {
    return this.getAllScenes().filter(s => s.deletedAt);
  },

  /**
   * Permanently delete scene
   */
  permanentlyDelete(id: string): void {
    this.deleteScene(id);
  },

  /**
   * Merge two scenes
   */
  mergeScenes(scene1Id: string, scene2Id: string, newName: string): SceneComposition | null {
    const scene1 = this.loadScene(scene1Id);
    const scene2 = this.loadScene(scene2Id);
    if (!scene1 || !scene2) return null;

    const merged: SceneComposition = {
      id: this.generateSceneId(),
      name: newName,
      description: `${scene1.name} + ${scene2.name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cameras: [...scene1.cameras, ...scene2.cameras.filter(c2 => !scene1.cameras.some(c1 => c1.id === c2.id))],
      lights: [...scene1.lights, ...scene2.lights.filter(l2 => !scene1.lights.some(l1 => l1.id === l2.id))],
      actors: [...scene1.actors, ...scene2.actors.filter(a2 => !scene1.actors.some(a1 => a1.id === a2.id))],
      props: [...scene1.props, ...scene2.props.filter(p2 => !scene1.props.some(p1 => p1.id === p2.id))],
      cameraSettings: scene1.cameraSettings, // Use first scene's settings
      layers: [...scene1.layers, ...scene2.layers.filter(l2 => !scene1.layers.some(l1 => l1.id === l2.id))],
      timeline: scene1.timeline || scene2.timeline,
      tags: [...new Set([...scene1.tags, ...scene2.tags])],
      isFavorite: scene1.isFavorite || scene2.isFavorite,
    };

    this.saveScene(merged);
    return merged;
  },

  /**
   * Save scene as template
   */
  saveAsTemplate(sceneId: string, templateName: string): void {
    const scene = this.loadScene(sceneId);
    if (!scene) return;

    const templates = this.getTemplates();
    const template = {
      ...scene,
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: templateName,
      isTemplate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    templates.push(template);
    setTemplatesCache(templates);
    void settingsService.setSetting(TEMPLATES_NAMESPACE, templates, { userId: getCurrentUserId() });
  },

  /**
   * Get all templates
   */
  getTemplates(): SceneComposition[] {
    return [...templatesCache];
  },

  /**
   * Create scene from template
   */
  createFromTemplate(templateId: string, name: string): SceneComposition | null {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return null;

    const { ...templateData } = template;
    const scene: SceneComposition = {
      ...templateData,
      id: this.generateSceneId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveScene(scene);
    return scene;
  },

  /**
   * Export scene as shareable link (base64 encoded)
   */
  exportAsShareableLink(scene: SceneComposition): string {
    const json = this.exportScene(scene);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return `${window.location.origin}${window.location.pathname}?scene=${encoded}`;
  },

  /**
   * Import scene from shareable link
   */
  importFromShareableLink(encoded: string): SceneComposition | null {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      return this.importScene(json);
    } catch {
      return null;
    }
  },

  /**
   * Backup scenes to file
   */
  backupScenes(): void {
    const scenes = this.getAllScenes();
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      scenes,
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Restore scenes from backup file
   */
  async restoreFromBackup(file: File): Promise<{ restored: number; errors: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backup = JSON.parse(e.target?.result as string);
          if (!backup.scenes || !Array.isArray(backup.scenes)) {
            reject(new Error('Invalid backup format'));
            return;
          }

          let restored = 0;
          let errors = 0;

          backup.scenes.forEach((scene: SceneComposition) => {
            try {
              // Generate new IDs to avoid conflicts
              scene.id = this.generateSceneId();
              scene.createdAt = scene.createdAt || new Date().toISOString();
              scene.updatedAt = scene.updatedAt || new Date().toISOString();
              this.saveScene(scene);
              restored++;
            } catch {
              errors++;
            }
          });

          resolve({ restored, errors });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  /**
   * Capture current environment state from scene
   */
  captureEnvironmentState(): EnvironmentState {
    const walls: WallState[] = [];
    const floors: FloorState[] = [];
    
    // Hent alle vegger fra Babylon.js scene
    const scene = (window as unknown as { virtualStudio?: { scene?: { meshes: unknown[]; clearColor?: { toHexString(): string }; ambientColor?: { toHexString(): string } } } }).virtualStudio?.scene;
    if (!scene) return { walls: [], floors: [] };
    
    scene.meshes.forEach((mesh: any) => {
      if (mesh.metadata?.type === 'wall' || mesh.metadata?.type === 'environment_wall') {
        walls.push({
          id: mesh.id,
          assetId: mesh.metadata.assetId || mesh.metadata.materialId || 'unknown',
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          scale: [mesh.scaling.x, mesh.scaling.y, mesh.scaling.z],
          materialOverrides: mesh.metadata.materialOverrides,
        });
      }
      if (mesh.metadata?.type === 'floor' || mesh.metadata?.type === 'environment_floor') {
        floors.push({
          id: mesh.id,
          assetId: mesh.metadata.assetId || mesh.metadata.materialId || 'unknown',
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          dimensions: mesh.metadata.dimensions || { width: 20, height: 20 },
          materialOverrides: mesh.metadata.materialOverrides,
        });
      }
    });
    
    // Capture atmosphere
    const atmosphere: AtmosphereSettings = {
      fogEnabled: scene.fogMode !== 0,
      fogDensity: scene.fogDensity || 0,
      fogColor: scene.fogColor?.toHexString() || '#000000',
      clearColor: scene.clearColor?.toHexString() || '#1a1a1a',
      ambientColor: scene.ambientColor?.toHexString() || '#333333',
      ambientIntensity: 0.5,
    };
    
    return { walls, floors, atmosphere };
  },

  /**
   * Restore environment from saved state
   */
  restoreEnvironment(environment: EnvironmentState): void {
    const environmentService = (window as unknown as { environmentService?: { clearEnvironment?: () => void } }).environmentService;
    if (!environmentService) {
      // Fallback: dispatch events directly
      // Restore walls
      environment.walls.forEach(wall => {
        window.dispatchEvent(new CustomEvent('ch-add-environment-wall', {
          detail: {
            assetId: wall.assetId,
            position: wall.position,
            options: {
              materialOverrides: wall.materialOverrides,
            }
          }
        }));
      });
      
      // Restore floors
      environment.floors.forEach(floor => {
        window.dispatchEvent(new CustomEvent('ch-add-environment-floor', {
          detail: {
            assetId: floor.assetId,
            options: {
              materialOverrides: floor.materialOverrides,
            }
          }
        }));
      });
      
      // Restore atmosphere
      if (environment.atmosphere) {
        window.dispatchEvent(new CustomEvent('ch-apply-atmosphere', {
          detail: environment.atmosphere
        }));
      }
      return;
    }
    
    // Clear existing environment
    environmentService.clearEnvironment?.();
    
    // Restore walls
    environment.walls.forEach(wall => {
      window.dispatchEvent(new CustomEvent('ch-add-environment-wall', {
        detail: {
          assetId: wall.assetId,
          position: wall.position,
          options: {
            materialOverrides: wall.materialOverrides,
          }
        }
      }));
    });
    
    // Restore floors
    environment.floors.forEach(floor => {
      window.dispatchEvent(new CustomEvent('ch-add-environment-floor', {
        detail: {
          assetId: floor.assetId,
          options: {
            materialOverrides: floor.materialOverrides,
          }
        }
      }));
    });
    
    // Restore atmosphere
    if (environment.atmosphere) {
      window.dispatchEvent(new CustomEvent('ch-apply-atmosphere', {
        detail: environment.atmosphere
      }));
    }
  },

  /**
   * Capture gobo state from scene
   */
  captureGoboState(): GoboState[] {
    const gobos: GoboState[] = [];
    
    // Get gobo service
    const goboService = (window as unknown as { goboService?: { getAllAttachments(): unknown[]; getStandaloneGobos?(): unknown[] } }).goboService;
    if (!goboService) return gobos;
    
    // Capture attached gobos
    const attachments = goboService.getAllAttachments() as Array<{
      lightId: string;
      goboId: string;
      options: { pattern: string; size: number; rotation: number; intensity: number };
    }>;
    attachments.forEach((attachment) => {
      gobos.push({
        id: `gobo_${attachment.lightId}_${Date.now()}`,
        goboId: attachment.goboId,
        pattern: attachment.options.pattern,
        attachedToLightId: attachment.lightId,
        options: {
          size: attachment.options.size,
          rotation: attachment.options.rotation,
          intensity: attachment.options.intensity,
        },
      });
    });
    
    // Capture standalone gobos
    const standaloneGobos = goboService.getAllStandaloneGobos() as Map<string, any>;
    standaloneGobos.forEach((mesh: any, goboId: string) => {
      const metadata = mesh.metadata;
      if (metadata?.type === 'gobo') {
        gobos.push({
          id: goboId,
          goboId: metadata.goboId || 'unknown',
          pattern: metadata.options?.pattern || 'window',
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          options: {
            size: metadata.options?.size || 1.0,
            rotation: metadata.options?.rotation || 0,
            intensity: metadata.options?.intensity || 1.0,
          },
        });
      }
    });
    
    return gobos;
  },

  /**
   * Restore gobos from saved state
   */
  restoreGobos(gobos: GoboState[]): void {
    if (!gobos || gobos.length === 0) return;
    
    gobos.forEach(gobo => {
      if (gobo.attachedToLightId) {
        // Attach to light
        window.dispatchEvent(new CustomEvent('ch-attach-gobo', {
          detail: {
            lightId: gobo.attachedToLightId,
            goboId: gobo.goboId,
            options: gobo.options,
          }
        }));
      } else {
        // Place as standalone
        window.dispatchEvent(new CustomEvent('ch-add-standalone-gobo', {
          detail: {
            goboId: gobo.goboId,
            position: gobo.position || [0, 2, -5],
            options: {
              ...gobo.options,
              pattern: gobo.pattern,
            },
          }
        }));
      }
    });
  }
};

