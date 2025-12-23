/**
 * Advanced System Features Schema
 * Complete schema definitions for deployment, monitoring, and provisioning systems
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
  date,
  bigint,
  serial,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// DEPLOYMENT & MONITORING
// ============================================================================

export const deploymentHistory = pgTable('deployment_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: varchar('deployment_id').notNull().unique(),
  version: varchar('version').notNull(),
  environment: varchar('environment').notNull(),
  status: varchar('status')
    .$type<'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back'>()
    .notNull(),
  deployedBy: varchar('deployed_by').notNull(),
  deployedAt: timestamp('deployed_at').notNull(),
  rollbackAt: timestamp('rollback_at'),
  deploymentLog: text('deployment_log'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const deploymentMetrics = pgTable('deployment_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull(),
  metricName: varchar('metric_name').notNull(),
  metricValue: decimal('metric_value').notNull(),
  metricUnit: varchar('metric_unit'),
  recordedAt: timestamp('recorded_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const deploymentValidationRules = pgTable('deployment_validation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  ruleName: varchar('rule_name').notNull(),
  ruleType: varchar('rule_type').notNull(),
  ruleConfig: jsonb('rule_config').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const autoMonitorConfigs = pgTable('auto_monitor_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  monitorName: varchar('monitor_name').notNull(),
  monitorType: varchar('monitor_type').notNull(),
  config: jsonb('config').notNull(),
  isActive: boolean('is_active').default(true),
  lastChecked: timestamp('last_checked'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const automatedTestSuites = pgTable('automated_test_suites', {
  id: uuid('id').primaryKey().defaultRandom(),
  suiteName: varchar('suite_name').notNull(),
  testType: varchar('test_type').notNull(),
  testConfig: jsonb('test_config').notNull(),
  lastRun: timestamp('last_run'),
  status: varchar('status').$type<'passing' | 'failing' | 'not-run'>().default('not-run'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const liveTestResults = pgTable('live_test_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  testSuiteId: uuid('test_suite_id').notNull(),
  testName: varchar('test_name').notNull(),
  result: varchar('result').$type<'pass' | 'fail' | 'skip'>().notNull(),
  duration: integer('duration').notNull(),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// PROVISIONING & ADMIN
// ============================================================================

export const adminProvisioningActions = pgTable('admin_provisioning_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionType: varchar('action_type').notNull(),
  targetUser: varchar('target_user').notNull(),
  performedBy: varchar('performed_by').notNull(),
  actionData: jsonb('action_data').notNull(),
  status: varchar('status').$type<'pending' | 'completed' | 'failed'>().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const userProvisioningRequests = pgTable('user_provisioning_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  requestType: varchar('request_type').notNull(),
  requestData: jsonb('request_data').notNull(),
  status: varchar('status').$type<'pending' | 'approved' | 'rejected'>().default('pending'),
  requestedAt: timestamp('requested_at').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userProvisioningStatus = pgTable('user_provisioning_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull().unique(),
  provisioningLevel: varchar('provisioning_level').notNull(),
  features: jsonb('features').notNull().default('[]'),
  lastUpdated: timestamp('last_updated').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const provisioningWorkflows = pgTable('provisioning_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowName: varchar('workflow_name').notNull(),
  workflowSteps: jsonb('workflow_steps').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const provisioningWorkflowSteps = pgTable('provisioning_workflow_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull(),
  stepName: varchar('step_name').notNull(),
  stepOrder: integer('step_order').notNull(),
  stepConfig: jsonb('step_config').notNull(),
  isRequired: boolean('is_required').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const provisioningMetrics = pgTable('provisioning_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  metricType: varchar('metric_type').notNull(),
  metricValue: decimal('metric_value').notNull(),
  recordedAt: timestamp('recorded_at').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// CODE ANALYSIS & GENERATION
// ============================================================================

export const codeAnalysisResults = pgTable('code_analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisType: varchar('analysis_type').notNull(),
  targetFile: varchar('target_file').notNull(),
  results: jsonb('results').notNull(),
  qualityScore: decimal('quality_score'),
  analyzedAt: timestamp('analyzed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const codeGenerationTemplates = pgTable('code_generation_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateName: varchar('template_name').notNull(),
  templateType: varchar('template_type').notNull(),
  templateContent: text('template_content').notNull(),
  parameters: jsonb('parameters').notNull().default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const codeTemplates = pgTable('code_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  category: varchar('category').notNull(),
  language: varchar('language').notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').notNull().default('[]'),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const generatedCodeHistory = pgTable('generated_code_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull(),
  generatedCode: text('generated_code').notNull(),
  parameters: jsonb('parameters').notNull(),
  generatedBy: varchar('generated_by').notNull(),
  generatedAt: timestamp('generated_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const componentDefinitions = pgTable('component_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  componentName: varchar('component_name').notNull(),
  componentType: varchar('component_type').notNull(),
  definition: jsonb('definition').notNull(),
  props: jsonb('props').notNull().default('[]'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// FEEDBACK & IMPROVEMENT
// ============================================================================

export const feedbackAnalysis = pgTable('feedback_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  feedbackId: uuid('feedback_id').notNull(),
  analysisType: varchar('analysis_type').notNull(),
  sentiment: varchar('sentiment').$type<'positive' | 'negative' | 'neutral'>().notNull(),
  keywords: jsonb('keywords').notNull().default('[]'),
  insights: jsonb('insights').notNull().default('[]'),
  analyzedAt: timestamp('analyzed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const feedbackDeployments = pgTable('feedback_deployments', {
  id: uuid('id').primaryKey().defaultRandom(),
  feedbackId: uuid('feedback_id').notNull(),
  deploymentId: uuid('deployment_id').notNull(),
  status: varchar('status').$type<'pending' | 'deployed' | 'failed'>().default('pending'),
  deployedAt: timestamp('deployed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const improvementTasks = pgTable('improvement_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskName: varchar('task_name').notNull(),
  description: text('description'),
  priority: varchar('priority').$type<'low' | 'medium' | 'high' | 'critical'>().default('medium'),
  status: varchar('status')
    .$type<'todo' | 'in-progress' | 'completed' | 'cancelled'>()
    .default('todo'),
  assignedTo: varchar('assigned_to'),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// INTEGRATION STATUS
// ============================================================================

export const integrationStatus = pgTable('integration_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationName: varchar('integration_name').notNull(),
  status: varchar('status').$type<'active' | 'inactive' | 'error' | 'maintenance'>().notNull(),
  lastSync: timestamp('last_sync'),
  errorMessage: text('error_message'),
  config: jsonb('config').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const deploymentHistoryRelations = relations(deploymentHistory, ({ many }) => ({
  metrics: many(deploymentMetrics),
}));

export const deploymentMetricsRelations = relations(deploymentMetrics, ({ one }) => ({
  deployment: one(deploymentHistory, {
    fields: [deploymentMetrics.deploymentId],
    references: [deploymentHistory.id],
  }),
}));

export const automatedTestSuitesRelations = relations(automatedTestSuites, ({ many }) => ({
  results: many(liveTestResults),
}));

export const liveTestResultsRelations = relations(liveTestResults, ({ one }) => ({
  testSuite: one(automatedTestSuites, {
    fields: [liveTestResults.testSuiteId],
    references: [automatedTestSuites.id],
  }),
}));

export const provisioningWorkflowsRelations = relations(provisioningWorkflows, ({ many }) => ({
  steps: many(provisioningWorkflowSteps),
}));

export const provisioningWorkflowStepsRelations = relations(
  provisioningWorkflowSteps,
  ({ one }) => ({
    workflow: one(provisioningWorkflows, {
      fields: [provisioningWorkflowSteps.workflowId],
      references: [provisioningWorkflows.id],
    }),
  }),
);

export const codeGenerationTemplatesRelations = relations(codeGenerationTemplates, ({ many }) => ({
  history: many(generatedCodeHistory),
}));

export const generatedCodeHistoryRelations = relations(generatedCodeHistory, ({ one }) => ({
  template: one(codeGenerationTemplates, {
    fields: [generatedCodeHistory.templateId],
    references: [codeGenerationTemplates.id],
  }),
}));
