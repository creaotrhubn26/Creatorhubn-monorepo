/**
 * CreatorHub Norge - Google Chat Integration Schema
 * Links Google Chat spaces directly to project IDs for seamless communication
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
import { z } from 'zod';

// Google Chat Spaces linked to projects
export const googleChatSpaces = pgTable('google_chat_spaces', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Direct project connection
  projectId: varchar('project_id').notNull(), // References any project ID from various project tables
  projectType: varchar('project_type').notNull(), // bryllup, business, music, video, etc.
  projectName: varchar('project_name').notNull(),
  clientName: varchar('client_name').notNull(),

  // Google Chat space details
  googleSpaceId: varchar('google_space_id').notNull().unique(), // Actual Google Chat space ID
  spaceName: varchar('space_name').notNull(),
  spaceUrl: varchar('space_url').notNull(),
  displayName: varchar('display_name').notNull(),
  description: text('description'),

  // Space settings
  spaceType: varchar('space_type').default('SPACE'), // SPACE, GROUP_CHAT, DIRECT_MESSAGE
  accessType: varchar('access_type').default('PRIVATE'), // PRIVATE, RESTRICTED, PUBLIC
  historyState: varchar('history_state').default('HISTORY_ON'), // HISTORY_ON, HISTORY_OFF
  threadedReplies: boolean('threaded_replies').default(true),
  allowExternalMembers: boolean('allow_external_members').default(true),

  // Integration settings
  googleDriveEnabled: boolean('google_drive_enabled').default(true),
  googleMeetEnabled: boolean('google_meet_enabled').default(true),
  calendarEnabled: boolean('calendar_enabled').default(true),
  notificationsEnabled: boolean('notifications_enabled').default(true),

  // Space activity
  memberCount: integer('member_count').default(1),
  lastActivity: timestamp('last_activity').defaultNow(),
  unreadCount: integer('unread_count').default(0),

  // Status tracking
  status: varchar('status').default('active').$type<'active' | 'archived' | 'deleted'>(),
  isClientInvited: boolean('is_client_invited').default(false),
  clientJoinedAt: timestamp('client_joined_at'),

  // Created by
  createdBy: varchar('created_by').notNull(), // User ID who created the space
  profession: varchar('profession')
    .$type<'photographer' | 'videographer' | 'music_producer' | 'vendor'>()
    .notNull(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Google Chat Space Members
export const googleChatSpaceMembers = pgTable('google_chat_space_members', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  spaceId: varchar('space_id')
    .references(() => googleChatSpaces.id)
    .notNull(),

  // Member details
  memberEmail: varchar('member_email').notNull(),
  memberName: varchar('member_name'),
  memberType: varchar('member_type')
    .$type<'owner' | 'manager' | 'member' | 'client' | 'collaborator'>()
    .notNull(),

  // Google specific IDs
  googleUserId: varchar('google_user_id'), // Google user ID
  googleMembershipId: varchar('google_membership_id'), // Google Chat membership ID

  // Member status
  status: varchar('status').default('active').$type<'active' | 'invited' | 'left' | 'removed'>(),
  invitedAt: timestamp('invited_at').defaultNow(),
  joinedAt: timestamp('joined_at'),
  lastSeenAt: timestamp('last_seen_at'),

  // Permissions
  canSendMessages: boolean('can_send_messages').default(true),
  canShareFiles: boolean('can_share_files').default(true),
  canAddMembers: boolean('can_add_members').default(false),
  canManageSpace: boolean('can_manage_space').default(false),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Project Milestone Notifications sent to Google Chat
export const googleChatNotifications = pgTable('google_chat_notifications', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  spaceId: varchar('space_id')
    .references(() => googleChatSpaces.id)
    .notNull(),
  projectId: varchar('project_id').notNull(),

  // Notification details
  notificationType: varchar('notification_type')
    .$type<
      | 'project_created'
      | 'client_approved'
      | 'shooting_scheduled'
      | 'files_uploaded'
      | 'editing_started'
      | 'client_review'
      | 'project_delivered'
      | 'payment_received'
      | 'milestone_completed'
      | 'deadline_reminder'
      | 'custom'
    >()
    .notNull(),
  title: varchar('title').notNull(),
  message: text('message').notNull(),
  details: text('details'),

  // Google Chat message details
  googleMessageId: varchar('google_message_id'), // ID from Google Chat API
  threadKey: varchar('thread_key'), // For threaded replies

  // Notification metadata
  priority: varchar('priority').default('normal').$type<'low' | 'normal' | 'high' | 'urgent'>(),
  isActionable: boolean('is_actionable').default(false),
  actionUrl: varchar('action_url'),
  actionText: varchar('action_text'),

  // Status tracking
  status: varchar('status')
    .default('sent')
    .$type<'pending' | 'sent' | 'delivered' | 'read' | 'failed'>(),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),

  // Recipients
  recipients: jsonb('recipients').$type<string[]>(), // Array of member emails
  mentionedUsers: jsonb('mentioned_users').$type<string[]>(), // Users @mentioned in the message

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Client Invitations to Google Chat Spaces
export const googleChatInvitations = pgTable('google_chat_invitations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  spaceId: varchar('space_id')
    .references(() => googleChatSpaces.id)
    .notNull(),
  projectId: varchar('project_id').notNull(),

  // Invitation details
  clientEmail: varchar('client_email').notNull(),
  clientName: varchar('client_name'),
  personalMessage: text('personal_message'),

  // Google invite details
  googleInviteId: varchar('google_invite_id'), // Google Chat invitation ID
  inviteUrl: varchar('invite_url').notNull(),
  inviteToken: varchar('invite_token').unique(),

  // Status and timing
  status: varchar('status')
    .default('sent')
    .$type<'sent' | 'delivered' | 'opened' | 'accepted' | 'declined' | 'expired'>(),
  expiresAt: timestamp('expires_at').notNull(),
  sentAt: timestamp('sent_at').defaultNow(),
  openedAt: timestamp('opened_at'),
  acceptedAt: timestamp('accepted_at'),
  declinedAt: timestamp('declined_at'),

  // Metadata
  sentBy: varchar('sent_by').notNull(), // User ID who sent the invitation
  remindersSent: integer('reminders_sent').default(0),
  lastReminderAt: timestamp('last_reminder_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const googleChatSpacesRelations = relations(googleChatSpaces, ({ many }) => ({
  members: many(googleChatSpaceMembers),
  notifications: many(googleChatNotifications),
  invitations: many(googleChatInvitations),
}));

export const googleChatSpaceMembersRelations = relations(googleChatSpaceMembers, ({ one }) => ({
  space: one(googleChatSpaces, {
    fields: [googleChatSpaceMembers.spaceId],
    references: [googleChatSpaces.id],
  }),
}));

export const googleChatNotificationsRelations = relations(googleChatNotifications, ({ one }) => ({
  space: one(googleChatSpaces, {
    fields: [googleChatNotifications.spaceId],
    references: [googleChatSpaces.id],
  }),
}));

export const googleChatInvitationsRelations = relations(googleChatInvitations, ({ one }) => ({
  space: one(googleChatSpaces, {
    fields: [googleChatInvitations.spaceId],
    references: [googleChatSpaces.id],
  }),
}));

// Insert schemas
export const insertGoogleChatSpaceSchema = createInsertSchema(googleChatSpaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoogleChatSpaceMemberSchema = createInsertSchema(googleChatSpaceMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoogleChatNotificationSchema = createInsertSchema(googleChatNotifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoogleChatInvitationSchema = createInsertSchema(googleChatInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertGoogleChatSpace = z.infer<typeof insertGoogleChatSpaceSchema>;
export type GoogleChatSpace = typeof googleChatSpaces.$inferSelect;

export type InsertGoogleChatSpaceMember = z.infer<typeof insertGoogleChatSpaceMemberSchema>;
export type GoogleChatSpaceMember = typeof googleChatSpaceMembers.$inferSelect;

export type InsertGoogleChatNotification = z.infer<typeof insertGoogleChatNotificationSchema>;
export type GoogleChatNotification = typeof googleChatNotifications.$inferSelect;

export type InsertGoogleChatInvitation = z.infer<typeof insertGoogleChatInvitationSchema>;
export type GoogleChatInvitation = typeof googleChatInvitations.$inferSelect;
