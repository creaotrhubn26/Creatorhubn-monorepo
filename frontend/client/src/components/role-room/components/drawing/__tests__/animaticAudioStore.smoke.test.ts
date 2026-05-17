// @ts-nocheck
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  saveScratchTrack,
  loadScratchTrack,
  deleteScratchTrack,
  saveFrameVoiceover,
  loadFrameVoiceovers,
  deleteFrameVoiceover,
  saveSfxClipBlob,
  saveSfxClipReference,
  loadSfxClips,
  deleteSfxClip,
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

describe('Sprint A.7 — frame-voiceover fallback (no IndexedDB)', () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    originalIndexedDB = (global as any).indexedDB;
    delete (global as any).indexedDB;
  });

  afterEach(() => {
    (global as any).indexedDB = originalIndexedDB;
  });

  it('save uten indexedDB returnerer false', async () => {
    const file = new File(['x'], 'vo.mp3', { type: 'audio/mpeg' });
    expect(await saveFrameVoiceover('scene-1', 'frame-1', file)).toBe(false);
  });

  it('load uten indexedDB returnerer tomt map', async () => {
    expect(await loadFrameVoiceovers('scene-1')).toEqual({});
  });

  it('delete uten indexedDB returnerer false', async () => {
    expect(await deleteFrameVoiceover('scene-1', 'frame-1')).toBe(false);
  });

  it('manglende sceneId/frameId/file gir false', async () => {
    const file = new File(['x'], 'vo.mp3', { type: 'audio/mpeg' });
    expect(await saveFrameVoiceover('', 'frame-1', file)).toBe(false);
    expect(await saveFrameVoiceover('scene-1', '', file)).toBe(false);
    expect(await deleteFrameVoiceover('', 'frame-1')).toBe(false);
    expect(await deleteFrameVoiceover('scene-1', '')).toBe(false);
  });

  it('load uten sceneId returnerer tomt map', async () => {
    expect(await loadFrameVoiceovers('')).toEqual({});
  });
});

describe('Sprint A.7 — sfx-clip fallback (no IndexedDB)', () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    originalIndexedDB = (global as any).indexedDB;
    delete (global as any).indexedDB;
  });

  afterEach(() => {
    (global as any).indexedDB = originalIndexedDB;
  });

  it('saveBlob uten indexedDB returnerer false', async () => {
    const file = new File(['x'], 's.mp3', { type: 'audio/mpeg' });
    expect(await saveSfxClipBlob('scene-1', 'evt-1', file)).toBe(false);
  });

  it('saveReference uten indexedDB returnerer false', async () => {
    expect(await saveSfxClipReference('scene-1', 'evt-1', '/api/x.mp3', 'AI')).toBe(false);
  });

  it('load uten indexedDB returnerer tomt map', async () => {
    expect(await loadSfxClips('scene-1')).toEqual({});
  });

  it('delete uten indexedDB returnerer false', async () => {
    expect(await deleteSfxClip('scene-1', 'evt-1')).toBe(false);
  });

  it('manglende url i saveReference gir false', async () => {
    expect(await saveSfxClipReference('scene-1', 'evt-1', '')).toBe(false);
  });
});
