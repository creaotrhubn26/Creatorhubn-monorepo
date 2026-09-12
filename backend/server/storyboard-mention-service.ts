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
  manuscriptId: string;
  sceneId: string;
  frameId: string;
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
       mentioned_name VARCHAR(120) NOT NULL,
       mentioned_email VARCHAR(255),
       author VARCHAR(120),
       comment_text TEXT,
       manuscript_id VARCHAR(160) NOT NULL,
       scene_id VARCHAR(160) NOT NULL,
       frame_id VARCHAR(160) NOT NULL,
       shot_number VARCHAR(40),
       read_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_sb_mentions_name
       ON storyboard_mention_notifications (lower(mentioned_name), created_at DESC)`,
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

/** Push til alle Storyboard-enheter registrert på brukeren med gitt e-post. */
async function pushToMember(
  pool: Pool,
  email: string,
  title: string,
  body: string,
  customData: Record<string, unknown>,
): Promise<void> {
  const user = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  const userId = user.rows[0]?.id;
  if (!userId) return;
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
  team: StoryboardTeamMember[],
): Promise<void> {
  try {
    if (!team.length) return;
    const previousIds = new Set(
      previousComments.map((comment) => String(comment.id ?? "")),
    );
    const fresh = nextComments.filter(
      (comment) => !previousIds.has(String(comment.id ?? "")),
    );
    if (!fresh.length) return;
    await ensureTable(pool);

    for (const comment of fresh) {
      const text = String(comment.text ?? "");
      const author = String(comment.author ?? comment.role ?? "Ukjent");
      const mentions = parseMentions(text);
      if (!mentions.length) continue;
      for (const member of team) {
        if (!mentions.includes(compactName(member.name))) continue;
        const shot = context.shotNumber ? `shot ${context.shotNumber}` : "et shot";
        const title = `${author} nevnte deg på ${shot}`;
        const project = context.projectTitle ? ` i ${context.projectTitle}` : "";

        await pool.query(
          `INSERT INTO storyboard_mention_notifications
             (mentioned_name, mentioned_email, author, comment_text,
              manuscript_id, scene_id, frame_id, shot_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            member.name,
            member.email ?? null,
            author,
            text,
            context.manuscriptId,
            context.sceneId,
            context.frameId,
            context.shotNumber ?? null,
          ],
        );

        if (member.email) {
          const bodyText =
            `${author} skrev${project}:\n\n"${text}"\n\n` +
            `Åpne Review i Storyboard Studio eller The Role Room for å svare.`;
          await sendTransactionalEmail({
            to: member.email,
            subject: `${title}${project}`,
            text: bodyText,
            html: `<p>${author} skrev${project}:</p><blockquote>${text
              .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</blockquote>` +
              `<p>Åpne Review i Storyboard Studio eller The Role Room for å svare.</p>`,
          }).catch(() => undefined);
          await pushToMember(pool, member.email, title, text, {
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
  name: string,
  onlyUnread: boolean,
): Promise<Array<Record<string, unknown>>> {
  await ensureTable(pool);
  const { rows } = await pool.query(
    `SELECT id, mentioned_name, author, comment_text, manuscript_id,
            scene_id, frame_id, shot_number, read_at, created_at
       FROM storyboard_mention_notifications
      WHERE lower(mentioned_name) = lower($1)
        ${onlyUnread ? "AND read_at IS NULL" : ""}
      ORDER BY created_at DESC LIMIT 100`,
    [name],
  );
  return rows;
}

export async function markMentionsRead(
  pool: Pool,
  name: string,
): Promise<number> {
  await ensureTable(pool);
  const result = await pool.query(
    `UPDATE storyboard_mention_notifications SET read_at = NOW()
      WHERE lower(mentioned_name) = lower($1) AND read_at IS NULL`,
    [name],
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
