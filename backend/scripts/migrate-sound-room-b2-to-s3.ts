#!/usr/bin/env node
import "dotenv/config";
import pg from "pg";

import { processSoundRoomAudioVersion } from "../server/sound-room-audio-processing.js";
import {
  deleteVerifiedLegacySoundRoomSource,
  extractLegacyB2Key,
  migrateLegacySoundRoomVersion,
  type LegacySoundRoomVersion,
} from "../server/sound-room-b2-migration.js";
import { getLegacyRoleRoomB2Storage } from "../server/role-room-object-storage.js";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const migrateAll = args.includes("--all");
const deleteSource = args.includes("--delete-source-after-verify");
const skipProcessing = args.includes("--skip-processing");
const versionId = args.find((arg) => arg.startsWith("--version="))?.slice("--version=".length);
const limit = Math.min(10_000, Math.max(1, Number(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 100)));

if (!migrateAll && !versionId) {
  console.error("Bruk --all eller --version=<uuid>. Legg til --execute for å kopiere.");
  process.exit(2);
}
if (deleteSource && !execute) {
  console.error("--delete-source-after-verify krever --execute.");
  process.exit(2);
}
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL mangler");
const legacy = getLegacyRoleRoomB2Storage();
if (!legacy) throw new Error("Legacy B2-miljøvariabler mangler");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

try {
  const result = await pool.query<LegacySoundRoomVersion>(
    `SELECT version.id,version.project_id,project.owner_user_id,version.file_name,version.file_url,
            version.file_size,version.content_type
       FROM audio_review_versions version
       JOIN audio_review_projects project ON project.id=version.project_id
      WHERE version.storage_object_id IS NULL AND version.storage_state='legacy'
        AND ($1::uuid IS NULL OR version.id=$1::uuid)
      ORDER BY version.created_at
      LIMIT $2`,
    [versionId || null, limit],
  );
  const eligible = result.rows.filter((row) => extractLegacyB2Key(row.file_url, legacy.bucket));
  console.log(JSON.stringify({ mode: execute ? "execute" : "plan", selected: result.rowCount, eligible: eligible.length, deleteSourceAfterVerify: deleteSource }, null, 2));
  for (const version of eligible) {
    const sourceKey = extractLegacyB2Key(version.file_url, legacy.bucket)!;
    if (!execute) {
      console.log(JSON.stringify({ versionId: version.id, projectId: version.project_id, sourceKey, action: "copy-verify-retain" }));
      continue;
    }
    try {
      const migrated = await migrateLegacySoundRoomVersion(pool, version);
      if (!skipProcessing) await processSoundRoomAudioVersion(pool, version.id, version.owner_user_id);
      let deleted = false;
      if (deleteSource) deleted = await deleteVerifiedLegacySoundRoomSource(pool, migrated.migrationId);
      console.log(JSON.stringify({ ...migrated, previewAndWaveform: !skipProcessing, sourceDeleted: deleted }));
    } catch (error) {
      console.error(JSON.stringify({ versionId: version.id, sourceKey, error: error instanceof Error ? error.message : String(error) }));
      process.exitCode = 1;
    }
  }
} finally {
  await pool.end();
}
