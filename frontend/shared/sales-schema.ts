/**
 * Sales Management Schema - CRM and sales conversation system
 * Integrates with client submissions, contracts, and project workflows
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
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

// Sales Leads Table - Enhanced version of client submissions for CRM
export const salesLeads = pgTable('sales_leads', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name').notNull(),
  email: varchar('email').notNull(),
  phone: varchar('phone'),
  company: varchar('company'),
  projectType: varchar('project_type').notNull(), // bryllupsfotografi, bedriftsfotografi, portrettfotografi
  status: varchar('status')
    .$type<'cold' | 'warm' | 'hot' | 'qualified' | 'proposal' | 'negotiation' | 'closed' | 'lost'>()
    .default('cold'),
  source: varchar('source').notNull(), // Google Søk, LinkedIn, Referanse, Instagram
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  probability: integer('probability').default(50), // 0-100%
  lastContact: timestamp('last_contact').defaultNow(),
  nextFollow: timestamp('next_follow'),
  timeline: varchar('timeline'), // Event date or project deadline
  location: varchar('location'),
  specialRequests: text('special_requests'),
  // Customer analysis from smart analyzer
  customerType: varchar('customer_type').$type<
    | 'budget_conscious'
    | 'quality_focused'
    | 'time_sensitive'
    | 'luxury_seeker'
    | 'indecisive'
    | 'professional_buyer'
  >(),
  budgetTier: varchar('budget_tier')
    .$type<'economy' | 'standard' | 'premium' | 'luxury'>()
    .default('standard'),
  urgency: varchar('urgency').$type<'low' | 'medium' | 'high'>().default('medium'),
  salesApproach: text('sales_approach'),
  recommendedActions: jsonb('recommended_actions').$type<string[]>(),
  closingProbability: integer('closing_probability').default(50),
  // Integration fields
  submissionId: varchar('submission_id'), // Links to client_submissions if converted
  contractId: varchar('contract_id'), // Links to contracts when deal closed
  projectId: varchar('project_id'), // Links to projects when work begins
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Sales Conversations Table - Track all customer interactions
export const salesConversations = pgTable('sales_conversations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  leadId: varchar('lead_id')
    .references(() => salesLeads.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  type: varchar('type')
    .$type<'phone' | 'email' | 'meeting' | 'video_call' | 'chat' | 'social_media'>()
    .notNull(),
  duration: integer('duration'), // minutes
  summary: text('summary').notNull(),
  outcome: varchar('outcome')
    .$type<'positive' | 'neutral' | 'negative' | 'closed_won' | 'closed_lost'>()
    .notNull(),
  keyPoints: jsonb('key_points')
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  nextSteps: jsonb('next_steps')
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  attachments: jsonb('attachments').$type<string[]>(), // Links to files, recordings
  scheduledFollow: timestamp('scheduled_follow'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sales Analytics Table - Track performance metrics
export const salesAnalytics = pgTable('sales_analytics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  period: varchar('period').notNull(), // daily, weekly, monthly, quarterly
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  totalLeads: integer('total_leads').default(0),
  activeDeals: integer('active_deals').default(0),
  closedDeals: integer('closed_deals').default(0),
  conversionRate: decimal('conversion_rate', {
    precision: 5,
    scale: 2,
  }).default('0.00'),
  totalValue: decimal('total_value', { precision: 10, scale: 2 }).default('0.00'),
  averageDealSize: decimal('average_deal_size', {
    precision: 10,
    scale: 2,
  }).default('0.00'),
  salesCycle: integer('sales_cycle').default(30), // days
  topSources:
    jsonb('top_sources').$type<Array<{ source: string; leads: number; conversion: number }>>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sales Templates Table - Predefined sales email templates
export const salesTemplates = pgTable('sales_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  description: text('description').notNull(),
  category: varchar('category')
    .$type<'photography' | 'videography' | 'music_production' | 'general'>()
    .notNull(),
  template: text('template').notNull(), // JSON string with email structure
  isActive: boolean('is_active').default(true),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Sales Activities Table - Track all sales activities and touchpoints
export const salesActivities = pgTable('sales_activities', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  leadId: varchar('lead_id')
    .references(() => salesLeads.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  type: varchar('type')
    .$type<'call' | 'email' | 'meeting' | 'task' | 'note' | 'follow_up'>()
    .notNull(),
  title: varchar('title').notNull(),
  description: text('description'),
  status: varchar('status').$type<'completed' | 'pending' | 'overdue'>().default('pending'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Sales Voice Notes Table - Audio recordings and transcripts
export const salesVoiceNotes = pgTable('sales_voice_notes', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  leadId: varchar('lead_id')
    .references(() => salesLeads.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  audioUrl: varchar('audio_url').notNull(),
  transcript: text('transcript'),
  duration: integer('duration'), // seconds
  summary: text('summary'),
  keyInsights: jsonb('key_insights').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const salesLeadsRelations = relations(salesLeads, ({ one, many }) => ({
  user: one(users, {
    fields: [salesLeads.userId],
    references: [users.id],
  }),
  conversations: many(salesConversations),
}));

export const salesConversationsRelations = relations(salesConversations, ({ one }) => ({
  lead: one(salesLeads, {
    fields: [salesConversations.leadId],
    references: [salesLeads.id],
  }),
  user: one(users, {
    fields: [salesConversations.userId],
    references: [users.id],
  }),
}));

export const salesAnalyticsRelations = relations(salesAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [salesAnalytics.userId],
    references: [users.id],
  }),
}));

// Types
export type SalesLead = typeof salesLeads.$inferSelect;
export type InsertSalesLead = typeof salesLeads.$inferInsert;
export type SalesConversation = typeof salesConversations.$inferSelect;
export type InsertSalesConversation = typeof salesConversations.$inferInsert;
export type SalesAnalytics = typeof salesAnalytics.$inferSelect;
export type InsertSalesAnalytics = typeof salesAnalytics.$inferInsert;
export type SalesTemplate = typeof salesTemplates.$inferSelect;
export type InsertSalesTemplate = typeof salesTemplates.$inferInsert;
export type SalesActivity = typeof salesActivities.$inferSelect;
export type InsertSalesActivity = typeof salesActivities.$inferInsert;
export type SalesVoiceNote = typeof salesVoiceNotes.$inferSelect;
export type InsertSalesVoiceNote = typeof salesVoiceNotes.$inferInsert;

// Zod schemas for validation
export const insertSalesLeadSchema = createInsertSchema(salesLeads);
export const insertSalesConversationSchema = createInsertSchema(salesConversations);
export const insertSalesAnalyticsSchema = createInsertSchema(salesAnalytics);
export const insertSalesTemplateSchema = createInsertSchema(salesTemplates);
export const insertSalesActivitySchema = createInsertSchema(salesActivities);
export const insertSalesVoiceNoteSchema = createInsertSchema(salesVoiceNotes);

// Customer analysis interface for smart analyzer integration
export interface CustomerAnalysisResult {
  customerType:
    | 'budget_conscious'
    | 'quality_focused'
    | 'time_sensitive'
    | 'luxury_seeker'
    | 'indecisive'
    | 'professional_buyer';
  budgetTier: 'economy' | 'standard' | 'premium' | 'luxury';
  urgency: 'low' | 'medium' | 'high';
  salesApproach: string;
  recommendedActions: string[];
  closingProbability: number;
  buyingSignals: string[];
  painPoints: string[];
}

// Sales pipeline stages with Norwegian terminology
export const SALES_PIPELINE_STAGES = [
  {
    key: 'cold',
    label: 'Kald Lead',
    color: '#9e9e9e',
    description: 'Ny henvendelse, ikke kontaktet',
  },
  {
    key: 'warm',
    label: 'Varm Lead',
    color: '#ff9800',
    description: 'Første kontakt etablert',
  },
  {
    key: 'hot',
    label: 'Het Lead',
    color: '#f44336',
    description: 'Stor interesse, aktiv dialog',
  },
  {
    key: 'qualified',
    label: 'Kvalifisert',
    color: '#2196f3',
    description: 'Budsjett og behov bekreftet',
  },
  {
    key: 'proposal',
    label: 'Tilbud Sendt',
    color: '#9c27b0',
    description: 'Prisforslag presentert',
  },
  {
    key: 'negotiation',
    label: 'Forhandling',
    color: '#ff5722',
    description: 'Prisdiskusjon pågår',
  },
  {
    key: 'closed',
    label: 'Avsluttet Won',
    color: '#4caf50',
    description: 'Kontrakt signert',
  },
  {
    key: 'lost',
    label: 'Avsluttet Lost',
    color: '#607d8b',
    description: 'Kunde takket nei',
  },
] as const;

// Professional project types for Norwegian market
export const NORWEGIAN_PROJECT_TYPES = [
  { key: 'bryllupsfotografi', label: 'Bryllupsfotografi', icon: 'favorite' },
  { key: 'bedriftsfotografi', label: 'Bedriftsfotografi', icon: 'business' },
  { key: 'portrettfotografi', label: 'Portrettfotografi', icon: 'person' },
  { key: 'produktfotografi', label: 'Produktfotografi', icon: 'shopping_cart' },
  { key: 'eventfotografi', label: 'Eventfotografi', icon: 'event' },
  {
    key: 'arkitekturfotografi',
    label: 'Arkitekturfotografi',
    icon: 'architecture',
  },
  {
    key: 'maternitetsfotografi',
    label: 'Maternitetsfotografi',
    icon: 'child_friendly',
  },
  {
    key: 'familiefotografi',
    label: 'Familiefotografi',
    icon: 'family_restroom',
  },
] as const;
