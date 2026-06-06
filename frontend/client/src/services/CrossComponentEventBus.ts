/**
 * CrossComponentEventBus
 *
 * Real-time event propagation system for:
 * - PhotographerPhotoSuite
 * - UniversalShowcase
 * - StoryArcStudio
 *
 * Features:
 * - Type-safe event system
 * - WebSocket integration for real-time updates
 * - Local event broadcasting
 * - Component-specific event filtering
 * - Event history for debugging
 */

import type { MediaAsset } from '../types/MediaAssetTypes';
import type { WorkflowTransition } from './WorkflowOrchestrator';
import { WorkflowComponent } from './WorkflowOrchestrator';
import { buildEventsWsUrl } from '../lib/realtimeWsUrl';

export enum CrossComponentEventType {
  // Asset events
  ASSET_CREATED = 'asset_created',
  ASSET_UPDATED = 'asset_updated',
  ASSET_DELETED = 'asset_deleted',
  ASSET_PROCESSING_STARTED = 'asset_processing_started',
  ASSET_PROCESSING_COMPLETED = 'asset_processing_completed',
  ASSET_PROCESSING_FAILED = 'asset_processing_failed',

  // Workflow events
  WORKFLOW_TRANSITION = 'workflow_transition',
  COMPONENT_OPENED = 'component_opened',
  COMPONENT_CLOSED = 'component_closed',

  // Photo editing events
  PHOTO_EDITED = 'photo_edited',
  PHOTO_ENHANCED = 'photo_enhanced',
  PHOTO_EXPORTED = 'photo_exported',
  PHOTOS_BATCH_PROCESSED = 'photos_batch_processed',

  // Video editing events
  VIDEO_CLIP_ADDED = 'video_clip_added',
  VIDEO_CLIP_UPDATED = 'video_clip_updated',
  VIDEO_CLIP_REMOVED = 'video_clip_removed',
  VIDEO_EXPORTED = 'video_exported',
  TIMELINE_UPDATED = 'timeline_updated',

  // Audio enhancement events
  AUDIO_ENHANCEMENT_STARTED = 'audio_enhancement_started',
  AUDIO_ENHANCEMENT_COMPLETED = 'audio_enhancement_completed',
  AUDIO_ENHANCEMENT_FAILED = 'audio_enhancement_failed',
  AUDIO_ENHANCEMENT_PROGRESS = 'audio_enhancement_progress',
  AUDIO_DENOISE_APPLIED = 'audio_denoise_applied',
  AUDIO_SOURCE_SEPARATED = 'audio_source_separated',
  AUDIO_NORMALIZED = 'audio_normalized',

  // Showcase events
  SHOWCASE_ITEM_ADDED = 'showcase_item_added',
  SHOWCASE_ITEM_UPDATED = 'showcase_item_updated',
  SHOWCASE_ITEM_REMOVED = 'showcase_item_removed',
  SHOWCASE_REFRESHED = 'showcase_refreshed',

  // Project events
  PROJECT_UPDATED = 'project_updated',
  PROJECT_ASSET_LINKED = 'project_asset_linked',
  PROJECT_ASSET_UNLINKED = 'project_asset_unlinked',

  // Google Drive events
  GOOGLE_DRIVE_SYNC_STARTED = 'google_drive_sync_started',
  GOOGLE_DRIVE_SYNC_COMPLETED = 'google_drive_sync_completed',
  GOOGLE_DRIVE_UPLOAD_PROGRESS = 'google_drive_upload_progress',
}

export interface CrossComponentEvent<T = unknown> {
  id: string;
  type: CrossComponentEventType;
  timestamp: Date;
  source: WorkflowComponent;
  userId: string;
  projectId?: string;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface AssetEventData {
  asset: MediaAsset;
  previousState?: MediaAsset;
}

export interface WorkflowEventData {
  transition: WorkflowTransition;
  assets: MediaAsset[];
}

export interface PhotoEditEventData {
  photoId: string;
  editControls: Record<string, unknown>;
  previewUrl?: string;
}

export interface VideoClipEventData {
  clipId: string;
  assetId?: string;
  startTime: number;
  endTime: number;
  trackId: string;
}

export interface ProgressEventData {
  assetId: string;
  progress: number; // 0-100,

  status: string;
  estimatedTimeRemaining?: number;
}

export interface AudioEnhancementEventData {
  audioId: string;
  enhancementType: 'denoise' | 'speech_enhance' | 'source_separate' | 'normalize' | 'batch';
  originalUrl: string;
  enhancedUrl?: string;
  qualityMetrics?: {
    snr: number;
    thd: number;
    dynamicRange: number;
    noiseReduction: number;
    speechClarity: number;
  };
  processingTime?: number;
}

type EventCallback<T = unknown> = (event: CrossComponentEvent<T>) => void;

class CrossComponentEventBusClass {
  private listeners: Map<CrossComponentEventType, Set<EventCallback>> = new Map();
  private componentListeners: Map<WorkflowComponent, Set<EventCallback>> = new Map();
  private eventHistory: CrossComponentEvent[] = [];
  private readonly MAX_HISTORY = 100;

  // WebSocket connection (if available)
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeWebSocket();
  }

  // ========================================
  // Event Publishing
  // ========================================

  /**
   * Publish an event
   */
  publish<T = unknown>(
    type: CrossComponentEventType,
    source: WorkflowComponent,
    userId: string,
    data: T,
    options: {
      projectId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): CrossComponentEvent<T> {
    const event: CrossComponentEvent<T> = {
      id: this.generateEventId(),
      type,
      timestamp: new Date(),
      source,
      userId,
      projectId: options.projectId,
      data,
      metadata: options.metadata,
    };

    // Add to history
    this.addToHistory(event);

    // Notify local listeners
    this.notifyListeners(event);

    // Send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'publish_event',
          event,
        }),
      );
    }

    console.log('📡 Event published: ', type, source, data);

    return event;
  }

  /**
   * Publish asset created event
   */
  publishAssetCreated(
    asset: MediaAsset,
    source: WorkflowComponent,
    userId: string,
  ): CrossComponentEvent<AssetEventData> {
    return this.publish(
      CrossComponentEventType.ASSET_CREATED,
      source,
      userId,
      { asset },
      { projectId: asset.projectId },
    );
  }

  /**
   * Publish asset updated event
   */
  publishAssetUpdated(
    asset: MediaAsset,
    previousState: MediaAsset,
    source: WorkflowComponent,
    userId: string,
  ): CrossComponentEvent<AssetEventData> {
    return this.publish(
      CrossComponentEventType.ASSET_UPDATED,
      source,
      userId,
      { asset, previousState },
      { projectId: asset.projectId },
    );
  }

  /**
   * Publish asset deleted event
   */
  publishAssetDeleted(
    asset: MediaAsset,
    source: WorkflowComponent,
    userId: string,
  ): CrossComponentEvent<AssetEventData> {
    return this.publish(
      CrossComponentEventType.ASSET_DELETED,
      source,
      userId,
      { asset },
      { projectId: asset.projectId },
    );
  }

  /**
   * Publish workflow transition event
   */
  publishWorkflowTransition(
    transition: WorkflowTransition,
    assets: MediaAsset[],
  ): CrossComponentEvent<WorkflowEventData> {
    return this.publish(
      CrossComponentEventType.WORKFLOW_TRANSITION,
      transition.fromComponent,
      transition.userId,
      { transition, assets },
      { projectId: transition.projectId },
    );
  }

  /**
   * Publish photo edited event
   */
  publishPhotoEdited(
    photoId: string,
    editControls: Record<string, unknown>,
    userId: string,
    projectId?: string,
    previewUrl?: string,
  ): CrossComponentEvent<PhotoEditEventData> {
    return this.publish(
      CrossComponentEventType.PHOTO_EDITED,
      WorkflowComponent.PHOTOGRAPHER_PHOTO_SUITE,
      userId,
      { photoId, editControls, previewUrl },
      { projectId },
    );
  }

  /**
   * Publish video clip added event
   */
  publishVideoClipAdded(
    clipData: VideoClipEventData,
    userId: string,
    projectId?: string,
  ): CrossComponentEvent<VideoClipEventData> {
    return this.publish(
      CrossComponentEventType.VIDEO_CLIP_ADDED,
      WorkflowComponent.STORY_ARC_STUDIO,
      userId,
      clipData,
      { projectId },
    );
  }

  /**
   * Publish showcase refreshed event
   */
  publishShowcaseRefreshed(
    userId: string,
    projectId?: string,
    metadata?: Record<string, unknown>,
  ): CrossComponentEvent {
    return this.publish(
      CrossComponentEventType.SHOWCASE_REFRESHED,
      WorkflowComponent.UNIVERSAL_SHOWCASE,
      userId,
      {},
      { projectId, metadata },
    );
  }

  /**
   * Publish Google Drive upload progress
   */
  publishGoogleDriveProgress(
    assetId: string,
    progress: number,
    userId: string,
    source: WorkflowComponent,
    status: string,
  ): CrossComponentEvent<ProgressEventData> {
    return this.publish(
      CrossComponentEventType.GOOGLE_DRIVE_UPLOAD_PROGRESS,
      source,
      userId,
      { assetId, progress, status },
      { metadata: { realtime: true } },
    );
  }

  /**
   * Publish audio enhancement started event
   */
  publishAudioEnhancementStarted(
    audioId: string,
    enhancementType: 'denoise' | 'speech_enhance' | 'source_separate' | 'normalize' | 'batch',
    originalUrl: string,
    userId: string,
    projectId?: string,
  ): CrossComponentEvent<AudioEnhancementEventData> {
    return this.publish(
      CrossComponentEventType.AUDIO_ENHANCEMENT_STARTED,
      WorkflowComponent.UNIVERSAL_SHOWCASE, // Audio suite runs in showcase context
      userId,
      { audioId, enhancementType, originalUrl },
      { projectId },
    );
  }

  /**
   * Publish audio enhancement completed event
   */
  publishAudioEnhancementCompleted(
    audioId: string,
    enhancementType: 'denoise' | 'speech_enhance' | 'source_separate' | 'normalize' | 'batch',
    originalUrl: string,
    enhancedUrl: string,
    userId: string,
    projectId?: string,
    qualityMetrics?: {
      snr: number;
      thd: number;
      dynamicRange: number;
      noiseReduction: number;
      speechClarity: number;
    },
    processingTime?: number,
  ): CrossComponentEvent<AudioEnhancementEventData> {
    return this.publish(
      CrossComponentEventType.AUDIO_ENHANCEMENT_COMPLETED,
      WorkflowComponent.UNIVERSAL_SHOWCASE,
      userId,
      { audioId, enhancementType, originalUrl, enhancedUrl, qualityMetrics, processingTime },
      { projectId },
    );
  }

  /**
   * Publish audio enhancement progress
   */
  publishAudioEnhancementProgress(
    audioId: string,
    progress: number,
    status: string,
    userId: string,
  ): CrossComponentEvent<ProgressEventData> {
    return this.publish(
      CrossComponentEventType.AUDIO_ENHANCEMENT_PROGRESS,
      WorkflowComponent.UNIVERSAL_SHOWCASE,
      userId,
      { assetId: audioId, progress, status },
      { metadata: { realtime: true } },
    );
  }

  // ========================================
  // Event Subscription
  // ========================================

  /**
   * Subscribe to specific event type
   */
  on<T = unknown>(eventType: CrossComponentEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback as EventCallback);
    };
  }

  /**
   * Subscribe to all events from a specific component
   */
  onComponent(component: WorkflowComponent, callback: EventCallback): () => void {
    if (!this.componentListeners.has(component)) {
      this.componentListeners.set(component, new Set());
    }

    this.componentListeners.get(component)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.componentListeners.get(component)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(callback: EventCallback): () => void {
    // Use a special wildcard key
    const wildcardKey = '__ALL__' as unknown as CrossComponentEventType;

    if (!this.listeners.has(wildcardKey)) {
      this.listeners.set(wildcardKey, new Set());
    }

    this.listeners.get(wildcardKey)!.add(callback);

    return () => {
      this.listeners.get(wildcardKey)?.delete(callback);
    };
  }

  // ========================================
  // Private Methods
  // ========================================

  private notifyListeners(event: CrossComponentEvent): void {
    // Notify specific event listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }

    // Notify component listeners
    const compListeners = this.componentListeners.get(event.source);
    if (compListeners) {
      compListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in component listener for ${event.source}:`, error);
        }
      });
    }

    // Notify wildcard listeners
    const wildcardKey = '__ALL__' as unknown as CrossComponentEventType;
    const wildcardListeners = this.listeners.get(wildcardKey);
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in wildcard event listener:', error);
        }
      });
    }
  }

  private addToHistory(event: CrossComponentEvent): void {
    this.eventHistory.push(event);

    // Keep only last MAX_HISTORY events
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================
  // WebSocket Integration
  // ========================================

  private initializeWebSocket(): void {
    // Only initialize in browser environment
    if (typeof window === 'undefined') return;

    // Returnerer null i prod uten eksplisitt WS-host (Vercel proxy-er ikke
    // WS). Da kobler vi ikke — og attemptReconnect() trigges aldri, så vi
    // unngår den uendelige «WebSocket failed»-spammen.
    const wsUrl = buildEventsWsUrl('/ws/events');
    if (!wsUrl) return;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ CrossComponentEventBus WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as CrossComponentEvent;
          this.handleRemoteEvent(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed, attempting reconnect...');
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private handleRemoteEvent(event: CrossComponentEvent): void {
    // Add to history
    this.addToHistory(event);

    // Notify local listeners
    this.notifyListeners(event);

    console.log('📡 Remote event received:', event.type, event.source);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.initializeWebSocket();
    }, delay);
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Get event history
   */
  getHistory(filter?: {
    type?: CrossComponentEventType;
    source?: WorkflowComponent;
    userId?: string;
    projectId?: string;
    since?: Date;
  }): CrossComponentEvent[] {
    let filtered = this.eventHistory;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter((e) => e.type === filter.type);
      }
      if (filter.source) {
        filtered = filtered.filter((e) => e.source === filter.source);
      }
      if (filter.userId) {
        filtered = filtered.filter((e) => e.userId === filter.userId);
      }
      if (filter.projectId) {
        filtered = filtered.filter((e) => e.projectId === filter.projectId);
      }
      if (filter.since) {
        filtered = filtered.filter((e) => e.timestamp >= filter.since!);
      }
    }

    return filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Clear all listeners
   */
  clearAllListeners(): void {
    this.listeners.clear();
    this.componentListeners.clear();
  }
}

// Export singleton instance
export const crossComponentEventBus = new CrossComponentEventBusClass();
