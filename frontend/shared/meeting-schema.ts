import {
  type AnyPgColumn,
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  date,
  time,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ⚠️ MEETING PROTOKOLL: Type-safe meeting validation schemas
export const meetingWorkspaceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().min(1, 'User ID required'),
  title: z.string().min(1, 'Title required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
    .default('#ffffff'),
  theme: z.enum(['light', 'dark', 'creative']).default('light'),
  isPublic: z.boolean().default(false),
  allowComments: z.boolean().default(true),
  allowEditing: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  category: z.enum(['project', 'team', 'client', 'personal']).optional(),
  participants: z
    .array(
      z.object({
        userId: z.string(),
        email: z.string().email(),
        role: z.enum(['owner', 'editor', 'viewer', 'commenter']),
        joinedAt: z.string().datetime(),
        isOnline: z.boolean().default(false),
        lastSeen: z.string().datetime().optional(),
      }),
    )
    .default([]),
  realTimeState: z
    .object({
      activeUsers: z.array(z.string()).default([]),
      currentActivities: z
        .array(
          z.object({
            userId: z.string(),
            activity: z.enum(['viewing', 'editing', 'commenting', 'presenting']),
            timestamp: z.string().datetime(),
            elementId: z.string().optional(),
          }),
        )
        .default([]),
      lockStatus: z
        .object({
          isLocked: z.boolean().default(false),
          lockedBy: z.string().optional(),
          lockedAt: z.string().datetime().optional(),
        })
        .default({ isLocked: false }),
    })
    .default({
      activeUsers: [],
      currentActivities: [],
      lockStatus: { isLocked: false },
    }),
});

// WebSocket message schema for real-time meeting collaboration
export const meetingWebSocketSchema = z.object({
  type: z.enum([
    'workspace_join',
    'workspace_leave',
    'workspace_update',
    'participant_join',
    'participant_leave',
    'cursor_move',
    'user_activity',
    'workspace_lock',
    'workspace_unlock',
    'meeting_start',
    'meeting_end',
    'google_service_sync',
    'file_upload',
  ]),
  payload: z.any(),
  timestamp: z.string().datetime(),
  userId: z.string(),
  workspaceId: z.string().uuid(),
  metadata: z
    .object({
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      sessionId: z.string().optional(),
    })
    .optional(),
});

// Meeting session management schema
export const meetingSessionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  hostUserId: z.string(),
  title: z.string().min(1, 'Meeting title required'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'active', 'ended', 'cancelled']),
  participants: z.array(
    z.object({
      userId: z.string(),
      joinedAt: z.string().datetime().optional(),
      leftAt: z.string().datetime().optional(),
      role: z.enum(['host', 'presenter', 'participant', 'observer']),
      permissions: z
        .object({
          canShare: z.boolean().default(false),
          canEdit: z.boolean().default(false),
          canComment: z.boolean().default(true),
          canRecord: z.boolean().default(false),
        })
        .default({
          canShare: false,
          canEdit: false,
          canComment: true,
          canRecord: false,
        }),
    }),
  ),
  googleMeetLink: z.string().url().optional(),
  recordingUrl: z.string().url().optional(),
  settings: z
    .object({
      isRecorded: z.boolean().default(false),
      allowScreenShare: z.boolean().default(true),
      requireAuth: z.boolean().default(true),
      maxParticipants: z.number().min(1).max(100).default(25),
    })
    .default({
      isRecorded: false,
      allowScreenShare: true,
      requireAuth: true,
      maxParticipants: 25,
    }),
});

// Type exports for meeting protocol compliance
export type MeetingWorkspaceType = z.infer<typeof meetingWorkspaceSchema>;
export type MeetingWebSocketType = z.infer<typeof meetingWebSocketSchema>;
export type MeetingSessionType = z.infer<typeof meetingSessionSchema>;

// Meeting Workspaces (like Milanote boards)
export const meetingWorkspaces = pgTable('meeting_workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id').notNull(), // Owner of the workspace
  title: varchar('title').notNull(),
  description: text('description'),

  // Visual customization like Milanote
  backgroundColor: varchar('background_color').default('#ffffff'),
  backgroundImage: varchar('background_image'),
  theme: varchar('theme').default('light'), // light, dark, creative

  // Collaboration settings
  isPublic: boolean('is_public').default(false),
  allowComments: boolean('allow_comments').default(true),
  allowEditing: boolean('allow_editing').default(false),

  // Organization
  tags: jsonb('tags').$type<string[]>().default([]),
  category: varchar('category'), // project, team, client, personal

  // Position and layout (for workspace thumbnails)
  layout: jsonb('layout')
    .$type<{
      columns: number;
      gridSize: string;
      zoom: number;
    }>()
    .default({
      columns: 12,
      gridSize: 'medium',
      zoom: 100,
    }),

  isArchived: boolean('is_archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Meeting Notes (like Milanote notes/cards)
export const meetingNotes = pgTable('meeting_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => meetingWorkspaces.id, {
    onDelete: 'cascade',
  }),
  userId: varchar('user_id').notNull(), // Creator of the note
  creatorId: varchar('creator_id').notNull(), // Creator identifier for API compatibility

  // Note content
  title: varchar('title'),
  content: text('content'),
  noteType: varchar('note_type').notNull().default('text'), // text, image, file, link, task, meeting_agenda, action_item

  // Visual properties (like Milanote)
  position: jsonb('position')
    .$type<{
      x: number;
      y: number;
      z: number; // z-index for layering
    }>()
    .notNull()
    .default({ x: 0, y: 0, z: 0 }),

  size: jsonb('size')
    .$type<{
      width: number;
      height: number;
    }>()
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

  // Special properties based on note type
  metadata: jsonb('metadata')
    .$type<{
      // For image notes
      imageUrl?: string;
      imageCaption?: string;

      // For file notes
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;

      // For link notes
      linkUrl?: string;
      linkTitle?: string;
      linkDescription?: string;
      linkThumbnail?: string;

      // For task notes
      isCompleted?: boolean;
      priority?: 'low' | 'medium' | 'high';
      dueDate?: string;
      assignedTo?: string;

      // For meeting agenda
      meetingDate?: string;
      meetingTime?: string;
      attendees?: string[];
      duration?: number;
    }>()
    .default({}),

  // Meeting-specific fields for compatibility
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

  // AI-powered features
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

  // Client visibility control - CRITICAL for photographer-client communication
  isClientVisible: boolean('is_client_visible').default(false),

  // Legacy compatibility
  positionX: integer('position_x').default(0),
  positionY: integer('position_y').default(0),
  width: integer('width').default(200),
  height: integer('height').default(150),
  color: varchar('color').default('#ffeb3b'),
  createdBy: varchar('created_by').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Meeting Connections (like Milanote lines/arrows)
export const meetingConnections = pgTable('meeting_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => meetingWorkspaces.id, {
    onDelete: 'cascade',
  }),

  fromNoteId: uuid('from_note_id').references(() => meetingNotes.id, {
    onDelete: 'cascade',
  }),
  toNoteId: uuid('to_note_id').references(() => meetingNotes.id, {
    onDelete: 'cascade',
  }),

  // Visual properties
  style: jsonb('style')
    .$type<{
      color: string;
      thickness: number;
      lineType: 'straight' | 'curved' | 'arrow';
      dashPattern?: string;
    }>()
    .default({
      color: '#666666',
      thickness: 2,
      lineType: 'straight',
    }),

  // Connection metadata
  label: varchar('label'),
  connectionType: varchar('connection_type'), // relates_to, leads_to, depends_on, follows

  createdAt: timestamp('created_at').defaultNow(),
});

// Meeting Templates (predefined workspace layouts)
export const meetingTemplates = pgTable('meeting_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name').notNull(),
  description: text('description'),
  category: varchar('category').notNull(), // standup, retrospective, planning, brainstorm, client_meeting

  // Template structure
  templateData: jsonb('template_data')
    .$type<{
      workspace: any;
      notes: any[];
      connections?: any[];
    }>()
    .notNull(),

  // Usage tracking
  useCount: integer('use_count').default(0),

  // Template metadata
  isPublic: boolean('is_public').default(true),
  createdBy: varchar('created_by'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Workspace Collaborators
export const workspaceCollaborators = pgTable(
  'workspace_collaborators',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => meetingWorkspaces.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id').notNull(),

    role: varchar('role').notNull().default('viewer'), // owner, editor, commenter, viewer

    // Permissions
    canEdit: boolean('can_edit').default(false),
    canComment: boolean('can_comment').default(true),
    canShare: boolean('can_share').default(false),
    canDelete: boolean('can_delete').default(false),

    invitedBy: varchar('invited_by'),
    invitedAt: timestamp('invited_at').defaultNow(),
    acceptedAt: timestamp('accepted_at'),

    isActive: boolean('is_active').default(true),
  },
  (table) => ({
    uniqueWorkspaceUser: unique().on(table.workspaceId, table.userId),
  }),
);

// Comments on notes (like Milanote comments)
export const noteComments = pgTable('note_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  noteId: uuid('note_id').references(() => meetingNotes.id, {
    onDelete: 'cascade',
  }),
  userId: varchar('user_id').notNull(),

  content: text('content').notNull(),

  // Comment positioning (for visual comments)
  position: jsonb('position').$type<{
    x: number;
    y: number;
  }>(),

  // Threading
  parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => noteComments.id, {
    onDelete: 'cascade',
  }),

  // Status
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: varchar('resolved_by'),
  resolvedAt: timestamp('resolved_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Meeting Sessions (actual meetings linked to workspaces)
export const meetingSessions = pgTable('meeting_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => meetingWorkspaces.id, {
    onDelete: 'cascade',
  }),

  title: varchar('title').notNull(),
  description: text('description'),

  // Meeting scheduling
  scheduledDate: date('scheduled_date'),
  scheduledTime: time('scheduled_time'),
  duration: integer('duration_minutes').default(60),
  timezone: varchar('timezone').default('Europe/Oslo'),

  // Meeting details
  meetingType: varchar('meeting_type').default('internal'), // internal, client, standup, review, planning
  location: varchar('location'), // physical location or meeting link
  meetingUrl: varchar('meeting_url'), // Zoom, Teams, etc.

  // Attendees
  organizer: varchar('organizer').notNull(),
  requiredAttendees: jsonb('required_attendees').$type<string[]>().default([]),
  optionalAttendees: jsonb('optional_attendees').$type<string[]>().default([]),

  // Meeting status
  status: varchar('status').default('scheduled'), // scheduled, in_progress, completed, cancelled

  // Recording and artifacts
  recordingUrl: varchar('recording_url'),
  transcriptUrl: varchar('transcript_url'),

  // Meeting outcomes
  summary: text('summary'),
  actionItems: jsonb('action_items')
    .$type<
      Array<{
        id: string;
        description: string;
        assignedTo: string;
        dueDate: string;
        status: 'pending' | 'in_progress' | 'completed';
      }>
    >()
    .default([]),

  decisions: jsonb('decisions')
    .$type<
      Array<{
        id: string;
        description: string;
        rationale: string;
        decidedBy: string;
        decidedAt: string;
      }>
    >()
    .default([]),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Meeting Attendance Tracking
export const meetingAttendance = pgTable(
  'meeting_attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id').references(() => meetingSessions.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id').notNull(),

    status: varchar('status').notNull(), // attending, declined, tentative, no_response
    joinedAt: timestamp('joined_at'),
    leftAt: timestamp('left_at'),

    // Notes from attendee
    attendeeNotes: text('attendee_notes'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueSessionUser: unique().on(table.sessionId, table.userId),
  }),
);

// Workspace Activity Log (for collaboration history)
export const workspaceActivity = pgTable(
  'workspace_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => meetingWorkspaces.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id').notNull(),

    action: varchar('action').notNull(), // created, updated, deleted, moved, commented, shared
    entityType: varchar('entity_type').notNull(), // workspace, note, connection, comment
    entityId: varchar('entity_id'),

    details: jsonb('details').$type<{
      previousValue?: any;
      newValue?: any;
      description?: string;
    }>(),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    workspaceActivityIdx: index('idx_workspace_activity').on(table.workspaceId, table.createdAt),
  }),
);

// Workspace Favorites
export const workspaceFavorites = pgTable(
  'workspace_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').references(() => meetingWorkspaces.id, {
      onDelete: 'cascade',
    }),
    userId: varchar('user_id').notNull(),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueUserWorkspace: unique().on(table.userId, table.workspaceId),
  }),
);

// Type exports
export type MeetingWorkspace = typeof meetingWorkspaces.$inferSelect;
export type InsertMeetingWorkspace = typeof meetingWorkspaces.$inferInsert;

export type MeetingNote = typeof meetingNotes.$inferSelect;
export type InsertMeetingNote = typeof meetingNotes.$inferInsert;

export type MeetingConnection = typeof meetingConnections.$inferSelect;
export type InsertMeetingConnection = typeof meetingConnections.$inferInsert;

export type MeetingTemplate = typeof meetingTemplates.$inferSelect;
export type InsertMeetingTemplate = typeof meetingTemplates.$inferInsert;

export type MeetingSession = typeof meetingSessions.$inferSelect;
export type InsertMeetingSession = typeof meetingSessions.$inferInsert;

export type WorkspaceCollaborator = typeof workspaceCollaborators.$inferSelect;
export type InsertWorkspaceCollaborator = typeof workspaceCollaborators.$inferInsert;

export type NoteComment = typeof noteComments.$inferSelect;
export type InsertNoteComment = typeof noteComments.$inferInsert;

// Zod schemas
export const insertMeetingWorkspaceSchema = createInsertSchema(meetingWorkspaces);
export const insertMeetingNoteSchema = createInsertSchema(meetingNotes);
export const insertMeetingConnectionSchema = createInsertSchema(meetingConnections);
export const insertMeetingSessionSchema = createInsertSchema(meetingSessions);
export const insertWorkspaceCollaboratorSchema = createInsertSchema(workspaceCollaborators);
export const insertNoteCommentSchema = createInsertSchema(noteComments);

// Meeting payload interface for API
export interface MeetingPayload {
  title: string;
  startISO: string;
  endISO: string;
  attendees: string[];
  notes?: string;
}

export function createMeetingPayload(input: Partial<MeetingPayload>): MeetingPayload {
  const title = input.title?.trim() || 'Untitled meeting';
  const startISO = input.startISO ?? new Date().toISOString();
  const endISO = input.endISO ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const attendees = Array.isArray(input.attendees) ? input.attendees : [];
  return { title, startISO, endISO, attendees, notes: input.notes };
}
