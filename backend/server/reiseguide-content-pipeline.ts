/**
 * Innholdspipeline for SenseAid Explore: manus → Soniox TTS → mp3 i
 * CreatorHubs S3-bøtte (products/senseaid-explore/…) + tekstingscues i
 * databasen.
 *
 * Kjøres av backend/scripts/reiseguide-generate-audio.ts. Ett manus
 * (guide_poi_scripts-rad) gir én aktiv guide_poi_audio-rad og én
 * guide_poi_captions-rad; eldre lyd for samme manus deaktiveres, aldri
 * slettes. Manus med aktiv lyd for samme versjon hoppes over uten --force.
 */

import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { putCreatorHubObject } from "./creatorhub-object-storage.js";
import { buildCaptionCues, type CaptionCue } from "./reiseguide-captions.js";
import type { SpeechSynthesizer } from "./reiseguide-soniox-tts.js";
import { senseAidAudioKey } from "./reiseguide-storage.js";

export interface MediaStore {
  put(object: { key: string; body: Buffer; contentType: string }): Promise<void>;
}

export interface ScriptAudioJob {
  scriptId: string;
  areaSlug: string;
  poiSlug: string;
  lang: string;
  kind: string;
  chapterNo: number;
  version: number;
  text: string;
  /** Versjonen den aktive lyden ble laget fra, eller null uten lyd. */
  activeAudioVersion: number | null;
}

export type GenerateResult =
  | { status: "generated"; job: ScriptAudioJob; audioId: string; storageKey: string; durationS: number; cueCount: number }
  | { status: "skipped"; job: ScriptAudioJob; reason: "up_to_date" | "dry_run" }
  | { status: "failed"; job: ScriptAudioJob; error: string };

export interface JobFilter {
  areaSlug: string;
  lang?: string;
  kind?: string;
  poiSlug?: string;
}

type Db = Pick<Pool, "query" | "connect">;

export function audioStorageKey(job: Pick<ScriptAudioJob, "areaSlug" | "poiSlug" | "kind" | "chapterNo" | "lang" | "version">): string {
  return senseAidAudioKey(job);
}

export async function listScriptAudioJobs(db: Pick<Pool, "query">, filter: JobFilter): Promise<ScriptAudioJob[]> {
  const { rows } = await db.query(
    `SELECT s.id, s.lang, s.kind, s.chapter_no, s.version, s.script_text,
            p.slug AS poi_slug, a.slug AS area_slug,
            act.script_version AS active_audio_version
       FROM guide_poi_scripts s
       JOIN guide_pois p ON p.id = s.poi_id
       JOIN guide_areas a ON a.id = p.area_id
       LEFT JOIN guide_poi_audio act ON act.script_id = s.id AND act.is_active
      WHERE a.slug = $1
        AND ($2::text IS NULL OR s.lang = $2)
        AND ($3::text IS NULL OR s.kind = $3)
        AND ($4::text IS NULL OR p.slug = $4)
      ORDER BY p.slug, s.kind, s.chapter_no`,
    [filter.areaSlug, filter.lang ?? null, filter.kind ?? null, filter.poiSlug ?? null],
  );
  return rows.map((r) => ({
    scriptId: String(r.id),
    areaSlug: String(r.area_slug),
    poiSlug: String(r.poi_slug),
    lang: String(r.lang),
    kind: String(r.kind),
    chapterNo: Number(r.chapter_no),
    version: Number(r.version),
    text: String(r.script_text),
    activeAudioVersion: r.active_audio_version == null ? null : Number(r.active_audio_version),
  }));
}

export interface GenerateOptions {
  db: Db;
  tts: SpeechSynthesizer;
  store: MediaStore;
  voice: string;
  force?: boolean;
  dryRun?: boolean;
}

export async function generateScriptAudio(job: ScriptAudioJob, options: GenerateOptions): Promise<GenerateResult> {
  if (!options.force && job.activeAudioVersion === job.version) {
    return { status: "skipped", job, reason: "up_to_date" };
  }
  if (options.dryRun) return { status: "skipped", job, reason: "dry_run" };

  const synthesis = await options.tts.synthesize({ text: job.text, lang: job.lang, voice: options.voice });
  const cues: CaptionCue[] = buildCaptionCues(job.text, synthesis.characters);
  if (cues.length === 0) throw new Error("Ingen tekstingscues kunne bygges fra tidsstemplene.");

  const storageKey = audioStorageKey(job);
  await options.store.put({ key: storageKey, body: synthesis.audio, contentType: "audio/mpeg" });

  const audioId = `aud_${randomUUID()}`;
  const captionsId = `cap_${randomUUID()}`;
  const checksum = createHash("sha256").update(synthesis.audio).digest("hex");
  const durationS = Math.max(0.01, Math.round(synthesis.durationS * 100) / 100);

  const client = await options.db.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE guide_poi_audio SET is_active = FALSE WHERE script_id = $1 AND is_active", [job.scriptId]);
    await client.query(
      `INSERT INTO guide_poi_audio
         (id, script_id, script_version, storage_key, format, bitrate_kbps, duration_s,
          tts_provider, voice_id, checksum_sha256, is_active)
       VALUES ($1, $2, $3, $4, 'mp3', $5, $6, $7, $8, $9, TRUE)`,
      [audioId, job.scriptId, job.version, storageKey, synthesis.bitrateKbps, durationS, synthesis.provider, synthesis.voice, checksum],
    );
    await client.query(
      `INSERT INTO guide_poi_captions (id, audio_id, format, cues, source)
       VALUES ($1, $2, 'vtt', $3::jsonb, $4)`,
      [captionsId, audioId, JSON.stringify(cues), synthesis.provider],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  return { status: "generated", job, audioId, storageKey, durationS, cueCount: cues.length };
}

export async function generateAreaAudio(
  filter: JobFilter,
  options: GenerateOptions & { onResult?: (result: GenerateResult) => void },
): Promise<GenerateResult[]> {
  const jobs = await listScriptAudioJobs(options.db, filter);
  const results: GenerateResult[] = [];
  for (const job of jobs) {
    let result: GenerateResult;
    try {
      result = await generateScriptAudio(job, options);
    } catch (err) {
      result = { status: "failed", job, error: err instanceof Error ? err.message : String(err) };
    }
    results.push(result);
    options.onResult?.(result);
  }
  return results;
}

/**
 * Lydfiler lagres i CreatorHubs private S3-bøtte med den dedikerte
 * CreatorHub-IAM-brukeren (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY +
 * CREATORHUB_S3_BUCKET), under products/senseaid-explore/…. Objektene er
 * private; appen får dem via /api/guide/media/{key} som presignerer.
 */
export function createCreatorHubMediaStore(): MediaStore {
  return {
    async put({ key, body, contentType }) {
      const stored = await putCreatorHubObject(key, body, contentType, { product: "senseaid-explore" });
      if (!stored) {
        throw new Error(
          "CreatorHub S3 er ikke konfigurert (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY og CREATORHUB_S3_BUCKET må være satt).",
        );
      }
    },
  };
}
