/**
 * Pro Tools API Routes
 * 
 * Endpoints for Pro Tools session management, playhead sync, and comments
 * - GET    /api/protools/sessions                    - List user's Pro Tools sessions
 * - POST   /api/protools/sessions                    - Create new session
 * - GET    /api/protools/sessions/:sessionId         - Get session details
 * - PUT    /api/protools/sessions/:sessionId          - Update session
 * - DELETE /api/protools/sessions/:sessionId          - Delete session
 * - POST   /api/protools/sessions/:sessionId/playhead - Update playhead position
 * - GET    /api/protools/sessions/:sessionId/comments - Get comments for session
 * - POST   /api/protools/sessions/:sessionId/comments - Create comment with timecode
 * - GET    /api/protools/sessions/:sessionId/metadata - Get session metadata
 * - POST   /api/protools/sessions/:sessionId/metadata - Update metadata
 */

import type { Response } from 'express';
import { Router } from 'express';
import { db } from '../db';
import {
  proToolsSessions,
  proToolsParticipants,
  proToolsTracks,
  proToolsEvents,
  proToolsChat,
  type ProToolsSession,
  type InsertProToolsSession,
} from '../../shared/protools-schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: Response, next: any) => {
  const userId = req.session?.user?.id || req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
};

router.use(requireAuth);

// ==================== SESSION MANAGEMENT ====================

/**
 * GET /api/protools/sessions
 * List user's Pro Tools sessions
 */
router.get('/sessions', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { status, sessionType, limit = 50 } = req.query;

    const conditions = [eq(proToolsSessions.ownerId, userId)];
    
    if (status) {
      conditions.push(eq(proToolsSessions.status, status as any));
    }
    if (sessionType) {
      conditions.push(eq(proToolsSessions.sessionType, sessionType as any));
    }

    const sessions = await db
      .select()
      .from(proToolsSessions)
      .where(and(...conditions))
      .orderBy(desc(proToolsSessions.lastActivity))
      .limit(parseInt(limit as string));

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching Pro Tools sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

/**
 * POST /api/protools/sessions
 * Create new Pro Tools session
 */
router.post('/sessions', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const {
      sessionName,
      projectId,
      sessionType,
      genre,
      tempo,
      timeSignature,
      keySignature,
      sessionVersion,
      sampleRate,
      bitDepth,
      sessionFormat,
      isCollaborative,
      maxParticipants,
    } = req.body;

    if (!sessionName || !sessionType) {
      return res.status(400).json({ success: false, error: 'Session name and type are required' });
    }

    const newSession: InsertProToolsSession = {
      id: uuidv4(),
      sessionName,
      ownerId: userId,
      projectId: projectId || null,
      sessionType: sessionType as any,
      genre: genre || null,
      tempo: tempo || null,
      timeSignature: timeSignature || '4/4',
      keySignature: keySignature || null,
      sessionVersion: sessionVersion || null,
      sampleRate: sampleRate || 48000,
      bitDepth: bitDepth || 24,
      sessionFormat: sessionFormat || 'ptx',
      isCollaborative: isCollaborative || false,
      maxParticipants: maxParticipants || 4,
      status: 'active',
    };

    const [session] = await db
      .insert(proToolsSessions)
      .values(newSession)
      .returning();

    // Create owner as participant
    await db.insert(proToolsParticipants).values({
      id: uuidv4(),
      sessionId: session.id,
      userId: userId,
      role: 'owner',
      permissions: {
        canEdit: true,
        canRecord: true,
        canMix: true,
        canBounce: true,
        canInviteOthers: true,
        trackAccess: [],
      },
      isOnline: true,
    });

    // Log session start event
    await db.insert(proToolsEvents).values({
      id: uuidv4(),
      sessionId: session.id,
      userId: userId,
      eventType: 'session_start',
      eventData: {},
    });

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating Pro Tools session:', error);
    res.status(500).json({ success: false, error: 'Failed to create session' });
  }
});

/**
 * GET /api/protools/sessions/:sessionId
 * Get session details with tracks and participants
 */
router.get('/sessions/:sessionId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;

    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(and(
        eq(proToolsSessions.id, sessionId),
        eq(proToolsSessions.ownerId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Get participants
    const participants = await db
      .select()
      .from(proToolsParticipants)
      .where(eq(proToolsParticipants.sessionId, sessionId));

    // Get tracks
    const tracks = await db
      .select()
      .from(proToolsTracks)
      .where(eq(proToolsTracks.sessionId, sessionId))
      .orderBy(proToolsTracks.trackNumber);

    res.json({
      success: true,
      data: {
        ...session,
        participants,
        tracks,
      },
    });
  } catch (error) {
    console.error('Error fetching Pro Tools session:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch session' });
  }
});

/**
 * PUT /api/protools/sessions/:sessionId
 * Update session
 */
router.put('/sessions/:sessionId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const updateData = req.body;

    // Check ownership
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(and(
        eq(proToolsSessions.id, sessionId),
        eq(proToolsSessions.ownerId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const [updated] = await db
      .update(proToolsSessions)
      .set({
        ...updateData,
        updatedAt: new Date(),
        lastActivity: new Date(),
      })
      .where(eq(proToolsSessions.id, sessionId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating Pro Tools session:', error);
    res.status(500).json({ success: false, error: 'Failed to update session' });
  }
});

/**
 * DELETE /api/protools/sessions/:sessionId
 * Delete session
 */
router.delete('/sessions/:sessionId', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;

    // Check ownership
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(and(
        eq(proToolsSessions.id, sessionId),
        eq(proToolsSessions.ownerId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Delete related data (cascade would be better, but explicit for safety)
    await db.delete(proToolsChat).where(eq(proToolsChat.sessionId, sessionId));
    await db.delete(proToolsEvents).where(eq(proToolsEvents.sessionId, sessionId));
    await db.delete(proToolsTracks).where(eq(proToolsTracks.sessionId, sessionId));
    await db.delete(proToolsParticipants).where(eq(proToolsParticipants.sessionId, sessionId));
    await db.delete(proToolsSessions).where(eq(proToolsSessions.id, sessionId));

    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting Pro Tools session:', error);
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

// ==================== PLAYHEAD SYNC ====================

/**
 * POST /api/protools/sessions/:sessionId/playhead
 * Update playhead position (from Pro Tools plugin or web app)
 */
router.post('/sessions/:sessionId/playhead', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const { timecode, transportPosition, isPlaying } = req.body;

    // Verify session exists and user has access
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(eq(proToolsSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Check if user is participant
    const [participant] = await db
      .select()
      .from(proToolsParticipants)
      .where(and(
        eq(proToolsParticipants.sessionId, sessionId),
        eq(proToolsParticipants.userId, userId)
      ))
      .limit(1);

    if (!participant && session.ownerId !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Update session last activity
    await db
      .update(proToolsSessions)
      .set({ lastActivity: new Date() })
      .where(eq(proToolsSessions.id, sessionId));

    // Log playhead update event
    await db.insert(proToolsEvents).values({
      id: uuidv4(),
      sessionId: sessionId,
      userId: userId,
      eventType: 'mix_change',
      eventData: {
        playheadUpdate: true,
        timecode,
        transportPosition,
        isPlaying,
      },
      sessionTimecode: timecode || null,
      transportPosition: transportPosition || null,
    });

    res.json({
      success: true,
      data: {
        timecode,
        transportPosition,
        isPlaying,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error updating playhead:', error);
    res.status(500).json({ success: false, error: 'Failed to update playhead' });
  }
});

// ==================== COMMENTS ====================

/**
 * GET /api/protools/sessions/:sessionId/comments
 * Get comments for session (from showcase or Pro Tools chat)
 */
router.get('/sessions/:sessionId/comments', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const { timecode, trackId } = req.query;

    // Verify access
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(eq(proToolsSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const conditions = [eq(proToolsChat.sessionId, sessionId)];
    
    if (timecode) {
      conditions.push(eq(proToolsChat.timecodeReference, timecode as string));
    }
    if (trackId) {
      conditions.push(eq(proToolsChat.trackReference, trackId as string));
    }

    const comments = await db
      .select()
      .from(proToolsChat)
      .where(and(...conditions))
      .orderBy(desc(proToolsChat.createdAt));

    res.json({ success: true, data: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

/**
 * POST /api/protools/sessions/:sessionId/comments
 * Create comment with timecode
 */
router.post('/sessions/:sessionId/comments', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const {
      content,
      messageType = 'timecode_comment',
      timecodeReference,
      trackReference,
      audioUrl,
      audioDuration,
      fileUrl,
      fileName,
      fileSize,
    } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    // Verify access
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(eq(proToolsSessions.id, sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const [comment] = await db
      .insert(proToolsChat)
      .values({
        id: uuidv4(),
        sessionId: sessionId,
        userId: userId,
        messageType: messageType as any,
        content,
        timecodeReference: timecodeReference || null,
        trackReference: trackReference || null,
        audioUrl: audioUrl || null,
        audioDuration: audioDuration || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
      })
      .returning();

    // Log comment event
    await db.insert(proToolsEvents).values({
      id: uuidv4(),
      sessionId: sessionId,
      userId: userId,
      eventType: 'chat_message',
      eventData: {
        commentId: comment.id,
        message: content,
        timecode: timecodeReference,
      },
      sessionTimecode: timecodeReference || null,
    });

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

// ==================== METADATA ====================

/**
 * GET /api/protools/sessions/:sessionId/metadata
 * Get session metadata
 */
router.get('/sessions/:sessionId/metadata', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;

    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(and(
        eq(proToolsSessions.id, sessionId),
        eq(proToolsSessions.ownerId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Get tracks for metadata
    const tracks = await db
      .select()
      .from(proToolsTracks)
      .where(eq(proToolsTracks.sessionId, sessionId));

    res.json({
      success: true,
      data: {
        sessionName: session.sessionName,
        sessionType: session.sessionType,
        genre: session.genre,
        tempo: session.tempo,
        timeSignature: session.timeSignature,
        keySignature: session.keySignature,
        sampleRate: session.sampleRate,
        bitDepth: session.bitDepth,
        sessionFormat: session.sessionFormat,
        trackCount: tracks.length,
        tracks: tracks.map(t => ({
          name: t.trackName,
          type: t.trackType,
          duration: t.duration,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metadata' });
  }
});

/**
 * POST /api/protools/sessions/:sessionId/metadata
 * Update session metadata
 */
router.post('/sessions/:sessionId/metadata', async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const metadata = req.body;

    // Check ownership
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(and(
        eq(proToolsSessions.id, sessionId),
        eq(proToolsSessions.ownerId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const [updated] = await db
      .update(proToolsSessions)
      .set({
        ...metadata,
        updatedAt: new Date(),
        lastActivity: new Date(),
      })
      .where(eq(proToolsSessions.id, sessionId))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ success: false, error: 'Failed to update metadata' });
  }
});

export default router;























