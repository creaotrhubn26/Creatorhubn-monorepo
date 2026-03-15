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
import type { Request, Response } from 'express';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import * as schema from '../migrations/schema.js';
import crypto from 'crypto';

type DB = NodePgDatabase<typeof schema>;

export function createCommunicationRouter(db: DB): Router {
  const router = Router();

  const toNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeChannelId = (raw: unknown): string => {
    const parsed = toNonEmptyString(raw);
    if (!parsed) return `chat-${crypto.randomUUID()}`;
    if (parsed.startsWith('spaces/')) return parsed.replace('spaces/', '');
    return parsed;
  };

  const normalizeFeedbackType = (category: unknown): 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux' => {
    const normalized = toNonEmptyString(category)?.toLowerCase();
    if (normalized === 'bug' || normalized === 'technical_issue') return 'bug';
    if (normalized === 'feature_request' || normalized === 'feature') return 'feature';
    if (normalized === 'ui_ux' || normalized === 'design') return 'ui_ux';
    if (normalized === 'usability') return 'usability';
    return 'general';
  };

  const normalizePriority = (priority: unknown): 'low' | 'medium' | 'high' | 'critical' => {
    const normalized = toNonEmptyString(priority)?.toLowerCase();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
      return normalized;
    }
    return 'medium';
  };

  const normalizeStatus = (status: unknown): 'open' | 'in_progress' | 'resolved' | 'closed' => {
    const normalized = toNonEmptyString(status)?.toLowerCase();
    if (normalized === 'open' || normalized === 'in_progress' || normalized === 'resolved' || normalized === 'closed') {
      return normalized;
    }
    return 'open';
  };

  const ensureChannelExists = async (channelId: string, channelName?: string, channelType: string = 'chat') => {
    const existing = await db
      .select({ id: schema.communicationChannels.id })
      .from(schema.communicationChannels)
      .where(eq(schema.communicationChannels.id, channelId))
      .limit(1);

    if (existing.length > 0) return;

    const now = new Date().toISOString();
    await db.insert(schema.communicationChannels).values({
      id: channelId,
      name: channelName || `Chat ${channelId}`,
      type: channelType,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  };

  const persistMessage = async (params: {
    channelId: string;
    senderId: string;
    content: string;
    messageType: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }) => {
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = params.timestamp || now;

    await db.insert(schema.communicationMessages).values({
      id: messageId,
      channelId: params.channelId,
      senderId: params.senderId,
      messageType: params.messageType,
      content: params.content,
      metadata: params.metadata || {},
      isRead: false,
      isPriority: false,
      isSystemGenerated: false,
      createdAt,
      updatedAt: now,
    });

    await db
      .update(schema.communicationChannels)
      .set({ updatedAt: now })
      .where(eq(schema.communicationChannels.id, params.channelId));

    return {
      id: messageId,
      timestamp: createdAt,
    };
  };

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

  const handleSendCommunicationMessage = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const content = toNonEmptyString(payload.content) || toNonEmptyString(payload.message);
      const conversationId = normalizeChannelId(payload.conversationId || payload.contactId || payload.channelId);
      const senderId =
        toNonEmptyString(req.headers['x-user-id']) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'anonymous';

      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      await ensureChannelExists(conversationId, `Chat ${conversationId}`, 'chat');
      const persisted = await persistMessage({
        channelId: conversationId,
        senderId,
        content,
        messageType: 'text',
      });

      res.json({
        success: true,
        message: {
          id: persisted.id,
          channelId: conversationId,
          senderId,
          content,
          timestamp: persisted.timestamp,
          type: 'text',
          status: 'sent',
        },
      });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  };

  // ─── POST /api/communication/messages ─────────────────────
  router.post('/api/communication/messages', async (req, res) => {
    await handleSendCommunicationMessage(req, res);
  });

  // Compatibility alias used by older chat widgets
  router.post('/api/communication/send-message', async (req, res) => {
    await handleSendCommunicationMessage(req, res);
  });

  // ─── POST /api/chat/messages ──────────────────────────────
  // Used by UniversalChatWidget (sends full ChatMessage object)
  router.post('/api/chat/messages', async (req, res) => {
    try {
      const msg = (req.body || {}) as Record<string, unknown>;
      const senderId =
        toNonEmptyString(msg.senderId) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'anonymous';
      const channelId = normalizeChannelId(msg.conversationId || 'general');
      const content = toNonEmptyString(msg.content);

      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      await ensureChannelExists(channelId, `Chat ${channelId}`, 'chat');
      const persisted = await persistMessage({
        channelId,
        senderId,
        messageType: toNonEmptyString(msg.messageType) || 'text',
        content,
        metadata: typeof msg.metadata === 'object' && msg.metadata !== null
          ? msg.metadata as Record<string, unknown>
          : {},
        timestamp: toNonEmptyString(msg.timestamp) || undefined,
      });

      res.json({ success: true, id: persisted.id });
    } catch (error) {
      console.error('Error saving chat message:', error);
      res.status(500).json({ error: 'Failed to save message' });
    }
  });

  const handleSendEmail = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const conversationId = normalizeChannelId(payload.conversationId || payload.chatId || payload.threadId);
      const content = toNonEmptyString(payload.message) || toNonEmptyString(payload.content);
      const senderId =
        toNonEmptyString(req.headers['x-user-id']) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'anonymous';
      const recipient = toNonEmptyString(payload.to);
      const subject = toNonEmptyString(payload.subject) || 'Melding fra CreatorHub';

      if (!content) {
        return res.status(400).json({ error: 'message is required' });
      }

      await ensureChannelExists(conversationId, `Email ${conversationId}`, 'email');
      const persisted = await persistMessage({
        channelId: conversationId,
        senderId,
        content,
        messageType: 'email',
        metadata: {
          to: recipient,
          subject,
          deliveryStatus: 'queued',
          transport: 'creatorhub-email',
        },
      });

      res.json({
        success: true,
        message: {
          id: persisted.id,
          conversationId,
          senderId,
          to: recipient,
          subject,
          content,
          timestamp: persisted.timestamp,
          status: 'queued',
        },
      });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email' });
    }
  };

  // ─── POST /api/communication/email/send ───────────────────
  router.post('/api/communication/email/send', async (req, res) => {
    await handleSendEmail(req, res);
  });

  // Compatibility alias used by UniversalChatWidget
  router.post('/api/emails/send', async (req, res) => {
    await handleSendEmail(req, res);
  });

  // ─── POST /api/helpdesk/tickets ───────────────────────────
  router.post('/api/helpdesk/tickets', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const title = toNonEmptyString(payload.title);
      const description = toNonEmptyString(payload.description);
      const userId =
        toNonEmptyString(payload.userId) ||
        toNonEmptyString(req.headers['x-user-id']) ||
        'anonymous';
      const userEmail =
        toNonEmptyString(payload.userEmail) ||
        toNonEmptyString(req.headers['x-user-email']);
      const profession = toNonEmptyString(payload.profession) || 'general';
      const dashboardFeature = toNonEmptyString(payload.dashboardFeature) || 'chat-widget';
      const rawCategory = toNonEmptyString(payload.category) || 'question';

      if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
      }

      const ticketId = crypto.randomUUID();
      const now = new Date().toISOString();
      const isAnonymous = userId === 'anonymous' || Boolean(payload.isAnonymous);

      await db.insert(schema.prototypeFeedback).values({
        id: ticketId,
        userId,
        userEmail: userEmail || null,
        userName: toNonEmptyString(payload.userName),
        profession,
        dashboardType: dashboardFeature,
        feedbackType: normalizeFeedbackType(rawCategory),
        title,
        description,
        rating: Number.isFinite(Number(payload.rating)) ? Number(payload.rating) : 5,
        priority: normalizePriority(payload.priority),
        component: 'helpdesk',
        tags: [rawCategory, dashboardFeature],
        isAnonymous,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        ticket: {
          id: ticketId,
          title,
          description,
          category: rawCategory,
          priority: normalizePriority(payload.priority),
          status: 'open',
          userId,
          userEmail,
          createdAt: now,
        },
      });
    } catch (error) {
      console.error('Error creating helpdesk ticket:', error);
      res.status(500).json({ error: 'Failed to create helpdesk ticket' });
    }
  });

  // ─── Google Chat bridge routes (database-backed fallback) ─
  router.get('/api/google/chat/spaces', async (_req, res) => {
    try {
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          description: schema.communicationChannels.description,
          type: schema.communicationChannels.type,
          updatedAt: schema.communicationChannels.updatedAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(50);

      const spaces = await Promise.all(
        channels.map(async (channel) => {
          const last = await db
            .select({
              content: schema.communicationMessages.content,
              createdAt: schema.communicationMessages.createdAt,
            })
            .from(schema.communicationMessages)
            .where(eq(schema.communicationMessages.channelId, channel.id))
            .orderBy(desc(schema.communicationMessages.createdAt))
            .limit(1);

          return {
            name: `spaces/${channel.id}`,
            displayName: channel.name || `Space ${channel.id}`,
            spaceType: 'SPACE',
            spaceDetails: {
              description: channel.description || '',
            },
            lastMessage: last[0]
              ? {
                  text: String(last[0].content || ''),
                  createTime: last[0].createdAt,
                }
              : null,
            metadata: {
              source: 'creatorhub-fallback',
              type: channel.type,
              updatedAt: channel.updatedAt,
            },
          };
        })
      );

      res.json({ spaces });
    } catch (error) {
      console.error('Error fetching google chat spaces:', error);
      res.status(500).json({ error: 'Failed to fetch Google Chat spaces' });
    }
  });

  router.get('/api/google/chat/messages', async (req, res) => {
    try {
      const rawSpace = toNonEmptyString(req.query.space || req.query.threadId || req.query.channelId);
      if (!rawSpace) {
        return res.status(400).json({ error: 'space is required' });
      }
      const channelId = normalizeChannelId(rawSpace);
      const limit = Number.parseInt(String(req.query.limit || '100'), 10) || 100;

      const messages = await db
        .select({
          id: schema.communicationMessages.id,
          senderId: schema.communicationMessages.senderId,
          content: schema.communicationMessages.content,
          messageType: schema.communicationMessages.messageType,
          isRead: schema.communicationMessages.isRead,
          deliveredAt: schema.communicationMessages.deliveredAt,
          createdAt: schema.communicationMessages.createdAt,
        })
        .from(schema.communicationMessages)
        .where(eq(schema.communicationMessages.channelId, channelId))
        .orderBy(schema.communicationMessages.createdAt)
        .limit(limit);

      res.json({
        messages: messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          content: message.content,
          timestamp: message.createdAt,
          type: message.messageType || 'text',
          status: message.isRead ? 'read' : message.deliveredAt ? 'delivered' : 'sent',
        })),
      });
    } catch (error) {
      console.error('Error fetching google chat messages:', error);
      res.status(500).json({ error: 'Failed to fetch Google Chat messages' });
    }
  });

  const handleGoogleSend = async (req: Request, res: Response) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const rawSpace = toNonEmptyString(payload.space) || toNonEmptyString(payload.threadId) || toNonEmptyString(payload.conversationId);
      if (!rawSpace) {
        return res.status(400).json({ error: 'space is required' });
      }
      const channelId = normalizeChannelId(rawSpace);
      const content = toNonEmptyString(payload.message) || toNonEmptyString(payload.content);
      const senderId =
        toNonEmptyString(req.headers['x-user-id']) ||
        toNonEmptyString(req.headers['x-user-email']) ||
        'google-chat-user';

      if (!content) {
        return res.status(400).json({ error: 'message is required' });
      }

      await ensureChannelExists(channelId, `Google Space ${channelId}`, 'team');
      const persisted = await persistMessage({
        channelId,
        senderId,
        content,
        messageType: 'text',
        metadata: {
          source: 'google-chat-bridge',
        },
      });

      res.json({
        success: true,
        messageId: persisted.id,
        space: `spaces/${channelId}`,
      });
    } catch (error) {
      console.error('Error sending google chat message:', error);
      res.status(500).json({ error: 'Failed to send Google Chat message' });
    }
  };

  router.post('/api/google/chat/send', async (req, res) => {
    await handleGoogleSend(req, res);
  });

  router.post('/api/google/chat/send-message', async (req, res) => {
    await handleGoogleSend(req, res);
  });

  router.post('/api/google/chat/create-space', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const displayName = toNonEmptyString(payload.displayName) || 'Nytt Google Chat-rom';
      const normalizedSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const channelId = `google-${normalizedSlug || 'space'}-${Date.now()}`;
      const now = new Date().toISOString();

      await db.insert(schema.communicationChannels).values({
        id: channelId,
        name: displayName,
        type: 'team',
        description: toNonEmptyString(payload.description),
        settings: {
          platform: 'google-chat',
          spaceType: toNonEmptyString(payload.spaceType) || 'SPACE',
          threaded: Boolean(payload.threaded),
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        space: {
          name: `spaces/${channelId}`,
          displayName,
          spaceType: toNonEmptyString(payload.spaceType) || 'SPACE',
        },
      });
    } catch (error) {
      console.error('Error creating google chat space:', error);
      res.status(500).json({ error: 'Failed to create Google Chat space' });
    }
  });

  router.post('/api/google/chat/create-project-space', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const projectId = toNonEmptyString(payload.projectId) || crypto.randomUUID();
      const profession = toNonEmptyString(payload.profession) || 'project';
      const displayName = `Prosjekt ${projectId}`;
      const channelId = `gproject-${projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      const now = new Date().toISOString();

      await db.insert(schema.communicationChannels).values({
        id: channelId,
        name: displayName,
        type: 'team',
        description: `Google project space for ${profession}`,
        settings: {
          platform: 'google-chat',
          projectId,
          profession,
          userId: toNonEmptyString(payload.userId),
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({
        success: true,
        spaceId: `spaces/${channelId}`,
        spaceName: displayName,
        channelId,
      });
    } catch (error) {
      console.error('Error creating google project space:', error);
      res.status(500).json({ error: 'Failed to create Google project space' });
    }
  });

  router.get('/api/google-chat/project-spaces/current-user', async (_req, res) => {
    try {
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          description: schema.communicationChannels.description,
          settings: schema.communicationChannels.settings,
          updatedAt: schema.communicationChannels.updatedAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(30);

      const spaces = channels.map((channel) => {
        const settings = (channel.settings || {}) as Record<string, unknown>;
        const projectId = toNonEmptyString(settings.projectId) || channel.id;
        const projectName = toNonEmptyString(settings.projectName) || channel.name || 'Prosjekt';
        const clientName = toNonEmptyString(settings.clientName) || 'Kunde';

        return {
          spaced: `spaces/${channel.id}`,
          spaceName: channel.name || `Space ${channel.id}`,
          projectType: toNonEmptyString(settings.projectType) || 'team',
          status: 'active',
          projectName,
          clientName,
          lastActivity: channel.updatedAt || new Date().toISOString(),
          unreadCount: 0,
          milestones: [],
          memberCount: Number(settings.memberCount || 2),
          projectId,
        };
      });

      res.json({ success: true, spaces });
    } catch (error) {
      console.error('Error fetching project spaces:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch project spaces' });
    }
  });

  router.get('/api/google/chat/threads', async (_req, res) => {
    try {
      const channels = await db
        .select({
          id: schema.communicationChannels.id,
          name: schema.communicationChannels.name,
          settings: schema.communicationChannels.settings,
          updatedAt: schema.communicationChannels.updatedAt,
        })
        .from(schema.communicationChannels)
        .where(eq(schema.communicationChannels.isActive, true))
        .orderBy(desc(schema.communicationChannels.updatedAt))
        .limit(30);

      const threads = channels.map((channel) => {
        const settings = (channel.settings || {}) as Record<string, unknown>;
        return {
          id: channel.id,
          subject: channel.name || 'Chat-tråd',
          participants: Array.isArray(settings.participants)
            ? settings.participants.filter((value): value is string => typeof value === 'string')
            : [],
          lastMessage: toNonEmptyString(settings.lastMessage) || '',
          lastActivity: channel.updatedAt || new Date().toISOString(),
          unreadCount: Number(settings.unreadCount || 0),
          status: 'active',
        };
      });

      res.json(threads);
    } catch (error) {
      console.error('Error fetching chat threads:', error);
      res.status(500).json({ error: 'Failed to fetch chat threads' });
    }
  });

  router.post('/api/google/chat/create-thread', async (req, res) => {
    try {
      const payload = (req.body || {}) as Record<string, unknown>;
      const threadId = `thread-${Date.now()}`;
      const emailId = toNonEmptyString(payload.emailId) || 'email';
      const now = new Date().toISOString();

      await db.insert(schema.communicationChannels).values({
        id: threadId,
        name: `Thread ${emailId}`,
        type: 'chat',
        settings: {
          platform: 'google-chat',
          sourceEmailId: emailId,
          participants: [],
          unreadCount: 0,
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      res.status(201).json({ success: true, threadId });
    } catch (error) {
      console.error('Error creating chat thread:', error);
      res.status(500).json({ error: 'Failed to create chat thread' });
    }
  });

  // ─── POST /api/chat/analyze-message ───────────────────────
  router.post('/api/chat/analyze-message', async (req, res) => {
    const payload = (req.body || {}) as Record<string, unknown>;
    const content = toNonEmptyString(payload.content) || '';
    const lower = content.toLowerCase();

    const suggestions: string[] = [];
    if (lower.includes('pris') || lower.includes('tilbud') || lower.includes('kost')) {
      suggestions.push('Takk for interessen! Jeg kan sende et konkret pristilbud basert på behovene deres.');
    }
    if (lower.includes('når') || lower.includes('dato') || lower.includes('ledig')) {
      suggestions.push('Jeg kan sjekke tilgjengelighet med en gang. Hvilken dato vurderer dere?');
    }
    if (suggestions.length === 0) {
      suggestions.push('Takk for meldingen! Jeg følger opp så raskt jeg kan.');
      suggestions.push('Kan du dele litt mer kontekst, så kan jeg gi et mer presist svar?');
    }

    const sentiment = lower.includes('takk') || lower.includes('flott') ? 'positive' : 'neutral';
    const priority = lower.includes('haster') || lower.includes('urgent') ? 'high' : 'normal';

    res.json({ suggestions, sentiment, priority });
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
