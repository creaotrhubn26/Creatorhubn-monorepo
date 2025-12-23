/**
 * Analytics & Reporting Schema
 * Complete schema definitions for SEO analytics, template analytics, and reporting
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
// SEO ANALYTICS & CAMPAIGNS
// ============================================================================

export const seoAnalyticsData = pgTable('seo_analytics_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  metricName: varchar('metric_name').notNull(),
  metricValue: decimal('metric_value').notNull(),
  metricDate: date('metric_date').notNull(),
  source: varchar('source').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const seoCampaigns = pgTable('seo_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignName: varchar('campaign_name').notNull(),
  campaignType: varchar('campaign_type').notNull(),
  targetKeywords: jsonb('target_keywords').notNull().default('[]'),
  budget: decimal('budget'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  status: varchar('status')
    .$type<'active' | 'paused' | 'completed' | 'cancelled'>()
    .default('active'),
  performance: jsonb('performance').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const seoKeywords = pgTable('seo_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyword: varchar('keyword').notNull(),
  keywordType: varchar('keyword_type').$type<'primary' | 'secondary' | 'long-tail'>().notNull(),
  searchVolume: integer('search_volume'),
  difficulty: decimal('difficulty'),
  position: integer('position'),
  projectId: uuid('project_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const seoLocalBusiness = pgTable('seo_local_business', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessName: varchar('business_name').notNull(),
  businessType: varchar('business_type').notNull(),
  address: text('address').notNull(),
  phone: varchar('phone'),
  website: varchar('website'),
  googleMyBusinessId: varchar('google_my_business_id'),
  localKeywords: jsonb('local_keywords').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const seoProjects = pgTable('seo_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectName: varchar('project_name').notNull(),
  websiteUrl: varchar('website_url').notNull(),
  targetAudience: text('target_audience'),
  goals: jsonb('goals').notNull().default('[]'),
  status: varchar('status')
    .$type<'planning' | 'active' | 'completed' | 'paused'>()
    .default('planning'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const seoContentAnalysis = pgTable('seo_content_analysis', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentId: uuid('content_id').notNull(),
  analysisType: varchar('analysis_type').notNull(),
  score: decimal('score').notNull(),
  recommendations: jsonb('recommendations').notNull().default('[]'),
  issues: jsonb('issues').notNull().default('[]'),
  analyzedAt: timestamp('analyzed_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const seoAlerts = pgTable('seo_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertType: varchar('alert_type').notNull(),
  alertMessage: text('alert_message').notNull(),
  severity: varchar('severity').$type<'low' | 'medium' | 'high' | 'critical'>().notNull(),
  projectId: uuid('project_id').notNull(),
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// TEMPLATE ANALYTICS
// ============================================================================

export const templateAnalytics = pgTable('template_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull(),
  templateName: varchar('template_name').notNull(),
  usageCount: integer('usage_count').default(0),
  downloadCount: integer('download_count').default(0),
  viewCount: integer('view_count').default(0),
  rating: decimal('rating'),
  lastUsed: timestamp('last_used'),
  performance: jsonb('performance').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// STORY ARC PROJECTS
// ============================================================================

export const storyArcProjects = pgTable('story_arc_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectName: varchar('project_name').notNull(),
  projectType: varchar('project_type').notNull(),
  storyStructure: jsonb('story_structure').notNull(),
  characters: jsonb('characters').notNull().default('[]'),
  timeline: jsonb('timeline').notNull().default('[]'),
  status: varchar('status').$type<'draft' | 'production' | 'completed'>().default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const storyArcTemplates = pgTable('story_arc_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateName: varchar('template_name').notNull(),
  templateType: varchar('template_type').notNull(),
  templateStructure: jsonb('template_structure').notNull(),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// PROTOTYPE FEEDBACK
// ============================================================================

export const prototypeFeedback = pgTable('prototype_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  prototypeId: uuid('prototype_id').notNull(),
  feedbackType: varchar('feedback_type').notNull(),
  feedbackText: text('feedback_text').notNull(),
  rating: integer('rating'),
  submittedBy: varchar('submitted_by').notNull(),
  status: varchar('status').$type<'pending' | 'reviewed' | 'addressed'>().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// PRICING STRUCTURES
// ============================================================================

export const pricingStructures = pgTable('pricing_structures', {
  id: uuid('id').primaryKey().defaultRandom(),
  structureName: varchar('structure_name').notNull(),
  structureType: varchar('structure_type').notNull(),
  pricingTiers: jsonb('pricing_tiers').notNull(),
  isActive: boolean('is_active').default(true),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const seoCampaignsRelations = relations(seoCampaigns, ({ many }) => ({
  keywords: many(seoKeywords),
  analytics: many(seoAnalyticsData),
}));

export const seoKeywordsRelations = relations(seoKeywords, ({ one }) => ({
  campaign: one(seoCampaigns, {
    fields: [seoKeywords.projectId],
    references: [seoCampaigns.id],
  }),
}));

export const seoAnalyticsDataRelations = relations(seoAnalyticsData, ({ one }) => ({
  campaign: one(seoCampaigns, {
    fields: [seoAnalyticsData.projectId],
    references: [seoCampaigns.id],
  }),
}));

export const seoProjectsRelations = relations(seoProjects, ({ many }) => ({
  keywords: many(seoKeywords),
  analytics: many(seoAnalyticsData),
  alerts: many(seoAlerts),
}));

export const seoAlertsRelations = relations(seoAlerts, ({ one }) => ({
  project: one(seoProjects, {
    fields: [seoAlerts.projectId],
    references: [seoProjects.id],
  }),
}));

export const storyArcProjectsRelations = relations(storyArcProjects, ({ many }) => ({
  feedback: many(prototypeFeedback),
}));

export const prototypeFeedbackRelations = relations(prototypeFeedback, ({ one }) => ({
  project: one(storyArcProjects, {
    fields: [prototypeFeedback.prototypeId],
    references: [storyArcProjects.id],
  }),
}));
