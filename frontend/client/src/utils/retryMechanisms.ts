// @ts-nocheck
/**
 * Retry Mechanisms for Failed Operations
 * Implements intelligent retry strategies for failed operations
 */

import React from 'react';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  backoffMultiplier: number; // Exponential backoff multiplier
  jitter: boolean; // Add random jitter to prevent thundering herd
  retryCondition: (error: any) => boolean; // Function to determine if retry should happen
  onRetry?: (attempt: number, error: any) => void; // Callback before each retry
  onMaxAttemptsReached?: (error: any) => void; // Callback when max attempts reached
  timeout?: number; // Timeout for each attempt
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
  totalTime: number;
  lastError?: any
}

export interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryTime: number;
  retrySuccessRate: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
}

export interface RetryableOperation<T> {
  operation: () => Promise<T>;
  config: RetryConfig;
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  metadata?: Record<string, any>;
}

class RetryManager {
  private operations: Map<string, RetryableOperation<any>> = new Map();
  private stats: RetryStats = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryTime: 0,
    retrySuccessRate: 0,
    mostCommonErrors: []
};
  private errorCounts: Map<string, number> = new Map();
  private retryTimes: number[] = [];

  // Default retry configurations
  private defaultConfigs: Record<string, Partial<RetryConfig>> = {
    network: {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error) => {
        const errorString = error?.message || error?.toString() || '';
        return /network|timeout|connection|fetch/i.test(errorString);
  }
  },
    api: {
      maxAttempts: 5,
      baseDelay: 50,
      maxDelay: 500,
      backoffMultiplier: 1.5,
      jitter: true,
      retryCondition: (error) => {
        const status = error?.status || error?.response?.status;
        return status >= 500 || status === 429; // Server errors and rate limiting
  }
  },
    file_upload: {
      maxAttempts: 2,
      baseDelay: 200,
      maxDelay: 800,
      backoffMultiplier: 2,
      jitter: false,
      retryCondition: (error) => {
        const errorString = error?.message || error?.toString() || '';
        return /network|timeout|connection/i.test(errorString);
  }
  },
    critical: {
      maxAttempts: 10,
      baseDelay: 100,
      maxDelay: 3000,
      backoffMultiplier: 1.8,
      jitter: true,
      retryCondition: () => true // Always retry critical operations
}
};

  // Execute operation with retry
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    category: string = 'default'
  ): Promise<RetryResult<T>> {
    const fullConfig = this.mergeConfigs(config, category);
    const startTime = Date.now();
    let lastError: any;
    let attempts = 0;

    for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        const result = await this.executeWithTimeout(operation, fullConfig.timeout);
        const totalTime = Date.now() - startTime;
        
        // Update stats
        this.updateStats(true, totalTime, lastError);
        
        return {
          success: true,
          data: result,
          attempts,
          totalTime
      };
    } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === fullConfig.maxAttempts || !fullConfig.retryCondition(error)) {
          const totalTime = Date.now() - startTime;
          this.updateStats(false, totalTime, error);
          
          if (fullConfig.onMaxAttemptsReached) {
            fullConfig.onMaxAttemptsReached(error);
        }
          
          return {
            success: false,
            error,
            attempts,
            totalTime,
            lastError: error
      };
      }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, fullConfig);
        
        // Call retry callback
        if (fullConfig.onRetry) {
          fullConfig.onRetry(attempt, error);
      }
        
        // Wait before retry
        await this.sleep(delay);
    }
  }
    
    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      error: lastError,
      attempts,
      totalTime: Date.now() - startTime,
      lastError
  };
}

  // Execute operation with timeout
  private async executeWithTimeout<T>(
    operation: () => Promise<>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) {
      return operation();
  }
    
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeout);
    })
    ]);
}

  // Calculate delay for retry attempt
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, config.maxDelay);
    
    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
  }
    
    return Math.max(0, delay);
}

  // Sleep utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

  // Merge configuration with defaults
  private mergeConfigs(config: Partial<RetryConfig>, category: string): RetryConfig {
    const defaultConfig = this.defaultConfigs[category] || this.defaultConfigs.api;
    
    return {
      maxAttempts: 3,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: () => true,
      ...defaultConfig,
      ...config
  };
}

  // Update statistics
  private updateStats(success: boolean, totalTime: number, error?: any) {
    this.stats.totalRetries++;
    
    if (success) {
      this.stats.successfulRetries++;
  } else {
      this.stats.failedRetries++;
      
      if (error) {
        const errorString = error?.message || error?.toString() || 'Unknown error';
        const count = this.errorCounts.get(errorString) || 0;
        this.errorCounts.set(errorString, count + 1);
    }
  }
    
    this.retryTimes.push(totalTime);
    
    // Update averages
    this.stats.averageRetryTime = this.retryTimes.reduce((a, b) => a + b, 0) / this.retryTimes.length;
    this.stats.retrySuccessRate = this.stats.successfulRetries / this.stats.totalRetries;
    
    // Update most common errors
    this.stats.mostCommonErrors = Array.from(this.errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
}

  // Register retryable operation
  registerOperation<T>(id: string, operation: RetryableOperation<T>) {
    this.operations.set(id, { ...operation, id });
}

  // Execute registered operation
  async executeRegisteredOperation<T>(id: string): Promise<RetryResult<T>> {
    const operation = this.operations.get(id);
    if (!operation) {
      throw new Error(`Operation ${id} not found`);
  }
    
    return this.executeWithRetry(operation.operation, operation.config, operation.category);
}

  // Get retry statistics
  getStats(): RetryStats {
    return { ...this.stats };
}

  // Clear statistics
  clearStats() {
    this.stats = {
      totalRetries:  0,
      successfulRetries:  0,
      failedRetries:  0,
      averageRetryTime:  0,
      retrySuccessRate:  0,
      mostCommonErrors: []
};
    this.errorCounts.clear();
    this.retryTimes = [];
}

  // Get operation by ID
  getOperation(id: string) {
    return this.operations.get(id);
}

  // Remove operation
  removeOperation(id: string) {
    this.operations.delete(id);
}

  // List all operations
  listOperations() {
    return Array.from(this.operations.entries()).map(([id, operation]) => ({
      id,
      category: operation.category,
      priority: operation.priority,
      config: operation.config
}));
}
}

// Create singleton instance
export const retryManager = new RetryManager();

// Utility functions
export const executeWithRetry = <T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>,
  category?: string
): Promise<RetryResult<T>> => {
  return retryManager.executeWithRetry(operation, config, category);
};

export const registerRetryableOperation = <T>(id: string, operation: RetryableOperation<T>) => {
  retryManager.registerOperation(id, operation);
};

export const executeRegisteredOperation = <T>(id: string): Promise<RetryResult<T>> => {
  return retryManager.executeRegisteredOperation(id)
};

export const getRetryStats = () => {
  return retryManager.getStats();
};

export const clearRetryStats = () => {
  retryManager.clearStats();
};

// React hook for retry functionality
export const useRetry = () => {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const [lastError, setLastError] = React.useState<any>(null);

  const executeWithRetry = React.useCallback(async <T>(
    operation: () => Promise<>,
    config?: Partial<RetryConfig>,
    category?: string
  ): Promise<RetryResult<T>> => {
    setIsRetrying(true);
    setRetryCount(0);
    setLastError(null);

    const result = await retryManager.executeWithRetry(operation, {
      ...config,
      onRetry: (attempt, error) => {
        setRetryCount(attempt);
        setLastError(error);
        config?.onRetry?.(attempt, error);
    }
  }, category);

    setIsRetrying(false);
    return result;
}, []);

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    lastError,
    stats: getRetryStats()
};
};

// Predefined retry configurations
export const RETRY_CONFIGS = {
  NETWORK: {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoffMultiplier: 2,
    jitter: true,
    retryCondition: (error: any) => {
      const errorString = error?.message || error?.toString() || '';
      return /network|timeout|connection|fetch/i.test(errorString);
}
},
  API: {
    maxAttempts: 5,
    baseDelay: 50,
    maxDelay: 500,
    backoffMultiplier: 1.5,
    jitter: true,
    retryCondition: (error: any) => {
      const status = error?.status || error?.response?.status;
      return status >= 500 || status === 429;
}
  },
  FILE_UPLOAD: {
    maxAttempts: 2,
    baseDelay: 200,
    maxDelay: 800,
    backoffMultiplier: 2,
    jitter: false,
    retryCondition: (error: any) => {
      const errorString = error?.message || error?.toString() || ', ';
      return /network|timeout|connection/i.test(errorString);
}
},
  CRITICAL: {
    maxAttempts: 10,
    baseDelay: 100,
    maxDelay: 3000,
    backoffMultiplier: 1.8,
    jitter: true,
    retryCondition: () => true
}
};

// Retry decorator for functions
export function retryable<T extends (...args: any[]) => Promise<any>>(
  config?: Partial<RetryConfig>,
  category?: string
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return executeWithRetry(() => method.apply(this, args), config, category);
  };
    
    return descriptor;
};
}

// Circuit breaker pattern
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 6000,
    private resetTimeout: number = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
  } else {
        throw new Error('Circuit breaker is OPEN');
    }
  }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
  } catch (error) {
      this.onFailure();
      throw error;
  }
}
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
}
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
  }
}
  
  getState() {
    return this.state;
}
  
  reset() {
    this.failureCount = 0;
    this.state ='CLOSED';
}
}

export default retryManager;
