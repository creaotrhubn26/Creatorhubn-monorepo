/**
 * SEO Specialist System Schema
 * TypeScript definitions for SEO specialist management
 */

import { z } from 'zod';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  date,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './database-persistence-schema';

// Enums
export const seoSpecialistStatusEnum = pgEnum('seo_specialist_status', [
  'active',
  'inactive',
  'suspended',
]);
export const clientStatusEnum = pgEnum('client_status', [
  'active',
  'inactive',
  'pending',
  'terminated',
]);
export const campaignStatusEnum = pgEnum('campaign_status', [
  'active',
  'paused',
  'completed',
  'cancelled',
]);
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
]);
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'urgent']);
export const communicationTypeEnum = pgEnum('communication_type', [
  'email',
  'phone',
  'meeting',
  'report',
]);
export const directionEnum = pgEnum('direction', ['inbound', 'outbound']);
export const reportTypeEnum = pgEnum('report_type', ['monthly', 'quarterly', 'annual', 'custom']);
export const reportStatusEnum = pgEnum('report_status', ['draft', 'sent', 'viewed']);
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
]);
export const competitionLevelEnum = pgEnum('competition_level', ['low', 'medium', 'high']);
export const trendEnum = pgEnum('trend', ['rising', 'stable', 'declining']);
export const deviceTypeEnum = pgEnum('device_type', ['desktop', 'mobile', 'tablet']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'ranking_change',
  'budget_alert',
  'task_due',
  'report_ready',
]);

// SEO Specialists table
export const seoSpecialists = pgTable('seo_specialists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 50 }),
  company: varchar('company', { length: 255 }),
  experienceYears: integer('experience_years').default(0),
  specialties: text('specialties').array(), // Array of specialties
  certifications: text('certifications').array(), // Array of certifications
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  monthlyQuota: integer('monthly_quota').default(10),
  status: seoSpecialistStatusEnum('status').default('active'),
  bio: text('bio'),
  profileImageUrl: text('profile_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Clients table
export const seoClients = pgTable('seo_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  profession: varchar('profession', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  website: varchar('website', { length: 500 }),
  businessAddress: text('business_address'),
  monthlyBudget: decimal('monthly_budget', { precision: 10, scale: 2 }),
  contractStartDate: date('contract_start_date'),
  contractEndDate: date('contract_end_date'),
  status: clientStatusEnum('status').default('active'),
  priority: priorityEnum('priority').default('medium'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Campaigns table
export const seoCampaigns = pgTable('seo_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: campaignStatusEnum('status').default('active'),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  spent: decimal('spent', { precision: 10, scale: 2 }).default('0'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  targetKeywords: text('target_keywords').array(),
  targetRegions: text('target_regions').array(),
  goals: text('goals'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Keywords table
export const seoKeywords = pgTable('seo_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => seoCampaigns.id, { onDelete: 'cascade' }),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  currentPosition: integer('current_position'),
  targetPosition: integer('target_position'),
  searchVolume: integer('search_volume'),
  competitionLevel: competitionLevelEnum('competition_level'),
  cpc: decimal('cpc', { precision: 8, scale: 2 }),
  trend: trendEnum('trend'),
  opportunityScore: integer('opportunity_score'),
  lastChecked: timestamp('last_checked', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Rankings table
export const seoRankings = pgTable('seo_rankings', {
  id: uuid('id').primaryKey().defaultRandom(),
  keywordId: uuid('keyword_id').references(() => seoKeywords.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  url: varchar('url', { length: 500 }),
  searchEngine: varchar('search_engine', { length: 50 }).default('google'),
  region: varchar('region', { length: 50 }).default('norway'),
  deviceType: deviceTypeEnum('device_type').default('desktop'),
  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// SEO Reports table
export const seoReports = pgTable('seo_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  reportType: reportTypeEnum('report_type').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary'),
  keyMetrics: jsonb('key_metrics'),
  recommendations: text('recommendations').array(),
  status: reportStatusEnum('status').default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Tasks table
export const seoTasks = pgTable('seo_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  taskType: varchar('task_type', { length: 50 }).notNull(),
  priority: priorityEnum('priority').default('medium'),
  status: taskStatusEnum('status').default('pending'),
  dueDate: date('due_date'),
  estimatedHours: decimal('estimated_hours', { precision: 4, scale: 2 }),
  actualHours: decimal('actual_hours', { precision: 4, scale: 2 }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Analytics table
export const seoAnalytics = pgTable('seo_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').references(() => seoCampaigns.id, { onDelete: 'cascade' }),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  metricValue: decimal('metric_value', { precision: 15, scale: 4 }),
  metricUnit: varchar('metric_unit', { length: 50 }),
  dateRecorded: date('date_recorded').notNull(),
  source: varchar('source', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// SEO Invoices table
export const seoInvoices = pgTable('seo_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  invoiceNumber: varchar('invoice_number', { length: 100 }).unique().notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  status: invoiceStatusEnum('status').default('draft'),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Invoice Items table
export const seoInvoiceItems = pgTable('seo_invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => seoInvoices.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).default('1'),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// SEO Communications table
export const seoCommunications = pgTable('seo_communications', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  communicationType: communicationTypeEnum('communication_type').notNull(),
  subject: varchar('subject', { length: 255 }),
  message: text('message'),
  direction: directionEnum('direction').notNull(),
  status: varchar('status', { length: 50 }).default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// SEO Templates table
export const seoTemplates = pgTable('seo_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  templateType: varchar('template_type', { length: 50 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  content: text('content').notNull(),
  variables: text('variables').array(),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Tools Integration table
export const seoToolsIntegration = pgTable('seo_tools_integration', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  toolType: varchar('tool_type', { length: 50 }).notNull(),
  apiKey: text('api_key'),
  apiSecret: text('api_secret'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  lastSync: timestamp('last_sync', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// SEO Notifications table
export const seoNotifications = pgTable('seo_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialistId: uuid('specialist_id').references(() => seoSpecialists.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => seoClients.id, { onDelete: 'cascade' }),
  notificationType: notificationTypeEnum('notification_type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  priority: priorityEnum('priority').default('medium'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const seoSpecialistsRelations = relations(seoSpecialists, ({ many }) => ({
  clients: many(seoClients),
  campaigns: many(seoCampaigns),
  tasks: many(seoTasks),
  reports: many(seoReports),
  invoices: many(seoInvoices),
  communications: many(seoCommunications),
  templates: many(seoTemplates),
  toolsIntegration: many(seoToolsIntegration),
  notifications: many(seoNotifications),
}));

export const seoClientsRelations = relations(seoClients, ({ one, many }) => ({
  specialist: one(seoSpecialists, {
    fields: [seoClients.specialistId],
    references: [seoSpecialists.id],
  }),
  campaigns: many(seoCampaigns),
  tasks: many(seoTasks),
  reports: many(seoReports),
  analytics: many(seoAnalytics),
  invoices: many(seoInvoices),
  communications: many(seoCommunications),
  notifications: many(seoNotifications),
}));

export const seoCampaignsRelations = relations(seoCampaigns, ({ one, many }) => ({
  client: one(seoClients, {
    fields: [seoCampaigns.clientId],
    references: [seoClients.id],
  }),
  specialist: one(seoSpecialists, {
    fields: [seoCampaigns.specialistId],
    references: [seoSpecialists.id],
  }),
  keywords: many(seoKeywords),
  analytics: many(seoAnalytics),
}));

export const seoKeywordsRelations = relations(seoKeywords, ({ one, many }) => ({
  campaign: one(seoCampaigns, {
    fields: [seoKeywords.campaignId],
    references: [seoCampaigns.id],
  }),
  rankings: many(seoRankings),
}));

export const seoRankingsRelations = relations(seoRankings, ({ one }) => ({
  keyword: one(seoKeywords, {
    fields: [seoRankings.keywordId],
    references: [seoKeywords.id],
  }),
}));

// Zod schemas for validation
export const seoSpecialistSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  experienceYears: z.number().int().min(0).default(0),
  specialties: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  hourlyRate: z.number().positive().optional(),
  monthlyQuota: z.number().int().positive().default(10),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  bio: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
});

export const seoClientSchema = z.object({
  id: z.string().uuid().optional(),
  specialistId: z.string().uuid(),
  name: z.string().min(1).max(255),
  profession: z.enum(['photographer', 'videographer', 'music_producer', 'vendor']),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  website: z.string().url().max(500).optional(),
  businessAddress: z.string().optional(),
  monthlyBudget: z.number().positive().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending', 'terminated']).default('active'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  notes: z.string().optional(),
});

export const seoCampaignSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  specialistId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).default('active'),
  budget: z.number().positive().optional(),
  spent: z.number().min(0).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  targetKeywords: z.array(z.string()).default([]),
  targetRegions: z.array(z.string()).default([]),
  goals: z.string().optional(),
});

export const seoKeywordSchema = z.object({
  id: z.string().uuid().optional(),
  campaignId: z.string().uuid(),
  keyword: z.string().min(1).max(255),
  currentPosition: z.number().int().positive().optional(),
  targetPosition: z.number().int().positive().optional(),
  searchVolume: z.number().int().min(0).optional(),
  competitionLevel: z.enum(['low', 'medium', 'high']).optional(),
  cpc: z.number().positive().optional(),
  trend: z.enum(['rising', 'stable', 'declining']).optional(),
  opportunityScore: z.number().int().min(0).max(100).optional(),
  lastChecked: z.string().optional(),
});

export const seoTaskSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  specialistId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  taskType: z.string().min(1).max(50),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  dueDate: z.string().optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().min(0).optional(),
  completedAt: z.string().optional(),
});

export const seoReportSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  specialistId: z.string().uuid(),
  reportType: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  periodStart: z.string(),
  periodEnd: z.string(),
  title: z.string().min(1).max(255),
  summary: z.string().optional(),
  keyMetrics: z.record(z.string(), z.any()).optional(),
  recommendations: z.array(z.string()).default([]),
  status: z.enum(['draft', 'sent', 'viewed']).default('draft'),
  sentAt: z.string().optional(),
  viewedAt: z.string().optional(),
});

// TypeScript types
export type SEOSpecialist = z.infer<typeof seoSpecialistSchema>;
export type SEOClient = z.infer<typeof seoClientSchema>;
export type SEOCampaign = z.infer<typeof seoCampaignSchema>;
export type SEOKeyword = z.infer<typeof seoKeywordSchema>;
export type SEOTask = z.infer<typeof seoTaskSchema>;
export type SEOReport = z.infer<typeof seoReportSchema>;

export type SEOSpecialistStatus = 'active' | 'inactive' | 'suspended';
export type ClientStatus = 'active' | 'inactive' | 'pending' | 'terminated';
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type CommunicationType = 'email' | 'phone' | 'meeting' | 'report';
export type Direction = 'inbound' | 'outbound';
export type ReportType = 'monthly' | 'quarterly' | 'annual' | 'custom';
export type ReportStatus = 'draft' | 'sent' | 'viewed';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type CompetitionLevel = 'low' | 'medium' | 'high';
export type Trend = 'rising' | 'stable' | 'declining';
export type DeviceType = 'desktop' | 'mobile' | 'tablet';
export type NotificationType = 'ranking_change' | 'budget_alert' | 'task_due' | 'report_ready';
