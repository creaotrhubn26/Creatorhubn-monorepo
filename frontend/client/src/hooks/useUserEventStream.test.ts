import { describe, expect, it } from 'vitest';
import { decodeUserEventFrame } from './useUserEventStream';

describe('decodeUserEventFrame', () => {
  it('unwraps the backend user_event envelope', () => {
    expect(decodeUserEventFrame(JSON.stringify({
      type: 'user_event',
      event: { kind: 'board.updated', projectId: 'project-1' },
    }))).toEqual({ kind: 'board.updated', projectId: 'project-1' });
  });

  it('accepts legacy root-level event frames', () => {
    expect(decodeUserEventFrame(JSON.stringify({
      kind: 'gallery.selection-submitted',
      galleryId: 'gallery-1',
    }))).toMatchObject({ kind: 'gallery.selection-submitted', galleryId: 'gallery-1' });
  });

  it('ignores malformed and non-event frames', () => {
    expect(decodeUserEventFrame('{')).toBeNull();
    expect(decodeUserEventFrame(JSON.stringify({ type: 'connection_established' }))).toBeNull();
  });
});
