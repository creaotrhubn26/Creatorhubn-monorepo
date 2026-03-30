import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const professionFeatureOverrides = pgTable(
  'profession_feature_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    professionId: varchar('profession_id', { length: 100 }).notNull(),
    featureId: varchar('feature_id', { length: 255 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    source: varchar('source', { length: 50 }).default('admin'),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    createdBy: varchar('created_by', { length: 255 }),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (table) => ({
    professionFeatureIdx: index('profession_feature_overrides_profession_feature_idx').on(
      table.professionId,
      table.featureId,
    ),
  }),
);

export const dashboardConfigOverrides = pgTable(
  'dashboard_config_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    professionId: varchar('profession_id', { length: 100 }).notNull(),
    dashboardId: varchar('dashboard_id', { length: 255 }).notNull(),
    config: jsonb('config').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    createdBy: varchar('created_by', { length: 255 }),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (table) => ({
    dashboardConfigIdx: index('dashboard_config_overrides_profession_dashboard_idx').on(
      table.professionId,
      table.dashboardId,
    ),
  }),
);

export const userFeatureOverrides = pgTable(
  'user_feature_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    featureId: varchar('feature_id', { length: 255 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    reason: text('reason'),
    expiresAt: timestamp('expires_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    createdBy: varchar('created_by', { length: 255 }),
    updatedBy: varchar('updated_by', { length: 255 }),
  },
  (table) => ({
    userFeatureIdx: index('user_feature_overrides_user_feature_idx').on(table.userId, table.featureId),
  }),
);

export const userMetadata = pgTable(
  'user_metadata',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull().unique(),
    professionId: varchar('profession_id', { length: 100 }),
    plan: varchar('plan', { length: 50 }).default('basic'),
    betaTester: boolean('beta_tester').notNull().default(false),
    vip: boolean('vip').notNull().default(false),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    flags: jsonb('flags').$type<Record<string, boolean>>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userMetadataUserIdx: index('user_metadata_user_idx').on(table.userId),
  }),
);

export const featureManagementAudit = pgTable(
  'feature_management_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: varchar('actor_user_id', { length: 255 }).notNull(),
    targetUserId: varchar('target_user_id', { length: 255 }),
    professionId: varchar('profession_id', { length: 100 }),
    featureId: varchar('feature_id', { length: 255 }),
    dashboardId: varchar('dashboard_id', { length: 255 }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    previousValue: jsonb('previous_value'),
    nextValue: jsonb('next_value'),
    note: text('note'),
    severity: integer('severity').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    featureAuditActorIdx: index('feature_management_audit_actor_idx').on(table.actorUserId),
  }),
);

export type ProfessionFeatureOverride = typeof professionFeatureOverrides.$inferSelect;
export type NewProfessionFeatureOverride = typeof professionFeatureOverrides.$inferInsert;

export type DashboardConfigOverride = typeof dashboardConfigOverrides.$inferSelect;
export type NewDashboardConfigOverride = typeof dashboardConfigOverrides.$inferInsert;

export type UserFeatureOverride = typeof userFeatureOverrides.$inferSelect;
export type NewUserFeatureOverride = typeof userFeatureOverrides.$inferInsert;

export type UserMetadata = typeof userMetadata.$inferSelect;
export type NewUserMetadata = typeof userMetadata.$inferInsert;

export type FeatureManagementAuditLog = typeof featureManagementAudit.$inferSelect;
export type NewFeatureManagementAuditLog = typeof featureManagementAudit.$inferInsert;
