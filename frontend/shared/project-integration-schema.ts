/**
 * CreatorHub Norge - Project Integration Schema
 * Kobler prosjektopprettelse med wedding timeline, timeestimering og kontraktstyring
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
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enhanced Projects Table med bryllup-integrasjon
export const integratedProjects = pgTable('integrated_projects', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  projectType: varchar('project_type')
    .$type<'bryllup' | 'portrett' | 'bedrift' | 'kommersielt' | 'lifestyle'>()
    .notNull(),

  // Bryllup-spesifikke felter
  weddingTradition: varchar('wedding_tradition').$type<
    | 'norsk'
    | 'samisk'
    | 'pakistansk'
    | 'tyrkisk'
    | 'indisk'
    | 'afrikansk'
    | 'asiatisk'
    | 'europisk'
    | 'annet'
  >(),

  // Klient informasjon
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email'),
  clientPhone: varchar('client_phone'),

  // Timer og pris estimering
  estimatedHours: decimal('estimated_hours').notNull(),
  hourlyRate: decimal('hourly_rate').notNull(),
  totalEstimatedPrice: decimal('total_estimated_price').notNull(),

  // Integrasjons-koblinger
  weddingTimelineId: varchar('wedding_timeline_id'), // Kobling til wedding timeline
  contractId: varchar('contract_id'), // Kobling til kontrakt
  showcaseId: varchar('showcase_id'), // Kobling til showcase

  // Status tracking
  status: varchar('status')
    .default('draft')
    .$type<'draft' | 'active' | 'completed' | 'cancelled'>(),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Time Tracking Table for project hours
export const projectTimeTracking = pgTable('project_time_tracking', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => integratedProjects.id)
    .notNull(),

  // Time tracking details
  taskDescription: text('task_description').notNull(),
  hoursSpent: decimal('hours_spent').notNull(),
  dateWorked: date('date_worked').notNull(),
  timelineEventId: varchar('timeline_event_id'), // Kobling til wedding timeline event

  // Billing information
  billableHours: decimal('billable_hours').notNull(),
  rate: decimal('rate').notNull(),

  createdAt: timestamp('created_at').defaultNow(),
});

// Contract Management Table
export const projectContracts = pgTable('project_contracts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => integratedProjects.id)
    .notNull(),

  // Contract details
  contractTemplate: varchar('contract_template').notNull(),
  originalHours: decimal('original_hours').notNull(),
  originalPrice: decimal('original_price').notNull(),

  // Current contract state
  currentHours: decimal('current_hours').notNull(),
  currentPrice: decimal('current_price').notNull(),

  // Status and versioning
  version: integer('version').default(1),
  status: varchar('status')
    .default('draft')
    .$type<'draft' | 'sent' | 'signed' | 'revised' | 'expired'>(),

  // Signing details
  clientSignedAt: timestamp('client_signed_at'),
  photographerSignedAt: timestamp('photographer_signed_at'),
  contractFileUrl: varchar('contract_file_url'),

  // Revision tracking
  revisionReason: text('revision_reason'),
  previousVersion: varchar('previous_version'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Hour Overages and Contract Updates
export const hourOverages = pgTable('hour_overages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => integratedProjects.id)
    .notNull(),
  contractId: varchar('contract_id')
    .references(() => projectContracts.id)
    .notNull(),

  // Overage details
  originalHours: decimal('original_hours').notNull(),
  actualHours: decimal('actual_hours').notNull(),
  overageHours: decimal('overage_hours').notNull(),
  overageRate: decimal('overage_rate').notNull(),
  overageAmount: decimal('overage_amount').notNull(),

  // Status and communication
  status: varchar('status')
    .default('detected')
    .$type<'detected' | 'notified' | 'approved' | 'rejected' | 'contracted'>(),
  clientNotifiedAt: timestamp('client_notified_at'),
  clientResponse: text('client_response'),
  clientDecision: varchar('client_decision').$type<'approve' | 'reject' | 'negotiate'>(),

  // Contract update tracking
  newContractGenerated: boolean('new_contract_generated').default(false),
  newContractId: varchar('new_contract_id'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Wedding Timeline Integration Extension
export const weddingTimelineIntegration = pgTable('wedding_timeline_integration', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => integratedProjects.id)
    .notNull(),
  timelineId: varchar('timeline_id').notNull(), // Wedding timeline ID

  // Hour allocation per timeline event
  eventHourAllocations: jsonb('event_hour_allocations'), // { eventId: estimatedHours }

  // Time tracking integration
  automaticTimeTracking: boolean('automatic_time_tracking').default(true),

  // Showcase integration
  showcaseAutoUpdate: boolean('showcase_auto_update').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const integratedProjectsRelations = relations(integratedProjects, ({ many, one }) => ({
  timeTracking: many(projectTimeTracking),
  contracts: many(projectContracts),
  overages: many(hourOverages),
  weddingIntegration: one(weddingTimelineIntegration),
}));

export const projectTimeTrackingRelations = relations(projectTimeTracking, ({ one }) => ({
  project: one(integratedProjects, {
    fields: [projectTimeTracking.projectId],
    references: [integratedProjects.id],
  }),
}));

export const projectContractsRelations = relations(projectContracts, ({ one, many }) => ({
  project: one(integratedProjects, {
    fields: [projectContracts.projectId],
    references: [integratedProjects.id],
  }),
  overages: many(hourOverages),
}));

export const hourOveragesRelations = relations(hourOverages, ({ one }) => ({
  project: one(integratedProjects, {
    fields: [hourOverages.projectId],
    references: [integratedProjects.id],
  }),
  contract: one(projectContracts, {
    fields: [hourOverages.contractId],
    references: [projectContracts.id],
  }),
}));

// Zod schemas for validation
export const insertIntegratedProjectSchema = createInsertSchema(integratedProjects);
export const insertProjectTimeTrackingSchema = createInsertSchema(projectTimeTracking);
export const insertProjectContractSchema = createInsertSchema(projectContracts);
export const insertHourOverageSchema = createInsertSchema(hourOverages);

// TypeScript types
export type IntegratedProject = typeof integratedProjects.$inferSelect;
export type InsertIntegratedProject = typeof integratedProjects.$inferInsert;
export type ProjectTimeTracking = typeof projectTimeTracking.$inferSelect;
export type InsertProjectTimeTracking = typeof projectTimeTracking.$inferInsert;
export type ProjectContract = typeof projectContracts.$inferSelect;
export type InsertProjectContract = typeof projectContracts.$inferInsert;
export type HourOverage = typeof hourOverages.$inferSelect;
export type InsertHourOverage = typeof hourOverages.$inferInsert;
export type WeddingTimelineIntegration = typeof weddingTimelineIntegration.$inferSelect;
export type InsertWeddingTimelineIntegration = typeof weddingTimelineIntegration.$inferInsert;
