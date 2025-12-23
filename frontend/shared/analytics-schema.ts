// =============================================================================
// ANALYTICS MANAGEMENT SCHEMA - COMPREHENSIVE NORWEGIAN CREATIVE INDUSTRY ANALYTICS
// =============================================================================

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  decimal,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Analytics Configuration Management
export const analyticsConfiguration = pgTable('analytics_configuration', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  platformType: varchar('platform_type')
    .$type<
      | 'google_analytics'
      | 'gtm'
      | 'facebook_pixel'
      | 'linkedin_insight'
      | 'tiktok_pixel'
      | 'pinterest_tag'
    >()
    .notNull(),
  configurationData: jsonb('configuration_data')
    .$type<{
      trackingId?: string;
      containerId?: string;
      pixelId?: string;
      partnerId?: string;
      measurementId?: string;
      conversionId?: string;
      domain?: string;
      customEvents?: {
        eventName: string;
        parameters: Record<string, any>;
      }[];
    }>()
    .notNull(),
  isActive: boolean('is_active').default(true),
  norwegianMarketSettings: jsonb('norwegian_market_settings')
    .$type<{
      cities: string[];
      creativeIndustryFocus: boolean;
      weddingSeasonTracking: boolean;
      corporeateClientTracking: boolean;
      freelancerInsights: boolean;
    }>()
    .default({
      cities: [],
      creativeIndustryFocus: false,
      weddingSeasonTracking: false,
      corporeateClientTracking: false,
      freelancerInsights: false,
    }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Event Tracking Database
export const eventTracking = pgTable('event_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  sessionId: varchar('session_id').notNull(),
  eventName: varchar('event_name').notNull(),
  eventCategory: varchar('event_category')
    .$type<
      | 'page_view'
      | 'user_interaction'
      | 'conversion'
      | 'business_goal'
      | 'creative_workflow'
      | 'portfolio_engagement'
    >()
    .notNull(),
  eventData: jsonb('event_data')
    .$type<{
      page?: string;
      action?: string;
      label?: string;
      value?: number;
      userType?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'client';
      location?: string;
      deviceType?: 'desktop' | 'mobile' | 'tablet';
      userAgent?: string;
      referrer?: string;
      customParameters?: Record<string, any>;
    }>()
    .notNull(),
  conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }),
  norwegianMarketData: jsonb('norwegian_market_data').$type<{
    city?: string;
    region?: string;
    language?: string;
    timezone?: string;
    currency?: string;
    creativeIndustrySegment?: string;
  }>(),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Marketing Campaign Analytics
export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  campaignName: varchar('campaign_name').notNull(),
  campaignType: varchar('campaign_type')
    .$type<
      | 'google_ads'
      | 'facebook_ads'
      | 'instagram_ads'
      | 'linkedin_ads'
      | 'organic_social'
      | 'email_marketing'
      | 'referral'
      | 'content_marketing'
    >()
    .notNull(),
  targetAudience: jsonb('target_audience')
    .$type<{
      demographics: {
        ageRange: string;
        gender: string;
        income: string;
        interests: string[];
      };
      geographic: {
        countries: string[];
        cities: string[];
        radius?: number;
      };
      behavioral: {
        weddingPlanning: boolean;
        corporateEvents: boolean;
        creativeServices: boolean;
        musicProduction: boolean;
      };
    }>()
    .notNull(),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  spent: decimal('spent', { precision: 10, scale: 2 }).default('0.00'),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  conversions: integer('conversions').default(0),
  conversionValue: decimal('conversion_value', {
    precision: 10,
    scale: 2,
  }).default('0.00'),
  campaignData: jsonb('campaign_data').$type<{
    adSets?: any[];
    creatives?: any[];
    keywords?: string[];
    placements?: string[];
    schedule?: {
      startDate: string;
      endDate: string;
      dayparting?: any;
    };
  }>(),
  norwegianMarketPerformance: jsonb('norwegian_market_performance').$type<{
    osloPerformance: {
      impressions: number;
      clicks: number;
      conversions: number;
      cost: number;
    };
    bergenPerformance: {
      impressions: number;
      clicks: number;
      conversions: number;
      cost: number;
    };
    trondheimPerformance: {
      impressions: number;
      clicks: number;
      conversions: number;
      cost: number;
    };
    stavangerPerformance: {
      impressions: number;
      clicks: number;
      conversions: number;
      cost: number;
    };
  }>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Conversion Tracking System
export const conversionTracking = pgTable('conversion_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  sessionId: varchar('session_id').notNull(),
  conversionType: varchar('conversion_type')
    .$type<
      | 'inquiry_form'
      | 'booking_request'
      | 'portfolio_download'
      | 'consultation_booking'
      | 'service_purchase'
      | 'course_enrollment'
      | 'partnership_application'
    >()
    .notNull(),
  conversionSource: varchar('conversion_source')
    .$type<
      | 'organic'
      | 'google_ads'
      | 'facebook_ads'
      | 'instagram'
      | 'linkedin'
      | 'email'
      | 'referral'
      | 'direct'
    >()
    .notNull(),
  conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }),
  conversionData: jsonb('conversion_data')
    .$type<{
      serviceType?:
        | 'wedding'
        | 'corporate'
        | 'portrait'
        | 'event'
        | 'commercial'
        | 'music_production';
      clientInformation?: {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        eventDate?: string;
        budget?: string;
        requirements?: string;
      };
      leadQuality?: 'hot' | 'warm' | 'cold';
      followUpRequired?: boolean;
      notes?: string;
    }>()
    .notNull(),
  norwegianMarketInfo: jsonb('norwegian_market_info').$type<{
    clientLocation?: string;
    eventLocation?: string;
    preferredLanguage?: string;
    marketSegment?: string;
    seasonality?: string;
  }>(),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Performance Analytics Dashboard
export const performanceAnalytics = pgTable('performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  analyticsDate: timestamp('analytics_date').notNull(),
  timeframe: varchar('timeframe')
    .$type<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>()
    .notNull(),
  websiteMetrics: jsonb('website_metrics')
    .$type<{
      pageViews: number;
      uniqueVisitors: number;
      sessions: number;
      bounceRate: number;
      averageSessionDuration: number;
      pagesPerSession: number;
    }>()
    .notNull(),
  conversionMetrics: jsonb('conversion_metrics')
    .$type<{
      totalConversions: number;
      conversionRate: number;
      totalRevenue: number;
      averageOrderValue: number;
      costPerConversion: number;
      returnOnAdSpend: number;
    }>()
    .notNull(),
  marketingMetrics: jsonb('marketing_metrics')
    .$type<{
      totalImpressions: number;
      totalClicks: number;
      clickThroughRate: number;
      costPerClick: number;
      totalSpend: number;
      impressionShare: number;
    }>()
    .notNull(),
  norwegianCreativeMetrics: jsonb('norwegian_creative_metrics')
    .$type<{
      weddingInquiries: number;
      corporateBookings: number;
      portfolioViews: number;
      servicePageViews: number;
      blogEngagement: number;
      socialMediaGrowth: number;
      clientRetention: number;
      referralRate: number;
    }>()
    .notNull(),
  cityPerformance: jsonb('city_performance').$type<{
    oslo: {
      traffic: number;
      conversions: number;
      revenue: number;
    };
    bergen: {
      traffic: number;
      conversions: number;
      revenue: number;
    };
    trondheim: {
      traffic: number;
      conversions: number;
      revenue: number;
    };
    stavanger: {
      traffic: number;
      conversions: number;
      revenue: number;
    };
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Google Tag Manager Event Configuration
export const gtmEventConfiguration = pgTable('gtm_event_configuration', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  eventName: varchar('event_name').notNull(),
  triggerType: varchar('trigger_type')
    .$type<'page_view' | 'click' | 'form_submission' | 'scroll' | 'timer' | 'custom_event'>()
    .notNull(),
  triggerConfiguration: jsonb('trigger_configuration')
    .$type<{
      selector?: string;
      url?: string;
      eventAction?: string;
      scrollThreshold?: number;
      timerInterval?: number;
      customConditions?: any[];
    }>()
    .notNull(),
  tagConfiguration: jsonb('tag_configuration')
    .$type<{
      trackingId?: string;
      eventCategory: string;
      eventAction: string;
      eventLabel?: string;
      customParameters?: Record<string, any>;
      nonInteraction?: boolean;
    }>()
    .notNull(),
  norwegianCreativeSettings: jsonb('norwegian_creative_settings')
    .$type<{
      creativeIndustryTracking: boolean;
      weddingSeasonality: boolean;
      corporateClientTracking: boolean;
      portfolioEngagement: boolean;
      serviceInquiryTracking: boolean;
    }>()
    .default({
      creativeIndustryTracking: false,
      weddingSeasonality: false,
      corporateClientTracking: false,
      portfolioEngagement: false,
      serviceInquiryTracking: false,
    }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =============================================================================
// PHASE 11: PERFORMANCE OPTIMIZATION & MONITORING SCHEMA
// =============================================================================

// System Performance Metrics
export const systemPerformanceMetrics = pgTable('system_performance_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  metricName: varchar('metric_name').notNull(), // page_load_time, api_response_time, memory_usage, etc.
  metricValue: decimal('metric_value', { precision: 10, scale: 2 }).notNull(),
  metricUnit: varchar('metric_unit').notNull(), // ms, mb, percentage, count
  userId: varchar('user_id'),
  sessionId: varchar('session_id'),
  url: text('url'),
  userAgent: text('user_agent'),
  connectionInfo: jsonb('connection_info').$type<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }>(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// API Performance Tracking
export const apiPerformanceTracking = pgTable('api_performance_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 10 }).notNull(),
  responseTime: integer('response_time').notNull(), // in milliseconds
  statusCode: integer('status_code').notNull(),
  userId: varchar('user_id'),
  requestSize: integer('request_size'), // in bytes
  responseSize: integer('response_size'), // in bytes
  errorMessage: text('error_message'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// User Interaction Performance
export const userInteractionPerformance = pgTable('user_interaction_performance', {
  id: uuid('id').primaryKey().defaultRandom(),
  interactionType: varchar('interaction_type').notNull(), // click, scroll, form_submit, navigation
  componentName: varchar('component_name').notNull(),
  interactionDelay: integer('interaction_delay'), // time between action and response
  userId: varchar('user_id'),
  sessionId: varchar('session_id'),
  deviceType: varchar('device_type').$type<'desktop' | 'mobile' | 'tablet'>(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Business Intelligence Aggregates
export const businessIntelligenceMetrics = pgTable('business_intelligence_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  aggregationType: varchar('aggregation_type')
    .$type<'daily' | 'weekly' | 'monthly' | 'quarterly'>()
    .notNull(),
  profession: varchar('profession').$type<
    'photographer' | 'videographer' | 'music_producer' | 'vendor'
  >(),
  reportDate: timestamp('report_date').notNull(),
  totalUsers: integer('total_users').default(0),
  activeUsers: integer('active_users').default(0),
  newProjects: integer('new_projects').default(0),
  totalRevenue: decimal('total_revenue', { precision: 15, scale: 2 }).default('0'),
  avgProjectValue: decimal('avg_project_value', { precision: 10, scale: 2 }),
  norwegianMarketData: jsonb('norwegian_market_data').$type<{
    osloMetrics: { users: number; revenue: number; projects: number };
    bergenMetrics: { users: number; revenue: number; projects: number };
    trondheimMetrics: { users: number; revenue: number; projects: number };
    stavangerMetrics: { users: number; revenue: number; projects: number };
    otherCities: { users: number; revenue: number; projects: number };
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Norwegian Market Insights
export const norwegianMarketInsights = pgTable('norwegian_market_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  county: varchar('county').notNull(),
  municipality: varchar('municipality'),
  avgHourlyRate: decimal('avg_hourly_rate', { precision: 8, scale: 2 }),
  avgDayRate: decimal('avg_day_rate', { precision: 10, scale: 2 }),
  userCount: integer('user_count').default(0),
  projectCount: integer('project_count').default(0),
  avgProjectDuration: decimal('avg_project_duration', {
    precision: 6,
    scale: 2,
  }), // hours
  seasonalTrends: jsonb('seasonal_trends').$type<{
    spring: { projects: number; avgValue: number };
    summer: { projects: number; avgValue: number };
    fall: { projects: number; avgValue: number };
    winter: { projects: number; avgValue: number };
  }>(),
  popularServices: jsonb('popular_services').$type<string[]>(),
  equipmentTrends: jsonb('equipment_trends').$type<{
    cameraModels: string[];
    lensTypes: string[];
    accessories: string[];
  }>(),
  reportDate: timestamp('report_date').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Performance Alerts System
export const performanceAlerts = pgTable('performance_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertType: varchar('alert_type')
    .$type<
      | 'high_response_time'
      | 'high_error_rate'
      | 'memory_warning'
      | 'disk_space_low'
      | 'high_cpu_usage'
    >()
    .notNull(),
  severity: varchar('severity').$type<'low' | 'medium' | 'high' | 'critical'>().notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  thresholdValue: decimal('threshold_value', { precision: 10, scale: 2 }),
  actualValue: decimal('actual_value', { precision: 10, scale: 2 }),
  isResolved: boolean('is_resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Caching Performance Metrics
export const cachingMetrics = pgTable('caching_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  cacheKey: varchar('cache_key').notNull(),
  cacheType: varchar('cache_type').$type<'memory' | 'redis' | 'database' | 'browser'>().notNull(),
  operation: varchar('operation').$type<'hit' | 'miss' | 'set' | 'delete' | 'expire'>().notNull(),
  responseTime: integer('response_time'), // in milliseconds
  dataSize: integer('data_size'), // in bytes
  ttl: integer('ttl'), // time to live in seconds
  hitRate: decimal('hit_rate', { precision: 5, scale: 2 }), // percentage
  userId: varchar('user_id'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// =============================================================================
// ANALYTICS SCHEMA TYPE EXPORTS
// =============================================================================

export type AnalyticsConfiguration = typeof analyticsConfiguration.$inferSelect;
export const insertAnalyticsConfigurationSchema = createInsertSchema(analyticsConfiguration);
export type InsertAnalyticsConfiguration = z.infer<typeof insertAnalyticsConfigurationSchema>;

export type EventTracking = typeof eventTracking.$inferSelect;
export const insertEventTrackingSchema = createInsertSchema(eventTracking);
export type InsertEventTracking = z.infer<typeof insertEventTrackingSchema>;

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns);
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

export type ConversionTracking = typeof conversionTracking.$inferSelect;
export const insertConversionTrackingSchema = createInsertSchema(conversionTracking);
export type InsertConversionTracking = z.infer<typeof insertConversionTrackingSchema>;

export type PerformanceAnalytics = typeof performanceAnalytics.$inferSelect;
export const insertPerformanceAnalyticsSchema = createInsertSchema(performanceAnalytics);
export type InsertPerformanceAnalytics = z.infer<typeof insertPerformanceAnalyticsSchema>;

export type GTMEventConfiguration = typeof gtmEventConfiguration.$inferSelect;
export const insertGTMEventConfigurationSchema = createInsertSchema(gtmEventConfiguration);
export type InsertGTMEventConfiguration = z.infer<typeof insertGTMEventConfigurationSchema>;

// Phase 11 Performance Monitoring Types
export type SystemPerformanceMetric = typeof systemPerformanceMetrics.$inferSelect;
export const insertSystemPerformanceMetricSchema = createInsertSchema(systemPerformanceMetrics);
export type InsertSystemPerformanceMetric = z.infer<typeof insertSystemPerformanceMetricSchema>;

export type ApiPerformanceTracking = typeof apiPerformanceTracking.$inferSelect;
export const insertApiPerformanceTrackingSchema = createInsertSchema(apiPerformanceTracking);
export type InsertApiPerformanceTracking = z.infer<typeof insertApiPerformanceTrackingSchema>;

export type UserInteractionPerformance = typeof userInteractionPerformance.$inferSelect;
export const insertUserInteractionPerformanceSchema = createInsertSchema(
  userInteractionPerformance,
);
export type InsertUserInteractionPerformance = z.infer<
  typeof insertUserInteractionPerformanceSchema
>;

export type BusinessIntelligenceMetric = typeof businessIntelligenceMetrics.$inferSelect;
export const insertBusinessIntelligenceMetricSchema = createInsertSchema(
  businessIntelligenceMetrics,
);
export type InsertBusinessIntelligenceMetric = z.infer<
  typeof insertBusinessIntelligenceMetricSchema
>;

export type NorwegianMarketInsight = typeof norwegianMarketInsights.$inferSelect;
export const insertNorwegianMarketInsightSchema = createInsertSchema(norwegianMarketInsights);
export type InsertNorwegianMarketInsight = z.infer<typeof insertNorwegianMarketInsightSchema>;

export type PerformanceAlert = typeof performanceAlerts.$inferSelect;
export const insertPerformanceAlertSchema = createInsertSchema(performanceAlerts);
export type InsertPerformanceAlert = z.infer<typeof insertPerformanceAlertSchema>;

export type CachingMetric = typeof cachingMetrics.$inferSelect;
export const insertCachingMetricSchema = createInsertSchema(cachingMetrics);
export type InsertCachingMetric = z.infer<typeof insertCachingMetricSchema>;
