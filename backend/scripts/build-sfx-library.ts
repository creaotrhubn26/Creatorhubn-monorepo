/**
 * build-sfx-library.ts
 *
 * Offline-pipeline som bygger CLAP-embeddings for et sample-bibliotek.
 * Leser et manifest med sample-URL-er + metadata, kjører hver sample
 * gjennom CLAP audio-encoder, og skriver `sfx-library.json` som
 * runtime-route (/api/sfx/match) leser inn.
 *
 * Kjøring:
 *
 *   tsx backend/scripts/build-sfx-library.ts \
 *     --manifest backend/data/sfx-manifest.json \
 *     --output backend/data/sfx-library.json
 *
 * Default-paths brukes hvis flagg utelates. Manifestet kan ha samples
 * fra HTTP URL-er (lastes ned) eller absolutte/relative filstier.
 *
 * Pipeline-trinn per sample:
 *   1. Last audio (HTTP eller fil) → temp-buffer
 *   2. Dekode til mono PCM Float32 @ 48kHz (CLAP-format)
 *   3. Send gjennom CLAP audio-encoder
 *   4. Lagre projisert embedding (512-dim, samme rom som text)
 *
 * Robusthet:
 *   - Skipper enkelt-samples som feiler (logger, fortsetter)
 *   - Validerer dim på hver embedding
 *   - Atomisk skriving (skriver .tmp først, så rename)
 *   - Bevarer rekkefølge fra manifestet for deterministiske resultater
 */

import fs from 'node:fs';
import path from 'node:path';

interface ManifestSample {
  id: string;
  title: string;
  /** Runtime-URL — det frontend henter for avspilling. */
  url: string;
  /** Hvis satt: hvor build-skriptet skal lese audio fra (kan være
   *  forskjellig fra URL — f.eks. lokal sti mens URL er /api/sfx/
   *  static/...). Default: bruk url. */
  sourcePath?: string;
  categoryId: string;
  license: string;
  attribution?: string;
  durationSec?: number;
  tags?: string[];
}

interface Manifest {
  samples: ManifestSample[];
}

interface LibrarySample {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  license: string;
  attribution?: string;
  durationSec?: number;
  tags?: string[];
  embedding: number[];
}

interface Library {
  version: number;
  embeddingModel: string;
  embeddingDim: number;
  builtAt: string;
  samples: LibrarySample[];
}

const LIBRARY_VERSION = 1;
const EMBEDDING_MODEL = 'Xenova/clap-htsat-unfused';
const EMBEDDING_DIM = 512;
const TARGET_SAMPLE_RATE = 48000;

function parseArgs(): { manifest: string; output: string } {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
  };
  const root = process.cwd();
  return {
    manifest: get('--manifest', path.join(root, 'data', 'sfx-manifest.json')),
    output: get('--output', path.join(root, 'data', 'sfx-library.json')),
  };
}

async function loadAudioBytes(urlOrPath: string): Promise<Uint8Array> {
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    const resp = await fetch(urlOrPath);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    return new Uint8Array(await resp.arrayBuffer());
  }
  const abs = path.resolve(urlOrPath);
  return new Uint8Array(fs.readFileSync(abs));
}

async function main() {
  const { manifest: manifestPath, output: outputPath } = parseArgs();
  console.log(`[build-sfx-library] manifest=${manifestPath}`);
  console.log(`[build-sfx-library] output=${outputPath}`);

  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw) as Manifest;
  if (!Array.isArray(manifest.samples)) {
    throw new Error('Manifest mangler samples-array');
  }
  console.log(`[build-sfx-library] ${manifest.samples.length} samples i manifest`);

  // Lazy-load CLAP audio-encoder via @xenova/transformers.
  console.log('[build-sfx-library] laster CLAP-modell (kan ta noen sekunder ved første kjøring)…');
  const transformers = await import('@xenova/transformers');
  const { AutoProcessor, ClapAudioModelWithProjection, read_audio } = transformers as any;
  if (!ClapAudioModelWithProjection || !AutoProcessor || !read_audio) {
    throw new Error('CLAP audio-API mangler i @xenova/transformers — sjekk versjon ≥ 2.17');
  }
  const processor = await AutoProcessor.from_pretrained(EMBEDDING_MODEL);
  const model = await ClapAudioModelWithProjection.from_pretrained(EMBEDDING_MODEL);
  console.log('[build-sfx-library] CLAP klar');

  const library: Library = {
    version: LIBRARY_VERSION,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDim: EMBEDDING_DIM,
    builtAt: new Date().toISOString(),
    samples: [],
  };

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < manifest.samples.length; i += 1) {
    const sample = manifest.samples[i];
    process.stdout.write(`[${i + 1}/${manifest.samples.length}] ${sample.id} … `);
    try {
      // 1. Last audio-bytes — bruk sourcePath hvis satt (lokal sti),
      //    ellers url (typisk fjern URL).
      const audioSource = sample.sourcePath ?? sample.url;
      const bytes = await loadAudioBytes(audioSource);

      // 2. Skriv til midlertidig fil + dekode via read_audio (forventer
      //    en URL eller filsti, så vi lagrer ned først)
      const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'sfx-build-'));
      const tmpFile = path.join(tmpDir, `${sample.id}-source`);
      fs.writeFileSync(tmpFile, bytes);
      const audioFloat32: Float32Array = await read_audio(tmpFile, TARGET_SAMPLE_RATE);
      fs.rmSync(tmpDir, { recursive: true, force: true });

      // 3. Send gjennom CLAP audio-encoder
      const inputs = await processor(audioFloat32);
      const out = await model(inputs);
      const audioEmbeds = out?.audio_embeds;
      if (!audioEmbeds?.data) {
        throw new Error('CLAP audio_embeds mangler');
      }
      const embedding = Array.from(audioEmbeds.data.slice(0, EMBEDDING_DIM)) as number[];
      if (embedding.length !== EMBEDDING_DIM) {
        throw new Error(`dim ${embedding.length}, forventet ${EMBEDDING_DIM}`);
      }

      // Bygg LibrarySample uten sourcePath (det er kun byggetid-felt).
      library.samples.push({
        id: sample.id,
        title: sample.title,
        url: sample.url,
        categoryId: sample.categoryId,
        license: sample.license,
        attribution: sample.attribution,
        durationSec: sample.durationSec,
        tags: sample.tags,
        embedding,
      });
      ok += 1;
      process.stdout.write('OK\n');
    } catch (err: any) {
      failed += 1;
      process.stdout.write(`FAIL (${err?.message ?? String(err)})\n`);
    }
  }

  // 4. Atomisk skriving — skriv til .tmp, så rename
  const tmpOutput = `${outputPath}.tmp`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(tmpOutput, JSON.stringify(library, null, 2));
  fs.renameSync(tmpOutput, outputPath);

  console.log(`\n[build-sfx-library] ferdig: ${ok} embedded, ${failed} feilet`);
  console.log(`[build-sfx-library] skrev ${outputPath}`);
  console.log('\nTips: kall POST /api/sfx/library/reload på server for hot-reload.');
}

main().catch((err) => {
  console.error('[build-sfx-library] kritisk feil:', err);
  process.exit(1);
});
