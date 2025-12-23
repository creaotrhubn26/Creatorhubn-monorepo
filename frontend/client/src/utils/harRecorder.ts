/**
 * HAR (HTTP Archive) Recorder for WireMock Traffic
 * Records all API calls in HAR format for analysis and debugging
 */

import { emitWireMockEvent } from './wireMockEventEmitter';

export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: {};
  timings: {
    blocked: number;
    dns: number;
    connect: number;
    send: number;
    wait: number;
    receive: number;
    ssl: number;
  };
  serverIPAddress?: string;
  connection?: string;
}

export interface HARLog {
  version: string;
  creator: {
    name: string;
    version: string;
  };
  browser?: {
    name: string;
    version: string;
  };
  pages: Array<{
    startedDateTime: string;
    id: string;
    title: string;
    pageTimings: {
      onContentLoad: number;
      onLoad: number;
    };
  }>;
  entries: HAREntry[];
}

export interface HAR {
  log: HARLog;
}

export class HARRecorder {
  private entries: HAREntry[] = [];
  private startTime: Date = new Date();

  /**
   * Record a new HTTP request/response
   */
  recordEntry(
    method: string,
    url: string,
    requestHeaders: Record<string, string>,
    requestBody: any,
    responseStatus: number,
    responseStatusText: string,
    responseHeaders: Record<string, string>,
    responseBody: any,
    timings: {
      startTime: number;
      endTime: number;
      dnsTime?: number;
      connectTime?: number;
      sslTime?: number;
    }
  ): void {
    const totalTime = timings.endTime - timings.startTime;

    const entry: HAREntry = {
      startedDateTime: new Date(timings.startTime).toISOString(),
      time: totalTime,
      request: {
        method,
        url,
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(requestHeaders).map(([name, value]) => ({ name, value })),
        queryString: this.parseQueryString(url),
        postData: requestBody ? {
          mimeType: requestHeaders['Content-Type'] || 'application/json',
          text: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody)
        } : undefined,
        headersSize: this.calculateHeadersSize(requestHeaders),
        bodySize: requestBody ? JSON.stringify(requestBody).length : 0
      },
      response: {
        status: responseStatus,
        statusText: responseStatusText,
        httpVersion: 'HTTP/1.1',
        headers: Object.entries(responseHeaders).map(([name, value]) => ({ name, value })),
        content: {
          size: responseBody ? JSON.stringify(responseBody).length : 0,
          mimeType: responseHeaders['Content-Type'] || 'application/json',
          text: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)
        },
        redirectURL: '',
        headersSize: this.calculateHeadersSize(responseHeaders),
        bodySize: responseBody ? JSON.stringify(responseBody).length : 0
      },
      cache: {},
      timings: {
        blocked: 0,
        dns: timings.dnsTime || 0,
        connect: timings.connectTime || 0,
        send: 1,
        wait: totalTime - 2,
        receive: 1,
        ssl: timings.sslTime || 0
      }
    };

    this.entries.push(entry);

    // Emit event for real-time updates (Gap 7 fix)
    emitWireMockEvent.harRecorded(entry);
  }

  /**
   * Get the complete HAR object
   */
  getHAR(): HAR {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'CreatorHub WireMock Sandbox',
          version: '1.0.0'
        },
        browser: {
          name: 'Chrome',
          version: '120.0'
        },
        pages: [{
          startedDateTime: this.startTime.toISOString(),
          id: 'page_1',
          title: 'WireMock API Tests',
          pageTimings: {
            onContentLoad: 0,
            onLoad: 0
          }
        }],
        entries: this.entries
      }
    };
  }

  /**
   * Export HAR as JSON file
   */
  exportHAR(filename: string = 'wiremock-traffic.har'): void {
    const har = this.getHAR();
    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all recorded entries
   */
  clear(): void {
    this.entries = [];
    this.startTime = new Date();
  }

  /**
   * Get all entries
   */
  getEntries(): HAREntry[] {
    return this.entries;
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalRequests = this.entries.length;
    const totalTime = this.entries.reduce((sum, e) => sum + e.time, 0);
    const totalSize = this.entries.reduce((sum, e) => sum + e.response.content.size, 0);
    const avgTime = totalRequests > 0 ? totalTime / totalRequests : 0;

    return {
      totalRequests,
      totalTime,
      totalSize,
      avgTime,
      successCount: this.entries.filter(e => e.response.status >= 200 && e.response.status < 300).length,
      errorCount: this.entries.filter(e => e.response.status >= 400).length
    };
  }

  private parseQueryString(url: string): Array<{ name: string; value: string }> {
    try {
      const urlObj = new URL(url, 'http://localhost');
      return Array.from(urlObj.searchParams.entries()).map(([name, value]) => ({ name, value }));
    } catch {
      return [];
    }
  }

  private calculateHeadersSize(headers: Record<string, string>): number {
    return Object.entries(headers).reduce((sum, [key, value]) => {
      return sum + key.length + value.length + 4; // +4 for ":" and"\r\n"
    }, 0);
  }
}

// Global singleton instance
export const harRecorder = new HARRecorder();

