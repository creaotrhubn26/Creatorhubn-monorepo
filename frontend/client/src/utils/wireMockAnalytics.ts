/**
 * WireMock Analytics Aggregation Utility
 * 
 * Computes analytics from test history data without requiring a backend endpoint.
 * This solves Gap 6 by aggregating data client-side from the test history.
 */

export interface WireMockTestResult {
  apiName: string;
  success: boolean;
  responseTime: number;
  statusCode: number;
  timestamp: string;
  requestDetails: {
    method: string;
    endpoint: string;
    headers?: Record<string, string>;
    body?: any;
  };
  responseDetails: {
    body: any;
    headers: Record<string, string>;
  };
  error?: string;
}

export interface EndpointAnalytics {
  name: string;
  hitCount: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  totalDataTransferred: number;
  lastTested: string;
  successRate: number;
  errorRate: number;
}

export interface AggregatedAnalytics {
  endpoints: EndpointAnalytics[];
  totalTests: number;
  totalSuccesses: number;
  totalErrors: number;
  overallSuccessRate: number;
  avgResponseTime: number;
  totalDataTransferred: number;
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Aggregate analytics from test history
 */
export function aggregateAnalytics(testHistory: WireMockTestResult[]): AggregatedAnalytics {
  if (testHistory.length === 0) {
    return {
      endpoints: [],
      totalTests: 0,
      totalSuccesses: 0,
      totalErrors: 0,
      overallSuccessRate: 0,
      avgResponseTime: 0,
      totalDataTransferred: 0,
      timeRange: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
      },
    };
  }

  // Group by endpoint/API name
  const endpointMap = new Map<string, WireMockTestResult[]>();
  
  testHistory.forEach(result => {
    const key = result.apiName;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, []);
    }
    endpointMap.get(key)!.push(result);
  });

  // Compute per-endpoint analytics
  const endpoints: EndpointAnalytics[] = Array.from(endpointMap.entries()).map(([name, results]) => {
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;
    const responseTimes = results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Estimate data transferred (rough approximation based on response body size)
    const totalDataTransferred = results.reduce((total, result) => {
      const bodySize = JSON.stringify(result.responseDetails?.body || {}).length;
      return total + bodySize;
    }, 0);

    return {
      name,
      hitCount: results.length,
      successCount,
      errorCount,
      avgResponseTime: Math.round(avgResponseTime),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      totalDataTransferred,
      lastTested: results[0].timestamp, // Most recent (assuming sorted)
      successRate: (successCount / results.length) * 100,
      errorRate: (errorCount / results.length) * 100,
    };
  });

  // Sort by hit count descending
  endpoints.sort((a, b) => b.hitCount - a.hitCount);

  // Compute overall statistics
  const totalTests = testHistory.length;
  const totalSuccesses = testHistory.filter(r => r.success).length;
  const totalErrors = totalTests - totalSuccesses;
  const overallSuccessRate = (totalSuccesses / totalTests) * 100;
  const avgResponseTime = Math.round(
    testHistory.reduce((sum, r) => sum + r.responseTime, 0) / totalTests
  );
  const totalDataTransferred = endpoints.reduce((sum, e) => sum + e.totalDataTransferred, 0);

  // Time range
  const timestamps = testHistory.map(r => new Date(r.timestamp).getTime());
  const start = new Date(Math.min(...timestamps)).toISOString();
  const end = new Date(Math.max(...timestamps)).toISOString();

  return {
    endpoints,
    totalTests,
    totalSuccesses,
    totalErrors,
    overallSuccessRate,
    avgResponseTime,
    totalDataTransferred,
    timeRange: { start, end },
  };
}

/**
 * Get analytics for a specific endpoint
 */
export function getEndpointAnalytics(
  testHistory: WireMockTestResult[],
  apiName: string
): EndpointAnalytics | null {
  const analytics = aggregateAnalytics(testHistory);
  return analytics.endpoints.find(e => e.name === apiName) || null;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

