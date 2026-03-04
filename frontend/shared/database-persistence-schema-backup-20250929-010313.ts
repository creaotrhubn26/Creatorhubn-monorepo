/**
 * CreatorHub Norge - Complete Database Persistence Schema
 * Comprehensive database schema for all platform features
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
import type { z } from 'zod';

// ============================================================================
// PROJECT MANAGEMENT SYSTEM
// ============================================================================

export const projects = pgTable('projects', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  clientName: varchar('client_name', { length: 255 }),
  eventDate: date('event_date'),
  location: text('location'),
  projectType: varchar('project_type')
    .$type<'wedding' | 'portrait' | 'commercial' | 'family' | 'business' | 'event'>()
    .notNull(),
  weddingCulture: varchar('wedding_culture').default('norsk'),
  status: varchar('status')
    .$type<'planning' | 'active' | 'review' | 'completed' | 'on_hold' | 'cancelled'>()
    .default('planning'),
  phase: varchar('phase')
    .$type<'pre_production' | 'production' | 'post_production' | 'delivered'>()
    .default('pre_production'),
  priority: varchar('priority').$type<'low' | 'medium' | 'high' | 'urgent'>().default('medium'),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  projectData: jsonb('project_data'), // Store wizard data and custom fields
  settings: jsonb('settings'), // Project-specific settings
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  postalCode: varchar('postal_code', { length: 10 }),
  notes: text('notes'),
  preferences: jsonb('preferences'), // Client preferences and requirements
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// VIDEO PRODUCTION SYSTEM
// ============================================================================

export const videoProjects = pgTable('video_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  resolution: varchar('resolution', { length: 50 }).default('4K (3840x2160)'),
  frameRate: integer('frame_rate').default(25),
  aspectRatio: varchar('aspect_ratio', { length: 20 }).default('16:9'),
  colorSpace: varchar('color_space', { length: 50 }).default('Rec.709'),
  audioSampleRate: integer('audio_sample_rate').default(48000),
  duration: integer('duration').default(0), // Duration in seconds
  status: varchar('status')
    .$type<'draft' | 'active' | 'rendering' | 'completed' | 'archived'>()
    .default('draft'),
  userId: varchar('user_id').notNull(),
  projectSettings: jsonb('project_settings'),
  exportSettings: jsonb('export_settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const videoTimelines = pgTable('video_timelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  trackData: jsonb('track_data').notNull(), // Complete timeline track structure
  duration: integer('duration').default(0),
  zoomLevel: decimal('zoom_level', { precision: 3, scale: 2 }).default('1.0'),
  position: integer('position').default(0), // Current playhead position
  settings: jsonb('settings'), // Timeline-specific settings
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const videoClips = pgTable('video_clips', {
  id: uuid('id').primaryKey().defaultRandom(),
  timelineId: uuid('timeline_id').notNull(),
  trackId: varchar('track_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  type: varchar('type').$type<'video' | 'audio' | 'image' | 'text'>().notNull(),
  startTime: decimal('start_time', { precision: 10, scale: 3 }).notNull(),
  endTime: decimal('end_time', { precision: 10, scale: 3 }).notNull(),
  duration: decimal('duration', { precision: 10, scale: 3 }).notNull(),
  effects: jsonb('effects'), // Applied effects and their parameters
  properties: jsonb('properties'), // Clip-specific properties
  thumbnail: text('thumbnail'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// AI CREATIVE TOOLS SYSTEM
// ============================================================================

export const aiProcessingJobs = pgTable('ai_processing_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  projectId: uuid('project_id'),
  jobType: varchar('job_type')
    .$type<
      | 'photo_enhancement'
      | 'style_transfer'
      | 'background_removal'
      | 'video_enhancement'
      | 'color_grading'
    >()
    .notNull(),
  inputData: jsonb('input_data').notNull(),
  outputData: jsonb('output_data'),
  status: varchar('status')
    .$type<'pending' | 'processing' | 'completed' | 'failed'>()
    .default('pending'),
  progress: integer('progress').default(0),
  processingTime: integer('processing_time'), // Time in milliseconds
  errorMessage: text('error_message'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clientProofingSessions = pgTable('client_proofing_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  clientId: uuid('client_id').notNull(),
  sessionName: varchar('session_name', { length: 255 }).notNull(),
  images: jsonb('images').notNull(), // Array of image data
  feedback: jsonb('feedback'), // Client feedback and comments
  approvedImages: jsonb('approved_images'), // Array of approved image IDs
  rejectedImages: jsonb('rejected_images'), // Array of rejected image IDs
  status: varchar('status')
    .$type<'draft' | 'sent_to_client' | 'awaiting_feedback' | 'completed'>()
    .default('draft'),
  expiresAt: timestamp('expires_at'),
  shareLink: varchar('share_link', { length: 255 }),
  viewCount: integer('view_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const brandAssets = pgTable('brand_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  assetType: varchar('asset_type')
    .$type<'logo' | 'watermark' | 'template' | 'font' | 'color_palette'>()
    .notNull(),
  category: varchar('category', { length: 100 }),
  filePath: text('file_path'),
  fileSize: bigint('file_size', { mode: 'number' }),
  dimensions: varchar('dimensions', { length: 50 }),
  colorProfile: varchar('color_profile', { length: 50 }),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'), // Array of tags for searching
  isPublic: boolean('is_public').default(false),
  downloadCount: integer('download_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// EQUIPMENT MANAGEMENT SYSTEM
// ============================================================================

export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 100 }),
  model: varchar('model', { length: 100 }),
  category: varchar('category')
    .$type<'camera' | 'lens' | 'lighting' | 'audio' | 'tripod' | 'accessory' | 'memory_card'>()
    .notNull(),
  serialNumber: varchar('serial_number', { length: 100 }),
  purchaseDate: date('purchase_date'),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  currentValue: decimal('current_value', { precision: 10, scale: 2 }),
  condition: varchar('condition')
    .$type<'excellent' | 'good' | 'fair' | 'poor'>()
    .default('excellent'),
  status: varchar('status')
    .$type<'available' | 'in_use' | 'maintenance' | 'missing' | 'sold'>()
    .default('available'),
  location: varchar('location', { length: 255 }),
  notes: text('notes'),
  specifications: jsonb('specifications'),
  maintenanceHistory: jsonb('maintenance_history'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Memory cards table moved to memory-card-schema.ts to avoid conflicts
// Use memoryCards from '@shared/memory-card-schema' for backup system

// ============================================================================
// BUSINESS ANALYTICS SYSTEM
// ============================================================================

export const businessMetrics = pgTable('business_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  metricType: varchar('metric_type')
    .$type<'revenue' | 'projects' | 'clients' | 'equipment_usage' | 'time_tracking'>()
    .notNull(),
  date: date('date').notNull(),
  value: decimal('value', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  clientId: uuid('client_id').notNull(),
  projectId: uuid('project_id'),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  status: varchar('status')
    .$type<'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'>()
    .default('draft'),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  paidDate: date('paid_date'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }).default('0'),
  vatRate: decimal('vat_rate', { precision: 5, scale: 2 }).default('25'), // Norwegian MVA
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  lineItems: jsonb('line_items').notNull(),
  notes: text('notes'),
  paymentTerms: text('payment_terms'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// COMMUNICATION SYSTEM
// ============================================================================

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id'),
  type: varchar('type')
    .$type<'client_project' | 'internal_team' | 'vendor_coordination' | 'support'>()
    .notNull(),
  title: varchar('title', { length: 255 }),
  participants: jsonb('participants').notNull(), // Array of user IDs
  status: varchar('status').$type<'active' | 'archived' | 'closed'>().default('active'),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(),
  senderId: varchar('sender_id').notNull(),
  senderType: varchar('sender_type').$type<'user' | 'client' | 'system'>().notNull(),
  content: text('content').notNull(),
  messageType: varchar('message_type')
    .$type<'text' | 'image' | 'file' | 'system_notification'>()
    .default('text'),
  attachments: jsonb('attachments'), // Array of file attachments
  readBy: jsonb('read_by'), // Array of user IDs who have read the message
  editedAt: timestamp('edited_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const emailCampaigns = pgTable('email_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  content: text('content').notNull(),
  templateType: varchar('template_type')
    .$type<'project_update' | 'invoice_reminder' | 'promotional' | 'newsletter'>()
    .notNull(),
  recipients: jsonb('recipients').notNull(), // Array of email addresses
  status: varchar('status').$type<'draft' | 'scheduled' | 'sent' | 'failed'>().default('draft'),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  openRate: decimal('open_rate', { precision: 5, scale: 2 }),
  clickRate: decimal('click_rate', { precision: 5, scale: 2 }),
  stats: jsonb('stats'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// LEARNING ACADEMY SYSTEM
// ============================================================================

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category')
    .$type<'photography' | 'videography' | 'business' | 'editing' | 'equipment'>()
    .notNull(),
  level: varchar('level').$type<'beginner' | 'intermediate' | 'advanced'>().notNull(),
  instructor: varchar('instructor', { length: 255 }),
  duration: integer('duration'), // Duration in minutes
  price: decimal('price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  isPublished: boolean('is_published').default(false),
  enrollmentCount: integer('enrollment_count').default(0),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  thumbnailUrl: text('thumbnail_url'),
  courseContent: jsonb('course_content'), // Lessons and materials
  prerequisites: jsonb('prerequisites'),
  learningObjectives: jsonb('learning_objectives'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  courseId: uuid('course_id').notNull(),
  status: varchar('status')
    .$type<'enrolled' | 'in_progress' | 'completed' | 'dropped'>()
    .default('enrolled'),
  progress: integer('progress').default(0), // Percentage completed
  completedLessons: jsonb('completed_lessons'), // Array of completed lesson IDs
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  lastAccessedAt: timestamp('last_accessed_at'),
  certificateIssued: boolean('certificate_issued').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// GOOGLE DRIVE INTEGRATION SYSTEM
// ============================================================================

export const googleDriveConnections = pgTable('google_drive_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  googleAccountEmail: varchar('google_account_email', {
    length: 255,
  }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  connectionStatus: varchar('connection_status')
    .$type<'connected' | 'disconnected' | 'error' | 'expired'>()
    .default('connected'),
  lastSync: timestamp('last_sync'),
  syncEnabled: boolean('sync_enabled').default(true),
  folderStructure: jsonb('folder_structure'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleDriveProjects = pgTable('google_drive_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  driveFolderId: varchar('drive_folder_id', { length: 255 }).notNull(),
  folderName: varchar('folder_name', { length: 255 }).notNull(),
  folderUrl: text('folder_url'),
  clientEmail: varchar('client_email', { length: 255 }),
  clientPermissions: varchar('client_permissions')
    .$type<'viewer' | 'commenter' | 'editor'>()
    .default('viewer'),
  autoBackup: boolean('auto_backup').default(true),
  gdprCompliant: boolean('gdpr_compliant').default(false),
  deletionScheduled: timestamp('deletion_scheduled'),
  folderStructure: jsonb('folder_structure'),
  syncStatus: varchar('sync_status')
    .$type<'synced' | 'syncing' | 'error' | 'paused'>()
    .default('synced'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// MEMORY CARD BACKUP SYSTEM
// ============================================================================

export const backupSessions = pgTable('backup_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  memoryCardId: uuid('memory_card_id').notNull(),
  sessionName: varchar('session_name', { length: 255 }).notNull(),
  sessionType: varchar('session_type')
    .$type<'full_backup' | 'incremental' | 'verification' | 'recovery'>()
    .notNull(),
  status: varchar('status')
    .$type<'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'>()
    .default('pending'),
  startTime: timestamp('start_time').defaultNow(),
  endTime: timestamp('end_time'),
  totalFiles: integer('total_files'),
  processedFiles: integer('processed_files').default(0),
  totalSize: bigint('total_size', { mode: 'number' }),
  processedSize: bigint('processed_size', { mode: 'number' }).default(0),
  backupLocation: text('backup_location'),
  errorLog: jsonb('error_log'),
  verificationStatus: varchar('verification_status').$type<'pending' | 'verified' | 'failed'>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cameraProfiles = pgTable('camera_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  manufacturer: varchar('manufacturer')
    .$type<'Canon' | 'Sony' | 'Nikon' | 'Panasonic' | 'Fujifilm' | 'Other'>()
    .notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  cardSlots: integer('card_slots').default(1),
  supportedCardTypes: jsonb('supported_card_types'), // Array of supported card types
  folderStructure: jsonb('folder_structure'),
  fileNamingPattern: varchar('file_naming_pattern', { length: 255 }),
  autoBackupEnabled: boolean('auto_backup_enabled').default(true),
  backupLocation: text('backup_location'),
  settings: jsonb('settings'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// USER MANAGEMENT SYSTEM
// ============================================================================

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
    socialMedia: jsonb('social_media'), // Social media links and handles
    preferences: jsonb('preferences'), // User preferences and settings
    subscription: jsonb('subscription'), // Subscription details
    isActive: boolean('is_active').default(true),
    isVerified: boolean('is_verified').default(false),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_unique').on(table.email),
  }),
);

// ============================================================================
// CRM SYSTEM
// ============================================================================

export const crmPipelineStages = pgTable(
  'crm_pipeline_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    position: integer('position').notNull(),
    color: varchar('color', { length: 7 }).default('#3B82F6'), // Hex color
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('crm_pipeline_stages_name_unique').on(table.name),
    positionIdx: index('crm_pipeline_stages_position_idx').on(table.position),
  }),
);

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
    variables: jsonb('variables'), // Available template variables
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('crm_email_templates_name_unique').on(table.name),
    typeIdx: index('crm_email_templates_type_idx').on(table.type),
  }),
);

// ============================================================================
// RELATIONS
// ============================================================================

// Note: Projects relations removed - projects table no longer exists

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  proofingSessions: many(clientProofingSessions),
  invoices: many(invoices),
}));

export const videoProjectsRelations = relations(videoProjects, ({ many }) => ({
  timelines: many(videoTimelines),
}));

export const videoTimelinesRelations = relations(videoTimelines, ({ one, many }) => ({
  project: one(videoProjects, {
    fields: [videoTimelines.projectId],
    references: [videoProjects.id],
  }),
  clips: many(videoClips),
}));

export const videoClipsRelations = relations(videoClips, ({ one }) => ({
  timeline: one(videoTimelines, {
    fields: [videoClips.timelineId],
    references: [videoTimelines.id],
  }),
}));

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
}));

export const crmPipelineStagesRelations = relations(crmPipelineStages, ({ many }) => ({
  // Add relations as needed when other CRM tables are added
}));

export const crmEmailTemplatesRelations = relations(crmEmailTemplates, ({ many }) => ({
  // Add relations as needed when other CRM tables are added
}));

// Memory card relations moved to memory-card-schema.ts

// Backup session relations moved to memory-card-schema.ts

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

// Project management schemas
export const insertProjectSchema = createInsertSchema(projects);
export const insertClientSchema = createInsertSchema(clients);

// Video production schemas
export const insertVideoProjectSchema = createInsertSchema(videoProjects);
export const insertVideoTimelineSchema = createInsertSchema(videoTimelines);
export const insertVideoClipSchema = createInsertSchema(videoClips);

// AI and creative tools schemas
export const insertAiProcessingJobSchema = createInsertSchema(aiProcessingJobs);
export const insertClientProofingSessionSchema = createInsertSchema(clientProofingSessions);
export const insertBrandAssetSchema = createInsertSchema(brandAssets);

// Equipment management schemas
export const insertEquipmentSchema = createInsertSchema(equipment);
// Memory card schema moved to memory-card-schema.ts

// Business analytics schemas
export const insertBusinessMetricSchema = createInsertSchema(businessMetrics);
export const insertInvoiceSchema = createInsertSchema(invoices);

// Communication schemas
export const insertConversationSchema = createInsertSchema(conversations);
export const insertMessageSchema = createInsertSchema(messages);
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns);

// Learning academy schemas
export const insertCourseSchema = createInsertSchema(courses);
export const insertEnrollmentSchema = createInsertSchema(enrollments);

// Google Drive integration schemas
export const insertGoogleDriveConnectionSchema = createInsertSchema(googleDriveConnections);
export const insertGoogleDriveProjectSchema = createInsertSchema(googleDriveProjects);

// Memory card backup schemas
export const insertBackupSessionSchema = createInsertSchema(backupSessions);
export const insertCameraProfileSchema = createInsertSchema(cameraProfiles);

// User management schemas
export const insertUserSchema = createInsertSchema(users);

// CRM schemas
export const insertCrmPipelineStageSchema = createInsertSchema(crmPipelineStages);
export const insertCrmEmailTemplateSchema = createInsertSchema(crmEmailTemplates);

// Export types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

// Memory card types are defined in memory-card-schema.ts

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type InsertCrmPipelineStage = z.infer<typeof insertCrmPipelineStageSchema>;

export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type InsertCrmEmailTemplate = z.infer<typeof insertCrmEmailTemplateSchema>;

// ============================================================================
// CORE PLATFORM TABLES (Added for Essential Functionality)
// ============================================================================

// User Roles
export const userRoles = pgTable(
  'user_roles',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    roleId: varchar('role_id').notNull(),
    assignedBy: varchar('assigned_by').notNull(),
    assignedAt: timestamp('assigned_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_roles_user_id_idx').on(table.userId),
    roleIdIdx: index('user_roles_role_id_idx').on(table.roleId),
  }),
);

// Memory Card Management
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
    uploadProgress: decimal('upload_progress', { precision: 5, scale: 2 }).default(0),
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
// RELATIONS FOR NEW CORE TABLES
// ============================================================================

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
// RELATIONS FOR AUTHENTICATION & USER MANAGEMENT TABLES
// ============================================================================

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}));

export const userPermissionsRelations = relations(userPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userPermissions.userId],
    references: [users.id],
  }),
  grantedByUser: one(users, {
    fields: [userPermissions.grantedBy],
    references: [users.id],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const userActivityLogsRelations = relations(userActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [userActivityLogs.userId],
    references: [users.id],
  }),
}));

export const userConsentsRelations = relations(userConsents, ({ one }) => ({
  user: one(users, {
    fields: [userConsents.userId],
    references: [users.id],
  }),
}));

export const userFilesRelations = relations(userFiles, ({ one }) => ({
  user: one(users, {
    fields: [userFiles.userId],
    references: [users.id],
  }),
}));

export const userEquipmentRelations = relations(userEquipment, ({ one }) => ({
  user: one(users, {
    fields: [userEquipment.userId],
    references: [users.id],
  }),
  equipment: one(equipment, {
    fields: [userEquipment.equipmentId],
    references: [equipment.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
}));

export const customRolesRelations = relations(customRoles, ({ one }) => ({
  createdByUser: one(users, {
    fields: [customRoles.createdBy],
    references: [users.id],
  }),
}));

export const customProfilesRelations = relations(customProfiles, ({ one }) => ({
  user: one(users, {
    fields: [customProfiles.userId],
    references: [users.id],
  }),
}));

export const onboardingProfilesRelations = relations(onboardingProfiles, ({ one }) => ({
  user: one(users, {
    fields: [onboardingProfiles.userId],
    references: [users.id],
  }),
}));

export const sessionActivityLogRelations = relations(sessionActivityLog, ({ one }) => ({
  user: one(users, {
    fields: [sessionActivityLog.userId],
    references: [users.id],
  }),
}));

export const userProvisioningRequestsRelations = relations(userProvisioningRequests, ({ one }) => ({
  user: one(users, {
    fields: [userProvisioningRequests.userId],
    references: [users.id],
  }),
  requestedByUser: one(users, {
    fields: [userProvisioningRequests.requestedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [userProvisioningRequests.approvedBy],
    references: [users.id],
  }),
}));

export const userProvisioningStatusRelations = relations(userProvisioningStatus, ({ one }) => ({
  user: one(users, {
    fields: [userProvisioningStatus.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// INSERT SCHEMAS FOR NEW CORE TABLES
// ============================================================================

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
// INSERT SCHEMAS FOR AUTHENTICATION & USER MANAGEMENT TABLES
// ============================================================================

export const insertUserRoleSchema = createInsertSchema(userRoles);
export const insertUserPermissionSchema = createInsertSchema(userPermissions);
export const insertUserPreferenceSchema = createInsertSchema(userPreferences);
export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs);
export const insertUserConsentSchema = createInsertSchema(userConsents);
export const insertUserFileSchema = createInsertSchema(userFiles);
export const insertUserEquipmentSchema = createInsertSchema(userEquipment);
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions);
export const insertCustomRoleSchema = createInsertSchema(customRoles);
export const insertCustomProfileSchema = createInsertSchema(customProfiles);
export const insertOnboardingProfileSchema = createInsertSchema(onboardingProfiles);
export const insertSessionActivityLogSchema = createInsertSchema(sessionActivityLog);
export const insertUserProvisioningRequestSchema = createInsertSchema(userProvisioningRequests);
export const insertUserProvisioningStatusSchema = createInsertSchema(userProvisioningStatus);

// ============================================================================
// INSERT SCHEMAS FOR CORE BUSINESS OPERATIONS TABLES
// ============================================================================

export const insertQuoteSchema = createInsertSchema(quotes);
export const insertPaymentSchema = createInsertSchema(payments);
export const insertExpenseSchema = createInsertSchema(expenses);
export const insertTaxCalculationSchema = createInsertSchema(taxCalculations);
export const insertPricingStructureSchema = createInsertSchema(pricingStructures);
export const insertPriceTierSchema = createInsertSchema(priceTiers);
export const insertPriceFeatureSchema = createInsertSchema(priceFeatures);
export const insertDiscountSchema = createInsertSchema(discounts);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const insertSubscriptionChangeHistorySchema = createInsertSchema(subscriptionChangeHistory);
export const insertHourOverageSchema = createInsertSchema(hourOverages);
export const insertSalesActivitySchema = createInsertSchema(salesActivities);
export const insertSalesAnalyticSchema = createInsertSchema(salesAnalytics);
export const insertSalesConversationSchema = createInsertSchema(salesConversations);
export const insertSalesLeadSchema = createInsertSchema(salesLeads);
export const insertBusinessProfileSchema = createInsertSchema(businessProfiles);
export const insertCompetitorAnalysisSchema = createInsertSchema(competitorAnalysis);
export const insertReferralProgramSchema = createInsertSchema(referralProgram);
export const insertCustomPackageSchema = createInsertSchema(customPackages);
export const insertStandardPackageSchema = createInsertSchema(standardPackages);
export const insertServiceActivationSchema = createInsertSchema(serviceActivations);
export const insertTravelExpenseSchema = createInsertSchema(travelExpenses);
export const insertTravelLogSchema = createInsertSchema(travelLog);
export const insertAdditionalCostSchema = createInsertSchema(additionalCosts);

// ============================================================================
// TYPESCRIPT TYPES FOR NEW CORE TABLES
// ============================================================================

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

// ============================================================================
// TYPESCRIPT TYPES FOR AUTHENTICATION & USER MANAGEMENT TABLES
// ============================================================================

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;

export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;

export type UserConsent = typeof userConsents.$inferSelect;
export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>;

export type UserFile = typeof userFiles.$inferSelect;
export type InsertUserFile = z.infer<typeof insertUserFileSchema>;

export type UserEquipment = typeof userEquipment.$inferSelect;
export type InsertUserEquipment = z.infer<typeof insertUserEquipmentSchema>;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

export type CustomRole = typeof customRoles.$inferSelect;
export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;

export type CustomProfile = typeof customProfiles.$inferSelect;
export type InsertCustomProfile = z.infer<typeof insertCustomProfileSchema>;

export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;
export type InsertOnboardingProfile = z.infer<typeof insertOnboardingProfileSchema>;

export type SessionActivityLog = typeof sessionActivityLog.$inferSelect;
export type InsertSessionActivityLog = z.infer<typeof insertSessionActivityLogSchema>;

export type UserProvisioningRequest = typeof userProvisioningRequests.$inferSelect;
export type InsertUserProvisioningRequest = z.infer<typeof insertUserProvisioningRequestSchema>;

export type UserProvisioningStatus = typeof userProvisioningStatus.$inferSelect;
export type InsertUserProvisioningStatus = z.infer<typeof insertUserProvisioningStatusSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR CORE BUSINESS OPERATIONS TABLES
// ============================================================================

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type TaxCalculation = typeof taxCalculations.$inferSelect;
export type InsertTaxCalculation = z.infer<typeof insertTaxCalculationSchema>;

export type PricingStructure = typeof pricingStructures.$inferSelect;
export type InsertPricingStructure = z.infer<typeof insertPricingStructureSchema>;

export type PriceTier = typeof priceTiers.$inferSelect;
export type InsertPriceTier = z.infer<typeof insertPriceTierSchema>;

export type PriceFeature = typeof priceFeatures.$inferSelect;
export type InsertPriceFeature = z.infer<typeof insertPriceFeatureSchema>;

export type Discount = typeof discounts.$inferSelect;
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type SubscriptionChangeHistory = typeof subscriptionChangeHistory.$inferSelect;
export type InsertSubscriptionChangeHistory = z.infer<typeof insertSubscriptionChangeHistorySchema>;

export type HourOverage = typeof hourOverages.$inferSelect;
export type InsertHourOverage = z.infer<typeof insertHourOverageSchema>;

export type SalesActivity = typeof salesActivities.$inferSelect;
export type InsertSalesActivity = z.infer<typeof insertSalesActivitySchema>;

export type SalesAnalytic = typeof salesAnalytics.$inferSelect;
export type InsertSalesAnalytic = z.infer<typeof insertSalesAnalyticSchema>;

export type SalesConversation = typeof salesConversations.$inferSelect;
export type InsertSalesConversation = z.infer<typeof insertSalesConversationSchema>;

export type SalesLead = typeof salesLeads.$inferSelect;
export type InsertSalesLead = z.infer<typeof insertSalesLeadSchema>;

export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;

export type CompetitorAnalysis = typeof competitorAnalysis.$inferSelect;
export type InsertCompetitorAnalysis = z.infer<typeof insertCompetitorAnalysisSchema>;

export type ReferralProgram = typeof referralProgram.$inferSelect;
export type InsertReferralProgram = z.infer<typeof insertReferralProgramSchema>;

export type CustomPackage = typeof customPackages.$inferSelect;
export type InsertCustomPackage = z.infer<typeof insertCustomPackageSchema>;

export type StandardPackage = typeof standardPackages.$inferSelect;
export type InsertStandardPackage = z.infer<typeof insertStandardPackageSchema>;

export type ServiceActivation = typeof serviceActivations.$inferSelect;
export type InsertServiceActivation = z.infer<typeof insertServiceActivationSchema>;

export type TravelExpense = typeof travelExpenses.$inferSelect;
export type InsertTravelExpense = z.infer<typeof insertTravelExpenseSchema>;

export type TravelLog = typeof travelLog.$inferSelect;
export type InsertTravelLog = z.infer<typeof insertTravelLogSchema>;

export type AdditionalCost = typeof additionalCosts.$inferSelect;
export type InsertAdditionalCost = z.infer<typeof insertAdditionalCostSchema>;

// ============================================================================
// CORE BUSINESS OPERATIONS TABLES
// ============================================================================

// Quotes
export const quotes = pgTable(
  'quotes',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    quoteNumber: varchar('quote_number').notNull(),
    clientId: varchar('client_id').notNull(),
    submissionId: varchar('submission_id'),
    services: jsonb('services').notNull(),
    additionalCosts: jsonb('additional_costs'),
    discounts: jsonb('discounts'),
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    mva: decimal('mva', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency'),
    status: varchar('status'),
    validUntil: timestamp('valid_until'),
    contractId: varchar('contract_id'),
    invoiceId: varchar('invoice_id'),
    notes: text('notes'),
    internalNotes: text('internal_notes'),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    sentAt: timestamp('sent_at'),
    viewedAt: timestamp('viewed_at'),
    respondedAt: timestamp('responded_at'),
  },
  (table) => ({
    clientIdIdx: index('quotes_client_id_idx').on(table.clientId),
    quoteNumberIdx: index('quotes_quote_number_idx').on(table.quoteNumber),
  }),
);

// Payments
export const payments = pgTable(
  'payments',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    invoiceId: varchar('invoice_id'),
    projectId: varchar('project_id'),
    paymentType: varchar('payment_type').notNull(),
    paymentMethod: varchar('payment_method').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency'),
    status: varchar('status'),
    transactionId: varchar('transaction_id'),
    externalPaymentId: varchar('external_payment_id'),
    paymentDate: timestamp('payment_date').notNull(),
    processedAt: timestamp('processed_at'),
    description: text('description'),
    internalNotes: text('internal_notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('payments_user_id_idx').on(table.userId),
    invoiceIdIdx: index('payments_invoice_id_idx').on(table.invoiceId),
    projectIdIdx: index('payments_project_id_idx').on(table.projectId),
  }),
);

// Expenses
export const expenses = pgTable(
  'expenses',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    expenseType: varchar('expense_type').notNull(),
    category: varchar('category').notNull(),
    description: text('description').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency'),
    expenseDate: date('expense_date').notNull(),
    vendor: varchar('vendor'),
    isBusinessExpense: boolean('is_business_expense'),
    isDeductible: boolean('is_deductible'),
    vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }),
    receiptUrl: varchar('receipt_url'),
    receiptNumber: varchar('receipt_number'),
    status: varchar('status'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('expenses_user_id_idx').on(table.userId),
    projectIdIdx: index('expenses_project_id_idx').on(table.projectId),
    categoryIdx: index('expenses_category_idx').on(table.category),
  }),
);

// Tax Calculations
export const taxCalculations = pgTable(
  'tax_calculations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    year: integer('year').notNull(),
    quarter: integer('quarter'),
    grossIncome: decimal('gross_income', { precision: 15, scale: 2 }),
    businessExpenses: decimal('business_expenses', { precision: 15, scale: 2 }),
    netIncome: decimal('net_income', { precision: 15, scale: 2 }),
    vatCollected: decimal('vat_collected', { precision: 15, scale: 2 }),
    vatPaid: decimal('vat_paid', { precision: 15, scale: 2 }),
    vatOwed: decimal('vat_owed', { precision: 15, scale: 2 }),
    incomeTax: decimal('income_tax', { precision: 15, scale: 2 }),
    totalTax: decimal('total_tax', { precision: 15, scale: 2 }),
    status: varchar('status', { length: 50 }).default('draft'),
    filedAt: timestamp('filed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('tax_calculations_user_id_idx').on(table.userId),
    yearIdx: index('tax_calculations_year_idx').on(table.year),
  }),
);

// Pricing Structures
export const pricingStructures = pgTable(
  'pricing_structures',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name').notNull(),
    type: varchar('type').notNull(),
    profession: varchar('profession').notNull(),
    category: varchar('category').notNull(),
    hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
    fullDayRate: decimal('full_day_rate', { precision: 10, scale: 2 }),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }),
    minimumPrice: decimal('minimum_price', { precision: 10, scale: 2 }),
    maximumPrice: decimal('maximum_price', { precision: 10, scale: 2 }),
    seasonFactor: decimal('season_factor', { precision: 3, scale: 2 }),
    status: varchar('status'),
    description: text('description'),
    includedServices: jsonb('included_services'),
    extraCosts: jsonb('extra_costs'),
    travelIncluded: boolean('travel_included'),
    travelRadiusKm: integer('travel_radius_km'),
    travelRatePerKm: decimal('travel_rate_per_km', { precision: 8, scale: 2 }),
    isDefault: boolean('is_default'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('pricing_structures_user_id_idx').on(table.userId),
    professionIdx: index('pricing_structures_profession_idx').on(table.profession),
  }),
);

// Price Tiers
export const priceTiers = pgTable(
  'price_tiers',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    features: jsonb('features'),
    maxUsers: integer('max_users'),
    storageLimit: bigint('storage_limit', { mode: 'number' }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('price_tiers_name_idx').on(table.name),
  }),
);

// Price Features
export const priceFeatures = pgTable(
  'price_features',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tierId: varchar('tier_id').notNull(),
    featureName: varchar('feature_name', { length: 255 }).notNull(),
    featureValue: varchar('feature_value', { length: 255 }),
    isIncluded: boolean('is_included').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tierIdIdx: index('price_features_tier_id_idx').on(table.tierId),
  }),
);

// Discounts
export const discounts = pgTable(
  'discounts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    discountType: varchar('discount_type', { length: 50 }).notNull(), // percentage, fixed_amount
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: decimal('min_order_amount', { precision: 10, scale: 2 }),
    maxDiscountAmount: decimal('max_discount_amount', { precision: 10, scale: 2 }),
    validFrom: timestamp('valid_from').defaultNow(),
    validUntil: timestamp('valid_until'),
    usageLimit: integer('usage_limit'),
    usageCount: integer('usage_count').default(0),
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    codeIdx: index('discounts_code_idx').on(table.code),
    createdByIdx: index('discounts_created_by_idx').on(table.createdBy),
  }),
);

// Subscriptions
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    tierId: varchar('tier_id').notNull(),
    status: varchar('status', { length: 50 }).default('active'),
    startDate: timestamp('start_date').defaultNow(),
    endDate: timestamp('end_date'),
    billingCycle: varchar('billing_cycle', { length: 20 }).default('monthly'),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    autoRenew: boolean('auto_renew').default(true),
    paymentMethod: varchar('payment_method', { length: 100 }),
    lastBilled: timestamp('last_billed'),
    nextBilling: timestamp('next_billing'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
    tierIdIdx: index('subscriptions_tier_id_idx').on(table.tierId),
    statusIdx: index('subscriptions_status_idx').on(table.status),
  }),
);

// Subscription Change History
export const subscriptionChangeHistory = pgTable(
  'subscription_change_history',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subscriptionId: varchar('subscription_id').notNull(),
    changeType: varchar('change_type', { length: 50 }).notNull(),
    fromTierId: varchar('from_tier_id'),
    toTierId: varchar('to_tier_id'),
    reason: text('reason'),
    changedBy: varchar('changed_by').notNull(),
    effectiveDate: timestamp('effective_date').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    subscriptionIdIdx: index('subscription_change_history_subscription_id_idx').on(
      table.subscriptionId,
    ),
    changeTypeIdx: index('subscription_change_history_change_type_idx').on(table.changeType),
  }),
);

// Hour Overages
export const hourOverages = pgTable(
  'hour_overages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    includedHours: integer('included_hours').notNull(),
    usedHours: integer('used_hours').notNull(),
    overageHours: integer('overage_hours').notNull(),
    overageRate: decimal('overage_rate', { precision: 10, scale: 2 }).notNull(),
    totalOverageCost: decimal('total_overage_cost', { precision: 10, scale: 2 }).notNull(),
    billed: boolean('billed').default(false),
    billedAt: timestamp('billed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('hour_overages_user_id_idx').on(table.userId),
    projectIdIdx: index('hour_overages_project_id_idx').on(table.projectId),
  }),
);

// Sales Activities
export const salesActivities = pgTable(
  'sales_activities',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    leadId: varchar('lead_id'),
    activityType: varchar('activity_type', { length: 100 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description'),
    outcome: varchar('outcome', { length: 100 }),
    scheduledDate: timestamp('scheduled_date'),
    completedDate: timestamp('completed_date'),
    duration: integer('duration'), // minutes
    nextAction: text('next_action'),
    nextActionDate: timestamp('next_action_date'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sales_activities_user_id_idx').on(table.userId),
    leadIdIdx: index('sales_activities_lead_id_idx').on(table.leadId),
    activityTypeIdx: index('sales_activities_activity_type_idx').on(table.activityType),
  }),
);

// Sales Analytics
export const salesAnalytics = pgTable(
  'sales_analytics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    period: varchar('period', { length: 20 }).notNull(), // daily, weekly, monthly, yearly
    periodDate: date('period_date').notNull(),
    leadsGenerated: integer('leads_generated').default(0),
    quotesSent: integer('quotes_sent').default(0),
    quotesAccepted: integer('quotes_accepted').default(0),
    revenue: decimal('revenue', { precision: 15, scale: 2 }).default(0),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
    averageDealSize: decimal('average_deal_size', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sales_analytics_user_id_idx').on(table.userId),
    periodIdx: index('sales_analytics_period_idx').on(table.period),
  }),
);

// Sales Conversations
export const salesConversations = pgTable(
  'sales_conversations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    leadId: varchar('lead_id'),
    conversationType: varchar('conversation_type', { length: 50 }).notNull(),
    channel: varchar('channel', { length: 50 }).notNull(),
    subject: varchar('subject', { length: 255 }),
    summary: text('summary'),
    outcome: varchar('outcome', { length: 100 }),
    duration: integer('duration'), // minutes
    participants: jsonb('participants'),
    startedAt: timestamp('started_at').defaultNow(),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sales_conversations_user_id_idx').on(table.userId),
    leadIdIdx: index('sales_conversations_lead_id_idx').on(table.leadId),
  }),
);

// Sales Leads
export const salesLeads = pgTable(
  'sales_leads',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    source: varchar('source', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('new'),
    priority: varchar('priority', { length: 20 }).default('medium'),
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    company: varchar('company', { length: 255 }),
    estimatedValue: decimal('estimated_value', { precision: 10, scale: 2 }),
    probability: integer('probability'), // percentage
    expectedCloseDate: date('expected_close_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('sales_leads_user_id_idx').on(table.userId),
    statusIdx: index('sales_leads_status_idx').on(table.status),
    sourceIdx: index('sales_leads_source_idx').on(table.source),
  }),
);

// Business Profiles
export const businessProfiles = pgTable(
  'business_profiles',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull().unique(),
    businessName: varchar('business_name', { length: 255 }).notNull(),
    businessType: varchar('business_type', { length: 100 }),
    organizationNumber: varchar('organization_number', { length: 20 }),
    vatNumber: varchar('vat_number', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    postalCode: varchar('postal_code', { length: 10 }),
    country: varchar('country', { length: 100 }).default('Norway'),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    website: varchar('website', { length: 255 }),
    description: text('description'),
    logo: varchar('logo'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('business_profiles_user_id_idx').on(table.userId),
    organizationNumberIdx: index('business_profiles_organization_number_idx').on(
      table.organizationNumber,
    ),
  }),
);

// Competitor Analysis
export const competitorAnalysis = pgTable(
  'competitor_analysis',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    competitorName: varchar('competitor_name', { length: 255 }).notNull(),
    website: varchar('website', { length: 255 }),
    services: jsonb('services'),
    pricing: jsonb('pricing'),
    strengths: text('strengths'),
    weaknesses: text('weaknesses'),
    marketPosition: varchar('market_position', { length: 100 }),
    notes: text('notes'),
    lastAnalyzed: timestamp('last_analyzed').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('competitor_analysis_user_id_idx').on(table.userId),
    competitorNameIdx: index('competitor_analysis_competitor_name_idx').on(table.competitorName),
  }),
);

// Referral Program
export const referralProgram = pgTable(
  'referral_program',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    referrerId: varchar('referrer_id').notNull(),
    referredId: varchar('referred_id').notNull(),
    referralCode: varchar('referral_code', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    rewardAmount: decimal('reward_amount', { precision: 10, scale: 2 }),
    rewardType: varchar('reward_type', { length: 50 }),
    earnedAt: timestamp('earned_at'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    referrerIdIdx: index('referral_program_referrer_id_idx').on(table.referrerId),
    referredIdIdx: index('referral_program_referred_id_idx').on(table.referredId),
    referralCodeIdx: index('referral_program_referral_code_idx').on(table.referralCode),
  }),
);

// Custom Packages
export const customPackages = pgTable(
  'custom_packages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    services: jsonb('services').notNull(),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    additionalServices: jsonb('additional_services'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('custom_packages_user_id_idx').on(table.userId),
    nameIdx: index('custom_packages_name_idx').on(table.name),
  }),
);

// Standard Packages
export const standardPackages = pgTable(
  'standard_packages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    profession: varchar('profession', { length: 100 }).notNull(),
    services: jsonb('services').notNull(),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).notNull(),
    duration: integer('duration'), // hours
    isPopular: boolean('is_popular').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionIdx: index('standard_packages_profession_idx').on(table.profession),
    nameIdx: index('standard_packages_name_idx').on(table.name),
  }),
);

// Service Activations
export const serviceActivations = pgTable(
  'service_activations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    serviceId: varchar('service_id').notNull(),
    serviceType: varchar('service_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('active'),
    activatedAt: timestamp('activated_at').defaultNow(),
    deactivatedAt: timestamp('deactivated_at'),
    configuration: jsonb('configuration'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('service_activations_user_id_idx').on(table.userId),
    serviceIdIdx: index('service_activations_service_id_idx').on(table.serviceId),
  }),
);

// Travel Expenses
export const travelExpenses = pgTable(
  'travel_expenses',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    travelType: varchar('travel_type', { length: 50 }).notNull(),
    destination: varchar('destination', { length: 255 }).notNull(),
    departureDate: date('departure_date').notNull(),
    returnDate: date('return_date'),
    distance: integer('distance'), // km
    cost: decimal('cost', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    receiptUrl: varchar('receipt_url'),
    notes: text('notes'),
    isReimbursable: boolean('is_reimbursable').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('travel_expenses_user_id_idx').on(table.userId),
    projectIdIdx: index('travel_expenses_project_id_idx').on(table.projectId),
  }),
);

// Travel Log
export const travelLog = pgTable(
  'travel_log',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    startLocation: varchar('start_location', { length: 255 }).notNull(),
    endLocation: varchar('end_location', { length: 255 }).notNull(),
    distance: integer('distance').notNull(),
    duration: integer('duration'), // minutes
    travelDate: date('travel_date').notNull(),
    purpose: text('purpose'),
    cost: decimal('cost', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('travel_log_user_id_idx').on(table.userId),
    projectIdIdx: index('travel_log_project_id_idx').on(table.projectId),
  }),
);

// Additional Costs
export const additionalCosts = pgTable(
  'additional_costs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    costType: varchar('cost_type', { length: 100 }).notNull(),
    description: text('description').notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    costDate: date('cost_date').notNull(),
    isBillable: boolean('is_billable').default(true),
    isReimbursable: boolean('is_reimbursable').default(false),
    receiptUrl: varchar('receipt_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('additional_costs_user_id_idx').on(table.userId),
    projectIdIdx: index('additional_costs_project_id_idx').on(table.projectId),
    costTypeIdx: index('additional_costs_cost_type_idx').on(table.costType),
  }),
);

// ============================================================================
// RELATIONS FOR CORE BUSINESS OPERATIONS TABLES
// ============================================================================

export const quotesRelations = relations(quotes, ({ one }) => ({
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  createdByUser: one(users, {
    fields: [quotes.createdBy],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  project: one(projects, {
    fields: [payments.projectId],
    references: [projects.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [expenses.projectId],
    references: [projects.id],
  }),
}));

export const taxCalculationsRelations = relations(taxCalculations, ({ one }) => ({
  user: one(users, {
    fields: [taxCalculations.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [taxCalculations.projectId],
    references: [projects.id],
  }),
}));

export const pricingStructuresRelations = relations(pricingStructures, ({ one }) => ({
  user: one(users, {
    fields: [pricingStructures.userId],
    references: [users.id],
  }),
}));

export const priceFeaturesRelations = relations(priceFeatures, ({ one }) => ({
  tier: one(priceTiers, {
    fields: [priceFeatures.tierId],
    references: [priceTiers.id],
  }),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  createdByUser: one(users, {
    fields: [discounts.createdBy],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  tier: one(priceTiers, {
    fields: [subscriptions.tierId],
    references: [priceTiers.id],
  }),
}));

export const subscriptionChangeHistoryRelations = relations(
  subscriptionChangeHistory,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionChangeHistory.subscriptionId],
      references: [subscriptions.id],
    }),
    changedByUser: one(users, {
      fields: [subscriptionChangeHistory.changedBy],
      references: [users.id],
    }),
  }),
);

export const hourOveragesRelations = relations(hourOverages, ({ one }) => ({
  user: one(users, {
    fields: [hourOverages.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [hourOverages.projectId],
    references: [projects.id],
  }),
}));

export const salesActivitiesRelations = relations(salesActivities, ({ one }) => ({
  user: one(users, {
    fields: [salesActivities.userId],
    references: [users.id],
  }),
  lead: one(salesLeads, {
    fields: [salesActivities.leadId],
    references: [salesLeads.id],
  }),
}));

export const salesAnalyticsRelations = relations(salesAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [salesAnalytics.userId],
    references: [users.id],
  }),
}));

export const salesConversationsRelations = relations(salesConversations, ({ one }) => ({
  user: one(users, {
    fields: [salesConversations.userId],
    references: [users.id],
  }),
  lead: one(salesLeads, {
    fields: [salesConversations.leadId],
    references: [salesLeads.id],
  }),
}));

export const salesLeadsRelations = relations(salesLeads, ({ one }) => ({
  user: one(users, {
    fields: [salesLeads.userId],
    references: [users.id],
  }),
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  user: one(users, {
    fields: [businessProfiles.userId],
    references: [users.id],
  }),
}));

export const competitorAnalysisRelations = relations(competitorAnalysis, ({ one }) => ({
  user: one(users, {
    fields: [competitorAnalysis.userId],
    references: [users.id],
  }),
}));

export const referralProgramRelations = relations(referralProgram, ({ one }) => ({
  referrer: one(users, {
    fields: [referralProgram.referrerId],
    references: [users.id],
  }),
  referred: one(users, {
    fields: [referralProgram.referredId],
    references: [users.id],
  }),
}));

export const customPackagesRelations = relations(customPackages, ({ one }) => ({
  user: one(users, {
    fields: [customPackages.userId],
    references: [users.id],
  }),
}));

export const serviceActivationsRelations = relations(serviceActivations, ({ one }) => ({
  user: one(users, {
    fields: [serviceActivations.userId],
    references: [users.id],
  }),
}));

export const travelExpensesRelations = relations(travelExpenses, ({ one }) => ({
  user: one(users, {
    fields: [travelExpenses.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [travelExpenses.projectId],
    references: [projects.id],
  }),
}));

export const travelLogRelations = relations(travelLog, ({ one }) => ({
  user: one(users, {
    fields: [travelLog.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [travelLog.projectId],
    references: [projects.id],
  }),
}));

export const additionalCostsRelations = relations(additionalCosts, ({ one }) => ({
  user: one(users, {
    fields: [additionalCosts.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [additionalCosts.projectId],
    references: [projects.id],
  }),
}));

// User Permissions
export const userPermissions = pgTable(
  'user_permissions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    permission: varchar('permission', { length: 255 }).notNull(),
    resource: varchar('resource', { length: 255 }),
    resourceId: varchar('resource_id'),
    grantedBy: varchar('granted_by').notNull(),
    grantedAt: timestamp('granted_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_permissions_user_id_idx').on(table.userId),
    permissionIdx: index('user_permissions_permission_idx').on(table.permission),
  }),
);

// User Preferences
export const userPreferences = pgTable(
  'user_preferences',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull().unique(),
    preferences: jsonb('preferences').notNull(),
    theme: varchar('theme', { length: 50 }).default('light'),
    language: varchar('language', { length: 10 }).default('no'),
    timezone: varchar('timezone', { length: 50 }).default('Europe/Oslo'),
    notifications: jsonb('notifications'),
    dashboard: jsonb('dashboard'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_preferences_user_id_idx').on(table.userId),
  }),
);

// User Activity Logs
export const userActivityLogs = pgTable(
  'user_activity_logs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    action: varchar('action', { length: 255 }).notNull(),
    resource: varchar('resource', { length: 255 }),
    resourceId: varchar('resource_id'),
    details: jsonb('details'),
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    sessionId: varchar('session_id'),
    timestamp: timestamp('timestamp').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_activity_logs_user_id_idx').on(table.userId),
    timestampIdx: index('user_activity_logs_timestamp_idx').on(table.timestamp),
  }),
);

// User Consents
export const userConsents = pgTable(
  'user_consents',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    consentType: varchar('consent_type', { length: 100 }).notNull(),
    granted: boolean('granted').default(false),
    grantedAt: timestamp('granted_at'),
    revokedAt: timestamp('revoked_at'),
    version: varchar('version', { length: 50 }),
    legalBasis: varchar('legal_basis', { length: 100 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_consents_user_id_idx').on(table.userId),
    consentTypeIdx: index('user_consents_consent_type_idx').on(table.consentType),
  }),
);

// User Files
export const userFiles = pgTable(
  'user_files',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    filePath: text('file_path').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    category: varchar('category', { length: 100 }),
    isPublic: boolean('is_public').default(false),
    uploadedAt: timestamp('uploaded_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_files_user_id_idx').on(table.userId),
    categoryIdx: index('user_files_category_idx').on(table.category),
  }),
);

// User Equipment
export const userEquipment = pgTable(
  'user_equipment',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    equipmentId: varchar('equipment_id').notNull(),
    purchasedAt: timestamp('purchased_at'),
    warrantyExpires: timestamp('warranty_expires'),
    condition: varchar('condition', { length: 50 }),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_equipment_user_id_idx').on(table.userId),
    equipmentIdIdx: index('user_equipment_equipment_id_idx').on(table.equipmentId),
  }),
);

// User Subscriptions
export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    planId: varchar('plan_id').notNull(),
    status: varchar('status', { length: 50 }).default('active'),
    startDate: timestamp('start_date').defaultNow(),
    endDate: timestamp('end_date'),
    autoRenew: boolean('auto_renew').default(true),
    paymentMethod: varchar('payment_method', { length: 100 }),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_subscriptions_user_id_idx').on(table.userId),
    planIdIdx: index('user_subscriptions_plan_id_idx').on(table.planId),
  }),
);

// Custom Roles
export const customRoles = pgTable(
  'custom_roles',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    permissions: jsonb('permissions'),
    isActive: boolean('is_active').default(true),
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('custom_roles_name_idx').on(table.name),
  }),
);

// Custom Profiles
export const customProfiles = pgTable(
  'custom_profiles',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    profileType: varchar('profile_type', { length: 100 }).notNull(),
    profileData: jsonb('profile_data').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('custom_profiles_user_id_idx').on(table.userId),
    profileTypeIdx: index('custom_profiles_profile_type_idx').on(table.profileType),
  }),
);

// Onboarding Profiles
export const onboardingProfiles = pgTable(
  'onboarding_profiles',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    step: varchar('step', { length: 100 }).notNull(),
    completed: boolean('completed').default(false),
    data: jsonb('data'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('onboarding_profiles_user_id_idx').on(table.userId),
    stepIdx: index('onboarding_profiles_step_idx').on(table.step),
  }),
);

// Session Activity Log
export const sessionActivityLog = pgTable(
  'session_activity_log',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    sessionId: varchar('session_id').notNull(),
    action: varchar('action', { length: 255 }).notNull(),
    resource: varchar('resource', { length: 255 }),
    details: jsonb('details'),
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),
    timestamp: timestamp('timestamp').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('session_activity_log_user_id_idx').on(table.userId),
    sessionIdIdx: index('session_activity_log_session_id_idx').on(table.sessionId),
  }),
);

// User Provisioning Requests
export const userProvisioningRequests = pgTable(
  'user_provisioning_requests',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    requestType: varchar('request_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    requestedBy: varchar('requested_by').notNull(),
    approvedBy: varchar('approved_by'),
    approvedAt: timestamp('approved_at'),
    data: jsonb('data'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_provisioning_requests_user_id_idx').on(table.userId),
    statusIdx: index('user_provisioning_requests_status_idx').on(table.status),
  }),
);

// User Provisioning Status
export const userProvisioningStatus = pgTable(
  'user_provisioning_status',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    service: varchar('service', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    provisionedAt: timestamp('provisioned_at'),
    deprovisionedAt: timestamp('deprovisioned_at'),
    lastChecked: timestamp('last_checked'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_provisioning_status_user_id_idx').on(table.userId),
    serviceIdx: index('user_provisioning_status_service_idx').on(table.service),
  }),
);
