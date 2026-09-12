import { describe, expect, it } from 'vitest';
import { roomOnlineState, type PresenceMember } from './workspacePresence';

const member = (overrides: Partial<PresenceMember>): PresenceMember => ({
  userId: 'user',
  email: 'user@example.test',
  name: 'User',
  crewRole: null,
  online: true,
  currentRoute: null,
  ...overrides,
});

describe('roomOnlineState', () => {
  it('only marks Smart Rooms containing an online participant', () => {
    expect(roomOnlineState([
      member({ currentRoute: '/workspace/project-1/photo-room' }),
      member({ currentRoute: '/workspace/project-1/video-room', online: false }),
      member({ currentRoute: '/workspace/project-1/oversikt' }),
    ], 'project-1')).toEqual({
      'photo-room': true,
      'video-room': false,
      'sound-room': false,
    });
  });

  it('ignores query strings while resolving the active room', () => {
    expect(roomOnlineState([
      member({ currentRoute: '/workspace/project-1/sound-room?panel=mix' }),
    ], 'project-1')['sound-room']).toBe(true);
  });

  it('does not leak room activity between projects', () => {
    expect(roomOnlineState([
      member({ currentRoute: '/workspace/project-2/photo-room' }),
    ], 'project-1')['photo-room']).toBe(false);
  });
});
