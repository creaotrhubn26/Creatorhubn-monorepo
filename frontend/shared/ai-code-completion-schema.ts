/**
 * AI Code Completion Database Schema
 * Tracks AI code completion usage, templates, team keys, and analytics
 * Integrates with AIMetricsDashboard
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  decimal,
  uuid,
  serial,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// ============================================================================
// AI CODE COMPLETION USAGE TRACKING
// ============================================================================

/**
 * Tracks every AI code completion request
 * Integrates with /api/ai/learning/track
 */
export const aiCodeCompletionUsage = pgTable(
  'ai_code_completion_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Request details
    provider: varchar('provider', { length: 50 }).notNull(), // 'openai', 'anthropic', 'local'
    model: varchar('model', { length: 100 }).notNull(),
    operation: varchar('operation', { length: 50 }).notNull(), // 'completion', 'generate', 'refactor', 'explain', 'compare'

    // Context
    language: varchar('language', { length: 50 }),
    framework: varchar('framework', { length: 50 }), // 'react', 'vue', 'angular', 'svelte'

    // Performance
    tokensUsed: integer('tokens_used').default(0),
    responseTime: integer('response_time'), // milliseconds

    // Cost
    cost: decimal('cost', { precision: 10, scale: 4 }).default('0'),
    currency: varchar('currency', { length: 3 }).default('USD'),

    // Success metrics
    success: boolean('success').default(true),
    confidence: decimal('confidence', { precision: 5, scale: 2 }),
    errorMessage: text('error_message'),

    // Feedback
    userAccepted: boolean('user_accepted'),
    userRating: integer('user_rating'), // 1-5

    // Additional metadata
    metadata: jsonb('metadata'), // Template used, files in context, etc.

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_code_completion_usage_user_id_idx').on(table.userId),
    providerIdx: index('ai_code_completion_usage_provider_idx').on(table.provider),
    operationIdx: index('ai_code_completion_usage_operation_idx').on(table.operation),
    frameworkIdx: index('ai_code_completion_usage_framework_idx').on(table.framework),
    createdAtIdx: index('ai_code_completion_usage_created_at_idx').on(table.createdAt),
  }),
);

export type AiCodeCompletionUsage = typeof aiCodeCompletionUsage.$inferSelect;
export type InsertAiCodeCompletionUsage = typeof aiCodeCompletionUsage.$inferInsert;

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

/**
 * Custom prompt templates for reusable patterns
 */
export const aiPromptTemplates = pgTable(
  'ai_prompt_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }),

    // Template details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }).notNull(), // 'component', 'refactor', 'bug-fix', 'optimization', 'custom'

    // Template content
    template: text('template').notNull(),
    variables: jsonb('variables').$type<string[]>().default([]),

    // Framework specific
    framework: varchar('framework', { length: 50 }), // 'react', 'vue', 'angular', 'svelte', null for generic

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // User preferences
    isFavorite: boolean('is_favorite').default(false),
    isPublic: boolean('is_public').default(false), // Share with team

    // System templates
    isSystem: boolean('is_system').default(false), // Built-in templates

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_prompt_templates_user_id_idx').on(table.userId),
    categoryIdx: index('ai_prompt_templates_category_idx').on(table.category),
    frameworkIdx: index('ai_prompt_templates_framework_idx').on(table.framework),
    isPublicIdx: index('ai_prompt_templates_is_public_idx').on(table.isPublic),
  }),
);

export type AiPromptTemplate = typeof aiPromptTemplates.$inferSelect;
export type InsertAiPromptTemplate = typeof aiPromptTemplates.$inferInsert;

// ============================================================================
// TEAM API KEYS
// ============================================================================

/**
 * Secure team-level API key management
 */
export const aiTeamKeys = pgTable(
  'ai_team_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: varchar('team_id', { length: 255 }).notNull(),

    // Key details
    provider: varchar('provider', { length: 50 }).notNull(), // 'openai', 'anthropic'
    keyName: varchar('key_name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(), // Encrypted/hashed key
    keyPreview: varchar('key_preview', { length: 20 }), // Last 4 chars for identification

    // Access control
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    allowedUsers: jsonb('allowed_users').$type<string[]>().default([]),
    allowedRoles: jsonb('allowed_roles').$type<string[]>().default(['admin', 'member']),

    // Usage limits
    monthlyLimit: decimal('monthly_limit', { precision: 10, scale: 2 }), // USD
    currentMonthUsage: decimal('current_month_usage', { precision: 10, scale: 2 }).default('0'),

    // Status
    isActive: boolean('is_active').default(true),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),

    // Audit
    lastRotatedAt: timestamp('last_rotated_at'),
    rotationSchedule: varchar('rotation_schedule', { length: 50 }), // 'monthly', 'quarterly', 'never'

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    teamIdIdx: index('ai_team_keys_team_id_idx').on(table.teamId),
    providerIdx: index('ai_team_keys_provider_idx').on(table.provider),
    isActiveIdx: index('ai_team_keys_is_active_idx').on(table.isActive),
    teamProviderUnique: unique('ai_team_keys_team_provider_unique').on(
      table.teamId,
      table.provider,
      table.keyName,
    ),
  }),
);

export type AiTeamKey = typeof aiTeamKeys.$inferSelect;
export type InsertAiTeamKey = typeof aiTeamKeys.$inferInsert;

/**
 * Audit log for team key usage
 */
export const aiTeamKeyUsageLog = pgTable(
  'ai_team_key_usage_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamKeyId: uuid('team_key_id')
      .notNull()
      .references(() => aiTeamKeys.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Usage details
    operation: varchar('operation', { length: 50 }).notNull(),
    tokensUsed: integer('tokens_used'),
    cost: decimal('cost', { precision: 10, scale: 4 }),

    // Request details
    model: varchar('model', { length: 100 }),
    success: boolean('success').default(true),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    teamKeyIdIdx: index('ai_team_key_usage_log_team_key_id_idx').on(table.teamKeyId),
    userIdIdx: index('ai_team_key_usage_log_user_id_idx').on(table.userId),
    createdAtIdx: index('ai_team_key_usage_log_created_at_idx').on(table.createdAt),
  }),
);

export type AiTeamKeyUsageLog = typeof aiTeamKeyUsageLog.$inferSelect;
export type InsertAiTeamKeyUsageLog = typeof aiTeamKeyUsageLog.$inferInsert;

// ============================================================================
// PROJECT CONTEXT FILES
// ============================================================================

/**
 * Multi-file context for better AI suggestions
 */
export const aiProjectContext = pgTable(
  'ai_project_context',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    projectId: varchar('project_id', { length: 255 }),

    // Context name
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Files in context
    files: jsonb('files')
      .$type<
        Array<{
          path: string;
          content: string;
          language: string;
          size: number;
        }>
      >()
      .notNull(),

    // Dependencies
    dependencies: jsonb('dependencies').$type<Record<string, string[]>>().default({}),
    importGraph: jsonb('import_graph').$type<Record<string, string[]>>().default({}),

    // Usage
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Auto-update
    autoUpdate: boolean('auto_update').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_project_context_user_id_idx').on(table.userId),
    projectIdIdx: index('ai_project_context_project_id_idx').on(table.projectId),
  }),
);

export type AiProjectContext = typeof aiProjectContext.$inferSelect;
export type InsertAiProjectContext = typeof aiProjectContext.$inferInsert;

// ============================================================================
// LOCAL MODEL CONFIGURATIONS
// ============================================================================

/**
 * Local model providers (Ollama, LM Studio, llama.cpp)
 */
export const aiLocalModelConfigs = pgTable(
  'ai_local_model_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Provider details
    provider: varchar('provider', { length: 50 }).notNull(), // 'ollama', 'lmstudio', 'llamacpp'
    endpoint: varchar('endpoint', { length: 500 }).notNull(),

    // Model details
    modelId: varchar('model_id', { length: 255 }).notNull(),
    modelName: varchar('model_name', { length: 255 }),

    // Settings
    maxTokens: integer('max_tokens').default(2000),
    temperature: decimal('temperature', { precision: 3, scale: 2 }).default('0.7'),
    streamResponse: boolean('stream_response').default(true),

    // Status
    isActive: boolean('is_active').default(true),
    lastTestedAt: timestamp('last_tested_at'),
    testSuccess: boolean('test_success'),

    // Usage
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_local_model_configs_user_id_idx').on(table.userId),
    providerIdx: index('ai_local_model_configs_provider_idx').on(table.provider),
    isActiveIdx: index('ai_local_model_configs_is_active_idx').on(table.isActive),
  }),
);

export type AiLocalModelConfig = typeof aiLocalModelConfigs.$inferSelect;
export type InsertAiLocalModelConfig = typeof aiLocalModelConfigs.$inferInsert;

// ============================================================================
// DEBUG ASSISTANT SESSIONS
// ============================================================================

/**
 * AI-powered debugging sessions
 */
export const aiDebugSessions = pgTable(
  'ai_debug_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Session details
    language: varchar('language', { length: 50 }),
    framework: varchar('framework', { length: 50 }),

    // Issues found
    issuesFound: integer('issues_found').default(0),
    issuesFixed: integer('issues_fixed').default(0),

    // Performance
    analysisTime: integer('analysis_time'), // milliseconds

    // Issues detected
    issues: jsonb('issues')
      .$type<
        Array<{
          id: string;
          type: 'error' | 'warning' | 'performance' | 'security';
          severity: 'critical' | 'high' | 'medium' | 'low';
          title: string;
          description: string;
          line: number;
          fixed: boolean;
        }>
      >()
      .default([]),

    // Session status
    status: varchar('status', { length: 50 }).default('active'), // 'active', 'completed', 'abandoned'

    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    userIdIdx: index('ai_debug_sessions_user_id_idx').on(table.userId),
    statusIdx: index('ai_debug_sessions_status_idx').on(table.status),
    createdAtIdx: index('ai_debug_sessions_created_at_idx').on(table.createdAt),
  }),
);

export type AiDebugSession = typeof aiDebugSessions.$inferSelect;
export type InsertAiDebugSession = typeof aiDebugSessions.$inferInsert;

// ============================================================================
// MODEL COMPARISON RESULTS
// ============================================================================

/**
 * Stores results from model comparison feature
 */
export const aiModelComparisonResults = pgTable(
  'ai_model_comparison_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Comparison details
    models: jsonb('models').$type<string[]>().notNull(),
    operation: varchar('operation', { length: 50 }).notNull(),

    // Results
    results: jsonb('results')
      .$type<
        Array<{
          model: string;
          provider: string;
          responseTime: number;
          confidence: number;
          cost: number;
          selected: boolean;
        }>
      >()
      .notNull(),

    // Winner
    selectedModel: varchar('selected_model', { length: 100 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_model_comparison_results_user_id_idx').on(table.userId),
    createdAtIdx: index('ai_model_comparison_results_created_at_idx').on(table.createdAt),
  }),
);

export type AiModelComparisonResult = typeof aiModelComparisonResults.$inferSelect;
export type InsertAiModelComparisonResult = typeof aiModelComparisonResults.$inferInsert;

// ============================================================================
// RELATIONS
// ============================================================================

export const aiTeamKeysRelations = relations(aiTeamKeys, ({ many }) => ({
  usageLogs: many(aiTeamKeyUsageLog),
}));

export const aiTeamKeyUsageLogRelations = relations(aiTeamKeyUsageLog, ({ one }) => ({
  teamKey: one(aiTeamKeys, {
    fields: [aiTeamKeyUsageLog.teamKeyId],
    references: [aiTeamKeys.id],
  }),
}));
