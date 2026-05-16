/**
 * sfxLibrary — typer + validator for det CLAP-embeddede sample-
 * biblioteket som /api/sfx/match og embedding-pipelinen deler.
 *
 * Format-versjonering: vi øker `version` ved breaking-endringer
 * (f.eks. ny embedding-modell med annen dim). Loadere validerer
 * versjonen og avviser inkompatible biblioteker for å unngå at
 * mismatched embeddings gir tilfeldig dårlige matches.
 */

/** Lisens-koder vi støtter. Holder oss til ting som er trygt
 *  kommersielt. */
export type SfxLicense =
  | 'CC0'              // Public domain
  | 'CC-BY'            // Krever attribusjon
  | 'CC-BY-SA'         // Attribusjon + share-alike
  | 'Pixabay'          // Pixabay Content License
  | 'BBC-SFX'          // BBC Sound Effects (RemArc)
  | 'proprietary';     // Bruker har egne rettigheter

export interface SfxLibrarySample {
  /** Stabil ID, vanligvis kebab-case. */
  id: string;
  /** Visningsnavn. */
  title: string;
  /** URL — kan være relativ (/sfx-samples/...) eller absolutt. */
  url: string;
  /** Kategori-ID som matcher SFX_CATEGORIES. */
  categoryId: string;
  /** Lisens-type. */
  license: SfxLicense;
  /** Hvem klippet kommer fra (kreves for CC-BY). */
  attribution?: string;
  /** Lengde i sekunder, hvis kjent. */
  durationSec?: number;
  /** Tags for ekstra filtrering. */
  tags?: string[];
  /** CLAP-embedding — 512-dim float-vektor. Lagres som array i JSON,
   *  konverteres til Float32Array i runtime for ytelse. */
  embedding: number[];
}

export interface SfxLibrary {
  /** Versjon av library-formatet (breaking ved bump). */
  version: number;
  /** CLAP-modell-id som ble brukt for å generere embeddings.
   *  Match mot prompt-embedding må bruke samme modell. */
  embeddingModel: string;
  /** Dimensjonen på embeddings. Standard CLAP er 512. */
  embeddingDim: number;
  /** Når biblioteket ble bygget (ISO-string). */
  builtAt: string;
  samples: SfxLibrarySample[];
}

export const CURRENT_LIBRARY_VERSION = 1;
export const DEFAULT_EMBEDDING_MODEL = 'laion/clap-htsat-unfused';
export const DEFAULT_EMBEDDING_DIM = 512;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Valider et library-payload. Returnerer feilliste eller ok=true.
 * Defensiv mot korrupte JSON-filer; brukes både ved load-tid og
 * etter embedding-pipeline-kjøring.
 */
export function validateSfxLibrary(library: unknown): ValidationResult {
  const errors: string[] = [];
  if (!library || typeof library !== 'object') {
    return { ok: false, errors: ['library må være et objekt'] };
  }
  const lib = library as Partial<SfxLibrary>;
  if (typeof lib.version !== 'number') errors.push('version mangler eller er ikke et tall');
  if (lib.version !== undefined && lib.version > CURRENT_LIBRARY_VERSION) {
    errors.push(`version ${lib.version} er nyere enn støttet (${CURRENT_LIBRARY_VERSION}) — oppgrader klienten`);
  }
  if (typeof lib.embeddingModel !== 'string') errors.push('embeddingModel mangler');
  if (typeof lib.embeddingDim !== 'number') errors.push('embeddingDim mangler');
  if (!Array.isArray(lib.samples)) {
    errors.push('samples må være en array');
    return { ok: false, errors };
  }
  const dim = lib.embeddingDim;
  const seen = new Set<string>();
  lib.samples.forEach((sample, idx) => {
    if (!sample || typeof sample !== 'object') {
      errors.push(`samples[${idx}] er ikke et objekt`);
      return;
    }
    if (typeof sample.id !== 'string' || !sample.id) {
      errors.push(`samples[${idx}].id mangler`);
    } else if (seen.has(sample.id)) {
      errors.push(`samples[${idx}].id "${sample.id}" er duplikat`);
    } else {
      seen.add(sample.id);
    }
    if (typeof sample.url !== 'string') errors.push(`samples[${idx}].url mangler`);
    if (typeof sample.categoryId !== 'string') errors.push(`samples[${idx}].categoryId mangler`);
    if (typeof sample.license !== 'string') errors.push(`samples[${idx}].license mangler`);
    if (!Array.isArray(sample.embedding)) {
      errors.push(`samples[${idx}].embedding mangler eller er ikke array`);
    } else if (sample.embedding.length !== dim) {
      errors.push(`samples[${idx}].embedding har dim ${sample.embedding.length}, forventet ${dim}`);
    } else if (!sample.embedding.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      errors.push(`samples[${idx}].embedding inneholder ikke-numeriske verdier`);
    }
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Konverter samples sine number[]-embeddings til Float32Array — gir
 * bedre cache-bruk i hot path (cosine-similarity-loopen) og lavere
 * minneforbruk for store biblioteker.
 */
export function hydrateLibrarySamples(library: SfxLibrary): Array<SfxLibrarySample & { embedding: Float32Array }> {
  return library.samples.map((sample) => ({
    ...sample,
    embedding: new Float32Array(sample.embedding),
  }));
}

/**
 * Bygg en tom library — brukes som start-punkt for embedding-
 * pipelinen og for fallback når ingen library er deployet.
 */
export function emptyLibrary(): SfxLibrary {
  return {
    version: CURRENT_LIBRARY_VERSION,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    embeddingDim: DEFAULT_EMBEDDING_DIM,
    builtAt: new Date().toISOString(),
    samples: [],
  };
}
