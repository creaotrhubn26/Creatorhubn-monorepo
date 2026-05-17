/**
 * sfx-match-routes.ts
 *
 * Route-laget for CLAP-basert SFX-matching. Eksponerer:
 *
 *   POST /api/sfx/match
 *     body: { prompt: string, topK?: number, categoryId?: string, minScore?: number }
 *     ret:  { matches: SfxMatchHit[], libraryStats: { sampleCount, embeddingModel } }
 *
 *   GET /api/sfx/library/stats
 *     ret:  { sampleCount, embeddingModel, embeddingDim, builtAt }
 *
 *   POST /api/sfx/library/reload
 *     Hot-reload library fra disk uten å restarte serveren.
 *     Krever sesjon (samme som andre admin-ops).
 *
 * Library-fila ligger på `<repo>/backend/data/sfx-library.json`.
 * Path kan overrides via SFX_LIBRARY_PATH env-var.
 */

import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  getClapTextEmbedder,
  loadSfxLibraryFromDisk,
  matchSamples,
  type LoadedLibrary,
  type TextEmbedder,
} from './_sfx-clap.js';
import {
  generateSfx,
  getCachedSfx,
  loadGeneratedSfxFile,
  ElevenLabsError,
  type GenerateSfxRequest,
  type GenerateSfxResult,
} from './_sfx-elevenlabs.js';

const DEFAULT_LIBRARY_PATH = path.resolve(process.cwd(), 'data', 'sfx-library.json');

const MatchBodySchema = z.object({
  prompt: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).optional(),
  categoryId: z.string().min(1).max(64).optional(),
  minScore: z.number().min(-1).max(1).optional(),
});

const GenerateBodySchema = z.object({
  prompt: z.string().min(3).max(500),
  durationSec: z.number().min(0.5).max(10).optional(),
  promptInfluence: z.number().min(0).max(1).optional(),
  loop: z.boolean().optional(),
});

export type GenerateSfxFn = (req: GenerateSfxRequest) => Promise<GenerateSfxResult>;

export interface SfxMatchRouterDeps {
  /** Path til library JSON. Default: data/sfx-library.json under cwd. */
  libraryPath?: string;
  /** Override-embedder for tester. Default: lazy-load CLAP. */
  embedder?: TextEmbedder;
  /** Pre-loadet library (for tester). Default: load fra disk. */
  preloadedLibrary?: LoadedLibrary;
  /** Override-generator for tester. Default: ElevenLabs via env-var. */
  generateFn?: GenerateSfxFn;
  /** Override-file-server for tester. */
  loadGeneratedFn?: (cacheKey: string) => ReturnType<typeof loadGeneratedSfxFile>;
}

export function createSfxMatchRouter(deps: SfxMatchRouterDeps = {}): Router {
  const router = Router();
  const libraryPath = deps.libraryPath ?? process.env.SFX_LIBRARY_PATH ?? DEFAULT_LIBRARY_PATH;

  // In-memory library-state. Loades ved første request (eller pre-injectet
  // for tester). Hot-reload via /library/reload.
  let library: LoadedLibrary | null = deps.preloadedLibrary ?? null;
  let libraryLoading: Promise<LoadedLibrary> | null = null;

  // Embedder-injeksjon: bruk override hvis satt, ellers lazy-load CLAP.
  const resolveEmbedder = async (): Promise<TextEmbedder> => {
    if (deps.embedder) return deps.embedder;
    return getClapTextEmbedder();
  };

  const ensureLibrary = async (): Promise<LoadedLibrary> => {
    if (library) return library;
    if (libraryLoading) return libraryLoading;
    libraryLoading = loadSfxLibraryFromDisk(libraryPath).then((loaded) => {
      library = loaded;
      libraryLoading = null;
      return loaded;
    }).catch((err) => {
      libraryLoading = null;
      throw err;
    });
    return libraryLoading;
  };

  // ── POST /match ───────────────────────────────────────────────
  router.post('/match', async (req: Request, res: Response) => {
    const parseResult = MatchBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'invalid_request',
        details: parseResult.error.flatten(),
      });
    }
    const { prompt, topK, categoryId, minScore } = parseResult.data;

    let lib: LoadedLibrary;
    try {
      lib = await ensureLibrary();
    } catch (err: any) {
      return res.status(500).json({
        error: 'library_load_failed',
        message: err?.message ?? String(err),
      });
    }

    if (lib.samples.length === 0) {
      return res.json({
        matches: [],
        libraryStats: {
          sampleCount: 0,
          embeddingModel: lib.embeddingModel,
        },
        warning: 'library_empty',
      });
    }

    let embedFn: TextEmbedder;
    try {
      embedFn = await resolveEmbedder();
    } catch (err: any) {
      return res.status(503).json({
        error: 'embedder_unavailable',
        message: err?.message ?? String(err),
      });
    }

    let queryEmbedding: Float32Array;
    try {
      queryEmbedding = await embedFn(prompt);
    } catch (err: any) {
      return res.status(500).json({
        error: 'embedding_failed',
        message: err?.message ?? String(err),
      });
    }

    if (queryEmbedding.length !== lib.embeddingDim) {
      return res.status(500).json({
        error: 'dim_mismatch',
        message: `Prompt-embedding dim ${queryEmbedding.length}, library dim ${lib.embeddingDim}`,
      });
    }

    const matches = matchSamples(queryEmbedding, lib, { topK, categoryId, minScore });
    return res.json({
      matches,
      libraryStats: {
        sampleCount: lib.samples.length,
        embeddingModel: lib.embeddingModel,
      },
    });
  });

  // ── GET /library/stats ────────────────────────────────────────
  router.get('/library/stats', async (_req: Request, res: Response) => {
    try {
      const lib = await ensureLibrary();
      return res.json({
        sampleCount: lib.samples.length,
        embeddingModel: lib.embeddingModel,
        embeddingDim: lib.embeddingDim,
        builtAt: lib.builtAt,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'library_load_failed',
        message: err?.message ?? String(err),
      });
    }
  });

  // ── POST /library/reload ──────────────────────────────────────
  // Tving load fra disk på nytt. Brukes etter at embedding-pipelinen
  // har bygget en ny library.json. Krever auth i prod-deployment.
  router.post('/library/reload', async (_req: Request, res: Response) => {
    try {
      const fresh = await loadSfxLibraryFromDisk(libraryPath);
      library = fresh;
      return res.json({
        sampleCount: fresh.samples.length,
        embeddingModel: fresh.embeddingModel,
        builtAt: fresh.builtAt,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'library_reload_failed',
        message: err?.message ?? String(err),
      });
    }
  });

  // ── POST /generate ───────────────────────────────────────────
  // Genererer ny SFX via ElevenLabs når CLAP-match ikke har gode
  // treff. Cache'er per prompt-hash så samme prompt ikke koster
  // dobbelt. Returnerer URL til /api/sfx/generated/:key.
  router.post('/generate', async (req: Request, res: Response) => {
    const parseResult = GenerateBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'invalid_request',
        details: parseResult.error.flatten(),
      });
    }
    const { prompt, durationSec, promptInfluence, loop } = parseResult.data;
    const generateRequest: GenerateSfxRequest = {
      prompt,
      durationSec,
      promptInfluence,
      loop,
    };

    // Cache-hit-sjekk uten å treffe API.
    const cachedHit = getCachedSfx(generateRequest);
    if (cachedHit) {
      return res.json({
        url: cachedHit.url,
        cached: true,
        sizeBytes: cachedHit.sizeBytes,
      });
    }

    const fn = deps.generateFn ?? generateSfx;
    try {
      const result = await fn(generateRequest);
      return res.json({
        url: result.url,
        cached: result.cached,
        sizeBytes: result.sizeBytes,
      });
    } catch (err: any) {
      if (err instanceof ElevenLabsError) {
        const status = err.status === 503 ? 503 : err.retryable ? 502 : 500;
        return res.status(status).json({
          error: 'generation_failed',
          message: err.message,
          retryable: err.retryable,
        });
      }
      return res.status(500).json({
        error: 'generation_failed',
        message: err?.message ?? String(err),
      });
    }
  });

  // ── GET /static/:filename ─────────────────────────────────────
  // Server "statiske" sample-filer fra data/synthetic-samples/.
  // Brukes av synthetic-sample-pakken (generert via
  // scripts/generate-synthetic-sfx.ts) som starter-bibliotek.
  router.get('/static/:filename', (req: Request, res: Response) => {
    const filename = String(req.params.filename ?? '');
    // Whitelist: a-z, 0-9, dash + .wav eller .mp3. Ingen subdirektoriet.
    const match = filename.match(/^([a-z0-9-]+)\.(wav|mp3)$/);
    if (!match) {
      return res.status(400).json({ error: 'invalid_filename' });
    }
    const ext = match[2];
    const filePath = path.resolve(
      process.cwd(),
      'data',
      'synthetic-samples',
      filename,
    );
    // Bekreft at den løste pathen er innenfor synthetic-samples-dir.
    const expectedDir = path.resolve(process.cwd(), 'data', 'synthetic-samples');
    if (!filePath.startsWith(expectedDir + path.sep) && filePath !== expectedDir) {
      return res.status(400).json({ error: 'invalid_path' });
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return res.status(404).json({ error: 'not_found' });
    }
    res.setHeader('Content-Type', ext === 'mp3' ? 'audio/mpeg' : 'audio/wav');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  });

  // ── GET /generated/:key.mp3 ───────────────────────────────────
  // Server cachet generert audio fra disk. Path-traversal-vern i
  // loadGeneratedSfxFile (kun hex-tegn tillatt).
  router.get('/generated/:filename', (req: Request, res: Response) => {
    const filename = String(req.params.filename ?? '');
    const match = filename.match(/^([a-f0-9]+)\.mp3$/);
    if (!match) {
      return res.status(400).json({ error: 'invalid_filename' });
    }
    const cacheKey = match[1];
    const loader = deps.loadGeneratedFn ?? loadGeneratedSfxFile;
    const result = loader(cacheKey);
    if (!result) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(result.sizeBytes));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    result.stream.pipe(res);
  });

  return router;
}
