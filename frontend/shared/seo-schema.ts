/**
 * SEO System Schema for CreatorHub Norge
 * Comprehensive SEO data models with Norwegian business focus
 */

import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// SEO Projects table
export const seoProjects = pgTable(
  'seo_projects',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    domain: varchar('domain').notNull(),
    name: varchar('name').notNull(),
    userType: varchar('user_type').notNull(), // photographer, videographer, musicProducer
    targetMarket: varchar('target_market').default('norway'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('seo_projects_user_id_idx').on(table.userId),
    index('seo_projects_domain_idx').on(table.domain),
  ],
);

// Keyword tracking
export const seoKeywords = pgTable(
  'seo_keywords',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    keyword: varchar('keyword').notNull(),
    language: varchar('language').default('no'), // Norwegian focus
    searchVolume: integer('search_volume'),
    difficulty: integer('difficulty'), // 1-100
    currentRank: integer('current_rank'),
    targetRank: integer('target_rank'),
    cpc: decimal('cpc', { precision: 10, scale: 2 }),
    competition: varchar('competition'), // low, medium, high
    category: varchar('category'), // fotografi, videografi, musikkproduksjon
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('seo_keywords_project_id_idx').on(table.projectId),
    index('seo_keywords_keyword_idx').on(table.keyword),
  ],
);

// Rank tracking history
export const seoRankings = pgTable(
  'seo_rankings',
  {
    id: varchar('id').primaryKey(),
    keywordId: varchar('keyword_id').notNull(),
    rank: integer('rank'),
    url: varchar('url'),
    searchEngine: varchar('search_engine').default('google.no'),
    location: varchar('location').default('norway'),
    device: varchar('device').default('desktop'), // desktop, mobile
    checkedAt: timestamp('checked_at').defaultNow(),
  },
  (table) => [
    index('seo_rankings_keyword_id_idx').on(table.keywordId),
    index('seo_rankings_checked_at_idx').on(table.checkedAt),
  ],
);

// Site audit data
export const seoAudits = pgTable(
  'seo_audits',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    auditType: varchar('audit_type').notNull(), // technical, content, backlinks
    score: integer('score'), // 0-100
    issues: jsonb('issues'),
    recommendations: jsonb('recommendations'),
    coreWebVitals: jsonb('core_web_vitals'),
    norwegianCompliance: jsonb('norwegian_compliance'), // GDPR, accessibility
    glassCMSOptimization: jsonb('glass_cms_optimization'), // Performance impact
    auditedAt: timestamp('audited_at').defaultNow(),
  },
  (table) => [
    index('seo_audits_project_id_idx').on(table.projectId),
    index('seo_audits_audited_at_idx').on(table.auditedAt),
  ],
);

// Competitor analysis
export const seoCompetitors = pgTable(
  'seo_competitors',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    domain: varchar('domain').notNull(),
    name: varchar('name'),
    category: varchar('category'), // norsk fotograf, videograf, etc.
    estimatedTraffic: integer('estimated_traffic'),
    domainAuthority: integer('domain_authority'),
    backlinks: integer('backlinks'),
    organicKeywords: integer('organic_keywords'),
    isActive: boolean('is_active').default(true),
    lastAnalyzed: timestamp('last_analyzed').defaultNow(),
  },
  (table) => [index('seo_competitors_project_id_idx').on(table.projectId)],
);

// Backlink tracking
export const seoBacklinks = pgTable(
  'seo_backlinks',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    sourceUrl: varchar('source_url').notNull(),
    targetUrl: varchar('target_url').notNull(),
    anchorText: varchar('anchor_text'),
    domainAuthority: integer('domain_authority'),
    pageAuthority: integer('page_authority'),
    linkType: varchar('link_type'), // follow, nofollow, sponsored
    linkStatus: varchar('link_status'), // active, lost, broken
    norwegianRelevance: integer('norwegian_relevance'), // 1-10 scale
    discoveredAt: timestamp('discovered_at').defaultNow(),
    lastChecked: timestamp('last_checked').defaultNow(),
  },
  (table) => [
    index('seo_backlinks_project_id_idx').on(table.projectId),
    index('seo_backlinks_source_url_idx').on(table.sourceUrl),
  ],
);

// Content optimization
export const seoContentAnalysis = pgTable(
  'seo_content_analysis',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    url: varchar('url').notNull(),
    title: varchar('title'),
    metaDescription: text('meta_description'),
    contentType: varchar('content_type'), // page, blog, portfolio
    wordCount: integer('word_count'),
    readabilityScore: integer('readability_score'),
    seoScore: integer('seo_score'),
    norwegianQuality: integer('norwegian_quality'), // Language quality score
    targetKeywords: jsonb('target_keywords'),
    optimization: jsonb('optimization'), // SEO recommendations
    glassCMSData: jsonb('glass_cms_data'), // CMS-specific metrics
    analyzedAt: timestamp('analyzed_at').defaultNow(),
  },
  (table) => [
    index('seo_content_analysis_project_id_idx').on(table.projectId),
    index('seo_content_analysis_url_idx').on(table.url),
  ],
);

// Local SEO for Norwegian market
export const seoLocalBusiness = pgTable(
  'seo_local_business',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    businessName: varchar('business_name').notNull(),
    orgNumber: varchar('org_number'), // Norwegian organization number
    address: text('address'),
    city: varchar('city'),
    region: varchar('region'), // Norwegian fylke
    phone: varchar('phone'),
    website: varchar('website'),
    categories: jsonb('categories'), // fotograf, videograf, etc.
    googleMyBusiness: jsonb('google_my_business'),
    citations: jsonb('citations'), // Norwegian directories
    reviews: jsonb('reviews'),
    localRankings: jsonb('local_rankings'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('seo_local_business_project_id_idx').on(table.projectId),
    index('seo_local_business_org_number_idx').on(table.orgNumber),
  ],
);

// SEO alerts and notifications
export const seoAlerts = pgTable(
  'seo_alerts',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    alertType: varchar('alert_type').notNull(), // rank_drop, new_backlink, audit_issue
    severity: varchar('severity').default('medium'), // low, medium, high, critical
    title: varchar('title').notNull(),
    description: text('description'),
    actionRequired: text('action_required'),
    isRead: boolean('is_read').default(false),
    isResolved: boolean('is_resolved').default(false),
    data: jsonb('data'), // Additional alert data
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('seo_alerts_project_id_idx').on(table.projectId),
    index('seo_alerts_created_at_idx').on(table.createdAt),
  ],
);

// Google Analytics Integration table
export const googleAnalyticsIntegration = pgTable(
  'google_analytics_integration',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    propertyId: varchar('property_id').notNull(),
    viewId: varchar('view_id').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    isActive: boolean('is_active').default(true),
    lastSync: timestamp('last_sync'),
    syncStatus: varchar('sync_status').default('active'), // active, paused, error, disconnected
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_google_analytics_integration_project_id').on(table.projectId),
    index('idx_google_analytics_integration_property_id').on(table.propertyId),
    index('idx_google_analytics_integration_sync_status').on(table.syncStatus),
  ],
);

// SEO Analytics Data table (Real-time Google Analytics data)
export const seoAnalyticsData = pgTable(
  'seo_analytics_data',
  {
    id: varchar('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    date: timestamp('date').notNull(),
    metricType: varchar('metric_type').notNull(), // sessions, pageviews, bounce_rate, etc.
    metricValue: decimal('metric_value', { precision: 15, scale: 4 }).notNull(),
    dimensions: jsonb('dimensions'), // device, source, medium, country, etc.
    source: varchar('source').default('google_analytics'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_seo_analytics_data_project_id').on(table.projectId),
    index('idx_seo_analytics_data_date').on(table.date),
    index('idx_seo_analytics_data_metric_type').on(table.metricType),
    index('idx_seo_analytics_data_source').on(table.source),
  ],
);

// Zod schemas for validation
export const insertSeoProjectSchema = createInsertSchema(seoProjects);
export const insertSeoKeywordSchema = createInsertSchema(seoKeywords);
export const insertSeoRankingSchema = createInsertSchema(seoRankings);
export const insertSeoAuditSchema = createInsertSchema(seoAudits);
export const insertSeoCompetitorSchema = createInsertSchema(seoCompetitors);
export const insertSeoBacklinkSchema = createInsertSchema(seoBacklinks);
export const insertSeoContentAnalysisSchema = createInsertSchema(seoContentAnalysis);
export const insertSeoLocalBusinessSchema = createInsertSchema(seoLocalBusiness);
export const insertSeoAlertSchema = createInsertSchema(seoAlerts);
export const insertGoogleAnalyticsIntegrationSchema = createInsertSchema(
  googleAnalyticsIntegration,
);
export const insertSeoAnalyticsDataSchema = createInsertSchema(seoAnalyticsData);

// TypeScript types
export type SeoProject = typeof seoProjects.$inferSelect;
export type InsertSeoProject = z.infer<typeof insertSeoProjectSchema>;
export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type InsertSeoKeyword = z.infer<typeof insertSeoKeywordSchema>;
export type SeoRanking = typeof seoRankings.$inferSelect;
export type InsertSeoRanking = z.infer<typeof insertSeoRankingSchema>;
export type SeoAudit = typeof seoAudits.$inferSelect;
export type InsertSeoAudit = z.infer<typeof insertSeoAuditSchema>;
export type SeoCompetitor = typeof seoCompetitors.$inferSelect;
export type InsertSeoCompetitor = z.infer<typeof insertSeoCompetitorSchema>;
export type SeoBacklink = typeof seoBacklinks.$inferSelect;
export type InsertSeoBacklink = z.infer<typeof insertSeoBacklinkSchema>;
export type SeoContentAnalysis = typeof seoContentAnalysis.$inferSelect;
export type InsertSeoContentAnalysis = z.infer<typeof insertSeoContentAnalysisSchema>;
export type SeoLocalBusiness = typeof seoLocalBusiness.$inferSelect;
export type InsertSeoLocalBusiness = z.infer<typeof insertSeoLocalBusinessSchema>;
export type SeoAlert = typeof seoAlerts.$inferSelect;
export type InsertSeoAlert = z.infer<typeof insertSeoAlertSchema>;
export type GoogleAnalyticsIntegration = typeof googleAnalyticsIntegration.$inferSelect;
export type InsertGoogleAnalyticsIntegration = z.infer<
  typeof insertGoogleAnalyticsIntegrationSchema
>;
export type SeoAnalyticsData = typeof seoAnalyticsData.$inferSelect;
export type InsertSeoAnalyticsData = z.infer<typeof insertSeoAnalyticsDataSchema>;
