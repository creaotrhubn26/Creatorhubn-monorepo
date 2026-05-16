// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  validateSfxLibrary,
  hydrateLibrarySamples,
  emptyLibrary,
  CURRENT_LIBRARY_VERSION,
  DEFAULT_EMBEDDING_DIM,
} from '../sfxLibrary';

function makeSample(overrides: any = {}): any {
  return {
    id: 'sample-1',
    title: 'Door slam 1',
    url: '/sfx/door-slam-1.mp3',
    categoryId: 'door-slam',
    license: 'CC0',
    embedding: new Array(DEFAULT_EMBEDDING_DIM).fill(0.1),
    ...overrides,
  };
}

function makeLibrary(samples: any[]): any {
  return {
    version: CURRENT_LIBRARY_VERSION,
    embeddingModel: 'laion/clap-htsat-unfused',
    embeddingDim: DEFAULT_EMBEDDING_DIM,
    builtAt: new Date().toISOString(),
    samples,
  };
}

describe('Sprint A.7 — sfxLibrary.emptyLibrary', () => {
  it('returnerer gyldig tom library', () => {
    const lib = emptyLibrary();
    const result = validateSfxLibrary(lib);
    expect(result.ok).toBe(true);
    expect(lib.samples).toEqual([]);
  });

  it('emptyLibrary har riktig versjon', () => {
    expect(emptyLibrary().version).toBe(CURRENT_LIBRARY_VERSION);
  });
});

describe('Sprint A.7 — sfxLibrary.validateSfxLibrary', () => {
  it('null/undefined avvises', () => {
    expect(validateSfxLibrary(null).ok).toBe(false);
    expect(validateSfxLibrary(undefined).ok).toBe(false);
  });

  it('manglende felter feiles med beskrivende meldinger', () => {
    const result = validateSfxLibrary({ samples: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
    expect(result.errors.some((e) => e.includes('embeddingModel'))).toBe(true);
  });

  it('nyere version-tall enn støttet avvises', () => {
    const lib = makeLibrary([]);
    lib.version = CURRENT_LIBRARY_VERSION + 1;
    const result = validateSfxLibrary(lib);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('nyere'))).toBe(true);
  });

  it('aksepterer tomt library', () => {
    expect(validateSfxLibrary(makeLibrary([])).ok).toBe(true);
  });

  it('aksepterer library med gyldige samples', () => {
    expect(validateSfxLibrary(makeLibrary([makeSample()])).ok).toBe(true);
  });

  it('duplikat-ID i samples avvises', () => {
    const result = validateSfxLibrary(makeLibrary([
      makeSample({ id: 'a' }),
      makeSample({ id: 'a' }),
    ]));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('duplikat'))).toBe(true);
  });

  it('feil embedding-dim avvises', () => {
    const result = validateSfxLibrary(makeLibrary([
      makeSample({ embedding: [0.1, 0.2, 0.3] }),
    ]));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('dim'))).toBe(true);
  });

  it('NaN i embedding avvises', () => {
    const arr = new Array(DEFAULT_EMBEDDING_DIM).fill(0.1);
    arr[5] = NaN;
    const result = validateSfxLibrary(makeLibrary([
      makeSample({ embedding: arr }),
    ]));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('numeriske'))).toBe(true);
  });

  it('manglende url/categoryId/license rapporteres separat', () => {
    const result = validateSfxLibrary(makeLibrary([
      makeSample({ url: undefined, categoryId: undefined, license: undefined }),
    ]));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('url'))).toBe(true);
    expect(result.errors.some((e) => e.includes('categoryId'))).toBe(true);
    expect(result.errors.some((e) => e.includes('license'))).toBe(true);
  });
});

describe('Sprint A.7 — sfxLibrary.hydrateLibrarySamples', () => {
  it('konverterer number[]-embedding til Float32Array', () => {
    const lib = makeLibrary([makeSample()]);
    const hydrated = hydrateLibrarySamples(lib);
    expect(hydrated[0].embedding).toBeInstanceOf(Float32Array);
    expect(hydrated[0].embedding.length).toBe(DEFAULT_EMBEDDING_DIM);
  });

  it('bevarer metadata-feltene', () => {
    const lib = makeLibrary([makeSample({ tags: ['hard', 'metal'] })]);
    const hydrated = hydrateLibrarySamples(lib);
    expect(hydrated[0].id).toBe('sample-1');
    expect(hydrated[0].tags).toEqual(['hard', 'metal']);
    expect(hydrated[0].license).toBe('CC0');
  });

  it('returnerer ny array — muterer ikke original', () => {
    const lib = makeLibrary([makeSample()]);
    const hydrated = hydrateLibrarySamples(lib);
    expect(hydrated).not.toBe(lib.samples);
    expect(lib.samples[0].embedding).toBeInstanceOf(Array);
  });
});
