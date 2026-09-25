/**
 * Innholdspipeline for SenseAid Explore: manus → Soniox TTS → mp3 i
 * CreatorHubs S3-bøtte (products/senseaid-explore/…) + tekstingscues i
 * databasen.
 *
 * Kjøres av backend/scripts/reiseguide-generate-audio.ts. Et språk kan ha
 * flere stemmer (norsk: Hazel og Walter, Daniel 25.09.2026), så ett manus
 * (guide_poi_scripts-rad) gir én aktiv guide_poi_audio-rad per stemme, hver
 * med sin guide_poi_captions-rad. Eldre lyd for samme stemme, og lyd med
 * stemmer språket ikke lenger bruker, deaktiveres når den nye er lagret,
 * aldri slettes. Stemmer med aktiv lyd for samme manusversjon hoppes over
 * uten --force.
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
  /** Aktiv lyd for manuset: én per stemme, med versjonen den ble laget fra. */
  activeAudio: ActiveAudio[];
}

export interface ActiveAudio {
  voice: string;
  version: number;
}

export type GenerateResult =
  | { status: "generated"; job: ScriptAudioJob; voice: string; audioId: string; storageKey: string; durationS: number; cueCount: number }
  | { status: "skipped"; job: ScriptAudioJob; voice: string; reason: "up_to_date" | "dry_run" }
  | { status: "failed"; job: ScriptAudioJob; voice: string; error: string };

export interface JobFilter {
  areaSlug: string;
  lang?: string;
  kind?: string;
  poiSlug?: string;
}

type Db = Pick<Pool, "query" | "connect">;

export function audioStorageKey(
  job: Pick<ScriptAudioJob, "areaSlug" | "poiSlug" | "kind" | "chapterNo" | "lang" | "version">,
  voice: string,
): string {
  return senseAidAudioKey({ ...job, voice });
}

export async function listScriptAudioJobs(db: Pick<Pool, "query">, filter: JobFilter): Promise<ScriptAudioJob[]> {
  const { rows } = await db.query(
    `SELECT s.id, s.lang, s.kind, s.chapter_no, s.version, s.script_text,
            p.slug AS poi_slug, a.slug AS area_slug,
            COALESCE(
              (SELECT json_agg(json_build_object('voice', act.voice_id, 'version', act.script_version))
                 FROM guide_poi_audio act
                WHERE act.script_id = s.id AND act.is_active),
              '[]'::json
            ) AS active_audio
       FROM guide_poi_scripts s
       JOIN guide_pois p ON p.id = s.poi_id
       JOIN guide_areas a ON a.id = p.area_id
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
    activeAudio: parseActiveAudio(r.active_audio),
  }));
}

function parseActiveAudio(value: unknown): ActiveAudio[] {
  const list = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const { voice, version } = (item ?? {}) as { voice?: unknown; version?: unknown };
    return typeof voice === "string" && version != null ? [{ voice, version: Number(version) }] : [];
  });
}

export interface GenerateOptions {
  db: Db;
  tts: SpeechSynthesizer;
  store: MediaStore;
  /** Stemmene for alle språk, eller stemmene per språk (den første er standard). */
  voice: string | string[] | ((lang: string) => string | string[]);
  force?: boolean;
  dryRun?: boolean;
}

export function voicesForJob(job: Pick<ScriptAudioJob, "lang">, voice: GenerateOptions["voice"]): string[] {
  const resolved = typeof voice === "function" ? voice(job.lang) : voice;
  const list = (Array.isArray(resolved) ? resolved : [resolved]).map((v) => v.trim()).filter(Boolean);
  return [...new Set(list)];
}

/** Stemmen har aktiv lyd for samme manusversjon. */
export function isAudioUpToDate(job: ScriptAudioJob, voice: string): boolean {
  return job.activeAudio.some((a) => a.voice === voice && a.version === job.version);
}

/**
 * Lager lyd for ett manus med én stemme. `languageVoices` er alle stemmene
 * språket bruker nå; aktiv lyd med andre stemmer (f.eks. Adrian på norsk før
 * Hazel og Walter) deaktiveres når den nye lyden er lagret.
 */
export async function generateScriptAudio(
  job: ScriptAudioJob,
  voice: string,
  options: GenerateOptions & { languageVoices?: string[] },
): Promise<GenerateResult> {
  if (!options.force && isAudioUpToDate(job, voice)) {
    return { status: "skipped", job, voice, reason: "up_to_date" };
  }
  if (options.dryRun) return { status: "skipped", job, voice, reason: "dry_run" };
  const languageVoices = options.languageVoices?.length ? options.languageVoices : [voice];

  const synthesis = await options.tts.synthesize({ text: job.text, lang: job.lang, voice });
  const cues: CaptionCue[] = buildCaptionCues(job.text, synthesis.characters);
  if (cues.length === 0) throw new Error("Ingen tekstingscues kunne bygges fra tidsstemplene.");

  const storageKey = audioStorageKey(job, voice);
  await options.store.put({ key: storageKey, body: synthesis.audio, contentType: "audio/mpeg" });

  const audioId = `aud_${randomUUID()}`;
  const captionsId = `cap_${randomUUID()}`;
  const checksum = createHash("sha256").update(synthesis.audio).digest("hex");
  const durationS = Math.max(0.01, Math.round(synthesis.durationS * 100) / 100);

  const client = await options.db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE guide_poi_audio SET is_active = FALSE
        WHERE script_id = $1 AND is_active AND (voice_id = $2 OR NOT (voice_id = ANY($3::text[])))`,
      [job.scriptId, voice, languageVoices],
    );
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

  return { status: "generated", job, voice, audioId, storageKey, durationS, cueCount: cues.length };
}

export async function generateAreaAudio(
  filter: JobFilter,
  options: GenerateOptions & { onResult?: (result: GenerateResult) => void },
): Promise<GenerateResult[]> {
  const jobs = await listScriptAudioJobs(options.db, filter);
  const results: GenerateResult[] = [];
  for (const job of jobs) {
    const languageVoices = voicesForJob(job, options.voice);
    for (const voice of languageVoices) {
      let result: GenerateResult;
      try {
        result = await generateScriptAudio(job, voice, { ...options, languageVoices });
      } catch (err) {
        result = { status: "failed", job, voice, error: err instanceof Error ? err.message : String(err) };
      }
      results.push(result);
      options.onResult?.(result);
    }
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
