import { pgTable, text, varchar, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// Chat conversations table
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

// Chat messages table
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

// Relations
export const chatConversationsRelations = relations(chatConversations, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

// Zod schemas
export const insertChatConversationSchema = createInsertSchema(chatConversations);
export const insertChatMessageSchema = createInsertSchema(chatMessages);

// TypeScript types
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Validation schemas
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
