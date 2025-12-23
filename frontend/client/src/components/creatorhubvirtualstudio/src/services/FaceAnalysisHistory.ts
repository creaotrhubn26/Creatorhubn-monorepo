/**
 * Face Analysis History Service
 * 
 * Manages history of face analysis results and scene adjustments
 * Provides undo/redo functionality for camera/lighting adjustments
 */

import { logger } from '../core/services/logger';
import type { FaceAnalysisResults, CameraAdjustment, LightingAdjustment } from './FaceAnalysisEnhancements';

const log = logger.module('FaceAnalysisHistory');

export interface AnalysisSnapshot {
  id: string;
  timestamp: number;
  analysisResults: FaceAnalysisResults;
  cameraAdjustment?: CameraAdjustment;
  lightingAdjustments?: LightingAdjustment[];
  compositionGuides?: any;
  sceneState?: {
    cameraNode?: any;
    lightNodes?: any[];
  };
}

export interface HistoryState {
  snapshots: AnalysisSnapshot[];
  currentIndex: number;
  maxHistorySize: number;
}

class FaceAnalysisHistoryManager {
  private state: HistoryState = {
    snapshots: [],
    currentIndex: -1,
    maxHistorySize: 50, // Keep last 50 analyses
  };

  /**
   * Add a new analysis snapshot to history
   */
  addSnapshot(
    analysisResults: FaceAnalysisResults,
    cameraAdjustment?: CameraAdjustment,
    lightingAdjustments?: LightingAdjustment[],
    compositionGuides?: any,
    sceneState?: AnalysisSnapshot['sceneState']
  ): string {
    const snapshot: AnalysisSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      analysisResults,
      cameraAdjustment,
      lightingAdjustments,
      compositionGuides,
      sceneState,
    };

    // Remove any snapshots after current index (if we're not at the end)
    if (this.state.currentIndex < this.state.snapshots.length - 1) {
      this.state.snapshots = this.state.snapshots.slice(0, this.state.currentIndex + 1);
    }

    // Add new snapshot
    this.state.snapshots.push(snapshot);
    this.state.currentIndex = this.state.snapshots.length - 1;

    // Trim history if too long
    if (this.state.snapshots.length > this.state.maxHistorySize) {
      this.state.snapshots = this.state.snapshots.slice(-this.state.maxHistorySize);
      this.state.currentIndex = this.state.snapshots.length - 1;
    }

    log.info(`Added snapshot ${snapshot.id} (${this.state.snapshots.length} total)`);
    return snapshot.id;
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): AnalysisSnapshot | null {
    if (this.state.currentIndex < 0 || this.state.currentIndex >= this.state.snapshots.length) {
      return null;
    }
    return this.state.snapshots[this.state.currentIndex];
  }

  /**
   * Get previous snapshot (for undo)
   */
  getPreviousSnapshot(): AnalysisSnapshot | null {
    if (this.state.currentIndex <= 0) {
      return null;
    }
    return this.state.snapshots[this.state.currentIndex - 1];
  }

  /**
   * Get next snapshot (for redo)
   */
  getNextSnapshot(): AnalysisSnapshot | null {
    if (this.state.currentIndex >= this.state.snapshots.length - 1) {
      return null;
    }
    return this.state.snapshots[this.state.currentIndex + 1];
  }

  /**
   * Undo - move to previous snapshot
   */
  undo(): AnalysisSnapshot | null {
    if (this.state.currentIndex <= 0) {
      log.warn('Nothing to undo');
      return null;
    }
    this.state.currentIndex--;
    const snapshot = this.state.snapshots[this.state.currentIndex];
    log.info(`Undo to snapshot ${snapshot.id}`);
    return snapshot;
  }

  /**
   * Redo - move to next snapshot
   */
  redo(): AnalysisSnapshot | null {
    if (this.state.currentIndex >= this.state.snapshots.length - 1) {
      log.warn('Nothing to redo');
      return null;
    }
    this.state.currentIndex++;
    const snapshot = this.state.snapshots[this.state.currentIndex];
    log.info(`Redo to snapshot ${snapshot.id}`);
    return snapshot;
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.state.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.state.currentIndex < this.state.snapshots.length - 1;
  }

  /**
   * Get all snapshots
   */
  getAllSnapshots(): AnalysisSnapshot[] {
    return [...this.state.snapshots];
  }

  /**
   * Get snapshot by ID
   */
  getSnapshotById(id: string): AnalysisSnapshot | null {
    return this.state.snapshots.find((s) => s.id === id) || null;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.state.snapshots = [];
    this.state.currentIndex = -1;
    log.info('History cleared');
  }

  /**
   * Get history statistics
   */
  getStats(): {
    totalSnapshots: number;
    currentIndex: number;
    canUndo: boolean;
    canRedo: boolean;
  } {
    return {
      totalSnapshots: this.state.snapshots.length,
      currentIndex: this.state.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * Export history as JSON
   */
  exportHistory(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(json: string): void {
    try {
      const imported = JSON.parse(json);
      this.state = {
        ...imported,
        maxHistorySize: imported.maxHistorySize || 50,
      };
      log.info('History imported successfully');
    } catch (err) {
      log.error('Failed to import history', err);
      throw new Error('Invalid history JSON');
    }
  }
}

// Singleton instance
export const faceAnalysisHistory = new FaceAnalysisHistoryManager();


