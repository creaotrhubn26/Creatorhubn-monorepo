import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  boolean,
  decimal,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Unified Wedding Projects Table
export const weddingProjects = pgTable('wedding_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleNames: varchar('couple_names', { length: 255 }).notNull(),
  weddingDate: timestamp('wedding_date').notNull(),
  venue: varchar('venue', { length: 500 }).notNull(),
  style: varchar('style', { length: 100 }).notNull(),
  services: jsonb('services').$type<string[]>().notNull().default([]),
  budget: decimal('budget', { precision: 10, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 50 }).notNull().default('planning'), // planning, in_progress, completed
  norwegianElements: jsonb('norwegian_elements').$type<string[]>().default([]),
  culturalContext: varchar('cultural_context', { length: 100 }),
  contractTerms: jsonb('contract_terms').$type<Record<string, any>>().default({}),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by', { length: 100 }).notNull(),
});

// Wedding Team Members (unified across all disciplines)
export const weddingTeamMembers = pgTable('wedding_team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingProjectId: uuid('wedding_project_id')
    .notNull()
    .references(() => weddingProjects.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 100 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // photographer, videographer, music_producer, coordinator
  responsibilities: jsonb('responsibilities').$type<string[]>().default([]),
  assignedAt: timestamp('assigned_at').defaultNow(),
  status: varchar('status', { length: 50 }).default('active'), // active, inactive, completed
  specializations: jsonb('specializations').$type<string[]>().default([]),
  contactInfo: jsonb('contact_info').$type<Record<string, any>>().default({}),
});

// Unified Wedding Timeline
export const weddingTimeline = pgTable('wedding_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingProjectId: uuid('wedding_project_id')
    .notNull()
    .references(() => weddingProjects.id, { onDelete: 'cascade' }),
  eventTime: timestamp('event_time').notNull(),
  eventName: varchar('event_name', { length: 255 }).notNull(),
  location: varchar('location', { length: 500 }),
  duration: integer('duration_minutes'),
  teamRequired: jsonb('team_required').$type<string[]>().default([]), // roles needed for this event
  equipmentNeeded: jsonb('equipment_needed').$type<string[]>().default([]),
  norwegianTraditions: jsonb('norwegian_traditions').$type<string[]>().default([]),
  notes: text('notes'),
  priority: varchar('priority', { length: 20 }).default('medium'), // high, medium, low
  status: varchar('status', { length: 50 }).default('planned'), // planned, in_progress, completed, cancelled
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Wedding Clients (unified contact management)
export const weddingClients = pgTable('wedding_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingProjectId: uuid('wedding_project_id')
    .notNull()
    .references(() => weddingProjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // bride, groom, parent, planner, vendor
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  preferences: jsonb('preferences').$type<string[]>().default([]),
  communicationPreference: varchar('communication_preference', {
    length: 50,
  }).default('email'),
  norwegianLanguagePreference: boolean('norwegian_language_preference').default(true),
  emergencyContact: boolean('emergency_contact').default(false),
  decisionMaker: boolean('decision_maker').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Unified Wedding Assets (photos, videos, audio)
export const weddingAssets = pgTable('wedding_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingProjectId: uuid('wedding_project_id')
    .notNull()
    .references(() => weddingProjects.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // photo, video, audio, document
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  thumbnailPath: varchar('thumbnail_path', { length: 500 }),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  tags: jsonb('tags').$type<string[]>().default([]),
  norwegianKeywords: jsonb('norwegian_keywords').$type<string[]>().default([]),
  approvalStatus: varchar('approval_status', { length: 50 }).default('pending'), // pending, approved, rejected, revision_needed
  approvedBy: jsonb('approved_by').$type<string[]>().default([]),
  rejectionReason: text('rejection_reason'),
  timelineEventId: uuid('timeline_event_id').references(() => weddingTimeline.id),
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  approvedAt: timestamp('approved_at'),
});

// Wedding Tasks (unified workflow management)
export const weddingTasks = pgTable('wedding_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingProjectId: uuid('wedding_project_id')
    .notNull()
    .references(() => weddingProjects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  assignedTo: varchar('assigned_to', { length: 100 }).notNull(),
  assignedRole: varchar('assigned_role', { length: 50 }), // photographer, videographer, music_producer
  dueDate: timestamp('due_date'),
  priority: varchar('priority', { length: 20 }).default('medium'),
  status: varchar('status', { length: 50 }).default('pending'), // pending, in_progress, completed, cancelled
  category: varchar('category', { length: 100 }), // pre_production, production, post_production, delivery
  norwegianInstructions: text('norwegian_instructions'),
  relatedAssets: jsonb('related_assets').$type<string[]>().default([]),
  timelineEventId: uuid('timeline_event_id').references(() => weddingTimeline.id),
  completedAt: timestamp('completed_at'),
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Wedding Contracts (unified contract management)
export const weddingContracts = pgTable('wedding_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  weddingProjectId: uuid('wedding_project_id')
    .notNull()
    .references(() => weddingProjects.id, { onDelete: 'cascade' }),
  contractType: varchar('contract_type', { length: 100 }).notNull(), // master_agreement, photography, videography, music_production
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  norwegianTerms: jsonb('norwegian_terms').$type<Record<string, any>>().default({}),
  signedBy: jsonb('signed_by').$type<string[]>().default([]),
  signedAt: timestamp('signed_at'),
  status: varchar('status', { length: 50 }).default('draft'), // draft, sent, signed, executed, cancelled
  totalValue: decimal('total_value', { precision: 10, scale: 2 }),
  paymentSchedule: jsonb('payment_schedule').$type<Record<string, any>>().default({}),
  deliverables: jsonb('deliverables').$type<string[]>().default([]),
  norwegianLegalCompliance: boolean('norwegian_legal_compliance').default(true),
  gdprCompliant: boolean('gdpr_compliant').default(true),
  validUntil: timestamp('valid_until'),
  createdBy: varchar('created_by', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const weddingProjectsRelations = relations(weddingProjects, ({ many }) => ({
  teamMembers: many(weddingTeamMembers),
  timeline: many(weddingTimeline),
  clients: many(weddingClients),
  assets: many(weddingAssets),
  tasks: many(weddingTasks),
  contracts: many(weddingContracts),
}));

export const weddingTeamMembersRelations = relations(weddingTeamMembers, ({ one }) => ({
  project: one(weddingProjects, {
    fields: [weddingTeamMembers.weddingProjectId],
    references: [weddingProjects.id],
  }),
}));

export const weddingTimelineRelations = relations(weddingTimeline, ({ one, many }) => ({
  project: one(weddingProjects, {
    fields: [weddingTimeline.weddingProjectId],
    references: [weddingProjects.id],
  }),
  assets: many(weddingAssets),
  tasks: many(weddingTasks),
}));

export const weddingClientsRelations = relations(weddingClients, ({ one }) => ({
  project: one(weddingProjects, {
    fields: [weddingClients.weddingProjectId],
    references: [weddingProjects.id],
  }),
}));

export const weddingAssetsRelations = relations(weddingAssets, ({ one }) => ({
  project: one(weddingProjects, {
    fields: [weddingAssets.weddingProjectId],
    references: [weddingProjects.id],
  }),
  timelineEvent: one(weddingTimeline, {
    fields: [weddingAssets.timelineEventId],
    references: [weddingTimeline.id],
  }),
}));

export const weddingTasksRelations = relations(weddingTasks, ({ one }) => ({
  project: one(weddingProjects, {
    fields: [weddingTasks.weddingProjectId],
    references: [weddingProjects.id],
  }),
  timelineEvent: one(weddingTimeline, {
    fields: [weddingTasks.timelineEventId],
    references: [weddingTimeline.id],
  }),
}));

export const weddingContractsRelations = relations(weddingContracts, ({ one }) => ({
  project: one(weddingProjects, {
    fields: [weddingContracts.weddingProjectId],
    references: [weddingProjects.id],
  }),
}));

// Zod schemas for validation
export const insertWeddingProjectSchema = createInsertSchema(weddingProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeddingTeamMemberSchema = createInsertSchema(weddingTeamMembers).omit({
  id: true,
  assignedAt: true,
});

export const insertWeddingTimelineSchema = createInsertSchema(weddingTimeline).omit({
  id: true,
  createdAt: true,
});

export const insertWeddingClientSchema = createInsertSchema(weddingClients).omit({
  id: true,
  createdAt: true,
});

export const insertWeddingAssetSchema = createInsertSchema(weddingAssets).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const insertWeddingTaskSchema = createInsertSchema(weddingTasks).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertWeddingContractSchema = createInsertSchema(weddingContracts).omit({
  id: true,
  createdAt: true,
  signedAt: true,
});

// TypeScript types
export type WeddingProject = typeof weddingProjects.$inferSelect;
export type InsertWeddingProject = z.infer<typeof insertWeddingProjectSchema>;
export type WeddingTeamMember = typeof weddingTeamMembers.$inferSelect;
export type InsertWeddingTeamMember = z.infer<typeof insertWeddingTeamMemberSchema>;
export type WeddingTimelineEvent = typeof weddingTimeline.$inferSelect;
export type InsertWeddingTimelineEvent = z.infer<typeof insertWeddingTimelineSchema>;
export type WeddingClient = typeof weddingClients.$inferSelect;
export type InsertWeddingClient = z.infer<typeof insertWeddingClientSchema>;
export type WeddingAsset = typeof weddingAssets.$inferSelect;
export type InsertWeddingAsset = z.infer<typeof insertWeddingAssetSchema>;
export type WeddingTask = typeof weddingTasks.$inferSelect;
export type InsertWeddingTask = z.infer<typeof insertWeddingTaskSchema>;
export type WeddingContract = typeof weddingContracts.$inferSelect;
export type InsertWeddingContract = z.infer<typeof insertWeddingContractSchema>;
