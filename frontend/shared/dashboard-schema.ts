/**
 * CreatorHub Light Dashboard Schema
 * Real data structures for mobile dashboards
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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Dashboard Business Analytics
export const businessAnalytics = pgTable('business_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  userType: varchar('user_type')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),

  // Revenue Tracking
  weeklyRevenue: decimal('weekly_revenue', { precision: 10, scale: 2 }).default('0.00'),
  monthlyRevenue: decimal('monthly_revenue', {
    precision: 10,
    scale: 2,
  }).default('0.00'),
  yearlyRevenue: decimal('yearly_revenue', { precision: 10, scale: 2 }).default('0.00'),
  revenueGrowth: decimal('revenue_growth', { precision: 5, scale: 2 }).default('0.00'),

  // Client Metrics
  activeClients: integer('active_clients').default(0),
  totalClients: integer('total_clients').default(0),
  clientGrowth: decimal('client_growth', { precision: 5, scale: 2 }).default('0.00'),

  // Project Metrics
  activeProjects: integer('active_projects').default(0),
  completedProjects: integer('completed_projects').default(0),
  projectsRating: decimal('projects_rating', {
    precision: 3,
    scale: 2,
  }).default('0.00'),

  // Specialized Metrics by User Type
  specializedMetrics: jsonb('specialized_metrics').$type<{
    // Photographer
    photosDelivered?: number;
    editingHours?: number;
    showcaseViews?: number;

    // Videographer
    videosProduced?: number;
    editingMinutes?: number;
    videoViews?: number;

    // Music Producer
    tracksProduced?: number;
    studioHours?: number;
    streamingPlays?: number;
    tonoGramoTracks?: number;

    // Vendor
    equipmentItems?: number;
    rentalDays?: number;
    deliveryOrders?: number;
  }>(),

  // Status and Timestamps
  systemStatus: varchar('system_status').default('active'),
  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Client Management
export const dashboardClients = pgTable('dashboard_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  userType: varchar('user_type')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),

  // Client Information
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email'),
  clientPhone: varchar('client_phone'),
  clientType: varchar('client_type'), // Wedding, Corporate, Band, etc.

  // Project Information
  projectName: varchar('project_name'),
  projectType: varchar('project_type'),
  projectStatus: varchar('project_status')
    .$type<'active' | 'completed' | 'pending' | 'cancelled'>()
    .default('active'),
  projectDeadline: timestamp('project_deadline'),
  contractAmount: decimal('contract_amount', { precision: 10, scale: 2 }),

  // Communication
  lastContactDate: timestamp('last_contact_date'),
  messagesCount: integer('messages_count').default(0),

  // Ratings and Reviews
  clientRating: decimal('client_rating', { precision: 3, scale: 2 }),
  clientReview: text('client_review'),

  // Specialized Data
  specializedData: jsonb('specialized_data').$type<{
    // Photography
    weddingDate?: string;
    photoCount?: number;
    deliveryStatus?: string;

    // Videography
    videoLength?: number;
    deliveryFormat?: string;
    revisionCount?: number;

    // Music Production
    albumName?: string;
    trackCount?: number;
    releaseDate?: string;

    // Equipment Vendor
    equipmentRented?: string[];
    rentalPeriod?: string;
    returnDate?: string;
  }>(),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Portfolio
export const dashboardProjects = pgTable('dashboard_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  userType: varchar('user_type')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  clientId: uuid('client_id').references(() => dashboardClients.id),

  // Project Details
  projectTitle: varchar('project_title').notNull(),
  projectDescription: text('project_description'),
  projectType: varchar('project_type').notNull(),
  projectStatus: varchar('project_status')
    .$type<'active' | 'completed' | 'delivered' | 'cancelled'>()
    .default('active'),

  // Timeline
  startDate: timestamp('start_date'),
  completionDate: timestamp('completion_date'),
  deliveryDate: timestamp('delivery_date'),

  // Metrics
  viewCount: integer('view_count').default(0),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  engagementScore: decimal('engagement_score', { precision: 5, scale: 2 }),

  // Media and Assets
  thumbnailUrl: text('thumbnail_url'),
  previewUrl: text('preview_url'),
  assetCount: integer('asset_count').default(0),

  // Project-Specific Data
  projectData: jsonb('project_data').$type<{
    // Photography
    photoCount?: number;
    editedPhotos?: number;
    clientSelections?: number;
    deliveryMethod?: string;

    // Videography
    videoLength?: number;
    resolution?: string;
    format?: string;
    chapters?: number;

    // Music Production
    trackDuration?: number;
    genre?: string;
    bpm?: number;
    collaborators?: string[];

    // Equipment Vendor
    equipmentList?: string[];
    rentalValue?: number;
    condition?: string;
    location?: string;
  }>(),

  // Revenue
  projectValue: decimal('project_value', { precision: 10, scale: 2 }),
  paymentStatus: varchar('payment_status')
    .$type<'pending' | 'partial' | 'paid' | 'overdue'>()
    .default('pending'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Quick Actions and Settings
export const userDashboardSettings = pgTable('user_dashboard_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull().unique(),

  // Dashboard Preferences
  defaultTab: varchar('default_tab').default('virksomhet'),
  theme: varchar('theme').$type<'light' | 'dark' | 'auto'>().default('light'),
  language: varchar('language').default('no'),

  // Business Settings
  businessName: varchar('business_name'),
  businessType: varchar('business_type'),
  norwegianOrgNumber: varchar('norwegian_org_number'),
  vatNumber: varchar('vat_number'),

  // Professional Settings
  specializations: jsonb('specializations').$type<string[]>(),
  equipment: jsonb('equipment').$type<string[]>(),
  workingHours: jsonb('working_hours'),
  priceRanges: jsonb('price_ranges'),

  // Integration Settings
  tonoGramoEnabled: boolean('tono_gramo_enabled').default(false),
  microsoftIntegration: boolean('microsoft_integration').default(false),
  googleIntegration: boolean('google_integration').default(false),

  // Notification Preferences
  emailNotifications: boolean('email_notifications').default(true),
  clientNotifications: boolean('client_notifications').default(true),
  projectNotifications: boolean('project_notifications').default(true),

  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Types
export type BusinessAnalytics = typeof businessAnalytics.$inferSelect;
export type InsertBusinessAnalytics = typeof businessAnalytics.$inferInsert;

export type DashboardClient = typeof dashboardClients.$inferSelect;
export type InsertDashboardClient = typeof dashboardClients.$inferInsert;

export type DashboardProject = typeof dashboardProjects.$inferSelect;
export type InsertDashboardProject = typeof dashboardProjects.$inferInsert;

export type UserDashboardSettings = typeof userDashboardSettings.$inferSelect;
export type InsertUserDashboardSettings = typeof userDashboardSettings.$inferInsert;

// Zod schemas
export const insertBusinessAnalyticsSchema = createInsertSchema(businessAnalytics);
export const insertDashboardClientSchema = createInsertSchema(dashboardClients);
export const insertDashboardProjectSchema = createInsertSchema(dashboardProjects);
export const insertUserDashboardSettingsSchema = createInsertSchema(userDashboardSettings);
