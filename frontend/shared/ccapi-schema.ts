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
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// CANON CCAPI (Camera Control API) INTEGRATION
// Real-world camera control for Virtual Studio scenes
// ============================================================================

/**
 * CCAPI Cameras
 * Registry of Canon cameras that support CCAPI
 */
export const ccapiCameras = pgTable(
  'ccapi_cameras',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Camera Identification
    cameraName: varchar('camera_name', { length: 255 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(), // EOS R5, EOS R6, etc.
    serialNumber: varchar('serial_number', { length: 100 }),
    firmwareVersion: varchar('firmware_version', { length: 50 }),

    // Network Info
    ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
    macAddress: varchar('mac_address', { length: 17 }),

    // Camera Capabilities
    supportedFeatures: jsonb('supported_features'), // Array of CCAPI features
    maxIso: integer('max_iso'),
    availableApertures: jsonb('available_apertures'), // Array of f-stops
    availableShutterSpeeds: jsonb('available_shutter_speeds'),
    availableFocalLengths: jsonb('available_focal_lengths'), // For power zoom lenses

    // Status
    isOnline: boolean('is_online').default(false),
    batteryLevel: integer('battery_level'), // 0-100
    remainingShots: integer('remaining_shots'),
    storageAvailable: varchar('storage_available', { length: 50 }), // "32 GB"

    // Last Connection
    lastConnectedAt: timestamp('last_connected_at'),
    lastSeenAt: timestamp('last_seen_at'),

    // Metadata
    notes: text('notes'),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ccapi_cameras_user_id_idx').on(table.userId),
    modelIdx: index('ccapi_cameras_model_idx').on(table.model),
    isOnlineIdx: index('ccapi_cameras_online_idx').on(table.isOnline),
  }),
);

export type CcapiCamera = typeof ccapiCameras.$inferSelect;
export type InsertCcapiCamera = typeof ccapiCameras.$inferInsert;

/**
 * CCAPI Connections
 * Active and historical camera connections
 */
export const ccapiConnections = pgTable(
  'ccapi_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    cameraId: uuid('camera_id').notNull(),

    // Connection Details
    connectionType: varchar('connection_type', { length: 50 })
      .$type<'wifi' | 'ethernet' | 'usb' | 'bluetooth'>()
      .notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    port: integer('port').default(8080),

    // Connection Status
    status: varchar('status', { length: 20 })
      .$type<'connecting' | 'connected' | 'disconnected' | 'error'>()
      .default('connecting'),

    // Session Info
    sessionId: varchar('session_id', { length: 255 }),
    connectedAt: timestamp('connected_at').defaultNow(),
    disconnectedAt: timestamp('disconnected_at'),
    duration: integer('duration'), // seconds

    // Performance Metrics
    latency: integer('latency'), // milliseconds
    photosTaken: integer('photos_taken').default(0),
    commandsSent: integer('commands_sent').default(0),
    errorsCount: integer('errors_count').default(0),

    // Error Details
    lastError: text('last_error'),
    errorLog: jsonb('error_log'), // Array of errors

    // Metadata
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    cameraIdIdx: index('ccapi_connections_camera_id_idx').on(table.cameraId),
    statusIdx: index('ccapi_connections_status_idx').on(table.status),
    userIdIdx: index('ccapi_connections_user_id_idx').on(table.userId),
  }),
);

export type CcapiConnection = typeof ccapiConnections.$inferSelect;
export type InsertCcapiConnection = typeof ccapiConnections.$inferInsert;

/**
 * CCAPI Shot Lists
 * Exported shot lists from Virtual Studio scenes for on-set use
 */
export const ccapiShotLists = pgTable(
  'ccapi_shot_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // Virtual Studio Reference
    projectId: uuid('project_id'),
    sceneId: uuid('scene_id'),
    cameraPathId: uuid('camera_path_id'),

    // Shot List Info
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Shots Data
    shots: jsonb('shots').notNull(), // Array of shot configurations
    totalShots: integer('total_shots').notNull(),
    completedShots: integer('completed_shots').default(0),

    // Camera Settings Template
    defaultSettings: jsonb('default_settings'), // Default camera settings

    // Export Info
    exportFormat: varchar('export_format', { length: 50 }).default('ccapi_v1'),
    exportedAt: timestamp('exported_at').defaultNow(),

    // Google Drive
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),

    // Usage Tracking
    timesUsed: integer('times_used').default(0),
    lastUsedAt: timestamp('last_used_at'),

    // Status
    status: varchar('status', { length: 20 })
      .$type<'draft' | 'ready' | 'in_progress' | 'completed' | 'archived'>()
      .default('draft'),

    // Metadata
    tags: jsonb('tags'),
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ccapi_shot_lists_user_id_idx').on(table.userId),
    projectIdIdx: index('ccapi_shot_lists_project_id_idx').on(table.projectId),
    sceneIdIdx: index('ccapi_shot_lists_scene_id_idx').on(table.sceneId),
    statusIdx: index('ccapi_shot_lists_status_idx').on(table.status),
  }),
);

export type CcapiShotList = typeof ccapiShotLists.$inferSelect;
export type InsertCcapiShotList = typeof ccapiShotLists.$inferInsert;

/**
 * CCAPI Real Photos
 * Photos taken during real shoots using CCAPI
 */
export const ccapiRealPhotos = pgTable(
  'ccapi_real_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // References
    shotListId: uuid('shot_list_id'),
    shotIndex: integer('shot_index'), // Which shot in the list
    sceneId: uuid('scene_id'), // Virtual scene reference
    cameraId: uuid('camera_id'),
    connectionId: uuid('connection_id'),

    // Photo Info
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: text('file_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    fileSize: integer('file_size'), // bytes
    fileFormat: varchar('file_format', { length: 20 }), // .jpg, .cr3, .raw

    // Camera Settings Used
    aperture: decimal('aperture', { precision: 3, scale: 1 }), // f/2.8
    shutterSpeed: varchar('shutter_speed', { length: 20 }), // "1/250"
    iso: integer('iso'),
    focalLength: integer('focal_length'), // mm
    whiteBalance: varchar('white_balance', { length: 50 }),
    exposureCompensation: decimal('exposure_compensation', { precision: 3, scale: 1 }),

    // Photo Metadata
    exifData: jsonb('exif_data'), // Complete EXIF data

    // Position Data
    gpsLocation: jsonb('gps_location'), // {lat, lng, altitude}
    cameraPosition: jsonb('camera_position'), // {x, y, z} from AR/manual
    cameraRotation: jsonb('camera_rotation'), // {pitch, yaw, roll}

    // Quality Assessment
    rating: integer('rating'), // 1-5 stars
    flagged: boolean('flagged').default(false),
    flagReason: varchar('flag_reason', { length: 50 }), // keeper, review, reject

    // Comparison Results
    similarityScore: decimal('similarity_score', { precision: 5, scale: 2 }), // 0-100
    comparisonResultId: uuid('comparison_result_id'),

    // Google Drive
    googleDriveFileId: varchar('google_drive_file_id', { length: 255 }),
    googleDriveUrl: text('google_drive_url'),

    // Notes
    photographerNotes: text('photographer_notes'),

    // Timestamps
    capturedAt: timestamp('captured_at').notNull(),
    uploadedAt: timestamp('uploaded_at'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ccapi_real_photos_user_id_idx').on(table.userId),
    shotListIdIdx: index('ccapi_real_photos_shot_list_id_idx').on(table.shotListId),
    sceneIdIdx: index('ccapi_real_photos_scene_id_idx').on(table.sceneId),
    cameraIdIdx: index('ccapi_real_photos_camera_id_idx').on(table.cameraId),
    capturedAtIdx: index('ccapi_real_photos_captured_at_idx').on(table.capturedAt),
    flaggedIdx: index('ccapi_real_photos_flagged_idx').on(table.flagged),
  }),
);

export type CcapiRealPhoto = typeof ccapiRealPhotos.$inferSelect;
export type InsertCcapiRealPhoto = typeof ccapiRealPhotos.$inferInsert;

/**
 * CCAPI Comparison Results
 * Compare virtual renders with real photos
 */
export const ccapiComparisonResults = pgTable(
  'ccapi_comparison_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // References
    sceneId: uuid('scene_id').notNull(),
    virtualRenderId: uuid('virtual_render_id'), // From virtual_studio_renders
    realPhotoId: uuid('real_photo_id').notNull(),

    // Comparison Scores
    overallSimilarity: decimal('overall_similarity', { precision: 5, scale: 2 }), // 0-100
    compositionSimilarity: decimal('composition_similarity', { precision: 5, scale: 2 }),
    lightingSimilarity: decimal('lighting_similarity', { precision: 5, scale: 2 }),
    colorSimilarity: decimal('color_similarity', { precision: 5, scale: 2 }),
    depthOfFieldSimilarity: decimal('depth_of_field_similarity', { precision: 5, scale: 2 }),

    // Detailed Analysis
    analysis: jsonb('analysis').notNull(), // Detailed comparison data

    // Deviations
    positionDeviation: jsonb('position_deviation'), // {distance, direction}
    angleDeviation: jsonb('angle_deviation'), // {pitch, yaw, roll} differences
    settingsDeviation: jsonb('settings_deviation'), // aperture, iso, shutter differences

    // AI Suggestions
    suggestions: jsonb('suggestions'), // Array of improvement suggestions
    adjustments: jsonb('adjustments'), // Recommended camera adjustments

    // Comparison Method
    comparisonMethod: varchar('comparison_method', { length: 50 })
      .$type<'manual' | 'ai_vision' | 'structural_similarity' | 'perceptual_hash'>()
      .default('ai_vision'),

    // Processing Info
    processingTime: integer('processing_time'), // milliseconds
    aiModel: varchar('ai_model', { length: 100 }), // "gpt-4-vision", "claude-3-opus"

    // Status
    status: varchar('status', { length: 20 })
      .$type<'pending' | 'processing' | 'completed' | 'failed'>()
      .default('pending'),

    // Metadata
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ccapi_comparison_results_user_id_idx').on(table.userId),
    sceneIdIdx: index('ccapi_comparison_results_scene_id_idx').on(table.sceneId),
    realPhotoIdIdx: index('ccapi_comparison_results_real_photo_id_idx').on(table.realPhotoId),
    statusIdx: index('ccapi_comparison_results_status_idx').on(table.status),
  }),
);

export type CcapiComparisonResult = typeof ccapiComparisonResults.$inferSelect;
export type InsertCcapiComparisonResult = typeof ccapiComparisonResults.$inferInsert;

/**
 * CCAPI Live Sessions
 * Track active shooting sessions
 */
export const ccapiLiveSessions = pgTable(
  'ccapi_live_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),

    // References
    shotListId: uuid('shot_list_id').notNull(),
    cameraId: uuid('camera_id').notNull(),
    connectionId: uuid('connection_id').notNull(),

    // Session Info
    sessionName: varchar('session_name', { length: 255 }).notNull(),
    location: varchar('location', { length: 255 }),

    // Progress Tracking
    currentShotIndex: integer('current_shot_index').default(0),
    totalShots: integer('total_shots').notNull(),
    photosTaken: integer('photos_taken').default(0),

    // Session Status
    status: varchar('status', { length: 20 })
      .$type<'preparing' | 'active' | 'paused' | 'completed' | 'cancelled'>()
      .default('preparing'),

    // Timing
    startedAt: timestamp('started_at'),
    pausedAt: timestamp('paused_at'),
    resumedAt: timestamp('resumed_at'),
    completedAt: timestamp('completed_at'),
    duration: integer('duration'), // seconds (excluding pauses)

    // Performance Stats
    averageTimePerShot: integer('average_time_per_shot'), // seconds
    totalCommands: integer('total_commands').default(0),
    errorsEncountered: integer('errors_encountered').default(0),

    // Live View
    liveViewEnabled: boolean('live_view_enabled').default(false),
    liveViewUrl: text('live_view_url'),

    // Notes
    sessionNotes: text('session_notes'),

    // Metadata
    metadata: jsonb('metadata'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userIdIdx: index('ccapi_live_sessions_user_id_idx').on(table.userId),
    shotListIdIdx: index('ccapi_live_sessions_shot_list_id_idx').on(table.shotListId),
    statusIdx: index('ccapi_live_sessions_status_idx').on(table.status),
  }),
);

export type CcapiLiveSession = typeof ccapiLiveSessions.$inferSelect;
export type InsertCcapiLiveSession = typeof ccapiLiveSessions.$inferInsert;

// ============================================================================
// Relations
// ============================================================================

export const ccapiCamerasRelations = relations(ccapiCameras, ({ many }) => ({
  connections: many(ccapiConnections),
  photos: many(ccapiRealPhotos),
}));

export const ccapiConnectionsRelations = relations(ccapiConnections, ({ one }) => ({
  camera: one(ccapiCameras, {
    fields: [ccapiConnections.cameraId],
    references: [ccapiCameras.id],
  }),
}));

export const ccapiShotListsRelations = relations(ccapiShotLists, ({ many }) => ({
  photos: many(ccapiRealPhotos),
  sessions: many(ccapiLiveSessions),
}));

export const ccapiRealPhotosRelations = relations(ccapiRealPhotos, ({ one }) => ({
  shotList: one(ccapiShotLists, {
    fields: [ccapiRealPhotos.shotListId],
    references: [ccapiShotLists.id],
  }),
  camera: one(ccapiCameras, {
    fields: [ccapiRealPhotos.cameraId],
    references: [ccapiCameras.id],
  }),
  comparisonResult: one(ccapiComparisonResults, {
    fields: [ccapiRealPhotos.comparisonResultId],
    references: [ccapiComparisonResults.id],
  }),
}));

export const ccapiComparisonResultsRelations = relations(ccapiComparisonResults, ({ one }) => ({
  realPhoto: one(ccapiRealPhotos, {
    fields: [ccapiComparisonResults.realPhotoId],
    references: [ccapiRealPhotos.id],
  }),
}));
