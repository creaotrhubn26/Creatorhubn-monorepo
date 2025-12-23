import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Production Projects
export const productionProjects = pgTable('production_projects', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // wedding, commercial, documentary, etc.
  status: varchar('status', { length: 50 }).notNull().default('planning'), // planning, pre-production, production, post-production, completed
  clientId: varchar('client_id', { length: 255 }).notNull(),
  budget: decimal('budget', { precision: 10, scale: 2 }),
  estimatedDuration: integer('estimated_duration'), // in minutes
  shootDate: timestamp('shoot_date'),
  deliveryDate: timestamp('delivery_date'),
  location: text('location'),
  description: text('description'),
  requirements: jsonb('requirements'), // technical and creative requirements
  teamMembers: jsonb('team_members'), // assigned crew
  equipment: jsonb('equipment'), // required equipment
  script: text('script'),
  storyboard: jsonb('storyboard'),
  shotList: jsonb('shot_list'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Production Stages
export const productionStages = pgTable('production_stages', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  stage: varchar('stage', { length: 50 }).notNull(), // pre-production, production, post-production
  phase: varchar('phase', { length: 100 }).notNull(), // planning, scriptwriting, shooting, editing, etc.
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  assignedTo: varchar('assigned_to', { length: 255 }),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  deliverables: jsonb('deliverables'),
  notes: text('notes'),
  completionPercentage: integer('completion_percentage').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Production Equipment
export const productionEquipment = pgTable('production_equipment', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(), // camera, audio, lighting, etc.
  model: varchar('model', { length: 255 }),
  specifications: jsonb('specifications'),
  availability: boolean('availability').default(true),
  condition: varchar('condition', { length: 50 }).default('excellent'),
  dailyRate: decimal('daily_rate', { precision: 8, scale: 2 }),
  location: varchar('location', { length: 255 }),
  lastMaintenance: timestamp('last_maintenance'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Production Crew
export const productionCrew = pgTable('production_crew', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }).notNull(), // director, cinematographer, sound engineer, etc.
  specialization: varchar('specialization', { length: 255 }),
  experience: integer('experience'), // years of experience
  availability: jsonb('availability'), // schedule availability
  dayRate: decimal('day_rate', { precision: 8, scale: 2 }),
  portfolio: jsonb('portfolio'),
  certifications: jsonb('certifications'),
  equipment: jsonb('equipment'), // personal equipment
  contact: jsonb('contact'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Production Assets
export const productionAssets = pgTable('production_assets', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // video, audio, image, document
  category: varchar('category', { length: 100 }).notNull(), // raw_footage, edited_video, audio_track, etc.
  fileSize: integer('file_size'), // in bytes
  duration: integer('duration'), // for video/audio files, in seconds
  resolution: varchar('resolution', { length: 50 }),
  codec: varchar('codec', { length: 50 }),
  filePath: text('file_path'),
  metadata: jsonb('metadata'),
  tags: jsonb('tags'),
  status: varchar('status', { length: 50 }).default('processing'), // processing, ready, archived
  uploadedBy: varchar('uploaded_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Production Workflows
export const productionWorkflows = pgTable('production_workflows', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  workflowType: varchar('workflow_type', { length: 100 }).notNull(), // editing, color_grading, sound_mixing
  status: varchar('status', { length: 50 }).notNull().default('queued'),
  priority: varchar('priority', { length: 20 }).default('medium'),
  assignedTo: varchar('assigned_to', { length: 255 }),
  inputAssets: jsonb('input_assets'),
  outputAssets: jsonb('output_assets'),
  parameters: jsonb('parameters'),
  progress: integer('progress').default(0),
  estimatedTime: integer('estimated_time'), // in minutes
  actualTime: integer('actual_time'),
  startTime: timestamp('start_time'),
  completionTime: timestamp('completion_time'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Client Communications
export const clientCommunications = pgTable('client_communications', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  clientId: varchar('client_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // email, call, meeting, review
  subject: varchar('subject', { length: 255 }),
  content: text('content'),
  attachments: jsonb('attachments'),
  status: varchar('status', { length: 50 }).default('sent'),
  scheduledFor: timestamp('scheduled_for'),
  completedAt: timestamp('completed_at'),
  followUpRequired: boolean('follow_up_required').default(false),
  followUpDate: timestamp('follow_up_date'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Production Schedules
export const productionSchedules = pgTable('production_schedules', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(), // shoot, meeting, editing_session
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  location: text('location'),
  attendees: jsonb('attendees'),
  equipment: jsonb('equipment'),
  status: varchar('status', { length: 50 }).default('scheduled'),
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Insert schemas
export const insertProductionProject = createInsertSchema(productionProjects);
export const insertProductionStage = createInsertSchema(productionStages);
export const insertProductionEquipment = createInsertSchema(productionEquipment);
export const insertProductionCrew = createInsertSchema(productionCrew);
export const insertProductionAsset = createInsertSchema(productionAssets);
export const insertProductionWorkflow = createInsertSchema(productionWorkflows);
export const insertClientCommunication = createInsertSchema(clientCommunications);
export const insertProductionSchedule = createInsertSchema(productionSchedules);

// Types
export type ProductionProject = typeof productionProjects.$inferSelect;
export type InsertProductionProject = z.infer<typeof insertProductionProject>;

export type ProductionStage = typeof productionStages.$inferSelect;
export type InsertProductionStage = z.infer<typeof insertProductionStage>;

export type ProductionEquipment = typeof productionEquipment.$inferSelect;
export type InsertProductionEquipment = z.infer<typeof insertProductionEquipment>;

export type ProductionCrew = typeof productionCrew.$inferSelect;
export type InsertProductionCrew = z.infer<typeof insertProductionCrew>;

export type ProductionAsset = typeof productionAssets.$inferSelect;
export type InsertProductionAsset = z.infer<typeof insertProductionAsset>;

export type ProductionWorkflow = typeof productionWorkflows.$inferSelect;
export type InsertProductionWorkflow = z.infer<typeof insertProductionWorkflow>;

export type ClientCommunication = typeof clientCommunications.$inferSelect;
export type InsertClientCommunication = z.infer<typeof insertClientCommunication>;

export type ProductionSchedule = typeof productionSchedules.$inferSelect;
export type InsertProductionSchedule = z.infer<typeof insertProductionSchedule>;
