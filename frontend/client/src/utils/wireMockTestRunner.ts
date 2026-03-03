import { WireMockTestResult } from '../components/admin/WireMockResponseViewer';
import { harRecorder } from './harRecorder';
import { selfHealingSandbox } from './selfHealingSandbox';
import { emitWireMockEvent } from './wireMockEventEmitter';

export interface WireMockTestConfig {
  apiName: string;
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  recordToHAR?: boolean;
  enableSelfHealing?: boolean;
}

export class WireMockTestRunner {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  /**
   * Execute a WireMock test with comprehensive error handling and timing
   */
  static async executeTest(
    config: WireMockTestConfig
  ): Promise<Omit<WireMockTestResult, 'id' | 'timestamp'>> {
    const startTime = performance.now();
    const method = config.method || 'POST';

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        config.timeout || this.DEFAULT_TIMEOUT
      );

      // Execute the request
      const response = await fetch(config.endpoint, {
        method,
        headers: {
          'Content-Type' : 'application/json',
          ...config.headers
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      // Parse response
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      // Record to HAR if enabled (default: true)
      if (config.recordToHAR !== false) {
        harRecorder.recordEntry(
          method,
          config.endpoint,
          config.headers || {},
          config.body,
          response.status,
          response.statusText,
          responseHeaders,
          responseBody,
          {
            startTime,
            endTime
          }
        );
      }

      // Record to self-healing sandbox if enabled
      if (config.enableSelfHealing) {
        selfHealingSandbox.recordCall(
          method,
          config.endpoint,
          config.headers || {},
          config.body,
          response.status,
          response.statusText,
          responseHeaders,
          responseBody,
          responseTime
        );
      }

      // Determine success based on status code
      const isSuccess = response.status >= 200 && response.status < 300;

      const result: Omit<WireMockTestResult, 'id' | 'timestamp'> = {
        apiName: config.apiName,
        endpoint: config.endpoint,
        method,
        status: isSuccess ? 'success' : 'error',
        statusCode: response.status,
        responseTime,
        request: {
          headers: config.headers,
          body: config.body
        },
        response: {
          headers: responseHeaders,
          body: responseBody
        },
        ...(isSuccess ? {} : {
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            type: 'HTTP_ERROR'
          }
        })
      };

      // Emit test executed event (Gap 7 fix)
      emitWireMockEvent.testExecuted(result);

      return result;
    } catch (error: any) {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      // Categorize the error
      let errorType = 'UNKNOWN_ERROR';
      let errorMessage = error.message || 'Unknown error occurred';

      if (error.name === 'AbortError') {
        errorType = 'TIMEOUT';
        errorMessage = `Request timed out after ${config.timeout || this.DEFAULT_TIMEOUT}ms`;
      } else if (error.message?.includes('Failed to fetch')) {
        errorType = 'NETWORK_ERROR';
        errorMessage = 'Network error: Could not reach the endpoint. Check if WireMock is running.';
      } else if (error.message?.includes('CORS')) {
        errorType = 'CORS_ERROR';
        errorMessage = 'CORS error: Cross-origin request blocked';
      }

      return {
        apiName: config.apiName,
        endpoint: config.endpoint,
        method,
        status: 'error',
        responseTime,
        request: {
          headers: config.headers,
          body: config.body
        },
        error: {
          message: errorMessage,
          type: errorType,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Execute multiple tests in parallel
   */
  static async executeBulkTests(
    configs: WireMockTestConfig[]
  ): Promise<Array<Omit<WireMockTestResult, 'id' | 'timestamp'>>> {
    const promises = configs.map(config => this.executeTest(config));
    return Promise.all(promises);
  }

  /**
   * Execute tests sequentially with delay between each
   */
  static async executeSequentialTests(
    configs: WireMockTestConfig[],
    delayMs: number = 500
  ): Promise<Array<Omit<WireMockTestResult, 'id' | 'timestamp'>>> {
    const results: Array<Omit<WireMockTestResult, 'id' | 'timestamp'>> = [];

    for (const config of configs) {
      const result = await this.executeTest(config);
      results.push(result);
      
      // Add delay between tests (except after the last one)
      if (config !== configs[configs.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}
