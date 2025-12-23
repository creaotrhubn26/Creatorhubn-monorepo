/**
 * CreatorHub Norge - Clean Database Persistence Schema
 * Comprehensive database schema with proper structure
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
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================================================
// TABLE DEFINITIONS
// ============================================================================

// Users
export const users = pgTable(
  'users',
  {
    id: varchar('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    profilePicture: text('profile_picture'),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    postalCode: varchar('postal_code', { length: 10 }),
    country: varchar('country', { length: 100 }).default('Norway'),
    timezone: varchar('timezone', { length: 50 }).default('Europe/Oslo'),
    language: varchar('language', { length: 10 }).default('no'),
    profession: varchar('profession', { length: 100 }),
    businessName: varchar('business_name', { length: 255 }),
    businessType: varchar('business_type', { length: 100 }),
    website: varchar('website', { length: 255 }),
    socialMedia: jsonb('social_media'),
    preferences: jsonb('preferences'),
    subscription: jsonb('subscription'),
    isActive: boolean('is_active').default(true),
    isVerified: boolean('is_verified').default(false),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
  }),
);

// Projects
export const projects = pgTable(
  'projects',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).default('draft'),
    projectType: varchar('project_type', { length: 100 }),
    clientId: varchar('client_id'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    budget: decimal('budget', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    tags: jsonb('tags'),
    settings: jsonb('settings'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('projects_user_id_idx').on(table.userId),
    clientIdIdx: index('projects_client_id_idx').on(table.clientId),
  }),
);

// Clients
export const clients = pgTable(
  'clients',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    postalCode: varchar('postal_code', { length: 10 }),
    country: varchar('country', { length: 100 }).default('Norway'),
    company: varchar('company', { length: 255 }),
    notes: text('notes'),
    tags: jsonb('tags'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('clients_user_id_idx').on(table.userId),
    emailIdx: index('clients_email_idx').on(table.email),
  }),
);

// Equipment
export const equipment = pgTable(
  'equipment',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    brand: varchar('brand', { length: 100 }),
    model: varchar('model', { length: 100 }),
    serialNumber: varchar('serial_number', { length: 100 }),
    purchaseDate: date('purchase_date'),
    purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    condition: varchar('condition', { length: 50 }),
    location: varchar('location', { length: 255 }),
    notes: text('notes'),
    specifications: jsonb('specifications'),
    maintenance: jsonb('maintenance'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('equipment_user_id_idx').on(table.userId),
    typeIdx: index('equipment_type_idx').on(table.type),
  }),
);

// Invoices
export const invoices = pgTable(
  'invoices',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    clientId: varchar('client_id').notNull(),
    projectId: varchar('project_id'),
    invoiceNumber: varchar('invoice_number').notNull(),
    status: varchar('status', { length: 50 }).default('draft'),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date'),
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    tax: decimal('tax', { precision: 10, scale: 2 }),
    total: decimal('total', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    notes: text('notes'),
    items: jsonb('items'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('invoices_user_id_idx').on(table.userId),
    clientIdIdx: index('invoices_client_id_idx').on(table.clientId),
    projectIdIdx: index('invoices_project_id_idx').on(table.projectId),
  }),
);

// Business Metrics
export const businessMetrics = pgTable(
  'business_metrics',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    metricType: varchar('metric_type', { length: 100 }).notNull(),
    value: decimal('value', { precision: 15, scale: 2 }),
    unit: varchar('unit', { length: 50 }),
    period: varchar('period', { length: 50 }),
    date: date('date').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('business_metrics_user_id_idx').on(table.userId),
    metricTypeIdx: index('business_metrics_metric_type_idx').on(table.metricType),
  }),
);

// Email Campaigns
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    content: text('content').notNull(),
    status: varchar('status', { length: 50 }).default('draft'),
    recipientCount: integer('recipient_count').default(0),
    sentCount: integer('sent_count').default(0),
    openedCount: integer('opened_count').default(0),
    clickedCount: integer('clicked_count').default(0),
    scheduledAt: timestamp('scheduled_at'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('email_campaigns_user_id_idx').on(table.userId),
    statusIdx: index('email_campaigns_status_idx').on(table.status),
  }),
);

// Enrollments
export const enrollments = pgTable(
  'enrollments',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    courseId: varchar('course_id').notNull(),
    status: varchar('status', { length: 50 }).default('enrolled'),
    enrolledAt: timestamp('enrolled_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    progress: integer('progress').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('enrollments_user_id_idx').on(table.userId),
    courseIdIdx: index('enrollments_course_id_idx').on(table.courseId),
  }),
);

// Google Drive Connections
export const googleDriveConnections = pgTable(
  'google_drive_connections',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    folderId: varchar('folder_id'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('google_drive_connections_user_id_idx').on(table.userId),
  }),
);

// Backup Sessions
export const backupSessions = pgTable(
  'backup_sessions',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    sessionType: varchar('session_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    totalFiles: integer('total_files').default(0),
    uploadedFiles: integer('uploaded_files').default(0),
    totalSize: bigint('total_size', { mode: 'number' }).default(0),
    uploadedSize: bigint('uploaded_size', { mode: 'number' }).default(0),
    progress: decimal('progress', { precision: 5, scale: 2 }).default('0'),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('backup_sessions_user_id_idx').on(table.userId),
    projectIdIdx: index('backup_sessions_project_id_idx').on(table.projectId),
  }),
);

// Camera Profiles
export const cameraProfiles = pgTable(
  'camera_profiles',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    cameraMake: varchar('camera_make', { length: 100 }),
    cameraModel: varchar('camera_model', { length: 100 }),
    lensMake: varchar('lens_make', { length: 100 }),
    lensModel: varchar('lens_model', { length: 100 }),
    settings: jsonb('settings'),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('camera_profiles_user_id_idx').on(table.userId),
  }),
);

// AI Processing Jobs
export const aiProcessingJobs = pgTable(
  'ai_processing_jobs',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    jobType: varchar('job_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    inputFiles: jsonb('input_files'),
    outputFiles: jsonb('output_files'),
    progress: integer('progress').default(0),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_processing_jobs_user_id_idx').on(table.userId),
    projectIdIdx: index('ai_processing_jobs_project_id_idx').on(table.projectId),
  }),
);

// Brand Assets
export const brandAssets = pgTable(
  'brand_assets',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 100 }).notNull(),
    filePath: text('file_path').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    isDefault: boolean('is_default').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('brand_assets_user_id_idx').on(table.userId),
    typeIdx: index('brand_assets_type_idx').on(table.type),
  }),
);

// Video Projects
export const videoProjects = pgTable(
  'video_projects',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    duration: integer('duration'), // seconds
    resolution: varchar('resolution', { length: 20 }),
    frameRate: integer('frame_rate'),
    codec: varchar('codec', { length: 50 }),
    filePath: text('file_path'),
    fileSize: bigint('file_size', { mode: 'number' }),
    thumbnailPath: text('thumbnail_path'),
    status: varchar('status', { length: 50 }).default('processing'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('video_projects_user_id_idx').on(table.userId),
    projectIdIdx: index('video_projects_project_id_idx').on(table.projectId),
  }),
);

// CRM Pipeline Stages
export const crmPipelineStages = pgTable(
  'crm_pipeline_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    position: integer('position').notNull(),
    color: varchar('color', { length: 7 }).default('#3B82F6'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('crm_pipeline_stages_name_idx').on(table.name),
    positionIdx: index('crm_pipeline_stages_position_idx').on(table.position),
  }),
);

// CRM Email Templates
export const crmEmailTemplates = pgTable(
  'crm_email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    subject: varchar('subject', { length: 255 }).notNull(),
    body: text('body').notNull(),
    type: varchar('type', { length: 50 })
      .notNull()
      .$type<'welcome' | 'follow_up' | 'reminder' | 'invoice' | 'custom'>(),
    variables: jsonb('variables'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('crm_email_templates_name_idx').on(table.name),
    typeIdx: index('crm_email_templates_type_idx').on(table.type),
  }),
);

// Memory Cards
export const memoryCards = pgTable(
  'memory_cards',
  {
    id: serial('id').primaryKey(),
    cardId: varchar('card_id').notNull().unique(),
    sessionId: integer('session_id'),
    userId: varchar('user_id').notNull(),
    cardLabel: varchar('card_label').notNull(),
    dayNumber: integer('day_number').notNull(),
    cardType: varchar('card_type').notNull(),
    capacity: varchar('capacity'),
    serialNumber: varchar('serial_number'),
    fileCount: integer('file_count').default(0),
    totalSize: bigint('total_size', { mode: 'number' }).default(0),
    fileTypes: jsonb('file_types'),
    driveFolderId: varchar('drive_folder_id'),
    uploadedFiles: integer('uploaded_files').default(0),
    uploadProgress: decimal('upload_progress', { precision: 5, scale: 2 }).default('0'),
    backupStatus: varchar('backup_status').notNull().default('pending'),
    backupLocation: varchar('backup_location'),
    backupVerified: boolean('backup_verified').default(false),
    isFormatted: boolean('is_formatted').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    cardIdIdx: index('memory_cards_card_id_idx').on(table.cardId),
    sessionIdIdx: index('memory_cards_session_id_idx').on(table.sessionId),
  }),
);

// Worklog Entries
export const worklogEntries = pgTable(
  'worklog_entries',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    day: integer('day').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    timeSpent: integer('time_spent').notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    mood: varchar('mood', { length: 50 }),
    nextSteps: text('next_steps'),
    isPrivate: boolean('is_private').default(false),
    googleKeepNoteId: varchar('google_keep_note_id'),
    keepSyncStatus: varchar('keep_sync_status').default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('worklog_entries_user_id_idx').on(table.userId),
    projectIdIdx: index('worklog_entries_project_id_idx').on(table.projectId),
  }),
);

// Admin Notifications
export const adminNotifications = pgTable(
  'admin_notifications',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').references(() => users.id),
    type: varchar('type').notNull(),
    title: varchar('title').notNull(),
    message: text('message').notNull(),
    severity: varchar('severity').default('info'),
    category: varchar('category'),
    isRead: boolean('is_read').default(false),
    actionRequired: boolean('action_required').default(false),
    actionUrl: varchar('action_url'),
    metadata: jsonb('metadata'),
    readAt: timestamp('read_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('admin_notifications_user_id_idx').on(table.userId),
    typeIdx: index('admin_notifications_type_idx').on(table.type),
  }),
);

// Platform Settings
export const platformSettings = pgTable(
  'platform_settings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: varchar('key', { length: 255 }).notNull().unique(),
    value: jsonb('value').notNull(),
    category: varchar('category', { length: 100 }).default('general'),
    description: text('description'),
    isPublic: boolean('is_public').default(false),
    updatedBy: varchar('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    keyIdx: index('platform_settings_key_idx').on(table.key),
    categoryIdx: index('platform_settings_category_idx').on(table.category),
  }),
);

// System Events
export const systemEvents = pgTable(
  'system_events',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    severity: varchar('severity', { length: 50 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    source: varchar('source', { length: 255 }).notNull(),
    message: text('message').notNull(),
    details: jsonb('details'),
    resolved: boolean('resolved').default(false).notNull(),
    alertsSent: jsonb('alerts_sent').default('[]').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timestampIdx: index('system_events_timestamp_idx').on(table.timestamp),
    severityIdx: index('system_events_severity_idx').on(table.severity),
  }),
);

// Audit Entries
export const auditEntries = pgTable(
  'audit_entries',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    resourceId: varchar('resource_id'),
    details: jsonb('details'),
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audit_entries_user_id_idx').on(table.userId),
    actionIdx: index('audit_entries_action_idx').on(table.action),
  }),
);

// Project Showcases
export const projectShowcases = pgTable(
  'project_showcases',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').references(() => projects.id),
    userId: varchar('user_id').references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).default('draft'),
    visibility: varchar('visibility', { length: 50 }).default('private'),
    settings: jsonb('settings'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('project_showcases_project_id_idx').on(table.projectId),
    userIdIdx: index('project_showcases_user_id_idx').on(table.userId),
  }),
);

// Showcase Collections
export const showcaseCollections = pgTable(
  'showcase_collections',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(false),
    settings: jsonb('settings'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('showcase_collections_user_id_idx').on(table.userId),
  }),
);

// Wedding Timelines
export const weddingTimelines = pgTable(
  'wedding_timelines',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').references(() => projects.id),
    userId: varchar('user_id').references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    culture: varchar('culture', { length: 100 }).default('norsk'),
    timelineData: jsonb('timeline_data'),
    clientSettings: jsonb('client_settings'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('wedding_timelines_project_id_idx').on(table.projectId),
    userIdIdx: index('wedding_timelines_user_id_idx').on(table.userId),
  }),
);

// Contracts
export const contracts = pgTable(
  'contracts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').references(() => projects.id),
    clientId: varchar('client_id').references(() => clients.id),
    userId: varchar('user_id').references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content'),
    status: varchar('status', { length: 50 }).default('draft'),
    signedAt: timestamp('signed_at'),
    expiresAt: timestamp('expires_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('contracts_project_id_idx').on(table.projectId),
    clientIdIdx: index('contracts_client_id_idx').on(table.clientId),
    userIdIdx: index('contracts_user_id_idx').on(table.userId),
  }),
);

// API Keys
export const apiKeys = pgTable(
  'api_keys',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
    permissions: jsonb('permissions'),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('api_keys_user_id_idx').on(table.userId),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  }),
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  equipment: many(equipment),
  invoices: many(invoices),
  aiProcessingJobs: many(aiProcessingJobs),
  brandAssets: many(brandAssets),
  businessMetrics: many(businessMetrics),
  emailCampaigns: many(emailCampaigns),
  enrollments: many(enrollments),
  googleDriveConnections: many(googleDriveConnections),
  backupSessions: many(backupSessions),
  cameraProfiles: many(cameraProfiles),
  memoryCards: many(memoryCards),
  worklogEntries: many(worklogEntries),
  adminNotifications: many(adminNotifications),
  projectShowcases: many(projectShowcases),
  showcaseCollections: many(showcaseCollections),
  weddingTimelines: many(weddingTimelines),
  contracts: many(contracts),
  apiKeys: many(apiKeys),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  invoices: many(invoices),
  videoProjects: many(videoProjects),
  backupSessions: many(backupSessions),
  aiProcessingJobs: many(aiProcessingJobs),
  worklogEntries: many(worklogEntries),
  projectShowcases: many(projectShowcases),
  weddingTimelines: many(weddingTimelines),
  contracts: many(contracts),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  projects: many(projects),
  invoices: many(invoices),
  contracts: many(contracts),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  user: one(users, {
    fields: [equipment.userId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
}));

export const businessMetricsRelations = relations(businessMetrics, ({ one }) => ({
  user: one(users, {
    fields: [businessMetrics.userId],
    references: [users.id],
  }),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({ one }) => ({
  user: one(users, {
    fields: [emailCampaigns.userId],
    references: [users.id],
  }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
}));

export const googleDriveConnectionsRelations = relations(googleDriveConnections, ({ one }) => ({
  user: one(users, {
    fields: [googleDriveConnections.userId],
    references: [users.id],
  }),
}));

export const backupSessionsRelations = relations(backupSessions, ({ one }) => ({
  user: one(users, {
    fields: [backupSessions.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [backupSessions.projectId],
    references: [projects.id],
  }),
}));

export const cameraProfilesRelations = relations(cameraProfiles, ({ one }) => ({
  user: one(users, {
    fields: [cameraProfiles.userId],
    references: [users.id],
  }),
}));

export const aiProcessingJobsRelations = relations(aiProcessingJobs, ({ one }) => ({
  user: one(users, {
    fields: [aiProcessingJobs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [aiProcessingJobs.projectId],
    references: [projects.id],
  }),
}));

export const brandAssetsRelations = relations(brandAssets, ({ one }) => ({
  user: one(users, {
    fields: [brandAssets.userId],
    references: [users.id],
  }),
}));

export const videoProjectsRelations = relations(videoProjects, ({ one }) => ({
  user: one(users, {
    fields: [videoProjects.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [videoProjects.projectId],
    references: [projects.id],
  }),
}));

export const crmPipelineStagesRelations = relations(crmPipelineStages, ({ many }) => ({
  // Add relations as needed when other CRM tables are added
}));

export const crmEmailTemplatesRelations = relations(crmEmailTemplates, ({ many }) => ({
  // Add relations as needed when other CRM tables are added
}));

export const memoryCardsRelations = relations(memoryCards, ({ one }) => ({
  user: one(users, {
    fields: [memoryCards.userId],
    references: [users.id],
  }),
}));

export const worklogEntriesRelations = relations(worklogEntries, ({ one }) => ({
  user: one(users, {
    fields: [worklogEntries.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [worklogEntries.projectId],
    references: [projects.id],
  }),
}));

export const adminNotificationsRelations = relations(adminNotifications, ({ one }) => ({
  user: one(users, {
    fields: [adminNotifications.userId],
    references: [users.id],
  }),
}));

export const platformSettingsRelations = relations(platformSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [platformSettings.updatedBy],
    references: [users.id],
  }),
}));

export const systemEventsRelations = relations(systemEvents, ({ many }) => ({
  // System events are typically standalone
}));

export const auditEntriesRelations = relations(auditEntries, ({ one }) => ({
  user: one(users, {
    fields: [auditEntries.userId],
    references: [users.id],
  }),
}));

export const projectShowcasesRelations = relations(projectShowcases, ({ one }) => ({
  project: one(projects, {
    fields: [projectShowcases.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectShowcases.userId],
    references: [users.id],
  }),
}));

export const showcaseCollectionsRelations = relations(showcaseCollections, ({ one }) => ({
  user: one(users, {
    fields: [showcaseCollections.userId],
    references: [users.id],
  }),
}));

export const weddingTimelinesRelations = relations(weddingTimelines, ({ one }) => ({
  project: one(projects, {
    fields: [weddingTimelines.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [weddingTimelines.userId],
    references: [users.id],
  }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  project: one(projects, {
    fields: [contracts.projectId],
    references: [projects.id],
  }),
  client: one(clients, {
    fields: [contracts.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [contracts.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertUserSchema = createInsertSchema(users);
export const insertProjectSchema = createInsertSchema(projects);
export const insertClientSchema = createInsertSchema(clients);
export const insertEquipmentSchema = createInsertSchema(equipment);
export const insertInvoiceSchema = createInsertSchema(invoices);
export const insertBusinessMetricSchema = createInsertSchema(businessMetrics);
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns);
export const insertEnrollmentSchema = createInsertSchema(enrollments);
export const insertGoogleDriveConnectionSchema = createInsertSchema(googleDriveConnections);
export const insertBackupSessionSchema = createInsertSchema(backupSessions);
export const insertCameraProfileSchema = createInsertSchema(cameraProfiles);
export const insertAiProcessingJobSchema = createInsertSchema(aiProcessingJobs);
export const insertBrandAssetSchema = createInsertSchema(brandAssets);
export const insertVideoProjectSchema = createInsertSchema(videoProjects);
export const insertCrmPipelineStageSchema = createInsertSchema(crmPipelineStages);
export const insertCrmEmailTemplateSchema = createInsertSchema(crmEmailTemplates);
export const insertMemoryCardSchema = createInsertSchema(memoryCards);
export const insertWorklogEntrySchema = createInsertSchema(worklogEntries);
export const insertAdminNotificationSchema = createInsertSchema(adminNotifications);
export const insertPlatformSettingSchema = createInsertSchema(platformSettings);
export const insertSystemEventSchema = createInsertSchema(systemEvents);
export const insertAuditEntrySchema = createInsertSchema(auditEntries);
export const insertProjectShowcaseSchema = createInsertSchema(projectShowcases);
export const insertShowcaseCollectionSchema = createInsertSchema(showcaseCollections);
export const insertWeddingTimelineSchema = createInsertSchema(weddingTimelines);
export const insertContractSchema = createInsertSchema(contracts);
export const insertApiKeySchema = createInsertSchema(apiKeys);

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type BusinessMetric = typeof businessMetrics.$inferSelect;
export type InsertBusinessMetric = z.infer<typeof insertBusinessMetricSchema>;

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;

export type GoogleDriveConnection = typeof googleDriveConnections.$inferSelect;
export type InsertGoogleDriveConnection = z.infer<typeof insertGoogleDriveConnectionSchema>;

export type BackupSession = typeof backupSessions.$inferSelect;
export type InsertBackupSession = z.infer<typeof insertBackupSessionSchema>;

export type CameraProfile = typeof cameraProfiles.$inferSelect;
export type InsertCameraProfile = z.infer<typeof insertCameraProfileSchema>;

export type AiProcessingJob = typeof aiProcessingJobs.$inferSelect;
export type InsertAiProcessingJob = z.infer<typeof insertAiProcessingJobSchema>;

export type BrandAsset = typeof brandAssets.$inferSelect;
export type InsertBrandAsset = z.infer<typeof insertBrandAssetSchema>;

export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;

export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type InsertCrmPipelineStage = z.infer<typeof insertCrmPipelineStageSchema>;

export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type InsertCrmEmailTemplate = z.infer<typeof insertCrmEmailTemplateSchema>;

export type MemoryCard = typeof memoryCards.$inferSelect;
export type InsertMemoryCard = z.infer<typeof insertMemoryCardSchema>;

export type WorklogEntry = typeof worklogEntries.$inferSelect;
export type InsertWorklogEntry = z.infer<typeof insertWorklogEntrySchema>;

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;

export type SystemEvent = typeof systemEvents.$inferSelect;
export type InsertSystemEvent = z.infer<typeof insertSystemEventSchema>;

export type AuditEntry = typeof auditEntries.$inferSelect;
export type InsertAuditEntry = z.infer<typeof insertAuditEntrySchema>;

export type ProjectShowcase = typeof projectShowcases.$inferSelect;
export type InsertProjectShowcase = z.infer<typeof insertProjectShowcaseSchema>;

export type ShowcaseCollection = typeof showcaseCollections.$inferSelect;
export type InsertShowcaseCollection = z.infer<typeof insertShowcaseCollectionSchema>;

export type WeddingTimeline = typeof weddingTimelines.$inferSelect;
export type InsertWeddingTimeline = z.infer<typeof insertWeddingTimelineSchema>;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
