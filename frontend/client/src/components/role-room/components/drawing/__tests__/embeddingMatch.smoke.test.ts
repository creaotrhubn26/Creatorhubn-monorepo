// @ts-nocheck
import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  normalize,
  vectorNorm,
  topKMatches,
  filterByCategory,
} from '../embeddingMatch';

describe('Sprint A.7 — embeddingMatch.vectorNorm', () => {
  it('null-vektor har norm 0', () => {
    expect(vectorNorm([0, 0, 0])).toBe(0);
  });

  it('enhetsvektor har norm 1', () => {
    expect(vectorNorm([1, 0, 0])).toBe(1);
    expect(vectorNorm([0.6, 0.8, 0])).toBeCloseTo(1);
  });

  it('norm av [3, 4] er 5 (klassisk pythagoras)', () => {
    expect(vectorNorm([3, 4])).toBe(5);
  });

  it('virker med Float32Array', () => {
    expect(vectorNorm(new Float32Array([3, 4]))).toBe(5);
  });
});

describe('Sprint A.7 — embeddingMatch.normalize', () => {
  it('null-vektor returnerer null', () => {
    expect(normalize([0, 0, 0])).toBeNull();
  });

  it('normaliserer til enhetsvektor', () => {
    const normalized = normalize([3, 4]);
    expect(normalized).not.toBeNull();
    expect(vectorNorm(normalized!)).toBeCloseTo(1);
    expect(normalized![0]).toBeCloseTo(0.6);
    expect(normalized![1]).toBeCloseTo(0.8);
  });

  it('returnerer Float32Array', () => {
    const result = normalize([1, 1, 1]);
    expect(result).toBeInstanceOf(Float32Array);
  });

  it('muterer ikke input', () => {
    const input = [3, 4];
    normalize(input);
    expect(input).toEqual([3, 4]);
  });
});

describe('Sprint A.7 — embeddingMatch.cosineSimilarity', () => {
  it('identiske vektorer gir similarity 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('motsatt rettede vektorer gir similarity -1', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1);
  });

  it('ortogonale vektorer gir similarity 0', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it('skalering påvirker ikke similarity', () => {
    expect(cosineSimilarity([1, 0, 0], [5, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('NaN ved dimensjons-mismatch', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBeNaN();
  });

  it('NaN ved null-vektor', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBeNaN();
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBeNaN();
  });

  it('virker med Float32Array', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});

describe('Sprint A.7 — embeddingMatch.topKMatches', () => {
  const library = [
    { id: 'a', embedding: [1, 0, 0], categoryId: 'door' },
    { id: 'b', embedding: [0, 1, 0], categoryId: 'door' },
    { id: 'c', embedding: [0.9, 0.1, 0], categoryId: 'footsteps' },
    { id: 'd', embedding: [-1, 0, 0], categoryId: 'door' },
  ];

  it('tom liste returnerer tom resultat', () => {
    expect(topKMatches([1, 0, 0], [], 3)).toEqual([]);
  });

  it('topK=0 returnerer tom resultat', () => {
    expect(topKMatches([1, 0, 0], library, 0)).toEqual([]);
  });

  it('returnerer items sortert på score (høyest først)', () => {
    const results = topKMatches([1, 0, 0], library, 4);
    expect(results.map((r) => r.item.id)).toEqual(['a', 'c', 'b', 'd']);
    // a er perfekt match, c er nær, b er ortogonal, d er motsatt
  });

  it('topK begrenser antall resultater', () => {
    const results = topKMatches([1, 0, 0], library, 2);
    expect(results.length).toBe(2);
    expect(results[0].item.id).toBe('a');
    expect(results[1].item.id).toBe('c');
  });

  it('score er cosine similarity i [-1, 1]', () => {
    const results = topKMatches([1, 0, 0], library, 4);
    expect(results[0].score).toBeCloseTo(1); // identisk
    expect(results[3].score).toBeCloseTo(-1); // motsatt
  });

  it('filter restrikterer kandidater før similarity', () => {
    const results = topKMatches([1, 0, 0], library, 5, {
      filter: filterByCategory('door'),
    });
    expect(results.map((r) => r.item.id)).toEqual(['a', 'b', 'd']);
    // 'c' (footsteps) er ekskludert
  });

  it('minScore filtrerer bort dårlige matches', () => {
    const results = topKMatches([1, 0, 0], library, 5, {
      minScore: 0.5,
    });
    expect(results.map((r) => r.item.id)).toEqual(['a', 'c']);
    // b (0), d (-1) er under 0.5
  });

  it('filter + minScore kombinert', () => {
    const results = topKMatches([1, 0, 0], library, 5, {
      filter: filterByCategory('door'),
      minScore: 0.5,
    });
    expect(results.map((r) => r.item.id)).toEqual(['a']);
  });

  it('hopper over items uten gyldig embedding', () => {
    const lib = [
      { id: 'good', embedding: [1, 0, 0] },
      { id: 'wrong-dim', embedding: [1, 0] },
      { id: 'zero', embedding: [0, 0, 0] },
    ];
    const results = topKMatches([1, 0, 0], lib, 5);
    expect(results.map((r) => r.item.id)).toEqual(['good']);
  });
});

describe('Sprint A.7 — filterByCategory', () => {
  it('matcher kun items med oppgitt categoryId', () => {
    const filter = filterByCategory('door');
    expect(filter({ id: 'a', embedding: [], categoryId: 'door' })).toBe(true);
    expect(filter({ id: 'b', embedding: [], categoryId: 'window' })).toBe(false);
  });

  it('items uten categoryId matcher ikke', () => {
    const filter = filterByCategory('door');
    expect(filter({ id: 'a', embedding: [] })).toBe(false);
  });
});
