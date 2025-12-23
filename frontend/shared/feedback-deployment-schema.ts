import { pgTable, text, timestamp, json, boolean, varchar } from 'drizzle-orm/pg-core';

/**
 * Feedback Analysis Table
 * Stores AI analysis results for feedback items
 */
export const feedbackAnalysis = pgTable('feedback_analysis', {
  id: text('id')
    .primaryKey()
    .default('fa_' + Math.random().toString(36).substr(2, 9)),
  feedbackId: text('feedback_id').notNull(),
  analysis: json('analysis').notNull(), // AI analysis results
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Feedback Deployments Table
 * Tracks deployments triggered by feedback
 */
export const feedbackDeployments = pgTable('feedback_deployments', {
  id: text('id')
    .primaryKey()
    .default('fd_' + Math.random().toString(36).substr(2, 9)),
  feedbackId: text('feedback_id').notNull(),
  deploymentType: varchar('deployment_type', { length: 50 }).notNull(), // 'auto_fix', 'feature_implementation', 'ui_improvement'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed', 'rolled_back'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  deploymentResult: json('deployment_result'), // Deployment execution results
  rollbackAvailable: boolean('rollback_available').default(true).notNull(),
  rollbackReason: text('rollback_reason'),
  createdBy: text('created_by').notNull().default('system'),
});

/**
 * Deployment History Table
 * Detailed history of all deployment actions
 */
export const deploymentHistory = pgTable('deployment_history', {
  id: text('id')
    .primaryKey()
    .default('dh_' + Math.random().toString(36).substr(2, 9)),
  deploymentId: text('deployment_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'deploy', 'rollback', 'test', 'validate'
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failed', 'pending'
  details: json('details'), // Action-specific details
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  executedBy: text('executed_by').notNull().default('system'),
  duration: text('duration'), // Execution duration
  errorMessage: text('error_message'),
});

/**
 * Code Generation Templates Table
 * Templates for generating code based on feedback types
 */
export const codeGenerationTemplates = pgTable('code_generation_templates', {
  id: text('id')
    .primaryKey()
    .default('cgt_' + Math.random().toString(36).substr(2, 9)),
  name: text('name').notNull(),
  description: text('description'),
  feedbackType: varchar('feedback_type', { length: 20 }).notNull(), // 'bug', 'feature', 'ui_ux', 'usability'
  fixType: varchar('fix_type', { length: 30 }).notNull(), // 'code_fix', 'ui_improvement', 'feature_addition', 'performance_optimization'
  template: text('template').notNull(), // Code template
  variables: json('variables'), // Template variables
  dependencies: json('dependencies'), // Required dependencies
  filesToModify: json('files_to_modify'), // Files that will be modified
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by').notNull().default('system'),
});

/**
 * Deployment Validation Rules Table
 * Rules for validating deployments before execution
 */
export const deploymentValidationRules = pgTable('deployment_validation_rules', {
  id: text('id')
    .primaryKey()
    .default('dvr_' + Math.random().toString(36).substr(2, 9)),
  name: text('name').notNull(),
  description: text('description'),
  ruleType: varchar('rule_type', { length: 30 }).notNull(), // 'syntax_check', 'test_validation', 'dependency_check', 'security_scan'
  validationScript: text('validation_script').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  priority: varchar('priority', { length: 10 }).default('medium').notNull(), // 'low', 'medium', 'high', 'critical'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Deployment Metrics Table
 * Metrics and analytics for deployment performance
 */
export const deploymentMetrics = pgTable('deployment_metrics', {
  id: text('id')
    .primaryKey()
    .default('dm_' + Math.random().toString(36).substr(2, 9)),
  deploymentId: text('deployment_id').notNull(),
  metricType: varchar('metric_type', { length: 30 }).notNull(), // 'success_rate', 'execution_time', 'error_count', 'rollback_rate'
  metricValue: text('metric_value').notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  context: json('context'), // Additional context for the metric
});
