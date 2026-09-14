#!/usr/bin/env node
import "dotenv/config";
import pg from "pg";

import { migrateLegacyCaptureObject } from "../server/capture-upload-service.js";
import { buildPhotoRoomCaptureKey, isCreatorHubPhotoRoomKey } from "../server/photo-room-storage-contract.js";

const args = process.argv.slice(2);
const execute = args.includes("--execute");
const limit = Math.min(10_000, Math.max(1, Number(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 100)));
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL mangler");

type AssetRow = {
  id: string;
  session_id: string;
  owner_user_id: string;
  project_id: string | null;
  original_filename: string;
  checksum_sha256: string | null;
  preview_key: string | null;
  full_key: string | null;
  raw_key: string | null;
  auto_cleaned_key: string | null;
};

type ReviewAudioRow = {
  id: string;
  asset_id: string;
  session_id: string;
  owner_user_id: string;
  project_id: string | null;
  audio_key: string;
};

const columns = [
  ["preview_key", "preview"],
  ["full_key", "full"],
  ["raw_key", "raw"],
  ["auto_cleaned_key", "cleaned"],
] as const;

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
try {
  const result = await pool.query<AssetRow>(
    `SELECT asset.id, asset.session_id, session.owner_user_id, session.project_id,
            asset.original_filename, asset.checksum_sha256, asset.preview_key,
            asset.full_key, asset.raw_key, asset.auto_cleaned_key
       FROM capture_assets asset
       JOIN capture_sessions session ON session.id=asset.session_id
      WHERE (asset.preview_key IS NOT NULL OR asset.full_key IS NOT NULL OR asset.raw_key IS NOT NULL OR asset.auto_cleaned_key IS NOT NULL)
      ORDER BY asset.created_at LIMIT $1`, [limit],
  );
  const planned = result.rows.flatMap((row) => columns.flatMap(([column, kind]) => {
    const legacyKey = row[column];
    if (!legacyKey || isCreatorHubPhotoRoomKey(legacyKey)) return [];
    return [{ row, column, kind, legacyKey }];
  }));
  const reviewResult = await pool.query<ReviewAudioRow>(
    `SELECT review.id, review.asset_id, asset.session_id, session.owner_user_id,
            session.project_id, review.audio_key
       FROM capture_reviews review
       JOIN capture_assets asset ON asset.id=review.asset_id
       JOIN capture_sessions session ON session.id=asset.session_id
      WHERE review.audio_key IS NOT NULL
      ORDER BY review.created_at LIMIT $1`, [limit],
  );
  const plannedReviews = reviewResult.rows.filter((row) => !isCreatorHubPhotoRoomKey(row.audio_key));
  console.log(JSON.stringify({
    mode: execute ? "execute" : "plan",
    assets: result.rowCount,
    reviewRecordings: reviewResult.rowCount,
    objects: planned.length + plannedReviews.length,
    sourceDeletion: "never",
  }, null, 2));
  for (const item of planned) {
    const targetKey = buildPhotoRoomCaptureKey({
      userId: item.row.owner_user_id,
      projectId: item.row.project_id,
      sessionId: item.row.session_id,
      assetId: item.row.id,
      kind: item.kind,
      fileName: item.kind === "cleaned" ? "cleaned.jpg" : item.row.original_filename,
    });
    if (!execute) {
      console.log(JSON.stringify({ assetId: item.row.id, column: item.column, sourceKey: item.legacyKey, targetKey, action: "copy-verify-retain" }));
      continue;
    }
    try {
      const verified = await migrateLegacyCaptureObject({
        legacyKey: item.legacyKey,
        creatorHubKey: targetKey,
        expectedSha256: item.kind === "full" || item.kind === "raw" ? item.row.checksum_sha256 : null,
      });
      await pool.query(
        `UPDATE capture_assets SET ${item.column}=$1, updated_at=now()
          WHERE id=$2 AND ${item.column}=$3`,
        [targetKey, item.row.id, item.legacyKey],
      );
      console.log(JSON.stringify({ assetId: item.row.id, column: item.column, targetKey, ...verified, sourceRetained: true }));
    } catch (error) {
      console.error(JSON.stringify({ assetId: item.row.id, column: item.column, error: error instanceof Error ? error.message : String(error), sourceRetained: true }));
      process.exitCode = 1;
    }
  }
  for (const row of plannedReviews) {
    const targetKey = buildPhotoRoomCaptureKey({
      userId: row.owner_user_id,
      projectId: row.project_id,
      sessionId: row.session_id,
      assetId: row.asset_id,
      kind: "review-audio",
      fileName: `${row.id}.m4a`,
    });
    if (!execute) {
      console.log(JSON.stringify({ reviewId: row.id, column: "audio_key", sourceKey: row.audio_key, targetKey, action: "copy-verify-retain" }));
      continue;
    }
    try {
      const verified = await migrateLegacyCaptureObject({
        legacyKey: row.audio_key,
        creatorHubKey: targetKey,
      });
      await pool.query(
        `UPDATE capture_reviews SET audio_key=$1 WHERE id=$2 AND audio_key=$3`,
        [targetKey, row.id, row.audio_key],
      );
      console.log(JSON.stringify({ reviewId: row.id, column: "audio_key", targetKey, ...verified, sourceRetained: true }));
    } catch (error) {
      console.error(JSON.stringify({ reviewId: row.id, column: "audio_key", error: error instanceof Error ? error.message : String(error), sourceRetained: true }));
      process.exitCode = 1;
    }
  }
} finally {
  await pool.end();
}
