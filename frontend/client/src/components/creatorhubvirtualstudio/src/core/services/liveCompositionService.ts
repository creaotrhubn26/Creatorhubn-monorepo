/**
 * Live Composition Service
 * 
 * Provides real-time composition feedback using SAM 2
 */

import { sceneCompositionService, type CompositionAnalysis } from './sceneCompositionService';

export class LiveCompositionService {
  private analysisCache: Map<string, CompositionAnalysis> = new Map();
  private updateCallbacks: Set<(analysis: CompositionAnalysis) => void> = new Set();

  /**
   * Subscribe to composition updates
   */
  subscribe(callback: (analysis: CompositionAnalysis) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Analyze composition and notify subscribers
   */
  async analyzeAndNotify(imageUrl: string): Promise<CompositionAnalysis> {
    // Check cache first
    if (this.analysisCache.has(imageUrl)) {
      const cached = this.analysisCache.get(imageUrl)!;
      this.notifySubscribers(cached);
      return cached;
    }

    // Perform analysis
    const analysis = await sceneCompositionService.analyzeComposition(imageUrl);
    
    // Cache result
    this.analysisCache.set(imageUrl, analysis);
    
    // Notify subscribers
    this.notifySubscribers(analysis);
    
    return analysis;
  }

  private notifySubscribers(analysis: CompositionAnalysis) {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(analysis);
      } catch (error) {
        console.error('Error in composition update callback:', error);
      }
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.analysisCache.clear();
  }
}

export const liveCompositionService = new LiveCompositionService();


























