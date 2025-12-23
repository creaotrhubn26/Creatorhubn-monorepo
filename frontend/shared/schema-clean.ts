import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  decimal,
  real,
  pgEnum,
  foreignKey,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// User types
export const userTypeEnum = pgEnum('user_type', [
  'couple',
  'creator',
  'music_producer',
  'partner',
  'admin',
]);
export const accessLevelEnum = pgEnum('access_level', ['admin', 'public', 'invited', 'restricted']);
export const adminRoleEnum = pgEnum('admin_role', [
  'super_admin',
  'content_manager',
  'instructor_manager',
  'vendor_manager',
]);

// Users table
export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  email: varchar('email').unique(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  profileImageUrl: varchar('profile_image_url'),
  password: varchar('password'),
  userType: userTypeEnum('user_type'),
  adminRole: adminRoleEnum('admin_role'),
  accessLevel: accessLevelEnum('access_level'),
  invitedBy: varchar('invited_by'),
  invitedAt: timestamp('invited_at'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  permissions: text('permissions').array(),
});

// Collaborative Mood Board System - Enhanced for Real-Time Editing
export const moodBoards = pgTable('mood_boards', {
  id: varchar('id').primaryKey(),
  title: varchar('title').notNull(),
  description: text('description'),
  projectId: varchar('project_id'), // Optional connection to projects
  ownerId: varchar('owner_id').notNull(),

  // Collaboration settings
  isPublic: boolean('is_public').default(false),
  allowComments: boolean('allow_comments').default(true),
  allowEditing: boolean('allow_editing').default(false), // Only owner can edit by default

  // Board configuration
  backgroundColor: varchar('background_color').default('#ffffff'),
  gridSize: integer('grid_size').default(20), // Snap-to-grid size
  boardWidth: integer('board_width').default(1920),
  boardHeight: integer('board_height').default(1080),

  // Metadata
  tags: text('tags').array(),
  category: varchar('category'), // "wedding", "corporate", "personal", etc.
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
});

// Items on the mood board (images, text, shapes, etc.)
export const moodBoardItems = pgTable('mood_board_items', {
  id: varchar('id').primaryKey(),
  boardId: varchar('board_id').notNull(),

  // Item type and content
  type: varchar('type').notNull(), // "image", "text", "shape", "video", "audio", "document"
  content: jsonb('content').notNull(), // Type-specific content (URL, text, shape properties, etc.)

  // Position and appearance
  x: real('x').notNull().default(0),
  y: real('y').notNull().default(0),
  width: real('width').notNull().default(200),
  height: real('height').notNull().default(200),
  rotation: real('rotation').default(0),
  zIndex: integer('z_index').default(0),

  // Visual properties
  opacity: real('opacity').default(1),
  borderColor: varchar('border_color'),
  borderWidth: integer('border_width').default(0),
  backgroundColor: varchar('background_color'),

  // Metadata
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Locking for collaborative editing
  lockedBy: varchar('locked_by'), // User currently editing this item
  lockedAt: timestamp('locked_at'),
  lockExpiry: timestamp('lock_expiry'), // Auto-unlock after period of inactivity
});

// Board collaborators and permissions
export const moodBoardCollaborators = pgTable('mood_board_collaborators', {
  id: varchar('id').primaryKey(),
  boardId: varchar('board_id').notNull(),
  userId: varchar('user_id').notNull(),

  // Permission levels
  role: varchar('role').notNull().default('viewer'), // "owner", "editor", "commenter", "viewer"
  canEdit: boolean('can_edit').default(false),
  canComment: boolean('can_comment').default(true),
  canInvite: boolean('can_invite').default(false),
  canDelete: boolean('can_delete').default(false),

  // Invitation details
  invitedBy: varchar('invited_by'),
  invitedAt: timestamp('invited_at').defaultNow(),
  joinedAt: timestamp('joined_at'),

  // Activity tracking
  lastActiveAt: timestamp('last_active_at'),
});

// Comments and feedback system
export const moodBoardComments = pgTable('mood_board_comments', {
  id: varchar('id').primaryKey(),
  boardId: varchar('board_id').notNull(),
  itemId: varchar('item_id'), // Optional - comment on specific item vs. general board comment

  // Comment content
  content: text('content').notNull(),
  authorId: varchar('author_id').notNull(),

  // Position (for positioned comments)
  x: real('x'),
  y: real('y'),

  // Comment threading
  parentCommentId: varchar('parent_comment_id'), // For replies

  // Status
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: varchar('resolved_by'),
  resolvedAt: timestamp('resolved_at'),

  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Real-time activity tracking
export const moodBoardActivity = pgTable('mood_board_activity', {
  id: varchar('id').primaryKey(),
  boardId: varchar('board_id').notNull(),
  userId: varchar('user_id').notNull(),

  // Activity details
  action: varchar('action').notNull(), // "joined", "left", "edited", "commented", "added_item", "deleted_item", etc.
  itemId: varchar('item_id'), // Related item if applicable
  details: jsonb('details'), // Additional action-specific data

  // Session tracking
  sessionId: varchar('session_id'),

  // Timestamp
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relations
export const moodBoardsRelations = relations(moodBoards, ({ many, one }) => ({
  items: many(moodBoardItems),
  collaborators: many(moodBoardCollaborators),
  comments: many(moodBoardComments),
  activities: many(moodBoardActivity),
  owner: one(users, {
    fields: [moodBoards.ownerId],
    references: [users.id],
  }),
}));

export const moodBoardItemsRelations = relations(moodBoardItems, ({ one, many }) => ({
  board: one(moodBoards, {
    fields: [moodBoardItems.boardId],
    references: [moodBoards.id],
  }),
  comments: many(moodBoardComments),
  creator: one(users, {
    fields: [moodBoardItems.createdBy],
    references: [users.id],
  }),
}));

export const moodBoardCollaboratorsRelations = relations(moodBoardCollaborators, ({ one }) => ({
  board: one(moodBoards, {
    fields: [moodBoardCollaborators.boardId],
    references: [moodBoards.id],
  }),
  user: one(users, {
    fields: [moodBoardCollaborators.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [moodBoardCollaborators.invitedBy],
    references: [users.id],
  }),
}));

export const moodBoardCommentsRelations = relations(moodBoardComments, ({ one, many }) => ({
  board: one(moodBoards, {
    fields: [moodBoardComments.boardId],
    references: [moodBoards.id],
  }),
  item: one(moodBoardItems, {
    fields: [moodBoardComments.itemId],
    references: [moodBoardItems.id],
  }),
  author: one(users, {
    fields: [moodBoardComments.authorId],
    references: [users.id],
  }),
  parentComment: one(moodBoardComments, {
    fields: [moodBoardComments.parentCommentId],
    references: [moodBoardComments.id],
  }),
  replies: many(moodBoardComments),
}));

export const moodBoardActivityRelations = relations(moodBoardActivity, ({ one }) => ({
  board: one(moodBoards, {
    fields: [moodBoardActivity.boardId],
    references: [moodBoards.id],
  }),
  user: one(users, {
    fields: [moodBoardActivity.userId],
    references: [users.id],
  }),
  item: one(moodBoardItems, {
    fields: [moodBoardActivity.itemId],
    references: [moodBoardItems.id],
  }),
}));

// Type exports for the collaborative mood board system
export type MoodBoard = typeof moodBoards.$inferSelect;
export type InsertMoodBoard = typeof moodBoards.$inferInsert;
export type MoodBoardItem = typeof moodBoardItems.$inferSelect;
export type InsertMoodBoardItem = typeof moodBoardItems.$inferInsert;
export type MoodBoardCollaborator = typeof moodBoardCollaborators.$inferSelect;
export type InsertMoodBoardCollaborator = typeof moodBoardCollaborators.$inferInsert;
export type MoodBoardComment = typeof moodBoardComments.$inferSelect;
export type InsertMoodBoardComment = typeof moodBoardComments.$inferInsert;
export type MoodBoardActivity = typeof moodBoardActivity.$inferSelect;
export type InsertMoodBoardActivity = typeof moodBoardActivity.$inferInsert;

// User types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Zod schemas for validation
export const insertMoodBoardSchema = createInsertSchema(moodBoards);
export const insertMoodBoardItemSchema = createInsertSchema(moodBoardItems);
export const insertMoodBoardCollaboratorSchema = createInsertSchema(moodBoardCollaborators);
export const insertMoodBoardCommentSchema = createInsertSchema(moodBoardComments);
export const insertMoodBoardActivitySchema = createInsertSchema(moodBoardActivity);
