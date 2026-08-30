// storyboard-mention-service.ts
//
// @mention-varsling for Storyboard Studio review-kommentarer.
// Kalles fra PATCH /api/casting/frames når `fields.comments` inneholder nye
// kommentarer: parser @Navn-tokens, matcher mot manuskriptets hubTeam
// (fornavn+etternavn uten mellomrom, case-insensitivt) og varsler via
//   1) in-app: rad i storyboard_mention_notifications (GET-endepunkt under)
//   2) e-post: sendTransactionalEmail hvis teammedlemmet har e-postadresse
//   3) APNs: push til medlemmets registrerte Storyboard Studio-enheter
//      (kobles via users.email == teammedlemmets e-post)
// Alle kanaler er best-effort — varslingsfeil skal aldri feile selve lagringen.

import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service";
import { sendAPNs } from "./lead-map-apns-client";

const STORYBOARD_TOPIC =
  process.env.APNS_STORYBOARD_BUNDLE_ID ?? "com.creatorhubn.StoryboardStudio";

export interface StoryboardTeamMember {
  id?: string;
  name: string;
  role?: string;
  email?: string;
}

export interface MentionCommentContext {
  projectId: string;
  manuscriptId: string;
  sceneId: string;
  frameId: string;
  authorUserId: string;
  shotNumber?: string;
  frameDescription?: string;
  projectTitle?: string;
}

let tableEnsured = false;
async function ensureTable(pool: Pool): Promise<void> {
  if (tableEnsured) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS storyboard_mention_notifications (
       id BIGSERIAL PRIMARY KEY,
       project_id VARCHAR(255),
       mentioned_user_id VARCHAR(255),
       mentioned_name VARCHAR(120) NOT NULL,
       mentioned_email VARCHAR(255),
       author VARCHAR(120),
       comment_text TEXT,
       manuscript_id VARCHAR(160) NOT NULL,
       scene_id VARCHAR(160) NOT NULL,
       frame_id VARCHAR(160) NOT NULL,
       comment_id VARCHAR(160),
       shot_number VARCHAR(40),
       read_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  await pool.query(
    `ALTER TABLE storyboard_mention_notifications
       ADD COLUMN IF NOT EXISTS project_id VARCHAR(255),
       ADD COLUMN IF NOT EXISTS mentioned_user_id VARCHAR(255),
       ADD COLUMN IF NOT EXISTS comment_id VARCHAR(160)`,
  );
  // Backfill only an unambiguous account identity. The users.email unique
  // index is case-sensitive, while account lookup is case-insensitive, so a
  // direct lower(email) join could attach a legacy row to either of two
  // case-colliding accounts. Name matching is intentionally forbidden too.
  await pool.query(
    `WITH unique_email_users AS (
       SELECT lower(btrim(email)) AS email_key, min(id::text) AS user_id
         FROM users
        WHERE email IS NOT NULL AND btrim(email) <> ''
        GROUP BY lower(btrim(email))
       HAVING COUNT(*) = 1
     )
     UPDATE storyboard_mention_notifications n
        SET mentioned_user_id = u.user_id
       FROM unique_email_users u
      WHERE n.mentioned_user_id IS NULL
        AND n.mentioned_email IS NOT NULL
        AND u.email_key = lower(btrim(n.mentioned_email))`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_sb_mentions_recipient
       ON storyboard_mention_notifications
          (mentioned_user_id, read_at, created_at DESC)
       WHERE mentioned_user_id IS NOT NULL`,
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sb_mentions_delivery_dedupe
       ON storyboard_mention_notifications
          (mentioned_user_id, frame_id, comment_id)
       WHERE mentioned_user_id IS NOT NULL AND comment_id IS NOT NULL`,
  );
  tableEnsured = true;
}

/** «@DanielQazi tar denne» → ["danielqazi"]. */
export function parseMentions(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/@([\p{L}\p{N}_-]{2,})/gu)) {
    out.push(match[1].toLowerCase());
  }
  return out;
}

function compactName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function verifiedProjectRecipients(
  pool: Pool,
  projectId: string,
): Promise<Array<{ id: string; name: string; email: string | null }>> {
  const { rows } = await pool.query<{
    id: string;
    name: string;
    email: string | null;
  }>(
    `WITH member_ids AS (
       SELECT created_by::text AS user_id
         FROM casting_projects
        WHERE id = $1
       UNION
       SELECT user_id::text
         FROM casting_user_roles
        WHERE project_id = $1
          AND deactivated_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
     )
     SELECT u.id::text AS id,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
              u.email
            ) AS name,
            u.email
       FROM member_ids m
       JOIN users u ON u.id::text = m.user_id
      WHERE u.id IS NOT NULL`,
    [projectId],
  );
  return rows.filter((row) => Boolean(row.id && row.name));
}

async function verifiedAuthorName(
  pool: Pool,
  userId: string,
): Promise<string> {
  const { rows } = await pool.query<{ name: string }>(
    `SELECT COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
              email,
              'Et teammedlem'
            ) AS name
       FROM users
      WHERE id::text = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0]?.name || "Et teammedlem";
}

/** Push til alle Storyboard-enheter registrert på den verifiserte brukeren. */
async function pushToMember(
  pool: Pool,
  userId: string,
  title: string,
  body: string,
  customData: Record<string, unknown>,
): Promise<void> {
  const { rows } = await pool.query<{ token: string }>(
    `SELECT token FROM notification_device_tokens
     WHERE user_id = $1 AND platform = 'apns' AND app = 'storyboard' AND enabled = TRUE`,
    [userId],
  );
  for (const row of rows) {
    const result = await sendAPNs(row.token, title, body, {
      topic: STORYBOARD_TOPIC,
      customData,
    });
    if (
      !result.sent &&
      result.reason &&
      /BadDeviceToken|Unregistered|410/.test(result.reason)
    ) {
      await pool.query(
        `UPDATE notification_device_tokens SET enabled = FALSE
         WHERE platform = 'apns' AND token = $1`,
        [row.token],
      );
    }
  }
}

/**
 * Varsle @mentions i NYE kommentarer. `previousComments`/`nextComments` er
 * frame-kommentarlistene før/etter patch — bare kommentar-id-er som ikke
 * fantes før varsles (re-lagring av gamle kommentarer er støyfritt).
 */
export async function notifyStoryboardMentions(
  pool: Pool,
  context: MentionCommentContext,
  previousComments: Array<Record<string, unknown>>,
  nextComments: Array<Record<string, unknown>>,
): Promise<void> {
  try {
    const team = await verifiedProjectRecipients(pool, context.projectId);
    if (!team.length) return;
    const previousIds = new Set(
      previousComments.map((comment) => String(comment.id ?? "")),
    );
    const fresh = nextComments.filter(
      (comment) => !previousIds.has(String(comment.id ?? "")),
    );
    if (!fresh.length) return;
    await ensureTable(pool);
    const author = await verifiedAuthorName(pool, context.authorUserId);

    for (const comment of fresh) {
      const text = String(comment.text ?? "");
      const commentId = String(comment.id ?? "").trim();
      if (!commentId) continue;
      const mentions = parseMentions(text);
      if (!mentions.length) continue;
      for (const member of team) {
        if (!mentions.includes(compactName(member.name))) continue;
        const shot = context.shotNumber ? `shot ${context.shotNumber}` : "et shot";
        const title = `${author} nevnte deg på ${shot}`;
        const project = context.projectTitle ? ` i ${context.projectTitle}` : "";

        const inserted = await pool.query(
          `INSERT INTO storyboard_mention_notifications
             (project_id, mentioned_user_id, mentioned_name, mentioned_email,
              author, comment_text, manuscript_id, scene_id, frame_id,
              comment_id, shot_number)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            WHERE (
              SELECT COUNT(*)
                FROM storyboard_mention_notifications
               WHERE project_id = $1
                 AND mentioned_user_id = $2
                 AND created_at > NOW() - INTERVAL '1 hour'
            ) < 50
           ON CONFLICT (mentioned_user_id, frame_id, comment_id)
             WHERE mentioned_user_id IS NOT NULL AND comment_id IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [
            context.projectId,
            member.id,
            member.name,
            member.email ?? null,
            author,
            text,
            context.manuscriptId,
            context.sceneId,
            context.frameId,
            commentId,
            context.shotNumber ?? null,
          ],
        );
        if (!inserted.rowCount) continue;

        if (member.email) {
          const bodyText =
            `${author} skrev${project}:\n\n"${text}"\n\n` +
            `Åpne Review i Storyboard Studio eller The Role Room for å svare.`;
          await sendTransactionalEmail({
            to: member.email,
            subject: `${title}${project}`,
            text: bodyText,
            html: `<p>${escapeHTML(author)} skrev${escapeHTML(project)}:</p><blockquote>${escapeHTML(text)}</blockquote>` +
              `<p>Åpne Review i Storyboard Studio eller The Role Room for å svare.</p>`,
          }).catch(() => undefined);
          await pushToMember(pool, member.id, title, text, {
            type: "storyboard_mention",
            manuscriptId: context.manuscriptId,
            sceneId: context.sceneId,
            frameId: context.frameId,
          }).catch(() => undefined);
        }
      }
    }
  } catch (error) {
    console.warn("storyboard mention notify feilet (ignorert):", error);
  }
}

/** Uleste mentions for et navn (in-app-kilden for iPad og web). */
export async function listMentions(
  pool: Pool,
  userId: string,
  onlyUnread: boolean,
): Promise<Array<Record<string, unknown>>> {
  await ensureTable(pool);
  const { rows } = await pool.query(
    `SELECT n.id, n.mentioned_name, n.author, n.comment_text, n.manuscript_id,
            n.scene_id, n.frame_id, n.shot_number, n.read_at, n.created_at
       FROM storyboard_mention_notifications n
      WHERE n.mentioned_user_id = $1
        ${onlyUnread ? "AND read_at IS NULL" : ""}
        AND EXISTS (
          SELECT 1
            FROM casting_projects cp
           WHERE cp.id = n.project_id
             AND (
               cp.created_by = $1
               OR EXISTS (
                 SELECT 1 FROM casting_user_roles cur
                  WHERE cur.project_id = cp.id AND cur.user_id = $1
                    AND cur.deactivated_at IS NULL
                    AND (cur.expires_at IS NULL OR cur.expires_at > NOW())
               )
             )
        )
      ORDER BY n.created_at DESC LIMIT 100`,
    [userId],
  );
  return rows;
}

export async function markMentionsRead(
  pool: Pool,
  userId: string,
): Promise<number> {
  await ensureTable(pool);
  const result = await pool.query(
    `UPDATE storyboard_mention_notifications n SET read_at = NOW()
      WHERE n.mentioned_user_id = $1 AND n.read_at IS NULL
        AND EXISTS (
          SELECT 1
            FROM casting_projects cp
           WHERE cp.id = n.project_id
             AND (
               cp.created_by = $1
               OR EXISTS (
                 SELECT 1 FROM casting_user_roles cur
                  WHERE cur.project_id = cp.id AND cur.user_id = $1
                    AND cur.deactivated_at IS NULL
                    AND (cur.expires_at IS NULL OR cur.expires_at > NOW())
               )
             )
        )`,
    [userId],
  );
  return result.rowCount ?? 0;
}

/** Registrer APNs-token for Storyboard Studio (samme tabell som LeadMap/Capture). */
export async function registerStoryboardDeviceToken(
  pool: Pool,
  userId: string,
  token: string,
  opts: { deviceName?: string; appVersion?: string } = {},
): Promise<void> {
  await pool.query(
    `ALTER TABLE notification_device_tokens
       ADD COLUMN IF NOT EXISTS app VARCHAR(20) NOT NULL DEFAULT 'leadmap'`,
  );
  await pool.query(
    `INSERT INTO notification_device_tokens
       (user_id, platform, token, app, device_name, app_version, enabled, last_seen_at)
     VALUES ($1, 'apns', $2, 'storyboard', $3, $4, TRUE, NOW())
     ON CONFLICT (platform, token) DO UPDATE
       SET user_id = EXCLUDED.user_id, app = 'storyboard', enabled = TRUE,
           device_name = EXCLUDED.device_name, app_version = EXCLUDED.app_version,
           last_seen_at = NOW()`,
    [userId, token, opts.deviceName ?? null, opts.appVersion ?? null],
  );
}
