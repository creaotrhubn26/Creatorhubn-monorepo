/**
 * embeddingMatch — pure-logic for å sammenligne CLAP-embeddings og
 * finne top-K matchende samples for en gitt prompt-embedding.
 *
 * CLAP-modellen produserer 512-dimensjonale float-vektorer. Likhet
 * måles via cosine similarity (innerprodukt på normaliserte vektorer).
 * Vi støtter både normaliserte og u-normaliserte input — funksjonene
 * normaliserer defensivt slik at en feil i embedding-pipelinen ikke
 * forstyrrer match-resultatet.
 *
 * Modulen er bevisst utenfor backend/frontend-skillet: pure TS,
 * ingen DOM/Node-spesifikke avhengigheter. Kan brukes både i
 * /api/sfx/match-endpoint og som offline-script.
 */

export type Embedding = Float32Array | number[];

export interface MatchableItem {
  /** Unik nøkkel for resultatet. */
  id: string;
  /** Pre-beregnet embedding (samme dimensjon som prompt-embedding). */
  embedding: Embedding;
  /** Vilkårlige metadata-felt — sendt tilbake i resultatet. */
  [key: string]: unknown;
}

export interface MatchResult<T extends MatchableItem> {
  item: T;
  /** Cosine similarity i [-1, 1]. Høyere = mer likt. */
  score: number;
}

/** Euklidisk lengde (L2-norm) av en vektor. */
export function vectorNorm(vec: Embedding): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i += 1) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

/**
 * Normaliser til enhetsvektor. Returnerer en NY array — muterer ikke
 * input. Returnerer null hvis input er null-vektor (alle 0).
 */
export function normalize(vec: Embedding): Float32Array | null {
  const norm = vectorNorm(vec);
  if (norm === 0 || !Number.isFinite(norm)) return null;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i += 1) {
    out[i] = vec[i] / norm;
  }
  return out;
}

/**
 * Cosine similarity mellom to vektorer. Returnerer NaN hvis enten
 * er null-vektor eller dimensjonene ikke matcher.
 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
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

/**
 * Finn top-K mest like items for en gitt query-embedding.
 *
 * Algoritmevalg: lineær scan + min-heap er teoretisk O(N log K),
 * men for typiske sample-biblioteker (~1000 items) er lineær scan
 * + sort raskere i praksis (cache-friendly, ingen heap-overhead).
 * Vi går for sortér-deretter-slice for klarhet.
 *
 * Filtering: valgfri predikat-funksjon for å begrense kandidater
 * (f.eks. "kun samples i kategori X"). Anvendt FØR similarity-
 * beregning så vi sparer tid på store biblioteker.
 */
export function topKMatches<T extends MatchableItem>(
  query: Embedding,
  items: T[],
  topK = 3,
  options: {
    filter?: (item: T) => boolean;
    /** Hopp over items med score under denne (cosine similarity). */
    minScore?: number;
  } = {},
): MatchResult<T>[] {
  if (topK <= 0) return [];
  if (items.length === 0) return [];

  const { filter, minScore } = options;
  const results: MatchResult<T>[] = [];

  for (const item of items) {
    if (filter && !filter(item)) continue;
    const score = cosineSimilarity(query, item.embedding);
    if (!Number.isFinite(score)) continue;
    if (minScore !== undefined && score < minScore) continue;
    results.push({ item, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Bygg en kategori-filtrert wrapper. Nyttig når SFX-eventen kjenner
 * sin categoryId og vi vil restrikere matches til samme kategori.
 */
export function filterByCategory<T extends MatchableItem & { categoryId?: string }>(
  categoryId: string,
): (item: T) => boolean {
  return (item) => item.categoryId === categoryId;
}
