import { pgTable, text, varchar, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Norwegian videography production standards for professional videographers
export const videoProjects = pgTable('video_projects', {
  id: varchar('id').primaryKey().notNull(),
  projectName: varchar('project_name').notNull(),
  clientName: varchar('client_name').notNull(),
  projectType: varchar('project_type').notNull(), // "wedding_video", "corporate_video", "commercial_video", "documentary_video", "music_video"

  // Technical Standards
  fps: integer('fps').notNull(), // 25, 50 for Norway/Europe
  resolution: varchar('resolution').notNull(), // "1920x1080", "3840x2160"
  audioSampleRate: integer('audio_sample_rate').notNull(), // 48kHz standard
  audioBitrate: integer('audio_bitrate').notNull(), // 256kbps, 320kbps
  audioChannels: integer('audio_channels').notNull().default(2), // Stereo

  // Compliance Status
  standardsCompliant: boolean('standards_compliant').default(false),
  validationErrors: jsonb('validation_errors').$type<string[]>().default([]),

  // Project Details
  status: varchar('status').notNull().default('planning'), // "planning", "recording", "editing", "review", "completed"
  createdBy: varchar('created_by').notNull(),
  assignedEditor: varchar('assigned_editor'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deliveryDate: timestamp('delivery_date'),
});

// Audio/Video standards compliance rules
export const productionStandards = pgTable('production_standards', {
  id: varchar('id').primaryKey().notNull(),
  standardName: varchar('standard_name').notNull(),
  category: varchar('category').notNull(), // "video", "audio", "export"

  // Norwegian Broadcasting Standards
  recommendedFps: integer('recommended_fps').notNull(),
  maxFps: integer('max_fps').notNull(),
  minFps: integer('min_fps').notNull(),

  recommendedAudioSampleRate: integer('recommended_audio_sample_rate').notNull(),
  recommendedAudioBitrate: integer('recommended_audio_bitrate').notNull(),
  minAudioBitrate: integer('min_audio_bitrate').notNull(),

  // Compliance Rules
  enforced: boolean('enforced').default(true),
  description: text('description'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project validation logs
export const validationLogs = pgTable('validation_logs', {
  id: varchar('id').primaryKey().notNull(),
  projectId: varchar('project_id').notNull(),
  validationType: varchar('validation_type').notNull(), // "fps", "audio", "export"

  isValid: boolean('is_valid').notNull(),
  errorMessage: text('error_message'),
  recommendations: jsonb('recommendations').$type<string[]>(),

  validatedAt: timestamp('validated_at').defaultNow(),
  validatedBy: varchar('validated_by').notNull(),
});

// Zod schemas for validation
export const insertVideoProjectSchema = createInsertSchema(videoProjects, {
  fps: z.number().min(24).max(60),
  audioSampleRate: z.number().min(44100).max(96000),
  audioBitrate: z.number().min(128).max(512),
  audioChannels: z.number().min(1).max(8),
  projectName: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductionStandardSchema = createInsertSchema(productionStandards, {
  standardName: z.string().min(1).max(255),
  recommendedFps: z.number().min(24).max(60),
  recommendedAudioSampleRate: z.number().min(44100).max(96000),
  recommendedAudioBitrate: z.number().min(128).max(512),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;
export type ProductionStandard = typeof productionStandards.$inferSelect;
export type InsertProductionStandard = z.infer<typeof insertProductionStandardSchema>;
export type ValidationLog = typeof validationLogs.$inferSelect;
