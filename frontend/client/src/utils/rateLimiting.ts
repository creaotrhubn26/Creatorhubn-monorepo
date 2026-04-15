// @ts-nocheck
/**
 * Rate Limiting Utilities
 * Implements rate limiting for API calls and user actions
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests: boolean; // Skip successful requests from counting
  skipFailedRequests: boolean; // Skip failed requests from counting
  keyGenerator: (req: any) => string; // Function to generate rate limit key
  onLimitReached: (req: any, res: any) => void; // Callback when limit is reached
  standardHeaders: boolean; // Send rate limit info in headers
  legacyHeaders: boolean; // Send rate limit info in legacy format
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  message?: string
}

export interface UserAction {
  id: string;
  type: string;
  timestamp: number;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface ActionRateLimit {
  actionType: string;
  windowMs: number;
  maxActions: number;
  cooldownMs?: number;
  burstLimit?: number;
  priority: 'low' | 'medium' | 'high' | 'critical'
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private actions: Map<string, number[]> = new Map();
  private config: RateLimitConfig;
  private actionLimits: Map<string, ActionRateLimit> = new Map();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req) => req.ip || 'anonymous',
      onLimitReached: () => {},
      standardHeaders: true,
      legacyHeaders: false,
      ...config
  };
}

  // API rate limiting
  checkRateLimit(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this key
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit is exceeded
    const isAllowed = recentRequests.length < this.config.maxRequests;
    
    if (isAllowed) {
      // Add current request
      recentRequests.push(now);
      this.requests.set(key, recentRequests);
  }
    
    const remaining = Math.max(0, this.config.maxRequests - recentRequests.length);
    const reset = windowStart + this.config.windowMs;
    const retryAfter = isAllowed ? undefined : Math.ceil((reset - now) / 1000);
    
    return {
      allowed: isAllowed,
      limit: this.config.maxRequests,
      remaining,
      reset,
      retryAfter,
      message: isAllowed ? undefined : 'Rate limit exceeded. Please try again later.'
};
}

  // User action rate limiting
  checkActionRateLimit(actionType: string, userId: string, metadata?: Record<string, any>): RateLimitResult {
    const actionLimit = this.actionLimits.get(actionType);
    if (!actionLimit) {
      return {
        allowed: true,
        limit:  0,
        remaining:  0,
        reset: 0
  };
  }

    const key = `${actionType}:${userId}`;
    const now = Date.now();
    const windowStart = now - actionLimit.windowMs;
    
    // Get existing actions for this user and action type
    const actions = this.actions.get(key) || [];
    
    // Remove old actions outside the window
    const recentActions = actions.filter(timestamp => timestamp > windowStart);
    
    // Check burst limit first
    if (actionLimit.burstLimit && recentActions.length >= actionLimit.burstLimit) {
      return {
        allowed: false,
        limit: actionLimit.burstLimit,
        remaining:  0,
        reset: windowStart + actionLimit.windows,
        retryAfter: Math.ceil(actionLimit.windowMs / 100),
        message: `Burst limit exceeded for ${actionType}. Please wait before trying again.`
    };
  }
    
    // Check regular limit
    const isAllowed = recentActions.length < actionLimit.maxActions;
    
    if (isAllowed) {
      // Add current action
      recentActions.push(now);
      this.actions.set(key, recentActions);
  }
    
    const remaining = Math.max(0, actionLimit.maxActions - recentActions.length);
    const reset = windowStart + actionLimit.windowMs;
    const retryAfter = isAllowed ? undefined : Math.ceil((reset - now) / 1000);
    
    return {
      allowed: isAllowed,
      limit: actionLimit.maxActions,
      remaining,
      reset,
      retryAfter,
      message: isAllowed ? undefined : `Rate limit exceeded for ${actionType}. Please try again later.`
  };
}

  // Add action rate limit configuration
  addActionRateLimit(actionType: string, config: ActionRateLimit) {
    this.actionLimits.set(actionType, config);
}

  // Remove action rate limit configuration
  removeActionRateLimit(actionType: string) {
    this.actionLimits.delete(actionType);
}

  // Get rate limit info for a key
  getRateLimitInfo(key: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return {
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - recentRequests.length),
      reset: windowStart + this.config.windowMs
};
}

  // Get action rate limit info
  getActionRateLimitInfo(actionType: string, userId: string): RateLimitInfo | null {
    const actionLimit = this.actionLimits.get(actionType);
    if (!actionLimit) return null;

    const key = `${actionType}:${userId}`;
    const now = Date.now();
    const windowStart = now - actionLimit.windowMs;
    const actions = this.actions.get(key) || [];
    const recentActions = actions.filter(timestamp => timestamp > windowStart);
    
    return {
      limit: actionLimit.maxActions,
      remaining: Math.max(0, actionLimit.maxActions - recentActions.length),
      reset: windowStart + actionLimit.windowMs
};
}

  // Reset rate limit for a key
  resetRateLimit(key: string) {
    this.requests.delete(key);
}

  // Reset action rate limit for a user
  resetActionRateLimit(actionType: string, userId: string) {
    const key = `${actionType}:${userId}`;
    this.actions.delete(key);
}

  // Clear all rate limits
  clearAllRateLimits() {
    this.requests.clear();
    this.actions.clear();
}

  // Get statistics
  getStatistics() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    let totalRequests = 0;
    let activeKeys = 0;
    
    for (const [key, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > windowStart);
      if (recentRequests.length > 0) {
        totalRequests += recentRequests.length;
        activeKeys++;
    }
  }
    
    return {
      totalRequests,
      activeKeys,
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
      actionLimits: this.actionLimits.size
};
}

  // Update configuration
  updateConfig(newConfig: Partial<RateLimitConfig>) {
    this.config = { ...this.config, ...newConfig };
}

  // Middleware for Express.js (if needed)
  middleware() {
    return (req: any, res: any, next: any) => {
      const key = this.config.keyGenerator(req);
      const result = this.checkRateLimit(key);
      
      if (this.config.standardHeaders) {
        res.set({
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.reset).toISOString()
        });
      }
      
      if (this.config.legacyHeaders) {
        res.set({
          'X-Rate-Limit-Limit': result.limit.toString(),
          'X-Rate-Limit-Remaining': result.remaining.toString(),
          'X-Rate-Limit-Reset': result.reset.toString()
      });
    }
      
      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
      }
        this.config.onLimitReached(req, res);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: result.message,
          retryAfter: result.retryAfter
    });
    }
      
      next();
  };
}
}

// Create default rate limiter instance
export const rateLimiter = new RateLimiter();

// Predefined action rate limits
export const DEFAULT_ACTION_LIMITS: Record<string, ActionRateLimit> = {
  'file_upload': {
    actionType: 'file_upload',
    windowMs: 60 * 1000, // 1 minute
    maxActions:  5,
    burstLimit:  2,
    priority: 'high'
},
  'api_request': {
    actionType: 'api_request',
    windowMs: 60 * 1000, // 1 minute
    maxActions:  60,
    burstLimit:  10,
    priority: 'medium'
},
  'login_attempt': {
    actionType: 'login_attempt',
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxActions:  5,
    burstLimit:  2,
    priority: 'critical'
},
  'password_reset': {
    actionType: 'password_reset',
    windowMs: 60 * 60 * 1000, // 1 hour
    maxActions:  3,
    burstLimit:  1,
    priority: 'critical'
},
  'email_send': {
    actionType: 'email_send',
    windowMs: 60 * 1000, // 1 minute
    maxActions:  10,
    burstLimit:  3,
    priority: 'high'
},
  'data_export': {
    actionType: 'data_export',
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxActions:  2,
    burstLimit:  1,
    priority: 'medium'
  },
  'search_query': {
    actionType: 'search_query',
    windowMs: 60 * 1000, // 1 minute
    maxActions:  30,
    burstLimit:  5,
    priority: 'low'
}
};

// Initialize default action limits
Object.entries(DEFAULT_ACTION_LIMITS).forEach(([actionType, config]) => {
  rateLimiter.addActionRateLimit(actionType, config);
});

// Utility functions
export const checkAPIRateLimit = (key: string) => {
  return rateLimiter.checkRateLimit(key)
};

export const checkActionRateLimit = (actionType: string, userId: string, metadata?: Record<string, any>) => {
  return rateLimiter.checkActionRateLimit(actionType, userId, metadata);
};

export const addActionRateLimit = (actionType: string, config: ActionRateLimit) => {
  rateLimiter.addActionRateLimit(actionType, config);
};

export const removeActionRateLimit = (actionType: string) => {
  rateLimiter.removeActionRateLimit(actionType)
};

export const getRateLimitInfo = (key: string) => {
  return rateLimiter.getRateLimitInfo(key)
};

export const getActionRateLimitInfo = (actionType: string, userId: string) => {
  return rateLimiter.getActionRateLimitInfo(actionType, userId);
};

export const resetRateLimit = (key: string) => {
  rateLimiter.resetRateLimit(key)
};

export const resetActionRateLimit = (actionType: string, userId: string) => {
  rateLimiter.resetActionRateLimit(actionType, userId);
};

export const getRateLimitStatistics = () => {
  return rateLimiter.getStatistics();
};

export const updateRateLimitConfig = (config: Partial<RateLimitConfig>) => {
  rateLimiter.updateConfig(config)
};

// Advanced rate limiting strategies
export class AdaptiveRateLimiter extends RateLimiter {
  private userBehavior: Map<string, { requests: number; errors: number; lastSeen: number }> = new Map();
  private adaptiveConfig: Map<string, { multiplier: number; lastUpdate: number }> = new Map();

  checkAdaptiveRateLimit(key: string, isError: boolean = false): RateLimitResult {
    const behavior = this.userBehavior.get(key) || { requests: 0, errors: 0, lastSeen: 0 };
    const now = Date.now();
    
    // Update behavior
    behavior.requests++;
    if (isError) behavior.errors++;
    behavior.lastSeen = now;
    this.userBehavior.set(key, behavior);
    
    // Calculate adaptive multiplier
    const errorRate = behavior.errors / behavior.requests;
    const timeSinceLastSeen = now - behavior.lastSeen;
    
    let multiplier = 1.0;
    if (errorRate > 0.1) {
      multiplier *= 0.5; // Reduce limit for users with high error rate
  }
    if (timeSinceLastSeen > 24 * 60 * 60 * 1000) { // 24 hours
      multiplier *= 1.5; // Increase limit for returning users
  }
    
    // Apply adaptive multiplier
    const adaptiveConfig = this.adaptiveConfig.get(key) || { multiplier: 1, lastUpdate: now };
    adaptiveConfig.multiplier = multiplier;
    adaptiveConfig.lastUpdate = now;
    this.adaptiveConfig.set(key, adaptiveConfig);
    
    // Check rate limit with adaptive multiplier
    const originalMaxRequests = this.config.maxRequests;
    this.config.maxRequests = Math.floor(originalMaxRequests * multiplier);
    
    const result = super.checkRateLimit(key);
    
    // Restore original config
    this.config.maxRequests = originalMaxRequests;
    
    return result;
}
}

// Create adaptive rate limiter instance
export const adaptiveRateLimiter = new AdaptiveRateLimiter();

export default rateLimiter;




