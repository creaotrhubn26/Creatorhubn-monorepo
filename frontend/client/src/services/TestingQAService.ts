// @ts-nocheck
/**
 * Testing & Quality Assurance Service
 * Visual regression, accessibility, performance monitoring, and device preview
 */

export interface TestSuite {
  id: string;
  name: string;
  type: 'visual' | 'accessibility' | 'performance' | 'responsive';
  status: 'pending' | 'running' | 'passed' | 'failed';
  results?: TestResults;
  timestamp: number;
}

export interface TestResults {
  passed: number;
  failed: number;
  warnings: number;
  duration: number;
  tests: TestCase[];
}

export interface TestCase {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
  screenshot?: string;
}

export interface VisualRegressionTest {
  baseline: string; // Base64 screenshot
  current: string; // Current screenshot
  diff?: string; // Diff image
  pixelDifference: number;
  percentDifference: number;
  passed: boolean;
}

export interface AccessibilityTest {
  wcagLevel: 'A' | 'AA' | 'AAA';
  violations: AccessibilityViolation[];
  passed: boolean;
  score: number;
}

export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

export interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  tti: number; // Time to Interactive
  score: number;
}

export interface DevicePreview {
  device: 'mobile' | 'tablet' | 'desktop' | 'wide';
  width: number;
  height: number;
  userAgent: string;
  screenshot?: string;
}

export class TestingQAService {
  private testSuites: Map<string, TestSuite> = new Map();
  private baselines: Map<string, string> = new Map();

  /**
   * Run visual regression test
   */
  async runVisualRegressionTest(
    elementId: string,
    screenshotData: string,
  ): Promise<VisualRegressionTest> {
    const baselineKey = `visual-${elementId}`;
    const baseline = this.baselines.get(baselineKey);

    if (!baseline) {
      // First run - save as baseline
      this.baselines.set(baselineKey, screenshotData);
      return {
        baseline: screenshotData,
        current: screenshotData,
        pixelDifference: 0,
        percentDifference: 0,
        passed: true,
      };
    }

    // Compare with baseline
    const comparison = await this.compareImages(baseline, screenshotData);

    return {
      baseline,
      current: screenshotData,
      diff: comparison.diff,
      pixelDifference: comparison.pixelDiff,
      percentDifference: comparison.percentDiff,
      passed: comparison.percentDiff < 5, // 5% threshold
    };
  }

  /**
   * Compare two images
   */
  private async compareImages(
    image1: string,
    image2: string,
  ): Promise<{ diff: string; pixelDiff: number; percentDiff: number }> {
    // This would use a library like pixelmatch or resemblejs
    // Simplified for now
    return {
      diff: image1, // Would be actual diff image
      pixelDiff: 0,
      percentDiff: 0,
    };
  }

  /**
   * Run accessibility tests
   */
  async runAccessibilityTest(
    html: string,
    wcagLevel: 'A' | 'AA' | 'AAA' = 'AA',
  ): Promise<AccessibilityTest> {
    // This would use axe-core or similar
    const violations: AccessibilityViolation[] = [];

    // Check for common issues
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Check images without alt
    const images = doc.querySelectorAll('img:not([alt])');
    if (images.length > 0) {
      violations.push({
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternative text',
        help: 'Add alt attributes to all images',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content',
        nodes: Array.from(images).map((img) => ({
          html: img.outerHTML,
          target: ['img'],
          failureSummary: 'Missing alt attribute',
        })),
      });
    }

    // Check buttons without labels
    const buttonsWithoutLabel = doc.querySelectorAll('button:not([aria-label]):empty');
    if (buttonsWithoutLabel.length > 0) {
      violations.push({
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text',
        help: 'Add text content or aria-label to buttons',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value',
        nodes: Array.from(buttonsWithoutLabel).map((btn) => ({
          html: btn.outerHTML,
          target: ['button'],
          failureSummary: 'Button has no accessible name',
        })),
      });
    }

    // Check heading hierarchy
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1]);
      if (level - lastLevel > 1) {
        violations.push({
          id: 'heading-order',
          impact: 'moderate',
          description: 'Heading levels should increase by one',
          help: 'Ensure proper heading hierarchy',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships',
          nodes: [
            {
              html: heading.outerHTML,
              target: [heading.tagName.toLowerCase()],
              failureSummary: 'Heading skips levels',
            },
          ],
        });
      }
      lastLevel = level;
    });

    // Calculate score
    const criticalViolations = violations.filter((v) => v.impact === 'critical').length;
    const seriousViolations = violations.filter((v) => v.impact === 'serious').length;
    const score = Math.max(0, 100 - criticalViolations * 20 - seriousViolations * 10);

    return {
      wcagLevel,
      violations,
      passed: violations.filter((v) => v.impact === 'critical').length === 0,
      score,
    };
  }

  /**
   * Monitor performance metrics
   */
  async monitorPerformance(): Promise<PerformanceMetrics> {
    if (!window.performance) {
      return {
        fcp: 0,
        lcp: 0,
        fid: 0,
        cls: 0,
        ttfb: 0,
        tti: 0,
        score: 0,
      };
    }

    // Get performance entries
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    const fcp = paint.find((p) => p.name === 'first-contentful-paint')?.startTime || 0;
    const ttfb = navigation?.responseStart - navigation?.requestStart || 0;

    // Web Vitals (would use web-vitals library in production)
    const lcp = await this.measureLCP();
    const fid = await this.measureFID();
    const cls = await this.measureCLS();
    const tti = await this.measureTTI();

    // Calculate performance score (Google Lighthouse-style)
    const score = this.calculatePerformanceScore({
      fcp,
      lcp,
      fid,
      cls,
      ttfb,
      tti,
    });

    return {
      fcp,
      lcp,
      fid,
      cls,
      ttfb,
      tti,
      score,
    };
  }

  /**
   * Measure Largest Contentful Paint
   */
  private async measureLCP(): Promise<number> {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.startTime);
          observer.disconnect();
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });

        // Timeout after 10 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 10000);
      } else {
        resolve(0);
      }
    });
  }

  /**
   * Measure First Input Delay
   */
  private async measureFID(): Promise<number> {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const firstInput = entries[0] as any;
          resolve(firstInput.processingStart - firstInput.startTime);
          observer.disconnect();
        });
        observer.observe({ entryTypes: ['first-input'] });

        // Timeout after 30 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 30000);
      } else {
        resolve(0);
      }
    });
  }

  /**
   * Measure Cumulative Layout Shift
   */
  private async measureCLS(): Promise<number> {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });
        observer.observe({ entryTypes: ['layout-shift'] });

        // Measure for 5 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 5000);
      } else {
        resolve(0);
      }
    });
  }

  /**
   * Measure Time to Interactive
   */
  private async measureTTI(): Promise<number> {
    // Simplified TTI calculation
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navigation?.domInteractive || 0;
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(metrics: Omit<PerformanceMetrics, 'score, '>): number {
    const weights = {
      fcp: 0.15,
      lcp: 0.25,
      fid: 0.15,
      cls: 0.15,
      ttfb: 0.15,
      tti: 0.15,
    };

    const scores = {
      fcp: this.scoreMetric(metrics.fcp, [1800, 3000]),
      lcp: this.scoreMetric(metrics.lcp, [2500, 4000]),
      fid: this.scoreMetric(metrics.fid, [100, 300]),
      cls: this.scoreMetric(metrics.cls, [0.1, 0.25]),
      ttfb: this.scoreMetric(metrics.ttfb, [800, 1800]),
      tti: this.scoreMetric(metrics.tti, [3800, 7300]),
    };

    let totalScore = 0;
    for (const [key, weight] of Object.entries(weights)) {
      totalScore += scores[key as keyof typeof scores] * weight;
    }

    return Math.round(totalScore);
  }

  /**
   * Score individual metric
   */
  private scoreMetric(value: number, thresholds: [number, number]): number {
    const [good, poor] = thresholds;
    if (value <= good) return 100;
    if (value >= poor) return 0;
    return Math.round(100 - ((value - good) / (poor - good)) * 100);
  }

  /**
   * Generate device previews
   */
  async generateDevicePreviews(html: string): Promise<DevicePreview[]> {
    const devices: DevicePreview[] = [
      {
        device: 'mobile',
        width: 375,
        height: 667,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
      },
      {
        device: 'tablet',
        width: 768,
        height: 1024,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
      },
      {
        device: 'desktop',
        width: 1440,
        height: 900,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      {
        device: 'wide',
        width: 1920,
        height: 1080,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    ];

    // Generate screenshots for each device (would use puppeteer or similar)
    for (const device of devices) {
      device.screenshot = await this.captureScreenshot(html, device.width, device.height);
    }

    return devices;
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(html: string, width: number, height: number): Promise<string> {
    // This would use puppeteer or html2canvas
    // Simplified for now
    return 'data:image/png;base64,....';
  }

  /**
   * Run complete test suite
   */
  async runTestSuite(name: string, html: string, elementId?: string): Promise<TestSuite> {
    const suiteId = `suite-${Date.now()}`;

    const suite: TestSuite = {
      id: suiteId,
      name,
      type: 'accessibility',
      status: 'running',
      timestamp: Date.now(),
    };

    this.testSuites.set(suiteId, suite);

    try {
      const tests: TestCase[] = [];

      // Run accessibility tests
      const a11yResults = await this.runAccessibilityTest(html);
      tests.push({
        id: 'accessibility',
        name: 'Accessibility Test',
        status: a11yResults.passed ? 'passed' : 'failed',
        message: `${a11yResults.violations.length} violations found`,
        details: a11yResults,
      });

      // Run performance tests
      const perfResults = await this.monitorPerformance();
      tests.push({
        id: 'performance',
        name: 'Performance Test',
        status: perfResults.score >= 70 ? 'passed' : 'warning',
        message: `Performance score: ${perfResults.score}`,
        details: perfResults,
      });

      // Run visual regression if elementId provided
      if (elementId) {
        const screenshot = await this.captureScreenshot(html, 1440, 900);
        const visualResults = await this.runVisualRegressionTest(elementId, screenshot);
        tests.push({
          id: 'visual-regression',
          name: 'Visual Regression Test',
          status: visualResults.passed ? 'passed' : 'failed',
          message: `${visualResults.percentDifference.toFixed(2)}% difference`,
          details: visualResults,
        });
      }

      const results: TestResults = {
        passed: tests.filter((t) => t.status === 'passed').length,
        failed: tests.filter((t) => t.status === 'failed').length,
        warnings: tests.filter((t) => t.status === 'warning').length,
        duration: Date.now() - suite.timestamp,
        tests,
      };

      suite.results = results;
      suite.status = results.failed > 0 ? 'failed' : 'passed';
    } catch (error) {
      suite.status = 'failed';
      console.error('Test suite failed: ', error);
    }

    this.testSuites.set(suiteId, suite);
    return suite;
  }

  /**
   * Get test suite results
   */
  getTestSuite(id: string): TestSuite | undefined {
    return this.testSuites.get(id);
  }

  /**
   * Get all test suites
   */
  getAllTestSuites(): TestSuite[] {
    return Array.from(this.testSuites.values());
  }

  /**
   * Clear test history
   */
  clearTestHistory(): void {
    this.testSuites.clear();
  }

  /**
   * Update baseline
   */
  updateBaseline(elementId: string, screenshot: string): void {
    this.baselines.set(`visual-${elementId}`, screenshot);
  }

  /**
   * Export test results
   */
  exportResults(format: 'json' | 'html' | 'csv' = 'json'): string {
    const suites = this.getAllTestSuites();

    switch (format) {
      case 'json':
        return JSON.stringify(suites, null, 2);
      case 'html':
        return this.generateHTMLReport(suites);
      case 'csv':
        return this.generateCSVReport(suites);
      default:
        return ', ';
    }
  }

  /**
   * Generate HTML report
   */
  private generateHTMLReport(suites: TestSuite[]): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .passed { color: green; }
    .failed { color: red; }
    .warning { color: orange; }
  </style>
</head>
<body>
  <h1>Test Report</h1>
  ${suites
    .map(
      (suite) => `
    <div class="suite">
      <h2>${suite.name} - <span class="${suite.status}">${suite.status}</span></h2>
      <p>Tests: ${suite.results?.tests.length || 0}</p>
      <ul>
        ${
          suite.results?.tests
            .map(
              (test) => `
          <li class="${test.status}">${test.name}: ${test.message}</li>
        `,
            )
            .join(', ') || ', '
        }
      </ul>
    </div>
  `,
    )
    .join('')}
</body>
</html>
    `;
  }

  /**
   * Generate CSV report
   */
  private generateCSVReport(suites: TestSuite[]): string {
    let csv ='Suite,Test,Status,Message\n';
    suites.forEach((suite) => {
      suite.results?.tests.forEach((test) => {
        csv += `"${suite.name}""${test.name}","${test.status}""${test.message}"\n`;
      });
    });
    return csv;
  }
}

// Singleton instance
export const testingQAService = new TestingQAService();
