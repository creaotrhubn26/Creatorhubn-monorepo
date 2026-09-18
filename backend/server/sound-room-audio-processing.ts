import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { Pool } from "pg";

import {
  getSoundRoomObjectStream,
  putSoundRoomDerivedObject,
  readOwnedSoundRoomObject,
} from "./sound-room-storage-service.js";

function runProcess(
  command: string,
  args: string[],
  options: { binary?: boolean; maxBytes?: number } = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        child.kill("SIGKILL");
        reject(new Error("media_process_output_too_large"));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-8_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${path.basename(command)}_failed_${code}: ${stderr.slice(-1200)}`));
    });
  });
}

function bodyAsReadable(body: any): Readable {
  if (body && typeof body.pipe === "function") return body as Readable;
  if (body && typeof body.transformToWebStream === "function") {
    return Readable.fromWeb(body.transformToWebStream());
  }
  throw new Error("s3_body_not_streamable");
}

function waveformPeaks(pcm: Buffer, targetPoints = 3000): number[] {
  const sampleCount = Math.floor(pcm.length / 4);
  if (!sampleCount) return [];
  const samplesPerPoint = Math.max(1, Math.ceil(sampleCount / targetPoints));
  const points: number[] = [];
  for (let start = 0; start < sampleCount; start += samplesPerPoint) {
    let peak = 0;
    const end = Math.min(sampleCount, start + samplesPerPoint);
    for (let index = start; index < end; index += 1) {
      const value = Math.abs(pcm.readFloatLE(index * 4));
      if (Number.isFinite(value)) peak = Math.max(peak, value);
    }
    points.push(Math.min(1, Number(peak.toFixed(5))));
  }
  return points;
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Generates a compact AAC preview and precomputed waveform peaks after an
 * original has passed S3 verification. Failure is recorded but never hides or
 * deletes the verified original.
 */
export async function processSoundRoomAudioVersion(
  pool: Pool,
  versionId: string,
  ownerUserId: string,
): Promise<void> {
  const version = await pool.query<{
    storage_object_id: string;
    file_name: string | null;
  }>(
    `SELECT version.storage_object_id, version.file_name
       FROM audio_review_versions version
       JOIN audio_review_projects project ON project.id = version.project_id
      WHERE version.id = $1::uuid AND project.owner_user_id = $2
      LIMIT 1`,
    [versionId, ownerUserId],
  );
  const objectId = version.rows[0]?.storage_object_id;
  if (!objectId) return;
  const objectRow = await readOwnedSoundRoomObject(pool, objectId, ownerUserId);
  if (!objectRow || objectRow.status !== "active") return;

  await pool.query(
    `UPDATE audio_review_versions SET storage_state = 'processing'
      WHERE id = $1::uuid`,
    [versionId],
  );
  const tempRoot = await mkdtemp(path.join(tmpdir(), "creatorhub-sound-room-"));
  const originalPath = path.join(tempRoot, `original.${path.extname(objectRow.display_name).slice(1) || "bin"}`);
  const previewPath = path.join(tempRoot, "preview.m4a");
  try {
    const source = await getSoundRoomObjectStream(objectRow.object_key);
    await pipeline(bodyAsReadable(source.Body), createWriteStream(originalPath, { flags: "wx" }));

    const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
    const probeBuffer = await runProcess(ffprobe, [
      "-v", "error",
      "-show_entries", "format=duration,format_name:stream=index,codec_type,codec_name,sample_rate,bits_per_sample,channels",
      "-of", "json",
      originalPath,
    ], { maxBytes: 2 * 1024 * 1024 });
    const probe = JSON.parse(probeBuffer.toString("utf8"));
    const audioStream = (probe.streams || []).find((stream: any) => stream.codec_type === "audio") || {};

    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    await runProcess(ffmpeg, [
      "-y", "-v", "error", "-i", originalPath,
      "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
      previewPath,
    ], { maxBytes: 1024 });
    const previewBody = await readFile(previewPath);
    const previewObject = await putSoundRoomDerivedObject(pool, {
      userId: ownerUserId,
      parentObject: objectRow,
      kind: "preview",
      body: previewBody,
      contentType: "audio/mp4",
      extension: "m4a",
    });

    const pcm = await runProcess(ffmpeg, [
      "-v", "error", "-i", originalPath,
      "-vn", "-ac", "1", "-ar", "200", "-f", "f32le", "pipe:1",
    ], { binary: true, maxBytes: 64 * 1024 * 1024 });
    const peaks = waveformPeaks(pcm);
    const waveformDocument = Buffer.from(JSON.stringify({
      version: 1,
      sampleRate: 200,
      duration: numeric(probe.format?.duration),
      peaks,
    }));
    await putSoundRoomDerivedObject(pool, {
      userId: ownerUserId,
      parentObject: objectRow,
      kind: "waveform",
      body: waveformDocument,
      contentType: "application/json",
      extension: "json",
    });

    await pool.query(
      `UPDATE audio_review_versions
          SET preview_storage_object_id = $2::uuid,
              preview_url = '/api/audio-versions/' || id::text || '/media?preview=1',
              waveform_json_url = '/api/audio-versions/' || id::text || '/waveform',
              waveform_peaks = $3::jsonb,
              duration = COALESCE($4, duration),
              sample_rate = COALESCE($5, sample_rate),
              bit_depth = COALESCE($6, bit_depth),
              channels = COALESCE($7, channels),
              codec = COALESCE($8, codec),
              storage_state = 'ready'
        WHERE id = $1::uuid`,
      [
        versionId,
        previewObject.id,
        JSON.stringify(peaks),
        numeric(probe.format?.duration),
        numeric(audioStream.sample_rate),
        numeric(audioStream.bits_per_sample),
        numeric(audioStream.channels),
        audioStream.codec_name || null,
      ],
    );
  } catch (error) {
    console.error("[sound-room-processing] failed", versionId, error);
    await pool.query(
      `UPDATE audio_review_versions SET storage_state = 'failed'
        WHERE id = $1::uuid`,
      [versionId],
    ).catch(() => undefined);
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
