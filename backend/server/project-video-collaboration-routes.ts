import crypto from "node:crypto";
import type express from "express";
import type { Pool, PoolClient } from "pg";

import { canAccessProject } from "./project-team-routes.js";
import { generateStreamCaptions, getStreamCaption, getStreamVideoStatus } from "./cloudflare-stream-service.js";
import { enqueueJob } from "./job-queue.js";
import { isDeviceRevoked } from "./post-agent-storage.js";
import { hashVideoSharePassword, hashVideoShareToken } from "./project-video-room-model.js";

type Session = { userId: string; email: string; name: string; role: string; device?: string };
type RequireSession = (req: any, res: any) => Session | null;

const text = (value: unknown, max = 1000): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const validEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const sha256 = (value: string): string => crypto.createHash("sha256").update(value).digest("hex");
const xml = (value: unknown): string => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const publicLiveWriteWindows = new Map<string, { count: number; resetAt: number }>();

function allowPublicLiveWrite(token: string): boolean {
  const now = Date.now();
  const key = sha256(token);
  const current = publicLiveWriteWindows.get(key);
  if (!current || current.resetAt <= now) {
    publicLiveWriteWindows.set(key, { count: 1, resetAt: now + 60_000 });
    if (publicLiveWriteWindows.size > 10_000) {
      for (const [candidate, window] of publicLiveWriteWindows) {
        if (window.resetAt <= now) publicLiveWriteWindows.delete(candidate);
      }
    }
    return true;
  }
  current.count += 1;
  return current.count <= 120;
}

async function canEdit(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  const owner = await pool.query(`SELECT 1 FROM projects WHERE id=$1 AND user_id=$2 LIMIT 1`, [projectId, userId]).catch(() => ({ rows: [] }));
  if (owner.rows.length) return true;
  const member = await pool.query(
    `SELECT permissions,role FROM project_team_members
      WHERE project_id=$1 AND user_id=$2 AND status='active' AND deactivated_at IS NULL LIMIT 1`,
    [projectId, userId],
  ).catch(() => ({ rows: [] }));
  return Boolean(member.rows[0]?.permissions?.canEdit || member.rows[0]?.role === "editor");
}

function parseVttTime(raw: string): number {
  const values = raw.trim().replace(",", ".").split(":").map(Number);
  if (values.some((value) => !Number.isFinite(value))) return 0;
  return values.length === 3 ? values[0] * 3600 + values[1] * 60 + values[2] : values[0] * 60 + values[1];
}

export function parseVideoVtt(content: string): Array<{ startSec: number; endSec: number; text: string }> {
  const blocks = content.replace(/^\uFEFF/, "").split(/\r?\n\r?\n+/); const result: Array<{ startSec: number; endSec: number; text: string }> = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [start, endWithSettings] = lines[timingIndex].split("-->");
    const end = endWithSettings?.trim().split(/\s+/)[0];
    const cueText = lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (!end || !cueText) continue;
    result.push({ startSec: parseVttTime(start), endSec: parseVttTime(end), text: cueText.slice(0, 10_000) });
  }
  return result.slice(0, 20_000);
}

async function saveCaptionAndTranscript(
  db: Pool | PoolClient,
  input: { versionId: string; language: string; label: string; content: string; generated: boolean; userId: string },
): Promise<void> {
  const segments = parseVideoVtt(input.content);
  await db.query(
    `INSERT INTO project_video_caption_tracks
       (id,version_id,language,label,kind,format,content,is_default,status,generated,created_by)
     VALUES ($1,$2,$3,$4,'subtitles','vtt',$5,true,'ready',$6,$7)
     ON CONFLICT (version_id,language,format) DO UPDATE
       SET label=EXCLUDED.label,content=EXCLUDED.content,status='ready',generated=EXCLUDED.generated,updated_at=NOW()`,
    [crypto.randomUUID(), input.versionId, input.language, input.label, input.content, input.generated, input.userId],
  );
  await db.query(`DELETE FROM project_video_transcript_segments WHERE version_id=$1`, [input.versionId]);
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    await db.query(
      `INSERT INTO project_video_transcript_segments
         (id,version_id,segment_index,start_sec,end_sec,text,language)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [crypto.randomUUID(), input.versionId, index, segment.startSec, segment.endSec, segment.text, input.language],
    );
  }
}

function fcpxml(markers: any[]): string {
  const duration = Math.max(1, ...markers.map((marker) => number(marker.timecodeSec) + 1));
  const markerXml = markers.map((marker) =>
    `<marker start="${Math.round(number(marker.timecodeSec) * 1000)}/1000s" duration="1/1000s" value="${xml(`${marker.mustFix ? "[MÅ FIKSES] " : ""}${marker.title}`)}" note="${xml(marker.note)}" completed="${marker.completed ? 1 : 0}"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><fcpxml version="1.11"><resources><format id="r1" name="CreatorHub Review" frameDuration="1/25s" width="1920" height="1080"/></resources><library><event name="CreatorHub Video Room"><project name="Review markers"><sequence format="r1" duration="${Math.round(duration * 1000)}/1000s"><spine><gap name="Review" offset="0s" start="0s" duration="${Math.round(duration * 1000)}/1000s">${markerXml}</gap></spine></sequence></project></event></library></fcpxml>`;
}

export function setupProjectVideoCollaborationRoutes(input: {
  app: express.Application;
  pool: Pool;
  requireUserSession: RequireSession;
  resolveUserSession?: (req: any) => Promise<Session | null>;
}): void {
  const { app, pool, requireUserSession } = input;

  const sessionFor = async (req: any, res: any): Promise<Session | null> => {
    if (!input.resolveUserSession) return requireUserSession(req, res);
    const session = await input.resolveUserSession(req);
    if (!session) { res.status(401).json({ error: "auth_required" }); return null; }
    if (session.device === "post-agent") {
      const authorization = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
      const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!bearer || await isDeviceRevoked(pool, bearer)) {
        res.status(401).json({ error: "post_agent_token_revoked" }); return null;
      }
    }
    return session;
  };

  const guard = async (req: any, res: any, editor = false): Promise<Session | null> => {
    const session = await sessionFor(req, res); if (!session) return null;
    const projectId = text(req.params.projectId, 160);
    if (!projectId || !await canAccessProject(pool, session.userId, projectId)) {
      res.status(403).json({ error: "no_access" }); return null;
    }
    if (editor && !await canEdit(pool, projectId, session.userId)) {
      res.status(403).json({ error: "video_room_edit_required" }); return null;
    }
    return session;
  };

  const ownedVersion = async (projectId: string, versionId: string): Promise<any | null> => {
    const result = await pool.query(
      `SELECT * FROM project_video_versions WHERE id=$1 AND project_id=$2 LIMIT 1`,
      [versionId, projectId],
    ).catch(() => ({ rows: [] }));
    return result.rows[0] || null;
  };

  const refreshGeneratedCaption = async (version: any, language: string, userId: string): Promise<void> => {
    if (!version?.stream_uid) return;
    const remote = await getStreamCaption(version.stream_uid, language).catch(() => null);
    if (!remote) return;
    await pool.query(
      `UPDATE project_video_caption_tracks SET status=$3,updated_at=NOW()
        WHERE version_id=$1 AND language=$2 AND generated=true`,
      [version.id, language, remote.status],
    ).catch(() => undefined);
    if (remote.status === "ready" && remote.vtt) {
      await saveCaptionAndTranscript(pool, {
        versionId: version.id, language, label: remote.label || language.toUpperCase(),
        content: remote.vtt, generated: true, userId,
      });
    }
  };

  // Desktop NLE clients need one access-scoped project/version picker. The
  // response deliberately contains no media URLs or share credentials.
  app.get("/api/video-nle/projects", async (req, res) => {
    const session = await sessionFor(req, res); if (!session) return;
    const result = await pool.query(
      `SELECT project.id::text project_id,
              COALESCE(NULLIF(project.title,''),NULLIF(project.name,''),'Uten navn') project_name,
              project.project_type,
              version.id::text version_id,version.version_label,version.version_number,
              version.status version_status,version.created_at,
              (project.user_id=$1 OR EXISTS (
                SELECT 1 FROM project_team_members editable
                 WHERE editable.project_id=project.id::text AND editable.user_id=$1
                   AND editable.status='active' AND editable.deactivated_at IS NULL
                   AND (editable.role='editor' OR editable.permissions @> '{"canEdit":true}'::jsonb)
              )) can_edit
         FROM project_video_versions version
         JOIN projects project ON project.id=version.project_id
        WHERE project.user_id=$1 OR EXISTS (
          SELECT 1 FROM project_team_members member
           WHERE member.project_id=project.id::text AND member.user_id=$1
             AND member.status='active' AND member.deactivated_at IS NULL
        )
        ORDER BY project.created_at DESC NULLS LAST,version.version_number DESC,version.created_at DESC
        LIMIT 500`,
      [session.userId],
    );
    const projects = new Map<string, any>();
    for (const row of result.rows) {
      let project = projects.get(row.project_id);
      if (!project) {
        project = { id: row.project_id, name: row.project_name, projectType: row.project_type || null, canEdit: !!row.can_edit, versions: [] };
        projects.set(row.project_id, project);
      }
      project.versions.push({
        id: row.version_id,
        label: row.version_label || `V${row.version_number}`,
        number: Number(row.version_number || 0),
        status: row.version_status,
        createdAt: row.created_at,
      });
    }
    res.json({ projects: Array.from(projects.values()).slice(0, 100) });
  });

  app.get("/api/projects/:projectId/video-collaboration", async (req, res) => {
    const session = await guard(req, res); if (!session) return;
    const versionId = text(req.query.versionId, 64);
    const version = versionId ? await ownedVersion(req.params.projectId, versionId) : null;
    if (!version) return res.status(404).json({ error: "version_not_found" });
    const pendingCaptions = await pool.query(
      `SELECT language FROM project_video_caption_tracks WHERE version_id=$1 AND generated=true AND status='inprogress'`, [versionId],
    ).catch(() => ({ rows: [] }));
    await Promise.all(pendingCaptions.rows.map((row: any) => refreshGeneratedCaption(version, row.language, session.userId)));
    const search = text(req.query.q, 200);
    const [tasks, rounds, approvalRows, transcript, captions, qc, live, members] = await Promise.all([
      pool.query(`SELECT * FROM project_video_tasks WHERE project_id=$1 AND version_id=$2 ORDER BY created_at DESC`, [req.params.projectId, versionId]),
      pool.query(`SELECT * FROM project_video_review_rounds WHERE project_id=$1 AND version_id=$2 ORDER BY round_number DESC`, [req.params.projectId, versionId]),
      pool.query(`SELECT step.*,approver.id approver_id,approver.name approver_name,approver.email approver_email,approver.role approver_role,approver.status approver_status,approver.note approver_note,approver.acted_at
                    FROM project_video_approval_steps step LEFT JOIN project_video_approvers approver ON approver.step_id=step.id
                   WHERE step.version_id=$1 ORDER BY step.step_order,approver.created_at`, [versionId]),
      pool.query(`SELECT * FROM project_video_transcript_segments WHERE version_id=$1 AND ($2='' OR text ILIKE '%'||$2||'%') ORDER BY segment_index LIMIT 2000`, [versionId, search]),
      pool.query(`SELECT id,language,label,kind,format,is_default,status,generated,created_at,updated_at FROM project_video_caption_tracks WHERE version_id=$1 ORDER BY is_default DESC,language`, [versionId]),
      pool.query(`SELECT * FROM project_video_qc_results WHERE version_id=$1 ORDER BY created_at DESC LIMIT 10`, [versionId]),
      pool.query(`SELECT * FROM project_video_live_sessions WHERE project_id=$1 AND version_id=$2 AND status='live' AND expires_at>NOW() LIMIT 1`, [req.params.projectId, versionId]),
      pool.query(`SELECT user_id,name,email,role FROM project_team_members WHERE project_id=$1 AND status='active' AND deactivated_at IS NULL ORDER BY name`, [req.params.projectId]).catch(() => ({ rows: [] })),
    ]);
    const steps: any[] = [];
    for (const row of approvalRows.rows) {
      let step = steps.find((candidate) => candidate.id === row.id);
      if (!step) { step = { id: row.id, name: row.name, order: row.step_order, requiredApprovals: row.required_approvals, status: row.status, dueAt: row.due_at, approvers: [] }; steps.push(step); }
      if (row.approver_id) step.approvers.push({ id: row.approver_id, name: row.approver_name, email: row.approver_email, role: row.approver_role, status: row.approver_status, note: row.approver_note, actedAt: row.acted_at });
    }
    res.json({ viewerUserId: session.userId, tasks: tasks.rows, rounds: rounds.rows, approvalSteps: steps, transcript: transcript.rows, captions: captions.rows, qc: qc.rows, liveSession: live.rows[0] || null, members: members.rows });
  });

  app.post("/api/projects/:projectId/video-comments/:commentId/task", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const comment = await pool.query(`SELECT * FROM project_video_comments WHERE id=$1 AND project_id=$2 LIMIT 1`, [req.params.commentId, req.params.projectId]);
    if (!comment.rows[0]) return res.status(404).json({ error: "comment_not_found" });
    const row = comment.rows[0]; const assigneeEmail = text(req.body?.assignedToEmail, 320).toLowerCase();
    const result = await pool.query(
      `INSERT INTO project_video_tasks
         (id,project_id,version_id,comment_id,review_round_id,title,description,assigned_to_user_id,assigned_to_name,assigned_to_email,priority,due_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'must-fix',$11,$12)
       ON CONFLICT (comment_id) WHERE comment_id IS NOT NULL DO UPDATE
         SET title=EXCLUDED.title,assigned_to_user_id=EXCLUDED.assigned_to_user_id,assigned_to_name=EXCLUDED.assigned_to_name,
             assigned_to_email=EXCLUDED.assigned_to_email,due_at=EXCLUDED.due_at,updated_at=NOW()
       RETURNING *`,
      [crypto.randomUUID(), req.params.projectId, row.version_id, row.id, row.review_round_id,
       text(req.body?.title, 500) || row.comment.slice(0, 500), row.comment,
       text(req.body?.assignedToUserId, 255) || null, text(req.body?.assignedToName, 300) || null,
       assigneeEmail || null, req.body?.dueAt || null, session.userId],
    );
    await pool.query(`UPDATE project_video_comments SET priority='must-fix' WHERE id=$1`, [row.id]);
    res.status(201).json(result.rows[0]);
  });

  app.patch("/api/projects/:projectId/video-tasks/:taskId", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const status = ["todo","in_progress","blocked","done"].includes(req.body?.status) ? req.body.status : null;
    const result = await pool.query(
      `UPDATE project_video_tasks SET status=COALESCE($1,status),assigned_to_user_id=COALESCE($2,assigned_to_user_id),
              assigned_to_name=COALESCE($3,assigned_to_name),assigned_to_email=COALESCE($4,assigned_to_email),
              completed_at=CASE WHEN $1='done' THEN NOW() WHEN $1 IS NOT NULL THEN NULL ELSE completed_at END,updated_at=NOW()
        WHERE id=$5 AND project_id=$6 RETURNING *`,
      [status, text(req.body?.assignedToUserId, 255) || null, text(req.body?.assignedToName, 300) || null,
       text(req.body?.assignedToEmail, 320).toLowerCase() || null, req.params.taskId, req.params.projectId],
    );
    if (!result.rows[0]) return res.status(404).json({ error: "task_not_found" });
    if (status && result.rows[0].comment_id) {
      await pool.query(`UPDATE project_video_comments SET status=$1 WHERE id=$2`, [status === "done" ? "resolved" : "open", result.rows[0].comment_id]);
      await pool.query(`UPDATE project_video_marker_sync SET completed=$1,sync_revision=sync_revision+1,last_direction='outbound',last_synced_at=NOW() WHERE comment_id=$2`, [status === "done", result.rows[0].comment_id]);
    }
    res.json(result.rows[0]);
  });

  app.post("/api/projects/:projectId/video-rounds", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    if (!version) return res.status(404).json({ error: "version_not_found" });
    const previous = await pool.query(`SELECT * FROM project_video_review_rounds WHERE project_id=$1 ORDER BY round_number DESC LIMIT 1`, [req.params.projectId]);
    const next = Number(previous.rows[0]?.round_number || 0) + 1;
    const maxRounds = Math.max(1, Math.min(99, number(req.body?.maxRounds, previous.rows[0]?.max_rounds || 3)));
    if (next > maxRounds) return res.status(409).json({ error: "revision_round_limit_reached", maxRounds });
    await pool.query(`UPDATE project_video_review_rounds SET status='closed',closed_at=NOW() WHERE project_id=$1 AND status='open'`, [req.params.projectId]);
    const created = await pool.query(
      `INSERT INTO project_video_review_rounds (id,project_id,version_id,round_number,name,max_rounds,opened_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [crypto.randomUUID(), req.params.projectId, version.id, next, text(req.body?.name, 300) || `Revisjonsrunde ${next}`, maxRounds, session.userId],
    );
    res.status(201).json(created.rows[0]);
  });

  app.patch("/api/projects/:projectId/video-rounds/:roundId", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const status = ["closed","cancelled"].includes(req.body?.status) ? req.body.status : "closed";
    const result = await pool.query(`UPDATE project_video_review_rounds SET status=$1,closed_at=NOW() WHERE id=$2 AND project_id=$3 AND status='open' RETURNING *`, [status, req.params.roundId, req.params.projectId]);
    if (!result.rows[0]) return res.status(404).json({ error: "round_not_found" }); res.json(result.rows[0]);
  });

  app.post("/api/projects/:projectId/video-approval-steps", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    if (!version) return res.status(404).json({ error: "version_not_found" });
    const approvers = Array.isArray(req.body?.approvers) ? req.body.approvers.slice(0, 30) : [];
    if (!approvers.length || approvers.some((person: any) => !validEmail(text(person?.email, 320)))) return res.status(400).json({ error: "valid_approvers_required" });
    const client = await pool.connect(); const invitations: any[] = [];
    try {
      await client.query("BEGIN");
      const order = await client.query(`SELECT COALESCE(MAX(step_order),-1)+1 n FROM project_video_approval_steps WHERE version_id=$1`, [version.id]);
      const hasActive = await client.query(`SELECT 1 FROM project_video_approval_steps WHERE version_id=$1 AND status IN ('in_review','changes_requested') LIMIT 1`, [version.id]);
      const step = await client.query(
        `INSERT INTO project_video_approval_steps (id,project_id,version_id,name,step_order,required_approvals,status,due_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [crypto.randomUUID(), req.params.projectId, version.id, text(req.body?.name, 300) || "Godkjenning", Number(order.rows[0].n),
         Math.min(approvers.length, Math.max(1, number(req.body?.requiredApprovals, approvers.length))), hasActive.rows.length ? "pending" : "in_review", req.body?.dueAt || null, session.userId],
      );
      for (const person of approvers) {
        const token = crypto.randomBytes(32).toString("base64url");
        const row = await client.query(
          `INSERT INTO project_video_approvers (id,step_id,user_id,name,email,role,token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [crypto.randomUUID(), step.rows[0].id, text(person.userId, 255) || null, text(person.name, 300) || null, text(person.email, 320).toLowerCase(), text(person.role, 200) || null, sha256(token)],
        );
        invitations.push({ id: row.rows[0].id, email: text(person.email, 320).toLowerCase(), path: `/video-approval/${token}` });
      }
      await client.query("COMMIT"); res.status(201).json({ step: step.rows[0], invitations });
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  });

  app.get("/api/video-approval/:token", async (req, res) => {
    const result = await pool.query(
      `SELECT approver.id,approver.name,approver.email,approver.role,approver.status,approver.note,approver.acted_at,
              step.id step_id,step.name step_name,step.status step_status,step.due_at,version.id version_id,version.version_label,project.id project_id,project.title project_title
         FROM project_video_approvers approver JOIN project_video_approval_steps step ON step.id=approver.step_id
         JOIN project_video_versions version ON version.id=step.version_id JOIN projects project ON project.id=step.project_id
        WHERE approver.token_hash=$1 LIMIT 1`, [sha256(String(req.params.token || ""))],
    ).catch(() => ({ rows: [] }));
    if (!result.rows[0]) return res.status(404).json({ error: "approval_not_found" }); res.json(result.rows[0]);
  });

  app.post("/api/video-approval/:token", async (req, res) => {
    const decision = req.body?.decision === "approved" ? "approved" : req.body?.decision === "changes_requested" ? "changes_requested" : null;
    if (!decision) return res.status(400).json({ error: "decision_required" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        `SELECT approver.*,step.project_id,step.version_id,step.status step_status,step.required_approvals,step.step_order
           FROM project_video_approvers approver JOIN project_video_approval_steps step ON step.id=approver.step_id
          WHERE approver.token_hash=$1 FOR UPDATE`, [sha256(String(req.params.token || ""))],
      );
      const actor = current.rows[0];
      if (!actor) { await client.query("ROLLBACK"); return res.status(404).json({ error: "approval_not_found" }); }
      if (actor.step_status !== "in_review") { await client.query("ROLLBACK"); return res.status(409).json({ error: "approval_step_not_active" }); }
      if (actor.status !== "pending") { await client.query("ROLLBACK"); return res.status(409).json({ error: "approval_already_submitted" }); }
      await client.query(`UPDATE project_video_approvers SET status=$1,note=$2,acted_at=NOW() WHERE id=$3`, [decision, text(req.body?.note, 3000) || null, actor.id]);
      const tally = await client.query(`SELECT count(*) FILTER (WHERE status='approved')::int approved,count(*) FILTER (WHERE status='changes_requested')::int changes FROM project_video_approvers WHERE step_id=$1`, [actor.step_id]);
      let stepStatus = "in_review";
      if (tally.rows[0].changes > 0) stepStatus = "changes_requested";
      else if (tally.rows[0].approved >= actor.required_approvals) stepStatus = "approved";
      await client.query(`UPDATE project_video_approval_steps SET status=$1,updated_at=NOW() WHERE id=$2`, [stepStatus, actor.step_id]);
      if (stepStatus === "approved") {
        const next = await client.query(`UPDATE project_video_approval_steps SET status='in_review',updated_at=NOW() WHERE id=(SELECT id FROM project_video_approval_steps WHERE version_id=$1 AND step_order>$2 AND status='pending' ORDER BY step_order LIMIT 1) RETURNING id`, [actor.version_id, actor.step_order]);
        if (!next.rows[0]) await client.query(`UPDATE project_video_versions SET status='approved' WHERE id=$1`, [actor.version_id]);
      } else if (stepStatus === "changes_requested") {
        await client.query(`UPDATE project_video_versions SET status='changes_requested' WHERE id=$1`, [actor.version_id]);
      }
      await client.query("COMMIT"); res.json({ ok: true, stepStatus });
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  });

  app.get("/api/projects/:projectId/video-marker-sync/:editor", async (req, res) => {
    const session = await guard(req, res); if (!session) return;
    const editor = ["resolve","premiere","final_cut","generic"].includes(req.params.editor) ? req.params.editor : "generic";
    const version = await ownedVersion(req.params.projectId, text(req.query.versionId, 64));
    if (!version) return res.status(404).json({ error: "version_not_found" });
    const rows = await pool.query(
      `SELECT sync.id,COALESCE(sync.external_marker_id,'creatorhub:'||comment.id::text) external_marker_id,
              comment.timecode_sec,
              COALESCE(CASE WHEN comment.edited_at>sync.last_synced_at THEN left(comment.comment,200) END,sync.title,left(comment.comment,200)) title,
              COALESCE(CASE WHEN comment.edited_at>sync.last_synced_at THEN comment.comment END,sync.note,comment.comment) note,
              (comment.status IN ('resolved','done')) completed,sync.color,sync.sync_revision,comment.priority
         FROM project_video_comments comment LEFT JOIN project_video_marker_sync sync ON sync.comment_id=comment.id AND sync.editor=$3
        WHERE comment.project_id=$1 AND comment.version_id=$2 AND comment.parent_id IS NULL
        ORDER BY comment.timecode_sec`, [req.params.projectId, version.id, editor],
    );
    const markers = rows.rows.map((row: any) => ({ id: row.external_marker_id, timecodeSec: number(row.timecode_sec), title: row.title, note: row.note, color: row.color, completed: !!row.completed, mustFix: row.priority === "must-fix", revision: Number(row.sync_revision || 0) }));
    if (req.query.format === "fcpxml") { res.type("application/xml"); res.setHeader("Content-Disposition", `attachment; filename="creatorhub-${version.id}.fcpxml"`); return res.send(fcpxml(markers)); }
    res.json({ editor, versionId: version.id, revision: Math.max(0, ...markers.map((marker) => marker.revision)), markers });
  });

  app.post("/api/projects/:projectId/video-marker-sync/:editor", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const editor = ["resolve","premiere","final_cut","generic"].includes(req.params.editor) ? req.params.editor : null;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    const markers = Array.isArray(req.body?.markers) ? req.body.markers.slice(0, 5000) : [];
    if (!editor || !version || !markers.length) return res.status(400).json({ error: "editor_version_and_markers_required" });
    const revisionResult = await pool.query(`SELECT COALESCE(MAX(sync_revision),0)+1 revision FROM project_video_marker_sync WHERE version_id=$1 AND editor=$2`, [version.id, editor]);
    const revision = Number(revisionResult.rows[0].revision); const client = await pool.connect(); let imported = 0;
    try {
      await client.query("BEGIN");
      for (const raw of markers) {
        const externalId = text(raw?.id || raw?.externalMarkerId, 500); const title = text(raw?.title, 500); if (!externalId || !title) continue;
        const existing = await client.query(`SELECT comment_id,task_id FROM project_video_marker_sync WHERE version_id=$1 AND editor=$2 AND external_marker_id=$3`, [version.id, editor, externalId]);
        let commentId = existing.rows[0]?.comment_id || null;
        if (!commentId && /^creatorhub:[0-9a-f-]{36}$/i.test(externalId)) {
          const canonicalComment = await client.query(
            `SELECT id FROM project_video_comments WHERE id=$1::uuid AND version_id=$2 AND project_id=$3 LIMIT 1`,
            [externalId.slice("creatorhub:".length), version.id, req.params.projectId],
          );
          commentId = canonicalComment.rows[0]?.id || null;
          // A cloud-deleted canonical comment is a tombstone. Never recreate
          // it from a stale marker left in an NLE.
          if (!commentId) continue;
        }
        // ON DELETE SET NULL leaves the sync identity as an explicit tombstone
        // for Resolve-created comments too.
        if (existing.rows.length && !commentId) continue;
        if (!commentId) {
          commentId = crypto.randomUUID();
          await client.query(`INSERT INTO project_video_comments (id,version_id,project_id,timecode_sec,comment,author_name,author_kind,category,priority,status) VALUES ($1,$2,$3,$4,$5,$6,'editor','edit',$7,$8)`,
            [commentId, version.id, req.params.projectId, Math.max(0, number(raw.timecodeSec)), text(raw.note, 4000) || title, editor, raw.mustFix ? "must-fix" : "suggestion", raw.completed ? "resolved" : "open"]);
        } else {
          await client.query(`UPDATE project_video_comments SET timecode_sec=$1,comment=$2,status=$3,priority=CASE WHEN $5 THEN 'must-fix' ELSE priority END WHERE id=$4`, [Math.max(0, number(raw.timecodeSec)), text(raw.note, 4000) || title, raw.completed ? "resolved" : "open", commentId, !!raw.mustFix]);
        }
        const sync = await client.query(
          `INSERT INTO project_video_marker_sync (id,project_id,version_id,editor,external_marker_id,comment_id,timecode_sec,title,note,color,completed,payload,sync_revision,last_direction)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,'inbound')
           ON CONFLICT (version_id,editor,external_marker_id) DO UPDATE SET comment_id=EXCLUDED.comment_id,timecode_sec=EXCLUDED.timecode_sec,title=EXCLUDED.title,note=EXCLUDED.note,color=EXCLUDED.color,completed=EXCLUDED.completed,payload=EXCLUDED.payload,sync_revision=EXCLUDED.sync_revision,last_direction='inbound',last_synced_at=NOW()
           RETURNING id`,
          [crypto.randomUUID(), req.params.projectId, version.id, editor, externalId, commentId, Math.max(0, number(raw.timecodeSec)), title, text(raw.note, 4000) || null, text(raw.color, 40) || null, !!raw.completed, JSON.stringify(raw), revision],
        );
        if (raw.mustFix) await client.query(
          `INSERT INTO project_video_tasks (id,project_id,version_id,comment_id,title,description,priority,source,created_by,external_refs)
           VALUES ($1,$2,$3,$4,$5,$6,'must-fix','nle_marker',$7,$8::jsonb)
           ON CONFLICT (comment_id) WHERE comment_id IS NOT NULL DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,external_refs=EXCLUDED.external_refs,updated_at=NOW()`,
          [crypto.randomUUID(), req.params.projectId, version.id, commentId, title, text(raw.note, 4000) || title, session.userId, JSON.stringify({ [editor]: sync.rows[0].id })],
        );
        await client.query(
          `UPDATE project_video_tasks
              SET status=CASE WHEN $2 THEN 'done' WHEN status='done' THEN 'todo' ELSE status END,
                  completed_at=CASE WHEN $2 THEN COALESCE(completed_at,NOW()) WHEN status='done' THEN NULL ELSE completed_at END,
                  updated_at=NOW()
            WHERE comment_id=$1 AND (($2 AND status<>'done') OR (NOT $2 AND status='done'))`,
          [commentId, !!raw.completed],
        );
        imported += 1;
      }
      await client.query("COMMIT"); res.json({ imported, revision });
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  });

  app.post("/api/projects/:projectId/video-transcription/generate", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    const language = text(req.body?.language, 20) || "no";
    if (!version?.stream_uid || !/^[a-zA-Z0-9-]{2,20}$/.test(language)) return res.status(400).json({ error: "ready_stream_version_required" });
    const remote = await generateStreamCaptions(version.stream_uid, language);
    await pool.query(
      `INSERT INTO project_video_caption_tracks (id,version_id,language,label,kind,format,content,is_default,status,generated,created_by)
       VALUES ($1,$2,$3,$4,'subtitles','vtt','',true,$5,true,$6)
       ON CONFLICT (version_id,language,format) DO UPDATE SET status=EXCLUDED.status,generated=true,updated_at=NOW()`,
      [crypto.randomUUID(), version.id, language, remote.label || language.toUpperCase(), remote.status, session.userId],
    );
    res.status(202).json({ status: remote.status, language });
  });

  app.put("/api/projects/:projectId/video-captions/:language", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    const content = text(req.body?.content, 2_000_000); const language = text(req.params.language, 20);
    if (!version || !content.startsWith("WEBVTT") || !language) return res.status(400).json({ error: "version_and_webvtt_required" });
    await saveCaptionAndTranscript(pool, { versionId: version.id, language, label: text(req.body?.label, 100) || language.toUpperCase(), content, generated: false, userId: session.userId });
    res.json({ ok: true, segments: parseVideoVtt(content).length });
  });

  app.get("/api/projects/:projectId/video-captions/:captionId/file", async (req, res) => {
    const session = await guard(req, res); if (!session) return;
    const result = await pool.query(`SELECT caption.* FROM project_video_caption_tracks caption JOIN project_video_versions version ON version.id=caption.version_id WHERE caption.id=$1 AND version.project_id=$2`, [req.params.captionId, req.params.projectId]);
    if (!result.rows[0]) return res.status(404).json({ error: "caption_not_found" });
    res.type("text/vtt"); res.setHeader("Content-Disposition", `attachment; filename="captions-${result.rows[0].language}.vtt"`); res.send(result.rows[0].content);
  });

  app.post("/api/projects/:projectId/video-qc", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    if (!version) return res.status(404).json({ error: "version_not_found" });
    if (!version.stream_uid && !version.b2_key && !version.file_url) return res.status(409).json({ error: "video_source_missing" });
    if (version.stream_uid) {
      const streamStatus = await getStreamVideoStatus(version.stream_uid).catch(() => null);
      if (streamStatus && !streamStatus.ready) return res.status(409).json({ error: "stream_not_ready", detail: streamStatus.error || streamStatus.state });
    }
    const profile = ["web_delivery", "client_delivery", "broadcast", "social"].includes(req.body?.profile)
      ? req.body.profile : "web_delivery";
    const qcId = crypto.randomUUID();
    const created = await pool.query(
      `INSERT INTO project_video_qc_results (id,project_id,version_id,status,profile,summary,findings,probe,created_by)
       VALUES ($1,$2,$3,'running',$4,$5::jsonb,'[]'::jsonb,'{}'::jsonb,$6)
       ON CONFLICT (version_id) WHERE status='running' DO NOTHING
       RETURNING *`,
      [qcId, req.params.projectId, version.id, profile, JSON.stringify({ phase: "queued", findingCount: 0 }), session.userId],
    );
    if (!created.rows[0]) {
      const active = await pool.query(`SELECT * FROM project_video_qc_results WHERE version_id=$1 AND status='running' ORDER BY created_at DESC LIMIT 1`, [version.id]);
      return res.status(202).json(active.rows[0]);
    }
    try {
      const queued = await enqueueJob(pool, {
        jobType: "project_video_qc",
        payload: { qcResultId: qcId },
        dedupeKey: `project_video_qc|${version.id}`,
        // Full decode can run for hours; keep quick workflow jobs ahead of it.
        priority: 180,
        maxAttempts: 2,
        createdBy: session.userId,
      });
      if (!queued.enqueued) throw new Error("video_qc_queue_conflict");
    } catch (error) {
      await pool.query(
        `UPDATE project_video_qc_results SET status='failed',summary=$2::jsonb,completed_at=NOW() WHERE id=$1`,
        [qcId, JSON.stringify({ phase: "queue_failed", findingCount: 1 })],
      );
      throw error;
    }
    res.status(202).json(created.rows[0]);
  });

  app.post("/api/projects/:projectId/video-live", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    const version = await ownedVersion(req.params.projectId, text(req.body?.versionId, 64));
    if (!version) return res.status(404).json({ error: "version_not_found" });
    const created = await pool.query(
      `INSERT INTO project_video_live_sessions (id,project_id,version_id,host_user_id,status,playhead_sec,is_playing,drawing)
       VALUES ($1,$2,$3,$4,'live',$5,$6,$7::jsonb)
       ON CONFLICT (project_id) WHERE status='live' DO UPDATE SET version_id=EXCLUDED.version_id,host_user_id=EXCLUDED.host_user_id,playhead_sec=EXCLUDED.playhead_sec,is_playing=EXCLUDED.is_playing,drawing=EXCLUDED.drawing,revision=project_video_live_sessions.revision+1,expires_at=NOW()+INTERVAL '8 hours',updated_at=NOW()
       RETURNING *`,
      [crypto.randomUUID(), req.params.projectId, version.id, session.userId, Math.max(0, number(req.body?.playheadSec)), !!req.body?.isPlaying, req.body?.drawing ? JSON.stringify(req.body.drawing) : null],
    );
    res.status(201).json(created.rows[0]);
  });

  app.patch("/api/projects/:projectId/video-live/:sessionId", async (req, res) => {
    const session = await guard(req, res); if (!session) return;
    const revision = Math.max(0, Math.floor(number(req.body?.revision)));
    const updated = await pool.query(
      `UPDATE project_video_live_sessions SET playhead_sec=$1,is_playing=$2,drawing=$3::jsonb,revision=revision+1,updated_at=NOW(),expires_at=NOW()+INTERVAL '8 hours'
        WHERE id=$4 AND project_id=$5 AND status='live' AND revision=$6 RETURNING *`,
      [Math.max(0, number(req.body?.playheadSec)), !!req.body?.isPlaying, req.body?.drawing ? JSON.stringify(req.body.drawing) : null, req.params.sessionId, req.params.projectId, revision],
    );
    if (!updated.rows[0]) {
      const current = await pool.query(`SELECT * FROM project_video_live_sessions WHERE id=$1 AND project_id=$2`, [req.params.sessionId, req.params.projectId]);
      return res.status(409).json({ error: "live_revision_conflict", current: current.rows[0] || null });
    }
    res.json(updated.rows[0]);
  });

  app.delete("/api/projects/:projectId/video-live/:sessionId", async (req, res) => {
    const session = await guard(req, res, true); if (!session) return;
    await pool.query(`UPDATE project_video_live_sessions SET status='ended',updated_at=NOW() WHERE id=$1 AND project_id=$2`, [req.params.sessionId, req.params.projectId]); res.json({ ok: true });
  });

  const publicShare = async (req: any, res: any): Promise<any | null> => {
    const result = await pool.query(`SELECT * FROM project_video_share_links WHERE token_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) LIMIT 1`, [hashVideoShareToken(String(req.params.token || ""))]).catch(() => ({ rows: [] }));
    const share = result.rows[0]; if (!share) { res.status(404).json({ error: "link_invalid_or_expired" }); return null; }
    if (share.password_hash && share.password_salt) {
      const actual = Buffer.from(hashVideoSharePassword(String(req.headers["x-video-review-password"] || ""), share.password_salt), "hex");
      const expected = Buffer.from(share.password_hash, "hex");
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) { res.status(401).json({ error: "password_required" }); return null; }
    }
    return share;
  };

  app.get("/api/video-review/:token/live", async (req, res) => {
    const share = await publicShare(req, res); if (!share) return;
    const live = await pool.query(`SELECT id,version_id,status,playhead_sec,is_playing,drawing,revision,updated_at FROM project_video_live_sessions WHERE project_id=$1 AND status='live' AND expires_at>NOW() LIMIT 1`, [share.project_id]);
    res.json({ liveSession: live.rows[0] || null });
  });

  app.patch("/api/video-review/:token/live/:sessionId", async (req, res) => {
    const share = await publicShare(req, res); if (!share) return;
    if (share.access_mode === "view") return res.status(403).json({ error: "comment_access_required" });
    if (!allowPublicLiveWrite(String(req.params.token || ""))) return res.status(429).json({ error: "live_update_rate_limited" });
    const revision = Math.max(0, Math.floor(number(req.body?.revision)));
    const updated = await pool.query(
      `UPDATE project_video_live_sessions SET playhead_sec=$1,is_playing=$2,drawing=$3::jsonb,revision=revision+1,updated_at=NOW()
        WHERE id=$4 AND project_id=$5 AND status='live' AND revision=$6 RETURNING id,version_id,playhead_sec,is_playing,drawing,revision,updated_at`,
      [Math.max(0, number(req.body?.playheadSec)), !!req.body?.isPlaying, req.body?.drawing ? JSON.stringify(req.body.drawing) : null, req.params.sessionId, share.project_id, revision],
    );
    if (!updated.rows[0]) return res.status(409).json({ error: "live_revision_conflict" }); res.json(updated.rows[0]);
  });
}
