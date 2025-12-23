/**
 * Self-Healing Sandbox
 * Automatically records live API calls when WireMock stubs are missing
 * and converts them to WireMock mappings
 */

import { emitWireMockEvent } from './wireMockEventEmitter';

export interface RecordedCall {
  id: string;
  timestamp: Date;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  };
  responseTime: number;
}

export interface WireMockMapping {
  request: {
    method: string;
    url?: string;
    urlPattern?: string;
    urlPath?: string;
    urlPathPattern?: string;
    headers?: Record<string, any>;
    bodyPatterns?: Array<any>;
  };
  response: {
    status: number;
    body?: string;
    jsonBody?: any;
    headers?: Record<string, string>;
    fixedDelayMilliseconds?: number;
  };
  priority?: number;
  scenarioName?: string;
  requiredScenarioState?: string;
  newScenarioState?: string;
}

export class SelfHealingSandbox {
  private recordedCalls: RecordedCall[] = [];
  private autoConvertEnabled: boolean = false;
  private onMappingCreated?: (mapping: WireMockMapping) => void;

  /**
   * Enable auto-conversion of recorded calls to WireMock mappings
   */
  enableAutoConvert(callback?: (mapping: WireMockMapping) => void): void {
    this.autoConvertEnabled = true;
    this.onMappingCreated = callback;
  }

  /**
   * Disable auto-conversion
   */
  disableAutoConvert(): void {
    this.autoConvertEnabled = false;
  }

  /**
   * Record a live API call
   */
  recordCall(
    method: string,
    url: string,
    requestHeaders: Record<string, string>,
    requestBody: any,
    responseStatus: number,
    responseStatusText: string,
    responseHeaders: Record<string, string>,
    responseBody: any,
    responseTime: number
  ): RecordedCall {
    const recordedCall: RecordedCall = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      request: {
        method,
        url,
        headers: requestHeaders,
        body: requestBody
      },
      response: {
        status: responseStatus,
        statusText: responseStatusText,
        headers: responseHeaders,
        body: responseBody
      },
      responseTime
    };

    this.recordedCalls.push(recordedCall);

    // Emit event for real-time updates (Gap 7 fix)
    emitWireMockEvent.selfHealingTriggered(recordedCall);

    // Auto-convert if enabled
    if (this.autoConvertEnabled) {
      const mapping = this.convertToWireMockMapping(recordedCall);
      if (this.onMappingCreated) {
        this.onMappingCreated(mapping);
      }
      // Emit mapping created event
      emitWireMockEvent.mappingCreated(mapping);
    }

    return recordedCall;
  }

  /**
   * Convert a recorded call to a WireMock mapping
   */
  convertToWireMockMapping(call: RecordedCall): WireMockMapping {
    const urlObj = new URL(call.request.url, 'http://localhost');
    const path = urlObj.pathname;

    // Determine if we should use exact match or pattern
    const hasPathParams = /\/\d+/.test(path); // Simple check for numeric IDs
    
    const mapping: WireMockMapping = {
      request: {
        method: call.request.method,
        ...(hasPathParams 
          ? { urlPathPattern: path.replace(/\/\d+/g, '/[0-9]+') }
          : { urlPath: path }
        )
      },
      response: {
        status: call.response.status,
        headers: {
          'Content-Type': call.response.headers['Content-Type'] || 'application/json',
          ...call.response.headers
        },
        fixedDelayMilliseconds: Math.min(call.responseTime, 1000) // Cap at 1 second
      },
      priority: 5 // Default priority
    };

    // Add response body
    if (call.response.body) {
      if (typeof call.response.body === 'string') {
        mapping.response.body = call.response.body;
      } else {
        mapping.response.jsonBody = call.response.body;
      }
    }

    // Add request body pattern if present
    if (call.request.body) {
      mapping.request.bodyPatterns = [{
        matchesJsonPath: '$' // Match any JSON body
      }];
    }

    return mapping;
  }

  /**
   * Save a mapping to WireMock server
   */
  async saveMappingToWireMock(mapping: WireMockMapping): Promise<boolean> {
    try {
      const response = await fetch('/api/wiremock/__admin/mappings', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json'
        },
        body: JSON.stringify(mapping)
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to save mapping to WireMock: ', error);
      return false;
    }
  }

  /**
   * Get all recorded calls
   */
  getRecordedCalls(): RecordedCall[] {
    return this.recordedCalls;
  }

  /**
   * Clear all recorded calls
   */
  clearRecordedCalls(): void {
    this.recordedCalls = [];
  }

  /**
   * Export recorded calls as WireMock mappings JSON
   */
  exportMappings(filename: string = 'wiremock-mappings.json'): void {
    const mappings = this.recordedCalls.map(call => this.convertToWireMockMapping(call));
    
    const mappingsFile = {
      mappings
    };

    const blob = new Blob([JSON.stringify(mappingsFile, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalRecorded: this.recordedCalls.length,
      byMethod: this.recordedCalls.reduce((acc, call) => {
        acc[call.request.method] = (acc[call.request.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStatus: this.recordedCalls.reduce((acc, call) => {
        const statusGroup = `${Math.floor(call.response.status / 100)}xx`;
        acc[statusGroup] = (acc[statusGroup] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgResponseTime: this.recordedCalls.length > 0
        ? this.recordedCalls.reduce((sum, call) => sum + call.responseTime, 0) / this.recordedCalls.length
        : 0
    };
  }
}

// Global singleton instance
export const selfHealingSandbox = new SelfHealingSandbox();

