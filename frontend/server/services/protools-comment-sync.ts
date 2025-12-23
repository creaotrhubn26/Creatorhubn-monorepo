/**
 * Pro Tools Comment Sync Service
 * Bridges comments between showcase items and Pro Tools sessions
 * Maps timecode positions to showcase timestamps
 * Handles bidirectional comment creation
 */

import { db } from '../db';
import { proToolsChat, proToolsSessions } from '../../shared/protools-schema';
import { eq, and } from 'drizzle-orm';

interface ShowcaseComment {
  id: string;
  showcaseItemId: string;
  userId: string;
  userName: string;
  commentText: string;
  timestampSeconds?: number;
  status: 'pending' | 'approved' | 'rejected';
  metadata?: {
    proToolsMarker?: string;
    proToolsRegion?: string;
    proToolsSession?: string;
    syncedAt?: string;
  };
}

interface ProToolsComment {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  timecodeReference?: string;
  trackReference?: string;
  messageType: 'text' | 'audio' | 'file' | 'timecode_comment';
}

/**
 * Convert timecode (SMPTE format: HH:MM:SS:FF) to seconds
 */
export function timecodeToSeconds(timecode: string): number {
  const parts = timecode.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid timecode format. Expected HH:MM:SS:FF');
  }

  const [hours, minutes, seconds, frames] = parts.map(Number);
  const fps = 30; // Default to 30fps, could be made configurable
  
  return hours * 3600 + minutes * 60 + seconds + frames / fps;
}

/**
 * Convert seconds to timecode (SMPTE format)
 */
export function secondsToTimecode(seconds: number, fps: number = 30): string {
  const totalFrames = Math.floor(seconds * fps);
  const hours = Math.floor(totalFrames / (fps * 3600));
  const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
  const secs = Math.floor((totalFrames % (fps * 60)) / fps);
  const frames = totalFrames % fps;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

/**
 * Sync showcase comment to Pro Tools session
 */
export async function syncShowcaseCommentToProTools(
  showcaseComment: ShowcaseComment,
  sessionId: string
): Promise<ProToolsComment> {
  try {
    // Verify session exists
    const [session] = await db
      .select()
      .from(proToolsSessions)
      .where(eq(proToolsSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Pro Tools session not found');
    }

    // Convert timestamp to timecode if available
    let timecodeReference: string | undefined;
    if (showcaseComment.timestampSeconds !== undefined) {
      timecodeReference = secondsToTimecode(showcaseComment.timestampSeconds);
    }

    // Create Pro Tools chat message
    const [proToolsComment] = await db
      .insert(proToolsChat)
      .values({
        id: crypto.randomUUID(),
        sessionId: sessionId,
        userId: showcaseComment.userId,
        messageType: 'timecode_comment',
        content: showcaseComment.commentText,
        timecodeReference: timecodeReference || null,
        trackReference: null, // Could be mapped if track info is available
      })
      .returning();

    // Update showcase comment metadata to mark as synced
    // Note: This would require access to showcase comments table
    // For now, we return the Pro Tools comment

    return {
      id: proToolsComment.id,
      sessionId: proToolsComment.sessionId,
      userId: proToolsComment.userId,
      content: proToolsComment.content,
      timecodeReference: proToolsComment.timecodeReference || undefined,
      trackReference: proToolsComment.trackReference || undefined,
      messageType: proToolsComment.messageType as any,
    };
  } catch (error) {
    console.error('Error syncing showcase comment to Pro Tools:', error);
    throw error;
  }
}

/**
 * Sync Pro Tools comment to showcase item
 */
export async function syncProToolsCommentToShowcase(
  proToolsComment: ProToolsComment,
  showcaseItemId: string
): Promise<ShowcaseComment | null> {
  try {
    // Convert timecode to seconds if available
    let timestampSeconds: number | undefined;
    if (proToolsComment.timecodeReference) {
      timestampSeconds = timecodeToSeconds(proToolsComment.timecodeReference);
    }

    // Note: This would create/update a showcase comment
    // Since we don't have direct access to showcase comments table here,
    // we return the data structure that can be used by the API route
    // The actual insertion should happen in the showcase routes

    return {
      id: crypto.randomUUID(), // Will be set by showcase API
      showcaseItemId,
      userId: proToolsComment.userId,
      userName: '', // Would need to be fetched from users table
      commentText: proToolsComment.content,
      timestampSeconds,
      status: 'pending',
      metadata: {
        proToolsMarker: proToolsComment.id,
        proToolsSession: proToolsComment.sessionId,
        syncedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error syncing Pro Tools comment to showcase:', error);
    throw error;
  }
}

/**
 * Get all comments for a session, formatted for showcase sync
 */
export async function getSessionCommentsForShowcase(sessionId: string): Promise<ProToolsComment[]> {
  try {
    const comments = await db
      .select()
      .from(proToolsChat)
      .where(and(
        eq(proToolsChat.sessionId, sessionId),
        eq(proToolsChat.messageType, 'timecode_comment')
      ));

    return comments.map((comment) => ({
      id: comment.id,
      sessionId: comment.sessionId,
      userId: comment.userId,
      content: comment.content,
      timecodeReference: comment.timecodeReference || undefined,
      trackReference: comment.trackReference || undefined,
      messageType: comment.messageType as any,
    }));
  } catch (error) {
    console.error('Error fetching session comments:', error);
    throw error;
  }
}

/**
 * Sync all comments between showcase and Pro Tools session
 */
export async function syncAllComments(
  showcaseItemId: string,
  sessionId: string,
  showcaseComments: ShowcaseComment[]
): Promise<{
  syncedToProTools: ProToolsComment[];
  syncedToShowcase: ProToolsComment[];
}> {
  try {
    // Get existing Pro Tools comments
    const proToolsComments = await getSessionCommentsForShowcase(sessionId);

    // Sync showcase comments to Pro Tools (if not already synced)
    const syncedToProTools: ProToolsComment[] = [];
    for (const showcaseComment of showcaseComments) {
      // Check if already synced
      const alreadySynced = proToolsComments.some(
        (ptComment) => ptComment.id === showcaseComment.metadata?.proToolsMarker
      );

      if (!alreadySynced) {
        const synced = await syncShowcaseCommentToProTools(showcaseComment, sessionId);
        syncedToProTools.push(synced);
      }
    }

    // Sync Pro Tools comments to showcase (if not already synced)
    const syncedToShowcase: ProToolsComment[] = [];
    for (const proToolsComment of proToolsComments) {
      // Check if already synced (would need to check showcase comments)
      // For now, we'll return all Pro Tools comments that need to be synced
      syncedToShowcase.push(proToolsComment);
    }

    return {
      syncedToProTools,
      syncedToShowcase,
    };
  } catch (error) {
    console.error('Error syncing all comments:', error);
    throw error;
  }
}























