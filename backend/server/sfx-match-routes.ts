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
import path from 'node:path';
import { z } from 'zod';
import {
  getClapTextEmbedder,
  loadSfxLibraryFromDisk,
  matchSamples,
  type LoadedLibrary,
  type TextEmbedder,
} from './_sfx-clap.js';

const DEFAULT_LIBRARY_PATH = path.resolve(process.cwd(), 'data', 'sfx-library.json');

const MatchBodySchema = z.object({
  prompt: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).optional(),
  categoryId: z.string().min(1).max(64).optional(),
  minScore: z.number().min(-1).max(1).optional(),
});

export interface SfxMatchRouterDeps {
  /** Path til library JSON. Default: data/sfx-library.json under cwd. */
  libraryPath?: string;
  /** Override-embedder for tester. Default: lazy-load CLAP. */
  embedder?: TextEmbedder;
  /** Pre-loadet library (for tester). Default: load fra disk. */
  preloadedLibrary?: LoadedLibrary;
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

  return router;
}
