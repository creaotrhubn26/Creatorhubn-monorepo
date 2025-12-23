/**
 * CreatorHub Norge - Enterprise Schema
 * Complete enterprise database schema for CRM, billing, RBAC, and business management
 */

import {
  pgTable,
  text,
  varchar,
  uuid,
  timestamp,
  boolean,
  decimal,
  jsonb,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// ================================
// SUBSCRIPTION & BILLING TABLES
// ================================

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    description: text('description'),
    priceNOK: decimal('price_nok', { precision: 10, scale: 2 }).notNull(),
    priceSEK: decimal('price_sek', { precision: 10, scale: 2 }),
    priceDKK: decimal('price_dkk', { precision: 10, scale: 2 }),
    stripePriceId: varchar('stripe_price_id', { length: 100 }),
    interval: varchar('interval', { length: 20 }).notNull().default('month'), // month, year
    intervalCount: integer('interval_count').notNull().default(1),
    trialDays: integer('trial_days').default(14),
    features: jsonb('features').notNull().default({}),
    limits: jsonb('limits').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('subscription_plans_name_idx').on(table.name),
    activeIdx: index('subscription_plans_active_idx').on(table.isActive),
  }),
);

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 100 }).notNull(),
    planId: uuid('plan_id')
      .references(() => subscriptionPlans.id)
      .notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
    status: varchar('status', { length: 50 }).notNull(), // active, canceled, incomplete, past_due, etc.
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_subscriptions_user_id_idx').on(table.userId),
    statusIdx: index('user_subscriptions_status_idx').on(table.status),
    stripeSubIdx: index('user_subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 100 }).notNull(),
    subscriptionId: uuid('subscription_id').references(() => userSubscriptions.id),
    stripeInvoiceId: varchar('stripe_invoice_id', { length: 100 }),
    number: varchar('number', { length: 50 }).notNull().unique(),
    amountNOK: decimal('amount_nok', { precision: 10, scale: 2 }).notNull(),
    vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('NOK'),
    status: varchar('status', { length: 50 }).notNull(), // draft, open, paid, void, uncollectible
    dueDate: timestamp('due_date'),
    paidAt: timestamp('paid_at'),
    description: text('description'),
    lineItems: jsonb('line_items').notNull().default([]),
    kidNumber: varchar('kid_number', { length: 25 }), // Norwegian KID number
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('invoices_user_id_idx').on(table.userId),
    statusIdx: index('invoices_status_idx').on(table.status),
    numberIdx: index('invoices_number_idx').on(table.number),
  }),
);

// ================================
// RBAC (Role-Based Access Control) TABLES
// ================================

export const organizationRoles = pgTable(
  'organization_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    description: text('description'),
    scope: varchar('scope', { length: 50 }).notNull(), // global, organization, project
    permissions: jsonb('permissions').notNull().default({}),
    guardrails: jsonb('guardrails').default({}), // Additional security rules
    isSystemRole: boolean('is_system_role').default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('organization_roles_name_idx').on(table.name),
    scopeIdx: index('organization_roles_scope_idx').on(table.scope),
    activeIdx: index('organization_roles_active_idx').on(table.isActive),
  }),
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 100 }).notNull(),
    roleId: uuid('role_id')
      .references(() => organizationRoles.id)
      .notNull(),
    organizationId: varchar('organization_id', { length: 100 }),
    projectId: varchar('project_id', { length: 100 }),
    assignedBy: varchar('assigned_by', { length: 100 }).notNull(),
    effectiveFrom: timestamp('effective_from').defaultNow(),
    effectiveUntil: timestamp('effective_until'),
    isActive: boolean('is_active').notNull().default(true),
    attributes: jsonb('attributes').default({}), // For ABAC (Attribute-Based Access Control)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_roles_user_id_idx').on(table.userId),
    roleIdIdx: index('user_roles_role_id_idx').on(table.roleId),
    activeIdx: index('user_roles_active_idx').on(table.isActive),
    userRoleIdx: index('user_roles_user_role_idx').on(table.userId, table.roleId),
  }),
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 100 }),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }),
    changes: jsonb('changes'), // { before: {}, after: {} }
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    sessionId: varchar('session_id', { length: 100 }),
    severity: varchar('severity', { length: 20 }).default('info'), // info, warning, error, critical
    tags: jsonb('tags').default([]),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('audit_log_user_id_idx').on(table.userId),
    actionIdx: index('audit_log_action_idx').on(table.action),
    resourceIdx: index('audit_log_resource_idx').on(table.resource),
    timestampIdx: index('audit_log_timestamp_idx').on(table.timestamp),
    severityIdx: index('audit_log_severity_idx').on(table.severity),
  }),
);

// ================================
// CRM TABLES
// ================================

export const crmCustomers = pgTable(
  'crm_customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 200 }),
    phone: varchar('phone', { length: 50 }),
    organizationNumber: varchar('organization_number', { length: 20 }), // Norwegian org number
    address: jsonb('address').default({}),
    industry: varchar('industry', { length: 100 }),
    source: varchar('source', { length: 100 }), // website, referral, social media, etc.
    status: varchar('status', { length: 50 }).notNull().default('lead'), // lead, prospect, customer, inactive
    assignedTo: varchar('assigned_to', { length: 100 }),
    tags: jsonb('tags').default([]),
    customFields: jsonb('custom_fields').default({}),
    notes: text('notes'),
    lastContact: timestamp('last_contact'),
    nextFollowUp: timestamp('next_follow_up'),
    lifetimeValue: decimal('lifetime_value', {
      precision: 12,
      scale: 2,
    }).default('0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('crm_customers_name_idx').on(table.name),
    emailIdx: index('crm_customers_email_idx').on(table.email),
    statusIdx: index('crm_customers_status_idx').on(table.status),
    assignedToIdx: index('crm_customers_assigned_to_idx').on(table.assignedTo),
  }),
);

export const crmDeals = pgTable(
  'crm_deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .references(() => crmCustomers.id)
      .notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    value: decimal('value', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    stage: varchar('stage', { length: 50 }).notNull().default('qualifying'), // qualifying, proposal, negotiation, closed_won, closed_lost
    probability: integer('probability').default(50), // 0-100
    expectedCloseDate: timestamp('expected_close_date'),
    actualCloseDate: timestamp('actual_close_date'),
    assignedTo: varchar('assigned_to', { length: 100 }),
    source: varchar('source', { length: 100 }),
    lostReason: varchar('lost_reason', { length: 200 }),
    tags: jsonb('tags').default([]),
    customFields: jsonb('custom_fields').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index('crm_deals_customer_id_idx').on(table.customerId),
    stageIdx: index('crm_deals_stage_idx').on(table.stage),
    assignedToIdx: index('crm_deals_assigned_to_idx').on(table.assignedTo),
    closeDistributionIdx: index('crm_deals_close_date_idx').on(table.expectedCloseDate),
  }),
);

// ================================
// PROJECT MANAGEMENT TABLES
// ================================

export const businessProjects = pgTable(
  'business_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').references(() => crmCustomers.id),
    dealId: uuid('deal_id').references(() => crmDeals.id),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 100 }).notNull(), // photography, videography, music_production, etc.
    status: varchar('status', { length: 50 }).notNull().default('planning'), // planning, active, on_hold, completed, cancelled
    priority: varchar('priority', { length: 20 }).default('medium'), // low, medium, high, urgent
    startDate: timestamp('start_date'),
    dueDate: timestamp('due_date'),
    completedDate: timestamp('completed_date'),
    budget: decimal('budget', { precision: 12, scale: 2 }),
    actualCost: decimal('actual_cost', { precision: 12, scale: 2 }),
    ownerId: varchar('owner_id', { length: 100 }).notNull(),
    teamMembers: jsonb('team_members').default([]),
    tags: jsonb('tags').default([]),
    customFields: jsonb('custom_fields').default({}),
    progress: integer('progress').default(0), // 0-100
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index('business_projects_customer_id_idx').on(table.customerId),
    statusIdx: index('business_projects_status_idx').on(table.status),
    ownerIdIdx: index('business_projects_owner_id_idx').on(table.ownerId),
    dueDateIdx: index('business_projects_due_date_idx').on(table.dueDate),
  }),
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => businessProjects.id),
    parentTaskId: uuid('parent_task_id'),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('todo'), // todo, in_progress, review, completed, cancelled
    priority: varchar('priority', { length: 20 }).default('medium'),
    assignedTo: varchar('assigned_to', { length: 100 }),
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    estimatedHours: decimal('estimated_hours', { precision: 5, scale: 2 }),
    actualHours: decimal('actual_hours', { precision: 5, scale: 2 }),
    startDate: timestamp('start_date'),
    dueDate: timestamp('due_date'),
    completedDate: timestamp('completed_date'),
    tags: jsonb('tags').default([]),
    attachments: jsonb('attachments').default([]),
    dependencies: jsonb('dependencies').default([]),
    customFields: jsonb('custom_fields').default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('tasks_project_id_idx').on(table.projectId),
    statusIdx: index('tasks_status_idx').on(table.status),
    assignedToIdx: index('tasks_assigned_to_idx').on(table.assignedTo),
    dueDateIdx: index('tasks_due_date_idx').on(table.dueDate),
  }),
);

// ================================
// CONTENT & ASSET MANAGEMENT
// ================================

export const contentAssets = pgTable(
  'content_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => businessProjects.id),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).notNull(), // image, video, audio, document, etc.
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: integer('file_size'),
    filePath: text('file_path'),
    thumbnailPath: text('thumbnail_path'),
    metadata: jsonb('metadata').default({}),
    tags: jsonb('tags').default([]),
    status: varchar('status', { length: 50 }).default('active'), // active, archived, deleted
    uploadedBy: varchar('uploaded_by', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('content_assets_project_id_idx').on(table.projectId),
    typeIdx: index('content_assets_type_idx').on(table.type),
    statusIdx: index('content_assets_status_idx').on(table.status),
  }),
);

// ================================
// AUTOMATION SYSTEM
// ================================

export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    trigger: jsonb('trigger').notNull(), // Event definition
    conditions: jsonb('conditions').default([]), // Additional conditions
    actions: jsonb('actions').notNull(), // Actions to execute
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by', { length: 100 }).notNull(),
    lastTriggered: timestamp('last_triggered'),
    executionCount: integer('execution_count').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    activeIdx: index('automation_rules_active_idx').on(table.isActive),
    createdByIdx: index('automation_rules_created_by_idx').on(table.createdBy),
  }),
);

// ================================
// RELATIONS
// ================================

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  userSubscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  subscription: one(userSubscriptions, {
    fields: [invoices.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

export const organizationRolesRelations = relations(organizationRoles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  role: one(organizationRoles, {
    fields: [userRoles.roleId],
    references: [organizationRoles.id],
  }),
}));

export const crmCustomersRelations = relations(crmCustomers, ({ many }) => ({
  deals: many(crmDeals),
  projects: many(businessProjects),
}));

export const crmDealsRelations = relations(crmDeals, ({ one, many }) => ({
  customer: one(crmCustomers, {
    fields: [crmDeals.customerId],
    references: [crmCustomers.id],
  }),
  projects: many(businessProjects),
}));

export const businessProjectsRelations = relations(businessProjects, ({ one, many }) => ({
  customer: one(crmCustomers, {
    fields: [businessProjects.customerId],
    references: [crmCustomers.id],
  }),
  deal: one(crmDeals, {
    fields: [businessProjects.dealId],
    references: [crmDeals.id],
  }),
  tasks: many(tasks),
  assets: many(contentAssets),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(businessProjects, {
    fields: [tasks.projectId],
    references: [businessProjects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
  }),
  subtasks: many(tasks),
}));

export const contentAssetsRelations = relations(contentAssets, ({ one }) => ({
  project: one(businessProjects, {
    fields: [contentAssets.projectId],
    references: [businessProjects.id],
  }),
}));

// ================================
// ZOD SCHEMAS FOR VALIDATION
// ================================

// Subscription Plans
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const updateSubscriptionPlanSchema = insertSubscriptionPlanSchema.partial();
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// User Subscriptions
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions);
export const updateUserSubscriptionSchema = insertUserSubscriptionSchema.partial();
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// Invoices
export const insertInvoiceSchema = createInsertSchema(invoices);
export const updateInvoiceSchema = insertInvoiceSchema.partial();
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// RBAC
export const insertOrganizationRoleSchema = createInsertSchema(organizationRoles);
export const updateOrganizationRoleSchema = insertOrganizationRoleSchema.partial();
export type InsertOrganizationRole = z.infer<typeof insertOrganizationRoleSchema>;
export type OrganizationRole = typeof organizationRoles.$inferSelect;

export const insertUserRoleSchema = createInsertSchema(userRoles);
export const updateUserRoleSchema = insertUserRoleSchema.partial();
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export const insertAuditLogSchema = createInsertSchema(auditLog);
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// CRM
export const insertCrmCustomerSchema = createInsertSchema(crmCustomers);
export const updateCrmCustomerSchema = insertCrmCustomerSchema.partial();
export type InsertCrmCustomer = z.infer<typeof insertCrmCustomerSchema>;
export type CrmCustomer = typeof crmCustomers.$inferSelect;

export const insertCrmDealSchema = createInsertSchema(crmDeals);
export const updateCrmDealSchema = insertCrmDealSchema.partial();
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type CrmDeal = typeof crmDeals.$inferSelect;

// Projects & Tasks
export const insertBusinessProjectSchema = createInsertSchema(businessProjects);
export const updateBusinessProjectSchema = insertBusinessProjectSchema.partial();
export type InsertBusinessProject = z.infer<typeof insertBusinessProjectSchema>;
export type BusinessProject = typeof businessProjects.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasks);
export const updateTaskSchema = insertTaskSchema.partial();
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Content Assets
export const insertContentAssetSchema = createInsertSchema(contentAssets);
export const updateContentAssetSchema = insertContentAssetSchema.partial();
export type InsertContentAsset = z.infer<typeof insertContentAssetSchema>;
export type ContentAsset = typeof contentAssets.$inferSelect;

// Automation
export const insertAutomationRuleSchema = createInsertSchema(automationRules);
export const updateAutomationRuleSchema = insertAutomationRuleSchema.partial();
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type AutomationRule = typeof automationRules.$inferSelect;
