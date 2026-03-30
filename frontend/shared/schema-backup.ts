// @ts-nocheck
/**
 * CreatorHub Norge - Comprehensive Schema with Fotoleveranse System
 * Professional photo delivery with external photographer collaboration
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
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Export onboarding schema (temporarily disabled due to conflicts)
// export * from './onboarding-schema';

// Export smart timing schema (temporarily disabled due to conflicts)
// export * from './smart-timing-schema';

// Export GDPR compliance schema (temporarily disabled due to conflicts)
// export * from './gdpr-schema';

// Export family tree schema (temporarily disabled due to conflicts)
// export * from './family-tree-schema';

// Export comprehensive database persistence schema
export * from './database-persistence-schema';

// Import core tables for local references
import {
  users,
  projects,
  invoices,
  businessMetrics,
  emailCampaigns,
} from './database-persistence-schema';

// Export memory card backup schema - Moved to database-persistence-schema.ts
// export {
//   memoryCardSessions,
//   backupTips,
//   backupLogs,
//   memoryCardSessionsRelations,
//   backupLogsRelations,
//   insertMemoryCardSessionSchema,
//   insertBackupTipSchema,
//   insertBackupLogSchema
// } from './memory-card-schema';

// Export equipment management schema
// export * from './equipment-schema'; // Moved to database-persistence-schema.ts
// export * from './tutorial-schema';

// Export keyboard shortcuts schema
export * from './keyboard-shortcuts-schema';

// Export photographer client gallery schema
export * from './photographer-client-schema';

// Export photography tips schema
export * from './photography-tips-schema';

// Export universal communication schema
// export * from './communication-schema'; // Moved to database-persistence-schema.ts

// Export plugin management schema
export * from './plugin-schema';
export * from './vendor-showcase-schema';

// Export project integration schema
export * from './project-integration-schema';

// Export sales management schema (temporarily disabled due to conflicts)
// export * from './sales-schema';

// Export pricing system schema
export * from './pricing-schema';

// Export admin system schema
export * from './admin-schema';

// Export trial management schema
export * from './trial-management-schema';

// Export Google Pay integration schema
// export * from './google-pay-schema'; // Removed - tables now in database-persistence-schema.ts
export * from './google-wallet-schema';

// Export comprehensive showcase admin schema
export * from './showcase-admin-schema';

// Export customer journey builder schema
export * from './customer-journey-schema';

// Export Google Chat integration schema
export * from './google-chat-schema';

// Export business profiles schema
export * from './business-profiles-schema';

// Export profession CMS schema
export * from './profession-cms-schema';

// Export advanced protocols schema
export * from './advanced-protocols-schema';

// Export new comprehensive schemas
export * from './creatorhub-visual-editor-schema';
export * from './wedding-timeline-schema';
export * from './learning-academy-schema';
export * from './content-management-schema';
export * from './pricing-system-schema';
export * from './additional-features-schema';

// Export remaining 73 tables schemas
export * from './advanced-system-features-schema';
export * from './plugin-management-schema';
export * from './cms-advanced-features-schema';
export * from './integration-services-schema';
export * from './analytics-reporting-schema';

// ✅ OMFATTENDE PROTOKOLLSTYRING: System Events Tracking
export const systemEvents = pgTable('system_events', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  severity: varchar('severity', { length: 50 }).notNull(), // critical, high, medium, low, info
  category: varchar('category', { length: 50 }).notNull(), // database, api, security, performance, integration, user_action, system
  source: varchar('source', { length: 255 }).notNull(), // component that generated the event
  message: text('message').notNull(),
  details: jsonb('details'), // technical details, error objects, etc
  resolved: boolean('resolved').default(false).notNull(),
  alerts_sent: jsonb('alerts_sent').default('[]').notNull(), // array of alert channels used
  metadata: jsonb('metadata'), // additional context, automation flags, etc
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type SystemEvent = typeof systemEvents.$inferSelect;
export type InsertSystemEvent = typeof systemEvents.$inferInsert;

// Export CMS history and versioning schema
export * from './cms-history-schema';

// ✅ API Integration Process Monitor Types and Schemas will be defined after table definitions

// ✅ CreatorHub Notater - Comprehensive Notes Management
export const notes = pgTable('notes', {
  id: varchar('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  category: varchar('category').notNull().default('personlig'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  isShared: boolean('is_shared').notNull().default(false),
  googleDocsId: varchar('google_docs_id'),
  userId: varchar('user_id'),
  profession: varchar('profession').default('photographer'),
  aiInsights: jsonb('ai_insights').$type<{
    summary?: string;
    keywords?: string[];
    sentiment?: string;
    actionItems?: string[];
  }>(),
  searchVector: text('search_vector'), // For full-text search
});

// ✅ AI-Enhanced Code Generation Results (fra creator bot)
export const codeGenerations = pgTable('code_generations', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id'),
  componentType: varchar('component_type'),
  generatedCode: text('generated_code'),
  intelligenceLevel: varchar('intelligence_level').default('advanced'),
  profession: varchar('profession').default('photographer'),
  googleDocsId: varchar('google_docs_id'),
  requirements: text('requirements'),
  framework: varchar('framework').default('react'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ Smart Template Library (fra creator bot)
export const smartTemplates = pgTable('smart_templates', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  profession: varchar('profession').notNull(),
  category: varchar('category').notNull(),
  templateCode: text('template_code').notNull(),
  aiEnhancements: jsonb('ai_enhancements').$type<{
    intelligence_level?: string;
    auto_adaptations?: string[];
    suggested_improvements?: string[];
  }>(),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ Insert schemas for notes system
export const insertNoteSchema = createInsertSchema(notes).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCodeGenerationSchema = createInsertSchema(codeGenerations).omit({
  createdAt: true,
});

export const insertSmartTemplateSchema = createInsertSchema(smartTemplates).omit({
  createdAt: true,
});

// Types
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type CodeGeneration = typeof codeGenerations.$inferSelect;
export type InsertCodeGeneration = z.infer<typeof insertCodeGenerationSchema>;
export type SmartTemplate = typeof smartTemplates.$inferSelect;
export type InsertSmartTemplate = z.infer<typeof insertSmartTemplateSchema>;

// API Keys Management - For storing user-created API keys
export const apiKeys = pgTable('api_keys', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  service: varchar('service', { length: 100 }).notNull(), // openai, stripe, vipps, etc.
  keyType: varchar('key_type', { length: 50 }).notNull(), // api_key, oauth_client, webhook_secret
  maskedKey: varchar('masked_key', { length: 255 }).notNull(), // Masked version for display
  encryptedKey: text('encrypted_key'), // Encrypted actual key (optional for display-only)
  status: varchar('status', { length: 20 }).default('active').notNull(), // active, inactive, expired
  permissions: jsonb('permissions').$type<string[]>().default([]),
  monthlyQuota: integer('monthly_quota').default(0),
  usageCount: integer('usage_count').default(0),
  lastUsed: timestamp('last_used'),
  rotationDue: timestamp('rotation_due'),
  createdBy: varchar('created_by', { length: 255 }).notNull(), // admin email
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const apiKeyInsertSchema = createInsertSchema(apiKeys);
export const apiKeySelectSchema = createInsertSchema(apiKeys);
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// PROTOTYPE FEEDBACK SYSTEM - Real database table for prototype testing feedback
export const prototypeFeedback = pgTable(
  'prototype_feedback',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id', { length: 255 }).notNull(),
    userEmail: varchar('user_email', { length: 255 }),
    userName: varchar('user_name', { length: 255 }),
    profession: varchar('profession', { length: 50 }).notNull(), // photographer, videographer, etc.
    dashboardType: varchar('dashboard_type', { length: 50 }).notNull(), // universal, specific
    feedbackType: varchar('feedback_type', { length: 20 }).notNull(), // bug, feature, usability, ui_ux, general
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    rating: integer('rating').default(5).notNull(), // 1-5 star rating
    priority: varchar('priority', { length: 20 }).default('medium').notNull(), // low, medium, high, critical
    component: varchar('component', { length: 255 }), // Which component/page the feedback is about
    tags: jsonb('tags').$type<string[]>().default([]), // Array of tags
    screenshotUrl: text('screenshot_url'), // URL to uploaded screenshot in object storage
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    status: varchar('status', { length: 20 }).default('open').notNull(), // open, in_progress, resolved, closed
    adminNotes: text('admin_notes'), // Internal admin notes
    adminUpdatedBy: varchar('admin_updated_by', { length: 255 }), // Which admin handled this
    resolvedAt: timestamp('resolved_at'),
    // ✅ NY: Enhanced location tracking
    locationContext: jsonb('location_context').$type<{
      profession: string;
      dashboardType: string;
      currentTab: string;
      currentSection: string;
      specificFeature?: string;
      pageUrl: string;
      userAgent: string;
      timestamp: string;
    }>(), // Enhanced location context for better feedback tracking
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('prototype_feedback_user_id_idx').on(table.userId),
    statusIdx: index('prototype_feedback_status_idx').on(table.status),
    priorityIdx: index('prototype_feedback_priority_idx').on(table.priority),
    createdAtIdx: index('prototype_feedback_created_at_idx').on(table.createdAt),
  }),
);

export const prototypeFeedbackInsertSchema = createInsertSchema(prototypeFeedback);
export const prototypeFeedbackSelectSchema = createInsertSchema(prototypeFeedback);
export type PrototypeFeedback = typeof prototypeFeedback.$inferSelect;
export type InsertPrototypeFeedback = typeof prototypeFeedback.$inferInsert;

// PROFESSION TYPES SYSTEM - Dynamic profession management
export const professionTypes = pgTable('profession_types', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 50 }).notNull().unique(), // Internal key: 'photographer'
  displayName: varchar('display_name', { length: 100 }).notNull(), // User-facing: 'Fotograf'
  description: text('description'), // Optional description
  iconColor: varchar('icon_color', { length: 7 }).default('#ff8c00'), // Hex color
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0), // For ordering in UI
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const professionTypeInsertSchema = createInsertSchema(professionTypes);
export const professionTypeSelectSchema = createInsertSchema(professionTypes);
export type ProfessionType = typeof professionTypes.$inferSelect;
export type InsertProfessionType = typeof professionTypes.$inferInsert;

// Export visual CMS schema
export * from './visual-cms-schema';

// Export price administration schema
export * from './price-administration-schema';

// Export Story Arc Studio schema
export * from './story-arc-schema';

// Export Code Generator schema
export * from './code-generator-schema';

// Export text enhancement and Smart Notes schema
export * from './text-enhancement-schema';

// Project Presets - Gjenbrukbare malverk for prosjektoppsett
export const projectPresets = pgTable('project_presets', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  projectType: varchar('project_type').notNull(), // bryllup, portrett, etc.
  culture: varchar('culture').default('norsk'), // For wedding projects
  isDefault: boolean('is_default').default(false),
  userId: varchar('user_id').notNull(), // Owner of preset
  config: jsonb('config')
    .$type<{
      // Memory card configuration
      memoryCardLabeling: string;
      selectedMemoryCards: Array<{
        type: string;
        capacity: string;
        brand?: string;
        model?: string;
      }>;

      // Project structure
      totalDays: number;
      activeDays: number[];
      customDayNames?: string[];
      customCategories: string[];

      // Pricing setup
      selectedPackage?: any;
      perImagePrice?: number;
      contractedImages?: number;

      // Equipment preferences
      primaryCamera?: string;
      backupCamera?: string;
      selectedCameras?: any[];
      editingSoftware?: string;

      // Default settings
      driveIntegration: boolean;
      createShowcaseGallery: boolean;
      showcaseGallerySecurity?: any;

      // Project metadata
      estimatedDuration?: string;
      dailyHours?: Record<number, number>;
    }>()
    .notNull(),
  usage: jsonb('usage')
    .$type<{
      timesUsed: number;
      lastUsed?: string;
      averageRating?: number;
    }>()
    .default({ timesUsed: 0 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Preset Usage Tracking
export const presetUsageHistory = pgTable('preset_usage_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  presetId: varchar('preset_id')
    .notNull()
    .references(() => projectPresets.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull(),
  projectId: varchar('project_id'), // If created project
  rating: integer('rating'), // 1-5 stars
  feedback: text('feedback'),
  modifications: jsonb('modifications'), // What user changed from preset
  createdAt: timestamp('created_at').defaultNow(),
});

// Smart Preset Suggestions - Foreslår presets basert på lignende tidligere prosjekter
export const presetSuggestions = pgTable('preset_suggestions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  projectType: varchar('project_type').notNull(),
  culture: varchar('culture'), // For cultural matching (pakistansk, norsk, etc.)
  suggestedPresetId: varchar('suggested_preset_id').references(() => projectPresets.id, {
    onDelete: 'cascade',
  }),
  basedOnProjectIds: jsonb('based_on_project_ids').$type<string[]>(), // Previous similar projects
  confidence: integer('confidence').notNull(), // 1-100% match confidence
  reasons: jsonb('reasons').$type<{
    culturalMatch: boolean;
    projectTypeMatch: boolean;
    equipmentMatch: boolean;
    timingMatch: boolean;
    clientMatch: boolean;
  }>(),
  timesShown: integer('times_shown').default(0),
  timesAccepted: integer('times_accepted').default(0),
  lastShown: timestamp('last_shown'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Similarity Analysis - Lagrer lignende prosjekt-analyser for bedre forslag
export const projectSimilarityAnalysis = pgTable('project_similarity_analysis', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  projectId1: varchar('project_id_1').notNull(),
  projectId2: varchar('project_id_2').notNull(),
  similarityScore: integer('similarity_score').notNull(), // 0-100%
  matchingFactors: jsonb('matching_factors').$type<{
    culture: number;
    projectType: number;
    duration: number;
    equipment: number;
    pricing: number;
    timing: number;
  }>(),
  recommendation: varchar('recommendation').$type<
    'use_same_setup' | 'modify_slightly' | 'different_approach'
  >(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Draft Autosave - Automatisk lagring av prosjekt-utkast hvert 10. sekund
export const projectDraftAutosave = pgTable('project_draft_autosave', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  sessionId: varchar('session_id').notNull(), // Browser session ID
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  draftData: jsonb('draft_data')
    .$type<{
      // Basic project info
      projectName?: string;
      projectType?: string;
      clientName?: string;
      culture?: string;
      location?: string;

      // Dates and timing
      projectDate?: string;
      estimatedDuration?: string;
      totalDays?: number;
      activeDays?: number[];
      dailyHours?: Record<number, number>;

      // Equipment and setup
      memoryCardLabeling?: string;
      selectedMemoryCards?: Array<{
        type: string;
        capacity: string;
        brand?: string;
        model?: string;
      }>;
      selectedCameras?: any[];
      editingSoftware?: string;

      // Pricing
      selectedPackage?: any;
      perImagePrice?: number;
      contractedImages?: number;
      totalPrice?: number;

      // Google Drive integration
      driveIntegration?: boolean;
      createShowcaseGallery?: boolean;
      showcaseGallerySecurity?: any;

      // Custom categories and settings
      customCategories?: string[];
      customDayNames?: string[];

      // Step completion tracking
      completedSteps?: string[];
      currentStep?: number;
    }>()
    .notNull(),
  isCompleted: boolean('is_completed').default(false),
  projectId: varchar('project_id'), // If converted to actual project
  lastModified: timestamp('last_modified').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Project Draft Version History - Versjonshistorikk for utkast
export const projectDraftVersions = pgTable('project_draft_versions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  draftId: varchar('draft_id')
    .notNull()
    .references(() => projectDraftAutosave.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  versionName: varchar('version_name'), // "Automatisk lagring", "Før pricing", etc.
  snapshotData: jsonb('snapshot_data').notNull(),
  changeDescription: text('change_description'),
  canRestore: boolean('can_restore').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lead Import Templates - For importering fra kundeforespørsler
export const leadImportTemplates = pgTable('lead_import_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  leadId: varchar('lead_id').notNull(), // Reference til sales_leads
  leadTitle: varchar('lead_title').notNull(),
  leadSource: varchar('lead_source'), // website, email, phone, etc.
  extractedData: jsonb('extracted_data')
    .$type<{
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      projectType: string;
      culture?: string;
      location?: string;
      preferredDate?: string;
      estimatedBudget?: number;
      guestCount?: number;
      duration?: string;
      specialRequests?: string;
      packageInterest?: string;
    }>()
    .notNull(),
  importCount: integer('import_count').default(0),
  lastImported: timestamp('last_imported'),
  isAvailable: boolean('is_available').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Video Suite Change Log - Tracking all video editing changes
export const videoEditChangelog = pgTable('video_edit_changelog', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  changeType: varchar('change_type')
    .$type<
      | 'sequence_edit'
      | 'color_grade'
      | 'audio_mix'
      | 'render_export'
      | 'multicam_sync'
      | 'proxy_generation'
      | 'chapter_marker'
      | 'version_create'
      | 'comment_add'
      | 'review_round'
    >()
    .notNull(),
  description: text('description').notNull(),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  timecode: varchar('timecode'), // For frame-accurate tracking
  version: varchar('version'), // V1, V2, Final, etc.
  round: varchar('round'), // R1, R2, R3 for review rounds
  metadata: jsonb('metadata').$type<{
    filename?: string;
    duration?: number;
    format?: string;
    resolution?: string;
    frameRate?: number;
    codec?: string;
    fileSize?: number;
    renderSettings?: any;
    exportSettings?: any;
  }>(),
  canRevert: boolean('can_revert').default(true),
  backupPath: varchar('backup_path'), // Path to backup file for restoration
  createdAt: timestamp('created_at').defaultNow(),
});

// Photo Enhancement Change Log - Tracking all photo editing changes
export const photoEnhancementChangelog = pgTable('photo_enhancement_changelog', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  imageId: varchar('image_id').notNull(),
  changeType: varchar('change_type')
    .$type<
      | 'enhancement'
      | 'preset_apply'
      | 'manual_edit'
      | 'color_correction'
      | 'noise_reduction'
      | 'sharpening'
      | 'crop'
      | 'resize'
      | 'filter_apply'
      | 'batch_process'
      | 'restore_original'
    >()
    .notNull(),
  description: text('description').notNull(),
  presetUsed: varchar('preset_used'), // auto, portrait, wedding, landscape, etc.
  beforeState: jsonb('before_state').$type<{
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sharpening?: number;
    noiseReduction?: boolean;
    autoTone?: boolean;
    customSettings?: any;
  }>(),
  afterState: jsonb('after_state').$type<{
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sharpening?: number;
    noiseReduction?: boolean;
    autoTone?: boolean;
    customSettings?: any;
  }>(),
  originalImagePath: varchar('original_image_path').notNull(),
  enhancedImagePath: varchar('enhanced_image_path'),
  backupImagePath: varchar('backup_image_path'), // For restoration
  metadata: jsonb('metadata').$type<{
    originalSize?: number;
    enhancedSize?: number;
    dimensions?: { width: number; height: number };
    format?: string;
    quality?: number;
    processingTime?: number;
  }>(),
  canRevert: boolean('can_revert').default(true),
  processingTime: integer('processing_time'), // in milliseconds
  createdAt: timestamp('created_at').defaultNow(),
});

// Version History for both Video and Photo projects
export const projectVersionHistory = pgTable('project_version_history', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  projectType: varchar('project_type').$type<'video' | 'photo'>().notNull(),
  versionName: varchar('version_name').notNull(), // V1, V2, Final, Draft, etc.
  description: text('description'),
  snapshotData: jsonb('snapshot_data'), // Complete project state snapshot
  fileManifest: jsonb('file_manifest').$type<{
    originalFiles: string[];
    processedFiles: string[];
    backupFiles: string[];
    exportedFiles: string[];
  }>(),
  isActive: boolean('is_active').default(false),
  canRestoreTo: boolean('can_restore_to').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Backup and Restoration Jobs
export const backupRestoreJobs = pgTable('backup_restore_jobs', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  jobType: varchar('job_type')
    .$type<'backup_create' | 'restore_version' | 'restore_change' | 'emergency_restore'>()
    .notNull(),
  status: varchar('status')
    .$type<'pending' | 'in_progress' | 'completed' | 'failed'>()
    .default('pending'),
  sourceVersionId: varchar('source_version_id'),
  targetVersionId: varchar('target_version_id'),
  changelogId: varchar('changelog_id'), // If restoring specific change
  progress: integer('progress').default(0),
  errorMessage: text('error_message'),
  backupPaths: jsonb('backup_paths').$type<string[]>(),
  restoredPaths: jsonb('restored_paths').$type<string[]>(),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Meeting Workspaces - Professional collaboration spaces
export const meetingWorkspaces = pgTable('meeting_workspaces', {
  id: varchar('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  projectType: varchar('project_type')
    .$type<'photography' | 'videography' | 'music_production' | 'business'>()
    .notNull(),
  status: varchar('status')
    .$type<'scheduled' | 'active' | 'completed' | 'cancelled'>()
    .default('scheduled'),
  googleDriveId: varchar('google_drive_id'),
  googleMeetUrl: varchar('google_meet_url'),
  googleCalendarEventId: varchar('google_calendar_event_id'),
  features: jsonb('features')
    .$type<{
      whiteboard: boolean;
      moodboard: boolean;
      timeline: boolean;
      recording: boolean;
      liveStreaming: boolean;
    }>()
    .notNull(),
  progress: integer('progress').default(0),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Meeting Participants - Users in workspaces
export const meetingParticipants = pgTable('meeting_participants', {
  id: varchar('id').primaryKey(),
  workspaceId: varchar('workspace_id')
    .notNull()
    .references(() => meetingWorkspaces.id, { onDelete: 'cascade' }),
  userEmail: varchar('user_email').notNull(),
  userName: varchar('user_name').notNull(),
  role: varchar('role').$type<'owner' | 'collaborator' | 'viewer'>().notNull(),
  status: varchar('status').$type<'online' | 'offline' | 'away'>().default('offline'),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Meeting Activities - Activity log for workspaces
export const meetingActivities = pgTable('meeting_activities', {
  id: varchar('id').primaryKey(),
  workspaceId: varchar('workspace_id')
    .notNull()
    .references(() => meetingWorkspaces.id, { onDelete: 'cascade' }),
  userEmail: varchar('user_email').notNull(),
  userName: varchar('user_name').notNull(),
  activityType: varchar('activity_type')
    .$type<'whiteboard' | 'moodboard' | 'upload' | 'comment' | 'meeting' | 'timeline'>()
    .notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Meeting Workspace Relations
export const meetingWorkspaceRelations = relations(meetingWorkspaces, ({ many, one }) => ({
  participants: many(meetingParticipants),
  activities: many(meetingActivities),
}));

export const meetingParticipantRelations = relations(meetingParticipants, ({ one }) => ({
  workspace: one(meetingWorkspaces, {
    fields: [meetingParticipants.workspaceId],
    references: [meetingWorkspaces.id],
  }),
}));

export const meetingActivityRelations = relations(meetingActivities, ({ one }) => ({
  workspace: one(meetingWorkspaces, {
    fields: [meetingActivities.workspaceId],
    references: [meetingWorkspaces.id],
  }),
}));

// User Preferences Table - For storing user-specific settings like theme, language, and dashboard layout
export const userPreferences = pgTable('user_preferences', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  sessionId: varchar('session_id').notNull(), // User session identifier
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  theme: varchar('theme'),
  language: varchar('language'),
  notificationsEnabled: boolean('notifications_enabled'),
  dashboardLayout: varchar('dashboard_layout'),
  timezone: varchar('timezone'),
  currency: varchar('currency'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User Preferences Relations
export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({}));

// User Preferences Schemas
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// Client Submissions Table - For incoming client requests to photographers
export const clientSubmissions = pgTable('client_submissions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  email: varchar('email').notNull(),
  phone: varchar('phone'),
  company: varchar('company'),
  projectType: varchar('project_type').notNull(), // wedding, portrait, business, product, etc.
  eventDate: date('event_date'),
  location: varchar('location'),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  description: text('description').notNull(),
  specialRequests: text('special_requests'),
  contactPreference: varchar('contact_preference')
    .$type<'email' | 'phone' | 'both'>()
    .default('email'),
  timeframe: varchar('timeframe'), // urgent, flexible, specific_date
  referralSource: varchar('referral_source'), // google, instagram, referral, repeat_client
  attachments: jsonb('attachments').$type<string[]>(), // Links to attached files
  status: varchar('status')
    .$type<'new' | 'contacted' | 'quote_sent' | 'booked' | 'completed' | 'declined'>()
    .default('new'),
  assignedPhotographer: varchar('assigned_photographer'), // photographer user ID
  priority: varchar('priority').$type<'low' | 'medium' | 'high' | 'urgent'>().default('medium'),
  internalNotes: text('internal_notes'), // Internal photographer notes
  clientNotes: text('client_notes'), // Notes for client communication
  followUpDate: timestamp('follow_up_date'),
  quoteSent: boolean('quote_sent').default(false),
  quoteAmount: decimal('quote_amount', { precision: 10, scale: 2 }),
  contractSent: boolean('contract_sent').default(false),
  depositReceived: boolean('deposit_received').default(false),
  submittedAt: timestamp('submitted_at').defaultNow(),
  lastContactedAt: timestamp('last_contacted_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations defined later with timeline and showcase included

// Follow-up activities for submissions
export const submissionFollowUps = pgTable('submission_follow_ups', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  submissionId: varchar('submission_id')
    .references(() => clientSubmissions.id)
    .notNull(),
  type: varchar('type')
    .$type<'email' | 'phone' | 'meeting' | 'quote' | 'contract' | 'reminder'>()
    .notNull(),
  description: text('description').notNull(),
  scheduledFor: timestamp('scheduled_for'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const submissionFollowUpsRelations = relations(submissionFollowUps, ({ one }) => ({
  submission: one(clientSubmissions, {
    fields: [submissionFollowUps.submissionId],
    references: [clientSubmissions.id],
  }),
}));

// Types for submissions
export type ClientSubmission = typeof clientSubmissions.$inferSelect;
export type InsertClientSubmission = typeof clientSubmissions.$inferInsert;
export type SubmissionFollowUp = typeof submissionFollowUps.$inferSelect;
export type InsertSubmissionFollowUp = typeof submissionFollowUps.$inferInsert;

// Email Project Association Table - For linking emails to projects
export const emailProjectAssociations = pgTable('email_project_associations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => clientSubmissions.id)
    .notNull(),
  emailId: varchar('email_id').notNull(), // Unique identifier for the email
  subject: varchar('subject').notNull(),
  from: varchar('from').notNull(),
  to: varchar('to').notNull(),
  cc: varchar('cc'),
  bcc: varchar('bcc'),
  body: text('body').notNull(),
  attachments: jsonb('attachments').$type<string[]>(),
  templateUsed: varchar('template_used'),
  direction: varchar('direction').$type<'sent' | 'received'>().notNull(),
  status: varchar('status')
    .$type<'draft' | 'sent' | 'delivered' | 'read' | 'failed'>()
    .default('sent'),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer'>()
    .notNull(),
  sentAt: timestamp('sent_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const emailProjectAssociationsRelations = relations(emailProjectAssociations, ({ one }) => ({
  project: one(clientSubmissions, {
    fields: [emailProjectAssociations.projectId],
    references: [clientSubmissions.id],
  }),
}));

export type EmailProjectAssociation = typeof emailProjectAssociations.$inferSelect;
export type InsertEmailProjectAssociation = typeof emailProjectAssociations.$inferInsert;

// Project Timeline Table - For tracking project milestones and events
export const projectTimelines = pgTable('project_timelines', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => clientSubmissions.id)
    .notNull(),
  title: varchar('title').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date').notNull(),
  eventTime: varchar('event_time'), // Optional time specification
  location: varchar('location'),
  type: varchar('type')
    .$type<
      | 'milestone'
      | 'meeting'
      | 'deadline'
      | 'delivery'
      | 'ceremony'
      | 'photo_session'
      | 'editing'
      | 'review'
    >()
    .notNull(),
  status: varchar('status')
    .$type<'planned' | 'in_progress' | 'completed' | 'cancelled'>()
    .default('planned'),
  priority: varchar('priority').$type<'low' | 'medium' | 'high' | 'critical'>().default('medium'),
  assignedTo: varchar('assigned_to').references(() => users.id),
  notes: text('notes'),
  attachments: jsonb('attachments').$type<string[]>(),
  reminderSet: boolean('reminder_set').default(false),
  reminderDate: timestamp('reminder_date'),
  createdBy: varchar('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Showcase Table - For displaying project results and portfolio items
export const projectShowcases = pgTable('project_showcases', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => clientSubmissions.id)
    .notNull(),
  title: varchar('title').notNull(),
  description: text('description'),
  showcaseType: varchar('showcase_type')
    .$type<
      'gallery' | 'before_after' | 'highlight' | 'story' | 'testimonial' | 'video' | 'youtube'
    >()
    .notNull(),
  images: jsonb('images').$type<
    Array<{
      url: string;
      caption?: string;
      isMain?: boolean;
      order?: number;
    }>
  >(),
  videoUrl: varchar('video_url'),
  youtubeVideoId: varchar('youtube_video_id'), // YouTube video ID
  youtubeVideoUrl: varchar('youtube_video_url'), // Full YouTube URL
  youtubePlaylistId: varchar('youtube_playlist_id'), // YouTube playlist ID
  clientTestimonial: text('client_testimonial'),
  tags: jsonb('tags').$type<string[]>(),
  isPublic: boolean('is_public').default(false),
  isFeatured: boolean('is_featured').default(false),
  publishedAt: timestamp('published_at'),
  seoTitle: varchar('seo_title'),
  seoDescription: text('seo_description'),
  viewCount: integer('view_count').default(0),
  likeCount: integer('like_count').default(0),
  socialShares: integer('social_shares').default(0),
  createdBy: varchar('created_by')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations for timeline and showcase
export const projectTimelinesRelations = relations(projectTimelines, ({ one }) => ({
  project: one(clientSubmissions, {
    fields: [projectTimelines.projectId],
    references: [clientSubmissions.id],
  }),
  assignedUser: one(users, {
    fields: [projectTimelines.assignedTo],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [projectTimelines.createdBy],
    references: [users.id],
  }),
}));

export const projectShowcasesRelations = relations(projectShowcases, ({ one }) => ({
  project: one(clientSubmissions, {
    fields: [projectShowcases.projectId],
    references: [clientSubmissions.id],
  }),
  creator: one(users, {
    fields: [projectShowcases.createdBy],
    references: [users.id],
  }),
}));

// Updated client submissions relations to include timeline and showcase
export const clientSubmissionsRelations = relations(clientSubmissions, ({ many }) => ({
  followUps: many(submissionFollowUps),
  timelines: many(projectTimelines),
  showcases: many(projectShowcases),
  emails: many(projectEmails),
}));

// Types for project timeline and showcase
export type ProjectTimeline = typeof projectTimelines.$inferSelect;
export type InsertProjectTimeline = typeof projectTimelines.$inferInsert;
export type ProjectShowcase = typeof projectShowcases.$inferSelect;
export type InsertProjectShowcase = typeof projectShowcases.$inferInsert;

// Types for project emails
export type ProjectEmail = typeof projectEmails.$inferSelect;
export type InsertProjectEmail = typeof projectEmails.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// Project Emails Table - For tracking email correspondence linked to projects
export const projectEmails = pgTable('project_emails', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id'), // Links to project/submission ID
  projectType: varchar('project_type').$type<'submission' | 'contract' | 'general'>().notNull(),
  messageId: varchar('message_id'), // Gmail message ID for tracking
  threadId: varchar('thread_id'), // Gmail thread ID
  fromEmail: varchar('from_email').notNull(),
  toEmail: varchar('to_email').notNull(),
  ccEmails: jsonb('cc_emails').$type<string[]>(),
  bccEmails: jsonb('bcc_emails').$type<string[]>(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content'),
  textContent: text('text_content'),
  attachments: jsonb('attachments').$type<
    Array<{
      filename: string;
      contentType: string;
      size: number;
      attachmentId?: string;
    }>
  >(),
  direction: varchar('direction').$type<'inbound' | 'outbound'>().notNull(),
  status: varchar('status')
    .$type<'sent' | 'delivered' | 'read' | 'replied' | 'archived'>()
    .default('sent'),
  isImportant: boolean('is_important').default(false),
  tags: jsonb('tags').$type<string[]>(),
  clientType: varchar('client_type').$type<
    'bryllup' | 'portrett' | 'business' | 'produkt' | 'event' | 'familie'
  >(),
  photographerId: varchar('photographer_id').references(() => users.id),
  sentAt: timestamp('sent_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projectEmailsRelations = relations(projectEmails, ({ one }) => ({
  photographer: one(users, {
    fields: [projectEmails.photographerId],
    references: [users.id],
  }),
  submission: one(clientSubmissions, {
    fields: [projectEmails.projectId],
    references: [clientSubmissions.id],
  }),
  contract: one(contracts, {
    fields: [projectEmails.projectId],
    references: [contracts.id],
  }),
}));

// Email Templates Table - For photographer email templates
export const emailTemplates = pgTable('email_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  photographerId: varchar('photographer_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name').notNull(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content'),
  textContent: text('text_content').notNull(),
  templateType: varchar('template_type')
    .$type<'booking-confirmation' | 'preview-ready' | 'final-delivery' | 'follow-up' | 'custom'>()
    .notNull(),
  clientType: varchar('client_type').$type<
    'bryllup' | 'portrett' | 'business' | 'produkt' | 'event' | 'familie'
  >(),
  variables: jsonb('variables').$type<
    Array<{
      name: string;
      placeholder: string;
      description: string;
    }>
  >(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  photographer: one(users, {
    fields: [emailTemplates.photographerId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const insertClientSubmissionSchema = createInsertSchema(clientSubmissions);
export const insertSubmissionFollowUpSchema = createInsertSchema(submissionFollowUps);
export const insertProjectEmailSchema = createInsertSchema(projectEmails);
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);

// Contract Management Table
export const contracts = pgTable('contracts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),
  clientPhone: varchar('client_phone'),
  clientAddress: text('client_address'),
  clientOrgnr: varchar('client_orgnr'), // BRREG organization number
  contractNumber: varchar('contract_number').unique().notNull(),
  projectType: varchar('project_type').notNull(),
  projectDescription: text('project_description'),
  eventDate: date('event_date'),
  eventLocation: varchar('event_location'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }),
  vatIncluded: boolean('vat_included').default(true),
  paymentSchedule: text('payment_schedule'),
  deliveryTimeline: text('delivery_timeline'),
  usageRights: text('usage_rights'),
  cancellationPolicy: text('cancellation_policy'),
  additionalServices: jsonb('additional_services').$type<string[]>(),
  photographerNotes: text('photographer_notes'),
  digitalSigningRequired: boolean('digital_signing_required').default(true),
  driveBackupEnabled: boolean('drive_backup_enabled').default(true),
  signatureUrl: varchar('signature_url'),
  driveBackupUrl: varchar('drive_backup_url'),
  digitalSignature: text('digital_signature'),
  signedDate: timestamp('signed_date'),
  signatureIpAddress: varchar('signature_ip_address'),
  signerName: varchar('signer_name'),
  signerEmail: varchar('signer_email'),
  status: varchar('status')
    .$type<'draft' | 'sent' | 'signed' | 'completed' | 'cancelled'>()
    .default('draft'),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  templateUsed: varchar('template_used'),
  sections: jsonb('sections')
    .$type<
      Array<{
        id: string;
        title: string;
        content: string;
        type: 'terms' | 'pricing' | 'schedule' | 'responsibilities' | 'custom';
        required: boolean;
      }>
    >()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// EU eIDAS Compliant Digital Signatures
export const customerSignatures = pgTable('customer_signatures', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractId: varchar('contract_id')
    .references(() => contracts.id)
    .notNull(),
  signerPersonId: varchar('signer_person_id').notNull(), // BankID/eIDAS person identifier
  signerName: varchar('signer_name').notNull(),
  signerEmail: varchar('signer_email').notNull(),
  authMethod: varchar('auth_method').$type<'bankid' | 'eid_card' | 'mobile_id'>().notNull(),
  signatureLevel: varchar('signature_level').$type<'AES' | 'QES'>().default('AES'),
  documentHash: varchar('document_hash').notNull(), // SHA-256 of PDF
  signatureData: text('signature_data').notNull(), // PAdES signature container
  timestampToken: text('timestamp_token'), // TSA timestamp
  ocspResponse: text('ocsp_response'), // OCSP validation response
  crlData: text('crl_data'), // Certificate Revocation List
  certificateChain: jsonb('certificate_chain'), // Full cert chain for LTV
  signedAt: timestamp('signed_at').defaultNow(),
  validUntil: timestamp('valid_until'),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
  status: varchar('status').$type<'valid' | 'expired' | 'revoked'>().default('valid'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const signRequests = pgTable('sign_requests', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  contractId: varchar('contract_id')
    .references(() => contracts.id)
    .notNull(),
  requesterId: varchar('requester_id').notNull(),
  recipientEmail: varchar('recipient_email').notNull(),
  recipientPhone: varchar('recipient_phone'),
  documentUrl: varchar('document_url').notNull(), // Pre-generated PDF/A URL
  signingUrl: varchar('signing_url').notNull(), // Secure signing session URL
  expiresAt: timestamp('expires_at').notNull(),
  remindersSent: integer('reminders_sent').default(0),
  status: varchar('status')
    .$type<'pending' | 'opened' | 'signed' | 'expired' | 'cancelled'>()
    .default('pending'),
  metadata: jsonb('metadata'), // Additional request context
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const auditEntries = pgTable('audit_entries', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  resourceType: varchar('resource_type')
    .$type<'contract' | 'signature' | 'sign_request'>()
    .notNull(),
  resourceId: varchar('resource_id').notNull(),
  action: varchar('action')
    .$type<'created' | 'viewed' | 'signed' | 'exported' | 'deleted'>()
    .notNull(),
  actorId: varchar('actor_id'), // Pseudonymized user ID
  actorType: varchar('actor_type').$type<'system' | 'signer' | 'requester' | 'admin'>().notNull(),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
  consentGiven: boolean('consent_given'),
  dataProcessingLegal: varchar('data_processing_legal'), // GDPR legal basis
  metadata: jsonb('metadata'), // Action-specific data
  timestamp: timestamp('timestamp').defaultNow(),
  sessionId: varchar('session_id'),
});

// Contract relations
export const contractsRelations = relations(contracts, ({ one, many }) => ({
  user: one(users, {
    fields: [contracts.userId],
    references: [users.id],
  }),
  signatures: many(customerSignatures),
  signRequests: many(signRequests),
}));

export const customerSignaturesRelations = relations(customerSignatures, ({ one }) => ({
  contract: one(contracts, {
    fields: [customerSignatures.contractId],
    references: [contracts.id],
  }),
}));

export const signRequestsRelations = relations(signRequests, ({ one }) => ({
  contract: one(contracts, {
    fields: [signRequests.contractId],
    references: [contracts.id],
  }),
}));

// Core Users Table
export const inviteRequests = pgTable('invite_requests', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar('email').notNull().unique(),
  firstName: varchar('first_name').notNull(),
  lastName: varchar('last_name').notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  // Obligatoriske bedriftsinformasjon
  companyName: varchar('company_name').notNull(),
  organizationNumber: varchar('organization_number').notNull(),
  businessAddress: text('business_address'),
  phoneNumber: varchar('phone_number'),
  website: varchar('website'),
  // Tilgangsforespørsel informasjon
  message: text('message'),
  status: varchar('status')
    .default('pending')
    .$type<'pending' | 'approved' | 'rejected' | 'registered'>(),
  adminNotes: text('admin_notes'),
  processedBy: varchar('processed_by').references(() => users.id),
  processedAt: timestamp('processed_at'),
  registeredUserId: varchar('registered_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Projects Table
export const weddingTimelines = pgTable('wedding_timelines', {
  id: serial('id').primaryKey(),
  projectId: varchar('project_id').references(() => projects.id),
  weddingId: varchar('wedding_id').notNull().unique(),
  groomName: varchar('groom_name').notNull(),
  brideName: varchar('bride_name').notNull(),
  weddingDate: date('wedding_date').notNull(),
  venue: varchar('venue'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Wedding Timeline Client Access Settings - Zero Mock Compliance
export const weddingTimelineClientSettings = pgTable('wedding_timeline_client_settings', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  projectId: varchar('project_id').references(() => projects.id),
  weddingId: varchar('wedding_id').notNull(),

  // Client access control settings
  clientAccessEnabled: boolean('client_access_enabled').default(false),
  allowDownload: boolean('allow_download').default(false),
  allowRightClick: boolean('allow_right_click').default(false),
  allowSave: boolean('allow_save').default(false),
  requireApproval: boolean('require_approval').default(true),

  // Sharing settings
  shareUrl: varchar('share_url').unique(),
  shareToken: varchar('share_token').unique(),
  expiresAt: timestamp('expires_at'),
  accessCount: integer('access_count').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Admin Notifications Table
export const adminNotifications = pgTable('admin_notifications', {
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
  priority: varchar('priority').default('normal'),
  status: varchar('status').default('active'),
  dismissedAt: timestamp('dismissed_at'),
  resolvedAt: timestamp('resolved_at'),
  targetAudience: varchar('target_audience').default('admin'),
  isActive: boolean('is_active').default(true),
  scheduledFor: timestamp('scheduled_for'),
  actionButton: varchar('action_button'),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Lighting Equipment Schema for 3D Simulator
export const lightingEquipment = pgTable('lighting_equipment', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name').notNull(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  lightType: varchar('light_type').notNull(), // continuous, strobe, led, tungsten
  powerWatts: integer('power_watts'),
  colorTemperature: integer('color_temperature'), // Kelvin
  beamAngle: integer('beam_angle'), // degrees
  maxLumens: integer('max_lumens'),

  // 3D Position and settings
  position: jsonb('position').default({ x: 0, y: 2, z: 5 }), // 3D coordinates
  rotation: jsonb('rotation').default({ x: 0, y: 0, z: 0 }), // 3D rotation
  intensity: decimal('intensity', { precision: 3, scale: 2 }).default('1.0'),
  color: varchar('color').default('#ffffff'),
  shadowEnabled: boolean('shadow_enabled').default(true),
  isActive: boolean('is_active').default(true),

  // Equipment metadata
  purchaseDate: date('purchase_date'),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  warrantyExpiry: date('warranty_expiry'),
  maintenanceNotes: text('maintenance_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Showcase Drive Integration - sync showcase categories with Google Drive folders
export const showcaseDriveSync = pgTable('showcase_drive_sync', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),
  profession: varchar('profession').notNull(), // photographer, videographer, music_producer, vendor

  // Drive folder mapping
  driveFolderId: varchar('drive_folder_id').notNull(),
  folderName: varchar('folder_name').notNull(),
  folderPath: varchar('folder_path').notNull(), // Full path in Drive

  // Showcase category mapping
  showcaseCategoryId: varchar('showcase_category_id'),
  categoryName: varchar('category_name').notNull(),
  displayName: varchar('display_name'), // Custom display name for showcase

  // Visibility and display settings
  isVisible: boolean('is_visible').default(true),
  sortOrder: integer('sort_order').default(0),
  gridLayout: varchar('grid_layout').default('grid'), // grid, masonry, carousel

  // Sync settings
  autoSync: boolean('auto_sync').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: varchar('sync_status').default('pending'), // pending, syncing, synced, error

  // File filters
  allowedFileTypes: jsonb('allowed_file_types').default([
    'jpg',
    'jpeg',
    'png',
    'gif',
    'mp4',
    'mov',
  ]),
  maxFileSize: integer('max_file_size').default(50), // MB

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Showcase Content Items - individual files from Drive folders
export const showcaseContentItems = pgTable('showcase_content_items', {
  id: serial('id').primaryKey(),
  showcaseDriveSyncId: integer('showcase_drive_sync_id').references(() => showcaseDriveSync.id),
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id),

  // Drive file details
  driveFileId: varchar('drive_file_id').notNull().unique(),
  fileName: varchar('file_name').notNull(),
  fileType: varchar('file_type').notNull(), // image, video, document
  mimeType: varchar('mime_type').notNull(),
  fileSize: integer('file_size'), // bytes

  // Display settings
  isVisible: boolean('is_visible').default(true),
  displayOrder: integer('display_order').default(0),
  title: varchar('title'), // Custom title for showcase
  description: text('description'), // Custom description

  // Image/Video specific settings
  thumbnailUrl: varchar('thumbnail_url'),
  cropSettings: jsonb('crop_settings'), // For ImageCropEditor
  focalPoint: jsonb('focal_point'), // {x: 0.5, y: 0.5}
  videoThumbnailTime: integer('video_thumbnail_time'), // seconds for video thumbnail

  // Metadata from Drive
  driveMetadata: jsonb('drive_metadata'),
  lastModifiedInDrive: timestamp('last_modified_in_drive'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Lighting Setups - saved lighting configurations
export const lightingSetups = pgTable('lighting_setups', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  projectId: varchar('project_id').references(() => projects.id),
  name: varchar('name').notNull(),
  description: text('description'),
  setupType: varchar('setup_type').default('portrait'), // portrait, product, wedding, studio

  // 3D Scene settings
  sceneConfig: jsonb('scene_config').default({}), // Camera, subject, background settings
  environmentSettings: jsonb('environment_settings').default({}), // HDRI, reflections, etc.
  lightConfiguration: jsonb('light_configuration').notNull(), // All light positions and settings

  // Metadata
  thumbnailPath: text('thumbnail_path'), // Preview image
  isPublic: boolean('is_public').default(false),
  tags: jsonb('tags').default([]),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3D Models for lighting simulator
export const lightingModels = pgTable('lighting_models', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  category: varchar('category').notNull(), // subject, prop, background
  modelType: varchar('model_type').notNull(), // person, product, room
  filePath: text('file_path').notNull(), // Path to 3D model file
  thumbnailPath: text('thumbnail_path'),

  // Model metadata
  polyCount: integer('poly_count'),
  textureCount: integer('texture_count'),
  fileSize: integer('file_size'), // bytes
  dimensions: jsonb('dimensions'), // {width, height, depth}

  // Availability
  isPremium: boolean('is_premium').default(false),
  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Invite-only system with BRREG integration
export const invitations = pgTable('invitations', {
  id: varchar('id').primaryKey(),
  businessName: varchar('business_name').notNull(),
  orgNumber: varchar('org_number').notNull(),
  contactName: varchar('contact_name').notNull(),
  contactEmail: varchar('contact_email').notNull(),
  contactPhone: varchar('contact_phone').notNull(),
  profession: varchar('profession').notNull(), // photographer, videographer, music_producer, vendor
  businessDescription: text('business_description').notNull(),
  websiteUrl: varchar('website_url'),
  socialMediaLinks: jsonb('social_media_links'),
  specialization: varchar('specialization'),
  teamSize: integer('team_size').notNull(),
  annualRevenue: varchar('annual_revenue'),
  currentChallenges: text('current_challenges').notNull(),
  whyCreatorHub: text('why_creator_hub').notNull(),
  googleWorkspaceEmail: varchar('google_workspace_email'),
  hasGoogleWorkspace: boolean('has_google_workspace').default(false),

  // Auto-populated from BRREG/Proff.no
  brregData: jsonb('brreg_data'),
  redFlagAnalysis: jsonb('red_flag_analysis'),

  // Status and processing
  status: varchar('status').notNull().default('pending'), // pending, under_review, approved, rejected
  adminNotes: text('admin_notes'),
  reviewedBy: varchar('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  inviteToken: varchar('invite_token').unique(),
  inviteSentAt: timestamp('invite_sent_at'),
  registeredAt: timestamp('registered_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Super Smart Meeting Notes System with Google Integration
export const meetingNotes = pgTable('meeting_notes', {
  id: serial('id').primaryKey(),
  meetingId: varchar('meeting_id').notNull().unique(),
  projectId: varchar('project_id'), // Link to projects
  weddingTimelineId: integer('wedding_timeline_id').references(() => weddingTimelines.id),
  clientId: varchar('client_id'),
  creatorId: varchar('creator_id').notNull(),
  profession: varchar('profession').notNull(), // photographer, videographer, music_producer, vendor

  // Meeting Details
  meetingTitle: varchar('meeting_title').notNull(),
  meetingDate: timestamp('meeting_date').notNull(),
  meetingDuration: integer('meeting_duration'), // in minutes
  meetingType: varchar('meeting_type').notNull(), // consultation, planning, review, follow_up
  meetingLocation: varchar('meeting_location'), // physical location or "online"

  // Smart Notes Content
  personalNotes: jsonb('personal_notes'), // Private creator notes (structured)
  clientNotes: jsonb('client_notes'), // Shared with client notes (structured)
  actionItems: jsonb('action_items'), // Array of action items with due dates
  decisions: jsonb('decisions'), // Important decisions made
  nextSteps: jsonb('next_steps'), // Follow-up actions

  // AI-Processed Content
  aiSummary: text('ai_summary'), // AI-generated meeting summary
  aiTags: jsonb('ai_tags'), // AI-extracted tags and categories
  aiSentiment: varchar('ai_sentiment'), // positive, neutral, negative
  aiKeyTopics: jsonb('ai_key_topics'), // Array of key discussion topics

  // Wedding Timeline Integration
  timelineUpdates: jsonb('timeline_updates'), // Changes to wedding timeline from this meeting
  practicalInfo: jsonb('practical_info'), // Practical information for wedding timeline
  vendorInfo: jsonb('vendor_info'), // Vendor-related information
  equipmentNeeds: jsonb('equipment_needs'), // Equipment requirements discussed

  // Google Services Integration
  googleDocId: varchar('google_doc_id'), // Google Doc backup of notes
  googleDriveFolderId: varchar('google_drive_folder_id'), // Parent folder in Google Drive
  googleCalendarEventId: varchar('google_calendar_event_id'), // Calendar event ID
  googleMeetRecordingUrl: varchar('google_meet_recording_url'), // Meeting recording URL

  // Visibility & Access Control
  isClientVisible: boolean('is_client_visible').default(false),
  clientAccessLevel: varchar('client_access_level').default('none'), // none, summary, full
  isArchived: boolean('is_archived').default(false),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSyncedToGoogle: timestamp('last_synced_to_google'),
});

// Meeting Notes Attachments
export const meetingAttachments = pgTable('meeting_attachments', {
  id: serial('id').primaryKey(),
  meetingNotesId: integer('meeting_notes_id').references(() => meetingNotes.id),
  fileName: varchar('file_name').notNull(),
  fileType: varchar('file_type').notNull(), // image, document, audio, video
  fileUrl: varchar('file_url').notNull(),
  googleDriveFileId: varchar('google_drive_file_id'),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// Export Meeting Notes Types
export type MeetingNote = typeof meetingNotes.$inferSelect;
export type InsertMeetingNote = typeof meetingNotes.$inferInsert;
export type MeetingAttachment = typeof meetingAttachments.$inferSelect;
export type InsertMeetingAttachment = typeof meetingAttachments.$inferInsert;

// Zod schemas for validation
export const insertMeetingNoteSchema = createInsertSchema(meetingNotes);
export const insertMeetingAttachmentSchema = createInsertSchema(meetingAttachments);

// Camera Firmware Updates Table
export const firmwareUpdates = pgTable('firmware_updates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  version: varchar('version').notNull(),
  releaseDate: date('release_date'),
  description: text('description'),
  importance: varchar('importance').default('normal'), // low, normal, high, critical
  downloadUrl: text('download_url'),
  releaseNotes: text('release_notes'),
  isLatest: boolean('is_latest').default(false),
  sourceUrl: text('source_url'), // Manufacturer website URL
  lastChecked: timestamp('last_checked'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Firmware update relations
export const firmwareUpdatesRelations = relations(firmwareUpdates, ({ one }) => ({
  // Add relations if needed
}));

// Firmware update types
export type FirmwareUpdate = typeof firmwareUpdates.$inferSelect;
export type InsertFirmwareUpdate = typeof firmwareUpdates.$inferInsert;

// Showcase system tables
export const showcaseItems = pgTable('showcase_items', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),
  title: varchar('title').notNull(),
  description: text('description'),
  mediaType: varchar('media_type').$type<'image' | 'video' | 'gallery'>().notNull(),
  mediaUrl: text('media_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  category: varchar('category'),
  tags: jsonb('tags')
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  isPublic: boolean('is_public').default(false),
  isFeatured: boolean('is_featured').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const showcaseCategories = pgTable('showcase_categories', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  color: varchar('color').default('#FF6B35'),
  icon: varchar('icon'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const showcaseCollections = pgTable('showcase_collections', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  isPublic: boolean('is_public').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const showcaseInteractions = pgTable('showcase_interactions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  showcaseItemId: varchar('showcase_item_id')
    .references(() => showcaseItems.id)
    .notNull(),
  interactionType: varchar('interaction_type')
    .$type<'like' | 'view' | 'share' | 'download'>()
    .notNull(),
  userIdentifier: varchar('user_identifier'), // IP or session ID for anonymous users
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Professional Showcase Management System - Full Administrative Control
export const showcaseTemplates = pgTable('showcase_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id),
  name: varchar('name').notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  description: text('description'),
  layoutConfig: jsonb('layout_config')
    .$type<{
      style:
        | 'grid'
        | 'masonry'
        | 'carousel'
        | 'timeline'
        | 'portfolio'
        | 'magazine'
        | 'split_screen';
      columns: number;
      aspectRatio: string;
      spacing: number;
      animations: boolean;
      autoplay?: boolean;
      navigation?: boolean;
    }>()
    .notNull(),
  designSettings: jsonb('design_settings')
    .$type<{
      colorScheme: 'light' | 'dark' | 'auto' | 'custom';
      customColors?: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
      };
      typography: {
        fontFamily: string;
        fontSize: 'small' | 'medium' | 'large';
        fontWeight: 'light' | 'normal' | 'bold';
      };
      borderRadius: number;
      shadows: boolean;
      gradients: boolean;
      glassmorphism: boolean;
    }>()
    .notNull(),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations for showcase system
export const showcaseItemsRelations = relations(showcaseItems, ({ one, many }) => ({
  user: one(users, {
    fields: [showcaseItems.userId],
    references: [users.id],
  }),
  interactions: many(showcaseInteractions),
}));

export const showcaseCategoriesRelations = relations(showcaseCategories, ({ one }) => ({
  user: one(users, {
    fields: [showcaseCategories.userId],
    references: [users.id],
  }),
}));

export const showcaseTemplatesRelations = relations(showcaseTemplates, ({ one }) => ({
  user: one(users, {
    fields: [showcaseTemplates.userId],
    references: [users.id],
  }),
}));

export const showcaseCollectionsRelations = relations(showcaseCollections, ({ one }) => ({
  user: one(users, {
    fields: [showcaseCollections.userId],
    references: [users.id],
  }),
}));

// Showcase Comments System - Professional client feedback and collaboration
export const showcaseComments = pgTable('showcase_comments', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  showcaseItemId: varchar('showcase_item_id')
    .references(() => showcaseItems.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id').notNull(),
  userName: varchar('user_name').notNull(),
  userEmail: varchar('user_email'),
  commentText: text('comment_text').notNull(),
  timestampSeconds: decimal('timestamp_seconds', { precision: 10, scale: 3 }), // For video/audio timestamp comments
  parentCommentId: varchar('parent_comment_id').references(() => showcaseComments.id, {
    onDelete: 'set null',
  }),
  status: varchar('status').$type<'pending' | 'approved' | 'rejected'>().default('pending'),
  photographerResponse: text('photographer_response'),
  isResolved: boolean('is_resolved').default(false),
  metadata: jsonb('metadata').$type<{
    proToolsMarker?: string;
    proToolsRegion?: string;
    proToolsSession?: string;
    syncedAt?: string;
    clientDevice?: string;
    location?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const commentSuggestions = pgTable('comment_suggestions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer'>()
    .notNull(),
  mediaType: varchar('media_type').$type<'image' | 'video' | 'audio'>().notNull(),
  contextType: varchar('context_type').notNull(), // general, timestamp, composition, lighting, etc.
  suggestionText: text('suggestion_text').notNull(),
  isActive: boolean('is_active').default(true),
  language: varchar('language').default('no'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Comment system relations
export const showcaseCommentsRelations = relations(showcaseComments, ({ one, many }) => ({
  showcaseItem: one(showcaseItems, {
    fields: [showcaseComments.showcaseItemId],
    references: [showcaseItems.id],
  }),
  parentComment: one(showcaseComments, {
    fields: [showcaseComments.parentCommentId],
    references: [showcaseComments.id],
    relationName: 'parentComment',
  }),
  replies: many(showcaseComments, {
    relationName: 'parentComment',
  }),
}));

// Update showcase items relations to include comments
export const showcaseItemsUpdatedRelations = relations(showcaseItems, ({ one, many }) => ({
  user: one(users, {
    fields: [showcaseItems.userId],
    references: [users.id],
  }),
  interactions: many(showcaseInteractions),
  comments: many(showcaseComments),
}));

export const showcaseInteractionsRelations = relations(showcaseInteractions, ({ one }) => ({
  showcaseItem: one(showcaseItems, {
    fields: [showcaseInteractions.showcaseItemId],
    references: [showcaseItems.id],
  }),
}));

// Showcase Settings - Professional watermark and gallery settings
export const showcaseSettings = pgTable('showcase_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id'), // Can be project-specific or global

  // Client access settings
  allowDownload: boolean('allow_download').default(false),
  allowRightClick: boolean('allow_right_click').default(false),
  allowSave: boolean('allow_save').default(false),
  requireApproval: boolean('require_approval').default(true),
  clientAccessEnabled: boolean('client_access_enabled').default(false),

  // Watermark settings
  watermarkEnabled: boolean('watermark_enabled').default(false),
  watermarkType: varchar('watermark_type').$type<'text' | 'logo'>().default('text'),
  watermarkText: varchar('watermark_text').default('VANNMERKE'),
  watermarkLogo: text('watermark_logo'), // Base64 or URL
  watermarkSize: integer('watermark_size').default(16),
  watermarkOpacity: integer('watermark_opacity').default(70),
  watermarkPosition: varchar('watermark_position').default('bottom-right'),
  watermarkRotation: integer('watermark_rotation').default(0),
  watermarkX: decimal('watermark_x', { precision: 5, scale: 2 }), // Percentage
  watermarkY: decimal('watermark_y', { precision: 5, scale: 2 }), // Percentage

  // Preview settings
  previewFormat: varchar('preview_format')
    .$type<'16:9' | '4:3' | '3:2' | '1:1' | '9:16' | '21:9'>()
    .default('16:9'),
  previewBackground: varchar('preview_background')
    .$type<'light' | 'dark' | 'transparent'>()
    .default('light'),
  showGrid: boolean('show_grid').default(true),
  showRulers: boolean('show_rulers').default(false),
  showPixelDistance: boolean('show_pixel_distance').default(false),

  // Advanced watermark styling
  watermarkFont: varchar('watermark_font').default('Arial'),
  watermarkBold: boolean('watermark_bold').default(false),
  watermarkItalic: boolean('watermark_italic').default(false),
  watermarkColor: varchar('watermark_color').default('#333333'),
  watermarkShadow: boolean('watermark_shadow').default(false),
  watermarkBlur: integer('watermark_blur').default(0),
  watermarkBlendMode: varchar('watermark_blend_mode').default('normal'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas for showcase system
export const insertShowcaseItemSchema = createInsertSchema(showcaseItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseSettingsSchema = createInsertSchema(showcaseSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseCategorySchema = createInsertSchema(showcaseCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseTemplateSchema = createInsertSchema(showcaseTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseCollectionSchema = createInsertSchema(showcaseCollections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShowcaseInteractionSchema = createInsertSchema(showcaseInteractions).omit({
  id: true,
  createdAt: true,
});

// Comment system schemas and types
export const insertShowcaseCommentSchema = createInsertSchema(showcaseComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentSuggestionSchema = createInsertSchema(commentSuggestions).omit({
  id: true,
  createdAt: true,
});

// Types for showcase comment system
export type ShowcaseComment = typeof showcaseComments.$inferSelect;
export type InsertShowcaseComment = typeof showcaseComments.$inferInsert;
export type CommentSuggestion = typeof commentSuggestions.$inferSelect;
export type InsertCommentSuggestion = typeof commentSuggestions.$inferInsert;

// Contract insert schema
export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Contract types
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

// Relations for showcase settings
export const showcaseSettingsRelations = relations(showcaseSettings, ({ one }) => ({
  user: one(users, {
    fields: [showcaseSettings.userId],
    references: [users.id],
  }),
}));

// TypeScript types for showcase system
export type ShowcaseItem = typeof showcaseItems.$inferSelect;
export type InsertShowcaseItem = z.infer<typeof insertShowcaseItemSchema>;
export type ShowcaseCategory = typeof showcaseCategories.$inferSelect;
export type InsertShowcaseCategory = z.infer<typeof insertShowcaseCategorySchema>;
export type ShowcaseTemplate = typeof showcaseTemplates.$inferSelect;
export type InsertShowcaseTemplate = z.infer<typeof insertShowcaseTemplateSchema>;
export type ShowcaseCollection = typeof showcaseCollections.$inferSelect;
export type InsertShowcaseCollection = z.infer<typeof insertShowcaseCollectionSchema>;
export type ShowcaseInteraction = typeof showcaseInteractions.$inferSelect;
export type InsertShowcaseInteraction = z.infer<typeof insertShowcaseInteractionSchema>;
export type ShowcaseSettings = typeof showcaseSettings.$inferSelect;
export type InsertShowcaseSettings = z.infer<typeof insertShowcaseSettingsSchema>;

// Insert schemas for core tables
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeddingTimelineSchema = createInsertSchema(weddingTimelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeddingTimelineClientSettingsSchema = createInsertSchema(
  weddingTimelineClientSettings,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLightingEquipmentSchema = createInsertSchema(lightingEquipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLightingSetupSchema = createInsertSchema(lightingSetups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types for core tables
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type WeddingTimeline = typeof weddingTimelines.$inferSelect;
export type InsertWeddingTimeline = z.infer<typeof insertWeddingTimelineSchema>;
export type WeddingTimelineClientSettings = typeof weddingTimelineClientSettings.$inferSelect;
export type InsertWeddingTimelineClientSettings = z.infer<
  typeof insertWeddingTimelineClientSettingsSchema
>;
export type LightingEquipment = typeof lightingEquipment.$inferSelect;
export type InsertLightingEquipment = z.infer<typeof insertLightingEquipmentSchema>;
export type LightingSetup = typeof lightingSetups.$inferSelect;
export type InsertLightingSetup = z.infer<typeof insertLightingSetupSchema>;

// Video Lights Equipment Table
export const videoLights = pgTable('video_lights', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  year: integer('year').notNull(),
  wattage: integer('wattage').notNull(),
  lightType: varchar('light_type').notNull(), // LED, COB, Fresnel, Panel, Tube, Spot
  colorTemperature: varchar('color_temperature').notNull(),
  category: varchar('category').notNull(), // continuous, studio, portable, panel, fresnel
  features: jsonb('features'),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  purchaseDate: date('purchase_date'),
  serialNumber: varchar('serial_number'),
  warrantyInfo: text('warranty_info'),
  firmwareVersion: varchar('firmware_version'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Photo Flash Equipment Table
export const photoFlash = pgTable('photo_flash', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  year: integer('year').notNull(),
  guideNumber: integer('guide_number').notNull(),
  flashType: varchar('flash_type').notNull(), // Speedlight, Studio, Battery, Ring, Macro
  category: varchar('category').notNull(), // portable, studio, ring, macro, battery
  features: jsonb('features'),
  ttlSupport: jsonb('ttl_support'), // Compatible camera brands
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),
  purchaseDate: date('purchase_date'),
  serialNumber: varchar('serial_number'),
  warrantyInfo: text('warranty_info'),
  firmwareVersion: varchar('firmware_version'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas for new equipment tables
export const insertVideoLightSchema = createInsertSchema(videoLights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhotoFlashSchema = createInsertSchema(photoFlash).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for invite requests
export const insertInviteRequestSchema = createInsertSchema(inviteRequests).omit({
  id: true,
  status: true,
  processedBy: true,
  processedAt: true,
  registeredUserId: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript types for invite requests
export type InviteRequest = typeof inviteRequests.$inferSelect;
export type InsertInviteRequest = z.infer<typeof insertInviteRequestSchema>;

// TypeScript types for new equipment tables
export type VideoLight = typeof videoLights.$inferSelect;
export type InsertVideoLight = z.infer<typeof insertVideoLightSchema>;
export type PhotoFlash = typeof photoFlash.$inferSelect;
export type InsertPhotoFlash = z.infer<typeof insertPhotoFlashSchema>;

// Brand Image Discovery Table - Stores discovered logos and product images
export const brandImageDiscoveries = pgTable('brand_image_discoveries', {
  id: varchar('id').primaryKey(),
  brand: varchar('brand').notNull(),
  model: varchar('model'),
  category: varchar('category').notNull(),
  logoUrl: text('logo_url'),
  productImageUrl: text('product_image_url'),
  officialWebsiteUrl: text('official_website_url'),
  brandColors: jsonb('brand_colors').$type<string[]>(),
  imageFormat: varchar('image_format'),
  resolution: varchar('resolution'),
  discoveryMethod: varchar('discovery_method').$type<'openai' | 'direct' | 'fallback'>().notNull(),
  verified: boolean('verified').default(false),
  source: text('source'),
  lastVerified: timestamp('last_verified'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type BrandImageDiscovery = typeof brandImageDiscoveries.$inferSelect;
export type InsertBrandImageDiscovery = typeof brandImageDiscoveries.$inferInsert;

// Gear Announcements Table - Tracks future gear announcements and new product releases
export const gearAnnouncements = pgTable('gear_announcements', {
  id: varchar('id').primaryKey(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  category: varchar('category').notNull(),
  announcementDate: varchar('announcement_date').notNull(),
  expectedReleaseDate: varchar('expected_release_date'),
  keyFeatures: text('key_features'),
  sourceUrl: text('source_url'),
  confidence: integer('confidence').notNull().default(5), // 1-10 confidence level
  status: varchar('status')
    .$type<'rumor' | 'announced' | 'released' | 'cancelled'>()
    .notNull()
    .default('announced'),
  actualReleaseDate: varchar('actual_release_date'),
  priceEstimate: varchar('price_estimate'),
  availability: varchar('availability'),
  additionalInfo: text('additional_info'),
  lastChecked: timestamp('last_checked'),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type GearAnnouncement = typeof gearAnnouncements.$inferSelect;
export type InsertGearAnnouncement = typeof gearAnnouncements.$inferInsert;

// Advanced Folder Change Tracking System
export const folderChangeHistory = pgTable('folder_change_history', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  projectId: varchar('project_id', { length: 255 }),
  action: varchar('action', { length: 50 }).notNull(), // 'rename', 'create', 'delete', 'move'
  originalName: varchar('original_name', { length: 255 }),
  newName: varchar('new_name', { length: 255 }),
  folderPath: varchar('folder_path', { length: 500 }),
  googleDriveId: varchar('google_drive_id', { length: 255 }),
  changeData: jsonb('change_data'), // Full change details
  canUndo: boolean('can_undo').default(true),
  canRedo: boolean('can_redo').default(false),
  undoData: jsonb('undo_data'), // Data needed to reverse the change
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

// Folder Structure Validation Results
export const folderValidations = pgTable('folder_validations', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  projectId: varchar('project_id', { length: 255 }),
  expectedStructure: text('expected_structure').array(),
  actualStructure: text('actual_structure').array(),
  deviations: jsonb('deviations'), // List of differences
  isValid: boolean('is_valid').default(true),
  allowFlexibility: boolean('allow_flexibility').default(true),
  autoCorrect: boolean('auto_correct').default(false),
  validatedAt: timestamp('validated_at').defaultNow(),
  correctedAt: timestamp('corrected_at'),
});

export type SelectFolderChangeHistory = typeof folderChangeHistory.$inferSelect;
export type InsertFolderChangeHistory = typeof folderChangeHistory.$inferInsert;
export type SelectFolderValidation = typeof folderValidations.$inferSelect;
export type InsertFolderValidation = typeof folderValidations.$inferInsert;

// Worklog System with Google Keep Integration
export const worklogEntries = pgTable('worklog_entries', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull(),
  projectId: varchar('project_id'),
  day: integer('day').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  timeSpent: integer('time_spent').notNull(), // minutes
  category: varchar('category', { length: 100 }).notNull(),
  mood: varchar('mood', { length: 50 }),
  nextSteps: text('next_steps'),
  isPrivate: boolean('is_private').default(false),
  googleKeepNoteId: varchar('google_keep_note_id'), // Link to Google Keep note
  keepSyncStatus: varchar('keep_sync_status')
    .$type<'pending' | 'synced' | 'failed' | 'disabled'>()
    .default('disabled'),
  keepSyncedAt: timestamp('keep_synced_at'),
  tags: text('tags').array(),
  attachments: jsonb('attachments').$type<
    {
      type: 'image' | 'document' | 'link';
      url: string;
      name: string;
    }[]
  >(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Keep Sync Settings per user
export const keepSyncSettings = pgTable('keep_sync_settings', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().unique(),
  syncEnabled: boolean('sync_enabled').default(false),
  autoSync: boolean('auto_sync').default(true),
  syncCategory: varchar('sync_category').default('worklog'),
  lastSyncAt: timestamp('last_sync_at'),
  syncCount: integer('sync_count').default(0),
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
  settings: jsonb('settings')
    .$type<{
      syncPrivateEntries: boolean;
      createCollaborationNotes: boolean;
      includeProjectLinks: boolean;
      notificationLevel: 'none' | 'errors' | 'all';
    }>()
    .default({
      syncPrivateEntries: false,
      createCollaborationNotes: true,
      includeProjectLinks: true,
      notificationLevel: 'errors',
    }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas and types
export const insertWorklogEntrySchema = createInsertSchema(worklogEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKeepSyncSettingsSchema = createInsertSchema(keepSyncSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WorklogEntry = typeof worklogEntries.$inferSelect;
export type InsertWorklogEntry = z.infer<typeof insertWorklogEntrySchema>;
export type KeepSyncSettings = typeof keepSyncSettings.$inferSelect;
export type InsertKeepSyncSettings = z.infer<typeof insertKeepSyncSettingsSchema>;

// ========================================
// CREATORHUB NORGE BIBELEN V5.0 - COMPLETE DATABASE SCHEMA
// ALL 321 MISSING TABLES IMPLEMENTATION
// ========================================

// 1. ONBOARDING PROFILES SYSTEM
export const onboardingProfiles = pgTable('onboarding_profiles', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),

  // Business Information
  businessName: varchar('business_name').notNull(),
  orgNumber: varchar('org_number'),
  businessType: varchar('business_type'), // enkeltpersonforetak, as, asa, etc.
  businessAddress: jsonb('business_address').$type<{
    street: string;
    postalCode: string;
    city: string;
    country: string;
  }>(),

  // Contact Information
  primaryEmail: varchar('primary_email').notNull(),
  businessPhone: varchar('business_phone'),
  website: varchar('website'),
  socialMediaLinks: jsonb('social_media_links').$type<{
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  }>(),

  // Professional Details
  yearsOfExperience: integer('years_of_experience'),
  specialization: text('specialization').array(),
  teamSize: integer('team_size').default(1),
  averageProjectsPerMonth: integer('average_projects_per_month'),
  annualRevenue: varchar('annual_revenue'),

  // Service Areas
  serviceAreas: text('service_areas').array(), // Geographic areas served
  travelRadius: integer('travel_radius'), // km willing to travel
  homeStudioAvailable: boolean('home_studio_available').default(false),
  mobileServiceAvailable: boolean('mobile_service_available').default(true),

  // Technical Setup
  primaryEquipment: jsonb('primary_equipment'),
  editingSoftware: text('editing_software').array(),
  cloudStorageProviders: text('cloud_storage_providers').array(),
  backupSolutions: text('backup_solutions').array(),

  // Business Challenges & Goals
  currentChallenges: text('current_challenges').array(),
  businessGoals: text('business_goals').array(),
  whyCreatorHub: text('why_creator_hub'),
  expectedBenefits: text('expected_benefits').array(),

  // Google Workspace Integration
  hasGoogleWorkspace: boolean('has_google_workspace').default(false),
  googleWorkspaceEmail: varchar('google_workspace_email'),
  googleDriveUsage: varchar('google_drive_usage'), // beginner, intermediate, advanced

  // BRREG Integration Data
  brregVerified: boolean('brreg_verified').default(false),
  brregData: jsonb('brreg_data'),
  brregLastChecked: timestamp('brreg_last_checked'),

  // Onboarding Progress
  completionStatus: varchar('completion_status').default('started'), // started, business_info, professional_details, technical_setup, completed
  completedSteps: text('completed_steps').array(),
  currentStep: varchar('current_step'),
  onboardingNotes: text('onboarding_notes'),

  // Platform Setup
  dashboardConfigured: boolean('dashboard_configured').default(false),
  integrationsSetup: jsonb('integrations_setup')
    .$type<{
      googleDrive: boolean;
      googlePhotos: boolean;
      googleCalendar: boolean;
      youtube: boolean;
      stripe: boolean;
    }>()
    .default({
      googleDrive: false,
      googlePhotos: false,
      googleCalendar: false,
      youtube: false,
      stripe: false,
    }),

  // Demo Mode Setting
  demoMode: boolean('demo_mode').default(false), // false = production mode (default), true = demo mode with simulated data

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// 2. CLIENT COMMUNICATIONS SYSTEM
export const clientCommunications = pgTable('client_communications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  clientId: varchar('client_id').notNull(),
  projectId: varchar('project_id'),

  // Communication Details
  communicationType: varchar('communication_type')
    .$type<'email' | 'phone' | 'video_call' | 'in_person' | 'text' | 'whatsapp'>()
    .notNull(),
  direction: varchar('direction').$type<'incoming' | 'outgoing'>().notNull(),
  subject: varchar('subject'),
  content: text('content').notNull(),

  // Email Specific
  fromEmail: varchar('from_email'),
  toEmail: varchar('to_email'),
  ccEmails: text('cc_emails').array(),
  bccEmails: text('bcc_emails').array(),

  // Phone/Video Specific
  phoneNumber: varchar('phone_number'),
  callDuration: integer('call_duration'), // minutes
  callRecordingUrl: varchar('call_recording_url'),
  meetingUrl: varchar('meeting_url'),

  // Universal Communication System Integration
  universalThreadId: varchar('universal_thread_id'),
  isUniversalChat: boolean('is_universal_chat').default(false),

  // Attachments & Media
  attachments: jsonb('attachments').$type<
    Array<{
      filename: string;
      url: string;
      type: string;
      size: number;
    }>
  >(),

  // Response & Follow-up
  requiresResponse: boolean('requires_response').default(false),
  responseDeadline: timestamp('response_deadline'),
  respondedAt: timestamp('responded_at'),
  followUpScheduled: timestamp('follow_up_scheduled'),

  // Categorization & Priority
  category: varchar('category'), // quote_request, revision, approval, general, complaint, etc.
  priority: varchar('priority').$type<'low' | 'normal' | 'high' | 'urgent'>().default('normal'),
  sentiment: varchar('sentiment').$type<'positive' | 'neutral' | 'negative'>(),

  // Status & Workflow
  status: varchar('status')
    .$type<'unread' | 'read' | 'responded' | 'archived' | 'flagged'>()
    .default('unread'),
  isArchived: boolean('is_archived').default(false),
  isFlagged: boolean('is_flagged').default(false),
  flagReason: varchar('flag_reason'),

  // Internal Notes
  internalNotes: text('internal_notes'),
  tags: text('tags').array(),

  // Google Integration
  googleEmailId: varchar('google_email_id'),
  googleThreadId: varchar('google_thread_id'),
  googleLabelIds: text('google_label_ids').array(),

  // Metadata
  clientDevice: varchar('client_device'),
  clientLocation: varchar('client_location'),
  clientTimezone: varchar('client_timezone'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  scheduledFor: timestamp('scheduled_for'),
});

// 3. WEDDING DETAILS SYSTEM
export const weddingDetails = pgTable('wedding_details', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  // Couple Information
  partnerOneName: varchar('partner_one_name').notNull(),
  partnerTwoName: varchar('partner_two_name').notNull(),
  partnerOneEmail: varchar('partner_one_email'),
  partnerTwoEmail: varchar('partner_two_email'),
  partnerOnePhone: varchar('partner_one_phone'),
  partnerTwoPhone: varchar('partner_two_phone'),

  // Wedding Event Details
  weddingDate: date('wedding_date').notNull(),
  ceremonyTime: varchar('ceremony_time'),
  receptionTime: varchar('reception_time'),

  // Venues
  ceremonyVenue: jsonb('ceremony_venue').$type<{
    name: string;
    address: string;
    contactPerson: string;
    contactPhone: string;
    contactEmail: string;
    venueType: string; // church, outdoor, hotel, etc.
    capacity: number;
    parkingAvailable: boolean;
    indoorBackupAvailable: boolean;
  }>(),

  receptionVenue: jsonb('reception_venue').$type<{
    name: string;
    address: string;
    contactPerson: string;
    contactPhone: string;
    contactEmail: string;
    venueType: string;
    capacity: number;
    parkingAvailable: boolean;
    decorStyle: string;
  }>(),

  // Cultural & Religious Details
  culture: varchar('culture').notNull(), // norsk, pakistansk, indisk, etc.
  religion: varchar('religion'),
  traditions: text('traditions').array(),
  specialCustoms: text('special_customs').array(),
  languagePreferences: text('language_preferences').array(),

  // Guest Information
  guestCount: integer('guest_count'),
  childrenCount: integer('children_count'),
  internationalGuests: integer('international_guests'),
  guestListCategories: jsonb('guest_list_categories').$type<{
    family: number;
    friends: number;
    work: number;
    other: number;
  }>(),

  // Wedding Party
  bridesmaids: jsonb('bridesmaids').$type<
    Array<{
      name: string;
      relationship: string;
      phone?: string;
      email?: string;
    }>
  >(),
  groomsmen: jsonb('groomsmen').$type<
    Array<{
      name: string;
      relationship: string;
      phone?: string;
      email?: string;
    }>
  >(),
  flowergirls: jsonb('flowergirls').$type<
    Array<{
      name: string;
      age: number;
      parentContact: string;
    }>
  >(),
  ringbearers: jsonb('ringbearers').$type<
    Array<{
      name: string;
      age: number;
      parentContact: string;
    }>
  >(),

  // Special Requirements
  accessibilityNeeds: text('accessibility_needs').array(),
  dietaryRestrictions: text('dietary_restrictions').array(),
  musicalPreferences: text('musical_preferences').array(),
  photoRestrictions: text('photo_restrictions').array(), // no photos during ceremony, etc.

  // Timeline Integration
  hasDetailedTimeline: boolean('has_detailed_timeline').default(false),
  timelineId: varchar('timeline_id'),
  bufferTimeNeeded: integer('buffer_time_needed').default(15), // minutes

  // Weather Contingency
  weatherBackupPlan: text('weather_backup_plan'),
  seasonalConsiderations: text('seasonal_considerations').array(),

  // Vendor Coordination
  weddingPlanner: jsonb('wedding_planner').$type<{
    name: string;
    company: string;
    phone: string;
    email: string;
    coordinatorOnDay: string;
  }>(),

  otherVendors: jsonb('other_vendors').$type<
    Array<{
      type: string; // catering, florist, band, etc.
      name: string;
      company: string;
      phone: string;
      email: string;
      arrivalTime: string;
      specialNotes: string;
    }>
  >(),

  // Transportation
  transportationNeeded: boolean('transportation_needed').default(false),
  transportationDetails: jsonb('transportation_details').$type<{
    type: string; // limousine, bus, car, etc.
    pickupLocations: string[];
    dropoffLocations: string[];
    contactInfo: string;
  }>(),

  // Emergency Contacts
  emergencyContacts: jsonb('emergency_contacts').$type<
    Array<{
      name: string;
      relationship: string;
      phone: string;
      role: string; // point person, vendor coordinator, etc.
    }>
  >(),

  // Payment & Contract Details
  totalBudget: decimal('total_budget', { precision: 10, scale: 2 }),
  photographyBudget: decimal('photography_budget', { precision: 10, scale: 2 }),
  paymentSchedule: jsonb('payment_schedule').$type<
    Array<{
      amount: number;
      dueDate: string;
      description: string;
      status: 'pending' | 'paid' | 'overdue';
    }>
  >(),

  // Delivery Preferences
  deliveryMethod: varchar('delivery_method')
    .$type<'digital' | 'usb' | 'prints' | 'album'>()
    .default('digital'),
  deliveryTimeline: varchar('delivery_timeline'), // 2 weeks, 1 month, etc.
  socialMediaPermissions: boolean('social_media_permissions').default(false),
  marketingPermissions: boolean('marketing_permissions').default(false),

  // Notes & Special Instructions
  specialInstructions: text('special_instructions'),
  photographerNotes: text('photographer_notes'),
  clientNotes: text('client_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 4. PROJECT MILESTONES SYSTEM
export const projectMilestones = pgTable('project_milestones', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  // Milestone Details
  title: varchar('title').notNull(),
  description: text('description'),
  category: varchar('category')
    .$type<'planning' | 'shooting' | 'editing' | 'delivery' | 'follow_up' | 'payment'>()
    .notNull(),
  type: varchar('type').$type<'task' | 'event' | 'deadline' | 'payment' | 'approval'>().notNull(),

  // Scheduling
  dueDate: timestamp('due_date'),
  scheduledDate: timestamp('scheduled_date'),
  estimatedDuration: integer('estimated_duration'), // minutes
  actualDuration: integer('actual_duration'), // minutes

  // Dependencies
  dependsOn: text('depends_on').array(), // Other milestone IDs
  blockedBy: text('blocked_by').array(), // What's blocking this milestone

  // Progress & Status
  status: varchar('status')
    .$type<'not_started' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'>()
    .default('not_started'),
  progress: integer('progress').default(0), // 0-100%
  priority: varchar('priority').$type<'low' | 'normal' | 'high' | 'critical'>().default('normal'),

  // Assignments
  assignedTo: varchar('assigned_to'), // User ID or external collaborator
  assignedTeam: text('assigned_team').array(), // Multiple people
  clientInvolvement: boolean('client_involvement').default(false),

  // Deliverables
  deliverables: jsonb('deliverables').$type<
    Array<{
      name: string;
      type: string;
      status: 'pending' | 'in_progress' | 'completed';
      url?: string;
      notes?: string;
    }>
  >(),

  // Time Tracking
  timeSpent: integer('time_spent').default(0), // minutes
  timeEntries: jsonb('time_entries').$type<
    Array<{
      date: string;
      duration: number;
      description: string;
      userId: string;
    }>
  >(),

  // Communication
  clientVisible: boolean('client_visible').default(false),
  requiresClientApproval: boolean('requires_client_approval').default(false),
  clientApprovalStatus: varchar('client_approval_status').$type<
    'pending' | 'approved' | 'needs_revision' | 'rejected'
  >(),
  clientFeedback: text('client_feedback'),

  // Location & Equipment
  location: varchar('location'),
  equipmentNeeded: text('equipment_needed').array(),
  preparationRequired: text('preparation_required').array(),

  // Quality & Standards
  qualityStandards: text('quality_standards'),
  acceptanceCriteria: text('acceptance_criteria').array(),
  qualityCheckStatus: varchar('quality_check_status').$type<
    'pending' | 'passed' | 'failed' | 'needs_review'
  >(),

  // Financial
  budgetAllocated: decimal('budget_allocated', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 10, scale: 2 }),
  invoiceableAmount: decimal('invoiceable_amount', { precision: 10, scale: 2 }),

  // Automation & Integration
  automatedReminders: boolean('automated_reminders').default(true),
  googleCalendarEventId: varchar('google_calendar_event_id'),
  slackChannelId: varchar('slack_channel_id'),
  notificationsSent: integer('notifications_sent').default(0),

  // Version Control
  version: integer('version').default(1),
  changeHistory: jsonb('change_history').$type<
    Array<{
      timestamp: string;
      field: string;
      oldValue: any;
      newValue: any;
      changedBy: string;
    }>
  >(),

  // Notes & Files
  internalNotes: text('internal_notes'),
  clientNotes: text('client_notes'),
  attachments: jsonb('attachments').$type<
    Array<{
      filename: string;
      url: string;
      type: string;
      uploadedBy: string;
      uploadedAt: string;
    }>
  >(),

  // Completion
  completedAt: timestamp('completed_at'),
  completedBy: varchar('completed_by'),
  completionNotes: text('completion_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 5. FIRMWARE VERSIONS SYSTEM
export const firmwareVersions = pgTable('firmware_versions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Equipment Identification
  equipmentType: varchar('equipment_type')
    .$type<
      | 'camera'
      | 'lens'
      | 'flash'
      | 'audio_recorder'
      | 'mixer'
      | 'microphone'
      | 'light'
      | 'drone'
      | 'gimbal'
      | 'monitor'
    >()
    .notNull(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  modelYear: integer('model_year'),

  // Firmware Version Details
  currentVersion: varchar('current_version').notNull(),
  latestVersion: varchar('latest_version').notNull(),
  releaseDate: date('release_date'),
  announcementDate: date('announcement_date'),

  // Update Information
  updateType: varchar('update_type')
    .$type<'major' | 'minor' | 'patch' | 'security' | 'beta'>()
    .notNull(),
  updateSize: integer('update_size'), // MB
  downloadUrl: text('download_url'),
  directDownloadAvailable: boolean('direct_download_available').default(false),

  // Release Notes & Features
  releaseNotes: text('release_notes'),
  newFeatures: text('new_features').array(),
  bugFixes: text('bug_fixes').array(),
  knownIssues: text('known_issues').array(),

  // Importance & Priority
  updateImportance: varchar('update_importance')
    .$type<'low' | 'normal' | 'high' | 'critical' | 'security'>()
    .default('normal'),
  securityUpdate: boolean('security_update').default(false),
  performanceImprovement: boolean('performance_improvement').default(false),

  // Compatibility
  compatibleWith: text('compatible_with').array(), // Other equipment/software versions
  incompatibleWith: text('incompatible_with').array(),
  requiresAdditionalSoftware: text('requires_additional_software').array(),

  // Installation Information
  installationComplexity: varchar('installation_complexity')
    .$type<'simple' | 'moderate' | 'complex' | 'professional_required'>()
    .default('simple'),
  estimatedInstallTime: integer('estimated_install_time'), // minutes
  requiresComputerConnection: boolean('requires_computer_connection').default(true),
  canUpdateInField: boolean('can_update_in_field').default(false),

  // Source Information
  sourceType: varchar('source_type')
    .$type<'official' | 'beta' | 'community' | 'leaked'>()
    .default('official'),
  sourceUrl: text('source_url'),
  manufacturerWebsite: text('manufacturer_website'),
  supportForumUrl: text('support_forum_url'),

  // User Impact Assessment
  userImpact: varchar('user_impact')
    .$type<'none' | 'minimal' | 'moderate' | 'significant' | 'major'>()
    .default('minimal'),
  affectsUserInterface: boolean('affects_user_interface').default(false),
  affectsPerformance: boolean('affects_performance').default(false),
  affectsImageQuality: boolean('affects_image_quality').default(false),
  affectsVideoQuality: boolean('affects_video_quality').default(false),
  affectsAudioQuality: boolean('affects_audio_quality').default(false),

  // Rollback & Safety
  canRollback: boolean('can_rollback').default(true),
  rollbackComplexity: varchar('rollback_complexity').$type<
    'simple' | 'moderate' | 'complex' | 'impossible'
  >(),
  backupRequired: boolean('backup_required').default(true),
  riskLevel: varchar('risk_level').$type<'low' | 'medium' | 'high' | 'very_high'>().default('low'),

  // Verification & Status
  verificationStatus: varchar('verification_status')
    .$type<'unverified' | 'community_verified' | 'officially_verified' | 'tested_by_us'>()
    .default('unverified'),
  lastVerified: timestamp('last_verified'),
  verifiedBy: varchar('verified_by'),

  // Notification & Tracking
  notificationSent: boolean('notification_sent').default(false),
  notificationSentAt: timestamp('notification_sent_at'),
  usersNotified: integer('users_notified').default(0),

  // Regional Availability
  availableRegions: text('available_regions').array(),
  restrictedRegions: text('restricted_regions').array(),

  // Community Feedback
  communityRating: decimal('community_rating', { precision: 3, scale: 2 }), // 1.00-5.00
  installReports: integer('install_reports').default(0),
  successfulInstalls: integer('successful_installs').default(0),
  reportedIssues: integer('reported_issues').default(0),

  // Superseded Information
  isSuperseded: boolean('is_superseded').default(false),
  supersededBy: varchar('superseded_by'), // Newer firmware version ID
  supersededAt: timestamp('superseded_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastChecked: timestamp('last_checked').defaultNow(),
});

// 6. GOOGLE DRIVE FILES SYSTEM
export const googleDriveFiles = pgTable('google_drive_files', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id'),

  // Google Drive Specific
  googleFileId: varchar('google_file_id').notNull().unique(),
  googleFolderId: varchar('google_folder_id'),
  googleParentIds: text('google_parent_ids').array(),

  // File Details
  fileName: varchar('file_name').notNull(),
  fileType: varchar('file_type').notNull(), // image, video, audio, document, etc.
  mimeType: varchar('mime_type').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }), // bytes

  // File Path & Organization
  folderPath: varchar('folder_path'), // Full path within project structure
  folderCategory: varchar('folder_category').$type<
    | 'raw'
    | 'processed'
    | 'delivered'
    | 'contracts'
    | 'communication'
    | 'timeline'
    | 'backup'
    | 'reference'
  >(),
  subcategory: varchar('subcategory'), // Day 1, Day 2, etc. for multi-day events

  // Project Integration
  isProjectFile: boolean('is_project_file').default(false),
  projectStage: varchar('project_stage').$type<
    'planning' | 'shooting' | 'editing' | 'review' | 'delivery' | 'archive'
  >(),

  // File Status & Processing
  status: varchar('status')
    .$type<'uploaded' | 'processing' | 'processed' | 'delivered' | 'archived' | 'deleted'>()
    .default('uploaded'),
  processingStatus: varchar('processing_status').$type<
    'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  >(),

  // Media Specific Information
  mediaMetadata: jsonb('media_metadata').$type<{
    duration?: number; // seconds for video/audio
    width?: number;
    height?: number;
    aspectRatio?: string;
    frameRate?: number;
    bitrate?: number;
    codec?: string;
    colorSpace?: string;
    orientation?: number;
    gpsLocation?: {
      latitude: number;
      longitude: number;
    };
    cameraMake?: string;
    cameraModel?: string;
    lens?: string;
    iso?: number;
    aperture?: number;
    shutterSpeed?: string;
    focalLength?: number;
    dateTimeOriginal?: string;
  }>(),

  // Thumbnails & Previews
  thumbnailUrl: varchar('thumbnail_url'),
  previewUrl: varchar('preview_url'),
  webViewLink: varchar('web_view_link'),
  downloadUrl: varchar('download_url'),

  // Access Control
  isPublic: boolean('is_public').default(false),
  shareableLink: varchar('shareable_link'),
  clientAccess: boolean('client_access').default(false),
  accessLevel: varchar('access_level')
    .$type<'private' | 'client_view' | 'client_download' | 'public'>()
    .default('private'),

  // Version Control
  version: integer('version').default(1),
  isLatestVersion: boolean('is_latest_version').default(true),
  previousVersionId: varchar('previous_version_id'),
  versionNotes: text('version_notes'),

  // Backup & Sync
  isBackedUp: boolean('is_backed_up').default(false),
  backupLocation: varchar('backup_location'), // local, cloud, both
  backupDate: timestamp('backup_date'),
  syncStatus: varchar('sync_status')
    .$type<'synced' | 'pending' | 'conflict' | 'error'>()
    .default('synced'),
  lastSyncedAt: timestamp('last_synced_at'),

  // File Processing History
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at'),
  processingNotes: text('processing_notes'),
  enhancementApplied: boolean('enhancement_applied').default(false),
  enhancementType: varchar('enhancement_type'), // ai_upscale, noise_reduction, color_correction, etc.

  // Client Interaction
  clientViewed: boolean('client_viewed').default(false),
  clientViewedAt: timestamp('client_viewed_at'),
  clientDownloaded: boolean('client_downloaded').default(false),
  clientDownloadedAt: timestamp('client_downloaded_at'),
  clientFavorited: boolean('client_favorited').default(false),
  clientRating: integer('client_rating'), // 1-5
  clientComments: text('client_comments'),

  // Delivery Tracking
  isDelivered: boolean('is_delivered').default(false),
  deliveredAt: timestamp('delivered_at'),
  deliveryMethod: varchar('delivery_method'), // link, download, physical
  deliveryConfirmed: boolean('delivery_confirmed').default(false),

  // Security & Compliance
  isEncrypted: boolean('is_encrypted').default(false),
  encryptionType: varchar('encryption_type'),
  gdprCompliant: boolean('gdpr_compliant').default(true),
  retentionPeriod: integer('retention_period'), // days
  scheduledDeletion: timestamp('scheduled_deletion'),

  // Usage Analytics
  viewCount: integer('view_count').default(0),
  downloadCount: integer('download_count').default(0),
  shareCount: integer('share_count').default(0),
  lastAccessed: timestamp('last_accessed'),

  // Tags & Categories
  tags: text('tags').array(),
  customCategories: text('custom_categories').array(),
  isStarred: boolean('is_starred').default(false),
  internalNotes: text('internal_notes'),

  // Google Drive Metadata
  googleCreatedTime: timestamp('google_created_time'),
  googleModifiedTime: timestamp('google_modified_time'),
  googleOwners: jsonb('google_owners'),
  googlePermissions: jsonb('google_permissions'),
  googleCapabilities: jsonb('google_capabilities'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 7. STANDARD FOLDER STRUCTURES SYSTEM
export const standardFolderStructures = pgTable('standard_folder_structures', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id),

  // Structure Identification
  name: varchar('name').notNull(),
  description: text('description'),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  projectType: varchar('project_type'), // wedding, portrait, business, product, etc.

  // Structure Definition
  structure: jsonb('structure')
    .$type<
      Array<{
        id: string;
        name: string;
        parentId?: string;
        level: number;
        order: number;
        isRequired: boolean;
        description?: string;
        allowCustomization: boolean;
        defaultPermissions: {
          client: 'none' | 'view' | 'upload' | 'full';
          collaborator: 'none' | 'view' | 'upload' | 'full';
          public: 'none' | 'view';
        };
        fileTypes?: string[]; // Allowed file types
        autoOrganization?: {
          enabled: boolean;
          rules: Array<{
            condition: string;
            action: string;
          }>;
        };
      }>
    >()
    .notNull(),

  // Default 8-Folder Structure (Norwegian)
  isDefault: boolean('is_default').default(false),
  defaultStructure: jsonb('default_structure').$type<{
    rawFiles: {
      name: 'RAW - Originale bilder';
      nameEn: 'RAW - Original Images';
      description: 'Ubearbeidede originalfiler direkte fra kamera';
      required: true;
    };
    processedFiles: {
      name: 'Bearbeidede bilder';
      nameEn: 'Processed Images';
      description: 'Redigerte og forbedrede bilder';
      required: true;
    };
    clientDelivery: {
      name: 'Leveranse til klient';
      nameEn: 'Client Delivery';
      description: 'Filer klare for levering til klient';
      required: true;
    };
    contracts: {
      name: 'Kontrakter og dokumenter';
      nameEn: 'Contracts and Documents';
      description: 'Juridiske dokumenter og avtaler';
      required: true;
    };
    communication: {
      name: 'Kommunikasjon';
      nameEn: 'Communication';
      description: 'E-poster og meldinger med klient';
      required: true;
    };
    timeline: {
      name: 'Timeline og notater';
      nameEn: 'Timeline and Notes';
      description: 'Prosjektplan og arbeidsnotater';
      required: true;
    };
    backup: {
      name: 'Backup og sikkerhetskopier';
      nameEn: 'Backup and Security Copies';
      description: 'Sikkerhetskopier og arkiv';
      required: true;
    };
    reference: {
      name: 'Referansebilder og inspirasjon';
      nameEn: 'Reference Images and Inspiration';
      description: 'Inspirasjon og referansemateriale';
      required: false;
    };
  }>(),

  // Customization & Flexibility
  allowRenaming: boolean('allow_renaming').default(true),
  allowAddition: boolean('allow_addition').default(true),
  allowDeletion: boolean('allow_deletion').default(false),
  allowReordering: boolean('allow_reordering').default(true),

  // Change Tracking
  trackChanges: boolean('track_changes').default(true),
  changeHistory: jsonb('change_history').$type<
    Array<{
      timestamp: string;
      action: 'create' | 'rename' | 'move' | 'delete' | 'reorder';
      folderId: string;
      oldName?: string;
      newName?: string;
      oldParent?: string;
      newParent?: string;
      canUndo: boolean;
      undoData?: any;
    }>
  >(),

  // Undo/Redo System
  undoStack: jsonb('undo_stack').$type<
    Array<{
      action: string;
      data: any;
      timestamp: string;
    }>
  >(),
  redoStack: jsonb('redo_stack').$type<
    Array<{
      action: string;
      data: any;
      timestamp: string;
    }>
  >(),

  // Google Drive Integration
  googleDriveEnabled: boolean('google_drive_enabled').default(true),
  googleDriveTemplateId: varchar('google_drive_template_id'),
  autoCreateInDrive: boolean('auto_create_in_drive').default(true),
  drivePermissionTemplate: jsonb('drive_permission_template'),

  // Usage Statistics
  timesUsed: integer('times_used').default(0),
  lastUsed: timestamp('last_used'),
  averageSetupTime: integer('average_setup_time'), // seconds
  userSatisfactionRating: decimal('user_satisfaction_rating', {
    precision: 3,
    scale: 2,
  }),

  // Sharing & Templates
  isPublicTemplate: boolean('is_public_template').default(false),
  sharedWith: text('shared_with').array(), // User IDs
  templateCategory: varchar('template_category'), // wedding, portrait, business, etc.

  // Backup & Recovery
  hasBackup: boolean('has_backup').default(true),
  backupLocation: varchar('backup_location'),
  canRestoreToDefault: boolean('can_restore_to_default').default(true),
  lastBackupAt: timestamp('last_backup_at'),

  // Validation & Health Check
  isValid: boolean('is_valid').default(true),
  validationErrors: text('validation_errors').array(),
  lastValidated: timestamp('last_validated'),
  autoRepair: boolean('auto_repair').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 8. AUDIO PROJECTS SYSTEM
export const audioProjects = pgTable('audio_projects', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  // Project Identification
  title: varchar('title').notNull(),
  artistName: varchar('artist_name').notNull(),
  albumName: varchar('album_name'),
  genre: varchar('genre'),
  subgenre: varchar('subgenre'),

  // Project Type & Category
  projectType: varchar('project_type')
    .$type<
      | 'single'
      | 'ep'
      | 'album'
      | 'remix'
      | 'master'
      | 'podcast'
      | 'audiobook'
      | 'commercial'
      | 'film_score'
      | 'game_audio'
    >()
    .notNull(),
  category: varchar('category')
    .$type<'recording' | 'mixing' | 'mastering' | 'production' | 'composition' | 'sound_design'>()
    .notNull(),

  // Technical Specifications
  sampleRate: integer('sample_rate').default(44100), // Hz
  bitDepth: integer('bit_depth').default(24), // bits
  numberOfChannels: integer('number_of_channels').default(2),
  projectLength: integer('project_length'), // seconds
  tempo: decimal('tempo', { precision: 6, scale: 2 }), // BPM
  keySignature: varchar('key_signature'),
  timeSignature: varchar('time_signature').default('4/4'),

  // DAW & Software Information
  daw: varchar('daw')
    .$type<
      | 'pro_tools'
      | 'logic_pro'
      | 'ableton_live'
      | 'cubase'
      | 'studio_one'
      | 'reaper'
      | 'fl_studio'
      | 'reason'
      | 'other'
    >()
    .notNull(),
  dawVersion: varchar('daw_version'),
  plugins: text('plugins').array(),
  templatesUsed: text('templates_used').array(),

  // Session Files & Organization
  sessionFilePath: varchar('session_file_path'),
  projectFolderPath: varchar('project_folder_path'),
  audioFilesPath: varchar('audio_files_path'),
  stemsFolderPath: varchar('stems_folder_path'),
  mixdownsPath: varchar('mixdowns_path'),

  // Track Information
  totalTracks: integer('total_tracks').default(0),
  trackList: jsonb('track_list').$type<
    Array<{
      trackNumber: number;
      name: string;
      instrument: string;
      recordingDate?: string;
      isComped: boolean;
      isEdited: boolean;
      isMuted: boolean;
      isSolo: boolean;
      volume: number;
      pan: number;
      notes?: string;
    }>
  >(),

  // Recording Details
  recordingStudio: varchar('recording_studio'),
  recordingDates: jsonb('recording_dates').$type<
    Array<{
      date: string;
      startTime: string;
      endTime: string;
      tracksRecorded: string[];
      notes?: string;
    }>
  >(),
  recordingNotes: text('recording_notes'),

  // Personnel
  producer: varchar('producer'),
  recordingEngineer: varchar('recording_engineer'),
  mixingEngineer: varchar('mixing_engineer'),
  masteringEngineer: varchar('mastering_engineer'),
  additionalPersonnel: jsonb('additional_personnel').$type<
    Array<{
      name: string;
      role: string;
      contact?: string;
    }>
  >(),

  // Equipment Used
  microphones: text('microphones').array(),
  preamps: text('preamps').array(),
  interfaces: text('interfaces').array(),
  monitors: text('monitors').array(),
  instruments: text('instruments').array(),
  outboardGear: text('outboard_gear').array(),

  // Project Status & Progress
  status: varchar('status')
    .$type<
      | 'planning'
      | 'recording'
      | 'tracking'
      | 'editing'
      | 'mixing'
      | 'mastering'
      | 'completed'
      | 'on_hold'
      | 'cancelled'
    >()
    .default('planning'),
  progress: integer('progress').default(0), // 0-100%
  currentStage: varchar('current_stage'),

  // Versions & Mixes
  versions: jsonb('versions').$type<
    Array<{
      versionNumber: string;
      versionName: string;
      date: string;
      filePath: string;
      notes: string;
      approvedByClient: boolean;
      isFinal: boolean;
    }>
  >(),

  // Client & Commercial Information
  clientId: varchar('client_id'),
  clientContact: jsonb('client_contact').$type<{
    name: string;
    email: string;
    phone: string;
    preferredContact: string;
  }>(),
  recordLabel: varchar('record_label'),
  publisher: varchar('publisher'),
  distributor: varchar('distributor'),

  // Rights & Licensing
  copyrightOwner: varchar('copyright_owner'),
  publishingRights: varchar('publishing_rights'),
  masterRights: varchar('master_rights'),
  isrcCode: varchar('isrc_code'),
  catalogNumber: varchar('catalog_number'),

  // TONO/GRAMO Integration (Norwegian Music Rights)
  tonoRegistered: boolean('tono_registered').default(false),
  tonoRegistrationNumber: varchar('tono_registration_number'),
  gramoRegistered: boolean('gramo_registered').default(false),
  gramoRegistrationNumber: varchar('gramo_registration_number'),
  royaltyInfo: jsonb('royalty_info').$type<{
    tonoPercentage?: number;
    gramoPercentage?: number;
    otherRights?: Array<{
      organization: string;
      percentage: number;
      type: string;
    }>;
  }>(),

  // Delivery & Distribution
  deliverables: jsonb('deliverables').$type<
    Array<{
      type: 'wav' | 'mp3' | 'flac' | 'aiff' | 'stems' | 'session';
      specification: string;
      status: 'pending' | 'completed' | 'delivered';
      filePath?: string;
      deliveryDate?: string;
    }>
  >(),

  // Quality Assurance
  qualityCheckPassed: boolean('quality_check_passed').default(false),
  qualityNotes: text('quality_notes'),
  mastering: jsonb('mastering').$type<{
    loudnessLUFS: number;
    peakLevel: number;
    dynamicRange: number;
    spectralBalance: string;
    qualityScore: number;
  }>(),

  // AI Enhancement Integration
  aiEnhancementApplied: boolean('ai_enhancement_applied').default(false),
  enhancementDetails: jsonb('enhancement_details').$type<
    Array<{
      type: 'denoising' | 'vocal_enhancement' | 'stereo_widening' | 'mastering' | 'restoration';
      model: string;
      settings: any;
      appliedAt: string;
      resultQuality: number;
    }>
  >(),

  // Budget & Financial
  projectBudget: decimal('project_budget', { precision: 10, scale: 2 }),
  hourlyRate: decimal('hourly_rate', { precision: 6, scale: 2 }),
  totalHours: decimal('total_hours', { precision: 6, scale: 2 }).default('0'),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),

  // Deadlines & Scheduling
  startDate: date('start_date'),
  endDate: date('end_date'),
  deliveryDeadline: date('delivery_deadline'),
  milestones: jsonb('milestones').$type<
    Array<{
      name: string;
      date: string;
      status: 'pending' | 'completed' | 'overdue';
      notes?: string;
    }>
  >(),

  // Backup & Archive
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at'),
  backupStatus: varchar('backup_status')
    .$type<'none' | 'local' | 'cloud' | 'both'>()
    .default('none'),
  backupLocation: varchar('backup_location'),

  // Collaboration
  collaborators: jsonb('collaborators').$type<
    Array<{
      userId: string;
      name: string;
      role: string;
      permissions: string[];
      invitedAt: string;
      acceptedAt?: string;
    }>
  >(),

  // Notes & Documentation
  projectNotes: text('project_notes'),
  clientNotes: text('client_notes'),
  technicalNotes: text('technical_notes'),
  creativeNotes: text('creative_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// 9. AUDIO ENHANCEMENTS SYSTEM
export const audioEnhancements = pgTable('audio_enhancements', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  audioProjectId: varchar('audio_project_id')
    .references(() => audioProjects.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  // Enhancement Job Details
  jobName: varchar('job_name').notNull(),
  description: text('description'),
  enhancementType: varchar('enhancement_type')
    .$type<
      | 'denoising'
      | 'vocal_enhancement'
      | 'stereo_widening'
      | 'mastering'
      | 'restoration'
      | 'pitch_correction'
      | 'time_stretching'
      | 'spectral_repair'
      | 'dialogue_enhancement'
      | 'music_separation'
    >()
    .notNull(),

  // AI Model Information
  modelUsed: varchar('model_used')
    .$type<
      | 'rnnoise'
      | 'dccrn'
      | 'demucs'
      | 'spleeter'
      | 'facebook_denoiser'
      | 'nvidia_broadcast'
      | 'izotope_rx'
      | 'custom'
    >()
    .notNull(),
  modelVersion: varchar('model_version'),
  modelParameters: jsonb('model_parameters'),

  // Input/Output Files
  inputFilePath: varchar('input_file_path').notNull(),
  outputFilePath: varchar('output_file_path'),
  stemOutputPaths: jsonb('stem_output_paths').$type<{
    vocals?: string;
    drums?: string;
    bass?: string;
    piano?: string;
    guitar?: string;
    strings?: string;
    horns?: string;
    other?: string;
  }>(),

  // Audio Specifications
  inputFormat: varchar('input_format'), // wav, mp3, flac, etc.
  outputFormat: varchar('output_format'),
  sampleRate: integer('sample_rate'),
  bitDepth: integer('bit_depth'),
  channels: integer('channels'),
  duration: integer('duration'), // seconds

  // Processing Settings
  processingSettings: jsonb('processing_settings').$type<{
    // RNNoise settings
    aggressiveness?: number;

    // DCCRN settings
    compressionRatio?: number;
    lookAheadTime?: number;

    // Demucs settings
    modelName?: string;
    overlap?: number;
    shifts?: number;
    split?: boolean;

    // Spleeter settings
    stems?: number;
    configuration?: string;

    // General settings
    gain?: number;
    normalize?: boolean;
    fadeIn?: number;
    fadeOut?: number;
    customParams?: Record<string, any>;
  }>(),

  // Job Status & Progress
  status: varchar('status')
    .$type<'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused'>()
    .default('queued'),
  progress: integer('progress').default(0), // 0-100%
  stage: varchar('stage'), // loading, analyzing, processing, saving, etc.
  estimatedTimeRemaining: integer('estimated_time_remaining'), // seconds

  // Quality Metrics
  inputQualityScore: decimal('input_quality_score', { precision: 5, scale: 2 }),
  outputQualityScore: decimal('output_quality_score', {
    precision: 5,
    scale: 2,
  }),
  improvementScore: decimal('improvement_score', { precision: 5, scale: 2 }),

  // Audio Analysis Results
  inputAnalysis: jsonb('input_analysis').$type<{
    loudnessLUFS?: number;
    peakLevel?: number;
    rmsLevel?: number;
    dynamicRange?: number;
    snrEstimate?: number; // Signal-to-noise ratio
    thd?: number; // Total harmonic distortion
    spectralCentroid?: number;
    spectralRolloff?: number;
    zeroCrossingRate?: number;
    fundamentalFrequency?: number;

    // Frequency analysis
    frequencySpectrum?: Array<{
      frequency: number;
      magnitude: number;
    }>;

    // Noise characteristics
    noiseProfile?: Array<{
      frequency: number;
      magnitude: number;
    }>;

    // Voice activity detection
    voiceActivity?: Array<{
      startTime: number;
      endTime: number;
      confidence: number;
    }>;
  }>(),

  outputAnalysis: jsonb('output_analysis').$type<{
    loudnessLUFS?: number;
    peakLevel?: number;
    rmsLevel?: number;
    dynamicRange?: number;
    snrEstimate?: number;
    thd?: number;
    spectralCentroid?: number;
    spectralRolloff?: number;
    zeroCrossingRate?: number;
    fundamentalFrequency?: number;

    // Quality improvements
    noiseReduction?: number; // dB reduction
    clarityImprovement?: number;

    // Stem separation quality (if applicable)
    separationQuality?: {
      vocals?: number;
      drums?: number;
      bass?: number;
      other?: number;
    };
  }>(),

  // Processing Performance
  processingTime: integer('processing_time'), // seconds
  cpuUsage: decimal('cpu_usage', { precision: 5, scale: 2 }), // percentage
  memoryUsage: integer('memory_usage'), // MB
  gpuUsage: decimal('gpu_usage', { precision: 5, scale: 2 }), // percentage if GPU used

  // Error Handling
  errorMessage: text('error_message'),
  errorCode: varchar('error_code'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),

  // User Feedback & Evaluation
  userRating: integer('user_rating'), // 1-5 stars
  userFeedback: text('user_feedback'),
  wasUsefulFlag: boolean('was_useful_flag'),
  improvementSuggestions: text('improvement_suggestions'),

  // A/B Testing & Comparison
  isABTest: boolean('is_ab_test').default(false),
  comparisonJobs: text('comparison_jobs').array(), // Other enhancement job IDs
  preferredResult: varchar('preferred_result'), // This job ID or comparison job ID

  // Batch Processing
  isBatchJob: boolean('is_batch_job').default(false),
  batchId: varchar('batch_id'),
  batchPosition: integer('batch_position'),
  batchTotal: integer('batch_total'),

  // Version Control
  version: integer('version').default(1),
  parentJobId: varchar('parent_job_id'), // If this is a revision/improvement
  isLatestVersion: boolean('is_latest_version').default(true),

  // Client Approval Process
  requiresClientApproval: boolean('requires_client_approval').default(false),
  clientApprovalStatus: varchar('client_approval_status').$type<
    'pending' | 'approved' | 'rejected' | 'needs_revision'
  >(),
  clientFeedback: text('client_feedback'),
  clientListenCount: integer('client_listen_count').default(0),

  // Delivery & Export
  isDelivered: boolean('is_delivered').default(false),
  deliveredAt: timestamp('delivered_at'),
  deliveryFormat: varchar('delivery_format'),
  downloadCount: integer('download_count').default(0),

  // Archive & Cleanup
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at'),
  autoCleanupDate: timestamp('auto_cleanup_date'),

  // Notifications
  notificationsEnabled: boolean('notifications_enabled').default(true),
  notificationsSent: jsonb('notifications_sent').$type<
    Array<{
      type: string;
      sentAt: string;
      recipient: string;
    }>
  >(),

  // Cost Tracking
  processingCost: decimal('processing_cost', { precision: 8, scale: 4 }), // For cloud processing
  computeCreditsUsed: integer('compute_credits_used'),

  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 10. USER ACTIVITY LOGS SYSTEM
export const userActivityLogs = pgTable('user_activity_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  // Activity Classification
  activityType: varchar('activity_type')
    .$type<
      | 'login'
      | 'logout'
      | 'project_create'
      | 'project_edit'
      | 'project_delete'
      | 'file_upload'
      | 'file_download'
      | 'file_edit'
      | 'client_contact'
      | 'payment_process'
      | 'settings_change'
      | 'integration_connect'
      | 'integration_disconnect'
      | 'enhancement_run'
      | 'backup_create'
      | 'backup_restore'
      | 'export_data'
      | 'import_data'
      | 'user_invite'
      | 'password_change'
      | 'api_call'
      | 'error_encounter'
      | 'feature_use'
      | 'tutorial_complete'
      | 'subscription_change'
    >()
    .notNull(),

  category: varchar('category')
    .$type<
      | 'authentication'
      | 'project_management'
      | 'file_management'
      | 'client_relations'
      | 'financial'
      | 'system_settings'
      | 'integrations'
      | 'ai_processing'
      | 'data_management'
      | 'collaboration'
      | 'security'
      | 'learning'
      | 'subscription'
    >()
    .notNull(),

  // Activity Details
  action: varchar('action').notNull(), // Specific action taken
  description: text('description'),
  targetType: varchar('target_type'), // project, file, client, setting, etc.
  targetId: varchar('target_id'), // ID of the target object
  targetName: varchar('target_name'), // Human-readable name

  // Context Information
  sessionId: varchar('session_id'),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
  platform: varchar('platform'), // web, mobile, api, etc.
  device: varchar('device'), // desktop, mobile, tablet
  browser: varchar('browser'),
  operatingSystem: varchar('operating_system'),

  // Geographic Information
  country: varchar('country'),
  region: varchar('region'),
  city: varchar('city'),
  timezone: varchar('timezone'),

  // Activity Metadata
  metadata: jsonb('metadata').$type<{
    // File-related metadata
    fileType?: string;
    fileSize?: number;
    fileName?: string;

    // Project-related metadata
    projectType?: string;
    projectStage?: string;

    // Enhancement-related metadata
    enhancementType?: string;
    processingTime?: number;

    // Client-related metadata
    clientId?: string;
    communicationType?: string;

    // Settings-related metadata
    settingCategory?: string;
    oldValue?: any;
    newValue?: any;

    // Integration-related metadata
    integrationType?: string;
    integrationStatus?: string;

    // Error-related metadata
    errorCode?: string;
    errorMessage?: string;
    stackTrace?: string;

    // Performance metadata
    responseTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;

    // Custom metadata
    customData?: Record<string, any>;
  }>(),

  // Success & Error Tracking
  isSuccessful: boolean('is_successful').default(true),
  errorMessage: text('error_message'),
  errorCode: varchar('error_code'),
  errorCategory: varchar('error_category'),

  // Performance Metrics
  duration: integer('duration'), // milliseconds
  responseTime: integer('response_time'), // milliseconds
  resourcesUsed: jsonb('resources_used').$type<{
    cpuTime?: number;
    memoryPeak?: number;
    diskIO?: number;
    networkIO?: number;
    apiCalls?: number;
  }>(),

  // Business Impact
  businessValue: decimal('business_value', { precision: 10, scale: 2 }), // Estimated value/cost
  impactLevel: varchar('impact_level')
    .$type<'low' | 'medium' | 'high' | 'critical'>()
    .default('low'),
  affectedUsers: integer('affected_users').default(1),

  // Feature Usage Analytics
  featurePath: varchar('feature_path'), // navigation path to feature
  featureFlag: varchar('feature_flag'), // if feature was behind a flag
  isNewFeature: boolean('is_new_feature').default(false),
  isExperimentalFeature: boolean('is_experimental_feature').default(false),

  // A/B Testing & Experiments
  experimentId: varchar('experiment_id'),
  variantId: varchar('variant_id'),
  experimentStage: varchar('experiment_stage'),

  // Referrer & Attribution
  referrer: text('referrer'),
  utmSource: varchar('utm_source'),
  utmMedium: varchar('utm_medium'),
  utmCampaign: varchar('utm_campaign'),
  utmContent: varchar('utm_content'),
  utmTerm: varchar('utm_term'),

  // Privacy & Compliance
  isAnonymized: boolean('is_anonymized').default(false),
  gdprCompliant: boolean('gdpr_compliant').default(true),
  retentionPeriod: integer('retention_period').default(730), // days
  scheduledDeletion: timestamp('scheduled_deletion'),

  // Data Quality
  dataVersion: varchar('data_version').default('1.0'),
  dataSource: varchar('data_source'), // frontend, backend, api, etc.
  isVerified: boolean('is_verified').default(true),

  // Aggregation Helpers
  dayOfWeek: integer('day_of_week'), // 0-6 (Sunday-Saturday)
  hourOfDay: integer('hour_of_day'), // 0-23
  isWeekend: boolean('is_weekend'),
  isBusinessHours: boolean('is_business_hours'),

  // Related Activities
  parentActivityId: varchar('parent_activity_id'), // If this is a sub-activity
  childActivities: text('child_activities').array(), // IDs of related sub-activities
  correlationId: varchar('correlation_id'), // To group related activities

  // Client & Professional Context
  profession: varchar('profession').$type<
    'photographer' | 'videographer' | 'music_producer' | 'vendor'
  >(),
  businessContext: varchar('business_context'), // personal, business, collaboration
  clientVisible: boolean('client_visible').default(false), // If activity affects client experience

  // Security & Audit
  securityLevel: varchar('security_level')
    .$type<'low' | 'medium' | 'high' | 'critical'>()
    .default('low'),
  requiresAudit: boolean('requires_audit').default(false),
  auditCategory: varchar('audit_category'),
  complianceFlags: text('compliance_flags').array(),

  // Notification & Alerting
  triggeredAlerts: text('triggered_alerts').array(),
  notificationsSent: boolean('notifications_sent').default(false),
  alertLevel: varchar('alert_level').$type<'info' | 'warning' | 'error' | 'critical'>(),

  // Machine Learning Features
  anomalyScore: decimal('anomaly_score', { precision: 5, scale: 4 }), // 0.0000-1.0000
  isAnomalous: boolean('is_anomalous').default(false),
  riskScore: decimal('risk_score', { precision: 5, scale: 4 }),
  predictedOutcome: varchar('predicted_outcome'),

  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

// 11. BUSINESS METRICS SYSTEM
export const cmsPages = pgTable('cms_pages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id),

  // Page Identification
  title: varchar('title').notNull(),
  slug: varchar('slug').notNull().unique(),
  path: varchar('path').notNull(), // Full URL path
  pageType: varchar('page_type')
    .$type<
      | 'landing'
      | 'portfolio'
      | 'about'
      | 'services'
      | 'contact'
      | 'blog'
      | 'gallery'
      | 'pricing'
      | 'testimonials'
      | 'custom'
    >()
    .notNull(),

  // Content Management
  content: jsonb('content')
    .$type<{
      blocks: Array<{
        id: string;
        type:
          | 'text'
          | 'image'
          | 'video'
          | 'gallery'
          | 'form'
          | 'testimonial'
          | 'pricing'
          | 'call_to_action'
          | 'separator'
          | 'code'
          | 'embed';
        data: {
          // Text block
          text?: string;
          heading?: string;
          alignment?: 'left' | 'center' | 'right' | 'justify';

          // Image block
          imageUrl?: string;
          alt?: string;
          caption?: string;
          width?: number;
          height?: number;

          // Video block
          videoUrl?: string;
          videoType?: 'youtube' | 'vimeo' | 'direct';
          autoplay?: boolean;
          controls?: boolean;

          // Gallery block
          images?: Array<{
            url: string;
            alt: string;
            caption?: string;
          }>;
          layout?: 'grid' | 'masonry' | 'carousel';

          // Form block
          formId?: string;
          formType?: 'contact' | 'quote' | 'booking' | 'newsletter';

          // Custom styling
          backgroundColor?: string;
          textColor?: string;
          padding?: string;
          margin?: string;
          borderRadius?: string;
          customCSS?: string;
        };
        order: number;
        isVisible: boolean;
        updatedAt: string;
      }>;

      // Page settings
      settings: {
        layout: 'full-width' | 'container' | 'sidebar';
        template: string;
        backgroundImage?: string;
        backgroundColor?: string;
        customCSS?: string;
        customJS?: string;
      };
    }>()
    .notNull(),

  // SEO & Meta Information
  metaTitle: varchar('meta_title'),
  metaDescription: text('meta_description'),
  metaKeywords: text('meta_keywords').array(),
  ogTitle: varchar('og_title'),
  ogDescription: text('og_description'),
  ogImage: varchar('og_image'),
  canonicalUrl: varchar('canonical_url'),

  // Professional Context
  profession: varchar('profession').$type<
    'photographer' | 'videographer' | 'music_producer' | 'vendor'
  >(),
  targetAudience: varchar('target_audience').$type<
    'couples' | 'businesses' | 'individuals' | 'artists' | 'agencies' | 'general'
  >(),
  serviceCategory: varchar('service_category'), // wedding, portrait, commercial, etc.

  // Publishing & Status
  status: varchar('status')
    .$type<'draft' | 'review' | 'scheduled' | 'published' | 'archived'>()
    .default('draft'),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),
  scheduledPublishAt: timestamp('scheduled_publish_at'),

  // Access Control & Visibility
  visibility: varchar('visibility')
    .$type<'public' | 'private' | 'password_protected' | 'members_only'>()
    .default('public'),
  password: varchar('password'), // For password-protected pages
  allowedUserRoles: text('allowed_user_roles').array(),

  // Language & Localization
  language: varchar('language').default('no'),
  translationOf: varchar('translation_of'), // Parent page ID if this is a translation
  availableLanguages: text('available_languages').array(),

  // Design & Styling
  theme: varchar('theme').default('modern'),
  colorScheme: varchar('color_scheme')
    .$type<'light' | 'dark' | 'auto' | 'custom'>()
    .default('light'),
  customColors: jsonb('custom_colors').$type<{
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    border?: string;
  }>(),

  typography: jsonb('typography').$type<{
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
    fontWeight?: string;
    headingFont?: string;
  }>(),

  // Layout & Structure
  layout: varchar('layout').default('default'),
  sidebar: jsonb('sidebar').$type<{
    enabled: boolean;
    position: 'left' | 'right';
    width: string;
    content: any[];
  }>(),

  header: jsonb('header').$type<{
    enabled: boolean;
    style: 'default' | 'minimal' | 'bold' | 'transparent';
    navigation: any[];
    logo?: string;
    contactInfo?: any;
  }>(),

  footer: jsonb('footer').$type<{
    enabled: boolean;
    style: 'default' | 'minimal' | 'contact' | 'social';
    content: any[];
    socialLinks?: any[];
    copyrightText?: string;
  }>(),

  // Performance & Optimization
  loadTime: integer('load_time'), // milliseconds
  seoScore: integer('seo_score'), // 0-100
  performanceScore: integer('performance_score'), // 0-100
  mobileOptimized: boolean('mobile_optimized').default(true),

  // Analytics & Tracking
  viewCount: integer('view_count').default(0),
  uniqueViews: integer('unique_views').default(0),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }),
  averageTimeOnPage: integer('average_time_on_page'), // seconds
  conversionRate: decimal('conversion_rate', { precision: 5, case: 2 }),

  // Google Analytics Integration
  googleAnalyticsId: varchar('google_analytics_id'),
  trackingEnabled: boolean('tracking_enabled').default(true),
  customTrackingCode: text('custom_tracking_code'),

  // Form Integration
  contactFormEnabled: boolean('contact_form_enabled').default(false),
  contactFormId: varchar('contact_form_id'),
  quoteFormEnabled: boolean('quote_form_enabled').default(false),
  bookingFormEnabled: boolean('booking_form_enabled').default(false),

  // Social Integration
  socialShareEnabled: boolean('social_share_enabled').default(true),
  socialPlatforms: text('social_platforms').array(),
  instagramFeed: jsonb('instagram_feed').$type<{
    enabled: boolean;
    accessToken: string;
    postCount: number;
    hashtags: string[];
  }>(),

  // Portfolio Integration
  portfolioEnabled: boolean('portfolio_enabled').default(false),
  showcaseCategories: text('showcase_categories').array(),
  showcaseLayout: varchar('showcase_layout').$type<'grid' | 'masonry' | 'carousel' | 'list'>(),
  showcaseItemsPerPage: integer('showcase_items_per_page').default(12),

  // Backup & Recovery
  hasBackup: boolean('has_backup').default(true),
  lastBackupAt: timestamp('last_backup_at'),
  backupFrequency: varchar('backup_frequency').default('daily'),

  // Comments & Interaction
  commentsEnabled: boolean('comments_enabled').default(false),
  moderationRequired: boolean('moderation_required').default(true),
  allowGuestComments: boolean('allow_guest_comments').default(false),

  // E-commerce Integration (for vendors)
  ecommerceEnabled: boolean('ecommerce_enabled').default(false),
  stripeIntegration: jsonb('stripe_integration').$type<{
    enabled: boolean;
    publicKey: string;
    currency: string;
    products: any[];
  }>(),

  // Norwegian Business Integration
  norwegianFeatures: jsonb('norwegian_features').$type<{
    brregIntegration?: boolean;
    mvaDisplay?: boolean;
    norwegianAddressFormat?: boolean;
    holidayAwareness?: boolean;
    localContactInfo?: {
      phone: string;
      address: string;
      postalCode: string;
      city: string;
    };
  }>(),

  // Version Control
  version: integer('version').default(1),
  parentPageId: varchar('parent_page_id'), // For page hierarchy
  childPages: text('child_pages').array(),
  isTemplate: boolean('is_template').default(false),
  templateCategory: varchar('template_category'),

  // Collaboration
  createdBy: varchar('created_by').notNull(),
  lastEditedBy: varchar('last_edited_by'),
  collaborators: jsonb('collaborators').$type<
    Array<{
      userId: string;
      role: 'editor' | 'reviewer' | 'viewer';
      permissions: string[];
    }>
  >(),

  // Review & Approval Process
  reviewStatus: varchar('review_status').$type<
    'pending' | 'in_review' | 'approved' | 'needs_changes' | 'rejected'
  >(),
  reviewNotes: text('review_notes'),
  reviewedBy: varchar('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),

  // Compliance & Legal
  gdprCompliant: boolean('gdpr_compliant').default(true),
  privacyPolicyLinked: boolean('privacy_policy_linked').default(false),
  cookieConsentEnabled: boolean('cookie_consent_enabled').default(true),
  accessibilityCompliant: boolean('accessibility_compliant').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastPublished: timestamp('last_published'),
});

// 13. CMS HISTORY SYSTEM
export const cmsHistory = pgTable('cms_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  pageId: varchar('page_id')
    .references(() => cmsPages.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  // Version Information
  version: integer('version').notNull(),
  versionName: varchar('version_name'),
  isMinorEdit: boolean('is_minor_edit').default(false),
  changeType: varchar('change_type')
    .$type<
      | 'create'
      | 'edit'
      | 'publish'
      | 'unpublish'
      | 'delete'
      | 'restore'
      | 'duplicate'
      | 'template_apply'
      | 'bulk_edit'
    >()
    .notNull(),

  // Change Details
  changeDescription: text('change_description'),
  changeReason: text('change_reason'),
  changeSummary: varchar('change_summary'),

  // Content Snapshot
  contentSnapshot: jsonb('content_snapshot').notNull(), // Full page content at this version
  metadataSnapshot: jsonb('metadata_snapshot').$type<{
    title: string;
    slug: string;
    metaTitle?: string;
    metaDescription?: string;
    status: string;
    visibility: string;
    publishedAt?: string;
    theme: string;
    language: string;
  }>(),

  // Detailed Change Tracking
  changedFields: text('changed_fields').array(),
  fieldChanges: jsonb('field_changes').$type<
    Array<{
      field: string;
      oldValue: any;
      newValue: any;
      changeType: 'added' | 'modified' | 'removed';
    }>
  >(),

  // Block-level Changes
  blockChanges: jsonb('block_changes').$type<
    Array<{
      blockId: string;
      action: 'added' | 'modified' | 'removed' | 'moved' | 'duplicated';
      blockType: string;
      oldData?: any;
      newData?: any;
      oldPosition?: number;
      newPosition?: number;
    }>
  >(),

  // Publishing History
  publishingAction: varchar('publishing_action').$type<
    'draft_save' | 'publish' | 'unpublish' | 'schedule' | 'unschedule'
  >(),
  wasPublished: boolean('was_published').default(false),
  publishedFrom: varchar('published_from'), // draft, scheduled, etc.
  publishedTo: varchar('published_to'), // public, private, etc.

  // User & Session Context
  sessionId: varchar('session_id'),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
  platform: varchar('platform'), // web, mobile, api

  // Collaboration Context
  editMode: varchar('edit_mode').$type<'single' | 'collaborative' | 'review' | 'bulk'>(),
  collaborativeSession: varchar('collaborative_session'),
  conflictResolution: jsonb('conflict_resolution').$type<{
    hadConflicts: boolean;
    conflictedFields: string[];
    resolutionMethod: 'user_choice' | 'auto_merge' | 'override';
    resolvedBy: string;
  }>(),

  // Review & Approval Context
  reviewWorkflow: jsonb('review_workflow').$type<{
    isPartOfReview: boolean;
    reviewId?: string;
    reviewStage?: string;
    approvalRequired?: boolean;
    approvedBy?: string;
    rejectedBy?: string;
    reviewComments?: string;
  }>(),

  // Quality & Validation
  validationResults: jsonb('validation_results').$type<{
    isValid: boolean;
    errors: Array<{
      field: string;
      error: string;
      severity: 'error' | 'warning' | 'info';
    }>;
    warnings: string[];
    seoScore?: number;
    accessibilityScore?: number;
  }>(),

  // Performance Impact
  performanceImpact: jsonb('performance_impact').$type<{
    sizeDelta: number; // Change in content size (bytes)
    loadTimeDelta: number; // Change in load time (ms)
    seoScoreDelta: number; // Change in SEO score
    imageCount: number;
    linkCount: number;
  }>(),

  // Backup & Recovery
  isRestorePoint: boolean('is_restore_point').default(false),
  canRestoreTo: boolean('can_restore_to').default(true),
  restoredFrom: varchar('restored_from'), // Version ID if this was a restoration
  backupLocation: varchar('backup_location'),

  // Auto-save & Draft Management
  isAutoSave: boolean('is_auto_save').default(false),
  autoSaveInterval: integer('auto_save_interval'), // seconds
  isDraftSave: boolean('is_draft_save').default(false),
  draftExpiresAt: timestamp('draft_expires_at'),

  // Bulk Operations
  isBulkOperation: boolean('is_bulk_operation').default(false),
  bulkOperationId: varchar('bulk_operation_id'),
  bulkOperationType: varchar('bulk_operation_type'),
  affectedPages: text('affected_pages').array(),

  // Integration & Import/Export
  importSource: varchar('import_source'), // wordpress, wix, squarespace, etc.
  exportFormat: varchar('export_format'), // json, html, pdf, etc.
  integrationSync: jsonb('integration_sync').$type<{
    syncedFrom?: string;
    syncedTo?: string;
    syncStatus?: 'success' | 'partial' | 'failed';
    syncErrors?: string[];
  }>(),

  // A/B Testing & Experiments
  isExperiment: boolean('is_experiment').default(false),
  experimentId: varchar('experiment_id'),
  variantName: varchar('variant_name'),
  testResults: jsonb('test_results').$type<{
    conversionRate?: number;
    engagementScore?: number;
    performanceScore?: number;
    userFeedback?: any[];
  }>(),

  // Comments & Annotations
  editorComments: jsonb('editor_comments').$type<
    Array<{
      comment: string;
      timestamp: string;
      userId: string;
      resolved: boolean;
      context?: string; // Which part of the page the comment refers to
    }>
  >(),

  internalNotes: text('internal_notes'),
  changelogEntry: text('changelog_entry'),

  // Migration & Legacy Support
  migratedFrom: varchar('migrated_from'), // Old system/version
  migrationNotes: text('migration_notes'),
  legacyData: jsonb('legacy_data'), // Any data from old systems

  // Compliance & Audit
  gdprCompliant: boolean('gdpr_compliant').default(true),
  auditRequired: boolean('audit_required').default(false),
  complianceChecks: jsonb('compliance_checks').$type<
    Array<{
      check: string;
      passed: boolean;
      details?: string;
    }>
  >(),

  // Media & Asset Changes
  mediaChanges: jsonb('media_changes').$type<
    Array<{
      type: 'image' | 'video' | 'audio' | 'document';
      action: 'added' | 'removed' | 'replaced' | 'optimized';
      filename: string;
      url?: string;
      oldUrl?: string;
      fileSize?: number;
    }>
  >(),

  // SEO Impact Tracking
  seoChanges: jsonb('seo_changes').$type<{
    titleChanged: boolean;
    metaDescriptionChanged: boolean;
    keywordsChanged: boolean;
    urlChanged: boolean;
    structuralChanges: boolean;
    estimatedImpact: 'positive' | 'neutral' | 'negative';
  }>(),

  // Dependencies & Related Changes
  dependentPages: text('dependent_pages').array(), // Pages that might be affected
  relatedChanges: text('related_changes').array(), // Related history entries
  triggeredUpdates: text('triggered_updates').array(), // What this change triggered

  createdAt: timestamp('created_at').defaultNow(),
  archivedAt: timestamp('archived_at'),
});

// 14. CMS COMPONENTS SYSTEM
export const cmsComponents = pgTable('cms_components', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').references(() => users.id),

  // Component Identification
  name: varchar('name').notNull(),
  displayName: varchar('display_name').notNull(),
  description: text('description'),
  componentType: varchar('component_type')
    .$type<
      | 'text'
      | 'image'
      | 'video'
      | 'gallery'
      | 'form'
      | 'testimonial'
      | 'pricing'
      | 'call_to_action'
      | 'navigation'
      | 'footer'
      | 'header'
      | 'sidebar'
      | 'hero'
      | 'features'
      | 'about'
      | 'contact'
      | 'portfolio'
      | 'blog'
      | 'custom'
    >()
    .notNull(),

  // Component Category & Organization
  category: varchar('category')
    .$type<
      | 'content'
      | 'layout'
      | 'navigation'
      | 'media'
      | 'form'
      | 'social'
      | 'ecommerce'
      | 'seo'
      | 'analytics'
      | 'integration'
      | 'custom'
    >()
    .notNull(),
  subcategory: varchar('subcategory'),
  tags: text('tags').array(),

  // Professional Context
  profession: varchar('profession').$type<
    'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'universal'
  >(),
  targetUseCase: varchar('target_use_case').$type<
    | 'wedding'
    | 'portrait'
    | 'commercial'
    | 'business'
    | 'portfolio'
    | 'landing'
    | 'gallery'
    | 'universal'
  >(),

  // Component Definition
  componentSchema: jsonb('component_schema')
    .$type<{
      // Basic component structure
      type: string;
      version: string;

      // Default configuration
      defaultProps: Record<string, any>;

      // Configurable properties
      properties: Array<{
        name: string;
        type:
          | 'text'
          | 'number'
          | 'boolean'
          | 'color'
          | 'image'
          | 'select'
          | 'multiselect'
          | 'textarea'
          | 'rich_text'
          | 'url'
          | 'email'
          | 'phone'
          | 'date'
          | 'time'
          | 'json';
        label: string;
        description?: string;
        required: boolean;
        defaultValue?: any;
        options?: Array<{ label: string; value: any }>;
        validation?: {
          min?: number;
          max?: number;
          pattern?: string;
          customRules?: string[];
        };
        group?: string; // For organizing properties in UI
      }>;

      // Styling options
      styling: {
        allowCustomCSS: boolean;
        predefinedStyles: Array<{
          name: string;
          label: string;
          css: string;
          preview?: string;
        }>;
        colorOptions: string[];
        fontOptions: string[];
        spacingOptions: string[];
      };

      // Layout constraints
      layout: {
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
        allowFullWidth: boolean;
        aspectRatio?: string;
        gridColumns?: number;
      };

      // Content constraints
      content: {
        allowRichText: boolean;
        allowImages: boolean;
        allowVideos: boolean;
        allowEmbeds: boolean;
        maxTextLength?: number;
        maxImages?: number;
        allowedFileTypes?: string[];
        maxFileSize?: number; // MB
      };
    }>()
    .notNull(),

  // Template & Rendering
  template: text('template').notNull(), // HTML/JSX template
  styles: text('styles'), // CSS styles
  script: text('script'), // JavaScript behavior

  // React/Vue Component Code (for advanced components)
  componentCode: text('component_code'), // Full component implementation
  dependencies: text('dependencies').array(), // Required libraries/dependencies

  // Preview & Documentation
  previewImage: varchar('preview_image'),
  previewUrl: varchar('preview_url'),
  demoData: jsonb('demo_data'), // Sample data for preview
  documentation: text('documentation'),
  usageInstructions: text('usage_instructions'),

  // Responsive Design
  responsiveConfig: jsonb('responsive_config').$type<{
    mobile: {
      template?: string;
      styles?: string;
      hideOnMobile?: boolean;
      reorderOnMobile?: number;
    };
    tablet: {
      template?: string;
      styles?: string;
      hideOnTablet?: boolean;
      reorderOnTablet?: number;
    };
    desktop: {
      template?: string;
      styles?: string;
    };
  }>(),

  // Performance & Optimization
  isLazyLoaded: boolean('is_lazy_loaded').default(false),
  cacheability: varchar('cacheability')
    .$type<'none' | 'short' | 'medium' | 'long' | 'permanent'>()
    .default('medium'),
  performanceImpact: varchar('performance_impact')
    .$type<'minimal' | 'low' | 'medium' | 'high'>()
    .default('low'),
  loadPriority: varchar('load_priority')
    .$type<'critical' | 'high' | 'normal' | 'low'>()
    .default('normal'),

  // SEO & Accessibility
  seoFriendly: boolean('seo_friendly').default(true),
  accessibilityCompliant: boolean('accessibility_compliant').default(true),
  semanticHTML: boolean('semantic_html').default(true),
  keyboardNavigable: boolean('keyboard_navigable').default(true),
  screenReaderFriendly: boolean('screen_reader_friendly').default(true),

  // Integration Capabilities
  integrations: jsonb('integrations').$type<
    Array<{
      type:
        | 'google_analytics'
        | 'google_forms'
        | 'stripe'
        | 'mailchimp'
        | 'instagram'
        | 'youtube'
        | 'custom';
      required: boolean;
      configurable: boolean;
      apiEndpoint?: string;
      authRequired?: boolean;
    }>
  >(),

  // Form-specific (if component is a form)
  formConfig: jsonb('form_config').$type<{
    fields: Array<{
      name: string;
      type: string;
      label: string;
      required: boolean;
      validation?: any;
    }>;
    submitAction: 'email' | 'database' | 'webhook' | 'custom';
    submitEndpoint?: string;
    confirmationMessage?: string;
    redirectUrl?: string;
    emailNotifications?: {
      enabled: boolean;
      recipients: string[];
      template: string;
    };
  }>(),

  // Portfolio/Gallery-specific
  portfolioConfig: jsonb('portfolio_config').$type<{
    layout: 'grid' | 'masonry' | 'carousel' | 'list';
    itemsPerPage: number;
    categories: string[];
    filtering: boolean;
    sorting: boolean;
    lightbox: boolean;
    autoPlay?: boolean;
    transitionEffect?: string;
  }>(),

  // E-commerce-specific
  ecommerceConfig: jsonb('ecommerce_config').$type<{
    productDisplay: 'single' | 'list' | 'grid';
    showPricing: boolean;
    showDescription: boolean;
    allowCustomization: boolean;
    paymentIntegration: 'stripe' | 'paypal' | 'vipps' | 'custom';
    shippingCalculation: boolean;
    taxCalculation: boolean;
  }>(),

  // Usage & Analytics
  usageCount: integer('usage_count').default(0),
  lastUsed: timestamp('last_used'),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }),
  totalRatings: integer('total_ratings').default(0),

  // Popularity & Performance Metrics
  popularityScore: decimal('popularity_score', {
    precision: 5,
    scale: 2,
  }).default('0'),
  performanceScore: decimal('performance_score', {
    precision: 5,
    scale: 2,
  }).default('100'),
  loadTime: integer('load_time'), // milliseconds
  errorRate: decimal('error_rate', { precision: 5, case: 4 }).default('0'),

  // Version Control & Updates
  version: varchar('version').default('1.0.0'),
  isLatest: boolean('is_latest').default(true),
  parentComponentId: varchar('parent_component_id'), // If this is a variation
  childComponents: text('child_components').array(),
  updateHistory: jsonb('update_history').$type<
    Array<{
      version: string;
      date: string;
      changes: string[];
      breaking: boolean;
    }>
  >(),

  // Publishing & Distribution
  status: varchar('status')
    .$type<'draft' | 'testing' | 'published' | 'deprecated' | 'archived'>()
    .default('draft'),
  isPublic: boolean('is_public').default(false),
  isOfficial: boolean('is_official').default(false), // Official CreatorHub component

  // Sharing & Marketplace
  isShared: boolean('is_shared').default(false),
  sharedWith: text('shared_with').array(), // User IDs
  isMarketplace: boolean('is_marketplace').default(false),
  price: decimal('price', { precision: 8, scale: 2 }), // If component is paid
  currency: varchar('currency').default('NOK'),

  // Quality Assurance
  isTestPassed: boolean('is_test_passed').default(false),
  testResults: jsonb('test_results').$type<{
    performanceTest: boolean;
    accessibilityTest: boolean;
    seoTest: boolean;
    responsiveTest: boolean;
    securityTest: boolean;
    crossBrowserTest: boolean;
  }>(),

  // Security & Validation
  isSafe: boolean('is_safe').default(true),
  securityChecked: boolean('security_checked').default(false),
  allowsUserInput: boolean('allows_user_input').default(false),
  sanitizesInput: boolean('sanitizes_input').default(true),

  // Localization & Internationalization
  supportedLanguages: text('supported_languages').array().default(['no']),
  translations: jsonb('translations').$type<Record<string, Record<string, string>>>(),
  isRTLSupported: boolean('is_rtl_supported').default(false),

  // Norwegian Business Features
  norwegianFeatures: jsonb('norwegian_features').$type<{
    supportsBRREG: boolean;
    supportsMVA: boolean;
    supportsNorwegianAddresses: boolean;
    supportsVipps: boolean;
    gdprCompliant: boolean;
    holidayAware: boolean;
  }>(),

  // Custom Configuration
  customFields: jsonb('custom_fields').$type<Record<string, any>>(),
  advancedSettings: jsonb('advanced_settings').$type<{
    allowAdvancedStyling: boolean;
    allowCustomCode: boolean;
    allowDataBinding: boolean;
    allowConditionalDisplay: boolean;
    allowAnimation: boolean;
    maxInstances?: number;
  }>(),

  // Collaboration & Team
  createdBy: varchar('created_by').notNull(),
  maintainedBy: text('maintained_by').array(),
  contributors: jsonb('contributors').$type<
    Array<{
      userId: string;
      role: 'creator' | 'maintainer' | 'contributor' | 'tester';
      contributions: string[];
    }>
  >(),

  // Support & Documentation
  supportLevel: varchar('support_level')
    .$type<'community' | 'standard' | 'premium' | 'enterprise'>()
    .default('community'),
  documentationUrl: varchar('documentation_url'),
  supportEmail: varchar('support_email'),
  changelogUrl: varchar('changelog_url'),

  // Deprecation & Migration
  isDeprecated: boolean('is_deprecated').default(false),
  deprecatedAt: timestamp('deprecated_at'),
  deprecationReason: text('deprecation_reason'),
  migrationPath: text('migration_path'),
  replacementComponentId: varchar('replacement_component_id'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  publishedAt: timestamp('published_at'),
  lastTestedAt: timestamp('last_tested_at'),
});

// ADDITIONAL ADVANCED SYSTEMS (311 MORE TABLES TO REACH 326 TOTAL)

// 15. PORTFOLIO MANAGEMENT SYSTEM
export const portfolioProjects = pgTable('portfolio_projects', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  title: varchar('title').notNull(),
  description: text('description'),
  category: varchar('category'),
  subcategory: varchar('subcategory'),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),

  coverImage: varchar('cover_image'),
  images: text('images').array(),
  videos: text('videos').array(),
  audioFiles: text('audio_files').array(),

  clientName: varchar('client_name'),
  projectDate: date('project_date'),
  location: varchar('location'),
  equipment: text('equipment').array(),
  techniques: text('techniques').array(),

  tags: text('tags').array(),
  isPublic: boolean('is_public').default(false),
  isFeatured: boolean('is_featured').default(false),
  sortOrder: integer('sort_order').default(0),

  seoTitle: varchar('seo_title'),
  seoDescription: text('seo_description'),
  slug: varchar('slug').unique(),

  viewCount: integer('view_count').default(0),
  likeCount: integer('like_count').default(0),
  shareCount: integer('share_count').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 16. CLIENT FEEDBACK SYSTEM
export const clientFeedbacks = pgTable('client_feedbacks', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),
  clientId: varchar('client_id').notNull(),

  feedbackType: varchar('feedback_type')
    .$type<
      'general' | 'project_review' | 'service_rating' | 'testimonial' | 'complaint' | 'suggestion'
    >()
    .notNull(),
  rating: integer('rating'), // 1-5 stars
  title: varchar('title'),
  content: text('content').notNull(),

  aspectRatings: jsonb('aspect_ratings').$type<{
    communication?: number;
    quality?: number;
    timeliness?: number;
    professionalism?: number;
    value?: number;
    creativity?: number;
  }>(),

  isPublic: boolean('is_public').default(false),
  isTestimonial: boolean('is_testimonial').default(false),
  showOnWebsite: boolean('show_on_website').default(false),

  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email'),
  clientCompany: varchar('client_company'),
  clientPhoto: varchar('client_photo'),

  responseFromProfessional: text('response_from_professional'),
  respondedAt: timestamp('responded_at'),

  status: varchar('status')
    .$type<'pending' | 'approved' | 'rejected' | 'archived'>()
    .default('pending'),
  moderationNotes: text('moderation_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 17-50. COMPREHENSIVE BUSINESS MANAGEMENT SYSTEMS

// 17. INVOICE MANAGEMENT SYSTEM
export const payments = pgTable('payments', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  invoiceId: varchar('invoice_id').references(() => invoices.id),
  projectId: varchar('project_id').references(() => projects.id),

  paymentType: varchar('payment_type')
    .$type<'invoice_payment' | 'deposit' | 'milestone' | 'refund' | 'expense_reimbursement'>()
    .notNull(),
  paymentMethod: varchar('payment_method')
    .$type<'bank_transfer' | 'vipps' | 'stripe' | 'cash' | 'other'>()
    .notNull(),

  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),

  status: varchar('status')
    .$type<'pending' | 'completed' | 'failed' | 'refunded'>()
    .default('pending'),

  transactionId: varchar('transaction_id'),
  externalPaymentId: varchar('external_payment_id'), // Stripe, Vipps etc.

  paymentDate: timestamp('payment_date').notNull(),
  processedAt: timestamp('processed_at'),

  description: text('description'),
  internalNotes: text('internal_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 19. EXPENSE TRACKING SYSTEM
export const expenses = pgTable('expenses', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  expenseType: varchar('expense_type')
    .$type<
      | 'equipment'
      | 'travel'
      | 'software'
      | 'marketing'
      | 'office'
      | 'insurance'
      | 'education'
      | 'other'
    >()
    .notNull(),
  category: varchar('category').notNull(),

  description: text('description').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),

  expenseDate: date('expense_date').notNull(),
  vendor: varchar('vendor'),

  isBusinessExpense: boolean('is_business_expense').default(true),
  isDeductible: boolean('is_deductible').default(true),
  vatAmount: decimal('vat_amount', { precision: 10, scale: 2 }),

  receiptUrl: varchar('receipt_url'),
  receiptNumber: varchar('receipt_number'),

  status: varchar('status')
    .$type<'pending' | 'approved' | 'rejected' | 'reimbursed'>()
    .default('pending'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 20. CALENDAR INTEGRATION SYSTEM
export const calendarEvents = pgTable('calendar_events', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  title: varchar('title').notNull(),
  description: text('description'),

  startDateTime: timestamp('start_date_time').notNull(),
  endDateTime: timestamp('end_date_time').notNull(),
  isAllDay: boolean('is_all_day').default(false),

  eventType: varchar('event_type')
    .$type<'shoot' | 'meeting' | 'deadline' | 'personal' | 'travel' | 'editing' | 'delivery'>()
    .notNull(),

  location: varchar('location'),

  googleCalendarEventId: varchar('google_calendar_event_id'),
  googleMeetUrl: varchar('google_meet_url'),

  attendees: jsonb('attendees').$type<
    Array<{
      email: string;
      name: string;
      status: 'accepted' | 'declined' | 'pending';
    }>
  >(),

  reminders: jsonb('reminders').$type<
    Array<{
      type: 'email' | 'popup';
      minutesBefore: number;
    }>
  >(),

  recurrence: jsonb('recurrence').$type<{
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
    byWeekDay?: string[];
  }>(),

  isPrivate: boolean('is_private').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 21. TASK MANAGEMENT SYSTEM
export const tasks = pgTable('tasks', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  title: varchar('title').notNull(),
  description: text('description'),

  status: varchar('status')
    .$type<'todo' | 'in_progress' | 'completed' | 'cancelled'>()
    .default('todo'),
  priority: varchar('priority').$type<'low' | 'medium' | 'high' | 'urgent'>().default('medium'),

  dueDate: timestamp('due_date'),
  estimatedMinutes: integer('estimated_minutes'),
  actualMinutes: integer('actual_minutes'),

  assignedTo: varchar('assigned_to'),
  tags: text('tags').array(),

  parentTaskId: varchar('parent_task_id').references(() => tasks.id),
  orderIndex: integer('order_index').default(0),

  completedAt: timestamp('completed_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 22. TIME TRACKING SYSTEM
export const timeEntries = pgTable('time_entries', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),
  taskId: varchar('task_id').references(() => tasks.id),

  description: text('description'),

  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // minutes

  isManual: boolean('is_manual').default(false),
  isRunning: boolean('is_running').default(false),

  hourlyRate: decimal('hourly_rate', { precision: 6, scale: 2 }),
  billableAmount: decimal('billable_amount', { precision: 10, scale: 2 }),
  isBillable: boolean('is_billable').default(true),

  category: varchar('category').$type<
    'shooting' | 'editing' | 'admin' | 'travel' | 'meeting' | 'other'
  >(),

  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 23. CONTRACT MANAGEMENT SYSTEM
export const contractTemplates = pgTable('contract_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  name: varchar('name').notNull(),
  description: text('description'),

  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),
  contractType: varchar('contract_type')
    .$type<'wedding' | 'portrait' | 'commercial' | 'event' | 'product' | 'service' | 'general'>()
    .notNull(),

  template: text('template').notNull(), // HTML/Markdown template
  variables: jsonb('variables').$type<
    Array<{
      name: string;
      type: 'text' | 'number' | 'date' | 'boolean';
      label: string;
      required: boolean;
      defaultValue?: any;
    }>
  >(),

  legalCompliance: jsonb('legal_compliance').$type<{
    gdprCompliant: boolean;
    norwegianLaw: boolean;
    lastReviewed: string;
    reviewedBy?: string;
  }>(),

  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 24. GENERATED CONTRACTS
export const generatedContracts = pgTable('generated_contracts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),
  templateId: varchar('template_id')
    .references(() => contractTemplates.id)
    .notNull(),

  contractNumber: varchar('contract_number').notNull().unique(),

  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email'),

  variables: jsonb('variables').notNull(), // Filled template variables
  generatedContent: text('generated_content').notNull(),

  status: varchar('status')
    .$type<'draft' | 'sent' | 'signed' | 'expired' | 'cancelled'>()
    .default('draft'),

  sentAt: timestamp('sent_at'),
  signedAt: timestamp('signed_at'),
  expiresAt: timestamp('expires_at'),

  digitalSignatureUrl: varchar('digital_signature_url'),
  pdfUrl: varchar('pdf_url'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 25. DOCUMENT STORAGE SYSTEM
export const documents = pgTable('documents', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  fileName: varchar('file_name').notNull(),
  originalFileName: varchar('original_file_name').notNull(),
  fileType: varchar('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type').notNull(),

  documentType: varchar('document_type')
    .$type<'contract' | 'invoice' | 'receipt' | 'license' | 'insurance' | 'id' | 'other'>()
    .notNull(),

  url: varchar('url').notNull(),
  thumbnailUrl: varchar('thumbnail_url'),

  isEncrypted: boolean('is_encrypted').default(false),
  accessLevel: varchar('access_level').$type<'private' | 'client' | 'public'>().default('private'),

  tags: text('tags').array(),
  notes: text('notes'),

  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 26. NOTIFICATION SYSTEM
export const notifications = pgTable('notifications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  type: varchar('type')
    .$type<
      | 'project_update'
      | 'payment_received'
      | 'deadline_reminder'
      | 'client_message'
      | 'system_update'
      | 'marketing'
    >()
    .notNull(),
  title: varchar('title').notNull(),
  message: text('message').notNull(),

  priority: varchar('priority').$type<'low' | 'normal' | 'high' | 'urgent'>().default('normal'),

  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),

  actionUrl: varchar('action_url'),
  actionText: varchar('action_text'),

  metadata: jsonb('metadata'),

  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// 27. ADVANCED EMAIL TEMPLATES SYSTEM
export const advancedEmailTemplates = pgTable('advanced_email_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  name: varchar('name').notNull(),
  subject: varchar('subject').notNull(),

  templateType: varchar('template_type')
    .$type<
      | 'welcome'
      | 'quote'
      | 'invoice'
      | 'reminder'
      | 'thank_you'
      | 'follow_up'
      | 'marketing'
      | 'custom'
    >()
    .notNull(),

  htmlContent: text('html_content').notNull(),
  textContent: text('text_content'),

  variables: jsonb('variables').$type<
    Array<{
      name: string;
      label: string;
      type: 'text' | 'number' | 'date';
      required: boolean;
    }>
  >(),

  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false),

  usageCount: integer('usage_count').default(0),
  lastUsed: timestamp('last_used'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 28. EMAIL CAMPAIGNS SYSTEM
export const meetingSessions = pgTable('meeting_sessions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  meetingTitle: varchar('meeting_title').notNull(),
  meetingType: varchar('meeting_type')
    .$type<
      | 'client_consultation'
      | 'project_planning'
      | 'review'
      | 'contract_signing'
      | 'creative_brainstorm'
      | 'technical_setup'
    >()
    .notNull(),

  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // minutes

  participants: jsonb('participants').$type<
    Array<{
      email: string;
      name: string;
      role: 'client' | 'photographer' | 'videographer' | 'assistant' | 'vendor';
      attended: boolean;
      joinedAt?: string;
      leftAt?: string;
    }>
  >(),

  googleMeetUrl: varchar('google_meet_url'),
  recordingUrl: varchar('recording_url'),
  recordingEnabled: boolean('recording_enabled').default(false),

  transcription: text('transcription'),
  aiSummary: text('ai_summary'),
  keyTopics: text('key_topics').array(),
  actionItems: jsonb('action_items').$type<
    Array<{
      item: string;
      assignedTo: string;
      dueDate?: string;
      status: 'pending' | 'completed';
    }>
  >(),

  sentiment: varchar('sentiment').$type<'positive' | 'neutral' | 'negative' | 'mixed'>(),
  clientSatisfaction: integer('client_satisfaction'), // 1-5

  notes: text('notes'),
  internalNotes: text('internal_notes'),

  followUpRequired: boolean('follow_up_required').default(false),
  followUpScheduled: timestamp('follow_up_scheduled'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 51. PROJECT FINANCIAL TRACKING
export const projectFinancials = pgTable('project_financials', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  totalQuotedAmount: decimal('total_quoted_amount', {
    precision: 10,
    scale: 2,
  }).notNull(),
  totalPaidAmount: decimal('total_paid_amount', {
    precision: 10,
    scale: 2,
  }).default('0'),
  outstandingAmount: decimal('outstanding_amount', {
    precision: 10,
    scale: 2,
  }).default('0'),

  costBreakdown: jsonb('cost_breakdown').$type<{
    baseFee: number;
    hourlyRate: number;
    hoursWorked: number;
    equipmentCosts: number;
    travelCosts: number;
    materialCosts: number;
    subcontractorCosts: number;
    editingCosts: number;
    rushOrderSurcharge: number;
    weekendSurcharge: number;
    holidaySurcharge: number;
    additionalServices: Array<{
      name: string;
      cost: number;
      description?: string;
    }>;
  }>(),

  profitMargin: decimal('profit_margin', { precision: 5, scale: 2 }),
  profitAmount: decimal('profit_amount', { precision: 10, scale: 2 }),

  paymentSchedule: jsonb('payment_schedule').$type<
    Array<{
      milestone: string;
      amount: number;
      dueDate: string;
      status: 'pending' | 'paid' | 'overdue';
      paidDate?: string;
      invoiceId?: string;
    }>
  >(),

  vatCalculation: jsonb('vat_calculation').$type<{
    vatRate: number;
    vatAmount: number;
    isVatExempt: boolean;
    exemptionReason?: string;
  }>(),

  discounts: jsonb('discounts').$type<
    Array<{
      type: 'early_bird' | 'loyalty' | 'bulk' | 'referral' | 'seasonal' | 'custom';
      amount: number;
      percentage?: number;
      reason: string;
    }>
  >(),

  revisionCosts: jsonb('revision_costs').$type<
    Array<{
      revisionNumber: number;
      description: string;
      hourlyRate: number;
      hoursSpent: number;
      totalCost: number;
      approved: boolean;
    }>
  >(),

  actualCosts: jsonb('actual_costs').$type<{
    equipmentRental: number;
    transportationCosts: number;
    accommodationCosts: number;
    mealCosts: number;
    assistantFees: number;
    softwareLicenses: number;
    storageAndDelivery: number;
    emergencyCosts: number;
  }>(),

  financialStatus: varchar('financial_status')
    .$type<
      'quoted' | 'deposit_received' | 'partially_paid' | 'fully_paid' | 'overdue' | 'disputed'
    >()
    .default('quoted'),

  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 52. EQUIPMENT RENTAL SYSTEM
export const equipmentRentals = pgTable('equipment_rentals', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  equipmentType: varchar('equipment_type')
    .$type<'camera' | 'lens' | 'lighting' | 'audio' | 'drone' | 'gimbal' | 'accessories'>()
    .notNull(),
  equipmentName: varchar('equipment_name').notNull(),
  brand: varchar('brand'),
  model: varchar('model'),

  rentalCompany: varchar('rental_company').notNull(),
  rentalContact: jsonb('rental_contact').$type<{
    name: string;
    phone: string;
    email: string;
    address?: string;
  }>(),

  rentalStartDate: date('rental_start_date').notNull(),
  rentalEndDate: date('rental_end_date').notNull(),
  actualReturnDate: date('actual_return_date'),

  dailyRate: decimal('daily_rate', { precision: 8, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 8, scale: 2 }).notNull(),
  deposit: decimal('deposit', { precision: 8, scale: 2 }),
  insurance: decimal('insurance', { precision: 8, scale: 2 }),

  rentalAgreementUrl: varchar('rental_agreement_url'),
  receiptUrl: varchar('receipt_url'),

  condition: jsonb('condition').$type<{
    onPickup: string;
    onReturn: string;
    damageNotes?: string;
    photos?: string[];
  }>(),

  status: varchar('status')
    .$type<'booked' | 'picked_up' | 'in_use' | 'returned' | 'damaged' | 'lost'>()
    .default('booked'),

  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 53. LOCATION SCOUTING SYSTEM
export const locationScouts = pgTable('location_scouts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  locationName: varchar('location_name').notNull(),
  address: varchar('address').notNull(),
  coordinates: jsonb('coordinates').$type<{
    latitude: number;
    longitude: number;
  }>(),

  locationType: varchar('location_type')
    .$type<
      | 'indoor'
      | 'outdoor'
      | 'studio'
      | 'church'
      | 'park'
      | 'beach'
      | 'mountain'
      | 'urban'
      | 'historical'
      | 'commercial'
    >()
    .notNull(),

  scoutingDate: date('scouting_date'),
  shootingWindow: jsonb('shooting_window').$type<{
    bestTimeOfDay: string;
    seasonalConsiderations: string[];
    weatherDependency: 'low' | 'medium' | 'high';
  }>(),

  accessibility: jsonb('accessibility').$type<{
    vehicleAccess: boolean;
    walkingDistance: number; // meters
    equipmentCarryRequired: boolean;
    publicTransportAccess: boolean;
    parkingAvailable: boolean;
    wheelchairAccessible: boolean;
  }>(),

  permissions: jsonb('permissions').$type<{
    permissionRequired: boolean;
    contactPerson?: string;
    contactDetails?: string;
    permitCost?: number;
    permitObtained?: boolean;
    permitExpiryDate?: string;
  }>(),

  lightingConditions: jsonb('lighting_conditions').$type<{
    naturalLight: 'excellent' | 'good' | 'fair' | 'poor';
    goldenHour: boolean;
    shadowPatterns: string;
    artificialLightingNeeded: boolean;
    powerAccessAvailable: boolean;
  }>(),

  photos: text('photos').array(),
  notes: text('notes'),
  pros: text('pros').array(),
  cons: text('cons').array(),

  rating: integer('rating'), // 1-5 stars
  recommended: boolean('recommended').default(false),

  cost: decimal('cost', { precision: 8, scale: 2 }),
  costNotes: text('cost_notes'),

  backup: boolean('backup').default(false),
  weatherBackup: boolean('weather_backup').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 54. SHOT LIST SYSTEM
export const shotLists = pgTable('shot_lists', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),

  listName: varchar('list_name').notNull(),
  eventType: varchar('event_type')
    .$type<'wedding' | 'portrait' | 'commercial' | 'event' | 'product' | 'family' | 'corporate'>()
    .notNull(),

  shots: jsonb('shots')
    .$type<
      Array<{
        id: string;
        category: string;
        description: string;
        priority: 'must_have' | 'important' | 'nice_to_have';
        location?: string;
        time?: string;
        participants?: string[];
        equipment?: string[];
        notes?: string;
        completed: boolean;
        fileUrl?: string;
        alternativeShots?: string[];
        clientRequested: boolean;
      }>
    >()
    .notNull(),

  categories: text('categories').array(), // Getting ready, Ceremony, Reception, etc.

  totalShots: integer('total_shots').default(0),
  completedShots: integer('completed_shots').default(0),
  mustHaveShots: integer('must_have_shots').default(0),
  completedMustHave: integer('completed_must_have').default(0),

  clientApprovalRequired: boolean('client_approval_required').default(false),
  clientApproved: boolean('client_approved').default(false),
  clientFeedback: text('client_feedback'),

  printedVersion: boolean('printed_version').default(false),
  digitalVersion: boolean('digital_version').default(true),

  template: varchar('template').$type<
    | 'standard_wedding'
    | 'minimal_wedding'
    | 'comprehensive_wedding'
    | 'portrait_session'
    | 'family_session'
    | 'commercial_standard'
    | 'custom'
  >(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 55. PHOTO EDITING WORKFLOW
export const editingWorkflows = pgTable('editing_workflows', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),

  workflowName: varchar('workflow_name').notNull(),
  workflowType: varchar('workflow_type')
    .$type<
      | 'basic_editing'
      | 'advanced_editing'
      | 'color_grading'
      | 'retouching'
      | 'compositing'
      | 'batch_processing'
    >()
    .notNull(),

  steps: jsonb('steps')
    .$type<
      Array<{
        stepNumber: number;
        stepName: string;
        description: string;
        software: string; // Lightroom, Photoshop, Capture One, etc.
        estimatedTime: number; // minutes
        actualTime?: number;
        status: 'pending' | 'in_progress' | 'completed' | 'skipped';
        notes?: string;
        preset?: string;
        actions?: string[];
      }>
    >()
    .notNull(),

  totalFiles: integer('total_files').notNull(),
  processedFiles: integer('processed_files').default(0),

  batchSettings: jsonb('batch_settings').$type<{
    presetUsed?: string;
    colorGrading?: string;
    exposureAdjustment?: number;
    contrastAdjustment?: number;
    saturationAdjustment?: number;
    sharpening?: string;
    noiseReduction?: string;
    cropSettings?: string;
    outputFormat?: string;
    outputQuality?: number;
  }>(),

  qualityControl: jsonb('quality_control').$type<{
    qcPerformed: boolean;
    qcPassed: boolean;
    qcNotes?: string;
    retouchingRequired?: boolean;
    clientFeedback?: string;
    revisionRequests?: string[];
  }>(),

  status: varchar('status')
    .$type<'planned' | 'in_progress' | 'client_review' | 'revisions' | 'completed' | 'delivered'>()
    .default('planned'),

  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  estimatedCompletion: timestamp('estimated_completion'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 56. CLIENT GALLERIES SYSTEM
export const clientGalleries = pgTable('client_galleries', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),

  galleryName: varchar('gallery_name').notNull(),
  galleryUrl: varchar('gallery_url').notNull().unique(),
  password: varchar('password'),

  galleryType: varchar('gallery_type')
    .$type<'proofing' | 'final_delivery' | 'sneak_peek' | 'full_wedding' | 'selection_gallery'>()
    .notNull(),

  accessSettings: jsonb('access_settings')
    .$type<{
      isPublic: boolean;
      passwordProtected: boolean;
      expiryDate?: string;
      downloadEnabled: boolean;
      rightClickDisabled: boolean;
      printingEnabled: boolean;
      socialSharingEnabled: boolean;
      commentsEnabled: boolean;
      favoritingEnabled: boolean;
    }>()
    .notNull(),

  images: jsonb('images').$type<
    Array<{
      imageId: string;
      filename: string;
      url: string;
      thumbnailUrl: string;
      order: number;
      isSelected: boolean;
      clientFavorited: boolean;
      clientRating?: number;
      clientComments?: string;
      printOrders?: Array<{
        size: string;
        quantity: number;
        orderDate: string;
      }>;
    }>
  >(),

  watermarkSettings: jsonb('watermark_settings').$type<{
    enabled: boolean;
    text?: string;
    logoUrl?: string;
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
    opacity: number;
  }>(),

  deliverySettings: jsonb('delivery_settings').$type<{
    deliveryMethod: 'download' | 'usb' | 'cloud_link' | 'print_delivery';
    maxDownloads?: number;
    downloadExpiryDays?: number;
    compressionLevel?: 'none' | 'web' | 'high_quality' | 'print_quality';
  }>(),

  analytics: jsonb('analytics')
    .$type<{
      totalViews: number;
      uniqueVisitors: number;
      downloadCount: number;
      averageTimeSpent: number;
      topImages: string[];
      deviceBreakdown: Record<string, number>;
    }>()
    .default({
      totalViews: 0,
      uniqueVisitors: 0,
      downloadCount: 0,
      averageTimeSpent: 0,
      topImages: [],
      deviceBreakdown: {},
    }),

  clientFeedback: jsonb('client_feedback').$type<{
    overallRating?: number;
    feedback?: string;
    selectedImages?: string[];
    printRequests?: Array<{
      imageId: string;
      size: string;
      quantity: number;
      specialRequests?: string;
    }>;
  }>(),

  status: varchar('status')
    .$type<'draft' | 'shared' | 'reviewed' | 'approved' | 'delivered' | 'archived'>()
    .default('draft'),

  sharedAt: timestamp('shared_at'),
  lastViewed: timestamp('last_viewed'),
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 57. PRINT ORDER MANAGEMENT
export const printOrders = pgTable('print_orders', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),
  galleryId: varchar('gallery_id').references(() => clientGalleries.id),

  orderNumber: varchar('order_number').notNull().unique(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),

  shippingAddress: jsonb('shipping_address')
    .$type<{
      name: string;
      address: string;
      city: string;
      postalCode: string;
      country: string;
      phone?: string;
    }>()
    .notNull(),

  items: jsonb('items')
    .$type<
      Array<{
        imageId: string;
        imageName: string;
        printSize: string; // 10x15, 20x30, A4, A3, etc.
        paperType: string; // matte, glossy, canvas, metal, etc.
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        specialInstructions?: string;
      }>
    >()
    .notNull(),

  orderTotal: decimal('order_total', { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal('shipping_cost', { precision: 8, scale: 2 }).default('0'),
  tax: decimal('tax', { precision: 8, scale: 2 }).default('0'),
  grandTotal: decimal('grand_total', { precision: 10, scale: 2 }).notNull(),

  printVendor: varchar('print_vendor').notNull(),
  vendorOrderId: varchar('vendor_order_id'),

  status: varchar('status')
    .$type<'pending' | 'confirmed' | 'printing' | 'shipped' | 'delivered' | 'cancelled'>()
    .default('pending'),

  orderDate: timestamp('order_date').defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),

  trackingNumber: varchar('tracking_number'),
  estimatedDelivery: date('estimated_delivery'),

  specialRequests: text('special_requests'),
  internalNotes: text('internal_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 58. VENDOR MANAGEMENT SYSTEM
export const vendors = pgTable('vendors', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  vendorName: varchar('vendor_name').notNull(),
  vendorType: varchar('vendor_type')
    .$type<
      | 'photographer'
      | 'videographer'
      | 'musician'
      | 'florist'
      | 'caterer'
      | 'venue'
      | 'planner'
      | 'transport'
      | 'equipment_rental'
      | 'printing'
      | 'other'
    >()
    .notNull(),

  contactInfo: jsonb('contact_info')
    .$type<{
      primaryContact: string;
      email: string;
      phone: string;
      website?: string;
      address?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
    }>()
    .notNull(),

  services: text('services').array(),
  specializations: text('specializations').array(),

  pricing: jsonb('pricing').$type<{
    hourlyRate?: number;
    dayRate?: number;
    packageRates?: Array<{
      name: string;
      price: number;
      description: string;
    }>;
    currency: string;
    lastUpdated: string;
  }>(),

  businessInfo: jsonb('business_info').$type<{
    businessName?: string;
    orgNumber?: string;
    vatNumber?: string;
    insurance?: boolean;
    licensed?: boolean;
    yearsInBusiness?: number;
  }>(),

  rating: decimal('rating', { precision: 3, scale: 2 }),
  totalProjects: integer('total_projects').default(0),

  reliability: jsonb('reliability').$type<{
    onTimeDelivery: number; // percentage
    qualityScore: number; // 1-5
    communicationScore: number; // 1-5
    professionalism: number; // 1-5
  }>(),

  portfolio: text('portfolio').array(), // URLs to portfolio pieces

  availability: jsonb('availability').$type<{
    weekdays: boolean;
    weekends: boolean;
    holidays: boolean;
    shortNotice: boolean;
    travelWillingness: string;
    maxDistance: number; // km
  }>(),

  paymentTerms: varchar('payment_terms').default('30 days'),

  notes: text('notes'),
  privateNotes: text('private_notes'),

  status: varchar('status')
    .$type<'active' | 'inactive' | 'preferred' | 'blacklisted'>()
    .default('active'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 59. SUBCONTRACTOR PROJECTS
export const subcontractorProjects = pgTable('subcontractor_projects', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),
  vendorId: varchar('vendor_id')
    .references(() => vendors.id)
    .notNull(),

  role: varchar('role')
    .$type<'second_photographer' | 'videographer' | 'assistant' | 'editor' | 'specialist'>()
    .notNull(),

  contractDetails: jsonb('contract_details').$type<{
    contractSigned: boolean;
    contractUrl?: string;
    hourlyRate?: number;
    flatFee?: number;
    paymentTerms: string;
    deliverables: string[];
    deadlines: Array<{
      deliverable: string;
      deadline: string;
    }>;
  }>(),

  workSchedule: jsonb('work_schedule').$type<
    Array<{
      date: string;
      startTime: string;
      endTime: string;
      location: string;
      tasks: string[];
    }>
  >(),

  deliveredWork: jsonb('delivered_work').$type<
    Array<{
      deliverable: string;
      deliveredAt: string;
      status: 'pending' | 'approved' | 'needs_revision';
      feedback?: string;
      fileUrls?: string[];
    }>
  >(),

  performance: jsonb('performance').$type<{
    punctuality: number; // 1-5
    quality: number; // 1-5
    communication: number; // 1-5
    overall: number; // 1-5
    feedback: string;
    wouldHireAgain: boolean;
  }>(),

  payment: jsonb('payment').$type<{
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    paymentSchedule: Array<{
      milestone: string;
      amount: number;
      dueDate: string;
      status: 'pending' | 'paid';
    }>;
  }>(),

  status: varchar('status')
    .$type<'planned' | 'contracted' | 'in_progress' | 'completed' | 'cancelled'>()
    .default('planned'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 60. WEATHER TRACKING FOR SHOOTS
export const weatherData = pgTable('weather_data', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: varchar('project_id')
    .references(() => projects.id)
    .notNull(),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  location: varchar('location').notNull(),
  coordinates: jsonb('coordinates').$type<{
    latitude: number;
    longitude: number;
  }>(),

  forecastDate: date('forecast_date').notNull(),
  actualDate: date('actual_date'),

  forecast: jsonb('forecast').$type<{
    condition: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    cloudCover: number; // percentage
    precipitationProbability: number; // percentage
    uvIndex: number;
    sunrise: string;
    sunset: string;
    goldenHourStart: string;
    goldenHourEnd: string;
    blueHourStart: string;
    blueHourEnd: string;
  }>(),

  actualWeather: jsonb('actual_weather').$type<{
    condition: string;
    temperature: number;
    humidity: number;
    windSpeed: number;
    cloudCover: number;
    precipitation: number;
    uvIndex: number;
    visibility: number;
  }>(),

  photographyImpact: jsonb('photography_impact').$type<{
    lightingQuality: 'excellent' | 'good' | 'fair' | 'poor';
    shadowHarshness: 'soft' | 'moderate' | 'harsh';
    colorSaturation: 'high' | 'medium' | 'low';
    contrastLevels: 'high' | 'medium' | 'low';
    overallConditions: 'ideal' | 'good' | 'challenging' | 'difficult';
    recommendedSettings?: {
      iso: string;
      aperture: string;
      filters: string[];
    };
  }>(),

  backupPlan: jsonb('backup_plan').$type<{
    required: boolean;
    indoorAlternative?: string;
    postponeOption?: boolean;
    equipmentChanges?: string[];
    notes?: string;
  }>(),

  weatherSource: varchar('weather_source').default('yr.no'), // Norwegian weather service
  lastUpdated: timestamp('last_updated').defaultNow(),

  createdAt: timestamp('created_at').defaultNow(),
});

// 61-100. CONTINUING WITH SPECIALIZED SYSTEMS...

// 61. DRONE FLIGHT LOGS (for licensed drone operations)
export const droneFlightLogs = pgTable('drone_flight_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  flightDate: date('flight_date').notNull(),
  pilotName: varchar('pilot_name').notNull(),
  pilotLicense: varchar('pilot_license'),

  droneModel: varchar('drone_model').notNull(),
  droneSerial: varchar('drone_serial').notNull(),
  batteryUsed: text('battery_used').array(),

  flightLocation: varchar('flight_location').notNull(),
  coordinates: jsonb('coordinates').$type<{
    takeoffLat: number;
    takeoffLng: number;
    maxDistanceLat: number;
    maxDistanceLng: number;
  }>(),

  flightPurpose: varchar('flight_purpose')
    .$type<
      'wedding_video' | 'real_estate' | 'commercial' | 'inspection' | 'mapping' | 'recreational'
    >()
    .notNull(),

  permissionStatus: jsonb('permission_status').$type<{
    airspaceClass: string;
    permissionRequired: boolean;
    permissionObtained: boolean;
    permissionNumber?: string;
    restrictedZone: boolean;
  }>(),

  flightDetails: jsonb('flight_details').$type<{
    startTime: string;
    endTime: string;
    maxAltitude: number; // meters
    maxDistance: number; // meters
    totalFlightTime: number; // minutes
    weatherConditions: string;
    windSpeed: number;
    visibility: string;
  }>(),

  safetyChecklist: jsonb('safety_checklist').$type<{
    preFlightInspection: boolean;
    batteryLevel: number;
    propellerCondition: boolean;
    gpsSignal: boolean;
    weatherAcceptable: boolean;
    airspaceChecked: boolean;
    emergencyProcedures: boolean;
  }>(),

  incidents: jsonb('incidents').$type<
    Array<{
      time: string;
      description: string;
      severity: 'minor' | 'major' | 'critical';
      actionTaken: string;
    }>
  >(),

  mediaRecorded: jsonb('media_recorded').$type<{
    photos: number;
    videoMinutes: number;
    storageUsed: number; // GB
    quality: string;
  }>(),

  complianceNotes: text('compliance_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// More critical systems continuing...

// LET ME CONTINUE WITH THE REMAINING SYSTEMS TO REACH 326 TOTAL TABLES...

// 29. WORKFLOW AUTOMATION SYSTEM
export const automationRules = pgTable('automation_rules', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  name: varchar('name').notNull(),
  description: text('description'),

  triggerType: varchar('trigger_type')
    .$type<
      | 'project_created'
      | 'project_completed'
      | 'payment_received'
      | 'deadline_approaching'
      | 'client_message'
      | 'time_based'
    >()
    .notNull(),

  conditions: jsonb('conditions').$type<
    Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>
  >(),

  actions: jsonb('actions')
    .$type<
      Array<{
        type: 'send_email' | 'create_task' | 'update_project' | 'send_notification' | 'webhook';
        config: any;
      }>
    >()
    .notNull(),

  isActive: boolean('is_active').default(true),
  runCount: integer('run_count').default(0),
  lastRun: timestamp('last_run'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 30. BACKUP SYSTEM
export const backups = pgTable('backups', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  backupType: varchar('backup_type')
    .$type<'full' | 'incremental' | 'project' | 'files' | 'database'>()
    .notNull(),

  status: varchar('status')
    .$type<'queued' | 'in_progress' | 'completed' | 'failed'>()
    .default('queued'),

  backupSize: bigint('backup_size', { mode: 'number' }), // bytes
  backupLocation: varchar('backup_location').notNull(),

  isScheduled: boolean('is_scheduled').default(false),
  scheduleExpression: varchar('schedule_expression'), // cron expression

  metadata: jsonb('metadata').$type<{
    includedTables?: string[];
    includedProjects?: string[];
    includedFiles?: string[];
    retention?: number; // days
  }>(),

  errorMessage: text('error_message'),

  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

// 31-50. NORWEGIAN BUSINESS INTEGRATION SYSTEMS

// 31. BRREG INTEGRATION DATA
export const brregData = pgTable('brreg_data', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),

  orgNumber: varchar('org_number').notNull().unique(),
  name: varchar('name').notNull(),
  organizationForm: varchar('organization_form'),

  address: jsonb('address').$type<{
    street: string;
    postalCode: string;
    city: string;
    municipality: string;
    country: string;
  }>(),

  businessCode: varchar('business_code'),
  businessDescription: text('business_description'),

  registeredDate: date('registered_date'),
  isActive: boolean('is_active').default(true),

  lastUpdated: timestamp('last_updated'),
  lastChecked: timestamp('last_checked').defaultNow(),

  rawData: jsonb('raw_data'), // Full BRREG API response

  createdAt: timestamp('created_at').defaultNow(),
});

// 32. MVA/TAX CALCULATION SYSTEM
export const taxCalculations = pgTable('tax_calculations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  invoiceId: varchar('invoice_id').references(() => invoices.id),

  taxYear: integer('tax_year').notNull(),
  taxPeriod: varchar('tax_period'), // monthly, quarterly, yearly

  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).notNull(),
  totalExpenses: decimal('total_expenses', {
    precision: 12,
    scale: 2,
  }).notNull(),

  mvaCalculation: jsonb('mva_calculation').$type<{
    outgoingVat: number; // utgående mva
    incomingVat: number; // inngående mva
    netVat: number; // netto mva
    vatRate: number; // Usually 25% in Norway
  }>(),

  deductions: jsonb('deductions').$type<
    Array<{
      type: string;
      amount: number;
      description: string;
    }>
  >(),

  estimatedTax: decimal('estimated_tax', { precision: 10, scale: 2 }),

  status: varchar('status').$type<'draft' | 'submitted' | 'approved' | 'paid'>().default('draft'),

  submittedAt: timestamp('submitted_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 33. NORWEGIAN HOLIDAYS SYSTEM
export const norwegianHolidays = pgTable('norwegian_holidays', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  year: integer('year').notNull(),
  date: date('date').notNull(),
  name: varchar('name').notNull(),
  nameEn: varchar('name_en'),

  holidayType: varchar('holiday_type')
    .$type<'public' | 'religious' | 'cultural' | 'business'>()
    .notNull(),

  isNationwide: boolean('is_nationwide').default(true),
  affectedRegions: text('affected_regions').array(),

  businessImpact: varchar('business_impact')
    .$type<'closed' | 'reduced_hours' | 'normal' | 'peak'>()
    .default('closed'),

  description: text('description'),

  createdAt: timestamp('created_at').defaultNow(),
});

// 34. CURRENCY EXCHANGE RATES
export const currencyRates = pgTable('currency_rates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  baseCurrency: varchar('base_currency').default('NOK'),
  targetCurrency: varchar('target_currency').notNull(),

  rate: decimal('rate', { precision: 10, scale: 6 }).notNull(),

  date: date('date').notNull(),
  source: varchar('source').default('norges_bank'),

  createdAt: timestamp('created_at').defaultNow(),
});

// 35. TRAVEL EXPENSE TRACKING (for Norwegian tax compliance)
export const travelExpenses = pgTable('travel_expenses', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),

  travelDate: date('travel_date').notNull(),
  purpose: text('purpose').notNull(),

  fromLocation: varchar('from_location').notNull(),
  toLocation: varchar('to_location').notNull(),

  distance: decimal('distance', { precision: 8, scale: 2 }), // km

  transportationType: varchar('transportation_type')
    .$type<'car' | 'public_transport' | 'taxi' | 'plane' | 'train' | 'other'>()
    .notNull(),

  amount: decimal('amount', { precision: 8, scale: 2 }).notNull(),

  isDeductible: boolean('is_deductible').default(true),
  deductionRate: decimal('deduction_rate', { precision: 5, scale: 2 }), // NOK per km for cars

  tollFees: decimal('toll_fees', { precision: 8, scale: 2 }).default('0'),
  parkingFees: decimal('parking_fees', { precision: 8, scale: 2 }).default('0'),

  receiptUrl: varchar('receipt_url'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 36-100. MASSIVE ADDITIONAL SYSTEMS (CONTINUING TO REACH 326 TOTAL TABLES)

// File Synchronization System
export const fileSyncJobs = pgTable('file_sync_jobs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  status: varchar('status')
    .$type<'pending' | 'running' | 'completed' | 'failed'>()
    .default('pending'),
  syncType: varchar('sync_type').$type<'google_drive' | 'dropbox' | 'local'>().notNull(),
  lastSync: timestamp('last_sync'),
  filesProcessed: integer('files_processed').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Equipment Maintenance System
export const equipmentMaintenance = pgTable('equipment_maintenance', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  equipmentId: varchar('equipment_id').notNull(),
  maintenanceType: varchar('maintenance_type')
    .$type<'cleaning' | 'calibration' | 'repair' | 'upgrade'>()
    .notNull(),
  scheduledDate: date('scheduled_date'),
  completedDate: date('completed_date'),
  cost: decimal('cost', { precision: 8, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Client Contracts Archive
export const contractArchive = pgTable('contract_archive', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  originalContractId: varchar('original_contract_id').notNull(),
  archivedContent: text('archived_content').notNull(),
  archivedAt: timestamp('archived_at').defaultNow(),
  retentionPeriod: integer('retention_period').default(2555), // 7 years in days
  gdprCompliant: boolean('gdpr_compliant').default(true),
});

// Social Media Integration
export const socialMediaPosts = pgTable('social_media_posts', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  projectId: varchar('project_id').references(() => projects.id),
  platform: varchar('platform').$type<'instagram' | 'facebook' | 'linkedin' | 'tiktok'>().notNull(),
  postContent: text('post_content').notNull(),
  mediaUrls: text('media_urls').array(),
  scheduledAt: timestamp('scheduled_at'),
  publishedAt: timestamp('published_at'),
  status: varchar('status')
    .$type<'draft' | 'scheduled' | 'published' | 'failed'>()
    .default('draft'),
  engagementMetrics: jsonb('engagement_metrics'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Marketing Campaign Tracking
export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  campaignName: varchar('campaign_name').notNull(),
  campaignType: varchar('campaign_type')
    .$type<'google_ads' | 'facebook_ads' | 'email' | 'seo' | 'referral'>()
    .notNull(),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  targetAudience: jsonb('target_audience'),
  metrics: jsonb('metrics'),
  roi: decimal('roi', { precision: 8, scale: 4 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Lead Generation System
export const leads = pgTable('leads', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  leadSource: varchar('lead_source')
    .$type<'website' | 'referral' | 'social_media' | 'advertising' | 'cold_outreach'>()
    .notNull(),
  contactName: varchar('contact_name').notNull(),
  contactEmail: varchar('contact_email').notNull(),
  contactPhone: varchar('contact_phone'),
  leadScore: integer('lead_score').default(0),
  status: varchar('status')
    .$type<'new' | 'contacted' | 'qualified' | 'converted' | 'lost'>()
    .default('new'),
  estimatedValue: decimal('estimated_value', { precision: 10, scale: 2 }),
  expectedCloseDate: date('expected_close_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Referral Program System
export const referralProgram = pgTable('referral_program', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  referralCode: varchar('referral_code').notNull().unique(),
  referredUserId: varchar('referred_user_id').references(() => users.id),
  referralReward: decimal('referral_reward', { precision: 8, scale: 2 }),
  status: varchar('status').$type<'pending' | 'completed' | 'paid'>().default('pending'),
  completedAt: timestamp('completed_at'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Subscription Management
export const subscriptions = pgTable('subscriptions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  planType: varchar('plan_type').$type<'basic' | 'professional' | 'enterprise'>().notNull(),
  status: varchar('status').$type<'active' | 'cancelled' | 'expired' | 'trial'>().notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  amount: decimal('amount', { precision: 8, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),
  billingCycle: varchar('billing_cycle').$type<'monthly' | 'yearly'>().notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id'),
  autoRenew: boolean('auto_renew').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Analytics and Reporting System
export const analyticsReports = pgTable('analytics_reports', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  reportType: varchar('report_type')
    .$type<'financial' | 'project' | 'client' | 'equipment' | 'time' | 'marketing'>()
    .notNull(),
  reportPeriod: varchar('report_period')
    .$type<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>()
    .notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  reportData: jsonb('report_data').notNull(),
  generatedAt: timestamp('generated_at').defaultNow(),
  isAutomated: boolean('is_automated').default(false),
  scheduledFor: timestamp('scheduled_for'),
});

// Performance Metrics Dashboard
export const performanceMetrics = pgTable('performance_metrics', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  metricType: varchar('metric_type')
    .$type<'revenue' | 'projects' | 'efficiency' | 'client_satisfaction' | 'growth'>()
    .notNull(),
  metricValue: decimal('metric_value', { precision: 15, scale: 4 }).notNull(),
  targetValue: decimal('target_value', { precision: 15, scale: 4 }),
  period: date('period').notNull(),
  isKPI: boolean('is_kpi').default(false),
  trendDirection: varchar('trend_direction').$type<'up' | 'down' | 'stable'>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Competitive Analysis System
export const competitorAnalysis = pgTable('competitor_analysis', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  competitorName: varchar('competitor_name').notNull(),
  competitorWebsite: varchar('competitor_website'),
  serviceOffering: text('service_offering').array(),
  pricing: jsonb('pricing'),
  strengths: text('strengths').array(),
  weaknesses: text('weaknesses').array(),
  marketPosition: varchar('market_position').$type<'premium' | 'mid_market' | 'budget' | 'niche'>(),
  threatLevel: varchar('threat_level').$type<'low' | 'medium' | 'high'>().default('medium'),
  lastAnalyzed: timestamp('last_analyzed').defaultNow(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ✅ API Integration Process Monitor System
export const apiIntegrationProcesses = pgTable('api_integration_processes', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  service: varchar('service').notNull(), // e.g., 'pexels', 'openai', 'stripe'
  totalSteps: integer('total_steps').notNull().default(10),
  currentStep: integer('current_step').notNull().default(0),
  status: varchar('status')
    .$type<'initializing' | 'processing' | 'completed' | 'failed' | 'paused'>()
    .notNull()
    .default('initializing'),
  startTime: timestamp('start_time').defaultNow().notNull(),
  completedTime: timestamp('completed_time'),
  errorMessage: text('error_message'),
  stepDetails: jsonb('step_details').$type<{
    [stepNumber: number]: {
      id: number;
      title: string;
      description: string;
      status: 'pending' | 'active' | 'completed' | 'error';
      startTime?: string;
      endTime?: string;
      duration?: number;
      errorDetails?: string;
      apiCalls?: string[];
    };
  }>(),
  devStepsEnabled: boolean('dev_steps_enabled').default(false),
  devStepDetails: jsonb('dev_step_details').$type<{
    [stepNumber: number]: {
      id: number;
      title: string;
      description: string;
      status: 'pending' | 'active' | 'completed' | 'error';
      startTime?: string;
      endTime?: string;
      duration?: number;
    };
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ✅ API Integration Process Logs
export const apiIntegrationLogs = pgTable('api_integration_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  processId: varchar('process_id')
    .references(() => apiIntegrationProcesses.id)
    .notNull(),
  stepNumber: integer('step_number').notNull(),
  logLevel: varchar('log_level').$type<'info' | 'warning' | 'error' | 'debug'>().notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ✅ API Integration Health Checks
export const apiIntegrationHealthChecks = pgTable('api_integration_health_checks', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  service: varchar('service').notNull(),
  endpoint: varchar('endpoint').notNull(),
  status: varchar('status').$type<'healthy' | 'degraded' | 'unhealthy'>().notNull(),
  responseTime: integer('response_time'), // milliseconds
  statusCode: integer('status_code'),
  errorMessage: text('error_message'),
  lastChecked: timestamp('last_checked').defaultNow().notNull(),
  nextCheck: timestamp('next_check'),
  checkInterval: integer('check_interval').default(300), // seconds
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ✅ API Integration Process Monitor Types and Schemas (after table definitions)
export type ApiIntegrationProcess = typeof apiIntegrationProcesses.$inferSelect;
export type InsertApiIntegrationProcess = typeof apiIntegrationProcesses.$inferInsert;
export type ApiIntegrationLog = typeof apiIntegrationLogs.$inferSelect;
export type InsertApiIntegrationLog = typeof apiIntegrationLogs.$inferInsert;
export type ApiIntegrationHealthCheck = typeof apiIntegrationHealthChecks.$inferSelect;
export type InsertApiIntegrationHealthCheck = typeof apiIntegrationHealthChecks.$inferInsert;

// ✅ API Integration Process Monitor Schemas
export const insertApiIntegrationProcessSchema = createInsertSchema(apiIntegrationProcesses);
export const insertApiIntegrationLogSchema = createInsertSchema(apiIntegrationLogs);
export const insertApiIntegrationHealthCheckSchema = createInsertSchema(apiIntegrationHealthChecks);

// Client Onboarding System
export const clientOnboarding = pgTable('client_onboarding', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id)
    .notNull(),
  clientId: varchar('client_id').notNull(),
  onboardingStage: varchar('onboarding_stage')
    .$type<
      'initial_contact' | 'needs_assessment' | 'proposal' | 'contract' | 'kickoff' | 'completed'
    >()
    .default('initial_contact'),
  welcomePackageSent: boolean('welcome_package_sent').default(false),
  contractSigned: boolean('contract_signed').default(false),
  depositReceived: boolean('deposit_received').default(false),
  projectSetup: boolean('project_setup').default(false),
  kickoffMeetingScheduled: boolean('kickoff_meeting_scheduled').default(false),
  clientPortalAccess: boolean('client_portal_access').default(false),
  completedAt: timestamp('completed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Admin System Tracking Tables for Smart Notes and Action Usage
export const textEnhancementHistory = pgTable('text_enhancement_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  originalText: text('original_text').notNull(),
  enhancedText: text('enhanced_text').notNull(),
  enhancementType: varchar('enhancement_type').notNull(), // professional, creative, concise, etc.
  profession: varchar('profession').notNull(),
  userId: varchar('user_id'),
  wordsChanged: integer('words_changed'),
  qualityScore: decimal('quality_score', { precision: 3, scale: 2 }),
  processingTimeMs: integer('processing_time_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const actionUsageStats = pgTable('action_usage_stats', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  actionType: varchar('action_type').notNull(), // smart-notes, database-analysis, etc.
  userId: varchar('user_id'),
  metadata: jsonb('metadata'), // Additional context data
  executionTimeMs: integer('execution_time_ms'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// System Logs for API monitoring and analytics
export const systemLogs = pgTable('system_logs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  logType: varchar('log_type').notNull(), // 'api_request', 'system_error', 'user_action', etc.
  logLevel: varchar('log_level').notNull().default('info'), // 'debug', 'info', 'warn', 'error'
  message: text('message').notNull(),
  metadata: jsonb('metadata').$type<{
    api_name?: string;
    endpoint?: string;
    method?: string;
    status_code?: number;
    response_time?: number;
    error_type?: string;
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
    request_id?: string;
    [key: string]: any;
  }>(),
  userId: varchar('user_id'),
  sessionId: varchar('session_id'),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemLogInsertSchema = createInsertSchema(systemLogs);
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = typeof systemLogs.$inferInsert;

// 50+ MORE ADVANCED SYSTEMS TO COMPLETE THE 326 TABLE REQUIREMENT...

// Let me continue with critical systems for CreatorHub Norge Bibelen v5.0...

// FLEXIBLE ROLE-BASED ACCESS CONTROL SYSTEM
// Custom Roles Table - Fully configurable roles
export const customRoles = pgTable('custom_roles', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#1976d2'), // Hex color for UI
  isSystemRole: boolean('is_system_role').default(false), // Cannot be deleted
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(0), // For role hierarchy
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// System Features and Permissions - All available features in the platform
export const systemFeatures = pgTable('system_features', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(), // 'dashboard', 'admin', 'project', 'client', etc.
  isSystemFeature: boolean('is_system_feature').default(false), // Core features
  requiresLicense: boolean('requires_license').default(false),
  licenseType: varchar('license_type', { length: 50 }), // 'pro', 'enterprise', etc.
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Role-Feature Mappings - Which features each role has access to
export const roleFeatures = pgTable('role_features', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  roleId: varchar('role_id')
    .references(() => customRoles.id, { onDelete: 'cascade' })
    .notNull(),
  featureId: varchar('feature_id')
    .references(() => systemFeatures.id, { onDelete: 'cascade' })
    .notNull(),
  accessLevel: varchar('access_level', { length: 20 }).default('read'), // 'read', 'write', 'admin', 'full'
  isEnabled: boolean('is_enabled').default(true),
  grantedBy: varchar('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at').defaultNow(),
});

// User-Role Assignments - Users can have multiple roles
export const userRoles = pgTable('user_roles', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  roleId: varchar('role_id')
    .references(() => customRoles.id, { onDelete: 'cascade' })
    .notNull(),
  isPrimary: boolean('is_primary').default(false), // One primary role per user
  isActive: boolean('is_active').default(true),
  assignedBy: varchar('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // Optional role expiration
});

// Role Hierarchy - Parent-child relationships between roles
export const roleHierarchy = pgTable('role_hierarchy', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  parentRoleId: varchar('parent_role_id')
    .references(() => customRoles.id, { onDelete: 'cascade' })
    .notNull(),
  childRoleId: varchar('child_role_id')
    .references(() => customRoles.id, { onDelete: 'cascade' })
    .notNull(),
  inheritanceType: varchar('inheritance_type', { length: 20 }).default('full'), // 'full', 'partial', 'override'
  createdAt: timestamp('created_at').defaultNow(),
});

// Permission Overrides - User-specific permission overrides
export const userPermissionOverrides = pgTable('user_permission_overrides', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  featureId: varchar('feature_id')
    .references(() => systemFeatures.id, { onDelete: 'cascade' })
    .notNull(),
  accessLevel: varchar('access_level', { length: 20 }).notNull(), // 'none', 'read', 'write', 'admin', 'full'
  reason: text('reason'),
  overriddenBy: varchar('overridden_by').references(() => users.id),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// RBAC Audit Log - Track all role and permission changes
export const rbacAuditLog = pgTable('rbac_audit_log', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  action: varchar('action', { length: 50 }).notNull(), // 'role_created', 'permission_granted', 'role_assigned', etc.
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'role', 'feature', 'user', 'permission'
  entityId: varchar('entity_id').notNull(),
  targetUserId: varchar('target_user_id').references(() => users.id),
  performedBy: varchar('performed_by')
    .references(() => users.id)
    .notNull(),
  previousState: jsonb('previous_state'),
  newState: jsonb('new_state'),
  reason: text('reason'),
  ipAddress: varchar('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
});

// TypeScript types for RBAC system
export const customRoleInsertSchema = createInsertSchema(customRoles);
export const systemFeatureInsertSchema = createInsertSchema(systemFeatures);
export const roleFeatureInsertSchema = createInsertSchema(roleFeatures);
export const userRoleInsertSchema = createInsertSchema(userRoles);
export const roleHierarchyInsertSchema = createInsertSchema(roleHierarchy);
export const userPermissionOverrideInsertSchema = createInsertSchema(userPermissionOverrides);
export const rbacAuditLogInsertSchema = createInsertSchema(rbacAuditLog);

export type CustomRole = typeof customRoles.$inferSelect;
export type InsertCustomRole = typeof customRoles.$inferInsert;
export type SystemFeature = typeof systemFeatures.$inferSelect;
export type InsertSystemFeature = typeof systemFeatures.$inferInsert;
export type RoleFeature = typeof roleFeatures.$inferSelect;
export type InsertRoleFeature = typeof roleFeatures.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;
export type RoleHierarchy = typeof roleHierarchy.$inferSelect;
export type InsertRoleHierarchy = typeof roleHierarchy.$inferInsert;
export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type InsertUserPermissionOverride = typeof userPermissionOverrides.$inferInsert;
export type RbacAuditLog = typeof rbacAuditLog.$inferSelect;
export type InsertRbacAuditLog = typeof rbacAuditLog.$inferInsert;

// Export all schemas for Drizzle
export * from './vendor-type-registry';
export * from './vendor-onboarding-schema';
