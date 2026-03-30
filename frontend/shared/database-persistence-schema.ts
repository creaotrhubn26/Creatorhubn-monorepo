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
  unique,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Import and re-export AI chat schemas
export {
  aiChatConversations,
  aiChatMessages,
  aiChatConversationsRelations,
  aiChatMessagesRelations,
  type AiChatConversation,
  type InsertAiChatConversation,
  type AiChatMessage,
  type InsertAiChatMessage,
} from './ai-chat-schema';

// ⭐ AI Code Completion System
export {
  aiCodeCompletionUsage,
  aiPromptTemplates,
  aiTeamKeys,
  aiTeamKeyUsageLog,
  aiProjectContext,
  aiLocalModelConfigs,
  aiDebugSessions,
  aiModelComparisonResults,
  aiTeamKeysRelations,
  aiTeamKeyUsageLogRelations,
  type AiCodeCompletionUsage,
  type InsertAiCodeCompletionUsage,
  type AiPromptTemplate,
  type InsertAiPromptTemplate,
  type AiTeamKey,
  type InsertAiTeamKey,
  type AiTeamKeyUsageLog,
  type InsertAiTeamKeyUsageLog,
  type AiProjectContext,
  type InsertAiProjectContext,
  type AiLocalModelConfig,
  type InsertAiLocalModelConfig,
  type AiDebugSession,
  type InsertAiDebugSession,
  type AiModelComparisonResult,
  type InsertAiModelComparisonResult,
} from './ai-code-completion-schema';

// Import and re-export productCatalogImages from equipment-schema
// This allows db.ts to access it through the centralized schema import
export {
  productCatalogImages,
  type ProductCatalogImage,
  type InsertProductCatalogImage,
} from './equipment-schema';

// ⭐ CreatorHub Virtual Studio - 3D Pre-visualization & Virtual Production
export {
  virtualStudioProjects,
  virtualStudioScenes,
  virtualStudioCameraPaths,
  virtualStudioAssets,
  virtualStudioRenders,
  virtualStudioTemplates,
  virtualStudioExports,
  googleDriveFolders,
  googleDriveFiles,
  insertGoogleDriveFileSchema,
  type VirtualStudioProject,
  type InsertVirtualStudioProject,
  type VirtualStudioScene,
  type InsertVirtualStudioScene,
  type VirtualStudioCameraPath,
  type InsertVirtualStudioCameraPath,
  type VirtualStudioAsset,
  type InsertVirtualStudioAsset,
  type VirtualStudioRender,
  type InsertVirtualStudioRender,
  type VirtualStudioTemplate,
  type InsertVirtualStudioTemplate,
  type VirtualStudioExport,
  type InsertVirtualStudioExport,
  type GoogleDriveFolder,
  type InsertGoogleDriveFolder,
  type GoogleDriveFile,
  type InsertGoogleDriveFile,
} from './virtual-studio-schema';

// ⭐ Canon CCAPI - Real Camera Control Integration
export {
  ccapiCameras,
  ccapiConnections,
  ccapiShotLists,
  ccapiRealPhotos,
  ccapiComparisonResults,
  ccapiLiveSessions,
  type CcapiCamera,
  type InsertCcapiCamera,
  type CcapiConnection,
  type InsertCcapiConnection,
  type CcapiShotList,
  type InsertCcapiShotList,
  type CcapiRealPhoto,
  type InsertCcapiRealPhoto,
  type CcapiComparisonResult,
  type InsertCcapiComparisonResult,
  type CcapiLiveSession,
  type InsertCcapiLiveSession,
} from './ccapi-schema';

// ⭐ GDPR Compliance & Data Deletion
export {
  deletionAuditLog,
  deletionFailures,
  cleanupJobLogs,
  deletionRequests,
  type DeletionAuditLog,
  type InsertDeletionAuditLog,
  type DeletionFailure,
  type InsertDeletionFailure,
  type CleanupJobLog,
  type InsertCleanupJobLog,
  type DeletionRequest,
  type InsertDeletionRequest,
} from './deletion-audit-schema';

// ⭐ Feature Management System (4-Level Control)
export {
  professionFeatureOverrides,
  dashboardConfigOverrides,
  userFeatureOverrides,
  userMetadata,
  featureManagementAudit,
  type ProfessionFeatureOverride,
  type NewProfessionFeatureOverride,
  type DashboardConfigOverride,
  type NewDashboardConfigOverride,
  type UserFeatureOverride,
  type NewUserFeatureOverride,
  type UserMetadata,
  type NewUserMetadata,
  type FeatureManagementAuditLog,
  type NewFeatureManagementAuditLog,
} from './feature-management-schema';

// ============================================================================
// AI VIDEO GENERATOR (Sora-like Text-to-Video)
// ============================================================================

export const videoGenerations = pgTable(
  'video_generations',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }),

    // Input
    prompt: text('prompt').notNull(),

    // Output
    videoUrl: text('video_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),

    // Video specs
    duration: integer('duration').notNull(), // seconds
    resolution: varchar('resolution', { length: 10 }).notNull(), // 720p, 1080p, 4k
    aspectRatio: varchar('aspect_ratio', { length: 10 }).notNull(), // 16:9, 9:16, 1:1
    fps: integer('fps').notNull().default(30),

    // Generation details
    backend: varchar('backend', { length: 50 }).notNull(), // runway, stability, leonardo, mini-sora
    cost: decimal('cost', { precision: 10, scale: 4 }).default('0'), // USD
    status: varchar('status', { length: 20 }).notNull().default('processing'), // processing, completed, failed

    // Metadata
    metadata: jsonb('metadata'), // storyboard, scenes, etc.

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('video_generations_user_id_idx').on(table.userId),
    createdAtIdx: index('video_generations_created_at_idx').on(table.createdAt),
  }),
);

export type VideoGeneration = typeof videoGenerations.$inferSelect;
export type InsertVideoGeneration = typeof videoGenerations.$inferInsert;

// ============================================================================
// MINI-SORA CONTINUOUS LEARNING SYSTEM
// ============================================================================

/**
 * Queue of videos awaiting training
 * Collects user-generated content for model fine-tuning
 */
export const miniSoraTrainingQueue = pgTable(
  'mini_sora_training_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    videoGenerationId: varchar('video_generation_id', { length: 255 }), // FK to videoGenerations

    // Video details
    videoUrl: text('video_url').notNull(),
    prompt: text('prompt').notNull(),
    duration: integer('duration').notNull(), // seconds
    resolution: varchar('resolution', { length: 10 }).notNull(),
    fps: integer('fps').notNull(),

    // Training metadata
    source: varchar('source', { length: 50 }).notNull(), // mini-sora, runway, stability, user_upload
    category: varchar('category', { length: 100 }), // wedding, studio, portrait, commercial
    quality: integer('quality').default(0), // 0-100 quality score from user feedback

    // Training status
    status: varchar('status', { length: 20 })
      .$type<'pending' | 'approved' | 'rejected' | 'trained' | 'failed'>()
      .default('pending'),
    trainedAt: timestamp('trained_at'),
    trainingRunId: uuid('training_run_id'), // FK to miniSoraTrainingRuns

    // Metadata
    metadata: jsonb('metadata'), // Additional context: scene, style, etc.

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('mini_sora_training_queue_user_id_idx').on(table.userId),
    statusIdx: index('mini_sora_training_queue_status_idx').on(table.status),
    categoryIdx: index('mini_sora_training_queue_category_idx').on(table.category),
    createdAtIdx: index('mini_sora_training_queue_created_at_idx').on(table.createdAt),
  }),
);

export type MiniSoraTrainingQueue = typeof miniSoraTrainingQueue.$inferSelect;
export type InsertMiniSoraTrainingQueue = typeof miniSoraTrainingQueue.$inferInsert;

/**
 * User feedback on generated videos
 * Used to determine training data quality
 */
export const miniSoraTrainingFeedback = pgTable(
  'mini_sora_training_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    videoGenerationId: varchar('video_generation_id', { length: 255 }).notNull(),
    trainingQueueId: uuid('training_queue_id'), // FK to miniSoraTrainingQueue

    // Feedback type
    feedbackType: varchar('feedback_type', { length: 50 })
      .$type<'rating' | 'edit' | 'regenerate' | 'share' | 'delete'>()
      .notNull(),

    // Rating (1-5 stars, or thumbs up/down)
    rating: integer('rating'), // 1-5 or null
    thumbsUp: boolean('thumbs_up'), // true/false or null

    // Edit tracking
    wasEdited: boolean('was_edited').default(false),
    editCount: integer('edit_count').default(0),
    editDetails: jsonb('edit_details'), // What was changed: color, speed, transitions

    // Regenerate tracking
    wasRegenerated: boolean('was_regenerated').default(false),
    regenerateReason: text('regenerate_reason'),

    // Usage tracking
    wasShared: boolean('was_shared').default(false),
    wasUsedInProject: boolean('was_used_in_project').default(false),

    // Comments
    comment: text('comment'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    videoGenerationIdIdx: index('mini_sora_feedback_video_gen_id_idx').on(table.videoGenerationId),
    userIdIdx: index('mini_sora_feedback_user_id_idx').on(table.userId),
    feedbackTypeIdx: index('mini_sora_feedback_type_idx').on(table.feedbackType),
  }),
);

export type MiniSoraTrainingFeedback = typeof miniSoraTrainingFeedback.$inferSelect;
export type InsertMiniSoraTrainingFeedback = typeof miniSoraTrainingFeedback.$inferInsert;

/**
 * Training run history
 * Tracks model fine-tuning jobs
 */
export const miniSoraTrainingRuns = pgTable(
  'mini_sora_training_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Training configuration
    modelVersion: varchar('model_version', { length: 50 }).notNull(), // v1, v2, v3
    checkpointPath: text('checkpoint_path').notNull(),
    baseModel: varchar('base_model', { length: 100 })
      .notNull()
      .default('stabilityai/stable-diffusion-2-1'),

    // Training data
    numVideos: integer('num_videos').notNull(),
    videoIds: jsonb('video_ids'), // Array of training queue IDs
    categories: jsonb('categories'), // Array of categories trained on

    // Training parameters
    numEpochs: integer('num_epochs').default(10),
    learningRate: varchar('learning_rate', { length: 20 }).default('1e-5'),
    batchSize: integer('batch_size').default(1),

    // Training metrics
    status: varchar('status', { length: 20 })
      .$type<'queued' | 'running' | 'completed' | 'failed' | 'cancelled'>()
      .default('queued'),
    progress: integer('progress').default(0), // 0-100
    loss: decimal('loss', { precision: 10, scale: 6 }),

    // Performance
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    durationSeconds: integer('duration_seconds'),

    // Results
    samplesGenerated: jsonb('samples_generated'), // Sample video URLs for quality check
    metrics: jsonb('metrics'), // Training/validation metrics
    errorMessage: text('error_message'),

    // Deployment
    deployed: boolean('deployed').default(false),
    deployedAt: timestamp('deployed_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    statusIdx: index('mini_sora_training_runs_status_idx').on(table.status),
    modelVersionIdx: index('mini_sora_training_runs_version_idx').on(table.modelVersion),
    createdAtIdx: index('mini_sora_training_runs_created_at_idx').on(table.createdAt),
  }),
);

export type MiniSoraTrainingRun = typeof miniSoraTrainingRuns.$inferSelect;
export type InsertMiniSoraTrainingRun = typeof miniSoraTrainingRuns.$inferInsert;

// ============================================================================
// PROJECT MANAGEMENT SYSTEM
// ============================================================================

// Table Definitions
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
// EQUIPMENT MANAGEMENT SYSTEM (Extended)
// ============================================================================

// Firmware Updates Database - Sourced from manufacturers
export const firmwareUpdates = pgTable('firmware_updates', {
  id: serial('id').primaryKey(),
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  category: varchar('category').default('lighting'), // lighting, audio, video, camera

  // Version Information
  version: varchar('version').notNull(),
  updateType: varchar('update_type').default('firmware'), // firmware, software, driver
  releaseDate: timestamp('release_date').notNull(),
  isLatest: boolean('is_latest').default(false),
  isCritical: boolean('is_critical').default(false),

  // Update Details
  downloadUrl: varchar('download_url'),
  downloadSize: varchar('download_size'), // "45.2 MB"
  installationTime: varchar('installation_time'), // "15-20 minutes"

  // Professional Benefits
  photographerBenefits: jsonb('photographer_benefits'), // Array of benefits for photographers
  videographerBenefits: jsonb('videographer_benefits'), // Array of benefits for videographers
  musicProducerBenefits: jsonb('music_producer_benefits'), // Array of benefits for music producers
  generalImprovements: jsonb('general_improvements'), // General improvements
  bugFixes: jsonb('bug_fixes'), // Array of bug fixes
  newFeatures: jsonb('new_features'), // Array of new features

  // Technical Requirements
  requirements: jsonb('requirements'), // System requirements, prerequisites
  compatibility: jsonb('compatibility'), // Compatible accessories, lenses, etc.
  knownIssues: jsonb('known_issues'), // Known issues with this version

  // Installation Instructions
  installationSteps: jsonb('installation_steps'), // Step-by-step installation guide
  rollbackInstructions: jsonb('rollback_instructions'), // How to revert if needed

  // Professional Recommendations
  photographerRecommendation: varchar('photographer_recommendation'), // recommended, optional, critical
  videographerRecommendation: varchar('videographer_recommendation'),
  musicProducerRecommendation: varchar('music_producer_recommendation'),
  riskLevel: varchar('risk_level').default('low'), // low, medium, high

  // Source Information
  sourceUrl: varchar('source_url'), // Manufacturer's release page
  lastVerified: timestamp('last_verified'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Comprehensive Lens Database
export const lensDatabase = pgTable('lens_database', {
  id: varchar('id').primaryKey(),
  brand: varchar('brand'),
  model: varchar('model'),
  mount: varchar('mount'), // Canon RF, Sony E, Nikon Z, etc.
  focalLength: varchar('focal_length'), // "24-70mm", "50mm", etc.
  aperture: varchar('aperture'), // "f/2.8", "f/1.4-2.8", etc.
  lensType: varchar('lens_type'), // prime, zoom, macro, telephoto
  weight: varchar('weight'),
  dimensions: varchar('dimensions'),
  imageStabilization: boolean('image_stabilization').default(false),
  weatherSealing: boolean('weather_sealing').default(false),
  autofocus: boolean('autofocus').default(true),
  releaseYear: integer('release_year'),
  msrpPrice: decimal('msrp_price', { precision: 10, scale: 2 }),
  currentPrice: decimal('current_price', { precision: 10, scale: 2 }),
  availability: varchar('availability').default('available'), // available, discontinued, limited
  description: text('description'),
  specifications: jsonb('specifications'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Maintenance Records
export const equipmentMaintenance = pgTable('equipment_maintenance', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id').references(() => userEquipment.id),
  userId: varchar('user_id').notNull(),

  // Maintenance Details
  maintenanceType: varchar('maintenance_type').notNull(), // cleaning, calibration, repair, upgrade, inspection
  description: text('description').notNull(),
  serviceProvider: varchar('service_provider'), // Official service, third-party, self-service
  cost: decimal('cost', { precision: 10, scale: 2 }),

  // Scheduling
  scheduledDate: timestamp('scheduled_date'),
  completedDate: timestamp('completed_date'),
  nextScheduledDate: timestamp('next_scheduled_date'),

  // Parts and Labor
  partsReplaced: jsonb('parts_replaced'), // Array of replaced parts
  laborHours: decimal('labor_hours', { precision: 5, scale: 2 }),
  warrantyExtended: boolean('warranty_extended').default(false),

  // Documentation
  receiptUrl: varchar('receipt_url'),
  beforePhotos: jsonb('before_photos'), // Array of photo URLs
  afterPhotos: jsonb('after_photos'), // Array of photo URLs
  serviceNotes: text('service_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Rentals
export const equipmentRentals = pgTable('equipment_rentals', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id').references(() => userEquipment.id),
  userId: varchar('user_id').notNull(),

  // Rental Details
  rentalCompany: varchar('rental_company'),
  rentalStartDate: timestamp('rental_start_date').notNull(),
  rentalEndDate: timestamp('rental_end_date').notNull(),
  rentalCost: decimal('rental_cost', { precision: 10, scale: 2 }),

  // Project Integration
  projectId: varchar('project_id'),
  clientName: varchar('client_name'),

  // Rental Status
  status: varchar('status').default('active'), // active, returned, overdue, damaged
  returnCondition: varchar('return_condition'), // excellent, good, fair, damaged
  lateFees: decimal('late_fees', { precision: 10, scale: 2 }).default('0'),

  // Documentation
  rentalAgreementUrl: varchar('rental_agreement_url'),
  pickupPhotos: jsonb('pickup_photos'),
  returnPhotos: jsonb('return_photos'),
  damageNotes: text('damage_notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Market Equipment Database - Global equipment catalog
export const marketEquipment = pgTable('market_equipment', {
  id: serial('id').primaryKey(),

  // Basic Information
  brand: varchar('brand').notNull(),
  model: varchar('model').notNull(),
  category: varchar('category').notNull(), // camera, lens, lighting, audio, accessory
  subcategory: varchar('subcategory'), // dslr, mirrorless, prime, zoom, etc.

  // Market Information
  msrp: decimal('msrp', { precision: 10, scale: 2 }), // Manufacturer's suggested retail price
  currentPrice: decimal('current_price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  availability: varchar('availability').default('available'), // available, discontinued, limited

  // Technical Specifications
  specifications: jsonb('specifications'),
  features: jsonb('features'), // Array of key features
  compatibility: jsonb('compatibility'), // Compatible with other equipment

  // Professional Ratings
  photographerRating: decimal('photographer_rating', { precision: 3, scale: 2 }),
  videographerRating: decimal('videographer_rating', { precision: 3, scale: 2 }),
  musicProducerRating: decimal('music_producer_rating', { precision: 3, scale: 2 }),
  overallRating: decimal('overall_rating', { precision: 3, scale: 2 }),

  // Market Data
  releaseYear: integer('release_year'),
  lastUpdated: timestamp('last_updated'),
  sourceUrl: varchar('source_url'), // Manufacturer or retailer URL

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Software Updates Database
export const softwareUpdates = pgTable('software_updates', {
  id: serial('id').primaryKey(),
  softwareName: varchar('software_name').notNull(),
  version: varchar('version').notNull(),
  updateType: varchar('update_type').default('software'), // software, plugin, extension, driver
  releaseDate: timestamp('release_date').notNull(),
  isLatest: boolean('is_latest').default(false),
  isCritical: boolean('is_critical').default(false),

  // Update Details
  downloadUrl: varchar('download_url'),
  downloadSize: varchar('download_size'),
  installationTime: varchar('installation_time'),

  // Professional Benefits
  photographerBenefits: jsonb('photographer_benefits'),
  videographerBenefits: jsonb('videographer_benefits'),
  musicProducerBenefits: jsonb('music_producer_benefits'),
  generalImprovements: jsonb('general_improvements'),
  bugFixes: jsonb('bug_fixes'),
  newFeatures: jsonb('new_features'),

  // Technical Requirements
  requirements: jsonb('requirements'),
  compatibility: jsonb('compatibility'),
  knownIssues: jsonb('known_issues'),

  // Installation Instructions
  installationSteps: jsonb('installation_steps'),
  rollbackInstructions: jsonb('rollback_instructions'),

  // Professional Recommendations
  photographerRecommendation: varchar('photographer_recommendation'),
  videographerRecommendation: varchar('videographer_recommendation'),
  musicProducerRecommendation: varchar('music_producer_recommendation'),
  riskLevel: varchar('risk_level').default('low'),

  // Source Information
  sourceUrl: varchar('source_url'),
  lastVerified: timestamp('last_verified'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Software Database
export const softwareDatabase = pgTable('software_database', {
  id: serial('id').primaryKey(),
  name: varchar('name').notNull(),
  category: varchar('category').notNull(), // editing, cms, crm, analytics, etc.
  subcategory: varchar('subcategory'), // photo_editing, video_editing, audio_editing, etc.
  developer: varchar('developer').notNull(),
  currentVersion: varchar('current_version'),
  releaseDate: timestamp('release_date'),
  lastUpdated: timestamp('last_updated'),

  // Pricing Information
  pricingModel: varchar('pricing_model'), // one_time, subscription, freemium, free
  price: decimal('price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  freeTrialAvailable: boolean('free_trial_available').default(false),
  freeTrialDays: integer('free_trial_days'),

  // Professional Ratings
  photographerRating: decimal('photographer_rating', { precision: 3, scale: 2 }),
  videographerRating: decimal('videographer_rating', { precision: 3, scale: 2 }),
  musicProducerRating: decimal('music_producer_rating', { precision: 3, scale: 2 }),
  overallRating: decimal('overall_rating', { precision: 3, scale: 2 }),

  // Technical Information
  systemRequirements: jsonb('system_requirements'),
  features: jsonb('features'),
  supportedFormats: jsonb('supported_formats'),
  integrations: jsonb('integrations'),

  // Professional Benefits
  photographerBenefits: jsonb('photographer_benefits'),
  videographerBenefits: jsonb('videographer_benefits'),
  musicProducerBenefits: jsonb('music_producer_benefits'),

  // Market Information
  website: varchar('website'),
  documentation: varchar('documentation'),
  support: varchar('support'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Images
export const equipmentImages = pgTable('equipment_images', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id').references(() => userEquipment.id),
  userId: varchar('user_id').notNull(),
  imageUrl: varchar('image_url').notNull(),
  imageType: varchar('image_type').default('equipment'), // equipment, receipt, warranty, manual
  description: text('description'),
  isPrimary: boolean('is_primary').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// MEMORY CARD MANAGEMENT SYSTEM
// ============================================================================

// Memory Card Backup Sessions
export const memoryCardSessions = pgTable('memory_card_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id').notNull().unique(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  profession: varchar('profession').notNull(), // photographer, videographer

  // Project Integration
  projectPhase: varchar('project_phase').notNull().default('post_production'),
  eventDate: timestamp('event_date'),
  executionDate: timestamp('execution_date'),
  postProductionStartDate: timestamp('post_production_start_date'),
  activatedAt: timestamp('activated_at').defaultNow(),

  // Session Configuration
  eventType: varchar('event_type').notNull(), // single_day, multi_day, commercial, wedding
  weddingCulture: varchar('wedding_culture'), // norsk, indisk, tyrkisk, marokkansk, pakistansk, etc.
  totalDays: integer('total_days').default(1),
  activeDays: jsonb('active_days'), // Array av dagnummer som brukes [1, 2, 3]
  cardLabelingScheme: varchar('card_labeling_scheme').notNull(), // ABCD, EFGH, custom

  // Mappestruktur Integration
  driveFolderId: varchar('drive_folder_id'), // Google Drive hovedmappe ID
  dayFolders: jsonb('day_folders'), // Mappestruktur per dag
  uploadProgress: jsonb('upload_progress'), // Opplastingsstatus per dag/kort

  // Session Status
  status: varchar('status').notNull().default('active'), // active, completed, archived
  isAutoActivated: boolean('is_auto_activated').default(true),

  // Backup Progress
  totalCards: integer('total_cards').default(0),
  backedUpCards: integer('backed_up_cards').default(0),
  lastBackupAt: timestamp('last_backup_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Memory Card Backup Tips
export const backupTips = pgTable('backup_tips', {
  id: serial('id').primaryKey(),
  tipId: varchar('tip_id').notNull().unique(),

  // Tip Categories
  category: varchar('category').notNull(), // labeling, backup_process, safety, organization
  eventType: varchar('event_type').notNull(), // single_day, multi_day, commercial, wedding
  profession: varchar('profession').notNull(), // photographer, videographer

  // Tip Content
  title: varchar('title').notNull(),
  description: text('description').notNull(),
  actionItems: jsonb('action_items'), // Array of specific actions to take
  importance: varchar('importance').notNull().default('medium'), // low, medium, high, critical

  // Display Conditions
  showOnActivation: boolean('show_on_activation').default(false),
  showDuringBackup: boolean('show_during_backup').default(false),
  showOnCompletion: boolean('show_on_completion').default(false),

  // Norwegian Localization
  titleNorwegian: varchar('title_norwegian'),
  descriptionNorwegian: text('description_norwegian'),

  // Metadata
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Memory Card Backup Logs
export const backupLogs = pgTable('backup_logs', {
  id: serial('id').primaryKey(),
  logId: varchar('log_id').notNull().unique(),
  sessionId: integer('session_id').references(() => memoryCardSessions.id),
  cardId: varchar('card_id').notNull(), // Reference to memoryCards.cardId (not a direct FK here to avoid circular dependency)

  // Log Information
  action: varchar('action').notNull(), // backup_started, backup_completed, verification_passed, error_occurred
  status: varchar('status').notNull(), // success, warning, error
  message: text('message').notNull(),
  details: jsonb('details'), // Additional structured data

  // Performance Metrics
  filesTransferred: integer('files_transferred'),
  bytesTransferred: bigint('bytes_transferred', { mode: 'number' }),
  transferDuration: integer('transfer_duration'), // in seconds
  transferSpeed: decimal('transfer_speed', { precision: 10, scale: 2 }), // MB/s

  // Error Information
  errorCode: varchar('error_code'),
  errorDetails: jsonb('error_details'),

  // Metadata
  timestamp: timestamp('timestamp').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// CHAT SYSTEM
// ============================================================================

// Chat Conversations
export const chatConversations = pgTable('chat_conversations', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id'), // Optional - links to project if created from project
  participantIds: text('participant_ids').array().notNull(), // Array of user IDs
  title: varchar('title'), // Optional conversation title
  lastMessageAt: timestamp('last_message_at'),
  isArchived: boolean('is_archived').default(false),
  metadata: jsonb('metadata'), // Additional data like project info
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Chat Messages
export const chatMessages = pgTable('chat_messages', {
  id: varchar('id').primaryKey(),
  conversationId: varchar('conversation_id').notNull(),
  senderId: varchar('sender_id').notNull(),
  senderName: varchar('sender_name').notNull(),
  senderAvatar: varchar('sender_avatar'), // Profile image URL
  content: text('content').notNull(),
  messageType: varchar('message_type').default('text'), // text, image, file, system
  isRead: boolean('is_read').default(false),
  readBy: text('read_by').array().default([]), // Array of user IDs who have read this message
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Chat Rooms
export const chatRooms = pgTable('chat_rooms', {
  id: varchar('id').primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  isPrivate: boolean('is_private').default(false),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Chat Room Members
export const chatRoomMembers = pgTable('chat_room_members', {
  id: varchar('id').primaryKey(),
  roomId: varchar('room_id').notNull(),
  userId: varchar('user_id').notNull(),
  role: varchar('role').default('member'), // member, admin, moderator
  joinedAt: timestamp('joined_at').defaultNow(),
});

// Chat Notifications
export const chatNotifications = pgTable('chat_notifications', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  conversationId: varchar('conversation_id'),
  roomId: varchar('room_id'),
  messageId: varchar('message_id'),
  type: varchar('type').notNull(), // message, mention, system
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// External Collaborators
export const externalCollaborators = pgTable('external_collaborators', {
  id: varchar('id').primaryKey(),
  email: varchar('email').notNull(),
  name: varchar('name').notNull(),
  company: varchar('company'),
  role: varchar('role'),
  isActive: boolean('is_active').default(true),
  invitedBy: varchar('invited_by').notNull(),
  invitedAt: timestamp('invited_at').defaultNow(),
  acceptedAt: timestamp('accepted_at'),
});

// Editing Instructions
export const editingInstructions = pgTable('editing_instructions', {
  id: varchar('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  instructions: text('instructions').notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// COMMUNICATION SYSTEM
// ============================================================================

// Communication Channels - Central hub for all communication types
export const communicationChannels = pgTable('communication_channels', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  type: varchar('type')
    .$type<'chat' | 'email' | 'notification' | 'meeting' | 'project' | 'system'>()
    .notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Communication Messages - Unified message storage
 
export const communicationMessages: any = pgTable('communication_messages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  channelId: varchar('channel_id')
    .references(() => communicationChannels.id)
    .notNull(),
  senderId: varchar('sender_id').notNull(), // User ID or system
  recipientId: varchar('recipient_id'), // For direct messages
  messageType: varchar('message_type')
    .$type<'text' | 'file' | 'system' | 'notification' | 'meeting_invite' | 'project_update'>()
    .notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}), // File info, notification data, etc.
  isRead: boolean('is_read').default(false),
  isPriority: boolean('is_priority').default(false),
  isSystemGenerated: boolean('is_system_generated').default(false),
   
  parentMessageId: varchar('parent_message_id').references(() => (communicationMessages as any).id), // For threads - self-reference
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  readAt: timestamp('read_at'),
  deliveredAt: timestamp('delivered_at'),
});

// Communication Participants - Who has access to what channels
export const communicationParticipants = pgTable('communication_participants', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  channelId: varchar('channel_id')
    .references(() => communicationChannels.id)
    .notNull(),
  userId: varchar('user_id').notNull(),
  role: varchar('role').$type<'admin' | 'member' | 'viewer' | 'moderator'>().default('member'),
  permissions: jsonb('permissions').default({
    canSend: true,
    canRead: true,
    canInvite: false,
    canModerate: false,
  }),
  joinedAt: timestamp('joined_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at'),
  notificationSettings: jsonb('notification_settings').default({
    email: true,
    inApp: true,
    push: false,
  }),
  isActive: boolean('is_active').default(true),
});

// Communication Integrations - Links to external systems
export const communicationIntegrations = pgTable('communication_integrations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  channelId: varchar('channel_id')
    .references(() => communicationChannels.id)
    .notNull(),
  integrationType: varchar('integration_type')
    .$type<
      'google_meet' | 'google_drive' | 'project' | 'equipment' | 'contract' | 'email_designer'
    >()
    .notNull(),
  externalId: varchar('external_id'), // Project ID, Meeting ID, etc.
  settings: jsonb('settings').default({}),
  isActive: boolean('is_active').default(true),
  syncStatus: varchar('sync_status').default('active'),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Message Reactions - Like, emoji reactions, etc.
export const messageReactions = pgTable('message_reactions', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar('message_id')
    .references(() => communicationMessages.id)
    .notNull(),
  userId: varchar('user_id').notNull(),
  reactionType: varchar('reaction_type').notNull(), // emoji, like, etc.
  createdAt: timestamp('created_at').defaultNow(),
});

// Message Attachments - File uploads, documents, etc.
export const messageAttachments = pgTable('message_attachments', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  messageId: varchar('message_id')
    .references(() => communicationMessages.id)
    .notNull(),
  fileName: varchar('file_name').notNull(),
  fileType: varchar('file_type').notNull(),
  fileSize: integer('file_size'),
  filePath: varchar('file_path').notNull(),
  thumbnailPath: varchar('thumbnail_path'),
  uploadedBy: varchar('uploaded_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Communication Templates - For system messages, email templates, etc.
export const communicationTemplates = pgTable('communication_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name').notNull(),
  type: varchar('type')
    .$type<'email' | 'notification' | 'system_message' | 'meeting_invite'>()
    .notNull(),
  subject: varchar('subject'),
  content: text('content').notNull(),
  variables: jsonb('variables').default([]), // List of available variables
  isActive: boolean('is_active').default(true),
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'all'>()
    .default('all'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
// IMAGES AND MEDIA MANAGEMENT SYSTEM
// ============================================================================

export const images = pgTable(
  'images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }),
    filePath: text('file_path').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    width: integer('width'),
    height: integer('height'),
    resolution: varchar('resolution', { length: 50 }),
    colorSpace: varchar('color_space', { length: 50 }),
    camera: varchar('camera', { length: 100 }),
    lens: varchar('lens', { length: 100 }),
    settings: jsonb('settings'), // EXIF data and camera settings
    tags: jsonb('tags'), // Array of tags for searching
    isPublic: boolean('is_public').default(false),
    isProcessed: boolean('is_processed').default(false),
    processingStatus: varchar('processing_status')
      .$type<'pending' | 'processing' | 'completed' | 'failed'>()
      .default('pending'),
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),
    driveBackupPath: varchar('drive_backup_path', { length: 500 }),
    backupStatus: varchar('backup_status')
      .$type<'pending' | 'backed_up' | 'failed'>()
      .default('pending'),
    thumbnailUrl: text('thumbnail_url'),
    previewUrl: text('preview_url'),
    downloadCount: integer('download_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('images_project_id_idx').on(table.projectId),
    userIdIdx: index('images_user_id_idx').on(table.userId),
    fileNameIdx: index('images_file_name_idx').on(table.fileName),
  }),
);

export const projectBackups = pgTable(
  'project_backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    userId: varchar('user_id').notNull(),
    backupType: varchar('backup_type').$type<'auto' | 'manual' | 'scheduled'>().notNull(),
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),
    backupSize: bigint('backup_size', { mode: 'number' }),
    backupStatus: varchar('backup_status')
      .$type<'pending' | 'completed' | 'failed'>()
      .default('pending'),
    errorMessage: text('error_message'),
    backupLocation: text('backup_location'),
    verificationStatus: varchar('verification_status')
      .$type<'pending' | 'verified' | 'failed'>()
      .default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('project_backups_project_id_idx').on(table.projectId),
    userIdIdx: index('project_backups_user_id_idx').on(table.userId),
    backupTypeIdx: index('project_backups_backup_type_idx').on(table.backupType),
  }),
);

// NOTE: googleDriveFiles is exported from virtual-studio-schema.ts

// ============================================================================
// SEO AND MARKETING SYSTEM
// ============================================================================

export const seoCampaigns = pgTable(
  'seo_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }).notNull(),
    status: varchar('status').$type<'draft' | 'active' | 'paused' | 'completed'>().default('draft'),
    googleSearchConsoleEnabled: boolean('google_search_console_enabled').default(false),
    googleAnalyticsEnabled: boolean('google_analytics_enabled').default(false),
    googleAdsEnabled: boolean('google_ads_enabled').default(false),
    targetKeywords: jsonb('target_keywords'), // Array of target keywords
    budget: decimal('budget', { precision: 10, scale: 2 }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    performance: jsonb('performance'), // Performance metrics and data
    metadata: jsonb('metadata'), // Additional campaign data
    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('seo_campaigns_user_id_idx').on(table.userId),
    domainIdx: index('seo_campaigns_domain_idx').on(table.domain),
    statusIdx: index('seo_campaigns_status_idx').on(table.status),
  }),
);

export const seoKeywords = pgTable(
  'seo_keywords',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id').notNull(),
    keyword: varchar('keyword', { length: 255 }).notNull(),
    position: integer('position'),
    impressions: integer('impressions').default(0),
    clicks: integer('clicks').default(0),
    ctr: decimal('ctr', { precision: 5, scale: 2 }),
    change7d: integer('change_7d').default(0),
    change30d: integer('change_30d').default(0),
    changeLife: integer('change_life').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('seo_keywords_campaign_id_idx').on(table.campaignId),
    keywordIdx: index('seo_keywords_keyword_idx').on(table.keyword),
  }),
);

// ============================================================================
// GOOGLE WALLET SYSTEM
// ============================================================================

export const googleWalletPasses = pgTable('google_wallet_passes', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  passType: varchar('pass_type', { length: 100 }).notNull(),
  passId: varchar('pass_id', { length: 255 }).notNull().unique(),
  passData: jsonb('pass_data').notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  issuedAt: timestamp('issued_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleWalletTickets = pgTable('google_wallet_tickets', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  eventId: varchar('event_id'),
  ticketId: varchar('ticket_id', { length: 255 }).notNull().unique(),
  ticketData: jsonb('ticket_data').notNull(),
  status: varchar('status', { length: 50 }).default('valid'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const googleWalletLoyaltyCards = pgTable('google_wallet_loyalty_cards', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  programId: varchar('program_id', { length: 255 }),
  cardId: varchar('card_id', { length: 255 }).notNull().unique(),
  points: integer('points').default(0),
  cardData: jsonb('card_data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const googleWalletMembershipCards = pgTable('google_wallet_membership_cards', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  membershipId: varchar('membership_id', { length: 255 }).notNull().unique(),
  membershipData: jsonb('membership_data').notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// TRIAL & NOTIFICATIONS SYSTEM
// ============================================================================

export const trialNotifications = pgTable('trial_notifications', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  notificationType: varchar('notification_type', { length: 100 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const trialUsageTracking = pgTable('trial_usage_tracking', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  featureKey: varchar('feature_key', { length: 100 }).notNull(),
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// GOOGLE PAY INTEGRATION SYSTEM
// ============================================================================

export const googlePaySubscriptions = pgTable(
  'google_pay_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userSubscriptionId: uuid('user_subscription_id').notNull(),
    userId: varchar('user_id').notNull(),
    googlePayProductId: varchar('google_pay_product_id', { length: 255 }).notNull(),
    googlePaySubscriptionId: varchar('google_pay_subscription_id', { length: 255 }).notNull(),
    googlePayPurchaseToken: text('google_pay_purchase_token').notNull(),
    status: varchar('status')
      .$type<'active' | 'cancelled' | 'expired' | 'on_hold'>()
      .default('active'),
    subscriptionType: varchar('subscription_type').$type<'monthly' | 'annual'>().notNull(),
    priceAmountMicros: bigint('price_amount_micros', { mode: 'number' }).notNull(),
    priceCurrencyCode: varchar('price_currency_code', { length: 3 }).default('NOK'),
    startTimeMillis: bigint('start_time_millis', { mode: 'number' }).notNull(),
    expiryTimeMillis: bigint('expiry_time_millis', { mode: 'number' }),
    autoRenewing: boolean('auto_renewing').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('google_pay_subscriptions_user_id_idx').on(table.userId),
    googlePaySubscriptionIdIdx: index('google_pay_subscriptions_subscription_id_idx').on(
      table.googlePaySubscriptionId,
    ),
  }),
);

export const googlePayTransactions = pgTable(
  'google_pay_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id').notNull(),
    userId: varchar('user_id').notNull(),
    transactionType: varchar('transaction_type', { length: 100 }).notNull(),
    amountMicros: bigint('amount_micros', { mode: 'number' }).notNull(),
    currencyCode: varchar('currency_code', { length: 3 }).default('NOK'),
    status: varchar('status')
      .$type<'pending' | 'completed' | 'failed' | 'refunded'>()
      .default('pending'),
    transactionId: varchar('transaction_id', { length: 255 }),
    externalTransactionId: varchar('external_transaction_id', { length: 255 }),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    subscriptionIdIdx: index('google_pay_transactions_subscription_id_idx').on(
      table.subscriptionId,
    ),
    userIdIdx: index('google_pay_transactions_user_id_idx').on(table.userId),
  }),
);

export const googlePayProducts = pgTable(
  'google_pay_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: varchar('product_id', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    profession: varchar('profession', { length: 100 }).notNull(),
    tier: varchar('tier', { length: 50 }).notNull(),
    features: jsonb('features').notNull(),
    monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }),
    annualPrice: decimal('annual_price', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    productIdIdx: index('google_pay_products_product_id_idx').on(table.productId),
    professionIdx: index('google_pay_products_profession_idx').on(table.profession),
  }),
);

export const googlePayBillingIssues = pgTable(
  'google_pay_billing_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id').notNull(),
    userId: varchar('user_id').notNull(),
    issueType: varchar('issue_type', { length: 100 }).notNull(),
    status: varchar('status')
      .$type<'unresolved' | 'resolved' | 'escalated'>()
      .default('unresolved'),
    userNotified: boolean('user_notified').default(false),
    notificationsSent: integer('notifications_sent').default(0),
    gracePeriodEndTimeMillis: bigint('grace_period_end_time_millis', { mode: 'number' }),
    googlePayNotificationData: jsonb('google_pay_notification_data'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    subscriptionIdIdx: index('google_pay_billing_issues_subscription_id_idx').on(
      table.subscriptionId,
    ),
    userIdIdx: index('google_pay_billing_issues_user_id_idx').on(table.userId),
  }),
);

// ============================================================================
// FIKEN ACCOUNTING INTEGRATION SYSTEM (PRO PLAN)
// ============================================================================

export const fikenIntegrations = pgTable(
  'fiken_integrations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessId: varchar('business_id'),

    // OAuth tokens
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),

    // Fiken company info
    fikenCompanySlug: varchar('fiken_company_slug', { length: 255 }).notNull(),
    fikenCompanyName: varchar('fiken_company_name', { length: 255 }).notNull(),
    fikenOrganizationNumber: varchar('fiken_organization_number', { length: 20 }).notNull(),

    // Business information for account code mapping
    businessType: varchar('business_type', { length: 50 }), // ENK, AS, ANS, DA, NUF, etc.
    profession: varchar('profession', { length: 100 }), // photographer, videographer, music_producer, vendor

    // Sync settings
    autoSyncInvoices: boolean('auto_sync_invoices').default(true),
    autoSyncCustomers: boolean('auto_sync_customers').default(true),
    autoSyncProducts: boolean('auto_sync_products').default(false),

    // Metadata
    connectedAt: timestamp('connected_at').defaultNow(),
    lastSyncAt: timestamp('last_sync_at'),
    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('fiken_integrations_user_id_idx').on(table.userId),
    fikenCompanySlugIdx: index('fiken_integrations_company_slug_idx').on(table.fikenCompanySlug),
    uniqueUserCompany: unique('fiken_integrations_user_company_unique').on(
      table.userId,
      table.fikenCompanySlug,
    ),
  }),
);

export type FikenIntegration = typeof fikenIntegrations.$inferSelect;
export type InsertFikenIntegration = typeof fikenIntegrations.$inferInsert;

// Fiken sync logs for tracking integration activity
export const fikenSyncLogs = pgTable(
  'fiken_sync_logs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    integrationId: varchar('integration_id')
      .notNull()
      .references(() => fikenIntegrations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id').notNull(),

    syncType: varchar('sync_type', { length: 50 }).notNull(), // invoice, customer, product, payment
    action: varchar('action', { length: 50 }).notNull(), // create, update, sync, error
    status: varchar('status', { length: 50 }).notNull(), // success, failed, partial

    recordsProcessed: integer('records_processed').default(0),
    recordsFailed: integer('records_failed').default(0),

    errorMessage: text('error_message'),
    errorDetails: jsonb('error_details'),

    metadata: jsonb('metadata'), // Additional sync details

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    integrationIdIdx: index('fiken_sync_logs_integration_id_idx').on(table.integrationId),
    userIdIdx: index('fiken_sync_logs_user_id_idx').on(table.userId),
    createdAtIdx: index('fiken_sync_logs_created_at_idx').on(table.createdAt),
  }),
);

export type FikenSyncLog = typeof fikenSyncLogs.$inferSelect;
export type InsertFikenSyncLog = typeof fikenSyncLogs.$inferInsert;

// ============================================================================
// TIME TRACKING SYSTEM (Smart Stempling)
// ============================================================================

/**
 * Time entries for tracking work hours, meetings, and billable time
 * Supports Fiken integration for time-based invoicing
 */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Time tracking
    date: date('date').notNull(),
    startTime: varchar('start_time', { length: 5 }).notNull(), // HH:MM (24h)
    endTime: varchar('end_time', { length: 5 }).notNull(), // HH:MM (24h)
    breakHours: decimal('break_hours', { precision: 4, scale: 2 }).default('0'),

    // Activity classification
    activity: varchar('activity', { length: 50 })
      .$type<'work' | 'meeting' | 'billable' | 'non_billable'>()
      .notNull()
      .default('work'),
    title: varchar('title', { length: 255 }).notNull(),
    notes: text('notes'),

    // Client/Project linking (CRM integration)
    clientId: varchar('client_id', { length: 255 }), // FK to clients
    projectId: varchar('project_id', { length: 255 }), // FK to projects
    projectName: varchar('project_name', { length: 255 }),
    place: varchar('place', { length: 255 }), // Location or mode (office, remote, on-site)

    // Billing
    isBillable: boolean('is_billable').default(true),
    hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }).default('0'),
    calculatedHours: decimal('calculated_hours', { precision: 6, scale: 2 }), // Auto-calculated
    calculatedAmount: decimal('calculated_amount', { precision: 10, scale: 2 }), // Auto-calculated

    // Invoice tracking
    isInvoiced: boolean('is_invoiced').default(false),
    invoiceId: varchar('invoice_id', { length: 255 }), // FK to invoices or Fiken invoice ID
    invoicedAt: timestamp('invoiced_at'),

    // Geolocation (mobile PWA)
    location: jsonb('location'), // { lat, lng, accuracy, address }

    // Recurrence detection metadata
    recurrenceKey: varchar('recurrence_key', { length: 255 }), // For detecting patterns
    isTemplate: boolean('is_template').default(false),

    // Google Drive integration
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }), // Related documents

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('time_entries_user_id_idx').on(table.userId),
    dateIdx: index('time_entries_date_idx').on(table.date),
    clientIdIdx: index('time_entries_client_id_idx').on(table.clientId),
    projectIdIdx: index('time_entries_project_id_idx').on(table.projectId),
    isBillableIdx: index('time_entries_is_billable_idx').on(table.isBillable),
    isInvoicedIdx: index('time_entries_is_invoiced_idx').on(table.isInvoiced),
    recurrenceKeyIdx: index('time_entries_recurrence_key_idx').on(table.recurrenceKey),
  }),
);

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = typeof timeEntries.$inferInsert;

/**
 * Time tracking templates created from recurring entries
 * Quick-start templates for common activities
 */
export const timeEntryTemplates = pgTable(
  'time_entry_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    activity: varchar('activity', { length: 50 })
      .$type<'work' | 'meeting' | 'billable' | 'non_billable'>()
      .notNull(),
    title: varchar('title', { length: 255 }).notNull(),

    // Template defaults
    defaultDuration: integer('default_duration'), // minutes
    defaultBreakHours: decimal('default_break_hours', { precision: 4, scale: 2 }),
    defaultClientId: varchar('default_client_id', { length: 255 }),
    defaultProjectId: varchar('default_project_id', { length: 255 }),
    defaultPlace: varchar('default_place', { length: 255 }),
    defaultHourlyRate: decimal('default_hourly_rate', { precision: 10, scale: 2 }),

    // Usage tracking
    useCount: integer('use_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Detection metadata
    detectedFromRecurrence: boolean('detected_from_recurrence').default(false),
    recurrencePattern: varchar('recurrence_pattern', { length: 255 }), // e.g., "Monday Meeting"

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('time_entry_templates_user_id_idx').on(table.userId),
    nameIdx: index('time_entry_templates_name_idx').on(table.name),
  }),
);

export type TimeEntryTemplate = typeof timeEntryTemplates.$inferSelect;
export type InsertTimeEntryTemplate = typeof timeEntryTemplates.$inferInsert;

/**
 * Monthly time tracking archives stored in Google Drive
 * Automatic CSV/JSON backups for each month
 */
export const timeTrackingArchives = pgTable(
  'time_tracking_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Archive period
    month: varchar('month', { length: 6 }).notNull(), // YYYYMM
    year: integer('year').notNull(),
    monthNumber: integer('month_number').notNull(), // 1-12

    // Summary statistics
    totalHours: decimal('total_hours', { precision: 10, scale: 2 }),
    billableHours: decimal('billable_hours', { precision: 10, scale: 2 }),
    nonBillableHours: decimal('non_billable_hours', { precision: 10, scale: 2 }),
    totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }),
    totalDays: integer('total_days'),
    totalEntries: integer('total_entries'),

    // Google Drive files
    csvFileId: varchar('csv_file_id', { length: 255 }), // CSV export
    jsonFileId: varchar('json_file_id', { length: 255 }), // JSON backup
    pdfFileId: varchar('pdf_file_id', { length: 255 }), // PDF report
    csvWebViewLink: text('csv_web_view_link'),
    jsonWebViewLink: text('json_web_view_link'),
    pdfWebViewLink: text('pdf_web_view_link'),

    // Fiken integration
    fikenExported: boolean('fiken_exported').default(false),
    fikenExportedAt: timestamp('fiken_exported_at'),
    fikenInvoiceIds: jsonb('fiken_invoice_ids'), // Array of Fiken invoice IDs

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('time_tracking_archives_user_id_idx').on(table.userId),
    monthIdx: index('time_tracking_archives_month_idx').on(table.month),
    yearIdx: index('time_tracking_archives_year_idx').on(table.year),
    uniqueUserMonth: unique('time_tracking_archives_user_month_unique').on(
      table.userId,
      table.month,
    ),
  }),
);

export type TimeTrackingArchive = typeof timeTrackingArchives.$inferSelect;
export type InsertTimeTrackingArchive = typeof timeTrackingArchives.$inferInsert;

/**
 * Active clock-in sessions for real-time time tracking
 */
export const activeClockSessions = pgTable(
  'active_clock_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    startedAt: timestamp('started_at').notNull(),
    startedAtDate: date('started_at_date').notNull(),
    startedAtTime: varchar('started_at_time', { length: 5 }).notNull(), // HH:MM

    activity: varchar('activity', { length: 50 })
      .$type<'work' | 'meeting' | 'billable' | 'non_billable'>()
      .notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    clientId: varchar('client_id', { length: 255 }),
    projectId: varchar('project_id', { length: 255 }),
    place: varchar('place', { length: 255 }),

    // Geolocation at clock-in
    startLocation: jsonb('start_location'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('active_clock_sessions_user_id_idx').on(table.userId),
    uniqueUserClock: unique('active_clock_sessions_user_unique').on(table.userId),
  }),
);

export type ActiveClockSession = typeof activeClockSessions.$inferSelect;
export type InsertActiveClockSession = typeof activeClockSessions.$inferInsert;

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
    assignedProfession: varchar('assigned_profession', { length: 100 }), // For prototype testers: specific profession to test
    businessName: varchar('business_name', { length: 255 }),
    businessType: varchar('business_type', { length: 100 }),
    website: varchar('website', { length: 255 }),
    socialMedia: jsonb('social_media'), // Social media links and handles
    preferences: jsonb('preferences'), // User preferences and settings
    subscription: jsonb('subscription'), // Subscription details
    isActive: boolean('is_active').default(true),
    isVerified: boolean('is_verified').default(false),
    lastLoginAt: timestamp('last_login_at'),

    // Google Workspace Integration
    googleWorkspaceToken: text('google_workspace_token'),
    googleRefreshToken: text('google_refresh_token'),
    googleWorkspaceConnected: boolean('google_workspace_connected').default(false),
    googleDriveConnected: boolean('google_drive_connected').default(false),
    googleCalendarConnected: boolean('google_calendar_connected').default(false),
    gmailConnected: boolean('gmail_connected').default(false),

    // TickTick Integration
    ticktickAccessToken: text('ticktick_access_token'),
    ticktickRefreshToken: text('ticktick_refresh_token'),
    ticktickConnected: boolean('ticktick_connected').default(false),
    ticktickTokenExpiresAt: timestamp('ticktick_token_expires_at'),

    // Google Analytics 4 Cross-Tracking
    ga4ClientId: varchar('ga4_client_id', { length: 255 }), // GA4 client ID for cross-device tracking
    ga4SessionId: varchar('ga4_session_id', { length: 255 }), // Last session ID
    ga4LastTracked: timestamp('ga4_last_tracked'), // Last GA4 event timestamp

    // SEO Automation Subscription
    seoTier: varchar('seo_tier', { length: 20 }).default('free'), // 'free', 'basic', 'pro', 'agency'
    seoTrialStartsAt: timestamp('seo_trial_starts_at'),
    seoTrialEndsAt: timestamp('seo_trial_ends_at'),
    seoSubscriptionStartsAt: timestamp('seo_subscription_starts_at'),
    seoMonthlyUsage: jsonb('seo_monthly_usage').default({}), // { "2025-10": { "google_extraction": 3, "schema_validation": 5 } }
    seoTotalOptimizations: integer('seo_total_optimizations').default(0),

    // Admin/Role Management
    role: varchar('role', { length: 50 }).default('user'),
    isAdministrator: boolean('is_administrator').default(false),
    adminLevel: varchar('admin_level', { length: 50 }),
    adminPermissions: jsonb('admin_permissions'),

    // Onboarding Tracking
    approvedAt: timestamp('approved_at'),
    hasCompletedUniversalOnboarding: boolean('has_completed_universal_onboarding').default(false),
    universalOnboardingCompletedAt: timestamp('universal_onboarding_completed_at'),
    hasEnteredUniversalDashboard: boolean('has_entered_universal_dashboard').default(false),
    universalDashboardFirstAccessAt: timestamp('universal_dashboard_first_access_at'),

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
    isActive: boolean('is_active').default(true),
    scheduledFor: timestamp('scheduled_for'),
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

// Wedding Timeline Suggestions
export const weddingTimelineSuggestions = pgTable(
  'wedding_timeline_suggestions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineId: varchar('timeline_id').references(() => weddingTimelines.id),
    eventTitle: varchar('event_title', { length: 255 }).notNull(),
    suggestedTime: varchar('suggested_time', { length: 50 }).notNull(),
    reason: text('reason').notNull(),
    priority: varchar('priority', { length: 50 }).default('medium'),
    status: varchar('status', { length: 50 }).default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('wedding_timeline_suggestions_timeline_id_idx').on(table.timelineId),
    statusIdx: index('wedding_timeline_suggestions_status_idx').on(table.status),
  }),
);

// Timeline Changes (Client-Requested Changes to Wedding Timelines)
export const timelineChanges = pgTable(
  'timeline_changes',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineId: varchar('timeline_id').references(() => weddingTimelines.id),
    changeType: varchar('change_type', { length: 100 }).notNull(), // 'time_change', 'venue_change', 'event_addition', 'event_removal', 'comment'
    changeData: jsonb('change_data'), // { originalValue, requestedValue, eventName, etc. }
    requestedBy: varchar('requested_by', { length: 255 }), // Client name/email
    requestReason: text('request_reason'),
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'approved', 'rejected'
    reviewedBy: varchar('reviewed_by', { length: 255 }), // Photographer who reviewed
    reviewedAt: timestamp('reviewed_at'),
    requestedAt: timestamp('requested_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('timeline_changes_timeline_id_idx').on(table.timelineId),
    statusIdx: index('timeline_changes_status_idx').on(table.status),
    requestedAtIdx: index('timeline_changes_requested_at_idx').on(table.requestedAt),
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

export const quotes = pgTable(
  'quotes',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    quoteNumber: varchar('quote_number').notNull(),
    clientId: varchar('client_id').notNull(),
    clientName: varchar('client_name'),
    clientEmail: varchar('client_email'),
    submissionId: varchar('submission_id'),
    // Quote details from QuoteCreationModal
    title: varchar('title', { length: 255 }),
    description: text('description'),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }),
    additionalServices: jsonb('additional_services'), // array of service strings
    // Original fields
    services: jsonb('services').notNull(),
    additionalCosts: jsonb('additional_costs'),
    discounts: jsonb('discounts'),
    subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
    mva: decimal('mva', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency'),
    status: varchar('status'), // pending, accepted, rejected, expired
    validUntil: timestamp('valid_until'),
    contractId: varchar('contract_id'),
    invoiceId: varchar('invoice_id'),
    notes: text('notes'),
    internalNotes: text('internal_notes'),
    // Client and approver information for project creation
    clientInfo: jsonb('client_info'), // { name, address, phoneNumber, email }
    approvers: jsonb('approvers'), // array of approver objects
    projectCreationData: jsonb('project_creation_data'), // complete data for creating project
    businessInfo: jsonb('business_info'), // { businessName, logo, email, phone, address, brandingColor, etc. }
    projectId: varchar('project_id'), // linked project after quote accepted
    profession: varchar('profession'), // photographer, videographer, etc.
    projectType: varchar('project_type'), // wedding, portrait, etc.

    // Contract amendment tracking for extra images/services
    quoteType: varchar('quote_type', { length: 50 }).default('standard'), // standard, extra_images, contract_amendment, additional_services
    contractAmendmentFor: varchar('contract_amendment_for'), // Original contract/gallery ID if this is an amendment

    createdBy: varchar('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    sentAt: timestamp('sent_at'),
    viewedAt: timestamp('viewed_at'),
    respondedAt: timestamp('responded_at'),
    acceptedAt: timestamp('accepted_at'),

    // Fiken invoice tracking
    fikenInvoiceId: varchar('fiken_invoice_id'),
    fikenInvoiceNumber: varchar('fiken_invoice_number'),
    fikenCustomerId: varchar('fiken_customer_id'),
    fikenIssueDate: date('fiken_issue_date'),
    fikenDueDate: date('fiken_due_date'),
    fikenInvoiceUrl: text('fiken_invoice_url'),
    fikenInvoiceStatus: varchar('fiken_invoice_status', { length: 50 }).default('draft'),
    fikenSyncStatus: varchar('fiken_sync_status', { length: 50 }).default('pending'),
    fikenSyncedAt: timestamp('fiken_synced_at'),
    fikenLastError: text('fiken_last_error'),
  },
  (table) => ({
    clientIdIdx: index('quotes_client_id_idx').on(table.clientId),
    quoteNumberIdx: index('quotes_quote_number_idx').on(table.quoteNumber),
    statusIdx: index('quotes_status_idx').on(table.status),
    projectIdIdx: index('quotes_project_id_idx').on(table.projectId),
    fikenInvoiceIdIdx: index('quotes_fiken_invoice_id_idx').on(table.fikenInvoiceId),
    fikenCustomerIdIdx: index('quotes_fiken_customer_id_idx').on(table.fikenCustomerId),
    fikenInvoiceStatusIdx: index('quotes_fiken_invoice_status_idx').on(table.fikenInvoiceStatus),
    fikenSyncStatusIdx: index('quotes_fiken_sync_status_idx').on(table.fikenSyncStatus),
    quoteTypeIdx: index('quotes_quote_type_idx').on(table.quoteType),
    contractAmendmentForIdx: index('quotes_contract_amendment_for_idx').on(
      table.contractAmendmentFor,
    ),
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
    revenue: decimal('revenue', { precision: 15, scale: 2 }).default('0'),
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

    // Fiken kjørebok (mileage log) integration
    fikenTravelLogId: varchar('fiken_travel_log_id'),
    fikenSyncStatus: varchar('fiken_sync_status', { length: 50 }).default('pending'), // 'pending', 'synced', 'failed'
    fikenSyncedAt: timestamp('fiken_synced_at'),
    fikenLastError: text('fiken_last_error'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('travel_log_user_id_idx').on(table.userId),
    projectIdIdx: index('travel_log_project_id_idx').on(table.projectId),
    fikenTravelLogIdIdx: index('travel_log_fiken_travel_log_id_idx').on(table.fikenTravelLogId),
    fikenSyncStatusIdx: index('travel_log_fiken_sync_status_idx').on(table.fikenSyncStatus),
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
    startedAt: timestamp('started_at').defaultNow(), // Match actual DB column
    expiresAt: timestamp('expires_at'), // Match actual DB column
    autoRenew: boolean('auto_renew').default(true),
    paymentMethod: varchar('payment_method', { length: 100 }),
    amount: decimal('amount', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    nextBillingDate: timestamp('next_billing_date'),
    paymentMethodId: varchar('payment_method_id', { length: 255 }),
    cancelledAt: timestamp('cancelled_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_subscriptions_user_id_idx').on(table.userId),
    planIdIdx: index('user_subscriptions_plan_id_idx').on(table.planId),
  }),
);

// Marketplace Feature Purchases
export const marketplacePurchases = pgTable(
  'marketplace_purchases',
  {
    id: varchar('id', { length: 21 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    featureId: varchar('feature_id', { length: 100 }).notNull(),
    profession: varchar('profession', { length: 50 }).notNull(),
    price: integer('price').notNull(), // In NOK
    currency: varchar('currency', { length: 3 }).default('NOK'),
    status: varchar('status', { length: 50 }).default('completed'), // completed, refunded, cancelled
    paymentMethodId: varchar('payment_method_id', { length: 255 }),
    transactionId: varchar('transaction_id', { length: 255 }),
    purchasedAt: timestamp('purchased_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'), // For trial periods or monthly subscriptions
    autoRenew: boolean('auto_renew').default(true),
    lastRenewalAt: timestamp('last_renewal_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('marketplace_purchases_user_id_idx').on(table.userId),
    featureIdIdx: index('marketplace_purchases_feature_id_idx').on(table.featureId),
    statusIdx: index('marketplace_purchases_status_idx').on(table.status),
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

// Relations
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
  images: many(images),
  projectBackups: many(projectBackups),
  seoCampaigns: many(seoCampaigns),
  googlePaySubscriptions: many(googlePaySubscriptions),
  googlePayTransactions: many(googlePayTransactions),
}));

export const crmPipelineStagesRelations = relations(crmPipelineStages, () => ({
  // Add relations as needed when other CRM tables are added
}));

export const crmEmailTemplatesRelations = relations(crmEmailTemplates, () => ({
  // Add relations as needed when other CRM tables are added
}));

// Memory card relations moved to memory-card-schema.ts

// Backup session relations moved to memory-card-schema.ts

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

// Project management schemas
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
// RELATIONS FOR NEW GOOGLE SERVICES TABLES
// ============================================================================

export const imagesRelations = relations(images, ({ one }) => ({
  project: one(projects, {
    fields: [images.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [images.userId],
    references: [users.id],
  }),
}));

export const projectBackupsRelations = relations(projectBackups, ({ one }) => ({
  project: one(projects, {
    fields: [projectBackups.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectBackups.userId],
    references: [users.id],
  }),
}));

export const seoCampaignsRelations = relations(seoCampaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [seoCampaigns.userId],
    references: [users.id],
  }),
  keywords: many(seoKeywords),
}));

export const seoKeywordsRelations = relations(seoKeywords, ({ one }) => ({
  campaign: one(seoCampaigns, {
    fields: [seoKeywords.campaignId],
    references: [seoCampaigns.id],
  }),
}));

export const googlePaySubscriptionsRelations = relations(
  googlePaySubscriptions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [googlePaySubscriptions.userId],
      references: [users.id],
    }),
    transactions: many(googlePayTransactions),
  }),
);

export const googlePayTransactionsRelations = relations(googlePayTransactions, ({ one }) => ({
  subscription: one(googlePaySubscriptions, {
    fields: [googlePayTransactions.subscriptionId],
    references: [googlePaySubscriptions.id],
  }),
  user: one(users, {
    fields: [googlePayTransactions.userId],
    references: [users.id],
  }),
}));

export const googlePayProductsRelations = relations(googlePayProducts, ({ many }) => ({
  subscriptions: many(googlePaySubscriptions),
}));

export const googlePayBillingIssuesRelations = relations(googlePayBillingIssues, ({ one }) => ({
  subscription: one(googlePaySubscriptions, {
    fields: [googlePayBillingIssues.subscriptionId],
    references: [googlePaySubscriptions.id],
  }),
  user: one(users, {
    fields: [googlePayBillingIssues.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// INSERT SCHEMAS FOR NEW CORE TABLES
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

// Zod Schemas
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
export const insertUserPreferencesSchema = insertUserPreferenceSchema; // Alias for compatibility
export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs);
export const insertUserConsentSchema = createInsertSchema(userConsents);
export const insertUserFileSchema = createInsertSchema(userFiles);
export const insertUserEquipmentSchema = createInsertSchema(userEquipment);
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions);
export const insertMarketplacePurchaseSchema = createInsertSchema(marketplacePurchases);
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

// Note: Photo Suite, Studio Manager, Story Arc, Audio Enhancement, and Mini-Sora insert schemas
// are defined after their table definitions (around line 5715)

// ============================================================================
// INSERT SCHEMAS FOR NEW GOOGLE SERVICES TABLES
// ============================================================================

// ============================================================================
// TYPESCRIPT TYPES FOR NEW CORE TABLES
// ============================================================================

// Type Exports
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

export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;
export type InsertMarketplacePurchase = z.infer<typeof insertMarketplacePurchaseSchema>;

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
// TYPESCRIPT TYPES FOR PHOTO SUITE TABLES
// ============================================================================

export type PhotoSuiteUserPreferences = typeof photoSuiteUserPreferences.$inferSelect;
export type InsertPhotoSuiteUserPreferences = z.infer<typeof insertPhotoSuiteUserPreferencesSchema>;

export type PhotoEditHistory = typeof photoEditHistory.$inferSelect;
export type InsertPhotoEditHistory = z.infer<typeof insertPhotoEditHistorySchema>;

export type PhotoEnhancementJob = typeof photoEnhancementJobs.$inferSelect;
export type InsertPhotoEnhancementJob = z.infer<typeof insertPhotoEnhancementJobSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR STORY ARC STUDIO TABLES
// ============================================================================

export type StudioUserPreferences = typeof studioUserPreferences.$inferSelect;
export type InsertStudioUserPreferences = z.infer<typeof insertStudioUserPreferencesSchema>;

export type StoryArcSession = typeof storyArcSessions.$inferSelect;
export type InsertStoryArcSession = z.infer<typeof insertStoryArcSessionSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR AI VIDEO & AUDIO ANALYSIS TABLES
// ============================================================================

export type VideoSceneAnalysis = typeof videoSceneAnalysis.$inferSelect;
export type InsertVideoSceneAnalysis = z.infer<typeof insertVideoSceneAnalysisSchema>;

export type BatchVideoAnalysis = typeof batchVideoAnalysis.$inferSelect;
export type InsertBatchVideoAnalysis = z.infer<typeof insertBatchVideoAnalysisSchema>;

export type AudioAnalysis = typeof audioAnalysis.$inferSelect;
export type InsertAudioAnalysis = z.infer<typeof insertAudioAnalysisSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR AUDIO ENHANCEMENT TABLES
// ============================================================================

export type AudioEnhancementUserPreferences = typeof audioEnhancementUserPreferences.$inferSelect;
export type InsertAudioEnhancementUserPreferences = z.infer<
  typeof insertAudioEnhancementUserPreferencesSchema
>;

export type AudioEnhancementJob = typeof audioEnhancementJobs.$inferSelect;
export type InsertAudioEnhancementJob = z.infer<typeof insertAudioEnhancementJobSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR NEW GOOGLE SERVICES TABLES
// ============================================================================

export type Image = typeof images.$inferSelect;
export type InsertImage = z.infer<typeof insertImageSchema>;

export type ProjectBackup = typeof projectBackups.$inferSelect;
export type InsertProjectBackup = z.infer<typeof insertProjectBackupSchema>;

export type SeoCampaign = typeof seoCampaigns.$inferSelect;
export type InsertSeoCampaign = z.infer<typeof insertSeoCampaignSchema>;

export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type InsertSeoKeyword = z.infer<typeof insertSeoKeywordSchema>;

export type SeoPage = typeof seoPages.$inferSelect;
export type InsertSeoPage = z.infer<typeof insertSeoPageSchema>;

export type SeoBacklink = typeof seoBacklinks.$inferSelect;
export type InsertSeoBacklink = z.infer<typeof insertSeoBacklinkSchema>;

export type GooglePaySubscription = typeof googlePaySubscriptions.$inferSelect;
export type InsertGooglePaySubscription = z.infer<typeof insertGooglePaySubscriptionSchema>;

export type GooglePayTransaction = typeof googlePayTransactions.$inferSelect;
export type InsertGooglePayTransaction = z.infer<typeof insertGooglePayTransactionSchema>;

export type GooglePayProduct = typeof googlePayProducts.$inferSelect;
export type InsertGooglePayProduct = z.infer<typeof insertGooglePayProductSchema>;

export type GooglePayBillingIssue = typeof googlePayBillingIssues.$inferSelect;
export type InsertGooglePayBillingIssue = z.infer<typeof insertGooglePayBillingIssueSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR WEDDING & TIMELINE MANAGEMENT TABLES
// ============================================================================

export type WeddingTimelineClientSettings = typeof weddingTimelineClientSettings.$inferSelect;
export type InsertWeddingTimelineClientSettings = z.infer<
  typeof insertWeddingTimelineClientSettingsSchema
>;

export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;

export type ShotList = typeof shotLists.$inferSelect;
export type InsertShotList = z.infer<typeof insertShotListSchema>;

export type ShotListItem = typeof shotListItems.$inferSelect;
export type InsertShotListItem = z.infer<typeof insertShotListItemSchema>;

export type QuickMessageTemplate = typeof quickMessageTemplates.$inferSelect;
export type InsertQuickMessageTemplate = z.infer<typeof insertQuickMessageTemplateSchema>;

export type TimelineAdjustmentHistory = typeof timelineAdjustmentHistory.$inferSelect;
export type InsertTimelineAdjustmentHistory = z.infer<typeof insertTimelineAdjustmentHistorySchema>;

export type WeddingDayNote = typeof weddingDayNotes.$inferSelect;
export type InsertWeddingDayNote = z.infer<typeof insertWeddingDayNoteSchema>;

export type TimelineAccessGrant = typeof timelineAccessGrants.$inferSelect;
export type InsertTimelineAccessGrant = z.infer<typeof insertTimelineAccessGrantSchema>;

export type ProjectTimelineLink = typeof projectTimelineLinks.$inferSelect;
export type InsertProjectTimelineLink = z.infer<typeof insertProjectTimelineLinkSchema>;

export type TimelineGoogleDriveSync = typeof timelineGoogleDriveSync.$inferSelect;
export type InsertTimelineGoogleDriveSync = z.infer<typeof insertTimelineGoogleDriveSyncSchema>;

export type WeddingCulture = typeof weddingCultures.$inferSelect;
export type InsertWeddingCulture = z.infer<typeof insertWeddingCultureSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR LIGHTING & EQUIPMENT TABLES
// ============================================================================

export type LightingEquipment = typeof lightingEquipment.$inferSelect;
export type InsertLightingEquipment = z.infer<typeof insertLightingEquipmentSchema>;

export type LightingSetup = typeof lightingSetups.$inferSelect;
export type InsertLightingSetup = z.infer<typeof insertLightingSetupSchema>;

export type LightingModel = typeof lightingModels.$inferSelect;
export type InsertLightingModel = z.infer<typeof insertLightingModelSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR SHOWCASE TABLES
// ============================================================================

export type ShowcaseItem = typeof showcaseItems.$inferSelect;
export type InsertShowcaseItem = z.infer<typeof insertShowcaseItemSchema>;

export type ShowcaseCategory = typeof showcaseCategories.$inferSelect;
export type InsertShowcaseCategory = z.infer<typeof insertShowcaseCategorySchema>;

export type ShowcaseTemplate = typeof showcaseTemplates.$inferSelect;
export type InsertShowcaseTemplate = z.infer<typeof insertShowcaseTemplateSchema>;

export type ShowcaseSettings = typeof showcaseSettings.$inferSelect;
export type InsertShowcaseSettings = z.infer<typeof insertShowcaseSettingsSchema>;

export type ShowcaseComment = typeof showcaseComments.$inferSelect;
export type InsertShowcaseComment = z.infer<typeof insertShowcaseCommentSchema>;

export type ShowcaseDriveSync = typeof showcaseDriveSync.$inferSelect;
export type InsertShowcaseDriveSync = z.infer<typeof insertShowcaseDriveSyncSchema>;

export type ShowcaseContentItem = typeof showcaseContentItems.$inferSelect;
export type InsertShowcaseContentItem = z.infer<typeof insertShowcaseContentItemSchema>;

export type ShowcaseGallery = typeof showcaseGalleries.$inferSelect;
export type InsertShowcaseGallery = z.infer<typeof insertShowcaseGallerySchema>;

export type SmartAlbum = typeof smartAlbums.$inferSelect;
export type InsertSmartAlbum = z.infer<typeof insertSmartAlbumSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR PHOTO SESSION TABLES
// ============================================================================

export type PhotoSession = typeof photoSessions.$inferSelect;
export type InsertPhotoSession = z.infer<typeof insertPhotoSessionSchema>;

// ============================================================================
// TYPESCRIPT TYPES FOR ADDITIONAL MISSING TABLES
// ============================================================================

export type InviteRequest = typeof inviteRequests.$inferSelect;
export type InsertInviteRequest = z.infer<typeof insertInviteRequestSchema>;

export type ProjectEmail = typeof projectEmails.$inferSelect;
export type InsertProjectEmail = z.infer<typeof insertProjectEmailSchema>;

export type ClientSubmission = typeof clientSubmissions.$inferSelect;
export type InsertClientSubmission = z.infer<typeof insertClientSubmissionSchema>;

export type PrototypeFeedback = typeof prototypeFeedback.$inferSelect;
export type InsertPrototypeFeedback = z.infer<typeof insertPrototypeFeedbackSchema>;

// ============================================================================
// WEDDING & TIMELINE MANAGEMENT SYSTEM
// ============================================================================

// Wedding Timeline Client Settings
export const weddingTimelineClientSettings = pgTable(
  'wedding_timeline_client_settings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineId: varchar('timeline_id').notNull(),
    clientId: varchar('client_id').notNull(),
    settings: jsonb('settings').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('wedding_timeline_client_settings_timeline_id_idx').on(table.timelineId),
    clientIdIdx: index('wedding_timeline_client_settings_client_id_idx').on(table.clientId),
  }),
);

// ============================================================================
// WEDDING DAY EXECUTION SYSTEM (Shot Lists, Quick Messages, Day Notes)
// ============================================================================

// Shot Lists - Wedding/Event Shot Checklists
export const shotLists = pgTable(
  'shot_lists',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').references(() => projects.id),
    weddingTimelineId: varchar('wedding_timeline_id').references(() => weddingTimelines.id),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),

    // Template & Cultural Support
    templateType: varchar('template_type', { length: 100 }).default('wedding'), // wedding, corporate, event, custom
    culture: varchar('culture', { length: 100 }).default('norsk'), // Cultural template

    // Shot Data (JSONB for flexibility)
    shotsData: jsonb('shots_data')
      .$type<
        Array<{
          id: string;
          title: string;
          description: string;
          scene: string;
          shotType: 'Wide' | 'Medium' | 'Close-up' | 'Detail' | 'Establishing';
          duration: number;
          priority: 'Low' | 'Medium' | 'High' | 'Critical';
          status: 'Planned' | 'In Progress' | 'Completed' | 'Review';
          completedAt?: string;
          equipment?: string[];
          notes?: string;
        }>
      >()
      .default([]),

    // Progress Tracking
    totalShots: integer('total_shots').default(0),
    completedShots: integer('completed_shots').default(0),
    criticalShots: integer('critical_shots').default(0),
    completedCriticalShots: integer('completed_critical_shots').default(0),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('shot_lists_project_id_idx').on(table.projectId),
    userIdIdx: index('shot_lists_user_id_idx').on(table.userId),
    weddingTimelineIdIdx: index('shot_lists_wedding_timeline_id_idx').on(table.weddingTimelineId),
  }),
);

// Shot List Items - Individual Shots (Normalized structure for advanced queries)
export const shotListItems = pgTable(
  'shot_list_items',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    shotListId: varchar('shot_list_id')
      .notNull()
      .references(() => shotLists.id, { onDelete: 'cascade' }),

    // Shot Details
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    scene: varchar('scene', { length: 100 }).notNull(), // Ceremony, Reception, Portraits, etc.
    shotType: varchar('shot_type', { length: 50 }).notNull(), // Wide, Medium, Close-up, Detail, Establishing
    duration: integer('duration').default(0), // seconds
    priority: varchar('priority', { length: 50 }).default('Medium'), // Low, Medium, High, Critical

    // Status & Completion
    status: varchar('status', { length: 50 }).default('Planned'), // Planned, In Progress, Completed, Review
    completedAt: timestamp('completed_at'),
    completedBy: varchar('completed_by'),

    // Equipment & Settings
    equipment: jsonb('equipment').$type<string[]>().default([]),
    cameraSettings: text('camera_settings'),
    notes: text('notes'),

    // Timeline Integration
    timelineEventId: varchar('timeline_event_id'), // Link to timeline event
    scheduledTime: varchar('scheduled_time', { length: 10 }), // HH:MM format

    // Mobile Features
    locationHint: text('location_hint'),
    referenceImages: jsonb('reference_images').$type<string[]>().default([]),

    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    shotListIdIdx: index('shot_list_items_shot_list_id_idx').on(table.shotListId),
    sceneIdx: index('shot_list_items_scene_idx').on(table.scene),
    statusIdx: index('shot_list_items_status_idx').on(table.status),
    priorityIdx: index('shot_list_items_priority_idx').on(table.priority),
  }),
);

// Quick Message Templates - Wedding Day Team Coordination
export const quickMessageTemplates = pgTable(
  'quick_message_templates',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').references(() => users.id), // NULL = system default

    // Message Content
    messageText: text('message_text').notNull(),
    label: varchar('label', { length: 100 }).notNull(),

    // Categorization
    category: varchar('category', { length: 50 }).notNull(), // status, location, timing, coordination
    profession: varchar('profession', { length: 100 }).default('photographer'), // photographer, videographer

    // Visual
    icon: varchar('icon', { length: 50 }).default('Send'),
    color: varchar('color', { length: 7 }).default('#2196F3'),

    // Usage Tracking
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Customization
    isSystemDefault: boolean('is_system_default').default(false),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('quick_message_templates_user_id_idx').on(table.userId),
    categoryIdx: index('quick_message_templates_category_idx').on(table.category),
    professionIdx: index('quick_message_templates_profession_idx').on(table.profession),
  }),
);

// Timeline Adjustment History - Audit Trail for Auto-Adjust Feature
export const timelineAdjustmentHistory = pgTable(
  'timeline_adjustment_history',
  {
    id: serial('id').primaryKey(),
    timelineId: varchar('timeline_id')
      .notNull()
      .references(() => weddingTimelines.id),

    // Adjustment Details
    adjustmentType: varchar('adjustment_type', { length: 50 }).notNull(), // delay, revert, manual
    sourceEventId: varchar('source_event_id'), // Event that was marked delayed
    sourceEventTitle: varchar('source_event_title', { length: 255 }),

    // Delay Information
    delayMinutes: integer('delay_minutes').default(0),
    delayReason: text('delay_reason'),

    // Impact
    affectedEventsCount: integer('affected_events_count').default(0),
    affectedEventIds: jsonb('affected_event_ids').$type<string[]>().default([]),

    // Revert Information
    wasReverted: boolean('was_reverted').default(false),
    revertedAt: timestamp('reverted_at'),
    revertedBy: varchar('reverted_by'),

    // Audit
    performedBy: varchar('performed_by').notNull(),
    performedAt: timestamp('performed_at').defaultNow(),

    // Notification Status
    notificationsSent: boolean('notifications_sent').default(false),
    notifiedUsers: jsonb('notified_users').$type<string[]>().default([]),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('timeline_adjustment_history_timeline_id_idx').on(table.timelineId),
    performedAtIdx: index('timeline_adjustment_history_performed_at_idx').on(table.performedAt),
    adjustmentTypeIdx: index('timeline_adjustment_history_adjustment_type_idx').on(
      table.adjustmentType,
    ),
  }),
);

// Wedding Day Notes - Quick Notes During Execution
export const weddingDayNotes = pgTable(
  'wedding_day_notes',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineId: varchar('timeline_id')
      .notNull()
      .references(() => weddingTimelines.id),
    eventId: varchar('event_id'), // Optional - link to specific event
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Note Content
    noteText: text('note_text').notNull(),
    noteType: varchar('note_type', { length: 50 }).default('general'), // general, shot, equipment, issue, client_request

    // Context
    timeRecorded: varchar('time_recorded', { length: 10 }), // HH:MM when note was taken
    location: varchar('location', { length: 255 }),

    // Media Attachments
    photoUrl: text('photo_url'),
    voiceNoteUrl: text('voice_note_url'),

    // Follow-up
    requiresFollowUp: boolean('requires_follow_up').default(false),
    followUpCompleted: boolean('follow_up_completed').default(false),
    followUpCompletedAt: timestamp('follow_up_completed_at'),

    // Priority
    priority: varchar('priority', { length: 20 }).default('normal'), // low, normal, high, urgent

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('wedding_day_notes_timeline_id_idx').on(table.timelineId),
    eventIdIdx: index('wedding_day_notes_event_id_idx').on(table.eventId),
    userIdIdx: index('wedding_day_notes_user_id_idx').on(table.userId),
    priorityIdx: index('wedding_day_notes_priority_idx').on(table.priority),
  }),
);

// Timeline Events (Enhanced with Auto-Adjust functionality)
export const timelineEvents = pgTable(
  'timeline_events',
  {
    id: serial('id').primaryKey(),
    timelineId: varchar('timeline_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    startTime: varchar('start_time', { length: 10 }).notNull(), // HH:MM format
    endTime: varchar('end_time', { length: 10 }).notNull(), // HH:MM format

    // Auto-Adjust Feature (inspired by Day of Timeline)
    originalStartTime: varchar('original_start_time', { length: 10 }), // Store original for revert
    originalEndTime: varchar('original_end_time', { length: 10 }),
    currentDelay: integer('current_delay').default(0), // Minutes delayed
    isDelayed: boolean('is_delayed').default(false),
    delayReason: text('delay_reason'),
    autoAdjusted: boolean('auto_adjusted').default(false), // Was this auto-adjusted?
    affectsDownstream: boolean('affects_downstream').default(true), // Does delay ripple?

    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('timeline_events_timeline_id_idx').on(table.timelineId),
    sortOrderIdx: index('timeline_events_sort_order_idx').on(table.sortOrder),
    isDelayedIdx: index('timeline_events_is_delayed_idx').on(table.isDelayed),
  }),
);

// Timeline Access Grants
export const timelineAccessGrants = pgTable(
  'timeline_access_grants',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineId: varchar('timeline_id').notNull(),
    accessToken: varchar('access_token', { length: 255 }).notNull().unique(),
    grantedTo: varchar('granted_to', { length: 255 }).notNull(), // email or user ID
    permissions: jsonb('permissions').default({}),
    isActive: boolean('is_active').default(true),
    expiresAt: timestamp('expires_at'),
    grantedAt: timestamp('granted_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('timeline_access_grants_timeline_id_idx').on(table.timelineId),
    accessTokenIdx: index('timeline_access_grants_access_token_idx').on(table.accessToken),
  }),
);

// Project Timeline Links
export const projectTimelineLinks = pgTable(
  'project_timeline_links',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').notNull(),
    timelineId: varchar('timeline_id').notNull(),
    photographerId: varchar('photographer_id').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('project_timeline_links_project_id_idx').on(table.projectId),
    timelineIdIdx: index('project_timeline_links_timeline_id_idx').on(table.timelineId),
    photographerIdIdx: index('project_timeline_links_photographer_id_idx').on(table.photographerId),
  }),
);

// Timeline Google Drive Sync
export const timelineGoogleDriveSync = pgTable(
  'timeline_google_drive_sync',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineId: varchar('timeline_id').notNull(),
    driveFolderId: varchar('drive_folder_id', { length: 255 }).notNull(),
    syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
    lastSyncAt: timestamp('last_sync_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineIdIdx: index('timeline_google_drive_sync_timeline_id_idx').on(table.timelineId),
    driveFolderIdIdx: index('timeline_google_drive_sync_drive_folder_id_idx').on(
      table.driveFolderId,
    ),
  }),
);

// Wedding Cultures
export const weddingCultures = pgTable(
  'wedding_cultures',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    traditions: jsonb('traditions'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('wedding_cultures_name_idx').on(table.name),
    displayNameIdx: index('wedding_cultures_display_name_idx').on(table.displayName),
  }),
);

// ============================================================================
// LIGHTING & EQUIPMENT SYSTEM
// ============================================================================

// Lighting Equipment
export const lightingEquipment = pgTable(
  'lighting_equipment',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    brand: varchar('brand', { length: 100 }),
    model: varchar('model', { length: 100 }),
    category: varchar('category', { length: 100 }).notNull(),
    specifications: jsonb('specifications'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('lighting_equipment_user_id_idx').on(table.userId),
    categoryIdx: index('lighting_equipment_category_idx').on(table.category),
  }),
);

// Lighting Setups
export const lightingSetups = pgTable(
  'lighting_setups',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    equipment: jsonb('equipment').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('lighting_setups_user_id_idx').on(table.userId),
  }),
);

// Lighting Models
export const lightingModels = pgTable(
  'lighting_models',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    modelData: jsonb('model_data').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('lighting_models_user_id_idx').on(table.userId),
  }),
);

// ============================================================================
// SHOWCASE SYSTEM
// ============================================================================

// Showcase Items
export const showcaseItems = pgTable(
  'showcase_items',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),
    category: varchar('category', { length: 100 }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    thumbnailUrl: text('thumbnail_url'),
    cropData: jsonb('crop_data'),
    thumbnailData: jsonb('thumbnail_data'),
    isPublic: boolean('is_public').default(false),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('showcase_items_user_id_idx').on(table.userId),
    professionIdx: index('showcase_items_profession_idx').on(table.profession),
    categoryIdx: index('showcase_items_category_idx').on(table.category),
  }),
);

// Showcase Categories
export const showcaseCategories = pgTable(
  'showcase_categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionIdx: index('showcase_categories_profession_idx').on(table.profession),
  }),
);

// Showcase Templates
export const showcaseTemplates = pgTable(
  'showcase_templates',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),
    templateData: jsonb('template_data').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionIdx: index('showcase_templates_profession_idx').on(table.profession),
  }),
);

// Showcase Settings
export const showcaseSettings = pgTable(
  'showcase_settings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    settings: jsonb('settings').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('showcase_settings_user_id_idx').on(table.userId),
  }),
);

// Showcase Comments
export const showcaseComments = pgTable(
  'showcase_comments',
  {
    id: serial('id').primaryKey(),
    showcaseId: varchar('showcase_id').notNull(),
    showcaseItemId: varchar('showcase_item_id'), // Reference to specific item
    projectId: varchar('project_id'), // NEW: Link to project for timeline integration
    userId: varchar('user_id'),
    userName: varchar('user_name', { length: 255 }),
    userEmail: varchar('user_email', { length: 255 }),
    comment: text('comment').notNull(),
    commentType: varchar('comment_type', { length: 50 }).default('general'), // general, revision, approval, feedback
    rating: integer('rating'),
    isApproved: boolean('is_approved').default(false),
    isPrivate: boolean('is_private').default(false), // Private comments visible only to creator
    isResolved: boolean('is_resolved').default(false), // Track if comment has been addressed
    status: varchar('status', { length: 50 }).default('pending'), // pending, approved, rejected
    parentCommentId: integer('parent_comment_id'), // For threaded replies
    timestampSeconds: integer('timestamp_seconds'), // For video/audio timestamp comments
    photographerResponse: text('photographer_response'), // Response from creator
    metadata: jsonb('metadata'), // Additional data (proofing context, etc.)
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    showcaseIdIdx: index('showcase_comments_showcase_id_idx').on(table.showcaseId),
    projectIdIdx: index('showcase_comments_project_id_idx').on(table.projectId),
    statusIdx: index('showcase_comments_status_idx').on(table.status),
  }),
);

// Showcase Drive Sync
export const showcaseDriveSync = pgTable('showcase_drive_sync', {
  id: serial('id').primaryKey(),
  showcaseId: varchar('showcase_id').notNull(),
  userId: varchar('user_id').notNull(),
  driveFolderId: varchar('drive_folder_id', { length: 255 }),
  syncStatus: varchar('sync_status', { length: 50 }).default('pending'),
  lastSyncedAt: timestamp('last_synced_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Showcase Content Items
export const showcaseContentItems = pgTable('showcase_content_items', {
  id: serial('id').primaryKey(),
  showcaseId: varchar('showcase_id').notNull(),
  userId: varchar('user_id').notNull(),
  contentType: varchar('content_type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  mediaUrl: text('media_url'),
  thumbnailUrl: text('thumbnail_url'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Showcase Galleries
export const showcaseGalleries = pgTable('showcase_galleries', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverImageUrl: text('cover_image_url'),
  isPublic: boolean('is_public').default(false),
  sortOrder: integer('sort_order').default(0),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Smart Albums
export const smartAlbums = pgTable('smart_albums', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  criteria: jsonb('criteria').notNull(),
  autoUpdate: boolean('auto_update').default(true),
  coverImageUrl: text('cover_image_url'),
  itemCount: integer('item_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// VIDEO EDITOR - TIMELINE PROJECTS (Save/Load Editing Sessions)
// ============================================================================

export const timelineProjects = pgTable(
  'timeline_projects',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),

    // Project info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Timeline state (complete save)
    timelineData: jsonb('timeline_data').notNull().$type<{
      clips: unknown[];
      tracks: unknown[];
      totalDuration: number;
      zoom: number;
      appliedEffects: unknown[];
      appliedTransitions: unknown[];
      textOverlays: unknown[];
      captions: unknown[];
    }>(),

    // Metadata
    version: integer('version').default(1),
    thumbnailUrl: text('thumbnail_url'),
    duration: integer('duration').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('timeline_projects_user_id_idx').on(table.userId),
    projectIdIdx: index('timeline_projects_project_id_idx').on(table.projectId),
    createdAtIdx: index('timeline_projects_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// VIDEO EDITOR - LUT LIBRARY (627 Professional LUTs)
// ============================================================================

export const luts = pgTable(
  'luts',
  {
    id: serial('id').primaryKey(),

    // LUT info
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(), // 'cultural', 'script', 'creative'

    // Cultural LUTs
    culture: varchar('culture', { length: 100 }), // 'sikh', 'indian', 'norsk', etc.

    // Script LUTs (Camera LOG)
    camera: varchar('camera', { length: 100 }), // 'Sony', 'Canon', 'ARRI', etc.
    logFormat: varchar('log_format', { length: 100 }), // 'S-Log3', 'C-Log', 'V-Log', etc.

    // File data
    filePath: varchar('file_path', { length: 500 }).notNull(),
    fileContent: text('file_content'), // .cube file content (for direct parsing)
    lutSize: integer('lut_size').default(33), // 17, 33, or 65

    // Metadata
    description: text('description'),
    author: varchar('author', { length: 255 }),
    previewImage: text('preview_image'),

    // Usage tracking
    usageCount: integer('usage_count').default(0),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    categoryIdx: index('luts_category_idx').on(table.category),
    cultureIdx: index('luts_culture_idx').on(table.culture),
    cameraIdx: index('luts_camera_idx').on(table.camera),
    nameIdx: index('luts_name_idx').on(table.name),
  }),
);

// ============================================================================
// VIDEO EDITOR - EXPORT JOBS (Track Rendering Progress)
// ============================================================================

export const videoExportJobs = pgTable(
  'video_export_jobs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),
    timelineProjectId: varchar('timeline_project_id').references(() => timelineProjects.id),

    // Export settings
    resolution: varchar('resolution', { length: 50 }).notNull(), // '4k', '1080p', '720p', '9:16', '1:1', '4:5'
    codec: varchar('codec', { length: 50 }).notNull(), // 'H.264', 'H.265', 'VP9'
    format: varchar('format', { length: 20 }).notNull(), // 'MP4', 'MOV', 'WebM'
    bitrate: integer('bitrate'), // Mbps
    audioCodec: varchar('audio_codec', { length: 50 }), // 'AAC', 'Opus'
    audioBitrate: integer('audio_bitrate'), // kbps

    // Status
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'processing', 'completed', 'failed', 'cancelled'
    progress: integer('progress').default(0), // 0-100

    // Output
    outputUrl: varchar('output_url', { length: 1000 }),
    outputSize: bigint('output_size', { mode: 'number' }),
    duration: integer('duration'), // seconds
    thumbnailUrl: text('thumbnail_url'),

    // Performance metrics
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    processingTime: integer('processing_time'), // milliseconds
    engineUsed: varchar('engine_used', { length: 50 }), // 'ffmpeg.wasm', 'mp4-muxer'

    // Error handling
    errorMessage: text('error_message'),
    errorDetails: jsonb('error_details'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('video_export_jobs_user_id_idx').on(table.userId),
    projectIdIdx: index('video_export_jobs_project_id_idx').on(table.projectId),
    statusIdx: index('video_export_jobs_status_idx').on(table.status),
    createdAtIdx: index('video_export_jobs_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// VIDEO EDITOR - AI STORY ANALYSIS (GPT-4 Vision Results)
// ============================================================================

export const aiStoryAnalysis = pgTable(
  'ai_story_analysis',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),
    timelineProjectId: varchar('timeline_project_id').references(() => timelineProjects.id),

    // Analysis input
    videoUrls: jsonb('video_urls').$type<string[]>().notNull(),
    shotList: jsonb('shot_list'),
    timelineEvents: jsonb('timeline_events'),
    culture: varchar('culture', { length: 100 }), // Cultural context
    projectType: varchar('project_type', { length: 100 }), // 'wedding', 'corporate', etc.

    // AI Results
    storyArc: jsonb('story_arc').$type<{
      title: string;
      acts: Array<{
        act: number;
        name: string;
        duration: number;
        emotionalTone: string;
        keyMoments: string[];
      }>;
      totalDuration: number;
    }>(),

    clipSelections: jsonb('clip_selections').$type<
      Array<{
        clipId: string;
        name: string;
        start: number;
        duration: number;
        emotionalIntensity: number;
        culturalSignificance?: string;
        reason: string;
      }>
    >(),

    transitions: jsonb('transitions').$type<
      Array<{
        fromClipId: string;
        toClipId: string;
        transitionType: string;
        duration: number;
        reason: string;
      }>
    >(),

    musicSuggestions: jsonb('music_suggestions').$type<
      Array<{
        mood: string;
        bpm: number;
        genre: string;
        culturalStyle?: string;
      }>
    >(),

    culturalMoments: jsonb('cultural_moments').$type<string[]>(),
    emotionalPacing: jsonb('emotional_pacing').$type<
      Array<{
        time: number;
        intensity: number;
        emotion: string;
      }>
    >(),

    // Generation timeline
    generatedTimeline: jsonb('generated_timeline').$type<{
      clips: unknown[];
      tracks: unknown[];
      totalDuration: number;
    }>(),

    // Metadata
    confidence: decimal('confidence', { precision: 5, scale: 2 }),
    processingTime: integer('processing_time'), // milliseconds
    gptModel: varchar('gpt_model', { length: 50 }).default('gpt-4-vision-preview'),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    framesAnalyzed: integer('frames_analyzed'),

    // User feedback
    userRating: integer('user_rating'), // 1-5
    userFeedback: text('user_feedback'),
    wasUsed: boolean('was_used').default(false),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_story_analysis_user_id_idx').on(table.userId),
    projectIdIdx: index('ai_story_analysis_project_id_idx').on(table.projectId),
    createdAtIdx: index('ai_story_analysis_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// VIDEO EDITOR - CAPTIONS (Auto-Generated & Manual)
// ============================================================================

export const videoCaptions = pgTable(
  'video_captions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    videoClipId: varchar('video_clip_id').references(() => videoClips.id),
    projectId: varchar('project_id').references(() => projects.id),
    timelineProjectId: varchar('timeline_project_id').references(() => timelineProjects.id),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Caption data
    language: varchar('language', { length: 10 }).notNull().default('en'),
    captionsData: jsonb('captions_data')
      .$type<
        Array<{
          start: number;
          end: number;
          text: string;
          words?: Array<{
            word: string;
            start: number;
            end: number;
          }>;
        }>
      >()
      .notNull(),

    // Export formats
    srtContent: text('srt_content'),
    vttContent: text('vtt_content'),

    // Generation info
    generatedBy: varchar('generated_by', { length: 50 }).default('manual'), // 'whisper', 'manual', 'imported'
    whisperModel: varchar('whisper_model', { length: 50 }), // 'large-v3', etc.
    accuracy: decimal('accuracy', { precision: 5, scale: 2 }),

    // Style
    style: varchar('style', { length: 50 }).default('modern'), // 'modern', 'minimal', 'bold', 'elegant'

    // Metadata
    totalSegments: integer('total_segments').default(0),
    totalWords: integer('total_words').default(0),
    duration: integer('duration'), // seconds

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    videoClipIdIdx: index('video_captions_video_clip_id_idx').on(table.videoClipId),
    projectIdIdx: index('video_captions_project_id_idx').on(table.projectId),
    userIdIdx: index('video_captions_user_id_idx').on(table.userId),
    languageIdx: index('video_captions_language_idx').on(table.language),
  }),
);

// ============================================================================
// VIDEO EDITOR - TEXT OVERLAYS (Titles, Lower Thirds, etc.)
// ============================================================================

export const videoTextOverlays = pgTable(
  'video_text_overlays',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineProjectId: varchar('timeline_project_id').references(() => timelineProjects.id),
    clipId: varchar('clip_id'), // Can be null for independent overlays

    // Text content
    text: text('text').notNull(),

    // Typography
    fontSize: integer('font_size').default(72),
    fontFamily: varchar('font_family', { length: 100 }).default('Arial'),
    fill: varchar('fill', { length: 7 }).default('#ffffff'), // Color
    stroke: varchar('stroke', { length: 7 }),
    strokeWidth: integer('stroke_width').default(0),

    // Position & Size
    x: integer('x').default(100),
    y: integer('y').default(100),
    width: integer('width'),
    height: integer('height'),
    rotation: decimal('rotation', { precision: 5, scale: 2 }).default('0'),
    opacity: decimal('opacity', { precision: 3, scale: 2 }).default('1.0'),

    // Animation
    animationType: varchar('animation_type', { length: 50 }).default('fade_in'), // 'fade_in', 'slide', 'zoom', 'typewriter'
    animationDuration: decimal('animation_duration', { precision: 5, scale: 2 }).default('1.0'),
    animationDelay: decimal('animation_delay', { precision: 5, scale: 2 }).default('0'),

    // Timing (when to show on timeline)
    startTime: decimal('start_time', { precision: 10, scale: 3 }).notNull(),
    endTime: decimal('end_time', { precision: 10, scale: 3 }).notNull(),

    // Template reference
    templateName: varchar('template_name', { length: 100 }), // 'Title', 'Subtitle', 'Lower Third'

    sortOrder: integer('sort_order').default(0),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineProjectIdIdx: index('video_text_overlays_timeline_project_id_idx').on(
      table.timelineProjectId,
    ),
    startTimeIdx: index('video_text_overlays_start_time_idx').on(table.startTime),
  }),
);

// ============================================================================
// VIDEO EDITOR - CLIP EFFECTS (Filters, Color Grading, Speed Ramps, LUTs)
// ============================================================================

export const videoClipEffects = pgTable(
  'video_clip_effects',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clipId: varchar('clip_id')
      .notNull()
      .references(() => videoClips.id),

    // Effect type
    effectType: varchar('effect_type', { length: 50 }).notNull(), // 'gpu_filter', 'color_grade', 'lut', 'speed_ramp', 'background_removal'

    // General configuration
    effectConfig: jsonb('effect_config'),

    // GPU Filter specific
    filterType: varchar('filter_type', { length: 50 }), // 'blur', 'brightness', 'contrast', etc.
    filterParams: jsonb('filter_params'),

    // Color Grading specific
    temperature: integer('temperature'), // -100 to +100
    tint: integer('tint'), // -100 to +100
    exposure: decimal('exposure', { precision: 5, scale: 2 }), // -2.0 to +2.0
    contrast: integer('contrast'), // 0-200
    saturation: integer('saturation'), // 0-200

    // LUT specific
    lutId: integer('lut_id').references(() => luts.id),
    lutStrength: decimal('lut_strength', { precision: 3, scale: 2 }).default('1.0'), // 0.0-1.0 blend

    // Speed Ramp specific
    speedKeyframes: jsonb('speed_keyframes').$type<
      Array<{
        time: number;
        speed: number;
        curve: string;
      }>
    >(),
    preservePitch: boolean('preserve_pitch').default(true),

    // Effect chain order
    sortOrder: integer('sort_order').default(0),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    clipIdIdx: index('video_clip_effects_clip_id_idx').on(table.clipId),
    effectTypeIdx: index('video_clip_effects_effect_type_idx').on(table.effectType),
    lutIdIdx: index('video_clip_effects_lut_id_idx').on(table.lutId),
  }),
);

// ============================================================================
// VIDEO EDITOR - TRANSITIONS (Between Clips)
// ============================================================================

export const videoTransitions = pgTable(
  'video_transitions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timelineProjectId: varchar('timeline_project_id').references(() => timelineProjects.id),
    fromClipId: varchar('from_clip_id')
      .notNull()
      .references(() => videoClips.id),
    toClipId: varchar('to_clip_id')
      .notNull()
      .references(() => videoClips.id),

    // Transition details
    transitionType: varchar('transition_type', { length: 100 }).notNull(), // 'crossfade', 'wipe', 'slide', etc.
    duration: decimal('duration', { precision: 5, scale: 2 }).notNull(), // seconds
    engine: varchar('engine', { length: 20 }).notNull(), // 'canvas2d', 'webgl'

    // Parameters (vary by transition type)
    config: jsonb('config'),

    // Timing
    transitionStart: decimal('transition_start', { precision: 10, scale: 3 }),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    timelineProjectIdIdx: index('video_transitions_timeline_project_id_idx').on(
      table.timelineProjectId,
    ),
    fromClipIdIdx: index('video_transitions_from_clip_id_idx').on(table.fromClipId),
    toClipIdIdx: index('video_transitions_to_clip_id_idx').on(table.toClipId),
  }),
);

// ============================================================================
// VIDEO EDITOR - EXPORT PRESETS (Custom Export Settings)
// ============================================================================

export const videoExportPresets = pgTable(
  'video_export_presets',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').references(() => users.id), // NULL = system default

    // Preset info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Settings
    resolution: varchar('resolution', { length: 50 }).notNull(),
    codec: varchar('codec', { length: 50 }).notNull(),
    format: varchar('format', { length: 20 }).notNull(),
    bitrate: integer('bitrate'),
    audioCodec: varchar('audio_codec', { length: 50 }),
    audioBitrate: integer('audio_bitrate'),

    // Mobile presets
    isMobilePreset: boolean('is_mobile_preset').default(false),
    aspectRatio: varchar('aspect_ratio', { length: 10 }), // '16:9', '9:16', '1:1', '4:5'
    platform: varchar('platform', { length: 50 }), // 'instagram', 'tiktok', 'youtube', 'facebook'

    // Advanced settings
    advancedSettings: jsonb('advanced_settings'),

    // Usage
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    isDefault: boolean('is_default').default(false),
    isSystemDefault: boolean('is_system_default').default(false),
    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('video_export_presets_user_id_idx').on(table.userId),
    platformIdx: index('video_export_presets_platform_idx').on(table.platform),
  }),
);

// ============================================================================
// PROFESSION FEATURE OVERRIDES
// ============================================================================
// Note: professionFeatureOverrides is imported from feature-management-schema (line 44)
// Removed duplicate definition to avoid export conflict

// ============================================================================
// PHOTO SUITE - EDIT HISTORY & ENHANCEMENT TRACKING
// ============================================================================

// Photo Edit History - Track all manual edits made in Photo Suite
export const photoEditHistory = pgTable(
  'photo_edit_history',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    photoId: varchar('photo_id'), // Reference to images table
    projectId: varchar('project_id').references(() => projects.id),

    // Edit details
    editControls: jsonb('edit_controls').notNull().$type<{
      temperature: number;
      tint: number;
      exposure: number;
      contrast: number;
      highlights: number;
      shadows: number;
      whites: number;
      blacks: number;
      clarity: number;
      vibrance: number;
      saturation: number;
      sharpness: number;
      grain: number;
      vignette: number;
      whiteBalance: string;
    }>(),

    canvasPreviewUrl: text('canvas_preview_url'),
    version: integer('version').default(1),
    versionName: varchar('version_name', { length: 255 }),
    presetUsed: varchar('preset_used', { length: 255 }),

    // Transform data
    zoomLevel: integer('zoom_level').default(100),
    rotation: integer('rotation').default(0),
    panPosition: jsonb('pan_position').$type<{ x: number; y: number }>(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('photo_edit_history_user_id_idx').on(table.userId),
    photoIdIdx: index('photo_edit_history_photo_id_idx').on(table.photoId),
    projectIdIdx: index('photo_edit_history_project_id_idx').on(table.projectId),
  }),
);

// Photo Suite User Preferences - Persist UI customization per user
export const photoSuiteUserPreferences = pgTable(
  'photo_suite_user_preferences',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id)
      .unique(),

    // Saved presets
    favoritePresets: jsonb('favorite_presets').$type<string[]>().default([]), // 'Riveria B&W', 'Dreamy', 'Best Wedding', etc.
    customPresets: jsonb('custom_presets')
      .$type<
        Array<{
          name: string;
          controls: {
            temperature: number;
            tint: number;
            exposure: number;
            contrast: number;
            highlights: number;
            shadows: number;
            whites: number;
            blacks: number;
            clarity: number;
            vibrance: number;
            saturation: number;
            sharpness: number;
            grain: number;
            vignette: number;
            whiteBalance: string;
          };
        }>
      >()
      .default([]),

    // Default enhancement settings
    defaultEnhancementType: varchar('default_enhancement_type', { length: 100 }).default(
      'face_restoration',
    ), // 'face_restoration', 'super_resolution', 'noise_reduction', 'color_enhancement'
    defaultEnhancementQuality: integer('default_enhancement_quality').default(85), // 0-100

    // RAW processing defaults
    defaultRawOutputFormat: varchar('default_raw_output_format', { length: 50 }).default('jpeg'), // 'jpeg', 'tiff', 'png'
    defaultRawQuality: integer('default_raw_quality').default(95), // 0-100
    defaultRawColorSpace: varchar('default_raw_color_space', { length: 50 }).default('srgb'), // 'srgb', 'adobe_rgb', 'prophoto_rgb'
    defaultRawWhiteBalance: varchar('default_raw_white_balance', { length: 50 }).default('auto'), // 'auto', 'daylight', 'cloudy', 'tungsten', etc.

    // UI preferences
    defaultZoomLevel: integer('default_zoom_level').default(100), // 25-400
    showPresetPanel: boolean('show_preset_panel').default(true),
    showHistogram: boolean('show_histogram').default(true),
    showComparison: boolean('show_comparison').default(false), // Before/after
    comparisonSliderPosition: integer('comparison_slider_position').default(50), // 0-100

    // Showcase settings
    showcaseEnableContextMenu: boolean('showcase_enable_context_menu').default(true),
    showcaseShowDownloadButton: boolean('showcase_show_download_button').default(true),
    showcaseShowEditButton: boolean('showcase_show_edit_button').default(true),
    showcaseShowDeleteButton: boolean('showcase_show_delete_button').default(true),
    showcaseShowShareButton: boolean('showcase_show_share_button').default(true),
    showcaseShowSettingsButton: boolean('showcase_show_settings_button').default(true),
    showcaseShowInfoButton: boolean('showcase_show_info_button').default(true),
    showcaseShowRefreshButton: boolean('showcase_show_refresh_button').default(true),

    // Version history preferences
    maxVersionHistory: integer('max_version_history').default(20), // Max versions to keep
    autoSaveVersions: boolean('auto_save_versions').default(true),
    autoSaveInterval: integer('auto_save_interval').default(2000), // milliseconds

    // Export preferences
    defaultExportFormat: varchar('default_export_format', { length: 50 }).default('jpeg'), // 'jpeg', 'png', 'tiff'
    defaultExportQuality: integer('default_export_quality').default(95), // 0-100
    includeMetadataOnExport: boolean('include_metadata_on_export').default(true),

    // Batch processing preferences
    batchModeEnabled: boolean('batch_mode_enabled').default(false),
    applyPresetsToAll: boolean('apply_presets_to_all').default(false),

    // Keyboard shortcuts (customizable)
    keyboardShortcuts: jsonb('keyboard_shortcuts').$type<Record<string, string>>(), // { 'export': 'Ctrl+E', 'undo': 'Ctrl+Z', etc. }

    // Recent files (for quick access)
    recentFiles: jsonb('recent_files')
      .$type<
        Array<{
          id: string;
          name: string;
          url: string;
          thumbnailUrl?: string;
          loadedAt: string;
        }>
      >()
      .default([]), // Last 10 files

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('photo_suite_user_preferences_user_id_idx').on(table.userId),
  }),
);

// Photo Enhancement Jobs - Track AI-powered photo enhancements
export const photoEnhancementJobs = pgTable(
  'photo_enhancement_jobs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    photoId: varchar('photo_id'),
    projectId: varchar('project_id').references(() => projects.id),

    // Enhancement details
    enhancementType: varchar('enhancement_type', { length: 100 }).notNull(), // face_restoration, super_resolution, noise_reduction, color_enhancement, comprehensive_analysis
    enhancementQuality: integer('enhancement_quality').default(85),
    modelUsed: varchar('model_used', { length: 100 }), // GFPGAN, Real-ESRGAN, Restormer, NAFNet

    // Input/Output
    originalImageUrl: text('original_image_url').notNull(),
    enhancedImageUrl: text('enhanced_image_url'),
    thumbnailUrl: text('thumbnail_url'),

    // Quality metrics
    qualityMetrics: jsonb('quality_metrics').$type<{
      psnr: number;
      ssim: number;
      lpips: number;
    }>(),
    processingTime: integer('processing_time'), // milliseconds

    // RAW processing (if applicable)
    isRawFile: boolean('is_raw_file').default(false),
    rawMetadata: jsonb('raw_metadata'),
    rawProcessingSettings: jsonb('raw_processing_settings'),

    // Status
    status: varchar('status', { length: 50 }).default('pending'), // pending, processing, completed, failed
    progress: integer('progress').default(0),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    userIdIdx: index('photo_enhancement_jobs_user_id_idx').on(table.userId),
    photoIdIdx: index('photo_enhancement_jobs_photo_id_idx').on(table.photoId),
    projectIdIdx: index('photo_enhancement_jobs_project_id_idx').on(table.projectId),
    statusIdx: index('photo_enhancement_jobs_status_idx').on(table.status),
    enhancementTypeIdx: index('photo_enhancement_jobs_enhancement_type_idx').on(
      table.enhancementType,
    ),
  }),
);

// ============================================================================
// STORY ARC STUDIO - SESSION TRACKING
// ============================================================================

// Studio User Preferences - Persist UI customization settings per user
export const studioUserPreferences = pgTable(
  'studio_user_preferences',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id)
      .unique(),

    // Panel layout preferences
    leftPanelWidth: integer('left_panel_width').default(300), // Asset Browser width (200-500)
    rightPanelWidth: integer('right_panel_width').default(320), // Inspector width (200-500)
    rightPanelDefaultTab: varchar('right_panel_default_tab', { length: 50 }).default('inspector'), // 'inspector' or 'ai-analysis'

    // Timeline preferences
    defaultTimelineZoom: decimal('default_timeline_zoom', { precision: 5, scale: 2 }).default(
      '1.0',
    ), // 0.1 - 5.0
    defaultPlaybackSpeed: decimal('default_playback_speed', { precision: 5, scale: 2 }).default(
      '1.0',
    ), // 0.25 - 8.0
    defaultLoopEnabled: boolean('default_loop_enabled').default(false),
    snapToGrid: boolean('snap_to_grid').default(true),
    showWaveforms: boolean('show_waveforms').default(true),
    showThumbnails: boolean('show_thumbnails').default(true),

    // Transport controls preferences
    preferredFrameRate: integer('preferred_frame_rate').default(25), // 24, 25, 30, 60
    jklSensitivity: integer('jkl_sensitivity').default(2), // Speed multiplier for J/K/L controls (1-4)

    // Export preferences
    defaultExportResolution: varchar('default_export_resolution', { length: 50 }).default('4K'), // '1080p', '4K', '8K'
    defaultExportCodec: varchar('default_export_codec', { length: 50 }).default('H.265'), // 'H.264', 'H.265', 'ProRes'
    defaultExportFormat: varchar('default_export_format', { length: 50 }).default('MP4'), // 'MP4', 'MOV', 'MKV'
    includeEDLByDefault: boolean('include_edl_by_default').default(true),
    includeXMLByDefault: boolean('include_xml_by_default').default(true),

    // AI Story Generator preferences
    defaultCulture: varchar('default_culture', { length: 100 }), // User's preferred cultural context
    defaultProjectType: varchar('default_project_type', { length: 100 }).default('wedding'),
    autoApplyAISuggestions: boolean('auto_apply_ai_suggestions').default(false),

    // Color grading preferences
    favoriteColorGrades: jsonb('favorite_color_grades').$type<string[]>().default([]), // Array of LUT IDs or grade names
    recentLUTs: jsonb('recent_luts').$type<string[]>().default([]), // Recently used LUT IDs (max 10)

    // Keyboard shortcuts customization
    customShortcuts: jsonb('custom_shortcuts').$type<Record<string, string>>(), // { 'play_pause': 'Space', 'mark_in': 'I', etc. }

    // UI theme preferences
    themeBrightness: varchar('theme_brightness', { length: 50 }).default('dark'), // 'dark', 'light'
    accentColor: varchar('accent_color', { length: 50 }).default('#1976d2'), // Hex color

    // Feature visibility
    enabledFeatures: jsonb('enabled_features')
      .$type<string[]>()
      .default([
        'transitions',
        'speed_ramp',
        'text_overlays',
        'gpu_filters',
        'color_grading',
        'auto_captions',
        'beat_sync',
        'ai_analysis',
      ]), // User can disable features they don't use

    // Auto-save preferences
    autoSaveEnabled: boolean('auto_save_enabled').default(true),
    autoSaveInterval: integer('auto_save_interval').default(300), // seconds (default 5 min)

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('studio_user_preferences_user_id_idx').on(table.userId),
  }),
);

// Story Arc Sessions - Track video story generation sessions
export const storyArcSessions = pgTable(
  'story_arc_sessions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),
    timelineProjectId: varchar('timeline_project_id').references(() => timelineProjects.id),

    // Session info
    sessionName: varchar('session_name', { length: 255 }).notNull(),
    culture: varchar('culture', { length: 100 }), // sikh, indian, norsk, pakistani, etc.
    projectType: varchar('project_type', { length: 100 }), // wedding, corporate, event

    // Input data
    videoUrls: jsonb('video_urls').$type<string[]>(),
    shotList: jsonb('shot_list'),
    timelineEvents: jsonb('timeline_events'),

    // Generated story arc data
    storyArcData: jsonb('story_arc_data').$type<{
      title: string;
      acts: Array<{
        act: number;
        name: string;
        duration: number;
        emotionalTone: string;
        keyMoments: string[];
      }>;
      totalDuration: number;
    }>(),

    selectedClips: jsonb('selected_clips').$type<
      Array<{
        clipId: string;
        name: string;
        start: number;
        duration: number;
        emotionalIntensity: number;
        culturalSignificance?: string;
        reason: string;
      }>
    >(),

    transitions: jsonb('transitions').$type<
      Array<{
        fromClipId: string;
        toClipId: string;
        transitionType: string;
        duration: number;
        reason: string;
      }>
    >(),

    musicSuggestions: jsonb('music_suggestions').$type<
      Array<{
        mood: string;
        bpm: number;
        genre: string;
        culturalStyle?: string;
      }>
    >(),

    culturalMoments: jsonb('cultural_moments').$type<string[]>(),
    emotionalPacing: jsonb('emotional_pacing').$type<
      Array<{
        time: number;
        intensity: number;
        emotion: string;
      }>
    >(),

    // Generated timeline (ready to load)
    generatedTimeline: jsonb('generated_timeline').$type<{
      clips: unknown[];
      tracks: unknown[];
      totalDuration: number;
    }>(),

    // AI analysis reference
    aiAnalysisId: varchar('ai_analysis_id').references(() => aiStoryAnalysis.id),

    // Metadata
    confidence: decimal('confidence', { precision: 5, scale: 2 }),
    processingTime: integer('processing_time'), // milliseconds
    gptModel: varchar('gpt_model', { length: 50 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    // User feedback
    userRating: integer('user_rating'), // 1-5
    userFeedback: text('user_feedback'),
    wasUsed: boolean('was_used').default(false),

    // Status
    status: varchar('status', { length: 50 }).default('draft'), // draft, active, completed, archived

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('story_arc_sessions_user_id_idx').on(table.userId),
    projectIdIdx: index('story_arc_sessions_project_id_idx').on(table.projectId),
    timelineProjectIdIdx: index('story_arc_sessions_timeline_project_id_idx').on(
      table.timelineProjectId,
    ),
    statusIdx: index('story_arc_sessions_status_idx').on(table.status),
    cultureIdx: index('story_arc_sessions_culture_idx').on(table.culture),
  }),
);

// ============================================================================
// AI VIDEO & AUDIO ANALYSIS SYSTEM
// ============================================================================

// Video Scene Analysis - Single frame AI analysis results
export const videoSceneAnalysis = pgTable(
  'video_scene_analysis',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),
    videoClipId: varchar('video_clip_id').references(() => videoClips.id),

    // Frame information
    frameUrl: text('frame_url').notNull(),
    frameTimestamp: decimal('frame_timestamp', { precision: 10, scale: 3 }), // seconds into video
    frameNumber: integer('frame_number'),

    // AI Analysis Results
    sceneDescription: text('scene_description'),
    detectedObjects: jsonb('detected_objects').$type<
      Array<{
        label: string;
        confidence: number;
        bbox: { x: number; y: number; width: number; height: number };
      }>
    >(),

    detectedPeople: jsonb('detected_people').$type<
      Array<{
        personId: string;
        confidence: number;
        bbox: { x: number; y: number; width: number; height: number };
        emotions?: Record<string, number>;
        pose?: string;
      }>
    >(),

    sceneType: varchar('scene_type', { length: 100 }), // 'indoor', 'outdoor', 'ceremony', 'reception', etc.
    lighting: varchar('lighting', { length: 100 }), // 'natural', 'artificial', 'mixed', 'golden_hour', etc.
    composition: varchar('composition', { length: 100 }), // 'rule_of_thirds', 'centered', 'symmetrical', etc.

    emotions: jsonb('emotions').$type<Record<string, number>>(), // happiness: 0.9, excitement: 0.7, etc.
    culturalContext: varchar('cultural_context', { length: 100 }),
    suggestedTags: jsonb('suggested_tags').$type<string[]>(),

    // Quality metrics
    qualityScore: decimal('quality_score', { precision: 5, scale: 2 }),
    technicalQuality: jsonb('technical_quality').$type<{
      sharpness: number;
      exposure: number;
      colorBalance: number;
      noiseLevel: number;
    }>(),

    // AI Model info
    modelUsed: varchar('model_used', { length: 100 }), // 'gpt-4-vision', 'clip', 'yolo', etc.
    confidence: decimal('confidence', { precision: 5, scale: 2 }),
    processingTime: integer('processing_time'), // milliseconds

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('video_scene_analysis_user_id_idx').on(table.userId),
    projectIdIdx: index('video_scene_analysis_project_id_idx').on(table.projectId),
    videoClipIdIdx: index('video_scene_analysis_video_clip_id_idx').on(table.videoClipId),
    sceneTypeIdx: index('video_scene_analysis_scene_type_idx').on(table.sceneType),
  }),
);

// Batch Video Analysis - Full video processing jobs
export const batchVideoAnalysis = pgTable(
  'batch_video_analysis',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),

    // Video information
    videoUrl: text('video_url').notNull(),
    videoName: varchar('video_name', { length: 255 }),
    videoDuration: integer('video_duration'), // seconds

    // Analysis configuration
    analysisType: varchar('analysis_type', { length: 100 }).notNull(), // 'scene_detection', 'emotion_tracking', 'shot_detection', 'full_analysis'
    samplingRate: integer('sampling_rate').default(1), // analyze every N seconds
    culturalContext: varchar('cultural_context', { length: 100 }),

    // Processing status
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'processing', 'completed', 'failed'
    progress: integer('progress').default(0), // 0-100

    // Results summary
    totalFramesAnalyzed: integer('total_frames_analyzed').default(0),
    sceneBreakdowns: jsonb('scene_breakdowns').$type<
      Array<{
        startTime: number;
        endTime: number;
        sceneType: string;
        description: string;
        keyMoments: string[];
      }>
    >(),

    emotionalArc: jsonb('emotional_arc').$type<
      Array<{
        timestamp: number;
        emotions: Record<string, number>;
        dominantEmotion: string;
      }>
    >(),

    keyMoments: jsonb('key_moments').$type<
      Array<{
        timestamp: number;
        description: string;
        importance: number;
        thumbnail?: string;
      }>
    >(),

    peopleTracking: jsonb('people_tracking').$type<
      Array<{
        personId: string;
        appearances: Array<{
          startTime: number;
          endTime: number;
          screenTime: number;
        }>;
        totalScreenTime: number;
      }>
    >(),

    suggestedEdits: jsonb('suggested_edits').$type<
      Array<{
        timestamp: number;
        editType: string;
        reason: string;
        priority: number;
      }>
    >(),

    // Metadata
    processingTime: integer('processing_time'), // milliseconds
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('batch_video_analysis_user_id_idx').on(table.userId),
    projectIdIdx: index('batch_video_analysis_project_id_idx').on(table.projectId),
    statusIdx: index('batch_video_analysis_status_idx').on(table.status),
    analysisTypeIdx: index('batch_video_analysis_analysis_type_idx').on(table.analysisType),
  }),
);

// Audio Analysis & Classification - AI-powered audio scene understanding
export const audioAnalysis = pgTable(
  'audio_analysis',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    projectId: varchar('project_id').references(() => projects.id),
    videoClipId: varchar('video_clip_id').references(() => videoClips.id),

    // Audio information
    audioUrl: text('audio_url').notNull(),
    audioName: varchar('audio_name', { length: 255 }),
    duration: integer('duration'), // seconds

    // Classification results
    audioType: varchar('audio_type', { length: 100 }), // 'speech', 'music', 'ambient', 'mixed'
    speechDetected: boolean('speech_detected').default(false),
    musicDetected: boolean('music_detected').default(false),

    // Speech analysis
    transcription: text('transcription'),
    language: varchar('language', { length: 10 }),
    speakerCount: integer('speaker_count'),
    speakers: jsonb('speakers').$type<
      Array<{
        speakerId: string;
        segments: Array<{
          startTime: number;
          endTime: number;
          text: string;
        }>;
      }>
    >(),

    // Music analysis
    musicGenre: varchar('music_genre', { length: 100 }),
    musicMood: varchar('music_mood', { length: 100 }),
    tempo: integer('tempo'), // BPM
    key: varchar('key', { length: 10 }),

    // Sound classification
    soundEvents: jsonb('sound_events').$type<
      Array<{
        startTime: number;
        endTime: number;
        label: string;
        confidence: number;
      }>
    >(),

    // Audio quality
    noiseLevel: decimal('noise_level', { precision: 5, scale: 2 }),
    clarity: decimal('clarity', { precision: 5, scale: 2 }),
    qualityScore: decimal('quality_score', { precision: 5, scale: 2 }),

    // Ambient sounds
    ambientSounds: jsonb('ambient_sounds').$type<
      Array<{
        type: string; // 'birds', 'traffic', 'crowd', 'nature', etc.
        intensity: number;
        startTime: number;
        endTime: number;
      }>
    >(),

    // Cultural context
    culturalElements: jsonb('cultural_elements').$type<
      Array<{
        type: string; // 'traditional_music', 'ritual_sounds', 'language_specific'
        description: string;
        timestamp: number;
      }>
    >(),

    // AI model info
    modelUsed: varchar('model_used', { length: 100 }), // 'whisper', 'wav2vec', 'yamnet', etc.
    confidence: decimal('confidence', { precision: 5, scale: 2 }),
    processingTime: integer('processing_time'), // milliseconds

    // Status
    status: varchar('status', { length: 50 }).default('completed'), // 'processing', 'completed', 'failed'
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audio_analysis_user_id_idx').on(table.userId),
    projectIdIdx: index('audio_analysis_project_id_idx').on(table.projectId),
    videoClipIdIdx: index('audio_analysis_video_clip_id_idx').on(table.videoClipId),
    audioTypeIdx: index('audio_analysis_audio_type_idx').on(table.audioType),
    statusIdx: index('audio_analysis_status_idx').on(table.status),
  }),
);

// ============================================================================
// AUDIO ENHANCEMENT SYSTEM
// ============================================================================

// Audio Enhancement User Preferences - Persist UI customization per user
export const audioEnhancementUserPreferences = pgTable(
  'audio_enhancement_user_preferences',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id)
      .unique(),

    // Favorite presets
    favoritePresets: jsonb('favorite_presets').$type<string[]>().default([]),
    recentPresets: jsonb('recent_presets').$type<string[]>().default([]), // Last 5 used

    // Custom presets
    customPresets: jsonb('custom_presets')
      .$type<
        Array<{
          name: string;
          denoise: { threshold: number; reduction: number };
          eq: { low: number; lowMid: number; highMid: number; high: number };
          compressor: { threshold: number; ratio: number; attack: number; release: number };
          limiter: { ceiling: number; lookahead: number };
        }>
      >()
      .default([]),

    // Default enhancement parameters
    defaultDenoiseThreshold: integer('default_denoise_threshold').default(50),
    defaultDenoiseReduction: integer('default_denoise_reduction').default(3),
    defaultEQPreset: varchar('default_eq_preset', { length: 100 }),

    // Default EQ settings
    defaultEQ: jsonb('default_eq')
      .$type<{
        low: number;
        lowMid: number;
        highMid: number;
        high: number;
      }>()
      .default({ low: 50, lowMid: 50, highMid: 50, high: 50 }),

    // Default compressor settings
    defaultCompressor: jsonb('default_compressor')
      .$type<{
        threshold: number;
        ratio: number;
        attack: number;
        release: number;
      }>()
      .default({ threshold: 40, ratio: 60, attack: 30, release: 50 }),

    // Default limiter settings
    defaultLimiterCeiling: integer('default_limiter_ceiling').default(80),
    defaultLimiterLookahead: integer('default_limiter_lookahead').default(40),

    // Playback preferences
    autoPlayAfterLoad: boolean('auto_play_after_load').default(false),
    defaultLoopEnabled: boolean('default_loop_enabled').default(false),
    defaultBypassEnabled: boolean('default_bypass_enabled').default(false),

    // Meter preferences
    meterReferenceLevel: integer('meter_reference_level').default(-18), // dBFS
    meterRange: integer('meter_range').default(60), // dB range
    showSpectrumAnalyzer: boolean('show_spectrum_analyzer').default(true),
    showWaveform: boolean('show_waveform').default(true),

    // Export preferences
    defaultExportFormat: varchar('default_export_format', { length: 50 }).default('wav'), // 'wav', 'mp3', 'flac', 'aac'
    defaultExportSampleRate: integer('default_export_sample_rate').default(48000), // 44100, 48000, 96000
    defaultExportBitDepth: integer('default_export_bit_depth').default(24), // 16, 24, 32

    // AI preferences
    preferredDenoiseModel: varchar('preferred_denoise_model', { length: 100 }).default('RNNoise'), // 'RNNoise', 'DCCRN', 'Demucs'
    autoAnalyzeOnLoad: boolean('auto_analyze_on_load').default(false),

    // Recent files (for quick access)
    recentFiles: jsonb('recent_files')
      .$type<
        Array<{
          filename: string;
          url: string;
          size: number;
          loadedAt: string;
        }>
      >()
      .default([]), // Last 10 files

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audio_enhancement_user_preferences_user_id_idx').on(table.userId),
  }),
);

export const audioEnhancementJobs = pgTable(
  'audio_enhancement_jobs',
  {
    id: varchar('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),

    // File info
    filename: varchar('filename', { length: 500 }).notNull(),
    originalSize: integer('original_size').notNull(),
    originalUrl: varchar('original_url', { length: 1000 }).notNull(),
    enhancedUrl: varchar('enhanced_url', { length: 1000 }),

    // Processing
    enhancementType: varchar('enhancement_type', { length: 50 }).notNull(), // 'denoise' | 'speech_enhance' | 'source_separate'
    status: varchar('status', { length: 50 }).default('pending'), // 'pending' | 'processing' | 'completed' | 'error' | 'cancelled'
    progress: integer('progress').default(0), // 0-100

    // Parameters used
    parameters: jsonb('parameters'),

    // Quality metrics
    qualityMetrics: jsonb('quality_metrics'),

    // Timing
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    processingTime: integer('processing_time'), // milliseconds

    // Error handling
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audio_enhancement_jobs_user_id_idx').on(table.userId),
    statusIdx: index('audio_enhancement_jobs_status_idx').on(table.status),
    createdAtIdx: index('audio_enhancement_jobs_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// PHOTO SESSION SYSTEM
// ============================================================================

// Photo Sessions
export const photoSessions = pgTable(
  'photo_sessions',
  {
    id: serial('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    sessionName: varchar('session_name', { length: 255 }).notNull(),
    sessionDate: timestamp('session_date').notNull(),
    location: varchar('location', { length: 255 }),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('photo_sessions_project_id_idx').on(table.projectId),
    sessionDateIdx: index('photo_sessions_session_date_idx').on(table.sessionDate),
  }),
);

// ============================================================================
// GOOGLE DRIVE INTEGRATION (Extended)
// ============================================================================

// Drive Folder Relations
export const driveFolderRelations = pgTable(
  'drive_folder_relations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    folderId: varchar('folder_id', { length: 255 }).notNull(),
    projectId: varchar('project_id'),
    userId: varchar('user_id').notNull(),
    relationType: varchar('relation_type', { length: 100 }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    folderIdIdx: index('drive_folder_relations_folder_id_idx').on(table.folderId),
    projectIdIdx: index('drive_folder_relations_project_id_idx').on(table.projectId),
    userIdIdx: index('drive_folder_relations_user_id_idx').on(table.userId),
  }),
);

// Drive Activity Logs
export const driveActivityLogs = pgTable(
  'drive_activity_logs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    activityType: varchar('activity_type', { length: 100 }).notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('drive_activity_logs_user_id_idx').on(table.userId),
    activityTypeIdx: index('drive_activity_logs_activity_type_idx').on(table.activityType),
  }),
);

// ============================================================================
// SEO SYSTEM (Extended)
// ============================================================================

// SEO Pages
export const seoPages = pgTable(
  'seo_pages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    url: varchar('url', { length: 500 }).notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    keywords: jsonb('keywords'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    urlIdx: index('seo_pages_url_idx').on(table.url),
  }),
);

// SEO Backlinks
export const seoBacklinks = pgTable(
  'seo_backlinks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceUrl: varchar('source_url', { length: 500 }).notNull(),
    targetUrl: varchar('target_url', { length: 500 }).notNull(),
    anchorText: varchar('anchor_text', { length: 255 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    sourceUrlIdx: index('seo_backlinks_source_url_idx').on(table.sourceUrl),
    targetUrlIdx: index('seo_backlinks_target_url_idx').on(table.targetUrl),
  }),
);

// ============================================================================
// ADDITIONAL MISSING TABLES
// ============================================================================

// Invite Requests
export const inviteRequests = pgTable(
  'invite_requests',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    invitedAt: timestamp('invited_at').defaultNow(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('invite_requests_user_id_idx').on(table.userId),
    emailIdx: index('invite_requests_email_idx').on(table.email),
  }),
);

// Project Emails
export const projectEmails = pgTable(
  'project_emails',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').notNull(),
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    content: text('content').notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('project_emails_project_id_idx').on(table.projectId),
    toEmailIdx: index('project_emails_to_email_idx').on(table.toEmail),
  }),
);

// Client Submissions
export const clientSubmissions = pgTable(
  'client_submissions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').notNull(),
    clientId: varchar('client_id').notNull(),
    submissionType: varchar('submission_type', { length: 100 }).notNull(),
    data: jsonb('data').notNull(),
    status: varchar('status', { length: 50 }).default('pending'),
    submittedAt: timestamp('submitted_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('client_submissions_project_id_idx').on(table.projectId),
    clientIdIdx: index('client_submissions_client_id_idx').on(table.clientId),
  }),
);

// Prototype Feedback
export const prototypeFeedback = pgTable(
  'prototype_feedback',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').notNull(),
    clientId: varchar('client_id').notNull(),
    userId: varchar('user_id'),
    userEmail: varchar('user_email', { length: 255 }),
    userName: varchar('user_name', { length: 255 }),
    profession: varchar('profession', { length: 100 }),
    dashboardType: varchar('dashboard_type', { length: 100 }),
    feedback: text('feedback').notNull(),
    feedbackType: varchar('feedback_type', { length: 100 }),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    priority: varchar('priority', { length: 50 }),
    component: varchar('component', { length: 100 }),
    tags: jsonb('tags'),
    screenshotUrl: text('screenshot_url'),
    isAnonymous: boolean('is_anonymous').default(false),
    adminNotes: text('admin_notes'),
    adminUpdatedBy: varchar('admin_updated_by', { length: 255 }),
    resolvedAt: timestamp('resolved_at'),
    rating: integer('rating'),
    status: varchar('status', { length: 50 }).default('pending'),
    submittedAt: timestamp('submitted_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('prototype_feedback_project_id_idx').on(table.projectId),
    clientIdIdx: index('prototype_feedback_client_id_idx').on(table.clientId),
  }),
);

// ============================================================================
// CORE BUSINESS OPERATIONS TABLES
// ============================================================================

// Quotes

// ============================================================================
// INSERT SCHEMAS FOR WEDDING & TIMELINE MANAGEMENT TABLES
// ============================================================================

export const insertWeddingTimelineClientSettingsSchema = createInsertSchema(
  weddingTimelineClientSettings,
);
export const insertTimelineEventSchema = createInsertSchema(timelineEvents);
export const insertShotListSchema = createInsertSchema(shotLists);
export const insertShotListItemSchema = createInsertSchema(shotListItems);
export const insertQuickMessageTemplateSchema = createInsertSchema(quickMessageTemplates);
export const insertTimelineAdjustmentHistorySchema = createInsertSchema(timelineAdjustmentHistory);
export const insertWeddingDayNoteSchema = createInsertSchema(weddingDayNotes);
export const insertTimelineAccessGrantSchema = createInsertSchema(timelineAccessGrants);
export const insertProjectTimelineLinkSchema = createInsertSchema(projectTimelineLinks);
export const insertTimelineGoogleDriveSyncSchema = createInsertSchema(timelineGoogleDriveSync);
export const insertWeddingCultureSchema = createInsertSchema(weddingCultures);

// ============================================================================
// INSERT SCHEMAS FOR LIGHTING & EQUIPMENT TABLES
// ============================================================================

export const insertLightingEquipmentSchema = createInsertSchema(lightingEquipment);
export const insertLightingSetupSchema = createInsertSchema(lightingSetups);
export const insertLightingModelSchema = createInsertSchema(lightingModels);

// ============================================================================
// INSERT SCHEMAS FOR SHOWCASE TABLES
// ============================================================================

export const insertShowcaseItemSchema = createInsertSchema(showcaseItems);
export const insertShowcaseCategorySchema = createInsertSchema(showcaseCategories);
export const insertShowcaseTemplateSchema = createInsertSchema(showcaseTemplates);
export const insertShowcaseSettingsSchema = createInsertSchema(showcaseSettings);
export const insertShowcaseCommentSchema = createInsertSchema(showcaseComments);
export const insertShowcaseDriveSyncSchema = createInsertSchema(showcaseDriveSync);
export const insertShowcaseContentItemSchema = createInsertSchema(showcaseContentItems);
export const insertShowcaseGallerySchema = createInsertSchema(showcaseGalleries);
export const insertSmartAlbumSchema = createInsertSchema(smartAlbums);

// ============================================================================
// INSERT SCHEMAS FOR PHOTO SESSION TABLES
// ============================================================================

export const insertPhotoSessionSchema = createInsertSchema(photoSessions);

// ============================================================================
// INSERT SCHEMAS FOR ADDITIONAL MISSING TABLES
// ============================================================================

export const insertInviteRequestSchema = createInsertSchema(inviteRequests);
export const insertProjectEmailSchema = createInsertSchema(projectEmails);
export const insertClientSubmissionSchema = createInsertSchema(clientSubmissions);
export const insertPrototypeFeedbackSchema = createInsertSchema(prototypeFeedback);

// ============================================================================
// INSERT SCHEMAS FOR PHOTO SUITE TABLES
// ============================================================================

export const insertPhotoSuiteUserPreferencesSchema = createInsertSchema(photoSuiteUserPreferences);
export const insertPhotoEditHistorySchema = createInsertSchema(photoEditHistory);
export const insertPhotoEnhancementJobSchema = createInsertSchema(photoEnhancementJobs);

// ============================================================================
// INSERT SCHEMAS FOR STUDIO MANAGER TABLES
// ============================================================================

export const insertStudioUserPreferencesSchema = createInsertSchema(studioUserPreferences);

// ============================================================================
// INSERT SCHEMAS FOR STORY ARC TABLES
// ============================================================================

export const insertStoryArcSessionSchema = createInsertSchema(storyArcSessions);
export const insertVideoSceneAnalysisSchema = createInsertSchema(videoSceneAnalysis);
export const insertBatchVideoAnalysisSchema = createInsertSchema(batchVideoAnalysis);

// ============================================================================
// INSERT SCHEMAS FOR AUDIO ENHANCEMENT TABLES
// ============================================================================

export const insertAudioAnalysisSchema = createInsertSchema(audioAnalysis);
export const insertAudioEnhancementUserPreferencesSchema = createInsertSchema(
  audioEnhancementUserPreferences,
);
export const insertAudioEnhancementJobSchema = createInsertSchema(audioEnhancementJobs);

// ============================================================================
// INSERT SCHEMAS FOR MINI-SORA CONTINUOUS LEARNING TABLES
// ============================================================================

export const insertMiniSoraTrainingQueueSchema = createInsertSchema(miniSoraTrainingQueue);
export const insertMiniSoraTrainingFeedbackSchema = createInsertSchema(miniSoraTrainingFeedback);
export const insertMiniSoraTrainingRunSchema = createInsertSchema(miniSoraTrainingRuns);

// ============================================================================
// INSERT SCHEMAS FOR CHAT SYSTEM TABLES
// ============================================================================

export const insertChatConversationSchema = createInsertSchema(chatConversations);
export const insertChatMessageSchema = createInsertSchema(chatMessages);
export const insertChatRoomSchema = createInsertSchema(chatRooms);
export const insertChatRoomMemberSchema = createInsertSchema(chatRoomMembers);
export const insertChatNotificationSchema = createInsertSchema(chatNotifications);
export const insertExternalCollaboratorSchema = createInsertSchema(externalCollaborators);
export const insertEditingInstructionSchema = createInsertSchema(editingInstructions);

// ============================================================================
// TYPESCRIPT TYPES FOR CHAT SYSTEM TABLES
// ============================================================================

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;

export type ChatRoomMember = typeof chatRoomMembers.$inferSelect;
export type InsertChatRoomMember = z.infer<typeof insertChatRoomMemberSchema>;

export type ChatNotification = typeof chatNotifications.$inferSelect;
export type InsertChatNotification = z.infer<typeof insertChatNotificationSchema>;

export type ExternalCollaborator = typeof externalCollaborators.$inferSelect;
export type InsertExternalCollaborator = z.infer<typeof insertExternalCollaboratorSchema>;

export type EditingInstruction = typeof editingInstructions.$inferSelect;
export type InsertEditingInstruction = z.infer<typeof insertEditingInstructionSchema>;

// Pricing System Types
export type PricingCategory = typeof pricingCategories.$inferSelect;
export type InsertPricingCategory = z.infer<typeof insertPricingCategorySchema>;

export type ServiceItem = typeof serviceItems.$inferSelect;
export type InsertServiceItem = z.infer<typeof insertServiceItemSchema>;

export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;

export type CustomerPricing = typeof customerPricing.$inferSelect;
export type InsertCustomerPricing = z.infer<typeof insertCustomerPricingSchema>;

export type PricingPackage = typeof pricingPackages.$inferSelect;
export type InsertPricingPackage = z.infer<typeof insertPricingPackageSchema>;

// ============================================================================
// VALIDATION SCHEMAS FOR CHAT SYSTEM
// ============================================================================

export const createConversationSchema = z.object({
  projectId: z.string().optional(),
  participantIds: z.array(z.string()).min(2),
  title: z.string().optional(),
  initialMessage: z.string().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string(),
  content: z.string().min(1),
  messageType: z.enum(['text', 'image', 'file', 'system']).default('text'),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        type: z.string(),
        size: z.number(),
      }),
    )
    .optional(),
  replyToId: z.string().optional(),
});

// ============================================================================
// PRICING SYSTEM TABLES
// ============================================================================

// Pricing Categories
export const pricingCategories = pgTable(
  'pricing_categories',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).default('#3B82F6'),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('pricing_categories_user_id_idx').on(table.userId),
    nameIdx: index('pricing_categories_name_idx').on(table.name),
  }),
);

// Service Items
export const serviceItems = pgTable(
  'service_items',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    categoryId: integer('category_id').references(() => pricingCategories.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).default('0'),
    unit: varchar('unit', { length: 50 }).default('hour'),
    isActive: boolean('is_active').default(true),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('service_items_user_id_idx').on(table.userId),
    categoryIdIdx: index('service_items_category_id_idx').on(table.categoryId),
    nameIdx: index('service_items_name_idx').on(table.name),
  }),
);

// Pricing Rules
export const pricingRules = pgTable(
  'pricing_rules',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    serviceItemId: integer('service_item_id')
      .notNull()
      .references(() => serviceItems.id),
    name: varchar('name', { length: 255 }).notNull(),
    ruleType: varchar('rule_type', { length: 50 }).notNull(), // 'percentage', 'fixed', 'tiered'
    ruleValue: decimal('rule_value', { precision: 10, scale: 2 }).default('0'),
    conditions: jsonb('conditions'), // JSON object with rule conditions
    isActive: boolean('is_active').default(true),
    priority: integer('priority').default(0),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('pricing_rules_user_id_idx').on(table.userId),
    serviceItemIdIdx: index('pricing_rules_service_item_id_idx').on(table.serviceItemId),
    ruleTypeIdx: index('pricing_rules_rule_type_idx').on(table.ruleType),
  }),
);

// Customer Pricing
export const customerPricing = pgTable(
  'customer_pricing',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    customerId: varchar('customer_id')
      .notNull()
      .references(() => clients.id),
    serviceItemId: integer('service_item_id')
      .notNull()
      .references(() => serviceItems.id),
    customPrice: decimal('custom_price', { precision: 10, scale: 2 }).notNull(),
    discountType: varchar('discount_type', { length: 50 }).default('fixed'), // 'fixed', 'percentage'
    discountValue: decimal('discount_value', { precision: 10, scale: 2 }).default('0'),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('customer_pricing_user_id_idx').on(table.userId),
    customerIdIdx: index('customer_pricing_customer_id_idx').on(table.customerId),
    serviceItemIdIdx: index('customer_pricing_service_item_id_idx').on(table.serviceItemId),
    uniqueCustomerService: unique('customer_pricing_customer_service_unique').on(
      table.customerId,
      table.serviceItemId,
    ),
  }),
);

// Pricing Packages
export const pricingPackages = pgTable(
  'pricing_packages',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    packageType: varchar('package_type', { length: 50 }).notNull(), // 'standard', 'custom', 'tiered'
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).default('0'),
    currency: varchar('currency', { length: 3 }).default('NOK'),
    billingCycle: varchar('billing_cycle', { length: 50 }).default('monthly'), // 'monthly', 'yearly', 'one-time'
    features: jsonb('features'), // Array of features included
    limitations: jsonb('limitations'), // Usage limits and restrictions
    isActive: boolean('is_active').default(true),
    isPublic: boolean('is_public').default(false),
    sortOrder: integer('sort_order').default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('pricing_packages_user_id_idx').on(table.userId),
    packageTypeIdx: index('pricing_packages_package_type_idx').on(table.packageType),
    isPublicIdx: index('pricing_packages_is_public_idx').on(table.isPublic),
  }),
);

// ============================================================================
// RBAC (Role-Based Access Control) SYSTEM
// ============================================================================

export const rbacRoles = pgTable(
  'rbac_roles',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    description: text('description'),
    permissions: jsonb('permissions').notNull().default([]),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('rbac_roles_name_idx').on(table.name),
  }),
);

export const rbacUserRoles = pgTable(
  'rbac_user_roles',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    roleId: integer('role_id')
      .notNull()
      .references(() => rbacRoles.id),
    assignedAt: timestamp('assigned_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('rbac_user_roles_user_id_idx').on(table.userId),
    roleIdIdx: index('rbac_user_roles_role_id_idx').on(table.roleId),
  }),
);

export const rbacAuditLog = pgTable(
  'rbac_audit_log',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 255 }),
    resourceId: varchar('resource_id'),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    timestamp: timestamp('timestamp').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('rbac_audit_log_user_id_idx').on(table.userId),
    timestampIdx: index('rbac_audit_log_timestamp_idx').on(table.timestamp),
  }),
);

export const systemFeatures = pgTable(
  'system_features',
  {
    id: serial('id').primaryKey(),
    featureKey: varchar('feature_key', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }),
    isActive: boolean('is_active').default(true),
    isPremium: boolean('is_premium').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    featureKeyIdx: index('system_features_feature_key_idx').on(table.featureKey),
    categoryIdx: index('system_features_category_idx').on(table.category),
  }),
);

export const roleFeatures = pgTable(
  'role_features',
  {
    id: serial('id').primaryKey(),
    roleId: integer('role_id')
      .notNull()
      .references(() => rbacRoles.id),
    featureId: integer('feature_id')
      .notNull()
      .references(() => systemFeatures.id),
    accessLevel: varchar('access_level', { length: 50 }).notNull().default('read'),
    canCreate: boolean('can_create').default(false),
    canRead: boolean('can_read').default(true),
    canUpdate: boolean('can_update').default(false),
    canDelete: boolean('can_delete').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    roleIdIdx: index('role_features_role_id_idx').on(table.roleId),
    featureIdIdx: index('role_features_feature_id_idx').on(table.featureId),
  }),
);

export const roleHierarchy = pgTable(
  'role_hierarchy',
  {
    id: serial('id').primaryKey(),
    parentRoleId: integer('parent_role_id')
      .notNull()
      .references(() => rbacRoles.id),
    childRoleId: integer('child_role_id')
      .notNull()
      .references(() => rbacRoles.id),
    inheritanceLevel: integer('inheritance_level').default(1),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    parentRoleIdIdx: index('role_hierarchy_parent_role_id_idx').on(table.parentRoleId),
    childRoleIdIdx: index('role_hierarchy_child_role_id_idx').on(table.childRoleId),
  }),
);

export const userPermissionOverrides = pgTable(
  'user_permission_overrides',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    featureId: integer('feature_id')
      .notNull()
      .references(() => systemFeatures.id),
    accessLevel: varchar('access_level', { length: 50 }).notNull(),
    canCreate: boolean('can_create').default(false),
    canRead: boolean('can_read').default(true),
    canUpdate: boolean('can_update').default(false),
    canDelete: boolean('can_delete').default(false),
    grantedBy: varchar('granted_by').notNull(),
    reason: text('reason'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_permission_overrides_user_id_idx').on(table.userId),
    featureIdIdx: index('user_permission_overrides_feature_id_idx').on(table.featureId),
  }),
);

// ============================================================================
// PRODUCTS SYSTEM
// ============================================================================

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  price: decimal('price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  sku: varchar('sku', { length: 100 }).unique(),
  stockQuantity: integer('stock_quantity').default(0),
  isActive: boolean('is_active').default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// DIGITAL SIGNATURES SYSTEM
// ============================================================================

export const signRequests = pgTable('sign_requests', {
  id: serial('id').primaryKey(),
  contractId: varchar('contract_id').notNull(),
  requestedBy: varchar('requested_by').notNull(),
  signerEmail: varchar('signer_email', { length: 255 }).notNull(),
  signerName: varchar('signer_name', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending'),
  requestedAt: timestamp('requested_at').defaultNow(),
  signedAt: timestamp('signed_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customerSignatures = pgTable('customer_signatures', {
  id: serial('id').primaryKey(),
  signRequestId: integer('sign_request_id').references(() => signRequests.id),
  contractId: varchar('contract_id').notNull(),
  signerEmail: varchar('signer_email', { length: 255 }).notNull(),
  signerName: varchar('signer_name', { length: 255 }).notNull(),
  signatureData: text('signature_data').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  signedAt: timestamp('signed_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// SYSTEM LOGS & MONITORING
// ============================================================================

export const systemLogs = pgTable(
  'system_logs',
  {
    id: serial('id').primaryKey(),
    level: varchar('level', { length: 20 }).notNull(),
    message: text('message').notNull(),
    source: varchar('source', { length: 255 }),
    userId: varchar('user_id'),
    metadata: jsonb('metadata'),
    stackTrace: text('stack_trace'),
    timestamp: timestamp('timestamp').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    levelIdx: index('system_logs_level_idx').on(table.level),
    timestampIdx: index('system_logs_timestamp_idx').on(table.timestamp),
  }),
);

// ============================================================================
// NOTES & CODE GENERATION SYSTEM
// ============================================================================

export const notes = pgTable(
  'notes',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    title: varchar('title', { length: 255 }),
    content: text('content').notNull(),
    category: varchar('category', { length: 100 }),
    status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'active', 'archived'
    tags: jsonb('tags').$type<string[]>().default([]),
    isPinned: boolean('is_pinned').default(false),
    isShared: boolean('is_shared').default(false),
    googleDocsId: varchar('google_docs_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notes_user_id_idx').on(table.userId),
    categoryIdx: index('notes_category_idx').on(table.category),
    statusIdx: index('notes_status_idx').on(table.status),
  }),
);

export const codeGenerations = pgTable('code_generations', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  prompt: text('prompt').notNull(),
  generatedCode: text('generated_code').notNull(),
  language: varchar('language', { length: 50 }),
  framework: varchar('framework', { length: 100 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const smartTemplates = pgTable('smart_templates', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  templateType: varchar('template_type', { length: 100 }),
  templateData: jsonb('template_data').notNull(),
  category: varchar('category', { length: 100 }),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// SMART NOTES & AI FEATURES SYSTEM
// ============================================================================

export const smartNotes = pgTable(
  'smart_notes',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    title: varchar('title', { length: 255 }),
    content: text('content').notNull(),
    noteType: varchar('note_type', { length: 50 }).default('general'),
    tags: jsonb('tags').$type<string[]>().default([]),
    aiEnhanced: boolean('ai_enhanced').default(false),
    aiSuggestions: jsonb('ai_suggestions'),
    isPinned: boolean('is_pinned').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('smart_notes_user_id_idx').on(table.userId),
    noteTypeIdx: index('smart_notes_note_type_idx').on(table.noteType),
  }),
);

export const improvementTasks = pgTable(
  'improvement_tasks',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    priority: varchar('priority', { length: 20 }).default('medium'),
    status: varchar('status', { length: 50 }).default('pending'),
    dueDate: date('due_date'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('improvement_tasks_user_id_idx').on(table.userId),
    statusIdx: index('improvement_tasks_status_idx').on(table.status),
  }),
);

export const textEnhancementHistory = pgTable(
  'text_enhancement_history',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    originalText: text('original_text').notNull(),
    enhancedText: text('enhanced_text').notNull(),
    enhancementType: varchar('enhancement_type', { length: 100 }),
    context: jsonb('context'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('text_enhancement_history_user_id_idx').on(table.userId),
    enhancementTypeIdx: index('text_enhancement_history_enhancement_type_idx').on(
      table.enhancementType,
    ),
  }),
);

export const magicCreatorFeatures = pgTable(
  'magic_creator_features',
  {
    id: serial('id').primaryKey(),
    featureKey: varchar('feature_key', { length: 100 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isEnabled: boolean('is_enabled').default(true),
    configuration: jsonb('configuration'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    featureKeyIdx: index('magic_creator_features_feature_key_idx').on(table.featureKey),
  }),
);

// ============================================================================
// AI DOCUMENT ANALYSIS & PARSING SYSTEM
// ============================================================================

// Document Uploads
export const documentUploads = pgTable(
  'document_uploads',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    noteId: integer('note_id').references(() => notes.id),

    // File details
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 100 }).notNull(), // 'pdf', 'markdown', 'docx', 'txt'
    fileSize: bigint('file_size', { mode: 'number' }),
    fileUrl: text('file_url').notNull(),

    // Parsed content
    parsedContent: text('parsed_content'),
    parsedMarkdown: text('parsed_markdown'),

    // Metadata
    pageCount: integer('page_count'),
    wordCount: integer('word_count'),
    language: varchar('language', { length: 10 }).default('en'),

    // AI Analysis
    aiSummary: text('ai_summary'),
    aiKeyPoints: jsonb('ai_key_points').$type<string[]>().default([]),
    aiTags: jsonb('ai_tags').$type<string[]>().default([]),

    // Processing status
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'processing', 'completed', 'failed'
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('document_uploads_user_id_idx').on(table.userId),
    noteIdIdx: index('document_uploads_note_id_idx').on(table.noteId),
    statusIdx: index('document_uploads_status_idx').on(table.status),
  }),
);

// AI Text Analysis Jobs
export const aiTextAnalysisJobs = pgTable(
  'ai_text_analysis_jobs',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    noteId: integer('note_id').references(() => notes.id),

    // Analysis type
    analysisType: varchar('analysis_type', { length: 100 }).notNull(), // 'paraphrase', 'grammar', 'summarize', 'humanize', 'translate', 'citation', 'generate', 'detect'

    // Input
    inputText: text('input_text').notNull(),
    inputLanguage: varchar('input_language', { length: 10 }).default('en'),

    // Output
    outputText: text('output_text'),
    outputLanguage: varchar('output_language', { length: 10 }),

    // Parameters
    parameters: jsonb('parameters'), // Analysis-specific parameters

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    processingTime: integer('processing_time'), // milliseconds

    // Status
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'processing', 'completed', 'failed'
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_text_analysis_jobs_user_id_idx').on(table.userId),
    noteIdIdx: index('ai_text_analysis_jobs_note_id_idx').on(table.noteId),
    analysisTypeIdx: index('ai_text_analysis_jobs_analysis_type_idx').on(table.analysisType),
    statusIdx: index('ai_text_analysis_jobs_status_idx').on(table.status),
  }),
);

// AI Database Analysis
export const aiDatabaseAnalysis = pgTable(
  'ai_database_analysis',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Analysis input
    query: text('query').notNull(),
    context: text('context'),

    // Analysis results
    tables: jsonb('tables').$type<
      Array<{
        name: string;
        columns: Array<{ name: string; type: string; nullable: boolean }>;
        relations: string[];
      }>
    >(),
    patterns: jsonb('patterns').$type<string[]>().default([]),
    suggestions: jsonb('suggestions').$type<string[]>().default([]),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_database_analysis_user_id_idx').on(table.userId),
  }),
);

// AI Codebase Analysis
export const aiCodebaseAnalysis = pgTable(
  'ai_codebase_analysis',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Analysis input
    query: text('query').notNull(),
    targetPath: varchar('target_path', { length: 500 }),

    // Analysis results
    components: jsonb('components').$type<string[]>().default([]),
    patterns: jsonb('patterns').$type<string[]>().default([]),
    apiEndpoints: jsonb('api_endpoints').$type<string[]>().default([]),
    commonStructures: jsonb('common_structures').$type<string[]>().default([]),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_codebase_analysis_user_id_idx').on(table.userId),
  }),
);

// AI Web Search Results
export const aiWebSearchResults = pgTable(
  'ai_web_search_results',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Search query
    query: text('query').notNull(),

    // Search results
    results: jsonb('results')
      .$type<
        Array<{
          title: string;
          url: string;
          snippet: string;
          source: string;
        }>
      >()
      .notNull(),

    // AI summary
    aiSummary: text('ai_summary'),
    aiKeyFindings: jsonb('ai_key_findings').$type<string[]>().default([]),

    // Metadata
    resultCount: integer('result_count').default(0),
    searchEngine: varchar('search_engine', { length: 50 }).default('google'),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_web_search_results_user_id_idx').on(table.userId),
  }),
);

// AI API Discovery
export const aiApiDiscovery = pgTable(
  'ai_api_discovery',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Discovery query
    query: text('query').notNull(),
    category: varchar('category', { length: 100 }),

    // Discovered APIs
    apis: jsonb('apis')
      .$type<
        Array<{
          name: string;
          category: string;
          description: string;
          auth: 'none' | 'key' | 'oauth' | 'bearer';
          pricing: 'free' | 'freemium' | 'paid';
          endpoints: Array<{
            method: string;
            path: string;
            description: string;
          }>;
          documentation: string;
          useCase: string;
        }>
      >()
      .notNull(),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_api_discovery_user_id_idx').on(table.userId),
    categoryIdx: index('ai_api_discovery_category_idx').on(table.category),
  }),
);

// AI Document Q&A
export const aiDocumentQA = pgTable(
  'ai_document_qa',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    documentId: integer('document_id').references(() => documentUploads.id),

    // Question & Answer
    question: text('question').notNull(),
    answer: text('answer').notNull(),

    // Context
    relevantExcerpts: jsonb('relevant_excerpts')
      .$type<
        Array<{
          text: string;
          page?: number;
          confidence: number;
        }>
      >()
      .default([]),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    confidence: decimal('confidence', { precision: 5, scale: 2 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ai_document_qa_user_id_idx').on(table.userId),
    documentIdIdx: index('ai_document_qa_document_id_idx').on(table.documentId),
  }),
);

// ============================================================================
// AI DOCUMENT ANALYSIS RELATIONS
// ============================================================================

export const documentUploadsRelations = relations(documentUploads, ({ one, many }) => ({
  user: one(users, {
    fields: [documentUploads.userId],
    references: [users.id],
  }),
  note: one(notes, {
    fields: [documentUploads.noteId],
    references: [notes.id],
  }),
  qaHistory: many(aiDocumentQA),
}));

export const aiTextAnalysisJobsRelations = relations(aiTextAnalysisJobs, ({ one }) => ({
  user: one(users, {
    fields: [aiTextAnalysisJobs.userId],
    references: [users.id],
  }),
  note: one(notes, {
    fields: [aiTextAnalysisJobs.noteId],
    references: [notes.id],
  }),
}));

export const aiDatabaseAnalysisRelations = relations(aiDatabaseAnalysis, ({ one }) => ({
  user: one(users, {
    fields: [aiDatabaseAnalysis.userId],
    references: [users.id],
  }),
}));

export const aiCodebaseAnalysisRelations = relations(aiCodebaseAnalysis, ({ one }) => ({
  user: one(users, {
    fields: [aiCodebaseAnalysis.userId],
    references: [users.id],
  }),
}));

export const aiWebSearchResultsRelations = relations(aiWebSearchResults, ({ one }) => ({
  user: one(users, {
    fields: [aiWebSearchResults.userId],
    references: [users.id],
  }),
}));

export const aiApiDiscoveryRelations = relations(aiApiDiscovery, ({ one }) => ({
  user: one(users, {
    fields: [aiApiDiscovery.userId],
    references: [users.id],
  }),
}));

export const aiDocumentQARelations = relations(aiDocumentQA, ({ one }) => ({
  user: one(users, {
    fields: [aiDocumentQA.userId],
    references: [users.id],
  }),
  document: one(documentUploads, {
    fields: [aiDocumentQA.documentId],
    references: [documentUploads.id],
  }),
}));

// ============================================================================
// GEAR ANNOUNCEMENTS SYSTEM
// ============================================================================

export const gearAnnouncements = pgTable('gear_announcements', {
  id: serial('id').primaryKey(),
  brand: varchar('brand', { length: 100 }).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  announcementType: varchar('announcement_type', { length: 50 }).notNull(),
  releaseDate: date('release_date'),
  price: decimal('price', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NOK'),
  specifications: jsonb('specifications'),
  description: text('description'),
  imageUrl: text('image_url'),
  sourceUrl: text('source_url'),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// BRAND IMAGE DISCOVERIES SYSTEM
// ============================================================================

export const brandImageDiscoveries = pgTable('brand_image_discoveries', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  query: text('query').notNull(),
  imageUrl: text('image_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  source: varchar('source', { length: 100 }),
  metadata: jsonb('metadata'),
  isSaved: boolean('is_saved').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// EMAIL PROJECT ASSOCIATIONS SYSTEM
// ============================================================================

export const emailProjectAssociations = pgTable(
  'email_project_associations',
  {
    id: serial('id').primaryKey(),
    emailId: varchar('email_id', { length: 255 }).notNull(),
    projectId: varchar('project_id').notNull(),
    userId: varchar('user_id').notNull(),
    associationType: varchar('association_type', { length: 100 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    emailIdIdx: index('email_project_associations_email_id_idx').on(table.emailId),
    projectIdIdx: index('email_project_associations_project_id_idx').on(table.projectId),
  }),
);

// ============================================================================
// PROFESSION CONFIGURATIONS SYSTEM
// ============================================================================

export const professionConfigurations = pgTable('profession_configurations', {
  id: serial('id').primaryKey(),
  profession: varchar('profession', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  configuration: jsonb('configuration').notNull(),
  features: jsonb('features').default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const professionTypes = pgTable('profession_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// EMAIL TRACKING & ANALYTICS SYSTEM (Real-time Conversion Tracking)
// ============================================================================

/**
 * email_tracking_campaigns
 * Track email campaigns with real-time conversion metrics
 */
export const emailTrackingCampaigns = pgTable(
  'email_tracking_campaigns',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    campaignId: varchar('campaign_id', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    template: varchar('template', { length: 255 }),

    // Counts
    sentCount: integer('sent_count').default(0),
    openCount: integer('open_count').default(0),
    clickCount: integer('click_count').default(0),
    conversionCount: integer('conversion_count').default(0),

    // Rates (auto-calculated)
    openRate: decimal('open_rate', { precision: 5, scale: 2 }).default('0'),
    clickRate: decimal('click_rate', { precision: 5, scale: 2 }).default('0'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).default('0'),

    // A/B Testing
    isABTest: boolean('is_ab_test').default(false),
    variantAData: jsonb('variant_a_data'),
    variantBData: jsonb('variant_b_data'),

    sentAt: timestamp('sent_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('email_tracking_campaigns_campaign_id_idx').on(table.campaignId),
    userIdIdx: index('email_tracking_campaigns_user_id_idx').on(table.userId),
  }),
);

/**
 * email_tracking_opens
 * Track individual email opens (real-time)
 */
export const emailTrackingOpens = pgTable(
  'email_tracking_opens',
  {
    id: serial('id').primaryKey(),
    campaignId: varchar('campaign_id', { length: 255 }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    recipientName: varchar('recipient_name', { length: 255 }),
    userId: varchar('user_id'),

    // Tracking data
    openedAt: timestamp('opened_at').defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    device: varchar('device', { length: 50 }),
    browser: varchar('browser', { length: 50 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('email_tracking_opens_campaign_id_idx').on(table.campaignId),
    recipientEmailIdx: index('email_tracking_opens_recipient_email_idx').on(table.recipientEmail),
    openedAtIdx: index('email_tracking_opens_opened_at_idx').on(table.openedAt),
  }),
);

/**
 * email_tracking_clicks
 * Track link clicks in emails (real-time)
 */
export const emailTrackingClicks = pgTable(
  'email_tracking_clicks',
  {
    id: serial('id').primaryKey(),
    campaignId: varchar('campaign_id', { length: 255 }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    recipientName: varchar('recipient_name', { length: 255 }),
    userId: varchar('user_id'),

    // Link data
    linkUrl: text('link_url').notNull(),
    linkText: varchar('link_text', { length: 255 }),

    // Tracking data
    clickedAt: timestamp('clicked_at').defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('email_tracking_clicks_campaign_id_idx').on(table.campaignId),
    recipientEmailIdx: index('email_tracking_clicks_recipient_email_idx').on(table.recipientEmail),
    clickedAtIdx: index('email_tracking_clicks_clicked_at_idx').on(table.clickedAt),
  }),
);

/**
 * email_tracking_conversions
 * Track email → registration/subscription conversions (real-time)
 */
export const emailTrackingConversions = pgTable(
  'email_tracking_conversions',
  {
    id: serial('id').primaryKey(),
    campaignId: varchar('campaign_id', { length: 255 }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    userId: varchar('user_id').notNull(), // User who registered

    // Conversion data
    conversionType: varchar('conversion_type', { length: 100 }).notNull(), // 'registration', 'subscription', 'purchase'
    conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('NOK'),

    // Payment tracking
    paymentMethod: varchar('payment_method', { length: 50 }), // 'vipps', 'google_pay', 'stripe', 'paypal', 'klarna'
    paymentStatus: varchar('payment_status', { length: 50 }).default('completed'), // 'pending', 'completed', 'failed'
    transactionId: varchar('transaction_id', { length: 255 }),

    // Timeline
    emailSentAt: timestamp('email_sent_at'),
    emailOpenedAt: timestamp('email_opened_at'),
    linkClickedAt: timestamp('link_clicked_at'),
    convertedAt: timestamp('converted_at').defaultNow(),

    // Time to convert
    timeToConvert: integer('time_to_convert'), // minutes from email send to conversion

    // Google Analytics integration
    ga4ClientId: varchar('ga4_client_id', { length: 255 }), // GA4 client ID for cross-tracking
    ga4SessionId: varchar('ga4_session_id', { length: 255 }),
    ga4Tracked: boolean('ga4_tracked').default(false),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('email_tracking_conversions_campaign_id_idx').on(table.campaignId),
    userIdIdx: index('email_tracking_conversions_user_id_idx').on(table.userId),
    convertedAtIdx: index('email_tracking_conversions_converted_at_idx').on(table.convertedAt),
    paymentMethodIdx: index('email_tracking_conversions_payment_method_idx').on(
      table.paymentMethod,
    ),
  }),
);

/**
 * invitation_tokens
 * Secure token system for email invitations
 */
export const invitationTokens = pgTable(
  'invitation_tokens',
  {
    id: serial('id').primaryKey(),
    token: varchar('token', { length: 255 }).notNull().unique(),

    // Token data
    tokenType: varchar('token_type', { length: 50 }).notNull(), // 'prototype_tester', 'professional_user', 'admin'
    requestId: integer('request_id'), // Links to invite_requests or prototype_tester_requests

    // Invitation details
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    recipientName: varchar('recipient_name', { length: 255 }),
    profession: varchar('profession', { length: 100 }),
    assignedProfession: varchar('assigned_profession', { length: 100 }), // For prototype testers

    // Email campaign tracking
    campaignId: varchar('campaign_id', { length: 255 }),

    // Token status
    status: varchar('status', { length: 50 }).default('active'), // 'active', 'used', 'expired', 'revoked'
    isUsed: boolean('is_used').default(false),
    usedAt: timestamp('used_at'),
    usedBy: varchar('used_by'), // User ID who used the token

    // Expiration
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at').notNull(), // 7 days from creation
    revokedAt: timestamp('revoked_at'),
    revokedBy: varchar('revoked_by'),
    revokedReason: text('revoked_reason'),
  },
  (table) => ({
    tokenIdx: index('invitation_tokens_token_idx').on(table.token),
    recipientEmailIdx: index('invitation_tokens_recipient_email_idx').on(table.recipientEmail),
    statusIdx: index('invitation_tokens_status_idx').on(table.status),
    campaignIdIdx: index('invitation_tokens_campaign_id_idx').on(table.campaignId),
  }),
);

/**
 * prototype_tester_requests
 * Store prototype tester applications with real data
 */
export const prototypeTesterRequests = pgTable(
  'prototype_tester_requests',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }),
    profession: varchar('profession', { length: 100 }).notNull(), // Assigned profession for testing
    testingAreas: jsonb('testing_areas').$type<string[]>().notNull(),
    experience: varchar('experience', { length: 50 }).notNull(),
    feedback: text('feedback'),
    availableTime: varchar('available_time', { length: 100 }),
    deviceInfo: text('device_info'),

    // Status tracking
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'approved', 'rejected'
    requestDate: timestamp('request_date').defaultNow(),
    processedDate: timestamp('processed_date'),
    processedBy: varchar('processed_by'),

    // Invitation tracking
    invitationTokenId: integer('invitation_token_id'),
    invitationSentAt: timestamp('invitation_sent_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('prototype_tester_requests_email_idx').on(table.email),
    statusIdx: index('prototype_tester_requests_status_idx').on(table.status),
    professionIdx: index('prototype_tester_requests_profession_idx').on(table.profession),
  }),
);

// ============================================================================
// PROFESSION DASHBOARD CONFIGURATION SYSTEM
// ============================================================================

/**
 * profession_dashboard_configs
 * Stores dashboard layout and configuration for each profession
 */
export const professionDashboardConfigs = pgTable(
  'profession_dashboard_configs',
  {
    id: serial('id').primaryKey(),
    profession: varchar('profession', { length: 100 })
      .notNull()
      .unique()
      .references(() => professionConfigurations.profession),
    layoutTemplate: varchar('layout_template', { length: 50 })
      .$type<'compact' | 'expanded' | 'visual_heavy'>()
      .default('expanded'),
    headerConfig: jsonb('header_config').notNull(), // { showSearch: bool, showNotifications: bool, etc }
    sidebarConfig: jsonb('sidebar_config').notNull(), // { collapsed: bool, pinnedItems: [] }
    gridLayout: jsonb('grid_layout').notNull(), // { columns: 12, gap: 2, breakpoints: {} }
    customSections: jsonb('custom_sections'), // Array of custom dashboard sections
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionIdx: index('profession_dashboard_configs_profession_idx').on(table.profession),
  }),
);

/**
 * profession_tabs
 * Defines which tabs appear in the dashboard for each profession
 */
export const professionTabs = pgTable(
  'profession_tabs',
  {
    id: serial('id').primaryKey(),
    profession: varchar('profession', { length: 100 })
      .notNull()
      .references(() => professionConfigurations.profession),
    tabId: varchar('tab_id', { length: 100 }).notNull(), // e.g., 'overview', 'projects', 'showcase'
    label: varchar('label', { length: 255 }).notNull(),
    icon: varchar('icon', { length: 100 }), // MUI icon name or custom icon ID
    sortOrder: integer('sort_order').default(0),
    isEnabled: boolean('is_enabled').default(true),
    isDefault: boolean('is_default').default(false), // Is this the default tab?
    requiredFeatures: jsonb('required_features'), // Array of feature IDs required for this tab
    config: jsonb('config'), // Tab-specific configuration
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionTabIdx: index('profession_tabs_profession_tab_idx').on(table.profession, table.tabId),
    professionOrderIdx: index('profession_tabs_profession_order_idx').on(
      table.profession,
      table.sortOrder,
    ),
  }),
);

/**
 * profession_project_types
 * Defines available project types for each profession
 */
export const professionProjectTypes = pgTable(
  'profession_project_types',
  {
    id: serial('id').primaryKey(),
    profession: varchar('profession', { length: 100 })
      .notNull()
      .references(() => professionConfigurations.profession),
    typeId: varchar('type_id', { length: 100 }).notNull(), // e.g., 'wedding', 'portrait', 'commercial'
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 100 }),
    color: varchar('color', { length: 20 }), // Hex color code
    defaultFields: jsonb('default_fields'), // Array of default form fields for this type
    templates: jsonb('templates'), // Array of template configurations
    isEnabled: boolean('is_enabled').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionTypeIdx: index('profession_project_types_profession_type_idx').on(
      table.profession,
      table.typeId,
    ),
    professionOrderIdx: index('profession_project_types_profession_order_idx').on(
      table.profession,
      table.sortOrder,
    ),
  }),
);

/**
 * profession_stats
 * Defines which statistics to display on the dashboard for each profession
 */
export const professionStats = pgTable(
  'profession_stats',
  {
    id: serial('id').primaryKey(),
    profession: varchar('profession', { length: 100 })
      .notNull()
      .references(() => professionConfigurations.profession),
    statId: varchar('stat_id', { length: 100 }).notNull(), // e.g., 'active_projects', 'total_revenue'
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 100 }),
    color: varchar('color', { length: 20 }),
    dataSource: varchar('data_source', { length: 255 }).notNull(), // API endpoint or query key
    format: varchar('format', { length: 50 }), // 'number', 'currency', 'percentage', 'duration'
    isEnabled: boolean('is_enabled').default(true),
    sortOrder: integer('sort_order').default(0),
    size: varchar('size', { length: 20 }).$type<'small' | 'medium' | 'large'>().default('medium'),
    trendEnabled: boolean('trend_enabled').default(false), // Show trend arrow?
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    professionStatIdx: index('profession_stats_profession_stat_idx').on(
      table.profession,
      table.statId,
    ),
    professionOrderIdx: index('profession_stats_profession_order_idx').on(
      table.profession,
      table.sortOrder,
    ),
  }),
);

// ============================================================================
// VISUAL CMS SYSTEM
// ============================================================================

export const cmsPages = pgTable('cms_pages', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  content: jsonb('content').notNull(),
  status: varchar('status', { length: 50 }).default('draft'),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pageVersions = pgTable('page_versions', {
  id: serial('id').primaryKey(),
  pageId: integer('page_id')
    .notNull()
    .references(() => cmsPages.id),
  versionNumber: integer('version_number').notNull(),
  content: jsonb('content').notNull(),
  createdBy: varchar('created_by').notNull(),
  versionNote: text('version_note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workflowStates = pgTable('workflow_states', {
  id: serial('id').primaryKey(),
  pageId: integer('page_id')
    .notNull()
    .references(() => cmsPages.id),
  state: varchar('state', { length: 100 }).notNull(),
  assignedTo: varchar('assigned_to'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cmsAssets = pgTable('cms_assets', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }),
  fileSize: bigint('file_size', { mode: 'number' }),
  fileUrl: text('file_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  altText: varchar('alt_text', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cmsThemes = pgTable('cms_themes', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  themeData: jsonb('theme_data').notNull(),
  isActive: boolean('is_active').default(true),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const componentDefinitions = pgTable('component_definitions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  componentSchema: jsonb('component_schema').notNull(),
  defaultProps: jsonb('default_props'),
  category: varchar('category', { length: 100 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const designTokens = pgTable('design_tokens', {
  id: serial('id').primaryKey(),
  themeId: integer('theme_id').references(() => cmsThemes.id),
  tokenName: varchar('token_name', { length: 255 }).notNull(),
  tokenValue: text('token_value').notNull(),
  tokenType: varchar('token_type', { length: 50 }),
  category: varchar('category', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pageTemplates = pgTable('page_templates', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  templateData: jsonb('template_data').notNull(),
  category: varchar('category', { length: 100 }),
  isPublic: boolean('is_public').default(false),
  usageCount: integer('usage_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// LEAD IMPORT SYSTEM
// ============================================================================

export const leadImportTemplates = pgTable('lead_import_templates', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  templateData: jsonb('template_data').notNull(),
  fieldMappings: jsonb('field_mappings').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// PROJECT DRAFT AUTOSAVE SYSTEM
// ============================================================================

export const projectDraftAutosave = pgTable('project_draft_autosave', {
  id: serial('id').primaryKey(),
  projectId: varchar('project_id').notNull().unique(),
  userId: varchar('user_id').notNull(),
  draftData: jsonb('draft_data').notNull(),
  version: integer('version').default(1),
  lastSavedAt: timestamp('last_saved_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const projectDraftVersions = pgTable('project_draft_versions', {
  id: serial('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  userId: varchar('user_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  draftData: jsonb('draft_data').notNull(),
  versionNote: text('version_note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// PROJECT PRESETS & SUGGESTIONS SYSTEM
// ============================================================================

export const projectPresets = pgTable('project_presets', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  presetData: jsonb('preset_data').notNull(),
  profession: varchar('profession', { length: 100 }),
  usageCount: integer('usage_count').default(0),
  isPublic: boolean('is_public').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const presetSuggestions = pgTable('preset_suggestions', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  presetId: integer('preset_id').references(() => projectPresets.id),
  suggestionType: varchar('suggestion_type', { length: 100 }),
  relevanceScore: decimal('relevance_score', { precision: 5, scale: 2 }),
  context: jsonb('context'),
  isAccepted: boolean('is_accepted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projectSimilarityAnalysis = pgTable('project_similarity_analysis', {
  id: serial('id').primaryKey(),
  projectId: varchar('project_id').notNull(),
  similarProjectId: varchar('similar_project_id').notNull(),
  similarityScore: decimal('similarity_score', { precision: 5, scale: 2 }).notNull(),
  matchingFactors: jsonb('matching_factors'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const presetUsageHistory = pgTable('preset_usage_history', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  presetId: integer('preset_id').references(() => projectPresets.id),
  projectId: varchar('project_id'),
  usedAt: timestamp('used_at').defaultNow(),
  feedback: varchar('feedback', { length: 50 }),
});

// ============================================================================
// PHOTOGRAPHER-CLIENT GALLERY SYSTEM
// ============================================================================

export const photographerClientGalleries = pgTable('photographer_client_galleries', {
  id: uuid('id').primaryKey().defaultRandom(),
  photographerId: varchar('photographer_id').notNull(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),
  projectTitle: varchar('project_title').notNull(),
  accessToken: varchar('access_token').notNull().unique(),
  gallerySettings: jsonb('gallery_settings')
    .$type<{
      maxSelections: number;
      pricePerImage: number;
      currency: string;
      contractedImages: number;
      allowDownload: boolean;
      allowComments: boolean;
      watermarkEnabled: boolean;
      expiresAt?: string;
    }>()
    .notNull(),
  status: varchar('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const clientGalleryImages = pgTable('client_gallery_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  photographerId: varchar('photographer_id').notNull(),
  imageTitle: varchar('image_title').notNull(),
  imageDescription: text('image_description'),
  thumbnailUrl: varchar('thumbnail_url').notNull(),
  fullSizeUrl: varchar('full_size_url').notNull(),
  watermarkedUrl: varchar('watermarked_url'),
  imageMetadata: jsonb('image_metadata').$type<{
    width: number;
    height: number;
    fileSize: number;
    format: string;
    cameraSettings?: {
      camera: string;
      lens: string;
      iso: number;
      aperture: string;
      shutterSpeed: string;
    };
    location?: string;
    dateTaken?: string;
  }>(),
  tags: jsonb('tags').$type<string[]>().default([]),
  sortOrder: integer('sort_order').default(0),
  isVisible: boolean('is_visible').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clientImageSelections = pgTable('client_image_selections', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  imageId: uuid('image_id').notNull(),
  clientEmail: varchar('client_email').notNull(),
  selectionType: varchar('selection_type').notNull(),
  priority: integer('priority').default(0),
  clientNotes: text('client_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clientImageComments = pgTable('client_image_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  imageId: uuid('image_id').notNull(),
  clientName: varchar('client_name').notNull(),
  clientEmail: varchar('client_email').notNull(),
  comment: text('comment').notNull(),
  commentType: varchar('comment_type').default('general'),
  status: varchar('status').default('open'),
  photographerResponse: text('photographer_response'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const clientImagePayments = pgTable('client_image_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  galleryId: uuid('gallery_id').notNull(),
  clientEmail: varchar('client_email').notNull(),
  photographerId: varchar('photographer_id').notNull(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency').default('NOK'),
  additionalImages: integer('additional_images').default(0),
  selectedImageIds: jsonb('selected_image_ids').$type<string[]>().notNull(),
  paymentStatus: varchar('payment_status').default('pending'),
  paymentDate: timestamp('payment_date'),
  downloadToken: varchar('download_token'),
  downloadExpiresAt: timestamp('download_expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Alias for singular naming
export const pricingStructure = pricingStructures;

// ============================================================================
// PROJECT TIMELINES & SUBMISSIONS SYSTEM
// ============================================================================

export const projectTimelines = pgTable(
  'project_timelines',
  {
    id: serial('id').primaryKey(),
    projectId: varchar('project_id').notNull(),
    userId: varchar('user_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    timelineData: jsonb('timeline_data').notNull().default([]),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('project_timelines_project_id_idx').on(table.projectId),
    userIdIdx: index('project_timelines_user_id_idx').on(table.userId),
  }),
);

export const submissions = pgTable(
  'submissions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar('project_id').notNull(), // Original project this submission relates to
    userId: varchar('user_id').notNull(),
    submissionType: varchar('submission_type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }),
    content: text('content'),
    data: jsonb('data'),
    status: varchar('status', { length: 50 }).default('pending'),
    submittedAt: timestamp('submitted_at').defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: varchar('reviewed_by'),
    feedback: text('feedback'),
    // ⭐ Project conversion tracking
    createdProjectId: varchar('created_project_id', { length: 255 }), // Links to projects.id when submission is converted to new project
    convertedAt: timestamp('converted_at'), // Timestamp of conversion to project
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    projectIdIdx: index('submissions_project_id_idx').on(table.projectId),
    userIdIdx: index('submissions_user_id_idx').on(table.userId),
    statusIdx: index('submissions_status_idx').on(table.status),
    // ⭐ Indexes for conversion tracking
    createdProjectIdIdx: index('idx_submissions_created_project_id').on(table.createdProjectId),
    convertedAtIdx: index('idx_submissions_converted_at').on(table.convertedAt),
  }),
);

// ============================================================================
// EMAIL TEMPLATES SYSTEM
// ============================================================================

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id'),
    name: varchar('name', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    body: text('body').notNull(),
    category: varchar('category', { length: 100 }),
    variables: jsonb('variables').default([]),
    isActive: boolean('is_active').default(true),
    isPublic: boolean('is_public').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    nameIdx: index('email_templates_name_idx').on(table.name),
    categoryIdx: index('email_templates_category_idx').on(table.category),
  }),
);

// ============================================================================
// GOOGLE DRIVE FILES SYSTEM
// ============================================================================
// NOTE: googleDriveFiles is already exported from virtual-studio-schema.ts
// This is a duplicate definition that should be removed or renamed

// Commenting out duplicate export - use the one from virtual-studio-schema instead
// export const googleDriveFiles = pgTable('google_drive_files', {
 
const _googleDriveFilesLegacy = pgTable(
  'google_drive_files_legacy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id').notNull(),
    projectId: varchar('project_id'),
    driveFileId: varchar('drive_file_id', { length: 255 }).notNull().unique(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: bigint('file_size', { mode: 'number' }),
    webViewLink: text('web_view_link'),
    webContentLink: text('web_content_link'),
    thumbnailLink: text('thumbnail_link'),
    parentFolderId: varchar('parent_folder_id', { length: 255 }),
    isShared: boolean('is_shared').default(false),
    permissions: jsonb('permissions'),
    metadata: jsonb('metadata'),
    syncStatus: varchar('sync_status', { length: 50 }).default('synced'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('google_drive_files_user_id_idx').on(table.userId),
    projectIdIdx: index('google_drive_files_project_id_idx').on(table.projectId),
    driveFileIdIdx: index('google_drive_files_drive_file_id_idx').on(table.driveFileId),
  }),
);

// ============================================================================
// NORWEGIAN DICTIONARY SYSTEM (Clue-style Integration)
// ============================================================================

/**
 * dictionary_entries
 * Core dictionary database with Norwegian ↔ English translations
 */
export const dictionaryEntries = pgTable(
  'dictionary_entries',
  {
    id: serial('id').primaryKey(),

    // Word details
    word: varchar('word', { length: 255 }).notNull(),
    language: varchar('language', { length: 10 }).notNull(), // 'no', 'en'

    // Translations (stored as JSONB for flexibility)
    translations: jsonb('translations')
      .$type<
        Array<{
          text: string;
          context?: string;
          domain?: string;
          confidence: number;
        }>
      >()
      .notNull(),

    // Linguistic information
    pronunciation: varchar('pronunciation', { length: 255 }),
    wordClass: varchar('word_class', { length: 50 }), // noun, verb, adjective, adverb, etc.
    domain: varchar('domain', { length: 100 }), // business, legal, IT, creative, marketing, medical, etc.

    // Usage examples
    examples: jsonb('examples')
      .$type<
        Array<{
          norwegian: string;
          english: string;
          domain?: string;
        }>
      >()
      .default([]),

    // Related words
    synonyms: jsonb('synonyms').$type<string[]>().default([]),
    relatedTerms: jsonb('related_terms').$type<string[]>().default([]),

    // Frequency & popularity
    frequency: varchar('frequency', { length: 50 }).default('common'), // 'common', 'uncommon', 'technical', 'rare'
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Quality & verification
    isVerified: boolean('is_verified').default(false),
    verifiedBy: varchar('verified_by').references(() => users.id),
    verifiedAt: timestamp('verified_at'),

    // Source information
    source: varchar('source', { length: 100 }).default('system'), // 'system', 'user_contributed', 'ai_generated', 'imported'
    sourceUrl: text('source_url'),

    // Status
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    wordIdx: index('dictionary_entries_word_idx').on(table.word),
    languageIdx: index('dictionary_entries_language_idx').on(table.language),
    domainIdx: index('dictionary_entries_domain_idx').on(table.domain),
    wordClassIdx: index('dictionary_entries_word_class_idx').on(table.wordClass),
    frequencyIdx: index('dictionary_entries_frequency_idx').on(table.frequency),
    wordLanguageIdx: unique('dictionary_entries_word_language_unique').on(
      table.word,
      table.language,
    ),
  }),
);

/**
 * dictionary_search_history
 * Track user dictionary searches for analytics and suggestions
 */
export const dictionarySearchHistory = pgTable(
  'dictionary_search_history',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Search details
    searchWord: varchar('search_word', { length: 255 }).notNull(),
    fromLanguage: varchar('from_language', { length: 10 }).notNull(), // 'no', 'en'
    toLanguage: varchar('to_language', { length: 10 }).notNull(), // 'no', 'en'

    // Result
    entryId: integer('entry_id').references(() => dictionaryEntries.id),
    resultFound: boolean('result_found').default(true),

    // Context
    noteId: integer('note_id').references(() => notes.id),
    selectedText: text('selected_text'), // Text that was selected when lookup was triggered

    // Timestamps
    searchedAt: timestamp('searched_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('dictionary_search_history_user_id_idx').on(table.userId),
    searchWordIdx: index('dictionary_search_history_search_word_idx').on(table.searchWord),
    searchedAtIdx: index('dictionary_search_history_searched_at_idx').on(table.searchedAt),
  }),
);

/**
 * dictionary_user_bookmarks
 * User-bookmarked dictionary entries
 */
export const dictionaryUserBookmarks = pgTable(
  'dictionary_user_bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    entryId: integer('entry_id')
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: 'cascade' }),

    // Bookmark metadata
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().default([]),

    // Timestamps
    bookmarkedAt: timestamp('bookmarked_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('dictionary_user_bookmarks_user_id_idx').on(table.userId),
    entryIdIdx: index('dictionary_user_bookmarks_entry_id_idx').on(table.entryId),
    userEntryIdx: unique('dictionary_user_bookmarks_user_entry_unique').on(
      table.userId,
      table.entryId,
    ),
  }),
);

/**
 * dictionary_user_contributions
 * User-contributed dictionary entries (crowdsourced)
 */
export const dictionaryUserContributions = pgTable(
  'dictionary_user_contributions',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Contribution details
    word: varchar('word', { length: 255 }).notNull(),
    language: varchar('language', { length: 10 }).notNull(),
    translation: varchar('translation', { length: 500 }).notNull(),
    context: text('context'),
    domain: varchar('domain', { length: 100 }),

    // Examples
    exampleNorwegian: text('example_norwegian'),
    exampleEnglish: text('example_english'),

    // Status
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'approved', 'rejected', 'merged'
    reviewedBy: varchar('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),

    // Merged entry reference
    mergedIntoEntryId: integer('merged_into_entry_id').references(() => dictionaryEntries.id),

    // Timestamps
    submittedAt: timestamp('submitted_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('dictionary_user_contributions_user_id_idx').on(table.userId),
    wordIdx: index('dictionary_user_contributions_word_idx').on(table.word),
    statusIdx: index('dictionary_user_contributions_status_idx').on(table.status),
  }),
);

/**
 * dictionary_translation_requests
 * Track translation requests for words not in dictionary
 */
export const dictionaryTranslationRequests = pgTable(
  'dictionary_translation_requests',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Request details
    word: varchar('word', { length: 255 }).notNull(),
    fromLanguage: varchar('from_language', { length: 10 }).notNull(),
    toLanguage: varchar('to_language', { length: 10 }).notNull(),
    context: text('context'),

    // AI translation result
    aiTranslation: text('ai_translation'),
    aiConfidence: decimal('ai_confidence', { precision: 5, scale: 2 }),
    aiProvider: varchar('ai_provider', { length: 50 }),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    // Status
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'completed', 'failed', 'added_to_dictionary'
    addedToEntryId: integer('added_to_entry_id').references(() => dictionaryEntries.id),

    // Request count (how many users requested this word)
    requestCount: integer('request_count').default(1),

    // Timestamps
    requestedAt: timestamp('requested_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('dictionary_translation_requests_user_id_idx').on(table.userId),
    wordIdx: index('dictionary_translation_requests_word_idx').on(table.word),
    statusIdx: index('dictionary_translation_requests_status_idx').on(table.status),
    wordLanguagesIdx: index('dictionary_translation_requests_word_languages_idx').on(
      table.word,
      table.fromLanguage,
      table.toLanguage,
    ),
  }),
);

/**
 * dictionary_usage_analytics
 * Track dictionary usage patterns for insights
 */
export const dictionaryUsageAnalytics = pgTable(
  'dictionary_usage_analytics',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),

    // Analytics period
    date: date('date').notNull(),
    profession: varchar('profession', { length: 100 }),

    // Usage metrics
    totalSearches: integer('total_searches').default(0),
    uniqueWords: integer('unique_words').default(0),
    norwegianToEnglish: integer('norwegian_to_english').default(0),
    englishToNorwegian: integer('english_to_norwegian').default(0),

    // Domain breakdown
    domainUsage: jsonb('domain_usage').$type<Record<string, number>>().default({}),

    // Most searched words
    topWords: jsonb('top_words')
      .$type<
        Array<{
          word: string;
          count: number;
          domain?: string;
        }>
      >()
      .default([]),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdDateIdx: unique('dictionary_usage_analytics_user_date_unique').on(
      table.userId,
      table.date,
    ),
    dateIdx: index('dictionary_usage_analytics_date_idx').on(table.date),
    professionIdx: index('dictionary_usage_analytics_profession_idx').on(table.profession),
  }),
);

/**
 * dictionary_domain_categories
 * Domain categories for organizing technical terminology
 */
export const dictionaryDomainCategories = pgTable(
  'dictionary_domain_categories',
  {
    id: serial('id').primaryKey(),

    // Category details
    domainKey: varchar('domain_key', { length: 100 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),

    // Visual
    icon: varchar('icon', { length: 100 }),
    color: varchar('color', { length: 7 }).default('#3B82F6'),

    // Profession relevance
    relevantProfessions: jsonb('relevant_professions').$type<string[]>().default([]),

    // Stats
    entryCount: integer('entry_count').default(0),

    // Status
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    domainKeyIdx: index('dictionary_domain_categories_domain_key_idx').on(table.domainKey),
    sortOrderIdx: index('dictionary_domain_categories_sort_order_idx').on(table.sortOrder),
  }),
);

/**
 * dictionary_pronunciation_audio
 * Audio files for word pronunciation
 */
export const dictionaryPronunciationAudio = pgTable(
  'dictionary_pronunciation_audio',
  {
    id: serial('id').primaryKey(),
    entryId: integer('entry_id')
      .notNull()
      .references(() => dictionaryEntries.id, { onDelete: 'cascade' }),

    // Audio details
    audioUrl: text('audio_url').notNull(),
    audioFormat: varchar('audio_format', { length: 20 }).default('mp3'), // 'mp3', 'wav', 'ogg'
    duration: integer('duration'), // milliseconds

    // Generation info
    generatedBy: varchar('generated_by', { length: 50 }).default('tts'), // 'tts', 'recorded', 'imported'
    ttsProvider: varchar('tts_provider', { length: 50 }), // 'google', 'azure', 'elevenlabs'
    voice: varchar('voice', { length: 100 }), // Voice ID or name

    // Quality
    quality: varchar('quality', { length: 20 }).default('standard'), // 'standard', 'high', 'premium'

    // Usage tracking
    playCount: integer('play_count').default(0),
    lastPlayedAt: timestamp('last_played_at'),

    // Status
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    entryIdIdx: index('dictionary_pronunciation_audio_entry_id_idx').on(table.entryId),
  }),
);

/**
 * dictionary_context_suggestions
 * AI-suggested dictionary entries based on note context
 */
export const dictionaryContextSuggestions = pgTable(
  'dictionary_context_suggestions',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    noteId: integer('note_id').references(() => notes.id),

    // Context analysis
    noteContent: text('note_content').notNull(),
    detectedLanguage: varchar('detected_language', { length: 10 }),

    // Suggested words
    suggestions: jsonb('suggestions')
      .$type<
        Array<{
          word: string;
          entryId?: number;
          relevanceScore: number;
          context: string;
          reason: string;
        }>
      >()
      .notNull(),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).default('openai'),
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),

    // User interaction
    acceptedSuggestions: jsonb('accepted_suggestions').$type<string[]>().default([]),
    rejectedSuggestions: jsonb('rejected_suggestions').$type<string[]>().default([]),

    // Timestamps
    generatedAt: timestamp('generated_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('dictionary_context_suggestions_user_id_idx').on(table.userId),
    noteIdIdx: index('dictionary_context_suggestions_note_id_idx').on(table.noteId),
  }),
);

// ============================================================================
// CUSTOMER JOURNEY BUILDER SYSTEM
// ============================================================================

// Customer Journey Templates - Main table for journey definitions
export const customerJourneyTemplates = pgTable(
  'customer_journey_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    profession: varchar('profession', { length: 100 }).notNull(),
    packageType: varchar('package_type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 })
      .$type<'draft' | 'active' | 'archived' | 'published'>()
      .default('draft'),

    // Building Blocks (stored as JSONB for flexibility)
    stages: jsonb('stages')
      .$type<
        Array<{
          id: string;
          type: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'advocacy';
          name: string;
          customName?: string;
          color: string;
          icon: string;
          order: number;
          description: string;
          goals?: string[];
          metrics?: {
            conversionRate?: number;
            dropoffRate?: number;
            avgTimeSpent?: number;
          };
        }>
      >()
      .notNull()
      .default([]),

    touchpoints: jsonb('touchpoints')
      .$type<
        Array<{
          id: string;
          type: string;
          name: string;
          stageId: string;
          description: string;
          order: number;
          media?: {
            type: 'image' | 'video' | 'link' | 'document';
            url: string;
            thumbnail?: string;
          };
          cta?: {
            text: string;
            url: string;
            action: string;
          };
          linkedData?: {
            campaignUrl?: string;
            videoFileId?: string;
            crmEntryId?: string;
            analyticsId?: string;
          };
          notes?: string[];
          estimatedDuration?: number;
          conversionRate?: number;
          aiSuggestions?: {
            messageType?: 'emotional' | 'rational' | 'urgency' | 'social_proof';
            recommendedContent?: string;
            predictedConversion?: number;
          };
        }>
      >()
      .default([]),

    personas: jsonb('personas')
      .$type<
        Array<{
          id: string;
          name: string;
          avatar?: string;
          imageUrl?: string;
          demographics: {
            age?: string;
            location?: string;
            occupation?: string;
            income?: string;
          };
          psychographics: {
            motivations: string[];
            painPoints: string[];
            goals: string[];
            frustrations: string[];
            values: string[];
          };
          behavior: {
            preferredChannels: string[];
            buyingTriggers: string[];
            decisionFactors: string[];
          };
          aiGenerated?: boolean;
          customFields?: Record<string, string>;
        }>
      >()
      .default([]),

    // Legacy compatibility
    steps: jsonb('steps')
      .$type<
        Array<{
          id: string;
          stepOrder: number;
          stepType: string;
          title: string;
          content: string;
          componentConfig: Record<string, unknown>;
          isActive: boolean;
          createdAt?: string;
          updatedAt?: string;
        }>
      >()
      .default([]),

    // Configuration
    visualizationType: varchar('visualization_type', { length: 50 })
      .$type<'timeline' | 'funnel' | 'circular' | 'matrix'>()
      .default('timeline'),
    templateType: varchar('template_type', { length: 50 }).$type<
      'ecommerce' | 'wedding' | 'b2b' | 'saas' | 'service' | 'custom'
    >(),
    activePersonaId: varchar('active_persona_id', { length: 255 }),

    // Dynamic features
    dynamicLinks: jsonb('dynamic_links')
      .$type<{
        [touchpointId: string]: {
          url: string;
          type: string;
          metadata: Record<string, unknown>;
        };
      }>()
      .default({}),

    aiInsights: jsonb('ai_insights').$type<{
      predictedConversionPath: string[];
      optimizationSuggestions: string[];
      personaRecommendations: string[];
      lastUpdated: string;
    }>(),

    // Metadata
    tags: jsonb('tags').$type<string[]>().default([]),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
    usageCount: integer('usage_count').default(0),
    estimatedCompletionTime: integer('estimated_completion_time'), // Minutes

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('customer_journey_templates_user_id_idx').on(table.userId),
    professionIdx: index('customer_journey_templates_profession_idx').on(table.profession),
    statusIdx: index('customer_journey_templates_status_idx').on(table.status),
    templateTypeIdx: index('customer_journey_templates_template_type_idx').on(table.templateType),
  }),
);

// Customer Journey Notes - Rich text notes for journeys (1:1 relationship)
export const customerJourneyNotes = pgTable(
  'customer_journey_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => customerJourneyTemplates.id, { onDelete: 'cascade' })
      .unique(),
    content: text('content'), // Rich HTML content from Quill editor
    createdBy: varchar('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    templateIdIdx: index('customer_journey_notes_template_id_idx').on(table.templateId),
  }),
);

// Customer Journey Analytics - Performance tracking (1:many relationship)
export const customerJourneyAnalytics = pgTable(
  'customer_journey_analytics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => customerJourneyTemplates.id, { onDelete: 'cascade' }),
    stageId: varchar('stage_id', { length: 255 }),
    touchpointId: varchar('touchpoint_id', { length: 255 }),
    personaId: varchar('persona_id', { length: 255 }),

    // Metrics
    impressions: integer('impressions').default(0),
    clicks: integer('clicks').default(0),
    conversions: integer('conversions').default(0),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
    avgTimeSpent: integer('avg_time_spent'), // Seconds
    dropOffCount: integer('drop_off_count').default(0),

    // Time tracking
    measuredAt: timestamp('measured_at').defaultNow(),
    date: date('date').defaultNow(),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    templateIdIdx: index('customer_journey_analytics_template_id_idx').on(table.templateId),
    dateIdx: index('customer_journey_analytics_date_idx').on(table.date),
    stageIdIdx: index('customer_journey_analytics_stage_id_idx').on(table.stageId),
    touchpointIdIdx: index('customer_journey_analytics_touchpoint_id_idx').on(table.touchpointId),
  }),
);

// Customer Journey AI Cache - Cache AI responses to avoid redundant calls
export const customerJourneyAiCache = pgTable(
  'customer_journey_ai_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id').references(() => customerJourneyTemplates.id, {
      onDelete: 'cascade',
    }),
    requestType: varchar('request_type', { length: 100 }).notNull(), // 'generate-persona', 'message-coach', 'predict-flow', etc.
    requestParams: jsonb('request_params').notNull(),
    responseData: jsonb('response_data').notNull(),
    aiProvider: varchar('ai_provider', { length: 50 }), // 'openai', 'anthropic', 'google'
    model: varchar('model', { length: 100 }), // 'gpt-4', 'claude-3', etc.
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    templateIdIdx: index('customer_journey_ai_cache_template_id_idx').on(table.templateId),
    requestTypeIdx: index('customer_journey_ai_cache_request_type_idx').on(table.requestType),
  }),
);

// Customer Journey User Preferences - Persist UI customization per user
export const customerJourneyUserPreferences = pgTable(
  'customer_journey_user_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id)
      .unique(),

    // View preferences
    viewMode: varchar('view_mode', { length: 20 }).$type<'grid' | 'list'>().default('grid'),
    sortBy: varchar('sort_by', { length: 20 }).$type<'name' | 'date' | 'usage'>().default('date'),
    filterStatus: varchar('filter_status', { length: 20 }).default('all'), // 'all', 'draft', 'active', 'archived', 'published'
    filterPackage: varchar('filter_package', { length: 100 }).default('all'),

    // Visualization preferences
    defaultVisualizationType: varchar('default_visualization_type', { length: 50 })
      .$type<'timeline' | 'funnel' | 'circular' | 'matrix'>()
      .default('timeline'),
    showReactFlowPreview: boolean('show_react_flow_preview').default(false),

    // Panel visibility
    showNotesPanel: boolean('show_notes_panel').default(false),
    showAIUtilitiesPanel: boolean('show_ai_utilities_panel').default(true),
    showAnalyticsPanel: boolean('show_analytics_panel').default(true),

    // Default template settings
    defaultTemplateType: varchar('default_template_type', { length: 50 })
      .$type<'ecommerce' | 'wedding' | 'b2b' | 'saas' | 'service' | 'custom'>()
      .default('custom'),
    defaultProfession: varchar('default_profession', { length: 100 }).default('photographer'),

    // AI preferences
    enableAIGeneration: boolean('enable_ai_generation').default(true),
    preferredAIProvider: varchar('preferred_ai_provider', { length: 50 }).default('openai'), // 'openai', 'anthropic', 'google'
    aiGenerationQuality: varchar('ai_generation_quality', { length: 20 }).default('balanced'), // 'fast', 'balanced', 'quality'

    // Autosave preferences
    autosaveEnabled: boolean('autosave_enabled').default(true),
    autosaveInterval: integer('autosave_interval').default(30000), // milliseconds (30s)

    // Recent items (for quick access)
    recentTemplates: jsonb('recent_templates')
      .$type<
        Array<{
          id: string;
          name: string;
          lastAccessed: string;
        }>
      >()
      .default([]), // Last 10 templates

    recentComponents: jsonb('recent_components')
      .$type<
        Array<{
          id: string;
          name: string;
          type: string;
          lastUsed: string;
        }>
      >()
      .default([]), // Last 10 components

    favoriteComponents: jsonb('favorite_components').$type<string[]>().default([]), // Component IDs

    // Stage defaults
    customStages: jsonb('custom_stages')
      .$type<
        Array<{
          name: string;
          color: string;
          icon: string;
          description: string;
        }>
      >()
      .default([]),

    // Touchpoint defaults
    customTouchpointTypes: jsonb('custom_touchpoint_types')
      .$type<
        Array<{
          name: string;
          type: string;
          defaultDuration: number;
        }>
      >()
      .default([]),

    // Export preferences
    exportFormat: varchar('export_format', { length: 20 }).default('json'), // 'json', 'csv', 'pdf'
    includeAnalyticsOnExport: boolean('include_analytics_on_export').default(true),
    includeNotesOnExport: boolean('include_notes_on_export').default(true),

    // Display preferences
    showMetrics: boolean('show_metrics').default(true),
    showConversionRates: boolean('show_conversion_rates').default(true),
    showEstimatedTimes: boolean('show_estimated_times').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('customer_journey_user_preferences_user_id_idx').on(table.userId),
  }),
);

// Customer Journey Components - Library of interactive components
export const customerJourneyComponents = pgTable(
  'customer_journey_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    componentType: varchar('component_type', { length: 100 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    profession: varchar('profession', { length: 100 }),
    category: varchar('category', { length: 100 }).notNull(),
    previewImage: text('preview_image'),
    estimatedDuration: integer('estimated_duration'), // Minutes
    difficulty: varchar('difficulty', { length: 20 })
      .$type<'easy' | 'medium' | 'hard'>()
      .default('medium'),
    tags: jsonb('tags').$type<string[]>().default([]),
    isActive: boolean('is_active').default(true),
    usageCount: integer('usage_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    componentTypeIdx: index('customer_journey_components_component_type_idx').on(
      table.componentType,
    ),
    professionIdx: index('customer_journey_components_profession_idx').on(table.profession),
    categoryIdx: index('customer_journey_components_category_idx').on(table.category),
  }),
);

// ============================================================================
// MEETING NOTES SYSTEM
// ============================================================================

// Meeting Notes
export const meetingNotes = pgTable(
  'meeting_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id').notNull(),
    creatorId: varchar('creator_id').notNull(),

    // Note content
    title: varchar('title'),
    content: text('content'),
    noteType: varchar('note_type').notNull().default('text'),

    // Visual properties
    position: jsonb('position')
      .$type<{ x: number; y: number; z: number }>()
      .notNull()
      .default({ x: 0, y: 0, z: 0 }),
    size: jsonb('size')
      .$type<{ width: number; height: number }>()
      .default({ width: 200, height: 150 }),
    style: jsonb('style')
      .$type<{
        backgroundColor: string;
        textColor: string;
        fontSize: string;
        fontFamily: string;
        borderColor?: string;
        borderWidth?: number;
        rotation?: number;
        opacity?: number;
      }>()
      .default({
        backgroundColor: '#fff3cd',
        textColor: '#333333',
        fontSize: '14px',
        fontFamily: 'Inter',
      }),

    // Special properties
    metadata: jsonb('metadata')
      .$type<{
        imageUrl?: string;
        imageCaption?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: number;
        fileType?: string;
        linkUrl?: string;
        linkTitle?: string;
        linkDescription?: string;
        linkThumbnail?: string;
        isCompleted?: boolean;
        priority?: 'low' | 'medium' | 'high';
        dueDate?: string;
        assignedTo?: string;
        meetingDate?: string;
        meetingTime?: string;
        attendees?: string[];
        duration?: number;
      }>()
      .default({}),

    // Meeting-specific fields
    meetingId: varchar('meeting_id'),
    projectId: varchar('project_id'),
    weddingTimelineId: integer('wedding_timeline_id'),
    clientId: varchar('client_id'),
    profession: varchar('profession').default('photographer'),
    meetingTitle: varchar('meeting_title').default('Møtenotat'),
    meetingDate: date('meeting_date'),
    meetingDuration: integer('meeting_duration'),
    meetingType: varchar('meeting_type'),
    meetingLocation: varchar('meeting_location'),

    // Content sections
    personalNotes: text('personal_notes'),
    clientNotes: text('client_notes'),
    practicalInfo: text('practical_info'),

    // Structured data
    actionItems: jsonb('action_items')
      .$type<
        Array<{
          id: string;
          task: string;
          assigned_to?: string;
          due_date?: string;
          status: 'pending' | 'in_progress' | 'completed';
          priority: 'low' | 'medium' | 'high';
        }>
      >()
      .default([]),

    decisions: jsonb('decisions')
      .$type<
        Array<{
          id: string;
          decision: string;
          rationale?: string;
          decided_by?: string;
          timestamp?: string;
        }>
      >()
      .default([]),

    followUpTasks: jsonb('follow_up_tasks')
      .$type<
        Array<{
          id: string;
          task: string;
          assigned_to?: string;
          due_date?: string;
          priority: 'low' | 'medium' | 'high';
        }>
      >()
      .default([]),

    participants: jsonb('participants')
      .$type<
        Array<{
          id: string;
          name: string;
          role?: string;
          email?: string;
        }>
      >()
      .default([]),

    agenda: jsonb('agenda')
      .$type<
        Array<{
          id: string;
          topic: string;
          duration?: number;
          presenter?: string;
          notes?: string;
        }>
      >()
      .default([]),

    nextSteps: jsonb('next_steps')
      .$type<
        Array<{
          id: string;
          step: string;
          owner?: string;
          due_date?: string;
        }>
      >()
      .default([]),

    // AI features
    aiSummary: text('ai_summary'),
    aiTags: jsonb('ai_tags').$type<string[]>().default([]),
    aiSentiment: varchar('ai_sentiment').default('neutral'),
    aiKeyTopics: jsonb('ai_key_topics').$type<string[]>().default([]),
    timelineUpdates: jsonb('timeline_updates')
      .$type<
        Array<{
          section: string;
          update: string;
          timestamp: string;
          type: 'addition' | 'modification' | 'deletion';
        }>
      >()
      .default([]),

    // Client visibility
    isClientVisible: boolean('is_client_visible').default(false),

    // Legacy compatibility
    positionX: integer('position_x').default(0),
    positionY: integer('position_y').default(0),
    width: integer('width').default(200),
    height: integer('height').default(150),
    color: varchar('color').default('#ffeb3b'),
    createdBy: varchar('created_by').notNull(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('meeting_notes_user_id_idx').on(table.userId),
    meetingIdIdx: index('meeting_notes_meeting_id_idx').on(table.meetingId),
    projectIdIdx: index('meeting_notes_project_id_idx').on(table.projectId),
  }),
);

// Meeting Attachments
export const meetingAttachments = pgTable(
  'meeting_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    meetingNoteId: uuid('meeting_note_id')
      .notNull()
      .references(() => meetingNotes.id, { onDelete: 'cascade' }),
    userId: varchar('user_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileType: varchar('file_type', { length: 100 }),
    fileSize: bigint('file_size', { mode: 'number' }),
    fileUrl: text('file_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    googleDriveId: varchar('google_drive_id', { length: 255 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    meetingNoteIdIdx: index('meeting_attachments_meeting_note_id_idx').on(table.meetingNoteId),
    userIdIdx: index('meeting_attachments_user_id_idx').on(table.userId),
  }),
);

// Meeting Workspaces
export const meetingWorkspaces = pgTable('meeting_workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  workspaceType: varchar('workspace_type', { length: 100 }).default('meeting'),
  settings: jsonb('settings'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Meeting Participants
export const meetingParticipants = pgTable('meeting_participants', {
  id: serial('id').primaryKey(),
  meetingId: varchar('meeting_id').notNull(),
  userId: varchar('user_id'),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  role: varchar('role', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Meeting Activities
export const meetingActivities = pgTable('meeting_activities', {
  id: serial('id').primaryKey(),
  meetingId: varchar('meeting_id').notNull(),
  userId: varchar('user_id').notNull(),
  activityType: varchar('activity_type', { length: 100 }).notNull(),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// ZOD SCHEMAS - MOVED TO END TO AVOID DECLARATION ORDER ISSUES
// ============================================================================

export const insertImageSchema = createInsertSchema(images);
export const insertProjectBackupSchema = createInsertSchema(projectBackups);
export const insertSeoCampaignSchema = createInsertSchema(seoCampaigns);
export const insertSeoKeywordSchema = createInsertSchema(seoKeywords);
export const insertSeoPageSchema = createInsertSchema(seoPages);
export const insertSeoBacklinkSchema = createInsertSchema(seoBacklinks);
// Google Wallet Zod Schemas
export const insertGoogleWalletPassSchema = createInsertSchema(googleWalletPasses);
export const insertGoogleWalletTicketSchema = createInsertSchema(googleWalletTickets);
export const insertGoogleWalletLoyaltyCardSchema = createInsertSchema(googleWalletLoyaltyCards);
export const insertGoogleWalletMembershipCardSchema = createInsertSchema(
  googleWalletMembershipCards,
);

// Google Wallet Types
export type GoogleWalletPass = typeof googleWalletPasses.$inferSelect;
export type InsertGoogleWalletPass = z.infer<typeof insertGoogleWalletPassSchema>;

export type GoogleWalletTicket = typeof googleWalletTickets.$inferSelect;
export type InsertGoogleWalletTicket = z.infer<typeof insertGoogleWalletTicketSchema>;

export type GoogleWalletLoyaltyCard = typeof googleWalletLoyaltyCards.$inferSelect;
export type InsertGoogleWalletLoyaltyCard = z.infer<typeof insertGoogleWalletLoyaltyCardSchema>;

export type GoogleWalletMembershipCard = typeof googleWalletMembershipCards.$inferSelect;
export type InsertGoogleWalletMembershipCard = z.infer<
  typeof insertGoogleWalletMembershipCardSchema
>;

// Trial Notifications Zod Schemas
export const insertTrialNotificationSchema = createInsertSchema(trialNotifications);
export const insertTrialUsageTrackingSchema = createInsertSchema(trialUsageTracking);

// Trial Notifications Types
export type TrialNotification = typeof trialNotifications.$inferSelect;
export type InsertTrialNotification = z.infer<typeof insertTrialNotificationSchema>;

export type TrialUsageTracking = typeof trialUsageTracking.$inferSelect;
export type InsertTrialUsageTracking = z.infer<typeof insertTrialUsageTrackingSchema>;

export const insertGooglePaySubscriptionSchema = createInsertSchema(googlePaySubscriptions);
export const insertGooglePayTransactionSchema = createInsertSchema(googlePayTransactions);
export const insertGooglePayProductSchema = createInsertSchema(googlePayProducts);
export const insertGooglePayBillingIssueSchema = createInsertSchema(googlePayBillingIssues);

// Pricing System Zod Schemas
export const insertPricingCategorySchema = createInsertSchema(pricingCategories);
export const insertServiceItemSchema = createInsertSchema(serviceItems);
export const insertPricingRuleSchema = createInsertSchema(pricingRules);
export const insertCustomerPricingSchema = createInsertSchema(customerPricing);
export const insertPricingPackageSchema = createInsertSchema(pricingPackages);

// RBAC Zod Schemas
export const insertRbacRoleSchema = createInsertSchema(rbacRoles);
export const insertRbacUserRoleSchema = createInsertSchema(rbacUserRoles);
export const insertRbacAuditLogSchema = createInsertSchema(rbacAuditLog);
export const insertSystemFeatureSchema = createInsertSchema(systemFeatures);
export const insertRoleFeatureSchema = createInsertSchema(roleFeatures);
export const insertRoleHierarchySchema = createInsertSchema(roleHierarchy);
export const insertUserPermissionOverrideSchema = createInsertSchema(userPermissionOverrides);

// RBAC Types
export type RbacRole = typeof rbacRoles.$inferSelect;
export type InsertRbacRole = z.infer<typeof insertRbacRoleSchema>;

export type RbacUserRole = typeof rbacUserRoles.$inferSelect;
export type InsertRbacUserRole = z.infer<typeof insertRbacUserRoleSchema>;

export type RbacAuditLog = typeof rbacAuditLog.$inferSelect;
export type InsertRbacAuditLog = z.infer<typeof insertRbacAuditLogSchema>;

export type SystemFeature = typeof systemFeatures.$inferSelect;
export type InsertSystemFeature = z.infer<typeof insertSystemFeatureSchema>;

export type RoleFeature = typeof roleFeatures.$inferSelect;
export type InsertRoleFeature = z.infer<typeof insertRoleFeatureSchema>;

export type RoleHierarchy = typeof roleHierarchy.$inferSelect;
export type InsertRoleHierarchy = z.infer<typeof insertRoleHierarchySchema>;

export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type InsertUserPermissionOverride = z.infer<typeof insertUserPermissionOverrideSchema>;

// Products Zod Schemas
export const insertProductSchema = createInsertSchema(products);

// Products Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Digital Signatures Zod Schemas
export const insertSignRequestSchema = createInsertSchema(signRequests);
export const insertCustomerSignatureSchema = createInsertSchema(customerSignatures);

// Digital Signatures Types
export type SignRequest = typeof signRequests.$inferSelect;
export type InsertSignRequest = z.infer<typeof insertSignRequestSchema>;

export type CustomerSignature = typeof customerSignatures.$inferSelect;
export type InsertCustomerSignature = z.infer<typeof insertCustomerSignatureSchema>;

// System Logs Zod Schemas
export const insertSystemLogSchema = createInsertSchema(systemLogs);

// System Logs Types
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;

// Notes & Code Generation Zod Schemas
export const insertNoteSchema = createInsertSchema(notes);
export const insertCodeGenerationSchema = createInsertSchema(codeGenerations);
export const insertSmartTemplateSchema = createInsertSchema(smartTemplates);

// Notes & Code Generation Types
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type CodeGeneration = typeof codeGenerations.$inferSelect;
export type InsertCodeGeneration = z.infer<typeof insertCodeGenerationSchema>;

export type SmartTemplate = typeof smartTemplates.$inferSelect;
export type InsertSmartTemplate = z.infer<typeof insertSmartTemplateSchema>;

// Notes & Code Generation Zod Schemas (already added above)

// Smart Notes & AI Features Zod Schemas
export const insertSmartNoteSchema = createInsertSchema(smartNotes);
export const insertImprovementTaskSchema = createInsertSchema(improvementTasks);
export const insertTextEnhancementHistorySchema = createInsertSchema(textEnhancementHistory);
export const insertMagicCreatorFeatureSchema = createInsertSchema(magicCreatorFeatures);

// AI Document Analysis & Parsing Zod Schemas
export const insertDocumentUploadSchema = createInsertSchema(documentUploads);
export const insertAiTextAnalysisJobSchema = createInsertSchema(aiTextAnalysisJobs);
export const insertAiDatabaseAnalysisSchema = createInsertSchema(aiDatabaseAnalysis);
export const insertAiCodebaseAnalysisSchema = createInsertSchema(aiCodebaseAnalysis);
export const insertAiWebSearchResultSchema = createInsertSchema(aiWebSearchResults);
export const insertAiApiDiscoverySchema = createInsertSchema(aiApiDiscovery);
export const insertAiDocumentQASchema = createInsertSchema(aiDocumentQA);

// Smart Notes & AI Features Types
export type SmartNote = typeof smartNotes.$inferSelect;
export type InsertSmartNote = z.infer<typeof insertSmartNoteSchema>;

export type ImprovementTask = typeof improvementTasks.$inferSelect;
export type InsertImprovementTask = z.infer<typeof insertImprovementTaskSchema>;

export type TextEnhancementHistory = typeof textEnhancementHistory.$inferSelect;
export type InsertTextEnhancementHistory = z.infer<typeof insertTextEnhancementHistorySchema>;

export type MagicCreatorFeature = typeof magicCreatorFeatures.$inferSelect;
export type InsertMagicCreatorFeature = z.infer<typeof insertMagicCreatorFeatureSchema>;

// AI Document Analysis & Parsing Types
export type DocumentUpload = typeof documentUploads.$inferSelect;
export type InsertDocumentUpload = z.infer<typeof insertDocumentUploadSchema>;

export type AiTextAnalysisJob = typeof aiTextAnalysisJobs.$inferSelect;
export type InsertAiTextAnalysisJob = z.infer<typeof insertAiTextAnalysisJobSchema>;

export type AiDatabaseAnalysis = typeof aiDatabaseAnalysis.$inferSelect;
export type InsertAiDatabaseAnalysis = z.infer<typeof insertAiDatabaseAnalysisSchema>;

export type AiCodebaseAnalysis = typeof aiCodebaseAnalysis.$inferSelect;
export type InsertAiCodebaseAnalysis = z.infer<typeof insertAiCodebaseAnalysisSchema>;

export type AiWebSearchResult = typeof aiWebSearchResults.$inferSelect;
export type InsertAiWebSearchResult = z.infer<typeof insertAiWebSearchResultSchema>;

export type AiApiDiscovery = typeof aiApiDiscovery.$inferSelect;
export type InsertAiApiDiscovery = z.infer<typeof insertAiApiDiscoverySchema>;

export type AiDocumentQA = typeof aiDocumentQA.$inferSelect;
export type InsertAiDocumentQA = z.infer<typeof insertAiDocumentQASchema>;

// Gear Announcements Zod Schemas
export const insertGearAnnouncementSchema = createInsertSchema(gearAnnouncements);

// Gear Announcements Types
export type GearAnnouncement = typeof gearAnnouncements.$inferSelect;
export type InsertGearAnnouncement = z.infer<typeof insertGearAnnouncementSchema>;

// Brand Image Discoveries Zod Schemas
export const insertBrandImageDiscoverySchema = createInsertSchema(brandImageDiscoveries);

// Brand Image Discoveries Types
export type BrandImageDiscovery = typeof brandImageDiscoveries.$inferSelect;
export type InsertBrandImageDiscovery = z.infer<typeof insertBrandImageDiscoverySchema>;

// Email Project Associations Zod Schemas
export const insertEmailProjectAssociationSchema = createInsertSchema(emailProjectAssociations);

// Email Project Associations Types
export type EmailProjectAssociation = typeof emailProjectAssociations.$inferSelect;
export type InsertEmailProjectAssociation = z.infer<typeof insertEmailProjectAssociationSchema>;

// Profession Configurations Zod Schemas
export const insertProfessionConfigurationSchema = createInsertSchema(professionConfigurations);
export const insertProfessionTypeSchema = createInsertSchema(professionTypes);

// Profession Configurations Types
export type ProfessionConfiguration = typeof professionConfigurations.$inferSelect;
export type InsertProfessionConfiguration = z.infer<typeof insertProfessionConfigurationSchema>;

export type ProfessionType = typeof professionTypes.$inferSelect;
export type InsertProfessionType = z.infer<typeof insertProfessionTypeSchema>;

// Visual CMS Zod Schemas
export const insertCmsPageSchema = createInsertSchema(cmsPages);
export const insertPageVersionSchema = createInsertSchema(pageVersions);
export const insertWorkflowStateSchema = createInsertSchema(workflowStates);
export const insertCmsAssetSchema = createInsertSchema(cmsAssets);
export const insertCmsThemeSchema = createInsertSchema(cmsThemes);
export const insertComponentDefinitionSchema = createInsertSchema(componentDefinitions);
export const insertDesignTokenSchema = createInsertSchema(designTokens);
export const insertPageTemplateSchema = createInsertSchema(pageTemplates);

// Visual CMS Types
export type CmsPage = typeof cmsPages.$inferSelect;
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;

export type PageVersion = typeof pageVersions.$inferSelect;
export type InsertPageVersion = z.infer<typeof insertPageVersionSchema>;

export type WorkflowState = typeof workflowStates.$inferSelect;
export type InsertWorkflowState = z.infer<typeof insertWorkflowStateSchema>;

export type CmsAsset = typeof cmsAssets.$inferSelect;
export type InsertCmsAsset = z.infer<typeof insertCmsAssetSchema>;

export type CmsTheme = typeof cmsThemes.$inferSelect;
export type InsertCmsTheme = z.infer<typeof insertCmsThemeSchema>;

export type ComponentDefinition = typeof componentDefinitions.$inferSelect;
export type InsertComponentDefinition = z.infer<typeof insertComponentDefinitionSchema>;

export type DesignToken = typeof designTokens.$inferSelect;
export type InsertDesignToken = z.infer<typeof insertDesignTokenSchema>;

export type PageTemplate = typeof pageTemplates.$inferSelect;
export type InsertPageTemplate = z.infer<typeof insertPageTemplateSchema>;

// ComponentInstance type (used in CMS)
export type ComponentInstance = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ComponentInstance[];
};

// Lead Import Zod Schemas
export const insertLeadImportTemplateSchema = createInsertSchema(leadImportTemplates);

// Lead Import Types
export type LeadImportTemplate = typeof leadImportTemplates.$inferSelect;
export type InsertLeadImportTemplate = z.infer<typeof insertLeadImportTemplateSchema>;

// Project Draft Autosave Zod Schemas
export const insertProjectDraftAutosaveSchema = createInsertSchema(projectDraftAutosave);
export const insertProjectDraftVersionSchema = createInsertSchema(projectDraftVersions);

// Project Draft Autosave Types
export type ProjectDraftAutosave = typeof projectDraftAutosave.$inferSelect;
export type InsertProjectDraftAutosave = z.infer<typeof insertProjectDraftAutosaveSchema>;

export type ProjectDraftVersion = typeof projectDraftVersions.$inferSelect;
export type InsertProjectDraftVersion = z.infer<typeof insertProjectDraftVersionSchema>;

// Project Presets & Suggestions Zod Schemas
export const insertProjectPresetSchema = createInsertSchema(projectPresets);
export const insertPresetSuggestionSchema = createInsertSchema(presetSuggestions);
export const insertProjectSimilarityAnalysisSchema = createInsertSchema(projectSimilarityAnalysis);
export const insertPresetUsageHistorySchema = createInsertSchema(presetUsageHistory);

// Project Presets & Suggestions Types
export type ProjectPreset = typeof projectPresets.$inferSelect;
export type InsertProjectPreset = z.infer<typeof insertProjectPresetSchema>;

export type PresetSuggestion = typeof presetSuggestions.$inferSelect;
export type InsertPresetSuggestion = z.infer<typeof insertPresetSuggestionSchema>;

export type ProjectSimilarityAnalysis = typeof projectSimilarityAnalysis.$inferSelect;
export type InsertProjectSimilarityAnalysis = z.infer<typeof insertProjectSimilarityAnalysisSchema>;

export type PresetUsageHistory = typeof presetUsageHistory.$inferSelect;
export type InsertPresetUsageHistory = z.infer<typeof insertPresetUsageHistorySchema>;

// Photographer-Client Gallery Zod Schemas
export const insertPhotographerClientGallerySchema = createInsertSchema(
  photographerClientGalleries,
);
export const insertClientGalleryImageSchema = createInsertSchema(clientGalleryImages);
export const insertClientImageSelectionSchema = createInsertSchema(clientImageSelections);
export const insertClientImageCommentSchema = createInsertSchema(clientImageComments);
export const insertClientImagePaymentSchema = createInsertSchema(clientImagePayments);

// Photographer-Client Gallery Types
export type PhotographerClientGallery = typeof photographerClientGalleries.$inferSelect;
export type InsertPhotographerClientGallery = z.infer<typeof insertPhotographerClientGallerySchema>;

export type ClientGalleryImage = typeof clientGalleryImages.$inferSelect;
export type InsertClientGalleryImage = z.infer<typeof insertClientGalleryImageSchema>;

export type ClientImageSelection = typeof clientImageSelections.$inferSelect;
export type InsertClientImageSelection = z.infer<typeof insertClientImageSelectionSchema>;

export type ClientImageComment = typeof clientImageComments.$inferSelect;
export type InsertClientImageComment = z.infer<typeof insertClientImageCommentSchema>;

export type ClientImagePayment = typeof clientImagePayments.$inferSelect;
export type InsertClientImagePayment = z.infer<typeof insertClientImagePaymentSchema>;

// Project Timelines & Submissions Zod Schemas
export const insertProjectTimelineSchema = createInsertSchema(projectTimelines);
export const insertSubmissionSchema = createInsertSchema(submissions);

// Project Timelines & Submissions Types
export type ProjectTimeline = typeof projectTimelines.$inferSelect;
export type InsertProjectTimeline = z.infer<typeof insertProjectTimelineSchema>;

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

// Email Templates Zod Schemas
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);

// Email Templates Types
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// Google Drive Files Zod Schemas and Types exported from virtual-studio-schema.ts

// Meeting Notes Zod Schemas
export const insertMeetingNoteSchema = createInsertSchema(meetingNotes);
export const insertMeetingAttachmentSchema = createInsertSchema(meetingAttachments);

// Meeting Notes Types
export type MeetingNote = typeof meetingNotes.$inferSelect;
export type InsertMeetingNote = z.infer<typeof insertMeetingNoteSchema>;

export type MeetingAttachment = typeof meetingAttachments.$inferSelect;
export type InsertMeetingAttachment = z.infer<typeof insertMeetingAttachmentSchema>;

// Meeting Workspaces, Participants, Activities Zod Schemas
export const insertMeetingWorkspaceSchema = createInsertSchema(meetingWorkspaces);
export const insertMeetingParticipantSchema = createInsertSchema(meetingParticipants);
export const insertMeetingActivitySchema = createInsertSchema(meetingActivities);

// Meeting Workspaces, Participants, Activities Types
export type MeetingWorkspace = typeof meetingWorkspaces.$inferSelect;
export type InsertMeetingWorkspace = z.infer<typeof insertMeetingWorkspaceSchema>;

export type MeetingParticipant = typeof meetingParticipants.$inferSelect;
export type InsertMeetingParticipant = z.infer<typeof insertMeetingParticipantSchema>;

export type MeetingActivity = typeof meetingActivities.$inferSelect;
export type InsertMeetingActivity = z.infer<typeof insertMeetingActivitySchema>;

// ============================================================================
// CUSTOMER JOURNEY BUILDER RELATIONS
// ============================================================================

export const customerJourneyTemplatesRelations = relations(
  customerJourneyTemplates,
  ({ one, many }) => ({
    user: one(users, {
      fields: [customerJourneyTemplates.userId],
      references: [users.id],
    }),
    notes: one(customerJourneyNotes, {
      fields: [customerJourneyTemplates.id],
      references: [customerJourneyNotes.templateId],
    }),
    analytics: many(customerJourneyAnalytics),
    aiCache: many(customerJourneyAiCache),
  }),
);

export const customerJourneyNotesRelations = relations(customerJourneyNotes, ({ one }) => ({
  template: one(customerJourneyTemplates, {
    fields: [customerJourneyNotes.templateId],
    references: [customerJourneyTemplates.id],
  }),
  createdByUser: one(users, {
    fields: [customerJourneyNotes.createdBy],
    references: [users.id],
  }),
}));

export const customerJourneyAnalyticsRelations = relations(customerJourneyAnalytics, ({ one }) => ({
  template: one(customerJourneyTemplates, {
    fields: [customerJourneyAnalytics.templateId],
    references: [customerJourneyTemplates.id],
  }),
}));

export const customerJourneyAiCacheRelations = relations(customerJourneyAiCache, ({ one }) => ({
  template: one(customerJourneyTemplates, {
    fields: [customerJourneyAiCache.templateId],
    references: [customerJourneyTemplates.id],
  }),
}));

// ============================================================================
// CUSTOMER JOURNEY BUILDER ZOD SCHEMAS
// ============================================================================

export const insertCustomerJourneyUserPreferencesSchema = createInsertSchema(
  customerJourneyUserPreferences,
);
export const insertCustomerJourneyTemplateSchema = createInsertSchema(customerJourneyTemplates);
export const insertCustomerJourneyNoteSchema = createInsertSchema(customerJourneyNotes);
export const insertCustomerJourneyAnalyticSchema = createInsertSchema(customerJourneyAnalytics);
export const insertCustomerJourneyAiCacheSchema = createInsertSchema(customerJourneyAiCache);
export const insertCustomerJourneyComponentSchema = createInsertSchema(customerJourneyComponents);

// ============================================================================
// CUSTOMER JOURNEY BUILDER TYPESCRIPT TYPES
// ============================================================================

export type CustomerJourneyUserPreferences = typeof customerJourneyUserPreferences.$inferSelect;
export type InsertCustomerJourneyUserPreferences = z.infer<
  typeof insertCustomerJourneyUserPreferencesSchema
>;

export type CustomerJourneyTemplate = typeof customerJourneyTemplates.$inferSelect;
export type InsertCustomerJourneyTemplate = z.infer<typeof insertCustomerJourneyTemplateSchema>;

export type CustomerJourneyNote = typeof customerJourneyNotes.$inferSelect;
export type InsertCustomerJourneyNote = z.infer<typeof insertCustomerJourneyNoteSchema>;

export type CustomerJourneyAnalytic = typeof customerJourneyAnalytics.$inferSelect;
export type InsertCustomerJourneyAnalytic = z.infer<typeof insertCustomerJourneyAnalyticSchema>;

export type CustomerJourneyAiCache = typeof customerJourneyAiCache.$inferSelect;
export type InsertCustomerJourneyAiCache = z.infer<typeof insertCustomerJourneyAiCacheSchema>;

export type CustomerJourneyComponent = typeof customerJourneyComponents.$inferSelect;
export type InsertCustomerJourneyComponent = z.infer<typeof insertCustomerJourneyComponentSchema>;

// ============================================================================
// MINI-SORA CONTINUOUS LEARNING TYPESCRIPT TYPES
// ============================================================================

export type MiniSoraTrainingQueueItem = typeof miniSoraTrainingQueue.$inferSelect;
export type InsertMiniSoraTrainingQueueItem = z.infer<typeof insertMiniSoraTrainingQueueSchema>;

export type MiniSoraFeedback = typeof miniSoraTrainingFeedback.$inferSelect;
export type InsertMiniSoraFeedback = z.infer<typeof insertMiniSoraTrainingFeedbackSchema>;

export type MiniSoraTrainingRunRecord = typeof miniSoraTrainingRuns.$inferSelect;
export type InsertMiniSoraTrainingRunRecord = z.infer<typeof insertMiniSoraTrainingRunSchema>;

// ============================================================================
// ZOD SCHEMAS FOR VIDEO EDITOR TABLES
// ============================================================================

export const insertTimelineProjectSchema = createInsertSchema(timelineProjects);
export const insertLutSchema = createInsertSchema(luts);
export const insertVideoExportJobSchema = createInsertSchema(videoExportJobs);
export const insertAiStoryAnalysisSchema = createInsertSchema(aiStoryAnalysis);
export const insertVideoCaptionSchema = createInsertSchema(videoCaptions);
export const insertVideoTextOverlaySchema = createInsertSchema(videoTextOverlays);
export const insertVideoClipEffectSchema = createInsertSchema(videoClipEffects);
export const insertVideoTransitionSchema = createInsertSchema(videoTransitions);
export const insertVideoExportPresetSchema = createInsertSchema(videoExportPresets);

// ============================================================================
// TYPESCRIPT TYPES FOR VIDEO EDITOR TABLES
// ============================================================================

export type TimelineProject = typeof timelineProjects.$inferSelect;
export type InsertTimelineProject = z.infer<typeof insertTimelineProjectSchema>;

export type Lut = typeof luts.$inferSelect;
export type InsertLut = z.infer<typeof insertLutSchema>;

export type VideoExportJob = typeof videoExportJobs.$inferSelect;
export type InsertVideoExportJob = z.infer<typeof insertVideoExportJobSchema>;

export type AiStoryAnalysis = typeof aiStoryAnalysis.$inferSelect;
export type InsertAiStoryAnalysis = z.infer<typeof insertAiStoryAnalysisSchema>;

export type VideoCaption = typeof videoCaptions.$inferSelect;
export type InsertVideoCaption = z.infer<typeof insertVideoCaptionSchema>;

export type VideoTextOverlay = typeof videoTextOverlays.$inferSelect;
export type InsertVideoTextOverlay = z.infer<typeof insertVideoTextOverlaySchema>;

export type VideoClipEffect = typeof videoClipEffects.$inferSelect;
export type InsertVideoClipEffect = z.infer<typeof insertVideoClipEffectSchema>;

export type VideoTransition = typeof videoTransitions.$inferSelect;
export type InsertVideoTransition = z.infer<typeof insertVideoTransitionSchema>;

export type VideoExportPreset = typeof videoExportPresets.$inferSelect;
export type InsertVideoExportPreset = z.infer<typeof insertVideoExportPresetSchema>;

// ============================================================================
// ZOD SCHEMAS FOR EMAIL TRACKING & INVITATION TOKENS
// ============================================================================

export const insertEmailTrackingCampaignSchema = createInsertSchema(emailTrackingCampaigns);
export const insertEmailTrackingOpenSchema = createInsertSchema(emailTrackingOpens);
export const insertEmailTrackingClickSchema = createInsertSchema(emailTrackingClicks);
export const insertEmailTrackingConversionSchema = createInsertSchema(emailTrackingConversions);
export const insertInvitationTokenSchema = createInsertSchema(invitationTokens);
export const insertPrototypeTesterRequestSchema = createInsertSchema(prototypeTesterRequests);

// ============================================================================
// TYPESCRIPT TYPES FOR EMAIL TRACKING & INVITATION TOKENS
// ============================================================================

export type EmailTrackingCampaign = typeof emailTrackingCampaigns.$inferSelect;
export type InsertEmailTrackingCampaign = z.infer<typeof insertEmailTrackingCampaignSchema>;

export type EmailTrackingOpen = typeof emailTrackingOpens.$inferSelect;
export type InsertEmailTrackingOpen = z.infer<typeof insertEmailTrackingOpenSchema>;

export type EmailTrackingClick = typeof emailTrackingClicks.$inferSelect;
export type InsertEmailTrackingClick = z.infer<typeof insertEmailTrackingClickSchema>;

export type EmailTrackingConversion = typeof emailTrackingConversions.$inferSelect;
export type InsertEmailTrackingConversion = z.infer<typeof insertEmailTrackingConversionSchema>;

export type InvitationToken = typeof invitationTokens.$inferSelect;
export type InsertInvitationToken = z.infer<typeof insertInvitationTokenSchema>;

export type PrototypeTesterRequest = typeof prototypeTesterRequests.$inferSelect;
export type InsertPrototypeTesterRequest = z.infer<typeof insertPrototypeTesterRequestSchema>;

// ============================================================================
// GA4 FOMO MARKETING SYSTEM
// ============================================================================

/**
 * ga4_fomo_campaigns
 * Store FOMO marketing campaigns with psychological triggers
 */
export const ga4FomoCampaigns = pgTable(
  'ga4_fomo_campaigns',
  {
    id: serial('id').primaryKey(),
    campaignId: varchar('campaign_id', { length: 255 }).notNull().unique(),

    // Campaign details
    name: varchar('name', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),
    campaignType: varchar('campaign_type', { length: 50 }).notNull(), // 'personal_fomo', 'lts', 'lqs', 'exclusivity', 'social_proof'

    // Targeting
    targetLocations: jsonb('target_locations').$type<string[]>().default([]),
    targetIndustries: jsonb('target_industries').$type<string[]>().default([]),
    minLeadScore: integer('min_lead_score').default(0),

    // Psychological triggers
    psychologicalTriggers: jsonb('psychological_triggers')
      .$type<{
        personalFOMO: boolean;
        socialFOMO: boolean;
        scarcity: boolean;
        exclusivity: boolean;
        urgency: boolean;
      }>()
      .notNull(),

    // Offer configuration
    offerConfig: jsonb('offer_config').$type<{
      productName: string;
      originalPrice: number;
      discountPrice: number;
      discountPercent: number;
      expiresIn: number; // hours
      remainingSlots?: number;
      currency: string;
    }>(),

    // Timing
    timeLimit: integer('time_limit'), // hours for LTS
    quantityLimit: integer('quantity_limit'), // slots for LQS
    optimalSendTime: timestamp('optimal_send_time'),

    // Status
    status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'scheduled', 'active', 'completed', 'paused'

    // Performance metrics
    totalSent: integer('total_sent').default(0),
    totalOpened: integer('total_opened').default(0),
    totalClicked: integer('total_clicked').default(0),
    totalConverted: integer('total_converted').default(0),
    openRate: decimal('open_rate', { precision: 5, scale: 2 }).default('0'),
    clickRate: decimal('click_rate', { precision: 5, scale: 2 }).default('0'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).default('0'),
    totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default('0'),
    currency: varchar('currency', { length: 3 }).default('NOK'),

    // A/B Testing
    isABTest: boolean('is_ab_test').default(false),
    abTestVariants: jsonb('ab_test_variants'),

    // GA4 Integration
    ga4EventName: varchar('ga4_event_name', { length: 100 }),
    ga4CampaignTracked: boolean('ga4_campaign_tracked').default(false),

    // User tracking
    createdBy: varchar('created_by')
      .notNull()
      .references(() => users.id),

    // Timestamps
    scheduledAt: timestamp('scheduled_at'),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('ga4_fomo_campaigns_campaign_id_idx').on(table.campaignId),
    professionIdx: index('ga4_fomo_campaigns_profession_idx').on(table.profession),
    campaignTypeIdx: index('ga4_fomo_campaigns_campaign_type_idx').on(table.campaignType),
    statusIdx: index('ga4_fomo_campaigns_status_idx').on(table.status),
    createdByIdx: index('ga4_fomo_campaigns_created_by_idx').on(table.createdBy),
  }),
);

/**
 * ga4_fomo_messages
 * Individual FOMO messages sent to leads
 */
export const ga4FomoMessages = pgTable(
  'ga4_fomo_messages',
  {
    id: serial('id').primaryKey(),
    messageId: varchar('message_id', { length: 255 }).notNull().unique(),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => ga4FomoCampaigns.id, { onDelete: 'cascade' }),

    // Recipient details
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    recipientName: varchar('recipient_name', { length: 255 }),
    recipientCompany: varchar('recipient_company', { length: 255 }),
    leadId: varchar('lead_id', { length: 255 }),
    leadScore: integer('lead_score').default(0),

    // Message content
    messageType: varchar('message_type', { length: 50 }).notNull(), // 'personal_fomo', 'lts', 'lqs', 'exclusivity', 'social_proof'
    subject: varchar('subject', { length: 500 }).notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text').notNull(),

    // Personalization
    personalizationData: jsonb('personalization_data')
      .$type<{
        recipientName: string;
        companyName?: string;
        profession: string;
        location: string;
        previousBehavior?: string;
        competitorUser?: boolean;
      }>()
      .notNull(),

    // Psychological triggers
    psychologicalTriggers: jsonb('psychological_triggers')
      .$type<{
        personalFOMO: boolean;
        socialFOMO: boolean;
        scarcity: boolean;
        exclusivity: boolean;
        urgency: boolean;
      }>()
      .notNull(),

    // Scarcity elements
    scarcityData: jsonb('scarcity_data').$type<{
      timeLimit?: string;
      expirationTime?: string;
      remainingQuantity?: number;
      totalQuantity?: number;
      percentageTaken?: number;
    }>(),

    // Status tracking
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'sent', 'delivered', 'opened', 'clicked', 'converted', 'bounced', 'failed'

    // Engagement tracking
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    openedAt: timestamp('opened_at'),
    firstClickedAt: timestamp('first_clicked_at'),
    convertedAt: timestamp('converted_at'),
    openCount: integer('open_count').default(0),
    clickCount: integer('click_count').default(0),

    // Conversion tracking
    conversionType: varchar('conversion_type', { length: 100 }), // 'registration', 'purchase', 'demo_booking', 'trial_start'
    conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }),
    conversionCurrency: varchar('conversion_currency', { length: 3 }).default('NOK'),

    // Device & location tracking
    openedDevice: varchar('opened_device', { length: 100 }),
    openedBrowser: varchar('opened_browser', { length: 100 }),
    openedLocation: varchar('opened_location', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),

    // Follow-up tracking
    followUpSequence: jsonb('follow_up_sequence')
      .$type<
        Array<{
          sequenceNumber: number;
          sendDate: string;
          subject: string;
          status: string;
        }>
      >()
      .default([]),
    nextFollowUpAt: timestamp('next_follow_up_at'),

    // GA4 Integration
    ga4ClientId: varchar('ga4_client_id', { length: 255 }),
    ga4SessionId: varchar('ga4_session_id', { length: 255 }),
    ga4EventTracked: boolean('ga4_event_tracked').default(false),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    messageIdIdx: index('ga4_fomo_messages_message_id_idx').on(table.messageId),
    campaignIdIdx: index('ga4_fomo_messages_campaign_id_idx').on(table.campaignId),
    recipientEmailIdx: index('ga4_fomo_messages_recipient_email_idx').on(table.recipientEmail),
    statusIdx: index('ga4_fomo_messages_status_idx').on(table.status),
    sentAtIdx: index('ga4_fomo_messages_sent_at_idx').on(table.sentAt),
    leadIdIdx: index('ga4_fomo_messages_lead_id_idx').on(table.leadId),
  }),
);

/**
 * ga4_fomo_ab_tests
 * A/B test results for FOMO campaigns
 */
export const ga4FomoAbTests = pgTable(
  'ga4_fomo_ab_tests',
  {
    id: serial('id').primaryKey(),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => ga4FomoCampaigns.id, { onDelete: 'cascade' }),

    // Test configuration
    variantAType: varchar('variant_a_type', { length: 50 }).notNull(),
    variantBType: varchar('variant_b_type', { length: 50 }).notNull(),
    variantAConfig: jsonb('variant_a_config').notNull(),
    variantBConfig: jsonb('variant_b_config').notNull(),

    // Performance metrics
    variantASent: integer('variant_a_sent').default(0),
    variantAOpened: integer('variant_a_opened').default(0),
    variantAClicked: integer('variant_a_clicked').default(0),
    variantAConverted: integer('variant_a_converted').default(0),
    variantARevenue: decimal('variant_a_revenue', { precision: 10, scale: 2 }).default('0'),

    variantBSent: integer('variant_b_sent').default(0),
    variantBOpened: integer('variant_b_opened').default(0),
    variantBClicked: integer('variant_b_clicked').default(0),
    variantBConverted: integer('variant_b_converted').default(0),
    variantBRevenue: decimal('variant_b_revenue', { precision: 10, scale: 2 }).default('0'),

    // Statistical significance
    confidenceLevel: decimal('confidence_level', { precision: 5, scale: 2 }),
    pValue: decimal('p_value', { precision: 5, scale: 4 }),
    winner: varchar('winner', { length: 10 }), // 'A', 'B', or 'inconclusive'
    winnerDeclaredAt: timestamp('winner_declared_at'),

    // Test status
    status: varchar('status', { length: 50 }).default('running'), // 'running', 'completed', 'stopped'

    // Timestamps
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('ga4_fomo_ab_tests_campaign_id_idx').on(table.campaignId),
    statusIdx: index('ga4_fomo_ab_tests_status_idx').on(table.status),
  }),
);

/**
 * ga4_fomo_optimal_timing
 * Track optimal send times by profession and user behavior
 */
export const ga4FomoOptimalTiming = pgTable(
  'ga4_fomo_optimal_timing',
  {
    id: serial('id').primaryKey(),
    profession: varchar('profession', { length: 100 }).notNull(),

    // Timing data
    dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday-Saturday)
    hourOfDay: integer('hour_of_day').notNull(), // 0-23

    // Performance metrics
    totalSent: integer('total_sent').default(0),
    totalOpened: integer('total_opened').default(0),
    totalClicked: integer('total_clicked').default(0),
    totalConverted: integer('total_converted').default(0),

    // Rates
    openRate: decimal('open_rate', { precision: 5, scale: 2 }).default('0'),
    clickRate: decimal('click_rate', { precision: 5, scale: 2 }).default('0'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).default('0'),

    // ML optimization
    confidenceScore: decimal('confidence_score', { precision: 5, scale: 2 }).default('0'),
    isRecommended: boolean('is_recommended').default(false),

    // Timestamps
    lastUpdated: timestamp('last_updated').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    professionDayHourIdx: index('ga4_fomo_optimal_timing_profession_day_hour_idx').on(
      table.profession,
      table.dayOfWeek,
      table.hourOfDay,
    ),
    professionIdx: index('ga4_fomo_optimal_timing_profession_idx').on(table.profession),
  }),
);

// ============================================================================
// GA4 FOMO MARKETING RELATIONS
// ============================================================================

export const ga4FomoCampaignsRelations = relations(ga4FomoCampaigns, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [ga4FomoCampaigns.createdBy],
    references: [users.id],
  }),
  messages: many(ga4FomoMessages),
  abTests: many(ga4FomoAbTests),
}));

export const ga4FomoMessagesRelations = relations(ga4FomoMessages, ({ one }) => ({
  campaign: one(ga4FomoCampaigns, {
    fields: [ga4FomoMessages.campaignId],
    references: [ga4FomoCampaigns.id],
  }),
}));

export const ga4FomoAbTestsRelations = relations(ga4FomoAbTests, ({ one }) => ({
  campaign: one(ga4FomoCampaigns, {
    fields: [ga4FomoAbTests.campaignId],
    references: [ga4FomoCampaigns.id],
  }),
}));

// ============================================================================
// GA4 FOMO MARKETING ZOD SCHEMAS
// ============================================================================

export const insertGa4FomoCampaignSchema = createInsertSchema(ga4FomoCampaigns);
export const insertGa4FomoMessageSchema = createInsertSchema(ga4FomoMessages);
export const insertGa4FomoAbTestSchema = createInsertSchema(ga4FomoAbTests);
export const insertGa4FomoOptimalTimingSchema = createInsertSchema(ga4FomoOptimalTiming);

// ============================================================================
// GA4 FOMO MARKETING TYPESCRIPT TYPES
// ============================================================================

export type Ga4FomoCampaign = typeof ga4FomoCampaigns.$inferSelect;
export type InsertGa4FomoCampaign = z.infer<typeof insertGa4FomoCampaignSchema>;

export type Ga4FomoMessage = typeof ga4FomoMessages.$inferSelect;
export type InsertGa4FomoMessage = z.infer<typeof insertGa4FomoMessageSchema>;

export type Ga4FomoAbTest = typeof ga4FomoAbTests.$inferSelect;
export type InsertGa4FomoAbTest = z.infer<typeof insertGa4FomoAbTestSchema>;

export type Ga4FomoOptimalTiming = typeof ga4FomoOptimalTiming.$inferSelect;
export type InsertGa4FomoOptimalTiming = z.infer<typeof insertGa4FomoOptimalTimingSchema>;

// ============================================================================
// GA4 AUTOMATED ACQUISITION SYSTEM
// ============================================================================

/**
 * ga4_acquisition_campaigns
 * Automated customer acquisition campaigns targeting specific professions
 */
export const ga4AcquisitionCampaigns = pgTable(
  'ga4_acquisition_campaigns',
  {
    id: serial('id').primaryKey(),
    campaignId: varchar('campaign_id', { length: 255 }).notNull().unique(),

    // Campaign details
    name: varchar('name', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),

    // Targeting criteria
    targetingCriteria: jsonb('targeting_criteria')
      .$type<{
        profession: string;
        industries: string[];
        companyKeywords: string[];
        locations: string[];
        minCompanySize?: number;
        minRevenue?: number;
        creditRating?: string[];
      }>()
      .notNull(),

    // Campaign configuration
    campaignType: varchar('campaign_type', { length: 50 }).default('quick'), // 'quick', 'custom', 'enterprise'
    automationSettings: jsonb('automation_settings')
      .$type<{
        autoEnrich: boolean;
        autoScore: boolean;
        autoOutreach: boolean;
        followUpSequence: boolean;
      }>()
      .notNull(),

    // Status
    status: varchar('status', { length: 50 }).default('draft'), // 'draft', 'generating_leads', 'ready', 'active', 'paused', 'completed'

    // Performance metrics
    totalLeads: integer('total_leads').default(0),
    hotLeads: integer('hot_leads').default(0),
    warmLeads: integer('warm_leads').default(0),
    coldLeads: integer('cold_leads').default(0),
    contacted: integer('contacted').default(0),
    responded: integer('responded').default(0),
    converted: integer('converted').default(0),
    responseRate: decimal('response_rate', { precision: 5, scale: 2 }).default('0'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).default('0'),
    totalRevenue: decimal('total_revenue', { precision: 10, scale: 2 }).default('0'),
    currency: varchar('currency', { length: 3 }).default('NOK'),

    // Messaging
    emailTemplates: jsonb('email_templates'),
    linkedinTemplates: jsonb('linkedin_templates'),
    adTemplates: jsonb('ad_templates'),

    // GA4 Integration
    ga4AudienceId: varchar('ga4_audience_id', { length: 255 }),
    ga4CampaignTracked: boolean('ga4_campaign_tracked').default(false),

    // User tracking
    createdBy: varchar('created_by')
      .notNull()
      .references(() => users.id),

    // Timestamps
    launchedAt: timestamp('launched_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    campaignIdIdx: index('ga4_acquisition_campaigns_campaign_id_idx').on(table.campaignId),
    professionIdx: index('ga4_acquisition_campaigns_profession_idx').on(table.profession),
    statusIdx: index('ga4_acquisition_campaigns_status_idx').on(table.status),
    createdByIdx: index('ga4_acquisition_campaigns_created_by_idx').on(table.createdBy),
  }),
);

/**
 * ga4_acquisition_leads
 * Leads generated from Norwegian databases (Proff.no, BRREG)
 */
export const ga4AcquisitionLeads = pgTable(
  'ga4_acquisition_leads',
  {
    id: serial('id').primaryKey(),
    leadId: varchar('lead_id', { length: 255 }).notNull().unique(),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => ga4AcquisitionCampaigns.id, { onDelete: 'cascade' }),

    // Lead scoring
    score: integer('score').notNull().default(0), // 0-100
    priority: varchar('priority', { length: 20 }).notNull().default('cold'), // 'hot', 'warm', 'cold'

    // Contact information
    contactData: jsonb('contact_data')
      .$type<{
        companyName: string;
        organizationNumber: string;
        email?: string;
        phone?: string;
        website?: string;
        address?: string;
        postalCode?: string;
        city?: string;
      }>()
      .notNull(),

    // Firmographics (from BRREG/Proff.no)
    firmographics: jsonb('firmographics')
      .$type<{
        employees: number;
        revenue: number;
        industry: string;
        industryCode?: string;
        location: string;
        creditRating: string;
        foundedYear?: number;
        companyType?: string;
      }>()
      .notNull(),

    // Intelligence data
    intelligence: jsonb('intelligence')
      .$type<{
        growthTrend: 'growing' | 'stable' | 'declining';
        marketPosition: string;
        riskLevel: 'low' | 'medium' | 'high';
        businessVolume: 'small' | 'medium' | 'large' | 'enterprise';
        competitors?: string[];
        marketShare?: number;
      }>()
      .notNull(),

    // Recommended approach
    recommendedApproach: jsonb('recommended_approach').$type<{
      channel: 'email' | 'linkedin' | 'phone' | 'direct_mail';
      message: string;
      offer: string;
      timing: string;
      personalizationTips: string[];
    }>(),

    // Status tracking
    status: varchar('status', { length: 50 }).default('new'), // 'new', 'contacted', 'responded', 'qualified', 'converted', 'lost'
    contactedAt: timestamp('contacted_at'),
    respondedAt: timestamp('responded_at'),
    qualifiedAt: timestamp('qualified_at'),
    convertedAt: timestamp('converted_at'),
    lostAt: timestamp('lost_at'),
    lostReason: text('lost_reason'),

    // Conversion data
    conversionValue: decimal('conversion_value', { precision: 10, scale: 2 }),
    conversionType: varchar('conversion_type', { length: 100 }),

    // Data sources
    dataSource: varchar('data_source', { length: 100 }).default('proff_brreg'), // 'proff_brreg', 'manual', 'imported'
    enrichedAt: timestamp('enriched_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    leadIdIdx: index('ga4_acquisition_leads_lead_id_idx').on(table.leadId),
    campaignIdIdx: index('ga4_acquisition_leads_campaign_id_idx').on(table.campaignId),
    priorityIdx: index('ga4_acquisition_leads_priority_idx').on(table.priority),
    statusIdx: index('ga4_acquisition_leads_status_idx').on(table.status),
    scoreIdx: index('ga4_acquisition_leads_score_idx').on(table.score),
  }),
);

/**
 * ga4_acquisition_outreach
 * Track all outreach attempts (email, LinkedIn, phone, etc.)
 */
 
export const ga4AcquisitionOutreach: any = pgTable(
  'ga4_acquisition_outreach',
  {
    id: serial('id').primaryKey(),
    outreachId: varchar('outreach_id', { length: 255 }).notNull().unique(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => ga4AcquisitionLeads.id, { onDelete: 'cascade' }),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => ga4AcquisitionCampaigns.id, { onDelete: 'cascade' }),
    sequenceId: integer('sequence_id').references(() => ga4AcquisitionSequences.id),

    // Outreach details
    channel: varchar('channel', { length: 50 }).notNull(), // 'email', 'linkedin', 'phone', 'direct_mail', 'ads'
    subject: varchar('subject', { length: 500 }),
    messageBody: text('message_body').notNull(),
    messageHtml: text('message_html'),

    // Sequence information
    sequenceStep: integer('sequence_step').default(1), // 1 = initial, 2+ = follow-ups
    isFollowUp: boolean('is_follow_up').default(false),
    previousOutreachId: integer('previous_outreach_id').references(
      () => (ga4AcquisitionOutreach as any).id,
    ), // Self-reference

    // Status tracking
    status: varchar('status', { length: 50 }).default('pending'), // 'pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed'

    // Engagement tracking
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    openedAt: timestamp('opened_at'),
    clickedAt: timestamp('clicked_at'),
    repliedAt: timestamp('replied_at'),
    openCount: integer('open_count').default(0),
    clickCount: integer('click_count').default(0),

    // Response data
    responseReceived: boolean('response_received').default(false),
    responseText: text('response_text'),
    responseSentiment: varchar('response_sentiment', { length: 50 }), // 'positive', 'neutral', 'negative', 'interested', 'not_interested'

    // Next action
    nextFollowUpAt: timestamp('next_follow_up_at'),
    nextFollowUpType: varchar('next_follow_up_type', { length: 50 }),

    // Device & location tracking
    openedDevice: varchar('opened_device', { length: 100 }),
    openedLocation: varchar('opened_location', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),

    // GA4 Integration
    ga4EventTracked: boolean('ga4_event_tracked').default(false),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    outreachIdIdx: index('ga4_acquisition_outreach_outreach_id_idx').on(table.outreachId),
    leadIdIdx: index('ga4_acquisition_outreach_lead_id_idx').on(table.leadId),
    campaignIdIdx: index('ga4_acquisition_outreach_campaign_id_idx').on(table.campaignId),
    statusIdx: index('ga4_acquisition_outreach_status_idx').on(table.status),
    channelIdx: index('ga4_acquisition_outreach_channel_idx').on(table.channel),
    sentAtIdx: index('ga4_acquisition_outreach_sent_at_idx').on(table.sentAt),
  }),
);

/**
 * ga4_acquisition_sequences
 * Email/outreach sequence templates for automated follow-ups
 */
export const ga4AcquisitionSequences = pgTable(
  'ga4_acquisition_sequences',
  {
    id: serial('id').primaryKey(),
    sequenceId: varchar('sequence_id', { length: 255 }).notNull().unique(),

    // Sequence details
    name: varchar('name', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }).notNull(),
    description: text('description'),

    // Sequence steps
    steps: jsonb('steps')
      .$type<
        Array<{
          stepNumber: number;
          daysSince: number;
          channel: 'email' | 'linkedin' | 'phone';
          subject: string;
          messageTemplate: string;
          messageType: 'initial' | 'follow_up' | 'final';
        }>
      >()
      .notNull(),

    // Performance metrics
    totalUsed: integer('total_used').default(0),
    avgResponseRate: decimal('avg_response_rate', { precision: 5, scale: 2 }).default('0'),
    avgConversionRate: decimal('avg_conversion_rate', { precision: 5, scale: 2 }).default('0'),

    // Configuration
    isActive: boolean('is_active').default(true),
    isSystemDefault: boolean('is_system_default').default(false),

    // User tracking
    createdBy: varchar('created_by').references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    sequenceIdIdx: index('ga4_acquisition_sequences_sequence_id_idx').on(table.sequenceId),
    professionIdx: index('ga4_acquisition_sequences_profession_idx').on(table.profession),
  }),
);

// ============================================================================
// GA4 CUSTOMER INTELLIGENCE SYSTEM
// ============================================================================

/**
 * ga4_customer_profiles
 * Enriched customer profiles with Norwegian external data
 */
export const ga4CustomerProfiles = pgTable(
  'ga4_customer_profiles',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id')
      .notNull()
      .references(() => users.id),
    profileId: varchar('profile_id', { length: 255 }).notNull().unique(),

    // Demographics
    demographics: jsonb('demographics').$type<{
      location?: {
        city: string;
        postalCode: string;
        region: string;
        country: string;
      };
      age?: string;
      gender?: string;
      language?: string;
    }>(),

    // Firmographics (for B2B)
    firmographics: jsonb('firmographics').$type<{
      companyName?: string;
      organizationNumber?: string;
      industry?: string;
      employees?: number;
      revenue?: number;
      creditRating?: string;
    }>(),

    // Behavioral data
    behavioral: jsonb('behavioral').$type<{
      averageSessionDuration: number;
      pagesPerSession: number;
      bounceRate: number;
      conversionRate: number;
      lastActiveDate: string;
      totalSessions: number;
      totalPageviews: number;
    }>(),

    // Psychographic data
    psychographics: jsonb('psychographics').$type<{
      interests: string[];
      painPoints: string[];
      motivations: string[];
      goals: string[];
      values: string[];
    }>(),

    // Norwegian external data enrichment
    externalData: jsonb('external_data').$type<{
      ssbData?: Record<string, unknown>; // SSB statistics
      proffData?: Record<string, unknown>; // Proff.no company data enum
      brregData?: Record<string, unknown>; // BRREG company data
      kartverketData?: Record<string, unknown>; // Kartverket geographic data
      enrichedAt: string;
      dataSources: string[];
    }>(),

    // Customer value
    customerLifetimeValue: decimal('customer_lifetime_value', { precision: 10, scale: 2 }),
    customerSegment: varchar('customer_segment', { length: 100 }),

    // GA4 Integration
    ga4ClientId: varchar('ga4_client_id', { length: 255 }),

    // Timestamps
    lastEnrichedAt: timestamp('last_enriched_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ga4_customer_profiles_user_id_idx').on(table.userId),
    profileIdIdx: index('ga4_customer_profiles_profile_id_idx').on(table.profileId),
    ga4ClientIdIdx: index('ga4_customer_profiles_ga4_client_id_idx').on(table.ga4ClientId),
  }),
);

/**
 * ga4_market_reports
 * AI-generated market intelligence reports
 */
export const ga4MarketReports = pgTable(
  'ga4_market_reports',
  {
    id: serial('id').primaryKey(),
    reportId: varchar('report_id', { length: 255 }).notNull().unique(),

    // Report details
    reportType: varchar('report_type', { length: 100 }).notNull(), // 'geographic', 'industry', 'competitive', 'norwegian_market'
    profession: varchar('profession', { length: 100 }),
    location: varchar('location', { length: 255 }),

    // Market intelligence
    marketSize: integer('market_size'),
    growthRate: decimal('growth_rate', { precision: 5, scale: 2 }),
    competitorCount: integer('competitor_count'),

    // Report data
    reportData: jsonb('report_data')
      .$type<{
        summary: string;
        keyFindings: string[];
        opportunities: Array<{
          type: string;
          description: string;
          potential: string;
          actionItems: string[];
        }>;
        threats: string[];
        recommendations: string[];
        dataSource: string[];
      }>()
      .notNull(),

    // Norwegian external data
    norwegianData: jsonb('norwegian_data').$type<{
      ssbStatistics?: Record<string, unknown>;
      industryBenchmarks?: Record<string, unknown>;
      regionalTrends?: Record<string, unknown>;
      economicIndicators?: Record<string, unknown>;
    }>(),

    // AI analysis
    aiInsights: jsonb('ai_insights').$type<{
      predictedGrowth: number;
      marketOpportunities: string[];
      targetSegments: string[];
      budgetRecommendations: Record<string, unknown>;
    }>(),

    // User tracking
    generatedFor: varchar('generated_for').references(() => users.id),

    // Timestamps
    generatedAt: timestamp('generated_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    reportIdIdx: index('ga4_market_reports_report_id_idx').on(table.reportId),
    reportTypeIdx: index('ga4_market_reports_report_type_idx').on(table.reportType),
    professionIdx: index('ga4_market_reports_profession_idx').on(table.profession),
  }),
);

/**
 * ga4_campaign_strategies
 * AI-generated campaign strategies
 */
export const ga4CampaignStrategies = pgTable(
  'ga4_campaign_strategies',
  {
    id: serial('id').primaryKey(),
    strategyId: varchar('strategy_id', { length: 255 }).notNull().unique(),

    // Strategy details
    targetSegment: varchar('target_segment', { length: 255 }).notNull(),
    profession: varchar('profession', { length: 100 }),

    // Campaign configuration
    channels: jsonb('channels').$type<string[]>().notNull(),
    budget: decimal('budget', { precision: 10, scale: 2 }).notNull(),
    duration: integer('duration').notNull(), // days

    // Targeting
    targeting: jsonb('targeting')
      .$type<{
        locations: string[];
        demographics: Record<string, unknown>;
        firmographics: Record<string, unknown>;
        behavioral: Record<string, unknown>;
      }>()
      .notNull(),

    // Messaging strategy
    messaging: jsonb('messaging')
      .$type<{
        mainMessage: string;
        valueProposition: string;
        callToAction: string;
        norwegianCulturalElements: string[];
        psychologicalTriggers: string[];
      }>()
      .notNull(),

    // AI predictions
    predictions: jsonb('predictions').$type<{
      estimatedReach: number;
      predictedConversionRate: number;
      expectedRevenue: number;
      roi: number;
      confidenceLevel: number;
    }>(),

    // Performance tracking
    isImplemented: boolean('is_implemented').default(false),
    implementedAt: timestamp('implemented_at'),
    actualPerformance: jsonb('actual_performance'),

    // User tracking
    generatedFor: varchar('generated_for').references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    strategyIdIdx: index('ga4_campaign_strategies_strategy_id_idx').on(table.strategyId),
    professionIdx: index('ga4_campaign_strategies_profession_idx').on(table.profession),
  }),
);

/**
 * ga4_custom_audiences
 * GA4 custom audiences created via Admin API
 */
export const ga4CustomAudiences = pgTable(
  'ga4_custom_audiences',
  {
    id: serial('id').primaryKey(),
    audienceId: varchar('audience_id', { length: 255 }).notNull().unique(),
    ga4AudienceResourceName: varchar('ga4_audience_resource_name', { length: 500 }),

    // Audience details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    profession: varchar('profession', { length: 100 }),

    // Audience criteria
    criteria: jsonb('criteria')
      .$type<{
        events?: string[];
        dimensions?: Array<{ name: string; value: string }>;
        metrics?: Array<{ name: string; operator: string; value: number }>;
        exclusions?: Record<string, unknown>;
        membershipDuration?: number;
      }>()
      .notNull(),

    // Performance metrics
    estimatedSize: integer('estimated_size'),
    actualSize: integer('actual_size'),
    activeUsers: integer('active_users'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),

    // GA4 Integration
    ga4PropertyId: varchar('ga4_property_id', { length: 255 }),
    ga4Synced: boolean('ga4_synced').default(false),
    lastSyncedAt: timestamp('last_synced_at'),

    // Status
    status: varchar('status', { length: 50 }).default('active'), // 'active', 'paused', 'archived'

    // User tracking
    createdBy: varchar('created_by').references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    audienceIdIdx: index('ga4_custom_audiences_audience_id_idx').on(table.audienceId),
    professionIdx: index('ga4_custom_audiences_profession_idx').on(table.profession),
    statusIdx: index('ga4_custom_audiences_status_idx').on(table.status),
  }),
);

// ============================================================================
// GA4 ADMIN & CONFIGURATION SYSTEM
// ============================================================================

/**
 * ga4_properties
 * GA4 properties created for clients via Admin API
 */
export const ga4Properties = pgTable(
  'ga4_properties',
  {
    id: serial('id').primaryKey(),
    propertyId: varchar('property_id', { length: 255 }).notNull().unique(),
    ga4PropertyName: varchar('ga4_property_name', { length: 500 }).notNull(), // Format: properties/123456789
    ga4MeasurementId: varchar('ga4_measurement_id', { length: 50 }), // Format: G-XXXXXXXXXX

    // Property details
    displayName: varchar('display_name', { length: 255 }).notNull(),
    industryCategory: varchar('industry_category', { length: 100 }),
    timeZone: varchar('time_zone', { length: 100 }).default('Europe/Oslo'),
    currency: varchar('currency', { length: 3 }).default('NOK'),

    // Client association
    clientUserId: varchar('client_user_id').references(() => users.id),
    clientCompanyName: varchar('client_company_name', { length: 255 }),

    // Configuration
    dataRetentionDays: integer('data_retention_days').default(426), // 14 months
    enableEnhancedMeasurement: boolean('enable_enhanced_measurement').default(true),

    // Data streams
    dataStreams: jsonb('data_streams')
      .$type<
        Array<{
          streamId: string;
          streamName: string;
          streamType: 'WEB' | 'ANDROID_APP' | 'IOS_APP';
          measurementId?: string;
        }>
      >()
      .default([]),

    // Status
    status: varchar('status', { length: 50 }).default('active'), // 'active', 'archived', 'deleted'

    // Setup tracking
    setupCompleted: boolean('setup_completed').default(false),
    setupSteps: jsonb('setup_steps').$type<{
      propertyCreated: boolean;
      dataStreamCreated: boolean;
      customDimensionsAdded: boolean;
      customMetricsAdded: boolean;
      conversionEventsConfigured: boolean;
    }>(),

    // User tracking
    createdBy: varchar('created_by')
      .notNull()
      .references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    propertyIdIdx: index('ga4_properties_property_id_idx').on(table.propertyId),
    ga4MeasurementIdIdx: index('ga4_properties_ga4_measurement_id_idx').on(table.ga4MeasurementId),
    clientUserIdIdx: index('ga4_properties_client_user_id_idx').on(table.clientUserId),
    statusIdx: index('ga4_properties_status_idx').on(table.status),
  }),
);

/**
 * ga4_custom_dimensions
 * Custom dimensions created via Admin API
 */
export const ga4CustomDimensions = pgTable(
  'ga4_custom_dimensions',
  {
    id: serial('id').primaryKey(),
    dimensionId: varchar('dimension_id', { length: 255 }).notNull().unique(),
    ga4PropertyId: integer('ga4_property_id')
      .notNull()
      .references(() => ga4Properties.id, { onDelete: 'cascade' }),

    // Dimension details
    parameterName: varchar('parameter_name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),

    // Configuration
    scope: varchar('scope', { length: 50 }).notNull(), // 'EVENT', 'USER', 'ITEM'
    disallowAdsPersonalization: boolean('disallow_ads_personalization').default(false),

    // GA4 resource
    ga4ResourceName: varchar('ga4_resource_name', { length: 500 }),

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    dimensionIdIdx: index('ga4_custom_dimensions_dimension_id_idx').on(table.dimensionId),
    ga4PropertyIdIdx: index('ga4_custom_dimensions_ga4_property_id_idx').on(table.ga4PropertyId),
    scopeIdx: index('ga4_custom_dimensions_scope_idx').on(table.scope),
  }),
);

/**
 * ga4_custom_metrics
 * Custom metrics created via Admin API
 */
export const ga4CustomMetrics = pgTable(
  'ga4_custom_metrics',
  {
    id: serial('id').primaryKey(),
    metricId: varchar('metric_id', { length: 255 }).notNull().unique(),
    ga4PropertyId: integer('ga4_property_id')
      .notNull()
      .references(() => ga4Properties.id, { onDelete: 'cascade' }),

    // Metric details
    parameterName: varchar('parameter_name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),

    // Configuration
    measurementUnit: varchar('measurement_unit', { length: 50 }).notNull(), // 'STANDARD', 'CURRENCY', 'FEET', 'METERS', 'KILOMETERS', 'MILES', 'MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS'
    scope: varchar('scope', { length: 50 }).notNull(), // 'EVENT'

    // GA4 resource
    ga4ResourceName: varchar('ga4_resource_name', { length: 500 }),

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    metricIdIdx: index('ga4_custom_metrics_metric_id_idx').on(table.metricId),
    ga4PropertyIdIdx: index('ga4_custom_metrics_ga4_property_id_idx').on(table.ga4PropertyId),
  }),
);

/**
 * ga4_conversion_events
 * Conversion events configured via Admin API
 */
export const ga4ConversionEvents = pgTable(
  'ga4_conversion_events',
  {
    id: serial('id').primaryKey(),
    eventId: varchar('event_id', { length: 255 }).notNull().unique(),
    ga4PropertyId: integer('ga4_property_id')
      .notNull()
      .references(() => ga4Properties.id, { onDelete: 'cascade' }),

    // Event details
    eventName: varchar('event_name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    description: text('description'),

    // Configuration
    countingMethod: varchar('counting_method', { length: 50 }).default('ONCE_PER_EVENT'), // 'ONCE_PER_EVENT', 'ONCE_PER_SESSION'
    defaultConversionValue: decimal('default_conversion_value', { precision: 10, scale: 2 }),

    // GA4 resource
    isActive: boolean('is_active').default(true),

    // Performance tracking
    totalConversions: integer('total_conversions').default(0),
    totalValue: decimal('total_value', { precision: 15, scale: 2 }).default('0'),
    lastTriggeredAt: timestamp('last_triggered_at'),

    // User tracking
    createdBy: varchar('created_by').references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    eventIdIdx: index('ga4_conversion_events_event_id_idx').on(table.eventId),
    ga4PropertyIdIdx: index('ga4_conversion_events_ga4_property_id_idx').on(table.ga4PropertyId),
    eventNameIdx: index('ga4_conversion_events_event_name_idx').on(table.eventName),
  }),
);

// ============================================================================
// GA4 ALERTS & INSIGHTS SYSTEM
// ============================================================================

/**
 * ga4_custom_insights
 * Custom insights and alerts configured in GA4
 */
export const ga4CustomInsights = pgTable(
  'ga4_custom_insights',
  {
    id: serial('id').primaryKey(),
    insightId: varchar('insight_id', { length: 255 }).notNull().unique(),
    ga4PropertyId: integer('ga4_property_id').references(() => ga4Properties.id, {
      onDelete: 'cascade',
    }),

    // Insight details
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    insightType: varchar('insight_type', { length: 100 }).notNull(), // 'threshold', 'anomaly', 'trend', 'comparison'

    // Alert conditions
    conditions: jsonb('conditions')
      .$type<{
        metric: string;
        operator: 'greater_than' | 'less_than' | 'equals' | 'changes_by';
        threshold: number;
        comparisonPeriod?: 'previous_day' | 'previous_week' | 'previous_month';
      }>()
      .notNull(),

    // Notification settings
    notificationSettings: jsonb('notification_settings')
      .$type<{
        enabled: boolean;
        channels: Array<'email' | 'sms' | 'push' | 'slack'>;
        recipients: string[];
        frequency: 'immediate' | 'daily' | 'weekly';
      }>()
      .notNull(),

    // Status
    status: varchar('status', { length: 50 }).default('active'), // 'active', 'paused', 'triggered', 'resolved'

    // Trigger history
    lastTriggeredAt: timestamp('last_triggered_at'),
    triggerCount: integer('trigger_count').default(0),

    // User tracking
    createdBy: varchar('created_by')
      .notNull()
      .references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    insightIdIdx: index('ga4_custom_insights_insight_id_idx').on(table.insightId),
    ga4PropertyIdIdx: index('ga4_custom_insights_ga4_property_id_idx').on(table.ga4PropertyId),
    statusIdx: index('ga4_custom_insights_status_idx').on(table.status),
  }),
);

/**
 * ga4_anomaly_detections
 * Anomalies detected by ML/AI in GA4 data
 */
export const ga4AnomalyDetections = pgTable(
  'ga4_anomaly_detections',
  {
    id: serial('id').primaryKey(),
    anomalyId: varchar('anomaly_id', { length: 255 }).notNull().unique(),
    ga4PropertyId: integer('ga4_property_id').references(() => ga4Properties.id, {
      onDelete: 'cascade',
    }),

    // Anomaly details
    metricName: varchar('metric_name', { length: 255 }).notNull(),
    detectionMethod: varchar('detection_method', { length: 100 }).notNull(), // 'zscore', 'iqr', 'ml_model', 'custom'

    // Anomaly data
    expectedValue: decimal('expected_value', { precision: 15, scale: 2 }).notNull(),
    actualValue: decimal('actual_value', { precision: 15, scale: 2 }).notNull(),
    deviation: decimal('deviation', { precision: 15, scale: 2 }).notNull(),
    deviationPercent: decimal('deviation_percent', { precision: 5, scale: 2 }),
    zScore: decimal('z_score', { precision: 10, scale: 4 }),

    // Severity
    severity: varchar('severity', { length: 50 }).notNull(), // 'low', 'medium', 'high', 'critical'
    confidence: decimal('confidence', { precision: 5, scale: 2 }), // 0-100

    // Context
    timeRange: jsonb('time_range')
      .$type<{
        start: string;
        end: string;
      }>()
      .notNull(),
    affectedDimensions: jsonb('affected_dimensions'),

    // AI Analysis
    aiExplanation: text('ai_explanation'),
    suggestedActions: jsonb('suggested_actions').$type<string[]>(),

    // Status
    status: varchar('status', { length: 50 }).default('new'), // 'new', 'investigating', 'resolved', 'false_positive'
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: varchar('resolved_by').references(() => users.id),
    resolution: text('resolution'),

    // Notification
    notificationsSent: boolean('notifications_sent').default(false),
    notifiedUsers: jsonb('notified_users').$type<string[]>().default([]),

    // Timestamps
    detectedAt: timestamp('detected_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    anomalyIdIdx: index('ga4_anomaly_detections_anomaly_id_idx').on(table.anomalyId),
    ga4PropertyIdIdx: index('ga4_anomaly_detections_ga4_property_id_idx').on(table.ga4PropertyId),
    severityIdx: index('ga4_anomaly_detections_severity_idx').on(table.severity),
    statusIdx: index('ga4_anomaly_detections_status_idx').on(table.status),
    detectedAtIdx: index('ga4_anomaly_detections_detected_at_idx').on(table.detectedAt),
  }),
);

/**
 * ga4_alert_history
 * History of all alerts sent
 */
export const ga4AlertHistory = pgTable(
  'ga4_alert_history',
  {
    id: serial('id').primaryKey(),
    alertId: varchar('alert_id', { length: 255 }).notNull().unique(),
    insightId: integer('insight_id').references(() => ga4CustomInsights.id, {
      onDelete: 'cascade',
    }),
    anomalyId: integer('anomaly_id').references(() => ga4AnomalyDetections.id, {
      onDelete: 'cascade',
    }),

    // Alert details
    alertType: varchar('alert_type', { length: 100 }).notNull(), // 'threshold', 'anomaly', 'custom', 'scheduled'
    title: varchar('title', { length: 500 }).notNull(),
    message: text('message').notNull(),
    severity: varchar('severity', { length: 50 }).notNull(),

    // Notification details
    channel: varchar('channel', { length: 50 }).notNull(), // 'email', 'sms', 'push', 'slack'
    recipients: jsonb('recipients').$type<string[]>().notNull(),

    // Status
    status: varchar('status', { length: 50 }).default('sent'), // 'pending', 'sent', 'delivered', 'failed', 'acknowledged'

    // Response tracking
    acknowledgedBy: jsonb('acknowledged_by').$type<string[]>().default([]),
    acknowledgedAt: timestamp('acknowledged_at'),
    actionTaken: text('action_taken'),

    // Timestamps
    sentAt: timestamp('sent_at').defaultNow(),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    alertIdIdx: index('ga4_alert_history_alert_id_idx').on(table.alertId),
    insightIdIdx: index('ga4_alert_history_insight_id_idx').on(table.insightId),
    anomalyIdIdx: index('ga4_alert_history_anomaly_id_idx').on(table.anomalyId),
    severityIdx: index('ga4_alert_history_severity_idx').on(table.severity),
    sentAtIdx: index('ga4_alert_history_sent_at_idx').on(table.sentAt),
  }),
);

// ============================================================================
// GA4 COMPLETE SYSTEM RELATIONS
// ============================================================================

export const ga4AcquisitionCampaignsRelations = relations(
  ga4AcquisitionCampaigns,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [ga4AcquisitionCampaigns.createdBy],
      references: [users.id],
    }),
    leads: many(ga4AcquisitionLeads),
    outreach: many(ga4AcquisitionOutreach),
  }),
);

export const ga4AcquisitionLeadsRelations = relations(ga4AcquisitionLeads, ({ one, many }) => ({
  campaign: one(ga4AcquisitionCampaigns, {
    fields: [ga4AcquisitionLeads.campaignId],
    references: [ga4AcquisitionCampaigns.id],
  }),
  outreach: many(ga4AcquisitionOutreach),
}));

export const ga4AcquisitionOutreachRelations = relations(ga4AcquisitionOutreach, ({ one }) => ({
  lead: one(ga4AcquisitionLeads, {
    fields: [ga4AcquisitionOutreach.leadId],
    references: [ga4AcquisitionLeads.id],
  }),
  campaign: one(ga4AcquisitionCampaigns, {
    fields: [ga4AcquisitionOutreach.campaignId],
    references: [ga4AcquisitionCampaigns.id],
  }),
  sequence: one(ga4AcquisitionSequences, {
    fields: [ga4AcquisitionOutreach.sequenceId],
    references: [ga4AcquisitionSequences.id],
  }),
}));

export const ga4AcquisitionSequencesRelations = relations(
  ga4AcquisitionSequences,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [ga4AcquisitionSequences.createdBy],
      references: [users.id],
    }),
    outreach: many(ga4AcquisitionOutreach),
  }),
);

export const ga4CustomerProfilesRelations = relations(ga4CustomerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [ga4CustomerProfiles.userId],
    references: [users.id],
  }),
}));

export const ga4MarketReportsRelations = relations(ga4MarketReports, ({ one }) => ({
  generatedForUser: one(users, {
    fields: [ga4MarketReports.generatedFor],
    references: [users.id],
  }),
}));

export const ga4CampaignStrategiesRelations = relations(ga4CampaignStrategies, ({ one }) => ({
  generatedForUser: one(users, {
    fields: [ga4CampaignStrategies.generatedFor],
    references: [users.id],
  }),
}));

export const ga4CustomAudiencesRelations = relations(ga4CustomAudiences, ({ one }) => ({
  createdByUser: one(users, {
    fields: [ga4CustomAudiences.createdBy],
    references: [users.id],
  }),
}));

export const ga4PropertiesRelations = relations(ga4Properties, ({ one, many }) => ({
  clientUser: one(users, {
    fields: [ga4Properties.clientUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [ga4Properties.createdBy],
    references: [users.id],
  }),
  customDimensions: many(ga4CustomDimensions),
  customMetrics: many(ga4CustomMetrics),
  conversionEvents: many(ga4ConversionEvents),
  customInsights: many(ga4CustomInsights),
  anomalyDetections: many(ga4AnomalyDetections),
}));

export const ga4CustomDimensionsRelations = relations(ga4CustomDimensions, ({ one }) => ({
  property: one(ga4Properties, {
    fields: [ga4CustomDimensions.ga4PropertyId],
    references: [ga4Properties.id],
  }),
}));

export const ga4CustomMetricsRelations = relations(ga4CustomMetrics, ({ one }) => ({
  property: one(ga4Properties, {
    fields: [ga4CustomMetrics.ga4PropertyId],
    references: [ga4Properties.id],
  }),
}));

export const ga4ConversionEventsRelations = relations(ga4ConversionEvents, ({ one }) => ({
  property: one(ga4Properties, {
    fields: [ga4ConversionEvents.ga4PropertyId],
    references: [ga4Properties.id],
  }),
  createdByUser: one(users, {
    fields: [ga4ConversionEvents.createdBy],
    references: [users.id],
  }),
}));

export const ga4CustomInsightsRelations = relations(ga4CustomInsights, ({ one, many }) => ({
  property: one(ga4Properties, {
    fields: [ga4CustomInsights.ga4PropertyId],
    references: [ga4Properties.id],
  }),
  createdByUser: one(users, {
    fields: [ga4CustomInsights.createdBy],
    references: [users.id],
  }),
  alerts: many(ga4AlertHistory),
}));

export const ga4AnomalyDetectionsRelations = relations(ga4AnomalyDetections, ({ one, many }) => ({
  property: one(ga4Properties, {
    fields: [ga4AnomalyDetections.ga4PropertyId],
    references: [ga4Properties.id],
  }),
  resolvedByUser: one(users, {
    fields: [ga4AnomalyDetections.resolvedBy],
    references: [users.id],
  }),
  alerts: many(ga4AlertHistory),
}));

export const ga4AlertHistoryRelations = relations(ga4AlertHistory, ({ one }) => ({
  insight: one(ga4CustomInsights, {
    fields: [ga4AlertHistory.insightId],
    references: [ga4CustomInsights.id],
  }),
  anomaly: one(ga4AnomalyDetections, {
    fields: [ga4AlertHistory.anomalyId],
    references: [ga4AnomalyDetections.id],
  }),
}));

// ============================================================================
// GA4 COMPLETE SYSTEM ZOD SCHEMAS
// ============================================================================

export const insertGa4AcquisitionCampaignSchema = createInsertSchema(ga4AcquisitionCampaigns);
export const insertGa4AcquisitionLeadSchema = createInsertSchema(ga4AcquisitionLeads);
export const insertGa4AcquisitionOutreachSchema = createInsertSchema(ga4AcquisitionOutreach);
export const insertGa4AcquisitionSequenceSchema = createInsertSchema(ga4AcquisitionSequences);

export const insertGa4CustomerProfileSchema = createInsertSchema(ga4CustomerProfiles);
export const insertGa4MarketReportSchema = createInsertSchema(ga4MarketReports);
export const insertGa4CampaignStrategySchema = createInsertSchema(ga4CampaignStrategies);
export const insertGa4CustomAudienceSchema = createInsertSchema(ga4CustomAudiences);

export const insertGa4PropertySchema = createInsertSchema(ga4Properties);
export const insertGa4CustomDimensionSchema = createInsertSchema(ga4CustomDimensions);
export const insertGa4CustomMetricSchema = createInsertSchema(ga4CustomMetrics);
export const insertGa4ConversionEventSchema = createInsertSchema(ga4ConversionEvents);

export const insertGa4CustomInsightSchema = createInsertSchema(ga4CustomInsights);
export const insertGa4AnomalyDetectionSchema = createInsertSchema(ga4AnomalyDetections);
export const insertGa4AlertHistorySchema = createInsertSchema(ga4AlertHistory);

// ============================================================================
// GA4 COMPLETE SYSTEM TYPESCRIPT TYPES
// ============================================================================

export type Ga4AcquisitionCampaign = typeof ga4AcquisitionCampaigns.$inferSelect;
export type InsertGa4AcquisitionCampaign = z.infer<typeof insertGa4AcquisitionCampaignSchema>;

export type Ga4AcquisitionLead = typeof ga4AcquisitionLeads.$inferSelect;
export type InsertGa4AcquisitionLead = z.infer<typeof insertGa4AcquisitionLeadSchema>;

export type Ga4AcquisitionOutreach = typeof ga4AcquisitionOutreach.$inferSelect;
export type InsertGa4AcquisitionOutreach = z.infer<typeof insertGa4AcquisitionOutreachSchema>;

export type Ga4AcquisitionSequence = typeof ga4AcquisitionSequences.$inferSelect;
export type InsertGa4AcquisitionSequence = z.infer<typeof insertGa4AcquisitionSequenceSchema>;

export type Ga4CustomerProfile = typeof ga4CustomerProfiles.$inferSelect;
export type InsertGa4CustomerProfile = z.infer<typeof insertGa4CustomerProfileSchema>;

export type Ga4MarketReport = typeof ga4MarketReports.$inferSelect;
export type InsertGa4MarketReport = z.infer<typeof insertGa4MarketReportSchema>;

export type Ga4CampaignStrategy = typeof ga4CampaignStrategies.$inferSelect;
export type InsertGa4CampaignStrategy = z.infer<typeof insertGa4CampaignStrategySchema>;

export type Ga4CustomAudience = typeof ga4CustomAudiences.$inferSelect;
export type InsertGa4CustomAudience = z.infer<typeof insertGa4CustomAudienceSchema>;

export type Ga4Property = typeof ga4Properties.$inferSelect;
export type InsertGa4Property = z.infer<typeof insertGa4PropertySchema>;

export type Ga4CustomDimension = typeof ga4CustomDimensions.$inferSelect;
export type InsertGa4CustomDimension = z.infer<typeof insertGa4CustomDimensionSchema>;

export type Ga4CustomMetric = typeof ga4CustomMetrics.$inferSelect;
export type InsertGa4CustomMetric = z.infer<typeof insertGa4CustomMetricSchema>;

export type Ga4ConversionEvent = typeof ga4ConversionEvents.$inferSelect;
export type InsertGa4ConversionEvent = z.infer<typeof insertGa4ConversionEventSchema>;

export type Ga4CustomInsight = typeof ga4CustomInsights.$inferSelect;
export type InsertGa4CustomInsight = z.infer<typeof insertGa4CustomInsightSchema>;

export type Ga4AnomalyDetection = typeof ga4AnomalyDetections.$inferSelect;
export type InsertGa4AnomalyDetection = z.infer<typeof insertGa4AnomalyDetectionSchema>;

export type Ga4AlertHistory = typeof ga4AlertHistory.$inferSelect;
export type InsertGa4AlertHistory = z.infer<typeof insertGa4AlertHistorySchema>;

// ============================================================================
// GA4 CACHING & OPTIMIZATION TABLES
// ============================================================================

/**
 * ga4_monthly_reports
 * Cached monthly GA4 summary reports for faster dashboard loads
 */
export const ga4MonthlyReports = pgTable(
  'ga4_monthly_reports',
  {
    id: serial('id').primaryKey(),
    reportId: varchar('report_id', { length: 255 }).notNull().unique(),

    // Report period
    year: integer('year').notNull(),
    month: integer('month').notNull(), // 1-12

    // Report data
    reportType: varchar('report_type', { length: 100 }).notNull(), // 'executive', 'detailed', 'technical'

    // Summary metrics
    totalUsers: integer('total_users'),
    totalSessions: integer('total_sessions'),
    totalPageviews: integer('total_pageviews'),
    totalRevenue: decimal('total_revenue', { precision: 15, scale: 2 }),
    totalConversions: integer('total_conversions'),
    averageSessionDuration: decimal('average_session_duration', { precision: 10, scale: 2 }),
    bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }),

    // AI-generated insights
    executiveSummary: text('executive_summary'),
    keyFindings: jsonb('key_findings').$type<string[]>(),
    recommendations: jsonb('recommendations').$type<string[]>(),
    anomalies: jsonb('anomalies').$type<
      Array<{
        metric: string;
        description: string;
        severity: string;
      }>
    >(),

    // Trends & predictions
    trends: jsonb('trends').$type<{
      userGrowth: number;
      revenueGrowth: number;
      engagementTrend: string;
      seasonalPatterns: Record<string, unknown>;
    }>(),

    predictions: jsonb('predictions').$type<{
      nextMonthUsers: number;
      nextMonthRevenue: number;
      confidence: number;
    }>(),

    // Detailed data (full report)
    detailedData: jsonb('detailed_data'),

    // Charts & visualizations data
    chartData: jsonb('chart_data').$type<{
      usersTrend: Array<{ date: string; users: number }>;
      revenueTrend: Array<{ date: string; revenue: number }>;
      topPages: Array<{ page: string; views: number }>;
      topEvents: Array<{ event: string; count: number }>;
    }>(),

    // AI generation metadata
    aiModel: varchar('ai_model', { length: 100 }),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    generationTime: integer('generation_time'), // seconds

    // Status
    status: varchar('status', { length: 50 }).default('generated'), // 'generating', 'generated', 'sent', 'archived'

    // Distribution
    sentTo: jsonb('sent_to').$type<string[]>(),
    sentAt: timestamp('sent_at'),

    // User tracking
    generatedBy: varchar('generated_by').references(() => users.id),

    // Timestamps
    generatedAt: timestamp('generated_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    reportIdIdx: index('ga4_monthly_reports_report_id_idx').on(table.reportId),
    yearMonthIdx: index('ga4_monthly_reports_year_month_idx').on(table.year, table.month),
    reportTypeIdx: index('ga4_monthly_reports_report_type_idx').on(table.reportType),
    statusIdx: index('ga4_monthly_reports_status_idx').on(table.status),
  }),
);

/**
 * gtm_containers
 * Track Google Tag Manager containers, tags, and deployments
 */
export const gtmContainers = pgTable(
  'gtm_containers',
  {
    id: serial('id').primaryKey(),
    containerId: varchar('container_id', { length: 255 }).notNull().unique(),
    gtmContainerResourceName: varchar('gtm_container_resource_name', { length: 500 }),

    // Container details
    name: varchar('name', { length: 255 }).notNull(),
    accountId: varchar('account_id', { length: 255 }),

    // Container type
    usageContext: jsonb('usage_context')
      .$type<Array<'web' | 'android' | 'ios' | 'amp' | 'server'>>()
      .notNull(),

    // Configuration
    publicId: varchar('public_id', { length: 50 }), // GTM-XXXXXX
    domainName: jsonb('domain_name').$type<string[]>(),
    notes: text('notes'),

    // Tags & Triggers
    totalTags: integer('total_tags').default(0),
    totalTriggers: integer('total_triggers').default(0),
    totalVariables: integer('total_variables').default(0),

    // Version tracking
    currentVersion: integer('current_version'),
    publishedVersion: integer('published_version'),

    // Status
    status: varchar('status', { length: 50 }).default('active'), // 'active', 'paused', 'archived'

    // Client association
    clientUserId: varchar('client_user_id').references(() => users.id),

    // User tracking
    createdBy: varchar('created_by')
      .notNull()
      .references(() => users.id),

    // Timestamps
    lastPublishedAt: timestamp('last_published_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    containerIdIdx: index('gtm_containers_container_id_idx').on(table.containerId),
    publicIdIdx: index('gtm_containers_public_id_idx').on(table.publicId),
    clientUserIdIdx: index('gtm_containers_client_user_id_idx').on(table.clientUserId),
    statusIdx: index('gtm_containers_status_idx').on(table.status),
  }),
);

/**
 * gtm_tags
 * Track individual GTM tags deployed
 */
export const gtmTags = pgTable(
  'gtm_tags',
  {
    id: serial('id').primaryKey(),
    tagId: varchar('tag_id', { length: 255 }).notNull().unique(),
    containerId: integer('container_id')
      .notNull()
      .references(() => gtmContainers.id, { onDelete: 'cascade' }),

    // Tag details
    name: varchar('name', { length: 255 }).notNull(),
    tagType: varchar('tag_type', { length: 100 }).notNull(), // 'ga4_config', 'ga4_event', 'conversion_linker', 'custom_html'

    // Configuration
    tagConfiguration: jsonb('tag_configuration').notNull(),
    firingTriggerId: jsonb('firing_trigger_id').$type<string[]>(),
    blockingTriggerId: jsonb('blocking_trigger_id').$type<string[]>(),

    // Status
    isActive: boolean('is_active').default(true),
    isPaused: boolean('is_paused').default(false),

    // Performance tracking
    firingCount: integer('firing_count').default(0),
    lastFiredAt: timestamp('last_fired_at'),

    // Deployment
    deployedVersion: integer('deployed_version'),
    deployedAt: timestamp('deployed_at'),

    // User tracking
    createdBy: varchar('created_by').references(() => users.id),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tagIdIdx: index('gtm_tags_tag_id_idx').on(table.tagId),
    containerIdIdx: index('gtm_tags_container_id_idx').on(table.containerId),
    tagTypeIdx: index('gtm_tags_tag_type_idx').on(table.tagType),
  }),
);

/**
 * gtm_deployments
 * Track GTM container deployment history
 */
export const gtmDeployments = pgTable(
  'gtm_deployments',
  {
    id: serial('id').primaryKey(),
    deploymentId: varchar('deployment_id', { length: 255 }).notNull().unique(),
    containerId: integer('container_id')
      .notNull()
      .references(() => gtmContainers.id, { onDelete: 'cascade' }),

    // Deployment details
    versionNumber: integer('version_number').notNull(),
    versionName: varchar('version_name', { length: 255 }),
    versionDescription: text('version_description'),

    // Environment
    environment: varchar('environment', { length: 50 }).notNull(), // 'staging', 'production'

    // Changes summary
    tagsAdded: integer('tags_added').default(0),
    tagsModified: integer('tags_modified').default(0),
    tagsDeleted: integer('tags_deleted').default(0),
    triggersAdded: integer('triggers_added').default(0),
    variablesAdded: integer('variables_added').default(0),

    // Deployment status
    status: varchar('status', { length: 50 }).default('success'), // 'pending', 'success', 'failed', 'rolled_back'
    errorMessage: text('error_message'),

    // User tracking
    deployedBy: varchar('deployed_by')
      .notNull()
      .references(() => users.id),

    // Timestamps
    deployedAt: timestamp('deployed_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    deploymentIdIdx: index('gtm_deployments_deployment_id_idx').on(table.deploymentId),
    containerIdIdx: index('gtm_deployments_container_id_idx').on(table.containerId),
    environmentIdx: index('gtm_deployments_environment_idx').on(table.environment),
    deployedAtIdx: index('gtm_deployments_deployed_at_idx').on(table.deployedAt),
  }),
);

/**
 * ai_insights_cache
 * Cache AI-generated insights to reduce API costs and improve performance
 */
export const aiInsightsCache = pgTable(
  'ai_insights_cache',
  {
    id: serial('id').primaryKey(),
    cacheKey: varchar('cache_key', { length: 500 }).notNull().unique(),

    // Request details
    insightType: varchar('insight_type', { length: 100 }).notNull(), // 'anomaly', 'trend', 'prediction', 'recommendation', 'summary'
    requestParams: jsonb('request_params').notNull(),

    // Input data hash (for cache validation)
    dataHash: varchar('data_hash', { length: 64 }).notNull(),

    // Cached response
    insightData: jsonb('insight_data').notNull(),

    // AI metadata
    aiProvider: varchar('ai_provider', { length: 50 }).notNull(), // 'openai', 'anthropic', 'google'
    aiModel: varchar('ai_model', { length: 100 }).notNull(),
    tokensUsed: integer('tokens_used'),
    costUsd: decimal('cost_usd', { precision: 10, scale: 4 }),
    responseTime: integer('response_time'), // milliseconds

    // Cache metadata
    hitCount: integer('hit_count').default(0),
    lastAccessedAt: timestamp('last_accessed_at'),

    // Data freshness
    dataStartDate: date('data_start_date'),
    dataEndDate: date('data_end_date'),

    // Cache validity
    isValid: boolean('is_valid').default(true),
    invalidatedAt: timestamp('invalidated_at'),
    invalidationReason: text('invalidation_reason'),

    // TTL (Time To Live)
    expiresAt: timestamp('expires_at').notNull(),

    // User/context
    userId: varchar('user_id').references(() => users.id),
    profession: varchar('profession', { length: 100 }),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    cacheKeyIdx: index('ai_insights_cache_cache_key_idx').on(table.cacheKey),
    dataHashIdx: index('ai_insights_cache_data_hash_idx').on(table.dataHash),
    insightTypeIdx: index('ai_insights_cache_insight_type_idx').on(table.insightType),
    expiresAtIdx: index('ai_insights_cache_expires_at_idx').on(table.expiresAt),
    isValidIdx: index('ai_insights_cache_is_valid_idx').on(table.isValid),
    userIdIdx: index('ai_insights_cache_user_id_idx').on(table.userId),
  }),
);

// ============================================================================
// CACHING & OPTIMIZATION RELATIONS
// ============================================================================

export const ga4MonthlyReportsRelations = relations(ga4MonthlyReports, ({ one }) => ({
  generatedByUser: one(users, {
    fields: [ga4MonthlyReports.generatedBy],
    references: [users.id],
  }),
}));

export const gtmContainersRelations = relations(gtmContainers, ({ one, many }) => ({
  clientUser: one(users, {
    fields: [gtmContainers.clientUserId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [gtmContainers.createdBy],
    references: [users.id],
  }),
  tags: many(gtmTags),
  deployments: many(gtmDeployments),
}));

export const gtmTagsRelations = relations(gtmTags, ({ one }) => ({
  container: one(gtmContainers, {
    fields: [gtmTags.containerId],
    references: [gtmContainers.id],
  }),
  createdByUser: one(users, {
    fields: [gtmTags.createdBy],
    references: [users.id],
  }),
}));

export const gtmDeploymentsRelations = relations(gtmDeployments, ({ one }) => ({
  container: one(gtmContainers, {
    fields: [gtmDeployments.containerId],
    references: [gtmContainers.id],
  }),
  deployedByUser: one(users, {
    fields: [gtmDeployments.deployedBy],
    references: [users.id],
  }),
}));

export const aiInsightsCacheRelations = relations(aiInsightsCache, ({ one }) => ({
  user: one(users, {
    fields: [aiInsightsCache.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// CACHING & OPTIMIZATION ZOD SCHEMAS
// ============================================================================

export const insertGa4MonthlyReportSchema = createInsertSchema(ga4MonthlyReports);
export const insertGtmContainerSchema = createInsertSchema(gtmContainers);
export const insertGtmTagSchema = createInsertSchema(gtmTags);
export const insertGtmDeploymentSchema = createInsertSchema(gtmDeployments);
export const insertAiInsightsCacheSchema = createInsertSchema(aiInsightsCache);

// ============================================================================
// CACHING & OPTIMIZATION TYPESCRIPT TYPES
// ============================================================================

export type Ga4MonthlyReport = typeof ga4MonthlyReports.$inferSelect;
export type InsertGa4MonthlyReport = z.infer<typeof insertGa4MonthlyReportSchema>;

export type GtmContainer = typeof gtmContainers.$inferSelect;
export type InsertGtmContainer = z.infer<typeof insertGtmContainerSchema>;

export type GtmTag = typeof gtmTags.$inferSelect;
export type InsertGtmTag = z.infer<typeof insertGtmTagSchema>;

export type GtmDeployment = typeof gtmDeployments.$inferSelect;
export type InsertGtmDeployment = z.infer<typeof insertGtmDeploymentSchema>;

export type AiInsightsCache = typeof aiInsightsCache.$inferSelect;
export type InsertAiInsightsCache = z.infer<typeof insertAiInsightsCacheSchema>;

// ============================================================================
// NORWEGIAN DICTIONARY SYSTEM RELATIONS
// ============================================================================

export const dictionaryEntriesRelations = relations(dictionaryEntries, ({ one, many }) => ({
  verifiedByUser: one(users, {
    fields: [dictionaryEntries.verifiedBy],
    references: [users.id],
  }),
  searchHistory: many(dictionarySearchHistory),
  bookmarks: many(dictionaryUserBookmarks),
  pronunciationAudio: many(dictionaryPronunciationAudio),
  translationRequests: many(dictionaryTranslationRequests),
}));

export const dictionarySearchHistoryRelations = relations(dictionarySearchHistory, ({ one }) => ({
  user: one(users, {
    fields: [dictionarySearchHistory.userId],
    references: [users.id],
  }),
  entry: one(dictionaryEntries, {
    fields: [dictionarySearchHistory.entryId],
    references: [dictionaryEntries.id],
  }),
  note: one(notes, {
    fields: [dictionarySearchHistory.noteId],
    references: [notes.id],
  }),
}));

export const dictionaryUserBookmarksRelations = relations(dictionaryUserBookmarks, ({ one }) => ({
  user: one(users, {
    fields: [dictionaryUserBookmarks.userId],
    references: [users.id],
  }),
  entry: one(dictionaryEntries, {
    fields: [dictionaryUserBookmarks.entryId],
    references: [dictionaryEntries.id],
  }),
}));

export const dictionaryUserContributionsRelations = relations(
  dictionaryUserContributions,
  ({ one }) => ({
    user: one(users, {
      fields: [dictionaryUserContributions.userId],
      references: [users.id],
    }),
    reviewedByUser: one(users, {
      fields: [dictionaryUserContributions.reviewedBy],
      references: [users.id],
    }),
    mergedIntoEntry: one(dictionaryEntries, {
      fields: [dictionaryUserContributions.mergedIntoEntryId],
      references: [dictionaryEntries.id],
    }),
  }),
);

export const dictionaryTranslationRequestsRelations = relations(
  dictionaryTranslationRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [dictionaryTranslationRequests.userId],
      references: [users.id],
    }),
    addedToEntry: one(dictionaryEntries, {
      fields: [dictionaryTranslationRequests.addedToEntryId],
      references: [dictionaryEntries.id],
    }),
  }),
);

export const dictionaryPronunciationAudioRelations = relations(
  dictionaryPronunciationAudio,
  ({ one }) => ({
    entry: one(dictionaryEntries, {
      fields: [dictionaryPronunciationAudio.entryId],
      references: [dictionaryEntries.id],
    }),
  }),
);

export const dictionaryContextSuggestionsRelations = relations(
  dictionaryContextSuggestions,
  ({ one }) => ({
    user: one(users, {
      fields: [dictionaryContextSuggestions.userId],
      references: [users.id],
    }),
    note: one(notes, {
      fields: [dictionaryContextSuggestions.noteId],
      references: [notes.id],
    }),
  }),
);

export const dictionaryUsageAnalyticsRelations = relations(dictionaryUsageAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [dictionaryUsageAnalytics.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// NORWEGIAN DICTIONARY SYSTEM ZOD SCHEMAS
// ============================================================================

export const insertDictionaryEntrySchema = createInsertSchema(dictionaryEntries);
export const insertDictionarySearchHistorySchema = createInsertSchema(dictionarySearchHistory);
export const insertDictionaryUserBookmarkSchema = createInsertSchema(dictionaryUserBookmarks);
export const insertDictionaryUserContributionSchema = createInsertSchema(
  dictionaryUserContributions,
);
export const insertDictionaryTranslationRequestSchema = createInsertSchema(
  dictionaryTranslationRequests,
);
export const insertDictionaryUsageAnalyticSchema = createInsertSchema(dictionaryUsageAnalytics);
export const insertDictionaryDomainCategorySchema = createInsertSchema(dictionaryDomainCategories);
export const insertDictionaryPronunciationAudioSchema = createInsertSchema(
  dictionaryPronunciationAudio,
);
export const insertDictionaryContextSuggestionSchema = createInsertSchema(
  dictionaryContextSuggestions,
);

// ============================================================================
// NORWEGIAN DICTIONARY SYSTEM TYPESCRIPT TYPES
// ============================================================================

export type DictionaryEntry = typeof dictionaryEntries.$inferSelect;
export type InsertDictionaryEntry = z.infer<typeof insertDictionaryEntrySchema>;

export type DictionarySearchHistory = typeof dictionarySearchHistory.$inferSelect;
export type InsertDictionarySearchHistory = z.infer<typeof insertDictionarySearchHistorySchema>;

export type DictionaryUserBookmark = typeof dictionaryUserBookmarks.$inferSelect;
export type InsertDictionaryUserBookmark = z.infer<typeof insertDictionaryUserBookmarkSchema>;

export type DictionaryUserContribution = typeof dictionaryUserContributions.$inferSelect;
export type InsertDictionaryUserContribution = z.infer<
  typeof insertDictionaryUserContributionSchema
>;

export type DictionaryTranslationRequest = typeof dictionaryTranslationRequests.$inferSelect;
export type InsertDictionaryTranslationRequest = z.infer<
  typeof insertDictionaryTranslationRequestSchema
>;

export type DictionaryUsageAnalytic = typeof dictionaryUsageAnalytics.$inferSelect;
export type InsertDictionaryUsageAnalytic = z.infer<typeof insertDictionaryUsageAnalyticSchema>;

export type DictionaryDomainCategory = typeof dictionaryDomainCategories.$inferSelect;
export type InsertDictionaryDomainCategory = z.infer<typeof insertDictionaryDomainCategorySchema>;

export type DictionaryPronunciationAudio = typeof dictionaryPronunciationAudio.$inferSelect;
export type InsertDictionaryPronunciationAudio = z.infer<
  typeof insertDictionaryPronunciationAudioSchema
>;

export type DictionaryContextSuggestion = typeof dictionaryContextSuggestions.$inferSelect;
export type InsertDictionaryContextSuggestion = z.infer<
  typeof insertDictionaryContextSuggestionSchema
>;

// ============================================================================
// PROTOTYPE TESTING SYSTEM
// ============================================================================

export const prototypeTestingFeedback = pgTable(
  'prototype_testing_feedback',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    userRole: varchar('user_role', { length: 100 }).notNull(),
    dashboardType: varchar('dashboard_type', { length: 100 }).notNull(),
    feedback: text('feedback').notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    priority: varchar('priority', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),

    // Screenshot fields
    screenshotUrl: text('screenshot_url'),
    screenshotMetadata: jsonb('screenshot_metadata').$type<{
      ocrText?: string;
      ocrKeywords?: string[];
      ocrCategory?: string;
      ocrConfidence?: number;
      codeErrors?: Array<Record<string, unknown>>;
      hasCode?: boolean;
      googleDriveId?: string;
      thumbnailUrl?: string;
      fileSize?: number;
      dimensions?: { width: number; height: number };
      hash?: string;
      uploadedAt?: string;
    }>(),

    // Session tracking
    sessionTracking: jsonb('session_tracking'),

    // Enhanced tracking
    feedbackLength: integer('feedback_length'),
    includesScreenshot: boolean('includes_screenshot').default(false),
    includesStepsToReproduce: boolean('includes_steps_to_reproduce').default(false),

    emailSent: boolean('email_sent').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('prototype_feedback_user_id_idx').on(table.userId),
    statusIdx: index('prototype_feedback_status_idx').on(table.status),
    createdAtIdx: index('prototype_feedback_created_at_idx').on(table.createdAt),
  }),
);

export const prototypeTestUsers = pgTable(
  'prototype_test_users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    role: varchar('role', { length: 100 }).notNull(),
    dashboardType: varchar('dashboard_type', { length: 100 }).notNull(),
    experience: varchar('experience', { length: 50 }).notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('prototype_users_email_idx').on(table.email),
  }),
);

export type PrototypeTestingFeedback = typeof prototypeTestingFeedback.$inferSelect;
export type InsertPrototypeTestingFeedback = typeof prototypeTestingFeedback.$inferInsert;

export type PrototypeTestUser = typeof prototypeTestUsers.$inferSelect;
export type InsertPrototypeTestUser = typeof prototypeTestUsers.$inferInsert;

// ============================================================================
// BUSINESS REPORTS SYSTEM
// ============================================================================

export const businessReportTemplates = pgTable(
  'business_report_templates',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 500 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }).notNull(), // financial, operational, compliance, analytics, custom
    sections: jsonb('sections').$type<string[]>().notNull().default([]),
    frequency: varchar('frequency', { length: 50 }).notNull(), // daily, weekly, monthly, quarterly, yearly, manual
    format: varchar('format', { length: 20 }).notNull(), // pdf, excel, csv
    recipients: jsonb('recipients').$type<string[]>().notNull().default([]),
    norwegianCompliance: boolean('norwegian_compliance').default(false),
    vatIncluded: boolean('vat_included').default(false),
    lastGenerated: timestamp('last_generated'),
    nextScheduled: timestamp('next_scheduled'),
    status: varchar('status', { length: 50 }).notNull().default('draft'), // active, draft, archived
    customSettings: jsonb('custom_settings').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('business_report_templates_user_id_idx').on(table.userId),
    categoryIdx: index('business_report_templates_category_idx').on(table.category),
    statusIdx: index('business_report_templates_status_idx').on(table.status),
  }),
);

export const generatedBusinessReports = pgTable(
  'generated_business_reports',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    templateId: varchar('template_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    templateName: varchar('template_name', { length: 500 }).notNull(),
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    period: varchar('period', { length: 255 }), // e.g., "Januar 2025", "Q4 2024", "Uke 4 2025"
    format: varchar('format', { length: 20 }).notNull(),
    fileSize: varchar('file_size', { length: 50 }),
    downloadUrl: text('download_url'),
    googleDriveId: varchar('google_drive_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),
    googleSheetsId: varchar('google_sheets_id', { length: 255 }),
    googleSheetsUrl: text('google_sheets_url'),
    recipients: jsonb('recipients').$type<string[]>().notNull().default([]),
    status: varchar('status', { length: 50 }).notNull().default('generating'), // generating, ready, sent, failed
    pages: integer('pages'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    emailSentAt: timestamp('email_sent_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    templateIdIdx: index('generated_reports_template_id_idx').on(table.templateId),
    userIdIdx: index('generated_reports_user_id_idx').on(table.userId),
    statusIdx: index('generated_reports_status_idx').on(table.status),
    generatedAtIdx: index('generated_reports_generated_at_idx').on(table.generatedAt),
  }),
);

export const businessReportSchedules = pgTable(
  'business_report_schedules',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    templateId: varchar('template_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 500 }).notNull(),
    frequency: varchar('frequency', { length: 50 }).notNull(),
    nextRun: timestamp('next_run').notNull(),
    lastRun: timestamp('last_run'),
    enabled: boolean('enabled').default(true),
    recipients: jsonb('recipients').$type<string[]>().notNull().default([]),
    customSettings: jsonb('custom_settings').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    templateIdIdx: index('business_report_schedules_template_id_idx').on(table.templateId),
    userIdIdx: index('business_report_schedules_user_id_idx').on(table.userId),
    enabledIdx: index('business_report_schedules_enabled_idx').on(table.enabled),
    nextRunIdx: index('business_report_schedules_next_run_idx').on(table.nextRun),
  }),
);

// Validation schemas
export const insertBusinessReportTemplateSchema = createInsertSchema(businessReportTemplates);
export const insertGeneratedBusinessReportSchema = createInsertSchema(generatedBusinessReports);
export const insertBusinessReportScheduleSchema = createInsertSchema(businessReportSchedules);

// Types
export type BusinessReportTemplate = typeof businessReportTemplates.$inferSelect;
export type InsertBusinessReportTemplate = z.infer<typeof insertBusinessReportTemplateSchema>;

export type GeneratedBusinessReport = typeof generatedBusinessReports.$inferSelect;
export type InsertGeneratedBusinessReport = z.infer<typeof insertGeneratedBusinessReportSchema>;

export type BusinessReportSchedule = typeof businessReportSchedules.$inferSelect;
export type InsertBusinessReportSchedule = z.infer<typeof insertBusinessReportScheduleSchema>;

// ============================================================================
// SYSTEM SETTINGS (Key-Value Store)
// ============================================================================

export const systemSettings = pgTable(
  'system_settings',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 255 }).notNull().unique(),
    value: text('value'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    keyIdx: index('system_settings_key_idx').on(table.key),
  }),
);

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

/**
 * CreatorHub Norge - Complete Database Persistence Schema
 * Comprehensive database schema for all platform features
 */
