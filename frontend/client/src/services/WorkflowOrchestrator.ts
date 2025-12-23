/**
 * WorkflowOrchestrator Service
 *
 * Manages workflow state and transitions between:
 * - PhotographerPhotoSuite
 * - UniversalShowcase
 * - StoryArcStudio
 *
 * Handles:
 * - Component transitions with context preservation
 * - Workflow state persistence
 * - Asset handoff between components
 * - Navigation with state
 */

import { MediaAsset, PhotoAsset, VideoAsset } from '../types/MediaAssetTypes';

export enum WorkflowComponent {
  UNIVERSAL_SHOWCASE = 'universal_showcase',
  PHOTOGRAPHER_PHOTO_SUITE = 'photographer_photo_suite',
  STORY_ARC_STUDIO = 'story_arc_studio',
  AUDIO_ENHANCEMENT_SUITE = 'audio_enhancement_suite',
}

export enum WorkflowAction {
  EDIT_PHOTO = 'edit_photo',
  CREATE_VIDEO = 'create_video',
  VIEW_SHOWCASE = 'view_showcase',
  EXPORT_TO_SHOWCASE = 'export_to_showcase',
  SEND_TO_VIDEO_EDITOR = 'send_to_video_editor',
  RETURN_FROM_EDITOR = 'return_from_editor',
  SEND_AUDIO_TO_VIDEO_EDITOR = 'send_audio_to_video_editor',
  EXTRACT_AUDIO_FOR_ENHANCEMENT = 'extract_audio_for_enhancement',
}

export interface WorkflowTransition {
  id: string;
  fromComponent: WorkflowComponent;
  toComponent: WorkflowComponent;
  action: WorkflowAction;
  timestamp: Date;
  userId: string;
  projectId?: string;
  assets: MediaAsset[];
  metadata: Record<string, unknown>;
}

export interface WorkflowState {
  id: string;
  currentComponent: WorkflowComponent;
  previousComponent?: WorkflowComponent;
  transitions: WorkflowTransition[];
  context: WorkflowContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowContext {
  // Project info
  projectId?: string;
  projectName?: string;
  clientId?: string;

  // Assets being worked on
  selectedAssets: MediaAsset[];

  // Editor states
  photoEditorState?: {
    editControls: Record<string, unknown>;
    selectedPreset?: string;
    historyIndex: number;
  };

  videoEditorState?: {
    timelineState: Record<string, unknown>;
    currentTime: number;
    zoom: number;
  };

  showcaseState?: {
    viewMode: 'grid' | 'list';
    filter?: string;
    sort?: string;
  };

  audioEditorState?: {
    waveformZoom: number;
    selectedRegion?: { start: number; end: number };
    appliedEffects: string[];
  };

  // Return context (for going back)
  returnTo?: {
    component: WorkflowComponent;
    state: Record<string, unknown>;
  };
}

export interface TransitionOptions {
  preserveState?: boolean;
  openInNewWindow?: boolean;
  callback?: (result: unknown) => void;
}

class WorkflowOrchestratorService {
  private currentWorkflow: WorkflowState | null = null;
  private workflowHistory: WorkflowState[] = [];
  private stateChangeListeners: Array<(state: WorkflowState) => void> = [];

  // Storage keys
  private readonly STORAGE_KEY = 'workflow_state';
  private readonly HISTORY_KEY = 'workflow_history';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Initialize or get current workflow
   */
  getOrCreateWorkflow(userId: string, component: WorkflowComponent): WorkflowState {
    if (!this.currentWorkflow) {
      this.currentWorkflow = {
        id: this.generateId(),
        currentComponent: component,
        transitions: [],
        context: {
          selectedAssets: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.saveToStorage();
    }
    return this.currentWorkflow;
  }

  /**
   * Transition from one component to another
   */
  async transition(
    action: WorkflowAction,
    toComponent: WorkflowComponent,
    assets: MediaAsset[],
    userId: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    const workflow = this.getOrCreateWorkflow(userId, toComponent);

    const transition: WorkflowTransition = {
      id: this.generateId(),
      fromComponent: workflow.currentComponent,
      toComponent,
      action,
      timestamp: new Date(),
      userId,
      projectId: workflow.context.projectId,
      assets,
      metadata: {},
    };

    // Update workflow state
    workflow.previousComponent = workflow.currentComponent;
    workflow.currentComponent = toComponent;
    workflow.transitions.push(transition);
    workflow.context.selectedAssets = assets;
    workflow.updatedAt = new Date();

    // Save return context if preserving state
    if (options.preserveState) {
      workflow.context.returnTo = {
        component: transition.fromComponent,
        state: this.captureComponentState(transition.fromComponent),
      };
    }

    this.currentWorkflow = workflow;
    this.saveToStorage();
    this.notifyListeners(workflow);

    console.log('🔄 Workflow transition: ', {
      from: transition.fromComponent,
      to: toComponent,
      action,
      assetsCount: assets.length,
    });

    return transition;
  }

  /**
   * Edit photo: Showcase → PhotoSuite
   */
  async editPhoto(
    photo: PhotoAsset,
    userId: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    return this.transition(
      WorkflowAction.EDIT_PHOTO,
      WorkflowComponent.PHOTOGRAPHER_PHOTO_SUITE,
      [photo],
      userId,
      { preserveState: true, ...options },
    );
  }

  /**
   * Create video from photos: PhotoSuite/Showcase → StoryArcStudio
   */
  async createVideoFromPhotos(
    photos: PhotoAsset[],
    userId: string,
    projectId?: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    const workflow = this.getOrCreateWorkflow(userId, WorkflowComponent.STORY_ARC_STUDIO);

    if (projectId) {
      workflow.context.projectId = projectId;
    }

    return this.transition(
      WorkflowAction.CREATE_VIDEO,
      WorkflowComponent.STORY_ARC_STUDIO,
      photos,
      userId,
      { preserveState: true, ...options },
    );
  }

  /**
   * Send photos to video editor: PhotoSuite → StoryArcStudio
   */
  async sendToVideoEditor(
    photos: PhotoAsset[],
    userId: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    return this.transition(
      WorkflowAction.SEND_TO_VIDEO_EDITOR,
      WorkflowComponent.STORY_ARC_STUDIO,
      photos,
      userId,
      { preserveState: true, ...options },
    );
  }

  /**
   * Export to showcase: PhotoSuite/StoryArcStudio → Showcase
   */
  async exportToShowcase(
    assets: MediaAsset[],
    userId: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    return this.transition(
      WorkflowAction.EXPORT_TO_SHOWCASE,
      WorkflowComponent.UNIVERSAL_SHOWCASE,
      assets,
      userId,
      options,
    );
  }

  /**
   * Return from editor to previous component
   */
  async returnFromEditor(
    updatedAssets: MediaAsset[],
    userId: string,
  ): Promise<WorkflowTransition | null> {
    const workflow = this.currentWorkflow;

    if (!workflow || !workflow.context.returnTo) {
      console.warn('No return context available');
      return null;
    }

    const returnComponent = workflow.context.returnTo.component;

    const transition = await this.transition(
      WorkflowAction.RETURN_FROM_EDITOR,
      returnComponent,
      updatedAssets,
      userId,
      {},
    );

    // Restore previous state
    this.restoreComponentState(returnComponent, workflow.context.returnTo.state);

    return transition;
  }

  /**
   * Send audio to video editor: AudioEnhancementSuite → StoryArcStudio
   */
  async sendAudioToVideoEditor(
    audioAssets: MediaAsset[],
    userId: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    return this.transition(
      WorkflowAction.SEND_AUDIO_TO_VIDEO_EDITOR,
      WorkflowComponent.STORY_ARC_STUDIO,
      audioAssets,
      userId,
      { preserveState: true, ...options },
    );
  }

  /**
   * Extract audio for enhancement: StoryArcStudio → AudioEnhancementSuite
   */
  async extractAudioForEnhancement(
    videoAsset: VideoAsset,
    userId: string,
    options: TransitionOptions = {},
  ): Promise<WorkflowTransition> {
    return this.transition(
      WorkflowAction.EXTRACT_AUDIO_FOR_ENHANCEMENT,
      WorkflowComponent.AUDIO_ENHANCEMENT_SUITE,
      [videoAsset],
      userId,
      { preserveState: true, ...options },
    );
  }

  /**
   * Update workflow context
   */
  updateContext(updates: Partial<WorkflowContext>): void {
    if (!this.currentWorkflow) return;

    this.currentWorkflow.context = {
      ...this.currentWorkflow.context,
      ...updates,
    };
    this.currentWorkflow.updatedAt = new Date();

    this.saveToStorage();
    this.notifyListeners(this.currentWorkflow);
  }

  /**
   * Set project context
   */
  setProject(projectId: string, projectName?: string): void {
    this.updateContext({
      projectId,
      projectName,
    });
  }

  /**
   * Get current workflow state
   */
  getCurrentWorkflow(): WorkflowState | null {
    return this.currentWorkflow;
  }

  /**
   * Get workflow context
   */
  getContext(): WorkflowContext | null {
    return this.currentWorkflow?.context || null;
  }

  /**
   * Clear workflow state (e.g., on project completion)
   */
  clearWorkflow(): void {
    if (this.currentWorkflow) {
      this.workflowHistory.push(this.currentWorkflow);
    }

    this.currentWorkflow = null;
    this.saveToStorage();
    this.notifyListeners(null as unknown as WorkflowState);
  }

  /**
   * Get workflow history
   */
  getHistory(): WorkflowState[] {
    return this.workflowHistory;
  }

  /**
   * Subscribe to workflow state changes
   */
  subscribe(listener: (state: WorkflowState) => void): () => void {
    this.stateChangeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Generate navigation path for component
   */
  getNavigationPath(component: WorkflowComponent): string {
    switch (component) {
      case WorkflowComponent.UNIVERSAL_SHOWCASE:
        return '/showcase';
      case WorkflowComponent.PHOTOGRAPHER_PHOTO_SUITE:
        return '/photo-suite';
      case WorkflowComponent.STORY_ARC_STUDIO:
        return '/story-arc-studio';
      default:
        return'/';
    }
  }

  /**
   * Create navigation state for React Router
   */
  createNavigationState(workflow: WorkflowState): Record<string, unknown> {
    return {
      workflowId: workflow.id,
      context: workflow.context,
      fromComponent: workflow.previousComponent,
      assets: workflow.context.selectedAssets,
      projectId: workflow.context.projectId,
    };
  }

  // Private helper methods

  private captureComponentState(component: WorkflowComponent): Record<string, unknown> {
    // Capture current state based on component
    // This would be populated from component-specific state
    return {};
  }

  private restoreComponentState(
    component: WorkflowComponent,
    state: Record<string, unknown>,
  ): void {
    // Restore state to component
    // This would trigger component updates
    console.log('Restoring state for', component, state);
  }

  private generateId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveToStorage(): void {
    try {
      if (this.currentWorkflow) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentWorkflow));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }

      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.workflowHistory));
    } catch (error) {
      console.error('Failed to save workflow to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const workflowData = localStorage.getItem(this.STORAGE_KEY);
      if (workflowData) {
        this.currentWorkflow = JSON.parse(workflowData);
      }

      const historyData = localStorage.getItem(this.HISTORY_KEY);
      if (historyData) {
        this.workflowHistory = JSON.parse(historyData);
      }
    } catch (error) {
      console.error('Failed to load workflow from storage:', error);
    }
  }

  private notifyListeners(state: WorkflowState): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Workflow listener error:', error);
      }
    });
  }
}

// Export singleton instance
export const workflowOrchestrator = new WorkflowOrchestratorService();
