import { describe, expect, it } from 'vitest';
import { creatorHubLoginPath } from './creatorHubPrivateRoute';

describe('creatorHubLoginPath', () => {
  it('preserves a private same-origin route and query string', () => {
    expect(creatorHubLoginPath('/audio-review/room-1?ws=workspace-1')).toBe(
      '/login?redirect=%2Faudio-review%2Froom-1%3Fws%3Dworkspace-1',
    );
  });

  it('rejects absolute and protocol-relative redirect targets', () => {
    expect(creatorHubLoginPath('https://attacker.example')).toBe('/login?redirect=%2Fworkspace');
    expect(creatorHubLoginPath('//attacker.example')).toBe('/login?redirect=%2Fworkspace');
  });
});
