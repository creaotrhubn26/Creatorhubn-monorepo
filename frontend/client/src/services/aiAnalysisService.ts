/**
 * AI Analysis Service for CreatorHub
 * Provides intelligent code analysis, insights, and recommendations
 */

export interface CodeAnalysisResult {
  quality: number;
  performance: number;
  maintainability: number;
  suggestions: string[];
  issues: CodeIssue[];
  metrics: AnalysisMetrics;
}

export interface CodeIssue {
  id: string;
  type: 'warning' | 'error' | 'suggestion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: number;
  column?: number;
  fix?: string;
}

export interface AnalysisMetrics {
  complexity: number;
  linesOfCode: number;
  testCoverage?: number;
  performance: number;
  securityScore: number;
}

export interface AIInsight {
  id: string;
  type: 'code_quality' | 'performance' | 'security' | 'maintainability';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  actionable: boolean;
  recommendations: string[];
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastError?: string;
  uptime: number;
  responseTime: number;
}

class AIAnalysisService {
  private baseUrl: string;
  private apiKey?: string;
  private isEnabled: boolean;

  constructor(baseUrl = '/api/ai-analysis', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.isEnabled = true;
  }

  /**
   * Analyze code for quality, performance, and security issues
   */
  async analyzeCode(code: string, language: string = 'typescript'): Promise<CodeAnalysisResult> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({
          code,
          language,
          options: {
            includeMetrics: true,
            includeSuggestions: true,
            includeSecurity: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Code analysis failed:', error);
      
      // Fallback: basic static analysis
      return this.performBasicAnalysis(code, language);
    }
  }

  /**
   * Get AI-generated insights for a project
   */
  async getInsights(projectId: string, context?: any): Promise<AIInsight[]> {
    try {
      const response = await fetch(`${this.baseUrl}/insights/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({ context })
      });

      if (!response.ok) {
        throw new Error(`Insights retrieval failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Insights generation failed:', error);
      
      // Fallback: basic insights
      return this.generateBasicInsights(projectId);
    }
  }

  /**
   * Analyze performance bottlenecks in code
   */
  async analyzePerformance(code: string, language: string = 'typescript'): Promise<{
    bottlenecks: any[];
    optimizations: string[];
    performanceScore: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({ code, language })
      });

      if (!response.ok) {
        throw new Error(`Performance analysis failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Performance analysis failed:', error);
      
      // Fallback: basic performance check
      return this.performBasicPerformanceAnalysis(code);
    }
  }

  /**
   * Generate code recommendations based on best practices
   */
  async generateRecommendations(code: string, context?: string): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify({ code, context })
      });

      if (!response.ok) {
        throw new Error(`Recommendations failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Recommendations generation failed:', error);
      
      // Fallback: basic recommendations
      return this.generateBasicRecommendations(code);
    }
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<ServiceHealth> {
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: { ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }) }
      });
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'degraded',
          uptime: 0,
          responseTime,
          lastError: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return {
        status: 'healthy',
        uptime: Date.now(),
        responseTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        uptime: 0,
        responseTime: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Basic static analysis as fallback
   */
  private performBasicAnalysis(code: string, language: string): CodeAnalysisResult {
    const lines = code.split('\n').length;
    const complexity = Math.min(lines / 50, 10); // Basic complexity calculation
    
    return {
      quality: Math.max(0, 1 - (complexity / 10)),
      performance: 0.8, // Basic default
      maintainability: 0.7, // Basic default
      suggestions: this.generateBasicRecommendations(code),
      issues: this.findBasicIssues(code),
      metrics: {
        complexity,
        linesOfCode: lines,
        performance: 0.8,
        securityScore: 0.7
      }
    };
  }

  private generateBasicInsights(projectId: string): AIInsight[] {
    return [
      {
        id: 'basic-quality',
        type: 'code_quality',
        title: 'Code Quality Assessment',
        description: 'Regular code reviews can improve maintainability',
        severity: 'info',
        actionable: true,
        recommendations: ['Add code comments', 'Implement consistent formatting', 'Add unit tests']
      },
      {
        id: 'basic-performance',
        type: 'performance',
        title: 'Performance Monitoring',
        description: 'Consider implementing performance monitoring',
        severity: 'warning',
        actionable: true,
        recommendations: ['Profile application performance', 'Optimize database queries', 'Implement caching']
      }
    ];
  }

  private performBasicPerformanceAnalysis(code: string): any {
    const slowPatterns = [
      /for\s*\(/g,
      /\s*\?\s*\./g, // Optional chaining
      /async\s+/g,
      /\.map\(/g
    ];

    const bottlenecks = [];
    const optimizations = [];

    slowPatterns.forEach((pattern) => {
      const matches = code.match(pattern);
      if (matches && matches.length > 3) {
        bottlenecks.push({
          pattern: pattern.toString(),
          count: matches.length,
          severity: 'medium'
        });
      }
    });

    if (bottlenecks.length === 0) {
      optimizations.push('Consider code splitting for better performance');
    }

    return {
      bottlenecks,
      optimizations,
      performanceScore: bottlenecks.length > 2 ? 0.6 : 0.9
    };
  }

  private generateBasicRecommendations(code: string): string[] {
    const recommendations = [];
    
    if (!code.includes('//') && !code.includes('/*')) {
      recommendations.push('Add code comments for better maintainability');
    }
    
    if (code.includes('.then(') && !code.includes('catch(')) {
      recommendations.push('Add error handling for promises');
    }
    
    if (code.includes('function') && code.length > 1000) {
      recommendations.push('Consider splitting large functions into smaller ones');
    }

    return recommendations.length > 0 ? recommendations : ['Code looks good! Consider adding tests'];
  }

  private findBasicIssues(code: string): CodeIssue[] {
    const issues = [];

    // Check for basic code patterns
    if (code.includes('console.log') && import.meta.env.PROD) {
      issues.push({
        id: 'console-',
        type: 'warning',
        severity: 'medium',
        message: 'Remove console.log statements in production',
        fix: 'Remove or replace with proper logging'
      });
    }

    if (code.includes('==') && !code.includes('===')) {
      issues.push({
        id: 'comparison-',
        type: 'suggestion',
        severity: 'low',
        message: 'Use strict equality (===) instead of loose equality (==)',
        fix: 'Replace == with ==='
      });
    }

    return issues;
}

  // Enable/disable service
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  get isServiceEnabled(): boolean {
    return this.isEnabled;
  }
}

// Create singleton instance
export const aiAnalysisService = new AIAnalysisService();

export default aiAnalysisService;







