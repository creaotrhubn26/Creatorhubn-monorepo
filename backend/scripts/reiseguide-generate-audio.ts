/**
 * Lager lyd og teksting for lydguide-manus med Soniox TTS.
 *
 *   DATABASE_URL=… SENSEAID_SONIOX_API_KEY=… npm run reiseguide:audio -- \
 *     --area oslo-kvadraturen-festningen-operaen --lang nb --kind narration
 *
 * Nyttige flagg:
 *   --poi akershus-festning   bare én severdighet
 *   --voice <navn>            Soniox-stemme (ellers SENSEAID_SONIOX_VOICE / standard)
 *   --force                   lag ny lyd selv om versjonen allerede har lyd
 *   --dry-run                 vis hva som ville blitt laget, uten Soniox/R2/DB
 *   --out <mappe>             lyttetest: skriv mp3 + cues.json lokalt, ingen R2/DB
 *
 * R2 leses fra CMS_R2_* → CLOUDFLARE_R2_* → R2_* (samme bøtte som /cdn/*).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { buildCaptionCues } from "../server/reiseguide-captions.js";
import { SENSEAID_ENV, requireSenseAidEnv } from "../server/reiseguide-config.js";
import {
  createR2MediaStore,
  generateAreaAudio,
  listScriptAudioJobs,
  type GenerateResult,
} from "../server/reiseguide-content-pipeline.js";
import { SONIOX_TTS_DEFAULT_VOICE, createSonioxTts } from "../server/reiseguide-soniox-tts.js";

const DEFAULT_AREA = "oslo-kvadraturen-festningen-operaen";

function describe(result: GenerateResult): string {
  const j = result.job;
  const label = `${j.poiSlug} ${j.kind} #${j.chapterNo} (${j.lang}, v${j.version})`;
  switch (result.status) {
    case "generated":
      return `✓ ${label}: ${result.durationS}s, ${result.cueCount} cues → ${result.storageKey}`;
    case "skipped":
      return `– ${label}: ${result.reason === "up_to_date" ? "har lyd for denne versjonen" : "tørrkjøring"}`;
    case "failed":
      return `✗ ${label}: ${result.error}`;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      area: { type: "string", default: DEFAULT_AREA },
      lang: { type: "string" },
      kind: { type: "string" },
      poi: { type: "string" },
      voice: { type: "string" },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL mangler.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const filter = { areaSlug: values.area, lang: values.lang, kind: values.kind, poiSlug: values.poi };
  const voice = values.voice?.trim() || process.env[SENSEAID_ENV.sonioxVoice]?.trim() || SONIOX_TTS_DEFAULT_VOICE;

  try {
    if (values["dry-run"]) {
      const jobs = await listScriptAudioJobs(pool, filter);
      for (const job of jobs) {
        const state = job.activeAudioVersion === job.version && !values.force ? "har lyd" : "ville laget lyd";
        console.log(`– ${job.poiSlug} ${job.kind} #${job.chapterNo} (${job.lang}, v${job.version}): ${state}, ${job.text.length} tegn`);
      }
      console.log(`${jobs.length} manus, stemme «${voice}».`);
      return;
    }

    const tts = createSonioxTts({ apiKey: requireSenseAidEnv(SENSEAID_ENV.sonioxApiKey) });

    if (values.out) {
      const dir = path.resolve(values.out);
      mkdirSync(dir, { recursive: true });
      const jobs = await listScriptAudioJobs(pool, filter);
      for (const job of jobs) {
        const base = path.join(dir, `${job.poiSlug}-${job.kind}-${job.chapterNo}-${job.lang}`);
        const synthesis = await tts.synthesize({ text: job.text, lang: job.lang, voice });
        const cues = buildCaptionCues(job.text, synthesis.characters);
        writeFileSync(`${base}.mp3`, synthesis.audio);
        writeFileSync(`${base}.cues.json`, JSON.stringify(cues, null, 2));
        console.log(`✓ ${base}.mp3 (${synthesis.durationS.toFixed(1)}s, ${cues.length} cues)`);
      }
      return;
    }

    const results = await generateAreaAudio(filter, {
      db: pool,
      tts,
      store: createR2MediaStore(),
      voice,
      force: values.force,
      onResult: (r) => console.log(describe(r)),
    });
    const failed = results.filter((r) => r.status === "failed").length;
    const generated = results.filter((r) => r.status === "generated").length;
    console.log(`${generated} laget, ${results.length - generated - failed} hoppet over, ${failed} feilet.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
