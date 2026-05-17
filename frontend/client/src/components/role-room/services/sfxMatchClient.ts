/**
 * sfxMatchClient.ts
 *
 * Frontend-klient mot /api/sfx/match — CLAP-basert SFX-matching.
 * Bruker den eksisterende apiRequest-helperen for konsistent auth
 * og feilhåndtering.
 *
 * Inkluderer en in-memory LRU-cache så at samme prompt+kategori-
 * kombinasjon ikke trigger et nytt embedding-kall innenfor samme
 * session. CLAP-embedding er deterministisk — caching er trygt.
 */

import { apiRequest } from './castingApiService';

export interface SfxMatchHit {
  id: string;
  title: string;
  url: string;
  categoryId: string;
  license: string;
  attribution?: string;
  durationSec?: number;
  /** Cosine similarity i [-1, 1]. Høyere = bedre treff. */
  score: number;
}

export interface SfxMatchRequest {
  prompt: string;
  topK?: number;
  categoryId?: string;
  minScore?: number;
}

export interface SfxMatchResponse {
  matches: SfxMatchHit[];
  libraryStats: {
    sampleCount: number;
    embeddingModel: string;
  };
  warning?: 'library_empty';
}

export interface SfxLibraryStats {
  sampleCount: number;
  embeddingModel: string;
  embeddingDim: number;
  builtAt: string;
}

// ============================================================================
// In-memory LRU-cache for å unngå repeterte CLAP-embeddings
// ============================================================================

const CACHE_MAX = 64;
const cache = new Map<string, SfxMatchResponse>();

function cacheKey(req: SfxMatchRequest): string {
  return JSON.stringify({
    p: req.prompt.trim().toLowerCase(),
    k: req.topK ?? 3,
    c: req.categoryId ?? null,
    m: req.minScore ?? null,
  });
}

function setCache(key: string, value: SfxMatchResponse): void {
  // Slett oldest hvis vi er over max.
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, value);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Hent matchende SFX-samples for et tekst-prompt.
 *
 * @param request - prompt + valgfri topK/categoryId/minScore
 * @param options - { skipCache: true } for å tvinge friskt kall
 */
export async function matchSfx(
  request: SfxMatchRequest,
  options: { skipCache?: boolean } = {},
): Promise<SfxMatchResponse> {
  const key = cacheKey(request);
  if (!options.skipCache) {
    const cached = cache.get(key);
    if (cached) {
      // Re-insert for LRU recency.
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
  }

  const response = await apiRequest<SfxMatchResponse>('/api/sfx/match', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  setCache(key, response);
  return response;
}

/**
 * Hent library-status — sjekker om backend faktisk har et populated
 * library før vi viser "Foreslå lyd"-knappen.
 */
export async function getSfxLibraryStats(): Promise<SfxLibraryStats> {
  return apiRequest<SfxLibraryStats>('/api/sfx/library/stats', {
    method: 'GET',
  });
}

/**
 * Tøm in-memory caches (brukes etter library-reload eller for testing).
 */
export function clearSfxMatchCache(): void {
  cache.clear();
}

/**
 * Test-helper for å lese cache-størrelse (brukes i unit-tester).
 */
export function _sfxMatchCacheSize(): number {
  return cache.size;
}

// ============================================================================
// AI-generering (ElevenLabs fallback)
// ============================================================================

export interface GenerateSfxRequest {
  prompt: string;
  durationSec?: number;
  promptInfluence?: number;
  loop?: boolean;
}

export interface GenerateSfxResponse {
  /** Public URL til generert audio — bruk direkte i Audio-elementet. */
  url: string;
  /** True hvis serveren returnerte fra cache uten å kalle ElevenLabs. */
  cached: boolean;
  sizeBytes: number;
}

/**
 * Generer en helt ny SFX via ElevenLabs. Backend disk-cacher per
 * prompt-hash, så samme prompt-kall to ganger koster bare første
 * gangen.
 */
export async function generateSfx(request: GenerateSfxRequest): Promise<GenerateSfxResponse> {
  return apiRequest<GenerateSfxResponse>('/api/sfx/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================================
// Visuell SFX-deteksjon (Claude vision)
// ============================================================================

export interface VisualSfxEvent {
  categoryId: string;
  offsetSec: number;
  intensity: 'low' | 'medium' | 'high';
  rationale?: string;
}

export interface DetectVisualSfxRequest {
  /** data:image/{png|jpeg|webp|gif};base64,... */
  imageDataUrl: string;
  frameDurationSec: number;
}

export interface DetectVisualSfxResponse {
  events: VisualSfxEvent[];
  cached: boolean;
  cacheKey: string;
}

/**
 * Analyser et frame-bilde med Claude vision og få tilbake foreslåtte
 * SFX-events med timing. Cache'er per (image-hash + duration) på
 * backend så samme frame ikke analyseres to ganger.
 */
export async function detectVisualSfx(
  request: DetectVisualSfxRequest,
): Promise<DetectVisualSfxResponse> {
  return apiRequest<DetectVisualSfxResponse>('/api/sfx/visual-detect', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
