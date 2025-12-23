/**
 * Business Intelligence Schema
 * SWOT Analysis, Surveys, Persona Mapping, and Analytics
 */

import { pgTable, varchar, text, timestamp, jsonb, integer, boolean, decimal, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// SWOT Items - Individual strengths, weaknesses, opportunities, threats
export const swotItems = pgTable('swot_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),

  // SWOT Classification
  type: varchar('type').$type<'strength' | 'weakness' | 'opportunity' | 'threat'>().notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),

  // Impact & Priority
  impact: varchar('impact').$type<'low' | 'medium' | 'high' | 'critical'>().default('medium'),
  probability: integer('probability').default(50), // 0-100% for opportunities/threats
  urgency: varchar('urgency').$type<'low' | 'medium' | 'high'>().default('medium'),

  // Kanban Status
  status: varchar('status').$type<'identified' | 'analyzing' | 'in_progress' | 'resolved' | 'archived'>().default('identified'),

  // Categorization
  category: varchar('category'), // e.g., 'marketing', 'operations', 'finance', 'technology'
  tags: jsonb('tags').$type<string[]>().default([]),

  // Relationships
  relatedPersonas: jsonb('related_personas').$type<string[]>().default([]), // Which customer personas this affects
  relatedSurveys: jsonb('related_surveys').$type<string[]>().default([]), // Survey IDs that informed this

  // Tracking
  identifiedDate: timestamp('identified_date').defaultNow(),
  targetDate: timestamp('target_date'), // When to address/leverage this
  resolvedDate: timestamp('resolved_date'),

  // Analytics
  viewCount: integer('view_count').default(0),
  actionsTaken: jsonb('actions_taken').$type<Array<{action: string, date: string, result: string}>>().default([]),

  // Metadata
  source: varchar('source'), // 'manual', 'survey', 'ai_analysis', 'market_data'
  confidence: integer('confidence').default(50), // 0-100% confidence in this assessment

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// SWOT History - Track changes over time
export const swotHistory = pgTable('swot_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),

  snapshotDate: timestamp('snapshot_date').defaultNow(),

  // Aggregated scores
  strengthScore: integer('strength_score').default(0),
  weaknessScore: integer('weakness_score').default(0),
  opportunityScore: integer('opportunity_score').default(0),
  threatScore: integer('threat_score').default(0),

  // Counts
  strengthCount: integer('strength_count').default(0),
  weaknessCount: integer('weakness_count').default(0),
  opportunityCount: integer('opportunity_count').default(0),
  threatCount: integer('threat_count').default(0),

  // Conversion metrics
  opportunitiesConverted: integer('opportunities_converted').default(0),
  weaknessesResolved: integer('weaknesses_resolved').default(0),
  threatsNeutralized: integer('threats_neutralized').default(0),

  createdAt: timestamp('created_at').defaultNow(),
});

// Customer Personas
export const customerPersonas = pgTable('customer_personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),

  // Persona Details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  avatarUrl: text('avatar_url'),

  // Demographics
  ageRange: varchar('age_range'), // e.g., '25-35'
  location: varchar('location'),
  income: varchar('income'), // e.g., 'middle', 'high'
  occupation: varchar('occupation'),

  // Psychographics
  goals: jsonb('goals').$type<string[]>().default([]),
  painPoints: jsonb('pain_points').$type<string[]>().default([]),
  motivations: jsonb('motivations').$type<string[]>().default([]),
  behaviors: jsonb('behaviors').$type<string[]>().default([]),

  // Business Relevance
  customerType: varchar('customer_type').$type<'budget_conscious' | 'quality_focused' | 'time_sensitive' | 'luxury_seeker'>(),
  budgetTier: varchar('budget_tier').$type<'economy' | 'standard' | 'premium' | 'luxury'>().default('standard'),
  purchaseFrequency: varchar('purchase_frequency').$type<'one_time' | 'occasional' | 'regular' | 'frequent'>(),

  // Analytics
  marketSize: integer('market_size'), // Estimated number of people in this segment
  averageValue: decimal('average_value', { precision: 10, scale: 2 }), // Average transaction value
  conversionRate: integer('conversion_rate'), // 0-100%

  // Metadata
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Surveys
export const surveys = pgTable('surveys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),

  // Survey Details
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  purpose: varchar('purpose').$type<'swot_analysis' | 'customer_satisfaction' | 'market_research' | 'product_feedback'>().notNull(),

  // Configuration
  questions: jsonb('questions').$type<Array<{
    id: string;
    type: 'text' | 'rating' | 'multiple_choice' | 'checkbox' | 'scale';
    question: string;
    options?: string[];
    required: boolean;
  }>>().notNull(),

  // Status
  status: varchar('status').$type<'draft' | 'active' | 'paused' | 'closed'>().default('draft'),

  // Distribution
  targetAudience: varchar('target_audience').$type<'all_customers' | 'active_customers' | 'past_customers' | 'prospects'>(),
  distributionChannels: jsonb('distribution_channels').$type<string[]>().default([]), // 'email', 'website', 'social_media'

  // Dates
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),


// Survey Responses
export const surveyResponses = pgTable('survey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyId: uuid('survey_id').notNull().references(() => surveys.id, { onDelete: 'cascade' }),

  // Respondent Info (optional for anonymous surveys)
  respondentEmail: varchar('respondent_email'),
  respondentName: varchar('respondent_name'),
  isAnonymous: boolean('is_anonymous').default(false),

  // Response Data
  answers: jsonb('answers').$type<Record<string, any>>().notNull(),

  // Metadata
  completedAt: timestamp('completed_at').defaultNow(),
  timeToComplete: integer('time_to_complete'), // seconds
  deviceType: varchar('device_type'), // 'mobile', 'tablet', 'desktop'

  // Analysis
  sentiment: varchar('sentiment').$type<'positive' | 'neutral' | 'negative'>(),
  keyInsights: jsonb('key_insights').$type<string[]>().default([]),

  createdAt: timestamp('created_at').defaultNow(),
});

// Marketing Campaigns
export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),

  // Campaign Details
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type').$type<'email' | 'social_media' | 'content' | 'paid_ads' | 'seo' | 'referral'>().notNull(),

  // Targeting
  targetPersonas: jsonb('target_personas').$type<string[]>().default([]),
  targetAudience: varchar('target_audience'),

  // Budget & Goals
  budget: decimal('budget', { precision: 10, scale: 2 }),
  goalType: varchar('goal_type').$type<'awareness' | 'leads' | 'conversions' | 'engagement'>(),
  goalValue: integer('goal_value'),

  // Status & Timeline
  status: varchar('status').$type<'planning' | 'active' | 'paused' | 'completed' | 'cancelled'>().default('planning'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),

  // Performance Metrics
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  conversions: integer('conversions').default(0),
  revenue: decimal('revenue', { precision: 10, scale: 2 }).default('0'),
  roi: decimal('roi', { precision: 5, scale: 2 }), // Return on Investment %

  // Content
  content: jsonb('content').$type<{
    subject?: string;
    body?: string;
    images?: string[];
    links?: string[];
  }>(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Newsletter Campaigns (extends marketing campaigns)
export const newsletterCampaigns = pgTable('newsletter_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),

  // Campaign Details
  subject: varchar('subject', { length: 255 }).notNull(),
  content: text('content').notNull(),

  // Audience
  audienceSegment: varchar('audience_segment').$type<'all' | 'active' | 'inactive' | 'new'>().default('all'),
  recipientCount: integer('recipient_count').default(0),

  // Scheduling
  status: varchar('status').$type<'draft' | 'scheduled' | 'sent' | 'cancelled'>().default('draft'),
  scheduledDate: timestamp('scheduled_date'),
  sentDate: timestamp('sent_date'),

  // Performance
  openCount: integer('open_count').default(0),
  clickCount: integer('click_count').default(0),
  unsubscribeCount: integer('unsubscribe_count').default(0),
  bounceCount: integer('bounce_count').default(0),

  openRate: decimal('open_rate', { precision: 5, scale: 2 }),
  clickRate: decimal('click_rate', { precision: 5, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Business Intelligence Analytics
export const biAnalytics = pgTable('bi_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(),

  // Time Period
  period: varchar('period').$type<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>().notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),

  // Market Metrics
  marketMetrics: jsonb('market_metrics').$type<{
    averagePrice: number;
    competitorCount: number;
    marketShare: number;
    demandIndex: number;
  }>(),

  // Business Performance
  businessMetrics: jsonb('business_metrics').$type<{
    revenue: number;
    projectCount: number;
    customerCount: number;
    averageProjectValue: number;
    conversionRate: number;
  }>(),

  // SWOT Scores
  swotScores: jsonb('swot_scores').$type<{
    brand: number;
    product: number;
    distribution: number;
    promotion: number;
    overall: number;
  }>(),

  createdAt: timestamp('created_at').defaultNow(),
});

