// @ts-nocheck
import { describe, expect, it, beforeEach } from 'vitest';
import {
  addMoodBoardImage,
  listMoodBoardImages,
  removeMoodBoardImage,
  reorderMoodBoardImages,
  updateMoodBoardImageMeta,
  clearMoodBoard,
  getStorageUsage,
} from '../moodBoardStore';

const TINY_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

describe('Sprint A.7 — moodBoardStore CRUD', () => {
  it('tom liste når ingen bilder er pinnet', () => {
    expect(listMoodBoardImages('scene-1')).toEqual([]);
  });

  it('add inserts et bilde og returner ok', () => {
    const result = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'test' });
    expect(result.ok).toBe(true);
    expect(result.image?.caption).toBe('test');
    expect(listMoodBoardImages('scene-1')).toHaveLength(1);
  });

  it('add med invalid dataUrl returnerer feil', () => {
    const result = addMoodBoardImage('scene-1', { dataUrl: 'not-a-data-url' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid-data-url');
  });

  it('add med for stort bilde returnerer too-large', () => {
    // Bygg en >5 MB dataURL.
    const hugePayload = 'A'.repeat(7 * 1024 * 1024);
    const hugeUrl = `data:image/png;base64,${hugePayload}`;
    const result = addMoodBoardImage('scene-1', { dataUrl: hugeUrl });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('too-large');
  });

  it('add med 2-3 MB returnerer ok men med over-soft-limit-warning', () => {
    // ~3 MB base64 → ~2.25 MB payload, men 4 MB i strenglengde.
    // For å overstige soft-limit (2 MB raw) trenger vi ~2.7 MB base64.
    const payload = 'A'.repeat(3 * 1024 * 1024);
    const url = `data:image/png;base64,${payload}`;
    const result = addMoodBoardImage('scene-1', { dataUrl: url });
    expect(result.ok).toBe(true);
    expect(result.warning).toBe('over-soft-limit');
  });

  it('order øker monotont per add', () => {
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    const images = listMoodBoardImages('scene-1');
    expect(images.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('remove fjerner et bilde og re-pakker order', () => {
    const r1 = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'a' });
    const r2 = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'b' });
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'c' });

    const removed = removeMoodBoardImage('scene-1', r2.image!.id);
    expect(removed).toBe(true);

    const images = listMoodBoardImages('scene-1');
    expect(images).toHaveLength(2);
    expect(images.map((i) => i.caption)).toEqual(['a', 'c']);
    expect(images.map((i) => i.order)).toEqual([0, 1]);
  });

  it('remove med ukjent id returnerer false', () => {
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    expect(removeMoodBoardImage('scene-1', 'unknown-id')).toBe(false);
  });

  it('reorder bytter rekkefølge på bildene', () => {
    const r1 = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'first' });
    const r2 = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'second' });
    const r3 = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'third' });

    reorderMoodBoardImages('scene-1', [r3.image!.id, r1.image!.id, r2.image!.id]);

    const images = listMoodBoardImages('scene-1');
    expect(images.map((i) => i.caption)).toEqual(['third', 'first', 'second']);
  });

  it('updateMeta endrer caption og tags', () => {
    const r = addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    updateMoodBoardImageMeta('scene-1', r.image!.id, { caption: 'oppdatert', tags: ['mood', 'night'] });
    const [img] = listMoodBoardImages('scene-1');
    expect(img.caption).toBe('oppdatert');
    expect(img.tags).toEqual(['mood', 'night']);
  });

  it('clearMoodBoard tømmer hele scenen', () => {
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    clearMoodBoard('scene-1');
    expect(listMoodBoardImages('scene-1')).toEqual([]);
  });

  it('isolerer per sceneId', () => {
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL, caption: 'a' });
    addMoodBoardImage('scene-2', { dataUrl: TINY_DATA_URL, caption: 'b' });
    expect(listMoodBoardImages('scene-1')).toHaveLength(1);
    expect(listMoodBoardImages('scene-2')).toHaveLength(1);
    expect(listMoodBoardImages('scene-1')[0].caption).toBe('a');
  });

  it('storageUsage rapporterer count og bytes', () => {
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    addMoodBoardImage('scene-1', { dataUrl: TINY_DATA_URL });
    const usage = getStorageUsage('scene-1');
    expect(usage.totalImages).toBe(2);
    expect(usage.totalBytes).toBeGreaterThan(0);
    expect(usage.isNearLimit).toBe(false);
  });
});
