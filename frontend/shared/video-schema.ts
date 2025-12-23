import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  real,
  uuid,
  serial,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

// Video Projects Table
export const videoProjects = pgTable('video_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().default('guest'),
  projectName: text('project_name').notNull(),
  eventType: text('event_type').notNull().default('wedding'),
  status: text('status').notNull().default('pending'),
  totalDuration: integer('total_duration').default(0),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  processedAt: timestamp('processed_at'),
  originalFileName: text('original_file_name'),
  metadata: jsonb('metadata').default('{}'),

  // Client and payment information
  clientId: text('client_id').references(() => users.id),
  clientName: text('client_name'),
  clientEmail: text('client_email'),
  contractTotal: text('contract_total'), // Total contract amount in NOK
  paidAmount: text('paid_amount').default('0'), // Amount already paid
  remainingAmount: text('remaining_amount'), // 50% remaining payment required
  paymentStatus: text('payment_status').default('pending'), // 'pending' | 'partial' | 'completed'
  paymentRequired: boolean('payment_required').default(true),

  // Video access control
  videoAccessEnabled: boolean('video_access_enabled').default(false),
  accessPasscode: text('access_passcode'), // Generated passcode for video access
  downloadUrl: text('download_url'), // URL for video download

  // Email notifications tracking
  uploadNotificationSent: boolean('upload_notification_sent').default(false),
  uploadNotificationSentAt: timestamp('upload_notification_sent_at'),
  paymentConfirmationSent: boolean('payment_confirmation_sent').default(false),
  paymentConfirmationSentAt: timestamp('payment_confirmation_sent_at'),

  // Google Review integration
  googleReviewLink: text('google_review_link'),
  feedbackRequested: boolean('feedback_requested').default(false),

  // Download tracking
  videoDownloaded: boolean('video_downloaded').default(false),
  downloadedAt: timestamp('downloaded_at'),
  downloadCount: integer('download_count').default(0),
  downloadNotificationSent: boolean('download_notification_sent').default(false),
});

// Video Segments Table
export const videoSegments = pgTable('video_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => videoProjects.id),
  startTime: real('start_time').notNull(),
  endTime: real('end_time').notNull(),
  segmentType: text('segment_type').notNull(),
  emotionalScore: real('emotional_score').default(0),
  qualityScore: real('quality_score').default(0),
  visualScore: real('visual_score').default(0),
  audioScore: real('audio_score').default(0),
  description: text('description'),
  keyMoments: jsonb('key_moments').default('[]'),
  transcription: text('transcription'),
  analysisResults: jsonb('analysis_results').default('{}'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Video Timelines Table
export const videoTimelines = pgTable('video_timelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => videoProjects.id),
  duration: integer('duration').notNull(),
  selectedSegments: jsonb('selected_segments').default('[]'),
  transitionPoints: jsonb('transition_points').default('[]'),
  musicSyncPoints: jsonb('music_sync_points').default('[]'),
  storyArc: jsonb('story_arc').default('{}'),
  renderStatus: text('render_status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Video Renders Table
export const videoRenders = pgTable('video_renders', {
  id: uuid('id').primaryKey().defaultRandom(),
  timelineId: uuid('timeline_id')
    .notNull()
    .references(() => videoTimelines.id),
  resolution: text('resolution').notNull(),
  format: text('format').notNull(),
  quality: text('quality').notNull(),
  fileSize: integer('file_size'),
  downloadUrl: text('download_url'),
  renderProgress: real('render_progress').default(0),
  renderStatus: text('render_status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Video Exports Table
export const videoExports = pgTable('video_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  timelineId: uuid('timeline_id')
    .notNull()
    .references(() => videoTimelines.id),
  software: text('software').notNull(),
  filePath: text('file_path'),
  downloadUrl: text('download_url'),
  exportSettings: jsonb('export_settings').default('{}'),
  exportStatus: text('export_status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Multi-Sequence Upload Sessions Table
export const multiSequenceUploadSessions = pgTable('multi_sequence_upload_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => videoProjects.id),
  sessionStatus: text('session_status').default('active'),
  sequenceCategories: jsonb('sequence_categories').default('[]'),
  uploadedFiles: jsonb('uploaded_files').default('{}'),
  processingProgress: jsonb('processing_progress').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Multi-Sequence Categories Table
export const multiSequenceCategories = pgTable('multi_sequence_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: text('category_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  priority: integer('priority').default(1),
  estimatedDuration: integer('estimated_duration').default(120),
  storyRole: text('story_role').default('unknown'),
  maxFiles: integer('max_files').default(10),
  metadata: jsonb('metadata').default('{}'),
});

// Type exports
export type VideoProject = typeof videoProjects.$inferSelect;
export type VideoSegment = typeof videoSegments.$inferSelect;
export type VideoTimeline = typeof videoTimelines.$inferSelect;
export type VideoRender = typeof videoRenders.$inferSelect;
export type VideoExport = typeof videoExports.$inferSelect;
export type MultiSequenceUploadSession = typeof multiSequenceUploadSessions.$inferSelect;
export type MultiSequenceCategory = typeof multiSequenceCategories.$inferSelect;

// Insert schemas
export const insertVideoProjectSchema = createInsertSchema(videoProjects);
export const insertVideoSegmentSchema = createInsertSchema(videoSegments);
export const insertVideoTimelineSchema = createInsertSchema(videoTimelines);
export const insertVideoRenderSchema = createInsertSchema(videoRenders);
export const insertVideoExportSchema = createInsertSchema(videoExports);
export const insertMultiSequenceUploadSessionSchema = createInsertSchema(
  multiSequenceUploadSessions,
);
export const insertMultiSequenceCategorySchema = createInsertSchema(multiSequenceCategories);

// Insert types
export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;
export type InsertVideoSegment = z.infer<typeof insertVideoSegmentSchema>;
export type InsertVideoTimeline = z.infer<typeof insertVideoTimelineSchema>;
export type InsertVideoRender = z.infer<typeof insertVideoRenderSchema>;
export type InsertVideoExport = z.infer<typeof insertVideoExportSchema>;
export type InsertMultiSequenceUploadSession = z.infer<
  typeof insertMultiSequenceUploadSessionSchema
>;
export type InsertMultiSequenceCategory = z.infer<typeof insertMultiSequenceCategorySchema>;

// Extended schemas for validation
export const multiSequenceUploadSchema = z.object({
  projectId: z.string().uuid(),
  sequences: z.object({
    couple_moments: z.array(z.any()),
    ceremony: z.array(z.any()),
    drone_shots: z.array(z.any()),
    speeches: z.array(z.any()),
    getting_ready: z.array(z.any()),
  }),
});

export const storytellingStructureSchema = z.object({
  opening: z.array(z.any()),
  buildUp: z.array(z.any()),
  climax: z.array(z.any()),
  resolution: z.array(z.any()),
  conclusion: z.array(z.any()),
});

export const storyArcSchema = z.object({
  structure: z.string(),
  emotionalFlow: z.array(z.number()),
  keyMoments: z.array(z.any()),
  culturalElements: z.array(z.any()),
  musicSuggestions: z.array(z.any()),
});

export const timelineGenerationSchema = z.object({
  duration: z.number().min(30).max(3600),
  eventType: z.enum(['wedding', 'corporate', 'music_video', 'documentary', 'event']),
  storyStructure: z.enum(['highlight', 'full_film', 'teaser', 'recap']),
});

export const renderOptionsSchema = z.object({
  resolution: z.enum(['720p', '1080p', '4K', 'square', 'vertical']),
  format: z.enum(['mp4', 'mov', 'prores', 'h264', 'h265']),
  quality: z.enum(['web', 'high', 'broadcast', 'archive']),
  platforms: z.array(z.enum(['youtube', 'instagram', 'tiktok', 'facebook', 'vimeo'])).optional(),
});

export const exportSettingsSchema = z.object({
  software: z.enum(['davinci_resolve', 'fcpx', 'premiere_pro', 'avid']),
  projectName: z.string().min(1).max(100),
  frameRate: z.number().min(23.976).max(120),
  resolution: z.enum(['720p', '1080p', '4K']),
  colorSpace: z.enum(['Rec.709', 'Rec.2020', 'DCI-P3', 'sRGB']),
});

// Norwegian-specific schemas
export const norwegianWeddingMomentsSchema = z.object({
  brudevals: z.boolean().default(false),
  gratulasjon: z.boolean().default(false),
  norwegian_ceremony: z.boolean().default(false),
  bunad: z.boolean().default(false),
  norwegian_traditions: z.array(z.string()).default([]),
});

export const norwegianCulturalElementsSchema = z.object({
  language: z.enum(['norwegian', 'english', 'mixed']).default('norwegian'),
  culturalMoments: z.array(z.any()).default([]),
  traditionalElements: z.array(z.string()).default([]),
  regionalContext: z.string().optional(),
});

// Query schemas for API validation
export const projectQuerySchema = z.object({
  userId: z.string().default('guest'),
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  eventType: z.enum(['wedding', 'corporate', 'music_video', 'documentary', 'event']).optional(),
});

export const segmentQuerySchema = z.object({
  projectId: z.string().uuid(),
  segmentType: z
    .enum(['couple_moments', 'ceremony', 'drone_shots', 'speeches', 'getting_ready'])
    .optional(),
  minQualityScore: z.number().min(0).max(1).optional(),
  minEmotionalScore: z.number().min(0).max(1).optional(),
});

export const timelineQuerySchema = z.object({
  projectId: z.string().uuid(),
  duration: z.number().min(30).max(3600).optional(),
  renderStatus: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
});

// Response schemas
export const projectResponseSchema = z.object({
  success: z.boolean(),
  project: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      status: z.string(),
      eventType: z.string(),
      totalDuration: z.number(),
      uploadedAt: z.string(),
      metadata: z.any(),
    })
    .optional(),
  message: z.string(),
});

export const processingResponseSchema = z.object({
  success: z.boolean(),
  processing: z
    .object({
      projectId: z.string().uuid(),
      processedSequences: z.array(z.any()),
      totalSegments: z.number(),
      estimatedProcessingTime: z.number(),
    })
    .optional(),
  message: z.string(),
});

export const storytellingResponseSchema = z.object({
  success: z.boolean(),
  storytelling: storytellingStructureSchema.optional(),
  sections: z
    .object({
      opening: z.number(),
      buildUp: z.number(),
      climax: z.number(),
      resolution: z.number(),
      conclusion: z.number(),
    })
    .optional(),
  message: z.string(),
});

export const highlightReelResponseSchema = z.object({
  success: z.boolean(),
  highlightReel: z
    .object({
      timelineId: z.string().uuid(),
      selectedSegments: z.array(z.any()),
      storyArc: storyArcSchema,
      renderingOptions: z.any(),
    })
    .optional(),
  message: z.string(),
});

export const fullFilmResponseSchema = z.object({
  success: z.boolean(),
  fullFilm: z
    .object({
      timelineId: z.string().uuid(),
      selectedSegments: z.array(z.any()),
      storyArc: storyArcSchema,
      renderingOptions: z.any(),
    })
    .optional(),
  message: z.string(),
});

export const progressResponseSchema = z.object({
  success: z.boolean(),
  progress: z
    .object({
      totalSequences: z.number(),
      processedSequences: z.number(),
      analysisComplete: z.boolean(),
      storytellingReady: z.boolean(),
      estimatedCompletion: z.string(),
    })
    .optional(),
  message: z.string(),
});
