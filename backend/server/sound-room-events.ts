import type { Pool } from "pg";
import { findProjectRowById } from "./project-repository";
import { broadcastUserEvent } from "./realtime-user-events";

type QueryablePool = Pick<Pool, "query">;

export type SoundRoomUpdateReason = "version" | "comment" | "approval";

export interface SoundRoomBroadcastResult {
  projectId: string;
  recipientUserIds: string[];
}

/**
 * Fan out an Audio Showcase mutation to every authenticated user who can see
 * the linked workspace. The bridge deliberately translates the Audio
 * Showcase id into the canonical workspace project id before publishing.
 *
 * This is best-effort: realtime delivery must never make the persisted audio
 * mutation fail. Returning the resolved recipients keeps the routing logic
 * independently testable without exposing websocket internals.
 */
export async function broadcastSoundRoomUpdated(
  pool: QueryablePool,
  audioReviewProjectId: string,
  reason: SoundRoomUpdateReason,
): Promise<SoundRoomBroadcastResult | null> {
  try {
    const bridge = await pool.query(
      `SELECT project_id::text AS project_id
         FROM project_audio_rooms
        WHERE audio_review_project_id = $1::uuid
        LIMIT 1`,
      [audioReviewProjectId],
    ).catch(() => ({ rows: [] as any[] }));
    const projectId = bridge.rows[0]?.project_id
      ? String(bridge.rows[0].project_id)
      : null;
    if (!projectId) return null;

    const [workspaceProject, members] = await Promise.all([
      findProjectRowById(pool, projectId),
      pool.query(
        `SELECT user_id::text AS user_id
           FROM project_team_members
          WHERE project_id = $1
            AND status = 'active'
            AND deactivated_at IS NULL
            AND user_id IS NOT NULL
            AND COALESCE(permissions->>'canRead', 'true') <> 'false'`,
        [projectId],
      ).catch(() => ({ rows: [] as any[] })),
    ]);

    const recipients = new Set<string>();
    if (workspaceProject?.user_id) recipients.add(String(workspaceProject.user_id));
    for (const row of members.rows) {
      if (row.user_id) recipients.add(String(row.user_id));
    }

    const timestamp = new Date().toISOString();
    for (const userId of recipients) {
      broadcastUserEvent(userId, {
        kind: "sound-room.updated",
        projectId,
        reason,
        timestamp,
      });
    }
    return { projectId, recipientUserIds: [...recipients] };
  } catch {
    return null;
  }
}
