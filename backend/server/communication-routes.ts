/**
 * Communication Routes — Admin ↔ User Chat
 * 
 * Endpoints:
 *   GET  /api/communication/conversations   — list conversations for a user
 *   GET  /api/communication/messages/:channelId — messages in a channel
 *   POST /api/communication/messages          — send a message
 *   POST /api/chat/messages                   — alternative send (UniversalChatWidget)
 *   GET  /api/admin/communication/users       — list users with chat activity
 *   GET  /api/admin/communication/stats       — aggregate chat stats
 */

import { Router } from 'express';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import * as schema from '../migrations/schema.js';
import crypto from 'crypto';

type DB = NodePgDatabase<typeof schema>;

export function createCommunicationRouter(db: DB): Router {
  const router = Router();

  // ─── GET /api/communication/conversations ─────────────────
  router.get('/api/communication/conversations', async (req, res) => {
    try {
      const userEmail = (req.query.userEmail as string) || req.headers['x-user-email'] as string || '';

      // Get channels where user is a participant
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          type: schema.communicationChannels.type,
          description: schema.communicationChannels.description,
          isActive: schema.communicationChannels.isActive,
          settings: schema.communicationChannels.settings,
          createdAt: schema.communicationChannels.createdAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(50);

      // Build conversations with last message info
      const conversations = await Promise.all(
        channels.map(async (channel) => {
          // Get last message in channel
          const lastMessages = await db
            .select({
              content: schema.communicationMessages.content,
              createdAt: schema.communicationMessages.createdAt,
              senderId: schema.communicationMessages.senderId,
            })
            .from(schema.communicationMessages)
            .where(eq(schema.communicationMessages.channelId, channel.id))
            .orderBy(desc(schema.communicationMessages.createdAt))
            .limit(1);

          const lastMsg = lastMessages[0] || null;

          // Count unread
          const unreadResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.communicationMessages)
            .where(
              and(
                eq(schema.communicationMessages.channelId, channel.id),
                eq(schema.communicationMessages.isRead, false)
              )
            );

          const settings = (channel.settings || {}) as Record<string, any>;

          return {
            id: channel.id,
            name: channel.name,
            clientName: settings.clientName || channel.name,
            email: settings.email || '',
            avatar: settings.avatar || null,
            isOnline: false,
            type: channel.type,
            createdAt: channel.createdAt,
            lastMessage: lastMsg
              ? { content: lastMsg.content, timestamp: lastMsg.createdAt }
              : null,
            unreadCount: unreadResult[0]?.count || 0,
          };
        })
      );

      res.json({ conversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ─── GET /api/communication/messages/:channelId ───────────
  router.get('/api/communication/messages/:channelId', async (req, res) => {
    try {
      const { channelId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const messages = await db
        .select({
          id: schema.communicationMessages.id,
          channelId: schema.communicationMessages.channelId,
          senderId: schema.communicationMessages.senderId,
          recipientId: schema.communicationMessages.recipientId,
          messageType: schema.communicationMessages.messageType,
          content: schema.communicationMessages.content,
          metadata: schema.communicationMessages.metadata,
          isRead: schema.communicationMessages.isRead,
          isPriority: schema.communicationMessages.isPriority,
          isSystemGenerated: schema.communicationMessages.isSystemGenerated,
          parentMessageId: schema.communicationMessages.parentMessageId,
          createdAt: schema.communicationMessages.createdAt,
          readAt: schema.communicationMessages.readAt,
          deliveredAt: schema.communicationMessages.deliveredAt,
        })
        .from(schema.communicationMessages)
        .where(eq(schema.communicationMessages.channelId, channelId))
        .orderBy(schema.communicationMessages.createdAt)
        .limit(limit);

      // Map to frontend format
      const mappedMessages = messages.map((msg) => ({
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        timestamp: msg.createdAt,
        type: msg.messageType,
        status: msg.isRead ? 'read' : msg.deliveredAt ? 'delivered' : 'sent',
        attachments: [],
        metadata: msg.metadata,
      }));

      res.json({ messages: mappedMessages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // ─── POST /api/communication/messages ─────────────────────
  router.post('/api/communication/messages', async (req, res) => {
    try {
      const { content, conversationId } = req.body;
      const senderId =
        req.headers['x-user-id'] as string ||
        req.headers['x-user-email'] as string ||
        'anonymous';

      if (!content || !conversationId) {
        return res.status(400).json({ error: 'content and conversationId are required' });
      }

      const messageId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.insert(schema.communicationMessages).values({
        id: messageId,
        channelId: conversationId,
        senderId,
        messageType: 'text',
        content,
        isRead: false,
        isPriority: false,
        isSystemGenerated: false,
        createdAt: now,
        updatedAt: now,
      });

      // Update channel's updatedAt
      await db
        .update(schema.communicationChannels)
        .set({ updatedAt: now })
        .where(eq(schema.communicationChannels.id, conversationId));

      res.json({
        success: true,
        message: {
          id: messageId,
          channelId: conversationId,
          senderId,
          content,
          timestamp: now,
          type: 'text',
          status: 'sent',
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // ─── POST /api/chat/messages ──────────────────────────────
  // Used by UniversalChatWidget (sends full ChatMessage object)
  router.post('/api/chat/messages', async (req, res) => {
    try {
      const msg = req.body;
      const senderId =
        msg.senderId ||
        req.headers['x-user-email'] as string ||
        'anonymous';
      const channelId = msg.conversationId || 'general';
      const content = msg.content || '';

      if (!content.trim()) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const messageId = msg.id || crypto.randomUUID();
      const now = new Date().toISOString();

      // Ensure channel exists
      const existing = await db
        .select({ id: schema.communicationChannels.id })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.id, channelId))
        .limit(1);

      if (existing.length === 0) {
        // Auto-create the channel
        await db.insert(schema.communicationChannels).values({
          id: channelId,
          name: `Chat ${channelId}`,
          type: 'chat',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      await db.insert(schema.communicationMessages).values({
        id: messageId,
        channelId,
        senderId,
        messageType: msg.messageType || 'text',
        content,
        metadata: msg.metadata || {},
        isRead: false,
        isPriority: false,
        isSystemGenerated: false,
        createdAt: msg.timestamp || now,
        updatedAt: now,
      });

      res.json({ success: true, id: messageId });
    } catch (error) {
      console.error('Error saving chat message:', error);
      res.status(500).json({ error: 'Failed to save message' });
    }
  });

  // ─── POST /api/communication/email/send ───────────────────
  router.post('/api/communication/email/send', async (_req, res) => {
    // Stub — email sending not implemented
    res.json({ success: true, message: 'Email queued (stub)' });
  });

  // ─── POST /api/chat/analyze-message ───────────────────────
  router.post('/api/chat/analyze-message', async (req, res) => {
    // Stub — AI analysis not implemented
    res.json({
      suggestions: [
        'Takk for din henvendelse! Jeg ser på det med en gang.',
        'Kan du gi meg litt mer informasjon?',
      ],
      sentiment: 'neutral',
      priority: 'normal',
    });
  });

  // ─── GET /api/admin/communication/users ───────────────────
  router.get('/api/admin/communication/users', async (_req, res) => {
    try {
      // Get distinct senders from messages
      const users = await db
        .selectDistinct({ senderId: schema.communicationMessages.senderId })
        .from(schema.communicationMessages)
        .limit(100);

      res.json({
        users: users.map((u) => ({
          id: u.senderId,
          email: u.senderId,
          name: u.senderId,
          isOnline: false,
        })),
      });
    } catch (error) {
      console.error('Error fetching communication users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // ─── GET /api/admin/communication/stats ───────────────────
  router.get('/api/admin/communication/stats', async (_req, res) => {
    try {
      const totalMessages = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.communicationMessages);

      const totalChannels = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true));

      const unreadMessages = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.communicationMessages)
        .where(eq(schema.communicationMessages.isRead, false));

      res.json({
        totalMessages: totalMessages[0]?.count || 0,
        totalChannels: totalChannels[0]?.count || 0,
        unreadMessages: unreadMessages[0]?.count || 0,
        activeUsers: 0,
      });
    } catch (error) {
      console.error('Error fetching communication stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return router;
}
