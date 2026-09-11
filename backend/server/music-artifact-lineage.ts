import crypto from "node:crypto";

export type MusicArtifactKind = "take" | "stem" | "mix" | "reference" | "keeper" | "master";
export type MusicSourceSystem = "easeverse" | "protools" | "sound_room";
export type CompanionCommandKind = "locate" | "create_marker" | "import_audio" | "export_review";

export type MusicQueryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>;
};

export interface MusicArtifactInput {
  organizationId?: string | null;
  ownerUserId: string;
  workspaceProjectId?: string | null;
  audioReviewProjectId?: string | null;
  easeverseTrackId?: string | null;
  easeverseProjectId?: string | null;
  companionSessionId?: string | null;
  reviewVersionId?: string | null;
  parentArtifactId?: string | null;
  kind: MusicArtifactKind;
  sourceSystem: MusicSourceSystem;
  sourceArtifactId: string;
  fileName?: string | null;
  fileUrl?: string | null;
  storageKey?: string | null;
  contentFingerprint?: string | null;
  status?: "active" | "superseded" | "approved" | "archived";
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

const ARTIFACT_KINDS = new Set<MusicArtifactKind>(["take", "stem", "mix", "reference", "keeper", "master"]);
const COMMAND_KINDS = new Set<CompanionCommandKind>(["locate", "create_marker", "import_audio", "export_review"]);

function clipped(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

export function validateCompanionCommand(
  kind: unknown,
  rawPayload: unknown,
): { kind: CompanionCommandKind; payload: Record<string, unknown> } | null {
  if (typeof kind !== "string" || !COMMAND_KINDS.has(kind as CompanionCommandKind)) return null;
  const input = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
    ? { ...(rawPayload as Record<string, unknown>) }
    : {};
  const payload: Record<string, unknown> = {};

  if (kind === "locate" || kind === "create_marker") {
    const seconds = Number(input.seconds);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 60 * 60) return null;
    payload.seconds = seconds;
    const commentId = clipped(input.commentId, 160);
    if (commentId) payload.commentId = commentId;
    if (kind === "create_marker") {
      payload.name = clipped(input.name, 200) || "Sound Room feedback";
    }
  }
  if (kind === "import_audio") {
    const artifactId = clipped(input.artifactId, 160);
    if (!artifactId) return null;
    payload.artifactId = artifactId;
    const fileName = clipped(input.fileName, 200);
    if (fileName) payload.fileName = fileName;
  }
  if (kind === "export_review") {
    const requestedName = clipped(input.fileName, 200) || "Sound Room Mix.wav";
    const safeName = requestedName.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/^\.+/, "").trim();
    payload.fileName = safeName || "Sound Room Mix.wav";
  }
  return { kind: kind as CompanionCommandKind, payload };
}

export async function ensureMusicIntegrationSchema(database: MusicQueryable): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS creatorhub_music_artifacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id VARCHAR(160), owner_user_id VARCHAR(64) NOT NULL,
      workspace_project_id VARCHAR(160), audio_review_project_id UUID REFERENCES audio_review_projects(id) ON DELETE SET NULL,
      easeverse_track_id VARCHAR(160), easeverse_project_id VARCHAR(160),
      companion_session_id UUID REFERENCES protools_companion_sessions(id) ON DELETE SET NULL,
      review_version_id UUID REFERENCES audio_review_versions(id) ON DELETE SET NULL,
      parent_artifact_id UUID REFERENCES creatorhub_music_artifacts(id) ON DELETE SET NULL,
      artifact_kind VARCHAR(24) NOT NULL, source_system VARCHAR(24) NOT NULL, source_artifact_id VARCHAR(240),
      file_name TEXT, file_url TEXT, storage_key TEXT, content_fingerprint VARCHAR(400), revision INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(24) NOT NULL DEFAULT 'active', metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_by VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS creatorhub_music_artifacts_source_uq
      ON creatorhub_music_artifacts(owner_user_id,source_system,source_artifact_id) WHERE source_artifact_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_workspace_idx
      ON creatorhub_music_artifacts(workspace_project_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_audio_room_idx
      ON creatorhub_music_artifacts(audio_review_project_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS creatorhub_music_artifacts_track_idx
      ON creatorhub_music_artifacts(easeverse_track_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS protools_companion_commands (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID NOT NULL REFERENCES protools_companion_sessions(id) ON DELETE CASCADE,
      device_token_id VARCHAR(160) NOT NULL, user_id VARCHAR(64) NOT NULL, command_kind VARCHAR(32) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb, dedupe_key VARCHAR(300) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), lock_token UUID,
      locked_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, result JSONB, last_error TEXT, requested_by VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(session_id,dedupe_key)
    );
    CREATE INDEX IF NOT EXISTS protools_companion_commands_due_idx
      ON protools_companion_commands(device_token_id,status,next_attempt_at,created_at);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS ptsl_session_id VARCHAR(160);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS ptsl_host_version VARCHAR(80);
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS ptsl_status VARCHAR(24) NOT NULL DEFAULT 'unavailable';
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS protools_tier VARCHAR(24) NOT NULL DEFAULT 'unknown';
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS intro_preflight JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE protools_companion_sessions ADD COLUMN IF NOT EXISTS last_ptsl_sync_at TIMESTAMPTZ;
    ALTER TABLE protools_companion_bounces ADD COLUMN IF NOT EXISTS artifact_id UUID REFERENCES creatorhub_music_artifacts(id) ON DELETE SET NULL;
    ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS protools_marker_id VARCHAR(160);
    ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS protools_sync_status VARCHAR(24);
    ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS protools_synced_at TIMESTAMPTZ;
  `);
}

export async function latestParentArtifactId(
  database: MusicQueryable,
  input: Pick<MusicArtifactInput, "ownerUserId" | "audioReviewProjectId" | "easeverseTrackId">,
): Promise<string | null> {
  const result = await database.query(
    `SELECT id FROM creatorhub_music_artifacts
      WHERE owner_user_id=$1
        AND (($2::uuid IS NOT NULL AND audio_review_project_id=$2::uuid)
          OR ($3::text IS NOT NULL AND easeverse_track_id=$3))
      ORDER BY created_at DESC,id DESC LIMIT 1`,
    [input.ownerUserId, input.audioReviewProjectId || null, input.easeverseTrackId || null],
  );
  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

export async function upsertMusicArtifact(database: MusicQueryable, input: MusicArtifactInput): Promise<any> {
  if (!ARTIFACT_KINDS.has(input.kind)) throw new Error("invalid_music_artifact_kind");
  const sourceArtifactId = clipped(input.sourceArtifactId, 240);
  if (!sourceArtifactId) throw new Error("source_artifact_id_required");
  const result = await database.query(
    `INSERT INTO creatorhub_music_artifacts
       (organization_id,owner_user_id,workspace_project_id,audio_review_project_id,easeverse_track_id,easeverse_project_id,
        companion_session_id,review_version_id,parent_artifact_id,artifact_kind,source_system,source_artifact_id,
        file_name,file_url,storage_key,content_fingerprint,status,metadata,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)
     ON CONFLICT(owner_user_id,source_system,source_artifact_id) WHERE source_artifact_id IS NOT NULL
     DO UPDATE SET
       workspace_project_id=COALESCE(EXCLUDED.workspace_project_id,creatorhub_music_artifacts.workspace_project_id),
       audio_review_project_id=COALESCE(EXCLUDED.audio_review_project_id,creatorhub_music_artifacts.audio_review_project_id),
       easeverse_track_id=COALESCE(EXCLUDED.easeverse_track_id,creatorhub_music_artifacts.easeverse_track_id),
       companion_session_id=COALESCE(EXCLUDED.companion_session_id,creatorhub_music_artifacts.companion_session_id),
       review_version_id=COALESCE(EXCLUDED.review_version_id,creatorhub_music_artifacts.review_version_id),
       parent_artifact_id=COALESCE(EXCLUDED.parent_artifact_id,creatorhub_music_artifacts.parent_artifact_id),
       file_name=COALESCE(EXCLUDED.file_name,creatorhub_music_artifacts.file_name),
       file_url=COALESCE(EXCLUDED.file_url,creatorhub_music_artifacts.file_url),
       storage_key=COALESCE(EXCLUDED.storage_key,creatorhub_music_artifacts.storage_key),
       content_fingerprint=COALESCE(EXCLUDED.content_fingerprint,creatorhub_music_artifacts.content_fingerprint),
       status=EXCLUDED.status,metadata=creatorhub_music_artifacts.metadata||EXCLUDED.metadata,
       revision=creatorhub_music_artifacts.revision+1,updated_at=NOW()
     RETURNING *`,
    [input.organizationId || null, input.ownerUserId, input.workspaceProjectId || null,
     input.audioReviewProjectId || null, input.easeverseTrackId || null, input.easeverseProjectId || null,
     input.companionSessionId || null, input.reviewVersionId || null, input.parentArtifactId || null,
     input.kind, input.sourceSystem, sourceArtifactId, input.fileName || null, input.fileUrl || null,
     input.storageKey || null, input.contentFingerprint || null, input.status || "active",
     JSON.stringify(input.metadata || {}), input.createdBy || input.ownerUserId],
  );
  return result.rows[0];
}

export async function queueCompanionCommand(database: MusicQueryable, input: {
  sessionId: string;
  deviceTokenId: string;
  userId: string;
  requestedBy: string;
  kind: CompanionCommandKind;
  payload: Record<string, unknown>;
  dedupeKey?: string | null;
}): Promise<any> {
  const validated = validateCompanionCommand(input.kind, input.payload);
  if (!validated) throw new Error("invalid_companion_command");
  const dedupeKey = clipped(input.dedupeKey, 300)
    || `${validated.kind}:${crypto.createHash("sha256").update(JSON.stringify(validated.payload)).digest("hex")}`;
  const result = await database.query(
    `INSERT INTO protools_companion_commands
       (session_id,device_token_id,user_id,command_kind,payload,dedupe_key,requested_by)
     VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6,$7)
     ON CONFLICT(session_id,dedupe_key) DO UPDATE SET
       status=CASE WHEN protools_companion_commands.status='failed' THEN 'pending' ELSE protools_companion_commands.status END,
       next_attempt_at=CASE WHEN protools_companion_commands.status='failed' THEN NOW() ELSE protools_companion_commands.next_attempt_at END,
       last_error=CASE WHEN protools_companion_commands.status='failed' THEN NULL ELSE protools_companion_commands.last_error END,
       completed_at=CASE WHEN protools_companion_commands.status='failed' THEN NULL ELSE protools_companion_commands.completed_at END,
       updated_at=NOW()
     RETURNING *`,
    [input.sessionId, input.deviceTokenId, input.userId, validated.kind,
     JSON.stringify(validated.payload), dedupeKey, input.requestedBy],
  );
  return result.rows[0];
}

export async function claimCompanionCommands(database: MusicQueryable, input: {
  sessionId: string;
  deviceTokenId: string;
  userId: string;
  limit?: number;
}): Promise<any[]> {
  const limit = Math.max(1, Math.min(20, Number(input.limit) || 10));
  const lockToken = crypto.randomUUID();
  const result = await database.query(
    `WITH due AS (
       SELECT id FROM protools_companion_commands
        WHERE session_id=$1::uuid AND device_token_id=$2 AND user_id=$3
          AND ((status='pending' AND next_attempt_at<=NOW())
            OR (status='processing' AND locked_at<NOW()-INTERVAL '2 minutes'))
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT $4
     )
     UPDATE protools_companion_commands c
        SET status='processing',lock_token=$5::uuid,locked_at=NOW(),attempt_count=attempt_count+1,updated_at=NOW()
       FROM due WHERE c.id=due.id RETURNING c.*`,
    [input.sessionId, input.deviceTokenId, input.userId, limit, lockToken],
  );
  return result.rows;
}

export const musicArtifactInternals = { clipped };
