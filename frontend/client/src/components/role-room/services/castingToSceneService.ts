// @ts-nocheck
import type { Candidate, Role, ShotList, Prop, Location, CastingProject, CastingShot } from '../models/casting';
import { castingService } from './castingService';
import settingsService, { getCurrentUserId } from './settingsService';

export interface SceneCandidate {
  candidateId: string;
  roleId?: string;
  name: string;
  photo?: string;
  position?: { x: number; y: number; z: number };
  rotation?: number;
  avatarUrl?: string;
  avatarStatus: 'none' | 'generating' | 'ready' | 'error';
}

export interface SceneTransferResult {
  success: boolean;
  candidatesAdded: number;
  avatarsGenerated: number;
  errors: string[];
}

export interface ShotListScenePreset {
  shotListId: string;
  sceneId: string;
  cameraSetup?: {
    focalLength?: number;
    aperture?: number;
    iso?: number;
    shutter?: number;
  };
  shots: CastingShot[];
  candidates: SceneCandidate[];
}

const SCENE_CANDIDATES_KEY = 'virtualStudio_sceneCandidates';
let cachedSceneCandidates: SceneCandidate[] = [];

const hydrateSceneCandidates = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const remote = await settingsService.getSetting<SceneCandidate[]>(SCENE_CANDIDATES_KEY, { userId });
    if (remote) {
      cachedSceneCandidates = remote;
      return;
    }
  } catch {
    // Ignore hydration errors
  }
};

void hydrateSceneCandidates();

export const castingToSceneService = {
  addCandidateToScene(
    candidate: Candidate, 
    role?: Role,
    position?: { x: number; y: number; z: number }
  ): SceneCandidate {
    const sceneCandidate: SceneCandidate = {
      candidateId: candidate.id,
      roleId: role?.id,
      name: candidate.name,
      photo: candidate.photos[0],
      position: position || { x: 0, y: 0, z: 0 },
      rotation: 0,
      avatarStatus: 'none',
    };

    window.dispatchEvent(new CustomEvent('ch-add-casting-candidate', {
      detail: {
        candidate: sceneCandidate,
        generateAvatar: !!candidate.photos[0],
      }
    }));

    this.saveSceneCandidate(sceneCandidate);
    return sceneCandidate;
  },

  async addMultipleCandidatesToScene(
    candidates: Candidate[],
    roles: Role[],
    options?: {
      spacing?: number;
      lightingPreset?: {
        id: string;
        name: string;
        lights: Array<{
          type: string;
          position: [number, number, number];
          rotation: [number, number, number];
          intensity: number;
          cct?: number;
        }>;
      };
      banner?: {
        text: string;
        options?: {
          position?: { x: number; y: number; z: number };
          width?: number;
          height?: number;
          color?: string;
          glowColor?: string;
          animationSpeed?: number;
          waveAmplitude?: number;
        };
      };
    }
  ): Promise<SceneTransferResult> {
    const spacing = options?.spacing ?? 1.5;
    const result: SceneTransferResult = {
      success: true,
      candidatesAdded: 0,
      avatarsGenerated: 0,
      errors: [],
    };

    const startX = -((candidates.length - 1) * spacing) / 2;

    // Apply lighting preset if provided
    if (options?.lightingPreset) {
      window.dispatchEvent(new CustomEvent('ch-apply-lighting-preset', {
        detail: {
          presetId: options.lightingPreset.id,
          presetName: options.lightingPreset.name,
          lights: options.lightingPreset.lights,
        }
      }));
      console.log(`[Casting] Applying lighting preset: ${options.lightingPreset.name}`);
    }

    // Create scene banner if provided
    if (options?.banner) {
      window.dispatchEvent(new CustomEvent('ch-create-scene-banner', {
        detail: {
          text: options.banner.text,
          options: options.banner.options,
        }
      }));
      console.log(`[Casting] Creating scene banner: "${options.banner.text}"`);
    }

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const assignedRole = roles.find(r => candidate.assignedRoles.includes(r.id));
      
      try {
        const position = { x: startX + i * spacing, y: 0, z: 0 };
        this.addCandidateToScene(candidate, assignedRole, position);
        result.candidatesAdded++;

        if (candidate.photos[0]) {
          await this.requestAvatarGeneration(candidate);
          result.avatarsGenerated++;
        }
      } catch (error) {
        result.errors.push(`Failed to add ${candidate.name}: ${error}`);
      }
    }

    if (result.errors.length > 0) {
      result.success = result.candidatesAdded > 0;
    }

    window.dispatchEvent(new CustomEvent('casting-candidates-added', {
      detail: result
    }));

    return result;
  },

  async requestAvatarGeneration(candidate: Candidate): Promise<void> {
    if (!candidate.photos[0]) {
      throw new Error('No photo available for avatar generation');
    }

    window.dispatchEvent(new CustomEvent('ch-generate-avatar-from-casting', {
      detail: {
        candidateId: candidate.id,
        candidateName: candidate.name,
        photoUrl: candidate.photos[0],
      }
    }));
  },

  applyShotListToScene(shotList: ShotList, project: CastingProject): ShotListScenePreset {
    const preset: ShotListScenePreset = {
      shotListId: shotList.id,
      sceneId: shotList.sceneId,
      shots: shotList.shots,
      candidates: [],
    };

    if (shotList.cameraSettings) {
      preset.cameraSetup = {
        focalLength: shotList.cameraSettings.focalLength,
        aperture: shotList.cameraSettings.aperture,
        iso: shotList.cameraSettings.iso,
        shutter: shotList.cameraSettings.shutter,
      };
    }

    const roleIds = [...new Set(shotList.shots.map(s => s.roleId))];
    
    if (roleIds.length > 0) {
      const candidates = project.candidates.filter(c => 
        c.assignedRoles.some(r => roleIds.includes(r))
      );
      
      const roles = project.roles.filter(r => roleIds.includes(r.id));
      
      candidates.forEach((c, i) => {
        const role = roles.find(r => c.assignedRoles.includes(r.id));
        preset.candidates.push({
          candidateId: c.id,
          roleId: role?.id,
          name: c.name,
          photo: c.photos[0],
          position: { x: i * 1.5 - (candidates.length - 1) * 0.75, y: 0, z: 0 },
          avatarStatus: 'none',
        });
      });
    }

    window.dispatchEvent(new CustomEvent('ch-apply-shot-list-preset', {
      detail: preset
    }));

    if (preset.cameraSetup) {
      window.dispatchEvent(new CustomEvent('camera-settings-changed', {
        detail: preset.cameraSetup
      }));
    }

    return preset;
  },

  loadPropsToScene(props: Prop[]): number {
    let loaded = 0;

    props.forEach((prop, i) => {
      window.dispatchEvent(new CustomEvent('ch-add-asset-at', {
        detail: {
          asset: {
            id: prop.id,
            title: prop.name,
            type: 'prop',
            category: prop.category || 'general',
          },
          position: [i * 1.2, 0, -2],
        }
      }));
      loaded++;
    });

    return loaded;
  },

  applyLocationBackdrop(location: Location): void {
    let backdropType = 'studio';
    
    switch (location.type) {
      case 'outdoor':
        backdropType = 'outdoor-natural';
        break;
      case 'indoor':
        backdropType = 'indoor-modern';
        break;
      case 'studio':
        backdropType = 'studio-white';
        break;
      case 'virtual':
        backdropType = 'virtual-stage';
        break;
    }

    window.dispatchEvent(new CustomEvent('ch-load-backdrop', {
      detail: {
        backdropId: backdropType,
        category: location.type,
      }
    }));
  },

  async transferProjectToScene(projectId: string): Promise<SceneTransferResult> {
    const project = await castingService.getProject(projectId);
    if (!project) {
      return {
        success: false,
        candidatesAdded: 0,
        avatarsGenerated: 0,
        errors: ['Project not found'],
      };
    }

    const confirmedCandidates = project.candidates.filter(
      c => c.status === 'confirmed' || c.status === 'selected'
    );

    const result = await this.addMultipleCandidatesToScene(
      confirmedCandidates,
      project.roles
    );

    if (project.props && project.props.length > 0) {
      this.loadPropsToScene(project.props);
    }

    if (project.locations && project.locations.length > 0) {
      this.applyLocationBackdrop(project.locations[0]);
    }

    window.dispatchEvent(new CustomEvent('casting-project-transferred', {
      detail: {
        projectId,
        projectName: project.name,
        result,
      }
    }));

    return result;
  },

  saveSceneCandidate(candidate: SceneCandidate): void {
    try {
      const index = cachedSceneCandidates.findIndex(c => c.candidateId === candidate.candidateId);
      
      if (index >= 0) {
        cachedSceneCandidates[index] = candidate;
      } else {
        cachedSceneCandidates.push(candidate);
      }
      
      void settingsService.setSetting(SCENE_CANDIDATES_KEY, cachedSceneCandidates, { userId: getCurrentUserId() });
    } catch (error) {
      console.error('Error saving scene candidate:', error);
    }
  },

  getSceneCandidates(): SceneCandidate[] {
    return cachedSceneCandidates;
  },

  removeSceneCandidate(candidateId: string): void {
    try {
      cachedSceneCandidates = this.getSceneCandidates().filter(
        c => c.candidateId !== candidateId
      );
      void settingsService.setSetting(SCENE_CANDIDATES_KEY, cachedSceneCandidates, { userId: getCurrentUserId() });
      
      window.dispatchEvent(new CustomEvent('ch-remove-casting-candidate', {
        detail: { candidateId }
      }));
    } catch (error) {
      console.error('Error removing scene candidate:', error);
    }
  },

  clearSceneCandidates(): void {
    cachedSceneCandidates = [];
    void settingsService.setSetting(SCENE_CANDIDATES_KEY, cachedSceneCandidates, { userId: getCurrentUserId() });
    window.dispatchEvent(new CustomEvent('ch-clear-casting-candidates'));
  },

  updateCandidateAvatar(candidateId: string, avatarUrl: string): void {
    const candidates = this.getSceneCandidates();
    const candidate = candidates.find(c => c.candidateId === candidateId);
    
    if (candidate) {
      candidate.avatarUrl = avatarUrl;
      candidate.avatarStatus = 'ready';
      this.saveSceneCandidate(candidate);
      
      window.dispatchEvent(new CustomEvent('ch-update-candidate-avatar', {
        detail: { candidateId, avatarUrl }
      }));
    }
  },
};
