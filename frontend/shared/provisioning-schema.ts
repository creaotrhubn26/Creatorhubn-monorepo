import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './schema';

// User Provisioning Requests Table
export const userProvisioningRequests = pgTable(
  'user_provisioning_requests',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userType: varchar('user_type')
      .notNull()
      .$type<'photographer' | 'videographer' | 'music_producer' | 'designer' | 'writer'>(),
    businessName: varchar('business_name'),
    organizationNumber: varchar('organization_number'),
    phoneNumber: varchar('phone_number'),
    website: varchar('website'),
    status: varchar('status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'approved' | 'rejected' | 'provisioned'>(),
    adminNotes: text('admin_notes'),
    requestedAt: timestamp('requested_at').defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: varchar('reviewed_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userTypeCheck: check(
      'user_type_check',
      sql`${table.userType} IN ('photographer', 'videographer', 'music_producer', 'designer', 'writer')`,
    ),
    statusCheck: check(
      'status_check',
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'provisioned')`,
    ),
  }),
);

// Provisioning Workflows Table
export const provisioningWorkflows = pgTable(
  'provisioning_workflows',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name').notNull(),
    description: text('description'),
    workflowType: varchar('workflow_type')
      .notNull()
      .$type<'standard' | 'music_producer' | 'photographer' | 'videographer' | 'custom'>(),
    status: varchar('status')
      .notNull()
      .default('idle')
      .$type<'idle' | 'running' | 'completed' | 'failed' | 'paused'>(),
    progress: integer('progress').default(0).$type<number>(),
    currentStep: integer('current_step').default(0),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    workflowTypeCheck: check(
      'workflow_type_check',
      sql`${table.workflowType} IN ('standard', 'music_producer', 'photographer', 'videographer', 'custom')`,
    ),
    statusCheck: check(
      'status_check',
      sql`${table.status} IN ('idle', 'running', 'completed', 'failed', 'paused')`,
    ),
    progressCheck: check(
      'progress_check',
      sql`${table.progress} >= 0 AND ${table.progress} <= 100`,
    ),
  }),
);

// Provisioning Workflow Steps Table
export const provisioningWorkflowSteps = pgTable(
  'provisioning_workflow_steps',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workflowId: varchar('workflow_id')
      .notNull()
      .references(() => provisioningWorkflows.id, { onDelete: 'cascade' }),
    stepName: varchar('step_name').notNull(),
    stepDescription: text('step_description'),
    stepOrder: integer('step_order').notNull(),
    status: varchar('status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'running' | 'completed' | 'failed' | 'skipped'>(),
    durationSeconds: integer('duration_seconds'),
    errorMessage: text('error_message'),
    dependencies: jsonb('dependencies').default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    statusCheck: check(
      'status_check',
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed', 'skipped')`,
    ),
  }),
);

// Integration Status Table
export const integrationStatus = pgTable(
  'integration_status',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name').notNull(),
    integrationType: varchar('integration_type')
      .notNull()
      .$type<
        'authentication' | 'storage' | 'api' | 'compliance' | 'billing' | 'email' | 'analytics'
      >(),
    status: varchar('status')
      .notNull()
      .default('inactive')
      .$type<'active' | 'inactive' | 'error' | 'pending'>(),
    healthStatus: varchar('health_status')
      .notNull()
      .default('unknown')
      .$type<'healthy' | 'degraded' | 'down' | 'unknown'>(),
    lastChecked: timestamp('last_checked').defaultNow(),
    errorMessage: text('error_message'),
    responseTimeMs: integer('response_time_ms'),
    uptimePercentage: decimal('uptime_percentage', { precision: 5, scale: 2 }),
    errorRate: decimal('error_rate', { precision: 5, scale: 2 }),
    configuration: jsonb('configuration').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    integrationTypeCheck: check(
      'integration_type_check',
      sql`${table.integrationType} IN ('authentication', 'storage', 'api', 'compliance', 'billing', 'email', 'analytics')`,
    ),
    statusCheck: check(
      'status_check',
      sql`${table.status} IN ('active', 'inactive', 'error', 'pending')`,
    ),
    healthStatusCheck: check(
      'health_status_check',
      sql`${table.healthStatus} IN ('healthy', 'degraded', 'down', 'unknown')`,
    ),
  }),
);

// User Provisioning Status Table
export const userProvisioningStatus = pgTable('user_provisioning_status', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  userType: varchar('user_type').notNull(),
  integrationsEnabled: boolean('integrations_enabled').default(false),
  damConnected: boolean('dam_connected').default(false),
  norwegianCompliance: boolean('norwegian_compliance').default(false),
  microsoftAuthReady: boolean('microsoft_auth_ready').default(false),
  activatedIntegrations: jsonb('activated_integrations').default(sql`'[]'::jsonb`),
  provisioningCompletedAt: timestamp('provisioning_completed_at'),
  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Provisioning Metrics Table
export const provisioningMetrics = pgTable('provisioning_metrics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metricDate: timestamp('metric_date').notNull(),
  totalUsers: integer('total_users').default(0),
  activeWorkflows: integer('active_workflows').default(0),
  completedToday: integer('completed_today').default(0),
  averageProvisioningTime: decimal('average_provisioning_time', { precision: 8, scale: 2 }),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),
  errorRate: decimal('error_rate', { precision: 5, scale: 2 }),
  integrationsHealthy: integer('integrations_healthy').default(0),
  integrationsTotal: integer('integrations_total').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Admin Provisioning Actions Table
export const adminProvisioningActions = pgTable(
  'admin_provisioning_actions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    adminUserId: varchar('admin_user_id')
      .notNull()
      .references(() => users.id),
    actionType: varchar('action_type')
      .notNull()
      .$type<
        | 'approve'
        | 'reject'
        | 'bulk_approve'
        | 'start_workflow'
        | 'stop_workflow'
        | 'restart_workflow'
      >(),
    targetUserId: varchar('target_user_id').references(() => users.id),
    workflowId: varchar('workflow_id').references(() => provisioningWorkflows.id),
    details: jsonb('details').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    actionTypeCheck: check(
      'action_type_check',
      sql`${table.actionType} IN ('approve', 'reject', 'bulk_approve', 'start_workflow', 'stop_workflow', 'restart_workflow')`,
    ),
  }),
);

// Type definitions for better TypeScript support
export type UserProvisioningRequest = typeof userProvisioningRequests.$inferSelect;
export type NewUserProvisioningRequest = typeof userProvisioningRequests.$inferInsert;

export type ProvisioningWorkflow = typeof provisioningWorkflows.$inferSelect;
export type NewProvisioningWorkflow = typeof provisioningWorkflows.$inferInsert;

export type ProvisioningWorkflowStep = typeof provisioningWorkflowSteps.$inferSelect;
export type NewProvisioningWorkflowStep = typeof provisioningWorkflowSteps.$inferInsert;

export type IntegrationStatus = typeof integrationStatus.$inferSelect;
export type NewIntegrationStatus = typeof integrationStatus.$inferInsert;

export type UserProvisioningStatus = typeof userProvisioningStatus.$inferSelect;
export type NewUserProvisioningStatus = typeof userProvisioningStatus.$inferInsert;

export type ProvisioningMetrics = typeof provisioningMetrics.$inferSelect;
export type NewProvisioningMetrics = typeof provisioningMetrics.$inferInsert;

export type AdminProvisioningAction = typeof adminProvisioningActions.$inferSelect;
export type NewAdminProvisioningAction = typeof adminProvisioningActions.$inferInsert;
