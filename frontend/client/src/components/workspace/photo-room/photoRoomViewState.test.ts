import { describe, expect, it } from 'vitest';
import { readPhotoRoomViewState, writePhotoRoomViewState } from './photoRoomViewState';

describe('Photo Room view state', () => {
  it('merges saved preferences with URL state and rejects invalid enums', () => {
    const state = readPhotoRoomViewState(
      '?photoView=review&photoStatus=approved&photoSort=invalid',
      JSON.stringify({ sort: 'rating', inspector: 'metadata', folder: 'folder-1' }),
    );
    expect(state.view).toBe('review');
    expect(state.status).toBe('approved');
    expect(state.sort).toBe('newest');
    expect(state.inspector).toBe('metadata');
    expect(state.folder).toBe('folder-1');
  });

  it('preserves unrelated query parameters', () => {
    const next = writePhotoRoomViewState('?ai_credits=ok&cs=123', {
      view: 'grid', status: 'needs_edit', folder: 'all', source: 'all',
      collection: 'all', sort: 'newest', query: '', inspector: 'review',
    });
    expect(next).toContain('ai_credits=ok');
    expect(next).toContain('photoStatus=needs_edit');
  });
});
