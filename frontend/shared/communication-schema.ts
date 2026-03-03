/**
 * CreatorHub Norge - Universal Communication Schema
 * Complete integration of chat, email, notifications, and meeting communications
 */

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  serial,
  index,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

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
export const communicationMessages = pgTable('communication_messages', {
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
  parentMessageId: varchar('parent_message_id').references(
    (): AnyPgColumn => communicationMessages.id,
  ), // For threads
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

// Relations
export const communicationChannelsRelations = relations(communicationChannels, ({ many }) => ({
  messages: many(communicationMessages),
  participants: many(communicationParticipants),
  integrations: many(communicationIntegrations),
}));

export const communicationMessagesRelations = relations(communicationMessages, ({ one, many }) => ({
  channel: one(communicationChannels, {
    fields: [communicationMessages.channelId],
    references: [communicationChannels.id],
  }),
  parentMessage: one(communicationMessages, {
    fields: [communicationMessages.parentMessageId],
    references: [communicationMessages.id],
  }),
  replies: many(communicationMessages),
  reactions: many(messageReactions),
  attachments: many(messageAttachments),
}));

export const communicationParticipantsRelations = relations(
  communicationParticipants,
  ({ one }) => ({
    channel: one(communicationChannels, {
      fields: [communicationParticipants.channelId],
      references: [communicationChannels.id],
    }),
  }),
);

// Type exports
export type CommunicationChannel = typeof communicationChannels.$inferSelect;
export type InsertCommunicationChannel = typeof communicationChannels.$inferInsert;
export type CommunicationMessage = typeof communicationMessages.$inferSelect;
export type InsertCommunicationMessage = typeof communicationMessages.$inferInsert;
export type CommunicationParticipant = typeof communicationParticipants.$inferSelect;
export type InsertCommunicationParticipant = typeof communicationParticipants.$inferInsert;
export type CommunicationIntegration = typeof communicationIntegrations.$inferSelect;
export type InsertCommunicationIntegration = typeof communicationIntegrations.$inferInsert;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = typeof messageReactions.$inferInsert;
export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type InsertMessageAttachment = typeof messageAttachments.$inferInsert;
export type CommunicationTemplate = typeof communicationTemplates.$inferSelect;
export type InsertCommunicationTemplate = typeof communicationTemplates.$inferInsert;

// Zod schemas
export const insertCommunicationChannelSchema = createInsertSchema(communicationChannels);
export const insertCommunicationMessageSchema = createInsertSchema(communicationMessages);
export const insertCommunicationParticipantSchema = createInsertSchema(communicationParticipants);
export const insertCommunicationIntegrationSchema = createInsertSchema(communicationIntegrations);
export const insertMessageReactionSchema = createInsertSchema(messageReactions);
export const insertMessageAttachmentSchema = createInsertSchema(messageAttachments);
export const insertCommunicationTemplateSchema = createInsertSchema(communicationTemplates);

// Inferred types
export type InsertCommunicationChannelType = z.infer<typeof insertCommunicationChannelSchema>;
export type InsertCommunicationMessageType = z.infer<typeof insertCommunicationMessageSchema>;
export type InsertCommunicationParticipantType = z.infer<
  typeof insertCommunicationParticipantSchema
>;
export type InsertCommunicationIntegrationType = z.infer<
  typeof insertCommunicationIntegrationSchema
>;
export type InsertMessageReactionType = z.infer<typeof insertMessageReactionSchema>;
export type InsertMessageAttachmentType = z.infer<typeof insertMessageAttachmentSchema>;
export type InsertCommunicationTemplateType = z.infer<typeof insertCommunicationTemplateSchema>;

// ⚠️ CHAT & COMMUNICATION PROTOKOLL: Type-safe message validation med Zod schemas
export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string().min(1, 'Message cannot be empty').max(10000, 'Message too long'),
  messageType: z.enum(['text', 'image', 'file', 'system', 'video', 'audio']),
  timestamp: z.string().datetime(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  metadata: z
    .object({
      platform: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high']).default('normal'),
      encryption: z.boolean().default(true),
      gdprCompliant: z.boolean().default(true),
      backupStatus: z.enum(['pending', 'backed_up', 'failed']).default('pending'),
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().uuid(),
        filename: z.string(),
        fileSize: z.number().max(50 * 1024 * 1024, 'File too large (max 50MB)'),
        mimeType: z.string(),
        virusScanStatus: z.enum(['pending', 'clean', 'infected', 'failed']).default('pending'),
        uploadedAt: z.string().datetime(),
        downloadUrl: z.string().url().optional(),
      }),
    )
    .default([]),
});

// File attachment validation schema with virus scanning
export const fileAttachmentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1, 'Filename required').max(255, 'Filename too long'),
  fileSize: z
    .number()
    .min(1, 'File cannot be empty')
    .max(50 * 1024 * 1024, 'File too large (max 50MB)'),
  mimeType: z.string().refine((type) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/wav',
    ];
    return allowedTypes.includes(type);
  }, 'Unsupported file type'),
  virusScanStatus: z.enum(['pending', 'clean', 'infected', 'failed']).default('pending'),
  uploadedAt: z.string().datetime(),
  uploadedBy: z.string(),
  downloadUrl: z.string().url().optional(),
  checksums: z
    .object({
      md5: z.string().optional(),
      sha256: z.string().optional(),
    })
    .optional(),
});

// WebSocket message schema for real-time communication
export const webSocketMessageSchema = z.object({
  type: z.enum([
    'chat_message',
    'typing_indicator',
    'presence_update',
    'file_upload',
    'system_notification',
  ]),
  payload: z.any(),
  timestamp: z.string().datetime(),
  userId: z.string(),
  conversationId: z.string().optional(),
});

// Type-safe message types for chat protocol compliance
export type ChatMessageType = z.infer<typeof chatMessageSchema>;
export type ChatAttachmentType = z.infer<typeof fileAttachmentSchema>;
export type WebSocketMessageType = z.infer<typeof webSocketMessageSchema>;
