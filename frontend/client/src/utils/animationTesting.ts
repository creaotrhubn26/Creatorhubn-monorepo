/**
 * Animation Testing Utilities
 * Accessibility, performance, and user experience testing for animations
 */

import type { Animation } from './animationManager';

export interface AccessibilityTestResult {
  testName: string;
  passed: boolean;
  issues: string[];
  recommendations: string[];
  wcagLevel: 'AAA' | 'AA' | 'A' | 'Fail';
}

export interface PerformanceTestResult {
  testName: string;
  passed: boolean;
  metrics: {
    fps: number;
    frameDrops: number;
    memoryUsage: number;
    jankScore: number;
  };
  threshold: any;
}

export interface UserExperienceMetrics {
  taskCompletionTime: number;
  errorRate: number;
  userSatisfaction: number;
  perceivedResponsiveness: number;
}

/**
 * Accessibility Test Suite
 */
export class AnimationAccessibilityTester {
  /**
   * Test for WCAG 2.2.2 compliance (Pause, Stop, Hide)
   */
  static testPauseStopHide(animation: Animation): AccessibilityTestResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check duration for auto-playing animations
    if (animation.duration > 5000) {
      if (animation.iterationCount === 'infinite' || animation.iterationCount > 1) {
        issues.push('Animation lasts > 5 seconds and auto-plays - must be pausable');
        recommendations.push('Add pause/stop controls or reduce duration to < 5 seconds');
      }
    }

    const passed = issues.length === 0;
    const wcagLevel: 'AAA' | 'AA' | 'A' | 'Fail' = passed ? 'AAA' : 'Fail';

    return {
      testName: 'WCAG 2.2.2 - Pause, Stop, Hide',
      passed,
      issues,
      recommendations,
      wcagLevel
    };
  }

  /**
   * Test for WCAG 2.3.1 compliance (Three Flashes)
   */
  static testThreeFlashes(animation: Animation): AccessibilityTestResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const flashesPerSecond = animation.keyframes.length / (animation.duration / 1000);
    
    if (flashesPerSecond > 3) {
      issues.push(`Animation has ${flashesPerSecond.toFixed(1)} flashes per second (max: 3)`);
      recommendations.push('Reduce keyframes or increase duration to stay below 3 flashes/second');
    }

    const passed = issues.length === 0;
    const wcagLevel: 'AAA' | 'AA' | 'A' | 'Fail' = passed ? 'AAA' : 'Fail';

    return {
      testName: 'WCAG 2.3.1 - Three Flashes or Below',
      passed,
      issues,
      recommendations,
      wcagLevel
    };
  }

  /**
   * Test for reduced motion support
   */
  static testReducedMotionSupport(): AccessibilityTestResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check if mediaQuery API is available
    if (typeof window === 'undefined' || !window.matchMedia) {
      issues.push('matchMedia API not available');
      recommendations.push('Add polyfill or fallback for reduced motion detection');
    } else {
      try {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (!mediaQuery) {
          issues.push('prefers-reduced-motion media query not supported');
        }
      } catch (error) {
        issues.push('Error detecting motion preference: ' + error);
      }
    }

    const passed = issues.length === 0;
    const wcagLevel: 'AAA' | 'AA' | 'A' | 'Fail' = passed ? 'AAA' : 'Fail';

    return {
      testName: 'WCAG 2.3.3 - Reduced Motion Support',
      passed,
      issues,
      recommendations,
      wcagLevel
    };
  }

  /**
   * Run full accessibility audit
   */
  static runFullAudit(animations: Animation[]): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];

    // Test system support
    results.push(this.testReducedMotionSupport());

    // Test each animation
    animations.forEach(animation => {
      results.push(this.testPauseStopHide(animation));
      results.push(this.testThreeFlashes(animation));
    });

    return results;
  }
}

/**
 * Performance Test Suite
 */
export class AnimationPerformanceTester {
  private startTime: number = 0;
  private frameCount: number = 0;
  private frameTimes: number[] = [];

  /**
   * Test FPS during animation
   */
  testFPS(duration: number = 1000): Promise<PerformanceTestResult> {
    return new Promise((resolve) => {
      this.startTime = performance.now();
      this.frameCount = 0;
      this.frameTimes = [];

      const measureFrame = () => {
        const currentTime = performance.now();
        const elapsed = currentTime - this.startTime;
        
        if (elapsed < duration) {
          this.frameCount++;
          this.frameTimes.push(currentTime);
          requestAnimationFrame(measureFrame);
        } else {
          // Calculate results
          const fps = (this.frameCount / duration) * 1000;
          const frameDrops = this.frameTimes.filter((time, i) => {
            if (i === 0) return false;
            const delta = time - this.frameTimes[i - 1];
            return delta > 16.67; // Dropped frame
          }).length;

          // Calculate jank
          const avgDelta = duration / this.frameCount;
          const variance = this.frameTimes.reduce((sum, time, i) => {
            if (i === 0) return 0;
            const delta = time - this.frameTimes[i - 1];
            const diff = delta - avgDelta;
            return sum + (diff * diff);
          }, 0) / this.frameCount;
          const jankScore = Math.sqrt(variance);

          const passed = fps >= 55 && frameDrops < 5 && jankScore < 20;

          resolve({
            testName: 'FPS Performance Test',
            passed,
            metrics: {
              fps: Math.round(fps),
              frameDrops,
              memoryUsage: 0, // Placeholder
              jankScore: Math.round(jankScore)
            },
            threshold: {
              minFPS: 55,
              maxFrameDrops: 5,
              maxJank: 20
            }
          });
        }
      };

      requestAnimationFrame(measureFrame);
    });
  }

  /**
   * Test memory usage during animation
   */
  testMemoryUsage(): PerformanceTestResult {
    let memoryUsage = 0;
    
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        memoryUsage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
      }
    }

    const passed = memoryUsage < 80;

    return {
      testName: 'Memory Usage Test',
      passed,
      metrics: {
        fps: 0,
        frameDrops: 0,
        memoryUsage: Math.round(memoryUsage),
        jankScore: 0
      },
      threshold: {
        maxMemoryUsage: 80
      }
    };
  }

  /**
   * Test GPU acceleration
   */
  testGPUAcceleration(): boolean {
    const testElement = document.createElement('div');
    testElement.style.transform = 'translateZ(0)';
    document.body.appendChild(testElement);
    
    const computedStyle = window.getComputedStyle(testElement);
    const hasTransform = computedStyle.transform !== 'none';
    
    document.body.removeChild(testElement);
    return hasTransform;
  }
}

/**
 * User Experience Test Suite
 */
export class AnimationUXTester {
  /**
   * Measure task completion time
   */
  static measureTaskCompletion(
    taskFn: () => Promise<void>
  ): Promise<{ duration: number; success: boolean }> {
    const startTime = performance.now();
    
    return taskFn()
      .then(() => ({
        duration: performance.now() - startTime,
        success: true
      }))
      .catch(() => ({
        duration: performance.now() - startTime,
        success: false
      }));
  }

  /**
   * Calculate perceived responsiveness score
   * Based on animation durations and feedback timing
   */
  static calculateResponsiveness(
    interactionTime: number,
    feedbackDelay: number
  ): number {
    // Research: < 100ms feels instant, 100-200ms feels responsive, > 200ms feels slow
    if (feedbackDelay < 100) return 100;
    if (feedbackDelay < 200) return 85;
    if (feedbackDelay < 300) return 70;
    if (feedbackDelay < 500) return 50;
    return 30;
  }

  /**
   * Compare metrics before/after animation implementation
   */
  static compareMetrics(
    before: UserExperienceMetrics,
    after: UserExperienceMetrics
  ): {
    improvements: Record<string, string>;
    regressions: Record<string, string>;
    summary: string;
  } {
    const improvements: Record<string, string> = {};
    const regressions: Record<string, string> = {};

    // Task completion time
    const timeImprovement = ((before.taskCompletionTime - after.taskCompletionTime) / before.taskCompletionTime) * 100;
    if (timeImprovement > 0) {
      improvements.taskCompletionTime = `${timeImprovement.toFixed(1)}% faster`;
    } else if (timeImprovement < 0) {
      regressions.taskCompletionTime = `${Math.abs(timeImprovement).toFixed(1)}% slower`;
    }

    // Error rate
    const errorImprovement = ((before.errorRate - after.errorRate) / before.errorRate) * 100;
    if (errorImprovement > 0) {
      improvements.errorRate = `${errorImprovement.toFixed(1)}% fewer errors`;
    } else if (errorImprovement < 0) {
      regressions.errorRate = `${Math.abs(errorImprovement).toFixed(1)}% more errors`;
    }

    // User satisfaction
    const satisfactionImprovement = ((after.userSatisfaction - before.userSatisfaction) / before.userSatisfaction) * 100;
    if (satisfactionImprovement > 0) {
      improvements.userSatisfaction = `${satisfactionImprovement.toFixed(1)}% increase`;
    } else if (satisfactionImprovement < 0) {
      regressions.userSatisfaction = `${Math.abs(satisfactionImprovement).toFixed(1)}% decrease`;
    }

    // Perceived responsiveness
    const responsivenessImprovement = ((after.perceivedResponsiveness - before.perceivedResponsiveness) / before.perceivedResponsiveness) * 100;
    if (responsivenessImprovement > 0) {
      improvements.perceivedResponsiveness = `${responsivenessImprovement.toFixed(1)}% improvement`;
    }

    const summary = Object.keys(improvements).length > Object.keys(regressions).length
      ? 'Overall improvement in user experience metrics'
      : 'Some metrics show regression - review implementation';

    return {
      improvements,
      regressions,
      summary
    };
  }
}

/**
 * Test runner for comprehensive animation testing
 */
export class AnimationTestRunner {
  /**
   * Run all tests
   */
  static async runAllTests(animations: Animation[]): Promise<{
    accessibility: AccessibilityTestResult[];
    performance: PerformanceTestResult[];
    summary: {
      totalTests: number;
      passed: number;
      failed: number;
      wcagCompliance: boolean;
      performanceGood: boolean;
    };
  }> {
    // Run accessibility tests
    const accessibility = AnimationAccessibilityTester.runFullAudit(animations);

    // Run performance tests
    const perfTester = new AnimationPerformanceTester();
    const fpsTest = await perfTester.testFPS(1000);
    const memoryTest = perfTester.testMemoryUsage();
    const performance = [fpsTest, memoryTest];

    // Calculate summary
    const allTests = [...accessibility, ...performance];
    const passed = allTests.filter(t => t.passed).length;
    const failed = allTests.length - passed;
    const wcagCompliance = accessibility.every(t => t.passed);
    const performanceGood = performance.every(t => t.passed);

    return {
      accessibility,
      performance,
      summary: {
        totalTests: allTests.length,
        passed,
        failed,
        wcagCompliance,
        performanceGood
      }
    };
  }
}

export default AnimationTestRunner;














