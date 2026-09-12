import type express from "express";
import { createHash } from "node:crypto";
import {
  anonymousCandidateLabel,
  buildRevisionBrief,
  recordSoundRoomActivity,
  type SoundRoomPool,
} from "./sound-room-operating-system";
import { broadcastSoundRoomUpdated } from "./sound-room-events";

type Session = { userId: string; email?: string | null; name?: string | null };

export interface SoundRoomOperatingSystemDeps {
  app: express.Application;
  pool: SoundRoomPool;
  requireUserSession: (req: any, res: any) => Session | null;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const clean = (value: unknown, max = 2000): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const finite = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const missingMigration = (error: unknown): boolean =>
  typeof error === "object" && error !== null && ["42P01", "42703"].includes(String((error as any).code));

const buckets = new Map<string, number[]>();
function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const current = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  current.push(now);
  buckets.set(key, current);
  return current.length > max;
}

function tokenRateKey(scope: string, token: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 24);
  return `${scope}:${digest}`;
}

function routeError(res: any, error: unknown, code: string): any {
  if (missingMigration(error)) return res.status(503).json({ error: "migration_pending" });
  console.error(`[sound-room-os] ${code}:`, error);
  return res.status(500).json({ error: code });
}

async function ownsProject(pool: SoundRoomPool, projectId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`,
    [projectId, userId],
  );
  return result.rowCount > 0;
}

async function resolveSharedMember(pool: SoundRoomPool, token: string): Promise<any | null> {
  const result = await pool.query(
    `SELECT m.id AS member_id,m.name,m.role,m.can_approve,m.project_id,p.title
       FROM audio_review_members m
       JOIN audio_review_projects p ON p.id=m.project_id
      WHERE m.invite_token=$1
        AND (m.invite_expires_at IS NULL OR m.invite_expires_at>NOW())
      LIMIT 1`,
    [token],
  );
  return result.rows[0] || null;
}

async function loadProjectOs(pool: SoundRoomPool, projectId: string): Promise<Record<string, unknown>> {
  const [settings, briefs, decisions, signoffs, listens, manifests, activity] = await Promise.all([
    pool.query(
      `SELECT * FROM audio_review_project_settings WHERE project_id=$1::uuid LIMIT 1`,
      [projectId],
    ),
    pool.query(
      `SELECT * FROM audio_revision_briefs WHERE project_id=$1::uuid ORDER BY created_at DESC LIMIT 20`,
      [projectId],
    ),
    pool.query(
      `SELECT d.*,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'version_id',c.version_id,
                  'label',c.label,
                  'order_index',c.order_index,
                  'version_label',v.version_label,
                  'version_number',v.version_number,
                  'file_url',v.file_url,
                  'duration',v.duration,
                  'votes',(SELECT COUNT(*)::int FROM audio_decision_votes dv WHERE dv.decision_id=d.id AND dv.version_id=c.version_id)
                ) ORDER BY c.order_index)
                FROM audio_decision_candidates c
                JOIN audio_review_versions v ON v.id=c.version_id
                WHERE c.decision_id=d.id
              ),'[]'::json) AS candidates,
              COALESCE((SELECT COUNT(*)::int FROM audio_decision_votes dv WHERE dv.decision_id=d.id),0) AS vote_count
         FROM audio_decision_rooms d
        WHERE d.project_id=$1::uuid
        ORDER BY d.created_at DESC LIMIT 20`,
      [projectId],
    ),
    pool.query(
      `SELECT s.*,m.name AS member_name,m.role AS member_role,m.can_approve
         FROM audio_review_signoffs s
         LEFT JOIN audio_review_members m ON m.id=s.member_id
        WHERE s.project_id=$1::uuid
        ORDER BY CASE s.stage WHEN 'mix' THEN 1 WHEN 'master' THEN 2 ELSE 3 END,m.order_index ASC`,
      [projectId],
    ),
    pool.query(
      `SELECT l.*,m.name AS member_name,v.version_label,v.version_number
         FROM audio_review_listens l
         LEFT JOIN audio_review_members m ON m.id=l.member_id
         JOIN audio_review_versions v ON v.id=l.version_id
        WHERE l.project_id=$1::uuid ORDER BY l.last_listened_at DESC`,
      [projectId],
    ),
    pool.query(
      `SELECT m.*,
              COALESCE((SELECT json_agg(i ORDER BY i.order_index) FROM audio_delivery_manifest_items i WHERE i.manifest_id=m.id),'[]'::json) AS items
         FROM audio_delivery_manifests m
        WHERE m.project_id=$1::uuid ORDER BY m.manifest_number DESC`,
      [projectId],
    ),
    pool.query(
      `SELECT * FROM audio_review_activity WHERE project_id=$1::uuid ORDER BY created_at DESC LIMIT 100`,
      [projectId],
    ),
  ]);
  return {
    settings: settings.rows[0] || {
      project_id: projectId,
      comparison_mode: "level_matched",
      approval_policy: { stages: ["mix", "master", "delivery"] },
      notification_settings: {
        newVersion: true,
        newComment: true,
        decisionClosed: true,
        approvalRequested: true,
      },
    },
    briefs: briefs.rows,
    decisions: decisions.rows,
    signoffs: signoffs.rows,
    listens: listens.rows,
    manifests: manifests.rows,
    activity: activity.rows,
  };
}

export function setupSoundRoomOperatingSystemRoutes(deps: SoundRoomOperatingSystemDeps): void {
  const { app, pool, requireUserSession } = deps;

  app.get("/api/sound-room/command-center", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const [projects, collections] = await Promise.all([
        pool.query(
          `SELECT p.*,
                  v.id AS latest_version_id,v.version_label AS latest_version_label,v.version_number AS latest_version_number,
                  COALESCE((SELECT COUNT(*)::int FROM audio_review_comments c JOIN audio_review_versions cv ON cv.id=c.version_id WHERE cv.project_id=p.id AND c.status NOT IN ('resolved','rejected')),0) AS unresolved_comments,
                  COALESCE((SELECT COUNT(*)::int FROM audio_review_tasks t WHERE t.project_id=p.id AND t.status<>'done'),0) AS open_tasks,
                  COALESCE((SELECT COUNT(*)::int FROM audio_review_activity a WHERE a.project_id=p.id AND a.read_at IS NULL),0) AS unread_activity,
                  COALESCE((SELECT COUNT(*)::int FROM audio_review_signoffs s WHERE s.project_id=p.id AND s.status='requested'),0) AS pending_signoffs,
                  COALESCE((SELECT COUNT(*)::int FROM audio_decision_rooms d WHERE d.project_id=p.id AND d.status='open'),0) AS open_decisions,
                  COALESCE((SELECT COUNT(*)::int FROM audio_review_members m WHERE m.project_id=p.id AND NOT m.is_owner),0) AS collaborator_count,
                  COALESCE((SELECT COUNT(DISTINCT l.listener_key)::int FROM audio_review_listens l WHERE l.project_id=p.id AND l.version_id=v.id AND l.completed_at IS NOT NULL),0) AS completed_listeners
             FROM audio_review_projects p
             LEFT JOIN LATERAL (
               SELECT id,version_label,version_number FROM audio_review_versions
                WHERE project_id=p.id ORDER BY version_number DESC,created_at DESC LIMIT 1
             ) v ON TRUE
            WHERE p.owner_user_id=$1 AND p.status<>'archived'
            ORDER BY GREATEST(p.updated_at,COALESCE((SELECT MAX(a.created_at) FROM audio_review_activity a WHERE a.project_id=p.id),p.updated_at)) DESC
            LIMIT 200`,
          [session.userId],
        ),
        pool.query(
          `SELECT c.*,
                  COALESCE((SELECT COUNT(*)::int FROM audio_project_collection_items i WHERE i.collection_id=c.id),0) AS track_count,
                  COALESCE((SELECT COUNT(*)::int FROM audio_project_collection_items i JOIN audio_review_projects p ON p.id=i.project_id WHERE i.collection_id=c.id AND p.status IN ('approved','final_delivered')),0) AS ready_count,
                  COALESCE((SELECT json_agg(json_build_object('project_id',i.project_id,'track_number',i.track_number,'disc_number',i.disc_number,'transition_note',i.transition_note,'title',p.title,'artist_name',p.artist_name,'status',p.status,'cover_url',p.cover_url) ORDER BY i.disc_number,i.track_number) FROM audio_project_collection_items i JOIN audio_review_projects p ON p.id=i.project_id WHERE i.collection_id=c.id),'[]'::json) AS tracks
             FROM audio_project_collections c WHERE c.owner_user_id=$1 ORDER BY c.updated_at DESC`,
          [session.userId],
        ),
      ]);
      return res.json({ projects: projects.rows, collections: collections.rows });
    } catch (error) {
      return routeError(res, error, "command_center_failed");
    }
  });

  app.get("/api/sound-room/projects/:projectId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    if (!isUuid(projectId)) return res.status(400).json({ error: "invalid_project_id" });
    try {
      if (!(await ownsProject(pool, projectId, session.userId))) return res.status(404).json({ error: "not_found" });
      return res.json(await loadProjectOs(pool, projectId));
    } catch (error) {
      return routeError(res, error, "project_os_failed");
    }
  });

  app.patch("/api/sound-room/projects/:projectId/settings", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    if (!isUuid(projectId)) return res.status(400).json({ error: "invalid_project_id" });
    const comparisonMode = clean(req.body?.comparisonMode, 40) || "level_matched";
    if (!["original", "level_matched"].includes(comparisonMode)) return res.status(400).json({ error: "invalid_comparison_mode" });
    const approvalPolicy = req.body?.approvalPolicy && typeof req.body.approvalPolicy === "object" ? req.body.approvalPolicy : { stages: ["mix", "master", "delivery"] };
    const notifications = req.body?.notificationSettings && typeof req.body.notificationSettings === "object" ? req.body.notificationSettings : {};
    try {
      if (!(await ownsProject(pool, projectId, session.userId))) return res.status(404).json({ error: "not_found" });
      const result = await pool.query(
        `INSERT INTO audio_review_project_settings (project_id,comparison_mode,approval_policy,notification_settings)
         VALUES ($1::uuid,$2,$3::jsonb,$4::jsonb)
         ON CONFLICT (project_id) DO UPDATE SET comparison_mode=EXCLUDED.comparison_mode,approval_policy=EXCLUDED.approval_policy,notification_settings=EXCLUDED.notification_settings,updated_at=NOW()
         RETURNING *`,
        [projectId, comparisonMode, JSON.stringify(approvalPolicy), JSON.stringify(notifications)],
      );
      return res.json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "settings_update_failed");
    }
  });

  app.post("/api/sound-room/projects/:projectId/briefs", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    if (!isUuid(projectId)) return res.status(400).json({ error: "invalid_project_id" });
    if (rateLimited(`brief:${session.userId}`, 10, 60 * 60_000)) return res.status(429).json({ error: "rate_limited" });
    try {
      const project = await pool.query(
        `SELECT id,title FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`,
        [projectId, session.userId],
      );
      if (!project.rowCount) return res.status(404).json({ error: "not_found" });
      const requestedVersion = clean(req.body?.versionId, 64);
      if (requestedVersion && !isUuid(requestedVersion)) return res.status(400).json({ error: "invalid_version_id" });
      const sourceVersion = requestedVersion
        ? await pool.query(`SELECT id FROM audio_review_versions WHERE id=$1::uuid AND project_id=$2::uuid LIMIT 1`, [requestedVersion, projectId])
        : await pool.query(`SELECT id FROM audio_review_versions WHERE project_id=$1::uuid ORDER BY version_number DESC,created_at DESC LIMIT 1`, [projectId]);
      if (requestedVersion && !sourceVersion.rowCount) return res.status(404).json({ error: "version_not_found" });
      const versionId = sourceVersion.rows[0]?.id || null;
      const comments = await pool.query(
        `SELECT c.id,c.body,c.category,c.status,c.author,c.timecode_seconds,v.version_label
           FROM audio_review_comments c JOIN audio_review_versions v ON v.id=c.version_id
          WHERE v.project_id=$1::uuid ${versionId ? "AND v.id=$2::uuid" : ""}
          ORDER BY c.created_at ASC`,
        versionId ? [projectId, versionId] : [projectId],
      );
      const draft = await buildRevisionBrief(project.rows[0].title, comments.rows, req.body?.useAi !== false);
      const inserted = await pool.query(
        `INSERT INTO audio_revision_briefs
           (project_id,source_version_id,title,summary,priorities,conflicts,resolved_count,unresolved_count,generation_mode,created_by)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10) RETURNING *`,
        [projectId, versionId, draft.title, draft.summary, JSON.stringify(draft.priorities), JSON.stringify(draft.conflicts), draft.resolvedCount, draft.unresolvedCount, draft.generationMode, session.userId],
      );
      await recordSoundRoomActivity(pool, { projectId, eventType: "brief_generated", summary: `${draft.title} ble generert`, actorId: session.userId, actorName: session.name, metadata: { briefId: inserted.rows[0].id, mode: draft.generationMode } });
      void broadcastSoundRoomUpdated(pool as any, projectId, "brief");
      return res.status(201).json(inserted.rows[0]);
    } catch (error) {
      return routeError(res, error, "brief_generation_failed");
    }
  });

  app.post("/api/sound-room/projects/:projectId/decisions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    const versionIds = Array.isArray(req.body?.versionIds)
      ? [...new Set(req.body.versionIds.map((id: unknown) => clean(id, 64)).filter(isUuid))]
      : [];
    if (!isUuid(projectId)) return res.status(400).json({ error: "invalid_project_id" });
    if (versionIds.length < 2 || versionIds.length > 4) return res.status(400).json({ error: "choose_two_to_four_versions" });
    try {
      if (!(await ownsProject(pool, projectId, session.userId))) return res.status(404).json({ error: "not_found" });
      const versions = await pool.query(
        `SELECT id FROM audio_review_versions WHERE project_id=$1::uuid AND id=ANY($2::uuid[])`,
        [projectId, versionIds],
      );
      if (versions.rowCount !== versionIds.length) return res.status(400).json({ error: "version_outside_project" });
      const closesAt = req.body?.closesAt ? new Date(req.body.closesAt) : null;
      if (closesAt && Number.isNaN(closesAt.getTime())) return res.status(400).json({ error: "invalid_closes_at" });
      const client = pool.connect ? await pool.connect() : pool;
      let createdDecision: any;
      try {
        if (client !== pool) await client.query("BEGIN");
        const decision = await client.query(
          `INSERT INTO audio_decision_rooms (project_id,title,prompt,blind,level_matched,allow_multiple,closes_at,created_by)
           VALUES ($1::uuid,$2,$3,$4,$5,false,$6,$7) RETURNING *`,
          [projectId, clean(req.body?.title, 180) || "Hvilken versjon fungerer best?", clean(req.body?.prompt, 1200) || null, req.body?.blind !== false, req.body?.levelMatched !== false, closesAt?.toISOString() || null, session.userId],
        );
        createdDecision = decision.rows[0];
        for (let index = 0; index < versionIds.length; index += 1) {
          await client.query(
            `INSERT INTO audio_decision_candidates (decision_id,version_id,label,order_index) VALUES ($1::uuid,$2::uuid,$3,$4)`,
            [createdDecision.id, versionIds[index], anonymousCandidateLabel(index), index],
          );
        }
        if (client !== pool) await client.query("COMMIT");
      } catch (error) {
        if (client !== pool) await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        if (client !== pool) client.release?.();
      }
      await recordSoundRoomActivity(pool, { projectId, eventType: "decision_started", summary: `Beslutningsrommet «${createdDecision.title}» ble åpnet`, actorId: session.userId, actorName: session.name, metadata: { decisionId: createdDecision.id, candidateCount: versionIds.length } });
      void broadcastSoundRoomUpdated(pool as any, projectId, "decision");
      return res.status(201).json(createdDecision);
    } catch (error) {
      return routeError(res, error, "decision_create_failed");
    }
  });

  app.post("/api/sound-room/decisions/:decisionId/votes", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const decisionId = clean(req.params.decisionId, 64);
    const versionId = clean(req.body?.versionId, 64);
    if (!isUuid(decisionId) || !isUuid(versionId)) return res.status(400).json({ error: "invalid_id" });
    try {
      const decision = await pool.query(
        `SELECT d.project_id,d.status,d.closes_at FROM audio_decision_rooms d JOIN audio_review_projects p ON p.id=d.project_id WHERE d.id=$1::uuid AND p.owner_user_id=$2 LIMIT 1`,
        [decisionId, session.userId],
      );
      if (!decision.rowCount) return res.status(404).json({ error: "not_found" });
      if (decision.rows[0].status !== "open" || (decision.rows[0].closes_at && new Date(decision.rows[0].closes_at) <= new Date())) return res.status(409).json({ error: "decision_closed" });
      const candidate = await pool.query(`SELECT 1 FROM audio_decision_candidates WHERE decision_id=$1::uuid AND version_id=$2::uuid`, [decisionId, versionId]);
      if (!candidate.rowCount) return res.status(400).json({ error: "invalid_candidate" });
      const result = await pool.query(
        `INSERT INTO audio_decision_votes (decision_id,version_id,voter_key,voter_name,rationale)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5)
         ON CONFLICT (decision_id,voter_key) DO UPDATE SET version_id=EXCLUDED.version_id,rationale=EXCLUDED.rationale,updated_at=NOW()
         RETURNING *`,
        [decisionId, versionId, `user:${session.userId}`, session.name || session.email || "Produsent", clean(req.body?.rationale, 1200) || null],
      );
      void broadcastSoundRoomUpdated(pool as any, String(decision.rows[0].project_id), "decision");
      return res.json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "decision_vote_failed");
    }
  });

  app.post("/api/sound-room/decisions/:decisionId/close", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const decisionId = clean(req.params.decisionId, 64);
    const winnerVersionId = clean(req.body?.winnerVersionId, 64);
    if (!isUuid(decisionId) || (winnerVersionId && !isUuid(winnerVersionId))) return res.status(400).json({ error: "invalid_id" });
    try {
      const decision = await pool.query(
        `SELECT d.project_id FROM audio_decision_rooms d JOIN audio_review_projects p ON p.id=d.project_id WHERE d.id=$1::uuid AND p.owner_user_id=$2 LIMIT 1`,
        [decisionId, session.userId],
      );
      if (!decision.rowCount) return res.status(404).json({ error: "not_found" });
      let winner = winnerVersionId || null;
      if (winner) {
        const valid = await pool.query(`SELECT 1 FROM audio_decision_candidates WHERE decision_id=$1::uuid AND version_id=$2::uuid`, [decisionId, winner]);
        if (!valid.rowCount) return res.status(400).json({ error: "invalid_winner" });
      } else {
        const result = await pool.query(
          `SELECT version_id,COUNT(*)::int AS votes FROM audio_decision_votes WHERE decision_id=$1::uuid GROUP BY version_id ORDER BY votes DESC,MIN(created_at) ASC LIMIT 1`,
          [decisionId],
        );
        winner = result.rows[0]?.version_id || null;
      }
      const closed = await pool.query(
        `UPDATE audio_decision_rooms SET status='closed',winner_version_id=$2::uuid,closed_at=NOW() WHERE id=$1::uuid RETURNING *`,
        [decisionId, winner],
      );
      await recordSoundRoomActivity(pool, { projectId: decision.rows[0].project_id, eventType: "decision_closed", summary: winner ? "Beslutningsrommet ble lukket med en valgt versjon" : "Beslutningsrommet ble lukket uten vinner", actorId: session.userId, actorName: session.name, metadata: { decisionId, winnerVersionId: winner } });
      void broadcastSoundRoomUpdated(pool as any, String(decision.rows[0].project_id), "decision");
      return res.json(closed.rows[0]);
    } catch (error) {
      return routeError(res, error, "decision_close_failed");
    }
  });

  app.patch("/api/sound-room/projects/:projectId/members/:memberId", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    const memberId = clean(req.params.memberId, 64);
    if (!isUuid(projectId) || !isUuid(memberId)) return res.status(400).json({ error: "invalid_id" });
    try {
      if (!(await ownsProject(pool, projectId, session.userId))) return res.status(404).json({ error: "not_found" });
      const result = await pool.query(
        `UPDATE audio_review_members SET can_approve=$3 WHERE id=$1::uuid AND project_id=$2::uuid AND NOT is_owner RETURNING *`,
        [memberId, projectId, req.body?.canApprove === true],
      );
      if (!result.rowCount) return res.status(404).json({ error: "member_not_found" });
      return res.json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "member_permission_failed");
    }
  });

  app.post("/api/sound-room/projects/:projectId/signoffs", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    const versionId = clean(req.body?.versionId, 64);
    const stage = clean(req.body?.stage, 20);
    const memberIds = Array.isArray(req.body?.memberIds) ? [...new Set(req.body.memberIds.map((id: unknown) => clean(id, 64)).filter(isUuid))] : [];
    if (!isUuid(projectId) || !isUuid(versionId)) return res.status(400).json({ error: "invalid_id" });
    if (!["mix", "master", "delivery"].includes(stage) || !memberIds.length) return res.status(400).json({ error: "stage_and_members_required" });
    try {
      if (!(await ownsProject(pool, projectId, session.userId))) return res.status(404).json({ error: "not_found" });
      const version = await pool.query(`SELECT 1 FROM audio_review_versions WHERE id=$1::uuid AND project_id=$2::uuid`, [versionId, projectId]);
      if (!version.rowCount) return res.status(404).json({ error: "version_not_found" });
      const members = await pool.query(`SELECT id FROM audio_review_members WHERE project_id=$1::uuid AND id=ANY($2::uuid[]) AND can_approve=true`, [projectId, memberIds]);
      if (members.rowCount !== memberIds.length) return res.status(400).json({ error: "member_cannot_approve" });
      const client = pool.connect ? await pool.connect() : pool;
      const created = [];
      try {
        if (client !== pool) await client.query("BEGIN");
        for (const memberId of memberIds) {
          const result = await client.query(
            `INSERT INTO audio_review_signoffs (project_id,version_id,member_id,stage,requested_by)
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5)
             ON CONFLICT (project_id,version_id,member_id,stage) DO UPDATE SET status='requested',requested_by=EXCLUDED.requested_by,response_note=NULL,responded_at=NULL,updated_at=NOW()
             RETURNING *`,
            [projectId, versionId, memberId, stage, session.userId],
          );
          created.push(result.rows[0]);
        }
        if (client !== pool) await client.query("COMMIT");
      } catch (error) {
        if (client !== pool) await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        if (client !== pool) client.release?.();
      }
      await recordSoundRoomActivity(pool, { projectId, eventType: "approval_requested", summary: `${stage}-godkjenning ble sendt til ${created.length} bidragsyter${created.length === 1 ? "" : "e"}`, actorId: session.userId, actorName: session.name, metadata: { stage, versionId, memberIds } });
      void broadcastSoundRoomUpdated(pool as any, projectId, "approval");
      return res.status(201).json({ signoffs: created });
    } catch (error) {
      return routeError(res, error, "signoff_request_failed");
    }
  });

  app.post("/api/sound-room/projects/:projectId/manifests", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    if (!isUuid(projectId)) return res.status(400).json({ error: "invalid_project_id" });
    try {
      const project = await pool.query(`SELECT title FROM audio_review_projects WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [projectId, session.userId]);
      if (!project.rowCount) return res.status(404).json({ error: "not_found" });
      const deliverables = await pool.query(
        `SELECT d.*,v.version_label,v.status AS version_status
           FROM audio_review_deliverables d LEFT JOIN audio_review_versions v ON v.id=d.version_id
          WHERE d.project_id=$1::uuid AND d.downloadable=true ORDER BY d.created_at ASC`,
        [projectId],
      );
      if (!deliverables.rowCount) return res.status(409).json({ error: "no_downloadable_deliverables" });
      const blockers = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM audio_review_comments c JOIN audio_review_versions v ON v.id=c.version_id WHERE v.project_id=$1::uuid AND c.status NOT IN ('resolved','rejected')) AS unresolved_comments,
           (SELECT COUNT(*)::int FROM audio_review_signoffs s WHERE s.project_id=$1::uuid AND s.status<>'approved') AS incomplete_signoffs`,
        [projectId],
      );
      const readiness = blockers.rows[0] || { unresolved_comments: 0, incomplete_signoffs: 0 };
      const manifestStatus = Number(readiness.unresolved_comments) === 0 && Number(readiness.incomplete_signoffs) === 0 ? "ready" : "draft";
      const client = pool.connect ? await pool.connect() : pool;
      let manifest: any;
      let manifestNumber = 0;
      try {
        if (client !== pool) {
          await client.query("BEGIN");
          await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sound-room-manifest:${projectId}`]);
        }
        const next = await client.query(`SELECT COALESCE(MAX(manifest_number),0)+1 AS number FROM audio_delivery_manifests WHERE project_id=$1::uuid`, [projectId]);
        manifestNumber = Number(next.rows[0].number);
        const inserted = await client.query(
          `INSERT INTO audio_delivery_manifests (project_id,manifest_number,title,status,metadata,created_by)
           VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
          [projectId, manifestNumber, clean(req.body?.title, 200) || `${project.rows[0].title} – levering ${manifestNumber}`, manifestStatus, JSON.stringify({ note: clean(req.body?.note, 1000) || null, createdFrom: "downloadable_deliverables", blockers: readiness }), session.userId],
        );
        manifest = inserted.rows[0];
        for (let index = 0; index < deliverables.rows.length; index += 1) {
          const item = deliverables.rows[index];
          const identityChecksum = createHash("sha256").update(JSON.stringify({ url: item.file_url, size: item.file_size, name: item.file_name })).digest("hex");
          await client.query(
            `INSERT INTO audio_delivery_manifest_items (manifest_id,deliverable_id,version_id,file_name,file_url,format,file_size,checksum,order_index)
             VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9)`,
            [manifest.id, item.id, item.version_id || null, item.file_name || "leveranse", item.file_url, item.format, item.file_size, identityChecksum, index],
          );
        }
        if (client !== pool) await client.query("COMMIT");
      } catch (error) {
        if (client !== pool) await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        if (client !== pool) client.release?.();
      }
      await recordSoundRoomActivity(pool, { projectId, eventType: "delivery_created", summary: `Leveransemanifest #${manifestNumber} ble opprettet med ${deliverables.rows.length} filer`, actorId: session.userId, actorName: session.name, metadata: { manifestId: manifest.id, itemCount: deliverables.rows.length } });
      void broadcastSoundRoomUpdated(pool as any, projectId, "delivery");
      return res.status(201).json({ ...manifest, item_count: deliverables.rows.length });
    } catch (error) {
      return routeError(res, error, "manifest_create_failed");
    }
  });

  app.post("/api/sound-room/projects/:projectId/activity/read", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const projectId = clean(req.params.projectId, 64);
    if (!isUuid(projectId)) return res.status(400).json({ error: "invalid_project_id" });
    try {
      if (!(await ownsProject(pool, projectId, session.userId))) return res.status(404).json({ error: "not_found" });
      const result = await pool.query(`UPDATE audio_review_activity SET read_at=NOW() WHERE project_id=$1::uuid AND read_at IS NULL`, [projectId]);
      return res.json({ ok: true, updated: result.rowCount });
    } catch (error) {
      return routeError(res, error, "activity_read_failed");
    }
  });

  app.get("/api/sound-room/collections", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT c.*,
                COALESCE((SELECT json_agg(json_build_object('project_id',i.project_id,'track_number',i.track_number,'disc_number',i.disc_number,'transition_note',i.transition_note,'title',p.title,'artist_name',p.artist_name,'status',p.status,'cover_url',p.cover_url) ORDER BY i.disc_number,i.track_number) FROM audio_project_collection_items i JOIN audio_review_projects p ON p.id=i.project_id WHERE i.collection_id=c.id),'[]'::json) AS tracks
           FROM audio_project_collections c WHERE c.owner_user_id=$1 ORDER BY c.updated_at DESC`,
        [session.userId],
      );
      return res.json({ collections: result.rows });
    } catch (error) {
      return routeError(res, error, "collections_read_failed");
    }
  });

  app.post("/api/sound-room/collections", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const title = clean(req.body?.title, 200);
    const collectionType = clean(req.body?.collectionType, 20);
    const targetDate = clean(req.body?.targetDate, 10);
    if (!title || !["ep", "album"].includes(collectionType)) return res.status(400).json({ error: "title_and_type_required" });
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return res.status(400).json({ error: "invalid_target_date" });
    try {
      const result = await pool.query(
        `INSERT INTO audio_project_collections (owner_user_id,title,artist_name,collection_type,target_date,notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [session.userId, title, clean(req.body?.artistName, 200) || null, collectionType, targetDate || null, clean(req.body?.notes, 2000) || null],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "collection_create_failed");
    }
  });

  app.put("/api/sound-room/collections/:collectionId/tracks", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const collectionId = clean(req.params.collectionId, 64);
    const tracks = Array.isArray(req.body?.tracks) ? req.body.tracks.slice(0, 100) : [];
    if (!isUuid(collectionId) || tracks.some((item: any) => !isUuid(clean(item?.projectId, 64)))) return res.status(400).json({ error: "invalid_tracks" });
    try {
      const collection = await pool.query(`SELECT id FROM audio_project_collections WHERE id=$1::uuid AND owner_user_id=$2 LIMIT 1`, [collectionId, session.userId]);
      if (!collection.rowCount) return res.status(404).json({ error: "not_found" });
      const projectIds = tracks.map((item: any) => clean(item.projectId, 64));
      if (new Set(projectIds).size !== projectIds.length) return res.status(400).json({ error: "duplicate_project" });
      if (projectIds.length) {
        const owned = await pool.query(`SELECT id FROM audio_review_projects WHERE owner_user_id=$1 AND id=ANY($2::uuid[])`, [session.userId, projectIds]);
        if (owned.rowCount !== projectIds.length) return res.status(400).json({ error: "project_outside_account" });
      }
      const client = pool.connect ? await pool.connect() : pool;
      try {
        if (client !== pool) await client.query("BEGIN");
        await client.query(`DELETE FROM audio_project_collection_items WHERE collection_id=$1::uuid`, [collectionId]);
        for (let index = 0; index < tracks.length; index += 1) {
          const item = tracks[index];
          await client.query(
            `INSERT INTO audio_project_collection_items (collection_id,project_id,track_number,disc_number,transition_note) VALUES ($1::uuid,$2::uuid,$3,$4,$5)`,
            [collectionId, clean(item.projectId, 64), index + 1, Math.max(1, Math.floor(finite(item.discNumber, 1))), clean(item.transitionNote, 1000) || null],
          );
        }
        await client.query(`UPDATE audio_project_collections SET status='sequencing',updated_at=NOW() WHERE id=$1::uuid`, [collectionId]);
        if (client !== pool) await client.query("COMMIT");
      } catch (error) {
        if (client !== pool) await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        if (client !== pool) client.release?.();
      }
      return res.json({ ok: true, trackCount: tracks.length });
    } catch (error) {
      return routeError(res, error, "collection_tracks_failed");
    }
  });

  app.get("/api/audio-review-shared/:token/os", async (req, res) => {
    const token = clean(req.params.token, 100);
    if (!token.startsWith("inv_")) return res.status(400).json({ error: "invalid_token" });
    try {
      const member = await resolveSharedMember(pool, token);
      if (!member) return res.status(404).json({ error: "not_found" });
      const data: any = await loadProjectOs(pool, String(member.project_id));
      data.activity = [];
      data.briefs = data.briefs.slice(0, 1);
      data.manifests = data.manifests.filter((manifest: any) => manifest.status === "delivered");
      data.signoffs = data.signoffs.filter((signoff: any) => String(signoff.member_id) === String(member.member_id));
      data.listens = data.listens.filter((listen: any) => String(listen.member_id) === String(member.member_id));
      data.decisions = data.decisions.filter((decision: any) => decision.status === "open").map((decision: any) => ({
        ...decision,
        candidates: decision.candidates.map((candidate: any, index: number) => ({
          ...candidate,
          version_label: decision.blind ? anonymousCandidateLabel(index) : candidate.version_label,
          version_number: decision.blind ? null : candidate.version_number,
          file_url: undefined,
          votes: undefined,
        })),
        winner_version_id: null,
        vote_count: undefined,
      }));
      return res.json({ ...data, viewer: { memberId: member.member_id, name: member.name, role: member.role, canApprove: member.can_approve } });
    } catch (error) {
      return routeError(res, error, "shared_os_failed");
    }
  });

  app.post("/api/audio-review-shared/:token/listens", async (req, res) => {
    const token = clean(req.params.token, 100);
    const versionId = clean(req.body?.versionId, 64);
    if (!token.startsWith("inv_") || !isUuid(versionId)) return res.status(400).json({ error: "invalid_request" });
    if (rateLimited(tokenRateKey("listen", token), 120, 60 * 60_000)) return res.status(429).json({ error: "rate_limited" });
    try {
      const member = await resolveSharedMember(pool, token);
      if (!member) return res.status(404).json({ error: "not_found" });
      const version = await pool.query(`SELECT duration FROM audio_review_versions WHERE id=$1::uuid AND project_id=$2::uuid LIMIT 1`, [versionId, member.project_id]);
      if (!version.rowCount) return res.status(404).json({ error: "version_not_found" });
      const listenedSeconds = Math.max(0, finite(req.body?.listenedSeconds));
      const duration = Math.max(0, finite(version.rows[0].duration));
      const completionRatio = Math.min(1, Math.max(0, duration ? listenedSeconds / duration : finite(req.body?.completionRatio)));
      const result = await pool.query(
        `WITH previous AS (
           SELECT completed_at FROM audio_review_listens WHERE version_id=$2::uuid AND listener_key=$4
         ), upserted AS (
           INSERT INTO audio_review_listens (project_id,version_id,member_id,listener_key,listened_seconds,completion_ratio,completed_at)
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,CASE WHEN $6>=0.9 THEN NOW() ELSE NULL END)
           ON CONFLICT (version_id,listener_key) DO UPDATE SET listened_seconds=GREATEST(audio_review_listens.listened_seconds,EXCLUDED.listened_seconds),completion_ratio=GREATEST(audio_review_listens.completion_ratio,EXCLUDED.completion_ratio),last_listened_at=NOW(),completed_at=COALESCE(audio_review_listens.completed_at,EXCLUDED.completed_at)
           RETURNING *
         ) SELECT upserted.*,COALESCE((SELECT completed_at IS NOT NULL FROM previous),false) AS was_completed FROM upserted`,
        [member.project_id, versionId, member.member_id, `member:${member.member_id}`, listenedSeconds, completionRatio],
      );
      if (completionRatio >= 0.9 && !result.rows[0]?.was_completed) await recordSoundRoomActivity(pool, { projectId: String(member.project_id), eventType: "version_listened", summary: `${member.name} har hørt ferdig en versjon`, actorId: `member:${member.member_id}`, actorName: member.name, metadata: { versionId, completionRatio } });
      return res.json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "listen_receipt_failed");
    }
  });

  app.post("/api/audio-review-shared/:token/decisions/:decisionId/vote", async (req, res) => {
    const token = clean(req.params.token, 100);
    const decisionId = clean(req.params.decisionId, 64);
    const versionId = clean(req.body?.versionId, 64);
    if (!token.startsWith("inv_") || !isUuid(decisionId) || !isUuid(versionId)) return res.status(400).json({ error: "invalid_request" });
    if (rateLimited(tokenRateKey("vote", token), 30, 60 * 60_000)) return res.status(429).json({ error: "rate_limited" });
    try {
      const member = await resolveSharedMember(pool, token);
      if (!member) return res.status(404).json({ error: "not_found" });
      const decision = await pool.query(`SELECT status,closes_at FROM audio_decision_rooms WHERE id=$1::uuid AND project_id=$2::uuid LIMIT 1`, [decisionId, member.project_id]);
      if (!decision.rowCount) return res.status(404).json({ error: "decision_not_found" });
      if (decision.rows[0].status !== "open" || (decision.rows[0].closes_at && new Date(decision.rows[0].closes_at) <= new Date())) return res.status(409).json({ error: "decision_closed" });
      const candidate = await pool.query(`SELECT 1 FROM audio_decision_candidates WHERE decision_id=$1::uuid AND version_id=$2::uuid`, [decisionId, versionId]);
      if (!candidate.rowCount) return res.status(400).json({ error: "invalid_candidate" });
      const result = await pool.query(
        `INSERT INTO audio_decision_votes (decision_id,version_id,voter_key,voter_name,rationale)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5)
         ON CONFLICT (decision_id,voter_key) DO UPDATE SET version_id=EXCLUDED.version_id,rationale=EXCLUDED.rationale,updated_at=NOW()
         RETURNING id,decision_id,version_id,created_at,updated_at`,
        [decisionId, versionId, `member:${member.member_id}`, member.name, clean(req.body?.rationale, 1200) || null],
      );
      await recordSoundRoomActivity(pool, { projectId: String(member.project_id), eventType: "decision_voted", summary: `${member.name} har stemt i et beslutningsrom`, actorId: `member:${member.member_id}`, actorName: member.name, metadata: { decisionId } });
      void broadcastSoundRoomUpdated(pool as any, String(member.project_id), "decision");
      return res.json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "shared_vote_failed");
    }
  });

  app.post("/api/audio-review-shared/:token/signoffs/:signoffId/respond", async (req, res) => {
    const token = clean(req.params.token, 100);
    const signoffId = clean(req.params.signoffId, 64);
    const status = clean(req.body?.status, 30);
    if (!token.startsWith("inv_") || !isUuid(signoffId)) return res.status(400).json({ error: "invalid_request" });
    if (!["approved", "changes_requested"].includes(status)) return res.status(400).json({ error: "invalid_status" });
    if (rateLimited(tokenRateKey("signoff", token), 20, 60 * 60_000)) return res.status(429).json({ error: "rate_limited" });
    try {
      const member = await resolveSharedMember(pool, token);
      if (!member) return res.status(404).json({ error: "not_found" });
      if (!member.can_approve) return res.status(403).json({ error: "approval_not_allowed" });
      const result = await pool.query(
        `UPDATE audio_review_signoffs SET status=$4,response_note=$5,responded_at=NOW(),updated_at=NOW()
          WHERE id=$1::uuid AND project_id=$2::uuid AND member_id=$3::uuid AND status='requested' RETURNING *`,
        [signoffId, member.project_id, member.member_id, status, clean(req.body?.note, 1200) || null],
      );
      if (!result.rowCount) return res.status(404).json({ error: "signoff_not_found" });
      await recordSoundRoomActivity(pool, { projectId: String(member.project_id), eventType: "approval_signed", summary: `${member.name} ${status === "approved" ? "godkjente" : "ba om endringer i"} ${result.rows[0].stage}`, actorId: `member:${member.member_id}`, actorName: member.name, metadata: { signoffId, status } });
      void broadcastSoundRoomUpdated(pool as any, String(member.project_id), "approval");
      return res.json(result.rows[0]);
    } catch (error) {
      return routeError(res, error, "shared_signoff_failed");
    }
  });
}
