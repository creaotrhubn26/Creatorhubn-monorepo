/**
 * _sfx-clap.ts
 *
 * Privat backend-modul som håndterer CLAP-modellen og SFX-sample-
 * biblioteket for runtime-matching. Gjør tre ting:
 *
 *   1. Lazy-load av CLAP text-encoder via @xenova/transformers
 *      (modellen er ~150MB; vi vil ikke blokkere oppstart).
 *   2. Last + valider sample-library JSON ved oppstart, cache i minne.
 *   3. Eksponer embedText(prompt) → Float32Array for route-laget.
 *
 * Modellen vi bruker: Xenova/clap-htsat-unfused (ONNX-konvertert av
 * Xenova) — 512-dim text-embeddings, samme rom som audio-embeddings
 * i sample-biblioteket. Forutsetter at biblioteket er bygget med
 * samme modell (sjekkes via embeddingModel-feltet).
 */

import fs from 'node:fs';
import path from 'node:path';

// CLAP-modulen lastes lazy ved første kall. Vi holder pipeline'en i
// en singleton så samtidige requests ikke trigger flere load-er.
let clapEmbedderPromise: Promise<TextEmbedder> | null = null;

export type TextEmbedder = (text: string) => Promise<Float32Array>;

/**
 * Bygg en text-embedder via @xenova/transformers. Promise cache'es
 * etter første kall.
 */
export function getClapTextEmbedder(): Promise<TextEmbedder> {
  if (clapEmbedderPromise) return clapEmbedderPromise;
  clapEmbedderPromise = loadClapTextEmbedder().catch((err) => {
    // Slett cache så neste kall prøver på nytt.
    clapEmbedderPromise = null;
    throw err;
  });
  return clapEmbedderPromise;
}

async function loadClapTextEmbedder(): Promise<TextEmbedder> {
  // Import dynamically — modulen er stor og bør ikke lastes i ts-noden
  // for ruter som ikke trenger den.
  const transformers = await import('@xenova/transformers');
  const { AutoTokenizer, AutoProcessor, ClapTextModelWithProjection } = transformers as {
    AutoTokenizer: { from_pretrained: (id: string) => Promise<any> };
    AutoProcessor: { from_pretrained: (id: string) => Promise<any> };
    ClapTextModelWithProjection: { from_pretrained: (id: string) => Promise<any> };
  };

  if (!ClapTextModelWithProjection || !AutoTokenizer) {
    throw new Error('CLAP-støtte mangler i @xenova/transformers — sjekk versjon ≥ 2.17');
  }

  const modelId = 'Xenova/clap-htsat-unfused';
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const model = await ClapTextModelWithProjection.from_pretrained(modelId);

  return async (text: string): Promise<Float32Array> => {
    const inputs = tokenizer(text, { padding: true, truncation: true });
    const out = await model(inputs);
    // CLAP-text-encoder returnerer `text_embeds` (projisert) i samme
    // rom som audio-encoder sine `audio_embeds`.
    const embedTensor = (out as { text_embeds?: { data?: Float32Array } }).text_embeds;
    if (!embedTensor || !embedTensor.data) {
      throw new Error('CLAP text_embeds mangler i output — sjekk modell-API');
    }
    // text_embeds har shape [batch, 512]. For én tekst tar vi de første 512.
    const dim = embedTensor.data.length;
    if (dim < 512) {
      throw new Error(`Embedding-dimensjon ${dim} er mindre enn forventet 512`);
    }
    return embedTensor.data.slice(0, 512) as Float32Array;
  };
}

// ============================================================================
// Library loader
// ============================================================================

export interface LoadedSample {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  license: string;
  attribution?: string;
  durationSec?: number;
  tags?: string[];
  embedding: Float32Array;
}

export interface LoadedLibrary {
  embeddingModel: string;
  embeddingDim: number;
  builtAt: string;
  samples: LoadedSample[];
}

/**
 * Last library fra disk. Returnerer tom-library hvis fila mangler.
 * Kaster hvis fila finnes men er invalid (vi vil ikke seile videre
 * med korrupte embeddings).
 */
export async function loadSfxLibraryFromDisk(filePath: string): Promise<LoadedLibrary> {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = await fs.promises.readFile(absolute, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      // Tom library er greit — bare returner null-state.
      return {
        embeddingModel: 'Xenova/clap-htsat-unfused',
        embeddingDim: 512,
        builtAt: new Date().toISOString(),
        samples: [],
      };
    }
    throw err;
  }
  const parsed = JSON.parse(raw);
  const validation = validatePayload(parsed);
  if (!validation.ok) {
    throw new Error(`SFX-library ${absolute} er ugyldig: ${validation.errors.join('; ')}`);
  }
  return {
    embeddingModel: parsed.embeddingModel,
    embeddingDim: parsed.embeddingDim,
    builtAt: parsed.builtAt,
    samples: parsed.samples.map((s: any) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      categoryId: s.categoryId,
      license: s.license,
      attribution: s.attribution,
      durationSec: s.durationSec,
      tags: s.tags,
      embedding: new Float32Array(s.embedding),
    })),
  };
}

function validatePayload(payload: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['library må være et objekt'] };
  }
  const lib = payload as Record<string, unknown>;
  if (typeof lib.version !== 'number') errors.push('version mangler');
  if (typeof lib.embeddingModel !== 'string') errors.push('embeddingModel mangler');
  if (typeof lib.embeddingDim !== 'number') errors.push('embeddingDim mangler');
  if (!Array.isArray(lib.samples)) {
    errors.push('samples må være array');
    return { ok: errors.length === 0, errors };
  }
  const dim = lib.embeddingDim as number;
  const seen = new Set<string>();
  (lib.samples as Array<Record<string, unknown>>).forEach((s, i) => {
    if (typeof s.id !== 'string' || !s.id) errors.push(`samples[${i}].id`);
    else if (seen.has(s.id)) errors.push(`samples[${i}].id duplikat "${s.id}"`);
    else seen.add(s.id);
    if (typeof s.url !== 'string') errors.push(`samples[${i}].url`);
    if (typeof s.categoryId !== 'string') errors.push(`samples[${i}].categoryId`);
    if (typeof s.license !== 'string') errors.push(`samples[${i}].license`);
    if (!Array.isArray(s.embedding)) errors.push(`samples[${i}].embedding`);
    else if ((s.embedding as unknown[]).length !== dim) errors.push(`samples[${i}].embedding-dim`);
  });
  return { ok: errors.length === 0, errors };
}

// ============================================================================
// Cosine similarity (matcher klient-versjonen i embeddingMatch.ts)
// ============================================================================

export function cosineSimilarityF32(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return NaN;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return NaN;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface MatchOptions {
  topK?: number;
  categoryId?: string;
  minScore?: number;
}

export interface SfxMatchHit {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  license: string;
  attribution?: string;
  durationSec?: number;
  score: number;
}

export function matchSamples(
  query: Float32Array,
  library: LoadedLibrary,
  options: MatchOptions = {},
): SfxMatchHit[] {
  const topK = Math.max(1, options.topK ?? 3);
  const { categoryId, minScore } = options;
  const hits: SfxMatchHit[] = [];
  for (const sample of library.samples) {
    if (categoryId && sample.categoryId !== categoryId) continue;
    const score = cosineSimilarityF32(query, sample.embedding);
    if (!Number.isFinite(score)) continue;
    if (minScore !== undefined && score < minScore) continue;
    hits.push({
      id: sample.id,
      title: sample.title,
      url: sample.url,
      categoryId: sample.categoryId,
      license: sample.license,
      attribution: sample.attribution,
      durationSec: sample.durationSec,
      score,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}
