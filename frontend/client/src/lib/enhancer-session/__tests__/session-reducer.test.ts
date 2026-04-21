import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type EnhancementSettings } from '../module-contract';
import {
  activeImage,
  burstSiblings,
  filterVisibleImages,
  resolvedTargetIds,
  sessionReducer,
  type SessionAction,
} from '../session-reducer';
import { SESSION_INITIAL, type SessionImage, type SessionState } from '../types';
import { EMPTY_HISTORY, pushHistoryEntry } from '../edit-history';

function makeImage(id: string, overrides: Partial<SessionImage> = {}): SessionImage {
  const initialSettings = overrides.settings ?? { ...DEFAULT_SETTINGS };
  return {
    id,
    file: new File([new Uint8Array([0])], `${id}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `blob:${id}`,
    fileName: `${id}.jpg`,
    sizeBytes: 1,
    mimeType: 'image/jpeg',
    lastModified: 1_700_000_000_000,
    settings: initialSettings,
    rating: 0,
    flag: 'none',
    sequence: 0,
    burstId: null,
    history: pushHistoryEntry(EMPTY_HISTORY, {
      at: 0,
      settings: initialSettings,
      changedModules: [],
    }),
    faceStatus: 'idle',
    ...overrides,
  };
}

function apply(state: SessionState, ...actions: SessionAction[]): SessionState {
  return actions.reduce((s, a) => sessionReducer(s, a), state);
}

const source: EnhancementSettings = {
  ...DEFAULT_SETTINGS,
  brightness: 20,
  contrast: 10,
  saturation: 5,
  teethWhiteness: 40,
  teethProfile: 'strong',
};

describe('sessionReducer — image lifecycle', () => {
  it('adds images, auto-assigns sequence, and picks the first as selected', () => {
    const state = apply(SESSION_INITIAL, {
      type: 'ADD_IMAGES',
      images: [makeImage('a'), makeImage('b'), makeImage('c')],
    });
    expect(state.images.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(state.images.map((i) => i.sequence)).toEqual([1, 2, 3]);
    expect(state.selectedId).toBe('a');
    expect(state.nextSequence).toBe(4);
  });

  it('keeps existing selection when further images are appended', () => {
    const state = apply(
      SESSION_INITIAL,
      { type: 'ADD_IMAGES', images: [makeImage('a')] },
      { type: 'SELECT_IMAGE', imageId: 'a' },
      { type: 'ADD_IMAGES', images: [makeImage('b')] },
    );
    expect(state.selectedId).toBe('a');
    expect(state.images.map((i) => i.sequence)).toEqual([1, 2]);
  });

  it('removes an image and advances selection to the next sibling', () => {
    const state = apply(
      SESSION_INITIAL,
      { type: 'ADD_IMAGES', images: [makeImage('a'), makeImage('b'), makeImage('c')] },
      { type: 'SELECT_IMAGE', imageId: 'b' },
      { type: 'REMOVE_IMAGE', imageId: 'b' },
    );
    expect(state.images.map((i) => i.id)).toEqual(['a', 'c']);
    expect(state.selectedId).toBe('c');
  });

  it('advances selection to previous sibling when removing the last image', () => {
    const state = apply(
      SESSION_INITIAL,
      { type: 'ADD_IMAGES', images: [makeImage('a'), makeImage('b')] },
      { type: 'SELECT_IMAGE', imageId: 'b' },
      { type: 'REMOVE_IMAGE', imageId: 'b' },
    );
    expect(state.selectedId).toBe('a');
  });

  it('resets to empty on CLEAR_ALL', () => {
    const populated = apply(SESSION_INITIAL, {
      type: 'ADD_IMAGES',
      images: [makeImage('a')],
    });
    expect(sessionReducer(populated, { type: 'CLEAR_ALL' })).toEqual(SESSION_INITIAL);
  });
});

describe('sessionReducer — selection', () => {
  const seeded = apply(SESSION_INITIAL, {
    type: 'ADD_IMAGES',
    images: [makeImage('a'), makeImage('b'), makeImage('c'), makeImage('d')],
  });

  it('single-select clears the multi-select set', () => {
    const state = apply(
      seeded,
      { type: 'TOGGLE_MULTI_SELECT', imageId: 'b', additive: true },
      { type: 'SELECT_IMAGE', imageId: 'd' },
    );
    expect(state.selectedId).toBe('d');
    expect(state.multiSelectIds).toEqual([]);
  });

  it('additive toggle adds and removes ids', () => {
    const state = apply(
      seeded,
      { type: 'TOGGLE_MULTI_SELECT', imageId: 'b', additive: true },
      { type: 'TOGGLE_MULTI_SELECT', imageId: 'c', additive: true },
      { type: 'TOGGLE_MULTI_SELECT', imageId: 'b', additive: true },
    );
    expect(state.multiSelectIds).toEqual(['c']);
  });

  it('range-select selects the inclusive slice between anchor and target', () => {
    const state = apply(seeded, { type: 'SELECT_RANGE', anchorId: 'b', targetId: 'd' });
    expect(state.multiSelectIds).toEqual(['b', 'c', 'd']);
    expect(state.selectedId).toBe('d');
  });

  it('resolvedTargetIds returns the multi-select set when populated', () => {
    const state = apply(seeded, { type: 'SELECT_RANGE', anchorId: 'a', targetId: 'b' });
    expect(resolvedTargetIds(state)).toEqual(['a', 'b']);
  });

  it('resolvedTargetIds falls back to all ids when no multi-select', () => {
    expect(resolvedTargetIds(seeded)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('sessionReducer — per-image updates', () => {
  const seeded = apply(SESSION_INITIAL, {
    type: 'ADD_IMAGES',
    images: [makeImage('a'), makeImage('b')],
  });

  it('PATCH_SETTINGS merges onto the existing settings of one image only', () => {
    const state = apply(seeded, {
      type: 'PATCH_SETTINGS',
      imageId: 'a',
      patch: { brightness: 42 },
    });
    expect(state.images[0].settings.brightness).toBe(42);
    expect(state.images[1].settings.brightness).toBe(DEFAULT_SETTINGS.brightness);
  });

  it('SET_RATING and SET_FLAG update only the target image', () => {
    const state = apply(
      seeded,
      { type: 'SET_RATING', imageId: 'a', rating: 5 },
      { type: 'SET_FLAG', imageId: 'b', flag: 'reject' },
    );
    expect(state.images[0].rating).toBe(5);
    expect(state.images[1].flag).toBe('reject');
  });

  it('SET_AI_SUGGESTION stores both the summary and the recipe and merges the recipe into settings', () => {
    const state = apply(seeded, {
      type: 'SET_AI_SUGGESTION',
      imageId: 'a',
      suggestion: {
        subject: 'portrait',
        confidence: 0.7,
        rationale: 'indoor single face',
        observations: [],
      },
      recipe: { brightness: 12, teethWhiteness: 15 },
    });
    expect(state.images[0].aiSuggestion?.subject).toBe('portrait');
    expect(state.images[0].aiSuggestedRecipe?.brightness).toBe(12);
    expect(state.images[0].settings.brightness).toBe(12);
    expect(state.images[0].settings.teethWhiteness).toBe(15);
  });

  it('ignores updates targeting an unknown image id', () => {
    const result = sessionReducer(seeded, {
      type: 'PATCH_SETTINGS',
      imageId: 'ghost',
      patch: { brightness: 99 },
    });
    expect(result).toBe(seeded);
  });
});

describe('sessionReducer — clipboard + paste', () => {
  const seeded = apply(SESSION_INITIAL, {
    type: 'ADD_IMAGES',
    images: [
      makeImage('a', { settings: source }),
      makeImage('b'),
      makeImage('c'),
    ],
  });

  it('COPY_EDITS snapshots the source settings into the clipboard', () => {
    const state = sessionReducer(seeded, { type: 'COPY_EDITS', imageId: 'a' });
    expect(state.clipboard?.sourceId).toBe('a');
    expect(state.clipboard?.settings.brightness).toBe(20);
  });

  it('PASTE_EDITS applies only the selected modules to the target ids', () => {
    const state = apply(
      seeded,
      { type: 'COPY_EDITS', imageId: 'a' },
      { type: 'PASTE_EDITS', targetIds: ['b'], modules: ['color'] },
    );
    expect(state.images[1].settings.brightness).toBe(20);
    expect(state.images[1].settings.teethWhiteness).toBe(DEFAULT_SETTINGS.teethWhiteness);
    expect(state.images[2].settings.brightness).toBe(DEFAULT_SETTINGS.brightness);
  });

  it('PASTE_EDITS is a no-op without a populated clipboard', () => {
    const state = sessionReducer(seeded, {
      type: 'PASTE_EDITS',
      targetIds: ['b'],
      modules: ['color'],
    });
    expect(state).toBe(seeded);
  });

  it('APPLY_SETTINGS_TO_SELECTION pushes source settings to every other image when no multi-select is set', () => {
    const state = sessionReducer(seeded, {
      type: 'APPLY_SETTINGS_TO_SELECTION',
      sourceId: 'a',
      modules: ['portrait'],
    });
    expect(state.images[0].settings).toEqual(seeded.images[0].settings);
    expect(state.images[1].settings.teethWhiteness).toBe(40);
    expect(state.images[2].settings.teethWhiteness).toBe(40);
  });

  it('APPLY_SETTINGS_TO_SELECTION honours multi-select when present', () => {
    const state = apply(
      seeded,
      { type: 'SELECT_RANGE', anchorId: 'b', targetId: 'b' },
      { type: 'APPLY_SETTINGS_TO_SELECTION', sourceId: 'a', modules: ['portrait'] },
    );
    expect(state.images[1].settings.teethWhiteness).toBe(40);
    expect(state.images[2].settings.teethWhiteness).toBe(DEFAULT_SETTINGS.teethWhiteness);
  });
});

describe('sessionReducer — export presets', () => {
  it('auto-selects the first preset added', () => {
    const state = sessionReducer(SESSION_INITIAL, {
      type: 'ADD_EXPORT_PRESET',
      preset: {
        id: 'web',
        name: 'Web 2000',
        format: 'jpeg',
        quality: 85,
        resize: { mode: 'long_edge', pixels: 2000 },
        colorSpace: 'srgb',
        filenameTemplate: '{original_name}_{sequence:04}',
      },
    });
    expect(state.activeExportPresetId).toBe('web');
  });

  it('removes a preset and clears active when needed', () => {
    const seeded = sessionReducer(SESSION_INITIAL, {
      type: 'ADD_EXPORT_PRESET',
      preset: {
        id: 'web',
        name: 'Web',
        format: 'jpeg',
        quality: 85,
        resize: { mode: 'none' },
        colorSpace: 'srgb',
        filenameTemplate: '{original_name}',
      },
    });
    const next = sessionReducer(seeded, { type: 'REMOVE_EXPORT_PRESET', presetId: 'web' });
    expect(next.exportPresets).toEqual([]);
    expect(next.activeExportPresetId).toBeNull();
  });
});

describe('activeImage', () => {
  it('returns null for an empty session', () => {
    expect(activeImage(SESSION_INITIAL)).toBeNull();
  });

  it('returns the selected image', () => {
    const state = apply(SESSION_INITIAL, {
      type: 'ADD_IMAGES',
      images: [makeImage('a'), makeImage('b')],
    });
    expect(activeImage(state)?.id).toBe('a');
  });
});

describe('sessionReducer — history', () => {
  const seeded = apply(SESSION_INITIAL, {
    type: 'ADD_IMAGES',
    images: [makeImage('a')],
  });

  it('COMMIT_HISTORY pushes the current settings onto the history', () => {
    const edited = sessionReducer(seeded, {
      type: 'PATCH_SETTINGS',
      imageId: 'a',
      patch: { brightness: 18 },
    });
    const committed = sessionReducer(edited, { type: 'COMMIT_HISTORY', imageId: 'a' });
    const image = committed.images[0];
    expect(image.history.entries.length).toBe(2);
    expect(image.history.entries[image.history.index].settings.brightness).toBe(18);
  });

  it('COMMIT_HISTORY is a no-op when nothing changed since the last commit', () => {
    const before = seeded.images[0].history;
    const after = sessionReducer(seeded, { type: 'COMMIT_HISTORY', imageId: 'a' });
    expect(after.images[0].history).toBe(before);
  });

  it('UNDO_HISTORY restores the prior snapshot on the image', () => {
    const edited = sessionReducer(seeded, {
      type: 'PATCH_SETTINGS',
      imageId: 'a',
      patch: { brightness: 42 },
    });
    const committed = sessionReducer(edited, { type: 'COMMIT_HISTORY', imageId: 'a' });
    const undone = sessionReducer(committed, { type: 'UNDO_HISTORY', imageId: 'a' });
    expect(undone.images[0].settings.brightness).toBe(DEFAULT_SETTINGS.brightness);
  });

  it('REDO_HISTORY re-applies the snapshot after undo', () => {
    const edited = sessionReducer(seeded, {
      type: 'PATCH_SETTINGS',
      imageId: 'a',
      patch: { brightness: 42 },
    });
    const committed = sessionReducer(edited, { type: 'COMMIT_HISTORY', imageId: 'a' });
    const undone = sessionReducer(committed, { type: 'UNDO_HISTORY', imageId: 'a' });
    const redone = sessionReducer(undone, { type: 'REDO_HISTORY', imageId: 'a' });
    expect(redone.images[0].settings.brightness).toBe(42);
  });
});

describe('sessionReducer — bursts + filter', () => {
  const seeded = apply(SESSION_INITIAL, {
    type: 'ADD_IMAGES',
    images: [makeImage('a'), makeImage('b'), makeImage('c'), makeImage('d')],
  });

  it('ASSIGN_BURSTS writes burstId only for matching images', () => {
    const state = sessionReducer(seeded, {
      type: 'ASSIGN_BURSTS',
      assignments: [
        { imageId: 'a', burstId: 'burst_1' },
        { imageId: 'b', burstId: 'burst_1' },
      ],
    });
    expect(state.images[0].burstId).toBe('burst_1');
    expect(state.images[1].burstId).toBe('burst_1');
    expect(state.images[2].burstId).toBeNull();
    expect(state.images[3].burstId).toBeNull();
  });

  it('APPLY_RATING_TO_BURST writes only to burst members', () => {
    const withBursts = sessionReducer(seeded, {
      type: 'ASSIGN_BURSTS',
      assignments: [
        { imageId: 'a', burstId: 'burst_1' },
        { imageId: 'b', burstId: 'burst_1' },
      ],
    });
    const next = sessionReducer(withBursts, {
      type: 'APPLY_RATING_TO_BURST',
      burstId: 'burst_1',
      rating: 4,
    });
    expect(next.images[0].rating).toBe(4);
    expect(next.images[1].rating).toBe(4);
    expect(next.images[2].rating).toBe(0);
  });

  it('APPLY_FLAG_TO_BURST flags every member', () => {
    const withBursts = sessionReducer(seeded, {
      type: 'ASSIGN_BURSTS',
      assignments: [
        { imageId: 'c', burstId: 'burst_9' },
        { imageId: 'd', burstId: 'burst_9' },
      ],
    });
    const next = sessionReducer(withBursts, {
      type: 'APPLY_FLAG_TO_BURST',
      burstId: 'burst_9',
      flag: 'reject',
    });
    expect(next.images[2].flag).toBe('reject');
    expect(next.images[3].flag).toBe('reject');
    expect(next.images[0].flag).toBe('none');
  });

  it('burstSiblings returns every member of the burst', () => {
    const withBursts = sessionReducer(seeded, {
      type: 'ASSIGN_BURSTS',
      assignments: [
        { imageId: 'a', burstId: 'burst_1' },
        { imageId: 'b', burstId: 'burst_1' },
      ],
    });
    expect(burstSiblings(withBursts, 'burst_1').map((i) => i.id)).toEqual(['a', 'b']);
    expect(burstSiblings(withBursts, null)).toEqual([]);
  });

  it('SET_CULL_FILTER changes visible image slice', () => {
    const state = apply(
      seeded,
      { type: 'SET_FLAG', imageId: 'a', flag: 'pick' },
      { type: 'SET_FLAG', imageId: 'b', flag: 'reject' },
      { type: 'SET_RATING', imageId: 'c', rating: 5 },
    );

    expect(filterVisibleImages({ ...state, cullFilter: 'all' }).length).toBe(4);
    expect(filterVisibleImages({ ...state, cullFilter: 'picks' }).map((i) => i.id)).toEqual(['a']);
    expect(filterVisibleImages({ ...state, cullFilter: 'rejects' }).map((i) => i.id)).toEqual(['b']);
    expect(filterVisibleImages({ ...state, cullFilter: 'five_star' }).map((i) => i.id)).toEqual(['c']);
    expect(filterVisibleImages({ ...state, cullFilter: 'unrated' }).map((i) => i.id)).toEqual(['d']);
  });
});
