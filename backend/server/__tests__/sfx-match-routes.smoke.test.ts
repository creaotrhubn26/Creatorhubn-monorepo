import { describe, expect, it, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSfxMatchRouter } from '../sfx-match-routes.js';
import type { LoadedLibrary, TextEmbedder } from '../_sfx-clap.js';

const EMBED_DIM = 512;

function makeUnitVector(seedIndex: number): Float32Array {
  // Lager en deterministisk embedding der seedIndex'te entry er 1
  // og resten er 0 — gjør cosine-similarity-resultatene helt
  // forutsigbare i tester.
  const v = new Float32Array(EMBED_DIM);
  v[seedIndex % EMBED_DIM] = 1;
  return v;
}

function makeLibrary(samples: Array<{ id: string; categoryId: string; seed: number; title?: string }>): LoadedLibrary {
  return {
    embeddingModel: 'Xenova/clap-htsat-unfused',
    embeddingDim: EMBED_DIM,
    builtAt: new Date().toISOString(),
    samples: samples.map((s) => ({
      id: s.id,
      title: s.title ?? s.id,
      url: `/sfx/${s.id}.mp3`,
      categoryId: s.categoryId,
      license: 'CC0',
      embedding: makeUnitVector(s.seed),
    })),
  };
}

function buildApp(opts: {
  embedder: TextEmbedder;
  library?: LoadedLibrary;
  libraryPath?: string;
}) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/sfx',
    createSfxMatchRouter({
      embedder: opts.embedder,
      preloadedLibrary: opts.library,
      libraryPath: opts.libraryPath,
    }),
  );
  return app;
}

describe('Sprint A.7 — POST /api/sfx/match input-validering', () => {
  const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);

  it('avviser body uten prompt', async () => {
    const app = buildApp({ embedder: fakeEmbedder, library: makeLibrary([]) });
    const res = await request(app).post('/api/sfx/match').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('avviser tom prompt-string', async () => {
    const app = buildApp({ embedder: fakeEmbedder, library: makeLibrary([]) });
    const res = await request(app).post('/api/sfx/match').send({ prompt: '' });
    expect(res.status).toBe(400);
  });

  it('avviser topK > 20', async () => {
    const app = buildApp({ embedder: fakeEmbedder, library: makeLibrary([]) });
    const res = await request(app).post('/api/sfx/match').send({ prompt: 'door', topK: 100 });
    expect(res.status).toBe(400);
  });

  it('avviser ekstreme prompt-lengder', async () => {
    const app = buildApp({ embedder: fakeEmbedder, library: makeLibrary([]) });
    const longPrompt = 'a'.repeat(600);
    const res = await request(app).post('/api/sfx/match').send({ prompt: longPrompt });
    expect(res.status).toBe(400);
  });
});

describe('Sprint A.7 — POST /api/sfx/match resultater', () => {
  it('tomt library returnerer warning + tom array', async () => {
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, library: makeLibrary([]) });
    const res = await request(app).post('/api/sfx/match').send({ prompt: 'door slam' });
    expect(res.status).toBe(200);
    expect(res.body.matches).toEqual([]);
    expect(res.body.warning).toBe('library_empty');
  });

  it('returnerer top-K sortert på similarity', async () => {
    // Library: 4 samples med forskjellige unit-vektorer.
    const lib = makeLibrary([
      { id: 'perfect-match', categoryId: 'door', seed: 0 },
      { id: 'close-match', categoryId: 'door', seed: 1 },
      { id: 'far-match', categoryId: 'door', seed: 100 },
      { id: 'orthogonal', categoryId: 'door', seed: 200 },
    ]);
    // Query = unit-vektor med samme seed som perfect-match.
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, library: lib });
    const res = await request(app)
      .post('/api/sfx/match')
      .send({ prompt: 'door slam', topK: 2 });
    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(2);
    expect(res.body.matches[0].id).toBe('perfect-match');
    expect(res.body.matches[0].score).toBeCloseTo(1);
    // De andre tre er alle ortogonale på unit-basis, så scoren er 0.
    expect(res.body.matches[1].score).toBeCloseTo(0);
  });

  it('categoryId-filter restrikterer kandidater', async () => {
    const lib = makeLibrary([
      { id: 'door-1', categoryId: 'door-slam', seed: 0 },
      { id: 'door-2', categoryId: 'door-slam', seed: 1 },
      { id: 'footstep-1', categoryId: 'footsteps-walking', seed: 0 },
    ]);
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, library: lib });
    const res = await request(app)
      .post('/api/sfx/match')
      .send({ prompt: 'door', categoryId: 'door-slam', topK: 5 });
    expect(res.status).toBe(200);
    expect(res.body.matches.map((m: any) => m.id)).toEqual(['door-1', 'door-2']);
  });

  it('minScore filtrerer bort dårlige matches', async () => {
    const lib = makeLibrary([
      { id: 'good', categoryId: 'door', seed: 0 },
      { id: 'bad', categoryId: 'door', seed: 100 },
    ]);
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, library: lib });
    const res = await request(app)
      .post('/api/sfx/match')
      .send({ prompt: 'door', minScore: 0.5, topK: 5 });
    expect(res.body.matches.map((m: any) => m.id)).toEqual(['good']);
  });

  it('libraryStats er inkludert i respons', async () => {
    const lib = makeLibrary([
      { id: 'a', categoryId: 'door', seed: 0 },
      { id: 'b', categoryId: 'door', seed: 1 },
    ]);
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, library: lib });
    const res = await request(app).post('/api/sfx/match').send({ prompt: 'door' });
    expect(res.body.libraryStats.sampleCount).toBe(2);
    expect(res.body.libraryStats.embeddingModel).toBe('Xenova/clap-htsat-unfused');
  });
});

describe('Sprint A.7 — POST /api/sfx/match feilhåndtering', () => {
  it('embedder som kaster gir 500 med embedding_failed', async () => {
    const failingEmbedder: TextEmbedder = async () => {
      throw new Error('CLAP timeout');
    };
    const app = buildApp({ embedder: failingEmbedder, library: makeLibrary([{ id: 'a', categoryId: 'door', seed: 0 }]) });
    const res = await request(app).post('/api/sfx/match').send({ prompt: 'door' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('embedding_failed');
    expect(res.body.message).toContain('CLAP timeout');
  });

  it('embedding med feil dim gir 500 med dim_mismatch', async () => {
    const wrongDimEmbedder: TextEmbedder = async () => new Float32Array(256);
    const lib = makeLibrary([{ id: 'a', categoryId: 'door', seed: 0 }]);
    const app = buildApp({ embedder: wrongDimEmbedder, library: lib });
    const res = await request(app).post('/api/sfx/match').send({ prompt: 'door' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('dim_mismatch');
  });
});

describe('Sprint A.7 — GET /api/sfx/library/stats', () => {
  it('returnerer library-metadata', async () => {
    const lib = makeLibrary([
      { id: 'a', categoryId: 'door', seed: 0 },
      { id: 'b', categoryId: 'door', seed: 1 },
    ]);
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, library: lib });
    const res = await request(app).get('/api/sfx/library/stats');
    expect(res.status).toBe(200);
    expect(res.body.sampleCount).toBe(2);
    expect(res.body.embeddingDim).toBe(EMBED_DIM);
    expect(res.body.embeddingModel).toBe('Xenova/clap-htsat-unfused');
  });
});

describe('Sprint A.7 — POST /api/sfx/library/reload', () => {
  let tmpFile: string;

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfx-test-'));
    tmpFile = path.join(tmpDir, 'sfx-library.json');
  });

  it('laster på nytt fra disk', async () => {
    // Skriv en initial library til disk.
    const initialLib = {
      version: 1,
      embeddingModel: 'Xenova/clap-htsat-unfused',
      embeddingDim: EMBED_DIM,
      builtAt: new Date().toISOString(),
      samples: [{
        id: 'init',
        title: 'init',
        url: '/x.mp3',
        categoryId: 'door',
        license: 'CC0',
        embedding: Array.from({ length: EMBED_DIM }, () => 0.1),
      }],
    };
    fs.writeFileSync(tmpFile, JSON.stringify(initialLib));

    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, libraryPath: tmpFile });

    // Første reload skal gi 1 sample.
    let res = await request(app).post('/api/sfx/library/reload');
    expect(res.status).toBe(200);
    expect(res.body.sampleCount).toBe(1);

    // Skriv en NY library med 3 samples.
    initialLib.samples.push(
      { ...initialLib.samples[0], id: 'b' },
      { ...initialLib.samples[0], id: 'c' },
    );
    fs.writeFileSync(tmpFile, JSON.stringify(initialLib));

    // Andre reload skal nå rapportere 3.
    res = await request(app).post('/api/sfx/library/reload');
    expect(res.status).toBe(200);
    expect(res.body.sampleCount).toBe(3);
  });

  it('returnerer 500 hvis library-fila er korrupt', async () => {
    fs.writeFileSync(tmpFile, '{ ikke gyldig json');
    const fakeEmbedder: TextEmbedder = async () => makeUnitVector(0);
    const app = buildApp({ embedder: fakeEmbedder, libraryPath: tmpFile });
    const res = await request(app).post('/api/sfx/library/reload');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('library_reload_failed');
  });
});
