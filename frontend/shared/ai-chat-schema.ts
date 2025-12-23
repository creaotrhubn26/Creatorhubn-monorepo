import { pgTable, text, varchar, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

// AI Chat conversations table (for OpenAI and other AI chats)
export const aiChatConversations = pgTable('ai_chat_conversations', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull(),
  title: varchar('title'), // Auto-generated from first message
  model: varchar('model').default('gpt-4'), // AI model used
  systemPrompt: text('system_prompt'), // Custom system prompt if any
  totalTokens: integer('total_tokens').default(0), // Track token usage
  messageCount: integer('message_count').default(0),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// AI Chat messages table
export const aiChatMessages = pgTable('ai_chat_messages', {
  id: varchar('id').primaryKey(),
  conversationId: varchar('conversation_id').notNull(),
  role: varchar('role').notNull(), // 'system', 'user', 'assistant'
  content: text('content').notNull(),
  tokens: integer('tokens'), // Token count for this message
  attachedFiles: jsonb('attached_files'), // Array of file paths attached with @ mentions
  model: varchar('model'), // Model used for this response (for assistant messages)
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const aiChatConversationsRelations = relations(aiChatConversations, ({ many }) => ({
  messages: many(aiChatMessages),
}));

export const aiChatMessagesRelations = relations(aiChatMessages, ({ one }) => ({
  conversation: one(aiChatConversations, {
    fields: [aiChatMessages.conversationId],
    references: [aiChatConversations.id],
  }),
}));

// Zod schemas
export const insertAiChatConversationSchema = createInsertSchema(aiChatConversations);
export const insertAiChatMessageSchema = createInsertSchema(aiChatMessages);

// TypeScript types
export type AiChatConversation = typeof aiChatConversations.$inferSelect;
export type InsertAiChatConversation = typeof aiChatConversations.$inferInsert;
export type AiChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAiChatMessage = typeof aiChatMessages.$inferInsert;

// Validation schemas
export const createAiConversationSchema = z.object({
  title: z.string().optional(),
  model: z.string().default('gpt-4'),
  systemPrompt: z.string().optional(),
});

export const sendAiMessageSchema = z.object({
  conversationId: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
  attachedFiles: z
    .array(
      z.object({
        path: z.string(),
        content: z.string().optional(),
      }),
    )
    .optional(),
});
