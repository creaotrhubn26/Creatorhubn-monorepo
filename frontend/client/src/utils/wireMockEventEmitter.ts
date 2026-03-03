/**
 * WireMock Event Emitter
 * 
 * Simple event system for real-time updates across WireMock components.
 * Solves Gap 7 by providing event-driven notifications for mapping changes.
 */

export type WireMockEventType = 
  | 'mapping_created'
  | 'mapping_updated'
  | 'mapping_deleted'
  | 'test_executed'
  | 'self_healing_triggered'
  | 'har_recorded'
  | 'reload_detected';

export interface WireMockEvent {
  type: WireMockEventType;
  timestamp: string;
  data?: any;
  source?: string;
}

type EventListener = (event: WireMockEvent) => void;

class WireMockEventEmitter {
  private listeners: Map<WireMockEventType, Set<EventListener>> = new Map();
  private eventHistory: WireMockEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to an event type
   */
  on(eventType: WireMockEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.off(eventType, listener);
    };
  }

  /**
   * Unsubscribe from an event type
   */
  off(eventType: WireMockEventType, listener: EventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit an event
   */
  emit(eventType: WireMockEventType, data?: any, source?: string): void {
    const event: WireMockEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
      source
    };

    // Add to history
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // Notify listeners
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }

    // Also notify wildcard listeners (if any)
    console.log(`[WireMock Event] ${eventType}`, data);
  }

  /**
   * Get event history
   */
  getHistory(eventType?: WireMockEventType): WireMockEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: WireMockEventType): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(eventType?: WireMockEventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }
}

// Global singleton instance
export const wireMockEvents = new WireMockEventEmitter();

/**
 * React hook for subscribing to WireMock events
 */
export function useWireMockEvent(
  eventType: WireMockEventType,
  handler: (event: WireMockEvent) => void
): void {
  if (typeof window === 'undefined') return;

  // Subscribe on mount, unsubscribe on unmount
  const unsubscribe = wireMockEvents.on(eventType, handler);
  
  // Cleanup function
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', unsubscribe);
  }
}

/**
 * Helper function to emit common events
 */
export const emitWireMockEvent = {
  mappingCreated: (mappingData: any) => {
    wireMockEvents.emit('mapping_created', mappingData, 'self-healing');
  },
  
  testExecuted: (testResult: any) => {
    wireMockEvents.emit('test_executed', testResult, 'test-runner');
  },
  
  selfHealingTriggered: (callData: any) => {
    wireMockEvents.emit('self_healing_triggered', callData, 'self-healing-sandbox');
  },
  
  harRecorded: (entryData: any) => {
    wireMockEvents.emit('har_recorded', entryData, 'har-recorder');
  },
  
  reloadDetected: (reloadData: any) => {
    wireMockEvents.emit('reload_detected', reloadData, 'reload-monitor');
  }
};
