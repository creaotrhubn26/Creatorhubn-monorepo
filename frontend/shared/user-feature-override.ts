/**
 * User-Level Feature Override System
 * Enable/disable features for specific individual users
 * Overrides profession and global settings
 */

export interface UserFeatureOverride {
  userId: string;
  userEmail: string;
  userName: string;
  profession: string;
  overrides: {
    tabs: {
      [tabId: string]: {
        enabled: boolean;
        reason: string; // Why this was enabled/disabled
        enabledBy: string; // Admin who made the change
        enabledAt: Date;
        expiresAt?: Date; // Optional expiration
      };
    };
    features: {
      [featureId: string]: {
        enabled: boolean;
        reason: string;
        enabledBy: string;
        enabledAt: Date;
        expiresAt?: Date;
      };
    };
  };
  metadata: {
    plan: 'free' | 'pro' | 'enterprise' | 'trial';
    betaTester: boolean;
    vip: boolean;
    tags: string[]; // e.g., ['early_adopter', 'power_user', 'premium']
  };
}

/**
 * User Feature Access Resolution
 * Determines final feature access for a user
 */
export interface UserFeatureAccess {
  userId: string;
  tabAccess: {
    [tabId: string]: {
      enabled: boolean;
      source: 'global' | 'profession' | 'user_override' | 'plan' | 'beta';
      reason: string;
    };
  };
  featureAccess: {
    [featureId: string]: {
      enabled: boolean;
      source: 'global' | 'profession' | 'user_override' | 'plan' | 'beta';
      reason: string;
    };
  };
}

/**
 * Feature Access Priority (highest to lowest):
 * 1. User Override (admin manually enabled/disabled for this user)
 * 2. Plan-based access (enterprise > pro > free)
 * 3. Beta tester access (early access to new features)
 * 4. Profession-based access (from profession config)
 * 5. Global access (platform default)
 */

/**
 * Check if user has access to a specific tab
 */
export function hasUserTabAccess(
  userId: string,
  tabId: string,
  professionId: string,
  userOverride?: UserFeatureOverride,
  professionDefault?: boolean,
  globalDefault?: boolean,
): { enabled: boolean; source: string; reason: string } {
  // 1. Check user-specific override (highest priority)
  if (userOverride?.overrides.tabs[tabId]) {
    const override = userOverride.overrides.tabs[tabId];

    // Check expiration
    if (override.expiresAt && new Date() > override.expiresAt) {
      // Override expired, fall through to next level
    } else {
      return {
        enabled: override.enabled,
        source: 'user_override',
        reason: override.reason,
      };
    }
  }

  // 2. Check plan-based access
  if (userOverride?.metadata.plan === 'enterprise') {
    // Enterprise users get access to everything
    return {
      enabled: true,
      source: 'plan',
      reason: 'Enterprise plan includes all features',
    };
  }

  if (userOverride?.metadata.plan === 'pro') {
    // Pro users get access to premium features
    const premiumTabs = [
      'business_intelligence',
      'live_cameras',
      'online_classes',
      'advanced_analytics',
    ];
    if (premiumTabs.includes(tabId)) {
      return {
        enabled: true,
        source: 'plan',
        reason: 'Pro plan includes premium features',
      };
    }
  }

  // 3. Check beta tester access
  if (userOverride?.metadata.betaTester) {
    const betaTabs = ['ai_assistant', 'advanced_search', 'collaboration_tools'];
    if (betaTabs.includes(tabId)) {
      return {
        enabled: true,
        source: 'beta',
        reason: 'Beta tester early access',
      };
    }
  }

  // 4. Check profession-based access
  if (professionDefault !== undefined) {
    return {
      enabled: professionDefault,
      source: 'profession',
      reason: `Default for ${professionId} profession`,
    };
  }

  // 5. Fall back to global default
  return {
    enabled: globalDefault || false,
    source: 'global',
    reason: 'Platform default',
  };
}

/**
 * Check if user has access to a specific feature
 */
export function hasUserFeatureAccess(
  userId: string,
  featureId: string,
  professionId: string,
  userOverride?: UserFeatureOverride,
  professionDefault?: boolean,
  globalDefault?: boolean,
): { enabled: boolean; source: string; reason: string } {
  // 1. Check user-specific override (highest priority)
  if (userOverride?.overrides.features[featureId]) {
    const override = userOverride.overrides.features[featureId];

    // Check expiration
    if (override.expiresAt && new Date() > override.expiresAt) {
      // Override expired, fall through to next level
    } else {
      return {
        enabled: override.enabled,
        source: 'user_override',
        reason: override.reason,
      };
    }
  }

  // 2. Check plan-based access
  if (userOverride?.metadata.plan === 'enterprise') {
    return {
      enabled: true,
      source: 'plan',
      reason: 'Enterprise plan includes all features',
    };
  }

  if (userOverride?.metadata.plan === 'pro') {
    const premiumFeatures = [
      'ai_enhancement',
      'unlimited_storage',
      'priority_support',
      'advanced_analytics',
      'custom_branding',
      'api_access',
    ];
    if (premiumFeatures.includes(featureId)) {
      return {
        enabled: true,
        source: 'plan',
        reason: 'Pro plan includes premium features',
      };
    }
  }

  // 3. Check beta tester access
  if (userOverride?.metadata.betaTester) {
    const betaFeatures = ['ai_assistant', 'voice_commands', 'smart_suggestions'];
    if (betaFeatures.includes(featureId)) {
      return {
        enabled: true,
        source: 'beta',
        reason: 'Beta tester early access',
      };
    }
  }

  // 4. Check VIP access
  if (userOverride?.metadata.vip) {
    return {
      enabled: true,
      source: 'user_override',
      reason: 'VIP user - all features enabled',
    };
  }

  // 5. Check profession-based access
  if (professionDefault !== undefined) {
    return {
      enabled: professionDefault,
      source: 'profession',
      reason: `Default for ${professionId} profession`,
    };
  }

  // 6. Fall back to global default
  return {
    enabled: globalDefault || false,
    source: 'global',
    reason: 'Platform default',
  };
}

/**
 * Create a user feature override
 */
export function createUserFeatureOverride(
  userId: string,
  userEmail: string,
  userName: string,
  profession: string,
  adminId: string,
  adminName: string,
): UserFeatureOverride {
  return {
    userId,
    userEmail,
    userName,
    profession,
    overrides: {
      tabs: {},
      features: {},
    },
    metadata: {
      plan: 'free',
      betaTester: false,
      vip: false,
      tags: [],
    },
  };
}

/**
 * Add tab override for a user
 */
export function addUserTabOverride(
  override: UserFeatureOverride,
  tabId: string,
  enabled: boolean,
  reason: string,
  adminId: string,
  expiresAt?: Date,
): void {
  override.overrides.tabs[tabId] = {
    enabled,
    reason,
    enabledBy: adminId,
    enabledAt: new Date(),
    expiresAt,
  };
}

/**
 * Add feature override for a user
 */
export function addUserFeatureOverride(
  override: UserFeatureOverride,
  featureId: string,
  enabled: boolean,
  reason: string,
  adminId: string,
  expiresAt?: Date,
): void {
  override.overrides.features[featureId] = {
    enabled,
    reason,
    enabledBy: adminId,
    enabledAt: new Date(),
    expiresAt,
  };
}

/**
 * Remove tab override for a user
 */
export function removeUserTabOverride(override: UserFeatureOverride, tabId: string): void {
  delete override.overrides.tabs[tabId];
}

/**
 * Remove feature override for a user
 */
export function removeUserFeatureOverride(override: UserFeatureOverride, featureId: string): void {
  delete override.overrides.features[featureId];
}

/**
 * Get all active overrides for a user
 */
export function getActiveUserOverrides(override: UserFeatureOverride): {
  tabs: string[];
  features: string[];
} {
  const now = new Date();

  const activeTabs = Object.entries(override.overrides.tabs)
    .filter(([, config]) => !config.expiresAt || config.expiresAt > now)
    .map(([tabId]) => tabId);

  const activeFeatures = Object.entries(override.overrides.features)
    .filter(([, config]) => !config.expiresAt || config.expiresAt > now)
    .map(([featureId]) => featureId);

  return { tabs: activeTabs, features: activeFeatures };
}

/**
 * Upgrade user plan
 */
export function upgradeUserPlan(
  override: UserFeatureOverride,
  newPlan: 'free' | 'pro' | 'enterprise' | 'trial',
): void {
  override.metadata.plan = newPlan;
}

/**
 * Make user a beta tester
 */
export function enableBetaTester(override: UserFeatureOverride, enabled: boolean): void {
  override.metadata.betaTester = enabled;
}

/**
 * Make user VIP
 */
export function enableVIP(override: UserFeatureOverride, enabled: boolean): void {
  override.metadata.vip = enabled;
}

/**
 * Add tag to user
 */
export function addUserTag(override: UserFeatureOverride, tag: string): void {
  if (!override.metadata.tags.includes(tag)) {
    override.metadata.tags.push(tag);
  }
}

/**
 * Remove tag from user
 */
export function removeUserTag(override: UserFeatureOverride, tag: string): void {
  override.metadata.tags = override.metadata.tags.filter((t) => t !== tag);
}

/**
 * Clean up expired overrides
 */
export function cleanupExpiredOverrides(override: UserFeatureOverride): void {
  const now = new Date();

  // Remove expired tab overrides
  for (const [tabId, config] of Object.entries(override.overrides.tabs)) {
    if (config.expiresAt && config.expiresAt <= now) {
      delete override.overrides.tabs[tabId];
    }
  }

  // Remove expired feature overrides
  for (const [featureId, config] of Object.entries(override.overrides.features)) {
    if (config.expiresAt && config.expiresAt <= now) {
      delete override.overrides.features[featureId];
    }
  }
}
