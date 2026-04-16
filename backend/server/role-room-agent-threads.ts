/**
 * Agent thread persistence helper.
 *
 * Threads are scoped to (projectId, userId). Messages are append-only.
 * Archiving is soft-delete — rows are kept so audit chains stay intact.
 *
 * Every function returns nullable rows or empty arrays on failure; this
 * is advisory storage and must never break the primary agent flow.
 */

import type { Pool } from 'pg';

export interface RoleRoomAgentThreadRow {
  id: string;
  projectId: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  archivedAt: Date | null;
}

export interface RoleRoomAgentMessageRow {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  response: unknown | null;
  createdAt: Date;
}

function mapThread(row: any): RoleRoomAgentThreadRow {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    title: row.title ?? null,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    archivedAt: row.archived_at ?? null,
  };
}

function mapMessage(row: any): RoleRoomAgentMessageRow {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    text: row.text,
    response: row.response ?? null,
    createdAt: row.created_at,
  };
}

export async function createThread(
  pool: Pool,
  projectId: string,
  userId: string,
  title?: string,
): Promise<RoleRoomAgentThreadRow | null> {
  try {
    const result = await pool.query(
      `INSERT INTO role_room_agent_threads (project_id, user_id, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [projectId, userId, title ?? null],
    );
    return result.rows[0] ? mapThread(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function listThreads(
  pool: Pool,
  projectId: string,
  userId: string,
  options?: { includeArchived?: boolean; limit?: number },
): Promise<RoleRoomAgentThreadRow[]> {
  try {
    const limit = Math.min(options?.limit ?? 20, 100);
    const where = options?.includeArchived
      ? 'project_id = $1 AND user_id = $2'
      : 'project_id = $1 AND user_id = $2 AND archived_at IS NULL';
    const result = await pool.query(
      `SELECT * FROM role_room_agent_threads
       WHERE ${where}
       ORDER BY last_active_at DESC
       LIMIT $3`,
      [projectId, userId, limit],
    );
    return result.rows.map(mapThread);
  } catch {
    return [];
  }
}

export async function getThread(
  pool: Pool,
  threadId: string,
  userId: string,
): Promise<{ thread: RoleRoomAgentThreadRow; messages: RoleRoomAgentMessageRow[] } | null> {
  try {
    const threadResult = await pool.query(
      `SELECT * FROM role_room_agent_threads
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [threadId, userId],
    );
    if (!threadResult.rows[0]) return null;

    const messagesResult = await pool.query(
      `SELECT * FROM role_room_agent_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId],
    );
    return {
      thread: mapThread(threadResult.rows[0]),
      messages: messagesResult.rows.map(mapMessage),
    };
  } catch {
    return null;
  }
}

export async function appendMessage(
  pool: Pool,
  input: {
    threadId: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    response?: unknown;
    auditId?: string | null;
  },
): Promise<RoleRoomAgentMessageRow | null> {
  try {
    const result = await pool.query(
      `INSERT INTO role_room_agent_messages (thread_id, role, text, response, audit_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING *`,
      [
        input.threadId,
        input.role,
        input.text,
        input.response != null ? JSON.stringify(input.response) : null,
        input.auditId ?? null,
      ],
    );
    // Bump thread last_active_at — best effort.
    pool
      .query(
        `UPDATE role_room_agent_threads
           SET last_active_at = now()
         WHERE id = $1`,
        [input.threadId],
      )
      .catch(() => {});
    return result.rows[0] ? mapMessage(result.rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Stream checkpoint — append an empty assistant placeholder that later
 * `updateStreamingMessage` calls mutate with the growing text. This lets
 * the runner persist partial output while the SSE is still flowing so a
 * dropped connection still leaves the user with what Claude said so far.
 */
export async function createStreamingPlaceholder(
  pool: Pool,
  input: { threadId: string; initialText?: string },
): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO role_room_agent_messages (thread_id, role, text, response)
       VALUES ($1, 'assistant', $2, $3::jsonb)
       RETURNING id`,
      [
        input.threadId,
        input.initialText ?? '',
        JSON.stringify({ streaming: true, partial: true }),
      ],
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateStreamingMessage(
  pool: Pool,
  input: {
    messageId: string;
    text: string;
    response?: unknown;
    partial?: boolean;
  },
): Promise<void> {
  try {
    const responseJson = input.response != null
      ? JSON.stringify(input.response)
      : JSON.stringify({ streaming: true, partial: input.partial ?? true });
    await pool.query(
      `UPDATE role_room_agent_messages
          SET text = $2,
              response = $3::jsonb
        WHERE id = $1`,
      [input.messageId, input.text, responseJson],
    );
  } catch {
    /* best-effort */
  }
}

export async function archiveThread(
  pool: Pool,
  threadId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_agent_threads
         SET archived_at = now()
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
      [threadId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function updateThreadTitle(
  pool: Pool,
  threadId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_agent_threads
         SET title = $3, last_active_at = now()
       WHERE id = $1 AND user_id = $2`,
      [threadId, userId, title],
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Ensure a thread exists; create one if `threadId` is missing. */
export async function ensureThread(
  pool: Pool,
  projectId: string,
  userId: string,
  threadId?: string | null,
  firstUserMessage?: string,
): Promise<string | null> {
  if (threadId) {
    // Verify ownership before returning the id.
    try {
      const check = await pool.query(
        `SELECT id FROM role_room_agent_threads
         WHERE id = $1 AND user_id = $2 AND project_id = $3
         LIMIT 1`,
        [threadId, userId, projectId],
      );
      if (check.rows[0]) return threadId;
    } catch {
      /* fall through to create */
    }
  }
  const titleSeed = (firstUserMessage ?? '').trim().slice(0, 80);
  const title = titleSeed.length > 0 ? titleSeed : null;
  const created = await createThread(pool, projectId, userId, title ?? undefined);
  return created?.id ?? null;
}
