// @ts-nocheck
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  saveScratchTrack,
  loadScratchTrack,
  deleteScratchTrack,
} from '../animaticAudioStore';

describe('Sprint A.7 — animaticAudioStore fallback (no IndexedDB)', () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    originalIndexedDB = (global as any).indexedDB;
    delete (global as any).indexedDB;
  });

  afterEach(() => {
    (global as any).indexedDB = originalIndexedDB;
  });

  it('save uten indexedDB returnerer false', async () => {
    const file = new File(['fake-audio'], 'test.mp3', { type: 'audio/mpeg' });
    const result = await saveScratchTrack('scene-1', file);
    expect(result).toBe(false);
  });

  it('load uten indexedDB returnerer null', async () => {
    const result = await loadScratchTrack('scene-1');
    expect(result).toBeNull();
  });

  it('delete uten indexedDB returnerer false', async () => {
    const result = await deleteScratchTrack('scene-1');
    expect(result).toBe(false);
  });

  it('save uten sceneId returnerer false', async () => {
    const file = new File(['x'], 't.mp3', { type: 'audio/mpeg' });
    expect(await saveScratchTrack('', file)).toBe(false);
  });

  it('load uten sceneId returnerer null', async () => {
    expect(await loadScratchTrack('')).toBeNull();
  });

  it('delete uten sceneId returnerer false', async () => {
    expect(await deleteScratchTrack('')).toBe(false);
  });
});
