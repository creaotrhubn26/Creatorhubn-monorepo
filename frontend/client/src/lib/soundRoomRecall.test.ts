import { describe, expect, it } from 'vitest';

import {
  nextRecallStatus,
  recallPayloadFromComment,
  recallTitleFromComment,
} from './soundRoomRecall';

describe('Sound Room recall model', () => {
  it('moves recalls through a deliberate three-state workflow', () => {
    expect(nextRecallStatus('todo')).toBe('in_progress');
    expect(nextRecallStatus('in_progress')).toBe('done');
    expect(nextRecallStatus('done')).toBe('todo');
  });

  it('turns timestamped feedback into a linked task payload', () => {
    expect(recallPayloadFromComment('room-1', 'version-7', {
      id: 'comment-3',
      body: '  Litt   mer vokal i refrenget  ',
      section_ref: 'Refreng 2',
      timecode_seconds: 73,
    })).toEqual({
      projectId: 'room-1',
      versionId: 'version-7',
      commentId: 'comment-3',
      title: 'Litt mer vokal i refrenget',
      assignee: 'Refreng 2',
      status: 'todo',
    });
  });

  it('keeps generated task titles within the backend limit', () => {
    const title = recallTitleFromComment({ id: 'comment-1', body: 'x'.repeat(500) });
    expect(title.length).toBeLessThanOrEqual(180);
    expect(title.endsWith('…')).toBe(true);
  });
});
