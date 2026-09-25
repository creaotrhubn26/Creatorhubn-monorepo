/**
 * Lager lyd og teksting for lydguide-manus med Soniox TTS.
 *
 *   DATABASE_URL=… SENSEAID_SONIOX_API_KEY=… npm run reiseguide:audio -- \
 *     --area oslo-kvadraturen-festningen-operaen --lang nb --kind narration
 *
 * Nyttige flagg:
 *   --area all                alle områdene i databasen, ett etter ett
 *   --poi akershus-festning   bare én severdighet
 *   --voice <navn>            Soniox-stemme for alle språk (ellers
 *                             SENSEAID_SONIOX_VOICE_<SPRÅK>, SENSEAID_SONIOX_VOICE
 *                             eller standard). Byttes stemmen for et språk, lages
 *                             bare det språket på nytt.
 *   --force                   lag ny lyd selv om versjonen allerede har lyd
 *   --dry-run                 vis hva som ville blitt laget, uten Soniox/S3/DB
 *   --out <mappe>             lyttetest: skriv mp3 + cues.json lokalt, ingen S3/DB
 *
 * Lyd lagres i CreatorHubs S3-bøtte (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * CREATORHUB_S3_BUCKET) under products/senseaid-explore/….
 *
 * I produksjon kjøres den av workflowen «SenseAid Explore lag Soniox-lyd»
 * med migrasjonsbrukeren; da settes MIGRATION_OWNER_ROLE, og hver
 * databasetilkobling bytter rolle før den skriver, som seed-reiseguide-demo.ts.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { deleteCreatorHubObject, putCreatorHubObject } from "../server/creatorhub-object-storage.js";
import { buildCaptionCues } from "../server/reiseguide-captions.js";
import { SENSEAID_ENV, requireSenseAidEnv, sonioxVoiceForLang } from "../server/reiseguide-config.js";
import {
  createCreatorHubMediaStore,
  generateAreaAudio,
  isAudioUpToDate,
  listScriptAudioJobs,
  type GenerateResult,
  type JobFilter,
} from "../server/reiseguide-content-pipeline.js";
import { SONIOX_TTS_DEFAULT_VOICE, createSonioxTts } from "../server/reiseguide-soniox-tts.js";
import { SENSEAID_STORAGE_PREFIX } from "../server/reiseguide-storage.js";

const DEFAULT_AREA = "oslo-kvadraturen-festningen-operaen";

/**
 * Skriver og sletter en liten fil under SenseAid-prefikset før noe sendes til
 * Soniox. Mangler IAM-tilgangen (SenseAidExploreMediaAccess), stopper jobben
 * her i stedet for å betale for lyd som så avvises ved lagring (24.09.2026).
 */
async function assertMediaStoreWritable(): Promise<void> {
  const key = `${SENSEAID_STORAGE_PREFIX}/_preflight/audio-job-${Date.now()}.txt`;
  try {
    if (!(await putCreatorHubObject(key, Buffer.from("ok"), "text/plain"))) {
      throw new Error("CreatorHub S3 er ikke konfigurert (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CREATORHUB_S3_BUCKET).");
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Kan ikke skrive til ${SENSEAID_STORAGE_PREFIX}/ i CreatorHub S3, så ingen lyd lages. Legg inn infrastructure/aws/creatorhubn-storage/application-policy.json (SenseAidExploreMediaAccess) på backendens IAM-bruker. Feil: ${reason}`,
    );
  }
  await deleteCreatorHubObject(key);
  console.log(`S3-sjekk OK: kan skrive til ${SENSEAID_STORAGE_PREFIX}/.`);
}

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
  const ownerRole = (process.env.MIGRATION_OWNER_ROLE ?? "").trim();
  if (ownerRole && !/^[a-z_][a-z0-9_]*$/.test(ownerRole)) {
    console.error("MIGRATION_OWNER_ROLE har et ugyldig rollenavn");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  if (ownerRole) {
    // Køes først på hver ny tilkobling, så den kjører før alle andre spørringer.
    pool.on("connect", (client) => {
      void client.query(`SET ROLE "${ownerRole}"`);
      void client.query("SET search_path TO public, pg_temp");
    });
  }
  const cliVoice = values.voice?.trim();
  const voice = (lang: string): string => cliVoice || sonioxVoiceForLang(lang, SONIOX_TTS_DEFAULT_VOICE);

  try {
    if (!values["dry-run"] && !values.out) await assertMediaStoreWritable();
    const areaSlugs =
      values.area === "all"
        ? (await pool.query<{ slug: string }>("SELECT slug FROM guide_areas ORDER BY slug")).rows.map((r) => r.slug)
        : [values.area];
    let failedTotal = 0;
    for (const areaSlug of areaSlugs) {
      if (areaSlugs.length > 1) console.log(`\n== ${areaSlug} ==`);
      const filter = { areaSlug, lang: values.lang, kind: values.kind, poiSlug: values.poi };
      failedTotal += await runArea(pool, filter, values, voice);
    }
    if (failedTotal > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

type CliValues = { force: boolean; "dry-run": boolean; out?: string };

/** Lager (eller viser) lyd for ett område; returnerer antall som feilet. */
async function runArea(pool: pg.Pool, filter: JobFilter, values: CliValues, voice: (lang: string) => string): Promise<number> {
  if (values["dry-run"]) {
    const jobs = await listScriptAudioJobs(pool, filter);
    for (const job of jobs) {
      const state = isAudioUpToDate(job, voice(job.lang)) && !values.force ? "har lyd" : "ville laget lyd";
      console.log(
        `– ${job.poiSlug} ${job.kind} #${job.chapterNo} (${job.lang}, v${job.version}, stemme «${voice(job.lang)}»): ${state}, ${job.text.length} tegn`,
      );
    }
    console.log(`${jobs.length} manus.`);
    return 0;
  }

  const tts = createSonioxTts({
    apiKey: requireSenseAidEnv(SENSEAID_ENV.sonioxApiKey),
    region: process.env[SENSEAID_ENV.sonioxRegion]?.trim() || undefined,
  });

  if (values.out) {
    const dir = path.resolve(values.out);
    mkdirSync(dir, { recursive: true });
    const jobs = await listScriptAudioJobs(pool, filter);
    for (const job of jobs) {
      const base = path.join(dir, `${job.poiSlug}-${job.kind}-${job.chapterNo}-${job.lang}`);
      const synthesis = await tts.synthesize({ text: job.text, lang: job.lang, voice: voice(job.lang) });
      const cues = buildCaptionCues(job.text, synthesis.characters);
      writeFileSync(`${base}.mp3`, synthesis.audio);
      writeFileSync(`${base}.cues.json`, JSON.stringify(cues, null, 2));
      console.log(`✓ ${base}.mp3 (${synthesis.durationS.toFixed(1)}s, ${cues.length} cues)`);
    }
    return 0;
  }

  const results = await generateAreaAudio(filter, {
    db: pool,
    tts,
    store: createCreatorHubMediaStore(),
    voice,
    force: values.force,
    onResult: (r) => console.log(describe(r)),
  });
  const failed = results.filter((r) => r.status === "failed").length;
  const generated = results.filter((r) => r.status === "generated").length;
  console.log(`${generated} laget, ${results.length - generated - failed} hoppet over, ${failed} feilet.`);
  return failed;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
