/**
 * CreatorHub Norge - Pro Tools Integration Schema
 * Comprehensive DAW collaboration system for Norwegian music professionals
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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import type { z } from 'zod';

// Pro Tools Sessions - Core collaboration management
export const proToolsSessions = pgTable('protools_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionName: varchar('session_name').notNull(),
  ownerId: varchar('owner_id').notNull(), // references users.id

  // Session metadata
  projectId: uuid('project_id'), // Link to music production project
  sessionType: varchar('session_type')
    .$type<'recording' | 'mixing' | 'mastering' | 'collaboration' | 'remote_session'>()
    .notNull(),
  genre: varchar('genre'),
  tempo: integer('tempo'),
  timeSignature: varchar('time_signature').default('4/4'),
  keySignature: varchar('key_signature'),

  // Pro Tools specific data
  sessionVersion: varchar('session_version'), // Pro Tools version
  sampleRate: integer('sample_rate').default(48000),
  bitDepth: integer('bit_depth').default(24),
  sessionFormat: varchar('session_format').$type<'ptx' | 'pts' | 'ptf'>().default('ptx'),

  // Collaboration settings
  isCollaborative: boolean('is_collaborative').default(false),
  maxParticipants: integer('max_participants').default(4),
  allowRemoteControl: boolean('allow_remote_control').default(false),
  requireApproval: boolean('require_approval').default(true),

  // File management
  sessionFileUrl: text('session_file_url'),
  audioFilesUrl: text('audio_files_url'),
  backupUrl: text('backup_url'),
  totalSizeBytes: integer('total_size_bytes').default(0),

  // Status and workflow
  status: varchar('status')
    .$type<'active' | 'paused' | 'completed' | 'archived' | 'locked'>()
    .default('active'),
  lastActivity: timestamp('last_activity').defaultNow(),

  // Norwegian business compliance
  contractRequired: boolean('contract_required').default(true),
  royaltySplitConfig: jsonb('royalty_split_config')
    .$type<{
      participants: Array<{
        userId: string;
        role: 'producer' | 'artist' | 'songwriter' | 'engineer' | 'musician';
        percentage: number;
        tonoRegistered: boolean;
      }>;
      masteringRights: string;
      publishingRights: string;
    }>()
    .default({ participants: [], masteringRights: '', publishingRights: '' }),

  // Analytics
  playCount: integer('play_count').default(0),
  collaborationHours: decimal('collaboration_hours', {
    precision: 8,
    scale: 2,
  }).default('0'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Pro Tools Participants - Session collaboration management
export const proToolsParticipants = pgTable('protools_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => proToolsSessions.id),
  userId: varchar('user_id').notNull(), // references users.id

  // Participant role and permissions
  role: varchar('role')
    .$type<'owner' | 'co_producer' | 'engineer' | 'musician' | 'guest' | 'observer'>()
    .notNull(),
  permissions: jsonb('permissions')
    .$type<{
      canEdit: boolean;
      canRecord: boolean;
      canMix: boolean;
      canBounce: boolean;
      canInviteOthers: boolean;
      trackAccess: string[]; // Track names or IDs
    }>()
    .notNull(),

  // Connection status
  isOnline: boolean('is_online').default(false),
  lastSeen: timestamp('last_seen'),
  connectionQuality: varchar('connection_quality').$type<'excellent' | 'good' | 'fair' | 'poor'>(),

  // Audio setup
  audioInterface: varchar('audio_interface'),
  monitorLatency: integer('monitor_latency'), // in ms
  bufferSize: integer('buffer_size'),

  // Collaboration metrics
  sessionTime: decimal('session_time', { precision: 8, scale: 2 }).default('0'), // hours
  contributionScore: integer('contribution_score').default(0),

  joinedAt: timestamp('joined_at').defaultNow(),
  leftAt: timestamp('left_at'),
});

// Pro Tools Tracks - Individual track management
export const proToolsTracks = pgTable('protools_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => proToolsSessions.id),

  // Track information
  trackName: varchar('track_name').notNull(),
  trackNumber: integer('track_number').notNull(),
  trackType: varchar('track_type')
    .$type<'audio' | 'midi' | 'aux' | 'master' | 'instrument'>()
    .notNull(),

  // Track settings
  isMuted: boolean('is_muted').default(false),
  isSolo: boolean('is_solo').default(false),
  isRecordEnabled: boolean('is_record_enabled').default(false),
  volume: decimal('volume', { precision: 5, scale: 2 }).default('0'), // dB
  pan: decimal('pan', { precision: 3, scale: 2 }).default('0'), // -1 to 1

  // Audio data
  audioFileUrl: text('audio_file_url'),
  waveformData: jsonb('waveform_data'),
  duration: decimal('duration', { precision: 10, scale: 3 }), // seconds

  // Plugin chain
  pluginChain: jsonb('plugin_chain')
    .$type<
      Array<{
        pluginName: string;
        pluginType: 'eq' | 'compressor' | 'reverb' | 'delay' | 'instrument' | 'other';
        parameters: Record<string, any>;
        bypass: boolean;
      }>
    >()
    .default([]),

  // Collaboration
  lockedBy: varchar('locked_by'), // userId when track is being edited
  lockExpiry: timestamp('lock_expiry'),
  lastEditedBy: varchar('last_edited_by'),
  lastEditedAt: timestamp('last_edited_at'),

  // Norwegian rights management
  performerCredits: jsonb('performer_credits')
    .$type<
      Array<{
        userId: string;
        role: 'primary_artist' | 'featured_artist' | 'musician' | 'vocalist' | 'programmer';
        instrument?: string;
        tonoMemberNumber?: string;
      }>
    >()
    .default([]),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Pro Tools Session Events - Real-time collaboration tracking
export const proToolsEvents = pgTable('protools_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => proToolsSessions.id),
  userId: varchar('user_id').notNull(),

  // Event data
  eventType: varchar('event_type')
    .$type<
      | 'session_start'
      | 'session_end'
      | 'track_record'
      | 'track_edit'
      | 'plugin_add'
      | 'plugin_remove'
      | 'mix_change'
      | 'bounce_create'
      | 'participant_join'
      | 'participant_leave'
      | 'chat_message'
      | 'file_share'
    >()
    .notNull(),

  eventData: jsonb('event_data').$type<{
    trackId?: string;
    pluginName?: string;
    parameter?: string;
    oldValue?: any;
    newValue?: any;
    message?: string;
    fileUrl?: string;
    timestamp?: number;
  }>(),

  // Real-time sync
  sessionTimecode: varchar('session_timecode'), // SMPTE timecode
  transportPosition: decimal('transport_position', { precision: 10, scale: 3 }), // seconds

  createdAt: timestamp('created_at').defaultNow(),
});

// Pro Tools Bounces - Rendered audio management
export const proToolsBounces = pgTable('protools_bounces', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => proToolsSessions.id),
  createdBy: varchar('created_by').notNull(),

  // Bounce settings
  bounceName: varchar('bounce_name').notNull(),
  bounceType: varchar('bounce_type')
    .$type<'stereo_mix' | 'stems' | 'individual_tracks' | 'mastered'>()
    .notNull(),
  audioFormat: varchar('audio_format').$type<'wav' | 'aiff' | 'mp3' | 'flac'>().default('wav'),
  sampleRate: integer('sample_rate').default(48000),
  bitDepth: integer('bit_depth').default(24),

  // File information
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'), // bytes
  duration: decimal('duration', { precision: 10, scale: 3 }), // seconds

  // Collaboration
  isApproved: boolean('is_approved').default(false),
  approvedBy: varchar('approved_by'),
  approvedAt: timestamp('approved_at'),
  downloadCount: integer('download_count').default(0),

  // Norwegian compliance
  isMaster: boolean('is_master').default(false),
  publishingCleared: boolean('publishing_cleared').default(false),
  tonoRegistered: boolean('tono_registered').default(false),

  createdAt: timestamp('created_at').defaultNow(),
});

// Pro Tools Chat - Session communication
export const proToolsChat = pgTable('protools_chat', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => proToolsSessions.id),
  userId: varchar('user_id').notNull(),

  // Message data
  messageType: varchar('message_type')
    .$type<'text' | 'audio' | 'file' | 'timecode_comment'>()
    .default('text'),
  content: text('content').notNull(),

  // Audio messages
  audioUrl: text('audio_url'),
  audioDuration: decimal('audio_duration', { precision: 6, scale: 2 }),

  // File sharing
  fileUrl: text('file_url'),
  fileName: varchar('file_name'),
  fileSize: integer('file_size'),

  // Timecode references
  timecodeReference: varchar('timecode_reference'),
  trackReference: uuid('track_reference'),

  // Message status
  isRead: boolean('is_read').default(false),
  readBy: jsonb('read_by')
    .$type<
      Array<{
        userId: string;
        readAt: string;
      }>
    >()
    .default([]),

  createdAt: timestamp('created_at').defaultNow(),
});

// Zod schemas for validation
export const insertProToolsSessionSchema = createInsertSchema(proToolsSessions);
export const insertProToolsParticipantSchema = createInsertSchema(proToolsParticipants);
export const insertProToolsTrackSchema = createInsertSchema(proToolsTracks);
export const insertProToolsEventSchema = createInsertSchema(proToolsEvents);
export const insertProToolsBounceSchema = createInsertSchema(proToolsBounces);
export const insertProToolsChatSchema = createInsertSchema(proToolsChat);

// TypeScript types
export type ProToolsSession = typeof proToolsSessions.$inferSelect;
export type InsertProToolsSession = z.infer<typeof insertProToolsSessionSchema>;
export type ProToolsParticipant = typeof proToolsParticipants.$inferSelect;
export type InsertProToolsParticipant = z.infer<typeof insertProToolsParticipantSchema>;
export type ProToolsTrack = typeof proToolsTracks.$inferSelect;
export type InsertProToolsTrack = z.infer<typeof insertProToolsTrackSchema>;
export type ProToolsEvent = typeof proToolsEvents.$inferSelect;
export type InsertProToolsEvent = z.infer<typeof insertProToolsEventSchema>;
export type ProToolsBounce = typeof proToolsBounces.$inferSelect;
export type InsertProToolsBounce = z.infer<typeof insertProToolsBounceSchema>;
export type ProToolsChat = typeof proToolsChat.$inferSelect;
export type InsertProToolsChat = z.infer<typeof insertProToolsChatSchema>;
